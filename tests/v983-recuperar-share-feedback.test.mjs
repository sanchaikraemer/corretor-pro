import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v983 — o dono clicou em "Tentar recuperar" (compartilhamento do WhatsApp que não apareceu a
// tempo) e disse "cliquei e nada aconteceu": o botão disparava uma nova espera de até 8s por trás
// sem NENHUM sinal na tela, então uma segunda falha parecia um botão morto. Também aumentamos a
// espera de 8s pra 15s — conversa grande com áudio pode demorar mais que isso pra gravar no
// service worker, e o app desistia antes da hora mesmo quando o compartilhamento ia dar certo.

const btnStart = app.indexOf("qs('#btnRecuperarShare')?.addEventListener('click'");
assert.ok(btnStart > -1, 'handler do botão Tentar recuperar precisa existir');
const btnBlock = app.slice(btnStart, btnStart + 400);
assert.match(btnBlock, /btn\.disabled = true/, 'o clique precisa desativar o botão na hora (evita cliques repetidos e mostra reação)');
assert.match(btnBlock, /btn\.textContent = .Procurando/, 'o clique precisa trocar o texto do botão pra algo tipo "Procurando…", ANTES do resultado da nova tentativa');

const checkStart = app.indexOf('async function _checkSharedImpl()');
const checkEnd = app.indexOf('async function checkShared()', checkStart);
const checkBlock = app.slice(checkStart, checkEnd);
assert.match(checkBlock, /Date\.now\(\)\+15000/, 'a espera pelo arquivo compartilhado precisa ser de 15s (8s era curto pra conversa grande com áudio)');

console.log('v983-recuperar-share-feedback: ok');
