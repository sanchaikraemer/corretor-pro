import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1260 — as sugestões condicionavam a entrega a uma resposta do cliente ("assim que você me
// disser X, eu te mando Y"). A correção da época foi o bloco "CONSTRUÇÃO PROIBIDA".
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O bloco saiu na reescrita entregue pelo dono. Ficaram a
// prioridade de atender o pedido do cliente e a separação entre o que já foi feito e o que ainda
// será feito.

assert.match(src, /Quando o cliente pediu diretamente um material ou uma resposta e isso é o próximo passo natural, priorize atender o pedido\./,
  'o que o cliente pediu é entregue, não fica de refém de uma resposta dele');
assert.match(src, /Não prometa fazer no passado algo que ainda será feito\. Diferencie "vou verificar" de "verifiquei"\./,
  'e a mensagem não pode dizer que já fez o que ainda vai fazer');
assert.match(src, /Escolha o menor próximo passo útil para ESTE lead/,
  'o próximo passo continua tendo que ser o menor passo útil, não uma exigência ao cliente');
console.log('v1260-entrega-nao-fica-de-refem: ok');
