import fs from "node:fs";
import assert from "node:assert/strict";

// v1159 — o dono revisou a régua do "Fazer agora" linha por linha e cortou dois fatores:
//
//  1. "+1 por mensagem dele (até 30)" — "cara, isso é a mesma coisa que +6 por pergunta, ou não?".
//     Não era a mesma coisa, mas se sobrepunha: toda pergunta contava duas vezes. E volume de
//     mensagem não diz se o cliente compra — quem escreve muito pode estar só curioso.
//
//  2. "−2 por cada dia sem você atender" — "isso é ridículo... se o cliente não me responde vai
//     baixando por quê? Tem que respeitar o prazo, o cara tem outras coisas pra fazer também;
//     pensa como humano, negociador, e não como um robô chato". Além do argumento dele, dois
//     defeitos concretos: desde a régua de 90 dias (v1139) o cliente frio já pontua perto de zero
//     sozinho (a penalidade cobrava duas vezes), e o cliente NOVO — que nunca foi atendido — caía
//     no teto (−180), começando no fim da fila.
//
// (Este arquivo substitui tests/v1056-tempo-parado-pesa-contra-posicao-na-fila.test.mjs, que
// travava a penalidade. Ela veio de um pedido do dono na v1056 e foi revogada por ele aqui.)

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const fn = app.match(/function cpProbabilidadeFechamento\(l\)\{[\s\S]*?\n\}/)[0];

// ── 1. Os dois fatores saíram do código, não só da conta ───────────────────────────────────────
assert.doesNotMatch(fn, /mensagensDoCliente(Recente)?\(/, "volume de mensagens não entra mais na nota");
assert.doesNotMatch(fn, /engajamento/, "nem sobra a variável do volume");
assert.doesNotMatch(fn, /diasFrio/, "a penalidade por tempo parado saiu");
assert.doesNotMatch(fn, /ultimoAtendimentoTs|diasCalendarioBR/, "e nada do que existia só pra calculá-la");
assert.match(fn, /return recorrencia\*8 \+ perguntas\*6 \+ sinalNegociacao\*35;/,
  "a nota é a soma de três fatores, todos verificáveis na conversa importada");

const montar = (ctx) => eval(`
  const contextoPrioridadeIA = (l) => (${ctx});
  ${fn}
  cpProbabilidadeFechamento;
`);
const nota = montar("({ propostaAtiva: !!l.__proposta, retornoProposta: !!l.__retorno })");

// ── 2. O relógio não mexe mais na fila ────────────────────────────────────────────────────────
const conversa = { clientMessageDays90d: 4, clientQuestionCount90d: 3, daysSinceClientReply: 10 };
const atendidoHa = (dias) => ({ analysis: { aprendizado: { eventos: [
  { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" },
    quando: new Date(Date.now() - dias * 86400000).toISOString() }
] } } });

assert.equal(nota({ ...conversa, ...atendidoHa(2) }), nota({ ...conversa, ...atendidoHa(90) }),
  "mesma conversa: atendido há 2 dias ou há 90 dias dá a MESMA nota (o tempo parado não derruba mais)");
assert.equal(nota({ ...conversa }), nota({ ...conversa, ...atendidoHa(2) }),
  "cliente NOVO (nunca atendido) não começa mais no fim da fila — antes levava −180");
assert.equal(nota({ ...conversa, __msgs: 218 }), nota({ ...conversa, __msgs: 1 }),
  "218 mensagens ou 1 mensagem: mesma nota — volume não conta mais");

// ── 3. O que sobrou continua ordenando de verdade ──────────────────────────────────────────────
assert.ok(nota({ ...conversa, clientMessageDays90d: 10 }) > nota({ ...conversa, clientMessageDays90d: 2 }),
  "cliente que voltou a escrever em mais dias sobe");
assert.ok(nota({ ...conversa, clientQuestionCount90d: 9 }) > nota({ ...conversa, clientQuestionCount90d: 1 }),
  "mais perguntas do cliente sobem");
assert.ok(nota({ ...conversa, __proposta: true, __retorno: true }) > nota({ ...conversa }),
  "negociação avançada (valor/condição + proposta em aberto) pesa");
// O caso histórico do "Henrique" (218 mensagens em 2 dias, sem pergunta, sem negociação) continua
// perdendo de um lead com pouca conversa mas qualificado — agora porque volume nem entra.
const explosaoDeMensagens = { clientMessageDays90d: 1, clientQuestionCount90d: 0, __msgs: 218, daysSinceClientReply: 2 };
const qualificado = { clientMessageDays90d: 6, clientQuestionCount90d: 4, __msgs: 12, daysSinceClientReply: 5, __proposta: true, __retorno: true };
assert.ok(nota(qualificado) > nota(explosaoDeMensagens), "qualificado vence volume bruto");

// Teto dos dois fatores de conversa: 20 dias e 20 perguntas (não cresce pra sempre).
assert.equal(nota({ ...conversa, clientMessageDays90d: 20 }), nota({ ...conversa, clientMessageDays90d: 300 }),
  "recorrência tem teto de 20 dias");
assert.equal(nota({ ...conversa, clientQuestionCount90d: 20 }), nota({ ...conversa, clientQuestionCount90d: 300 }),
  "perguntas têm teto de 20");

// ── 4. Quem esfriou não fica esquecido: o resgate diário é o contrapeso ────────────────────────
// Tirar a penalidade não pode significar "cliente parado nunca mais aparece". As vagas de resgate
// do dia continuam sendo escolhidas por quem está há mais tempo SEM ATENDIMENTO.
const resg = app.match(/function cpAplicarResgatesNaFila\(fila, vagas, resgates\)\{[\s\S]*?\n\}/)[0];
assert.match(resg, /cpUltimoContatoCorretorTs\(l\)/, "o resgate escolhe por tempo sem atendimento");
assert.match(resg, /\(a\.t - b\.t\) \|\| \(a\.i - b\.i\)/, "quem nunca foi contatado primeiro, depois o mais antigo");
assert.match(app, /function cpFilaFazerAgoraComResgates\(items\)\{/, "e as telas usam a fila com resgate");

console.log("v1159-fila-sem-volume-e-sem-penalidade-de-tempo: ok");
