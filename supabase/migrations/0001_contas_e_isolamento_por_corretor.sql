-- Corretor Pro v980 — contas individuais, isolamento de dados por corretor e teste grátis
-- ----------------------------------------------------------------------------------------
-- Cole TODO este arquivo no SQL Editor do Supabase (projeto do Corretor Pro) e clique em
-- "Run". É idempotente: pode ser executado de novo sem quebrar nada (segue o mesmo padrão
-- já usado nos scripts supabase-correcao-v44.sql / v51.sql do projeto LeveCRM).
--
-- O que este arquivo faz:
--   1) Cria a tabela "profiles" — uma linha por conta, com status de teste/licença.
--   2) Cria a função que reconhece o administrador (você) pelo e-mail de login.
--   3) Cria a conta automaticamente com 7 dias de teste grátis sempre que alguém se cadastra.
--   4) Adiciona a coluna "owner_id" nas tabelas de dados (quem é dono de cada registro).
--   5) Liga a trava de segurança (RLS): cada conta só enxerga o que é dela; você, como
--      administrador, continua enxergando tudo.
--
-- O que este arquivo NÃO faz sozinho: não apaga nem move os dados que já existem hoje (leads,
-- conversas importadas, configuração do Cérebro) — eles continuam no banco, só que sem dono
-- definido ainda. O passo de "colocar seus dados antigos dentro da sua conta nova" é manual,
-- feito depois que você criar sua conta pela tela — as instruções ficam no final deste arquivo.
-- ----------------------------------------------------------------------------------------

begin;

-- ============================================================================
-- 1) FUNÇÃO QUE RECONHECE O ADMINISTRADOR
--    Mesmo padrão já validado no projeto LeveCRM: reconhece pelo e-mail de login,
--    não por uma tabela separada de permissões (mais simples e já comprovado).
-- ============================================================================
create or replace function public.is_corretor_pro_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'sanchaikraemer3@gmail.com'
$$;

-- ============================================================================
-- 2) TABELA profiles — uma linha por conta (dono, teste, licença)
-- ============================================================================
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nome           text,
  email          text,
  -- account_status: 'trial' (teste grátis em andamento) | 'active' (liberado por você após
  -- pagamento) | 'blocked' (bloqueado manualmente por você).
  account_status text not null default 'trial',
  trial_end      timestamptz,
  license_end    timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada conta só lê o próprio perfil; você, como administrador, lê todos (é assim que o
-- painel de administrador consegue listar todo mundo).
drop policy if exists "profiles_leitura_propria_ou_admin" on public.profiles;
create policy "profiles_leitura_propria_ou_admin"
on public.profiles
for select
using (id = auth.uid() or public.is_corretor_pro_admin());

-- De propósito, NÃO existe política de UPDATE/INSERT/DELETE aberta pro próprio usuário aqui.
-- Se existisse, qualquer pessoa logada poderia se "autoliberar" mudando o próprio
-- account_status/trial_end/license_end. Só o servidor do Corretor Pro (com a chave
-- administrativa, fora do navegador) pode alterar essas colunas — é a rota de administrador
-- que faz isso, sempre conferindo antes que quem está pedindo é mesmo você.

-- ============================================================================
-- 3) CRIA A CONTA AUTOMATICAMENTE COM 7 DIAS DE TESTE AO SE CADASTRAR
-- ============================================================================
create or replace function public.lidar_com_novo_usuario_corretor_pro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, account_status, trial_end)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    'trial',
    now() + interval '7 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario_corretor_pro on auth.users;
create trigger ao_criar_usuario_corretor_pro
  after insert on auth.users
  for each row execute function public.lidar_com_novo_usuario_corretor_pro();

-- ============================================================================
-- 4) COLUNA owner_id NAS TABELAS DE DADOS + TRAVA DE ISOLAMENTO (RLS)
--    "add column if not exists" não apaga nada que já existe — só acrescenta.
-- ============================================================================

-- 4.1) whatsapp_processamentos (conversas importadas)
alter table if exists public.whatsapp_processamentos
  add column if not exists owner_id uuid references auth.users(id);
create index if not exists whatsapp_processamentos_owner_idx
  on public.whatsapp_processamentos (owner_id);
alter table if exists public.whatsapp_processamentos enable row level security;
drop policy if exists "whatsapp_processamentos_dono_ou_admin" on public.whatsapp_processamentos;
create policy "whatsapp_processamentos_dono_ou_admin"
on public.whatsapp_processamentos
for all
using (owner_id = auth.uid() or public.is_corretor_pro_admin())
with check (owner_id = auth.uid() or public.is_corretor_pro_admin());

-- 4.2) leads
alter table if exists public.leads
  add column if not exists owner_id uuid references auth.users(id);
create index if not exists leads_owner_idx on public.leads (owner_id);
alter table if exists public.leads enable row level security;
drop policy if exists "leads_dono_ou_admin" on public.leads;
create policy "leads_dono_ou_admin"
on public.leads
for all
using (owner_id = auth.uid() or public.is_corretor_pro_admin())
with check (owner_id = auth.uid() or public.is_corretor_pro_admin());

-- 4.3) direciona_leads (tabela legada, ver CLAUDE.md — ainda usada em alguns ambientes)
alter table if exists public.direciona_leads
  add column if not exists owner_id uuid references auth.users(id);
create index if not exists direciona_leads_owner_idx on public.direciona_leads (owner_id);
alter table if exists public.direciona_leads enable row level security;
drop policy if exists "direciona_leads_dono_ou_admin" on public.direciona_leads;
create policy "direciona_leads_dono_ou_admin"
on public.direciona_leads
for all
using (owner_id = auth.uid() or public.is_corretor_pro_admin())
with check (owner_id = auth.uid() or public.is_corretor_pro_admin());

-- 4.4) direciona_config (o Cérebro Comercial) — caso especial: hoje "chave" é única
-- sozinha (uma configuração pra tudo). Agora cada conta precisa da própria configuração
-- pra mesma chave ("direciona-cerebro"), então a unicidade passa a ser (chave, owner_id).
alter table if exists public.direciona_config
  add column if not exists owner_id uuid references auth.users(id);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.direciona_config'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (chave)'
  ) then
    alter table public.direciona_config drop constraint direciona_config_pkey;
  end if;
end $$;

create unique index if not exists direciona_config_chave_owner_uidx
  on public.direciona_config (chave, owner_id);
create index if not exists direciona_config_owner_idx on public.direciona_config (owner_id);
alter table if exists public.direciona_config enable row level security;
drop policy if exists "direciona_config_dono_ou_admin" on public.direciona_config;
create policy "direciona_config_dono_ou_admin"
on public.direciona_config
for all
using (owner_id = auth.uid() or public.is_corretor_pro_admin())
with check (owner_id = auth.uid() or public.is_corretor_pro_admin());

commit;

-- Recarrega o cache de schema do PostgREST para refletir as mudanças na hora.
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------------------
-- PRÓXIMO PASSO (manual, depois de rodar o script acima e criar sua conta pela tela nova):
--
-- 1. Crie sua conta normalmente pela tela de login do Corretor Pro (seu e-mail de sempre).
-- 2. No Supabase, vá em Authentication → Users, encontre seu e-mail e copie o "User UID".
-- 3. Volte no SQL Editor e rode o bloco abaixo, trocando SEU-UID-AQUI pelo UID copiado —
--    isso faz todos os seus leads e conversas antigas passarem a pertencer à sua conta nova:
--
--   update public.whatsapp_processamentos set owner_id = 'SEU-UID-AQUI' where owner_id is null;
--   update public.leads                    set owner_id = 'SEU-UID-AQUI' where owner_id is null;
--   update public.direciona_leads          set owner_id = 'SEU-UID-AQUI' where owner_id is null;
--   update public.direciona_config         set owner_id = 'SEU-UID-AQUI' where owner_id is null;
-- ----------------------------------------------------------------------------------------
