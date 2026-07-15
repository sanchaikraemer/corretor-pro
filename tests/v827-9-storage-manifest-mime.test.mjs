import assert from "node:assert/strict";
import JSZip from "jszip";
import { prepararExtracaoPersistente } from "../api/processar-storage.js";

const zip = new JSZip();
zip.file("Conversa do WhatsApp com Cliente.txt", `15/07/2026 10:00 - Cliente: Bom dia
15/07/2026 10:01 - Corretor: Bom dia!
`);
const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

const objects = new Map([["whatsapp/imports/imp-teste-8279/conversa.zip", zipBuffer]]);
const uploadTypes = new Map();
const allowed = new Set(["application/zip", "application/x-zip-compressed", "application/octet-stream"]);
const storage = {
  async download(path) {
    if (!objects.has(path)) return { data: null, error: { message: "Object not found" } };
    return { data: new Blob([objects.get(path)]), error: null };
  },
  async upload(path, payload, options = {}) {
    const type = String(options.contentType || "application/octet-stream");
    if (!allowed.has(type) && !type.startsWith("audio/")) {
      return { data: null, error: { message: `mime type ${type} is not supported` } };
    }
    const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    objects.set(path, buf);
    uploadTypes.set(path, type);
    return { data: { path }, error: null };
  }
};

const result = await prepararExtracaoPersistente({
  storage,
  storagePath: "whatsapp/imports/imp-teste-8279/conversa.zip",
  importId: "imp-teste-8279",
  audioWindowDays: "90"
});

assert.equal(result.manifest.status, "prepared");
assert.equal(result.manifest.prep.messages.length, 2);
assert.ok(objects.has("imports/imp-teste-8279/manifest.json"), "manifesto precisa ser persistido");
assert.equal(uploadTypes.get("imports/imp-teste-8279/manifest.json"), "application/octet-stream");
console.log("v827-9: manifesto interno salvo mesmo com bucket restrito a ZIP/áudio/octet-stream.");
