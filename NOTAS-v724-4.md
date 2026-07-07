# v724-4 — JSON cortado por falta de tokens fazia a análise falhar sempre

## Problema encontrado
Mesmo depois da v724-3 (que corrigiu a tag `arquiteturaMensagens`), alguns leads
continuavam reanalisando sem nunca gerar as 3 mensagens — sempre voltando pro
estado "Mensagem ainda não gerada", em toda tentativa.

Causa: a v724-2 uniu o diagnóstico completo e as 3 mensagens numa ÚNICA chamada
de IA (pra não precisar de uma segunda IA só pras mensagens), mas manteve o
teto de `max_tokens: 4096` que só bastava pro diagnóstico sozinho. Num lead com
histórico real, o JSON de resposta (resumo + diagnóstico inteiro + 3 mensagens
completas de WhatsApp) passava de 4096 tokens, o modelo cortava a resposta no
meio, `JSON.parse` falhava, e `analyzeWithBrain` caía no modo de erro
(`mode: "erro_api"`).

Em `api/reanalisar-lead.js`, quando `novoAnalysis.mode === "erro_api"`, o código
substitui a análise nova pela análise ANTIGA inteira (`{ ...previous, mode:
"reconciliacao_local" }`) — então, se a análise antiga nunca teve mensagens
válidas, a reanálise nunca resolvia, por mais vezes que o corretor tocasse em
"Reanalisar": o mesmo histórico gerava o mesmo estouro de tokens sempre.

## Correção
- `api/_pipeline.js`: `maxOutputTokens` da chamada de `analyzeWithBrain` subiu
  de `4096` para `8192`, dando espaço suficiente pro diagnóstico completo +
  as 3 mensagens comerciais no mesmo JSON.
- Versão/cache atualizados para `724-4`.

## Teste
1. Subir os arquivos.
2. Confirmar topo `Atualização #724-4`.
3. Reanalisar o lead "Eder Premium" (ou outro que estava travado).
4. A seção "Mensagem recomendada" deve mostrar as 3 opções desta vez.
