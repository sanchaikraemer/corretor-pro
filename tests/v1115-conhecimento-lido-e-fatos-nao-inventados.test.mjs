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

// ── 2. O conhecimento entra de fato no prompt da análise ──────────────────────────────────────
{
  assert.match(pipeline, /const conhecimentoCorretor = await conhecimentoCorretorTexto\(organizationId\);/,
    "a análise precisa CARREGAR o conhecimento (era gravado e nunca lido)");
  assert.match(pipeline, /FATOS ENSINADOS PELO CORRETOR/,
    "o bloco de fatos precisa aparecer no prompt de sistema");
  assert.match(pipeline, /invalidarConhecimentoCorretorCache\(organizationId\); \/\/ v1115/,
    "gravar conhecimento novo invalida o cache (a próxima análise já enxerga)");
}

// ── 3. A regra anti-invenção cobre dados de fato (endereço, cidade, localização) ──────────────
{
  assert.match(pipeline, /DADOS DE FATO do empreendimento — endereço, rua, bairro, CIDADE/,
    "o piso comercial precisa proibir afirmar endereço/cidade sem fonte");
  assert.match(pipeline, /PROIBIDO afirmar uma localização, cidade ou característica que não conste nas fontes/,
    "sem fonte, a mensagem se oferece pra confirmar — nunca afirma");
  assert.match(pipeline, /ENDEREÇOS e localização de empreendimentos \(rua, bairro, cidade, pontos de referência\)/,
    "a extração do aprendizado agora captura endereços explicitamente");
}

// ── 4. Apagar o conhecimento (limpeza) também derruba o cache ─────────────────────────────────
{
  assert.match(leadUpdate, /invalidarConhecimentoCorretorCache\(organizationId\); \/\/ v1115/,
    "a limpeza do Cérebro invalida o cache do conhecimento");
}

console.log("v1115-conhecimento-lido-e-fatos-nao-inventados: ok");
