# NOTAS v1064 — Botão "Imprimir lista" na Carteira ativa

## O relato

Depois de explicar como ver todos os clientes ativos (tela "Carteira ativa"), o dono pediu:
"eu quero uma lista pra imprimir."

## A mudança

Botão novo **"🖨️ Imprimir lista"** na tela "Carteira ativa" (Condução → "Ver clientes ativos"),
do lado do botão "Voltar às prioridades". Ao tocar, gera uma folha simples — nome, telefone,
produto e etapa de cada cliente ATIVO (arquivados continuam de fora, mesmo filtro da tela) — e
abre direto a caixa de impressão do navegador/celular, sem precisar sair do app nem chamar o
servidor de novo (usa os dados já carregados na tela).

## Dois bugs encontrados e corrigidos durante o teste real (Chromium)

Testei clicando de verdade no botão (não só chamando a função), gerando o PDF e conferindo o
resultado — encontrei e corrigi dois problemas antes de fechar:

1. **A lista não aparecia na impressão.** A tela "Gerador de proposta" já tem seu próprio filtro
   de impressão (só mostra o papel da proposta) e ele "ganhava" do filtro novo. Corrigido dando
   prioridade explícita pro filtro da lista de clientes.
2. **Sobrava uma folha em branco depois da lista.** O jeito de esconder o resto do app na hora de
   imprimir mantinha o espaço reservado na página. Corrigido pra tirar esse espaço de vez —
   confirmei gerando o PDF de verdade e contando as páginas (1 página, sem sobra).

Também isolei o filtro de impressão da lista atrás de uma marca que só liga durante ESSA
impressão específica, pra nunca brigar com a impressão da Proposta numa próxima vez.

## Testes

- `tests/v1064-imprimir-lista-clientes-ativos.test.mjs` (novo).
- Testado num navegador de verdade (Chromium/Playwright): cliquei no botão real na tela, conferi
  que só clientes ativos aparecem (um lead "Vendido" de teste ficou de fora), que o nome do
  cliente não vira código malicioso na tela (testei um nome com `<script>` — apareceu como texto
  puro), e gerei o PDF final confirmando 1 página, sem folha em branco.
- `npm test`: suíte inteira verde.

## Arquivos

`app.js` (`imprimirCarteiraAtiva`, botão na tela "Carteira ativa"), `styles.css` (folha de
impressão, escopada por `body.cp1064-imprimindo`), `tests/v1064-imprimir-lista-clientes-ativos.test.mjs`
(novo), `package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1064.md`, versão
**1063 → 1064**.
