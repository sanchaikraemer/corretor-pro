import fs from "node:fs";
import assert from "node:assert/strict";

// v1145 — REGRA DO DONO: "cara, se não aparece na tela, não precisa existir, você não acha?
// estamos perdendo tempo e gastando energia à toa... se não é usado (aparecer na tela) por que vai
// existir isso então?"
//
// Ele está certo, e isso custava TEMPO DE ESPERA: o que faz a importação demorar é a IA ESCREVER.
// O JSON pedido tinha 12 campos de diagnóstico e a tela mostra cinco. O pior caso era
// "mensagemQueEuEnviariaHoje": a IA escrevia uma QUARTA mensagem inteira que o código já jogava
// fora em favor da mensagem A.
//
// Este teste tranca as duas metades da regra: o que saiu não volta ao pedido sem estar na tela, e
// o que ficou continua sendo pedido (é o que a tela mostra).

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// O bloco do formato JSON que a IA precisa devolver.
const inicio = pipeline.indexOf("Formato JSON obrigatório:");
assert.ok(inicio > -1, "sanidade: o formato pedido à IA existe");
// v1291 — o dono reescreveu o pedido e o bloco da conversa deixou de ser sempre "CONVERSA
// COMPLETA:" (agora o título muda conforme o que a IA recebeu). O recorte do formato vai até as
// regras das três mensagens, que é o que vem logo depois do JSON.
const formato = pipeline.slice(inicio, pipeline.indexOf("REGRAS PARA AS TRÊS MENSAGENS", inicio));

// ── 1. O que a IA ESCREVE é só o que chega à tela ──────────────────────────────────────────────
const PEDIDOS = [
  ["ultimaPessoaFalar", 'decide o "cliente esperando você" da fila'],
  ["ultimoCompromissoCliente", 'linha "Último compromisso" no cliente'],
  ["pedidoSemResposta", 'linha "Pedido do cliente ainda sem resposta direta"'],
  ["objecaoPrincipal", 'linha "Impedimento principal"'],
  ["pendenciaFinanceira", 'linha "Permuta / entrada com imóvel"']
];
for (const [campo, onde] of PEDIDOS) {
  assert.ok(formato.includes(`"${campo}"`), `${campo} precisa continuar sendo pedido — ${onde}`);
}

const CORTADOS = [
  "mensagemQueEuEnviariaHoje",
  "ultimaInformacaoPrometida",
  "compromissoCorretorNaoCumprido",
  "produtosParalelos",
  "produtoPrincipal",
  "quemDeveAgirAgora",
  "etapaFunil"
];
for (const campo of CORTADOS) {
  assert.ok(!formato.includes(`"${campo}"`),
    `${campo} não pode voltar ao pedido: não aparece em tela nenhuma (regra do dono, v1145)`);
}
// A prova de que não aparecem: o app não lê nenhum deles em lugar nenhum...
for (const campo of CORTADOS.filter(c => c !== "mensagemQueEuEnviariaHoje")) {
  assert.ok(!app.includes(campo), `${campo} continua sem uso em tela — se for exibir, aí sim volta a ser pedido`);
}
// ...com uma única exceção, que é justamente a prova do desperdício: o app cita
// "mensagemQueEuEnviariaHoje" só pra CONFERIR se a IA devolveu alguma coisa (nota técnica de
// diagnóstico), nunca pra exibir esse texto. E o campo gravado carrega a mensagem A. Ou seja: a
// quarta mensagem que a IA escrevia era descartada em 100% dos casos.
{
  const linhasComCampo = app.split("\n").filter(l => l.includes("mensagemQueEuEnviariaHoje"));
  assert.equal(linhasComCampo.length, 1, "o campo só pode ser citado uma vez no app (a conferência técnica)");
  assert.match(linhasComCampo[0], /const diagMsg=cp704Text\(a\?\.diagnostico\?\.mensagemQueEuEnviariaHoje\)/,
    "e essa citação é a conferência de que a IA devolveu algo, não exibição do texto");
}

// ── 2. O objeto gravado mantém a MESMA forma (lead antigo não perde nada) ──────────────────────
// Cada campo cortado continua existindo no que é salvo, preenchido pelas reservas que já existiam.
const gravado = pipeline.slice(pipeline.indexOf("diagnostico: {", inicio), pipeline.indexOf("oQueFaltaDescobrir", inicio));
assert.match(gravado, /produtoPrincipalInteresse: produtoAtual/, "produto continua gravado, vindo de produtoInteresse");
assert.match(gravado, /etapaFunil: clean\(d\.etapaFunil \|\| raw\.etapaSugerida/, "etapa continua gravada, vindo de etapaSugerida");
assert.match(gravado, /proximoPasso: clean\(d\.proximoPasso \|\| d\.quemDeveAgirAgora \|\| raw\.nextAction/, "próximo passo continua gravado, vindo de nextAction");
assert.match(gravado, /mensagemQueEuEnviariaHoje: clean\(msgA \|\| d\.mensagemQueEuEnviariaHoje\)/,
  "o campo continua gravado com a mensagem A — que é o que o código já usava, mesmo quando a IA escrevia outra");

// ── 3. As três mensagens e o resto do que a tela usa continuam sendo pedidos ───────────────────
for (const campo of ["summary", "mensagens", "recomendada", "maisSuave", "maisDireta", "recomendacaoContato", "produtoInteresse", "produtosInteresse", "etapaSugerida", "clientProfile", "nextAction"]) {
  assert.ok(formato.includes(`"${campo}"`), `${campo} é usado na tela e precisa continuar sendo pedido`);
}

console.log("v1145-ia-so-escreve-o-que-aparece: ok");
