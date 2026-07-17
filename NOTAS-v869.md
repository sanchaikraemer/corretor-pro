# v869 — remove os avatares de iniciais da fila "Próximos atendimentos"

## Mudança

O dono não quer os círculos com iniciais (FC, MG, M…) nas linhas de "Próximos atendimentos"
("nunca pedi isso"). Os dois renderizadores de fila deixaram de desenhar o avatar:
- `filaRowHTML` (a fila do "Próximos atendimentos" na Home) — removido `${avatarLead(l, "")}`.
- A lista de grupo (ao abrir um KPI) — removido `${avatarInicial(l.name, "")}`.

`.fila-row` é flexbox, então o restante (número, nome/produto, dias, status, ✓ e WhatsApp)
apenas se reacomoda; nada de layout a ajustar. Só `app.js`.

## Verificação

- Novo teste `tests/v869-sem-avatar-fila`: garante que a fila não desenha mais avatar e que a
  linha (rank + info) continua.
- `npm test`: suíte completa verde.
