import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// v885 — Reforma Home/Condução. Prioridade por FATOS (engajamento + abandono + bola com você),
// dose de 10/dia, "Aguardando cliente" deixa de ser balde-lixo, Home e Condução na mesma régua,
// e limpezas (Top conversão, abas duplicadas, ícones do topo, título ao vir de Total de leads).

// --- 1. Ranking executado de verdade: engajamento manda, abandono soma, bola desempata. ---
const consts = app.match(/const CP_PESO_ENGAJAMENTO[\s\S]*?const CP_DOSE_DIA = 10;/);
const fnNota = app.match(/function cpNotaPrioridade\(l\)\{[\s\S]*?\n\}/);
assert.ok(consts && fnNota, 'cpNotaPrioridade + constantes precisam existir');
const cpNotaPrioridade = eval(`
  const totalMensagensLead = l => l.msgs || 0;
  const diasParado = l => (l.dias == null ? Infinity : l.dias);
  const cp786UltimoFoiCliente = l => !!l.bola;
  ${consts[0]}
  ${fnNota[0]}
  cpNotaPrioridade;
`);
const A = { msgs: 50, dias: 10, bola: false }; // muito engajado
const B = { msgs: 5, dias: 100, bola: false }; // pouco engajado, muito abandonado
const C = { msgs: 5, dias: 10, bola: false };
assert.ok(cpNotaPrioridade(A) > cpNotaPrioridade(B), 'engajamento alto deve vencer só-abandono');
assert.ok(cpNotaPrioridade(B) > cpNotaPrioridade(C), 'mais abandonado deve subir entre iguais em engajamento');
assert.ok(
  cpNotaPrioridade({ msgs: 5, dias: 10, bola: true }) > cpNotaPrioridade(C),
  '"cliente falou por último" deve desempatar pra cima'
);
assert.equal(app.match(/const CP_DOSE_DIA = (\d+);/)[1], '10', 'a dose do dia deve ser 10');

// --- 2. cp786Categoria classifica pela SITUAÇÃO REAL (não pelo campo de status da IA). ---
const cat = app.match(/function cp786Categoria\(l,modelo=null,ultimaReal=null\)\{[\s\S]*?\n\}/)[0];
assert.match(cat, /if\(cp786TemCompromisso\(l\)\) return 'programados'/, 'compromisso => Agenda');
assert.match(cat, /totalMensagensLead\(l\) < 3\) return 'aguardando'/, 'lead cru (0-2 msgs) não é prioridade');
assert.match(cat, /return entraEmRetomada\(l\) \? 'agora' : 'aguardando'/, 'precisa de retomada => Fazer agora');
assert.doesNotMatch(cat, /responder-agora|precisaCorretor|responsavel==='corretor'/,
  'não deve mais depender do campo de status/responsavel da IA (o balde-lixo)');

// --- 3. Condução (render vivo) na mesma régua: dose + SEM abas duplicadas. ---
const iniLive = app.lastIndexOf('window.carregarPipeline=async function()');
assert.ok(iniLive !== -1, 'render vivo da Condução não encontrado');
const live = app.slice(iniLive, iniLive + 5000);
assert.match(live, /cpFilaFazerAgora\(leads\)/, 'Condução deve usar a fila ranqueada (mesma da Home)');
assert.match(live, /<b>\$\{doseCount\}<\/b>/, 'KPI "Fazer agora" da Condução mostra a dose (não o backlog)');
assert.doesNotMatch(live, /ui-filter-tabs cp786-action-tabs/, 'as abas duplicadas foram removidas da Condução');
assert.match(live, /filtro==='todos'.*Carteira ativa/s, 'vir por "Total de leads" (todos) renomeia o H1 pra Carteira ativa');

// --- 4. Limpezas de UI. ---
assert.equal((app.match(/Top conversão de hoje/g) || []).length, 0, '"Top conversão de hoje" foi removido');
assert.doesNotMatch(html, /title="Atendimentos"/, 'ícone duplicado "Atendimentos" saiu do topo');
assert.doesNotMatch(html, /cp-icon-btn desktop-only/, 'ícones desktop duplicados (Atendimentos/Agenda) saíram do topo');
assert.match(html, /id="topBell" title="Central de atenção"/, 'o sino deixou de se dizer "Notificações" (abre a Central de atenção)');

console.log('v885-prioridade-por-fatos: ok');
