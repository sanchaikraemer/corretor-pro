import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v894 — topo do lead adotou o Modelo 2 (barra de ÍCONES compacta), escolha do dono. O
// "Desmarcar" deixou de ser item separado: o ícone "Atendido" vira interruptor (toca = marca,
// toca de novo = desmarca).

// 1. A barra de ícones existe e substituiu os pills antigos.
assert.match(app, /<div class="cp704-toolbar">/, 'topo do lead usa a barra de ícones (cp704-toolbar)');
assert.doesNotMatch(app, /<div class="cp704-top-actions">/, 'os pills antigos (cp704-top-actions) saíram do lead');
assert.match(app, /\.cp704-toolbar\{display:flex/, 'CSS da toolbar existe');
assert.match(app, /\.cp704-ico\{/, 'CSS dos ícones existe');
assert.match(app, /\.cp704-ico\.done\{[^}]*112,212,157/, 'estado "Atendido" (done) fica verde');

// 2. Os 4 ícones com legenda.
for(const t of ['title="Reanalisar"','title="Agendar retorno"','title="Editar lead"']){
  assert.ok(app.includes(t), `ícone ${t} presente`);
}
assert.match(app, /class="lb">Reanalisar<\/span>/, 'ícones têm legenda curta');

// 3. Interruptor do "Atendido": atendido => desmarca; senão => marca.
assert.match(app, /class="cp704-ico done" onclick="ui667DesmarcarAtendido\(this\)"[^`]*Atendido/,
  'quando atendido, o ícone verde "Atendido" desmarca ao tocar');
assert.match(app, /class="cp704-ico" onclick="ui667MarcarAtendido\(this\)"[^`]*Marcar/,
  'quando não atendido, o ícone "Marcar" marca o atendimento');

// 4. Não sobrou o link solto de desmarcar.
assert.doesNotMatch(app, /class="cp704-desmarcar"/, 'sem link solto "Desmarcar" (virou interruptor)');

console.log('v894-toolbar-icones: ok');
