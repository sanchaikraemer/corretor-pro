# v923 — tira "sorteados" dos comentários da dose fixa (não tem nada de aleatório)

## O que aconteceu

Depois da v922 ("Fazer agora" virar uma dose fixa do dia), o dono estranhou a palavra
"sorteados" usada nos comentários do código e no `NOTAS-v922.md` pra descrever como os 10 leads
de hoje são escolhidos. Pergunta direta: **"sorteados?"**

Não é aleatório — nunca foi. "Sortear" em português dá a entender loteria/sorte, e a escolha
sempre foi (e continua sendo) pela régua de prioridade de sempre: mais mensagens do cliente
(engajamento), desempate por mais tempo parado (`cpFilaFazerAgora`). A palavra só estava mal
escolhida na hora de descrever a mudança.

## O que mudou

- Troca de "sortear/sorteado/sorteio" por "escolher/escolhido" nos comentários de `app.js` ao
  redor de `cpDoseIdsHoje`/`cpDoseFixaHoje`/`cpAdicionarNaDoseHoje` e no `NOTAS-v922.md` —
  deixando explícito que a escolha é por ranking, não aleatória. **Nenhuma lógica mudou**: é
  troca de palavra em comentário/documentação, o comportamento da v922 continua idêntico.

## Verificação

- `tests/v923-sem-linguagem-aleatoria.test.mjs` (novo): trava que o bloco da dose fixa em
  `app.js` não volte a usar "sorte/sortear/sorteio" — só existe pra não repetir a confusão.
- Suíte inteira verde (`npm test`); `node --check app.js` e `node build.js` OK.

## Arquivos
- `app.js` (comentários de `cpFilaFazerAgora`/`cpDoseIdsHoje`/`cpDoseFixaHoje`/
  `cpAdicionarNaDoseHoje`, sem mudança de lógica), `NOTAS-v922.md` (wording),
  `tests/v922-fazer-agora-dose-fixa.test.mjs` (wording), `tests/v923-sem-linguagem-aleatoria.test.mjs`
  (novo), `package.json`/`package-lock.json`, `NOTAS-v923.md`, versão **922 → 923**.
