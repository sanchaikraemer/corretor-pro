import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
assert.match(app,/window\.ui670Reanalisar=async function\(btn\)/);
assert.match(app,/fetch\("\.\/api\/reanalisar-lead"/);
assert.match(app,/const atualizado=limparLead\(\{\.\.\.lead,analysis,/);
assert.match(app,/_leadDetailCache\.set\(String\(lead\.id\)/);
assert.match(app,/onclick="ui670Reanalisar\(this\)"/);
assert.doesNotMatch(app,/ui670Reanalisar=function\(\)\{const b=qs\("\.ui670-legacy-hidden/);
assert.match(app,/rePerda\.test\(txt\)/);
assert.match(app,/listaPrioritaria=lista\.filter/);
const pkg=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'675.0.0');
const sw=fs.readFileSync(new URL('./service-worker.js',import.meta.url),'utf8');
assert.match(sw,/corretor-pro-static-v675-/);
console.log('teste-reanalise-v673: OK');
