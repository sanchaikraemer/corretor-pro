# v747 — IA com contexto limpo e sem templates comerciais concorrentes

Correção estrutural após contaminação entre regras/assuntos.

## O que mudou

- O prompt não recebe mais o objeto completo do lead com análises antigas, nextAction, produto, unidade e sugestões anteriores.
- A conversa completa passa a ser marcada como fonte única da verdade comercial.
- Contexto incremental/diagnóstico antigo não é mais injetado no prompt de análise.
- O fallback deixou de criar mensagens comerciais com regex/template.
- Fallback agora só sanitiza texto, corrige formato e evita quebrar a interface.
- Reanálise não injeta mais resumo/nextAction anterior como se fosse mensagem da conversa.
- Compactação da timeline em reanálise preserva mais mensagens reais e remove resumo antigo contaminante.

## Motivo

Versões anteriores estavam empilhando regras e fallbacks. Isso fazia uma regra sobrepor outra e, pior, permitia que produto/unidade/simulação de análise antiga contaminasse outro lead.

## Resultado esperado

A IA volta a raciocinar sobre a conversa real. As regras ficam como orientação/validação, não como motor que inventa mensagem.
