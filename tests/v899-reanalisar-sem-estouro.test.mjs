import fs from 'node:fs';
import assert from 'node:assert/strict';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v899 — ao clicar Reanalisar/Marcar (agora ícones pequenos de 66px), o handler enfiava
// "Atualizando análise..."/"Marcando..." no botão e o texto ESTOURAVA pra fora do card.
// Correção: usa a classe cp704-ico-loading (gira o ícone), sem texto. O progresso já aparece
// na barra grande.
assert.doesNotMatch(app, /btn\.textContent="Atualizando análise\.\.\."/, 'Reanalisar não enfia mais texto longo no ícone');
assert.doesNotMatch(app, /btn\.textContent="Marcando\.\.\."/, 'Marcar não enfia mais texto no ícone');
const rean = app.match(/window\.ui670Reanalisar=async function\(btn\)\{[\s\S]*?\n\};/)[0];
assert.match(rean, /btn\.classList\.add\('cp704-ico-loading'\)/, 'Reanalisar usa a classe de carregando');
const marc = app.match(/window\.ui667MarcarAtendido=async function\(btn\)\{[\s\S]*?\n\};/)[0];
assert.match(marc, /btn\.classList\.add\('cp704-ico-loading'\)/, 'Marcar usa a classe de carregando');
assert.match(app, /\.cp704-ico-loading svg\{animation:cp704-spin/, 'CSS gira o ícone durante o carregamento');
assert.match(app, /prefers-reduced-motion:reduce\)\{\.cp704-ico-loading svg\{animation:none/, 'respeita reduced-motion');
console.log('v899-reanalisar-sem-estouro: ok');
