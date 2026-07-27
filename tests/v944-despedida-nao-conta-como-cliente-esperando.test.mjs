import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v944 — correção apontada pelo dono ao revisar o lead "Fábio Luís Vargas": o bônus
// clienteEsperaVoce (+30, "a bola está com o cliente") disparava só porque o cliente era,
// cronologicamente, quem tinha falado por último — mesmo quando essa última fala era só uma
// despedida/agradecimento ("Claro" / "Obrigado pela atenção"), sem pergunta nem pedido. Nas
// palavras do dono: "ele falou por último só se despedindo, não era uma pergunta, ou seja, isso
// não pode ser ponderado". O bônus agora só conta quando a última mensagem real do cliente pede
// resposta de fato (pergunta ou pedido — mesma checagem que ui670ModeloComercial já usa em
// "ultimaPedeResposta").
//
// v1017 — essa mesma checagem foi extraída pra ultimaMsgClientePedeResposta (agora compartilhada
// com emJanelaDeEspera/entraEmRetomada, que tinham o MESMO bug: um "Ok" do cliente encerrava a
// janela de espera antes da hora). cpProbabilidadeFechamento passou a CHAMAR essa função, em vez
// de repetir a lógica — os testes abaixo extraem as duas funções.

const fnSrc = app.match(/function cpProbabilidadeFechamento\(l\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpProbabilidadeFechamento não encontrada em app.js');
const fn = fnSrc[0];
assert.match(fn, /ultimaMsgClientePedeResposta\(l\)/, 'usa a checagem compartilhada de "última mensagem pede resposta" pro bônus de "cliente esperando"');

const helperSrc = app.match(/function ultimaMsgClientePedeResposta\(l\)\{[\s\S]*?\n\}/);
assert.ok(helperSrc, 'ultimaMsgClientePedeResposta não encontrada em app.js');
const helperFn = helperSrc[0];
assert.match(helperFn, /ui670UltimaMensagemReal/, 'usa a última mensagem real do cliente pra decidir se pede resposta');
assert.match(helperFn, /falante !== "contato"/, 'só avalia a despedida quando quem falou por último foi o contato');

const cpProbabilidadeFechamento = eval(`
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const contextoPrioridadeIA = (l) => ({});
  const ui670UltimaMensagemReal = (l) => l.__last || {m:null, falante:'desconhecido'};
  ${helperFn}
  ${fn}
  cpProbabilidadeFechamento;
`);

const base = { daysSinceClientReply: 3, daysSinceLastTouch: 5 };

const comDespedida = { ...base, __last: { falante: 'contato', m: { text: 'Obrigado pela atenção' } } };
const comAgradecimentoCurto = { ...base, __last: { falante: 'contato', m: { text: 'Claro' } } };
const comPergunta = { ...base, __last: { falante: 'contato', m: { text: 'Consegue me mandar a planta do apartamento?' } } };
const comPedido = { ...base, __last: { falante: 'contato', m: { text: 'Me manda o valor atualizado' } } };
const semInfoDeUltimaMsg = { ...base };

assert.equal(cpProbabilidadeFechamento(comDespedida), cpProbabilidadeFechamento({ ...base, daysSinceClientReply: NaN }),
  'despedida pura não pode dar o bônus de "cliente esperando" (mesmo score de quem não tem esse sinal)');
assert.equal(cpProbabilidadeFechamento(comAgradecimentoCurto), cpProbabilidadeFechamento(comDespedida),
  'um "Claro" isolado também é despedida, não pergunta — não pode pesar');
assert.equal(cpProbabilidadeFechamento(comPergunta) - cpProbabilidadeFechamento(comDespedida), 30,
  'uma pergunta real do cliente por último SIM soma o bônus de +30');
assert.equal(cpProbabilidadeFechamento(comPedido) - cpProbabilidadeFechamento(comDespedida), 30,
  'um pedido explícito do cliente por último também soma o bônus');
assert.equal(cpProbabilidadeFechamento(semInfoDeUltimaMsg) - cpProbabilidadeFechamento(comDespedida), 30,
  'sem recentMessages pra checar (ui670UltimaMensagemReal indisponível/sem dado), mantém o comportamento anterior — não bloqueia o bônus por padrão');

console.log('v944-despedida-nao-conta-como-cliente-esperando: ok');
