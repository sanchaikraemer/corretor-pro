import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1265 — relato do dono (13/08/2026, três prints):
//
//   1) Carteira ativa, 1º da lista: "Dani De Sm — PARADO HÁ 100 dias".
//   2) Dentro da cliente: "Última análise — 28/07/2026 · 18:16 / Última mensagem — 05/05/2026 · 20:01".
//   3) O histórico logo abaixo, aberto: a mensagem do TOPO é de 28/07/2026 · 18:16, mandada por ele.
//
// Ou seja: o app mostrava a mensagem de 28/07 na tela e, ao mesmo tempo, dizia que a cliente estava
// parada desde 05/05. Os dois números ignoravam a mesma coisa — a "Mensagem enviada (você)", que
// nasce quando o corretor copia a sugestão e é gravada com source "manual".
//
// Correções: a coluna "Parado há" passa a usar diasParado (a régua do último toque REAL, que já
// existia e o ranking já usava), e o cabeçalho passa a mostrar a última mensagem EXIBIDA, dizendo
// de quem ela é.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const pegar = (re, oQue) => {
  const m = app.match(re);
  assert.ok(m, `não achei ${oQue}`);
  return m[0];
};

// ─── 1. A coluna "Parado há" ───────────────────────────────────────────────────────────────────
const colunaSrc = pegar(/const COLUNA_PADRAO = \{[\s\S]*?\n  \};/, 'COLUNA_PADRAO');
assert.match(colunaSrc, /diasParado\(l\)/, 'a coluna "Parado há" precisa usar diasParado (último toque real)');
assert.doesNotMatch(colunaSrc, /const d = l\.daysSinceLastInteraction;/,
  'a coluna não pode voltar a contar só a última mensagem do WhatsApp');

const fontesColuna = [
  pegar(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/, 'diasCalendarioBR'),
  pegar(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/, 'TIPOS_ATENDIMENTO_TIMELINE'),
  pegar(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/, 'ultimoAtendimentoTs'),
  pegar(/function diasParado\(l\)\{[\s\S]*?\n\}/, 'diasParado'),
  colunaSrc
].join('\n');

const colunaValor = new Function('ehContatadoHoje', `${fontesColuna}\nreturn COLUNA_PADRAO.valor;`)(() => false);
const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

// O caso da Dani: cliente calada há 100 dias, mas com mensagem enviada por ele há 17.
const dani = {
  daysSinceClientReply: 100,
  daysSinceLastInteraction: 100,
  analysis: {},
  recentMessages: [
    { source: 'manual', type: 'mensagem_enviada', iso: diasAtras(17), text: 'Boa noite Dani, tudo bem?' }
  ]
};
assert.match(colunaValor(dani), /<b>17<\/b> dias/, 'mensagem enviada pelo app conta como toque: 17 dias, não 100');

// Cliente sem nenhum toque registrado continua mostrando o tempo da conversa.
assert.match(colunaValor({ daysSinceClientReply: 100, daysSinceLastInteraction: 100, analysis: {}, recentMessages: [] }),
  /<b>100<\/b> dias/, 'sem toque nenhum, o número da conversa continua valendo');

// Sem dado nenhum não inventa número.
assert.equal(colunaValor({ analysis: {}, recentMessages: [] }), '—', 'sem data nenhuma, mostra "—"');

// Singular continua certo (1 dia, não 1 dias).
assert.match(colunaValor({ daysSinceClientReply: 1, analysis: {}, recentMessages: [] }), /<b>1<\/b> dia\b/, 'singular preservado');

// ─── 2. O cabeçalho "Última mensagem" ──────────────────────────────────────────────────────────
const fontesCabecalho = [
  pegar(/function ehMsgManualTimeline\(m\)\{[\s\S]*?\n\}/, 'ehMsgManualTimeline'),
  pegar(/const BUSINESS_RE[^\n]*\n/, 'BUSINESS_RE'),
  pegar(/function ehMsgDoCliente\([\s\S]*?\n\}/, 'ehMsgDoCliente'),
  pegar(/function cp786DataTs\(([\s\S]*?)\n\}/, 'cp786DataTs'),
  pegar(/function cp786MensagemTs\(m\)\{[\s\S]*?\n\}/, 'cp786MensagemTs'),
  pegar(/function cp786UltimaMensagemReal\(l\)\{[\s\S]*?\n\}/, 'cp786UltimaMensagemReal'),
  pegar(/function cp1265UltimaMensagemExibida\(l\)\{[\s\S]*?\n\}/, 'cp1265UltimaMensagemExibida')
].join('\n');
const ultimaExibida = new Function(`${fontesCabecalho}\nreturn cp1265UltimaMensagemExibida;`)();

const conversaDani = {
  name: 'Dani De Sm',
  recentMessages: [
    { author: 'Dani', iso: '2026-04-20T10:00:00-03:00', text: 'Fico no aguardo', source: 'txt' },
    { author: 'Corretor', iso: '2026-05-05T20:01:00-03:00', text: 'Oi Dani, notei que não conseguimos nos falar.', source: 'txt' },
    { author: 'Mensagem enviada (você)', iso: '2026-07-28T18:16:00-03:00', text: 'Boa noite Dani, tudo bem?', source: 'manual', type: 'mensagem_enviada' }
  ]
};
const exibida = ultimaExibida(conversaDani);
assert.equal(exibida.m.iso, '2026-07-28T18:16:00-03:00',
  'o cabeçalho precisa mostrar a mesma mensagem que abre o histórico (a de 28/07)');
assert.equal(exibida.falante, 'corretor', 'e precisa saber que essa mensagem é dele, não da cliente');

// Se o cliente respondeu DEPOIS da mensagem enviada, quem vale é a resposta dele.
const comResposta = {
  name: 'Dani De Sm',
  recentMessages: [
    ...conversaDani.recentMessages,
    { author: 'Dani', iso: '2026-08-02T09:00:00-03:00', text: 'Oi! Ainda tenho interesse', source: 'txt' }
  ]
};
const depois = ultimaExibida(comResposta);
assert.equal(depois.m.iso, '2026-08-02T09:00:00-03:00', 'resposta posterior do cliente é a última mensagem');
assert.equal(depois.falante, 'contato', 'e ela é do cliente');

// Observação/ligação/visita continuam FORA (não são mensagens).
const soObservacao = {
  name: 'Dani De Sm',
  recentMessages: [
    { author: 'Corretor', iso: '2026-05-05T20:01:00-03:00', text: 'Oi Dani', source: 'txt' },
    { author: 'Você', iso: '2026-07-28T18:16:00-03:00', text: 'Liguei, não atendeu', source: 'manual', type: 'ligacao' }
  ]
};
assert.equal(ultimaExibida(soObservacao).m.iso, '2026-05-05T20:01:00-03:00',
  'ligação/observação não é mensagem — não pode virar "última mensagem"');

// A tela precisa dizer de quem é a mensagem, senão troca uma confusão por outra.
assert.match(app, /ultimaMsgQuem=.*falante==='contato'\?' \(do cliente\)':' \(sua\)'/,
  'o cabeçalho precisa identificar de quem é a última mensagem');
assert.match(app, /Última mensagem — \$\{ultimaMsgEm\}\$\{ultimaMsgQuem\}/,
  'a linha exibida precisa juntar data e autor');

console.log('v1265-parado-ha-conta-o-ultimo-toque-real: ok');
