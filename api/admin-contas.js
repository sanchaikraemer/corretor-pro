// Rota do painel administrativo da PLATAFORMA (só o dono do produto usa): excluir uma conta
// de corretor inteira — dados, vínculos, organização e login. Criada porque o painel só sabia
// marcar pago/bloquear/estender; excluir conta de teste exigia SQL na mão.
import { resolveOrganizationId, getSupabaseAdmin, EMPRESA_PRINCIPAL_ID } from "./_persistence.js";
import { invalidarMemoriaComercialCache } from "./_pipeline.js";

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

export default async function handler(req, res) {
  // Valida o login de quem chama (e a conta dele estar em dia). O id resolvido aqui NÃO é o
  // alvo da exclusão — o alvo vem do corpo, e só depois da checagem de administrador abaixo.
  const organizationId = await resolveOrganizationId(req, res);
  if (!organizationId) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Use POST." });

  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  // Só o administrador da plataforma (tabela platform_admins) pode excluir contas — um dono
  // comum, mesmo logado, não pode. Exige o login novo (token), nunca só a chave compartilhada.
  const bearer = /^Bearer\s+(.+)$/i.exec(String(req.headers?.authorization || "").trim())?.[1];
  if (!bearer) return json(res, 403, { ok: false, error: "Entre com seu login de administrador pra usar o painel." });
  const { data: u } = await supabase.auth.getUser(bearer);
  const adminUserId = u?.user?.id || "";
  const { data: souAdmin } = await supabase.from("platform_admins").select("user_id").eq("user_id", adminUserId).maybeSingle();
  if (!souAdmin?.user_id) return json(res, 403, { ok: false, error: "Esta conta não é administradora da plataforma." });

  const body = await readJsonBody(req).catch(() => ({}));
  if (body?.action !== "excluir-conta") return json(res, 400, { ok: false, error: "Informe action excluir-conta." });
  const alvo = String(body?.organizationId || "").trim();
  if (!alvo) return json(res, 400, { ok: false, error: "Informe qual conta excluir." });
  if (alvo === EMPRESA_PRINCIPAL_ID) {
    return json(res, 400, { ok: false, error: "A conta original (com os seus dados) não pode ser excluída por aqui." });
  }

  const { data: org, error: orgErr } = await supabase.from("organizations").select("id,nome").eq("id", alvo).maybeSingle();
  if (orgErr) return json(res, 500, { ok: false, error: orgErr.message });
  if (!org) return json(res, 404, { ok: false, error: "Conta não encontrada (talvez já excluída)." });

  const { data: membros } = await supabase.from("memberships").select("user_id").eq("organization_id", alvo);
  const userIds = [...new Set((membros || []).map(m => String(m.user_id)).filter(Boolean))];

  const apagarDaConta = async (tabela) => {
    const r = await supabase.from(tabela).delete().eq("organization_id", alvo);
    if (r.error && !/does not exist|not find the table|schema cache/i.test(r.error.message || "")) {
      throw new Error(`${tabela}: ${r.error.message}`);
    }
  };

  try {
    await apagarDaConta("whatsapp_processamentos");
    await apagarDaConta("direciona_config");
    await apagarDaConta("memberships");
    const rOrg = await supabase.from("organizations").delete().eq("id", alvo);
    if (rOrg.error) throw new Error(`organizations: ${rOrg.error.message}`);
    invalidarMemoriaComercialCache(alvo);

    // Apaga também o LOGIN de cada pessoa da conta — a menos que ele sirva outra conta
    // (vínculo restante) ou seja administrador da plataforma (nunca se auto-apaga por engano).
    let loginsApagados = 0;
    for (const uid of userIds) {
      const { data: outros } = await supabase.from("memberships").select("id").eq("user_id", uid).limit(1);
      if (Array.isArray(outros) && outros.length) continue;
      const { data: ehAdm } = await supabase.from("platform_admins").select("user_id").eq("user_id", uid).maybeSingle();
      if (ehAdm?.user_id) continue;
      const r = await supabase.auth.admin.deleteUser(uid);
      if (!r?.error) loginsApagados++;
    }

    return json(res, 200, { ok: true, conta: org.nome, loginsApagados });
  } catch (e) {
    return json(res, 500, { ok: false, error: `A exclusão não foi concluída: ${e?.message || String(e)}` });
  }
}
