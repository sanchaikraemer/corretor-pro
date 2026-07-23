import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url).pathname, 'utf8');

// v930 — prints do dono: dois "lembretes" sem nexo nenhum vieram de ÁUDIO TRANSCRITO (trechos
// soltos de conversa, tipo "cara, ela liga tudo, abre" ou "só botei ali pra tu não esquecer") —
// ele não lembrava de ter agendado aquilo. A extração de lembrete (lembreteDaTimeline) rodava
// igual em texto digitado e em áudio transcrito; áudio é registro bem mais solto/narrado, então
// passa a ser ignorado como gatilho de lembrete — só mensagem digitada (corretor ou cliente)
// continua contando.

// 1. Bloco de extração de verdade: lembreteDoTexto + fazerLembrete + lembreteDaTimeline.
const iniTexto = src.indexOf('function lembreteDoTexto(txt, baseDate) {');
const fimTexto = src.indexOf('\nfunction normalizarTextoV684');
assert.ok(iniTexto !== -1 && fimTexto !== -1, 'lembreteDoTexto não encontrada');
const lembreteDoTextoSrc = src.slice(iniTexto, fimTexto);

const iniTimeline = src.indexOf('function fazerLembrete(dias, motivo, base) {');
const fimTimeline = src.indexOf('\n  // Mensagem copiada não pode gerar lembrete');
assert.ok(iniTimeline !== -1 && fimTimeline !== -1, 'fazerLembrete/lembreteDaTimeline não encontradas');
const timelineSrc = src.slice(iniTimeline, fimTimeline);

const { lembreteDaTimeline } = eval(`
  ${lembreteDoTextoSrc}
  ${timelineSrc}
  ({ lembreteDaTimeline });
`);

const agoraIso = new Date().toISOString();
const ontemIso = new Date(Date.now() - 24*60*60*1000).toISOString();

// 2. Áudio com comando+data (o mesmo padrão que geraria lembrete se fosse texto) é ignorado.
const soAudio = [
  { text: '[Áudio transcrito] Marca lá pra daqui a 2 dias com ela, cara, ela liga tudo, abre.', iso: agoraIso },
];
assert.equal(lembreteDaTimeline(soAudio), null, 'áudio transcrito não deve gerar lembrete, mesmo com comando+data');

// 3. Com áudio (mais recente, deveria "vencer" se contasse) + texto digitado mais antigo com
// comando+data real: o texto digitado é quem deve gerar o lembrete — prova que a função não
// simplesmente para de funcionar, só ignora especificamente a entrada de áudio.
const audioEDepoisTexto = [
  { text: 'Combinado, vou te mandar os documentos ainda essa semana.', iso: ontemIso, source: 'manual' },
  { text: '[Áudio transcrito] Marca lá pra daqui a 2 dias com ela, cara, ela liga tudo, abre.', iso: agoraIso },
];
const r1 = lembreteDaTimeline(audioEDepoisTexto);
assert.equal(r1, null, 'sem comando+data em texto digitado nesse cenário, e áudio é ignorado -> null');

const comTextoValido = [
  { text: 'Pode marcar a visita pra daqui a 2 dias, combinado?', iso: ontemIso, source: 'manual' },
  { text: '[Áudio transcrito] Marca lá pra daqui a 2 dias com ela, cara, ela liga tudo, abre.', iso: agoraIso },
];
const r2 = lembreteDaTimeline(comTextoValido);
assert.ok(r2, 'deve encontrar o lembrete no texto digitado, ignorando o áudio mais recente');
assert.doesNotMatch(r2.motivo, /^\[Áudio transcrito\]/, 'o motivo do lembrete não pode vir do áudio');
assert.match(r2.motivo, /marcar a visita/, 'o motivo deve vir da mensagem digitada de verdade');

// 4. Lembrete legado cujo motivo veio de áudio é descartado na preservação (não fica pra sempre).
const aplicarSrc = src.match(/function aplicarLembrete\(obj\) \{[\s\S]*?\n  \}/);
assert.ok(aplicarSrc, 'aplicarLembrete não encontrada');
assert.match(aplicarSrc[0], /motivoEraAudio/, 'aplicarLembrete deve checar se o lembrete preservado veio de áudio');
assert.match(aplicarSrc[0], /previous\.lembrete\.auto !== true && !motivoEraAudio/,
  'só preserva o lembrete antigo se não for auto:true legado E não vier de áudio');

console.log('v930-lembrete-ignora-audio: ok');
