# v900 — mensagem REAL importada vence a "mensagem enviada" copiada

## Bug (prints do dono)
Ao copiar uma sugestão, o app grava na timeline uma "mensagem enviada"
(`type:"mensagem_enviada"`, `source:"manual"`) com o texto DA SUGESTÃO. Mas o corretor pode
editar antes de mandar (ou o texto real diferiu). Ex. real "…o que acha?" x gravado
"…desse perfil?". Ao reimportar a conversa, a mensagem real do WhatsApp NÃO substituía a
cópia: o dedup (`_mesclarTimelinesV681`) mantinha a antiga (a cópia) e o app mostrava o texto
errado ("não transcreveu na íntegra").

## Correção
Em `_mesclarTimelinesV681`, uma "mensagem enviada" copiada é descartada quando a importação
traz a mensagem REAL correspondente (mensagem não-manual da conversa, com o mesmo começo forte
de texto — ≥40 e até 60 chars idênticos). A mensagem real permanece; só a cópia provisória sai.
Conservador: sem real correspondente, a cópia é preservada; começo de texto diferente não
derruba nada (sem falso positivo). Risco de perda de dado ~zero.

## Verificação
`_mesclarTimelinesV681` é função pura — coberta por teste de unidade com o cenário exato
(cópia antiga + import real → fica a real; sem import → preserva; texto diferente → preserva).
Import real de ponta a ponta o dono confirma reimportando um lead desses.

## Arquivos
- `api/_persistence.js` — `_mesclarTimelinesV681` (real vence cópia).
- `tests/v900-mensagem-real-vence.test.mjs` (novo).
- `package.json` — versão 899 → 900.
