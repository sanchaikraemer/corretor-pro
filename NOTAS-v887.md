# v887 — cabeçalho do lead: horário sem desencontro + metalinhas padronizadas

## 1. Desencontro de horário (fuso)

No cabeçalho, "Última mensagem — 04/06/2026 • 00:32", mas no histórico a mesma mensagem
aparecia **03:32**. Diferença de 3h = fuso: o cabeçalho pegava `lead.lastInteractionAt`
(ISO/UTC) e a `cp705FormatDateTime` convertia pra `America/Sao_Paulo`, deslocando 3h, enquanto
o histórico mostra a hora local do WhatsApp.

**Correção:** "Última mensagem" passa a puxar a hora da **própria última mensagem real**
(`cp786UltimaMensagemReal` → `cp704DataHora`), mesma fonte do histórico — então batem.
`lead.lastInteractionAt` fica só como fallback quando não há mensagem.

## 2. Metalinhas padronizadas

Estava **1 em cima** ("Última análise") e **2 embaixo** juntas por " · " ("Última mensagem ·
Último atendimento"). Ficou desalinhado.

**Correção:** as três viram **linhas próprias, uma embaixo da outra** (mesmo formato
`cp704-metaline`):
```
Última análise — …
Última mensagem — …
Último atendimento — …
```

## Arquivos
- `app.js` — `renderLead` (cabeçalho `cp704`): fonte de "Última mensagem" + 3 metalinhas.
- `tests/v887-cabecalho-metalinhas.test.mjs` (novo); `tests/attendance-refresh.test.mjs`
  atualizado pra nova fonte da "Última mensagem".
- `package.json` — versão 886 → 887.
