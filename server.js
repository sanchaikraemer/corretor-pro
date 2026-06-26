import express from "express";

const app = express();
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
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

app.get("/api/health", (_request, response) => {
  response.set("Cache-Control", "no-store").status(200).json({
    ok: true,
    app: "Corretor Pro",
    version: "0.1.3",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    supabaseConfigured: configuredSupabase(),
    timestamp: new Date().toISOString()
  });
});

app.post(
  "/api/transcrever",
  express.raw({ type: () => true, limit: MAX_AUDIO_BYTES }),
  async (request, response) => {
    response.set("Cache-Control", "no-store");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return response.status(503).json({
        code: "OPENAI_NOT_CONFIGURED",
        error: "A chave da OpenAI ainda não foi configurada na Vercel."
      });
    }

    const audioBuffer = Buffer.isBuffer(request.body) ? request.body : Buffer.from(request.body || []);
    if (!audioBuffer.length) return response.status(400).json({ error: "O áudio recebido está vazio." });
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      return response.status(413).json({
        code: "AUDIO_TOO_LARGE",
        error: "Este áudio ultrapassa o limite de 4 MB desta primeira versão."
      });
    }

    try {
      const filename = safeFilename(request.query?.filename || request.get("x-file-name"));
      const form = new FormData();
      form.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), filename);
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
        return response.status(openaiResponse.status >= 500 ? 502 : 400).json({
          code: "TRANSCRIPTION_FAILED",
          error: payload?.error?.message || "A OpenAI não conseguiu transcrever o áudio."
        });
      }

      return response.status(200).json({
        text: String(payload.text || "").trim(),
        model: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1"
      });
    } catch {
      return response.status(500).json({
        code: "TRANSCRIPTION_ERROR",
        error: "Não foi possível preparar o áudio para transcrição."
      });
    }
  }
);

app.get("/api/atendimentos", async (request, response) => {
  response.set("Cache-Control", "no-store");
  const deviceId = String(request.query?.device_id || "").trim();
  if (!deviceId) return response.status(400).json({ error: "device_id é obrigatório." });
  if (!configuredSupabase()) return response.status(200).json({ storage: "local", records: [] });

  try {
    const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}`);
    url.searchParams.set("device_id", `eq.${deviceId}`);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "ultima_mensagem_at.desc.nullslast");

    const supabaseResponse = await fetch(url, { headers: supabaseHeaders() });
    const payload = await supabaseResponse.json().catch(() => []);
    if (!supabaseResponse.ok) {
      return response.status(502).json({ error: "Não foi possível consultar os atendimentos no Supabase." });
    }
    return response.status(200).json({ storage: "supabase", records: payload.map(fromDatabaseRow) });
  } catch {
    return response.status(502).json({ error: "Falha de comunicação com o Supabase." });
  }
});

app.post("/api/atendimentos", express.json({ limit: "8mb" }), async (request, response) => {
  response.set("Cache-Control", "no-store");
  const record = request.body;

  if (!isValidRecord(record)) {
    return response.status(400).json({ error: "Dados do atendimento incompletos ou inválidos." });
  }
  if (!configuredSupabase()) return response.status(200).json({ storage: "local", saved: false });

  try {
    const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}`);
    url.searchParams.set("on_conflict", "device_id,conversation_key");

    const supabaseResponse = await fetch(url, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(toDatabaseRow(record))
    });
    const payload = await supabaseResponse.json().catch(() => []);
    if (!supabaseResponse.ok) {
      return response.status(502).json({ error: "Não foi possível salvar o atendimento no Supabase." });
    }
    const saved = Array.isArray(payload) ? payload[0] : payload;
    return response.status(200).json({
      storage: "supabase",
      saved: true,
      record: saved ? fromDatabaseRow(saved) : record
    });
  } catch {
    return response.status(502).json({ error: "Falha de comunicação com o Supabase." });
  }
});

app.use((error, _request, response, _next) => {
  if (error?.type === "entity.too.large") {
    return response.status(413).json({
      code: "AUDIO_TOO_LARGE",
      error: "Este arquivo ultrapassa o limite desta primeira versão."
    });
  }
  return response.status(500).json({ error: "Erro interno do Corretor Pro." });
});

export default app;
