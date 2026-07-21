import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v896 — (1) barra "Interesse do cliente" conta só mensagens do cliente dos últimos 90 dias
// (interesse atual, não engajamento antigo); (2) "Última análise" para de mudar ao marcar
// atendimento (não usa mais updatedAt).

// 1. mensagensDoCliente executa e filtra por 90 dias.
const fn = app.match(/function mensagensDoCliente\(l\)\{[\s\S]*?\n\}/)[0];
const mensagensDoCliente = eval(`
  const BUSINESS_RE=/senger|construtora|imobili/i;
  function ehMsgDoCliente(m,pn){const a=String(m?.author||'').trim();if(!a||a==='Sistema')return false;if(BUSINESS_RE.test(a))return false;if(/^(sanchai|corretor)$/i.test(a))return false;return true;}
  const CP_JANELA_INTERESSE_DIAS = 90;
  ${fn}
  mensagensDoCliente;
`);
const hoje = new Date().toISOString();
const antigo = new Date(Date.now() - 120*86400000).toISOString(); // 120 dias atrás
const lead = { name:'Ana', recentMessages:[
  { author:'Ana', text:'oi', source:'whatsapp', iso:hoje },     // cliente recente -> conta
  { author:'Ana', text:'ok', source:'whatsapp', iso:antigo },   // cliente antigo (120d) -> fora
  { author:'Ana', text:'sem data', source:'whatsapp' },         // sem data -> conta (recente)
  { author:'Sanchai', text:'eu explicando', source:'whatsapp', iso:hoje }, // eu -> não conta
]};
assert.equal(mensagensDoCliente(lead), 2, 'conta cliente recente + sem data; ignora o de 120 dias');
assert.match(app, /const CP_JANELA_INTERESSE_DIAS = 90;/, 'janela de 90 dias definida');

// 2. "Última análise" só usa carimbo real da análise, nunca updatedAt/atualizadoEm.
const cp = app.match(/function cp865UltimaAnaliseISO\(lead, a\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(cp, /lead\?\.updatedAt|lead\?\.atualizadoEm/, '"Última análise" não pode ler lead.updatedAt (marcar não pode alterá-la)');
assert.match(cp, /iaComercialV2\?\.geradoEm/, 'usa o carimbo real da análise (iaComercialV2.geradoEm)');

console.log('v896-interesse-90dias-e-analise: ok');
