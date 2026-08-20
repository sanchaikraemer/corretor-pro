import fs from "node:fs";
import assert from "node:assert/strict";

// v1322 — A POLÍTICA DE PRIVACIDADE VOLTOU A DIZER A VERDADE.
//
// A auditoria de 20/08/2026 pegou o texto público prometendo o contrário do que o sistema faz:
//   • "Imagens, vídeos e documentos […] não são analisados" — mas desde a v1306 imagem (JPG/PNG/
//     WEBP) e PDF são lidos pela IA, e desde a v1307 o link enviado pelo corretor é aberto e lido;
//   • "hoje ela não é apagada automaticamente", sobre a impressão embaralhada da conexão — mas a
//     migração 0018 criou a limpeza automática, que api/criar-conta.js dispara (7 dias).
// Promessa de privacidade que não corresponde ao produto é problema de LGPD, não de documentação.

const raiz = new URL("../", import.meta.url);
const ler = (arq) => fs.readFileSync(new URL(arq, raiz), "utf8");
const privacidade = ler("privacidade.html");

// ── 1. A frase antiga não pode voltar ────────────────────────────────────────────────────────
assert.ok(!/Imagens[^<]*documentos[^<]*<b>não são analisados<\/b>/i.test(privacidade),
  'a Política não pode dizer que imagens e documentos "não são analisados": imagem e PDF são lidos desde a v1306');
assert.ok(!/trabalha apenas com o texto e os áudios/i.test(privacidade),
  "e não pode dizer que o sistema trabalha só com texto e áudio");
assert.ok(!/não é\s*\n?\s*apagada automaticamente/i.test(privacidade.replace(/\s+/g, " ")),
  "a Política não pode dizer que a impressão da conexão não é apagada automaticamente: a limpeza existe e roda");

// ── 2. O que o sistema realmente lê precisa estar escrito ────────────────────────────────────
assert.match(privacidade, /imagens?\s*\(JPG/i, "a Política precisa dizer quais imagens são lidas");
assert.match(privacidade, /PDF/, "a Política precisa citar a leitura de PDF");
assert.match(privacidade, /links? que o próprio corretor enviou/i,
  "a Política precisa dizer que o link enviado pelo corretor é aberto e lido");
assert.match(privacidade, /nunca<\/b> é aberto pelo sistema|nunca é aberto pelo sistema/i,
  "e precisa deixar claro que link de cliente/terceiro não é aberto");
assert.match(privacidade, /V[íi]deos não são analisados/i,
  "vídeo continua fora, e isso precisa continuar escrito");

// ── 3. Quem recebe esse material também precisa estar dito ───────────────────────────────────
const trechoOpenAI = privacidade.split("<b>OpenAI</b>")[1] || "";
assert.match(trechoOpenAI.slice(0, 1200), /imagens e os PDFs/i,
  "a seção de compartilhamento precisa dizer que as imagens e PDFs lidos vão pra OpenAI");
assert.match(trechoOpenAI.slice(0, 1200), /texto das páginas dos links/i,
  "e que o texto da página do link também vai");

// ── 4. O prazo real de guarda da impressão da conexão ────────────────────────────────────────
assert.match(privacidade.replace(/\s+/g, " "), /apagada\s*automaticamente até 7 dias/i,
  "a Política precisa informar o prazo real de apagamento automático (7 dias)");

// ── 5. As duas páginas públicas apontam a mesma data ─────────────────────────────────────────
for (const arq of ["privacidade.html", "termos.html"]) {
  assert.match(ler(arq), /Última atualização: 20\/08\/2026 — versão 1322/,
    `${arq} precisa mostrar a data/versão da revisão desta atualização`);
}
assert.match(ler("termos.html"), /lê imagens e PDFs/i,
  "os Termos descrevem o que a ferramenta faz — e agora ela lê imagem, PDF e link");

console.log("v1322-politica-fiel-a-leitura-de-imagem-pdf-e-link: ok");
