import assert from "node:assert/strict";
import fs from "node:fs";

// v1178 — "ta louco cara? parou de transcrever os áudios?" (dono, 07/08/2026).
//
// O app tinha TRÊS motivos possíveis pra um áudio não virar texto — teto de áudios do dia (v1119),
// transcrição indisponível e erro na transcrição — e não mostrava NENHUM. O áudio simplesmente não
// aparecia na análise, sem uma linha de explicação em lugar nenhum.
//
// Pior: o servidor sempre devolveu o aviso do teto (transcricaoLimiteAtingido, api/processar-storage.js),
// e o próprio código dizia que era "só metadado pra um aviso futuro". O aviso futuro nunca chegou —
// quem importava via o áudio sumir e concluía que o sistema tinha quebrado.

// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8")
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");

// ── 1. O servidor continua avisando quando o teto do dia corta a transcrição ───────────────────
assert.match(api, /transcricaoLimiteAtingido: limiteTranscricao\.permitido === false/, "o servidor avisa o teto na resposta da transcrição");

// ── 2. O app agora LÊ esse aviso (antes ele era ignorado) ──────────────────────────────────────
assert.match(app, /resposta\.transcricaoLimiteAtingido === true/, "o app lê o aviso de teto vindo do servidor");
assert.match(app, /result\.transcricaoLimiteDoDia = transcricaoLimiteDoDia/, "e leva o aviso pro resultado da importação");
assert.match(app, /result\.audiosSemTranscricao = audiosSemTranscricao/, "junto com quantos áudios ficaram sem virar texto");

// ── 3. Conta os áudios que ficaram sem texto (não confia só na contagem do servidor) ───────────
assert.match(app, /audiosSemTranscricao = audios\.filter\(nome => !transcriptionMap\[normalizarAudio\(nome\)\]\?\.text\)\.length/, "conta quantos áudios pedidos não voltaram com texto");

// ── 4. A tela do resultado explica o motivo, em português ──────────────────────────────────────
const bloco = app.slice(app.indexOf("const semTranscricao = Number(data.audiosSemTranscricao)"), app.indexOf("const inc = data.incrementalMeta"));
assert.ok(bloco, "o bloco do aviso de áudio existe na tela de resultado");
assert.match(bloco, /Teto de áudios do dia atingido/, "explica o teto do dia");
assert.match(bloco, /Transcrição de áudio indisponível agora/, "explica transcrição indisponível");
assert.match(bloco, /não pôde ser transcrito|não puderam ser transcritos/, "explica erro na transcrição");
assert.match(bloco, /primeiroErroAudio/, "e mostra o motivo do primeiro erro quando existe");
assert.match(app, /janelaHtml \+ semMidiaHtml \+ audioSemTextoHtml \+ incrementalHtml/, "o aviso entra no corpo do resultado da importação");

// ── 5. A linha final ("Concluído") — a única que muitas vezes dá tempo de ler — também avisa ───
assert.match(app, /function cpResumoAudioSemTexto\(result\)/, "existe o resumo curto pra linha final");
assert.match(app, /teto de áudios do dia/, "a linha final nomeia o teto do dia");
assert.match(app, /const audioFim = cpResumoAudioSemTexto\(importacaoConcluida\?\.result\)/, "caminho de atualizar o cliente mostra o resumo");
assert.match(app, /const audioFimNovo = cpResumoAudioSemTexto\(importacaoConcluida\?\.result\)/, "caminho de salvar cliente novo mostra o resumo");

// ── 6. Sem áudio faltando, nada de aviso (a tela não inventa problema) ─────────────────────────
assert.match(app, /const n = Number\(result\?\.audiosSemTranscricao\) \|\| 0;\s*\n\s*if\(!n\) return "";/, "sem áudio faltando, o resumo é vazio");

console.log("v1178-audio-sem-texto-diz-o-motivo: ok");
