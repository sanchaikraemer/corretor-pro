import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1127 — o cliente já tinha autorizado ("pode mandar sim") e as três sugestões voltavam pedindo
// a MESMA permissão de novo. A correção da época foi um bloco escrito no pedido: "CLIENTE JÁ DISSE
// SIM — NÃO PEÇA A MESMA PERMISSÃO DE NOVO".
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O dono entregou pronta uma reescrita das instruções e esse
// bloco saiu do produto, junto com a lista de "sins" reconhecidos e os exemplos de mensagem errada.
// O que ficou no lugar são duas linhas curtas: atender o pedido do cliente é prioridade, e pergunta
// já respondida não volta. Se o app voltar a pedir licença duas vezes, é aqui que a regra engrossa.

assert.match(src, /Quando o cliente pediu diretamente um material ou uma resposta e isso é o próximo passo natural, priorize atender o pedido\./,
  'quando o cliente já pediu, a mensagem entrega em vez de pedir permissão de novo');
assert.match(src, /Não repita pergunta já respondida nem transforme falta de dado em interrogatório/,
  'e nenhuma das três pode repetir pergunta que a conversa já respondeu');
assert.match(src, /"ultimoCompromissoCliente":"texto ou Não identificado"/,
  'o compromisso que o cliente já assumiu continua sendo pedido à IA e mostrado na tela do lead');
console.log('v1127-cliente-ja-disse-sim-nao-repede-permissao: ok');
