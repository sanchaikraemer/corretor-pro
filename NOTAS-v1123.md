# v1123 — tirado o link "Acesso por chave de segurança" da tela de entrar

## O que o dono viu

Print da tela de entrar no celular, com a pergunta: *"veja no app (acesso por chave de segurança)
tá certo isso?"*

Não estava. O link continuava visível na tela de login, embaixo de "Criar conta grátis".

## Por que saiu

O acesso antigo por **chave compartilhada** (anterior às contas por login) foi **desligado em
produção** nesta mesma rodada: o dono cadastrou `CORRETOR_PRO_LEGADO_DESLIGADO=sim` nas variáveis
da Vercel e republicou. A partir daí o servidor **recusa** esse caminho — ou seja, quem clicasse no
link, digitasse a chave e mandasse entrar, tomaria erro. Link que não leva a lugar nenhum só
confunde, ainda mais na porta de entrada do produto.

Saíram juntos: o link no HTML, o gatilho de clique e a gravação da chave no aparelho
(`localStorage`), que também não servia mais pra nada.

**Hoje existe uma única porta de entrada: e-mail e senha.**

## O que NÃO mudou

- Login por e-mail e senha, "Esqueci minha senha" e "Criar conta grátis": intactos.
- O tratamento do caminho antigo dentro do `app.js` (para aparelhos que ainda tenham chave
  guardada) segue como estava — está coberto por `tests/v1082-sem-login-vai-pra-tela-de-entrar` e
  não é alcançável em produção com o interruptor ligado. Não foi mexido nesta versão pra manter a
  mudança pequena e segura.

## Nota sobre "no PC não aparece"

O dono comentou que o link aparecia no celular mas não no PC. O link estava no HTML dos dois — no
PC ele fica bem discreto (`opacity:.6`, fonte 12px) e passa despercebido; e o app instalado no
celular (PWA) pode ainda servir uma versão em cache até a atualização chegar. De qualquer forma,
agora saiu dos dois.

## Teste de regressão

`tests/v1123-sem-link-chave-antiga.test.mjs` — garante que nem o link, nem o gatilho, nem a
gravação da chave no aparelho, nem qualquer `prompt()` voltem à tela de entrar, e que o login por
e-mail/senha continue lá.
