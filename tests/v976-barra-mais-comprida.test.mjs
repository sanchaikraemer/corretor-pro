import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v976 — pedido do dono depois de ver as prévias da v975: "não é maior a fonte... é só a barra
// mais comprida". Só o comprimento do track (chr-track) aumenta; o número ao lado (chr-bar b)
// continua no MESMO tamanho de sempre (11px/900) — não pode crescer junto por engano.
// v978 — o dono achou que os 92px da v976 ainda ficaram pequenos ("MAIORES HORIZONTALMENTE") —
// aumentado de novo pra 180px (desktop) / 190px (mobile). Os valores abaixo já refletem a v978;
// ver tests/v978-produto-curto-barra-maior.test.mjs pro detalhe completo dessa 2ª rodada.
//
// v1021 — no celular, um nome de produto mais longo (coluna "pr", que divide espaço com "bar"
// nessa tela) podia deixar menos de 190px pra barra, que não encolhia (flex:0 0 auto) e vazava
// por cima do texto do produto. A barra do CELULAR virou responsiva (flex, encolhe até 40px de
// base/30px mínimo) — continua "comprida" quando cabe, mas cede espaço em vez de sobrepor texto.
// O desktop (linha abaixo) não tem esse problema (coluna "bar" própria de 240px) e não mudou.

assert.match(app, /\.cp-hoje-row \.chr-track\{width:180px;height:7px/, 'barra (desktop) continua mais comprida (180px na v978), altura continua 7px (não pediu mais grossa)');
assert.match(app, /\.cp-hoje-row \.chr-track\{width:auto;flex:1 1 40px/, 'barra (mobile) virou responsiva na v1021 (não fixa mais em 190px, pra não sobrepor o produto)');
assert.match(app, /\.cp-hoje-row \.chr-bar b\{font-size:11px;font-weight:900;min-width:20px/, 'o número ao lado da barra continua com a MESMA fonte de sempre (11px/900) — só a barra cresceu');

// A coluna do grid que reserva espaço pra barra cresceu junto (senão a barra maior brigaria com
// o número/dias). A coluna "pr" (produto) ENCOLHEU na v978 (1.3fr→.7fr) — o texto ficou bem mais
// curto (produtosLabelCurto), sobrando espaço pra "bar" crescer ainda mais sem espremer nada.
// v1345 — a ÚLTIMA coluna (dias) saiu de 42px pra 104px: o texto "atendido há 100d" precisa de
// 97px e estava vazando pra esquerda, por cima do número da barra (print do dono, 21/08/2026).
// O que este teste guarda é o que ele sempre guardou: a coluna da BARRA continua com 240px e a do
// produto continua em .7fr. A largura da coluna dos dias é conferida em v1345.
assert.match(app, /grid-template-columns:minmax\(0,1\.05fr\) minmax\(0,\.7fr\) 240px \d+px/, 'coluna "bar" do grid cresceu de novo (144px→240px) e "pr" encolheu (1.3fr→.7fr) na v978');

console.log('v976-barra-mais-comprida: ok');
