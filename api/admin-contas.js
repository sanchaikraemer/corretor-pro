// Rota do painel administrativo da PLATAFORMA (só o dono do produto usa): excluir uma conta
// de corretor inteira — dados, vínculos, organização, arquivos e login. Criada porque o painel
// só sabia marcar pago/bloquear/estender; excluir conta de teste exigia SQL na mão.
import { resolveOrganizationId, getSupabaseAdmin, EMPRESA_PRINCIPAL_ID, requirePlatformAdmin } from "./_persistence.js";
import { invalidarMemoriaComercialCache } from "./_pipeline.js";
import { emptyBucket } from "./limpar-tudo.js";

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
  if (!(await requirePlatformAdmin(req, res, supabase))) return;

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

  // v1013 — as 4 tabelas (whatsapp_processamentos, direciona_config, memberships, organizations)
  // agora são apagadas dentro de UMA function do banco (migração 0007_excluir_organizacao_
  // transacional.sql), numa única transação: se qualquer uma falhar, TODAS são desfeitas — nunca
  // mais fica pra trás uma conta "meio excluída" (leads apagados mas Cérebro ainda existente,
  // organização órfã, painel informando erro depois de parte do dado já ter sido apagado).
  const { data: resultado, error: rpcErr } = await supabase.rpc("excluir_organizacao", { p_organization_id: alvo }).maybeSingle();
  if (rpcErr) {
    return json(res, 500, {
      ok: false,
      error: `A exclusão não foi concluída — nada foi apagado (transação revertida): ${rpcErr.message}`,
      dica: /function .* does not exist|schema cache/i.test(rpcErr.message || "")
        ? "Rode a migração supabase/migrations/0007_excluir_organizacao_transacional.sql no SQL Editor do Supabase antes de excluir contas."
        : undefined
    });
  }
  const userIds = [...new Set((resultado?.ids_usuarios || []).map(String).filter(Boolean))];
  invalidarMemoriaComercialCache(alvo);

  // Apaga os ARQUIVOS da conta no Storage (ZIPs, áudios extraídos, manifestos, cache de
  // transcrição) — antes disso a exclusão só apagava linhas do banco e os arquivos ficavam pra
  // sempre ocupando espaço. Só é possível fazer isso de forma segura (sem risco de apagar
  // arquivo de outra conta) porque os caminhos do Storage agora são isolados por organizationId.
  // Best-effort: se falhar, a conta já está excluída no banco (não reverte) — o erro fica visível
  // na resposta em vez de silenciosamente sumir.
  const bucket = process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips";
  const [zipStorage, dadosStorage] = await Promise.all([
    emptyBucket(supabase, bucket, `whatsapp/organizations/${alvo}`).catch(e => ({ ok: false, error: e?.message || String(e), deleted: 0 })),
    emptyBucket(supabase, bucket, `organizations/${alvo}`).catch(e => ({ ok: false, error: e?.message || String(e), deleted: 0 }))
  ]);
  const storageResultado = {
    ok: zipStorage.ok !== false && dadosStorage.ok !== false,
    arquivosApagados: (zipStorage.deleted || 0) + (dadosStorage.deleted || 0),
    erro: [zipStorage.error, dadosStorage.error].filter(Boolean).join(" | ") || undefined
  };

  // Apaga também o LOGIN de cada pessoa da conta — a menos que ele sirva outra conta (vínculo
  // restante) ou seja administrador da plataforma (nunca se auto-apaga por engano). Erros aqui
  // NÃO podem ser ignorados: antes disso, um erro do Supabase em auth.admin.deleteUser passava
  // batido (só não incrementava o contador) e a resposta ainda dizia ok:true, deixando o login
  // órfão existir enquanto o painel informava sucesso.
  let loginsApagados = 0;
  const loginsComErro = [];
  for (const uid of userIds) {
    try {
      const { data: outros } = await supabase.from("memberships").select("id").eq("user_id", uid).limit(1);
      if (Array.isArray(outros) && outros.length) continue;
      const { data: ehAdm } = await supabase.from("platform_admins").select("user_id").eq("user_id", uid).maybeSingle();
      if (ehAdm?.user_id) continue;
      const r = await supabase.auth.admin.deleteUser(uid);
      if (r?.error) { loginsComErro.push({ uid, erro: r.error.message }); continue; }
      loginsApagados++;
    } catch (e) {
      loginsComErro.push({ uid, erro: e?.message || String(e) });
    }
  }

  return json(res, 200, {
    ok: true,
    conta: resultado?.nome || org.nome,
    storage: storageResultado,
    loginsApagados,
    loginsComErro: loginsComErro.length ? loginsComErro : undefined,
    aviso: loginsComErro.length
      ? `${loginsComErro.length} login(s) não puderam ser removidos e continuam existindo — veja loginsComErro.`
      : (storageResultado.ok ? undefined : "Os dados da conta foram excluídos, mas alguns arquivos no Storage não puderam ser removidos — veja storage.erro.")
  });
}
