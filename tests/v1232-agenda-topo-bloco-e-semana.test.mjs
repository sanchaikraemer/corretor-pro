import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v1232 — duas escolhas do dono (12/08/2026):
// (1) Tela Agenda modelo 4: FAIXA DA SEMANA no topo (7 dias com quantidade; tocar filtra o dia).
// (2) Topo modelo C: BLOCO ÚNICO com calendário (total da agenda) + sino (agenda de hoje),
//     no lugar do card "Agenda" da Home e do sino solto com pontinho.
// E ainda: o avatar do topo saiu do degradê âmbar/marrom — nenhuma cor fora da paleta.

// --- Bloco do topo ---
assert.match(html, /id="cpAgendaBloco"/, 'o bloco único da agenda precisa existir no topo');
assert.match(html, /id="cpAgTotalN"/, 'o calendário do bloco mostra o TOTAL (#cpAgTotalN)');
assert.match(html, /id="cpAgHojeN"/, 'o sino do bloco mostra a agenda de HOJE (#cpAgHojeN)');
assert.match(html, /id="btnAgendaTotalTopo"[^>]*onclick="show\('agenda'\)"/, 'o calendário abre a tela Agenda');
assert.match(html, /id="topBell"[^>]*onclick="show\('agenda'\)"/, 'o sino continua abrindo a tela Agenda');

// O sino usa classes próprias (cp-hoje-*) — as antigas tem-alerta/tem-atraso têm CSS legado com
// !important que atropelaria o desenho novo (a mesma doença da lição v1077→v1078).
const iniBell = app.indexOf('function updateBell(){');
assert.ok(iniBell !== -1, 'updateBell não encontrada');
const bellSrc = app.slice(iniBell, app.indexOf('window.cpAtualizarSinoAtencao', iniBell));
assert.match(bellSrc, /cp-hoje-alerta/, 'sino acende com cp-hoje-alerta (ciano da agenda)');
assert.match(bellSrc, /cp-hoje-atraso/, 'sino acende com cp-hoje-atraso (vermelho de risco)');
assert.doesNotMatch(bellSrc, /classList\.toggle\('tem-alerta'/, 'não pode voltar a aplicar tem-alerta (CSS legado com !important)');
assert.match(css, /#topBell\.cp-hoje-alerta\{background:var\(--acao-soft\)!important/, 'metade de hoje acesa em ciano (--acao) da paleta');
assert.match(css, /#topBell\.cp-hoje-atraso\{background:var\(--risco-soft\)!important/, 'atraso em vermelho (--risco) da paleta');

// --- Faixa da semana na tela Agenda ---
assert.match(app, /class="cp-ag-semana"/, 'a faixa da semana precisa ser desenhada na Agenda');
assert.match(app, /function cpAgendaFiltrarDia\(v\)\{/, 'tocar num dia filtra a tela (cpAgendaFiltrarDia)');
assert.match(app, /window\.cpAgendaFiltrarDia = cpAgendaFiltrarDia/, 'a função precisa estar no window (onclick inline)');
assert.match(app, /cpAgendaFiltrarDia\('atrasados'\)/, 'a faixa tem o atalho de Atrasados');
assert.match(app, /cpAgendaFiltrarDia\(null\)/, 'a faixa tem o "Tudo" pra voltar ao normal');
// O dia é calculado no fuso de São Paulo, como o resto do app.
const iniAg = app.indexOf('async function carregarAgenda(){');
const agSrc = app.slice(iniAg, app.indexOf('window.carregarAgenda', iniAg));
assert.match(agSrc, /America\/Sao_Paulo/, 'a faixa da semana usa o fuso de São Paulo');

// --- Avatar dentro da paleta ---
assert.ok(!css.includes('#efb28c') && !css.includes('#8b5d4a'),
  'o degradê âmbar/marrom do avatar saiu — nenhuma cor pode fugir da paleta');
assert.match(css, /\.cp-profile span\{[^}]*var\(--cp-coral/, 'o avatar usa o coral da marca');

console.log('v1232-agenda-topo-bloco-e-semana: ok');
