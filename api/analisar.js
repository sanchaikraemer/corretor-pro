import { processZipBuffer } from "./_pipeline.js";
import { requireApiKey } from "./_persistence.js";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readRawBody(req, maxBytes = 80 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error("Arquivo maior que o limite permitido para esta rota de compatibilidade.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseContentDisposition(value = "") {
  const name = /(?:^|;)\s*name="([^"]+)"/i.exec(value)?.[1] || "";
  const filename = /(?:^|;)\s*filename="([^"]*)"/i.exec(value)?.[1] || "";
  return { name, filename };
}

function parseMultipart(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const headerEnd = Buffer.from("\r\n\r\n");
  const fields = {};
  const files = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const start = buffer.indexOf(delimiter, cursor);
    if (start < 0) break;
    let partStart = start + delimiter.length;
    if (buffer.slice(partStart, partStart + 2).toString() === "--") break;
    if (buffer.slice(partStart, partStart + 2).toString() === "\r\n") partStart += 2;

    const next = buffer.indexOf(delimiter, partStart);
    if (next < 0) break;
    let part = buffer.slice(partStart, next);
    if (part.slice(-2).toString() === "\r\n") part = part.slice(0, -2);

    const hEnd = part.indexOf(headerEnd);
    if (hEnd < 0) { cursor = next; continue; }
    const headersText = part.slice(0, hEnd).toString("utf8");
    const body = part.slice(hEnd + headerEnd.length);
    const headers = {};
    for (const line of headersText.split("\r\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
    const cd = parseContentDisposition(headers["content-disposition"] || "");
    if (cd.filename) {
      files.push({ name: cd.filename, fieldName: cd.name, type: headers["content-type"] || "application/octet-stream", buffer: body });
    } else if (cd.name) {
      fields[cd.name] = body.toString("utf8");
    }
    cursor = next;
  }
  return { fields, files };
}

function decodeBase64Zip(body = {}) {
  const candidate = body.zipBase64 || body.fileBase64 || body.base64 || body.data;
  if (typeof candidate !== "string" || !candidate.trim()) return null;
  const clean = candidate.replace(/^data:application\/(?:zip|x-zip-compressed);base64,/i, "").trim();
  try { return Buffer.from(clean, "base64"); } catch (_) { return null; }
}

export default async function handler(req, res) {
  if (requireApiKey(req, res) !== true) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Método não permitido." });

  try {
    const type = String(req.headers["content-type"] || "").toLowerCase();
    let zipBuffer = null;
    let audioWindowDays = "90";
    let cerebroConfig = null;

    if (type.includes("multipart/form-data")) {
      const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
      if (!boundary) return json(res, 400, { ok: false, error: "Upload multipart sem boundary." });
      const raw = await readRawBody(req);
      const parsed = parseMultipart(raw, boundary[1] || boundary[2]);
      const zip = parsed.files.find(f => /\.zip$/i.test(f.name)) || parsed.files[0];
      zipBuffer = zip?.buffer || null;
      audioWindowDays = parsed.fields.audioWindowDays || parsed.fields.janelaAudio || audioWindowDays;
      try { cerebroConfig = parsed.fields.cerebroConfig ? JSON.parse(parsed.fields.cerebroConfig) : null; } catch (_) {}
    } else if (type.includes("application/zip") || type.includes("application/octet-stream")) {
      zipBuffer = await readRawBody(req);
    } else {
      const raw = await readRawBody(req, 110 * 1024 * 1024);
      let body = {};
      try { body = raw.length ? JSON.parse(raw.toString("utf8")) : {}; }
      catch (_) { return json(res, 400, { ok: false, error: "Corpo JSON inválido." }); }
      zipBuffer = decodeBase64Zip(body);
      audioWindowDays = body.audioWindowDays || body.janelaAudio || audioWindowDays;
      cerebroConfig = body.cerebroConfig || null;
    }

    if (!zipBuffer?.length) {
      return json(res, 400, {
        ok: false,
        error: "Nenhum arquivo ZIP foi recebido.",
        hint: "Atualize o aplicativo e tente importar novamente."
      });
    }

    const result = await processZipBuffer(zipBuffer, { audioWindowDays, cerebroConfig });
    const analysis = result?.analysis || null;
    const messages = analysis?.messages || {};
    const complete = [messages.a, messages.b, messages.c].every(v => String(v || "").trim().length >= 10);
    if (!analysis || analysis.mode === "erro_api" || analysis.mode === "sem_api" || analysis.sugestoesPendentes === true || !complete) {
      return json(res, 502, {
        ok: false,
        error: "A conversa foi importada, mas a análise comercial não foi concluída.",
        details: analysis?.error || (analysis?.validacaoSugestoes || []).join("; ") || "A IA não devolveu as três mensagens.",
        recoverable: true
      });
    }

    return json(res, 200, { ok: true, compatibilityRoute: true, autoSaved: false, ...result });
  } catch (error) {
    console.error("[api/analisar]", error);
    return json(res, error?.statusCode || 500, {
      ok: false,
      error: "Falha ao importar e analisar a conversa.",
      details: error?.message || String(error),
      recoverable: true
    });
  }
}
