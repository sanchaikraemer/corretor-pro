import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  inferLeadName,
  makeConversationKey,
  parseWhatsappTxt
} from "./whatsapp.js";

test("extrai o nome do lead do ZIP exportado", () => {
  assert.equal(
    inferLeadName("Conversa do WhatsApp com Jamil Contalex(3).zip"),
    "Jamil Contalex"
  );
  assert.equal(makeConversationKey("Jamil Contalex"), "jamil-contalex");
});

test("lê mensagens multilinha, ignora mídias e mantém áudio na posição", () => {
  const source = [
    "12/05/2026 10:01 - Sanchai: Bom dia Jamil, como vai?",
    "12/05/2026 10:02 - Sanchai: Primeira linha",
    "segunda linha",
    "12/05/2026 10:03 - Sanchai: ‎IMG-20260611-WA0069.jpg (arquivo anexado)",
    "12/05/2026 10:04 - Jamil Contalex: ‎PTT-20260512-WA0007.opus (arquivo anexado)",
    "12/05/2026 10:05 - Sanchai: Certo"
  ].join("\n");

  const timeline = parseWhatsappTxt(source);
  assert.equal(timeline.length, 4);
  assert.equal(timeline[1].text, "Primeira linha\nsegunda linha");
  assert.equal(timeline[2].type, "audio");
  assert.equal(timeline[2].audioFile, "PTT-20260512-WA0007.opus");
  assert.equal(timeline[3].text, "Certo");
});

test("valida o TXT real do Jamil", () => {
  const samplePath = "/mnt/data/sample_whatsapp/Conversa do WhatsApp com Jamil Contalex.txt";
  if (!fs.existsSync(samplePath)) return;
  const timeline = parseWhatsappTxt(fs.readFileSync(samplePath, "utf8"));
  const audios = timeline.filter(item => item.type === "audio");
  assert.equal(timeline.length, 115);
  assert.equal(audios.length, 2);
});

test("gera impressões digitais estáveis para mensagens repetidas", () => {
  const source = [
    "12/05/2026 10:01 - Sanchai: Ok",
    "12/05/2026 10:01 - Sanchai: Ok"
  ].join("\n");

  const first = parseWhatsappTxt(source);
  const second = parseWhatsappTxt(source);
  assert.equal(first.length, 2);
  assert.notEqual(first[0].fingerprint, first[1].fingerprint);
  assert.deepEqual(first.map(item => item.fingerprint), second.map(item => item.fingerprint));
});
