import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url).pathname, 'utf8');

// v988 — pedido explícito do dono (depois do print do "lembrete fantasma" do Valdir, v987):
// "nunca marque lembrete pelo que é dito, no histórico ou nas conversas ou observações. A
// agenda só pode ser anotada se clicar em agendamento." A régua por palavra-chave (lembreteDoTexto/
// lembreteDaTimeline) foi removida inteira — mesmo depois de 3 rodadas de ajuste (v930, v969,
// v987), toda frase natural nova achava um jeito de disparar um lembrete que ninguém pediu.
// Lembrete agora só nasce das actions explícitas "reagendar-lembrete"/"remover-lembrete" (não
// tocadas aqui) — salvar observação/atendimento ou reanalisar nunca mais cria ou muda um.

// 1. A heurística de texto não existe mais em lugar nenhum do arquivo.
for (const nome of ['lembreteDoTexto', 'lembreteDaTimeline', 'fazerLembrete', 'diasAteDiaSemana', 'diaSemanaBRDe']) {
  assert.doesNotMatch(src, new RegExp(`function ${nome}\\(`), `${nome} não pode mais existir — lembrete não é mais inferido de texto`);
}

// 2. aplicarLembrete: só preserva o que já existia (e só se não for legado auto:true), ou
// zera se o corretor excluiu. Nunca cria a partir de novoAtendimento/timeline.
const iniFn = src.indexOf('function aplicarLembrete(obj) {');
const fimFn = src.indexOf('\n\n  // Se for apenas salvar', iniFn);
assert.ok(iniFn > -1 && fimFn > -1, 'aplicarLembrete não encontrada');
const fnSrc = src.slice(iniFn, fimFn);
assert.doesNotMatch(fnSrc, /lembreteDoTexto|lembreteDaTimeline|novoAtendimento/, 'aplicarLembrete não pode mais ler texto pra decidir o lembrete');

function rodar(previous) {
  const obj = {};
  eval(`(function aplicarLembreteTeste(){ const previous = ${JSON.stringify(previous)}; ${fnSrc.replace('function aplicarLembrete', 'function aplicarLembreteReal')} aplicarLembreteReal(obj); })()`);
  return obj;
}

// Sem lembrete manual anterior: mesmo com "excluir" não marcado, não inventa nenhum.
assert.deepEqual(rodar({}).lembrete, null, 'sem lembrete anterior, nada é criado do nada');

// Lembrete manual anterior (auto:false, posto pelo botão Agendar): é preservado.
const manual = { quando: '2026-08-01T12:00:00.000Z', motivo: 'Retomar contato', auto: false };
assert.deepEqual(rodar({ lembrete: manual }).lembrete, manual, 'lembrete posto manualmente (Agendar) é preservado');

// Lembrete legado auto:true (inventado pela régua antiga, antes desta versão): descartado.
const legado = { quando: '2026-08-01T12:00:00.000Z', motivo: 'Inventado pela régua antiga', auto: true };
assert.equal(rodar({ lembrete: legado }).lembrete, null, 'lembrete legado auto:true é descartado, não repropagado');

// lembreteRemovido: corretor excluiu — fica null mesmo que exista um lembrete manual "vivo" no objeto anterior.
assert.equal(rodar({ lembrete: manual, lembreteRemovido: true }).lembrete, null, 'lembreteRemovido sempre zera, mesmo com lembrete manual presente');

// 3. As ações explícitas de agendar/remover continuam existindo e intactas (não mexidas aqui).
assert.match(src, /body\?\.action === "reagendar-lembrete"/, 'ação explícita de reagendar precisa continuar existindo');
assert.match(src, /body\?\.action === "remover-lembrete"/, 'ação explícita de remover precisa continuar existindo');

console.log('v988-lembrete-so-por-acao-explicita: ok');
