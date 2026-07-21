import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v866: o "‹ Voltar" (.cp704-back) — o botão mais usado — virou um botão de verdade (borda + hover).
// v905: agora fica HARMONIOSO com a barra de ícones da direita (Reanalisar/Agendar/Editar/Marcar):
// mesmo formato .cp704-ico — coluna ícone+rótulo, cantos 12px, borda e hover.

const base = app.match(/\.cp704-back\{[^}]*\}/);
assert.ok(base, 'a regra base .cp704-back precisa existir');
assert.match(base[0], /border-radius:12px/, 'o Voltar acompanha os botões da direita (cantos 12px)');
assert.match(base[0], /flex-direction:column/, 'ícone em cima, rótulo embaixo — igual aos .cp704-ico');
assert.match(base[0], /min-width:66px/, 'mesma largura mínima dos botões da direita');
assert.match(base[0], /border:1px/, 'o Voltar precisa ter borda');
assert.match(app, /\.cp704-back:hover\{/, 'o Voltar precisa ter estado de hover');
// O markup do Voltar ganhou ícone (SVG) + rótulo, no padrão dos outros botões.
assert.match(app, /class="cp704-back"[^>]*><svg[\s\S]*?<span class="lb">Voltar<\/span>/,
  'o Voltar tem ícone + rótulo, como os demais botões da barra');

console.log('v866-botao-voltar: ok');
