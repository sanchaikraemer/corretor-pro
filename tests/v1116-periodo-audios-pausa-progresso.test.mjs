import fs from "node:fs";
import assert from "node:assert/strict";

// v1116 — caso real (print do dono): a janela "Período dos áudios" abria com o anel de
// progresso subindo atrás (~29%), como se a importação seguisse sem a escolha. O anel é uma
// animação por tempo (se arrasta até o teto da etapa) — nada rodava de verdade, mas a tela
// dizia o contrário. Enquanto a janela espera a decisão, a tela cheia sai de cena (mesmo
// mecanismo `pausar` da decisão salvar/atualizar) e volta no próximo passo do fluxo.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ── 1. A janela do período PAUSA a tela cheia antes de aparecer ───────────────────────────────
{
  const fonte = app.match(/function escolherPeriodoAudiosImportacao\(\)\{[\s\S]*?\n\}/)[0];
  const posPausa = fonte.indexOf("pausar: true");
  const posAppend = fonte.indexOf("document.body.appendChild(overlay)");
  assert.ok(posPausa > -1, "a janela precisa pausar a tela cheia (cpImportOverlaySincronizar com pausar)");
  assert.ok(posAppend > posPausa, "a pausa vem ANTES de mostrar a janela — nunca sobra anel se mexendo atrás");
}

// ── 2. O mecanismo de pausa esconde a tela cheia de verdade ───────────────────────────────────
{
  const sinc = app.match(/function cpImportOverlaySincronizar\(idx, sub, opts\)\{[\s\S]*?\n\}/)[0];
  assert.match(sinc, /opts && opts\.pausar.*cpImportOverlayVisivel\(false\)/,
    "pausar precisa continuar escondendo a tela cheia (é o contrato que a janela usa)");
}

// ── 3. O fluxo continua esperando a escolha ANTES de qualquer trabalho pesado ─────────────────
{
  const posEscolha = app.indexOf("await escolherPeriodoAudiosImportacao()");
  const posSlim = app.indexOf("await slimZipKeepingTextAndAudio(file"); // a CHAMADA, não a definição
  const posUpload = app.indexOf("await uploadLargeZipToSupabase(working");
  assert.ok(posEscolha > -1 && posSlim > -1 && posUpload > -1, "sanidade: os três passos existem");
  assert.ok(posEscolha < posSlim && posSlim < posUpload,
    "a escolha do período vem antes de preparar e de subir o ZIP — o trabalho espera a decisão");
}

console.log("v1116-periodo-audios-pausa-progresso: ok");
