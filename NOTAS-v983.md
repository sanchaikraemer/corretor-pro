# v983 — botão "Tentar recuperar" (compartilhamento do WhatsApp) sem feedback

## Contexto

O dono tentou reimportar uma conversa (pra atualizar um cliente que já tinha resposta mais
recente no WhatsApp do que o Corretor Pro sabia). O compartilhamento do ZIP não apareceu a tempo
("O arquivo ainda não apareceu no armazenamento do aplicativo"), ele tocou em **Tentar recuperar**
e reportou: "cliquei e nada aconteceu".

## O que estava acontecendo

Não era um botão morto — o clique realmente disparava uma nova tentativa de achar o arquivo
(`checkShared()`), só que essa tentativa é assíncrona e pode levar vários segundos, e o botão não
mostrava NENHUM sinal disso. Se a segunda tentativa também falhasse, a tela voltava a mostrar
exatamente a mesma mensagem de erro de antes — visualmente idêntica ao estado anterior ao clique.
Pra quem está olhando, isso é indistinguível de "o botão não fez nada".

Além disso, o prazo que o app espera pelo arquivo (antes de desistir e mostrar esse erro) era de
8 segundos — curto para uma conversa grande com áudio, onde gravar o ZIP inteiro no
armazenamento do aparelho pode legitimamente levar mais que isso.

## Fix

- `app.js`: o clique em "Tentar recuperar" agora desativa o botão e troca o texto pra
  "Procurando…" IMEDIATAMENTE, antes da nova tentativa começar — não é mais possível confundir
  "está tentando" com "não fez nada".
- `app.js`: o prazo de espera pelo arquivo compartilhado subiu de 8s para 15s.
- `tests/share-target-cold-start.test.mjs`: assert do prazo atualizado pra 15000.

## Verificação

- `npm test`: suíte inteira verde (158 checks), incluindo o novo
  `v983-recuperar-share-feedback.test.mjs` (cobre o feedback imediato do botão e o novo prazo).
- `npm run build`: build limpo, versão 983.
- Não reproduzido localmente (depende do fluxo real de "compartilhar com o app" do Android) —
  a causa raiz relatada (falta de sinal visual + prazo curto) foi corrigida na origem; segue
  acompanhamento se o dono relatar de novo.

## Arquivos

`app.js` (feedback do botão + prazo de 15s), `tests/share-target-cold-start.test.mjs` (prazo
atualizado), `tests/v983-recuperar-share-feedback.test.mjs` (novo), `package.json`/
`package-lock.json`, `NOTAS-v983.md`, versão **982 → 983**.
