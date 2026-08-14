import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1261 — TERCEIRA REANÁLISE DA LEAD MARINA, agora com a v1260 no ar. O que ela devolveu:
//
//   1 "Recomendada": "Marina, para poder filtrar as melhores opções que aceitam seu imóvel na
//     troca, SÓ PRECISO de alguns dados do seu imóvel — pode me passar o bairro, metragem
//     aproximada e quantos dormitórios?"
//   2 "Alternativa": "SE QUISER, posso te ajudar olhando o que o mercado tem... ME SINALIZA só o
//     básico do seu imóvel (bairro e tamanho)... PODE SER ASSIM?"
//   3 "Direta ao ponto": "SE TE AJUDAR, JÁ POSSO AVALIAR SEU IMÓVEL e levantar alternativas nessa
//     linha de 3 dormitórios. Me manda só o bairro e a metragem... Prefere receber por aqui ou
//     prefere que a gente marque pra conversar juntos?"
//
// A v1260 funcionou no essencial: sumiu o "assim que você tiver o valor eu te mando", e o que se
// pede virou dado FÁCIL (bairro, metragem, dormitórios) em vez da conta impossível. A quota também
// pegou — a nº 3 oferece a avaliação.
//
// Sobraram dois defeitos, os dois de ORDEM:
//   a) As TRÊS abrem pedindo ("só preciso de", "me sinaliza", "me manda"). O cliente lê um pedido
//      antes de ler qualquer ganho.
//   b) A jogada mais forte (oferecer a avaliação) caiu na nº 3. A "Recomendada" é a que o corretor
//      manda quando só pode mandar uma — e ela ficou sendo a mais fraca das três.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const bloco = (marca, tam = 1600) => {
  const i = src.indexOf(marca);
  assert.ok(i > -1, `não achei a regra "${marca}"`);
  return { i, txt: src.slice(i, i + tam).replace(/\s+/g, ' ') };
};

// ── 1. Nenhuma das três abre pedindo ─────────────────────────────────────────────────────────
const abertura = bloco('NENHUMA DAS TRÊS PODE ABRIR PEDINDO');
assert.match(abertura.txt, /A primeira frase é sempre o que o CORRETOR vai fazer/,
  'a regra precisa dizer o que VAI na primeira frase, não só o que não vai');

// As aberturas que a reanálise real produziu precisam estar listadas.
for (const frase of ['só preciso de', 'me manda', 'me passa', 'me sinaliza']) {
  assert.ok(abertura.txt.includes(`"${frase}"`),
    `a abertura "${frase}" saiu da reanálise real e precisa estar listada como proibida`);
}
assert.match(abertura.txt, /pedido sem ganho na frente é ignorado/,
  'a regra precisa explicar o porquê, não só proibir');

// O par errado/certo com a MESMA pergunta, só que reordenada — é o que ensina a correção.
assert.match(abertura.txt, /ERRADO: "Pra filtrar as opções, só preciso do bairro e da metragem"/,
  'precisa ter o exemplo errado, tirado da própria sugestão nº 1');
assert.match(abertura.txt, /CERTO: "Já vou separar as opções/,
  'e o exemplo certo, com a mesma pergunta no fim');
assert.match(abertura.txt, /Mesma pergunta, ordem invertida/,
  'precisa ficar claro que a pergunta não some — só muda de lugar');

// Pedir licença pra trabalhar enfraquece a oferta.
for (const hedge of ['se quiser', 'se te ajudar', 'pode ser assim?']) {
  assert.ok(abertura.txt.includes(`"${hedge}"`),
    `"${hedge}" apareceu na reanálise real e precisa estar cortado`);
}
assert.match(abertura.txt, /não porque foi autorizado/,
  'o princípio precisa estar dito: o corretor faz porque é o trabalho dele');

// ── 2. A recomendada é a mais forte das três ─────────────────────────────────────────────────
const forte = bloco('A "recomendada" É A MAIS FORTE DAS TRÊS, SEMPRE');
assert.match(forte.txt, /a que oferece É a recomendada/,
  'se uma oferece algo concreto e as outras só pedem, a que oferece tem que ser a nº 1');
assert.match(forte.txt, /nunca deixe a jogada mais forte em segundo ou terceiro lugar/,
  'precisa proibir explicitamente enterrar a melhor mensagem — foi o que aconteceu com a avaliação');
assert.match(forte.txt, /se eu só pudesse mandar UMA, seria essa\?/,
  'precisa existir a pergunta de conferência antes de fechar');
assert.match(forte.txt, /Se a resposta for não, troque a ordem/,
  'e a ação corretiva: trocar a ordem');

// ── 3. As regras ficam ANTES da quota, que é quem cria a mensagem forte ──────────────────────
// Ordem importa: a IA precisa ler "a recomendada é a mais forte" junto com "uma das três tem que
// oferecer a avaliação", senão continua criando a mensagem forte e deixando ela em terceiro.
const quota = src.indexOf('QUOTA OBRIGATÓRIA QUANDO O CLIENTE ENTRA COM IMÓVEL');
assert.ok(quota > -1, 'a quota da v1260 precisa continuar existindo');
assert.ok(abertura.i < quota && forte.i < quota,
  'as duas regras de ordem precisam vir antes da quota, pra serem lidas junto com ela');

// ── 4. No prompt de quem TEM Cérebro (regra da v1247), sem dado comercial ────────────────────
const iniPrincipal = src.indexOf('Execute a análise usando o Cérebro Comercial');
for (const [nome, b] of [['abertura', abertura], ['recomendada mais forte', forte]]) {
  assert.ok(b.i > iniPrincipal,
    `a regra de ${nome} precisa estar no prompt que usa o Cérebro Comercial — nunca só no modo prévia`);
  assert.doesNotMatch(b.txt, /R\$|Personalité|Marina|430\.000|1\.450\.000/,
    'nenhuma regra pode carregar valor, empreendimento ou nome de cliente');
}

console.log('v1261-abrir-entregando-e-recomendada-mais-forte: ok');
