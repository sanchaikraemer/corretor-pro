import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1027 — o dono reimportou o MESMO ZIP duas vezes seguidas, de propósito, só pra testar se o
// reaproveitamento (corrigido nas v1022 e v1026) realmente funcionava — e continuou vendo
// "0 reaproveitados" nas duas vezes, com razão pra desconfiar que os "consertos" anteriores não
// tinham resolvido nada de verdade.
//
// Causa real, e é uma bem boba: normalizarAudio() (dentro de processarStorageEmEtapas, em
// app.js) forçava minúsculas na chave usada pra procurar no cache de transcrições. O SERVIDOR
// (normalizeName, api/_pipeline.js) NUNCA lowercasa — e nome de áudio do WhatsApp quase sempre
// vem com prefixo MAIÚSCULO ("AUD-20240115-WA0007.opus", "PTT-..."). Ou seja: o servidor
// guardava a transcrição sob a chave "AUD-...", mas o navegador procurava por "aud-..." — nunca
// batia. Resultado, pra TODO áudio típico do WhatsApp: o contador sempre mostrava 0 reaproveitados
// E o app mandava transcrever de novo (pagando de novo) áudio que já tinha transcrição pronta.
// Isso derrubava tanto o reaproveitamento "dentro da mesma importação" (v1022, reimportar após
// timeout) quanto o reaproveitamento "entre importações" de um lead recorrente (v1026) — os dois
// dependem desta mesma conta no navegador.

// 1. O servidor nunca lowercasa nomes de áudio.
assert.match(pipeline, /export function normalizeName\(name = ""\) \{\s*return String\(name\)\.split\("\/"\)\.pop\(\)\.trim\(\);/,
  'normalizeName (servidor) precisa continuar sem forçar minúsculas — é o formato usado em toda chave de transcrição salva');

// 2. O navegador não pode mais forçar minúsculas na mesma checagem.
const ini = app.indexOf('const normalizarAudio = ');
assert.ok(ini > -1, 'normalizarAudio não encontrada em app.js');
const fimLinha = app.indexOf('\n', app.indexOf('const audiosReaproveitados = ', ini));
const src = app.slice(ini, fimLinha);
assert.doesNotMatch(src, /toLowerCase/, 'normalizarAudio não pode mais forçar minúsculas — precisa bater com a chave EXATA que o servidor usa (normalizeName, sem lowercase)');

// 3. Teste funcional: com uma chave de cache no formato REAL do WhatsApp (maiúsculas), o áudio
// já transcrito precisa ser reconhecido — e o contador de reaproveitados precisa refletir isso.
const calcular = new Function('transcriptionMap', 'audiosTodos', `
  ${src}
  return { audios, audiosReaproveitados };
`);
const resultado = calcular(
  { 'AUD-20240115-WA0007.opus': { text: 'Oi, tudo bem?', status: 'transcrito' } },
  ['AUD-20240115-WA0007.opus', 'AUD-20240116-WA0008.opus']
);
assert.deepEqual(resultado.audios, ['AUD-20240116-WA0008.opus'],
  'o áudio já cacheado (nome com prefixo maiúsculo, como todo áudio real do WhatsApp) não pode entrar na lista de "precisa transcrever de novo"');
assert.equal(resultado.audiosReaproveitados, 1,
  'o contador "reaproveitados" precisa reconhecer o áudio já cacheado mesmo com prefixo maiúsculo — antes ficava sempre 0 nesse caso, que é o caso comum');

console.log('v1027-reaproveitar-audio-nao-lowercase: ok');
