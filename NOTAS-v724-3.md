# v724-3 — Sugestões de mensagem sumindo após reanalisar

## Problema encontrado
Depois da v724-2 (que corrigiu a IA para gerar `mensagens.recomendada/maisSuave/maisDireta`),
o corretor continuava reanalisando o lead e a seção de mensagem sugerida não aparecia,
mesmo quando a IA respondia com as 3 mensagens.

Causa: em `api/reanalisar-lead.js`, a função `garantirMensagensMotorComercialV714` gravava
sempre a tag antiga `arquiteturaMensagens = "gpt55-v715-motor-comercial-v2-layout-mobile"`,
independentemente do resultado da IA. O front (`app.js`, `mensagensDaAnalise`) só exibe as
mensagens quando `arquiteturaMensagens` é exatamente `ARQUITETURA_MENSAGENS_ATUAL`
(`"gpt55-v724-2-analise-pura-3-mensagens"`). Com a tag desatualizada, a checagem falhava
sempre e a tela caía no estado vazio ("Reanalisar"), mesmo com as 3 mensagens já salvas
no banco.

## Correção
- `api/reanalisar-lead.js` importa `ARQUITETURA_MENSAGENS_ATUAL` de `_pipeline.js` e usa
  essa constante (em vez do texto fixo antigo) nos 3 pontos onde `arquiteturaMensagens`
  é definido dentro de `garantirMensagensMotorComercialV714`.
- Versão/cache atualizados para `724-3`.

## Teste
1. Subir os arquivos.
2. Confirmar topo `Atualização #724-3`.
3. Reanalisar um lead com conversa suficiente para gerar as 3 mensagens.
4. A seção Mensagem recomendada deve mostrar as 3 opções (Recomendada/Mais suave/Mais direta).
