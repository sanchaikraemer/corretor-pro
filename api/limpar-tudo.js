import { requireApiKey } from "./_persistence.js";
import { createClient } from "@supabase/supabase-js";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload, null, 2));
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

async function tableCount(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  return { count, error };
}

async function deleteAllRows(supabase, table) {
  const beforeResult = await tableCount(supabase, table);
  // Se o count deu erro com codigo de tabela inexistente, marca como nao existe.
  if (beforeResult.error) {
    const msg = beforeResult.error.message || "";
    const tableMissing = /relation .* does not exist|not find the table|schema cache/i.test(msg);
    if (tableMissing) {
      return { table, ok: true, exists: false, before: 0, after: 0, deleted: 0, note: msg };
    }
    return { table, ok: false, exists: true, before: null, after: null, deleted: 0, countError: msg };
  }

  const before = beforeResult.count || 0;
  const attempts = [];

  // Tenta varias estrategias sempre. Mesmo que before=0, tenta — pode ser
  // count bloqueado por RLS mas delete liberado, ou vice-versa.
  const strategies = [
    { how: "gte uuid zero", run: () => supabase.from(table).delete().gte("id", "00000000-0000-0000-0000-000000000000") },
    { how: "not id is null", run: () => supabase.from(table).delete().not("id", "is", null) },
    { how: "neq uuid max", run: () => supabase.from(table).delete().neq("id", "ffffffff-ffff-ffff-ffff-ffffffffffff") }
  ];

  for (const s of strategies) {
    const { error } = await s.run();
    attempts.push({ how: s.how, error: error?.message || null });
    if (error) continue;
    // Conferir se ainda sobrou — se zerou, podemos parar.
    const check = await tableCount(supabase, table);
    if ((check.count || 0) === 0 && !check.error) break;
  }

  const afterResult = await tableCount(supabase, table);
  const after = afterResult.count || 0;

  return {
    table,
    ok: after === 0,
    exists: true,
    before,
    after,
    deleted: Math.max(0, before - after),
    attempts: attempts.filter(a => a.error || attempts.every(x => x.error)) // mostra falhas; se todas falharam mostra todas
  };
}

async function emptyBucket(supabase, bucket) {
  const todos = [];
  async function listFolder(prefix) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) return { error: error.message };
    for (const item of data || []) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) {
        todos.push(fullPath);
      } else {
        // É pasta — desce.
        const sub = await listFolder(fullPath);
        if (sub?.error) return sub;
      }
    }
    return { ok: true };
  }
  const walk = await listFolder("");
  if (walk?.error) return { ok: false, error: walk.error, deleted: 0 };
  if (!todos.length) return { ok: true, deleted: 0 };
  const { data, error } = await supabase.storage.from(bucket).remove(todos);
  if (error) return { ok: false, error: error.message, deleted: 0 };
  return { ok: true, deleted: (data || []).length };
}

function inspectKey(raw) {
  if (!raw) return { presente: false };
  const original = String(raw);
  // Limpa aspas, espacos, "Bearer ", newlines — defeitos comuns de copy/paste.
  const cleaned = original
    .replace(/^Bearer\s+/i, "")
    .replace(/^[\s'"`]+|[\s'"`]+$/g, "")
    .replace(/[\r\n]/g, "");
  const tinha = {
    aspas: /^["'`]|["'`]$/.test(original.trim()),
    espacoExtra: original !== original.trim(),
    quebraLinha: /[\r\n]/.test(original),
    prefixoBearer: /^Bearer\s+/i.test(original)
  };

  // Formato novo do Supabase: sb_secret_* (admin) e sb_publishable_* (publico).
  const ehFormatoNovoSecret = /^sb_secret_/.test(cleaned);
  const ehFormatoNovoPublishable = /^sb_publishable_/.test(cleaned);
  const ehFormatoNovo = ehFormatoNovoSecret || ehFormatoNovoPublishable;

  // Formato antigo: JWT com 3 partes separadas por ponto.
  const parts = cleaned.split(".");
  const ehJwt = parts.length === 3 && /^eyJ/.test(parts[0]);

  let role = null;
  let payloadOk = false;
  let payloadError = null;
  if (ehJwt) {
    try {
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
      const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
      role = payload?.role || null;
      payloadOk = true;
    } catch (e) {
      payloadError = e.message;
    }
  } else if (ehFormatoNovoSecret) {
    role = "service_role"; // chaves sb_secret_* tem privilegio de admin.
    payloadOk = true;
  } else if (ehFormatoNovoPublishable) {
    role = "anon"; // chaves sb_publishable_* sao equivalentes a anon.
    payloadOk = true;
  }

  return {
    presente: true,
    tamanhoOriginal: original.length,
    tamanhoLimpo: cleaned.length,
    prefixo: cleaned.slice(0, 12),
    sufixo: cleaned.slice(-6),
    formato: ehJwt ? "jwt-antigo" : ehFormatoNovoSecret ? "sb_secret (novo)" : ehFormatoNovoPublishable ? "sb_publishable (novo)" : "desconhecido",
    formatoValido: ehJwt || ehFormatoNovo,
    pareceJwt: ehJwt,
    payloadOk,
    payloadError,
    role,
    ehServiceRole: role === "service_role",
    defeitosEncontrados: tinha
  };
}

export default async function handler(req, res) {
  if (requireApiKey(req, res) !== true) return;
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Use POST para limpar tudo." });
  }

  // Rota destrutiva desativada por padrão. Requer variável de ambiente explícita no servidor.
  if (process.env.DIRECIONA_DANGER_LIMPAR_TUDO !== "ativo") {
    return json(res, 403, { ok: false, error: "Rota desativada. Defina DIRECIONA_DANGER_LIMPAR_TUDO=ativo no ambiente para habilitar." });
  }

  const body = await readJsonBody(req).catch(() => ({}));
  if (body?.confirm !== "APAGAR TUDO") {
    return json(res, 400, {
      ok: false,
      error: 'Confirmação inválida. Envie { "confirm": "APAGAR TUDO" } para confirmar.'
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips";

  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, { ok: false, error: "Supabase nao configurado." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const tabelas = [];
  for (const t of ["whatsapp_processamentos", "leads", "direciona_leads"]) {
    tabelas.push(await deleteAllRows(supabase, t));
  }

  let storage = null;
  if (body.includeStorage !== false) {
    storage = await emptyBucket(supabase, bucket);
    storage.bucket = bucket;
  }

  const totalLinhas = tabelas.reduce((acc, t) => acc + (t.deleted || 0), 0);
  const algumDeleteFalhou = tabelas.some(t => t.exists !== false && t.ok === false);
  const chave = inspectKey(serviceRoleKey);

  let dica = null;
  if (!chave.formatoValido) {
    dica = "A SUPABASE_SERVICE_ROLE_KEY no Vercel não é nem JWT antigo nem chave nova (sb_secret_/sb_publishable_). Provavelmente está corrompida. Vá em Supabase → Project Settings → API e cole de novo a chave secreta.";
  } else if (chave.role && chave.role !== "service_role") {
    dica = `A chave configurada no Vercel é do tipo "${chave.role}", não admin. Por isso o delete é bloqueado por RLS. Vá em Supabase → Project Settings → API, copie a chave secreta (sb_secret_... ou service_role JWT) e troque a env var SUPABASE_SERVICE_ROLE_KEY no Vercel.`;
  } else if (chave.defeitosEncontrados && Object.values(chave.defeitosEncontrados).some(Boolean)) {
    dica = `A chave foi colada com defeito no Vercel: ${Object.entries(chave.defeitosEncontrados).filter(([,v])=>v).map(([k])=>k).join(", ")}. Vá no Vercel → Settings → Environment Variables, edita SUPABASE_SERVICE_ROLE_KEY e cola a chave novamente, sem aspas, sem espaços, sem quebra de linha.`;
  } else if (algumDeleteFalhou) {
    dica = "A chave parece OK e é service_role, mas o delete não funcionou mesmo assim. Isso pode ser RLS sem policy de DELETE. No Supabase → SQL Editor rode: alter table whatsapp_processamentos disable row level security;";
  }

  return json(res, algumDeleteFalhou ? 500 : 200, {
    ok: !algumDeleteFalhou,
    resumo: {
      linhasApagadas: totalLinhas,
      arquivosApagados: storage?.deleted ?? 0
    },
    chave,
    dica,
    tabelas,
    storage
  });
}
