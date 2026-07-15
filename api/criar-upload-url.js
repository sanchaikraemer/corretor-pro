import { requireApiKey } from "./_persistence.js";
import { createClient } from "@supabase/supabase-js";

const BUCKET_MAX_BYTES = Number(process.env.SUPABASE_ZIP_MAX_BYTES) || 2147483648;
const ALLOWED_MIME_TYPES = [
  "application/zip", "application/x-zip-compressed", "application/octet-stream", "application/json",
  "video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/3gpp", "video/x-m4v",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/x-wav", "audio/aac", "audio/webm", "audio/opus"
];

let bucketConfigured = false;

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

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
    { public: false, fileSizeLimit: BUCKET_MAX_BYTES, allowedMimeTypes: ALLOWED_MIME_TYPES },
    { public: false, allowedMimeTypes: ALLOWED_MIME_TYPES },
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

  // A configuração de 2 GB pode ser recusada pelo plano do Supabase. Isso não deve
  // impedir arquivos pequenos de serem enviados; por isso a falha vira aviso.
  let warning = null;
  try {
    const { error } = await supabase.storage.updateBucket(bucket, {
      public: false,
      fileSizeLimit: BUCKET_MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES
    });
    if (error) warning = errorMessage(error);
  } catch (error) {
    warning = errorMessage(error);
  }

  bucketConfigured = true;
  return { ok: true, existed, configured: !warning, warning };
}


function sanitizeImportId(value = "") {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{7,120}$/.test(id) ? id : "";
}

function sanitizeFileName(name = "conversa-whatsapp.zip") {
  return String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "conversa-whatsapp.zip";
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
    return json(res, 405, { ok: false, error: "Use POST para criar URL de upload." });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = String(process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips").trim() || "whatsapp-zips";

  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, {
      ok: false,
      error: "Supabase ainda não configurado. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.",
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

  const fileName = sanitizeFileName(body?.fileName);
  const importId = sanitizeImportId(body?.importId);
  if (!body?.probe && !importId) {
    return json(res, 400, { ok: false, error: "Identificador da importação não informado." });
  }
  if (!/\.(zip|mp4|webm|mov|m4v|mkv|mp3|m4a|ogg|oga|opus|wav|aac)$/i.test(fileName)) {
    return json(res, 400, { ok: false, error: "Tipo de arquivo não suportado (envie ZIP do WhatsApp ou um vídeo/áudio)." });
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
    const storagePath = `whatsapp/imports/${importId}/${fileName}`;

    const { data: signed, error: signedError } = await supabase
      .storage
      .from(bucket)
      .createSignedUploadUrl(storagePath, { upsert: true });

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
      path: storagePath,
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
