# v1216 — o botão "Atendido" ainda estava verde: agora só sobra a paleta

Print do dono no cadastro do cliente, 11/08/2026: *"ainda tem um tom verde, olha ali no atendido"*.
Ele está certo de novo — e o motivo é a própria forma como a v1214 foi feita.

## O que aconteceu

A v1214 tirou o verde-lima e o rosa das telas trocando **uma lista de cores** por token, cor por cor.
O botão "Atendido" tinha o verde escrito de **outro jeito** (`rgba(112,212,157,…)` no fundo e na
borda) e não estava nessa lista — então só o **texto** virou ciano e o **fundo e a borda continuaram
verdes**. O resultado é exatamente o do print: um botão verde-água no meio de uma tela petróleo e
coral.

Pior: o teste que existia desde a v894 **exigia** aquele verde no código (`112,212,157`), ou seja, a
guarda estava protegendo justamente o defeito.

## O que mudou na tela

- **Botão "Atendido"** (topo do cliente): fundo, borda e texto agora saem do ciano de confirmação —
  o mesmo tom que a agenda, os lembretes e a faixa "Hoje na agenda" já usam. Continua destacado como
  "concluído", só que na cor da casa. Vale nos dois temas.
- **Cartão do cliente** (Hoje, Todos, Pipeline): a bolinha de "de contato" era um verde de fora da
  paleta e vira ciano; a bolinha de "sem resposta" era um vermelho diferente do resto do app e passa
  a usar o vermelho único de risco.
- **Botão de confirmar dentro do cliente**, **caixa do compromisso de amanhã** na Agenda e o **aviso
  verde de "deu certo"** (o quadradinho que aparece no canto): todos deixam de ter verde cravado e
  passam pelo mesmo ciano/coral.
- **Tema claro**: a borda verde que ainda restava no botão de atendimento confirmado saiu.

O verde do **WhatsApp** continua verde — é a marca do aplicativo de mensagem, não é cor do app.

## Como isso para de voltar

A guarda antiga dependia de uma **lista de cores proibidas**, e foi por isso que o botão escapou:
bastava escrever o mesmo verde de outro jeito. A guarda nova (`tests/v1216-sem-verde-cravado.test.mjs`)
não tem lista: ela varre o código de verdade e reprova **qualquer** cor cravada em que o canal verde
domina os outros dois — que é a definição de "está verde na tela" —, com uma única exceção declarada,
o verde da marca do WhatsApp. Também confere as **três pontas** do botão "Atendido" (fundo, borda e
texto), porque foi justamente uma ponta esquecida que gerou este relato.

## Arquivos alterados

- `app.js` — `.cp704-ico.done` (o botão do print), o botão de confirmar do bloco de ações, as
  bolinhas do cartão do cliente e a caixa do compromisso de amanhã: cor por token.
- `styles.css` — borda do atendimento confirmado no tema claro, o aviso de "deu certo" e o token
  `--status-success`, que ainda guardava um verde e podia reintroduzir a cor numa tela nova.
- `tests/v1216-sem-verde-cravado.test.mjs` — guarda nova (varredura por canal de cor, sem lista).
- `tests/v894-toolbar-icones.test.mjs` — passa a exigir os tokens no botão "Atendido" em vez do
  verde cravado que ele protegia.
- `tests/v874-identidade-tokens.test.mjs` — `--status-success` aponta pro token de confirmação.
- `package.json` / `package-lock.json` — versão 1216.

Verificação em tela (obrigatória, Chromium headless sobre `public/`): botão "Atendido" a 412px e
1440px, temas claro e escuro, conferindo o resultado computado — fundo, borda e texto, nenhum deles
puxando pro verde.
