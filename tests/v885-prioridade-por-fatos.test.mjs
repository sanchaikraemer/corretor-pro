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
  const mensagensDoCliente = l => l.msgs || 0;
  const diasParado = l => (l.dias == null ? Infinity : l.dias);
  ${consts[0]}
  ${fnNota[0]}
  cpNotaPrioridade;
`);
const A = { msgs: 50, dias: 10 }; // muito engajado
const B = { msgs: 5, dias: 100 }; // pouco engajado, muito abandonado
const C = { msgs: 5, dias: 10 };
assert.ok(cpNotaPrioridade(A) > cpNotaPrioridade(B), 'engajamento alto deve vencer só-abandono');
assert.ok(cpNotaPrioridade(B) > cpNotaPrioridade(C), 'mais abandonado deve subir entre iguais em engajamento');
assert.equal(app.match(/const CP_DOSE_DIA = (\d+);/)[1], '10', 'a dose do dia deve ser 10');

// --- 2. cp786Categoria classifica pela SITUAÇÃO REAL (não pelo campo de status da IA). ---
const cat = app.match(/function cp786Categoria\(l,modelo=null,ultimaReal=null\)\{[\s\S]*?\n\}/)[0];
assert.match(cat, /if\(cp786TemCompromisso\(l\)\) return 'programados'/, 'compromisso => Agenda');
// v906: "Aguardando cliente" = atendi e o cliente não respondeu (não é mais balde de lead cru).
// v1071: só vale dentro do prazo de descanso (emJanelaDeEspera) — depois disso "vence".
// v1266 — "quem está esperando quem" saiu da conta; ficou o descanso.
assert.match(cat, /if\(emJanelaDeEspera\(l\)\) return 'aguardando'/, 'aguardando = atendi e ainda no prazo de descanso');
assert.match(cat, /mensagensDoCliente\(l\) < CP_MIN_MSGS_PRIORIDADE\) return 'sem-acao'/, 'lead cru sai dos cards (sem-acao)');
assert.match(cat, /return entraEmRetomada\(l\) \? 'agora' : 'sem-acao'/, 'precisa de retomada => Fazer agora; senão sem-acao');
assert.doesNotMatch(cat, /responder-agora|precisaCorretor|responsavel==='corretor'/,
  'não deve mais depender do campo de status/responsavel da IA (o balde-lixo)');

// --- 3. A lista "Fazer agora" (Home) na mesma régua: fila ranqueada + dose do dia. ---
// (v1075: a tela Condução foi deletada — a lista da Home é a visão única, com a mesma régua.)
const iniLive = app.lastIndexOf('function abrirFazerAgora()');
assert.ok(iniLive !== -1, 'abrirFazerAgora não encontrada');
const live = app.slice(iniLive, iniLive + 2000);
assert.match(live, /cpFilaFazerAgora\(ativos\)/, 'a lista deve usar a fila ranqueada (mesma régua da Home)');
assert.match(live, /cpFazerAgoraDose\(ativos\)/, 'a lista corta pela dose do dia (não mostra o backlog inteiro no topo)');
assert.match(app, /titulo:'Carteira ativa'/, 'vir por "Total de leads" abre a lista "Carteira ativa"');

// --- 4. Limpezas de UI. ---
assert.equal((app.match(/Top conversão de hoje/g) || []).length, 0, '"Top conversão de hoje" foi removido');
assert.doesNotMatch(html, /title="Atendimentos"/, 'ícone duplicado "Atendimentos" saiu do topo');
assert.doesNotMatch(html, /cp-icon-btn desktop-only/, 'ícones desktop duplicados (Atendimentos/Agenda) saíram do topo');
// v1205 — a Central de atenção foi removida; o sino agora leva direto pra Agenda (o rótulo
// acompanhou). A intenção original deste teste segue igual: o sino não pode voltar a se dizer
// "Notificações" genérico.
assert.match(html, /id="topBell" title="Abrir a Agenda"/, 'o sino precisa dizer pra onde leva (a Agenda)');

console.log('v885-prioridade-por-fatos: ok');
