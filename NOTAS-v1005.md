# v1005 — botão "Excluir" no painel administrativo (chega de SQL na mão)

## Contexto

Depois da abertura do sistema pra corretores novos (v1004), o dono quis limpar as contas de
teste antigas e recomeçar organizado — e perguntou, com razão, por que isso exigia colar código
SQL se existe um painel administrativo. Resposta: porque o painel não tinha a função de excluir.
Agora tem.

## O que mudou

- `admin-plataforma.html`: cada conta (menos a original) ganhou o botão **Excluir**, com
  confirmação clara do que vai ser apagado. A exclusão acontece no servidor, autenticada pelo
  login do administrador (token da sessão), nunca pelo navegador direto.
- `api/admin-contas.js` (rota nova): valida o login de quem chama, exige que seja administrador
  da plataforma (`platform_admins`), recusa excluir a conta original, e então apaga na ordem:
  clientes/conversas (`whatsapp_processamentos`), configuração/Cérebro/aprendizado
  (`direciona_config`), vínculos (`memberships`), a conta (`organizations`) e por fim o LOGIN de
  cada pessoa da conta — preservando logins que sirvam outra conta ou sejam administradores.
- `vercel.json`: rota nova com o mesmo tempo-limite das demais (11ª função — dentro do limite
  de 12 do plano).

Arquivos no armazenamento (ZIPs importados pela conta excluída) não são varridos nesta versão —
os temporários expiram sozinhos em 7 dias e o volume de conta de teste é irrisório; registrado
aqui pra não parecer esquecimento.

## Testes

Novo `tests/v1005-excluir-conta-pelo-painel.test.mjs`: não-administrador recusado (403); conta
original protegida (400); exclusão válida com todo DELETE filtrado pela conta certa e o login
apagado no Auth.

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`api/admin-contas.js` (novo), `admin-plataforma.html`, `vercel.json`,
`tests/v1005-excluir-conta-pelo-painel.test.mjs` (novo), `package.json`/`package-lock.json`,
`NOTAS-v1005.md`, versão **1004 → 1005**.
