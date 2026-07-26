-- Migração 0001 — contas individuais + parede de dados entre empresas
--
-- O que isso cria:
--   1) organizations   — uma linha por empresa/imobiliária.
--   2) memberships      — liga cada usuário (auth.users, do Supabase Auth) a uma organização,
--                         com um papel (dono ou corretor).
--   3) organization_id  — nova coluna em whatsapp_processamentos e direciona_config, marcando
--                         de quem é cada registro.
--   4) RLS (Row Level Security) — a cerca automática: o próprio banco de dados passa a recusar
--                         qualquer leitura/escrita que tente misturar organizações, mesmo que
--                         algum código novo esqueça de filtrar por empresa.
--
-- Como aplicar (leva 1 minuto):
--   1. Abra o painel do Supabase do projeto do Corretor Pro.
--   2. Vá em "SQL Editor" → "New query".
--   3. Cole o conteúdo inteiro deste arquivo e clique em "Run".
--   4. Pronto — nada quebra no site que já está no ar; esta migração só ADICIONA coisas novas,
--      não remove nem altera nada que já existe.
--
-- Depois de aplicar, os dados que já existem em whatsapp_processamentos/direciona_config ficam
-- com organization_id vazio (NULL) até a migração 0002 (que vai atribuir tudo à sua organização,
-- a "Empresa 1") — isso é feito à parte, de propósito, pra você conferir esta primeira etapa
-- antes de qualquer coisa tocar nos dados existentes.

-- 1) Organizações -------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- 2) Vínculo usuário × organização ---------------------------------------------
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  papel text not null default 'corretor' check (papel in ('dono', 'corretor')),
  criado_em timestamptz not null default now(),
  unique (user_id, organization_id)
);

create index if not exists memberships_user_id_idx on memberships(user_id);
create index if not exists memberships_org_id_idx on memberships(organization_id);

-- Função auxiliar: devolve as organizações do usuário autenticado na requisição atual.
-- security definer pra poder ler `memberships` mesmo com RLS ativa nela.
create or replace function minhas_organizacoes()
returns setof uuid
language sql
security definer
stable
as $$
  select organization_id from memberships where user_id = auth.uid();
$$;

-- 3) Coluna de empresa nas tabelas de dados -------------------------------------
alter table if exists whatsapp_processamentos
  add column if not exists organization_id uuid references organizations(id);

alter table if exists direciona_config
  add column if not exists organization_id uuid references organizations(id);

create index if not exists whatsapp_processamentos_org_id_idx on whatsapp_processamentos(organization_id);
create index if not exists direciona_config_org_id_idx on direciona_config(organization_id);

-- 4) RLS — a cerca automática ----------------------------------------------------
alter table organizations enable row level security;
alter table memberships enable row level security;
alter table whatsapp_processamentos enable row level security;
alter table direciona_config enable row level security;

-- organizations: só vê quem é membro.
drop policy if exists org_select_membros on organizations;
create policy org_select_membros on organizations
  for select using (id in (select minhas_organizacoes()));

-- memberships: cada usuário só vê os próprios vínculos.
drop policy if exists membership_select_proprio on memberships;
create policy membership_select_proprio on memberships
  for select using (user_id = auth.uid());

-- whatsapp_processamentos: só lê/grava dentro da própria organização.
drop policy if exists processamentos_isolamento on whatsapp_processamentos;
create policy processamentos_isolamento on whatsapp_processamentos
  for all using (organization_id in (select minhas_organizacoes()))
  with check (organization_id in (select minhas_organizacoes()));

-- direciona_config: mesma regra.
drop policy if exists config_isolamento on direciona_config;
create policy config_isolamento on direciona_config
  for all using (organization_id in (select minhas_organizacoes()))
  with check (organization_id in (select minhas_organizacoes()));

-- Observação importante: hoje o backend do Corretor Pro usa a credencial de administrador
-- do Supabase (service_role), que IGNORA a RLS por padrão — é assim que o sistema atual
-- consegue funcionar com uma chave só. A RLS acima só vira a "trava física" de verdade
-- quando o backend passar a consultar o banco usando a sessão do próprio usuário logado
-- (ou o backend continuar com service_role mas SEMPRE filtrando por organization_id — as
-- duas coisas juntas, RLS + filtro manual, é o que dá a proteção em camada dupla). Essa
-- troca é o próximo passo, feito com cuidado pra não quebrar o que está no ar.
