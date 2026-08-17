// BATERIA DE CONVERSAS — CAMADA 2: manda cada conversa pra IA DE VERDADE e confere a resposta.
//
// Isto NÃO roda na suíte nem na publicação. Gasta dinheiro (uma rodada completa fica em torno de
// R$ 3 a R$ 5) e só sai do lugar com chave e com comando explícito:
//
//   OPENAI_API_KEY=xxx node evals/executar.mjs
//   node evals/executar.mjs --caso=oferta-ja-ignorada
//   node evals/executar.mjs --salvar=antes
//   node evals/executar.mjs --comparar=antes
//
// O uso que importa é o "antes e depois": salve antes de mexer no prompt, compare depois. É a
// regra do CLAUDE.md ("alteração de prompt entra com antes e depois na mesma conversa real")
// virada em ferramenta.
//
// O que confere sem IA (nome do cliente, quem falou por último, tentativas sem resposta, voz do
// corretor) é a camada 1, em tests/v1283-bateria-conversas-comerciais.test.mjs — aquela roda de
// graça em toda alteração. Aqui a pergunta é outra: a IA ENTENDEU a situação e conduziu direito?

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { guessLeadData, analyzeWithBrain } from "../api/_pipeline.js";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PASTA_CONVERSAS = path.join(RAIZ, "conversas");
const PASTA_RESULTADOS = path.join(RAIZ, "resultados");
const MODELO_JUIZ = process.env.EVALS_MODELO_JUIZ || "gpt-4o-mini";

const args = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith("--"))
  .map(a => { const [k, v = "sim"] = a.replace(/^--/, "").split("="); return [k, v]; }));

function encerrar(msg) { console.error(`\n${msg}\n`); process.exit(1); }

if (!process.env.OPENAI_API_KEY) {
  encerrar([
    "Falta a chave da OpenAI. Esta bateria fala com a IA de verdade e por isso gasta dinheiro.",
    "",
    "  OPENAI_API_KEY=sua-chave node evals/executar.mjs",
    "",
    "Se você só quer a conferência que não gasta nada, rode: npm test"
  ].join("\n"));
}

// ── As conversas ──────────────────────────────────────────────────────────────
let casos = fs.readdirSync(PASTA_CONVERSAS).filter(f => f.endsWith(".json")).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(PASTA_CONVERSAS, f), "utf8")));
if (args.caso) {
  casos = casos.filter(c => c.id === args.caso);
  if (!casos.length) encerrar(`Não achei a conversa "${args.caso}". Disponíveis:\n  ` +
    fs.readdirSync(PASTA_CONVERSAS).filter(f => f.endsWith(".json"))
      .map(f => JSON.parse(fs.readFileSync(path.join(PASTA_CONVERSAS, f), "utf8")).id).join("\n  "));
}

// Cérebro opcional: sem ele a análise sai em modo prévia (que também é um cenário real — é o que
// a conta nova vê). Com --cerebro=caminho.json, roda com as regras comerciais de verdade.
let cerebroConfig = null;
if (args.cerebro) {
  try { cerebroConfig = JSON.parse(fs.readFileSync(args.cerebro, "utf8")); }
  catch (e) { encerrar(`Não consegui ler o Cérebro em "${args.cerebro}": ${e.message}`); }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── O juiz ────────────────────────────────────────────────────────────────────
// Recebe a situação, o que a IA respondeu e a régua escrita em português. Nunca recebe a resposta
// "certa" pronta — ele julga se a régua foi cumprida, item por item, e precisa justificar.
async function julgar(caso, analise) {
  const tresMensagens = [analise?.messages?.a, analise?.messages?.b, analise?.messages?.c]
    .filter(Boolean).map((m, i) => `${i + 1}) ${m}`).join("\n");
  const diagnostico = JSON.stringify(analise?.diagnostico || {}, null, 1).slice(0, 4000);

  const pedido = `Você confere o trabalho de um sistema que analisa conversas de corretor de imóveis.
Julgue APENAS pelo que está escrito abaixo. Não invente contexto e não seja generoso: na dúvida, marque como não cumprido e explique.

=== A CONVERSA ANALISADA ===
${caso.conversa.map(m => `[${m.date} ${m.time || ""}] ${m.author}: ${m.text}`).join("\n")}

=== O QUE O SISTEMA ENTENDEU (diagnóstico) ===
${diagnostico}
Resumo: ${analise?.summary || "(vazio)"}
Próximo passo: ${analise?.nextAction || "(vazio)"}

=== AS TRÊS MENSAGENS QUE O SISTEMA SUGERIU ===
${tresMensagens || "(nenhuma mensagem foi gerada)"}

=== A RÉGUA ===
PRECISA TER PERCEBIDO (olhe o diagnóstico e o resumo):
${(caso.esperado.aIaPrecisaPerceber || []).map((t, i) => `P${i + 1}. ${t}`).join("\n")}

AS MENSAGENS NÃO PODEM (olhe as três mensagens):
${(caso.esperado.asMensagensNaoPodem || []).map((t, i) => `N${i + 1}. ${t}`).join("\n")}

AS MENSAGENS PRECISAM (olhe as três mensagens):
${(caso.esperado.asMensagensPrecisam || []).map((t, i) => `S${i + 1}. ${t}`).join("\n")}

Devolva SÓ este JSON, sem texto em volta:
{"itens":[{"codigo":"P1","cumpriu":true,"porque":"uma frase curta citando o trecho que prova"}]}
Um item para CADA código listado acima. "cumpriu" para N* significa que a proibição foi RESPEITADA.`;

  const r = await openai.chat.completions.create({
    model: MODELO_JUIZ,
    messages: [{ role: "user", content: pedido }],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 1200
  });
  try { return JSON.parse(r.choices?.[0]?.message?.content || "{}")?.itens || []; }
  catch (_) { return []; }
}

// ── Rodada ────────────────────────────────────────────────────────────────────
const resultados = [];
console.log(`\nBateria de conversas — ${casos.length} conversa(s), IA de verdade.`);
console.log(cerebroConfig ? "Rodando COM Cérebro." : "Rodando SEM Cérebro (modo prévia — o que a conta nova vê).");
console.log("");

for (const caso of casos) {
  process.stdout.write(`  ${caso.id} ... `);
  const timeline = caso.conversa.map(m => ({ ...m, type: m.type || "text" }));
  const lead = guessLeadData(timeline, caso.corretorNome, caso.nomeArquivo);
  try {
    const analise = await analyzeWithBrain({ lead, timeline, openai, cerebroConfig });
    const itens = await julgar(caso, analise);
    const ok = itens.filter(i => i.cumpriu).length;
    resultados.push({
      id: caso.id, titulo: caso.titulo, ok, total: itens.length, itens,
      clienteIdentificado: lead.clientName,
      mensagens: [analise?.messages?.a, analise?.messages?.b, analise?.messages?.c].filter(Boolean),
      proximoPasso: analise?.nextAction || ""
    });
    console.log(`${ok}/${itens.length}`);
    for (const i of itens.filter(x => !x.cumpriu)) console.log(`      ✗ ${i.codigo}: ${i.porque}`);
  } catch (e) {
    resultados.push({ id: caso.id, titulo: caso.titulo, erro: e.message, ok: 0, total: 0, itens: [] });
    console.log(`ERRO — ${e.message}`);
  }
}

const somaOk = resultados.reduce((s, r) => s + r.ok, 0);
const somaTotal = resultados.reduce((s, r) => s + r.total, 0);
console.log(`\nTotal: ${somaOk}/${somaTotal} itens da régua cumpridos.\n`);

// ── Comparar com uma rodada anterior ──────────────────────────────────────────
if (args.comparar) {
  const arq = path.join(PASTA_RESULTADOS, `${args.comparar}.json`);
  if (!fs.existsSync(arq)) encerrar(`Não achei a rodada "${args.comparar}" em ${PASTA_RESULTADOS}.`);
  const antes = JSON.parse(fs.readFileSync(arq, "utf8"));
  const porId = Object.fromEntries((antes.resultados || []).map(r => [r.id, r]));
  console.log(`Comparando com "${args.comparar}":\n`);
  let melhorou = 0, piorou = 0;
  for (const agora of resultados) {
    const ant = porId[agora.id];
    if (!ant) { console.log(`  ${agora.id}: conversa nova, sem comparação`); continue; }
    const d = agora.ok - ant.ok;
    if (d > 0) melhorou++; else if (d < 0) piorou++;
    const marca = d > 0 ? "MELHOROU" : d < 0 ? "PIOROU  " : "igual   ";
    console.log(`  ${marca} ${agora.id}: ${ant.ok}/${ant.total} → ${agora.ok}/${agora.total}`);
    for (const i of agora.itens.filter(x => !x.cumpriu)) {
      const antesItem = (ant.itens || []).find(y => y.codigo === i.codigo);
      if (antesItem?.cumpriu) console.log(`      ✗ quebrou agora — ${i.codigo}: ${i.porque}`);
    }
  }
  console.log(`\n  ${melhorou} conversa(s) melhoraram, ${piorou} pioraram.`);
  console.log(piorou > 0
    ? "\n  >>> PIOROU. Não publique esta mudança de prompt sem entender o que quebrou.\n"
    : "\n  >>> Nada piorou.\n");
}

// ── Guardar ───────────────────────────────────────────────────────────────────
if (args.salvar) {
  fs.mkdirSync(PASTA_RESULTADOS, { recursive: true });
  const arq = path.join(PASTA_RESULTADOS, `${args.salvar}.json`);
  fs.writeFileSync(arq, JSON.stringify({
    quando: new Date().toISOString(),
    comCerebro: !!cerebroConfig,
    modeloJuiz: MODELO_JUIZ,
    resultados
  }, null, 2));
  console.log(`Rodada guardada como "${args.salvar}". Depois de mexer no prompt, rode:\n  node evals/executar.mjs --comparar=${args.salvar}\n`);
}

process.exit(resultados.some(r => r.erro) ? 1 : 0);
