import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v872: reanalisar um lead SEM conversa salva (timeline vazia) devolvia o erro técnico
// "Lead sem timeline pra reanalisar." Agora o Reanalisar troca isso por uma orientação clara.
assert.match(app, /\/sem timeline\/i\.test\(rawErr\)/, 'precisa detectar o erro "sem timeline" do servidor');
assert.match(app, /não tem a conversa do WhatsApp salva/, 'precisa mostrar a orientação clara ao usuário');

console.log('v872-reanalisar-sem-timeline: ok');
