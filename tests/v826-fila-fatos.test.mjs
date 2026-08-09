import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// Extrai a função pura filaPorFatos de app.js (script de browser) e executa de verdade.
const src = app.match(/function filaPorFatos\(f = \{\}\)\{[\s\S]*?\n\}/);
assert.ok(src, 'não achei a função filaPorFatos em app.js');
const filaPorFatos = eval('(' + src[0] + ')');

const nivelDe = f => filaPorFatos(f).nivel;

// Cada fato isolado cai no nível certo (2..7).
// v1190 — o nível 1 ("clienteAguardandoVoce") NÃO EXISTE MAIS: era prioridade máxima concedida
// só porque a última fala IMPORTADA era do cliente. O app lê o retrato exportado do WhatsApp,
// não a conversa ao vivo — o corretor já respondeu lá. Ver NOTAS-v1190.md.
assert.equal(nivelDe({ lembreteAtrasado: true }), 2);
assert.equal(nivelDe({ retornoParaHoje: true }), 3);
assert.equal(nivelDe({ negociacaoAguardando: true }), 4);
assert.equal(nivelDe({ compromissoProgramado: true }), 5);
assert.equal(nivelDe({ retomadaPorTempo: true }), 6);
assert.equal(nivelDe({ emJanela: true }), 7);

// O fato inventado não ressuscita por acidente: mandar a propriedade antiga não muda nada.
assert.equal(nivelDe({ clienteAguardandoVoce: true }), 0);
assert.equal(filaPorFatos({ clienteAguardandoVoce: true }).grupo, 'baixa-prioridade');
assert.notEqual(filaPorFatos({ clienteAguardandoVoce: true }).titulo, 'Cliente aguardando');

// Precedência: o fato mais forte sempre vence o mais fraco.
assert.equal(nivelDe({ lembreteAtrasado: true, negociacaoAguardando: true, compromissoProgramado: true }), 2);
assert.equal(nivelDe({ retornoParaHoje: true, negociacaoAguardando: true }), 3);
// v941 — negociacaoAguardando é um sinal FUZZY (regex sobre o texto da análise da IA); fatos
// concretos com data real (compromissoProgramado) agora vencem esse sinal fuzzy, não o
// contrário — era assim que furava a janela de espera (emJanela) fácil demais (bug real
// reportado pelo dono: lead contatado ontem, ainda no prazo normal, aparecendo como
// "Negociação aguardando você"). Ver tests/v941-negociacao-respeita-janela-espera.test.mjs.
assert.equal(nivelDe({ negociacaoAguardando: true, compromissoProgramado: true, retomadaPorTempo: true }), 5);
assert.equal(nivelDe({ compromissoProgramado: true, retomadaPorTempo: true, emJanela: true }), 5);

// Grupos: níveis 2..5 = ação hoje; 6 = retomar com cuidado; 7 = pode aguardar.
for (const n of [2, 3, 4, 5]) {
  const f = { 2:{lembreteAtrasado:true}, 3:{retornoParaHoje:true}, 4:{negociacaoAguardando:true}, 5:{compromissoProgramado:true} }[n];
  assert.equal(filaPorFatos(f).grupo, 'acao-hoje');
}
assert.equal(filaPorFatos({ retomadaPorTempo: true }).grupo, 'retomar-cuidado');
assert.equal(filaPorFatos({ emJanela: true }).grupo, 'pode-aguardar');

// Supressão factual (§6.7 e afins):
// - atendido recentemente sai da fila de ação...
assert.equal(filaPorFatos({ atendidoRecente: true }).grupo, 'tratado-hoje');
assert.equal(filaPorFatos({ atendidoRecente: true }).nivel, 0);
// - ...e CONTINUA fora dela mesmo que o cliente tenha falado por último (v1190: era exatamente
//   aqui que o descanso pós-atendimento era furado — o "caso Maria Clarisse" da v826 partia de
//   uma premissa que o dono derrubou na v1158/v1189).
assert.equal(filaPorFatos({ atendidoRecente: true, clienteAguardandoVoce: true }).grupo, 'tratado-hoje');
assert.equal(nivelDe({ atendidoRecente: true, clienteAguardandoVoce: true }), 0);
// - o que FURA o descanso é fato com data: lembrete vencido, retorno pra hoje.
assert.equal(nivelDe({ atendidoRecente: true, lembreteAtrasado: true }), 2);
assert.equal(nivelDe({ atendidoRecente: true, retornoParaHoje: true }), 3);
// - negociação real (sinal da análise, não "quem falou por último") também fura.
assert.equal(nivelDe({ atendidoRecente: true, negociacaoAguardando: true }), 4);

// Lembrete futuro segura o lead — inclusive quando o cliente falou por último.
assert.equal(filaPorFatos({ lembreteFuturo: true }).grupo, 'pode-aguardar');
assert.equal(filaPorFatos({ lembreteFuturo: true, clienteAguardandoVoce: true }).grupo, 'pode-aguardar');
// Só retorno de hoje / negociação tiram o lead de "lembrete futuro".
assert.equal(nivelDe({ lembreteFuturo: true, retornoParaHoje: true }), 3);

// Cliente pediu tempo segura o lead — e a fala dele por último não muda isso.
assert.equal(filaPorFatos({ clientePediuTempo: true }).titulo, 'Cliente pediu para aguardar');
assert.equal(filaPorFatos({ clientePediuTempo: true, clienteAguardandoVoce: true }).titulo, 'Cliente pediu para aguardar');
assert.equal(filaPorFatos({ clientePediuTempo: true, emJanela: true, retomadaPorTempo: true }).grupo, 'pode-aguardar');

// Trava externa só derruba quando não há pendência sua; com pendência, segue a fila.
assert.equal(filaPorFatos({ travaExterna: true }).grupo, 'boa-sem-urgencia');
assert.equal(nivelDe({ travaExterna: true, pendenciaCorretor: true, retomadaPorTempo: true }), 6);

// Sem nenhum fato: baixa prioridade.
assert.equal(filaPorFatos({}).grupo, 'baixa-prioridade');

// §6.6: os pesos subjetivos antigos foram removidos da fila.
const bloco = app.slice(app.indexOf('function prioridadeAtendimento(l){'), app.indexOf('function scorePrioridadeAtendimento'));
assert.doesNotMatch(bloco, /score \+= 120|score \+= 92|score \+= 55|score -= 34|score -= 300/, 'pesos subjetivos não podem sobrar na fila');

console.log('v826-fila-fatos: ok (nível 1 não existe mais — v1190)');
