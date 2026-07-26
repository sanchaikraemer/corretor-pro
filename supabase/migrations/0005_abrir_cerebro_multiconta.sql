-- Migração 0005 — remove a última trava que impedia cada corretor de ter o
-- PRÓPRIO Cérebro: a regra antiga de "chave única no sistema inteiro".
--
-- Contexto: a migração 0004 criou a regra nova ("por corretor + chave") e o
-- sistema já grava tudo com dono. Mas a regra ANTIGA (a chave ser única na
-- instalação toda) continuava no banco — na prática, um corretor novo tentava
-- salvar o Cérebro dele e o banco recusava, porque já existe um 'direciona-cerebro'
-- (o da conta original). Esta migração troca a regra antiga pela nova, em definitivo.
--
-- Rode DEPOIS que a atualização v1004 estiver no ar (se estiver lendo isso
-- porque eu pedi, já está). Segura pros dados: não apaga nem altera nenhuma linha.
--
-- Como aplicar (igual às anteriores):
--   1. Painel do Supabase → SQL Editor → New query.
--   2. Cole este arquivo inteiro e clique em Run. Deve terminar com "Success".

-- Garantia (idempotente): nenhuma linha sem dono.
update direciona_config
set organization_id = '00000000-0000-0000-0000-000000000001'
where organization_id is null;

-- O dono passa a ser obrigatório em toda linha de configuração.
alter table direciona_config
  alter column organization_id set not null;

-- Troca a identidade da tabela: sai "chave única no sistema todo",
-- entra "única por corretor + chave".
alter table direciona_config
  drop constraint if exists direciona_config_pkey;

alter table direciona_config
  add primary key (organization_id, chave);

-- O índice criado na 0004 vira redundante com a nova chave primária.
drop index if exists direciona_config_org_chave_uidx;
