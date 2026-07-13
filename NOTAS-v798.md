# Atualização #798 — Tela do lead sem repetição e IA respeita quem pede pra esperar

## 1. Tela do lead reorganizada (fim da repetição)

A mesma informação aparecia em vários blocos. Consolidado em quatro áreas, cada dado uma única vez:

- **Situação** (abaixo do nome): resumo + relacionamento + urgência.
- **Fazer agora**: a próxima ação + as 3 sugestões de mensagem.
- **Detalhes comerciais** (recolhido): fatos estruturados para decidir.
- **Histórico** (recolhido): últimas mensagens, leitura comercial e ferramentas.

Mudanças concretas:
- Removido o bloco **"O que a IA percebeu"** (repetia o resumo do topo e o próximo passo).
- Removida a linha **"Motivo da oportunidade"** dos Detalhes comerciais (era idêntica ao resumo abaixo do nome).
- "Próximo passo sugerido" passou a se chamar **"Fazer agora"**.

## 2. IA respeita cliente que pede para esperar

Quando o cliente diz claramente que quer **adiar** (ex.: "vou esperar uns meses", "me chama quando sair o inventário/a herança", "agora não é o momento"):
- O sistema agora **reconhece esse adiamento** e trata a **urgência como baixa** (antes ficava "alta" indevidamente).
- As 3 mensagens passam a **respeitar o tempo do cliente**: reconhecem o que ele falou, se colocam à disposição e, no máximo, combinam um retorno leve mais pra frente — **sem pressionar** por faixa de valor, dormitórios ou planta/pronto.

## Compatibilidade

- Nenhum dado foi apagado; a leitura comercial e os detalhes continuam disponíveis (recolhidos).
- Vale para importação e reanálise. Sem alteração em agenda, propostas, Supabase ou chaves.
