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
const schema = src.slice(src.indexOf('Formato JSON obrigatório:'), src.indexOf('Formato JSON obrigatório:') + 900);
for (const campo of ['jaSabemos', 'faixaDeValor', 'imovelDoCliente', 'motivoDaMudanca', 'quemDecide']) {
  assert.ok(schema.includes(`"${campo}"`), `o formato JSON precisa pedir "${campo}" à IA`);
}

// ── 2. E são gravados junto do resto do diagnóstico (senão a tela nunca os vê) ───────────────
const gravacao = src.slice(src.indexOf('pendenciaFinanceira: clean('), src.indexOf('pendenciaFinanceira: clean(') + 900);
for (const campo of ['jaSabemos', 'faixaDeValor', 'imovelDoCliente', 'motivoDaMudanca', 'quemDecide']) {
  assert.ok(gravacao.includes(`${campo}:`), `"${campo}" precisa ser gravado no diagnóstico`);
}
assert.match(gravacao, /jaSabemos: arr\(/, '"jaSabemos" é uma lista — precisa ser tratada como lista');

// ── 3. A regra que manda procurar a resposta antes de perguntar ──────────────────────────────
const i = src.indexOf('ANTES DE PERGUNTAR, PROCURE A RESPOSTA NA CONVERSA');
assert.ok(i > -1, 'precisa existir a regra que manda procurar na conversa antes de perguntar');
const regra = src.slice(i, i + 2600).replace(/\s+/g, ' ');

assert.match(regra, /Percorra o histórico inteiro/, 'a regra precisa mandar percorrer o histórico inteiro');
assert.match(regra, /inclusive de forma INDIRETA/,
  'o que o cliente disse de forma indireta também conta — foi o caso da faixa de valor');
assert.match(regra, /é PROIBIDO que qualquer uma das três mensagens pergunte algo que esses campos já respondem/,
  'as três ficam proibidas de perguntar o que os campos já respondem');

// A dedução da faixa a partir da reação a valores citados — o miolo do caso real.
assert.match(regra, /esse valor é TETO/, '"muito além" precisa virar teto');
assert.match(regra, /é PISO plausível/, 'valor mais baixo não recusado precisa virar piso');
assert.match(regra, /não espere ele declarar um número/,
  'a faixa se deduz da reação; esperar o cliente declarar foi exatamente o que travou a conversa');
assert.match(regra, /Só use "Não identificado" quando NENHUM valor tiver sido citado/,
  'só pode dizer que não sabe quando nenhum valor foi citado na conversa');

// O imóvel do cliente é o centro quando existe permuta.
assert.match(regra, /queremos encaixar o nosso/i, 'a frase real da cliente precisa estar entre os sinais de permuta');
assert.match(regra, /o que AINDA FALTA saber pra avaliar/,
  'o campo precisa terminar apontando o que falta levantar — é o trabalho do corretor');

// Motivo da mudança e quem decide.
assert.match(regra, /está grande demais/, 'o motivo real da cliente precisa estar entre os exemplos');
assert.match(regra, /esposo, esposa, filhos/, 'quem decide precisa incluir filhos, não só o cônjuge');

// ── 3b. O que o PRÓPRIO corretor já resumiu e já apresentou também é fato ────────────────────
// Em 10/07 o corretor escreveu "Entendi que vocês procuram reduzir o tamanho, mas manter os 3
// quartos" — e a cliente não corrigiu. Estava fechado. Mesmo assim as sugestões seguiram tratando
// o perfil como desconhecido. E em 09/07 ele mesmo disse "temos outras opções a partir de
// 430.000": esse piso existe na conversa e não precisava ser perguntado a ninguém.
const assentado = src.slice(src.indexOf('O RESUMO QUE O PRÓPRIO CORRETOR JÁ FEZ É FATO ASSENTADO'), src.indexOf('O RESUMO QUE O PRÓPRIO CORRETOR JÁ FEZ É FATO ASSENTADO') + 1500).replace(/\s+/g, ' ');
assert.ok(assentado.length > 50, 'precisa existir a regra do resumo do corretor como fato assentado');
assert.match(assentado, /reduzir o tamanho mas manter os 3 quartos/,
  'o resumo real que o corretor escreveu precisa estar como exemplo');
assert.match(assentado, /o cliente NÃO corrigiu depois, esse resumo está CONFIRMADO/,
  'silêncio do cliente depois do resumo do corretor precisa valer como confirmação');
assert.match(assentado, /valores, produtos e faixas que ELE citou/,
  'o que o próprio corretor apresentou também é dado assentado');
assert.match(assentado, /não precisa ser perguntado a ninguém/,
  'o piso que o corretor já informou não pode virar pergunta');

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
