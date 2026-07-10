import { requireApiKey } from "./_persistence.js";
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
  if (requireApiKey(req, res) !== true) return;
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
      const prep = await prepararConversaDoZip(buffer, { audioWindowDays: body?.audioWindowDays });
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
      // Na reimportação, o front envia só o ID. O servidor busca o histórico anterior
      // diretamente no Supabase: evita trafegar uma conversa enorme de volta pelo celular.
      let existingTimeline = Array.isArray(body?.existingTimeline) ? body.existingTimeline : [];
      const existingLeadId = body?.existingLeadId ? String(body.existingLeadId) : "";
      if (existingLeadId && !existingTimeline.length) {
        const { data: anterior, error: anteriorError } = await supabase
          .from("whatsapp_processamentos")
          .select("timeline_json")
          .eq("id", existingLeadId)
          .maybeSingle();
        if (anteriorError) throw new Error(`Não consegui recuperar o histórico anterior: ${anteriorError.message}`);
        if (anterior) {
          existingTimeline = Array.isArray(anterior.timeline_json) ? anterior.timeline_json : existingTimeline;
        }
      }

      const result = await finalizarAnaliseDaConversa({
        txtFile: body?.txtFile,
        rawText: body?.rawText,
        messages: body?.messages,
        audioFilesRelevantes: body?.audioFilesRelevantes,
        audioFilesForaDaJanela: body?.audioFilesForaDaJanela,
        transcriptionMap: body?.transcriptionMap,
        janelaConversa: body?.janelaConversa,
        ignoredFilesCount: body?.ignoredFilesCount,
        ignoredFiles: body?.ignoredFiles,
        audiosTotalNoZip: body?.audiosTotalNoZip,
        audiosDescartadosPorJanela: body?.audiosDescartadosPorJanela,
        metricsBase: body?.metricsBase,
        existingTimeline,
        previousAnalysis: null,
        existingLeadId,
        cerebroConfigOverride: body?.cerebroConfig || null,
        audiosReaproveitados: body?.audiosReaproveitados,
        audiosNovosSolicitados: body?.audiosNovosSolicitados
      });
      const analysis = result?.analysis || null;
      const mensagens = analysis?.messages || {};
      const temTrio = [mensagens.a, mensagens.b, mensagens.c].every(v => String(v || "").trim().length >= 10);
      const analiseFalhou = !analysis || analysis.mode === "erro_api" || analysis.mode === "sem_api" || analysis.sugestoesPendentes === true || !temTrio;
      if (analiseFalhou) {
        return json(res, 502, {
          ok: false,
          error: "A conversa foi lida, mas a análise comercial não foi concluída.",
          details: analysis?.error || (analysis?.validacaoSugestoes || []).join("; ") || "A IA não devolveu as 3 mensagens.",
          hint: "Verifique se OPENAI_API_KEY está configurada no Vercel e tente novamente. A conversa já foi lida; o erro está só na etapa de IA.",
          bucket,
          path: storagePath
        });
      }
      return json(res, 200, { ok: true, bucket, path: storagePath, autoSaved: false, ...result });
    }

    // ===== MODO COMPLETO (single-shot, legado — pra ZIPs pequenos) =====
    const buffer = await baixarZip();
    const result = await processZipBuffer(buffer, { audioWindowDays: body?.audioWindowDays });
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
