import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1262 — o fecho das três terminava pedindo licença ("posso te mandar?", "quer que eu veja?"). A
// correção da época foi o bloco do fecho curto, com a lista do que não vale como fechamento.
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O bloco saiu na reescrita entregue pelo dono. O que ficou
// é o papel da mensagem mais direta e a régua do menor próximo passo útil.

assert.match(src, /MAIS DIRETA é objetiva, mas nunca força visita, proposta ou decisão antes da maturidade\./,
  'a direta continua sendo objetiva sem forçar a barra');
assert.match(src, /Escolha o menor próximo passo útil para ESTE lead/,
  'o fecho continua tendo que ser um passo concreto e proporcional');
// v1297 — a descrição do campo ganhou a régua "quando já dá pra entregar, entregue em vez de
// perguntar de novo" (print do dono de 18/08/2026, 17h18). O campo continua existindo e continua
// sendo o menor próximo passo útil — é só a descrição dele que ficou mais concreta.
assert.match(src, /"nextAction":"menor próximo passo útil coerente com a leitura/,
  'e o próximo passo continua sendo pedido à IA em campo próprio');
console.log('v1262-fecho-nao-pede-licenca: ok');
