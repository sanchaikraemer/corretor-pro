-- Migração 0018 — a trava contra cadastro falso vira UMA operação só, e a impressão da conexão
-- deixa de ser guardada pra sempre (v1186)
--
-- POR QUE ESTA MIGRAÇÃO EXISTE
--
-- Duas coisas que a auditoria de 08/2026 apontou e a conferência de 09/08 confirmou no código:
--
-- 1) A TRAVA CONTRA CADASTRO EM MASSA NÃO É ATÔMICA. Hoje `api/criar-conta.js` faz quatro passos
--    separados: conta quantos cadastros saíram desta conexão nas últimas 24h → decide se passa →
--    cria a empresa → registra +1 no contador. Entre o "conta" e o "registra" existe uma janela.
--    Cinco pedidos simultâneos da mesma conexão leem "4", todos passam, todos criam — e o limite
--    de 5 vira 9. Não é hipótese: é o comportamento normal de contar fora da transação.
--
-- 2) A IMPRESSÃO DA CONEXÃO É GUARDADA PARA SEMPRE. A tabela `cadastros_por_conexao` só é
--    consultada nas últimas 24h, e nada nunca apaga o resto. A Política de Privacidade já admite
--    isso, então não há contradição — mas não existe motivo pra manter esses registros
--    indefinidamente, e eles só crescem.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   1) Índice por data, pra a limpeza não varrer a tabela inteira.
--   2) `limpar_cadastros_por_conexao_antigos(dias)` — apaga o que passou do prazo (padrão 7 dias).
--   3) `criar_empresa_com_limite_de_conexao(...)` — contar, reservar, criar e registrar DENTRO DA
--      MESMA TRANSAÇÃO, com trava por conexão. Duas chamadas simultâneas da mesma conexão viram
--      fila: a segunda só conta depois que a primeira registrou.
--   4) Reescreve `conferir_migracoes()` (da 0017) incluindo a 0018, pra o diagnóstico do banco
--      continuar completo.
--
-- Rodar duas vezes por engano não quebra nada.

-- 1) Índice por data ----------------------------------------------------------------------------
-- O índice da 0013 é (conexao_hash, criado_em) — ótimo pra contar por conexão, inútil pra
-- "apague tudo que é mais velho que X".
create index if not exists cadastros_por_conexao_idade
  on cadastros_por_conexao (criado_em);

-- 2) Limpeza ------------------------------------------------------------------------------------
-- Só o backend chama. Devolve quantas linhas saíram, pra dar pra registrar no diagnóstico.
create or replace function limpar_cadastros_por_conexao_antigos(p_dias int default 7)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  dias int := greatest(coalesce(p_dias, 7), 1);   -- nunca apaga o dia corrente
  apagadas int;
begin
  delete from cadastros_por_conexao
   where criado_em < now() - (dias || ' days')::interval;
  get diagnostics apagadas = row_count;
  return apagadas;
end;
$$;

-- 3) Cadastro numa transação só -----------------------------------------------------------------
--
-- A trava é um advisory lock derivado da impressão da conexão: só serializa quem vem da MESMA
-- conexão, então dois corretores diferentes cadastrando ao mesmo tempo não esperam um pelo outro.
-- `pg_advisory_xact_lock` é solto sozinho no fim da transação — não existe caminho que deixe a
-- trava presa, nem se a função der erro no meio.
--
-- Quando o limite estoura, a função para com o código de erro CP429. O backend reconhece esse
-- código e devolve a recusa em português; qualquer outro erro continua sendo erro de verdade.
create or replace function criar_empresa_com_limite_de_conexao(
  p_user_id uuid,
  p_nome text,
  p_conexao_hash text,
  p_limite int default 5,
  p_telefone text default null,
  p_cidade text default null,
  p_estado text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ja_existe uuid;
  novo_id uuid;
  usados int;
  limite int := greatest(coalesce(p_limite, 5), 1);
begin
  if p_user_id is null then
    raise exception 'Usuário não informado.';
  end if;
  if p_nome is null or length(trim(p_nome)) = 0 then
    raise exception 'Nome da empresa é obrigatório.';
  end if;

  -- Login que JÁ tem empresa devolve a que existe, sem gastar tentativa nenhuma da conexão. É o
  -- primeiro login de quem se cadastrou antes — mesma regra idempotente da 0013.
  select organization_id into ja_existe
    from memberships where user_id = p_user_id
    order by criado_em desc limit 1;
  if ja_existe is not null then
    return ja_existe;
  end if;

  -- A partir daqui, quem vem da mesma conexão entra em fila.
  if p_conexao_hash is not null and length(trim(p_conexao_hash)) > 0 then
    perform pg_advisory_xact_lock(hashtext('cp-cadastro:' || p_conexao_hash));

    select count(*) into usados
      from cadastros_por_conexao
     where conexao_hash = p_conexao_hash
       and criado_em > now() - interval '24 hours';

    if usados >= limite then
      raise exception 'Já foram abertas % contas novas desta conexão de internet hoje.', limite
        using errcode = 'CP429';
    end if;
  end if;

  insert into organizations (nome, telefone, cidade, estado, email_contato, trial_expira_em, status)
  values (
    trim(p_nome),
    nullif(trim(coalesce(p_telefone, '')), ''),
    nullif(trim(coalesce(p_cidade, '')), ''),
    nullif(trim(coalesce(p_estado, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    now() + interval '7 days',
    'teste'
  )
  returning id into novo_id;

  -- Mesma rede de segurança da 0013: se duas chamadas do MESMO login passarem pelo select lá de
  -- cima, a segunda bate na trava memberships_um_por_usuario e devolve a empresa que a outra criou.
  begin
    insert into memberships (user_id, organization_id, papel)
    values (p_user_id, novo_id, 'dono');
  exception when unique_violation then
    delete from organizations where id = novo_id;
    select organization_id into ja_existe
      from memberships where user_id = p_user_id
      order by criado_em desc limit 1;
    return ja_existe;
  end;

  -- O registro do cadastro vai na MESMA transação: é isso que fecha a janela entre contar e criar.
  if p_conexao_hash is not null and length(trim(p_conexao_hash)) > 0 then
    insert into cadastros_por_conexao (conexao_hash, organization_id)
    values (p_conexao_hash, novo_id);
  end if;

  return novo_id;
end;
$$;

-- Nada disso pode estar ao alcance do navegador (a chave "anon" do Supabase é pública).
revoke all on function limpar_cadastros_por_conexao_antigos(int) from public, anon, authenticated;
revoke all on function criar_empresa_com_limite_de_conexao(uuid, text, text, int, text, text, text, text) from public, anon, authenticated;
grant execute on function limpar_cadastros_por_conexao_antigos(int) to service_role;
grant execute on function criar_empresa_com_limite_de_conexao(uuid, text, text, int, text, text, text, text) to service_role;

-- 4) A conferência da 0017 passa a conhecer a 0018 ----------------------------------------------
-- Recriada aqui (em vez de editar o arquivo da 0017, que pode já estar aplicado) pra o diagnóstico
-- `/api/diagnostico?mode=banco` continuar mostrando a lista inteira.
create or replace function public.conferir_migracoes()
returns setof public.cp_migracoes_aplicadas
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  ok boolean;
  motivo text;
begin
  for m in
    select * from (values
      ( 1, '0001_contas_e_empresas.sql'),
      ( 2, '0002_migrar_dados_existentes.sql'),
      ( 3, '0003_teste_e_administracao.sql'),
      ( 4, '0004_cerebro_por_corretor.sql'),
      ( 5, '0005_abrir_cerebro_multiconta.sql'),
      ( 6, '0006_uma_empresa_por_login.sql'),
      ( 7, '0007_excluir_organizacao_transacional.sql'),
      ( 8, '0008_telemetria_uso_ia.sql'),
      ( 9, '0009_travas_concorrencia_e_search_path.sql'),
      (10, '0010_dedupe_indexado.sql'),
      (11, '0011_cadastro_contato_corretor.sql'),
      (12, '0012_contadores_atomicos.sql'),
      (13, '0013_limite_cadastro_por_conexao.sql'),
      (14, '0014_permissoes_rpc_contadores.sql'),
      (15, '0015_travas_da_0009_fora_de_ordem.sql'),
      (16, '0016_devolver_reserva_analise.sql'),
      (17, '0017_registro_de_migracoes.sql'),
      (18, '0018_cadastro_atomico_e_limpeza.sql')
    ) as t(numero, arquivo)
  loop
    ok := false;
    motivo := null;
    begin
      case m.numero
        when 1 then
          motivo := 'tabelas organizations + memberships';
          ok := to_regclass('public.organizations') is not null
            and to_regclass('public.memberships') is not null;

        when 2 then
          motivo := 'organização inicial criada';
          ok := to_regclass('public.organizations') is not null
            and exists (select 1 from public.organizations where id = '00000000-0000-0000-0000-000000000001');

        when 3 then
          motivo := 'tabela platform_admins';
          ok := to_regclass('public.platform_admins') is not null;

        when 4 then
          motivo := 'unicidade (empresa, chave) em direciona_config';
          ok := to_regclass('public.direciona_config_org_chave_uidx') is not null
             or public.cp_direciona_config_pk_composta();

        when 5 then
          motivo := 'chave primária (organization_id, chave) em direciona_config';
          ok := public.cp_direciona_config_pk_composta();

        when 6 then
          motivo := 'um login não consegue abrir uma segunda empresa';
          ok := exists (select 1 from pg_constraint where conname = 'memberships_um_por_usuario')
             or exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname like 'criar_empresa_e_dono%'
                 and p.prosrc ilike '%vinculado a uma empresa%'
            );

        when 7 then
          motivo := 'função excluir_organizacao';
          ok := to_regprocedure('public.excluir_organizacao(uuid)') is not null;

        when 8 then
          motivo := 'tabela ai_usage_events';
          ok := to_regclass('public.ai_usage_events') is not null;

        when 9, 15 then
          motivo := 'uma empresa por login + lead sempre com empresa + search_path fixo';
          ok := exists (select 1 from pg_constraint where conname = 'memberships_um_por_usuario')
            and exists (
              select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'whatsapp_processamentos'
                 and column_name = 'organization_id' and is_nullable = 'NO'
            )
            and not exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.prosecdef
                 and (p.proconfig is null or not (p.proconfig::text like '%search_path%'))
            );

        when 10 then
          motivo := 'índices de deduplicação';
          ok := to_regclass('public.whatsapp_proc_dedupe_arquivo_idx') is not null;

        when 11 then
          motivo := 'criar_empresa_e_dono com telefone/cidade/estado/e-mail';
          ok := to_regprocedure('public.criar_empresa_e_dono(text, text, text, text, text)') is not null;

        when 12 then
          motivo := 'função reservar_analise_ia';
          ok := to_regprocedure('public.reservar_analise_ia(uuid, text, text, int, int)') is not null;

        when 13 then
          motivo := 'cadastro pelo servidor + criar_empresa_e_dono fora do alcance do navegador';
          ok := to_regclass('public.cadastros_por_conexao') is not null
            and to_regprocedure('public.criar_empresa_e_dono_para(uuid, text, text, text, text, text)') is not null
            and not public.cp_navegador_pode_executar('public.criar_empresa_e_dono_para(uuid, text, text, text, text, text)')
            and not public.cp_navegador_pode_executar('public.criar_empresa_e_dono(text)')
            and not public.cp_navegador_pode_executar('public.criar_empresa_e_dono(text, text, text, text, text)');

        when 14 then
          motivo := 'contadores só do backend + só chave de contador + exclusão liberada ao backend';
          ok := not public.cp_navegador_pode_executar('public.reservar_analise_ia(uuid, text, text, int, int)')
            and not public.cp_navegador_pode_executar('public.reservar_contador_dia(uuid, text, text, int)')
            and exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'reservar_contador_dia'
                 and p.prosrc like '%limite-(diario|mensal)%'
            )
            and to_regprocedure('public.excluir_organizacao(uuid)') is not null
            and has_function_privilege('service_role', 'public.excluir_organizacao(uuid)', 'execute');

        when 16 then
          motivo := 'função devolver_analise_ia';
          ok := to_regprocedure('public.devolver_analise_ia(uuid, text, text)') is not null;

        when 17 then
          motivo := 'registro de migrações';
          ok := to_regclass('public.cp_migracoes_aplicadas') is not null;

        when 18 then
          motivo := 'cadastro numa transação só + limpeza da impressão de conexão';
          ok := to_regprocedure('public.criar_empresa_com_limite_de_conexao(uuid, text, text, int, text, text, text, text)') is not null
            and to_regprocedure('public.limpar_cadastros_por_conexao_antigos(int)') is not null
            and not public.cp_navegador_pode_executar('public.criar_empresa_com_limite_de_conexao(uuid, text, text, int, text, text, text, text)')
            and to_regclass('public.cadastros_por_conexao_idade') is not null;

        else
          motivo := 'sem conferência definida';
          ok := false;
      end case;
    exception when others then
      ok := false;
      motivo := coalesce(motivo, 'conferência') || ' — não foi possível conferir: ' || sqlerrm;
    end;

    insert into public.cp_migracoes_aplicadas as c (numero, arquivo, situacao, detalhe, conferida_em)
    values (m.numero, m.arquivo, case when ok then 'aplicada' else 'faltando' end, motivo, now())
    on conflict (numero) do update
      set arquivo      = excluded.arquivo,
          situacao     = excluded.situacao,
          detalhe      = excluded.detalhe,
          conferida_em = excluded.conferida_em;
  end loop;

  return query
    select c.* from public.cp_migracoes_aplicadas c order by c.numero;
end;
$$;

revoke all on function public.conferir_migracoes() from public, anon, authenticated;
grant execute on function public.conferir_migracoes() to service_role;

-- 5) Primeira limpeza e conferência --------------------------------------------------------------
select public.limpar_cadastros_por_conexao_antigos(7);
select public.conferir_migracoes();
