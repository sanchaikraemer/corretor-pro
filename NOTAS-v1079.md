# NOTAS v1079 — botão "Marcar" atendimento não marcava (erro técnico cru na tela)

## Contexto

O dono mandou print: ao clicar em **Marcar** no lead de Marcos Pinzon, apareceu o aviso
"Não consegui marcar: signal is aborted without reason" e o atendimento não ficou registrado.

## Causa

`ui667MarcarAtendido` (o botão "Marcar" da tela do lead) fazia só **uma tentativa** de chamar
o servidor, com um limite de 15s (`fetchComTimeout` sem timeout customizado). Quando o
celular volta de outro app (WhatsApp, por exemplo), a rede fica "pendurada" reconectando por
alguns segundos — o pedido estoura o limite, é cancelado, e o erro técnico do cancelamento
("signal is aborted without reason") ia direto pra tela, cru, em vez de uma mensagem legível.

Esse é exatamente o mesmo cenário já corrigido antes pro botão "Salvar observação"
(v1034/v1036: 3 tentativas com pausa entre elas) e pro "Copiar mensagem" (v1019/v1020) — só
que o botão "Marcar" tinha ficado de fora dessas correções.

## Correção

- `ui667MarcarAtendido` agora tenta até **3 vezes**, com uma pausa de 1,5s entre tentativas
  (tempo real pra rede reconectar) e um aviso de "Rede instável, tentando marcar de novo..."
  entre uma tentativa e outra.
- O limite por tentativa subiu de 15s pra 30s (mesmo valor já usado em Desmarcar e Salvar
  observação), reduzindo a chance de estourar por lentidão normal do servidor.
- Se as 3 tentativas falharem, a mensagem final passa por `userFriendlyError` (a mesma
  tradução já usada em Salvar observação e na importação de ZIP) em vez do erro cru do
  navegador — o corretor vê algo como "Demorou demais... tente novamente" em vez de
  "signal is aborted without reason".

## Verificação

- Suíte inteira (`npm test`) verde.
- Novo teste de regressão: `tests/v1079-marcar-atendido-tenta-de-novo-e-erro-legivel.test.mjs`
  (confirma as 3 tentativas, a pausa entre elas e a tradução amigável do erro final).
- Sem mudança visual (só lógica do botão) — não se aplica a verificação em navegador.

## Arquivos

`app.js` (`ui667MarcarAtendido`), `tests/v1079-marcar-atendido-tenta-de-novo-e-erro-legivel.test.mjs`
(novo), `package.json` (lista de testes + versão **1078 → 1079**), `package-lock.json`
(sincronizado), `NOTAS-v1079.md` (este arquivo).
