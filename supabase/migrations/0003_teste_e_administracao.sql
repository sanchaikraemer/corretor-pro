-- Migração 0003 — teste de 7 dias, pagamento e painel administrativo
--
-- O que isso cria:
--   1) organizations.trial_expira_em — data em que o teste grátis de 7 dias acaba.
--   2) organizations.status         — 'teste' (nos 7 dias), 'ativo' (pagou) ou 'bloqueado'
--                                      (teste acabou sem pagar, ou bloqueado à mão).
--   3) platform_admins              — marca quem é administrador da PLATAFORMA inteira
--                                      (só você) — diferente de "dono", que é dono de UMA
--                                      empresa só.
--   4) criar_empresa_e_dono(...)    — a única porta de entrada pra criar empresa nova:
--                                      cria a empresa E já vincula quem chamou como dono,
--                                      numa operação só (evita brecha de alguém se auto-
--                                      vincular a uma empresa que não é dele).
--   5) admin_visao_empresas         — uma "visão" pronta com todas as empresas, dias
--                                      restantes de teste e quantidade de usuários — é
--                                      isso que o painel administrativo vai consultar.
--
-- Só rode isso DEPOIS da 0001 e da 0002.

-- 1) Colunas de teste/pagamento -------------------------------------------------
alter table organizations
  add column if not exists trial_expira_em timestamptz not null default (now() + interval '7 days');

alter table organizations
  add column if not exists status text not null default 'teste'
    check (status in ('teste', 'ativo', 'bloqueado'));

-- Sua própria empresa (criada na migração 0002) não deve ficar presa a teste — ela é a
-- conta original do dono da plataforma, sempre ativa.
update organizations set status = 'ativo'
where id = '00000000-0000-0000-0000-000000000001';

-- 2) Administrador da plataforma -------------------------------------------------
create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table platform_admins enable row level security;

drop policy if exists platform_admins_select_proprio on platform_admins;
create policy platform_admins_select_proprio on platform_admins
  for select using (user_id = auth.uid());

create or replace function is_platform_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

-- 3) Porta única pra criar empresa nova (usada pelo cadastro público) -------------
create or replace function criar_empresa_e_dono(p_nome text)
returns uuid
language plpgsql
security definer
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

  insert into organizations (nome, trial_expira_em, status)
  values (trim(p_nome), now() + interval '7 days', 'teste')
  returning id into novo_id;

  insert into memberships (user_id, organization_id, papel)
  values (auth.uid(), novo_id, 'dono');

  return novo_id;
end;
$$;

grant execute on function criar_empresa_e_dono(text) to authenticated;

-- 4) RLS extra: administrador da plataforma enxerga e atualiza qualquer empresa ---
drop policy if exists org_select_admin on organizations;
create policy org_select_admin on organizations
  for select using (is_platform_admin());

drop policy if exists org_update_admin on organizations;
create policy org_update_admin on organizations
  for update using (is_platform_admin()) with check (is_platform_admin());

-- Sem isto, a contagem de usuários por empresa (admin_visao_empresas) aparece zerada pro
-- administrador — a cerca de memberships também escondia a contagem dele, não só dos dados.
drop policy if exists membership_select_admin on memberships;
create policy membership_select_admin on memberships
  for select using (is_platform_admin());

-- 5) Visão pronta pro painel administrativo --------------------------------------
-- security_invoker garante que a visão respeita a RLS de quem está CONSULTANDO —
-- ou seja, um dono comum só vê a própria empresa por aqui; só o admin da plataforma
-- vê todas (porque a policy org_select_admin libera isso só pra ele).
create or replace view admin_visao_empresas
with (security_invoker = true) as
select
  o.id,
  o.nome,
  o.status,
  o.criado_em,
  o.trial_expira_em,
  greatest(0, ceil(extract(epoch from (o.trial_expira_em - now())) / 86400))::int as dias_restantes_teste,
  (select count(*) from memberships m where m.organization_id = o.id) as qtd_usuarios
from organizations o;

grant select on admin_visao_empresas to authenticated;

-- Depois de rodar isto, marque sua própria conta como administradora da plataforma
-- (troque o e-mail se necessário):
--
-- insert into platform_admins (user_id)
-- select id from auth.users where email = 'sanchaikraemer3@gmail.com'
-- on conflict (user_id) do nothing;
