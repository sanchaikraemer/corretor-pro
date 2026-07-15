import { requireApiKey } from "./_persistence.js";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  processZipBuffer,
  prepararConversaDoZip,
  transcreverLoteDoZip,
  transcreverArquivosExtraidos,
  finalizarAnaliseDaConversa,
  normalizeName
} from "./_pipeline.js";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
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

function importIdSeguro(value = "") {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,120}$/.test(id)) return "";
  return id;
}

function nomeStorageSeguro(value = "audio") {
  return String(value || "audio")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "audio";
}

function contentTypeAudio(name = "") {
  const ext = String(name).toLowerCase().split(".").pop();
  return ({ opus:"audio/opus", ogg:"audio/ogg", mp3:"audio/mpeg", m4a:"audio/mp4", wav:"audio/wav", aac:"audio/aac" })[ext] || "application/octet-stream";
}

async function baixarBuffer(storage, storagePath) {
  const { data: blob, error } = await storage.download(storagePath);
  if (error || !blob) {
    const e = new Error(error?.message || "Download retornou vazio.");
    e._download = true;
    throw e;
  }
  return Buffer.from(await blob.arrayBuffer());
}

async function carregarManifesto(storage, manifestPath) {
  try {
    const buffer = await baixarBuffer(storage, manifestPath);
    const parsed = JSON.parse(buffer.toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) { return null; }
}

function hashAudio(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function caminhoCacheTranscricao(hash) {
  return `transcription-cache/${String(hash || "").slice(0, 2)}/${hash}.json`;
}

async function carregarTranscricaoCache(storage, hash) {
  if (!hash) return null;
  const item = await carregarManifesto(storage, caminhoCacheTranscricao(hash));
  return item?.text ? { status: "transcrito_reaproveitado", text: String(item.text), reused: true, hash } : null;
}

async function salvarTranscricaoCache(storage, hash, item) {
  if (!hash || !item?.text) return;
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    hash,
    text: String(item.text),
    createdAt: new Date().toISOString()
  }), "utf8");
  const { error } = await storage.upload(caminhoCacheTranscricao(hash), payload, {
    contentType: "application/json; charset=utf-8",
    upsert: true,
    cacheControl: "31536000"
  });
  if (error) throw new Error(`Não consegui guardar a transcrição reaproveitável: ${error.message}`);
}

async function salvarManifesto(storage, manifestPath, manifest) {
  const buffer = Buffer.from(JSON.stringify(manifest), "utf8");
  const { error } = await storage.upload(manifestPath, buffer, {
    contentType: "application/json; charset=utf-8",
    upsert: true,
    cacheControl: "0"
  });
  if (error) throw new Error(`Não consegui salvar o manifesto da importação: ${error.message}`);
}

async function prepararExtracaoPersistente({ storage, storagePath, importId, audioWindowDays }) {
  const prefix = `imports/${importId}`;
  const manifestPath = `${prefix}/manifest.json`;
  const existente = await carregarManifesto(storage, manifestPath);
  if (existente?.sourceZipPath === storagePath && existente?.prep && existente?.audioStorage) {
    return { manifest: existente, reusedPreparation: true };
  }

  const buffer = await baixarBuffer(storage, storagePath); // único download integral do ZIP
  const prep = await prepararConversaDoZip(buffer, { audioWindowDays, includeExtractedFiles: true }); // única extração
  const extracted = prep._extractedFiles || {};
  delete prep._extractedFiles;

  const audioStorage = {};
  const audioHashes = {};
  const transcriptions = {};
  const arquivosTemporarios = [];
  const entradas = Object.entries(extracted);
  // v827-4: uploads com concorrência limitada. Reduz muito o tempo da etapa sem
  // abrir dezenas de conexões nem estourar memória da função serverless.
  const CONCORRENCIA_UPLOAD = 4;
  let cursor = 0;
  async function workerUpload() {
    while (cursor < entradas.length) {
      const atual = cursor++;
      const [base, audioBuffer] = entradas[atual];
      const nome = normalizeName(base);
      const audioPath = `${prefix}/audio/${String(atual + 1).padStart(4, "0")}-${nomeStorageSeguro(nome)}`;
      const { error } = await storage.upload(audioPath, audioBuffer, {
        contentType: contentTypeAudio(nome),
        upsert: true,
        cacheControl: "0"
      });
      if (error) throw new Error(`Não consegui guardar o áudio extraído ${nome}: ${error.message}`);
      const hash = hashAudio(audioBuffer);
      audioStorage[nome] = audioPath;
      audioHashes[nome] = hash;
      const cached = await carregarTranscricaoCache(storage, hash);
      if (cached) transcriptions[nome] = cached;
      arquivosTemporarios.push(audioPath);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_UPLOAD, entradas.length) }, workerUpload));

  const manifest = {
    version: 1,
    importId,
    status: "prepared",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceZipPath: storagePath,
    audioWindowDays: String(audioWindowDays || "90"),
    audioStorage,
    audioHashes,
    transcriptions,
    temporaryFiles: arquivosTemporarios,
    prep
  };
  await salvarManifesto(storage, manifestPath, manifest);
  return { manifest, reusedPreparation: false };
}

async function removerImportacao(storage, manifest, manifestPath, storagePath) {
  const paths = new Set([...(manifest?.temporaryFiles || []), manifestPath, storagePath].filter(Boolean));
  if (!paths.size) return { removed: 0 };
  const { data, error } = await storage.remove([...paths]);
  if (error) throw new Error(error.message);
  return { removed: Array.isArray(data) ? data.length : paths.size };
}

export default async function handler(req, res) {
  if (requireApiKey(req, res) !== true) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Use POST para processar um ZIP do Storage." });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const defaultBucket = process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips";
  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, { ok: false, error: "Supabase ainda não configurado.", missing: { SUPABASE_URL: !!supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey } });
  }

  let body;
  try { body = await readJsonBody(req); }
  catch (_) { return json(res, 400, { ok: false, error: "Não foi possível ler o corpo da requisição." }); }

  const bucket = body?.bucket || defaultBucket;
  const storagePath = body?.path;
  const action = body?.action || "completo";
  const importId = importIdSeguro(body?.importId);
  if (!["analisar", "limpar-antigos"].includes(action) && !storagePath) {
    return json(res, 400, { ok: false, error: "Informe o caminho do arquivo no Storage no campo 'path'." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const storage = supabase.storage.from(bucket);

  try {
    if (action === "preparar") {
      if (!importId) return json(res, 400, { ok: false, error: "Identificador de importação ausente ou inválido." });
      const { manifest, reusedPreparation } = await prepararExtracaoPersistente({ storage, storagePath, importId, audioWindowDays: body?.audioWindowDays });
      return json(res, 200, {
        ok: true, bucket, path: storagePath, importId, manifestPath: `imports/${importId}/manifest.json`,
        reusedPreparation, extractionCompleted: true, ...manifest.prep,
        audioStorage: manifest.audioStorage,
        cachedTranscriptions: manifest.transcriptions || {}
      });
    }

    if (action === "transcrever") {
      const audioNames = Array.isArray(body?.audioNames) ? body.audioNames.map(normalizeName) : [];
      if (!audioNames.length) return json(res, 200, { ok: true, transcriptions: {} });
      if (!importId) return json(res, 400, { ok: false, error: "Identificador de importação ausente ou inválido." });
      const manifestPath = `imports/${importId}/manifest.json`;
      const manifest = await carregarManifesto(storage, manifestPath);
      if (!manifest?.audioStorage) return json(res, 409, { ok: false, error: "A extração desta importação não foi encontrada. Tente preparar novamente sem reenviar o ZIP." });
      const existentes = manifest.transcriptions && typeof manifest.transcriptions === "object" ? { ...manifest.transcriptions } : {};
      const arquivos = [];
      for (const nome of audioNames) {
        if (existentes[nome]?.text) continue;
        const hash = manifest?.audioHashes?.[nome];
        const cached = await carregarTranscricaoCache(storage, hash);
        if (cached) {
          existentes[nome] = cached;
          continue;
        }
        const audioPath = manifest.audioStorage[nome];
        if (!audioPath) continue;
        arquivos.push({ name: nome, buffer: await baixarBuffer(storage, audioPath) });
      }
      const lote = arquivos.length
        ? await transcreverArquivosExtraidos(arquivos)
        : { transcriptions: {}, transcriptionEnabled: true };
      Object.assign(existentes, lote.transcriptions || {});
      for (const [nome, item] of Object.entries(lote.transcriptions || {})) {
        if (item?.text) await salvarTranscricaoCache(storage, manifest?.audioHashes?.[nome], item);
      }
      manifest.transcriptions = existentes;
      manifest.status = "prepared";
      manifest.updatedAt = new Date().toISOString();
      delete manifest.lastError;
      await salvarManifesto(storage, manifestPath, manifest);
      const solicitadas = Object.fromEntries(audioNames.filter(nome => existentes[nome]).map(nome => [nome, existentes[nome]]));
      return json(res, 200, {
        ok: true,
        transcriptions: solicitadas,
        transcriptionEnabled: lote.transcriptionEnabled,
        importId,
        reused: audioNames.filter(nome => solicitadas[nome]?.reused).length,
        zipDownloadedAgain: false
      });
    }

    if (action === "analisar") {
      let existingTimeline = Array.isArray(body?.existingTimeline) ? body.existingTimeline : [];
      const existingLeadId = body?.existingLeadId ? String(body.existingLeadId) : "";
      if (existingLeadId && !existingTimeline.length) {
        const { data: anterior, error: anteriorError } = await supabase.from("whatsapp_processamentos").select("timeline_json").eq("id", existingLeadId).maybeSingle();
        if (anteriorError) throw new Error(`Não consegui recuperar o histórico anterior: ${anteriorError.message}`);
        if (anterior) existingTimeline = Array.isArray(anterior.timeline_json) ? anterior.timeline_json : existingTimeline;
      }
      const result = await finalizarAnaliseDaConversa({
        txtFile: body?.txtFile, rawText: body?.rawText, messages: body?.messages,
        audioFilesRelevantes: body?.audioFilesRelevantes, audioFilesForaDaJanela: body?.audioFilesForaDaJanela,
        transcriptionMap: body?.transcriptionMap, janelaConversa: body?.janelaConversa,
        ignoredFilesCount: body?.ignoredFilesCount, ignoredFiles: body?.ignoredFiles,
        audiosTotalNoZip: body?.audiosTotalNoZip, audiosDescartadosPorJanela: body?.audiosDescartadosPorJanela,
        metricsBase: body?.metricsBase, existingTimeline, previousAnalysis: null, existingLeadId,
        audiosReaproveitados: body?.audiosReaproveitados, audiosNovosSolicitados: body?.audiosNovosSolicitados,
        cerebroConfig: body?.cerebroConfig || null
      });
      const analysis = result?.analysis || null;
      const mensagens = analysis?.messages || {};
      const temTrio = [mensagens.a, mensagens.b, mensagens.c].every(v => String(v || "").trim().length >= 10);
      const falhou = !analysis || analysis.mode === "erro_api" || analysis.mode === "sem_api" || analysis.sugestoesPendentes === true || !temTrio;
      if (falhou) return json(res, 502, { ok: false, error: "A conversa foi lida, mas a análise comercial não foi concluída.", details: analysis?.error || (analysis?.validacaoSugestoes || []).join("; ") || "A IA não devolveu as 3 mensagens.", recoverable: true, bucket, path: storagePath, importId });
      if (importId) {
        const manifestPath = `imports/${importId}/manifest.json`;
        const manifest = await carregarManifesto(storage, manifestPath);
        if (manifest) {
          manifest.status = "analysis-ready";
          manifest.analysisReadyAt = new Date().toISOString();
          manifest.updatedAt = manifest.analysisReadyAt;
          delete manifest.lastError;
          await salvarManifesto(storage, manifestPath, manifest);
        }
      }
      return json(res, 200, { ok: true, bucket, path: storagePath, importId, autoSaved: false, ...result });
    }

    if (action === "finalizar") {
      if (!importId) return json(res, 400, { ok: false, error: "Identificador de importação ausente ou inválido." });
      const manifestPath = `imports/${importId}/manifest.json`;
      const manifest = await carregarManifesto(storage, manifestPath);
      if (manifest) {
        manifest.status = "completed";
        manifest.completedAt = new Date().toISOString();
        manifest.updatedAt = manifest.completedAt;
        await salvarManifesto(storage, manifestPath, manifest);
      }
      const cleanup = await removerImportacao(storage, manifest, manifestPath, storagePath || manifest?.sourceZipPath);
      return json(res, 200, { ok: true, importId, cleanup, completed: true });
    }

    if (action === "limpar-antigos") {
      // Limpeza conservadora: apenas manifestos com mais de 7 dias. Falhas não bloqueiam importações.
      const limiteMs = 7 * 24 * 60 * 60 * 1000;
      const activeImportId = importIdSeguro(body?.activeImportId);
      const { data: dirs, error } = await storage.list("imports", { limit: 100, sortBy: { column: "created_at", order: "asc" } });
      if (error) throw new Error(error.message);
      let removidas = 0;
      for (const dir of dirs || []) {
        const id = importIdSeguro(dir?.name);
        if (!id || id === activeImportId) continue;
        const manifestPath = `imports/${id}/manifest.json`;
        const manifest = await carregarManifesto(storage, manifestPath);
        const referencia = Date.parse(manifest?.updatedAt || manifest?.createdAt || dir?.created_at || "");
        if (!referencia || Date.now() - referencia < limiteMs) continue;
        const r = await removerImportacao(storage, manifest, manifestPath, manifest?.sourceZipPath).catch(() => ({ removed: 0 }));
        removidas += Number(r.removed || 0);
      }
      return json(res, 200, { ok: true, removidas });
    }

    // Compatibilidade para clientes antigos. O fluxo 825 não usa este modo.
    const buffer = await baixarBuffer(storage, storagePath);
    if (action === "transcrever-legado") {
      const audioNames = Array.isArray(body?.audioNames) ? body.audioNames : [];
      const result = await transcreverLoteDoZip(buffer, audioNames);
      return json(res, 200, { ok: true, ...result });
    }
    const result = await processZipBuffer(buffer, { audioWindowDays: body?.audioWindowDays, cerebroConfig: body?.cerebroConfig || null });
    return json(res, 200, { ok: true, bucket, path: storagePath, sizeBytes: buffer.length, autoSaved: false, ...result });
  } catch (error) {
    if (importId && ["preparar", "transcrever", "analisar"].includes(action)) {
      try {
        const manifestPath = `imports/${importId}/manifest.json`;
        const manifest = await carregarManifesto(storage, manifestPath);
        if (manifest) {
          manifest.status = "recoverable-failure";
          manifest.updatedAt = new Date().toISOString();
          manifest.lastError = { action, message: error?.message || String(error), at: manifest.updatedAt };
          await salvarManifesto(storage, manifestPath, manifest);
        }
      } catch (_) { /* o erro original continua sendo a resposta */ }
    }
    if (error?._download) return json(res, 404, { ok: false, error: "Não foi possível baixar o arquivo temporário da importação.", details: error.message, bucket, path: storagePath, importId, recoverable: true });
    if (error?.filesFound) return json(res, 400, { ok: false, error: error.message || "ZIP inválido.", filesFound: error.filesFound, bucket, path: storagePath, importId });
    return json(res, 500, { ok: false, error: "Falha ao processar a importação.", details: error?.message || String(error), bucket, path: storagePath, importId, recoverable: true });
  }
}
