import fs from 'node:fs';
import assert from 'node:assert/strict';
// v1337 — o fuso do app saiu de 35 literais "America/Sao_Paulo" e virou cpFuso(). Este import
// entrega as funções REAIS de fuso do app.js pros trechos que este teste roda com eval.
import "./_fuso-do-app.mjs";

// v1265 — relato do dono (13/08/2026, três prints):
//
//   1) Carteira ativa, 1ª da lista: "Dani De Sm — PARADO HÁ 100 dias".
//   2) Dentro da cliente: "Última análise — 28/07/2026 · 18:16 / Última mensagem — 05/05/2026 · 20:01".
//   3) O histórico logo abaixo, aberto: a mensagem do TOPO é de 28/07/2026 · 18:16, mandada por ele.
//
// Ou seja: o app mostrava a mensagem de 28/07 na tela e, ao mesmo tempo, dizia que a cliente estava
// parada desde 05/05 — porque as duas contas ignoravam a "Mensagem enviada (você)" (o registro que
// nasce quando o corretor copia a sugestão).
//
// v1266 — o dono fechou a régua no dia seguinte, em uma frase: "último contato é último
// atendimento". Este teste foi atualizado pra ela. Não é mais "o toque mais recente entre conversa
// e atendimento": havendo atendimento registrado, é ELE que vale, mesmo que o cliente tenha escrito
// depois. A conversa só entra quando não existe atendimento nenhum.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const pegar = (re, oQue) => {
  const m = app.match(re);
  assert.ok(m, `não achei ${oQue}`);
  return m[0];
};

// ─── 1. A coluna "Parado há" ───────────────────────────────────────────────────────────────────
const colunaSrc = pegar(/const COLUNA_PADRAO = \{[\s\S]*?\n  \};/, 'COLUNA_PADRAO');
assert.match(colunaSrc, /diasParado\(l\)/, 'a coluna "Parado há" precisa usar diasParado');
assert.doesNotMatch(colunaSrc, /const d = l\.daysSinceLastInteraction;/,
  'a coluna não pode voltar a contar só a última mensagem do WhatsApp');

// diasParado é a régua da v1266: atendimento manda; sem atendimento, a conversa.
const diasParadoSrc = pegar(/function diasParado\(l\)\{[\s\S]*?\n\}/, 'diasParado');
assert.doesNotMatch(diasParadoSrc, /Math\.min/,
  'v1266: não é mais o toque mais recente entre conversa e atendimento — o atendimento manda');

const fontesColuna = [
  pegar(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/, 'diasCalendarioBR'),
  pegar(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/, 'TIPOS_ATENDIMENTO_TIMELINE'),
  pegar(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/, 'ultimoAtendimentoTs'),
  diasParadoSrc,
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
assert.match(colunaValor(dani), /<b>17<\/b> dias/, 'mensagem enviada pelo app conta como atendimento: 17 dias, não 100');

// v1266 — cliente que ESCREVEU ontem, mas foi atendido há 10 dias: vale o atendimento (10).
// Antes o Math.min fazia a conversa mandar e a tela dizia "1 dia".
const escreveuOntem = {
  daysSinceClientReply: 1,
  daysSinceLastInteraction: 1,
  analysis: {},
  recentMessages: [
    { source: 'manual', type: 'mensagem_enviada', iso: diasAtras(10), text: 'Retomando o contato' }
  ]
};
assert.match(colunaValor(escreveuOntem), /<b>10<\/b> dias/,
  'último contato é o último atendimento — mensagem do cliente não zera o contador');

// Cliente sem nenhum atendimento registrado continua mostrando o tempo da conversa.
assert.match(colunaValor({ daysSinceClientReply: 100, daysSinceLastInteraction: 100, analysis: {}, recentMessages: [] }),
  /<b>100<\/b> dias/, 'sem atendimento nenhum, o número da conversa continua valendo');

// Sem dado nenhum não inventa número.
assert.equal(colunaValor({ analysis: {}, recentMessages: [] }), '—', 'sem data nenhuma, mostra "—"');

// Singular continua certo (1 dia, não 1 dias).
assert.match(colunaValor({ daysSinceClientReply: 1, analysis: {}, recentMessages: [] }), /<b>1<\/b> dia\b/, 'singular preservado');

// ─── 2. A linha do cabeçalho do cliente ────────────────────────────────────────────────────────
// v1266 — com atendimento registrado ela é "Último atendimento"; sem nenhum, cai na última
// mensagem da conversa (a única data que existe nesse caso).
assert.match(app, /const ultimaMsgRotulo=ultimoAtTs\?'Último atendimento':'Última mensagem';/,
  'a linha precisa virar "Último atendimento" quando existe atendimento registrado');
assert.match(app, /\$\{ultimaMsgRotulo\} — \$\{ultimaMsgEm\}/, 'a linha exibida usa esse rótulo');
// (fora dos comentários — o histórico do porquê continua escrito no código, como sempre)
const codigo = app.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
assert.doesNotMatch(codigo, /cp1265UltimaMensagemExibida/,
  'v1266: a peça que juntava mensagem enviada + conversa saiu (o cabeçalho mostra o atendimento)');
assert.doesNotMatch(codigo, /\(do cliente\)'|\(sua\)'/,
  'v1266: a tela não diz mais de quem foi a última fala — "não interessa quem está esperando quem"');

console.log('v1265-parado-ha-conta-o-ultimo-toque-real: ok');
