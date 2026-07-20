# v889 — barra de "Interesse do cliente" (no lugar do funil "passo X de 6")

## Contexto
O dono percebeu que muitos leads "avançados" (passo 5/6) estão longe de fechar — o funil de
6 etapas não mede qualificação. Ele já tinha mandado tirar as etapas. Decisão: trocar o badge
"Negociando · passo 5 de 6" por uma **barra de interesse** baseada em comportamento real.

## O que mudou

### Barra de interesse (cabeçalho do lead)
No lugar do badge de jornada, uma **barra de largura total**:
- Mede **mensagens DO CLIENTE** (não as minhas explicando, nem itens manuais/atendimento).
- **Cheia em 30** mensagens do cliente (`CP_TETO_BARRA_INTERESSE`).
- Rótulo "Interesse do cliente" + contagem ("18 mensagens do cliente").
- Novo `mensagensDoCliente(l)` conta via `ehMsgDoCliente`, ignorando as minhas e manuais.

### Ranking "Fazer agora" na mesma régua
- `cpNotaPrioridade` passa a usar `mensagensDoCliente` (antes: total de mensagens). Assim o
  engajamento que conta é o interesse do cliente, não o volume de mensagens minhas.
- O corte de "lead cru" (`CP_MIN_MSGS_PRIORIDADE = 5`) também passa a ser **5 mensagens do
  cliente** (era total).

O badge `cp704JornadaBadge` continua definido (sem uso no cabeçalho) — não removido pra não
mexer em quem ainda o referencia; só saiu da tela do lead.

## Atenção à calibragem
Mensagens do cliente são um número **menor** que o total (10–30 vs 50–150). Com os pesos
atuais (engajamento ×2, abandono ×1), o **abandono pode passar a pesar mais** na fila. Se, ao
ver a fila real, o "tempo parado" dominar demais o "interesse", subir `CP_PESO_ENGAJAMENTO`
(ex.: ×3 ou ×4) reequilibra. É 1 minuto.

## Arquivos
- `app.js` — `mensagensDoCliente`, `cp704BarraInteresse`, `CP_TETO_BARRA_INTERESSE`;
  `cpNotaPrioridade` e `cp786Categoria` usando mensagens do cliente; hero troca badge pela barra.
- `tests/v889-barra-interesse.test.mjs` (novo, executa `mensagensDoCliente`); `v818`, `v885`,
  `v886` atualizados.
- `package.json` — versão 888 → 889.
