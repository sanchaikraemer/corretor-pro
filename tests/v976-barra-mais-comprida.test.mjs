import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v976 — pedido do dono depois de ver as prévias da v975: "não é maior a fonte... é só a barra
// mais comprida". Só o comprimento do track (chr-track) aumenta; o número ao lado (chr-bar b)
// continua no MESMO tamanho de sempre (11px/900) — não pode crescer junto por engano.
// v978 — o dono achou que os 92px da v976 ainda ficaram pequenos ("MAIORES HORIZONTALMENTE") —
// aumentado de novo pra 180px (desktop) / 190px (mobile). Os valores abaixo já refletem a v978;
// ver tests/v978-produto-curto-barra-maior.test.mjs pro detalhe completo dessa 2ª rodada.

assert.match(app, /\.cp-hoje-row \.chr-track\{width:180px;height:7px/, 'barra (desktop) continua mais comprida (180px na v978), altura continua 7px (não pediu mais grossa)');
assert.match(app, /\.cp-hoje-row \.chr-track\{width:190px\}/, 'barra (mobile) continua mais comprida (190px na v978)');
assert.match(app, /\.cp-hoje-row \.chr-bar b\{font-size:11px;font-weight:900;min-width:20px/, 'o número ao lado da barra continua com a MESMA fonte de sempre (11px/900) — só a barra cresceu');

// A coluna do grid que reserva espaço pra barra cresceu junto (senão a barra maior brigaria com
// o número/dias). A coluna "pr" (produto) ENCOLHEU na v978 (1.3fr→.7fr) — o texto ficou bem mais
// curto (produtosLabelCurto), sobrando espaço pra "bar" crescer ainda mais sem espremer nada.
assert.match(app, /grid-template-columns:10px minmax\(0,1\.05fr\) minmax\(0,\.7fr\) 240px 42px/, 'coluna "bar" do grid cresceu de novo (144px→240px) e "pr" encolheu (1.3fr→.7fr) na v978');

console.log('v976-barra-mais-comprida: ok');
