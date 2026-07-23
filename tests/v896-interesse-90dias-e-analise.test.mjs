import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v896 (original) — a barra "Interesse do cliente" contava só mensagens dos últimos 90 dias.
// v942 — o dono apontou que isso zerava leads que esfriaram há 3+ meses ("0 mensagens do cliente"
// mesmo tendo escrito ~15), o que parece quebrado. A janela foi REMOVIDA: agora conta TODAS as
// mensagens do cliente (engajamento real da conversa); a coldness fica nos "dias parado".
// (2) "Última análise" continua sem mudar ao marcar atendimento (não usa updatedAt).

// 1. mensagensDoCliente conta todas as mensagens do cliente, sem filtro de tempo.
const fn = app.match(/function mensagensDoCliente\(l\)\{[\s\S]*?\n\}/)[0];
const mensagensDoCliente = eval(`
  const BUSINESS_RE=/senger|construtora|imobili/i;
  function ehMsgDoCliente(m,pn){const a=String(m?.author||'').trim();if(!a||a==='Sistema')return false;if(BUSINESS_RE.test(a))return false;if(/^(sanchai|corretor)$/i.test(a))return false;return true;}
  ${fn}
  mensagensDoCliente;
`);
const hoje = new Date().toISOString();
const antigo = new Date(Date.now() - 120*86400000).toISOString(); // 120 dias atrás
const lead = { name:'Ana', recentMessages:[
  { author:'Ana', text:'oi', source:'whatsapp', iso:hoje },     // cliente recente -> conta
  { author:'Ana', text:'ok', source:'whatsapp', iso:antigo },   // cliente antigo (120d) -> AGORA conta (sem janela)
  { author:'Ana', text:'sem data', source:'whatsapp' },         // sem data -> conta
  { author:'Sanchai', text:'eu explicando', source:'whatsapp', iso:hoje }, // eu -> não conta
]};
assert.equal(mensagensDoCliente(lead), 3, 'conta TODAS as mensagens do cliente (recente + antiga + sem data), só ignora as minhas');
// leads sem histórico completo usam a contagem pronta do servidor (clientMessageCount).
assert.equal(mensagensDoCliente({ name:'Ana', clientMessageCount:15, recentMessages:[{author:'Ana',text:'oi'}] }), 15,
  'na lista (sem historyLoaded) usa clientMessageCount do servidor');
assert.equal(mensagensDoCliente({ name:'Ana', historyLoaded:true, clientMessageCount:15, recentMessages:[{author:'Ana',text:'oi'}] }), 1,
  'no detalhe (historyLoaded) conta das mensagens reais, ignorando o número pronto');

// 2. "Última análise" só usa carimbo real da análise, nunca updatedAt/atualizadoEm.
const cp = app.match(/function cp865UltimaAnaliseISO\(lead, a\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(cp, /lead\?\.updatedAt|lead\?\.atualizadoEm/, '"Última análise" não pode ler lead.updatedAt (marcar não pode alterá-la)');
assert.match(cp, /iaComercialV2\?\.geradoEm/, 'usa o carimbo real da análise (iaComercialV2.geradoEm)');

console.log('v896-interesse-90dias-e-analise: ok');
