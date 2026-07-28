# NOTAS v1046 — Primeira fatia da divisão do app.js em módulos

## O problema

A auditoria (seção sobre manutenibilidade) apontou que `app.js` é um arquivo único gigante, o que
torna cada mudança mais arriscada e mais lenta de revisar. A correção definitiva é grande demais
pra fazer de uma vez sem risco — a estratégia adotada nas sessões anteriores (`js/proposta.js`,
`js/pwa-install.js`) e mantida aqui é: extrair um pedaço independente por vez, sempre com teste de
verificação e sempre confirmando que nada quebrou, em vez de tentar reescrever tudo de uma
tacada só.

## A correção

Extraído o bloco "Aparência: tema claro/escuro" (troca de tema, sincronização dos botões, salvar
escolha no aparelho) para `js/tema.js`. Foi o pedaço escolhido por ser o mais seguro disponível:
não depende de nenhum outro estado do sistema, e só é chamado de um único lugar (na inicialização
da tela). `app.js` agora importa e chama esse módulo, exatamente como fazia antes — nada muda pra
quem usa o sistema.

## Verificação

- Novo teste `tests/js-tema-module.test.mjs`: confirma que o bloco saiu de `app.js` de verdade
  (nenhuma das funções nem a chave de armazenamento local continuam lá), que `js/tema.js` tem as
  funções certas com os `import`s certos, e que `app.js` importa e chama o módulo sem quebrar o
  comportamento.
- Teste ao vivo no navegador (Playwright, headless): abri a tela real, forcei a navegação até o
  menu (onde fica o controle de tema), cliquei em "Tema claro" e depois em "Tema escuro" — a cor da
  tela mudou nos dois cliques e o aviso ("Tema claro aplicado." / "Tema escuro aplicado.") apareceu
  certinho, sem nenhum erro relacionado a essa parte do sistema.
- Ajuste em teste antigo: `tests/v874-identidade-tokens.test.mjs` verificava que as cores oficiais
  de tema apareciam em `app.js` — como esse trecho mudou de arquivo, o teste passou a olhar também
  em `js/tema.js` (mesma verificação, lugar certo).
- `npm test`: suíte inteira verde (todos os testes, incluindo o novo).
- `npm run build`: build limpo, 27 arquivos publicados.

## O que ainda falta (próxima fatia, não faz parte desta mudança)

`app.js` continua grande — esta foi só a segunda fatia extraída (depois de proposta e instalação
do app). O próximo pedaço candidato, já identificado, é o dos nomes/etiquetas de produto e
empreendimento (usado em vários lugares da tela, mas sem depender de outro estado) — fica pra uma
próxima rodada, com o mesmo cuidado de sempre: um pedaço por vez, com teste antes de mexer no
próximo.

## Arquivos

`js/tema.js` (novo), `app.js` (import do módulo, bloco antigo removido), `build.js` (publica o
novo módulo), `tests/js-tema-module.test.mjs` (novo), `tests/v874-identidade-tokens.test.mjs`
(ajustado pro novo local do código), `package.json`/`package-lock.json` (versão + script `test`),
`NOTAS-v1046.md`, versão **1045 → 1046**.
