# v781 — Importar conversa reconhece nome PARECIDO (para de duplicar)

## O problema (Elisandro)

O corretor tinha o cadastro "Elisandro Altman" (da planilha, na preparação). Ao importar a conversa, o nome que veio foi "Elisandro Altmann Altan". Como não era IGUAL, o app criava um SEGUNDO card e o cadastro original ficava preso na preparação, sem histórico. Parecia que "não salvava".

## Causa

O reconhecimento de lead existente só juntava por nome quando era EXATAMENTE igual. Qualquer diferença ("Altman" x "Altmann Altan") virava lead novo.

## Correção (`app.js`)

`acharLeadExistente` agora também detecta nome **parecido**: mesmo primeiro nome + sobrenome quase igual (1–2 letras de diferença). Nesse caso o app **pergunta** "É o mesmo cliente ou outro?" com os botões "É o mesmo — atualizar" / "É outro — criar novo".

- Nunca junta sozinho no caso parecido (só no nome idêntico, como antes) — evita fundir pessoas diferentes por engano.
- Ao escolher "É o mesmo", a conversa gruda no cadastro que já existia, que então sai da preparação.

## Também nesta versão: reimportar não bagunça mais o nome

O nome salvo no contato do WhatsApp costuma vir estranho (ex.: "Elisandro Altmann Altan"). Ao reimportar/atualizar um lead que já existe, o app agora **mantém o nome que já estava na carteira** — só usa o nome do arquivo quando o lead ainda não tinha um nome bom.

## Como resolver os que já duplicaram

Reimportar a conversa: agora o app vai perguntar e, ao confirmar "É o mesmo", ela entra no cadastro certo. O card duplicado antigo pode ser apagado.

## Testes

- `npm test` e `npm run build` passaram.
- Falta validar em produção: reimportar o Elisandro e confirmar que aparece a pergunta e que, ao dizer "É o mesmo", ele sai da preparação com o histórico.
