import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1260 — REANÁLISE DA LEAD MARINA COM A v1259 NO AR. Metade melhorou, metade não, e a metade que
// falhou era de regras que EU já tinha escrito e que não pegaram.
//
// O que a reanálise devolveu:
//   1 "Recomendada": "Assim que vocês tiverem uma ideia do valor do imóvel, posso te mandar as
//     opções... Me sinaliza assim que conseguir aí?"
//   2 "Alternativa": "...posso ir te mostrando algumas opções... Quer já ir olhando esses
//     exemplos para ir comparando?"
//   3 "Direta ao ponto": "assim que você conseguir o valor do imóvel, já consigo separar as
//     melhores opções... Me avisa quando souber, que eu já te envio as alternativas prontas."
//
// Melhorou de verdade: sumiu o "faz alguns dias", o "tudo bem por aí?", o "fico à disposição" e o
// "conseguiu falar com seu esposo?". Nenhuma exige mais a faixa de valor como pergunta seca.
//
// Mas as TRÊS continuavam com a entrega REFÉM de um dado que a cliente ainda ia buscar — e a nº 3,
// que devia ser a mais objetiva, ficou a mais passiva de todas ("me avisa quando souber"). Nenhuma
// ofereceu o óbvio: o corretor avaliar o imóvel dela. A regra da v1256 já mandava fazer isso, mas
// era só uma proibição no meio de um parágrafo — a IA obedecia o "não peça a diferença" e parava
// aí, sem fazer a parte positiva.
//
// Esta versão troca a proibição solta por duas exigências verificáveis sobre o RESULTADO.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const bloco = (marca, tam = 1600) => {
  const i = src.indexOf(marca);
  assert.ok(i > -1, `não achei a regra "${marca}"`);
  return { i, txt: src.slice(i, i + tam).replace(/\s+/g, ' ') };
};

// ── 1. A construção "assim que você tiver X, eu te mando Y" fica banida ──────────────────────
const refem = bloco('CONSTRUÇÃO PROIBIDA — "ASSIM QUE VOCÊ TIVER X, EU TE MANDO Y"');
assert.match(refem.txt, /NENHUMA das três mensagens pode usá-la/,
  'a proibição precisa valer pras três, não só pra recomendada');

// As frases que a reanálise realmente produziu precisam estar listadas como exemplo do que não fazer.
for (const frase of [
  'assim que você tiver/conseguir/souber o valor, eu te mando as opções',
  'me avisa quando souber que eu já envio',
  'me sinaliza assim que conseguir',
  'assim que vocês tiverem uma ideia, eu adianto',
]) {
  assert.ok(refem.txt.includes(frase),
    `a construção "${frase}" saiu da reanálise real e precisa estar listada como proibida`);
}
assert.match(refem.txt, /deixam DEVER DE CASA com o cliente e o corretor parado/,
  'a regra precisa explicar por que isso mata a conversa');
assert.match(refem.txt, /A entrega vai PRIMEIRO e sem condição/,
  'precisa estar dito que a entrega vem primeiro, sem pedágio');

// Um teste prático que a IA aplica antes de escrever cada mensagem.
assert.match(refem.txt, /se ela só acontece DEPOIS que o cliente fizer alguma coisa, está errada/,
  'precisa existir um teste prático, não só uma lista de frases');
assert.match(refem.txt, /começando pelo que o CORRETOR faz agora/,
  'a correção precisa apontar o caminho: começar pelo que o corretor faz sozinho');

// ── 2. Quota: pelo menos UMA das três oferece a avaliação ────────────────────────────────────
// A v1256 já dizia "avaliar é trabalho do corretor", mas só como proibição de pedir a diferença.
// Virou exigência sobre o resultado, com quantidade — dá pra conferir olhando as três mensagens.
const quota = bloco('QUOTA OBRIGATÓRIA QUANDO O CLIENTE ENTRA COM IMÓVEL');
assert.match(quota.txt, /PELO MENOS UMA das três mensagens PRECISA oferecer que o CORRETOR faça a avaliação/,
  'precisa ser uma exigência com quantidade, não um conselho');
assert.match(quota.txt, /"imovelDoCliente" preenchido e sem valor declarado/,
  'a quota precisa estar amarrada ao campo criado na v1259, pra saber quando vale');
assert.match(quota.txt, /endereço, bairro, metragem/,
  'o que se pede ao cliente tem que ser fácil de dar');
assert.match(quota.txt, /nenhuma das três pode ficar esperando o cliente descobrir esse valor sozinho/,
  'e nenhuma pode continuar esperando o cliente resolver isso');
assert.match(quota.txt, /Quem chega com o número é o corretor/,
  'o princípio precisa estar dito de forma curta e memorável');

// ── 3. No prompt de quem TEM Cérebro (regra da v1247) ────────────────────────────────────────
const iniPrincipal = src.indexOf('Execute a análise usando o Cérebro Comercial');
assert.ok(iniPrincipal > -1, 'não achei o prompt principal');
for (const [nome, b] of [['entrega refém', refem], ['quota da avaliação', quota]]) {
  assert.ok(b.i > iniPrincipal,
    `a regra de ${nome} precisa estar no prompt que usa o Cérebro Comercial — nunca só no modo prévia`);
}

// ── 4. Sem informação comercial cravada ──────────────────────────────────────────────────────
for (const b of [refem, quota]) {
  assert.doesNotMatch(b.txt, /R\$|Personalité|Marina|430\.000|1\.450\.000/,
    'nenhuma regra pode carregar valor, empreendimento ou nome de cliente');
}

console.log('v1260-entrega-nao-fica-de-refem: ok');
