import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v867: no histórico ("Últimas mensagens"), uma observação/atendimento manual aparecia como se
// fosse fala do cliente (ehMsgDoCliente tratava autor desconhecido como cliente). Agora o
// histórico etiqueta pelo TIPO: observacao_manual/atendimento/nota -> "Observação" (não é o
// cliente); mensagem_enviada -> "Você".

const ini = app.indexOf('function cp704TimelineHtml(');
assert.ok(ini !== -1, 'não localizei cp704TimelineHtml');
const tl = app.slice(ini, ini + 2000);

assert.match(tl, /tipo==='observacao_manual'\s*\|\|\s*tipo==='atendimento'\s*\|\|\s*tipo==='nota'/, 'os tipos de observação precisam ser detectados');
assert.match(tl, /who='Observação'/, 'observação precisa ser rotulada como "Observação"');
assert.match(tl, /tipo==='mensagem_enviada'/, 'mensagem enviada por você precisa ser reconhecida');
assert.match(tl, /cp704-tmsg-obs/, 'observação precisa ter marcação visual própria');
// A observação não pode cair no ramo que usa o nome do cliente.
assert.ok(
  tl.indexOf("who='Observação'") < tl.indexOf('ehMsgDoCliente(m,pn)'),
  'a observação precisa ser tratada ANTES do fallback que usa o nome do cliente'
);

// Estilo do rótulo de observação existe.
assert.match(app, /\.cp704-tmsg-obs b\{/, 'o CSS do rótulo "Observação" precisa existir');

console.log('v867-observacao-historico: ok');
