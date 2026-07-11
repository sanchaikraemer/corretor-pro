# v782 — Card com NOME DO ARQUIVO ("Conversa do com...zip")

## O problema

Depois de importar, o lead aparecia com o nome do arquivo inteiro — "Conversa do com Elisandro Altmann Altan-enxuto.zip" — em vez do nome do cliente.

## Causa

A limpeza da v780 só arrumava o nome do ARQUIVO. Mas em alguns imports a própria análise gravou o nome do arquivo como se fosse o nome do CLIENTE (`clientName`), e esse caminho não passava pela limpeza. Como o nome saía errado, também atrapalhava o reconhecimento de lead duplicado.

## Correção

Agora, tanto no servidor (`api/_persistence.js`, ao montar a lista) quanto no app (`app.js`, `limpoNome`), quando o nome "parece um arquivo" (termina em `.zip` ou começa com "Conversa d…") ele é limpo — vira o nome do cliente ("Elisandro Altmann Altan").

Isso conserta os cards que já estão com nome de arquivo **na próxima vez que a tela carrega** (a limpeza é feita na leitura), e faz o reconhecimento de duplicado (v781) voltar a funcionar nesses casos.

## Testes

- `npm test` e `npm run build` passaram.
- Falta validar em produção: abrir a carteira e conferir que o card "Conversa do com…zip" passou a mostrar o nome do cliente.
