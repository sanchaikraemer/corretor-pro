# v773 — Data invertida no histórico de mensagens ("06/02/2026" em vez de "02/06/2026")

## O problema (relatado pelo usuário)

No histórico "Últimas mensagens" de um lead, uma conversa de 2 de junho de 2026 aparecia como "06/02/2026" — dia e mês trocados (lida como 6 de fevereiro).

## Causa

`cp705FormatDateTime` (`app.js`) recebia a data já no formato brasileiro vindo do TXT do WhatsApp (`"02/06/2026 09:57"`, DD/MM/AAAA) e passava direto pro construtor nativo `new Date(raw)`. Sem indicação de formato, o `Date()` do JavaScript interpreta strings assim como **MM/DD/AAAA** (padrão americano) — "02/06/2026" virava mês 02 (fevereiro), dia 06, e ao reformatar para pt-BR saía "06/02/2026".

## O que foi corrigido

`cp705FormatDateTime` agora reconhece explicitamente o padrão `DD/MM/AAAA[ HH:MM]` antes de cair no `Date()` genérico, construindo a data com dia/mês na ordem certa. Strings em outros formatos (ISO, por exemplo `m.iso`/`createdAt`) continuam passando pelo `Date()` normal, sem mudança de comportamento.

## Testes

- `npm test` e `npm run build` passaram.
- Reproduzido o bug isoladamente: `new Date("02/06/2026 09:57")` → 6 de fevereiro (confirmado); com o parser novo → 2 de junho, hora preservada.
- Validar no app em produção reabrindo o histórico de um lead com data no início do mês (dia ≤ 12, caso ambíguo) e conferindo que a data bate com a conversa real.
