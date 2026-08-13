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

// ---------- 2b. v1251 — as três contagens MUDARAM DE CASA (mesma régua, outro lugar) ----------
//
// O dono pediu pra tirar do quadradinho ("acho q ta na hora de tirarmos ele de dentro desse
// card") e ver junto as mensagens trocadas no mês. As três contagens continuam existindo, com a
// mesma régua de sempre — agora dentro do painel "Seu mês": aberto na coluna da direita no
// computador, atrás da linha de resumo no celular (modelo escolhido por ele em 13/08/2026).
{
  const iniRBH = app.indexOf('renderResumoDia = function(items){');
  const fimRBH = app.indexOf('\n};', iniRBH) + 3;
  assert.ok(iniRBH >= 0, 'renderResumoDia não encontrada em app.js');
  const rbh = app.slice(iniRBH, fimRBH);

  // O quadradinho saiu da fileira, e a fileira ficou com três.
  assert.doesNotMatch(rbh, /cp1171-atendidos/, 'o quadradinho "Atendidos" saiu da fileira (v1251)');
  assert.equal((rbh.match(/class="ui-kpi/g) || []).length, 3, 'a fileira ficou com três quadradinhos');
  assert.match(rbh, /cp1251RenderResumo\(\)/, 'a fileira precisa acionar a linha de resumo do celular');

  // E as três contagens seguem vivas, na mesma régua, dentro do painel novo.
  const iniD = app.indexOf('function cp1251Dados(){');
  const dados = app.slice(iniD, app.indexOf('\n}', iniD) + 2);
  assert.ok(iniD >= 0, 'cp1251Dados não encontrada em app.js');
  assert.match(dados, /atendidosHoje: base\.filter\(ehAtendidoHoje\)\.length/);
  assert.match(dados, /atendidosSemana: base\.filter\(ehAtendidoNaSemana\)\.length/);
  assert.match(dados, /atendidosMes: base\.filter\(ehAtendidoNoMes\)\.length/);
  // v1183 — "arquivado também é atendimento": a base continua sendo a carteira INTEIRA.
  assert.match(dados, /const base = \(Array\.isArray\(state\.todosLeads\) && state\.todosLeads\.length\)/,
    'as contagens precisam sair da carteira inteira, não só da ativa');

  // Nada de aro/rodinha (v1183: o dono leu como "carregando").
  assert.doesNotMatch(app, /stroke-dasharray/, 'nenhum aro proporcional volta pro lugar dos atendidos');
}

console.log('v1171-atendidos-hoje-semana-mes: ok');
