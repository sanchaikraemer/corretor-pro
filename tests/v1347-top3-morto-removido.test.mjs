import fs from "node:fs";
import assert from "node:assert/strict";

// v1347 — O "TOP 3 DO DIA" SAIU DO APP. ERA CÓDIGO MORTO.
//
// Pedido do dono, 21/08/2026: "apara código morto da régua antiga q não aparece."
//
// O que era: um bloco de três cartõezinhos no topo da tela inicial, ordenados pela régua antiga
// (compromisso vencido > retorno de hoje > negociação em aberto > ...). Ele parou de aparecer
// quando a Home passou a montar a própria lista do dia — a partir daí NADA voltou a preencher
// `state.top3`, então a função que desenhava os cartões nunca mais foi chamada. Sobrou o pior dos
// mundos: dois contêineres vazios no HTML, um punhado de regras de estilo, um atalho de teclado
// (1/2/3) procurando cartões que não existem, e CINCO lugares diferentes do código gastando linha
// pra esconder à força coisa que já não aparecia.
//
// O QUE NÃO FOI MEXIDO, E É O PONTO: a régua antiga continua inteira onde ela APARECE de verdade —
// a ordem da tela de Relatório, a coluna extra da planilha exportada e a divisão da Home em grupos
// (Ação hoje / Retomar / Aguardando...). Aparar código morto não pode virar desculpa pra mudar o
// que o corretor vê.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

// O comentário que EXPLICA a remoção cita os nomes removidos — de propósito, pra quem abrir o
// arquivo daqui a um ano entender o que existiu ali. As conferências abaixo olham só o código.
const appCodigo = app.replace(/^\s*\/\/.*$/gm, "");

// ── 1. O bloco morto não existe mais em lugar nenhum ─────────────────────────────────────────
for (const [nome, fonte] of [["app.js", appCodigo], ["index.html", html], ["styles.css", css]]) {
  assert.ok(!/top3Area|filaPrioridade|top3-mini/.test(fonte),
    `${nome} ainda tem restos do Top 3 (contêiner ou estilo) — o bloco todo tinha que sair junto`);
}
assert.ok(!/function renderTop3\b|abrirLeadTop3/.test(appCodigo),
  "a função que desenhava os três cartões e o clique dela não podem continuar no arquivo");
assert.ok(!/state\.top3/.test(appCodigo),
  "não pode sobrar leitura de state.top3 — era ela que nunca era preenchida");
assert.ok(!/\bqsa\(["']\.top3-mini["']\)/.test(appCodigo),
  "o atalho de teclado 1/2/3 procurava cartão que não existe mais");

// ── 2. Os enfeites que só viviam lá dentro saíram junto ─────────────────────────────────────
// ⏳ "esfriando" e 🏠 "permuta" como TAG só apareciam no Top 3. Deixar função sem chamador é
// exatamente o tipo de coisa que este pedido mandou aparar.
for (const morto of ["ehEsfriando", "tagEsfriandoHTML", "tagPermutaHTML"]) {
  assert.equal((appCodigo.match(new RegExp(`\\b${morto}\\b`, "g")) || []).length, 0,
    `${morto} só era usada pelo Top 3 — sem ele, virou função sem chamador`);
}
// Mas ehPermuta CONTINUA: ela é usada em outros dois lugares que aparecem na tela.
assert.ok((appCodigo.match(/\behPermuta\b/g) || []).length >= 3,
  "ehPermuta não podia ser apagada junto — ela ainda decide trava externa e categoria do lead");

// ── 3. A tela inicial continua inteira ───────────────────────────────────────────────────────
// O nome `top3Html` é herança: hoje ele é a LISTA DO DIA, a que o dono vê todo dia de manhã.
// Se sumir, a Home fica vazia — é a checagem que impede um "apara isso também" de ir longe demais.
assert.match(app, /<div class="home-m1-list">\$\{top3Html\}<\/div>/,
  "a lista do dia da Home tem que continuar sendo desenhada");
assert.match(app, /let top3Html;/, "e a variável que a monta continua com o nome que os testes usam");
assert.match(app, /Atenção ao nome: top3Html é a LISTA DO DIA/,
  "com o aviso escrito ali, pra ninguém confundir de novo com o bloco removido");

// ── 4. A régua antiga continua viva onde ela aparece ────────────────────────────────────────
assert.match(app, /function filaPorFatos\(f = \{\}\)\{/,
  "a régua de compromisso não podia sair: ela ainda ordena o Relatório e classifica os grupos da Home");
assert.match(app, /const \{ nivel, grupo, titulo \} = filaPorFatos\(\{/,
  "e continua ligada ao cálculo de prioridade de atendimento");
assert.match(app, /prioridadeTituloCurto\(l\) : ""/,
  "a coluna extra da planilha exportada continua saindo dela");

// ── 5. Nenhuma regra de estilo VIVA foi levada junto ────────────────────────────────────────
// As regras do Top 3 moravam grudadas em regras de outros blocos (cartões do Menu, itens do
// resumo do dia). Recortar errado ali quebraria tela que aparece — daí esta conferência.
for (const vivo of [
  ".menu-card:hover{border-color:var(--accent-line)}",
  ".msg-tab.active,.nav.active{",
  ".card:hover,.menu-card:hover{box-shadow:",
  "button,.card,.menu-card,.resumo-dia .item,.sb-brand{"
]) {
  assert.ok(css.includes(vivo), `a regra de estilo "${vivo}" precisa continuar existindo`);
}
assert.match(css, /body\.lead-foco-aberto #home #cpMesResumo,/,
  "a lista de blocos que somem com o cliente aberto continua de pé, só sem os dois contêineres mortos");
// Chaves batendo: recorte de CSS que come um "}" derruba metade da folha de estilo em silêncio.
assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length,
  "abre e fecha chaves do CSS têm que bater — recorte torto aqui apaga estilo de tela que aparece");

console.log("v1347-top3-morto-removido: ok");
