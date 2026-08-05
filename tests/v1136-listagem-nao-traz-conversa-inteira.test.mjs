import fs from 'node:fs';
import assert from 'node:assert/strict';
import { listRecentProcessings } from '../api/_persistence.js';

// v1136 — item 1 do plano do dono ("cortar o consumo do Supabase"), achado da auditoria de
// 05/08/2026: a listagem selecionava timeline_json (a conversa INTEIRA) de todo lead a cada
// carga — e mandava pro celular só 8 mensagens. Com a Home buscando a carteira a cada 2 minutos,
// era quase certamente o que estourava a cota de egress do plano grátis (5 GB), acusada no
// painel desde a v1122.
//
// Agora: a consulta principal NÃO pede timeline_json; o _statsCache v3 (com marca d'água da
// linha, prévia e último toque) responde tudo; e só as linhas com cache frio/vencido têm a
// conversa buscada, numa SEGUNDA consulta, em lotes de 50.
//
// Este teste usa um banco de mentira que RESPEITA a lista de colunas pedida — os fakes antigos
// devolviam a linha inteira fosse qual fosse o select, e por isso nunca enxergariam este bug.

const HOJE_BR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const isoDiasAtras = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();

const TIMELINE = [
  { author: 'Paula', text: 'Oi, tem apartamento de 2 dormitórios?', iso: isoDiasAtras(12), date: '2026-07-24', time: '10:00' },
  { author: 'Corretor', text: 'Tenho sim! Te mando as opções.', iso: isoDiasAtras(11), date: '2026-07-25', time: '09:10' },
  { author: 'Paula', text: 'Qual o valor?', iso: isoDiasAtras(10), date: '2026-07-26', time: '14:30' }
];

function linhaBase(id, extras = {}) {
  return {
    id,
    // O primeiro nome resolvido ("Paula") precisa bater com o autor das mensagens — é assim que
    // a varredura decide o que é mensagem DO CLIENTE (ehClienteMsg em _persistence.js).
    nome_arquivo: `Conversa do WhatsApp com Paula ${id}.zip`,
    status: 'processado',
    etapa: 'Ativo',
    organization_id: 'org-1',
    atualizado_em: isoDiasAtras(3),
    timeline_json: TIMELINE,
    resultado_analise: { summary: 'Cliente pediu valores.' },
    ...extras
  };
}

function cacheV3De(linha, previewLimit = 8) {
  const t = linha.timeline_json;
  return {
    v: 3, len: t.length, dia: HOJE_BR, marca: linha.atualizado_em,
    lastIso: t[t.length - 1].iso, lastClientIso: t[t.length - 1].iso, lastCorretorIso: t[1].iso,
    lastTouchIso: t[t.length - 1].iso, lastTouchTime: t[t.length - 1].time,
    clientMessageCount: 2, clientQuestionCount: 2, clientMessageDays: 2,
    messageCount90d: 3, clientMessageCount90d: 2, hasProposal: false,
    preview: t.slice(-previewLimit).map(m => ({ ...m }))
  };
}

// Banco de mentira que respeita o select: só devolve as colunas pedidas (ou tudo, com "*").
function fakeSupabaseHonesto(linhas, { falharSegundaConsulta = false } = {}) {
  const registro = { consultas: [], writebacks: [] };
  const escolherColunas = (linha, colunas) => {
    if (colunas === '*') return { ...linha };
    const out = {};
    for (const c of colunas.split(',').map(x => x.trim())) if (linha[c] !== undefined) out[c] = linha[c];
    return out;
  };
  const cliente = {
    registro,
    from(tabela) {
      assert.equal(tabela, 'whatsapp_processamentos');
      const q = { colunas: '*', filtros: {}, ids: null, tipo: 'select' };
      const builder = {
        select(c) { q.colunas = c; return builder; },
        eq(campo, valor) { q.filtros[campo] = valor; return builder; },
        order() { return builder; },
        limit() { return builder; },
        in(campo, valores) { q.ids = valores.map(String); return builder; },
        update(payload) { q.tipo = 'update'; q.payload = payload; return builder; },
        then(resolve) {
          if (q.tipo === 'update') {
            registro.writebacks.push({ payload: q.payload, filtros: { ...q.filtros } });
            return resolve({ error: null });
          }
          registro.consultas.push({ colunas: q.colunas, ids: q.ids, filtros: { ...q.filtros } });
          if (q.ids && falharSegundaConsulta) return resolve({ data: null, error: { message: 'rede caiu' } });
          let base = linhas.filter(l => q.filtros.organization_id ? l.organization_id === q.filtros.organization_id : true);
          if (q.ids) base = base.filter(l => q.ids.includes(String(l.id)));
          if (q.filtros.id) base = base.filter(l => String(l.id) === String(q.filtros.id));
          return resolve({ data: base.map(l => escolherColunas(l, q.colunas)), error: null });
        }
      };
      return builder;
    }
  };
  return cliente;
}

// ---------- 1. Regime normal (cache em dia): UMA consulta, SEM a conversa ----------
{
  const linha = linhaBase('lead-a');
  linha.resultado_analise = { summary: 'ok', _statsCache: cacheV3De(linha) };
  const supa = fakeSupabaseHonesto([linha]);
  const r = await listRecentProcessings(10, { supabase: supa, organizationId: 'org-1', previewLimit: 8 });
  assert.equal(r.ok, true, JSON.stringify(r));

  assert.equal(supa.registro.consultas.length, 1, 'com o cache em dia, é UMA consulta só — nada de segunda ida ao banco');
  assert.ok(!supa.registro.consultas[0].colunas.includes('timeline_json'),
    `a listagem não pode mais pedir timeline_json — pediu: ${supa.registro.consultas[0].colunas}`);
  assert.equal(supa.registro.writebacks.length, 0, 'cache em dia não grava nada');

  const item = r.items[0];
  assert.equal(item.messageCount, 3, 'o total de mensagens sai do cache (len), sem a conversa em mãos');
  assert.equal(item.recentMessages.length, 3, 'a prévia sai pronta do cache');
  assert.equal(item.recentMessages[2].text, 'Qual o valor?', 'a prévia é a mesma que a lista sempre mostrou');
  assert.equal(item.clientMessageCount90d, 2, 'os números vêm do cache');
  assert.equal(item.lastInteractionAt, TIMELINE[2].iso,
    'a última interação sai do cache (lastIso), sem a conversa em mãos');
  assert.ok(item.daysSinceLastTouch >= 9 && item.daysSinceLastTouch <= 11,
    'dias desde o último toque saem do lastTouchIso do cache (msg de ~10 dias atrás)');
}

// ---------- 2. Uma linha mexida (marca diferente): segunda consulta SÓ dela ----------
{
  const emDia = linhaBase('lead-a');
  emDia.resultado_analise = { summary: 'ok', _statsCache: cacheV3De(emDia) };
  const mexida = linhaBase('lead-b', { atualizado_em: isoDiasAtras(0) });
  mexida.resultado_analise = { summary: 'ok', _statsCache: { ...cacheV3De(mexida), marca: isoDiasAtras(30) } };
  const supa = fakeSupabaseHonesto([emDia, mexida]);
  const r = await listRecentProcessings(10, { supabase: supa, organizationId: 'org-1', previewLimit: 8 });

  const segundas = supa.registro.consultas.filter(c => c.ids);
  assert.equal(segundas.length, 1, 'precisa haver exatamente uma segunda consulta');
  assert.deepEqual(segundas[0].ids, ['lead-b'], 'a segunda consulta busca SÓ a linha mexida');
  assert.equal(segundas[0].filtros.organization_id, 'org-1', 'a segunda consulta também filtra por empresa');
  assert.ok(segundas[0].colunas.includes('timeline_json'), 'a segunda consulta é que traz a conversa');

  assert.equal(supa.registro.writebacks.length, 1, 'a linha recalculada grava o cache v3 novo');
  const wb = supa.registro.writebacks[0].payload.resultado_analise._statsCache;
  assert.equal(wb.v, 3);
  assert.equal(wb.marca, mexida.atualizado_em, 'a marca nova é o atualizado_em atual da linha');
  assert.equal(wb.dia, HOJE_BR);
  assert.ok(Array.isArray(wb.preview) && wb.preview.length === 3, 'o cache novo leva a prévia junto');

  const itemB = r.items.find(i => i.id === 'lead-b');
  assert.equal(itemB.clientMessageCount90d, 2, 'os números da linha mexida saem recalculados da conversa real');
}

// ---------- 3. Virada do dia: todo mundo recalcula UMA vez (e volta ao regime barato) ----------
{
  const linha = linhaBase('lead-a');
  linha.resultado_analise = { summary: 'ok', _statsCache: { ...cacheV3De(linha), dia: '2020-01-01' } };
  const supa = fakeSupabaseHonesto([linha]);
  await listRecentProcessings(10, { supabase: supa, organizationId: 'org-1', previewLimit: 8 });
  const segundas = supa.registro.consultas.filter(c => c.ids);
  assert.equal(segundas.length, 1, 'na virada do dia a conversa é buscada de novo (os números de 90 dias envelhecem)');
  assert.equal(supa.registro.writebacks.length, 1);
  assert.equal(supa.registro.writebacks[0].payload.resultado_analise._statsCache.dia, HOJE_BR,
    'o cache regravado carimba o dia novo — a próxima carga volta a ser barata');
}

// ---------- 4. Detalhe do lead (includeFullTimeline): a conversa vem na consulta principal ----------
{
  const linha = linhaBase('lead-a');
  const supa = fakeSupabaseHonesto([linha]);
  const r = await listRecentProcessings(1, { supabase: supa, organizationId: 'org-1', id: 'lead-a', includeFullTimeline: true });
  assert.ok(supa.registro.consultas[0].colunas.includes('timeline_json'),
    'no detalhe, a consulta principal continua trazendo a conversa inteira');
  assert.equal(supa.registro.consultas.filter(c => c.ids).length, 0, 'no detalhe não existe segunda consulta');
  assert.equal(r.items[0].recentMessages.length, 3, 'o detalhe recebe o histórico completo');
  assert.equal(r.items[0].historyLoaded, true);
}

// ---------- 5. Segunda consulta falhou: usa o último cache conhecido, nunca zera ----------
{
  const linha = linhaBase('lead-a');
  const cacheVencido = { ...cacheV3De(linha), dia: '2020-01-01', clientMessageCount90d: 7, messageCount90d: 9 };
  linha.resultado_analise = { summary: 'ok', _statsCache: cacheVencido };
  const supa = fakeSupabaseHonesto([linha], { falharSegundaConsulta: true });
  const r = await listRecentProcessings(10, { supabase: supa, organizationId: 'org-1', previewLimit: 8 });
  const item = r.items[0];
  assert.equal(item.clientMessageCount90d, 7,
    'com a busca da conversa falhando, os números de ontem valem — zerar pareceria perda de dados');
  assert.equal(item.recentMessages.length, 3, 'a prévia do cache vencido continua na tela');
  assert.equal(supa.registro.writebacks.length, 0, 'sem cálculo novo, nada é gravado');
}

// ---------- 6. Lotes de 50 na segunda consulta (não estourar a URL do PostgREST) ----------
{
  const linhas = Array.from({ length: 120 }, (_, i) => linhaBase(`lead-${i}`));
  const supa = fakeSupabaseHonesto(linhas);
  await listRecentProcessings(200, { supabase: supa, organizationId: 'org-1', previewLimit: 8 });
  const segundas = supa.registro.consultas.filter(c => c.ids);
  assert.equal(segundas.length, 3, '120 linhas frias = 3 lotes (50+50+20)');
  assert.ok(segundas.every(c => c.ids.length <= 50), 'nenhum lote pode passar de 50 ids');
}

// ---------- 7. Guarda estática: a lista de colunas da listagem não pode voltar a ter a conversa ----------
{
  const src = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');
  const semTl = /const LIST_COLUMNS_SEM_TIMELINE = "([^"]+)"/.exec(src)?.[1] || '';
  assert.ok(semTl.length > 0, 'LIST_COLUMNS_SEM_TIMELINE precisa existir');
  assert.ok(!semTl.includes('timeline_json'),
    'a listagem normal não pode voltar a pedir timeline_json — foi isso que estourou a cota de egress');
  assert.match(src, /const LIST_COLUMNS = includeFullTimeline \? LIST_COLUMNS_COM_TIMELINE : LIST_COLUMNS_SEM_TIMELINE/,
    'só o detalhe (includeFullTimeline) usa a lista com a conversa');
}

console.log('v1136-listagem-nao-traz-conversa-inteira: ok');
