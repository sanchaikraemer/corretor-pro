# v846 — corte para a numeração de versão inteira (fim da série 827-N)

## O que mudou

Só a versão exibida/publicada. Não houve alteração funcional além da já entregue na
v827-18 (resgate do conteúdo real da IA antes de cair no fallback genérico de
mensagens) — este commit apenas encerra a numeração fracionada `827-N` conforme
pedido, adotando a partir de agora números inteiros sequenciais.

- `displayVersion`: `827-18` → `846`.
- `version` (semver): `7.127.18` → `7.846.0`.
- A partir daqui, cada atualização soma 1 (`847`, `848`, ...), sem sufixo `-M`.

## Validação

- `npm install --package-lock-only` rodado pra sincronizar o `package-lock.json`.
- `node build.js` confirma `versão=846` nos arquivos publicados.
- Suíte completa (38 conjuntos) sem erro.
