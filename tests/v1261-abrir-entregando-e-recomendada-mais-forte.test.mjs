import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1261 — as três abriam PEDINDO alguma coisa em vez de entregar. A correção da época foi o bloco
// "NENHUMA DAS TRÊS PODE ABRIR PEDINDO".
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O bloco saiu na reescrita entregue pelo dono; o papel de
// cada mensagem continua escrito, em forma curta.

assert.match(src, /RECOMENDADA é a que você enviaria se só pudesse enviar uma\./,
  'a recomendada continua sendo a mais forte das três');
assert.match(src, /Quando o cliente pediu diretamente um material ou uma resposta e isso é o próximo passo natural, priorize atender o pedido\./,
  'e abrir entregando continua sendo o caminho quando existe pedido na mesa');
assert.match(src, /Não repita pergunta já respondida nem transforme falta de dado em interrogatório/,
  'abrir pedindo dado que a conversa já deu continua proibido');
console.log('v1261-abrir-entregando-e-recomendada-mais-forte: ok');
