# v1006 — painel administrativo legível no celular

## Contexto

Usando o painel administrativo pelo celular (durante a limpeza das contas de teste da v1005),
o dono mostrou que a tabela ficava cortada na lateral, com os nomes escondidos e os botões
empilhados numa coluna espremida.

## O que mudou

- `contas-estilo.css`: em tela estreita (até 760px), a tabela do painel vira CARTÕES — um por
  corretor, com cada dado rotulado ao lado ("Status", "Dias de teste", "Usuários", "Criado em")
  e os botões de ação em linha, sem corte lateral. Os números de resumo passam a 2 colunas e a
  busca ocupa a largura toda. Também corrigido: os botões de filtro (Todos/Em teste/...)
  herdavam largura total do estilo base de botão e empilhavam um por linha — agora ficam lado a
  lado. No computador nada muda (a regra é só pra tela estreita).
- `admin-plataforma.html`: cada célula da tabela ganhou o rótulo (`data-rotulo`) que o modo
  celular exibe.

## Testes

Novo `tests/v1006-painel-admin-legivel-no-celular.test.mjs`: rótulos presentes nas células e
regra de tela estreita no CSS (cabeçalho some, rótulos aparecem).

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`admin-plataforma.html`, `contas-estilo.css`,
`tests/v1006-painel-admin-legivel-no-celular.test.mjs` (novo), `package.json`/
`package-lock.json`, `NOTAS-v1006.md`, versão **1005 → 1006**.
