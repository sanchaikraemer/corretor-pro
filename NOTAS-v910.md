# v910 — Atendimentos por dia: colunas limpas (prédio maior, sem caixa)

## Correção (reclamação do dono)
Na v908 a tela Atendimentos ficou com cada dia dentro de uma **caixa** (fundo + borda arredondada)
e o **prediozinho encolhido** (78px) — ficou feio/apertado.

## Agora
- **Sem caixa/fundo** por coluna: o dia é só uma coluna limpa, separada da vizinha por uma
  **divisória fininha**.
- **Prédio maior**: ocupa a largura da coluna (`width:100%`, até 110px) — volta a ter presença.
- Os nomes dos clientes do dia continuam como chips (agora centralizados).

## Mobile — o problema real
No celular, as 7 colunas lado a lado forçavam **rolagem horizontal** (só dava pra ver ~2 dias, e as
colunas de alturas diferentes ficavam desalinhadas — feio). Agora, em telas ≤720px, a tela **empilha
por dia na vertical**: cada dia é uma faixa com o prediozinho pequeno + dia + contagem em cima e os
nomes em **chips que quebram linha** embaixo. Rolagem natural pra baixo. No PC (largo) continua em
colunas lado a lado.

## Verificação
- `tests/v910-atendimentos-limpo.test.mjs` (novo): confere que a coluna não tem mais fundo/borda de
  card, que há só a divisória entre dias e que o prédio é grande.
- `tests/v908-...` ajustado pro novo CSS. Suíte verde, `node --check` e build OK.

## Arquivos
- `styles.css` (bloco `.cp788-day*`), `tests/v910-atendimentos-limpo.test.mjs` (novo),
  `tests/v908-...` (ajuste), `NOTAS-v910.md`, versão **909 → 910**.
