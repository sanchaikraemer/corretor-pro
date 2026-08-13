import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1256 — CASO REAL "MARINA" (Personalité), trazido pelo dono já COM a v1255 no ar há 3 horas.
//
// A v1255 arrumou a FORMA das três sugestões (sem "faz alguns dias", sem "tudo bem por aí?", sem
// "fico à disposição"). Este caso mostrou que faltava o JULGAMENTO: as três sugestões pediam a
// MESMA coisa — a faixa de valor / a diferença que a família investiria além do imóvel dela.
//
// Por que isso estava errado, olhando a conversa:
//   • 13/08 19:35 — a cliente ACABOU de dizer "Vou ver o valor correto". O dado já vinha vindo;
//     pedir de novo é desconfiança e faz ela responder duas vezes a mesma coisa.
//   • O corretor já tinha pedido esse mesmo dado CINCO vezes (09/07 19:02, 10/07, 28/07, 13/08
//     19:18 e 13/08 19:33) e nunca recebeu. Pedir a sexta não é próximo passo.
//   • Ela quer PERMUTA ("Queremos encaixar o nosso") e não sabe quanto vale o imóvel dela — por
//     isso mesmo ia "ver o valor correto". Perguntar "quanto pretendem investir na diferença" é
//     pedir uma conta que depende de um número que ela não tem: é impossível de responder.
//   • Ela pediu 3 dormitórios TRÊS vezes (09/07 18:28, 13/08 19:14) e até hoje não recebeu UMA
//     opção. O corretor disse "temos algumas opções com 3 dormitórios" em 09/07 e nunca mandou —
//     prometer não é entregar, e a entrega ficou refém de um dado que nunca vinha.
//
// As quatro regras abaixo saem daí. Todas moram no prompt de quem TEM Cérebro (regra da v1247).

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const bloco = (marca, tam = 1400) => {
  const i = src.indexOf(marca);
  assert.ok(i > -1, `não achei a regra "${marca}"`);
  return { i, txt: src.slice(i, i + tam).replace(/\s+/g, ' ') };
};

// ── 1. Cliente já prometeu trazer o dado ─────────────────────────────────────────────────────
const promessa = bloco('O CLIENTE JÁ PROMETEU TRAZER O DADO — NÃO PEÇA DE NOVO');
assert.match(promessa.txt, /vou ver o valor/,
  'a frase real da cliente ("vou ver o valor") precisa estar entre os exemplos de promessa');
assert.match(promessa.txt, /NENHUMA das três mensagens pode voltar a pedir a MESMA informação/,
  'a proibição precisa valer pras TRÊS sugestões, não só pra recomendada');
assert.match(promessa.txt, /nunca cobra/,
  'quando não dá pra avançar sem o dado, a mensagem ajuda a consegui-lo — não cobra');

// ── 2. O mesmo pedido repetido está falhando ─────────────────────────────────────────────────
const repetido = bloco('O MESMO PEDIDO FEITO VÁRIAS VEZES ESTÁ FALHANDO');
assert.match(repetido.txt, /conte, no histórico, quantas vezes o CORRETOR já pediu/,
  'a regra precisa mandar CONTAR as vezes, não julgar "no olho"');
assert.match(repetido.txt, /DUAS ou mais/, 'precisa existir um limite objetivo (duas vezes)');
assert.match(repetido.txt, /NÃO SABE a resposta/,
  'a regra precisa explicar a causa provável: o cliente não sabe, não está escondendo');
assert.match(repetido.txt, /entregue o que dá pra entregar SEM aquele dado/,
  'a saída precisa ser entregar sem o dado, não insistir');

// ── 3. Avaliar o imóvel é trabalho do corretor ───────────────────────────────────────────────
const avaliacao = bloco('AVALIAR O IMÓVEL É TRABALHO DO CORRETOR, NÃO DO CLIENTE');
assert.match(avaliacao.txt, /queremos encaixar o nosso/i,
  'a frase real da cliente precisa estar entre os sinais de permuta');
assert.match(avaliacao.txt, /é PROIBIDO pedir a diferença, o troco ou "quanto pretendem investir/,
  'pedir a diferença sem saber o valor do imóvel precisa estar proibido com todas as letras');
assert.match(avaliacao.txt, /OFERECER A AVALIAÇÃO/,
  'no lugar do pedido impossível, o corretor oferece a avaliação');
assert.match(avaliacao.txt, /endereço, bairro, metragem/,
  'o que se pede ao cliente tem que ser fácil de dar — endereço, bairro, metragem');

// ── 4. Promessa não é entrega, e entrega não espera dado ─────────────────────────────────────
const entrega = bloco('PROMESSA NÃO É ENTREGA, E ENTREGA NÃO ESPERA DADO');
assert.match(entrega.txt, /"temos opções assim" NÃO atende o pedido/,
  'dizer que tem opções não pode contar como pedido atendido — foi o que travou a conversa desde 09\/07');
assert.match(entrega.txt, /PROIBIDO segurar a entrega esperando o cliente informar/,
  'a entrega não pode ficar refém do orçamento do cliente');
assert.match(entrega.txt, /amostra/,
  'a saída é mandar uma amostra de opções já');
assert.match(entrega.txt, /EMENDADO/,
  'o que falta é pedido emendado na entrega, nunca no lugar dela');

// ── 5. Tudo no prompt de quem TEM Cérebro (regra da v1247) ───────────────────────────────────
const iniPrincipal = src.indexOf('Execute a análise usando o Cérebro Comercial');
assert.ok(iniPrincipal > -1, 'não achei o prompt principal');
for (const [nome, b] of [['promessa', promessa], ['pedido repetido', repetido], ['avaliação', avaliacao], ['entrega', entrega]]) {
  assert.ok(b.i > iniPrincipal,
    `a regra de ${nome} precisa estar no prompt que usa o Cérebro Comercial — nunca só no modo prévia`);
}

// ── 6. Nada de informação comercial cravada ──────────────────────────────────────────────────
// As regras falam de CONDUTA. Nenhum valor, empreendimento ou nome de cliente pode ter entrado no
// código junto com elas (regra permanente do projeto).
for (const b of [promessa, repetido, avaliacao, entrega]) {
  assert.doesNotMatch(b.txt, /R\$|Personalité|Renaissance|Marina|Rose/,
    'nenhuma regra pode carregar valor, empreendimento ou nome de cliente');
}

console.log('v1256-nao-pedir-dado-que-o-cliente-nao-tem: ok');
