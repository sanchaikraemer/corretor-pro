import { createClient } from "@supabase/supabase-js";
import { randomUUID, timingSafeEqual, createHmac } from "crypto";


function authJson(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function safeEqualSecret(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export function requireApiKey(req, res) {
  if (process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test") return true;
  const expected = process.env.CORRETOR_PRO_API_KEY || process.env.API_SECRET || process.env.CP_API_SECRET || "";
  const allowUnprotected = String(process.env.ALLOW_UNPROTECTED_API || "").toLowerCase() === "true";
  if (!expected) {
    const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    // v725: em produção, rota pública sem chave é risco real. Só libera sem chave se for escolha explícita.
    // Para ambiente local/teste continua flexível; para Vercel produção configure CORRETOR_PRO_API_KEY
    // ou defina ALLOW_UNPROTECTED_API=true conscientemente.
    if (!isProduction || allowUnprotected) {
      try { res.setHeader("X-Corretor-Pro-Security", "api-key-not-configured"); } catch(_) {}
      return true;
    }
    authJson(res, 500, { ok: false, error: "API bloqueada por segurança: configure CORRETOR_PRO_API_KEY nas variáveis de ambiente da Vercel ou defina ALLOW_UNPROTECTED_API=true conscientemente." });
    return false;
  }
  const received = req.headers?.["x-corretor-pro-key"] || req.headers?.["x-api-key"] || "";
  if (!received || !safeEqualSecret(received, expected)) {
    authJson(res, 401, { ok: false, error: "Acesso bloqueado. Informe a chave de segurança do Corretor Pro." });
    return false;
  }
  return true;
}

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// Id fixo da empresa original (mesmo id usado em contas-config.js e nas migrações de
// supabase/migrations/). Enquanto o app principal (app.js) ainda não manda o login de cada
// corretor pra API, uma chamada autenticada só pela chave compartilhada de sempre é tratada
// como sendo dessa conta — é o único jeito de acesso que existia antes das contas por login,
// e hoje é exatamente o que ela já representa (todos os dados de hoje já pertencem a ela).
export const EMPRESA_PRINCIPAL_ID = "00000000-0000-0000-0000-000000000001";

// v1017 — cache em memória do processo (mesmo padrão já usado no cache de 5s de leads-recentes.js)
// pra não bater duas vezes no Supabase (auth.getUser + memberships) EM TODO clique que chama a
// API. Investigação da lentidão relatada pelo dono achou que resolveOrganizationId roda como
// primeiro passo em praticamente toda rota de /api — e pagava essas duas idas e voltas de rede de
// novo a cada chamada, mesmo sem nenhum lead na conta (é por isso que o travamento acontecia igual
// numa conta vazia: o custo nunca foi proporcional à quantidade de dado). TTL curto (30s): rápido
// o bastante pra não perceber numa sequência de cliques, mas ainda revalida bloqueio/teste vencido
// em menos de meio minuto — não é uma trava de segurança instantânea (é status de teste/cobrança,
// não credencial vazada), então esse atraso é aceitável. Chave = o próprio token (string opaca e
// única por sessão): nunca mistura o resultado de um usuário com o de outro.
const ORG_CACHE_TTL_MS = 30000;
const ORG_CACHE_MAX = 500;
const _orgResolveCache = new Map();
function _emModoTeste() {
  return process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test";
}
function _orgCacheGet(token) {
  if (_emModoTeste()) return null; // testes esperam resolução fresca a cada chamada (ver v1003/v997)
  const hit = _orgResolveCache.get(token);
  if (!hit) return null;
  if ((Date.now() - hit.ts) > ORG_CACHE_TTL_MS) { _orgResolveCache.delete(token); return null; }
  return hit.result;
}
function _orgCacheSet(token, result) {
  if (_emModoTeste()) return;
  if (_orgResolveCache.size >= ORG_CACHE_MAX) {
    const maisAntiga = _orgResolveCache.keys().next().value;
    if (maisAntiga !== undefined) _orgResolveCache.delete(maisAntiga);
  }
  _orgResolveCache.set(token, { ts: Date.now(), result });
}

// v997 — primeiro passo pra cada corretor só ver os próprios dados: descobre de qual conta é a
// chamada. Se vier um login de verdade (token do Supabase, header Authorization: Bearer ...),
// confirma o token e busca a empresa vinculada àquele usuário — NUNCA aceita um id de empresa
// mandado pelo próprio cliente (isso deixaria qualquer chamada fingir ser de outra conta).
// Sem token, cai no caminho antigo (chave compartilhada), sempre resolvendo pra EMPRESA_PRINCIPAL_ID.
export async function resolveOrganizationId(req, res, { supabase } = {}) {
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
  const bearer = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1];

  if (bearer) {
    const cached = _orgCacheGet(bearer);
    if (cached) {
      if (cached.bloqueado) {
        authJson(res, 403, { ok: false, bloqueado: true, error: "Seu teste grátis acabou. Para continuar usando o Corretor Pro, é preciso confirmar o pagamento." });
        return null;
      }
      return cached.organizationId;
    }
    const client = supabase || getSupabaseAdmin();
    if (!client) {
      authJson(res, 500, { ok: false, error: "Supabase não configurado no ambiente." });
      return null;
    }
    const { data: userData, error: userError } = await client.auth.getUser(bearer);
    if (userError || !userData?.user?.id) {
      authJson(res, 401, { ok: false, error: "Sessão inválida ou expirada. Faça login novamente." });
      return null;
    }
    // Se o login tiver mais de um vínculo (não deveria no fluxo normal — ver migração 0006 —,
    // mas pode ocorrer em bases antigas/migradas), usa sempre o MAIS RECENTE de forma
    // determinística — nunca "o primeiro que o banco devolver" (ordem não é garantida sem order()).
    const { data: vinculo, error: vinculoError } = await client
      .from("memberships")
      .select("organization_id, organizations(status, trial_expira_em)")
      .eq("user_id", userData.user.id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vinculoError || !vinculo?.organization_id) {
      authJson(res, 403, { ok: false, error: "Esta conta não está vinculada a nenhuma empresa." });
      return null;
    }
    // v1003 — a trava de "teste acabou/bloqueado" precisa valer AQUI, no servidor, não só na
    // tela de login (que é só uma checagem de cortesia — qualquer chamada direta pulava ela).
    // Sem a organização carregada (bancos de teste antigos), segue sem travar: a trava real é
    // pra contas novas, que sempre têm status/trial preenchidos pela migração 0003.
    const org = vinculo.organizations;
    let bloqueado = false;
    if (org && typeof org === "object") {
      const trialFim = org.trial_expira_em ? new Date(org.trial_expira_em).getTime() : null;
      const trialVencido = org.status === "teste" && Number.isFinite(trialFim) && trialFim <= Date.now();
      bloqueado = org.status === "bloqueado" || trialVencido;
    }
    _orgCacheSet(bearer, { organizationId: vinculo.organization_id, bloqueado });
    if (bloqueado) {
      authJson(res, 403, { ok: false, bloqueado: true, error: "Seu teste grátis acabou. Para continuar usando o Corretor Pro, é preciso confirmar o pagamento." });
      return null;
    }
    return vinculo.organization_id;
  }

  if (!requireApiKey(req, res)) return null;
  return EMPRESA_PRINCIPAL_ID;
}

// v1035 — chave pessoal de longa duração pra quem tem iPhone mandar o ZIP do WhatsApp direto
// pelo Atalho (Shortcuts), sem precisar do login do Supabase dentro do próprio Atalho (o token
// de sessão expira e o app Atalhos não sabe renovar sozinho). É assinada (HMAC), não fica salva
// em texto puro em lugar nenhum: guardamos só o "issuedAt" de quando foi gerada (chave
// ATALHO_ZIP_TOKEN_CHAVE em direciona_config, reaproveitando a mesma tabela do Cérebro — sem
// precisar de tabela nova) e recalculamos a assinatura esperada toda vez. Gerar uma chave nova
// troca o issuedAt salvo, o que invalida sozinho qualquer chave anterior (é assim que se "revoga").
export const ATALHO_ZIP_TOKEN_CHAVE = "atalho-zip-token-valido-desde";

function _atalhoZipTokenSecret() {
  return process.env.ATALHO_ZIP_TOKEN_SECRET || "";
}

function _assinarAtalhoZipToken(organizationId, issuedAt, secret) {
  return createHmac("sha256", secret).update(`${organizationId}.${issuedAt}`).digest("hex");
}

// Usada por api/atalho-zip-token.js pra gerar (ou mostrar de novo) a chave — nunca precisa ficar
// salva em texto puro porque dá pra recalcular a qualquer momento a partir do issuedAt guardado.
export function montarAtalhoZipToken(organizationId, issuedAt) {
  const secret = _atalhoZipTokenSecret();
  if (!secret) return null;
  return `${organizationId}.${issuedAt}.${_assinarAtalhoZipToken(organizationId, issuedAt, secret)}`;
}

// Confirma a chave mandada pelo Atalho do iPhone (header X-Corretor-Pro-Atalho-Token) e devolve
// a organização dona dela — nunca aceita a organização que o próprio pedido diz ser (só a que a
// assinatura prova). Bloqueia ANTES de qualquer leitura do corpo (o ZIP), igual requireApiKey.
export async function resolveOrganizationIdByAtalhoToken(req, res, { supabase } = {}) {
  const secret = _atalhoZipTokenSecret();
  if (!secret) {
    authJson(res, 500, { ok: false, error: "O envio pelo Atalho ainda não foi configurado neste servidor (falta ATALHO_ZIP_TOKEN_SECRET)." });
    return null;
  }
  const recebido = String(req.headers?.["x-corretor-pro-atalho-token"] || "").trim();
  const partes = recebido.split(".");
  if (partes.length !== 3 || !partes[0] || !partes[1] || !partes[2]) {
    authJson(res, 401, { ok: false, error: "Chave do Atalho ausente ou em formato inválido. Gere uma nova dentro do Corretor Pro." });
    return null;
  }
  const [organizationId, issuedAt, assinaturaRecebida] = partes;
  const assinaturaEsperada = _assinarAtalhoZipToken(organizationId, issuedAt, secret);
  if (!safeEqualSecret(assinaturaRecebida, assinaturaEsperada)) {
    authJson(res, 401, { ok: false, error: "Chave do Atalho inválida." });
    return null;
  }
  const client = supabase || getSupabaseAdmin();
  if (!client) {
    authJson(res, 500, { ok: false, error: "Supabase não configurado no ambiente." });
    return null;
  }
  const { data: cutoff, error: cutoffError } = await client
    .from("direciona_config")
    .select("valor")
    .eq("chave", ATALHO_ZIP_TOKEN_CHAVE)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (cutoffError || String(cutoff?.valor?.issuedAt || "") !== issuedAt) {
    authJson(res, 401, { ok: false, error: "Esta chave do Atalho não é mais válida — gere uma nova dentro do Corretor Pro." });
    return null;
  }
  const { data: org } = await client.from("organizations").select("status, trial_expira_em").eq("id", organizationId).maybeSingle();
  if (org && typeof org === "object") {
    const trialFim = org.trial_expira_em ? new Date(org.trial_expira_em).getTime() : null;
    const trialVencido = org.status === "teste" && Number.isFinite(trialFim) && trialFim <= Date.now();
    if (org.status === "bloqueado" || trialVencido) {
      authJson(res, 403, { ok: false, bloqueado: true, error: "Sua conta está bloqueada ou o teste grátis acabou. Confirme o pagamento pra continuar." });
      return null;
    }
  }
  return organizationId;
}

// Descobre se quem está chamando é administrador da PLATAFORMA (tabela platform_admins) —
// não confundir com "dono" de uma organização (papel dentro de memberships). Exige sempre o
// login novo (token Bearer do Supabase), nunca a chave compartilhada. Devolve "" (falsy) pra
// qualquer caso que não seja um administrador confirmado — nunca lança, é seguro usar em
// checagem condicional (ex.: esconder campo sensível) sem precisar de try/catch no chamador.
export async function getPlatformAdminUserId(req, supabase) {
  try {
    const bearer = /^Bearer\s+(.+)$/i.exec(String(req.headers?.authorization || req.headers?.Authorization || "").trim())?.[1];
    if (!bearer) return "";
    const client = supabase || getSupabaseAdmin();
    if (!client) return "";
    const { data: u } = await client.auth.getUser(bearer);
    const userId = u?.user?.id || "";
    if (!userId) return "";
    const { data: souAdmin } = await client.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    return souAdmin?.user_id ? userId : "";
  } catch (_) { return ""; }
}

// Bloqueia de vez quem não é administrador da plataforma — usar em rotas que só fazem
// sentido pra quem opera o produto (nunca pra um corretor comum, mesmo autenticado e em dia).
export async function requirePlatformAdmin(req, res, supabase) {
  const adminUserId = await getPlatformAdminUserId(req, supabase);
  if (!adminUserId) {
    authJson(res, 403, { ok: false, error: "Esta ação é exclusiva do administrador da plataforma. Entre com seu login de administrador." });
    return null;
  }
  return adminUserId;
}

// Dias de CALENDÁRIO entre uma data e agora, no fuso de Brasília (NÃO "períodos de 24h" — senão
// uma mensagem de ontem à noite conta como "hoje" de manhã, porque passaram <24h). 0 = hoje, 1 = ontem.
function diasCalendarioBR(iso) {
  if (!iso) return null;
  const t = new Date(iso);
  if (isNaN(t.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const civil = (d) => { const [y, m, dd] = fmt.format(d).split("-").map(Number); return Date.UTC(y, m - 1, dd); };
  const diff = Math.round((civil(new Date()) - civil(t)) / 86400000);
  return diff < 0 ? 0 : diff;
}

// v1017 — "dia calendário" de hoje (fuso de Brasília), usado como parte da chave de validade do
// cache de estatísticas por lead (ver listRecentProcessings/_statsCache): números como
// messageCount90d dependem da data de HOJE, não só do conteúdo da conversa — precisam envelhecer
// mesmo num lead sem mensagem nova.
function hojeCalendarioBR() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

function compact(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}

export function mergeStorageRefs(...refsList) {
  const refs = refsList.filter(v => v && typeof v === "object" && !Array.isArray(v));
  if (!refs.length) return undefined;
  const uniq = (key) => [...new Set(refs.flatMap(r => Array.isArray(r[key]) ? r[key] : []).map(String).filter(Boolean))];
  const bucket = refs.map(r => String(r.bucket || "").trim()).find(Boolean) || undefined;
  return {
    version: 1,
    ...(bucket ? { bucket } : {}),
    importIds: uniq("importIds"),
    sourceZipPaths: uniq("sourceZipPaths"),
    transcriptionCachePaths: uniq("transcriptionCachePaths")
  };
}

function defaultFor(col) {
  if (/^id$|_id$/i.test(col)) return randomUUID();
  if (/_em$|_at$|timestamp|date/i.test(col)) return new Date().toISOString();
  if (/etapa|status/i.test(col)) return "Novo";
  if (/progresso|progress|count|total/i.test(col)) return 0;
  return "";
}

async function adaptiveWrite(supabase, table, payload, mode, onConflict = "id") {
  let current = compact(payload);
  const removed = [];
  const filled = [];
  for (let i = 0; i < 24; i++) {
    const builder = supabase.from(table);
    const op = mode === "upsert" ? builder.upsert(current, { onConflict }) : builder.insert(current);
    const { data, error } = await op.select("*").maybeSingle();
    if (!error) return data;
    const msg = error.message || "";
    const noCol = msg.match(/Could not find the '([^']+)' column/i);
    if (noCol && noCol[1] in current) {
      removed.push(noCol[1]);
      const { [noCol[1]]: _drop, ...rest } = current;
      current = rest;
      continue;
    }
    const notNull = msg.match(/null value in column "([^"]+)"/i);
    if (notNull && !filled.includes(notNull[1])) {
      const col = notNull[1];
      current = { ...current, [col]: defaultFor(col) };
      filled.push(col);
      continue;
    }
    if (removed.length || filled.length) {
      error.message += ` (descartadas: ${removed.join(", ") || "-"} | preenchidas: ${filled.join(", ") || "-"})`;
    }
    throw error;
  }
  throw new Error(`${mode} ${table}: muitos retries (descartadas: ${removed.join(", ")} | preenchidas: ${filled.join(", ")})`);
}

async function tryInsert(supabase, table, payload) {
  return adaptiveWrite(supabase, table, payload, "insert");
}

async function tryUpsert(supabase, table, payload, onConflict = "id") {
  return adaptiveWrite(supabase, table, payload, "upsert", onConflict);
}

async function adaptiveUpdateById(supabase, table, id, payload) {
  let current = compact(payload);
  const removed = [];
  for (let i = 0; i < 24; i++) {
    const { data, error } = await supabase
      .from(table)
      .update(current)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (!error) return data;
    const msg = error.message || "";
    const noCol = msg.match(/Could not find the '([^']+)' column/i);
    if (noCol && noCol[1] in current) {
      removed.push(noCol[1]);
      const { [noCol[1]]: _drop, ...rest } = current;
      current = rest;
      continue;
    }
    if (removed.length) error.message += ` (descartadas no update: ${removed.join(", ")})`;
    throw error;
  }
  throw new Error(`${table}: muitos retries no update (descartadas: ${removed.join(", ")})`);
}

function _normNome(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Re-importação ("exportar de novo pra atualizar"): a foto (avatar) que o corretor já colou
// fica salva no resultado_analise do lead anterior. Como cada importação cria um registro novo,
// sem isso a foto sumia. Aqui buscamos o lead equivalente (mesmo telefone OU mesmo nome) que já
// tenha avatarFoto e devolvemos pra carregar no registro novo.


export function _digitsIdentity(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function _cleanArquivoIdentity(value = "") {
  return String(value || "")
    .replace(/\.zip$/i, "")
    .replace(/\.txt$/i, "")
    .replace(/-enxuto$/i, "")
    .replace(/\s*\(\d+\)\s*$/g, "")
    .replace(/^Conversa do WhatsApp com\s+/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function _nomeIdentity(value = "") {
  // Identidade interna pode ignorar apenas caixa, acentos e espaços. O nome visível
  // nunca é corrigido e palavras que também podem fazer parte do contato não são removidas.
  return _normNome(_cleanArquivoIdentity(value)).replace(/\s+/g, " ").trim();
}

export function _nomeRuimIdentity(value = "") {
  const s = String(value || "").trim();
  const d = _digitsIdentity(s);
  const letras = s.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  return !s || /^cliente importad[oa]?$/i.test(s) || (d.length >= 8 && letras.length < 3);
}

// Só nomes tecnicamente iguais são candidatos. Nome parecido, contido ou com palavras
// adicionais nunca autoriza fusão automática; a decisão pertence ao usuário.
export function _nomesMesmoLead(aId = "", bId = "") {
  const a = String(aId || "").trim();
  const b = String(bId || "").trim();
  return !!a && !!b && a === b;
}

export function _assinaturaTimelineV681(m) {
  if (!m || typeof m !== "object") return "";
  if (m.mediaFile) return "audio|" + String(m.mediaFile).split(/[\\/]/).pop().toLowerCase().trim();
  const txt = String(m.text || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 220);
  const sig = [String(m.date || "").trim(), String(m.time || "").trim(), String(m.author || "").trim().toLowerCase(), txt].join("|");
  return sig.replace(/\|/g, "") ? sig : "";
}

export function _mesclarTimelinesV681(antiga, nova) {
  const a0 = Array.isArray(antiga) ? antiga : [];
  const b = Array.isArray(nova) ? nova : [];
  // v900: uma "mensagem enviada" (type:"mensagem_enviada") é a SUGESTÃO copiada — apenas uma
  // aproximação do que foi realmente mandado (o corretor pode editar antes de enviar). Se a
  // reimportação trouxe a mensagem REAL correspondente (mensagem não-manual da conversa, com o
  // mesmo início de texto), a REAL vence: descarta a cópia pra não exibir texto que não foi o
  // enviado. A mensagem real permanece; só a cópia provisória sai.
  const _norm = m => String(m?.text || "").replace(/\s+/g, " ").trim().toLowerCase();
  const _ehCopiaEnviada = m => String(m?.type || "").toLowerCase() === "mensagem_enviada";
  const _ehImportadaReal = m => {
    const src = String(m?.source || "").toLowerCase(), type = String(m?.type || "").toLowerCase();
    if (src === "manual" || src === "crm" || src === "corretor-pro-manual") return false;
    if (["mensagem_enviada", "print-whatsapp", "atendimento", "nota", "ligacao", "visita", "presencial", "observacao_manual"].includes(type)) return false;
    return _norm(m).length >= 40;
  };
  const reaisImportadas = b.filter(_ehImportadaReal);
  const _substituidaPelaReal = m => {
    if (!_ehCopiaEnviada(m)) return false;
    const tm = _norm(m); if (tm.length < 40) return false;
    return reaisImportadas.some(r => {
      const tr = _norm(r);
      const n = Math.min(tm.length, tr.length, 60);
      return n >= 40 && tm.slice(0, n) === tr.slice(0, n); // mesmo começo forte = mesma mensagem
    });
  };
  const a = a0.filter(m => !_substituidaPelaReal(m));
  const vistos = new Set();
  const out = [];
  for (const m of [...a, ...b]) {
    if (!m || typeof m !== "object") continue;
    const k = _assinaturaTimelineV681(m);
    if (k && vistos.has(k)) continue;
    if (k) vistos.add(k);
    out.push({ ...m });
  }
  out.sort((x, y) => String(x.iso || "9999").localeCompare(String(y.iso || "9999")) || Number(x.order || 0) - Number(y.order || 0));
  out.forEach((m, i) => { m.id = i + 1; m.order = i + 1; });
  const chavesAntigas = new Set(a.map(_assinaturaTimelineV681).filter(Boolean));
  const novasUnicas = b.filter(m => { const k = _assinaturaTimelineV681(m); return k && !chavesAntigas.has(k); }).length;
  const preservadasDoAntigo = a.filter(m => { const k = _assinaturaTimelineV681(m); return k && !new Set(b.map(_assinaturaTimelineV681).filter(Boolean)).has(k); }).length;
  return { timeline: out, novasUnicas, preservadasDoAntigo, substituidasPelaReal: a0.length - a.length, duplicadasIgnoradas: Math.max(0, a.length + b.length - out.length) };
}

export async function _buscarProcessamentoExistenteV681(supabase, { result, fileName, path, organizationId }) {
  const analysis = result?.analysis || {};
  const lead = result?.lead || analysis?.lead || {};
  const nomeArquivoNovo = _cleanArquivoIdentity(fileName || result?.txtFile || path?.split("/").pop() || "");
  const arquivoKey = _nomeIdentity(nomeArquivoNovo);
  const nomeNovo = _nomeIdentity(lead?.clientName || analysis?.clientName || analysis?.lead?.clientName || nomeArquivoNovo);
  const phone = _digitsIdentity(lead?.phone || analysis?.lead?.phone || result?.phone || "");
  const phoneKey = phone.length >= 8 ? phone.slice(-8) : "";
  if (!phoneKey && arquivoKey.length < 3 && nomeNovo.length < 3) return null;

  const { data, error } = await supabase
    .from("whatsapp_processamentos")
    .select("id,nome_arquivo,arquivo_nome,telefone,resultado_analise,timeline_json,criado_em,created_at,atualizado_em,updated_at")
    .eq("organization_id", organizationId)
    .order("atualizado_em", { ascending: false })
    .limit(5000);
  if (error || !Array.isArray(data)) return null;
  for (const row of data) {
    const ra = row.resultado_analise || {};
    const rowPhone = _digitsIdentity(ra?.lead?.phone || row.telefone || "");
    if (phoneKey && rowPhone.length >= 8 && rowPhone.slice(-8) === phoneKey) return { row, via: "telefone" };
  }
  for (const row of data) {
    const rowFile = _nomeIdentity(row.nome_arquivo || row.arquivo_nome || "");
    if (arquivoKey.length >= 3 && rowFile && rowFile === arquivoKey) return { row, via: "arquivo" };
  }
  // v827-16: reimportar a conversa do MESMO cliente sempre atualiza o MESMO registro,
  // não importa qual produto a IA identificar naquela rodada — uma conversa real muda de
  // assunto o tempo todo (ex.: cliente pergunta de um empreendimento e, mais adiante na
  // mesma conversa, de outro) e travar por produto fragmentava um único cliente em vários
  // cadastros. Uma oportunidade genuinamente separada é criação manual do corretor, não
  // detecção automática.
  if (nomeNovo.length >= 3 && !_nomeRuimIdentity(nomeNovo)) {
    for (const row of data) {
      const ra = row.resultado_analise || {};
      const rowName = _nomeIdentity(ra?.clientName || ra?.lead?.clientName || row.nome_arquivo || row.arquivo_nome || "");
      if (rowName && !_nomeRuimIdentity(rowName) && _nomesMesmoLead(rowName, nomeNovo)) return { row, via: "nome" };
    }
  }
  return null;
}


function _semScoreComercial(value) {
  if (Array.isArray(value)) return value.map(_semScoreComercial);
  if (!value || typeof value !== "object") return value;
  const proibidos = new Set([
    "probability", "probabilityPercent", "probabilidade", "probabilidadeVenda",
    "probabilidadeFechamento", "probabilidadeFechamentoHoje", "probabilidade_resposta",
    "score", "scoreAjuste", "indiceComercial", "confianca", "confiancaAnalise"
  ]);
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (proibidos.has(key)) continue;
    if (key === "riscoPerda" && item && typeof item === "object") {
      const risco = _semScoreComercial(item);
      if (risco && typeof risco === "object") delete risco.percentual;
      out[key] = risco;
      continue;
    }
    out[key] = _semScoreComercial(item);
  }
  return out;
}

function _mesclarAnaliseV681(anterior = {}, nova = {}) {
  anterior = _semScoreComercial(anterior || {});
  nova = _semScoreComercial(nova || {});
  const merged = { ...anterior, ...nova };
  const storageRefs = mergeStorageRefs(anterior?._storageRefs, nova?._storageRefs);
  if (storageRefs) merged._storageRefs = storageRefs;
  merged.memoria = { ...((anterior || {}).memoria || {}), ...((nova || {}).memoria || {}) };
  for (const key of ["aprendizado", "venda", "motivoPerda", "motivo_perda", "lembrete", "avatarFoto"]) {
    if (merged[key] === undefined || merged[key] === null || merged[key] === "") merged[key] = anterior?.[key];
  }
  const nomeAnt = anterior?.clientName || anterior?.lead?.clientName || "";
  const nomeNovo = nova?.clientName || nova?.lead?.clientName || "";
  if (_nomeRuimIdentity(nomeNovo) && !_nomeRuimIdentity(nomeAnt)) {
    merged.clientName = nomeAnt;
    merged.lead = { ...(merged.lead || {}), clientName: nomeAnt, phone: merged?.lead?.phone || anterior?.lead?.phone || "" };
  }
  const prodAnt = anterior?.produtoInteresse || anterior?.lead?.product || "";
  const prodNovo = nova?.produtoInteresse || nova?.lead?.product || "";
  if ((!prodNovo || /não identificado|nao identificado/i.test(prodNovo)) && prodAnt) {
    merged.produtoInteresse = prodAnt;
    merged.lead = { ...(merged.lead || {}), product: prodAnt };
  }
  return _semScoreComercial(merged);
}

async function buscarAvatarAnterior(supabase, lead, analysis, organizationId) {
  try {
    const phone = String(lead?.phone || analysis?.lead?.phone || "").replace(/\D/g, "");
    const nomeNovo = _normNome(lead?.clientName || analysis?.clientName || analysis?.lead?.clientName || "");
    if (!phone && !nomeNovo) return "";
    const { data } = await supabase
      .from("whatsapp_processamentos")
      .select("resultado_analise, telefone, criado_em")
      .eq("organization_id", organizationId)
      .order("criado_em", { ascending: false })
      .limit(500);
    if (!Array.isArray(data)) return "";
    for (const r of data) {
      const ra = r.resultado_analise || {};
      if (!ra.avatarFoto) continue;
      const rPhone = String(ra?.lead?.phone || r.telefone || "").replace(/\D/g, "");
      const rNome = _normNome(ra?.clientName || ra?.lead?.clientName || "");
      const matchPhone = phone && rPhone && phone.slice(-8) === rPhone.slice(-8);
      const matchNome = nomeNovo && rNome && nomeNovo === rNome;
      if (matchPhone || matchNome) return ra.avatarFoto;
    }
  } catch (_) { /* sem foto anterior, segue sem */ }
  return "";
}

export async function persistProcessingResult({
  result,
  source = "api",
  bucket = null,
  path = null,
  fileName = null,
  fileSize = null,
  forceNew = false,
  organizationId
}) {
  if (!organizationId) {
    return { ok: false, skipped: true, reason: "organizationId é obrigatório — sem ele, o lead ficaria sem dono." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, skipped: true, reason: "Supabase não configurado no ambiente." };
  }

  const nomeArquivo = fileName || result?.txtFile || path?.split("/").pop() || "conversa-whatsapp.zip";
  const audiosEncontrados = result?.audiosEncontrados ?? result?.audioFiles?.length ?? 0;
  const audiosTranscritos = result?.audiosTranscritos ?? Object.values(result?.audioTranscriptions || {}).filter(v => String(v?.status || "").includes("transcrito") && v?.text).length;
  const timeline = result?.timeline || [];
  let analysis = _semScoreComercial(result?.analysis || null);
  // v1023 — agendamento só nasce de clique explícito em Agenda, nunca de texto/reanálise (mesmo
  // princípio da v988 pro lembrete) — mesmo aqui, no primeiro salvamento de um lead, onde
  // "analysis" é o que o navegador reenviou de uma análise já processada. Nunca confia nesse
  // campo vindo de fora; zera sempre, sem exceção.
  if (analysis && analysis.confirmedAppointments !== undefined) {
    analysis = { ...analysis, confirmedAppointments: [] };
  }
  const lead = result?.lead || null;

  // Em uma criação explicitamente nova, nunca herda dados de outro registro com o mesmo nome.
  // Reaproveitamento de avatar continua disponível apenas nos fluxos legados que não pediram forceNew.
  if (!forceNew && analysis && !analysis.avatarFoto) {
    const fotoAnterior = await buscarAvatarAnterior(supabase, lead, analysis, organizationId);
    if (fotoAnterior) analysis = { ...analysis, avatarFoto: fotoAnterior };
  }

  const attempts = [];
  let processingRow = null;

  const existenteV681 = forceNew
    ? null
    : await _buscarProcessamentoExistenteV681(supabase, { result, fileName: nomeArquivo, path, organizationId });

  const canonicalPayload = {
    organization_id: organizationId,
    nome_arquivo: nomeArquivo,
    arquivo_nome: nomeArquivo,
    status: "pronto",
    etapa: analysis?.etapaSugerida || "Novo",
    progresso: 100,
    erro: null,
    texto_extraido: result?.rawText || null,
    timeline_json: timeline,
    audios_encontrados: audiosEncontrados,
    audios_transcritos: audiosTranscritos,
    resultado_analise: analysis,
    storage_bucket: bucket || "",
    storage_path: path || "",
    file_size: fileSize,
    criado_em: result?.criadoEm || new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (existenteV681?.row?.id) {
    const anterior = existenteV681.row;
    const mergeTimeline = _mesclarTimelinesV681(anterior.timeline_json, timeline);
    const mergedAnalysis = _mesclarAnaliseV681(anterior.resultado_analise || {}, analysis || {});
    const updatePayload = {
      ...canonicalPayload,
      resultado_analise: mergedAnalysis,
      timeline_json: mergeTimeline.timeline,
      texto_extraido: mergeTimeline.timeline.map(m => `[${m.date || ""} ${m.time || ""}] ${m.author || ""}: ${m.text || ""}`).join("\n"),
      criado_em: anterior.criado_em || anterior.created_at || canonicalPayload.criado_em,
      atualizado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    try {
      const data = await adaptiveUpdateById(supabase, "whatsapp_processamentos", anterior.id, updatePayload);
      processingRow = data || { id: anterior.id };
      attempts.push({ table: "whatsapp_processamentos", model: "v681-safe-update", info: `Atualizado sem duplicar (via ${existenteV681.via}; ${mergeTimeline.novasUnicas} nova(s), ${mergeTimeline.duplicadasIgnoradas} duplicada(s) ignorada(s)).` });
    } catch (error) {
      attempts.push({ table: "whatsapp_processamentos", model: "v681-safe-update", error: error.message });
      // Uma segunda tentativa de UPDATE no mesmo lead. NUNCA cair no insert novo abaixo:
      // o lead já existe e um insert aqui criaria a duplicata (era esta a causa dos "2 Neto").
      try {
        const retry = await adaptiveUpdateById(supabase, "whatsapp_processamentos", anterior.id, updatePayload);
        processingRow = retry || { id: anterior.id };
        attempts.push({ table: "whatsapp_processamentos", model: "v681-safe-update-retry", info: "Atualizado na segunda tentativa; duplicata evitada." });
      } catch (retryError) {
        attempts.push({ table: "whatsapp_processamentos", model: "v681-safe-update-retry", error: retryError.message });
      }
    }
  }

  // Só cria um registro NOVO quando a deduplicação não encontrou lead existente.
  // Se existe lead mas o update falhou, preferimos falhar (ok:false) a duplicar o contato.
  if (!processingRow && !existenteV681?.row?.id) {
    try {
      processingRow = await tryInsert(supabase, "whatsapp_processamentos", canonicalPayload);
    } catch (error) {
      attempts.push({ table: "whatsapp_processamentos", model: "canonical", error: error.message });
      const legacyPayload = {
        organization_id: organizationId,
        arquivo_nome: nomeArquivo,
        status: "pronto",
        etapa: "Conversa processada pelo Motor Real do Corretor Pro.",
        progresso: 100,
        erro: null,
        texto_extraido: result?.rawText || null,
        timeline_json: timeline,
        resultado_analise: analysis,
        storage_bucket: bucket,
        storage_path: path,
        file_size: fileSize,
        audios_encontrados: audiosEncontrados,
        audios_transcritos: audiosTranscritos,
        updated_at: new Date().toISOString()
      };
      try {
        processingRow = await tryInsert(supabase, "whatsapp_processamentos", legacyPayload);
      } catch (legacyError) {
        attempts.push({ table: "whatsapp_processamentos", model: "legacy", error: legacyError.message });
      }
    }
  }

  let leadRow = null;
  const leadId = processingRow?.lead_id || processingRow?.id || undefined;

  // Só tenta salvar o lead se o processamento foi criado com sucesso.
  // leadId indefinido causaria um upsert com id=undefined, gerando lead órfão sem vínculo.
  if (leadId) {
    const leadBase = {
      id: leadId,
      nome: lead?.clientName || "Cliente importado",
      telefone: lead?.phone || null,
      empreendimento_interesse: lead?.product || "Não identificado",
      produto: lead?.product || "Não identificado",
      etapa: "NOVO / INICIAL",
      status: "Conversa processada",
      melhor_horario: analysis?.bestTime || null,
      proxima_acao: analysis?.nextAction || null,
      resumo: analysis?.summary || null,
      observacoes: null,
      resultado_analise: analysis,
      timeline_json: timeline,
      atualizado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // O projeto já teve tabelas "leads" e "direciona_leads" em momentos diferentes.
    // Tentamos salvar sem travar o processamento se uma delas tiver colunas diferentes.
    for (const table of ["leads", "direciona_leads"]) {
      try {
        leadRow = await tryUpsert(supabase, table, leadBase);
        break;
      } catch (error) {
        attempts.push({ table, model: "lead", error: error.message });
      }
    }
  }

  return {
    ok: !!processingRow,
    source,
    processing: processingRow ? { id: processingRow.id, table: "whatsapp_processamentos" } : null,
    lead: leadRow ? { id: leadRow.id, table: leadRow.id ? "leads/direciona_leads" : null } : null,
    warnings: attempts
  };
}

// v1017 — grava de volta (melhor esforço) o _statsCache calculado pra leads cujo cache estava
// frio/vencido, pra próxima listagem já ler pronto (ver comentário em listRecentProcessings).
// STATS_CACHE_MAX_WRITEBACKS limita o pior caso — ex.: primeira carga depois de publicar esta
// versão, com milhares de leads sem cache ainda — o resto fica pra ser calculado (e gravado) nas
// próximas cargas, sem segurar esta resposta. Nunca lança: falha de gravação não pode derrubar a
// listagem, que já foi montada corretamente em memória de qualquer jeito.
const STATS_CACHE_MAX_WRITEBACKS = 500;
const STATS_CACHE_WRITE_CONCURRENCY = 20;
async function persistStatsCacheWriteBacks(supabase, pendentes, organizationId) {
  const lote = pendentes.slice(0, STATS_CACHE_MAX_WRITEBACKS);
  for (let i = 0; i < lote.length; i += STATS_CACHE_WRITE_CONCURRENCY) {
    const fatia = lote.slice(i, i + STATS_CACHE_WRITE_CONCURRENCY);
    await Promise.all(fatia.map(async (item) => {
      try {
        await supabase.from("whatsapp_processamentos")
          .update({ resultado_analise: item.resultado_analise })
          .eq("id", item.id).eq("organization_id", organizationId);
      } catch (_) {
        // melhor esforço — a próxima carga recalcula e tenta gravar de novo.
      }
    }));
  }
}

export async function listRecentProcessings(limit = 12, options = {}) {
  const supabase = options?.supabase || getSupabaseAdmin();
  if (!supabase) return { ok: false, items: [], error: "Supabase não configurado." };
  const organizationId = options?.organizationId;
  if (!organizationId) return { ok: false, items: [], error: "organizationId é obrigatório." };

  const resolvedLimit = limit == null ? 12 : Number(limit);
  const fetchLimit = Math.min(2000, Math.max(20, resolvedLimit * 3));
  const includeFullTimeline = options?.includeFullTimeline === true;
  const requestedId = options?.id ? String(options.id) : "";
  const previewLimit = Math.min(20, Math.max(3, Number(options?.previewLimit || 8)));

  // Evita trazer texto_extraido, storage e outros campos grandes que não entram na tela.
  // timeline_json ainda é lida no servidor para calcular dias, último falante e contagens,
  // mas só a prévia é enviada ao celular. Em esquemas antigos, cai para select("*").
  const LIST_COLUMNS = "id,nome_arquivo,arquivo_nome,status,etapa,progresso,timeline_json,audios_encontrados,audios_transcritos,resultado_analise,criado_em,created_at,atualizado_em,updated_at";
  const montarQuery = (colunaData, colunas = LIST_COLUMNS) => {
    let q = supabase
      .from("whatsapp_processamentos")
      .select(colunas)
      .eq("organization_id", organizationId)
      .order(colunaData, { ascending: false });
    if (requestedId) q = q.eq("id", requestedId).limit(1);
    else q = q.limit(fetchLimit);
    return q;
  };

  // Atualizações importadas precisam subir imediatamente na lista em qualquer aparelho.
  // Ordenar por criação fazia um cliente antigo continuar escondido entre registros velhos,
  // mesmo depois de receber uma conversa nova. Usa a última alteração como ordem principal.
  let { data, error } = await montarQuery("atualizado_em");
  if (error) ({ data, error } = await montarQuery("updated_at"));
  if (error) ({ data, error } = await montarQuery("criado_em"));
  if (error) ({ data, error } = await montarQuery("created_at"));
  if (error) ({ data, error } = await montarQuery("atualizado_em", "*"));
  if (error) ({ data, error } = await montarQuery("updated_at", "*"));
  if (error) ({ data, error } = await montarQuery("criado_em", "*"));
  if (error) ({ data, error } = await montarQuery("created_at", "*"));

  if (error) return { ok: false, items: [], error: error.message };

  function cleanFileName(value = "") {
    return String(value || "")
      .replace(/\.zip$/i, "")
      .replace(/-enxuto$/i, "")
      .replace(/\s*\(\d+\)\s*$/g, "")
      // WhatsApp exporta "Conversa do WhatsApp com Fulano", mas às vezes vem "Conversa do com Fulano"
      // (sem a palavra WhatsApp). Sem cobrir os dois, o lead ficava com o NOME DO ARQUIVO inteiro.
      .replace(/^Conversa (?:do )?(?:whatsapp )?com\s+/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value = "") {
    return cleanFileName(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function productFrom(fileName = "", analysis = {}, row = {}) {
    // v827 §7.1: o produto vem do que a IA leu na conversa (produtoInteresse) ou do valor
    // já gravado no lead — sem lista fixa de empreendimentos para "normalizar" ou adivinhar.
    if (analysis?.produtoInteresse && analysis.produtoInteresse !== "Não identificado") {
      return String(analysis.produtoInteresse).trim();
    }
    return analysis?.product || analysis?.lead?.product || row.produto || "Produto não identificado";
  }

  function nameFrom(fileName = "", analysis = {}, row = {}) {
    // "Nome" que na verdade é um telefone (muitos dígitos, quase sem letras) NÃO serve como nome —
    // acontece quando o export do WhatsApp traz só o número no lugar do contato. Aí cai pro nome do arquivo.
    const pareceTelefone = (n) => { const s = String(n || "").trim(); const dig = s.replace(/\D/g, ""); const letras = s.replace(/[^a-zA-ZÀ-ÿ]/g, ""); return dig.length >= 8 && letras.length < 3; };
    let analyzedName = analysis?.clientName || analysis?.lead?.clientName || row.nome_cliente || row.nome;
    // Pedido explícito do dono: o nome mostra EXATAMENTE como está salvo — como digitou na
    // edição manual, ou como está salvo no celular na hora de importar. Nenhum filtro de
    // "limpeza" mexe no conteúdo do nome (existiu um que apagava palavras como "terreno", "cel",
    // "whatsapp" de dentro do nome — removido).
    // Às vezes a análise gravou o NOME DO ARQUIVO como nome do cliente
    // ("Conversa do com Fulano-enxuto.zip"). Limpa antes de usar, senão o card fica com o arquivo.
    if (analyzedName && (/\.zip$/i.test(analyzedName) || /^conversa\s+d/i.test(analyzedName))) {
      analyzedName = cleanFileName(analyzedName);
    }
    if (analyzedName && !/^cliente importado$/i.test(String(analyzedName)) && !pareceTelefone(analyzedName)) {
      return String(analyzedName).trim();
    }
    // Nome analisado ruim (vazio / "cliente importado" / telefone): tenta o nome do arquivo.
    const cleaned = cleanFileName(fileName);
    if (cleaned && !pareceTelefone(cleaned)) return cleaned;
    // Sem nome em lugar nenhum: usa o telefone que veio (mais útil que "Cliente importado"), senão genérico.
    return (analyzedName && String(analyzedName).trim()) || cleaned || "Cliente importado";
  }

  function hasAnalysis(analysis) {
    if (!analysis || typeof analysis !== "object") return false;
    return Boolean(analysis.summary || analysis.nextAction || analysis.messages || analysis.diagnostico || analysis.leituraComercial);
  }

  function compactAnalysisForList(analysis = {}) {
    if (!analysis || typeof analysis !== "object") return {};
    // A análise salva pode crescer bastante com diagnóstico, memória e campos de versões
    // anteriores. A carteira precisa só dos sinais abaixo. O objeto integral é devolvido
    // exclusivamente no detalhe do lead.
    const keys = [
      "summary", "nextAction", "messages", "bestTime",
      "clientName", "clientProfile", "lead", "confirmedAppointments", "lembrete",
      "tipoRetomada", "tipoContato", "avatarFoto", "venda", "motivoPerda", "motivo_perda",
      "permuta", "risk", "produtoInteresse", "produtosInteresse", "mode",
      "diagnostico", "leituraComercial", "modeloComercial", "_schemaComercial", "evolucao", "memoria", "aprendizado", "objections",
      "oportunidadeId", "contatoId", "origemOportunidadeId", "oportunidadesVinculadas",
      "sugestoesPendentes", "arquiteturaMensagens", "error",
      // v936 — carimbos de quando a análise foi gerada/reanalisada ("Última análise" no
      // cabeçalho do lead). Sem eles aqui, a lista carrega uma análise sem data e, ao reabrir
      // o lead a partir dela, "Última análise" some mesmo pra quem acabou de reanalisar.
      "reanalisadoEm", "geradoEm", "analisadoEm", "iaComercialV2"
    ];
    const out = {};
    for (const key of keys) {
      if (analysis[key] !== undefined) out[key] = analysis[key];
    }
    return out;
  }

  const statsCacheWriteBacks = [];
  const hoje = hojeCalendarioBR();
  const mapped = (data || []).map(row => {
    const analysisOriginal = row.resultado_analise || row.analysis || {};
    let analysis = _semScoreComercial(analysisOriginal);
    const timeline = Array.isArray(row.timeline_json) ? row.timeline_json : [];
    const last = timeline.length ? timeline[timeline.length - 1] : null;

    // v1023 — pedido explícito e repetido do dono, mesmo princípio já aplicado ao lembrete
    // (v988): "agendamento só pode ser feito se clicar em Agenda, sem exceção" — mesmo um
    // compromisso com prova literal na conversa (o que filtrarCompromissosReais validava até
    // aqui) não pode mais virar um "agendado" pro sistema. Isto aqui é o ÚNICO ponto por onde
    // toda leitura de lead (lista e detalhe) passa, então é onde qualquer resíduo antigo de
    // confirmedAppointments (leads salvos antes desta correção, ou de antes de qualquer uma das
    // gravações já terem sido tocadas de novo) para de valer — sem depender de reanalisar cada
    // lead antigo pra "limpar" no banco.
    if (analysis && analysis.confirmedAppointments !== undefined) {
      analysis = { ...analysis, confirmedAppointments: [] };
    }

    const fileName = row.nome_arquivo || row.arquivo_nome || "Conversa importada";
    const analyzed = hasAnalysis(analysis);

    const ehItemManual = (m) => {
      const source = String(m?.source || "");
      const type = String(m?.type || "");
      return source === "manual" || source === "crm" || source === "corretor-pro-manual" || type === "print-whatsapp"
        || ["atendimento", "nota", "ligacao", "visita", "presencial", "observacao_manual"].includes(type);
    };

    const nomeResolvido = nameFrom(fileName, analysis, row);
    const ehBusinessMsg = /(construtora|corretor|imobili|direciona|atendimento|sistema)/i;
    const primeiroNome = String(nomeResolvido || "").trim().toLowerCase().split(/\s+/)[0] || "";
    const ehClienteMsg = (m) => {
      if (ehItemManual(m)) return false;
      const autor = String(m?.author || "").trim();
      if (!autor) return false;
      const al = autor.toLowerCase();
      return primeiroNome ? (al.includes(primeiroNome) || primeiroNome.includes(al)) : !ehBusinessMsg.test(autor);
    };

    // v1017 — a varredura abaixo (achar a última mensagem real, contar mensagens do cliente,
    // achar proposta) reprocessava o histórico INTEIRO de cada lead TODA VEZ que a lista
    // carregava — mesmo leads com anos de conversa e nenhuma mensagem nova — e era a causa real
    // da lentidão ao abrir a Carteira/Home com muitos leads importados. Agora o resultado dessa
    // varredura fica guardado dentro do próprio resultado_analise (chave _statsCache — nenhuma
    // coluna/tabela nova) e só é recalculado quando: (a) o histórico mudou de tamanho (chegou
    // mensagem nova), ou (b) virou o dia (messageCount90d/clientMessageCount90d dependem da data
    // de HOJE, não só do conteúdo — precisam envelhecer mesmo sem mensagem nova). Fora isso, lê
    // direto o que já foi calculado, sem percorrer a timeline.
    const cacheStats = (analysisOriginal && typeof analysisOriginal === "object") ? analysisOriginal._statsCache : null;
    const cacheValido = !!(cacheStats && cacheStats.v === 1 && cacheStats.len === timeline.length && cacheStats.dia === hoje);

    let lastReal, lastClient, clientMessageCount, clientQuestionCount, clientMessageDays, messageCount90d, clientMessageCount90d, hasProposal;
    if (cacheValido) {
      lastReal = cacheStats.lastIso ? { iso: cacheStats.lastIso } : null;
      lastClient = cacheStats.lastClientIso ? { iso: cacheStats.lastClientIso } : null;
      clientMessageCount = cacheStats.clientMessageCount;
      clientQuestionCount = cacheStats.clientQuestionCount;
      clientMessageDays = cacheStats.clientMessageDays;
      messageCount90d = cacheStats.messageCount90d;
      clientMessageCount90d = cacheStats.clientMessageCount90d;
      hasProposal = cacheStats.hasProposal;
    } else {
      // Procura de trás pra frente. Antes eram criados arrays completos com filter(),
      // aumentando muito memória e CPU quando havia centenas de mensagens por lead.
      lastReal = null;
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (!ehItemManual(timeline[i])) { lastReal = timeline[i]; break; }
      }
      // v942 — conta o TOTAL de mensagens DO CLIENTE sobre o histórico INTEIRO (no servidor) e manda
      // esse número pronto (clientMessageCount). A lista do navegador só recebe uma prévia (~8 msgs),
      // então contar lá subestimava — a barra de "interesse" na Home ficava sempre quase vazia. Faz
      // na MESMA varredura que já achava a última msg do cliente (sem custo extra de loop). Sem
      // janela de tempo: a janela de 90 dias zerava leads que esfriaram há 3+ meses (parecia bug pro
      // dono — ex.: cliente que escreveu ~15 msgs aparecia com "0"). A coldness fica nos "dias parado".
      // v943 — pedido do dono: a ORDEM do "Fazer agora" precisa juntar VÁRIOS fatores reais da
      // conversa (não só quantidade de mensagens nem só tempo parado) — quantas vezes o cliente
      // voltou a conversar em dias DIFERENTES (recorrência = interesse sustentado), quantas
      // perguntas ele fez (dúvida real = engajamento ativo). Mesma varredura, sem custo extra.
      lastClient = null;
      clientMessageCount = 0;
      clientQuestionCount = 0;
      const _diasComMsg = new Set();
      // v1016 — "Total de mensagens" mostrado pro corretor contava o histórico INTEIRO (às vezes
      // anos de conversa), destoando de tudo mais na tela (que já fala em dias/meses recentes) numa
      // conversa antiga e parada. Conta também só os últimos 90 dias, na MESMA varredura (sem
      // custo extra) — messageCount (histórico completo) continua existindo pra ranking/dedupe
      // interno, só a exibição pro corretor passa a usar messageCount90d.
      // v1017 — mesma ideia, mas só das mensagens DO CLIENTE (clientMessageCount90d): alimenta a
      // barra de "interesse do cliente" do Fazer Agora, que o dono pediu pra também respeitar os
      // 90 dias. Isso NÃO muda clientMessageCount (continua histórico inteiro, de propósito — ver
      // comentário da v942 acima): leadsEsquecidos/radar de resgate (app.js) dependem do total
      // histórico pra reconhecer um lead antigo que esfriou; zerar isso quebraria aquele recurso.
      const cutoff90d = Date.now() - 90 * 24 * 60 * 60 * 1000;
      messageCount90d = 0;
      clientMessageCount90d = 0;
      for (let i = timeline.length - 1; i >= 0; i--) {
        const m = timeline[i];
        const tMs = m?.iso ? Date.parse(m.iso) : NaN;
        const dentro90d = Number.isFinite(tMs) && tMs >= cutoff90d;
        if (dentro90d) messageCount90d++;
        if (!ehClienteMsg(m)) continue;
        if (!lastClient) lastClient = m; // a mais recente (varre de trás pra frente)
        const txt = String(m?.text || "").trim();
        if (!txt) continue;
        clientMessageCount++;
        if (dentro90d) clientMessageCount90d++;
        if (txt.includes("?")) clientQuestionCount++;
        const diaChave = m?.date || (m?.iso ? String(m.iso).slice(0, 10) : "");
        if (diaChave) _diasComMsg.add(diaChave);
      }
      clientMessageDays = _diasComMsg.size;

      hasProposal = false;
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i]?.proposta) { hasProposal = true; break; }
      }

      statsCacheWriteBacks.push({
        id: row.id,
        resultado_analise: {
          ...(analysisOriginal && typeof analysisOriginal === "object" ? analysisOriginal : {}),
          _statsCache: {
            v: 1,
            len: timeline.length,
            dia: hoje,
            lastIso: lastReal?.iso || null,
            lastClientIso: lastClient?.iso || null,
            clientMessageCount, clientQuestionCount, clientMessageDays,
            messageCount90d, clientMessageCount90d, hasProposal
          }
        }
      });
    }

    const lastIso = lastReal?.iso || last?.iso || row.atualizado_em || row.updated_at || row.criado_em || row.created_at || null;
    const daysSince = diasCalendarioBR(lastIso);
    const lastTouchIso = last?.iso || lastIso;
    const daysSinceTouch = diasCalendarioBR(lastTouchIso);
    const lastClientIso = lastClient?.iso || null;
    const daysSinceClientReply = diasCalendarioBR(lastClientIso);

    // v827-16 (plano de estabilização, item 1 — "separar cliente de oportunidade"):
    // o NOME é o identificador real do cliente neste app — é o que vem estável no export
    // do WhatsApp. Uma conversa real muda de produto o tempo todo (cliente pergunta de um
    // empreendimento e, mais adiante na mesma conversa, de outro); tentar separar
    // automaticamente por produto identificado fragmentava o histórico de um único cliente
    // em vários cadastros. Só o `oportunidadeId` explícito (criado manualmente pelo
    // corretor, ex. "nova oportunidade") separa registros do mesmo nome — nunca uma
    // adivinhação automática por produto.
    const oportunidadeId = String(analysis?.modeloComercial?.oportunidade?.id || analysis?.oportunidadeId || "").trim();
    const nomeKey = normalizeKey(nomeResolvido);
    const nomeGenerico = !nomeKey || /^cliente importad[oa]$/i.test(String(nomeResolvido || "").trim());
    const dedupeKey = oportunidadeId ? `oportunidade:${oportunidadeId}` : (nomeGenerico ? String(row.id || "") : nomeKey);

    // Só materializa as mensagens que realmente serão enviadas ao navegador.
    // O histórico completo continua intacto no banco e é retornado em action=detalhe.
    const timelineForResponse = includeFullTimeline ? timeline : timeline.slice(-previewLimit);
    const recentMessages = timelineForResponse.map(m => ({
      date: m?.date,
      time: m?.time,
      author: m?.author,
      text: m?.text,
      type: m?.type,
      source: m?.source,
      proposta: m?.proposta || null,
      iso: m?.iso || null,
      mediaFile: m?.mediaFile || null,
      audioStatus: m?.audioStatus || null,
      audioFingerprint: m?.audioFingerprint || null,
      order: m?.order ?? null
    }));

    return {
      id: row.id,
      dedupeKey,
      fileName,
      status: row.status || "processado",
      progress: row.progresso ?? 100,
      etapa: row.etapa || analysis?.lead?.etapa || "Novo",
      name: nomeResolvido,
      product: productFrom(fileName, analysis, row),
      produtos: Array.isArray(analysis?.produtosInteresse) ? analysis.produtosInteresse.filter(Boolean) : null,
      bestTime: analysis?.bestTime || last?.time || (analyzed ? "Ver análise" : "Aguardando nova análise"),
      summary: analysis?.summary || (analyzed ? "Análise disponível." : "Conversa importada do histórico. Reimporte ou gere nova análise para atualizar."),
      nextAction: analysis?.nextAction || null,
      messages: analysis?.messages || null,
      phone: analysis?.lead?.phone || row.telefone || null,
      createdAt: row.criado_em || row.created_at || row.atualizado_em || row.updated_at || null,
      updatedAt: row.atualizado_em || row.updated_at || row.criado_em || row.created_at || null,
      lastInteractionAt: lastIso,
      daysSinceLastInteraction: daysSince,
      daysSinceLastTouch: daysSinceTouch,
      daysSinceClientReply,
      audiosEncontrados: row.audios_encontrados ?? null,
      audiosTranscritos: row.audios_transcritos ?? null,
      messageCount: timeline.length,
      messageCount90d,
      clientMessageCount,
      clientMessageCount90d,
      clientQuestionCount,
      clientMessageDays,
      hasProposal,
      recentMessages,
      historyLoaded: includeFullTimeline,
      analyzed,
      analysis: includeFullTimeline ? analysis : compactAnalysisForList(analysis)
    };
  });

  // v1017 — persiste o _statsCache calculado nesta carga (só dos leads que estavam com cache
  // frio/vencido) de volta no resultado_analise, pra próxima carga já ler pronto em vez de
  // varrer a timeline de novo. Melhor esforço: se a gravação falhar, nada muda pra quem está
  // usando o app agora (a resposta já foi montada com os números certos) — a próxima carga só
  // tenta recalcular e gravar de novo. Lote e concorrência limitados pra não segurar a resposta
  // caso a base inteira esteja com cache frio de uma vez (ex.: logo após publicar esta versão).
  if (statsCacheWriteBacks.length) {
    await persistStatsCacheWriteBacks(supabase, statsCacheWriteBacks, organizationId);
  }

  // Dedupe mantendo a ORDEM (mais recente primeiro) mas guardando, por chave, o registro mais
  // completo: o que tem mais mensagens/histórico e já foi analisado. Assim, se o mesmo cliente
  // foi cadastrado duas vezes, fica o card já trabalhado — não o cadastro novo vazio.
  const riqueza = (it) => (Number(it.messageCount) || 0) + (it.analyzed ? 1 : 0);
  const bestByKey = new Map();
  const fotoByKey = new Map(); // foto (avatar) de QUALQUER registro do cliente, pra não depender de qual ficou líder
  const idsByKey = new Map();  // TODOS os ids juntados sob o mesmo cliente (pra apagar duplicados de uma vez)
  const ordem = [];
  for (const item of mapped) {
    const k = item.dedupeKey;
    if (!fotoByKey.has(k)) {
      const f = item.analysis?.avatarFoto || item.avatarFoto;
      if (f) fotoByKey.set(k, f);
    }
    if (item.id != null) {
      if (!idsByKey.has(k)) idsByKey.set(k, []);
      idsByKey.get(k).push(String(item.id));
    }
    const prev = bestByKey.get(k);
    if (!prev) { bestByKey.set(k, item); ordem.push(k); }
    else if (riqueza(item) > riqueza(prev)) bestByKey.set(k, item);
  }
  const unique = [];
  for (const k of ordem) {
    const { dedupeKey, ...clean } = bestByKey.get(k);
    // Todos os registros duplicados desse mesmo cliente — o front usa pra apagar tudo de uma vez.
    const dupeIds = idsByKey.get(k) || [];
    if (dupeIds.length > 1) clean.dupeIds = dupeIds;
    // A foto pode ter sido salva num registro diferente do que virou líder da dedupe
    // (mesmo cliente, várias importações). Se o líder não tem foto mas outro registro
    // dele tem, herda — assim o avatar nunca "some" ao reabrir/recarregar a lista.
    const foto = fotoByKey.get(k);
    if (foto && !(clean.analysis && clean.analysis.avatarFoto)) {
      clean.analysis = { ...(clean.analysis || {}), avatarFoto: foto };
    }
    // A listagem envia apenas uma PRÉVIA leve para navegação e ranking.
    // O histórico não é cortado no banco: ao abrir o lead, o front solicita este mesmo
    // registro com includeFullTimeline=true e recebe TODAS as mensagens.
    if (!includeFullTimeline && Array.isArray(clean.recentMessages) && clean.recentMessages.length > previewLimit) {
      clean.recentMessages = clean.recentMessages.slice(-previewLimit);
    }
    clean.historyPreviewCount = Array.isArray(clean.recentMessages) ? clean.recentMessages.length : 0;
    unique.push(clean);
    if (unique.length >= resolvedLimit) break;
  }

  return {
    ok: true,
    items: unique,
    meta: {
      totalFetched: (data || []).length,
      totalReturned: unique.length,
      deduplicated: Math.max(0, mapped.length - unique.length)
    }
  };
}
