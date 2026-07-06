# v724-1 — correção das 3 mensagens

Correção direta do erro da v724: o prompt pedia 3 mensagens em texto, mas o JSON de compatibilidade não tinha o campo `mensagens`. A IA podia responder só `diagnostico.mensagemQueEuEnviariaHoje`, e a tela exigia `messages.a/b/c`, por isso aparecia “Mensagem ainda não gerada”.

## Alterado
- `api/_pipeline.js`: adiciona o objeto obrigatório `mensagens.recomendada`, `mensagens.maisSuave`, `mensagens.maisDireta` no JSON pedido à IA.
- `app.js`: atualiza a arquitetura aceita para `gpt55-v724-1-analise-pura-chatgpt-3-msgs`.
- `service-worker.js` e `package.json`: versão/cache v724-1.

## Teste
Subir, reanalisar Eder e conferir se aparecem as três mensagens.
