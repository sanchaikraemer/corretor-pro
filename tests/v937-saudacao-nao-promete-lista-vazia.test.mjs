import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v937 — dois pedidos/reclamações do dono:
//
// 1) "Cadê a última mensagem?" — a v934 tinha removido a metalinha "Última mensagem" do
// cabeçalho do lead (a pedido dele mesmo, na hora), mas ela é informação que falta de verdade:
// saber se o cliente respondeu DEPOIS da última análise. Voltou.
//
// 2) A saudação da Home. v942 — o dono mandou remover o card amarelo e SEMPRE mostrar os leads do
// dia. Como a Home agora sempre puxa da fila ranqueada completa, "de cima pra baixo" volta a ser
// verdade; a saudação mostra o número REAL que aparece na lista = min(meta, elegíveis na fila),
// pra não prometer mais leads do que a lista exibe.

// 1. "Última mensagem" está de volta no cabeçalho do lead.
const iniFoco = app.indexOf('function renderLeadFoco(lead){');
const fimFoco = app.indexOf('\nfunction ', app.indexOf('cp7ObsStatus', iniFoco));
const foco = app.slice(iniFoco, fimFoco);
assert.match(foco, /const ultimaMsgReal=\(typeof cp786UltimaMensagemReal==='function'\)\?cp786UltimaMensagemReal\(lead\):null;/,
  'deve calcular a última mensagem real de novo');
assert.match(foco, /Última mensagem — \$\{ultimaMsgEm\}/, '"Última mensagem" precisa voltar a aparecer');
assert.match(foco, /Última análise — \$\{analiseEm\}/, '"Última análise" continua aparecendo (não foi tocada)');

// 2. renderSaudacao mostra o número real da lista (naLista = min(meta, fila)) e não promete mais
// uma lista vazia. O card "nenhum lead prioritário" não é mais referenciado.
const iniSaud = app.indexOf('function renderSaudacao(items){');
const fimSaud = app.indexOf('\nfunction ', iniSaud + 1);
const saud = app.slice(iniSaud, fimSaud);
assert.match(saud, /const naLista ?= ?Math\.min\(acaoMostrada, ?filaLen\)/,
  'a saudação usa o número real da lista (min entre a meta e os elegíveis na fila)');
assert.match(saud, /naLista > 0[\s\S]*?lead\$\{naLista>1\?"s":""\} pra atender hoje/,
  'com leads na fila, a frase é "N leads pra atender hoje"');
assert.doesNotMatch(saud, /nenhum lead prioritário pelas regras/, 'a saudação não fala mais em "nenhum lead prioritário"');

console.log('v937-saudacao-nao-promete-lista-vazia: ok');
