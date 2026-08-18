import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1294 — NADA DE CONTA FEITA PRA NINGUÉM VER.
//
// A revisão de 18/08/2026 achou dois blocos que trabalhavam e jogavam o resultado fora, porque o
// pedaço de tela que eles preenchiam tinha sido apagado em faxinas antigas. O dono decidiu os dois
// no mesmo dia, e este teste tranca as duas decisões.
//
//   1. "Atividade do dia" (Desempenho): cinco contas varrendo a carteira INTEIRA a cada desenho da
//      tela — atendidos hoje, sem resposta 3+ dias, lembretes, compromissos e a porcentagem da
//      rosca — escritas em quatro lugares inexistentes. Resposta do dono, depois de ver um desenho
//      de como ficaria: *"item 3 - apaga"*.
//
//   2. As nove mensagens de andamento do aprendizado da carteira ("37 históricos verificados",
//      "pausado na conversa 12…"), escritas num lugar que não existe em tela nenhuma. Resposta do
//      dono: *"nao precio ver nada de 'rosca' - o aprendizado estando funcionando é o que importa"*.
//
// A regra que fica: conta que ninguém lê não pode voltar. Se um desses recursos for reativado, ele
// volta COM o lugar na tela — e este teste passa a cobrar o par (conta + lugar), nunca a conta só.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// ── 1. Os quatro lugares mortos não podem voltar sem tela ────────────────────────────────────
for (const id of ['cpActivityDonut', 'cpActivityLegend', 'cpActivitiesDone', 'cpActivitiesTotal']) {
  const noApp = app.includes(id);
  const naTela = html.includes(`id="${id}"`);
  assert.ok(!noApp || naTela,
    `o app volta a escrever em #${id}, mas esse lugar não existe no index.html — ou some do app, ou nasce na tela`);
}

// E as contas que só alimentavam esse bloco também não podem voltar sozinhas.
assert.ok(!/const semResposta=items\.filter/.test(app),
  'a conta de "sem resposta 3+ dias" do Desempenho foi apagada na v1294 (ninguém lia o resultado)');
assert.ok(!/const donePct=cpPct\(atendidosHoje/.test(app),
  'a porcentagem da rosca "Atividade do dia" foi apagada na v1294');

// ── 2. O andamento do aprendizado saiu, mas o APRENDIZADO continua inteiro ───────────────────
assert.ok(!app.includes('cpAprendAtualizarStatus'),
  'as mensagens de andamento do aprendizado saíram na v1294 — escreviam num lugar que não existe');
assert.ok(!app.includes('cerebroCarteiraStatus'),
  'o lugar de tela que nunca existiu não pode voltar como destino de texto');

// O que NÃO pode ter sido levado junto: a varredura, a fila de pendentes, as retomadas e o aviso
// final. É isso que faz o Cérebro aprender com as conversas já importadas.
for (const [trecho, oQueE] of [
  ['function cpAprendLerPendentes', 'a lista de conversas que falharam e precisam ser refeitas'],
  ['function cpAprendSalvarPendentes', 'a gravação dessa lista'],
  ['function cpAprendAgendarRetomada', 'a retomada automática depois de uma falha'],
  ['function cpAprendAdquirirLock', 'a trava que impede duas abas aprendendo a mesma coisa'],
  ['cpAprendProcessarFilaPendente', 'o processamento da fila pendente'],
  ['cpAprendFinalizar', 'o fechamento do aprendizado da carteira'],
  ['✓ Carteira aprendida.', 'o único aviso que o corretor realmente vê ao fim']
]) {
  assert.ok(app.includes(trecho), `${oQueE} precisa continuar — o dono mandou tirar o RELATÓRIO, não o aprendizado`);
}

// ── 3. A rosca que EXISTE de verdade continua sendo preenchida ───────────────────────────────
//
// Cuidado registrado: o laudo da v1292 disse que `cpTotalAtendimentos` também estava sem lugar na
// tela. Estava errado — ele é o número grande no meio da rosca "Prioridade de atendimento", que
// funciona. Por pouco não foi apagado junto.
assert.match(html, /id="cpTotalAtendimentos"/, 'o número do meio da rosca de prioridade continua na tela');
assert.match(app, /cpSetText\("cpTotalAtendimentos"/, 'e continua sendo preenchido pelo app');
assert.match(html, /id="cpTempDonut"/, 'a rosca de prioridade continua na tela');
assert.match(app, /qs\("#cpTempDonut"\)/, 'e continua sendo desenhada');
assert.match(app, /qs\("#cpTempLegend"\)/, 'com a legenda dela junto');

console.log('v1294-nada-calculado-a-toa: ok');
