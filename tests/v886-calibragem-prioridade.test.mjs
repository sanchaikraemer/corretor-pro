import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v886 — calibragem dos pesos decidida pelo dono:
//   A engajamento=2, B abandono=1, D teto msgs=120, E teto dias=90, F dose=10,
//   G lead cru=5 mensagens, H proteção=5 dias.  C ("cliente falou por último") REMOVIDO.

// C removido: cpNotaPrioridade não usa mais o bônus/último-falante.
const fnNota = app.match(/function cpNotaPrioridade\(l\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(fnNota, /cp786UltimoFoiCliente|CP_BONUS_BOLA|bola/i,
  'o bônus "cliente falou por último" (C) foi removido da nota');
assert.doesNotMatch(app, /const CP_BONUS_BOLA/, 'a constante do bônus C não deve mais existir');

// Pesos e tetos calibrados.
assert.match(app, /const CP_PESO_ENGAJAMENTO = 2;/, 'A: engajamento = 2 por mensagem');
assert.match(app, /const CP_PESO_ABANDONO = 1;/, 'B: abandono = 1 por dia');
assert.match(app, /const CP_TETO_ENGAJAMENTO = 120;/, 'D: teto de mensagens = 120');
assert.match(app, /const CP_TETO_ABANDONO = 90;/, 'E: teto de dias = 90');
assert.match(app, /const CP_DOSE_DIA = 10;/, 'F: dose do dia = 10');

// G: lead cru agora precisa de 5+ mensagens pra entrar na fila.
assert.match(app, /const CP_MIN_MSGS_PRIORIDADE = 5;/, 'G: mínimo de mensagens = 5');
assert.match(app, /totalMensagensLead\(l\) < CP_MIN_MSGS_PRIORIDADE\) return 'aguardando'/,
  'cp786Categoria deve usar o corte de mensagens calibrado');

// H: proteção pós-atendimento continua em 5 dias.
assert.match(app, /const PRAZO_PROTECAO_ATENDIDO = 5;/, 'H: proteção pós-atendimento = 5 dias');

console.log('v886-calibragem-prioridade: ok');
