# v1373 — áudio resiliente + pergunta comercial pendente

Correções validadas em 23/08/2026:

1. Áudio `.opus` extraído do ZIP é armazenado temporariamente como `application/octet-stream`, compatível com o bucket restrito.
2. A interface não afirma mais que o arquivo “não veio no envio” quando houve falha de processamento.
3. Falha pontual em um áudio não aborta toda a importação; os demais áudios e o TXT continuam.
4. Pergunta comercial recente do corretor ainda sem resposta tem precedência sobre uma nova lacuna.
5. Enquanto essa pergunta estiver pendente e dentro do prazo, o sistema não repete a mesma pergunta.
6. Nesse mesmo estado, não abre qualificação secundária (entrada, parcelas, reforços etc.) e não guarda mensagens para envio.
7. O alerta “as três só perguntam” só é exigido quando existe entrega pendente real; valor antigo citado sozinho não basta.
8. O teste de Storage passa a reproduzir a restrição real do bucket, sem exceção artificial para `audio/*`.

Regressão nova: `tests/v1373-oito-correcoes-arnildo-audio.test.mjs` cobre os oito pontos.
