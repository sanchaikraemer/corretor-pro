# NOTAS v1065 — Ditado por voz repetindo a frase em cascata

## O relato

Print do dono mostrando a tela "Registrar observação" com o ditado por voz virando uma bagunça de
repetição: "ofereci ofereci o ofereci o ofereci o ofereci o gabro ofereci o gabro ofereci o gabro
mas ofereci o gabro mas...". O texto ditado não parava de se repetir e crescer.

## A causa

Já existia uma correção parecida na v1032 pra um bug do reconhecimento de voz em celulares Android:
às vezes o celular reenvia um trecho que já tinha mandado antes, na MESMA posição — aquela correção
garantia que um reenvio na mesma posição substitui em vez de somar.

O print do dono mostrou uma variação diferente do mesmo problema: em vez de reenviar na mesma
posição, o celular manda a frase INTEIRA dita até ali numa posição NOVA a cada trecho — primeiro
"ofereci", depois "ofereci o", depois "ofereci o gabro", e assim por diante, cada um numa posição
diferente do anterior. Como o código somava todas as posições, o texto final virava a soma de
frases cada vez maiores repetidas em cascata.

## A correção

Antes de juntar os trechos reconhecidos, o app agora percebe quando um trecho novo já começa com o
trecho anterior inteiro (ou seja: é a mesma frase crescendo, não uma frase nova) e troca o anterior
pelo novo em vez de somar os dois. Isso resolve tanto o caso do v1032 (mesma posição reenviada)
quanto esse caso novo (posições diferentes, frase crescendo).

## Testes

- `tests/v1065-ditado-nao-repete-frase-crescendo.test.mjs` (novo) — reproduz exatamente o padrão do
  print do dono ("ofereci" → "ofereci o" → "ofereci o gabro" → ...) e confirma que o texto final
  fica só a frase completa, sem repetição.
- Ajustei os testes `v1026` e `v1032`, que já simulavam o ditado num sandbox isolado, pra incluir a
  função nova nesse sandbox (senão dava erro de função não encontrada).
- `npm test`: suíte inteira verde.

## Arquivos

`app.js` (`cp7ObsMesclarFinais`, nova; usada em `cp7ObsIniciarDitado`),
`tests/v1065-ditado-nao-repete-frase-crescendo.test.mjs` (novo),
`tests/v1026-9-pontos-refresh-voltar-reaproveita-proposta-ditado.test.mjs`,
`tests/v1032-ditado-nao-duplica-resultado-reenviado.test.mjs`,
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1065.md`, versão **1064 → 1065**.
