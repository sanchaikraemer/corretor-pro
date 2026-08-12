import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1171 — dois pedidos do dono nesta rodada:
// 1) reanalisar sozinho depois de salvar uma observação (sem precisar tocar em "Reanalisar" à
//    parte) — ele reportou "salvei uma obs e não vi atualizar automaticamente como mandei".
// 2) um quadradinho "Atendidos" com 3 contagens simples (hoje / semana / mês, SEM ligação com
//    meta/dose) do lado do Bloco de notas (v1170) — junto os dois fecham 8 quadradinhos na
//    fileira da Home, que empata certinho em 2 linhas de 4 no celular (7 sobrava 1 sozinho).

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// ---------- 1. cp7ObsSalvar mostra a observação na hora (a reanálise automática da v1171 ----------
// foi revertida na v1228 a pedido do dono — a prova de que ela NÃO dispara mais está em
// tests/observacao-aprendizado.test.mjs; aqui fica só o que continua valendo deste pedido:
// a observação aparece imediatamente na tela depois de salvar).
{
  const obsStart = app.indexOf('window.cp7ObsSalvar = async function(btn)');
  const obsEnd = app.indexOf('window.ui670Reanalisar=', obsStart);
  assert.ok(obsStart >= 0 && obsEnd > obsStart, 'cp7ObsSalvar não encontrada em app.js');
  const obsBlock = app.slice(obsStart, obsEnd);
  assert.match(obsBlock, /renderLeadFoco\(lead\)/,
    'salvar observação precisa mostrar a observação na tela na hora (renderLeadFoco)');
}

// ---------- 2a. ehAtendidoNaSemana / ehAtendidoNoMes — SEMANA e MÊS DE CALENDÁRIO ----------
// v1183 — este bloco cobrava janelas corridas de 7 e 30 dias. O dono olhou a Home no dia 8 de
// agosto, viu "183 no mês" (que na verdade contava desde 9 de julho) e pediu: "quero o mês vigente
// e não últimos 7 ou 30". As réguas passaram a ser calendário — a prova detalhada das duas está em
// tests/v1183-atendidos-mes-vigente.test.mjs. Aqui fica só o que continua valendo pra este
// quadradinho: as duas existem, são independentes uma da outra e ignoram lead sem evento.
{
  const fnSemana = app.match(/function ehAtendidoNaSemana\(l\)\{[\s\S]*?\n\}/)?.[0];
  const fnMes = app.match(/function ehAtendidoNoMes\(l\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(fnSemana && fnMes, 'ehAtendidoNaSemana/ehAtendidoNoMes não encontradas em app.js');
  assert.doesNotMatch(fnSemana, /7\s*\*\s*24/, 'a semana não pode voltar a ser janela corrida de 7 dias');
  assert.doesNotMatch(fnMes, /30\s*\*\s*24/, 'o mês não pode voltar a ser janela corrida de 30 dias');

  const sandbox = new Function(`
    const cpInicioSemanaMs = () => 1000;
    const cpInicioMesMs = () => 500;
    ${fnSemana}
    ${fnMes}
    return { ehAtendidoNaSemana, ehAtendidoNoMes };
  `)();
  const leadCom = (ms) => ({ analysis: { aprendizado: { eventos: [{ evento: 'contato_manual', quando: new Date(ms).toISOString() }] } } });

  assert.equal(sandbox.ehAtendidoNaSemana(leadCom(2000)), true, 'atendimento depois do começo da semana conta');
  assert.equal(sandbox.ehAtendidoNaSemana(leadCom(700)), false, 'atendimento anterior ao começo da semana não conta');
  assert.equal(sandbox.ehAtendidoNoMes(leadCom(700)), true, 'mas esse mesmo atendimento conta no mês — réguas independentes');
  assert.equal(sandbox.ehAtendidoNoMes(leadCom(100)), false, 'atendimento do mês passado não conta');
  assert.equal(sandbox.ehAtendidoNoMes({ analysis: {} }), false, 'lead sem nenhum evento não conta');
}

// ---------- 2b. renderResumoDia — o quadradinho "Atendidos" existe, com os 3 números, depois do Bloco de notas ----------
{
  const iniRBH = app.indexOf('renderResumoDia = function(items){');
  const fimRBH = app.indexOf('\n};', iniRBH) + 3;
  assert.ok(iniRBH >= 0, 'renderResumoDia não encontrada em app.js');
  const rbh = app.slice(iniRBH, fimRBH);

  // v1183 — a base deixou de ser `ativos`: "arquivado também é atendimento" (dono). Ver
  // tests/v1183-atendidos-mes-vigente.test.mjs.
  assert.match(rbh, /const atendidosHoje ?= ?baseAtendidos\.filter\(ehAtendidoHoje\)\.length/);
  assert.match(rbh, /const atendidosSemana ?= ?baseAtendidos\.filter\(ehAtendidoNaSemana\)\.length/);
  assert.match(rbh, /const atendidosMes ?= ?baseAtendidos\.filter\(ehAtendidoNoMes\)\.length/);

  assert.match(rbh, /class="ui-kpi cp1171-atendidos"/, 'precisa existir o quadradinho de Atendidos');
  assert.match(rbh, /class="cp1171-col"><b>\$\{atendidosHoje\}<\/b><small>hoje<\/small>/);
  assert.match(rbh, /class="cp1171-col"><b>\$\{atendidosSemana\}<\/b><small>semana<\/small>/);
  assert.match(rbh, /class="cp1171-col"><b>\$\{atendidosMes\}<\/b><small>mês<\/small>/);

  // não pode virar barra/aro proporcional (dose batida) — o dono foi explícito: "concluídos e não
  // dentro de uma meta". v1183: o arinho decorativo saiu de vez (parecia rodinha de carregando),
  // então agora a regra é mais simples — nenhum aro, proporcional ou não.
  assert.doesNotMatch(rbh, /stroke-dasharray/, 'o quadradinho de Atendidos não pode ter aro nenhum (v1183: parecia carregando)');

  // fica depois do Bloco de notas, os dois juntos fecham 8 quadradinhos (7 sobrava 1 sozinho no celular)
  const posNotas = rbh.indexOf('id="kpiNotas"');
  const posAtendidos = rbh.indexOf('cp1171-atendidos');
  assert.ok(posNotas > 0 && posAtendidos > posNotas, 'o quadradinho de Atendidos precisa vir depois do Bloco de notas, fechando 8 quadradinhos na fileira');
}

console.log('v1171-atendidos-hoje-semana-mes: ok');
