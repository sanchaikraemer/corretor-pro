import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual, createHmac } from "crypto";


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
  // v1092 criou aqui um interruptor pra desligar o caminho antigo (chave compartilhada, sem
  // login): CORRETOR_PRO_LEGADO_DESLIGADO=sim. Ele continua valendo.
  //
  // v1190 — MAS O PADRÃO SE INVERTEU EM PRODUÇÃO. Segurança que depende de alguém lembrar de
  // marcar "DESLIGADO=sim" numa tela de configuração não é segurança: quem esquece fica com a
  // porta antiga aberta e não recebe aviso nenhum. Como toda chamada por esse caminho é tratada
  // como sendo da conta original (ver resolveOrganizationId logo abaixo), o que está em jogo são
  // os dados do próprio dono.
  //
  // Hoje: em produção o caminho antigo vem DESLIGADO, e só liga com CORRETOR_PRO_LEGADO_ATIVO=sim.
  // O Atalho do iPhone não depende disso desde a v1035 (usa a chave pessoal assinada por empresa,
  // resolveOrganizationIdByAtalhoToken) e o app manda o login do Supabase em toda chamada; um
  // aparelho antigo que ainda guardava a chave compartilhada recebe 401 e o próprio app o leva
  // pra tela de entrar (ver o tratamento de 401 em app.js) — ele não fica preso.
  const legadoDesligadoExplicitamente = String(process.env.CORRETOR_PRO_LEGADO_DESLIGADO || "").toLowerCase() === "sim";
  const legadoLigadoExplicitamente = String(process.env.CORRETOR_PRO_LEGADO_ATIVO || "").toLowerCase() === "sim";
  const producao = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (legadoDesligadoExplicitamente || (producao && !legadoLigadoExplicitamente)) {
    authJson(res, 401, { ok: false, error: "O acesso por chave de segurança foi desligado nesta instalação. Entre com sua conta." });
    return false;
  }
  const expected = process.env.CORRETOR_PRO_API_KEY || process.env.API_SECRET || process.env.CP_API_SECRET || "";
  const allowUnprotected = String(process.env.ALLOW_UNPROTECTED_API || "").toLowerCase() === "true";
  if (!expected) {
    const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    // v1092 — ALLOW_UNPROTECTED_API deixou de valer EM PRODUÇÃO.
    //
    // Este caminho só é alcançado por uma chamada SEM login (sem Authorization: Bearer). Toda
    // chamada sem login é tratada como sendo da empresa principal (ver resolveOrganizationId).
    // Ou seja: com ALLOW_UNPROTECTED_API=true e sem chave configurada, QUALQUER pessoa na
    // internet podia ler e gravar os dados da conta original, sem nenhuma credencial.
    // Fora de produção (desenvolvimento e testes) a variável continua valendo, que é onde ela
    // realmente serve.
    if (!isProduction) {
      try { res.setHeader("X-Corretor-Pro-Security", "api-key-not-configured"); } catch(_) {}
      return true;
    }
    if (allowUnprotected) {
      authJson(res, 500, { ok: false, error: "ALLOW_UNPROTECTED_API não vale em produção: ela deixaria a conta original aberta pra qualquer um sem login. Configure CORRETOR_PRO_API_KEY, ou simplesmente remova a variável — quem entra com login não precisa dela." });
      return false;
    }
    authJson(res, 500, { ok: false, error: "API bloqueada por segurança: configure CORRETOR_PRO_API_KEY nas variáveis de ambiente da Vercel. Quem usa o app com login por conta não depende dessa chave." });
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
export { COLUNAS_ADAPTAVEIS, MOTIVO_COLUNA_CRITICA };

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

// v1128 — guarda das rotas de quem AINDA NÃO TEM EMPRESA (hoje só api/criar-conta.js).
//
// resolveOrganizationId não serve aqui: ela exige que o login já esteja vinculado a uma empresa e
// responde 403 quando não está — que é exatamente a situação de quem acabou de se cadastrar. Esta
// checagem é a mesma coisa um passo antes: confirma que o token de login é de verdade (pergunta ao
// Supabase, nunca acredita no que o navegador manda) e devolve o id do usuário. Nunca aceita id de
// usuário enviado pelo cliente — isso deixaria qualquer chamada criar empresa em nome de outra pessoa.
export async function requireLoginSemEmpresa(req, res, { supabase } = {}) {
  const bearer = /^Bearer\s+(.+)$/i.exec(String(req.headers?.authorization || req.headers?.Authorization || "").trim())?.[1];
  if (!bearer) {
    authJson(res, 401, { ok: false, error: "Faça login antes de criar a empresa." });
    return null;
  }
  const client = supabase || getSupabaseAdmin();
  if (!client) {
    authJson(res, 500, { ok: false, error: "Supabase não configurado no ambiente." });
    return null;
  }
  const { data, error } = await client.auth.getUser(bearer);
  const userId = data?.user?.id || "";
  if (error || !userId) {
    authJson(res, 401, { ok: false, error: "Sessão inválida ou expirada. Faça login novamente." });
    return null;
  }
  return { userId, email: data?.user?.email || "", metadata: data?.user?.user_metadata || {} };
}

// v1128 — impressão digital da conexão de internet de quem está chamando.
//
// PRIVACIDADE: o endereço de internet (IP) NUNCA é gravado. O que vai pro banco é este resumo
// embaralhado (SHA-256 com um segredo que só existe no servidor) — serve pra dizer "estas duas
// contas vieram da mesma conexão" e pra mais nada; não dá pra voltar dele ao endereço original,
// nem pra conferir um endereço suspeito sem ter o segredo. Mesma linha da v1119.
export function impressaoDaConexao(req) {
  const cru = String(
    req?.headers?.["x-forwarded-for"] || req?.headers?.["x-real-ip"] ||
    req?.socket?.remoteAddress || ""
  ).split(",")[0].trim();
  if (!cru) return "";
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATALHO_ZIP_TOKEN_SECRET || "corretor-pro";
  return createHmac("sha256", segredo).update(cru).digest("hex").slice(0, 32);
}

const LIMITE_CADASTROS_CONEXAO_DIA_PADRAO = 5;

// Quantas contas novas a mesma conexão pode abrir por dia. Folgado de propósito: um corretor cria
// uma; uma imobiliária inteira no mesmo Wi-Fi cabe; um script numa máquina só trava na sexta.
// Ajustável em CORRETOR_PRO_LIMITE_CADASTROS_CONEXAO_DIA (Vercel) sem publicar nada.
export function limiteCadastrosPorConexaoDia() {
  const configurado = Number(process.env.CORRETOR_PRO_LIMITE_CADASTROS_CONEXAO_DIA);
  return Number.isFinite(configurado) && configurado > 0 ? configurado : LIMITE_CADASTROS_CONEXAO_DIA_PADRAO;
}

// Conta os cadastros das últimas 24h vindos da mesma conexão. Se a tabela ainda não existir (a
// migração 0013 é aplicada à mão pelo dono, como todas as outras), NÃO trava ninguém: devolve
// "pode passar" e segue — cadastro travado por infraestrutura faltando seria muito pior que a
// abertura que essa trava fecha.
export async function contarCadastrosRecentesDaConexao(supabase, conexaoHash) {
  if (!supabase || !conexaoHash) return { disponivel: false, total: 0 };
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("cadastros_por_conexao")
    .select("id", { count: "exact", head: true })
    .eq("conexao_hash", conexaoHash)
    .gte("criado_em", desde);
  if (error) return { disponivel: false, total: 0, erro: error.message };
  return { disponivel: true, total: Number(count || 0) };
}

// Registra o cadastro que acabou de acontecer. Falha aqui nunca derruba o cadastro em si — o
// corretor já tem a empresa criada; perder uma linha de contador é irrelevante perto disso.
export async function registrarCadastroDaConexao(supabase, conexaoHash, organizationId) {
  if (!supabase || !conexaoHash) return;
  try {
    await supabase.from("cadastros_por_conexao").insert({ conexao_hash: conexaoHash, organization_id: organizationId || null });
  } catch (_) { /* contador é acessório — nunca atrapalha quem está entrando */ }
}

// ── v1185 — o código sabe de que versão do banco ele precisa ─────────────────────────────────
//
// As auditorias de 08/2026 apontaram o mesmo problema, cada uma com suas palavras: código e banco
// podem estar em versões diferentes e NADA avisa. Não é teórico — a conferência de 07/08/2026
// mostrou a `0009` faltando enquanto a `0010` até a `0014` já estavam.
//
// A migração `0017` põe no banco a função `conferir_migracoes()`, que olha o catálogo do Postgres
// e diz o que existe DE FATO (não o que alguém marcou como feito). Aqui é o outro lado: a lista do
// que o código de hoje precisa, e a leitura da conferência.
//
// Esta leitura NÃO derruba o app quando o banco está atrás — derrubar por conta própria tiraria do
// ar corretor que está trabalhando. Ela alimenta o diagnóstico (`api/diagnostico.js?mode=banco`),
// que é onde o dono vê a lista pronta e sabe o que colar no SQL Editor.
// v1190 — subiu de 16 pra 18: a 0018 deixou de ser opcional. Desde esta versão, o cadastro de
// conta nova em produção RECUSA em vez de cair no caminho antigo quando ela não está aplicada
// (ver api/criar-conta.js), então o diagnóstico precisa apontá-la como pendência de verdade.
export const MIGRACAO_MINIMA_EXIGIDA = 18;

export async function conferirMigracoesDoBanco(supabase) {
  if (!supabase) return { disponivel: false, motivo: "Supabase não configurado." };
  const { data, error } = await supabase.rpc("conferir_migracoes");
  if (error) {
    // A própria 0017 ainda não foi aplicada: é a resposta esperada até o dono rodar o arquivo.
    const semFuncao = /function .* does not exist|could not find the function|schema cache|PGRST202/i
      .test(`${error.message || ""} ${error.code || ""}`);
    return {
      disponivel: false,
      registroAusente: semFuncao || undefined,
      motivo: semFuncao
        ? "O banco ainda não sabe se reportar. Rode supabase/migrations/0017_registro_de_migracoes.sql no SQL Editor do Supabase — depois disso esta tela mostra, sozinha, o que falta."
        : (error.message || "Não foi possível conferir as migrações.")
    };
  }
  const linhas = Array.isArray(data) ? data : [];
  const faltando = linhas.filter(l => l?.situacao !== "aplicada");
  const aplicadas = linhas.filter(l => l?.situacao === "aplicada").map(l => Number(l.numero));
  const maiorSeguida = aplicadas.length
    ? aplicadas.sort((a, b) => a - b).reduce((acc, n) => (n === acc + 1 ? n : acc), 0)
    : 0;
  return {
    disponivel: true,
    total: linhas.length,
    aplicadas,
    faltando: faltando.map(l => ({ numero: Number(l.numero), arquivo: l.arquivo, detalhe: l.detalhe })),
    versaoSeguida: maiorSeguida,
    minimaExigida: MIGRACAO_MINIMA_EXIGIDA,
    emDia: !faltando.some(l => Number(l.numero) <= MIGRACAO_MINIMA_EXIGIDA)
  };
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

// v1092 — LISTA EXPLÍCITA do que pode ser adaptado sozinho.
//
// A gravação "adaptativa" existe porque o projeto arrastou nomes de coluna diferentes de fases
// diferentes (nome_arquivo x arquivo_nome, criado_em x created_at...) e precisa funcionar em bases
// antigas. O perigo é que ela fazia isso por REGRA GENÉRICA DE NOME: qualquer coluna que o banco
// recusasse era descartada em silêncio, e qualquer coluna obrigatória que faltasse era preenchida
// com um valor inventado — inclusive `organization_id`, que a regra `/^id$|_id$/` preenchia com um
// UUID ALEATÓRIO. O resultado seria um lead pertencendo a uma empresa que não existe: dado
// perdido, sem erro nenhum. É a mesma família do vazamento entre contas corrigido na v1082.
//
// Agora é o contrário: só o que está nesta lista pode ser adaptado. Todo o resto — em especial o
// dono do registro, a identidade e o conteúdo — faz a gravação PARAR com um erro que diz o que
// precisa ser corrigido.
const COLUNAS_ADAPTAVEIS = new Set([
  // Duplicatas de nomenclatura herdadas de versões diferentes do projeto.
  "nome_arquivo", "arquivo_nome", "criado_em", "created_at", "atualizado_em", "updated_at",
  // Metadados opcionais da importação — a ausência deles não corrompe nada.
  "texto_extraido", "audios_encontrados", "audios_transcritos", "file_size",
  "storage_bucket", "storage_path", "progresso", "erro", "status",
  // Colunas das tabelas legadas leads/direciona_leads (só a conta original grava nelas).
  "nome", "telefone", "empreendimento_interesse", "produto",
  "melhor_horario", "proxima_acao", "resumo", "observacoes",
  // Colunas de deduplicação normalizada (migração 0010) — ainda opcionais de propósito: sem elas
  // o sistema continua funcionando pelo caminho antigo, só mais devagar.
  "dedupe_fone8", "dedupe_nome", "dedupe_arquivo"
]);

// O que NUNCA pode ser descartado nem inventado, com o motivo de cada um.
const MOTIVO_COLUNA_CRITICA = {
  organization_id: "é o dono do registro — sem ele o dado fica órfão ou, pior, visível pra outra conta",
  id: "é a identidade do registro — inventar um cria duplicata em vez de atualizar",
  lead_id: "liga o registro ao lead certo",
  user_id: "liga o registro à pessoa certa",
  timeline_json: "é a conversa do cliente — descartar apaga o histórico",
  resultado_analise: "é a análise inteira do lead",
  etapa: "é o estado do lead (ativo/arquivado) — inventar desarquiva cliente sem o corretor mandar"
};

function erroColunaCritica(tabela, coluna, tipo) {
  const motivo = MOTIVO_COLUNA_CRITICA[coluna] || "é um campo crítico para a integridade dos dados";
  const detalhe = tipo === "ausente"
    ? `a coluna "${coluna}" não existe na tabela "${tabela}"`
    : `a coluna "${coluna}" da tabela "${tabela}" é obrigatória e veio vazia`;
  const err = new Error(
    `Gravação interrompida: ${detalhe}, e ela ${motivo}. ` +
    `NENHUM dado foi gravado. Confira se todas as migrações de supabase/migrations/ foram aplicadas ` +
    `no banco antes de tentar de novo.`
  );
  err.code = "COLUNA_CRITICA";
  return err;
}

// O Supabase devolve o erro como objeto simples, não como Error. Jogar esse objeto direto
// com "throw" produz uma falha sem rastro de origem e que nem sequer é reconhecida como erro
// por quem tenta tratá-la. Aqui ele vira um Error de verdade, preservando os campos que o
// banco mandou (code/details/hint) pra o diagnóstico não perder nada.
function erroDoBanco(error, sufixo = "") {
  if (error instanceof Error) {
    if (sufixo) error.message += sufixo;
    return error;
  }
  const err = new Error((error?.message || "falha desconhecida no banco") + sufixo);
  if (error?.code) err.code = error.code;
  if (error?.details) err.details = error.details;
  if (error?.hint) err.hint = error.hint;
  return err;
}

// v1096 — MEMÓRIA DE COLUNAS QUE O BANCO NÃO TEM.
//
// A gravação adaptativa descobre coluna faltante do jeito mais caro possível: manda o registro
// INTEIRO, o banco recusa citando UMA coluna, ela é descartada e o registro inteiro é mandado de
// novo. Uma ida ao banco por coluna faltante — cada uma carregando a conversa completa do cliente.
//
// Na v1092 isso virou um problema de verdade: passamos a mandar três colunas novas de deduplicação
// (migração 0010) que a maioria dos bancos ainda não tem. Onde havia UMA gravação passaram a
// existir QUATRO, e o salvamento tem retry — então oito. Com uma conversa grande, isso estoura o
// tempo da função e a importação morre em "salvando no banco de dados" (print do dono na v1095).
//
// Agora o que o banco recusou fica lembrado enquanto o processo vive: a próxima gravação já sai
// sem essas colunas, direto. Aprende uma vez, não a cada gravação.
//
// Detalhe honesto: se uma migração for aplicada com o servidor já rodando, um processo que já
// tinha aprendido "essa coluna não existe" continua sem gravá-la até ser reciclado (minutos).
// Isso é seguro de propósito — a coluna só serve pra ACELERAR a busca, e enquanto isso o sistema
// funciona pelo caminho antigo. Nada é perdido nem corrompido; no máximo continua rápido só
// depois da reciclagem.
const _colunasQueNaoExistem = new Map(); // tabela -> Set(colunas)

function _esquecidas(tabela) {
  let s = _colunasQueNaoExistem.get(tabela);
  if (!s) { s = new Set(); _colunasQueNaoExistem.set(tabela, s); }
  return s;
}
function _anotarColunaInexistente(tabela, coluna) { _esquecidas(tabela).add(coluna); }
function _semColunasInexistentes(tabela, payload) {
  const faltantes = _colunasQueNaoExistem.get(tabela);
  if (!faltantes || !faltantes.size) return payload;
  const out = {};
  for (const [k, v] of Object.entries(payload)) if (!faltantes.has(k)) out[k] = v;
  return out;
}
// Exportadas pro teste conseguir dirigir e conferir esse aprendizado.
export function _colunasInexistentesEstado(tabela) { return [..._esquecidas(tabela)]; }
export function _colunasInexistentesResetar() { _colunasQueNaoExistem.clear(); }

// Valores padrão só para colunas da lista de adaptáveis. Nunca inventa identificador.
function defaultFor(col) {
  if (/_em$|_at$|timestamp|date/i.test(col)) return new Date().toISOString();
  if (/^status$/i.test(col)) return "Novo";
  if (/progresso|progress|count|total/i.test(col)) return 0;
  return "";
}

async function adaptiveWrite(supabase, table, payload, mode, onConflict = "id") {
  let current = _semColunasInexistentes(table, compact(payload));
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
      if (!COLUNAS_ADAPTAVEIS.has(noCol[1])) throw erroColunaCritica(table, noCol[1], "ausente");
      _anotarColunaInexistente(table, noCol[1]);
      removed.push(noCol[1]);
      const { [noCol[1]]: _drop, ...rest } = current;
      current = rest;
      continue;
    }
    const notNull = msg.match(/null value in column "([^"]+)"/i);
    if (notNull && !filled.includes(notNull[1])) {
      const col = notNull[1];
      if (!COLUNAS_ADAPTAVEIS.has(col)) throw erroColunaCritica(table, col, "obrigatoria");
      current = { ...current, [col]: defaultFor(col) };
      filled.push(col);
      continue;
    }
    throw erroDoBanco(error, (removed.length || filled.length)
      ? ` (descartadas: ${removed.join(", ") || "-"} | preenchidas: ${filled.join(", ") || "-"})`
      : "");
  }
  throw new Error(`${mode} ${table}: muitos retries (descartadas: ${removed.join(", ")} | preenchidas: ${filled.join(", ")})`);
}

// Exportadas pra o teste poder dirigir a gravação adaptativa de verdade (ver
// tests/v1092-gravacao-nunca-inventa-nem-descarta-campo-critico).
export { tryInsert, tryUpsert, adaptiveUpdateById };

async function tryInsert(supabase, table, payload) {
  return adaptiveWrite(supabase, table, payload, "insert");
}

async function tryUpsert(supabase, table, payload, onConflict = "id") {
  return adaptiveWrite(supabase, table, payload, "upsert", onConflict);
}

async function adaptiveUpdateById(supabase, table, id, payload) {
  let current = _semColunasInexistentes(table, compact(payload));
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
      if (!COLUNAS_ADAPTAVEIS.has(noCol[1])) throw erroColunaCritica(table, noCol[1], "ausente");
      _anotarColunaInexistente(table, noCol[1]);
      removed.push(noCol[1]);
      const { [noCol[1]]: _drop, ...rest } = current;
      current = rest;
      continue;
    }
    throw erroDoBanco(error, removed.length ? ` (descartadas no update: ${removed.join(", ")})` : "");
  }
  throw new Error(`${table}: muitos retries no update (descartadas: ${removed.join(", ")})`);
}

// v1105 — auditoria do backup real do dono (298 registros): 244 tinham TEXTO de análise da IA
// gravado na coluna etapa (herança de versões antigas, perpetuada porque a reimportação copiava
// a etapa anterior como estivesse). Etiqueta curta legada ("Vendido", "Perdido") vira Geladeira,
// como decidido na v1069; qualquer outra coisa — inclusive texto longo com "fechado"/"desistiu"
// no meio — vira Ativo. Um texto NUNCA pode arquivar cliente que o corretor não arquivou.
export function normalizarEtapaBanco(valor) {
  const bruto = String(valor || "").trim();
  if (bruto === "Ativo" || bruto === "Geladeira") return bruto;
  const s = bruto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (bruto.length <= 40 && /vendido|venda concluida|venda fechada|perdido|desistiu|recusou|geladeira|arquivad|fechado/.test(s)) return "Geladeira";
  return "Ativo";
}

function _normNome(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function _digitsIdentity(value = "") {
  return String(value || "").replace(/\D/g, "");
}

// v1141 — CAUSA REAL do "0 reaproveitados" que sobreviveu à v954/v1022/v1026/v1027.
//
// O MESMO arquivo chega nesta função com dois nomes diferentes:
//   • na hora de SALVAR, o nome como está no aparelho — "Conversa do WhatsApp com X-enxuto.zip"
//     (com espaços);
//   • na hora de PREPARAR (onde o cache de transcrição do cliente é procurado), o nome do objeto
//     no Storage, que passou por sanitizeFileNameUpload — "Conversa-do-WhatsApp-com-X-enxuto.zip"
//     (espaços viraram traço).
//
// A ordem antiga tirava o prefixo "Conversa do WhatsApp com" ANTES de transformar traço/underscore
// em espaço: a versão com espaços virava "x" e a sanitizada virava "conversa do whatsapp com x".
// Duas chaves diferentes pro mesmo arquivo → a busca pelo cliente já salvo falhava exatamente na
// etapa que reaproveita as transcrições → toda reimportação transcrevia (e pagava) tudo de novo,
// e o contador mostrava "0 reaproveitados" pra sempre.
//
// Agora os separadores são normalizados PRIMEIRO, e só depois caem os sufixos técnicos e o
// prefixo — as duas formas do mesmo arquivo chegam na mesma chave.
function _cleanArquivoIdentity(value = "") {
  let t = String(value || "")
    .replace(/\.zip$/i, "")
    .replace(/\.txt$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Sufixos técnicos podem vir em qualquer ordem ("X enxuto (1)" ou "X (1) enxuto").
  for (let i = 0; i < 3; i++) t = t.replace(/\s*(?:enxuto|\(\d+\))$/i, "").trim();
  return t
    .replace(/^Conversa do WhatsApp com\s+/i, "")
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
  // v1180 — "Cliente não identificado" entrou nesta lista: desde que a importação parou de chutar
  // um nome quando não sabe de quem é a conversa (pickClientName, em _pipeline.js), esse rótulo
  // pode aparecer em mais de um lead — e um nome sem identidade JAMAIS pode juntar dois cadastros.
  return !s || /^(?:cliente(?:\s+(?:importad[oa]|n[ãa]o\s+identificad[oa]))?|contato)$/i.test(s)
    || (d.length >= 8 && letras.length < 3);
}

// Só nomes tecnicamente iguais são candidatos. Nome parecido, contido ou com palavras
// adicionais nunca autoriza fusão automática; a decisão pertence ao usuário.
export function _nomesMesmoLead(aId = "", bId = "") {
  const a = String(aId || "").trim();
  const b = String(bId || "").trim();
  return !!a && !!b && a === b;
}

// v1176 — NOME DE ARQUIVO QUE NÃO IDENTIFICA NINGUÉM.
//
// O nome do ZIP é uma das três chaves de identidade do cliente. Só que nem todo ZIP chega com o
// nome do contato: quando o aparelho compartilha o arquivo sem nome (ou com o nome padrão da
// exportação), o app cai no nome genérico "conversa-whatsapp.zip". Duas importações genéricas
// dessas tinham exatamente a MESMA chave — e viravam o mesmo cliente. Embalagem não é identidade.
const _IDENTIDADES_SEM_DONO = new Set([
  "conversa whatsapp", "conversa de whatsapp", "conversa do whatsapp", "conversa",
  "whatsapp chat", "chat whatsapp", "whatsapp", "chat", "arquivo", "documento",
  "cliente", "cliente importado", "cliente importada", "cliente nao identificado"
]);

// Últimos 8 dígitos de um telefone (a chave usada pra reconhecer o mesmo número), ou null.
export function _chaveFone8(valor = "") {
  const d = _digitsIdentity(valor);
  return d.length >= 8 ? d.slice(-8) : null;
}

// Chave de identidade utilizável (ou "" quando o texto não identifica ninguém).
export function _chaveIdentidadeUtil(valor = "") {
  const chave = _nomeIdentity(valor);
  if (!chave || chave.length < 3) return "";
  return _IDENTIDADES_SEM_DONO.has(chave) ? "" : chave;
}

// v1176 — A TRAVA QUE FALTAVA: nenhuma chave sozinha funde duas PESSOAS DIFERENTES.
//
// Telefone e nome de arquivo são atalhos para reconhecer o mesmo cliente entre uma importação e
// outra — não provas. Quando os dois lados têm nome de gente e são nomes de pessoas claramente
// diferentes, a fusão automática está proibida: cria-se um cadastro separado (que o corretor pode
// juntar depois, na mão, com "Juntar clientes") em vez de despejar a conversa de um cliente dentro
// do histórico de outro, o que ninguém consegue desfazer.
//
// Continua liberado o caso real que os atalhos existem para atender: contato renomeado no celular
// entre duas exportações ("Fulana" → "Fulana Sobrenome", "Fulano" → "Fulano Torre 2"), ou
// seja, o mesmo nome com palavras a mais no meio/fim.
export function _nomesPodemSerOMesmoCliente(nomeA = "", nomeB = "") {
  const a = String(nomeA || "").trim();
  const b = String(nomeB || "").trim();
  // Sem nome utilizável de um dos lados, quem decide é a outra chave (comportamento de sempre).
  if (!a || !b || _nomeRuimIdentity(a) || _nomeRuimIdentity(b)) return true;
  const ia = _chaveIdentidadeUtil(a), ib = _chaveIdentidadeUtil(b);
  if (!ia || !ib) return true;
  if (_nomesMesmoLead(ia, ib)) return true;
  const pa = ia.split(" ").filter(Boolean);
  const pb = ib.split(" ").filter(Boolean);
  if (!pa.length || !pb.length) return true;
  const [menor, maior] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  // Nome que só ganhou palavras no fim ("fulana" ⊂ "fulana sobrenome").
  if (menor.every((palavra, i) => maior[i] === palavra)) return true;
  // Nome + sobrenome idênticos e só acréscimos no meio/fim (mesma regra que a tela usa pra
  // perguntar "é o mesmo cliente?" — ver nomesParecemMesmoCliente em app.js).
  if (menor.length < 2 || pa[0] !== pb[0] || pa[1] !== pb[1]) return false;
  let i = 0;
  for (const palavra of maior) if (i < menor.length && palavra === menor[i]) i++;
  return i >= menor.length;
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
  // v1082 — o conjunto das chaves novas era remontado DENTRO do filtro, uma vez por mensagem
  // antiga: reimportar uma conversa de 4 mil mensagens fazia 16 milhões de comparações e criava
  // 4 mil conjuntos, só pra contar um número que aparece no aviso da importação. Agora monta uma
  // vez só, igual o chavesAntigas da linha de cima.
  const chavesNovas = new Set(b.map(_assinaturaTimelineV681).filter(Boolean));
  const preservadasDoAntigo = a.filter(m => { const k = _assinaturaTimelineV681(m); return k && !chavesNovas.has(k); }).length;
  return { timeline: out, novasUnicas, preservadasDoAntigo, substituidasPelaReal: a0.length - a.length, duplicadasIgnoradas: Math.max(0, a.length + b.length - out.length) };
}

// null = ainda não sabemos; true = migração 0010 aplicada; false = não aplicada (não tenta mais).
let _dedupeIndexadoDisponivel = null;
export function _dedupeIndexadoResetar(){ _dedupeIndexadoDisponivel = null; }

export async function _buscarProcessamentoExistenteV681(supabase, { result, fileName, path, organizationId, idJaIdentificado = "" }) {
  const analysis = result?.analysis || {};
  const lead = result?.lead || analysis?.lead || {};
  const nomeArquivoNovo = _cleanArquivoIdentity(fileName || result?.txtFile || path?.split("/").pop() || "");
  // v1176 — nome de arquivo genérico ("conversa-whatsapp.zip") não identifica cliente nenhum.
  const arquivoKey = _chaveIdentidadeUtil(nomeArquivoNovo);
  const nomeNovo = _chaveIdentidadeUtil(lead?.clientName || analysis?.clientName || analysis?.lead?.clientName || nomeArquivoNovo);
  const phone = _digitsIdentity(lead?.phone || analysis?.lead?.phone || result?.phone || "");
  const phoneKey = phone.length >= 8 ? phone.slice(-8) : "";
  if (!phoneKey && arquivoKey.length < 3 && nomeNovo.length < 3) return null;
  // v1176 — nome do cliente desta importação, como ele vai aparecer na tela. É com ele que a
  // trava contra fusão de pessoas diferentes compara (ver _nomesPodemSerOMesmoCliente).
  const nomeVisivelNovo = String(lead?.clientName || analysis?.clientName || analysis?.lead?.clientName || nomeArquivoNovo || "").trim();
  const nomeVisivelDaLinha = (linha) => {
    const ra = linha?.resultado_analise || {};
    return String(linha?.nome_analise || linha?.nome_analise_lead || ra?.clientName || ra?.lead?.clientName
      || _cleanArquivoIdentity(linha?.nome_arquivo || linha?.arquivo_nome || "") || "").trim();
  };
  const podeFundirCom = (linha) => _nomesPodemSerOMesmoCliente(nomeVisivelNovo, nomeVisivelDaLinha(linha));

  // v1144 — "por que 2x em cada importação? não tem nem coerência isso" (dono). Ele está certo.
  //
  // Esta busca sempre rodou DUAS vezes por importação, respondendo perguntas escritas em épocas
  // diferentes, uma sem saber da outra:
  //   1ª — ao abrir o ZIP: "esse cliente já existe?", pra reaproveitar as transcrições já pagas
  //        (e, desde a v1141, a análise já salva);
  //   2ª — ao salvar: "atualizo o cadastro que existe ou crio um novo?", a trava contra duplicata.
  //
  // A resposta é a MESMA nas duas. Desde a v1141 a primeira já devolve o id do cliente encontrado,
  // então a segunda só precisa CONFERIR aquele id — uma leitura pontual de UMA linha — em vez de
  // varrer a carteira de novo.
  //
  // Por que conferir e não confiar direto: o id vai e volta pelo navegador (viaja dentro do
  // resultado da análise), e nada que vem de fora manda numa decisão de fundir cadastros. A
  // conferência usa as MESMAS regras da busca (telefone, nome do arquivo ou nome do cliente). Se
  // não bater, ou se a linha não existir, a busca normal roda inteira logo abaixo — a trava contra
  // duplicata continua sendo a mesma de sempre.
  const idConferir = String(idJaIdentificado || "").trim();
  if (idConferir) {
    try {
      const { data: linha, error: erroId } = await supabase
        .from("whatsapp_processamentos")
        .select("id,nome_arquivo,arquivo_nome,telefone,etapa,resultado_analise,timeline_json,criado_em,created_at,atualizado_em,updated_at")
        .eq("id", idConferir)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!erroId && linha?.id) {
        const ra = linha.resultado_analise || {};
        const foneLinha = _digitsIdentity(ra?.lead?.phone || linha.telefone || "");
        const arquivoLinha = _nomeIdentity(linha.nome_arquivo || linha.arquivo_nome || "");
        const nomeLinha = _nomeIdentity(ra?.clientName || ra?.lead?.clientName || linha.nome_arquivo || linha.arquivo_nome || "");
        // v1176/v1177 — o TELEFONE só vale quando os nomes podem ser a mesma pessoa (é a chave
        // que cruzava clientes sem nenhuma relação). O nome do arquivo continua valendo sozinho:
        // ele é o nome do contato na hora da exportação, e o corretor pode ter editado o nome do
        // cadastro depois (v1061) — exigir que os dois batam quebraria a atualização do MESMO
        // cliente, que é o caso comum.
        const bateFone = !!phoneKey && foneLinha.length >= 8 && foneLinha.slice(-8) === phoneKey && podeFundirCom(linha);
        // v1181 — o id conferido segue as MESMAS regras da busca: arquivo igual também precisa
        // passar pela trava de pessoas diferentes (ver o comentário no caminho rápido).
        const bateArquivo = arquivoKey.length >= 3 && !!arquivoLinha && arquivoLinha === arquivoKey && podeFundirCom(linha);
        const bateNome = nomeNovo.length >= 3 && !_nomeRuimIdentity(nomeNovo) && !!nomeLinha
          && !_nomeRuimIdentity(nomeLinha) && _nomesMesmoLead(nomeLinha, nomeNovo);
        if (bateFone || bateArquivo || bateNome) {
          return {
            row: { ...linha, timeline_json: Array.isArray(linha.timeline_json) ? linha.timeline_json : [] },
            via: bateFone ? "id-conferido-telefone" : (bateArquivo ? "id-conferido-arquivo" : "id-conferido-nome")
          };
        }
      }
    } catch (_) { /* qualquer problema aqui: segue pela busca completa abaixo */ }
  }

  // v1092 — CAMINHO RÁPIDO (migração 0010). As três regras de deduplicação são de IGUALDADE
  // EXATA sobre texto normalizado (telefone: últimos 8 dígitos; arquivo e nome: minúsculas, sem
  // acento, espaços colapsados — ver _nomesMesmoLead, que é literalmente `a === b`). Isso permite
  // trocar a varredura da carteira por três consultas pontuais e indexadas.
  //
  // A regra de ouro aqui: este caminho SÓ ACELERA, nunca decide sozinho que um lead é novo. Se
  // ele não encontrar ninguém, a varredura antiga roda logo abaixo e continua sendo a fonte da
  // verdade. Assim, se a migração não tiver sido aplicada, ou se o preenchimento inicial das
  // colunas discordar em algum caso da normalização daqui, o pior que acontece é continuar lento
  // — nunca criar um cadastro duplicado.
  if (_dedupeIndexadoDisponivel !== false) {
    const tentativas = [
      phoneKey ? { coluna: "dedupe_fone8", valor: phoneKey, via: "telefone" } : null,
      arquivoKey.length >= 3 ? { coluna: "dedupe_arquivo", valor: arquivoKey, via: "arquivo" } : null,
      (nomeNovo.length >= 3 && !_nomeRuimIdentity(nomeNovo)) ? { coluna: "dedupe_nome", valor: nomeNovo, via: "nome" } : null
    ].filter(Boolean);
    for (const t of tentativas) {
      let achados = null, erroIdx = null;
      try {
        ({ data: achados, error: erroIdx } = await supabase
        .from("whatsapp_processamentos")
        .select("id,nome_arquivo,arquivo_nome,telefone,etapa,resultado_analise,timeline_json,criado_em,created_at,atualizado_em,updated_at")
        .eq("organization_id", organizationId)
        .eq(t.coluna, t.valor)
        .order("atualizado_em", { ascending: false })
        .limit(1));
      } catch (_) {
        // O construtor de consulta não aceitou este encadeamento (versão diferente do cliente
        // Supabase, ou um duble de teste mais simples). O caminho rápido é só otimização: desliga
        // e segue pela varredura, que dá exatamente o mesmo resultado.
        _dedupeIndexadoDisponivel = false;
        break;
      }
      if (erroIdx) {
        // Coluna ainda não existe (migração 0010 não aplicada): desliga o caminho rápido neste
        // processo e segue pela varredura. Não é erro — é o estado esperado antes da migração.
        if (/column|schema cache/i.test(String(erroIdx.message || ""))) {
          _dedupeIndexadoDisponivel = false;
          // v1096 — a busca acabou de PROVAR que estas colunas não existem. Avisa a gravação
          // agora, pra ela não redescobrir a mesma coisa uma ida ao banco por vez, logo depois,
          // carregando a conversa inteira em cada tentativa.
          for (const c of ["dedupe_fone8", "dedupe_arquivo", "dedupe_nome"]) {
            _anotarColunaInexistente("whatsapp_processamentos", c);
          }
          break;
        }
        break; // erro de rede/banco: cai na varredura, que tem o mesmo resultado
      }
      _dedupeIndexadoDisponivel = true;
      const achado = Array.isArray(achados) && achados[0];
      // v1181 — TODAS as chaves passam pela trava, inclusive o nome do arquivo.
      //
      // A v1176/v1177 deixou o arquivo de fora com o argumento de que "o nome do arquivo já é o
      // nome do contato". Deixou de ser verdade no instante em que uma importação entra no
      // cadastro errado: a gravação sobrescreve `nome_arquivo`/`dedupe_arquivo` do cadastro
      // invadido com o arquivo da OUTRA pessoa (ver updatePayload em persistProcessingResult).
      // A partir daí, toda reexportação daquela conversa volta pro cadastro errado por esta
      // chave — foi o que o dono viu: nome do cliente já corrigido na v1180 e a conversa caindo
      // no mesmo lead de novo. A trava não exige nomes iguais (nome editado à mão e nome sem
      // identidade continuam passando, v1061); ela só proíbe juntar duas pessoas diferentes.
      if (achado && podeFundirCom(achado)) return { row: achado, via: t.via };
    }
  }

  // v1086 — esta varredura roda DUAS VEZES por importação (no "preparar" e de novo ao salvar).
  // Ela precisa só de nome/telefone pra achar o cliente, mas trazer o timeline_json junto
  // significa baixar a CONVERSA INTEIRA de até 5 mil leads — dezenas ou centenas de MB, duas
  // vezes, a cada importação. Era o que fazia a importação levar minutos.
  //
  // A v1082 já tinha tirado o timeline_json daqui, mas buscava a conversa do lead encontrado numa
  // segunda consulta que, se falhasse, devolvia conversa vazia SEM ERRO NENHUM — e conversa vazia
  // aqui significa perder o cache de transcrição (re-transcreve tudo) e, no salvamento, perder o
  // histórico. Foi o que quebrou a importação e obrigou o revert na v1085.
  //
  // Agora tem as duas coisas: a varredura é leve E a conversa do lead encontrado nunca some em
  // silêncio — a segunda busca tenta 3 vezes e, se ainda assim não conseguir, ESTOURA. Quem chama
  // decide o que fazer com o erro, mas ninguém mais recebe uma conversa vazia achando que é real.
  // v1143 — a varredura ficou LEVE DE VERDADE. A v1086 tirou daqui a conversa (timeline_json),
  // mas continuou trazendo `resultado_analise` — a ANÁLISE INTEIRA (diagnóstico, três mensagens,
  // memória, histórico) de até 5 mil clientes, duas vezes por importação, pra usar só duas coisas:
  // o telefone e o nome do cliente. Numa carteira de verdade isso é megabytes de tráfego e
  // segundos de espera em CADA importação — inclusive na conversa de 2 mensagens sem áudio que o
  // dono relatou ("demora demais, está impraticável").
  //
  // Agora o banco devolve só esses dois campos, extraídos direto do JSON. Se a versão do banco não
  // aceitar essa forma de pedir, cai automaticamente na consulta antiga — nunca deixa de achar o
  // cliente por causa de otimização.
  const COLUNAS_LEVES = "id,nome_arquivo,arquivo_nome,telefone,etapa,criado_em,created_at,atualizado_em,updated_at,fone_analise:resultado_analise->lead->>phone,nome_analise:resultado_analise->>clientName,nome_analise_lead:resultado_analise->lead->>clientName";
  const COLUNAS_COMPLETAS = "id,nome_arquivo,arquivo_nome,telefone,etapa,resultado_analise,criado_em,created_at,atualizado_em,updated_at";
  const varrer = (colunas) => supabase
    .from("whatsapp_processamentos")
    .select(colunas)
    .eq("organization_id", organizationId)
    .order("atualizado_em", { ascending: false })
    .limit(5000);
  let data = null, error = null;
  try { ({ data, error } = await varrer(COLUNAS_LEVES)); }
  catch (e) { error = { message: e?.message || String(e) }; }
  if (error || !Array.isArray(data)) {
    try { ({ data, error } = await varrer(COLUNAS_COMPLETAS)); }
    catch (e) { return null; }
  }
  if (error || !Array.isArray(data)) return null;

  // A releitura do cliente encontrado traz o que a varredura deixou de fora: a conversa E a
  // análise salva (esta última é o que permite reaproveitar a análise numa reimportação sem
  // novidade — ver v1141 — e o que a gravação mescla ao salvar).
  const comTimeline = async (row, via) => {
    let ultimoErro = null;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      if (tentativa) await new Promise(r => setTimeout(r, 300 * tentativa));
      // v1163 — o filtro por empresa vai junto por princípio, não porque falte aqui: o `row.id`
      // veio de uma busca que já filtrou a empresa. Mas o backend usa a chave de serviço, que
      // passa por cima da RLS — a parede entre contas depende de TODA consulta filtrar. Uma
      // consulta sem o filtro, mesmo inofensiva hoje, é o molde que alguém copia amanhã.
      const { data: cheio, error: erroTl } = await supabase
        .from("whatsapp_processamentos")
        .select("id,timeline_json,resultado_analise")
        .eq("id", row.id)
        .eq("organization_id", organizationId)
        .order("atualizado_em", { ascending: false })
        .limit(1);
      if (erroTl) { ultimoErro = new Error(erroTl.message); continue; }
      const achado = Array.isArray(cheio) ? cheio.find(r => String(r?.id) === String(row.id)) : null;
      if (!achado) { ultimoErro = new Error("registro não voltou na releitura"); continue; }
      return {
        row: {
          ...row,
          timeline_json: Array.isArray(achado.timeline_json) ? achado.timeline_json : [],
          resultado_analise: (achado.resultado_analise && typeof achado.resultado_analise === "object")
            ? achado.resultado_analise
            : (row.resultado_analise || {})
        },
        via
      };
    }
    // Nunca devolve conversa vazia como se fosse a real: sem isso, o salvamento apagaria o
    // histórico do lead e a importação re-transcreveria todos os áudios sem ninguém perceber.
    throw new Error(`Não consegui ler a conversa já salva deste cliente (${row.id}): ${ultimoErro?.message || "motivo desconhecido"}`);
  };
  // v1176/v1177/v1181 — telefone E nome de arquivo passam pela trava de pessoas diferentes. Nome
  // editado à mão pelo corretor continua reconhecendo o mesmo cliente (a trava aceita nome contido
  // e nome sem identidade); o que ela proíbe é uma conversa entrar no cadastro de outra pessoa.
  for (const row of data) {
    const ra = row.resultado_analise || {};
    const rowPhone = _digitsIdentity(row.fone_analise || ra?.lead?.phone || row.telefone || "");
    if (phoneKey && rowPhone.length >= 8 && rowPhone.slice(-8) === phoneKey && podeFundirCom(row)) return comTimeline(row, "telefone");
  }
  for (const row of data) {
    const rowFile = _chaveIdentidadeUtil(row.nome_arquivo || row.arquivo_nome || "");
    // v1181 — mesma trava do caminho rápido acima: nome de arquivo igual não junta duas pessoas.
    if (arquivoKey.length >= 3 && rowFile && rowFile === arquivoKey && podeFundirCom(row)) return comTimeline(row, "arquivo");
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
      const rowName = _nomeIdentity(row.nome_analise || row.nome_analise_lead || ra?.clientName || ra?.lead?.clientName || row.nome_arquivo || row.arquivo_nome || "");
      if (rowName && !_nomeRuimIdentity(rowName) && _nomesMesmoLead(rowName, nomeNovo)) return comTimeline(row, "nome");
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

// v1148 — exportada pra a ação de juntar dois cadastros do mesmo cliente (api/lead-update.js)
// usar exatamente a MESMA mesclagem de análise que a reimportação usa. Duas regras diferentes pra
// juntar dados do mesmo cliente é como se cria divergência silenciosa.
export function _mesclarAnaliseV681(anterior = {}, nova = {}) {
  anterior = _semScoreComercial(anterior || {});
  nova = _semScoreComercial(nova || {});
  const merged = { ...anterior, ...nova };
  const storageRefs = mergeStorageRefs(anterior?._storageRefs, nova?._storageRefs);
  if (storageRefs) merged._storageRefs = storageRefs;
  // v1107 — o caminho "salvar-novo" chega aqui com _historicoImportacoes de 1 item; o spread
  // acima fazia esse array SUBSTITUIR a lista acumulada do lead (perdendo a trilha de auditoria
  // e enfraquecendo idsImportacaoDoRegistro). Acumula como o caminho atualizar-com-evolucao.
  const histAnt = Array.isArray(anterior?._historicoImportacoes) ? anterior._historicoImportacoes : [];
  const histNovo = Array.isArray(nova?._historicoImportacoes) ? nova._historicoImportacoes : [];
  if (histAnt.length || histNovo.length) merged._historicoImportacoes = [...histAnt, ...histNovo].slice(-50);
  merged.memoria = { ...((anterior || {}).memoria || {}), ...((nova || {}).memoria || {}) };
  for (const key of ["aprendizado", "venda", "motivoPerda", "motivo_perda"]) {
    if (merged[key] === undefined || merged[key] === null || merged[key] === "") merged[key] = anterior?.[key];
  }
  // v1069 — bug real relatado (lead com lembrete que o corretor nunca agendou): "lembrete" saiu
  // do loop genérico acima de propósito. Aquele loop só restaura anterior[key] quando merged[key]
  // já está vazio — mas o spread {...anterior, ...nova} logo no início já carrega
  // anterior.lembrete pra dentro de merged.lembrete sempre que "nova" não mexe nesse campo (o
  // caso comum: reimportar/mesclar não toca lembrete, que só muda pelas ações explícitas
  // reagendar-lembrete/remover-lembrete) — então merged.lembrete NUNCA chegava vazio ali, e a
  // checagem de auto:true nunca era executada. Filtra direto o que sobrou em merged.lembrete
  // (seja de nova ou herdado de anterior via spread): um lembrete "auto" (resíduo da extração
  // automática por texto, removida na v988) nunca sobrevive a uma mesclagem. Mesma regra que
  // api/reanalisar-lead.js (aplicarLembrete) já usa.
  if (merged.lembrete && merged.lembrete.auto === true) merged.lembrete = undefined;
  const nomeAnt = anterior?.clientName || anterior?.lead?.clientName || "";
  const nomeNovo = nova?.clientName || nova?.lead?.clientName || "";
  if (_nomeRuimIdentity(nomeNovo) && !_nomeRuimIdentity(nomeAnt)) {
    merged.clientName = nomeAnt;
    merged.lead = { ...(merged.lead || {}), clientName: nomeAnt, phone: merged?.lead?.phone || anterior?.lead?.phone || "" };
  }
  // v1176 — TELEFONE DIGITADO PELO CORRETOR NUNCA É APAGADO POR UMA REIMPORTAÇÃO.
  // Desde que o número achado no meio da conversa deixou de virar "telefone do cliente" (ver
  // telefoneDoContatoExportado em _pipeline.js), a importação chega quase sempre SEM telefone —
  // e o spread {...anterior, ...nova} trocaria o objeto `lead` inteiro, levando junto o número
  // que o corretor tinha cadastrado na mão. O que vale é: telefone novo só substitui se existir.
  const fonteAnt = String(anterior?.lead?.phone || "").trim();
  const fonteNovo = String(nova?.lead?.phone || "").trim();
  if (!fonteNovo && fonteAnt) merged.lead = { ...(merged.lead || {}), phone: fonteAnt };
  const prodAnt = anterior?.produtoInteresse || anterior?.lead?.product || "";
  const prodNovo = nova?.produtoInteresse || nova?.lead?.product || "";
  if ((!prodNovo || /não identificado|nao identificado/i.test(prodNovo)) && prodAnt) {
    merged.produtoInteresse = prodAnt;
    merged.lead = { ...(merged.lead || {}), product: prodAnt };
  }
  return _semScoreComercial(merged);
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

  const attempts = [];
  let processingRow = null;

  // v1144 — o id que a etapa de abrir o ZIP já identificou viaja aqui dentro do resultado da
  // análise (incrementalMeta.existingLeadId). Com ele, a busca ao salvar confere UMA linha em vez
  // de varrer a carteira inteira de novo — e continua caindo na busca completa se não bater.
  const existenteV681 = forceNew
    ? null
    : await _buscarProcessamentoExistenteV681(supabase, {
      result, fileName: nomeArquivo, path, organizationId,
      idJaIdentificado: result?.incrementalMeta?.existingLeadId || ""
    });

  // v1092 — as três chaves de deduplicação vão gravadas junto (migração 0010). Elas são
  // calculadas exatamente pelas MESMAS funções que a busca usa, então o caminho rápido e a
  // varredura nunca podem discordar. Se as colunas ainda não existirem no banco, a gravação
  // adaptativa as descarta em silêncio (elas estão na lista de COLUNAS_ADAPTAVEIS de propósito).
  const _foneDedupe = _digitsIdentity(lead?.phone || analysis?.lead?.phone || "");
  const canonicalPayload = {
    organization_id: organizationId,
    nome_arquivo: nomeArquivo,
    arquivo_nome: nomeArquivo,
    dedupe_fone8: _foneDedupe.length >= 8 ? _foneDedupe.slice(-8) : null,
    // v1176 — chave genérica ("conversa-whatsapp.zip") não é identidade de ninguém: fica em branco
    // pra não colar duas importações sem nome no mesmo cliente (ver _chaveIdentidadeUtil).
    dedupe_arquivo: _chaveIdentidadeUtil(nomeArquivo) || null,
    dedupe_nome: _chaveIdentidadeUtil(analysis?.clientName || analysis?.lead?.clientName || lead?.clientName || nomeArquivo) || null,
    status: "pronto",
    // v1082 — a etapa é decisão DO CORRETOR, não da IA. Só existem dois valores desde a v1069
    // ("Ativo" e "Geladeira", ver ETAPAS_VALIDAS em api/lead-update.js). Antes entrava aqui o
    // "etapaSugerida" da IA, que é texto livre (o prompt pede "etapaSugerida":"texto" e o
    // fallback grava "Não identificado") — então a coluna acumulava vocabulário de funil que não
    // existe mais. O palpite da IA continua guardado dentro de resultado_analise.etapaSugerida,
    // que é onde ele sempre foi lido pra exibição; a coluna volta a ser só o estado real.
    etapa: "Ativo",
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
      // v1082 — reimportar a conversa NÃO pode desarquivar o lead. Como updatePayload espalha o
      // canonicalPayload, a etapa do registro antigo era sobrescrita a cada reimportação: um
      // cliente que o corretor tinha arquivado voltava sozinho pra fila do dia (a Home considera
      // ativo tudo que não é "Geladeira"). A etapa que vale é sempre a que já estava salva.
      etapa: normalizarEtapaBanco(anterior.etapa), // v1105 — não perpetua texto gravado no lugar da etapa
      // v1176 — reimportação sem telefone (o caso normal, ver telefoneDoContatoExportado) não pode
      // apagar a chave de telefone que o cadastro já tinha; senão o cliente que o corretor
      // identificou pelo número perderia esse reconhecimento na importação seguinte.
      dedupe_fone8: canonicalPayload.dedupe_fone8 || _chaveFone8(anterior.telefone || anterior.resultado_analise?.lead?.phone || ""),
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
        // v1107 — era um texto descritivo, que semeava de novo a "etapa suja" que a v1105 limpou.
        etapa: "Ativo",
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
      // v1176 — mesma regra da análise mesclada: importação sem telefone não apaga o número que
      // já estava cadastrado (quase sempre digitado à mão pelo corretor).
      telefone: lead?.phone || existenteV681?.row?.telefone || existenteV681?.row?.resultado_analise?.lead?.phone || null,
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
    //
    // v1082 — SÓ a conta original escreve aqui. Estas duas tabelas são anteriores às contas por
    // login e NUNCA ganharam a coluna organization_id (ver supabase/migrations/0001 e 0002, que
    // só acrescentaram a coluna em whatsapp_processamentos e direciona_config). Ou seja: tudo que
    // cai nelas fica sem dono. Os três lugares que leem essas tabelas — restaurar-leads.js,
    // leads-recentes.js (?export=full) e limpar-tudo.js — tratam TODA linha delas como sendo da
    // conta original. Enquanto qualquer corretor também gravava aqui, o cliente dele (nome,
    // telefone e análise inteira) entrava nesse balde sem dono; uma "Restauração de leads"
    // rodada depois pela conta original enxergava aquele id como "faltando" (currentKeys só
    // conhece os ids da própria conta) e o trazia pra si com upsert por id — reescrevendo o
    // registro do outro corretor e passando o lead dele pra conta original. Restringir a escrita
    // à conta original corta o problema na raiz e não tira nada de ninguém: pra todo mundo o
    // registro que vale é o de whatsapp_processamentos, que sempre carrega organization_id.
    if (organizationId === EMPRESA_PRINCIPAL_ID) {
      for (const table of ["leads", "direciona_leads"]) {
        try {
          leadRow = await tryUpsert(supabase, table, leadBase);
          break;
        } catch (error) {
          attempts.push({ table, model: "lead", error: error.message });
        }
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
// v1146 — quantas conversas esta carga pode buscar no banco pra recalcular os números do lead.
// É o teto que garante que a listagem SEMPRE responde rápido, mesmo no pior caso (virada do dia,
// que vence o cache da carteira inteira de uma vez). O que não couber fica pra próxima carga, com
// os números da carga anterior na tela. Configurável por variável de ambiente na Vercel.
const STATS_TIMELINES_POR_CARGA = Number(process.env.CORRETOR_PRO_STATS_TIMELINES_POR_CARGA) > 0
  ? Number(process.env.CORRETOR_PRO_STATS_TIMELINES_POR_CARGA)
  : 150;
// v1087 — TETO DE TEMPO. Este cache vence por DIA (ver cacheStats.dia === hoje em
// listRecentProcessings): à meia-noite ele vence pra CARTEIRA INTEIRA de uma vez. Na primeira
// abertura do dia, então, a listagem recalculava tudo E AINDA ESPERAVA até 500 gravações no banco
// (25 rodadas de 20, cada uma regravando o resultado_analise inteiro do lead) ANTES de responder.
// Era isso que fazia a primeira abertura do dia estourar o tempo e cair no "Carregamento demorou
// mais que o normal" — depois dela, com o cache quente, tudo voltava ao normal.
// A resposta NÃO depende dessas gravações: os números já foram calculados em memória e já estão
// prontos. Então elas passam a ter um orçamento de tempo curto: o que não couber fica pra próxima
// carga (que recalcula e tenta de novo), e nenhuma abertura paga mais que isso.
// v1146 — 1500ms era pouco DEMAIS pro trabalho grudar. Com 20 gravações por rodada, o orçamento
// antigo salvava umas poucas dezenas de leads por carga — então a carga seguinte recalculava quase
// tudo de novo, e a carteira nunca "esquentava". Combinado com o teto de leituras logo abaixo
// (STATS_TIMELINES_POR_CARGA), o volume por carga agora é conhecido e pequeno: dá pra gravar tudo
// o que foi calculado nesta carga, que é o que faz a próxima ser rápida de verdade.
const STATS_CACHE_WRITE_BUDGET_MS = 6000;
export async function persistStatsCacheWriteBacks(supabase, pendentes, organizationId) {
  const comecou = Date.now();
  const lote = pendentes.slice(0, STATS_CACHE_MAX_WRITEBACKS);
  for (let i = 0; i < lote.length; i += STATS_CACHE_WRITE_CONCURRENCY) {
    if ((Date.now() - comecou) > STATS_CACHE_WRITE_BUDGET_MS) break;
    const fatia = lote.slice(i, i + STATS_CACHE_WRITE_CONCURRENCY);
    await Promise.all(fatia.map(async (item) => {
      try {
        // v1082 — esta gravação regrava o resultado_analise INTEIRO como ele foi lido no começo
        // da listagem (só pra guardar o _statsCache do dia junto). Sem trava, ela desfazia
        // silenciosamente qualquer alteração feita ENQUANTO a listagem rodava: o corretor tocava
        // em "Reanalisar" (que pode levar até 60s), a Home fazia o refresh normal no meio, e o
        // refresh terminava depois — devolvendo a análise velha por cima da nova, com ok:true nos
        // dois lados. O mesmo valia pra "Copiar mensagem"/"Marcar atendido" registrados no meio.
        // Agora a gravação só vale se a linha não tiver sido tocada desde a leitura; se tiver,
        // ela é simplesmente pulada (é cache — a próxima carga recalcula e grava de novo).
        let q = supabase.from("whatsapp_processamentos")
          .update({ resultado_analise: item.resultado_analise, ...(item.etapa ? { etapa: item.etapa } : {}) })
          .eq("id", item.id).eq("organization_id", organizationId);
        if (item.atualizado_em) q = q.eq("atualizado_em", item.atualizado_em);
        await q;
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
  // Em esquemas antigos, cai para select("*").
  //
  // v1136 — timeline_json SAIU da listagem normal. Auditoria de 05/08/2026: a lista puxava a
  // conversa INTEIRA de todo lead a cada carga e mandava pro celular só 8 mensagens — com a Home
  // buscando a carteira a cada 2 minutos, era quase certamente o que estourava a cota de egress
  // do Supabase (5 GB no plano grátis, painel acusando desde a v1122). Agora a listagem confia no
  // _statsCache v3 (que carrega marca d'água, prévia e último toque — ver abaixo) e só busca a
  // timeline, numa SEGUNDA consulta e apenas das linhas cujo cache está frio/vencido. No detalhe
  // do lead (includeFullTimeline) a timeline continua vindo na consulta principal, como sempre.
  const LIST_COLUMNS_SEM_TIMELINE = "id,nome_arquivo,arquivo_nome,status,etapa,progresso,audios_encontrados,audios_transcritos,resultado_analise,criado_em,created_at,atualizado_em,updated_at";
  const LIST_COLUMNS_COM_TIMELINE = "id,nome_arquivo,arquivo_nome,status,etapa,progresso,timeline_json,audios_encontrados,audios_transcritos,resultado_analise,criado_em,created_at,atualizado_em,updated_at";
  const LIST_COLUMNS = includeFullTimeline ? LIST_COLUMNS_COM_TIMELINE : LIST_COLUMNS_SEM_TIMELINE;
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

  // v1063 — pedido explícito e repetido do dono: o ÚNICO filtro permitido no nome do lead é
  // tirar a "embalagem" do arquivo que o WhatsApp exporta (".zip", "-enxuto", "Conversa do
  // WhatsApp com ...") — NUNCA mexer em palavra nenhuma do nome real da pessoa (a v1062 tirou o
  // filtro que apagava "terreno"/"cel"/etc. de dentro do nome; isto aqui não é aquilo e não pode
  // virar aquilo de novo).
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
      "tipoRetomada", "tipoContato", "venda", "motivoPerda", "motivo_perda",
      "permuta", "risk", "produtoInteresse", "produtosInteresse", "mode",
      // v1239 — "leituraDaConversa" é a leitura que a IA faz da conversa antes de escrever as
      // mensagens, e é o que a tela mostra no bloco "Como conduzir este atendimento". Sem ela
      // aqui, o bloco só apareceria depois que o detalhe completo chegasse do servidor — ou seja,
      // sumia e voltava na frente do corretor a cada abertura de lead.
      "diagnostico", "leituraDaConversa", "leituraComercial", "modeloComercial", "_schemaComercial", "evolucao", "memoria", "aprendizado", "objections",
      "oportunidadeId", "contatoId", "origemOportunidadeId", "oportunidadesVinculadas",
      "sugestoesPendentes", "arquiteturaMensagens", "error",
      // v1241 — AUDITORIA DO DONO: "recomendacaoContato" ficava de fora e o aviso de AGUARDAR
      // ("ainda não é hora de mandar mensagem", com o motivo) sumia da tela até o detalhe
      // completo chegar do servidor. É justamente o aviso que evita o corretor mandar
      // mensagem num cliente que pediu espaço — não pode piscar.
      "recomendacaoContato",
      // v1239 — a prova de quanto do Cérebro foi enviado precisa viajar junto (a tela mostra).
      "cerebroAplicado", "cerebroEnviado", "conversaLidaPelaIA",
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
  // v1251 — primeiro instante do MÊS CORRENTE no calendário de Brasília (o dono pediu os números
  // "do primeiro ao último dia do mês", não dos últimos 30 dias). Brasília é UTC-3 fixo desde o
  // fim do horário de verão em 2019 — a mesma conta que inicioDoDiaBR já faz no app.
  const inicioDoMesBRMs = Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1, 1, 3, 0, 0, 0);
  // v1281 — o mesmo primeiro instante, só que do MÊS PASSADO: a tela de resultados tem o botão
  // "mês anterior" (v1106) e precisa das mensagens daquele mês contadas do mesmo jeito. Deriva do
  // mês corrente pra não depender do fuso do servidor (mesma lição da v1106 no app).
  const inicioDoMesAntBRMs = Date.UTC(
    Number(hoje.slice(5, 7)) === 1 ? Number(hoje.slice(0, 4)) - 1 : Number(hoje.slice(0, 4)),
    Number(hoje.slice(5, 7)) === 1 ? 11 : Number(hoje.slice(5, 7)) - 2,
    1, 3, 0, 0, 0
  );

  // v1136 — o cache v3 vale quando: mesma versão, mesmo dia (os números de 90 dias envelhecem) e
  // a MESMA marca d'água de alteração da linha (atualizado_em — é a mesma marca que a gravação de
  // volta da v1082 já usa como trava, e que toda mutação real de lead atualiza). Quando a timeline
  // está em mãos (detalhe, esquemas antigos com "*", clientes de teste), o tamanho dela também é
  // conferido — cinto e suspensório. Quando NÃO está (o caminho novo, sem egress), o cache ainda
  // precisa carregar a prévia e o total de mensagens, senão não há o que mostrar.
  const cacheV3Valido = (row, c, timelineOuNull) => {
    if (!c || c.v !== 5 || c.dia !== hoje) return false;
    const marcaRow = String(row.atualizado_em || row.updated_at || "");
    if (String(c.marca || "") !== marcaRow) return false;
    if (timelineOuNull) return c.len === timelineOuNull.length;
    return Number.isFinite(Number(c.len)) && Array.isArray(c.preview)
      && c.preview.length >= Math.min(previewLimit, Number(c.len) || 0);
  };

  // Segunda consulta: só as linhas cujo cache não serve (frio, vencido, de versão antiga) têm a
  // conversa buscada — em lotes de 50 pra não estourar o tamanho da URL do PostgREST. Falha aqui
  // é melhor esforço: a linha usa o último cache conhecido (números de ontem na tela são melhores
  // que zerar tudo) e a próxima carga tenta de novo.
  const timelinesBuscadas = new Map();
  // v1146 — quantos leads ficaram pra próxima carga (ver STATS_TIMELINES_POR_CARGA). Vai na
  // resposta pra dar pra ver, num diagnóstico, se a carteira está esquentando ou parada.
  let statsPendentes = 0;
  if (!includeFullTimeline) {
    // v1146 — TETO DE LEITURAS POR CARGA, com prioridade. Esta era a causa real do "carteira
    // travada" (prints do dono, 05/08/2026 19:04 e 19:06: dois minutos em "Carregando os leads").
    //
    // O cache por lead vence por DIA — ou seja, à meia-noite ele vence pra CARTEIRA INTEIRA. Sem
    // teto, a primeira carga do dia buscava a conversa de TODOS os leads (megabytes, em fatias de
    // 50, uma atrás da outra) e ainda tentava regravar tudo. Numa carteira grande isso não cabe nos
    // 60s da rota: a resposta morria no meio, quase nada era gravado, e a carga seguinte repetia o
    // mesmo trabalho condenado. Ficava preso nesse ciclo até a sorte de uma carga caber.
    //
    // Agora cada carga faz um pedaço e a carteira esquenta em algumas cargas, sempre respondendo
    // rápido. Ordem de prioridade das leituras:
    //   1. lead SEM cache nenhum (se ficar de fora, apareceria zerado — inaceitável);
    //   2. lead cujo cache é de OUTRA versão do registro (mudou de verdade: números errados);
    //   3. lead cujo cache só está de outro DIA (números de ontem, diferença mínima) — estes são
    //      os que sobram pra próxima carga, e é exatamente o que a v1136 já previa como aceitável
    //      ("números de ontem na tela são melhores que zerar tudo").
    const semCacheNenhum = [];
    const cacheDeOutraVersao = [];
    const cacheDeOutroDia = [];
    for (const row of (data || [])) {
      if (Array.isArray(row.timeline_json)) continue; // veio na consulta principal (fallback "*")
      const ana = row.resultado_analise || row.analysis || {};
      const c = (ana && typeof ana === "object") ? ana._statsCache : null;
      if (cacheV3Valido(row, c, null)) continue;
      const id = String(row.id);
      const temNumeros = !!c && Number.isFinite(Number(c.len));
      if (!temNumeros) { semCacheNenhum.push(id); continue; }
      const marcaRow = String(row.atualizado_em || row.updated_at || "");
      if (String(c.marca || "") !== marcaRow) cacheDeOutraVersao.push(id);
      else cacheDeOutroDia.push(id);
    }
    const precisamTimeline = [...semCacheNenhum, ...cacheDeOutraVersao, ...cacheDeOutroDia]
      .slice(0, STATS_TIMELINES_POR_CARGA);
    statsPendentes = Math.max(0, semCacheNenhum.length + cacheDeOutraVersao.length + cacheDeOutroDia.length - precisamTimeline.length);
    for (let i = 0; i < precisamTimeline.length; i += 50) {
      const fatia = precisamTimeline.slice(i, i + 50);
      try {
        const { data: cheios, error: erroTl } = await supabase
          .from("whatsapp_processamentos")
          .select("id,timeline_json")
          .eq("organization_id", organizationId)
          .in("id", fatia);
        if (erroTl || !Array.isArray(cheios)) continue;
        for (const r of cheios) timelinesBuscadas.set(String(r.id), Array.isArray(r.timeline_json) ? r.timeline_json : []);
      } catch (_) { /* melhor esforço — essas linhas seguem com o cache velho nesta carga */ }
    }
  }

  // Mesmo formato nos dois lugares que materializam mensagens (prévia do cache e resposta).
  const mapearMsgLista = (m) => ({
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
  });

  const mapped = (data || []).map(row => {
    const analysisOriginal = row.resultado_analise || row.analysis || {};
    let analysis = _semScoreComercial(analysisOriginal);
    // v1136 — três origens possíveis da conversa: veio na consulta principal (detalhe/fallback),
    // veio na segunda consulta (cache frio), ou NÃO veio (cache v3 em dia — o caminho barato).
    const timelineCarregada = Array.isArray(row.timeline_json)
      ? row.timeline_json
      : (timelinesBuscadas.has(String(row.id)) ? timelinesBuscadas.get(String(row.id)) : null);
    const temTimeline = timelineCarregada !== null;
    const timeline = timelineCarregada || [];
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
    // v1069 — mesma rede de segurança de leitura, agora pra "lembrete": um lembrete "auto"
    // (resíduo da extração automática por texto, removida na v988) que tenha sobrevivido no
    // banco de antes das correções em acaoAtualizarComEvolucao/_mesclarAnaliseV681 nunca mais
    // aparece como agendado, sem precisar reanalisar/tocar em cada lead antigo pra limpar.
    if (analysis && analysis.lembrete && analysis.lembrete.auto === true) {
      analysis = { ...analysis, lembrete: null };
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

    // v1251 — "mensagem que EU mandei", pro contador do mês. É o outro lado do ehClienteMsg, mas
    // não é simplesmente "tudo que não é do cliente": observação registrada à mão (visita, ligação,
    // nota, print) NÃO é mensagem, e sugestão da IA que ficou guardada também não — só vira
    // mensagem quando é copiada e enviada. Já a "Mensagem enviada (você)", que nasce quando o
    // corretor copia uma sugestão, CONTA: ela representa uma mensagem que ele mandou de verdade.
    const ehEnviadaPeloCorretor = (m) => {
      if (ehClienteMsg(m)) return false;
      const tp = String(m?.type || "");
      const src = String(m?.source || "");
      if (["atendimento", "nota", "ligacao", "visita", "presencial", "observacao_manual", "print-whatsapp"].includes(tp)) return false;
      if (tp === "sugestao-ia" || src === "assistant") return false;
      const autor = String(m?.author || "").trim();
      if (!autor || autor === "Sistema") return false;
      return !!String(m?.text || "").trim();
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
    // v1102 — cache v2: ganhou lastCorretorIso (última mensagem DO CORRETOR na conversa inteira).
    // Caso Jamil: a lista só carrega as últimas 8 mensagens; se todas forem do cliente, o app
    // dizia "nunca respondeu" mesmo com respostas mais antigas. O servidor enxerga o histórico
    // inteiro — então é ele quem informa.
    // v1136 — cache v3: ganhou a marca d'água (atualizado_em), a prévia de mensagens e o último
    // toque — é o que permite a listagem nem BUSCAR a conversa quando nada mudou (ver o
    // comentário em LIST_COLUMNS_SEM_TIMELINE). Caches v1/v2 antigos recalculam uma vez, com a
    // conversa vinda da segunda consulta, e regravam já no formato novo.
    const cacheValido = cacheV3Valido(row, cacheStats, temTimeline ? timeline : null);

    let lastReal, lastClient, lastCorretor, clientMessageCount, clientQuestionCount, clientMessageDays, messageCount90d, clientMessageCount90d, clientQuestionCount90d, clientMessageDays90d, hasProposal;
    // v1251 — mensagens DESTE MÊS (total, do cliente, minhas). Ver o comentário na varredura.
    let msgMesTotal, msgMesCliente, msgMesCorretor;
    // v1281 — as mesmas três contagens do MÊS PASSADO (ver inicioDoMesAntBRMs).
    let msgMesAntTotal, msgMesAntCliente, msgMesAntCorretor;
    if (cacheValido) {
      lastReal = cacheStats.lastIso ? { iso: cacheStats.lastIso } : null;
      lastClient = cacheStats.lastClientIso ? { iso: cacheStats.lastClientIso } : null;
      lastCorretor = cacheStats.lastCorretorIso ? { iso: cacheStats.lastCorretorIso } : null;
      clientMessageCount = cacheStats.clientMessageCount;
      clientQuestionCount = cacheStats.clientQuestionCount;
      clientMessageDays = cacheStats.clientMessageDays;
      messageCount90d = cacheStats.messageCount90d;
      clientMessageCount90d = cacheStats.clientMessageCount90d;
      // v1139 — campos novos: cache gravado antes desta versão não os tem (ficam undefined e o
      // navegador cai nos totais históricos). Como o cache vence todo dia (c.dia !== hoje), no
      // máximo até a virada do dia todos são regravados já com eles — sem precisar subir a
      // versão do cache e forçar uma varredura geral no meio do dia.
      clientQuestionCount90d = cacheStats.clientQuestionCount90d;
      clientMessageDays90d = cacheStats.clientMessageDays90d;
      hasProposal = cacheStats.hasProposal;
      msgMesTotal = Number(cacheStats.msgMesTotal) || 0;
      msgMesCliente = Number(cacheStats.msgMesCliente) || 0;
      msgMesCorretor = Number(cacheStats.msgMesCorretor) || 0;
      msgMesAntTotal = Number(cacheStats.msgMesAntTotal) || 0;
      msgMesAntCliente = Number(cacheStats.msgMesAntCliente) || 0;
      msgMesAntCorretor = Number(cacheStats.msgMesAntCorretor) || 0;
    } else if (!temTimeline) {
      // v1136 — cache frio E a segunda consulta falhou (rede/banco): melhor esforço. Usa o último
      // cache conhecido, mesmo vencido — números de ontem na tela são melhores que zerar tudo e
      // parecer que os dados sumiram. Nada é gravado de volta (nada novo foi calculado); a
      // próxima carga tenta buscar a conversa de novo.
      const c = (cacheStats && typeof cacheStats === "object") ? cacheStats : {};
      lastReal = c.lastIso ? { iso: c.lastIso } : null;
      lastClient = c.lastClientIso ? { iso: c.lastClientIso } : null;
      lastCorretor = c.lastCorretorIso ? { iso: c.lastCorretorIso } : null;
      clientMessageCount = Number(c.clientMessageCount) || 0;
      clientQuestionCount = Number(c.clientQuestionCount) || 0;
      clientMessageDays = Number(c.clientMessageDays) || 0;
      messageCount90d = Number(c.messageCount90d) || 0;
      clientMessageCount90d = Number(c.clientMessageCount90d) || 0;
      // v1139 — sem "|| 0" aqui de propósito: cache antigo não tem esses campos, e mandar 0
      // apagaria a recorrência/perguntas no ranking do navegador — ausente (null) faz o app cair
      // nos totais históricos, que é a degradação certa.
      clientQuestionCount90d = Number.isFinite(Number(c.clientQuestionCount90d)) ? Number(c.clientQuestionCount90d) : null;
      clientMessageDays90d = Number.isFinite(Number(c.clientMessageDays90d)) ? Number(c.clientMessageDays90d) : null;
      hasProposal = !!c.hasProposal;
      msgMesTotal = Number(c.msgMesTotal) || 0;
      msgMesCliente = Number(c.msgMesCliente) || 0;
      msgMesCorretor = Number(c.msgMesCorretor) || 0;
      msgMesAntTotal = Number(c.msgMesAntTotal) || 0;
      msgMesAntCliente = Number(c.msgMesAntCliente) || 0;
      msgMesAntCorretor = Number(c.msgMesAntCorretor) || 0;
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
      lastCorretor = null;
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
      // v1139 — o RANKING do "Fazer agora" passou a usar a mesma janela de 90 dias da barra
      // (régua única, decisão do dono) — então a recorrência (dias distintos) e as perguntas
      // ganham a versão 90d aqui, na MESMA varredura, sem custo extra. As versões de histórico
      // inteiro continuam existindo (elegibilidade/radar de lead antigo dependem delas).
      const cutoff90d = Date.now() - 90 * 24 * 60 * 60 * 1000;
      messageCount90d = 0;
      clientMessageCount90d = 0;
      clientQuestionCount90d = 0;
      const _diasComMsg90d = new Set();
      // v1251 — MENSAGENS DO MÊS, contadas aqui (onde a conversa INTEIRA está em mãos).
      // O painel novo mostra quantas mensagens foram trocadas no mês, quantas o corretor mandou e
      // quantas o cliente mandou. Até agora esse número era montado no navegador em cima da
      // PRÉVIA de 8 mensagens por lead — ou seja, saía errado (muito menor) pra qualquer cliente
      // com conversa de verdade. Sai na MESMA varredura, sem custo extra de loop.
      msgMesTotal = 0; msgMesCliente = 0; msgMesCorretor = 0;
      msgMesAntTotal = 0; msgMesAntCliente = 0; msgMesAntCorretor = 0;
      for (let i = timeline.length - 1; i >= 0; i--) {
        const m = timeline[i];
        const tMs = m?.iso ? Date.parse(m.iso) : NaN;
        const dentro90d = Number.isFinite(tMs) && tMs >= cutoff90d;
        if (Number.isFinite(tMs) && tMs >= inicioDoMesBRMs) {
          if (ehClienteMsg(m) && String(m?.text || "").trim()) {
            msgMesTotal++; msgMesCliente++;
          } else if (ehEnviadaPeloCorretor(m)) {
            msgMesTotal++; msgMesCorretor++;
          }
        } else if (Number.isFinite(tMs) && tMs >= inicioDoMesAntBRMs) {
          // v1281 — mês fechado anterior (o botão do mês passado na tela de resultados).
          if (ehClienteMsg(m) && String(m?.text || "").trim()) {
            msgMesAntTotal++; msgMesAntCliente++;
          } else if (ehEnviadaPeloCorretor(m)) {
            msgMesAntTotal++; msgMesAntCorretor++;
          }
        }
        if (dentro90d) messageCount90d++;
        if (!ehClienteMsg(m)) {
          // v1102 — mensagem real do CORRETOR (não manual, não sugestão da IA, autor de verdade).
          if (!lastCorretor && !ehItemManual(m)) {
            const tp = String(m?.type || ""), src = String(m?.source || "");
            const autor = String(m?.author || "").trim();
            if (tp !== "sugestao-ia" && src !== "assistant" && autor && autor !== "Sistema" && String(m?.text || "").trim()) {
              lastCorretor = m;
            }
          }
          continue;
        }
        if (!lastClient) lastClient = m; // a mais recente (varre de trás pra frente)
        const txt = String(m?.text || "").trim();
        if (!txt) continue;
        clientMessageCount++;
        if (dentro90d) clientMessageCount90d++;
        if (txt.includes("?")) {
          clientQuestionCount++;
          if (dentro90d) clientQuestionCount90d++;
        }
        const diaChave = m?.date || (m?.iso ? String(m.iso).slice(0, 10) : "");
        if (diaChave) {
          _diasComMsg.add(diaChave);
          if (dentro90d) _diasComMsg90d.add(diaChave);
        }
      }
      clientMessageDays = _diasComMsg.size;
      clientMessageDays90d = _diasComMsg90d.size;

      hasProposal = false;
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i]?.proposta) { hasProposal = true; break; }
      }

      const _etapaLimpa = normalizarEtapaBanco(row.etapa);
      statsCacheWriteBacks.push({
        id: row.id,
        // v1105 — autolimpeza: se a coluna etapa carrega texto de análise (244 registros no
        // backup real), esta mesma regravação — protegida pela marca d'água abaixo — corrige.
        ...(_etapaLimpa !== String(row.etapa || "") ? { etapa: _etapaLimpa } : {}),
        // Marca d'água da leitura: a gravação de volta só acontece se a linha continuar
        // exatamente como estava aqui (ver persistStatsCacheWriteBacks).
        atualizado_em: row.atualizado_em || null,
        resultado_analise: {
          ...(analysisOriginal && typeof analysisOriginal === "object" ? analysisOriginal : {}),
          _statsCache: {
            // v1251 — versão 4: entraram as mensagens DO MÊS (total/cliente/minhas). Subir a
            // versão obriga UMA varredura completa por lead na primeira carga depois de publicar
            // — depois disso volta ao regime barato de sempre (o cache já vence e é regravado
            // todo dia, então o custo extra real é só o dessa primeira vez).
            // v1281 — versão 5: as mesmas contagens do MÊS PASSADO, pra tela de resultados parar
            // de contar mensagem em cima da prévia de 8 por cliente (ver o comentário lá).
            v: 5,
            len: timeline.length,
            dia: hoje,
            // v1136 — a marca d'água que faz a listagem confiar neste cache SEM buscar a conversa:
            // qualquer mutação real do lead troca o atualizado_em e derruba o cache sozinha.
            marca: String(row.atualizado_em || row.updated_at || ""),
            lastIso: lastReal?.iso || null,
            lastClientIso: lastClient?.iso || null,
            lastCorretorIso: lastCorretor?.iso || null,
            // Último item da conversa (inclui itens manuais): alimenta "dias desde o último toque"
            // e o horário de fallback do card — antes vinham direto da timeline a cada carga.
            lastTouchIso: last?.iso || null,
            lastTouchTime: last?.time || null,
            clientMessageCount, clientQuestionCount, clientMessageDays,
            messageCount90d, clientMessageCount90d, clientQuestionCount90d, clientMessageDays90d, hasProposal,
            msgMesTotal, msgMesCliente, msgMesCorretor,
            msgMesAntTotal, msgMesAntCliente, msgMesAntCorretor,
            // A prévia que o celular recebe (as mesmas ~8 mensagens de sempre) — guardada pronta
            // pra lista não precisar da conversa inteira só pra montar isto.
            preview: timeline.slice(-8).map(mapearMsgLista)
          }
        }
      });
    }

    // v1136 — sem a conversa em mãos, o "último toque" vem do cache (lastTouchIso/lastTouchTime,
    // gravados na última varredura). Com ela, o comportamento é o de sempre.
    const ultimoToqueIso = temTimeline ? (last?.iso || null) : (cacheStats?.lastTouchIso || null);
    const ultimoToqueTime = temTimeline ? (last?.time || null) : (cacheStats?.lastTouchTime || null);
    const lastIso = lastReal?.iso || ultimoToqueIso || row.atualizado_em || row.updated_at || row.criado_em || row.created_at || null;
    const daysSince = diasCalendarioBR(lastIso);
    const lastTouchIso = ultimoToqueIso || lastIso;
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
    // v1136 — sem a conversa em mãos (cache v3 em dia), a prévia sai pronta do próprio cache:
    // são as mesmas ~8 mensagens que a lista sempre mostrou, gravadas na última varredura.
    const recentMessages = temTimeline
      ? (includeFullTimeline ? timeline : timeline.slice(-previewLimit)).map(mapearMsgLista)
      : (Array.isArray(cacheStats?.preview) ? cacheStats.preview.slice(-previewLimit) : []);
    const messageCountTotal = temTimeline
      ? timeline.length
      : (Number(cacheStats?.len) || recentMessages.length);

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
      bestTime: analysis?.bestTime || ultimoToqueTime || (analyzed ? "Ver análise" : "Aguardando nova análise"),
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
      // v1102 — última mensagem do CORRETOR sobre o histórico INTEIRO (a prévia de 8 mensagens
      // pode não conter nenhuma resposta dele, e aí o app diria "nunca respondeu" errado).
      lastCorretorMsgIso: lastCorretor?.iso || null,
      audiosEncontrados: row.audios_encontrados ?? null,
      audiosTranscritos: row.audios_transcritos ?? null,
      messageCount: messageCountTotal,
      messageCount90d,
      clientMessageCount,
      clientMessageCount90d,
      clientQuestionCount,
      clientMessageDays,
      // v1139 — janela de 90 dias pro ranking (régua única); null quando o cache antigo ainda
      // não tem os campos (o app cai nos totais acima).
      clientQuestionCount90d: Number.isFinite(Number(clientQuestionCount90d)) ? clientQuestionCount90d : null,
      clientMessageDays90d: Number.isFinite(Number(clientMessageDays90d)) ? clientMessageDays90d : null,
      hasProposal,
      // v1251 — mensagens deste mês, contadas no servidor sobre a conversa INTEIRA.
      msgMesTotal: Number(msgMesTotal) || 0,
      msgMesCliente: Number(msgMesCliente) || 0,
      msgMesCorretor: Number(msgMesCorretor) || 0,
      msgMesAntTotal: Number(msgMesAntTotal) || 0,
      msgMesAntCliente: Number(msgMesAntCliente) || 0,
      msgMesAntCorretor: Number(msgMesAntCorretor) || 0,
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
  const idsByKey = new Map();  // TODOS os ids juntados sob o mesmo cliente (pra apagar duplicados de uma vez)
  const ordem = [];
  for (const item of mapped) {
    const k = item.dedupeKey;
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
      deduplicated: Math.max(0, mapped.length - unique.length),
      // v1146 — leads cujos números ficaram pra próxima carga (teto de leituras por carga).
      statsPendentes,
      statsRecalculados: statsCacheWriteBacks.length
    }
  };
}

// v1083 — veio de api/limpar-tudo.js, que foi removida nesta versão junto com o botão
// "Apagar tudo" (decisão do dono: nunca seria usado). O painel administrativo continua
// precisando desta função pra apagar os arquivos de uma conta excluída (api/admin-contas.js),
// então ela passou a morar aqui, no módulo compartilhado.
export async function emptyBucket(supabase, bucket, prefix = "") {
  const todos = [];
  const PAGE = 1000;
  async function listFolder(prefix) {
    // list() nunca pagina sozinho — devolve no máximo PAGE itens por chamada. Uma pasta
    // compartilhada (ex.: transcription-cache/) pode facilmente passar de 1000 arquivos depois
    // de meses de uso; sem o loop de offset, "limpar tudo" parava no primeiro lote e reportava
    // sucesso (ok:true) deixando o resto pra trás.
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: PAGE,
        offset,
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
      if (!data || data.length < PAGE) break;
    }
    return { ok: true };
  }
  const walk = await listFolder(prefix);
  if (walk?.error) return { ok: false, error: walk.error, deleted: 0 };
  if (!todos.length) return { ok: true, deleted: 0 };
  // remove() em lotes de PAGE — mesma precaução, sem mudar quais arquivos são apagados.
  let deleted = 0;
  for (let i = 0; i < todos.length; i += PAGE) {
    const batch = todos.slice(i, i + PAGE);
    const { data, error } = await supabase.storage.from(bucket).remove(batch);
    if (error) return { ok: false, error: error.message, deleted };
    deleted += (data || []).length;
  }
  return { ok: true, deleted };
}
