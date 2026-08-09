import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v944 — correção apontada pelo dono ao revisar um lead: o bônus "cliente esperando você" (+30 na
// ORDEM do "Fazer agora") disparava só porque o cliente era, cronologicamente, quem tinha falado
// por último — mesmo quando essa última fala era só uma despedida ("Claro" / "Obrigado pela
// atenção"). A checagem "a última fala pede resposta?" nasceu aí.
//
// v1158 — O BÔNUS INTEIRO SAIU DA ORDEM DA FILA. Ordem do dono: "retire isso e do código também,
// já te falei ontem que você não tem como saber, pois não é integrado com o WhatsApp". Está certo:
// o app lê um retrato da conversa (o arquivo exportado), não o WhatsApp ao vivo — se ele respondeu
// o cliente depois de exportar, o app continuava achando que a bola estava com ele e empurrava
// esse lead pro topo por palpite.
//
// v1190 — E AGORA A PREMISSA SAIU DE TODO O RESTO. A v1158 tinha deixado a checagem viva "onde
// tem lastro": nas regras de QUEM ENTRA na fila (entraEmRetomada) e na etiqueta do cartão
// (nível 1 / "Cliente aguardando"). A auditoria mostrou que esses dois lugares não tinham lastro
// nenhum — era a MESMA inferência, decidindo prioridade máxima e furando o descanso
// pós-atendimento. Os dois foram removidos, e com eles a peneira ultimaMsgClientePedeResposta:
// sem nenhuma decisão baseada em "quem falou por último", não sobrou o que peneirar.
//
// Este teste virou a trava dessa regra: nem a ORDEM nem a ENTRADA da fila podem consultar quem
// falou por último.

const fnSrc = app.match(/function cpProbabilidadeFechamento\(l\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpProbabilidadeFechamento não encontrada em app.js');
const fn = fnSrc[0];

// ── 1. A ordem da fila não pode palpitar sobre "quem falou por último" ─────────────────────────
assert.doesNotMatch(fn, /clienteEsperaVoce/, 'o bônus não pode voltar pra ordem da fila');
assert.doesNotMatch(fn, /ultimaMsgClientePedeResposta/,
  'a ordem da fila não consulta quem falou por último (v1158 — o app não vê o WhatsApp ao vivo)');
assert.doesNotMatch(fn, /daysSinceLastTouch/,
  'nem a data da última mensagem trocada — era usada só por esse bônus');

const cpProbabilidadeFechamento = eval(`
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const contextoPrioridadeIA = (l) => ({});
  ${fn}
  cpProbabilidadeFechamento;
`);

const base = { daysSinceClientReply: 3, __msgs: 4, clientMessageDays: 2, clientQuestionCount: 1 };

// Dois leads idênticos, mudando SÓ quem falou por último e quando: a nota tem que ser a mesma.
assert.equal(
  cpProbabilidadeFechamento({ ...base, daysSinceLastTouch: 0 }),
  cpProbabilidadeFechamento({ ...base, daysSinceLastTouch: 999 }),
  'quem falou por último não move a fila'
);
assert.equal(
  cpProbabilidadeFechamento({ ...base, __last: { falante: 'contato', m: { text: 'Consegue me mandar a planta?' } } }),
  cpProbabilidadeFechamento({ ...base, __last: { falante: 'contato', m: { text: 'Obrigado pela atenção' } } }),
  'pergunta ou despedida por último: mesma nota — a fila não adivinha isso'
);

// ── 2. v1190: a peneira saiu, e nenhuma regra de ENTRADA pode consultá-la ──────────────────────
assert.doesNotMatch(app, /function ultimaMsgClientePedeResposta\s*\(/,
  'ultimaMsgClientePedeResposta foi removida na v1190 — se voltou, a inferência proibida voltou junto');

for (const [nome, re] of [
  ['entraEmRetomada', /function entraEmRetomada\(l\)\{[\s\S]*?\n\}/],
  ['_prioridadeAtendimentoCalcular', /function _prioridadeAtendimentoCalcular\(l\)\{[\s\S]*?\n\}/],
  ['filaPorFatos', /function filaPorFatos\(f = \{\}\)\{[\s\S]*?\n\}/]
]) {
  const bloco = app.match(re);
  assert.ok(bloco, `${nome} não encontrada`);
  const semComentarios = bloco[0].replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(semComentarios, /ultimaMsgClientePedeResposta|clienteAguardandoVoce/,
    `${nome} não pode decidir nada a partir de quem falou por último (v1190)`);
}

// ── 3. Comportamento, não só texto: lead contatado ontem, cliente perguntou depois → ESPERA ────
const entraSrc = app.match(/function entraEmRetomada\(l\)\{[\s\S]*?\n\}/);
const entraEmRetomada = eval(`
  const emJanelaDeEspera = (l) => !!l.__janela;
  const lembreteVencido = (l) => !!l.__lembreteVencido;
  const lembreteFuturo = (l) => !!l.__lembreteFuturo;
  const limiarRetomada = () => 5;
  ${entraSrc[0]}
  entraEmRetomada;
`);
const perguntouOntem = {
  daysSinceLastInteraction: 1,
  name: 'Maria',
  recentMessages: [{ author: 'Maria', text: 'Consegue me mandar a planta?', iso: new Date().toISOString() }],
  analysis: {}
};
assert.equal(entraEmRetomada(perguntouOntem), false,
  'contato de ontem: a pergunta do cliente no retrato importado não antecipa a retomada (v1190)');
// O que antecipa continua sendo fato com data.
assert.equal(entraEmRetomada({ ...perguntouOntem, __lembreteVencido: true }), true,
  'lembrete vencido continua liberando na hora');
assert.equal(entraEmRetomada({ ...perguntouOntem, analysis: { confirmedAppointments: [{ quando: 'hoje às 15h' }] } }), true,
  'compromisso pra hoje continua liberando na hora');
// Passado o prazo normal, ele volta sozinho — ninguém fica preso.
assert.equal(entraEmRetomada({ ...perguntouOntem, daysSinceLastInteraction: 9 }), true,
  'passado o prazo de descanso, o lead volta pela retomada por tempo');

console.log('v944-despedida-nao-conta-como-cliente-esperando: ok (v1190 — a premissa saiu de toda a fila)');
