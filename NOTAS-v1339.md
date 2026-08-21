# v1339 — merge seguro: Motor Comercial + fuso do corretor

Duas linhas de trabalho chegaram a usar o número v1337 ao mesmo tempo. Ao aplicar o novo estado
comercial determinístico, `api/_pipeline.js` substituiu a versão que já continha a integração do
fuso horário do corretor. O projeto ficou inconsistente: o app e o Cérebro salvavam o fuso, mas o
pipeline não exportava `fusoDoCorretor` e a análise continuava usando Brasília.

## Correção

- preservado o estado comercial determinístico da v1337;
- restaurado `fusoDoCorretor(configCerebro)` no pipeline;
- data, hora e saudação da análise usam o fuso salvo no Cérebro;
- fuso ausente/inválido continua caindo em `America/Sao_Paulo`;
- mantida a trava de publicação da v1338.

A regressão é coberta em conjunto pelos testes `v1337-estado-comercial-deterministico` e
`v1337-fuso-do-corretor`.
