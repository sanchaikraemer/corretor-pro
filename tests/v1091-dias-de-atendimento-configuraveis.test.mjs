import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1091 — o dono mandou um print de sábado com TRÊS círculos vermelhos em cima da mesma
// informação: "Final de semana! Fila de 'Fazer agora' pausada — volta na segunda". Dois problemas
// diferentes no mesmo print:
//
//   1. A mesma frase aparecia em CINCO lugares (três deles na mesma tela).
//   2. Sábado e domingo eram cravados no código como dias sem fila (regra da v914/v937) — e
//      corretor de imóveis trabalha sábado, que é dia de visita.
//
// Ele escolheu: cada corretor marca no Cérebro os dias em que atende.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cerebroApi = fs.readFileSync(new URL('../api/cerebro-config.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. A regra deixou de ser sábado/domingo cravados ──────────────────────────────────────────
assert.doesNotMatch(app, /function cpFimDeSemana\(\)\{\s*\n\s*const d = new Date\(\)\.getDay\(\);\s*\n\s*return d === 0 \|\| d === 6;/,
  'sábado e domingo não podem mais estar cravados como dias sem fila');
assert.match(app, /function cpDiasDeAtendimento\(\)\{/, 'precisa existir a leitura dos dias configurados');
const fnFds = app.match(/function cpFimDeSemana\(\)\{[\s\S]*?\n\}/);
assert.ok(fnFds, 'cpFimDeSemana precisa continuar existindo (vários pontos da tela a usam)');
assert.match(fnFds[0], /cpDiasDeAtendimento\(\)/,
  '"hoje é dia sem fila?" precisa sair dos dias configurados pelo corretor');
assert.match(fnFds[0], /typeof cpDiasDeAtendimento === "function"/,
  'a função é extraída e rodada isolada por vários testes — precisa da guarda de typeof');
assert.match(fnFds[0], /: \[1, 2, 3, 4, 5\];/,
  'rodando isolada, o padrão precisa ser o comportamento antigo (segunda a sexta)');

// O padrão é o comportamento de antes (segunda a sexta): quem não configurar nada não vê mudança.
assert.match(app, /const CP_DIAS_ATENDIMENTO_PADRAO = \[1, 2, 3, 4, 5\];/,
  'sem configuração, o padrão precisa ser o comportamento antigo (segunda a sexta)');

// Lista vazia NÃO pode valer: seria "não atendo nunca", e a fila sumiria pra sempre sem explicação.
assert.match(app, /if\(limpos\.length\) return limpos;/,
  'lista de dias vazia precisa cair no padrão, nunca deixar o corretor sem fila pra sempre');
assert.match(cerebroApi, /return limpos\.length \? limpos : \[1, 2, 3, 4, 5\];/,
  'o servidor também precisa recusar lista vazia');

// ── 2. O aviso parou de se repetir ────────────────────────────────────────────────────────────
// Sobrou UM lugar na Home (a saudação). A caixa embaixo da lista e o número do card não repetem.
assert.match(app, /top3Html = cpFimDeSemana\(\) \? "" :/,
  'a caixa embaixo da lista não pode repetir o aviso que a saudação, logo acima, já deu');
assert.match(app, /const faB=`<b>\$\{fds\?0:fazerAgora\}<\/b>`;/,
  'o card "Fazer agora" precisa mostrar número (0), não a palavra "Final de semana" no lugar dele');

// Nenhum texto visível pode mais cravar "volta na segunda" nem "final de semana" — quem marca
// sábado no Cérebro tem outro "próximo dia".
const linhasDeCodigo = app.split('\n').filter(l => !l.trim().startsWith('//'));
for (const proibido of ['volta na segunda', 'Final de semana', 'Fim de semana']) {
  const achou = linhasDeCodigo.filter(l => l.includes(proibido));
  assert.equal(achou.length, 0,
    `"${proibido}" não pode aparecer em texto visível — o dia certo depende do que o corretor marcou (achei ${achou.length})`);
}
assert.match(app, /function cpProximoDiaDeAtendimento\(\)\{/,
  'precisa existir o cálculo do próximo dia em que ele atende');

// ── 3. A escolha é salva, lida e sincroniza entre aparelhos ───────────────────────────────────
assert.match(index, /<div id="cerebroDiasSemana"/, 'a tela do Cérebro precisa ter onde marcar os dias');
for (const dia of ['0', '1', '2', '3', '4', '5', '6']) {
  assert.ok(index.includes(`data-dia="${dia}"`), `falta o quadradinho do dia ${dia}`);
}
assert.match(app, /diasAtendimento: cpNormalizarDiasAtendimento\(c\.diasAtendimento\)/,
  'a configuração local precisa guardar os dias');
assert.match(app, /diasAtendimento: cpLerDiasAtendimentoDoFormulario\(\) \?\? \[\.\.\.CP_DIAS_ATENDIMENTO_PADRAO\]/,
  'salvar o Cérebro precisa mandar os dias marcados');
assert.match(app, /qsa\('#cerebroDiasSemana input\[type="checkbox"\]'\)\.forEach\(c => \{ c\.checked = diasSalvos\.includes/,
  'abrir o Cérebro precisa marcar os dias que estavam salvos');

// A leitura devolve null quando a tela nem foi montada — senão salvar de outra tela apagaria a
// escolha, mandando uma lista vazia.
assert.match(app, /function cpLerDiasAtendimentoDoFormulario\(\)\{\s*\n[\s\S]*?if\(!caixas \|\| !caixas\.length\) return null;/,
  'sem a tela do Cérebro montada, a leitura precisa devolver null (nunca lista vazia)');

// Servidor: salva, devolve e sobrevive à limpeza do pipeline (senão sumiria na sincronização).
assert.match(cerebroApi, /diasAtendimento: \[1, 2, 3, 4, 5\],/, 'o padrão do servidor precisa existir');
assert.match(cerebroApi, /diasAtendimento: normalizarDiasAtendimento\(body\.diasAtendimento\),/,
  'o servidor precisa gravar os dias que vierem do app');
assert.match(pipeline, /diasAtendimento: Array\.isArray\(v\.diasAtendimento\)/,
  'a limpeza da configuração precisa PRESERVAR os dias — senão a escolha some ao sincronizar');

console.log('v1091-dias-de-atendimento-configuraveis: ok');
