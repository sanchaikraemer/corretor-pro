# v922 — "Fazer agora" agora é uma dose fixa: atender faz o número CAIR

## O bug (relato + prints do dono)

O dono mandou 4 prints e reclamou direto: marcou "Atendido" no Juliano, que estava nos "10
leads pra atender hoje", e ele não sumiu da lista — o card "Fazer agora" continuou em **10**.
Foi atender o Alexandre Schmidt também: "Atendimentos" (a tela que mostra a meta do dia) subiu
certinho pra 4/10, mas a Home continuou craqueada em 10. A frase dele resume o esperado:

> "Se se tem dez na fila. Eu atendo um [...] tem que decrescer. Se eu atendo dois, tem que
> decrescer, vai virar em oito pra atender no dia. Se eu atendo três, vai virar em sete."

## Causa raiz

`cpFilaFazerAgora` (v914) sempre foi uma fila **recalculada do zero a cada render**: pega todos
os leads ativos com engajamento real, tira quem já foi atendido hoje, ranqueia por mensagens do
cliente + tempo parado. `cpFazerAgoraDose` mostrava `min(fila.length, 10)`.

Isso funciona pra decidir QUEM entra, mas quebra a ideia de "os 10 de hoje" quando a carteira tem
mais de 10 candidatos elegíveis (era o caso: 242 leads, 79 "aguardando cliente", fila bruta bem
maior que 10). Atender o Juliano tira ele da fila recalculada — e como a carteira tinha um 11º
candidato esperando, ele entrava automaticamente no lugar. O card nunca baixava de 10 porque
sempre tinha alguém pra repor. Isso era intencional (v914 chamava isso de "carryover
automático", pedido do dono na época) — só que na prática o resultado é incoerente: atender gente
não mostra progresso nenhum no dia, e a lista "muda de gente" a cada F5/reabertura em vez de só
encolher.

## O que mudou

- **`cpDoseIdsHoje`/`cpDoseFixaHoje`/`cpFazerAgoraDose`** (`app.js`): os IDs dos "leads de hoje"
  agora são escolhidos **uma única vez por dia** — pela MESMA régua de prioridade de sempre (mais
  mensagens do cliente, desempate por mais tempo parado; nada de aleatório) — e persistidos em
  `localStorage` (chave `cpDoseFazerAgoraV1`, escopados pela data BR) a partir do topo da fila
  ranqueada de sempre (`cpFilaFazerAgora`). Depois de escolhidos, ficam **fixos o dia inteiro** —
  não importa quantos novos candidatos melhores apareçam na carteira. `cpFazerAgoraDose`/o
  card/a saudação agora contam só quantos desses IDs fixos **ainda não foram atendidos hoje**:
  atender 1 → 10 vira 9; atender 3 → vira 7. Sem reposição automática.
- **"Atender +1"** (`abrirFazerAgora`): continua existindo pra quem QUISER puxar mais um da fila
  além dos 10 — mas agora, ao puxar, o extra também é **fixado** na dose do dia
  (`cpAdicionarNaDoseHoje`), em vez de só revelar mais um item de uma janela deslizante.
- **"Oportunidades esquecidas"** (`leadsEsquecidos`): a exclusão de quem já está no "Fazer agora"
  de hoje passou a usar os mesmos IDs fixos (`cpDoseFixaHoje().idsSet`) — atendido ou não, quem
  faz parte do plano do dia não vira "esquecido" só porque saiu da fila recalculada.
- **Home (`renderBotoesHome`) e Condução (`carregarPipeline`, aba "Fazer agora")**: a lista
  visível (hero + "Próximos atendimentos") e o KPI da Condução passam a vir da dose fixa
  (`cpDoseFixaHoje().pendentes`); quem é elegível mas não entrou nos 10 de hoje some pra dentro do
  expansor "Fila de retomada" — não desaparece, só não conta como urgência de hoje nem entra
  sozinho no meio do dia.
- No dia seguinte (data BR diferente do que está salvo), a dose é escolhida de novo do zero —
  mantendo o "carryover" entre DIAS (quem não foi atendido ontem tende a reaparecer no topo, pela
  régua de sempre), só não repõe mais DENTRO do mesmo dia.

## Verificação

- `tests/v922-fazer-agora-dose-fixa.test.mjs` (novo): escolha inicial determinística (top 10 por
  engajamento), confirma que um novo candidato mais forte não reordena nem entra na dose já
  fixada, que atender 3 de 10 derruba o pendente pra 7 sem repor, que "Atender +1" fixa o extra
  puxado, e que uma dose salva com data antiga é descartada e escolhida de novo.
- `tests/v914-fazer-agora-dose-e-fds.test.mjs` e `tests/v884-fazer-agora-retomadas.test.mjs`
  ajustados: a asserção exata do antigo `cpFazerAgoraDose`/`abrirFazerAgora` (carryover
  automático, "10 + extra") foi trocada pela nova assinatura (dose fixa).
- Suíte inteira verde (`npm test`); `node --check app.js` e `node build.js` OK.

## Arquivos
- `app.js` (`cpDoseIdsHoje`, `cpDoseFixaHoje`, `cpAdicionarNaDoseHoje`, `cpFazerAgoraDose`,
  `abrirFazerAgora`, `leadsEsquecidos`, `renderBotoesHome`, `carregarPipeline`),
  `tests/v922-fazer-agora-dose-fixa.test.mjs` (novo), `tests/v914-fazer-agora-dose-e-fds.test.mjs`
  e `tests/v884-fazer-agora-retomadas.test.mjs` (ajustados), `package.json`/`package-lock.json`,
  `NOTAS-v922.md`, versão **921 → 922**.
