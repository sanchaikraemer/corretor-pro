# v905 — leva de limpeza (7 itens), removendo de verdade do código

O dono pediu uma faxina de UI e reforçou: **o que sair, sai do código** (função/HTML/CSS/listener
órfão), não só escondido — pra não pesar nem arriscar quebrar. Cada remoção foi checada contra
"quem mais usa isso" antes de tirar.

## 1. Importação de LEADS por CSV — removida
Bloco `IMPORTAR LEADS DE CSV` (handlers de `#crmImportBtn`/`#crmCsvInput`, `CSV_ETAPA_MAP`,
`crmDataBR`) apagado — já era código morto (a UI dele nem existia mais no HTML). **Mantidos**:
`parseCsvDireciona` (a "Importar telefones (CSV)" usa) e o **export** ⬇ Excel (`exportarLeadsCSV`,
que é exportação, não importação).

## 2. "Ver todos" (home) — removido
O card "Total de leads" e o botão "Ver todos" abriam a MESMA tela (Condução). Tirado o botão,
mantido o card. `abrirTodosLeads` continua (usado no rodapé "Ver todas as oportunidades" e no `.navTodos`).

## 3. "Reanalisar todos" — saiu da home, foi pro Menu (Configurações)
Removido da linha de ações da home; virou card no Menu (`onclick="reanalisarTudo()"`). A função e os
outros gatilhos (folha "+" e Condução) continuam.

## 4. Botão "Voltar" — harmonioso com a barra de ícones
`.cp704-back` passou a ter o mesmo formato dos `.cp704-ico` da direita (Reanalisar/Agendar/Editar/
Marcar): ícone em cima + rótulo embaixo, cantos 12px, borda, `min-width:66px`, hover. Markup ganhou
um SVG de seta + `<span class="lb">Voltar</span>`.

## 5. "Contato principal da oportunidade" — removido
Era um texto-filler default do `papel` do contato. Agora, quando não há papel real, fica vazio — a
linha "Papel do contato" some da lista de detalhes (o filtro já esconde vazios) e o chip do topo cai
no fallback curto. A descrição informativa de PARCEIRO continua.

## 6. "Editar lead" — só Nome, Telefone e Produto
Removidos do modal (`abrirEditarLead`): "Atualizar por print da conversa", "Anexar foto",
"Colar imagem" e "Observação interna" — e os listeners deles. Órfãs apagadas: `lerPrintEditarLead`
e a variável `editLeadAvatarFoto`. `salvarEditarLead` foi enxugado (só nome/telefone/produto; sem
observação/avatar). **Mantido**: "Zona perigosa · Excluir este lead" (não foi o que o dono marcou, e
é uma segurança). **Mantidos** por serem compartilhados/de outro fluxo: `recortarAvatar`,
`fileParaDataUrlRedim`, `pedirExtracaoPrint` (o print do lead MANUAL usa) e a pilha de avatar
(`processarAvatarFile` etc.).

## 7. Card "Registrar observação" — caixa maior, botões mais pra baixo
`#cp7ObsTexto`: `min-height` 76px → 120px e mais respiro antes dos botões (Gravar áudio / Salvar
observação), aproveitando o espaço que sobrava no card.

## Verificação
- `tests/v905-limpeza-7-itens.test.mjs` cobre os 7 itens (ausências e permanências).
- `tests/v866-botao-voltar.test.mjs` atualizado pro novo estilo do Voltar.
- Suíte inteira verde; `node --check` OK.

## Arquivos
- `app.js`, `index.html`, `tests/v905-limpeza-7-itens.test.mjs` (novo),
  `tests/v866-botao-voltar.test.mjs` (ajuste), `NOTAS-v905.md`, versão **904 → 905**.

## Anotado pro dono (próximas atualizações — ainda NÃO feitas)
8. Mover "Atualizado em…" pra perto de "X dias de contato / sem resposta".
9. Mostrar "Última atualização" nas metalinhas do lead (reconciliar com o item 8).
10. Contagem de atendimentos de hoje diverge (home "5 atendidos" x Meta do dia "6/10"); avaliar se
    arquivar deveria contar como atendido e por que a meta não abre com 10.
11. Dar mais qualidade visual aos botões de "Ferramentas e ações".
12. Tela Atendimentos: reorganizar por dia (prédios lado a lado, clientes atendidos abaixo de cada
    dia, últimos 7 dias); tirar o "Atendido há X min/hoje" de cada nome e o produto (descrição grande).
13. Mover as ações de baixo (Arquivar/Gerar proposta/Excluir definitivamente/Últimas mensagens) pra
    a barra de ícones do topo do lead, no mesmo padrão dos ícones já existentes.
