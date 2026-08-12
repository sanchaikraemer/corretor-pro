import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1230 — print do dono (12/08/2026): as 3 sugestões repetiram o que já tinha sido dito na
// conversa. A "Recomendada" pedia pra confirmar o prazo de 90 dias que o PRÓPRIO corretor tinha
// acabado de perguntar (última mensagem dele, ainda sem resposta), e a "Direta ao ponto" pedia a
// data de entrega que o CLIENTE JÁ TINHA RESPONDIDO ("Dia 06/08 início"). O prompt proibia
// repetir pedido de permissão (v-anteriores) e repetir números citados pelo cliente, mas não
// tinha regra dura contra repetir pergunta já feita ou já respondida. Este teste prende a regra
// nova no prompt da análise.

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

assert.match(pipeline, /NÃO REPETIR O QUE JÁ FOI DITO — REGRA DURA/,
  'o prompt da análise precisa ter a regra dura de não repetir o que já foi dito');

// As três frentes da regra:
// v1240 — os seis blocos que repetiam esta ideia viraram um só, e o texto foi reescrito. A regra
// é a mesma; o que muda aqui é onde ela mora.
assert.match(pipeline, /Informação que o CLIENTE já respondeu[\s\S]{0,160}NÃO se pergunta\s*\n?\s*de novo/i,
  'pergunta já RESPONDIDA pelo cliente não pode ser perguntada de novo');
assert.match(pipeline, /ÚLTIMA fala do corretor[\s\S]{0,300}MESMA pergunta como se fosse nova/,
  'a última pergunta do corretor ainda sem resposta não pode ser reescrita como se fosse nova');
assert.match(pipeline, /o que o corretor já disse\/explicou na conversa não volta reescrito/,
  'afirmações já feitas não podem voltar como novidade');

// A regra de retomar pergunta em aberto (que continua existindo) agora aponta pra regra nova —
// retomar não é repetir.
assert.match(pipeline, /retomar NÃO é repetir a pergunta como se fosse nova/,
  'a regra de retomada precisa remeter à regra de não-repetição');

console.log('v1230-nao-repetir-o-que-ja-foi-dito: ok');
