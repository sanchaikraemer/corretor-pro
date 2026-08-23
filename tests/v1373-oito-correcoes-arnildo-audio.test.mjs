import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  perguntaComercialPendenteDoCorretor,
  deveAguardarPerguntaComercial,
  montarEstadoComercialDeterministico,
  lacunaComercialPrioritaria,
  temEntregaConcretaPendente,
  avisosDeQualidadeDasMensagens,
  montarTimelineComTranscricoes,
  analyzeWithBrain
} from '../api/_pipeline.js';
import { guardarAudiosExtraidosNoStorage } from '../api/processar-storage.js';

const C = 'Construtora Senger';
const leadArnildo = { clientName: 'Arnildo Pasquali' };
const agora = new Date(2026, 7, 23, 15, 30);

// 1) .opus não pode morrer no Storage por MIME: o bucket real aceita octet-stream, não audio/opus.
{
  const allowed = new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream']);
  const uploads = [];
  const storage = {
    upload: async (path, payload, options = {}) => {
      const type = String(options.contentType || 'application/octet-stream');
      uploads.push({ path, type });
      return allowed.has(type) ? { error: null } : { error: { message: `mime type ${type} is not supported` } };
    }
  };
  const r = await guardarAudiosExtraidosNoStorage({
    storage, prefix: 'organizations/org/imports/imp', organizationId: 'org',
    extracted: { 'PTT-20260729-WA0013.opus': Buffer.from('audio') },
    cacheDoLead: { 'PTT-20260729-WA0013.opus': 'transcrição reaproveitada' }
  });
  assert.equal(uploads[0].type, 'application/octet-stream');
  assert.ok(r.audioStorage['PTT-20260729-WA0013.opus']);
  assert.equal(r.audioPreparationFailures.length, 0);
}
console.log('1373 correção 1/8 — MIME .opus no Storage: OK');

// 2) Se o áudio veio e falhou, a tela/histórico não podem mentir que "não veio no envio".
{
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /Arquivo enviado — não veio no envio da conversa/);
  assert.match(app, /Arquivo enviado — conteúdo não processado/);
  const tl = montarTimelineComTranscricoes(
    [{ date: '23/08/2026', time: '10:00', author: 'Arnildo Pasquali', text: 'PTT-20260729-WA0013.opus (arquivo anexado)' }],
    ['PTT-20260729-WA0013.opus'],
    { 'PTT-20260729-WA0013.opus': { status: 'erro_preparo_audio', text: '', error: 'falha' } }
  );
  assert.match(tl[0].text, /falha no processamento antes da transcrição/i);
  assert.doesNotMatch(tl[0].text, /não veio/i);
}
console.log('1373 correção 2/8 — mensagem falsa de mídia ausente: OK');

// 3) Um áudio ruim não pode derrubar o TXT nem os outros áudios.
{
  const storage = {
    upload: async (path) => path.includes('0001-')
      ? { error: { message: 'falha pontual no primeiro áudio' } }
      : { error: null }
  };
  const r = await guardarAudiosExtraidosNoStorage({
    storage, prefix: 'organizations/org/imports/imp', organizationId: 'org',
    extracted: { 'A.opus': Buffer.from('a'), 'B.opus': Buffer.from('b') },
    cacheDoLead: { 'B.opus': 'texto do B' }
  });
  assert.equal(r.audioPreparationFailures.length, 1);
  assert.equal(r.transcriptions['A.opus'].status, 'erro_preparo_audio');
  assert.ok(r.audioStorage['B.opus']);
  assert.equal(r.transcriptions['B.opus'].text, 'texto do B');
}
console.log('1373 correção 3/8 — falha parcial não aborta importação: OK');

const perguntaArnildo = [{
  date: '23/08/2026', time: '12:17', author: C,
  text: 'Arnildo, você está buscando o imóvel para morar ou pensando em investimento?'
}];

// 4) Pergunta comercial já enviada tem precedência: dentro do prazo, AGUARDAR; no vencimento, libera.
{
  const p = perguntaComercialPendenteDoCorretor(perguntaArnildo, C, leadArnildo, agora);
  assert.ok(p);
  assert.equal(p.topico, 'finalidade');
  const dentro = deveAguardarPerguntaComercial({ timeline: perguntaArnildo, corretorNome: C, lead: leadArnildo, agora, diasParaRetomada: 5 });
  assert.equal(dentro.aguardar, true);
  const noPrazo = deveAguardarPerguntaComercial({ timeline: perguntaArnildo, corretorNome: C, lead: leadArnildo, agora: new Date(2026, 7, 28, 12, 30), diasParaRetomada: 5 });
  assert.equal(noPrazo.aguardar, false);
  const estado = montarEstadoComercialDeterministico(perguntaArnildo, C, leadArnildo, agora);
  assert.equal(lacunaComercialPrioritaria(perguntaArnildo, C, leadArnildo, estado), null);
}
console.log('1373 correção 4/8 — pergunta pendente vence nova lacuna: OK');

// 5 e 6) Mesmo se a IA tentar repetir "morar/investir" OU abrir entrada/parcelas, nada disso sai.
{
  let chamadas = 0;
  const openai = { chat: { completions: { create: async () => {
    chamadas++;
    return { model: 'mock', usage: { prompt_tokens: 1, completion_tokens: 1 }, choices: [{ message: { content: JSON.stringify({
      summary: 'Resumo',
      diagnostico: { ultimaPessoaFalar: 'Corretor', produtoPrincipal: 'Imóvel', etapaFunil: 'Qualificação', proximoPasso: 'Perguntar entrada', quemDeveAgirAgora: 'Corretor' },
      mensagens: {
        recomendada: 'Arnildo, a compra seria para morar ou investir?',
        maisSuave: 'Arnildo, quanto você pensa em colocar de entrada?',
        maisDireta: 'Arnildo, prefere parcelas menores ou reforços?'
      },
      produtoInteresse: 'Imóvel', produtosInteresse: ['Imóvel'], etapaSugerida: 'Qualificação', clientProfile: 'Interessado', nextAction: 'Perguntar entrada',
      recomendacaoContato: { aguardar: false, motivo: '' },
      leituraDaConversa: { comoConduzir: 'Qualificar.' }
    }) } }] };
  } } } };
  const r = await analyzeWithBrain({
    lead: leadArnildo, timeline: perguntaArnildo, openai,
    cerebroConfig: { corretorNome: C, metodo: 'método', diasDescansoPosAtendimento: 5 }, organizationId: 'org-test'
  });
  assert.equal(r.recomendacaoContato.aguardar, true);
  assert.equal(r.recomendacaoContato.perguntaPendente, true);
  assert.equal(r.messages.a, '');
  assert.equal(r.messages.b, '');
  assert.equal(r.messages.c, '');
  assert.match(r.nextAction, /Aguardar a resposta/i);
  assert.equal(chamadas, 1, 'não deve gastar chamada de reparo em mensagem que não será enviada');
}
console.log('1373 correção 5/8 — não repete pergunta pendente: OK');
console.log('1373 correção 6/8 — não empilha qualificação secundária: OK');

// 7) "As três só perguntam" só vale quando existe ENTREGA pendente real; valor antigo sozinho não basta.
{
  const tlValor = [
    { date: '20/08/2026', time: '10:00', author: C, text: 'O apartamento custa R$ 600.000.' },
    { date: '20/08/2026', time: '10:05', author: 'Cliente', text: 'Obrigado.' }
  ];
  const estadoValor = montarEstadoComercialDeterministico(tlValor, C, { clientName: 'Cliente' }, agora);
  assert.equal(temEntregaConcretaPendente(estadoValor), false);
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: 'a', texto: 'Você busca para morar ou investir?' },
    { qual: 'b', texto: 'Quantos dormitórios precisa?' },
    { qual: 'c', texto: 'Qual região prefere?' }
  ], { conversa: 'O apartamento custa R$ 600.000. Obrigado.', cerebro: '', temOQueEntregar: false });
  assert.doesNotMatch(avisos.flatMap(x => x.motivos || []).join(' | '), /só perguntam/i);

  const tlPerguntaCliente = [{ date: '20/08/2026', time: '10:00', author: 'Cliente', text: 'Qual é o valor do apartamento?' }];
  const estadoPergunta = montarEstadoComercialDeterministico(tlPerguntaCliente, C, { clientName: 'Cliente' }, agora);
  assert.equal(temEntregaConcretaPendente(estadoPergunta), true, 'pergunta real do cliente continua sendo entrega pendente');
}
console.log('1373 correção 7/8 — validador sensível ao estágio: OK');

// 8) O teste/modelo do bucket precisa reproduzir produção: nada de exceção artificial para audio/*.
{
  const rota = fs.readFileSync(new URL('../api/processar-storage.js', import.meta.url), 'utf8');
  const teste8279 = fs.readFileSync(new URL('./v827-9-storage-manifest-mime.test.mjs', import.meta.url), 'utf8');
  assert.match(rota, /const ALLOWED_ZIP_MIME_TYPES = \[\s*"application\/zip", "application\/x-zip-compressed", "application\/octet-stream"\s*\]/);
  assert.doesNotMatch(teste8279, /startsWith\(["']audio\//, 'o teste antigo não pode fingir que o bucket aceita audio/*');
  assert.match(teste8279, /if \(!allowed\.has\(type\)\)/);
}
console.log('1373 correção 8/8 — regressão reproduz bucket real: OK');

console.log('v1373-oito-correcoes-arnildo-audio: 8/8 OK');
