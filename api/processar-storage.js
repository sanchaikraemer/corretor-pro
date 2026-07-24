import { requireApiKey, _buscarProcessamentoExistenteV681 } from "./_persistence.js";
import { requireAccount, requireDonoDoRegistro } from "./_auth.js";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  prepararConversaDoZip,
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
    contentType: "application/octet-stream",
    upsert: true,
    cacheControl: "31536000"
  });
  if (error) throw new Error(`Não consegui guardar a transcrição reaproveitável: ${error.message}`);
}

// Reaproveitamento de transcrição — por que NÃO comparar o áudio pelo hash de conteúdo entre
// importações diferentes: o WhatsApp não garante bytes idênticos entre duas exportações da
// MESMA conversa (mesmo áudio, arquivo ligeiramente diferente por dentro) — na prática o hash
// quase nunca bate entre importações separadas, então "audiosReaproveitados" ficava sempre 0 e
// todo áudio já transcrito antes era pago e transcrito de novo a cada reimportação. O nome do
// arquivo de áudio (ex.: AUD-20240115-WA0007.opus), por outro lado, é estável entre exportações
// — mas só é seguro comparar DENTRO do histórico do MESMO cliente já identificado, nunca contra
// outros clientes (nome de arquivo sozinho pode repetir entre conversas diferentes).
const AUDIO_TRANSCRITO_PREFIXO = "[Áudio transcrito] ";

export function transcricoesDoLeadAnterior(timelineJson) {
  const mapa = {};
  for (const m of (Array.isArray(timelineJson) ? timelineJson : [])) {
    if (!m || m.type !== "audio" || m.audioStatus !== "transcrito") continue;
    const nome = normalizeName(m.mediaFile || "");
    const texto = String(m.text || "");
    if (!nome || !texto.startsWith(AUDIO_TRANSCRITO_PREFIXO)) continue;
    const semPrefixo = texto.slice(AUDIO_TRANSCRITO_PREFIXO.length).trim();
    if (semPrefixo) mapa[nome] = semPrefixo;
  }
  return mapa;
}

async function salvarManifesto(storage, manifestPath, manifest) {
  const buffer = Buffer.from(JSON.stringify(manifest), "utf8");
  const { error } = await storage.upload(manifestPath, buffer, {
    contentType: "application/octet-stream",
    upsert: true,
    cacheControl: "0"
  });
  if (error) throw new Error(`Não consegui salvar o manifesto da importação: ${error.message}`);
}

export async function prepararExtracaoPersistente({ storage, storagePath, importId, audioWindowDays, cacheDoLead = {} }) {
  const prefix = `imports/${importId}`;
  const manifestPath = `${prefix}/manifest.json`;
  const existente = await carregarManifesto(storage, manifestPath);
  const janelaSolicitada = String(audioWindowDays || "90");
  // v827-4: só reaproveita a extração anterior se a JANELA de áudio for a mesma. Antes,
  // trocar a janela reusava a extração antiga (áudios errados) sem refazer.
  if (existente?.sourceZipPath === storagePath && existente?.prep && existente?.audioStorage
      && String(existente?.audioWindowDays || "90") === janelaSolicitada) {
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
  // v827-4 (ZIP grande): sobe os áudios em LOTES paralelos, senão um upload de cada vez
  // estourava o tempo da função serverless em ZIPs com muitos áudios.
  const CONCORRENCIA_UPLOAD = 4;
  const entradas = Object.entries(extracted).map(([base, audioBuffer], i) => {
    const nome = normalizeName(base);
    return { nome, audioBuffer, audioPath: `${prefix}/audio/${String(i + 1).padStart(4, "0")}-${nomeStorageSeguro(nome)}` };
  });
  const subirUm = async ({ nome, audioBuffer, audioPath }) => {
    const { error } = await storage.upload(audioPath, audioBuffer, {
      contentType: contentTypeAudio(nome),
      upsert: true,
      cacheControl: "0"
    });
    if (error) throw new Error(`Não consegui guardar o áudio extraído ${nome}: ${error.message}`);
    const hash = hashAudio(audioBuffer);
    audioStorage[nome] = audioPath;
    audioHashes[nome] = hash;
    // Primeiro tenta pelo histórico do MESMO cliente (nome do arquivo — mais confiável, ver
    // nota acima de transcricoesDoLeadAnterior). Só cai pro cache por hash de conteúdo se não
    // achou nada ali (esse cache por hash raramente bate entre importações separadas, mas não
    // custa manter como reforço).
    const doLead = cacheDoLead[nome];
    if (doLead) {
      transcriptions[nome] = { status: "transcrito_reaproveitado", text: doLead, reused: true, viaLeadAnterior: true };
    } else {
      const cached = await carregarTranscricaoCache(storage, hash);
      if (cached) transcriptions[nome] = cached;
    }
    arquivosTemporarios.push(audioPath);
  };
  for (let i = 0; i < entradas.length; i += CONCORRENCIA_UPLOAD) {
    await Promise.all(Array.from(entradas.slice(i, i + CONCORRENCIA_UPLOAD), subirUm));
  }

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
  const conta = await requireAccount(req, res);
  if (!conta) return;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const defaultBucket = process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips";
  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, { ok: false, error: "Supabase ainda não configurado.", missing: { SUPABASE_URL: !!supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey } });
  }

  let body;
  try { body = await readJsonBody(req); }
  catch (_) { return json(res, 400, { ok: false, error: "Não foi possível ler o corpo da requisição." }); }

  const bucket = defaultBucket;
  const storagePath = String(body?.path || "").trim();
  const action = String(body?.action || "").trim();
  const importId = importIdSeguro(body?.importId);
  const actions = new Set(["preparar", "transcrever", "analisar", "finalizar", "limpar-antigos"]);
  if (!actions.has(action)) return json(res, 400, { ok: false, error: "Ação de processamento inválida." });
  if (action !== "limpar-antigos" && !importId) {
    return json(res, 400, { ok: false, error: "Identificador de importação ausente ou inválido." });
  }
  if (action !== "limpar-antigos") {
    const prefixoEsperado = `whatsapp/imports/${importId}/`;
    if (!storagePath.startsWith(prefixoEsperado) || !/\.zip$/i.test(storagePath)) {
      return json(res, 400, { ok: false, error: "Caminho do ZIP não pertence à importação informada." });
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const storage = supabase.storage.from(bucket);

  try {
    if (action === "preparar") {
      if (!importId) return json(res, 400, { ok: false, error: "Identificador de importação ausente ou inválido." });
      // Identifica um possível cliente já existente só pelo NOME DO ARQUIVO do zip (ainda não
      // temos a análise nesta etapa, só o arquivo) — mesma lógica já usada e confiável na hora
      // de salvar (_buscarProcessamentoExistenteV681). Serve só pra reaproveitar transcrição de
      // áudios já feitos nesse MESMO cliente; não decide fusão de cadastro (isso continua
      // acontecendo depois, na análise/persistência, do jeito que já era).
      const nomeArquivoZip = storagePath.split("/").pop() || "";
      const matchAnterior = await _buscarProcessamentoExistenteV681(supabase, { result: {}, fileName: nomeArquivoZip, path: storagePath, ownerId: conta.userId }).catch(() => null);
      const cacheDoLead = matchAnterior?.row ? transcricoesDoLeadAnterior(matchAnterior.row.timeline_json) : {};
      const { manifest, reusedPreparation } = await prepararExtracaoPersistente({ storage, storagePath, importId, audioWindowDays: body?.audioWindowDays, cacheDoLead });
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
      if (existingLeadId && !(await requireDonoDoRegistro(supabase, "whatsapp_processamentos", existingLeadId, conta, res))) return;
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
      const manifestPath = importId ? `imports/${importId}/manifest.json` : "";
      const manifest = importId ? await carregarManifesto(storage, manifestPath) : null;
      if (analysis && typeof analysis === "object") {
        const cachePaths = [...new Set(Object.values(manifest?.audioHashes || {}).filter(Boolean).map(caminhoCacheTranscricao))];
        analysis._storageRefs = {
          version: 1,
          bucket,
          importIds: importId ? [importId] : [],
          sourceZipPaths: storagePath ? [storagePath] : [],
          transcriptionCachePaths: cachePaths
        };
      }
      const mensagens = analysis?.messages || {};
      const temTrio = [mensagens.a, mensagens.b, mensagens.c].every(v => String(v || "").trim().length >= 10);
      const falhou = !analysis || analysis.mode === "erro_api" || analysis.mode === "sem_api" || analysis.sugestoesPendentes === true || !temTrio;
      if (falhou) return json(res, 502, { ok: false, error: "A conversa foi lida, mas a análise comercial não foi concluída.", details: analysis?.error || (analysis?.validacaoSugestoes || []).join("; ") || "A IA não devolveu as 3 mensagens.", recoverable: true, bucket, path: storagePath, importId });
      if (importId && manifest) {
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

    return json(res, 400, { ok: false, error: "Ação de processamento inválida." });
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
