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
// A checagem da despedida NÃO foi removida: ela continua valendo onde tem lastro — nas regras de
// QUEM ENTRA na fila (emJanelaDeEspera / entraEmRetomada) e na etiqueta "Cliente aguardando" do
// cartão. Este teste agora trava as duas coisas: o bônus fora da ordem, a checagem viva no resto.

const fnSrc = app.match(/function cpProbabilidadeFechamento\(l\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpProbabilidadeFechamento não encontrada em app.js');
const fn = fnSrc[0];

// ── 1. A ordem da fila não pode mais palpitar sobre "quem falou por último" ────────────────────
assert.doesNotMatch(fn, /clienteEsperaVoce/, 'o bônus não pode voltar pra ordem da fila');
assert.doesNotMatch(fn, /ultimaMsgClientePedeResposta/,
  'a ordem da fila não consulta mais quem falou por último (v1158 — o app não vê o WhatsApp ao vivo)');
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
  'quem falou por último não move mais a fila'
);
assert.equal(
  cpProbabilidadeFechamento({ ...base, __last: { falante: 'contato', m: { text: 'Consegue me mandar a planta?' } } }),
  cpProbabilidadeFechamento({ ...base, __last: { falante: 'contato', m: { text: 'Obrigado pela atenção' } } }),
  'pergunta ou despedida por último: mesma nota — a fila não adivinha mais isso'
);

// ── 2. A checagem da despedida continua viva onde tem lastro ───────────────────────────────────
const helperSrc = app.match(/function ultimaMsgClientePedeResposta\(l\)\{[\s\S]*?\n\}/);
assert.ok(helperSrc, 'ultimaMsgClientePedeResposta não pode ser removida — as regras de entrada usam');
const helperFn = helperSrc[0];
assert.match(helperFn, /ui670UltimaMensagemReal/, 'usa a última mensagem real do cliente pra decidir se pede resposta');
assert.match(helperFn, /falante !== "contato"/, 'só avalia a despedida quando quem falou por último foi o contato');

const ultimaPedeResposta = eval(`
  const ui670UltimaMensagemReal = (l) => l.__last || null;
  ${helperFn}
  ultimaMsgClientePedeResposta;
`);
assert.equal(ultimaPedeResposta({ __last: { falante: 'contato', m: { text: 'Obrigado pela atenção' } } }), false,
  'despedida não é pedido de resposta');
assert.equal(ultimaPedeResposta({ __last: { falante: 'contato', m: { text: 'Claro' } } }), false,
  'um "Claro" isolado também não');
assert.equal(ultimaPedeResposta({ __last: { falante: 'contato', m: { text: 'Consegue me mandar a planta?' } } }), true,
  'pergunta de verdade, sim');
assert.equal(ultimaPedeResposta({ __last: { falante: 'contato', m: { text: 'Me manda o valor atualizado' } } }), true,
  'pedido explícito, sim');
assert.equal(ultimaPedeResposta({ __last: null }), true,
  'sem como checar, não trava nada (comportamento anterior)');

// Os três lugares que continuam usando a checagem (regras de entrada e etiqueta do cartão).
for (const [nome, re] of [
  ['entraEmRetomada', /function entraEmRetomada\(l\)\{[\s\S]*?\n\}/],
  ['_prioridadeAtendimentoCalcular', /function _prioridadeAtendimentoCalcular\(l\)\{[\s\S]*?\n\}/]
]) {
  const bloco = app.match(re);
  assert.ok(bloco, `${nome} não encontrada`);
  assert.match(bloco[0], /ultimaMsgClientePedeResposta/,
    `${nome} continua checando se a última fala do cliente pede resposta`);
}

console.log('v944-despedida-nao-conta-como-cliente-esperando: ok (atualizado pela v1158 — o bônus saiu da ordem da fila)');
