import { state } from './js/state.js?v=__VERSION__';
import { COMMERCIAL_SCHEMA_VERSION, COMMERCIAL_SCHEMA_MINOR } from './js/commercial-schema.js?v=__VERSION__';
import { qs, qsa, isDesktop, escapeHtml, safeJson, toast } from './js/dom.js?v=__VERSION__';
import { configurarEscolhaTema } from './js/tema.js?v=__VERSION__';
import './js/proposta.js?v=__VERSION__';
import './js/pwa-install.js?v=__VERSION__';

// ===== Segurança v684-1: chave secreta nas chamadas /api =====
// Configure a mesma chave em Vercel > Environment Variables: CORRETOR_PRO_API_KEY.
// No primeiro uso, o app pergunta a chave e guarda apenas no navegador deste aparelho.
(function protegerChamadasApiV682(){
  if (typeof window === "undefined" || window.__corretorProFetchProtegido) return;
  window.__corretorProFetchProtegido = true;
  const STORAGE_KEY = "corretor_pro_api_key_v679"; // mantém chave já salva no aparelho
  const originalFetch = window.fetch.bind(window);
  function isApiUrl(input){
    const url = typeof input === "string" ? input : (input && input.url) || "";
    return /(^|\/)api\//.test(String(url));
  }
  function getKey(){
    try { return localStorage.getItem(STORAGE_KEY) || ""; } catch(_) { return ""; }
  }
  // v1004 — sessão de login por conta (quem entrou por entrar.html). Se existir, as chamadas
  // à API vão autenticadas como AQUELE corretor (Authorization: Bearer) e o servidor mostra só
  // os dados dele. Sem sessão, tudo segue exatamente como antes (chave compartilhada).
  function cpClienteSupabase(){
    try {
      if (!window.__cpSupabaseClient && window.supabase?.createClient && window.CORRETOR_PRO_SUPABASE_URL && window.CORRETOR_PRO_SUPABASE_ANON_KEY) {
        window.__cpSupabaseClient = window.supabase.createClient(window.CORRETOR_PRO_SUPABASE_URL, window.CORRETOR_PRO_SUPABASE_ANON_KEY);
      }
    } catch(_) {}
    return window.__cpSupabaseClient || null;
  }
  async function getSessionToken(){
    try {
      const cliente = cpClienteSupabase();
      if (!cliente) return "";
      const { data } = await cliente.auth.getSession();
      return data?.session?.access_token || "";
    } catch(_) { return ""; }
  }

  // v1007 — identidade visível de quem está logado: nome da conta na saudação e no menu,
  // e o botão "Sair da conta" (só aparece quando existe sessão de login neste aparelho).
  // v1024 — o cartão da lateral (cpNomeUser/cpAvatarUser) foi removido de vez (duplicava
  // "Sair da conta", pedido repetido do dono); só sobra o nome dentro da tela Menu.
  window.cpAtualizarIdentidadeVisivel = function(){
    try {
      const nome = String(state?.cerebroCfg?.corretorNome || window.__cpContaNome || "").trim();
      const bm = document.getElementById("cpNomeUserMenu");
      if (bm) bm.textContent = nome || "Corretor";
    } catch(_) {}
  };
  window.cpSairDaConta = async function(){
    // v1016 — confirm() nativo (a "tela feia" do navegador) não deixava claro que era uma
    // pergunta de verdade; troca pelo modal com a cara do próprio app (mesmo padrão já usado em
    // arquivar/perder lead), com Cancelar em destaque e o botão de sair marcado como ação de risco.
    const ok = (typeof cp903Confirm === "function")
      ? await cp903Confirm({ titulo: "Sair da conta", mensagem: "Deseja sair desta conta neste aparelho?", ok: "Sair", cancelar: "Cancelar", perigo: true })
      : confirm("Sair desta conta neste aparelho?");
    if (!ok) return;
    try { await window.__cpSupabaseClient?.auth?.signOut(); } catch(_) {}
    window.location.href = "/entrar.html";
  };
  (async function cpCarregarContaLogada(){
    try {
      const cliente = cpClienteSupabase();
      if (!cliente) return;
      const { data } = await cliente.auth.getSession();
      if (!data?.session) return;
      const btn = document.getElementById("btnSairConta");
      if (btn) btn.style.display = "";
      // O cartão "Conta" da tela Menu (Mais) só existe pra quem está logado — foi lá que o
      // dono procurou o sair primeiro (v1009).
      document.querySelectorAll(".cp-sair-conta").forEach(el => { el.style.display = ""; });
      // O nome da conta é o que a pessoa preencheu no cadastro (organizations.nome).
      // v1014 — este .eq("user_id", ...) NUNCA pode faltar: quem também é administrador da
      // plataforma tem uma política de RLS que libera ver TODOS os vínculos do sistema (pra
      // enxergar todas as empresas no painel administrativo) — sem filtrar pelo próprio user_id
      // aqui, a consulta pegava o vínculo mais recente CRIADO POR QUALQUER CONTA (ex.: uma conta
      // de teste criada um dia depois), mostrando o nome de OUTRA empresa na saudação/lateral do
      // administrador, mesmo com os dados corretos (a API de leads sempre filtrou certo).
      const { data: vinculo } = await cliente.from("memberships").select("organizations(nome)").eq("user_id", data.session.user.id).order("criado_em", { ascending: false }).limit(1).maybeSingle();
      const nome = String(vinculo?.organizations?.nome || "").trim();
      if (nome) { window.__cpContaNome = nome; }
      window.cpAtualizarIdentidadeVisivel();
    } catch(_) {}
  })();
  // v1013 — em aparelho compartilhado entre contas, o navegador pode restaurar a página "congelada"
  // da memória (botão voltar/avançar, ou trocar de aba e voltar) SEM recarregar o script — o nome
  // da conta é atualizado (a IIFE acima roda de novo), mas caches em memória de outra tela (lista
  // de leads, dashboard) podem continuar com o snapshot da conta anterior até a próxima navegação
  // de verdade. Forçar recarregamento completo nesse caso garante que a tela nunca mistura dado
  // de duas contas diferentes no mesmo aparelho.
  addEventListener("pageshow", (ev) => { if (ev.persisted) location.reload(); });
  // v1016 — causa raiz de "troquei de conta e continua puxando os leads da conta antiga":
  // com DUAS abas do Corretor Pro abertas no mesmo navegador (uma por conta), a sessão de login
  // fica guardada numa única "gaveta" (localStorage) compartilhada por todas as abas da mesma
  // origem. Ao logar como a 2ª conta numa aba nova, a aba ANTIGA (ainda aberta com a 1ª conta)
  // pode, segundos depois, renovar sozinha o próprio login em segundo plano e SOBRESCREVER a
  // gaveta com a sessão da conta antiga de novo — a aba nova então busca os leads já com o login
  // errado, mesmo mostrando o nome certo na saudação (que já tinha carregado antes disso acontecer).
  // Toda aba do site agora escuta essa gaveta: se OUTRA aba muda o login guardado nela, esta aba
  // recarrega sozinha na hora — assim nenhuma aba velha consegue "brigar" pela conta certa depois.
  addEventListener("storage", (ev) => { if (ev.key && ev.key.includes("auth-token")) location.reload(); });
  // v1082 — uma só ida pra tela de entrar. Sem esta trava, várias chamadas de API que voltam 401
  // ao mesmo tempo (a Home dispara várias de uma vez) mandavam a navegação de novo a cada uma.
  let jaMandouPraEntrar = false;
  function irParaEntrar(){
    if (jaMandouPraEntrar) return;
    jaMandouPraEntrar = true;
    try { window.location.href = "/entrar.html"; } catch(_) {}
  }
  // Mesma ideia pra caixinha da chave antiga: várias respostas 401 simultâneas empilhavam várias
  // caixinhas seguidas, uma por chamada. Agora pergunta uma vez e reaproveita a resposta.
  let chavePerguntadaNestaSessao = false;
  let chaveRespondida = "";
  function pedirChaveUmaVezSo(){
    if (chavePerguntadaNestaSessao) return chaveRespondida;
    chavePerguntadaNestaSessao = true;
    chaveRespondida = window.definirChaveSegurancaCorretorPro() || "";
    return chaveRespondida;
  }
  window.definirChaveSegurancaCorretorPro = function(){
    const atual = getKey();
    const valor = prompt("Informe a chave de segurança do Corretor Pro:", atual || "");
    if (valor && valor.trim()) {
      try { localStorage.setItem(STORAGE_KEY, valor.trim()); } catch(_) {}
      alert("Chave salva neste aparelho. Recarregue o app se a tela não atualizar sozinha.");
      return valor.trim();
    }
    return atual;
  };
  function agendarAprendizadoDepoisDaMutacao(input, init, resposta){
    if(!resposta?.ok) return;
    const url = String(typeof input === "string" ? input : (input && input.url) || "");
    let relevante = /api\/reanalisar-lead(?:\?|$)/.test(url);
    if(/api\/lead-update(?:\?|$)/.test(url)){
      try{
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : (init?.body || {});
        relevante = ["salvar-novo","atualizar-com-evolucao","memoria-set","observacao-adicionar"].includes(String(body?.action || ""));
      }catch(_){ relevante = false; }
    }
    if(relevante) setTimeout(() => window.iniciarAprendizadoContinuoAutomatico?.({ somentePendentes:true }), 700);
  }
  window.fetch = async function(input, init = {}){
    if (!isApiUrl(input)) return originalFetch(input, init);
    const key = getKey();
    const token = await getSessionToken();
    const headers = new Headers((init && init.headers) || (typeof input !== "string" && input?.headers) || {});
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    if (key && !headers.has("X-Corretor-Pro-Key")) headers.set("X-Corretor-Pro-Key", key);
    const res = await originalFetch(input, { ...init, headers });
    if (res.status === 401) {
      // Com login por conta, um 401 significa sessão vencida — volta pra tela de entrar,
      // nunca pro pedido da chave compartilhada (que não é desse fluxo).
      if (token) {
        irParaEntrar();
        return res;
      }
      // v1082 — SEM login e SEM chave salva neste aparelho: é gente que simplesmente não está
      // conectada (nunca entrou, ou saiu/limpou o navegador). Antes, o app abria a caixinha crua
      // do navegador pedindo "a chave de segurança do Corretor Pro" — algo que cliente nenhum tem
      // nem entende, e a tela ficava presa em "Reconectando…". Agora vai direto pra tela de entrar.
      // A caixinha da chave só continua existindo pra aparelho que JÁ usa esse caminho antigo
      // (chave guardada aqui) e cuja chave parou de valer — aí perguntar de novo faz sentido.
      if (!key) {
        irParaEntrar();
        return res;
      }
      const nova = pedirChaveUmaVezSo();
      if (nova && nova !== key) {
        const retryHeaders = new Headers(headers);
        retryHeaders.set("X-Corretor-Pro-Key", nova);
        const retry = await originalFetch(input, { ...init, headers: retryHeaders });
        agendarAprendizadoDepoisDaMutacao(input, init, retry);
        return retry;
      }
    }
    // Conta bloqueada/teste vencido (v1003): o servidor recusa tudo — manda de volta pra
    // tela de entrar, onde a mensagem de pagamento aparece.
    if (res.status === 403 && token) {
      try {
        const corpo = await res.clone().json();
        if (corpo?.bloqueado === true) { window.location.href = "/entrar.html"; return res; }
      } catch(_) {}
    }
    agendarAprendizadoDepoisDaMutacao(input, init, res);
    return res;
  };
})();

const KEEP_RE = /\.(txt|opus|ogg|mp3|m4a|wav|aac)$/i;

// ===== v929 — atividade de uso (Desempenho): análises, importações e tempo no app =====
// Fica só no localStorage DESTE aparelho (não sincroniza celular↔PC) — é contagem de USO, não
// dado comercial do cliente, então não precisa da sincronização via Supabase do resto do app.
const CP_ATIVIDADE_DIAS = 90; // guarda até 90 dias, poda o resto a cada gravação
function cpRegistrarAtividade(chave, quandoIso){
  try{
    const key = "cpAtividade_"+chave;
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(quandoIso || new Date().toISOString());
    const cutoff = Date.now() - CP_ATIVIDADE_DIAS*24*60*60*1000;
    const podado = arr.filter(iso => { const t = Date.parse(iso); return Number.isFinite(t) && t >= cutoff; });
    localStorage.setItem(key, JSON.stringify(podado));
  }catch(_){}
}
function cpContarAtividade(chave, desdeMs){
  try{
    const arr = JSON.parse(localStorage.getItem("cpAtividade_"+chave) || "[]");
    if(!desdeMs) return arr.length;
    return arr.filter(iso => { const t = Date.parse(iso); return Number.isFinite(t) && t >= desdeMs; }).length;
  }catch(_){ return 0; }
}
window.cpRegistrarAtividade = cpRegistrarAtividade;
window.cpContarAtividade = cpContarAtividade;

// Tempo no app: conta só enquanto a aba está VISÍVEL (em segundo plano não conta). Guardado por
// dia (chave de calendário BR), só neste aparelho.
const CP_TEMPO_APP_KEY = "cpTempoAppPorDia";
let _cpTempoAppInicioVisivel = (typeof document !== "undefined" && document.visibilityState === "visible") ? Date.now() : null;
function cpTempoAppHojeChave(){ return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date()); }
function cpTempoAppLerMapa(){
  try{ return JSON.parse(localStorage.getItem(CP_TEMPO_APP_KEY) || "{}"); }catch(_){ return {}; }
}
function cpTempoAppSalvarMapa(mapa){
  try{
    const chaves = Object.keys(mapa).sort();
    while(chaves.length > 30) delete mapa[chaves.shift()]; // guarda ~30 dias de histórico
    localStorage.setItem(CP_TEMPO_APP_KEY, JSON.stringify(mapa));
  }catch(_){}
}
function cpTempoAppAcumular(){
  if(_cpTempoAppInicioVisivel == null) return;
  const agora = Date.now();
  const ms = Math.max(0, agora - _cpTempoAppInicioVisivel);
  _cpTempoAppInicioVisivel = agora;
  if(ms <= 0) return;
  const mapa = cpTempoAppLerMapa();
  const chave = cpTempoAppHojeChave();
  mapa[chave] = Math.round((Number(mapa[chave]) || 0) + ms/1000);
  cpTempoAppSalvarMapa(mapa);
}
if(typeof document !== "undefined"){
  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "hidden"){ cpTempoAppAcumular(); _cpTempoAppInicioVisivel = null; }
    else { _cpTempoAppInicioVisivel = Date.now(); }
  });
  window.addEventListener("pagehide", cpTempoAppAcumular);
  setInterval(cpTempoAppAcumular, 60000); // flush a cada 1 min, sobrevive a fechamento abrupto
}
function cpTempoAppSegundosHoje(){ cpTempoAppAcumular(); const mapa = cpTempoAppLerMapa(); return Math.round(Number(mapa[cpTempoAppHojeChave()])||0); }
function cpTempoAppMediaSegundos7d(){
  const mapa = cpTempoAppLerMapa();
  const hoje = new Date();
  let total = 0, dias = 0;
  for(let i=0;i<7;i++){
    const d = new Date(hoje); d.setDate(d.getDate()-i);
    const chave = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(d);
    if(mapa[chave] != null){ total += Number(mapa[chave])||0; dias++; }
  }
  return dias ? Math.round(total/dias) : 0;
}
function cpFormatarDuracao(segundos){
  const s = Math.max(0, Math.round(segundos||0));
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  if(h > 0) return `${h}h ${String(m).padStart(2,"0")}min`;
  if(m > 0) return `${m}min`;
  return "menos de 1min";
}
window.cpTempoAppSegundosHoje = cpTempoAppSegundosHoje;
window.cpTempoAppMediaSegundos7d = cpTempoAppMediaSegundos7d;
window.cpFormatarDuracao = cpFormatarDuracao;

// ===== Atualização #724-2: instrumentação leve de performance =====
const CP_PERF_MAX = 80;
function cpPerfNow(){ try{ return performance.now(); }catch(_){ return Date.now(); } }
function cpPerfMark(nome, inicio, extra={}){
  try{
    const ms = Math.max(0, Math.round(cpPerfNow() - Number(inicio || cpPerfNow())));
    const arr = state.performance[nome] || (state.performance[nome] = []);
    arr.push({ ms, at:new Date().toISOString(), ...extra });
    if(arr.length > CP_PERF_MAX) arr.splice(0, arr.length - CP_PERF_MAX);
    return ms;
  }catch(_){ return 0; }
}
function cpPerfMedia(nome){
  const arr = state.performance?.[nome] || [];
  if(!arr.length) return 0;
  return Math.round(arr.reduce((s,x)=>s+Number(x.ms||0),0)/arr.length);
}
function cpMemoriaMB(){
  try{ return performance?.memory?.usedJSHeapSize ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : null; }catch(_){ return null; }
}
function cpPerformanceResumo(){
  const cacheHits = Number(state.performance?.cacheHits || 0);
  const cacheMisses = Number(state.performance?.cacheMisses || 0);
  const totalCache = cacheHits + cacheMisses;
  return {
    leadsCarregados: Array.isArray(state.todosLeads) ? state.todosLeads.length : (Array.isArray(state.leads) ? state.leads.length : 0),
    homeMs: cpPerfMedia("home"),
    leadMs: cpPerfMedia("leadDetail"),
    consultaMs: cpPerfMedia("leadsFetch"),
    renderCarteiraMs: cpPerfMedia("renderCarteira"),
    cacheHitPct: totalCache ? Math.round(cacheHits / totalCache * 100) : 0,
    memoriaMB: cpMemoriaMB()
  };
}
window.cpPerformanceResumo = cpPerformanceResumo;
function atualizarDiagnosticoPerformance(){
  const out = qs("#performanceDiagOut");
  const r = cpPerformanceResumo();
  if(out){
    out.innerHTML = `
      <b>Leads em memória:</b> ${Number(r.leadsCarregados||0)}<br>
      <b>Consulta da base:</b> ${Number(r.consultaMs||0)} ms<br>
      <b>Abrir lead:</b> ${Number(r.leadMs||0)} ms<br>
      <b>Render carteira:</b> ${Number(r.renderCarteiraMs||0)} ms<br>
      <b>Cache hit:</b> ${Number(r.cacheHitPct||0)}%${r.memoriaMB != null ? `<br><b>Memória:</b> ${Number(r.memoriaMB||0)} MB` : ""}
    `;
  }
  toast("Diagnóstico de performance atualizado.");
  return r;
}
window.atualizarDiagnosticoPerformance = atualizarDiagnosticoPerformance;


// Fetch com timeout: depois de voltar de outro app (WhatsApp etc.), a rede pode ficar
// "pendurada" por um tempo enquanto reconecta. Sem limite, o fetch nunca resolve nem
// rejeita — e uma tela que depende dele fica travada no skeleton pra sempre. Isso força
// o fetch a desistir depois de um tempo, pra sempre cair no catch/fallback de quem chamou.
async function fetchComTimeout(url, opts = {}, timeoutMs = 15000){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try{
    return await fetch(url, { ...opts, signal: controller.signal });
  }finally{
    clearTimeout(timer);
  }
}

// ===== Cache da base de leads (limit=2000) =====
// O app busca a base inteira em vários pontos (dashboard, agenda, pipeline, busca...).
// Sem cache, abrir a Hoje dispara 3-4 buscas pesadas ao mesmo tempo. Aqui guardamos o
// resultado por um tempo curto e DEDUPLICAMOS chamadas simultâneas (uma rajada = 1 busca).
// Mutações (salvar, mudar etapa, etc.) invalidam o cache pra não mostrar dado velho.
const LEADS_CACHE_TTL = 15000; // 15 s: evita leitura velha entre celular e PC
let _leadsCache = { ts: 0, data: null, inflight: null };
// Depois de uma mutação (salvar/editar/apagar/mudar etapa), a próxima busca precisa vir
// FRESCA do servidor — senão o cache de 30s do backend devolve a lista velha (lead apagado
// continua aparecendo, nome editado não muda). invalidarLeadsCache liga esse sinal.
// Começa LIGADO: a PRIMEIRA busca depois de abrir/recarregar a página (Ctrl+Shift+R) sempre
// força fresh=1, senão o PC pega o snapshot de 30s do backend (que pode viver em várias
// instâncias warm da Vercel) e não mostra o que acabou de ser importado em outro aparelho.
let _leadsForceFresh = true;
async function getLeadsData(force){
  const agora = Date.now();
  if(!force && _leadsCache.data && (agora - _leadsCache.ts) < LEADS_CACHE_TTL){ state.performance.cacheHits = Number(state.performance.cacheHits||0)+1; return _leadsCache.data; }
  state.performance.cacheMisses = Number(state.performance.cacheMisses||0)+1;
  const _perfStart = cpPerfNow();
  if(_leadsCache.inflight) return _leadsCache.inflight; // junta chamadas simultâneas numa só
  const usarFresh = force || _leadsForceFresh;
  _leadsForceFresh = false;
  _leadsCache.inflight = (async () => {
    try{
      const res = await fetchComTimeout(`./api/leads-recentes?limit=2000${usarFresh ? "&fresh=1" : ""}`, { cache:"no-store" });
      const data = await res.json().catch(() => ({ ok:false, items:[] }));
      // Só guarda no cache resposta BOA (HTTP 2xx + ok != false).
      // Respostas 401/403/500 com items[] não envenenam o cache.
      if(res.ok && data && data.ok !== false && Array.isArray(data.items)){
        // Normaliza uma única vez. As telas recebem os mesmos objetos e deixam de copiar
        // centenas de leads a cada clique.
        data.items = data.items.map(limparLead);
        _leadsCache = { ts: Date.now(), data, inflight: null };
        state.dataRevision = (Number(state.dataRevision) || 0) + 1;
        state.viewRendered = {};
      } else {
        _leadsCache = { ts: 0, data: _leadsCache.data, inflight: null };
      }
      cpPerfMark("leadsFetch", _perfStart, { total:Array.isArray(data?.items)?data.items.length:0, force:!!force });
      return data;
    }catch(e){
      _leadsCache = { ts: 0, data: _leadsCache.data, inflight: null };
      cpPerfMark("leadsFetch", _perfStart, { error:true, force:!!force });
      return { ok:false, items:[] };
    }
  })();
  return _leadsCache.inflight;
}

const LEGACY_RESTORE_KEY = "corretor_pro_restauracao_legado_v660";
let _legacyRestoreInflight = null;
async function restaurarLeadsAntigos(force = false){
  if(_legacyRestoreInflight) return _legacyRestoreInflight;
  const statusEl = qs("#legacyRestoreStatus");
  const btn = qs("#legacyRestoreBtn");
  if(btn) btn.disabled = true;
  if(statusEl) statusEl.textContent = "Conferindo a base anterior e restaurando os leads que faltam…";
  _legacyRestoreInflight = (async () => {
    try{
      const res = await fetchComTimeout("./api/restaurar-leads" + (force ? "?force=1" : ""), {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ force:false }),
        cache:"no-store"
      });
      const data = await res.json().catch(()=>({ok:false,error:"Resposta inválida do servidor."}));
      if(!res.ok || !data?.ok) throw new Error(data?.error || "Não foi possível restaurar os leads.");
      try{ localStorage.setItem(LEGACY_RESTORE_KEY, JSON.stringify({at:new Date().toISOString(), restored:Number(data.restored||0), legacyFound:Number(data.legacyFound||0)})); }catch(_){ }
      if(Number(data.restored||0) > 0){
        invalidarLeadsCache();
        if(statusEl) statusEl.innerHTML = `<span style="color:var(--acao)">${Number(data.restored||0)} leads restaurados. ${Number(data.alreadyPresent||0)} já estavam no sistema.</span>`;
        toast(`${Number(data.restored||0)} leads restaurados da base anterior.`);
      }else{
        if(statusEl) statusEl.innerHTML = Number(data.legacyFound||0) > 0
          ? `<span style="color:var(--acao)">Base conferida: todos os ${Number(data.uniqueLegacy||data.legacyFound||0)} leads antigos já estão no sistema.</span>`
          : `<span style="color:var(--muted)">Não encontrei leads nas tabelas antigas. Use o CSV de backup abaixo para restaurar.</span>`;
      }
      return data;
    }catch(err){
      if(statusEl) statusEl.innerHTML = `<span style="color:var(--risco)">${escapeHtml(err?.message || String(err))}</span>`;
      throw err;
    }finally{
      if(btn) btn.disabled = false;
      _legacyRestoreInflight = null;
    }
  })();
  return _legacyRestoreInflight;
}
async function garantirRestauracaoLeadsAntigos(){
  let done = false;
  try{ done = !!localStorage.getItem(LEGACY_RESTORE_KEY); }catch(_){ }
  if(done) return null;
  try{
    return await restaurarLeadsAntigos(false);
  }catch(_){
    // v1042 — essa restauração só é possível pra empresa original (dona das tabelas legadas);
    // pra qualquer outra empresa a chamada sempre vai falhar (403), sem nunca ficar diferente.
    // Sem marcar como "tentado" aqui, toda outra conta repetiria essa chamada perdida em todo
    // carregamento, pra sempre — marca como feito mesmo em erro, é tentativa única por navegador.
    try{ localStorage.setItem(LEGACY_RESTORE_KEY, JSON.stringify({at:new Date().toISOString(), falhou:true})); }catch(_){ }
    return null;
  }
}
window.restaurarLeadsAntigos = restaurarLeadsAntigos;

const LEAD_DETAIL_CACHE_TTL = 10 * 60 * 1000;
const _leadDetailCache = new Map();
async function getLeadDetail(id, force){
  const key = String(id || "");
  if(!key) throw new Error("Lead inválido.");
  const cached = _leadDetailCache.get(key);
  if(!force && cached?.data && (Date.now() - cached.ts) < LEAD_DETAIL_CACHE_TTL) return cached.data;
  if(cached?.inflight) return cached.inflight;
  const _perfStart = cpPerfNow();
  const inflight = (async () => {
    const res = await fetchComTimeout(`./api/lead-update?action=detalhe&id=${encodeURIComponent(key)}`, { cache:"no-store" });
    const data = await res.json().catch(()=>({ok:false}));
    if(!res.ok || !data?.ok || !data?.item) throw new Error(data?.error || "Não foi possível carregar o histórico completo.");
    const item = limparLead(data.item);
    cpPerfMark("leadDetail", _perfStart, { mensagens: totalMensagensLead(item) });
    _leadDetailCache.set(key, { ts:Date.now(), data:item, inflight:null });
    return item;
  })().catch(err => {
    const anterior = _leadDetailCache.get(key);
    if(anterior?.data) _leadDetailCache.set(key, { ts:anterior.ts, data:anterior.data, inflight:null });
    else _leadDetailCache.delete(key);
    throw err;
  });
  _leadDetailCache.set(key, { ts:cached?.ts || 0, data:cached?.data || null, inflight });
  return inflight;
}
function invalidarLeadDetail(id){
  if(id == null) _leadDetailCache.clear();
  else _leadDetailCache.delete(String(id));
}
function invalidarLeadsCache(){
  _leadsCache = { ts: 0, data: null, inflight: null };
  _leadsForceFresh = true; // a próxima busca ignora o cache de 30s do servidor
  invalidarLeadDetail();
  state.dataRevision = (Number(state.dataRevision) || 0) + 1;
  state.viewRendered = {};
}
function totalMensagensLead(l){
  // v1016: exibição pro corretor usa só os últimos 90 dias (messageCount90d) — messageCount
  // (histórico completo) continua existindo no dado só pra ranking/dedupe interno.
  const n90 = Number(l?.messageCount90d);
  if (Number.isFinite(n90)) return n90;
  const n = Number(l?.messageCount);
  return Number.isFinite(n) ? n : (Array.isArray(l?.recentMessages) ? l.recentMessages.length : 0);
}
// Nº de mensagens REAIS do CLIENTE (não as minhas explicando, nem itens manuais/atendimento).
// É o proxy de INTERESSE: cliente que responde muito está mais engajado. Alimenta a barra de
// "Interesse do cliente" e o ranking do "Fazer agora" (mesma régua, decisão do dono).
function mensagensDoCliente(l){
  // v942 — na LISTA da Home o lead traz só uma prévia (~8 msgs), então contar aqui subestimava
  // (a barra de "interesse" ficava sempre quase vazia). O servidor manda clientMessageCount: a
  // contagem real (TOTAL) das mensagens do cliente, calculada sobre o histórico inteiro no banco.
  // Preferimos esse número quando o histórico completo ainda não foi carregado. No detalhe do
  // lead (historyLoaded=true) a gente conta das mensagens reais, como antes.
  if(!(l && l.historyLoaded)){
    const stored = Number(l?.clientMessageCount);
    if(Number.isFinite(stored)) return stored;
  }
  const msgs = Array.isArray(l?.recentMessages) ? l.recentMessages : [];
  if(!msgs.length) return 0;
  const pn = String(l?.name||"").toLowerCase().trim().split(/\s+/)[0] || "";
  // v942 — conta TODAS as mensagens do cliente na conversa (sem janela de tempo). A janela de 90
  // dias da v896 zerava o número de qualquer lead que esfriou há 3+ meses (ex.: Sara, quieta desde
  // fevereiro, aparecia com "0 mensagens do cliente" mesmo tendo escrito ~15) — o dono, com razão,
  // apontou que isso parece quebrado. A coldness já é mostrada pelos "dias parado"; aqui o número
  // é o engajamento REAL da conversa, não "interesse dos últimos 90 dias".
  let n = 0;
  for(const m of msgs){
    if(!m || !String(m.text||"").trim()) continue;
    const src = String(m.source||"").toLowerCase(), type = String(m.type||"").toLowerCase();
    if(src==='manual'||src==='crm'||src==='corretor-pro-manual'||type==='print-whatsapp'||['atendimento','nota','ligacao','visita','presencial','proposta','observacao_manual','mensagem_enviada'].includes(type)) continue;
    if(typeof ehMsgDoCliente==='function' && ehMsgDoCliente(m, pn)) n++;
  }
  return n;
}
// v1017 — mesma métrica de cima, mas só dos ÚLTIMOS 90 DIAS (clientMessageCount90d, calculado no
// servidor na mesma varredura). Usada SÓ na barra do "Fazer agora" (cpBarraMensagensMini): o dono
// pediu que essa barra passasse a respeitar os 90 dias, igual "Total de mensagens" (v1016).
// NÃO usar isto pra ranking/elegibilidade (cpProbabilidadeFechamento, dose, leadsEsquecidos) —
// essas continuam com mensagensDoCliente (histórico inteiro) de propósito: leadsEsquecidos existe
// justamente pra resgatar lead antigo que esfriou (ver comentário da v942 acima), e uma janela de
// 90 dias zeraria exatamente esses leads.
function mensagensDoClienteRecente(l){
  const stored = Number(l?.clientMessageCount90d);
  if(Number.isFinite(stored)) return stored;
  return mensagensDoCliente(l); // fallback pra dado antigo em cache, sem o campo novo ainda
}
// (v911) leadTemProposta removida: só o Raio-X / "Oportunidades esquecidas" antigos usavam, e
// ambos deixaram de depender de "recebeu proposta" (dado que o app não sabe).
const TIMELINE_PAGE_SIZE = 100;
function mensagensVisiveisLead(lead){
  const msgs = Array.isArray(lead?.recentMessages) ? lead.recentMessages : [];
  const limite = Math.max(TIMELINE_PAGE_SIZE, Number(state.timelineVisibleCount || TIMELINE_PAGE_SIZE));
  return msgs.slice(-limite);
}
function renderTimelineCardLegado(lead){
  const tl = qs("#timeline");
  if(!tl) return;
  const msgs = mensagensVisiveisLead(lead);
  const total = totalMensagensLead(lead);
  const faltam = Math.max(0, (Array.isArray(lead?.recentMessages) ? lead.recentMessages.length : 0) - msgs.length);
  let html = msgs.map(m => `<div class="event"><b>${escapeHtml((m.date||"")+" "+(m.time||"")+" — "+limparAutorAtend(m.author||""))}</b><p>${escapeHtml(m.text||"")}</p></div>`).join("");
  if(faltam > 0) html = `<button type="button" onclick="carregarMaisHistoricoLead()" style="width:100%;margin:0 0 10px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.04);color:var(--soft);font-weight:900;cursor:pointer">Carregar mais ${Math.min(TIMELINE_PAGE_SIZE, faltam)} mensagens anteriores</button>` + html;
  if(!lead?.historyLoaded) html += `<div class="small" style="padding:10px;color:var(--muted);text-align:center">Carregando o histórico completo…</div>`;
  if(!html) html = '<div class="event"><b>Sem mensagens guardadas</b><p>Reimporte a conversa pra ver o histórico completo aqui.</p></div>';
  tl.innerHTML = html;
  tl.dataset.totalMensagens = String(total);
}
function carregarMaisHistoricoLead(){
  state.timelineVisibleCount = Math.max(TIMELINE_PAGE_SIZE, Number(state.timelineVisibleCount || TIMELINE_PAGE_SIZE)) + TIMELINE_PAGE_SIZE;
  if(state.lead){
    renderTimelineCardLegado(state.lead);
    renderLeadFoco(state.lead);
  }
}
window.getLeadDetail = getLeadDetail;
window.carregarMaisHistoricoLead = carregarMaisHistoricoLead;
// Reflete na base já carregada o que acabou de ser salvo (nome/telefone/foto), pra tela
// atualizar na hora mesmo se o banco demorar um instante pra propagar.
function patchLeadCache(id, patch){
  try{
    const items = _leadsCache?.data?.items;
    if(!Array.isArray(items) || !patch) return;
    const it = items.find(l => String(l.id) === String(id));
    if(!it) return;
    if(patch.name){
      it.name = patch.name;
      it.analysis = it.analysis || {};
      it.analysis.clientName = patch.name;
      it.analysis.lead = it.analysis.lead || {};
      it.analysis.lead.clientName = patch.name;
    }
    if(patch.phone){
      it.phone = patch.phone;
      it.analysis = it.analysis || {};
      it.analysis.lead = it.analysis.lead || {};
      it.analysis.lead.phone = patch.phone;
    }
  }catch(_){}
}

// Tira um lead apagado de TODOS os caches (inclusive o da busca) na hora, e recarrega
// a lista fresca. Sem isso, um lead excluído continuava aparecendo na barra de busca.
function removerLeadDosCaches(id){
  const sid = String(id || "");
  if(!sid) return;
  invalidarLeadsCache();
  if(Array.isArray(state.todosLeads)) state.todosLeads = state.todosLeads.filter(l => String(l.id) !== sid);
  if(Array.isArray(state.leads)) state.leads = state.leads.filter(l => String(l.id) !== sid);
  if(typeof loadTodosLeadsBusca === "function") loadTodosLeadsBusca();
}
window.invalidarLeadsCache = invalidarLeadsCache;
window.removerLeadDosCaches = removerLeadDosCaches;

// Confirmação em-app (no lugar do confirm() nativo do navegador — a "tela feia" com a URL
// "corretor-pro-zeta.vercel.app diz"). Retorna Promise<boolean>. Enter confirma, Esc/clique
// fora cancela. Usado no arquivar/perder pra ficar dentro da identidade do app.
function cp903Confirm(opts){
  const o = opts || {};
  return new Promise(resolve => {
    document.querySelectorAll('.cp903-backdrop').forEach(n => n.remove());
    const back = document.createElement('div');
    back.className = 'cp903-backdrop';
    back.innerHTML =
      `<div class="cp903-modal" role="dialog" aria-modal="true">
         ${o.titulo ? `<h3>${escapeHtml(o.titulo)}</h3>` : ''}
         <p>${escapeHtml(o.mensagem || '')}</p>
         <div class="cp903-acoes">
           <button type="button" class="cp903-cancel">${escapeHtml(o.cancelar || 'Cancelar')}</button>
           <button type="button" class="cp903-ok${o.perigo ? ' perigo' : ''}">${escapeHtml(o.ok || 'OK')}</button>
         </div>
       </div>`;
    const fechar = (v) => { document.removeEventListener('keydown', onKey); back.remove(); resolve(v); };
    const onKey = (e) => { if(e.key === 'Escape') fechar(false); else if(e.key === 'Enter') fechar(true); };
    back.addEventListener('click', e => { if(e.target === back) fechar(false); });
    back.querySelector('.cp903-cancel').onclick = () => fechar(false);
    back.querySelector('.cp903-ok').onclick = () => fechar(true);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    requestAnimationFrame(() => { back.classList.add('show'); back.querySelector('.cp903-ok')?.focus(); });
  });
}
window.cp903Confirm = cp903Confirm;
const MSG_STYLE_HINTS = {
  direta: "Direta: vai direto ao ponto, propõe próximo passo.",
  consultiva: "Consultiva: tira dúvida do cliente, traz informação, gera valor.",
  retomada: "Retomada: reabre uma conversa parada sem soar genérico."
};

async function ensureJSZip(){
  if(window.JSZip) return window.JSZip;
  await new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="/vendor/jszip.min.js";
    s.onload=resolve;
    s.onerror=()=>reject(new Error("Não foi possível baixar a biblioteca pra enxugar o ZIP. Verifique sua internet."));
    document.head.appendChild(s);
  });
  return window.JSZip;
}

async function slimZipKeepingTextAndAudio(file, onProgress){
  const JSZip = await ensureJSZip();
  const zip = await JSZip.loadAsync(file);

  const entries = [];
  zip.forEach((path, entry)=>{ if(!entry.dir) entries.push([path, entry]); });

  const newZip = new JSZip();
  let kept=0, dropped=0;
  for(let i=0;i<entries.length;i++){
    const [path, entry] = entries[i];
    if(KEEP_RE.test(path)){
      const data = await entry.async("uint8array");
      newZip.file(path, data);
      kept++;
    } else {
      dropped++;
    }
    if(onProgress) onProgress({processed:i+1, total:entries.length, kept, dropped});
  }

  const blob = await newZip.generateAsync({type:"blob", compression:"DEFLATE"});
  const slim = new File([blob], file.name.replace(/\.zip$/i,"")+"-enxuto.zip", {type:"application/zip"});
  return { file: slim, kept, dropped, originalSize: file.size, slimSize: blob.size };
}

const VIEW_CACHEABLE = new Set(["agenda","arquivados","relatorio","carteira"]);
let _viewLoadSeq = 0;
let _viewLoadTimer = null;
function agendarTarefaLeve(fn, delay=70){
  if("requestIdleCallback" in window){
    return requestIdleCallback(fn, { timeout: Math.max(250, delay + 180) });
  }
  return setTimeout(fn, delay);
}
function carregarTelaAtiva(t, force=false){
  const seq = ++_viewLoadSeq;
  clearTimeout(_viewLoadTimer);
  _viewLoadTimer = setTimeout(() => {
    agendarTarefaLeve(async () => {
      if(seq !== _viewLoadSeq || state.active !== t) return;
      const rev = Number(state.dataRevision) || 0;
      if(!force && VIEW_CACHEABLE.has(t) && state.viewRendered?.[t] === rev) return;
      try{
        if(t === "home") await carregarDashboard(force);
        else if(t === "agenda") await carregarAgenda();
        else if(t === "cerebro"){
          await carregarCerebro();
          await carregarAprendizado();
          icTab(state.icTabAtiva === "aprendizado" ? "aprendizado" : "cerebro", true);
        }
        // v952: chamada via window.* de propósito — existe uma versão mais nova (com paginação
        // e state.arquivadosItemsTodos p/ busca) só em window.carregarArquivados; a referência
        // solta "carregarArquivados" aqui resolvia pro nome de função do escopo do módulo (a
        // versão velha, sem paginação nem state.arquivadosItemsTodos), nunca pra atual.
        else if(t === "arquivados") await window.carregarArquivados();
        else if(t === "aprendizado") await carregarAprendizado();
        else if(t === "carteira") await carregarCarteira(force);
        if(state.active === t && VIEW_CACHEABLE.has(t)) state.viewRendered[t] = Number(state.dataRevision) || rev;
      }catch(err){ console.warn("carregarTelaAtiva", t, err); }
    });
  }, 20);
}
window.carregarTelaAtiva = carregarTelaAtiva;

// ===== Histórico interno do app (Atualização #724-2) =====
// O Android só consegue voltar dentro do app quando cada navegação cria uma entrada real
// no histórico do navegador. A URL não muda; apenas o estado interno é registrado.
let cpApplyingHistory = false;
function cpRouteForScreen(screen=state.active){
  return {
    cpApp:true,
    screen:screen || "home",
    navKey:state.navKey || undefined,
    carteiraFiltro:state.carteiraFiltro || "todos",
    grupoAtivo:state.grupoAtivo || null
  };
}
function cpPushRoute(route){
  if(cpApplyingHistory) return;
  try{ history.pushState({...route,cpApp:true}, "", location.href); }catch(_){}
}
function cpReplaceRoute(route){
  try{ history.replaceState({...route,cpApp:true}, "", location.href); }catch(_){}
}
function cpPushTransientRoute(kind){
  if(cpApplyingHistory || history.state?.cpTransient === kind) return;
  const base = history.state?.cpApp ? history.state : cpRouteForScreen(state.active);
  try{ history.pushState({cpApp:true,cpTransient:kind,base}, "", location.href); }catch(_){}
}
function cpConsumeTransientRoute(kind){
  const cur = history.state;
  if(cur?.cpTransient !== kind) return;
  const base = cur.base?.cpApp ? cur.base : cpRouteForScreen(state.active);
  cpReplaceRoute(base);
}
function cpClearLeadState(){
  if(typeof ui667ModoDetalheLead === "function") ui667ModoDetalheLead(false);
  state.lead=null; state.focoLeadId=null; state.analysis=null; state.sequencia=null;
}
// v1077 — as listas "montadas na hora" pelos cards da Home (Fazer agora, Aguardando cliente,
// Carteira ativa, Sem atender 30d+, Propostas) não vivem em state.gruposHome — quem VOLTA pra
// elas (botão voltar do Android/navegador) precisa reconstruí-las pela função dona. Sem isso,
// o voltar mostrava o nome cru ("__fazeragora") com 0 leads (print do dono).
function cpReabrirGrupoEspecial(grupo){
  const donos = {
    "__fazeragora": () => abrirFazerAgora(),
    "__aguardando": () => abrirAguardandoCliente(),
    "__carteiraAtiva": () => abrirCarteiraAtiva(),
    "__semAtender30": () => cpAbrirSemAtender30Dias(),
    "__propostas": () => cpAbrirHistoricoPropostas()
  };
  const abrir = donos[String(grupo || "")];
  if(!abrir) return false;
  try{ abrir(); }catch(_){ return false; }
  return true;
}
async function cpRestoreRoute(route){
  cpApplyingHistory=true;
  try{
    if(document.body.classList.contains("menu-aberto")) fecharMenuGaveta({fromHistory:true});
    const r = route?.cpApp ? route : {screen:"home"};
    if(r.cpTransient){
      if(r.cpTransient === "menu") abrirMenuGaveta();
      return;
    }
    if(r.screen === "lead" && r.leadId){
      if(r.carteiraFiltro) state.carteiraFiltro=r.carteiraFiltro;
      if(r.grupoAtivo) state.grupoAtivo=r.grupoAtivo;
      await abrirLead(r.leadId,{fromHistory:true});
      return;
    }
    cpClearLeadState();
    state.grupoAtivo=null;
    if(r.carteiraFiltro) state.carteiraFiltro=r.carteiraFiltro;
    show(r.screen || "home",{navKey:r.navKey,skipHistory:true});
    if((r.screen||"home") === "home" && r.grupoAtivo){
      state.grupoAtivo=r.grupoAtivo;
      if(!cpReabrirGrupoEspecial(r.grupoAtivo)) abrirGrupoHome(r.grupoAtivo,{fromHistory:true});
    } else if((r.screen||"home") === "home") {
      renderBotoesHome();
    }
  } finally { cpApplyingHistory=false; }
}
window.addEventListener("popstate",e=>{ cpRestoreRoute(e.state).catch(err=>console.warn("popstate",err)); });
window.cpPushTransientRoute=cpPushTransientRoute;
window.cpConsumeTransientRoute=cpConsumeTransientRoute;

function show(t, options={}){
  // v1075 — a tela "Condução" foi deletada; rota antiga salva em algum aparelho cai na Home.
  if(t === "pipeline") t = "home";
  const prev = state.active;
  const defaultNavKey = {home:"home",carteira:"leads",propostas:"imoveis",agenda:"agenda",relatorio:"relatorios",menu:"config"}[t] || t;
  state.navKey = options.navKey || defaultNavKey;
  state.active=t;
  if(!options.skipHistory && !cpApplyingHistory && prev !== t){
    cpPushRoute(cpRouteForScreen(t));
  }
  // v1094 — a tela dos arquivados agora tem UM nome só ("arquivados"). Antes ela respondia por
  // dois nomes de etapas que o dono aboliu ("perdidos" e "geladeira"), e precisava de um apelido
  // aqui pra show("geladeira") não ativar uma seção inexistente e deixar o corretor numa tela
  // em branco. Sem dois nomes, o apelido deixou de existir.
  const secId = t;
  if(!isDesktop()){
    qsa(".screen").forEach(e=>e.classList.remove("active"));
    qs("#"+secId)?.classList.add("active");
  }else{
    const escondidas = ["menu","cerebro","agenda","zip","linhaTempo","arquivados","aprendizado","propostas","relatorio","carteira"];
    escondidas.forEach(id => qs("#"+id)?.classList.remove("active"));
    const home = qs("#home");
    if(t === "home") home?.classList.add("active");
    else { qs("#"+secId)?.classList.add("active"); home?.classList.remove("active"); }
  }
  // A troca visual acontece primeiro; o cálculo da tela entra no próximo frame.
  // Isso elimina a sensação de botão travado.
  if(prev !== t) window.scrollTo(0,0);
  const activeKey = state.navKey || t;
  qsa(".nav").forEach(b=>b.classList.toggle("active",(b.dataset.navKey||b.dataset.target)===activeKey));
  qsa(".sb-item").forEach(b=>b.classList.toggle("active",(b.dataset.navKey||b.dataset.target)===activeKey));
  if(!options.skipLoad) carregarTelaAtiva(t, false);
}
window.show = show;
// Abas internas do menu "Inteligência Comercial": Cérebro (o que você ensina) x Aprendizado (o que a IA captou).
function icTab(which, dadosJaCarregados=false){
  const cer = which !== "aprendizado";
  state.icTabAtiva = cer ? "cerebro" : "aprendizado";
  const gc = qs("#icCerebro"), ga = qs("#icAprendizado");
  if(gc) gc.style.display = cer ? "" : "none";
  if(ga) ga.style.display = cer ? "none" : "";
  const bc = qs("#icTabCerebro"), ba = qs("#icTabAprend");
  [[bc,cer],[ba,!cer]].forEach(([b,on])=>{ if(!b) return; b.style.borderColor = on?"var(--lime)":"var(--line)"; b.style.background = on?"rgba(255,98,88,.15)":"transparent"; b.style.color = on?"var(--lime)":"var(--muted)"; });
  if(!cer && !dadosJaCarregados) carregarAprendizado();
}
window.icTab = icTab;
// Celular: gaveta do menu = a mesma lista lateral do PC (mesma linguagem/conteúdo).
// Atualização #724-2: a seta física fecha a gaveta antes de sair da tela atual.
function abrirMenuGaveta(){
  if(document.body.classList.contains("menu-aberto")) return;
  document.body.classList.add("menu-aberto");
  if(typeof cpPushTransientRoute === "function") cpPushTransientRoute("menu");
}
function fecharMenuGaveta(options={}){
  document.body.classList.remove("menu-aberto");
  if(options.fromHistory) return;
  if(options.replaceOnly){
    if(typeof cpConsumeTransientRoute === "function") cpConsumeTransientRoute("menu");
    return;
  }
  if(history.state?.cpTransient === "menu") history.back();
}
window.abrirMenuGaveta = abrirMenuGaveta;
window.fecharMenuGaveta = fecharMenuGaveta;
function clearAnalysis(){
  state.lead=null;
  state.focoLeadId=null;
  state.analysis=null;
  state.msgStyle="direta";
  qs("#fileName").textContent="";
  qs("#fileName").classList.remove("show");
  qs("#processingBox").classList.remove("show");
  qs("#importCard")?.classList.remove("cp-import-rodando");
  qs("#processingText").textContent="Processando conversa...";
  qs("#progressBar").style.width="0%";
  qs("#resultBox").className="empty";
  qs("#resultBox").innerHTML="Aguardando uma conversa real.";
  qs("#analysisBox").className="empty";
  qs("#analysisBox").innerHTML="Aguardando análise.";
  qs("#timeline").innerHTML='<div class="event"><b>Aguardando importação</b><p>A conversa organizada aparecerá aqui.</p></div>';
  qs("#clientName").value="";
  qs("#clientPhone").value="";
  qs("#messageText").value="Importe uma conversa para gerar uma mensagem sugerida.";
  qsa(".msg-tab").forEach(b => b.classList.toggle("active", b.dataset.style === "direta"));
  qs("#msgStyleHint").textContent = MSG_STYLE_HINTS.direta;
  showCard("resultCard", false); showCard("analysisCard", false); showCard("msgCard", false); showCard("memoriaCard", false); showCard("timelineCard", false); showCard("goToTimelineCard", false);
  toast("Análise limpa.");
}
// Limpa nomes longos com sufixo de produto + textos de erro técnico
const ERRO_RX = /erro na an[áa]lise|aguardando|insufficient|quota|http\s*4\d\d|api\.openai|allowlist|configurar|api\/diag/i;
function limpoTexto(v, fallback){
  const s = String(v||"").trim();
  if(!s) return fallback||"";
  if(ERRO_RX.test(s)) return fallback||"—";
  return s;
}
function ehDataPassada(texto){
  const m = String(texto||"").match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if(!m) return false;
  const dia = +m[1], mes = +m[2] - 1;
  let ano = +m[3]; if(ano<100) ano += 2000;
  const data = new Date(ano, mes, dia);
  if(isNaN(data.getTime())) return false;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return data < hoje;
}
function limpoBestTime(v){
  const s = String(v||"").trim();
  if(!s) return "—";
  if(ERRO_RX.test(s)) return "—";
  if(ehDataPassada(s)) return "—";
  return s;
}
function limpoNome(v){
  if(!v) return "Cliente";
  let s = String(v);
  // Só desembrulha quando o valor recebido é claramente um nome de arquivo legado.
  // Um nome já extraído do WhatsApp permanece exatamente como foi salvo, inclusive
  // quando contém palavras que também podem ser nomes de empreendimentos.
  if(/\.zip$/i.test(s) || /^conversa\s+(?:do\s+)?(?:whatsapp\s+)?com\s+/i.test(s)){
    s = s.replace(/\.zip$/i,"").replace(/-enxuto$/i,"").replace(/\s*\(\d+\)\s*$/,"").replace(/^conversa\s+(?:do\s+)?(?:whatsapp\s+)?com\s+/i,"");
  }
  return s.trim() || "Cliente";
}
function limparLead(l){
  if(!l || typeof l !== "object") return l;
  if(l.__direcionaClean === true) return l;
  const out = {
    ...l,
    name: limpoNome(l.name),
    bestTime: limpoBestTime(l.bestTime),
    summary: limpoTexto(l.summary, ""),
    nextAction: limpoTexto(l.nextAction, ""),
  };
  delete out.probability;
  delete out.probabilityPercent;
  delete out.scoreAjuste;
  try{ Object.defineProperty(out, "__direcionaClean", { value:true, enumerable:false }); }catch(_){ out.__direcionaClean = true; }
  return out;
}

async function loadRecentLeads(force = false){
  try{
    if(force) invalidarLeadDetail();
    const data = await getLeadsData(!!force);
    if(data?.ok && Array.isArray(data.items)){
      state.todosLeads = data.items.map(limparLead);
      state.leads = state.todosLeads.slice(0, 8);
    }
  }catch(_){
    // Não bloqueia o app se o banco ainda não responder.
  }
}

// Lista completa pra busca global (não só os 8 da home).
async function loadTodosLeadsBusca(){
  try{
    const res = { ok:true, json: async () => await getLeadsData() };
    const data = await res.json().catch(()=>({ok:false,items:[]}));
    if(res.ok && data.ok && Array.isArray(data.items)){
      state.todosLeads = data.items.map(limparLead);
    }
  }catch(_){ /* silencioso */ }
}

function showCard(id, has){
  const el = qs("#"+id);
  if(!el) return;
  el.classList.toggle("has-data", !!has);
}

async function buscarSimilares(produto, etapa, leadAtual){
  try{
    const res = { ok:true, json: async () => await getLeadsData() };
    const data = await res.json();
    const items = (data?.items || []).map(limparLead);
    // Cada lead recebe um score de similaridade com o leadAtual.
    const scored = items.filter(l => l.id && (!leadAtual?.id || String(l.id) !== String(leadAtual.id)) && normalizarEtapa(l.etapa) !== ETAPA_ARQUIVADO).map(l => {
      let score = 0;
      // Mesmo produto vale muito
      if(produto && l.product && (l.product||"").toLowerCase() === produto.toLowerCase()) score += 25;
      // Mesmo tipo de retomada
      const tipoAtual = leadAtual?.analysis?.tipoRetomada;
      const tipoOutro = l.analysis?.tipoRetomada;
      if(tipoAtual && tipoOutro && tipoAtual === tipoOutro) score += 12;
      // Perfil similar (palavras-chave do clientProfile)
      const pAtual = String(leadAtual?.analysis?.clientProfile||"").toLowerCase();
      const pOutro = String(l.analysis?.clientProfile||"").toLowerCase();
      if(pAtual && pOutro){
        const palavras = ["investidor","primeiro imóvel","família","mora sozinho","casal","aposentado","jovem","profissional liberal","servidor","empresário"];
        for(const pw of palavras){
          if(pAtual.includes(pw) && pOutro.includes(pw)) score += 8;
        }
      }
      return { ...l, _simScore: score };
    });
    scored.sort((a,b) => b._simScore - a._simScore);
    return scored.filter(l => l._simScore >= 18).slice(0, 4);
  }catch(_){ return []; }
}

// "Leitura do cliente" — diagnóstico do que a IA LEU da conversa (nada inventado): objetivo,
// motivo real, sinais, o que já sabemos x o que falta (com % de conhecimento), a próxima pergunta
// mais importante e alerta de conversa superficial. Campos vazios não aparecem; lead antigo (sem
// o diagnóstico novo) mostra só o que tiver e fica completo ao Reanalisar.
function diagnosticoClienteHTML(a){
  a = a || {};
  const mem = a.memoria || a.memoriaSugerida || {};
  const d = (a.diagnostico && typeof a.diagnostico === "object") ? a.diagnostico : {};
  const lc = (a.leituraComercial && typeof a.leituraComercial === "object") ? a.leituraComercial : {};
  const OBJ = { moradia:"Moradia", investimento:"Investimento", "moradia-futura":"Moradia futura", construcao:"Construção", troca:"Troca de imóvel", renda:"Renda (aluguel)", especulacao:"Valorização" };
  const objetivoTxt = (d.objetivo && d.objetivo !== "indefinido") ? (OBJ[d.objetivo] || d.objetivo) : "";
  const objArr = Array.isArray(a.objections) ? a.objections : (a.objections ? [a.objections] : []);
  const objTxt = objArr.length ? (typeof objArr[0] === "string" ? objArr[0] : (objArr[0]?.text || "")) : "";
  const dinheiro = [mem.faixaValor, mem.pontosSensiveis].map(s => String(s||"").trim()).filter(Boolean).join(" · ");
  // Diagnóstico da IA (igual ao raciocínio do ChatGPT): interesse, de quem é a bola, o que trava, etapa.
  const INT = { alto:["Interesse ALTO","var(--acao)"], medio:["Interesse MÉDIO","var(--morno)"], baixo:["Interesse BAIXO","var(--muted)"] };
  const interesse = INT[String(d.interesse||"").toLowerCase()] || null;
  const QD = { cliente:"o cliente — ficou de te retornar", corretor:"você — falta dar o retorno", ambos:"os dois" };
  const bolaTxt = QD[String(d.quemDeveProximoPasso||"").toLowerCase()] || "";
  const ETP = { descoberta:"Descoberta", interesse:"Interesse", comparacao:"Comparação", "analise-financeira":"Análise financeira", negociacao:"Negociação", decisao:"Decisão" };
  const etapaTxt = ETP[String(d.etapa||"").toLowerCase()] || "";
  // "O que trava" e "Objeção provável" SAÍRAM a pedido do dono: eram interpretação que o próprio
  // histórico da conversa já responde — só confundiam. Ficam os status de 1 olhada (objetivo, etapa,
  // de quem é a bola) + o que veio da memória/obs do corretor.
  const linhas = [
    ["🎯","Objetivo", objetivoTxt],
    ["💡","Motivo real", d.motivo],
    ["📍","Etapa", etapaTxt],
    ["🎾","Bola com", bolaTxt],
    ["✨","O que move", mem.preferencias],
    ["👥","Decisão com", mem.pessoasDecisao],
    ["💰","Dinheiro", dinheiro],
    ["⚔️","Vendo também", a.concorrencia],
  ].filter(([,,v]) => String(v||"").trim());

  // Bloco "Conhecimento do lead" (✅ sabemos / ❌ falta + %) REMOVIDO a pedido do dono: vinha só da
  // leitura da IA da conversa e NÃO considerava o que o corretor já preencheu na obs — então ficava
  // dizendo "falta X" mesmo com a info anotada, só confundindo. Saiu inteiro.
  const proxPerg = String(a.melhorPergunta || "").trim();
  const superficial = d.conversaSuperficial === true;

  const leituraLinhas = [
    ["Onde parou", lc.ondeParou],
    ["Próximo passo", lc.quemDeveProximoPasso],
    ["O que destravar", lc.oQueDestravar],
    ["Mensagem com mais chance", lc.mensagemCurtaChance]
  ].filter(([_,v]) => String(v||"").trim());

  if(!linhas.length && !proxPerg && !superficial && !interesse && !leituraLinhas.length) return "";

  const intBadge = interesse ? ` <span class="diag-int" style="color:${interesse[1]};border-color:${interesse[1]}">${interesse[0]}</span>` : "";
  let h = `<div class="diag-card"><div class="diag-tit">Leitura complementar${intBadge}</div>`;
  for(const [ic,lab,v] of linhas){
    h += `<div class="diag-row"><span class="diag-ic">${ic}</span><span class="diag-lab">${lab}:</span> <span class="diag-val">${escapeHtml(String(v).trim())}</span></div>`;
  }
  if(leituraLinhas.length){
    h += `<div class="diag-perg" style="border-color:rgba(0,212,255,.24);background:rgba(0,212,255,.05)"><div class="diag-perg-lab">🧭 Raio-X comercial</div>`;
    for(const [lab,v] of leituraLinhas){
      h += `<div style="display:flex;gap:7px;margin-top:5px;font-size:12px;line-height:1.35"><b style="color:var(--muted);min-width:112px">${escapeHtml(lab)}:</b><span style="color:var(--text)">${escapeHtml(String(v).trim())}</span></div>`;
    }
    h += `</div>`;
  }
  if(proxPerg){
    h += `<div class="diag-perg"><div class="diag-perg-lab">❓ Próxima pergunta mais importante</div><div class="diag-perg-txt">${escapeHtml(proxPerg)}</div></div>`;
  }
  if(superficial && !objetivoTxt){
    h += `<div class="diag-alerta">⚠️ Conversa longa com pouco diagnóstico — descubra o objetivo da compra antes de seguir apresentando imóveis.</div>`;
  }
  return h + '</div>';
}


// Módulo antigo de "mensagens por objetivo" desativado.
// Ele criava uma segunda camada paralela de sugestões estilo sistema antigo. Agora a tela trabalha
// somente com as 3 respostas principais geradas pela IA.
const OBJETIVOS_MSG_LABELS = [];
function normalizarObjetivosMensagens(_obj){ return []; }
function renderSugestoesObjetivoFoco(_lista){ return ""; }

function renderAnalysis(analysis, lead){
  state.analysis = analysis || null;
  showCard("analysisCard", !!analysis);
  showCard("msgCard", !!(analysis && analysis.messages));
  if(state.lead?.id) carregarMemoria(state.lead.id);
  // Busca similares e adiciona ao final da analise (com guard de leadId pra evitar race)
  if(lead?.product || analysis?.clientProfile){
    const leadIdAtMoment = state.lead?.id || null;
    buscarSimilares(lead.product, lead.etapa, { id: state.lead?.id, analysis }).then(similares => {
      // Se o user trocou de lead enquanto buscava, descarta o resultado.
      if(state.lead?.id !== leadIdAtMoment) return;
      if(!similares.length) return;
      const box = qs("#analysisBox");
      if(!box || !box.innerHTML.includes("class=\"analysis-grid\"")) return;
      const html = '<div style="margin-top:12px;padding:10px;background:rgba(196,92,255,.06);border:1px solid rgba(196,92,255,.18);border-radius:12px"><div class="small" style="color:var(--cerebro);text-transform:uppercase;letter-spacing:.1em;font-size:10px;font-weight:950;margin-bottom:6px">Leads parecidos</div>' +
        similares.map(s => `<div class="small" style="padding:4px 0">• <span onclick='abrirLead(${JSON.stringify(String(s.id||""))})' style="cursor:pointer;text-decoration:underline">${escapeHtml(s.name||"?")}</span> — ${escapeHtml(s.etapa||"")}</div>`).join("") +
        '</div>';
      box.insertAdjacentHTML("beforeend", html);
    });
  }
  const box = qs("#analysisBox");
  if(!analysis || analysis.mode === "sem_api" || analysis.mode === "erro_api"){
    box.className = "notice error";
    box.innerHTML = '<b>Análise indisponível no momento.</b><br><span class="small" style="color:var(--muted)">Não consegui gerar a análise dessa conversa agora. Toque em <b>↻ Reanalisar</b> daqui a pouco.</span>';
    setMsgStyle(state.msgStyle);
    return;
  }
  box.className = "";
  const objArr = Array.isArray(analysis.objections) ? analysis.objections : (analysis.objections ? [analysis.objections] : []);
  let html = diagnosticoClienteHTML(analysis) + '<div class="analysis-grid">';
  html += row("Resumo", analysis.summary);
  html += row("Perfil do cliente", analysis.clientProfile);
  if(lead?.product) html += row("Produto", lead.product);
  html += '</div>';
  if(objArr.length){
    html += '<div style="margin-top:10px"><b style="color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-size:11px">Objeções identificadas</b><ul class="bullet-list">';
    for(const o of objArr) html += '<li>'+escapeHtml(typeof o === "string" ? o : (o?.text || JSON.stringify(o)))+'</li>';
    html += '</ul></div>';
  }
  if(analysis.messages){
    html += '<div style="margin-top:12px;color:var(--muted);font-size:13px">3 mensagens prontas estão na aba <b>Msg</b> — escolha entre Direta, Consultiva e Retomada.</div>';
  }
  box.innerHTML = html;
  setMsgStyle(state.msgStyle);

  function row(label, value){
    if(!value) return "";
    let display;
    if(typeof value === "string" || typeof value === "number"){
      display = String(value);
    } else if(Array.isArray(value)){
      display = value.map(v => typeof v === "string" ? v : (v?.text || JSON.stringify(v))).join(" · ");
    } else if(typeof value === "object"){
      // Objeto: tenta achar uma chave de texto, senão lista chaves: valor.
      display = value.text || value.descricao || value.description || value.summary ||
        Object.entries(value).map(([k,v]) => k + ": " + (typeof v === "string" ? v : JSON.stringify(v))).join(" · ");
    } else {
      display = String(value);
    }
    return '<div class="analysis-row"><b>'+escapeHtml(label)+'</b><span>'+escapeHtml(display)+'</span></div>';
  }
}

// Tira o "tipo de atendimento" (presencial/ligação) do rótulo do corretor na timeline.
function limparAutorAtend(autor){
  return String(autor || "").replace(/Atendimento\s+(presencial|liga[çc][ãa]o)\s*\(corretor\)/gi, "Atendimento (corretor)");
}

// Única arquitetura aceita para sugestões comerciais. Leads antigos precisam ser reanalisados.
// IMPORTANTE: precisa ser IDÊNTICA à ARQUITETURA_MENSAGENS_ATUAL do backend (api/_pipeline.js).
// Se ficarem diferentes, toda análise recém-gerada é tratada como "antiga" e a tela pede reanálise em loop.
const ARQUITETURA_MENSAGENS_ATUAL = "v852-cerebro-unico-obrigatorio";

function analiseAtualValida752(a){
  return !!(a && typeof a === "object" &&
    String(a.arquiteturaMensagens || "") === ARQUITETURA_MENSAGENS_ATUAL &&
    a.sugestoesPendentes !== true &&
    !["erro_api","reconciliacao_local","reanalise_pendente"].includes(String(a.mode || "")));
}

function mensagemAprovadaSemAlteracao(texto){
  return String(texto || "").trim();
}

function mensagensDaAnalise(a){
  a = a || {};
  const arquiteturaOk = String(a.arquiteturaMensagens || "") === ARQUITETURA_MENSAGENS_ATUAL;
  const pendente = a.sugestoesPendentes === true;
  const m = (a.messages && typeof a.messages === "object") ? a.messages : {};
  const pick = (key) => {
    const v = m[key];
    if(v == null) return "";
    return typeof v === "object"
      ? String(v.msg || v.mensagem || v.texto || "").trim()
      : String(v).trim();
  };
  // v750: NUNCA exibir mensagens de arquitetura antiga.
  // Se o lead ainda tem análise salva por versões anteriores, a tela deve pedir reanálise,
  // em vez de mostrar sugestão contaminada por prompt/fallback velho.
  if (pendente || !arquiteturaOk) {
    return {
      direta:"", consultiva:"", retomada:"",
      a:"", b:"", c:"", aLabel:"Reanalisar", bLabel:"Reanalisar", cLabel:"Reanalisar", recomendada:"a",
      aprovada:false
    };
  }
  const aMsg = pick("a");
  const bMsg = pick("b");
  const cMsg = pick("c");
  const aprovada = !!(aMsg && bMsg && cMsg);
  return {
    direta:aMsg, consultiva:bMsg, retomada:cMsg,
    a:aMsg, b:bMsg, c:cMsg,
    aLabel:String(m.aLabel || "Recomendada").trim(),
    bLabel:String(m.bLabel || "Mais suave").trim(),
    cLabel:String(m.cLabel || "Mais direta").trim(),
    recomendada:["a","b","c"].includes(String(m.recomendada || "")) ? String(m.recomendada) : "a",
    aprovada
  };
}

function setMsgStyle(style){
  state.msgStyle = style;
  qsa(".msg-tab").forEach(b => b.classList.toggle("active", b.dataset.style === style));
  qs("#msgStyleHint").textContent = MSG_STYLE_HINTS[style] || "";
  if(!state.analysis){ qs("#messageText").value = "Importe uma conversa para gerar uma mensagem sugerida."; return; }
  const msgs = mensagensDaAnalise(state.analysis);
  qs("#messageText").value = mensagemAprovadaSemAlteracao(msgs[style] || msgs.direta);
}

// ============ DASHBOARD / TELA HOJE ============
// Junta o texto real do lead (resumo, próxima ação, objeções, risco, memória) pra ler os SINAIS
// comerciais — pendência minha, esforço do cliente, dependência externa.
function textoSinais(l){
  const a = l.analysis || {};
  const m = a.memoria || {};
  return [
    a.summary, l.summary, a.nextAction, l.nextAction, a.risk, a.permutaResumo,
    Array.isArray(a.objections) ? a.objections.join(" ") : "",
    m.preferencias, m.pontosSensiveis, m.observacoes, l.observacoes
  ].filter(Boolean).join(" · ").toLowerCase();
}

// INTELIGÊNCIA COMERCIAL: a prioridade NÃO é "quem tem mais interesse", é "quem avança HOJE com
// uma ação minha". Sobe quem depende de mim (prometi algo / cliente me esperando) e quem já se
// esforçou. Desce quem depende de evento externo (vender a casa, safra) — ótimo cliente, mas não
// fecha agora. Interesse e tempo entram, mas como complemento, não como nota principal.

// CONTEXTO DE PRIORIDADE — usa a leitura comercial da IA antes das regex antigas.
// Objetivo: a fila deve obedecer a pendência aberta/proposta em andamento,
// igual à análise feita quando exportamos a conversa para o chat.
function contextoPrioridadeIA(l){
  const a = l?.analysis || {};
  const diag = a.diagnostico || {};
  const lc = a.leituraComercial || {};
  const partes = [
    diag.statusPendencia, diag.ultimaPendenciaAberta, diag.proximaAcaoCorreta, diag.quemDeveProximoPasso,
    lc.statusPendencia, lc.ultimaPendenciaAberta, lc.proximaAcaoCorreta, lc.quemDeveProximoPasso, lc.ondeParou, lc.oQueDestravar,
    a.nextAction, l?.nextAction, a.summary, l?.summary, a.risk,
    Array.isArray(diag.sabemos) ? diag.sabemos.join(' ') : '',
    Array.isArray(diag.lacunas) ? diag.lacunas.join(' ') : '',
    Array.isArray(diag.oQueNaoPerguntarNovamente) ? diag.oQueNaoPerguntarNovamente.join(' ') : '',
    Array.isArray(l?.recentMessages) ? l.recentMessages.slice(-8).map(m => `${m?.author||''} ${m?.text||''}`).join(' ') : ''
  ].filter(Boolean).join(' · ').toLowerCase();

  const contatoParceiro = /corretor|corretora|imobili[áa]ria|imobiliaria|parceir|cliente final|cliente comprador|meu cliente|meus clientes|comiss[aã]o|honor[áa]rios|gerente comercial|rede moi/.test(partes + ' ' + String(l?.name||'').toLowerCase());

  const retornoProposta = /aguardando-retorno-proposta|retorno da (proposta|contraproposta|condi[cç][aã]o)|retorno.*(proposta|contraproposta|condi[cç][aã]o)|proposta.*aguardando|contraproposta|última condi[cç][aã]o|ultima condi[cç][aã]o|condi[cç][aã]o ajustada|ajustamos junto (à|a) dire[cç][aã]o|falar com o dono|dono da empresa|vou inform|vou apresentar|vou validar|vou falar com (o )?cliente|cliente final/.test(partes);

  const propostaAtiva = /proposta|contraproposta|condi[cç][aã]o|entrada|parcel|safra|financiamento|banco|valor|pre[cç]o|fechar|negocia/.test(partes);
  const aguardandoTerceiro = /aguardando-terceiro|aguardando-cliente|vou inform|vou apresentar|vou validar|vou falar com|te aviso|te retorno|retorno do cliente|cliente final/.test(partes);

  const quem = String(diag.quemDeveProximoPasso || lc.quemDeveProximoPasso || '').toLowerCase();
  return {
    texto: partes,
    contatoParceiro,
    propostaAtiva,
    aguardandoTerceiro,
    retornoProposta,
    quemDeve: quem,
    pendenciaIA: String(diag.ultimaPendenciaAberta || lc.ultimaPendenciaAberta || '').trim(),
    acaoIA: String(diag.proximaAcaoCorreta || lc.proximaAcaoCorreta || a.nextAction || l?.nextAction || '').trim()
  };
}



// v682 — Prioridade Comercial refinada.
// Este bloco separa lead comprador real de curioso e puxa para cima casos que tinham
// conversa forte, mas ficavam escondidos por não terem lembrete.
function sinaisPrioridadeComercial682(l){
  const a = l?.analysis || {};
  const txt = textoSinais(l);
  const msgs = Array.isArray(l?.recentMessages) ? l.recentMessages : [];
  const diasDistintos = (() => {
    const set = new Set();
    for(const m of msgs){
      const iso = m && m.iso ? String(m.iso).slice(0,10) : "";
      if(iso) set.add(iso);
    }
    return set.size;
  })();
  const compradorKeywords = /(entrada|parcela|financi|banco|caixa|simula(?:ção|cao|r)|proposta|contraproposta|condi[çc][ãa]o|valor|pre[çc]o|tabela|unidade|andar|box|vaga|planta|metragem|visita|decorado|reserva|documenta[çc][ãa]o|fgts|aprova[çc][ãa]o|contrato|fechar|negociar|sinal)/;
  const curiosoKeywords = /(s[óo] curiosidade|s[oó] olhando|apenas olhando|s[óo] pesquisa|sem pressa|mais pra frente|não tenho pressa|nao tenho pressa|quando der|um dia|por enquanto n[aã]o|s[óo] queria saber|manda material|quero informa[çc][õo]es,? por favor)/;
  const urgenciaKeywords = /(urgente|essa semana|hoje|amanh[ãa]|até sexta|ate sexta|ainda hoje|logo|mudar|mudan[çc]a|preciso resolver|pra fechar|vamos fechar|reservar|reserva|segurar|sinal|visita marcada|café|cafe|reuni[ãa]o|decorado)/;
  const objecaoKeywords = /(caro|pre[çc]o|valor|entrada|parcela|financiamento|renda|banco|caixa|aprov|or[çc]amento|teto|localiza[çc][ãa]o|prazo|entrega|permuta|vender meu|vender a casa|vender o apartamento|juros)/;
  const pendenciaKeywords = /(ficou de|promet|vou te mandar|vou te enviar|te envio|te mando|retorno|retornar|aguardando|esperando|preciso te passar|vou validar|vou ver|vou falar|proposta|simula[çc][ãa]o|condi[çc][ãa]o)/;

  const compradorReal = compradorKeywords.test(txt);
  const curioso = curiosoKeywords.test(txt) && !/(proposta|simula|entrada|parcela|visita|unidade|financi|reserva|fechar)/.test(txt);
  const urgencia = urgenciaKeywords.test(txt) || Array.isArray(a.confirmedAppointments) && a.confirmedAppointments.length > 0;
  const objecao = objecaoKeywords.test(txt);
  const pendencia = pendenciaKeywords.test(txt);
  // Caso tipo Isabela: muito sinal comercial espalhado na conversa, mesmo sem lembrete marcado.
  const quenteEscondido = compradorReal && !curioso && diasDistintos >= 3 && /(entrada|parcela|financi|simula|proposta|unidade|visita|valor|planta|metragem|box|vaga)/.test(txt);

  const motivos = [];
  if(quenteEscondido) motivos.push("oportunidade com sinais fortes espalhados pela conversa");
  if(compradorReal && !curioso) motivos.push("sinais de comprador real");
  if(curioso) motivos.push("parece curioso/pesquisa inicial");
  if(urgencia) motivos.push("há urgência ou compromisso próximo");
  if(objecao) motivos.push("há objeção para tratar");
  if(pendencia) motivos.push("existe pendência aberta");
  return { compradorReal, curioso, urgencia, objecao, pendencia, quenteEscondido, diasDistintos, motivos };
}

function scoreLead(l){
  return scorePrioridadeAtendimento(l);
}
// v826 §6.6 — PRECEDÊNCIA DETERMINÍSTICA DA FILA (função pura, sem estado).
// Recebe só FATOS (booleanos) e devolve o nível (1..7), o grupo e o título. Não há
// pesos nem notas subjetivas: a posição é decidida pela ordem dos fatos. Isolada
// assim para poder ser testada diretamente (tests/v826-fila-fatos.test.mjs).
// Níveis: 1 cliente respondeu e não recebeu resposta · 2 compromisso vencido ·
// 3 retorno para hoje · 4 negociação real aguardando você · 5 atendimento programado ·
// 6 retomada por tempo sem contato · 7 aguardando resposta do cliente.
function filaPorFatos(f = {}){
  if(f.atendidoRecente && !f.clienteAguardandoVoce && !f.lembreteAtrasado && !f.retornoParaHoje && !f.negociacaoAguardando)
    return { nivel:0, grupo:"tratado-hoje", titulo: f.contatadoHoje ? "Tratado hoje" : "Atendido recentemente" };
  if(f.lembreteFuturo && !f.clienteAguardandoVoce && !f.retornoParaHoje && !f.negociacaoAguardando)
    return { nivel:0, grupo:"pode-aguardar", titulo:"Tem lembrete futuro" };
  if(f.clienteAguardandoVoce) return { nivel:1, grupo:"acao-hoje", titulo:"Cliente aguardando" };
  if(f.lembreteAtrasado)      return { nivel:2, grupo:"acao-hoje", titulo:"Compromisso vencido" };
  if(f.retornoParaHoje)       return { nivel:3, grupo:"acao-hoje", titulo:"Retorno para hoje" };
  if(f.compromissoProgramado) return { nivel:5, grupo:"acao-hoje", titulo:"Atendimento programado" };
  if(f.clientePediuTempo)     return { nivel:0, grupo:"pode-aguardar", titulo:"Cliente pediu para aguardar" };
  // v941 — bug real: "negociacaoAguardando" vem de um regex sobre o TEXTO da análise da IA
  // (proposta/condição/contraproposta) — praticamente toda negociação de imóvel toca nesses
  // termos, então esse sinal fuzzy disparava fácil demais e furava a checagem de janela de
  // espera (emJanela), que ficava mais abaixo na cadeia. Resultado visto pelo dono: lead
  // contatado ONTEM (dentro do prazo normal de resposta — 3 ou 5 dias) aparecendo mesmo assim
  // como "Negociação aguardando você"/"PRIORIDADE AGORA". emJanela (fato concreto: eu
  // contatei, ainda dentro do prazo) agora vem ANTES do sinal fuzzy — só cai em "acao-hoje" por
  // negociação se JÁ passou da janela normal de resposta. Os fatos concretos com data real
  // (lembreteAtrasado/retornoParaHoje/compromissoProgramado) continuam com prioridade sobre
  // negociacaoAguardando, como já era — só o sinal fuzzy que passa a respeitar a janela.
  if(f.emJanela)              return { nivel:7, grupo:"pode-aguardar", titulo:"Aguardando resposta" };
  if(f.negociacaoAguardando)  return { nivel:4, grupo:"acao-hoje", titulo:"Negociação aguardando você" };
  if(f.travaExterna && !f.pendenciaCorretor) return { nivel:0, grupo:"boa-sem-urgencia", titulo:"Boa oportunidade, sem urgência" };
  if(f.retomadaPorTempo)      return { nivel:6, grupo:"retomar-cuidado", titulo:"Retomar com cuidado" };
  return { nivel:0, grupo:"baixa-prioridade", titulo:"Baixa prioridade" };
}

// PRIORIDADE DE ATENDIMENTO — separada da chance de venda.
// Chance de venda responde: "esse lead pode comprar?"
// Prioridade de atendimento responde: "vale falar com ele AGORA?"
// v1024 — dono reportou lentidão persistente (mouse/clique travando por segundos, mesmo depois
// de caches já terem sido adicionados no v1017 do lado do servidor). Achado real do lado do
// CLIENTE: esta função (bem pesada — várias dezenas de regex por lead) é chamada de novo a cada
// COMPARAÇÃO dentro de .sort() (compararPrioridadeAtendimento/cpFilaFazerAgora), várias vezes
// PARA O MESMO lead (score voltava a ser recalculado do zero em cada comparação, em vez de uma
// vez só) — para 227 leads (carteira real do dono), isso é milhares de recomputações
// redundantes por render, travando a aba principal do navegador bem no meio de um clique.
// prioridadeAtendimento agora cacheia o resultado por objeto de lead (WeakMap — some sozinho
// quando os dados são recarregados e os objetos antigos somem da memória, sem precisar limpar
// nada manualmente). O cálculo de verdade continua em _prioridadeAtendimentoCalcular, intacto.
const _prioridadeCache = new WeakMap();
function prioridadeAtendimento(l){
  if(l && typeof l === "object" && _prioridadeCache.has(l)) return _prioridadeCache.get(l);
  const resultado = _prioridadeAtendimentoCalcular(l);
  if(l && typeof l === "object") _prioridadeCache.set(l, resultado);
  return resultado;
}
function _prioridadeAtendimentoCalcular(l){
  const e = normalizarEtapa(l.etapa);
  if(e === ETAPA_ARQUIVADO) {
    return { score:-999, grupo:"baixa-prioridade", titulo:"Fora da fila", motivo:"lead arquivado" };
  }

  const a = l.analysis || {};
  const txt = textoSinais(l);
  const dias = Number(l.daysSinceLastInteraction);
  let diasResposta = l.daysSinceClientReply; if(diasResposta==null) diasResposta = _diasDesdeMsg(l, true);
  let diasContato = l.daysSinceLastTouch; if(diasContato==null) diasContato = _diasDesdeMsg(l, false);

  const msgs = Array.isArray(l.recentMessages) ? l.recentMessages : [];
  const primeiroNome = String(l.name || "").toLowerCase().trim().split(/\s+/)[0] || "";
  const msgsCli = msgs.filter(m => ehMsgDoCliente(m, primeiroNome));
  const ultimoCliente = (() => {
    for(let i = msgs.length - 1; i >= 0; i--){
      const m = msgs[i];
      if(!m || !String(m.text||"").trim()) continue;
      return ehMsgDoCliente(m, primeiroNome);
    }
    return false;
  })();

  const pendenciaCorretor = /promet|ficou de (te |lhe )?(enviar|mandar|passar|retornar)|enviar (a |uma )?simula|preparar (a |uma )?(proposta|simula)|montar (a |uma )?(proposta|simula)|mandar (o |os |as )?(material|plantas?|tabela)|retornar com|aguard(a|ando) (o |um |meu |nosso )?retorno|cliente (aguarda|espera|esperando)|devo (enviar|mandar|retornar)|combin(ei|amos) de/.test(txt);
  const sinalCompra = /entrada|parcela|financi|banco|caixa|valor|pre[çc]o|condi[çc][ãa]o|proposta|simula|contrato|escritura|reserva|unidade|visita|decorado|planta|metragem|vaga|box|fechar|negociar|tabela/.test(txt);
  const esforcoCliente = /visit(ou|a feita|amos)|decorado|falou com (o )?banco|levant(ou|ando) (a )?doc|aprov(ou|ado) (o )?cr[ée]dito|escolheu (a |as )?unidade|colocou (a |o )?(casa|im[óo]vel) (à|a) venda|pediu (a |uma )?simula|mandou documento/.test(txt);
  const travaExterna = ehPermuta(l) || /depende (da|de) (venda|safra|colheita)|quando vender|assim que vender|esperar (a )?(safra|colheita)|aguard(a|ando) (a )?venda|precisa vender (a |o |seu |sua )?(casa|im[óo]vel|apartamento|terreno)|vender (a |o |seu |sua )?(casa|im[óo]vel|apartamento|terreno) (antes|primeiro)|s[óo] (compra|fecha) (depois|quando)|vai acompanhar|mais pra frente/.test(txt);
  const clientePediuPraAguardar = /me chama (mais tarde|semana que vem|m[êe]s que vem)|chama depois|vou pensar|vou analisar|estou analisando|estamos analisando|vou conversar|vou ver com|te aviso|te retorno|qualquer coisa te chamo/.test(txt);
  // v1022 — bug real e recorrente ("lead continua aparecendo nas prioridades sem respeitar o
  // prazo"): temAgenda contava QUALQUER compromisso já confirmado alguma vez na conversa, mesmo
  // um vencido há meses — a extração da IA não some com um compromisso antigo (ele continua em
  // confirmedAppointments pra sempre), então compromissoProgramado ficava PERMANENTEMENTE
  // verdadeiro pra esse lead, furando a janela de espera (emJanela, nível 7 — checado bem depois
  // na cadeia de filaPorFatos) de vez em quando. Já existe uma versão com data certa pra "esse
  // compromisso ainda está de pé" (ui671CompromissoAberto/ui671DiasAte, usada no card do lead) —
  // só faltava aplicar aqui. Agora só conta como "programado" um compromisso de hoje pra frente.
  const temAgenda = Array.isArray(a.confirmedAppointments) && a.confirmedAppointments.some(ap => {
    const diff = (typeof ui671DiasAte === 'function') ? ui671DiasAte(String(ap?.data || "").slice(0, 10)) : null;
    if(diff != null) return diff >= 0;
    return /\b(hoje|amanh[ãa])\b/.test(String(ap?.quando || "").toLowerCase());
  });
  const tipo = String(a.tipoRetomada||"").toLowerCase();
  const ctxIA = contextoPrioridadeIA(l);
  const negociacaoAguardandoRetorno = !!(ctxIA.retornoProposta && ctxIA.propostaAtiva);
  const parceiroComClienteFinal = !!(ctxIA.contatoParceiro && ctxIA.aguardandoTerceiro && ctxIA.propostaAtiva);
  // v826 §6.6 — FILA POR FATOS. Sem pesos subjetivos (+120, +92, -38 etc.): a posição
  // vem de uma precedência DETERMINÍSTICA e cada card mostra o motivo factual.
  // Ordem: 1) cliente respondeu e não recebeu resposta; 2) compromisso do corretor
  // vencido; 3) retorno marcado para hoje; 4) negociação real aguardando você;
  // 5) atendimento programado; 6) retomada por tempo sem contato; 7) aguardando o cliente.
  const _lembreteTs = lembreteTs(l);
  const diasLembrete = isNaN(_lembreteTs) ? null
    : ui671DiasAte(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(_lembreteTs)));
  const lembreteAtrasado = diasLembrete != null && diasLembrete < 0;
  const retornoParaHoje = diasLembrete === 0;
  // v1022 — o "ou" com o mesmo teste hoje/amanhã virou redundante: temAgenda agora já cobre
  // esse caso (ver comentário ali) de forma correta (com data), então compromissoProgramado é
  // só o próprio temAgenda.
  const compromissoProgramado = temAgenda;
  const retomadaPorTempo = Number.isFinite(diasContato) && diasContato >= limiarRetomada(l);
  // "Cliente respondeu e ainda não recebeu resposta": o cliente falou por último.
  // v1019 — este sinal furava a proteção de atendimento recente (linha do filaPorFatos que checa
  // "!clienteAguardandoVoce") e o ponto vermelho "Cliente aguardando" (nivel 1, cpHomeLeadRow)
  // disparava só por o cliente ter falado por último — mesmo (a) eu tendo atendido recentemente,
  // ou (b) a fala dele sendo só uma despedida sem pedir nada. Mesmo bug já corrigido em
  // emJanelaDeEspera/cpProbabilidadeFechamento, agora também aqui: exige não estar protegido por
  // atendimento recente (protegidoPosAtendimento, a mesma checagem que atendidoRecente já usa
  // logo abaixo) E que a fala realmente peça uma resposta.
  const clienteAguardandoVoce = ultimoCliente && !protegidoPosAtendimento(l)
    && (typeof ultimaMsgClientePedeResposta !== 'function' || ultimaMsgClientePedeResposta(l));
  const fmtDias = n => n === 0 ? "hoje" : n === 1 ? "há 1 dia" : `há ${n} dias`;

  const { nivel, grupo, titulo } = filaPorFatos({
    atendidoRecente: protegidoPosAtendimento(l),
    contatadoHoje: !!ehContatadoHoje(l),
    lembreteFuturo: lembreteFuturo(l),
    clienteAguardandoVoce,
    lembreteAtrasado,
    retornoParaHoje,
    negociacaoAguardando: negociacaoAguardandoRetorno,
    compromissoProgramado,
    clientePediuTempo: clientePediuPraAguardar,
    emJanela: emJanelaDeEspera(l),
    travaExterna,
    pendenciaCorretor,
    retomadaPorTempo
  });

  // Motivo factual visível em cada card (§6.6), montado a partir do nível/grupo.
  let motivo;
  if(nivel === 1) motivo = `cliente respondeu e ainda não recebeu sua resposta${Number.isFinite(diasResposta) ? ` (respondeu ${fmtDias(diasResposta)})` : ""}`;
  else if(nivel === 2) motivo = `compromisso combinado está vencido${diasLembrete != null ? ` (${fmtDias(Math.abs(diasLembrete))})` : ""}`;
  else if(nivel === 3) motivo = "retorno combinado para hoje";
  else if(nivel === 4) motivo = ctxIA.contatoParceiro ? "contraproposta aguardando retorno do cliente final" : "proposta/condição em aberto aguardando você";
  else if(nivel === 5) motivo = "há atendimento ou visita programado";
  else if(nivel === 6) motivo = `sem contato ${fmtDias(diasContato)} — hora de retomar`;
  else if(nivel === 7) motivo = "você chamou por último — aguardando a resposta do cliente";
  else if(grupo === "tratado-hoje") motivo = ehContatadoHoje(l) ? "você já atendeu este lead hoje" : "você atendeu este lead nos últimos dias";
  else if(titulo === "Tem lembrete futuro") motivo = diasLembrete != null ? `retorno agendado para daqui a ${diasLembrete} dia(s)` : "tem lembrete futuro — não antecipar";
  else if(grupo === "pode-aguardar") motivo = "cliente pediu tempo ou ficou de avaliar";
  else if(grupo === "boa-sem-urgencia") motivo = "boa oportunidade, mas depende de evento externo";
  else motivo = (!msgsCli.length && !sinalCompra && !pendenciaCorretor && !temAgenda) ? "ainda não houve conversa comercial real" : "sem fato urgente no momento";

  // Score determinístico: o NÍVEL manda (gap de 1000 entre níveis, imune ao tempero
  // de conversão de ±24). Dentro do mesmo nível, desempate factual por recência —
  // quem está esperando há mais tempo sobe um pouco.
  const desempate = Number.isFinite(diasResposta) ? Math.min(120, Math.max(0, diasResposta)) : 0;
  const scoreGrupoSemNivel = grupo === "boa-sem-urgencia" ? 200
    : grupo === "pode-aguardar" ? 120
    : grupo === "tratado-hoje" ? 60 : 0;
  const score = nivel ? (8 - nivel) * 1000 + desempate : scoreGrupoSemNivel;

  return { score, grupo, titulo, motivo, nivel };
}

function scorePrioridadeAtendimento(l){
  return prioridadeAtendimento(l).score;
}

function prioridadeTituloCurto(l){
  const pa = prioridadeAtendimento(l) || {};
  return pa.titulo || "Prioridade";
}
function prioridadeClasse(l){
  const g = String((prioridadeAtendimento(l) || {}).grupo || "");
  if(g === "acao-hoje") return "hot";
  if(g === "retomar-cuidado") return "warm";
  if(g === "pode-aguardar" || g === "tratado-hoje" || g === "boa-sem-urgencia") return "wait";
  return "cold";
}
function compararPrioridadeAtendimento(a,b){
  const ra = scoreRankingHoje(a);
  const rb = scoreRankingHoje(b);
  if(rb !== ra) return rb - ra;
  const pa = scorePrioridadeAtendimento(a);
  const pb = scorePrioridadeAtendimento(b);
  if(pb !== pa) return pb - pa;
  const ca = scoreConversaoHoje(a);
  const cb = scoreConversaoHoje(b);
  if(cb !== ca) return cb - ca;
  return 0;
}

// ORDEM DE CONVERSÃO HOJE — separado da prioridade de atendimento.
// Prioridade responde: "quem merece ação agora?"
// Conversão responde: "quem está mais perto de virar venda se eu agir hoje?"
// Isso evita um lead aparecer como maior avanço comercial só por ter lembrete/retomada.
// Lead em viabilidade financeira continua importante, mas fica abaixo de quem já visitou,
// recebeu proposta/simulação ou está comparando decisão.
// v1024 — mesmo achado de lentidão do prioridadeAtendimento (ver comentário lá): compararPrioridadeAtendimento
// chama scoreConversaoHoje até 2x por lead (direto + via scoreRankingHoje), e o comparador roda
// dentro de vários .sort() — cache por objeto de lead evita recomputar a mesma conta à toa.
const _conversaoHojeCache = new WeakMap();
function scoreConversaoHoje(l){
  if(l && typeof l === "object" && _conversaoHojeCache.has(l)) return _conversaoHojeCache.get(l);
  const resultado = _scoreConversaoHojeCalcular(l);
  if(l && typeof l === "object") _conversaoHojeCache.set(l, resultado);
  return resultado;
}
function _scoreConversaoHojeCalcular(l){
  const a = l?.analysis || {};
  const txt = textoSinais(l);
  const dias = Number(l?.daysSinceLastInteraction);
  let diasResposta = l?.daysSinceClientReply; if(diasResposta==null) diasResposta = _diasDesdeMsg(l, true);

  const msgs = Array.isArray(l?.recentMessages) ? l.recentMessages : [];
  const primeiroNome = String(l?.name || "").toLowerCase().trim().split(/\s+/)[0] || "";
  const ultimoCliente = (() => {
    for(let i = msgs.length - 1; i >= 0; i--){
      const m = msgs[i];
      if(!m || !String(m.text||"").trim()) continue;
      return ehMsgDoCliente(m, primeiroNome);
    }
    return false;
  })();

  const propostaOuSimulacao = /proposta|simula(?:ção|cao|r)|condi[çc][ãa]o enviada|tabela enviada|4 propostas|or[çc]amento enviado|fluxo de pagamento|parcelamento|sinal/.test(txt);
  const visitaOuApresentacao = /visit(ou|a feita|amos|aram)|decorado|apresenta(?:ção|cao)|foi conhecer|conheceu|passou no loteamento|mostrei|apresentei/.test(txt);
  const comparandoConcorrente = /outro im[óo]vel|concorrente|comparando|estamos vendo|estou vendo outro|olhando outro|op[çc][ãa]o/.test(txt);
  const travaFinanceira = /entrada|parcela|financeir|financi|banco|caixa|or[çc]amento|teto|renda|capacidade/.test(txt);
  const viabilidadeAntesDaProposta = travaFinanceira && !propostaOuSimulacao;
  const clientePediuTempo = /vou pensar|vou analisar|estamos analisando|vou conversar|vou ver com|te aviso|te retorno|qualquer coisa te chamo|mais pra frente|semana que vem|m[êe]s que vem/.test(txt);
  const parceiro = /parceir|corretor/i.test(String(a.tipoContato||""));

  let score = 0;

  if(propostaOuSimulacao) score += 32;
  if(visitaOuApresentacao) score += 24;
  if(comparandoConcorrente) score += 16;
  if(Array.isArray(a.confirmedAppointments) && a.confirmedAppointments.length) score += 18;

  const tipo = String(a.tipoRetomada||"").toLowerCase();
  if(tipo === "quente-fechar") score += 28;
  else if(tipo === "morno-confirmar") score += 16;
  else if(tipo === "objecao-tratar") score += 12;
  else if(tipo === "frio-reaquecer") score -= 10;
  else if(tipo === "stand-by") score -= 18;

  if(ultimoCliente) score += 12;

  const sc682 = sinaisPrioridadeComercial682(l);
  if(sc682.quenteEscondido) score += 32;
  else if(sc682.compradorReal && !sc682.curioso) score += 18;
  if(sc682.urgencia) score += 14;
  if(sc682.objecao) score += 8;
  if(sc682.curioso && !sc682.compradorReal) score -= 28;

  // Viabilidade financeira é acionável, mas ainda NÃO é fechamento.
  // Ex.: lead em análise financeira tem boa prioridade, mas não deve superar proposta/visita/simulação.
  if(viabilidadeAntesDaProposta) score -= 18;

  // Parceiro só sobe se existe cliente/proposta/simulação real; senão é conversa operacional.
  if(parceiro){
    if(/cliente|comprador|proposta|simula|passar proposta|retorno do cliente|análise do cliente/.test(txt)) score += 10;
    else score -= 12;
  }

  if(temVendaCondicionada(l)) score -= 25;
  if(clientePediuTempo) score -= 22;
  if(lembreteFuturo(l)) score -= 90;
  if(ehContatadoHoje(l)) score -= 80;

  if(Number.isFinite(diasResposta)){
    if(diasResposta <= 2) score += 8;
    else if(diasResposta >= 3 && diasResposta <= 14) score += 4;
    else if(diasResposta > 30) score -= 14;
  } else if(Number.isFinite(dias)){
    if(dias > 30) score -= 14;
  }

  if(semDialogoReal(l)) score -= 35;

  return Math.round(score);
}

// v861 — MISTURA venda + urgência (pedido do dono). Antes a urgência mandava sozinha,
// com degraus de 1000 pontos entre níveis, e a chance de venda era só um tempero de ±24 —
// então lead frio parado flutuava pro topo e comprador quente afundava. Agora a urgência
// factual entra em FAIXAS MODERADAS (sem o degrau gigante) e a chance de fechar ganha
// PESO REAL, podendo reordenar de verdade e até promover um comprador forte acima de um
// lead só um pouco mais urgente porém frio. Os dois pesos abaixo são a calibragem inicial —
// fáceis de ajustar depois de ver o resultado com leads reais.
const RANKING_PESO_VENDA = 12;       // multiplicador da chance de venda (scoreConversaoHoje)
const RANKING_BANDA_URGENCIA = 120;  // separação entre níveis de urgência factual (era 1000)
function scoreRankingHoje(l){
  const atendimento = scorePrioridadeAtendimento(l);
  const conversao = scoreConversaoHoje(l);
  // Urgência factual (níveis 1..7 => atendimento 1000..7120) vira uma base moderada.
  // Grupos brandos (boa-sem-urgencia/pode-aguardar/tratado-hoje: 60..200) passam direto.
  const urgencia = atendimento >= 1000
    ? 1000 + Math.floor(atendimento / 1000) * RANKING_BANDA_URGENCIA
    : atendimento;
  // Chance de venda com peso real, limitada para um único lead não estourar a escala.
  const venda = Math.max(-140, Math.min(200, conversao)) * RANKING_PESO_VENDA;
  return Math.round(urgencia + venda);
}


// Melhor horário pro cabeçalho. Usa o que a IA calculou (padrão de resposta do cliente).
// Quando a conversa é curta demais pra ter padrão (ex.: cliente só mandou o formulário),
// cai num fallback: usa o horário em que a PRÓPRIA cliente mandou mensagem — melhor que esconder.
function horarioContatoLead(l){
  const a = l.analysis || {};
  if(a.melhorHorarioContato) return a.melhorHorarioContato;
  const msgs = Array.isArray(l.recentMessages) ? l.recentMessages : [];
  if(!msgs.length) return "";
  const nome = String(l.name||"").trim().toLowerCase().split(/\s+/)[0] || "";
  const corretorNome = String(state?.cerebroCfg?.corretorNome || "").trim().toLowerCase();
  const business = /(construtora|corretor|imobili|direciona|atendimento|sistema)/i;
  const cont = new Array(24).fill(0);
  let achou = false;
  for(const m of msgs){
    const autor = String(m.author||"").trim();
    if(!autor) continue;
    const autorLower = autor.toLowerCase();
    const ehCorretor = (corretorNome && (autorLower.includes(corretorNome) || corretorNome.includes(autorLower))) || business.test(autor);
    const ehCliente = nome ? autorLower.includes(nome) : !ehCorretor;
    if(!ehCliente) continue;
    const t = String(m.time||"").match(/^(\d{1,2}):/);
    if(!t) continue;
    const h = Number(t[1]);
    if(h>=0 && h<=23){ cont[h]++; achou = true; }
  }
  if(!achou) return "";
  let pico = 0;
  for(let h=0;h<24;h++) if(cont[h] > cont[pico]) pico = h;
  const fmt = h => String(h).padStart(2,"0")+"h";
  return `${fmt(pico)}-${fmt(Math.min(23,pico+1))}`;
}

// Dias desde a última mensagem da timeline. somenteCliente=true conta só mensagens da
// PRÓPRIA cliente (ignora corretor/empresa e anotação manual). Calcula client-side a partir
// do recentMessages que o lead já carrega — funciona mesmo com lead em cache.
function _diasDesdeMsg(l, somenteCliente){
  const msgs = Array.isArray(l.recentMessages) ? l.recentMessages : [];
  if(!msgs.length) return null;
  const nome = String(l.name||"").trim().toLowerCase().split(/\s+/)[0] || "";
  const corretorNome = String(state?.cerebroCfg?.corretorNome || "").trim().toLowerCase();
  const business = /(construtora|corretor|imobili|direciona|atendimento|sistema)/i;
  let maxTs = 0;
  for(const m of msgs){
    if(somenteCliente){
      const autor = String(m.author||"").trim();
      if(!autor) continue;
      const autorLower = autor.toLowerCase();
      const ehCorretor = (corretorNome && (autorLower.includes(corretorNome) || corretorNome.includes(autorLower))) || business.test(autor);
      const ehCliente = nome ? autorLower.includes(nome) : !ehCorretor;
      if(!ehCliente) continue;
      const tp = String(m.type||""); const src = String(m.source||"");
      if(src==="manual" || ["atendimento","nota","ligacao","visita","presencial","print-whatsapp"].includes(tp)) continue;
    }
    const ts = m && m.iso ? Date.parse(m.iso) : NaN;
    if(!isNaN(ts) && ts > maxTs) maxTs = ts;
  }
  return maxTs ? diasCalendarioBR(maxTs) : null;
}

// Corta uma frase num limite SEM partir palavra no meio, e fecha com "…".
function _cortarFrase(s, max){
  s = String(s||"").trim();
  if(s.length <= max) return s;
  let cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  if(sp > max*0.5) cut = cut.slice(0, sp);
  return cut.replace(/[\s,;:.–—-]+$/,"") + "…";
}

function whatsappLink(phone, msg){
  let p = String(phone || "").replace(/\D/g, "");
  if(p && p.length <= 11 && !p.startsWith("55")) p = "55" + p;
  const text = encodeURIComponent(msg || "");
  return p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`;
}
// Link de WhatsApp do lead JÁ com a mensagem sugerida (a "direta", com saudação) preenchida.
// Assim o corretor abre a conversa pronta pra enviar, sem perder a sugestão do Corretor Pro.
function linkWhatsAppDireta(l){
  if(!l || !l.phone) return "";
  let msg = "";
  try{ msg = mensagemAprovadaSemAlteracao(mensagensDaAnalise(l.analysis || {}).direta); }catch(_){ msg = ""; }
  return whatsappLink(l.phone, msg);
}

// Reanálise em SEGUNDO PLANO: roda depois do salvar rápido pra atualizar as sugestões
// considerando a observação nova. Não trava a tela; se o corretor ainda está no lead
// (e não começou a digitar outra obs), re-renderiza com as sugestões atualizadas.
let _reanaliseBgEmAndamento = false;
// Refina as 3 sugestões em segundo plano. A caixa NUNCA mostra "Gerando…": a mensagem-base
// (Direta) já fica visível na hora; quando o refino termina, troca pela versão melhor. Se falhar,
// a mensagem-base continua lá — nunca trava.
async function reanalisarEmSegundoPlano(id){
  if(!id || _reanaliseBgEmAndamento) return;
  _reanaliseBgEmAndamento = true;
  try{
    const res = await fetch("./api/reanalisar-lead", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payloadComCerebro({ id })) // sem novoAtendimento = reanalisa a timeline atual (já com a obs), sem duplicar
    });
    const d = await res.json().catch(()=>({}));
    if(d?.ok){
      invalidarLeadsCache();
      const ta = qs("#novoAtendimentoTexto");
      const digitando = ta && (ta.value||"").trim();
      if(state.lead && String(state.lead.id) === String(id) && !digitando){
        const fresh = await getLeadsData(true);
        const atualizado = (fresh?.items||[]).map(limparLead).find(l => String(l.id) === String(id));
        if(atualizado){ state.lead = atualizado; state.analysis = atualizado.analysis || null; renderLeadFoco(atualizado); }
      }
    }
  }catch(_){}
  finally{ _reanaliseBgEmAndamento = false; }
}
window.reanalisarEmSegundoPlano = reanalisarEmSegundoPlano;

// Re-renderiza o lead em foco com os dados FRESCOS do banco (sem precisar de F5), depois de
// qualquer edição/inclusão — pra refletir na hora respostas, atendimento e datas.
// Preserva eventos registrados localmente que o banco ainda não devolveu (lag de leitura).
async function recarregarLeadFoco(id){
  if(!id || String(state.lead?.id) !== String(id)) return;
  const localAntes = state.lead;
  try{
    invalidarLeadsCache();
    const fresh = await getLeadsData(true);
    const atualizado = (fresh?.items||[]).map(limparLead).find(l => String(l.id) === String(id));
    if(!atualizado || String(state.lead?.id) !== String(id)) return;

    // O banco pode devolver por alguns instantes uma versão anterior. Mescla eventos por
    // assinatura e preserva a data de atendimento mais recente, em vez de comparar tamanho.
    const localEv = localAntes?.analysis?.aprendizado?.eventos || [];
    const freshEv = atualizado?.analysis?.aprendizado?.eventos || [];
    const mapa = new Map();
    for(const e of [...freshEv,...localEv]){
      const chave=[e?.evento||'',e?.detalhes?.de||'',e?.detalhes?.tipo||'',e?.quando||''].join('|');
      if(chave.replace(/\|/g,'')) mapa.set(chave,e);
    }
    const eventos=[...mapa.values()].sort((a,b)=>String(a?.quando||'').localeCompare(String(b?.quando||'')));
    if(eventos.length){
      atualizado.analysis=atualizado.analysis||{};
      atualizado.analysis.aprendizado={...(atualizado.analysis.aprendizado||{}),eventos:eventos.slice(-100)};
    }
    const tLocal=Date.parse(localAntes?.lastAttendanceAt||localAntes?.ultimoAtendimentoEm||'')||0;
    const tFresh=Date.parse(atualizado?.lastAttendanceAt||atualizado?.ultimoAtendimentoEm||'')||0;
    if(tLocal>tFresh){
      atualizado.lastAttendanceAt=localAntes.lastAttendanceAt||localAntes.ultimoAtendimentoEm;
      atualizado.ultimoAtendimentoEm=localAntes.ultimoAtendimentoEm||localAntes.lastAttendanceAt;
      atualizado.lastAttendanceText=localAntes.lastAttendanceText||atualizado.lastAttendanceText;
    }
    // A LISTA traz só um recorte das mensagens. Marcar/desmarcar atendimento não muda a conversa,
    // então preserva o histórico completo já carregado — senão a barra de "Interesse do cliente"
    // (conta mensagens) despencava ao recarregar (ex.: 108 -> 4).
    const msgsLocal=Array.isArray(localAntes?.recentMessages)?localAntes.recentMessages:[];
    const msgsFresh=Array.isArray(atualizado?.recentMessages)?atualizado.recentMessages:[];
    if(msgsLocal.length>msgsFresh.length){
      atualizado.recentMessages=msgsLocal;
      if(localAntes.historyLoaded) atualizado.historyLoaded=localAntes.historyLoaded;
      if(Number.isFinite(Number(localAntes.messageCount))) atualizado.messageCount=localAntes.messageCount;
    }
    state.lead = atualizado; state.analysis = atualizado.analysis || null;
    renderLeadFoco(atualizado);
  }catch(_){
    // O patch otimista já está na tela. Uma falha de leitura nunca desfaz o atendimento.
  }
}
window.recarregarLeadFoco = recarregarLeadFoco;

const TIPO_RETOMADA_CURTO = {
  "quente-fechar": "Pronto pra fechar",
  "morno-confirmar": "Confirmar próximo passo",
  "frio-reaquecer": "Precisa reativar",
  "objecao-tratar": "Tratar objeção",
  "informacao-enviar": "Enviar material",
  "primeiro-contato": "Primeiro contato",
  "stand-by": "Stand-by"
};

// Próximo dia útil após uma data (pula sáb/dom)
function proximoDiaUtilApos(d){
  const r = new Date(d);
  do { r.setDate(r.getDate() + 1); } while (r.getDay() === 0 || r.getDay() === 6);
  return r;
}
// Formata um "quando" cru (ex: "2026-05-30", "amanhã 14h", "06/05 às 14h") em "Dia DD/MM".
// Se a data for passada/hoje/fim de semana, retorna próximo dia útil.
function formatarQuandoLead(quandoStr){
  const s = String(quandoStr || "").trim();
  if(!s) return "";
  const mIso = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const p2 = n => String(n).padStart(2,"0");
  const fmt = (d) => `${dias[d.getDay()]} ${p2(d.getDate())}/${p2(d.getMonth()+1)}`;
  if(mIso){
    const dt = new Date(`${mIso[1]}-${mIso[2]}-${mIso[3]}T12:00:00`);
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const ehFimDeSemana = dt.getDay() === 0 || dt.getDay() === 6;
    if(dt < hoje || dt.getTime() === hoje.getTime() || ehFimDeSemana){
      return fmt(proximoDiaUtilApos(dt < hoje ? hoje : dt));
    }
    return fmt(dt);
  }
  return s; // texto livre tipo "amanhã 14h" — deixa como veio
}

function motivoCurto(l){
  try{
    const sc682 = sinaisPrioridadeComercial682(l);
    if(sc682.quenteEscondido) return "oportunidade com sinais fortes — agir enquanto o interesse está ativo";
    if(sc682.compradorReal && sc682.urgencia) return "comprador real com urgência";
    if(sc682.compradorReal && sc682.objecao) return "comprador real — tratar objeção";
    if(sc682.curioso && !sc682.compradorReal) return "curioso/pesquisa inicial — baixa prioridade";
    const txt = textoSinais(l);
    const propostaOuSimulacao = /proposta|simula(?:ção|cao|r)|condi[çc][ãa]o enviada|tabela enviada|or[çc]amento enviado/.test(txt);
    const travaFinanceira = /entrada|parcela|financeir|financi|banco|caixa|or[çc]amento|teto|renda|capacidade/.test(txt);
    if(travaFinanceira && !propostaOuSimulacao){
      return "prioridade de ação — ainda precisa validar entrada/viabilidade";
    }
    const pa = prioridadeAtendimento(l);
    if(pa && pa.motivo) return _cortarFrase(pa.motivo, 82);
  }catch(_){}
  const dias = Number(l.daysSinceLastInteraction);
  const a = l.analysis || {};
  if(Array.isArray(a.confirmedAppointments) && a.confirmedAppointments[0]){
    const ap = a.confirmedAppointments[0];
    const oQue = ap.oQue || "encontro";
    const quando = formatarQuandoLead(ap.data || ap.quando || "");
    return `${oQue} ${quando}`.trim().slice(0, 60);
  }
  if(a.tipoRetomada && TIPO_RETOMADA_CURTO[a.tipoRetomada]) return TIPO_RETOMADA_CURTO[a.tipoRetomada];
  if(a.nextAction && a.nextAction.length < 80) return a.nextAction;
  if(dias <= 3 && String(a?.diagnostico?.interesse||"").toLowerCase() === "alto") return "Interesse alto · contato recente";
  if(dias >= 7) return `${dias}d parado · precisa retomada`;
  return "Aguardando próximo passo";
}

function classePct(){ return ""; }

function ehEsfriando(l){
  if(!isNaN(lembreteTs(l))) return false;
  const dias = Number(l.daysSinceLastInteraction) || 0;
  const tipo = String(l?.analysis?.tipoRetomada || "").toLowerCase();
  const interesse = String(l?.analysis?.diagnostico?.interesse || "").toLowerCase();
  return dias >= 3 && dias <= 7 && (tipo === "quente-fechar" || interesse === "alto" || interesse === "quente");
}

// Detecta (SEM reanalisar — usa a análise já salva) leads que provavelmente sumiram
// depois do preço: têm objeção de preço/valor e estão parados há alguns dias.
function ehSumicoPosPreco(l){
  const a = (l && l.analysis) || {};
  let obj = Array.isArray(a.objections) ? a.objections.join(" · ") : String(a.objections || "");
  obj = (obj + " " + String(a.risk || "")).toLowerCase();
  const temObjPreco = /(pre[çc]o|valor|caro|percep|or[çc]amento|financ)/.test(obj);
  const dias = Number(l.daysSinceLastInteraction) || 0;
  return temObjPreco && dias >= 3 && !ehContatadoHoje(l);
}
// Badges agora são só ÍCONES (pedido do dono): 💸 sumiço após preço, ❄️ esfriando, 🏠 permuta.
// O título (tooltip) explica o que cada um significa ao passar o mouse.
function tagSumicoPrecoHTML(){
  return `<span title="Provável sumiço após o preço — bom retomar com outras opções" style="font-size:14px;line-height:1;vertical-align:1px;cursor:help">💸</span>`;
}
function tagEsfriandoHTML(){
  return `<span title="Parando — sem resposta há alguns dias" style="font-size:14px;line-height:1;vertical-align:1px;cursor:help">⏳</span>`;
}
function tagPermutaHTML(){
  return `<span title="Envolve permuta/troca de imóvel" style="font-size:14px;line-height:1;vertical-align:1px;cursor:help">🏠</span>`;
}
// "Reaquecer urgente": qualquer lead com SCORE COMERCIAL alto (engajamento real,
// keywords de compra, vários dias distintos) que ficou parado 5+ dias.
function ehReaquecerUrgente(l){
  const dias = Number(l.daysSinceLastInteraction) || 0;
  if(dias < 5) return false;
  return scorePrio(l) >= 80;
}

function ehPermuta(l){ return l.analysis?.permuta === true; }
// Nome dos empreendimentos do lead (vários, se houver). Texto cru — escapar no uso.
function produtosLabel(l){
  const arr = Array.isArray(l?.produtos) ? l.produtos.filter(Boolean) : [];
  if(arr.length) return arr.join(", ");
  // v1093 — devolvia "--" quando o empreendimento não era identificado. Dois problemas: "--" não
  // quer dizer nada pra quem lê, e — pior — como "--" é um texto preenchido, ele ATROPELAVA os
  // avisos que os próprios cartões já traziam prontos ("Produto não identificado", "Não
  // identificado", "Atendimento"). Ou seja: o texto certo existia no código e nunca aparecia.
  // Devolvendo vazio, cada tela mostra o aviso que escolheu — e onde não há aviso, não fica lixo.
  return l?.product || "";
}
// v978 — pedido do dono: na Home, o produto tem que ser SÓ o nome do empreendimento — dormitório,
// condição, preço, tipo de imóvel ficam pra quando abre o lead ("ali tem que aparecer só o nome").
// Só remove palavras GENÉRICAS de tipo/condição — nunca um nome próprio (isso vem do
// Cérebro/conversa, nunca cravado aqui). Pode devolver vazio de propósito quando o texto é 100%
// genérico (ex.: "Terrenos prontos para construir") — quem decide o que fazer com vazio é
// produtosLabelCurto, não esta função (ver comentário lá).
// Limitação conhecida e aceita: é uma limpeza GENÉRICA por palavra, não sabe distinguir uma
// preposição solta (no/na/de/do/da...) de uma preposição que É parte do nome real (ex.: um
// empreendimento chamado "Recanto da Serra" perde o "da"). Não dá pra resolver isso sem uma
// lista de nomes reais — que a regra do projeto proíbe cravar no código.
function cpNomeEmpreendimentoCurto(texto){
  const original = String(texto || "").trim();
  if(!original) return "";
  let t = original;
  t = t.replace(/[()]/g, " "); // DESEMBRULHA parênteses (não apaga o conteúdo — pode ter um nome de empreendimento dentro)
  t = t.replace(/\blote\s+\d+\b/gi, " ");
  t = t.replace(/\bquadra\s+\d+\b/gi, " ");
  t = t.replace(/\b\d+\s*(dormit[óo]rios?|quartos?|su[íi]tes?|vagas?|dorms?)\b/gi, " ");
  t = t.replace(/\bat[ée]\s+r?\$?\s*[\d.,]+\s*(mil|milh(?:ã|õ)es?)?\b/gi, " ");
  t = t.replace(/\b(pronto[a]?\s+para\s+morar|na\s+planta|em\s+constru[çc][ãa]o|financi[aá]vel|futuros?\s+lan[çc]amentos?|prontos?\s+para\s+construir)\b/gi, " ");
  t = t.replace(/\b(apartamentos?|casas?|sobrados?|coberturas?|studios?|kitnets?|salas?\s+comerciais?|terrenos?|lotes?|quadras?|loteamentos?|im[óo]ve(?:l|is)|unidades?|edif[íi]cio|pr[ée]dio|residencial|condom[íi]nio)\b/gi, " ");
  t = t.replace(/\bpronto?a?s?\b/gi, " "); // "pronto(s)/pronta(s)" solto (sem "pra morar/construir" na frase) também é genérico
  t = t.replace(/\b(no|na|nos|nas|de|do|da|dos|das|para)\b/gi, " ");
  t = t.replace(/[,;]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return t;
}
// Versão compacta de produtosLabel pra Home: mesma fonte de dados (l.produtos/l.product). Cada
// item passa por cpNomeEmpreendimentoCurto; item 100% genérico (nada sobra) é OMITIDO da lista —
// não teria sentido misturar o nome de um empreendimento real com o texto inteiro de um item
// vizinho que só dizia algo genérico tipo "terrenos prontos para construir". Nomes repetidos
// (2 itens que viram o mesmo nome depois de limpar) não aparecem duplicados. SÓ quando TODOS os
// itens são genéricos (nenhum nome sobra em lugar nenhum) é que mostra o texto original completo
// — melhor que "--", que apagaria a única informação real que existe pra esse lead. produtosLabel
// (a versão completa) continua igual e é usada em todo o resto do app (dentro do lead, etc.) —
// só a Home usa a versão curta.
function produtosLabelCurto(l){
  const arr = Array.isArray(l?.produtos) ? l.produtos.filter(Boolean) : (l?.product ? [l.product] : []);
  if(!arr.length) return "--";
  const vistos = new Set();
  const nomes = [];
  for(const item of arr){
    const curto = cpNomeEmpreendimentoCurto(item);
    if(!curto) continue;
    const chave = curto.toLowerCase();
    if(vistos.has(chave)) continue;
    vistos.add(chave);
    nomes.push(curto);
  }
  return nomes.length ? nomes.join(" - ") : arr.join(", ");
}

// Início do dia de HOJE no fuso de Brasília (UTC-3 fixo, sem horário de verão desde 2019),
// independente do relógio/fuso do aparelho. Sem isso, contato do fim da tarde de ontem
// "vaza" pra hoje quando o aparelho não está exatamente em Brasília. Mesma lógica que o
// servidor já aplica com America/Sao_Paulo.
function inicioDoDiaBR(){
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone:"America/Sao_Paulo", year:"numeric", month:"2-digit", day:"2-digit" });
  const [y,m,d] = fmt.format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(y, m-1, d, 3, 0, 0, 0)); // meia-noite em Brasília = 03:00 UTC
}

// Dias de CALENDÁRIO entre uma data e hoje, no fuso de Brasília (NÃO "períodos de 24h": senão
// mensagem de ontem à noite vira "hoje" de manhã, porque passaram <24h). 0 = hoje, 1 = ontem.
function diasCalendarioBR(quando){
  if(quando == null) return null;
  const t = (quando instanceof Date) ? quando : new Date(quando);
  if(isNaN(t.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone:"America/Sao_Paulo", year:"numeric", month:"2-digit", day:"2-digit" });
  const civil = d => { const [y,m,dd] = fmt.format(d).split("-").map(Number); return Date.UTC(y, m-1, dd); };
  const diff = Math.round((civil(new Date()) - civil(t)) / 86400000);
  return diff < 0 ? 0 : diff;
}

// "Tratado hoje" só conta quando o corretor ALIMENTOU o lead com atualização real
// (registrou atendimento via Salvar atendimento ou Salvar e reanalisar).
// Abrir WhatsApp / copiar mensagem NÃO conta — é só preparação.
function ehAtendidoHoje(l){
  const eventos = l.analysis?.aprendizado?.eventos || [];
  const hoje = inicioDoDiaBR();
  return eventos.some(e => e?.evento === "contato_manual" && e?.quando && new Date(e.quando) >= hoje);
}
function ehAtendidoNaSemana(l){
  const eventos = l.analysis?.aprendizado?.eventos || [];
  const cutoff = Date.now() - 7*24*60*60*1000;
  return eventos.some(e => e?.evento === "contato_manual" && e?.quando && new Date(e.quando).getTime() >= cutoff);
}
function ehContatadoHoje(l){
  const eventos = l.analysis?.aprendizado?.eventos || [];
  const hoje = inicioDoDiaBR();
  for(const e of eventos){
    if(e.evento !== "contato_manual") continue;
    const q = e.quando ? new Date(e.quando) : null;
    if(q && q >= hoje) return e;
  }
  return null;
}


// v826 §6.5 — Último ATENDIMENTO real, considerando TODAS as fontes: eventos de
// contato manual (botão "Marcar atendimento" e cópia de mensagem), itens manuais
// na timeline (observação, ligação, visita, proposta, mensagem enviada) e os campos
// históricos de último atendimento já gravados na base. Retorna o timestamp (ms) do
// atendimento mais recente, ou 0 se o lead nunca foi atendido.
const TIPOS_ATENDIMENTO_TIMELINE = new Set(["atendimento","nota","ligacao","visita","presencial","proposta","observacao_manual","mensagem_enviada"]);
function ultimoAtendimentoTs(l){
  let maxTs = 0;
  const eventos = l?.analysis?.aprendizado?.eventos || [];
  for(const e of eventos){
    if(e?.evento !== "contato_manual" || !e?.quando) continue;
    const t = Date.parse(e.quando); if(!isNaN(t) && t > maxTs) maxTs = t;
  }
  for(const campo of [l?.lastAttendanceAt, l?.ultimoAtendimentoEm]){
    const t = Date.parse(campo || ""); if(!isNaN(t) && t > maxTs) maxTs = t;
  }
  const msgs = Array.isArray(l?.recentMessages) ? l.recentMessages : [];
  for(const m of msgs){
    const src = String(m?.source || "");
    if(src !== "manual" && src !== "corretor-pro-manual") continue;
    if(!TIPOS_ATENDIMENTO_TIMELINE.has(String(m?.type || ""))) continue;
    const t = Date.parse(m?.iso || ""); if(!isNaN(t) && t > maxTs) maxTs = t;
  }
  return maxTs || 0;
}
// Dias realmente "parado" na negociação: desde o último toque REAL — considera tanto a
// última mensagem (WhatsApp) quanto o último ATENDIMENTO manual do corretor. Sem isto, um
// lead atendido HOJE continuava aparecendo "parado 144d" e caindo em "Oportunidades
// esquecidas"/Raio-X, porque só a idade da última mensagem era levada em conta. Retorna
// Infinity quando não há nenhum sinal de data (nunca tocado).
function diasParado(l){
  let dias = Number(l?.daysSinceClientReply != null ? l.daysSinceClientReply : l?.daysSinceLastInteraction);
  if(!Number.isFinite(dias)) dias = Infinity;
  const atTs = ultimoAtendimentoTs(l);
  if(atTs){
    const dAt = diasCalendarioBR(atTs);
    if(dAt != null && Number.isFinite(dAt)) dias = Math.min(dias, dAt);
  }
  return dias;
}
// Rótulo humano do atendimento: "agora", "hoje", "ontem" ou "há X dias" (§6.5).
function rotuloTempoAtendimento(ts){
  if(!ts) return "";
  const dias = diasCalendarioBR(ts);
  if(dias === 0) return ((Date.now() - ts) / 60000) < 60 ? "agora" : "hoje";
  if(dias === 1) return "ontem";
  return `há ${dias} dias`;
}

// Prazo de proteção: lead atendido não volta pra fila de prioritários antes do descanso escolhido
// pelo corretor no Cérebro (cpDiasDescansoPosAtendimento — ver comentário perto de limiarRetomada).
// v1022 — usava diasDesdeAtendimentoManual (função removida aqui), que só olhava
// aprendizado.eventos/contato_manual — uma fonte MAIS ESTREITA que ultimoAtendimentoTs (que
// também olha lastAttendanceAt/ultimoAtendimentoEm e mensagens manuais da timeline; a mesma
// fonte que emJanelaDeEspera já usa desde a v1018). As duas checagens de "atendido
// recentemente" tinham divergido: um atendimento salvo por um desses outros caminhos contava
// pra emJanelaDeEspera mas não pra esta proteção — clienteAguardandoVoce (ponto vermelho) e o
// grupo "Atendidos recentemente" podiam discordar da janela de espera sobre o MESMO lead.
// v1049 — pedido do dono: essas duas checagens também discordavam quando o corretor mudava o
// prazo padrão (5 dias) — agora as duas usam a MESMA fonte de verdade (a mesma escolhida no
// Cérebro), nunca mais dois números diferentes pro mesmo conceito.
function protegidoPosAtendimento(l){
  const ts = ultimoAtendimentoTs(l);
  if(!ts) return false;
  const dias = diasCalendarioBR(ts);
  return dias != null && dias < cpDiasDescansoPosAtendimento();
}

// Última resposta do cliente registrada pelo corretor (fecha o ciclo: a mensagem funcionou?).
// Retorna "sim" | "nao" | "aguardando" | null. Pega o registro mais recente (qualquer dia).
function respostaClienteRegistrada(l){
  const eventos = l?.analysis?.aprendizado?.eventos || [];
  for(let i = eventos.length - 1; i >= 0; i--){
    if(eventos[i].evento === "cliente_respondeu"){
      return eventos[i].detalhes?.resposta || null;
    }
  }
  return null;
}

// Identifica venda condicionada para ordenar a fila por fatos reais.
// Não gera nem exibe probabilidade, percentual ou score comercial.
function temVendaCondicionada(l){
  if(ehPermuta(l)) return true;
  const txt = [
    l?.analysis?.memoria?.observacoes,
    l?.memoria?.observacoes,
    l?.analysis?.risk,
    l?.summary
  ].filter(Boolean).join(" ").toLowerCase();
  if(!txt) return false;
  return /depende de vender|precisa vender|tem que vender|ainda (vai|tem que|precisa) vender|vender (a|sua|o|seu) (casa|im[óo]vel|apartamento|apto|terreno|lote)|condicionad|\bsafra\b|\bcolheita\b|quando (eu )?colher|troc[ao] (por|de|um|o) (ve[íi]culo|carro|caminhonete|caminh[ãa]o|trator)|ve[íi]culo (como|na|de) (parte d[ao] )?entrada/.test(txt);
}
// Atendimento REGISTRADO pelo corretor (presencial, visita, ligação, anotação) = engajamento REAL
// de primeira mão, mesmo sem o cliente ter digitado nada no WhatsApp. Vale mais que mensagem de texto.
// v1068 — achado da auditoria comercial: esta função só olhava l.recentMessages, então um lead
// marcado atendido SÓ pelo botão de um clique "Marcar atendimento" (que grava o evento em
// analysis.aprendizado.eventos/lastAttendanceAt, NUNCA na timeline — ver api/reanalisar-lead.js)
// voltava false aqui, mesmo com ultimoAtendimentoTs(l) > 0 (usada por emJanelaDeEspera desde a
// v1018/v1022 e considerada a fonte de verdade de "isso foi atendido"). Na prática, esse lead
// nunca saía de "Oportunidades esquecidas" mesmo depois de esfriar, e mostrava "N msgs do
// cliente" em vez de "você já atendeu" — as duas checagens de "atendido" precisam concordar.
function temAtendimentoManual(l){
  return !!(typeof ultimoAtendimentoTs === 'function' ? ultimoAtendimentoTs(l) : 0);
}
// v1071 — pedido do dono: um contador de quem falta atender há muito tempo, com prazo FIXO de
// 30 dias (não o "descanso" configurável no Cérebro, que é outra régua, usada só pra decidir
// quando um lead JÁ atendido volta a ser candidato em "Fazer agora"). Aqui é só uma leitura
// direta: nunca atendido, ou último atendimento há 30 dias ou mais.
function cpSemAtenderHaDias(l, dias){
  const at = ultimoAtendimentoTs(l);
  if(!at) return true; // nunca atendido = com certeza "falta atender"
  const d = diasCalendarioBR(at);
  return d == null || d >= dias;
}
function cpContarSemAtender(items, dias){
  return (Array.isArray(items) ? items : []).filter(l => leadEhAtivo(l) && cpSemAtenderHaDias(l, dias)).length;
}
// v1071 — abre a lista de quem está sem atender há 30d+, do mais antigo pro mais recente.
// "Nunca atendido" é sempre mais atrasado que "atendido há muito tempo" — por isso vem primeiro,
// antes de ordenar quem tem data de atendimento (mais velha primeiro).
function cpAbrirSemAtender30Dias(){
  const items = Array.isArray(state.itemsAtivos) ? state.itemsAtivos : [];
  const alvo = items.filter(l => leadEhAtivo(l) && cpSemAtenderHaDias(l, 30));
  if(!alvo.length){ toast("Nenhum lead sem atendimento há 30 dias ou mais."); return; }
  const semData = [], comData = [];
  for(const l of alvo){ (ultimoAtendimentoTs(l) ? comData : semData).push(l); }
  comData.sort((a,b) => ultimoAtendimentoTs(a) - ultimoAtendimentoTs(b));
  const leads = [...semData, ...comData];
  const sub = `${leads.length} lead${leads.length>1?"s":""} sem atendimento há 30 dias ou mais — do mais antigo pro mais recente.`;
  abrirGrupoHome("__semAtender30", { meta:{ titulo:"Sem atender 30d+", sub }, leads });
}
window.cpSemAtenderHaDias = cpSemAtenderHaDias;
window.cpAbrirSemAtender30Dias = cpAbrirSemAtender30Dias;
window.cpContarSemAtender = cpContarSemAtender;
const BUSINESS_RE = /(construtora|direciona|atendimento)/i;
// Item de registro interno (cópia de mensagem sugerida, nota, atendimento marcado, ligação,
// visita etc.) — NUNCA é uma fala real na conversa, mesmo tendo texto e data.
function ehMsgManualTimeline(m){
  const src = String(m?.source||"").toLowerCase(), type = String(m?.type||"").toLowerCase();
  return src==='manual'||src==='crm'||src==='corretor-pro-manual'||type==='print-whatsapp'||
    ['atendimento','nota','ligacao','visita','presencial','proposta','observacao_manual','mensagem_enviada'].includes(type);
}
// "Corretor", "Imobiliária" e "Imóveis" podem fazer parte do NOME do contato parceiro.
// Por isso não podem, sozinhos, transformar a fala dele em mensagem da empresa.
function ehMsgDoCliente(m, primeiroNomeCliente){
  // Um registro manual (ex.: autor "Mensagem enviada (você)" ao copiar uma sugestão) não bate
  // nem com BUSINESS_RE nem com o nome do cliente — sem este corte, caía no padrão "qualquer
  // outro autor é o cliente" logo abaixo e lia SUA PRÓPRIA mensagem copiada como se o cliente
  // tivesse respondido. Isso fazia o lead virar "Cliente aguardando" (prioridade máxima) e pular
  // a proteção de 5 dias pós-atendimento, mesmo o cliente em silêncio há semanas.
  if(ehMsgManualTimeline(m)) return false;
  const autor = String(m?.author || "").trim();
  if(!autor || autor === "Sistema") return false;
  const autorNorm = autor.toLowerCase();
  const nomeNorm = String(primeiroNomeCliente || "").trim().toLowerCase();
  // Nome do corretor vem do Cérebro (campo "Seu nome", configurado pelo próprio usuário) — não
  // pode ficar cravado no código. Removido de vez o corte antigo que só reconhecia dois nomes de
  // pessoa cravados no código (achado da auditoria de isolamento entre contas); qualquer outro
  // rótulo de autor do próprio corretor no export do WhatsApp caía no "qualquer outro autor é o
  // cliente" logo abaixo, e uma mensagem do PRÓPRIO corretor virava "cliente esperando resposta"
  // na fila de prioridade.
  let corretorNorm = "";
  try{
    const cfg = (typeof obterCerebroConfigParaAnalise === "function") ? obterCerebroConfigParaAnalise() : null;
    corretorNorm = String(cfg?.corretorNome || "").trim().toLowerCase().split(/\s+/)[0] || "";
  }catch(_){ }
  const ehAutorCorretor = !!(corretorNorm && autorNorm.includes(corretorNorm));
  // O nome do contato tem prioridade sobre palavras de profissão no próprio nome
  // (ex.: "Anderson Ruviaro Corretor SM Gabro") — mas nunca sobre o autor ser o próprio corretor.
  if(nomeNorm && autorNorm.includes(nomeNorm) && !ehAutorCorretor) return true;
  if(ehAutorCorretor || BUSINESS_RE.test(autor)) return false;
  // Em conversa individual, qualquer outro participante real é o contato.
  return true;
}

// Palavras-chave que indicam INTERESSE COMERCIAL REAL do cliente.
const KEYWORDS_COMPRA = [
  /condi[çc][õo]es?\s+(?:de\s+)?pag/i,
  /forma\s+(?:de\s+)?pag/i,
  /\bentrada\b/i,
  /parcelament|parcela|presta[çc][ãa]o/i,
  /financiament|financi[ao]|\bcaixa\b/i,
  /entrega|prazo\s+(?:de\s+)?entrega|quando\s+(?:fica|entrega|pronto)/i,
  /permuta|troca|dou\s+(meu|minha|um|uma)\s+(carro|terreno|apartamento|casa|im[óo]vel)/i,
  /\bvisita\b|posso\s+(?:conhecer|ir|passar)|vou\s+a[íi]/i,
  /reserva|quero\s+(?:reservar|fechar)|vamos\s+fechar|posso\s+fechar/i,
  /sinal|escritura|cart[óo]rio|\bcontrato\b/i,
  /quanto\s+(?:[ée]|fica|sai|custa)|qual\s+(?:o\s+)?valor|qual\s+(?:o\s+)?pre[çc]o/i
];

// Score comercial: combina prob da IA + sinais macro (sempre disponíveis) +
// engajamento real (quando há recentMessages) + keywords + temporal.
// Lembrete agendado: data futura = lead "parkeado" (não enche o saco até a hora);
// data vencida = virou prioridade do dia (tem que resolver hoje).
function lembreteTs(l){
  const q = l?.analysis?.lembrete?.quando;
  if(!q) return NaN;
  const t = new Date(q).getTime();
  return isNaN(t) ? NaN : t;
}
function lembreteVencido(l){ const t = lembreteTs(l); return !isNaN(t) && t <= Date.now(); }
function lembreteFuturo(l){ const t = lembreteTs(l); return !isNaN(t) && t > Date.now(); }
// Compromisso de HOJE conta o dia inteiro (por DATA, não pela hora exata): um lembrete marcado
// para hoje às 10h continua sendo compromisso de hoje mesmo depois das 10h — só vira atrasado amanhã.
function lembreteHojeOuFuturo(l){
  const t = lembreteTs(l);
  if(isNaN(t)) return false;
  try{
    const iso = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(t));
    const diff = typeof ui671DiasAte==='function' ? ui671DiasAte(iso) : null;
    return diff!=null ? diff>=0 : t>Date.now();
  }catch(_){ return t>Date.now(); }
}
// v931 — o número do tile "Agenda" da Home precisa ser o MESMO que aparece na tela Agenda de
// verdade (carregarAgenda): lembrete de hoje/futuro + compromissos confirmados. Antes o tile
// usava cp786Categoria==='programados' (que também conta compromisso VENCIDO, mantido em
// destaque até ser atendido) — número maior que o da Agenda, que nunca lista o vencido de um
// lead ativo. Mesma conta aqui, sem duplicar ranking.
// v1093 — o dono: "compromisso atrasado deve constar como atrasado, e precisa destaque de atenção
// lá em cima no sininho, pois está muito discreto um compromisso que é importantíssimo".
//
// O que estava errado: este número escondia o compromisso VENCIDO. Isso fazia sentido na v931,
// quando a tela Agenda realmente não listava vencido — mas a v1011 criou a seção "Atrasados" no
// TOPO dessa tela. Ou seja, desde então o quadro da Home mostrava MENOS do que a Agenda tinha, e
// justo o item mais urgente: o compromisso que já passou da hora ficava invisível na Home.
//
// Agora a conta é uma só, e devolve o detalhe pra quem precisa destacar o atraso.
function cpAgendaResumo(items){
  const vazio = { total:0, atrasados:0, agendados:0 };
  if(!Array.isArray(items)) return vazio;
  const iniHojeA = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  let agendados = 0, atrasados = 0;
  for(const l of items){
    const t = lembreteTs(l);
    if(!isNaN(t) && t >= iniHojeA) agendados++; // lembrete de hoje ou futuro
    // Compromissos confirmados que ainda NÃO venceram. Os vencidos são descontados aqui pra não
    // serem contados duas vezes (uma como agendado, outra como atrasado).
    const aps = l?.analysis?.confirmedAppointments;
    if(Array.isArray(aps)){
      const vencidos = (typeof cpCompromissosVencidosDoLead === 'function') ? cpCompromissosVencidosDoLead(l).length : 0;
      agendados += Math.max(0, aps.length - vencidos);
    }
    // Atrasado conta por LEAD (é assim que a seção "Atrasados" da tela Agenda mostra: um cartão
    // por cliente, com os itens vencidos dele dentro).
    if(typeof cp786CompromissoAtrasado === 'function' && cp786CompromissoAtrasado(l)) atrasados++;
  }
  return { total: agendados + atrasados, atrasados, agendados };
}
window.cpAgendaResumo = cpAgendaResumo;

function cpAgendaContagem(items){ return cpAgendaResumo(items).total; }
window.cpAgendaContagem = cpAgendaContagem;

// scorePrio = ORDENAÇÃO/prioridade do funil (usa a sentinela do lembrete pra jogar pro topo/rodapé).
// scoreSinais = só os sinais comerciais reais (SEM a sentinela) — usado no cálculo da PROBABILIDADE,
// pra um lembrete vencido/futuro não estourar tudo pro teto (95%) ou piso (5%).
function scorePrio(l){
  const _lt = lembreteTs(l);
  if(!isNaN(_lt)){
    if(_lt <= Date.now()) return 100000;
    return -100000;
  }
  return scoreSinais(l);
}
function scoreSinais(l){
  const dias = Number(l.daysSinceLastInteraction);
  const a = l.analysis || {};
  const msgs = Array.isArray(l.recentMessages) ? l.recentMessages : [];
  const primeiroNome = String(l.name || "").toLowerCase().trim().split(/\s+/)[0] || "";

  // 1. SINAIS MACRO (sempre disponíveis, mesmo sem recentMessages)
  let sMacro = 0;
  if(Array.isArray(a.confirmedAppointments) && a.confirmedAppointments.length) sMacro += 25;
  if(a.permuta) sMacro += 10;
  switch(String(a.tipoRetomada||"").toLowerCase()){
    case "quente-fechar":    sMacro += 25; break;
    case "morno-confirmar":  sMacro += 10; break;
    case "objecao-tratar":   sMacro += 8; break;
    case "frio-reaquecer":   sMacro -= 5; break;
    case "stand-by":         sMacro -= 10; break;
    case "primeiro-contato": sMacro -= 15; break;
    case "informacao-enviar":sMacro -= 8; break;
  }

  // 2. ENGAJAMENTO (só se há recentMessages com conteúdo real)
  let sEng = 0;
  if(msgs.length){
    const msgsCli = msgs.filter(m => ehMsgDoCliente(m, primeiroNome));
    if(msgsCli.length >= 10) sEng += 20;
    else if(msgsCli.length >= 5) sEng += 10;
    else if(msgsCli.length > 0) sEng -= 5;
    const dSet = new Set();
    for(const m of msgsCli){
      const d = m.date || (m.iso ? String(m.iso).slice(0,10) : "");
      if(d) dSet.add(d);
    }
    const dDist = dSet.size;
    if(dDist === 1) sEng -= 15;       // fogo de palha
    else if(dDist <= 3) sEng += 5;
    else if(dDist <= 6) sEng += 15;
    else if(dDist > 6) sEng += 25;    // engajamento forte
  }

  // 3. PALAVRAS-CHAVE de compra (+5 cada, máx +30) — só conta nas msgs do cliente
  let sKw = 0;
  if(msgs.length){
    let hits = 0;
    for(const m of msgs){
      if(!ehMsgDoCliente(m, primeiroNome)) continue;
      const txt = String(m.text || "");
      if(!txt) continue;
      for(const re of KEYWORDS_COMPRA){
        if(re.test(txt)){ hits++; if(hits >= 6) break; }
      }
      if(hits >= 6) break;
    }
    sKw = Math.min(30, hits * 5);
  }

  // 4. TEMPORAL: recência do último contato
  let sTemp = 0;
  if(Number.isFinite(dias)){
    if(dias <= 3) sTemp = 10;
    else if(dias <= 7) sTemp = 0;
    else if(dias <= 14) sTemp = -5;
    else if(dias <= 30) sTemp = -10;
    else if(dias <= 60) sTemp = -15;
    else sTemp = -25;
  }

  // PARCEIRO/corretor: o volume de conversa é OPERACIONAL (planta, projeto, coordenação),
  // não calor de compra — não deixa engajamento/keywords inflarem o score dele.
  if(/parceir|corretor/i.test(String(a.tipoContato||""))){ sEng = 0; sKw = 0; }
  return sMacro + sEng + sKw + sTemp;
}

// Lead SEM diálogo real: o cliente nunca engajou de verdade. Típico do caso "mandou só
// 'oi/beleza/opa', recebeu material e sumiu — nunca respondeu, nunca negociou". Esses NÃO
// podem ter % alto de fechamento (super estimado). Só conta como diálogo real quando há
// sinal concreto: várias mensagens do cliente, em vários dias, palavra-chave de compra,
// compromisso confirmado, ou retomada quente/morna.
function semDialogoReal(l){
  const a = l.analysis || {};
  const msgs = Array.isArray(l.recentMessages) ? l.recentMessages : [];
  if(!msgs.length) return false; // sem histórico importado não dá pra julgar o engajamento
  const primeiroNome = String(l.name || "").toLowerCase().trim().split(/\s+/)[0] || "";
  const msgsCli = msgs.filter(m => ehMsgDoCliente(m, primeiroNome));
  const dSet = new Set();
  for(const m of msgsCli){ const d = m.date || (m.iso ? String(m.iso).slice(0,10) : ""); if(d) dSet.add(d); }
  let kwHits = 0;
  for(const m of msgsCli){ const t = String(m.text || ""); if(!t) continue; for(const re of KEYWORDS_COMPRA){ if(re.test(t)){ kwHits++; break; } } }
  const temAgenda = Array.isArray(a.confirmedAppointments) && a.confirmedAppointments.length > 0;
  const tipo = String(a.tipoRetomada||"").toLowerCase();
  const quente = tipo === "quente-fechar" || tipo === "morno-confirmar" || tipo === "objecao-tratar";
  // Mensagem substancial do cliente (não só "oi/beleza/opa") já conta como engajamento.
  const maxLenCli = msgsCli.reduce((mx,m)=>Math.max(mx, String(m.text||"").trim().length), 0);
  const houveDialogo = msgsCli.length >= 5 || dSet.size >= 3 || kwHits >= 1 || temAgenda || quente || maxLenCli >= 30 || temAtendimentoManual(l);
  return !houveDialogo;
}


// Caixa de erro amigável com "Tentar de novo" — evita "Carregando..." preso e texto técnico.
function boxErro(retryJs){
  return `<div class="empty" style="text-align:center;padding:22px 14px">Não consegui carregar agora.<br><span class="small" style="color:var(--muted)">Confira sua internet e tente de novo.</span><br><button type="button" onclick='invalidarLeadsCache();${retryJs}' style="margin-top:12px;padding:8px 18px;border:1px solid var(--lime);background:rgba(255,98,88,.1);color:var(--lime);border-radius:999px;font-weight:950;cursor:pointer">Tentar de novo</button></div>`;
}
window.boxErro = boxErro;

// Janela de espera depois que EU já contatei: não dá pra chamar o cliente todo dia.
// Se mandei mensagem e a bola está com ele (não respondeu), esperamos pelo menos alguns dias;
// só volta a aparecer como ação depois desse prazo. Exceções (NÃO espera):
//  - lembrete pra hoje / compromisso hoje ou amanhã (motivo agendado manda);
//  - o cliente respondeu DEPOIS do meu último toque (aí a bola é minha, devo agir).
// v1048 — pedido do dono: quantos dias de "descanso" um lead ganha depois de atendido antes de
// voltar pra fila "Fazer agora" — era fixo (3 dias pra lead novo, criado há ≤7 dias; 5 pra
// estabelecido), sem opção de mudar. Agora é UM número, escolhido por cada corretor no Cérebro
// (campo "Descanso após atender"); sem valor configurado, cai no padrão histórico de 5.
function cpDiasDescansoPosAtendimento(){
  try{
    const cfg = (typeof obterCerebroConfigParaAnalise === "function") ? obterCerebroConfigParaAnalise() : null;
    const n = Number(cfg?.diasDescansoPosAtendimento);
    if(Number.isFinite(n) && n >= 1 && n <= 60) return Math.round(n);
  }catch(_){}
  return 5;
}
// v1017 — bug relatado várias vezes pelo dono ("o lead volta pra Fazer agora antes do prazo de
// espera") e nunca resolvido de vez: quem falou por último (emJanelaDeEspera/entraEmRetomada,
// abaixo) nunca checava O QUE o cliente disse — um simples "Ok"/"Obrigada"/"Perfeito", sem pedir
// nada, já encerrava a espera na hora, igual a uma pergunta de verdade. Esse MESMO problema já
// tinha sido identificado e corrigido na v944 — só que só dentro de cpProbabilidadeFechamento (a
// função que ORDENA a fila), nunca aqui (as funções que decidem QUEM ENTRA na fila). Extraído pra
// as duas pararem de divergir de novo no futuro.
function ultimaMsgClientePedeResposta(l){
  try{
    const last = (typeof ui670UltimaMensagemReal === 'function') ? ui670UltimaMensagemReal(l) : null;
    if(!last || last.falante !== "contato") return true; // sem como checar: não trava a espera à toa
    const t = String(last.m?.text || "");
    return /\?/.test(t) || /^\s*(pode|consegue|tem como|tem disponibilidade|me manda|me envia|qual|quanto|quando|onde|como|por que|porque)\b/i.test(t);
  }catch(_){ return true; }
}
function limiarRetomada(l){
  return cpDiasDescansoPosAtendimento();
}
function emJanelaDeEspera(l){
  if(lembreteVencido(l)) return false;
  const aps = l.analysis?.confirmedAppointments;
  if(Array.isArray(aps) && aps.some(ap => /\b(hoje|amanh[ãa])\b/.test(String(ap.quando||"").toLowerCase()))) return false;
  // v1018 — pedido explícito e repetido do dono, com casos reais (ex.: "Adão — marquei
  // atendimento quarta dia 22, ainda sim apresenta 26 dias"): a espera conta a partir do ÚLTIMO
  // ATENDIMENTO MARCADO (botão "Marcar atendimento", observação, ligação, visita, proposta —
  // tudo que ultimoAtendimentoTs já reconhece). Sem NENHUM atendimento registrado, não há de onde
  // contar — o lead fica elegível na hora (nunca foi "colocado em espera" por ninguém).
  // v1051 tentou somar um segundo sinal (mensagem, de qualquer lado) pra reforçar esse prazo —
  // v1052 — pedido explícito do dono: "esquece 2 regras, vamos usar uma só, que é de marcar
  // atendimento, esquece a data da última msg". Voltou a ser UMA regra só: o descanso conta
  // SOMENTE a partir do último atendimento marcado — mensagem (de qualquer tipo, qualquer lado)
  // não entra nessa conta de novo.
  const atTs = ultimoAtendimentoTs(l);
  if(!atTs) return false;
  const dias = diasCalendarioBR(atTs);
  if(dias == null) return false;
  // v1019 — "5 dias de descanso" é 5 dias INTEIROS de folga (o dia do atendimento não conta
  // como "esperado"): protegido do dia 1 ao dia 5, elegível de novo só no dia 6. Com "<" puro, um
  // lead atendido há exatamente 5 dias (limiar 5) já saía da proteção no próprio 5º dia — foi
  // exatamente o que aconteceu com o "Adão" logo depois da correção acima (atendido dia 22, no
  // dia 27 — 5 dias — voltou a aparecer, um dia mais cedo do que o esperado).
  return dias <= limiarRetomada(l);
}

// Um lead com contato MUITO recente (< 7 dias) ainda não deve entrar em "retomada" —
// não demos tempo do cliente responder. Exceções (entram mesmo recente):
//  - tem lembrete vencido/pra hoje, ou compromisso hoje/amanhã (motivo agendado);
//  - está quente pra fechar (não faz sentido esperar);
//  - o CLIENTE falou por último (a bola está com a gente, precisa responder).
function entraEmRetomada(l){
  if(emJanelaDeEspera(l)) return false; // contatei há <5 dias e ela não respondeu: esperar
  if(lembreteVencido(l)) return true;
  const aps = l.analysis?.confirmedAppointments;
  if(Array.isArray(aps) && aps.some(ap => /\b(hoje|amanh[ãa])\b/.test(String(ap.quando||"").toLowerCase()))) return true;
  if(lembreteFuturo(l)) return false; // agendado pro futuro = parkeado
  if(String(l.analysis?.tipoRetomada||"").toLowerCase() === "quente-fechar") return true;
  const dias = Number(l.daysSinceLastInteraction);
  const limiar = limiarRetomada(l);
  if(Number.isFinite(dias) && dias < limiar){
    // contato recente (< limiar dias: 3 p/ lead novo, 5 p/ estabelecido): só entra se o CLIENTE
    // falou por último E de fato PEDIU uma resposta (v1017 — mesma checagem usada em
    // emJanelaDeEspera/ultimaMsgClientePedeResposta; antes, um "Ok"/"Obrigada" do cliente já
    // bastava pra liberar o lead antes da hora).
    const msgs = Array.isArray(l.recentMessages) ? l.recentMessages : [];
    const primeiroNome = String(l.name||"").toLowerCase().trim().split(/\s+/)[0] || "";
    for(let i = msgs.length - 1; i >= 0; i--){
      const m = msgs[i];
      if(!m || !String(m.text||"").trim()) continue;
      return ehMsgDoCliente(m, primeiroNome) && ultimaMsgClientePedeResposta(l);
    }
    return false; // recém-criado, sem conversa → espera
  }
  return true; // 5+ dias (ou sem info) → pode retomar
}

// Home = 3 listas pra decidir quem atacar. Nenhum lead vem aberto.
// - Prioritários: precisa de ação agora (quente/morno/objeção), fora do prazo de proteção pós-atendimento. Ordenado por score.
// - Stand by: teve interação mas esfriou (stand-by / frio-reaquecer). Retomar depois dos prioritários.
// - Sem evolução: pediu/recebeu info ou primeiro contato e nunca houve conversa real de volta.
function classificarGrupoHome(l){
  return prioridadeAtendimento(l).grupo || "acao-hoje";
}
const GRUPOS_HOME = {
  "acao-hoje":          { titulo: "Atender agora", sub: "Leads em que uma ação sua pode fazer a negociação andar hoje." },
  "retomar-cuidado":    { titulo: "Retomar com cuidado", sub: "Leads com interesse, mas que pedem uma abordagem leve e objetiva." },
  "boa-sem-urgencia":   { titulo: "Boa oportunidade, sem urgência", sub: "Leads bons, mas travados por venda, safra, decisão de terceiros ou prazo." },
  "pode-aguardar":      { titulo: "Pode aguardar", sub: "Você já chamou, há lembrete futuro ou o cliente pediu tempo — não precisa insistir agora." },
  "baixa-prioridade":   { titulo: "Baixa prioridade", sub: "Pouco sinal comercial ou conversa ainda rasa." },
  "tratado-hoje":       { titulo: "Atendidos recentemente", sub: `Leads que você já atendeu nos últimos ${cpDiasDescansoPosAtendimento()} dias — voltam pra fila de prioritários depois disso.` },
  "hoje":               { titulo: "Atender hoje", sub: "Fila ordenada por prioridade de atendimento, não apenas por chance de venda." },
  "todos":              { titulo: "Todos os leads ativos", sub: "Todos os leads em aberto, com prioridade comercial calculada pela conversa." }
};

function renderListasHome(ordenados){
  const foco = qs("#leadFocoArea");
  if(!foco) return;
  // Esconde os containers antigos (top3/fila).
  const area = qs("#top3Area"); if(area){ area.style.display = "none"; area.innerHTML = ""; }
  const fila = qs("#filaPrioridade"); if(fila){ fila.style.display = "none"; fila.innerHTML = ""; }

  // Classifica por prioridade real de atendimento: agir agora ≠ maior chance de venda.
  const grupos = { "acao-hoje": [], "retomar-cuidado": [], "boa-sem-urgencia": [], "pode-aguardar": [], "baixa-prioridade": [], "tratado-hoje": [] };
  for(const l of (ordenados || [])){
    const g = classificarGrupoHome(l);
    if(grupos[g]) grupos[g].push(l);
  }
  // Ordena por prioridade de atendimento primeiro; avanço comercial fica só como desempate.
  const porPrioridade = compararPrioridadeAtendimento;
  grupos["acao-hoje"].sort(porPrioridade);
  grupos["retomar-cuidado"].sort(porPrioridade);
  grupos["boa-sem-urgencia"].sort(porPrioridade);
  grupos["pode-aguardar"].sort(porPrioridade);
  grupos["baixa-prioridade"].sort(porPrioridade);
  grupos["tratado-hoje"].sort(porPrioridade);
  // "todos" = lista completa dos ativos, por prioridade de atendimento.
  grupos["todos"] = (ordenados || []).slice().sort(porPrioridade);
  // "retomada" = aparece quando não há urgentes. Leads parados que valem um toque proativo.
  grupos["retomada"] = (grupos["acao-hoje"].length + grupos["retomar-cuidado"].length) === 0
    ? grupos["todos"].filter(l =>
        !ehContatadoHoje(l) &&
        !lembreteFuturo(l) &&
        !emJanelaDeEspera(l) &&
        Number(l.daysSinceLastInteraction) >= 3 &&
        Number(l.daysSinceLastInteraction) <= 30
      ).slice(0, 20)
    : [];
  state.gruposHome = grupos;

  // Se o usuário está dentro de um grupo (ou viu um lead aberto), NÃO redesenha a tela —
  // senão o auto-refresh do dashboard derruba ele de qualquer subtela. Os contadores
  // serão atualizados quando ele clicar "Voltar". focoLeadId é um marcador durável do lead
  // em foco — protege mesmo se state.lead ficar momentaneamente inconsistente (reanálise/import).
  if(state.grupoAtivo || state.focoLeadId || state.lead?.id) return;

  // Tela inicial = 4 botões de ação (Prioritários, Stand by, Sem evolução, Importar conversa).
  renderBotoesHome();
}

// Home M1: chips de triagem + top 3 com motivo/WhatsApp + compromissos confirmados + KPI strip.
// Ícone do WhatsApp (igual ao desenho — círculo verde com o glifo).
const WA_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.1-.3.2-.5.1-.7-.3-1.5-.6-2.1-1.5-.5-.6-.8-1.3-.9-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.1.1-.3.2-.4 0-.1 0-.3 0-.4 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.9 2.3 1 2.5c.1.2 1.7 2.7 4.2 3.7.6.3 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1 .1-1.2z"/></svg>`;
// v942 — barra de status das mensagens do cliente (Modelo A escolhido pelo dono: barra
// horizontal + número, cor por nível). Mesma métrica do "Interesse do cliente" que já existe
// dentro do lead (mensagensDoCliente). Cor: baixo = cinza, médio/alto = coral. v942.1 — a barra
// enche RELATIVA ao maior da lista (maxMsgs): antes saturava em 30 msgs e, numa carteira onde os
// leads têm 56–218 msgs, TODAS ficavam cheias e iguais (não diferenciava nada). Relativa ao topo,
// a diferença aparece (o #1 cheio, os de baixo proporcionalmente menores). O número exato fica ao
// lado.
// v972 — ATENÇÃO, não "corrigir" isto pra bater com a ordem da fila: este número é volume bruto
// de mensagens (engajamento), o MESMO fator que v943/v944 baixaram de propósito no peso do
// ranking (cpProbabilidadeFechamento) — não é, e nunca foi, a nota de prioridade. Não mexer
// nestes limiares/cores.
function cpBarraMensagensMini(l, maxMsgs){
  // v1017 — pedido do dono: essa barra passa a respeitar os últimos 90 dias, igual "Total de
  // mensagens" (v1016) — mensagensDoCliente (histórico inteiro) continua existindo pro ranking/
  // outras telas (ver comentário de mensagensDoClienteRecente), só esta barra usa a versão nova.
  const n = (typeof mensagensDoClienteRecente === 'function') ? mensagensDoClienteRecente(l) : 0;
  const cor = n >= 15 ? '#ff6258' : n >= 5 ? '#ff8f88' : '#8a99a0';
  // v973 — pedido do dono: barra em gradiente, não mais cor chapada. Os 3 níveis/limiares de
  // "cor" continuam os mesmos de sempre (intocados, travados pelo teste v942).
  // v977 — pedido do dono: gradiente vira branco → cor (Opção B, escolhida entre 3 prévias:
  // coral→coral-claro da v973, azul-claro→coral, branco→coral). Branco fixo (#F7FAFB, o mesmo
  // tom do texto do app, --text) — não é um tom mais claro do nível (v973/corClara, removido);
  // harmoniza melhor no fundo escuro, segundo o dono.
  const BRANCO_GRADIENTE = '#F7FAFB';
  const teto = Math.max(1, Number(maxMsgs) || 1);
  const pct = n <= 0 ? 0 : Math.max(8, Math.min(100, Math.round(n / teto * 100)));
  return `<span class="chr-bar" title="${n} mensagem${n===1?'':'s'} do cliente nos últimos 90 dias"><span class="chr-track"><i style="width:${pct}%;background:linear-gradient(90deg,${BRANCO_GRADIENTE},${cor})"></i></span><b style="color:${cor}">${n}</b></span>`;
}
// Linha compacta de lead da Home (opção 1 + lista densa, escolha do dono): nome, produto, barra
// de mensagens e dias parado. Desktop: 1 linha. Mobile: 2 linhas (nome ganha a largura toda;
// barra + produto vão embaixo) — via grid-template-areas, sem quebra lateral.
function cpHomeLeadRow(l, maxMsgs){
  const idJs = JSON.stringify(String(l.id||""));
  // v1050 — pedido do dono: tirou a "bolinha" (indicador colorido de status) da linha; nivel
  // continua existindo só pra decidir o texto do title de "dias" logo abaixo.
  let nivel = 0;
  try{ nivel = (typeof prioridadeAtendimento === 'function') ? (prioridadeAtendimento(l).nivel || 0) : 0; }catch(_){}
  // v1018 — pedido do dono (caso real: "Adão — marquei atendimento quarta dia 22, ainda sim
  // apresenta 26 dias"): daysSinceLastInteraction só olha mensagem (nunca soube de atendimento
  // marcado), então esse número podia ficar bem maior do que o esperado logo depois de atender —
  // mesma causa raiz do bug de emJanelaDeEspera (ver ali).
  // v1053 — pedido do dono (caso real "Karine"): o número mostrado aqui ficava confuso perto da
  // regra de descanso (v1052, que conta SÓ do atendimento) porque só usava a data do atendimento
  // quando ela era MAIS RECENTE que a última mensagem — sobrando casos em que a tela mostrava
  // "há 5d" (da mensagem) enquanto a regra de verdade contava de um atendimento de 10+ dias,
  // dando a impressão de que o sistema estava ignorando a regra. Agora, sempre que existe um
  // atendimento marcado, o número mostrado é dele — nunca mais da mensagem — pra bater com o
  // que a regra de descanso realmente usa. Sem NENHUM atendimento registrado (lead nunca
  // atendido), aí sim mostra a última interação, que é a única data que existe.
  let diasNum = null;
  let diasEhAtendimento = false;
  try{
    const atTs = (typeof ultimoAtendimentoTs === 'function') ? ultimoAtendimentoTs(l) : 0;
    if(atTs){
      const diasAt = diasCalendarioBR(atTs);
      if(diasAt != null){ diasNum = diasAt; diasEhAtendimento = true; }
    }
  }catch(_){}
  if(diasNum == null) diasNum = l.daysSinceLastInteraction;
  const dias = diasNum != null ? `${diasNum}d` : '';
  // v972 — achado do dono: "78d"/"109d" solto do lado de "cliente esperando sua resposta" parecia
  // dizer "o cliente espera há 78/109 dias", mas o campo é dias desde a ÚLTIMA interação de
  // QUALQUER lado (nem sempre é a mesma coisa). Rótulo "há" + title explicam o que é de fato,
  // sem mudar o cálculo do dado (daysSinceLastInteraction continua vindo de onde sempre veio).
  // v1053 — o título passa a bater sempre com o número visível: quando há atendimento marcado,
  // o texto é sempre sobre o atendimento (mesmo em nível 1) — só cai pro texto de "cliente
  // esperando"/"última interação" quando não existe atendimento nenhum pra mostrar.
  const diasTitle = diasNum == null ? '' : (diasEhAtendimento
    ? `${diasNum} dia${diasNum===1?'':'s'} desde o último atendimento marcado`
    : nivel === 1
      ? `Cliente esperando sua resposta há ${diasNum} dia${diasNum===1?'':'s'}`
      : `${diasNum} dia${diasNum===1?'':'s'} desde a última interação (sua ou do cliente)`);
  // v1054 tentou diferenciar "atendido há" de "há" pra dar pra ver, sem abrir o lead, se o app
  // reconhecia atendimento pra aquele lead. v1055 — pedido do dono: "tenque ficar tudo padrão".
  // Texto visível volta a ser sempre "há Xd" pra todo mundo, igual — o NÚMERO continua vindo do
  // atendimento quando ele existe (regra da v1053, essa continua valendo); só o rótulo que virou
  // uniforme de novo. Quem quiser saber se é atendimento ou só mensagem, o title (passar o mouse)
  // ainda diferencia isso, como sempre foi.
  const diasRotulo = "há";
  // v978 — pedido do dono: aqui na Home só o nome do empreendimento (produtosLabelCurto), sem
  // dormitório/condição/preço — detalhe completo (produtosLabel) fica só pra dentro do lead.
  const prod = (typeof produtosLabelCurto === 'function') ? produtosLabelCurto(l) : ((typeof produtosLabel === 'function') ? produtosLabel(l) : (l.product || ''));
  // v975 — pedido do dono: a linha da Home NÃO mostra mais o motivo do ranking (v945/946, depois
  // reformatado em v972/v974). Ele achou redundante — a mesma explicação já mora dentro do lead —
  // e repeti-la resumida aqui só poluía a tela sem ajudar a decidir nada.
  // v1017 — o dono voltou a achar esse motivo poluição mesmo dentro do lead ("só serve pra
  // incomodar, não me ajuda em nada") — cpMotivoFechamento e o card de destaque que o mostrava
  // foram removidos de vez, não sobrevivem em lugar nenhum do app.
  // v972 — achado do dono: o nº da barra de mensagens (ao lado) é o mais chamativo da linha mas
  // NÃO é a prioridade (ver aviso em cpBarraMensagensMini) — por isso pode "parecer maior" num
  // lead que está mais abaixo na lista.
  // v1046 — pedido do dono: tirar de vez o número de posição (1º/2º/3º...) da linha — ele achou
  // desnecessário; a lista em si (com a quantidade certa, configurada no Cérebro) já basta.
  return `<button type="button" class="cp-hoje-row" onclick='abrirLead(${idJs})'>
    <span class="chr-nm">${escapeHtml(l.name||'Cliente')}</span>
    <span class="chr-pr" title="${escapeHtml(prod||'')}">${escapeHtml(prod||'')}</span>
    ${cpBarraMensagensMini(l, maxMsgs)}
    <span class="chr-dd" title="${escapeHtml(diasTitle)}">${dias?`${diasRotulo} ${escapeHtml(dias)}`:''}</span>
  </button>`;
}
// Copia a mensagem sugerida (direta, com saudação) de um lead.
// v826 §6.2/§6.5 — Copiar uma sugestão significa que ela VAI ser enviada. Então conta
// como atendimento (data/hora, entra em Últimos atendimentos e na fila) E entra na
// linha do tempo do cliente como "Mensagem enviada". Nunca altera a etapa comercial e
// não alimenta o aprendizado de estilo (o texto é sugestão da própria IA).
async function registrarMensagemEnviada(id, msg){
  const texto = String(msg || "").trim();
  if(!id || !texto) return;
  // Feedback imediato (§6.7 / atualização sem reload): já marca como atendido agora.
  // v1031 — bug real (relatado: "Wilson" atendido pela cópia de mensagem continuava em
  // Oportunidades esquecidas): antes, só UMA cópia em memória do lead era marcada (o detalhe
  // aberto OU a entrada em itemsAtivos, nunca as duas) — mas abrirLead monta state.lead como um
  // objeto SEPARADO (spread), nunca a MESMA referência que está dentro de itemsAtivos/todosLeads.
  // Marcar só state.lead (o caso comum: copiar mensagem de DENTRO do lead aberto) não mudava nada
  // na entrada real que a Home lê depois — e ao fechar o lead essa marcação local se perdia de
  // vez. Agora marca TODAS as cópias em memória, igual ui667MarcarAtendido já fazia.
  let quando = "", dataLocal = "", horaLocal = "";
  try{
    quando = new Date().toISOString();
    const p = new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,hourCycle:"h23"}).formatToParts(new Date(quando)).reduce((o,x)=>(x.type!=="literal"&&(o[x.type]=x.value),o),{});
    dataLocal = `${p.day}/${p.month}/${p.year}`;
    horaLocal = `${p.hour}:${p.minute}`;
    if(state.lead && String(state.lead.id) === String(id)) ui667AplicarAtendidoLocal(state.lead, quando, dataLocal, horaLocal);
    for(const lista of [state.itemsAtivos, state.todosLeads, state.leads]){
      const item = Array.isArray(lista) ? lista.find(x => String(x.id) === String(id)) : null;
      if(item) ui667AplicarAtendidoLocal(item, quando, dataLocal, horaLocal);
    }
  }catch(_){}
  // v1019 — "copiar mensagem" marca atendimento nesta MESMA chamada (registrarAtendimento:true).
  // Antes, uma falha aqui (timeout, instabilidade) era engolida em silêncio — a tela já tinha
  // mostrado "Mensagem copiada" e marcado atendido NA HORA (otimista, acima), então o corretor
  // nunca ficava sabendo que o atendimento não foi gravado de verdade: o lead voltava a aparecer
  // depois como se nunca tivesse sido atendido ("assim como Adão, vários outros atendi e não
  // marca corretamente as datas"). Agora tenta de novo uma vez antes de desistir, e avisa se
  // mesmo assim não conseguir — em vez de deixar o corretor sem saber.
  const registrarAtendimentoDaCopia = () => fetchComTimeout("./api/reanalisar-lead", { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id, novoAtendimento: texto.slice(0,4000), apenasSalvar:true, autorManual:"Mensagem enviada (você)", tipoManual:"mensagem_enviada", registrarAtendimento:true }) });
  let respAtendimento = null;
  try{ respAtendimento = await registrarAtendimentoDaCopia(); }catch(_){ respAtendimento = null; }
  if(!respAtendimento || !respAtendimento.ok){
    try{ respAtendimento = await registrarAtendimentoDaCopia(); }catch(_){ respAtendimento = null; }
  }
  if(!respAtendimento || !respAtendimento.ok){
    toast("Mensagem copiada, mas não consegui confirmar o atendimento agora. Se este lead voltar a aparecer antes da hora, marque \"Atendido\" manualmente.");
  }
  invalidarLeadsCache();
  // v1031 — mesma rede de segurança do ui667MarcarAtendido: o recarregamento pode responder com
  // uma versão de alguns instantes atrás (antes da marcação terminar de persistir no banco) — sem
  // reaplicar a marcação local depois, ela se perdia de novo, silenciosamente, exatamente como
  // reaplicá-la aqui evita.
  if(quando){
    loadRecentLeads(false).then(() => ui667ReconciliarAtendimentoLocal(id, item => ui667AplicarAtendidoLocal(item, quando, dataLocal, horaLocal))).catch(()=>{});
  } else {
    try{ loadRecentLeads(false); }catch(_){}
  }
  if(state.lead && String(state.lead.id) === String(id)) try{ recarregarLeadFoco(id); }catch(_){}
}

window.copiarMensagemLead = function(id){
  const l = (state.itemsAtivos||[]).find(x => String(x.id) === String(id));
  if(!l) return;
  const a = l.analysis || {};
  const msg = mensagemAprovadaSemAlteracao(mensagensDaAnalise(a).direta);
  if(!msg){ toast("Sem mensagem pronta pra este lead. Abra o lead e reanalise pra gerar."); return; }
  // v984 — antes chamava a função global de aprendizado, que sempre usa state.lead?.id (o lead
  // ABERTO na tela de detalhe). Copiando direto do card da Home, nenhum lead está aberto, então
  // o evento nunca era salvo (Desempenho > Mensagens copiadas ficava zerado mesmo com uso real).
  // Aqui registra direto no lead do card (l.id).
  const done = () => {
    toast("Mensagem copiada");
    try{
      fetch("./api/lead-update", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ id:l.id, action:"aprendizado", evento:"mensagem_copiada", detalhes:{ de:"hero" } })
      }).catch(()=>{});
    }catch(_){}
    registrarMensagemEnviada(l.id, msg);
  };
  if(navigator.clipboard?.writeText){ navigator.clipboard.writeText(msg).then(done).catch(()=>toast("Não consegui copiar")); }
  else { toast("Não consegui copiar"); }
};

// v1095 — "Oportunidades esquecidas" REMOVIDA. Ordem do dono, repetida e sem margem: um cliente
// só pode ser ATIVO ou ARQUIVADO, e nada mais pode dar outro nome a ele. Aquela seção da tela
// inicial rotulava cliente ativo como "esquecido" — mais um nome, exatamente o que ele baniu.
// Saíram junto leadsEsquecidos(), radarRowHTML() e radarSeveridade(), que só serviam a ela.

// (v911) Raio-X da carteira removido de vez (o dono pediu): usava etapa/proposta/visita —
// dados que o app não sabe de verdade — pra montar diagnóstico. insightFocoHTML/temVisitaLead/
// leadsRaioX/abrirRaioX apagados junto.

function renderBotoesHome(){
  const foco = qs("#leadFocoArea");
  if(!foco) return;
  document.body.classList.remove("lead-foco-aberto"); // volta o "Reanalisar todos" do topo
  state.focoLeadId = null; // mostrando os botões iniciais = nenhum lead em foco
  state.grupoAtivo = null;
  state.sequencia = null; // voltar pra home encerra o modo sequência
  const saud = qs("#saudacao");
  if(saud && saud.innerHTML.trim()) saud.style.display = "";
  const grupos = state.gruposHome || { "acao-hoje": [], "pode-aguardar": [], "tratado-hoje": [] };
  const items = state.itemsAtivos || [];

  // Chip de triagem (clica → abre a lista do grupo).
  const chip = (grupo, destaque) => {
    const meta = GRUPOS_HOME[grupo];
    const n = (grupos[grupo] || []).length;
    const cor = destaque ? "var(--lime)" : "var(--soft)";
    const bg = destaque ? "rgba(255,98,88,.14)" : "rgba(255,255,255,.05)";
    return `<button type="button" onclick='abrirGrupoHome(${JSON.stringify(grupo)})' style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:${bg};border:1px solid var(--line);font-size:12px;font-weight:950;cursor:pointer;color:var(--text)">
      <span>${meta.titulo}</span>
      <b style="background:${destaque?"var(--lime)":"rgba(255,255,255,.1)"};color:${destaque?"#FFFFFF":"var(--text)"};padding:1px 9px;border-radius:999px;font-size:11px">${n}</b>
    </button>`;
  };

  // Card de lead do top 3 (motivo destacado + WhatsApp).
  const cardTop = (l) => {
    const idStr = String(l.id||"");
    const idJs = JSON.stringify(idStr);
    const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction + "d parado" : "";
    const etapa = normalizarEtapa(l.etapa);
    const motivo = motivoCurto(l);
    const tags = [];
    if(lembreteVencido(l)) tags.push(`<span style="display:inline-block;padding:1px 7px;border-radius:999px;font-size:9px;font-weight:950;color:var(--on-accent);background:var(--lime);border:1px solid var(--lime);letter-spacing:.04em">⏰ LEMBRETE DE HOJE</span>`);
    else if(ehReaquecerUrgente(l)) tags.push(`<span style="display:inline-block;padding:1px 6px;border-radius:999px;font-size:9px;font-weight:950;color:var(--timing);background:rgba(255,45,155,.12);border:1px solid var(--timing);letter-spacing:.04em;white-space:nowrap">⚠ REATIVAR</span>`);
    else if(ehEsfriando(l)) tags.push(tagEsfriandoHTML());
    if(ehPermuta(l)) tags.push(tagPermutaHTML());
    if(ehSumicoPosPreco(l)) tags.push(tagSumicoPrecoHTML());
    const waLink = linkWhatsAppDireta(l);
    return cardLeadHTML(l, { tagsHtml: tags.join(""), dias, acoesHtml: btnWhatsApp(waLink) });
  };

  // v942 — a Home mostra SEMPRE os leads do dia, um embaixo do outro (lista compacta), SEM aquele
  // card amarelo que o dono mandou tirar. Se o balde estrito de urgentes está vazio, a gente puxa
  // direto da FILA RANQUEADA completa (cpFilaFazerAgora — os elegíveis, já fora de quem foi
  // atendido hoje e de quem está na janela de espera). Nunca mais um card dizendo que "não tem
  // trabalho" com 160+ leads na carteira.
  // "Pular próximo": leads que o corretor mandou pular NESTA sessão vão pro FIM da fila (por
  // sessão; zera ao recarregar).
  let filaRanqueada = typeof cpFilaFazerAgora === 'function' ? cpFilaFazerAgora(items) : [];
  {
    const pulados = state.pulados instanceof Set ? state.pulados : null;
    if(pulados && pulados.size){
      filaRanqueada = filaRanqueada.filter(l => !pulados.has(String(l.id))).concat(filaRanqueada.filter(l => pulados.has(String(l.id))));
    }
  }
  const metaHoje = typeof cpFazerAgoraDose === 'function' ? cpFazerAgoraDose(items) : (typeof cpMetaAtendimentosDia==='function'?cpMetaAtendimentosDia():10);
  // "Atender mais um" (state.fazerAgoraExtra) puxa além da meta, sem esperar o dia seguinte.
  const extraHoje = Math.max(0, Number(state.fazerAgoraExtra||0));
  const quantosMostrar = Math.max(0, metaHoje) + extraHoje;
  const dose = filaRanqueada.slice(0, quantosMostrar);
  const urgentes = dose; // usado no botão "Pular próximo"
  const disponiveisParaPuxar = filaRanqueada.slice(dose.length);
  let top3Html;
  if(dose.length){
    // Lista compacta: um lead embaixo do outro, 1 coluna, sem quebra lateral (opção 1 + lista
    // densa que o dono escolheu). Cada linha traz a barra de status das mensagens do cliente,
    // relativa ao maior da lista (maxMsgsDose) pra as diferenças aparecerem.
    // v1017 — mesma métrica que a barra agora usa (mensagensDoClienteRecente, 90 dias), pro
    // "maior da lista" ser calculado com a MESMA régua exibida (senão a barra nunca chegaria a
    // 100%, ou o menor lead pareceria proporcionalmente maior/menor do que realmente é).
    const maxMsgsDose = dose.reduce((m,l)=>Math.max(m, (typeof mensagensDoClienteRecente==='function'?mensagensDoClienteRecente(l):0)), 1);
    top3Html = `<div class="cp-hoje-list">${dose.map(l => cpHomeLeadRow(l, maxMsgsDose)).join("")}</div>`
      + (disponiveisParaPuxar.length
          ? `<div class="cp-hoje-mais-wrap"><button type="button" class="cp-atender-mais" onclick="cpAtenderMaisUmHoje()">Atender mais um · ${disponiveisParaPuxar.length} na fila</button></div>`
          : "");
  } else if(metaHoje === 0 && filaRanqueada.length){
    // Já atendeu a dose de hoje, mas ainda tem gente elegível. Sem card grande — convite discreto.
    // v981 — mostrava sempre CP_DOSE_DIA (fixo em "10"), então quem passava da meta (atendia 11,
    // 12...) continuava vendo "você já atendeu os 10 de hoje" parado, como se tivesse travado.
    // Mostra o total real de hoje (mesma contagem do banner da Home, cpAtendidosHojeTotal).
    const atendidosHojeReal = typeof cpAtendidosHojeTotal === 'function' ? cpAtendidosHojeTotal(items) : CP_DOSE_DIA;
    top3Html = `<div class="cp-hoje-done">Você já atendeu ${atendidosHojeReal} hoje. 👏 <button type="button" class="cp-atender-mais" onclick="cpAtenderMaisUmHoje()">Atender mais um</button></div>`;
  } else {
    // Fila realmente vazia (fim de semana, ou ninguém elegível agora). Uma linha neutra, sem box.
    // v1091 — em dia sem fila esta caixa NÃO repete o aviso: a saudação, poucos centímetros acima
    // na mesma tela, já explicou. Fica em branco pra tela não ficar dizendo a mesma coisa duas vezes.
    top3Html = cpFimDeSemana() ? "" : `<div class="cp-hoje-vazio">Nenhum lead pra atender agora. Bom momento pra importar conversas novas.</div>`;
  }

  // Botão "Pular próximo" só faz sentido com 2+ na fila de urgentes (precisa ter pra onde pular).
  const btnPularHtml = urgentes.length > 1 ? `<button type="button" class="seq-link" onclick='pularProximo()'>⏭ Pular próximo</button>` : "";

  foco.innerHTML = `
    <style>
      .home-m1-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
      .home-m1-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:14px;margin-bottom:16px}
      .home-m1-bloco{background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));border:1px solid var(--line);border-radius:16px;padding:16px}
      .home-m1-label{color:var(--lime);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:11px;margin-bottom:12px}
      .home-m1-cards{display:grid;grid-template-columns:1fr;gap:10px}
      @media(min-width:760px){.home-m1-cards{grid-template-columns:repeat(2,1fr)}}
      @media(min-width:1100px){.home-m1-cards{grid-template-columns:repeat(3,1fr)}}
      .home-m1-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px 16px;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:14px;margin-top:6px}
      .home-m1-kpis .kpi{text-align:center}
      .home-m1-kpis .kpi b{display:block;font-size:20px;font-weight:950;margin-bottom:2px;color:var(--text)}
      .home-m1-kpis .kpi span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:950}
      .home-m1-desemp-titulo{color:var(--lime);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:10px;margin:16px 0 8px}
      .home-m1-semana{margin-top:10px;padding:12px 16px;background:linear-gradient(135deg,rgba(55,232,255,.04),rgba(196,92,255,.04));border:1px solid var(--line);border-radius:14px}
      .home-m1-semana-titulo{color:var(--dados);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:10px;margin-bottom:8px}
      .home-m1-semana-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .home-m1-semana-kpis .kpi{text-align:center}
      .home-m1-semana-kpis .kpi b{display:block;font-size:18px;font-weight:950;margin-bottom:2px}
      .home-m1-semana-kpis .kpi span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:950}
      @media(max-width:760px){.home-m1-grid{grid-template-columns:1fr}}
      /* v942 — lista compacta dos leads do dia (1 coluna, sem quebra lateral) */
      .cp-hoje-list{display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:2px 14px;margin-bottom:8px}
      /* Desktop: 1 linha (nome · produto · barra · dias) via grid-areas. */
      .cp-hoje-row{width:100%;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.7fr) 240px 42px;grid-template-areas:"nm pr bar dd";column-gap:12px;align-items:center;padding:11px 0;border:0;border-bottom:1px solid rgba(255,255,255,.05);background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer}
      .cp-hoje-row:last-child{border-bottom:0}
      .cp-hoje-row:hover{background:rgba(255,255,255,.03)}
      .cp-hoje-row .chr-nm{grid-area:nm;font-size:13.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cp-hoje-row .chr-pr{grid-area:pr;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cp-hoje-row .chr-bar{grid-area:bar;display:flex;align-items:center;gap:8px;justify-content:flex-end}
      /* v976 — pedido do dono: só a barra mais COMPRIDA; o número ao lado (chr-bar b) fica do
         mesmo tamanho de sempre, de propósito — ele pediu explicitamente "não é maior a fonte".
         v978 — o dono achou que a v976 (92px) ainda tinha ficado pequena ("MAIORES
         HORIZONTALMENTE") — aumentada de novo pra 180px. A coluna "pr" (produto) do grid encolheu
         (1.3fr→.7fr) na mesma versão porque o texto ficou bem mais curto (produtosLabelCurto),
         sobrando espaço pra coluna "bar" crescer bem mais (144px→240px) sem espremer nada. */
      .cp-hoje-row .chr-track{width:180px;height:7px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;flex:0 0 auto}
      .cp-hoje-row .chr-track i{display:block;height:100%;border-radius:999px}
      .cp-hoje-row .chr-bar b{font-size:11px;font-weight:900;min-width:20px;text-align:right}
      .cp-hoje-row .chr-dd{grid-area:dd;font-size:11px;color:var(--muted);text-align:right;white-space:nowrap}
      /* v945 introduziu uma 2ª linha (data-exp) pro motivo do ranking, reformatada em v972/v974 —
         v975 tirou o motivo da Home de vez (pedido do dono: já existe dentro do lead, repetir
         aqui só poluía). Linha voltou a ser sempre de 1 linha só; sem essas regras. */
      .cp-hoje-mais-wrap{text-align:center;margin:2px 0 6px}
      .cp-atender-mais{border:1px solid rgba(255,98,88,.4);background:rgba(255,98,88,.07);color:var(--accent);border-radius:999px;padding:9px 16px;font-size:12px;font-weight:900;cursor:pointer}
      .cp-atender-mais:hover{background:rgba(255,98,88,.13)}
      .cp-hoje-done{padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.02);color:var(--soft);font-size:13px;font-weight:700;text-align:center;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}
      .cp-hoje-vazio{padding:18px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);font-size:13px;text-align:center;margin-bottom:8px}
      /* Mobile: 2 linhas — nome + dias em cima (nome ocupa a largura toda), barra + produto embaixo. */
      @media(max-width:560px){
        .cp-hoje-row{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"nm dd" "bar pr";column-gap:10px;row-gap:5px;padding:12px 0}
        .cp-hoje-row .chr-nm{font-size:14.5px}
        /* v1021 — print do dono: no celular, o número da barra ("29", "232"...) aparecia por
           cima do texto do produto ("Ren29aissance"). Causa: chr-track tinha largura FIXA
           (190px) e nunca encolhia (flex:0 0 auto) — nessa linha, a coluna "bar" divide espaço
           com "pr" (produto), e quando o produto era mais longo, sobrava menos que 190px pra
           barra, que vazava por cima do texto ao lado em vez de encolher. Agora a barra tem
           max-width:100% (nunca passa do espaço da própria coluna) e o track encolhe (flex) até
           um mínimo de 30px, sempre deixando o produto legível do lado. */
        .cp-hoje-row .chr-bar{justify-self:start;gap:9px;max-width:100%;min-width:0}
        .cp-hoje-row .chr-track{width:auto;flex:1 1 40px;min-width:30px}
        .cp-hoje-row .chr-pr{justify-self:end;text-align:right;max-width:42vw}
        .cp-hoje-row .chr-dd{align-self:center}
      }
    </style>
    <div class="home-saud">
      <div class="home-saud-sub"><span class="home-saud-titulo"></span><div class="home-saud-acoes">${btnPularHtml}</div></div>
    </div>
    ${barraBuscaLeadHTML("home")}
    <div class="home-m1-list">${top3Html}</div>
  `;
  qsa(".pickZipShortcut").forEach(b => {
    if(!b.dataset.bound){ b.dataset.bound = "1"; b.addEventListener("click", () => show("zip")); }
  });
}

// "Pular próximo": tira o lead EM FOCO da vez de agora (vai pro FIM da fila de urgentes) e joga o
// próximo pro card "Prioridade agora". NÃO remove das prioridades — só adia ele nesta sessão.
function pularProximo(){
  // v1084 — o botão era desenhado a partir da fila do "Fazer agora" (cpFilaFazerAgora), mas
  // pulava o primeiro de OUTRA lista: o grupo "acao-hoje", que é montado por cp786Categoria e
  // tem membros e ordem diferentes. Na prática, ou a tela era redesenhada idêntica (o lead
  // "pulado" nem estava à vista), ou rebaixava um cliente que o corretor não escolheu. Pior:
  // quando "acao-hoje" tinha menos de 2 itens a função saía calada, e o botão virava um botão
  // morto. Agora ele opera exatamente sobre a fila de onde nasceu.
  const items = Array.isArray(state.itemsAtivos) ? state.itemsAtivos : [];
  let fila = (typeof cpFilaFazerAgora === 'function') ? cpFilaFazerAgora(items) : [];
  const pulados = state.pulados instanceof Set ? state.pulados : (state.pulados = new Set());
  if(pulados.size){
    fila = fila.filter(l => !pulados.has(String(l.id))).concat(fila.filter(l => pulados.has(String(l.id))));
  }
  if(fila.length < 2){ toast("Não há outro lead na fila pra trocar."); return; }
  pulados.add(String(fila[0].id));
  renderBotoesHome();
}
window.pularProximo = pularProximo;

// v925 — "Vamos atender mais um?": puxa mais um lead da fila além da meta batida de hoje (mesma
// variável de sessão do botão "Atender +1" de abrirFazerAgora — clicar em qualquer um dos dois
// lugares soma no mesmo contador, então ficam sempre em sincronia).
function cpAtenderMaisUmHoje(){
  state.fazerAgoraExtra = Math.max(0, Number(state.fazerAgoraExtra||0)) + 1;
  renderBotoesHome();
}
window.cpAtenderMaisUmHoje = cpAtenderMaisUmHoje;

// Mostra QUEM entrou como "tratado hoje", com a HORA (Brasília) e o que marcou
// (copiou a mensagem / registrou atendimento). Serve pra conferir de onde vem o
// número da saudação e da meta — abre clicando no KPI "contatos hoje".
function mostrarTratadosHoje(){
  const items = state.itemsAtivos || [];
  const fmtHora = (iso) => {
    try{ return new Intl.DateTimeFormat("pt-BR", { timeZone:"America/Sao_Paulo", day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false }).format(new Date(iso)); }
    catch(_){ return "—"; }
  };
  const origem = (de) => ({
    copiar_msg: "copiou a mensagem",
    novoAtendimento: "registrou atendimento",
    listaPrioridade: "marcou na lista",
    leadFoco: "no lead"
  })[de] || (de || "contato");
  const linhas = [];
  for(const l of items){
    const e = ehContatadoHoje(l);
    if(!e) continue;
    linhas.push({ nome: l.name || "Cliente sem nome", hora: e.quando ? fmtHora(e.quando) : "—", de: origem(e.detalhes?.de) });
  }
  linhas.sort((a, b) => (a.hora < b.hora ? -1 : 1));
  qs("#tratadosHojeModal")?.remove();
  const ov = document.createElement("div");
  ov.id = "tratadosHojeModal";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  const corpo = linhas.length
    ? linhas.map(x => `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)">
        <div style="min-width:0"><div style="font-weight:950;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(x.nome)}</div><div class="small" style="color:var(--muted);font-size:11px">${escapeHtml(x.de)}</div></div>
        <div style="font-weight:950;color:var(--dados);font-size:13px;white-space:nowrap">${escapeHtml(x.hora)}</div>
      </div>`).join("")
    : `<div class="small" style="color:var(--muted);padding:14px 0">Ninguém marcado como tratado hoje.</div>`;
  ov.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;max-width:460px;width:100%;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:16px;font-weight:950">Tratados hoje (${linhas.length})</div>
        <button type="button" id="tratadosHojeFechar" style="border:0;background:transparent;color:var(--muted);font-size:22px;font-weight:950;cursor:pointer;line-height:1">×</button>
      </div>
      <div class="small" style="color:var(--soft);margin-bottom:10px">Hora de Brasília. É isso que entra no número da saudação e da meta.</div>
      ${corpo}
    </div>`;
  document.body.appendChild(ov);
  qs("#tratadosHojeFechar").addEventListener("click", () => ov.remove(), { once:true });
  ov.addEventListener("click", (ev) => { if(ev.target === ov) ov.remove(); });
}
window.mostrarTratadosHoje = mostrarTratadosHoje;

// ===== Coluna direita da Resumo: "Seu desempenho" + "Insights" (layout-alvo) =====
// No celular some da tela e abre pelo menu/Insights (cascata). Números REAIS — sem inventar.
function _clienteFalouPorUltimo(l){
  const msgs = Array.isArray(l.recentMessages) ? l.recentMessages : [];
  const pn = String(l.name||"").toLowerCase().trim().split(/\s+/)[0] || "";
  for(let i=msgs.length-1;i>=0;i--){ const m=msgs[i]; if(!m||!String(m.text||"").trim()) continue; return ehMsgDoCliente(m, pn); }
  return false;
}
function buildDesempenhoInsightsHTML(items){
  items=items||state.itemsAtivos||[];
  const ativos=items.filter(leadEhAtivo);
  const categorias=new Map(ativos.map(l=>[l,cp786Categoria(l)]));
  const categoriaDe=l=>categorias.get(l)||cp786Categoria(l);
  const agora=ativos.filter(l=>categoriaDe(l)==='agora').length;
  const programados=ativos.filter(l=>categoriaDe(l)==='programados').length;
  const aguardando=ativos.filter(l=>categoriaDe(l)==='aguardando').length;
  const atendidosHoje=ativos.filter(ehAtendidoHoje).length;
  const atendidosSemana=ativos.filter(ehAtendidoNaSemana).length;
  const pedemAcao=agora;
  const ringPct=ativos.length?Math.max(6,Math.min(100,Math.round((pedemAcao/ativos.length)*100))):0;
  return `
    <div class="dash-card">
      <div class="dh"><h4>📊 Seu ritmo de atendimento</h4><span class="dash-sub">Esta semana ▾</span></div>
      <div class="dash-desemp">
        <div class="gauge" style="--p:${ringPct}"><div class="gv"><b>${ativos.length}</b><span>clientes ativos</span></div></div>
        <div class="dash-stats">
          <div class="st" style="cursor:pointer" onclick="show('home')"><b>${atendidosHoje}</b><span>Atendidos hoje</span></div>
          <div class="st"><b>${atendidosSemana}</b><span>Atendidos na semana</span></div>
        </div>
      </div>
      <button type="button" class="dash-btn" onclick="show('relatorio')">Ver desempenho completo</button>
    </div>
    <div class="dash-card">
      <div class="dh"><h4>✨ Leitura do Corretor Pro</h4></div>
      <div class="ins-item"><div class="ins-ic">↗</div><div style="min-width:0"><div class="it"><b style="color:var(--lime)">${pedemAcao}</b> atendimento${pedemAcao===1?' pede':'s pedem'} sua ação agora; <b>${programados}</b> programado${programados===1?'':'s'}; <b>${aguardando}</b> aguardando cliente.</div>${pedemAcao?`<a onclick="abrirFazerAgora()">Abrir prioridades →</a>`:''}</div></div>
    </div>`;
}
function renderHomeRight(items){
  // Atualização #810: a coluna lateral repetia indicadores já exibidos nos cards
  // principais e podia ficar presa no skeleton quando o dashboard caía no fallback.
  // Ela permanece desativada e nunca deve bloquear o carregamento da Home.
  const el = qs("#homeRight");
  if(!el) return;
  el.innerHTML = "";
  el.hidden = true;
  el.style.setProperty("display", "none", "important");
}
window.renderHomeRight = renderHomeRight;
// Mobile: abre desempenho + insights num modal (pelo menu / item Insights da lateral).
function abrirDesempenhoInsights(){
  const items = state.itemsAtivos || [];
  qs("#desempInsModal")?.remove();
  const ov = document.createElement("div");
  ov.id = "desempInsModal";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto";
  ov.innerHTML = `<div style="max-width:460px;width:100%;margin:auto 0">
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button type="button" id="desempInsFechar" style="border:0;background:transparent;color:#fff;font-size:24px;font-weight:950;cursor:pointer;line-height:1">×</button></div>
    <div style="display:flex;flex-direction:column;gap:14px">${buildDesempenhoInsightsHTML(items)}</div>
  </div>`;
  document.body.appendChild(ov);
  qs("#desempInsFechar").addEventListener("click", () => ov.remove(), { once:true });
  ov.addEventListener("click", (e) => { if(e.target === ov) ov.remove(); });
}
window.abrirDesempenhoInsights = abrirDesempenhoInsights;
// ➕ central da barra de baixo (mobile): Importar / Lead manual / Reanalisar todos.
function abrirMaisAcoes(){
  qs("#maisAcoesSheet")?.remove();
  const ov = document.createElement("div");
  ov.id = "maisAcoesSheet";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:flex-end;justify-content:center";
  ov.innerHTML = `<div style="background:var(--panel);border:1px solid var(--line);border-top-left-radius:20px;border-top-right-radius:20px;padding:16px 16px calc(20px + env(safe-area-inset-bottom));width:100%;max-width:520px">
    <div style="width:40px;height:4px;border-radius:999px;background:rgba(255,255,255,.2);margin:0 auto 14px"></div>
    <button type="button" id="maAcImportar" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,98,88,.06);color:var(--text);font-weight:900;font-size:14px;cursor:pointer;margin-bottom:10px">⇪ Importar conversa</button>
    <button type="button" id="maAcLead" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.03);color:var(--text);font-weight:900;font-size:14px;cursor:pointer;margin-bottom:10px">＋ Lead manual</button>
    <button type="button" id="maAcReanalisar" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.03);color:var(--text);font-weight:900;font-size:14px;cursor:pointer;margin-bottom:10px">↻ Reanalisar todos</button>
    <button type="button" id="maAcAprender" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.03);color:var(--text);font-weight:900;font-size:14px;cursor:pointer;margin-bottom:10px">🧠 Aprender da carteira <span style="font-weight:600;color:var(--muted);font-size:11px">(sem custo de análise)</span></button>
    <button type="button" id="maAcTelefones" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.03);color:var(--text);font-weight:900;font-size:14px;cursor:pointer">📞 Importar telefones (CSV) <span style="font-weight:600;color:var(--muted);font-size:11px">preenche quem está sem número</span></button>
  </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if(e.target === ov) close(); });
  qs("#maAcImportar").onclick = () => { close(); show("zip"); };
  qs("#maAcLead").onclick = () => { close(); if(window.abrirNovoLead) abrirNovoLead(); };
  qs("#maAcReanalisar").onclick = () => { close(); if(window.reanalisarTudo) reanalisarTudo(); };
  qs("#maAcAprender").onclick = () => { close(); if(window.aprenderDaCarteira) aprenderDaCarteira(); };
  qs("#maAcTelefones").onclick = () => { close(); if(window.importarTelefonesCSV) importarTelefonesCSV(); };
}

// Reprocessa a carteira pelo mesmo motor automático v808. O aprendizado normal
// já acontece sozinho; este atalho serve apenas para uma nova varredura intencional.
async function aprenderDaCarteira(){
  toast("Reprocessando suas conversas reais em segundo plano…");
  const iniciou = await iniciarAprendizadoContinuoAutomatico({ forcar:true, mostrarToast:true });
  if(!iniciou) toast("O aprendizado já está rodando em outra aba ou dispositivo.");
}
window.aprenderDaCarteira = aprenderDaCarteira;

// Importa telefones de um CSV (colunas NOME + TELEFONE) e preenche os leads que estão SEM número,
// casando pelo nome exato. NÃO mexe em quem já tem telefone, e só preenche quando há UM único lead
// com aquele nome (evita atribuir número errado a homônimo). Mostra quantos vai preencher antes.
async function importarTelefonesCSV(){
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".csv,text/csv,text/plain"; inp.style.display = "none";
  document.body.appendChild(inp);
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    inp.remove();
    if(!file) return;
    try{
      toast("Lendo arquivo…");
      let texto = await file.text();
      if(texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
      const rows = parseCsvDireciona(texto);
      if(rows.length < 2){ toast("Arquivo vazio ou sem dados."); return; }
      const head = rows[0].map(h => semAcento(h));
      const iNome = head.findIndex(h => h.includes("nome"));
      const iTel = head.findIndex(h => h.includes("telefone") || h === "tel" || h.startsWith("tel"));
      if(iNome < 0 || iTel < 0){ toast("O arquivo precisa ter colunas NOME e TELEFONE."); return; }
      const mapa = new Map(); // nomeNorm -> telefone
      for(const r of rows.slice(1)){
        const nome = (r[iNome]||"").trim(), tel = (r[iTel]||"").trim();
        if(nome && tel) mapa.set(semAcento(nome), tel);
      }
      if(!mapa.size){ toast("Nenhum nome+telefone no arquivo."); return; }
      toast("Carregando seus leads…");
      const data = await getLeadsData(true);
      const leads = (data?.items||[]).map(limparLead);
      const porNome = new Map();
      for(const ld of leads){ const k = semAcento(ld.name||""); if(!k) continue; if(!porNome.has(k)) porNome.set(k, []); porNome.get(k).push(ld); }
      const aplicar = [];
      for(const [nomeNorm, tel] of mapa){
        const cand = porNome.get(nomeNorm);
        if(!cand || cand.length !== 1) continue;            // exige 1 lead único com esse nome
        const ld = cand[0];
        if(String(ld.phone||"").replace(/\D/g,"").length >= 8) continue; // já tem número — não mexe
        aplicar.push({ id: ld.id, telefone: tel });
      }
      if(!aplicar.length){ toast("Nada pra preencher — esses leads já têm número ou não bateram pelo nome."); return; }
      const msgTel = `Vou preencher o telefone de ${aplicar.length} lead(s) que estavam sem número. Confirmar?`;
      const okTel = (typeof cp903Confirm === "function")
        ? await cp903Confirm({ titulo: "Preencher telefones", mensagem: msgTel, ok: "Preencher" })
        : confirm(msgTel);
      if(!okTel) return;
      let ok = 0, erro = 0;
      for(let i=0;i<aplicar.length;i++){
        const a = aplicar[i];
        toast(`Preenchendo ${i+1}/${aplicar.length}…`);
        try{
          const r = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: a.id, action:"editar-dados", telefone: a.telefone }) });
          const d = await r.json().catch(()=>({ok:false}));
          if(r.ok && d?.ok) ok++; else erro++;
        }catch(_){ erro++; }
      }
      if(typeof invalidarLeadsCache === "function") invalidarLeadsCache();
      toast(`✓ ${ok} telefone(s) preenchido(s)${erro?` · ${erro} falharam`:""}.`);
      if(typeof loadRecentLeads === "function") loadRecentLeads();
    }catch(err){ toast("Erro ao importar: " + (err?.message||err)); }
  };
  inp.click();
}
window.importarTelefonesCSV = importarTelefonesCSV;
window.abrirMaisAcoes = abrirMaisAcoes;

// Avatar com a(s) inicial(is) do lead.
function avatarInicial(name, pctClass){
  const n = String(name||"Cliente").trim();
  const ini = (n.split(/\s+/).map(w=>w[0]).filter(Boolean).slice(0,2).join("") || "C").toUpperCase();
  return `<div class="lead-avatar ${pctClass||""}">${escapeHtml(ini)}</div>`;
}
// Atalho: avatar a partir do objeto lead — só as iniciais (v1074: o suporte a foto salva saiu do app).
function avatarLead(l, pctClass){ return avatarInicial(l?.name, pctClass); }
// Botão WhatsApp padrão (mesmo em todas as telas).
function btnWhatsApp(waLink){
  // Bolinha verde só com o ícone (logo do WhatsApp) — não espreme o nome do cliente, que é o principal.
  return waLink ? `<a href="${escapeHtml(waLink)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Abrir WhatsApp" aria-label="Abrir WhatsApp" style="flex:none;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#25D366;color:#06210f;text-decoration:none">${WA_SVG}</a>` : "";
}
// CARD DE LEAD ÚNICO — usado em Hoje, Todos e Pipeline pra manter o MESMO padrão.
// opts: { tagsHtml, dias, acoesHtml }
function cardLeadHTML(l, opts){
  opts = opts || {};
  const idStr = String(l.id||"");
  const idJs = JSON.stringify(idStr);
  const pctClass = "";
  const etapa = normalizarEtapa(l.etapa);
  const proxima = motivoCurto(l);
  const prioridade = prioridadeAtendimento(l) || {};
  const tagsHtml = opts.tagsHtml || "";
  const acoesHtml = opts.acoesHtml || "";
  // Duas medidas coloridas (igual ao card de prioridade): verde = último contato, vermelho = sem resposta.
  const interDias = l.daysSinceLastInteraction;
  let toque = l.daysSinceLastTouch; if(toque==null) toque = interDias;
  let resposta = l.daysSinceClientReply; if(resposta==null) resposta = interDias;
  const fmtDia = (n) => n==null ? "—" : n===0 ? "hoje" : n===1 ? "1 dia" : n+" dias";
  // Uma linha: vermelho "sem resposta" (esquerda) + verde "de contato" (direita).
  const diasHtml = (toque==null && resposta==null) ? "" :
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px;font-weight:800;line-height:1;flex-wrap:wrap">
       <span style="white-space:nowrap"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ef4444;margin-right:6px;vertical-align:middle"></span><span style="color:#ef4444">${fmtDia(resposta)}</span> <span style="color:var(--muted);font-weight:600">sem resposta</span></span>
       <span style="white-space:nowrap"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;margin-right:6px;vertical-align:middle"></span><span style="color:var(--lime)">${fmtDia(toque)}</span> <span style="color:var(--muted);font-weight:600">de contato</span></span>
     </div>`;
  return `<div data-card-id="${escapeHtml(idStr)}" onclick='abrirLead(${idJs})' style="cursor:pointer;display:flex;flex-direction:column;gap:9px;padding:13px 15px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.03)">
    <div style="display:flex;align-items:flex-start;gap:11px">
      ${avatarLead(l, pctClass)}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;min-width:0"><span style="font-weight:950;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">${escapeHtml(l.name||"Cliente")}</span>${tagsHtml}</div>
        <div class="small" style="color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(produtosLabel(l))}${opts.msgCount != null ? ` · <span style="color:var(--soft);font-weight:800">💬 ${opts.msgCount} ${opts.msgCount===1?"mensagem":"mensagens"}</span>` : ""}</div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;gap:8px">
        ${acoesHtml}
        <span style="font-size:12px;font-weight:900;color:var(--lime);white-space:nowrap" title="Prioridade de atendimento">${escapeHtml(prioridade.titulo || "Prioridade")}</span>
      </div>
    </div>
    ${diasHtml}
  </div>`;
}

// Abre a lista de um grupo (clicou num dos botões).
// Cards mostram: nome, etapa/produto/dias, tags (ESFRIANDO/PERMUTA), motivo curto e
// ações rápidas (WhatsApp). Pro grupo com mais de 10 leads, divide em
// "ataca agora — top 10" e o restante colapsado.
function abrirGrupoHome(grupo, options={}){
  // Lista "avulsa": um conjunto de leads passado direto (ex.: as linhas do Raio-X), sem
  // depender de uma chave fixa em GRUPOS_HOME nem virar rota de histórico (o "‹ Voltar"
  // volta pra home montada por renderBotoesHome).
  const avulsa = Array.isArray(options.leads);
  if(!avulsa && !options.fromHistory && !cpApplyingHistory){
    cpPushRoute({...cpRouteForScreen("home"),screen:"home",grupoAtivo:grupo});
  }
  const foco = qs("#leadFocoArea");
  if(!foco) return;
  document.body.classList.remove("lead-foco-aberto");
  state.grupoAtivo = grupo;
  const saud = qs("#saudacao");
  if(saud) saud.style.display = "none";
  const meta = options.meta || GRUPOS_HOME[grupo] || { titulo: String(grupo||"Leads").replace(/^__+/, ""), sub: "" };
  const arr = avulsa ? options.leads : ((state.gruposHome && state.gruposHome[grupo]) || []);

  // v1076 — modelo escolhido pelo dono (print aprovado): TABELA "com próximo passo"
  // (nº · cliente com interesse embaixo · próximo passo recomendado · dias parado), igual em
  // TODAS as listas abertas pelos cards da Home. Sem botão de WhatsApp na linha (o WhatsApp
  // vive dentro do atendimento) e sem etiquetas coloridas.
  const linhaGrupo = (l, pos) => {
    const idJs = JSON.stringify(String(l.id||""));
    const interesse = produtosLabel(l) || "Não identificado";
    let passo = "";
    try{ passo = cp786ResumoAcao(l) || ""; }catch(_){ passo = ""; }
    const d = l.daysSinceLastInteraction;
    const dias = ehContatadoHoje(l)
      ? '<i>atendido hoje</i>'
      : (d != null ? `<b>${d}</b> ${d === 1 ? "dia" : "dias"}` : "—");
    return `<button type="button" class="lgt-row" onclick='abrirLead(${idJs})'>
      <span class="lgt-pos">${pos}</span>
      <span class="lgt-cli"><span class="lgt-nm">${escapeHtml(l.name||"Cliente")}</span><small>${escapeHtml(interesse)}</small></span>
      <span class="lgt-passo">${escapeHtml(passo)}</span>
      <span class="lgt-dias">${dias}</span>
      <span class="lgt-chev">›</span>
    </button>`;
  };
  const tabelaGrupo = (leads, posInicial) => `<div class="lgt">
    <div class="lgt-th"><span>#</span><span>Cliente</span><span class="lgt-passo">Próximo passo</span><span class="lgt-dias">Parado há</span><span></span></div>
    ${leads.map((l, i) => linhaGrupo(l, posInicial + i)).join("")}
  </div>`;

  const vazio = `<div class="small" style="color:var(--muted);opacity:.7;padding:14px;border:1px dashed var(--line);border-radius:10px;text-align:center">Nenhum lead aqui no momento.</div>`;
  let listaHtml;
  // Listas longas ficam num expansor pra não poluir a visão principal — a numeração continua.
  if(grupo === "acao-hoje" && arr.length > 12){
    const topo = arr.slice(0, 12);
    const resto = arr.slice(12);
    listaHtml =
      tabelaGrupo(topo, 1) +
      `<details style="margin-top:12px">
         <summary style="cursor:pointer;padding:10px 12px;border:1px dashed var(--line);border-radius:10px;color:var(--soft);font-size:12px;font-weight:950;letter-spacing:.04em;text-transform:uppercase;list-style:none">Ver mais ${resto.length}</summary>
         <div style="margin-top:10px">${tabelaGrupo(resto, 13)}</div>
       </details>`;
  } else {
    // options.resto = backlog (ex.: a fila de retomada além da dose de 10 do "Fazer agora").
    const restoArr = Array.isArray(options.resto) ? options.resto : [];
    const principal = arr.length ? tabelaGrupo(arr, 1) : vazio;
    const backlog = restoArr.length
      ? `<details style="margin-top:14px">
           <summary style="cursor:pointer;padding:10px 12px;border:1px dashed var(--line);border-radius:10px;color:var(--soft);font-size:12px;font-weight:950;letter-spacing:.04em;text-transform:uppercase;list-style:none">Fila de retomada — ver mais ${restoArr.length}</summary>
           <div style="margin-top:10px">${tabelaGrupo(restoArr, arr.length + 1)}</div>
         </details>`
      : "";
    listaHtml = principal + backlog;
  }

  foco.innerHTML =
    `<div style="display:flex;align-items:center;gap:12px;margin:0 0 4px;flex-wrap:wrap">
       <button type="button" onclick="voltarDaListaHome()" style="background:transparent;border:1px solid var(--line);border-radius:999px;padding:5px 12px;color:var(--soft);font-size:12px;font-weight:950;cursor:pointer">‹ Voltar</button>
       <b style="color:var(--lime);text-transform:uppercase;letter-spacing:.12em;font-weight:950;font-size:13px">${meta.titulo}</b>
       <span style="background:var(--lime);color:var(--on-accent);border-radius:999px;padding:0 9px;font-size:12px;font-weight:950">${arr.length}</span>
       ${options.acoesHtml ? `<span style="display:inline-flex;gap:8px;margin-left:auto">${options.acoesHtml}</span>` : ""}
     </div>
     <div class="small" style="color:var(--muted);margin-bottom:12px;font-size:12px">${meta.sub}</div>
     ${barraBuscaLeadHTML("todos")}
     ${listaHtml}`;
  foco.scrollIntoView({ behavior:"smooth", block:"start" });
}
function voltarDaListaHome(){
  if(history.state?.cpApp && history.state?.screen === "home" && history.state?.grupoAtivo){ history.back(); return; }
  renderBotoesHome();
}
window.voltarDaListaHome=voltarDaListaHome;
window.abrirGrupoHome = abrirGrupoHome;
window.renderBotoesHome = renderBotoesHome;

// (v911) "Últimos atendimentos" removido da home (redundante com "Atendimentos" na barra de baixo).
// (v931) botão duplicado removido da Home: era o mesmo destino do Menu →
// "Condução do atendimento" — porta redundante pro mesmo lugar.

// "Ver lista de hoje" (insight) abre EXATAMENTE a mesma fila priorizada da tela inicial
// (grupo "ação hoje", mesma ordem) — não a lista por %. Assim não há dois rankings de "hoje".
function verListaHoje(){
  document.querySelector("#desempInsModal")?.remove(); // fecha o modal de insights no mobile
  const temUrg = (state.gruposHome && state.gruposHome["acao-hoje"] && state.gruposHome["acao-hoje"].length) > 0;
  if(temUrg) abrirGrupoHome("acao-hoje"); else renderBotoesHome();
}
window.verListaHoje = verListaHoje;

// Reanalisa TODOS os leads ativos em sequência. Mostra progresso ao vivo,
// permite cancelar. Pesado em tempo e custo OpenAI — sempre pede confirmação.
async function reanalisarTudo(){
  const items = state.itemsAtivos || [];
  if(!items.length){ toast("Nenhum lead ativo pra reanalisar."); return; }
  const total = items.length;
  // Roda 5 em paralelo, então o tempo estimado é ~1/5 do sequencial.
  const tempoEst = Math.max(1, Math.ceil((total * 10) / 60 / 5));
  const custoMin = (total * 0.01).toFixed(2).replace(".", ",");
  const custoMax = (total * 0.03).toFixed(2).replace(".", ",");
  // Aviso visual claro de tempo e custo ANTES de rodar (em vez do popup do navegador).
  qs("#reanalConfirmModal")?.remove();
  const cm = document.createElement("div");
  cm.id = "reanalConfirmModal";
  cm.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  cm.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:24px;max-width:430px;width:100%">
      <div style="font-size:17px;font-weight:950;margin-bottom:4px">Reanalisar todos os leads?</div>
      <div class="small" style="color:var(--muted);margin-bottom:16px">Roda a análise de novo em todos os leads ativos, com o cérebro atualizado.</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
        <div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:10px"><b style="display:block;font-size:18px">${total}</b><span class="small" style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em">leads</span></div>
        <div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:10px"><b style="display:block;font-size:18px">~${tempoEst}min</b><span class="small" style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em">tempo</span></div>
        <div style="text-align:center;padding:10px 6px;background:rgba(184,194,201,.06);border:1px solid var(--morno);border-radius:10px"><b style="display:block;font-size:15px;color:var(--morno)">~R$${custoMin}–${custoMax}</b><span class="small" style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em">custo análise</span></div>
      </div>
      <div class="small" style="color:var(--soft);font-size:11px;margin-bottom:16px;line-height:1.5">💡 Só precisa fazer isso quando muda algo grande. No dia a dia, cada lead já reanalisa sozinho quando você importa a conversa. Dá pra cancelar no meio.</div>
      <div style="display:flex;gap:10px">
        <button type="button" id="reanalNao" style="flex:1;padding:11px;background:transparent;border:1px solid var(--line);border-radius:10px;color:var(--soft);font-weight:950;cursor:pointer">Cancelar</button>
        <button type="button" id="reanalSim" style="flex:1;padding:11px;background:var(--accent);border:0;border-radius:10px;color:var(--on-accent);font-weight:950;cursor:pointer">Reanalisar agora</button>
      </div>
    </div>`;
  document.body.appendChild(cm);
  qs("#reanalNao").addEventListener("click", () => cm.remove(), { once: true });
  qs("#reanalSim").addEventListener("click", () => { cm.remove(); executarReanaliseTudo(items); }, { once: true });
}
window.reanalisarTudo = reanalisarTudo;

async function executarReanaliseTudo(items){
  const total = items.length;
  // Modal de progresso
  qs("#reanalisarTudoModal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "reanalisarTudoModal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  overlay.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:24px;max-width:440px;width:100%">
      <div style="font-size:16px;font-weight:950;margin-bottom:6px">Reanalisando todos os leads…</div>
      <div id="reanalProgresso" class="small" style="color:var(--muted);margin-bottom:14px">0 de ${total}</div>
      <div style="height:8px;background:rgba(255,255,255,.05);border-radius:999px;overflow:hidden;margin-bottom:14px">
        <div id="reanalBarra" style="width:0%;height:100%;background:var(--accent);transition:width .3s"></div>
      </div>
      <div id="reanalAtual" class="small" style="color:var(--soft);font-size:11px;margin-bottom:12px;min-height:14px"></div>
      <div id="reanalErros" class="small" style="color:var(--risco);font-size:11px;margin-bottom:14px;display:none"></div>
      <button type="button" id="reanalCancelar" style="width:100%;padding:10px;background:transparent;color:var(--risco);border:1px solid var(--risco);border-radius:10px;font-size:12px;font-weight:950;cursor:pointer">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
  let cancelado = false;
  qs("#reanalCancelar").addEventListener("click", () => { cancelado = true; });
  let erros = 0;
  const erroNomes = [];
  const semConversa = []; // leads que não têm conversa pra analisar (não é erro de verdade)
  const falhas = [];      // {id, nome, motivo} — falhas reais, pra redo individual

  // Roda em paralelo (vários leads ao mesmo tempo) pra não levar ~22min.
  // Pool de CONCORRENCIA requisições simultâneas — corta o tempo em ~5x.
  const CONCORRENCIA = 5;
  const fila = items.filter(l => l && l.id);
  let proximo = 0;
  let feitos = 0;
  const totalReal = fila.length;
  const ativos = new Set(); // nomes sendo analisados AGORA (mostra o paralelismo)

  function atualizaUI(){
    qs("#reanalProgresso").textContent = `${feitos} de ${totalReal}`;
    const lista = [...ativos];
    qs("#reanalAtual").textContent = lista.length
      ? `Analisando ${lista.length} ao mesmo tempo: ${lista.join(", ")}`
      : "";
    qs("#reanalBarra").style.width = ((feitos / totalReal) * 100) + "%";
    if(erros > 0){
      const box = qs("#reanalErros");
      box.style.display = "block";
      box.textContent = `${erros} erro(s) até agora.`;
    }
  }

  // Uma tentativa de reanálise. Devolve {ok, motivo, semConversa}.
  async function tentar(l){
    try{
      const res = await fetch("./api/reanalisar-lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadComCerebro({ id: l.id }))
      });
      const data = await res.json().catch(() => ({ ok: false, error: "Resposta inválida do servidor" }));
      if(data?.ok){
        // v971 — "Reanalisar todos" nunca contava pra "Análises feitas" do Desempenho (só o
        // botão de reanalisar 1 lead por vez contava, linha ~10570) — cada lead reanalisado com
        // sucesso aqui é uma análise de verdade, igual à individual.
        try{ cpRegistrarAtividade("analise"); }catch(_){}
        return { ok: true };
      }
      const motivo = String(data?.error || `Erro ${res.status}`);
      if(/sem timeline|sem conteúdo|sem conversa/i.test(motivo)) return { ok: false, semConversa: true, motivo };
      return { ok: false, motivo };
    }catch(_){ return { ok: false, motivo: "Falha de conexão" }; }
  }

  async function worker(){
    while(!cancelado){
      const i = proximo++;
      if(i >= totalReal) break;
      const l = fila[i];
      const nome = l.name || "Cliente sem nome";
      ativos.add(nome);
      atualizaUI();
      // Até 3 tentativas: a maioria dos erros é temporário (limite/timeout da OpenAI).
      let r = await tentar(l);
      for(let t = 0; t < 2 && !r.ok && !r.semConversa && !cancelado; t++){
        await new Promise(res => setTimeout(res, 1500 * (t + 1)));
        r = await tentar(l);
      }
      if(!r.ok){
        if(r.semConversa){ semConversa.push(nome); }
        else { erros++; erroNomes.push(nome); falhas.push({ id: l.id, nome, motivo: r.motivo || "Erro desconhecido" }); }
      }
      ativos.delete(nome);
      feitos++;
      atualizaUI();
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, totalReal) }, () => worker()));
  qs("#reanalBarra").style.width = "100%";
  if(cancelado){
    qs("#reanalProgresso").innerHTML = `<b style="color:var(--timing)">Cancelado.</b>`;
  } else {
    qs("#reanalProgresso").innerHTML = `<b style="color:var(--acao)">✓ Reanálise concluída.</b>`;
    const box = qs("#reanalErros");
    let html = "";
    if(semConversa.length){
      html += `<div style="color:var(--muted);margin-bottom:8px">${semConversa.length} lead(s) sem conversa importada (nada pra analisar) — normal.</div>`;
    }
    if(falhas.length){
      window._reanalFalhas = falhas; // guarda pra redo
      html += `<div style="color:var(--risco);font-weight:800;margin-bottom:4px">${falhas.length} lead(s) falharam de verdade:</div>`;
      html += `<div style="max-height:140px;overflow:auto;color:var(--soft);font-size:11px;line-height:1.6;margin-bottom:8px">${falhas.map(f=>`• ${escapeHtml(f.nome)} <span style="color:var(--muted)">— ${escapeHtml(f.motivo||"erro")}</span>`).join("<br>")}</div>`;
      html += `<button type="button" onclick="reanalisarFalhas()" style="width:100%;padding:9px;background:var(--lime);color:var(--on-accent);border:0;border-radius:9px;font-weight:900;font-size:12px;cursor:pointer">↻ Tentar de novo só os que falharam</button>`;
    }
    if(html){ box.style.display = "block"; box.innerHTML = html; }
  }
  qs("#reanalCancelar").textContent = "Fechar";
  qs("#reanalCancelar").style.color = "var(--text)";
  qs("#reanalCancelar").style.borderColor = "var(--line)";
  qs("#reanalCancelar").addEventListener("click", async () => {
    overlay.remove();
    // Recarrega dados
    await loadRecentLeads();
    await carregarDashboard();
    toast("Lista atualizada com a reanálise.");
  }, { once: true });
}
// Reroda APENAS os leads que falharam na última reanálise (botão no resumo final).
function reanalisarFalhas(){
  const lista = (window._reanalFalhas || []).map(f => ({ id: f.id, name: f.nome }));
  if(!lista.length){ toast("Nenhuma falha pra repetir."); return; }
  qs("#reanalisarTudoModal")?.remove();
  executarReanaliseTudo(lista);
}
window.reanalisarFalhas = reanalisarFalhas;

// Fila por prioridade: lista numerada dos próximos leads a atender (do 4º em diante),
// ordenada por prioridade real de atendimento. Os 3 primeiros já estão nos cards do Top 3.
function renderFilaPrioridade(ordenados){
  const box = qs("#filaPrioridade");
  if(!box) return;
  const resto = (ordenados || []).slice(3, 12); // 4º ao 12º
  if(!resto.length){ box.style.display = "none"; box.innerHTML = ""; return; }
  const selId = state.lead?.id ? String(state.lead.id) : null;
  box.style.display = "block";
  box.innerHTML =
    `<div class="fila-head"><h3>Fila inteligente</h3><span>Ordenada por prioridade</span></div>` +
    resto.map((l, i) => {
      const pos = i + 4;
      const idJs = JSON.stringify(String(l.id||""));
      const ehSel = selId && String(l.id) === selId;
      const prioridade = prioridadeAtendimento(l) || {};
      const dias = l.daysSinceLastInteraction != null ? `${l.daysSinceLastInteraction} dias<br>sem resposta` : "";
      const etapa = normalizarEtapa(l.etapa);
      return `<div class="fila-row ${ehSel?"sel":""}" onclick='abrirLead(${idJs})'>
        <div class="fila-rank">${pos}</div>
        <div class="fila-info">
          <div class="fila-nm">${escapeHtml(l.name||"Cliente")}</div>
          <div class="fila-un">${escapeHtml(produtosLabel(l))}</div>
        </div>
        <div class="fila-days">${dias}</div>
        <div class="fila-pc" title="Prioridade de atendimento">${escapeHtml(prioridade.titulo || "Prioridade")}</div>
        <div class="fila-wa" title="Abrir lead">💬</div>
      </div>`;
    }).join("");
}

function renderTop3(top3){
  const area = qs("#top3Area");
  if(!area) return;
  if(!top3 || !top3.length){ area.style.display = "none"; area.innerHTML = ""; return; }
  const selId = state.lead?.id ? String(state.lead.id) : null;
  area.style.display = "grid";
  area.innerHTML = top3.map((l, i) => {
    const idStr = String(l.id||"");
    const ehSel = selId && idStr === selId;
    const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction+"d" : "—";
    const contatado = ehContatadoHoje(l);
    const badgeContato = contatado ? `<span title="Contato registrado hoje" style="display:inline-block;padding:1px 7px;border-radius:999px;font-size:9px;font-weight:950;color:var(--acao);background:rgba(104,255,149,.14);border:1px solid var(--acao);letter-spacing:.04em">✓ CONTATADO HOJE</span>` : "";
    const alerta = !contatado && ehEsfriando(l) ? tagEsfriandoHTML() : "";
    const novo = "";
    const permuta = ehPermuta(l) ? tagPermutaHTML() : "";
    return `
      <div class="top3-mini ${ehSel?"sel":""}" data-id="${escapeHtml(idStr)}" onclick='abrirLeadTop3(${JSON.stringify(idStr)})'>
        <div class="pos">${i+1}º</div>
        <div class="nome">${escapeHtml(l.name||"Cliente")}</div>
        <div class="prod">${escapeHtml(produtosLabel(l))}</div>
        <div class="stats">
          <span class="pct-mini" title="Prioridade de atendimento">${escapeHtml(prioridadeTituloCurto(l))}</span>
          <span class="dias-mini">${escapeHtml(dias)} parado</span>
          ${novo}
          ${permuta}
          ${alerta}
          ${badgeContato}
        </div>
        <div class="motivo-mini">${escapeHtml(motivoCurto(l))}</div>
      </div>`;
  }).join("");
}

async function abrirLeadTop3(id){
  if(!id) return;
  return abrirLead(id);
}
window.abrirLeadTop3 = abrirLeadTop3;
window.renderTop3 = renderTop3;

// v928 — parseValorVenda/formatBRL removidos: só existiam pra alimentar cálculos de "vendas
// fechadas" (valor/mês), tudo removido (o dono não marca Vendido no app — só Arquivar).

function renderSaudacao(items){
  const h = new Date().getHours();
  let saud = "Olá";
  if(h < 12) saud = "Bom dia";
  else if(h < 18) saud = "Boa tarde";
  else saud = "Boa noite";
  // v1007 — prioridade do nome: o que o corretor escreveu no Cérebro > o nome da conta
  // logada (preenchido no cadastro) > "corretor" genérico.
  const corretorNome = (state.cerebroCfg?.corretorNome || window.__cpContaNome || "").trim().split(/\s+/)[0] || "";
  if (typeof window.cpAtualizarIdentidadeVisivel === "function") window.cpAtualizarIdentidadeVisivel();
  const head = corretorNome ? `${saud}, ${escapeHtml(corretorNome)}!` : `${saud}, corretor!`;
  // v1014 — o título (#homePageTitle) precisa levar o nome de verdade mesmo quando a conta ainda
  // não tem NENHUM lead (conta nova, período de teste recém-começado): antes disso, o título só
  // era atualizado dentro do bloco que exige items.length, então toda conta zerada ficava presa
  // no placeholder genérico "Bom dia, corretor!" (definido às cegas antes dos dados carregarem)
  // pra sempre — mesmo já logada e identificada corretamente em todo o resto da tela.
  const title = qs("#homePageTitle");
  if(title) title.textContent = head;
  // Dois alvos: #saudacao (corpo, mobile) e #saudacaoDesktop (cabeçalho, desktop).
  // O CSS decide qual aparece em cada tela — aqui só sincroniza conteúdo/visibilidade.
  const boxes = [qs("#saudacao"), qs("#saudacaoDesktop")].filter(Boolean);
  if(!boxes.length) return;
  const setAll = (display, html) => boxes.forEach(b => { b.style.display = display; if(html != null) b.innerHTML = html; });
  if(state.lead?.id || state.grupoAtivo){ setAll("none"); return; }
  if(!items?.length){ setAll("none", ""); return; }
  // O número da saudação BATE com o card "Fazer agora": é a DOSE do dia (top CP_DOSE_DIA da
  // fila ranqueada), não o backlog inteiro. Cabeçalho laranja e card mostram o mesmo número.
  // v907: "atendidos hoje" conta IGUAL à Meta do dia — todo lead atendido hoje, INCLUSIVE o que
  // você arquivou depois (antes o filtro leadEhAtivo tirava o arquivado e a home dava menos que a Meta).
  // v980 — essa intenção da v907 nunca foi replicada em cpAtendidosHojeTotal (usada pela dose e
  // por outras telas); agora as duas usam a MESMA função, então não têm mais como divergir.
  const tratadosHoje = cpAtendidosHojeTotal(items);
  const acaoMostrada = cpFazerAgoraDose(items);
  let html;
  if(cpFimDeSemana()){
    html = tratadosHoje > 0
      // v1091 — ÚNICO aviso de dia sem fila que sobrou na Home. Antes a mesma informação aparecia
      // em cinco lugares na mesma tela (o dono circulou três num print). E o texto dizia sempre
      // "volta na segunda", o que fica errado pra quem marcou sábado no Cérebro.
      ? `<span class="destaque">Hoje você não atende.</span> ${tratadosHoje} atendido${tratadosHoje>1?"s":""} hoje mesmo assim — a fila volta ${cpProximoDiaDeAtendimento()}.`
      : `<span class="destaque">Hoje você não atende.</span> A fila "Fazer agora" volta ${cpProximoDiaDeAtendimento()}. Dá pra mudar seus dias no Cérebro.`;
  } else if(acaoMostrada > 0){
    // v942 — a Home agora SEMPRE mostra os leads do dia (puxa da fila ranqueada completa), então
    // "de cima pra baixo" volta a ser verdade e o card amarelo "nenhum lead prioritário" foi
    // removido. O número mostrado é o real que aparece na lista = min(meta, elegíveis na fila).
    const filaLen = (typeof cpFilaFazerAgora === 'function') ? cpFilaFazerAgora(items).length : 0;
    const naLista = Math.min(acaoMostrada, filaLen);
    html = naLista > 0
      ? `<span class="destaque">${naLista} lead${naLista>1?"s":""} pra atender hoje</span>, de cima pra baixo.`
      : `<span class="destaque">Tudo em dia!</span> Nenhum lead na fila agora — bom momento pra prospectar.`;
  } else if(tratadosHoje > 0){
    html = `<span class="destaque">Mandou bem!</span> ${tratadosHoje} lead${tratadosHoje>1?"s":""} atendidos hoje.`;
  } else {
    html = `Sem urgências agora. Bom momento pra prospectar.`;
  }
  setAll("block", html);
}

function renderResumoDia(items){
  const box = qs("#resumoDia");
  if(!box) return;
  if(!items?.length){
    box.style.display = "none"; box.innerHTML = "";
    const bh = qs("#navBadgeHoje"); if(bh) bh.style.display = "none";
    const ba = qs("#navBadgeAgenda"); if(ba) ba.style.display = "none";
    return;
  }
  // Contadores
  let compHoje = 0, compAmanha = 0;
  let quentes = 0, mornos = 0, frios = 0;
  let esfriando = 0; // interesse/etapa avançada + 3-7 dias sem retorno
  let aguardandoAcao = 0; // pra agenda: 3+ dias parado
  let lembretesVenceram = 0;
  // "Do dia" = lembrete com data de HOJE (não conta atrasado de dias atrás nem futuro).
  const iniHojeTs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const fimHojeTs = (() => { const d = new Date(); d.setHours(23,59,59,999); return d.getTime(); })();
  for(const l of items){
    const lem = l.analysis?.lembrete;
    if(lem?.quando){
      const t = new Date(lem.quando).getTime();
      if(!isNaN(t) && t >= iniHojeTs && t <= fimHojeTs) lembretesVenceram++;
    }
    const aps = l.analysis?.confirmedAppointments;
    if(Array.isArray(aps)){
      for(const ap of aps){
        const q = String(ap.quando||"").toLowerCase();
        if(/\bhoje\b/.test(q)) compHoje++;
        else if(/amanh[ãa]/.test(q)) compAmanha++;
      }
    }
    const t = l.analysis?.tipoRetomada;
    if(t === "quente-fechar") quentes++;
    else if(t === "morno-confirmar" || t === "informacao-enviar" || t === "objecao-tratar") mornos++;
    else if(t === "frio-reaquecer" || t === "stand-by") frios++;
    const dias = Number(l.daysSinceLastInteraction) || 0;
    if(ehEsfriando(l)) esfriando++;
    if(dias >= 3 && !ehContatadoHoje(l)) aguardandoAcao++;
  }
  // Atualiza badges no bottom-nav
  const ba = qs("#navBadgeAgenda");
  if(ba){
    const totalAgenda = aguardandoAcao + lembretesVenceram;
    if(totalAgenda > 0){ ba.style.display = "inline-block"; ba.textContent = totalAgenda; }
    else ba.style.display = "none";
  }
  // Atualiza título da página com contador (útil pra ver em aba de fundo)
  const totalUrgente = compHoje + lembretesVenceram;
  document.title = totalUrgente > 0 ? `(${totalUrgente}) Corretor Pro` : "Corretor Pro";
}

// Atualiza o SINO do topo + o nº da Agenda (compromissos/lembretes de HOJE). Extraído pra rodar
// em QUALQUER tela: sem isso, excluir/reagendar um lembrete fora da Home não mexia no sino até dar F5.
// Recebe a lista já carregada (opcional) pra não rebuscar; senão pega do cache (fresco quando quem
// chama invalidou antes).
async function atualizarSinoAgenda(leadsAll){
  let all = leadsAll;
  if(!Array.isArray(all)){
    try{ const data = await getLeadsData(); all = (data?.items || []).map(limparLead); }catch(_){ return; }
  }
  const ini = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const fim = (() => { const d = new Date(); d.setHours(23,59,59,999); return d.getTime(); })();
  let agendaN = 0;
  // v1093 — compromisso ATRASADO passa a acender o sino. Antes o pontinho só olhava a agenda de
  // HOJE: quem tinha um compromisso vencido (e nada marcado pra hoje) não via aviso nenhum no
  // topo — o item mais urgente do app era justamente o único invisível.
  let atrasadosN = 0;
  for(const l of all){
    const e = normalizarEtapa(l.etapa);
    if(e === ETAPA_ARQUIVADO) continue;
    if(typeof cp786CompromissoAtrasado === 'function' && cp786CompromissoAtrasado(l)){ atrasadosN++; continue; }
    const q = l.analysis?.lembrete?.quando;
    if(q){ const t = new Date(q).getTime(); if(!isNaN(t) && t >= ini && t <= fim){ agendaN++; continue; } }
    const aps = l.analysis?.confirmedAppointments;
    if(Array.isArray(aps) && aps.some(ap => /\bhoje\b/.test(String(ap.quando||"").toLowerCase()))) agendaN++;
  }
  state.agendaAtrasados = atrasadosN;
  state.agendaCount = agendaN + atrasadosN;
  const badgeAgT = qs("#btnAgendaTopoCount"); if(badgeAgT) badgeAgT.textContent = agendaN;
  // v787: o sino pertence exclusivamente à Central de atenção.
  // A agenda mantém sua contagem própria, sem disputar o mesmo badge visual.
  try{ window.cpAtualizarSinoAtencao?.(); }catch(_){}
  return agendaN;
}
window.atualizarSinoAgenda = atualizarSinoAgenda;

function homeAindaEmSkeleton(){
  const area = qs("#leadFocoArea");
  if(!area) return false;
  const lateral = qs("#homeRight");
  return !!area.querySelector(".skel-loading,.cp-loading-leads,.cp694-loading") ||
    /Carregando os leads|Carregando (?:banco de dados|sua carteira)/i.test(area.textContent || "");
}

function renderHomeFallbackSeguro(items){
  // v818: nunca sobrescrever a área quando um lead está aberto (o detalhe vive aqui dentro).
  if(state.focoLeadId || state.lead?.id) return;
  const area = qs("#leadFocoArea");
  if(!area) return;
  // O fallback também precisa encerrar qualquer placeholder lateral.
  try{ renderHomeRight([]); }catch(_){}
  // v824: o modo de segurança também respeita a categoria real. Só entra quem é 'agora'
  // (precisa de ação), então lead atendido recentemente (proteção de 5 dias) não aparece.
  const lista = (Array.isArray(items) ? items : [])
    .filter(l => l && typeof l === "object" && (l.id != null || l.name))
    .filter(l => { try{ return typeof cp786Categoria === "function" && cp786Categoria(l) === "agora"; }catch(_){ return false; } })
    .slice(0, 4);
  const linhas = lista.map(l => {
    const id = JSON.stringify(String(l.id || ""));
    const produto = produtosLabel(l) || "Produto não identificado";
    const dias = Number(l.daysSinceLastInteraction);
    const tempo = Number.isFinite(dias) ? (dias <= 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`) : "Abrir";
    return `<button type="button" class="ui-priority-row" onclick='abrirLead(${id})'>
      <span class="ui-row-copy"><strong>${escapeHtml(l.name || "Cliente")}</strong><small>${escapeHtml(produto)}</small><em class="ui-row-motivo">Abrir atendimento para conferir a próxima ação.</em></span>
      <span class="ui-row-action">${escapeHtml(tempo)}</span><span class="ui-row-chevron">›</span>
    </button>`;
  }).join("");
  area.innerHTML = `<div class="ui-home-content">
    ${typeof ui677ToolbarHTML === "function" ? ui677ToolbarHTML("home") : ""}
    <section class="ui-priority-card">
      <div class="ui-section-head"><div><h3>Atendimentos prioritários</h3><p>Sua carteira foi carregada. Abra um cliente para continuar.</p></div><button type="button" onclick="abrirFazerAgora()">Ver todos</button></div>
      <div class="ui-priority-list">${linhas || '<div class="empty">Nenhum atendimento ativo agora.</div>'}</div>
    </section>
  </div>`;
}

async function carregarDashboard(force){
  if(state.active !== "home") return;
  try{
    // Usa os dados já carregados. Atualização de rede acontece só quando o cache vence,
    // depois de uma mutação explícita, ou quando o chamador força (sync de fundo a cada 30s e
    // aba voltando a ficar visível chamam carregarDashboard(true) — antes desta correção o
    // parâmetro nem existia aqui, então essas duas sincronizações eram ignoradas em silêncio
    // sempre que a Home já tinha carregado uma vez na sessão: o dashboard só se atualizava de
    // verdade com um F5 completo).
    const cached = !force && state.itemsAtivos?.length ? { items: state.itemsAtivos } : null;
    if(cached){
      _processarDashboard({ items: state.todosLeads || cached.items });
      return;
    }

    // Só mostra o esqueleto quando a tela está mesmo vazia — uma sincronização de fundo forçada
    // com a lista já visível não pode apagar o que o corretor já está vendo enquanto busca.
    if(!state.itemsAtivos?.length && !state.grupoAtivo){
      const focoSkel = qs("#leadFocoArea");
      if(focoSkel) focoSkel.innerHTML = `<div class="cp-loading-leads"><div class="cp-loading-spinner"></div><b>Carregando os leads…</b><span>Buscando sua carteira atualizada.</span></div>`;
    }

    const data = await getLeadsData(force);
    if(data && data.ok === false){
      const foco = qs("#leadFocoArea");
      if(foco && !state.itemsAtivos?.length && !state.grupoAtivo){
        foco.innerHTML = `<div class="card compact"><div class="empty" style="padding:24px 16px;text-align:center;color:var(--muted)">Reconectando… puxando seus leads. <button type="button" onclick="invalidarLeadsCache();carregarDashboard()" style="margin-left:6px;background:transparent;border:1px solid var(--line);border-radius:999px;padding:4px 12px;color:var(--lime);font-weight:950;cursor:pointer">Tentar agora</button></div></div>`;
      }
      setTimeout(() => { if(state.active === "home") carregarDashboard(); }, 3000);
      return;
    }
    _processarDashboard(data);
  }catch(err){ console.warn("carregarDashboard:", err); }
}
async function _processarDashboard(data){
  if(!data?.items) return;
  try{
    const all = (data?.items || []).map(limparLead);
    const items = all.filter(l => { const e = normalizarEtapa(l.etapa); return e !== ETAPA_ARQUIVADO; });
    state.itemsAtivos = items;
    state.todosLeads = all;
    try{ window.cpAtualizarSinoAtencao?.(); }catch(_){}
    // Contagem da Agenda permanece separada da Central de atenção.
    // agora no helper atualizarSinoAgenda (reusado ao excluir/reagendar lembrete, pra refletir sem F5).
    atualizarSinoAgenda(all);
    // Radar da Geladeira: badge do Menu desativado (dono não quer aviso).
    const badgeGel = qs("#arquivadosRevisitarBadge");
    if(badgeGel) badgeGel.style.display = "none";
    // Total de leads ativos no pill do topo (mobile).
    const pillTotal = qs("#pillTotalLeads");
    if(pillTotal) pillTotal.textContent = `${items.length} leads`;
    const pillTotalD = qs("#pillTotalLeadsDesktop");
    if(pillTotalD) pillTotalD.textContent = `${items.length} leads`;
    // Onboarding: ensina o ritual diário pra quem ainda tem poucos leads (1-4) e
    // não dispensou. Quem chamou pelo Menu (forceOnboarding) vê independente da contagem.
    const onb = qs("#bannerOnboarding");
    if(onb){
      const visto = localStorage.getItem("direciona_onboarding_visto") === "1";
      const mostrar = state.forceOnboarding || (!visto && items.length >= 1 && items.length < 5);
      onb.style.display = mostrar ? "block" : "none";
    }
    renderSaudacao(items);
    renderResumoDia(items);
    // v928 — removido cálculo morto de "vendas do mês"/"vendas da semana" (o dono não marca
    // Vendido no app — só Arquivar, decisão da v904 — então isso nunca refletia a realidade).
    // Alimentava só #kpiVendas/#kpiVendasValor/state.resumoSemana, nenhum dos três lido em
    // lugar nenhum da tela: dado morto calculado à toa em todo carregamento do dashboard.
    if(qs("#kpiAtivos")) qs("#kpiAtivos").textContent = String(items.length);
    const etapasUsadas = new Set(items.map(l => normalizarEtapa(l.etapa)));

    // Home = 3 listas pra você decidir quem atacar (nenhum lead pré-aberto).
    if(items.length){
      const ordenados = items.map(l => ({ ...l, _score: scoreRankingHoje(l) })).sort(compararPrioridadeAtendimento);
      renderListasHome(ordenados);
      // A coluna lateral foi removida; mantemos a limpeza isolada para que uma
      // falha nela jamais derrube a lista principal novamente.
      try{ renderHomeRight([]); }catch(_){}
    } else {
      renderHomeRight([]);
      const area = qs("#top3Area"); if(area){ area.style.display = "none"; area.innerHTML = ""; }
      const fila = qs("#filaPrioridade"); if(fila){ fila.style.display = "none"; fila.innerHTML = ""; }
      // Empty state: nenhum lead ainda
      const foco = qs("#leadFocoArea");
      if(foco){
        foco.innerHTML = `
          <div class="card compact" style="background:linear-gradient(135deg,rgba(255,98,88,.04),rgba(55,232,255,.04));border:1px solid var(--line)">
            <div style="text-align:center;padding:30px 16px">
              <div style="font-size:48px;margin-bottom:12px"></div>
              <h2 class="title" style="font-size:22px;margin-bottom:8px">Pronto pra começar</h2>
              <div class="small" style="color:var(--soft);margin-bottom:18px;line-height:1.6">Importe a primeira conversa do WhatsApp.<br>O Corretor Pro vai ler, transcrever os áudios e te mostrar quem atender agora, por que, quando e o que falar.</div>
              <button type="button" class="btn pickZipShortcut" style="padding:14px 28px;font-size:14px">⇪ Importar conversa do WhatsApp</button>
              <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line);text-align:left">
                <div class="small" style="color:var(--muted);text-transform:uppercase;letter-spacing:.14em;font-size:10px;font-weight:950;margin-bottom:8px">Como funciona</div>
                <div class="small" style="line-height:1.7;color:var(--soft)">1. No WhatsApp, abra a conversa, toque em "⋮" → "Mais" → "Exportar conversa" → "Incluir mídia"<br>2. Compartilhe o ZIP com o Corretor Pro<br>3. Em 30-60 segundos o Corretor Pro mostra o que falar e quando</div>
              </div>
            </div>
          </div>`;
        // Re-bind do botão de importar
        qsa(".pickZipShortcut").forEach(b => {
          if(!b.dataset.bound){
            b.dataset.bound = "1";
            b.addEventListener("click", () => show("zip"));
          }
        });
      }
    }
  }catch(err){
    console.warn("_processarDashboard falhou:", err?.message||err);
    // Hotfix #807: um lead inconsistente ou um renderer antigo não pode bloquear a Home inteira.
    // Os dados já carregados continuam acessíveis por uma lista básica e clicável.
    try{ renderHomeFallbackSeguro(state.itemsAtivos || data?.items || []); }catch(_){ }
  }
  // Defesa final contra skeleton eterno em atualizações/cache ou corrida entre hotfixes.
  setTimeout(() => {
    if(state.active === "home" && homeAindaEmSkeleton()){
      try{ renderHomeFallbackSeguro(state.itemsAtivos || state.todosLeads || data?.items || []); }catch(_){ }
    }
  }, 600);
}

// ============ ATIVO / ARQUIVADO ============
// v1069 — pedido direto do dono: acabar de vez com etapas de funil (Novo/Atendimento/
// Visita-Proposta/Negociação/Standby) e com Vendido/Perdido como categorias separadas. Só
// existem dois estados possíveis pra um lead: Ativo ou Arquivado (valor interno "Geladeira",
// mesmo nome que a tela "Arquivados" já usava — evita renomear coluna/telas que dependem dele).
// Todo valor antigo de Vendido/Perdido/qualquer variação de "arquivado" cai em Geladeira; todo o
// resto (inclusive etapas de funil antigas, se sobrar em dado legado) cai em Ativo.
// v1094 — "Geladeira" NÃO é mais um conceito do app: é só o texto que ficou GRAVADO na coluna
// "etapa" do banco nos leads arquivados. Renomear esse texto exigiria reescrever o registro de
// todos os leads já arquivados no banco de produção (migração de dados), o que não foi feito
// nesta faxina de propósito. Então ele passa a existir em UM lugar só, com nome que diz o que é:
// no resto do código lê-se ETAPA_ARQUIVADO, e a palavra antiga não aparece mais espalhada.
const ETAPA_ARQUIVADO = "Geladeira";  // valor gravado no banco; na tela sempre "Arquivado"
const ETAPA_ATIVO = "Ativo";
const ETAPAS = [ETAPA_ATIVO, ETAPA_ARQUIVADO];

function normalizarEtapa(raw){
  const s = String(raw || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if(/vendido|venda concluida|venda fechada|perdido|desistiu|recusou|geladeira|arquivad|fechado/.test(s)) return ETAPA_ARQUIVADO;
  return ETAPA_ATIVO;
}

// Copia o histórico inteiro de mensagens do lead atual (texto plano).
async function copiarHistoricoLead(){
  let lead = state.lead;
  if(!lead?.id){ toast("Abra um lead primeiro."); return; }
  if(!lead.historyLoaded){
    toast("Carregando todas as mensagens…");
    try{
      const completo = await getLeadDetail(lead.id);
      if(state.lead?.id === completo.id){ state.lead = completo; state.analysis = completo.analysis || state.analysis; }
      lead = completo;
    }catch(err){ toast("Não consegui carregar o histórico completo: " + (err?.message || err)); return; }
  }
  const msgs = Array.isArray(lead.recentMessages) ? lead.recentMessages : [];
  const texto = msgs.map(m => `[${m.date||""} ${m.time||""}] ${m.author||""}: ${m.text||""}`).join("\n");
  if(!texto){ toast("Nada pra copiar."); return; }
  navigator.clipboard?.writeText(texto).then(
    () => toast(`${msgs.length} mensagens copiadas.`),
    () => {
      const ta = document.createElement("textarea");
      ta.value = texto; document.body.appendChild(ta); ta.select();
      try{ document.execCommand("copy"); toast(`${msgs.length} mensagens copiadas.`); }catch(_){ toast("Não copiou — copie manual da tela."); }
      ta.remove();
    }
  );
}
window.copiarHistoricoLead = copiarHistoricoLead;

// Junta os ids de TODAS as cópias do lead (duplicados que a lista juntou num card só),
// pra apagar tudo de uma vez — senão sobra uma cópia e o lead "volta".
function coletarDupeIds(id){
  const sid = String(id||"");
  const fontes = [state.lead && [state.lead], _leadsCache?.data?.items, state.todosLeads, state.itemsAtivos, state.carteiraLeads].filter(Array.isArray);
  for(const lista of fontes){
    const it = lista.find(l => l && String(l.id) === sid && Array.isArray(l.dupeIds) && l.dupeIds.length);
    if(it) return [...new Set(it.dupeIds.map(String).concat(sid))];
  }
  return [sid];
}
async function apagarLead(id, nome){
  if(!id) return;
  const msgApagar = `Apagar lead "${nome||"sem nome"}"? Não tem como desfazer.`;
  const okApagar = (typeof cp903Confirm === "function")
    ? await cp903Confirm({ titulo: "Apagar lead", mensagem: msgApagar, ok: "Apagar", perigo: true })
    : confirm(msgApagar);
  if(!okApagar) return;
  try{
    const ids = coletarDupeIds(id);
    const res = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id, ids, action: "apagar" }) });
    const data = await res.json();
    if(data?.ok){
      toast("Lead apagado.");
      removerLeadDosCaches(id);
      if(typeof carregarDashboard === "function") carregarDashboard();
    } else {
      toast("Erro: " + (data?.error || ""));
    }
  }catch(err){ toast("Erro: "+(err?.message||err)); }
}
window.apagarLead = apagarLead;

// Modal pra editar nome/telefone do lead aberto + opção de excluir.
// Heurística: nome que é na verdade um telefone (fallback do sistema).
function parecePhone(txt){
  const s = String(txt||"").replace(/[\s\-\(\)\+]/g, "");
  return /^\d{8,15}$/.test(s);
}

function abrirEditarLead(id, nome, telefone){
  if(!id) return;
  // Nome só fica preenchido quando há nome REAL salvo. Se o que tá ali é número
  // de telefone (fallback do sistema), limpa o campo Nome. O número vai pro
  // campo Telefone se ainda não tiver.
  let nomeIni = nome || "";
  let telIni = telefone || "";
  // Produto atual do lead aberto (pra pré-preencher). "Produto não identificado" = deixa vazio.
  let produtoIni = "";
  try{
    if(state.lead && String(state.lead.id) === String(id)){
      const p = String(state.lead.product || "");
      if(p && !/n[ãa]o identificado/i.test(p)) produtoIni = p;
    }
  }catch(_){}
  let dica = "";
  if(parecePhone(nomeIni)){
    if(!telIni) telIni = nomeIni;
    nomeIni = "";
    dica = `<div style="margin-bottom:12px;padding:9px 11px;background:rgba(255,45,155,.06);border:1px solid var(--timing);border-radius:8px;font-size:11px;color:var(--soft);line-height:1.4"><b style="color:var(--timing)">Atenção:</b> o sistema não identificou o nome. Coloque o nome real.</div>`;
  }
  qs("#editarLeadModal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "editarLeadModal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;pointer-events:auto";
  overlay.innerHTML = `
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;max-width:420px;width:100%;max-height:90vh;overflow:auto;pointer-events:auto" id="editarLeadCard">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="font-size:16px;font-weight:950">Editar lead</div>
          <button type="button" id="editLeadFechar" style="background:transparent;border:0;color:var(--muted);font-size:20px;cursor:pointer;padding:0 4px">✕</button>
        </div>
        ${dica}
        <div style="margin-bottom:12px">
          <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Nome</label>
          <input type="text" id="editLeadNome" value="${escapeHtml(nomeIni)}" placeholder="Nome do cliente" autocomplete="off" style="width:100%;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box">
        </div>
        <div style="margin-bottom:12px">
          <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Telefone (WhatsApp)</label>
          <input type="tel" id="editLeadTelefone" value="${escapeHtml(telIni)}" placeholder="+55 54 99999-9999" autocomplete="off" style="width:100%;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box">
        </div>
        <div style="margin-bottom:12px">
          <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Produto / empreendimento</label>
          <input type="text" id="editLeadProduto" list="editLeadProdutoLista" data-orig="${escapeHtml(produtoIni)}" value="${escapeHtml(produtoIni)}" placeholder="Ex.: nome do empreendimento" autocomplete="off" style="width:100%;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box">
          <datalist id="editLeadProdutoLista">${EMPREENDIMENTOS_CATALOGO.map(p => `<option value="${escapeHtml(p)}"></option>`).join("")}</datalist>
          <div class="small" style="color:var(--muted);font-size:10px;margin-top:5px">Escolha da lista ou digite. Deixe em branco se ainda não souber.</div>
        </div>
        <button type="button" id="editLeadSalvar" style="width:100%;padding:12px;background:var(--accent);color:var(--on-accent);border:0;border-radius:10px;font-size:14px;font-weight:950;cursor:pointer;margin-bottom:14px">Salvar</button>
        <div style="border-top:1px solid var(--line);padding-top:12px">
          <div style="color:var(--risco);font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:6px">Zona perigosa</div>
          <button type="button" id="editLeadExcluir" style="width:100%;padding:10px;background:transparent;color:var(--risco);border:1px solid var(--risco);border-radius:10px;font-size:13px;font-weight:950;cursor:pointer">Excluir este lead</button>
        </div>
      </div>`;
  document.body.appendChild(overlay);
  // Liga eventos manualmente (evita problemas de inline onclick em PWA)
  overlay.addEventListener("click", (e) => { if(e.target === overlay) fecharEditarLead(); });
  qs("#editLeadFechar")?.addEventListener("click", fecharEditarLead);
  qs("#editLeadSalvar")?.addEventListener("click", () => salvarEditarLead(String(id)));
  qs("#editLeadExcluir")?.addEventListener("click", () => excluirLeadDoModal(String(id), nome || ""));
  setTimeout(() => qs(parecePhone(nomeIni) ? "#editLeadTelefone" : "#editLeadNome")?.focus(), 100);
}
function fecharEditarLead(){ qs("#editarLeadModal")?.remove(); }
window.abrirEditarLead = abrirEditarLead;

// (v905) leitura de print no modal Editar removida junto com o "Atualizar por print".
// (v1069) leitura de print no lead manual também removida — o dono não usa mais essa função
// em lugar nenhum; sobra só o cadastro manual simples (Nome/Interesse/Telefone).

// Modal pra criar lead manualmente (alguém ligou, comentou pessoalmente, indicação)
const EMPREENDIMENTOS_CATALOGO = []; // v827 §7.1: sem catálogo fixo de empreendimentos (autocomplete fica livre)
function abrirNovoLead(){
  qs("#novoLeadModal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "novoLeadModal";
  overlay.className = "ui677-manual-modal";
  const opcoes = EMPREENDIMENTOS_CATALOGO.map(p => `<option value="${escapeHtml(p)}"></option>`).join("");
  overlay.innerHTML = `
    <div class="ui677-manual-card" role="dialog" aria-modal="true" aria-labelledby="ui677ManualTitle">
      <div class="ui677-manual-head">
        <div><small>Novo atendimento</small><h3 id="ui677ManualTitle">Incluir lead manualmente</h3><p>Cadastre sem importar uma conversa do WhatsApp.</p></div>
        <button type="button" id="novoLeadFechar" aria-label="Fechar">✕</button>
      </div>
      <label for="novoLeadNome">Nome</label>
      <input type="text" id="novoLeadNome" placeholder="Nome do lead" autocomplete="name">
      <label for="novoLeadInteresse">Interesse</label>
      <input type="text" id="novoLeadInteresse" list="ui677Interesses" placeholder="Ex.: nome do empreendimento, tipologia..." autocomplete="off">
      <datalist id="ui677Interesses">${opcoes}</datalist>
      <label for="novoLeadTel">Telefone</label>
      <input type="tel" id="novoLeadTel" placeholder="(54) 99999-9999" autocomplete="tel" inputmode="tel">
      <div class="ui677-manual-actions">
        <button type="button" class="secondary" id="novoLeadCancelar">Cancelar</button>
        <button type="button" class="primary" id="novoLeadSalvar">Incluir lead</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if(e.target === overlay) fecharNovoLead(); });
  qs("#novoLeadFechar")?.addEventListener("click", fecharNovoLead);
  qs("#novoLeadCancelar")?.addEventListener("click", fecharNovoLead);
  qs("#novoLeadSalvar")?.addEventListener("click", salvarNovoLead);
  setTimeout(() => qs("#novoLeadNome")?.focus(), 100);
}
function fecharNovoLead(){ qs("#novoLeadModal")?.remove(); }

async function salvarNovoLead(){
  const nome = (qs("#novoLeadNome")?.value || "").trim();
  const interesse = (qs("#novoLeadInteresse")?.value || "").trim();
  const telefone = (qs("#novoLeadTel")?.value || "").trim();
  if(!nome){ toast("Informe o nome do lead."); qs("#novoLeadNome")?.focus(); return; }
  if(!interesse){ toast("Informe o interesse do lead."); qs("#novoLeadInteresse")?.focus(); return; }
  const digitos = telefone.replace(/\D/g, "");
  if(digitos.length < 8){ toast("Informe um telefone válido."); qs("#novoLeadTel")?.focus(); return; }
  const btn = qs("#novoLeadSalvar");
  if(btn){ btn.disabled = true; btn.textContent = "Incluindo..."; }
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"criar-manual", nome, telefone, produto: interesse, observacao:"" })
    });
    const data = await res.json().catch(() => ({ ok:false }));
    if(data?.ok){
      toast("✓ Lead incluído.");
      fecharNovoLead();
      invalidarLeadsCache();
      state.todosLeads = [];
      state.carteiraLeads = [];
      await loadRecentLeads(true);
      await loadTodosLeadsBusca();
      if(data.id) abrirLead(data.id);
      else abrirCarteiraAtiva();
    } else {
      toast("Erro: " + (data?.error || "não foi possível incluir o lead"));
      if(btn){ btn.disabled = false; btn.textContent = "Incluir lead"; }
    }
  }catch(err){
    toast("Erro: " + (err?.message || err));
    if(btn){ btn.disabled = false; btn.textContent = "Incluir lead"; }
  }
}
window.abrirNovoLead = abrirNovoLead;
window.fecharNovoLead = fecharNovoLead;
window.salvarNovoLead = salvarNovoLead;
window.fecharEditarLead = fecharEditarLead;

async function salvarEditarLead(id){
  const nome = (qs("#editLeadNome")?.value || "").trim();
  const telefone = (qs("#editLeadTelefone")?.value || "").trim();
  const produto = (qs("#editLeadProduto")?.value || "").trim();
  const produtoOrig = (qs("#editLeadProduto")?.dataset.orig || "").trim();
  const produtoMudou = !!produto && produto.toLowerCase() !== produtoOrig.toLowerCase();
  if(!nome && !telefone && !produto){ toast("Nada pra salvar."); return; }
  const btn = qs("#editLeadSalvar");
  if(btn){ btn.disabled = true; btn.textContent = "Salvando..."; }
  try{
    {
      const res = await fetch("./api/lead-update", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ id, action:"editar-dados", nome, telefone, produto })
      });
      const data = await res.json();
      if(!data?.ok){ toast("Erro: " + (data?.error || "falhou")); if(btn){ btn.disabled=false; btn.textContent="Salvar"; } return; }
    }
    fecharEditarLead();
    if(produtoMudou){
      // Mudou o empreendimento → as 3 mensagens em cache estão velhas (genéricas). Reanalisa pra
      // elas saírem certeiras, citando o produto agora identificado.
      toast("Empreendimento salvo. Atualizando as mensagens…");
      const r = await fetch("./api/reanalisar-lead", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(payloadComCerebro({ id }))
      });
      const dr = await r.json().catch(() => ({ ok:false }));
      if(dr?.ok){ toast("Mensagens atualizadas com o empreendimento."); }
      else { toast("Produto salvo, mas a reanálise falhou: " + (dr?.error||"erro")); }
    } else {
      toast("Lead atualizado.");
    }
    // SEMPRE atualiza sozinho (sem precisar de Ctrl+F5): recarrega a base fresca e reflete
    // já o que foi salvo (nome/telefone/foto), pra tela não ficar com o dado antigo.
    try{ if(typeof invalidarLeadsCache === "function") invalidarLeadsCache(); }catch(_){}
    await loadRecentLeads();
    await carregarDashboard();
    // O banco pode levar um instante pra refletir o novo nome (lag de leitura). Por isso o
    // patch otimista vem POR ÚLTIMO, DEPOIS de todos os refetches — senão o carregarDashboard
    // recarregava por cima e o lead reabria com o nome/telefone antigo (o bug do "precisa atualizar o app").
    await getLeadsData(true).catch(()=>{});
    patchLeadCache(id, { name: nome, phone: telefone });
    await abrirLead(id);
  }catch(err){
    toast("Erro: " + (err?.message||err));
    if(btn){ btn.disabled=false; btn.textContent="Salvar"; }
  }
}
window.salvarEditarLead = salvarEditarLead;

async function excluirLeadDoModal(id, nome){
  fecharEditarLead();
  await apagarLead(id, nome);
  // Volta pra home depois de excluir
  state.lead = null; state.focoLeadId = null;
  show("home");
}
window.excluirLeadDoModal = excluirLeadDoModal;

// Exclusão definitiva a partir do botão discreto no fim da tela do lead.
async function excluirLeadDefinitivo(id, nome){
  if(!id) return;
  const msgExcluir = `Excluir DEFINITIVAMENTE o lead "${nome||"sem nome"}"?\n\nIsso apaga tudo (conversa, análise, histórico). Não tem como desfazer.`;
  const okExcluir = (typeof cp903Confirm === "function")
    ? await cp903Confirm({ titulo: "Excluir definitivamente", mensagem: msgExcluir, ok: "Excluir", perigo: true })
    : confirm(msgExcluir);
  if(!okExcluir) return;
  try{
    const ids = coletarDupeIds(id);
    const res = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id, ids, action: "apagar" }) });
    const data = await res.json();
    if(data?.ok){
      toast("Lead excluído.");
      state.lead = null; state.focoLeadId = null; state.analysis = null;
      removerLeadDosCaches(id);
      if(typeof carregarDashboard === "function") carregarDashboard();
      show("home");
    } else {
      toast("Erro ao excluir: " + (data?.error || ""));
    }
  }catch(err){ toast("Erro ao excluir: "+(err?.message||err)); }
}
window.excluirLeadDefinitivo = excluirLeadDefinitivo;

async function abrirLead(id, options={}){
  if(!id) return;
  const sid = String(id);
  if(!options.fromHistory && !cpApplyingHistory){
    const route={...cpRouteForScreen("lead"),screen:"lead",leadId:sid,grupoAtivo:state.grupoAtivo||null};
    if(!(history.state?.cpApp && history.state?.screen === "lead" && String(history.state?.leadId) === sid)) cpPushRoute(route);
  }
  state.focoLeadId = sid;
  state.timelineVisibleCount = 4;
  state.cp704HistoryFull = false;
  document.body.classList.add("lead-foco-aberto");
  garantirIntelCarregado().catch(()=>{});

  const emMemoria = () => {
    for(const lista of [state.todosLeads, state.itemsAtivos, state.leads]){
      if(!Array.isArray(lista)) continue;
      const l = lista.find(x => String(x.id) === sid);
      if(l) return limparLead(l);
    }
    return null;
  };

  const aplicarLead = (lead) => {
    if(!lead || String(state.focoLeadId) !== sid) return;
    state.lead = { ...lead, recentMessages: Array.isArray(lead.recentMessages) ? lead.recentMessages : [] };
    state.analysis = lead.analysis || null;
    const nome = qs("#clientName"), tel = qs("#clientPhone");
    if(nome) nome.value = lead.name || "";
    if(tel) tel.value = lead.phone || "";
    renderTimelineCardLegado(state.lead);
    showCard("timelineCard", true);
    const resultBox = qs("#resultBox");
    if(resultBox){
      resultBox.className = "small";
      resultBox.innerHTML =
        `<b>Lead:</b> ${escapeHtml(lead.name||"")}<br>` +
        `<b>Produto:</b> ${escapeHtml(lead.product||"--")}<br>` +
        `<b>Etapa:</b> ${escapeHtml(lead.etapa||"--")}<br>` +
        `<b>Última interação:</b> ${lead.daysSinceLastInteraction != null ? lead.daysSinceLastInteraction+(lead.daysSinceLastInteraction===1?" dia atrás":" dias atrás") : "--"}<br>` +
        `<b>Mensagens:</b> ${totalMensagensLead(lead)}<br>` +
        `<b>Áudios:</b> ${lead.audiosEncontrados||0} encontrados, ${lead.audiosTranscritos||0} transcritos`;
    }
    showCard("resultCard", true);
    renderAnalysis(state.analysis, state.lead);
    // v1028 — o detalhe completo do lead chega em 2 etapas (o que já está em memória primeiro,
    // o servidor depois) e cada etapa reconstrói a tela do lead inteira do zero — inclusive o
    // card "Últimas mensagens", que sempre volta pro estado padrão ("hidden", cravado no HTML)
    // quando isso acontece. Se o corretor clicasse em "Mensagens" bem no meio dessa janela (o
    // caso comum: quase sempre que se abre um lead), a 2ª reconstrução fechava o card sozinha
    // sem ele perceber — parecia que o 1º clique "não tinha feito nada" (só o 2º clique, já
    // depois dessa 2ª reconstrução, ficava aberto de vez). Preserva o estado aberto/fechado
    // através da reconstrução.
    const histAntes = qs("#cp704HistCard");
    const histAbertoAntes = !!histAntes && !histAntes.hidden;
    renderLeadFoco(state.lead);
    if(histAbertoAntes){ const hist = qs("#cp704HistCard"); if(hist) hist.hidden = false; }
    if(state.top3) renderTop3(state.top3);
    // v754: abrir/atualizar detalhe do lead não deve reconstruir a lista inteira.
    // Isso deixava cliques e expansão de abas lentos, principalmente com base grande.
    show("home", { skipLoad:true, skipHistory:true });
    const t = qs("#toast"); if(t) t.classList.remove("show");
  };

  // Começa o detalhe completo em paralelo, mas não prende o clique esperando a rede.
  const detalhePromise = getLeadDetail(sid);
  let lead = emMemoria();
  const area = qs("#leadFocoArea");
  if(area) area.innerHTML = `<div class="skel-loading" style="padding:16px 0"><div style="height:26px;width:55%;border-radius:8px;background:var(--panel);border:1px solid var(--line);animation:skel-pulse 1.4s ease-in-out infinite;margin-bottom:10px"></div><div class="skel-row"></div><div class="skel-row skel-row--sm"></div><div class="skel-row skel-row--sm"></div></div>`;
  show("home", { skipLoad:true, skipHistory:true });

  // Deixa o navegador pintar a tela/skeleton antes de montar o conteúdo do lead.
  await new Promise(resolve => requestAnimationFrame(resolve));
  if(String(state.focoLeadId) !== sid) return;

  if(lead){
    aplicarLead(lead);
  } else {
    try{
      const data = await getLeadsData();
      lead = (data?.items || []).find(x => String(x.id) === sid) || null;
      if(lead) aplicarLead(limparLead(lead));
    }catch(_){ /* o detalhe individual ainda pode encontrar o lead */ }
  }

  try{
    const completo = await detalhePromise;
    if(String(state.focoLeadId) !== sid) return;
    // O histórico integral permanece intacto. Só adiamos a montagem pesada para um
    // momento ocioso, evitando que a resposta da API congele o clique/rolagem.
    const aplicarCompleto = () => {
      if(String(state.focoLeadId) === sid) aplicarLead(completo);
    };
    if("requestIdleCallback" in window){
      window.requestIdleCallback(aplicarCompleto, { timeout:700 });
    } else {
      setTimeout(aplicarCompleto, 0);
    }
  }catch(err){
    if(!lead && String(state.focoLeadId) === sid){
      toast("Não consegui abrir o lead: " + (err?.message || err));
      voltarDoLead();
    } else if(String(state.focoLeadId) === sid){
      toast("O lead abriu, mas o histórico completo não carregou. Tente novamente.");
    }
  }
}
window.abrirLead = abrirLead;

const TIPO_CONTATO_LABEL = {
  "cliente-final": { txt:"Cliente final", cor:"var(--dados)", bg:"rgba(55,232,255,.12)" },
  "corretora-parceira": { txt:"Corretora parceira (B2B)", cor:"var(--cerebro)", bg:"rgba(196,92,255,.14)" },
  "indicacao": { txt:"Indicação", cor:"var(--lime)", bg:"rgba(255,98,88,.12)" },
  "outro": { txt:"Tipo indefinido", cor:"var(--muted)", bg:"rgba(255,255,255,.06)" }
};

function tipoContatoTextoMeta(t){
  // Texto inline puro. Antes retornava <span> e o topo escapava HTML, aparecendo tag na tela.
  const map = { "corretora-parceira":"Corretor(a) parceiro", "indicacao":"Indicação" };
  const txt = map[t];
  if(txt) return txt;
  if(!t || t==="outro") return "definir tipo";
  return "";
}
function tipoContatoEfetivoLead(lead, analysis){
  const raw = String(analysis?.tipoContato || lead?.tipoContato || "").trim();
  const nome = String(lead?.name || analysis?.clientName || "");
  const produto = String(lead?.product || analysis?.produtoInteresse || "");
  const txt = [raw, nome, produto].join(" ").toLowerCase();
  if(/corretor|corretora|imobili[áa]ria|im[oó]veis|creci|rede\s+moi|parceir/.test(txt)) return "corretora-parceira";
  return raw || "outro";
}
function badgeTipoContato(t){
  const cfg = TIPO_CONTATO_LABEL[t];
  if(!cfg){
    // Sem tipo definido ainda — mostra placeholder pra usuário poder marcar manualmente
    return `<span title="Tipo não definido — clique pra marcar" id="badgeTipoContato" style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;color:var(--muted);background:transparent;border:1px dashed var(--line);letter-spacing:.02em;cursor:pointer">Definir tipo</span>`;
  }
  return `<span title="Tipo de contato — clique pra mudar" id="badgeTipoContato" style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:950;color:${cfg.cor};background:${cfg.bg};border:1px solid ${cfg.cor};letter-spacing:.02em;cursor:pointer">${cfg.txt}</span>`;
}

const TIPO_RETOMADA_LABEL = {
  "quente-fechar": { txt:"Pronto pra fechar", cor:"var(--acao)", bg:"rgba(104,255,149,.14)" },
  "morno-confirmar": { txt:"Confirmar próximo passo", cor:"var(--timing)", bg:"rgba(255,45,155,.14)" },
  "frio-reaquecer": { txt:"Reativar", cor:"var(--dados)", bg:"rgba(55,232,255,.12)" },
  "objecao-tratar": { txt:"Tratar objeção", cor:"var(--morno)", bg:"rgba(184,194,201,.14)" },
  "informacao-enviar": { txt:"Enviar material", cor:"var(--cerebro)", bg:"rgba(196,92,255,.14)" },
  "primeiro-contato": { txt:"Primeiro contato", cor:"var(--lime)", bg:"rgba(255,98,88,.12)" },
  "stand-by": { txt:"Stand-by", cor:"var(--muted)", bg:"rgba(255,255,255,.06)" }
};

const MATERIAL_LABEL = {
  "planta":"Planta","tabela":"Tabela","video":"Vídeo","folder":"Folder",
  "localizacao":"Localização","memorial":"Memorial descritivo","simulacao":"Simulação",
  "comparativo":"Comparativo","convite-visita":"Convite pra visita",
  "material-valorizacao":"Valorização","material-wellness":"Lazer/wellness"
};

function badgeTipoRetomada(t){
  const cfg = TIPO_RETOMADA_LABEL[t];
  if(!cfg) return "";
  return `<span title="Tipo de abordagem sugerida" style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:950;color:${cfg.cor};background:${cfg.bg};border:1px solid ${cfg.cor};letter-spacing:.02em">${cfg.txt}</span>`;
}

const EVENTO_LABEL = {
  "whatsapp_aberto": { icone:"", txt:"Abriu WhatsApp", cor:"var(--acao)" },
  "mensagem_copiada": { icone:"", txt:"Copiou mensagem", cor:"var(--dados)" },
  "contato_manual": { icone:"", txt:"Contato manual", cor:"var(--cerebro)" },
  "cliente_respondeu": { icone:"", txt:"Cliente respondeu", cor:"var(--acao)" }
};

function formatarTempoRelativo(iso){
  if(!iso) return "";
  try{
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if(diff < 60) return "agora";
    if(diff < 3600) return Math.round(diff/60)+"min atrás";
    if(diff < 86400) return Math.round(diff/3600)+"h atrás";
    const dias = Math.round(diff/86400);
    if(dias < 7) return dias+"d atrás";
    return d.toLocaleDateString("pt-BR");
  }catch(_){ return iso.slice(0,10); }
}

const EVOLUIU_LABEL = {
  "avancou": { txt:"Avançou", cor:"var(--acao)" },
  "estagnou": { txt:"➖ Estagnou", cor:"var(--muted)" },
  "esfriou": { txt:"Parou", cor:"var(--risco)" },
  "fechou": { txt:"Fechou", cor:"var(--acao)" },
  "perdeu": { txt:"Perdeu", cor:"var(--risco)" }
};
const FUNCIONOU_LABEL = {
  "sim": { txt:"✓ funcionou", cor:"var(--acao)" },
  "parcial": { txt:"~ parcial", cor:"var(--morno)" },
  "nao": { txt:"✗ não funcionou", cor:"var(--risco)" },
  "sem-dados": { txt:"sem dados", cor:"var(--muted)" }
};

function renderEvolucao(lead){
  const ev = lead.analysis?.evolucao;
  if(!Array.isArray(ev) || !ev.length) return "";
  // Mostra os últimos 4, mais recente primeiro
  const itens = [...ev].slice(-4).reverse().map(e => {
    const rumo = EVOLUIU_LABEL[e.evoluiu];
    const func = FUNCIONOU_LABEL[e.abordagemFuncionou];
    const quando = e.comparadoEm ? formatarTempoRelativo(e.comparadoEm) : "";
    const badges = [
      rumo ? `<span style="color:${rumo.cor};font-weight:950">${rumo.txt}</span>` : "",
      func ? `<span style="color:${func.cor};font-weight:600">${func.txt}</span>` : ""
    ].filter(Boolean).join(" · ");
    return `<div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;line-height:1.5">
      <div style="display:flex;justify-content:space-between;gap:8px">${badges}<span class="small" style="color:var(--muted);font-size:10px">${escapeHtml(quando)}</span></div>
      ${e.comoReagiu && e.comoReagiu !== "sem resposta" ? `<div style="color:var(--soft);margin-top:2px">Cliente: ${escapeHtml(e.comoReagiu)}</div>` : ""}
      ${e.oQueMudou ? `<div style="color:var(--text);margin-top:2px">${escapeHtml(e.oQueMudou)}</div>` : ""}
      ${e.licao && e.licao !== "sem lição clara ainda" ? `<div style="color:var(--soft);margin-top:2px;font-size:11px">${escapeHtml(e.licao)}</div>` : ""}
    </div>`;
  }).join("");
  return `<details class="bloco-recolhe"><summary>Evolução do atendimento (${ev.length})</summary>
    <div style="margin-top:8px">${itens}</div>
  </details>`;
}

function renderHistoricoContatos(lead){
  const eventos = lead.analysis?.aprendizado?.eventos || [];
  if(!eventos.length) return "";
  // Mostra últimos 5 em ordem decrescente
  const ultimos = [...eventos].slice(-5).reverse();
  const itens = ultimos.map(e => {
    const cfg = EVENTO_LABEL[e.evento] || { icone:"•", txt: e.evento, cor:"var(--muted)" };
    const estilo = e.estilo ? ` (${e.estilo})` : "";
    const tipo = e.detalhes?.tipo ? ` — ${e.detalhes.tipo}` : "";
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,.04)">
      <span style="color:var(--text)"><span style="color:${cfg.cor}">${cfg.icone}</span> ${escapeHtml(cfg.txt + estilo + tipo)}</span>
      <span class="small" style="color:var(--muted);font-size:10px">${escapeHtml(formatarTempoRelativo(e.quando))}</span>
    </div>`;
  }).join("");
  return `<div style="padding:11px 13px;background:var(--card);border:1px solid var(--line);border-radius:10px">
    <div class="small" style="color:var(--acao);text-transform:uppercase;letter-spacing:.12em;font-weight:950;font-size:10px;margin-bottom:6px">Histórico de contatos</div>
    ${itens}
  </div>`;
}

const MATERIAL_TEMPLATE = {
  "planta": "Posso te mandar a planta do apartamento, fica mais fácil pra você visualizar.",
  "tabela": "Te mando a tabela com os valores atualizados e condições de pagamento.",
  "video": "Tenho um vídeo curto do empreendimento, dá pra ter uma noção bem boa. Te envio?",
  "folder": "Te mando o folder digital com todas as informações principais.",
  "localizacao": "Vou te enviar a localização exata, dá uma olhada na região.",
  "memorial": "Posso te mandar o memorial descritivo com os detalhes técnicos.",
  "simulacao": "Faço uma simulação personalizada de pagamento pra você?",
  "comparativo": "Te mando um comparativo entre as opções pra você decidir melhor.",
  "convite-visita": "Que tal marcarmos uma visita ao decorado? Tenho horários essa semana.",
  "material-valorizacao": "Te mando um material mostrando a valorização da região nos últimos anos.",
  "material-wellness": "Vou te mandar um material sobre a área de lazer e wellness do empreendimento."
};

function renderMateriais(materiais, lead){
  if(!Array.isArray(materiais) || !materiais.length) return "";
  const phone = lead?.phone || "";
  const cards = materiais.slice(0,3).map((m, i) => {
    const lab = MATERIAL_LABEL[m.tipo] || ("" + (m.tipo||"Material"));
    const motivo = m.motivo ? `<div class="small" style="margin-top:2px;color:var(--soft)">${escapeHtml(m.motivo)}</div>` : "";
    const quando = m.quando ? `<div class="small" style="margin-top:2px;color:var(--muted);font-size:10px;letter-spacing:.05em;text-transform:uppercase">${escapeHtml(m.quando)}</div>` : "";
    const template = MATERIAL_TEMPLATE[m.tipo];
    const waLink = template ? whatsappLink(phone, template) : "";
    const btnEnviar = template ? `<a href="${escapeHtml(waLink)}" target="_blank" onclick="event.stopPropagation();registrarAprendizado('material_sugerido_enviado',null,{tipo:'${escapeHtml(m.tipo)}'})" style="display:inline-block;margin-top:6px;padding:4px 10px;background:var(--lime);color:var(--on-accent);border:1px solid var(--lime);border-radius:999px;font-size:10px;font-weight:950;text-decoration:none;letter-spacing:.04em">Mandar agora</a>` : "";
    return `<div style="padding:8px 10px;background:rgba(196,92,255,.06);border:1px solid rgba(196,92,255,.18);border-radius:10px"><div style="font-weight:950;font-size:13px;color:var(--text)">${escapeHtml(lab)}</div>${motivo}${quando}${btnEnviar}</div>`;
  }).join("");
  return `<div style="padding:11px 13px;background:var(--card);border:1px solid var(--line);border-radius:10px">
    <div class="small" style="color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-weight:950;font-size:10px;margin-bottom:6px">Materiais sugeridos</div>
    <div style="display:flex;flex-direction:column;gap:6px">${cards}</div>
  </div>`;
}

// Barra de progresso indeterminada (mostra que está processando, não travou). Retorna função pra remover.
function iniciarBarraProgresso(btn, texto){
  if(!btn || !btn.parentElement) return () => {};
  const bar = document.createElement("div");
  bar.className = "barra-reanalise";
  btn.parentElement.insertAdjacentElement("afterend", bar);
  let label = null;
  if(texto){
    label = document.createElement("div");
    label.className = "small";
    label.style.cssText = "color:var(--muted);text-align:center;margin-top:5px;font-size:11px";
    label.textContent = texto;
    bar.insertAdjacentElement("afterend", label);
  }
  return () => { try{ bar.remove(); if(label) label.remove(); }catch(_){} };
}

// Volta da tela do lead: se veio de um grupo, retorna pro grupo; senão, pra home dos botões.
// v1026 — o botão "Voltar" usava history.back(), que pode levar pra QUALQUER coisa que
// estivesse antes na pilha do navegador (outro lead, outra tela) — o dono pediu, mais de uma
// vez, que "Voltar" sempre volte pra Home (ou pro grupo aberto dentro dela), nunca "pra última
// ação". Agora sempre limpa o lead e renderiza a Home direto, sem depender do histórico do
// navegador, e substitui a rota salva por uma de Home (pra um refresh logo em seguida também
// não achar um lead salvo).
function voltarDoLead(){
  if(typeof cp7ObsPararGravacaoSeAtiva === "function") cp7ObsPararGravacaoSeAtiva();
  cpClearLeadState();
  // v1030 — a v1026 removeu o history.back() (levava pra "última ação" em vez da Home), mas
  // history.back() disparava popstate → cpRestoreRoute → show("home"), que é quem de fato manda
  // recarregar o painel (cartões "Total de leads"/"Agenda"/etc. e as listas). Chamando só
  // renderBotoesHome() direto, esse recarregamento nunca acontecia — depois de "Voltar", a Home
  // ficava com o painel vazio/parado (relatado: só "Buscar lead" e nada mais). show("home",...)
  // primeiro, na MESMA ordem que cpRestoreRoute já usa com sucesso pro botão físico de voltar.
  show("home", { skipHistory:true });
  if(state.grupoAtivo){ if(!cpReabrirGrupoEspecial(state.grupoAtivo)) abrirGrupoHome(state.grupoAtivo,{fromHistory:true}); }
  else { renderBotoesHome(); }
  cpReplaceRoute(cpRouteForScreen("home"));
}
window.voltarDoLead = voltarDoLead;

// ===== Atender em sequência (esteira) =====
// Abre a fila de hoje 1 lead por vez: você manda/marca e clica "Próximo" — sem voltar e
// escolher de novo. O corretor conduz; o app só tira a fricção entre um lead e outro.
function iniciarSequenciaAtendimento(){
  const fila = (state.gruposHome?.hoje || []).map(l => String(l.id||"")).filter(Boolean);
  if(!fila.length){ toast("Sua fila de hoje está vazia."); return; }
  state.grupoAtivo = null;
  state.sequencia = { ids: fila, idx: 0 };
  abrirLead(fila[0]);
}
window.iniciarSequenciaAtendimento = iniciarSequenciaAtendimento;

function proximoDaSequencia(){
  if(!state.sequencia) return;
  if(state.sequencia.idx >= state.sequencia.ids.length - 1){ finalizarSequencia(); return; }
  state.sequencia.idx++;
  abrirLead(state.sequencia.ids[state.sequencia.idx]);
}
window.proximoDaSequencia = proximoDaSequencia;

function sairDaSequencia(){
  state.sequencia = null;
  voltarDoLead();
}
window.sairDaSequencia = sairDaSequencia;

function finalizarSequencia(){
  state.sequencia = null;
  state.lead = null; state.focoLeadId = null; state.analysis = null;
  toast("Mandou bem! Você passou por toda a fila de hoje.");
  renderBotoesHome();
}
window.finalizarSequencia = finalizarSequencia;


/* ============================================================
   Atualização #724-2 — Tela do lead consolidada
   - Uma única função renderLeadFoco ativa.
   - Sem chamar renderizações antigas antes ou depois.
   - Mantém IA por fatos, 3 mensagens, observações, histórico e ferramentas.
   ============================================================ */
function cp704Css(){
    if(document.getElementById('cp704LeadUxCSS')) return;
    const css=document.createElement('style'); css.id='cp704LeadUxCSS';
    css.textContent=`
      .cp704-lead{display:flex;flex-direction:column;gap:14px;padding-bottom:20px;width:100%;max-width:1180px;margin:0 auto;color:var(--text)}.cp704-workspace{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.82fr);gap:14px;align-items:start}.cp704-primary,.cp704-secondary{display:flex;flex-direction:column;gap:14px;min-width:0}.cp704-secondary .cp704-accordions{width:100%}.cp704-herorow{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,.85fr);gap:14px;align-items:stretch}.cp704-obscard{gap:6px}.cp704-obscard textarea{width:100%;box-sizing:border-box}.cp704-tools-open .cp704-card-title{margin-bottom:12px}.cp704-tools-row{display:flex;flex-wrap:wrap;gap:10px}.cp704-tools-row button{flex:1 1 160px;min-width:140px;min-height:54px;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));color:var(--text);font-weight:900;font-size:13px;letter-spacing:.01em;cursor:pointer;transition:transform .06s ease,border-color .15s,box-shadow .15s,background .15s}.cp704-tools-row button:hover{border-color:rgba(255,255,255,.3);box-shadow:0 8px 22px rgba(0,0,0,.24);transform:translateY(-1px)}.cp704-tools-row button:active{transform:translateY(0);box-shadow:0 3px 10px rgba(0,0,0,.2)}.cp704-tools-row button.good{border-color:rgba(104,255,149,.45);background:linear-gradient(180deg,rgba(104,255,149,.16),rgba(104,255,149,.05));color:#7dffab}.cp704-tools-row button.good:hover{border-color:rgba(104,255,149,.7);box-shadow:0 8px 22px rgba(104,255,149,.14)}.cp704-tools-row button.cp704-danger{border-color:rgba(255,98,88,.42);background:linear-gradient(180deg,rgba(255,98,88,.12),rgba(255,98,88,.04));color:#ff8a80}.cp704-tools-row button.cp704-danger:hover{border-color:rgba(255,98,88,.7);box-shadow:0 8px 22px rgba(255,98,88,.16)}.cp704-hist-inline{flex:1 1 160px;min-width:140px;align-self:flex-start;padding:0;border:0;background:transparent}.cp704-hist-inline[open]{flex-basis:100%}.cp704-hist-inline>summary{list-style:none;display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));color:var(--text);font-weight:900;font-size:13px;cursor:pointer;white-space:nowrap;transition:transform .06s ease,border-color .15s,box-shadow .15s}.cp704-hist-inline>summary:hover{border-color:rgba(255,255,255,.3);box-shadow:0 8px 22px rgba(0,0,0,.24);transform:translateY(-1px)}.cp704-hist-inline>summary::-webkit-details-marker{display:none}.cp704-hist-inline[open]>summary .cp704-hist-arrow{transform:rotate(180deg)}.cp704-hist-inline .cp704-body{margin-top:10px;max-height:340px;overflow:auto;width:100%}
      .cp704-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0 4px}.cp704-top-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.cp704-reanalyse{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.045);color:var(--text);border-radius:999px;padding:8px 12px;font-weight:950;font-size:12px;white-space:nowrap;cursor:pointer}
      .cp704-reanalyse-destaque{background:var(--surface-soft)!important;border-color:var(--line2)!important;color:var(--text)!important;box-shadow:none}
      .cp704-reanalyse-destaque:hover{background:var(--surface-hover)!important;border-color:var(--line2)!important}
      .cp704-back{border:1px solid var(--line);background:transparent;color:var(--soft);border-radius:12px;padding:9px 10px;display:flex;flex-direction:column;align-items:center;gap:5px;font-weight:850;font-size:10.5px;line-height:1.1;white-space:nowrap;cursor:pointer;min-width:66px;transition:color .15s,border-color .15s,transform .05s}
.cp704-back svg{width:19px;height:19px}
.cp704-back:hover{color:var(--text);border-color:var(--muted)}
.cp704-back:active{transform:translateY(1px)}
      /* Marcar atendimento = ação principal do bloco (coral). Verde só quando já atendido (concluído). */
      .cp704-attended{border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:999px;padding:8px 12px;font-weight:950;font-size:12px;white-space:nowrap}
      .cp704-desmarcar{background:transparent;border:0;color:var(--muted);font-size:12px;font-weight:800;text-decoration:underline;text-underline-offset:2px;cursor:pointer;padding:4px 8px;white-space:nowrap}
      .cp704-desmarcar:hover{color:var(--text)}
      .cp704-toolbar{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
      @media(min-width:1000px){.cp704-toolbar{grid-template-columns:repeat(8,minmax(0,1fr))}}
      .cp704-ico{border:1px solid var(--line);background:transparent;color:var(--soft);border-radius:12px;padding:9px 10px;display:flex;flex-direction:column;align-items:center;gap:5px;font-weight:850;font-size:10.5px;line-height:1.1;white-space:nowrap;cursor:pointer;min-width:66px}
      .cp704-ico svg{width:19px;height:19px}
      .cp704-ico:hover{color:var(--text);border-color:var(--muted)}
      .cp704-ico.done{background:rgba(112,212,157,.14);border-color:rgba(112,212,157,.5);color:var(--acao)}
.cp704-ico-danger{color:#ff8a80;border-color:rgba(255,98,88,.4)}.cp704-ico-danger:hover{color:#ff8a80;border-color:rgba(255,98,88,.75);background:rgba(255,98,88,.08)}
.cp704-hist-card .cp704-hist-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.cp704-hist-card .cp704-copy-history{border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--soft);border-radius:10px;padding:7px 12px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}
      .cp704-ico-loading{opacity:.6;pointer-events:none}
      .cp704-ico-loading svg{animation:cp704-spin 1s linear infinite}
      @keyframes cp704-spin{to{transform:rotate(360deg)}}
      @media (prefers-reduced-motion:reduce){.cp704-ico-loading svg{animation:none}}
      .cp704-attended:not(:disabled){cursor:pointer}.cp704-attended:disabled{opacity:1;background:rgba(104,255,149,.12);border-color:rgba(104,255,149,.5);color:#68ff95}
      .cp704-hero{border:1px solid rgba(255,255,255,.10);background:linear-gradient(135deg,rgba(7,52,64,.92),rgba(5,31,40,.96));border-radius:18px;padding:15px;box-shadow:0 14px 45px rgba(0,0,0,.20)}
      .cp704-hero h1{font-size:28px;line-height:1.04;margin:0 0 8px;font-weight:950;letter-spacing:-.03em;color:var(--text)}
      .cp704-tags{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.cp704-tag{font-size:11px;color:var(--muted);background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.075);padding:5px 8px;border-radius:999px;font-weight:850}
      .cp704-mainrow{display:grid;grid-template-columns:1fr;gap:12px;align-items:center}.cp704-situation{display:flex;flex-direction:column;gap:8px}.cp704-pill{display:inline-flex;align-items:center;gap:6px;width:max-content;max-width:100%;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:950;border:1px solid rgba(184,194,201,.45);background:rgba(184,194,201,.10);color:var(--soft)}.cp704-pill.green{border-color:rgba(104,255,149,.45);background:rgba(104,255,149,.10);color:#68ff95}.cp704-pill.red{border-color:rgba(255,98,88,.45);background:rgba(255,98,88,.10);color:#ff7f74}.cp704-situation p{margin:0;color:rgba(237,246,248,.92);font-size:14px;line-height:1.45}.cp704-etapa{gap:7px}.cp704-etapa .cp704-etapa-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;display:inline-block;box-shadow:0 0 0 3px rgba(255,255,255,.05)}
      .cp704-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px;padding-top:13px;border-top:1px solid rgba(255,255,255,.08)}.cp704-metric{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;color:rgba(237,246,248,.92)}.cp704-metric small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:1px}
      .cp704-card{border:1px solid rgba(255,255,255,.10);background:rgba(7,52,64,.72);border-radius:16px;padding:14px}.cp704-card-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.cp704-card-title h2{font-size:17px;margin:0;font-weight:950}.cp704-card-title small{font-size:11px;color:var(--muted);font-weight:850}
      .cp704-last{display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:center;color:rgba(237,246,248,.95);font-size:13px}.cp704-last b{font-weight:950}.cp704-last span{display:block;color:var(--muted);font-size:12px;margin-top:2px}
      .cp704-ai ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}.cp704-ai li{display:grid;grid-template-columns:20px 1fr;gap:8px;line-height:1.35;color:rgba(237,246,248,.92);font-size:14px}.cp704-ai i{font-style:normal;color:#68ff95;font-weight:950}
      .cp704-step{margin:0}.cp704-step p{margin:0;font-size:14px;line-height:1.45;color:rgba(237,246,248,.94)}.cp704-metaline{margin-top:12px;padding-top:11px;border-top:1px solid rgba(255,255,255,.08);color:var(--soft);font-size:12px;line-height:1.4;font-weight:700}.cp704-metaline+.cp704-metaline{margin-top:2px;padding-top:0;border-top:0}.cp704-msg-sub{margin:15px 0 9px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.14em;font-weight:950}
      .cp704-msg-list{display:flex;flex-direction:column;gap:10px}.cp704-msg-item{display:grid;grid-template-columns:1fr auto;gap:9px 12px;align-items:start;padding:12px;border:1px solid rgba(255,255,255,.085);border-radius:14px;background:rgba(255,255,255,.025)}.cp704-msg-head{grid-column:1/-1;display:flex;align-items:center;gap:8px}.cp704-msg-head b{font-size:12px;font-weight:950;color:rgba(237,246,248,.96)}.cp704-num{width:22px;height:22px;border-radius:999px;background:var(--lime);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:950;flex:0 0 auto}.cp704-msg-item:nth-child(2) .cp704-num{background:#ff8f88}.cp704-msg-item:nth-child(3) .cp704-num{background:#ff5e52}.cp704-msg-item p{margin:0;font-size:13px;line-height:1.45;color:rgba(237,246,248,.93)}.cp704-copy{align-self:center;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.035);color:var(--text);border-radius:10px;padding:8px 12px;font-size:11px;font-weight:900;cursor:pointer;min-width:72px}.cp704-copy:hover{border-color:rgba(255,98,88,.55);background:rgba(255,98,88,.08)}.cp704-empty-analysis{border:1px solid rgba(184,194,201,.35);background:rgba(184,194,201,.07);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px}.cp704-empty-analysis b{color:var(--soft)}.cp704-empty-analysis span{color:var(--muted);font-size:13px}.cp704-empty-analysis button{border:1px solid rgba(184,194,201,.45);background:rgba(255,255,255,.04);color:var(--soft);border-radius:12px;padding:11px;font-weight:950;margin-top:4px}
      .cp704-accordions{display:flex;flex-direction:column;gap:9px}.cp704-details{border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(7,52,64,.58);overflow:hidden}.cp704-details summary{list-style:none;cursor:pointer;padding:13px 14px;font-size:14px;font-weight:950;display:flex;align-items:center;justify-content:space-between;gap:10px}.cp704-details summary::-webkit-details-marker{display:none}.cp704-details summary:after{content:"⌄";color:var(--muted);flex:0 0 auto}.cp704-details[open] summary:after{content:"⌃"}.cp704-summary-left{display:inline-flex;align-items:center;gap:8px;min-width:0}.cp704-summary-actions{display:inline-flex;align-items:center;gap:10px;margin-left:auto}.cp704-copy-history{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.045);color:var(--text);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:950;cursor:pointer;white-space:nowrap}.cp704-copy-history:hover{border-color:rgba(255,98,88,.55);background:rgba(255,98,88,.10)}.cp704-body{padding:0 14px 14px;color:rgba(237,246,248,.92);font-size:13px;line-height:1.45}.cp704-timeline{display:flex;flex-direction:column;gap:0}.cp704-tmsg{display:grid;grid-template-columns:14px 1fr;gap:9px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.075)}.cp704-dot{width:8px;height:8px;border-radius:50%;background:#8aa1ad;margin-top:6px}.cp704-dot.you{background:var(--lime)}.cp704-dot.obs{background:var(--cyan)}.cp704-dot.sys{background:#8aa1ad;opacity:.45}.cp704-dot.prop{background:var(--accent)}.cp704-tmsg-obs b{color:var(--cyan)!important;text-transform:uppercase;letter-spacing:.06em;font-size:10px!important}.cp704-tmsg-obs p{color:rgba(210,239,255,.92)}.cp704-tmsg-sys b{color:var(--muted)!important}.cp704-tmsg-prop{cursor:pointer}.cp704-tmsg-prop b{color:var(--accent)!important;text-transform:uppercase;letter-spacing:.06em;font-size:10px!important}.cp704-prop-hint{display:block;color:var(--accent)!important;font-weight:800!important;margin-top:2px}.cp704-tmsg b{font-size:12px}.cp704-tmsg p{margin:2px 0 3px}.cp704-tmsg small{color:var(--muted);font-size:11px}.cp704-full-btn{width:100%;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.03);color:var(--text);border-radius:10px;padding:10px;margin-top:10px;font-weight:900;cursor:pointer}.cp704-rows{display:flex;flex-direction:column}.cp704-row{padding:9px 0;border-bottom:1px solid rgba(255,255,255,.075)}.cp704-row small{display:block;text-transform:uppercase;letter-spacing:.13em;color:var(--muted);font-size:9px;font-weight:950;margin-bottom:3px}.cp704-row div{font-size:13px;color:rgba(237,246,248,.94)}
      .cp704-actions-group{margin-top:10px}.cp704-actions-group h3{font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted);margin:0 0 7px}.cp704-actions-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cp704-actions-grid button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);color:var(--text);border-radius:11px;padding:10px 8px;font-size:12px;font-weight:900;cursor:pointer}.cp704-actions-grid button.good{border-color:rgba(104,255,149,.35);color:#68ff95}.cp704-actions-grid button.warn{border-color:rgba(184,194,201,.35);color:var(--soft)}.cp704-actions-grid button.bad{border-color:rgba(255,98,88,.42);color:#ff7f74}.cp704-danger{width:100%;border:1px solid rgba(255,98,88,.55)!important;color:#ff7f74!important;background:rgba(255,98,88,.06)!important}.cp704-quickbar{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cp704-quickbar button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);color:var(--text);border-radius:11px;padding:10px 8px;font-size:12px;font-weight:900;cursor:pointer}.cp704-quickbar button.good{color:#68ff95;border-color:rgba(104,255,149,.35)}
      .cp704-stale{border-color:rgba(184,194,201,.28);background:rgba(184,194,201,.06);border-left:3px solid var(--morno);padding:12px 13px 13px}.cp704-stale .cp704-card-title{margin-bottom:6px}.cp704-stale .cp704-card-title h2{font-size:14px}.cp704-stale p{font-size:13px;line-height:1.4;margin:0}.cp704-stale button{margin-top:10px;width:100%;border:1px solid rgba(184,194,201,.45);border-radius:12px;background:rgba(255,255,255,.04);color:var(--soft);padding:10px;font-weight:900}
      .cp715-reading{font-size:13px;line-height:1.46;color:rgba(237,246,248,.94)}
      .cp704-body{overflow-wrap:anywhere;word-break:normal}.cp704-row div{overflow-wrap:anywhere}.cp704-tag,.cp704-pill{min-width:0;overflow:hidden;text-overflow:ellipsis}
      .cp704-card,.cp704-details,.cp704-hero{box-sizing:border-box;max-width:100%}.cp704-lead *{box-sizing:border-box}
      .ui682-analysis-progress{box-sizing:border-box;max-width:100%!important;min-width:0!important;width:100%!important;overflow:hidden;grid-column:1/-1;flex-basis:100%;clear:both}.ui682-analysis-progress div{min-width:0}.ui682-analysis-progress span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cp704-top .ui682-analysis-progress{margin-left:0!important;margin-right:0!important}
      @media(max-width:999px){.cp704-lead{max-width:760px}.cp704-workspace{grid-template-columns:minmax(0,1fr)}.cp704-herorow{grid-template-columns:minmax(0,1fr)}.cp704-primary,.cp704-secondary{gap:12px}}
      @media(max-width:560px){.cp704-lead{gap:12px;padding:0 0 18px}.cp704-top{display:grid;grid-template-columns:1fr;align-items:start;gap:10px;margin:0 0 2px}.cp704-top-actions{max-width:none;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px}.cp704-reanalyse,.cp704-attended{font-size:12px;padding:10px 10px;width:100%;min-width:0;border-radius:999px}.cp704-desmarcar{justify-self:start;width:auto;padding:6px 4px}.cp704-toolbar{width:100%}.cp704-ico,.cp704-back{min-width:0;padding:9px 4px}.cp704-hero h1{font-size:27px}.cp704-mainrow{grid-template-columns:1fr;gap:12px}.cp704-metrics{grid-template-columns:1fr 1fr}.cp704-msg-item{grid-template-columns:1fr;position:relative}.cp704-copy{justify-self:end}.cp704-actions-grid{grid-template-columns:1fr 1fr}.cp704-card{padding:13px}.cp704-quickbar{grid-template-columns:1fr 1fr;position:sticky;bottom:10px;z-index:5;background:rgba(3,34,43,.78);backdrop-filter:blur(10px);padding:6px;border-radius:14px}.cp704-actions-grid button,.cp704-quickbar button{min-height:46px}.cp704-body{font-size:13px}.cp704-row{padding:8px 0}}
    `;
    document.head.appendChild(css);
  }
  function cp704Text(v, fallback='') { return String(v == null ? fallback : v).trim(); }

  function cp705FormatDateTime(v){
    const raw=String(v||'').trim();
    if(!raw) return '';
    // Datas do histórico do WhatsApp vêm como DD/MM/AAAA (padrão BR) — o construtor nativo
    // Date() interpreta "02/06/2026" como MM/DD (mês 02, dia 06) e inverte dia/mês.
    // Por isso o formato BR precisa ser parseado explicitamente antes de cair no Date() genérico.
    const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
    let d;
    if(br){
      const [, dd, mm, yy, hh, mi] = br;
      const ano = yy.length===2 ? 2000+Number(yy) : Number(yy);
      d = new Date(ano, Number(mm)-1, Number(dd), Number(hh||0), Number(mi||0));
    } else {
      d = new Date(raw);
    }
    if(!Number.isNaN(d.getTime())){
      return d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',', ' •');
    }
    return raw.replace(/T/, ' ').replace(/\.\d{3}Z$/, '').replace(/Z$/, '');
  }
  function cp705PlainText(v){ return String(v||'').replace(/\s+/g,' ').trim(); }
  function cp705HasEvidence(lead,re){
    // Evidência só vem de mensagens/histórico do lead, nunca de resumo gerado pela IA.
    const arrays = [lead?.recentMessages, lead?.timeline, lead?.messages, lead?.history, lead?.mensagens].filter(Array.isArray);
    const txt = arrays.flat().map(m => {
      if(!m) return '';
      if(typeof m === 'string') return m;
      return String(m.text || m.body || m.message || m.mensagem || '');
    }).join(' ').toLowerCase();
    return re.test(txt);
  }
  function cp705SanitizeFactText(text, lead){
    let out=cp705PlainText(text);
    // Blindagem: marcadores de teste/instrução do Cérebro nunca podem vazar para o texto final
    // (ex.: "TESTE-CEREBRO" que o corretor coloca pra checar se o Cérebro está ativo).
    out = out.replace(/\s*TESTE[\s\-–—_]?C[EÉ]REBRO\s*/gi, ' ').replace(/\s{2,}/g, ' ').trim();
    try{
      const pn = (typeof ui682PrimeiroNomeLead==='function') ? ui682PrimeiroNomeLead(lead) : '';
      if(pn && /^retomando nosso contato/i.test(out)) out = `${pn}, ${out.charAt(0).toLowerCase()}${out.slice(1)}`;
    }catch(_){}
    const hasFin=cp705HasEvidence(lead,/\b(financi|fgts|caixa|banco|entrada|parcela|parcelamento|renda|cr[eé]dito|aprova|juros|simula)\b/i);
    if(!hasFin){
      out=out
        .replace(/,?\s*com dúvidas sobre financiamento e parcelas/ig,'')
        .replace(/\s*e pediu esclarecimentos sobre valor, financiamento e parcelas/ig,'')
        .replace(/\s*com ponto financeiro citado no histórico/ig,'')
        .replace(/\b(viabilidade financeira|trava financeira|encaixe financeiro|financeiro|financeira|financiamento|financiamentos|parcelamento|parcelas|parcela|FGTS|Caixa|banco|aprovação de crédito|crédito)\b/ig,'perfil de compra')
        .replace(/\b(dúvidas?|dúvida)\s+sobre\s+perfil de compra/ig,'perfil de compra ainda não confirmado')
        .replace(/perfil de compra\s+e\s+perfil de compra/ig,'perfil de compra')
        .replace(/perfil de compra\s*,\s*perfil de compra/ig,'perfil de compra');
    }
    out = out
      .replace(/^\s*(Conversa|WhatsApp|Cliente|Lead|Contato|Arquivo|Zip)\s*,\s*/i, '')
      .replace(/\bte passar coisa solta\b/gi, 'sugerir o próximo passo')
      .replace(/\bte mandar opção solta\b/gi, 'sugerir o próximo passo')
      .replace(/\bopções soltas\b/gi, 'sugestões desalinhadas ao teu objetivo');
    return out.replace(/\s{2,}/g,' ').replace(/\s+([,.])/g,'$1').trim();
  }
  function cp705Short(v, n=150){
    const t=cp705PlainText(v);
    return t.length>n ? t.slice(0,n-3).trim()+'...' : t;
  }

  function cp707ObservationFacts(lead){
    const a=lead?.analysis||{}, mem=a.memoria||a.memoriaSugerida||{};
    const msgs=Array.isArray(lead?.recentMessages)?lead.recentMessages:[];
    const textos=[mem.observacoes,a.summary,a.nextAction,a.risk,a.clientProfile]
      .concat(msgs.slice(-20).map(m=>m?.text||m?.body||m?.message||''))
      .map(cp705PlainText).filter(Boolean);
    const joined=textos.join(' \n ');
    const norm=joined.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const mulher=/\b(mulher|esposa)\b/.test(norm);
    const negou=/(nao|não|sem)\s.{0,28}\b(quis|quer|aprovou|aprova|aprovacao|aceitou|aceita|gostou|autorizou|topou)\b|\b(nao quis|nao aprovou|nao gostou|nao topou)\b/.test(norm);
    if(mulher && negou){
      const pessoa=/\besposa\b/.test(norm)?'esposa':'mulher';
      const produto=cp704Text(lead?.product || a?.modeloComercial?.oportunidade?.produto || lead?.product || 'o imóvel');
      const primeiro=cp704Text(lead?.name,'').split(/\s+/)[0]||'';
      return {
        tipo:'decisor_negou',
        situacao:'Em decisão',
        motivo:`A ${pessoa} não aprovou a compra neste momento.`,
        insight1:`Fato: a decisão depende da ${pessoa}.`,
        insight2:`Inferência: ainda não é perda confirmada.`,
        insight3:`Ação: retomada leve e objetiva.`,
        next:`Retomar com leveza para confirmar se houve mudança na decisão da ${pessoa}, sem criar nova objeção.`,
        msgA:`${primeiro}, entendi o ponto sobre a decisão de vocês. Como ficou em aberto, queria saber se houve alguma mudança nesse cenário ou se prefere que eu deixe o ${produto} em acompanhamento por enquanto.`.trim(),
        msgB:`${primeiro}, obrigado por me atualizar. Vou respeitar esse momento e deixar a oportunidade em aberto. Se ajudar, depois posso organizar uma comparação simples com opções do mesmo perfil.`.trim(),
        msgC:`${primeiro}, para eu conduzir do jeito certo: quer que eu mantenha contato mais adiante sobre o ${produto} ou prefere que eu aguarde você me chamar quando tiver uma posição melhor?`.trim()
      };
    }
    return null;
  }

  function cp705MessagesReady(msgs){
    const vals=[msgs?.a,msgs?.b,msgs?.c].map(cp705PlainText);
    if(vals.some(v=>!v)) return false;
    return !vals.some(v=>/atualize a an[aá]lise comercial|gerar a resposta|resposta recomendada|resposta mais suave|resposta mais direta/i.test(v));
  }

  function cp704Modelo(lead){ try{return ui670ModeloComercial(lead)||{};}catch(_){return lead?.analysis?.modeloComercial||{};} }
  function cp704Produto(lead, mc){ return cp704Text(mc?.oportunidade?.produto || (typeof produtosLabel==='function'?produtosLabel(lead):lead?.product) || lead?.product || 'Produto não identificado'); }
  function cp704Situacao(mc, lead){
    const obsFact=cp707ObservationFacts(lead);
    if(obsFact?.situacao) return obsFact.situacao;
    const st=cp704Text(mc?.oportunidade?.status || lead?.etapa || 'em análise').toLowerCase();
    if(/decis/.test(st)) return 'Em decisão';
    if(/negocia/.test(st)) return 'Em negociação';
    if(/analise|finance/.test(st)) return 'Análise financeira';
    if(/compar/.test(st)) return 'Em comparação';
    if(/interesse/.test(st)) return 'Com interesse';
    // v904: só existe "Arquivado" como desfecho — Vendido/Perdido/Geladeira viram Arquivado.
    if(/perdid|encerr|ganh|vend|geladeira/.test(st)) return 'Arquivado';
    return cp704Text(mc?.oportunidade?.status || lead?.etapa || 'Em descoberta');
  }
  // v818: etapa da jornada em linguagem simples, com passo (1..6) e cor que esquenta pro
  // verde conforme aproxima o fechamento. Fonte: status da oportunidade / etapa do lead.
  function cp704Jornada(lead, mc){
    const normal = (typeof normalizarEtapa==='function') ? normalizarEtapa(lead?.etapa) : String(lead?.etapa||'');
    // v904: Vendido/Perdido/Geladeira não existem mais como desfecho separado — todos "Arquivado".
    if(normal===ETAPA_ARQUIVADO)
      return { label:'Arquivado', passo:0, cor:'#9fb1bd', bg:'rgba(159,177,189,.12)', br:'rgba(159,177,189,.40)' };
    const st = String(mc?.oportunidade?.status || lead?.etapa || 'descoberta').toLowerCase();
    const etapas = [
      { re:/decis|fecha|ganho|vend/, label:'Decidindo',              passo:6, cor:'#2fe27a', bg:'rgba(47,226,122,.14)',  br:'rgba(47,226,122,.50)' },
      { re:/negocia/,                label:'Negociando',             passo:5, cor:'#54c98a', bg:'rgba(84,201,138,.15)',  br:'rgba(84,201,138,.50)' },
      { re:/analise|finance/,        label:'Vendo se cabe no bolso', passo:4, cor:'#54c9a0', bg:'rgba(84,201,160,.14)',  br:'rgba(84,201,160,.45)' },
      { re:/compar/,                 label:'Comparando opções',      passo:3, cor:'#33c2cc', bg:'rgba(51,194,204,.13)',  br:'rgba(51,194,204,.45)' },
      { re:/interess/,               label:'Interessado',            passo:2, cor:'#5aa9e6', bg:'rgba(90,169,230,.13)',  br:'rgba(90,169,230,.45)' },
      { re:/descob|novo/,            label:'Conhecendo',             passo:1, cor:'#9fb1bd', bg:'rgba(159,177,189,.12)', br:'rgba(159,177,189,.40)' }
    ];
    return etapas.find(e => e.re.test(st)) || etapas[etapas.length-1];
  }
  function cp704JornadaBadge(lead, mc){
    const j = cp704Jornada(lead, mc);
    const temPasso = j.passo>=1 && j.passo<=6;
    const rotulo = j.label + (temPasso ? ` · passo ${j.passo} de 6` : '');
    // Perdido / Arquivado (passo 0) não é um passo da jornada: pill simples, sem barra.
    if(!temPasso){
      return `<span class="cp704-pill cp704-etapa cp704-etapa-plain" style="background:${j.bg}!important;border-color:${j.br}!important;color:var(--text)!important">${escapeHtml(rotulo)}</span>`;
    }
    // Barra de progresso em gradiente no mesmo pill: um único gradiente frio→coral→verde
    // (cores já usadas no app) com comprimento fixo; cada card revela só a fatia X/6 via
    // clip-path. O pontinho branco marca a borda do avanço — pulsa nos passos 1..5 e fica
    // parado no passo 6 (venda concluída).
    const pct = (j.passo/6*100).toFixed(2) + '%';
    const completo = j.passo===6;
    return `<span class="cp704-pill cp704-etapa cp704-etapa-prog${completo?' is-completo':''}" style="--cp-etapa-pct:${pct}">`
      + `<span class="cp704-etapa-fill"></span>`
      + `<span class="cp704-etapa-edge"></span>`
      + `<span class="cp704-etapa-label">${escapeHtml(rotulo)}</span>`
      + `</span>`;
  }
  // v889 — no lugar do "passo X de 6" (funil que o dono mandou tirar): barra de INTERESSE do
  // cliente = mensagens DO CLIENTE (não as minhas) sobre o teto CP_TETO_BARRA_INTERESSE (=100
  // cheia). Mede engajamento real, não etapa. Largura total.
  function cp704BarraInteresse(lead){
    const teto = (typeof CP_TETO_BARRA_INTERESSE==='number') ? CP_TETO_BARRA_INTERESSE : 100;
    // Só conta com o histórico COMPLETO carregado. Ao abrir, o lead vem com um recorte de
    // mensagens da lista; o número real chega ~700ms depois (getLeadDetail). Sem isto, a barra
    // "piscava" (ex.: 4 -> 19). Enquanto não chega, mostra "contando…" em vez de um número falso.
    const pronto = !!(lead && lead.historyLoaded);
    const n = (pronto && typeof mensagensDoCliente==='function') ? mensagensDoCliente(lead) : 0;
    const pct = pronto ? Math.max(0, Math.min(100, Math.round(n/teto*100))) : 0;
    const label = pronto ? (n===1 ? '1 mensagem do cliente' : `${n} mensagens do cliente`) : 'contando mensagens…';
    return `<div class="cp704-interesse" style="width:100%;margin:2px 0 6px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:5px">
          <span style="font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)">Interesse do cliente</span>
          <b style="font-size:12px;font-weight:950;color:${pronto?'var(--text)':'var(--muted)'}">${escapeHtml(label)}</b>
        </div>
        <div style="height:9px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden">
          <i style="display:block;height:100%;width:${pct}%;border-radius:999px;background:linear-gradient(90deg,var(--morno),var(--acao));transition:width .35s ease${pronto?'':';opacity:.5'}"></i>
        </div>
      </div>`;
  }
  function cp704Impedimento(lead, mc){
    const a=lead?.analysis||{}, mem=a.memoria||a.memoriaSugerida||{};
    if(!analiseAtualValida752(a)) return 'Análise comercial pendente nesta versão. Reanalise para evitar informação antiga.';
    return cp705SanitizeFactText(cp704Text(mc?.oportunidade?.motivo || mc?.acao?.motivo || a.risk || a?.diagnostico?.objecaoPrincipal || mem.pontosSensiveis || 'Impedimento ainda não identificado.'), lead);
  }
  function cp704Next(lead, mc){
    const a=lead?.analysis||{};
    if(!analiseAtualValida752(a)) return 'Atualize a análise comercial para gerar a próxima ação sem usar dados antigos.';
    return cp705SanitizeFactText(cp704Text(mc?.acao?.descricao || a.nextAction || a.melhorPergunta || 'Atualize a análise comercial para gerar a próxima ação.'), lead);
  }
  function cp704DataHora(m){
    return cp705FormatDateTime([m?.date,m?.time].filter(Boolean).join(' ') || cp704Text(m?.displayTime || m?.createdAt || m?.iso || ''));
  }
  function cp704RecentMessages(lead, max=4){
    const msgs=Array.isArray(lead?.recentMessages)?lead.recentMessages:[];
    return msgs.filter(m=>cp704Text(m?.text)).slice(-max).reverse();
  }
  // Chave cronológica a partir do HORÁRIO EXIBIDO (date+time BR) — consistente entre mensagens
  // importadas e manuais/copiadas. Antes a ordem vinha do `iso`, que nas manuais é UTC e não
  // batia com o horário mostrado, embaralhando a linha do tempo (ex.: 11:56, 12:24, 11:58, 11:58).
  function cp704MsgTsCronologico(m){
    const d=String(m?.date||'').trim(), t=String(m?.time||'').trim();
    const br=d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if(br){ const ano=br[3].length===2?2000+Number(br[3]):Number(br[3]); const hm=t.match(/^(\d{1,2}):(\d{2})/);
      return Date.UTC(ano,Number(br[2])-1,Number(br[1]),hm?Number(hm[1]):0,hm?Number(hm[2]):0); }
    const ts=Date.parse(String(m?.iso||'')); return Number.isFinite(ts)?ts:0;
  }
  function cp704TimelineHtml(lead){
    const all=(Array.isArray(lead?.recentMessages)?lead.recentMessages.filter(m=>cp704Text(m?.text)):[])
      .slice().sort((a,b)=>cp704MsgTsCronologico(a)-cp704MsgTsCronologico(b) || (Number(a?.order||0)-Number(b?.order||0)));
    const total=all.length;
    const limite = state.cp704HistoryFull ? total : Math.max(4, Math.min(Number(state.timelineVisibleCount||4), total || 4));
    const msgs=all.slice(-limite).reverse();
    const pn=cp704Text(lead?.name).toLowerCase().split(/\s+/)[0]||'';
    if(!msgs.length) return '<div class="empty">Sem mensagens recentes.</div>';
    const faltam = Math.max(0, total - msgs.length);
    const btn = faltam>0 ? `<button type="button" class="cp704-full-btn" onclick="cp704HistoryToggle()">Ver conversa completa (${total} mensagens)</button>` : '';
    return msgs.map((m,i)=>{
      // O histórico é a CONVERSA (você × cliente pelo WhatsApp). O que foi acrescentado como
      // observação/atendimento manual NÃO é fala do cliente — é etiquetado "Observação" pra
      // não parecer que o cliente disse. (Antes, ehMsgDoCliente tratava qualquer autor
      // desconhecido como cliente e a observação aparecia com o nome dele.)
      const tipo=String(m?.type||'').toLowerCase();
      const ehObs = tipo==='observacao_manual' || tipo==='atendimento' || tipo==='nota';
      const ehEnviada = tipo==='mensagem_enviada';
      const ehResumo = tipo==='resumo' || String(m?.source||'')==='incremental';
      let who, dotCls='', wrapCls='';
      if(ehObs){ who='Observação'; dotCls='obs'; wrapCls=' cp704-tmsg-obs'; }
      else if(ehEnviada){ who='Você'; dotCls='you'; }
      else if(ehResumo){ who='Resumo'; dotCls='sys'; wrapCls=' cp704-tmsg-sys'; }
      else {
        const cliente=(typeof ehMsgDoCliente==='function') ? ehMsgDoCliente(m,pn) : false;
        who=cliente ? cp704Text(lead?.name,'Contato').split(/\s+/)[0] : 'Você';
        dotCls=cliente?'':'you';
      }
      // v1025 — o snapshot da proposta (itemManual.proposta, ver api/reanalisar-lead.js) e a
      // função abrirPropostaSalva() (js/proposta.js) já existiam prontos; só faltava esta linha
      // do histórico virar clicável pra chamar ela ao tocar — por isso nunca abria.
      let propAttr = '', propHint = '';
      if(tipo==='proposta' && m.proposta){
        who='Proposta'; dotCls='prop'; wrapCls=' cp704-tmsg-prop';
        propAttr = ` onclick='cp704AbrirPropostaSalva(${JSON.stringify(String(lead?.id||''))},${JSON.stringify(String(m.iso||''))})' title="Toque para reabrir a proposta"`;
        // v1029 — o "title" (dica só de hover) nunca aparece em celular — o dono confirmou que
        // quer exatamente o que já existia (abrir a proposta pronta, com o Imprimir/Salvar PDF
        // já disponível ali), só faltava deixar claro, na própria tela, que o balão é clicável.
        propHint = '<small class="cp704-prop-hint">Toque para abrir e imprimir ›</small>';
      }
      // v940 — bug real: cortar a mensagem em 520 caracteres cortava ela NO MEIO DA FRASE (ex.:
      // "...transferir o financiamento para outro comprador recebendo" — sem o resto: "o que
      // pagou nele até então..."). Esta é a "Últimas mensagens"/histórico completo — o propósito
      // dela é mostrar a conversa REAL; sem corte de tamanho nenhum.
      return `<div class="cp704-tmsg${wrapCls}"${propAttr}><span class="cp704-dot ${dotCls}"></span><div><b>${escapeHtml(who)}</b><p>${escapeHtml(cp704Text(m.text))}</p><small>${escapeHtml(cp704DataHora(m))}</small>${propHint}</div></div>`;
    }).join('') + btn;
  }
  // v1025 — abre a proposta salva na timeline (busca o snapshot em state.lead.recentMessages
  // pelo mesmo `iso` da mensagem clicada e delega pro abridor real em js/proposta.js).
  window.cp704AbrirPropostaSalva = function(leadId, iso){
    const lead = (state.lead && String(state.lead.id) === String(leadId)) ? state.lead : null;
    const m = (Array.isArray(lead?.recentMessages) ? lead.recentMessages : []).find(x => x?.iso === iso && x?.proposta);
    if(!m){ toast('Não encontrei os dados dessa proposta pra reabrir.'); return; }
    if(typeof window.abrirPropostaSalva === 'function') window.abrirPropostaSalva(leadId, cp704Text(lead?.name), m.proposta);
    else toast('Gerador de proposta indisponível nesta versão.');
  };
  function cp704DetailRows(lead,mc){
    const a=lead?.analysis||{}, mem=a.memoria||a.memoriaSugerida||{};
    // v935 — quando o cliente cita MAIS DE UMA unidade específica (lote/quadra/apartamento),
    // "Produto" sozinho mostra só o empreendimento genérico e a escolha real do cliente se
    // perde (bug reportado pelo dono: conversa tinha os 3 lotes escolhidos, a análise não).
    // produtosInteresse (array já gerado pela análise, ver api/_pipeline.js) lista cada unidade
    // específica quando há mais de uma — aqui só aparece nesse caso, pra não duplicar "Produto".
    const produtosInteresse = Array.isArray(a.produtosInteresse) ? a.produtosInteresse.map(cp704Text).filter(Boolean) : [];
    const rows=[
      ['Papel do contato',mc?.contato?.papel || a.tipoContato],
      ['Comprador final',mc?.oportunidade?.compradorFinal || mc?.contato?.compradorFinal],
      ['Produto',cp704Produto(lead,mc)],
      ['Unidades específicas de interesse',produtosInteresse.length>1?produtosInteresse.join('; '):''],
      ['Resultado',mc?.oportunidade?.resultado || lead?.etapa],
      ['Permuta / entrada com imóvel',/^não identificado$/i.test(cp704Text(a?.diagnostico?.pendenciaFinanceira))?'':a?.diagnostico?.pendenciaFinanceira],
      ['Último compromisso',mc?.contexto?.ultimoCompromisso || a?.diagnostico?.pendencia],
      ['Impedimento principal',mc?.acao?.motivo || a.risk || a?.diagnostico?.objecaoPrincipal],
      ['Pedido do cliente ainda sem resposta direta',/^(nenhum|não identificado)$/i.test(cp704Text(a?.diagnostico?.pedidoSemResposta))?'':a?.diagnostico?.pedidoSemResposta],
      ['Preferências',mem.preferencias]
    ].filter(r=>cp704Text(r[1]));
    return rows.map(([k,v])=>`<div class="cp704-row"><small>${escapeHtml(k)}</small><div>${escapeHtml(cp704Text(v))}</div></div>`).join('') || '<div class="empty">Sem detalhes comerciais consolidados.</div>';
  }
  function cp704Insights(lead,mc){
    const a=lead?.analysis||{}, mem=a.memoria||a.memoriaSugerida||{};
    if(!analiseAtualValida752(a)) return [
      'Análise comercial precisa ser atualizada nesta versão.',
      'As mensagens antigas foram bloqueadas para evitar mistura de contexto.',
      'Use Reanalisar agora para gerar leitura nova somente pela conversa.'
    ];
    const arr=[];
    const obsFact=null;
    if(obsFact) return [obsFact.insight1,obsFact.insight2,obsFact.insight3].filter(Boolean);
    const facts=Array.isArray(a.fatosConfirmados)?a.fatosConfirmados.filter(Boolean).slice(0,2):[];
    const infs=Array.isArray(a.inferenciasIA)?a.inferenciasIA.filter(Boolean).slice(0,1):[];
    if(facts.length || infs.length) return facts.concat(infs).map(x=>cp705Short(cp705SanitizeFactText(x,lead),96)).slice(0,3);
    const imp=cp704Impedimento(lead,mc);
    if(imp && !/não identificado/i.test(imp)) arr.push(imp.length>90 ? imp.slice(0,87)+'...' : imp);
    const rel=cp704Text(mc?.relacionamento?.motivo || mem.pessoasDecisao);
    if(rel) arr.push(rel.length>90 ? rel.slice(0,87)+'...' : rel);
    const next=cp704Next(lead,mc);
    if(next) arr.push(next.length>96 ? next.slice(0,93)+'...' : next);
    const fallback=['A IA ainda precisa consolidar os sinais deste lead.','Atualize a análise quando houver novas mensagens.','Mantenha a próxima ação ligada ao último compromisso.'];
    return [...arr, ...fallback].filter(Boolean).slice(0,3);
  }
  function cp704Msgs(lead){
    const a=lead?.analysis||{};
    const m=(typeof mensagensDaAnalise==='function') ? mensagensDaAnalise(a) : {};
    return {
      a:cp705SanitizeFactText(cp704Text(m.a || ''), lead),
      b:cp705SanitizeFactText(cp704Text(m.b || ''), lead),
      c:cp705SanitizeFactText(cp704Text(m.c || ''), lead),
      aLabel:cp704Text(m.aLabel || 'Recomendada'),
      bLabel:cp704Text(m.bLabel || 'Alternativa'),
      cLabel:cp704Text(m.cLabel || 'Direta ao ponto')
    };
  }
  // v724-6: mostra o motivo real de a mensagem não ter sido gerada, direto na
  // tela — sem precisar abrir o DevTools. Só aparece quando há algo pra dizer.
  function cp724DiagRecusaHtml(a,msgsFront){
    a=a||{};
    const linhas=[];
    const mode=cp704Text(a.mode);
    if(mode==='erro_api'||mode==='reconciliacao_local') linhas.push('Modo: '+mode+(a.error?(' — '+cp704Text(a.error)):''));
    if(cp704Text(a.avisoReanalise)) linhas.push('Aviso do servidor: '+cp704Text(a.avisoReanalise));
    const vsug=Array.isArray(a.validacaoSugestoes)?a.validacaoSugestoes.filter(Boolean):[];
    if(vsug.length) linhas.push('Validação: '+cp704Text(vsug[vsug.length-1]));
    const bruto=(a.messages&&typeof a.messages==='object')?a.messages:{};
    const brutoA=cp704Text(bruto.a), brutoB=cp704Text(bruto.b), brutoC=cp704Text(bruto.c);
    const diagMsg=cp704Text(a?.diagnostico?.mensagemQueEuEnviariaHoje);
    if(!brutoA&&!brutoB&&!brutoC&&!diagMsg) linhas.push('A IA não devolveu nenhuma das 3 mensagens nesta reanálise.');
    else if(brutoA||diagMsg){
      const faltando=[!brutoB&&'B (mais suave)',!brutoC&&'C (mais direta)'].filter(Boolean);
      if(faltando.length) linhas.push('A IA gerou a mensagem A, mas faltou: '+faltando.join(' e ')+'.');
    }
    if(!linhas.length) return '';
    return `<div style="margin-top:8px;padding:8px 10px;border:1px dashed rgba(255,255,255,.18);border-radius:10px;font-size:11px;color:var(--muted);line-height:1.5">${linhas.map(l=>escapeHtml(l)).join('<br>')}</div>`;
  }
  window.cp704SelectedMsg='a';
  window.cp704SelectMsg=function(k){
    window.cp704SelectedMsg = ['a','b','c'].includes(k)?k:'a';
  };
  function cp704GetMessage(k){ const el=document.querySelector(`.cp704-msg-item[data-key="${k||window.cp704SelectedMsg}"] p`); return cp704Text(el?.innerText || el?.textContent); }
  window.cp704CopyMsg=async function(k){
    const msg=cp704GetMessage(k); if(!msg){toast('Mensagem não encontrada.');return;}
    try{ await navigator.clipboard.writeText(msg); toast('Mensagem copiada.'); }
    catch(_){ const ta=document.createElement('textarea');ta.value=msg;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Mensagem copiada.'); }
    const leadId=state.lead?.id;
    // v985 — este É o botão real de copiar usado de dentro do lead ("Fazer agora" > Copiar).
    // Antes só chamava registrarMensagemEnviada (registra ATENDIMENTO), sem nunca gravar o
    // evento "mensagem_copiada" que o Desempenho conta — por isso "Mensagens copiadas" ficava
    // zerado mesmo copiando direto daqui o tempo todo. Registra ANTES de registrarMensagemEnviada
    // pra já estar salvo quando ela recarrega a lista de leads (Desempenho lê dessa lista).
    if(leadId){
      try{
        await fetch("./api/lead-update", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ id:leadId, action:"aprendizado", evento:"mensagem_copiada", detalhes:{ de:"fazer_agora", opcao:k||window.cp704SelectedMsg||'a' } })
        }).catch(()=>{});
      }catch(_){}
    }
    try{ registrarMensagemEnviada(leadId, msg); }catch(_){}
  };
  window.cp704OpenWhats=function(){
    const lead=state.lead||{}; const msg=cp704GetMessage(window.cp704SelectedMsg);
    if(!lead.phone){ cp704CopyMsg(window.cp704SelectedMsg); toast('Telefone não identificado. Mensagem copiada.'); return; }
    const url=(typeof whatsappLink==='function') ? whatsappLink(lead.phone,msg) : `https://wa.me/${String(lead.phone).replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
    window.open(url,'_blank');
  };
  window.cp704HistoryToggle=async function(){
    try{
      if(!state.lead?.id){ toast('Abra um lead primeiro.'); return; }
      let lead = state.lead;
      if(!lead.historyLoaded){
        toast('Carregando conversa completa…');
        lead = await getLeadDetail(lead.id, true);
        if(String(state.lead?.id||'') === String(lead.id||'')){
          state.lead = lead;
          state.analysis = lead.analysis || state.analysis;
        }
      }
      state.cp704HistoryFull = true;
      state.timelineVisibleCount = Math.max(Number(totalMensagensLead(lead)||0), Array.isArray(lead.recentMessages)?lead.recentMessages.length:0, 9999);
      renderLeadFoco(state.lead || lead);
      // v1024 — "Ver conversa completa" (ver mais) reconstrói o card do lead inteiro pra trazer
      // as mensagens completas — só que isso recriava #cp704HistCard sempre com "hidden" (o
      // estado padrão no HTML), perdendo se o corretor já tinha aberto "Mensagens" antes. Dono
      // via a tela "voltar pro topo e apagar" as mensagens que já apareciam, precisando clicar em
      // "Mensagens" de novo pra ver a lista completa que já tinha carregado. O código antigo
      // tentava rolar até lá, mas procurava a classe ERRADA (.cp704-details, usada só em
      // "Detalhes comerciais") — nunca encontrava #cp704HistCard, então nunca rolava de verdade.
      requestAnimationFrame(()=>{
        const hist=document.querySelector('#cp704HistCard');
        if(hist){ hist.hidden=false; hist.scrollIntoView({behavior:'smooth',block:'start'}); }
      });
    }catch(err){
      toast('Não consegui carregar o histórico completo: ' + (err?.message || err));
    }
  };
  window.cp715EditarLead = function(id){
    const leadAtual = (state?.lead && String(state.lead.id) === String(id)) ? state.lead : null;
    const listas = [state?.carteiraLeads, state?.itemsAtivos, state?.todosLeads, state?.leadsRecentes].filter(Array.isArray);
    const lead = leadAtual || listas.flat().find(l => String(l?.id||'') === String(id)) || { id };
    if(typeof abrirEditarLead === 'function') abrirEditarLead(String(id), String(lead?.name||''), String(lead?.phone||lead?.telefone||''));
    else toast('Editor de lead indisponível nesta versão.');
  };
  function cp704QuickActions(lead,mc){
    const id=JSON.stringify(String(lead?.id||'')); const name=(typeof safeJson==='function')? safeJson(lead?.name||'') : JSON.stringify(String(lead?.name||'')); const prod=(typeof safeJson==='function')? safeJson(cp704Produto(lead,mc)) : JSON.stringify(cp704Produto(lead,mc));
    // Só "Arquivar" como desfecho (v904): sem Vendido/Perdido/Geladeira. "Excluir" fica no Perigo.
    return `<div class="cp704-actions-group"><h3>Comerciais</h3><div class="cp704-actions-grid"><button type="button" onclick='abrirPropostaComLead(${name},${prod},${id})'>Gerar proposta</button></div></div>
    <div class="cp704-actions-group"><h3>Gestão</h3><div class="cp704-actions-grid"><button type="button" onclick='cp715EditarLead(${id})'>Editar lead</button><button type="button" onclick='arquivarLead(${id},${name})'>Arquivar</button></div></div>
    <div class="cp704-actions-group"><h3>Perigo</h3><div class="cp704-actions-grid"><button type="button" class="cp704-danger" onclick='excluirLeadDefinitivo(${id},${name})'>Excluir definitivamente</button></div></div>`;
  }
  // v908: as ações (Proposta/Arquivar/Excluir/Mensagens) subiram pra barra de ícones do topo.
  // O histórico ("Últimas mensagens") abre num card recolhível, alternado pelo ícone "Mensagens".
  window.cp704ToggleHistorico=function(){
    const s=document.querySelector('#cp704HistCard'); if(!s) return;
    s.hidden=!s.hidden;
    if(!s.hidden) s.scrollIntoView({behavior:'smooth',block:'start'});
  };

// Atualização #724-2: card "O que mudou" — antes → agora + por que importa.
// Só aparece quando a análise traz mudanças reais; lead sem mudança não mostra o card.

function cp718LeituraComercialHtml(a,lead){
  const lc=(a&&a.leituraComercial&&typeof a.leituraComercial==='object')?a.leituraComercial:{};
  const itens=[
    ['Interpretação', lc.interpretacao],
    ['Por que importa', lc.porQueImporta],
    ['O que destravar', lc.oQueDestravar],
    ['Movimento recomendado', lc.movimentoRecomendado],
    ['Erro a evitar', lc.erroEvitar],
    ['Mensagem com mais chance', lc.mensagemCurtaChance]
  ].filter(([,v])=>String(v||'').trim());
  if(!itens.length){
    return escapeHtml(cp705SanitizeFactText(cp704Text((a.memoria||a.memoriaSugerida||{}).observacoes || a.summary || 'Sem leitura comercial consolidada.'),lead));
  }
  return `<div class="cp718-lc">${itens.map(([lab,val])=>`<div class="cp718-lc-row"><b>${escapeHtml(lab)}</b><span>${escapeHtml(cp705SanitizeFactText(cp704Text(val),lead))}</span></div>`).join('')}</div>`;
}

function cp717MudancasHtml(a){
  const arr=Array.isArray(a?.mudancas)?a.mudancas.filter(m=>m&&String(m.antes||'').trim()&&String(m.agora||'').trim()).slice(0,3):[];
  if(!arr.length) return '';
  const itens=arr.map(m=>`<div class="cp704-step"><span>🔄</span><p><b>${escapeHtml(String(m.dimensao||'Mudança'))}:</b> ${escapeHtml(String(m.antes))} → ${escapeHtml(String(m.agora))}${String(m.porQueImporta||'').trim()?`<br><small style="opacity:.75">Por que importa: ${escapeHtml(String(m.porQueImporta))}</small>`:''}</p></div>`).join('');
  return `<section class="cp704-card"><div class="cp704-card-title"><h2>O que mudou</h2></div>${itens}</section>`;
}

// Data/hora da última ANÁLISE ou REANÁLISE do lead (a mais recente disponível). Já
// aparecia no cabeçalho do lead e sumiu num refactor — volta como linha própria. Prioriza
// os carimbos da própria análise (reanálise > geração) e, só na falta deles, usa a última
// atualização do lead.
function cp865UltimaAnaliseISO(lead, a){
  // Só carimbos da PRÓPRIA análise. NÃO usa updatedAt/atualizadoEm: marcar/desmarcar atendimento
  // atualiza a linha e isso fazia a "Última análise" mudar de horário sem ter reanalisado (v896).
  const primarios = [a?.reanalisadoEm, a?.geradoEm, a?.analisadoEm, a?.iaComercialV2?.geradoEm];
  for(const c of primarios){ if(c && Number.isFinite(Date.parse(c))) return c; }
  // v936 — "criadoEm" nunca existiu no objeto lead (o campo real é "createdAt", ver v904+);
  // era um nome de campo errado que nunca resolvia nada, então esse fallback nunca funcionava.
  const fallback = [lead?.analysisReadyAt, lead?.createdAt];
  for(const c of fallback){ if(c && Number.isFinite(Date.parse(c))) return c; }
  return '';
}

function renderLeadFoco(lead){
  cp704Css();
  if(typeof ui667ModoDetalheLead === "function") ui667ModoDetalheLead(true);
  const area=document.querySelector('#leadFocoArea');
  if(!area||!lead) return;
  // v735: o card "Atendidos hoje" pertence apenas à tela Hoje.
  // Ao abrir um lead, removemos qualquer sobra desse card antes de montar o detalhe.
  document.body.classList.add('lead-foco-aberto');
  state.focoLeadId=lead?.id||null;
  const saud=document.querySelector('#saudacao');
  if(saud) saud.style.display='none';
    const a=lead.analysis||{}, mc=cp704Modelo(lead), imped=cp704Impedimento(lead,mc), next=cp704Next(lead,mc), msgs=cp704Msgs(lead);
    const stale=!analiseAtualValida752(a);
    const messagesReady=cp705MessagesReady(msgs);
    const semAcaoUrgente=analiseAtualValida752(a) && String(mc?.acao?.status||'')==='sem-acao-urgente';
    // v1059 — a análise pode recomendar não mandar nenhuma mensagem agora (cliente pediu espaço,
    // "vai pensar", recusa clara) mesmo com as 3 sugestões prontas — elas continuam disponíveis
    // caso o corretor decida contatar mesmo assim, só que com esse aviso em destaque acima.
    const aguardarContato=analiseAtualValida752(a) && a?.recomendacaoContato?.aguardar===true;
    const motivoAguardar=cp704Text(a?.recomendacaoContato?.motivo)||'A leitura da conversa aponta que ainda não é a hora de retomar contato.';
    const needsAnalysis=stale;
    const attended=(typeof ehContatadoHoje==='function') ? ehContatadoHoje(lead) : false;
    // v937 — "Última mensagem" puxa a hora da PRÓPRIA última mensagem real (mesma fonte do
    // histórico), pra não divergir: lead.lastInteractionAt vinha como ISO/UTC e a conversão pra
    // São Paulo deslocava 3h. Fallback pro campo antigo quando não há msg (regra da v887,
    // restaurada — a v934 tinha removido essa metalinha a pedido, mas ela é informação que o
    // corretor precisa pra saber se o cliente respondeu depois da análise).
    const ultimaMsgReal=(typeof cp786UltimaMensagemReal==='function')?cp786UltimaMensagemReal(lead):null;
    const ultimaMsgEm=(ultimaMsgReal&&ultimaMsgReal.m)?cp704DataHora(ultimaMsgReal.m):cp705FormatDateTime(lead.lastInteractionAt || lead.lastActivityAt || lead.lastInteraction || '');
    const analiseEm=cp705FormatDateTime(cp865UltimaAnaliseISO(lead, a));
    const rel=cp704Text(mc?.relacionamento?.status || 'Ativo');
    const urg=cp704Text(mc?.acao?.urgencia || mc?.acao?.prioridade || 'Média');
    // Ranking explicável (v945): mesmo motivo mostrado na Home, agora dentro do card "Fazer
    // agora" — vazio quando nenhum fator real se aplica (nunca inventa razão).
    // v1081 — o detalhe do lead é remontado do zero mais de uma vez (ao abrir vem primeiro o
    // que está na memória e depois o que o servidor devolve; reanalisar e marcar atendimento
    // também remontam). Cada remontagem trocava a área inteira e DESTRUÍA o campo "Registrar
    // observação" que o corretor estava usando: o texto já digitado sumia, o cursor ia parar
    // no corpo da página e a tela pulava de lugar. Guarda o estado do campo (texto, cursor,
    // foco) e a posição da rolagem ANTES de remontar, pra devolver tudo logo depois.
    const cp7ObsAntes = area.querySelector('#cp7ObsTexto');
    const cp7ObsEstado = cp7ObsAntes ? {
      valor: cp7ObsAntes.value,
      inicio: cp7ObsAntes.selectionStart,
      fim: cp7ObsAntes.selectionEnd,
      rolagemInterna: cp7ObsAntes.scrollTop,
      focado: document.activeElement === cp7ObsAntes
    } : null;
    // Só vale restaurar a rolagem quando JÁ havia um detalhe montado aqui (remontagem).
    // Na primeira montagem (vindo do esqueleto) a página deve continuar se comportando como antes.
    const cp7JaTinhaDetalhe = !!area.querySelector('.cp704-lead');
    const cp7RolagemPagina = window.scrollY;
    area.innerHTML=`<div class="cp704-lead">
      <div class="cp704-top"><div class="cp704-toolbar"><button class="cp704-back" onclick="voltarDoLead()" title="Voltar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg><span class="lb">Voltar</span></button><button type="button" class="cp704-ico" onclick='abrirPropostaComLead(${safeJson(lead?.name||'')},${safeJson(cp704Produto(lead,mc))},${JSON.stringify(String(lead?.id||''))})' title="Gerar proposta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg><span class="lb">Proposta</span></button><button type="button" class="cp704-ico" onclick='arquivarLead(${JSON.stringify(String(lead?.id||''))},${safeJson(lead?.name||'')})' title="Arquivar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/></svg><span class="lb">Arquivar</span></button><button type="button" class="cp704-ico" onclick="cp704ToggleHistorico()" title="Últimas mensagens"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></svg><span class="lb">Mensagens</span></button><button type="button" class="cp704-ico" onclick="ui670Reanalisar(this)" title="Reanalisar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v6h6M20 20v-6h-6"/><path d="M20 10a8 8 0 0 0-14-4M4 14a8 8 0 0 0 14 4"/></svg><span class="lb">Reanalisar</span></button><button type="button" class="cp704-ico" onclick="ui670Toggle&&ui670Toggle('ui670SchedulePanel')" title="Agendar retorno"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><span class="lb">Agendar</span></button><button type="button" class="cp704-ico" onclick='cp715EditarLead(${JSON.stringify(String(lead.id||''))})' title="Editar lead"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span class="lb">Editar</span></button>${attended?`<button type="button" class="cp704-ico done" onclick="ui667DesmarcarAtendido(this)" title="Atendido hoje — tocar de novo desmarca"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg><span class="lb">Atendido</span></button>`:`<button type="button" class="cp704-ico" onclick="ui667MarcarAtendido(this)" title="Marcar atendimento"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg><span class="lb">Marcar</span></button>`}</div></div>
      <div class="cp704-herorow">
        <section class="cp704-hero">
          <h1>${escapeHtml(lead.name||'Contato')}</h1>
          <div class="cp704-mainrow"><div class="cp704-situation">${cp704BarraInteresse(lead)}<p>${escapeHtml(cp705SanitizeFactText(imped,lead))}</p></div></div>
          ${analiseEm?`<div class="cp704-metaline">${escapeHtml(`Última análise — ${analiseEm}`)}</div>`:`<div class="cp704-metaline">Sem data registrada</div>`}
          ${ultimaMsgEm?`<div class="cp704-metaline">${escapeHtml(`Última mensagem — ${ultimaMsgEm}`)}</div>`:''}
        </section>
        <section class="cp704-card cp704-obscard">
          <div class="cp704-card-title"><h2>Registrar observação</h2></div>
          <p style="margin:0 0 10px;color:var(--muted);font-size:13px">Registre algo que aconteceu fora do WhatsApp (visita, ligação etc.) — aparece na linha do tempo, ensina o sistema em segundo plano e entra na próxima análise.</p>
          <textarea id="cp7ObsTexto" placeholder="Ex.: Fiz visita com o cliente, ele gostou muito e ficou de marcar visita de novo semana que vem." style="min-height:120px;margin-bottom:16px"></textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
            <button type="button" id="cp7ObsGravarBtn" onclick="cp7ObsToggleGravacao(this)" style="flex:1;min-width:140px;background:transparent;border:1px solid var(--line);border-radius:12px;padding:11px;color:var(--text);font-weight:900;cursor:pointer">Gravar áudio</button>
            <button type="button" onclick="cp7ObsSalvar(this)" style="flex:1;min-width:140px;background:var(--accent);border:0;border-radius:12px;padding:11px;color:var(--on-accent);font-weight:950;cursor:pointer">Salvar observação</button>
          </div>
          <div id="cp7ObsStatus" class="small" style="margin-top:8px;color:var(--muted)"></div>
        </section>
      </div>
      <div class="cp704-workspace">
        <main class="cp704-primary">
          ${needsAnalysis?`<section class="cp704-card cp704-stale"><div class="cp704-card-title"><h2>${stale?'Análise comercial antiga':'Análise comercial pendente'}</h2></div><p>${stale?'Atualize para recalcular oportunidade, próxima ação e mensagem.':'Ainda não há 3 mensagens comerciais válidas para este lead.'}</p><button type="button" onclick="ui670Reanalisar(this)">Atualizar análise comercial</button></section>`:''}
          <section class="cp704-card">
            <div class="cp704-card-title"><h2>Fazer agora</h2></div>
            <div class="cp704-step"><p>${escapeHtml(next)}</p></div>
            <div class="cp704-msg-sub">Sugestões de mensagem · copie a melhor opção</div>
            ${aguardarContato&&messagesReady?`<div class="cp704-empty-analysis" style="margin-bottom:10px"><b>Recomendação agora: aguardar, sem mandar mensagem.</b><span>${escapeHtml(motivoAguardar)}</span></div>`:''}
            ${!messagesReady?(semAcaoUrgente?`<div class="cp704-empty-analysis"><b>Sem mensagem necessária agora.</b><span>Não há ação comercial pendente identificada para este lead no momento.</span></div>`:`<div class="cp704-empty-analysis"><b>Mensagem ainda não gerada.</b><span>${needsAnalysis?'Atualize a análise comercial acima para criar a sugestão correta.':'Toque em "Reanalisar" no topo para criar a sugestão correta.'}</span>${cp724DiagRecusaHtml(a,msgs)}${needsAnalysis?'':'<button type="button" onclick="ui670Reanalisar(this)">Atualizar análise comercial</button>'}</div>`):`
            <div class="cp704-msg-list"><div class="cp704-msg-item" data-key="a"><div class="cp704-msg-head"><span class="cp704-num">1</span><b>${escapeHtml(msgs.aLabel||'Recomendada')}</b></div><p>${escapeHtml(msgs.a)}</p><button class="cp704-copy" onclick="cp704CopyMsg('a')">Copiar</button></div>${msgs.b?`<div class="cp704-msg-item" data-key="b"><div class="cp704-msg-head"><span class="cp704-num">2</span><b>${escapeHtml(msgs.bLabel||'Facilitar decisão')}</b></div><p>${escapeHtml(msgs.b)}</p><button class="cp704-copy" onclick="cp704CopyMsg('b')">Copiar</button></div>`:''}${msgs.c?`<div class="cp704-msg-item" data-key="c"><div class="cp704-msg-head"><span class="cp704-num">3</span><b>${escapeHtml(msgs.cLabel||'Direta ao ponto')}</b></div><p>${escapeHtml(msgs.c)}</p><button class="cp704-copy" onclick="cp704CopyMsg('c')">Copiar</button></div>`:''}</div>`}
          </section>
          ${cp717MudancasHtml(a)}
        </main>
        <aside class="cp704-secondary">
          <div class="cp704-accordions">
            <details class="cp704-details" open><summary>Detalhes comerciais</summary><div class="cp704-body"><div class="cp704-rows">${cp704DetailRows(lead,mc)}</div></div></details>
          </div>
          ${typeof ui670ScheduleHtml==='function'?ui670ScheduleHtml(lead):''}
          ${typeof renderHistoricoContatos==='function'?renderHistoricoContatos(lead):''}
        </aside>
      </div>
      <section class="cp704-card cp704-hist-card" id="cp704HistCard" hidden>
        <div class="cp704-card-title cp704-hist-title"><h2>Últimas mensagens ${Number((typeof totalMensagensLead==='function')?totalMensagensLead(lead):0)||''}</h2><button type="button" class="cp704-copy-history" onclick="copiarHistoricoLead()">Copiar histórico</button></div>
        <div class="cp704-timeline">${cp704TimelineHtml(lead)}</div>
      </section>
    </div>`;
  // v1081 — devolve a observação em andamento pro campo recém-criado. Sem isto, salvar ficava
  // impossível: o corretor escrevia, a tela se remontava sozinha por baixo e o texto sumia
  // (ele só conseguia na 3ª tentativa, quando o lead já estava em cache e a remontagem
  // acontecia antes dele começar a digitar).
  if(cp7ObsEstado && (cp7ObsEstado.valor || cp7ObsEstado.focado)){
    const cp7ObsDepois = area.querySelector('#cp7ObsTexto');
    if(cp7ObsDepois){
      cp7ObsDepois.value = cp7ObsEstado.valor;
      cp7ObsDepois.scrollTop = cp7ObsEstado.rolagemInterna || 0;
      if(cp7ObsEstado.focado){
        // preventScroll: devolver o foco não pode ser mais um motivo pra tela pular.
        try{ cp7ObsDepois.focus({ preventScroll:true }); }catch(_){ cp7ObsDepois.focus(); }
        try{ cp7ObsDepois.setSelectionRange(cp7ObsEstado.inicio, cp7ObsEstado.fim); }catch(_){}
      }
    }
  }
  // A remontagem troca a altura da área e o navegador reposiciona a página sozinho — é o
  // "a tela pulou pra baixo" relatado pelo dono. Volta pra onde ele estava.
  if(cp7JaTinhaDetalhe && Math.abs(window.scrollY - cp7RolagemPagina) > 2){
    try{ window.scrollTo({ top: cp7RolagemPagina, behavior: "auto" }); }catch(_){ window.scrollTo(0, cp7RolagemPagina); }
  }
  return null;
}

window.renderLeadFoco = renderLeadFoco;


// ============ AGENDA / RETOMADAS ============
function urgenciaDeDias(d){
  if(d == null) return null;
  if(d >= 7) return { nivel: "alto", label: d+" dias parado" };
  if(d >= 3) return { nivel: "medio", label: d+" dias parado" };
  if(d >= 1) return { nivel: "baixo", label: d+"d sem retorno" };
  return null;
}

function tipoDeCompromisso(oQue){
  const s = String(oQue||"").toLowerCase();
  if(/visita|mostrar|ver o im[óo]vel|conhecer/.test(s)) return { icone: "", tipo: "Visita" };
  if(/caf[eé]/.test(s)) return { icone: "", tipo: "Café" };
  if(/almo[çc]o/.test(s)) return { icone: "", tipo: "Almoço" };
  if(/jantar/.test(s)) return { icone: "", tipo: "Jantar" };
  if(/ligar|liga[çc][ãa]o|telefonar|chamada/.test(s)) return { icone: "", tipo: "Ligação" };
  if(/reuni[ãa]o|encontro/.test(s)) return { icone: "", tipo: "Encontro" };
  if(/proposta|simula[çc][ãa]o|material/.test(s)) return { icone: "", tipo: "Envio" };
  // Compromisso "mole" sem tipo concreto ("te chamo amanhã", "te falo", "dou um retorno") = Retornar.
  return { icone: "", tipo: "Retornar" };
}

function classificarCompromissoConfirmado(lead, ap){
  // SÓ entra na barra do topo quando a IA gravou uma DATA CONCRETA (AAAA-MM-DD),
  // que ela só faz quando a data está escrita na conversa/anotação. Sem data absoluta
  // = compromisso deduzido "no chute" → não mostra (evita coisas tipo "café amanhã" inventado).
  const dataAbs = String(ap?.data||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!dataAbs) return null;
  const dt = new Date(+dataAbs[1], +dataAbs[2]-1, +dataAbs[3]); dt.setHours(0,0,0,0);
  const hj = new Date(); hj.setHours(0,0,0,0);
  const diff = Math.round((dt - hj) / 86400000);
  let ordem = 9, quando = null;
  if(diff < 0) return null;        // já passou
  if(diff === 0){ quando = "hoje"; ordem = 1; }
  else if(diff === 1){ quando = "amanhã"; ordem = 2; }
  else return null;                // mais de 1 dia no futuro não vai pra barra do topo
  const q = String(ap?.quando||"").toLowerCase().trim();
  let periodo = "";
  if(/manh[ãa]/.test(q)) periodo = " de manhã";
  else if(/tarde/.test(q)) periodo = " à tarde";
  else if(/noite/.test(q)) periodo = " à noite";
  else {
    const hr = q.match(/\b(\d{1,2})[h:](\d{2})?/);
    if(hr) periodo = " às " + hr[0].replace(":","h");
  }
  const { icone, tipo } = tipoDeCompromisso(ap.oQue);
  return { quando, periodo, icone, tipo, ordem, lead };
}

// Compromissos que o corretor marcou como errados (a IA chutou) — somem da barra do topo.
// Guardado neste aparelho. O corretor é dono da agenda dele: se ele diz que não é, não é.
function compromissosDispensados(){
  try{ return new Set(JSON.parse(localStorage.getItem("compromissosDispensados")||"[]")); }
  catch(_){ return new Set(); }
}
function dispensarCompromisso(key){
  if(!key) return;
  try{
    const s = compromissosDispensados(); s.add(String(key));
    localStorage.setItem("compromissosDispensados", JSON.stringify([...s]));
  }catch(_){}
  carregarAgendaTopo(); // redesenha a barra na hora
}
window.dispensarCompromisso = dispensarCompromisso;

async function carregarAgendaTopo(){
  const box = qs("#agendaTopo");
  if(!box) return;
  try{
    const res = { ok:true, json: async () => await getLeadsData() };
    const data = await res.json();
    const leads = (data?.items || []).map(limparLead);
    const itens = [];
    // O compromisso só vale se o TIPO dele estiver escrito no texto do lead (anotação/conversa).
    // Se a IA falou "café" mas não tem "café" em lugar nenhum, foi invenção dela → não mostra.
    function textoDoLead(lead){
      const a = lead.analysis || {};
      const msgs = Array.isArray(lead.recentMessages) ? lead.recentMessages.map(m => m && m.text || "").join(" ") : "";
      return [msgs, lead.summary, lead.nextAction, a.memoria && a.memoria.observacoes, a.summary, a.nextAction]
        .filter(Boolean).join(" ").toLowerCase();
    }
    const TIPO_REGEX = {
      "Café":/caf[eé]/, "Almoço":/almo[çc]o/, "Jantar":/jantar/,
      "Visita":/visita|conhecer|mostrar|ver o im[óo]vel/, "Encontro":/encontro|reuni[ãa]o/,
      "Ligação":/ligar|liga[çc][ãa]o|telefon|chamada/, "Envio":/proposta|simula[çc][ãa]o|material|enviar/
    };
    function compromissoFundamentado(it, hay){
      const re = TIPO_REGEX[it.tipo];
      if(re) return re.test(hay);
      // tipo genérico: exige menção explícita de dia/data no texto
      return /amanh[ãa]|\bhoje\b|\bdia\s*\d{1,2}\b|\d{1,2}[\/\-]\d{1,2}/.test(hay);
    }
    const dispensados = compromissosDispensados();
    for(const lead of leads){
      if(normalizarEtapa(lead.etapa) === ETAPA_ARQUIVADO) continue; // geladeira não aparece na barra de agenda do topo
      if(ehContatadoHoje(lead)) continue; // já falei com ele hoje — tira o aviso do topo
      const aps = lead.analysis?.confirmedAppointments;
      if(Array.isArray(aps) && aps.length){
        const hay = textoDoLead(lead);
        for(const ap of aps){
          const it = classificarCompromissoConfirmado(lead, ap);
          if(!it || !compromissoFundamentado(it, hay)) continue;
          it.key = String(lead.id||"")+"|"+String(ap.oQue||"")+"|"+String(ap.data||"");
          if(dispensados.has(it.key)) continue; // o corretor já disse que esse está errado
          itens.push(it);
        }
        continue;
      }
      // Sem compromisso com data concreta = nada na barra do topo (não deduzimos do texto).
    }
    itens.sort((a,b) => a.ordem - b.ordem);
    const top = itens.slice(0, 3);
    if(!top.length){ box.innerHTML = ""; return; }
    box.innerHTML = top.map(it => {
      // HOJE = verde-menta vibrante, AMANHÃ = verde-limão
      const cor = it.ordem === 1 ? "var(--acao)" : "var(--lime)";
      const bg = it.ordem === 1 ? "rgba(104,255,149,.14)" : "rgba(185,255,59,.12)";
      const nome = (it.lead.name||"Cliente").split(" ").slice(0,2).join(" ");
      const idJs = JSON.stringify(String(it.lead.id||""));
      const keyJs = JSON.stringify(String(it.key||""));
      // Formato natural: "Visita hoje à tarde · Nome do cliente" + um × pra remover se a IA errou.
      const frase = `${it.tipo} ${it.quando}${it.periodo}`;
      return `<span style="display:inline-flex;align-items:center;background:${bg};border:1px solid ${cor};border-radius:999px"><button type="button" onclick='abrirLead(${idJs})' style="background:none;border:none;color:var(--white);padding:7px 4px 7px 14px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px"><span style="color:${cor};font-weight:950">${escapeHtml(frase)}</span><span style="opacity:.5">·</span><span style="font-weight:700">${escapeHtml(nome)}</span></button><button type="button" title="Não é compromisso — remover" onclick='dispensarCompromisso(${keyJs})' style="margin:0 5px 0 2px;width:20px;height:20px;border-radius:999px;background:rgba(255,80,80,.22);border:1px solid rgba(255,120,120,.7);color:#ff8a8a;cursor:pointer;font-size:13px;font-weight:900;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto">×</button></span>`;
    }).join("");
  }catch(_){ /* falha silenciosa */ }
}

function agendaCardHTML(l, extra){
  const idJs = JSON.stringify(String(l.id||""));
  return `
    <div class="agenda-item">
      <div style="flex:1;min-width:0">
        <strong onclick='abrirLead(${idJs})' style="cursor:pointer;text-decoration:underline;text-decoration-color:rgba(255,255,255,.18)">${escapeHtml(l.name||"Cliente")}</strong>
        <div class="small" style="margin-top:3px">${escapeHtml(l.product||"--")}</div>
        ${l.nextAction ? `<div class="small" style="margin-top:6px;color:var(--soft)"><b>Próxima ação:</b> ${escapeHtml(l.nextAction)}</div>` : ""}
        ${extra || ""}
      </div>
      <div class="agenda-acoes">
        <button type="button" onclick='abrirLead(${idJs})' style="padding:7px 13px;font-size:11px;background:var(--lime);color:var(--on-accent);border:1px solid var(--lime);border-radius:8px;cursor:pointer;font-weight:950">Ver análise</button>
        ${l.analysis?.lembrete?.quando ? reagendarControlHTML(l.id) : ""}
        ${l.analysis?.lembrete?.quando ? `<button type="button" onclick='removerLembrete(${idJs})' style="padding:6px 10px;font-size:11px;background:rgba(244,118,138,.10);color:#ffd7de;border:1px solid rgba(244,118,138,.26);border-radius:8px;cursor:pointer;font-weight:950">🗑 Excluir</button>` : ""}
      </div>
    </div>`;
}
// Controle de "Reagendar": botões rápidos (Amanhã/+7/+15/+30) + data opcional. idRaw = id do lead.
function reagendarControlHTML(idRaw){
  const id = String(idRaw||"");
  const idJs = JSON.stringify(id);
  const chip = "padding:4px 9px;font-size:11px;background:rgba(255,45,155,.10);color:var(--timing);border:1px solid var(--timing);border-radius:999px;cursor:pointer;font-weight:950";
  return `<button type="button" onclick='toggleReagendar(${idJs})' style="padding:6px 10px;font-size:11px;background:rgba(255,255,255,.05);color:var(--soft);border:1px solid var(--line);border-radius:8px;cursor:pointer;font-weight:950">🗓 Reagendar</button>`
    + `<div id="reagbox_${id}" style="display:none;margin-top:5px;background:var(--input);border:1px solid var(--line);border-radius:10px;padding:8px;flex-direction:column;gap:6px;min-width:160px">`
    + `<div style="display:flex;gap:4px;flex-wrap:wrap">`
    + `<button type="button" onclick='reagendarDias(${idJs},1)' style="${chip}">Amanhã</button>`
    + `<button type="button" onclick='reagendarDias(${idJs},7)' style="${chip}">+7 dias</button>`
    + `<button type="button" onclick='reagendarDias(${idJs},15)' style="${chip}">+15 dias</button>`
    + `<button type="button" onclick='reagendarDias(${idJs},30)' style="${chip}">+30 dias</button>`
    + `</div>`
    + `<label style="font-size:10px;color:var(--muted)">ou escolha a data:</label>`
    + `<input type="date" id="reag_${id}" style="background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:5px 7px;font-size:13px" onchange='reagendarLembrete(${idJs}, this.value)'>`
    + `</div>`;
}
window.reagendarControlHTML = reagendarControlHTML;
// Mostra/esconde o painel de reagendar.
function toggleReagendar(id){
  const box = qs("#reagbox_"+id);
  if(!box) return;
  box.style.display = (box.style.display === "flex") ? "none" : "flex";
}
window.toggleReagendar = toggleReagendar;
// Abre/fecha o painel de agendar lembrete (linha de ações do lead).
function toggleAgendar(id){
  const box = qs("#agendarbox_"+id);
  if(!box) return;
  box.style.display = (box.style.display === "flex") ? "none" : "flex";
}
window.toggleAgendar = toggleAgendar;
// Reagenda por atalho (N dias a partir de hoje).
function reagendarDias(id, dias){
  const d = new Date(); d.setDate(d.getDate() + dias);
  const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  reagendarLembrete(id, s);
}
window.reagendarDias = reagendarDias;
// Remarca o lembrete pra nova data (rápido, sem reanalisar). Valida o ano pra não sumir o lembrete.
async function reagendarLembrete(id, dateStr){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr||""));
  if(!m){ toast("Data inválida."); return; }
  const ano = +m[1], anoAtual = new Date().getFullYear();
  if(ano < anoAtual || ano > anoAtual + 5){ toast("Ano inválido — escolha uma data real."); return; }
  try{
    const res = await fetch("./api/reanalisar-lead", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payloadComCerebro({ id, action:"reagendar-lembrete", data: dateStr }))
    });
    const d = await res.json().catch(()=>({}));
    if(!d?.ok) throw new Error(d?.error||"falha");
    invalidarLeadsCache();
    toast("Lembrete remarcado para " + new Date(dateStr+"T12:00:00").toLocaleDateString("pt-BR") + ".");
    await atualizarSinoAgenda(); // sino do topo na hora, em qualquer tela (sem F5)
    if(state.active === "agenda") carregarAgenda();
    else if(state.lead?.id) { try{ abrirLead(id); }catch(_){} }
    else if(state.active === "home") carregarDashboard();
  }catch(err){ toast("Não consegui remarcar: " + (err?.message||err)); }
}
window.reagendarLembrete = reagendarLembrete;
// Exclui o lembrete da agenda (não some o lead — só tira o item agendado).
async function removerLembrete(id){
  const msgLembrete = "Excluir este lembrete da agenda? O lead continua salvo — só sai do agendado.";
  const okLembrete = (typeof cp903Confirm === "function")
    ? await cp903Confirm({ titulo: "Excluir lembrete", mensagem: msgLembrete, ok: "Excluir" })
    : confirm(msgLembrete);
  if(!okLembrete) return;
  try{
    const res = await fetch("./api/reanalisar-lead", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payloadComCerebro({ id, action:"remover-lembrete" }))
    });
    const d = await res.json().catch(()=>({}));
    if(!d?.ok) throw new Error(d?.error||"falha");
    invalidarLeadsCache();
    toast("Lembrete excluído da agenda.");
    await atualizarSinoAgenda(); // sino do topo na hora, em qualquer tela (sem F5)
    if(state.active === "agenda") carregarAgenda();
    carregarAgendaTopo();
  }catch(err){ toast("Não consegui excluir: " + (err?.message||err)); }
}
window.removerLembrete = removerLembrete;

async function carregarAgenda(){
  if(state.active !== "agenda") return;
  const box = qs("#agendaList");
  if(!box) return;
  const renderAgenda = async (data) => {
  try{
    // itemsAll inclui GELADEIRA (pra os lembretes continuarem valendo lá); items = só ativos (pras outras seções).
    const itemsAll = (data?.items || []).map(limparLead);
    const items = itemsAll.filter(l => normalizarEtapa(l.etapa) !== ETAPA_ARQUIVADO);

    const agoraTs = Date.now();
    const iniHojeA = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
    const fimHojeA = (() => { const d = new Date(); d.setHours(23,59,59,999); return d.getTime(); })();
    // Lembrete com data de HOJE (lead ativo) → seção "de hoje" (é o que o número do topo conta).
    const lembretesHoje = items.filter(l => { const t = lembreteTs(l); return !isNaN(t) && t >= iniHojeA && t <= fimHojeA; });
    lembretesHoje.sort((a,b) => lembreteTs(a) - lembreteTs(b));
    // Futuros = data DEPOIS de hoje (ativos + geladeira).
    // Lembrete VENCIDO de lead na GELADEIRA → reaparece AQUI pra revisar (está parkeado, não vai pro Hoje).
    const lembretesFuturos = itemsAll.filter(l => { const t = lembreteTs(l); return !isNaN(t) && t > fimHojeA; });
    lembretesFuturos.sort((a,b) => lembreteTs(a) - lembreteTs(b));
    const lembretesArquivadosVencidos = itemsAll.filter(l => lembreteVencido(l) && normalizarEtapa(l.etapa) === ETAPA_ARQUIVADO);
    lembretesArquivadosVencidos.sort((a,b) => lembreteTs(a) - lembreteTs(b));

    // Compromissos confirmados — todos, agrupados por urgência
    const compHoje = [], compAmanha = [], compFuturo = [];
    for(const l of items){
      const aps = l.analysis?.confirmedAppointments;
      if(!Array.isArray(aps)) continue;
      for(const ap of aps){
        const q = String(ap.quando||"").toLowerCase();
        if(/\bhoje\b/.test(q)) compHoje.push({ ...l, _ap: ap });
        else if(/amanh[ãa]/.test(q)) compAmanha.push({ ...l, _ap: ap });
        else compFuturo.push({ ...l, _ap: ap });
      }
    }
    const compromissos = [...compHoje, ...compAmanha, ...compFuturo];

    // v1011 — seção "Atrasados" no topo: é AQUI que mora a lista dos "N compromissos atrasados"
    // que o sino anuncia (antes só existia o número, sem lugar pra ver quem são). Mesma régua
    // da contagem (cp786CompromissoAtrasado): lembrete ou compromisso com data vencida em até
    // 60 dias, de lead ativo ainda não atendido hoje.
    const atrasados = items
      .map(l => ({ l, at: (typeof cp786CompromissoAtrasado === 'function') ? cp786CompromissoAtrasado(l) : null }))
      .filter(x => x.at);
    atrasados.sort((a,b) => a.at.dias - b.at.dias);

    if(!compromissos.length && !lembretesHoje.length && !lembretesFuturos.length && !lembretesArquivadosVencidos.length && !atrasados.length){
      box.innerHTML = '<div class="empty">Nada agendado. Quando você ou o cliente marcarem um retorno (ex.: "retomar em 60 dias"), aparece aqui.</div>';
      return;
    }

    let html = "";
    if(atrasados.length){
      html += `<div style="margin-bottom:14px"><div class="small" style="color:var(--risco);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:11px;margin-bottom:8px">Atrasados — retome ou descarte (${atrasados.length})</div>`;
      html += atrasados.map(({ l, at }) => {
        const lem = l.analysis?.lembrete || null;
        const lemTs = lem?.quando ? new Date(lem.quando).getTime() : NaN;
        const lemVencido = Number.isFinite(lemTs) && lemTs < Date.now();
        const vencidos = (typeof cpCompromissosVencidosDoLead === 'function') ? cpCompromissosVencidosDoLead(l) : [];
        const linhas = [];
        if(lemVencido){
          linhas.push(`<div class="small" style="margin-top:4px">⏰ Lembrete vencido (${escapeHtml(new Date(lemTs).toLocaleDateString('pt-BR'))})${lem?.motivo ? ` — ${escapeHtml(_cortarFrase(String(lem.motivo), 70))}` : ''}</div>`);
        }
        for(const v of vencidos){
          const keyJs = JSON.stringify(String(v.key));
          linhas.push(`<div class="small" style="margin-top:4px;display:flex;align-items:center;gap:8px"><span style="min-width:0">${escapeHtml(v.oQue)} — era ${escapeHtml(v.dataBR)}${v.trecho ? ` · <i style="color:var(--muted)">"${escapeHtml(v.trecho.slice(0,60))}"</i>` : ''}</span><button type="button" title="Não é compromisso — descartar" onclick='dispensarCompromisso(${keyJs});carregarAgenda()' style="flex:0 0 auto;width:20px;height:20px;border-radius:999px;background:rgba(255,80,80,.22);border:1px solid rgba(255,120,120,.7);color:#ff8a8a;cursor:pointer;font-size:13px;font-weight:900;line-height:1">×</button></div>`);
        }
        const extra = `<div style="margin-top:6px;padding:6px 8px;background:rgba(255,80,80,.06);border-left:3px solid var(--risco);border-radius:6px;font-size:12px"><b style="color:var(--risco)">Atrasado há ${at.dias} dia${at.dias===1?'':'s'} (era ${escapeHtml(at.dataLabel)})</b>${linhas.join('')}</div>`;
        return agendaCardHTML(l, extra);
      }).join("");
      html += `</div>`;
    }
    if(lembretesHoje.length){
      html += `<div style="margin-bottom:14px"><div class="small" style="color:var(--acao);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:11px;margin-bottom:8px">Lembretes de hoje (${lembretesHoje.length})</div>`;
      html += lembretesHoje.map(l => {
        const lem = l.analysis?.lembrete || {};
        const dataBR = new Date(lem.quando).toLocaleDateString("pt-BR");
        const extra = `<div style="margin-top:6px;padding:6px 8px;background:rgba(104,255,149,.05);border-left:3px solid var(--acao);border-radius:6px;font-size:12px"><b style="color:var(--acao)">📅 Lembrete de hoje (${escapeHtml(dataBR)})</b>${lem.motivo ? `<div class="small" style="margin-top:2px;color:var(--soft)">${escapeHtml(lem.motivo)}</div>` : ""}</div>`;
        return agendaCardHTML(l, extra);
      }).join("");
      html += `</div>`;
    }
    if(lembretesArquivadosVencidos.length){
      html += `<div style="margin-bottom:14px"><div class="small" style="color:var(--timing);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:11px;margin-bottom:8px">Lembretes vencidos — revisar (arquivados) (${lembretesArquivadosVencidos.length})</div>`;
      html += lembretesArquivadosVencidos.map(l => {
        const lem = l.analysis?.lembrete || {};
        const dataBR = new Date(lem.quando).toLocaleDateString("pt-BR");
        const extra = `<div style="margin-top:6px;padding:6px 8px;background:rgba(255,45,155,.05);border-left:3px solid var(--timing);border-radius:6px;font-size:12px"><b style="color:var(--timing)">⏰ Lembrete venceu (${escapeHtml(dataBR)}) · está arquivado</b>${lem.motivo ? `<div class="small" style="margin-top:2px;color:var(--soft)">${escapeHtml(lem.motivo)}</div>` : ""}</div>`;
        return agendaCardHTML(l, extra);
      }).join("");
      html += `</div>`;
    }
    if(lembretesFuturos.length){
      html += `<div style="margin-bottom:14px"><div class="small" style="color:var(--dados);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:11px;margin-bottom:8px">Lembretes agendados (${lembretesFuturos.length})</div>`;
      html += lembretesFuturos.map(l => {
        const lem = l.analysis?.lembrete || {};
        const dataBR = new Date(lem.quando).toLocaleDateString("pt-BR");
        const extra = `<div style="margin-top:6px;padding:6px 8px;background:rgba(55,232,255,.05);border-left:3px solid var(--dados);border-radius:6px;font-size:12px"><b style="color:var(--dados)">Lembrar em ${escapeHtml(dataBR)}</b>${lem.motivo ? `<div class="small" style="margin-top:2px;color:var(--soft)">${escapeHtml(_cortarFrase(String(lem.motivo), 70))}</div>` : ""}</div>`;
        return agendaCardHTML(l, extra);
      }).join("");
      html += `</div>`;
    }
    if(compHoje.length){
      html += `<div style="margin-bottom:14px"><div class="small" style="color:var(--acao);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:11px;margin-bottom:8px">Compromissos hoje (${compHoje.length})</div>`;
      html += compHoje.map(l => {
        const ap = l._ap;
        const oQue = ap.oQue || "compromisso";
        const trecho = ap.trechoLiteral ? `<div class="small" style="margin-top:4px;color:var(--muted);font-style:italic">"${escapeHtml(ap.trechoLiteral.slice(0,80))}"</div>` : "";
        const extra = `<div style="margin-top:6px;padding:6px 8px;background:rgba(104,255,149,.05);border-left:3px solid var(--acao);border-radius:6px;font-size:12px"><b style="color:var(--acao)">Hoje — ${escapeHtml(oQue)}</b>${trecho}</div>`;
        return agendaCardHTML(l, extra);
      }).join("");
      html += `</div>`;
    }
    if(compAmanha.length){
      html += `<div style="margin-bottom:14px"><div class="small" style="color:var(--lime);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:11px;margin-bottom:8px">Compromissos amanhã (${compAmanha.length})</div>`;
      html += compAmanha.map(l => {
        const ap = l._ap;
        const oQue = ap.oQue || "compromisso";
        const trecho = ap.trechoLiteral ? `<div class="small" style="margin-top:4px;color:var(--muted);font-style:italic">"${escapeHtml(ap.trechoLiteral.slice(0,80))}"</div>` : "";
        const extra = `<div style="margin-top:6px;padding:6px 8px;background:rgba(166,224,0,.05);border-left:3px solid var(--lime);border-radius:6px;font-size:12px"><b style="color:var(--lime)">Amanhã — ${escapeHtml(oQue)}</b>${trecho}</div>`;
        return agendaCardHTML(l, extra);
      }).join("");
      html += `</div>`;
    }
    if(compFuturo.length){
      html += `<div style="margin-bottom:14px"><div class="small" style="color:var(--dados);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:11px;margin-bottom:8px">Compromissos futuros (${compFuturo.length})</div>`;
      html += compFuturo.map(l => {
        const ap = l._ap;
        const oQue = ap.oQue || "compromisso";
        const quando = ap.quando || "data a confirmar";
        const trecho = ap.trechoLiteral ? `<div class="small" style="margin-top:4px;color:var(--muted);font-style:italic">"${escapeHtml(ap.trechoLiteral.slice(0,80))}"</div>` : "";
        const extra = `<div style="margin-top:6px;padding:6px 8px;background:rgba(55,232,255,.05);border-left:3px solid var(--dados);border-radius:6px;font-size:12px"><b style="color:var(--dados)">${escapeHtml(quando)} — ${escapeHtml(oQue)}</b>${trecho}</div>`;
        return agendaCardHTML(l, extra);
      }).join("");
      html += `</div>`;
    }
    box.innerHTML = html;
  }catch(err){
    box.innerHTML = '<div class="notice error">Falha: '+escapeHtml(String(err?.message||err))+'</div>';
  }
  };
  if(state.todosLeads?.length){
    renderAgenda({ items: state.todosLeads });
    return;
  }
  box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
  try{ const data = await getLeadsData(); renderAgenda(data); }catch(err){ box.innerHTML = '<div class="notice error">Falha ao carregar.</div>'; }
}

// ============ CÉREBRO COMERCIAL ============
const CEREBRO_LS_KEY = "direciona-cerebro-config";
let cerebroFormularioCarregado = false;

function regrasLegadasParaTexto(arr) {
  if(!Array.isArray(arr)) return "";
  return arr.map(r => String(typeof r === "string" ? r : (r?.texto || "")).trim()).filter(Boolean).join("\n\n");
}
function objecoesLegadasParaTexto(arr) {
  if(!Array.isArray(arr)) return "";
  return arr.map(o => {
    const sinal = String(o?.objecao || o?.titulo || "").trim();
    const conducao = String(o?.resposta || o?.texto || "").trim();
    if(!sinal && !conducao) return "";
    if(sinal && conducao) return `SINAL: ${sinal}\nCOMO CONDUZIR: ${conducao}`;
    return sinal || conducao;
  }).filter(Boolean).join("\n\n");
}
// v1091 — usado no sanitizer e ao ler os quadradinhos da tela do Cérebro.
function cpNormalizarDiasAtendimento(valor){
  if(!Array.isArray(valor)) return [...CP_DIAS_ATENDIMENTO_PADRAO];
  const limpos = [...new Set(valor.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  return limpos.length ? limpos : [...CP_DIAS_ATENDIMENTO_PADRAO];
}

function sanitizeCerebroConfigV762(cfg) {
  const c = cfg && typeof cfg === "object" ? cfg : {};
  const temRegrasTexto = Object.prototype.hasOwnProperty.call(c, "regrasTexto");
  const temObjecoesTexto = Object.prototype.hasOwnProperty.call(c, "objecoesTexto");
  return {
    corretorNome: typeof c.corretorNome === "string" ? c.corretorNome : "",
    metodo: typeof c.metodo === "string" ? c.metodo : "",
    tom: typeof c.tom === "string" ? c.tom : "",
    diferenciais: typeof c.diferenciais === "string" ? c.diferenciais : "",
    evitar: typeof c.evitar === "string" ? c.evitar : "",
    diasImportacao: (Number(c.diasImportacao) > 0 && Number(c.diasImportacao) <= 365) ? Number(c.diasImportacao) : 90,
    // v1012 — meta diária do "Fazer agora" configurável por corretor; fora de 1–50 vira 10.
    atendimentosPorDia: (Number(c.atendimentosPorDia) >= 1 && Number(c.atendimentosPorDia) <= 50) ? Math.round(Number(c.atendimentosPorDia)) : 10,
    // v1048 — dias de "descanso" pós-atendimento, configurável por corretor; fora de 1–60 vira 5.
    diasDescansoPosAtendimento: (Number(c.diasDescansoPosAtendimento) >= 1 && Number(c.diasDescansoPosAtendimento) <= 60) ? Math.round(Number(c.diasDescansoPosAtendimento)) : 5,
    // v1091 — dias da semana em que o corretor atende (0=domingo … 6=sábado). Lista vazia ou
    // inválida cai no padrão de sempre (segunda a sexta), pra ninguém ficar sem fila por engano.
    diasAtendimento: cpNormalizarDiasAtendimento(c.diasAtendimento),
    regrasTexto: temRegrasTexto && typeof c.regrasTexto === "string" ? c.regrasTexto : regrasLegadasParaTexto(c.regras),
    objecoesTexto: temObjecoesTexto && typeof c.objecoesTexto === "string" ? c.objecoesTexto : objecoesLegadasParaTexto(c.objecoes),
    regras: Array.isArray(c.regras) ? c.regras : [],
    objecoes: Array.isArray(c.objecoes) ? c.objecoes : []
  };
}
function obterCerebroConfigParaAnalise() {
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(CEREBRO_LS_KEY) || "null"); } catch(_) { cfg = null; }
  // Os campos existem no HTML mesmo antes de a tela do Cérebro ser carregada.
  // Ler esses campos vazios nesse momento apagava o Método salvo no localStorage
  // e enviava um Cérebro parcial/sem instruções para a análise.
  if (cerebroFormularioCarregado) {
    const diasRaw = qs("#cerebroDiasImportacao")?.value;
    cfg = {
      ...(cfg || {}),
      corretorNome: qs("#cerebroCorretorNome")?.value || cfg?.corretorNome || "",
      metodo: qs("#cerebroMetodo")?.value ?? cfg?.metodo ?? "",
      tom: qs("#cerebroTom")?.value ?? cfg?.tom ?? "",
      diferenciais: qs("#cerebroDiferenciais")?.value ?? cfg?.diferenciais ?? "",
      evitar: qs("#cerebroEvitar")?.value ?? cfg?.evitar ?? "",
      diasImportacao: Number(diasRaw) || cfg?.diasImportacao || 90,
      atendimentosPorDia: Number(qs("#cerebroAtendimentosDia")?.value) || cfg?.atendimentosPorDia || 10,
      diasDescansoPosAtendimento: Number(qs("#cerebroDiasDescanso")?.value) || cfg?.diasDescansoPosAtendimento || 5,
      regrasTexto: qs("#cerebroRegrasTexto")?.value ?? cfg?.regrasTexto ?? "",
      objecoesTexto: qs("#cerebroObjecoesTexto")?.value ?? cfg?.objecoesTexto ?? "",
      diasAtendimento: cpLerDiasAtendimentoDoFormulario() ?? cpNormalizarDiasAtendimento(cfg?.diasAtendimento),
      regras: [],
      objecoes: []
    };
  }
  return sanitizeCerebroConfigV762(cfg || { metodo: "", diasImportacao: 90 });
}
// Devolve os dias marcados na tela do Cérebro, ou null se a tela ainda não foi montada — nesse
// caso vale o que está salvo, nunca uma lista vazia acidental.
function cpLerDiasAtendimentoDoFormulario(){
  const caixas = qsa('#cerebroDiasSemana input[type="checkbox"]');
  if(!caixas || !caixas.length) return null;
  const marcados = caixas.filter(c => c.checked).map(c => Number(c.dataset.dia));
  return cpNormalizarDiasAtendimento(marcados);
}

function payloadComCerebro(obj = {}) { return { ...obj, cerebroConfig: obterCerebroConfigParaAnalise() }; }
window.payloadComCerebro = payloadComCerebro;


// Cache leve da inteligenciaAprendida pra usar em renderLeadsParecidos sem refetch a cada lead.
let _ultimoIntelCarregado = 0;
async function garantirIntelCarregado(){
  if(state.intelCache && (Date.now() - _ultimoIntelCarregado) < 60_000) return state.intelCache;
  try{
    const res = await fetch("./api/cerebro-config", { cache:"no-store" });
    const data = await res.json();
    state.intelCache = data?.config?.inteligenciaAprendida || {};
    _ultimoIntelCarregado = Date.now();
  }catch(_){ state.intelCache = state.intelCache || {}; }
  return state.intelCache;
}

// "Esse lead parece com..." — usa o banco aprendido (produtoVsPerfil) pra sugerir
// match com perfis que já geraram interesse. Render síncrono (cache); se vazio,
// dispara o load e re-renderiza quando chegar.
function renderLeadsParecidos(lead){
  // Seção "Você já trabalhou clientes parecidos" OCULTA a pedido do corretor (confundia mais que ajudava).
  // O aprendizado continua acontecendo por trás (inteligenciaAprendida); só não é exibido aqui.
  return "";
  const intel = state.intelCache;
  if(!intel){
    // Dispara carregamento e re-renderiza quando vier
    garantirIntelCarregado().then(() => { if(state.lead?.id === lead.id) renderLeadFoco(lead); }).catch(()=>{});
    return "";
  }
  const matches = Array.isArray(intel.produtoVsPerfil) ? intel.produtoVsPerfil : [];
  if(!matches.length) return "";
  const a = lead.analysis || {};
  const produtoAtual = String(a.produtoInteresse || lead.product || "").toLowerCase().trim();
  const perfilAtual = [
    a.clientProfile || "",
    a.memoria?.preferencias || "",
    a.memoria?.observacoes || "",
    a.memoriaSugerida?.momentoDeVida || "",
    a.memoriaSugerida?.faixaValor || "",
    a.tipoContato || ""
  ].join(" ").toLowerCase();
  // Usa o PRIMEIRO nome do lead pra comparar — o nome completo dele pode ter
  // produtos colados (convenção do corretor), mas o perfil aprendido sempre cita só o primeiro.
  const primeiroNomeLead = String(lead.name || "").toLowerCase().trim().split(/\s+/)[0] || "";
  // Dedupe + filtrar próprio lead atual
  const seen = new Set();
  const matchesUnicos = [];
  for(const m of matches){
    const prod = String(m.produto||"").toLowerCase().trim();
    const perfil = String(m.perfilCliente||"").toLowerCase().trim();
    const chave = prod + "||" + perfil;
    if(seen.has(chave)) continue;
    seen.add(chave);
    // Pula entradas que citam o primeiro nome do lead aberto (é a própria observação dele)
    if(primeiroNomeLead && primeiroNomeLead.length >= 3 && perfil.includes(primeiroNomeLead)) continue;
    matchesUnicos.push(m);
  }
  if(!matchesUnicos.length) return "";
  // Score: produto igual = +50, palavras do perfil em comum = +6 cada (max +50)
  const score = (m) => {
    let s = 0;
    const prod = String(m.produto||"").toLowerCase().trim();
    if(prod && produtoAtual && (prod === produtoAtual || prod.includes(produtoAtual) || produtoAtual.includes(prod))) s += 50;
    const perfilMatch = String(m.perfilCliente||"").toLowerCase();
    const palavras = perfilMatch.split(/[\s,·;]+/).filter(p => p.length >= 4);
    let comuns = 0;
    for(const p of palavras){ if(perfilAtual.includes(p)) comuns++; }
    s += Math.min(50, comuns * 6);
    return s;
  };
  // Score mínimo MAIS ALTO (60) — só mostra match REAL, não trivialidade.
  const scorados = matchesUnicos.map(m => ({ m, s: score(m) })).filter(x => x.s >= 60).sort((a,b) => b.s - a.s).slice(0,2);
  if(!scorados.length) return "";
  const itens = scorados.map(({ m }) => {
    const reacaoTag = /interesse|marcou|engajou|gostou|pediu mais|avançou/i.test(m.reacao||"") ? `<span style="color:var(--acao);font-weight:950">${escapeHtml(m.reacao||"")}</span>` : escapeHtml(m.reacao||"");
    return `<div style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:rgba(196,92,255,.04);margin-bottom:6px">
      <div style="font-size:12px;line-height:1.5">
        <b style="color:var(--cerebro);font-size:10px;letter-spacing:.08em;text-transform:uppercase">Perfil parecido aprendido:</b>
        <span style="color:var(--soft)">${escapeHtml(m.perfilCliente||"")}</span>
      </div>
      <div class="small" style="margin-top:4px;font-size:11px;color:var(--muted)">→ produto <b style="color:var(--text)">${escapeHtml(m.produto||"")}</b> · reação: ${reacaoTag}</div>
    </div>`;
  }).join("");
  return `<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">
    <div style="color:var(--cerebro);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:11px;margin-bottom:8px">Você já trabalhou clientes parecidos</div>
    ${itens}
    <div class="small" style="font-size:10px;color:var(--muted);margin-top:4px;font-style:italic">Baseado no que o Corretor Pro já aprendeu com você. Considere replicar a abordagem que gerou interesse.</div>
  </div>`;
}

async function carregarUsoAprendizado(){
  const card = qs("#aprendizadoCard");
  const box = qs("#aprendizadoBox");
  if(!card || !box) return;
  try{
    const res = { ok:true, json: async () => await getLeadsData() };
    const data = await res.json();
    const leads = (data?.items || []);
    // Agrega eventos de aprendizado de todos os leads
    const stats = {
      totalEventos: 0,
      whatsappAbertos: 0,
      mensagensCopiadas: 0,
      porEstilo: { direta: 0, consultiva: 0, retomada: 0 },
      ultimasAcoes: []
    };
    for(const l of leads){
      const eventos = l.analysis?.aprendizado?.eventos || [];
      stats.totalEventos += eventos.length;
      for(const e of eventos){
        if(e.evento === "whatsapp_aberto") stats.whatsappAbertos++;
        if(e.evento === "mensagem_copiada") stats.mensagensCopiadas++;
        if(e.estilo && stats.porEstilo[e.estilo] != null) stats.porEstilo[e.estilo]++;
        stats.ultimasAcoes.push({ ...e, lead: l.name });
      }
    }
    if(stats.totalEventos === 0){
      card.style.display = "none";
      return;
    }
    stats.ultimasAcoes.sort((a,b) => (b.quando||"").localeCompare(a.quando||""));
    const ultimas = stats.ultimasAcoes.slice(0, 5);
    const estilo = Object.entries(stats.porEstilo).sort((a,b) => b[1]-a[1])[0];
    const estiloMaisUsado = estilo[1] > 0 ? estilo[0] : null;
    const ESTILO_LABEL = { direta: "Direta", consultiva: "Consultiva", retomada: "Retomada" };
    card.style.display = "block";
    box.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">
        <div style="padding:10px 12px;background:rgba(104,255,149,.05);border:1px solid var(--line);border-radius:10px">
          <div style="font-size:9px;color:var(--acao);text-transform:uppercase;letter-spacing:.18em;font-weight:950">WhatsApp abertos</div>
          <div style="font-size:24px;font-weight:950;margin-top:2px">${stats.whatsappAbertos}</div>
        </div>
        <div style="padding:10px 12px;background:rgba(55,232,255,.05);border:1px solid var(--line);border-radius:10px">
          <div style="font-size:9px;color:var(--dados);text-transform:uppercase;letter-spacing:.18em;font-weight:950">Mensagens copiadas</div>
          <div style="font-size:24px;font-weight:950;margin-top:2px">${stats.mensagensCopiadas}</div>
        </div>
        ${estiloMaisUsado ? `<div style="padding:10px 12px;background:rgba(196,92,255,.05);border:1px solid var(--line);border-radius:10px">
          <div style="font-size:9px;color:var(--cerebro);text-transform:uppercase;letter-spacing:.18em;font-weight:950">Estilo + usado</div>
          <div style="font-size:18px;font-weight:950;margin-top:2px">${ESTILO_LABEL[estiloMaisUsado] || estiloMaisUsado}</div>
        </div>`:""}
      </div>
      <div style="padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:10px">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.14em;font-weight:950;margin-bottom:8px">Distribuição por estilo</div>
        ${["direta","consultiva","retomada"].map(s => {
          const v = stats.porEstilo[s] || 0;
          const max = Math.max(stats.porEstilo.direta, stats.porEstilo.consultiva, stats.porEstilo.retomada, 1);
          const pct = Math.round((v/max)*100);
          return `<div style="margin-bottom:6px;font-size:12px"><div style="display:flex;justify-content:space-between"><span>${ESTILO_LABEL[s]}</span><b>${v}</b></div><div style="height:6px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;margin-top:3px"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--cyan),var(--lime))"></div></div></div>`;
        }).join("")}
      </div>
      ${ultimas.length ? `<div style="margin-top:14px">
        <div class="small" style="color:var(--muted);text-transform:uppercase;letter-spacing:.14em;font-weight:950;margin-bottom:6px;font-size:10px">Últimas ações</div>
        ${ultimas.map(e => `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;display:flex;justify-content:space-between;gap:10px"><span>${escapeHtml(e.lead||"?")} · ${escapeHtml(e.evento||"")}${e.estilo?" ("+(ESTILO_LABEL[e.estilo]||e.estilo)+")":""}</span><span class="small" style="color:var(--muted)">${escapeHtml((e.quando||"").slice(0,16).replace("T"," "))}</span></div>`).join("")}
      </div>`:""}
    `;
  }catch(_){ /* falha silenciosa */ }
}

async function carregarRelatorioSemana(){
  const box = qs("#relatorioSemanaBox");
  if(!box) return;
  try{
    const res = { ok:true, json: async () => await getLeadsData() };
    const data = await res.json();
    const leads = (data?.items || []);
    const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - SETE_DIAS_MS;
    let novosLeads = 0;
    let waAbertos = 0, msgCopiadas = 0, contatosManuais = 0, materiaisEnviados = 0;
    for(const l of leads){
      if(l.createdAt){
        const t = new Date(l.createdAt).getTime();
        if(!isNaN(t) && t >= cutoff) novosLeads++;
      }
      const eventos = l.analysis?.aprendizado?.eventos || [];
      for(const e of eventos){
        const t = e.quando ? new Date(e.quando).getTime() : 0;
        if(t < cutoff) continue;
        if(e.evento === "whatsapp_aberto") waAbertos++;
        else if(e.evento === "mensagem_copiada") msgCopiadas++;
        else if(e.evento === "contato_manual") contatosManuais++;
        else if(e.evento === "material_sugerido_enviado") materiaisEnviados++;
      }
    }
    // v928 — "Vendas" removido desta faixa (o dono não marca Vendido no app — só Arquivar,
    // decisão da v904 — então esse número era sempre 0/irreal).
    box.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">
        ${kpiMini("Novos leads", novosLeads, "var(--lime)")}
        ${kpiMini("WhatsApp", waAbertos, "var(--dados)")}
        ${kpiMini("Copiadas", msgCopiadas, "var(--cerebro)")}
        ${kpiMini("Contatos manuais", contatosManuais, "var(--timing)")}
        ${kpiMini("Materiais enviados", materiaisEnviados, "var(--morno)")}
      </div>
      <div class="small" style="margin-top:10px;color:var(--muted);font-size:11px">Período: ${new Date(cutoff).toLocaleDateString("pt-BR")} até hoje</div>
    `;
  }catch(_){ box.innerHTML = '<div class="small" style="color:var(--muted)">Não foi possível carregar.</div>'; }
}
// Tela "O que o Corretor Pro aprendeu" — mostra o banco de inteligência comercial acumulado
// Exportação manual do aprendizado para auditoria e construção assistida do Cérebro.
// Usa o JSZip já embarcado no app para montar um .xlsx localmente, sem nova chamada de IA.
function cpXmlEscape(valor){
  return String(valor ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
function cpColunaExcel(numero){
  let n = Number(numero) || 1, out = "";
  while(n > 0){ const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
  return out;
}
function cpCelulaXlsx(valor, ref, estilo=3){
  if(typeof valor === "number" && Number.isFinite(valor)) return `<c r="${ref}" s="${estilo}" t="n"><v>${valor}</v></c>`;
  if(typeof valor === "boolean") return `<c r="${ref}" s="${estilo}" t="b"><v>${valor?1:0}</v></c>`;
  const texto = String(valor ?? "").slice(0, 30000);
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${cpXmlEscape(texto)}</t></is></c>`;
}
function cpPlanilhaXml({ linhas=[], larguras=[], congelar=1, filtro=true, estilosLinhas={} }={}){
  const totalCols = Math.max(1, ...linhas.map(r => Array.isArray(r) ? r.length : 0));
  const totalRows = Math.max(1, linhas.length);
  const cols = larguras.length ? `<cols>${larguras.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${Math.max(8,Math.min(60,Number(w)||14))}" customWidth="1"/>`).join("")}</cols>` : "";
  const pane = congelar > 0 ? `<pane ySplit="${congelar}" topLeftCell="A${congelar+1}" activePane="bottomLeft" state="frozen"/>` : "";
  const rowsXml = linhas.map((linha, idx) => {
    const r = idx + 1;
    const estiloLinha = Number(estilosLinhas[r] || (r === 1 ? 2 : 3));
    const cells = (Array.isArray(linha) ? linha : []).map((valor, cidx) => cpCelulaXlsx(valor, `${cpColunaExcel(cidx+1)}${r}`, estiloLinha)).join("");
    return `<row r="${r}">${cells}</row>`;
  }).join("");
  const auto = filtro && linhas.length > 1 ? `<autoFilter ref="A1:${cpColunaExcel(totalCols)}${totalRows}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${cpColunaExcel(totalCols)}${totalRows}"/><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>${cols}<sheetData>${rowsXml}</sheetData>${auto}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}
function cpLimparNomeAba(nome, usados){
  let base = String(nome || "Planilha").replace(/[\\/*?:\[\]]/g," ").replace(/\s+/g," ").trim().slice(0,31) || "Planilha";
  let atual = base, n = 2;
  while(usados.has(atual)){ const suf=` ${n++}`; atual=(base.slice(0,31-suf.length)+suf); }
  usados.add(atual); return atual;
}
async function cpGerarXlsx(abas){
  if(!window.JSZip) throw new Error("Gerador de arquivos indisponível. Atualize a página e tente novamente.");
  const zip = new window.JSZip();
  const usados = new Set();
  const sheets = (abas || []).map(a => ({...a, nome:cpLimparNomeAba(a.nome, usados)}));
  const contentSheets = sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentSheets}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  const agora = new Date().toISOString();
  zip.folder("docProps").file("core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Aprendizado Corretor Pro</dc:title><dc:creator>Corretor Pro</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created></cp:coreProperties>`);
  zip.folder("docProps").file("app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Corretor Pro</Application><TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets.map(s=>`<vt:lpstr>${cpXmlEscape(s.nome)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts></Properties>`);
  const workbookSheets = sheets.map((s,i)=>`<sheet name="${cpXmlEscape(s.nome)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("");
  zip.folder("xl").file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${workbookSheets}</sheets><calcPr calcId="191029"/></workbook>`);
  const rels = sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("") + `<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  zip.folder("xl").folder("_rels").file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);
  zip.folder("xl").file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF073642"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFF6257"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9E2E7"/></left><right style="thin"><color rgb="FFD9E2E7"/></right><top style="thin"><color rgb="FFD9E2E7"/></top><bottom style="thin"><color rgb="FFD9E2E7"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  const ws = zip.folder("xl").folder("worksheets");
  sheets.forEach((aba,i)=>ws.file(`sheet${i+1}.xml`, cpPlanilhaXml(aba)));
  return await zip.generateAsync({type:"blob", compression:"DEFLATE", compressionOptions:{level:6}, mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
function cpBaixarArquivo(blob, nome){
  const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function cpTextoCerebroAtual(cerebro){
  const linhas = [["Setor","Item","Conteúdo atual"]];
  linhas.push(["Método","1",cerebro?.metodo||""]);
  linhas.push(["Tom","1",cerebro?.tom||""]);
  linhas.push(["Diferenciais","1",cerebro?.diferenciais||""]);
  linhas.push(["O que evitar","1",cerebro?.evitar||""]);
  linhas.push(["Regras","1",cerebro?.regrasTexto || regrasLegadasParaTexto(cerebro?.regras)]);
  linhas.push(["Objeções","1",cerebro?.objecoesTexto || objecoesLegadasParaTexto(cerebro?.objecoes)]);
  return linhas;
}
async function exportarAprendizadoExcel(botao){
  const btn = botao || qs("#exportarAprendizado");
  const original = btn?.innerHTML || "Exportar aprendizado";
  if(btn){ btn.disabled=true; btn.innerHTML="Preparando arquivo…"; }
  try{
    const res = await fetch("./api/cerebro-config", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"exportar-aprendizado"})});
    const data = await res.json().catch(()=>({ok:false,error:"Resposta inválida do servidor."}));
    if(!res.ok || !data?.ok || !data.exportacao) throw new Error(data?.error || "Não foi possível exportar o aprendizado.");
    const ex = data.exportacao;
    const casos = Array.isArray(ex.casos) ? ex.casos : [];
    const obs = Array.isArray(ex.observacoes) ? ex.observacoes : [];
    const prompt = `Analise integralmente este arquivo exportado do Corretor Pro. Use os casos e observações apenas para identificar padrões recorrentes do atendimento. Não copie nomes, telefones, frases circunstanciais, valores, produtos ou fatos específicos como regras gerais. Compare o aprendizado com o Cérebro atual e entregue seis blocos prontos para revisão e cópia: 1) Método; 2) Tom; 3) Diferenciais; 4) O que evitar; 5) Regras; 6) Objeções e formas de condução. Em cada bloco, separe o que deve ser mantido, ajustado ou acrescentado e informe quantos casos sustentam cada conclusão. Regras manuais atuais têm prioridade. Não altere nada automaticamente.`;
    const comoUsar = [
      ["EXPORTAÇÃO DO APRENDIZADO — CORRETOR PRO"],
      ["Gerado em", ex.geradoEm||""],
      ["Finalidade", "Analisar o aprendizado acumulado e preparar sugestões manuais para cada setor do Cérebro Comercial."],
      ["COMO USAR"],
      ["1", "Envie este arquivo em um novo chat."],
      ["2", "Cole o prompt sugerido abaixo."],
      ["3", "Revise os seis blocos antes de copiar qualquer texto para o Cérebro."],
      ["4", "O arquivo não altera o Cérebro e não executa nenhuma nova análise de IA no Corretor Pro."],
      ["PROMPT SUGERIDO"],
      ["", prompt]
    ];
    const resumo = [["Indicador","Valor"],["Casos comerciais reais",ex.resumo?.casosComerciais||0],["Históricos processados",ex.resumo?.historicosProcessados||0],["Observações de estilo e técnica",ex.resumo?.observacoesEstiloTecnica||0],["Aprendizado atualizado em",ex.resumo?.atualizadoEm||""],["Exportação gerada em",ex.geradoEm||""]];
    const casosLinhas = [["Caso","Histórico anônimo","Situação","Sinal do cliente","Impedimento","Condução do corretor","Resultado","Evidência do resultado","Regra extraída","Produto","Etapa","Aprendido em"],...casos.map(c=>[c.caso,c.historico,c.situacao,c.sinalCliente,c.impedimento,c.conducaoCorretor,c.resultado,c.evidenciaResultado,c.regraExtraida,c.produto,c.etapa,c.aprendidoEm])];
    const tomTecnicas = [["ID","Categoria","Texto aprendido","Aprendido em"],...obs.filter(o=>o.categoria==="Tom"||o.categoria==="Técnica").map(o=>[o.id,o.categoria,o.texto,o.aprendidoEm])];
    const objecoes = [["ID","Objeção","Resposta usada","Funcionou","Aprendido em"],...obs.filter(o=>o.categoria==="Objeção").map(o=>[o.id,o.objecao,o.respostaUsada,o.funcionou,o.aprendidoEm])];
    const produtos = [["ID","Produto","Perfil do cliente","Reação","Aprendido em"],...obs.filter(o=>o.categoria==="Produto × perfil").map(o=>[o.id,o.produto,o.perfilCliente,o.reacao,o.aprendidoEm])];
    const movimentos = [["ID","Categoria","Texto aprendido","Aprendido em"],...obs.filter(o=>!["Tom","Técnica","Objeção","Produto × perfil"].includes(o.categoria)).map(o=>[o.id,o.categoria,o.texto,o.aprendidoEm])];
    const blob = await cpGerarXlsx([
      {nome:"Como usar",linhas:comoUsar,larguras:[18,60],congelar:0,filtro:false,estilosLinhas:{1:1,4:4,9:4}},
      {nome:"Resumo",linhas:resumo,larguras:[32,28]},
      {nome:"Cérebro atual",linhas:cpTextoCerebroAtual(ex.cerebroAtual||{}),larguras:[20,10,60]},
      {nome:"Casos comerciais",linhas:casosLinhas,larguras:[12,16,40,32,30,45,18,36,42,22,18,20]},
      {nome:"Tom e técnicas",linhas:tomTecnicas,larguras:[16,18,60,20]},
      {nome:"Objeções",linhas:objecoes,larguras:[16,40,55,16,20]},
      {nome:"Produto e perfil",linhas:produtos,larguras:[16,24,45,40,20]},
      {nome:"Movimentos",linhas:movimentos,larguras:[16,26,60,20]}
    ]);
    const dataNome = new Date().toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"}).split("/").reverse().join("-");
    cpBaixarArquivo(blob, `corretor-pro-aprendizado-${dataNome}.xlsx`);
    toast(`Aprendizado exportado: ${casos.length} casos e ${obs.length} observações.`);
  }catch(err){ toast("Erro ao exportar aprendizado: " + (err?.message||err)); }
  finally{ if(btn){ btn.disabled=false; btn.innerHTML=original; } }
}
window.exportarAprendizadoExcel = exportarAprendizadoExcel;

// no Cérebro a partir das análises dos ZIPs. Permite editar (apagar) itens errados.
const APRENDIZADO_CATS = [
  { key:"tons", label:"Tom das suas mensagens", cor:"var(--lime)", render: e => e.texto, vazio:"Importe ZIPs com várias mensagens suas pra eu observar seu estilo." },
  { key:"tecnicas", label:"Técnicas comerciais que você usa", cor:"var(--acao)", render: e => e.texto, vazio:"Ainda não identifiquei técnicas nas suas conversas. Importe ZIPs com negociações reais." },
  { key:"objecoes", label:"Respostas a objeções (com resultado)", cor:"var(--cerebro)", render: e => {
      const tag = e.funcionou === true ? `<span style="display:inline-block;padding:1px 7px;margin-left:6px;background:rgba(104,255,149,.14);color:var(--acao);border:1px solid var(--acao);border-radius:999px;font-size:10px;font-weight:950">FUNCIONOU</span>`
                : e.funcionou === false ? `<span style="display:inline-block;padding:1px 7px;margin-left:6px;background:rgba(255,91,122,.14);color:var(--risco);border:1px solid var(--risco);border-radius:999px;font-size:10px;font-weight:950">NÃO funcionou</span>`
                : `<span style="display:inline-block;padding:1px 7px;margin-left:6px;background:rgba(255,255,255,.05);color:var(--muted);border:1px solid var(--line);border-radius:999px;font-size:10px;font-weight:950">incerto</span>`;
      return `<b>Objeção:</b> ${escapeHtml(e.objecao||"")} ${tag}<br><span style="color:var(--soft);font-size:12px"><b style="color:var(--muted)">Você respondeu:</b> ${escapeHtml(e.respostaUsada||"")}</span>`;
    }, vazio:"Sem objeções identificadas ainda. O Corretor Pro aprende quando vê objeções na conversa e a sua resposta." },
  { key:"produtoVsPerfil", label:"Match produto × perfil do cliente", cor:"var(--dados)", render: e => `<b>Produto:</b> ${escapeHtml(e.produto||"")}<br><span style="color:var(--soft);font-size:12px"><b style="color:var(--muted)">Perfil:</b> ${escapeHtml(e.perfilCliente||"")}</span><br><span style="color:var(--soft);font-size:12px"><b style="color:var(--muted)">Reação:</b> ${escapeHtml(e.reacao||"")}</span>`, vazio:"Ainda não cruzei produto × perfil. Importe ZIPs onde você ofereceu um empreendimento específico." },
  { key:"movimentosOk", label:"Movimentos que destrancaram a venda", cor:"var(--acao)", render: e => e.texto, vazio:"Ainda não identifiquei movimentos vitoriosos seus." },
  { key:"movimentosTravaram", label:"Movimentos que travaram o lead (evitar)", cor:"var(--risco)", render: e => e.texto, vazio:"Nenhum movimento ruim identificado ainda." },
  { key:"padroesFollowup", label:"Padrões de follow-up que você usa", cor:"var(--timing)", render: e => e.texto, vazio:"Sem padrão de follow-up identificado ainda." }
];

let cerebroIntel = null; // cache da inteligenciaAprendida da última carga

async function carregarAprendizado(){
  const box = qs("#aprendizadoIABox");
  if(!box) return;
  box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando…</div>';
  try{
    const res = await fetch("./api/cerebro-config", { cache:"no-store" });
    const data = await res.json();
    const ia = data?.config?.inteligenciaAprendida || {};
    const auto = data?.aprendizadoAutomatico || {};
    cerebroIntel = JSON.parse(JSON.stringify(ia));
    const total = APRENDIZADO_CATS.reduce((s, c) => s + ((ia[c.key]||[]).length), 0);
    const totalCasos = Number(auto.totalCasos || 0);
    const historicos = Number(auto.historicosProcessados || 0);
    const pendenciasAuto = Number(auto.aprendizadosPendentes || 0);
    const autoStatus = auto.bootstrapConcluidoEm
      ? (pendenciasAuto ? `${pendenciasAuto} atualização(ões) aguardando leitura automática.` : "Carteira inicial processada. Novas mensagens entram automaticamente.")
      : "Processando os históricos existentes em segundo plano.";
    const header = `<div style="margin-bottom:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;padding:14px 16px;background:linear-gradient(135deg,rgba(255,98,88,.08),rgba(55,232,255,.04));border:1px solid var(--lime);border-radius:12px">
        <div style="font-size:42px;font-weight:950;line-height:1;color:var(--lime)">${totalCasos}</div>
        <div>
          <div style="font-size:13px;font-weight:950">caso${totalCasos===1?" comercial real":"s comerciais reais"}</div>
          <div class="small" style="color:var(--muted);font-size:11px;margin-top:2px">situação → sua condução → resposta do cliente</div>
        </div>
      </div>
      <div style="padding:14px 16px;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:12px">
        <div style="font-size:11px;color:var(--acao);text-transform:uppercase;letter-spacing:.12em;font-weight:950">Aprendizado contínuo ativo</div>
        <div style="font-size:24px;font-weight:950;margin-top:5px">${historicos} históricos</div>
        <div class="small" style="color:var(--muted);font-size:11px;margin-top:3px">${escapeHtml(autoStatus)}</div>
        <div class="small" style="color:var(--soft);font-size:10px;margin-top:5px">${total} observações de estilo e técnica também preservadas</div>
      </div>
      <div style="grid-column:1/-1;padding:14px 16px;background:linear-gradient(135deg,rgba(55,232,255,.06),rgba(255,98,87,.05));border:1px solid var(--dados);border-radius:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="min-width:200px;flex:1">
            <div style="font-size:12px;font-weight:950">Exportar aprendizado</div>
            <div class="small" style="color:var(--muted);font-size:11px;margin-top:3px">Gera um Excel anônimo com casos, estilo, técnicas, objeções e o Cérebro atual. Não altera nenhuma configuração e não chama a IA.</div>
          </div>
          <button type="button" id="exportarAprendizado" onclick="exportarAprendizadoExcel(this)" style="padding:11px 16px;background:var(--dados);color:#052B36;border:0;border-radius:10px;font-size:12px;font-weight:950;cursor:pointer;white-space:nowrap">Exportar aprendizado (.xlsx)</button>
        </div>
      </div>
    </div>`;
    const blocos = APRENDIZADO_CATS.map(cat => {
      const arr = Array.isArray(ia[cat.key]) ? ia[cat.key] : [];
      const itensHtml = arr.length ? arr.slice().reverse().map((e, idxRev) => {
        const idx = arr.length - 1 - idxRev;
        const quando = e.quando ? new Date(e.quando).toLocaleDateString("pt-BR") : "";
        return `<div style="display:flex;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.025);margin-bottom:6px">
          <div style="flex:1;min-width:0;font-size:13px;line-height:1.5">${cat.render(e)}${quando?`<div class="small" style="color:var(--muted);font-size:10px;margin-top:4px">${quando}</div>`:""}</div>
          <button type="button" onclick='apagarItemAprendizado(${JSON.stringify(cat.key)}, ${idx})' style="background:transparent;color:var(--muted);border:0;cursor:pointer;font-size:14px;padding:4px 6px;align-self:flex-start" title="Apagar esta observação">✕</button>
        </div>`;
      }).join("") : `<div class="small" style="color:var(--muted);opacity:.7;padding:10px 0;font-style:italic">${cat.vazio}</div>`;
      return `<div style="margin-bottom:18px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="color:${cat.cor};text-transform:uppercase;letter-spacing:.12em;font-weight:950;font-size:11px">${cat.label}</div>
          <span style="font-size:11px;color:var(--muted)">${arr.length}</span>
        </div>
        ${itensHtml}
      </div>`;
    }).join("");
    box.innerHTML = header + blocos + ((total + totalCasos) > 0 ? `<button type="button" onclick="limparAprendizadoTudo()" style="width:100%;margin-top:6px;padding:10px;background:transparent;color:var(--risco);border:1px dashed var(--risco);border-radius:10px;font-size:12px;font-weight:950;cursor:pointer">Apagar TUDO que o Corretor Pro aprendeu</button>` : "");
  }catch(err){
    box.innerHTML = boxErro("carregarAprendizado()");
  }
}

async function apagarItemAprendizado(categoria, indice){
  if(!cerebroIntel || !Array.isArray(cerebroIntel[categoria])) return;
  const msgItem = "Apagar essa observação? O Corretor Pro vai desconsiderar esse aprendizado.";
  const okItem = (typeof cp903Confirm === "function")
    ? await cp903Confirm({ titulo: "Apagar observação", mensagem: msgItem, ok: "Apagar", perigo: true })
    : confirm(msgItem);
  if(!okItem) return;
  cerebroIntel[categoria].splice(indice, 1);
  await salvarAprendizado();
  carregarAprendizado();
}
window.apagarItemAprendizado = apagarItemAprendizado;

async function limparAprendizadoTudo(){
  const msgTudo = "Apagar TUDO que o Corretor Pro aprendeu com os históricos? O Cérebro Comercial digitado manualmente não será afetado.";
  const okTudo = (typeof cp903Confirm === "function")
    ? await cp903Confirm({ titulo: "Apagar todo o aprendizado", mensagem: msgTudo, ok: "Apagar tudo", perigo: true })
    : confirm(msgTudo);
  if(!okTudo) return;
  try{
    const res = await fetch("./api/cerebro-config", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ action:"limpar-aprendizado-completo" })
    });
    const data = await res.json().catch(()=>({ok:false}));
    if(!res.ok || !data?.ok) throw new Error(data?.error || "falhou");
    cerebroIntel = {};
    try{
      localStorage.removeItem(CP_APREND_AUTO_OFFSET_KEY);
      localStorage.removeItem(CP_APREND_AUTO_PENDENTES_KEY);
    }catch(_){}
    toast("Aprendizado apagado. O sistema começará uma nova leitura automática da carteira.");
    carregarAprendizado();
    carregarEstadoIA();
    cpAprendAgendarRetomada(1200);
  }catch(err){ toast("Erro ao apagar aprendizado: " + (err?.message||err)); }
}
window.limparAprendizadoTudo = limparAprendizadoTudo;

async function salvarAprendizado(){
  try{
    const res = await fetch("./api/cerebro-config", {
      method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({ action:"intel-update", inteligenciaAprendida: cerebroIntel || {} })
    });
    const data = await res.json();
    if(!data?.ok) toast("Erro ao salvar: " + (data?.error||"falhou"));
  }catch(err){ toast("Erro ao salvar: " + (err?.message||err)); }
}


// ===== Aprendizado contínuo real v808 =====
// A varredura inicial roda em segundo plano, uma conversa por vez, sem travar as telas.
// Depois disso, cada importação/reimportação, reanálise e observação manual aprende somente o material novo
// (o servidor usa hash da timeline e não paga outra chamada quando nada mudou).
const CP_APREND_AUTO_OFFSET_KEY = "corretor_pro_aprendizado_v2_offset";
const CP_APREND_AUTO_PENDENTES_KEY = "corretor_pro_aprendizado_v2_pendentes";
const CP_APREND_AUTO_LOCK_KEY = "corretor_pro_aprendizado_v2_lock";
const CP_APREND_AUTO_TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let cpAprendAutoRodando = false;
let cpAprendAutoTimer = null;

function cpAprendLerNumero(chave, fallback=0){
  try{ const n = Number(localStorage.getItem(chave)); return Number.isFinite(n) && n >= 0 ? n : fallback; }catch(_){ return fallback; }
}
function cpAprendSalvarNumero(chave, valor){ try{ localStorage.setItem(chave, String(Math.max(0, Number(valor)||0))); }catch(_){} }
function cpAprendLerPendentes(){
  try{
    const arr = JSON.parse(localStorage.getItem(CP_APREND_AUTO_PENDENTES_KEY) || "[]");
    return [...new Set((Array.isArray(arr)?arr:[]).map(Number).filter(Number.isFinite).filter(n=>n>=0))].sort((a,b)=>a-b);
  }catch(_){ return []; }
}
function cpAprendSalvarPendentes(arr){
  try{ localStorage.setItem(CP_APREND_AUTO_PENDENTES_KEY, JSON.stringify([...new Set(arr)].sort((a,b)=>a-b))); }catch(_){}
}
function cpAprendAtualizarStatus(texto, erro=false){
  const el = qs("#cerebroCarteiraStatus");
  if(el) el.innerHTML = `<span style="color:${erro?'var(--risco)':'var(--cerebro)'}">${escapeHtml(texto)}</span>`;
}
function cpAprendAdquirirLock(){
  const agora = Date.now();
  try{
    const atual = JSON.parse(localStorage.getItem(CP_APREND_AUTO_LOCK_KEY) || "null");
    if(atual?.owner && atual.owner !== CP_APREND_AUTO_TAB_ID && Number(atual.ate||0) > agora) return false;
    localStorage.setItem(CP_APREND_AUTO_LOCK_KEY, JSON.stringify({ owner:CP_APREND_AUTO_TAB_ID, ate:agora + 300000 }));
    return true;
  }catch(_){ return true; }
}
function cpAprendRenovarLock(){
  try{ localStorage.setItem(CP_APREND_AUTO_LOCK_KEY, JSON.stringify({ owner:CP_APREND_AUTO_TAB_ID, ate:Date.now()+300000 })); }catch(_){}
}
function cpAprendLiberarLock(){
  try{
    const atual = JSON.parse(localStorage.getItem(CP_APREND_AUTO_LOCK_KEY) || "null");
    if(!atual || atual.owner === CP_APREND_AUTO_TAB_ID) localStorage.removeItem(CP_APREND_AUTO_LOCK_KEY);
  }catch(_){}
}
function cpAprendAgendarRetomada(delay=45000){
  clearTimeout(cpAprendAutoTimer);
  cpAprendAutoTimer = setTimeout(() => iniciarAprendizadoContinuoAutomatico().catch(()=>{}), delay);
}
async function cpAprendChamarLote(offset, forcar=false){
  let ultimoErro = "";
  for(let tentativa=0; tentativa<3; tentativa++){
    try{
      const res = await fetchComTimeout("./api/cerebro-config", {
        method:"POST", cache:"no-store", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ action:"aprender-carteira", offset, limite:1, forcar })
      }, 50000);
      const data = await res.json().catch(()=>({ok:false,error:`Resposta inválida (${res.status})`}));
      if(res.ok && data?.ok) return data;
      ultimoErro = data?.error || `Servidor respondeu ${res.status}`;
    }catch(e){ ultimoErro = String(e?.message || e); }
    await new Promise(r=>setTimeout(r, 1200*(tentativa+1)));
  }
  throw new Error(ultimoErro || "Não foi possível processar esta conversa.");
}
async function cpAprendFinalizar(totalCarteira){
  const res = await fetchComTimeout("./api/cerebro-config", {
    method:"POST", cache:"no-store", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ action:"finalizar-bootstrap-aprendizado", totalCarteira:Number(totalCarteira)||0 })
  }, 20000);
  const data = await res.json().catch(()=>({ok:false}));
  if(!res.ok || !data?.ok) throw new Error(data?.error || "Não foi possível confirmar o aprendizado da carteira.");
  return data;
}

async function cpAprendProcessarFilaPendente(maximo=12){
  let processados = 0;
  let ultimoStatus = null;
  for(let i=0; i<Math.max(1,maximo); i++){
    cpAprendRenovarLock();
    let data = null;
    try{
      const res = await fetchComTimeout("./api/cerebro-config", {
        method:"POST", cache:"no-store", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ action:"processar-aprendizado-pendente" })
      }, 50000);
      data = await res.json().catch(()=>({ok:false,error:`Resposta inválida (${res.status})`}));
    }catch(e){
      cpAprendAtualizarStatus(`Aprendizado de uma nova conversa ficou pendente: ${String(e?.message||e)}. Vou tentar novamente.`, true);
      cpAprendAgendarRetomada(60000);
      return { ok:false, processados, error:e?.message || String(e), status:ultimoStatus };
    }
    if(data?.vazio){ ultimoStatus = data.aprendizadoAutomatico || ultimoStatus; break; }
    if(!data?.ok){
      cpAprendAtualizarStatus(`Não consegui aprender o histórico ${data?.leadId || ""}: ${data?.error || "erro"}. Vou tentar novamente.`, true);
      cpAprendAgendarRetomada(90000);
      return { ok:false, processados, error:data?.error || "erro", status:ultimoStatus };
    }
    if(data?.processado || data?.removido) processados++;
    ultimoStatus = data?.aprendizadoAutomatico || ultimoStatus;
    await new Promise(r=>setTimeout(r, 450));
  }
  return { ok:true, processados, status:ultimoStatus };
}

async function iniciarAprendizadoContinuoAutomatico(opcoes={}){
  const forcar = opcoes?.forcar === true;
  const somentePendentes = opcoes?.somentePendentes === true;
  const mostrarToast = opcoes?.mostrarToast === true;
  if(cpAprendAutoRodando || !navigator.onLine) return false;
  if(!cpAprendAdquirirLock()) return false;
  cpAprendAutoRodando = true;
  let totalCarteira = 0;
  let processadosNestaRodada = 0;
  try{
    let status = null;
    try{
      const r = await fetchComTimeout("./api/cerebro-config", { cache:"no-store" }, 18000);
      const d = await r.json().catch(()=>null);
      status = d?.aprendizadoAutomatico || null;
    }catch(_){}

    let pendentes = cpAprendLerPendentes();
    if(somentePendentes || (!forcar && status?.bootstrapConcluidoEm && !pendentes.length)){
      const fila = await cpAprendProcessarFilaPendente(somentePendentes ? 6 : 12);
      const st = fila.status || status || {};
      cpAprendSalvarNumero(CP_APREND_AUTO_OFFSET_KEY, status?.bootstrapConcluidoEm ? 0 : cpAprendLerNumero(CP_APREND_AUTO_OFFSET_KEY, 0));
      cpAprendAtualizarStatus(`Aprendizado contínuo ativo: ${Number(st.historicosProcessados||0)} históricos e ${Number(st.totalCasos||0)} casos reais já aprendidos${Number(st.aprendizadosPendentes||0)>0?` · ${Number(st.aprendizadosPendentes)} na fila`:""}.`);
      return fila.ok;
    }

    let offset = forcar ? 0 : cpAprendLerNumero(CP_APREND_AUTO_OFFSET_KEY, 0);
    if(forcar){ pendentes = []; cpAprendSalvarPendentes([]); cpAprendSalvarNumero(CP_APREND_AUTO_OFFSET_KEY, 0); }
    totalCarteira = Number(status?.totalCarteiraNoBootstrap || 0);
    cpAprendAtualizarStatus(forcar ? "Reprocessando toda a carteira em segundo plano…" : "Aprendendo automaticamente com os históricos já importados…");

    for(let loops=0; loops<10000; loops++){
      cpAprendRenovarLock();
      const atualOffset = offset;
      let data;
      try{ data = await cpAprendChamarLote(atualOffset, forcar); }
      catch(e){
        cpAprendAtualizarStatus(`Aprendizado pausado na conversa ${atualOffset+1}: ${String(e?.message||e)}. Vou tentar novamente.`, true);
        cpAprendAgendarRetomada(60000);
        return false;
      }
      if(Number.isFinite(Number(data.total))) totalCarteira = Number(data.total);
      const falhou = Number(data.errosIA||0)>0 || Number(data.falhasSalvar||0)>0;
      if(falhou && !pendentes.includes(atualOffset)) pendentes.push(atualOffset);
      cpAprendSalvarPendentes(pendentes);
      processadosNestaRodada += Number(data.loteProcessado||0);
      const proximo = data.proximaOffset;
      if(proximo == null){
        offset = atualOffset + Number(data.loteProcessado||0);
        cpAprendSalvarNumero(CP_APREND_AUTO_OFFSET_KEY, offset);
        break;
      }
      offset = Number(proximo);
      cpAprendSalvarNumero(CP_APREND_AUTO_OFFSET_KEY, offset);
      const totalTxt = totalCarteira ? `/${totalCarteira}` : "";
      cpAprendAtualizarStatus(`Aprendizado automático em andamento: ${offset}${totalTxt} históricos verificados${pendentes.length?` · ${pendentes.length} para recuperar`:""}.`);
      await new Promise(r=>setTimeout(r, 450));
    }

    // Uma falha transitória não é abandonada. Cada offset problemático volta à fila
    // e só depois de todos terem sido recuperados o bootstrap é marcado como concluído.
    const aindaPendentes = [];
    for(let i=0; i<pendentes.length; i++){
      const off = pendentes[i];
      cpAprendRenovarLock();
      cpAprendAtualizarStatus(`Recuperando histórico ${i+1}/${pendentes.length} que não foi aprendido na primeira tentativa…`);
      try{
        const d = await cpAprendChamarLote(off, true);
        if(Number(d.errosIA||0)>0 || Number(d.falhasSalvar||0)>0) aindaPendentes.push(off);
      }catch(_){ aindaPendentes.push(off); }
      cpAprendSalvarPendentes(aindaPendentes.concat(pendentes.slice(i+1)));
      await new Promise(r=>setTimeout(r, 700));
    }
    cpAprendSalvarPendentes(aindaPendentes);
    if(aindaPendentes.length){
      cpAprendAtualizarStatus(`${aindaPendentes.length} histórico(s) ainda não foram aprendidos. O sistema tentará novamente sem bloquear seu uso.`, true);
      cpAprendAgendarRetomada(90000);
      return false;
    }

    // Absorve também alterações que chegaram enquanto a varredura inicial estava rodando.
    await cpAprendProcessarFilaPendente(30);
    const totalConfirmado = totalCarteira || offset || processadosNestaRodada;
    const fim = await cpAprendFinalizar(totalConfirmado);
    cpAprendSalvarNumero(CP_APREND_AUTO_OFFSET_KEY, 0);
    cpAprendSalvarPendentes([]);
    const st = fim?.aprendizadoAutomatico || {};
    const msg = `Aprendizado contínuo ativo: ${Number(st.historicosProcessados||totalConfirmado)} históricos e ${Number(st.totalCasos||0)} casos comerciais reais disponíveis para as sugestões.`;
    cpAprendAtualizarStatus(msg);
    if(mostrarToast) toast("✓ Carteira aprendida. As próximas sugestões já consultam suas conduções reais.");
    try{ if(state.active === "cerebro"){ carregarAprendizado(); carregarEstadoIA(); } }catch(_){}
    return true;
  }finally{
    cpAprendAutoRodando = false;
    cpAprendLiberarLock();
  }
}
window.iniciarAprendizadoContinuoAutomatico = iniciarAprendizadoContinuoAutomatico;

// Começa sozinho depois que a tela principal já teve tempo de carregar. Se a aba ficar
// sem rede ou for fechada, offset e falhas permanecem salvos e a execução retoma depois.
function cpAgendarAprendizadoInicial(){
  setTimeout(()=>iniciarAprendizadoContinuoAutomatico().catch(()=>{}), 3200);
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", cpAgendarAprendizadoInicial, {once:true});
else cpAgendarAprendizadoInicial();
window.addEventListener("online", ()=>cpAprendAgendarRetomada(1500));
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden && !cpAprendAutoRodando) cpAprendAgendarRetomada(1800); });
// Rede, navegador ou outra aba podem impedir o gatilho imediato. Esta verificação leve
// é só uma rede de segurança; se não houver fila, termina em uma única consulta curta.
setInterval(()=>{ if(!document.hidden && navigator.onLine && !cpAprendAutoRodando) iniciarAprendizadoContinuoAutomatico({ somentePendentes:true }).catch(()=>{}); }, 60000);

qs("#aprendizadoRefresh")?.addEventListener("click", carregarAprendizado);

function kpiMini(label, value, cor){
  return `<div style="padding:10px 12px;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:10px">
    <div style="font-size:9px;color:${cor};text-transform:uppercase;letter-spacing:.18em;font-weight:950">${label}</div>
    <div style="font-size:20px;font-weight:950;margin-top:2px">${value}</div>
  </div>`;
}

// Mostra na tela do Cérebro o estado do aprendizado do Corretor Pro — quantas observações
// foram acumuladas em cada categoria pelo uso real (importação de ZIPs).
async function carregarEstadoIA(){
  const box = qs("#estadoIABox");
  if(!box) return;
  try{
    const res = await fetch("./api/cerebro-config", { cache:"no-store" });
    const data = await res.json();
    const ia = data?.config?.inteligenciaAprendida || {};
    const auto = data?.aprendizadoAutomatico || {};
    const cats = [
      { key:"tons", label:"Tom observado", cor:"var(--lime)" },
      { key:"tecnicas", label:"Técnicas comerciais", cor:"var(--acao)" },
      { key:"objecoes", label:"Objeções × respostas", cor:"var(--cerebro)" },
      { key:"produtoVsPerfil", label:"Match produto × perfil", cor:"var(--dados)" },
      { key:"movimentosOk", label:"Movimentos que destrancaram", cor:"var(--acao)" },
      { key:"movimentosTravaram", label:"Movimentos que travaram", cor:"var(--risco)" },
      { key:"padroesFollowup", label:"Padrões de follow-up", cor:"var(--timing)" }
    ];
    const total = cats.reduce((s,c) => s + ((ia[c.key]||[]).length), 0);
    const historicos = Number(auto.historicosProcessados || 0);
    const casos = Number(auto.totalCasos || 0);
    const pendenciasAuto = Number(auto.aprendizadosPendentes || 0);
    const estado = auto.bootstrapConcluidoEm
      ? (pendenciasAuto ? `${pendenciasAuto} conversa(s) nova(s) estão na fila de aprendizado automático.` : "A carteira existente já foi lida. Novas mensagens importadas, reimportações, reanálises e observações manuais atualizam esta memória automaticamente.")
      : "A leitura inicial da carteira está acontecendo em segundo plano. Você pode continuar usando o sistema normalmente.";
    const grade = cats.map(c => `<div style="padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.025)">
      <div style="color:${c.cor};text-transform:uppercase;letter-spacing:.1em;font-weight:950;font-size:9px;margin-bottom:3px">${c.label}</div>
      <div style="font-size:20px;font-weight:950">${(ia[c.key]||[]).length}</div>
    </div>`).join("");
    box.innerHTML = `
      <div style="padding:13px 14px;border:1px solid var(--acao);border-radius:12px;background:linear-gradient(135deg,rgba(74,222,128,.07),rgba(55,232,255,.03));margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div style="color:var(--acao);font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:950">Aprendizado contínuo ativo</div>
            <div style="font-size:13px;line-height:1.45;margin-top:4px">${escapeHtml(estado)}</div>
          </div>
          <div style="display:flex;gap:18px">
            <div><div style="font-size:24px;font-weight:950">${historicos}</div><div class="small" style="color:var(--muted);font-size:10px">históricos lidos</div></div>
            <div><div style="font-size:24px;font-weight:950">${casos}</div><div class="small" style="color:var(--muted);font-size:10px">casos reais</div></div>
          </div>
        </div>
        <div class="small" style="color:var(--soft);font-size:10px;margin-top:7px">${total} observações de estilo, técnica e resposta também disponíveis.</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:7px">${grade}</div>
      <div style="margin-top:10px;text-align:right">
        <button type="button" onclick='icTab("aprendizado");document.getElementById("aprendizadoIABox")?.scrollIntoView({behavior:"smooth"})' style="background:transparent;color:var(--soft);border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:11px;font-weight:950;cursor:pointer">Ver detalhes →</button>
      </div>`;
  }catch(_){ box.innerHTML = '<div class="small" style="color:var(--muted)">Não foi possível carregar.</div>'; }
}

async function carregarCerebro(){
  carregarRelatorioSemana();
  carregarUsoAprendizado();
  carregarEstadoIA();
  const status = qs("#cerebroStatus");
  status.textContent = "Carregando...";
  // v1093 — o dono mandou print do "Carregando..." PRESO embaixo do botão Salvar, com a tela já
  // carregada e nada acontecendo. Motivo: no fim desta função a mensagem só era trocada "se a
  // caixa estivesse vazia" — e ela nunca está, porque o próprio "Carregando..." acima já a
  // preenche. Resultado: a mensagem de espera ficava pra sempre. Agora o aviso é controlado por
  // esta variável, não por "a caixa está vazia?".
  let aviso = "";
  let veioDoServidor = false;
  let config = null;
  try{
    const res = await fetch("./api/cerebro-config", { cache:"no-store" });
    const data = await res.json();
    if(data?.ok && data.config){ config = data.config; veioDoServidor = true; }
    if(data?.warning) aviso = String(data.warning);
  }catch(_){ /* fallback local */ }
  if(!config){
    try{ config = JSON.parse(localStorage.getItem(CEREBRO_LS_KEY) || "null"); }catch(_){}
  }
  // Cair na cópia local é degradação silenciosa: a tela fica idêntica, mas o que está ali pode
  // estar velho e o que ele salvar pode sobrescrever o do servidor. Precisa aparecer.
  if(!veioDoServidor && config && !aviso){
    aviso = "Sem conexão com o servidor — mostrando a última configuração salva neste aparelho.";
  }
  if(!config){
    config = { metodo:"", tom:"", diferenciais:"", evitar:"", diasImportacao:90, regrasTexto:"", objecoesTexto:"", regras:[], objecoes:[] };
  }
  config = sanitizeCerebroConfigV762(config);
  try{ localStorage.setItem(CEREBRO_LS_KEY, JSON.stringify(config)); }catch(_){}
  if(qs("#cerebroCorretorNome")) qs("#cerebroCorretorNome").value = config.corretorNome || "";
  qs("#cerebroMetodo").value = config.metodo || "";
  qs("#cerebroTom").value = config.tom || "";
  qs("#cerebroDiferenciais").value = config.diferenciais || "";
  qs("#cerebroEvitar").value = config.evitar || "";
  const inpDias = qs("#cerebroDiasImportacao");
  if(inpDias) inpDias.value = (config.diasImportacao && Number(config.diasImportacao) > 0) ? config.diasImportacao : 90;
  const inpAtend = qs("#cerebroAtendimentosDia");
  if(inpAtend) inpAtend.value = (Number(config.atendimentosPorDia) >= 1) ? config.atendimentosPorDia : 10;
  const inpDescanso = qs("#cerebroDiasDescanso");
  if(inpDescanso) inpDescanso.value = (Number(config.diasDescansoPosAtendimento) >= 1) ? config.diasDescansoPosAtendimento : 5;
  // v1091 — marca os dias em que ele atende.
  const diasSalvos = cpNormalizarDiasAtendimento(config.diasAtendimento);
  qsa('#cerebroDiasSemana input[type="checkbox"]').forEach(c => { c.checked = diasSalvos.includes(Number(c.dataset.dia)); });
  // Regras e objeções em blocos únicos de texto.
  if(qs("#cerebroRegrasTexto")) qs("#cerebroRegrasTexto").value = config.regrasTexto || "";
  if(qs("#cerebroObjecoesTexto")) qs("#cerebroObjecoesTexto").value = config.objecoesTexto || "";
  cerebroFormularioCarregado = true;
  // Carregou certo: a caixa fica VAZIA. A prova de que carregou são os campos preenchidos logo
  // acima — deixar um "Configuração carregada." fixo só repetiria na tela o que já está à vista.
  if(aviso) status.innerHTML = '<span style="color:#ffc4f4">' + escapeHtml(aviso) + '</span>';
  else status.textContent = "";
}

// v1066 — o dono mandou prints mostrando o computador e o celular escolhendo um lead DIFERENTE
// como "o" prioritário do dia, mesmo com os mesmos números (225 leads, 96 aguardando cliente):
// no PC aparecia um lead atendido há só 6 dias (Adão), no celular só apareciam leads muito mais
// parados (Silvana, há 18 dias). Causa: o "tempo de descanso" e a "meta por dia" configurados no
// Cérebro (usados por cpFilaFazerAgora pra decidir quem já pode voltar à fila) são lidos de uma
// cópia salva SÓ NAQUELE APARELHO (localStorage) — e essa cópia só era atualizada quando o
// corretor abria a tela "Cérebro" NAQUELE MESMO aparelho. Um computador onde ele nunca abriu essa
// tela ficava preso no valor padrão (5 dias), mesmo tendo ajustado esse número há tempos no
// celular — e nem um F5 forçado resolvia, porque o valor mora no armazenamento local, não no
// cache de rede. Busca a configuração salva no servidor assim que o app abre, em qualquer
// aparelho, e atualiza a Home na hora se isso muda quem entra na fila.
async function cp7SincronizarCerebroConfigInicial(){
  try{
    const res = await fetch("./api/cerebro-config", { cache:"no-store" });
    const data = await res.json();
    if(!data?.ok || !data.config) return;
    let anterior = null;
    try{ anterior = JSON.parse(localStorage.getItem(CEREBRO_LS_KEY) || "null"); }catch(_){}
    const fresco = sanitizeCerebroConfigV762(data.config);
    localStorage.setItem(CEREBRO_LS_KEY, JSON.stringify(fresco));
    const mudouRegraDeFila = !anterior
      || Number(anterior.diasDescansoPosAtendimento) !== Number(fresco.diasDescansoPosAtendimento)
      || Number(anterior.atendimentosPorDia) !== Number(fresco.atendimentosPorDia);
    if(mudouRegraDeFila && typeof refreshAllSections === "function") refreshAllSections();
  }catch(_){ /* sem rede/sessão ainda — a Home continua com o que já tinha */ }
}
cp7SincronizarCerebroConfigInicial();

let ultimoSqlCerebro = "";
function copiarSqlCerebro(){
  if(!ultimoSqlCerebro){ toast("Nada para copiar."); return; }
  navigator.clipboard?.writeText(ultimoSqlCerebro).then(
    ()=>toast("SQL copiado! Cole no SQL Editor do Supabase e clique em Run."),
    ()=>toast("Não consegui copiar. Copie manualmente.")
  );
}
window.copiarSqlCerebro = copiarSqlCerebro;

async function salvarCerebro(){
  const diasRaw = qs("#cerebroDiasImportacao")?.value;
  const diasN = Number(diasRaw);
  const atendRaw = qs("#cerebroAtendimentosDia")?.value;
  const atendN = Number(atendRaw);
  const descansoRaw = qs("#cerebroDiasDescanso")?.value;
  const descansoN = Number(descansoRaw);
  const config = {
    corretorNome: qs("#cerebroCorretorNome")?.value || "",
    metodo: qs("#cerebroMetodo").value,
    tom: qs("#cerebroTom").value,
    diferenciais: qs("#cerebroDiferenciais").value,
    evitar: qs("#cerebroEvitar").value,
    diasImportacao: (Number.isFinite(diasN) && diasN > 0 && diasN <= 365) ? diasN : 90,
    atendimentosPorDia: (Number.isFinite(atendN) && atendN >= 1 && atendN <= 50) ? Math.round(atendN) : 10,
    diasDescansoPosAtendimento: (Number.isFinite(descansoN) && descansoN >= 1 && descansoN <= 60) ? Math.round(descansoN) : 5,
    diasAtendimento: cpLerDiasAtendimentoDoFormulario() ?? [...CP_DIAS_ATENDIMENTO_PADRAO],
    regrasTexto: qs("#cerebroRegrasTexto")?.value || "",
    objecoesTexto: qs("#cerebroObjecoesTexto")?.value || "",
    regras: [],
    objecoes: []
  };
  const configSanitizado = sanitizeCerebroConfigV762(config);
  try{ localStorage.setItem(CEREBRO_LS_KEY, JSON.stringify(configSanitizado)); }catch(_){}
  const status = qs("#cerebroStatus");
  status.textContent = "Salvando...";
  try{
    const res = await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(configSanitizado) });
    const data = await res.json();
    if(data?.warning){
      ultimoSqlCerebro = data.sqlNecessario || "";
      status.innerHTML = '<span style="color:var(--morno)">Salvo neste aparelho. Para sincronizar entre celular e computador, crie a tabela do Cérebro no banco (uma vez só).'
        + (ultimoSqlCerebro ? ' <button type="button" onclick="copiarSqlCerebro()" style="background:transparent;border:1px solid var(--line);color:var(--morno);border-radius:999px;padding:2px 10px;font-size:11px;font-weight:800;cursor:pointer;margin-left:2px">Copiar SQL</button>' : '')
        + '</span>';
    } else if(data?.ok){
      status.textContent = "Salvo no banco.";
      toast("Cérebro salvo.");
    } else {
      status.innerHTML = '<span style="color:#ff5b7a">Erro: '+escapeHtml(data?.error||"")+'</span>';
    }
  }catch(err){
    status.innerHTML = '<span style="color:#ffc4f4">Salvo no navegador (sem banco): '+escapeHtml(String(err?.message||err))+'</span>';
  }
}

function resetarCerebro(){
  const padrao = sanitizeCerebroConfigV762({ metodo:"", tom:"", diferenciais:"", evitar:"", diasImportacao:90, regrasTexto:"", objecoesTexto:"", regras:[], objecoes:[] });
  try{ localStorage.setItem(CEREBRO_LS_KEY, JSON.stringify(padrao)); }catch(_){}
  carregarCerebro();
  toast("Cérebro limpo.");
}

// Zera o Cérebro (método/tom/o-que-evitar/regras/objeções) E todo o Aprendizado, pra a
// análise rodar "pura" (só o modelo lendo a conversa). Mantém o nome do corretor e os
// produtos (Diferenciais), que são FATOS que a IA precisa — não regra/aprendizado.
async function zerarCerebroTudo(){
  const msgZerar = "Zerar o Cérebro (método, tom, o que evitar, regras, objeções) E TODO o aprendizado?\n\nA análise passa a rodar PURA (somente a conversa, sem regras aprendidas). Mantém o seu nome e os produtos. Não tem como desfazer.";
  const okZerar = (typeof cp903Confirm === "function")
    ? await cp903Confirm({ titulo: "Zerar o Cérebro", mensagem: msgZerar, ok: "Zerar tudo", perigo: true })
    : confirm(msgZerar);
  if(!okZerar) return;
  const status = qs("#cerebroStatus"); if(status) status.textContent = "Zerando...";
  try{
    const cfg = {
      corretorNome: qs("#cerebroCorretorNome")?.value || "",
      metodo: "", tom: "", evitar: "",
      diferenciais: "",
      diasImportacao: Number(qs("#cerebroDiasImportacao")?.value) || 90,
      // Meta diária e dias de descanso são preferência de trabalho (como o período dos áudios),
      // não aprendizado — ficam.
      atendimentosPorDia: Number(qs("#cerebroAtendimentosDia")?.value) || 10,
      diasDescansoPosAtendimento: Number(qs("#cerebroDiasDescanso")?.value) || 5,
      diasAtendimento: cpLerDiasAtendimentoDoFormulario() ?? [...CP_DIAS_ATENDIMENTO_PADRAO],
      regrasTexto: "", objecoesTexto: "", regras: [], objecoes: []
    };
    await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(cfg) });
    await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"intel-update", inteligenciaAprendida:{} }) });
    try{ localStorage.setItem(CEREBRO_LS_KEY, JSON.stringify(sanitizeCerebroConfigV762(cfg))); }catch(_){}
    toast("Cérebro e aprendizado zerados. Análise agora roda pura.");
    carregarCerebro();
  }catch(e){
    if(status) status.innerHTML = '<span style="color:#ff5b7a">Erro ao zerar: '+escapeHtml(String(e?.message||e))+'</span>';
  }
}
window.zerarCerebroTudo = zerarCerebroTudo;

function openAIErrorBlock(data){
  const blocks = [];
  if(data?.analysis?.mode === "erro_api" && data.analysis.error){
    blocks.push(
      '<div class="notice error" style="margin-top:10px">' +
      '<b>Análise (Cérebro Comercial) falhou:</b><br>' +
      escapeHtml(data.analysis.error) +
      '<br><br><b>O que fazer:</b> ' + escapeHtml(data.analysis.nextAction || "Abra o Diagnóstico.") +
      '</div>'
    );
  }
  if(Number(data?.audiosComErro) > 0){
    blocks.push(
      '<div class="notice error" style="margin-top:10px">' +
      '<b>'+ data.audiosComErro +' áudio(s) falharam ao transcrever.</b><br>' +
      '<b>Motivo:</b> ' + escapeHtml(data.primeiroErroAudio || "abra o Diagnóstico") +
      '</div>'
    );
  }
  return blocks.join("");
}

async function runOpenAIDiagnostics(){
  const box = qs("#resultBox");
  box.className = "small";
  box.innerHTML = "Diagnosticando análise…";
  try{
    const res = await fetch("./api/diagnostico?mode=openai", { cache:"no-store" });
    const data = await res.json().catch(()=>({ ok:false, error:"resposta inválida" }));
    const cfg = data.config || {};
    let html = '<b>Diagnóstico da análise</b><br>';
    html += '<b>Chave configurada:</b> ' + (cfg.configured ? "sim ("+escapeHtml(cfg.keyPrefix||"")+"…"+escapeHtml(cfg.keyTail||"")+")" : "não") + '<br>';
    html += '<b>Base URL:</b> ' + escapeHtml(cfg.baseURL||"-") + '<br>';
    html += '<b>Organização:</b> ' + escapeHtml(cfg.organization||"(padrão)") + '<br>';
    html += '<b>Projeto:</b> ' + escapeHtml(cfg.project||"(padrão)") + '<br>';
    html += '<b>Modelo transcrição:</b> ' + escapeHtml(cfg.transcriptionModel||"-") + '<br>';
    html += '<b>Modelo análise:</b> ' + escapeHtml(cfg.analysisModel||"-") + '<br><br>';
    if(Array.isArray(data.testes)){
      html += '<b>Testes:</b><br>';
      for(const t of data.testes){
        html += (t.ok ? "✓ " : "✗ ") + escapeHtml(t.etapa) + " ("+t.ms+"ms)";
        if(!t.ok){
          html += '<br>&nbsp;&nbsp;<b>Erro:</b> ' + escapeHtml(t.error||"sem detalhe");
          if(t.hint) html += '<br>&nbsp;&nbsp;<b>Dica:</b> ' + escapeHtml(t.hint);
        }
        html += '<br>';
      }
    }
    if(data.primeiroErro){
      html += '<br><div class="notice error">';
      html += '<b>Etapa que falhou:</b> ' + escapeHtml(data.primeiroErro.etapa) + '<br>';
      html += '<b>Mensagem do provedor:</b> ' + escapeHtml(data.primeiroErro.mensagem||"") + '<br>';
      if(data.primeiroErro.dica){ html += '<b>Como resolver:</b> ' + escapeHtml(data.primeiroErro.dica); }
      html += '</div>';
    } else if(data.ok){
      html += '<br><div class="notice">Provedor respondendo normalmente. Áudios devem transcrever.</div>';
    }
    box.className = "small";
    box.innerHTML = html;
  }catch(err){
    box.className = "notice error";
    box.innerHTML = "Não foi possível rodar o diagnóstico: " + escapeHtml(String(err?.message||err));
  }
}

// Etapas oficiais do Documento Mestre §30
const ETAPAS_PROCESSAMENTO = [
  "Recebendo",
  "Enviando",
  "Extraindo",
  "Transcrevendo",
  "Analisando",
  "Salvando",
  "Concluído",
  "Falha recuperável"
];

// v1088 — TELA CHEIA DA IMPORTAÇÃO ("Foco total", modelo 01 escolhido pelo dono).
// Rótulos em português de gente: os nomes internos ("Extraindo", "Transcrevendo") diziam o que o
// SISTEMA faz; estes dizem o que está acontecendo com a CONVERSA do cliente.
const CPIO_PASSOS = [
  { rot:"Recebendo a conversa",       sub:"o arquivo do WhatsApp chegou" },
  { rot:"Enviando com segurança",     sub:"guardando sua conversa protegida" },
  { rot:"Abrindo o arquivo",          sub:"separando textos, fotos e áudios" },
  { rot:"Ouvindo os áudios",          sub:"cada áudio vira texto pra nada se perder" },
  { rot:"Analisando pelo seu Cérebro",sub:"suas regras aplicadas a esta conversa" },
  { rot:"Salvando na carteira",       sub:"confirmando na sua base" },
  { rot:"Pronto",                     sub:"abrindo o cliente" }
];
const CPIO_PCT = [8, 32, 48, 70, 86, 94, 100];
const CPIO_CIRCUNFERENCIA = 351.9; // 2πr com r=56, igual ao SVG do index.html

function cpImportOverlayVisivel(mostrar){
  const el = qs("#cpImportOverlay");
  if(!el) return;
  if(mostrar){
    if(el.hidden){
      // Importação nova começando: o andamento recomeça do zero.
      if(_cpioMostrado >= 100) cpioZerar();
      el.hidden = false; document.body.classList.add("cpio-aberto");
    }
    cpioRearmarVigia();
  }else{
    if(!el.hidden){ el.hidden = true; document.body.classList.remove("cpio-aberto"); }
    cpioPararAnimacao();
    clearTimeout(_cpioVigia); _cpioVigia = null;
  }
}
window.cpImportOverlayVisivel = cpImportOverlayVisivel;

// v1089 — ANDAMENTO CONTÍNUO. Antes o número pulava de 8% pra 32%, pra 48%... e ficava parado
// entre um pulo e outro — o dono descreveu como "pulando de bastante em bastante". Cada etapa tem
// uma duração muito diferente (ouvir os áudios e analisar levam dezenas de segundos; as outras,
// instantes), então a barra ficava longos períodos congelada e depois dava um salto.
// Agora o número CAMINHA sozinho: ao entrar numa etapa ele mira o percentual dela e, enquanto a
// etapa não termina, vai se arrastando devagar em direção à próxima (chegando cada vez mais
// devagar, sem nunca alcançar) — assim está sempre andando e nunca "passa na frente" da verdade.
// Quando a etapa seguinte chega de fato, ele alcança o novo valor suavemente.
let _cpioMostrado = 0;   // o que está escrito na tela agora
let _cpioAlvo = 0;       // pra onde ele está indo neste instante
let _cpioTeto = 0;       // até onde pode se arrastar sozinho (nunca invade a etapa seguinte)
let _cpioTimer = null;

function cpioPintarPct(valor){
  const v = Math.max(0, Math.min(100, valor));
  const elPct = qs("#cpioPct"); if(elPct) elPct.textContent = Math.round(v) + "%";
  const anel = qs("#cpioProgresso");
  if(anel) anel.style.strokeDashoffset = String(CPIO_CIRCUNFERENCIA * (1 - v/100));
}

// v1089-2 — VIGIA POR TEMPO. Substitui a rede de segurança que fechava a tela no fim de
// processFile (e disparava no meio do salvamento). Toda vez que a importação dá sinal de vida, o
// relógio é rearmado; se ficar todo esse tempo sem nenhum sinal, a tela se fecha sozinha pra
// nunca prender ninguém. É folgado de propósito: uma conversa cheia de áudio pode demorar.
const CPIO_VIGIA_MS = 120000;
let _cpioVigia = null;
function cpioRearmarVigia(){
  clearTimeout(_cpioVigia);
  _cpioVigia = setTimeout(() => { try{ cpImportOverlayVisivel(false); }catch(_){} }, CPIO_VIGIA_MS);
}

function cpioPararAnimacao(){
  if(_cpioTimer){ clearInterval(_cpioTimer); _cpioTimer = null; }
}

function cpioAnimarAte(destino, teto){
  // Nunca volta atrás: se a tela já mostra mais do que o destino, mantém o que está escrito.
  _cpioAlvo = Math.max(_cpioMostrado, destino);
  _cpioTeto = Math.max(_cpioAlvo, teto);
  cpioPararAnimacao();
  _cpioTimer = setInterval(() => {
    // o alvo se arrasta em direção ao teto (cada vez mais devagar)…
    if(_cpioAlvo < _cpioTeto) _cpioAlvo += (_cpioTeto - _cpioAlvo) * 0.010;
    // …e o número exibido persegue o alvo, suavizando o movimento.
    const passo = (_cpioAlvo - _cpioMostrado) * 0.14;
    if(Math.abs(passo) < 0.01 && _cpioAlvo >= _cpioTeto - 0.05){ return; }
    _cpioMostrado += passo;
    cpioPintarPct(_cpioMostrado);
  }, 70);
}

function cpioZerar(){
  cpioPararAnimacao();
  _cpioMostrado = 0; _cpioAlvo = 0; _cpioTeto = 0;
  cpioPintarPct(0);
}

function cpImportOverlayAtualizar(idx, sub){
  const passo = CPIO_PASSOS[idx];
  if(!passo) return;
  const pct = CPIO_PCT[idx] ?? 0;
  if(idx === 6){
    // Concluído: vai direto e para de se mexer.
    cpioPararAnimacao();
    _cpioMostrado = 100; _cpioAlvo = 100; _cpioTeto = 100;
    cpioPintarPct(100);
  }else{
    // O teto é o percentual da etapa seguinte, com uma folga — o número nunca anuncia uma etapa
    // que ainda não começou.
    const proximo = CPIO_PCT[idx + 1] ?? 100;
    cpioAnimarAte(pct, Math.max(pct, proximo - 2));
  }
  const tit = qs("#cpioTitulo"); if(tit) tit.textContent = passo.rot;
  // O detalhe vindo do fluxo (ex.: "3/14 novos · 2 reaproveitados") é mais informativo que o
  // texto padrão — quando existe, ele manda.
  const det = qs("#cpioSub"); if(det) det.textContent = String(sub || passo.sub || "");
  const ol = qs("#cpioPassos");
  if(ol){
    ol.innerHTML = CPIO_PASSOS.slice(0, 6).map((p, i) => {
      const cls = i < idx ? "cpio-feito" : (i === idx ? "cpio-ativo" : "");
      return `<li class="${cls}"><span class="cpio-mk">${i < idx ? "✓" : ""}</span>${escapeHtml(p.rot)}</li>`;
    }).join("");
  }
}

// idx 0..5 = trabalho automático (cobre a tela). idx 6 = concluído (mostra "Pronto" e sai).
// idx 7 = falha recuperável (sai na hora, pro corretor ver o erro e os botões).
// opts.pausar = ponto em que o app ESPERA uma decisão dele (salvar/atualizar): a tela cheia sai
// de cena, senão os botões ficariam cobertos e a importação travaria de vez.
function cpImportOverlaySincronizar(idx, sub, opts){
  if(opts && opts.pausar){ cpImportOverlayVisivel(false); return; }
  if(idx >= 0 && idx <= 5){ cpImportOverlayAtualizar(idx, sub); cpImportOverlayVisivel(true); return; }
  if(idx === 6){
    // v1089-2 — Concluído mostra 100% e FICA. Antes ela sumia sozinha aos 650ms, mas o lead só
    // abre aos 800ms: nesses ~150ms a tela de importação reaparecia — era a segunda tela que
    // piscava, "mais uma vez antes de abrir o lead". Quem a fecha agora é o próprio abrirLead,
    // depois que o lead já está na tela (ver cpioFecharQuandoLeadAbrir). O relógio abaixo é só
    // uma saída de emergência, com folga, caso o lead não chegue a abrir.
    cpImportOverlayAtualizar(6, sub);
    cpImportOverlayVisivel(true);
    clearTimeout(cpImportOverlaySincronizar._t);
    cpImportOverlaySincronizar._t = setTimeout(() => cpImportOverlayVisivel(false), 6000);
    return;
  }
  cpImportOverlayVisivel(false);
}

// Exposta pra poder ser dirigida de fora (teste em navegador de verdade e diagnóstico): é o
// único ponto que decide se a tela cheia aparece, some ou espera uma decisão do corretor.
// Abre o lead com a tela cheia AINDA de pé e só a fecha depois — assim a troca é direto de
// "Pronto" pro cliente, sem a tela de importação aparecer no meio do caminho.
async function cpioFecharQuandoLeadAbrir(id){
  try{ if(id) await abrirLead(id); }
  catch(_){}
  finally{ try{ cpImportOverlayVisivel(false); }catch(_){} }
}
window.cpImportOverlaySincronizar = cpImportOverlaySincronizar;

// Bloqueia/reabilita os botões "Nova análise" e "Diagnóstico" da tela de
// importação. Durante o processamento (Recebendo…Salvando) eles não podem ser
// clicados; voltam a ficar ativos só quando a etapa chega em "Concluído" (ou
// numa falha recuperável, pra permitir recomeçar/diagnosticar).
function setBotoesImportacao(desabilitados){
  ["#clearAnalysis", "#diagnoseOpenAI"].forEach(sel => {
    const btn = qs(sel);
    if(!btn) return;
    btn.disabled = !!desabilitados;
    btn.classList.toggle("is-processando", !!desabilitados);
  });
}

function renderEtapas(idxAtual, sub, opts){
  // Etapas 0..5 (Recebendo…Salvando) = em andamento → botões travados.
  // Etapa 6 (Concluído) e 7 (Falha recuperável) → botões liberados.
  setBotoesImportacao(idxAtual >= 0 && idxAtual <= 5);
  // v1088 — a tela cheia da importação vem DEPOIS de travar os botões: se algo falhar aqui, os
  // botões já estão no estado certo. O try/catch mantém a importação andando mesmo que a tela
  // cheia não exista (é assim que os testes extraem esta função pra rodar contra um DOM falso).
  try{ cpImportOverlaySincronizar(idxAtual, sub, opts); }catch(_){}
  const ol = qs("#processingSteps");
  if(!ol) return;
  const etapasVisiveis = idxAtual === 7
    ? ETAPAS_PROCESSAMENTO
    : ETAPAS_PROCESSAMENTO.slice(0, 7);
  ol.innerHTML = etapasVisiveis.map((label, i) => {
    let icone = "", cor = "var(--muted)", peso = "400";
    if(i < idxAtual && idxAtual !== 7){ icone = "✓"; cor = "var(--acao)"; peso = "600"; }
    else if(i === idxAtual){ icone = idxAtual === 7 ? "!" : ""; cor = idxAtual === 7 ? "var(--morno)" : "var(--lime)"; peso = "950"; }
    const extra = (i === idxAtual && sub) ? ` <span style="color:var(--muted);font-weight:400">— ${escapeHtml(sub)}</span>` : "";
    return `<li style="padding:4px 0;color:${cor};font-weight:${peso}"><span style="display:inline-block;width:18px">${icone}</span>${escapeHtml(label)}${extra}</li>`;
  }).join("");
  const pctPorEtapa = [8, 32, 48, 70, 86, 94, 100, 100];
  const pct = pctPorEtapa[idxAtual] ?? 0;
  const bar = qs("#progressBar"); if(bar) bar.style.width = pct + "%";
  const txt = qs("#processingText");
  if(txt) txt.innerHTML = (idxAtual === 7 ? "" : '<span class="spinner"></span>') + escapeHtml(ETAPAS_PROCESSAMENTO[idxAtual]) + (sub ? ` — ${escapeHtml(sub)}` : "") + ` <span style="opacity:.7">(${pct}%)</span>`;
}

function startProgresso(){
  const bar = qs("#progressBar");
  bar?.classList.add("busy");
  renderEtapas(0);
  return {
    avancarPara: (idx, sub) => renderEtapas(idx, sub),
    atualizarSub: (sub) => renderEtapas(0, sub),
    finalizar: () => { renderEtapas(6); bar?.classList.remove("busy"); },
    parar: () => bar?.classList.remove("busy")
  };
}

function userFriendlyError(err,file){
  const raw=String(err?.message||err||"");
  if(raw.includes("Supabase") && raw.includes("configurado")){
    return `O servidor ainda não está pronto pra guardar conversas grandes. Tente novamente em alguns minutos.

Arquivo: ${file?.name||"ZIP"}
Tamanho: ${file?((file.size/1024/1024).toFixed(1)+" MB"):""}`;
  }
  if(raw.includes("Unexpected token")){
    return "O servidor demorou pra responder. Tente novamente em alguns segundos.";
  }
  if(raw.includes("Failed to fetch") || raw.includes("NetworkError")){
    return "Sem conexão com a internet ou o servidor caiu. Verifique sua conexão e tente novamente.";
  }
  if(raw.includes("aborted") || raw.includes("AbortError") || raw.includes("Demorou demais")){
    return "Demorou demais. O serviço de análise pode estar lento. Tente novamente em alguns minutos.";
  }
  if(/quota|insufficient|429|billing/i.test(raw)){
    return "A conta do provedor de análise está sem créditos. Confira o painel do provedor e tente de novo.";
  }
  if(/HTTP 4\d\d/i.test(raw)){
    return "O servidor não aceitou o arquivo. Verifique se é o ZIP exportado pelo WhatsApp (com texto e mídia).";
  }
  if(/A conversa foi lida|Falha na análise IA|análise comercial|IA não concluiu|não devolveu as 3 mensagens/i.test(raw)){
    return raw;
  }
  if(/HTTP 5\d\d/i.test(raw)){
    return raw.length < 260 ? raw : "O servidor teve um problema interno. Aguarde um minuto e tente novamente.";
  }
  // Sem casamento conhecido: mostra mensagem genérica + sugestão.
  if(raw.length > 200 || /[<>{}]/.test(raw)){
    return "Não foi possível processar este ZIP agora. Tente em alguns minutos ou reimporte uma conversa menor.";
  }
  return raw || "Não foi possível processar este ZIP agora.";
}


function normalizarJanelaAudioCliente(valor){
  const raw = String(valor ?? "").trim().toLowerCase();
  if(/^(all|todo|tudo|todos|inteiro|completo|0)$/i.test(raw)) return "all";
  const n = Number(raw);
  if([30,60,90].includes(n)) return String(n);
  return "90";
}

function rotuloJanelaAudio(valor){
  const v = normalizarJanelaAudioCliente(valor);
  return v === "all" ? "todo o período" : `últimos ${v} dias`;
}

// v827 §7.4 — Padrão persistente da janela de áudio. Vem do Cérebro ("dias de
// importação"), com uma chave ESTÁVEL (sem número de versão, que antes zerava a cada
// atualização) como reserva, e 90 como último recurso.
function janelaAudioPadrao(){
  try{
    const cfg = typeof obterCerebroConfigParaAnalise === "function" ? obterCerebroConfigParaAnalise() : null;
    if(cfg && Number(cfg.diasImportacao) > 0) return normalizarJanelaAudioCliente(String(cfg.diasImportacao));
  }catch(_){}
  try{ const s = localStorage.getItem("corretor_pro_audio_window_days"); if(s) return normalizarJanelaAudioCliente(s); }catch(_){}
  return "90";
}

function escolherPeriodoAudiosImportacao(){
  const salvo = janelaAudioPadrao();
  const opcoes = [
    { valor:"30", label:"30 dias" },
    { valor:"60", label:"60 dias" },
    { valor:"90", label:"90 dias" },
    { valor:"all", label:"Todo o período" }
  ];
  return new Promise((resolve) => {
    document.querySelector("#periodoAudioModal")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "periodoAudioModal";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
    overlay.innerHTML = `
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:24px;max-width:360px;width:100%">
        <div style="font-size:17px;font-weight:950;margin-bottom:4px">Período dos áudios</div>
        <div class="small" style="color:var(--muted);margin-bottom:16px">Áudios fora do período não são transcritos. As mensagens escritas entram completas em qualquer opção.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${opcoes.map(o => `<button type="button" class="periodoAudioBtn" data-valor="${o.valor}" style="padding:14px 8px;background:${o.valor===salvo?'var(--accent)':'transparent'};border:1px solid ${o.valor===salvo?'transparent':'var(--line)'};border-radius:10px;color:${o.valor===salvo?'var(--on-accent)':'var(--text)'};font-weight:950;cursor:pointer">${escapeHtml(o.label)}</button>`).join("")}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll(".periodoAudioBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const final = normalizarJanelaAudioCliente(btn.dataset.valor);
        // §7.4: a escolha na importação é exceção SÓ daquela importação — não vira o
        // padrão persistente (esse é ajustado no Cérebro). Fica só na sessão atual.
        state.ultimaJanelaAudio = final;
        overlay.remove();
        resolve(final);
      }, { once:true });
    });
  });
}

function criarImportId(){
  try{ if(globalThis.crypto?.randomUUID) return "imp-" + globalThis.crypto.randomUUID(); }catch(_){}
  return "imp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,12);
}

// v1022 — "por que nunca reaproveita nada?": o servidor já sabe reaproveitar a transcrição de
// uma importação que travou/deu timeout (o áudio já transcrito fica guardado, ligado ao MESMO
// importId — ver prepararExtracaoPersistente em api/processar-storage.js), MAS só se o
// corretor tentar de novo com o MESMO importId. state.activeImportId vive só na memória da
// aba: se o celular/navegador recarregar a página no meio de uma conversa grande (bem comum
// com ZIP grande demorando), essa memória some — a próxima tentativa gera um importId novo,
// perde a ligação com o que já foi transcrito, e transcreve tudo nas de novo do zero (o "0
// reaproveitados" sempre, mesmo repetindo o mesmo arquivo). Guarda no aparelho (localStorage)
// qual importId pertence a qual arquivo (nome+tamanho), pra uma nova tentativa com o MESMO
// arquivo reencontrar o importId anterior mesmo depois de a página recarregar.
const CP_IMPORT_PENDENTE_KEY = "cpImportPendente";
const CP_IMPORT_PENDENTE_VALIDADE_MS = 24 * 60 * 60 * 1000; // 24h — depois disso não faz sentido reaproveitar
function cpSalvarImportPendente(importId, file){
  try{
    if(!importId || !file) return;
    localStorage.setItem(CP_IMPORT_PENDENTE_KEY, JSON.stringify({
      importId, fileName: file.name, fileSize: file.size, ts: Date.now()
    }));
  }catch(_){}
}
function cpImportIdParaArquivo(file){
  try{
    if(!file) return "";
    const raw = localStorage.getItem(CP_IMPORT_PENDENTE_KEY);
    if(!raw) return "";
    const info = JSON.parse(raw);
    if(!info || !info.importId) return "";
    if(Date.now() - Number(info.ts||0) > CP_IMPORT_PENDENTE_VALIDADE_MS) return "";
    if(info.fileName !== file.name || Number(info.fileSize) !== file.size) return "";
    return String(info.importId);
  }catch(_){ return ""; }
}
function cpLimparImportPendente(){
  try{ localStorage.removeItem(CP_IMPORT_PENDENTE_KEY); }catch(_){}
}

async function uploadLargeZipToSupabase(file, options = {}){
  state.ultimoArquivo = file;
  const importId = String(options.importId || state.activeImportId || criarImportId());
  state.activeImportId = importId;
  renderEtapas(1, "preparando envio seguro");

  const metaRes = await fetch("./api/criar-upload-url", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      fileName:file.name,
      size:file.size,
      contentType:file.type || "application/zip",
      importId
    })
  });

  let meta;
  try{ meta = await metaRes.json(); }
  catch(e){ throw new Error("A rota de upload grande não respondeu em JSON."); }

  if(!metaRes.ok || !meta.ok){
    const partesErro = [
      meta.error,
      meta.details,
      meta.bucket ? `Armazenamento: ${meta.bucket}` : "",
      meta.bucketWarning ? `Aviso: ${meta.bucketWarning}` : ""
    ].filter(Boolean);
    throw new Error(partesErro.join("\n") || "Não foi possível preparar o upload grande.");
  }

  renderEtapas(1, "enviando a conversa");

  // Use a signed URL retornada pelo backend e faça PUT direto (compatível com Supabase).
  // Isso evita depender do cliente supabase-js no navegador para uploads assinados.
  const signedUrl = meta.signedUrl || meta.signedurl || meta.signed_url;
  if(!signedUrl){ throw new Error("Não consegui preparar o envio agora. Tente novamente em alguns segundos."); }

  // Enviar com XHR para acompanhar progresso
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/zip');
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = function(evt){
      if(evt.lengthComputable){
        const pct = Math.round((evt.loaded/evt.total)*60) + 20; // map progress into 20-80%
        qs("#progressBar").style.width = Math.min(95, pct) + "%";
      }
    };
    xhr.onload = function(){
      if(xhr.status>=200 && xhr.status<300){ resolve(); return; }
      let detail = (xhr.responseText || '').slice(0, 400);
      try{
        const parsed = JSON.parse(xhr.responseText);
        detail = parsed.message || parsed.error || parsed.statusText || detail;
      }catch(_){}
      const sizeMb = (file.size/1024/1024).toFixed(1);
      reject(new Error('O envio da conversa não foi aceito (o arquivo pode estar grande demais — ' + sizeMb + ' MB). Tente uma conversa menor ou tente de novo em instantes.'));
    };
    xhr.onerror = function(){ reject(new Error('Falha de conexão durante o envio. Verifique a internet e tente novamente.')); };
    xhr.send(file);
  });

  qs("#progressBar").style.width="80%";
  state.ultimoUploadStorage = { bucket: meta.bucket, path: meta.path, importId };

  // Processa em ETAPAS (cada chamada cabe nos 10s do servidor):
  // 1) preparar → 2) transcrever em lotes → 3) analisar
  let analysisData;
  try{
    analysisData = await processarStorageEmEtapas(meta.bucket, meta.path, file.name, { audioWindowDays: options.audioWindowDays || state.ultimaJanelaAudio || "90", importId });
  }catch(err){
    // Falha terminal desta etapa: libera de novo "Nova análise" e "Diagnóstico"
    // pra o corretor poder recomeçar ou diagnosticar (este ramo não passa por
    // renderEtapas, então precisa reabilitar os botões explicitamente).
    setBotoesImportacao(false);
    qs("#progressBar").style.width="100%";
    const ehTimeout = err?.name === "AbortError" || /aborted|abort/i.test(String(err?.message||""));
    qs("#processingText").textContent = ehTimeout ? "Demorou demais — servidor não respondeu." : "Não foi possível analisar.";
    qs("#resultBox").className="notice error";
    qs("#resultBox").innerHTML =
      "<b>Não foi possível analisar a conversa agora.</b><br><br>" +
      escapeHtml(userFriendlyError(err, file)) +
      `<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn" id="btnRetomarAnalise" style="flex:1;min-width:180px">Tentar analisar novamente</button><button type="button" class="btn secondary" id="btnDescartarUpload" style="flex:1;min-width:140px">Descartar importação</button></div>`;
    qs("#btnRetomarAnalise")?.addEventListener("click", async () => {
      const stored = state.ultimoUploadStorage;
      if(stored?.bucket && stored?.path){
        qs("#processingText").textContent = "Tentando de novo (sem reenviar o ZIP)...";
        try{
          const data = await processarStorageEmEtapas(stored.bucket, stored.path, file.name, { audioWindowDays: options.audioWindowDays || state.ultimaJanelaAudio || "90", importId: stored.importId || importId });
          qs("#progressBar").style.width="100%";
          qs("#processingText").textContent="Conversa processada.";
          renderProcessedResult(data, { fileName: file.name, fileSize: file.size, source:"storage-retry", bucket: stored.bucket, path: stored.path, importId: stored.importId || importId });
          // O ZIP compartilhado permanece pendente até o lead ser salvo, atualizado ou descartado.
          // Se o app fechar nesta tela, a conversa pode ser recuperada sem nova exportação.
          toast("Conversa processada. Confira e salve o lead.");
        }catch(e2){ toast("Ainda falhou: " + userFriendlyError(e2, file)); }
        return;
      }
      if(state.ultimoArquivo){ state.processing = false; processFile(state.ultimoArquivo); }
    });
    qs("#btnDescartarUpload")?.addEventListener("click", async () => {
      const msgDescartarUp = "Descartar esta importação e apagar os arquivos temporários?";
      const okDescartarUp = (typeof cp903Confirm === "function")
        ? await cp903Confirm({ titulo: "Descartar importação", mensagem: msgDescartarUp, ok: "Descartar", perigo: true })
        : confirm(msgDescartarUp);
      if(!okDescartarUp) return;
      const stored = state.ultimoUploadStorage;
      if(stored) await finalizarImportacaoStorage(stored);
      const shareId = String(state.pendingSharedRecordId || "");
      if(shareId) await finalizarSharePendente(shareId);
      state.ultimoUploadStorage = null;
      state.activeImportId = null;
      cpLimparImportPendente();
      state.ultimoArquivo = null;
      clearAnalysis();
      toast("Importação descartada.");
    });
    toast(ehTimeout ? "Tempo esgotado numa das etapas." : "Erro na análise.");
    return false;
  }

  qs("#progressBar").style.width="100%";
  qs("#processingText").textContent="Conversa processada.";
  renderProcessedResult(analysisData, { fileName: file.name, fileSize: file.size, source: "storage", bucket: meta.bucket, path: meta.path, importId });
  toast("ZIP processado. Confira e clique em Salvar lead.");
  return true;
}

// Orquestra o processamento em 3 etapas, cada chamada curta o suficiente pro servidor.
// O ZIP é baixado e extraído uma única vez; os lotes usam os áudios persistidos da extração.
async function processarStorageEmEtapas(bucket, path, fileName, options = {}){
  const importId = String(options.importId || state.activeImportId || "");
  if(!importId) throw new Error("Identificador da importação ausente.");
  async function chamar(payload, timeoutMs){
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs || 30000);
    try{
      const res = await fetch("./api/processar-storage", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ bucket, path, importId, cerebroConfig: obterCerebroConfigParaAnalise(), ...payload }), signal: ctrl.signal
      });
      const data = await res.json().catch(() => ({ ok:false, error:"Resposta inválida do servidor." }));
      if(!res.ok || !data.ok){
        const partes = [data.error, data.details, data.hint].filter(Boolean);
        const erro = new Error(partes.length ? partes.join("\n") : ("Erro HTTP "+res.status));
        erro.recoverable = data.recoverable === true;
        throw erro;
      }
      return data;
    } finally { clearTimeout(to); }
  }

  renderEtapas(2, "baixando e extraindo uma única vez");
  // v1024 — dono relatou "tempo esgotado" em várias importações hoje, resolvido só ao tentar de
  // novo manualmente (2ª/3ª vez). Achado real: os prazos daqui (90s/70s/150s) são maiores que o
  // limite de 60s configurado pro servidor (vercel.json, maxDuration:60) — um ZIP grande o
  // bastante pra passar de 60s aqui é MORTO pela Vercel antes do navegador desistir sozinho, sem
  // chance de terminar. "transcrever" já tentava de novo automaticamente (1x); preparar/analisar
  // não tinham essa rede — agora têm, igual à transcrição. Reaproveita o manifesto já preparado
  // (prepararExtracaoPersistente é idempotente pro mesmo importId) e não repete cobrança de IA
  // além do necessário ("analisar" não grava nada no banco; só "Salvar lead" grava).
  let prep = null, erroPrep = null;
  for(let tentativa=1; tentativa<=2 && !prep; tentativa++){
    try{ prep = await chamar({ action:"preparar", audioWindowDays:options.audioWindowDays || "90" }, 90000); }
    catch(error){ erroPrep=error; if(tentativa<2) await new Promise(r=>setTimeout(r,1200)); }
  }
  if(!prep) throw erroPrep || new Error("Falha recuperável ao preparar a importação.");
  const transcriptionMap = { ...(prep.cachedTranscriptions || {}) };
  const audiosTodos = Array.isArray(prep.audiosParaTranscrever) ? prep.audiosParaTranscrever : [];
  // v1027 — causa real de "reaproveitados" sempre 0 (mesmo reimportando o MESMO ZIP de
  // propósito, pra testar): esta função forçava minúsculas na chave de busca, mas o servidor
  // (normalizeName, api/_pipeline.js) NUNCA lowercasa — e nome de áudio do WhatsApp quase
  // sempre vem com prefixo maiúsculo ("AUD-...", "PTT-..."). "aud-123.opus" nunca batia com a
  // chave real "AUD-123.opus" guardada no manifesto: a busca sempre falhava, o contador sempre
  // mostrava 0 E o app retranscrevia (de novo, pagando de novo) áudio que já tinha cache pronto.
  const normalizarAudio = (v) => String(v || "").split(/[\\/]/).pop().trim();
  const audios = audiosTodos.filter(nome => !transcriptionMap[normalizarAudio(nome)]?.text);
  const audiosReaproveitados = audiosTodos.length - audios.length;

  if(audios.length){
    const LOTE = 3;
    for(let i=0; i<audios.length; i+=LOTE){
      const lote = audios.slice(i,i+LOTE);
      renderEtapas(3, `${Math.min(i+LOTE,audios.length)}/${audios.length} novos · ${audiosReaproveitados} reaproveitados`);
      let resposta = null, ultimoErro = null;
      for(let tentativa=1; tentativa<=2 && !resposta; tentativa++){
        try{ resposta = await chamar({ action:"transcrever", audioNames:lote }, 70000); }
        catch(error){ ultimoErro=error; if(tentativa<2) await new Promise(r=>setTimeout(r,1200)); }
      }
      if(!resposta) throw ultimoErro || new Error("Falha recuperável ao transcrever os áudios.");
      Object.assign(transcriptionMap, resposta.transcriptions || {});
    }
  }else{
    renderEtapas(3, audiosReaproveitados ? `${audiosReaproveitados} transcrição(ões) reaproveitada(s)` : "sem áudio para transcrever");
  }

  renderEtapas(4, "validando as três mensagens pelo Cérebro");
  // v1024 — mesma rede de segurança da etapa "preparar" acima: "analisar" não grava nada no
  // banco (só devolve o resultado pro navegador — quem grava é "Salvar lead", ação separada e
  // explícita), então repetir aqui não duplica nem gasta 2x à toa em caso de sucesso.
  let result = null, erroAnalise = null;
  for(let tentativa=1; tentativa<=2 && !result; tentativa++){
    try{
      result = await chamar({
        action:"analisar",
        txtFile:prep.txtFile,
        messages:prep.messages,
        audioFilesRelevantes:prep.audioFilesRelevantes,
        audioFilesForaDaJanela:prep.audioFilesForaDaJanela,
        transcriptionMap,
        janelaConversa:prep.janelaConversa,
        ignoredFilesCount:prep.ignoredFilesCount,
        ignoredFiles:prep.ignoredFiles,
        audiosTotalNoZip:prep.audiosTotalNoZip,
        audiosDescartadosPorJanela:prep.audiosDescartadosPorJanela,
        metricsBase:prep.metricsBase,
        audiosReaproveitados,
        audiosNovosSolicitados:audios.length
      }, 150000);
    }catch(error){ erroAnalise=error; if(tentativa<2) await new Promise(r=>setTimeout(r,1200)); }
  }
  if(!result) throw erroAnalise || new Error("Falha recuperável ao analisar a conversa.");
  const msgs = result?.analysis?.messages || {};
  if(result?.analysis?.sugestoesPendentes === true || ![msgs.a,msgs.b,msgs.c].every(v=>String(v||"").trim().length>=10)){
    throw new Error("A análise permanece pendente porque uma das três mensagens não passou pelas regras do Cérebro.");
  }
  result.importId = importId;
  // v1069 — bug real relatado pelo dono: "Análises feitas" (Desempenho) só contava reanálise
  // manual de um lead já existente (ui670Reanalisar/"Reanalisar todos"); a análise que a IA faz
  // em TODA importação nova (esta etapa "analisar", que roda pra cada ZIP processado) nunca
  // registrava atividade — por isso "Importações" (90) e "Análises feitas" (19) nunca batiam,
  // mesmo cada importação passando pela IA. Conta aqui, no sucesso real da análise.
  try{ cpRegistrarAtividade("analise"); }catch(_){}
  // v1089 — esta etapa NÃO esconde mais a tela cheia. No caminho normal (a esmagadora maioria) o
  // app salva sozinho logo em seguida — não há confirmação nenhuma pra pedir. Esconder aqui fazia
  // a tela de importação, com os cartões, aparecer por um instante e a tela cheia voltar logo
  // depois: era a "tela que aparecia no meio da análise e voltava pro carregamento" que o dono
  // relatou. Quem esconde agora é só o ÚNICO caso que realmente espera uma decisão dele (nome só
  // parecido — ver renderProcessedResult).
  renderEtapas(5, "preparando pra salvar");
  return result;
}

// ============ RENDERIZAÇÃO + SALVAR/DESCARTAR ============
async function renderProcessedResult(data, meta){
 try{
  const lead = data.lead || {};
  const analysis = data.analysis || {};
  const _msgsAnalise = analysis?.messages || {};
  const _temTrioAnalise = [_msgsAnalise.a, _msgsAnalise.b, _msgsAnalise.c].every(v => String(v || "").trim().length >= 10);
  if(!analysis || analysis.mode === "erro_api" || analysis.mode === "sem_api" || analysis.sugestoesPendentes === true || !_temTrioAnalise){
    throw new Error(analysis?.error || (analysis?.validacaoSugestoes || []).join("; ") || "A análise comercial não foi concluída; tente novamente.");
  }
  state.lead = limparLead({
    name: lead.clientName || "Cliente importado",
    product: lead.product || "Produto não identificado",
    status: "Conversa processada (não salvo)",
    bestTime: analysis.bestTime || "—",
    id: null
  });
  state.pendingSave = {
    result: data,
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    source: meta.source,
    bucket: meta.bucket || null,
    path: meta.path || null,
    importId: meta.importId || data.importId || state.activeImportId || null,
    cerebroConfig: obterCerebroConfigParaAnalise()
  };

  qs("#clientName").value = state.lead.name;
  renderAnalysis(analysis, state.lead);

  const j = data.janelaConversa;
  const janelaHtml = (j && (j.tipo === "audio" || j.aplicado || j.todoPeriodo)) ?
    `<div style="margin-top:10px;padding:10px 12px;background:rgba(55,232,255,.06);border:1px solid rgba(55,232,255,.22);border-radius:10px;font-size:13px"><b style="color:var(--dados)">Período dos áudios:</b> ${j.todoPeriodo ? "todo o período" : `últimos ${j.dias} dias (${escapeHtml(j.janelaDe||"")} → ${escapeHtml(j.janelaAte||"")})`}. As mensagens escritas foram importadas completas. Áudios dentro do período: ${Number(j.totalAudiosNoPeriodo ?? (data.audioFiles||[]).length)} · fora do período: ${Number(data.audiosDescartadosPorJanela||j.totalAudiosForaDoPeriodo||0)}. <a href="#" onclick="show('cerebro');return false" style="color:var(--lime);text-decoration:underline">ajustar padrão</a></div>` : "";

  const sm = data.metrics || {};
  const semMidiaHtml = sm.exportadoSemMidia ? `<div style="margin-top:10px;padding:11px 13px;background:rgba(184,194,201,.1);border:1px solid var(--morno);border-radius:10px;font-size:13px;color:var(--soft)"><b>⚠️ Conversa exportada SEM mídia.</b> ${Number(sm.midiasOcultas)||0} mídia(s) ficaram ocultas — os <b>áudios não vieram no arquivo</b> e não dá pra transcrever. Pra incluir os áudios (importantes pra análise), reexporte a conversa no WhatsApp escolhendo <b>"Incluir mídia"</b> e importe de novo.</div>` : "";
  const inc = data.incrementalMeta || {};
  const incrementalHtml = inc.reimportacao ? `<div style="margin-top:10px;padding:11px 13px;background:rgba(104,255,149,.08);border:1px solid rgba(104,255,149,.30);border-radius:10px;font-size:13px;color:#bdffd0"><b>Atualização incremental:</b> ${Number(inc.mensagensNovas)||0} mensagem(ns) nova(s) · ${Number(inc.audiosNovosTranscritos)||0} áudio(s) novo(s) transcrito(s) · ${Number(inc.audiosReaproveitados)||0} áudio(s) reaproveitado(s).${inc.analiseReutilizada ? " Nenhuma novidade encontrada." : " A análise foi refeita sem reutilizar sugestão antiga."}</div>` : "";

  // Telefone é apenas dado auxiliar. A decisão de unir ou separar é acionada somente
  // quando o nome exportado coincide (ou se parece) com um nome já salvo.
  const match = await acharLeadExistente(state.lead.name);
  const existente = match?.lead || null;
  state.pendingExistente = existente;
  const perguntarNome = !!existente;
  const nomeSoParecido = perguntarNome && match.via === "nome-parecido";
  let acoesHtml;
  if(nomeSoParecido){
    // Nome mudou entre importações (ex.: contato editado no celular) mas não é idêntico ao
    // salvo — NUNCA funde sozinho aqui (ver nomesParecemMesmoCliente). Antes disso, esse caso
    // caía direto no "senão" abaixo e criava um cadastro novo em silêncio, sem avisar o
    // corretor, gerando duplicata (o cliente ficava com dois cadastros e o mais antigo parado
    // "esquecido" enquanto o novo tinha a conversa atualizada).
    acoesHtml =
      `<div id="pendingBox" style="margin-top:14px;padding:12px;background:rgba(184,194,201,.08);border:1px solid var(--morno);border-radius:12px;color:var(--soft)"><b>Pode ser o mesmo cliente que já existe: “${escapeHtml(existente.name || "")}”.</b><br>O nome desta importação (“${escapeHtml(state.lead.name)}”) é parecido, mas não idêntico. É o mesmo cliente?</div>` +
      `<div id="pendingActions" style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap"><button type="button" id="btnAtualizarLead" class="btn" style="flex:1;min-width:160px">Sim, é o mesmo — atualizar</button><button type="button" id="btnSalvarComoNovo" class="btn secondary" style="flex:1;min-width:160px">Não, é outro — salvar novo</button><button type="button" id="btnDescartarLead" class="btn secondary" style="flex:1;min-width:120px">Cancelar</button></div>`;
  }else if(perguntarNome){
    // v953 — pedido do dono: quando o nome bate EXATO (não "parecido"), não pergunta mais.
    // Ele nunca usou a opção "é outro" nesse caso. Atualiza direto; os botões ficam ocultos
    // só como caminho de retomada manual se a chamada automática falhar (ver mais abaixo).
    acoesHtml =
      `<div id="pendingBox" style="margin-top:14px;padding:12px;background:rgba(104,255,149,.08);border:1px solid rgba(104,255,149,.32);border-radius:12px;color:#bdffd0"><b>Cliente existente identificado: “${escapeHtml(existente.name || state.lead.name)}”.</b><br>Atualizando o cadastro automaticamente, sem criar duplicata.</div>` +
      `<div id="pendingActions" style="display:none;gap:10px;margin-top:12px;flex-wrap:wrap"><button type="button" id="btnAtualizarLead" class="btn" style="flex:1;min-width:160px">Atualizar cliente</button><button type="button" id="btnDescartarLead" class="btn secondary" style="flex:1;min-width:120px">Cancelar</button></div>`;
  }else{
    acoesHtml =
      `<div id="pendingBox" style="margin-top:14px;padding:12px;background:rgba(104,255,149,.08);border:1px solid rgba(104,255,149,.32);border-radius:12px;color:#bdffd0"><b>Salvando o lead...</b> Já abre com a análise.</div>` +
      `<div id="pendingActions" style="display:none;gap:10px;margin-top:12px;flex-wrap:wrap"><button type="button" id="btnSalvarLead" class="btn" style="flex:1;min-width:160px">Salvar lead</button><button type="button" id="btnDescartarLead" class="btn secondary" style="flex:1;min-width:160px">Cancelar</button></div>`;
  }

  qs("#resultBox").className = "small";
  qs("#resultBox").innerHTML =
    acoesHtml +
    `<div style="margin-top:14px">` +
    `<b>TXT:</b> ${escapeHtml(data.txtFile || meta.fileName)}<br>` +
    `<b>Áudios no histórico:</b> ${(data.audioFiles || []).length} · <b>transcritos:</b> ${data.audiosTranscritos || 0} · <b>com erro:</b> ${data.audiosComErro || 0}<br>` +
    `<b>Arquivos ignorados:</b> ${data.ignoredFilesCount || 0}<br>` +
    `<b>Resumo:</b> ${escapeHtml(analysis.summary || "Conversa processada.")}<br>` +
    janelaHtml + semMidiaHtml + incrementalHtml +
    `</div>` +
    openAIErrorBlock(data);
  showCard("resultCard", true); showCard("timelineCard", true); showCard("goToTimelineCard", true);
  // Decisão "é o mesmo / é outro" (nome só parecido, ambíguo de verdade): traz a pergunta pra
  // vista, senão fica embaixo e parece que travou. Nome exato não pergunta mais (v953) — sem
  // pergunta, sem precisar trazer pra vista.
  if(nomeSoParecido){
    setTimeout(() => { (qs("#pendingBox") || qs("#resultCard"))?.scrollIntoView({ behavior:"smooth", block:"center" }); }, 80);
  }

  const timeline = (data.timeline || []).slice(-200).map(m =>
    `<div class="event"><b>${escapeHtml((m.date || "") + " " + (m.time || "") + " — " + (m.author || ""))}</b><p>${escapeHtml(m.text || "")}</p></div>`
  ).join("");
  qs("#timeline").innerHTML = timeline || '<div class="event"><b>Conversa recebida</b><p>Arquivo processado.</p></div>';

  qs("#btnSalvarLead")?.addEventListener("click", salvarLeadPendente);
  qs("#btnSalvarComoNovo")?.addEventListener("click", salvarLeadPendente);
  qs("#btnDescartarLead")?.addEventListener("click", descartarLeadPendente);
  qs("#btnAtualizarLead")?.addEventListener("click", atualizarLeadComEvolucao);
  if(nomeSoParecido){
    // Nome só parecido (não idêntico): espera o corretor confirmar se é o mesmo cliente ou
    // outro — a única ambiguidade real que ainda pergunta (ver v953 acima).
    // v1089 — É AQUI, e só aqui, que a tela cheia sai de cena: é o único momento em que a
    // importação para de verdade pra ouvir uma decisão. Sem isso, a pergunta ficaria coberta.
    try{ cpImportOverlayVisivel(false); }catch(_){}
  }else if(perguntarNome){
    // Nome exato: já sabemos que é o mesmo cliente — atualiza direto, sem perguntar (v953).
    atualizarLeadComEvolucao();
  }else{
    salvarLeadPendente();
  }
 }catch(err){
  // Antes: erro aqui virava tela travada em silêncio (função chamada sem await/catch). Agora avisa.
  try{ cpImportOverlayVisivel(false); }catch(_){}
  const box = qs("#resultBox");
  if(box){
    box.className = "notice error";
    box.innerHTML = "<b>Deu erro ao mostrar o resultado.</b><br><br>" + escapeHtml(String(err?.message||err)) +
      `<div style="margin-top:14px"><button type="button" class="btn" onclick="location.reload()">Recarregar</button></div>`;
  }
  toast("Erro ao processar o resultado: " + (err?.message||err));
 }
}

// Divide um nome em palavras normalizadas (sem acento/maiúscula/pontuação) pra comparação.
function _palavrasNome(valor){
  return String(valor || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
    .split(" ").filter(Boolean);
}

// Detecta nome "quase igual" a um lead já salvo: acontece quando o corretor edita o nome
// do contato no celular entre uma importação e outra (ex.: acrescenta o empreendimento —
// "Fulano" vira "Fulano Empreendimento Tal"). Exige que as DUAS primeiras palavras (nome +
// sobrenome) sejam idênticas e que todas as palavras do nome mais curto apareçam, na mesma
// ordem, dentro do nome mais longo — só palavras A MAIS no meio/fim são toleradas. Isso NUNCA
// decide fusão sozinho (ver acharLeadExistente/renderProcessedResult): só sinaliza a dúvida
// pro corretor confirmar, porque nome parecido pode muito bem ser outra pessoa.
function nomesParecemMesmoCliente(nomeA, nomeB){
  const a = _palavrasNome(nomeA);
  const b = _palavrasNome(nomeB);
  if(a.length < 2 || b.length < 2) return false;
  if(a[0] !== b[0] || a[1] !== b[1]) return false;
  const [menor, maior] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  for(const palavra of maior){
    if(i < menor.length && palavra === menor[i]) i++;
  }
  return i >= menor.length;
}

// Procura na base inteira um lead com o mesmo nome técnico (maiúsculas, espaços e acentos ignorados)
// e, na ausência desse, um lead com nome só PARECIDO (ver nomesParecemMesmoCliente acima).
// Nomes apenas parecidos e telefone nunca decidem uma fusão automática — só levantam a pergunta.
async function acharLeadExistente(nome){
  const norm = (valor) => String(valor || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
  const alvo = norm(nome);
  if(alvo.length < 2) return null;
  let leads = state.leads || [];
  try{
    const data = await getLeadsData(true);
    if(Array.isArray(data?.items)) leads = data.items.map(limparLead);
  }catch(_){}
  const exato = leads.find(l => l?.id && norm(l.name) === alvo);
  if(exato) return { lead:exato, via:"nome-exato" };
  const parecido = leads.find(l => l?.id && nomesParecemMesmoCliente(nome, l.name));
  return parecido ? { lead:parecido, via:"nome-parecido" } : null;
}

async function finalizarImportacaoStorage(pending){
  const bucket = pending?.bucket, path = pending?.path, importId = pending?.importId;
  if(!bucket || !path || !importId) return { ok:true, skipped:true };
  try{
    const res = await fetch("./api/processar-storage", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ action:"finalizar", bucket, path, importId })
    });
    const data = await res.json().catch(()=>({ok:false,error:"Resposta inválida ao limpar a importação."}));
    if(!res.ok || !data.ok) throw new Error(data.error || "Não foi possível limpar os arquivos temporários.");
    return data;
  }catch(error){
    console.warn("Importação salva, mas limpeza temporária ficou pendente:", error?.message || error);
    return { ok:false, pending:true, error:error?.message || String(error) };
  }
}

async function limparImportacoesRemotasAntigas(){
  const chave = "corretor_pro_import_cleanup_at";
  const intervalo = 24 * 60 * 60 * 1000;
  try{
    const ultima = Number(localStorage.getItem(chave) || 0);
    if(ultima && Date.now() - ultima < intervalo) return;
  }catch(_){ }
  try{
    const res = await fetch("./api/processar-storage", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ action:"limpar-antigos", activeImportId:state.activeImportId || null })
    });
    const data = await res.json().catch(()=>({ok:false}));
    if(!res.ok || !data.ok) throw new Error(data.error || "Falha na limpeza remota.");
    try{ localStorage.setItem(chave, String(Date.now())); }catch(_){ }
  }catch(error){
    console.warn("Limpeza remota de importações antigas ignorada:", error?.message || error);
  }
}

async function confirmarAtualizacaoPersistida(id, importId, totalMensagensEsperado){
  const leadId = String(id || "").trim();
  if(!leadId) throw new Error("O servidor não devolveu o cadastro atualizado.");
  const token = String(importId || "").trim();
  let ultimoErro = null;
  for(let tentativa = 0; tentativa < 3; tentativa++){
    if(tentativa) await new Promise(r => setTimeout(r, 450 * tentativa));
    // v1028 — esta espera (até 3 tentativas, cada uma com até 20s de tempo limite) não mostrava
    // NENHUM progresso na tela — pra um lead com conversa longa (dezenas/centenas de áudios),
    // a etiqueta "Salvando" ficava parada o tempo todo, parecendo travado. Agora atualiza a
    // etapa visível a cada tentativa, mesmo sem nada de errado acontecer.
    renderEtapas(5, tentativa === 0 ? "confirmando gravação no banco de dados..." : `confirmando gravação no banco de dados (tentativa ${tentativa + 1} de 3)...`);
    try{
      invalidarLeadDetail(leadId);
      const res = await fetchComTimeout(`./api/lead-update?action=detalhe&id=${encodeURIComponent(leadId)}&_=${Date.now()}`, { cache:"no-store" }, 20000);
      const data = await res.json().catch(()=>({ok:false}));
      if(!res.ok || !data?.ok || !data?.item) throw new Error(data?.error || "O banco não confirmou a atualização.");
      const item = limparLead(data.item);
      const salvoToken = String(item?.analysis?._ultimaImportacao?.importId || "").trim();
      const totalSalvo = Number(item?.messageCount || item?.recentMessages?.length || 0);
      const tokenOk = !token || salvoToken === token;
      const timelineOk = !Number.isFinite(Number(totalMensagensEsperado)) || totalSalvo >= Number(totalMensagensEsperado || 0);
      if(tokenOk && timelineOk) return item;
      ultimoErro = new Error(`A atualização ainda não foi confirmada no banco (${totalSalvo} de ${Number(totalMensagensEsperado||0)} mensagens).`);
    }catch(error){ ultimoErro = error; }
  }
  throw ultimoErro || new Error("O banco não confirmou a atualização. O ZIP foi mantido para tentar novamente.");
}

async function atualizarLeadComEvolucao(){
  const existente = state.pendingExistente;
  if(!existente?.id || !state.pendingSave){ toast("Nada pra atualizar."); return; }
  const btn = qs("#btnAtualizarLead");
  if(btn){ btn.disabled = true; btn.textContent = "Atualizando..."; }
  // v1028 — mesma correção do salvamento novo: mostra progresso de verdade em vez de deixar a
  // etiqueta "Salvando" parada (ver confirmarAtualizacaoPersistida logo acima).
  renderEtapas(5, "salvando a atualização no banco de dados...");
  try{
    // v1080 — mesma correção do salvamento novo: este fetch não tinha limite de tempo e podia
    // travar a tela em "Salvando..." pra sempre se a rede engasgasse.
    const res = await fetchComTimeout("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action: "atualizar-com-evolucao", id: existente.id, result: state.pendingSave.result, importId: state.pendingSave.importId, cerebroConfig: state.pendingSave.cerebroConfig })
    }, 45000);
    const data = await res.json().catch(()=>({ok:false,error:"Resposta inválida do servidor."}));
    if(!res.ok || !data.ok) throw new Error(data.error || "Erro ao atualizar.");
    const importacaoConcluida = state.pendingSave;
    const totalEsperado = Number(data.totalMensagens || importacaoConcluida?.result?.timeline?.length || 0);
    const confirmado = await confirmarAtualizacaoPersistida(existente.id, importacaoConcluida?.importId, totalEsperado);
    const incrementalMeta = state.pendingSave?.result?.incrementalMeta || null;
    const shareConcluidoId = String(state.pendingSharedRecordId || "");
    renderEtapas(5, "liberando os arquivos temporários da importação...");
    const limpeza = await finalizarImportacaoStorage(importacaoConcluida);
    state.pendingSave = null;
    state.activeImportId = null;
    cpLimparImportPendente();
    state.ultimoUploadStorage = null;
    state.pendingExistente = null;
    const ev = data.evolucao;
    const juntou = !incrementalMeta?.reimportacao && Number(data.preservadasDoAntigo||0) > 0; // no fluxo incremental, o servidor recebeu só as novidades de propósito
    const primeiroNome = (existente.name||"").split(" ")[0] || "o lead";
    const pendingBox = qs("#pendingBox");
    if(pendingBox){
      pendingBox.style.background = "rgba(104,255,149,.08)";
      pendingBox.style.borderColor = "rgba(104,255,149,.32)";
      pendingBox.style.color = "#bdffd0";
      let txt = "<b>Atualizado.</b> ";
      if(incrementalMeta?.reimportacao){
        const nMsg = Number(incrementalMeta.mensagensNovas)||0;
        const nAudio = Number(incrementalMeta.audiosNovosTranscritos)||0;
        const nReuso = Number(incrementalMeta.audiosReaproveitados)||0;
        txt += nMsg === 0
          ? `Nenhuma mensagem nova encontrada; mantive a análise anterior sem nova cobrança de texto. `
          : `${nMsg} mensagem(ns) nova(s) incorporada(s) · ${nAudio} áudio(s) novo(s) transcrito(s) · ${nReuso} reaproveitado(s). `;
      } else if(juntou) txt += `Juntei as duas conversas (mantive ${data.preservadasDoAntigo} mensagem(ns) que só estavam na conversa anterior). `;
      if(ev){
        txt += `O que mudou: ${escapeHtml(ev.oQueMudou||"—")}. `;
        if(ev.abordagemFuncionou && ev.abordagemFuncionou !== "sem-dados") txt += `Abordagem anterior: <b>${escapeHtml(ev.abordagemFuncionou)}</b>. `;
        if(ev.licao && ev.licao !== "sem lição clara ainda") txt += `Lição: ${escapeHtml(ev.licao)}`;
      }
      if(!limpeza.ok) txt += " <b>O lead foi salvo; a limpeza temporária ficou programada para nova tentativa.</b>";
      pendingBox.innerHTML = txt;
    }
    toast(incrementalMeta?.reimportacao
      ? `${primeiroNome} atualizado: ${Number(incrementalMeta.mensagensNovas)||0} mensagem(ns) nova(s).`
      : (juntou ? "Conversas juntadas e lead atualizado." : "Lead atualizado com evolução."));
    // Mesma correção do salvar: sem zerar o cache de 5 min, a Carteira seguia mostrando o
    // lead como estava ANTES da atualização (ainda em "preparação").
    invalidarLeadsCache();
    state.lead = confirmado;
    state.analysis = confirmado.analysis || null;
    await loadRecentLeads(true); refreshAllSections();
    if(shareConcluidoId) await finalizarSharePendente(shareConcluidoId);
    qs("#pendingActions")?.remove();
    renderEtapas(6, "lead atualizado e importação confirmada");
    // v1080 — só agora (importação de verdade concluída) o card de instruções volta a
    // aparecer; ver a marcação "concluidaComSucesso" em processFile.
    qs("#importCard")?.classList.remove("cp-import-rodando");
    setTimeout(() => { cpioFecharQuandoLeadAbrir(existente.id); }, 800);
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Atualizar"; }
    const pa = qs("#pendingActions"); if(pa) pa.style.display = "flex"; // mostra botões pra tentar de novo
    qs("#importCard")?.classList.remove("cp-import-rodando");
    // v1088 — mesma rede de segurança do salvar: a tela cheia sai pro corretor ver o aviso.
    try{ cpImportOverlayVisivel(false); }catch(_){}
    toast("Não foi possível atualizar: " + userFriendlyError(err));
  }
}

async function salvarLeadPendente(){
  if(!state.pendingSave){ toast("Nada pra salvar."); return; }
  const btn = qs("#btnSalvarLead");
  if(btn){ btn.disabled = true; btn.textContent = "Salvando..."; }
  // v1028 — a etiqueta "aguardando confirmação para salvar" ficava parada a tela toda enquanto
  // o lead (podendo ter uma conversa longa, com muitas mensagens/áudios) era gravado no banco —
  // sem nenhum movimento visível, parecia que tinha travado. Mostra progresso de verdade.
  renderEtapas(5, "salvando no banco de dados...");
  try{
    // v1080 — este fetch não tinha NENHUM limite de tempo: se a rede travasse (ex.: celular
    // reconectando depois de voltar de outro app), a tela ficava presa em "Salvando..." pra
    // sempre, sem erro nenhum aparecer (print do dono: parada em 94% por minutos). Agora usa
    // o mesmo limite generoso das outras gravações no banco (Desmarcar atendimento etc.).
    const res = await fetchComTimeout("./api/lead-update", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action: "salvar-novo", ...state.pendingSave })
    }, 45000);
    const data = await res.json().catch(()=>({ok:false,error:"Resposta inválida do servidor."}));
    if(!res.ok || !data.ok){
      const warnings = data.persistence?.warnings || [];
      const detail = warnings.length ? warnings.map(w=>`${w.table}: ${w.error}`).join(" | ") : (data.error||"Erro ao salvar.");
      throw new Error(detail);
    }
    state.lead.id = data.persistence.processing.id;
    state.lead.status = "Conversa processada";
    const importacaoConcluida = state.pendingSave;
    const shareConcluidoId = String(state.pendingSharedRecordId || "");
    renderEtapas(5, "liberando os arquivos temporários da importação...");
    const limpeza = await finalizarImportacaoStorage(importacaoConcluida);
    state.pendingSave = null;
    state.activeImportId = null;
    cpLimparImportPendente();
    state.ultimoUploadStorage = null;
    const pendingBox = qs("#pendingBox");
    if(pendingBox){
      pendingBox.style.background = "rgba(104,255,149,.08)";
      pendingBox.style.borderColor = "rgba(104,255,149,.32)";
      pendingBox.style.color = "#bdffd0";
      pendingBox.innerHTML = "<b>Salvo no banco.</b> Lead disponível na Condução e na Home." + (!limpeza.ok ? " <b>A limpeza temporária ficou programada para nova tentativa.</b>" : "");
    }
    qs("#pendingActions")?.remove();
    toast("Lead salvo.");
    // Sem invalidar o cache (TTL de 5 min), a Carteira/Preparação continuava mostrando o
    // estado ANTES de salvar — o lead recém-importado nunca saía da "preparação" e parecia
    // que a importação não tinha sido salva. Zera o cache pra a lista reler o banco.
    invalidarLeadsCache();
    loadRecentLeads(true); refreshAllSections();
    if(shareConcluidoId) await finalizarSharePendente(shareConcluidoId);
    renderEtapas(6, "lead salvo e importação confirmada");
    // v1080 — só agora (importação de verdade concluída) o card de instruções volta a
    // aparecer; ver a marcação "concluidaComSucesso" em processFile.
    qs("#importCard")?.classList.remove("cp-import-rodando");
    // Após salvar, abre o lead da home pra mostrar o card de foco completo (com badges, materiais, etc).
    setTimeout(() => { cpioFecharQuandoLeadAbrir(state.lead?.id); }, 800);
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Salvar lead"; }
    const pa = qs("#pendingActions"); if(pa) pa.style.display = "flex"; // mostra botões pra tentar de novo
    qs("#importCard")?.classList.remove("cp-import-rodando");
    // v1088 — a tela cheia cobre tudo; num erro aqui ela precisa sair pro corretor ver o aviso
    // e os botões de tentar de novo.
    try{ cpImportOverlayVisivel(false); }catch(_){}
    toast("Não foi possível salvar: " + userFriendlyError(err));
  }
}

async function descartarLeadPendente(){
  const msgDescartarAn = "Descartar essa análise sem salvar no banco?";
  const okDescartarAn = (typeof cp903Confirm === "function")
    ? await cp903Confirm({ titulo: "Descartar análise", mensagem: msgDescartarAn, ok: "Descartar", perigo: true })
    : confirm(msgDescartarAn);
  if(!okDescartarAn) return;
  const shareDescartadoId = String(state.pendingSharedRecordId || "");
  const importacaoDescartada = state.pendingSave;
  await finalizarImportacaoStorage(importacaoDescartada);
  state.pendingSave = null;
  state.activeImportId = null;
  cpLimparImportPendente();
  state.ultimoUploadStorage = null;
  clearAnalysis();
  if(shareDescartadoId) await finalizarSharePendente(shareDescartadoId);
  toast("Análise descartada.");
}

async function processFile(file, options = {}){
  if(!file) return false;
  if(state.processing) return false;
  let concluidaComSucesso = false;
  const pendingShareId = String(options.shareId || state.pendingSharedRecordId || "").trim();
  // v1022 — se a página recarregou desde a última tentativa (state.activeImportId se perdeu),
  // busca no aparelho se ESTE MESMO arquivo (nome+tamanho) já tinha uma importação em
  // andamento — reencontrando o importId, o servidor reconhece a extração/transcrição já
  // feita antes e não cobra/repete o que já tinha sido transcrito.
  const importId = String(options.importId || state.activeImportId || cpImportIdParaArquivo(file) || criarImportId());
  state.activeImportId = importId;
  cpSalvarImportPendente(importId, file);
  if(pendingShareId){
    state.pendingSharedRecordId = pendingShareId;
    window.__cpShareImportActive = true;
  }
  state.ultimoArquivo = file;
  clearAnalysis();
  state.processing=true;
  show("zip");
  qs("#importCard")?.classList.add("cp-import-rodando");
  qs("#fileName").textContent="Arquivo selecionado: "+file.name+" ("+(file.size/1024/1024).toFixed(1)+" MB)";
  qs("#fileName").classList.add("show");
  qs("#processingBox").classList.add("show");
  renderEtapas(0, "validando o arquivo recebido");

  if(!file.name.toLowerCase().endsWith(".zip")){
    qs("#processingText").textContent="Arquivo inválido.";
    showCard("resultCard", true);
    qs("#resultBox").className="notice error";
    qs("#resultBox").innerHTML="Envie o arquivo ZIP exportado pelo WhatsApp.";
    state.processing=false;
    qs("#importCard")?.classList.remove("cp-import-rodando");
    return false;
  }

  try{
    const audioWindowDays = await escolherPeriodoAudiosImportacao();
    renderEtapas(0, "áudios: " + rotuloJanelaAudio(audioWindowDays) + "; textos completos");

    // Enxuga o ZIP no celular: mantém só .txt e áudio, joga fora imagem/vídeo/doc.
    let slimInfo = null;
    let working = file;
    try{
      renderEtapas(0, "preparando uma única cópia útil do ZIP");
      slimInfo = await slimZipKeepingTextAndAudio(file, ({processed,total,kept,dropped})=>{
        renderEtapas(0, "preparando ZIP: "+processed+"/"+total+" · mantidos "+kept+", descartados "+dropped);
      });
      working = slimInfo.file;
      const oMb = (slimInfo.originalSize/1024/1024).toFixed(1);
      const sMb = (slimInfo.slimSize/1024/1024).toFixed(1);
      renderEtapas(0, "ZIP preparado: "+oMb+" MB → "+sMb+" MB");
    }catch(err){
      renderEtapas(0, "usando o ZIP original");
      working = file;
    }

    const ok = await uploadLargeZipToSupabase(working, { audioWindowDays, importId });
    if(!ok) return false;
    // v929 — conta como 1 importação aqui (ZIP recebido com sucesso), independente de quantos
    // leads a conversa vai gerar/atualizar depois — é a unidade natural de "importei um ZIP".
    try{ cpRegistrarAtividade("importacao"); }catch(_){}
    // Não elimina o ZIP ainda: a importação só termina quando o lead é salvo/atualizado
    // ou quando o corretor descarta explicitamente a análise.
    // v1080 — renderProcessedResult (chamado dentro de uploadLargeZipToSupabase) dispara o
    // salvamento automático (salvarLeadPendente/atualizarLeadComEvolucao) SEM esperar
    // (sem await): esta função já retorna aqui, antes do salvamento terminar. Marca que deu
    // certo pra o "finally" abaixo não desligar o modo limpo do card agora — só quando o
    // salvamento de verdade terminar (ver as duas funções), senão as etapas "Salvando" e
    // "Concluído" reexibiam título/instruções/botões do card por cima (print do dono).
    concluidaComSucesso = true;
    return true;
  }catch(err){
    // Mantém o ZIP disponível no botão "Tentar novamente", mas remove imediatamente a
    // URL do Share Target. Assim, fechar e abrir o app não dispara a mesma tentativa antiga
    // nem abre sozinho o seletor de período dos áudios.
    if(pendingShareId){
      window.__cpShareImportActive=false;
      try{ history.replaceState(null,'',location.pathname); }catch(_){ }
    }
    renderEtapas(7, "a importação pode ser retomada sem perder o ZIP");
    showCard("resultCard", true);
    qs("#resultBox").className="notice error";
    state.ultimoArquivo = file;
    qs("#resultBox").innerHTML =
      escapeHtml(userFriendlyError(err,file)).replace(/\n/g,"<br>") +
      `<div style="margin-top:14px;display:flex;gap:10px"><button type="button" class="btn" id="btnTentarNovamente" style="flex:1">Tentar novamente</button><button type="button" class="btn secondary" id="btnDescartarTentativa" style="flex:1">Descartar</button></div>`;
    qs("#btnTentarNovamente")?.addEventListener("click", async () => {
      if(state.ultimoArquivo){ state.processing = false; await processFile(state.ultimoArquivo, { shareId: pendingShareId, importId }); }
    });
    qs("#btnDescartarTentativa")?.addEventListener("click", async () => {
      if(state.ultimoUploadStorage) await finalizarImportacaoStorage(state.ultimoUploadStorage);
      if(pendingShareId) await descartarSharePendente(pendingShareId);
      state.ultimoUploadStorage = null;
      state.activeImportId = null;
      cpLimparImportPendente();
      state.ultimoArquivo = null;
      showCard("resultCard", false);
    });
    toast("Erro ao processar. O ZIP ficou guardado para tentar novamente.");
    return false;
  }finally{
    state.processing=false;
    if(!concluidaComSucesso) qs("#importCard")?.classList.remove("cp-import-rodando");
    // v1089-2 — AQUI NÃO SE ESCONDE MAIS NADA. Esta rede de segurança fechava a tela cheia no
    // fim de processFile — só que processFile TERMINA ANTES do salvamento: renderProcessedResult
    // dispara salvarLeadPendente()/atualizarLeadComEvolucao() sem esperar, então este "finally"
    // rodava com o salvamento ainda em curso. A tela sumia, os cartões da importação apareciam, e
    // o "salvando" trazia a tela de volta — era a tela que aparecia no meio da análise.
    // A proteção contra ficar presa passou a ser o VIGIA POR TEMPO (cpioRearmarVigia), que só
    // dispara se NADA acontecer por um bom tempo — nunca no meio de um fluxo que está andando.
  }
}
async function readShareDebug(){
  const allNames = await caches.keys();
  // Prioriza o cache estável; depois qualquer outro
  const ordered = [
    "direciona-sharetarget-stable",
    ...allNames.filter(n => n !== "direciona-sharetarget-stable" && (n.startsWith("direciona-sharetarget-") || n.startsWith("direciona-static-")))
  ];
  for(const cacheName of ordered){
    try{
      const cache = await caches.open(cacheName);
      const cached = await cache.match("/__direciona_share_debug__");
      if(cached) return await cached.json();
    }catch(_){}
  }
  return null;
}

function formatShareDebug(debug){
  if(!debug) return "(nenhum diagnóstico encontrado)";
  let out = "<b>Quando:</b> "+escapeHtml(debug.ts||"?")+"<br>";
  out += "<b>Build do SW:</b> "+escapeHtml(debug.buildId||"?")+"<br>";
  out += "<b>Etapa final:</b> "+escapeHtml(debug.step||"?")+"<br>";
  if(Object.prototype.hasOwnProperty.call(debug, "idbSaved")){
    out += "<b>Salvo no IndexedDB:</b> "+(debug.idbSaved ? "sim" : "não")+"<br>";
  }
  if(Object.prototype.hasOwnProperty.call(debug, "cacheSaved")){
    out += "<b>Salvo no Cache:</b> "+(debug.cacheSaved ? "sim" : "não")+"<br>";
  }
  out += "<b>Campos do form:</b> "+escapeHtml(JSON.stringify(debug.formKeys||[]))+"<br>";
  if((debug.files||[]).length){
    out += "<b>Arquivos recebidos:</b><br>";
    for(const f of debug.files){
      const mb = (typeof f.size==="number") ? (f.size/1024/1024).toFixed(2)+" MB" : "?";
      out += "&nbsp;&nbsp;• "+escapeHtml(f.name)+" ("+escapeHtml(f.type)+", "+mb+", campo \""+escapeHtml(f.key)+"\")<br>";
    }
  } else {
    out += "<b>Arquivos recebidos:</b> nenhum<br>";
  }
  if(debug.chosenFile){
    out += "<b>Arquivo escolhido:</b> "+escapeHtml(debug.chosenFile.name)+"<br>";
  }
  if(debug.putError){
    out += "<b>Erro ao salvar no cache:</b> "+escapeHtml(debug.putError)+"<br>";
  }
  if(debug.error){
    out += "<b>Exceção:</b> "+escapeHtml(debug.error)+"<br>";
  }
  return out;
}

// Share Target v809 — fila persistente para funcionar também com o app fechado.
// O ZIP só é removido depois que a leitura/análise termina com sucesso.
const SHARE_IDB_NAME = 'direciona-share';
const SHARE_IDB_VERSION = 1;
const SHARE_IDB_STORE = 'zips';
const CP_SHARE_PARAMS_INICIAIS = new URLSearchParams(location.search);
const CP_SHARE_ID_INICIAL = String(CP_SHARE_PARAMS_INICIAIS.get('shareId') || '').trim();
const CP_VEIO_DE_SHARE = CP_SHARE_PARAMS_INICIAIS.has('shared') || CP_SHARE_PARAMS_INICIAIS.get('source') === 'share-target' || CP_SHARE_PARAMS_INICIAIS.has('share-target');
window.__cpShareImportActive = CP_VEIO_DE_SHARE;
let __cpCheckSharedPromise = null;

function shareIdbOpen(){
  return new Promise((resolve, reject)=>{
    if(!('indexedDB' in window)){ reject(new Error('IndexedDB indisponível')); return; }
    const req = indexedDB.open(SHARE_IDB_NAME, SHARE_IDB_VERSION);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(SHARE_IDB_STORE)) db.createObjectStore(SHARE_IDB_STORE, { keyPath:'id' });
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error || new Error('Falha ao abrir armazenamento do compartilhamento'));
  });
}

async function shareIdbGet(id){
  if(!id || !('indexedDB' in window)) return null;
  let db;
  try{ db = await shareIdbOpen(); }catch(_){ return null; }
  try{
    return await new Promise(resolve=>{
      const tx = db.transaction(SHARE_IDB_STORE,'readonly');
      const req = tx.objectStore(SHARE_IDB_STORE).get(id);
      let value=null;
      req.onsuccess=()=>{ value=req.result||null; };
      req.onerror=()=>{ value=null; };
      tx.oncomplete=()=>resolve(value);
      tx.onerror=()=>resolve(null);
      tx.onabort=()=>resolve(null);
    });
  }finally{ try{db.close();}catch(_){} }
}

async function shareIdbList(){
  if(!('indexedDB' in window)) return [];
  let db;
  try{ db=await shareIdbOpen(); }catch(_){ return []; }
  try{
    return await new Promise(resolve=>{
      const tx=db.transaction(SHARE_IDB_STORE,'readonly');
      const req=tx.objectStore(SHARE_IDB_STORE).getAll();
      let values=[];
      req.onsuccess=()=>{ values=Array.isArray(req.result)?req.result:[]; };
      req.onerror=()=>{ values=[]; };
      tx.oncomplete=()=>resolve(values.sort((a,b)=>String(b?.ts||'').localeCompare(String(a?.ts||''))));
      tx.onerror=()=>resolve([]);
      tx.onabort=()=>resolve([]);
    });
  }finally{ try{db.close();}catch(_){} }
}

async function shareIdbDel(id){
  if(!id || !('indexedDB' in window)) return;
  let db;
  try{ db=await shareIdbOpen(); }catch(_){ return; }
  try{
    await new Promise(resolve=>{
      const tx=db.transaction(SHARE_IDB_STORE,'readwrite');
      tx.objectStore(SHARE_IDB_STORE).delete(id);
      tx.oncomplete=()=>resolve(); tx.onerror=()=>resolve(); tx.onabort=()=>resolve();
    });
  }finally{ try{db.close();}catch(_){} }
}

function shareCacheKey(id){ return `/__direciona_shared_zip__/${encodeURIComponent(String(id||''))}`; }

async function apagarShareDoCache(id){
  if(!('caches' in window)) return;
  try{
    const allNames=await caches.keys();
    const names=['direciona-sharetarget-stable',...allNames.filter(n=>n!=='direciona-sharetarget-stable'&&(n.startsWith('direciona-sharetarget-')||n.startsWith('direciona-static-')))];
    for(const cacheName of [...new Set(names)]){
      let cache; try{cache=await caches.open(cacheName);}catch(_){continue;}
      if(id) await cache.delete(shareCacheKey(id));
      for(const key of ['/__direciona_shared_zip__','./__direciona_shared_zip__','__direciona_shared_zip__']){
        try{
          const r=await cache.match(key);
          if(!r || !id || r.headers.get('X-Share-Id')===id) await cache.delete(key);
        }catch(_){ }
      }
    }
  }catch(_){ }
}

async function finalizarSharePendente(id){
  await Promise.allSettled([shareIdbDel(id), apagarShareDoCache(id)]);
  if(String(state.pendingSharedRecordId||'')===String(id||'')) state.pendingSharedRecordId='';
  window.__cpShareImportActive=false;
  try{ history.replaceState(null,'',location.pathname); }catch(_){ }
}
window.finalizarSharePendente=finalizarSharePendente;

async function descartarSharePendente(id){
  await finalizarSharePendente(id);
  toast('Importação descartada.');
}
window.descartarSharePendente=descartarSharePendente;

async function limparSharesLocaisAntigos(){
  const ativo = String(state.pendingSharedRecordId || "");
  const limite = Date.now() - (7 * 24 * 60 * 60 * 1000);
  try{
    const registros = await shareIdbList();
    for(const registro of registros || []){
      const id = String(registro?.id || "");
      const ts = Date.parse(registro?.ts || registro?.createdAt || "");
      if(!id || id === ativo || !ts || ts >= limite || registro?.status === "processing") continue;
      await shareIdbDel(id);
      await apagarShareDoCache(id);
    }

    if('caches' in window){
      const nomes = await caches.keys();
      const relevantes = nomes.filter(n => n === 'direciona-sharetarget-stable' || n.startsWith('direciona-sharetarget-'));
      for(const nomeCache of relevantes){
        const cache = await caches.open(nomeCache);
        const requests = await cache.keys();
        for(const request of requests){
          if(!request.url.includes('/__direciona_shared_zip__')) continue;
          const response = await cache.match(request);
          const id = String(response?.headers?.get('X-Share-Id') || '');
          const ts = Date.parse(response?.headers?.get('X-Shared-At') || '');
          if((id && id === ativo) || !ts || ts >= limite) continue;
          await cache.delete(request);
        }
      }
    }
  }catch(error){ console.warn("Limpeza de compartilhamentos antigos ignorada:", error?.message || error); }
}

async function localizarSharePendente(idPreferido){
  const pref=String(idPreferido||'').trim();
  if(pref){
    const exato=await shareIdbGet(pref);
    // Com ID explícito, nunca pega um "latest" antigo: isso poderia importar a conversa
    // anterior enquanto a transação nova ainda está terminando no cold start.
    return exato?.blob?.size ? exato : null;
  }
  // Compatibilidade com versões antigas, que gravavam sempre como "latest" e não
  // mandavam shareId no redirecionamento.
  const legado=await shareIdbGet('latest');
  if(legado?.blob?.size) return legado;
  const todos=await shareIdbList();
  return todos.find(r=>r?.blob?.size && r.status!=='done') || null;
}

async function localizarShareNoCache(idPreferido){
  if(!('caches' in window)) return null;
  const allNames=await caches.keys();
  const names=['direciona-sharetarget-stable',...allNames.filter(n=>n!=='direciona-sharetarget-stable'&&(n.startsWith('direciona-sharetarget-')||n.startsWith('direciona-static-')))];
  const keys=[];
  if(idPreferido) keys.push(shareCacheKey(idPreferido));
  keys.push('/__direciona_shared_zip__','./__direciona_shared_zip__','__direciona_shared_zip__');
  for(const cacheName of [...new Set(names)]){
    let cache; try{cache=await caches.open(cacheName);}catch(_){continue;}
    for(const key of keys){
      const cached=await cache.match(key).catch(()=>null);
      if(!cached) continue;
      const headerId=String(cached.headers.get('X-Share-Id')||'').trim();
      // Se o redirecionamento trouxe um ID, uma chave legada só é válida quando
      // pertence exatamente a esse mesmo compartilhamento.
      if(idPreferido && key!==shareCacheKey(idPreferido) && headerId!==String(idPreferido)) continue;
      const blob=await cached.blob();
      if(!blob?.size) continue;
      const id=String(headerId||idPreferido||'latest');
      return {
        id,
        blob,
        name:decodeURIComponent(cached.headers.get('X-File-Name')||'conversa-whatsapp.zip'),
        type:blob.type||'application/zip',
        ts:String(cached.headers.get('X-Shared-At')||''),
        cacheOnly:true
      };
    }
  }
  return null;
}

function mostrarRecebimentoShare(){
  show('zip');
  qs('#processingBox')?.classList.add('show');
  if(qs('#processingText')) qs('#processingText').textContent='Conversa recebida. Preparando a importação…';
  if(qs('#progressBar')) qs('#progressBar').style.width='4%';
}

async function _checkSharedImpl(){
  // A análise já terminou e está aguardando a decisão de salvar/atualizar/descartar.
  // Mantém o ZIP persistido, mas não processa a mesma conversa uma segunda vez na mesma aba.
  if(state.pendingSave && state.pendingSharedRecordId){
    window.__cpShareImportActive=true;
    return {handled:true,awaitingSave:true,shareId:String(state.pendingSharedRecordId)};
  }
  const params=new URLSearchParams(location.search);
  const cameFromShare=CP_VEIO_DE_SHARE || params.has('shared') || params.get('source')==='share-target' || params.has('share-target');

  // Uma abertura normal do aplicativo nunca deve procurar ZIPs antigos no IndexedDB/cache.
  // Antes, checkShared() era chamado no boot mesmo sem Share Target e acabava escolhendo o
  // primeiro registro pendente antigo, abrindo sozinho a janela "Período dos áudios".
  if(!cameFromShare){
    window.__cpShareImportActive=false;
    document.querySelector('#periodoAudioModal')?.remove();
    return {handled:false};
  }

  const shareId=String(params.get('shareId')||CP_SHARE_ID_INICIAL||'').trim();
  const erroUrl=params.get('erro');
  window.__cpShareImportActive=true;
  mostrarRecebimentoShare();

  // No cold start, o documento pode montar alguns milissegundos antes da transação do
  // service worker ficar visível. Faz uma espera curta em vez de desistir e ir para a Home.
  // v983 — 8s era curto demais pra conversas grandes (com áudio): o service worker ainda
  // estava terminando de gravar o ZIP quando o app desistia de esperar e mostrava erro
  // (mesmo o compartilhamento tendo dado certo). 15s dá mais fôlego pro aparelho/arquivo grande.
  const limite=cameFromShare ? Date.now()+15000 : Date.now();
  let record=null;
  do{
    record=await localizarSharePendente(shareId);
    if(!record) record=await localizarShareNoCache(shareId);
    if(record) break;
    if(Date.now()<limite) await new Promise(r=>setTimeout(r,220));
  }while(Date.now()<limite);

  if(record?.blob?.size){
    // Android/PWA pode reabrir a última URL (?shared=1) horas depois. Esse endereço antigo
    // não representa um novo compartilhamento. Só iniciamos automaticamente quando o ZIP
    // foi recebido recentemente; caso contrário limpamos a URL e abrimos a Home normalmente.
    const recebidoEm=Date.parse(record.ts||record.createdAt||'');
    const registroRecente=Number.isFinite(recebidoEm) && (Date.now()-recebidoEm) <= (15*60*1000);
    if(!registroRecente){
      window.__cpShareImportActive=false;
      state.pendingSharedRecordId='';
      document.querySelector('#periodoAudioModal')?.remove();
      try{ history.replaceState(null,'',location.pathname); }catch(_){ }
      return {handled:false,staleShare:true};
    }
    const id=String(record.id||shareId||'latest');
    state.pendingSharedRecordId=id;
    window.__cpShareImportActive=true;
    mostrarRecebimentoShare();
    try{ history.replaceState(null,'',`${location.pathname}?shared=1&shareId=${encodeURIComponent(id)}`); }catch(_){ }
    const file=new File([record.blob],record.name||'conversa-whatsapp.zip',{type:record.type||record.blob.type||'application/zip'});
    const ok=await processFile(file,{shareId:id});
    return {handled:true,processingFinished:ok,shareId:id};
  }

  if(cameFromShare){
    const debug=await readShareDebug().catch(()=>null);
    show('zip'); showCard('resultCard',true);
    qs('#resultBox').className='notice error';
    qs('#resultBox').innerHTML=
      '<b>O arquivo ainda não apareceu no armazenamento do aplicativo.</b><br><br>'+
      'O Corretor Pro não voltou para a tela inicial e não apagou nada. Volte aqui em alguns segundos e toque em <b>Tentar recuperar</b>.'+
      (erroUrl?'<br><br><b>Motivo:</b> '+escapeHtml(erroUrl):'')+
      (debug?'<br><br><details><summary>Diagnóstico técnico</summary>'+formatShareDebug(debug)+'</details>':'')+
      '<div style="margin-top:14px"><button type="button" class="btn" id="btnRecuperarShare">Tentar recuperar</button></div>';
    // v983 — o clique só disparava uma nova espera de até 8s por trás, sem NENHUM sinal na tela;
    // pro dono parecia botão morto ("cliquei e nada aconteceu"). Agora desativa e troca o texto
    // na hora, antes mesmo da nova tentativa começar.
    qs('#btnRecuperarShare')?.addEventListener('click', (ev) => {
      const btn = ev.currentTarget;
      if(btn){ btn.disabled = true; btn.textContent = 'Procurando…'; }
      __cpCheckSharedPromise=null; checkShared();
    });
    return {handled:true,waiting:true};
  }
  return {handled:false};
}

async function checkShared(){
  if(__cpCheckSharedPromise) return __cpCheckSharedPromise;
  __cpCheckSharedPromise=_checkSharedImpl().finally(()=>{ __cpCheckSharedPromise=null; });
  return __cpCheckSharedPromise;
}
window.checkShared=checkShared;

qsa(".nav[data-target],.go").forEach(b=>b.addEventListener("click",()=>{
  const estavaNaGaveta=document.body.classList.contains("menu-aberto");
  if(estavaNaGaveta) fecharMenuGaveta({replaceOnly:true});
  const navKey = b.dataset.navKey || b.dataset.target || "home";
  // Ir manualmente pra home limpa lead aberto e grupo aberto, pra mostrar os botões iniciais.
  // (A guarda em renderListasHome impede que o auto-refresh derrube quem está num lead/grupo.)
  if(b.dataset.target === "home"){ state.lead = null; state.focoLeadId = null; state.grupoAtivo = null; }
  // Proposta aberta pelo Menu/barra (não a partir de um lead) não fica vinculada a lead nenhum —
  // MAS só quando é uma navegação NOVA pra Propostas. v1026: o dono relatou "abri o lead, cliquei
  // em Proposta, preenchi tudo, cliquei em Registrar e não salvou" — causa real: com a barra de
  // navegação sempre visível (celular, rolando um formulário comprido), um toque (às vezes sem
  // querer) no ícone "Propostas" da barra, MESMO JÁ ESTANDO na tela de propostas vinda de um lead,
  // zerava o vínculo com o lead silenciosamente — o formulário continuava com tudo preenchido (os
  // campos não somem), então nada parecia ter mudado até clicar em "Registrar" e cair no aviso
  // "abra a partir de um lead". Reclicar no mesmo item de navegação, já estando nela, não pode
  // apagar um vínculo em andamento.
  if(b.dataset.target === "propostas" && state.active !== "propostas"){ state.propLeadId = null; state.propLeadNome = ""; atualizarVoltarProposta(); }
  show(b.dataset.target,{navKey});
  if(!estavaNaGaveta) fecharMenuGaveta({fromHistory:true}); // garante gaveta fechada sem criar nova navegação
}));
// Qualquer item da lista lateral/gaveta fecha a gaveta do celular ao ser tocado (inclui os que usam onclick, como "Últimos atendimentos").
qsa(".sb-item").forEach(b=>b.addEventListener("click", fecharMenuGaveta));
qsa(".pickZipShortcut").forEach(b=>b.addEventListener("click",()=>show("zip")));
qs("#clearAnalysis").addEventListener("click",clearAnalysis);
qs("#diagnoseOpenAI").addEventListener("click",runOpenAIDiagnostics);
qsa(".msg-tab").forEach(btn => btn.addEventListener("click", () => setMsgStyle(btn.dataset.style)));
qs("#cerebroSalvar")?.addEventListener("click", salvarCerebro);
qs("#cerebroResetar")?.addEventListener("click", resetarCerebro);
qs("#cerebroZerar")?.addEventListener("click", zerarCerebroTudo);
// Regras e objeções são editadas diretamente nos campos de texto únicos.
// ============ PARSER DE CSV (compartilhado) ============
// Usado pela Importar telefones (CSV). A antiga importação de LEADS por CSV foi removida na v905.
function parseCsvDireciona(t){
  const rows=[]; let row=[], cur="", q=false;
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){ if(c==='"'){ if(t[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else { if(c==='"')q=true; else if(c===','){row.push(cur);cur="";} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur="";} else if(c==='\r'){} else cur+=c; }
  }
  if(cur.length||row.length){row.push(cur);rows.push(row);}
  return rows;
}
// (v905) Importação de LEADS por CSV removida — não era mais usada e a UI dela nem existia mais
// no HTML. parseCsvDireciona (acima) permanece: a Importar telefones (CSV) usa.

// Busca global
let buscaGlobalTimer = null;
qs("#buscaGlobal")?.addEventListener("input", (e) => {
  const termo = (e.target.value || "").toLowerCase().trim();
  clearTimeout(buscaGlobalTimer);
  buscaGlobalTimer = setTimeout(() => renderBuscaGlobal(termo), 200);
});
qs("#buscaGlobal")?.addEventListener("focus", () => {
  // Garante a lista completa carregada pra busca encontrar qualquer lead.
  if(!state.todosLeads || !state.todosLeads.length) loadTodosLeadsBusca();
  const termo = (qs("#buscaGlobal").value || "").toLowerCase().trim();
  if(termo) renderBuscaGlobal(termo);
});
document.addEventListener("click", (e) => {
  if(!e.target.closest(".busca-global")){
    const r = qs("#buscaGlobalResults"); if(r) r.style.display = "none";
  }
});
// Normaliza pra busca: minúsculo e SEM acento (buscar "joao" acha "João" e vice-versa).
function semAcento(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim(); }
window.semAcento = semAcento;
// Lead arquivado (arquivo morto / Perdido) ou na geladeira NÃO aparece na busca —
// fica só na tela dedicada (arquivo morto). Busca é pra leads ativos.
// v1093 — antes esta função ESCONDIA o lead arquivado da busca: procurar pelo nome do cliente
// não achava nada e dava a impressão de que ele tinha sumido do app. Agora o arquivado APARECE,
// mas nunca disfarçado de ativo — vem sempre depois dos ativos e com a tarja "Arquivado", que é
// a condição que o dono colocou: "pode aparecer, desde que exista alguma diferença visual".
function leadArquivado(l){ return normalizarEtapa(l?.etapa) === ETAPA_ARQUIVADO; }
function renderBuscaGlobal(termo){
  const box = qs("#buscaGlobalResults");
  if(!box) return;
  if(!termo || termo.length < 2){ box.style.display = "none"; box.innerHTML = ""; return; }
  // Busca na lista completa; cai pros 8 da home se a completa ainda não carregou.
  const fonte = (state.todosLeads && state.todosLeads.length) ? state.todosLeads : (state.leads || []);
  if(!state.todosLeads || !state.todosLeads.length) loadTodosLeadsBusca();
  const tt = semAcento(termo);
  const numeros = String(termo||"").replace(/\D/g,"");
  const matches = fonte.filter(l => {
    return semAcento(l.name).includes(tt) || semAcento(l.product).includes(tt) || (numeros.length >= 3 && String(l.phone||"").replace(/\D/g,"").includes(numeros));
  }).sort((a, b) => (leadArquivado(a) ? 1 : 0) - (leadArquivado(b) ? 1 : 0)) // ativos primeiro
    .slice(0, 12);
  if(!matches.length){
    box.style.display = "block";
    box.innerHTML = `<div class="small" style="padding:10px;color:var(--muted);text-align:center">Nenhum lead com "${escapeHtml(termo)}"</div>`;
    return;
  }
  box.style.display = "block";
  box.innerHTML = matches.map(l => {
    const idJs = JSON.stringify(String(l.id||""));
    const arq = leadArquivado(l);
    // O arquivado vem apagado (mais transparente) e com tarja — dá pra saber o que é sem abrir.
    const tarja = arq ? `<span class="cp-busca-arquivado">Arquivado</span>` : "";
    return `<div onclick='abrirLead(${idJs});qs("#buscaGlobal").value="";qs("#buscaGlobalResults").style.display="none"' style="padding:8px 10px;border-radius:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px${arq ? ";opacity:.62" : ""}" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background=''">
      <div style="min-width:0"><div style="font-weight:950;font-size:13px;display:flex;align-items:center;gap:6px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(l.name||"Cliente")}</span>${tarja}</div><div class="small" style="font-size:11px">${escapeHtml(l.product || (arq ? "Arquivado" : "Empreendimento não identificado"))}</div></div>
    </div>`;
  }).join("");
}
window.renderBuscaGlobal = renderBuscaGlobal;

// Barra de busca reutilizável (Hoje e Todos os leads). Mostra resultados que abrem o lead.
function barraBuscaLeadHTML(prefixo){
  const inputId = "busca_" + prefixo, boxId = "buscaRes_" + prefixo;
  return `<div class="mobile-only" style="position:relative;margin-bottom:14px">
    <input type="search" id="${inputId}" placeholder="Buscar lead..." autocomplete="off" oninput='buscaLeadInline(this.value, ${JSON.stringify(boxId)})' style="width:100%;box-sizing:border-box;padding:11px 16px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text);font-size:14px;outline:none">
    <div id="${boxId}" style="display:none;margin-top:6px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:6px;max-height:340px;overflow-y:auto;box-shadow:0 18px 60px rgba(0,0,0,.45)"></div>
  </div>`;
}
window.barraBuscaLeadHTML = barraBuscaLeadHTML;

function ui677ToolbarHTML(prefixo){
  const inputId = `ui677Busca_${prefixo}`;
  const boxId = `ui677BuscaRes_${prefixo}`;
  return `<div class="ui677-toolbar ui678-toolbar-search-only">
    <div class="ui677-search-wrap">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="search" id="${inputId}" placeholder="Buscar por nome ou interesse" autocomplete="off" oninput='buscaLeadInline(this.value, ${JSON.stringify(boxId)})'>
      <div id="${boxId}" class="ui677-search-results"></div>
    </div>
  </div>`;
}
window.ui677ToolbarHTML = ui677ToolbarHTML;

window.ui677AbrirBuscaLead = function(id, boxId){
  const box = qs("#" + boxId);
  if(box){
    box.style.display = "none";
    box.innerHTML = "";
    const input = box.parentElement?.querySelector('input[type="search"]');
    if(input) input.value = "";
  }
  abrirLead(id);
};

let _buscaLeadTimer = null;
function buscaLeadInline(termo, boxId){
  clearTimeout(_buscaLeadTimer);
  _buscaLeadTimer = setTimeout(async () => {
    const box = qs("#" + boxId);
    if(!box) return;
    const t = semAcento(termo);
    if(t.length < 2){ box.style.display = "none"; box.innerHTML = ""; return; }
    if((!state.todosLeads || !state.todosLeads.length) && typeof loadTodosLeadsBusca === "function") await loadTodosLeadsBusca();
    const fonte = (state.todosLeads && state.todosLeads.length) ? state.todosLeads : (state.leads || []);
    const numeros = String(termo||"").replace(/\D/g,"");
    // v1093 — igual à busca do topo: o arquivado aparece (senão some do app), mas sempre depois
    // dos ativos e com tarja, pra nunca ser confundido com cliente em andamento.
    const matches = fonte.filter(l => (semAcento(l.name).includes(t) || semAcento(l.product).includes(t) || (numeros.length >= 3 && String(l.phone||"").replace(/\D/g,"").includes(numeros))))
      .sort((a, b) => (leadArquivado(a) ? 1 : 0) - (leadArquivado(b) ? 1 : 0))
      .slice(0, 12);
    box.style.display = "block";
    if(!matches.length){ box.innerHTML = `<div class="small" style="padding:10px;color:var(--muted);text-align:center">Nenhum lead com "${escapeHtml(t)}"</div>`; return; }
    box.innerHTML = matches.map(l => {
      const idJs = JSON.stringify(String(l.id||""));
      const arq = leadArquivado(l);
      const tarja = arq ? `<span class="cp-busca-arquivado">Arquivado</span>` : "";
      return `<div onclick='ui677AbrirBuscaLead(${idJs}, ${JSON.stringify(boxId)})' style="padding:9px 11px;border-radius:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px${arq ? ";opacity:.62" : ""}">
        <div style="min-width:0"><div style="font-weight:950;font-size:13px;display:flex;align-items:center;gap:6px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(l.name||"Cliente")}</span>${tarja}</div><div class="small" style="font-size:11px;color:var(--muted)">${escapeHtml(l.product || (arq ? "Arquivado" : "Empreendimento não identificado"))}</div></div>
      </div>`;
    }).join("");
  }, 200);
}
window.buscaLeadInline = buscaLeadInline;

qs("#agendaRefresh")?.addEventListener("click", carregarAgenda);
qs("#dashboardRefresh")?.addEventListener("click", carregarDashboard);
qs("#arquivadosRefresh")?.addEventListener("click", () => window.carregarArquivados());
qs("#carteiraRefresh")?.addEventListener("click", () => carregarCarteira(true));
qs("#memoriaSalvar")?.addEventListener("click", salvarMemoria);
qs("#memoriaReanalisar")?.addEventListener("click", async ()=>{
  const id = state.lead?.id;
  if(!id){ toast("Sem lead carregado."); return; }
  // Salva memoria antes pra a reanalise pegar tudo atualizado.
  await salvarMemoria();
  qs("#memoriaStatus").textContent = "Reanalisando com memória nova... (pode levar até 30s)";
  try{
    const res = await fetch("./api/reanalisar-lead", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payloadComCerebro({ id })) });
    const data = await res.json();
    if(data?.ok){
      renderAnalysis(data.analysis, state.lead);
      qs("#memoriaStatus").textContent = "Reanálise concluída.";
      toast("Reanálise concluída.");
    } else {
      qs("#memoriaStatus").textContent = "Erro: " + (data?.error||"");
    }
  }catch(err){
    qs("#memoriaStatus").textContent = "Erro: " + (err?.message||err);
  }
});
// ============ MEMÓRIA DO LEAD ============
async function carregarMemoria(leadId){
  if(!leadId){ showCard("memoriaCard", false); return; }
  try{
    const res = await fetch("./api/lead-update?action=memoria-get&id="+encodeURIComponent(leadId), { cache:"no-store" });
    const data = await res.json();
    const m = data?.memoria || {};
    qs("#memoriaPreferencias").value = m.preferencias || "";
    qs("#memoriaPessoasDecisao").value = m.pessoasDecisao || "";
    qs("#memoriaPontosSensiveis").value = m.pontosSensiveis || "";
    qs("#memoriaObservacoes").value = m.observacoes || "";
    state.obsCarregada = m.observacoes || "";
    state.memoriaOriginal = {
      preferencias:m.preferencias || "",
      pessoasDecisao:m.pessoasDecisao || "",
      pontosSensiveis:m.pontosSensiveis || "",
      observacoes:m.observacoes || ""
    };
    showCard("memoriaCard", true);
    qs("#memoriaStatus").textContent = m.atualizadoEm ? "Atualizada em "+new Date(m.atualizadoEm).toLocaleString("pt-BR") : "";
  }catch(_){ showCard("memoriaCard", false); }
}

// A memória é salva sem reanalisar. O aprendizado contínuo recebe apenas os
// campos que o corretor realmente modificou.
async function salvarMemoria(){
  const id = state.lead?.id;
  if(!id){ toast("Sem lead carregado."); return; }
  const valores = {
    preferencias: qs("#memoriaPreferencias").value,
    pessoasDecisao: qs("#memoriaPessoasDecisao").value,
    pontosSensiveis: qs("#memoriaPontosSensiveis").value,
    observacoes: qs("#memoriaObservacoes").value
  };
  const original = state.memoriaOriginal || {};
  const camposAlterados = Object.keys(valores).filter(k => String(valores[k]||"") !== String(original[k]||""));
  const body = { id, action:"memoria-set", ...valores, camposAlterados };
  qs("#memoriaStatus").textContent = "Salvando...";
  try{
    const res = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
    const data = await res.json();
    if(data?.ok){
      qs("#memoriaStatus").textContent = "Memória salva.";
      // Atualiza state pra refletir mudanças
      if(state.analysis){
        state.analysis.memoria = { ...(state.analysis.memoria||{}), ...data.memoria };
      }
      // Memória manual ensina em segundo plano, mas não troca automaticamente as
      // sugestões atuais. Reanalisar continua sendo uma decisão explícita do corretor.
      state.obsCarregada = body.observacoes || "";
      state.memoriaOriginal = { ...valores };
      if(camposAlterados.length){
        toast("Memória salva. Aprendizado atualizado em segundo plano.");
        setTimeout(()=>window.iniciarAprendizadoContinuoAutomatico?.({somentePendentes:true}),500);
      } else {
        toast("Memória salva. Nenhuma informação nova para aprender.");
      }
      loadRecentLeads();
    } else {
      qs("#memoriaStatus").textContent = "Erro: " + (data?.error||"");
    }
  }catch(err){
    qs("#memoriaStatus").textContent = "Erro: "+(err?.message||err);
  }
}

// v928 — removidos carregarVendas/carregarRelatorio/renderDesempenhoDash/FUNIL_ETAPAS: telas
// mortas desde a v904 (o dono não marca Vendido no app — só Arquivar). Não tinham nenhum alvo
// no HTML (#vendasList, #relatorioBody não existem) — nunca renderizavam nada, mas continuavam
// sendo definidas e (no caso do carregarVendas) até chamadas via dispatch sem checar se o
// elemento existia.

// ===== Carteira completa: todos os leads num lugar (panorama + contatar hoje + ranking) =====
// Reusa o mesmo dado (leads-recentes limit=2000) e os mesmos critérios da Hoje (scoreLead,
// entraEmRetomada, etapas). Não cria função nova no servidor — tudo no cliente, em cima do cache.
// v1073 — a versão original de carregarCarteira (e o antigo relatório .txt da carteira, sem
// botão no HTML desde a reforma dos Atendimentos) era código morto: a versão VIVA é a do
// bloco cp788 no fim do arquivo, que reatribui este nome. A declaração fica só pra o
// "carregarCarteira = window.carregarCarteira" de lá ter o que reatribuir.
let carregarCarteira = null;


// Carrega históricos completos apenas quando o usuário pede uma exportação.
// A navegação normal continua leve; a operação pesada fica restrita ao botão de exportar.
async function carregarDetalhesParaExportacao(leads, onProgress){
  const lista = Array.isArray(leads) ? leads : [];
  const saida = new Array(lista.length);
  let cursor = 0, concluidos = 0;
  const worker = async () => {
    while(true){
      const i = cursor++;
      if(i >= lista.length) return;
      const base = lista[i];
      try{
        saida[i] = base?.historyLoaded ? base : await getLeadDetail(base.id);
      }catch(_){
        saida[i] = base;
      }
      concluidos++;
      if(typeof onProgress === "function") onProgress(concluidos, lista.length);
    }
  };
  const qtd = Math.min(3, Math.max(1, lista.length));
  await Promise.all(Array.from({ length:qtd }, worker));
  return saida;
}

// Gera um arquivo .txt com TUDO: situação + próxima ação + histórico de mensagens de cada lead.
// É esse arquivo que o corretor baixa e pode mandar pro chat pra analisar os 145 de uma vez.
// Exporta TODOS os leads num CSV (abre direto no Excel) com 4 colunas:
// NOME · TELEFONE · PRODUTO DE INTERESSE · HISTÓRICO INTEIRO DE CONVERSAS.
async function exportarLeadsCSV(btn){
  const txt0 = btn ? btn.textContent : "";
  if(btn){ btn.disabled = true; btn.textContent = "Gerando..."; }
  try{
    const data = await getLeadsData();
    let all = (data?.items || []).map(limparLead);
    if(!all.length){ toast("Nenhum lead pra exportar."); return; }
    all = await carregarDetalhesParaExportacao(all, (feito, total) => {
      if(btn) btn.textContent = `Históricos ${feito}/${total}`;
    });
    const esc = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const colunas = [
      "NOME","TELEFONE","PRODUTO DE INTERESSE","ETAPA",
      "PRIORIDADE",
      "PERFIL DO CLIENTE","POR QUE ESTE LEAD",
      "PREFERÊNCIAS","OBSERVAÇÕES DO CORRETOR","O QUE PESA CONTRA",
      "HISTÓRICO DE CONVERSAS"
    ];
    const linhas = [ colunas.map(esc).join(",") ];
    for(const l of all){
      const a = (l.analysis && typeof l.analysis === "object") ? l.analysis : {};
      const mem = (a.memoria && typeof a.memoria === "object") ? a.memoria : {};
      const lc = (a.leituraComercial && typeof a.leituraComercial === "object") ? a.leituraComercial : {};
      const diag = (a.diagnostico && typeof a.diagnostico === "object") ? a.diagnostico : {};
      const produto = (typeof produtosLabel === "function" ? produtosLabel(l) : "") || l.product || "";
      // v1073 — a coluna ETAPA do Excel fala a mesma língua do app (Ativo/Arquivado), nunca o
      // valor cru do banco (que pode ter vocabulário antigo de funil de antes da v1069).
      const etapa = normalizarEtapa(l.etapa) === ETAPA_ARQUIVADO ? "Arquivado" : "Ativo";
      const prioridade = (typeof prioridadeTituloCurto === "function") ? prioridadeTituloCurto(l) : "";
      const perfil = a.clientProfile && a.clientProfile !== "—" ? a.clientProfile : "";
      const porque = a.summary || l.summary || "";
      const preferencias = mem.preferencias || "";
      const observacoes = mem.observacoes || "";
      const objections = Array.isArray(a.objections) ? a.objections.slice(0,5) : [];
      const pontosSensiveis = String(mem.pontosSensiveis||"").split(/[·\n;]+/).map(s=>s.trim()).filter(Boolean);
      const pesaContraArr = [];
      const _normpc = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
      [...objections, ...pontosSensiveis].forEach(t => {
        if(!pesaContraArr.some(x => _normpc(x) === _normpc(t))) pesaContraArr.push(t);
      });
      const pesaContra = pesaContraArr.join(" · ");
      const msgs = Array.isArray(l.recentMessages) ? l.recentMessages.filter(m => m && String(m.text||"").trim()) : [];
      const hist = msgs.map(m => `[${String(m.date||"").trim()} ${String(m.time||"").trim()}] ${limparAutorAtend(m.author||"").trim()}: ${String(m.text||"").replace(/\r?\n/g, " ").trim()}`).join("\n");
      linhas.push([
        esc(l.name||""), esc(l.phone||""), esc(produto), esc(etapa),
        esc(prioridade),
        esc(perfil), esc(porque),
        esc(preferencias), esc(observacoes), esc(pesaContra),
        esc(hist || "(sem mensagens registradas)")
      ].join(","));
    }
    const csv = "﻿" + linhas.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-corretor-pro-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try{ document.body.removeChild(a); }catch(_){}; URL.revokeObjectURL(url); }, 1000);
    toast(`Planilha de ${all.length} leads baixada.`);
  }catch(err){
    toast("Falhou ao exportar: " + (err?.message || err));
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = txt0 || "⬇ Excel"; }
  }
}
window.exportarLeadsCSV = exportarLeadsCSV;


async function exportarBackupCompletoV681(btn){
  const txt0 = btn ? btn.textContent : "";
  if(btn){ btn.disabled = true; btn.textContent = "Gerando backup..."; }
  try{
    const res = await fetch("./api/leads-recentes?export=full", { cache:"no-store" });
    if(!res.ok){
      const d = await res.json().catch(()=>({}));
      throw new Error(d?.error || "Não foi possível gerar o backup completo.");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `corretor-pro-backup-completo-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try{ document.body.removeChild(a); }catch(_){}; URL.revokeObjectURL(url); }, 1000);
    toast("Backup completo baixado com segurança.");
  }catch(err){
    toast("Falhou ao exportar backup: " + (err?.message || err));
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = txt0 || "🛡 Backup"; }
  }
}
window.exportarBackupCompletoV681 = exportarBackupCompletoV681;


async function auditarDadosV681(btn){
  const txt0 = btn ? btn.textContent : "";
  if(btn){ btn.disabled = true; btn.textContent = "Auditando..."; }
  try{
    const res = await fetch("./api/leads-recentes?audit=1", { cache:"no-store" });
    const data = await res.json().catch(()=>({}));
    if(!res.ok || !data?.ok) throw new Error(data?.error || "Não foi possível auditar a base.");
    const r = data.resumo || {};
    const problemas = Array.isArray(data.problemas) ? data.problemas : [];
    const msg = problemas.length
      ? `Auditoria concluída: ${r.totalLeads||0} leads. Atenção: ${problemas.slice(0,3).join(" · ")}`
      : `Auditoria concluída: ${r.totalLeads||0} leads, sem inconsistência crítica detectada.`;
    toast(msg);
    console.log("Auditoria Corretor Pro v681", data);
  }catch(err){
    toast("Falhou ao auditar: " + (err?.message || err));
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = txt0 || "✓ Auditar"; }
  }
}
window.auditarDadosV681 = auditarDadosV681;


// Testa a OpenAI e o modelo principal de análise/mensagens pelo mesmo endpoint usado no deploy.
async function testarIAOpenAI(btn){
  const out = qs("#openaiDiagOut");
  if(out) out.innerHTML = '<span style="color:var(--muted)">Testando a OpenAI e o modelo principal… aguarde alguns segundos.</span>';
  if(btn) btn.disabled = true;
  try{
    const res = await fetch("./api/diagnostico?mode=openai", { cache:"no-store" });
    const d = await res.json();
    const cc = d.config || {};
    const tModelo = (d.testes||[]).find(t => /responses|análise e mensagens/i.test(t.etapa||""));
    let html;
    if(!cc.configured){
      html = `<b style="color:#ff8a8a">❌ A chave da OpenAI não chegou ao app.</b><br>No Vercel, confira <b>OPENAI_API_KEY</b> e depois faça um novo deploy.`;
    } else if(tModelo && tModelo.ok){
      html = `<b style="color:var(--acao)">✅ OpenAI conectada e modelo principal funcionando.</b><br>Chave ${escapeHtml(cc.keyPrefix||"")}…${escapeHtml(cc.keyTail||"")} · análise ${escapeHtml(cc.analysisModel||"")} · mensagens ${escapeHtml(cc.messagesModel||"")}.`;
    } else {
      const msg = (tModelo && tModelo.error) || (d.primeiroErro && d.primeiroErro.mensagem) || "erro desconhecido";
      const dica = (tModelo && tModelo.hint) || (d.primeiroErro && d.primeiroErro.dica) || "";
      html = `<b style="color:#ffd27a">⚠️ A chave foi encontrada, mas o modelo principal não respondeu.</b><br>Modelo ${escapeHtml(cc.analysisModel||"")}.<br>Motivo: ${escapeHtml(String(msg))}${dica?`<br><span style="color:var(--muted)">${escapeHtml(String(dica))}</span>`:""}`;
    }
    if(out) out.innerHTML = html;
  }catch(e){
    if(out) out.innerHTML = `<span style="color:#ff8a8a">Não consegui testar agora: ${escapeHtml(String(e?.message||e))}</span>`;
  }finally{
    if(btn) btn.disabled = false;
  }
}
window.testarIAOpenAI = testarIAOpenAI;

// v1064 — pedido do dono: uma lista simples da carteira ATIVA (sem arquivados) pra imprimir,
// pra olhar/guardar uma vez. Usa os mesmos dados/filtro/ordem já carregados na tela "Carteira
// ativa" (leadEhAtivo + cp786OrdenarConducao) — é a MESMA lista que aparece ali, só formatada
// pra impressão. Sem chamada nova ao servidor: se a tela já foi aberta uma vez, os dados
// já estão em memória (state.todosLeads/itemsAtivos/carteiraLeads).
function imprimirCarteiraAtiva(){
  const origem = [state?.todosLeads, state?.itemsAtivos, state?.carteiraLeads].find(a => Array.isArray(a) && a.length) || [];
  let ativos = origem.filter(l => typeof leadEhAtivo === "function" ? leadEhAtivo(l) : true);
  if (typeof cp786OrdenarConducao === "function") ativos = cp786OrdenarConducao(ativos);
  if (!ativos.length) { toast("Nenhum cliente ativo pra listar ainda."); return; }
  const linhas = ativos.map((l, i) => `<tr>
    <td>${i + 1}</td>
    <td>${escapeHtml(l.name || "Cliente")}</td>
    <td>${escapeHtml(l.phone || "—")}</td>
    <td>${escapeHtml(l.product || "—")}</td>
    <td>${escapeHtml(normalizarEtapa(l.etapa) || "—")}</td>
  </tr>`).join("");
  let box = document.getElementById("cpImprimirLista");
  if (!box) { box = document.createElement("div"); box.id = "cpImprimirLista"; document.body.appendChild(box); }
  box.innerHTML = `
    <h1>Clientes ativos — Corretor Pro</h1>
    <p>Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))} · ${ativos.length} cliente${ativos.length === 1 ? "" : "s"}</p>
    <table>
      <thead><tr><th>#</th><th>Nome</th><th>Telefone</th><th>Produto</th><th>Etapa</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
  // A classe liga a folha impressa só durante ESTA impressão (ver styles.css) — sem isso, a
  // tela "Gerador de proposta" (que também usa @media print) brigaria pela mesma folha na
  // próxima vez que o corretor imprimisse uma proposta. Só solta no "afterprint" (nunca logo
  // depois de chamar print()): no celular o print()/compartilhar não trava a execução como no
  // desktop, e soltar cedo trocaria o conteúdo da folha antes do navegador terminar de capturá-la.
  document.body.classList.add("cp1064-imprimindo");
  window.addEventListener("afterprint", () => document.body.classList.remove("cp1064-imprimindo"), { once: true });
  window.print();
}
window.imprimirCarteiraAtiva = imprimirCarteiraAtiva;


// v1084 — passa a DIZER se gravou. Antes engolia qualquer falha num catch vazio e não olhava a
// resposta do servidor, então quem chamava não tinha como saber se deu certo (ver
// registrarRespostaCliente, que mostrava "Registrei" mesmo sem ter registrado nada).
// Quem usa em modo "dispara e esquece" pode continuar ignorando o retorno.
async function registrarAprendizado(evento, estilo, detalhes){
  const id = state.lead?.id;
  if(!id) return false;
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, action: "aprendizado", evento, estilo: estilo || state.msgStyle, detalhes: detalhes || {} })
    });
    const data = await res.json().catch(()=>null);
    return !!(res.ok && data?.ok);
  }catch(_){ return false; }
}

// Copiar uma sugestão é apenas uma ação de interface. Não registra atendimento,
// não cria mensagem no histórico e não altera data/status do lead.

// ===== Fechar o ciclo: "o cliente respondeu?" =====
// Depois que você manda a mensagem, registra se o cliente respondeu — isso alimenta o
// aprendizado (qual abordagem funciona) sem depender de reimportar a conversa.
function respostaClienteBotoesHTML(){
  const b = (val, txt, cor, bg) => `<button type="button" onclick='registrarRespostaCliente("${val}")' style="flex:1;min-width:92px;padding:7px 10px;border-radius:8px;border:1px solid ${cor};background:${bg};color:${cor};font-size:12px;font-weight:950;cursor:pointer">${txt}</button>`;
  return `<div class="small" style="color:var(--muted);margin-bottom:6px;text-align:center">O cliente respondeu sua última mensagem?</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${b("sim", "✓ Respondeu", "var(--acao)", "rgba(104,255,149,.10)")}
      ${b("nao", "Não respondeu", "var(--risco)", "rgba(255,91,122,.10)")}
      ${b("aguardando", "Ainda não", "var(--muted)", "transparent")}
    </div>`;
}
function respostaClienteRecordedHTML(valor){
  const labels = { sim: "Respondeu ✓", nao: "Não respondeu", aguardando: "Aguardando resposta" };
  const cor = valor === "sim" ? "var(--acao)" : valor === "nao" ? "var(--risco)" : "var(--muted)";
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
    <span class="small" style="color:var(--soft)">Cliente respondeu? <b style="color:${cor}">${labels[valor] || valor}</b></span>
    <button type="button" onclick='registrarRespostaCliente("")' style="background:transparent;border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--muted);font-size:10px;font-weight:950;cursor:pointer">mudar</button>
  </div>`;
}
function renderRespostaCliente(lead){
  const r = respostaClienteRegistrada(lead);
  return r ? respostaClienteRecordedHTML(r) : respostaClienteBotoesHTML();
}
window.renderRespostaCliente = renderRespostaCliente;
async function registrarRespostaCliente(valor){
  const box = qs("#respostaClienteBox");
  if(!valor){ if(box) box.innerHTML = respostaClienteBotoesHTML(); return; } // "mudar"
  const id = state.lead?.id;
  if(id){
    // v1084 — só confirma na tela DEPOIS de o servidor confirmar. Antes o app pintava o estado
    // e dizia "Boa! Registrei que ele respondeu." mesmo sem ter gravado nada (num momento sem
    // sinal, por exemplo): o corretor seguia em frente achando que estava salvo e, na próxima
    // vez que abrisse o lead, os botões estavam de volta. Pior, o recarregarLeadFoco logo abaixo
    // relê do servidor e desfaz a tela na cara dele.
    let gravou = false;
    try{ gravou = await registrarAprendizado("cliente_respondeu", state.msgStyle, { resposta: valor }); }catch(_){ gravou = false; }
    if(!gravou){
      if(box) box.innerHTML = respostaClienteBotoesHTML();
      toast("Não consegui registrar agora. Confira a internet e toque de novo.");
      return;
    }
    try{
      const a = state.analysis = state.analysis || {};
      a.aprendizado = a.aprendizado || {}; a.aprendizado.eventos = a.aprendizado.eventos || [];
      a.aprendizado.eventos.push({ evento: "cliente_respondeu", estilo: state.msgStyle, detalhes: { resposta: valor }, quando: new Date().toISOString() });
    }catch(_){}
  }
  if(box) box.innerHTML = respostaClienteRecordedHTML(valor); // feedback imediato
  toast(valor === "sim" ? "Boa! Registrei que ele respondeu." : valor === "nao" ? "Registrei: não respondeu." : "Ok, aguardando resposta.");
  invalidarLeadsCache();
  // Atualiza o lead inteiro na hora (atendimento, respostas e datas) — sem precisar de F5.
  if(id) recarregarLeadFoco(id);
}
window.registrarRespostaCliente = registrarRespostaCliente;

// v952: a renderização real de Arquivados (com paginação e busca) vive só dentro da IIFE
// #724-2, exposta em window.carregarArquivados. Existia uma segunda função de mesmo nome aqui
// (mais antiga, sem paginação nem suporte a busca) que nenhuma chamada `window.`-qualificada
// nunca usava — mas a navegação chamava o nome solto "carregarArquivados()", que por escopo
// léxico do módulo resolvia pra ESTA função velha, não pra atual. Removida (ver fix em
// carregarTelaAtiva). valeRevisitarArquivado também saiu: só era usada por este bloco morto,
// e já nem era chamada com motivos reais (sempre null) havia tempo.

async function reativarLeadArquivado(id, btn){
  if(!id) return;
  const msg = "Reativar este cliente? Ele volta para os atendimentos ativos.";
  const ok = (typeof cp903Confirm === "function")
    ? await cp903Confirm({ titulo: "Reativar lead", mensagem: msg, ok: "Reativar" })
    : confirm(msg);
  if(!ok) return;
  if(btn){ btn.disabled = true; btn.textContent = "Reativando..."; }
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      // v1073 — "Ativo" é o único estado de volta possível desde a v1069 (o servidor rejeita
      // qualquer valor antigo de funil, ex.: "Atendimento" — mandar isso quebrava o Reativar).
      body: JSON.stringify({ id, action: "etapa", etapa: "Ativo" })
    });
    if(!res.ok) throw new Error("falha");
    toast("Lead reativado.");
    const card = document.querySelector(`[data-arquivado-id="${id}"]`);
    if(card){ card.style.transition = "opacity .25s, transform .25s"; card.style.opacity = "0"; card.style.transform = "translateX(18px)"; setTimeout(() => card.remove(), 240); }
    loadRecentLeads();
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Reativar"; }
    toast("Erro ao reativar.");
  }
}
window.reativarLeadArquivado = reativarLeadArquivado;

qs("#copyMessage").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(qs("#messageText").value);toast("Mensagem copiada.")}
  catch(e){qs("#messageText").select();document.execCommand("copy");toast("Mensagem copiada.")}
  registrarAprendizado("mensagem_copiada");
});
qs("#openWhatsapp").addEventListener("click",()=>{
  let p=qs("#clientPhone").value.replace(/\D/g,"");
  if(p&&p.length<=11&&!p.startsWith("55"))p="55"+p;
  const text=encodeURIComponent(qs("#messageText").value);
  registrarAprendizado("whatsapp_aberto", state.msgStyle, { tinha_telefone: !!p });
  location.href=p?`https://wa.me/${p}?text=${text}`:`https://wa.me/?text=${text}`;
});
// Camada EXTRA de atualização (além do service worker): compara a versão CARREGADA (no topo
// da tela) com a versão real do index.html no servidor. Se o servidor já tem uma maior, limpa
// os caches e recarrega UMA vez (trava em sessionStorage impede qualquer loop). Cobre o caso
// em que o service worker não detecta a troca sozinho.
async function checarVersaoServidor(){
  try{
    // Nunca recarrega enquanto um ZIP recebido do WhatsApp estiver pendente/processando.
    // No cold start, um reload aqui era suficiente para perder a primeira tentativa.
    if(window.__cpShareImportActive || state?.processing || state?.pendingSharedRecordId) return;
    if(sessionStorage.getItem("vchk")) return;
    const elv = document.querySelector(".mob-ver, .sb-ver-top");
    const attr = document.documentElement.dataset.appVersion || document.body?.dataset?.appVersion || "";
    const atual = parseInt(attr,10) || (elv ? (parseInt((String(elv.textContent).match(/#(\d+)/)||[])[1], 10) || 0) : 0);
    if(!atual) return;
    const r = await fetch("./index.html?vc=" + Date.now(), { cache: "no-store" });
    if(!r.ok) return;
    const html = await r.text();
    const m = html.match(/Atualiza[çc][ãa]o #(\d+)/);
    const servidor = m ? (parseInt(m[1], 10) || 0) : 0;
    sessionStorage.setItem("vchk", "1"); // só tenta 1x por sessão — nunca entra em loop
    if(servidor > atual){
      try{ if(window.caches){ const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } }catch(_){}
      location.reload();
    }
  }catch(_){ /* offline/erro: ignora, segue na versão atual */ }
}
if("serviceWorker" in navigator){
  // ATUALIZAÇÃO AUTOMÁTICA: quando uma versão nova chega com o app aberto, o novo service
  // worker assume e a página recarrega SOZINHA pra versão nova — sem precisar fechar/reabrir
  // o app na mão (era a causa do "fica preso na versão antiga").
  let recarregandoSW = false;
  const tinhaController = !!navigator.serviceWorker.controller; // já tinha versão rodando antes?
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Só recarrega numa ATUALIZAÇÃO (já havia uma versão ativa). Na 1ª instalação, não.
    // Se há compartilhamento pendente, adia: o ZIP só pode sair da fila após sucesso.
    if(recarregandoSW || !tinhaController) return;
    if(window.__cpShareImportActive || state?.processing || state?.pendingSharedRecordId){
      window.__cpReloadAposShare = true;
      return;
    }
    recarregandoSW = true;
    location.reload();
  });
  addEventListener("load", async ()=>{
    try{
      const reg = await navigator.serviceWorker.register("/service-worker.js?v=__VERSION__", { scope: "/" });
      // Avisa quando uma versão nova terminou de baixar (vai assumir e recarregar).
      reg.addEventListener("updatefound", () => {
        const novo = reg.installing;
        if(!novo) return;
        novo.addEventListener("statechange", () => {
          if(novo.state === "installed" && navigator.serviceWorker.controller){
            try{ toast("Nova versão — atualizando…"); }catch(_){}
          }
        });
      });
      try{ await reg.update(); }catch(e){}
      try{ await navigator.serviceWorker.ready; }catch(e){}
      // Não força checagem/reload quando a aba volta do segundo plano.
      // Isso causava tela branca e atraso ao alternar abas, porque o app reiniciava
      // e precisava reler/renderizar a base antes de responder.
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => checarVersaoServidor(), { timeout: 8000 });
      } else {
        setTimeout(checarVersaoServidor, 4000);
      }
      setTimeout(async () => {
        await limparSharesLocaisAntigos();
        limparImportacoesRemotasAntigas();
        if(!state?.processing) checkShared();
      }, 900);
    }catch(e){
      console.warn("Falha ao registrar service worker do Corretor Pro", e);
    }
  });
}
addEventListener("resize",()=>{if(!isDesktop()){qsa(".screen").forEach(e=>e.classList.remove("active"));qs("#"+state.active)?.classList.add("active")}});

(async function checkStatus(){
  const stamp = qs("#statusStamp");
  if(!stamp) return;
  try{
    const res = await fetch("./api/diagnostico?mode=status", { cache: "no-store" });
    const data = await res.json();
    const env = data?.env || {};
    const problemas = [];
    if(!env.OPENAI_API_KEY) problemas.push("Transcrição de áudios indisponível no momento");
    if(!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)) problemas.push("Salvamento de conversas indisponível no momento");
    if(problemas.length){
      stamp.textContent = "" + problemas.join(" · ");
      stamp.style.color = "var(--risco)";
    } else {
      stamp.textContent = ""; // tudo OK, nao polui
    }
  }catch(_){
    stamp.textContent = ""; // se a checagem falhar, melhor sumir do que mostrar erro
  }
})();

function refreshAllSections(){
  // Nunca monta telas escondidas. Atualiza a home/sino e somente a tela que o usuário está vendo.
  carregarAgendaTopo();
  // force=true é essencial aqui: prioridadeAtendimento/scoreConversaoHoje (app.js) cacheiam o
  // score por OBJETO de lead (WeakMap) pra performance — sem forçar uma busca nova (que sempre
  // cria objetos novos), a Home continuaria reaproveitando os MESMOS objetos e os MESMOS scores
  // já calculados com a config antiga, mesmo com o valor novo já salvo no localStorage. Foi
  // exatamente esse detalhe que deixava a correção da v1066 (sincronizar Cérebro entre aparelhos)
  // incompleta: a config chegava certa, mas a fila só reordenava depois de um F5 manual.
  if(state.active === "home") carregarDashboard(true);
  else carregarTelaAtiva(state.active, true);
}
window.refreshAllSections = refreshAllSections;

// Atalhos de teclado (só desktop)
document.addEventListener("keydown", (e) => {
  // Ignora se está digitando em input/textarea/contenteditable
  const el = document.activeElement;
  const ehTexto = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  if(ehTexto) return;
  if(!isDesktop()) return;
  // v1081 — combinação do navegador (Ctrl+H, Alt+M, Cmd+Z...) não é atalho do app: antes disso
  // o app engolia a tecla e navegava no lugar do navegador. Acento/ç em teclado ABNT também
  // chega como composição e não pode virar navegação.
  if(e.ctrlKey || e.altKey || e.metaKey || e.isComposing || e.key === "Process") return;
  // v1081 — com um lead ABERTO, letra solta nunca navega. Este era o outro lado do bug da
  // observação: bastava o foco escapar do campo de texto (a tela se remontando por baixo, um
  // clique fora) pra digitação virar navegação — "m" jogava o corretor no Menu, "h" na Home,
  // e o que ele achava estar escrevendo ia junto com a tela.
  if(state.focoLeadId || state.lead?.id) return;
  // / foca busca
  if(e.key === "/"){ const b = qs("#buscaGlobal"); if(b){ e.preventDefault(); b.focus(); } return; }
  // 1, 2, 3 selecionam o card do Top 3
  if(e.key === "1" || e.key === "2" || e.key === "3"){
    const idx = Number(e.key) - 1;
    const card = qsa(".top3-mini")[idx];
    if(card){ e.preventDefault(); card.click(); }
    return;
  }
  // h volta pra home, m menu, z zip, c cérebro
  const mapTeclas = { h: "home", m: "menu", z: "zip", c: "cerebro" };
  if(mapTeclas[e.key]){ e.preventDefault(); show(mapTeclas[e.key]); }
});

/* ============================================================
   ATUALIZAÇÃO #631 — FORMATO DAS TELAS CONFORME MOCKUPS APROVADOS
   Mantém os dados e funções existentes; troca a composição visual.
   ============================================================ */
function ui631Icon(nome){
  const icons = {
    ativos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3"/><path d="M5 20c.5-5 2.8-7 7-7s6.5 2 7 7"/></svg>',
    quente:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 3s1 4-2 7c-2 2-3 4-2 6 1 3 5 4 8 1 3-3 1-8-1-10 0 3-2 4-3 4 1-3 0-6 0-8z"/></svg>',
    compromisso:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12l4 4 10-10"/></svg>',
    reaquecer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.2 8A7 7 0 0118 6l2 1M18 16a7 7 0 01-12 2l-2-1"/></svg>',
    conversa:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v11H8l-4 4z"/></svg>',
    cerebro:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M9 9h.01M15 9h.01M9 15c2 1 4 1 6 0"/></svg>',
    resposta:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'
  };
  return icons[nome] || icons.ativos;
}

// Classificação única usada pela Home, Atendimentos e Pipeline.
// Antes cada tela tinha uma regra diferente, por isso a Home mostrava 5 quentes
// e Atendimentos mostrava zero.
function leadEhAtivo(l){
  return normalizarEtapa(l?.etapa) !== ETAPA_ARQUIVADO;
}
function leadEhQuente(l){
  if(!leadEhAtivo(l)) return false;
  const tipo = String(l?.analysis?.tipoRetomada||"").toLowerCase();
  const interesse = String(l?.analysis?.diagnostico?.interesse||"").toLowerCase();
  return tipo === "quente-fechar" || interesse === "alto";
}
function leadEhReaquecer(l){
  return leadEhAtivo(l) && (Number(l?.daysSinceLastInteraction)||0) >= 14 && !ehContatadoHoje(l) && !lembreteFuturo(l);
}
function abrirAtendimentosFiltro(filtro="todos"){
  state.carteiraFiltro=filtro;
  state.carteiraVisibleCount=CARTEIRA_PAGE_SIZE;
  show("carteira",{navKey:"leads"});
  cpReplaceRoute(cpRouteForScreen("carteira"));
}
window.leadEhQuente=leadEhQuente;
window.abrirAtendimentosFiltro=abrirAtendimentosFiltro;

function cp786Modelo(l){
  try{return ui670ModeloComercial(l)||{};}catch(_){return {};}
}
function cp786DataTs(v, hora=''){
  if(v==null||v==='') return 0;
  if(v instanceof Date) return Number.isFinite(v.getTime())?v.getTime():0;
  if(typeof v==='number'){
    const n=v<1e12?v*1000:v;
    return Number.isFinite(n)?n:0;
  }
  const raw=String(v).trim();
  if(!raw) return 0;
  if(/^\d{10,13}$/.test(raw)){
    const n=Number(raw); return Number.isFinite(n)?(raw.length<=10?n*1000:n):0;
  }
  const br=raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  const iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const m=br||iso;
  if(m){
    const y=Number(br?m[3]:m[1]), mes=Number(m[2]), dia=Number(br?m[1]:m[3]);
    const hm=String(hora||'').match(/\b([01]?\d|2[0-3])[:h](\d{2})?\b/);
    const hh=hm?String(hm[1]).padStart(2,'0'):'12', mm=hm?String(hm[2]||'00').padStart(2,'0'):'00';
    const d=new Date(`${String(y).padStart(4,'0')}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}T${hh}:${mm}:00-03:00`);
    return Number.isFinite(d.getTime())?d.getTime():0;
  }
  const direto=new Date(raw);
  return Number.isFinite(direto.getTime())?direto.getTime():0;
}
function cp786MensagemTs(m){
  return cp786DataTs(m?.iso||m?.timestamp||m?.quando)||cp786DataTs(m?.date,m?.time);
}
function cp786UltimaMensagemReal(l){
  const msgs=Array.isArray(l?.recentMessages)?l.recentMessages:[];
  const pn=String(l?.name||'').toLowerCase().trim().split(/\s+/)[0]||'';
  const candidatos=[];
  for(let i=0;i<msgs.length;i++){
    const m=msgs[i];
    if(!m||!String(m?.text||'').trim()) continue;
    const source=String(m?.source||'').toLowerCase(), type=String(m?.type||'').toLowerCase();
    if(source==='manual'||source==='crm'||type==='print-whatsapp'||['atendimento','nota','ligacao','visita','presencial'].includes(type)) continue;
    candidatos.push({m,i,ts:cp786MensagemTs(m),falante:ehMsgDoCliente(m,pn)?'contato':'corretor'});
  }
  if(candidatos.length){
    const todosComData=candidatos.every(x=>x.ts>0);
    if(todosComData) return candidatos.reduce((a,b)=>b.ts>=a.ts?b:a);
    return candidatos[candidatos.length-1];
  }
  return {m:null,i:-1,ts:0,falante:'desconhecido'};
}
function cp786UltimoFoiCliente(l,modelo=null,ultima=null){
  const real=ultima||cp786UltimaMensagemReal(l);
  if(real?.falante&&real.falante!=='desconhecido') return real.falante==='contato';
  const mc=modelo||cp786Modelo(l), a=l?.analysis||{}, d=a?.diagnostico||{};
  const canonico=String(mc?.contexto?.ultimaPessoaFalar||'').toLowerCase();
  if(canonico) return /contato|cliente|lead|comprador|interessad/.test(canonico);
  const autor=String(d.ultimaPessoa||d.ultimoAutor||a.ultimaPessoa||l?.lastMessageSender||l?.lastSender||'').toLowerCase();
  return /cliente|contato|lead|comprador|interessad/.test(autor);
}
function cp786UltimaMensagemTs(l,ultima=null){
  const real=ultima||cp786UltimaMensagemReal(l);
  if(real?.m) return Number(real.ts)||0;
  return cp786DataTs(l?.lastMessageAt||l?.lastInteractionAt);
}
function cp786UltimoAtendimentoTs(l){
  const eventos=Array.isArray(l?.analysis?.aprendizado?.eventos)?l.analysis.aprendizado.eventos:[];
  return eventos.reduce((max,e)=>e?.evento==='contato_manual'?Math.max(max,cp786DataTs(e.quando)):max,0);
}
function cp786ClienteRespondeu(l,modelo=null,ultima=null){
  if(!leadEhAtivo(l)) return false;
  const mc=modelo||cp786Modelo(l), real=ultima||cp786UltimaMensagemReal(l);
  if(!cp786UltimoFoiCliente(l,mc,real)) return false;
  const acao=mc?.acao||{}, status=String(acao.status||''), responsavel=String(acao.responsavel||'');
  if(['sem-acao-urgente','aguardando-resposta','compromisso-agendado'].includes(status)||responsavel==='ninguem') return false;
  const msgTs=cp786UltimaMensagemTs(l,real), atendimentoTs=cp786UltimoAtendimentoTs(l);
  if(msgTs) return !atendimentoTs||msgTs>atendimentoTs;
  // Sem horário confiável, mostra uma vez até o primeiro atendimento; depois não reaparece sozinho.
  return !atendimentoTs;
}
function cp786TemCompromisso(l){
  if(!leadEhAtivo(l)) return false;
  if(lembreteHojeOuFuturo(l)) return true;
  // Compromisso vencido e ainda NÃO atendido continua sendo compromisso (fica em Programados,
  // com destaque de atrasado). Só sai quando o corretor marca atendimento.
  if(typeof cp786CompromissoAtrasado==='function' && cp786CompromissoAtrasado(l)) return true;
  const apps=Array.isArray(l?.analysis?.confirmedAppointments)?l.analysis.confirmedAppointments:[];
  let dispensados=null;
  try{ dispensados=typeof compromissosDispensados==='function'?compromissosDispensados():null; }catch(_){ dispensados=null; }
  for(const ap of apps){
    const data=String(ap?.data||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    const diff=typeof ui671DiasAte==='function'?ui671DiasAte(data):null;
    if(diff==null||diff<0) continue;
    const prova=String(ap?.trechoLiteral||ap?.quando||ap?.oQue||'').trim();
    if(!prova) continue;
    const key=String(l?.id||'')+'|'+String(ap?.oQue||'')+'|'+data;
    if(dispensados?.has?.(key)) continue;
    return true;
  }
  return false;
}
// v885/v886 — PRIORIDADE por FATOS reais (decisão do dono): não existe valor R$ nem etapa/funil
// nem marco de proposta pra ranquear. Sobram dois fatos que TODO lead tem:
//   Engajamento (nº de mensagens = interesse/probabilidade) + Abandono (dias sem toque real).
// v886: removido o bônus "cliente falou por último" (o dono nunca deixa o cliente sem resposta,
// e a última msg do cliente costuma ser só "obrigado/ok" — não diz prioridade). Pesos calibráveis.
const CP_PESO_ENGAJAMENTO = 2;     // por mensagem DO CLIENTE (com teto pra thread gigante não dominar)
const CP_TETO_ENGAJAMENTO = 120;   // satura o engajamento
const CP_PESO_ABANDONO = 1;        // por dia parado
const CP_TETO_ABANDONO = 90;       // satura o abandono (lead de 300 dias não vence só pela idade)
const CP_DOSE_DIA = 10;            // "Fazer agora" mostra no máx. 10 por dia (dose executável)
const CP_MIN_MSGS_PRIORIDADE = 5;  // <5 mensagens DO CLIENTE = prospecção rasa, não entra na fila
const CP_TETO_BARRA_INTERESSE = 100;// barra "Interesse do cliente" cheia em 100 mensagens do cliente
const CP_JANELA_INTERESSE_DIAS = 90;// só conta mensagens do cliente dos últimos 90 dias (interesse atual)
// v889: engajamento passa a contar só as mensagens DO CLIENTE (não as minhas explicando) —
// mesma régua da barra de interesse (decisão do dono).
function cpNotaPrioridade(l){
  const msgs = Math.min(mensagensDoCliente(l), CP_TETO_ENGAJAMENTO);
  const dParado = diasParado(l);
  const dias = Math.min(Number.isFinite(dParado) ? dParado : 0, CP_TETO_ABANDONO);
  return msgs * CP_PESO_ENGAJAMENTO + dias * CP_PESO_ABANDONO;
}
// Sábado e domingo: sem "Fazer agora" (o dono não trabalha fila no fim de semana).
// v943 — multi-linha de propósito: era 1 linha só, e testes que extraem essa função via regex
// "\n\}" atravessavam ela sem querer e engoliam a função seguinte inteira (mascarou por acidente
// uma função faltando em teste — só não deu ReferenceError porque "vazou" pra dentro do stub).
// v1091 — DIAS DE ATENDIMENTO CONFIGURÁVEIS. Sábado e domingo eram cravados aqui como dias sem
// fila (regra pedida na v914/v937). Só que corretor de imóveis costuma trabalhar sábado — é dia de
// visita. Agora cada corretor marca no Cérebro os dias em que quer receber a fila "Fazer agora".
// Padrão (sem nada configurado): segunda a sexta, exatamente como era antes desta versão.
const CP_DIAS_ATENDIMENTO_PADRAO = [1, 2, 3, 4, 5]; // 0=domingo ... 6=sábado
function cpDiasDeAtendimento(){
  try{
    const cfg = (typeof obterCerebroConfigParaAnalise === "function") ? obterCerebroConfigParaAnalise() : null;
    const dias = cfg?.diasAtendimento;
    if(Array.isArray(dias)){
      const limpos = [...new Set(dias.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))];
      // Lista vazia significaria "não atendo nunca" — aí a fila sumiria pra sempre e o corretor
      // não entenderia por quê. Nesse caso vale o padrão.
      if(limpos.length) return limpos;
    }
  }catch(_){}
  return CP_DIAS_ATENDIMENTO_PADRAO;
}
window.cpDiasDeAtendimento = cpDiasDeAtendimento;
// Mantém o nome antigo (usado em vários pontos da tela): "hoje é um dia sem fila?".
function cpFimDeSemana(){
  // O "typeof" não é frescura: vários testes extraem ESTA função do arquivo e a rodam isolada,
  // sem o resto do app em volta. Sem a guarda, todos quebrariam — e o padrão devolvido aqui é
  // exatamente o comportamento antigo (segunda a sexta).
  const dias = (typeof cpDiasDeAtendimento === "function") ? cpDiasDeAtendimento() : [1, 2, 3, 4, 5];
  return !dias.includes(new Date().getDay());
}
// Nome do próximo dia em que ele atende — melhor que cravar "volta na segunda", que fica errado
// pra quem marcou sábado.
const CP_NOMES_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
function cpProximoDiaDeAtendimento(){
  const dias = cpDiasDeAtendimento();
  const hoje = new Date().getDay();
  for(let i = 1; i <= 7; i++){
    const d = (hoje + i) % 7;
    if(dias.includes(d)) return CP_NOMES_DIAS[d];
  }
  return "segunda";
}
// v943 — a ORDEM do "Fazer agora" precisa ser uma JUNÇÃO DE FATORES reais da conversa, não uma
// regra isolada (nem "mais mensagens", nem "mais dias parado", nem só "cliente esperando você").
// Pedido explícito do dono: analisar o histórico inteiro e estimar PROBABILIDADE DE FECHAMENTO
// combinando — engajamento (quantas mensagens o cliente mandou), RECORRÊNCIA (voltou a conversar
// em quantos dias diferentes — interesse sustentado pesa mais que uma explosão de mensagens num
// dia só), quantas PERGUNTAS ele fez (dúvida real = interesse ativo), se já se discutiu
// valor/condição de pagamento/proposta (sinal de negociação avançada — contextoPrioridadeIA, que
// já lê o resumo da IA sobre a conversa inteira), e se o cliente é quem está esperando a SUA
// resposta agora (bônus de responsividade, não mais um estágio isolado que trava tudo o resto).
// clientMessageDays/clientQuestionCount vêm do servidor (calculados sobre o histórico INTEIRO,
// como clientMessageCount da v942 — a lista só recebe uma prévia de mensagens).
function cpProbabilidadeFechamento(l){
  // Pesos calibrados pra NENHUM fator sozinho dominar: um lead "explosão de mensagens" (ex.: 218
  // msgs em 2 dias, sem retomada, sem pergunta, sem negociação) não pode vencer um lead com poucas
  // mensagens mas recorrente + qualificado. Por isso engajamento tem teto BAIXO (30) e peso 1,
  // enquanto recorrência/perguntas/negociação (os fatores que indicam interesse REAL, não só
  // volume) têm peso maior.
  const engajamento = Math.min((typeof mensagensDoCliente === 'function' ? mensagensDoCliente(l) : 0), 30);
  const recorrencia = Math.min(Number(l?.clientMessageDays) || 0, 20);
  const perguntas = Math.min(Number(l?.clientQuestionCount) || 0, 20);
  let sinalNegociacao = 0;
  try{
    const ctx = (typeof contextoPrioridadeIA === 'function') ? contextoPrioridadeIA(l) : null;
    if(ctx?.propostaAtiva) sinalNegociacao += 1;   // já se falou de valor/condição/entrada/financiamento
    if(ctx?.retornoProposta) sinalNegociacao += 1; // negociação num ponto avançado (proposta/contraproposta)
  }catch(_){}
  const resp = Number(l?.daysSinceClientReply);
  const toque = Number(l?.daysSinceLastTouch);
  // v944: falar por último não basta — se a última mensagem do cliente foi só uma despedida/
  // agradecimento ("Claro", "Obrigado pela atenção"), sem pergunta nem pedido, não existe bola
  // com o cliente esperando resposta. Só pondera quando a última fala dele de fato pede resposta.
  // v1017 — extraído pra ultimaMsgClientePedeResposta (compartilhada com emJanelaDeEspera/
  // entraEmRetomada, que tinham o MESMO problema sem essa checagem — ver comentário ali).
  const clienteEsperaVoce = Number.isFinite(resp) && (!Number.isFinite(toque) || resp <= toque) && ultimaMsgClientePedeResposta(l);
  // v1056 — pedido original do dono, do início desta rodada: "fazer o tempo parado pesar contra
  // a posição na fila" — sem tirar o lead da lista de vez, só derrubar pra trás de quem está
  // ativo de verdade. Corrigido pra usar SÓ o último atendimento (ultimoAtendimentoTs), nunca
  // mensagem: "não interessa a contagem de última mensagem, somente de último atendimento, ponto
  // final" (palavras do dono). v1069 — quem NUNCA foi atendido (ultimoAtendimentoTs cai no ramo
  // "sem data") fica no teto de 90 dias (o mais frio possível), então não domina o topo da fila
  // só por entrar sem data — mas continua elegível a aparecer (regra v1069 de cpFilaFazerAgora).
  // Teto de 90 dias: depois disso a penalidade para de crescer (não precisa ficar infinitamente pior).
  let diasFrio = 90;
  try{
    const atTs = (typeof ultimoAtendimentoTs === 'function') ? ultimoAtendimentoTs(l) : 0;
    if(atTs){
      const dAt = diasCalendarioBR(atTs);
      if(dAt != null && Number.isFinite(dAt)) diasFrio = dAt;
    }
  }catch(_){}
  diasFrio = Math.min(diasFrio, 90);
  return engajamento*1 + recorrencia*8 + perguntas*6 + sinalNegociacao*35 + (clienteEsperaVoce ? 30 : 0) - diasFrio*2;
}
// candidatos ao "Fazer agora": entram só os NÃO atendidos hoje, com engajamento real (cliente já
// falou) e fora da janela de espera. Ordem = probabilidade de fechamento (cpProbabilidadeFechamento,
// junção de fatores). Esta é a FILA BRUTA (candidatos elegíveis) — quantos de fato "contam" como
// dose de hoje é cpFazerAgoraDose.
function cpFilaFazerAgora(items){
  if(cpFimDeSemana()) return [];
  const ativos = (Array.isArray(items) ? items : []).filter(leadEhAtivo);
  // v938/v939 — bug real: "Puxar da fila"/"Fazer agora" oferecia lead que o corretor CONTATOU
  // ONTEM e ainda está dentro do prazo normal de resposta, como se fosse "prioridade agora, tem
  // objeção pra tratar" — errado, a bola tá com o cliente. A v938 bloqueou isso com
  // cpAguardandoResposta, mas essa checagem NUNCA expira (bloqueio permanente) — ignorava a
  // regra que o app JÁ TEM pra isso: emJanelaDeEspera/limiarRetomada (espera 3 dias se o lead é
  // novo, 5 se não é; depois disso o lead volta a ser candidato normalmente, mesmo que a bola
  // ainda esteja tecnicamente do lado dele — é a MESMA regra que entraEmRetomada usa). Corrigido
  // pra usar essa regra existente em vez de inventar um bloqueio que nunca é revisto.
  // v1069 — regra definitiva pedida pelo dono (revoga a v1057 e o gate de aguardar da v1068):
  // "Fazer agora" mostra o lead se, e só se, ele NUNCA foi atendido OU já passou do prazo de
  // descanso configurado no Cérebro (emJanelaDeEspera). O aviso da IA em
  // recomendacaoContato.aguardar (v1059/v1068) NÃO gate mais essa fila — "esquece o que está
  // escrito", nas palavras do dono: só data de atendimento decide.
  const pool = ativos.filter(l => {
    const nuncaAtendido = !(typeof ultimoAtendimentoTs==='function' && ultimoAtendimentoTs(l));
    const passouPrazo = !(typeof emJanelaDeEspera==='function' && emJanelaDeEspera(l));
    return !ehContatadoHoje(l) && !cp786TemCompromisso(l) && (nuncaAtendido || passouPrazo);
  });
  // v1024 — calcula a probabilidade de fechamento UMA VEZ por lead antes de ordenar, em vez de
  // dentro do comparador do .sort() (que chamava cpProbabilidadeFechamento de novo, do zero, a
  // cada COMPARAÇÃO — pra 227 leads isso é milhares de recomputações redundantes por render;
  // achado real por trás da lentidão reportada pelo dono mesmo após os caches do servidor v1017).
  // Mesmo resultado de ordenação de antes, só sem o trabalho repetido.
  const comScore = pool.map(l => ({ l, score: cpProbabilidadeFechamento(l), msgs: mensagensDoCliente(l) }));
  comScore.sort((x,y) => (y.score - x.score) || (y.msgs - x.msgs));
  return comScore.map(x => x.l);
}
// v1017 — cpFatoresRankingLead/cpMotivoFechamento (o "motivo" do "Fazer agora" — v945/946,
// sobrevivia só dentro do card do lead desde a v975) foram REMOVIDAS: o dono pediu de vez ("só
// serve pra incomodar, não me ajuda em nada, só polui a tela"). O card "Fazer agora" do detalhe
// do lead (renderLeadFoco) não calcula nem mostra mais esse texto.
// v922 tentou uma "dose fixa" persistida no aparelho (localStorage) pra parar de repor
// automaticamente quem era atendido. Só que criou um problema novo: publicar a atualização no
// meio do dia fazia o app montar essa lista fixa NAQUELE momento (excluindo só quem já tinha
// sido atendido ATÉ ALI), e ela não sabia de nada que o corretor já tinha feito antes da
// atualização chegar — confuso, e ainda dependia só do aparelho (não sincronizava PC↔celular).
// v924 — conta bem mais simples e robusta: "Fazer agora" = META do dia (10) MENOS quantos você
// JÁ ATENDEU hoje (a mesma contagem que já aparece em "Atendimentos", ex.: 9/10 lá = falta 1
// aqui). Sem lista travada, sem localStorage, sem depender de quando o app foi atualizado —
// atender qualquer lead hoje faz esse número cair na hora, em qualquer aparelho, sempre.
function cpAtendidosHojeTotal(items){
  // v980 — o comentário da v907 (algumas linhas abaixo, em renderSaudacao) já dizia que
  // "atendidos hoje" devia contar TODO lead atendido hoje, INCLUSIVE o que foi arquivado
  // depois — mas esta função continuava filtrando por leadEhAtivo, então um lead atendido e
  // arquivado no mesmo dia sumia da conta aqui (Home/dose) enquanto a tela Atendimentos
  // (cp788RenderAtendimentos, sem esse filtro) continuava contando — números diferentes ao
  // mesmo tempo (relato do dono: 11 na Home, 12 nos Atendimentos). Sem o filtro, e usando a
  // base COMPLETA (todos os leads, não só os ativos que o chamador às vezes já filtrou antes
  // de passar pra cá) sempre que ela já estiver carregada.
  const base = (Array.isArray(state?.todosLeads) && state.todosLeads.length) ? state.todosLeads : items;
  let n = 0;
  for(const l of (Array.isArray(base) ? base : [])) if(ehContatadoHoje(l)) n++;
  return n;
}
// v1012 — a meta diária deixou de ser fixa em 10: cada corretor escolhe a sua no Cérebro
// Comercial (campo "Atendimentos por dia", 1–50). Sem valor salvo, vale o padrão histórico
// CP_DOSE_DIA (10). Lê pela mesma fonte da análise (localStorage/form via
// obterCerebroConfigParaAnalise) porque state.cerebroCfg nunca é preenchido.
function cpMetaAtendimentosDia(){
  try{
    const cfg = (typeof obterCerebroConfigParaAnalise === "function") ? obterCerebroConfigParaAnalise() : null;
    const n = Number(cfg?.atendimentosPorDia);
    if(Number.isFinite(n) && n >= 1 && n <= 50) return Math.round(n);
  }catch(_){}
  return CP_DOSE_DIA;
}
// Dose do dia (o número do card "Fazer agora"): meta do corretor menos quem já foi atendido hoje.
function cpFazerAgoraDose(items){ return cpFimDeSemana() ? 0 : Math.max(0, cpMetaAtendimentosDia() - cpAtendidosHojeTotal(items)); }
window.cpNotaPrioridade = cpNotaPrioridade;
window.cpFilaFazerAgora = cpFilaFazerAgora;
window.cpFimDeSemana = cpFimDeSemana;
window.cpAtendidosHojeTotal = cpAtendidosHojeTotal;
window.cpFazerAgoraDose = cpFazerAgoraDose;
window.cpMetaAtendimentosDia = cpMetaAtendimentosDia;

// v885 — RAIZ: classifica pela SITUAÇÃO REAL, não pelo campo de status da IA (que vinha vazio
// e jogava quase tudo em "aguardando", inclusive retomadas vencidas). Três estados:
//   'programados' (Agenda): tem compromisso/lembrete marcado.
//   'aguardando' : atendido recentemente (descansa), lead cru (<CP_MIN_MSGS_PRIORIDADE msgs =
//                  prospecção) OU a bola está legitimamente com o cliente e no prazo.
//   'agora'      : precisa de VOCÊ — responder ou RETOMAR (parado 5+ dias, retorno/lembrete
//                  vencido, cliente falou por último, quente-fechar...).
// v906 — "Aguardando cliente" passou a ter UM significado só (pedido do dono): VOCÊ já atendeu
// (copiou a mensagem ou marcou atendimento) e o cliente AINDA NÃO respondeu — a bola está com
// ele. Antes era um balde de sobra (caía todo lead raso/parado) e o número não dizia nada.
function ultimaMsgClienteTs(l){
  const msgs = Array.isArray(l?.recentMessages) ? l.recentMessages : [];
  const pn = String(l?.name||"").toLowerCase().trim().split(/\s+/)[0] || "";
  let max = 0;
  for(const m of msgs){
    if(!String(m?.text||"").trim()) continue;
    if(!ehMsgDoCliente(m, pn)) continue;
    const t = Date.parse(m?.iso || "");
    if(!isNaN(t) && t > max) max = t;
  }
  return max;
}
function cpAguardandoResposta(l){
  const at = (typeof ultimoAtendimentoTs === 'function') ? ultimoAtendimentoTs(l) : 0;
  if(!at) return false;                 // nunca atendido pelo app → não é "aguardando cliente"
  return ultimaMsgClienteTs(l) <= at;   // cliente não respondeu DEPOIS do meu atendimento
}
function cp786Categoria(l,modelo=null,ultimaReal=null){
  if(!leadEhAtivo(l)) return '';
  if(cp786TemCompromisso(l)) return 'programados';
  // v1071 — "aguardando" só vale ENQUANTO ainda está dentro do prazo de descanso configurado
  // (emJanelaDeEspera): sem esse limite, o mesmo cliente ficava "aguardando" pra sempre mesmo
  // depois de já ter passado do prazo (quando ele já reaparece em "Fazer agora") — os dois
  // números diziam coisas opostas sobre o mesmo cliente. Passado o prazo, ele "vence" aqui e
  // cai no fluxo normal (agora/sem-acao) — deixa de contar como espera legítima.
  if(cpAguardandoResposta(l) && emJanelaDeEspera(l)) return 'aguardando'; // atendi, cliente não respondeu e ainda está no prazo
  if(mensagensDoCliente(l) < CP_MIN_MSGS_PRIORIDADE) return 'sem-acao'; // lead raso: prospecção, fora dos cards de destaque
  return entraEmRetomada(l) ? 'agora' : 'sem-acao';                    // vale um toque? Fazer agora; senão, só em "Total de leads"
}
function cp786CategoriaLabel(c){
  return ({agora:'Fazer agora',respondeu:'Cliente respondeu',programados:'Agenda',aguardando:'Aguardando cliente','sem-acao':'Sem ação agora'})[c]||'Sem ação agora';
}
function cp786CompromissoOrdemTs(l){
  let menor=Number.MAX_SAFE_INTEGER;
  const lembreteTs=cp786DataTs(l?.analysis?.lembrete?.quando);
  if(typeof lembreteFuturo==='function'&&lembreteFuturo(l)&&lembreteTs) menor=Math.min(menor,lembreteTs);
  const apps=Array.isArray(l?.analysis?.confirmedAppointments)?l.analysis.confirmedAppointments:[];
  let dispensados=null;
  try{dispensados=typeof compromissosDispensados==='function'?compromissosDispensados():null;}catch(_){dispensados=null;}
  for(const ap of apps){
    const data=String(ap?.data||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    const diff=typeof ui671DiasAte==='function'?ui671DiasAte(data):null;
    if(diff==null||diff<0) continue;
    const key=String(l?.id||'')+'|'+String(ap?.oQue||'')+'|'+data;
    if(dispensados?.has?.(key)) continue;
    const hora=String(ap?.hora||ap?.quando||ap?.dataHora||'').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const ts=cp786DataTs(data,hora?`${hora[1]}:${hora[2]}`:'12:00');
    if(ts) menor=Math.min(menor,ts);
  }
  return menor;
}
// Compromisso (visita/retorno/lembrete) que JÁ VENCEU nos últimos dias e ainda não foi tratado.
// Serve pra destacar "compromissos atrasados" em vez de deixá-los se dissolverem em "Fazer agora".
// Retorna {dias, dataLabel} do vencido mais recente, ou null.
function cp786CompromissoAtrasado(l){
  if(typeof leadEhAtivo==='function' && !leadEhAtivo(l)) return null;
  if(typeof ehContatadoHoje==='function' && ehContatadoHoje(l)) return null;
  const JANELA=60; // mantém o compromisso vencido em destaque por um bom tempo, até ser atendido
  let melhor=null; // vencido mais RECENTE (diff negativo mais próximo de zero)
  const considerar=(diff,ts)=>{ if(diff==null||diff>=0||diff< -JANELA||!ts) return; if(!melhor||diff>melhor.diff) melhor={diff,ts}; };
  try{
    const lt=cp786DataTs(l?.analysis?.lembrete?.quando);
    if(lt){ const iso=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(lt)); considerar(typeof ui671DiasAte==='function'?ui671DiasAte(iso):null, lt); }
  }catch(_){}
  const apps=Array.isArray(l?.analysis?.confirmedAppointments)?l.analysis.confirmedAppointments:[];
  let dispensados=null; try{dispensados=typeof compromissosDispensados==='function'?compromissosDispensados():null;}catch(_){}
  for(const ap of apps){
    const data=String(ap?.data||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    const prova=String(ap?.trechoLiteral||ap?.quando||ap?.oQue||'').trim();
    if(!prova) continue;
    const key=String(l?.id||'')+'|'+String(ap?.oQue||'')+'|'+data;
    if(dispensados?.has?.(key)) continue;
    considerar(typeof ui671DiasAte==='function'?ui671DiasAte(data):null, cp786DataTs(data,'12:00'));
  }
  if(!melhor) return null;
  return { dias:Math.abs(melhor.diff), dataLabel:new Date(melhor.ts).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'}) };
}
window.cp786CompromissoAtrasado=cp786CompromissoAtrasado;
// v1011 — lista os compromissos VENCIDOS de um lead (mesmos critérios da contagem acima:
// data concreta no passado até 60 dias, com trecho literal de prova, não dispensado). Usada
// pela seção "Atrasados" da Agenda — o dono via "9 atrasados" no sino e não tinha ONDE ver quais.
function cpCompromissosVencidosDoLead(l){
  const out=[];
  const apps=Array.isArray(l?.analysis?.confirmedAppointments)?l.analysis.confirmedAppointments:[];
  let dispensados=null; try{dispensados=typeof compromissosDispensados==='function'?compromissosDispensados():null;}catch(_){}
  for(const ap of apps){
    const data=String(ap?.data||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    const prova=String(ap?.trechoLiteral||ap?.quando||ap?.oQue||'').trim();
    if(!prova) continue;
    const key=String(l?.id||'')+'|'+String(ap?.oQue||'')+'|'+data;
    if(dispensados?.has?.(key)) continue;
    const diff=typeof ui671DiasAte==='function'?ui671DiasAte(data):null;
    if(diff==null||diff>=0||diff< -60) continue;
    out.push({ key, oQue:String(ap?.oQue||'compromisso'), trecho:String(ap?.trechoLiteral||'').trim(), dias:Math.abs(diff), dataBR:new Date(cp786DataTs(data,'12:00')).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'}) });
  }
  out.sort((a,b)=>a.dias-b.dias);
  return out;
}
window.cpCompromissosVencidosDoLead=cpCompromissosVencidosDoLead;
function cp786CompararConducao(a,b){
  const ordem={respondeu:0,agora:1,programados:2,aguardando:3,'sem-acao':4};
  const ca=cp786Categoria(a),cb=cp786Categoria(b);
  const oa=ordem[ca]??9,ob=ordem[cb]??9;
  if(oa!==ob) return oa-ob;
  if(ca==='programados'){
    const d=cp786CompromissoOrdemTs(a)-cp786CompromissoOrdemTs(b);
    if(Number.isFinite(d)&&d!==0) return d;
  }
  try{
    const d=compararPrioridadeAtendimento(a,b);
    if(Number.isFinite(d)&&d!==0) return d;
  }catch(_){ }
  return String(a?.name||'').localeCompare(String(b?.name||''),'pt-BR');
}
function cp786OrdenarConducao(lista,metaPronto=null){
  const arr=Array.isArray(lista)?lista.slice():[];
  const ordem={respondeu:0,agora:1,programados:2,aguardando:3,'sem-acao':4};
  const meta=new Map();
  for(const l of arr){
    let score=Number(l?._score);
    if(!Number.isFinite(score)){try{score=scoreRankingHoje(l);}catch(_){score=0;}}
    const categoria=metaPronto?.get?.(l)?.categoria||cp786Categoria(l);
    // v916 (pedido do dono): dentro de "Aguardando cliente" a ordem é por quem VOCÊ atendeu
    // mais recentemente primeiro (quem acabou de ser atendido sobe pro topo) — não por chance
    // de venda. ultimoAtendimentoTs cobre atendimento manual, cópia de mensagem e observação.
    const atendimentoTs = categoria==='aguardando' && typeof ultimoAtendimentoTs==='function' ? ultimoAtendimentoTs(l) : 0;
    meta.set(l,{categoria,ordem:ordem[categoria]??9,score:Number.isFinite(score)?score:0,compromisso:categoria==='programados'?cp786CompromissoOrdemTs(l):Number.MAX_SAFE_INTEGER,atendimentoTs});
  }
  return arr.sort((a,b)=>{
    const ma=meta.get(a),mb=meta.get(b);
    if(ma.ordem!==mb.ordem) return ma.ordem-mb.ordem;
    if(ma.categoria==='programados'&&ma.compromisso!==mb.compromisso) return ma.compromisso-mb.compromisso;
    if(ma.categoria==='aguardando'&&ma.atendimentoTs!==mb.atendimentoTs) return mb.atendimentoTs-ma.atendimentoTs;
    if(ma.score!==mb.score) return mb.score-ma.score;
    return String(a?.name||'').localeCompare(String(b?.name||''),'pt-BR');
  });
}
function cp786TextoSemJargao(v){
  return String(v||'')
    .replace(/lead quente escondido/gi,'oportunidade com sinais fortes')
    .replace(/antes que esfrie/gi,'enquanto o interesse está ativo')
    .replace(/\besfriando\b/gi,'perdendo ritmo')
    .replace(/\breaquecer\b/gi,'retomar')
    .replace(/\bmuito quente\b/gi,'alta oportunidade')
    .replace(/\bem negocia[cç][aã]o\b/gi,'em decisão')
    .replace(/\bpipeline\b/gi,'condução')
    .replace(/\bfunil\b/gi,'jornada')
    .replace(/\s+/g,' ')
    .trim();
}
function cp786ResumoAcao(l,modelo=null){
  let descricao='';
  try{ descricao=String((modelo||cp786Modelo(l))?.acao?.descricao||''); }catch(_){ descricao=''; }
  const raw=cp786TextoSemJargao(descricao||l?.nextAction||l?.proximaAcao||(typeof motivoCurto==='function'?motivoCurto(l):'')||'Abrir atendimento para conferir.');
  return raw.length>78?raw.slice(0,75).trim()+'...':raw;
}
function cp786Badge(l,categoria=null){
  const c=categoria||cp786Categoria(l);
  return ({agora:'Fazer agora',respondeu:'Responder',programados:'Agenda',aguardando:'Aguardar','sem-acao':'Sem ação'})[c]||'Abrir';
}
function cp786Classe(l,categoria=null){
  const c=categoria||cp786Categoria(l);
  if(c==='agora'||c==='respondeu') return 'hot';
  if(c==='programados') return 'warm';
  if(c==='aguardando'||c==='sem-acao') return 'low';
  return 'normal';
}
function cp786MetaConducao(l){
  const modelo=cp786Modelo(l),ultima=cp786UltimaMensagemReal(l);
  const categoria=cp786Categoria(l,modelo,ultima);
  return {categoria,modelo,ultima,resumo:cp786ResumoAcao(l,modelo),badge:cp786Badge(l,categoria),classe:cp786Classe(l,categoria)};
}
function cp786PrecisaAcao(l){return cp786Categoria(l)==='agora';}
function cp786AguardandoCliente(l){return cp786Categoria(l)==='aguardando';}
window.cp786PrecisaAcao=cp786PrecisaAcao;
window.cp786ClienteRespondeu=cp786ClienteRespondeu;
window.cp786UltimoFoiCliente=cp786UltimoFoiCliente;
window.cp786TemCompromisso=cp786TemCompromisso;
window.cp786AguardandoCliente=cp786AguardandoCliente;
window.cp786Categoria=cp786Categoria;
window.cp786CategoriaLabel=cp786CategoriaLabel;
window.cp786CompararConducao=cp786CompararConducao;
window.cp786OrdenarConducao=cp786OrdenarConducao;
window.cp786MetaConducao=cp786MetaConducao;
window.cp786ResumoAcao=cp786ResumoAcao;
window.cp786Badge=cp786Badge;

// "Fazer agora" = a AÇÃO real do dia, não só "precisa responder AGORA". Numa carteira de
// imports antigos quase nada é resposta pendente (categoria 'agora'), então o card vivia em
// 0 e sem serventia. Agora conta também as RETOMADAS que valem hoje (entraEmRetomada: parado
// 5+ dias, lembrete vencido, compromisso pra hoje/amanhã, quente-fechar...). Fica de fora
// quem já foi atendido hoje e quem tem compromisso futuro (esse é da Agenda). É a MESMA base
// da saudação lá do topo, pra o número laranja e o card baterem.
function cpPrecisaAcaoHoje(l){ return cp786Categoria(l)==='agora'; } // "precisa de ação" = fila do Fazer agora
function abrirFazerAgora(){
  const ativos=(state.itemsAtivos||[]).filter(leadEhAtivo);
  const fila=cpFilaFazerAgora(ativos);
  // v924 — dose = meta do dia (10) menos quem já foi atendido hoje (cpFazerAgoraDose); "Atender
  // +1" revela mais um além da meta, por vez, enquanto o corretor quiser continuar no mesmo dia.
  const restante=cpFazerAgoraDose(ativos);
  const extra=Math.max(0, Number(state.fazerAgoraExtra||0));
  const mostrar=Math.min(fila.length, restante + extra);
  const dose=fila.slice(0, mostrar);
  const sub = cpFimDeSemana()
    ? `Hoje você não atende — a fila volta ${cpProximoDiaDeAtendimento()}.`
    : (dose.length ? `Os ${dose.length} que faltam pra bater a meta de hoje, por prioridade.` : 'Você já bateu a meta de hoje. Bom trabalho!');
  abrirGrupoHome('__fazeragora',{meta:{titulo:'Fazer agora',sub},leads:dose});
  // Botão "Atender +1": revela mais um lead além da meta, enquanto quiser atender no mesmo dia.
  if(fila.length > mostrar){
    const foco=qs('#leadFocoArea');
    if(foco){
      const b=document.createElement('button');
      b.type='button'; b.className='cp-atender-mais';
      b.textContent='Atender +1';
      b.onclick=()=>{ state.fazerAgoraExtra=extra+1; abrirFazerAgora(); };
      foco.appendChild(b);
    }
  }
}
window.cpPrecisaAcaoHoje=cpPrecisaAcaoHoje;
window.abrirFazerAgora=abrirFazerAgora;

// v1075 — a tela "Condução" foi DELETADA (pedido do dono: repetia o painel/listas da Home).
// Estas listas, no padrão dos grupos da Home, são as substitutas oficiais dos cards.
function abrirAguardandoCliente(){
  const ativos=(state.itemsAtivos||state.todosLeads||[]).filter(leadEhAtivo);
  const leads=cp786OrdenarConducao(ativos.filter(l=>cp786Categoria(l)==='aguardando'));
  abrirGrupoHome('__aguardando',{meta:{titulo:'Aguardando cliente',sub:'A bola está com o cliente — não cobre antes da hora.'},leads});
}
window.abrirAguardandoCliente=abrirAguardandoCliente;
function abrirCarteiraAtiva(){
  const ativos=(state.itemsAtivos||state.todosLeads||[]).filter(leadEhAtivo);
  const leads=cp786OrdenarConducao(ativos);
  const estiloAcao='background:transparent;border:1px solid var(--line);border-radius:999px;padding:5px 12px;color:var(--soft);font-size:12px;font-weight:950;cursor:pointer';
  abrirGrupoHome('__carteiraAtiva',{
    meta:{titulo:'Carteira ativa',sub:'Todos os seus clientes ativos.'},
    leads,
    acoesHtml:`<button type="button" onclick="imprimirCarteiraAtiva()" style="${estiloAcao}">🖨️ Imprimir</button><button type="button" onclick="exportarLeadsCSV(this)" style="${estiloAcao}">⬇ Excel</button>`
  });
}
window.abrirCarteiraAtiva=abrirCarteiraAtiva;

renderResumoDia = function(items){
  const box = qs("#resumoDia");
  if(!box) return;
  if(!items?.length){ box.style.display="none"; box.innerHTML=""; return; }
  const ativos=items.filter(leadEhAtivo);
  // "Fazer agora" = a DOSE do dia (top CP_DOSE_DIA da fila ranqueada), não o backlog inteiro —
  // era o 207 que travava. Agenda = compromisso marcado. Aguardando = bola legitimamente com o
  // cliente (ou lead cru). O backlog além da dose fica acessível na lista do "Fazer agora".
  const fds=cpFimDeSemana();
  // v1084 — o card mostrava a meta restante do dia mesmo quando NÃO havia tanta gente elegível:
  // aparecia "10", a saudação logo acima dizia "Tudo em dia!" e o toque abria uma lista vazia —
  // três respostas diferentes na mesma tela. Limita pelo tamanho real da fila, igual à saudação.
  const filaAgoraLen=(typeof cpFilaFazerAgora==='function')?cpFilaFazerAgora(ativos).length:0;
  const fazerAgora=Math.max(0,Math.min(cpFazerAgoraDose(ativos),filaAgoraLen));
  // v1091 — o card mostrava "Final de semana" no lugar do número, quebrando o alinhamento com os
  // outros cards e repetindo o aviso da saudação. Em dia sem fila ele mostra 0, que é a verdade.
  const faB=`<b>${fds?0:fazerAgora}</b>`;
  const compromissos=cpAgendaContagem(ativos);
  const aguardando=ativos.filter(l=>cp786Categoria(l)==='aguardando').length;
  const totalLeads=ativos.length;
  // v1071 — pedido do dono: quantos leads estão sem atender há 30 dias ou mais (prazo fixo,
  // separado do "descanso" configurável do Cérebro — ver cpSemAtenderHaDias).
  const semAtender30=cpContarSemAtender(ativos, 30);
  box.style.display="grid";
  box.innerHTML = `
    <div class="ui-kpi${fazerAgora>0?' active':''}" onclick="abrirFazerAgora()"><span>Fazer agora</span><div>${faB}<i>${ui631Icon('resposta')}</i></div></div>
    <div class="ui-kpi" onclick="abrirCarteiraAtiva()"><span>Total de leads</span><div><b>${totalLeads}</b><i>${ui631Icon('ativos')}</i></div></div>
    <div class="ui-kpi" onclick="show('agenda')"><span>Agenda</span><div><b>${compromissos}</b><i>${ui631Icon('compromisso')}</i></div></div>
    <div class="ui-kpi" onclick="abrirAguardandoCliente()"><span>Aguardando cliente</span><div><b>${aguardando}</b><i>${ui631Icon('ativos')}</i></div></div>
    <div class="ui-kpi" onclick="cpAbrirSemAtender30Dias()" title="Nunca atendido ou sem atendimento há 30 dias ou mais"><span>Sem atender 30d+</span><div><b>${semAtender30}</b><i>${ui631Icon('reaquecer')}</i></div></div>`;
};

function ui631LeadMotivo(l){
  const mc=cp786Modelo(l), acao=cp786TextoSemJargao(mc?.acao?.descricao||l?.nextAction||'');
  const d=Number(l?.daysSinceLastInteraction||0);
  if(acao) return [acao.length>72?acao.slice(0,69).trim()+'...':acao,''];
  if(cp786Categoria(l)==='programados') return ['Compromisso na agenda','Acompanhar na data certa'];
  if(cp786Categoria(l)==='aguardando') return ['Aguardando o cliente','Não cobrar novamente agora'];
  if(d>=7) return [`Último contato há ${d} dias`,'Bom momento para retomar'];
  return ['Próxima ação pendente','Abrir diagnóstico antes de responder'];
}
function ui631LeadStatus(l){
  const c=cp786Categoria(l);
  return [cp786CategoriaLabel(c),c==='agora'||c==='respondeu'?'hot':c==='programados'?'warm':'neutral'];
}

function ui631LeadRow(l, actionLabel, tone){
  const id=JSON.stringify(String(l.id||''));
  const dias=l.daysSinceLastInteraction!=null?`${l.daysSinceLastInteraction}d`:(l.lastInteractionAt?formatarTempoRelativo(l.lastInteractionAt).replace(/ atrás$/,''):'');
  const sub=produtosLabel(l)||'Produto não identificado';
  const label=actionLabel||cp786Badge(l);
  const subLine=[sub,dias].filter(Boolean).join(' · ');
  const [motivo]=ui631LeadMotivo(l);
  return `<button type="button" class="ui-priority-row" onclick='abrirLead(${id})'>
    <span class="ui-row-copy"><strong>${escapeHtml(l.name||'Cliente')}</strong><small>${escapeHtml(subLine)}</small>${motivo?`<em class="ui-row-motivo">${escapeHtml(motivo)}</em>`:''}</span>
    <span class="ui-row-action${tone?' '+tone:''}">${escapeHtml(label)}</span><span class="ui-row-chevron">›</span>
  </button>`;
}

renderListasHome = function(ordenados){
  const foco=qs('#leadFocoArea'); if(!foco) return;
  const area=qs('#top3Area'); if(area){area.style.display='none';area.innerHTML='';}
  const fila=qs('#filaPrioridade'); if(fila){fila.style.display='none';fila.innerHTML='';}
  const ativos=(ordenados||[]).filter(leadEhAtivo);
  const categorias=new Map(ativos.map(l=>[l,cp786Categoria(l)]));
  const categoriaDe=l=>categorias.get(l)||cp786Categoria(l);
  const respondeu=cp786OrdenarConducao(ativos.filter(l=>categoriaDe(l)==='respondeu'));
  const agora=cp786OrdenarConducao(ativos.filter(l=>categoriaDe(l)==='agora'));
  const programados=cp786OrdenarConducao(ativos.filter(l=>categoriaDe(l)==='programados'));
  const aguardando=cp786OrdenarConducao(ativos.filter(l=>categoriaDe(l)==='aguardando'));
  const prioritarios=[...respondeu,...agora].filter((x,i,a)=>a.findIndex(y=>String(y.id)===String(x.id))===i).slice(0,4);
  // Hotfix #807: este renderer intermediário também pode ser chamado durante a carga inicial.
  // Sem esta variável, a interpolação do botão "Ver todos" lançava ReferenceError e deixava
  // a Home presa no skeleton, embora os contadores já tivessem sido carregados.
  const filtroPrincipal=agora.length?'agora':programados.length?'programados':'aguardando';
  // As novas visões orientadas à ação são a fonte principal. Mantemos aliases internos
  // usados por rotinas antigas (voltar, histórico e atalhos) para não quebrar navegação.
  const acaoHoje=[...respondeu,...agora].filter((x,i,a)=>a.findIndex(y=>String(y.id)===String(x.id))===i);
  state.gruposHome={
    respondeu,agora,programados,aguardando,todos:ativos,
    hoje:acaoHoje,
    retomada:agora,
    "acao-hoje":acaoHoje,
    "retomar-cuidado":[],
    "boa-sem-urgencia":[],
    "pode-aguardar":aguardando,
    "baixa-prioridade":[],
    "tratado-hoje":ativos.filter(l=>typeof ehContatadoHoje==='function'&&ehContatadoHoje(l))
  };
  if(state.grupoAtivo || state.focoLeadId || state.lead?.id) return;
  foco.innerHTML=`
    <div class="ui-home-content">
      ${ui677ToolbarHTML('home')}
      <section class="ui-priority-card">
        <div class="ui-section-head"><div><h3>Atendimentos prioritários para hoje</h3><p>O Corretor Pro colocou primeiro quem precisa de você agora.</p></div><button type="button" onclick="abrirFazerAgora()">Ver todos</button></div>
        <div class="ui-priority-list">${prioritarios.length?prioritarios.map((l,i)=>ui631LeadRow(l,cp786Badge(l),i)).join(''):'<div class="empty">Nenhuma ação imediata agora.</div>'}</div>
      </section>
    </div>`;
};


function ui631UltimoFalante(lead){
  const msgs=Array.isArray(lead.recentMessages)?lead.recentMessages:[];
  const pn=String(lead.name||"").toLowerCase().split(/\s+/)[0]||"";
  for(let i=msgs.length-1;i>=0;i--){if(!msgs[i]||!String(msgs[i].text||"").trim())continue;return ehMsgDoCliente(msgs[i],pn)?"cliente":"você";}
  return "—";
}

// Atualização #724-2: o cabeçalho e os indicadores pertencem à tela Hoje, não ao detalhe do lead.
// O uso de estilo inline com prioridade evita que um refresh do dashboard os faça reaparecer.
function ui667ModoDetalheLead(ativo){
  document.body.classList.toggle("lead-foco-aberto", !!ativo);
  const alvos=[qs("#home .home-page-heading"),qs("#resumoDia"),qs("#top3Area"),qs("#filaPrioridade"),qs("#homeRight")].filter(Boolean);
  for(const el of alvos){
    if(ativo) el.style.setProperty("display","none","important");
    else el.style.removeProperty("display");
  }
}
window.ui667ModoDetalheLead=ui667ModoDetalheLead;

function ui667AplicarAtendidoLocal(lead, quando, dataBR, horaBR, detalhes = {tipo:"Atendido",de:"botao_atendido"}){
  if(!lead) return;
  lead.analysis=lead.analysis||{};
  lead.analysis.aprendizado=lead.analysis.aprendizado||{};
  const eventos=Array.isArray(lead.analysis.aprendizado.eventos)?lead.analysis.aprendizado.eventos:[];
  if(!eventos.some(e=>e?.evento==="contato_manual"&&e?.detalhes?.de===detalhes.de&&e?.quando===quando)){
    eventos.push({evento:"contato_manual",estilo:null,detalhes,quando});
  }
  lead.analysis.aprendizado.eventos=eventos;
  lead.lastAttendanceAt=quando;
  lead.ultimoAtendimentoEm=quando;
  lead.lastAttendanceText=`${dataBR} ${horaBR}`;
}

// O fetch de "recarregar a carteira" disparado logo após marcar/desmarcar pode responder com
// uma versão do banco de ALGUNS INSTANTES ATRÁS (mesmo caso já tratado em recarregarLeadFoco
// pro state.lead) — e como ele SUBSTITUI state.todosLeads/state.leads por objetos novos, isso
// apagava a marcação que tínhamos acabado de aplicar localmente. Sem isso, ao clicar Voltar
// rápido demais, a Home voltava a mostrar o lead como "não atendido" em Fazer agora/Oportunidades
// esquecidas — o clique tinha funcionado, só o card ficava desatualizado até um F5.
function ui667ReconciliarAtendimentoLocal(leadId, aplicarFn){
  for(const lista of [state.itemsAtivos, state.todosLeads, state.leads]){
    const item = Array.isArray(lista) ? lista.find(x => String(x.id) === String(leadId)) : null;
    if(item) aplicarFn(item);
  }
  // Se a Home já está na tela (o corretor pode ter voltado antes do fetch responder), recalcula
  // as listas com o dado corrigido em vez de esperar o próximo carregarDashboard.
  if(state.active === 'home' && !state.lead?.id && !state.grupoAtivo &&
     Array.isArray(state.itemsAtivos) && state.itemsAtivos.length &&
     typeof renderListasHome === 'function' && typeof scoreRankingHoje === 'function'){
    const ordenados = state.itemsAtivos.map(l => ({ ...l, _score: scoreRankingHoje(l) })).sort(compararPrioridadeAtendimento);
    renderListasHome(ordenados);
    if(typeof renderBotoesHome === 'function') renderBotoesHome();
  }
}

window.ui667MarcarAtendido=async function(btn){
  const lead=state.lead;
  if(!lead?.id){toast("Não consegui identificar este lead.");return;}
  if(btn){btn.disabled=true;btn.classList.add('cp704-ico-loading');}
  const registrarAtendido=async()=>{
    const res=await fetchComTimeout("./api/reanalisar-lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payloadComCerebro({id:lead.id,action:"marcar-atendido"}))},30000);
    const d=await res.json().catch(()=>({}));
    if(!res.ok||!d?.ok) throw new Error(d?.error||"falha ao registrar");
    return d;
  };
  try{
    // v1079 — mesmo cenário do v1034/v1036 (rede "pendurada" reconectando ao voltar do
    // WhatsApp): sem repetir a tentativa, o corretor via o erro técnico cru do AbortController
    // ("signal is aborted without reason") já na primeira instabilidade e achava que o
    // atendimento não tinha sido marcado. Repete até 3x com pausa curta antes de desistir.
    const TENTATIVAS=3;
    let d=null, ultimoErro=null;
    for(let tentativa=1; tentativa<=TENTATIVAS && !d; tentativa++){
      try{ d=await registrarAtendido(); }
      catch(err){ ultimoErro=err; if(tentativa<TENTATIVAS){ toast(`Rede instável, tentando marcar de novo (tentativa ${tentativa+1} de ${TENTATIVAS})…`); await new Promise(r=>setTimeout(r,1500)); } }
    }
    if(!d) throw ultimoErro||new Error("Não foi possível marcar o atendimento.");
    const quando=d.quando||new Date().toISOString();
    const agoraFmt=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,hourCycle:"h23"}).formatToParts(new Date(quando)).reduce((o,p)=>(p.type!=="literal"&&(o[p.type]=p.value),o),{});
    const dataLocal=d.dataBR||`${agoraFmt.day}/${agoraFmt.month}/${agoraFmt.year}`;
    const horaLocal=d.horaBR||`${agoraFmt.hour}:${agoraFmt.minute}`;
    ui667AplicarAtendidoLocal(lead,quando,dataLocal,horaLocal);
    for(const lista of [state.itemsAtivos,state.todosLeads,state.leads]){
      const item=Array.isArray(lista)?lista.find(x=>String(x.id)===String(lead.id)):null;
      if(item&&item!==lead) ui667AplicarAtendidoLocal(item,quando,dataLocal,horaLocal);
    }
    if(btn){btn.disabled=true;} // renderLeadFoco reconstrói a toolbar com o ícone "Atendido"
    state.analysis=lead.analysis||null;
    renderLeadFoco(lead);
    invalidarLeadsCache();
    carregarAgendaTopo?.();
    loadRecentLeads(false).then(() => ui667ReconciliarAtendimentoLocal(lead.id, item => ui667AplicarAtendidoLocal(item, quando, dataLocal, horaLocal)));
    recarregarLeadFoco(lead.id);
    toast(d.atualizado?`Atendimento atualizado às ${horaLocal}.`:`Atendimento marcado às ${horaLocal}.`);
  }catch(err){
    if(btn){btn.disabled=false;btn.classList.remove('cp704-ico-loading');}
    toast("Não consegui marcar: "+userFriendlyError(err));
  }
};

// Desfaz localmente o "Atendido hoje" (espelha a API): remove TODO contato_manual do dia e
// recalcula o último atendimento pelo que sobrou.
function ui667RemoverAtendidoLocal(lead){
  const evs=lead?.analysis?.aprendizado?.eventos;
  if(!Array.isArray(evs)) return;
  const hojeBR=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
  // Remove TODO contato_manual de HOJE (não só o do botão): senão o "Atendido hoje" continua
  // ligado por outro contato do dia e o botão não volta pra "Marcar atendimento".
  lead.analysis.aprendizado.eventos=evs.filter(e=>{
    if(e?.evento!=='contato_manual'||!e?.quando) return true;
    const iso=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(e.quando));
    return iso!==hojeBR;
  });
  const ts=(typeof ultimoAtendimentoTs==='function')?ultimoAtendimentoTs(lead):0;
  lead.lastAttendanceAt=ts?new Date(ts).toISOString():null;
  lead.ultimoAtendimentoEm=lead.lastAttendanceAt;
}
window.ui667DesmarcarAtendido=async function(btn){
  const lead=state.lead;
  if(!lead?.id){toast("Não consegui identificar este lead.");return;}
  // OTIMISTA: desmarca na tela na hora (não faz o corretor esperar a rede). Se a API falhar,
  // reverte. O timeout é generoso (30s) porque a função serverless pode ter cold start.
  const snapshot=Array.isArray(lead.analysis?.aprendizado?.eventos)
    ? lead.analysis.aprendizado.eventos.map(e=>({...e})) : null;
  ui667RemoverAtendidoLocal(lead);
  for(const lista of [state.itemsAtivos,state.todosLeads,state.leads]){
    const item=Array.isArray(lista)?lista.find(x=>String(x.id)===String(lead.id)):null;
    if(item&&item!==lead) ui667RemoverAtendidoLocal(item);
  }
  state.analysis=lead.analysis||null;
  renderLeadFoco(lead);
  try{
    const res=await fetchComTimeout("./api/reanalisar-lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payloadComCerebro({id:lead.id,action:"desmarcar-atendido"}))},30000);
    const d=await res.json().catch(()=>({}));
    if(!res.ok||!d?.ok) throw new Error(d?.error||"falha ao desmarcar");
    invalidarLeadsCache();
    carregarAgendaTopo?.();
    loadRecentLeads(false).then(() => ui667ReconciliarAtendimentoLocal(lead.id, item => ui667RemoverAtendidoLocal(item)));
    toast("Atendimento de hoje desmarcado.");
  }catch(err){
    // Reverte a tela: não deu pra salvar no servidor.
    if(snapshot && lead.analysis?.aprendizado){ lead.analysis.aprendizado.eventos=snapshot; }
    const ts=(typeof ultimoAtendimentoTs==='function')?ultimoAtendimentoTs(lead):0;
    lead.lastAttendanceAt=ts?new Date(ts).toISOString():null; lead.ultimoAtendimentoEm=lead.lastAttendanceAt;
    renderLeadFoco(lead);
    toast("Não consegui desmarcar agora — tente de novo.");
  }
};
// Atualização #724-2: wrapper antigo de renderLeadFoco removido.

/* ============================================================
   ATUALIZAÇÃO #668 — NAVEGAÇÃO ANDROID + CONTADORES CONSISTENTES
   - seta física volta lead → origem → Hoje antes de fechar o PWA
   - Home, Atendimentos e Pipeline usam a mesma regra de Quentes
   - Ativos exclui Geladeira em todas as telas
   ============================================================ */

configurarEscolhaTema();
// v1016 — este placeholder escrevia "Bom dia, corretor!" (nome genérico) no instante em que a
// página abre, antes de saber o nome de verdade — o corretor via um nome errado piscando na tela
// por um instante a cada troca de conta/carregamento. Removido: o título fica no "Hoje" estático
// do HTML até renderSaudacao() trocar pelo nome de verdade (já roda assim que os dados chegam,
// inclusive em contas com zero leads, desde a v1014).
async function iniciarDireciona(){
  // Share Target vem antes da Home. Enquanto existe um ZIP pendente, nenhuma rotina
  // inicial pode trocar a tela nem disparar recarga automática.
  const compartilhado = await checkShared().catch(() => ({ handled:false }));
  if(compartilhado?.handled || window.__cpShareImportActive || state?.pendingSharedRecordId) return;
  // v1026 — pedido explícito e repetido do dono: atualizar a página (F5/Ctrl+Shift+R, ou o
  // Android recarregando o PWA sozinho) NUNCA pode abrir outra coisa além da Home. Isto aqui
  // ANTES reabria um lead salvo em history.state de propósito (pra sobreviver a uma troca de
  // versão/service worker no meio do atendimento) — mas na prática isso reabria sozinho leads
  // já atendidos há muito tempo em qualquer refresh comum, o que o dono relatou como o próprio
  // bug. A Home é sempre o destino; qualquer rota antiga (de outra tela/lead) some do
  // history.state pra não sobreviver a um novo refresh.
  if(history.state?.cpApp && history.state?.screen !== "home"){
    try{ history.replaceState({ cpApp:true, screen:"home" }, "", location.href); }catch(_){}
  }
  carregarDashboard();
  carregarAgendaTopo();
  garantirRestauracaoLeadsAntigos().catch(()=>{});
  try{
    const data = await getLeadsData(false);
    if(data?.ok && Array.isArray(data.items)){
      state.todosLeads = data.items;
      state.leads = data.items.slice(0,8);
    }
  }catch(err){ console.warn("iniciarDireciona", err); }
}
requestAnimationFrame(iniciarDireciona);

// Sincronização entre aparelhos: consulta o banco a cada 30 s quando a Home está visível.
// A chamada força leitura nova; o cache local continua servindo só para navegação imediata.
setInterval(() => {
  // v818: não atualizar a Home enquanto um lead está aberto. O detalhe do lead é
  // renderizado DENTRO da Home (#leadFocoArea), então state.active continua "home".
  // Sem esta trava, o refresh reescrevia a área e jogava o corretor de volta pra lista.
  if(state.active === "home" && document.visibilityState === "visible" && !state.focoLeadId && !state.lead?.id){
    invalidarLeadsCache();
    loadRecentLeads(true);
    carregarDashboard(true);
    carregarAgendaTopo();
  }
}, 30 * 1000);
// Refresh quando a aba volta a ficar visível (depois de mudar pra outra aba)
let __lastVisibleRefresh = 0;
document.addEventListener("visibilitychange", () => {
  // v818: mesma trava do interval — não refazer a Home com um lead aberto.
  if(document.visibilityState === "visible" && state.active === "home" && !state.focoLeadId && !state.lead?.id){
    const agora = Date.now();
    if(agora - __lastVisibleRefresh < 5000) return;
    __lastVisibleRefresh = agora;
    setTimeout(() => {
      invalidarLeadsCache();
      loadRecentLeads(true);
      carregarDashboard(true);
      carregarAgendaTopo();
    }, 250);
  }
});


/* =============================================================
   ATUALIZAÇÃO #660 — DASHBOARD CORRETOR PRO / OPÇÃO A
   Estrutura visual definitiva, alimentada pelos dados reais.
   ============================================================= */
function cpEscape(v){ return escapeHtml(String(v == null ? "" : v)); }
function cpInitials(name){ return String(name||"C").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase() || "C"; }
function cpPriorityMeta(lead){
  const categoria=typeof cp786Categoria==='function'?cp786Categoria(lead):'';
  if(categoria==='respondeu') return {label:'Responder',cls:'hot',cor:'var(--cp-coral)'};
  if(categoria==='agora') return {label:'Fazer agora',cls:'hot',cor:'var(--cp-coral)'};
  if(categoria==='programados') return {label:'Agenda',cls:'warm',cor:'var(--cp-blue)'};
  if(categoria==='aguardando') return {label:'Aguardar',cls:'cold',cor:'var(--cp-slate)'};
  return {label:'Sem ação',cls:'cold',cor:'var(--cp-slate)'};
}
function cpHasAppointment(lead){
  const aps=lead?.analysis?.confirmedAppointments;
  return (Array.isArray(aps)&&aps.length>0) || !!lead?.analysis?.lembrete?.quando;
}
function cpAppointmentData(lead){
  const apps=Array.isArray(lead?.analysis?.confirmedAppointments)?lead.analysis.confirmedAppointments:[];
  const hoje=typeof ui671HojeIso==='function'?ui671HojeIso():new Date().toISOString().slice(0,10);
  const validos=apps.map(ap=>{
    const data=String(ap?.data||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
    const diff=typeof ui671DiasAte==='function'?ui671DiasAte(data):null;
    if(diff==null||diff<0) return null;
    const hora=String(ap?.hora||ap?.quando||ap?.dataHora||'').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const hh=hora?String(hora[1]).padStart(2,'0'):'12',mm=hora?hora[2]:'00';
    const ts=cp786DataTs(data,`${hh}:${mm}`);
    return {ap,data,diff,ts,hora:hora?`${hh}:${mm}`:''};
  }).filter(Boolean).sort((a,b)=>a.ts-b.ts);
  const escolhido=validos[0]||null;
  const lembreteRaw=lead?.analysis?.lembrete?.quando||'';
  const lembreteTs=cp786DataTs(lembreteRaw);
  const usarLembrete=!escolhido&&lembreteTs>Date.now();
  let time='Hoje',text='';
  if(escolhido){
    const prefixo=escolhido.diff===0?'Hoje':escolhido.diff===1?'Amanhã':new Date(`${escolhido.data}T12:00:00-03:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    time=[prefixo,escolhido.hora].filter(Boolean).join(' · ');
    text=[escolhido.ap?.oQue||escolhido.ap?.tipo||'',produtosLabel(lead)||''].filter(Boolean).join(' · ');
  }else if(usarLembrete){
    const d=new Date(lembreteTs), hojeIso=hoje;
    const dataIso=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
    const diff=typeof ui671DiasAte==='function'?ui671DiasAte(dataIso):null;
    const prefixo=diff===0?'Hoje':diff===1?'Amanhã':d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    time=`${prefixo} · ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
    text=[lead?.analysis?.lembrete?.motivo||'Lembrete',produtosLabel(lead)||''].filter(Boolean).join(' · ');
  }
  return {time,text:text||'Compromisso',sortTs:escolhido?.ts||lembreteTs||Number.MAX_SAFE_INTEGER};
}
function cpDaysText(lead){ const d=Number(lead?.daysSinceLastInteraction); if(Number.isFinite(d)) return d<=0?"Hoje":d===1?"Há 1 dia":`Há ${d} dias`; return "—"; }
function cpNextAction(lead){
  const acao=typeof cp786ResumoAcao==='function'?cp786ResumoAcao(lead):'';
  return String(acao||'Abrir atendimento para conferir.').replace(/\s+/g,' ').slice(0,62);
}
function cpSetText(id,val){ const el=qs("#"+id); if(el) el.textContent=val; }
function cpPct(n,total){ return total>0?Math.round((n/total)*100):0; }
function cpOpenLead(id){ if(id) abrirLead(String(id)); }
function cpAvatarStyle(name){
  let h=0; for(const c of String(name||"")) h=(h*31+c.charCodeAt(0))>>>0;
  const palette=["#315766","#3B5F6A","#4B586E","#586655"];
  return `background:${palette[h%palette.length]};`;
}

// v929 — Desempenho: atividade real do corretor + resultado com clientes, no lugar da grade
// que só repetia "Clientes ativos"/"Fazer agora" já mostrados na Home (pedido do dono: "não
// pode ser a mesma coisa que atendimentos, senão não tem coerência").
// v984 — janela trocada de "últimos 7 dias corridos" pra "mês corrente" (dia 1 até hoje,
// fuso de Brasília): pedido do dono, que revisa o Desempenho uma vez por mês, não por dia —
// com 7 dias rolando o recorte muda todo dia e o total nunca bate com o que ele fez no mês.
function cpInicioMesMs(){
  const hojeIso = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date());
  return new Date(`${hojeIso.slice(0,7)}-01T00:00:00-03:00`).getTime();
}
window.cpInicioMesMs = cpInicioMesMs;
function cpDesempenhoMetricas(items, all){
  const ativos = Array.isArray(items) ? items : [];
  const todos = Array.isArray(all) ? all : ativos;
  const cutoffPeriodo = typeof cpInicioMesMs === "function" ? cpInicioMesMs() : (Date.now() - 30*24*60*60*1000);

  let mensagensTrocadas = 0, mensagensCopiadas = 0;
  const leadsAtendidosIds = new Set();
  const propostas = [];
  for(const l of todos){
    const msgs = Array.isArray(l?.recentMessages) ? l.recentMessages : [];
    for(const m of msgs){
      const t = Date.parse(m?.iso || "");
      if(Number.isFinite(t) && t >= cutoffPeriodo) mensagensTrocadas++;
      if(m?.type === "proposta") propostas.push({ lead:l, ts: Number.isFinite(t)?t:0 });
    }
    const eventos = l?.analysis?.aprendizado?.eventos || [];
    let atendeuNaJanela = false;
    for(const e of eventos){
      const t = Date.parse(e?.quando || "");
      if(!Number.isFinite(t) || t < cutoffPeriodo) continue;
      if(e.evento === "contato_manual") atendeuNaJanela = true;
      if(e.evento === "mensagem_copiada") mensagensCopiadas++;
    }
    if(atendeuNaJanela) leadsAtendidosIds.add(String(l.id));
  }

  // Empreendimentos negociados: agrupa a carteira ATIVA pelo mesmo rótulo de produto que já
  // aparece em cada lead — do maior pro menor.
  const porProduto = new Map();
  for(const l of ativos){
    const label = (typeof produtosLabel === "function" ? produtosLabel(l) : "") || "";
    if(!label || /n[ãa]o identificad/i.test(label)) continue;
    porProduto.set(label, (porProduto.get(label)||0) + 1);
  }
  const empreendimentos = [...porProduto.entries()].sort((a,b)=>b[1]-a[1]);

  return {
    tempoHojeSeg: typeof cpTempoAppSegundosHoje === "function" ? cpTempoAppSegundosHoje() : 0,
    tempoMedia7dSeg: typeof cpTempoAppMediaSegundos7d === "function" ? cpTempoAppMediaSegundos7d() : 0,
    mensagensTrocadas,
    empreendimentos,
    leadsAtendidos: leadsAtendidosIds.size,
    mensagensCopiadas,
    analisesFeitas: typeof cpContarAtividade === "function" ? cpContarAtividade("analise", cutoffPeriodo) : 0,
    importacoes: typeof cpContarAtividade === "function" ? cpContarAtividade("importacao", cutoffPeriodo) : 0,
    propostas: propostas.sort((a,b)=>b.ts-a.ts),
  };
}
window.cpDesempenhoMetricas = cpDesempenhoMetricas;

const CP_MET_ICONS = {
  tempo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.6 8.6 0 0 1-3.9-1L4 20l1.2-4a8.4 8.4 0 0 1-1.1-4.2A8.4 8.4 0 0 1 12.6 3a8.4 8.4 0 0 1 8.4 8.5z"/></svg>',
  leads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7a7 7 0 0 0-12-3L5 7"/><path d="M5 3v4h4M4 17a7 7 0 0 0 12 3l3-3"/><path d="M19 21v-4h-4"/></svg>',
  copiar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="3" width="10" height="14" rx="2"/><path d="M4 8v11a2 2 0 0 0 2 2h9"/></svg>',
  analise: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a4 4 0 0 0-4 4v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5v0a4 4 0 0 0 4 3"/><path d="M12 3a4 4 0 0 1 4 4v1a3 3 0 0 1 2 5 3 3 0 0 1-2 5v0a4 4 0 0 1-4 3"/><path d="M12 3v17"/></svg>',
  importar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
  proposta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v5h5"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="M9 13h6M9 17h4"/></svg>',
};
function cpRenderDesempenhoMetricas(items, all){
  const box = qs("#cpMetricasSemana");
  if(!box) return;
  const m = cpDesempenhoMetricas(items, all);
  const linha = (icone, cor, titulo, sub, valor) => `
    <div class="cp-met-row">
      <div class="cp-met-ic" style="background:color-mix(in srgb, ${cor} 18%, transparent);color:${cor}">${icone}</div>
      <div class="cp-met-copy"><b>${escapeHtml(titulo)}</b><small>${escapeHtml(sub)}</small></div>
      <div class="cp-met-num">${escapeHtml(String(valor))}</div>
    </div>`;
  const rows = [
    linha(CP_MET_ICONS.tempo, "var(--timing)", "Tempo no app", `Hoje · média de ${cpFormatarDuracao(m.tempoMedia7dSeg)} nos últimos 7 dias`, cpFormatarDuracao(m.tempoHojeSeg)),
    linha(CP_MET_ICONS.msg, "var(--dados)", "Mensagens trocadas", "Com clientes, este mês", m.mensagensTrocadas),
    linha(CP_MET_ICONS.leads, "var(--acao)", "Leads atendidos", "Este mês", m.leadsAtendidos),
    linha(CP_MET_ICONS.copiar, "var(--morno)", "Mensagens copiadas", "Sugestões da IA que você usou", m.mensagensCopiadas),
    linha(CP_MET_ICONS.analise, "var(--cerebro)", "Análises feitas", "Conversas processadas pela IA", m.analisesFeitas),
    linha(CP_MET_ICONS.importar, "var(--dados)", "Importações", "ZIPs de conversa processados", m.importacoes),
  ].join("");
  const propostasRow = `
    <button type="button" class="cp-met-row cp-met-row-btn" onclick="cpAbrirHistoricoPropostas()">
      <div class="cp-met-ic" style="background:color-mix(in srgb, var(--accent) 18%, transparent);color:var(--accent)">${CP_MET_ICONS.proposta}</div>
      <div class="cp-met-copy"><b>Propostas feitas</b><small>Ver histórico completo</small></div>
      <div class="cp-met-num">${m.propostas.length}</div>
    </button>`;
  const tagsHtml = m.empreendimentos.length
    ? m.empreendimentos.slice(0,3).map(([nome,n]) => `<span class="cp-met-tag">${escapeHtml(nome)} <b>${n}</b></span>`).join("")
      + (m.empreendimentos.length > 3 ? `<span class="cp-met-tag">+${m.empreendimentos.length-3}</span>` : "")
    : `<span class="cp-met-tag" style="opacity:.6">Nenhum ainda</span>`;
  box.innerHTML = rows + propostasRow + `
    <div class="cp-met-tags-row">
      <small>Empreendimentos negociados</small>
      <div class="cp-met-taglist">${tagsHtml}</div>
    </div>`;
}
window.cpRenderDesempenhoMetricas = cpRenderDesempenhoMetricas;

// "Ver histórico" de propostas: reusa a lista avulsa (mesmo mecanismo do "Fazer agora") pra
// mostrar os leads com proposta registrada, mais recente primeiro — abrir o lead mostra a
// proposta completa na linha do tempo dele.
function cpAbrirHistoricoPropostas(){
  const items = state.itemsAtivos || [];
  const all = state.todosLeads || items;
  const m = cpDesempenhoMetricas(items, all);
  if(!m.propostas.length){ toast("Nenhuma proposta registrada ainda."); return; }
  const porLead = new Map();
  for(const p of m.propostas){ const id = String(p.lead?.id||""); if(id && !porLead.has(id)) porLead.set(id, p.lead); }
  const leads = [...porLead.values()];
  const sub = `${m.propostas.length} proposta${m.propostas.length>1?"s":""} registrada${m.propostas.length>1?"s":""} — abra o lead pra ver os detalhes.`;
  abrirGrupoHome("__propostas", { meta:{ titulo:"Propostas feitas", sub }, leads });
}
window.cpAbrirHistoricoPropostas = cpAbrirHistoricoPropostas;

function renderCorretorProDashboard(items, all){
  items=Array.isArray(items)?items:[]; all=Array.isArray(all)?all:items;
  const root=qs("#cpDashboard"); if(!root) return;
  const now=new Date();
  const dateEl=qs("#cpDashboardDate");
  if(dateEl){
    const txt=now.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});
    dateEl.textContent=txt.charAt(0).toLowerCase()+txt.slice(1);
  }

  const categorias786=new Map(items.map(l=>[l,cp786Categoria(l)]));
  const categoriaDe=l=>categorias786.get(l)||cp786Categoria(l);
  cpRenderDesempenhoMetricas(items, all);

  const ordered=cp786OrdenarConducao(items);
  const programados=items.filter(l=>categoriaDe(l)==='programados');
  const appointmentMeta=new Map(programados.map(l=>[l,cpAppointmentData(l)]));
  const withAppointment=programados.slice().sort((a,b)=>appointmentMeta.get(a).sortTs-appointmentMeta.get(b).sortTs);
  const apBox=qs("#cpAppointments");
  if(apBox){
    apBox.innerHTML=withAppointment.length?withAppointment.slice(0,4).map(l=>{
      const meta=cpPriorityMeta(l), ap=appointmentMeta.get(l), id=String(l.id||"");
      return `<button type="button" class="cp-appointment" onclick='cpOpenLead(${JSON.stringify(id)})'>
        <span class="cp-time">${cpEscape(ap.time)}</span>
        <span class="cp-lead-avatar" style="${cpAvatarStyle(l.name)}">${cpInitials(l.name)}</span>
        <span class="cp-appointment-copy"><strong>${cpEscape(l.name||"Cliente")}</strong><small>${cpEscape(ap.text)}</small></span>
        <span class="cp-status ${meta.cls}">${meta.label}</span>
      </button>`;
    }).join(""):`<div class="cp-empty cp-empty-compact"><strong>Nenhum compromisso registrado</strong><span>Visitas, reuniões e lembretes aparecerão aqui.</span></div>`;
  }

  // v927 — o donut só somava agora+agenda+aguardando (ex.: 98) enquanto "Clientes ativos" mostra
  // a carteira inteira (ex.: 241) logo acima — números que não batem confundem mais do que
  // ajudam. Agora entra também "Prospecção" (sem-acao: conversa ainda rasa, <5 msgs do cliente),
  // e o total do gráfico passa a fechar com items.length (a carteira toda).
  const counts={agora:0,respondeu:0,programados:0,aguardando:0,semAcao:0};
  for(const l of items){
    const c=categoriaDe(l);
    if(c==='sem-acao') counts.semAcao++;
    else if(counts[c]!==undefined) counts[c]++;
  }
  const total=Math.max(1, items.length);
  const hp=cpPct(counts.agora,total), rp=cpPct(counts.respondeu,total), pp=cpPct(counts.programados,total), ap=cpPct(counts.aguardando,total);
  const donut=qs("#cpTempDonut");
  if(donut) donut.style.background=`conic-gradient(var(--cp-coral) 0 ${hp}%,var(--cp-orange) ${hp}% ${hp+rp}%,var(--cp-blue) ${hp+rp}% ${Math.min(100,hp+rp+pp)}%,var(--cp-slate) ${Math.min(100,hp+rp+pp)}% ${Math.min(100,hp+rp+pp+ap)}%,var(--cp-muted) ${Math.min(100,hp+rp+pp+ap)}% 100%)`;
  cpSetText("cpTotalAtendimentos", items.length);
  const legend=qs("#cpTempLegend");
  if(legend) legend.innerHTML=[
    ["Fazer agora",counts.agora,cpPct(counts.agora,total),"var(--cp-coral)"],
    ["Agenda",counts.programados,cpPct(counts.programados,total),"var(--cp-blue)"],
    ["Aguardando cliente",counts.aguardando,cpPct(counts.aguardando,total),"var(--cp-slate)"],
    ["Prospecção",counts.semAcao,cpPct(counts.semAcao,total),"var(--cp-muted)"]
  ].map(x=>`<div class="cp-legend-row"><i class="cp-dot" style="background:${x[3]}"></i><span>${x[0]}</span><b>${x[2]}%</b></div>`).join("");

  const stageDefs=[
    ["Fazer agora",counts.agora],
    ["Agenda",counts.programados],
    ["Aguardando cliente",counts.aguardando]
  ];
  const maxStage=Math.max(1,...stageDefs.map(x=>x[1]));
  const stageBox=qs("#cpStageBars");
  if(stageBox) stageBox.innerHTML=stageDefs.map(([name,n],idx)=>`<div class="cp-stage-row"><span>${name}</span><div class="cp-stage-track"><div class="cp-stage-fill" style="width:${n?Math.max(7,Math.round(n/maxStage*100)):0}%;opacity:${1-idx*.08}"></div></div><b>${n}</b></div>`).join("");

  const running=qs("#cpRunningDeals");
  if(running){
    running.innerHTML=ordered.length?ordered.slice(0,4).map(l=>{
      const meta=cpPriorityMeta(l), id=String(l.id||"");
      return `<button type="button" class="cp-running-row" onclick='cpOpenLead(${JSON.stringify(id)})'>
        <span class="cp-running-lead"><i class="cp-lead-avatar" style="${cpAvatarStyle(l.name)}">${cpInitials(l.name)}</i><span><strong>${cpEscape(l.name||"Cliente")}</strong><small>${cpEscape(produtosLabel(l)||"Atendimento")}</small></span></span>
        <span class="cp-chip ${meta.cls}">${cpEscape(cp786CategoriaLabel(categoriaDe(l)))}</span>
        <span>${cpDaysText(l)}</span><span>${cpEscape(cpNextAction(l))}</span><span class="cp-priority ${meta.cls}">${meta.label}</span>
      </button>`;
    }).join(""):`<div class="cp-empty cp-empty-table"><strong>Nenhum atendimento em andamento</strong><span>Importe uma conversa para começar.</span></div>`;
  }

  // v1084 — mesmo bug que a v980 corrigiu na Home, vivo aqui: "items" são só os ATIVOS, então
  // quem foi atendido e arquivado no mesmo dia sumia da conta. A Home dizia 12 e o Desempenho 11.
  // cpAtendidosHojeTotal olha a carteira inteira (inclusive arquivados), que é a conta certa.
  const atendidosHoje=(typeof cpAtendidosHojeTotal==='function')?cpAtendidosHojeTotal(items):items.filter(ehContatadoHoje).length;
  const semResposta=items.filter(l=>!ehContatadoHoje(l)&&!lembreteFuturo(l)&&Number(l.daysSinceLastInteraction||0)>=3).length;
  const lembretes=items.filter(l=>!!l?.analysis?.lembrete?.quando).length;
  const confirmados=items.filter(l=>Array.isArray(l?.analysis?.confirmedAppointments)&&l.analysis.confirmedAppointments.length>0).length;
  const donePct=cpPct(atendidosHoje,Math.max(1,items.length));
  const ad=qs("#cpActivityDonut"); if(ad) ad.style.background=`conic-gradient(var(--cp-green) 0 ${donePct}%,var(--cp-slate) ${donePct}% 100%)`;
  cpSetText("cpActivitiesDone",atendidosHoje); cpSetText("cpActivitiesTotal",items.length);
  const al=qs("#cpActivityLegend");
  if(al) al.innerHTML=[
    ["Atendidos hoje",atendidosHoje,"var(--cp-green)"],
    ["Sem resposta 3+ dias",semResposta,"var(--cp-coral)"],
    ["Lembretes",lembretes,"var(--cp-blue)"],
    ["Compromissos",confirmados,"var(--cp-slate)"]
  ].map(x=>`<div class="cp-legend-row"><i class="cp-dot" style="background:${x[2]}"></i><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
}
window.cpOpenLead=cpOpenLead;
window.renderCorretorProDashboard=renderCorretorProDashboard;
const _renderResumoDiaAntes657=renderResumoDia;
renderResumoDia=function(items){ try{_renderResumoDiaAntes657(items);}catch(_){} renderCorretorProDashboard(items,state.todosLeads||items); };
const _renderBotoesHomeAntes657=renderBotoesHome;
renderBotoesHome=function(){
  const detalheAberto=!!state.lead?.id&&!!qs("#leadFocoArea .lead-ui670");
  ui667ModoDetalheLead(detalheAberto);
  const ws=qs("#cpLeadWorkspace"); if(ws) ws.style.display="block";
  try{_renderBotoesHomeAntes657();}catch(_){}
  renderCorretorProDashboard(state.itemsAtivos||[],state.todosLeads||state.itemsAtivos||[]);
};
try{ renderCorretorProDashboard(state.itemsAtivos||[],state.todosLeads||[]); }catch(_){}

/* ============================================================
   ATUALIZAÇÃO #676 — REANÁLISE COM FALLBACK PERSISTENTE
   - usa o resultado salvo da API sem sobrescrever com cache antigo
   - schema comercial 676, leitura pós-gravação e fallback persistente
   - indicadores gerais permanecem ocultos dentro do lead
   ============================================================ */

/* ============================================================
   ATUALIZAÇÃO #673 — REANÁLISE DIRETA + FECHAMENTO FÁTICO
   - botão visível chama a API diretamente e força atualização dos caches
   - "comprou outro imóvel" encerra a oportunidade mesmo em análise antiga
   - contatos sem ação urgente não aparecem entre os prioritários
   ============================================================ */

/* ============================================================
   ATUALIZAÇÃO #672 — AUTORES CORRETOS + ESTADO COMERCIAL COERENTE
   - separa contato, oportunidade, relacionamento e ação
   - remove diagnósticos/mensagens duplicados do detalhe
   - corrige prioridades incompatíveis com oportunidade encerrada
   ============================================================ */

const UI670_OPP_LABEL = {
  "descoberta":["Em descoberta","neutral"],
  "interesse":["Interesse identificado","info"],
  "comparacao":["Em comparação","info"],
  "analise-financeira":["Análise financeira","warn"],
  "negociacao":["Em negociação","warn"],
  "decisao":["Em decisão","warn"],
  "ganha":["Venda concluída","success"],
  "perdida":["Oportunidade encerrada","danger"],
  "encerrada-sem-decisao":["Oportunidade encerrada","neutral"]
};
const UI670_REL_LABEL = {
  "ativo":["Relacionamento ativo","success"],
  "aguardando-nova-oportunidade":["Parceria ativa","success"],
  "contato-periodico":["Contato periódico","info"],
  "pausado":["Relacionamento pausado","neutral"],
  "encerrado":["Relacionamento encerrado","danger"]
};
const UI670_ACTION_LABEL = {
  "responder-agora":["Responder agora","danger"],
  "aguardando-resposta":["Aguardando resposta","warn"],
  "compromisso-agendado":["Compromisso agendado","info"],
  "retomar":["Retomar contato","warn"],
  "sem-acao-urgente":["Sem ação urgente","success"]
};
const UI670_CONTACT_LABEL = {
  "comprador-direto":"Comprador direto",
  "corretor-parceiro":"Corretor parceiro",
  "intermediario":"Intermediário",
  "familiar":"Familiar/intermediário",
  "investidor":"Investidor",
  "empresa":"Empresa",
  "outro":"Contato"
};
const UI670_RESULT_LABEL = {
  "em-andamento":"Em andamento",
  "venda-conosco":"Venda conosco",
  "comprou-outra-opcao":"Comprou outra opção",
  "condicoes-incompativeis":"Condições incompatíveis",
  "desistiu":"Desistiu desta oportunidade",
  "sem-resposta":"Sem resposta",
  "oportunidade-futura":"Oportunidade futura",
  "outro":"Outro resultado"
};

function ui670TextoAnalise(lead){
  const a=lead?.analysis||{},mc=a?.modeloComercial||{};
  const recent=Array.isArray(lead?.recentMessages)?lead.recentMessages:[];
  return [
    a.summary,a.nextAction,a.risk,a.clientProfile,a?.memoria?.observacoes,a?.memoriaSugerida?.observacoes,
    mc?.oportunidade?.motivo,mc?.oportunidade?.resultado,mc?.oportunidade?.status,
    mc?.contexto?.ultimoCompromisso,a?.diagnostico?.pendencia,a?.diagnostico?.objecaoPrincipal,
    ...recent.slice(-40).map(m=>`${m?.author||""}: ${m?.text||""}`)
  ].filter(Boolean).join(" ").toLowerCase();
}
function ui670UltimaMensagemReal(lead){
  const msgs=Array.isArray(lead?.recentMessages)?lead.recentMessages:[];
  const pn=String(lead?.name||"").toLowerCase().trim().split(/\s+/)[0]||"";
  for(let i=msgs.length-1;i>=0;i--){
    const m=msgs[i]; if(!m||!String(m.text||"").trim()) continue;
    const source=String(m.source||""),type=String(m.type||"");
    if(source==="manual"||source==="crm"||type==="print-whatsapp"||["atendimento","nota","ligacao","visita","presencial"].includes(type)) continue;
    return {m,falante:ehMsgDoCliente(m,pn)?"contato":"corretor"};
  }
  return {m:null,falante:"desconhecido"};
}
function ui670Parceiro(lead){
  const a=lead?.analysis||{};
  return /parceir|corretor|corretora|imobili[áa]ria|creci/.test([a.tipoContato,a?.modeloComercial?.contato?.tipo,lead?.name].join(" ").toLowerCase());
}


function ui671HojeIso(){
  try{return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
  catch(_){return new Date().toISOString().slice(0,10);}
}
function ui671DiasAte(data){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(data||"")))return null;
  const a=new Date(ui671HojeIso()+"T12:00:00-03:00"),b=new Date(String(data).slice(0,10)+"T12:00:00-03:00");
  if(isNaN(a)||isNaN(b))return null;return Math.round((b-a)/86400000);
}
function ui671CompromissoAberto(lead){
  const a=lead?.analysis||{},apps=Array.isArray(a.confirmedAppointments)?a.confirmedAppointments:[];
  const concreto=/visita|caf[eé]|reuni[aã]o|liga[cç][aã]o|videochamada|assinatura|contrato|banco/i;
  for(let i=apps.length-1;i>=0;i--){
    const ap=apps[i]||{},prova=String(ap.trechoLiteral||ap.quando||ap.oQue||"").trim();if(!prova)continue;
    const diff=ui671DiasAte(String(ap.data||"").slice(0,10));
    const contato=/cliente|contato/i.test(String(ap.combinadoPor||""));
    if(diff!=null&&diff>=0){const quando=diff===0?"hoje":diff===1?"amanhã":`em ${diff} dias`;return {status:concreto.test(`${ap.oQue||""} ${prova}`)?"compromisso-agendado":"aguardando-resposta",responsavel:contato?"contato":"ambos",urgencia:diff<=1?"media":"baixa",descricao:concreto.test(`${ap.oQue||""} ${prova}`)?`Compromisso confirmado para ${quando}. Acompanhe sem antecipar uma nova abordagem.`:`Aguardar o retorno combinado do contato para ${quando}.`,texto:prova};}
    if(diff!=null&&diff<0&&diff>=-30)return {status:"retomar",responsavel:"corretor",urgencia:Math.abs(diff)>=3?"alta":"media",descricao:`O compromisso combinado venceu há ${Math.abs(diff)} dia(s). Retome usando essa pendência como gancho.`,texto:prova};
  }
  const msgs=Array.isArray(lead?.recentMessages)?lead.recentMessages:[],pn=String(lead?.name||"").toLowerCase().split(/\s+/)[0]||"";
  const re=/\b(vou|iremos|vamos|fico de|dou|darei|te|lhe)\b.{0,55}\b(retorno|retornar|respondo|responder|aviso|avisar|chamo|chamar|analiso|analisar|avalio|avaliar|converso|conversar|vejo|verificar)\b/i;
  const cancel=/\b(desisti|n[aã]o vou|n[aã]o precisa|j[aá] resolvi|comprei|fechei com outro|comprou outro|sem interesse)\b/i;
  for(let i=msgs.length-1;i>=Math.max(0,msgs.length-24);i--){const m=msgs[i];if(!ehMsgDoCliente(m,pn))continue;const t=String(m?.text||"").trim();if(!re.test(t))continue;const canc=msgs.slice(i+1).some(x=>ehMsgDoCliente(x,pn)&&cancel.test(String(x?.text||"")));if(canc)continue;let idade=null;try{const d=m?.iso?new Date(m.iso):null;if(d&&!isNaN(d))idade=Math.floor((Date.now()-d.getTime())/86400000);}catch(_){}if(idade!=null&&idade>180)continue;if(idade!=null&&idade>30)return {status:"retomar",responsavel:"corretor",urgencia:"alta",descricao:`O retorno combinado está vencido há ${idade} dia(s). Retome pela pendência.`,texto:t};return {status:"aguardando-resposta",responsavel:"contato",urgencia:"baixa",descricao:"Aguardar o retorno que o contato se comprometeu a dar.",texto:t};}
  return null;
}

function ui670ModeloComercial(lead){
  const a=lead?.analysis||{};
  const mc=(a.modeloComercial&&typeof a.modeloComercial==="object")?JSON.parse(JSON.stringify(a.modeloComercial)):{};
  const parceiro=ui670Parceiro(lead);
  const txt=ui670TextoAnalise(lead);
  const last=ui670UltimaMensagemReal(lead);
  const real=Array.isArray(lead?.recentMessages)?lead.recentMessages.filter(m=>String(m?.text||"").trim()):[];
  const rePerda=/\b(comprou|comprando|adquiriu|optou por|fechou com|foi para)\b.{0,80}\b(outro|outra)\b|\bacabou comprando\b|\bcomprou outro im[oó]vel\b|\bj[aá] comprou.{0,45}(apartamento|im[oó]vel|casa)\b|\bvendemos?\b.{0,80}\b(outro|outra)\b|\bfoi vendido\b.{0,80}\b(apartamento|im[oó]vel|casa)\b/i;
  const reNova=/\b(novo cliente|nova cliente|outro cliente|outra cliente|nova oportunidade|novo comprador|agora tenho um cliente|estou com um cliente|apareceu um cliente)\b/i;
  let idxPerda=-1,idxNova=-1;real.forEach((m,i)=>{const t=String(m.text||"");if(rePerda.test(t))idxPerda=i;if(reNova.test(t))idxNova=i;});
  const aiPerda=String(mc?.oportunidade?.resultado||"")==="comprou-outra-opcao"||String(mc?.oportunidade?.status||"")==="perdida";
  const resumoPerda=rePerda.test(String(a.summary||""));
  const novaDepois=idxNova>=0&&idxNova>idxPerda;
  const comprouOutra=!novaDepois&&(aiPerda||idxPerda>=0||resumoPerda||rePerda.test(txt));
  const vendaConosco=/contrato assinado|assinou o contrato|comprovante de pagamento|venda confirmada/.test(txt)&&!comprouOutra;
  const despedida=last.falante==="contato"&&/^(muito obrigado|obrigado|obrigada|um abra[cç]o|abra[cç]o|valeu|perfeito|certo)[.! ]*$/i.test(String(last.m?.text||"").trim());
  const ultimaPedeResposta=last.falante==="contato"&&(/\?/.test(String(last.m?.text||""))||/^\s*(pode|consegue|tem como|tem disponibilidade|me manda|me envia|qual|quanto|quando|onde|como|por que|porque)\b/i.test(String(last.m?.text||"")));
  const compromisso=ui671CompromissoAberto(lead);
  // v1069 — etapaLegacy usava normalizarEtapa(lead.etapa) como reserva, mas essa função só
  // devolve "Ativo"/"Geladeira" agora (fim das etapas de funil) — nenhum dos dois encaixa no
  // vocabulário de jornada aqui (descoberta/interesse/comparação/etc). Reserva passa a ser
  // sempre "descoberta" quando a IA não classificou (a?.diagnostico?.etapa).
  const etapaLegacy=String(a?.diagnostico?.etapa||"descoberta").toLowerCase().replace(/\s+/g,"-");
  mc.versao=Number(mc.versao||a._schemaComercial||0);
  mc.contato=mc.contato||{};
  mc.contato.tipo=mc.contato.tipo||(parceiro?"corretor-parceiro":"comprador-direto");
  // v905: removido o texto-filler do papel do contato (era desnecessário). Vazio some da
  // lista de detalhes; a descrição de parceiro (informativa) continua.
  mc.contato.papel=mc.contato.papel||(parceiro?"Intermedeia compradores e pode gerar novas oportunidades":"");
  mc.oportunidade=mc.oportunidade||{};
  mc.oportunidade.status=mc.oportunidade.status||etapaLegacy;
  mc.oportunidade.resultado=mc.oportunidade.resultado||"em-andamento";
  mc.oportunidade.produto=mc.oportunidade.produto||a.produtoInteresse||lead?.product||"Não identificado";
  mc.oportunidade.motivo=mc.oportunidade.motivo||a.summary||"Situação ainda não consolidada.";
  if(vendaConosco){mc.oportunidade.status="ganha";mc.oportunidade.resultado="venda-conosco";mc.oportunidade.motivo="Venda confirmada conosco.";}
  else if(comprouOutra){mc.oportunidade.status="perdida";mc.oportunidade.resultado="comprou-outra-opcao";mc.oportunidade.motivo="O comprador final adquiriu outro imóvel.";}
  mc.relacionamento=mc.relacionamento||{};
  mc.relacionamento.status=mc.relacionamento.status||(parceiro&&mc.oportunidade.status==="perdida"?"aguardando-nova-oportunidade":"ativo");
  if(parceiro&&mc.oportunidade.status==="perdida") mc.relacionamento.status="aguardando-nova-oportunidade";
  mc.relacionamento.potencial=mc.relacionamento.potencial||(parceiro?"médio":"não avaliado");
  mc.relacionamento.motivo=mc.relacionamento.motivo||(parceiro?"O contato pode apresentar novos compradores.":a.clientProfile||"");
  mc.acao=mc.acao||{};
  mc.acao.status=mc.acao.status||(last.falante==="corretor"?"aguardando-resposta":"responder-agora");
  mc.acao.responsavel=mc.acao.responsavel||(last.falante==="corretor"?"contato":"corretor");
  mc.acao.urgencia=mc.acao.urgencia||(mc.acao.status==="responder-agora"?"alta":"baixa");
  mc.acao.descricao=mc.acao.descricao||a.nextAction||"Reanalisar para definir o próximo passo.";
  if(["ganha","perdida"].includes(mc.oportunidade.status)){
    mc.acao.status="sem-acao-urgente";mc.acao.responsavel="ninguem";mc.acao.urgencia="nenhuma";
    if(parceiro&&mc.oportunidade.status==="perdida") mc.acao.descricao="Nenhuma ação urgente. Mantenha a parceria ativa e registre uma nova oportunidade quando surgir outro cliente.";
    else if(mc.oportunidade.status==="ganha") mc.acao.descricao="Venda concluída. Siga apenas com o pós-venda e os compromissos já combinados.";
  }else if(ultimaPedeResposta){
    mc.acao.status="responder-agora";mc.acao.responsavel="corretor";mc.acao.urgencia="alta";
  }else if(compromisso){
    mc.acao.status=compromisso.status;mc.acao.responsavel=compromisso.responsavel;mc.acao.urgencia=compromisso.urgencia;mc.acao.descricao=compromisso.descricao;
  }else if(despedida){
    mc.acao.status="sem-acao-urgente";mc.acao.responsavel="ninguem";mc.acao.urgencia="nenhuma";mc.acao.descricao="Nenhuma ação urgente neste momento.";
  }
  mc.contexto=mc.contexto||{};
  mc.contexto.ultimaPessoaFalar=last.falante;
  mc.contexto.ultimaMensagem=String(last.m?.text||mc.contexto.ultimaMensagem||"").trim();
  mc.contexto.ultimoCompromisso=mc.oportunidade.resultado==="comprou-outra-opcao"
    ? "O contato informou que o comprador final adquiriu outro imóvel; não há retorno pendente desta oportunidade."
    : (compromisso?.texto||mc.contexto.ultimoCompromisso||a?.diagnostico?.ultimoCompromissoCliente||"Nenhum compromisso identificado.");
  mc.contexto.impedimentoPrincipal=mc.contexto.impedimentoPrincipal||a?.diagnostico?.objecaoPrincipal||a.risk||"Não identificado.";
  return mc;
}
window.ui670ModeloComercial=ui670ModeloComercial;

const __prioridadeAtendimento670Base=prioridadeAtendimento;
prioridadeAtendimento=function(l){
  const mc=ui670ModeloComercial(l);
  if(["ganha","perdida","encerrada-sem-decisao"].includes(String(mc?.oportunidade?.status||""))&&mc?.acao?.status==="sem-acao-urgente"){
    return {score:-80,grupo:"pode-aguardar",titulo:"Sem ação urgente",motivo:mc?.relacionamento?.status==="aguardando-nova-oportunidade"?"oportunidade encerrada · parceria ativa":"oportunidade encerrada"};
  }
  return __prioridadeAtendimento670Base(l);
};
window.prioridadeAtendimento=prioridadeAtendimento;

function ui670Badge(tuple){const [txt,cls]=tuple||["Não identificado","neutral"];return `<span class="ui670-badge ${cls}">${escapeHtml(txt)}</span>`;}
function ui670TipoContatoLabel(tipo){return UI670_CONTACT_LABEL[tipo]||UI670_CONTACT_LABEL.outro;}
function ui670FalanteLabel(lead,mc){
  const f=mc?.contexto?.ultimaPessoaFalar;
  if(f==="contato") return String(lead?.name||"Contato").split(/\s+/)[0];
  if(f==="corretor") return "Você";
  return "Não identificado";
}
function ui670Messages(analysis){
  const m=analysis?.messages||{};
  const base=mensagensDaAnalise(analysis||{});
  return {
    a:mensagemAprovadaSemAlteracao(base.a)||"",
    b:mensagemAprovadaSemAlteracao(base.b)||mensagemAprovadaSemAlteracao(base.a)||"",
    c:mensagemAprovadaSemAlteracao(base.c)||mensagemAprovadaSemAlteracao(base.a)||"",
    aLabel:String(m.aLabel||"Melhor resposta"),
    bLabel:String(m.bLabel||"Alternativa leve"),
    cLabel:String(m.cLabel||"Alternativa firme"),
    recomendada:["a","b","c"].includes(String(m.recomendada||base.recomendada||""))?String(m.recomendada||base.recomendada):"a"
  };
}
function ui682PrimeiroNomeLead(lead){
  const fontes = [lead?.clientName, lead?.nomeCliente, lead?.contactName, lead?.name, lead?.title]
    .filter(Boolean)
    .map(v => String(v).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  let bruto = fontes.find(v => v && !/^conversa\s+do\s+whatsapp\b/i.test(v) && !/^(conversa|whatsapp|cliente|lead|contato|arquivo|zip)$/i.test(v)) || fontes[0] || "";
  const extraido = fontes.map(v => { const m = v.match(/conversa\s+do\s+whatsapp\s+com\s+(.+?)(?:\.(zip|txt)|$)/i); return m ? m[1].trim() : ""; }).find(Boolean);
  if(extraido) bruto = extraido;
  const limpo = bruto
    .replace(/\.(zip|txt)$/i, "")
    .replace(/\b(corretor|corretora|imobili[áa]ria|im[oó]veis|creci|cliente|lead)\b.*$/i, "")
    .trim();
  const primeiro = (limpo.split(/\s+/)[0] || "").trim();
  return /^(conversa|whatsapp|cliente|lead|contato|arquivo|zip)$/i.test(primeiro) ? "" : primeiro;
}
function ui682ProdutoCurto(valor, fallback='o imóvel'){
  const s=String(valor||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  if(!s) return fallback;
  // v827 §7.1: sem lista fixa de empreendimentos; devolve o produto como veio da conversa.
  return s;
}
function ui682ProdutoLead(lead, mc){
  return ui682ProdutoCurto(mc?.oportunidade?.produto || lead?.product || produtosLabel?.(lead) || "o imóvel", "o imóvel");
}
function ui682FallbackMessages(lead, mc){
  // v748: sem fallback comercial local. A interface não inventa mensagem.
  return { a:"", b:"", c:"", aLabel:"Recomendada", bLabel:"Alternativa", cLabel:"Direta ao ponto", recomendada:"a", fallback:false };
}
function ui682MesclarMensagens(msgs, lead, mc){
  const fb = ui682FallbackMessages(lead, mc);
  return {
    ...(msgs||{}),
    a:String(msgs?.a||fb.a||"").trim(),
    b:String(msgs?.b||fb.b||"").trim(),
    c:String(msgs?.c||fb.c||"").trim(),
    aLabel:String(msgs?.aLabel||"Recomendada"),
    bLabel:String(msgs?.bLabel||"Facilitar decisão"),
    cLabel:String(msgs?.cLabel||"Direta ao ponto"),
    recomendada:["a","b","c"].includes(String(msgs?.recomendada||"")) ? String(msgs.recomendada) : "a"
  };
}
function ui682FormatarDataHora(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" });
}
function ui682ProgressReanalise(btn){
  if(!btn) return { set(){}, done(){}, fail(){} };
  const container = btn.closest?.(".cp704-lead") || document;
  const old = container.querySelector?.(".ui682-analysis-progress");
  if(old) old.remove();
  const box = document.createElement("div");
  box.className = "ui682-analysis-progress";
  box.style.cssText = "margin:10px 0 0 0;padding:10px 12px;border:1px solid rgba(255,194,102,.35);border-radius:12px;background:rgba(255,194,102,.08);color:var(--soft);font-size:12px;width:100%;min-width:0;box-sizing:border-box";
  box.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;font-weight:950;color:#fff;min-width:0"><span id="ui682ProgressText" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Preparando análise...</span><span id="ui682ProgressPct" style="flex:0 0 auto">5%</span></div><div style="height:6px;background:rgba(255,255,255,.10);border-radius:999px;overflow:hidden;margin-top:8px"><i id="ui682ProgressBar" style="display:block;height:100%;width:5%;background:linear-gradient(90deg,var(--morno),var(--lime));transition:width .35s ease"></i></div>`;
  const top = btn.closest?.(".cp704-top");
  if(top) top.insertAdjacentElement("afterend", box);
  else btn.parentElement?.insertAdjacentElement("afterend", box);
  const set = (pct, txt) => {
    const p = Math.max(0, Math.min(100, Number(pct)||0));
    const bar = box.querySelector("#ui682ProgressBar");
    const pctEl = box.querySelector("#ui682ProgressPct");
    const txtEl = box.querySelector("#ui682ProgressText");
    if(bar) bar.style.width = p + "%";
    if(pctEl) pctEl.textContent = p + "%";
    if(txtEl && txt) txtEl.textContent = txt;
  };
  return {
    set,
    done(txt){ set(100, txt||"Análise concluída e salva."); setTimeout(()=>{ try{ box.remove(); }catch(_){} }, 1800); },
    fail(txt){ set(100, txt||"Falha ao concluir."); box.style.borderColor = "rgba(255,91,122,.5)"; box.style.background = "rgba(255,91,122,.08)"; }
  };
}
function ui675AnaliseDeterministica(lead, baseAnalysis){
  // v756: fallback comercial local DESATIVADO.
  // Se a IA/API falhar ou vier incompleta, a tela deve pedir reanálise, não inventar produto, unidade, simulação ou mensagem.
  const out=(baseAnalysis&&typeof baseAnalysis==="object")?JSON.parse(JSON.stringify(baseAnalysis)):{};
  out.mode=out.mode||"reanalise_pendente";
  out.summary=out.summary||"Análise pendente. Reanalise para gerar leitura nova pela conversa.";
  out.nextAction="Atualize a análise comercial para gerar a próxima ação.";
  out.arquiteturaMensagens=ARQUITETURA_MENSAGENS_ATUAL;
  out.sugestoesPendentes=true;
  out.aprovada=false;
  out.messages={a:"",b:"",c:"",aLabel:"Reanalisar",bLabel:"Reanalisar",cLabel:"Reanalisar",recomendada:"a"};
  out.validacaoSugestoes=["v756: fallback comercial local desativado."];
  out._schemaComercial=COMMERCIAL_SCHEMA_VERSION;
  return out;
}
async function ui675BuscarDetalhe(id){
  const r=await fetch(`./api/lead-update?action=detalhe&id=${encodeURIComponent(id)}&_=${Date.now()}`,{cache:"no-store",headers:{"Cache-Control":"no-cache"}});
  const d=await r.json().catch(()=>({ok:false}));
  if(!r.ok||!d?.ok)return null;
  return d.item||null;
}

// Observação de atendimento (texto ou áudio gravado na hora): soma na linha do tempo do
// lead (sem apagar nada) e reanalisa, pra virar contexto real pras próximas sugestões.
let _cp7ObsRecorder = null, _cp7ObsChunks = [], _cp7ObsStream = null;
// v1026 — ditado em tempo real (o texto vai aparecendo ENQUANTO fala, em vez de só depois de
// "Parar gravação"). Usa o reconhecimento de fala do próprio navegador/celular (Web Speech API,
// já embutido no Chrome/Android — não precisa de servidor nem de biblioteca nova) quando
// disponível; onde não existir (ex.: alguns navegadores no iPhone), cai automaticamente no
// caminho antigo (grava o áudio inteiro e manda transcrever no fim), sem trocar de botão nem
// pedir nada diferente do corretor.
let _cp7ObsReco = null, _cp7ObsRecoTextoBase = "", _cp7ObsDitadoQuerido = false;
function cp7ObsSpeechRecognitionDisponivel(){
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
function cp7ObsPararGravacaoSeAtiva(){
  try{ if(_cp7ObsRecorder && _cp7ObsRecorder.state === "recording") _cp7ObsRecorder.stop(); }catch(_){}
  try{ _cp7ObsStream?.getTracks()?.forEach(t => t.stop()); }catch(_){}
  _cp7ObsStream = null;
  _cp7ObsDitadoQuerido = false;
  try{ if(_cp7ObsReco){ const r=_cp7ObsReco; _cp7ObsReco=null; r.onend=null; r.stop(); } }catch(_){}
}
window.cp7ObsToggleGravacao = async function(btn){
  if(cp7ObsSpeechRecognitionDisponivel()) return cp7ObsToggleDitado(btn);
  return cp7ObsToggleGravacaoServidor(btn);
};
// Ditado ao vivo: o texto reconhecido vai sendo escrito na caixa de observação em tempo real.
function cp7ObsToggleDitado(btn){
  if(_cp7ObsDitadoQuerido){
    // Pedido do dono: só parar quando ELE tocar em "Parar" — _cp7ObsDitadoQuerido=false
    // AQUI (antes do stop()) avisa cp7ObsIniciarDitado's onend que foi um pedido de parada
    // de verdade, não silêncio, então não reinicia sozinho.
    _cp7ObsDitadoQuerido = false;
    if(_cp7ObsReco) _cp7ObsReco.stop();
    return;
  }
  const ta = qs("#cp7ObsTexto");
  _cp7ObsRecoTextoBase = (ta?.value || "").trim();
  _cp7ObsDitadoQuerido = true;
  cp7ObsIniciarDitado(btn);
}
// v1028 — o reconhecimento de fala do navegador (Chrome/Android) para SOZINHO depois de uns
// 1-2s de silêncio, mesmo com continuous:true — é uma limitação conhecida (o "continuous" não
// é de verdade contínuo; a sessão com o serviço de reconhecimento se encerra sozinha depois de
// um tempo sem áudio). O dono pediu que só pare quando ELE tocar em "Parar" — então, quando o
// reconhecimento acaba SOZINHO (o corretor ainda não pediu pra parar), reinicia na hora,
// sem cortar o fluxo nem perder o texto já ditado.
// v1065 — em alguns Android, cada trecho "final" novo que chega não traz só a palavra nova: traz a
// frase INTEIRA dita até ali de novo, crescendo (ex.: "ofereci", depois "ofereci o", depois
// "ofereci o gabro"...). Como cada um vai pra uma posição NOVA do array (não repete a mesma posição
// — isso o v1032 já cobria), juntar todos os trechos vira uma cascata de repetição: "ofereci
// ofereci o ofereci o gabro...". Quando o trecho novo já começa com o trecho anterior inteiro, é a
// MESMA frase crescendo — substitui em vez de somar.
function cp7ObsMesclarFinais(lista){
  const mesclado = [];
  for(const trecho of lista){
    if(!trecho) continue;
    const anterior = mesclado[mesclado.length - 1];
    if(anterior && trecho.toLowerCase().startsWith(anterior.toLowerCase())){
      mesclado[mesclado.length - 1] = trecho;
    } else {
      mesclado.push(trecho);
    }
  }
  return mesclado.join(" ");
}
function cp7ObsIniciarDitado(btn){
  const status = qs("#cp7ObsStatus");
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const reco = new SpeechRecognitionCtor();
  reco.lang = "pt-BR";
  reco.continuous = true;
  reco.interimResults = true;
  // v1032 — em vários Android o reconhecimento reenvia como "final" um trecho que já tinha vindo
  // como final antes (bug conhecido do continuous:true; ev.resultIndex nem sempre pula o que já
  // foi processado). Antes disso fazia o texto "recomeçar de novo" a cada reenvio ("vamos vamos
  // Vamos Vamos retomar Vamos retomar..."), porque cada trecho final ia sendo SOMADO ao texto de
  // novo. Guardando cada trecho pela posição (índice) que o navegador deu a ele, um reenvio só
  // substitui o que já estava naquela posição, em vez de duplicar.
  const finaisPorIndice = [];
  reco.onresult = (ev) => {
    let interim = "";
    for(let i = ev.resultIndex; i < ev.results.length; i++){
      const trecho = ev.results[i]?.[0]?.transcript || "";
      if(ev.results[i].isFinal) finaisPorIndice[i] = trecho.trim();
      else interim += trecho;
    }
    const finalDaSessao = cp7ObsMesclarFinais(finaisPorIndice.filter(Boolean));
    const textoFinal = [_cp7ObsRecoTextoBase, finalDaSessao].filter(Boolean).join(" ");
    const ta = qs("#cp7ObsTexto");
    if(ta) ta.value = [textoFinal, interim.trim()].filter(Boolean).join(" ");
  };
  reco.onerror = (ev) => {
    // "no-speech"/"aborted" acontecem o tempo todo em uso normal (silêncio, parar de propósito)
    // — não é erro de verdade, só o reconhecimento aguardando ou sendo encerrado.
    if(ev?.error === "no-speech" || ev?.error === "aborted") return;
    if(!_cp7ObsDitadoQuerido) return;
    if(status) status.innerHTML = '<span style="color:var(--risco)">Não consegui ouvir: ' + escapeHtml(String(ev?.error||'')) + '</span>';
  };
  reco.onend = () => {
    _cp7ObsReco = null;
    const finalDaSessao = cp7ObsMesclarFinais(finaisPorIndice.filter(Boolean));
    if(finalDaSessao) _cp7ObsRecoTextoBase = (_cp7ObsRecoTextoBase ? _cp7ObsRecoTextoBase + " " : "") + finalDaSessao;
    if(_cp7ObsDitadoQuerido){
      // Parou sozinho (silêncio) — o corretor não pediu pra parar, recomeça na hora.
      cp7ObsIniciarDitado(btn);
      return;
    }
    const btnAtual = qs("#cp7ObsGravarBtn");
    if(btnAtual) btnAtual.textContent = "🎙️ Gravar áudio";
    if(status) status.innerHTML = '<span style="color:var(--acao)">Ditado parado. Revise o texto e toque em Salvar observação.</span>';
  };
  try{
    reco.start();
    _cp7ObsReco = reco;
    if(btn) btn.textContent = "⏹ Parar ditado";
    if(status) status.innerHTML = '<span style="color:var(--morno)">Ouvindo... fale à vontade, o texto vai aparecendo aqui embaixo.</span>';
  }catch(err){
    _cp7ObsReco = null;
    _cp7ObsDitadoQuerido = false;
    if(status) status.innerHTML = '<span style="color:var(--risco)">Não consegui iniciar o ditado: '+escapeHtml(String(err?.message||err))+'</span>';
  }
}
// Caminho antigo (sem reconhecimento de fala no navegador): grava o áudio inteiro e manda
// transcrever de uma vez quando o corretor toca em "Parar gravação".
async function cp7ObsToggleGravacaoServidor(btn){
  const status = qs("#cp7ObsStatus");
  if(_cp7ObsRecorder && _cp7ObsRecorder.state === "recording"){
    _cp7ObsRecorder.stop();
    return;
  }
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){
    if(status) status.innerHTML = '<span style="color:var(--risco)">Seu navegador não permite gravar áudio aqui.</span>';
    return;
  }
  try{
    _cp7ObsStream = await navigator.mediaDevices.getUserMedia({ audio:true });
    const candidatos = ["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"];
    const mime = candidatos.find(m => window.MediaRecorder.isTypeSupported?.(m)) || "";
    _cp7ObsRecorder = mime ? new MediaRecorder(_cp7ObsStream, { mimeType: mime }) : new MediaRecorder(_cp7ObsStream);
    _cp7ObsChunks = [];
    _cp7ObsRecorder.ondataavailable = (e) => { if(e.data && e.data.size) _cp7ObsChunks.push(e.data); };
    _cp7ObsRecorder.onstop = async () => {
      _cp7ObsStream?.getTracks()?.forEach(t => t.stop());
      _cp7ObsStream = null;
      const btnAtual = qs("#cp7ObsGravarBtn");
      if(btnAtual){ btnAtual.textContent = "🎙️ Gravar áudio"; btnAtual.disabled = true; }
      const blob = new Blob(_cp7ObsChunks, { type: _cp7ObsRecorder?.mimeType || "audio/webm" });
      await cp7ObsTranscreverBlob(blob, btnAtual);
    };
    _cp7ObsRecorder.start();
    if(btn){ btn.textContent = "⏹ Parar gravação"; }
    if(status) status.innerHTML = '<span style="color:var(--morno)">Gravando... toque em "Parar gravação" quando terminar.</span>';
  }catch(err){
    if(status) status.innerHTML = '<span style="color:var(--risco)">Não consegui acessar o microfone: '+escapeHtml(String(err?.message||err))+'</span>';
  }
}
async function cp7ObsTranscreverBlob(blob, btn){
  const status = qs("#cp7ObsStatus");
  const ta = qs("#cp7ObsTexto");
  if(status) status.innerHTML = '<span style="color:var(--morno)">Transcrevendo áudio...</span>';
  try{
    const b64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] || "");
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const ext = blob.type.includes("mp4") ? ".mp4" : blob.type.includes("ogg") ? ".ogg" : ".webm";
    const res = await fetchComTimeout("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"transcrever-audio", audioBase64:b64, ext }) }, 45000);
    const data = await res.json().catch(()=>({ok:false}));
    if(data?.ok && data.texto){
      if(ta) ta.value = (ta.value.trim() ? ta.value.trim()+"\n" : "") + data.texto;
      if(status) status.innerHTML = '<span style="color:var(--acao)">Transcrito. Revise o texto e toque em Salvar observação.</span>';
    } else {
      if(status) status.innerHTML = '<span style="color:var(--risco)">'+escapeHtml(data?.error||"Não consegui transcrever esse áudio.")+'</span>';
    }
  }catch(err){
    if(status) status.innerHTML = '<span style="color:var(--risco)">Erro ao transcrever: '+escapeHtml(String(err?.message||err))+'</span>';
  }finally{
    if(btn) btn.disabled = false;
  }
}
window.cp7ObsSalvar = async function(btn){
  const lead = state.lead;
  if(!lead?.id){ toast("Não consegui identificar este lead."); return; }
  const ta = qs("#cp7ObsTexto");
  const texto = (ta?.value||"").trim();
  const status = qs("#cp7ObsStatus");
  if(!texto){ toast("Escreva ou grave a observação primeiro."); return; }
  const original = btn?.textContent || "Salvar observação";
  if(btn){ btn.disabled = true; btn.textContent = "Salvando..."; }
  const enviarObservacao = async () => {
    const res = await fetchComTimeout("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id:lead.id, action:"observacao-adicionar", texto })
    }, 30000);
    const data = await res.json().catch(()=>({ok:false}));
    if(!res.ok || !data?.ok) throw new Error(data?.error || "Não foi possível salvar a observação.");
    return data;
  };
  try{
    // v1036 — o dono confirmou que 2 tentativas (v1034) ainda não bastavam quando a rede demora
    // mais pra reconectar depois de voltar do WhatsApp ("só na terceira tentativa salvou"). Sobe
    // pra 3 tentativas, com uma pausa curta entre elas (dá tempo real da rede reconectar, em vez
    // de bater de novo instantaneamente contra a mesma rede ainda caída) e mostra o progresso.
    const TENTATIVAS = 3;
    let data = null, ultimoErro = null;
    for(let tentativa=1; tentativa<=TENTATIVAS && !data; tentativa++){
      if(status) status.innerHTML = '<span style="color:var(--morno)">'+(tentativa===1 ? "Salvando observação…" : `Rede instável, tentando de novo (tentativa ${tentativa} de ${TENTATIVAS})…`)+'</span>';
      try{ data = await enviarObservacao(); }
      catch(err){ ultimoErro = err; if(tentativa<TENTATIVAS) await new Promise(r=>setTimeout(r,1500)); }
    }
    if(!data) throw ultimoErro || new Error("Não foi possível salvar a observação.");

    // Patch imediato: a observação aparece sem fechar/reabrir abas. As sugestões atuais
    // permanecem intactas; só uma reanálise futura vai gerar novas respostas.
    lead.analysis = lead.analysis || {};
    lead.analysis.memoria = { ...(lead.analysis.memoria||{}), ...(data.memoria||{}) };
    const atual = Array.isArray(lead.recentMessages) ? [...lead.recentMessages] : [];
    const adicionouItem = !!(data.item && !atual.some(m=>String(m?.id||'')===String(data.item.id)));
    if(adicionouItem) atual.push(data.item);
    atual.sort((a,b)=>String(a?.iso||'').localeCompare(String(b?.iso||'')) || Number(a?.order||0)-Number(b?.order||0));
    lead.recentMessages = atual;
    lead.messageCount = adicionouItem ? Math.max(atual.length, Number(lead.messageCount||0)+1) : Math.max(Number(lead.messageCount||0), atual.length);
    state.analysis = lead.analysis;
    for(const lista of [state.itemsAtivos,state.todosLeads,state.leads]){
      const item=Array.isArray(lista)?lista.find(x=>String(x.id)===String(lead.id)):null;
      if(item&&item!==lead){
        item.analysis=item.analysis||{};
        item.analysis.memoria={...(item.analysis.memoria||{}),...(data.memoria||{})};
      }
    }
    // Pedido do dono: salvar observação marca o lead como atendido — mesmo patch local já
    // usado pelo botão "Marcar atendimento" (ui667AplicarAtendidoLocal), pra refletir na
    // hora sem esperar o próximo recarregamento da lista.
    if(data.item?.iso){
      const detalhesObs = {tipo:"Observação",de:"observacao_manual"};
      ui667AplicarAtendidoLocal(lead, data.item.iso, data.item.date, data.item.time, detalhesObs);
      ui667ReconciliarAtendimentoLocal(lead.id, (item) => ui667AplicarAtendidoLocal(item, data.item.iso, data.item.date, data.item.time, detalhesObs));
    }
    if(ta) ta.value="";
    renderLeadFoco(lead);
    if(status) status.innerHTML = '<span style="color:var(--acao)">Observação salva. Aprendizado em segundo plano; sugestões atuais mantidas.</span>';
    toast("Observação salva. O sistema vai aprender com ela em segundo plano.");
    invalidarLeadsCache();
    setTimeout(()=>window.iniciarAprendizadoContinuoAutomatico?.({somentePendentes:true}),500);
  }catch(err){
    if(status) status.innerHTML = '<span style="color:var(--risco)">'+escapeHtml(userFriendlyError(err))+'</span>';
    if(btn){ btn.disabled=false; btn.textContent=original; }
  }
};

window.ui670Reanalisar=async function(btn){
  const lead=state.lead;
  if(!lead?.id){toast("Não consegui identificar este lead.");return;}
  // Não troca o texto do botão: agora é um ícone pequeno (66px) e "Atualizando análise..."
  // estourava pra fora do card. O progresso já aparece na barra grande. Só gira o ícone.
  if(btn){btn.disabled=true;btn.classList.add('cp704-ico-loading');}
  const progresso = ui682ProgressReanalise(btn);
  progresso.set(8, "Lendo histórico do lead...");
  let etapaFake = 0;
  const etapasFake = [
    [18, "Identificando intenção, objeção e pendência..."],
    [34, "Recalculando prioridade comercial..."],
    [52, "Gerando próxima ação e mensagem..."],
    [72, "Gravando análise no banco..."],
    [88, "Conferindo se ficou salvo..." ]
  ];
  const progressoTimer = setInterval(()=>{
    if(etapaFake < etapasFake.length){ const e = etapasFake[etapaFake++]; progresso.set(e[0], e[1]); }
  }, 1800);
  const ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort(),90000);
  try{
    let leadBaseAtualizado = lead;
    try{ leadBaseAtualizado = (await ui675BuscarDetalhe(lead.id)) || lead; }catch(_){}
    const res=await fetch("./api/reanalisar-lead",{
      method:"POST",headers:{"Content-Type":"application/json","Cache-Control":"no-cache"},
      body:JSON.stringify(payloadComCerebro({id:lead.id,action:"atualizar-analise-comercial",versaoCliente:(window.CORRETOR_PRO_VERSION||709)})),signal:ctrl.signal,cache:"no-store"
    });
    clearTimeout(timeout);
    const textoResposta = await res.text();
    let data;
    try {
      data = textoResposta ? JSON.parse(textoResposta) : {};
    } catch (_) {
      console.error("Resposta inválida da API /reanalisar-lead:", textoResposta);
      throw new Error("O servidor respondeu em formato inválido. A API foi corrigida para retornar JSON; publique a versão 704 completa.");
    }
    if(!res.ok||!data?.ok){
      const rawErr = String(data?.error||"");
      // Erro específico e comum: o lead não tem a CONVERSA salva (timeline vazia) — reanalisar
      // não tem o que reprocessar. Troca o texto técnico por uma orientação clara.
      if(/sem timeline/i.test(rawErr)){
        throw new Error("Este lead não tem a conversa do WhatsApp salva, então não há o que reanalisar. Importe o ZIP da conversa deste cliente (ou registre uma observação acima) e tente de novo.");
      }
      const erroServidor = data?.detail ? `${data.error || "Não foi possível atualizar a análise."} — ${data.detail}` : (data?.error||"Não foi possível atualizar a análise.");
      throw new Error(erroServidor);
    }
    progresso.set(90, "Validando gravação no banco...");

    let analysis=(data?.analysis&&typeof data.analysis==="object")?data.analysis:null;
    let schema=Number(analysis?._schemaComercial||analysis?.modeloComercial?.versao||0);
    let usouFallback=false;

    // Compatibilidade com uma função antiga ou resposta incompleta: relê o banco antes de desistir.
    if(!analysis||schema<682){
      for(const espera of [0,450,900]){
        if(espera)await new Promise(r=>setTimeout(r,espera));
        const detalhe=await ui675BuscarDetalhe(lead.id).catch(()=>null);
        const aDetalhe=detalhe?.analysis||null;
        const sDetalhe=Number(aDetalhe?._schemaComercial||aDetalhe?.modeloComercial?.versao||0);
        if(aDetalhe&&sDetalhe>=COMMERCIAL_SCHEMA_VERSION){analysis=aDetalhe;schema=sDetalhe;break;}
        if(aDetalhe&&!analysis)analysis=aDetalhe;
      }
    }

    // v756: sem fallback local. Se a API não devolver análise atual, não inventar mensagem.
    if(!analysis||schema<682)throw new Error("A análise não foi gerada pela IA atual. Tente reanalisar novamente.");
    clearInterval(progressoTimer);
    progresso.done("Análise concluída e salva.");
    try{ cpRegistrarAtividade("analise"); }catch(_){}

    const atualizado=limparLead({...leadBaseAtualizado,analysis,summary:analysis.summary||leadBaseAtualizado.summary||lead.summary,nextAction:analysis.nextAction||leadBaseAtualizado.nextAction||lead.nextAction});
    state.lead=atualizado;state.analysis=atualizado.analysis||null;
    for(const lista of [state.itemsAtivos,state.todosLeads,state.leads]){
      if(!Array.isArray(lista))continue;
      const i=lista.findIndex(x=>String(x.id)===String(lead.id));
      if(i>=0)lista[i]=limparLead({...lista[i],analysis,summary:analysis.summary||lista[i].summary,nextAction:analysis.nextAction||lista[i].nextAction});
    }
    invalidarLeadsCache();
    _leadDetailCache.set(String(lead.id),{ts:Date.now(),data:atualizado,inflight:null});
    renderLeadFoco(atualizado);
    const mc=analysis.modeloComercial||{};
    const semAcao=mc?.acao?.status==="sem-acao-urgente";
    const aviso=data?.warning||"";
    toast(usouFallback?"✓ Análise corrigida e salva.":(aviso?"✓ Análise comercial atualizada com reconciliação factual.":(semAcao?"✓ Análise atualizada: nenhuma ação urgente.":"✓ Análise comercial atualizada.")));
    setTimeout(()=>qs("#leadFocoArea")?.scrollIntoView({behavior:"smooth",block:"start"}),80);

    setTimeout(async()=>{
      try{
        // v1033 — se o corretor copiar uma mensagem sugerida (o que já marca atendido na hora,
        // localmente) bem na janela entre a reanálise terminar e este refresh de fundo rodar
        // (até 600ms depois), o refresh substituía o lead e as 3 listas INTEIRAS por dados
        // frescos do servidor — que podem não ter pego a marcação de atendido ainda (ela é
        // gravada em paralelo, por uma chamada separada). A marcação sumia sem nenhum aviso
        // ("copiei a mensagem sugerida e não marcou atendimento"). Guarda o atendimento mais
        // recente já conhecido ANTES de buscar os dados frescos, pra reaplicá-lo se o servidor
        // vier mais "antigo" que isso — mesma ideia da v1031 (ui667AplicarAtendidoLocal), só que
        // aqui não existe um "quando" próprio: o candidato é o que já estava marcado localmente.
        const antes = (state.lead && String(state.lead.id) === String(lead.id)) ? state.lead
          : [state.itemsAtivos, state.todosLeads, state.leads].flat().find(x => x && String(x.id) === String(lead.id));
        const eventoAntes = (antes?.analysis?.aprendizado?.eventos||[]).find(e => e?.evento === "contato_manual" && e?.quando === antes.lastAttendanceAt);
        const base=await getLeadsData(true);
        if(base?.ok&&Array.isArray(base.items)){
          const itens=base.items.map(limparLead);state.todosLeads=itens;state.leads=itens.slice(0,8);
          state.itemsAtivos=itens.filter(leadEhAtivo);
          const fresco=itens.find(x=>String(x.id)===String(lead.id));
          const freshSchema=Number(fresco?.analysis?._schemaComercial||fresco?.analysis?.modeloComercial?.versao||0);
          if(fresco&&freshSchema>=COMMERCIAL_SCHEMA_VERSION){state.lead={...atualizado,...fresco,historyLoaded:atualizado.historyLoaded,recentMessages:atualizado.recentMessages};}
          if(eventoAntes && (!fresco?.lastAttendanceAt || new Date(antes.lastAttendanceAt) > new Date(fresco.lastAttendanceAt))){
            const [dataLocal, horaLocal] = String(antes.lastAttendanceText||"").split(" ");
            if(dataLocal && horaLocal){
              if(state.lead && String(state.lead.id) === String(lead.id)) ui667AplicarAtendidoLocal(state.lead, eventoAntes.quando, dataLocal, horaLocal, eventoAntes.detalhes);
              for(const lista of [state.itemsAtivos, state.todosLeads, state.leads]){
                const item = Array.isArray(lista) ? lista.find(x => String(x.id) === String(lead.id)) : null;
                if(item) ui667AplicarAtendidoLocal(item, eventoAntes.quando, dataLocal, horaLocal, eventoAntes.detalhes);
              }
            }
          }
        }
      }catch(_){}
    },600);
  }catch(err){
    clearTimeout(timeout);
    clearInterval(progressoTimer);
    try{ progresso.fail("Não foi possível concluir a análise."); }catch(_){}
    const msg=err?.name==="AbortError"?"A atualização demorou demais. Tente novamente.":(err?.message||String(err));
    toast("Não foi possível atualizar: "+msg);
    if(btn){btn.disabled=false;btn.classList.remove('cp704-ico-loading');}
  }
};
window.ui670Toggle=function(id){const el=qs("#"+id);if(!el)return;el.hidden=!el.hidden;if(!el.hidden){if(el.tagName==="DETAILS")el.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"nearest"}),40);}};

function ui670ScheduleHtml(lead){
  if(!lead?.id)return "";
  const id=JSON.stringify(String(lead.id));
  return `<div id="ui670SchedulePanel" class="ui670-inline-panel" hidden><b>Agendar próximo contato</b><div class="ui670-quick-dates"><button onclick='reagendarDias(${id},0)'>Hoje</button><button onclick='reagendarDias(${id},1)'>Amanhã</button><button onclick='reagendarDias(${id},7)'>+7 dias</button><button onclick='reagendarDias(${id},15)'>+15 dias</button><button onclick='reagendarDias(${id},30)'>+30 dias</button></div><input type="date" onchange='reagendarLembrete(${id},this.value)'></div>`;
}
function ui670DetailRows(lead,mc){
  const a=lead?.analysis||{},mem=a.memoria||a.memoriaSugerida||{};
  const rows=[
    ["Papel do contato",mc?.contato?.papel],
    ["Comprador final",mc?.oportunidade?.compradorFinal||mc?.contato?.compradorFinal],
    ["Produto",mc?.oportunidade?.produto],
    ["Identificador da oportunidade",mc?.oportunidade?.id],
    ["Resultado",UI670_RESULT_LABEL[mc?.oportunidade?.resultado]||mc?.oportunidade?.resultado],
    ["Motivo da oportunidade",mc?.oportunidade?.motivo],
    ["Último compromisso",mc?.contexto?.ultimoCompromisso],
    ["Impedimento principal",mc?.contexto?.impedimentoPrincipal],
    ["Preferências",mem.preferencias],
    ["Pessoas na decisão",mem.pessoasDecisao],
    ["Observações",mem.observacoes]
  ].filter(([,v])=>String(v||"").trim()&&!/^não identificado\.?$/i.test(String(v).trim()));
  return rows.map(([k,v])=>`<div class="ui670-detail-row"><b>${escapeHtml(k)}</b><span>${escapeHtml(String(v))}</span></div>`).join("")||'<div class="empty">Sem detalhes adicionais registrados.</div>';
}

// Atualização #724-2: wrapper antigo de renderLeadFoco removido.



/* ============================================================
   #683 FECHAMENTO — BOTÕES RÁPIDOS E FLUXO DIÁRIO COMPLETO
   Complementa a v683 para garantir que todos os atalhos funcionem
   em 1 clique e registrem rastreabilidade operacional.
   ============================================================ */
(function(){
  if(window.__cp683FechamentoCompleto) return;
  window.__cp683FechamentoCompleto = true;

  async function ui683RegistrarEvento(id, evento, detalhes){
    if(!id) return { ok:false };
    try{
      const res = await fetch('./api/lead-update', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id, action:'aprendizado', evento, detalhes: detalhes || {} })
      });
      return await res.json().catch(()=>({ ok:false }));
    }catch(_){ return { ok:false }; }
  }

  async function ui683MoverEtapaComEvento(id, etapa, label, evento){
    if(!id) return toast('Lead não identificado.');
    // v1069 — só existem dois estados de etapa agora: Ativo e Geladeira (arquivado); o backend
    // rejeita qualquer outro valor (ver ETAPAS_VALIDAS em api/lead-update.js). "Geladeira" é a
    // única transição de etapa de verdade aqui (Arquivar); qualquer outro rótulo (ex.: "Proposta
    // feita") vira só um evento registrado na timeline, sem chamar a ação "etapa".
    const arquivando = etapa === 'Geladeira';
    const confirmMsg = arquivando
      ? 'Arquivar este lead? Ele sai das prioridades e da busca, mas fica guardado nos arquivados pra você reativar depois.'
      : `Marcar este lead como ${label || etapa}?`;
    const okConfirm = (typeof cp903Confirm === 'function')
      ? await cp903Confirm({
          titulo: arquivando ? 'Arquivar lead' : (label || etapa),
          mensagem: confirmMsg,
          ok: arquivando ? 'Arquivar' : (label || 'OK'),
          perigo: false
        })
      : confirm(confirmMsg);
    if(!okConfirm) return;
    try{
      if(arquivando){
        const res = await fetch('./api/lead-update', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, action:'etapa', etapa }) });
        const data = await res.json().catch(()=>({}));
        if(!res.ok || !data?.ok) throw new Error(data?.error || 'falha ao salvar');
      }
      await ui683RegistrarEvento(id, evento || 'etapa_alterada', { etapa, label: label || etapa, de:'botao_rapido' });
      invalidarLeadsCache();
      if(arquivando){
        // Some da busca/listas na hora (sem esperar refresh) e volta pra home. "Acabou."
        try{ removerLeadDosCaches(id); }catch(_){}
        state.lead = null; state.focoLeadId = null; state.grupoAtivo = null;
        document.body.classList.remove('lead-foco-aberto');
        toast('Lead arquivado.');
        try{ if(typeof show === 'function') show('home'); }catch(_){}
        try{ await carregarDashboard(); }catch(_){}
        return;
      }
      toast(`${label || etapa} registrado.`);
      try{ await carregarDashboard(); }catch(_){}
      try{ await abrirLead(id); }catch(_){}
    }catch(err){ toast('Não consegui atualizar: ' + (err?.message || err)); }
  }

  // v1073 — a versão viva do Arquivar: confirmação em-app + evento + volta pra home.
  window.arquivarLead = function(id, nome){
    return ui683MoverEtapaComEvento(id, 'Geladeira', 'Arquivado', 'lead_arquivado');
  };
})();


/* ============================================================
   V684-FINAL — IA COMERCIAL 2.0
   - mostra raciocínio comercial proativo no lead
   - perfil do cliente, risco de perda, mudança de comportamento
   - próxima ação ideal, produto adequado, estratégia e sinais
   ============================================================ */
(function(){
  if(window.__cp684IAComercialFinal) return;
  window.__cp684IAComercialFinal = true;

  function ui684InjectStyles(){
    if(document.getElementById('ui684Styles')) return;
    const st=document.createElement('style'); st.id='ui684Styles';
    st.textContent=`
      .ui684-card{margin:14px 0;padding:16px;border:1px solid rgba(55,232,255,.28);border-radius:18px;background:linear-gradient(135deg,rgba(55,232,255,.075),rgba(255,98,88,.04));box-shadow:0 12px 36px rgba(0,0,0,.14)}
      .ui684-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.ui684-head h3{margin:0;font-size:17px;color:#fff}.ui684-head p{margin:4px 0 0;color:var(--muted);font-size:12px;line-height:1.35}.ui684-badge{border:1px solid rgba(55,232,255,.42);color:var(--dados);border-radius:999px;padding:6px 10px;font-size:10px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
      .ui684-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ui684-item{padding:11px 12px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.028)}.ui684-item.full{grid-column:1/-1}.ui684-lab{display:block;margin-bottom:5px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:950}.ui684-val{font-size:13px;line-height:1.45;color:var(--text);white-space:pre-wrap}.ui684-details{margin-top:10px}.ui684-details summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.04);color:var(--soft);font-size:12px;font-weight:950}.ui684-details[open] summary{color:var(--dados);border-color:rgba(55,232,255,.35)}.ui684-list{margin:0;padding-left:16px;color:var(--soft);font-size:12px;line-height:1.45}.ui684-list li{margin:3px 0}.ui684-empty{padding:12px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);font-size:12px}.ui684-action-reason{margin:10px 0 0;padding:10px 12px;border:1px solid rgba(55,232,255,.22);border-radius:13px;background:rgba(55,232,255,.045);color:var(--soft);font-size:12px;line-height:1.45}.ui684-action-reason b{color:var(--text)}
      #btnTopo,#btnSubir,.scroll-top,.back-to-top{bottom:92px!important}.lead-acts button{border-radius:999px!important} @media(max-width:760px){.ui684-grid{grid-template-columns:1fr}.ui684-card{padding:14px}.ui684-badge{display:none}.ui684-card{margin-top:12px}#btnTopo,#btnSubir,.scroll-top,.back-to-top{bottom:104px!important}}
    `;
    document.head.appendChild(st);
  }
  function ui684Esc(v){ return typeof escapeHtml==='function' ? escapeHtml(String(v||'')) : String(v||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  function ui684List(arr){ arr=Array.isArray(arr)?arr.filter(Boolean):[]; return arr.length ? `<ul class="ui684-list">${arr.slice(0,4).map(x=>`<li>${ui684Esc(x)}</li>`).join('')}</ul>` : `<div class="ui684-empty">Nenhum sinal forte registrado ainda.</div>`; }
  function ui684TextoAcaoPratica(txt){
    txt = String(txt||'').trim();
    if(!txt) return 'Definir o próximo passo comercial com base no histórico antes de responder.';
    const low = txt.toLowerCase();
    if(low.includes('parâmetro') || low.includes('parametro') || low.includes('financeir')) return 'Solicitar entrada disponível, renda aproximada e parcela ideal para montar a simulação correta.';
    if(low.includes('visita')) return 'Propor dois horários objetivos para visita e confirmar quem participa da decisão.';
    if(low.includes('proposta')) return 'Enviar ou revisar a proposta e combinar claramente o próximo retorno.';
    if(low.includes('retomar')) return 'Retomar a conversa usando o último compromisso do cliente como gancho, sem mensagem genérica.';
    if(/^receber\b/i.test(txt)) return 'Pedir os dados que faltam para avançar: ' + txt.replace(/^receber\s*/i,'').trim();
    return txt;
  }
  function ui684Data(lead){
    const a=lead?.analysis||{};
    const ia=(a.iaComercialV2&&typeof a.iaComercialV2==='object')?a.iaComercialV2:null;
    if(ia) return ia;
    const diag=(a.diagnostico&&typeof a.diagnostico==='object')?a.diagnostico:{};
    const lc=(a.leituraComercial&&typeof a.leituraComercial==='object')?a.leituraComercial:{};
    return {
      versao:COMMERCIAL_SCHEMA_VERSION,
      perfilCliente:a.clientProfile||'Perfil ainda em leitura; reanalise para a IA Comercial 2.0 aprofundar.',
      etapaComercial:diag.etapa||lc.etapa||normalizarEtapa(lead?.etapa)||'Não definida',
      mudancaComportamento:'Reanalise este lead para detectar mudança de comportamento com mais precisão.',
      riscoPerda:{nivel:'qualitativo',motivo:'leitura comercial baseada no histórico e nas pendências abertas'},
      proximaAcaoIdeal:a.nextAction||lc.oQueDestravar||a.melhorPergunta||'Reanalisar para definir próxima ação ideal.',
      produtoMaisAdequado:lead?.product||a.product||'Produto ainda não definido',
      estrategiaAbordagem:'Retomar pelo último ponto concreto da conversa e fazer uma pergunta principal.',
      sinaisPositivos:[],alertas:[],raciocinioComercial:''
    };
  }
  function ui684RenderCard(lead){
    const ia=ui684Data(lead);
    const risco=ia.riscoPerda||{};
    const fatoresRisco=Array.isArray(risco.fatores)?risco.fatores:[];
    const fatoresProtecao=Array.isArray(risco.fatoresProtecao)?risco.fatoresProtecao:[];
    const proximaPratica = ui684TextoAcaoPratica(ia.proximaAcaoIdeal);
    return `<section id="ui684IAComercial" class="ui684-card">
      <div class="ui684-head"><div><h3>IA Comercial 2.0</h3><p>Leitura proativa: perfil, estratégia e próxima ação para este lead.</p></div><span class="ui684-badge">v${COMMERCIAL_SCHEMA_VERSION}</span></div>
      <div class="ui684-grid">
        <div class="ui684-item"><span class="ui684-lab">Perfil do cliente</span><div class="ui684-val">${ui684Esc(ia.perfilCliente)}</div></div>
        <div class="ui684-item"><span class="ui684-lab">Próxima ação ideal</span><div class="ui684-val">${ui684Esc(proximaPratica)}</div></div>
        <div class="ui684-item"><span class="ui684-lab">Produto mais adequado</span><div class="ui684-val">${ui684Esc(ia.produtoMaisAdequado)}</div></div>
      </div>
      <details class="ui684-details">
        <summary>Ver análise completa</summary>
        <div class="ui684-grid" style="margin-top:10px">
          <div class="ui684-item full"><span class="ui684-lab">Mudança de comportamento</span><div class="ui684-val">${ui684Esc(ia.mudancaComportamento)}</div></div>
          <div class="ui684-item full"><span class="ui684-lab">Estratégia de abordagem</span><div class="ui684-val">${ui684Esc(ia.estrategiaAbordagem)}</div></div>
          <div class="ui684-item"><span class="ui684-lab">Sinais positivos</span>${ui684List(ia.sinaisPositivos)}</div>
          <div class="ui684-item"><span class="ui684-lab">Alertas</span>${ui684List(ia.alertas)}</div>
          ${fatoresRisco.length||fatoresProtecao.length?`<div class="ui684-item full"><span class="ui684-lab">Fatores comerciais</span>${fatoresRisco.length?`<div class="ui684-val"><b>Pontos de atenção:</b></div>${ui684List(fatoresRisco)}`:''}${fatoresProtecao.length?`<div class="ui684-val" style="margin-top:8px"><b>Sinais favoráveis:</b></div>${ui684List(fatoresProtecao)}`:''}</div>`:''}
          <div class="ui684-item full"><span class="ui684-lab">Raciocínio comercial</span><div class="ui684-val">${ui684Esc(ia.raciocinioComercial||'Reanalise para gerar o raciocínio comercial completo.')}</div></div>
        </div>
      </details>
    </section>`;
  }

  function ui684MotivoProximaAcao(lead){
    const ia=ui684Data(lead);
    const risco=ia.riscoPerda||{};
    const motivo=ia.motivoProximaAcao||ia.porqueProximaAcao||ia.explicacaoProximaAcao||risco.motivo||'';
    if(motivo) return motivo;
    const acao=String(ia.proximaAcaoIdeal||'').toLowerCase();
    if(/simula|par[aâ]metro|financeir|entrada|parcela/.test(acao)) return 'porque a pendência principal é financeira e a próxima conversa precisa destravar viabilidade.';
    if(/visita|café|conhecer|decorado/.test(acao)) return 'porque o lead já tem sinais de interesse e precisa de um compromisso prático.';
    if(/responder|retomar/.test(acao)) return 'porque existe pendência aberta e a retomada deve usar o último ponto concreto da conversa.';
    return 'porque esta é a ação com maior chance de avançar o lead sem gerar pressão desnecessária.';
  }
  function ui684EnhanceActionCard(lead){
    const action=document.querySelector('.ui670-action-card');
    if(!action) return;
    action.querySelector('.ui684-action-reason')?.remove();
    const div=document.createElement('div');
    div.className='ui684-action-reason';
    div.innerHTML=`<b>Por que:</b> ${ui684Esc(ui684MotivoProximaAcao(lead))}`;
    const h3=action.querySelector('h3');
    if(h3 && h3.parentNode) h3.parentNode.insertBefore(div,h3.nextSibling); else action.appendChild(div);
  }
// Atualização #724-2: wrapper antigo de renderLeadFoco removido.
  window.CORRETOR_PRO_VERSAO_IA_COMERCIAL = COMMERCIAL_SCHEMA_MINOR;
})();






/* ============================================================
   Atualização #724-2 — revisão de auditoria
   Objetivo: completar a camada segura de performance sem alterar
   a identidade visual nem remover funcionalidades.
   - listas longas em blocos: vendidos, perdidos e geladeira
   - métricas de renderização dessas listas
   - contadores de cache também no detalhe do lead
   ============================================================ */
(function(){
  if(window.__cp6862AuditPatch) return;
  window.__cp6862AuditPatch = true;
  const PAGE = 80;
  function leadId(l){ return JSON.stringify(String(l?.id || "")); }
  function ensureVisibleKey(key){
    state[key] = Math.max(PAGE, Number(state[key] || PAGE));
    return state[key];
  }
  function loadMore(key, renderFn){
    state[key] = ensureVisibleKey(key) + PAGE;
    if(typeof renderFn === 'function') renderFn();
  }
  function baseRows(items){
    return (Array.isArray(items) ? items : []).map(limparLead);
  }
  function arquivadoCardHTML(l){
    const idJs = leadId(l);
    const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction+'d parado' : '';
    return `
      <div data-arquivado-id="${escapeHtml(String(l.id||''))}" style="border:1px solid var(--line);background:rgba(0,212,255,.04);border-radius:14px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <strong style="font-size:15px;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(55,232,255,.3)" onclick='abrirLead(${idJs})'>${escapeHtml(l.name||'Cliente')}</strong>
            <div class="small" style="margin-top:4px;color:var(--muted)">${escapeHtml(produtosLabel(l))}${dias?' · '+dias:''}</div>
          </div>
          <span class="tag" style="background:rgba(0,212,255,.12);color:#bff0ff;border-color:rgba(0,212,255,.32);font-size:10px">ARQUIVADO</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button type="button" onclick='abrirLead(${idJs})' style="padding:6px 12px;background:transparent;color:var(--soft);border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Ver lead</button>
          <button type="button" onclick='reativarLeadArquivado(${idJs},this)' style="padding:6px 12px;background:rgba(104,255,149,.12);color:var(--acao);border:1px solid var(--acao);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Reativar</button>
        </div>
      </div>`;
  }
  function renderLoadMore(key, total, visible, fnName){
    const faltam = Math.max(0, total - visible);
    return faltam > 0
      ? `<button type="button" class="cart-load-more" onclick="${fnName}()">Carregar mais ${Math.min(PAGE, faltam)} <span>(${visible} de ${total})</span></button>`
      : "";
  }
  window.cp6862MaisGeladeira = function(){ loadMore('arquivadosVisibleCount', window.carregarArquivados); };

  // v928 — window.carregarVendas/cp6862MaisVendas removidos: alvo #vendasList não existe no
  // HTML desde a v904 (tela "Vendas registradas" removida) — nunca renderizava nada.
  // v1069 — window.carregarPerdidos/cp6862MaisPerdidos removidos pelo mesmo motivo: alvo
  // #perdidosList não existe no HTML desde a v952 (tela "Perdidos" virou parte de Arquivados).

  window.carregarArquivados = async function(){
    const start = cpPerfNow();
    const box = qs('#arquivadosList');
    if(!box) return;
    box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
    try{
      const data = await getLeadsData(false);
      const items = baseRows(data?.items).filter(l => normalizarEtapa(l.etapa) === 'Geladeira');
      state.arquivadosItemsTodos = items;
      const buscaAtiva = qs('#buscaArquivados');
      if(buscaAtiva && buscaAtiva.value.trim().length >= 2){
        window.buscaArquivadosInline(buscaAtiva.value);
        cpPerfMark('renderArquivados', start, { total:items.length, busca:true });
        return;
      }
      const limite = ensureVisibleKey('arquivadosVisibleCount');
      const lote = items.slice(0, limite);
      if(!items.length){ box.innerHTML = '<div class="empty">Nenhum contato arquivado no momento.</div>'; cpPerfMark('renderArquivados', start, { total:0, visiveis:0 }); return; }
      box.innerHTML = `<div class="small" style="color:var(--muted);margin-bottom:10px">${items.length} negócio${items.length>1?'s':''} guardado${items.length>1?'s':''}.</div>` + lote.map(arquivadoCardHTML).join('') + renderLoadMore('arquivadosVisibleCount', items.length, lote.length, 'cp6862MaisGeladeira');
      cpPerfMark('renderArquivados', start, { total:items.length, visiveis:lote.length });
    }catch(err){ box.innerHTML = '<div class="notice error">Falha: '+escapeHtml(String(err?.message||err))+'</div>'; cpPerfMark('renderArquivados', start, { error:true }); }
  };

  // Busca dentro dos Arquivados (Geladeira/Perdido): o dono pediu pra achar rápido um contato
  // "morto" que voltou a responder, sem precisar rolar a lista inteira, e reativá-lo dali mesmo.
  let _buscaArquivadosTimer = null;
  window.buscaArquivadosInline = function(termo){
    clearTimeout(_buscaArquivadosTimer);
    _buscaArquivadosTimer = setTimeout(() => {
      const box = qs('#arquivadosList');
      if(!box) return;
      const t = semAcento(termo);
      if(t.length < 2){ window.carregarArquivados(); return; }
      const fonte = Array.isArray(state.arquivadosItemsTodos) ? state.arquivadosItemsTodos : [];
      const numeros = String(termo||'').replace(/\D/g,'');
      const matches = fonte.filter(l => semAcento(l.name).includes(t) || semAcento(l.product).includes(t) || (numeros.length >= 3 && String(l.phone||'').replace(/\D/g,'').includes(numeros)));
      if(!matches.length){ box.innerHTML = `<div class="empty">Nenhum arquivado encontrado com "${escapeHtml(termo)}".</div>`; return; }
      box.innerHTML = `<div class="small" style="color:var(--muted);margin-bottom:10px">${matches.length} encontrado${matches.length>1?'s':''}.</div>` + matches.map(arquivadoCardHTML).join('');
    }, 200);
  };

  try{
    const antigoResumo = window.cpPerformanceResumo;
    window.cpPerformanceResumo = function(){
      const r = typeof antigoResumo === 'function' ? antigoResumo() : {};
      r.renderPerdidosMs = cpPerfMedia('renderPerdidos');
      r.renderArquivadosMs = cpPerfMedia('renderArquivados');
      return r;
    };
  }catch(_){}
})();


/* ============================================================
   Atualização #724-2 — fechamento real da pendência de performance
   - Virtualização real das listas mais pesadas: Atendimentos e Pipeline.
   - Renderiza somente a janela visível + margem; não empilha milhares de cards no DOM.
   - Autoajuste por scroll, mantendo identidade visual e comportamento dos cliques.
   ============================================================ */
(function(){

  try{
    const oldResumo = window.cpPerformanceResumo;
    window.cpPerformanceResumo = function(){
      const r = typeof oldResumo === 'function' ? oldResumo() : {};
      r.renderCarteiraVirtualMs = cpPerfMedia('renderCarteiraVirtual');
      r.carteiraDomRenderizado = state.carteiraRendered?.rendered || 0;
      return r;
    };
  }catch(_){}
})();


/* ============================================================
   Atualização #724-2 — acabamento profissional estável
   ============================================================ */
(function(){
  if(window.__cp687Polish) return;
  window.__cp687Polish = true;
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const safe = (fn)=>{ try{return fn();}catch(e){ console.warn('687 polish', e); } };

  function ensureToastWrap(){
    let wrap = $('.cp687-toast-wrap');
    if(!wrap){ wrap=document.createElement('div'); wrap.className='cp687-toast-wrap'; document.body.appendChild(wrap); }
    return wrap;
  }
  window.cpToast = function(title, detail='', type='ok'){
    const wrap = ensureToastWrap();
    const el = document.createElement('div');
    el.className = 'cp687-toast ' + (type||'ok');
    const icon = type === 'err' ? '!' : (type === 'warn' ? '•' : '✓');
    el.innerHTML = `<i>${icon}</i><div><b>${title||'Pronto'}</b>${detail?`<small>${detail}</small>`:''}</div>`;
    wrap.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(8px)'; setTimeout(()=>el.remove(),220); }, 3400);
  };

  function notifyData(){
    const leads=(state?.todosLeads||state?.itemsAtivos||state?.leads||[]).filter(leadEhAtivo);
    const counts={agora:0,respondeu:0,programados:0,aguardando:0};
    for(const l of leads){const c=cp786Categoria(l);if(counts[c]!==undefined)counts[c]++;}
    const atrasados=leads.filter(l=>typeof cp786CompromissoAtrasado==='function'&&cp786CompromissoAtrasado(l)).length;
    return {total:leads.length,...counts,acao:counts.agora,atrasados};
  }
  function openNotifyPanel(){
    let panel=$('.cp687-notify-panel');
    if(!panel){panel=document.createElement('div');panel.className='cp687-notify-panel';document.body.appendChild(panel);}
    const d=notifyData();
    // v1010 — a fila do "Fazer agora" pausa no fim de semana (regra do dono, v914/v937); a
    // Central de atenção precisa contar a MESMA história da Condução, senão promete "31 pedem
    // ação", o dono abre a tela e encontra "nenhum" (aconteceu de verdade num sábado à noite).
    const fds = (typeof cpFimDeSemana==='function') && cpFimDeSemana();
    // v1012 — o sino nunca promete mais que a DOSE do dia (meta configurável no Cérebro).
    // Num sábado apareceu "34 atendimentos esperam por você na segunda" — 34 era o backlog
    // inteiro, mas na segunda a tela só entrega a dose (ex.: 10). O número do aviso agora é
    // min(meta, fila), a mesma conta do card "Fazer agora".
    // v1084 — o sino prometia um número que a lista não entregava. metaDia é a meta CRUA (nunca
    // desconta quem já foi atendido hoje) e d.agora é o backlog inteiro; já a lista que este
    // aviso abre mostra min(fila, meta − atendidos hoje). Depois de bater a meta o sino dizia
    // "10 atendimentos pedem ação" e o toque seguinte abria "Você já bateu a meta de hoje".
    // Agora o aviso é calculado exatamente com as mesmas funções da lista.
    const ativosSino = Array.isArray(state.itemsAtivos) ? state.itemsAtivos : [];
    const filaSino = (typeof cpFilaFazerAgora==='function') ? cpFilaFazerAgora(ativosSino) : [];
    const doseSino = (typeof cpFazerAgoraDose==='function') ? cpFazerAgoraDose(ativosSino) : 0;
    const doseAviso = Math.max(0, Math.min(filaSino.length, doseSino));
    const itemAcao = fds
      ? `<div class="cp687-notify-item" data-go="home" data-filter="agora"><i>✓</i><div><b>Hoje você não atende</b><span>${doseAviso?`${doseAviso} atendimento${doseAviso===1?' espera':'s esperam'} por você ${cpProximoDiaDeAtendimento()}.`:`O "Fazer agora" volta ${cpProximoDiaDeAtendimento()}.`}</span></div></div>`
      : `<div class="cp687-notify-item" data-go="home" data-filter="agora"><i>!</i><div><b>${doseAviso} atendimento${doseAviso===1?' pede':'s pedem'} ação</b><span>Abra a Condução para priorizar de cima para baixo.</span></div></div>`;
    panel.innerHTML=`
      <div class="cp687-notify-head"><div><h3>Central de atenção</h3><small>O que merece sua ação agora.</small></div><button class="cp687-notify-close" type="button" aria-label="Fechar">×</button></div>
      ${d.atrasados?`<div class="cp687-notify-item" data-go="agenda"><i>!</i><div><b>${d.atrasados} compromisso${d.atrasados===1?'':'s'} atrasado${d.atrasados===1?'':'s'}</b><span>Veja a lista na Agenda — retome ou descarte um a um.</span></div></div>`:''}
      ${itemAcao}
      <div class="cp687-notify-item" data-go="agenda"><i>⌁</i><div><b>${Math.max(0,(d.programados||0)-(d.atrasados||0))} na agenda</b><span>Compromissos com data marcada — hoje e próximos.</span></div></div>
      <div class="cp687-notify-item" data-go="relatorio"><i>▣</i><div><b>${d.total} clientes ativos</b><span>Acompanhe ritmo de atendimento e resultados.</span></div></div>`;
    panel.classList.add('open');
    panel.querySelector('.cp687-notify-close')?.addEventListener('click',()=>panel.classList.remove('open'));
    panel.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click',()=>{panel.classList.remove('open');const filtro=el.dataset.filter;if(filtro==='agora'&&typeof abrirFazerAgora==='function')abrirFazerAgora();else if(typeof window.show==='function')window.show(el.dataset.go);}));
    setTimeout(()=>document.addEventListener('click',outside,{once:true}),0);
    function outside(ev){if(!panel.contains(ev.target)&&!ev.target.closest('#topBell'))panel.classList.remove('open');}
  }
  function updateBell(){
    const badge = $('#bellBadge');
    const bell = $('#topBell');
    if(!badge || !bell) return;
    // O pontinho do sino reflete a AGENDA DE HOJE: aparece só quando há compromisso ou
    // lembrete para o dia (state.agendaCount, calculado em atualizarSinoAgenda). Sem agenda
    // hoje, sem pontinho. O sino leva direto para a Agenda.
    const n = Number(state.agendaCount) || 0;
    // v1093 — compromisso ATRASADO ganha destaque próprio. Pedido do dono: "está muito discreto
    // um compromisso que é importantíssimo". Sem atraso, segue o pontinho discreto de sempre;
    // COM atraso, o sino mostra o NÚMERO de atrasados e ganha a cor de risco.
    const atr = Number(state.agendaAtrasados) || 0;
    badge.hidden = !n;
    badge.textContent = atr > 0 ? String(atr) : '';
    bell.classList.toggle('tem-alerta', n > 0);
    bell.classList.toggle('tem-atraso', atr > 0);
    const label = atr > 0
      ? `Central de atenção — ${atr} compromisso${atr===1?'':'s'} ATRASADO${atr===1?'':'S'}`
      : n > 0
      ? `Central de atenção — ${n} compromisso${n===1?'':'s'} na agenda de hoje`
      : 'Central de atenção';
    bell.setAttribute('title', label);
    bell.setAttribute('aria-label', label);
  }
  window.cpAtualizarSinoAtencao = updateBell;

  function polishEmptyStates(root=document){
    const patterns = ['Nenhum lead perdido no momento.','Nada agendado.','Nenhum compromisso registrado','Nenhum lead marcado como atendido hoje ainda.','Nenhuma condição de pagamento definida.'];
    $$('div,td,p,span', root).forEach(el=>{
      // Hotfix 687-1: evita reprocessar o próprio estado vazio e seus filhos.
      // Sem essa proteção, o MutationObserver podia embrulhar o mesmo texto
      // repetidas vezes e gerar vários cards aninhados na tela.
      if(el.dataset.cp687Empty || el.closest('.cp-empty-premium')) return;
      const txt = (el.textContent||'').trim();
      if(!txt || txt.length>170) return;
      if(patterns.some(p=>txt.includes(p))){
        el.dataset.cp687Empty='1';
        el.classList.add('cp-empty-premium');
        el.innerHTML = `<span class="cp-empty-icon">✓</span><span><b>${txt.split('.')[0]}.</b><small>${txt.includes('Nada agendado')?'Quando houver retorno marcado, ele aparece aqui.': txt.includes('perdido')?'Quando um lead for marcado como perdido, ele aparece aqui para reabertura.':'O sistema vai atualizar este bloco automaticamente quando houver dados.'}</small></span>`;
      }
    });
  }

  function screenPolish(opts={}){
    const active = $('.screen.active');
    // Hotfix 687-2: não reaplica animação em toda mutação da tela.
    // A versão anterior removia/adicionava a classe cp687-screen-polish repetidamente,
    // causando tremor visual quando a Home recebia pequenos updates internos.
    const currentScreen = window.state?.active || active?.id || 'home';
    if(opts.animate && active && document.body.dataset.cpScreen !== currentScreen){
      active.classList.add('cp687-screen-polish');
      setTimeout(()=>active.classList.remove('cp687-screen-polish'), 240);
    }
    document.body.dataset.cpScreen = currentScreen;
    updateBell();
    polishEmptyStates(active||document);
  }

  const oldShow = window.show;
  if(typeof oldShow === 'function'){
    window.show = function(){
      const ret = oldShow.apply(this, arguments);
      requestAnimationFrame(()=>setTimeout(()=>screenPolish({animate:true}), 40));
      return ret;
    };
    // v1073 — ressincroniza o nome interno do módulo com a versão embrulhada. Antes isso era
    // feito (por acaso) pelos blocos mortos cp696/cp697/cp703, removidos nesta versão — sem esta
    // linha, chamadas internas tipo show("home") pulariam o polimento/sininho desta camada.
    try{ show = window.show; }catch(_){ }
  }
  const bell = $('#topBell');
  if(bell){
    bell.onclick = null;
    bell.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); openNotifyPanel(); }, true);
    bell.setAttribute('aria-label','Abrir central de atenção');
  }

  document.addEventListener('click', function(ev){
    const btn = ev.target.closest('button');
    if(!btn || btn.disabled) return;
    const label = (btn.textContent||'').trim().toLowerCase();
    if(/marcar atendimento|proposta feita|vendido|perdido|arquivar|adicionar observação|agendar retorno/.test(label)){
      btn.classList.add('cp687-pressed');
      setTimeout(()=>btn.classList.remove('cp687-pressed'),220);
    }
  }, true);

  document.addEventListener('submit', function(){ setTimeout(()=>window.cpToast && window.cpToast('Alteração registrada','Os dados foram atualizados com segurança.','ok'), 120); }, true);
  // Hotfix 687-2: evita observar o body inteiro continuamente.
  // Rodamos o polimento na carga e depois apenas quando a navegação chama show().
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>screenPolish({animate:false})); else screenPolish({animate:false});
})();


/* ============================================================
   Atualização #724-2 (reduzida na v1073) — só a parte viva do antigo "cp694":
   o embrulho de carregarDashboard que mostra o spinner "Carregando sua carteira..."
   na Home e um vigia de 9s com saída de emergência pra Atendimentos (a checagem
   homeAindaEmSkeleton, mais acima no arquivo, depende desse spinner existir).
   As gerações mortas de renderizadores da carteira e os "fixers" de
   layout redundantes que moravam aqui foram removidos.
   ============================================================ */
(function(){
  if(window.__cp694HotfixMobile) return;
  window.__cp694HotfixMobile = true;

  const oldDash = window.carregarDashboard || (typeof carregarDashboard === 'function' ? carregarDashboard : null);
  if(oldDash){
    window.carregarDashboard = async function(){
      const foco = document.querySelector('#leadFocoArea');
      if(state?.active === 'home' && foco && !foco.children.length){
        foco.innerHTML = '<div class="cp694-loading cp-loading-leads"><div class="cp-loading-spinner"></div><b>Carregando os leads…</b><span>Buscando sua carteira atualizada.</span></div>';
      }
      const watchdog = setTimeout(()=>{
        const area = document.querySelector('#leadFocoArea');
        if(state?.active === 'home' && area && /Carregando os leads/i.test(area.textContent||'')){
          area.innerHTML = '<div class="cp694-loading"><b>Carregamento demorou mais que o normal.</b><span>Atualize a página ou abra Atendimentos para continuar usando a carteira.</span><button type="button" onclick="show(\'carteira\')">Abrir Atendimentos</button></div>';
        }
      }, 9000);
      try{ return await oldDash.apply(this, arguments); }
      finally{ clearTimeout(watchdog); }
    };
    try{ carregarDashboard = window.carregarDashboard; }catch(_){ }
  }

  const css = document.createElement('style');
  css.id = 'cp694HotfixCSS';
  css.textContent = `
    #carteiraBody{padding-bottom:calc(130px + env(safe-area-inset-bottom,0px))!important}
    .cp694-loading{min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--text);text-align:center}.cp694-loading span{color:var(--muted);font-size:14px}.cp694-loading button{margin-top:10px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.04);color:var(--text);padding:10px 16px;font-weight:900}.cp694-spinner{width:30px;height:30px;border-radius:999px;border:3px solid rgba(255,255,255,.16);border-top-color:var(--lime);animation:cp694spin .8s linear infinite}@keyframes cp694spin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(css);
})();


/* ============================================================
   Atualização #724-2 (reduzida na v1073) — só o CSS vivo do antigo "cp695".
   As gerações mortas dos renders de Atendimentos/Condução que moravam aqui
   (substituídas pela versão final cp788 no fim do arquivo) foram removidas.
   O que fica é o que a tela atual ainda usa:
   - a trava de overflow/height (correção histórica de tela travada/rolagem presa);
   - o visual de .cp695-list/.cp695-empty/.cp695-loading (a lista da Condução/Atendimentos
     renderizada pelo cp788 usa exatamente essas classes);
   - o "+" preso dentro da barra de baixo (sem isso ele volta a flutuar solto);
   - o respiro de padding das telas Carteira/Condução no celular.
   ============================================================ */
(function(){
  if(window.__cp695RealMobileFix) return;
  window.__cp695RealMobileFix = true;
  const css=document.createElement('style');
  css.id='cp695RealMobileFixCSS';
  css.textContent=`
    html,body{height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;scroll-behavior:auto!important}
    .main-col,.desktop-layout,.app,.screen,#home,#carteira,#carteiraBody,.ui-priority-list,.cp695-list{height:auto!important;max-height:none!important;overflow:visible!important;overflow-y:visible!important;contain:none!important;transform:none!important;will-change:auto!important}
    .cp695-list{max-width:760px;margin-left:auto;margin-right:auto}
    .cp695-list{display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.10);border-radius:17px;background:rgba(7,52,64,.58);margin-bottom:calc(128px + env(safe-area-inset-bottom,0px));overflow:visible!important}.cp695-empty,.cp695-loading{padding:22px;color:var(--muted);text-align:center}
    .cp-bottom-nav{z-index:1000!important}.cp-bottom-nav .nav-inner,.bottom-nav .nav-inner{height:58px!important;align-items:center!important}.cp-bottom-nav .nav.fab,.bottom-nav .nav.fab{position:relative!important;height:56px!important;min-height:56px!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;overflow:visible!important;transform:none!important}.cp-bottom-nav .nav.fab .fab-btn,.bottom-nav .nav.fab .fab-btn{position:relative!important;top:0!important;left:0!important;transform:none!important;width:34px!important;height:34px!important;margin:0!important;border-width:2px!important;font-size:23px!important;font-weight:500!important;line-height:1!important;box-shadow:0 5px 12px rgba(0,0,0,.22)!important;z-index:1!important}.cp-bottom-nav .nav.fab .lbl,.bottom-nav .nav.fab .lbl{display:none!important;visibility:hidden!important}
    @media(max-width:760px){.screen#carteira.active{padding:18px 24px calc(96px + env(safe-area-inset-bottom,0px))!important;overflow:visible!important;height:auto!important;max-height:none!important}#carteiraBody{padding:0 6px!important}.ui-priority-card{padding:15px!important}.cp695-list{margin-bottom:calc(132px + env(safe-area-inset-bottom,0px))}}
  `;
  document.head.appendChild(css);
})();






/* ============================================================
   Atualização #724-2 — correção de versão exibida no topo/mobile
   - Garante que qualquer área do app que mostre "Atualização #" use o número atual.
   ============================================================ */
(function(){
  if(window.__cp698VersaoTopo) return;
  window.__cp698VersaoTopo = true;
  const VERSION = '__VERSION__';
  try{ window.CORRETOR_PRO_VERSION = VERSION; }catch(_){ }
  function fixVersionText(){
    try{
      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while(walker.nextNode()){
        const n = walker.currentNode;
        if(n && /Atualiza[cç][aã]o\s*#/i.test(n.nodeValue || '')) nodes.push(n);
      }
      nodes.forEach(n=>{
        n.nodeValue = String(n.nodeValue || '').replace(/Atualiza[cç][aã]o\s*#\d+(?:-\d+)?/ig, 'Atualização #__VERSION__');
      });
      document.querySelectorAll('[data-version],.sb-brand small,.cp-brand small,.brand small,.mobile-brand small,.top-brand small,.app-brand small,small').forEach(el=>{
        const txt = el.textContent || '';
        if(/Atualiza[cç][aã]o\s*#/i.test(txt)) el.textContent = txt.replace(/Atualiza[cç][aã]o\s*#\d+(?:-\d+)?/i, 'Atualização #__VERSION__');
      });
    }catch(_){ }
  }
  document.addEventListener('DOMContentLoaded', fixVersionText);
  window.addEventListener('load', fixVersionText);
  setTimeout(fixVersionText, 50);
  setTimeout(fixVersionText, 250);
  setTimeout(fixVersionText, 1000);
  // v1092 — o intervalo saiu de vez. Ele varria TODO o texto do documento a cada 30 segundos,
  // pra sempre, enquanto o app estivesse aberto — num aparelho que fica com o app aberto o dia
  // inteiro isso é trabalho contínuo à toa, competindo com o toque na tela. O número da versão é
  // gravado no HTML na hora de publicar (build.js troca __VERSION__), e os cinco gatilhos acima
  // (DOMContentLoaded, load e três tempos curtos) cobrem qualquer texto que chegue no
  // carregamento. Nada renderizado depois disso nasce com número velho.
})();



/* v1092 — o segundo bloco de correção da versão (o "#724-2") foi removido: ele era um
   SUBCONJUNTO EXATO do bloco acima — mesma atribuição de CORRETOR_PRO_VERSION e o mesmo passe de
   querySelectorAll, só que com menos gatilhos. Dois mecanismos fazendo a mesma coisa é a receita
   pra um deles ficar desatualizado sem ninguém notar. */





// Atualização #724-2: bloco antigo da tela orientada à ação removido; renderLeadFoco foi consolidado na função principal.


/* Atualização #786 — condução diária sem aparência de CRM */
(function(){
  const css=document.createElement('style');
  css.id='cp786ConducaoCSS';
  css.textContent=`
    .cp786-action-tabs{overflow-x:auto;scrollbar-width:none}.cp786-action-tabs::-webkit-scrollbar{display:none}.cp786-action-tabs button{white-space:nowrap}.cp786-action-kpis .ui-kpi{cursor:pointer}.cp786-action-kpis .ui-kpi span{font-size:12px!important}
    #relatorio .cp-dashboard-continue{width:100%;display:flex!important;align-items:center;justify-content:space-between;gap:12px;margin:14px 0 0;padding:13px 16px;border:1px solid rgba(255,98,88,.36);border-radius:13px;background:rgba(255,98,88,.07);color:var(--lime);font:inherit;font-size:13px;font-weight:950;cursor:pointer}#relatorio .cp-dashboard-continue b{font-size:20px;line-height:1}
    @media(max-width:760px){.cp786-action-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}.cp786-action-kpis .ui-kpi{min-width:0!important}.cp786-action-kpis .ui-kpi span{white-space:normal;line-height:1.1}}
  `;
  document.head.appendChild(css);
})();

/* Atualização #789 — limpeza da tela Atendimentos e correção da navegação em “O que a IA aprendeu”. */

/* ============================================================
   ATUALIZAÇÃO #788 — separação definitiva entre condução e histórico
   - Hoje mostra somente quem exige ação agora.
   - Condução organiza a próxima ação e mantém a carteira ativa como visão secundária.
   - Atendimentos mostra apenas contatos realmente registrados, do mais recente ao mais antigo.
   ============================================================ */
(function(){
  if(window.__cp788ConducaoHistorico) return;
  window.__cp788ConducaoHistorico = true;

  const esc = (v)=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function cp788EventoAtendimento(lead){
    const eventos=Array.isArray(lead?.analysis?.aprendizado?.eventos)?lead.analysis.aprendizado.eventos:[];
    let melhor=null;
    for(const evento of eventos){
      if(evento?.evento!=='contato_manual'||!evento?.quando) continue;
      const ts=typeof cp786DataTs==='function'?cp786DataTs(evento.quando):new Date(evento.quando).getTime();
      if(!Number.isFinite(ts)||ts<=0) continue;
      if(!melhor||ts>melhor.ts) melhor={evento,ts};
    }
    return melhor;
  }

  // (v908) cp788TempoAtendimento / cp788LinhaAtendimento removidas: a tela Atendimentos virou
  // colunas por dia (o nome não mostra mais "atendido há X" nem o produto — o dia é a coluna).

  async function cp788CarregarBase(force=false){
    let data=null;
    try{ data=await getLeadsData(!!force); }catch(_){ data=null; }
    const listas=[data?.items,state?.todosLeads,state?.itemsAtivos,state?.carteiraLeads].filter(Array.isArray);
    const leads=(listas.sort((a,b)=>b.length-a.length)[0]||[]).map(typeof limparLead==='function'?limparLead:(x=>x));
    if(leads.length){
      state.todosLeads=leads;
      state.carteiraLeads=leads;
    }
    return leads;
  }

  // Meta do dia gamificada: um prédio que "sobe" (enche de coral, de baixo pra cima) conforme
  // os atendimentos do dia, completando a imagem ao bater a META (10). Coral = identidade do app.
  const CP788_META_DIA = 10;
  function cp788PredioSVG(count, meta){
    const p = Math.min(Math.max(Number(count)||0, 0) / meta, 1);
    const topY = 16, botY = 176, H = botY - topY;
    const yStart = (botY - p*H).toFixed(1), h = (p*H).toFixed(1);
    const cols = [44,58,72], rows = [26,40,54,68,82,96,110,124,138];
    let wins = '';
    for(const y of rows) for(const x of cols) wins += `<rect x="${x}" y="${y}" width="9" height="9" rx="1.5" fill="#eef4f6" opacity=".9"/>`;
    const body = '<rect x="36" y="16" width="48" height="146" rx="5"/><rect x="22" y="160" width="76" height="16" rx="3"/>';
    const id = 'cp788pd' + Math.random().toString(36).slice(2,7);
    return `<svg class="cp788-predio${count>=meta?' cheio':''}" width="112" height="178" viewBox="0 0 120 190" aria-hidden="true">`
      + `<defs><clipPath id="${id}"><rect x="0" y="${yStart}" width="120" height="${h}"/></clipPath></defs>`
      + `<g fill="rgba(255,255,255,.09)">${body}</g>`
      + `<g fill="var(--accent)" clip-path="url(#${id})">${body}</g>`
      + wins + `</svg>`;
  }

  function cp788RenderAtendimentos(leads){
    const box=document.querySelector('#carteiraBody');
    if(!box) return;
    const registros=[];
    for(const lead of (Array.isArray(leads)?leads:[])){
      const ultimo=cp788EventoAtendimento(lead);
      if(ultimo) registros.push({lead,evento:ultimo.evento,ts:ultimo.ts});
    }
    registros.sort((a,b)=>b.ts-a.ts||String(a.lead?.name||'').localeCompare(String(b.lead?.name||''),'pt-BR'));
    // v908 — tela reorganizada POR DIA (últimos 7 dias): cada coluna tem o prediozinho da meta em
    // cima e, embaixo, os clientes atendidos naquele dia (só o nome — sem "atendido há X" nem produto,
    // porque o dia já está na coluna).
    const CP788_DIAS_SEM=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const hoje0=(typeof inicioDoDiaBR==='function')?inicioDoDiaBR():new Date(new Date().setHours(0,0,0,0));
    const perDay=[];
    for(let i=0;i<7;i++){
      const d=new Date(hoje0); d.setDate(d.getDate()-i);
      const dd=String(d.getDate()).padStart(2,'0'), mm=String(d.getMonth()+1).padStart(2,'0');
      const label=i===0?'Hoje':i===1?'Ontem':CP788_DIAS_SEM[d.getDay()];
      perDay.push({ label, data:`${dd}/${mm}`, itens:[] });
    }
    for(const x of registros){
      let d=null; try{ d = (typeof diasCalendarioBR==='function') ? diasCalendarioBR(new Date(x.ts)) : null; }catch(_){ d=null; }
      if(d!=null && d>=0 && d<7) perDay[d].itens.push(x);
    }
    const totalSemana=perDay.reduce((s,p)=>s+p.itens.length,0);
    box.innerHTML=`<section class="cp788-att-page">
      <header class="cp788-att-head">
        <div><h2>Atendimentos</h2><p>Últimos 7 dias · ${totalSemana} atendimento${totalSemana===1?'':'s'} · meta ${CP788_META_DIA}/dia</p></div>
      </header>
      ${totalSemana?`<div class="cp788-days">
        ${perDay.map((p)=>{
          const n=p.itens.length, bateu=n>=CP788_META_DIA;
          const nomes=n?p.itens.map(x=>`<button type="button" class="cp788-day-name" onclick='abrirLead(${JSON.stringify(String(x.lead?.id||''))})'>${esc(x.lead?.name||'Cliente')}</button>`).join(''):'<div class="cp788-day-empty">—</div>';
          return `<div class="cp788-day${bateu?' done':''}">
            <div class="cp788-day-head"><b>${esc(p.label)}</b><span>${esc(p.data)}</span></div>
            ${cp788PredioSVG(n, CP788_META_DIA)}
            <div class="cp788-day-count${bateu?' done':''}"><b>${n}</b>/${CP788_META_DIA}</div>
            <div class="cp788-day-list">${nomes}</div>
          </div>`;
        }).join('')}
      </div>`:`<div class="cp788-att-empty"><b>Nenhum atendimento registrado ainda.</b><span>Quando você copiar uma mensagem enviada ou marcar um cliente como atendido, ele aparecerá aqui no dia respectivo.</span></div>`}
    </section>`;
  }

  // (v908) cp788MostrarMaisAtendimentos removida: a tela por dia mostra todos os nomes de cada dia.

  window.carregarCarteira=async function(force){
    const box=document.querySelector('#carteiraBody');
    if(box) box.innerHTML='<div class="cp788-att-loading"><i></i><b>Carregando atendimentos...</b><span>Ordenando pelos últimos contatos registrados.</span></div>';
    const leads=await cp788CarregarBase(!!force);
    cp788RenderAtendimentos(leads);
  };
  try{ carregarCarteira=window.carregarCarteira; }catch(_){ }
  window.renderCarteiraTabela=function(){
    const base=[state?.todosLeads,state?.carteiraLeads,state?.itemsAtivos].find(a=>Array.isArray(a)&&a.length)||[];
    cp788RenderAtendimentos(base);
  };

  function cp788Grupos(leads){
    const grupos={agora:[],respondeu:[],programados:[],aguardando:[],todos:[]};
    for(const l of (Array.isArray(leads)?leads:[])){
      if(typeof leadEhAtivo==='function'&&!leadEhAtivo(l)) continue;
      grupos.todos.push(l);
      const c=typeof cp786Categoria==='function'?cp786Categoria(l):'aguardando';
      if(grupos[c]) grupos[c].push(l);
    }
    for(const k of ['agora','respondeu','programados','aguardando']) grupos[k]=typeof cp786OrdenarConducao==='function'?cp786OrdenarConducao(grupos[k]):grupos[k];
    grupos.todos=typeof cp786OrdenarConducao==='function'?cp786OrdenarConducao(grupos.todos):grupos.todos;
    return grupos;
  }

  window.renderListasHome=function(ordenados){
    const foco=document.querySelector('#leadFocoArea'); if(!foco) return;
    const area=document.querySelector('#top3Area'); if(area){area.style.display='none';area.innerHTML='';}
    const fila=document.querySelector('#filaPrioridade'); if(fila){fila.style.display='none';fila.innerHTML='';}
    const ativos=(ordenados||[]).filter(typeof leadEhAtivo==='function'?leadEhAtivo:()=>true);
    const grupos=cp788Grupos(ativos);
    const fontePrioridades=grupos.agora.length?grupos.agora:grupos.programados;
    const prioritarios=fontePrioridades.slice(0,4);
    const filtroPrincipal=grupos.agora.length?'agora':grupos.programados.length?'programados':'aguardando';
    state.gruposHome={
      respondeu:grupos.respondeu,agora:grupos.agora,programados:grupos.programados,aguardando:grupos.aguardando,todos:ativos,
      hoje:[...grupos.respondeu,...grupos.agora],retomada:grupos.agora,'acao-hoje':[...grupos.respondeu,...grupos.agora],
      'retomar-cuidado':[],'boa-sem-urgencia':[],'pode-aguardar':grupos.aguardando,'baixa-prioridade':[],
      'tratado-hoje':ativos.filter(l=>typeof ehContatadoHoje==='function'&&ehContatadoHoje(l))
    };
    if(state.grupoAtivo||state.focoLeadId||state.lead?.id) return;
    // v865: a tela inicial volta a ser a "rica" (renderBotoesHome: hero "Prioridade agora",
    // fila de próximos e "Top conversão"), no lugar da lista enxuta — que causava o PISCAR:
    // a rica era pintada no boot e o carregarDashboard chamava esta função, que a substituía
    // pela enxuta. Agora as duas pintam a mesma coisa. renderBotoesHome usa exatamente o
    // state.gruposHome montado logo acima (mesmas chaves acao-hoje/retomar-cuidado/retomada).
    if(typeof renderBotoesHome==='function') renderBotoesHome();
  };
  try{ renderListasHome=window.renderListasHome; }catch(_){ }
  // v1073 — o re-wire de #cpNewLeads foi removido: esse id não existe em lugar nenhum desde a
  // v928 (o card "Total de leads" já abre a lista "Carteira ativa" direto no onclick).
})();
