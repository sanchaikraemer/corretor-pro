# v1321 — a reanálise morria no relógio ("Request was aborted")

Print do dono (20/08/2026, 08:54): a reanálise da conversa de teste falhou com *"A reanálise não
foi concluída e nenhuma sugestão foi salva — Request was aborted"*. A mesma tela provava que o
formato novo FUNCIONA: a análise das 08:08 tinha concluído, já reposicionando a faixa.

## A causa

A leitura completa da v1320 escreve bem mais (a virada, as listas, as três jogadas, a ordem de
envio). O orçamento interno da análise era de **52 segundos** (janela real de 48s pra IA): passou
disso, o próprio app **abortava a chamada no meio** — o "Request was aborted" é a mensagem desse
corte, não do navegador.

## O que mudou — os três relógios subiram juntos

- **Servidor**: as duas rotas que rodam análise (reanalisar e importar) subiram de 60s pra 300s de
  teto. As outras rotas continuam como estavam.
- **Orçamento interno da análise**: 52s → 150s (ajustável por variável de ambiente, sem publicar).
- **Navegador**: desistia aos 90s → espera até 320s, sempre acima do teto do servidor, pra nunca
  abandonar uma análise que ainda vai chegar.
- A barra de progresso avisa a duração real: *"costuma levar de 1 a 2 minutos"*.

## Testes

`tests/v1321-analise-completa-nao-morre-no-relogio.test.mjs` guarda os três relógios e a
mensagem da barra. O guarda antigo da v827-4 (que fixava o teto da importação em 60s) foi
atualizado: a intenção dele — rota com tempo configurado suficiente — continua garantida.

`npm test`: 30 arquivos checados + 465 testes, verdes.
