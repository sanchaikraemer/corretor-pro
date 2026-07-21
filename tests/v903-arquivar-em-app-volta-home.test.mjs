import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v903 — arquivar um lead (a) trocava o confirm por uma "tela feia" nativa do navegador,
// (b) não avisava e reabria o lead em vez de voltar pra home, e (c) o arquivado continuava
// aparecendo na busca. Agora: confirmação em-app, some da busca/listas na hora e volta pra home.

// 1. Existe a confirmação em-app cp903Confirm (Promise<boolean>).
assert.match(app, /function cp903Confirm\(opts\)\{/, 'cp903Confirm existe');
assert.match(app, /window\.cp903Confirm = cp903Confirm/, 'cp903Confirm exposta');
assert.match(css, /\.cp903-backdrop\{/, 'CSS do modal em-app presente');

// 2. O fluxo de saída (arquivar/perder/vender) usa cp903Confirm, não mais o confirm() nativo
//    como caminho principal, e trata os três estados como "saiDaLista".
const fn = app.match(/async function ui683MoverEtapaComEvento\(id, etapa, label, evento\)\{[\s\S]*?\n  \}/)[0];
assert.match(fn, /const saiDaLista = etapa === 'Geladeira' \|\| etapa === 'Perdido' \|\| etapa === 'Vendido';/,
  'estados de saída identificados');
assert.match(fn, /await cp903Confirm\(/, 'usa a confirmação em-app');
assert.match(fn, /Ele sai das prioridades e da busca/, 'a mensagem de arquivar cita a busca');

// 3. Ao sair da lista: remove dos caches (some da busca), fecha o lead e volta pra home,
//    com toast — E dá return ANTES de reabrir o lead.
const bloco = fn.match(/if\(saiDaLista\)\{[\s\S]*?return;\s*\n      \}/)[0];
assert.match(bloco, /removerLeadDosCaches\(id\)/, 'remove o arquivado dos caches na hora');
assert.match(bloco, /show\('home'\)/, 'volta pra home');
assert.match(bloco, /state\.lead = null/, 'fecha o lead aberto');
assert.match(bloco, /toast\(/, 'avisa que arquivou');
// o return de saiDaLista aparece ANTES da reabertura abrirLead(id) do fluxo normal.
assert.ok(fn.indexOf('return;') < fn.indexOf('await abrirLead(id)'),
  'sai antes de reabrir o lead — não fica preso na tela do lead');

// 4. As buscas continuam excluindo arquivados/perdidos (foraDaBusca).
assert.match(app, /function foraDaBusca\(l\)\{ const e = normalizarEtapa\(l\?\.etapa\); return e === "Geladeira" \|\| e === "Perdido"; \}/,
  'foraDaBusca exclui Geladeira e Perdido');
const busca = app.match(/function buscaLeadInline\(termo, boxId\)\{[\s\S]*?\n\}/)[0];
assert.match(busca, /!foraDaBusca\(l\)/, 'a busca inline exclui arquivados');

console.log('v903-arquivar-em-app-volta-home: ok');
