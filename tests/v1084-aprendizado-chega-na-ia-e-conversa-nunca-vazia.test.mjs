import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain } from "../api/_pipeline.js";

// v1084 — dois defeitos que só apareciam olhando o que REALMENTE é enviado pra IA. Por isso este
// teste não confere o código-fonte: ele roda a análise de verdade contra uma IA de mentira e lê o
// prompt que saiu.

const chamadas = [];
const respostaBase = {
  summary: "Resumo",
  diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento" },
  mensagens: { recomendada: "Bom dia?", maisSuave: "Bom dia?", maisDireta: "Bom dia?" },
  produtoInteresse: "Produto",
  produtosInteresse: ["Produto"],
  etapaSugerida: "Atendimento",
  clientProfile: "Perfil",
  nextAction: "Ação"
};
const openaiMock = {
  chat: { completions: { create: async payload => {
    chamadas.push(payload);
    return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify(respostaBase) } }] };
  } } }
};
const promptDeSistema = () => chamadas.at(-1).messages.find(m => m.role === "system")?.content || "";
const promptDeUsuario = () => chamadas.at(-1).messages.find(m => m.role === "user")?.content || "";

// ── 1. O que o "Aprender da carteira" descobriu precisa CHEGAR na IA ───────────────────────────
// O botão lê as conversas reais do corretor, paga chamadas de IA pra extrair o jeito dele e salva
// em inteligenciaAprendida. Só que a limpeza da configuração descartava esse campo, então ele
// nunca chegava ao prompt: o corretor pagava o aprendizado e a análise saía idêntica à de uma
// conta zerada, enquanto a tela dizia "N casos aprendidos".
{
  const timeline = [{ date: "09/05/2026", time: "18:30", author: "Cliente", text: "Achei caro, vou pensar." }];
  await analyzeWithBrain({
    lead: { clientName: "Cliente" }, timeline, openai: openaiMock,
    cerebroConfig: {
      metodo: "método do corretor",
      inteligenciaAprendida: {
        tons: [{ texto: "fala curta, direta e sem formalidade" }],
        objecoes: [{ objecao: "achei caro", respostaUsada: "mostro o custo por mês, não o total", funcionou: true }],
        tecnicas: [{ texto: "sempre proponho uma visita antes de falar de preço" }]
      }
    }
  });
  const sys = promptDeSistema();
  assert.match(sys, /SEU JEITO/, "o aprendizado do corretor precisa entrar no prompt enviado à IA");
  assert.match(sys, /fala curta, direta e sem formalidade/, "o tom aprendido precisa chegar na IA");
  assert.match(sys, /mostro o custo por mês/, "a objeção que já funcionou precisa chegar na IA");
  assert.match(sys, /as regras do Cérebro Comercial acima continuam prevalecendo/,
    "o aprendizado nunca pode passar por cima das regras que o corretor escreveu no Cérebro");
}

// Sem aprendizado nenhum, o prompt continua exatamente como era (nada de bloco vazio sobrando).
{
  const timeline = [{ date: "09/05/2026", time: "18:30", author: "Cliente", text: "Oi" }];
  await analyzeWithBrain({
    lead: { clientName: "Cliente" }, timeline, openai: openaiMock,
    cerebroConfig: { metodo: "método do corretor" }
  });
  assert.doesNotMatch(promptDeSistema(), /SEU JEITO/, "sem aprendizado, o bloco não pode aparecer vazio");
}

// ── 2. A conversa NUNCA pode chegar vazia na IA ────────────────────────────────────────────────
// Quando a conversa passa do limite de tamanho, o sistema corta e manda só o final. Mas se a
// ÚLTIMA mensagem sozinha já fosse maior que o limite (um áudio longo vira UMA linha transcrita),
// o corte devolvia ZERO mensagens: a IA recebia só o aviso de "parte antiga omitida" e mesmo
// assim inventava diagnóstico e as 3 sugestões a partir do nome e do telefone do lead.
{
  const anterior = process.env.DIRECIONA_MAX_CONTEXT_CHARS;
  process.env.DIRECIONA_MAX_CONTEXT_CHARS = "2000";
  try {
    const audioGigante = "PALAVRA ".repeat(600) + "FIM-DA-CONVERSA-MARCADOR";
    assert.ok(audioGigante.length > 2000, "o teste precisa de uma mensagem maior que o limite");
    const timeline = [
      { date: "01/05/2026", time: "10:00", author: "Cliente", text: "primeira mensagem" },
      { date: "09/05/2026", time: "18:30", author: "Cliente", text: audioGigante }
    ];
    await analyzeWithBrain({ lead: { clientName: "Cliente" }, timeline, openai: openaiMock, cerebroConfig: { metodo: "m" } });

    const user = promptDeUsuario();
    assert.match(user, /FIM-DA-CONVERSA-MARCADOR/,
      "com uma única mensagem gigante, a IA precisa receber pelo menos o final dela — nunca uma conversa vazia");
    const depoisDoAviso = user.split("parte antiga omitida")[1] || "";
    assert.ok(depoisDoAviso.replace(/[\s\]]/g, "").length > 200,
      "o prompt não pode terminar no aviso de corte sem nenhuma mensagem depois");
  } finally {
    if (anterior === undefined) delete process.env.DIRECIONA_MAX_CONTEXT_CHARS;
    else process.env.DIRECIONA_MAX_CONTEXT_CHARS = anterior;
  }
}

// ── 3. Piso comercial: roteiro sim, promessa não ───────────────────────────────────────────────
{
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  for (const promessa of ["congela o preço", "pega desconto", "mais barato e maior o prazo"]) {
    assert.ok(!pipeline.includes(promessa),
      `"${promessa}" é condição comercial cravada no código — precisa vir do Cérebro ou da conversa`);
  }
}

// ── 4. Privacidade e Termos: sem campo por preencher e alcançáveis de dentro do app ────────────
{
  for (const arquivo of ["privacidade.html", "termos.html"]) {
    const html = fs.readFileSync(new URL(`../${arquivo}`, import.meta.url), "utf8");
    assert.ok(!html.includes('class="placeholder">['),
      `${arquivo} não pode ficar no ar com campo por preencher aparecendo pro cliente`);
    // v1164 — a identificação continua obrigatória, mas pelo NOME. O CPF completo estava
    // publicado nas duas páginas desde a v1084 (a auditoria de 07/08/2026 apontou) — documento de
    // pessoa física não precisa ficar exposto pra qualquer visitante da internet; quem tem
    // interesse legítimo pede pelo e-mail de contato.
    assert.match(html, /Sanchai Kraemer/, `${arquivo} precisa identificar o responsável pelo nome`);
    assert.ok(!/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(html),
      `${arquivo} não pode publicar CPF — a identificação completa é fornecida pelo e-mail de contato, não exposta na página`);
    assert.match(html, /sanchaikraemer3@gmail\.com/, `${arquivo} precisa ter o e-mail de contato`);
  }
  const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const menu = index.slice(index.indexOf('<section id="menu"'));
  assert.match(menu, /href="\/privacidade\.html"/, "quem já é cliente precisa achar a Política de Privacidade dentro do app");
  assert.match(menu, /href="\/termos\.html"/, "idem pros Termos de Uso");
}

console.log("v1084-aprendizado-chega-na-ia-e-conversa-nunca-vazia: ok");
