import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v865: a Home piscava — a versão "rica" (renderBotoesHome) aparecia no boot e a lista enxuta
// do cp788 (window.renderListasHome) a substituía. O override do cp788 agora chama
// renderBotoesHome() em vez de montar a enxuta, então boot e dashboard pintam a mesma tela.

const ini = app.indexOf('window.renderListasHome=function(ordenados){');
assert.ok(ini !== -1, 'não localizei o override cp788 de renderListasHome');
const fim = app.indexOf('try{ renderListasHome=window.renderListasHome; }', ini);
assert.ok(fim !== -1 && fim > ini, 'não localizei o fim do override cp788');
const corpo = app.slice(ini, fim);

// Passou a delegar pra tela rica...
assert.match(corpo, /renderBotoesHome\(\)/, 'o override precisa chamar renderBotoesHome() (tela rica)');
// ...e não pode mais montar a lista enxuta que causava o piscar.
assert.doesNotMatch(corpo, /ui-priority-list/, 'o override não pode mais montar a lista enxuta (ui-priority-list)');
assert.doesNotMatch(corpo, /cp788LinhaConducao/, 'o override não pode mais renderizar linhas da enxuta');
// A guarda de subtela (lead/grupo aberto) tem que continuar antes de repintar.
assert.match(corpo, /if\(state\.grupoAtivo\|\|state\.focoLeadId\|\|state\.lead\?\.id\)\s*return;/, 'a guarda de subtela precisa continuar');

console.log('v865-home-sem-piscar: ok');
