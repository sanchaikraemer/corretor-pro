import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const leadUpdate=fs.readFileSync(new URL('./api/lead-update.js',import.meta.url),'utf8');
const reanalisar=fs.readFileSync(new URL('./api/reanalisar-lead.js',import.meta.url),'utf8');
const pipeline=fs.readFileSync(new URL('./api/_pipeline.js',import.meta.url),'utf8');

assert.match(app,/function ui675AnaliseDeterministica/);
assert.match(app,/function ui675BuscarDetalhe/);
assert.match(app,/function ui675PersistirFallback/);
assert.match(app,/action:"analise-comercial-set"/);
assert.match(app,/if\(!analysis\|\|schema<675\)/);
assert.match(app,/analysis=await ui675PersistirFallback/);
assert.match(leadUpdate,/case "analise-comercial-set"/);
assert.match(leadUpdate,/async function acaoAnaliseComercialSet/);
assert.match(leadUpdate,/schemaComercial: 675/);
assert.match(reanalisar,/apiVersion: 675/);
assert.match(pipeline,/parsed\._schemaComercial = 675/);
assert.match(pipeline,/out\._schemaComercial = 675/);
console.log('teste-reanalise-fallback-v675: OK');
