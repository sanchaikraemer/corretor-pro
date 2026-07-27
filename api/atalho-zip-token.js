// Gera (ou mostra de novo) a chave pessoal que o corretor cola dentro do Atalho (Shortcuts) do
// iPhone, pra mandar o ZIP exportado do WhatsApp direto pro Corretor Pro pelo botão Compartilhar
// — sem precisar do App Store nem de conta de desenvolvedor Apple (ver NOTAS-v1035.md).
//
// GET (ou {action:"mostrar"}): recalcula a chave a partir do issuedAt já salvo (se existir).
// POST {action:"gerar"}: cria um issuedAt novo — isso invalida sozinho qualquer chave anterior.
import { resolveOrganizationId, getSupabaseAdmin, montarAtalhoZipToken, ATALHO_ZIP_TOKEN_CHAVE } from "./_persistence.js";
import { upsertConfigComOrganizacao } from "./_pipeline.js";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function issuedAtSalvo(supabase, organizationId) {
  const { data, error } = await supabase
    .from("direciona_config")
    .select("valor")
    .eq("chave", ATALHO_ZIP_TOKEN_CHAVE)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return null;
  return data?.valor?.issuedAt ? String(data.valor.issuedAt) : null;
}

export default async function handler(req, res) {
  const organizationId = await resolveOrganizationId(req, res);
  if (!organizationId) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const action = req.method === "GET" ? "mostrar" : (req.body?.action || "mostrar");

  if (action === "gerar") {
    const issuedAt = String(Date.now());
    const { error } = await upsertConfigComOrganizacao(supabase, organizationId, {
      chave: ATALHO_ZIP_TOKEN_CHAVE, valor: { issuedAt }, atualizado_em: new Date().toISOString()
    }) || {};
    if (error) return json(res, 500, { ok: false, error: error.message || "Não foi possível gerar a chave." });
    const token = montarAtalhoZipToken(organizationId, issuedAt);
    if (!token) return json(res, 500, { ok: false, error: "O envio pelo Atalho ainda não foi configurado neste servidor (falta ATALHO_ZIP_TOKEN_SECRET)." });
    return json(res, 200, { ok: true, token, geradaEm: issuedAt });
  }

  // "mostrar": só recalcula se já existir uma chave gerada antes — nunca cria uma nova sozinho.
  const issuedAt = await issuedAtSalvo(supabase, organizationId);
  if (!issuedAt) return json(res, 200, { ok: true, token: null });
  const token = montarAtalhoZipToken(organizationId, issuedAt);
  if (!token) return json(res, 500, { ok: false, error: "O envio pelo Atalho ainda não foi configurado neste servidor (falta ATALHO_ZIP_TOKEN_SECRET)." });
  return json(res, 200, { ok: true, token, geradaEm: issuedAt });
}
