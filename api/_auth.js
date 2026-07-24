// Contas individuais por corretor (v980). Este arquivo cuida de "quem está pedindo" —
// separado de _persistence.js, que cuida de "o que fazer com os dados". Duas perguntas
// diferentes: aqui é identidade e liberação de acesso; lá é leitura/escrita no banco.
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./_persistence.js";

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getAnonKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

export function authConfigured() {
  return !!(getSupabaseUrl() && getAnonKey());
}

// Cliente "anônimo" — o mesmo tipo de chave que o navegador usa, só serve pra validar o
// token de sessão que o navegador mandou. Nunca usar este cliente para ler/gravar dados de
// outra conta: para isso o admin usa getSupabaseAdmin() (chave de serviço) de _persistence.js,
// sempre filtrando por owner_id explicitamente.
function getSupabaseAnon() {
  const url = getSupabaseUrl();
  const key = getAnonKey();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header || "").trim());
  return match ? match[1].trim() : "";
}

// Regras de liberação de acesso — mesma lógica já validada no LeveCRM (accessPlanMessage),
// só que decidida aqui no servidor (o navegador pode mostrar a mesma mensagem, mas quem
// bloqueia de verdade é o backend; uma trava só na tela seria fácil de burlar).
export function avaliarStatusDaConta(profile) {
  const now = Date.now();
  const status = String(profile?.account_status || "trial").toLowerCase();
  const trialEnd = profile?.trial_end ? Date.parse(profile.trial_end) : NaN;
  const licenseEnd = profile?.license_end ? Date.parse(profile.license_end) : NaN;
  if (status === "blocked") return { ok: false, motivo: "Acesso bloqueado pelo administrador." };
  if (Number.isFinite(licenseEnd) && licenseEnd >= now) return { ok: true, tipo: "licenca" };
  if (Number.isFinite(trialEnd) && trialEnd >= now) return { ok: true, tipo: "teste" };
  return { ok: false, motivo: "Teste grátis expirado. Fale com o administrador para liberar o acesso." };
}

// Testes não sobem um Supabase de verdade — mesmo padrão já usado em requireApiKey
// (_persistence.js) para o mesmo problema. Sem isso, TODA rota que chama requireAccount
// exigiria mockar o Supabase Auth de ponta a ponta só para testar a regra de negócio.
function contaFalsaDeTeste() {
  return {
    ok: true,
    userId: "00000000-0000-4000-8000-000000000001",
    email: "teste@corretor-pro.local",
    isAdmin: true,
    profile: { account_status: "active" },
    acesso: { ok: true, tipo: "licenca" }
  };
}

// Confere o token enviado pelo navegador, busca o perfil (teste/licença/bloqueio) e devolve
// tudo que uma rota precisa saber sobre quem está chamando. Não lança erro — devolve ok:false
// com o motivo, pra cada rota decidir a mensagem/status HTTP como já faz com requireApiKey.
export async function autenticarConta(req) {
  if (process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test") return contaFalsaDeTeste();
  if (!authConfigured()) {
    return { ok: false, status: 500, error: "Login por conta ainda não configurado no servidor (faltam SUPABASE_URL/SUPABASE_ANON_KEY)." };
  }
  const token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "Sessão ausente. Entre na sua conta do Corretor Pro." };
  }
  const anon = getSupabaseAnon();
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { ok: false, status: 401, error: "Sessão inválida ou expirada. Entre novamente." };
  }
  const userId = data.user.id;
  const email = String(data.user.email || "").toLowerCase();

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, status: 500, error: "Banco de dados não configurado no servidor." };
  }
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,nome,email,account_status,trial_end,license_end")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    return { ok: false, status: 500, error: "Não foi possível conferir o status da conta: " + profileError.message };
  }
  if (!profile) {
    return { ok: false, status: 403, error: "Conta autenticada, mas o perfil ainda não foi criado. Tente novamente em instantes." };
  }

  const isAdmin = String(process.env.CORRETOR_PRO_ADMIN_EMAIL || "sanchaikraemer3@gmail.com").toLowerCase() === email;
  const acesso = avaliarStatusDaConta(profile);
  if (!acesso.ok && !isAdmin) {
    return { ok: false, status: 402, error: acesso.motivo };
  }

  return { ok: true, userId, email, isAdmin, profile, acesso };
}

// Uso nas rotas: `const conta = await requireAccount(req, res); if (!conta) return;`
// Já escreve a resposta de erro (401/402/403/500) quando falha, igual requireApiKey faz.
export async function requireAccount(req, res) {
  const resultado = await autenticarConta(req);
  if (resultado.ok) return resultado;
  res.status(resultado.status || 401).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ ok: false, error: resultado.error, accountError: true }));
  return null;
}

// Portão único: confere se UM registro específico (por id) pertence à conta autenticada
// antes de deixar qualquer rota ler/alterar/apagar ele. Usado uma vez, na entrada da rota,
// em vez de espalhar ".eq('owner_id', ...)" em cada função interna — assim nenhuma ação
// nova esquece a checagem por engano (mesma lição da rota /api/analisar sem senha).
// Admin sempre passa. Registro sem owner_id definido (dado de antes das contas existirem)
// também passa — trava só quando o dono está definido e é outra pessoa.
export async function requireDonoDoRegistro(supabase, tabela, id, conta, res) {
  if (conta.isAdmin) return true;
  const { data, error } = await supabase.from(tabela).select("owner_id").eq("id", id).maybeSingle();
  if (error) {
    res.status(500).setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Não foi possível conferir o dono deste registro: " + error.message }));
    return false;
  }
  if (data && data.owner_id && data.owner_id !== conta.userId) {
    res.status(403).setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Este registro pertence a outra conta." }));
    return false;
  }
  return true;
}
