// v1281 — AS DUAS TELAS QUE FALAM DE "MENSAGENS TROCADAS NO MÊS" PRECISAM DAR O MESMO NÚMERO.
//
// Print do dono (15/08/2026): painel "Seu mês" da tela inicial mostrando 1.469 mensagens no mês —
// "isso ta certo mesmo?". O painel estava certo (desde a v1251 ele soma os campos msgMes* que o
// SERVIDOR conta sobre a conversa inteira). Quem estava errada era a tela de resultados
// (cpDesempenhoMetricas): ela contava as mensagens da PRÉVIA que a listagem manda — as últimas ~8
// de cada cliente — e por isso mostrava um número bem menor pro MESMO mês.
//
// Esta suíte trava as duas pontas: o servidor precisa mandar os campos (inclusive os do mês
// fechado anterior, que a tela de resultados também mostra) e a tela precisa LER esses campos em
// vez de contar a prévia.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const persistence = readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

// ── SERVIDOR ──────────────────────────────────────────────────────────────────────────────────
for (const campo of ['msgMesAntTotal', 'msgMesAntCliente', 'msgMesAntCorretor']) {
  assert.ok(persistence.includes(`${campo},`) || persistence.includes(`${campo}:`),
    `o servidor precisa contar e devolver ${campo} (mensagens do mês fechado anterior)`);
}
assert.match(persistence, /const inicioDoMesAntBRMs = Date\.UTC\(/,
  'o mês anterior é uma janela de calendário de Brasília, igual ao mês corrente');
assert.match(persistence, /tMs >= inicioDoMesAntBRMs/,
  'a varredura precisa separar as mensagens do mês passado na MESMA passada');

// A contagem do mês passado só pode pegar o que NÃO é do mês corrente — senão agosto entraria em
// julho e os dois meses ficariam inflados.
const blocoVarredura = persistence.slice(
  persistence.indexOf('msgMesTotal = 0; msgMesCliente = 0; msgMesCorretor = 0;'),
  persistence.indexOf('if (dentro90d) messageCount90d++;')
);
assert.match(blocoVarredura, /\} else if \(Number\.isFinite\(tMs\) && tMs >= inicioDoMesAntBRMs\) \{/,
  'mês passado precisa ser o "senão" do mês corrente, nunca uma segunda contagem por cima');

// Campo novo no cache = versão nova do cache. Sem subir a versão, o cache gravado ontem (sem os
// campos) continuaria valendo e a tela mostraria zero no mês passado.
assert.match(persistence, /\n\s*v: 5,/, 'o cache de estatísticas precisa subir pra versão 5');
assert.match(persistence, /if \(!c \|\| c\.v !== 5 \|\| c\.dia !== hoje\) return false;/,
  'a validação do cache precisa exigir a versão 5');

// ── TELA DE RESULTADOS ────────────────────────────────────────────────────────────────────────
const ini = app.indexOf('function cpDesempenhoMetricas(');
const fim = app.indexOf('window.cpDesempenhoMetricas');
assert.ok(ini > 0 && fim > ini, 'cpDesempenhoMetricas precisa existir');
const metricas = app.slice(ini, fim);

assert.match(metricas, /const campoServidor = vendoMesAnterior \? l\?\.msgMesAntTotal : l\?\.msgMesTotal;/,
  'a tela precisa ler o total do servidor — do mês certo (corrente ou anterior)');
assert.match(metricas, /mensagensTrocadas: temMsgServidor \? msgServidor : msgPrevia,/,
  'com os campos do servidor em mãos, a prévia de 8 mensagens não pode mais ser a fonte');
assert.ok(!/if\(dentro\(t\)\) mensagensTrocadas\+\+/.test(metricas),
  'a contagem antiga em cima da prévia não pode sobreviver');

// ── AS DUAS FONTES, NA PRÁTICA ────────────────────────────────────────────────────────────────
// Mesma carteira, mesmo mês: o painel da tela inicial (v1251) e a tela de resultados precisam
// chegar ao MESMO total. É exatamente a divergência que o dono viu.
const carteira = [
  // 40 mensagens no mês, mas a listagem só manda 8 na prévia — é aqui que a conta antiga errava.
  { id: 'a', msgMesTotal: 40, msgMesCorretor: 25, msgMesCliente: 15, msgMesAntTotal: 12,
    recentMessages: Array.from({ length: 8 }, () => ({ iso: '2026-08-14T12:00:00-03:00' })) },
  { id: 'b', msgMesTotal: 9, msgMesCorretor: 4, msgMesCliente: 5, msgMesAntTotal: 0,
    recentMessages: Array.from({ length: 8 }, () => ({ iso: '2026-08-13T12:00:00-03:00' })) },
  { id: 'c', msgMesTotal: 0, msgMesCorretor: 0, msgMesCliente: 0, msgMesAntTotal: 30, recentMessages: [] },
];

// Painel "Seu mês" (mesma soma de cp1251Dados).
let painel = 0;
for (const l of carteira) painel += Number(l?.msgMesTotal) || 0;

// Tela de resultados, com a regra nova.
const somaTela = (vendoMesAnterior) => {
  let servidor = 0, tem = false;
  for (const l of carteira) {
    const campo = vendoMesAnterior ? l?.msgMesAntTotal : l?.msgMesTotal;
    if (campo !== undefined && campo !== null) { tem = true; servidor += Number(campo) || 0; }
  }
  return tem ? servidor : 0;
};

assert.equal(painel, 49, 'a carteira de teste tem 49 mensagens no mês');
assert.equal(somaTela(false), painel, 'as duas telas precisam mostrar o MESMO total do mês');
assert.equal(somaTela(true), 42, 'o mês passado soma os campos msgMesAnt*');
// A conta antiga (prévia) daria 16 nessa mesma carteira — o tamanho do erro que o dono via.
assert.notEqual(somaTela(false), 16, 'a prévia de 8 mensagens não pode mais mandar no número');

console.log('v1281 OK — as duas telas do mês leem a mesma fonte de mensagens');
