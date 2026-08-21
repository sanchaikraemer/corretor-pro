import fs from "node:fs";
import assert from "node:assert/strict";
import { montarPlanoVisuais, linksDoCorretorNaConversa, maxVisuaisPorImportacao } from "../api/_pipeline.js";

// v1333 — O MATERIAL QUE FICOU PRA TRÁS PASSA A SER LIDO NA IMPORTAÇÃO SEGUINTE.
//
// Print do dono em 20/08/2026: "a IA não leu 11 fotos, 2 PDFs e 2 áudios desta conversa" — numa
// conversa exportada COM mídia (ele sempre exporta assim; a frase da tela que mandava reexportar
// era mentira, corrigida na v1332). O que acontecia de verdade: o plano pegava só os 6 arquivos
// mais recentes, e a cada reimportação pegava OS MESMOS 6. O resto nunca era lido — inclusive a
// proposta em PDF que a própria análise citava.

const mensagensCom = (n) => Array.from({ length: n }, (_, i) => ({
  id: i + 1, text: `IMG-${i + 1}.jpg (arquivo anexado)`, anexos: [`IMG-${i + 1}.jpg`]
}));
const arquivos = (n) => Array.from({ length: n }, (_, i) => `IMG-${i + 1}.jpg`);

// ── 1. A fila anda: cada importação lê o que faltou, não o que já leu ────────────────────────
{
  const msgs = mensagensCom(13);
  const todos = arquivos(13);

  const primeira = montarPlanoVisuais(msgs, todos, 10, []);
  assert.equal(primeira.paraLer.length, 10, "a primeira importação lê o teto");
  assert.ok(primeira.paraLer.includes("IMG-13.jpg"), "e começa pelos mais recentes, que é onde está o material que vale");

  const segunda = montarPlanoVisuais(msgs, todos, 10, primeira.paraLer);
  assert.deepEqual(segunda.paraLer, ["IMG-1.jpg", "IMG-2.jpg", "IMG-3.jpg"],
    "a segunda pega exatamente o que ficou de fora — antes ela repetia os mesmos 10");
  for (const jaLido of primeira.paraLer) {
    assert.ok(!segunda.paraLer.includes(jaLido), "nada do que já foi lido volta a custar leitura");
  }

  const terceira = montarPlanoVisuais(msgs, todos, 10, [...primeira.paraLer, ...segunda.paraLer]);
  assert.deepEqual(terceira.paraLer, [], "com a fila vazia, a importação não gasta IA nenhuma com material");

  // A lista de CITADOS continua inteira — é ela que a tela usa pra dizer quanto falta.
  assert.equal(primeira.citados.length, 13);
  assert.equal(terceira.citados.length, 13);
}

// ── 2. O teto por importação subiu de 6 para 10 ──────────────────────────────────────────────
{
  assert.equal(maxVisuaisPorImportacao(), 10, "com a fila andando, o teto é o passo dela — 6 era passo curto demais");
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  assert.match(pipeline, /DIRECIONA_MAX_VISUAIS_IMPORT/, "continua ajustável sem publicar código");
  assert.match(pipeline, /verificarLimiteLeituraVisual/, "e o teto DIÁRIO por conta continua sendo quem segura o custo");
}

// ── 3. Link do corretor segue a mesma regra ──────────────────────────────────────────────────
{
  const timeline = [
    { author: "Construtora Senger", text: "material antigo https://exemplo.com.br/a" },
    { author: "Construtora Senger", text: "outro https://exemplo.com.br/b" },
    { author: "Construtora Senger", text: "o mais novo https://exemplo.com.br/c" }
  ];
  const lead = { clientName: "Cliente" };
  const primeira = linksDoCorretorNaConversa(timeline, "Construtora Senger", lead, 2, []);
  assert.deepEqual(primeira, ["https://exemplo.com.br/c", "https://exemplo.com.br/b"], "os dois mais recentes");
  const segunda = linksDoCorretorNaConversa(timeline, "Construtora Senger", lead, 2, primeira);
  assert.deepEqual(segunda, ["https://exemplo.com.br/a"], "a próxima importação pega o que faltou");
  const terceira = linksDoCorretorNaConversa(timeline, "Construtora Senger", lead, 2, [...primeira, ...segunda]);
  assert.deepEqual(terceira, [], "e para quando não há mais nada pendente");
}

// ── 4. A importação passa o que já foi lido pra frente ───────────────────────────────────────
{
  const rota = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");
  assert.match(rota, /visuaisJaLidos: cacheVisualDoLead/, "a rota entrega ao plano o que este cliente já teve lido");
  assert.match(rota, /linksJaLidos: cacheLinksDoLead/, "idem para os links");
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  assert.match(pipeline, /Object\.keys\(options\.visuaisJaLidos \|\| \{\}\)/, "e o plano usa essa lista pra pular o que já leu");
  assert.match(pipeline, /Object\.keys\(options\.linksJaLidos \|\| \{\}\)/);
}

console.log("v1333-material-pendente-e-lido-na-proxima: ok");
