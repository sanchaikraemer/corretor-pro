import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1253 — o cliente pediu uma coisa concreta e a "recomendada" ignorava o pedido pra empurrar
// outro passo. A correção da época foi um bloco escrito no pedido enviado à IA.
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. Na reescrita das instruções entregue pelo dono o bloco
// saiu e virou uma linha na lista de regras das três mensagens. A garantia continua: pedido do
// cliente na mesa manda na mensagem recomendada.

assert.match(src, /Quando o cliente pediu diretamente um material ou uma resposta e isso é o próximo passo natural, priorize atender o pedido\./,
  'o pedido do cliente continua tendo prioridade sobre qualquer outro próximo passo');
assert.match(src, /RECOMENDADA é a que você enviaria se só pudesse enviar uma\./,
  'e a recomendada continua sendo a melhor das três, não uma variação qualquer');
assert.match(src, /"pedidoSemResposta":"texto ou Nenhum"/,
  'o pedido do cliente ainda sem resposta continua sendo extraído e mostrado na tela');
console.log('v1253-pedido-do-cliente-manda-na-recomendada: ok');
