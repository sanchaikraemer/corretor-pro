import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v865: no cabeçalho do lead, uma linha "Última análise — data" volta a aparecer LOGO ACIMA
// de "Última mensagem — data", no mesmo formato. Representa quando foi feita a última
// análise/reanálise do cliente. As duas linhas ficam em negrito.

// --- 1) Comportamento do seletor de data da última análise. ---
const ini = app.indexOf('function cp865UltimaAnaliseISO(lead, a){');
const fim = app.indexOf('function renderLeadFoco(lead){');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'não localizei cp865UltimaAnaliseISO');
// eslint-disable-next-line no-new-func
const { cp865UltimaAnaliseISO } = new Function(
  app.slice(ini, fim) + '\nreturn { cp865UltimaAnaliseISO };'
)();

// Reanálise é a análise mais recente → tem prioridade sobre a geração original.
assert.equal(
  cp865UltimaAnaliseISO({ updatedAt: '2026-04-01T10:00:00Z' }, { reanalisadoEm: '2026-06-01T10:00:00Z', geradoEm: '2026-05-01T10:00:00Z' }),
  '2026-06-01T10:00:00Z',
  'reanalisadoEm precisa ter prioridade'
);
// Sem reanálise, usa a data de geração da análise.
assert.equal(
  cp865UltimaAnaliseISO({ updatedAt: '2026-04-01T10:00:00Z' }, { geradoEm: '2026-05-01T10:00:00Z' }),
  '2026-05-01T10:00:00Z',
  'geradoEm é o fallback quando não houve reanálise'
);
// Sem carimbo próprio da análise, cai na última atualização do lead.
assert.equal(
  cp865UltimaAnaliseISO({ updatedAt: '2026-04-01T10:00:00Z' }, {}),
  '2026-04-01T10:00:00Z',
  'sem data na análise, usa updatedAt do lead'
);
// Sem nenhuma data disponível → string vazia (não inventa data).
assert.equal(cp865UltimaAnaliseISO({}, {}), '', 'sem dado nenhum, retorna vazio');

// --- 2) A linha "Última análise" é renderizada ACIMA de "Última mensagem". ---
const idxAnalise = app.indexOf('Última análise — ');
const idxMensagem = app.indexOf('Última mensagem — ');
assert.ok(idxAnalise !== -1, 'o template precisa render "Última análise — data"');
assert.ok(idxMensagem !== -1, 'o template ainda precisa ter "Última mensagem — data"');
assert.ok(idxAnalise < idxMensagem, '"Última análise" precisa vir acima de "Última mensagem"');

// --- 3) As duas linhas ficam em negrito (mesma classe .cp704-metaline). ---
const regra = app.match(/\.cp704-metaline\{[^}]*\}/);
assert.ok(regra, 'a regra .cp704-metaline precisa existir');
assert.match(regra[0], /font-weight:700/, 'as linhas de meta precisam estar em negrito');

console.log('v865-ultima-analise: ok');
