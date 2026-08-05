import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transcricoesDoLeadAnterior } from '../api/processar-storage.js';

// v954 — o dono percebeu que "reaproveitados" dava sempre 0 numa reimportação, mesmo pra
// áudios que ele sabia já ter transcrito antes no mesmo cliente. Causa: o reaproveitamento
// comparava o ÁUDIO por hash de conteúdo (sha256 do arquivo), e o WhatsApp não garante bytes
// idênticos entre duas exportações da MESMA conversa — o hash quase nunca batia, então todo
// áudio virava "novo" e pagava transcrição de novo toda vez. Fix: reaproveitar pelo NOME do
// arquivo de áudio (estável entre exportações), comparando só dentro do histórico do MESMO
// cliente já identificado (nunca entre clientes diferentes).

// 1. Caso normal: áudio já transcrito com sucesso antes, mesmo nome de arquivo → reaproveita.
const timelineComTranscricao = [
  { type: 'audio', mediaFile: 'AUD-20240115-WA0007.opus', audioStatus: 'transcrito', text: '[Áudio transcrito] Oi, bom dia, tudo bem?' },
  { type: 'text', author: 'Cliente', text: 'oi' }
];
assert.deepEqual(
  transcricoesDoLeadAnterior(timelineComTranscricao),
  { 'AUD-20240115-WA0007.opus': 'Oi, bom dia, tudo bem?' },
  'reaproveita áudio já transcrito com sucesso, pelo nome do arquivo normalizado'
);

// 2. Áudio com erro de transcrição, ou não transcrito (fora de janela, limite, api indisponível
//    etc.) NUNCA deve ser "reaproveitado" — não tem texto de verdade pra reaproveitar.
const timelineComFalha = [
  { type: 'audio', mediaFile: 'AUD-1.opus', audioStatus: 'erro_transcricao', text: '[Áudio: AUD-1.opus — erro_transcricao]' },
  { type: 'audio', mediaFile: 'AUD-2.opus', audioStatus: 'nao_transcrito_fora_do_periodo', text: '[Áudio: AUD-2.opus — não transcrito por estar fora do período escolhido]' },
  { type: 'audio', mediaFile: 'AUD-3.opus', audioStatus: 'limite_transcricao', text: '[Áudio: AUD-3.opus — limite_transcricao]' }
];
assert.deepEqual(transcricoesDoLeadAnterior(timelineComFalha), {}, 'nunca reaproveita áudio sem transcrição de sucesso');

// 3. Áudio solto sem posição exata (type: audio_unlinked) fica fora deste reaproveitamento —
//    escopo intencionalmente restrito ao caso comum (áudio referenciado na conversa).
const timelineAudioSolto = [
  { type: 'audio_unlinked', mediaFile: 'AUD-solto.opus', audioStatus: 'transcrito', text: '[Áudio transcrito sem posição exata no TXT: AUD-solto.opus] texto aqui' }
];
assert.deepEqual(transcricoesDoLeadAnterior(timelineAudioSolto), {}, 'audio_unlinked fica fora do escopo deste reaproveitamento');

// 4. Mensagens de texto/manuais não entram no mapa (só type:"audio").
const timelineMisto = [
  { type: 'text', author: 'Cliente', text: 'oi' },
  { type: 'audio', mediaFile: 'AUD-real.opus', audioStatus: 'transcrito', text: '[Áudio transcrito] mensagem real' },
  { type: 'nota', source: 'manual', text: 'anotação do corretor' }
];
assert.deepEqual(
  transcricoesDoLeadAnterior(timelineMisto),
  { 'AUD-real.opus': 'mensagem real' },
  'só considera itens type:"audio", ignora texto e notas manuais'
);

// 5. A chave do mapa usa normalizeName() — a MESMA função usada em todo o resto do pipeline de
//    áudio (buildTimeline, findReferencedAudio) — pra bater exatamente com o "nome" já normalizado
//    usado na hora de procurar no cache em subirUm().
const timelineComCaminho = [
  { type: 'audio', mediaFile: 'Media/Sub/AUD-caminho.opus', audioStatus: 'transcrito', text: '[Áudio transcrito] teste' }
];
const mapa = transcricoesDoLeadAnterior(timelineComCaminho);
assert.ok(mapa['AUD-caminho.opus'], 'chave do mapa usa normalizeName (tira caminho, mantém o resto)');

// 6. Timeline vazia/inválida não quebra, devolve mapa vazio.
assert.deepEqual(transcricoesDoLeadAnterior(null), {});
assert.deepEqual(transcricoesDoLeadAnterior(undefined), {});
assert.deepEqual(transcricoesDoLeadAnterior([]), {});

// 7. O ponto de uso (ação "preparar") busca o lead ANTES de extrair, só pelo nome do arquivo do
//    zip — sem exigir análise pronta ainda — e usa o resultado só pra reaproveitar transcrição,
//    nunca pra decidir fusão de cadastro (isso continua acontecendo depois, na persistência).
const storage = fs.readFileSync(new URL('../api/processar-storage.js', import.meta.url), 'utf8');
const preparoInicio = storage.indexOf('if (action === "preparar")');
const preparoFim = storage.indexOf('if (action === "transcrever")');
const blocoPreparar = storage.slice(preparoInicio, preparoFim);
assert.match(blocoPreparar, /_buscarProcessamentoExistenteV681\(supabase, \{ result: \{\}, fileName: nomeArquivoZip, path: storagePath, organizationId \}\)/,
  'ação preparar busca o lead correspondente só pelo nome do arquivo (e sempre dentro da MESMA organização), sem result/analysis ainda');
assert.match(blocoPreparar, /cacheDoLead/, 'passa o cache do lead anterior pra prepararExtracaoPersistente');

// 8. O cache do lead é resolvido ANTES do cache por hash de conteúdo (mais confiável — ver nota no
//    topo do arquivo). v1141: agora ele é resolvido antes até da EXTRAÇÃO — o áudio que já tem
//    texto salvo deste cliente não é descomprimido nem sobe pro Storage só pra calcular um hash
//    que ninguém usaria. O cache por hash continua existindo, só pra quem sobrou.
const prepararInicio = storage.indexOf('export async function prepararExtracaoPersistente');
const prepararFim = storage.indexOf('async function removerImportacao', prepararInicio);
const blocoPreparo = storage.slice(prepararInicio, prepararFim);
const idxCacheDoLead = blocoPreparo.indexOf('cacheDoLead[nome]');
const idxExtracao = blocoPreparo.indexOf('const subirUm = async');
const idxCacheHash = blocoPreparo.indexOf('carregarTranscricaoCache(storage, hash, organizationId)');
assert.ok(idxCacheDoLead > -1 && idxExtracao > -1 && idxCacheHash > -1,
  'sanidade: os três pontos (cache do lead, upload dos que sobraram, cache por hash) existem');
assert.ok(idxCacheDoLead < idxExtracao && idxCacheDoLead < idxCacheHash,
  'cache do lead é resolvido antes de extrair/subir e antes do cache por hash de conteúdo');
assert.match(blocoPreparo, /audiosJaTranscritos: cacheDoLead/,
  'a extração recebe a lista do que já tem texto salvo, pra não descomprimir de novo');

console.log('v954-reaproveitar-transcricao-por-lead: ok');
