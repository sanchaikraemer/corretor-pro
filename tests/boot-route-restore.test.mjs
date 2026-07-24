import fs from 'node:fs';
import assert from 'node:assert/strict';

// Regressão: quando o app recarrega (atualização de versão, troca de service worker ou o
// Android reabrindo o PWA depois de ir pro WhatsApp), o boot precisa reabrir o lead que
// estava na tela, usando a rota guardada em history.state. Sem isso, todo reload jogava o
// corretor de volta pra Home ("fica voltando pra tela inicial").

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v980: o disparo direto de "requestAnimationFrame(iniciarDireciona)" virou
// "requestAnimationFrame(() => { iniciarPortaoDeAcesso(iniciarDireciona)..." — o boot só
// chama iniciarDireciona depois que o portão de acesso (login por conta) libera. Atualiza
// o marcador de fim do recorte, senão o slice() com indexOf(-1) silenciosamente cresce até
// quase o fim do arquivo inteiro e o teste passa sem checar nada de específico.
const boot = app.slice(app.indexOf('async function iniciarDireciona'), app.indexOf('requestAnimationFrame(() => { iniciarPortaoDeAcesso'));
assert.ok(boot, 'não encontrei a função de boot iniciarDireciona');

assert.match(boot, /history\.state/, 'o boot precisa ler history.state para restaurar a rota');
assert.match(boot, /screen\s*===\s*["']lead["']/, 'o boot precisa detectar a rota de lead salva');
assert.match(boot, /abrirLead\([^)]*fromHistory/, 'o boot precisa reabrir o lead salvo via abrirLead({fromHistory:true})');

console.log('boot-route-restore: ok');
