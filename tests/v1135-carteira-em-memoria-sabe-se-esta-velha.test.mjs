import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1135 — achado ESTRUTURAL da auditoria da madrugada. Não é um bug novo: é a causa comum de dois
// que já apareceram (v1125 "arquivei e o contador não subiu" e v1133 "deletei e não saiu daí") e
// de um terceiro que ninguém tinha relatado ainda (remarcar lembrete mostrava a data antiga).
//
// O sistema tem DUAS camadas de cache com regras diferentes:
//
//   1. carregarTelaAtiva() compara state.viewRendered[tela] com state.dataRevision. Essa camada
//      está CERTA: depois de qualquer gravação a revisão sobe, e a tela é marcada pra recarregar.
//   2. Só que carregarAgenda(), por dentro, tinha um atalho que renderizava de state.todosLeads e
//      voltava — sem olhar revisão nenhuma.
//
// Resultado: a camada 1 decidia "precisa recarregar", chamava carregarAgenda(), e a camada 2
// desenhava do mesmo pedaço de memória velho. A decisão certa da camada de fora era anulada pela
// de dentro. Cada ação nova (arquivar, excluir lembrete, remarcar) precisava lembrar de atualizar
// a memória na mão — e esquecer não dava erro nenhum, só mostrava dado velho.
//
// A correção separa as duas coisas: PINTAR RÁPIDO (a memória serve, mesmo velha — é melhor que
// "Carregando...") e ESTAR CERTO (se a memória não está em dia, revalida e repinta).

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const stateJs = fs.readFileSync(new URL('../js/state.js', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// 1) A marca existe e começa como "nunca preenchida".
// ---------------------------------------------------------------------------
assert.match(stateJs, /carteiraRevisao:\s*-1/,
  'state precisa nascer com carteiraRevisao:-1 (nunca preenchida) — 0 seria confundido com a revisão 0');

// ---------------------------------------------------------------------------
// 2) O carimbo só pode ser posto onde a carteira veio DO SERVIDOR. Carimbar onde ela recebe uma
//    cópia da própria memória faria o dado velho se declarar novo — o oposto do que queremos.
// ---------------------------------------------------------------------------
const chamadas = [...app.matchAll(/cpCarteiraSincronizada\(\)/g)].length;
assert.ok(chamadas >= 5, `esperava a definição + pelo menos 4 pontos de carimbo, achei ${chamadas}`);

// Cada carimbo precisa estar dentro do alcance de uma busca real ao servidor — nunca solto num
// caminho que só reusa memória. (A janela é generosa porque entre a busca e o carimbo cabe o
// tratamento de erro da própria busca.)
for (const m of app.matchAll(/cpCarteiraSincronizada\(\);/g)) {
  const antes = app.slice(Math.max(0, m.index - 2200), m.index);
  assert.match(antes, /getLeadsData\(/,
    'todo carimbo precisa vir depois de uma busca real ao servidor (getLeadsData)');
}

// O atalho de memória do dashboard NÃO pode carimbar: ele reusa a própria memória.
// v1166 — o fim do trecho é localizado sem depender do argumento exato de getLeadsData (que
// passou a ser `force === true`, pra a sincronização de fundo reaproveitar o dado recém-baixado em
// vez de baixar tudo de novo). Procurar o texto antigo fazia o indexOf devolver -1 e o "trecho"
// virar o arquivo inteiro — o teste passaria a acusar qualquer carimbo em qualquer lugar.
const inicioAtalho = app.indexOf('const cached = !force && state.itemsAtivos');
const fimAtalho = app.indexOf('const data = await getLeadsData(', inicioAtalho);
assert.ok(inicioAtalho > 0 && fimAtalho > inicioAtalho, 'não achei o atalho de memória da Home');
const atalhoHome = app.slice(inicioAtalho, fimAtalho);
assert.ok(!/cpCarteiraSincronizada/.test(atalhoHome),
  'o atalho de memória da Home não pode carimbar a carteira como fresca — ele não foi ao servidor');

// ---------------------------------------------------------------------------
// 3) A comparação: em dia = mesma revisão. Qualquer gravação sobe a revisão (invalidarLeadsCache)
//    e, a partir daí, a memória deixa de estar em dia até alguém buscar de novo.
// ---------------------------------------------------------------------------
const emDia = app.match(/function cpCarteiraEstaEmDia\(\)\{[\s\S]*?\n\}/);
assert.ok(emDia, 'cpCarteiraEstaEmDia não encontrada');
const rodar = (todosLeads, carteiraRevisao, dataRevision) =>
  new Function('state', `${emDia[0]}; return cpCarteiraEstaEmDia();`)({ todosLeads, carteiraRevisao, dataRevision });

assert.equal(rodar([{ id: 'a' }], 4, 4), true, 'mesma revisão = memória em dia');
assert.equal(rodar([{ id: 'a' }], 3, 4), false, 'revisão diferente = precisa revalidar');
assert.equal(rodar([{ id: 'a' }], -1, 0), false, 'carteira nunca preenchida não pode passar por em-dia');
assert.equal(rodar([], 4, 4), false, 'carteira vazia não é "em dia" — não há o que desenhar');
assert.equal(rodar(null, 4, 4), false, 'sem carteira nenhuma, revalida');

// invalidarLeadsCache precisa continuar subindo a revisão — é ele que torna a memória "velha"
// depois de cada gravação. Sem isso, a marca nunca deixaria de bater e a rede de segurança seria
// decorativa.
const invalidar = app.match(/function invalidarLeadsCache\(\)\{[\s\S]*?\n\}/)[0];
assert.match(invalidar, /state\.dataRevision = \(Number\(state\.dataRevision\) \|\| 0\) \+ 1/,
  'invalidarLeadsCache precisa subir a revisão — é o que marca a memória como velha');
assert.ok(!/carteiraRevisao/.test(invalidar),
  'invalidarLeadsCache NÃO pode mexer no carimbo da carteira: quem carimba é só quem buscou');

// ---------------------------------------------------------------------------
// 4) A Agenda: pinta da memória e revalida quando não está em dia — sem apagar a lista se a rede
//    falhar, e sem repintar se a pessoa já saiu da tela.
// ---------------------------------------------------------------------------
const agenda = app.slice(app.indexOf('if(Array.isArray(state.todosLeads) && state.todosLeads.length){'));
const trecho = agenda.slice(0, agenda.indexOf('box.innerHTML'));
assert.match(trecho, /renderAgenda\(\{ items: state\.todosLeads \}\);/, 'precisa pintar da memória primeiro (nada de "Carregando..." a cada volta)');
assert.match(trecho, /if\(cpCarteiraEstaEmDia\(\)\) return;/, 'memória em dia encerra ali — sem ida à rede à toa');
assert.match(trecho, /await getLeadsData\(\)/, 'memória velha precisa ir ao servidor');
assert.match(trecho, /if\(state\.active !== "agenda"\) return;/, 'não pode repintar uma tela que a pessoa já deixou');
assert.match(trecho, /catch\(_\)\{[^}]*\}/, 'falha de rede não pode apagar a lista que já está na tela');

console.log('v1135-carteira-em-memoria-sabe-se-esta-velha: ok');
