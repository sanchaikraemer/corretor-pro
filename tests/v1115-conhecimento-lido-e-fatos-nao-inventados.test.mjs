import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";
import { conhecimentoCorretorTexto, invalidarConhecimentoCorretorCache } from "../api/_pipeline.js";

// v1115 — caso real (Carmen/Personalité): a cliente perguntou o endereço do empreendimento e as
// 3 sugestões INVENTARAM outra cidade ("Venâncio Aires" — o prédio é em Carazinho), com o
// endereço certo já ensinado pelo corretor em conversas anteriores. Duas causas, dois consertos:
// (1) o bloco "corretor-conhecimento" era GRAVADO a cada análise e NUNCA LIDO (a leitura saiu
//     na v1092 como "sem chamador") — a leitura voltou, filtrada por empresa e com cache;
// (2) a regra anti-invenção do prompt só cobria condição comercial (preço/prazo/pagamento) —
//     agora cobre DADOS DE FATO (endereço, cidade, localização, características): sem fonte,
//     a mensagem se oferece pra confirmar, nunca afirma.

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const leadUpdate = fs.readFileSync(new URL("../api/lead-update.js", import.meta.url), "utf8");

// ── 1. A leitura do conhecimento funciona de verdade (servidor de mentira) ────────────────────
{
  const FATOS = "O Personalité fica em Carazinho, esquina das ruas Ernesto Alves e Alexandre da Motta, a uma quadra da Avenida Pátria.";
  let consultas = 0;
  const server = http.createServer(async (req, res) => {
    for await (const _ of req) { /* drena */ }
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "GET") {
      consultas++;
      const chave = decodeURIComponent(url.searchParams.get("chave") || "");
      if (chave.includes("corretor-conhecimento")) return res.end(JSON.stringify({ valor: { texto: FATOS } }));
      return res.end("null");
    }
    res.end("{}");
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  try {
    process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
    invalidarConhecimentoCorretorCache();
    const texto = await conhecimentoCorretorTexto("org-1");
    assert.equal(texto, FATOS, "o bloco de fatos precisa ser lido do banco, filtrado por empresa");
    const deNovo = await conhecimentoCorretorTexto("org-1");
    assert.equal(deNovo, FATOS);
    assert.equal(consultas, 1, "a segunda leitura em 60s vem do cache (não paga outra ida ao banco)");
    invalidarConhecimentoCorretorCache("org-1");
    await conhecimentoCorretorTexto("org-1");
    assert.equal(consultas, 2, "invalidar o cache força releitura (fato novo entra na próxima análise)");
  } finally { await new Promise(r => server.close(r)); }
}

// ── 2. v1301 — O CONHECIMENTO NÃO ENTRA MAIS NO PEDIDO. ORDEM DIRETA DO DONO. ────────────────
// Isto aqui era o contrário até a v1300: o bloco inteiro de fatos da carteira (endereços,
// empreendimentos, pontos de referência) ia junto em TODA análise. Print de 18/08/2026, 19h36,
// numa conversa de três linhas sobre um apartamento anunciado só com dormitórios, box e preço: as
// três sugestões voltaram dizendo em que empreendimento ele estava e perto de que rua ficava —
// tudo vindo desse bloco e dos casos de outros clientes, nada vindo da conversa.
//
// O preço desta decisão, assumido pelo dono: quando o cliente perguntar o endereço, o aplicativo
// NÃO vai mais responder de cabeça. Ele se oferece pra confirmar — que é o que a regra do projeto
// sempre mandou fazer na falta de informação. Melhor confirmar do que mandar o cliente pro
// endereço errado.
{
  assert.doesNotMatch(pipeline, /const conhecimentoCorretor = await conhecimentoCorretorTexto\(organizationId\);/,
    "o bloco de fatos da carteira não pode voltar pro pedido da análise (v1301)");
  assert.doesNotMatch(pipeline, /FATOS ENSINADOS PELO CORRETOR/,
    "e o bloco não pode reaparecer no prompt de sistema");
  assert.match(pipeline, /invalidarConhecimentoCorretorCache\(organizationId\); \/\/ v1115/,
    "gravar conhecimento novo continua invalidando o cache (o dado segue sendo aprendido e guardado)");
}

// ── 3. A regra anti-invenção cobre dados de fato (endereço, cidade, localização) ──────────────
{
  // v1184: "do empreendimento" virou "do imóvel ou empreendimento" — a regra passou a valer
  // também para quem trabalha carteira de imóveis de terceiros, não só lançamento.
  // v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O parágrafo que nomeava endereço, rua, bairro e CIDADE
  // um a um saiu na reescrita das instruções feita pelo dono. A proibição continua, agora em
  // forma geral: nada de inventar fato, e lacuna sem fonte continua sendo lacuna.
  assert.match(pipeline, /não invente fatos, datas, autoria, materiais, valores, condições, disponibilidade, promessas ou ações/,
    "o piso comercial precisa proibir afirmar endereço/cidade sem fonte");
  assert.match(pipeline, /quando uma fonte não sustentar uma afirmação, mantenha a incerteza em vez de completar a lacuna/,
    "sem fonte, a mensagem se oferece pra confirmar — nunca afirma");
  // v1190 — o extrator do aprendizado foi reescrito (fonte só do corretor, JSON validado,
  // condição comercial volátil barrada). O que ele continua capturando de propósito é endereço /
  // localização — o fato durável que originou este teste (caso Carmen/Personalité).
  assert.match(pipeline, /endereço e localização de empreendimento \(rua, bairro, cidade, pontos de referência\)/,
    "a extração do aprendizado continua capturando endereços explicitamente");
}

// ── 4. Apagar o conhecimento (limpeza) também derruba o cache ─────────────────────────────────
{
  assert.match(leadUpdate, /invalidarConhecimentoCorretorCache\(organizationId\); \/\/ v1115/,
    "a limpeza do Cérebro invalida o cache do conhecimento");
}

console.log("v1115-conhecimento-lido-e-fatos-nao-inventados: ok");
