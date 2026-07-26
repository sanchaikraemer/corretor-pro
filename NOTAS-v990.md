# v990 — cadastro público, login e painel administrativo no ar

## Contexto

Depois de testar a fundo (banco de dados real + simulação local) o sistema de contas
individuais por empresa com teste grátis de 7 dias e painel administrativo, o dono pediu pra
publicar direto no sistema real, sem passar por uma prévia separada.

## O que mudou

Três páginas novas, publicadas ao lado do app existente, sem tocar nele:

- `/cadastro.html` — cadastro público. O corretor cria a própria empresa com e-mail/senha; o
  teste grátis de 7 dias começa na hora, sozinho (chama a função `criar_empresa_e_dono` no
  banco, que cria a empresa e já vincula o usuário como dono numa operação só).
- `/entrar.html` — login. Depois de autenticar, busca a empresa pelo vínculo do próprio
  usuário (não pela visão geral, que mostraria qualquer empresa pra quem também é
  administrador da plataforma) e avisa quantos dias de teste restam ou se o teste venceu.
- `/admin-plataforma.html` — painel só do dono da plataforma (verifica a tabela
  `platform_admins`): lista todas as empresas com dias de teste restantes e quantidade de
  usuários, com botões pra marcar pago, bloquear ou dar mais 7 dias de teste.

Todas falam DIRETO com o Supabase (Auth + RLS já configurados nas migrações anteriores),
usando a `anon key` pública — sem passar pelas rotas de `/api`.

**O que continua exatamente igual:** a entrada principal do app (`index.html`) continua
pedindo a chave compartilhada de sempre. Essa troca — login de verdade virando a porta de
entrada real do app — é o próximo passo, feito com mais cuidado depois.

## Infraestrutura

- `build.js` agora também empacota o `@supabase/supabase-js` localmente em
  `vendor/supabase.js` (mesmo padrão já usado pro JSZip — sem CDN, sem execução remota).
- Novos arquivos publicados: `cadastro.html`, `entrar.html`, `admin-plataforma.html`,
  `contas-estilo.css` (paleta oficial do app, reaproveitada), `contas-config.js` (URL do
  projeto + anon key — pública de propósito, nunca a chave secreta).

## Testes

Novo `tests/v990-cadastro-login-admin-publicados.test.mjs`: confirma que os 3 arquivos
existem, que o `build.js` os publica, que nenhum carrega script de CDN (só o vendorizado
localmente), e que a chave publicada em `contas-config.js` é mesmo a `anon` — decodifica o
JWT de verdade pra conferir o campo `role`, não só procura a palavra no texto (evita alarme
falso com o comentário de aviso do próprio arquivo).

`npm test`: suíte inteira verde. `node build.js`: build limpo, 22 arquivos publicados,
conferido sem erro 404 em nenhum asset servindo localmente.

## Verificação adicional

A lógica de segurança por trás dessas telas (isolamento por empresa, teste de 7 dias, RPC de
cadastro, painel administrativo) já tinha sido testada de ponta a ponta contra Postgres local
simulando o Supabase, e as migrações já foram aplicadas e confirmadas no banco real (ver
`supabase/migrations/README.md` e `PROXIMOS-PASSOS-CONTAS.md`). As 3 páginas em si foram
revisadas linha a linha e testadas quanto a carregar sem erro 404/500 nos próprios arquivos;
o clique completo contra o Supabase de produção (criar conta de verdade, logar, usar o
painel) ainda precisa ser confirmado pelo dono, já que esta sessão não alcança a rede externa
do projeto Supabase.

## Arquivos

`cadastro.html`, `entrar.html`, `admin-plataforma.html`, `contas-estilo.css`,
`contas-config.js` (novos, raiz do projeto), `build.js` (publica os novos arquivos + vendoriza
supabase-js), `tests/v990-cadastro-login-admin-publicados.test.mjs` (novo),
`package.json`/`package-lock.json`, `NOTAS-v990.md`, versão **989 → 990**.
