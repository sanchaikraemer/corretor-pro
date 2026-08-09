import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v866: o painel "Visão geral da carteira" (cp-dashboard) estava com fontes de 6–8px no
// desktop, quase ilegíveis. Um bloco @media(min-width:1000px) sobe essas fontes.

// Ancora no MEU bloco (há outros @media(min-width:1000px) antes no arquivo).
const start = css.indexOf('Desempenho legível no desktop');
assert.ok(start !== -1, 'não achei o comentário do bloco Desempenho legível');
const m = css.slice(start).match(/@media\(min-width:1000px\)\{[\s\S]*?\n\}/);
assert.ok(m, 'precisa existir o bloco @media(min-width:1000px) do Desempenho legível');
const bloco = m[0];

// Amostras das fontes que eram minúsculas — agora precisam estar em tamanho legível (>=10px).
const checa = (sel, min) => {
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{font-size:([\\d.]+)px');
  const mm = bloco.match(re);
  assert.ok(mm, `o bloco precisa ajustar ${sel}`);
  assert.ok(Number(mm[1]) >= min, `${sel} deveria ser >= ${min}px (ficou ${mm[1]}px)`);
};
// v1186 — `.cp-metric` (os antigos "tiles" de métrica do painel) saiu do CSS na faxina da
// auditoria de 09/08/2026: nenhuma tela do app cita essa classe. O painel de Desempenho de hoje é
// montado com `.cp-card-head` / `.cp-table-head` / `.cp-running-row`, que continuam conferidos
// abaixo. A regra da v866 — fonte legível no desktop — segue valendo pro que existe.
assert.doesNotMatch(css, /\.cp-metric\b/, 'os tiles antigos de métrica não voltam (ninguém os desenha)');
checa('.cp-table-head', 10);
checa('.cp-running-row', 11);
checa('.cp-card-head h3', 13);

console.log('v866-desempenho-legivel: ok');
