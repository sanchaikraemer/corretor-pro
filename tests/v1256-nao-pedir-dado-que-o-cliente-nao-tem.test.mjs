import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1256 — as sugestões pediam ao cliente um dado que ele já tinha prometido trazer, ou que ele não
// tinha como responder. A correção da época foi o bloco "O CLIENTE JÁ PROMETEU TRAZER O DADO — NÃO
// PEÇA DE NOVO".
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O bloco saiu na reescrita entregue pelo dono. Ficaram a
// proibição do interrogatório e o campo que registra o que ainda falta descobrir — e o campo é o
// que impede a IA de perguntar por perguntar.

assert.match(src, /Não repita pergunta já respondida nem transforme falta de dado em interrogatório/,
  'falta de dado não pode virar interrogatório');
assert.match(src, /"faltaDescobrir":\["somente informações ainda abertas que realmente podem alterar estratégia\/seleção\/próximo passo"\]/,
  'só entra na pauta o que ainda está aberto E muda a estratégia');
assert.match(src, /"ultimoCompromissoCliente":"texto ou Não identificado"/,
  'o que o cliente prometeu trazer continua sendo registrado');
assert.match(src, /ANTES DE PERGUNTAR, PROCURE A RESPOSTA NA CONVERSA, inclusive quando ela apareceu de forma indireta/,
  'e procurar na conversa antes de perguntar continua sendo ordem escrita');
console.log('v1256-nao-pedir-dado-que-o-cliente-nao-tem: ok');
