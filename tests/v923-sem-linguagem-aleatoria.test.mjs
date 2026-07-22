import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v923 — o dono estranhou "sorteados" nos comentários/notas da v922 ("Fazer agora" com dose
// fixa do dia): a escolha dos 10 de hoje é por PRIORIDADE (mais mensagens do cliente, desempate
// por tempo parado), igual sempre foi — não tem nada de aleatório. "Sortear" em português soa
// como sorte/loteria, e passava a impressão errada. Troquei por "escolher" nos comentários pra
// não confundir de novo, e este teste trava a linguagem enganosa não voltar pro bloco da dose.

const ini = app.indexOf('function cpFimDeSemana(){');
const fim = app.indexOf('window.cpNotaPrioridade');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'bloco da dose fixa não encontrado em app.js');
const bloco = app.slice(ini, fim);

assert.doesNotMatch(bloco, /sorte/i, 'o bloco da dose fixa não deve mais falar em "sortear/sorteio" (a escolha é por prioridade, não aleatória)');

console.log('v923-sem-linguagem-aleatoria: ok');
