import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1289 — o cliente mudou de planos no meio da conversa ("agora é apartamento, desisti do
// terreno") e a análise continuava conduzindo pelo interesse velho. A correção da época foi um
// bloco escrito no pedido, mais a trava "SILÊNCIO NÃO É ACEITE" na faixa de valor.
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. Os blocos saíram na reescrita entregue pelo dono. As duas
// garantias continuam escritas, agora em forma curta e dentro dos campos do diagnóstico.

// 1. O depois manda sobre o antes — sem jogar fora o resto do contexto.
assert.match(src, /Informação recente substitui a antiga somente quando forem incompatíveis; não apague o restante do contexto válido\./,
  'o que veio depois manda quando briga com o que veio antes');
assert.match(src, /"oQueMudouNoTempo":"mudanças relevantes de necessidade, produto, prazo, objetivo ou estágio/,
  'a mudança de planos precisa ter campo próprio na análise');
// v1322 — mesma nuance da v1280: superado ganhou definição; largado por preço volta quando a faixa muda.
assert.match(src, /"produtoInteresse":"produto\/necessidade atual, sem ressuscitar produto superado\./,
  'e o produto abandonado não pode voltar como interesse atual');

// 2. Silêncio não é aceite (a trava que impedia deduzir orçamento de quem não respondeu).
assert.match(src, /Silêncio não confirma resumo, interpretação, preço, orçamento ou objeção\./,
  'silêncio continua não confirmando orçamento nem objeção');
assert.match(src, /"faixaDeValor":"somente faixa sustentada por declaração ou reação inequívoca do cliente; silêncio não conta"/,
  'a faixa de valor continua exigindo declaração ou reação real do cliente');
assert.match(src, /Valor apresentado pelo corretor confirma o valor daquela oferta naquele momento; não confirma sozinho orçamento ou poder de compra\./,
  'e o valor que o corretor apresentou não vira, sozinho, o orçamento do cliente');

// 3. Nada comercial cravado (regra da casa).
assert.doesNotMatch(src.slice(src.indexOf('IMPORTANTE SOBRE O HISTÓRICO'), src.indexOf('Formato JSON obrigatório:')),
  /R\$|Renaissance|Evolutti|Senger|Personalité/,
  'a regra do histórico não pode citar preço, empreendimento ou construtora');
console.log('v1289-historico-antigo-nao-manda: ok');
