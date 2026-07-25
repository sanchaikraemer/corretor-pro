import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url).pathname, 'utf8');

// v987 — print real do dono: registrou um atendimento pro Valdir contando o que disse a ele
// ("...lembrei do apto 502A do Quality... Hoje temos uma unidade ainda, por R$ 395.000") e a
// Agenda criou sozinha um "Lembrete de hoje" com esse texto, sem ele ter clicado em Agendar.
// Mesma classe de bug do v969 (radical "lembr" pegando relato, não comando), só que numa forma
// verbal que o fix da v969 não cobria: "lembrei" (1ª pessoa do passado) e "lembrou" (3ª pessoa),
// que são narrativa — nunca um pedido de lembrete — mas batiam o radical lembr\w* mesmo assim.

const iniTexto = src.indexOf('function lembreteDoTexto(txt, baseDate) {');
const fimTexto = src.indexOf('\nfunction normalizarTextoV684');
assert.ok(iniTexto !== -1 && fimTexto !== -1, 'lembreteDoTexto não encontrada');
const lembreteDoTextoSrc = src.slice(iniTexto, fimTexto);

const { lembreteDoTexto } = eval(`
  ${lembreteDoTextoSrc}
  ({ lembreteDoTexto });
`);

// 1. Caso real "Valdir": "lembrei" + "hoje" (descrevendo disponibilidade, não pedindo lembrete).
assert.equal(
  lembreteDoTexto('Sr. Valdir, boa tarde! Estava pensando aqui e lembrei do apto 502A do Quality q o Sr adquiriu em 2020 por R$ 165.000 Hoje temos uma unidade ainda, por R$ 395.000'),
  null,
  '"lembrei do apto..." é relato (o que o corretor disse ao cliente), não um comando de agendar'
);

// 2. Mesma forma em 3ª pessoa: "ele lembrou" também é narrativa, não comando.
assert.equal(
  lembreteDoTexto('O cliente contou que lembrou da nossa conversa hoje de manhã.'),
  null,
  '"lembrou" (3ª pessoa do passado) também é relato, não comando'
);

// 3. Comandos de verdade continuam funcionando (não pode quebrar o recurso real).
assert.ok(lembreteDoTexto('Lembra de mim amanhã, combinado?'), '"lembra de mim" + prazo continua sendo comando válido');
assert.ok(lembreteDoTexto('Lembrete: ligar pra ele daqui a 2 dias.'), '"lembrete:" + prazo explícito continua sendo comando válido');
assert.ok(lembreteDoTexto('Pode marcar a visita pra amanhã?'), 'comando "marcar" sem radical lembr continua funcionando');

console.log('v987-lembrete-fantasma-lembrei-lembrou: ok');
