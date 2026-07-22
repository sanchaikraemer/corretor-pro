import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// v927 — pedido do dono: a tela Desempenho ("Prioridade de atendimento") mostrava um total que
// não batia com "Clientes ativos" logo acima (ex.: 98 no gráfico vs 241 no card) — o gráfico só
// somava Fazer agora + Agenda + Aguardando cliente, deixando de fora quem caía em "sem-acao"
// (prospecção rasa, <5 mensagens do cliente) sem avisar em lugar nenhum. Escolhido entre 4
// opções: manter o donut, mas completar com a fatia que faltava ("Prospecção"), pro total do
// gráfico fechar com a carteira inteira.

const ini = app.indexOf('function renderCorretorProDashboard(items, all){');
const fim = app.indexOf('\nfunction ', ini + 1);
assert.ok(ini !== -1 && fim !== -1, 'renderCorretorProDashboard não encontrada em app.js');
const fn = app.slice(ini, fim);

// 1. O total usado pro gráfico/percentuais é a carteira inteira (items.length), não só quem
// pede ação — é isso que faz o número bater com "Clientes ativos".
assert.match(fn, /const total ?= ?Math\.max\(1, ?items\.length\)/, 'o total do gráfico deve ser a carteira inteira (items.length)');
assert.match(fn, /cpSetText\("cpTotalAtendimentos", ?items\.length\)/, 'o número central do donut deve ser items.length (bate com Clientes ativos)');

// 2. Uma 5ª fatia "Prospecção" cobre quem cai em "sem-acao" (antes ficava de fora, sem nem contar).
assert.match(fn, /counts\.semAcao\+\+/, 'quem é "sem-acao" deve ser contado (counts.semAcao)');
assert.match(fn, /\["Prospecção",counts\.semAcao,cpPct\(counts\.semAcao,total\),"var\(--cp-muted\)"\]/,
  'a legenda deve ter a 4ª linha "Prospecção" com a cor --cp-muted');

// 3. O gráfico (conic-gradient) tem os 5 stops, terminando em --cp-muted até 100%.
assert.match(fn, /var\(--cp-muted\) \$\{Math\.min\(100,hp\+rp\+pp\+ap\)\}% 100%/,
  'o conic-gradient deve fechar a última fatia (--cp-muted) em 100%');

// 4. O rótulo embaixo do número no HTML não pode mais dizer só "atendimentos" (o número agora é
// a carteira inteira, não só quem tem ação pendente).
assert.doesNotMatch(html, /<b id="cpTotalAtendimentos">0<\/b><small>atendimentos<\/small>/,
  'o rótulo do donut precisa deixar de dizer "atendimentos" (o número virou a carteira inteira)');
assert.match(html, /<b id="cpTotalAtendimentos">0<\/b><small>clientes ativos<\/small>/,
  'o rótulo do donut deve bater com "Clientes ativos" (mesma nomenclatura do card acima)');

console.log('v927-desempenho-bate-com-carteira: ok');
