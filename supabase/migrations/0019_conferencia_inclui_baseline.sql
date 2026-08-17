-- 0019_conferencia_inclui_baseline.sql — v1285
--
-- ADITIVA E PEQUENA. Não cria tabela, não muda dado, não mexe em permissão: só reescreve a função
-- `conferir_migracoes()` (nascida na 0017, reescrita pela 0018) pra ela também reportar a
-- **0000_baseline.sql**.
--
-- Por que precisa: a regra do projeto desde a v1185 é que o banco se reporte sozinho — nenhuma
-- migração pode ficar invisível no diagnóstico (`/api/diagnostico?mode=banco`). O baseline entrou
-- na v1285 pra o banco voltar a poder nascer do repositório, e sem esta linha ele seria a única
-- peça sem conferência. O teste `tests/v1185-...` falha de propósito quando isso acontece — foi
-- ele que pegou.
--
-- O que a linha 0 confere: se as duas tabelas base existem mesmo (`whatsapp_processamentos` e
-- `direciona_config`). Num banco de produção elas já existem desde sempre, então ela aparece como
-- "aplicada" na hora, sem nada pra fazer. Num ambiente novo, ela é a primeira coisa a acender.
--
-- Rodar duas vezes não quebra (create or replace).

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
      ( 0, '0000_baseline.sql'),
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
      (18, '0018_cadastro_atomico_e_limpeza.sql'),
      (19, '0019_conferencia_inclui_baseline.sql')
    ) as t(numero, arquivo)
  loop
    ok := false;
    motivo := null;
    begin
      case m.numero
        when 19 then
          -- A própria conferência se confere: ela só está "aplicada" se o corpo da função em uso
          -- realmente cita o baseline. Se alguém reinstalar uma versão antiga da função por cima,
          -- esta linha acende na hora — que é o ponto da regra da v1185.
          motivo := 'a conferência do banco reporta também o baseline (0000)';
          ok := to_regprocedure('public.conferir_migracoes()') is not null
            and exists (
              select 1 from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname = 'conferir_migracoes'
                and p.prosrc like '%0000_baseline.sql%'
            );

        when 0 then
          motivo := 'tabelas base (conversas + configurações) existem';
          ok := to_regclass('public.whatsapp_processamentos') is not null
            and to_regclass('public.direciona_config') is not null;

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


-- Mesmas permissões que a 0017/0018 já davam: fora do alcance do navegador, só o backend chama.
revoke all on function public.conferir_migracoes() from public, anon, authenticated;
grant execute on function public.conferir_migracoes() to service_role;
