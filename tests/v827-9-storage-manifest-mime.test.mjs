import assert from "node:assert/strict";
import JSZip from "jszip";
import { prepararExtracaoPersistente } from "../api/processar-storage.js";

const zip = new JSZip();
zip.file("Conversa do WhatsApp com Cliente.txt", `15/07/2026 10:00 - Cliente: Bom dia
15/07/2026 10:01 - Corretor: Bom dia!
`);
const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

const ORG_ID = "org-teste-8279";
const objects = new Map([[`whatsapp/organizations/${ORG_ID}/imports/imp-teste-8279/conversa.zip`, zipBuffer]]);
const uploadTypes = new Map();
const allowed = new Set(["application/zip", "application/x-zip-compressed", "application/octet-stream"]);
const storage = {
  async download(path) {
    if (!objects.has(path)) return { data: null, error: { message: "Object not found" } };
    return { data: new Blob([objects.get(path)]), error: null };
  },
  async upload(path, payload, options = {}) {
    const type = String(options.contentType || "application/octet-stream");
    // v1373 — reproduz o bucket REAL: ele aceita ZIP/octet-stream e NÃO abre exceção para audio/*.
    if (!allowed.has(type)) {
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
  storagePath: `whatsapp/organizations/${ORG_ID}/imports/imp-teste-8279/conversa.zip`,
  importId: "imp-teste-8279",
  audioWindowDays: "90",
  organizationId: ORG_ID
});

const manifestPath = `organizations/${ORG_ID}/imports/imp-teste-8279/manifest.json`;
assert.equal(result.manifest.status, "prepared");
assert.equal(result.manifest.prep.messages.length, 2);
assert.ok(objects.has(manifestPath), "manifesto precisa ser persistido");
assert.equal(uploadTypes.get(manifestPath), "application/octet-stream");
console.log("v827-9: manifesto interno salvo com bucket real restrito a ZIP/octet-stream.");
