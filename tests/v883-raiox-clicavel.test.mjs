import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v883 — o "Raio-X da carteira" mostrava números ("37 clientes...", "13 conversas
// longas...", "Parada de maior valor: Sara") mas sem clique: não dava pra ver QUEM eram.
// Agora cada linha é um botão que abre a lista exata daqueles leads (drill-down).

const ini = app.indexOf('function insightFocoHTML(items, esquecidos){');
assert.ok(ini !== -1, 'insightFocoHTML precisa existir');
const corpo = app.slice(ini, app.indexOf('\nfunction temVisitaLead', ini));

// 1. As três linhas do Raio-X carregam ação de clique.
assert.match(corpo, /abrirRaioX\('gargalo'/, 'linha do gargalo deve abrir a lista via abrirRaioX');
assert.match(corpo, /abrirRaioX\('longas'/, 'linha de conversas longas deve abrir a lista via abrirRaioX');
assert.match(corpo, /onclick: `abrirLead\(/, '"parada de maior valor" deve abrir o lead');

// 2. As linhas viram <button> clicável quando têm ação (não mais <div> morto).
assert.match(corpo, /class="raiox-linha"/, 'linha clicável do Raio-X deve renderizar como botão');
assert.match(corpo, /o\.onclick/, 'render deve tratar linha com onclick como botão');

// 3. Os abridores/critérios existem e estão expostos.
assert.match(app, /function leadsRaioX\(tipo, etapa\)\{/, 'leadsRaioX precisa existir');
assert.match(app, /function abrirRaioX\(tipo, etapa, titulo\)\{/, 'abrirRaioX precisa existir');
assert.match(app, /window\.abrirRaioX ?= ?abrirRaioX/, 'abrirRaioX precisa estar no window (onclick inline)');

// 4. A lista do Raio-X usa os MESMOS critérios do texto (pra a lista bater com o número):
//    gargalo = etapa + diasParado>=5 ; longas = 30+ msgs sem visita.
const lr = app.match(/function leadsRaioX\(tipo, etapa\)\{[\s\S]*?\n\}/)[0];
assert.match(lr, /diasParado\(l\)[\s\S]*?>=\s*5/, 'gargalo deve filtrar por diasParado>=5');
assert.match(lr, /totalMensagensLead\(l\) >= 30 && !temVisitaLead\(l\)/, 'longas deve filtrar por 30+ msgs sem visita');

// 5. abrirGrupoHome aceita lista avulsa (options.leads/options.meta) sem quebrar rota.
const ag = app.match(/function abrirGrupoHome\(grupo, options=\{\}\)\{[\s\S]*?const arr =[^\n]*\n/)[0];
assert.match(ag, /const avulsa = Array\.isArray\(options\.leads\)/, 'abrirGrupoHome deve detectar lista avulsa');
assert.match(ag, /options\.meta \|\| GRUPOS_HOME\[grupo\]/, 'abrirGrupoHome deve aceitar meta customizada');
assert.match(ag, /avulsa \? options\.leads/, 'abrirGrupoHome deve usar a lista avulsa quando passada');

console.log('v883-raiox-clicavel: ok');
