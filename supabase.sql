create extension if not exists pgcrypto;

create table if not exists public.corretor_pro_atendimentos (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  conversation_key text not null,
  nome_lead text not null,
  arquivo_origem text,
  ultima_mensagem_at timestamptz,
  ultima_mensagem_resumo text,
  timeline jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corretor_pro_atendimentos_device_conversa_unique
    unique (device_id, conversation_key)
);

create index if not exists corretor_pro_atendimentos_device_updated_idx
  on public.corretor_pro_atendimentos (device_id, updated_at desc);

alter table public.corretor_pro_atendimentos enable row level security;

-- O frontend nunca acessa esta tabela diretamente. As operações passam pelas
-- funções da Vercel usando SUPABASE_SERVICE_ROLE_KEY no servidor.
