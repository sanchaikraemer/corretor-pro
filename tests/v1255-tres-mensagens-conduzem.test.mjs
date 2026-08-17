import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1255 — ordem do dono: "não quero q use os dias". As sugestões abriam contando o tempo parado
// ("faz duas semanas que não conversamos"), e a correção da época foi o bloco "TEMPO PARADO NÃO
// ENTRA NA MENSAGEM", com a lista de frases proibidas.
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. A reescrita entregue pelo dono tirou esse bloco. O sistema
// continua informando os dias parados como CONTEXTO, e quem decide se o intervalo é reconhecido (e
// como) passou a ser o Cérebro do corretor.

assert.match(src, /Dias corridos desde a última mensagem identificada/,
  'o tempo parado continua chegando na IA como informação');
assert.match(src, /A saudação, o reconhecimento ou não do intervalo e o tipo de próximo passo devem seguir o Cérebro\./,
  'quem decide se fala do intervalo passou a ser o Cérebro do corretor');
assert.match(src, /Os dados acima são contexto, não ordens para forçar visita, pergunta, encontro ou retomada\./,
  'e o contexto técnico não pode virar ordem de forçar retomada');
assert.match(src, /Mensagem curta é preferência, não prisão/,
  'as três continuam podendo dar contexto suficiente pra pessoa entender e responder');
console.log('v1255-tres-mensagens-conduzem: ok');
