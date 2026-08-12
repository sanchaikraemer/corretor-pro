// v1239 — "analise toda conversa, e sugira conduções de atendimento — tudo e sobre isso, TUDO...
// e é o q menos esta sendo aplicado" (dono, 12/08/2026).
//
// Ele estava certo no diagnóstico. O pedido enviado à IA sempre mandou conduzir (o item 4 da
// Inteligência Comercial Base diz "Conduza sempre pra UMA próxima ação concreta") e sempre mandou
// a CONVERSA COMPLETA junto — mas essa ordem era UMA LINHA no meio de dezenas de proibições, e não
// existia nenhum passo em que a IA tivesse que ESCREVER A LEITURA DELA da conversa antes de sair
// produzindo as três mensagens. Resultado: três textos comerciais genéricos, sem nada que mostre
// que alguém entendeu aquele cliente.
//
// Agora a leitura é o primeiro trabalho, ela decide a condução, as três mensagens executam essa
// condução — e ela APARECE NA TELA, pra ele conferir se o sistema entendeu a conversa em vez de
// julgar só pelo texto das sugestões.
import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain } from "../api/_pipeline.js";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const persistencia = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");

// ── 1) O pedido manda LER e CONDUZIR, e isso vem antes de tudo ──────────────────────────────
assert.match(pipeline, /O TRABALHO É ESTE: LER A CONVERSA INTEIRA E DECIDIR COMO CONDUZIR ESTE ATENDIMENTO/,
  "o pedido precisa dizer, como tarefa principal, que é pra ler a conversa e decidir a condução");
assert.match(pipeline, /As três mensagens são só o jeito de executar essa condução/,
  "as mensagens são consequência da condução, não o trabalho em si");

const formato = pipeline.slice(
  pipeline.indexOf("Formato JSON obrigatório:"),
  pipeline.indexOf("CONVERSA COMPLETA:", pipeline.indexOf("Formato JSON obrigatório:")));
const posLeitura = formato.indexOf('"leituraDaConversa"');
const posDiag = formato.indexOf('"diagnostico"');
const posMsgs = formato.indexOf('"mensagens"');
assert.ok(posLeitura > -1, "a leitura da conversa precisa ser um campo do pedido");
assert.ok(posLeitura < posDiag, "a leitura vem ANTES do diagnóstico");
assert.ok(posDiag < posMsgs, "as mensagens continuam sendo o último campo");
for (const campo of ['"oQueOClienteQuer"', '"ondeParou"', '"oQueMudouNoTempo"', '"condicaoDoCliente"', '"comoConduzir"']) {
  assert.ok(formato.includes(campo), `a leitura precisa do campo ${campo}`);
}
assert.match(pipeline, /AS TRÊS MENSAGENS EXECUTAM "comoConduzir"/,
  "as três precisam ser conferidas contra a condução escrita, não contra uma regra solta");

// ── 2) A leitura sobrevive: é guardada no resultado e chega na tela ─────────────────────────
{
  const leitura = {
    oQueOClienteQuer: "Apartamento na planta, 2 vagas, sem pressa",
    ondeParou: "O corretor ofereceu a simulação e o cliente não respondeu",
    oQueMudouNoTempo: "16 dias desde a última tentativa; a colheita já deve ter fechado",
    condicaoDoCliente: "Ver o resultado da colheita antes de decidir",
    comoConduzir: "Reabrir pela colheita, não pela simulação. Descobrir se o projeto segue vivo antes de oferecer material."
  };
  let n = 0;
  const prompts = [];
  const openai = { chat: { completions: { create: async (args) => {
    n++;
    prompts.push(String(args?.messages?.find(m => m.role === "user")?.content || ""));
    return { model: "gpt-teste", choices: [{ message: { content: JSON.stringify({
      summary: "s", leituraDaConversa: leitura, nextAction: "Perguntar como ficou a colheita",
      mensagens: {
        recomendada: "Boa noite! Como ficou a colheita por aí?",
        maisSuave: "Boa noite! Você ia ver a colheita antes de decidir — deu pra fechar?",
        maisDireta: "Boa noite! Se a colheita fechou, retomo de onde paramos."
      }
    }) } }], usage: {} };
  } } } };

  const r = await analyzeWithBrain({
    lead: { clientName: "Cliente" },
    timeline: [{ date: "19/02/2026", time: "17:12", author: "Cliente", text: "tenho que ver da minha colheita, daí eu te procuro" }],
    openai,
    cerebroConfig: { corretorNome: "S", metodo: "M", tom: "T", diferenciais: "", evitar: "", regras: [], objecoes: [] }
  });

  assert.deepEqual(r.leituraDaConversa, leitura, "a leitura precisa voltar inteira no resultado da análise");
  assert.equal(n, 1, "trio limpo não gasta releitura");
}

// ── 3) A condução manda na releitura (não pode consertar o texto e trocar o assunto) ────────
{
  let n = 0;
  const prompts = [];
  const openai = { chat: { completions: { create: async (args) => {
    n++;
    prompts.push(String(args?.messages?.find(m => m.role === "user")?.content || ""));
    return { model: "gpt-teste", choices: [{ message: { content: JSON.stringify(n === 1 ? {
      summary: "s",
      leituraDaConversa: { comoConduzir: "Reabrir pela colheita, não pela simulação", condicaoDoCliente: "Ver a colheita antes de decidir" },
      mensagens: { recomendada: "Fico à disposição.", maisSuave: "Oi!", maisDireta: "Olá! Me diz se faz sentido." }
    } : {
      mensagens: {
        recomendada: "Boa noite! Como ficou a colheita?",
        maisSuave: "Boa noite! Deu pra fechar a colheita?",
        maisDireta: "Boa noite! Se já colheu, retomo de onde paramos."
      }
    }) } }], usage: {} };
  } } } };
  await analyzeWithBrain({
    lead: { clientName: "Cliente" },
    timeline: [{ date: "19/02/2026", time: "17:12", author: "Cliente", text: "vejo a colheita" }],
    openai,
    cerebroConfig: { corretorNome: "S", metodo: "M", tom: "T", diferenciais: "", evitar: "", regras: [], objecoes: [] }
  });
  const pedido = prompts[1] || "";
  assert.match(pedido, /A CONDUÇÃO desta conversa, decidida nesta mesma análise, é: Reabrir pela colheita/,
    "a releitura precisa receber a CONDUÇÃO, não um passo solto");
  assert.match(pedido, /EXECUTAR essa condução/, "as reescritas executam a condução");
}

// ── 4) A tela mostra a leitura — é o que o dono pediu pra poder conferir ────────────────────
assert.match(app, /function cp704ConducaoHtml\(lead\)\{/, "precisa existir o bloco da condução na tela");
const iniCard = app.indexOf("function cp704ConducaoHtml");
const card = app.slice(iniCard, app.indexOf("function cp704DetailRows", iniCard));
assert.match(card, /Como conduzir este atendimento/, "o bloco precisa ter um título que diga o que é");
for (const rotulo of ["O que o cliente quer", "Onde a conversa parou", "O que mudou no tempo", "Condição que o cliente colocou"]) {
  assert.ok(card.includes(rotulo), `o bloco precisa mostrar "${rotulo}"`);
}
assert.match(card, /comoConduzir/, "a condução em si precisa aparecer");
assert.match(card, /if\(!L \|\| typeof L !== 'object'\) return ''/,
  "lead antigo (sem leitura) não pode ganhar um bloco vazio na tela");
assert.match(card, /\/\^nenhuma\$\/i\.test/,
  'condição "Nenhuma" não vira uma linha na tela dizendo "Nenhuma"');
assert.match(app, /\$\{cp704ConducaoHtml\(lead\)\}/, "o bloco precisa ser montado na tela do lead");

// A leitura precisa viajar junto da carteira, senão o bloco pisca (some e volta) ao abrir o lead.
assert.match(persistencia, /"leituraDaConversa"/,
  "leituraDaConversa precisa entrar na análise compacta da lista, senão o bloco só aparece no 2º carregamento");

// ── 5) O CÉREBRO: prova na tela de quanto foi enviado ──────────────────────────────────────
// "leia as regras do cerebro! ou ele nao esta sendo usado. ou vc nao sabe o q fala e esta
// INVENTANDO NOVAMENTE" (dono). Ele não tinha como conferir sozinho, e desta sessão não dá pra
// abrir o Cérebro dele (fica no banco, sem credencial aqui). A resposta certa não é a minha
// palavra: é a análise carregar o tamanho de cada campo que foi junto, e a tela mostrar.
{
  const openai = { chat: { completions: { create: async () => ({
    model: "gpt-teste",
    choices: [{ message: { content: JSON.stringify({ summary: "s", mensagens: {
      recomendada: "Oi! Como ficou a colheita?", maisSuave: "Oi! Deu pra colher?", maisDireta: "Oi! Se colheu, retomo."
    } }) } }], usage: {}
  }) } } };
  const r = await analyzeWithBrain({
    lead: { clientName: "C" },
    timeline: [{ date: "19/02/2026", time: "17:12", author: "Cliente", text: "x" }],
    openai,
    cerebroConfig: { corretorNome: "Sanchai", metodo: "A".repeat(1200), tom: "B".repeat(340),
      diferenciais: "", evitar: "C".repeat(90), regrasTexto: "D".repeat(5400), objecoesTexto: "" }
  });
  assert.deepEqual(r.cerebroEnviado,
    { metodo: 1200, tom: 340, diferenciais: 0, evitar: 90, regras: 5400, objecoes: 0, total: 7030 },
    "a análise precisa registrar quanto de cada campo do Cérebro foi enviado à IA");
  assert.equal(r.cerebroAplicado, true);
}

// Campo vazio conta zero — e zero é resposta também ("está vazio no seu cadastro").
{
  const openai = { chat: { completions: { create: async () => ({
    model: "gpt-teste",
    choices: [{ message: { content: JSON.stringify({ summary: "s", mensagens: {
      recomendada: "Oi! Como ficou a colheita?", maisSuave: "Oi! Deu pra colher?", maisDireta: "Oi! Se colheu, retomo."
    } }) } }], usage: {}
  }) } } };
  const r = await analyzeWithBrain({
    lead: { clientName: "C" },
    timeline: [{ date: "19/02/2026", time: "17:12", author: "Cliente", text: "x" }],
    openai,
    cerebroConfig: { corretorNome: "Sanchai", metodo: "Consultivo", tom: "", diferenciais: "", evitar: "", regras: [], objecoes: [] }
  });
  assert.equal(r.cerebroEnviado.tom, 0, "campo vazio precisa aparecer como zero, não sumir");
  assert.ok(r.cerebroEnviado.total > 0, "com método preenchido, o total não pode ser zero");
}

// A tela mostra isso, e a prova viaja junto da carteira.
assert.match(app, /seu Cérebro enviado: \$\{partes\.join\(", "\)\}/,
  "a linha embaixo das sugestões precisa mostrar quanto do Cérebro foi enviado");
assert.match(app, /rot = \{ metodo:"método", tom:"tom"/,
  "os campos precisam aparecer com nome de gente, não com nome de código");
assert.match(persistencia, /"cerebroEnviado"/,
  "a prova do Cérebro precisa viajar junto da carteira, senão some ao reabrir o lead");

console.log("v1239-analise-da-conversa-e-conducao: ok");
