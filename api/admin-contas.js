// Painel de administrador (v980) — a peça que faltava mesmo no LeveCRM (o próprio código
// de lá admite que essa parte "ficou fora do HTML de propósito, por segurança" e que o
// certo era "uma rota administrativa"). É exatamente isso que esta rota é: gestão de
// contas fica só aqui no servidor, nunca com o navegador tendo poder de alterar direto.
import { requireApiKey, getSupabaseAdmin } from "./_persistence.js";
import { requireAccount } from "./_auth.js";

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

function isoDaquiAdiasDias(dias) {
  const n = Number(dias);
  const validos = Number.isFinite(n) && n > 0 ? n : 30;
  return new Date(Date.now() + validos * 24 * 60 * 60 * 1000).toISOString();
}

export default async function handler(req, res) {
  if (requireApiKey(req, res) !== true) return;
  const conta = await requireAccount(req, res);
  if (!conta) return;
  if (!conta.isAdmin) return json(res, 403, { ok: false, error: "Só o administrador acessa esta área." });

  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const action = req.method === "GET"
    ? String(req.query?.action || "listar")
    : String((await readJsonBody(req).catch(() => ({})))?.action || "listar");

  if (req.method === "GET" || action === "listar") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,nome,email,account_status,trial_end,license_end,criado_em")
      .order("criado_em", { ascending: false });
    if (error) return json(res, 500, { ok: false, error: error.message });
    const agora = Date.now();
    const contas = (data || []).map(p => {
      const trialEnd = p.trial_end ? Date.parse(p.trial_end) : NaN;
      const licenseEnd = p.license_end ? Date.parse(p.license_end) : NaN;
      let situacao = "expirado";
      if (p.account_status === "blocked") situacao = "bloqueado";
      else if (Number.isFinite(licenseEnd) && licenseEnd >= agora) situacao = "licenca_ativa";
      else if (Number.isFinite(trialEnd) && trialEnd >= agora) situacao = "teste_ativo";
      return { ...p, situacao };
    });
    return json(res, 200, { ok: true, contas });
  }

  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Use GET ou POST." });
  const body = await readJsonBody(req).catch(() => ({}));
  const userId = String(body?.userId || "").trim();
  if (!userId) return json(res, 400, { ok: false, error: "Informe userId." });
  if (userId === conta.userId) return json(res, 400, { ok: false, error: "Você já é o administrador — nada para liberar/bloquear na própria conta." });

  if (action === "liberar") {
    const licenseEnd = isoDaquiAdiasDias(body?.dias);
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: "active", license_end: licenseEnd, atualizado_em: new Date().toISOString() })
      .eq("id", userId);
    if (error) return json(res, 500, { ok: false, error: error.message });
    return json(res, 200, { ok: true, licenseEnd });
  }

  if (action === "bloquear") {
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: "blocked", atualizado_em: new Date().toISOString() })
      .eq("id", userId);
    if (error) return json(res, 500, { ok: false, error: error.message });
    return json(res, 200, { ok: true });
  }

  if (action === "reativar") {
    // Tira do bloqueio sem necessariamente conceder licença — volta ao que o trial/licença
    // já indicavam antes de bloquear (o próprio accessPlanMessage decide se ainda vale).
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: "trial", atualizado_em: new Date().toISOString() })
      .eq("id", userId);
    if (error) return json(res, 500, { ok: false, error: error.message });
    return json(res, 200, { ok: true });
  }

  return json(res, 400, { ok: false, error: "Ação inválida. Use listar, liberar, bloquear ou reativar." });
}
