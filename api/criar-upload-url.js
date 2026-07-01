import { createClient } from "@supabase/supabase-js";

const BUCKET_MAX_BYTES = Number(process.env.SUPABASE_ZIP_MAX_BYTES) || 2147483648;

let bucketConfigured = false;

// Libera ZIP + vídeo/áudio (pra transcrição). null nem sempre limpa restrições antigas; lista explícita é mais confiável.
const BUCKET_OPTIONS = {
  public: false,
  fileSizeLimit: BUCKET_MAX_BYTES,
  allowedMimeTypes: [
    "application/zip", "application/x-zip-compressed", "application/octet-stream",
    "video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/3gpp", "video/x-m4v",
    "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/x-wav", "audio/aac", "audio/webm", "audio/opus"
  ]
};

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function bucketNaoExiste(msg = "") {
  return /not found|does not exist|no such bucket/i.test(String(msg));
}

// Garante que o bucket existe e aceita arquivos grandes.
// Se não existir (foi apagado ou nunca criado), cria na hora — assim o upload
// nunca falha por "bucket ausente" e o dono não precisa mexer no Supabase.
async function ensureBucketAcceptsLargeFiles(supabase, bucket) {
  if (bucketConfigured) return null;
  try {
    const { error: updateError } = await supabase.storage.updateBucket(bucket, BUCKET_OPTIONS);
    if (!updateError) { bucketConfigured = true; return null; }

    // Bucket provavelmente não existe ainda — tenta criar.
    const { error: createError } = await supabase.storage.createBucket(bucket, BUCKET_OPTIONS);
    if (!createError) { bucketConfigured = true; return null; }

    // Corrida: outro request criou primeiro. Considera resolvido.
    if (/already exists|resource already exists|duplicate/i.test(createError.message || "")) {
      bucketConfigured = true;
      return null;
    }

    return createError.message || updateError.message || null;
  } catch (e) {
    return e?.message || String(e);
  }
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
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Use POST para criar URL de upload." });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips";

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

  if (body && body.probe) {
    return json(res, 200, { ok: true, bucket });
  }

  const fileName = sanitizeFileName(body?.fileName);
  if (!/\.(zip|mp4|webm|mov|m4v|mkv|mp3|m4a|ogg|oga|opus|wav|aac)$/i.test(fileName)) {
    return json(res, 400, { ok: false, error: "Tipo de arquivo não suportado (envie ZIP do WhatsApp ou um vídeo/áudio)." });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const bucketConfigError = await ensureBucketAcceptsLargeFiles(supabase, bucket);

    const now = new Date();
    const storagePath = `whatsapp/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${Date.now()}-${fileName}`;

    let { data: signed, error: signedError } = await supabase
      .storage
      .from(bucket)
      .createSignedUploadUrl(storagePath, { upsert: true });

    // Se falhou porque o bucket sumiu, força a criação e tenta mais uma vez.
    if ((signedError || !signed?.signedUrl) && bucketNaoExiste(signedError?.message)) {
      bucketConfigured = false;
      await ensureBucketAcceptsLargeFiles(supabase, bucket);
      ({ data: signed, error: signedError } = await supabase
        .storage
        .from(bucket)
        .createSignedUploadUrl(storagePath, { upsert: true }));
    }

    if (signedError || !signed?.signedUrl) {
      return json(res, 500, {
        ok: false,
        error: "Não foi possível gerar a URL de upload no Supabase Storage.",
        details: signedError?.message || "createSignedUploadUrl não retornou signedUrl.",
        bucket,
        bucketConfigError
      });
    }

    return json(res, 200, {
      ok: true,
      bucket,
      path: storagePath,
      token: signed.token,
      signedUrl: signed.signedUrl,
      bucketConfigError: bucketConfigError || undefined
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: "Não foi possível preparar o upload grande.",
      details: error?.message || String(error)
    });
  }
}
