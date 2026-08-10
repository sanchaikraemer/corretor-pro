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
// v1190 tirou a premissa do motor de prioridade (nível 1 / "Cliente aguardando"), que AFIRMAVA
// pendência na tela e furava o descanso de quem já tinha sido atendido — isso não volta.
//
// v1192 — o dono mandou DEVOLVER o outro uso, o de entraEmRetomada, e ele tem razão: ali não há
// descanso pra furar (a linha de emJanelaDeEspera logo acima só devolve false quando NÃO existe
// atendimento marcado nenhum) e nada é afirmado na tela — é só "vale um toque hoje?". Segurar
// por 5 dias um lead novo que fez uma pergunta é perder venda.
//
// Este teste trava a divisão: a ORDEM da fila nunca olha quem falou por último; a ENTRADA pode,
// e só com pergunta de verdade — despedida não conta, que é o achado original da v944.

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

// ── 2. A peneira existe, e SÓ entraEmRetomada pode usá-la ─────────────────────────────────────
const helperSrc = app.match(/function ultimaMsgClientePedeResposta\(l\)\{[\s\S]*?\n\}/);
assert.ok(helperSrc, 'ultimaMsgClientePedeResposta é usada por entraEmRetomada desde a v1192');
const ultimaPedeResposta = eval(`
  const ui670UltimaMensagemReal = (l) => l.__last || null;
  ${helperSrc[0]}
  ultimaMsgClientePedeResposta;
`);
// O achado original da v944: despedida não é pedido de resposta.
assert.equal(ultimaPedeResposta({ __last: { falante: 'contato', m: { text: 'Obrigado pela atenção' } } }), false);
assert.equal(ultimaPedeResposta({ __last: { falante: 'contato', m: { text: 'Claro' } } }), false);
assert.equal(ultimaPedeResposta({ __last: { falante: 'contato', m: { text: 'Consegue me mandar a planta?' } } }), true);
assert.equal(ultimaPedeResposta({ __last: { falante: 'contato', m: { text: 'Me manda o valor atualizado' } } }), true);
assert.equal(ultimaPedeResposta({ __last: null }), true, 'sem como checar, não trava nada');

for (const [nome, re] of [
  ['_prioridadeAtendimentoCalcular', /function _prioridadeAtendimentoCalcular\(l\)\{[\s\S]*?\n\}/],
  ['filaPorFatos', /function filaPorFatos\(f = \{\}\)\{[\s\S]*?\n\}/]
]) {
  const bloco = app.match(re);
  assert.ok(bloco, `${nome} não encontrada`);
  const semComentarios = bloco[0].replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(semComentarios, /ultimaMsgClientePedeResposta|clienteAguardandoVoce/,
    `${nome} não pode decidir prioridade a partir de quem falou por último (v1190)`);
}

// ── 3. Comportamento, não só texto: lead contatado ontem, cliente perguntou depois → ESPERA ────
const entraSrc = app.match(/function entraEmRetomada\(l\)\{[\s\S]*?\n\}/);
const entraEmRetomada = eval(`
  const ui670UltimaMensagemReal = (l) => {
    const msgs = l.recentMessages || [];
    const m = msgs[msgs.length - 1];
    return m ? { falante: 'contato', m } : null;
  };
  ${helperSrc[0]}
  const ehMsgDoCliente = (m, pn) => String(m.author || '').toLowerCase().includes(pn);
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
assert.equal(entraEmRetomada(perguntouOntem), true,
  'lead sem atendimento marcado, cliente perguntou: vale um toque hoje (v1192)');
const sodespediu = { ...perguntouOntem, recentMessages: [{ author: 'Maria', text: 'Obrigada pela atenção', iso: new Date().toISOString() }] };
assert.equal(entraEmRetomada(sodespediu), false,
  'despedida não antecipa nada — o achado original da v944 continua valendo');
// O que antecipa continua sendo fato com data.
assert.equal(entraEmRetomada({ ...perguntouOntem, __lembreteVencido: true }), true,
  'lembrete vencido continua liberando na hora');
assert.equal(entraEmRetomada({ ...perguntouOntem, analysis: { confirmedAppointments: [{ quando: 'hoje às 15h' }] } }), true,
  'compromisso pra hoje continua liberando na hora');
// Passado o prazo normal, ele volta sozinho — ninguém fica preso.
assert.equal(entraEmRetomada({ ...perguntouOntem, daysSinceLastInteraction: 9 }), true,
  'passado o prazo de descanso, o lead volta pela retomada por tempo');

console.log('v944-despedida-nao-conta-como-cliente-esperando: ok (v1192 — ordem nunca, entrada só com pergunta)');
