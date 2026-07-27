# NOTAS v1036 — "Salvar observação": 2 tentativas ainda não bastavam, agora são 3

## O relato

O dono testou a correção da v1034 (que já tentava salvar a observação de novo automaticamente
uma vez) e confirmou: "só na terceira tentativa salvou". Ou seja, quando a rede do celular demora
mais pra reconectar depois de voltar do WhatsApp, duas tentativas seguidas (cada uma esperando
até 30s) ainda caíam dentro da janela de instabilidade — só uma tentativa mais tarde (manual, dele
tocando de novo no botão) deu certo, depois que a rede já tinha voltado de verdade.

## A mudança

`app.js` (`cp7ObsSalvar`):
- Sobe de 2 pra **3 tentativas automáticas** antes de desistir — o mesmo número que
  comprovadamente funcionou no relato do dono.
- Agora espera **1,5 segundo entre as tentativas** (antes tentava de novo instantaneamente, o que
  não ajuda em nada se a rede ainda estiver mesmo caída — um respiro curto dá uma chance real
  dela reconectar entre uma tentativa e outra).
- A tela agora mostra "Rede instável, tentando de novo (tentativa 2 de 3)…" durante as
  repetições, em vez de ficar só em "Salvando…" parado sem indicar que está insistindo.
- Continua: só mostra erro (com a mensagem traduzida, ver v1034) depois que as 3 tentativas
  falharem de verdade.

## Verificação

- Teste ajustado `tests/v1034-observacao-tenta-de-novo-e-erro-legivel.test.mjs`: a checagem do
  número exato de tentativas foi movida pro teste novo (abaixo); este continua confirmando que
  existe repetição em caso de falha e que o erro final usa a tradução amigável.
- Novo teste `tests/v1036-observacao-mais-tentativas.test.mjs`: confirma as 3 tentativas, a
  pausa de 1,5s entre elas, o aviso visível de "tentando de novo" e que só desiste depois de
  esgotar as 3.
- `npm test`: suíte inteira verde.

## Arquivos

`app.js` (`cp7ObsSalvar`), `tests/v1034-observacao-tenta-de-novo-e-erro-legivel.test.mjs`
(ajustado), `tests/v1036-observacao-mais-tentativas.test.mjs` (novo), `package.json`/
`package-lock.json`, `NOTAS-v1036.md`, versão **1035 → 1036**.
