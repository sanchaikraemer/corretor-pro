# v724 — Análise pura + 3 mensagens

## Escopo
Correção da integração do cérebro resetado com a tela, mantendo a análise no modelo "ChatGPT puro" e restaurando as 3 mensagens.

## Alterado
- `api/_pipeline.js`
  - versão do motor: `gpt55-v724-analise-pura-chatgpt-3-msgs`.
  - prompt principal mantido simples, baseado no texto aprovado.
  - removida a instrução errada "não gere três mensagens".
  - IA agora deve retornar 3 mensagens no mesmo JSON: recomendada, mais suave e mais direta.
  - o código mapeia as 3 mensagens para `messages.a`, `messages.b`, `messages.c`.
- `app.js`
  - arquitetura esperada atualizada para v724.
  - versão visual atualizada para #724.
- `service-worker.js`
  - cache atualizado para v724.
- `package.json`
  - displayVersion atualizado para 724.

## Não alterado
- layout geral.
- CSS.
- banco.
- importação/transcrição.

## Teste obrigatório
1. Subir os arquivos alterados.
2. Confirmar #724 no topo.
3. Reanalisar Eder.
4. Verificar se aparecem 3 abas/mensagens: Recomendada, Mais suave, Mais direta.
5. A análise deve seguir a estrutura: resumo, diagnóstico, o que falta descobrir, mensagem, estratégia e prioridade.

## Verificação local
- `node --check api/_pipeline.js`
- `node --check app.js`
- `node --check service-worker.js`
- `npm test`
