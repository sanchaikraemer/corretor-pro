# v973 — barra de mensagens em gradiente

## O pedido do dono

Depois de ver a v972 no ar, pediu 2 coisas: (1) rever a apresentação da frase de motivo — achou
"grande, em negrito, desarmoniza a tela" (endereçado à parte via prévia com 4 opções pro dono
escolher, sem mexer no app de verdade ainda) e (2) a barra de mensagens (a barrinha colorida ao
lado do nome/produto) em **gradiente**, em vez da cor chapada de sempre — esse pedido já veio
como decisão pronta, não como opção pra escolher.

## O que mudou

`cpBarraMensagensMini`: o preenchimento da barra (`<i style="width:...">`) pinta agora com
`linear-gradient(90deg, cor 40%, corClara)` em vez de `background:cor` liso. Os 3 níveis/limiares
que definem `cor` (`n>=15` coral cheio / `n>=5` coral médio / abaixo disso cinza) **não mudaram**
— são decisão travada pelos testes v942/v943 (cor por volume de mensagens). Só ganharam uma
segunda cor (`corClara`, um tom mais claro do MESMO nível) pra formar o gradiente:

| nível | cor (início) | corClara (fim) |
|---|---|---|
| alto (≥15 msgs) | `#ff6258` (coral cheio) | `#ffb3ac` |
| médio (5-14 msgs) | `#ff8f88` (coral médio) | `#ffd0cc` |
| baixo (<5 msgs) | `#8a99a0` (cinza) | `#c7ced2` |

O número ao lado da barra (`<b style="color:cor">`) continua sólido, sem gradiente — só a barra
em si.

## O que ficou pendente (prévia, aguardando escolha do dono)

A frase de motivo (texto vermelho embaixo do nome) **não foi alterada no app ainda** — o dono
pediu pra ver 4 opções antes de decidir. Foi publicada uma prévia (artifact HTML, fora do
repositório) com 4 tratamentos visuais diferentes pra essa frase, todos já usando a barra em
gradiente desta versão. Assim que o dono escolher uma opção (ou pedir uma combinação), ela entra
numa próxima versão.

## Verificação

- `tests/v973-barra-gradiente.test.mjs` (novo): confirma que os limiares/cores de nível
  continuam intocados (trava v942/v943), que a barra usa `linear-gradient` de fato, e testa as
  3 combinações de cor (alta/média/baixa) + a largura proporcional (trava v943) no HTML gerado.
- Suíte inteira verde (`npm test`).

## Arquivos

- `app.js` (`cpBarraMensagensMini` — gradiente na barra), `tests/v973-barra-gradiente.test.mjs`
  (novo), `package.json`/`package-lock.json`, `NOTAS-v973.md`, versão **972 → 973**.
