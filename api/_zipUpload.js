// Leitura de ZIP enviado direto no corpo da requisição (sem passar pelo Supabase Storage) —
// usado por api/analisar.js (rota de compatibilidade) e api/receber-zip-atalho.js (Atalho do
// iPhone). Extraído pra um arquivo só pra não duplicar o parser de multipart nas duas rotas.

export async function readRawBody(req, maxBytes = 80 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error("Arquivo maior que o limite permitido para esta rota.");
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

export function parseMultipart(buffer, boundary) {
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

export function decodeBase64Zip(body = {}) {
  const candidate = body.zipBase64 || body.fileBase64 || body.base64 || body.data;
  if (typeof candidate !== "string" || !candidate.trim()) return null;
  const clean = candidate.replace(/^data:application\/(?:zip|x-zip-compressed);base64,/i, "").trim();
  try { return Buffer.from(clean, "base64"); } catch (_) { return null; }
}

// Lê um ZIP de uma requisição HTTP crua, aceitando multipart/form-data, application/zip ou
// octet-stream cru, ou JSON com base64 — mesmas três formas que api/analisar.js já aceitava.
// Devolve { zipBuffer, audioWindowDays, cerebroConfig } (zipBuffer pode vir null/vazio).
export async function lerZipDaRequisicao(req, { maxBytesMultipart = 80 * 1024 * 1024, maxBytesJson = 110 * 1024 * 1024 } = {}) {
  const type = String(req.headers["content-type"] || "").toLowerCase();
  let zipBuffer = null;
  let audioWindowDays = "90";
  let cerebroConfig = null;

  if (type.includes("multipart/form-data")) {
    const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
    if (!boundary) { const e = new Error("Upload multipart sem boundary."); e.statusCode = 400; throw e; }
    const raw = await readRawBody(req, maxBytesMultipart);
    const parsed = parseMultipart(raw, boundary[1] || boundary[2]);
    const zip = parsed.files.find(f => /\.zip$/i.test(f.name)) || parsed.files[0];
    zipBuffer = zip?.buffer || null;
    audioWindowDays = parsed.fields.audioWindowDays || parsed.fields.janelaAudio || audioWindowDays;
    try { cerebroConfig = parsed.fields.cerebroConfig ? JSON.parse(parsed.fields.cerebroConfig) : null; } catch (_) {}
  } else if (type.includes("application/zip") || type.includes("application/octet-stream")) {
    zipBuffer = await readRawBody(req, maxBytesMultipart);
  } else {
    const raw = await readRawBody(req, maxBytesJson);
    let body = {};
    try { body = raw.length ? JSON.parse(raw.toString("utf8")) : {}; }
    catch (_) { const e = new Error("Corpo JSON inválido."); e.statusCode = 400; throw e; }
    zipBuffer = decodeBase64Zip(body);
    audioWindowDays = body.audioWindowDays || body.janelaAudio || audioWindowDays;
    cerebroConfig = body.cerebroConfig || null;
  }

  return { zipBuffer, audioWindowDays, cerebroConfig };
}
