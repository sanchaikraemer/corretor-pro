import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1253 — CASO REAL QUE O DONO TROUXE (lead "Milena", loteamento Nova Vila Rica III).
//
// Linha do tempo da conversa:
//   10/06 09:25 — cliente: "Gostaria de mais informações sobre valores de terreno. E tudo mais."
//   10/06 14:10 — corretor: responde CONDIÇÃO de pagamento (20% + 60x), prazo, link e vídeo.
//                 → o VALOR do lote nunca foi enviado.
//   07/08       — corretor: follow-up perguntando "tem alguma metragem ou localização preferida?"
//                 → cliente não respondeu.
//   13/08 16:39 — cliente volta sozinha: "Boa tarde. Tudo bem?"
//   13/08 17:01 — corretor: "Boa tarde, tudo e vc?"
//
// O que a análise devolveu: as sugestões 1 ("Recomendada") e 2 refaziam a MESMA pergunta de
// metragem/localização que já tinha sido ignorada em 07/08, e a única que entregava a tabela de
// valores (o que a cliente pediu em 10/06) ficou em 3º lugar. A 1 ainda abria com "Boa tarde
// Milena!" — o corretor tinha acabado de dizer "Boa tarde" às 17:01, ou seja, cumprimentava duas
// vezes seguidas.
//
// Duas causas, as duas no prompt da análise:
//   1. "pedidoSemResposta" existia só como campo do diagnóstico — nada mandava as três mensagens
//      ENTREGAREM o que estava em aberto.
//   2. A regra "PERGUNTA DO CORRETOR SEM RESPOSTA" mandava priorizar a pergunta do CORRETOR entre
//      as três, sem nenhum limite — então ela ganhava do pedido do CLIENTE.
//
// Este teste tranca as três regras novas no prompt principal (o de quem TEM Cérebro), nunca em
// modo prévia — ver a regra da v1247 no CLAUDE.md.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// O trecho analisado é o prompt principal da análise (o que monta as três mensagens).
const ini = src.indexOf('AS TRÊS MENSAGENS PRECISAM TER ÂNGULOS COMERCIAIS DIFERENTES');
assert.ok(ini > -1, 'não achei o prompt principal das três mensagens');
const fim = src.indexOf('RECOMENDAÇÃO DE CONTATO:', ini);
assert.ok(fim > ini, 'não achei o fim do trecho do prompt');
const prompt = src.slice(ini, fim);

// ── 1. O pedido do cliente em aberto manda na mensagem recomendada ───────────────────────────
const blocoPedido = prompt.slice(prompt.indexOf('PEDIDO SEM RESPOSTA DIRETA:'));
assert.ok(blocoPedido, 'o bloco "PEDIDO SEM RESPOSTA DIRETA" precisa existir no prompt');
assert.match(blocoPedido, /manda na mensagem "recomendada"/,
  'quando há pedido do cliente em aberto, ele precisa mandar na mensagem recomendada');
assert.match(blocoPedido, /ENTREGAR o que o cliente pediu/,
  'a recomendada precisa ENTREGAR o pedido, não só citá-lo');
assert.match(blocoPedido, /nunca fazer\s*\n?uma pergunta no lugar da entrega/,
  'a regra precisa proibir explicitamente trocar a entrega por uma pergunta');

// O tempo parado não pode virar desculpa pra tratar o pedido como vencido — no caso real foram
// dois meses entre o pedido e a volta da cliente.
assert.match(blocoPedido, /semanas ou meses/,
  'a regra precisa valer mesmo depois de muito tempo parado — o pedido não vence');

// ── 2. A pergunta do corretor não pode mais atropelar o pedido do cliente ────────────────────
const blocoPergunta = prompt.slice(prompt.indexOf('PERGUNTA DO CORRETOR SEM RESPOSTA:'));
assert.ok(blocoPergunta, 'o bloco "PERGUNTA DO CORRETOR SEM RESPOSTA" precisa continuar existindo');
assert.match(blocoPergunta, /NUNCA GANHA DE UM PEDIDO DO CLIENTE EM ABERTO/,
  'a pergunta do corretor não pode mais ganhar do pedido do cliente');
assert.match(blocoPergunta, /o pedido do CLIENTE vem primeiro/,
  'a ordem precisa estar dita de forma direta: cliente primeiro');

// E refazer a MESMA pergunta que já foi ignorada não pode ser o conteúdo de nenhuma das três.
assert.match(blocoPergunta, /repetir a mensagem que já falhou/,
  'refazer a pergunta que o cliente já ignorou precisa estar proibido como mensagem solta');

// ── 3. Nada de cumprimentar duas vezes ───────────────────────────────────────────────────────
const blocoSaudacao = src.slice(src.indexOf('Saudação correta para este horário'));
assert.match(blocoSaudacao, /NÃO CUMPRIMENTE DUAS VEZES/,
  'precisa existir a regra que impede o segundo "boa tarde" seguido');
assert.match(blocoSaudacao, /ÚLTIMA mensagem do histórico for do CORRETOR e já for um cumprimento/,
  'a regra precisa olhar se a ÚLTIMA mensagem foi um cumprimento do próprio corretor');

// ── 4. As regras moram no prompt de quem TEM Cérebro, não no modo prévia (regra da v1247) ────
// O prompt principal é montado em `const prompt = ...` e recebe o Cérebro pelo prompt de sistema.
const antesDoTrecho = src.slice(0, ini);
const marcaPromptPrincipal = antesDoTrecho.lastIndexOf('Execute a análise usando o Cérebro Comercial');
assert.ok(marcaPromptPrincipal > -1,
  'as regras novas precisam estar no prompt que usa o Cérebro Comercial — nunca só no modo prévia');

console.log('v1253-pedido-do-cliente-manda-na-recomendada: ok');
