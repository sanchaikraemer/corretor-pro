import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1259 — COBRANÇA DIRETA DO DONO: "vc tem o histórico inteiro, nao precisa ver print. so te mandei
// vc ver o quão errado esta a analise, nao analisa tudo como deveria".
//
// Ele está certo. Na conversa da lead Marina, as três sugestões pediam a FAIXA DE VALOR — e a
// própria conversa já a delimitava:
//   • 07/07 — o corretor apresentou um imóvel de R$ 1.450.000.
//   • 09/07 18:22 — a cliente: "Tá muito além do meu poder" → aquele valor é TETO.
//   • 09/07 18:23 — o corretor ofereceu "a partir de 430.000" e ela NÃO recusou: seguiu a conversa
//     falando do imóvel dela → aquela faixa é PISO plausível.
// A faixa estava ali, deduzível, e mesmo assim as três perguntavam.
//
// E havia mais coisa dita e não usada: ela mora num imóvel próprio que "tá achando muito grande"
// (motivo da mudança = reduzir de tamanho), quer manter 3 dormitórios, quer "encaixar o nosso"
// (permuta decidida) e decide com "meu esposo e filhos" (vários decisores, não só o cônjuge).
//
// A análise não tinha onde guardar nada disso — o diagnóstico só tinha cinco campos, nenhum deles
// sobre o que o cliente JÁ contou. Por isso a IA voltava a perguntar. Esta versão cria os campos,
// obriga a extração e mostra o resultado na tela, pro dono conferir o que foi entendido.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// ── 1. Os campos novos existem no formato pedido à IA ────────────────────────────────────────
const schema = src.slice(src.indexOf('Formato JSON obrigatório:'), src.indexOf('REGRAS PARA AS TRÊS MENSAGENS'));
for (const campo of ['jaSabemos', 'faixaDeValor', 'imovelDoCliente', 'motivoDaMudanca', 'quemDecide']) {
  assert.ok(schema.includes(`"${campo}"`), `o formato JSON precisa pedir "${campo}" à IA`);
}

// ── 2. E são gravados junto do resto do diagnóstico (senão a tela nunca os vê) ───────────────
const gravacao = src.slice(src.indexOf('pendenciaFinanceira: clean('), src.indexOf('pendenciaFinanceira: clean(') + 1400);
for (const campo of ['jaSabemos', 'faixaDeValor', 'imovelDoCliente', 'motivoDaMudanca', 'quemDecide']) {
  assert.ok(gravacao.includes(`${campo}:`), `"${campo}" precisa ser gravado no diagnóstico`);
}
assert.match(gravacao, /jaSabemos: arr\(/, '"jaSabemos" é uma lista — precisa ser tratada como lista');

// ── 3. A regra que manda procurar a resposta antes de perguntar ──────────────────────────────
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O dono reescreveu o pedido inteiro: o bloco longo (com o
// TETO/PISO deduzidos da reação do cliente, "SILÊNCIO NÃO É ACEITE", os sinais de permuta e a lista
// de quem decide) saiu do produto. Ficou a ordem curta — procurar antes de perguntar, inclusive
// quando a resposta apareceu de forma indireta — e a proibição de virar interrogatório.
const i = src.indexOf('ANTES DE PERGUNTAR, PROCURE A RESPOSTA NA CONVERSA');
assert.ok(i > -1, 'precisa existir a regra que manda procurar na conversa antes de perguntar');
const regra = src.slice(i, i + 1200).replace(/\s+/g, ' ');

assert.match(regra, /inclusive quando ela apareceu de forma indireta/,
  'a resposta indireta continua contando como resposta');
assert.match(src, /Não repita pergunta já respondida nem transforme falta de dado em interrogatório/,
  'e as três mensagens continuam proibidas de perguntar o que a conversa já respondeu');
assert.match(src, /Silêncio não confirma resumo, interpretação, preço, orçamento ou objeção\./,
  'silêncio continua não valendo como aceite — é o que evitava inventar a faixa de valor');
assert.match(src, /"faixaDeValor":"somente faixa sustentada por declaração ou reação inequívoca do cliente; silêncio não conta"/,
  'a faixa de valor só vale quando o cliente sustentou — a régua do caso Marina');

// ── 4. Nada disso vale se ficar escondido: aparece na tela do cliente ────────────────────────
for (const rotulo of [
  'Faixa de valor que a conversa já indica',
  'Imóvel do cliente na negociação',
  'Por que ele quer mudar',
  'Quem decide junto',
  'O cliente já contou',
]) {
  assert.ok(app.includes(`'${rotulo}'`), `a tela do cliente precisa mostrar "${rotulo}"`);
}
assert.match(app, /function cp704Semvalor/,
  'precisa existir o filtro que evita linha dizendo "Não identificado" na tela');

// ── 5. No prompt de quem TEM Cérebro (regra da v1247) ────────────────────────────────────────
assert.ok(i > src.indexOf('Execute a análise usando o Cérebro Comercial'),
  'a regra precisa estar no prompt que usa o Cérebro Comercial — nunca só no modo prévia');

// ── 6. Sem informação comercial cravada ──────────────────────────────────────────────────────
assert.doesNotMatch(regra, /R\$|1\.450\.000|430\.000|Personalité|Marina/,
  'nenhum valor, empreendimento ou nome de cliente pode ter entrado no código');

console.log('v1259-usar-o-que-a-conversa-ja-disse: ok');
