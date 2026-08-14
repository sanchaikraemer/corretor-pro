import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1278 — pedido do dono, com print da Home: batida a meta do dia, a tela mostrava só
// "Você já atendeu 26 hoje 👏" + o botão "Atender mais um" e MUITO espaço vazio embaixo. Cada
// clique revelava UM cliente. Ele quer a LISTAGEM ABAIXO: o resto da fila já listado, no mesmo
// formato da lista do dia, pra escolher quem atender sem ficar clicando de um em um.
//
// Este teste roda o trecho REAL de decisão da Home (extraído do app.js) com uma fila de 45
// clientes e confere: (1) a fila aparece listada nos dois casos (com dose do dia e com a meta já
// batida), (2) ela vem em blocos de 20, com o botão de abrir o próximo bloco, e (3) o botão
// antigo de "um por clique" não existe mais.

const ini = app.indexOf('let filaRanqueada = typeof cpFilaFazerAgora');
const fim = app.indexOf('foco.innerHTML');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'trecho de decisão da Home não encontrado em app.js');
const trecho = app.slice(ini, fim);

// O passo da lista fica em uma constante única do app (usada na Home e no botão "Mostrar mais").
const passoSrc = app.match(/const CP1278_FILA_PASSO ?= ?(\d+);/);
assert.ok(passoSrc, 'CP1278_FILA_PASSO não encontrada em app.js');
const PASSO = Number(passoSrc[1]);

function rodar({ fila, meta, limite }){
  const state = { fazerAgoraExtra: 0, cp1278FilaLimite: limite };
  const CP1278_FILA_PASSO = PASSO;
  const cpFilaFazerAgora = () => fila;
  const cpFazerAgoraDose = () => meta;
  const cpAtendidosHojeTotal = () => 26;
  const CP_DOSE_DIA = 10;
  const cpFimDeSemana = () => false;
  const cpHomeLeadRow = (l) => `<row id="${l.id}">`;
  return eval(`(function(){ const items=[]; ${trecho} return { dose, top3Html }; })();`);
}

const fila = Array.from({ length: 45 }, (_, i) => ({ id: 'c' + (i + 1) }));
const linhas = (html) => (html.match(/<row id="/g) || []).length;

// 1. Meta do dia BATIDA (o caso do print): parabéns + fila listada logo abaixo.
const batida = rodar({ fila, meta: 0 });
assert.equal(batida.dose.length, 0, 'meta batida = nenhuma dose do dia');
assert.match(batida.top3Html, /cp-hoje-done/, 'a frase de parabéns continua');
assert.match(batida.top3Html, /cp-fila-titulo/, 'com a meta batida a fila precisa vir listada abaixo');
assert.match(batida.top3Html, /Na fila · 45 clientes/, 'o título da fila mostra quantos ainda estão na fila');
assert.equal(linhas(batida.top3Html), PASSO, `mostra os primeiros ${PASSO} da fila, não a fila inteira de uma vez`);
assert.match(batida.top3Html, /cpMostrarMaisFilaHoje\(\)/, 'com mais de um bloco, aparece o botão de abrir o próximo');
assert.match(batida.top3Html, /faltam 25/, 'o botão diz quantos ainda faltam');
assert.doesNotMatch(batida.top3Html, /Atender mais um/, 'o botão de "um por clique" não pode voltar');

// 2. Dia normal (meta 10): a lista do dia continua igual E o resto da fila vem listado embaixo.
const normal = rodar({ fila, meta: 10 });
assert.equal(normal.dose.length, 10, 'a dose do dia continua sendo a meta');
assert.match(normal.top3Html, /cp-hoje-legenda[\s\S]*cp-hoje-list[\s\S]*cp-fila-titulo/, 'primeiro os do dia, depois a fila');
assert.match(normal.top3Html, /Na fila · 35 clientes/, 'a fila listada exclui quem já está na lista do dia');
assert.equal(linhas(normal.top3Html), 10 + PASSO, 'os 10 do dia + o primeiro bloco da fila');

// 3. "Mostrar mais" abre o próximo bloco (e o botão some quando a fila acaba).
const maisUmBloco = rodar({ fila, meta: 0, limite: PASSO * 2 });
assert.equal(linhas(maisUmBloco.top3Html), PASSO * 2, 'o segundo clique mostra o bloco seguinte');
assert.match(maisUmBloco.top3Html, /faltam 5/, 'o botão continua enquanto sobrar gente');
const tudo = rodar({ fila, meta: 0, limite: 100 });
assert.equal(linhas(tudo.top3Html), 45, 'com o limite acima do total, a fila inteira aparece');
assert.doesNotMatch(tudo.top3Html, /cpMostrarMaisFilaHoje/, 'sem ninguém sobrando, o botão de mostrar mais some');

// 4. Fila vazia (nada além do dia): nada de título de fila nem botão pendurado.
const soODia = rodar({ fila: fila.slice(0, 6), meta: 10 });
assert.equal(soODia.dose.length, 6, 'a dose leva todo mundo que existe');
assert.doesNotMatch(soODia.top3Html, /cp-fila-titulo|cpMostrarMaisFilaHoje/, 'sem fila sobrando, nada é listado abaixo');

console.log('v1278-fila-listada-abaixo-na-home: ok');
