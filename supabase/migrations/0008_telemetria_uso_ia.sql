-- Migração 0008 — telemetria de uso de IA por empresa
--
-- A auditoria técnica/comercial de 27/07/2026 apontou: antes de definir plano/preço com
-- segurança, é indispensável saber quanto cada corretor está custando de IA de verdade — hoje
-- o sistema não registra nada disso. Existe só um CONTADOR de segurança contra abuso (limite
-- diário de análises, ver "LIMITE DIÁRIO DE USO DA IA" em api/_pipeline.js), que sobrescreve um
-- único número por dia e não serve para medir custo real (não sabe quantos tokens, não guarda
-- histórico, e é sobrescrito por concorrência).
--
-- O que isso cria:
--   1) ai_usage_events — UMA LINHA POR CHAMADA real à OpenAI (não um contador que se sobrescreve).
--      Guarda: de qual empresa, que tipo de chamada (texto ou transcrição de áudio), qual modelo,
--      de qual funcionalidade (rota) veio, e o consumo real (tokens de entrada/saída, ou segundos
--      de áudio). O custo em reais NÃO fica gravado aqui — é calculado na hora de mostrar (tabela
--      de preço por modelo fica no código, api/_iaCusto.js, porque a OpenAI muda preço com mais
--      frequência do que faz sentido rodar uma migração nova).
--   2) RLS — cada empresa só vê os PRÓPRIOS eventos; o administrador da plataforma vê de todas
--      (mesmo padrão já usado em organizations/memberships, ver migração 0003).
--
-- Como aplicar (igual às anteriores):
--   1. Painel do Supabase → SQL Editor → New query.
--   2. Cole este arquivo inteiro e clique em Run. Deve terminar com "Success".
--
-- Seguro pros dados: só ADICIONA uma tabela nova. Não altera nada que já existe.

create table if not exists ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('chat', 'whisper')),
  model text not null,
  rota text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  audio_seconds numeric not null default 0 check (audio_seconds >= 0),
  criado_em timestamptz not null default now()
);

create index if not exists ai_usage_events_org_data_idx on ai_usage_events (organization_id, criado_em desc);
create index if not exists ai_usage_events_data_idx on ai_usage_events (criado_em desc);

alter table ai_usage_events enable row level security;

-- Cada empresa só lê os próprios eventos.
drop policy if exists ai_usage_events_select_proprio on ai_usage_events;
create policy ai_usage_events_select_proprio on ai_usage_events
  for select using (organization_id in (select minhas_organizacoes()));

-- Administrador da plataforma lê de todas as empresas — é a base pra decisão de plano/preço.
drop policy if exists ai_usage_events_select_admin on ai_usage_events;
create policy ai_usage_events_select_admin on ai_usage_events
  for select using (is_platform_admin());

-- Igual às demais tabelas de dados (ver migração 0001): o backend usa service_role, que ignora
-- RLS por padrão — é assim que a gravação de cada evento funciona. Não concedemos insert/update/
-- delete pra "authenticated"/"anon" de propósito: só o backend grava telemetria, nunca o navegador.
