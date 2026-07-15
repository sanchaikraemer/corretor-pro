import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// Extrai a função pura filaPorFatos de app.js (script de browser) e executa de verdade.
const src = app.match(/function filaPorFatos\(f = \{\}\)\{[\s\S]*?\n\}/);
assert.ok(src, 'não achei a função filaPorFatos em app.js');
const filaPorFatos = eval('(' + src[0] + ')');

const nivelDe = f => filaPorFatos(f).nivel;

// Cada fato isolado cai no nível certo (1..7).
assert.equal(nivelDe({ clienteAguardandoVoce: true }), 1);
assert.equal(nivelDe({ lembreteAtrasado: true }), 2);
assert.equal(nivelDe({ retornoParaHoje: true }), 3);
assert.equal(nivelDe({ negociacaoAguardando: true }), 4);
assert.equal(nivelDe({ compromissoProgramado: true }), 5);
assert.equal(nivelDe({ retomadaPorTempo: true }), 6);
assert.equal(nivelDe({ emJanela: true }), 7);

// Precedência: o fato mais forte sempre vence o mais fraco.
assert.equal(nivelDe({ clienteAguardandoVoce: true, lembreteAtrasado: true, negociacaoAguardando: true }), 1);
assert.equal(nivelDe({ lembreteAtrasado: true, negociacaoAguardando: true, compromissoProgramado: true }), 2);
assert.equal(nivelDe({ retornoParaHoje: true, negociacaoAguardando: true }), 3);
assert.equal(nivelDe({ negociacaoAguardando: true, compromissoProgramado: true, retomadaPorTempo: true }), 4);
assert.equal(nivelDe({ compromissoProgramado: true, retomadaPorTempo: true, emJanela: true }), 5);

// Grupos: níveis 1..5 = ação hoje; 6 = retomar com cuidado; 7 = pode aguardar.
for (const n of [1, 2, 3, 4, 5]) {
  const f = { 1:{clienteAguardandoVoce:true}, 2:{lembreteAtrasado:true}, 3:{retornoParaHoje:true}, 4:{negociacaoAguardando:true}, 5:{compromissoProgramado:true} }[n];
  assert.equal(filaPorFatos(f).grupo, 'acao-hoje');
}
assert.equal(filaPorFatos({ retomadaPorTempo: true }).grupo, 'retomar-cuidado');
assert.equal(filaPorFatos({ emJanela: true }).grupo, 'pode-aguardar');

// Supressão factual (§6.7 e afins):
// - atendido recentemente sai da fila de ação...
assert.equal(filaPorFatos({ atendidoRecente: true }).grupo, 'tratado-hoje');
assert.equal(filaPorFatos({ atendidoRecente: true }).nivel, 0);
// - ...mas se o cliente voltou a falar, ele reentra como nível 1 (caso Maria Clarisse).
assert.equal(nivelDe({ atendidoRecente: true, clienteAguardandoVoce: true }), 1);
// - negociação real fura a proteção de atendido recente.
assert.equal(nivelDe({ atendidoRecente: true, negociacaoAguardando: true }), 4);

// Lembrete futuro segura o lead, exceto se o cliente respondeu ou é retorno de hoje.
assert.equal(filaPorFatos({ lembreteFuturo: true }).grupo, 'pode-aguardar');
assert.equal(nivelDe({ lembreteFuturo: true, clienteAguardandoVoce: true }), 1);

// Cliente pediu tempo segura o lead, mas o cliente respondendo tem prioridade.
assert.equal(filaPorFatos({ clientePediuTempo: true }).titulo, 'Cliente pediu para aguardar');
assert.equal(nivelDe({ clientePediuTempo: true, clienteAguardandoVoce: true }), 1);
assert.equal(filaPorFatos({ clientePediuTempo: true, emJanela: true, retomadaPorTempo: true }).grupo, 'pode-aguardar');

// Trava externa só derruba quando não há pendência sua; com pendência, segue a fila.
assert.equal(filaPorFatos({ travaExterna: true }).grupo, 'boa-sem-urgencia');
assert.equal(nivelDe({ travaExterna: true, pendenciaCorretor: true, retomadaPorTempo: true }), 6);

// Sem nenhum fato: baixa prioridade.
assert.equal(filaPorFatos({}).grupo, 'baixa-prioridade');

// §6.6: os pesos subjetivos antigos foram removidos da fila.
const bloco = app.slice(app.indexOf('function prioridadeAtendimento(l){'), app.indexOf('function scorePrioridadeAtendimento'));
assert.doesNotMatch(bloco, /score \+= 120|score \+= 92|score \+= 55|score -= 34|score -= 300/, 'pesos subjetivos não podem sobrar na fila');

console.log('v826-fila-fatos: ok');
