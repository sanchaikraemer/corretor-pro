import assert from "node:assert/strict";
import JSZip from "jszip";
import { prepararConversaDoZip, montarTimelineComTranscricoes, mesclarTimelineIncremental } from "../api/_pipeline.js";

// v1350 — A TRANSCRIÇÃO DE ÁUDIO CONTINUA DE PÉ. PROVA, NÃO PROMESSA.
//
// "eu nem em um momento disse pra você deixar de fazer a transcrição de áudio" (dono, 21/08/2026).
// Ele nunca disse, e ela nunca foi tirada — mas dizer isso não vale nada sem rodar o caminho
// inteiro. Este teste monta um ZIP de verdade (o mesmo formato que sai do WhatsApp, com o .opus
// dentro), passa pelo preparo real e monta a linha do tempo real. Se alguém encostar no caminho do
// áudio — na leitura de imagem, na de PDF, na de link, na mesclagem da reimportação — isto quebra.
//
// A conversa que o dono trouxe não tinha transcrição por um motivo simples e verificável: ela foi
// enviada SEM os arquivos, então não existia áudio nenhum pra transcrever.

const TXT = [
  "[21/08/2026 14:51] Miguel: Ele teria alguma entrada? Ou ate permuta, carro, moto...",
  "[21/08/2026 14:52] Gordo: PTT-20260821-WA0003.opus (arquivo anexado)",
  "[21/08/2026 14:53] Gordo: ARTE-PROMO.jpg (arquivo anexado)",
  "[21/08/2026 15:01] Miguel: Perfeito, te mando a simulação hoje"
].join("\n");

const zipar = async () => {
  const zip = new JSZip();
  zip.file("conversa.txt", TXT);
  zip.file("PTT-20260821-WA0003.opus", Buffer.from("audio-de-mentira-mas-com-bytes"));
  zip.file("ARTE-PROMO.jpg", Buffer.from("imagem-de-mentira"));
  return prepararConversaDoZip(await zip.generateAsync({ type: "nodebuffer" }),
    { organizationId: "org-teste", includeExtractedFiles: true });
};

// ── 1. O áudio é reconhecido, extraído e entra na fila de transcrição ────────────────────────
const prep = await zipar();
assert.equal(prep.audiosTotalNoZip, 1, "o .opus dentro do ZIP precisa ser encontrado");
assert.deepEqual(prep.audiosParaTranscrever.map(n => n.toLowerCase()), ["ptt-20260821-wa0003.opus"],
  "e precisa entrar na lista do que vai ser transcrito");
assert.ok(Object.keys(prep._extractedFiles || {}).length >= 1,
  "o arquivo precisa ser extraído do ZIP — sem isso não há o que mandar pro transcritor");
assert.equal(prep.exportadoSemMidia, false, "conversa COM os arquivos não pode ser marcada como sem mídia");

// A linha do áudio não pode ser engolida pela limpeza de anexos: é o NOME dela que liga a
// transcrição à mensagem certa (findReferencedAudio). Foi assim que sempre funcionou.
assert.ok(prep.messages.some(m => /PTT-20260821-WA0003\.opus/i.test(m.text || "")),
  "o nome do arquivo de áudio precisa sobreviver na mensagem");

// ── 2. Transcrito, o texto entra na conversa como fala de verdade ────────────────────────────
{
  const timeline = montarTimelineComTranscricoes(
    prep.messages,
    prep.audioFilesRelevantes,
    { "PTT-20260821-WA0003.opus": { status: "transcrito", text: "Consegui juntar a entrada, me manda a proposta" } },
    prep.audioFilesForaDaJanela
  );
  const audio = timeline.find(m => m.type === "audio");
  assert.ok(audio, "a mensagem de áudio precisa existir na linha do tempo");
  assert.equal(audio.text, "[Áudio transcrito] Consegui juntar a entrada, me manda a proposta");
  assert.equal(String(audio.mediaFile).toLowerCase(), "ptt-20260821-wa0003.opus");
  assert.equal(audio.audioStatus, "transcrito");
  assert.equal(audio.time, "14:52", "e no minuto certo da conversa");
}

// ── 3. Sem transcrição, a mensagem diz o motivo — nunca some calada ──────────────────────────
{
  const timeline = montarTimelineComTranscricoes(prep.messages, prep.audioFilesRelevantes, {}, prep.audioFilesForaDaJanela);
  const audio = timeline.find(m => m.type === "audio");
  assert.ok(audio, "áudio sem transcrição continua aparecendo — sumir seria pior");
  assert.match(audio.text, /sem_transcricao/, "com o motivo escrito");
}

// ── 4. A leitura de imagem/PDF/link NÃO pode atropelar o áudio ───────────────────────────────
// É a preocupação do dono: mexer numa leitura e quebrar a outra. Com as duas ligadas ao mesmo
// tempo, cada mensagem tem que virar o SEU tipo.
{
  const timeline = montarTimelineComTranscricoes(
    prep.messages,
    prep.audioFilesRelevantes,
    { "PTT-20260821-WA0003.opus": { status: "transcrito", text: "Fala Miguel, fechado" } },
    prep.audioFilesForaDaJanela,
    { "ARTE-PROMO.jpg": { status: "lido", text: "Tabela com valores de entrada e parcelas." } }
  );
  const audio = timeline.find(m => m.type === "audio");
  const imagem = timeline.find(m => m.source === "visual");
  assert.match(audio.text, /\[Áudio transcrito\] Fala Miguel, fechado/, "o áudio continua sendo áudio");
  assert.match(imagem.text, /\[Imagem lida pela IA\] Tabela com valores/, "e a imagem, imagem");
  assert.equal(timeline.filter(m => m.type === "audio").length, 1, "sem duplicar o áudio");
}

// ── 5. E a mesclagem da reimportação (v1349) não pode comer a transcrição ────────────────────
// A regra nova descarta linha VAZIA quando chega conteúdo no mesmo momento. Transcrição é
// conteúdo: ela nunca pode ser o lado descartado.
{
  const vazia = { date: "21/08/2026", time: "14:52", author: "Gordo", iso: "2026-08-21T17:52:00.000Z",
    text: "[Áudio: ptt-20260821-wa0003.opus — sem_transcricao]" };
  const cheia = { ...vazia, text: "[Áudio transcrito] Consegui juntar a entrada" };
  const junto = mesclarTimelineIncremental([vazia], [cheia]);
  assert.equal(junto.length, 1);
  assert.match(junto[0].text, /Áudio transcrito/, "a transcrição substitui o 'sem transcrição', nunca o contrário");

  const aoContrario = mesclarTimelineIncremental([cheia], [vazia]);
  assert.ok(aoContrario.some(m => /Áudio transcrito/.test(m.text)),
    "e uma reimportação sem os arquivos jamais apaga a transcrição que já existia");
}

console.log("v1350-transcricao-de-audio-continua-de-pe: ok");
