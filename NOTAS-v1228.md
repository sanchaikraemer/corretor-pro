# v1228 — salvar observação não reanalisa mais sozinho

Pedido do dono, 12/08/2026: *"quando salva obs eu mandei sempre reanalisar, porem vamos mudar
para quando salvar NAO reanalisar automaticamente."*

## O que mudou

Desde a v1171, tocar em **"Salvar observação"** disparava sozinho a mesma reanálise do botão
"Reanalisar" — a barra de progresso ("Lendo histórico do lead...", "Conferindo se ficou salvo...")
aparecia logo depois de salvar, sem o corretor pedir. A pedido do dono, isso foi desligado.

Agora, ao salvar uma observação:

- Ela continua aparecendo **na hora** na linha do tempo do cliente, sem fechar/reabrir nada.
- O lead continua sendo marcado como **atendido** (comportamento da v980, intacto).
- O aprendizado em segundo plano continua (a observação ensina o sistema e **entra na próxima
  análise**, como o próprio texto da caixinha já explica).
- A **reanálise NÃO roda mais sozinha** — ela só acontece quando o corretor tocar no botão
  "Reanalisar" no topo. O aviso depois de salvar agora diz exatamente isso: "Observação salva.
  Ela entra na próxima análise (toque em Reanalisar quando quiser atualizar)."

Nada mais mudou: o botão "Reanalisar" funciona igual, a observação por áudio (gravar/ditado) cai
no mesmo salvar e segue a mesma regra.

## Proteção pra não voltar

- `tests/observacao-aprendizado.test.mjs` foi invertido: antes ele **exigia** a reanálise
  automática (v1171); agora ele **proíbe** — se alguém religar o disparo automático dentro do
  salvar observação, o teste quebra.
- `tests/v1171-atendidos-hoje-semana-mes.test.mjs` deixou de cobrar o disparo automático e passou
  a cobrar só o que continua valendo daquele pedido: a observação aparecer na tela na hora.
