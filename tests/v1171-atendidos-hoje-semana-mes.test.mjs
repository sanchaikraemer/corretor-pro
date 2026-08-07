import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1171 — dois pedidos do dono nesta rodada:
// 1) reanalisar sozinho depois de salvar uma observação (sem precisar tocar em "Reanalisar" à
//    parte) — ele reportou "salvei uma obs e não vi atualizar automaticamente como mandei".
// 2) um quadradinho "Atendidos" com 3 contagens simples (hoje / semana / mês, SEM ligação com
//    meta/dose) do lado do Bloco de notas (v1170) — junto os dois fecham 8 quadradinhos na
//    fileira da Home, que empata certinho em 2 linhas de 4 no celular (7 sobrava 1 sozinho).

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// ---------- 1. cp7ObsSalvar dispara a reanálise sozinha depois de mostrar a observação ----------
{
  const obsStart = app.indexOf('window.cp7ObsSalvar = async function(btn)');
  const obsEnd = app.indexOf('window.ui670Reanalisar=', obsStart);
  assert.ok(obsStart >= 0 && obsEnd > obsStart, 'cp7ObsSalvar não encontrada em app.js');
  const obsBlock = app.slice(obsStart, obsEnd);
  assert.match(obsBlock, /renderLeadFoco\(lead\);[\s\S]*ui670Reanalisar\(qs\("#btnReanalisarLeadTop"\)\)/,
    'salvar observação precisa mostrar a observação (renderLeadFoco) e DEPOIS reanalisar sozinha, usando a referência fresca do botão Reanalisar');
}

// ---------- 2a. ehAtendidoNoMes — mesma régua de ehAtendidoNaSemana, só que 30 dias ----------
{
  const fnSemana = app.match(/function ehAtendidoNaSemana\(l\)\{[\s\S]*?\n\}/)?.[0];
  const fnMes = app.match(/function ehAtendidoNoMes\(l\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(fnSemana && fnMes, 'ehAtendidoNaSemana/ehAtendidoNoMes não encontradas em app.js');

  const sandbox = new Function(`
    ${fnSemana}
    ${fnMes}
    return { ehAtendidoNaSemana, ehAtendidoNoMes };
  `)();

  const diasAtras = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
  const leadCom = (quando) => ({ analysis: { aprendizado: { eventos: [{ evento: 'contato_manual', quando }] } } });

  assert.equal(sandbox.ehAtendidoNoMes(leadCom(diasAtras(2))), true, 'atendido há 2 dias conta no mês');
  assert.equal(sandbox.ehAtendidoNoMes(leadCom(diasAtras(15))), true, 'atendido há 15 dias conta no mês');
  assert.equal(sandbox.ehAtendidoNoMes(leadCom(diasAtras(45))), false, 'atendido há 45 dias NÃO conta no mês (fora dos 30 dias)');
  assert.equal(sandbox.ehAtendidoNoMes({ analysis: {} }), false, 'lead sem nenhum evento não conta');
  // dentro do mês mas fora da semana — prova que são réguas independentes, não uma reaproveitando a outra por acidente
  assert.equal(sandbox.ehAtendidoNaSemana(leadCom(diasAtras(15))), false, 'atendido há 15 dias NÃO conta na semana (fora dos 7 dias)');
  assert.equal(sandbox.ehAtendidoNoMes(leadCom(diasAtras(15))), true, 'mas continua contando no mês');
}

// ---------- 2b. renderResumoDia — o quadradinho "Atendidos" existe, com os 3 números, depois do Bloco de notas ----------
{
  const iniRBH = app.indexOf('renderResumoDia = function(items){');
  const fimRBH = app.indexOf('\n};', iniRBH) + 3;
  assert.ok(iniRBH >= 0, 'renderResumoDia não encontrada em app.js');
  const rbh = app.slice(iniRBH, fimRBH);

  assert.match(rbh, /const atendidosHoje ?= ?ativos\.filter\(ehAtendidoHoje\)\.length/);
  assert.match(rbh, /const atendidosSemana ?= ?ativos\.filter\(ehAtendidoNaSemana\)\.length/);
  assert.match(rbh, /const atendidosMes ?= ?ativos\.filter\(ehAtendidoNoMes\)\.length/);

  assert.match(rbh, /class="ui-kpi cp1171-atendidos"/, 'precisa existir o quadradinho de Atendidos');
  assert.match(rbh, /class="cp1171-col"><b>\$\{atendidosHoje\}<\/b><small>hoje<\/small>/);
  assert.match(rbh, /class="cp1171-col"><b>\$\{atendidosSemana\}<\/b><small>semana<\/small>/);
  assert.match(rbh, /class="cp1171-col"><b>\$\{atendidosMes\}<\/b><small>mês<\/small>/);

  // não pode virar barra/aro proporcional (dose batida) — o dono foi explícito: "concluídos e não
  // dentro de uma meta". O aro decorativo usa um stroke-dasharray FIXO, nunca calculado a partir
  // de atendidosHoje/atendidosSemana/atendidosMes.
  assert.doesNotMatch(rbh, /stroke-dasharray="\$\{/, 'o arinho do quadradinho de Atendidos precisa ser decorativo (fixo), não uma barra de progresso calculada');

  // fica depois do Bloco de notas, os dois juntos fecham 8 quadradinhos (7 sobrava 1 sozinho no celular)
  const posNotas = rbh.indexOf('id="kpiNotas"');
  const posAtendidos = rbh.indexOf('cp1171-atendidos');
  assert.ok(posNotas > 0 && posAtendidos > posNotas, 'o quadradinho de Atendidos precisa vir depois do Bloco de notas, fechando 8 quadradinhos na fileira');
}

console.log('v1171-atendidos-hoje-semana-mes: ok');
