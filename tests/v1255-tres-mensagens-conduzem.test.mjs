import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1255 — DUAS ORDENS DO DONO, saídas da análise da conversa real da lead "Rose" (Renaissance).
//
// Conversa: 05/06 ela se interessou pela casa suspensa, apontou as unidades da parte alta e
// perguntou se podia entrar com uma casa central em permuta. Depois disso, 42 dias de silêncio.
// Os dois follow-ups (17/07 e 27/07) abriam com "Faz alguns dias que conversamos..." — e as
// sugestões do app repetiam o mesmo vício ("Passaram alguns dias desde nossa última conversa").
//
// 1. TEMPO PARADO NÃO ENTRA NA MENSAGEM. O dono foi direto: "não quero q use os dias. e vc deveria
//    perceber q isso é um erro tb e nem sugerir." Acertar o número ("faz 42 dias") é PIOR que
//    errar — falar do intervalo é cobrança, põe o cliente na defensiva e faz a mensagem girar em
//    torno da espera do corretor. O intervalo continua sendo dado INTERNO (serve pro app decidir a
//    hora de chamar); dentro da mensagem não aparece de forma nenhuma.
//
// 2. PRAZO REAL DO PRODUTO É O MELHOR MOTIVO DE RETOMADA. Na conversa da Rose existia um relógio
//    de verdade — "o lançamento será em agosto", com pré-reserva garantindo as melhores unidades —
//    e nenhuma das três sugestões usou. Com a trava óbvia: só vale prazo que esteja LITERALMENTE
//    na conversa ou no Cérebro. Urgência inventada ("últimas unidades", "vai subir") é proibida —
//    seria informação comercial cravada pela IA, exatamente o que o CLAUDE.md proíbe.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. Nada de falar do tempo parado ─────────────────────────────────────────────────────────
const ini = src.indexOf('TEMPO PARADO NÃO ENTRA NA MENSAGEM');
assert.ok(ini > -1, 'precisa existir a regra que proíbe falar do tempo parado dentro da mensagem');
// As quebras de linha do arquivo cortam frases no meio ("não tive\nretorno"), então compara com o
// texto em uma linha só — é o que a IA lê.
const blocoTempo = src.slice(ini, ini + 1400).replace(/\s+/g, ' ');

// As formas que apareceram de verdade nas mensagens do dono e nas sugestões do app.
for (const frase of ['faz alguns dias', 'passaram alguns dias', 'desde nossa última conversa', 'você sumiu', 'não tive retorno']) {
  assert.ok(blocoTempo.includes(frase),
    `a regra precisa listar a construção proibida "${frase}" — foi uma das que apareceram de verdade`);
}
assert.match(blocoTempo, /faz X dias\/semanas\/meses/,
  'a proibição precisa cobrir também a forma com número, não só a vaga');
assert.match(blocoTempo, /PIOR do que dizer "faz alguns dias"/,
  'acertar o número tem que estar dito como PIOR, não como a correção — foi o erro que o dono apontou');
assert.match(blocoTempo, /é cobrança/,
  'a regra precisa explicar POR QUE é errado (cobrança), não só listar frases');
assert.match(blocoTempo, /dado INTERNO/,
  'o intervalo continua existindo pro app decidir a hora de chamar — só não entra na mensagem');

// ── 2. Prazo real do produto como motivo de retomada ─────────────────────────────────────────
const iniPrazo = src.indexOf('PRAZO DO PRODUTO É O MELHOR MOTIVO DE RETOMADA');
assert.ok(iniPrazo > -1, 'precisa existir a regra do prazo real do produto como motivo de retomada');
const blocoPrazo = src.slice(iniPrazo, iniPrazo + 1400);

assert.match(blocoPrazo, /lançamento/, 'lançamento precisa estar entre os prazos reconhecidos');
assert.match(blocoPrazo, /pré-reserva/, 'pré-reserva precisa estar entre os prazos reconhecidos');
assert.match(blocoPrazo, /compare com a data atual da análise/,
  'o prazo só vira motivo depois de comparado com a data de hoje');

// ── 3. A trava contra urgência inventada ─────────────────────────────────────────────────────
assert.match(blocoPrazo, /LITERALMENTE na conversa ou no\s*\n?Cérebro/,
  'só pode usar prazo que esteja literalmente na conversa ou no Cérebro');
for (const inventada of ['últimas unidades', 'os valores vão', 'estão acabando']) {
  assert.ok(blocoPrazo.includes(inventada),
    `a regra precisa dar "${inventada}" como exemplo explícito de urgência PROIBIDA`);
}
assert.match(blocoPrazo, /pior do que não mandar mensagem nenhuma/,
  'inventar urgência precisa estar dito como pior do que não mandar nada');

// ── 4. As três mensagens conduzem, não fazem check-in ────────────────────────────────────────
// O dono aprovou uma mensagem escrita à mão e pediu que as TRÊS fossem assim: lendo o contexto
// todo e decidindo como conduzir. O que aquela mensagem tinha, e as três do app não tinham:
// abria por um fato concreto (o lançamento), destravava o que estava parado (a permuta) com um
// passo que a cliente fazia em 10 segundos (mandar o endereço), explicava o ganho DELA ("decidem
// com o valor na mão") e fechava com duas datas — em vez de "fico à disposição".
const iniCond = src.indexOf('CADA MENSAGEM É UMA CONDUÇÃO, NUNCA UM CHECK-IN');
assert.ok(iniCond > -1, 'precisa existir a regra que obriga as três mensagens a conduzir');
const blocoCond = src.slice(iniCond, iniCond + 2200).replace(/\s+/g, ' ');

assert.match(blocoCond, /as três têm a MESMA espinha obrigatória/,
  'a espinha precisa valer pras TRÊS, não só pra recomendada');
assert.match(blocoCond, /ABRE POR UM FATO CONCRETO DESTA CONVERSA/, 'passo 1: abrir por fato concreto');
assert.match(blocoCond, /DESTRAVA O QUE ESTÁ PARADO/, 'passo 2: destravar com um passo executável');
assert.match(blocoCond, /FECHA COM UM PRÓXIMO PASSO QUE TEM DONO E FORMATO/, 'passo 3: fechar com passo concreto');
assert.match(blocoCond, /DUAS opções concretas/,
  'encontro precisa vir com duas opções — "qualquer dia e horário" foi o erro real da conversa');
assert.match(blocoCond, /baixa PRESSÃO,\s*não de baixo CONTEÚDO/,
  'a "maisSuave" não pode virar desculpa pra mensagem vazia — foi a sugestão 2 do print');
assert.match(blocoCond, /couber em "e aí, tudo bem\? qualquer coisa me chama", ela está errada/,
  'precisa existir um teste prático que reprove o check-in educado');

// Quem decide junto (o esposo) vira facilitação, não cobrança.
const blocoDecide = src.slice(src.indexOf('QUEM DECIDE JUNTO:')).slice(0, 900).replace(/\s+/g, ' ');
assert.match(blocoDecide, /conseguiu falar com seu esposo\?/,
  'a pergunta de cobrança ao co-decisor precisa estar citada como PROIBIDA — foi o que os dois follow-ups fizeram');
assert.match(blocoDecide, /entrega ALGO QUE FACILITE essa conversa/,
  'no lugar da cobrança, a mensagem precisa entregar algo que ajude os dois a decidir');

// O que o cliente escolheu é por onde a retomada começa.
const blocoFio = src.slice(src.indexOf('O QUE O CLIENTE ESCOLHEU É O FIO DA CONVERSA:')).slice(0, 900).replace(/\s+/g, ' ');
assert.match(blocoFio, /é POR AÍ que a retomada começa/,
  'retomar pela unidade/característica que o cliente escolheu precisa ser regra');
assert.match(blocoFio, /disparo em massa/,
  'a regra precisa dizer por que voltar ao genérico é ruim');

// ── 5. As regras moram no prompt de quem TEM Cérebro (regra da v1247) ────────────────────────
// A de linguagem fica no prompt de SISTEMA (que termina no "Responda somente com JSON");
// as de condução ficam no prompt principal, o que recebe o Cérebro Comercial.
const fimSistema = src.indexOf('Responda somente com JSON válido no formato solicitado.');
assert.ok(ini < fimSistema,
  'a regra do tempo parado precisa estar no prompt de sistema, junto das outras regras de linguagem');
const iniPrincipal = src.indexOf('Execute a análise usando o Cérebro Comercial');
assert.ok(iniPrincipal > fimSistema, 'não achei o início do prompt principal');
for (const [nome, pos] of [['prazo real', iniPrazo], ['condução', iniCond]]) {
  assert.ok(pos > iniPrincipal,
    `a regra de ${nome} precisa estar no prompt que usa o Cérebro Comercial — nunca só no modo prévia`);
}

console.log('v1255-tres-mensagens-conduzem: ok');
