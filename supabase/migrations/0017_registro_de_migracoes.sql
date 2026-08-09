-- Migração 0017 — o banco passa a dizer, sozinho, o que já foi aplicado nele (v1185)
--
-- POR QUE ESTA MIGRAÇÃO EXISTE
--
-- Hoje as migrações são coladas à mão no SQL Editor do Supabase e NADA registra o que foi rodado.
-- Isso não é risco teórico: a conferência de 07/08/2026 mostrou que a `0009` nunca tinha sido
-- aplicada, embora da `0010` à `0014` estivessem. O código estava numa versão e o banco em outra,
-- e ninguém tinha como saber — só olhando função por função, à mão.
--
-- Esta migração conserta a causa, não o sintoma: cria um registro do estado real do banco. Ela não
-- confia em "alguém marcou que rodou"; ela OLHA O CATÁLOGO DO POSTGRES e vê o que existe de fato —
-- tabela, função, índice, trava e permissão que cada migração deveria ter deixado. Se a `0009`
-- estiver faltando, aparece "faltando" aqui, mesmo que alguém jure que rodou.
--
-- Depois de aplicada, `api/diagnostico.js?mode=banco` mostra a lista pronta, em português, e o app
-- avisa quando o banco está atrás do código — em vez de continuar funcionando de um jeito antigo
-- em silêncio, que é o que as auditorias de 08/2026 apontaram como o maior risco restante.
--
-- IMPORTANTE — o que a conferência significa
-- Ela é por EFEITO, não por "este arquivo foi executado". Quando duas migrações deixam o mesmo
-- efeito (a `0015` refaz as travas que faltaram da `0009`), as duas aparecem como aplicadas — e é o
-- certo: o que importa é a trava EXISTIR, não qual arquivo a criou.
--
-- Rodar duas vezes por engano não quebra nada.

-- 1) Onde o estado fica guardado --------------------------------------------------------------
create table if not exists public.cp_migracoes_aplicadas (
  numero       int primary key,
  arquivo      text        not null,
  situacao     text        not null check (situacao in ('aplicada', 'faltando')),
  detalhe      text,
  conferida_em timestamptz not null default now()
);

-- Ninguém que venha do navegador precisa disso — nem pra ler. Só o backend (service_role, que
-- ignora RLS por definição). RLS ligada sem nenhuma política = porta fechada pra anon/authenticated.
alter table public.cp_migracoes_aplicadas enable row level security;
revoke all on table public.cp_migracoes_aplicadas from public, anon, authenticated;
grant select, insert, update, delete on table public.cp_migracoes_aplicadas to service_role;

-- 2) Auxiliares da conferência ------------------------------------------------------------------
-- Vêm ANTES de conferir_migracoes() de propósito: ela chama as duas.

-- "O navegador consegue chamar isso?" — anon e authenticated, contando a liberação automática que
-- o Postgres dá pro grupo `public` em toda função nova (foi exatamente esse detalhe que deixou a
-- porta aberta na primeira versão da 0013). Função que não existe não está ao alcance de ninguém.
create or replace function public.cp_navegador_pode_executar(p_assinatura text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regprocedure(p_assinatura) is null then
    return false;
  end if;
  return has_function_privilege('anon', p_assinatura, 'execute')
      or has_function_privilege('authenticated', p_assinatura, 'execute');
end;
$$;

-- A chave primária de direciona_config é (organization_id, chave)? É ela que sustenta o gravar do
-- Cérebro por empresa (o upsert com onConflict "organization_id,chave" em api/_pipeline.js).
create or replace function public.cp_direciona_config_pk_composta()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  colunas text[];
begin
  if to_regclass('public.direciona_config') is null then
    return false;
  end if;
  select array_agg(a.attname::text order by a.attname)
    into colunas
    from pg_constraint c
    join unnest(c.conkey) k on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
   where c.conrelid = 'public.direciona_config'::regclass
     and c.contype = 'p';
  return colunas = array['chave', 'organization_id'];
end;
$$;

-- 3) A conferência ------------------------------------------------------------------------------
-- Reescreve a tabela olhando o catálogo do Postgres e devolve a lista pronta pra quem chamou.
-- `returns setof` (em vez de `returns table`) de propósito: sem nomes de coluna virando variável
-- dentro da função, o `on conflict (numero)` lá embaixo não fica ambíguo.
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
      (17, '0017_registro_de_migracoes.sql')
    ) as t(numero, arquivo)
  loop
    ok := false;
    motivo := null;

    -- Uma conferência que dê erro (papel que não existe numa base de teste, tabela antiga com
    -- outro nome) não pode derrubar as outras dezesseis: vira "faltando" com o motivo do erro.
    begin
      case m.numero
        -- Contas e empresas: as duas tabelas novas.
        when 1 then
          motivo := 'tabelas organizations + memberships';
          ok := to_regclass('public.organizations') is not null
            and to_regclass('public.memberships') is not null;

        -- Dado antigo encaixado na "Empresa 1".
        when 2 then
          motivo := 'organização inicial criada';
          ok := to_regclass('public.organizations') is not null
            and exists (select 1 from public.organizations where id = '00000000-0000-0000-0000-000000000001');

        -- Teste grátis + administrador da plataforma.
        when 3 then
          motivo := 'tabela platform_admins';
          ok := to_regclass('public.platform_admins') is not null;

        -- Cérebro por corretor: unicidade de (empresa, chave). A 0005 troca o índice da 0004 por
        -- uma chave primária composta — as duas formas contam, porque o efeito é o mesmo.
        when 4 then
          motivo := 'unicidade (empresa, chave) em direciona_config';
          ok := to_regclass('public.direciona_config_org_chave_uidx') is not null
             or public.cp_direciona_config_pk_composta();

        when 5 then
          motivo := 'chave primária (organization_id, chave) em direciona_config';
          ok := public.cp_direciona_config_pk_composta();

        -- Uma empresa por login. Não dá pra procurar isso numa função específica: a `0011` apagou
        -- a `criar_empresa_e_dono(text)` da `0006` (e a checagem junto), a `0013` refez a checagem
        -- dentro da `criar_empresa_e_dono_para` e a `0015` pôs a trava no próprio banco. O que
        -- importa é o efeito estar garantido em ALGUM desses lugares.
        when 6 then
          motivo := 'um login não consegue abrir uma segunda empresa';
          ok := exists (select 1 from pg_constraint where conname = 'memberships_um_por_usuario')
             or exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname like 'criar_empresa_e_dono%'
                 and p.prosrc ilike '%vinculado a uma empresa%'
            );

        -- Exclusão de conta feita numa transação só.
        when 7 then
          motivo := 'função excluir_organizacao';
          ok := to_regprocedure('public.excluir_organizacao(uuid)') is not null;

        -- Telemetria de uso de IA.
        when 8 then
          motivo := 'tabela ai_usage_events';
          ok := to_regclass('public.ai_usage_events') is not null;

        -- As três travas que faltaram na 0009 (a 0015 refaz as mesmas — por isso valem pras duas).
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

        -- Índices que fazem a deduplicação de lead não varrer a tabela inteira.
        when 10 then
          motivo := 'índices de deduplicação';
          ok := to_regclass('public.whatsapp_proc_dedupe_arquivo_idx') is not null;

        -- Contato do corretor guardado no cadastro (versão de 5 campos da função).
        when 11 then
          motivo := 'criar_empresa_e_dono com telefone/cidade/estado/e-mail';
          ok := to_regprocedure('public.criar_empresa_e_dono(text, text, text, text, text)') is not null;

        -- Contadores atômicos de IA.
        when 12 then
          motivo := 'função reservar_analise_ia';
          ok := to_regprocedure('public.reservar_analise_ia(uuid, text, text, int, int)') is not null;

        -- Criação de empresa pelo servidor E porta fechada pro navegador. As duas metades importam:
        -- a trava contra cadastro falso em massa só vale de verdade com o revoke.
        when 13 then
          motivo := 'cadastro pelo servidor + criar_empresa_e_dono fora do alcance do navegador';
          ok := to_regclass('public.cadastros_por_conexao') is not null
            and to_regprocedure('public.criar_empresa_e_dono_para(uuid, text, text, text, text, text)') is not null
            and not public.cp_navegador_pode_executar('public.criar_empresa_e_dono_para(uuid, text, text, text, text, text)')
            and not public.cp_navegador_pode_executar('public.criar_empresa_e_dono(text)')
            and not public.cp_navegador_pode_executar('public.criar_empresa_e_dono(text, text, text, text, text)');

        -- Contadores só do backend + só chave de contador + exclusão devolvida ao service_role.
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

        -- Devolução da reserva quando a análise falha.
        when 16 then
          motivo := 'função devolver_analise_ia';
          ok := to_regprocedure('public.devolver_analise_ia(uuid, text, text)') is not null;

        -- Esta própria migração.
        when 17 then
          motivo := 'registro de migrações';
          ok := to_regclass('public.cp_migracoes_aplicadas') is not null;

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

-- 4) Permissões: conferência é assunto do backend, não do navegador ----------------------------
revoke all on function public.conferir_migracoes() from public, anon, authenticated;
revoke all on function public.cp_navegador_pode_executar(text) from public, anon, authenticated;
revoke all on function public.cp_direciona_config_pk_composta() from public, anon, authenticated;
grant execute on function public.conferir_migracoes() to service_role;
grant execute on function public.cp_navegador_pode_executar(text) to service_role;
grant execute on function public.cp_direciona_config_pk_composta() to service_role;

-- 5) Confere agora mesmo, pra a tabela já nascer com o retrato do banco -------------------------
select public.conferir_migracoes();
