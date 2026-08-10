import fs from 'node:fs';
import assert from 'node:assert/strict';
import { processZipBuffer, transcreverBuffer } from '../api/_pipeline.js';

// v979 (achado durante o pedido do dono pra travar "arquivo bomba") — api/analisar.js
// importava `processZipBuffer` de api/_pipeline.js, mas essa função nunca existia lá.
// Import nomeado de export inexistente é SyntaxError em ESM: o módulo falhava ao
// carregar, então QUALQUER chamada à rota (mesmo autenticada, mesmo com um ZIP válido)
// derrubava a função com erro 500 antes do handler rodar. Ninguém percebeu porque
// `node --check` (usado no npm test) só valida sintaxe, não resolve os imports.
assert.equal(typeof processZipBuffer, 'function', 'processZipBuffer precisa existir em _pipeline.js — sem isso api/analisar.js quebra ao carregar');

// Prova direta do bug: importar o módulo da rota real não pode lançar erro.
// v1083 — api/analisar.js foi removida (rota de compatibilidade, zero chamadores). A checagem
// de que processZipBuffer existe continua acima: api/receber-zip-atalho.js (Atalho do iPhone)
// ainda depende dela.

// v979 (arquivo "bomba") — a proteção original vivia em transcribeAudio: checar o tamanho
// DECLARADO pelo ZIP antes de descompactar, pra um áudio "pequeno fechado, imenso quando
// aberto" não ser lido inteiro pra memória. v1194 — transcribeAudio foi removida (não tinha
// chamador em produção desde que a importação passou a usar transcreverArquivosExtraidos +
// transcreverBuffer). As mesmas duas camadas de proteção continuam, e é isso que se trava aqui:
//
// 1) ANTES de descompactar: processZipBuffer soma o tamanho declarado (zipEntrySize) dos áudios
//    selecionados e recusa acima de MAX_SELECTED_AUDIO_BYTES — a extração (.async) só acontece
//    depois dessa soma.
const pipelineSrc = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const extracaoInicio = pipelineSrc.indexOf('includeExtractedFiles === true');
assert.ok(extracaoInicio > 0, 'o bloco de extração de áudios precisa existir em processZipBuffer');
const blocoExtracao = pipelineSrc.slice(extracaoInicio, pipelineSrc.indexOf('async("nodebuffer")', extracaoInicio));
assert.match(blocoExtracao, /zipEntrySize/, 'o tamanho DECLARADO (zipEntrySize) precisa ser conferido antes de qualquer .async — proteção v979 contra arquivo bomba');
assert.match(blocoExtracao, /MAX_SELECTED_AUDIO_BYTES/, 'o teto de áudio selecionado precisa ser aplicado antes da descompactação');

// 2) DEPOIS de extraído: transcreverBuffer recusa buffer acima de 24 MB (teto do Whisper),
//    mesmo que o ZIP tenha declarado tamanho menor do que o real.
await assert.rejects(
  () => transcreverBuffer(Buffer.alloc(25 * 1024 * 1024), '.opus', {}, 'org-teste'),
  /grande demais/i,
  'áudio acima de 24 MB reais deve ser recusado pela transcrição'
);
console.log('v979-zip-bomba: tamanho declarado conferido antes de descompactar e teto de 24 MB mantido na transcrição');

// v979 (lentidão/travamento reportado pelo dono) — fixVersionText rodava a cada 2s, para
// sempre, varrendo todo texto do documento inteiro. Reduzido para 30s (mesmo ritmo já
// usado na sincronização da Home) — a rede de segurança continua ativa, só não compete
// mais com clique/toque o tempo inteiro que o app fica aberto.
const appSrc = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
// v1092 — o intervalo saiu de vez (a v979 tinha só reduzido de 2s pra 30s). Varrer todo o texto
// do documento periodicamente, pra sempre, é trabalho contínuo à toa num app que fica aberto o dia
// inteiro. O número da versão é gravado no HTML na hora de publicar (build.js troca __VERSION__) e
// os gatilhos de carregamento já cobrem tudo. A intenção original deste teste — o relógio não pode
// ficar competindo com o toque na tela — agora é garantida na forma mais forte: não há relógio.
assert.ok(!/setInterval\(fixVersionText/.test(appSrc),
  'não pode haver varredura periódica do DOM só pra corrigir o número da versão');
assert.ok(/document\.addEventListener\('DOMContentLoaded', fixVersionText\)/.test(appSrc),
  'a correção da versão precisa continuar acontecendo no carregamento');
console.log('v979-performance: fixVersionText não roda mais a cada 2s para sempre');

console.log('v979-zip-seguro-rota-compat-perf: ok');
