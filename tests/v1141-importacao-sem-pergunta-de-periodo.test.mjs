import fs from "node:fs";
import assert from "node:assert/strict";

// v1141 — A JANELA "Período dos áudios" SAIU DA IMPORTAÇÃO.
//
// Print do dono: a pergunta aparecia com a tela de progresso desenhada atrás (botão do arquivo,
// "Recebendo — validando o arquivo recebido (8%)" e a barra em 8%) — "não pode ter isso atrás
// porque não está rolando nada, simples assim, SEM INVENTAR O QUE NÃO EXISTE". A v1116 tinha
// escondido só o anel da tela cheia; o card de progresso continuava aparecendo por baixo.
//
// E a pergunta em si não se pagava: o período limita apenas a TRANSCRIÇÃO DE ÁUDIO — as mensagens
// escritas entram completas em qualquer opção e a análise lê a conversa inteira do mesmo jeito.
// Numa conversa com pouco áudio, "30 dias" e "todo o período" dão o mesmo tempo e o mesmo
// resultado ("não importa se coloco 30 ou todo período, sempre demora o mesmo tempo").
//
// Este teste substitui o v1116-periodo-audios-pausa-progresso, que guardava o comportamento da
// janela que deixou de existir.

// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8")
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ── 1. A janela não existe mais em nenhuma forma ───────────────────────────────────────────────
assert.doesNotMatch(app, /periodoAudioModal/, "a janela do período não pode voltar a existir");
assert.doesNotMatch(app, /escolherPeriodoAudiosImportacao/, "nenhuma etapa da importação pergunta o período");
assert.doesNotMatch(app, /Período dos áudios<\/div>/, "nenhum título de janela de período no app");

// ── 2. A importação usa o padrão do Cérebro, sem parar pra perguntar ──────────────────────────
assert.match(app, /const audioWindowDays = janelaAudioDaImportacao\(\);/, "a importação resolve o período sozinha");
assert.match(
  app,
  /function janelaAudioDaImportacao\(\)\{[\s\S]*?janelaAudioPadrao\(\)[\s\S]*?state\.ultimaJanelaAudio = final;[\s\S]*?return final;/,
  "o período vem do padrão (Cérebro) e fica guardado pra uma retentativa usar a MESMA janela"
);
{
  // Nada de await na resolução do período: se voltar a ser uma espera, voltou a ser pergunta.
  const posEscolha = app.indexOf("const audioWindowDays = janelaAudioDaImportacao();");
  const posSlim = app.indexOf("await slimZipKeepingTextAndAudio(file");
  const posUpload = app.indexOf("await uploadLargeZipToSupabase(working");
  assert.ok(posEscolha > -1 && posSlim > -1 && posUpload > -1, "sanidade: os três passos existem");
  assert.ok(posEscolha < posSlim && posSlim < posUpload, "período definido antes de preparar e de subir o ZIP");
}

// ── 3. O período segue aplicado e informado — sem campo na tela ───────────────────────────────
// v1196 — o campo "Período padrão dos áudios" saiu também do Cérebro (decisão do dono): virou
// proteção fixa interna. Este bloco guardava o campo; agora guarda a ausência dele — os detalhes
// do comportamento interno estão em v1196-periodo-audios-sem-campo-na-tela.
assert.doesNotMatch(html, /id="cerebroDiasImportacao"/, "o campo do período não pode voltar pra tela do Cérebro");
assert.match(app, /Período dos áudios:<\/b>/, "o resultado da importação continua dizendo qual período foi aplicado");
assert.doesNotMatch(app, /ajustar padrão/, "sem atalho pra um campo que não existe mais na tela");

// ── 4. O ZIP preparado no celular não recompacta áudio ────────────────────────────────────────
// Áudio do WhatsApp já é comprimido: passar DEFLATE de novo gastava segundos de processador do
// aparelho antes de a importação começar, sem economizar espaço.
{
  const fonte = app.match(/async function slimZipKeepingTextAndAudio\(file, onProgress\)\{[\s\S]*?\n\}/)[0];
  assert.match(fonte, /compression: \/\\\.txt\$\/i\.test\(path\) \? "DEFLATE" : "STORE"/, "só o texto é compactado");
  assert.match(fonte, /generateAsync\(\{type:"blob", compression:"STORE"\}\)/, "o pacote final não recompacta o áudio");
}

console.log("v1141-importacao-sem-pergunta-de-periodo: ok");
