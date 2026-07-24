import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v976 — pedido do dono depois de ver as prévias da v975: "não é maior a fonte... é só a barra
// mais comprida". Só o comprimento do track (chr-track) aumenta; o número ao lado (chr-bar b)
// continua no MESMO tamanho de sempre (11px/900) — não pode crescer junto por engano.

assert.match(app, /\.cp-hoje-row \.chr-track\{width:92px;height:7px/, 'barra (desktop) fica mais comprida (92px), altura continua 7px (não pediu mais grossa)');
assert.match(app, /\.cp-hoje-row \.chr-track\{width:130px\}/, 'barra (mobile) fica mais comprida (130px) na mesma proporção');
assert.match(app, /\.cp-hoje-row \.chr-bar b\{font-size:11px;font-weight:900;min-width:20px/, 'o número ao lado da barra continua com a MESMA fonte de sempre (11px/900) — só a barra cresceu');

// A coluna do grid que reserva espaço pra barra cresceu junto (senão a barra maior brigaria com
// o número/dias) — mas as OUTRAS colunas (dot/nm/pr/dd) continuam do mesmo tamanho.
assert.match(app, /grid-template-columns:10px minmax\(0,1\.05fr\) minmax\(0,1\.3fr\) 144px 42px/, 'coluna "bar" do grid cresceu (116px→144px) pra caber a barra maior');

console.log('v976-barra-mais-comprida: ok');
