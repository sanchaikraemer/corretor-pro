// Corretor Pro — handler HTTP sem dependências externas.
// Funciona como função serverless da Vercel (export default (req, res)).

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const TABLE = "corretor_pro_atendimentos";

function configuredSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function safeFilename(value) {
  let name = "audio.ogg";
  try {
    name = decodeURIComponent(String(value || name));
  } catch {
    name = String(value || name);
  }
  name = name.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]+/g, "-");
  if (/\.opus$/i.test(name)) name = name.replace(/\.opus$/i, ".ogg");
  if (!/\.(ogg|mp3|wav|m4a|mp4|webm)$/i.test(name)) name += ".ogg";
  return name;
}

function toDatabaseRow(record) {
  return {
    id: record.id,
    device_id: record.deviceId,
    conversation_key: record.conversationKey,
    nome_lead: record.nomeLead,
    arquivo_origem: record.arquivoOrigem || null,
    ultima_mensagem_at: record.ultimaMensagemAt || null,
    ultima_mensagem_resumo: record.ultimaMensagemResumo || null,
    timeline: Array.isArray(record.timeline) ? record.timeline : [],
    metadata: record.metadata && typeof record.metadata === "object" ? record.metadata : {},
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: record.updatedAt || new Date().toISOString()
  };
}

function fromDatabaseRow(row) {
  return {
    id: row.id,
    deviceId: row.device_id,
    conversationKey: row.conversation_key,
    nomeLead: row.nome_lead,
    arquivoOrigem: row.arquivo_origem,
    ultimaMensagemAt: row.ultima_mensagem_at,
    ultimaMensagemResumo: row.ultima_mensagem_resumo,
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isValidRecord(record) {
  return Boolean(
    record &&
    typeof record.deviceId === "string" && record.deviceId.length >= 8 &&
    typeof record.conversationKey === "string" && record.conversationKey.length >= 1 &&
    typeof record.nomeLead === "string" && record.nomeLead.trim() &&
    Array.isArray(record.timeline) && record.timeline.length <= 50000
  );
}

function readStream(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", chunk => {
      size += chunk.length;
      if (limit && size > limit) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve({ buffer: Buffer.concat(chunks), tooLarge, size }));
    req.on("error", reject);
  });
}

async function readRawBody(req, limit) {
  if (Buffer.isBuffer(req.body)) {
    return { buffer: req.body, tooLarge: req.body.length > limit, size: req.body.length };
  }
  if (typeof req.body === "string") {
    const buffer = Buffer.from(req.body);
    return { buffer, tooLarge: buffer.length > limit, size: buffer.length };
  }
  return readStream(req, limit);
}

async function readJsonBody(req, limit) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const { buffer, tooLarge } = await readStream(req, limit);
  if (tooLarge) {
    const error = new Error("entity.too.large");
    error.code = "TOO_LARGE";
    throw error;
  }
  if (!buffer.length) return {};
  return JSON.parse(buffer.toString("utf8"));
}

function getQuery(req, url) {
  if (req.query && typeof req.query === "object") return req.query;
  return Object.fromEntries(url.searchParams.entries());
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function handleHealth(_req, res) {
  return send(res, 200, {
    ok: true,
    app: "Corretor Pro",
    version: "0.1.3",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    supabaseConfigured: configuredSupabase(),
    timestamp: new Date().toISOString()
  });
}

async function handleTranscrever(req, res, url) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return send(res, 503, {
      code: "OPENAI_NOT_CONFIGURED",
      error: "A chave da OpenAI ainda não foi configurada na Vercel."
    });
  }

  const { buffer, tooLarge } = await readRawBody(req, MAX_AUDIO_BYTES);
  if (tooLarge || buffer.length > MAX_AUDIO_BYTES) {
    return send(res, 413, {
      code: "AUDIO_TOO_LARGE",
      error: "Este áudio ultrapassa o limite de 4 MB desta primeira versão."
    });
  }
  if (!buffer.length) return send(res, 400, { error: "O áudio recebido está vazio." });

  try {
    const query = getQuery(req, url);
    const filename = safeFilename(query.filename || getHeader(req, "x-file-name"));
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: "audio/ogg" }), filename);
    form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1");
    form.append("language", "pt");
    form.append("response_format", "json");

    const openaiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });

    const payload = await openaiResponse.json().catch(() => ({}));
    if (!openaiResponse.ok) {
      return send(res, openaiResponse.status >= 500 ? 502 : 400, {
        code: "TRANSCRIPTION_FAILED",
        error: payload?.error?.message || "A OpenAI não conseguiu transcrever o áudio."
      });
    }

    return send(res, 200, {
      text: String(payload.text || "").trim(),
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1"
    });
  } catch {
    return send(res, 500, {
      code: "TRANSCRIPTION_ERROR",
      error: "Não foi possível preparar o áudio para transcrição."
    });
  }
}

async function handleListAtendimentos(req, res, url) {
  const query = getQuery(req, url);
  const deviceId = String(query.device_id || "").trim();
  if (!deviceId) return send(res, 400, { error: "device_id é obrigatório." });
  if (!configuredSupabase()) return send(res, 200, { storage: "local", records: [] });

  try {
    const target = new URL(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}`);
    target.searchParams.set("device_id", `eq.${deviceId}`);
    target.searchParams.set("select", "*");
    target.searchParams.set("order", "ultima_mensagem_at.desc.nullslast");

    const supabaseResponse = await fetch(target, { headers: supabaseHeaders() });
    const payload = await supabaseResponse.json().catch(() => []);
    if (!supabaseResponse.ok) {
      return send(res, 502, { error: "Não foi possível consultar os atendimentos no Supabase." });
    }
    return send(res, 200, { storage: "supabase", records: payload.map(fromDatabaseRow) });
  } catch {
    return send(res, 502, { error: "Falha de comunicação com o Supabase." });
  }
}

async function handleSaveAtendimento(req, res) {
  let record;
  try {
    record = await readJsonBody(req, MAX_JSON_BYTES);
  } catch (error) {
    if (error?.code === "TOO_LARGE") {
      return send(res, 413, {
        code: "AUDIO_TOO_LARGE",
        error: "Este arquivo ultrapassa o limite desta primeira versão."
      });
    }
    return send(res, 400, { error: "Dados do atendimento incompletos ou inválidos." });
  }

  if (!isValidRecord(record)) {
    return send(res, 400, { error: "Dados do atendimento incompletos ou inválidos." });
  }
  if (!configuredSupabase()) return send(res, 200, { storage: "local", saved: false });

  try {
    const target = new URL(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}`);
    target.searchParams.set("on_conflict", "device_id,conversation_key");

    const supabaseResponse = await fetch(target, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(toDatabaseRow(record))
    });
    const payload = await supabaseResponse.json().catch(() => []);
    if (!supabaseResponse.ok) {
      return send(res, 502, { error: "Não foi possível salvar o atendimento no Supabase." });
    }
    const saved = Array.isArray(payload) ? payload[0] : payload;
    return send(res, 200, {
      storage: "supabase",
      saved: true,
      record: saved ? fromDatabaseRow(saved) : record
    });
  } catch {
    return send(res, 502, { error: "Falha de comunicação com o Supabase." });
  }
}

export default async function handler(req, res) {
  const host = getHeader(req, "host") || "localhost";
  const url = new URL(req.url || "/", `http://${host}`);
  const route = url.pathname.replace(/^\/api/, "") || "/";
  const method = (req.method || "GET").toUpperCase();

  try {
    if (route === "/health" && method === "GET") return handleHealth(req, res);
    if (route === "/transcrever" && method === "POST") return handleTranscrever(req, res, url);
    if (route === "/atendimentos" && method === "GET") return handleListAtendimentos(req, res, url);
    if (route === "/atendimentos" && method === "POST") return handleSaveAtendimento(req, res);
    return send(res, 404, { error: "Rota não encontrada." });
  } catch {
    return send(res, 500, { error: "Erro interno do Corretor Pro." });
  }
}
