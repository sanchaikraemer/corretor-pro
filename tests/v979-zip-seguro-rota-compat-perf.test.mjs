import fs from 'node:fs';
import assert from 'node:assert/strict';
import { processZipBuffer, transcribeAudio } from '../api/_pipeline.js';

// v979 (achado durante o pedido do dono pra travar "arquivo bomba") — api/analisar.js
// importava `processZipBuffer` de api/_pipeline.js, mas essa função nunca existia lá.
// Import nomeado de export inexistente é SyntaxError em ESM: o módulo falhava ao
// carregar, então QUALQUER chamada à rota (mesmo autenticada, mesmo com um ZIP válido)
// derrubava a função com erro 500 antes do handler rodar. Ninguém percebeu porque
// `node --check` (usado no npm test) só valida sintaxe, não resolve os imports.
assert.equal(typeof processZipBuffer, 'function', 'processZipBuffer precisa existir em _pipeline.js — sem isso api/analisar.js quebra ao carregar');

// Prova direta do bug: importar o módulo da rota real não pode lançar erro.
await import('../api/analisar.js');
console.log('v979-rota-compat: api/analisar.js carrega sem erro (processZipBuffer existe)');

// v979 (arquivo "bomba") — transcribeAudio descompactava o áudio inteiro (.async) e só
// DEPOIS conferia o tamanho. Um ZIP que declara um áudio gigante (pequeno fechado, imenso
// quando aberto) já tinha sido lido inteiro pra memória antes da rejeição. Agora o tamanho
// DECLARADO pelo ZIP é checado antes de descompactar — igual já era feito para o .txt.
const zipComAudioGigante = {
  files: {
    'audio-gigante.opus': {
      _data: { uncompressedSize: 30 * 1024 * 1024 }, // acima do teto de 24 MB do Whisper
      async() { throw new Error('não deveria descompactar um áudio acima do limite declarado'); }
    }
  }
};
const textoRecusado = await transcribeAudio({ zip: zipComAudioGigante, audioName: 'audio-gigante.opus', openai: null });
assert.equal(textoRecusado, '', 'áudio acima do tamanho declarado deve ser recusado sem tentar descompactar');
console.log('v979-zip-bomba: áudio acima do limite declarado é recusado antes de descompactar');

// Áudio dentro do limite continua chegando até a chamada da OpenAI normalmente (aqui só
// confirmamos que NÃO é recusado pelo novo guard cedo — sem OpenAI configurada, a função
// segue até tentar usar `openai` e falha ali, não no guard de tamanho).
const zipComAudioPequeno = {
  files: {
    'audio-pequeno.opus': {
      _data: { uncompressedSize: 1024 },
      async: async () => Buffer.from('conteudo-pequeno')
    }
  }
};
await assert.rejects(
  () => transcribeAudio({ zip: zipComAudioPequeno, audioName: 'audio-pequeno.opus', openai: null }),
  'áudio dentro do limite não deve ser recusado pelo guard de tamanho (deve tentar seguir para a transcrição)'
);

// v979 (lentidão/travamento reportado pelo dono) — fixVersionText rodava a cada 2s, para
// sempre, varrendo todo texto do documento inteiro. Reduzido para 30s (mesmo ritmo já
// usado na sincronização da Home) — a rede de segurança continua ativa, só não compete
// mais com clique/toque o tempo inteiro que o app fica aberto.
const appSrc = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.ok(!/setInterval\(fixVersionText,\s*2000\)/.test(appSrc), 'o relógio de correção de versão não pode mais rodar a cada 2 segundos para sempre');
assert.ok(/setInterval\(fixVersionText,\s*30000\)/.test(appSrc), 'esperava o intervalo reduzido para 30s');
console.log('v979-performance: fixVersionText não roda mais a cada 2s para sempre');

console.log('v979-zip-seguro-rota-compat-perf: ok');
