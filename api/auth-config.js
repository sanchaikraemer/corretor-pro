// Entrega ao navegador só o que ele PRECISA pra montar o cliente de login: o endereço do
// Supabase e a chave "anon". Essa chave é pública por design (o próprio Supabase exige que
// ela viaje pro navegador) — quem protege os dados de verdade são as regras RLS no banco,
// não o sigilo desta chave. Ainda assim pede a mesma senha de segurança de todas as outras
// rotas (nesta fase, com cadastro só entre pessoas convidadas por você, não há motivo pra
// abrir exceção — quando existir cadastro público de verdade, esta rota é a candidata a virar
// pública).
import { requireApiKey } from "./_persistence.js";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (requireApiKey(req, res) !== true) return;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !anonKey) {
    return json(res, 200, { ok: false, configured: false, error: "Login por conta ainda não configurado no servidor." });
  }
  return json(res, 200, { ok: true, configured: true, supabaseUrl, supabaseAnonKey: anonKey });
}
