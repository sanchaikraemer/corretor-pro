import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url).pathname, 'utf8');

// v969 — dois prints reais do dono mostraram "lembrete fantasma" na Agenda pra leads que ele
// nunca agendou nada:
// 1. Um card mostrava "Lembrete de hoje" com o texto de uma MENSAGEM COPIADA (sugestão da IA)
//    que começava "Estava lembrando da nossa conversa sobre o Personalité...".
// 2. Outro mostrava "Lembrete venceu" com uma mensagem do CLIENTE falando de preço de imóveis,
//    que continha "...o teu eu não lembro o preço de lançamento".
// Causa: o radical "lembr\w*" no comando de lembreteDoTexto casava com "lembrando" (relato, não
// comando) e "não lembro" (o oposto de um comando — esquecimento), e lembreteDaTimeline (varredura
// do histórico salvo) não pulava mensagens do tipo "mensagem_enviada" (cópia de sugestão da IA),
// mesmo já existindo essa proteção pro texto recém-submetido.

const iniTexto = src.indexOf('function lembreteDoTexto(txt, baseDate) {');
const fimTexto = src.indexOf('\nfunction normalizarTextoV684');
assert.ok(iniTexto !== -1 && fimTexto !== -1, 'lembreteDoTexto não encontrada');
const lembreteDoTextoSrc = src.slice(iniTexto, fimTexto);

const iniTimeline = src.indexOf('function fazerLembrete(dias, motivo, base) {');
const fimTimeline = src.indexOf('\n  // Mensagem copiada não pode gerar lembrete');
assert.ok(iniTimeline !== -1 && fimTimeline !== -1, 'fazerLembrete/lembreteDaTimeline não encontradas');
const timelineSrc = src.slice(iniTimeline, fimTimeline);

const { lembreteDoTexto, lembreteDaTimeline } = eval(`
  ${lembreteDoTextoSrc}
  ${timelineSrc}
  ({ lembreteDoTexto, lembreteDaTimeline });
`);

const agoraIso = new Date().toISOString();

// 1. Caso real "Jamil": mensagem copiada com "lembrando" + "hoje" não pode virar lembrete.
assert.equal(
  lembreteDoTexto('Olá Jamil, tudo bem? Estava lembrando da nossa conversa sobre o Personalité e das possibilidades que comentamos, ainda hoje consigo te mandar mais detalhes.'),
  null,
  '"estava lembrando" não é comando de agendar, mesmo com "hoje" na frase'
);

// 2. Caso real "Italo": mensagem do cliente com "não lembro" + preços não pode virar lembrete.
assert.equal(
  lembreteDoTexto('O Prime que você mora, os de esquina foram vendidos por 600mil no lançamento, e na entrega teve gente que revendeu por 1.200mil. O teu eu não lembro o preço de lançamento, mas hoje deve valer bem mais.'),
  null,
  '"não lembro" é o oposto de um comando de lembrete, mesmo com "hoje" na frase'
);

// 3. "lembrança"/"lembranças" (substantivo) também não é comando.
assert.equal(
  lembreteDoTexto('Foi uma boa lembrança daquela visita, combinamos tudo direitinho.'),
  null,
  '"lembrança" (substantivo) não é comando'
);

// 4. Comandos de verdade continuam funcionando (não pode quebrar o recurso real).
// (dia da semana, ex. "sábado", usa diasAteDiaSemana — função fora deste recorte de teste,
// já coberta por tests/v957-dia-semana-baseDate-fuso-br.test.mjs; aqui testa só o radical lembr.)
assert.ok(lembreteDoTexto('Lembra de mim amanhã, combinado?'), '"lembra de mim" + prazo continua sendo comando válido');
assert.ok(lembreteDoTexto('Lembrete: ligar pra ela daqui a 2 dias.'), '"lembrete:" + prazo explícito continua sendo comando válido');
assert.ok(lembreteDoTexto('Pode marcar a visita pra amanhã?'), 'comando "marcar" sem radical lembr continua funcionando');

// 5. lembreteDaTimeline ignora entradas type:"mensagem_enviada" (sugestão copiada), mesmo que o
// texto delas bata com um comando+data — mesma proteção que já existia pro texto recém-submetido.
const timelineComSugestaoCopiada = [
  { text: 'Estava lembrando de você, será que hoje consigo uma resposta sua sobre o apartamento?', iso: agoraIso, type: 'mensagem_enviada', source: 'manual' },
];
assert.equal(lembreteDaTimeline(timelineComSugestaoCopiada), null, 'mensagem_enviada (sugestão copiada) não pode gerar lembrete pelo próprio texto');

// 6. Mas uma anotação REAL do corretor (não mensagem_enviada) com comando+data continua valendo.
const timelineComNotaReal = [
  { text: 'Cliente pediu pra eu marcar visita daqui a 2 dias.', iso: agoraIso, source: 'manual' },
];
const r = lembreteDaTimeline(timelineComNotaReal);
assert.ok(r, 'nota real do corretor com comando+data continua gerando lembrete');

console.log('v969-lembrete-fantasma-radical-lembr: ok');
