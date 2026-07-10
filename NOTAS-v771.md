# v771 — Remove heurística que trocava a análise real por texto genérico fixo

## O que era

`ui678ContextoMudouParaImovel` era uma função só do front (`app.js`) que tentava detectar um padrão bem específico: o contato falou de trabalho/emprego/vaga em algum momento da conversa e DEPOIS passou a falar de imóvel. Quando esse padrão batia, ela **substituía** — não complementava — vários campos exibidos na tela do lead por parágrafos 100% fixos, sempre os mesmos, independente do que realmente estava escrito na conversa:

- "Papel do contato" → sempre "Potencial comprador direto; o assunto antigo sobre trabalho ficou superado por um interesse imobiliário posterior."
- "Motivo da oportunidade" → um de dois parágrafos fixos
- "Último compromisso" → um de dois parágrafos fixos
- "Impedimento principal" → sempre "Perfil de compra ainda não qualificado: falta confirmar objetivo, faixa de valor e tipologia ideal."
- Próxima ação → um de dois parágrafos fixos

Essa heurística tinha prioridade MAIOR que a análise real da IA nesses campos — por isso, mesmo quando o diagnóstico da IA estava correto (como no caso da Janaína, que citou o terreno), a tela mostrava o parágrafo genérico em vez disso.

## O que foi corrigido

Removida a função e os 2 pontos onde ela sobrescrevia a tela. Esses campos agora usam só o que já existia como fallback legítimo: o resumo e diagnóstico gerados pela IA (`a.summary`, `a.diagnostico.ultimoCompromissoCliente`, `a.diagnostico.objecaoPrincipal` etc.) e os compromissos detectados de verdade (`ui671CompromissoAberto`).

## Testes

- `npm test` e `npm run build` passaram.
- Validar reanalisando alguns leads em produção e conferindo que "Motivo da oportunidade"/"Impedimento principal" refletem a conversa de cada um, não mais um texto padrão repetido.
