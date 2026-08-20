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
// v1330 — o motor da bateria (as conversas, o juiz e a rodada de um caso) mora em api/_bateria.js,
// porque agora ele roda TAMBÉM pelo botão do painel administrativo. Aqui ficou só o que é da linha
// de comando: escolher caso, salvar rodada, comparar antes e depois.
import { CASOS, rodarCaso, modeloJuiz } from "./motor.mjs";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PASTA_CONVERSAS = path.join(RAIZ, "conversas");
const PASTA_RESULTADOS = path.join(RAIZ, "resultados");
const MODELO_JUIZ = modeloJuiz();

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
let casos = CASOS;
if (args.caso) {
  casos = CASOS.filter(c => c.id === args.caso);
  if (!casos.length) encerrar(`Não achei a conversa "${args.caso}". Disponíveis:\n  ` +
    CASOS.map(c => c.id).join("\n  "));
}

// Cérebro opcional: sem ele a análise sai em modo prévia (que também é um cenário real — é o que
// a conta nova vê). Com --cerebro=caminho.json, roda com as regras comerciais de verdade.
let cerebroConfig = null;
if (args.cerebro) {
  try { cerebroConfig = JSON.parse(fs.readFileSync(args.cerebro, "utf8")); }
  catch (e) { encerrar(`Não consegui ler o Cérebro em "${args.cerebro}": ${e.message}`); }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Rodada ────────────────────────────────────────────────────────────────────
const resultados = [];
console.log(`\nBateria de conversas — ${casos.length} conversa(s), IA de verdade.`);
console.log(cerebroConfig ? "Rodando COM Cérebro." : "Rodando SEM Cérebro (modo prévia — o que a conta nova vê).");
console.log("");

for (const caso of casos) {
  process.stdout.write(`  ${caso.id} ... `);
  const r = await rodarCaso({ openai, caso, cerebroConfig });
  resultados.push(r);
  console.log(r.erro ? `ERRO — ${r.erro}` : `${r.ok}/${r.total}`);
  for (const f of (r.falhas || [])) console.log(`      ✗ ${f.codigo}: ${f.porque}`);
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
