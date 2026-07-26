-- Migração 0004 — o Cérebro (e todo o aprendizado da IA) passa a poder existir
-- um por corretor, em vez de um único compartilhado pra instalação inteira.
--
-- Contexto: a tabela direciona_config guarda tudo por uma "chave" de texto
-- (ex.: 'direciona-cerebro', 'corretor-conhecimento', filas de aprendizado etc.)
-- e hoje essa chave é única pra instalação INTEIRA — ou seja, só pode existir
-- UM Cérebro no sistema todo. Pra cada corretor ter o seu, a unicidade precisa
-- passar a ser "por corretor + chave".
--
-- O que esta migração faz (segura de rodar a qualquer momento, nada quebra):
--   1) Marca como da "Empresa 1" (a conta original) toda linha de configuração
--      que ainda está sem dono — são linhas criadas depois da migração 0002
--      (filas de aprendizado, casos aprendidos etc.), todas da conta original.
--   2) Cria a nova regra de unicidade "por corretor + chave".
--   3) NÃO remove a regra antiga (chave única global) — o sistema no ar ainda
--      depende dela até a atualização v1002 ser publicada; e depois disso ela
--      só precisa sair quando o sistema for aberto pra corretores novos
--      (isso será uma migração futura, avisada na hora certa).
--
-- Como aplicar (igual às anteriores):
--   1. Painel do Supabase → SQL Editor → New query.
--   2. Cole este arquivo inteiro e clique em Run.
--   3. Deve terminar com "Success".

-- 1) Toda configuração sem dono pertence à conta original.
update direciona_config
set organization_id = '00000000-0000-0000-0000-000000000001'
where organization_id is null;

-- 2) Unicidade nova: cada corretor pode ter a própria linha pra mesma chave.
--    (Índice único funciona como alvo de "upsert" no Supabase.)
create unique index if not exists direciona_config_org_chave_uidx
  on direciona_config (organization_id, chave);
