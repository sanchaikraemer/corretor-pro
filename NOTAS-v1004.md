# v1004 — a ligação final: corretor logado entra no sistema completo

## Contexto

Com a separação de dados pronta (v997–v1003: Carteira, ações de lead, reanálise, Cérebro,
aprendizado, trava de bloqueio/teste no servidor), chegou a hora da etapa que estava adiada
desde a v994: quem loga por `entrar.html` cai de verdade no sistema completo — e o sistema
mostra só os dados daquele corretor.

## O que mudou

- `entrar.html`: acabou a tela de espera. TODO corretor com a conta em dia (teste no prazo ou
  assinatura ativa) é redirecionado pro sistema depois do login. Conta bloqueada/teste vencido
  continua barrada com a mensagem de pagamento (e desde a v1003 o servidor também barra).
- `index.html`: passa a carregar o supabase-js vendorizado + `contas-config.js` (com `?v=`)
  antes do `app.js`.
- `app.js` (interceptador de chamadas à API): se existir sessão de login neste navegador (salva
  pelo `entrar.html`), toda chamada à API vai com `Authorization: Bearer` daquele corretor — o
  servidor resolve a conta pelo token (v997) e escopa tudo. A sessão se renova sozinha (cliente
  supabase no navegador, sempre com a anon key — nunca a service_role). Sem sessão, o caminho
  antigo da chave compartilhada continua idêntico (aparelhos de hoje não mudam nada).
  Sessão vencida (401 com Bearer) volta pra `entrar.html` em vez de abrir o pedido de chave
  compartilhada; conta bloqueada (403 `bloqueado:true`, v1003) também volta pra `entrar.html`.
- `api/criar-upload-url.js` e `api/diagnostico.js`: trocam `requireApiKey` por
  `resolveOrganizationId` — eram as duas últimas rotas que um corretor logado usaria e que ainda
  só aceitavam a chave compartilhada (a importação de conversa quebraria pra ele no meio).
- `supabase/migrations/0005_abrir_cerebro_multiconta.sql` (o dono roda no Supabase, DEPOIS
  desta publicação): remove a regra antiga de "chave única no sistema inteiro" da tabela de
  configuração e instala a definitiva "por corretor + chave". Sem ela, um corretor novo não
  consegue salvar o próprio Cérebro (o banco recusa por já existir o da conta original).

## O que o corretor novo vê

Cadastro → 7 dias grátis → login → Home do Corretor Pro, vazia (a carteira dele), com o
Cérebro pra configurar antes das análises funcionarem (comportamento correto: sem Cérebro,
a IA se recusa a gerar sugestão genérica). Nada da conta original aparece pra ele.

## Testes

Novo `tests/v1004-app-usa-sessao-do-corretor.test.mjs` (scripts no index, Bearer no
interceptador, caminho antigo preservado, redirecionamentos, anon key, migração 0005).
`tests/v994-login-empresa-principal-vai-pro-sistema.test.mjs` reescrito pro comportamento novo
(o antigo guardava exatamente a fase que esta versão encerra).

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`entrar.html`, `index.html`, `app.js`, `api/criar-upload-url.js`, `api/diagnostico.js`,
`supabase/migrations/0005_abrir_cerebro_multiconta.sql` (novo),
`tests/v1004-app-usa-sessao-do-corretor.test.mjs` (novo), `tests/v994-...` (reescrito),
`package.json`/`package-lock.json`, `NOTAS-v1004.md`, versão **1003 → 1004**.
