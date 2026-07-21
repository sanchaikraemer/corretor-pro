import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v906 — "Aguardando cliente" deixou de ser balde. Agora = VOCÊ atendeu (copiou msg / marcou
// atendimento) e o cliente AINDA NÃO respondeu depois. Lead raso/parado sai dos cards (sem-acao).

// 1. Executa ultimaMsgClienteTs + cpAguardandoResposta com stubs.
const f1 = app.match(/function ultimaMsgClienteTs\(l\)\{[\s\S]*?\n\}/)[0];
const f2 = app.match(/function cpAguardandoResposta\(l\)\{[\s\S]*?\n\}/)[0];
const cpAguardandoResposta = eval(`
  const ehMsgDoCliente = (m) => String(m?.author||'') === 'Cliente';
  const ultimoAtendimentoTs = (l) => Number(l.__at || 0);
  ${f1}
  ${f2}
  cpAguardandoResposta;
`);

const msgCli = (iso) => ({ author:'Cliente', text:'oi', iso });
const msgEu  = (iso) => ({ author:'Você', text:'resposta', iso });

// Atendi (ts alto) e a última msg do cliente é ANTERIOR → aguardando (bola com o cliente).
assert.equal(cpAguardandoResposta({ __at: Date.parse('2026-07-20T12:00:00Z'),
  recentMessages:[ msgCli('2026-07-18T10:00:00Z'), msgEu('2026-07-20T12:00:00Z') ] }), true,
  'atendi e o cliente não respondeu depois → aguardando');

// Atendi, mas o cliente RESPONDEU depois → não é aguardando (a bola voltou pra mim).
assert.equal(cpAguardandoResposta({ __at: Date.parse('2026-07-20T12:00:00Z'),
  recentMessages:[ msgEu('2026-07-20T12:00:00Z'), msgCli('2026-07-21T09:00:00Z') ] }), false,
  'cliente respondeu depois do atendimento → não é aguardando');

// Nunca atendido pelo app → não é aguardando.
assert.equal(cpAguardandoResposta({ __at: 0, recentMessages:[ msgCli('2026-07-18T10:00:00Z') ] }), false,
  'lead nunca atendido não é "aguardando cliente"');

// 2. cp786Categoria usa a nova regra e manda lead raso/sem-retomada pra "sem-acao".
const cat = app.match(/function cp786Categoria\(l,modelo=null,ultimaReal=null\)\{[\s\S]*?\n\}/)[0];
assert.match(cat, /if\(cpAguardandoResposta\(l\)\) return 'aguardando'/, 'aguardando = atendi e cliente não respondeu');
assert.match(cat, /mensagensDoCliente\(l\) < CP_MIN_MSGS_PRIORIDADE\) return 'sem-acao'/, 'lead raso → sem-acao (fora dos cards)');
assert.match(cat, /return entraEmRetomada\(l\) \? 'agora' : 'sem-acao'/, 'vale toque → agora; senão sem-acao');
assert.doesNotMatch(cat, /ehContatadoHoje\(l\)\) return 'aguardando'/, 'não usa mais o balde antigo');

console.log('v906-aguardando-cliente-real: ok');
