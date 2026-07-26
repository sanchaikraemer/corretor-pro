# v1008 — painel administrativo em escala (pensado pra milhares de corretores)

## Contexto

Depois da melhoria do celular (v1006), o dono apontou o problema seguinte: "imagina quando
tiver 5 mil clientes". Dois defeitos de escala: (1) a lista carregava TODAS as contas de uma
vez e filtrava varrendo a tela; (2) no celular, cada conta ocupava um cartão enorme.

## O que mudou (admin-plataforma.html + contas-estilo.css)

- **Lotes de 50**: a lista carrega 50 contas por vez, com o botão "Mostrar mais" e um contador
  ("Mostrando N conta(s)").
- **Busca e filtros no banco**: buscar pelo nome (com pequena espera de digitação) e filtrar
  por status agora consultam o banco — funciona igual com 5 ou 5 mil contas.
- **Números de resumo de verdade**: total/em teste/ativos/bloqueados vêm de contagens do banco,
  não do pedaço carregado na tela.
- **Cartão compacto no celular**: nome + status na primeira linha, os dados numa linha de
  etiquetas pequenas, e os botões de ação escondidos atrás de "Ações ⌄" (expande por conta).
  No computador nada muda (ações sempre visíveis, tabela normal).
- A coluna "Status" separada saiu — o status vai como etiqueta colorida ao lado do nome, nas
  duas telas.

## Testes

Novo `tests/v1008-painel-admin-em-escala.test.mjs` (lotes, range, ilike, eq de status,
contagens head, botão "Mostrar mais", toggle de ações e CSS). Ajustado o teste v1006 (a célula
"Status" deixou de existir — o status foi pro lado do nome).

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`admin-plataforma.html`, `contas-estilo.css`, `tests/v1008-painel-admin-em-escala.test.mjs`
(novo), `tests/v1006-painel-admin-legivel-no-celular.test.mjs` (ajustado),
`package.json`/`package-lock.json`, `NOTAS-v1008.md`, versão **1007 → 1008**.
