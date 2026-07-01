import { createClient } from "@supabase/supabase-js";
import { processZipBuffer, prepararConversaDoZip, transcreverLoteDoZip, finalizarAnaliseDaConversa } from "./_pipeline.js";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  const raw = await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => resolve(data || "{}"));
    req.on("error", reject);
  });
  try { return JSON.parse(raw || "{}"); } catch (_) { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Use POST para processar um ZIP do Storage." });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const defaultBucket = process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips";

  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, {
      ok: false,
      error: "Supabase ainda não configurado.",
      missing: {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey
      }
    });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (_) {
    return json(res, 400, { ok: false, error: "Não foi possível ler o corpo da requisição." });
  }

  const bucket = body?.bucket || defaultBucket;
  const storagePath = body?.path;
  const action = body?.action || "completo"; // completo | preparar | transcrever | analisar

  // A etapa "analisar" não precisa do ZIP (recebe mensagens + transcrições do front)
  if (action !== "analisar" && !storagePath) {
    return json(res, 400, { ok: false, error: "Informe o caminho do arquivo no Storage no campo 'path'." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  async function baixarZip() {
    const { data: blob, error: dlError } = await supabase.storage.from(bucket).download(storagePath);
    if (dlError || !blob) {
      const e = new Error(dlError?.message || "Download retornou vazio.");
      e._download = true;
      throw e;
    }
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  try {
    // ===== ETAPA 1: PREPARAR (lê TXT, aplica janela, lista áudios) =====
    if (action === "preparar") {
      const buffer = await baixarZip();
      const prep = await prepararConversaDoZip(buffer);
      return json(res, 200, { ok: true, bucket, path: storagePath, sizeBytes: buffer.length, ...prep });
    }

    // ===== ETAPA 2: TRANSCREVER (um lote de áudios) =====
    if (action === "transcrever") {
      const audioNames = Array.isArray(body?.audioNames) ? body.audioNames : [];
      if (!audioNames.length) return json(res, 200, { ok: true, transcriptions: {} });
      const buffer = await baixarZip();
      const { transcriptions, transcriptionEnabled } = await transcreverLoteDoZip(buffer, audioNames);
      return json(res, 200, { ok: true, transcriptions, transcriptionEnabled });
    }

    // ===== ETAPA 3: ANALISAR (sem ZIP — recebe tudo pronto do front) =====
    if (action === "analisar") {
      const result = await finalizarAnaliseDaConversa({
        txtFile: body?.txtFile,
        rawText: body?.rawText,
        messages: body?.messages,
        audioFilesRelevantes: body?.audioFilesRelevantes,
        transcriptionMap: body?.transcriptionMap,
        janelaConversa: body?.janelaConversa,
        ignoredFilesCount: body?.ignoredFilesCount,
        ignoredFiles: body?.ignoredFiles,
        audiosTotalNoZip: body?.audiosTotalNoZip,
        audiosDescartadosPorJanela: body?.audiosDescartadosPorJanela,
        metricsBase: body?.metricsBase
      });
      return json(res, 200, { ok: true, bucket, path: storagePath, autoSaved: false, ...result });
    }

    // ===== MODO COMPLETO (single-shot, legado — pra ZIPs pequenos) =====
    const buffer = await baixarZip();
    const result = await processZipBuffer(buffer);
    return json(res, 200, { ok: true, bucket, path: storagePath, sizeBytes: buffer.length, autoSaved: false, ...result });
  } catch (error) {
    if (error?._download) {
      return json(res, 404, { ok: false, error: "Não foi possível baixar o ZIP do Storage.", details: error.message, bucket, path: storagePath });
    }
    if (error?.filesFound) {
      return json(res, 400, { ok: false, error: error.message || "ZIP inválido.", filesFound: error.filesFound, bucket, path: storagePath });
    }
    return json(res, 500, { ok: false, error: "Falha ao processar o ZIP do Storage.", details: error?.message || String(error), bucket, path: storagePath });
  }
}
