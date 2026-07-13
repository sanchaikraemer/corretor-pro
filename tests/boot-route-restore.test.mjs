import fs from 'node:fs';
import assert from 'node:assert/strict';

// Regressão: quando o app recarrega (atualização de versão, troca de service worker ou o
// Android reabrindo o PWA depois de ir pro WhatsApp), o boot precisa reabrir o lead que
// estava na tela, usando a rota guardada em history.state. Sem isso, todo reload jogava o
// corretor de volta pra Home ("fica voltando pra tela inicial").

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const boot = app.slice(app.indexOf('async function iniciarDireciona'), app.indexOf('requestAnimationFrame(iniciarDireciona)'));
assert.ok(boot, 'não encontrei a função de boot iniciarDireciona');

assert.match(boot, /history\.state/, 'o boot precisa ler history.state para restaurar a rota');
assert.match(boot, /screen\s*===\s*["']lead["']/, 'o boot precisa detectar a rota de lead salva');
assert.match(boot, /abrirLead\([^)]*fromHistory/, 'o boot precisa reabrir o lead salvo via abrirLead({fromHistory:true})');

console.log('boot-route-restore: ok');
