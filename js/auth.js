// Conta individual por corretor (v980) — login/cadastro real via Supabase Auth, substitui a
// senha única compartilhada como porta de entrada. Fluxo e nomes de função inspirados no
// mesmo mecanismo já validado no projeto LeveCRM (accessLogin/accessRegister/accessPlanMessage),
// adaptado aos nomes e ao estilo do Corretor Pro.
import { qs, toast } from "./dom.js";

let supabaseAuthClient = null;
let sessaoAtual = null; // { access_token, user: { id, email } }
let contaInfo = null;   // { userId, email, nome, isAdmin, situacao, mensagem }

// Só decide o que MOSTRAR (o menu de administrador aparece ou não) — mesmo padrão já usado
// e validado no LeveCRM. A autorização de verdade é sempre conferida de novo no servidor
// (api/_auth.js), nunca confia só nisto aqui.
const EMAIL_ADMIN = "sanchaikraemer3@gmail.com";

async function carregarConfigAuth() {
  const res = await fetch("./api/auth-config", { cache: "no-store" });
  const data = await res.json().catch(() => ({ ok: false }));
  if (!data?.ok || !data?.configured) return null;
  return { url: data.supabaseUrl, anonKey: data.supabaseAnonKey };
}

async function obterClienteAuth() {
  if (supabaseAuthClient) return supabaseAuthClient;
  const cfg = await carregarConfigAuth();
  if (!cfg || typeof window.supabase?.createClient !== "function") return null;
  supabaseAuthClient = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return supabaseAuthClient;
}

export function obterTokenSessao() {
  return sessaoAtual?.access_token || "";
}

export function contaAtual() {
  return contaInfo;
}

// Mesma regra usada no servidor (api/_auth.js avaliarStatusDaConta) — aqui só decide o que
// MOSTRAR na tela; quem realmente barra o uso é sempre o servidor, em cada chamada de /api.
function avaliarAcessoLocal(profile) {
  const agora = Date.now();
  const status = String(profile?.account_status || "trial").toLowerCase();
  const trialEnd = profile?.trial_end ? Date.parse(profile.trial_end) : NaN;
  const licenseEnd = profile?.license_end ? Date.parse(profile.license_end) : NaN;
  const fmt = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR"); };
  if (status === "blocked") return { ok: false, mensagem: "Seu acesso foi bloqueado pelo administrador." };
  if (Number.isFinite(licenseEnd) && licenseEnd >= agora) return { ok: true, mensagem: `Licença ativa até ${fmt(profile.license_end)}.` };
  if (Number.isFinite(trialEnd) && trialEnd >= agora) return { ok: true, mensagem: `Teste grátis ativo até ${fmt(profile.trial_end)}.` };
  return { ok: false, mensagem: "Seu teste grátis de 7 dias expirou. Fale com o administrador para liberar o acesso." };
}

async function buscarPerfil(client, userId) {
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return null;
  return data;
}

function setMsg(tipo, texto) {
  const elErro = qs("#cpAuthMsgErro");
  const elOk = qs("#cpAuthMsgOk");
  if (elErro) elErro.style.display = "none";
  if (elOk) elOk.style.display = "none";
  if (!texto) return;
  const alvo = tipo === "erro" ? elErro : elOk;
  if (alvo) { alvo.textContent = texto; alvo.style.display = "block"; }
}

function mostrarPainel(nome) {
  const paineis = { login: "#cpAuthPanelLogin", cadastro: "#cpAuthPanelCadastro" };
  Object.entries(paineis).forEach(([key, sel]) => {
    const el = qs(sel);
    if (el) el.style.display = key === nome ? "block" : "none";
  });
  document.querySelectorAll(".cp-auth-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.authTab === nome);
  });
  const bloqueado = qs("#cpAuthBloqueado");
  if (bloqueado) bloqueado.style.display = "none";
  setMsg(null, "");
}

function mostrarBloqueado(mensagem) {
  ["#cpAuthPanelLogin", "#cpAuthPanelCadastro"].forEach(sel => { const el = qs(sel); if (el) el.style.display = "none"; });
  const bloqueado = qs("#cpAuthBloqueado");
  const msg = qs("#cpAuthBloqueadoMsg");
  const whats = qs("#cpAuthWhats");
  if (msg) msg.textContent = mensagem;
  if (bloqueado) bloqueado.style.display = "block";
  if (whats) {
    const texto = encodeURIComponent(`Olá! Meu teste do Corretor Pro expirou (ou está bloqueado) e quero liberar meu acesso. Meu e-mail: ${contaInfo?.email || ""}`);
    whats.href = `https://wa.me/?text=${texto}`;
  }
}

function abrirPortao() {
  const gate = qs("#cpAuthGate");
  if (gate) { gate.style.display = "flex"; gate.setAttribute("aria-hidden", "false"); }
  document.body.classList.add("cp-auth-locked");
}
function fecharPortao() {
  const gate = qs("#cpAuthGate");
  if (gate) { gate.style.display = "none"; gate.setAttribute("aria-hidden", "true"); }
  document.body.classList.remove("cp-auth-locked");
}

// Chamado uma vez, no boot do app. `aoLiberar` só roda depois que houver uma conta com
// acesso válido (teste em dia ou licença ativa) — é o mesmo papel que o prompt da chave
// única fazia antes, só que agora por conta de verdade.
export async function iniciarPortaoDeAcesso(aoLiberar) {
  abrirPortao();
  const client = await obterClienteAuth();
  if (!client) {
    mostrarBloqueado("Não foi possível preparar o login agora. Verifique sua internet e recarregue a página.");
    return;
  }

  async function aplicarSessao(session) {
    sessaoAtual = session;
    const perfil = await buscarPerfil(client, session.user.id);
    if (!perfil) return { ok: false, motivo: "Conta autenticada, mas o perfil ainda não foi criado. Aguarde alguns segundos e tente novamente." };
    const isAdmin = String(session.user.email || "").toLowerCase() === EMAIL_ADMIN;
    contaInfo = {
      userId: session.user.id,
      email: session.user.email,
      nome: perfil.nome || session.user.user_metadata?.nome || session.user.email,
      isAdmin,
      perfil
    };
    const botaoAdmin = qs("#btnAdminContas");
    if (botaoAdmin) botaoAdmin.style.display = isAdmin ? "flex" : "none";
    return isAdmin ? { ok: true, mensagem: "Administrador." } : avaliarAcessoLocal(perfil);
  }

  async function tentarEntrarComSessaoExistente() {
    const { data } = await client.auth.getSession();
    if (!data?.session) return false;
    const acesso = await aplicarSessao(data.session);
    if (acesso.ok) { fecharPortao(); aoLiberar(); return true; }
    mostrarBloqueado(acesso.motivo || acesso.mensagem);
    return true; // sessão existe (mesmo bloqueada) — não precisa mostrar login de novo
  }

  const jaTinhaSessao = await tentarEntrarComSessaoExistente().catch(() => false);
  if (jaTinhaSessao) return;
  mostrarPainel("login");

  document.querySelectorAll(".cp-auth-tab").forEach(btn => {
    btn.addEventListener("click", () => mostrarPainel(btn.dataset.authTab));
  });

  qs("#cpAuthPanelLogin")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    setMsg(null, "");
    const email = qs("#cpAuthLoginEmail")?.value.trim();
    const senha = qs("#cpAuthLoginSenha")?.value.trim();
    if (!email || !senha) return setMsg("erro", "Preencha e-mail e senha.");
    const botao = qs("#cpAuthBtnLogin");
    if (botao) { botao.disabled = true; botao.textContent = "Entrando..."; }
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      const acesso = await aplicarSessao(data.session);
      if (!acesso.ok) return mostrarBloqueado(acesso.motivo || acesso.mensagem);
      fecharPortao();
      toast(acesso.mensagem || "Bem-vindo de volta!");
      aoLiberar();
    } catch (err) {
      setMsg("erro", /invalid login credentials/i.test(err?.message || "") ? "E-mail ou senha não conferem." : "Não consegui entrar agora. Tente de novo em instantes.");
    } finally {
      if (botao) { botao.disabled = false; botao.textContent = "Entrar no Corretor Pro"; }
    }
  });

  qs("#cpAuthPanelCadastro")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    setMsg(null, "");
    const nome = qs("#cpAuthCadNome")?.value.trim();
    const email = qs("#cpAuthCadEmail")?.value.trim();
    const senha = qs("#cpAuthCadSenha")?.value.trim();
    if (!nome || !email || !senha) return setMsg("erro", "Preencha nome, e-mail e senha.");
    const botao = qs("#cpAuthBtnCadastro");
    if (botao) { botao.disabled = true; botao.textContent = "Criando conta..."; }
    try {
      const { data, error } = await client.auth.signUp({ email, password: senha, options: { data: { nome } } });
      if (error) throw error;
      if (!data?.session) {
        setMsg("ok", "Conta criada! Verifique seu e-mail para confirmar o cadastro e depois entre normalmente.");
        mostrarPainel("login");
        return;
      }
      const acesso = await aplicarSessao(data.session);
      if (!acesso.ok) return mostrarBloqueado(acesso.motivo || acesso.mensagem);
      fecharPortao();
      toast("Conta criada! " + (acesso.mensagem || ""));
      aoLiberar();
    } catch (err) {
      setMsg("erro", err?.message || "Não consegui criar sua conta agora.");
    } finally {
      if (botao) { botao.disabled = false; botao.textContent = "Criar conta e iniciar teste de 7 dias"; }
    }
  });
}

export async function sairDaConta() {
  try { const client = await obterClienteAuth(); await client?.auth.signOut(); } catch (_) {}
  sessaoAtual = null;
  contaInfo = null;
  location.reload();
}
window.sairDaContaCorretorPro = sairDaConta;

// ===== Painel de administrador — listar contas, liberar/bloquear =====
const SITUACAO_LABEL = {
  teste_ativo: "Teste grátis ativo",
  licenca_ativa: "Licença ativa",
  bloqueado: "Bloqueado",
  expirado: "Expirado"
};

function fmtDataHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

async function chamarAdminContas(body) {
  const res = await fetch("./api/admin-contas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json().catch(() => ({ ok: false, error: "Resposta inválida do servidor." }));
}

export async function carregarAdminContas() {
  const lista = qs("#adminContasLista");
  if (!lista) return;
  lista.innerHTML = '<div class="small" style="color:var(--muted)">Carregando...</div>';
  const data = await chamarAdminContas({ action: "listar" }).catch(e => ({ ok: false, error: e?.message }));
  if (!data?.ok) {
    lista.innerHTML = `<div class="small" style="color:var(--risco)">${data?.error || "Não foi possível carregar as contas."}</div>`;
    return;
  }
  const contas = Array.isArray(data.contas) ? data.contas : [];
  if (!contas.length) {
    lista.innerHTML = '<div class="small" style="color:var(--muted)">Nenhuma conta cadastrada ainda.</div>';
    return;
  }
  lista.innerHTML = contas.map(c => {
    const situacao = SITUACAO_LABEL[c.situacao] || c.situacao;
    const corSituacao = c.situacao === "bloqueado" || c.situacao === "expirado" ? "var(--risco)" : "var(--acao)";
    return `<div class="card compact" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div style="min-width:0">
          <div style="font-weight:900;font-size:15px;color:var(--text)">${escapeHtmlLocal(c.nome || c.email || "Sem nome")}</div>
          <div class="small" style="color:var(--muted)">${escapeHtmlLocal(c.email || "")}</div>
        </div>
        <div style="font-size:12px;font-weight:900;color:${corSituacao};white-space:nowrap">${escapeHtmlLocal(situacao)}</div>
      </div>
      <div class="small" style="color:var(--muted);margin-top:8px;line-height:1.6">
        Cadastro: ${fmtDataHora(c.criado_em)}<br>
        Teste até: ${fmtDataHora(c.trial_end)}<br>
        Licença até: ${fmtDataHora(c.license_end)}
      </div>
      <div class="btns" style="margin-top:10px">
        <button type="button" class="btn" style="width:auto;padding:8px 14px" onclick="cpAdminLiberar('${c.id}')">Liberar 30 dias</button>
        <button type="button" class="btn danger" style="width:auto;padding:8px 14px" onclick="cpAdminBloquear('${c.id}')">Bloquear</button>
      </div>
    </div>`;
  }).join("");
}
window.cpCarregarAdminContas = carregarAdminContas;

function escapeHtmlLocal(t) {
  return String(t ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[m]));
}

window.cpAdminLiberar = async function (userId) {
  const dias = prompt("Liberar acesso por quantos dias?", "30");
  if (dias === null) return;
  const r = await chamarAdminContas({ action: "liberar", userId, dias: Number(dias) || 30 }).catch(e => ({ ok: false, error: e?.message }));
  toast(r?.ok ? "Acesso liberado." : (r?.error || "Não foi possível liberar."));
  carregarAdminContas();
};

window.cpAdminBloquear = async function (userId) {
  if (!confirm("Bloquear o acesso desta conta agora?")) return;
  const r = await chamarAdminContas({ action: "bloquear", userId }).catch(e => ({ ok: false, error: e?.message }));
  toast(r?.ok ? "Acesso bloqueado." : (r?.error || "Não foi possível bloquear."));
  carregarAdminContas();
};
