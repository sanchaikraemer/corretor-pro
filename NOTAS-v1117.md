# v1117 — cadastro pede WhatsApp, cidade e estado; painel mostra o contato de cada corretor

## Por quê

A auditoria apontou o buraco mais caro do lado comercial: **o dono não tinha como falar com quem
se cadastrava.** O cadastro só pedia nome, e-mail e senha, e o painel administrativo não mostrava
nenhuma forma de contato. Resultado: quem testava e sumia, sumia calado — não dava pra mandar um
WhatsApp de recuperação. Todo o funil dependia de o corretor tomar a iniciativa sozinho.

## O que mudou na tela

- **Cadastro (`cadastro.html`)** agora pede, além de nome/e-mail/senha: **WhatsApp (com DDD),
  cidade e estado (UF)**. Todos obrigatórios. O WhatsApp é validado (precisa de pelo menos DDD +
  número).
- **Painel administrativo (`admin-plataforma.html`)** ganhou duas colunas: **Contato** (com um
  link de WhatsApp que abre a conversa direto, mais o e-mail clicável) e **Cidade/UF**. Agora dá
  pra bater o olho na lista e chamar no WhatsApp quem está em teste, sem sair do painel.

## Como foi feito com segurança de publicação

- Os dados novos são gravados no banco pela mesma porta de sempre (`criar_empresa_e_dono`), que
  passou a aceitar telefone/cidade/estado/e-mail.
- **As telas funcionam ANTES e DEPOIS da migração do banco.** Enquanto a migração `0011` não for
  aplicada, o cadastro continua funcionando normalmente — só não grava os campos novos ainda (eles
  ficam guardados nos metadados do login e são recuperados no primeiro acesso). Isso evita o risco
  de o cadastro quebrar caso o código suba antes da migração.
- Contas antigas (anteriores a esta versão) não têm os campos preenchidos: o painel mostra "—"
  nesses casos, sem quebrar.

## Passo manual do dono (banco)

Aplicar a migração **`supabase/migrations/0011_cadastro_contato_corretor.sql`** no SQL Editor do
Supabase (é aditiva: só acrescenta colunas, não remove nada). Enquanto não aplicar, os campos novos
não são gravados — o cadastro continua no ar do mesmo jeito.

## Teste de regressão

`tests/v1117-cadastro-contato-corretor.test.mjs` — confere que os campos existem e são obrigatórios
no cadastro, que chegam à função do banco (com fallback pra versão antiga), que o primeiro login
também grava, que o painel mostra contato/cidade com link de WhatsApp, e que a migração tem as
colunas, a função e a visão atualizadas.
