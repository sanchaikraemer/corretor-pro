# Corretor Pro v726

Correção focada no problema das 3 respostas sugeridas.

## O que foi corrigido

- Backend agora completa as 3 mensagens antes de salvar quando a IA/reanálise devolver só uma ou duas.
- Reanálise (`api/reanalisar-lead.js`) não zera mais mensagens incompletas.
- Frontend não esconde mensagens reais por divergência de arquitetura antiga.
- Tela do lead completa B/C com fallback local seguro quando só existe a recomendada.
- Versão atualizada para 7.26.0 / 726.

## Validação esperada

A tela do lead deve sempre mostrar:

1. Recomendada
2. Mais suave
3. Mais direta

Mesmo quando a IA devolver apenas a primeira mensagem.
