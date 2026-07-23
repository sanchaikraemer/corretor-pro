# v937 — "Última mensagem" de volta + saudação não promete lista vazia

## Os dois pedidos/reclamações do dono

1. **"Cadê a última mensagem?"** — a v934 tinha removido a metalinha "Última mensagem" do
   cabeçalho do lead junto com "Último atendimento"/"Última atualização", a pedido do próprio
   dono na hora. Mas na prática ela é informação que falta de verdade: saber se o cliente
   respondeu DEPOIS da última análise, sem precisar abrir o histórico completo.
2. **"E os 9 prioritários pra hoje são o quê? E os 200+ clientes são o quê?"** — a saudação da
   Home dizia "9 leads pra atender hoje, de cima pra baixo", prometendo uma LISTA pronta e
   ordenada. Quando o balde de urgentes (`acao-hoje`/`retomar-cuidado`) vem vazio, essa lista
   não existe de verdade — e o corpo da própria Home, poucos centímetros abaixo, já mostra
   "Nenhum lead prioritário pelas regras agora" (mensagem certa, da v933). O cabeçalho
   contradizia o corpo na MESMA tela — exatamente o tipo de inconsistência que motivou a v933,
   só que num lugar que eu não tinha olhado ainda.

## O que mudou

### 1. "Última mensagem" restaurada
`renderLeadFoco` (`app.js`) volta a calcular e mostrar "Última mensagem — {data}" no cabeçalho
do lead, na mesma lógica da v887 (usa a hora da própria última mensagem real da timeline, não o
`lastInteractionAt` cru, pra não divergir de fuso do histórico). Fica logo abaixo de "Última
análise". "Último atendimento" e "Última atualização" continuam fora — essas não foram pedidas
de volta.

### 2. Saudação da Home não promete lista que não existe
`renderSaudacao` (`app.js`) agora checa se existe pelo menos um lead nos baldes
`acao-hoje`/`retomar-cuidado` (a mesma fonte que `renderBotoesHome` usa pra decidir entre
mostrar a fila real ou o convite de "Meta de hoje batida"/"Nenhum lead prioritário"). Quando
não existe nenhum candidato real ali (mesmo com a meta do dia ainda positiva), a frase muda de
"X leads pra atender hoje, de cima pra baixo" (mentira nesse cenário — não há lista nenhuma)
pra "Meta de hoje: X, mas nenhum lead prioritário pelas regras agora — puxe da fila geral
abaixo", batendo com o que o corpo da Home já mostra.

## Verificação

- `tests/v937-saudacao-nao-promete-lista-vazia.test.mjs` (novo): confirma a metalinha de volta
  e a nova condição na saudação.
- `tests/v887-cabecalho-metalinhas.test.mjs`, `tests/v934-toolbar-desktop-e-metaline-unica.test.mjs`
  e `tests/attendance-refresh.test.mjs` atualizados pra refletir "Última mensagem" de volta
  (continuam corretos sobre "Último atendimento"/"Última atualização" permanecerem fora).
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 937.

## Arquivos
- `app.js` (`renderLeadFoco`, `renderSaudacao`), `tests/v937-saudacao-nao-promete-lista-vazia.test.mjs`
  (novo), `tests/v887-cabecalho-metalinhas.test.mjs`, `tests/v934-toolbar-desktop-e-metaline-unica.test.mjs`,
  `tests/attendance-refresh.test.mjs` (atualizados), `package.json`/`package-lock.json`,
  `NOTAS-v937.md`, versão **936 → 937**.
