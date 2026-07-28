-- Migração 0009 — trava real contra empresa duplicada, organization_id obrigatório, e
-- search_path fixo nas funções SECURITY DEFINER.
--
-- A auditoria técnica/comercial de 27/07/2026 apontou três riscos que ainda não tinham sido
-- corrigidos:
--
--   5.3 Duas solicitações quase simultâneas de "criar empresa" podiam passar pela checagem
--       ("este login já tem empresa?") ANTES de qualquer uma terminar de gravar — criando duas
--       empresas (e dois testes grátis de 7 dias) pro mesmo login. A checagem em
--       criar_empresa_e_dono (migração 0006) é uma proteção no CÓDIGO, não no BANCO — sob
--       concorrência real ela não é atômica.
--   5.4 organization_id em whatsapp_processamentos (a tabela principal de leads) é opcional
--       (nullable) — o código sempre preenche, mas nada no banco IMPEDE um INSERT futuro sem
--       organização, o que criaria um lead "órfão" que nenhuma empresa consegue ver.
--   5.2 As funções com SECURITY DEFINER (minhas_organizacoes, is_platform_admin,
--       criar_empresa_e_dono, excluir_organizacao) não fixam search_path. Sem isso, em teoria
--       um objeto (tabela/função) com o mesmo nome criado num schema que entra antes de "public"
--       na search_path de quem chama poderia ser usado no lugar do objeto real — mais defesa em
--       profundidade do que um risco já observado aqui, mas é a prática recomendada pra qualquer
--       função SECURITY DEFINER no Postgres.
--
-- Como aplicar (igual às anteriores):
--   1. Painel do Supabase → SQL Editor → New query.
--   2. Cole este arquivo inteiro e clique em Run. Deve terminar com "Success".
--
-- Se o passo 1 (restrição única em memberships) falhar com "duplicate key value" é porque já
-- existe, na base real, mais de uma empresa vinculada ao mesmo login — o que não deveria
-- acontecer, mas se acontecer, a mensagem de erro mostra qual user_id está duplicado. Nesse
-- caso, pare e me avise antes de decidir qual das duas empresas manter; o restante desta
-- migração (passos 2 a 4) pode ser aplicado normalmente rodando cada bloco separado.

-- 1) Trava real (não só no código) contra mais de uma empresa por login ------------------------
-- Único índice necessário: memberships já tinha unique(user_id, organization_id) (migração
-- 0001), que só impede repetir o MESMO vínculo — não impede duas ORGANIZAÇÕES diferentes pro
-- mesmo usuário, que é a regra de negócio real desde a migração 0006.
alter table memberships
  add constraint memberships_um_por_usuario unique (user_id);

-- criar_empresa_e_dono passa a confiar na restrição acima pra garantir atomicidade de verdade
-- sob concorrência (a checagem "exists" continua existindo, pra dar uma mensagem de erro cedo
-- no caso comum — só não é mais a ÚNICA proteção). Se as duas chamadas concorrentes passarem
-- pela checagem, a segunda falha no INSERT com unique_violation; desfazemos a organização órfã
-- (criada sem dono) antes de devolver o erro.
create or replace function criar_empresa_e_dono(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  novo_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;
  if p_nome is null or length(trim(p_nome)) = 0 then
    raise exception 'Nome da empresa é obrigatório.';
  end if;
  if exists (select 1 from memberships where user_id = auth.uid()) then
    raise exception 'Este login já está vinculado a uma empresa — não é possível criar outra.';
  end if;

  insert into organizations (nome, trial_expira_em, status)
  values (trim(p_nome), now() + interval '7 days', 'teste')
  returning id into novo_id;

  begin
    insert into memberships (user_id, organization_id, papel)
    values (auth.uid(), novo_id, 'dono');
  exception when unique_violation then
    delete from organizations where id = novo_id;
    raise exception 'Este login já está vinculado a uma empresa — não é possível criar outra.';
  end;

  return novo_id;
end;
$$;

grant execute on function criar_empresa_e_dono(text) to authenticated;

-- 2) organization_id obrigatório em whatsapp_processamentos ------------------------------------
-- Preenche qualquer linha esquecida (mesmo padrão de backfill já usado na migração 0002) antes
-- de travar a coluna como obrigatória — assim a migração nunca falha por dado antigo incompleto.
update whatsapp_processamentos
set organization_id = '00000000-0000-0000-0000-000000000001'
where organization_id is null;

alter table whatsapp_processamentos
  alter column organization_id set not null;

-- 3) search_path fixo nas demais funções SECURITY DEFINER --------------------------------------
create or replace function minhas_organizacoes()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from memberships where user_id = auth.uid();
$$;

create or replace function is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create or replace function excluir_organizacao(p_organization_id uuid)
returns table(nome text, ids_usuarios uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_ids uuid[];
begin
  if p_organization_id = '00000000-0000-0000-0000-000000000001' then
    raise exception 'A conta original (com os dados do dono da plataforma) não pode ser excluída.';
  end if;

  select o.nome into v_nome from organizations o where o.id = p_organization_id;
  if v_nome is null then
    raise exception 'Conta não encontrada (talvez já excluída).';
  end if;

  select coalesce(array_agg(distinct m.user_id), '{}') into v_ids
  from memberships m where m.organization_id = p_organization_id;

  delete from whatsapp_processamentos where organization_id = p_organization_id;
  delete from direciona_config where organization_id = p_organization_id;
  delete from memberships where organization_id = p_organization_id;
  delete from organizations where id = p_organization_id;

  return query select v_nome, v_ids;
end;
$$;

revoke all on function excluir_organizacao(uuid) from public, authenticated, anon;
