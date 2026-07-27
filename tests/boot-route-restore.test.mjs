import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1026 — o dono pediu, de forma explícita e repetida: atualizar a página (F5/Ctrl+Shift+R, ou
// o Android recarregando o PWA sozinho) NUNCA pode abrir outra coisa além da Home. Este arquivo
// testava o OPOSTO até aqui: o boot restaurava de propósito um lead salvo em history.state (pra
// sobreviver a uma troca de versão/service worker no meio do atendimento). Na prática, isso
// reabria sozinho leads já atendidos há muito tempo em qualquer refresh comum — o próprio bug
// relatado agora. A restauração foi removida de vez: o boot sempre cai na Home.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const boot = app.slice(app.indexOf('async function iniciarDireciona'), app.indexOf('requestAnimationFrame(iniciarDireciona)'));
assert.ok(boot, 'não encontrei a função de boot iniciarDireciona');

assert.doesNotMatch(boot, /abrirLead\([^)]*fromHistory/, 'o boot não pode mais reabrir sozinho um lead salvo em history.state');
assert.doesNotMatch(boot, /screen\s*===\s*["']lead["']/, 'o boot não pode mais checar rota de lead salva pra restaurar');
assert.match(boot, /history\.replaceState/, 'o boot precisa limpar uma rota antiga (de outra tela/lead) do history.state, garantindo a Home como destino único mesmo num refresh seguinte');
assert.match(boot, /carregarDashboard\(\);/, 'dashboard sempre carrega no boot (não depende mais de restaurar lead nenhum)');

console.log('boot-route-restore: atualizar a página sempre cai na Home, nunca restaura lead antigo — ok');
