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

// v1075 — a aba "Últimos atendimentos" morava na tela Condução, deletada a pedido do dono.
// v1102 — a régua virou o último CONTATO REAL do corretor (atendimento marcado OU última mensagem
// dele na conversa) — caso Jamil: atendido pelo WhatsApp inteiro, mas nunca "marcado".
// v1246 — a lista "Sem atender 30d+" foi apagada a pedido dele, mas essa ordenação NÃO morreu com
// ela: quem usa hoje é o resgate da fila "Fazer agora" (quem nunca foi contatado primeiro, depois
// o contato mais antigo), que é onde ela faz mais diferença no dia dele.
assert.match(app, /\.sort\(\(a, b\) => \(a\.t - b\.t\) \|\| \(a\.i - b\.i\)\)/,
  'ordenação pelo contato real continua viva no resgate da fila');
// Rótulo de tempo relativo (§6.5): "hoje" / "ontem" / "há X dias".
// v1186 — este item mirava `rotuloTempoAtendimento`, uma função que a v1101 aposentou e ninguém
// removeu ("CONTAGEM DE DIAS SAIU. VIRAM DATAS" — o dono leu "14 dias" ao lado da Silvana,
// atendida ontem, e entendeu 14 dias parada). A lista passou a mostrar a DATA de volta, com o
// tempo relativo só como legenda embaixo. A auditoria de 09/08/2026 removeu a função morta e
// trouxe a guarda pro texto que o corretor realmente lê hoje.
assert.match(app, /desde === 0 \? "atendido hoje" : desde === 1 \? "atendido ontem" : `atendido há \$\{desde\} dias`/,
  'a legenda de tempo relativo do atendimento precisa continuar (hoje / ontem / há X dias)');
assert.match(app, /<small class="lgt-rot">volta dia<\/small><b>\$\{volta\}<\/b>/,
  'a coluna precisa continuar mostrando a DATA de volta, não uma contagem solta de dias');

console.log('v826-atendimentos: ok');
