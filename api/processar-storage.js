import { resolveOrganizationId, _buscarProcessamentoExistenteV681 } from "./_persistence.js";
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

// ---------- criar URL de upload grande (antigo api/criar-upload-url.js) ----------
// v1039 — o plano Hobby da Vercel só permite 12 Serverless Functions; esta rota passou a
// acumular também a criação da URL assinada de upload (ver NOTAS-v1039.md). O app continua
// chamando exatamente a mesma URL (/api/criar-upload-url) — vercel.json redireciona pra este
// arquivo. Distingue pela AUSÊNCIA do campo "action" (as ações desta rota sempre mandam
// "action"; a criação de URL de upload nunca mandou esse campo) — ver dispatch no handler().
const DEFAULT_MAX_ZIP_BYTES = 150 * 1024 * 1024;
const CONFIGURED_MAX_ZIP_BYTES = Number(process.env.SUPABASE_ZIP_MAX_BYTES);
const BUCKET_MAX_BYTES = Number.isFinite(CONFIGURED_MAX_ZIP_BYTES) && CONFIGURED_MAX_ZIP_BYTES > 0
  ? Math.min(CONFIGURED_MAX_ZIP_BYTES, 300 * 1024 * 1024)
  : DEFAULT_MAX_ZIP_BYTES;
const ALLOWED_ZIP_MIME_TYPES = [
  "application/zip", "application/x-zip-compressed", "application/octet-stream"
];

let bucketConfigured = false;

function errorMessage(value) {
  return value?.message || value?.error_description || value?.error || String(value || "Erro desconhecido");
}

function isMissingBucket(error) {
  const msg = errorMessage(error).toLowerCase();
  return error?.statusCode === "404" || error?.status === 404 || error?.code === "404" ||
    msg.includes("bucket not found") || msg.includes("not found") || msg.includes("does not exist");
}

async function createBucketWithFallback(supabase, bucket) {
  const attempts = [
    { public: false, fileSizeLimit: BUCKET_MAX_BYTES, allowedMimeTypes: ALLOWED_ZIP_MIME_TYPES },
    { public: false, allowedMimeTypes: ALLOWED_ZIP_MIME_TYPES },
    { public: false }
  ];

  const failures = [];
  for (const options of attempts) {
    try {
      const { error } = await supabase.storage.createBucket(bucket, options);
      if (!error) return { created: true, warning: failures[0] || null };

      const msg = errorMessage(error);
      // Outro processo/deploy pode ter criado o bucket entre o GET e o CREATE.
      if (/already exists|duplicate/i.test(msg)) return { created: false, warning: null };
      failures.push(msg);
    } catch (error) {
      failures.push(errorMessage(error));
    }
  }

  return { created: false, error: failures.filter(Boolean).join(" | ") || "Não foi possível criar o bucket." };
}

async function ensureBucketReady(supabase, bucket) {
  if (bucketConfigured) return { ok: true, existed: true, configured: true };

  let existed = false;
  try {
    const { data, error } = await supabase.storage.getBucket(bucket);
    if (!error && data) {
      existed = true;
    } else if (error && !isMissingBucket(error)) {
      return { ok: false, step: "consultar bucket", error: errorMessage(error) };
    }
  } catch (error) {
    return { ok: false, step: "consultar bucket", error: errorMessage(error) };
  }

  if (!existed) {
    const created = await createBucketWithFallback(supabase, bucket);
    if (created.error) {
      return { ok: false, step: "criar bucket", error: created.error };
    }
  }

  // A configuração do limite pode variar por plano do Supabase. Uma falha aqui vira aviso;
  // a autorização do upload continua protegida pelo limite validado acima.
  let warning = null;
  try {
    const { error } = await supabase.storage.updateBucket(bucket, {
      public: false,
      fileSizeLimit: BUCKET_MAX_BYTES,
      allowedMimeTypes: ALLOWED_ZIP_MIME_TYPES
    });
    if (error) warning = errorMessage(error);
  } catch (error) {
    warning = errorMessage(error);
  }

  bucketConfigured = true;
  return { ok: true, existed, configured: !warning, warning };
}

function sanitizeFileNameUpload(name = "conversa-whatsapp.zip") {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "conversa-whatsapp.zip";
}

async function criarUploadUrl(req, res, organizationId, body) {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = String(process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips").trim() || "whatsapp-zips";

  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, {
      ok: false,
      error: "Supabase ainda não configurado. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.",
      missing: { SUPABASE_URL: !!supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey }
    });
  }

  const fileName = sanitizeFileNameUpload(body?.fileName);
  const importId = importIdSeguro(body?.importId);
  if (!body?.probe && !importId) {
    return json(res, 400, { ok: false, error: "Identificador da importação não informado." });
  }
  if (!body?.probe && !/\.zip$/i.test(fileName)) {
    return json(res, 400, { ok: false, error: "Tipo de arquivo não suportado. Envie somente o ZIP exportado pelo WhatsApp." });
  }
  const declaredSize = Number(body?.size || 0);
  if (!body?.probe && (!Number.isFinite(declaredSize) || declaredSize <= 0)) {
    return json(res, 400, { ok: false, error: "Tamanho do ZIP não informado." });
  }
  if (!body?.probe && declaredSize > BUCKET_MAX_BYTES) {
    return json(res, 413, {
      ok: false,
      error: `ZIP maior que o limite permitido de ${Math.round(BUCKET_MAX_BYTES / 1024 / 1024)} MB.`,
      maxBytes: BUCKET_MAX_BYTES
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const bucketState = await ensureBucketReady(supabase, bucket);
    if (!bucketState.ok) {
      return json(res, 500, {
        ok: false,
        error: `Não foi possível preparar o armazenamento “${bucket}”.`,
        details: `${bucketState.step}: ${bucketState.error}`,
        bucket
      });
    }

    if (body && body.probe) {
      return json(res, 200, { ok: true, bucket, bucketState });
    }

    // Caminho idempotente: retries da mesma importação usam o mesmo objeto, sem criar cópias.
    // organizationId no caminho isola o arquivo de cada conta dentro do mesmo bucket
    // compartilhado — sem isso, qualquer corretor com um importId adivinhado conseguiria
    // baixar/sobrescrever o ZIP de outra conta.
    const storagePathUpload = `whatsapp/organizations/${organizationId}/imports/${importId}/${fileName}`;

    const { data: signed, error: signedError } = await supabase
      .storage
      .from(bucket)
      .createSignedUploadUrl(storagePathUpload, { upsert: true });

    if (signedError || !signed?.signedUrl) {
      return json(res, 500, {
        ok: false,
        error: "Não foi possível gerar a URL de upload no Supabase Storage.",
        details: errorMessage(signedError || "createSignedUploadUrl não retornou signedUrl."),
        bucket,
        bucketWarning: bucketState.warning || null
      });
    }

    return json(res, 200, {
      ok: true,
      bucket,
      path: storagePathUpload,
      token: signed.token,
      signedUrl: signed.signedUrl,
      importId,
      bucketWarning: bucketState.warning || undefined
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: "Não foi possível preparar o upload grande.",
      details: errorMessage(error),
      bucket
    });
  }
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

// organizationId no caminho garante que o cache de transcrição de uma conta nunca seja lido
// (nem apagado) por outra — antes disso era uma pasta única global no bucket.
function caminhoCacheTranscricao(hash, organizationId) {
  return `organizations/${organizationId}/transcription-cache/${String(hash || "").slice(0, 2)}/${hash}.json`;
}

async function carregarTranscricaoCache(storage, hash, organizationId) {
  if (!hash || !organizationId) return null;
  const item = await carregarManifesto(storage, caminhoCacheTranscricao(hash, organizationId));
  return item?.text ? { status: "transcrito_reaproveitado", text: String(item.text), reused: true, hash } : null;
}

async function salvarTranscricaoCache(storage, hash, item, organizationId) {
  if (!hash || !item?.text || !organizationId) return;
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    hash,
    text: String(item.text),
    createdAt: new Date().toISOString()
  }), "utf8");
  const { error } = await storage.upload(caminhoCacheTranscricao(hash, organizationId), payload, {
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

// v1026 — "0 aproveitados" voltava a acontecer num lead recorrente MESMO com este reaproveitamento
// por nome de arquivo já existente (v954): na 1ª reimportação que reaproveitava com sucesso, o
// áudio reaproveitado virava status "transcrito_reaproveitado" na timeline (não mais "transcrito")
// — e esta função só aceitava o status "transcrito" exato. Resultado: a partir da 2ª reimportação
// de um mesmo lead recorrente, todo áudio já tinha virado "transcrito_reaproveitado" e nenhum era
// mais reconhecido como reaproveitável, mesmo com o texto certinho disponível na conversa. O que
// importa é ter o TEXTO transcrito de verdade (o prefixo abaixo já garante isso) — não por qual
// dos dois status ele chegou até aqui.
const AUDIO_STATUS_COM_TEXTO_REAL = new Set(["transcrito", "transcrito_reaproveitado"]);
export function transcricoesDoLeadAnterior(timelineJson) {
  const mapa = {};
  for (const m of (Array.isArray(timelineJson) ? timelineJson : [])) {
    if (!m || m.type !== "audio" || !AUDIO_STATUS_COM_TEXTO_REAL.has(m.audioStatus)) continue;
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

export async function prepararExtracaoPersistente({ storage, storagePath, importId, audioWindowDays, cacheDoLead = {}, organizationId }) {
  if (!organizationId) throw new Error("organizationId é obrigatório para preparar a extração.");
  // organizationId no prefixo isola manifesto e áudios extraídos de cada conta no bucket
  // compartilhado — sem isso, uma conta conseguiria ler/sobrescrever dados de outra só
  // adivinhando (ou reaproveitando) um importId.
  const prefix = `organizations/${organizationId}/imports/${importId}`;
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
  const prep = await prepararConversaDoZip(buffer, { audioWindowDays, includeExtractedFiles: true, organizationId }); // única extração
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
      const cached = await carregarTranscricaoCache(storage, hash, organizationId);
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
  const organizationId = await resolveOrganizationId(req, res);
  if (!organizationId) return;
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

  // v1039 — /api/criar-upload-url foi absorvida por esta rota (ver comentário perto de
  // criarUploadUrl acima). O corpo dela NUNCA tem "action" — é o único jeito seguro de
  // reconhecer essa chamada aqui, já que ela chega com o mesmo método (POST) e o mesmo body
  // JSON de sempre, sem nenhuma mudança no app.
  if (body && typeof body === "object" && !body.action) {
    return criarUploadUrl(req, res, organizationId, body);
  }

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
    const prefixoEsperado = `whatsapp/organizations/${organizationId}/imports/${importId}/`;
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
      // v1086 — se a leitura da conversa já salva falhar, o cache de áudio vem vazio e TODOS os
      // áudios são transcritos de novo (importação lenta e cara). Isso não pode passar batido:
      // a falha vai registrada na resposta, pra aparecer no diagnóstico em vez de virar só
      // "essa importação demorou muito hoje".
      let avisoCacheAudio = null;
      const matchAnterior = await _buscarProcessamentoExistenteV681(supabase, { result: {}, fileName: nomeArquivoZip, path: storagePath, organizationId })
        .catch((e) => { avisoCacheAudio = e?.message || String(e); return null; });
      const cacheDoLead = matchAnterior?.row ? transcricoesDoLeadAnterior(matchAnterior.row.timeline_json) : {};
      const { manifest, reusedPreparation } = await prepararExtracaoPersistente({ storage, storagePath, importId, audioWindowDays: body?.audioWindowDays, cacheDoLead, organizationId });
      return json(res, 200, {
        ok: true, bucket, path: storagePath, importId, manifestPath: `organizations/${organizationId}/imports/${importId}/manifest.json`,
        reusedPreparation, extractionCompleted: true, ...manifest.prep,
        ...(avisoCacheAudio ? { avisoCacheAudio } : {}),
        audioStorage: manifest.audioStorage,
        cachedTranscriptions: manifest.transcriptions || {}
      });
    }

    if (action === "transcrever") {
      const audioNames = Array.isArray(body?.audioNames) ? body.audioNames.map(normalizeName) : [];
      if (!audioNames.length) return json(res, 200, { ok: true, transcriptions: {} });
      if (!importId) return json(res, 400, { ok: false, error: "Identificador de importação ausente ou inválido." });
      const manifestPath = `organizations/${organizationId}/imports/${importId}/manifest.json`;
      const manifest = await carregarManifesto(storage, manifestPath);
      if (!manifest?.audioStorage) return json(res, 409, { ok: false, error: "A extração desta importação não foi encontrada. Tente preparar novamente sem reenviar o ZIP." });
      const existentes = manifest.transcriptions && typeof manifest.transcriptions === "object" ? { ...manifest.transcriptions } : {};
      const arquivos = [];
      for (const nome of audioNames) {
        if (existentes[nome]?.text) continue;
        const hash = manifest?.audioHashes?.[nome];
        const cached = await carregarTranscricaoCache(storage, hash, organizationId);
        if (cached) {
          existentes[nome] = cached;
          continue;
        }
        const audioPath = manifest.audioStorage[nome];
        if (!audioPath) continue;
        arquivos.push({ name: nome, buffer: await baixarBuffer(storage, audioPath) });
      }
      const lote = arquivos.length
        ? await transcreverArquivosExtraidos(arquivos, organizationId)
        : { transcriptions: {}, transcriptionEnabled: true };
      Object.assign(existentes, lote.transcriptions || {});
      for (const [nome, item] of Object.entries(lote.transcriptions || {})) {
        if (item?.text) await salvarTranscricaoCache(storage, manifest?.audioHashes?.[nome], item, organizationId);
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
        const { data: anterior, error: anteriorError } = await supabase.from("whatsapp_processamentos").select("timeline_json").eq("id", existingLeadId).eq("organization_id", organizationId).maybeSingle();
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
        cerebroConfig: body?.cerebroConfig || null,
        organizationId
      });
      const analysis = result?.analysis || null;
      const manifestPath = importId ? `organizations/${organizationId}/imports/${importId}/manifest.json` : "";
      const manifest = importId ? await carregarManifesto(storage, manifestPath) : null;
      if (analysis && typeof analysis === "object") {
        const cachePaths = [...new Set(Object.values(manifest?.audioHashes || {}).filter(Boolean).map(hash => caminhoCacheTranscricao(hash, organizationId)))];
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
      const manifestPath = `organizations/${organizationId}/imports/${importId}/manifest.json`;
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
      // Escopada por organizationId — antes disso a varredura listava "imports/" (pasta global do
      // bucket) e uma conta podia disparar a limpeza de arquivos temporários de OUTRA conta.
      const limiteMs = 7 * 24 * 60 * 60 * 1000;
      const activeImportId = importIdSeguro(body?.activeImportId);
      const { data: dirs, error } = await storage.list(`organizations/${organizationId}/imports`, { limit: 100, sortBy: { column: "created_at", order: "asc" } });
      if (error) throw new Error(error.message);
      let removidas = 0;
      for (const dir of dirs || []) {
        const id = importIdSeguro(dir?.name);
        if (!id || id === activeImportId) continue;
        const manifestPath = `organizations/${organizationId}/imports/${id}/manifest.json`;
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
        const manifestPath = `organizations/${organizationId}/imports/${importId}/manifest.json`;
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
