import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// Extrai e executa a função pura que unifica o "último atendimento" (§6.5).
const setSrc = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/);
const fnSrc = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/);
assert.ok(setSrc && fnSrc, 'não achei ultimoAtendimentoTs em app.js');
const ultimoAtendimentoTs = eval(setSrc[0] + '\n' + fnSrc[0] + '\n; ultimoAtendimentoTs');

const t = iso => Date.parse(iso);

// Considera evento de contato manual (botão / cópia de mensagem).
assert.equal(
  ultimoAtendimentoTs({ analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', quando: '2026-07-10T12:00:00Z' },
    { evento: 'contato_manual', quando: '2026-07-14T09:30:00Z' }
  ] } } }),
  t('2026-07-14T09:30:00Z'),
  'pega o contato manual mais recente'
);

// Considera item manual na timeline (observação, visita, mensagem enviada...).
assert.equal(
  ultimoAtendimentoTs({ recentMessages: [
    { source: 'manual', type: 'visita', iso: '2026-07-11T15:00:00Z' },
    { source: 'manual', type: 'mensagem_enviada', iso: '2026-07-13T18:00:00Z' }
  ] }),
  t('2026-07-13T18:00:00Z'),
  'mensagem enviada e visita contam como atendimento'
);

// Considera os campos históricos de último atendimento.
assert.equal(
  ultimoAtendimentoTs({ lastAttendanceAt: '2026-07-12T10:00:00Z', ultimoAtendimentoEm: '2026-07-09T10:00:00Z' }),
  t('2026-07-12T10:00:00Z')
);

// Pega o MAIS RECENTE entre todas as fontes misturadas.
assert.equal(
  ultimoAtendimentoTs({
    lastAttendanceAt: '2026-07-12T10:00:00Z',
    analysis: { aprendizado: { eventos: [{ evento: 'contato_manual', quando: '2026-07-14T09:30:00Z' }] } },
    recentMessages: [{ source: 'manual', type: 'mensagem_enviada', iso: '2026-07-13T18:00:00Z' }]
  }),
  t('2026-07-14T09:30:00Z')
);

// Lead que nunca foi atendido (só mensagens do cliente) → 0.
assert.equal(
  ultimoAtendimentoTs({ recentMessages: [
    { source: 'whatsapp', type: 'text', author: 'Cliente', iso: '2026-07-14T09:30:00Z' }
  ] }),
  0,
  'mensagem do cliente não é atendimento'
);
assert.equal(ultimoAtendimentoTs({}), 0);

// A aba "Últimos atendimentos" ordena pelo atendimento real, não pela última mensagem.
assert.match(app, /pipelineTabAtiva === "ultimos"\)\{[\s\S]*?ultimoAtendimentoTs\(a\)/, 'aba Últimos ordena por ultimoAtendimentoTs');
// Rótulo de tempo relativo existe (§6.5): agora/hoje/ontem/há X dias.
assert.match(app, /function rotuloTempoAtendimento\(ts\)\{[\s\S]*?"ontem"[\s\S]*?há \$\{dias\} dias/);

console.log('v826-atendimentos: ok');
