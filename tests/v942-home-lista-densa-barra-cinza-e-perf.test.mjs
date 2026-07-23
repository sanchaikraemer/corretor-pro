import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

// v942 — reforma da Home + performance, tudo a pedido do dono:
//  1) Some o card amarelo "Nenhum lead prioritário"; a Home SEMPRE mostra os leads do dia numa
//     lista compacta, 1 coluna, sem quebra lateral.
//  2) Cada linha ganha a barra de status das mensagens do cliente (Modelo A: barra + número,
//     cor por nível — cinza/coral, nunca amarelo).
//  3) O amarelo queimado (--morno #F5C36B e hardcodes) vira cinza claro no app todo.
//  4) "0 mensagens do cliente" com lead antigo: some a janela de 90 dias, conta o total real.
//  5) Performance: service worker serve os assets do cache na hora (stale-while-revalidate).

// 1. Linha densa + barra existem e renderizam os campos certos.
const rowFn = app.match(/function cpHomeLeadRow\(l, ?pos, ?maxMsgs\)\{[\s\S]*?\n\}/);
assert.ok(rowFn, 'cpHomeLeadRow não encontrada');
assert.match(rowFn[0], /class="cp-hoje-row"/, 'linha usa a classe da lista compacta');
assert.match(rowFn[0], /cpBarraMensagensMini\(l, ?maxMsgs\)/, 'a linha inclui a barra de mensagens (relativa ao maior da lista)');
assert.match(rowFn[0], /chr-nm[\s\S]*chr-pr[\s\S]*chr-dd/, 'linha tem nome, produto e dias');

const barFn = app.match(/function cpBarraMensagensMini\(l, ?maxMsgs\)\{[\s\S]*?\n\}/);
assert.ok(barFn, 'cpBarraMensagensMini não encontrada');
assert.match(barFn[0], /mensagensDoCliente\(l\)/, 'a barra usa a contagem de mensagens do cliente');
assert.match(barFn[0], /n >= 15 \? '#ff6258' : n >= 5 \? '#ff8f88' : '#8a99a0'/, 'cor por nível: cinza (baixo) → coral (alto), sem amarelo');
assert.match(barFn[0], /n \/ teto \* 100/, 'a barra enche relativa ao maior da lista (não satura com contagens altas)');

// CSS da lista: 1 coluna (sem quebra lateral), com layout mobile de 2 linhas.
assert.match(app, /\.cp-hoje-list\{display:flex;flex-direction:column/, 'lista compacta é uma coluna (flex column)');
assert.match(app, /\.cp-hoje-row\{width:100%;display:grid/, 'cada linha ocupa a largura toda');
assert.match(app, /grid-template-areas:"dot nm dd" "dot bar pr"/, 'no mobile a linha vira 2 linhas (nome em cima, barra+produto embaixo)');

// 2. lista-leads-grid (tela expandida do "Fazer agora") = 1 coluna sempre, sem 2/3 colunas.
assert.match(css, /\.lista-leads-grid\{display:grid;grid-template-columns:1fr;gap:8px\}/, 'lista-leads-grid é 1 coluna');
assert.doesNotMatch(css, /\.lista-leads-grid\{grid-template-columns:repeat\(2/, 'não volta pra 2 colunas em tela larga');

// 3. Amarelo queimado removido: o token --morno não é mais o amarelo #F5C36B.
assert.doesNotMatch(css, /--morno:#F5C36B/, 'o token --morno não é mais amarelo queimado');
assert.match(css, /--morno:#B8C2C9/, 'o token --morno virou cinza claro');
// hardcodes amarelos que apareciam na Home/lead sumiram.
assert.doesNotMatch(css, /rgba\(255,\s*155,\s*59/, 'sem laranja/âmbar hardcoded no CSS');
assert.doesNotMatch(css, /rgba\(245,\s*195,\s*107/, 'sem âmbar hardcoded no CSS');

// 4. mensagensDoCliente conta o total (sem janela) e prefere a contagem do servidor na lista.
const mdc = app.match(/function mensagensDoCliente\(l\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(mdc, /janelaDias|CP_JANELA_INTERESSE_DIAS/, 'sem janela de 90 dias na contagem');
assert.match(mdc, /const stored = Number\(l\?\.clientMessageCount\)/, 'na lista usa clientMessageCount do servidor');
// servidor manda clientMessageCount, também sem janela.
assert.match(persistence, /clientMessageCount,/, 'o item da lista carrega clientMessageCount');
const persBlock = persistence.slice(persistence.indexOf('let clientMessageCount = 0;'), persistence.indexOf('const lastClientIso'));
assert.doesNotMatch(persBlock, /_janela90ms|90 \* 86400000/, 'servidor conta o total, sem janela de 90 dias');

// 5. Performance: service worker com stale-while-revalidate pros assets estáticos.
assert.match(sw, /async function staleWhileRevalidate\(request\)/, 'service worker tem staleWhileRevalidate');
assert.match(sw, /event\.respondWith\(staleWhileRevalidate\(event\.request\)\)/, 'assets estáticos usam cache-primeiro (SWR)');
assert.match(sw, /const cached = await cache\.match\(request\)[\s\S]*?return cached \|\|/, 'SWR devolve o cache na hora e revalida por trás');

console.log('v942-home-lista-densa-barra-cinza-e-perf: ok');
