import fs from "node:fs";
import assert from "node:assert/strict";

// v1069 — pedido taxativo do dono, revogando a v1057: "Se ele nunca foi atendido, ele deve sim
// aparecer no fazer agora... Ele só vai aparecer em fazer agora, se ele nunca foi atendido ou
// passa daquele prazo que eu defini lá no cérebro." Isso também revoga o gate de
// recomendacaoContato.aguardar adicionado na v1068 ("esquece o que está escrito" — só data de
// atendimento decide, nunca o aviso da IA).
//
// Regra nova, completa: cpFilaFazerAgora só exige (a) não ter sido contatado hoje e (b) não ter
// compromisso já marcado (isso vai pra Agenda) — dentro disso, entra quem NUNCA foi atendido OU
// quem já passou do prazo de descanso configurado (emJanelaDeEspera). Volume de mensagens do
// cliente e o aviso da IA não excluem mais ninguém dessa fila.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const filaSrc = app.match(/function cpFilaFazerAgora\(items\)\{[\s\S]*?\n\}/)[0];
assert.match(filaSrc, /!\(typeof ultimoAtendimentoTs==='function' && ultimoAtendimentoTs\(l\)\)/,
  "cpFilaFazerAgora precisa identificar quem nunca foi atendido");
assert.match(filaSrc, /!\(typeof emJanelaDeEspera==='function' && emJanelaDeEspera\(l\)\)/,
  "cpFilaFazerAgora precisa identificar quem já passou do prazo de descanso");
assert.doesNotMatch(filaSrc, /recomendacaoContato\?\.aguardar/,
  "o aviso da IA (recomendacaoContato.aguardar) não pode mais gate-ar essa fila — só data de atendimento decide");
assert.doesNotMatch(filaSrc, /mensagensDoCliente\(l\) > 0/,
  "quantidade de mensagens do cliente não pode mais excluir ninguém dessa fila");

const fdsSrc = app.match(/function cpFimDeSemana\(\)\{[\s\S]*?\n\}/)[0];
const cpFilaFazerAgora = eval(`
  const leadEhAtivo = () => true;
  const ehContatadoHoje = (l) => !!l.__hoje;
  const cp786TemCompromisso = (l) => !!l.__compromisso;
  const ultimoAtendimentoTs = (l) => l.__atendido ? 1 : 0;
  const emJanelaDeEspera = (l) => !!l.__dentroDaJanela;
  const cpProbabilidadeFechamento = (l) => Number(l.__score || 0);
  const mensagensDoCliente = (l) => Number(l.__score || 0);
  ${fdsSrc}
  ${filaSrc}
  cpFilaFazerAgora;
`);

const hoje = new Date();
const ehFds = hoje.getDay() === 0 || hoje.getDay() === 6;

const pool = [
  // Nunca atendido, poucas ou nenhuma mensagem: ANTES (v1057) ficava fora, AGORA precisa entrar.
  { id: "nunca-atendido-sem-msg", __score: 1 },
  // Já atendido, mas dentro do prazo de descanso configurado: continua de fora (bola equilibrada,
  // ainda não venceu o prazo).
  { id: "atendido-dentro-do-prazo", __score: 5, __atendido: true, __dentroDaJanela: true },
  // Já atendido e passou do prazo de descanso: entra normalmente.
  { id: "atendido-passou-prazo", __score: 3, __atendido: true, __dentroDaJanela: false },
  // Contatado hoje: sempre fora, não importa o resto.
  { id: "contatado-hoje", __score: 9, __hoje: true },
  // Já tem compromisso marcado (vai pra Agenda, não pra Fazer agora).
  { id: "tem-compromisso", __score: 9, __compromisso: true },
  // Nunca atendido, mesmo com a IA recomendando "aguardar" no campo antigo — esse sinal não é
  // nem lido mais por cpFilaFazerAgora (é ignorado de propósito, não simulado aqui).
];

const resultado = cpFilaFazerAgora(pool).map(l => l.id);
if (ehFds) {
  assert.deepEqual(resultado, [], "fim de semana → fila vazia");
} else {
  assert.ok(resultado.includes("nunca-atendido-sem-msg"),
    "lead NUNCA atendido precisa aparecer em Fazer agora, mesmo sem mensagem do cliente");
  assert.ok(resultado.includes("atendido-passou-prazo"),
    "lead já atendido que passou do prazo de descanso precisa voltar a aparecer");
  assert.ok(!resultado.includes("atendido-dentro-do-prazo"),
    "lead já atendido e ainda dentro do prazo de descanso não pode aparecer");
  assert.ok(!resultado.includes("contatado-hoje"), "quem já foi contatado hoje não aparece de novo");
  assert.ok(!resultado.includes("tem-compromisso"), "quem já tem compromisso marcado vai pra Agenda, não pra Fazer agora");
}

console.log("v1069-fazer-agora-nunca-atendido-ou-passou-prazo: ok");
