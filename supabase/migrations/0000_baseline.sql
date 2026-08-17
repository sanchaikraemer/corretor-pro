<<<<<<< HEAD
-- 0000_baseline.sql — v1285, corrigido na v1286 com o formato REAL de produção
=======
-- 0000_baseline.sql — v1285
>>>>>>> origin/main
--
-- POR QUE ESTE ARQUIVO EXISTE
--
-- Achado A5 da auditoria de 16/08/2026: **o repositório não conseguia reconstruir o banco**.
-- Das 7 tabelas que o código usa, 5 nasciam de alguma migração — mas as DUAS principais, as que
-- guardam a conversa dos clientes e o Cérebro Comercial, nunca foram criadas por nenhuma delas.
<<<<<<< HEAD
-- Elas foram feitas à mão no começo do projeto, e as migrações seguintes só as ALTERAM (a `0001`
-- faz "alter table if exists whatsapp_processamentos add column organization_id...", que num banco
-- vazio simplesmente não faz nada, em silêncio).
=======
-- Elas foram feitas à mão, no começo do projeto, e as migrações seguintes só as ALTERAM
-- (a `0001` faz "alter table if exists whatsapp_processamentos add column organization_id...",
-- que num banco vazio simplesmente não faz nada, em silêncio).
>>>>>>> origin/main
--
-- Consequências disso, enquanto durou:
--   · banco perdido ou corrompido = não havia de onde voltar; o Git não trazia de volta;
--   · impossível montar um ambiente de teste igual ao de produção (é o passo que falta pra parar
--     de testar mudança de banco direto na produção — ver ESTADO-ATUAL.md, seção 6).
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
<<<<<<< HEAD
-- ESTE ARQUIVO É O FORMATO REAL, NÃO UMA DEDUÇÃO (corrigido na v1286).
--
-- A primeira versão (v1285) foi derivada do código, porque a sessão não tem acesso ao Supabase
-- (ver CLAUDE.md), e ela ERRAVA: faltavam três colunas (`lead_id`, `nome`, `nome_cliente` — o
-- código só encosta nelas pelo caminho adaptativo, então a leitura do código não as revelava) e
-- quase todos os valores padrão. O dono rodou a consulta de leitura do README no banco de
-- produção e colou o resultado; ele está guardado em `supabase/estrutura-producao-2026-08-17.txt`
-- e este arquivo foi reescrito a partir dele — colunas, tipos, ordem, obrigatoriedade e padrões
-- conferem um a um.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- É SEGURO RODAR EM PRODUÇÃO? SIM — E NÃO FAZ NADA LÁ.
--
-- Tudo aqui é "create table if not exists". Num banco que já tem as tabelas (produção), este
-- arquivo é um NO-OP completo: não cria, não altera, não apaga e não move dado nenhum. Ele só tem
-- efeito num banco vazio.
=======
-- É SEGURO RODAR EM PRODUÇÃO? SIM — E NÃO FAZ NADA LÁ.
--
-- Tudo aqui é "create table if not exists" / "add column if not exists". Num banco que já tem as
-- tabelas (produção), este arquivo é um NO-OP completo: não cria, não altera, não apaga e não
-- move dado nenhum. Ele só tem efeito num banco vazio.
>>>>>>> origin/main
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- ORDEM: ESTE ARQUIVO RODA ANTES DA 0001.
--
<<<<<<< HEAD
-- Ele recria o formato que as tabelas tinham ANTES da primeira migração. Por isso **não** cria
-- `organization_id` (colunas 24 de whatsapp_processamentos e 4 de direciona_config na exportação
-- de produção) nem as colunas `dedupe_*` (25 a 27): quem as acrescenta são a `0001` e a `0010`.
-- Isso é de propósito — assim a corrente 0001 → 0019 continua contando exatamente a mesma história
-- que sempre contou. Se o baseline já entregasse tudo pronto, as migrações seguintes virariam
-- no-ops e o histórico perderia o sentido.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- Necessário pro gen_random_uuid(). No Postgres 13+ do Supabase já vem embutido, mas a extensão é
-- idempotente e não custa nada.
=======
-- Ele recria o formato que as tabelas tinham ANTES da primeira migração — sem organization_id,
-- sem as colunas de deduplicação. Isso é de propósito: assim a corrente 0001 → 0018 continua
-- contando exatamente a mesma história que sempre contou (a 0001 acrescenta o dono, a 0005 troca
-- a chave primária da config, a 0010 acrescenta a deduplicação, e por aí). Se o baseline já
-- entregasse tudo pronto, as migrações seguintes virariam no-ops e o histórico perderia o sentido.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- ATENÇÃO — ESTE ARQUIVO FOI DERIVADO DO CÓDIGO, NÃO EXPORTADO DO BANCO DE PRODUÇÃO.
--
-- A sessão que o escreveu não tem acesso ao Supabase do dono (ver CLAUDE.md). Cada coluna abaixo
-- foi levantada lendo o que o código realmente grava e lê (`api/_persistence.js`,
-- `api/lead-update.js`, `api/leads-recentes.js`, `api/reanalisar-lead.js`). Os NOMES das colunas
-- são certos — eles vêm do código. Os TIPOS são a melhor inferência possível, e podem diferir em
-- detalhe do que existe hoje em produção (ex.: um inteiro que lá é bigint).
--
-- Isso não afeta produção (o arquivo não a toca). Afeta um banco NOVO criado a partir daqui, que
-- pode sair sutilmente diferente do original. Pra fechar essa diferença de vez, rode no SQL Editor
-- do Supabase de produção a consulta que está em `supabase/migrations/README.md`, seção
-- "Como trocar este baseline pelo formato real", e substitua o conteúdo deste arquivo pelo
-- resultado. Enquanto isso não for feito, este baseline já cumpre o essencial: **o banco volta a
-- poder nascer do repositório.**
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- Necessário pro gen_random_uuid() em instalações mais antigas. No Postgres 13+ do Supabase já
-- vem embutido, mas a extensão é idempotente e não custa nada.
>>>>>>> origin/main
create extension if not exists pgcrypto;

-- ── 1. whatsapp_processamentos — a tabela dos LEADS ──────────────────────────────────────────
-- Apesar do nome (herdado do começo do projeto, quando era só o processamento do ZIP), esta é a
-- tabela principal do sistema: cada linha é UM CLIENTE, com a conversa inteira e a análise.
<<<<<<< HEAD
-- A ordem das colunas abaixo é a mesma de produção.
create table if not exists whatsapp_processamentos (
  id uuid not null primary key default gen_random_uuid(),

  -- Ligação com o registro do lead. Consta em MOTIVO_COLUNA_CRITICA ("liga o registro ao lead
  -- certo") e é herança do tempo das tabelas legadas `leads`/`direciona_leads`.
  lead_id uuid,

  -- Identificação do arquivo importado. As duas existem por herança de versões diferentes do
  -- projeto e são mantidas em sincronia pela gravação (ver COLUNAS_ADAPTAVEIS em _persistence.js).
  nome_arquivo text,
  arquivo_nome text,

  -- Nome do cliente. Também em duas colunas por herança; hoje o nome que a tela usa vive dentro de
  -- `resultado_analise`, e estas duas seguem existindo pro caminho adaptativo não quebrar.
  nome text,
  nome_cliente text,
=======
create table if not exists whatsapp_processamentos (
  id uuid primary key default gen_random_uuid(),

  -- Identificação do arquivo importado. As duas colunas existem por herança de versões
  -- diferentes do projeto e são mantidas em sincronia pela gravação (ver COLUNAS_ADAPTAVEIS).
  nome_arquivo text,
  arquivo_nome text,

  -- Estado do lead. `etapa` é decisão do CORRETOR e só tem dois valores desde a v1069
  -- ("Ativo" e "Geladeira" — ver ETAPAS_VALIDAS em api/lead-update.js). `status` é o estado do
  -- processamento do arquivo ("pronto", "erro", ...), coisa diferente.
  etapa text,
  status text,
  progresso integer,
  erro text,
>>>>>>> origin/main

  -- Telefone do contato exportado (só o do próprio contato — ver telefoneDoContatoExportado).
  telefone text,

<<<<<<< HEAD
  -- `status` é o estado do PROCESSAMENTO do arquivo. `etapa` é o estado do LEAD, decisão do
  -- corretor, e só tem dois valores desde a v1069 ("Ativo" e "Geladeira", ver ETAPAS_VALIDAS em
  -- api/lead-update.js). O padrão 'Novo' aqui é histórico, anterior a essa regra — a gravação
  -- sempre informa a etapa explicitamente, então o padrão não é usado na prática.
  status text default 'pronto'::text,
  etapa text default 'Novo'::text,
  progresso integer default 100,
  erro text,

  -- O CONTEÚDO. `timeline_json` é a conversa mensagem a mensagem e `resultado_analise` é a análise
  -- inteira devolvida pela IA. São as duas colunas que o código trata como críticas: descartar
  -- qualquer uma apaga o trabalho do corretor (ver MOTIVO_COLUNA_CRITICA).
  texto_extraido text,
  timeline_json jsonb default '[]'::jsonb,
  audios_encontrados integer default 0,
  audios_transcritos integer default 0,
  resultado_analise jsonb,

  -- Onde o ZIP ficou no Storage enquanto a importação acontecia.
=======
  -- O CONTEÚDO. `timeline_json` é a conversa mensagem a mensagem e `resultado_analise` é a
  -- análise inteira devolvida pela IA. São as duas colunas que o código trata como críticas:
  -- descartar qualquer uma apaga o trabalho do corretor (ver MOTIVO_COLUNA_CRITICA).
  timeline_json jsonb,
  resultado_analise jsonb,
  texto_extraido text,

  -- Metadados da importação.
  audios_encontrados integer,
  audios_transcritos integer,
>>>>>>> origin/main
  storage_bucket text,
  storage_path text,
  file_size bigint,

  -- Datas. Os quatro nomes convivem por herança e a gravação mantém os pares em sincronia.
<<<<<<< HEAD
  criado_em timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  atualizado_em timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
=======
  criado_em timestamptz default now(),
  created_at timestamptz,
  atualizado_em timestamptz default now(),
  updated_at timestamptz
>>>>>>> origin/main
);

-- ── 2. direciona_config — Cérebro, planos, contadores e chaves da conta ──────────────────────
-- Tabela de chave→valor por conta. Guarda coisas bem diferentes entre si, sempre em JSON:
<<<<<<< HEAD
--   · "direciona-cerebro"                   → o Cérebro Comercial do corretor;
--   · "plano-contratado"                    → { tipo: "pro" | "pro-master" };
--   · "limite-diario:*" / "limite-mensal:*" → os contadores de uso de IA;
--   · "notas-rapidas"                       → o bloco de notas administrativas;
--   · "atalho-zip-token-valido-desde"       → a chave do Atalho do iPhone.
--
-- Chave primária: aqui é só `chave`, como era no começo do projeto — em produção a coluna é
-- `not null`, coerente com ter sido a chave primária original. A migração `0005` é que troca isso
-- por (organization_id, chave), quando cada corretor passa a ter a sua própria configuração.
create table if not exists direciona_config (
  chave text not null primary key,
  valor jsonb,
  atualizado_em timestamp with time zone default now()
=======
--   · "direciona-cerebro"                → o Cérebro Comercial do corretor;
--   · "plano-contratado"                 → { tipo: "pro" | "pro-master" };
--   · "limite-diario:*" / "limite-mensal:*" → os contadores de uso de IA;
--   · "notas-rapidas"                    → o bloco de notas administrativas;
--   · "atalho-zip-token-valido-desde"    → a chave do Atalho do iPhone.
--
-- Chave primária: aqui ela é só `chave`, como era no começo do projeto. A migração `0005` é que
-- troca isso por (organization_id, chave), quando cada corretor passa a ter a sua configuração.
create table if not exists direciona_config (
  chave text primary key,
  valor jsonb,
  atualizado_em timestamptz default now()
>>>>>>> origin/main
);

-- ── O que este baseline NÃO cria, de propósito ───────────────────────────────────────────────
--
-- · `leads` e `direciona_leads` — tabelas LEGADAS, anteriores à separação por empresa. Só existem
--   no banco original do dono e são lidas apenas por `api/restaurar-leads.js`, que é exclusiva da
--   empresa principal. Uma instalação nova não precisa delas e não deve criá-las.
-- · `organizations`, `memberships` (migração 0001), `platform_admins` (0003), `ai_usage_events`
--   (0008), `cadastros_por_conexao` (0013) e `cp_migracoes_aplicadas` (0017) — essas já nascem
--   das próprias migrações, que é como deveria ter sido desde sempre.
-- · Índices, RLS, chaves estrangeiras e permissões das duas tabelas acima — tudo isso é trabalho
--   da 0001 em diante, e continua sendo.
