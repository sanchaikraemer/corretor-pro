import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v902 — o link "Últimos atendimentos" da home abria "Fazer agora" (o dono lia como "atender
// agora"). Causa: chamava setPipelineTab("ultimos"), função do pipeline ANTIGO que o Condução
// (cp788) não usa; o pipeline novo caía no filtro padrão. Agora abre a lista real de atendidos.

// 1. O botão da home aponta pra abrirUltimosAtendimentos, não mais pro setPipelineTab morto.
assert.match(app, /onclick='abrirUltimosAtendimentos\(\)'>Últimos atendimentos<\/button>/,
  'o link "Últimos atendimentos" chama abrirUltimosAtendimentos');
assert.doesNotMatch(app, /setPipelineTab\("ultimos"\);show\("pipeline"\)/,
  'não usa mais o setPipelineTab do pipeline antigo');

// 2. abrirUltimosAtendimentos filtra quem tem atendimento e ordena do mais recente pro antigo.
const fn = app.match(/function abrirUltimosAtendimentos\(\)\{[\s\S]*?\n\}/)[0];
let capturado = null;
const abrirUltimosAtendimentos = eval(`
  const state = { gruposHome: { todos: [
    { id:'a', name:'Ana',  __ts: 300 },
    { id:'b', name:'Bia',  __ts: 0   },  // sem atendimento → fora
    { id:'c', name:'Cida', __ts: 900 },
    { id:'d', name:'Duda', __ts: 100 },
  ] } };
  const ultimoAtendimentoTs = (l) => l.__ts;
  const abrirGrupoHome = (grupo, options) => { capturado = { grupo, options }; };
  ${fn}
  abrirUltimosAtendimentos;
`);
abrirUltimosAtendimentos();
assert.equal(capturado.grupo, '__ultimos', 'abre como grupo avulso __ultimos');
assert.equal(capturado.options.meta.titulo, 'Últimos atendimentos', 'título correto');
const nomes = capturado.options.leads.map(l => l.name);
assert.deepEqual(nomes, ['Cida', 'Ana', 'Duda'], 'ordena do mais recente pro mais antigo, sem os sem-atendimento');

console.log('v902-ultimos-atendimentos-abre-lista: ok');
