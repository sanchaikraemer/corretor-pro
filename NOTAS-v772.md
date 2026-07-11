# v772 — "Pendência financeira" podia aparecer sem o cliente ter dito nada disso

## O problema (relatado pelo usuário com o lead do Marcelo)

O card "Leads prioritários para hoje" mostrava "Pendência financeira" pra um lead (Marcelo) cujo cliente nunca comentou nada parecido na conversa de WhatsApp. Investigando, o campo `pendenciaFinanceira` do diagnóstico é gerado pela IA (`api/_pipeline.js`) e é sobre um caso bem específico: o cliente ter oferecido um imóvel próprio em permuta/entrada (esse campo foi criado na v770 pro caso real da Janaína, que citou um terreno). O problema é duplo:

1. **Nome do campo/rótulo enganoso.** Internamente e na tela, o campo aparecia como "Pendência financeira" — um nome genérico que sugere qualquer problema financeiro (renda, crédito etc.), quando na real só deveria disparar por permuta de imóvel.
2. **Instrução do prompt sem exigência de evidência literal.** O texto pedia pra incluir a permuta "mesmo que tenha sido comentado uma vez só há tempo", sem exigir uma citação literal do cliente — abrindo espaço pro modelo generalizar ou inferir algo que não foi dito de fato.

## O que foi corrigido

1. **Prompt mais rígido contra alucinação** (`api/_pipeline.js`): adicionada regra geral — nenhum campo do diagnóstico pode ser preenchido sem uma frase real do cliente/corretor na conversa que sustente aquilo; sem isso, "Não identificado".
2. **Campo `pendenciaFinanceira` exige citação literal**: a instrução agora deixa explícito que é só sobre permuta, exige um trecho entre aspas da fala do cliente como evidência, e proíbe inferir a partir de contexto indireto.
3. **Rótulo renomeado na interface**: "Pendência financeira" → "Permuta / entrada com imóvel" nos três lugares em que aparecia (`app.js`: detalhes comerciais dos 10 pontos, motivo do card de prioridade, detalhes comerciais consolidados). O nome do campo interno (`pendenciaFinanceira`) não mudou, só o texto mostrado ao corretor.
4. **Prazo de 5 dias antes de um lead atendido voltar pra fila de prioritários** (pedido separado, mesma sessão): antes, um lead marcado como atendido só ficava fora da lista até a virada do dia. Agora fica fora por 5 dias corridos (`protegidoPosAtendimento` em `app.js`).

## Testes

- `npm test` e `npm run build` passaram.
- Validar reanalisando o lead do Marcelo em produção e conferindo que "Permuta / entrada com imóvel" só aparece se ele de fato tiver oferecido um imóvel em algum momento da conversa.
