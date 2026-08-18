// v1246 — a fileira de quadradinhos da Home encolheu de 7 pra 4. Pedido do dono em 13/08/2026, com
// print e um círculo vermelho no espaço vazio da barra de cima:
//
//   "quero q elimine o card 'bloco de notas' e coloque ele ali em cima onde circulei"
//   "sem atender mais de 30 dias, pode deletar tb, nao sera mais necessario"
//   "arquivados tambem pode eliminar o card, mas coloque um icone la em cima q possa ver e
//    acompanhar e abrir eles novamente se um dia quiser"
//
// Mandei quatro modelos e ele escolheu o B: notas e arquivados entram DENTRO da mesma pastilha do
// calendário e do sino, separados por risquinho. A barra fica com um objeto só à direita.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// ── 1. OS DOIS BOTÕES NOVOS ESTÃO DENTRO DO BLOCO DO TOPO ──────────────────────────────────────
const bloco = html.match(/<div class="cp-agbloco" id="cpAgendaBloco">[\s\S]*?<\/div>/)?.[0];
assert.ok(bloco, 'o bloco do topo precisa existir');
for (const [id, destino, oque] of [
  ['btnNotasTopo', 'cp1170AbrirPainel()', 'Bloco de notas'],
  ['btnArquivadosTopo', "show('arquivados')", 'Arquivados']
]) {
  assert.ok(bloco.includes(`id="${id}"`), `${oque} precisa estar DENTRO do bloco do topo (modelo B)`);
  assert.ok(bloco.includes(`onclick="${destino}"`), `${oque} precisa abrir a tela dele`);
}
// Modelo B = uma pastilha só, com risquinho entre cada par. Quatro botões → três divisórias.
assert.equal((bloco.match(/class="cp-agbloco-met"/g) || []).length, 3,
  'notas, arquivados e calendário são os três botões neutros da pastilha');
assert.ok(bloco.includes('cp-agbloco-hoje'), 'e o sino continua sendo o quarto, com o destaque dele');
assert.equal((bloco.match(/class="cp-agbloco-div"/g) || []).length, 3,
  'três risquinhos separando os quatro — é o que faz o modelo B ser um bloco só');
// A ordem importa: o que é arquivo vem antes do que é agenda.
const ordem = ['btnNotasTopo', 'btnArquivadosTopo', 'btnAgendaTotalTopo', 'topBell']
  .map(id => bloco.indexOf(`id="${id}"`));
assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b),
  'ordem na barra: notas, arquivados, calendário, sino');

// ── 2. OS TRÊS QUADRADINHOS SAÍRAM DA FILEIRA ──────────────────────────────────────────────────
const iFileira = app.indexOf('<span>Fazer agora</span>');
const fileira = iFileira > -1 ? app.slice(app.lastIndexOf('box.innerHTML = `', iFileira), app.indexOf('`;', iFileira) + 2) : '';
assert.ok(fileira, 'a fileira de quadradinhos precisa existir');
for (const sumiu of ['Sem atender 30d+', 'Arquivados', 'Bloco de notas']) {
  assert.ok(!fileira.includes(`<span>${sumiu}</span>`), `"${sumiu}" não pode continuar na fileira`);
}
for (const fica of ['Fazer agora', 'Total de leads', 'Aguardando cliente']) {
  assert.ok(fileira.includes(`<span>${fica}</span>`), `"${fica}" continua na fileira`);
}
// v1251 — "Atendidos" também saiu da fileira: virou o painel "Seu mês", junto das mensagens
// trocadas no mês e do gráfico de atendimentos dia a dia (ver tests/v1251-*).
assert.ok(!fileira.includes('<span>Atendidos</span>'), '"Atendidos" saiu da fileira na v1251');
assert.equal((fileira.match(/class="ui-kpi/g) || []).length, 3, 'a fileira fica com três');
// E o desktop precisa acompanhar: coluna a mais que quadradinho deixa card esticado sozinho.
assert.match(css, /#home \.resumo-dia\{display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/,
  'três quadradinhos, três colunas no computador');

// ── 3. "SEM ATENDER 30D+" FOI APAGADO DE VERDADE ───────────────────────────────────────────────
// Ele disse "nao sera mais necessario". Sem o quadradinho, a lista não tinha mais porta de entrada:
// deixar a função e a rota no código só enganaria quem lesse depois.
for (const morto of ['cpAbrirSemAtender30Dias', '__semAtender30', 'cpContarSemAtender']) {
  assert.ok(!app.includes(morto), `"${morto}" não pode sobreviver à remoção da tela`);
}
// v1293 — aqui estava escrito que "a RÉGUA continua: a fila Fazer agora usa ela". A revisão de
// 18/08/2026 leu a fila inteira e provou que não usava: cpSemAtenderHaDias não era chamada por
// ninguém no app. A régua saiu junto com a tela, agora de verdade (ver v1071).
assert.ok(!app.includes('function cpSemAtenderHaDias'),
  'a régua saiu na v1293 — nenhuma tela ou fila a consultava');

// ── 4. UM NÚMERO, UMA CONTA SÓ ─────────────────────────────────────────────────────────────────
// Lição das v1215/v1227: dois lugares contando a mesma coisa sempre divergem.
const fn = app.match(/function cp1246AtualizarBlocoTopo\(\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(fn, 'precisa existir uma função só que preenche os dois números do topo');
assert.match(fn, /cpNotasTopoN/, 'ela preenche o número das notas');
assert.match(fn, /cpArquivadosTopoN/, 'e o dos arquivados');
assert.match(fn, /cp1170PendCount/, 'notas usam o MESMO contador do painel do Bloco de notas');
assert.match(fn, /ETAPA_ARQUIVADO/, 'arquivados saem da carteira inteira, não só da ativa');
// Quem mexe em nota manda atualizar o topo — não o quadradinho velho, que não existe mais.
assert.ok(!app.includes('#kpiNotas b'), 'o número não pode continuar sendo escrito no card apagado');
assert.match(app, /function cp1170Rerender\(\)\{\s*(?:\/\/[^\n]*\n\s*)*cp1246AtualizarBlocoTopo\(\);/,
  'ao mexer numa nota, quem se atualiza é o bloco do topo');
// E o clique fora do painel de notas precisa perdoar o botão novo, senão o painel fecha na hora
// em que ele acabou de abrir.
assert.ok(app.includes("closest(\"#btnNotasTopo\")"),
  'clicar no botão novo não pode ser lido como "clique fora" do painel de notas');
assert.ok(!app.includes('#kpiNotas'), 'nenhuma sobra do quadradinho apagado');

console.log('v1246-notas-e-arquivados-no-topo: ok');
