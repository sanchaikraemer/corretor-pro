import fs from 'fs';
import assert from 'node:assert/strict';

// Teste de UI / consistência de versão — INDEPENDENTE do número da versão.
// Em vez de fixar "v657" no código (o que apodrecia a cada bump), este teste
// descobre a versão canônica do RESTORE_POINTS.md (mesma regra do build.js) e
// exige que todos os arquivos espelhados estejam batendo com ela.
const read = (f) => fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8');

// Versão canônica = maior "## Ponto #NNN" no RESTORE_POINTS.md.
const rp = read('RESTORE_POINTS.md');
const nums = [...rp.matchAll(/^##\s*Ponto\s*#(\d{3})/gm)].map((m) => parseInt(m[1], 10));
assert.ok(nums.length, 'RESTORE_POINTS.md sem nenhum "## Ponto #NNN"');
const VERSION = String(Math.max(...nums)).padStart(3, '0');

const html = read('index.html');
const app = read('app.js');
const sw = read('service-worker.js');
const pkg = JSON.parse(read('package.json'));

// 1) Versão consistente entre os arquivos espelhados (a regra do CLAUDE.md).
assert.ok(
  sw.includes(`corretor-pro-static-v${VERSION}-`),
  `service-worker.js: o cache precisa ser corretor-pro-static-v${VERSION}- (sem isso o PWA não atualiza)`
);
assert.equal(
  pkg.version,
  `${VERSION}.0.0`,
  `package.json version precisa ser ${VERSION}.0.0 (está ${pkg.version})`
);

// 2) index.html e app.js usam o placeholder __VERSION__ (o build.js substitui).
assert.ok(html.includes('Atualização #__VERSION__'), 'index.html sem "Atualização #__VERSION__"');
assert.ok(app.includes('service-worker.js?v=__VERSION__'), 'app.js sem registro versionado do service worker');

// 3) Nada de IDs duplicados no HTML (quebra JS que usa getElementById).
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
assert.deepEqual(dup, [], `IDs duplicados no index.html: ${dup.join(', ')}`);

// 4) Regressão #661: renderProcessedResult tem que estar protegida por try/catch,
//    senão um erro ao montar a tela vira trava fantasma silenciosa.
const ini = app.indexOf('async function renderProcessedResult');
assert.ok(ini !== -1, 'renderProcessedResult não encontrada em app.js');
const corpo = app.slice(ini, app.indexOf('async function acharLeadExistente', ini));
assert.ok(
  /\btry\s*\{/.test(corpo) && /\}\s*catch\s*\(/.test(corpo),
  'renderProcessedResult precisa estar dentro de try/catch (regressão #661 — trava fantasma)'
);

console.log(`Teste UI: OK — versão ${VERSION} consistente, placeholders, IDs únicos e guarda try/catch validados.`);
