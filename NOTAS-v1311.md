# v1311 — o erro que travava TODAS as análises desde as 14h34 de 19/08

Print do dono, 19/08/2026 às 16h15, logo depois de recarregar os créditos da OpenAI:

> `[HTTP 400 · code=unsupported_parameter · type=invalid_request_error] Unsupported parameter:`
> `'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.`

Traduzindo: **o app estava pedindo a análise usando um nome de parâmetro que o modelo novo da
OpenAI não aceita mais.** Toda tentativa voltava erro na hora — importação, reanálise, tudo.

## De onde veio

A v1308 (publicada às 14h34 do mesmo dia) subiu o modelo da análise para a linha atual da OpenAI
(`gpt-5.6-terra`). Essa família mudou o nome do parâmetro que limita o tamanho da resposta:
`max_tokens` virou `max_completion_tokens`. O modelo subiu, o parâmetro ficou.

Resultado: **desde as 14h34, nenhuma análise saía**. E como a falta de crédito apareceu no meio do
caminho (resolvida por ele às 16h), os dois problemas se misturaram — mas eram dois.

Isso também explica, sem sobra, tudo que ele viu à tarde:
- "Não foi possível analisar" na importação;
- "análise nova não concluída — mantida a anterior" (as sugestões que ele já tinha enviado);
- "A reanálise não foi concluída e nenhuma sugestão foi salva".

## O que mudou

**1. O nome certo, escolhido pelo modelo.** Toda chamada à OpenAI passa por `limiteDeSaida`, que
usa `max_completion_tokens` na linha GPT‑5 em diante (e na linha "o") e `max_tokens` nos modelos
anteriores.

**2. E uma rede pra próxima vez.** O modelo é trocável na hospedagem sem publicar código
(`DIRECIONA_MAIN_MODEL`), então depender de uma lista atualizada à mão é repetir o defeito daqui a
alguns meses. `criarChatComLimite` refaz a chamada com o outro nome quando a OpenAI reclama do
parâmetro — uma vez só, e só nesse erro específico (falta de crédito, por exemplo, não vira
repetição).

**3. O Diagnóstico chama igual à análise real.** Ele testava a chave da OpenAI com o parâmetro
antigo: acusaria erro onde não há, ou passaria onde a análise de verdade quebra.

Isto vale para todas as chamadas: análise, reescrita das sugestões, leitura de imagem e PDF, leitura
de link e o aprendizado das conversas.

## Arquivos

- `api/_pipeline.js` — `limiteDeSaida` e `criarChatComLimite`, aplicados em todas as chamadas.
- `api/diagnostico.js` — o teste da chave passa pelo mesmo caminho.
- Teste: `v1311-parametro-de-tamanho-do-modelo-novo` (executa a troca de nome, a rede de
  autocorreção e trava contra qualquer chamada que volte a escrever o parâmetro na mão).
