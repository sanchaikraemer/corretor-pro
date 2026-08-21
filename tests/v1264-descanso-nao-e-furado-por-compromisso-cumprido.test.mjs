import fs from 'node:fs';
import assert from 'node:assert/strict';
// v1337 — o fuso do app saiu de 35 literais "America/Sao_Paulo" e virou cpFuso(). Este import
// entrega as funções REAIS de fuso do app.js pros trechos que este teste roda com eval.
import "./_fuso-do-app.mjs";

// v1264 — relato do dono (13/08/2026, prints): o lead "Bocorni" voltou pro "Fazer agora" 3 dias
// depois de ele ter copiado a sugestão (= atendimento registrado), com o descanso do Cérebro
// configurado em 7 dias. O descanso simplesmente não estava sendo aplicado nele.
//
// Causa: emJanelaDeEspera abria com "se tem lembrete vencido, não está em espera" — e um lembrete
// com data passada fica vencido PARA SEMPRE. O Bocorni tinha lembrete de 10/08 e atendimento em
// 10/08 (é o mesmo lead do caso da v1213, na Agenda): o compromisso foi CUMPRIDO no dia, mas essa
// linha continuava furando o descanso todo santo dia, antes de a regra dos 7 dias ser consultada.
//
// A v1213 corrigiu isso só na Agenda (cp786CompromissoAtrasado). Agora o descanso usa a MESMA peça
// (cpCompromissoJaAtendido) — compromisso cumprido não fura mais nada, compromisso NÃO cumprido
// continua furando (essa parte é de propósito e não pode se perder).

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function extrair(nome, marcaFim) {
  const ini = app.indexOf(nome);
  assert.ok(ini > -1, `não achei ${nome}`);
  const fim = app.indexOf(marcaFim, ini);
  assert.ok(fim > ini, `não achei o fim de ${nome}`);
  return app.slice(ini, app.lastIndexOf('}', fim) + 1);
}
const pegar = (re, oQue) => {
  const m = app.match(re);
  assert.ok(m, `não achei ${oQue}`);
  return m[0];
};

const fontes = [
  pegar(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/, 'TIPOS_ATENDIMENTO_TIMELINE'),
  pegar(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/, 'diasCalendarioBR'),
  pegar(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/, 'ultimoAtendimentoTs'),
  pegar(/function lembreteTs\(l\)\{[\s\S]*?\n\}/, 'lembreteTs'),
  pegar(/function lembreteVencido\(l\)\{.*\}/, 'lembreteVencido'),
  pegar(/function cpDiasDescansoPosAtendimento\(\)\{[\s\S]*?\n\}/, 'cpDiasDescansoPosAtendimento'),
  pegar(/function limiarRetomada\(l\)\{[\s\S]*?\n\}/, 'limiarRetomada'),
  pegar(/function cpTsUltimaAnalise\(l\)\{[\s\S]*?\n\}/, 'cpTsUltimaAnalise'),
  pegar(/function cp865UltimaAnaliseISO\(lead, a\)\{[\s\S]*?\n\}/, 'cp865UltimaAnaliseISO'),
  extrair('function cpCompromissoJaAtendido(l, ts){', 'window.cpCompromissoJaAtendido='),
  extrair('function emJanelaDeEspera(l){', '// Um lead com contato MUITO recente')
].join('\n');

// Descanso do Cérebro em 7 dias (o que o dono tem configurado no print).
const emJanelaDeEspera = new Function('obterCerebroConfigParaAnalise',
  `${fontes}\nreturn emJanelaDeEspera;`)(() => ({ diasDescansoPosAtendimento: 7 }));

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

// O caso real: atendido há 3 dias, lembrete daquele mesmo dia (cumprido pelo atendimento).
const bocorni = {
  lastAttendanceAt: diasAtras(3),
  analysis: { lembrete: { quando: diasAtras(3) }, geradoEm: diasAtras(3) }
};
assert.equal(emJanelaDeEspera(bocorni), true,
  'atendido há 3 dias com descanso de 7: o lembrete JÁ CUMPRIDO não pode furar o descanso');

// Sem atendimento nenhum, o lembrete vencido continua valendo como chamado (não virou peneira).
assert.equal(emJanelaDeEspera({ analysis: { lembrete: { quando: diasAtras(3) } } }), false,
  'lembrete vencido em lead nunca atendido continua liberando o lead pra fila');

// Lembrete criado DEPOIS do atendimento (ainda não cumprido) precisa continuar furando o descanso —
// é pra isso que essa regra existe.
assert.equal(emJanelaDeEspera({ lastAttendanceAt: diasAtras(3), analysis: { lembrete: { quando: diasAtras(1) } } }), false,
  'lembrete posterior ao atendimento ainda não foi cumprido: tem que furar o descanso');

// Lembrete marcado pro futuro não vence nada; vale a régua normal do descanso.
assert.equal(emJanelaDeEspera({ lastAttendanceAt: diasAtras(3), analysis: { lembrete: { quando: diasAtras(-4) } } }), true,
  'lembrete futuro não fura o descanso');

// Passado o descanso configurado, o lead volta — a correção não pode prender ninguém.
assert.equal(emJanelaDeEspera({ lastAttendanceAt: diasAtras(10), analysis: { lembrete: { quando: diasAtras(10) } } }), false,
  'atendido há 10 dias com descanso de 7: voltou a ser elegível');

// "hoje/amanhã" escrito na análise: o texto não envelhece sozinho. Com atendimento registrado no dia
// da análise (ou depois), esse compromisso já foi tratado e não fura mais o descanso.
const comTextoHoje = (extra) => ({
  analysis: { geradoEm: diasAtras(3), confirmedAppointments: [{ quando: 'hoje às 10h' }] },
  ...extra
});
assert.equal(emJanelaDeEspera(comTextoHoje({ lastAttendanceAt: diasAtras(3) })), true,
  '"hoje" de uma análise já atendida não pode furar o descanso pra sempre');
assert.equal(emJanelaDeEspera(comTextoHoje({ lastAttendanceAt: diasAtras(5) })), false,
  'atendimento ANTERIOR à análise não trata o compromisso dela: continua furando');
assert.equal(emJanelaDeEspera(comTextoHoje({})), false,
  'sem atendimento nenhum, "hoje" continua liberando o lead');

// A regra tem que ficar amarrada na mesma peça da Agenda (v1213) — se alguém trocar por uma conta
// própria, as duas telas voltam a discordar, que foi a origem deste bug.
const fonteJanela = extrair('function emJanelaDeEspera(l){', '// Um lead com contato MUITO recente');
assert.match(fonteJanela, /cpCompromissoJaAtendido/,
  'emJanelaDeEspera precisa usar cpCompromissoJaAtendido (mesma régua da Agenda)');

console.log('v1264-descanso-nao-e-furado-por-compromisso-cumprido: ok');
