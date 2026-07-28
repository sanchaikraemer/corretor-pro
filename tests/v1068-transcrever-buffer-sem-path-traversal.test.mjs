import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { transcreverBuffer } from "../api/_pipeline.js";

// v1068 — auditoria de segurança achou que api/cerebro-config.js (ação "transcrever-audio")
// repassa body.ext direto do corpo da requisição pra transcreverBuffer, sem nenhuma validação.
// Antes desta correção, um valor como "../../../../home/user/.ssh/authorized_keys" fazia o
// path.join escrever (e depois tentar apagar) um arquivo fora de os.tmpdir(), com o conteúdo que
// o próprio chamador mandasse como "áudio" — path traversal / escrita arbitrária (CWE-22),
// disparável por qualquer corretor autenticado (não precisa ser admin). Este teste confirma, com
// o OpenAI real substituído por um mock, que o caminho final de escrita nunca escapa do tmpdir.

const chamadasWriteFileSync = [];
const originalWriteFileSync = fs.writeFileSync;
fs.writeFileSync = (p, ...rest) => { chamadasWriteFileSync.push(p); return originalWriteFileSync(p, ...rest); };

const openaiMock = {
  audio: { transcriptions: { create: async (payload) => {
    // transcreverBuffer apaga o arquivo temporário assim que esta chamada retorna (finally em
    // _pipeline.js) — o mock não lê o stream, então precisa ao menos escutá-lo (senão o Node
    // emite um "error" (ENOENT) sem ouvinte quando o arquivo some, derrubando o teste).
    payload?.file?.on?.("error", () => {});
    payload?.file?.resume?.();
    return { text: "ok", duration: 1 };
  } } }
};

try {
  // 1. Extensão maliciosa tentando escapar de os.tmpdir() com "..".
  await transcreverBuffer(Buffer.from("audio-fake-de-teste"), "../../../../tmp/cp-path-traversal-marker", openaiMock, "org-teste");
  // 2. Extensão maliciosa como caminho absoluto direto (sem "..").
  await transcreverBuffer(Buffer.from("audio-fake-de-teste"), "/etc/cp-path-traversal-marker", openaiMock, "org-teste");
  // 3. Extensão legítima continua funcionando normalmente (não pode virar sempre .ogg à força).
  await transcreverBuffer(Buffer.from("audio-fake-de-teste"), ".m4a", openaiMock, "org-teste");
} finally {
  fs.writeFileSync = originalWriteFileSync;
}

assert.equal(chamadasWriteFileSync.length, 3, "precisa ter escrito exatamente um arquivo temporário por chamada");

const [comPontosPonto, comCaminhoAbsoluto, comExtensaoValida] = chamadasWriteFileSync;

assert.ok(comPontosPonto.startsWith(os.tmpdir()), `caminho com ".." precisa ficar dentro de os.tmpdir(), veio: ${comPontosPonto}`);
assert.ok(!comPontosPonto.includes(".."), 'caminho final não pode conter ".." (escapando do tmpdir)');
assert.ok(comPontosPonto.endsWith(".ogg"), "extensão maliciosa precisa cair no padrão seguro .ogg");

assert.ok(comCaminhoAbsoluto.startsWith(os.tmpdir()), `caminho absoluto malicioso precisa ficar dentro de os.tmpdir(), veio: ${comCaminhoAbsoluto}`);
assert.ok(comCaminhoAbsoluto.endsWith(".ogg"), "extensão maliciosa (caminho absoluto) precisa cair no padrão seguro .ogg");

assert.ok(comExtensaoValida.endsWith(".m4a"), "extensão legítima não pode ser forçada pra .ogg à toa");

console.log("v1068 (transcreverBuffer): extensão maliciosa nunca escapa de os.tmpdir(), extensão legítima continua intacta — ok");
console.log("v1068-transcrever-buffer-sem-path-traversal: ok");
