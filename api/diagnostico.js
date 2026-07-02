import { requireApiKey } from "./_persistence.js";
// Endpoint de bastidor consolidado. Faz 3 trabalhos via ?mode=:
//   ?mode=status (padrão) → checa variáveis de ambiente (OpenAI + Supabase)
//   ?mode=openai          → testa a chave OpenAI de verdade (models.list + chat)
//   ?mode=bucket          → configura o bucket do Supabase Storage p/ ZIPs grandes
// Unifica os antigos api/status.js, api/diagnostico-openai.js e api/configurar-bucket.js
// (economiza vagas de Serverless Function no plano Hobby da Vercel).
import { createClient } from "@supabase/supabase-js";
import { getOpenAIRaw, getOpenAIConfigSummary, describeOpenAIError } from "./_pipeline.js";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload, null, 2));
}

export default async function handler(req, res) {
  if (requireApiKey(req, res) !== true) return;
  const mode = String(req.query?.mode || "status").toLowerCase();
  if (mode === "openai") return modoOpenAI(res);
  if (mode === "bucket") return modoBucket(res);
  return modoStatus(res);
}

// ---------- mode=status (antigo api/status.js) ----------
function modoStatus(res) {
  const openai = getOpenAIConfigSummary();
  return json(res, 200, {
    ok: true,
    buildTime: new Date().toISOString(),
    env: {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: !!(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_ZIP_BUCKET: process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips",
      OPENAI_API_KEY: openai.configured,
      OPENAI_BASE_URL: openai.baseURL,
      OPENAI_HAS_CUSTOM_BASE: openai.baseURL !== "https://api.openai.com/v1",
      OPENAI_KEY_PREFIX: openai.keyPrefix,
      OPENAI_KEY_TAIL: openai.keyTail,
      OPENAI_ORG: openai.organization,
      OPENAI_PROJECT: openai.project,
      OPENAI_TRANSCRIPTION_MODEL: openai.transcriptionModel,
      DIRECIONA_MAIN_MODEL: openai.analysisModel,
      OPENAI_ANALYSIS_MODEL: openai.analysisModel,
      OPENAI_MESSAGES_MODEL: openai.messagesModel,
      OPENAI_VISION_MODEL: openai.visionModel,
      OPENAI_SIMPLE_MODEL: openai.simpleModel,
      OPENAI_ORQUESTRADOR_MODEL: openai.orchestratorModel,
      TEXT_PROVIDER: "OpenAI only",
      OPENAI_REASONING_EFFORT: process.env.OPENAI_REASONING_EFFORT || "high",
      HISTORICO_COMPLETO_POR_PADRAO: process.env.DIRECIONA_LIMITAR_HISTORICO !== "1",
      APRENDIZADO_AUTO_ATIVO: process.env.DIRECIONA_USAR_APRENDIZADO_AUTO === "1",
      CONHECIMENTO_AUTO_ATIVO: process.env.DIRECIONA_USAR_CONHECIMENTO_AUTO === "1",
      ESTILO_AUTO_ATIVO: process.env.DIRECIONA_USAR_ESTILO_AUTO === "1",
      ARQUITETURA_MENSAGENS: "gpt55-unificado-v2"
    }
  });
}

// ---------- mode=openai (antigo api/diagnostico-openai.js) ----------
async function timed(label, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    return { label, ok: true, ms: Date.now() - startedAt, result };
  } catch (error) {
    return {
      label,
      ok: false,
      ms: Date.now() - startedAt,
      error: describeOpenAIError(error),
      status: error?.status || error?.statusCode || error?.response?.status || null,
      code: error?.code || error?.error?.code || null,
      type: error?.type || error?.error?.type || null,
      headers: error?.headers || error?.response?.headers || null
    };
  }
}

async function modoOpenAI(res) {
  const summary = getOpenAIConfigSummary();
  const testes = [];

  if (summary.configured) {
    const oaRaw = getOpenAIRaw();
    testes.push(await timed("OpenAI · models.list (sanity da chave)", () => oaRaw.models.list()));
    // Testa EXATAMENTE como o pipeline real chama (Chat Completions), não a
    // Responses API — gpt-4.1 não aceita reasoning.effort e o teste antigo dava
    // falso negativo, escondendo o erro de verdade (saldo/limite/rate).
    testes.push(await timed(`OpenAI · análise e mensagens (${summary.analysisModel})`, () => oaRaw.chat.completions.create({
      model: summary.analysisModel,
      messages: [{ role: "user", content: "Responda apenas: ok" }],
      temperature: 0,
      max_tokens: 16
    })));
  } else {
    testes.push({ label: "OpenAI", ok: false, ms: 0, error: "OPENAI_API_KEY ausente no servidor.", status: null, code: null, type: null });
  }

  const allOk = testes.every(t => t.ok);
  const algumaIaOk = testes.some(t => t.ok);
  const primeiroErro = testes.find(t => !t.ok);

  return json(res, algumaIaOk ? 200 : 500, {
    ok: allOk,
    analiseFunciona: algumaIaOk,
    config: summary,
    primeiroErro: primeiroErro
      ? {
          etapa: primeiroErro.label,
          mensagem: primeiroErro.error,
          status: primeiroErro.status,
          code: primeiroErro.code,
          type: primeiroErro.type,
          dica: dicaPorErro(primeiroErro)
        }
      : null,
    testes: testes.map(t => ({
      etapa: t.label,
      ok: t.ok,
      ms: t.ms,
      status: t.status || null,
      code: t.code || null,
      type: t.type || null,
      error: t.error || null,
      hint: t.ok ? null : dicaPorErro(t)
    }))
  });
}

function dicaPorErro(teste) {
  const msg = String(teste?.error || "").toLowerCase();
  if (msg.includes("allowlist") || msg.includes("host not in") || msg.includes("ip ")) {
    return "A chave/conta OpenAI tem restrição de IP/host. Soluções: (1) configurar OPENAI_BASE_URL apontando para um proxy com IP permitido (ex.: Cloudflare AI Gateway); (2) editar a allowlist da chave em platform.openai.com → API keys → Edit; (3) abrir suporte na OpenAI pedindo remoção da restrição.";
  }
  if (msg.includes("invalid api key") || msg.includes("incorrect api key") || teste.status === 401) {
    return "Chave inválida ou revogada. Verifique OPENAI_API_KEY no painel da Vercel.";
  }
  if (msg.includes("quota") || msg.includes("billing") || teste.code === "insufficient_quota") {
    return "Sem saldo / quota esgotada na conta OpenAI. Adicione crédito em platform.openai.com → Billing.";
  }
  if (teste.status === 429) {
    return "Rate limit. Espere 1-2 minutos e tente de novo, ou suba o tier da conta.";
  }
  if (teste.status >= 500) {
    return "Erro do lado da OpenAI. Tente novamente em alguns minutos.";
  }
  if (msg.includes("country") || msg.includes("region")) {
    return "Região do servidor não suportada pela OpenAI. Use OPENAI_BASE_URL com proxy em região aceita.";
  }
  return "Verifique o erro exato acima na documentação da OpenAI.";
}

// ---------- mode=bucket (antigo api/configurar-bucket.js) ----------
async function modoBucket(res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips";
  const targetLimitBytes = Number(process.env.SUPABASE_ZIP_MAX_BYTES) || 2147483648;

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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let before = null;
  try {
    const { data, error } = await supabase.storage.getBucket(bucket);
    before = error ? { error: error.message } : data;
  } catch (e) {
    before = { error: e?.message || String(e) };
  }

  let updateError = null;
  try {
    const { error } = await supabase.storage.updateBucket(bucket, {
      public: false,
      fileSizeLimit: targetLimitBytes,
      allowedMimeTypes: null
    });
    if (error) updateError = error.message;
  } catch (e) {
    updateError = e?.message || String(e);
  }

  let after = null;
  try {
    const { data, error } = await supabase.storage.getBucket(bucket);
    after = error ? { error: error.message } : data;
  } catch (e) {
    after = { error: e?.message || String(e) };
  }

  const targetLimitMb = Math.round(targetLimitBytes / 1024 / 1024);
  const acceptedMb = after?.file_size_limit ? Math.round(after.file_size_limit / 1024 / 1024) : null;

  return json(res, updateError ? 500 : 200, {
    ok: !updateError,
    bucket,
    targetLimitBytes,
    targetLimitMb,
    acceptedLimitMb: acceptedMb,
    updateError,
    before,
    after,
    hint: updateError
      ? "Se a mensagem mencionar 'limit' ou 'plan', o plano do Supabase precisa ser maior para aceitar arquivos desse tamanho. Verifique em Project Settings → Subscription."
      : `Bucket configurado para aceitar até ${targetLimitMb} MB e qualquer tipo de arquivo.`
  });
}
