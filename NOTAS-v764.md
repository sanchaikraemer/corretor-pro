# v764 — Remove botão duplicado de reanalisar no lead

## O que foi corrigido

Na tela do lead, quando a análise está pendente/antiga, apareciam 3 botões fazendo exatamente a mesma coisa (reanalisar): "⟳ Reanalisar agora" no topo, "Atualizar análise comercial" no card de análise antiga/pendente, e mais um "Atualizar análise comercial" dentro de "Sugestões de mensagem".

O terceiro botão foi removido nesse caso (já existe um idêntico logo acima, no card de análise antiga/pendente). O texto da seção "Sugestões de mensagem" agora só orienta a usar o botão que já está visível — sem repetir a ação.

Quando o card de análise antiga/pendente não aparece (ex.: análise válida mas mensagem ainda sem gerar por outro motivo), o botão em "Sugestões de mensagem" continua existindo, porque nesse caso ele é a única ação contextual na tela.

## Testes

- `npm test` passou.
- `npm run build` passou.
