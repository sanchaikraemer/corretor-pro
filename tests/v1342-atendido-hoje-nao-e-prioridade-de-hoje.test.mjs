import fs from 'node:fs';
import assert from 'node:assert/strict';
import "./_fuso-do-app.mjs";

// v1342 — CLIENTE ATENDIDO HOJE NÃO PODE APARECER NA FILA DE HOJE.
//
// Reclamação do dono, 20/08/2026, com dois prints do mesmo cliente (Jamil): *"um mostra que ele foi
// atendido hoje, agora há pouco, e ao mesmo tempo ele mostra como prioridades pra ser atendido"*.
//
// A v1332 consertou o LADO DE MOSTRAR (o número da linha passou a dizer "atendido hoje" em vez de
// um número velho). Este arquivo cobre o outro lado, que é o que ele apontou: a FILA. A regra do
// descanso já existe desde a v1018/v1052 e foi remendada várias vezes (v1213, v1264) — mas nunca
// teve teste com a forma exata do caso dele: atendimento REGISTRADO HOJE, com compromisso ou
// lembrete do mesmo dia ainda pendurado na análise.
//
// Cada caso abaixo é uma forma diferente de registrar "atendi hoje". Todas precisam segurar o
// cliente fora da fila — senão o app cobra o corretor por um trabalho que ele acabou de fazer.

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

const emJanelaDeEspera = new Function('obterCerebroConfigParaAnalise',
  `${fontes}\nreturn emJanelaDeEspera;`)(() => ({ diasDescansoPosAtendimento: 5 }));

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();
// "hoje de manhã" sem risco de virar ontem quando o teste roda de madrugada.
const hojeCedo = () => {
  const agora = Date.now();
  const duasHoras = agora - 2 * 3600000;
  const mesmoDia = (a, b) => new Intl.DateTimeFormat('en-CA', { timeZone: globalThis.cpFuso() }).format(new Date(a))
    === new Intl.DateTimeFormat('en-CA', { timeZone: globalThis.cpFuso() }).format(new Date(b));
  return new Date(mesmoDia(agora, duasHoras) ? duasHoras : agora).toISOString();
};
// v1355 — "hoje um pouco DEPOIS de hojeCedo", garantido no mesmo dia de calendário. A conferência
// da régua-por-dia usava "6 horas atrás" e "1 hora atrás": rodando de madrugada (o teste rodou às
// 01h37), seis horas atrás é ONTEM, os dois caíam em dias diferentes e o teste acusava um defeito
// que não existia. Mesma família das bombas-relógio de data achadas na v1338.
const hojeUmPoucoDepois = () => {
  const base = Date.parse(hojeCedo());
  const mesmoDiaQue = (a, b) => new Intl.DateTimeFormat('en-CA', { timeZone: globalThis.cpFuso() }).format(new Date(a))
    === new Intl.DateTimeFormat('en-CA', { timeZone: globalThis.cpFuso() }).format(new Date(b));
  const depois = base + 30 * 60000;
  return new Date(mesmoDiaQue(base, depois) ? depois : base).toISOString();
};

// ── 1. As quatro formas de "atendi hoje" ────────────────────────────────────────────────────
const formasDeAtenderHoje = {
  'botão Marcar atendimento': { analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: hojeCedo() }
  ] } } },
  'copiar a sugestão': { analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Mensagem enviada', de: 'copiar_msg' }, quando: hojeCedo() }
  ] } } },
  'campo do servidor': { lastAttendanceAt: hojeCedo(), analysis: {} },
  'observação manual na conversa': {
    analysis: {},
    recentMessages: [{ author: 'Miguel', text: 'Liguei, falamos por 20 min', iso: hojeCedo(), source: 'manual', type: 'observacao_manual' }]
  }
};
for (const [comoFoi, lead] of Object.entries(formasDeAtenderHoje)) {
  assert.equal(emJanelaDeEspera(lead), true,
    `atendido hoje (${comoFoi}) tem que ficar FORA da fila de hoje`);
}

// ── 2. O caso do Jamil: atendido hoje, com compromisso/lembrete do mesmo dia ainda na análise ─
// Este é o formato que gerou a reclamação. Um lembrete marcado pra hoje de manhã já está "vencido"
// às duas da tarde — e era por essa porta que o cliente voltava pra fila no mesmo dia em que foi
// atendido.
assert.equal(
  emJanelaDeEspera({ lastAttendanceAt: hojeCedo(), analysis: { lembrete: { quando: hojeCedo() }, geradoEm: hojeCedo() } }),
  true,
  'atendido hoje com lembrete de hoje: o lembrete foi cumprido HOJE, não pode devolver o cliente pra fila'
);
assert.equal(
  emJanelaDeEspera({
    lastAttendanceAt: hojeCedo(),
    analysis: { geradoEm: diasAtras(3), confirmedAppointments: [{ oQue: 'visita', quando: 'hoje' }] }
  }),
  true,
  'compromisso escrito como "hoje" numa análise de 3 dias atrás não pode furar o descanso depois de atendido'
);
assert.equal(
  emJanelaDeEspera({ lastAttendanceAt: hojeCedo(), analysis: { lembrete: { quando: diasAtras(9) }, geradoEm: diasAtras(9) } }),
  true,
  'lembrete velho, atendido hoje: cumprido — fica fora da fila'
);

// ── 3. O que NÃO pode mudar: o descanso não vira prisão ─────────────────────────────────────
// Se estas quatro deixarem de valer, a correção acima virou peneira e clientes somem da fila.
assert.equal(emJanelaDeEspera({ lastAttendanceAt: diasAtras(6), analysis: {} }), false,
  'passado o descanso (5 dias), o cliente volta pra fila — atendido há 6 dias já é elegível');
assert.equal(emJanelaDeEspera({ analysis: {} }), false,
  'cliente nunca atendido nunca esteve em descanso: entra na fila na hora');
// A régua do descanso é de DIA, não de hora — e isso é decisão, não descuido (v1264). Um lembrete
// marcado pra mais tarde no MESMO dia em que o cliente foi atendido não devolve ele pra fila: era
// exatamente essa devolução no mesmo dia que o dono chamou de ridícula. Já um lembrete de um dia
// POSTERIOR ao atendimento continua furando o descanso, que é pra isso que a regra existe.
assert.equal(
  emJanelaDeEspera({ lastAttendanceAt: hojeCedo(), analysis: { lembrete: { quando: hojeUmPoucoDepois() } } }),
  true,
  'atendido hoje de manhã, lembrete pra hoje à tarde: continua fora da fila DE HOJE (a régua é por dia)'
);
assert.equal(
  emJanelaDeEspera({ lastAttendanceAt: diasAtras(3), analysis: { lembrete: { quando: diasAtras(1) } } }),
  false,
  'lembrete de um dia POSTERIOR ao atendimento ainda não foi cumprido: tem que furar o descanso'
);
assert.equal(emJanelaDeEspera({ lastAttendanceAt: diasAtras(5), analysis: {} }), true,
  '5 dias de descanso são 5 dias inteiros: no 5º dia ainda está protegido (regra da v1019)');

console.log('v1342-atendido-hoje-nao-e-prioridade-de-hoje: ok');
