# NOTAS v1051 — a mensagem também conta pro descanso, mas só pra reforçar

## O relato

Print real: "Karine Izaton Renaissance" apareceu na fila de prioridade com "há 5d", mesmo o dono
tendo configurado 7 dias de descanso no Cérebro (v1048) e tendo marcado a Karine como atendida no
app. A explicação que dei antes ("o app só reconhece atendimento clicado no app") não bastou — o
dono confirmou que ELE marcou atendimento no app sim, e que depois trocou mensagens com ela pelo
WhatsApp direto (sem usar o botão "Copiar" do app) nos dias 23 e 25/07. A cobrança foi direta: "7
dias no cérebro é 7 e ponto final, não pode aparecer com menos que isso na prioridade."

## A causa

O app tinha DUAS contagens de tempo diferentes que pareciam a mesma coisa:

- **"há 5d" na tela** = tempo desde a **última mensagem trocada** (de qualquer lado, inclusive
  mensagem digitada direto no WhatsApp).
- **A regra de descanso (emJanelaDeEspera)** = contava SÓ a partir do último clique reconhecido
  pelo app (Marcar atendimento, copiar sugestão, etc.) — decisão tomada de propósito na v1018,
  bem documentada, porque na época uma mensagem do CLIENTE conseguia enfraquecer uma proteção que
  já devia valer.

No caso da Karine, o clique de "Marcar atendimento" foi ANTIGO (mais de 7 dias) e a troca de
mensagem mais recente (5 dias) não era reconhecida pela regra de descanso — resultado: a regra
contava a partir do clique velho, ignorando por completo a conversa mais recente, e ela reapareceu
antes da hora.

## A correção

`emJanelaDeEspera` agora considera **também** a interação mais recente (mensagem, de qualquer
lado) — mas só usa esse número quando ele for **menor** (mais recente) que os dias desde o
atendimento. Nunca o contrário. Na prática: o prazo configurado sempre conta a partir do **toque
mais recente entre os dois** (atendimento ou mensagem), nunca do mais antigo.

Isso garante, matematicamente, que considerar a mensagem só pode **aumentar** a proteção, nunca
diminuir — resolvendo o caso da Karine sem reabrir o problema que a v1018 corrigiu (mensagem
enfraquecendo uma proteção que já devia valer). Escrevi um teste que confere essa garantia em mais
de 100 combinações diferentes de dias configurados/atendimento/mensagem, pra deixar isso travado
de vez.

## Testes

- `tests/v1051-mensagem-reforca-descanso-nunca-afrouxa.test.mjs` (novo): reproduz o caso exato da
  Karine (atendimento de 10 dias, mensagem de 5 dias, descanso configurado em 7 → continua
  protegida) e confere, em mais de 100 combinações, que considerar a mensagem nunca libera um lead
  mais cedo do que o atendimento sozinho já liberaria.
- `tests/v981-janela-espera-considera-atendimento.test.mjs`,
  `tests/v1018-atendimento-e-nao-mensagem-define-espera.test.mjs`: atualizados pra nova regra
  (mensagem reforça, nunca afrouxa) — os cenários que dependiam de "mensagem nunca conta pra nada"
  foram ajustados; o restante continua igual.
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo, 27 arquivos publicados.

## Arquivos

`app.js` (`emJanelaDeEspera` passa a considerar a interação mais recente, não só o atendimento),
`tests/v1051-mensagem-reforca-descanso-nunca-afrouxa.test.mjs` (novo),
`tests/v981-janela-espera-considera-atendimento.test.mjs`,
`tests/v1018-atendimento-e-nao-mensagem-define-espera.test.mjs` (ajustados),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1051.md`, versão
**1050 → 1051**.
