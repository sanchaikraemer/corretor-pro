# v888 — desmarcar atendimento ("cliquei sem querer")

## Problema
Ao clicar em "Marcar atendimento", o botão travava em "Atendido hoje" (disabled) e não havia
como desfazer. Um clique sem querer ficava registrado (evento `contato_manual` de hoje),
fazendo o lead "descansar" indevidamente.

## Correção
- **Botão "Desmarcar"** no cabeçalho do lead, ao lado de "Atendido hoje" (só aparece quando o
  lead está atendido hoje). Desfaz o atendimento do dia feito pelo botão.
- **API** (`api/reanalisar-lead.js`) — nova ação `desmarcar-atendido`: remove apenas os eventos
  `contato_manual` de `botao_atendido` **do dia atual**. Não mexe em atendimentos de outros
  dias nem em outros tipos (mensagem copiada, observação, etc.).
- **Front** (`app.js`) — `ui667DesmarcarAtendido` chama a API e `ui667RemoverAtendidoLocal`
  limpa o evento localmente, recalculando o último atendimento pelo que sobrou; re-renderiza.

## Arquivos
- `api/reanalisar-lead.js` — ação `desmarcar-atendido`.
- `app.js` — botão "Desmarcar" + `ui667DesmarcarAtendido` / `ui667RemoverAtendidoLocal`.
- `tests/v888-desmarcar-atendimento.test.mjs` (novo).
- `package.json` — versão 887 → 888.
