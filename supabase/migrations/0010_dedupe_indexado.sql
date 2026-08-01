-- 0010 — Deduplicação indexada de leads (v1092)
--
-- POR QUE ESTA MIGRAÇÃO EXISTE
--
-- Toda importação precisa descobrir se aquele cliente já existe na carteira, pra atualizar o
-- mesmo cadastro em vez de criar duplicado. Isso era feito baixando ATÉ 5.000 LEADS INTEIROS
-- (incluindo o campo resultado_analise, que guarda a análise completa) e comparando em memória —
-- e essa busca roda mais de uma vez por importação. Numa carteira grande são dezenas de MB
-- baixados e convertidos a cada importação; foi a causa da lentidão relatada na v1086.
--
-- A comparação em si é simples e EXATA (não é busca aproximada):
--   1. últimos 8 dígitos do telefone;
--   2. nome do arquivo normalizado (minúsculas, sem acento, espaços colapsados);
--   3. nome do cliente normalizado, pela mesma regra.
--
-- Esta migração materializa essas três chaves em colunas próprias, com índice por empresa. Com
-- elas, a busca vira três consultas pontuais e instantâneas em vez de uma varredura da carteira.
--
-- SEGURANÇA E REVERSIBILIDADE
--
-- • É ADITIVA: só cria colunas e índices, não altera nem apaga nada do que já existe.
-- • É OPCIONAL: enquanto não for aplicada, o sistema continua funcionando pelo caminho antigo
--   (a varredura). O app detecta a ausência das colunas sozinho e não quebra. O que se perde é
--   só a velocidade.
-- • Pode ser aplicada com o app no ar, sem parada.
--
-- COMO APLICAR
--   Supabase → SQL Editor → cole este arquivo inteiro → Run.
--
-- COMO DESFAZER (se algum dia precisar)
--   alter table public.whatsapp_processamentos
--     drop column if exists dedupe_fone8,
--     drop column if exists dedupe_arquivo,
--     drop column if exists dedupe_nome;

-- 1) As três chaves de deduplicação.
alter table public.whatsapp_processamentos
  add column if not exists dedupe_fone8   text,
  add column if not exists dedupe_arquivo text,
  add column if not exists dedupe_nome    text;

-- 2) Índices SEMPRE por empresa: a busca nunca cruza a fronteira de uma conta, e o índice
--    composto garante que o banco não precise olhar linha de outro corretor.
create index if not exists whatsapp_proc_dedupe_fone8_idx
  on public.whatsapp_processamentos (organization_id, dedupe_fone8)
  where dedupe_fone8 is not null;

create index if not exists whatsapp_proc_dedupe_arquivo_idx
  on public.whatsapp_processamentos (organization_id, dedupe_arquivo)
  where dedupe_arquivo is not null;

create index if not exists whatsapp_proc_dedupe_nome_idx
  on public.whatsapp_processamentos (organization_id, dedupe_nome)
  where dedupe_nome is not null;

-- 3) Preenchimento inicial do que já está gravado.
--
--    A normalização abaixo reproduz _nomeIdentity/_digitsIdentity de api/_persistence.js:
--    tira a tag interna de importação (" [CSV a1b2c3]"), passa pra minúsculas, troca acento pela
--    letra sem acento, transforma tudo que não é letra/número em espaço e colapsa os espaços.
--    Usa translate() em vez da extensão unaccent, que pode não estar instalada.
--
--    IMPORTANTE: mesmo que este preenchimento discorde em algum caso da normalização do
--    JavaScript, NADA quebra. O app usa estas colunas apenas como CAMINHO RÁPIDO: quando a busca
--    indexada não encontra ninguém, ele cai na varredura antiga, que é a fonte da verdade. Ou
--    seja, o pior caso de uma divergência é continuar lento naquele lead — nunca criar duplicata.
--
--    Registros novos e atualizados já são gravados com estas colunas prontas pelo próprio app.
update public.whatsapp_processamentos
set
  dedupe_fone8 = nullif(
    right(regexp_replace(coalesce(resultado_analise -> 'lead' ->> 'phone', telefone, ''), '\D', '', 'g'), 8),
    ''),
  dedupe_arquivo = nullif(trim(regexp_replace(regexp_replace(
      translate(
        lower(regexp_replace(coalesce(nome_arquivo, arquivo_nome, ''), '\s*\[(SISTEMA|CSV)\s+[A-Za-z0-9]{1,8}\]\s*$', '', 'g')),
        'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
      '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')), ''),
  dedupe_nome = nullif(trim(regexp_replace(regexp_replace(
      translate(
        lower(regexp_replace(
          coalesce(resultado_analise ->> 'clientName', resultado_analise -> 'lead' ->> 'clientName', nome_arquivo, arquivo_nome, ''),
          '\s*\[(SISTEMA|CSV)\s+[A-Za-z0-9]{1,8}\]\s*$', '', 'g')),
        'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
      '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')), '')
where dedupe_fone8 is null and dedupe_arquivo is null and dedupe_nome is null;
