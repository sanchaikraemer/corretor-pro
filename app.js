import { state } from './js/state.js?v=__VERSION__';
import { qs, qsa, isDesktop, escapeHtml, safeJson, toast } from './js/dom.js?v=__VERSION__';
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
    const headers = new Headers((init && init.headers) || (typeof input !== "string" && input?.headers) || {});
    if (key && !headers.has("X-Corretor-Pro-Key")) headers.set("X-Corretor-Pro-Key", key);
    const res = await originalFetch(input, { ...init, headers });
    if (res.status === 401) {
      const nova = window.definirChaveSegurancaCorretorPro();
      if (nova && nova !== key) {
        const retryHeaders = new Headers(headers);
        retryHeaders.set("X-Corretor-Pro-Key", nova);
        const retry = await originalFetch(input, { ...init, headers: retryHeaders });
        agendarAprendizadoDepoisDaMutacao(input, init, retry);
        return retry;
      }
    }
    agendarAprendizadoDepoisDaMutacao(input, init, res);
    return res;
  };
})();

const KEEP_RE = /\.(txt|opus|ogg|mp3|m4a|wav|aac)$/i;

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
    renderPipelineMs: cpPerfMedia("renderPipeline"),
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
      <b>Render pipeline:</b> ${Number(r.renderPipelineMs||0)} ms<br>
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
const LEADS_CACHE_TTL = 300000; // 5 min
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
  try{ return await restaurarLeadsAntigos(false); }catch(_){ return null; }
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
  const n = Number(l?.messageCount);
  return Number.isFinite(n) ? n : (Array.isArray(l?.recentMessages) ? l.recentMessages.length : 0);
}
function leadTemProposta(l){
  return l?.hasProposal === true || (Array.isArray(l?.recentMessages) && l.recentMessages.some(m => m && m.proposta));
}
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
    if(patch.avatarFoto){
      it.avatarFoto = patch.avatarFoto;
      it.analysis = it.analysis || {};
      it.analysis.avatarFoto = patch.avatarFoto;
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

// ===== Aparência: somente Tema claro e Tema escuro =====
const DIRECIONA_THEME_KEY = "direciona_tema";
function temaDirecionaAtual(){
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function sincronizarControlesTema(){
  const atual = temaDirecionaAtual();
  qsa("[data-theme-choice]").forEach(btn => {
    const ativo = btn.dataset.themeChoice === atual;
    btn.setAttribute("aria-pressed", ativo ? "true" : "false");
    btn.classList.toggle("active", ativo);
  });
  const rotulo = qs("#themeCurrentLabel");
  if(rotulo) rotulo.textContent = atual === "light" ? "Tema claro" : "Tema escuro";
}
function aplicarTemaDireciona(tema, salvar=true){
  const proximo = tema === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = proximo;
  document.documentElement.style.colorScheme = proximo;
  if(salvar){
    try{ localStorage.setItem(DIRECIONA_THEME_KEY, proximo); }catch(_){ }
  }
  const meta = qs("#themeColorMeta");
  if(meta) meta.setAttribute("content", proximo === "light" ? "#F3F6F7" : "#052B36");
  sincronizarControlesTema();
}
function configurarEscolhaTema(){
  aplicarTemaDireciona(temaDirecionaAtual(), false);
  qsa("[data-theme-choice]").forEach(btn => {
    btn.addEventListener("click", () => {
      aplicarTemaDireciona(btn.dataset.themeChoice, true);
      toast(btn.dataset.themeChoice === "light" ? "Tema claro aplicado." : "Tema escuro aplicado.");
    });
  });
}
window.aplicarTemaDireciona = aplicarTemaDireciona;

const VIEW_CACHEABLE = new Set(["pipeline","agenda","vendas","perdidos","geladeira","relatorio","carteira"]);
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
        if(t === "home") await carregarDashboard();
        else if(t === "pipeline") await carregarPipeline();
        else if(t === "agenda") await carregarAgenda();
        else if(t === "cerebro"){
          await carregarCerebro();
          await carregarAprendizado();
          icTab(state.icTabAtiva === "aprendizado" ? "aprendizado" : "cerebro", true);
        }
        else if(t === "vendas") await carregarVendas();
        // "perdidos" e "geladeira" apontam pro MESMO lugar agora: a Geladeira única.
        else if(t === "perdidos" || t === "geladeira") await carregarGeladeira();
        else if(t === "aprendizado") await carregarAprendizado();
        else if(t === "relatorio") await carregarRelatorio(force);
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
    pipelineFiltro:state.pipelineVisualFiltro || "todos",
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
      if(r.pipelineFiltro) state.pipelineVisualFiltro=r.pipelineFiltro;
      if(r.grupoAtivo) state.grupoAtivo=r.grupoAtivo;
      await abrirLead(r.leadId,{fromHistory:true});
      return;
    }
    cpClearLeadState();
    state.grupoAtivo=null;
    if(r.carteiraFiltro) state.carteiraFiltro=r.carteiraFiltro;
    if(r.pipelineFiltro) state.pipelineVisualFiltro=r.pipelineFiltro;
    show(r.screen || "home",{navKey:r.navKey,skipHistory:true});
    if((r.screen||"home") === "home" && r.grupoAtivo){
      state.grupoAtivo=r.grupoAtivo;
      abrirGrupoHome(r.grupoAtivo,{fromHistory:true});
    } else if((r.screen||"home") === "home") {
      renderBotoesHome();
    }
  } finally { cpApplyingHistory=false; }
}
window.addEventListener("popstate",e=>{ cpRestoreRoute(e.state).catch(err=>console.warn("popstate",err)); });
window.cpPushTransientRoute=cpPushTransientRoute;
window.cpConsumeTransientRoute=cpConsumeTransientRoute;

function show(t, options={}){
  const prev = state.active;
  const defaultNavKey = {home:"home",carteira:"leads",propostas:"imoveis",pipeline:"negocios",agenda:"agenda",relatorio:"relatorios",menu:"config"}[t] || t;
  state.navKey = options.navKey || defaultNavKey;
  state.active=t;
  if(!options.skipHistory && !cpApplyingHistory && prev !== t){
    cpPushRoute(cpRouteForScreen(t));
  }
  // A "Geladeira" não é uma tela própria: mora dentro da seção #perdidos (o balde único
  // de leads fora do pipeline). Sem esse alias, show("geladeira") tentava ativar um
  // #geladeira inexistente e o corretor caía numa tela em branco (os leads nunca apareciam).
  const secId = (t === "geladeira") ? "perdidos" : t;
  if(!isDesktop()){
    qsa(".screen").forEach(e=>e.classList.remove("active"));
    qs("#"+secId)?.classList.add("active");
  }else{
    const escondidas = ["menu","cerebro","vendas","pipeline","agenda","zip","linhaTempo","perdidos","geladeira","aprendizado","propostas","relatorio","carteira"];
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
  destacarMenuPipeline();
  if(!options.skipLoad) carregarTelaAtiva(t, false);
}
window.show = show;
// A tela "pipeline" tem 2 portas no menu: "Carteira" (aba oportunidades) e "Últimos atendimentos"
// (aba ultimos). Destaca a porta certa conforme a aba ativa, em vez de acender sempre a Carteira.
function destacarMenuPipeline(){
  const ehUlt = pipelineTabAtiva === "ultimos";
  qsa(".sb-item,.nav").forEach(b=>{
    if(b.dataset.tab === "ultimos") b.classList.toggle("active", ehUlt && state.active === "pipeline");
    else if(b.dataset.target === "pipeline") b.classList.toggle("active", !ehUlt && state.active === "pipeline");
  });
}
window.destacarMenuPipeline = destacarMenuPipeline;
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
// Abas internas do menu "Arquivo": Perdidos x Geladeira (congelados).
function arqTab(which){
  const perd = which !== "geladeira";
  const gp = qs("#arqPerdidos"), gg = qs("#arqGeladeira");
  if(gp) gp.style.display = perd ? "" : "none";
  if(gg) gg.style.display = perd ? "none" : "";
  const bp = qs("#arqTabPerdidos"), bg = qs("#arqTabGeladeira");
  [[bp,perd],[bg,!perd]].forEach(([b,on])=>{ if(!b) return; b.style.borderColor = on?"var(--lime)":"var(--line)"; b.style.background = on?"rgba(255,98,88,.15)":"transparent"; b.style.color = on?"var(--lime)":"var(--muted)"; });
}
window.arqTab = arqTab;
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
function renderLeads(){
  const baseLead = state.lead || state.leads[0] || null;
  let html = '<div class="empty">Nenhum atendimento real carregado ainda.<br>Importe uma conversa do WhatsApp para começar.</div>';
  if(state.leads.length){
    const selId = state.lead?.id ? String(state.lead.id) : null;
    html = state.leads.slice(0,8).map(item => {
      const idStr = String(item.id||"");
      const ehSel = selId && idStr === selId;
      const idJs = JSON.stringify(idStr);
      const novo = "";
      const contato = ehContatadoHoje(item) ? ` <span style="color:var(--acao);font-size:11px">✓</span>` : "";
      const esfri = !ehContatadoHoje(item) && ehEsfriando(item) ? ` <span style="color:var(--risco);font-size:11px"></span>` : "";
      return `<div class="lead" ${idStr ? `onclick='abrirLead(${idJs})' style="cursor:pointer${ehSel?";border-color:var(--lime);background:rgba(255,98,88,.06)":""}"`:""}>
        <div style="flex:1;min-width:0">
          <strong>${escapeHtml(item.name||"Cliente importado")}${novo}${contato}${esfri}</strong>
          <div class="small">${escapeHtml(produtosLabel(item))}${item.daysSinceLastInteraction!=null?" · "+item.daysSinceLastInteraction+"d":""}</div>
        </div>
      </div>`;
    }).join("");
  }
  const el1 = qs("#leadList"); if(el1) el1.innerHTML=html;
  const el2 = qs("#mobileLeadList"); if(el2) el2.innerHTML=html;
  const elTime = qs("#bestTime"); if(elTime) elTime.textContent=baseLead?baseLead.bestTime:"--";
}
function clearAnalysis(){
  state.lead=null;
  state.focoLeadId=null;
  if(window._colarAvatarHandler){ document.removeEventListener("paste", window._colarAvatarHandler); window._colarAvatarHandler=null; }
  state.analysis=null;
  state.msgStyle="direta";
  qs("#zipInput").value="";
  qs("#fileName").textContent="";
  qs("#fileName").classList.remove("show");
  qs("#processingBox").classList.remove("show");
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
  renderLeads();
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
      renderLeads();
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
    const scored = items.filter(l => l.id && (!leadAtual?.id || String(l.id) !== String(leadAtual.id)) && normalizarEtapa(l.etapa) !== "Geladeira").map(l => {
      let score = 0;
      const e = normalizarEtapa(l.etapa);
      // Etapa avançada vale mais (já fechou ou está perto)
      if(e === "Vendido") score += 30;
      else if(e === "Negociação") score += 18;
      else if(e === "Visita/Proposta") score += 10;
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

function analiseComercialPrincipalHTML(a){
  a = a || {};
  const ac = (a.analiseComercial && typeof a.analiseComercial === "object") ? a.analiseComercial : null;
  const camposObrigatorios = ac ? [
    ac.ultimaPessoaFalar,
    ac.ultimoCompromissoCliente,
    ac.ultimaInformacaoPrometida,
    ac.produtoPrincipalInteresse,
    ac.objecaoPrincipal,
    ac.pendenciaFinanceira,
    ac.proximoPassoDeQuem,
    ac.etapaFunil,
    ac.nivelInteresse,
    ac.percepcaoTodaConversa,
    ac.mensagemIdealHoje
  ].filter(v => String(v || "").trim()) : [];

  if(!ac || !camposObrigatorios.length){
    return `<section style="border:1px solid rgba(255,155,59,.45);border-radius:14px;padding:13px;background:rgba(255,155,59,.07)">
      <div style="font-size:15px;font-weight:950;color:#fff">Diagnóstico comercial completo</div>
      <div style="margin-top:6px;color:var(--soft);font-size:12px;line-height:1.45">Este lead ainda está com a análise antiga. Toque em <b style="color:var(--morno)">Reanalisar</b> para gerar a leitura completa da conversa e as mensagens comerciais.</div>
    </section>`;
  }

  const paralelos = Array.isArray(ac.produtosParalelosApresentados)
    ? ac.produtosParalelosApresentados.join(" · ")
    : ac.produtosParalelosApresentados;
  const itens = [
    ["1. Última pessoa a falar", ac.ultimaPessoaFalar],
    ["2. Último compromisso assumido pelo cliente", ac.ultimoCompromissoCliente],
    ["3. Última informação prometida", ac.ultimaInformacaoPrometida],
    ["4. Produto principal de interesse", ac.produtoPrincipalInteresse],
    ["5. Produtos paralelos apresentados", paralelos || "Nenhum"],
    ["6. Objeção principal", ac.objecaoPrincipal],
    ["7. Permuta / entrada com imóvel", ac.pendenciaFinanceira],
    ["8. Próximo passo é de quem", ac.proximoPassoDeQuem],
    ["9. Etapa do funil", ac.etapaFunil],
    ["10. Nível de interesse", ac.nivelInteresse]
  ];
  const linhas = itens.map(([lab,val]) => `<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06)">
    <div style="font-size:10px;line-height:1.25;letter-spacing:.08em;text-transform:uppercase;font-weight:950;color:var(--muted)">${escapeHtml(lab)}</div>
    <div style="margin-top:4px;font-size:13px;line-height:1.45;color:var(--text)">${escapeHtml(String(val || "Não identificado"))}</div>
  </div>`).join("");
  const bloco = (titulo, valor, destaque) => valor ? `<div style="margin-top:10px;padding:11px 12px;border:1px solid ${destaque ? 'rgba(255,98,88,.35)' : 'var(--line)'};border-radius:11px;background:${destaque ? 'rgba(255,98,88,.06)' : 'rgba(255,255,255,.025)'}">
    <div style="font-size:10px;line-height:1.25;letter-spacing:.08em;text-transform:uppercase;font-weight:950;color:${destaque ? 'var(--lime)' : 'var(--muted)'}">${escapeHtml(titulo)}</div>
    <div style="margin-top:5px;font-size:13px;line-height:1.5;color:#fff;white-space:pre-wrap">${escapeHtml(String(valor))}</div>
  </div>` : "";

  return `<section style="border:1px solid rgba(0,212,255,.28);border-radius:14px;padding:13px;background:linear-gradient(180deg,rgba(0,212,255,.055),rgba(255,255,255,.018))">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <div style="font-size:16px;font-weight:950;color:#fff">Diagnóstico comercial completo</div>
      <span style="padding:3px 8px;border:1px solid rgba(0,212,255,.35);border-radius:999px;color:var(--cyan);font-size:9px;font-weight:950;letter-spacing:.08em;text-transform:uppercase">análise da conversa inteira</span>
    </div>
    <div style="margin-top:7px">${linhas}</div>
    ${bloco("O que o Corretor Pro percebeu analisando toda a conversa", ac.percepcaoTodaConversa, false)}
    ${bloco("Mensagem que eu enviaria hoje", ac.mensagemIdealHoje, true)}
  </section>`;
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
// conversa forte, mas ficavam escondidos por estarem em etapa baixa ou sem lembrete.
function sinaisPrioridadeComercial682(l){
  const a = l?.analysis || {};
  const txt = textoSinais(l);
  const e = normalizarEtapa(l?.etapa);
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

  const compradorReal = compradorKeywords.test(txt) || ["Visita/Proposta","Negociação"].includes(e);
  const curioso = curiosoKeywords.test(txt) && !/(proposta|simula|entrada|parcela|visita|unidade|financi|reserva|fechar)/.test(txt);
  const urgencia = urgenciaKeywords.test(txt) || Array.isArray(a.confirmedAppointments) && a.confirmedAppointments.length > 0;
  const objecao = objecaoKeywords.test(txt);
  const pendencia = pendenciaKeywords.test(txt);
  // Caso tipo Isabela: muito sinal comercial espalhado na conversa, mas etapa ainda "Atendimento".
  const quenteEscondido = compradorReal && !curioso && e === "Atendimento" && diasDistintos >= 3 && /(entrada|parcela|financi|simula|proposta|unidade|visita|valor|planta|metragem|box|vaga)/.test(txt);

  const motivos = [];
  if(quenteEscondido) motivos.push("oportunidade com sinais fortes: conversa forte mesmo ainda em Atendimento");
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
  if(f.negociacaoAguardando)  return { nivel:4, grupo:"acao-hoje", titulo:"Negociação aguardando você" };
  if(f.compromissoProgramado) return { nivel:5, grupo:"acao-hoje", titulo:"Atendimento programado" };
  if(f.clientePediuTempo)     return { nivel:0, grupo:"pode-aguardar", titulo:"Cliente pediu para aguardar" };
  if(f.emJanela)              return { nivel:7, grupo:"pode-aguardar", titulo:"Aguardando resposta" };
  if(f.travaExterna && !f.pendenciaCorretor) return { nivel:0, grupo:"boa-sem-urgencia", titulo:"Boa oportunidade, sem urgência" };
  if(f.retomadaPorTempo)      return { nivel:6, grupo:"retomar-cuidado", titulo:"Retomar com cuidado" };
  return { nivel:0, grupo:"baixa-prioridade", titulo:"Baixa prioridade" };
}

// PRIORIDADE DE ATENDIMENTO — separada da chance de venda.
// Chance de venda responde: "esse lead pode comprar?"
// Prioridade de atendimento responde: "vale falar com ele AGORA?"
function prioridadeAtendimento(l){
  const e = normalizarEtapa(l.etapa);
  if(e === "Vendido" || e === "Perdido" || e === "Geladeira") {
    return { score:-999, grupo:"baixa-prioridade", titulo:"Fora da fila", motivo:"lead finalizado ou arquivado" };
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
  const temAgenda = Array.isArray(a.confirmedAppointments) && a.confirmedAppointments.length > 0;
  const etapaAvancada = ["Visita/Proposta","Negociação"].includes(e);
  const tipo = String(a.tipoRetomada||"").toLowerCase();
  const ctxIA = contextoPrioridadeIA(l);
  const negociacaoAguardandoRetorno = !!(ctxIA.retornoProposta && (ctxIA.propostaAtiva || etapaAvancada));
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
  const compromissoProgramado = temAgenda ||
    (Array.isArray(a.confirmedAppointments) && a.confirmedAppointments.some(ap => /\b(hoje|amanh[ãa])\b/.test(String(ap.quando || "").toLowerCase())));
  const retomadaPorTempo = Number.isFinite(diasContato) && diasContato >= limiarRetomada(l);
  // "Cliente respondeu e ainda não recebeu resposta": o cliente falou por último.
  const clienteAguardandoVoce = ultimoCliente;
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
// Isso evita caso como Jessica aparecer como maior avanço comercial só por ter lembrete/retomada.
// Lead em viabilidade financeira continua importante, mas fica abaixo de quem já visitou,
// recebeu proposta/simulação ou está comparando decisão.
function scoreConversaoHoje(l){
  const a = l?.analysis || {};
  const e = normalizarEtapa(l?.etapa);
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
  const viabilidadeAntesDaProposta = travaFinanceira && !propostaOuSimulacao && !["Visita/Proposta","Negociação"].includes(e);
  const clientePediuTempo = /vou pensar|vou analisar|estamos analisando|vou conversar|vou ver com|te aviso|te retorno|qualquer coisa te chamo|mais pra frente|semana que vem|m[êe]s que vem/.test(txt);
  const parceiro = /parceir|corretor/i.test(String(a.tipoContato||""));

  let score = 0;

  // Etapa pesa mais para CONVERSÃO do que para simples atendimento.
  if(e === "Negociação") score += 30;
  else if(e === "Visita/Proposta") score += 24;
  else if(e === "Atendimento") score += 4;

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
  // Ex.: Jessica: boa prioridade, mas não deve superar proposta/visita/simulação.
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
  const business = /(senger|construtora|corretor|imobili|direciona|atendimento|sistema)/i;
  const cont = new Array(24).fill(0);
  let achou = false;
  for(const m of msgs){
    const autor = String(m.author||"").trim();
    if(!autor) continue;
    const ehCliente = nome ? autor.toLowerCase().includes(nome) : !business.test(autor);
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
  const business = /(senger|construtora|corretor|imobili|direciona|atendimento|sistema)/i;
  let maxTs = 0;
  for(const m of msgs){
    if(somenteCliente){
      const autor = String(m.author||"").trim();
      if(!autor) continue;
      const ehCliente = nome ? autor.toLowerCase().includes(nome) : !business.test(autor);
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

function motivoPrioridade(l){
  const a = l.analysis || {};
  const e = normalizarEtapa(l.etapa);
  const dias = Number(l.daysSinceLastInteraction);
  const partes = [];
  const sc682 = sinaisPrioridadeComercial682(l);
  if(sc682.quenteEscondido) partes.push("oportunidade com sinais fortes: há sinais fortes de compra mesmo sem etapa avançada");
  else if(sc682.compradorReal && !sc682.curioso) partes.push("sinais de comprador real");
  if(sc682.curioso && !sc682.compradorReal) partes.push("parece curioso/pesquisa inicial");
  if(sc682.urgencia) partes.push("há urgência ou compromisso próximo");
  if(sc682.objecao) partes.push("objeção identificada para tratar");

  // SINAL COMERCIAL primeiro — o motivo de verdade pra atender (ou não) hoje.
  const txt = textoSinais(l);
  const ctxIA = contextoPrioridadeIA(l);
  const negociacaoAguardandoRetorno = !!(ctxIA.retornoProposta && (ctxIA.propostaAtiva || ["Visita/Proposta","Negociação"].includes(e)));
  let jaFalouDoTempo = false; // evita repetir "X dias" no motivo quando já citei no contexto de retomada

  if(negociacaoAguardandoRetorno){
    partes.push(ctxIA.contatoParceiro
      ? "corretor parceiro ficou de apresentar a condição ao cliente final — cobrar retorno da proposta"
      : "condição/proposta apresentada — cobrar retorno sem reiniciar descoberta");
    jaFalouDoTempo = true;
  }
  // Quem ficou de retornar é o CLIENTE? (ele disse que ia calcular/definir/avisar, ou a
  // ação minha é CONDICIONAL a ele: "montar simulação ASSIM QUE ela definir os valores").
  // Nesse caso NÃO posso dizer "você ficou de retornar algo" — a bola está com o cliente.
  const clienteRetorna = /assim que\b[^·.]{0,60}(definir|calcular|passar|avisar|decidir|retornar|conversar|me (avisar|chamar))|\b(cliente|ela|ele|eles|noiv[oa]|o casal|voc[êe]s|vcs)\b[^·.]{0,30}(vai|v[ãa]o|ficou de|ficaram de|disse que (vai|ia))[^·.]{0,30}(calcular|definir|avisar|retornar|chamar|procurar|pensar|me (avisar|chamar))|\b(te|lhe|me)\s+(aviso|avisa|chamo|chama|retorno|retorna|ligo|liga)\s+(quando|assim que|depois)|quando\b[^·.]{0,40}(definir|calcular|tiver os valores|decidir)/.test(txt);
  // A IA (diagnóstico) manda na direção de quem deve o próximo passo — a regex acima é só fallback
  // pra quando a IA não disse. Isso corrige o "você ficou de retornar" invertido.
  const quemDeve = String((a.diagnostico && a.diagnostico.quemDeveProximoPasso) || "").toLowerCase();
  const bolaCliente = quemDeve === "cliente" ? true : quemDeve === "corretor" ? false : clienteRetorna;
  if(!negociacaoAguardandoRetorno && bolaCliente){
    // A bola está com o cliente. MAS: eu já retomei depois que ele sumiu? Se sim, não faz
    // sentido pedir pra "dar um toque" de novo — é aguardar. Usa o ÚLTIMO contato (qualquer
    // toque, inclui meu atendimento/follow-up) comparado à última resposta dela.
    let diasContato = l.daysSinceLastTouch; if(diasContato==null) diasContato = _diasDesdeMsg(l, false);
    let diasResposta = l.daysSinceClientReply; if(diasResposta==null) diasResposta = _diasDesdeMsg(l, true);
    const jaRetomei = diasContato!=null && diasResposta!=null && diasContato < diasResposta;
    // Só o motivo qualitativo aqui — os números (dias de contato / sem resposta) ficam nas caixas, sem repetir.
    if(jaRetomei && diasContato<=5){
      partes.push("você já retomou — aguardando o retorno dela");
      jaFalouDoTempo = true;
    } else if(jaRetomei){
      partes.push("você já retomou, sem resposta — vale um lembrete leve");
      jaFalouDoTempo = true;
    } else
      partes.push("cliente ficou de te retornar — dá um toque pra manter o ritmo");
  }
  else if(quemDeve === "corretor" || (quemDeve !== "cliente" && /promet|ficou de (te |lhe )?(enviar|mandar|passar|retornar)|enviar (a |uma )?simula|preparar (a |uma )?(proposta|simula)|montar (a |uma )?(proposta|simula)|mandar (o |os |as )?(material|plantas?|tabela)|aguard(a|ando) (o |um |meu |nosso )?retorno|cliente (aguarda|espera|esperando)|devo (enviar|mandar|retornar)/.test(txt)))
    partes.push("você ficou de retornar algo — cliente te esperando");
  else if(ehPermuta(l) || /depende (da|de) (venda|safra|colheita)|quando vender|assim que vender|precisa vender (a |o |seu |sua )?(casa|im[óo]vel|apartamento)|vender (a |o |seu |sua )?(casa|im[óo]vel) (antes|primeiro)/.test(txt))
    partes.push("depende de evento externo (vender imóvel/safra) — não fecha agora");
  else if(/visit(ou|a feita)|decorado|colocou (a |o )?(casa|im[óo]vel) (à|a) venda|escolheu (as |a )?unidade|aprov(ou|ado) (o )?cr[ée]dito/.test(txt))
    partes.push("cliente já se esforçou — comprometido");

  // Contexto real da conversa (resumo da IA) — curto, sem cortar palavra no meio.
  const resumoReal = (a.summary || l.summary || "").trim();
  if(resumoReal && resumoReal.length > 10 && !/importada com sucesso|análise disponível|importado do histórico/i.test(resumoReal)){
    const frase = resumoReal.split(/[.!?]/)[0].trim();
    if(frase.length > 8) partes.push(_cortarFrase(frase, 85));
  }

  // Timing como complemento (pulado quando já contei o tempo na frase de retomada — não repetir)
  if(!jaFalouDoTempo && !isNaN(dias) && dias != null){
    if(dias === 0) partes.push("último contato hoje");
    else if(dias === 1) partes.push("último contato ontem");
    else if(dias <= 7) partes.push(`${dias} dias parado`);
    else if(dias <= 30) partes.push(`${dias} dias parado — janela fechando`);
    else partes.push(`${dias} dias parado`);
  }

  // Etapa como contexto adicional
  if(e === "Negociação") partes.push("em negociação");
  else if(e === "Visita/Proposta") partes.push("com proposta em jogo");

  return partes.join(" · ") || "Importado, aguardando análise";
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
    const e = normalizarEtapa(l.etapa);
    const propostaOuSimulacao = /proposta|simula(?:ção|cao|r)|condi[çc][ãa]o enviada|tabela enviada|or[çc]amento enviado/.test(txt);
    const travaFinanceira = /entrada|parcela|financeir|financi|banco|caixa|or[çc]amento|teto|renda|capacidade/.test(txt);
    if(travaFinanceira && !propostaOuSimulacao && !["Visita/Proposta","Negociação"].includes(e)){
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
  const avancado = ["Visita/Proposta","Negociação"].includes(normalizarEtapa(l?.etapa));
  return dias >= 3 && dias <= 7 && (tipo === "quente-fechar" || interesse === "alto" || interesse === "quente" || avancado);
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
// Não importa a etapa — Isabela em "Atendimento" com 4 dias distintos e keywords
// fortes ainda é reaquecimento urgente.
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
  return l?.product || "--";
}

// Data + hora da última atualização do lead (qualquer edição/inclusão; abrir/fechar não conta).
// Formato curto pt-BR no fuso de Brasília. Vazio quando não há data.
function fmtUltimaAtualizacao(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(isNaN(d.getTime())) return "";
  try{
    const data = d.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", timeZone:"America/Sao_Paulo" });
    const hora = d.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit", timeZone:"America/Sao_Paulo" });
    return `${data} ${hora}`;
  }catch(_){ return ""; }
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

// Dias de calendário (BR) desde o último "contato_manual" registrado. null = nunca atendido.
function ultimoAtendimentoManual(l){
  const eventos = l?.analysis?.aprendizado?.eventos || [];
  let maisRecente = null;
  for(const e of eventos){
    if(e?.evento !== "contato_manual" || !e?.quando) continue;
    const d = new Date(e.quando);
    if(isNaN(d.getTime())) continue;
    if(!maisRecente || d > new Date(maisRecente.quando)) maisRecente = e;
  }
  return maisRecente;
}
function ultimoAtendimentoDataHora(l){
  const e = ultimoAtendimentoManual(l);
  return e?.quando ? fmtUltimaAtualizacao(e.quando) : "";
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
// Rótulo humano do atendimento: "agora", "hoje", "ontem" ou "há X dias" (§6.5).
function rotuloTempoAtendimento(ts){
  if(!ts) return "";
  const dias = diasCalendarioBR(ts);
  if(dias === 0) return ((Date.now() - ts) / 60000) < 60 ? "agora" : "hoje";
  if(dias === 1) return "ontem";
  return `há ${dias} dias`;
}

function diasDesdeAtendimentoManual(l){
  const eventos = l.analysis?.aprendizado?.eventos || [];
  let maisRecente = null;
  for(const e of eventos){
    if(e.evento !== "contato_manual" || !e.quando) continue;
    const t = new Date(e.quando);
    if(isNaN(t.getTime())) continue;
    if(!maisRecente || t > maisRecente) maisRecente = t;
  }
  return maisRecente ? diasCalendarioBR(maisRecente) : null;
}

// Prazo de proteção: lead atendido não volta pra fila de prioritários antes de PRAZO_PROTECAO_ATENDIDO dias.
const PRAZO_PROTECAO_ATENDIDO = 5;
function protegidoPosAtendimento(l){
  const dias = diasDesdeAtendimentoManual(l);
  return dias != null && dias < PRAZO_PROTECAO_ATENDIDO;
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
function temAtendimentoManual(l){
  const tl = Array.isArray(l?.recentMessages) ? l.recentMessages : [];
  return tl.some(m => {
    if(!m) return false;
    if(m.source === "manual" || m.source === "crm") return true;
    if(["atendimento","nota","ligacao","visita","presencial"].includes(String(m.type||""))) return true;
    if(/atendimento.*\(corretor\)/i.test(String(m.author||""))) return true;
    return false;
  });
}
const BUSINESS_RE = /(senger|construtora|direciona|atendimento|sanchai|miguel\s+kirinus)/i;
// "Corretor", "Imobiliária" e "Imóveis" podem fazer parte do NOME do contato parceiro.
// Por isso não podem, sozinhos, transformar a fala dele em mensagem da empresa.
function ehMsgDoCliente(m, primeiroNomeCliente){
  const autor = String(m?.author || "").trim();
  if(!autor || autor === "Sistema") return false;
  const autorNorm = autor.toLowerCase();
  const nomeNorm = String(primeiroNomeCliente || "").trim().toLowerCase();
  // O nome do contato tem prioridade sobre palavras de profissão no próprio nome
  // (ex.: "Anderson Ruviaro Corretor SM Gabro").
  if(nomeNorm && autorNorm.includes(nomeNorm) && !/^(sanchai|miguel\s+kirinus)$/i.test(autorNorm)) return true;
  if(BUSINESS_RE.test(autor)) return false;
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
// compromisso confirmado, etapa avançada, ou retomada quente/morna.
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
  const etapaAvancada = ["Visita/Proposta","Negociação","Vendido"].includes(normalizarEtapa(l.etapa));
  const tipo = String(a.tipoRetomada||"").toLowerCase();
  const quente = tipo === "quente-fechar" || tipo === "morno-confirmar" || tipo === "objecao-tratar";
  // Mensagem substancial do cliente (não só "oi/beleza/opa") já conta como engajamento.
  const maxLenCli = msgsCli.reduce((mx,m)=>Math.max(mx, String(m.text||"").trim().length), 0);
  const houveDialogo = msgsCli.length >= 5 || dSet.size >= 3 || kwHits >= 1 || temAgenda || etapaAvancada || quente || maxLenCli >= 30 || temAtendimentoManual(l);
  return !houveDialogo;
}

// Registra "contato_manual" pra um lead pela lista (sem precisar abrir o lead).
async function marcarContatoManualPorId(id){
  if(!id) return false;
  try{
    const resp = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, action:"aprendizado", evento:"contato_manual", detalhes:{ de:"listaPrioridade" } })
    });
    return resp.ok;
  }catch(_){ return false; }
}
window.marcarContatoManualPorId = marcarContatoManualPorId;

// (Botão "Já contatei" removido — "tratado hoje" só conta quando registra atendimento real.)
// Função `contateiAgora` mantida pois é exportada e pode ser usada em testes/extensões.
async function contateiAgora(id, btn){
  if(!id) return;
  if(btn){ btn.disabled = true; btn.textContent = "✓ Contatado"; btn.style.color = "var(--acao)"; btn.style.borderColor = "var(--acao)"; }
  await marcarContatoManualPorId(id);
  const card = document.querySelector(`[data-card-id="${id}"]`);
  if(card){
    card.style.transition = "opacity .25s, transform .25s";
    card.style.opacity = "0";
    card.style.transform = "translateX(18px)";
    setTimeout(() => { card.remove(); }, 240);
  }
  const grupos = state.gruposHome || {};
  for(const k of Object.keys(grupos)){
    const arr = grupos[k];
    if(!Array.isArray(arr)) continue;
    const i = arr.findIndex(l => String(l.id) === String(id));
    if(i >= 0) arr.splice(i, 1);
  }
}
window.contateiAgora = contateiAgora;

// Ação rápida da fila/hero: "já falei com esse" — registra o contato (sai da fila de hoje
// pelo ehContatadoHoje e respeita a janela de espera), tira da lista na hora e mostra o próximo.
async function jaFaleiLead(id){
  if(!id) return;
  await marcarContatoManualPorId(id);
  invalidarLeadsCache();
  const grupos = state.gruposHome || {};
  for(const k of Object.keys(grupos)){
    const arr = grupos[k];
    if(Array.isArray(arr)){ const i = arr.findIndex(l => String(l.id) === String(id)); if(i >= 0) arr.splice(i, 1); }
  }
  toast("Boa! Marquei que você já falou — ele volta pra fila em alguns dias.");
  if(state.grupoAtivo) abrirGrupoHome(state.grupoAtivo);
  else if(!state.lead?.id){ renderBotoesHome(); if(window.renderHomeRight) renderHomeRight(state.itemsAtivos); }
}
window.jaFaleiLead = jaFaleiLead;

// Caixa de erro amigável com "Tentar de novo" — evita "Carregando..." preso e texto técnico.
function boxErro(retryJs){
  return `<div class="empty" style="text-align:center;padding:22px 14px">Não consegui carregar agora.<br><span class="small" style="color:var(--muted)">Confira sua internet e tente de novo.</span><br><button type="button" onclick='invalidarLeadsCache();${retryJs}' style="margin-top:12px;padding:8px 18px;border:1px solid var(--lime);background:rgba(255,98,88,.1);color:var(--lime);border-radius:999px;font-weight:950;cursor:pointer">Tentar de novo</button></div>`;
}
window.boxErro = boxErro;

// Janela de espera depois que EU já contatei: não dá pra chamar o cliente todo dia.
// Se mandei mensagem e a bola está com ele (não respondeu), esperamos pelo menos 3 dias;
// só volta a aparecer como ação a partir do 4º dia sem resposta. Exceções (NÃO espera):
//  - lembrete pra hoje / compromisso hoje ou amanhã (motivo agendado manda);
//  - o cliente respondeu DEPOIS do meu último toque (aí a bola é minha, devo agir).
// Quantos dias de espera antes do lead voltar pra fila de prioridade.
// Lead NOVO / exportado nos últimos 7 dias (acabei de falar com ele) → 3 dias: dá tempo pro
// cliente pensar, só aparece no 3º dia. Lead já ESTABELECIDO no sistema → regra do 5º dia.
function limiarRetomada(l){
  const iso = l && l.createdAt;
  if(iso){
    const t = new Date(iso).getTime();
    if(!isNaN(t)){
      const dCriado = Math.floor((Date.now() - t) / 86400000);
      if(dCriado <= 7) return 3;
    }
  }
  return 5;
}
function emJanelaDeEspera(l){
  if(lembreteVencido(l)) return false;
  const aps = l.analysis?.confirmedAppointments;
  if(Array.isArray(aps) && aps.some(ap => /\b(hoje|amanh[ãa])\b/.test(String(ap.quando||"").toLowerCase()))) return false;
  let toque = l.daysSinceLastTouch; if(toque==null) toque = _diasDesdeMsg(l, false);
  let resposta = l.daysSinceClientReply; if(resposta==null) resposta = _diasDesdeMsg(l, true);
  if(toque == null) return false;
  // Só espera se EU contatei por último (cliente ainda não respondeu desde então).
  const euContateiPorUltimo = resposta == null || toque < resposta;
  return euContateiPorUltimo && toque < limiarRetomada(l);
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
    // falou por último (devemos uma resposta)
    const msgs = Array.isArray(l.recentMessages) ? l.recentMessages : [];
    const primeiroNome = String(l.name||"").toLowerCase().trim().split(/\s+/)[0] || "";
    for(let i = msgs.length - 1; i >= 0; i--){
      const m = msgs[i];
      if(!m || !String(m.text||"").trim()) continue;
      return ehMsgDoCliente(m, primeiroNome);
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
  "tratado-hoje":       { titulo: "Atendidos recentemente", sub: `Leads que você já atendeu nos últimos ${PRAZO_PROTECAO_ATENDIDO} dias — voltam pra fila de prioritários depois disso.` },
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
const CHECK_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>`;
// Uma linha da Fila inteligente (porte do layout-alvo). Reaproveita dados/cliques reais.
function filaRowHTML(l, pos){
  const idJs = JSON.stringify(String(l.id||""));
  const ehSel = state.lead?.id && String(l.id) === String(state.lead.id);
  const prioridade = prioridadeAtendimento(l) || {};
  const dias = l.daysSinceLastInteraction != null ? `<span class="fd-n">${l.daysSinceLastInteraction}d</span><span class="fd-l">sem resposta</span>` : "";
  const etapa = normalizarEtapa(l.etapa);
  const waLink = l.phone ? whatsappLink(l.phone, "") : "";
  return `<div class="fila-row ${ehSel?"sel":""}" onclick='abrirLead(${idJs})'>
    <div class="fila-rank">${pos}</div>
    <div class="fila-info">
      <div class="fila-nm">${escapeHtml(l.name||"Cliente")}</div>
      <div class="fila-un">${escapeHtml(produtosLabel(l))}</div>
    </div>
    <div class="fila-days">${dias}</div>
    <div class="fila-pcwrap">
      <div class="fila-pc" title="Prioridade de atendimento">${escapeHtml(prioridade.titulo || "Prioridade")}</div>
    </div>
    <button type="button" class="fila-done" title="Já falei — tira da fila de hoje" onclick='event.stopPropagation();jaFaleiLead(${idJs})'>${CHECK_SVG}</button>
    ${waLink
      ? `<a class="fila-wa" href="${escapeHtml(waLink)}" target="_blank" rel="noopener" title="Abrir WhatsApp" onclick="event.stopPropagation()">${WA_SVG}</a>`
      : `<span class="fila-wa" title="Sem telefone">${WA_SVG}</span>`}
    <div class="fila-chev">›</div>
  </div>`;
}
// Ícones do "por que é prioridade" (quadrinho com ícone, igual ao desenho — varia por linha).
const HERO_WHY_ICONS = [
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7v18h10V8z"/><path d="M14 3v5h5"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 16L17 7M9 7h8v8"/></svg>`
];
// Ícones dos 3 quadros de fato.
const HERO_FACT_CAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>`;
const HERO_FACT_CLK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
const HERO_FACT_HEART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21S3.5 15.5 3.5 9.5A4 4 0 0 1 12 7a4 4 0 0 1 8.5 2.5C20.5 15.5 12 21 12 21z"/></svg>`;
// Card "hero" do lead nº1 (o de maior prioridade do dia) — espelha o design dos prints,
// com dados REAIS (motivo, próxima ação, melhor horário, mensagem sugerida no WhatsApp).
function renderHeroLead(l){
  const a = l.analysis || {};
  const idJs = JSON.stringify(String(l.id||""));
  const dias = l.daysSinceLastInteraction;
  // "Por que é prioridade": sinais reais (motivo + objeções), sem repetir, no máx 4.
  const porque = [];
  if(lembreteVencido(l)) porque.push("Lembrete marcado pra hoje");
  String(motivoPrioridade(l)||"").split(" · ").forEach(p => { p=p.trim(); if(p) porque.push(p.charAt(0).toUpperCase()+p.slice(1)); });
  (Array.isArray(a.objections) ? a.objections.slice(0,2) : []).forEach(o => { o=String(o||"").trim(); if(o) porque.push(o); });
  const porqueU = [...new Set(porque)].slice(0,4);
  // "Último contato" = o último TOQUE de verdade (inclui meu follow-up), não o tempo de silêncio
  // dela — senão diria "23 dias atrás" mesmo eu tendo falado anteontem. O silêncio já aparece
  // no "por que atender".
  // Duas medidas JUNTAS numa caixa só: há quanto tempo EU contatei x há quanto a CLIENTE não responde.
  let toque = l.daysSinceLastTouch; if(toque==null) toque = dias;
  let resposta = l.daysSinceClientReply; if(resposta==null) resposta = dias;
  const toqueN = toque==null ? "—" : toque===0 ? "hoje" : toque===1 ? "ontem" : toque+" dias";
  const respN  = resposta==null ? "—" : resposta===0 ? "hoje" : resposta===1 ? "ontem" : resposta+" dias";
  const interesse = produtosLabel(l) || "—";
  const proxima = a.nextAction || motivoCurto(l) || "Retomar o contato";
  return `<section class="hero-real" onclick='abrirLead(${idJs})'>
    <div class="h-top">
      <span class="h-badge max">Prioridade agora</span>
    </div>
    <div class="h-grid">
      <div style="min-width:0">
        <div class="h-nm">${escapeHtml(l.name||"Cliente")}</div>
        <div class="h-un">${escapeHtml(interesse)}</div>
      </div>
    </div>
    ${porqueU.length ? `<div class="h-why"><div class="t">POR QUE ATENDER</div><ul>${porqueU.slice(0,3).map((p)=>`<li><span>${escapeHtml(p)}</span></li>`).join("")}</ul></div>` : ""}
    <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;font-weight:800;line-height:1;margin:2px 0 2px">
      <span style="white-space:nowrap"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:7px;vertical-align:middle"></span><span style="color:var(--lime)">${escapeHtml(toqueN)}</span> <span style="color:var(--muted);font-weight:600">de contato</span></span>
      <span style="white-space:nowrap"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-right:7px;vertical-align:middle"></span><span style="color:#ef4444">${escapeHtml(respN)}</span> <span style="color:var(--muted);font-weight:600">sem resposta</span></span>
    </div>
    ${fmtUltimaAtualizacao(l.updatedAt) ? `<div style="font-size:11px;color:var(--muted);margin:1px 0 1px">Atualizado em ${escapeHtml(fmtUltimaAtualizacao(l.updatedAt))}</div>` : ""}
    ${fmtUltimaAtualizacao(a.reanalisadoEm) ? `<div style="font-size:11px;color:var(--muted);opacity:.85;margin:0 0 4px">Reanalisado em ${escapeHtml(fmtUltimaAtualizacao(a.reanalisadoEm))}</div>` : ""}
    <div class="h-next">
      <div class="l">PRÓXIMA AÇÃO</div>
      <div class="x">${escapeHtml(proxima)}</div>
      <div class="h-acts">
        <button type="button" class="h-out" onclick='event.stopPropagation();abrirLead(${idJs})'>Ver histórico</button>
        <button type="button" class="h-out" onclick='event.stopPropagation();jaFaleiLead(${idJs})' title="Marca que você já falou — sai da fila de hoje">✓ Já falei</button>
      </div>
    </div>
  </section>`;
}
// Copia a mensagem sugerida (direta, com saudação) de um lead — usada no botão do hero.
// v826 §6.2/§6.5 — Copiar uma sugestão significa que ela VAI ser enviada. Então conta
// como atendimento (data/hora, entra em Últimos atendimentos e na fila) E entra na
// linha do tempo do cliente como "Mensagem enviada". Nunca altera a etapa comercial e
// não alimenta o aprendizado de estilo (o texto é sugestão da própria IA).
async function registrarMensagemEnviada(id, msg){
  const texto = String(msg || "").trim();
  if(!id || !texto) return;
  const lead = (state.lead && String(state.lead.id) === String(id)) ? state.lead
    : (state.itemsAtivos || []).find(x => String(x.id) === String(id)) || null;
  // Feedback imediato (§6.7 / atualização sem reload): já marca como atendido agora.
  try{
    const quando = new Date().toISOString();
    const p = new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,hourCycle:"h23"}).formatToParts(new Date(quando)).reduce((o,x)=>(x.type!=="literal"&&(o[x.type]=x.value),o),{});
    if(lead) ui667AplicarAtendidoLocal(lead, quando, `${p.day}/${p.month}/${p.year}`, `${p.hour}:${p.minute}`);
  }catch(_){}
  try{
    await fetchComTimeout("./api/reanalisar-lead", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, novoAtendimento: texto.slice(0,4000), apenasSalvar:true, autorManual:"Mensagem enviada (você)", tipoManual:"mensagem_enviada", registrarAtendimento:true }) });
  }catch(_){ /* a cópia já foi feita; o registro é best-effort */ }
  invalidarLeadsCache();
  try{ loadRecentLeads(false); }catch(_){}
  if(state.lead && String(state.lead.id) === String(id)) try{ recarregarLeadFoco(id); }catch(_){}
}

window.copiarMensagemLead = function(id){
  const l = (state.itemsAtivos||[]).find(x => String(x.id) === String(id));
  if(!l) return;
  const a = l.analysis || {};
  const msg = mensagemAprovadaSemAlteracao(mensagensDaAnalise(a).direta);
  if(!msg){ toast("Sem mensagem pronta pra este lead. Abra o lead e reanalise pra gerar."); return; }
  const done = () => { toast("Mensagem copiada"); try{ registrarAprendizado && registrarAprendizado("mensagem_copiada", String(l.id||"")||null, { de:"hero" }); }catch(_){} registrarMensagemEnviada(l.id, msg); };
  if(navigator.clipboard?.writeText){ navigator.clipboard.writeText(msg).then(done).catch(()=>toast("Não consegui copiar")); }
  else { toast("Não consegui copiar"); }
};

// === Oportunidades esquecidas (radar de resgate) ===
// Leads VALIOSOS que tiveram um passo-chave (visita, proposta, negociação ou atendimento
// registrado) e ESFRIARAM — escaparam da fila urgente de hoje. É "dinheiro parado": o
// corretor já investiu e está prestes a perder por esquecimento. (ideia do podcast do Airton)
function leadsEsquecidos(items){
  const acaoHoje = new Set((state.gruposHome?.["acao-hoje"] || []).map(l => String(l.id)));
  const out = [];
  for(const l of (items || [])){
    const etapa = normalizarEtapa(l.etapa);
    if(["Vendido","Perdido","Geladeira"].includes(etapa)) continue;
    if(acaoHoje.has(String(l.id))) continue; // já está na fila de hoje = não está esquecido
    const teveProposta = leadTemProposta(l);
    const passoChave = ["Visita/Proposta","Negociação"].includes(etapa) || teveProposta || temAtendimentoManual(l);
    if(!passoChave) continue;
    const parado = Number(l.daysSinceClientReply != null ? l.daysSinceClientReply : l.daysSinceLastInteraction);
    if(!(parado >= 7)) continue; // ainda quente/recente não é "esquecido"
    let pesoRecuperacao = 0;
    if(etapa === "Negociação") pesoRecuperacao += 40;
    else if(etapa === "Visita/Proposta") pesoRecuperacao += 30;
    if(teveProposta) pesoRecuperacao += 20;
    if(temAtendimentoManual(l)) pesoRecuperacao += 10;
    pesoRecuperacao += Math.min(20, parado);
    out.push({ l, parado, pesoRecuperacao });
  }
  out.sort((a,b) => b.pesoRecuperacao - a.pesoRecuperacao || b.parado - a.parado);
  return out.slice(0, 6).map(x => x.l);
}
function radarRowHTML(l){
  const idJs = JSON.stringify(String(l.id || ""));
  const parado = Number(l.daysSinceClientReply != null ? l.daysSinceClientReply : l.daysSinceLastInteraction) || 0;
  const etapa = normalizarEtapa(l.etapa);
  const teveProposta = leadTemProposta(l);
  const rec = (etapa === "Negociação" || teveProposta)
    ? ["Alta","var(--acao)"]
    : (etapa === "Visita/Proposta" || temAtendimentoManual(l))
      ? ["Média","var(--lime)"]
      : ["Baixa","var(--morno)"];
  let oque = "atendimento feito";
  if(etapa === "Negociação") oque = "negociação aberta";
  else if(etapa === "Visita/Proposta") oque = "visita/proposta em jogo";
  else if(teveProposta) oque = "recebeu proposta";
  else if(temAtendimentoManual(l)) oque = "visita/atendimento feito";
  const prod = (l.product && !/n[ãa]o identificad|importad/i.test(String(l.product))) ? " · " + escapeHtml(l.product) : "";
  return `<button type="button" class="radar-row" onclick='abrirLead(${idJs})'>
    <div class="radar-row-main">
      <div class="radar-nome">${escapeHtml(l.name || "Cliente")}<span class="radar-prod">${prod}</span></div>
      <div class="radar-meta">${oque} · parado ${parado <= 0 ? "hoje" : parado + "d"}</div>
    </div>
    <div class="radar-rec" style="color:${rec[1]}"><b>${rec[0]}</b><span>recuperação</span></div>
  </button>`;
}

// Raio-X da carteira (Regras 4/5/9): até 3 frases de DECISÃO que leem a carteira inteira —
// (R5) onde os clientes estão travando, (R4) esforço x resultado (conversa longa sem nenhuma
// visita) e (R9/R1) a oportunidade parada de maior valor. NÃO é painel/funil: é diagnóstico em
// frase, no topo da Home. Usa a etapa só pra CALCULAR (não exibe board). Sem painel confuso.
function insightFocoHTML(items, esquecidos){
  const ativos = (items || []).filter(l => l && l.id && !["Vendido","Perdido","Geladeira"].includes(normalizarEtapa(l.etapa)));
  if(ativos.length < 5) return ""; // base pequena: diagnóstico não é confiável
  const linhas = [];

  // (R5) GARGALO — a fase onde mais clientes ficaram parados (5+ dias). É onde a energia rende mais.
  const parado = (l) => { const d = Number(l.daysSinceClientReply != null ? l.daysSinceClientReply : l.daysSinceLastInteraction); return Number.isFinite(d) && d >= 5; };
  const cont = {};
  for(const l of ativos){ if(!parado(l)) continue; const e = normalizarEtapa(l.etapa); cont[e] = (cont[e] || 0) + 1; }
  let etapaG = null, nG = 0;
  for(const e of ["Atendimento","Visita/Proposta","Negociação"]){ if((cont[e] || 0) > nG){ nG = cont[e]; etapaG = e; } }
  if(etapaG && nG >= 2){
    const frase = {
      "Atendimento": `<b>${nG} clientes</b> travaram na conversa sem avançar pra visita — qualifique e proponha o próximo passo. É aí que sua energia rende mais.`,
      "Visita/Proposta": `<b>${nG} clientes</b> já visitaram ou receberam proposta e sumiram — é seu dinheiro mais valioso parado. Retome antes de buscar lead novo.`,
      "Negociação": `<b>${nG} clientes</b> em negociação perdendo força — corra pra fechar antes de perder o cliente.`
    };
    linhas.push(frase[etapaG]);
  }

  // (R4) ATIVIDADE x RESULTADO — conversas longas (30+ mensagens) sem NENHUMA visita/atendimento
  // marcado. Muita mensagem e pouco avanço: o sinal de "atividade não é resultado".
  const temVisita = (l) => {
    const a = l.analysis || {};
    if(Array.isArray(a.confirmedAppointments) && a.confirmedAppointments.length) return true;
    if(temAtendimentoManual(l)) return true;
    return ["Visita/Proposta","Negociação"].includes(normalizarEtapa(l.etapa));
  };
  const longas = ativos.filter(l => totalMensagensLead(l) >= 30 && !temVisita(l)).length;
  if(longas >= 1){
    linhas.push(longas === 1
      ? `<b>1 conversa longa</b> sem nenhuma visita marcada — muita mensagem, pouco avanço. Hora de propor a visita.`
      : `<b>${longas} conversas longas</b> sem nenhuma visita marcada — muita mensagem, pouco avanço. Hora de propor a visita.`);
  }

  // (R9/R1) PARADA DE MAIOR VALOR — a oportunidade esquecida de maior potencial (topo do radar).
  const esq = Array.isArray(esquecidos) ? esquecidos : leadsEsquecidos(items);
  if(esq && esq[0]){
    const l = esq[0];
    const dias = Number(l.daysSinceClientReply != null ? l.daysSinceClientReply : l.daysSinceLastInteraction) || 0;
    const etapa = normalizarEtapa(l.etapa);
    const teveProposta = leadTemProposta(l);
    let oque = "atendimento feito";
    if(etapa === "Negociação") oque = "negociação aberta";
    else if(etapa === "Visita/Proposta") oque = "visita/proposta em jogo";
    else if(teveProposta) oque = "recebeu proposta";
    linhas.push(`<b>Parada de maior valor:</b> ${escapeHtml(l.name || "Cliente")} — ${oque}, parado há ${dias <= 0 ? "hoje" : dias + "d"}.`);
  }

  if(!linhas.length) return "";
  return `<div class="insight-foco">
    <div style="font-weight:950;color:var(--lime);text-transform:uppercase;letter-spacing:.1em;font-size:11px;margin-bottom:8px">📊 Raio-X da carteira</div>
    <div style="display:flex;flex-direction:column;gap:6px">${linhas.map(t => `<div style="display:flex;gap:8px;align-items:flex-start"><span style="color:var(--lime);font-weight:950;line-height:1.55">•</span><span style="flex:1">${t}</span></div>`).join("")}</div>
  </div>`;
}

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

  // Fila urgente = todos os que precisam de ação agora (sem teto).
  // "Pular próximo": leads que o corretor mandou pular NESTA sessão vão pro FIM da fila (continuam
  // nas prioridades, só não ficam em foco agora). state.pulados é por sessão (zera ao recarregar).
  let urgentes = (grupos["acao-hoje"] || []).concat(grupos["retomar-cuidado"] || []);
  {
    const pulados = state.pulados instanceof Set ? state.pulados : null;
    if(pulados && pulados.size){
      urgentes = urgentes.filter(l => !pulados.has(String(l.id))).concat(urgentes.filter(l => pulados.has(String(l.id))));
    }
  }
  const retomada = (grupos["retomada"] || []);
  let top3Html;
  if(urgentes.length){
    // O nº1 já está no card "Prioridade agora" acima — a fila lista só os DEMAIS (sem repetir).
    const resto = urgentes.slice(1);
    top3Html = renderHeroLead(urgentes[0])
      + (resto.length
          ? `<div class="fila-head"><h3>Próximos atendimentos</h3><span>Ordenados por prioridade de atendimento</span></div>`
            + resto.map((l, i) => filaRowHTML(l, i+2)).join("")
          : "");
  } else if(retomada.length){
    // Nenhum urgente: todos foram atendidos recentemente. Sugere retomadas proativas.
    top3Html = `<div style="padding:14px 16px;border:1px dashed var(--lime);border-radius:12px;background:rgba(255,98,88,.05);margin-bottom:12px">
      <div style="font-size:14px;font-weight:950;color:var(--lime);margin-bottom:4px">✅ Nenhum lead urgente agora</div>
      <div class="small" style="color:var(--soft)">Ótimo momento pra fazer retomadas proativas — leads que pararam mas ainda têm potencial.</div>
    </div>`
      + `<div class="fila-head"><h3>Retomadas sugeridas</h3><span>Leads parados há 3+ dias que valem um toque</span></div>`
      + retomada.map((l, i) => filaRowHTML(l, i+1)).join("");
  } else {
    top3Html = `<div class="small" style="color:var(--muted);opacity:.7;padding:18px;border:1px dashed var(--line);border-radius:10px;text-align:center">Tudo em dia! Nenhum lead pendente agora. Bom momento pra importar conversas novas.</div>`;
  }

  const temLista = urgentes.length > 0 || retomada.length > 0;
  // Botão "Pular próximo" só faz sentido com 2+ na fila de urgentes (precisa ter pra onde pular).
  const btnPularHtml = urgentes.length > 1 ? `<button type="button" class="seq-link" onclick='pularProximo()'>⏭ Pular próximo</button>` : "";

  const esquecidos = leadsEsquecidos(items);
  const esquecidosHtml = esquecidos.length ? `
    <div class="radar-card">
      <div class="radar-tit">⏳ Oportunidades esquecidas <span class="radar-sub">valiosas e paradas — resgate antes de perder</span></div>
      ${esquecidos.map(radarRowHTML).join("")}
    </div>` : "";

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
    </style>
    <div class="home-saud">
      <div class="home-saud-sub"><span class="home-saud-titulo">Top conversão de hoje.</span><div class="home-saud-acoes"><button type="button" class="seq-link" onclick='abrirTodosLeads()'>Ver todos</button><button type="button" class="seq-link" onclick='setPipelineTab("ultimos");show("pipeline")'>Últimos atendimentos</button><button type="button" class="seq-link" onclick='reanalisarTudo()'>↻ Reanalisar todos</button>${btnPularHtml}</div></div>
    </div>
    ${barraBuscaLeadHTML("home")}
    <div class="home-m1-list">${top3Html}</div>
    ${esquecidosHtml}
    ${temLista ? `<div style="text-align:center;margin-top:8px"><button type="button" class="ver-todas" onclick='abrirTodosLeads()'>Ver todas as oportunidades →</button></div>` : ""}
    <div class="raiox-mobile">${insightFocoHTML(items, esquecidos)}</div>
  `;
  qsa(".pickZipShortcut").forEach(b => {
    if(!b.dataset.bound){ b.dataset.bound = "1"; b.addEventListener("click", () => qs("#zipInput")?.click()); }
  });
}

// "Pular próximo": tira o lead EM FOCO da vez de agora (vai pro FIM da fila de urgentes) e joga o
// próximo pro card "Prioridade agora". NÃO remove das prioridades — só adia ele nesta sessão.
function pularProximo(){
  const grupos = state.gruposHome || {};
  let urg = (grupos["acao-hoje"] || []);
  const pulados = state.pulados instanceof Set ? state.pulados : (state.pulados = new Set());
  if(pulados.size){
    urg = urg.filter(l => !pulados.has(String(l.id))).concat(urg.filter(l => pulados.has(String(l.id))));
  }
  if(urg.length < 2) return; // só um na fila: não há pra onde pular
  pulados.add(String(urg[0].id));
  renderBotoesHome();
}
window.pularProximo = pularProximo;

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
      <div class="ins-item"><div class="ins-ic">↗</div><div style="min-width:0"><div class="it"><b style="color:var(--lime)">${pedemAcao}</b> atendimento${pedemAcao===1?' pede':'s pedem'} sua ação agora; <b>${programados}</b> programado${programados===1?'':'s'}; <b>${aguardando}</b> aguardando cliente.</div>${pedemAcao?`<a onclick="cp786AbrirConducao('agora')">Abrir prioridades →</a>`:''}</div></div>
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
  qs("#maAcImportar").onclick = () => { close(); qs("#zipInput")?.click(); };
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
      if(!confirm(`Vou preencher o telefone de ${aplicar.length} lead(s) que estavam sem número. Confirmar?`)) return;
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
function avatarInicial(name, pctClass, foto){
  const n = String(name||"Cliente").trim();
  // Foto recortada do print (dataURL) — quando existe, mostra a imagem no lugar das iniciais.
  if(foto && /^data:image\//.test(String(foto))){
    return `<div class="lead-avatar ${pctClass||""} has-foto"><img src="${escapeHtml(foto)}" alt="" loading="lazy"></div>`;
  }
  const ini = (n.split(/\s+/).map(w=>w[0]).filter(Boolean).slice(0,2).join("") || "C").toUpperCase();
  return `<div class="lead-avatar ${pctClass||""}">${escapeHtml(ini)}</div>`;
}
// Atalho: avatar a partir do objeto lead (pega a foto recortada se houver).
function avatarLead(l, pctClass){ return avatarInicial(l?.name, pctClass, l?.analysis?.avatarFoto || l?.avatarFoto); }
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
  if(!options.fromHistory && !cpApplyingHistory){
    cpPushRoute({...cpRouteForScreen("home"),screen:"home",grupoAtivo:grupo});
  }
  const foco = qs("#leadFocoArea");
  if(!foco) return;
  document.body.classList.remove("lead-foco-aberto");
  state.grupoAtivo = grupo;
  const saud = qs("#saudacao");
  if(saud) saud.style.display = "none";
  const meta = GRUPOS_HOME[grupo];
  const arr = (state.gruposHome && state.gruposHome[grupo]) || [];

  const cardHtml = (l) => {
    const idStr = String(l.id||"");
    const idJs = JSON.stringify(idStr);
    const contatadoHoje = ehContatadoHoje(l);
    const dias = (!contatadoHoje && l.daysSinceLastInteraction != null) ? l.daysSinceLastInteraction + "d parado" : "";
    const etapa = normalizarEtapa(l.etapa);
    const motivo = motivoCurto(l);

    const tags = [];
    if(contatadoHoje) tags.push(`<span style="display:inline-block;padding:1px 6px;border-radius:999px;font-size:9px;font-weight:950;color:var(--on-accent);background:var(--lime);border:1px solid var(--lime);letter-spacing:.04em;vertical-align:1px">✓ HOJE</span>`);
    if(ehEsfriando(l)) tags.push(tagEsfriandoHTML());
    if(ehPermuta(l)) tags.push(tagPermutaHTML());
    if(ehSumicoPosPreco(l)) tags.push(tagSumicoPrecoHTML());

    const waLink = l.phone ? whatsappLink(l.phone||"", "") : "";
    return cardLeadHTML(l, { tagsHtml: tags.join(""), dias, acoesHtml: btnWhatsApp(waLink) });
  };

  const vazio = `<div class="small" style="color:var(--muted);opacity:.7;padding:14px;border:1px dashed var(--line);border-radius:10px;text-align:center">Nenhum lead aqui no momento.</div>`;
  let listaHtml;
  // Mostra todos. Só esconde num expansor quando o "resto" tem MAIS de 2 leads
  // (esconder 1-2 não vale a pena — cabem na grid mesmo).
  if(grupo === "acao-hoje" && arr.length > 12){
    const topo = arr.slice(0, 12);
    const resto = arr.slice(12);
    listaHtml =
      `<div class="small" style="color:var(--lime);text-transform:uppercase;letter-spacing:.12em;font-weight:950;font-size:10px;margin:0 0 8px">Ataca agora — top 12</div>
       <div class="lista-leads-grid">${topo.map(cardHtml).join("")}</div>
       <details style="margin-top:12px">
         <summary style="cursor:pointer;padding:10px 12px;border:1px dashed var(--line);border-radius:10px;color:var(--soft);font-size:12px;font-weight:950;letter-spacing:.04em;text-transform:uppercase;list-style:none">Ver mais ${resto.length}</summary>
         <div class="lista-leads-grid" style="margin-top:10px">${resto.map(cardHtml).join("")}</div>
       </details>`;
  } else {
    listaHtml = arr.length ? `<div class="lista-leads-grid">${arr.map(cardHtml).join("")}</div>` : vazio;
  }

  foco.innerHTML =
    `<div style="display:flex;align-items:center;gap:12px;margin:0 0 4px;flex-wrap:wrap">
       <button type="button" onclick="voltarDaListaHome()" style="background:transparent;border:1px solid var(--line);border-radius:999px;padding:5px 12px;color:var(--soft);font-size:12px;font-weight:950;cursor:pointer">‹ Voltar</button>
       <b style="color:var(--lime);text-transform:uppercase;letter-spacing:.12em;font-weight:950;font-size:13px">${meta.titulo}</b>
       <span style="background:var(--lime);color:var(--on-accent);border-radius:999px;padding:0 9px;font-size:12px;font-weight:950">${arr.length}</span>
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

// Atalho "Todos" da barra de baixo: abre a tela Hoje já dentro da lista completa
// de leads ativos, do mais quente pro mais frio (chance de venda).
async function abrirTodosLeads(){
  // "Ver todos" agora abre a tela unificada Leads, na visão por prioridade.
  state.lead = null; state.focoLeadId = null;
  state.leadsView = "prioridade";
  show("pipeline");
}
window.abrirTodosLeads = abrirTodosLeads;

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
        <div style="text-align:center;padding:10px 6px;background:rgba(255,155,59,.06);border:1px solid var(--morno);border-radius:10px"><b style="display:block;font-size:15px;color:var(--morno)">~R$${custoMin}–${custoMax}</b><span class="small" style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em">custo análise</span></div>
      </div>
      <div class="small" style="color:var(--soft);font-size:11px;margin-bottom:16px;line-height:1.5">💡 Só precisa fazer isso quando muda algo grande. No dia a dia, cada lead já reanalisa sozinho quando você importa a conversa. Dá pra cancelar no meio.</div>
      <div style="display:flex;gap:10px">
        <button type="button" id="reanalNao" style="flex:1;padding:11px;background:transparent;border:1px solid var(--line);border-radius:10px;color:var(--soft);font-weight:950;cursor:pointer">Cancelar</button>
        <button type="button" id="reanalSim" style="flex:1;padding:11px;background:linear-gradient(135deg,var(--lime),var(--cyan));border:0;border-radius:10px;color:var(--on-accent);font-weight:950;cursor:pointer">Reanalisar agora</button>
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
        <div id="reanalBarra" style="width:0%;height:100%;background:linear-gradient(90deg,var(--lime),var(--acao));transition:width .3s"></div>
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
      if(data?.ok) return { ok: true };
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
window.reanalisarTudo = reanalisarTudo;

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

function parseValorVenda(raw){
  if(raw == null) return 0;
  const s = String(raw).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function formatBRL(n){
  try{ return n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" }); }
  catch(_){ return "R$ "+n.toFixed(2); }
}

function renderSaudacao(items){
  // Dois alvos: #saudacao (corpo, mobile) e #saudacaoDesktop (cabeçalho, desktop).
  // O CSS decide qual aparece em cada tela — aqui só sincroniza conteúdo/visibilidade.
  const boxes = [qs("#saudacao"), qs("#saudacaoDesktop")].filter(Boolean);
  if(!boxes.length) return;
  const setAll = (display, html) => boxes.forEach(b => { b.style.display = display; if(html != null) b.innerHTML = html; });
  if(state.lead?.id || state.grupoAtivo){ setAll("none"); return; }
  if(!items?.length){ setAll("none", ""); return; }
  const h = new Date().getHours();
  let saud = "Olá";
  if(h < 12) saud = "Bom dia";
  else if(h < 18) saud = "Boa tarde";
  else saud = "Boa noite";
  const corretorNome = (state.cerebroCfg?.corretorNome || "").trim().split(/\s+/)[0] || "";
  // Meta do dia = 12 menos os já atendidos hoje, limitada pelos que podem entrar em retomada.
  // Calcula igual à lista, pra o número da saudação bater com o que aparece embaixo.
  const META_DIA = 12;
  let tratadosHoje = 0, disponiveisHoje = 0;
  for(const l of items){
    if(ehContatadoHoje(l)){ tratadosHoje++; continue; }
    if(entraEmRetomada(l)) disponiveisHoje++;
  }
  const acaoMostrada = Math.min(Math.max(0, META_DIA - tratadosHoje), disponiveisHoje);
  const head = corretorNome ? `${saud}, ${escapeHtml(corretorNome)}!` : `${saud}, corretor!`;
  const title = qs("#homePageTitle");
  if(title) title.textContent = head;
  let html;
  if(acaoMostrada > 0){
    html = `<span class="destaque">${acaoMostrada} lead${acaoMostrada>1?"s":""} pra atender hoje</span>, de cima pra baixo.`;
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
  for(const l of all){
    const e = normalizarEtapa(l.etapa);
    if(e === "Vendido" || e === "Perdido" || e === "Geladeira") continue;
    const q = l.analysis?.lembrete?.quando;
    if(q){ const t = new Date(q).getTime(); if(!isNaN(t) && t >= ini && t <= fim){ agendaN++; continue; } }
    const aps = l.analysis?.confirmedAppointments;
    if(Array.isArray(aps) && aps.some(ap => /\bhoje\b/.test(String(ap.quando||"").toLowerCase()))) agendaN++;
  }
  state.agendaCount = agendaN;
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
  return !!area.querySelector(".skel-loading,.cp-home-skeleton,.cp-db-loading,.cp694-loading") ||
    !!lateral?.querySelector?.(".cp-side-skeleton") ||
    /Carregando (?:banco de dados|sua carteira)|Organizando sua carteira/i.test(area.textContent || "");
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
      <div class="ui-section-head"><div><h3>Atendimentos prioritários</h3><p>Sua carteira foi carregada. Abra um cliente para continuar.</p></div><button type="button" onclick="show('pipeline')">Ver todos</button></div>
      <div class="ui-priority-list">${linhas || '<div class="empty">Nenhum atendimento ativo agora.</div>'}</div>
    </section>
  </div>`;
}

async function carregarDashboard(){
  if(state.active !== "home") return;
  try{
    // Usa os dados já carregados. Atualização de rede acontece só quando o cache vence
    // ou depois de uma mutação explícita; navegar entre telas não baixa a carteira de novo.
    const cached = state.itemsAtivos?.length ? { items: state.itemsAtivos } : null;
    if(cached){
      _processarDashboard({ items: state.todosLeads || cached.items });
      return;
    }

    // Sem cache: mostra skeleton imediatamente pra não parecer travado
    const focoSkel = qs("#leadFocoArea");
    if(focoSkel) focoSkel.innerHTML = `<div class="skel-loading"><div class="skel-kpis"><span class="skel-block"></span><span class="skel-block"></span><span class="skel-block"></span><span class="skel-block"></span></div><div class="skel-row"></div><div class="skel-row skel-row--sm"></div><div class="skel-row skel-row--sm"></div><div class="skel-row skel-row--sm"></div></div>`;

    const data = await getLeadsData();
    if(data && data.ok === false){
      const foco = qs("#leadFocoArea");
      if(foco && !state.itemsAtivos?.length){
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
    const items = all.filter(l => { const e = normalizarEtapa(l.etapa); return e !== "Vendido" && e !== "Perdido" && e !== "Geladeira"; });
    state.itemsAtivos = items;
    state.todosLeads = all;
    try{ window.cpAtualizarSinoAtencao?.(); }catch(_){}
    // Contagem da Agenda permanece separada da Central de atenção.
    // agora no helper atualizarSinoAgenda (reusado ao excluir/reagendar lembrete, pra refletir sem F5).
    atualizarSinoAgenda(all);
    // Radar da Geladeira: badge do Menu desativado (dono não quer aviso).
    const badgeGel = qs("#geladeiraRevisitarBadge");
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
    const agora = new Date();
    const vendasDoMes = all.filter(l => {
      if(normalizarEtapa(l.etapa) !== "Vendido") return false;
      const dt = l.analysis?.venda?.registradaEm ? new Date(l.analysis.venda.registradaEm) : null;
      return dt && dt.getMonth() === agora.getMonth() && dt.getFullYear() === agora.getFullYear();
    });
    const totalVendasMes = vendasDoMes.reduce((acc,l)=>acc+parseValorVenda(l.analysis?.venda?.valor), 0);
    // Resumo dos últimos 7 dias (vai pra faixa de KPIs da home)
    const cutoff7d = Date.now() - 7*24*60*60*1000;
    let contatosSemana = 0, vendasSemana = 0, valorVendasSemana = 0, novosLeadsSemana = 0;
    for(const l of all){
      const eventos = l.analysis?.aprendizado?.eventos || [];
      for(const e of eventos){
        const t = e.quando ? new Date(e.quando).getTime() : 0;
        if(t >= cutoff7d && (e.evento === "whatsapp_aberto" || e.evento === "mensagem_copiada" || e.evento === "contato_manual")) contatosSemana++;
      }
      if(normalizarEtapa(l.etapa) === "Vendido"){
        const dt = l.analysis?.venda?.registradaEm ? new Date(l.analysis.venda.registradaEm).getTime() : 0;
        if(dt >= cutoff7d){ vendasSemana++; valorVendasSemana += parseValorVenda(l.analysis?.venda?.valor); }
      }
      const criado = l.criadoEm ? new Date(l.criadoEm).getTime() : 0;
      if(criado >= cutoff7d) novosLeadsSemana++;
    }
    state.resumoSemana = { contatos: contatosSemana, vendas: vendasSemana, valorVendas: valorVendasSemana, novos: novosLeadsSemana };
    if(qs("#kpiVendas")) qs("#kpiVendas").textContent = String(vendasDoMes.length);
    if(qs("#kpiVendasValor")) qs("#kpiVendasValor").textContent = totalVendasMes>0 ? formatBRL(totalVendasMes) : "R$ 0";
    if(qs("#kpiAtivos")) qs("#kpiAtivos").textContent = String(items.length);
    const etapasUsadas = new Set(items.map(l => normalizarEtapa(l.etapa)));
    if(qs("#kpiPipelineAtivos")) qs("#kpiPipelineAtivos").textContent = items.length+" ativos";
    if(qs("#kpiPipelineEtapas")) qs("#kpiPipelineEtapas").textContent = etapasUsadas.size+" etapas";

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
            b.addEventListener("click", () => qs("#zipInput")?.click());
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

// ============ PIPELINE ============
const ETAPAS = ["Novo", "Atendimento", "Visita/Proposta", "Negociação", "Standby", "Geladeira", "Perdido", "Vendido"];
const ETAPAS_PRINCIPAIS = ["Novo", "Atendimento", "Visita/Proposta", "Negociação"];
const ETAPAS_OCULTAS = ["Standby", "Geladeira", "Perdido", "Vendido"];

function normalizarEtapa(raw){
  const s = String(raw || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  if(/vendido|venda concluida|venda fechada/.test(s)) return "Vendido";
  if(/perdido|desistiu|recusou/.test(s)) return "Perdido";
  if(/geladeira|arquivad/.test(s)) return "Geladeira";
  if(/standby|stand[\s-]?by|congelado|pausado/.test(s)) return "Standby";
  if(/negocia/.test(s)) return "Negociação";
  if(/visita|proposta/.test(s)) return "Visita/Proposta";
  if(/atendim|em atendimento|conversando/.test(s)) return "Atendimento";
  // Migração de etapas antigas
  if(/fechado/.test(s)) return "Vendido";
  if(/aguard|esperando|retomar/.test(s)) return "Standby";
  if(/em proposta/.test(s)) return "Visita/Proposta";
  return "Novo";
}

let pipelineBuscaTermo = "";
let pipelineFiltro = "todos";
let pipelineTabAtiva = "oportunidades";
let pipelineOrdem = "prioridade";

// Ordena a lista da Carteira pelo critério escolhido no seletor.
// Leads sem o dado vão sempre pro fim, independente da direção.
function ordenarLeadsPor(items, modo){
  const arr = items.slice();
  const nMsg = (l) => totalMensagensLead(l);
  const semResp = (l) => l.daysSinceClientReply != null ? l.daysSinceClientReply : l.daysSinceLastInteraction;
  const contato = (l) => l.daysSinceLastTouch != null ? l.daysSinceLastTouch : l.daysSinceLastInteraction;
  const desc = (f) => (a,b) => { const va=f(a), vb=f(b); if(va==null) return 1; if(vb==null) return -1; return vb-va; };
  const asc  = (f) => (a,b) => { const va=f(a), vb=f(b); if(va==null) return 1; if(vb==null) return -1; return va-vb; };
  switch(modo){
    case "sr-antigos":  return arr.sort(desc(semResp));
    case "sr-recentes": return arr.sort(asc(semResp));
    case "ct-antigos":  return arr.sort(desc(contato));
    case "ct-recentes": return arr.sort(asc(contato));
    case "msg-mais":    return arr.sort(desc(nMsg));
    case "msg-menos":   return arr.sort(asc(nMsg));
    default:            return arr;
  }
}
function setPipelineOrdem(v){ pipelineOrdem = v; carregarPipeline(); }
window.setPipelineOrdem = setPipelineOrdem;

function setPipelineTab(tab){
  pipelineTabAtiva = tab;
  ["oportunidades","ultimos","todos"].forEach(t => {
    const btn = qs("#tab" + t.charAt(0).toUpperCase() + t.slice(1));
    if(!btn) return;
    btn.classList.toggle("active", t === tab);
  });
  const titulo = qs("#pipelineTitulo");
  if(titulo){
    if(tab === "oportunidades") titulo.textContent = "Oportunidades · quem merece atenção agora";
    else if(tab === "ultimos") titulo.textContent = "Últimos atendimentos · atividade recente";
    else titulo.textContent = "Todos os contatos · base completa";
  }
  if(state.active === "pipeline") carregarTelaAtiva("pipeline", true);
  destacarMenuPipeline();
}
window.setPipelineTab = setPipelineTab;

// Pipeline = lista única de todos os leads ativos, ordenada por prioridade.
// Vendido, Perdido e Standby ficam fora (Standby tem grupo próprio na home; perdidos e vendidos têm tela dedicada).
// Resumo do funil pro topo da tela Leads: quantos leads em cada etapa + onde estão mais parados.
function renderFunilResumo(allActive){
  const ORDEM = ["Novo","Atendimento","Visita/Proposta","Negociação","Standby"];
  const cor = { "Novo":"var(--soft)","Atendimento":"var(--dados)","Visita/Proposta":"var(--lime)","Negociação":"var(--acao)","Standby":"var(--muted)" };
  const cont = {}; ORDEM.forEach(e => cont[e] = 0);
  for(const l of allActive){ const e = normalizarEtapa(l.etapa); if(cont[e] != null) cont[e]++; else cont["Atendimento"]++; }
  let gargalo = null, max = 0;
  for(const e of ["Atendimento","Visita/Proposta","Negociação","Standby"]){ if(cont[e] > max){ max = cont[e]; gargalo = e; } }
  const chips = ORDEM.map(e => `<span class="funil-chip" style="color:${cor[e]}"><b>${cont[e]}</b> ${e}</span>`).join("");
  const g = (gargalo && max >= 2) ? `<span class="funil-gargalo">▲ mais parados em ${gargalo}</span>` : "";
  return `<div class="funil-resumo">${chips}${g}</div>`;
}
window.setLeadsView = function(v){ state.leadsView = (v === "etapa" ? "etapa" : "prioridade"); carregarPipeline(); };

async function carregarPipeline(){
  if(state.active !== "pipeline") return;
  const board = qs("#pipelineBoard");
  if(!board) return;
  const renderPipeline = (data) => {
    try{
    const ehAtivo = (l) => { const e = normalizarEtapa(l.etapa); return e !== "Vendido" && e !== "Perdido" && e !== "Geladeira"; };
    const allActive = (data?.items || []).map(limparLead).filter(ehAtivo);
    let items = allActive.slice();
    if(pipelineBuscaTermo){
      const termo = semAcento(pipelineBuscaTermo);
      items = items.filter(l => semAcento(l.name).includes(termo) || semAcento(l.product).includes(termo));
    }
    if(!items.length){
      board.innerHTML = '<div class="empty">Nenhum lead encontrado.</div>';
      return;
    }
    const ehAbaUltimos = pipelineTabAtiva === "ultimos" && (!pipelineOrdem || pipelineOrdem === "prioridade");
    const cardHtml = (l) => {
      const idJs = JSON.stringify(String(l.id||""));
      const nameJs = JSON.stringify(l.name||"");
      // Na aba "Últimos atendimentos" o rótulo mostra QUANDO foi o último atendimento
      // real (agora/hoje/ontem/há X dias), não "dias parado" da última mensagem.
      const dias = ehAbaUltimos
        ? (ultimoAtendimentoTs(l) ? "atendido " + rotuloTempoAtendimento(ultimoAtendimentoTs(l)) : "sem atendimento registrado")
        : (l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction+"d parado" : "");
      const tags = [];
      if(ehEsfriando(l)) tags.push(tagEsfriandoHTML());
      if(ehPermuta(l)) tags.push(tagPermutaHTML());
      if(ehSumicoPosPreco(l)) tags.push(tagSumicoPrecoHTML());
      if(ehContatadoHoje(l)) tags.push(`<span style="display:inline-block;padding:1px 6px;border-radius:999px;font-size:9px;font-weight:950;color:var(--acao);background:rgba(104,255,149,.12);border:1px solid var(--acao);letter-spacing:.04em">✓ HOJE</span>`);
      const waLink = l.phone ? whatsappLink(l.phone||"", "") : "";
      const mostrarMsgs = (pipelineOrdem === "msg-mais" || pipelineOrdem === "msg-menos");
      const msgCount = mostrarMsgs ? totalMensagensLead(l) : null;
      return cardLeadHTML(l, { tagsHtml: tags.join(""), dias, acoesHtml: btnWhatsApp(waLink), msgCount });
    };
    let ord;
    if(pipelineOrdem && pipelineOrdem !== "prioridade"){
      ord = ordenarLeadsPor(items, pipelineOrdem);
    } else if(pipelineTabAtiva === "ultimos"){
      // §6.5: ordena pelo ATENDIMENTO mais recente (todas as fontes), não pela última
      // mensagem. Quem nunca foi atendido cai para o fim, por atividade recente.
      ord = items.slice().sort((a,b) => {
        const ta = ultimoAtendimentoTs(a);
        const tb = ultimoAtendimentoTs(b);
        if(tb !== ta) return tb - ta;
        return String(b.lastInteractionAt || b.createdAt || "").localeCompare(String(a.lastInteractionAt || a.createdAt || ""));
      });
    } else if(pipelineTabAtiva === "todos"){
      ord = items.slice().sort((a,b) => (a.name||"").localeCompare(b.name||"", "pt-BR"));
    } else {
      // Oportunidades = prioridade real de atendimento, não leitura comercial.
      // Corrige o ponto que ainda fazia a tela Leads divergir da Home: lead com
      // contraproposta/pendência aberta deve subir mesmo que o percentual de venda não seja o maior.
      ord = items.slice().sort(compararPrioridadeAtendimento);
    }
    const limite = Number(state.pipelineVisibleCount) || 60;
    const visiveis = ord.slice(0, limite);
    const mais = ord.length > limite ? `<button type="button" class="btn secondary" style="width:100%;margin-top:10px" onclick="state.pipelineVisibleCount=${limite + 60}; carregarTelaAtiva('pipeline', true)">Mostrar mais ${Math.min(60, ord.length-limite)} leads</button>` : "";
    board.innerHTML = `<div class="leads-list">${visiveis.map(cardHtml).join("")}</div>${mais}`;
    }catch(err){ board.innerHTML = boxErro("carregarPipeline()"); }
  };
  if(state.todosLeads?.length){
    renderPipeline({ items: state.todosLeads });
    return;
  }
  board.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
  try{ const data = await getLeadsData(); renderPipeline(data); }catch(err){ board.innerHTML = boxErro("carregarPipeline()"); }
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
  if(!confirm(`Apagar lead "${nome||"sem nome"}"? Não tem como desfazer.`)) return;
  try{
    const ids = coletarDupeIds(id);
    const res = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id, ids, action: "apagar" }) });
    const data = await res.json();
    if(data?.ok){
      toast("Lead apagado.");
      removerLeadDosCaches(id);
      carregarPipeline();
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
  editLeadAvatarFoto = null;
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
        <div style="margin-bottom:14px">
          <button type="button" id="editLeadPrint" style="width:100%;padding:10px;background:rgba(255,255,255,.04);color:var(--soft);border:1px dashed var(--line);border-radius:10px;font-size:13px;font-weight:950;cursor:pointer">📷 Atualizar por print da conversa</button>
          <input type="file" id="editLeadPrintInput" accept="image/*" style="display:none">
          <div id="editLeadFotoWrap" style="display:none;align-items:center;gap:10px;margin-top:8px"><div id="editLeadFotoPrev"></div><button type="button" id="editLeadFotoRemover" style="background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 10px;color:var(--muted);font-size:11px;font-weight:900;cursor:pointer">Remover foto</button></div>
          <div class="small" style="color:var(--muted);font-size:10px;margin-top:5px">Lê o print e completa nome/telefone que faltam + anexa o conteúdo na observação. Se houver foto de perfil no print, ela é recortada automaticamente.</div>
        </div>
        <div style="margin-bottom:14px">
          <div style="display:flex;gap:8px">
            <button type="button" id="editLeadAvatarBtn" style="flex:1;padding:10px;background:rgba(255,98,88,.08);color:var(--lime);border:1px dashed var(--lime);border-radius:10px;font-size:13px;font-weight:950;cursor:pointer">🖼️ Anexar foto</button>
            <button type="button" id="editLeadAvatarColar" style="flex:1;padding:10px;background:rgba(255,98,88,.08);color:var(--lime);border:1px dashed var(--lime);border-radius:10px;font-size:13px;font-weight:950;cursor:pointer">📋 Colar imagem</button>
          </div>
          <input type="file" id="editLeadAvatarInput" accept="image/*" style="display:none">
          <div class="small" style="color:var(--muted);font-size:10px;margin-top:5px">Anexe uma imagem OU copie a foto (Ctrl+C) e clique em Colar. O Corretor Pro recorta o rosto para o avatar.</div>
        </div>
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
          <datalist id="editLeadProdutoLista">${EMPREENDIMENTOS_SENGER.map(p => `<option value="${escapeHtml(p)}"></option>`).join("")}</datalist>
          <div class="small" style="color:var(--muted);font-size:10px;margin-top:5px">Escolha da lista ou digite. Deixe em branco se ainda não souber.</div>
        </div>
        <div style="margin-bottom:12px">
          <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Observação interna</label>
          <textarea id="editLeadObsAnexar" rows="4" placeholder="Anote algo importante sem apagar o histórico." style="width:100%;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box;resize:vertical;line-height:1.35"></textarea>
          <div class="small" style="color:var(--muted);font-size:10px;margin-top:5px">Essa observação entra como memória comercial do lead.</div>
        </div>
        <button type="button" id="editLeadSalvar" style="width:100%;padding:12px;background:linear-gradient(135deg,var(--lime),var(--acao));color:var(--on-accent);border:0;border-radius:10px;font-size:14px;font-weight:950;cursor:pointer;margin-bottom:14px">Salvar</button>
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
  qs("#editLeadPrint")?.addEventListener("click", () => qs("#editLeadPrintInput")?.click());
  qs("#editLeadPrintInput")?.addEventListener("change", lerPrintEditarLead);
  qs("#editLeadAvatarBtn")?.addEventListener("click", () => qs("#editLeadAvatarInput")?.click());
  qs("#editLeadAvatarInput")?.addEventListener("change", (e) => editarAvatarLead(e, String(id)));
  qs("#editLeadAvatarColar")?.addEventListener("click", () => colarAvatarLead(String(id)));
  qs("#editLeadFotoRemover")?.addEventListener("click", () => { editLeadAvatarFoto = null; mostrarPreviaFotoEditar(); });
  qs("#editLeadExcluir")?.addEventListener("click", () => excluirLeadDoModal(String(id), nome || ""));
  // Carrega a observação atual pra dentro do campo (editável). Guarda a memória
  // inteira pra não apagar os outros campos no salvar, e o valor original pra
  // saber se mudou.
  fetch(`./api/lead-update?id=${encodeURIComponent(id)}&action=memoria-get`)
    .then(r => r.json())
    .then(g => {
      const mem = (g && g.memoria) ? g.memoria : {};
      state._editMem = mem;
      const ta = qs("#editLeadObsAnexar");
      if(ta){ ta.value = mem.observacoes || ""; ta.dataset.orig = mem.observacoes || ""; ta.placeholder = "Sem observação ainda."; }
    })
    .catch(() => { const ta = qs("#editLeadObsAnexar"); if(ta) ta.placeholder = "Não consegui carregar a observação."; });
  setTimeout(() => qs(parecePhone(nomeIni) ? "#editLeadTelefone" : "#editLeadNome")?.focus(), 100);
}
function fecharEditarLead(){ qs("#editarLeadModal")?.remove(); }
window.abrirEditarLead = abrirEditarLead;

// Lê o print no modal Editar: completa nome/telefone que estiverem vazios e joga o
// conteúdo na observação (que será anexada ao histórico no salvar).
// Manda o print pro backend extrair os dados, com teto de tempo (nunca trava no "Lendo...").
async function pedirExtracaoPrint(dataUrl){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 58000);
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"extrair-print", imagemBase64: dataUrl }),
      signal: ctrl.signal
    });
    return await res.json().catch(() => ({ ok:false, error:"resposta inválida do servidor" }));
  }catch(e){
    if(e?.name === "AbortError") return { ok:false, error:"demorou demais — tenta de novo ou um print menor" };
    return { ok:false, error: e?.message || "falha de rede" };
  }finally{ clearTimeout(t); }
}
async function lerPrintEditarLead(ev){
  const file = ev.target.files?.[0];
  if(!file){ return; }
  const btn = qs("#editLeadPrint");
  const orig = btn ? btn.textContent : "";
  if(btn){ btn.disabled = true; btn.textContent = "⏳ Lendo o print..."; }
  try{
    const dataUrl = await fileParaDataUrlRedim(file, 1900, 0.88);
    const d = await pedirExtracaoPrint(dataUrl);
    if(d?.ok){
      // Só completa o que estiver vazio — não sobrescreve dado já cadastrado.
      // Exceção: nome vindo de FORMULÁRIO (full_name que o cliente preencheu) vale mais
      // que o apelido do contato salvo pelo corretor — então substitui e avisa.
      let nomeTrocado = "";
      const elNome = qs("#editLeadNome");
      if(d.nome && elNome){
        const atual = elNome.value.trim();
        if(!atual){ elNome.value = d.nome; }
        else if(d.nomeFonte === "formulario" && d.nome.trim().toLowerCase() !== atual.toLowerCase()){
          elNome.value = d.nome; nomeTrocado = atual;
        }
      }
      if(d.telefone && qs("#editLeadTelefone") && !qs("#editLeadTelefone").value.trim()) qs("#editLeadTelefone").value = d.telefone;
      // Empreendimento lido do print (ex.: do card do anúncio) vai PRO CAMPO Empreendimento —
      // assim o produto fica identificado de verdade (e as mensagens usam ele), não só na observação.
      if(d.produto){
        const elProd = qs("#editLeadProduto");
        if(elProd && !elProd.value.trim()) elProd.value = d.produto;
      }
      const extras = [d.email ? ("E-mail: " + d.email) : "", d.observacao || ""].filter(Boolean).join(" · ");
      if(extras){
        const obs = qs("#editLeadObsAnexar");
        const carimbo = new Date().toLocaleDateString("pt-BR");
        if(obs) obs.value = (obs.value ? (obs.value.trim() + "\n\n") : "") + `[${carimbo}] (via print) ${extras}`;
      }
      // Tenta recortar a foto do cliente do print (a IA devolve onde ela está).
      editLeadAvatarFoto = d.avatarBox ? await recortarAvatar(file, d.avatarBox) : null;
      mostrarPreviaFotoEditar();
      if(d.telefoneSuspeito && d.telefone){
        toast("⚠️ Print lido, mas confira o TELEFONE — pode ter vindo com um dígito a menos.");
      } else if(nomeTrocado){
        toast(`✓ Print lido. Troquei o nome pelo do formulário (era "${nomeTrocado}"). Confira e salve.`);
      } else {
        toast(editLeadAvatarFoto ? "✓ Print lido (com foto). Confira e salve." : "✓ Print lido. Confira e salve.");
      }
      // Depois de preencher pelo print, traz o botão SALVAR pra vista (senão ele fica
      // escondido lá embaixo e parece que travou).
      setTimeout(() => qs("#editLeadSalvar")?.scrollIntoView({ behavior:"smooth", block:"center" }), 120);
    } else {
      toast("Não consegui ler: " + (d?.error || "tenta outro print"));
    }
  }catch(err){
    toast("Erro ao ler o print: " + (err?.message || err));
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = orig; }
    if(ev.target) ev.target.value = "";
  }
}

// Modal pra criar lead manualmente (alguém ligou, comentou pessoalmente, indicação)
const EMPREENDIMENTOS_SENGER = []; // v827 §7.1: sem catálogo fixo de empreendimentos (autocomplete fica livre)
function abrirNovoLead(){
  novoLeadAvatarFoto = null;
  qs("#novoLeadModal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "novoLeadModal";
  overlay.className = "ui677-manual-modal";
  const opcoes = EMPREENDIMENTOS_SENGER.map(p => `<option value="${escapeHtml(p)}"></option>`).join("");
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
// Lê o print da conversa/formulário e preenche os campos do lead manual (IA faz a leitura).
// Lê um arquivo de imagem e devolve um dataURL JPEG REDIMENSIONADO (pra não estourar o
// envio quando manda vários prints de uma vez). Cai no original se algo falhar.
function fileParaDataUrlRedim(file, maxDim, quality){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("não consegui abrir a imagem"));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(r.result); // fallback: manda original
      img.onload = () => {
        try{
          let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          const escala = Math.min(1, (maxDim||1400) / Math.max(w, h));
          w = Math.round(w*escala); h = Math.round(h*escala);
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", quality || 0.82));
        }catch(_){ resolve(r.result); }
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
// Foto do cliente recortada do print (dataURL), pra salvar com o lead manual / na edição.
let novoLeadAvatarFoto = null;
let editLeadAvatarFoto = null;
// Recorta a região da foto (caixa normalizada 0–1 que a IA devolveu) do print original,
// em quadrado ~200px. Roda no navegador. Devolve dataURL JPEG ou null se falhar.
// Detecta se o recorte é uma "foto" sem rosto (avatar padrão do WhatsApp): mede o desvio
// de cor dos pixels amostrados. Foto real tem variação alta; silhueta cinza/branca tem variação baixa.
function fotoQuaseVazia(ctx, size){
  try{
    const d = ctx.getImageData(0, 0, size, size).data;
    let n = 0, somaL = 0, somaL2 = 0;
    for(let i = 0; i < d.length; i += 16){ // amostra 1 a cada 4 pixels
      const L = (d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114);
      somaL += L; somaL2 += L*L; n++;
    }
    if(!n) return true;
    const media = somaL/n;
    const variancia = somaL2/n - media*media;
    const desvio = Math.sqrt(Math.max(0, variancia));
    // desvio baixo = imagem chapada (cinza/branco uniforme) → não é rosto
    return desvio < 18;
  }catch(_){ return false; }
}
// Recebe um arquivo de imagem e devolve um dataURL QUADRADO (recorte central),
// pronto pro avatar redondo. Sem IA: o corretor manda a imagem já enquadrada.
function imagemQuadradaParaAvatar(file){
  return new Promise((resolve) => {
    if(!file) return resolve(null);
    const r = new FileReader();
    r.onerror = () => resolve(null);
    r.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        try{
          const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
          const s = Math.min(W, H);                  // maior quadrado que cabe na imagem
          const sx = (W - s) / 2, sy = (H - s) / 2;  // centralizado
          const out = 256;
          const c = document.createElement("canvas"); c.width = out; c.height = out;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#000"; ctx.fillRect(0, 0, out, out); // fundo PRETO (combina com o tema escuro; nunca branco)
          ctx.drawImage(img, sx, sy, s, s, 0, 0, out, out);
          resolve(c.toDataURL("image/jpeg", 0.88));
        }catch(_){ resolve(null); }
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
// Núcleo: recebe um arquivo/imagem → encaixa o quadrado central no avatar → salva no lead.
async function processarAvatarFile(file, id){
  if(!file || !id) return;
  toast("⏳ Ajustando a foto no avatar…");
  try{
    // O corretor manda a imagem já quadrada/enquadrada. Sem IA: pega o quadrado central
    // e o avatar redondo (object-fit:cover) preenche o círculo certinho.
    const foto = await imagemQuadradaParaAvatar(file);
    if(!foto){ toast("Não consegui usar essa imagem — tenta outra."); return; }
    const save = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"editar-dados", id, avatarFoto: foto })
    });
    const sd = await save.json().catch(()=>({ok:false}));
    if(!sd?.ok){ toast("Não consegui salvar a foto: " + (sd?.error||"erro")); return; }
    if(state.lead && String(state.lead.id) === String(id)){
      state.lead.avatarFoto = foto;
      if(state.lead.analysis) state.lead.analysis.avatarFoto = foto;
      renderLeadFoco(state.lead);
    }
    invalidarLeadsCache?.();
    toast("✓ Avatar atualizado.");
  }catch(err){ toast("Erro: " + (err?.message || err)); }
}
// Editar avatar por ARQUIVO anexado.
async function editarAvatarLead(ev, id){
  const file = ev?.target?.files?.[0];
  if(ev?.target) ev.target.value = "";
  await processarAvatarFile(file, id);
}
// Editar avatar COLANDO (Ctrl+V): lê a imagem da área de transferência.
async function colarAvatarLead(id){
  try{
    if(!navigator.clipboard?.read){ toast("Seu navegador não deixa colar daqui — use o botão de anexar."); return; }
    const itens = await navigator.clipboard.read();
    for(const item of itens){
      const tipo = item.types.find(t => t.startsWith("image/"));
      if(tipo){
        const blob = await item.getType(tipo);
        const file = new File([blob], "colado.png", { type: tipo });
        await processarAvatarFile(file, id);
        return;
      }
    }
    toast("Não tem imagem na área de transferência. Copie a foto primeiro (Ctrl+C).");
  }catch(err){ toast("Não consegui colar: " + (err?.message || err)); }
}
// Ctrl+V no perfil do lead cola a imagem direto no avatar.
function ligarColarAvatarGlobal(id){
  if(window._colarAvatarHandler) document.removeEventListener("paste", window._colarAvatarHandler);
  window._colarAvatarHandler = async (e) => {
    if(!state.lead || String(state.lead.id) !== String(id)) return;
    const items = e.clipboardData?.items || [];
    for(const it of items){
      if(it.type && it.type.startsWith("image/")){
        e.preventDefault();
        const blob = it.getAsFile();
        if(blob) await processarAvatarFile(blob, id);
        return;
      }
    }
  };
  document.addEventListener("paste", window._colarAvatarHandler);
}
window.editarAvatarLead = editarAvatarLead;
window.colarAvatarLead = colarAvatarLead;

function recortarAvatar(file, box){
  return new Promise((resolve) => {
    if(!file || !box) return resolve(null);
    const r = new FileReader();
    r.onerror = () => resolve(null);
    r.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        try{
          const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
          let sw = box.w*W, sh = box.h*H;
          const side = Math.max(sw, sh);                 // quadrado, sem distorcer (o recorte já é a foto: a IA devolve a caixa justa só no círculo)
          const cx = box.x*W + sw/2, cy = box.y*H + sh/2; // centro da caixa = centro da foto
          let s = side, sx = cx - s/2, sy = cy - s/2;
          if(sx < 0) sx = 0; if(sy < 0) sy = 0;
          if(sx + s > W) s = W - sx; if(sy + s > H) s = Math.min(s, H - sy);
          s = Math.max(8, s);
          const out = 200;
          const c = document.createElement("canvas"); c.width = out; c.height = out;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#000"; ctx.fillRect(0, 0, out, out); // fundo PRETO (combina com o tema escuro; nunca branco)
          ctx.drawImage(img, sx, sy, s, s, 0, 0, out, out);
          // Descarta avatar "vazio" (silhueta/ícone padrão do WhatsApp): se a imagem tem
          // pouquíssima variação de cor (quase tudo cinza/branco igual), não é foto real.
          if(fotoQuaseVazia(ctx, out)){ resolve(null); return; }
          resolve(c.toDataURL("image/jpeg", 0.85));
        }catch(_){ resolve(null); }
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
// Mostra/esconde a prévia da foto recortada no modal de novo lead.
function mostrarPreviaFoto(){
  const wrap = qs("#novoLeadFotoWrap"), prev = qs("#novoLeadFotoPrev");
  if(!wrap || !prev) return;
  if(novoLeadAvatarFoto){
    prev.innerHTML = `<img src="${escapeHtml(novoLeadAvatarFoto)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--lime)">`;
    wrap.style.display = "flex";
  } else {
    prev.innerHTML = ""; wrap.style.display = "none";
  }
}
async function lerPrintLead(ev){
  const file = ev.target.files?.[0];
  if(!file){ return; }
  const btn = qs("#novoLeadPrint");
  const orig = btn ? btn.textContent : "";
  if(btn){ btn.disabled = true; btn.textContent = "⏳ Lendo o print..."; }
  setPrintStatus("#novoLeadPrintStatus", "info", "⏳ Lendo o print...");
  try{
    const dataUrl = await fileParaDataUrlRedim(file, 1900, 0.88);
    const d = await pedirExtracaoPrint(dataUrl);
    if(d?.ok){
      const algum = !!(d.nome || d.telefone || d.produto || d.email || d.observacao);
      if(d.nome && qs("#novoLeadNome")) qs("#novoLeadNome").value = d.nome;
      if(d.telefone && qs("#novoLeadTel")) qs("#novoLeadTel").value = d.telefone;
      if(d.produto){
        const sel = qs("#novoLeadProduto");
        const opt = sel ? [...sel.options].find(o => o.value.toLowerCase() === String(d.produto).toLowerCase()) : null;
        if(sel && opt) sel.value = opt.value;
      }
      const extras = [d.email ? ("E-mail: " + d.email) : "", d.observacao || ""].filter(Boolean).join(" · ");
      if(extras){
        const obs = qs("#novoLeadObs");
        if(obs) obs.value = obs.value ? (obs.value + " · " + extras) : extras;
      }
      // Tenta recortar a foto do cliente (a IA devolve onde ela está no print).
      novoLeadAvatarFoto = d.avatarBox ? await recortarAvatar(file, d.avatarBox) : null;
      mostrarPreviaFoto();
      const comFoto = novoLeadAvatarFoto ? " (foto incluída — confira na prévia)" : "";
      if(algum && d.telefoneSuspeito && d.telefone){
        setPrintStatus("#novoLeadPrintStatus", "warn", "⚠️ Confira o TELEFONE — pode ter vindo com um dígito a menos." + comFoto);
        toast("⚠️ Confira o telefone — pode ter vindo errado do print.");
      }
      else if(algum){ setPrintStatus("#novoLeadPrintStatus", "ok", "✓ Dados lidos do print. Confira e salve." + comFoto); toast("✓ Dados lidos do print. Confira e salve."); }
      else { setPrintStatus("#novoLeadPrintStatus", "warn", "Li o print mas não achei dados de cliente nele. Tenta um print que mostre nome/telefone."); }
    } else {
      setPrintStatus("#novoLeadPrintStatus", "err", "Não consegui ler. Motivo: " + (d?.error || "desconhecido"));
    }
  }catch(err){
    setPrintStatus("#novoLeadPrintStatus", "err", "Erro ao ler o print: " + (err?.message || err));
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = orig; }
    if(ev.target) ev.target.value = "";
  }
}
// Mostra um aviso FIXO embaixo do botão de print (não some como o toast).
function setPrintStatus(sel, tipo, msg){
  const el = qs(sel); if(!el) return;
  const cores = {
    info: ["rgba(0,212,255,.10)", "#7fe3ff"],
    ok:   ["rgba(0,200,120,.12)", "#7CFFB0"],
    warn: ["rgba(255,190,0,.12)", "#FFD66B"],
    err:  ["rgba(255,80,80,.12)", "#FF9C9C"]
  };
  const [bg, fg] = cores[tipo] || cores.info;
  el.style.display = "block";
  el.style.background = bg;
  el.style.color = fg;
  el.textContent = msg;
}
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
      else if(typeof cp788AbrirCarteiraAtiva === "function") cp788AbrirCarteiraAtiva();
      else show("pipeline", { navKey:"negocios" });
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
  const obsField = qs("#editLeadObsAnexar");
  const obsNova = (obsField?.value || "").trim();
  const obsOrig = (obsField?.dataset.orig || "").trim();
  const obsMudou = obsNova !== obsOrig;
  if(!nome && !telefone && !produto && !obsMudou && !editLeadAvatarFoto){ toast("Nada pra salvar."); return; }
  const btn = qs("#editLeadSalvar");
  if(btn){ btn.disabled = true; btn.textContent = "Salvando..."; }
  try{
    if(nome || telefone || produto || editLeadAvatarFoto){
      const res = await fetch("./api/lead-update", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ id, action:"editar-dados", nome, telefone, produto, avatarFoto: editLeadAvatarFoto || "" })
      });
      const data = await res.json();
      if(!data?.ok){ toast("Erro: " + (data?.error || "falhou")); if(btn){ btn.disabled=false; btn.textContent="Salvar"; } return; }
    }
    if(obsMudou){
      // Salva a observação já (fallback instantâneo, sem apagar os outros campos da memória)...
      const mem = state._editMem || {};
      const resMem = await fetch("./api/lead-update", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ id, action:"memoria-set", preferencias: mem.preferencias||"", pessoasDecisao: mem.pessoasDecisao||"", pontosSensiveis: mem.pontosSensiveis||"", observacoes: obsNova })
      }).catch(() => null);
      if(!resMem?.ok){ toast("Erro ao salvar observação — tente de novo."); if(btn){ btn.disabled=false; btn.textContent="Salvar"; } return; }
    }
    fecharEditarLead();
    if(obsMudou){
      // ...e CONSERTA A FONTE: troca a nota antiga da linha do tempo pelo texto corrigido
      // e reanalisa, pra "Por quê este lead" parar de repetir o texto errado.
      toast("Corrigindo e reanalisando…");
      const r = await fetch("./api/reanalisar-lead", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(payloadComCerebro({ id, action:"corrigir-observacao", texto: obsNova }))
      });
      const dr = await r.json().catch(() => ({ ok:false }));
      if(dr?.ok){ toast("Análise corrigida."); }
      else { toast("Observação salva, mas a reanálise falhou: " + (dr?.error||"erro")); }
    } else if(produtoMudou){
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
    const fotoNova = editLeadAvatarFoto;
    patchLeadCache(id, { name: nome, phone: telefone, avatarFoto: fotoNova });
    await abrirLead(id);
    // Garante que a foto recém-salva apareça NA HORA (sem depender do cache/lag do banco) —
    // reforça o avatar direto no lead em foco, igual ao fluxo do "Editar avatar".
    if(fotoNova && state.lead && String(state.lead.id) === String(id)){
      state.lead.avatarFoto = fotoNova;
      state.analysis = state.analysis || {};
      state.analysis.avatarFoto = fotoNova;
      renderLeadFoco({ ...state.lead, analysis: state.analysis });
    }
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
  if(!confirm(`Excluir DEFINITIVAMENTE o lead "${nome||"sem nome"}"?\n\nIsso apaga tudo (conversa, análise, histórico). Não tem como desfazer.`)) return;
  try{
    const ids = coletarDupeIds(id);
    const res = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id, ids, action: "apagar" }) });
    const data = await res.json();
    if(data?.ok){
      toast("Lead excluído.");
      state.lead = null; state.focoLeadId = null; state.analysis = null;
      removerLeadDosCaches(id);
      if(typeof carregarDashboard === "function") carregarDashboard();
      if(typeof carregarPipeline === "function") carregarPipeline();
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
    renderLeadFoco(state.lead);
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
  "objecao-tratar": { txt:"Tratar objeção", cor:"var(--morno)", bg:"rgba(255,155,59,.14)" },
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
function voltarDoLead(){
  if(typeof cp7ObsPararGravacaoSeAtiva === "function") cp7ObsPararGravacaoSeAtiva();
  if(history.state?.cpApp && history.state?.screen === "lead"){ history.back(); return; }
  cpClearLeadState();
  if(state.grupoAtivo){ abrirGrupoHome(state.grupoAtivo,{fromHistory:true}); }
  else { renderBotoesHome(); }
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
      .cp704-lead{display:flex;flex-direction:column;gap:14px;padding-bottom:20px;width:100%;max-width:1180px;margin:0 auto;color:var(--text)}.cp704-workspace{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.82fr);gap:14px;align-items:start}.cp704-primary,.cp704-secondary{display:flex;flex-direction:column;gap:14px;min-width:0}.cp704-secondary .cp704-accordions{width:100%}.cp704-herorow{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,.85fr);gap:14px;align-items:stretch}.cp704-obscard{gap:6px}.cp704-obscard textarea{width:100%;box-sizing:border-box}.cp704-tools-open .cp704-card-title{margin-bottom:12px}.cp704-tools-row{display:flex;flex-wrap:wrap;gap:8px}.cp704-tools-row button{flex:1 1 150px;min-width:130px;padding:12px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--text);font-weight:900;font-size:13px;cursor:pointer}.cp704-tools-row button.good{border-color:rgba(104,255,149,.5);background:rgba(104,255,149,.1);color:#68ff95}.cp704-tools-row button.cp704-danger{border-color:rgba(255,98,88,.45);background:rgba(255,98,88,.08);color:#ff7f74}.cp704-hist-inline{flex:1 1 160px;min-width:140px;align-self:flex-start;padding:0;border:0;background:transparent}.cp704-hist-inline[open]{flex-basis:100%}.cp704-hist-inline>summary{list-style:none;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--text);font-weight:900;font-size:13px;cursor:pointer;white-space:nowrap}.cp704-hist-inline>summary::-webkit-details-marker{display:none}.cp704-hist-inline[open]>summary .cp704-hist-arrow{transform:rotate(180deg)}.cp704-hist-inline .cp704-body{margin-top:10px;max-height:340px;overflow:auto;width:100%}
      .cp704-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0 4px}.cp704-top-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.cp704-reanalyse{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.045);color:var(--text);border-radius:999px;padding:8px 12px;font-weight:950;font-size:12px;white-space:nowrap;cursor:pointer}
      .cp704-reanalyse-destaque{background:linear-gradient(135deg,rgba(86,199,242,.22),rgba(86,199,242,.09))!important;border-color:rgba(86,199,242,.6)!important;color:#d3efff!important;box-shadow:0 0 0 1px rgba(86,199,242,.18),0 6px 16px rgba(86,199,242,.12)}
      .cp704-reanalyse-destaque:hover{background:linear-gradient(135deg,rgba(86,199,242,.30),rgba(86,199,242,.14))!important;border-color:rgba(86,199,242,.85)!important}
      .cp704-back{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--text);font-weight:800;font-size:13px;padding:8px 15px;border-radius:999px;cursor:pointer;line-height:1;transition:background .15s,border-color .15s,color .15s,transform .05s}
.cp704-back:hover{background:rgba(255,98,88,.12);border-color:rgba(255,98,88,.45);color:var(--text)}
.cp704-back:active{transform:translateY(1px)}
      .cp704-attended{border:1px solid rgba(104,255,149,.55);background:rgba(104,255,149,.10);color:#68ff95;border-radius:999px;padding:8px 12px;font-weight:950;font-size:12px;white-space:nowrap}
      .cp704-attended:not(:disabled){cursor:pointer}.cp704-attended:disabled{opacity:.96}
      .cp704-hero{border:1px solid rgba(255,255,255,.10);background:linear-gradient(135deg,rgba(7,52,64,.92),rgba(5,31,40,.96));border-radius:18px;padding:15px;box-shadow:0 14px 45px rgba(0,0,0,.20)}
      .cp704-hero h1{font-size:28px;line-height:1.04;margin:0 0 8px;font-weight:950;letter-spacing:-.03em;color:var(--text)}
      .cp704-tags{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.cp704-tag{font-size:11px;color:var(--muted);background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.075);padding:5px 8px;border-radius:999px;font-weight:850}
      .cp704-mainrow{display:grid;grid-template-columns:1fr;gap:12px;align-items:center}.cp704-situation{display:flex;flex-direction:column;gap:8px}.cp704-pill{display:inline-flex;align-items:center;gap:6px;width:max-content;max-width:100%;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:950;border:1px solid rgba(255,201,107,.45);background:rgba(255,201,107,.10);color:#ffd28a}.cp704-pill.green{border-color:rgba(104,255,149,.45);background:rgba(104,255,149,.10);color:#68ff95}.cp704-pill.red{border-color:rgba(255,98,88,.45);background:rgba(255,98,88,.10);color:#ff7f74}.cp704-situation p{margin:0;color:rgba(237,246,248,.92);font-size:14px;line-height:1.45}.cp704-etapa{gap:7px}.cp704-etapa .cp704-etapa-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;display:inline-block;box-shadow:0 0 0 3px rgba(255,255,255,.05)}
      .cp704-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px;padding-top:13px;border-top:1px solid rgba(255,255,255,.08)}.cp704-metric{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;color:rgba(237,246,248,.92)}.cp704-metric small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:1px}
      .cp704-card{border:1px solid rgba(255,255,255,.10);background:rgba(7,52,64,.72);border-radius:16px;padding:14px}.cp704-card-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.cp704-card-title h2{font-size:17px;margin:0;font-weight:950}.cp704-card-title small{font-size:11px;color:var(--muted);font-weight:850}
      .cp704-last{display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:center;color:rgba(237,246,248,.95);font-size:13px}.cp704-last b{font-weight:950}.cp704-last span{display:block;color:var(--muted);font-size:12px;margin-top:2px}
      .cp704-ai ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}.cp704-ai li{display:grid;grid-template-columns:20px 1fr;gap:8px;line-height:1.35;color:rgba(237,246,248,.92);font-size:14px}.cp704-ai i{font-style:normal;color:#68ff95;font-weight:950}
      .cp704-step{margin:0}.cp704-step p{margin:0;font-size:14px;line-height:1.45;color:rgba(237,246,248,.94)}.cp704-metaline{margin-top:12px;padding-top:11px;border-top:1px solid rgba(255,255,255,.08);color:var(--soft);font-size:12px;line-height:1.4;font-weight:700}.cp704-metaline+.cp704-metaline{margin-top:2px;padding-top:0;border-top:0}.cp704-msg-sub{margin:15px 0 9px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.14em;font-weight:950}
      .cp704-msg-list{display:flex;flex-direction:column;gap:10px}.cp704-msg-item{display:grid;grid-template-columns:1fr auto;gap:9px 12px;align-items:start;padding:12px;border:1px solid rgba(255,255,255,.085);border-radius:14px;background:rgba(255,255,255,.025)}.cp704-msg-head{grid-column:1/-1;display:flex;align-items:center;gap:8px}.cp704-msg-head b{font-size:12px;font-weight:950;color:rgba(237,246,248,.96)}.cp704-num{width:22px;height:22px;border-radius:999px;background:var(--lime);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:950;flex:0 0 auto}.cp704-msg-item:nth-child(2) .cp704-num{background:#ffbf5a}.cp704-msg-item:nth-child(3) .cp704-num{background:#ff5e52}.cp704-msg-item p{margin:0;font-size:13px;line-height:1.45;color:rgba(237,246,248,.93)}.cp704-copy{align-self:center;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.035);color:var(--text);border-radius:10px;padding:8px 12px;font-size:11px;font-weight:900;cursor:pointer;min-width:72px}.cp704-copy:hover{border-color:rgba(255,98,88,.55);background:rgba(255,98,88,.08)}.cp704-empty-analysis{border:1px solid rgba(255,201,107,.35);background:rgba(255,201,107,.07);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px}.cp704-empty-analysis b{color:#ffd28a}.cp704-empty-analysis span{color:var(--muted);font-size:13px}.cp704-empty-analysis button{border:1px solid rgba(255,201,107,.45);background:rgba(255,255,255,.04);color:#ffd28a;border-radius:12px;padding:11px;font-weight:950;margin-top:4px}
      .cp704-accordions{display:flex;flex-direction:column;gap:9px}.cp704-details{border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(7,52,64,.58);overflow:hidden}.cp704-details summary{list-style:none;cursor:pointer;padding:13px 14px;font-size:14px;font-weight:950;display:flex;align-items:center;justify-content:space-between;gap:10px}.cp704-details summary::-webkit-details-marker{display:none}.cp704-details summary:after{content:"⌄";color:var(--muted);flex:0 0 auto}.cp704-details[open] summary:after{content:"⌃"}.cp704-summary-left{display:inline-flex;align-items:center;gap:8px;min-width:0}.cp704-summary-actions{display:inline-flex;align-items:center;gap:10px;margin-left:auto}.cp704-copy-history{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.045);color:var(--text);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:950;cursor:pointer;white-space:nowrap}.cp704-copy-history:hover{border-color:rgba(255,98,88,.55);background:rgba(255,98,88,.10)}.cp704-body{padding:0 14px 14px;color:rgba(237,246,248,.92);font-size:13px;line-height:1.45}.cp704-timeline{display:flex;flex-direction:column;gap:0}.cp704-tmsg{display:grid;grid-template-columns:14px 1fr;gap:9px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.075)}.cp704-dot{width:8px;height:8px;border-radius:50%;background:#8aa1ad;margin-top:6px}.cp704-dot.you{background:var(--lime)}.cp704-dot.obs{background:var(--cyan)}.cp704-dot.sys{background:#8aa1ad;opacity:.45}.cp704-tmsg-obs b{color:var(--cyan)!important;text-transform:uppercase;letter-spacing:.06em;font-size:10px!important}.cp704-tmsg-obs p{color:rgba(210,239,255,.92)}.cp704-tmsg-sys b{color:var(--muted)!important}.cp704-tmsg b{font-size:12px}.cp704-tmsg p{margin:2px 0 3px}.cp704-tmsg small{color:var(--muted);font-size:11px}.cp704-full-btn{width:100%;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.03);color:var(--text);border-radius:10px;padding:10px;margin-top:10px;font-weight:900;cursor:pointer}.cp704-rows{display:flex;flex-direction:column}.cp704-row{padding:9px 0;border-bottom:1px solid rgba(255,255,255,.075)}.cp704-row small{display:block;text-transform:uppercase;letter-spacing:.13em;color:var(--muted);font-size:9px;font-weight:950;margin-bottom:3px}.cp704-row div{font-size:13px;color:rgba(237,246,248,.94)}
      .cp704-actions-group{margin-top:10px}.cp704-actions-group h3{font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted);margin:0 0 7px}.cp704-actions-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cp704-actions-grid button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);color:var(--text);border-radius:11px;padding:10px 8px;font-size:12px;font-weight:900;cursor:pointer}.cp704-actions-grid button.good{border-color:rgba(104,255,149,.35);color:#68ff95}.cp704-actions-grid button.warn{border-color:rgba(255,201,107,.35);color:#ffd28a}.cp704-actions-grid button.bad{border-color:rgba(255,98,88,.42);color:#ff7f74}.cp704-danger{width:100%;border:1px solid rgba(255,98,88,.55)!important;color:#ff7f74!important;background:rgba(255,98,88,.06)!important}.cp704-quickbar{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cp704-quickbar button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);color:var(--text);border-radius:11px;padding:10px 8px;font-size:12px;font-weight:900;cursor:pointer}.cp704-quickbar button.good{color:#68ff95;border-color:rgba(104,255,149,.35)}
      .cp704-stale{border-color:rgba(255,201,107,.45);background:rgba(255,201,107,.08)}.cp704-stale button{margin-top:10px;width:100%;border:1px solid rgba(255,201,107,.50);border-radius:12px;background:rgba(255,255,255,.04);color:#ffd28a;padding:12px;font-weight:950}
      .cp715-reading{font-size:13px;line-height:1.46;color:rgba(237,246,248,.94)}
      .cp704-body{overflow-wrap:anywhere;word-break:normal}.cp704-row div{overflow-wrap:anywhere}.cp704-tag,.cp704-pill{min-width:0;overflow:hidden;text-overflow:ellipsis}
      .cp704-card,.cp704-details,.cp704-hero{box-sizing:border-box;max-width:100%}.cp704-lead *{box-sizing:border-box}
      .ui682-analysis-progress{box-sizing:border-box;max-width:100%!important;min-width:0!important;width:100%!important;overflow:hidden;grid-column:1/-1;flex-basis:100%;clear:both}.ui682-analysis-progress div{min-width:0}.ui682-analysis-progress span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cp704-top .ui682-analysis-progress{margin-left:0!important;margin-right:0!important}
      @media(max-width:999px){.cp704-lead{max-width:760px}.cp704-workspace{grid-template-columns:minmax(0,1fr)}.cp704-herorow{grid-template-columns:minmax(0,1fr)}.cp704-primary,.cp704-secondary{gap:12px}}
      @media(max-width:560px){.cp704-lead{gap:12px;padding:0 0 18px}.cp704-top{display:grid;grid-template-columns:1fr;align-items:start;gap:10px;margin:0 0 2px}.cp704-back{justify-self:start;font-size:14px;padding:9px 16px}.cp704-top-actions{max-width:none;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px}.cp704-reanalyse,.cp704-attended{font-size:12px;padding:10px 10px;width:100%;min-width:0;border-radius:999px}.cp704-hero h1{font-size:27px}.cp704-mainrow{grid-template-columns:1fr;gap:12px}.cp704-metrics{grid-template-columns:1fr 1fr}.cp704-msg-item{grid-template-columns:1fr;position:relative}.cp704-copy{justify-self:end}.cp704-actions-grid{grid-template-columns:1fr 1fr}.cp704-card{padding:13px}.cp704-quickbar{grid-template-columns:1fr 1fr;position:sticky;bottom:10px;z-index:5;background:rgba(3,34,43,.78);backdrop-filter:blur(10px);padding:6px;border-radius:14px}.cp704-actions-grid button,.cp704-quickbar button{min-height:46px}.cp704-body{font-size:13px}.cp704-row{padding:8px 0}}
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
    if(/perdid|encerr/.test(st)) return 'Perdido';
    if(/ganh|vend/.test(st)) return 'Vendido';
    if(/geladeira/.test(st)) return 'Arquivado';
    return cp704Text(mc?.oportunidade?.status || lead?.etapa || 'Em descoberta');
  }
  // v818: etapa da jornada em linguagem simples, com passo (1..6) e cor que esquenta pro
  // verde conforme aproxima o fechamento. Fonte: status da oportunidade / etapa do lead.
  function cp704Jornada(lead, mc){
    const normal = (typeof normalizarEtapa==='function') ? normalizarEtapa(lead?.etapa) : String(lead?.etapa||'');
    if(normal==='Vendido')   return { label:'Vendido',   passo:6, cor:'#2fe27a', bg:'rgba(47,226,122,.16)',  br:'rgba(47,226,122,.55)' };
    if(normal==='Perdido')   return { label:'Perdido',   passo:0, cor:'#ff7f74', bg:'rgba(255,127,116,.12)', br:'rgba(255,127,116,.45)' };
    if(normal==='Geladeira') return { label:'Arquivado', passo:0, cor:'#9fb1bd', bg:'rgba(159,177,189,.12)', br:'rgba(159,177,189,.40)' };
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
  function cp704TimelineHtml(lead){
    const all=Array.isArray(lead?.recentMessages)?lead.recentMessages.filter(m=>cp704Text(m?.text)):[];
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
      return `<div class="cp704-tmsg${wrapCls}"><span class="cp704-dot ${dotCls}"></span><div><b>${escapeHtml(who)}</b><p>${escapeHtml(cp704Text(m.text).slice(0,520))}</p><small>${escapeHtml(cp704DataHora(m))}</small></div></div>`;
    }).join('') + btn;
  }
  function cp704DetailRows(lead,mc){
    const a=lead?.analysis||{}, mem=a.memoria||a.memoriaSugerida||{};
    const rows=[
      ['Papel do contato',mc?.contato?.papel || a.tipoContato],
      ['Comprador final',mc?.oportunidade?.compradorFinal || mc?.contato?.compradorFinal],
      ['Produto',cp704Produto(lead,mc)],
      ['Resultado',mc?.oportunidade?.resultado || lead?.etapa],
      ['Permuta / entrada com imóvel',/^não identificado$/i.test(cp704Text(a?.diagnostico?.pendenciaFinanceira))?'':a?.diagnostico?.pendenciaFinanceira],
      ['Último compromisso',mc?.contexto?.ultimoCompromisso || a?.diagnostico?.pendencia],
      ['Impedimento principal',mc?.acao?.motivo || a.risk || a?.diagnostico?.objecaoPrincipal],
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
    try{ registrarMensagemEnviada(state.lead?.id, msg); }catch(_){}
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
      requestAnimationFrame(()=>{
        const details=[...document.querySelectorAll('.cp704-details')].find(d=>/Últimas mensagens/i.test(d.textContent||''));
        if(details){ details.open=true; details.scrollIntoView({behavior:'smooth',block:'center'}); }
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
    return `<div class="cp704-actions-group"><h3>Comerciais</h3><div class="cp704-actions-grid"><button type="button" onclick='abrirPropostaComLead(${name},${prod},${id})'>Gerar proposta</button></div></div>
    <div class="cp704-actions-group"><h3>Gestão</h3><div class="cp704-actions-grid"><button type="button" onclick='cp715EditarLead(${id})'>Editar lead</button><button type="button" onclick='arquivarLead(${id},${name})'>Arquivar</button></div></div>
    <div class="cp704-actions-group"><h3>Encerramento</h3><div class="cp704-actions-grid"><button type="button" class="good" onclick='(typeof marcarVendido==="function")?marcarVendido(${id},${name}):abrirPropostaComLead(${name},${prod},${id})'>Vendido</button></div></div>
    <div class="cp704-actions-group"><h3>Perigo</h3><div class="cp704-actions-grid"><button type="button" class="cp704-danger" onclick='excluirLeadDefinitivo(${id},${name})'>Excluir definitivamente</button></div></div>`;
  }
  // v822: versão "aberta" das ferramentas — todos os botões lado a lado, no rodapé do lead.
  // (Editar lead fica só na barra de ações acima, pra não duplicar.)
  function cp704ToolsFlat(lead,mc){
    const id=JSON.stringify(String(lead?.id||'')); const name=(typeof safeJson==='function')? safeJson(lead?.name||'') : JSON.stringify(String(lead?.name||'')); const prod=(typeof safeJson==='function')? safeJson(cp704Produto(lead,mc)) : JSON.stringify(cp704Produto(lead,mc));
    return `<button type="button" onclick='abrirPropostaComLead(${name},${prod},${id})'>Gerar proposta</button><button type="button" onclick='arquivarLead(${id},${name})'>Arquivar</button><button type="button" class="good" onclick='(typeof marcarVendido==="function")?marcarVendido(${id},${name}):abrirPropostaComLead(${name},${prod},${id})'>Vendido</button><button type="button" class="cp704-danger" onclick='excluirLeadDefinitivo(${id},${name})'>Excluir definitivamente</button>`;
  }

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
  const primarios = [a?.reanalisadoEm, a?.geradoEm, a?.analisadoEm];
  for(const c of primarios){ if(c && Number.isFinite(Date.parse(c))) return c; }
  const fallback = [lead?.analysisReadyAt, lead?.updatedAt, lead?.atualizadoEm, lead?.criadoEm];
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
  document.querySelector('#ui683AtendidosHojeCard')?.remove();
  document.body.classList.add('lead-foco-aberto');
  state.focoLeadId=lead?.id||null;
  const saud=document.querySelector('#saudacao');
  if(saud) saud.style.display='none';
    const a=lead.analysis||{}, mc=cp704Modelo(lead), imped=cp704Impedimento(lead,mc), next=cp704Next(lead,mc), msgs=cp704Msgs(lead);
    const stale=!analiseAtualValida752(a);
    const messagesReady=cp705MessagesReady(msgs);
    const semAcaoUrgente=analiseAtualValida752(a) && String(mc?.acao?.status||'')==='sem-acao-urgente';
    const needsAnalysis=stale;
    const attended=(typeof ehContatadoHoje==='function') ? ehContatadoHoje(lead) : false;
    const last=cp705FormatDateTime(lead.lastInteractionAt || lead.lastActivityAt || lead.lastInteraction || '');
    const analiseEm=cp705FormatDateTime(cp865UltimaAnaliseISO(lead, a));
    const atendimento=ultimoAtendimentoDataHora(lead);
    const rel=cp704Text(mc?.relacionamento?.status || 'Ativo');
    const urg=cp704Text(mc?.acao?.urgencia || mc?.acao?.prioridade || 'Média');
    area.innerHTML=`<div class="cp704-lead">
      <div class="cp704-top"><button class="cp704-back" onclick="voltarDoLead()">‹ Voltar</button><div class="cp704-top-actions"><button class="cp704-reanalyse cp704-reanalyse-destaque" type="button" onclick="ui670Reanalisar(this)">↻ Reanalisar</button><button type="button" class="cp704-reanalyse" style="color:#ffd28a;border-color:rgba(255,201,107,.4)" onclick="ui670Toggle&&ui670Toggle('ui670SchedulePanel')">Agendar retorno</button><button type="button" class="cp704-reanalyse" onclick='cp715EditarLead(${JSON.stringify(String(lead.id||''))})'>Editar lead</button><button class="cp704-attended" onclick="ui667MarcarAtendido(this)" ${attended?'disabled':''}>${attended?'Atendido hoje':'Marcar atendimento'}</button></div></div>
      <div class="cp704-herorow">
        <section class="cp704-hero">
          <h1>${escapeHtml(lead.name||'Contato')}</h1><div class="cp704-tags"><span class="cp704-tag">${escapeHtml(cp704Text(mc?.contato?.papel||a.tipoContato||'Comprador direto'))}</span></div>
          <div class="cp704-mainrow"><div class="cp704-situation">${cp704JornadaBadge(lead,mc)}<p>${escapeHtml(cp705SanitizeFactText(imped,lead))}</p></div></div>
          ${analiseEm?`<div class="cp704-metaline">${escapeHtml(`Última análise — ${analiseEm}`)}</div>`:''}
          <div class="cp704-metaline">${escapeHtml([last?`Última mensagem — ${last}`:'',atendimento?`Último atendimento — ${atendimento}`:''].filter(Boolean).join(' · ')||'Sem data registrada')}</div>
        </section>
        <section class="cp704-card cp704-obscard">
          <div class="cp704-card-title"><h2>Registrar observação</h2></div>
          <p style="margin:0 0 10px;color:var(--muted);font-size:13px">Registre algo que aconteceu fora do WhatsApp (visita, ligação etc.) — aparece na linha do tempo, ensina o sistema em segundo plano e entra na próxima análise.</p>
          <textarea id="cp7ObsTexto" placeholder="Ex.: Fiz visita com o cliente, ele gostou muito e ficou de marcar visita de novo semana que vem." style="min-height:76px;margin-bottom:8px"></textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" id="cp7ObsGravarBtn" onclick="cp7ObsToggleGravacao(this)" style="flex:1;min-width:140px;background:transparent;border:1px solid var(--line);border-radius:12px;padding:11px;color:var(--text);font-weight:900;cursor:pointer">Gravar áudio</button>
            <button type="button" onclick="cp7ObsSalvar(this)" style="flex:1;min-width:140px;background:linear-gradient(135deg,var(--lime),var(--cyan));border:0;border-radius:12px;padding:11px;color:var(--on-accent);font-weight:950;cursor:pointer">Salvar observação</button>
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
        </aside>
      </div>
      <section class="cp704-card cp704-tools-open">
        <div class="cp704-card-title"><h2>Ferramentas e ações</h2></div>
        <div class="cp704-tools-row">${cp704ToolsFlat(lead,mc)}<details class="cp704-details cp704-hist-inline"><summary>Últimas mensagens ${Number((typeof totalMensagensLead==='function')?totalMensagensLead(lead):0)||''} <span class="cp704-hist-arrow">▾</span></summary><div class="cp704-body"><div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button type="button" class="cp704-copy-history" onclick="event.preventDefault();event.stopPropagation();copiarHistoricoLead()">Copiar histórico</button></div><div class="cp704-timeline">${cp704TimelineHtml(lead)}</div></div></details></div>
      </section>
    </div>`;
  return null;
}

window.renderLeadFoco = renderLeadFoco;

async function abrirVenda(id, nome){
  if(!id) return;
  if(!confirm(`Marcar ${nome || "este lead"} como VENDIDO?`)) return;
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, action: "etapa", etapa: "Vendido" })
    });
    const data = await res.json();
    if(data?.ok){
      invalidarLeadsCache();
      toast("Lead movido pra Vendido.");
      carregarPipeline();
      if(typeof carregarDashboard === "function") carregarDashboard();
    } else {
      toast("Erro: " + (data?.error || "falha"));
    }
  }catch(err){ toast("Erro de rede: " + (err?.message||err)); }
}
window.abrirVenda = abrirVenda;

async function moverEtapa(select){
  const id = select.dataset.leadId;
  const etapa = select.value;
  const original = select.dataset.original || select.value;
  if(!id) return;
  select.disabled = true;
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, action: "etapa", etapa })
    });
    const data = await res.json().catch(()=>({ok:false}));
    if(!res.ok || !data.ok){ throw new Error(data.error || "falha ao salvar"); }
    invalidarLeadsCache();
    toast("Movido para "+etapa);
    carregarPipeline();
  }catch(err){
    toast("Erro: "+(err?.message||err));
    select.value = original;
  }finally{
    select.disabled = false;
  }
}
window.moverEtapa = moverEtapa;

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
      if(normalizarEtapa(lead.etapa) === "Geladeira") continue; // geladeira não aparece na barra de agenda do topo
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
      // Formato natural: "Visita hoje à tarde · Amiel" + um × pra remover se a IA errou.
      const frase = `${it.tipo} ${it.quando}${it.periodo}`;
      return `<span style="display:inline-flex;align-items:center;background:${bg};border:1px solid ${cor};border-radius:999px"><button type="button" onclick='abrirLead(${idJs})' style="background:none;border:none;color:var(--white);padding:7px 4px 7px 14px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px"><span style="color:${cor};font-weight:950">${escapeHtml(frase)}</span><span style="opacity:.5">·</span><span style="font-weight:700">${escapeHtml(nome)}</span></button><button type="button" title="Não é compromisso — remover" onclick='dispensarCompromisso(${keyJs})' style="margin:0 5px 0 2px;width:20px;height:20px;border-radius:999px;background:rgba(255,80,80,.22);border:1px solid rgba(255,120,120,.7);color:#ff8a8a;cursor:pointer;font-size:13px;font-weight:900;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto">×</button></span>`;
    }).join("");
  }catch(_){ /* falha silenciosa */ }
}

function agendaCardHTML(l, extra){
  const idJs = JSON.stringify(String(l.id||""));
  const fonePhone = String(l.phone||"").replace(/\D/g,"");
  return `
    <div class="agenda-item">
      <div style="flex:1;min-width:0">
        <strong onclick='abrirLead(${idJs})' style="cursor:pointer;text-decoration:underline;text-decoration-color:rgba(255,255,255,.18)">${escapeHtml(l.name||"Cliente")}</strong>
        <div class="small" style="margin-top:3px">${escapeHtml(l.product||"--")}</div>
        ${l.nextAction ? `<div class="small" style="margin-top:6px;color:var(--soft)"><b>Próxima ação:</b> ${escapeHtml(l.nextAction)}</div>` : ""}
        ${extra || ""}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <button type="button" onclick='abrirLead(${idJs})' style="padding:7px 13px;font-size:11px;background:var(--lime);color:var(--on-accent);border:1px solid var(--lime);border-radius:8px;cursor:pointer;font-weight:950">Ver análise</button>
        ${l.analysis?.lembrete?.quando ? reagendarControlHTML(l.id) : ""}
        ${l.analysis?.lembrete?.quando ? `<button type="button" onclick='removerLembrete(${idJs})' style="padding:6px 10px;font-size:11px;background:rgba(244,118,138,.10);color:#ffd7de;border:1px solid rgba(244,118,138,.26);border-radius:8px;cursor:pointer;font-weight:950">🗑 Excluir</button>` : ""}
        ${fonePhone ? `<a class="btn" style="padding:6px 10px;font-size:11px;text-decoration:none" href="${escapeHtml(linkWhatsAppDireta(l) || ("https://wa.me/"+fonePhone))}" target="_blank">💬 WhatsApp</a>` : ""}
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
  if(!confirm("Excluir este lembrete da agenda? O lead continua salvo — só sai do agendado.")) return;
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
    const itemsAll = (data?.items || []).map(limparLead).filter(l => { const e = normalizarEtapa(l.etapa); return e !== "Vendido" && e !== "Perdido"; });
    const items = itemsAll.filter(l => normalizarEtapa(l.etapa) !== "Geladeira");

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
    const lembretesGeladeiraVencidos = itemsAll.filter(l => lembreteVencido(l) && normalizarEtapa(l.etapa) === "Geladeira");
    lembretesGeladeiraVencidos.sort((a,b) => lembreteTs(a) - lembreteTs(b));

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

    if(!compromissos.length && !lembretesHoje.length && !lembretesFuturos.length && !lembretesGeladeiraVencidos.length){
      box.innerHTML = '<div class="empty">Nada agendado. Quando você ou o cliente marcarem um retorno (ex.: "retomar em 60 dias"), aparece aqui.</div>';
      return;
    }

    let html = "";
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
    if(lembretesGeladeiraVencidos.length){
      html += `<div style="margin-bottom:14px"><div class="small" style="color:var(--timing);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:11px;margin-bottom:8px">Lembretes vencidos — revisar (arquivados) (${lembretesGeladeiraVencidos.length})</div>`;
      html += lembretesGeladeiraVencidos.map(l => {
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
      regrasTexto: qs("#cerebroRegrasTexto")?.value ?? cfg?.regrasTexto ?? "",
      objecoesTexto: qs("#cerebroObjecoesTexto")?.value ?? cfg?.objecoesTexto ?? "",
      regras: [],
      objecoes: []
    };
  }
  return sanitizeCerebroConfigV762(cfg || { metodo: "", diasImportacao: 90 });
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
    let novosLeads = 0, vendas = 0, valorVendas = 0;
    let waAbertos = 0, msgCopiadas = 0, contatosManuais = 0, materiaisEnviados = 0;
    for(const l of leads){
      if(l.createdAt){
        const t = new Date(l.createdAt).getTime();
        if(!isNaN(t) && t >= cutoff) novosLeads++;
      }
      if(normalizarEtapa(l.etapa) === "Vendido"){
        const vDt = l.analysis?.venda?.registradaEm ? new Date(l.analysis.venda.registradaEm).getTime() : null;
        if(vDt && vDt >= cutoff){
          vendas++;
          valorVendas += parseValorVenda(l.analysis?.venda?.valor);
        }
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
    box.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">
        ${kpiMini("Novos leads", novosLeads, "var(--lime)")}
        ${kpiMini("Vendas", vendas + (valorVendas>0?" · "+formatBRL(valorVendas):""), "var(--acao)")}
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
  if(!confirm("Apagar essa observação? O Corretor Pro vai desconsiderar esse aprendizado.")) return;
  cerebroIntel[categoria].splice(indice, 1);
  await salvarAprendizado();
  carregarAprendizado();
}
window.apagarItemAprendizado = apagarItemAprendizado;

async function limparAprendizadoTudo(){
  if(!confirm("Apagar TUDO que o Corretor Pro aprendeu com os históricos? O Cérebro Comercial digitado manualmente não será afetado.")) return;
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
  let config = null;
  try{
    const res = await fetch("./api/cerebro-config", { cache:"no-store" });
    const data = await res.json();
    if(data?.ok && data.config) config = data.config;
    if(data?.warning) status.innerHTML = '<span style="color:#ffc4f4">'+escapeHtml(data.warning)+'</span>';
  }catch(_){ /* fallback local */ }
  if(!config){
    try{ config = JSON.parse(localStorage.getItem(CEREBRO_LS_KEY) || "null"); }catch(_){}
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
  // Regras e objeções em blocos únicos de texto.
  if(qs("#cerebroRegrasTexto")) qs("#cerebroRegrasTexto").value = config.regrasTexto || "";
  if(qs("#cerebroObjecoesTexto")) qs("#cerebroObjecoesTexto").value = config.objecoesTexto || "";
  cerebroFormularioCarregado = true;
  if(!status.innerHTML) status.textContent = "Configuração carregada.";
}

function acrescentarRegraAoBloco(texto) {
  const campo = qs("#cerebroRegrasTexto");
  const novo = String(texto || "").trim();
  if(!campo || !novo) return false;
  const atual = String(campo.value || "").trimEnd();
  campo.value = atual ? `${atual}\n\n${novo}` : novo;
  campo.dispatchEvent(new Event("input", { bubbles:true }));
  return true;
}

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
  const config = {
    corretorNome: qs("#cerebroCorretorNome")?.value || "",
    metodo: qs("#cerebroMetodo").value,
    tom: qs("#cerebroTom").value,
    diferenciais: qs("#cerebroDiferenciais").value,
    evitar: qs("#cerebroEvitar").value,
    diasImportacao: (Number.isFinite(diasN) && diasN > 0 && diasN <= 365) ? diasN : 90,
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
  if(!confirm("Zerar o Cérebro (método, tom, o que evitar, regras, objeções) E TODO o aprendizado?\n\nA análise passa a rodar PURA (somente a conversa, sem regras aprendidas). Mantém o seu nome e os produtos. Não tem como desfazer.")) return;
  const status = qs("#cerebroStatus"); if(status) status.textContent = "Zerando...";
  try{
    const cfg = {
      corretorNome: qs("#cerebroCorretorNome")?.value || "",
      metodo: "", tom: "", evitar: "",
      diferenciais: "",
      diasImportacao: Number(qs("#cerebroDiasImportacao")?.value) || 90,
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

function renderEtapas(idxAtual, sub){
  // Etapas 0..5 (Recebendo…Salvando) = em andamento → botões travados.
  // Etapa 6 (Concluído) e 7 (Falha recuperável) → botões liberados.
  setBotoesImportacao(idxAtual >= 0 && idxAtual <= 5);
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

// Compat: mantém o nome antigo pra não quebrar quem ainda chama
function startBusy(){ return startProgresso(); }

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
          ${opcoes.map(o => `<button type="button" class="periodoAudioBtn" data-valor="${o.valor}" style="padding:14px 8px;background:${o.valor===salvo?'linear-gradient(135deg,var(--lime),var(--cyan))':'transparent'};border:1px solid ${o.valor===salvo?'transparent':'var(--line)'};border-radius:10px;color:${o.valor===salvo?'var(--on-accent)':'var(--text)'};font-weight:950;cursor:pointer">${escapeHtml(o.label)}</button>`).join("")}
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
      if(!confirm("Descartar esta importação e apagar os arquivos temporários?")) return;
      const stored = state.ultimoUploadStorage;
      if(stored) await finalizarImportacaoStorage(stored);
      const shareId = String(state.pendingSharedRecordId || "");
      if(shareId) await finalizarSharePendente(shareId);
      state.ultimoUploadStorage = null;
      state.activeImportId = null;
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
  const prep = await chamar({ action:"preparar", audioWindowDays:options.audioWindowDays || "90" }, 90000);
  const transcriptionMap = { ...(prep.cachedTranscriptions || {}) };
  const audiosTodos = Array.isArray(prep.audiosParaTranscrever) ? prep.audiosParaTranscrever : [];
  const normalizarAudio = (v) => String(v || "").split(/[\\/]/).pop().toLowerCase().trim();
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
  const result = await chamar({
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
  const msgs = result?.analysis?.messages || {};
  if(result?.analysis?.sugestoesPendentes === true || ![msgs.a,msgs.b,msgs.c].every(v=>String(v||"").trim().length>=10)){
    throw new Error("A análise permanece pendente porque uma das três mensagens não passou pelas regras do Cérebro.");
  }
  result.importId = importId;
  renderEtapas(5, "aguardando confirmação para salvar");
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
  const semMidiaHtml = sm.exportadoSemMidia ? `<div style="margin-top:10px;padding:11px 13px;background:rgba(255,155,59,.1);border:1px solid var(--morno);border-radius:10px;font-size:13px;color:#ffd9ad"><b>⚠️ Conversa exportada SEM mídia.</b> ${Number(sm.midiasOcultas)||0} mídia(s) ficaram ocultas — os <b>áudios não vieram no arquivo</b> e não dá pra transcrever. Pra incluir os áudios (importantes pra análise), reexporte a conversa no WhatsApp escolhendo <b>"Incluir mídia"</b> e importe de novo.</div>` : "";
  const inc = data.incrementalMeta || {};
  const incrementalHtml = inc.reimportacao ? `<div style="margin-top:10px;padding:11px 13px;background:rgba(104,255,149,.08);border:1px solid rgba(104,255,149,.30);border-radius:10px;font-size:13px;color:#bdffd0"><b>Atualização incremental:</b> ${Number(inc.mensagensNovas)||0} mensagem(ns) nova(s) · ${Number(inc.audiosNovosTranscritos)||0} áudio(s) novo(s) transcrito(s) · ${Number(inc.audiosReaproveitados)||0} áudio(s) reaproveitado(s).${inc.analiseReutilizada ? " Nenhuma novidade encontrada." : " A análise foi refeita sem reutilizar sugestão antiga."}</div>` : "";

  // Telefone é apenas dado auxiliar. A decisão de unir ou separar é acionada somente
  // quando o nome exportado coincide tecnicamente com um nome já salvo.
  const match = await acharLeadExistente(state.lead.name);
  const existente = match?.lead || null;
  state.pendingExistente = existente;
  const perguntarNome = !!existente;
  let acoesHtml;
  if(perguntarNome){
    acoesHtml =
      `<div id="pendingBox" style="margin-top:14px;padding:12px;background:rgba(255,155,59,.08);border:1px solid var(--morno);border-radius:12px;color:#ffd9ad"><b>Cliente existente identificado: “${escapeHtml(existente.name || state.lead.name)}”.</b><br>A conversa será incorporada ao mesmo cadastro, sem criar duplicata.</div>` +
      `<div id="pendingActions" style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap"><button type="button" id="btnAtualizarLead" class="btn" style="flex:1;min-width:160px">Atualizar cliente</button><button type="button" id="btnDescartarLead" class="btn secondary" style="flex:1;min-width:120px">Cancelar</button></div>`;
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
  // Decisão "é o mesmo / é outro": traz a pergunta pra vista (senão fica embaixo e parece que travou).
  if(perguntarNome){
    setTimeout(() => { (qs("#pendingBox") || qs("#resultCard"))?.scrollIntoView({ behavior:"smooth", block:"center" }); }, 80);
  }

  const timeline = (data.timeline || []).slice(-200).map(m =>
    `<div class="event"><b>${escapeHtml((m.date || "") + " " + (m.time || "") + " — " + (m.author || ""))}</b><p>${escapeHtml(m.text || "")}</p></div>`
  ).join("");
  qs("#timeline").innerHTML = timeline || '<div class="event"><b>Conversa recebida</b><p>Arquivo processado.</p></div>';

  qs("#btnSalvarLead")?.addEventListener("click", salvarLeadPendente);
  qs("#btnDescartarLead")?.addEventListener("click", descartarLeadPendente);
  qs("#btnAtualizarLead")?.addEventListener("click", atualizarLeadComEvolucao);

  renderLeads();

  if(perguntarNome){
    // Mesmo nome: só permite atualizar o cadastro existente; criar duplicata não é oferecido.
  }else{
    salvarLeadPendente();
  }
 }catch(err){
  // Antes: erro aqui virava tela travada em silêncio (função chamada sem await/catch). Agora avisa.
  const box = qs("#resultBox");
  if(box){
    box.className = "notice error";
    box.innerHTML = "<b>Deu erro ao mostrar o resultado.</b><br><br>" + escapeHtml(String(err?.message||err)) +
      `<div style="margin-top:14px"><button type="button" class="btn" onclick="location.reload()">Recarregar</button></div>`;
  }
  toast("Erro ao processar o resultado: " + (err?.message||err));
 }
}

// Procura na base inteira um lead com o mesmo nome técnico (maiúsculas, espaços e acentos ignorados).
// Nomes apenas parecidos e telefone nunca decidem uma fusão automática.
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
  const encontrado = leads.find(l => l?.id && norm(l.name) === alvo);
  return encontrado ? { lead:encontrado, via:"nome-exato" } : null;
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

async function atualizarLeadComEvolucao(){
  const existente = state.pendingExistente;
  if(!existente?.id || !state.pendingSave){ toast("Nada pra atualizar."); return; }
  const btn = qs("#btnAtualizarLead");
  if(btn){ btn.disabled = true; btn.textContent = "Atualizando..."; }
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action: "atualizar-com-evolucao", id: existente.id, result: state.pendingSave.result, importId: state.pendingSave.importId, cerebroConfig: state.pendingSave.cerebroConfig })
    });
    const data = await res.json().catch(()=>({ok:false,error:"Resposta inválida do servidor."}));
    if(!res.ok || !data.ok) throw new Error(data.error || "Erro ao atualizar.");
    const incrementalMeta = state.pendingSave?.result?.incrementalMeta || null;
    const importacaoConcluida = state.pendingSave;
    const shareConcluidoId = String(state.pendingSharedRecordId || "");
    const limpeza = await finalizarImportacaoStorage(importacaoConcluida);
    state.pendingSave = null;
    state.activeImportId = null;
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
    loadRecentLeads(true); refreshAllSections();
    if(shareConcluidoId) await finalizarSharePendente(shareConcluidoId);
    qs("#pendingActions")?.remove();
    renderEtapas(6, "lead atualizado e importação confirmada");
    setTimeout(() => { if(existente.id) abrirLead(existente.id); }, 800);
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Atualizar"; }
    const pa = qs("#pendingActions"); if(pa) pa.style.display = "flex"; // mostra botões pra tentar de novo
    toast("Não foi possível atualizar: " + (err.message||err));
  }
}

async function salvarLeadPendente(){
  if(!state.pendingSave){ toast("Nada pra salvar."); return; }
  const btn = qs("#btnSalvarLead");
  if(btn){ btn.disabled = true; btn.textContent = "Salvando..."; }
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action: "salvar-novo", ...state.pendingSave })
    });
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
    const limpeza = await finalizarImportacaoStorage(importacaoConcluida);
    state.pendingSave = null;
    state.activeImportId = null;
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
    // Após salvar, abre o lead da home pra mostrar o card de foco completo (com badges, materiais, etc).
    setTimeout(() => { if(state.lead?.id) abrirLead(state.lead.id); }, 800);
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Salvar lead"; }
    const pa = qs("#pendingActions"); if(pa) pa.style.display = "flex"; // mostra botões pra tentar de novo
    toast("Não foi possível salvar: " + (err.message||err));
  }
}

async function descartarLeadPendente(){
  if(!confirm("Descartar essa análise sem salvar no banco?")) return;
  const shareDescartadoId = String(state.pendingSharedRecordId || "");
  const importacaoDescartada = state.pendingSave;
  await finalizarImportacaoStorage(importacaoDescartada);
  state.pendingSave = null;
  state.activeImportId = null;
  state.ultimoUploadStorage = null;
  clearAnalysis();
  if(shareDescartadoId) await finalizarSharePendente(shareDescartadoId);
  toast("Análise descartada.");
}

async function processFile(file, options = {}){
  if(!file) return false;
  if(state.processing) return false;
  const pendingShareId = String(options.shareId || state.pendingSharedRecordId || "").trim();
  const importId = String(options.importId || state.activeImportId || criarImportId());
  state.activeImportId = importId;
  if(pendingShareId){
    state.pendingSharedRecordId = pendingShareId;
    window.__cpShareImportActive = true;
  }
  state.ultimoArquivo = file;
  clearAnalysis();
  state.processing=true;
  show("zip");
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
    // Não elimina o ZIP ainda: a importação só termina quando o lead é salvo/atualizado
    // ou quando o corretor descarta explicitamente a análise.
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
      state.ultimoArquivo = null;
      showCard("resultCard", false);
    });
    toast("Erro ao processar. O ZIP ficou guardado para tentar novamente.");
    return false;
  }finally{
    state.processing=false;
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
  const limite=cameFromShare ? Date.now()+8000 : Date.now();
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
    qs('#btnRecuperarShare')?.addEventListener('click',()=>{ __cpCheckSharedPromise=null; checkShared(); });
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
  // Proposta aberta pelo Menu (não a partir de um lead) não fica vinculada a lead nenhum.
  if(b.dataset.target === "propostas"){ state.propLeadId = null; state.propLeadNome = ""; atualizarVoltarProposta(); }
  // "Carteira" sempre abre na aba Oportunidades (priorizada), não na última aba usada (ex.: Últimos).
  if(b.dataset.target === "pipeline"){ setPipelineTab("oportunidades"); }
  show(b.dataset.target,{navKey});
  if(!estavaNaGaveta) fecharMenuGaveta({fromHistory:true}); // garante gaveta fechada sem criar nova navegação
}));
// Qualquer item da lista lateral/gaveta fecha a gaveta do celular ao ser tocado (inclui os que usam onclick, como "Últimos atendimentos").
qsa(".sb-item").forEach(b=>b.addEventListener("click", fecharMenuGaveta));
qsa(".navTodos").forEach(b=>b.addEventListener("click",abrirTodosLeads));
qsa(".pickZipShortcut").forEach(b=>b.addEventListener("click",()=>qs("#zipInput").click()));
qs("#pickZip").addEventListener("click",()=>qs("#zipInput").click());
qs("#uploadBox").addEventListener("click",e=>{if(e.target.id!=="pickZip")qs("#zipInput").click()});
qs("#zipInput").addEventListener("change",()=>processFile(qs("#zipInput").files[0]));
qs("#clearAnalysis").addEventListener("click",clearAnalysis);
qs("#diagnoseOpenAI").addEventListener("click",runOpenAIDiagnostics);
qsa(".msg-tab").forEach(btn => btn.addEventListener("click", () => setMsgStyle(btn.dataset.style)));
qs("#cerebroSalvar")?.addEventListener("click", salvarCerebro);
qs("#cerebroResetar")?.addEventListener("click", resetarCerebro);
qs("#cerebroZerar")?.addEventListener("click", zerarCerebroTudo);
// Regras e objeções são editadas diretamente nos campos de texto únicos.
// Aprender de vídeo / link
qs("#cerebroLinkBtn")?.addEventListener("click", async () => {
  const url = (qs("#cerebroLinkInput")?.value || "").trim();
  const st = qs("#cerebroLinkStatus");
  const sug = qs("#cerebroLinkSugestoes");
  if(!/^https?:\/\//i.test(url)){ st.textContent = "Cole um link válido (começa com http)."; return; }
  st.textContent = "Lendo o conteúdo e extraindo lições... (pode levar 10-30s)";
  sug.innerHTML = "";
  try{
    const ctrl = new AbortController();
    const to = setTimeout(()=>ctrl.abort(), 60000);
    const res = await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"aprender-link", url }), signal: ctrl.signal });
    clearTimeout(to);
    const data = await res.json();
    if(data?.ok && Array.isArray(data.regras) && data.regras.length){
      st.innerHTML = '<span style="color:var(--acao)">' + escapeHtml(data.fonte==="vídeo"?"Vídeo lido":"Link lido") + '. ' + (data.resumo?escapeHtml(data.resumo):'') + '</span>';
      sug.innerHTML = '<div class="small" style="color:var(--muted);margin-bottom:6px">Toque pra adicionar as que fizerem sentido:</div>' +
        data.regras.map((r,i) => `<button type="button" class="cerebroSugBtn" data-origem="${data.fonte==='vídeo'?'video':'link'}" data-texto="${escapeHtml(r)}" style="display:block;width:100%;text-align:left;padding:8px 10px;margin-bottom:5px;background:rgba(196,92,255,.06);border:1px solid rgba(196,92,255,.22);border-radius:8px;color:var(--text);font-size:12px;cursor:pointer">+ ${escapeHtml(r)}</button>`).join("");
      sug.querySelectorAll(".cerebroSugBtn").forEach(b => b.addEventListener("click", () => {
        acrescentarRegraAoBloco(b.dataset.texto);
        b.style.opacity = "0.4"; b.style.pointerEvents = "none"; b.textContent = "✓ adicionada";
        toast("Regra adicionada. Não esqueça de Salvar.");
      }));
    } else {
      st.innerHTML = '<span style="color:var(--risco)">' + escapeHtml(data?.error || "Não consegui extrair lições desse link.") + '</span>';
    }
  }catch(err){
    const ehTimeout = err?.name === "AbortError";
    st.innerHTML = '<span style="color:var(--risco)">' + (ehTimeout ? "Demorou demais. Tente um vídeo mais curto ou cole o texto como regra." : "Erro: " + escapeHtml(String(err?.message||err))) + '</span>';
  }
});
// Aprender de TODA a carteira (leads já no Corretor Pro) — roda em lotes até concluir, com progresso.
qs("#cerebroCarteiraBtn")?.addEventListener("click", async () => {
  const btn = qs("#cerebroCarteiraBtn");
  const st = qs("#cerebroCarteiraStatus");
  if(!btn || btn.dataset.rodando === "1") return;
  btn.dataset.rodando = "1"; btn.disabled = true; btn.style.opacity = "0.6";
  let offset = 0, totalAprendidas = 0, totalFalhas = 0, total = null, loops = 0, totalSemMaterial = 0, totalErrosIA = 0, motivoErroIA = "";
  const errosOffsets = []; // conversas que deram erro de IA — recuperadas no fim, pra não perder nenhuma
  st.innerHTML = '<span style="color:var(--cerebro)">Aprendendo da carteira... 0% — começando, deixe a tela aberta.</span>';
  try{
    while(true){
      if(++loops > 800) break; // trava de segurança
      // Busca 1 conversa, com até 5 retentativas se a rede/tempo falhar (não aborta por um tropeço).
      let data = null, ultimoErro = "";
      for(let tentativa = 0; tentativa < 5 && !data; tentativa++){
        try{
          const res = await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"aprender-carteira", offset, limite: 1 }) });
          if(!res.ok){ throw new Error("servidor respondeu " + res.status); }
          data = await res.json();
        }catch(e){
          ultimoErro = String(e?.message || e);
          st.innerHTML = '<span style="color:var(--cerebro)">Rede tropeçou (' + escapeHtml(ultimoErro) + '), tentando de novo... (' + (offset) + ' já feitos)</span>';
          await new Promise(r => setTimeout(r, 1200 * (tentativa + 1)));
        }
      }
      // Nunca mostra "[object Object]" — extrai o texto real do erro venha como for.
      const txtErro = (e) => { if(e == null) return ""; if(typeof e === "string") return e; if(e.message) return String(e.message); try{ return JSON.stringify(e); }catch(_){ return String(e); } };
      if(!data || !data.ok){
        // NÃO pula nada. Se uma conversa travar mesmo após as tentativas, para e diz QUAL é,
        // pra revisar essa conversa específica — nada some calado.
        st.innerHTML = '<span style="color:var(--risco)">Travou na conversa nº ' + (offset + 1) + (total != null ? ('/' + total) : '') + ': ' + escapeHtml(txtErro(data ? data.error : ultimoErro) || "erro") + '. Não pulei nada. Toque de novo pra retomar daqui, ou me manda esse print.</span>';
        break;
      }
      if(typeof data.total === "number") total = data.total;
      totalAprendidas += (data.aprendidasNoLote || 0);
      totalFalhas += (data.falhasSalvar || 0);
      totalSemMaterial += (data.semConteudo || 0);
      totalErrosIA += (data.errosIA || 0);
      if((data.errosIA || 0) > 0) errosOffsets.push(offset);
      if(data.ultimoErroIA) motivoErroIA = data.ultimoErroIA;
      const processados = (data.proximaOffset != null) ? data.proximaOffset : (total != null ? total : offset + (data.loteProcessado || 0));
      const pct = (total != null && total > 0) ? Math.min(100, Math.round((processados / total) * 100)) : null;
      st.innerHTML = '<span style="color:var(--cerebro)">Aprendendo... ' + (pct != null ? pct + '% — ' : '') + processados + (total != null ? ('/' + total) : '') + ' | ' + totalAprendidas + ' lições' + (totalSemMaterial ? (' | ' + totalSemMaterial + ' só formulário') : '') + (totalErrosIA ? (' | ' + totalErrosIA + ' erros análise') : '') + (totalFalhas ? (' | ' + totalFalhas + ' não salvaram') : '') + '</span>' + (motivoErroIA ? '<br><span style="color:var(--risco);font-size:11px">motivo: ' + escapeHtml(motivoErroIA) + '</span>' : '');
      if(data.concluido || data.proximaOffset == null){
        // RECUPERA as que deram erro de IA — re-roda cada uma uma vez (com a 2ª tentativa do servidor
        // já não devem mais falhar). Assim não se perde NENHUMA conversa.
        if(errosOffsets.length){
          let aindaErro = 0;
          for(let i = 0; i < errosOffsets.length; i++){
            const off = errosOffsets[i];
            st.innerHTML = '<span style="color:var(--cerebro)">Recuperando conversas que falharam... (' + (i + 1) + '/' + errosOffsets.length + ')</span>';
            try{
              const r2 = await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"aprender-carteira", offset: off, limite: 1 }) });
              const d2 = await r2.json();
              if(d2 && d2.ok && (d2.aprendidasNoLote || 0) > 0){ totalAprendidas += d2.aprendidasNoLote; }
              else { aindaErro++; if(d2 && d2.ultimoErroIA) motivoErroIA = d2.ultimoErroIA; }
            }catch(_){ aindaErro++; }
          }
          totalErrosIA = aindaErro;
        }
        if(totalErrosIA === 0 && totalFalhas === 0){
          try{ await cpAprendFinalizar(total != null ? total : processados); }catch(_){}
        }
        let msg = 'Pronto! Aprendi de ' + ((total != null ? total : processados) - totalSemMaterial - totalErrosIA) + ' conversas — ' + totalAprendidas + ' lições no Cérebro.' + (totalSemMaterial ? (' ' + totalSemMaterial + ' eram só formulário.') : '');
        if(totalErrosIA > 0) msg += ' ' + totalErrosIA + ' deram erro na análise — motivo: ' + motivoErroIA + '.';
        if(totalFalhas > 0) msg += ' ' + totalFalhas + ' não foram salvas: ' + (data.aviso || 'verifique a base do Cérebro.');
        st.innerHTML = '<span style="color:' + (totalFalhas ? 'var(--risco)' : 'var(--acao)') + '">' + escapeHtml(msg) + '</span>';
        break;
      }
      offset = data.proximaOffset;
    }
  }catch(err){
    st.innerHTML = '<span style="color:var(--risco)">Erro: ' + escapeHtml(String(err?.message || err)) + '</span>';
  }finally{
    btn.dataset.rodando = "0"; btn.disabled = false; btn.style.opacity = "1";
  }
});
// Mostra lições sugeridas (de link/vídeo/print) como botões pra adicionar
function mostrarSugestoesCerebro(container, regras, origem){
  if(!container) return;
  container.innerHTML = '<div class="small" style="color:var(--muted);margin-bottom:6px">Toque pra adicionar as que fizerem sentido:</div>' +
    regras.map(r => `<button type="button" class="cerebroSugBtn" data-origem="${escapeHtml(origem)}" data-texto="${escapeHtml(r)}" style="display:block;width:100%;text-align:left;padding:8px 10px;margin-bottom:5px;background:rgba(196,92,255,.06);border:1px solid rgba(196,92,255,.22);border-radius:8px;color:var(--text);font-size:12px;cursor:pointer">+ ${escapeHtml(r)}</button>`).join("");
  container.querySelectorAll(".cerebroSugBtn").forEach(b => b.addEventListener("click", () => {
    acrescentarRegraAoBloco(b.dataset.texto);
    b.style.opacity = "0.4"; b.style.pointerEvents = "none"; b.textContent = "✓ adicionada";
    toast("Regra adicionada. Não esqueça de Salvar.");
  }));
}
// Aprender de print/imagem
qs("#cerebroImgBtn")?.addEventListener("click", () => qs("#cerebroImgInput")?.click());
qs("#cerebroImgInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if(!file) return;
  const st = qs("#cerebroImgStatus");
  if(file.size > 8*1024*1024){ st.textContent = "Imagem muito grande (máx 8 MB)."; e.target.value=""; return; }
  st.textContent = "Lendo o print... (pode levar alguns segundos)";
  qs("#cerebroImgSugestoes").innerHTML = "";
  try{
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file);
    });
    const res = await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"aprender-imagem", imagemBase64: dataUrl }) });
    const data = await res.json();
    if(data?.ok && Array.isArray(data.regras) && data.regras.length){
      st.innerHTML = '<span style="color:var(--acao)">Print lido. ' + (data.resumo?escapeHtml(data.resumo):'') + '</span>';
      mostrarSugestoesCerebro(qs("#cerebroImgSugestoes"), data.regras, "print");
    } else {
      st.innerHTML = '<span style="color:var(--risco)">' + escapeHtml(data?.error || "Não encontrei lições úteis nesse print.") + '</span>';
    }
  }catch(err){
    st.innerHTML = '<span style="color:var(--risco)">Erro: ' + escapeHtml(String(err?.message||err)) + '</span>';
  }finally{ e.target.value = ""; }
});
// Ensinar por áudio
qs("#cerebroAudioBtn")?.addEventListener("click", () => qs("#cerebroAudioInput")?.click());
qs("#cerebroAudioInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if(!file) return;
  const st = qs("#cerebroAudioStatus");
  if(file.size > 24*1024*1024){ st.textContent = "Áudio muito grande (máx 24 MB)."; return; }
  st.textContent = "Transcrevendo áudio... (pode levar alguns segundos)";
  try{
    const b64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] || "");
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const ext = "." + (file.name.split(".").pop() || "ogg").toLowerCase();
    const res = await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"transcrever-audio", audioBase64: b64, ext }) });
    const data = await res.json();
    if(data?.ok && data.texto){
      acrescentarRegraAoBloco(data.texto);
      st.innerHTML = '<span style="color:var(--acao)">Transcrito e adicionado como regra. Revise e Salve.</span>';
    } else {
      st.innerHTML = '<span style="color:var(--risco)">' + escapeHtml(data?.error || "Não foi possível transcrever.") + '</span>';
    }
  }catch(err){
    st.innerHTML = '<span style="color:var(--risco)">Erro: ' + escapeHtml(String(err?.message||err)) + '</span>';
  }finally{
    e.target.value = "";
  }
});
// Ensinar por vídeo (sobe pro armazenamento e transcreve de lá — contorna o limite de envio direto)
qs("#cerebroVideoBtn")?.addEventListener("click", () => qs("#cerebroVideoInput")?.click());
qs("#cerebroVideoInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if(!file) return;
  const st = qs("#cerebroVideoStatus");
  if(file.size > 25*1024*1024){ st.textContent = "Vídeo maior que 25 MB. Mande um trecho mais curto."; e.target.value = ""; return; }
  const ext = "." + (file.name.split(".").pop() || "mp4").toLowerCase();
  try{
    st.textContent = "Enviando vídeo...";
    // 1) pede URL de upload e envia o arquivo direto pro armazenamento
    const metaRes = await fetch("./api/criar-upload-url", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ fileName: file.name, size: file.size, contentType: file.type || "video/mp4" }) });
    const meta = await metaRes.json().catch(()=>({ ok:false }));
    if(!metaRes.ok || !meta.ok || !(meta.signedUrl || meta.signed_url)){ st.innerHTML = '<span style="color:var(--risco)">Não consegui preparar o envio do vídeo.</span>'; e.target.value=""; return; }
    const signedUrl = meta.signedUrl || meta.signed_url;
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedUrl, true);
      // O bucket #621 permite somente os formatos de ZIP, áudio e vídeo previstos.
      xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
      xhr.setRequestHeader("x-upsert", "true");
      xhr.upload.onprogress = (evt) => { if(evt.lengthComputable){ st.textContent = "Enviando vídeo... " + Math.round((evt.loaded/evt.total)*100) + "%"; } };
      xhr.onload = () => {
        if(xhr.status>=200 && xhr.status<300){ resolve(); return; }
        let det = (xhr.responseText||"").slice(0,200);
        try{ const p = JSON.parse(xhr.responseText); det = p.message || p.error || det; }catch(_){}
        reject(new Error("armazenamento recusou (HTTP "+xhr.status+") "+det));
      };
      xhr.onerror = () => reject(new Error("falha de rede no envio"));
      xhr.send(file);
    });
    // 2) manda transcrever a partir do armazenamento e extrair lições curtas
    st.textContent = "Transcrevendo e extraindo lições... (pode levar alguns segundos)";
    const sug = qs("#cerebroVideoSugestoes"); if(sug) sug.innerHTML = "";
    const res = await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"transcrever-storage", bucket: meta.bucket, path: meta.path, ext }) });
    const data = await res.json().catch(()=>({ ok:false, error:"Resposta inválida do servidor." }));
    if(data?.ok && Array.isArray(data.regras) && data.regras.length){
      st.innerHTML = '<span style="color:var(--acao)">Vídeo transcrito. ' + (data.resumo?escapeHtml(data.resumo):'') + '</span>';
      mostrarSugestoesCerebro(sug, data.regras, "video");
    } else {
      st.innerHTML = '<span style="color:var(--risco)">' + escapeHtml(data?.error || "Não consegui extrair lições do vídeo.") + '</span>';
    }
  }catch(err){
    st.innerHTML = '<span style="color:var(--risco)">Erro ao enviar o vídeo: ' + escapeHtml(String(err?.message||err)) + '</span>';
  }finally{
    e.target.value = "";
  }
});
// ============ IMPORTAR LEADS DE CSV ============
function parseCsvDireciona(t){
  const rows=[]; let row=[], cur="", q=false;
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){ if(c==='"'){ if(t[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else { if(c==='"')q=true; else if(c===','){row.push(cur);cur="";} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur="";} else if(c==='\r'){} else cur+=c; }
  }
  if(cur.length||row.length){row.push(cur);rows.push(row);}
  return rows;
}
const CSV_ETAPA_MAP = { "PERDIDO":"Perdido","ATENDIMENTO":"Atendimento","NOVO / INICIAL":"Novo","NOVO/INICIAL":"Novo","STAND BY":"Standby","STANDBY":"Standby","VISITA / PROPOSTA":"Visita/Proposta","NEGOCIAÇÃO":"Negociação","NEGOCIACAO":"Negociação" };
function crmDataBR(iso){ try{ const d=new Date(iso); if(isNaN(d))return ""; return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear(); }catch(_){ return ""; } }

qs("#crmImportBtn")?.addEventListener("click", () => qs("#crmCsvInput")?.click());
qs("#crmCsvInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if(!file){ return; }
  const st = qs("#crmImportStatus");
  const wrap = qs("#crmImportProgressWrap"), bar = qs("#crmImportProgress");
  try{
    const texto = await file.text();
    const rows = parseCsvDireciona(texto);
    if(rows.length < 2){ st.textContent = "CSV vazio ou inválido."; e.target.value=""; return; }
    // Cabeçalho sem diferenciar maiúsculas/acentos: aceita "Nome", "NOME", "nome" etc.
    const head = rows[0].map(h=>h.trim().toLowerCase());
    const ix = {}; head.forEach((h,i)=>ix[h]=i);
    // Só o NOME é obrigatório. O "id" é opcional: se o arquivo não trouxer, geramos um
    // código estável a partir do nome+telefone (assim reimportar não duplica). O interesse
    // pode vir como "interesse" OU "empreendimento".
    if(ix["nome"] === undefined){ st.textContent = "Esse arquivo precisa ter pelo menos uma coluna 'Nome'. Confira o arquivo."; e.target.value=""; return; }
    const idEstavel = (get) => {
      const bruto = get("id");
      if(bruto) return bruto.slice(0,8);
      const base = (get("nome")+"|"+get("telefone").replace(/\D/g,"")).toLowerCase();
      let h = 0; for(let i=0;i<base.length;i++){ h = (h*31 + base.charCodeAt(i)) >>> 0; }
      return ("0000000"+h.toString(16)).slice(-8);
    };
    const data = rows.slice(1).filter(r => ((r[ix["nome"]]||"").trim()));
    const leads = data.map(r => {
      const get = (k) => (ix[k] !== undefined ? (r[ix[k]] ?? "") : "").trim();
      const etapaMap = CSV_ETAPA_MAP[get("etapa").toUpperCase()] || "Novo";
      return {
        nome: get("nome") || "Cliente",
        telefone: get("telefone"),
        empreendimento: get("empreendimento") || get("interesse"),
        etapaMap,
        ativo: etapaMap !== "Perdido",
        origem: get("origem"),
        observacao: get("observacao"),
        criado: get("criado_em") || new Date().toISOString(),
        idShort: idEstavel(get)
      };
    });

    // Quem já foi importado antes? Evita duplicar e deixa rodar de novo pra completar o que faltou.
    // Também monta o mapa de TELEFONES já existentes (de qualquer origem: WhatsApp, sistema antigo, etc)
    // pra juntar no lead existente em vez de duplicar.
    st.textContent = "Conferindo o que já está importado…";
    const jaImportados = new Set();
    const porTelefone = new Map(); // ultimos 8 dígitos -> { id, obs }
    try{
      const dl = await getLeadsData(true);
      (dl.items||[]).forEach(it => {
        const m = String(it.fileName||"").match(/\[(?:SISTEMA|CSV)\s+([A-Za-z0-9]{1,8})\]/);
        if(m) jaImportados.add(m[1].toLowerCase());
        const fone = String(it.phone||"").replace(/\D/g,"");
        if(fone.length >= 8 && it.id){
          const k = fone.slice(-8);
          if(!porTelefone.has(k)) porTelefone.set(k, { id: it.id, obs: String(it.analysis?.memoria?.observacoes||"") });
        }
      });
    }catch(_){ /* sem conferência o backend ainda dedupa por nome+id */ }

    const aImportar = leads.filter(L => !jaImportados.has((L.idShort||"").toLowerCase()));
    const jaTinha = leads.length - aImportar.length;
    if(aImportar.length === 0){
      st.innerHTML = `<span style="color:var(--acao)">Todos os ${leads.length} leads desse arquivo já estão importados. Nada a fazer.</span>`;
      e.target.value=""; return;
    }
    const ativosCount = aImportar.filter(l=>l.ativo).length;
    if(!confirm(`Importar ${aImportar.length} leads do CSV?${jaTinha?`\n\n(${jaTinha} já estavam importados — vou pular esses, sem duplicar.)`:""}\n\n• Todos entram agora, na hora.\n• ${ativosCount} ativos serão analisados pelo Corretor Pro em seguida (isso demora, mas os leads JÁ ficam salvos — se a aba fechar, é só rodar de novo pra continuar de onde parou).`)){ e.target.value=""; return; }

    qs("#crmImportBtn").disabled = true;
    wrap.style.display = "block";
    bar.style.width = "0%";
    let criados = 0, falhas = 0, mesclados = 0;
    const ativosIds = [];

    // Junta a observação da lista DENTRO de um lead que já existe (mesmo telefone), sem duplicar.
    async function mesclarNoExistente(L, alvo){
      const obs = String(L.observacao||"").trim();
      if(!obs) return "vazio"; // nada pra acrescentar
      const trecho = obs.slice(0, 60);
      if(trecho && String(alvo.obs||"").includes(trecho)) return "ja-tinha"; // já está lá
      try{
        const res = await fetch("./api/reanalisar-lead", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify(payloadComCerebro({ id: alvo.id, novoAtendimento: obs.slice(0,4000), apenasSalvar:true, autorManual:"Anotação importada", tipoManual:"nota" }))
        });
        const d = await res.json().catch(()=>({}));
        if(d?.ok){ alvo.obs = (alvo.obs ? alvo.obs+"\n" : "") + obs; return "mesclado"; }
        return "falha";
      }catch(_){ return "falha"; }
    }

    // 1) CRIAR todos os registros — rápido, sem IA. 1 tentativa extra se a primeira falhar.
    let ultimoErroServidor = ""; // guarda o motivo real quando o servidor recusa a gravação
    async function criarUm(L){
      const analysis = {
        clientName: L.nome,
        lead: { clientName: L.nome, name: L.nome, phone: L.telefone, product: L.empreendimento },
        produtoInteresse: L.empreendimento || "Não identificado",
        produtosInteresse: L.empreendimento ? [L.empreendimento] : [],
        etapaSugerida: L.etapaMap,
        memoria: { observacoes: L.observacao || "" },
        origemCrm: L.origem || ""
      };
      const dataBR = crmDataBR(L.criado);
      const timeline = L.observacao ? [{ id:1, date:dataBR, time:"", iso:L.criado, author:"Anotação importada", text:L.observacao, type:"nota", source:"crm", order:1 }] : [];
      const result = { rawText: L.observacao || "", timeline, analysis, lead: { clientName:L.nome, phone:L.telefone, product:L.empreendimento }, audiosEncontrados:0, audiosTranscritos:0 };
      const fileName = `${L.nome} [CSV ${L.idShort}]`;
      const res = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"salvar-novo", result, fileName, source:"crm-import" }) });
      const d = await res.json().catch(()=>({}));
      const id = d?.persistence?.processing?.id || null;
      if(!id){
        const p = d?.persistence || {};
        ultimoErroServidor = p.reason || (Array.isArray(p.attempts) && p.attempts[0]?.error) || d?.error || `o servidor respondeu ${res.status} sem salvar`;
      }
      return id;
    }
    for(let i=0;i<aImportar.length;i++){
      const L = aImportar[i];
      const foneL = String(L.telefone||"").replace(/\D/g,"");
      const foneKey = foneL.length >= 8 ? foneL.slice(-8) : "";
      const alvo = foneKey ? porTelefone.get(foneKey) : null;
      if(alvo){
        // Já existe um lead com esse telefone — junta a observação nele, sem duplicar.
        const r = await mesclarNoExistente(L, alvo);
        if(r === "falha") falhas++; else mesclados++;
      } else {
        let newId = null;
        for(let tent=0; tent<2 && !newId; tent++){
          try{ newId = await criarUm(L); }catch(_){ newId = null; }
          if(!newId && tent===0) await new Promise(r=>setTimeout(r,800));
        }
        if(newId){
          criados++;
          if(L.ativo && L.observacao) ativosIds.push(newId);
          // registra no mapa pra não duplicar telefone repetido dentro da própria lista
          if(foneKey) porTelefone.set(foneKey, { id:newId, obs:L.observacao||"" });
        } else falhas++;
      }
      bar.style.width = Math.round(((i+1)/aImportar.length)*100) + "%";
      st.textContent = `Importando: ${i+1}/${aImportar.length}${mesclados?` · ${mesclados} juntados`:""}${falhas?` (${falhas} a refazer)`:""}`;
    }

    // IMPORTAÇÃO concluída aqui — os leads já estão salvos no banco.
    await loadRecentLeads();
    await carregarDashboard();
    await carregarAgendaTopo();
    if(criados === 0 && falhas > 0){
      st.innerHTML = `<span style="color:var(--risco)"><b>Nenhum lead foi salvo.</b> O servidor recusou a gravação${ultimoErroServidor?`: <b>${escapeHtml(String(ultimoErroServidor))}</b>`:"."} Tira um print desta mensagem — é esse o problema a resolver.</span>`;
    } else {
      st.innerHTML = `<span style="color:var(--acao)">Pronto! ${criados} leads novos${mesclados?`, ${mesclados} juntados em leads que já existiam (mesmo telefone)`:""}${jaTinha?`, ${jaTinha} já importados antes`:""}${falhas?`, ${falhas} a refazer (rode de novo)`:""}. Já aparecem em Hoje e na Condução.</span>`;
    }

    // 2) ANALISAR os ativos — em segundo plano, em paralelo. Não trava: os leads já estão salvos.
    if(ativosIds.length){
      bar.style.width = "0%";
      let an = 0;
      const total = ativosIds.length;
      const CONC = 3;
      let idx = 0;
      async function worker(){
        while(idx < total){
          const myId = ativosIds[idx++];
          try{
            const ctrl = new AbortController(); const to = setTimeout(()=>ctrl.abort(), 60000);
            await fetch("./api/reanalisar-lead", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payloadComCerebro({ id: myId })), signal: ctrl.signal });
            clearTimeout(to);
          }catch(_){ /* segue; dá pra reanalisar o lead depois pela tela dele */ }
          an++;
          bar.style.width = Math.round((an/total)*100) + "%";
          st.innerHTML = `<span style="color:var(--cerebro)">Analisando ativos em segundo plano: ${an}/${total} (pode usar o app normalmente)</span>`;
        }
      }
      await Promise.all(Array.from({length:Math.min(CONC,total)}, worker));
      await loadRecentLeads();
      st.innerHTML = `<span style="color:var(--acao)">Tudo pronto! ${criados} leads importados e ${total} ativos analisados.</span>`;
    }
  }catch(err){
    st.innerHTML = '<span style="color:var(--risco)">Erro na importação: ' + escapeHtml(String(err?.message||err)) + '</span>';
  }finally{
    qs("#crmImportBtn").disabled = false;
    e.target.value = "";
  }
});
// ============ IMPORTAR CONVERSAS EM LOTE (ZIP de ZIPs) ============
// Recebe um .zip que contém vários .zip de conversas do WhatsApp (um por cliente,
// cada um no formato normal de exportação: um .txt dentro). Cada um passa pelo
// mesmo caminho de uma importação manual (upload -> processar -> salvar), só que
// em lote e sem precisar abrir tela por tela. O backend já deduplica por
// telefone/nome (persistProcessingResult), então rodar de novo nunca duplica —
// só atualiza. Guardamos localmente quais arquivos já entraram com sucesso pra
// não gastar chamada de IA de novo à toa se o corretor rodar o mesmo pacote outra vez.
const BULK_ZIP_IMPORT_RESUME_KEY = "corretor_pro_bulk_zip_import_done_v1";
function bulkZipImportResumeSet(){
  try{ return new Set(JSON.parse(localStorage.getItem(BULK_ZIP_IMPORT_RESUME_KEY) || "[]")); }
  catch(_){ return new Set(); }
}
function bulkZipImportMarkDone(nome){
  try{
    const s = bulkZipImportResumeSet();
    s.add(nome);
    localStorage.setItem(BULK_ZIP_IMPORT_RESUME_KEY, JSON.stringify([...s]));
  }catch(_){}
}

async function bulkZipImportUm(master, nomeZip){
  const blob = await master.files[nomeZip].async("blob");
  const nomeArquivo = nomeZip.split("/").pop();
  const fileZip = new File([blob], nomeArquivo, { type: "application/zip" });

  const metaRes = await fetch("./api/criar-upload-url", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ fileName: nomeArquivo, size: fileZip.size, contentType: "application/zip" })
  });
  const meta = await metaRes.json().catch(() => ({}));
  if(!metaRes.ok || !meta.ok) throw new Error(meta.error || meta.details || "Não consegui preparar o upload.");

  const signedUrl = meta.signedUrl || meta.signedurl || meta.signed_url;
  if(!signedUrl) throw new Error("Upload sem URL assinada.");
  const putRes = await fetch(signedUrl, {
    method:"PUT",
    headers:{ "Content-Type":"application/zip", "x-upsert":"true" },
    body: fileZip
  });
  if(!putRes.ok) throw new Error("Falha ao enviar o arquivo pro armazenamento.");

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 55000);
  let procRes, proc;
  try{
    procRes = await fetch("./api/processar-storage", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ bucket: meta.bucket, path: meta.path, action:"completo", cerebroConfig: (typeof obterCerebroConfigParaAnalise === "function" ? obterCerebroConfigParaAnalise() : null) }),
      signal: ctrl.signal
    });
    proc = await procRes.json().catch(() => ({}));
  } finally { clearTimeout(to); }
  if(!procRes.ok || !proc.ok) throw new Error(proc.error || proc.details || `Erro ${procRes.status} ao analisar.`);

  const saveRes = await fetch("./api/lead-update", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ action:"salvar-novo", result: proc, fileName: nomeArquivo, source:"bulk-import-planilha", bucket: meta.bucket, path: meta.path })
  });
  const saved = await saveRes.json().catch(() => ({}));
  if(!saveRes.ok || !saved.ok || !saved?.persistence?.processing?.id) throw new Error(saved.error || "Servidor não confirmou a gravação.");
  return saved;
}

qs("#crmZipImportBtn")?.addEventListener("click", () => qs("#crmZipInput")?.click());
qs("#crmZipInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if(!file) return;
  const st = qs("#crmZipImportStatus");
  const wrap = qs("#crmZipImportProgressWrap"), bar = qs("#crmZipImportProgress");
  const btn = qs("#crmZipImportBtn");
  btn.disabled = true;
  wrap.style.display = "block"; bar.style.width = "0%";
  st.textContent = "Lendo o pacote...";
  try{
    const JSZip = await ensureJSZip();
    const master = await JSZip.loadAsync(file);
    const todasEntradas = Object.keys(master.files).filter(name => !master.files[name].dir && name.toLowerCase().endsWith(".zip"));
    if(!todasEntradas.length){
      st.innerHTML = '<span style="color:var(--risco)">Não encontrei nenhum .zip de conversa dentro do pacote.</span>';
      return;
    }
    const jaFeitos = bulkZipImportResumeSet();
    const entries = todasEntradas.filter(n => !jaFeitos.has(n.split("/").pop()));
    const puladas = todasEntradas.length - entries.length;
    if(!entries.length){
      st.innerHTML = `<span style="color:var(--acao)">Todas as ${todasEntradas.length} conversas desse pacote já foram importadas antes. Nada a fazer.</span>`;
      return;
    }
    if(!confirm(`Encontrei ${todasEntradas.length} conversa(s) no pacote${puladas ? ` (${puladas} já importadas antes, vou pular)` : ""}.\n\n• Cada uma é enviada, analisada pela IA e salva sozinha.\n• Se já existir lead com o mesmo telefone/nome, ele é atualizado — não duplica.\n• Usa a API da OpenAI (tem custo) e pode levar alguns minutos.\n\nImportar ${entries.length} conversa(s) agora?`)) return;

    let ok = 0, falhas = 0, feitos = 0;
    const total = entries.length;
    const erros = [];
    const CONC = 3;
    let idx = 0;

    async function worker(){
      while(idx < entries.length){
        const nomeZip = entries[idx++];
        const nomeCurto = nomeZip.split("/").pop();
        try{
          await bulkZipImportUm(master, nomeZip);
          bulkZipImportMarkDone(nomeCurto);
          ok++;
        }catch(err){
          falhas++;
          erros.push(`${nomeCurto}: ${err?.message || err}`);
        }
        feitos++;
        bar.style.width = Math.round((feitos/total)*100) + "%";
        st.textContent = `Importando: ${feitos}/${total} · ${ok} ok${falhas ? `, ${falhas} falharam` : ""}`;
      }
    }
    await Promise.all(Array.from({length:Math.min(CONC, total)}, worker));

    invalidarLeadsCache?.();
    await loadRecentLeads();
    await carregarDashboard();
    await carregarAgendaTopo?.();

    if(falhas){
      st.innerHTML = `<span style="color:${ok ? 'var(--acao)' : 'var(--risco)'}">${ok} importada(s)/atualizada(s), ${falhas} falharam. Selecione o mesmo ZIP de novo pra tentar só as que faltaram.</span>` +
        `<details style="margin-top:6px"><summary style="cursor:pointer;color:var(--muted)">Ver erros</summary><pre style="white-space:pre-wrap;font-size:11px;color:var(--risco)">${escapeHtml(erros.join("\n"))}</pre></details>`;
    } else {
      st.innerHTML = `<span style="color:var(--acao)">Pronto! ${ok} conversa(s) importada(s)/atualizada(s)${puladas ? ` (${puladas} já vinham de antes)` : ""}. Já aparecem em Hoje e na Condução.</span>`;
    }
  }catch(err){
    st.innerHTML = '<span style="color:var(--risco)">Erro na importação: ' + escapeHtml(String(err?.message || err)) + '</span>';
  }finally{
    btn.disabled = false;
    e.target.value = "";
  }
});

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
function semAcento(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim(); }
window.semAcento = semAcento;
// Lead arquivado (arquivo morto / Perdido) ou na geladeira NÃO aparece na busca —
// fica só na tela dedicada (arquivo morto). Busca é pra leads ativos.
function foraDaBusca(l){ const e = normalizarEtapa(l?.etapa); return e === "Geladeira" || e === "Perdido"; }
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
    if(foraDaBusca(l)) return false; // arquivado/geladeira não aparece na busca
    return semAcento(l.name).includes(tt) || semAcento(l.product).includes(tt) || (numeros.length >= 3 && String(l.phone||"").replace(/\D/g,"").includes(numeros));
  }).slice(0, 12);
  if(!matches.length){
    box.style.display = "block";
    box.innerHTML = `<div class="small" style="padding:10px;color:var(--muted);text-align:center">Nenhum lead com "${escapeHtml(termo)}"</div>`;
    return;
  }
  box.style.display = "block";
  box.innerHTML = matches.map(l => {
    const idJs = JSON.stringify(String(l.id||""));
    return `<div onclick='abrirLead(${idJs});qs("#buscaGlobal").value="";qs("#buscaGlobalResults").style.display="none"' style="padding:8px 10px;border-radius:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background=''">
      <div><div style="font-weight:950;font-size:13px">${escapeHtml(l.name||"Cliente")}</div><div class="small" style="font-size:11px">${escapeHtml(l.product||"--")} · ${escapeHtml(l.etapa||"Novo")}</div></div>
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
    const matches = fonte.filter(l => !foraDaBusca(l) && (semAcento(l.name).includes(t) || semAcento(l.product).includes(t) || (numeros.length >= 3 && String(l.phone||"").replace(/\D/g,"").includes(numeros)))).slice(0, 12);
    box.style.display = "block";
    if(!matches.length){ box.innerHTML = `<div class="small" style="padding:10px;color:var(--muted);text-align:center">Nenhum lead com "${escapeHtml(t)}"</div>`; return; }
    box.innerHTML = matches.map(l => {
      const idJs = JSON.stringify(String(l.id||""));
      return `<div onclick='ui677AbrirBuscaLead(${idJs}, ${JSON.stringify(boxId)})' style="padding:9px 11px;border-radius:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="min-width:0"><div style="font-weight:950;font-size:13px">${escapeHtml(l.name||"Cliente")}</div><div class="small" style="font-size:11px;color:var(--muted)">${escapeHtml(l.product||"--")} · ${escapeHtml(l.etapa||"Novo")}</div></div>
      </div>`;
    }).join("");
  }, 200);
}
window.buscaLeadInline = buscaLeadInline;

qs("#pipelineRefresh")?.addEventListener("click", carregarPipeline);
qsa(".pipeline-filtro").forEach(btn => btn.addEventListener("click", () => {
  pipelineFiltro = btn.dataset.f || "todos";
  qsa(".pipeline-filtro").forEach(b => {
    const ativo = b.dataset.f === pipelineFiltro;
    b.classList.toggle("active", ativo);
    b.style.background = ativo ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.03)";
    b.style.color = ativo ? "var(--text)" : "var(--muted)";
    b.style.fontWeight = ativo ? "950" : "600";
  });
  carregarPipeline();
}));
let pipelineBuscaTimer = null;
qs("#pipelineBusca")?.addEventListener("input", (e)=>{
  pipelineBuscaTermo = e.target.value || "";
  clearTimeout(pipelineBuscaTimer);
  pipelineBuscaTimer = setTimeout(carregarPipeline, 250);
});
qs("#agendaRefresh")?.addEventListener("click", carregarAgenda);
qs("#dashboardRefresh")?.addEventListener("click", carregarDashboard);
qs("#vendasRefresh")?.addEventListener("click", carregarVendas);
qs("#perdidosRefresh")?.addEventListener("click", carregarPerdidos);
qs("#geladeiraRefresh")?.addEventListener("click", carregarGeladeira);
qs("#relatorioRefresh")?.addEventListener("click", () => carregarRelatorio(true));
qs("#carteiraRefresh")?.addEventListener("click", () => carregarCarteira(true));
qs("#carteiraExport")?.addEventListener("click", baixarRelatorioCarteira);
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
qs("#wipeAll").addEventListener("click", async ()=>{
  const ok1 = confirm("Tem certeza? Isso apaga TODAS as conversas, leads e ZIPs guardados. Não tem como recuperar.");
  if(!ok1) return;
  const ok2 = confirm("Última confirmação: apagar mesmo tudo?");
  if(!ok2) return;
  const box = qs("#wipeResult");
  box.style.display = "block";
  box.innerHTML = "Apagando…";
  try{
    const res = await fetch("./api/limpar-tudo", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ confirmacao: "APAGAR TUDO" })
    });
    const data = await res.json().catch(()=>({ ok:false, error:"resposta invalida" }));
    let html = '';
    if(!res.ok || !data.ok){
      html += '<div class="notice error">Falhou: '+escapeHtml(data.error||"erro desconhecido")+'</div>';
    } else {
      html += '<div class="notice">Pronto. '+(data.resumo?.linhasApagadas||0)+' registros e '+(data.resumo?.arquivosApagados||0)+' arquivos apagados.</div>';
    }
    if(Array.isArray(data.tabelas)){
      html += '<div style="margin-top:10px"><b>Diagnóstico por tabela:</b><br>';
      for(const t of data.tabelas){
        html += '• <b>'+escapeHtml(t.table)+'</b>: ';
        if(t.exists === false){
          html += '<i>tabela não existe ou sem acesso</i> ('+escapeHtml(t.error||"")+')';
        } else {
          html += 'antes='+(t.before||0)+', depois='+(t.after||0)+', apagados='+(t.deleted||0);
          if(t.attempts?.length){
            html += '<br>&nbsp;&nbsp;<i>erros nas tentativas:</i> ';
            html += t.attempts.map(a => escapeHtml(a.how+': '+a.error)).join(' | ');
          }
        }
        html += '<br>';
      }
      html += '</div>';
    }
    if(data.chave){
      html += '<div style="margin-top:10px"><b>Chave Supabase configurada:</b><br>';
      if(data.chave.ehServiceRole){
        html += '<span style="color:var(--accent)">role = '+escapeHtml(data.chave.role)+' ✓ (admin, correta)</span><br>';
      } else if(data.chave.role){
        html += '<span style="color:#ff5b7a">role = <b>'+escapeHtml(data.chave.role)+'</b> (precisa ser admin/service_role)</span><br>';
      } else if(!data.chave.formatoValido){
        html += '<span style="color:#ff5b7a">Formato não reconhecido (nem JWT nem sb_secret/sb_publishable)</span><br>';
      }
      if(data.chave.formato){
        html += '<span class="small">Formato: '+escapeHtml(data.chave.formato)+'</span><br>';
      }
      if(data.chave.prefixo){
        html += '<span class="small">Prefixo: '+escapeHtml(data.chave.prefixo)+'... · Sufixo: ...'+escapeHtml(data.chave.sufixo||"")+' · Tamanho: '+data.chave.tamanhoLimpo+' chars</span><br>';
      }
      const def = data.chave.defeitosEncontrados || {};
      const defAtivos = Object.entries(def).filter(([,v])=>v).map(([k])=>k);
      if(defAtivos.length){
        html += '<span style="color:#ffc4f4">Defeitos detectados no copy/paste: '+escapeHtml(defAtivos.join(", "))+'</span><br>';
      }
      html += '</div>';
    }
    if(data.dica){
      html += '<div class="notice error" style="margin-top:10px"><b>Como consertar:</b><br>'+escapeHtml(data.dica)+'</div>';
    }
    if(data.storage){
      html += '<div style="margin-top:10px"><b>Storage (bucket '+escapeHtml(data.storage.bucket||"")+'):</b> ';
      if(data.storage.ok){
        html += data.storage.deleted+' arquivo(s) apagado(s)';
      } else {
        html += '<span style="color:#ffdbe2">erro: '+escapeHtml(data.storage.error||"")+'</span>';
      }
      html += '</div>';
    }
    box.innerHTML = html;
    if(data.ok && (data.resumo?.linhasApagadas||0) > 0){
      state.lead = null; state.focoLeadId = null;
      state.leads = [];
      renderLeads();
      loadRecentLeads();
      toast("App zerado.");
    }
  }catch(err){
    box.innerHTML = '<div class="notice error">Erro de rede: '+escapeHtml(String(err?.message||err))+'</div>';
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

// ============ VENDAS REGISTRADAS ============
async function carregarVendas(){
  const box = qs("#vendasList");
  box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
  try{
    const res = { ok:true, json: async () => await getLeadsData() };
    const data = await res.json();
    const items = (data?.items || []).map(limparLead).filter(l => normalizarEtapa(l.etapa) === "Vendido");
    if(!items.length){
      box.innerHTML = '<div class="empty">Nenhuma venda registrada ainda. Abra o lead e use o botão "Marcar venda".</div>';
      return;
    }
    box.innerHTML = items.map(l => {
      const v = l.analysis?.venda || {};
      const valor = v.valor ? "R$ "+escapeHtml(String(v.valor)) : "";
      return `
        <div style="border:1px solid var(--line);background:rgba(104,255,149,.05);border-radius:14px;padding:12px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <strong style="font-size:15px">${escapeHtml(l.name||"Cliente")}</strong>
            <span class="tag hot" style="background:rgba(104,255,149,.18);color:#bdffd0;border-color:rgba(104,255,149,.32)">VENDIDO</span>
          </div>
          ${v.empreendimento ? `<div class="small" style="margin-top:6px">${escapeHtml(v.empreendimento)}${v.unidade?" · Unid. "+escapeHtml(v.unidade):""}${v.box?" · Box "+escapeHtml(v.box):""}</div>` : ""}
          ${valor ? `<div class="small" style="margin-top:4px;color:var(--acao);font-weight:950">${valor}</div>` : ""}
          ${v.observacoes ? `<div class="small" style="margin-top:6px">${escapeHtml(v.observacoes)}</div>` : ""}
          ${v.registradaEm ? `<div class="small" style="margin-top:6px;color:var(--muted)">Registrada em ${escapeHtml(new Date(v.registradaEm).toLocaleString("pt-BR"))}</div>` : ""}
        </div>`;
    }).join("");
  }catch(err){
    box.innerHTML = '<div class="notice error">Falha: '+escapeHtml(String(err?.message||err))+'</div>';
  }
}

// ===== Relatório: fechamento do mês + funil =====
// Tudo calculado no front a partir da base de leads (getLeadsData). Sem nada novo no banco.
const FUNIL_ETAPAS = ["Novo", "Atendimento", "Visita/Proposta", "Negociação", "Standby"];
async function carregarRelatorio(force){
  const box = qs("#relatorioBody");
  if(!box) return;
  const renderDe = (data) => {
    if(data && data.ok === false){ box.innerHTML = '<div class="empty">Não consegui puxar seus leads agora. Toque em Atualizar.</div>'; return; }
    const all = (data?.items || []).map(limparLead);
    box.innerHTML = renderDesempenhoDash(all);
  };
  if(!force && state.todosLeads?.length){
    renderDe({ items: state.todosLeads });
    return;
  }
  box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
  try{
    const data = await getLeadsData(force);
    renderDe(data);
  }catch(err){
    box.innerHTML = '<div class="notice error">Falha: '+escapeHtml(String(err?.message||err))+'</div>';
  }
}
window.carregarRelatorio = carregarRelatorio;

// Painel de Desempenho (visual #481): KPIs + atendimentos/dia + funil de conversão — tudo com dado REAL.
function renderDesempenhoDash(all){
  all=Array.isArray(all)?all:[];
  const ativos=all.filter(leadEhAtivo);
  const categorias=new Map(ativos.map(l=>[l,cp786Categoria(l)]));
  const categoriaDe=l=>categorias.get(l)||cp786Categoria(l);
  const counts={agora:0,respondeu:0,programados:0,aguardando:0};
  for(const l of ativos){const c=categoriaDe(l);if(counts[c]!==undefined)counts[c]++;}

  const hoje0=(typeof inicioDoDiaBR==='function')?inicioDoDiaBR():new Date(new Date().setHours(0,0,0,0));
  const DOW=['D','S','T','Q','Q','S','S'];
  const dias=[];
  for(let i=6;i>=0;i--){const d=new Date(hoje0);d.setDate(d.getDate()-i);dias.push({ini:d,n:0,lbl:DOW[d.getDay()],hoje:i===0});}
  for(const l of all){
    const evs=l.analysis?.aprendizado?.eventos||[];
    for(const ev of evs){
      if(ev.evento!=='contato_manual'||!ev.quando) continue;
      const q=new Date(ev.quando);if(isNaN(q.getTime())) continue;
      for(const dd of dias){const fim=new Date(dd.ini);fim.setDate(fim.getDate()+1);if(q>=dd.ini&&q<fim){dd.n++;break;}}
    }
  }
  const atendimentosHoje=dias[6].n,maxN=Math.max(1,...dias.map(d=>d.n));
  const barras=dias.map(d=>`<div class="dz-bar${d.hoje?' hoje':''}"><span class="num">${d.n}</span><span class="col" style="height:${Math.round(d.n/maxN*100)}%"></span><span class="d">${d.lbl}</span></div>`).join('');

  const agoraData=new Date();let vMesQtd=0,vMesValor=0;
  for(const l of all){
    if(normalizarEtapa(l.etapa)!=='Vendido') continue;
    const dt=l.analysis?.venda?.registradaEm?new Date(l.analysis.venda.registradaEm):null;
    if(!dt||isNaN(dt.getTime())) continue;
    if(dt.getMonth()===agoraData.getMonth()&&dt.getFullYear()===agoraData.getFullYear()){vMesQtd++;vMesValor+=parseValorVenda(l.analysis?.venda?.valor);}
  }
  const nomeMes=agoraData.toLocaleDateString('pt-BR',{month:'long'}),ticket=vMesQtd?vMesValor/vMesQtd:0;
  const totalAcoes=Math.max(1,counts.agora+counts.respondeu+counts.programados+counts.aguardando);
  const leitura=[['Fazer agora',counts.agora],['Agenda',counts.programados],['Aguardando cliente',counts.aguardando]].map(([lbl,n])=>{const pct=Math.round(n/totalAcoes*100);return `<div class="row"><div class="top"><b>${lbl}</b><span>${n} · ${pct}%</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;}).join('');
  const kpi=(k,v)=>`<div class="dz-kpi"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  return `
    <div class="dz-head"><h2>Ritmo comercial</h2><div class="sub">Movimentação real · últimos 7 dias</div></div>
    <div class="dz-kpis">
      ${kpi('Clientes ativos',ativos.length)}
      ${kpi('Atendidos hoje',atendimentosHoje)}
      ${kpi('Pedem sua ação',counts.agora)}
      ${kpi('Vendas no mês',vMesQtd)}
    </div>
    <div class="dz-grid">
      <div class="dz-card"><h4>Atendimentos por dia</h4><div class="dz-bars">${barras}</div></div>
      <div class="dz-card"><h4>Condução atual</h4>${leitura}</div>
    </div>
    <div class="dz-card dz-vendas"><h4 style="text-transform:capitalize">Fechamento de ${nomeMes}</h4>
      <div class="dz-vrow">
        <div><div class="v" style="color:var(--lime)">${vMesQtd}</div><div class="k">${vMesQtd===1?'venda':'vendas'}</div></div>
        <div><div class="v" style="color:var(--acao)">${vMesValor>0?formatBRL(vMesValor):'R$ 0'}</div><div class="k">valor total</div></div>
        <div><div class="v">${ticket>0?formatBRL(ticket):'—'}</div><div class="k">ticket médio</div></div>
      </div>
    </div>`;
}

// ===== Carteira completa: todos os leads num lugar (panorama + contatar hoje + ranking) =====
// Reusa o mesmo dado (leads-recentes limit=2000) e os mesmos critérios da Hoje (scoreLead,
// entraEmRetomada, etapas). Não cria função nova no servidor — tudo no cliente, em cima do cache.
function carteiraEhFinal(e){ return e === "Vendido" || e === "Perdido" || e === "Geladeira"; }
function carteiraLinhaLead(l, pos){
  const idJs = JSON.stringify(String(l.id||""));
  const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction+"d" : "—";
  const etapa = normalizarEtapa(l.etapa);
  return `<div onclick='abrirLead(${idJs})' style="display:flex;align-items:center;gap:10px;padding:10px 6px;border-bottom:1px solid var(--line);cursor:pointer">
    ${pos!=null?`<div style="width:22px;text-align:center;font-weight:950;color:var(--muted);font-size:12px;flex-shrink:0">${pos}</div>`:""}
    <div style="flex:1;min-width:0">
      <div style="font-weight:950;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(l.name||"Cliente")}</div>
      <div class="small" style="color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(etapa)} · ${escapeHtml(motivoCurto(l))}</div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div class="small" style="color:var(--muted)">${dias} parado</div>
    </div>
  </div>`;
}
async function carregarCarteira(force){
  if(state.active !== "carteira") return;
  const box = qs("#carteiraBody");
  if(!box) return;
  const renderDe = (data) => {
    if(data && data.ok === false){ box.innerHTML = boxErro("carregarCarteira(true)"); return; }
    const all = (data?.items || []).map(limparLead);
    state.carteiraLeads = all;
    if(!all.length){ box.innerHTML = '<div class="empty">Nenhum lead ainda. Importe uma conversa pra começar.</div>'; return; }
    renderCarteiraTabela();
  };
  if(!force && state.todosLeads?.length){
    renderDe({ items: state.todosLeads });
    return;
  }
  box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
  try{
    const data = await getLeadsData(force);
    renderDe(data);
  }catch(err){
    box.innerHTML = boxErro("carregarCarteira(true)");
  }
}
window.carregarCarteira = carregarCarteira;

// ---- Carteira em tabela (visual #480): Cliente · Empreendimento · Score · Resposta · Próxima ação ----
const CART_FILTROS = [["todos","Todos"],["quentes","Agora"],["reaquecer","Reativar"],["geladeira","Arquivados"]];
const ETAPA_DOT = {"Novo":"var(--soft)","Atendimento":"var(--dados)","Visita/Proposta":"var(--lime)","Negociação":"var(--acao)","Standby":"var(--muted)","Geladeira":"var(--muted)","Vendido":"var(--acao)","Perdido":"var(--risco)"};
const CART_AV_CORES = ["#7DD3FC","#86EFAC","#F0ABFC","#FCA5A5","#FDE047","#A5B4FC","#5EEAD4","#FDBA74"];
function carteiraAvatarCor(s){ let h = 0; const t = String(s||""); for(let i=0;i<t.length;i++) h = (h*31 + t.charCodeAt(i))|0; return CART_AV_CORES[Math.abs(h) % CART_AV_CORES.length]; }
function carteiraPassaFiltro(l, f){
  const e = normalizarEtapa(l.etapa);
  if(f === "geladeira") return e === "Geladeira";
  if(!leadEhAtivo(l)) return false;
  if(f === "reaquecer") return leadEhReaquecer(l);
  if(f === "quentes") return leadEhQuente(l);
  return true;
}
const CARTEIRA_PAGE_SIZE = 80;
function setCarteiraFiltro(f){
  state.carteiraFiltro = f;
  state.carteiraVisibleCount = CARTEIRA_PAGE_SIZE;
  if(state.active === "carteira") cpReplaceRoute(cpRouteForScreen("carteira"));
  renderCarteiraTabela();
}
function carregarMaisCarteira(){
  state.carteiraVisibleCount = Math.max(CARTEIRA_PAGE_SIZE, Number(state.carteiraVisibleCount || CARTEIRA_PAGE_SIZE)) + CARTEIRA_PAGE_SIZE;
  renderCarteiraTabela();
}
window.setCarteiraFiltro = setCarteiraFiltro;
window.carregarMaisCarteira = carregarMaisCarteira;
function renderCarteiraTabela(){
  const _perfStart = cpPerfNow();
  const box = qs("#carteiraBody");
  if(!box) return;
  const base = (state.carteiraLeads||[]).filter(l => { const e = normalizarEtapa(l.etapa); return e !== "Vendido" && e !== "Perdido"; });
  const filtro = state.carteiraFiltro || "todos";
  const lista = base.filter(l => carteiraPassaFiltro(l, filtro)).map(l => ({ ...l, _s: scoreRankingHoje(l) })).sort(compararPrioridadeAtendimento);
  const chips = CART_FILTROS.map(([k,lbl]) => `<button type="button" class="${k===filtro?"active":""}" onclick="setCarteiraFiltro('${k}')">${lbl}</button>`).join("");
  const visiveis = Math.max(CARTEIRA_PAGE_SIZE, Number(state.carteiraVisibleCount || CARTEIRA_PAGE_SIZE));
  const lote = lista.slice(0, visiveis);
  const faltam = Math.max(0, lista.length - lote.length);
  const linhas = lista.length ? lote.map(carteiraRowHTML).join("") : '<div class="empty" style="margin:14px">Nenhum lead nesse filtro.</div>';
  const carregarMais = faltam > 0 ? `<button type="button" class="cart-load-more" onclick="carregarMaisCarteira()">Carregar mais ${Math.min(CARTEIRA_PAGE_SIZE, faltam)} <span>(${lote.length} de ${lista.length})</span></button>` : "";
  box.innerHTML = `
    ${ui677ToolbarHTML("atendimentos")}
    <div class="cart-head">
      <div><h2>Atendimentos</h2><div class="sub">${lista.length} lead${lista.length!==1?"s":""} neste filtro · ordenados por prioridade de contato</div></div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <div class="cart-filtros">${chips}</div>
        <button type="button" class="cart-export" onclick="exportarLeadsCSV(this)" title="Baixar Excel (CSV) de TODOS os leads com o histórico inteiro">⬇ Excel</button>
        <button type="button" class="cart-export" onclick="exportarBackupCompletoV681(this)" title="Backup completo em JSON, com dados brutos do banco e auditoria de integridade">🛡 Backup</button>
        <button type="button" class="cart-export" onclick="auditarDadosV681(this)" title="Conferir possíveis duplicidades, leads sem histórico e inconsistências">✓ Auditar</button>
      </div>
    </div>
    <div class="cart-table">
      <div class="cart-thead"><span>Cliente</span><span>Empreendimento</span><span>Prioridade</span><span>Resposta</span><span>Próxima ação</span><span></span></div>
      ${linhas}
      ${carregarMais}
    </div>`;
  cpPerfMark("renderCarteira", _perfStart, { total:lista.length, visiveis:lote.length });
}
function carteiraRowHTML(l){
  const idJs = JSON.stringify(String(l.id||""));
  const prioridade = prioridadeAtendimento(l) || {};
  const etapa = normalizarEtapa(l.etapa);
  const dot = ETAPA_DOT[etapa] || "var(--muted)";
  const resp = l.lastInteractionAt ? formatarTempoRelativo(l.lastInteractionAt).replace(/ atrás$/,"") : (l.daysSinceLastInteraction!=null ? l.daysSinceLastInteraction+"d" : "—");
  const acao = l.nextAction ? String(l.nextAction) : motivoCurto(l);
  return `<div class="cart-row" onclick='abrirLead(${idJs})'>
    <div class="cart-cli">
      <div style="min-width:0">
        <div class="cart-nm">${escapeHtml(l.name||"Cliente")}</div>
        <div class="cart-etapa"><span class="cart-dot" style="background:${dot}"></span>${escapeHtml(etapa)}</div>
      </div>
    </div>
    <div class="cart-emp">${escapeHtml(l.product||"—")}</div>
    <div class="cart-priority" title="Prioridade de atendimento">${escapeHtml(prioridade.titulo || "Prioridade")}</div>
    <div class="cart-resp">${escapeHtml(resp)}</div>
    <div class="cart-acao">${escapeHtml(acao)}</div>
    <div class="cart-chev">›</div>
  </div>`;
}

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
      const etapa = l.etapa || "";
      const prioridade = (typeof prioridadeTituloCurto === "function") ? prioridadeTituloCurto(l) : "";
      const perfil = a.clientProfile && a.clientProfile !== "—" ? a.clientProfile : "";
      const porque = a.summary || l.summary || "";
      const preferencias = mem.preferencias || "";
      const observacoes = mem.observacoes || "";
      const objections = Array.isArray(a.objections) ? a.objections.slice(0,5) : [];
      const pontosSensiveis = String(mem.pontosSensiveis||"").split(/[·\n;]+/).map(s=>s.trim()).filter(Boolean);
      const pesaContraArr = [];
      const _normpc = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
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

async function baixarRelatorioCarteira(){
  let all = Array.isArray(state.carteiraLeads) ? state.carteiraLeads : [];
  if(!all.length){ toast("Nada pra exportar ainda. Abra a Carteira primeiro."); return; }
  toast("Carregando os históricos completos para o relatório…");
  all = await carregarDetalhesParaExportacao(all);
  const ativos = all.filter(l => !carteiraEhFinal(normalizarEtapa(l.etapa))).map(l => ({...l,_s:scoreRankingHoje(l)})).sort(compararPrioridadeAtendimento);
  const finais = all.filter(l => carteiraEhFinal(normalizarEtapa(l.etapa)));
  const ordem = ativos.concat(finais);
  const linhas = [];
  linhas.push("RELATÓRIO DA CARTEIRA — Corretor Pro");
  linhas.push("Gerado em " + new Date().toLocaleString("pt-BR"));
  linhas.push("Total de leads: " + all.length);
  linhas.push("=".repeat(60));
  linhas.push("");
  for(const l of ordem){
    const etapa = normalizarEtapa(l.etapa);
    const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction + " dias parado" : "—";
    linhas.push(`### ${l.name || "Cliente"} — ${etapa}`);
    linhas.push(`Produto: ${l.product || "—"} | Prioridade: ${prioridadeTituloCurto(l)} | ${dias} | Telefone: ${l.phone || "—"}`);
    const resumo = (l.analysis?.summary || l.summary || "").trim();
    if(resumo) linhas.push(`Situacao: ${resumo}`);
    const next = (l.analysis?.nextAction || l.nextAction || "").trim();
    if(next) linhas.push(`Proxima acao: ${next}`);
    const obs = (l.analysis?.memoria?.observacoes || "").trim();
    if(obs) linhas.push(`Observacoes: ${obs}`);
    const msgs = Array.isArray(l.recentMessages) ? l.recentMessages.filter(m => m && String(m.text||"").trim()) : [];
    if(msgs.length){
      linhas.push("Historico:");
      for(const m of msgs){
        linhas.push(`  [${m.date||""} ${m.time||""}] ${m.author||""}: ${String(m.text||"").replace(/\s+/g," ").trim()}`);
      }
    } else {
      linhas.push("Historico: (sem mensagens registradas)");
    }
    linhas.push("");
    linhas.push("-".repeat(60));
    linhas.push("");
  }
  const blob = new Blob([linhas.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `carteira-corretor-pro-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { try{ document.body.removeChild(a); }catch(_){}; URL.revokeObjectURL(url); }, 1000);
  toast(`Relatório de ${all.length} leads baixado.`);
}
window.baixarRelatorioCarteira = baixarRelatorioCarteira;

async function registrarAprendizado(evento, estilo, detalhes){
  const id = state.lead?.id;
  if(!id) return;
  try{
    await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, action: "aprendizado", evento, estilo: estilo || state.msgStyle, detalhes: detalhes || {} })
    });
  }catch(_){}
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
    try{ await registrarAprendizado("cliente_respondeu", state.msgStyle, { resposta: valor }); }catch(_){}
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

// Lista os leads marcados como Perdido, com motivo (quando há) e botão Reabrir.
async function carregarPerdidos(){
  const box = qs("#perdidosList");
  if(!box) return;
  box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
  try{
    const res = { ok:true, json: async () => await getLeadsData() };
    const data = await res.json();
    const items = (data?.items || []).map(limparLead).filter(l => normalizarEtapa(l.etapa) === "Perdido");
    if(!items.length){
      box.innerHTML = '<div class="empty">Nenhum lead perdido no momento.</div>';
      return;
    }
    box.innerHTML = `<div class="small" style="color:var(--muted);margin-bottom:10px">${items.length} lead${items.length>1?"s":""} perdido${items.length>1?"s":""}.</div>` + items.map(l => {
      const idJs = JSON.stringify(String(l.id||""));
      const motivo = l.analysis?.motivoPerda || l.analysis?.motivo_perda || "";
      const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction+"d parado" : "";
      return `
        <div data-perdido-id="${escapeHtml(String(l.id||""))}" style="border:1px solid var(--line);background:rgba(255,91,122,.04);border-radius:14px;padding:12px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div style="flex:1;min-width:0">
              <strong style="font-size:15px;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(55,232,255,.3)" onclick='abrirLead(${idJs})'>${escapeHtml(l.name||"Cliente")}</strong>
              <div class="small" style="margin-top:4px;color:var(--muted)">${escapeHtml(produtosLabel(l))}${dias?" · "+dias:""}</div>
              ${motivo ? `<div class="small" style="margin-top:6px"><b>Motivo:</b> ${escapeHtml(motivo)}</div>` : ""}
            </div>
            <span class="tag" style="background:rgba(255,91,122,.12);color:#ffdbe2;border-color:rgba(255,91,122,.32);font-size:10px">PERDIDO</span>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button type="button" onclick='abrirLead(${idJs})' style="padding:6px 12px;background:transparent;color:var(--soft);border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Ver lead</button>
            <button type="button" onclick='reabrirLeadPerdido(${idJs},this)' style="padding:6px 12px;background:rgba(104,255,149,.12);color:var(--acao);border:1px solid var(--acao);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Reabrir</button>
          </div>
        </div>`;
    }).join("");
  }catch(err){
    box.innerHTML = '<div class="notice error">Falha: '+escapeHtml(String(err?.message||err))+'</div>';
  }
}
window.carregarPerdidos = carregarPerdidos;

async function reabrirLeadPerdido(id, btn){
  if(!id) return;
  if(!confirm("Reabrir este cliente? Ele volta para os atendimentos ativos.")) return;
  if(btn){ btn.disabled = true; btn.textContent = "Reabrindo..."; }
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, action: "etapa", etapa: "Atendimento" })
    });
    if(!res.ok) throw new Error("falha");
    toast("Lead reaberto em Atendimento.");
    const card = document.querySelector(`[data-perdido-id="${id}"]`);
    if(card){ card.style.transition = "opacity .25s, transform .25s"; card.style.opacity = "0"; card.style.transform = "translateX(18px)"; setTimeout(() => card.remove(), 240); }
    loadRecentLeads();
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Reabrir"; }
    toast("Erro ao reabrir.");
  }
}
window.reabrirLeadPerdido = reabrirLeadPerdido;

// Lista os leads na Geladeira (negócios fracos guardados pra revisitar), com botão Reativar.
// Radar da Geladeira: aponta quem vale revisitar por etapa, permuta ou contexto concreto.
function valeRevisitarGeladeira(l){
  if(normalizarEtapa(l.etapa) !== "Geladeira") return null;
  const a = l.analysis || {};
  const dias = Number(l.daysSinceLastInteraction) || 0;
  const etapaIA = normalizarEtapa(a.etapaSugerida);
  const objTxt = ((Array.isArray(a.objections) ? a.objections.join(" ") : String(a.objections||"")) + " " + String(a.memoria?.observacoes||"") + " " + String(a.summary||"")).toLowerCase();
  const temSafra = /safra|colhe|colheita|plantio|lavoura/.test(objTxt);
  const sinalForte = etapaIA === "Negociação" || etapaIA === "Visita/Proposta" || a.permuta || temSafra;
  if(!sinalForte) return null;
  const motivos = [];
  if(etapaIA === "Negociação" || etapaIA === "Visita/Proposta") motivos.push(`parou em ${etapaIA}`);
  if(a.permuta) motivos.push("permuta (talvez já vendeu o bem)");
  if(temSafra) motivos.push("safra/colheita já pode ter terminado");
  if(dias >= 60) motivos.push(`${dias} dias parado`);
  if(!motivos.length) return null;
  return { motivos };
}

async function carregarGeladeira(){
  const box = qs("#geladeiraList");
  if(!box) return;
  box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
  try{
    const res = { ok:true, json: async () => await getLeadsData() };
    const data = await res.json();
    const items = (data?.items || []).map(limparLead).filter(l => ["Geladeira","Perdido"].includes(normalizarEtapa(l.etapa)));
    if(!items.length){
      box.innerHTML = '<div class="empty">Nenhum contato arquivado no momento.</div>';
      return;
    }
    const cardGel = (l, motivos) => {
      const idJs = JSON.stringify(String(l.id||""));
      const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction+"d parado" : "";
      const destaque = motivos && motivos.length;
      const motivoHtml = destaque ? `<div style="margin-top:8px;padding:6px 8px;background:rgba(104,255,149,.06);border-left:3px solid var(--acao);border-radius:6px;font-size:12px"><b style="color:var(--acao)">Vale revisitar:</b> ${escapeHtml(motivos.join(" · "))}</div>` : "";
      return `
        <div data-geladeira-id="${escapeHtml(String(l.id||""))}" style="border:1px solid ${destaque?"var(--acao)":"var(--line)"};background:${destaque?"rgba(104,255,149,.05)":"rgba(0,212,255,.04)"};border-radius:14px;padding:12px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div style="flex:1;min-width:0">
              <strong style="font-size:15px;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(55,232,255,.3)" onclick='abrirLead(${idJs})'>${escapeHtml(l.name||"Cliente")}</strong>
              <div class="small" style="margin-top:4px;color:var(--muted)">${escapeHtml(produtosLabel(l))}${dias?" · "+dias:""}</div>
            </div>
            <span class="tag" style="background:rgba(0,212,255,.12);color:#bff0ff;border-color:rgba(0,212,255,.32);font-size:10px">ARQUIVADO</span>
          </div>
          ${motivoHtml}
          <div style="display:flex;gap:8px;margin-top:10px">
            <button type="button" onclick='abrirLead(${idJs})' style="padding:6px 12px;background:transparent;color:var(--soft);border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Ver lead</button>
            <button type="button" onclick='reativarLeadGeladeira(${idJs},this)' style="padding:6px 12px;background:rgba(104,255,149,.12);color:var(--acao);border:1px solid var(--acao);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Reativar</button>
          </div>
        </div>`;
    };
    // Todos os leads da geladeira são mostrados IGUAIS — sem destaque "vale revisitar" (pedido do dono).
    let html = `<div class="small" style="color:var(--muted);margin-bottom:10px">${items.length} negócio${items.length>1?"s":""} guardado${items.length>1?"s":""}.</div>`;
    html += items.map(l => cardGel(l, null)).join("");
    box.innerHTML = html;
  }catch(err){
    box.innerHTML = '<div class="notice error">Falha: '+escapeHtml(String(err?.message||err))+'</div>';
  }
}
window.carregarGeladeira = carregarGeladeira;

async function reativarLeadGeladeira(id, btn){
  if(!id) return;
  if(!confirm("Reativar este cliente? Ele volta para os atendimentos ativos.")) return;
  if(btn){ btn.disabled = true; btn.textContent = "Reativando..."; }
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, action: "etapa", etapa: "Atendimento" })
    });
    if(!res.ok) throw new Error("falha");
    toast("Lead reativado em Atendimento.");
    const card = document.querySelector(`[data-geladeira-id="${id}"]`);
    if(card){ card.style.transition = "opacity .25s, transform .25s"; card.style.opacity = "0"; card.style.transform = "translateX(18px)"; setTimeout(() => card.remove(), 240); }
    loadRecentLeads();
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Reativar"; }
    toast("Erro ao reativar.");
  }
}
window.reativarLeadGeladeira = reativarLeadGeladeira;

async function arquivarLead(id, nome){
  if(!id) return;
  if(!confirm(`Arquivar ${nome || "este lead"}? Ele sai das prioridades, mas continua guardado para ser reativado depois.`)) return;
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, action: "etapa", etapa: "Geladeira" })
    });
    const data = await res.json().catch(()=>({ok:false}));
    if(data?.ok){
      toast("Lead arquivado.");
      // O servidor já arquivou, mas a Home lê de um cache em memória (fast-path do
      // carregarDashboard). Sem atualizar esse cache e invalidar a busca, o lead
      // arquivado continuava aparecendo nas prioridades até um refresh manual.
      const sid = String(id);
      for(const lista of [state.todosLeads, state.leads]){
        if(!Array.isArray(lista)) continue;
        const l = lista.find(x => String(x.id) === sid);
        if(l) l.etapa = "Geladeira";
      }
      if(Array.isArray(state.itemsAtivos)) state.itemsAtivos = state.itemsAtivos.filter(x => String(x.id) !== sid);
      invalidarLeadsCache();
      voltarDoLead();
      carregarDashboard();
      loadRecentLeads(true);
    } else {
      toast("Erro: " + (data?.error || "falha"));
    }
  }catch(err){ toast("Erro de rede: " + (err?.message||err)); }
}
window.arquivarLead = arquivarLead;

async function marcarPerdido(id, nome){
  if(!id) return;
  if(!confirm(`Arquivar ${nome || "este lead"}? Ele sai do total de leads ativos e da busca, e vai pro arquivo morto (dá pra reabrir depois).`)) return;
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, action: "etapa", etapa: "Perdido" })
    });
    const data = await res.json().catch(()=>({ok:false}));
    if(data?.ok){
      removerLeadDosCaches(id); // tira da busca e do total na hora (sem esperar reload)
      toast("Lead arquivado (arquivo morto).");
      voltarDoLead();
      carregarDashboard();
    } else {
      toast("Erro: " + (data?.error || "falha"));
    }
  }catch(err){ toast("Erro de rede: " + (err?.message||err)); }
}
window.marcarPerdido = marcarPerdido;

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

// Botão "voltar ao topo" — aparece após rolar 400px, scroll suave ao clicar.
(() => {
  const btn = qs("#btnVoltarTopo");
  if(!btn) return;
  const atualizar = () => {
    if(window.scrollY > 400) btn.style.display = "flex";
    else btn.style.display = "none";
  };
  addEventListener("scroll", atualizar, { passive: true });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  atualizar();
})();

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
  if(state.active === "home") carregarDashboard();
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
  // / foca busca
  if(e.key === "/"){ const b = qs("#buscaGlobal"); if(b){ e.preventDefault(); b.focus(); } return; }
  // 1, 2, 3 selecionam o card do Top 3
  if(e.key === "1" || e.key === "2" || e.key === "3"){
    const idx = Number(e.key) - 1;
    const card = qsa(".top3-mini")[idx];
    if(card){ e.preventDefault(); card.click(); }
    return;
  }
  // h volta pra home, p pipeline, a agenda, m menu, z zip
  const mapTeclas = { h: "home", p: "pipeline", m: "menu", z: "zip", c: "cerebro" };
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
  return !["Vendido","Perdido","Geladeira"].includes(normalizarEtapa(l?.etapa));
}
function leadEhQuente(l){
  if(!leadEhAtivo(l)) return false;
  const tipo = String(l?.analysis?.tipoRetomada||"").toLowerCase();
  const interesse = String(l?.analysis?.diagnostico?.interesse||"").toLowerCase();
  const etapa = normalizarEtapa(l?.etapa);
  return tipo === "quente-fechar" || interesse === "alto" || etapa === "Negociação";
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
function cp786Categoria(l,modelo=null,ultimaReal=null){
  if(!leadEhAtivo(l)) return '';
  // Quando usada como callback de Array.map, o segundo argumento é o índice.
  // Só aceita os caches opcionais quando são objetos válidos de verdade.
  const modeloValido=modelo&&typeof modelo==='object'&&!Array.isArray(modelo)?modelo:null;
  const ultimaValida=ultimaReal&&typeof ultimaReal==='object'&&!Array.isArray(ultimaReal)&&'falante' in ultimaReal?ultimaReal:null;
  const mc=modeloValido||cp786Modelo(l), ultima=ultimaValida||cp786UltimaMensagemReal(l);
  // A categoria "Cliente respondeu" foi extinta a pedido do corretor: ela só indicava que a
  // última mensagem importada era do cliente (muitas vezes só um "ok"/"até"), inflando um número
  // sem valor de decisão. Sem esse atalho, o lead é classificado pela AÇÃO real (agora / programados
  // / aguardando), então o que precisa de resposta cai em "Fazer agora" e o resto em "Aguardando".
  if(cp786TemCompromisso(l)) return 'programados';
  const acao=mc?.acao||{}, status=String(acao.status||''), responsavel=String(acao.responsavel||'');
  const msgTs=cp786UltimaMensagemTs(l,ultima), atendimentoTs=cp786UltimoAtendimentoTs(l);
  const mensagemTratada=!!atendimentoTs&&(!msgTs||atendimentoTs>=msgTs);
  const precisaCorretor=responsavel==='corretor'||['responder-agora','retomar'].includes(status)||lembreteVencido(l);
  if(precisaCorretor){
    if(status==='responder-agora'&&mensagemTratada) return 'aguardando';
    // v818: um atendimento recente (marcado pelo corretor) faz o lead descansar, inclusive
    // quando há lembrete vencido — desde que o atendimento tenha acontecido DEPOIS que o
    // lembrete venceu. Sem isto, um lembrete antigo furava a proteção de 5 dias e o lead
    // voltava pra fila no dia seguinte ao atendimento.
    const lembTs=lembreteTs(l);
    const atendimentoAposLembrete=!!atendimentoTs&&(!lembTs||isNaN(lembTs)||atendimentoTs>=lembTs);
    const descansoAtendimento=ehContatadoHoje(l)||(mensagemTratada&&typeof protegidoPosAtendimento==='function'&&protegidoPosAtendimento(l));
    if(descansoAtendimento&&(!lembreteVencido(l)||atendimentoAposLembrete)) return 'aguardando';
    return 'agora';
  }
  if(status==='aguardando-resposta'||responsavel==='contato') return 'aguardando';
  // A interface trabalha com apenas quatro visões. Um atendimento ativo sem ação
  // imediata permanece em “Aguardando cliente”, em vez de criar uma quinta categoria oculta.
  if(status==='sem-acao-urgente'||responsavel==='ninguem') return 'aguardando';
  return 'aguardando';
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
    meta.set(l,{categoria,ordem:ordem[categoria]??9,score:Number.isFinite(score)?score:0,compromisso:categoria==='programados'?cp786CompromissoOrdemTs(l):Number.MAX_SAFE_INTEGER});
  }
  return arr.sort((a,b)=>{
    const ma=meta.get(a),mb=meta.get(b);
    if(ma.ordem!==mb.ordem) return ma.ordem-mb.ordem;
    if(ma.categoria==='programados'&&ma.compromisso!==mb.compromisso) return ma.compromisso-mb.compromisso;
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
function cp786AbrirConducao(filtro){
  state.pipelineVisualFiltro=filtro||'agora';
  show('pipeline');
}
function cp786AbrirPrioridadePrincipal(){
  const leads=(state?.itemsAtivos||state?.todosLeads||[]).filter(leadEhAtivo);
  cp786AbrirConducao('agora');
}
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
window.cp786AbrirConducao=cp786AbrirConducao;
window.cp786AbrirPrioridadePrincipal=cp786AbrirPrioridadePrincipal;

renderResumoDia = function(items){
  const box = qs("#resumoDia");
  if(!box) return;
  if(!items?.length){ box.style.display="none"; box.innerHTML=""; return; }
  const ativos=items.filter(leadEhAtivo);
  const categorias=ativos.map(cp786Categoria);
  const fazerAgora=categorias.filter(c=>c==='agora').length;
  const compromissos=categorias.filter(c=>c==='programados').length;
  const aguardando=categorias.filter(c=>c==='aguardando').length;
  // Total de leads ativos (soma de todas as categorias). Substitui o card "Cliente respondeu"
  // a pedido do corretor: quando o cliente responde, ele já dá seguimento por fora.
  const totalLeads=ativos.length;
  box.style.display="grid";
  box.innerHTML = `
    <div class="ui-kpi active" onclick="cp786AbrirConducao('agora')"><span>Fazer agora</span><div><b>${fazerAgora}</b><i>${ui631Icon('resposta')}</i></div></div>
    <div class="ui-kpi" onclick="cp788AbrirCarteiraAtiva()"><span>Total de leads</span><div><b>${totalLeads}</b><i>${ui631Icon('ativos')}</i></div></div>
    <div class="ui-kpi" onclick="cp786AbrirConducao('programados')"><span>Agenda</span><div><b>${compromissos}</b><i>${ui631Icon('compromisso')}</i></div></div>
    <div class="ui-kpi" onclick="cp786AbrirConducao('aguardando')"><span>Aguardando cliente</span><div><b>${aguardando}</b><i>${ui631Icon('ativos')}</i></div></div>`;
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
        <div class="ui-section-head"><div><h3>Atendimentos prioritários para hoje</h3><p>O Corretor Pro colocou primeiro quem precisa de você agora.</p></div><button type="button" onclick="cp786AbrirConducao('${filtroPrincipal}')">Ver todos</button></div>
        <div class="ui-priority-list">${prioritarios.length?prioritarios.map((l,i)=>ui631LeadRow(l,cp786Badge(l),i)).join(''):'<div class="empty">Nenhuma ação imediata agora.</div>'}</div>
      </section>
    </div>`;
};

window.setPipelineVisualFiltro = function(f){ state.pipelineVisualFiltro=f||"todos"; state.pipelineVisibleCount=60; if(state.active === "pipeline") cpReplaceRoute(cpRouteForScreen("pipeline")); carregarPipeline(); };
window.carregarMaisPipelineVisual = function(){ state.pipelineVisibleCount = Math.max(60, Number(state.pipelineVisibleCount||60)) + 60; carregarPipeline(); };
function ui631EtapaFunil(l){
  const raw=String(l.analysis?.diagnostico?.etapa||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if(raw.includes("descob")) return "Descoberta";
  if(raw.includes("interesse")) return "Interesse";
  if(raw.includes("compar")) return "Comparação";
  if(raw.includes("finance")) return "Análise financeira";
  if(raw.includes("negoci")) return "Negociação";
  if(raw.includes("decis")) return "Decisão";
  const e=normalizarEtapa(l.etapa);
  if(e==="Novo") return "Descoberta";
  if(e==="Atendimento") return "Interesse";
  if(e==="Visita/Proposta") return "Comparação";
  if(e==="Negociação") return "Negociação";
  return "Análise financeira";
}
carregarPipeline = async function(){
  if(state.active!=="pipeline") return;
  const board=qs("#pipelineBoard"); if(!board) return;

  // Usa dados em memória se disponíveis — evita fetch a cada troca de filtro
  const emMemoria = [state.todosLeads, state.itemsAtivos].find(a=>Array.isArray(a)&&a.length);
  const renderPipeline = (data) => {
    const _perfStart = cpPerfNow();
    const all=(data?.items||[]).map(limparLead).filter(leadEhAtivo);
    const hot=leadEhQuente;
    const compromisso=l=>{const a=l.analysis?.confirmedAppointments;return (Array.isArray(a)&&a.length)||!!l.analysis?.lembrete?.quando};
    const reaquecer=leadEhReaquecer;
    const filtros={todos:all,quentes:all.filter(hot),esfriando:all.filter(l=>(Number(l.daysSinceLastInteraction)||0)>=7&&hot(l)),compromisso:all.filter(compromisso),reaquecer:all.filter(reaquecer)};
    const filtro=state.pipelineVisualFiltro||"todos";
    const lista=(filtros[filtro]||all).slice().sort(compararPrioridadeAtendimento);
    const listaPrioritaria=lista.filter(l=>ui670ModeloComercial(l)?.acao?.status!=="sem-acao-urgente");
    const limiteLista = Math.max(60, Number(state.pipelineVisibleCount || 60));
    const listaVisivel = listaPrioritaria.slice(0, limiteLista);
    const faltamLista = Math.max(0, listaPrioritaria.length - listaVisivel.length);
    const btnMaisLista = faltamLista > 0 ? `<button type="button" class="btn secondary" style="width:100%;margin-top:10px" onclick="carregarMaisPipelineVisual()">Mostrar mais ${Math.min(60, faltamLista)} leads <span>(${listaVisivel.length} de ${listaPrioritaria.length})</span></button>` : "";
    const etapas=["Novo","Atendimento","Visita/Proposta","Negociação","Standby"];
    const cnt=Object.fromEntries(etapas.map(e=>[e,0]));
    all.forEach(l=>{const e=normalizarEtapa(l.etapa);if(cnt[e]!==undefined)cnt[e]++;});
    const tabs=[["todos","Todos"],["quentes","Agora"],["esfriando","Parando"],["compromisso","Agenda"],["reaquecer","Reativar"]];
    const acaoRow=l=>compromisso(l)?'Agenda':hot(l)?'Agora':'Retomar';
    board.innerHTML=`
      <div class="ui-pipeline-kpis">
        <div class="ui-kpi"><span>Ativos</span><div><b>${all.length}</b><i>${ui631Icon('ativos')}</i></div></div>
        <div class="ui-kpi active"><span>Agora</span><div><b>${filtros.quentes.length}</b><i>${ui631Icon('quente')}</i></div></div>
        <div class="ui-kpi"><span>Agenda</span><div><b>${filtros.compromisso.length}</b><i>${ui631Icon('compromisso')}</i></div></div>
        <div class="ui-kpi"><span>Reativar</span><div><b>${filtros.reaquecer.length}</b><i>${ui631Icon('reaquecer')}</i></div></div>
      </div>
      <div class="ui-filter-tabs">${tabs.map(([k,t])=>`<button type="button" class="${k===filtro?'active':''}" onclick="setPipelineVisualFiltro('${k}')">${t}</button>`).join('')}</div>
      <div class="ui-pipeline-grid">
        <section class="ui-funnel-card"><h3>Funil por etapa</h3>${etapas.map(e=>{const n=cnt[e]||0,p=all.length?Math.round(n/all.length*100):0;return `<div class="ui-funnel-row"><div><span>${e}</span><b>${n}</b><em>${p}%</em></div><i><u style="width:${Math.max(3,p)}%"></u></i></div>`}).join('')}</section>
        <aside class="ui-pipe-summary"><div><span>Base filtrada</span><b>${lista.length}</b><small>lead${lista.length===1?'':'s'}</small></div><button type="button" onclick="reanalisarTudo()">↻ Reanalisar todos</button><button type="button" onclick="show('carteira')">Ver carteira completa</button></aside>
      </div>
      <section class="ui-priority-card ui-pipeline-list"><div class="ui-section-head"><div><h3>Leads prioritários</h3><p>Ordenados por prioridade de atendimento.</p></div></div><div class="ui-priority-list">${listaPrioritaria.length?listaVisivel.map(l=>ui631LeadRow(l,acaoRow(l))).join('')+btnMaisLista:'<div class="empty">Nenhum lead com ação pendente nesse filtro.</div>'}</div></section>`;
    cpPerfMark("renderPipeline", _perfStart, { total:listaPrioritaria.length, visiveis:listaVisivel.length });
  };

  if(emMemoria){
    renderPipeline({ items: emMemoria });
  } else {
    board.innerHTML='<div class="small ui-loading">Carregando...</div>';
    getLeadsData().then(renderPipeline).catch(()=>{ board.innerHTML=boxErro("carregarPipeline()"); });
  }
};

function ui631UltimoFalante(lead){
  const msgs=Array.isArray(lead.recentMessages)?lead.recentMessages:[];
  const pn=String(lead.name||"").toLowerCase().split(/\s+/)[0]||"";
  for(let i=msgs.length-1;i>=0;i--){if(!msgs[i]||!String(msgs[i].text||"").trim())continue;return ehMsgDoCliente(msgs[i],pn)?"cliente":"você";}
  return "—";
}
window.ui631SelectResponse=function(k){
  const map=state._ui631Responses||{}; state._ui631ResponseKey=k;
  const el=qs("#ui631ResponseText"); if(el) el.textContent=map[k]||"";
  qsa(".ui-response-tab").forEach(b=>b.classList.toggle("active",b.dataset.response===k));
  const legacy=qs("#msgFocoText"); if(legacy) legacy.textContent=map[k]||"";
};
window.ui631CopyResponse=async function(){const t=qs("#ui631ResponseText")?.textContent||"";if(!t){toast("Nenhuma mensagem disponível.");return;}try{await navigator.clipboard.writeText(t);toast("Mensagem copiada.")}catch(_){toast("Não consegui copiar.")}};
window.ui631OpenWhats=function(){const t=qs("#ui631ResponseText")?.textContent||"";const p=state._ui631LeadPhone||"";if(!p){toast("Este lead está sem telefone.");return;}window.open(whatsappLink(p,t),"_blank","noopener")};

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

function ui667AplicarAtendidoLocal(lead, quando, dataBR, horaBR){
  if(!lead) return;
  lead.analysis=lead.analysis||{};
  lead.analysis.aprendizado=lead.analysis.aprendizado||{};
  const eventos=Array.isArray(lead.analysis.aprendizado.eventos)?lead.analysis.aprendizado.eventos:[];
  if(!eventos.some(e=>e?.evento==="contato_manual"&&e?.detalhes?.de==="botao_atendido"&&e?.quando===quando)){
    eventos.push({evento:"contato_manual",estilo:null,detalhes:{tipo:"Atendido",de:"botao_atendido"},quando});
  }
  lead.analysis.aprendizado.eventos=eventos;
  lead.lastAttendanceAt=quando;
  lead.ultimoAtendimentoEm=quando;
  lead.lastAttendanceText=`${dataBR} ${horaBR}`;
}

window.ui667MarcarAtendido=async function(btn){
  const lead=state.lead;
  if(!lead?.id){toast("Não consegui identificar este lead.");return;}
  const original=btn?.textContent||"✓ Atendido";
  if(btn){btn.disabled=true;btn.textContent="Marcando...";}
  try{
    const res=await fetchComTimeout("./api/reanalisar-lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payloadComCerebro({id:lead.id,action:"marcar-atendido"}))});
    const d=await res.json().catch(()=>({}));
    if(!res.ok||!d?.ok) throw new Error(d?.error||"falha ao registrar");
    const quando=d.quando||new Date().toISOString();
    const agoraFmt=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,hourCycle:"h23"}).formatToParts(new Date(quando)).reduce((o,p)=>(p.type!=="literal"&&(o[p.type]=p.value),o),{});
    const dataLocal=d.dataBR||`${agoraFmt.day}/${agoraFmt.month}/${agoraFmt.year}`;
    const horaLocal=d.horaBR||`${agoraFmt.hour}:${agoraFmt.minute}`;
    ui667AplicarAtendidoLocal(lead,quando,dataLocal,horaLocal);
    for(const lista of [state.itemsAtivos,state.todosLeads,state.leads]){
      const item=Array.isArray(lista)?lista.find(x=>String(x.id)===String(lead.id)):null;
      if(item&&item!==lead) ui667AplicarAtendidoLocal(item,quando,dataLocal,horaLocal);
    }
    if(btn){btn.classList.add("is-done");btn.textContent=`✓ Atendido ${horaLocal}`;btn.disabled=true;}
    state.analysis=lead.analysis||null;
    renderLeadFoco(lead);
    invalidarLeadsCache();
    carregarAgendaTopo?.();
    loadRecentLeads(false);
    recarregarLeadFoco(lead.id);
    toast(d.atualizado?`Atendimento atualizado às ${horaLocal}.`:`Atendimento marcado às ${horaLocal}.`);
  }catch(err){
    if(btn){btn.disabled=false;btn.textContent=original;}
    toast("Não consegui marcar: "+(err?.message||err));
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
// Saudação correta desde o primeiro frame (antes dos dados carregarem)
(function(){ const h=new Date().getHours(); const el=document.getElementById("homePageTitle"); if(el) el.textContent=(h<12?"Bom dia":h<18?"Boa tarde":"Boa noite")+", corretor!"; })();
async function iniciarDireciona(){
  // Share Target vem antes da Home. Enquanto existe um ZIP pendente, nenhuma rotina
  // inicial pode trocar a tela nem disparar recarga automática.
  const compartilhado = await checkShared().catch(() => ({ handled:false }));
  if(compartilhado?.handled || window.__cpShareImportActive || state?.pendingSharedRecordId) return;
  renderLeads();
  // Se o app RECARREGOU enquanto o corretor estava vendo um lead (atualização de versão,
  // troca de service worker ou o Android reabrindo o PWA depois de ir pro WhatsApp), o
  // history.state sobrevive ao reload e ainda guarda a rota do lead. Sem isto, todo reload
  // caía na Home e o corretor era jogado pra tela inicial de novo e de novo.
  const rotaSalva = history.state;
  const leadSalvoId = (rotaSalva && rotaSalva.cpApp && rotaSalva.screen === "lead" && rotaSalva.leadId)
    ? String(rotaSalva.leadId) : "";
  if(leadSalvoId){
    if(rotaSalva.carteiraFiltro) state.carteiraFiltro = rotaSalva.carteiraFiltro;
    if(rotaSalva.pipelineFiltro) state.pipelineVisualFiltro = rotaSalva.pipelineFiltro;
    if(rotaSalva.grupoAtivo) state.grupoAtivo = rotaSalva.grupoAtivo;
    // Reabre o lead direto. abrirLead busca o detalhe pela API e volta pra Home sozinho
    // se o lead não existir mais, então é seguro chamar já no boot.
    abrirLead(leadSalvoId, { fromHistory:true }).catch(err => console.warn("restaurar lead no boot", err));
  }
  // Dashboard/agenda não dependem da restauração de leads antigos nem da lista rápida
  // abaixo — rodam em paralelo, cada um com seu próprio fallback, em vez de ficarem
  // atrás de um await sequencial que trava a tela inteira se uma etapa pendurar.
  // Rodam mesmo quando restauramos um lead: assim, ao tocar em "Voltar", a Home já está pronta.
  if(state.active === "home" || leadSalvoId){
    carregarDashboard();
    carregarAgendaTopo();
  }
  garantirRestauracaoLeadsAntigos().catch(()=>{});
  try{
    const data = await getLeadsData(false);
    if(data?.ok && Array.isArray(data.items)){
      state.todosLeads = data.items;
      state.leads = data.items.slice(0,8);
      renderLeads();
    }
  }catch(err){ console.warn("iniciarDireciona", err); }
}
requestAnimationFrame(iniciarDireciona);

// Auto-refresh leve do dashboard a cada 3 min se o usuário está na home e a aba está visível
setInterval(() => {
  // v818: não atualizar a Home enquanto um lead está aberto. O detalhe do lead é
  // renderizado DENTRO da Home (#leadFocoArea), então state.active continua "home".
  // Sem esta trava, o refresh reescrevia a área e jogava o corretor de volta pra lista.
  if(state.active === "home" && document.visibilityState === "visible" && !state.focoLeadId && !state.lead?.id){
    loadRecentLeads(false);
    carregarDashboard();
    carregarAgendaTopo();
  }
}, 3 * 60 * 1000);
// Refresh quando a aba volta a ficar visível (depois de mudar pra outra aba)
let __lastVisibleRefresh = 0;
document.addEventListener("visibilitychange", () => {
  // v818: mesma trava do interval — não refazer a Home com um lead aberto.
  if(document.visibilityState === "visible" && state.active === "home" && !state.focoLeadId && !state.lead?.id){
    const agora = Date.now();
    if(agora - __lastVisibleRefresh < 45000) return;
    __lastVisibleRefresh = agora;
    setTimeout(() => {
      loadRecentLeads(false);
      carregarDashboard();
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
function cpStage(lead){ return normalizarEtapa(lead?.etapa) || "Atendimento"; }
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
  return {time,text:text||cpStage(lead),sortTs:escolhido?.ts||lembreteTs||Number.MAX_SAFE_INTEGER};
}
function cpDaysText(lead){ const d=Number(lead?.daysSinceLastInteraction); if(Number.isFinite(d)) return d<=0?"Hoje":d===1?"Há 1 dia":`Há ${d} dias`; return "—"; }
function cpNextAction(lead){
  const acao=typeof cp786ResumoAcao==='function'?cp786ResumoAcao(lead):'';
  return String(acao||'Abrir atendimento para conferir.').replace(/\s+/g,' ').slice(0,62);
}
function cpSaleValue(all){
  const now=new Date(); let total=0;
  for(const l of all||[]){
    if(cpStage(l)!=="Vendido") continue;
    const iso=l?.analysis?.venda?.registradaEm; const dt=iso?new Date(iso):null;
    if(!dt || (dt.getMonth()===now.getMonth()&&dt.getFullYear()===now.getFullYear())) total += parseValorVenda(l?.analysis?.venda?.valor);
  }
  return total;
}
function cpSetText(id,val){ const el=qs("#"+id); if(el) el.textContent=val; }
function cpPct(n,total){ return total>0?Math.round((n/total)*100):0; }
function cpOpenLead(id){ if(id) abrirLead(String(id)); }
function cpAvatarStyle(name){
  let h=0; for(const c of String(name||"")) h=(h*31+c.charCodeAt(0))>>>0;
  const palette=["#315766","#3B5F6A","#4B586E","#586655"];
  return `background:${palette[h%palette.length]};`;
}
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
  const fazerAgora=items.filter(l=>categoriaDe(l)==='agora').length;
  const compromissos=items.filter(l=>categoriaDe(l)==='programados').length;
  const aguardandoN=items.filter(l=>categoriaDe(l)==='aguardando').length;
  cpSetText("cpNewLeads",items.length);
  cpSetText("cpActiveDeals",fazerAgora);
  cpSetText("cpVisits",compromissos);
  cpSetText("cpProposals",aguardandoN);
  cpSetText("cpRevenue",formatBRL(cpSaleValue(all)));
  const sub=qs("#cpNewLeadsSub"); if(sub) sub.textContent=items.length?"ativos agora":"base sem leads ativos";

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

  const counts={agora:0,respondeu:0,programados:0,aguardando:0};
  for(const l of items){ const c=categoriaDe(l); if(counts[c]!==undefined) counts[c]++; }
  const totalConduzido=counts.agora+counts.respondeu+counts.programados+counts.aguardando;
  const total=Math.max(1,totalConduzido);
  const hp=cpPct(counts.agora,total), rp=cpPct(counts.respondeu,total), pp=cpPct(counts.programados,total);
  const donut=qs("#cpTempDonut");
  if(donut) donut.style.background=`conic-gradient(var(--cp-coral) 0 ${hp}%,var(--cp-orange) ${hp}% ${hp+rp}%,var(--cp-blue) ${hp+rp}% ${Math.min(100,hp+rp+pp)}%,var(--cp-slate) ${Math.min(100,hp+rp+pp)}% 100%)`;
  cpSetText("cpTotalAtendimentos",totalConduzido);
  const legend=qs("#cpTempLegend");
  if(legend) legend.innerHTML=[
    ["Fazer agora",counts.agora,cpPct(counts.agora,total),"var(--cp-coral)"],
    ["Agenda",counts.programados,cpPct(counts.programados,total),"var(--cp-blue)"],
    ["Aguardando cliente",counts.aguardando,cpPct(counts.aguardando,total),"var(--cp-slate)"]
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

  const atendidosHoje=items.filter(ehContatadoHoje).length;
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
  const etapaLegacy=String(a?.diagnostico?.etapa||normalizarEtapa(lead?.etapa)||"descoberta").toLowerCase().replace(/\s+/g,"-");
  mc.versao=Number(mc.versao||a._schemaComercial||0);
  mc.contato=mc.contato||{};
  mc.contato.tipo=mc.contato.tipo||(parceiro?"corretor-parceiro":"comprador-direto");
  mc.contato.papel=mc.contato.papel||(parceiro?"Intermedeia compradores e pode gerar novas oportunidades":"Contato principal da oportunidade");
  mc.oportunidade=mc.oportunidade||{};
  mc.oportunidade.status=mc.oportunidade.status||(["Novo","Atendimento"].includes(normalizarEtapa(lead?.etapa))?"descoberta":etapaLegacy);
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
window.ui670SelectMessage=function(k){
  const map=state._ui670Messages||{};state._ui670MessageKey=k;
  const el=qs("#ui670MessageText");if(el)el.textContent=map[k]||"";
  qsa(".ui670-msg-option").forEach(b=>b.classList.toggle("active",b.dataset.key===k));
};
window.ui670CopyMessage=async function(){
  const t=String(qs("#ui670MessageText")?.innerText||"").trim();
  if(!t){toast("Nenhuma mensagem necessária agora.");return;}
  try{await navigator.clipboard.writeText(t);toast("Mensagem copiada.");}catch(_){toast("Não consegui copiar.");}
};
window.ui670OpenWhats=function(){
  const t=String(qs("#ui670MessageText")?.innerText||"").trim();
  const p=String(state._ui670LeadPhone||"");
  if(!p){toast("Este contato está sem telefone.");return;}
  window.open(whatsappLink(p,t),"_blank","noopener");
};
window.ui670OpenWhatsLivre=function(){
  const p=String(state._ui670LeadPhone||"");if(!p){toast("Este contato está sem telefone.");return;}
  window.open(whatsappLink(p,""),"_blank","noopener");
};
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
  out._schemaComercial=715;
  return out;
}
async function ui675BuscarDetalhe(id){
  const r=await fetch(`./api/lead-update?action=detalhe&id=${encodeURIComponent(id)}&_=${Date.now()}`,{cache:"no-store",headers:{"Cache-Control":"no-cache"}});
  const d=await r.json().catch(()=>({ok:false}));
  if(!r.ok||!d?.ok)return null;
  return d.item||null;
}
async function ui675PersistirFallback(id,analysis){
  const r=await fetch("./api/lead-update",{method:"POST",headers:{"Content-Type":"application/json","Cache-Control":"no-cache"},cache:"no-store",body:JSON.stringify({action:"analise-comercial-set",id,analysis})});
  const d=await r.json().catch(()=>({ok:false,error:"Resposta inválida ao salvar a análise."}));
  if(!r.ok||!d?.ok||!d?.analysis){
    const erro=String(d?.error||"Não foi possível salvar a análise comercial corrigida.");
    if(/action inválida/i.test(erro)){
      throw new Error("Backend desatualizado: o arquivo api/lead-update.js não foi substituído na pasta /api.");
    }
    throw new Error(erro);
  }
  return d.analysis;
}

// Observação de atendimento (texto ou áudio gravado na hora): soma na linha do tempo do
// lead (sem apagar nada) e reanalisa, pra virar contexto real pras próximas sugestões.
let _cp7ObsRecorder = null, _cp7ObsChunks = [], _cp7ObsStream = null;
function cp7ObsPararGravacaoSeAtiva(){
  try{ if(_cp7ObsRecorder && _cp7ObsRecorder.state === "recording") _cp7ObsRecorder.stop(); }catch(_){}
  try{ _cp7ObsStream?.getTracks()?.forEach(t => t.stop()); }catch(_){}
  _cp7ObsStream = null;
}
window.cp7ObsToggleGravacao = async function(btn){
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
};
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
  if(status) status.innerHTML = '<span style="color:var(--morno)">Salvando observação…</span>';
  try{
    const res = await fetchComTimeout("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id:lead.id, action:"observacao-adicionar", texto })
    }, 30000);
    const data = await res.json().catch(()=>({ok:false}));
    if(!res.ok || !data?.ok) throw new Error(data?.error || "Não foi possível salvar a observação.");

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
    if(ta) ta.value="";
    renderLeadFoco(lead);
    if(status) status.innerHTML = '<span style="color:var(--acao)">Observação salva. Aprendizado em segundo plano; sugestões atuais mantidas.</span>';
    toast("Observação salva. O sistema vai aprender com ela em segundo plano.");
    invalidarLeadsCache();
    setTimeout(()=>window.iniciarAprendizadoContinuoAutomatico?.({somentePendentes:true}),500);
  }catch(err){
    if(status) status.innerHTML = '<span style="color:var(--risco)">'+escapeHtml(String(err?.message||err))+'</span>';
    if(btn){ btn.disabled=false; btn.textContent=original; }
  }
};

window.ui670Reanalisar=async function(btn){
  const lead=state.lead;
  if(!lead?.id){toast("Não consegui identificar este lead.");return;}
  const original=btn?.textContent||"Atualizar análise comercial";
  if(btn){btn.disabled=true;btn.textContent="Atualizando análise...";}
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
        if(aDetalhe&&sDetalhe>=682){analysis=aDetalhe;schema=sDetalhe;break;}
        if(aDetalhe&&!analysis)analysis=aDetalhe;
      }
    }

    // v756: sem fallback local. Se a API não devolver análise atual, não inventar mensagem.
    if(!analysis||schema<682)throw new Error("A análise não foi gerada pela IA atual. Tente reanalisar novamente.");
    clearInterval(progressoTimer);
    progresso.done("Análise concluída e salva.");

    const atualizado=limparLead({...leadBaseAtualizado,analysis,summary:analysis.summary||leadBaseAtualizado.summary||lead.summary,nextAction:analysis.nextAction||leadBaseAtualizado.nextAction||lead.nextAction});
    state.lead=atualizado;state.analysis=atualizado.analysis||null;
    for(const lista of [state.itemsAtivos,state.todosLeads,state.leads]){
      if(!Array.isArray(lista))continue;
      const i=lista.findIndex(x=>String(x.id)===String(lead.id));
      if(i>=0)lista[i]=limparLead({...lista[i],analysis,summary:analysis.summary||lista[i].summary,nextAction:analysis.nextAction||lista[i].nextAction});
    }
    invalidarLeadsCache();
    _leadDetailCache.set(String(lead.id),{ts:Date.now(),data:atualizado,inflight:null});
    renderLeadFoco(atualizado);renderLeads();
    const mc=analysis.modeloComercial||{};
    const semAcao=mc?.acao?.status==="sem-acao-urgente";
    const aviso=data?.warning||"";
    toast(usouFallback?"✓ Análise corrigida e salva.":(aviso?"✓ Análise comercial atualizada com reconciliação factual.":(semAcao?"✓ Análise atualizada: nenhuma ação urgente.":"✓ Análise comercial atualizada.")));
    setTimeout(()=>qs("#leadFocoArea")?.scrollIntoView({behavior:"smooth",block:"start"}),80);

    setTimeout(async()=>{
      try{
        const base=await getLeadsData(true);
        if(base?.ok&&Array.isArray(base.items)){
          const itens=base.items.map(limparLead);state.todosLeads=itens;state.leads=itens.slice(0,8);
          state.itemsAtivos=itens.filter(l=>!["Vendido","Perdido","Geladeira"].includes(normalizarEtapa(l.etapa)));
          const fresco=itens.find(x=>String(x.id)===String(lead.id));
          const freshSchema=Number(fresco?.analysis?._schemaComercial||fresco?.analysis?.modeloComercial?.versao||0);
          if(fresco&&freshSchema>=682){state.lead={...atualizado,...fresco,historyLoaded:atualizado.historyLoaded,recentMessages:atualizado.recentMessages};}
          renderLeads();
        }
      }catch(_){}
    },600);
  }catch(err){
    clearTimeout(timeout);
    clearInterval(progressoTimer);
    try{ progresso.fail("Não foi possível concluir a análise."); }catch(_){}
    const msg=err?.name==="AbortError"?"A atualização demorou demais. Tente novamente.":(err?.message||String(err));
    toast("Não foi possível atualizar: "+msg);
    if(btn){btn.disabled=false;btn.textContent=original;}
  }
};
window.ui670Toggle=function(id){const el=qs("#"+id);if(!el)return;el.hidden=!el.hidden;if(!el.hidden){if(el.tagName==="DETAILS")el.open=true;setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"nearest"}),40);}};
window.ui671FecharNovaOportunidade=function(){qs("#ui671NovaOppModal")?.remove();};
window.ui670NovaOportunidade=function(){
  const lead=state.lead;if(!lead?.id){toast("Abra o contato parceiro antes de registrar a oportunidade.");return;}
  qs("#ui671NovaOppModal")?.remove();
  const opts=(typeof EMPREENDIMENTOS_SENGER!=="undefined"?EMPREENDIMENTOS_SENGER:[]).map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  const el=document.createElement("div");el.id="ui671NovaOppModal";el.className="ui671-modal";
  el.innerHTML=`<div class="ui671-modal-card"><div class="ui671-modal-head"><div><small>Corretor parceiro</small><h3>Nova oportunidade</h3><p>${escapeHtml(lead.name||"Contato")}</p></div><button type="button" onclick="ui671FecharNovaOportunidade()">✕</button></div>
  <label>Comprador final *</label><input id="ui671OppComprador" type="text" placeholder="Nome ou identificação do novo cliente" autocomplete="off">
  <label>Empreendimento ou produto *</label><select id="ui671OppProduto"><option value="">Selecione</option>${opts}<option value="Outro">Outro</option></select>
  <div id="ui671OppOutroWrap" hidden><label>Qual produto?</label><input id="ui671OppOutro" type="text" placeholder="Informe o empreendimento ou produto"></div>
  <label>Contexto inicial</label><textarea id="ui671OppObs" rows="4" placeholder="O que o parceiro já informou sobre perfil, valor, prazo ou necessidade"></textarea>
  <div class="ui671-modal-info">Será criada uma oportunidade independente, vinculada a este parceiro. A negociação anterior continuará preservada.</div>
  <div class="ui671-modal-actions"><button class="secondary" type="button" onclick="ui671FecharNovaOportunidade()">Cancelar</button><button id="ui671OppSalvar" type="button" onclick="ui671SalvarNovaOportunidade()">Criar oportunidade</button></div></div>`;
  document.body.appendChild(el);
  el.addEventListener("click",e=>{if(e.target===el)ui671FecharNovaOportunidade();});
  qs("#ui671OppProduto")?.addEventListener("change",e=>{const w=qs("#ui671OppOutroWrap");if(w)w.hidden=e.target.value!=="Outro";});
  setTimeout(()=>qs("#ui671OppComprador")?.focus(),80);
};
window.ui671SalvarNovaOportunidade=async function(){
  const lead=state.lead,comprador=String(qs("#ui671OppComprador")?.value||"").trim();
  const sel=String(qs("#ui671OppProduto")?.value||"").trim();
  const produto=sel==="Outro"?String(qs("#ui671OppOutro")?.value||"").trim():sel;
  const observacao=String(qs("#ui671OppObs")?.value||"").trim();
  if(!comprador){toast("Informe o novo comprador.");qs("#ui671OppComprador")?.focus();return;}
  if(!produto){toast("Informe o empreendimento ou produto.");(sel==="Outro"?qs("#ui671OppOutro"):qs("#ui671OppProduto"))?.focus();return;}
  const btn=qs("#ui671OppSalvar");if(btn){btn.disabled=true;btn.textContent="Criando...";}
  try{
    const r=await fetch("./api/lead-update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"nova-oportunidade-parceiro",id:lead.id,compradorFinal:comprador,produto,observacao})});
    const d=await r.json().catch(()=>({ok:false,error:"Resposta inválida do servidor."}));
    if(!r.ok||!d.ok)throw new Error(d.error||"Não foi possível criar a oportunidade.");
    ui671FecharNovaOportunidade();invalidarLeadsCache();if(typeof loadRecentLeads==="function")await loadRecentLeads(true);toast("Nova oportunidade criada e vinculada ao parceiro.");
    await abrirLead(String(d.id));
  }catch(err){toast("Erro: "+(err?.message||err));if(btn){btn.disabled=false;btn.textContent="Criar oportunidade";}}
};

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
   ATUALIZAÇÃO #683 — FLUXO DIÁRIO DO CORRETOR
   - Atendidos hoje visível e clicável
   - Último atendimento no detalhe do lead
   - Botões rápidos: copiar, atendido, agendar, observação, proposta feita,
     vendido, perdido e arquivar
   - Atendido é ação registrada, não troca a etapa comercial do lead
   ============================================================ */
(function(){
  if(window.__cp683FluxoDiario) return;
  window.__cp683FluxoDiario = true;

  function ui683InjectStyles(){
    if(document.getElementById('ui683Styles')) return;
    const st=document.createElement('style'); st.id='ui683Styles';
    st.textContent=`
      .ui683-card{margin:16px 0;padding:18px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(135deg,rgba(55,232,255,.05),rgba(255,98,88,.035));box-shadow:0 12px 36px rgba(0,0,0,.12)}
      .ui683-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}.ui683-head h3{margin:0;font-size:17px}.ui683-head p{margin:4px 0 0;color:var(--muted);font-size:12px}.ui683-pill{border:1px solid rgba(255,98,88,.45);background:rgba(255,98,88,.12);color:var(--acao);border-radius:999px;padding:7px 12px;font-weight:950;font-size:12px;white-space:nowrap}.ui683-list{display:grid;gap:8px}.ui683-row{display:grid;grid-template-columns:72px 1fr auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025);cursor:pointer}.ui683-row:hover{background:rgba(255,255,255,.05)}.ui683-time{font-weight:950;color:var(--dados);font-size:13px}.ui683-name{font-weight:950;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ui683-sub{font-size:11px;color:var(--muted);margin-top:2px}.ui683-empty{padding:15px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);font-size:13px}.ui683-link{border:0;background:transparent;color:var(--acao);font-weight:950;cursor:pointer}
      .ui683-last{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0 0;padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025);color:var(--soft);font-size:12px}.ui683-last b{color:var(--text)}
      .ui683-actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 4px}.ui683-actions button{border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);border-radius:999px;padding:9px 13px;font-size:12px;font-weight:950;cursor:pointer}.ui683-actions button:hover{background:rgba(255,255,255,.07)}.ui683-actions .primary{border-color:rgba(255,98,88,.55);background:rgba(255,98,88,.13);color:var(--acao)}.ui683-actions .danger{border-color:rgba(255,98,88,.35);color:var(--acao)}.ui683-mini{color:var(--muted);font-size:11px;margin-top:2px}.cart-row.is-atendido-hoje{box-shadow:inset 3px 0 0 var(--acao)}.cart-row .cart-last-att{display:block;margin-top:3px;color:var(--dados);font-size:11px;font-weight:800}
      @media(max-width:760px){.ui683-row{grid-template-columns:58px 1fr}.ui683-row .ui683-open{display:none}.ui683-actions{position:relative}.ui683-actions button{flex:1 1 calc(50% - 8px)}}`;
    document.head.appendChild(st);
  }

  function ui683Eventos(lead){ return Array.isArray(lead?.analysis?.aprendizado?.eventos) ? lead.analysis.aprendizado.eventos : []; }
  function ui683ContatoManualEventos(lead){ return ui683Eventos(lead).filter(e=>e?.evento==='contato_manual' && e?.quando).sort((a,b)=>new Date(b.quando)-new Date(a.quando)); }
  function ui683UltimoAtendimento(lead){ return ui683ContatoManualEventos(lead)[0] || null; }
  function ui683DataHoraBR(iso){
    try{return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));}catch(_){return '—';}
  }
  function ui683HoraBR(iso){
    try{return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));}catch(_){return '—';}
  }
  function ui683Origem(ev){
    const de=ev?.detalhes?.de||ev?.detalhes?.tipo||'';
    return ({botao_atendido:'marcado no botão Marcar atendimento',novoAtendimento:'observação/atendimento registrado',listaPrioridade:'marcado pela lista',copiar_msg:'mensagem copiada',leadFoco:'detalhe do lead'})[de] || 'atendimento registrado';
  }
  function ui683AtendidosHoje(base){
    const hoje = typeof inicioDoDiaBR === 'function' ? inicioDoDiaBR() : (()=>{const d=new Date();d.setHours(0,0,0,0);return d;})();
    const lista=(Array.isArray(base)?base:[]).map(l=>({lead:l,ev:ui683UltimoAtendimento(l)})).filter(x=>x.ev?.quando && new Date(x.ev.quando)>=hoje);
    return lista.sort((a,b)=>new Date(b.ev.quando)-new Date(a.ev.quando));
  }

  window.abrirAtendidosHoje = function(){
    state.carteiraFiltro='atendidos-hoje';
    state.carteiraVisibleCount=CARTEIRA_PAGE_SIZE || 80;
    if(typeof show==='function') show('carteira');
    setTimeout(()=>{ try{ if(typeof carregarCarteira==='function') carregarCarteira(false); }catch(_){} }, 60);
  };

  function ui683RenderAtendidosHojeHome(){
    // v748: removido da tela principal/home por solicitação do usuário.
    const antigo = qs('#ui683AtendidosHojeCard');
    if(antigo) antigo.remove();
    return;
  }

  const __ui683ProcessarDashboard = window._processarDashboard || (typeof _processarDashboard==='function' ? _processarDashboard : null);
  if(__ui683ProcessarDashboard){
    _processarDashboard = async function(data){
      const out = await __ui683ProcessarDashboard(data);
      ui683RenderAtendidosHojeHome();
      return out;
    };
    window._processarDashboard = _processarDashboard;
  }

  const __ui683BuildDesempenho = typeof buildDesempenhoInsightsHTML==='function' ? buildDesempenhoInsightsHTML : null;
  if(__ui683BuildDesempenho){
    buildDesempenhoInsightsHTML = function(items){
      let html=__ui683BuildDesempenho(items);
      html=html.replace(/onclick="show\('home'\)" title="Ver atendidos hoje"/g, 'onclick="abrirAtendidosHoje()" title="Ver atendidos hoje"');
      return html;
    };
    window.buildDesempenhoInsightsHTML = buildDesempenhoInsightsHTML;
  }

  const __ui683CarteiraPassaFiltro = typeof carteiraPassaFiltro==='function' ? carteiraPassaFiltro : null;
  if(__ui683CarteiraPassaFiltro){
    carteiraPassaFiltro = function(l,f){ if(f==='atendidos-hoje') return !!ehContatadoHoje(l); return __ui683CarteiraPassaFiltro(l,f); };
    window.carteiraPassaFiltro = carteiraPassaFiltro;
  }

  const __ui683CarteiraRowHTML = typeof carteiraRowHTML==='function' ? carteiraRowHTML : null;
  if(__ui683CarteiraRowHTML){
    carteiraRowHTML = function(l){
      const ev=ui683UltimoAtendimento(l);
      let html=__ui683CarteiraRowHTML(l);
      if(ev?.quando){
        html=html.replace('class="cart-row"', 'class="cart-row is-atendido-hoje"');
        html=html.replace('<div class="cart-etapa">', `<span class="cart-last-att">✓ Atendido ${escapeHtml(ui683DataHoraBR(ev.quando))}</span><div class="cart-etapa">`);
      }
      return html;
    };
    window.carteiraRowHTML = carteiraRowHTML;
  }

  const __ui683RenderCarteiraTabela = typeof renderCarteiraTabela==='function' ? renderCarteiraTabela : null;
  if(__ui683RenderCarteiraTabela){
    renderCarteiraTabela = function(){
      const box = qs('#carteiraBody');
      if(!box) return;
      const base = (state.carteiraLeads||[]).filter(l => { const e = normalizarEtapa(l.etapa); return e !== 'Vendido' && e !== 'Perdido'; });
      const filtro = state.carteiraFiltro || 'todos';
      const lista = base.filter(l => carteiraPassaFiltro(l, filtro)).map(l => ({ ...l, _s: scoreRankingHoje(l) })).sort(filtro==='atendidos-hoje' ? ((a,b)=>{const ea=ui683UltimoAtendimento(a), eb=ui683UltimoAtendimento(b); return new Date(eb?.quando||0)-new Date(ea?.quando||0);}) : compararPrioridadeAtendimento);
      const filtros683 = [['todos','Todos'],['atendidos-hoje','✓ Atendidos hoje'],['geladeira','Arquivados']];
      const chips = filtros683.map(([k,lbl]) => `<button type="button" class="${k===filtro?'active':''}" onclick="setCarteiraFiltro('${k}')">${lbl}</button>`).join('');
      const visiveis = Math.max(CARTEIRA_PAGE_SIZE, Number(state.carteiraVisibleCount || CARTEIRA_PAGE_SIZE));
      const lote = lista.slice(0, visiveis);
      const faltam = Math.max(0, lista.length - lote.length);
      const linhas = lista.length ? lote.map(carteiraRowHTML).join('') : `<div class="empty" style="margin:14px">${filtro==='atendidos-hoje'?'Nenhum lead atendido hoje.':'Nenhum lead nesse filtro.'}</div>`;
      const carregarMais = faltam > 0 ? `<button type="button" class="cart-load-more" onclick="carregarMaisCarteira()">Carregar mais ${Math.min(CARTEIRA_PAGE_SIZE, faltam)} <span>(${lote.length} de ${lista.length})</span></button>` : '';
      box.innerHTML = `${ui677ToolbarHTML('atendimentos')}<div class="cart-head"><div><h2>Atendimentos</h2><div class="sub">${lista.length} lead${lista.length!==1?'s':''} neste filtro · ${filtro==='atendidos-hoje'?'ordenados pelo horário atendido':'ordenados por prioridade de contato'}</div></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div class="cart-filtros">${chips}</div><button type="button" class="cart-export" onclick="exportarLeadsCSV(this)" title="Baixar Excel (CSV) de TODOS os leads com o histórico inteiro">⬇ Excel</button><button type="button" class="cart-export" onclick="exportarBackupCompletoV681(this)" title="Backup completo em JSON, com dados brutos do banco e auditoria de integridade">🛡 Backup</button><button type="button" class="cart-export" onclick="auditarDadosV681(this)" title="Conferir possíveis duplicidades, leads sem histórico e inconsistências">✓ Auditar</button></div></div><div class="cart-table"><div class="cart-thead"><span>Cliente</span><span>Empreendimento</span><span>Prioridade</span><span>Resposta</span><span>Próxima ação</span><span></span></div>${linhas}${carregarMais}</div>`;
    };
    window.renderCarteiraTabela = renderCarteiraTabela;
  }

  window.ui683MarcarEtapaRapida = async function(id, etapa, label){
    if(!id) return toast('Lead não identificado.');
    if(!confirm(`Marcar este lead como ${label||etapa}?`)) return;
    try{
      const res=await fetch('./api/lead-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'etapa',etapa})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data?.ok) throw new Error(data?.error||'falha');
      invalidarLeadsCache();
      toast(`Lead marcado como ${label||etapa}.`);
      const atualizado=await getLeadDetail(id).catch(()=>null);
      if(atualizado){ state.lead=atualizado; renderLeadFoco(atualizado); }
      if(typeof carregarDashboard==='function') carregarDashboard();
    }catch(err){ toast('Não consegui atualizar: '+(err?.message||err)); }
  };
// Atualização #724-2: wrapper antigo de renderLeadFoco removido.

  function ui683EnhanceLead(lead){
    ui683InjectStyles();
    const wrap=qs('#leadFocoArea .lead-foco'); if(!wrap) return;
    qs('#ui683LeadTools')?.remove();
    qs('#ui683LastAttendance')?.remove();
    const head=wrap.querySelector('.ui-lead-head') || wrap.querySelector('.ui670-hero') || wrap.firstElementChild;
    const ev=ui683UltimoAtendimento(lead);
    const last=document.createElement('div'); last.id='ui683LastAttendance'; last.className='ui683-last';
    last.innerHTML=ev?.quando ? `<b>Último atendimento:</b> ${escapeHtml(ui683DataHoraBR(ev.quando))} <span>· ${escapeHtml(ui683Origem(ev))}</span>` : `<b>Último atendimento:</b> ainda não registrado hoje`;
    const actions=document.createElement('div'); actions.id='ui683LeadTools'; actions.className='ui683-actions';
    const id=JSON.stringify(String(lead?.id||'')); const nome=safeJson(lead?.name||''); const prod=safeJson(lead?.product||'');
    actions.innerHTML=`
      <button type="button" class="primary" onclick="document.querySelector('#ui667AtendidoBtn')?.click()">✓ Marcar atendimento</button>
      <button type="button" onclick="ui631CopyResponse&&ui631CopyResponse()">Copiar resposta</button>
      <button type="button" onclick="document.querySelector('#ui631ResponseText,#msgFocoText')?.scrollIntoView({behavior:'smooth',block:'center'})">Ver mensagem</button>
      <button type="button" onclick="document.querySelector('#novoAtendimentoPanel, #ui670NoteSlot')?.scrollIntoView({behavior:'smooth',block:'center'})">Adicionar observação</button>
      <button type="button" onclick="abrirModalAgendar&&abrirModalAgendar(${id},${nome})">Agendar retorno</button>
      <button type="button" onclick="ui683MarcarEtapaRapida(${id},'Visita/Proposta','Proposta feita')">Proposta feita</button>
      <button type="button" onclick="abrirVenda(${id},${nome})">Vendido</button>
      <button type="button" onclick="arquivarLead(${id},${nome})">Arquivar</button>`;
    if(head?.parentElement){ head.parentElement.insertBefore(last, head.nextSibling); head.parentElement.insertBefore(actions, last.nextSibling); }
    else { wrap.prepend(actions); wrap.prepend(last); }
  }

  // Atualiza a versão exigida pela análise comercial a partir desta atualização.
  window.CORRETOR_PRO_VERSAO_FLUXO_DIARIO = 683;
})();

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

  function ui683DataISO(dias){
    const d = new Date();
    d.setDate(d.getDate() + Number(dias || 0));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  window.abrirModalAgendar = function(id, nome){
    if(!id) return toast('Lead não identificado.');
    document.getElementById('ui683AgendaModal')?.remove();
    const hoje = ui683DataISO(0);
    const html = document.createElement('div');
    html.id = 'ui683AgendaModal';
    html.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px';
    html.innerHTML = `<div style="width:min(440px,100%);background:var(--bg);border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.45)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px">
        <div><h3 style="margin:0;color:var(--text)">Agendar retorno</h3><div class="small" style="margin-top:4px;color:var(--muted)">${escapeHtml(nome || 'Lead')}</div></div>
        <button type="button" onclick="document.getElementById('ui683AgendaModal')?.remove()" style="border:0;background:transparent;color:var(--muted);font-size:22px;cursor:pointer">×</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:14px 0">
        <button class="btn" type="button" onclick="ui683AgendarRetorno(${JSON.stringify(String(id))},0)">Hoje</button>
        <button class="btn" type="button" onclick="ui683AgendarRetorno(${JSON.stringify(String(id))},1)">Amanhã</button>
        <button class="btn" type="button" onclick="ui683AgendarRetorno(${JSON.stringify(String(id))},3)">+3 dias</button>
        <button class="btn" type="button" onclick="ui683AgendarRetorno(${JSON.stringify(String(id))},7)">+7 dias</button>
      </div>
      <label class="small" style="display:block;margin:10px 0 6px;color:var(--muted);font-weight:900">Escolher data</label>
      <input id="ui683AgendaData" type="date" min="${hoje}" value="${hoje}" style="width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text)">
      <button class="btn primary" type="button" onclick="ui683AgendarRetorno(${JSON.stringify(String(id))},null,document.getElementById('ui683AgendaData')?.value)" style="width:100%;margin-top:12px">Salvar retorno</button>
    </div>`;
    document.body.appendChild(html);
  };

  window.ui683AgendarRetorno = async function(id, dias, dataManual){
    const data = dataManual || ui683DataISO(dias);
    await reagendarLembrete(id, data);
    await ui683RegistrarEvento(id, 'retorno_agendado', { data, de:'botao_rapido' });
    document.getElementById('ui683AgendaModal')?.remove();
  };

  window.ui683AdicionarObservacaoRapida = function(){
    const alvo = document.querySelector('#novoAtendimentoTexto, #memoriaObservacoes, textarea');
    if(alvo){ alvo.scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(()=>alvo.focus(),260); }
    else toast('Campo de observação não encontrado neste lead.');
  };

  const antigoCopy = window.ui631CopyResponse;
  window.ui631CopyResponse = async function(){
    const txt = document.querySelector('#ui631ResponseText')?.textContent || document.querySelector('#msgFocoText')?.textContent || '';
    if(!txt.trim()) return toast('Nenhuma mensagem disponível.');
    try{
      await navigator.clipboard.writeText(txt);
      toast('Mensagem copiada.');
      const lead = state.lead;
      if(lead?.id){
        try{ await ui683RegistrarEvento(lead.id, 'mensagem_copiada', { de:'botao_rapido', preview: txt.slice(0,240) }); }catch(_){}
      }
    }catch(_){
      if(typeof antigoCopy === 'function') return antigoCopy();
      toast('Não consegui copiar.');
    }
  };

  async function ui683MoverEtapaComEvento(id, etapa, label, evento){
    if(!id) return toast('Lead não identificado.');
    // Dois destinos "de saída" (Geladeira e Perdido) explicados na hora, pra ninguém
    // confundir "guardar pra depois" com "encerrar sem venda".
    const confirmMsg = etapa === 'Geladeira'
      ? 'Arquivar este lead? Ele sai das prioridades, mas fica guardado para você reativar depois.'
      : etapa === 'Perdido'
        ? 'Marcar este lead como Perdido? Ele sai das listas ativas e da busca (dá pra reabrir depois).'
        : `Marcar este lead como ${label || etapa}?`;
    if(!confirm(confirmMsg)) return;
    try{
      const res = await fetch('./api/lead-update', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, action:'etapa', etapa }) });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'falha ao salvar');
      await ui683RegistrarEvento(id, evento || 'etapa_alterada', { etapa, label: label || etapa, de:'botao_rapido' });
      invalidarLeadsCache();
      toast(`${label || etapa} registrado.`);
      try{ await carregarDashboard(); }catch(_){}
      try{ if(state.active === 'pipeline') carregarPipeline(); }catch(_){}
      try{ await abrirLead(id); }catch(_){}
    }catch(err){ toast('Não consegui atualizar: ' + (err?.message || err)); }
  }

  window.ui683MarcarEtapaRapida = function(id, etapa, label){
    const evento = etapa === 'Visita/Proposta' ? 'proposta_feita' : 'etapa_alterada';
    return ui683MoverEtapaComEvento(id, etapa, label, evento);
  };

  const antigoAbrirVenda = window.abrirVenda;
  window.abrirVenda = function(id, nome){
    return ui683MoverEtapaComEvento(id, 'Vendido', 'Vendido', 'venda_registrada');
  };

  const antigoMarcarPerdido = window.marcarPerdido;
  window.marcarPerdido = function(id, nome){
    return ui683MoverEtapaComEvento(id, 'Perdido', 'Perdido', 'perda_registrada');
  };

  const antigoArquivarLead = window.arquivarLead;
  window.arquivarLead = function(id, nome){
    return ui683MoverEtapaComEvento(id, 'Geladeira', 'Arquivado', 'lead_arquivado');
  };

  function ui683CorrigirBotoesRapidos(){
    const tools = document.getElementById('ui683LeadTools');
    if(!tools || tools.dataset.fechar683 === '1') return;
    tools.dataset.fechar683 = '1';
    tools.innerHTML = tools.innerHTML
      .replace(/document\.querySelector\('#novoAtendimentoPanel, #ui670NoteSlot'\)\?\.scrollIntoView\(\{behavior:'smooth',block:'center'\}\)/g, 'ui683AdicionarObservacaoRapida()')
      .replace(/abrirModalAgendar&&abrirModalAgendar/g, 'abrirModalAgendar');
  }
// Atualização #724-2: wrapper antigo de renderLeadFoco removido.
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
      versao:684,
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
      <div class="ui684-head"><div><h3>IA Comercial 2.0</h3><p>Leitura proativa: perfil, estratégia e próxima ação para este lead.</p></div><span class="ui684-badge">v684-final</span></div>
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
  window.CORRETOR_PRO_VERSAO_IA_COMERCIAL = '684-final';
})();


// ===== v685-1 — Edição do lead + início do Aprendizado Contínuo =====
// Escopo fechado desta etapa:
// 1) Editar lead simples: nome, telefone e produto.
// 2) Registrar desfecho básico de venda/perda para iniciar o aprendizado contínuo.
(function(){
  function el(sel){ return document.querySelector(sel); }
  function esc(v){
    try { return escapeHtml(String(v ?? '')); }
    catch(_) { return String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  }
  function produtoLeadAtual(id){
    try{
      if(state.lead && String(state.lead.id) === String(id)) return String(state.lead.product || state.lead.analysis?.produtoInteresse || state.lead.analysis?.product || '');
    }catch(_){ }
    return '';
  }
  function opcoesProdutos(){
    const lista = Array.isArray(window.EMPREENDIMENTOS_SENGER) ? window.EMPREENDIMENTOS_SENGER : (typeof EMPREENDIMENTOS_SENGER !== 'undefined' ? EMPREENDIMENTOS_SENGER : []);
    return lista.map(p => `<option value="${esc(p)}"></option>`).join('');
  }

  window.abrirEditarLead = function(id, nome, telefone){
    if(!id) return;
    document.getElementById('editarLeadModal')?.remove();
    const overlay=document.createElement('div');
    overlay.id='editarLeadModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;pointer-events:auto';
    let nomeIni=String(nome||'');
    let telIni=String(telefone||'');
    try{ if(typeof parecePhone === 'function' && parecePhone(nomeIni)){ if(!telIni) telIni=nomeIni; nomeIni=''; } }catch(_){ }
    const produtoIni=produtoLeadAtual(id);
    overlay.innerHTML=`
      <div style="width:min(430px,100%);background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.45)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
          <div><div style="font-size:16px;font-weight:950;color:var(--text)">Editar lead</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Ajuste só os dados principais do atendimento.</div></div>
          <button type="button" id="editLeadFechar" style="border:0;background:transparent;color:var(--muted);font-size:22px;cursor:pointer">×</button>
        </div>
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Nome</label>
        <input type="text" id="editLeadNome" value="${esc(nomeIni)}" placeholder="Nome do cliente" autocomplete="off" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px">
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Telefone / WhatsApp</label>
        <input type="tel" id="editLeadTelefone" value="${esc(telIni)}" placeholder="(54) 99999-9999" autocomplete="off" inputmode="tel" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px">
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Produto / empreendimento</label>
        <input type="text" id="editLeadProduto" list="editLeadProdutoLista" data-orig="${esc(produtoIni)}" value="${esc(produtoIni)}" placeholder="Ex.: nome do empreendimento" autocomplete="off" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:16px">
        <datalist id="editLeadProdutoLista">${opcoesProdutos()}</datalist>
        <button type="button" id="editLeadSalvar" style="width:100%;padding:12px;background:linear-gradient(135deg,var(--lime),var(--acao));color:var(--on-accent);border:0;border-radius:12px;font-size:14px;font-weight:950;cursor:pointer">Salvar alterações</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e=>{ if(e.target===overlay) fecharEditarLead(); });
    el('#editLeadFechar')?.addEventListener('click', fecharEditarLead);
    el('#editLeadSalvar')?.addEventListener('click', ()=>salvarEditarLead(String(id)));
    setTimeout(()=>el('#editLeadNome')?.focus(),100);
  };

  window.salvarEditarLead = async function(id){
    const nome=(el('#editLeadNome')?.value||'').trim();
    const telefone=(el('#editLeadTelefone')?.value||'').trim();
    const produto=(el('#editLeadProduto')?.value||'').trim();
    if(!nome && !telefone && !produto){ toast('Informe nome, telefone ou produto.'); return; }
    const btn=el('#editLeadSalvar');
    if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
    try{
      const res=await fetch('./api/lead-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'editar-dados',nome,telefone,produto})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok || !data?.ok) throw new Error(data?.error||'falha ao salvar');
      try{ await fetch('./api/lead-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'aprendizado',evento:'dados_lead_editados',estilo:'operacional',detalhes:{nome,telefone,produto,de:'editar_lead_v685'}})}); }catch(_){ }
      fecharEditarLead();
      try{ if(typeof invalidarLeadsCache==='function') invalidarLeadsCache(); }catch(_){ }
      try{ patchLeadCache(id,{name:nome,phone:telefone,product:produto}); }catch(_){ }
      if(state.lead && String(state.lead.id)===String(id)){
        state.lead.name=nome || state.lead.name;
        state.lead.phone=telefone || state.lead.phone;
        state.lead.product=produto || state.lead.product;
        if(state.lead.analysis){
          if(nome) state.lead.analysis.clientName=nome;
          if(produto){ state.lead.analysis.produtoInteresse=produto; state.lead.analysis.product=produto; }
          state.lead.analysis.lead=state.lead.analysis.lead||{};
          if(nome) state.lead.analysis.lead.clientName=nome;
          if(telefone) state.lead.analysis.lead.phone=telefone;
          if(produto) state.lead.analysis.lead.product=produto;
        }
      }
      toast('Lead atualizado.');
      try{ await loadRecentLeads(); }catch(_){ }
      try{ await carregarDashboard(); }catch(_){ }
      try{ await abrirLead(id); }catch(_){ if(state.lead) renderLeadFoco(state.lead); }
    }catch(err){
      toast('Erro ao salvar: '+(err?.message||err));
      if(btn){ btn.disabled=false; btn.textContent='Salvar alterações'; }
    }
  };

  function abrirModalDesfecho(id, tipo){
    const lead=state.lead||{};
    const nome=lead.name||'Lead';
    const produto=produtoLeadAtual(id);
    const vendido=tipo==='vendido';
    document.getElementById('ui685DesfechoModal')?.remove();
    const overlay=document.createElement('div');
    overlay.id='ui685DesfechoModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;pointer-events:auto';
    overlay.innerHTML=`
      <div style="width:min(460px,100%);background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.45)">
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:14px">
          <div><div style="font-size:16px;font-weight:950;color:var(--text)">${vendido?'Registrar venda':'Registrar perda'}</div><div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(nome)}</div></div>
          <button type="button" onclick="document.getElementById('ui685DesfechoModal')?.remove()" style="border:0;background:transparent;color:var(--muted);font-size:22px;cursor:pointer">×</button>
        </div>
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Produto / empreendimento</label>
        <input id="ui685Produto" list="ui685Produtos" value="${esc(produto)}" placeholder="Produto relacionado" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px">
        <datalist id="ui685Produtos">${opcoesProdutos()}</datalist>
        ${vendido?`
          <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Valor vendido (opcional)</label>
          <input id="ui685Valor" inputmode="decimal" placeholder="Ex.: 650000" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px">
        `:`
          <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Motivo da perda</label>
          <select id="ui685Motivo" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px">
            <option value="não respondeu">Não respondeu</option>
            <option value="preço">Preço</option>
            <option value="financiamento/renda">Financiamento / renda</option>
            <option value="comprou concorrente">Comprou concorrente</option>
            <option value="produto não aderente">Produto não aderente</option>
            <option value="desistiu/adiou">Desistiu / adiou</option>
            <option value="outro">Outro</option>
          </select>
        `}
        <button type="button" id="ui685SalvarDesfecho" style="width:100%;padding:12px;background:${vendido?'linear-gradient(135deg,var(--lime),var(--acao))':'rgba(255,255,255,.05)'};color:${vendido?'var(--on-accent)':'var(--text)'};border:1px solid ${vendido?'transparent':'var(--line)'};border-radius:12px;font-size:14px;font-weight:950;cursor:pointer">${vendido?'Confirmar venda':'Confirmar perda'}</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
    el('#ui685SalvarDesfecho')?.addEventListener('click', ()=>salvarDesfecho(id,tipo));
  }

  async function salvarDesfecho(id,tipo){
    const vendido=tipo==='vendido';
    const etapa=vendido?'Vendido':'Perdido';
    const produto=(el('#ui685Produto')?.value||'').trim();
    const valor=(el('#ui685Valor')?.value||'').trim();
    const motivo=(el('#ui685Motivo')?.value||'').trim();
    const btn=el('#ui685SalvarDesfecho'); if(btn){btn.disabled=true;btn.textContent='Salvando...';}
    try{
      const r=await fetch('./api/lead-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'etapa',etapa})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok || !d?.ok) throw new Error(d?.error||'falha ao alterar etapa');
      await fetch('./api/lead-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'aprendizado',evento:vendido?'venda_registrada':'perda_registrada',estilo:'desfecho',detalhes:{produto,valorVendido:valor,motivoPerda:motivo,registradoEm:new Date().toISOString(),de:'v685-1'}})}).catch(()=>null);
      if(produto){
        await fetch('./api/lead-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'editar-dados',produto})}).catch(()=>null);
      }
      document.getElementById('ui685DesfechoModal')?.remove();
      try{ if(typeof invalidarLeadsCache==='function') invalidarLeadsCache(); }catch(_){ }
      toast(vendido?'Venda registrada.':'Perda registrada.');
      try{ await carregarDashboard(); }catch(_){ }
      try{ await abrirLead(id); }catch(_){ }
    }catch(err){ toast('Não consegui registrar: '+(err?.message||err)); if(btn){btn.disabled=false;btn.textContent=vendido?'Confirmar venda':'Confirmar perda';} }
  }

  window.abrirVenda = function(id){ abrirModalDesfecho(String(id),'vendido'); };
  window.marcarPerdido = function(id){ abrirModalDesfecho(String(id),'perdido'); };
  window.CORRETOR_PRO_VERSAO_APRENDIZADO = '685-1';
})();

// ===== v685-final — Aprendizado Contínuo completo =====
// Fecha o módulo 685: venda/perda com produto, valor/motivo, tempo, contatos e funil real.
(function(){
  function q(sel){ return document.querySelector(sel); }
  function esc(v){
    try { return escapeHtml(String(v ?? '')); }
    catch(_) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function moedaBR(v){
    const n = Number(v);
    if(!Number.isFinite(n) || n <= 0) return 'não informado';
    try{ return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }catch(_){ return 'R$ '+String(n); }
  }
  function diasTexto(n){
    const d = Number(n);
    if(!Number.isFinite(d) || d < 0) return 'não calculado';
    if(d === 0) return 'no mesmo dia';
    if(d === 1) return '1 dia';
    return `${d} dias`;
  }
  function produtoAtual(lead){
    return String(lead?.product || lead?.analysis?.produtoInteresse || lead?.analysis?.product || lead?.analysis?.lead?.product || '').trim();
  }
  function opcoesProdutos(){
    const lista = Array.isArray(window.EMPREENDIMENTOS_SENGER) ? window.EMPREENDIMENTOS_SENGER : (typeof EMPREENDIMENTOS_SENGER !== 'undefined' ? EMPREENDIMENTOS_SENGER : []);
    return lista.map(p => `<option value="${esc(p)}"></option>`).join('');
  }
  function desfechoAtual(lead){
    const a = lead?.analysis || {};
    if(a.venda) return { tipo:'vendido', ...a.venda };
    if(a.perda) return { tipo:'perdido', ...a.perda };
    const evs = Array.isArray(a?.aprendizado?.eventos) ? a.aprendizado.eventos : [];
    const ev = [...evs].reverse().find(e => /venda_registrada|perda_registrada/.test(String(e?.evento||'')));
    if(!ev) return null;
    const d = ev.detalhes || {};
    return ev.evento === 'venda_registrada'
      ? { tipo:'vendido', produto:d.produto, valor:d.valorVendido, vendidoEm:ev.quando, tempoAteFechamentoDias:d.tempoAteFechamentoDias, contatosAteVenda:d.contatosAteVenda, funilReal:d.funilReal }
      : { tipo:'perdido', produto:d.produto, motivo:d.motivoPerda, perdidoEm:ev.quando, tempoAtePerdaDias:d.tempoAteFechamentoDias || d.tempoAtePerdaDias, contatosAtePerda:d.contatosAtePerda, funilReal:d.funilReal };
  }
  function cardAprendizado(lead){
    const d = desfechoAtual(lead);
    if(!d) return '';
    const vendido = d.tipo === 'vendido';
    const titulo = vendido ? 'Venda registrada' : 'Perda registrada';
    const data = vendido ? (d.vendidoEm || d.funilReal?.dataDesfecho) : (d.perdidoEm || d.funilReal?.dataDesfecho);
    const tempo = vendido ? d.tempoAteFechamentoDias : (d.tempoAtePerdaDias ?? d.funilReal?.tempoAteFechamentoDias);
    const contatos = vendido ? d.contatosAteVenda : d.contatosAtePerda;
    return `<section class="card ui685-final-card" style="margin-top:14px;border-color:${vendido?'rgba(124,240,165,.28)':'rgba(255,107,122,.28)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div>
          <div style="font-size:18px;font-weight:950;color:var(--text)">${vendido?'✅':'⚠️'} Aprendizado contínuo</div>
          <div style="color:var(--muted);font-size:12px;margin-top:3px">Este desfecho alimenta o aprendizado comercial e as próximas recomendações da IA.</div>
        </div>
        <span style="font-size:12px;font-weight:950;border:1px solid ${vendido?'rgba(124,240,165,.35)':'rgba(255,107,122,.35)'};color:${vendido?'var(--acao)':'#ff8b8b'};border-radius:999px;padding:7px 10px">${titulo}</span>
      </div>
      <div class="grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        <div class="mini"><b>Produto</b><span>${esc(d.produto || d.funilReal?.produto || produtoAtual(lead) || 'não informado')}</span></div>
        ${vendido ? `<div class="mini"><b>Valor vendido</b><span>${esc(moedaBR(d.valor))}</span></div>` : `<div class="mini"><b>Motivo da perda</b><span>${esc(d.motivo || 'não informado')}</span></div>`}
        <div class="mini"><b>Tempo até ${vendido?'fechamento':'perda'}</b><span>${esc(diasTexto(tempo))}</span></div>
        <div class="mini"><b>Contatos até ${vendido?'venda':'perda'}</b><span>${esc(contatos ?? 'não calculado')}</span></div>
      </div>
      <div style="margin-top:10px;color:var(--muted);font-size:12px">Registrado em: ${esc(typeof formatarQuandoLead === 'function' ? formatarQuandoLead(data) : (data || 'agora'))}</div>
    </section>`;
  }
  function injectStyles(){
    if(document.getElementById('ui685FinalStyle')) return;
    const st=document.createElement('style'); st.id='ui685FinalStyle'; st.textContent=`
      .ui685-final-card .mini{border:1px solid var(--line);border-radius:13px;padding:10px;background:rgba(255,255,255,.025)}
      .ui685-final-card .mini b{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.09em;margin-bottom:5px}
      .ui685-final-card .mini span{display:block;color:var(--text);font-weight:850;font-size:13px;line-height:1.35}
      @media(max-width:620px){.ui685-final-card .grid{grid-template-columns:1fr!important}}
    `; document.head.appendChild(st);
  }
// Atualização #724-2: wrapper antigo de renderLeadFoco removido.
  function abrirModalDesfechoFinal(id, tipo){
    const lead = (state && state.lead) || {};
    const vendido = tipo === 'vendido';
    document.getElementById('ui685DesfechoModal')?.remove();
    const overlay=document.createElement('div');
    overlay.id='ui685DesfechoModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;pointer-events:auto';
    overlay.innerHTML=`
      <div style="width:min(460px,100%);background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.45)">
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:14px">
          <div><div style="font-size:16px;font-weight:950;color:var(--text)">${vendido?'Registrar venda':'Registrar perda'}</div><div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(lead.name || 'Lead')}</div></div>
          <button type="button" id="ui685Fechar" style="border:0;background:transparent;color:var(--muted);font-size:22px;cursor:pointer">×</button>
        </div>
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Empreendimento</label>
        <input id="ui685Produto" list="ui685Produtos" value="${esc(produtoAtual(lead))}" placeholder="Ex.: nome do empreendimento" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px">
        <datalist id="ui685Produtos">${opcoesProdutos()}</datalist>
        ${vendido ? `
          <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Unidade <span style="text-transform:none;letter-spacing:0;color:var(--muted);font-weight:700">(opcional)</span></label>
          <input id="ui685Unidade" placeholder="Ex.: 903, 1801, lote 22" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px">
          <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Valor vendido</label>
          <input id="ui685Valor" inputmode="decimal" placeholder="Ex.: 650000" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px">
          <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Comissão <span style="text-transform:none;letter-spacing:0;color:var(--muted);font-weight:700">(opcional)</span></label>
          <input id="ui685Comissao" inputmode="decimal" placeholder="Ex.: 19500" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px">
        ` : `
          <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Motivo da perda</label>
          <select id="ui685Motivo" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px">
            <option value="Comprou concorrente">Comprou concorrente</option>
            <option value="Valor">Valor</option>
            <option value="Financiamento">Financiamento</option>
            <option value="Produto inadequado">Produto inadequado</option>
            <option value="Desistiu">Desistiu</option>
            <option value="Sem retorno">Sem retorno</option>
            <option value="Outro">Outro</option>
          </select>
        `}
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Data</label>
        <input id="ui685Data" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px">
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Observação</label>
        <textarea id="ui685Observacao" rows="3" placeholder="Anote o que pesou nesse desfecho" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;margin-bottom:12px;resize:vertical"></textarea>
        <div style="font-size:12px;color:var(--muted);line-height:1.45;margin-bottom:14px">O sistema calculará tempo até o desfecho, quantidade de contatos e registrará isso no aprendizado do lead.</div>
        <button type="button" id="ui685SalvarDesfecho" style="width:100%;padding:12px;background:${vendido?'linear-gradient(135deg,var(--lime),var(--acao))':'rgba(255,255,255,.05)'};color:${vendido?'var(--on-accent)':'var(--text)'};border:1px solid ${vendido?'transparent':'var(--line)'};border-radius:12px;font-size:14px;font-weight:950;cursor:pointer">${vendido?'Confirmar venda':'Confirmar perda'}</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
    q('#ui685Fechar')?.addEventListener('click', ()=>overlay.remove());
    q('#ui685SalvarDesfecho')?.addEventListener('click', ()=>salvarDesfechoFinal(id, tipo));
  }
  async function salvarDesfechoFinal(id,tipo){
    const vendido = tipo === 'vendido';
    const produto = (q('#ui685Produto')?.value || '').trim();
    const unidade = (q('#ui685Unidade')?.value || '').trim();
    const valor = (q('#ui685Valor')?.value || '').trim();
    const comissao = (q('#ui685Comissao')?.value || '').trim();
    const motivo = (q('#ui685Motivo')?.value || '').trim();
    const data = (q('#ui685Data')?.value || '').trim();
    const observacao = (q('#ui685Observacao')?.value || '').trim();
    if(vendido && !valor){ toast('Informe o valor vendido.'); return; }
    if(!vendido && !motivo){ toast('Informe o motivo da perda.'); return; }
    const btn=q('#ui685SalvarDesfecho'); if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
    try{
      const r=await fetch('./api/lead-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'desfecho',tipo,produto,unidade,valorVendido:valor,comissao,motivoPerda:motivo,data,observacao})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok || !d?.ok) throw new Error(d?.error || 'falha ao registrar desfecho');
      document.getElementById('ui685DesfechoModal')?.remove();
      try{ if(typeof invalidarLeadsCache==='function') invalidarLeadsCache(); }catch(_){ }
      toast(vendido ? 'Venda registrada e aprendizado atualizado.' : 'Perda registrada e aprendizado atualizado.');
      try{ await loadRecentLeads(true); }catch(_){ }
      try{ await carregarDashboard(); }catch(_){ }
      try{ await abrirLead(id); }catch(_){ }
    }catch(err){ toast('Não consegui registrar: '+(err?.message||err)); if(btn){ btn.disabled=false; btn.textContent=vendido?'Confirmar venda':'Confirmar perda'; } }
  }
  window.abrirVenda = function(id){ abrirModalDesfechoFinal(String(id),'vendido'); };
  window.marcarPerdido = function(id){ abrirModalDesfechoFinal(String(id),'perdido'); };
  window.CORRETOR_PRO_VERSAO_APRENDIZADO = '686-2';
})();

// ===== v685-ajustes — Editar lead e exibir telefone =====
// Escopo fechado: editar apenas Nome, Telefone e Produto; exibir telefone no lead; sem misturar com v686-2.
(function(){
  if(window.__cp685AjustesLead) return;
  window.__cp685AjustesLead = true;

  function q(sel){ return document.querySelector(sel); }
  function esc(v){
    try { return escapeHtml(String(v ?? '')); }
    catch(_) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function produtosOptions(){
    const lista = Array.isArray(window.EMPREENDIMENTOS_SENGER)
      ? window.EMPREENDIMENTOS_SENGER
      : (typeof EMPREENDIMENTOS_SENGER !== 'undefined' ? EMPREENDIMENTOS_SENGER : []);
    return lista.map(p => `<option value="${esc(p)}"></option>`).join('');
  }
  function produtoDoLead(lead){
    return String(lead?.product || lead?.analysis?.produtoInteresse || lead?.analysis?.product || lead?.analysis?.lead?.product || '').trim();
  }
  function telefoneDoLead(lead){
    return String(lead?.phone || lead?.analysis?.lead?.phone || lead?.analysis?.telefone || '').trim();
  }
  function nomeDoLead(lead){
    return String(lead?.name || lead?.analysis?.clientName || lead?.analysis?.lead?.clientName || '').trim();
  }
  function atualizarLeadLocal(id, patch){
    try{ patchLeadCache(id, { name: patch.nome, phone: patch.telefone, product: patch.produto }); }catch(_){ }
    try{
      if(state.lead && String(state.lead.id) === String(id)){
        if(patch.nome) state.lead.name = patch.nome;
        if(patch.telefone) state.lead.phone = patch.telefone;
        if(patch.produto) state.lead.product = patch.produto;
        state.lead.analysis = state.lead.analysis || {};
        state.lead.analysis.lead = state.lead.analysis.lead || {};
        if(patch.nome){ state.lead.analysis.clientName = patch.nome; state.lead.analysis.lead.clientName = patch.nome; }
        if(patch.telefone){ state.lead.analysis.lead.phone = patch.telefone; }
        if(patch.produto){ state.lead.analysis.produtoInteresse = patch.produto; state.lead.analysis.product = patch.produto; state.lead.analysis.lead.product = patch.produto; }
      }
    }catch(_){ }
  }

  window.fecharEditarLead = function(){ document.getElementById('editarLeadModal')?.remove(); };

  window.abrirEditarLead = function(id, nome, telefone){
    const lead = (state && state.lead && String(state.lead.id) === String(id)) ? state.lead : {};
    const nomeIni = String(nome || nomeDoLead(lead) || '').trim();
    const telIni = String(telefone || telefoneDoLead(lead) || '').trim();
    const produtoIni = produtoDoLead(lead);
    document.getElementById('editarLeadModal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'editarLeadModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;pointer-events:auto';
    overlay.innerHTML = `
      <div style="width:min(430px,100%);background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.45)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px">
          <div>
            <div style="font-size:18px;font-weight:950;color:var(--text)">Editar lead</div>
            <div style="font-size:12px;color:var(--muted);margin-top:4px">Altere somente os dados principais.</div>
          </div>
          <button type="button" id="editLeadFechar" style="border:0;background:transparent;color:var(--muted);font-size:24px;cursor:pointer;line-height:1">×</button>
        </div>
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Nome</label>
        <input type="text" id="editLeadNome" value="${esc(nomeIni)}" placeholder="Nome do cliente" autocomplete="off" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:12px;font-size:15px;margin-bottom:12px">
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Telefone / WhatsApp</label>
        <input type="tel" id="editLeadTelefone" value="${esc(telIni)}" placeholder="(54) 99999-9999" inputmode="tel" autocomplete="off" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:12px;font-size:15px;margin-bottom:12px">
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Produto / empreendimento</label>
        <input type="text" id="editLeadProduto" list="editLeadProdutoLista" value="${esc(produtoIni)}" placeholder="Ex.: nome do empreendimento" autocomplete="off" style="width:100%;box-sizing:border-box;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:12px;font-size:15px;margin-bottom:16px">
        <datalist id="editLeadProdutoLista">${produtosOptions()}</datalist>
        <button type="button" id="editLeadSalvar" style="width:100%;padding:13px;background:linear-gradient(135deg,var(--lime),var(--acao));color:var(--on-accent);border:0;border-radius:12px;font-size:15px;font-weight:950;cursor:pointer">Salvar</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if(e.target === overlay) fecharEditarLead(); });
    q('#editLeadFechar')?.addEventListener('click', fecharEditarLead);
    q('#editLeadSalvar')?.addEventListener('click', () => salvarEditarLead(String(id)));
    setTimeout(() => q('#editLeadNome')?.focus(), 80);
  };

  window.salvarEditarLead = async function(id){
    const nome = (q('#editLeadNome')?.value || '').trim();
    const telefone = (q('#editLeadTelefone')?.value || '').trim();
    const produto = (q('#editLeadProduto')?.value || '').trim();
    if(!nome && !telefone && !produto){ toast('Informe nome, telefone ou produto.'); return; }
    const btn = q('#editLeadSalvar');
    if(btn){ btn.disabled = true; btn.textContent = 'Salvando...'; }
    try{
      const res = await fetch('./api/lead-update', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id, action:'editar-dados', nome, telefone, produto })
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'falha ao salvar');
      try{
        await fetch('./api/lead-update', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ id, action:'aprendizado', evento:'dados_lead_editados', estilo:'operacional', detalhes:{ nome, telefone, produto, de:'v685-ajustes' } })
        });
      }catch(_){ }
      fecharEditarLead();
      atualizarLeadLocal(id, { nome, telefone, produto });
      try{ if(typeof invalidarLeadsCache === 'function') invalidarLeadsCache(); }catch(_){ }
      toast('Lead atualizado.');
      try{ await loadRecentLeads(true); }catch(_){ }
      try{ await carregarDashboard(); }catch(_){ }
      try{ await abrirLead(id); }catch(_){ if(state.lead) renderLeadFoco(state.lead); }
    }catch(err){
      toast('Erro ao salvar: ' + (err?.message || err));
      if(btn){ btn.disabled = false; btn.textContent = 'Salvar'; }
    }
  };

  function injetarAjustesLead(lead){
    const root = document.querySelector('#leadFocoArea .lead-foco');
    if(!root || !lead?.id) return;
    document.querySelectorAll('#ui685AjustesPhone,#ui685AjustesEditQuick,#ui685AjustesEditAdmin').forEach(el => el.remove());
    const telefone = telefoneDoLead(lead);
    const id = String(lead.id);
    const nome = nomeDoLead(lead);
    const editar = () => abrirEditarLead(id, nome, telefone);

    const lastAnalysis = root.querySelector('.ui682-last-analysis');
    if(telefone && lastAnalysis){
      const tel = document.createElement('div');
      tel.id = 'ui685AjustesPhone';
      tel.className = 'ui685-phone-line';
      tel.innerHTML = `<b>Telefone:</b> ${esc(telefone)}`;
      lastAnalysis.insertAdjacentElement('afterend', tel);
    }

    const actions = document.getElementById('ui683LeadTools');
    if(actions){
      const btn = document.createElement('button');
      btn.id = 'ui685AjustesEditQuick';
      btn.type = 'button';
      btn.textContent = 'Editar lead';
      btn.addEventListener('click', editar);
      actions.insertBefore(btn, actions.firstElementChild);
    }

    const admin = root.querySelector('.ui670-admin-actions');
    if(admin){
      const btn = document.createElement('button');
      btn.id = 'ui685AjustesEditAdmin';
      btn.type = 'button';
      btn.textContent = 'Editar lead';
      btn.addEventListener('click', editar);
      admin.insertBefore(btn, admin.firstElementChild);
    }
  }

  function injetarEstiloAjustes(){
    if(document.getElementById('ui685AjustesStyle')) return;
    const st = document.createElement('style');
    st.id = 'ui685AjustesStyle';
    st.textContent = `
      .ui685-phone-line{margin-top:6px;color:var(--muted);font-size:13px;font-weight:700;line-height:1.35}
      .ui685-phone-line b{color:var(--text);font-weight:950}
      #ui685AjustesEditQuick{border-color:rgba(255,98,88,.45)!important;color:var(--text)!important}
      #ui685AjustesEditAdmin{font-weight:950!important}
    `;
    document.head.appendChild(st);
  }
// Atualização #724-2: wrapper antigo de renderLeadFoco removido.

  window.CORRETOR_PRO_VERSAO_AJUSTES = '685-ajustes';
})();


/* ============================================================
   V685-AJUSTES-2 — correção do botão Editar lead
   O botão era inserido com addEventListener, mas outro ajuste da v683
   reescrevia o innerHTML dos botões rápidos e removia o listener.
   Esta delegação captura o clique mesmo após re-render/innerHTML.
   ============================================================ */
(function(){
  if(window.__cp685Ajustes2EditarLeadClick) return;
  window.__cp685Ajustes2EditarLeadClick = true;

  function leadAtual(){
    try { return state && state.lead ? state.lead : null; } catch(_) { return null; }
  }
  function nomeLead(lead){
    return String(lead?.name || lead?.analysis?.clientName || lead?.analysis?.lead?.clientName || '').trim();
  }
  function telefoneLead(lead){
    return String(lead?.phone || lead?.analysis?.lead?.phone || lead?.analysis?.telefone || '').trim();
  }
  function abrirEditorDoLeadAtual(ev){
    const btn = ev.target && ev.target.closest ? ev.target.closest('#ui685AjustesEditQuick,#ui685AjustesEditAdmin,[data-action="editar-lead"]') : null;
    if(!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const lead = leadAtual();
    if(!lead || !lead.id){
      try { toast('Abra um lead antes de editar.'); } catch(_) {}
      return;
    }
    if(typeof window.abrirEditarLead !== 'function'){
      try { toast('Editor do lead não carregou. Recarregue a página.'); } catch(_) {}
      return;
    }
    window.abrirEditarLead(String(lead.id), nomeLead(lead), telefoneLead(lead));
  }

  document.addEventListener('click', abrirEditorDoLeadAtual, true);

  function reforcarBotaoEditar(){
    try{
      document.querySelectorAll('#ui685AjustesEditQuick,#ui685AjustesEditAdmin').forEach(btn => {
        btn.setAttribute('data-action','editar-lead');
        btn.onclick = null;
        btn.style.pointerEvents = 'auto';
      });
    }catch(_){}
  }
// Atualização #724-2: wrapper antigo de renderLeadFoco removido.

  setTimeout(reforcarBotaoEditar, 0);
  window.CORRETOR_PRO_VERSAO_AJUSTES = '685-ajustes-2';
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
  function renderLoadMore(key, total, visible, fnName){
    const faltam = Math.max(0, total - visible);
    return faltam > 0
      ? `<button type="button" class="cart-load-more" onclick="${fnName}()">Carregar mais ${Math.min(PAGE, faltam)} <span>(${visible} de ${total})</span></button>`
      : "";
  }
  window.cp6862MaisVendas = function(){ loadMore('vendasVisibleCount', window.carregarVendas); };
  window.cp6862MaisPerdidos = function(){ loadMore('perdidosVisibleCount', window.carregarPerdidos); };
  window.cp6862MaisGeladeira = function(){ loadMore('geladeiraVisibleCount', window.carregarGeladeira); };

  window.carregarVendas = async function(){
    const start = cpPerfNow();
    const box = qs('#vendasList');
    if(!box) return;
    box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
    try{
      const data = await getLeadsData(false);
      const items = baseRows(data?.items).filter(l => normalizarEtapa(l.etapa) === 'Vendido');
      const limite = ensureVisibleKey('vendasVisibleCount');
      const lote = items.slice(0, limite);
      if(!items.length){
        box.innerHTML = '<div class="empty">Nenhuma venda registrada ainda. Abra o lead e use o botão "Marcar venda".</div>';
        cpPerfMark('renderVendas', start, { total:0, visiveis:0 });
        return;
      }
      box.innerHTML = lote.map(l => {
        const v = l.analysis?.venda || {};
        const valor = v.valor ? 'R$ '+escapeHtml(String(v.valor)) : '';
        return `
          <div style="border:1px solid var(--line);background:rgba(104,255,149,.05);border-radius:14px;padding:12px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
              <strong style="font-size:15px;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(55,232,255,.3)" onclick='abrirLead(${leadId(l)})'>${escapeHtml(l.name||'Cliente')}</strong>
              <span class="tag hot" style="background:rgba(104,255,149,.18);color:#bdffd0;border-color:rgba(104,255,149,.32)">VENDIDO</span>
            </div>
            ${v.empreendimento ? `<div class="small" style="margin-top:6px">${escapeHtml(v.empreendimento)}${v.unidade?' · Unid. '+escapeHtml(v.unidade):''}${v.box?' · Box '+escapeHtml(v.box):''}</div>` : ''}
            ${valor ? `<div class="small" style="margin-top:4px;color:var(--acao);font-weight:950">${valor}</div>` : ''}
            ${v.observacoes ? `<div class="small" style="margin-top:6px">${escapeHtml(v.observacoes)}</div>` : ''}
            ${v.registradaEm ? `<div class="small" style="margin-top:6px;color:var(--muted)">Registrada em ${escapeHtml(new Date(v.registradaEm).toLocaleString('pt-BR'))}</div>` : ''}
          </div>`;
      }).join('') + renderLoadMore('vendasVisibleCount', items.length, lote.length, 'cp6862MaisVendas');
      cpPerfMark('renderVendas', start, { total:items.length, visiveis:lote.length });
    }catch(err){
      box.innerHTML = '<div class="notice error">Falha: '+escapeHtml(String(err?.message||err))+'</div>';
      cpPerfMark('renderVendas', start, { error:true });
    }
  };

  window.carregarPerdidos = async function(){
    const start = cpPerfNow();
    const box = qs('#perdidosList');
    if(!box) return;
    box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
    try{
      const data = await getLeadsData(false);
      const items = baseRows(data?.items).filter(l => normalizarEtapa(l.etapa) === 'Perdido');
      const limite = ensureVisibleKey('perdidosVisibleCount');
      const lote = items.slice(0, limite);
      if(!items.length){ box.innerHTML = '<div class="empty">Nenhum lead perdido no momento.</div>'; cpPerfMark('renderPerdidos', start, { total:0, visiveis:0 }); return; }
      box.innerHTML = `<div class="small" style="color:var(--muted);margin-bottom:10px">${items.length} lead${items.length>1?'s':''} perdido${items.length>1?'s':''}.</div>` + lote.map(l => {
        const idJs = leadId(l);
        const motivo = l.analysis?.motivoPerda || l.analysis?.motivo_perda || l.analysis?.perda?.motivo || '';
        const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction+'d parado' : '';
        return `
          <div data-perdido-id="${escapeHtml(String(l.id||''))}" style="border:1px solid var(--line);background:rgba(255,91,122,.04);border-radius:14px;padding:12px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
              <div style="flex:1;min-width:0">
                <strong style="font-size:15px;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(55,232,255,.3)" onclick='abrirLead(${idJs})'>${escapeHtml(l.name||'Cliente')}</strong>
                <div class="small" style="margin-top:4px;color:var(--muted)">${escapeHtml(produtosLabel(l))}${dias?' · '+dias:''}</div>
                ${motivo ? `<div class="small" style="margin-top:6px"><b>Motivo:</b> ${escapeHtml(motivo)}</div>` : ''}
              </div>
              <span class="tag" style="background:rgba(255,91,122,.12);color:#ffdbe2;border-color:rgba(255,91,122,.32);font-size:10px">PERDIDO</span>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button type="button" onclick='abrirLead(${idJs})' style="padding:6px 12px;background:transparent;color:var(--soft);border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Ver lead</button>
              <button type="button" onclick='reabrirLeadPerdido(${idJs},this)' style="padding:6px 12px;background:rgba(104,255,149,.12);color:var(--acao);border:1px solid var(--acao);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Reabrir</button>
            </div>
          </div>`;
      }).join('') + renderLoadMore('perdidosVisibleCount', items.length, lote.length, 'cp6862MaisPerdidos');
      cpPerfMark('renderPerdidos', start, { total:items.length, visiveis:lote.length });
    }catch(err){ box.innerHTML = '<div class="notice error">Falha: '+escapeHtml(String(err?.message||err))+'</div>'; cpPerfMark('renderPerdidos', start, { error:true }); }
  };

  window.carregarGeladeira = async function(){
    const start = cpPerfNow();
    const box = qs('#geladeiraList');
    if(!box) return;
    box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
    try{
      const data = await getLeadsData(false);
      const items = baseRows(data?.items).filter(l => ['Geladeira','Perdido'].includes(normalizarEtapa(l.etapa)));
      const limite = ensureVisibleKey('geladeiraVisibleCount');
      const lote = items.slice(0, limite);
      if(!items.length){ box.innerHTML = '<div class="empty">Nenhum contato arquivado no momento.</div>'; cpPerfMark('renderGeladeira', start, { total:0, visiveis:0 }); return; }
      box.innerHTML = `<div class="small" style="color:var(--muted);margin-bottom:10px">${items.length} negócio${items.length>1?'s':''} guardado${items.length>1?'s':''}.</div>` + lote.map(l => {
        const idJs = leadId(l);
        const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction+'d parado' : '';
        return `
          <div data-geladeira-id="${escapeHtml(String(l.id||''))}" style="border:1px solid var(--line);background:rgba(0,212,255,.04);border-radius:14px;padding:12px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
              <div style="flex:1;min-width:0">
                <strong style="font-size:15px;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(55,232,255,.3)" onclick='abrirLead(${idJs})'>${escapeHtml(l.name||'Cliente')}</strong>
                <div class="small" style="margin-top:4px;color:var(--muted)">${escapeHtml(produtosLabel(l))}${dias?' · '+dias:''}</div>
              </div>
              <span class="tag" style="background:rgba(0,212,255,.12);color:#bff0ff;border-color:rgba(0,212,255,.32);font-size:10px">ARQUIVADO</span>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button type="button" onclick='abrirLead(${idJs})' style="padding:6px 12px;background:transparent;color:var(--soft);border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Ver lead</button>
              <button type="button" onclick='reativarLeadGeladeira(${idJs},this)' style="padding:6px 12px;background:rgba(104,255,149,.12);color:var(--acao);border:1px solid var(--acao);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Reativar</button>
            </div>
          </div>`;
      }).join('') + renderLoadMore('geladeiraVisibleCount', items.length, lote.length, 'cp6862MaisGeladeira');
      cpPerfMark('renderGeladeira', start, { total:items.length, visiveis:lote.length });
    }catch(err){ box.innerHTML = '<div class="notice error">Falha: '+escapeHtml(String(err?.message||err))+'</div>'; cpPerfMark('renderGeladeira', start, { error:true }); }
  };

  try{
    const antigoResumo = window.cpPerformanceResumo;
    window.cpPerformanceResumo = function(){
      const r = typeof antigoResumo === 'function' ? antigoResumo() : {};
      r.renderVendasMs = cpPerfMedia('renderVendas');
      r.renderPerdidosMs = cpPerfMedia('renderPerdidos');
      r.renderGeladeiraMs = cpPerfMedia('renderGeladeira');
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
  if(window.__cp6863VirtualPatch) return;
  window.__cp6863VirtualPatch = true;
  const ROW_H = 82;
  const BUFFER = 10;
  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
  function metric(name, t0, meta){ try{ cpPerfMark(name, t0, meta || {}); }catch(_){} }
  function virtualHtml(key, items, rowFn, emptyHtml, opts){
    opts = opts || {};
    const total = Array.isArray(items) ? items.length : 0;
    if(!total) return emptyHtml || '<div class="empty">Nenhum item encontrado.</div>';
    const top = Number(state[key+'ScrollTop'] || 0);
    const viewport = Number(state[key+'Viewport'] || opts.viewport || 620);
    const start = clamp(Math.floor(top / ROW_H) - BUFFER, 0, Math.max(0, total - 1));
    const visible = clamp(Math.ceil(viewport / ROW_H) + BUFFER * 2, 20, 90);
    const end = clamp(start + visible, start, total);
    const slice = items.slice(start, end);
    const before = start * ROW_H;
    const after = Math.max(0, (total - end) * ROW_H);
    state[key+'Rendered'] = { total, start, end, rendered: slice.length };
    return `<div class="cp-virtual-wrap" data-vkey="${key}" onscroll="cp6863VirtualScroll(this,'${key}')" style="max-height:min(72vh,720px);overflow:auto;contain:content;overscroll-behavior:contain">
      <div style="height:${before}px"></div>
      ${slice.map(rowFn).join('')}
      <div style="height:${after}px"></div>
    </div>`;
  }
  window.cp6863VirtualScroll = function(el, key){
    state[key+'ScrollTop'] = el.scrollTop || 0;
    state[key+'Viewport'] = el.clientHeight || 620;
    if(state[key+'Raf']) cancelAnimationFrame(state[key+'Raf']);
    state[key+'Raf'] = requestAnimationFrame(()=>{
      if(key === 'carteira') renderCarteiraTabela();
      if(key === 'pipeline') carregarPipeline();
    });
  };
  try{
    const oldSetFiltro = window.setCarteiraFiltro;
    window.setCarteiraFiltro = function(f){ state.carteiraScrollTop = 0; if(typeof oldSetFiltro === 'function') return oldSetFiltro(f); };
  }catch(_){}
  try{
    renderCarteiraTabela = function(){
      const t0 = cpPerfNow();
      const box = qs('#carteiraBody');
      if(!box) return;
      const base = (state.carteiraLeads||[]).filter(l => { const e = normalizarEtapa(l.etapa); return e !== 'Vendido' && e !== 'Perdido'; });
      const filtro = state.carteiraFiltro || 'todos';
      const lista = base.filter(l => carteiraPassaFiltro(l, filtro)).map(l => ({ ...l, _s: scoreRankingHoje(l) })).sort(compararPrioridadeAtendimento);
      const chips = CART_FILTROS.map(([k,lbl]) => `<button type="button" class="${k===filtro?'active':''}" onclick="setCarteiraFiltro('${k}')">${lbl}</button>`).join('');
      const rows = virtualHtml('carteira', lista, carteiraRowHTML, '<div class="empty" style="margin:14px">Nenhum lead nesse filtro.</div>');
      const r = state.carteiraRendered || {};
      box.innerHTML = `
        ${ui677ToolbarHTML('atendimentos')}
        <div class="cart-head">
          <div><h2>Atendimentos</h2><div class="sub">${lista.length} lead${lista.length!==1?'s':''} neste filtro · renderizando ${Number(r.rendered||Math.min(lista.length,90))} por janela</div></div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div class="cart-filtros">${chips}</div>
            <button type="button" class="cart-export" onclick="exportarLeadsCSV(this)" title="Baixar Excel (CSV) de TODOS os leads com o histórico inteiro">⬇ Excel</button>
            <button type="button" class="cart-export" onclick="exportarBackupCompletoV681(this)" title="Backup completo em JSON, com dados brutos do banco e auditoria de integridade">🛡 Backup</button>
            <button type="button" class="cart-export" onclick="auditarDadosV681(this)" title="Conferir possíveis duplicidades, leads sem histórico e inconsistências">✓ Auditar</button>
          </div>
        </div>
        <div class="cart-table">
          <div class="cart-thead"><span>Cliente</span><span>Empreendimento</span><span>Prioridade</span><span>Resposta</span><span>Próxima ação</span><span></span></div>
          ${rows}
        </div>`;
      const sc = box.querySelector('.cp-virtual-wrap[data-vkey="carteira"]');
      if(sc) sc.scrollTop = Number(state.carteiraScrollTop || 0);
      metric('renderCarteiraVirtual', t0, { total: lista.length, rendered: state.carteiraRendered?.rendered || 0 });
    };
  }catch(e){ console.warn('686-3 carteira virtual não aplicada', e); }

  try{
    const oldSetPipe = window.setPipelineVisualFiltro;
    window.setPipelineVisualFiltro = function(f){ state.pipelineScrollTop = 0; if(typeof oldSetPipe === 'function') return oldSetPipe(f); state.pipelineVisualFiltro=f||'todos'; carregarPipeline(); };
    carregarPipeline = async function(){
      if(state.active !== 'pipeline') return;
      const board = qs('#pipelineBoard'); if(!board) return;
      const emMemoria = [state.todosLeads, state.itemsAtivos].find(a=>Array.isArray(a)&&a.length);
      const render = (data) => {
        const t0 = cpPerfNow();
        const all=(data?.items||[]).map(limparLead).filter(leadEhAtivo);
        const hot=leadEhQuente;
        const compromisso=l=>{const a=l.analysis?.confirmedAppointments;return (Array.isArray(a)&&a.length)||!!l.analysis?.lembrete?.quando};
        const reaquecer=leadEhReaquecer;
        const filtros={todos:all,quentes:all.filter(hot),esfriando:all.filter(l=>(Number(l.daysSinceLastInteraction)||0)>=7&&hot(l)),compromisso:all.filter(compromisso),reaquecer:all.filter(reaquecer)};
        const filtro=state.pipelineVisualFiltro||'todos';
        const lista=(filtros[filtro]||all).slice().sort(compararPrioridadeAtendimento);
        const listaPrioritaria=lista.filter(l=>ui670ModeloComercial(l)?.acao?.status!=='sem-acao-urgente');
        const etapas=['Novo','Atendimento','Visita/Proposta','Negociação','Standby'];
        const cnt=Object.fromEntries(etapas.map(e=>[e,0]));
        all.forEach(l=>{const e=normalizarEtapa(l.etapa);if(cnt[e]!==undefined)cnt[e]++;});
        const tabs=[['todos','Todos'],['quentes','Agora'],['esfriando','Parando'],['compromisso','Agenda'],['reaquecer','Reativar']];
        const acaoRow=l=>compromisso(l)?'Agenda':hot(l)?'Agora':'Retomar';
        const listHtml = virtualHtml('pipeline', listaPrioritaria, l=>ui631LeadRow(l, acaoRow(l)), '<div class="empty">Nenhum lead com ação pendente nesse filtro.</div>', {viewport:620});
        const r = state.pipelineRendered || {};
        board.innerHTML=`
          <div class="ui-pipeline-kpis">
            <div class="ui-kpi"><span>Ativos</span><div><b>${all.length}</b><i>${ui631Icon('ativos')}</i></div></div>
            <div class="ui-kpi active"><span>Agora</span><div><b>${filtros.quentes.length}</b><i>${ui631Icon('quente')}</i></div></div>
            <div class="ui-kpi"><span>Agenda</span><div><b>${filtros.compromisso.length}</b><i>${ui631Icon('compromisso')}</i></div></div>
            <div class="ui-kpi"><span>Reativar</span><div><b>${filtros.reaquecer.length}</b><i>${ui631Icon('reaquecer')}</i></div></div>
          </div>
          <div class="ui-filter-tabs">${tabs.map(([k,t])=>`<button type="button" class="${k===filtro?'active':''}" onclick="setPipelineVisualFiltro('${k}')">${t}</button>`).join('')}</div>
          <div class="ui-pipeline-grid">
            <section class="ui-funnel-card"><h3>Funil por etapa</h3>${etapas.map(e=>{const n=cnt[e]||0,p=all.length?Math.round(n/all.length*100):0;return `<div class="ui-funnel-row"><div><span>${e}</span><b>${n}</b><em>${p}%</em></div><i><u style="width:${Math.max(3,p)}%"></u></i></div>`}).join('')}</section>
            <aside class="ui-pipe-summary"><div><span>Base filtrada</span><b>${lista.length}</b><small>lead${lista.length===1?'':'s'}</small></div><button type="button" onclick="reanalisarTudo()">↻ Reanalisar todos</button><button type="button" onclick="show('carteira')">Ver carteira completa</button></aside>
          </div>
          <section class="ui-priority-card ui-pipeline-list"><div class="ui-section-head"><div><h3>Leads prioritários</h3><p>Ordenados por prioridade de atendimento · ${Number(r.rendered||Math.min(listaPrioritaria.length,90))} renderizados por janela.</p></div></div><div class="ui-priority-list">${listHtml}</div></section>`;
        const sc = board.querySelector('.cp-virtual-wrap[data-vkey="pipeline"]');
        if(sc) sc.scrollTop = Number(state.pipelineScrollTop || 0);
        metric('renderPipelineVirtual', t0, { total: listaPrioritaria.length, rendered: state.pipelineRendered?.rendered || 0 });
      };
      if(emMemoria) render({items:emMemoria}); else { board.innerHTML='<div class="small ui-loading">Carregando...</div>'; getLeadsData().then(render).catch(()=>{ board.innerHTML=boxErro('carregarPipeline()'); }); }
    };
  }catch(e){ console.warn('686-3 pipeline virtual não aplicado', e); }

  try{
    const oldResumo = window.cpPerformanceResumo;
    window.cpPerformanceResumo = function(){
      const r = typeof oldResumo === 'function' ? oldResumo() : {};
      r.renderCarteiraVirtualMs = cpPerfMedia('renderCarteiraVirtual');
      r.renderPipelineVirtualMs = cpPerfMedia('renderPipelineVirtual');
      r.carteiraDomRenderizado = state.carteiraRendered?.rendered || 0;
      r.pipelineDomRenderizado = state.pipelineRendered?.rendered || 0;
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
    panel.innerHTML=`
      <div class="cp687-notify-head"><div><h3>Central de atenção</h3><small>O que merece sua ação agora.</small></div><button class="cp687-notify-close" type="button" aria-label="Fechar">×</button></div>
      ${d.atrasados?`<div class="cp687-notify-item" data-go="pipeline" data-filter="agora"><i>!</i><div><b>${d.atrasados} compromisso${d.atrasados===1?'':'s'} atrasado${d.atrasados===1?'':'s'}</b><span>Venceram e ainda não foram tratados — retome logo.</span></div></div>`:''}
      <div class="cp687-notify-item" data-go="pipeline" data-filter="agora"><i>!</i><div><b>${d.agora} atendimento${d.agora===1?' pede':'s pedem'} ação</b><span>Abra a Condução para priorizar de cima para baixo.</span></div></div>
      <div class="cp687-notify-item" data-go="agenda"><i>⌁</i><div><b>${Math.max(0,(d.programados||0)-(d.atrasados||0))} na agenda</b><span>Compromissos com data marcada — hoje e próximos.</span></div></div>
      <div class="cp687-notify-item" data-go="relatorio"><i>▣</i><div><b>${d.total} clientes ativos</b><span>Acompanhe ritmo de atendimento e resultados.</span></div></div>`;
    panel.classList.add('open');
    panel.querySelector('.cp687-notify-close')?.addEventListener('click',()=>panel.classList.remove('open'));
    panel.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click',()=>{panel.classList.remove('open');const filtro=el.dataset.filter;if(filtro&&typeof cp786AbrirConducao==='function')cp786AbrirConducao(filtro);else if(typeof window.show==='function')window.show(el.dataset.go);}));
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
    badge.hidden = !n;
    // Indicador discreto, sem número solto ou ambíguo na interface.
    badge.textContent = '';
    bell.classList.toggle('tem-alerta', n > 0);
    const label = n > 0
      ? `${n} compromisso${n===1?'':'s'} na agenda de hoje — toque para abrir`
      : 'Agenda';
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
   Atualização #724-2 — Hotfix real mobile
   - Remove as correções conflitantes anteriores de Atendimentos.
   - Atendimentos: lista simples, página com rolagem natural, sem container interno.
   - Botão + fica dentro da barra inferior, no centro, junto dos demais ícones.
   - Loading da Home não fica preso: mostra skeleton e libera fallback se a API demorar.
   ============================================================ */
(function(){
  if(window.__cp694HotfixMobile) return;
  window.__cp694HotfixMobile = true;
  const VERSION = '__VERSION__';
  try{ window.CORRETOR_PRO_VERSION = VERSION; }catch(_){ }

  function esc(v){
    try { return escapeHtml(String(v ?? '')); }
    catch(_) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function safeId(l){ return JSON.stringify(String(l?.id || '')); }
  function etapaTxt(l){
    const e = typeof normalizarEtapa === 'function' ? normalizarEtapa(l?.etapa) : String(l?.etapa || 'Atendimento');
    const p = String(l?.product || '').trim();
    return p ? `${e} · ${p}` : e;
  }
  function acaoTxt(l){
    const raw = String(l?.nextAction || (typeof motivoCurto === 'function' ? motivoCurto(l) : '') || 'Abrir lead para conferir.').replace(/\s+/g,' ').trim();
    return raw.length > 72 ? raw.slice(0,69).trim() + '...' : raw;
  }
  function statusTxt(l){
    const p = typeof prioridadeAtendimento === 'function' ? (prioridadeAtendimento(l)||{}) : {};
    const t = String(p.titulo || '').trim();
    if(/atender/i.test(t)) return 'Atender';
    if(/retomar/i.test(t)) return 'Retomar';
    if(/aguardar/i.test(t)) return 'Aguardar';
    if(/sem/i.test(t)) return 'Sem ação';
    return t || 'Abrir';
  }
  function statusClass(l){
    const p = typeof prioridadeAtendimento === 'function' ? (prioridadeAtendimento(l)||{}) : {};
    if(p.grupo === 'acao-hoje') return 'hot';
    if(p.grupo === 'retomar-cuidado') return 'warm';
    if(p.grupo === 'baixa-prioridade') return 'low';
    return 'normal';
  }
  function leadsAtendimento(){
    const arr = Array.isArray(state?.carteiraLeads) && state.carteiraLeads.length ? state.carteiraLeads :
      (Array.isArray(state?.itemsAtivos) && state.itemsAtivos.length ? state.itemsAtivos :
      (Array.isArray(state?.todosLeads) ? state.todosLeads : []));
    return arr.filter(l=>{
      const e = typeof normalizarEtapa === 'function' ? normalizarEtapa(l?.etapa) : String(l?.etapa || '');
      return e !== 'Vendido' && e !== 'Perdido' && e !== 'Geladeira';
    }).map(l=>({ ...l, _s: typeof scoreRankingHoje === 'function' ? scoreRankingHoje(l) : 0 }))
      .sort(typeof compararPrioridadeAtendimento === 'function' ? compararPrioridadeAtendimento : (()=>0));
  }
  function rowLead(l){
    return `<button type="button" class="cp694-lead-row ${statusClass(l)}" onclick='abrirLead(${safeId(l)})'>
      <span class="cp694-lead-copy"><b>${esc(l?.name || 'Cliente')}</b><em>${esc(etapaTxt(l))}</em><small>${esc(acaoTxt(l))}</small></span>
      <span class="cp694-lead-status">${esc(statusTxt(l))}</span>
    </button>`;
  }

  window.renderCarteiraTabela = function(){
    const box = document.querySelector('#carteiraBody');
    if(!box) return;
    const old = window.scrollY || document.documentElement.scrollTop || 0;
    const lista = leadsAtendimento();
    const rows = lista.length ? lista.map(rowLead).join('') : `<div class="cp694-empty"><b>Nenhum atendimento agora.</b><span>Quando houver lead ativo, ele aparece aqui por prioridade.</span></div>`;
    box.innerHTML = `<section class="cp694-atendimentos">
      <header class="cp694-head"><h2>Atendimentos</h2><p>Prioridade de atendimento, de cima para baixo.</p></header>
      <div class="cp694-lista">${rows}</div>
    </section>`;
    requestAnimationFrame(()=>{
      cp694FixLayout();
      if(state?.active === 'carteira' && old > 80) window.scrollTo(0, old);
    });
  };
  try{ renderCarteiraTabela = window.renderCarteiraTabela; }catch(_){ }

  window.setCarteiraFiltro = function(){
    state.carteiraFiltro = 'todos';
    if(state.active !== 'carteira' && typeof show === 'function') show('carteira');
    else window.renderCarteiraTabela();
  };

  function cp694FixVersion(){
    document.querySelectorAll('.sb-brand small,.cp-brand small,.brand small,[data-version]').forEach(el=>{
      const txt = el.textContent || '';
      if(/Atualiza[cç][aã]o\s*#/i.test(txt)) el.textContent = txt.replace(/Atualiza[cç][aã]o\s*#\d+(?:-\d+)?/i,'Atualização #__VERSION__');
    });
  }
  function cp694FixFab(){
    document.querySelectorAll('.cp-bottom-nav .nav.fab .fab-btn,.bottom-nav .nav.fab .fab-btn').forEach(el=>{
      el.removeAttribute('style');
      el.style.setProperty('position','static','important');
      el.style.setProperty('left','auto','important');
      el.style.setProperty('top','auto','important');
      el.style.setProperty('transform','none','important');
      el.style.setProperty('width','38px','important');
      el.style.setProperty('height','38px','important');
      el.style.setProperty('margin','0 auto','important');
      el.style.setProperty('border-width','3px','important');
      el.style.setProperty('font-size','24px','important');
      el.style.setProperty('line-height','1','important');
      el.style.setProperty('z-index','1','important');
    });
    document.querySelectorAll('.cp-bottom-nav .nav.fab,.bottom-nav .nav.fab').forEach(el=>{
      el.style.setProperty('position','relative','important');
      el.style.setProperty('display','flex','important');
      el.style.setProperty('align-items','center','important');
      el.style.setProperty('justify-content','center','important');
      el.style.setProperty('padding','0','important');
      el.style.setProperty('overflow','visible','important');
    });
  }
  function cp694FixScroll(){
    document.querySelectorAll('#carteira,#carteiraBody,#pipeline,#pipelineBoard,.cp-virtual-wrap,.cp-virtual-inner,.ui-priority-list,.ui-pipeline-list,.cp694-lista').forEach(el=>{
      el.style.setProperty('height','auto','important');
      el.style.setProperty('max-height','none','important');
      el.style.setProperty('overflow','visible','important');
      el.style.setProperty('overflow-y','visible','important');
      el.style.setProperty('contain','none','important');
      el.style.setProperty('transform','none','important');
    });
  }
  function cp694FixLayout(){ cp694FixVersion(); cp694FixFab(); cp694FixScroll(); }

  const oldDash = window.carregarDashboard || (typeof carregarDashboard === 'function' ? carregarDashboard : null);
  if(oldDash){
    window.carregarDashboard = async function(){
      const foco = document.querySelector('#leadFocoArea');
      if(state?.active === 'home' && foco && !foco.children.length){
        foco.innerHTML = '<div class="cp694-loading"><div class="cp694-spinner"></div><b>Carregando sua carteira...</b><span>Organizando leads e prioridades.</span></div>';
      }
      const watchdog = setTimeout(()=>{
        const area = document.querySelector('#leadFocoArea');
        if(state?.active === 'home' && area && /Carregando sua carteira/i.test(area.textContent||'')){
          area.innerHTML = '<div class="cp694-loading"><b>Carregamento demorou mais que o normal.</b><span>Atualize a página ou abra Atendimentos para continuar usando a carteira.</span><button type="button" onclick="show(\'carteira\')">Abrir Atendimentos</button></div>';
        }
      }, 9000);
      try{ return await oldDash.apply(this, arguments); }
      finally{ clearTimeout(watchdog); setTimeout(cp694FixLayout, 80); }
    };
    try{ carregarDashboard = window.carregarDashboard; }catch(_){ }
  }

  document.addEventListener('DOMContentLoaded', cp694FixLayout);
  window.addEventListener('resize', cp694FixLayout);
  setTimeout(cp694FixLayout, 250);
  setTimeout(cp694FixLayout, 1000);

  const css = document.createElement('style');
  css.id = 'cp694HotfixCSS';
  css.textContent = `
    html,body{height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;scroll-behavior:auto!important}
    .main-col,.desktop-layout,.app,.screen,#home,#carteira,#pipeline,#carteiraBody,#pipelineBoard,.cp-virtual-wrap,.cp-virtual-inner,.ui-priority-list,.ui-pipeline-list{height:auto!important;max-height:none!important;overflow:visible!important;overflow-y:visible!important;contain:none!important;will-change:auto!important;transform:none!important}
    .cp-virtual-pad{display:none!important}
    #carteira .cart-filtros,#carteira .cart-export,#carteira .cart-head,#carteira .cart-table,#carteira .cart-thead,#carteira .cp689-att-page,#carteira .cp690-att-page,#carteira .cp691-att-page,#carteira .cp693-page{display:none!important}
    #carteiraBody{padding-bottom:calc(130px + env(safe-area-inset-bottom,0px))!important}
    .cp694-atendimentos{max-width:760px;margin:0 auto;padding:0 0 calc(132px + env(safe-area-inset-bottom,0px))}
    .cp694-head{margin:0 0 14px}.cp694-head h2{margin:0;font-size:30px!important;line-height:1;font-weight:950;letter-spacing:-.045em;color:var(--text)}.cp694-head p{margin:7px 0 0;color:var(--muted);font-size:14px!important;line-height:1.35}
    .cp694-lista{display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.10);border-radius:17px;background:rgba(7,52,64,.62);overflow:visible!important;margin-bottom:calc(120px + env(safe-area-inset-bottom,0px))}
    .cp694-lead-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;min-height:72px;padding:11px 11px 11px 17px;border:0;border-bottom:1px solid rgba(255,255,255,.08);background:transparent;color:var(--text);font:inherit;text-align:left;position:relative;cursor:pointer}
    .cp694-lead-row:last-child{border-bottom:0}.cp694-lead-row::before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 999px 999px 0;background:transparent}.cp694-lead-row.hot::before{background:var(--lime)}.cp694-lead-row.warm::before{background:var(--morno)}.cp694-lead-row:active{background:rgba(255,98,88,.08)}
    .cp694-lead-copy{min-width:0;display:flex;flex-direction:column;gap:3px}.cp694-lead-copy b{display:block;color:var(--text);font-size:18px!important;font-weight:900;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp694-lead-copy em{display:block;color:var(--muted);font-style:normal;font-size:12px!important;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp694-lead-copy small{display:block;color:rgba(227,245,249,.76);font-size:13px!important;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cp694-lead-status{justify-self:end;display:inline-flex;align-items:center;justify-content:center;min-width:58px;max-width:66px;padding:6px 7px;border-radius:999px;border:1px solid rgba(255,98,88,.38);background:rgba(255,98,88,.06);color:var(--lime);font-size:10.5px!important;font-weight:900;line-height:1;white-space:nowrap}.cp694-lead-row.normal .cp694-lead-status,.cp694-lead-row.low .cp694-lead-status{border-color:rgba(255,255,255,.13);color:var(--muted);background:rgba(255,255,255,.03)}
    .cp694-empty{padding:22px;color:var(--muted);display:flex;flex-direction:column;gap:6px}.cp694-empty b{color:var(--text)}
    .cp-bottom-nav .nav-inner,.bottom-nav .nav-inner{height:58px!important;align-items:center!important}.cp-bottom-nav .nav.fab,.bottom-nav .nav.fab{position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;overflow:visible!important}.cp-bottom-nav .nav.fab .fab-btn,.bottom-nav .nav.fab .fab-btn{position:static!important;left:auto!important;top:auto!important;transform:none!important;width:38px!important;height:38px!important;margin:0 auto!important;border-width:3px!important;font-size:24px!important;line-height:1!important;box-shadow:0 6px 14px rgba(0,0,0,.28)!important;z-index:1!important}.cp-bottom-nav .nav.fab .lbl,.bottom-nav .nav.fab .lbl{display:none!important;visibility:hidden!important}
    #btnVoltarTopo{display:none!important}.cp694-loading{min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--text);text-align:center}.cp694-loading span{color:var(--muted);font-size:14px}.cp694-loading button{margin-top:10px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.04);color:var(--text);padding:10px 16px;font-weight:900}.cp694-spinner{width:30px;height:30px;border-radius:999px;border:3px solid rgba(255,255,255,.16);border-top-color:var(--lime);animation:cp694spin .8s linear infinite}@keyframes cp694spin{to{transform:rotate(360deg)}}
    @media(max-width:760px){.screen#carteira.active,.screen#pipeline.active{padding:18px 24px calc(96px + env(safe-area-inset-bottom,0px))!important;overflow:visible!important;height:auto!important;max-height:none!important}#carteiraBody{padding:0 6px!important}.cp694-atendimentos{padding-bottom:calc(138px + env(safe-area-inset-bottom,0px))}.cp694-lista{margin-bottom:calc(132px + env(safe-area-inset-bottom,0px))}}
  `;
  document.head.appendChild(css);
})();


/* ============================================================
   Atualização #724-2 — Correção real da lista mobile
   - Remove janela/virtualização na tela mobile onde os leads estavam sumindo.
   - Pipeline e Atendimentos usam rolagem natural da página, sem lista interna.
   - Botão + fica dentro da barra inferior, alinhado aos demais ícones.
   ============================================================ */
(function(){
  if(window.__cp695RealMobileFix) return;
  window.__cp695RealMobileFix = true;
  const VERSION = '__VERSION__';
  try{ window.CORRETOR_PRO_VERSION = VERSION; }catch(_){}

  function esc(v){
    try{ return escapeHtml(String(v ?? '')); }
    catch(_){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function idJs(l){ return JSON.stringify(String(l?.id || '')); }
  function activeItems(){
    const arr = Array.isArray(state?.carteiraLeads) && state.carteiraLeads.length ? state.carteiraLeads :
      (Array.isArray(state?.itemsAtivos) && state.itemsAtivos.length ? state.itemsAtivos :
      (Array.isArray(state?.todosLeads) ? state.todosLeads : []));
    return arr.filter(l=>{
      const e = typeof normalizarEtapa === 'function' ? normalizarEtapa(l?.etapa) : String(l?.etapa || '');
      return e !== 'Vendido' && e !== 'Perdido' && e !== 'Geladeira';
    });
  }
  function sortedLeads(list){
    if(typeof cp786OrdenarConducao==='function') return cp786OrdenarConducao(list||[]);
    return (list||[]).map(l=>({ ...l, _s: typeof scoreRankingHoje === 'function' ? scoreRankingHoje(l) : 0 }))
      .sort(typeof compararPrioridadeAtendimento === 'function' ? compararPrioridadeAtendimento : (()=>0));
  }
  function etapaProduto(l){
    const p = String(l?.product || '').trim();
    return p || 'Produto não identificado';
  }
  function resumoAcao(l){ return cp786ResumoAcao(l); }
  function badge(l){ return cp786Badge(l); }
  function cls(l){ return cp786Classe(l); }
  function row(l){
    return `<button type="button" class="cp695-lead-row ${cls(l)}" onclick='abrirLead(${idJs(l)})'>
      <span class="cp695-copy"><b>${esc(l?.name || 'Cliente')}</b><em>${esc(etapaProduto(l))}</em><small>${esc(resumoAcao(l))}</small></span>
      <span class="cp695-status">${esc(badge(l))}</span>
      <span class="cp695-chevron">›</span>
    </button>`;
  }

  function fixVersion(){
    document.querySelectorAll('.sb-brand small,.cp-brand small,.brand small,[data-version]').forEach(el=>{
      const txt = el.textContent || '';
      if(/Atualiza[cç][aã]o\s*#/i.test(txt)) el.textContent = txt.replace(/Atualiza[cç][aã]o\s*#\d+(?:-\d+)?/i,'Atualização #__VERSION__');
    });
  }
  function fixFab(){
    document.querySelectorAll('.cp-bottom-nav .nav.fab,.bottom-nav .nav.fab').forEach(el=>{
      el.style.setProperty('position','relative','important');
      el.style.setProperty('height','56px','important');
      el.style.setProperty('min-height','56px','important');
      el.style.setProperty('display','flex','important');
      el.style.setProperty('align-items','center','important');
      el.style.setProperty('justify-content','center','important');
      el.style.setProperty('padding','0','important');
      el.style.setProperty('transform','none','important');
    });
    document.querySelectorAll('.cp-bottom-nav .nav.fab .fab-btn,.bottom-nav .nav.fab .fab-btn').forEach(el=>{
      el.removeAttribute('style');
      el.style.setProperty('position','relative','important');
      el.style.setProperty('top','0','important');
      el.style.setProperty('left','0','important');
      el.style.setProperty('transform','none','important');
      el.style.setProperty('width','34px','important');
      el.style.setProperty('height','34px','important');
      el.style.setProperty('margin','0','important');
      el.style.setProperty('border','2px solid var(--cp-shell, var(--bg))','important');
      el.style.setProperty('border-radius','999px','important');
      el.style.setProperty('font-size','23px','important');
      el.style.setProperty('font-weight','500','important');
      el.style.setProperty('line-height','1','important');
      el.style.setProperty('box-shadow','0 5px 12px rgba(0,0,0,.22)','important');
    });
  }
  function fixScrollContainers(){
    document.querySelectorAll('#carteira,#carteiraBody,#pipeline,#pipelineBoard,.ui-priority-list,.ui-pipeline-list,.cp-virtual-wrap,.cp-virtual-inner,.cp694-lista,.cp695-list').forEach(el=>{
      el.style.setProperty('height','auto','important');
      el.style.setProperty('max-height','none','important');
      el.style.setProperty('overflow','visible','important');
      el.style.setProperty('overflow-y','visible','important');
      el.style.setProperty('contain','none','important');
      el.style.setProperty('transform','none','important');
    });
  }
  function fixLayout(){ fixVersion(); fixFab(); fixScrollContainers(); }

  window.renderCarteiraTabela = function(){
    const box = document.querySelector('#carteiraBody');
    if(!box) return;
    const lista = sortedLeads(activeItems());
    box.innerHTML = `<section class="cp695-atendimentos">
      <header class="cp695-head"><h2>Atendimentos</h2><p>Prioridade de atendimento, de cima para baixo.</p></header>
      <div class="cp695-list">${lista.length ? lista.map(row).join('') : '<div class="cp695-empty">Nenhum atendimento agora.</div>'}</div>
    </section>`;
    requestAnimationFrame(fixLayout);
  };
  try{ renderCarteiraTabela = window.renderCarteiraTabela; }catch(_){}

  window.setCarteiraFiltro = function(){
    state.carteiraFiltro = 'todos';
    if(state.active !== 'carteira' && typeof show === 'function') show('carteira');
    else window.renderCarteiraTabela();
  };

  window.carregarPipeline = async function(){
    if(state.active !== 'pipeline') return;
    const board = document.querySelector('#pipelineBoard');
    if(!board) return;
    const render = (data) => {
      const all = (data?.items || []).map(typeof limparLead === 'function' ? limparLead : (x=>x)).filter(typeof leadEhAtivo === 'function' ? leadEhAtivo : (()=>true));
      const grupos = {agora:[],respondeu:[],programados:[],aguardando:[]};
      for(const l of all){ const c=cp786Categoria(l); if(grupos[c]) grupos[c].push(l); }
      const filtrosValidos=['agora','programados','aguardando'];
      const filtro = filtrosValidos.includes(state.pipelineVisualFiltro)?state.pipelineVisualFiltro:'agora';
      state.pipelineVisualFiltro=filtro;
      const lista = sortedLeads(grupos[filtro]);
      const tabs=[['agora','Fazer agora'],['programados','Agenda'],['aguardando','Aguardando cliente']];
      const listRows = lista.length ? lista.map(row).join('') : '<div class="cp695-empty">Nenhuma ação pendente nesta visão.</div>';
      board.innerHTML=`
        <div class="ui-pipeline-kpis cp786-action-kpis">
          <div class="ui-kpi ${filtro==='agora'?'active':''}" role="button" tabindex="0" onclick="setPipelineVisualFiltro('agora')"><span>Fazer agora</span><div><b>${grupos.agora.length}</b><i>${typeof ui631Icon==='function'?ui631Icon('resposta'):''}</i></div></div>
          <div class="ui-kpi ${filtro==='programados'?'active':''}" role="button" tabindex="0" onclick="setPipelineVisualFiltro('programados')"><span>Agenda</span><div><b>${grupos.programados.length}</b><i>${typeof ui631Icon==='function'?ui631Icon('compromisso'):''}</i></div></div>
          <div class="ui-kpi ${filtro==='aguardando'?'active':''}" role="button" tabindex="0" onclick="setPipelineVisualFiltro('aguardando')"><span>Aguardando cliente</span><div><b>${grupos.aguardando.length}</b><i>${typeof ui631Icon==='function'?ui631Icon('ativos'):''}</i></div></div>
        </div>
        <div class="ui-filter-tabs cp786-action-tabs">${tabs.map(([k,t])=>`<button type="button" class="${k===filtro?'active':''}" onclick="setPipelineVisualFiltro('${k}')">${t}</button>`).join('')}</div>
        <section class="ui-priority-card ui-pipeline-list"><div class="ui-section-head"><div><h3>Próximas ações</h3><p>O Corretor Pro ordenou quem precisa de você primeiro.</p></div><button type="button" onclick="reanalisarTudo()">↻ Atualizar leitura</button></div><div class="ui-priority-list cp695-list">${listRows}</div></section>`;
      requestAnimationFrame(fixLayout);
    };
    const emMemoria = [state.todosLeads, state.itemsAtivos, state.carteiraLeads].find(a=>Array.isArray(a)&&a.length);
    if(emMemoria) render({items:emMemoria});
    else { board.innerHTML='<div class="cp695-loading">Lendo sua carteira...</div>'; try{ render(await getLeadsData()); }catch(e){ board.innerHTML = typeof boxErro==='function'?boxErro('carregarPipeline()'):'<div class="empty">Falha ao carregar.</div>'; } }
  };
  try{ carregarPipeline = window.carregarPipeline; }catch(_){}

  window.setPipelineVisualFiltro = function(f){
    state.pipelineVisualFiltro = f || 'agora';
    if(state.active !== 'pipeline' && typeof show === 'function') show('pipeline');
    else window.carregarPipeline();
  };

  const css=document.createElement('style');
  css.id='cp695RealMobileFixCSS';
  css.textContent=`
    html,body{height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;scroll-behavior:auto!important}
    .main-col,.desktop-layout,.app,.screen,#home,#carteira,#pipeline,#carteiraBody,#pipelineBoard,.ui-priority-list,.ui-pipeline-list,.cp-virtual-wrap,.cp-virtual-inner,.cp694-lista,.cp695-list{height:auto!important;max-height:none!important;overflow:visible!important;overflow-y:visible!important;contain:none!important;transform:none!important;will-change:auto!important}
    .cp-virtual-wrap>div[style*="height"],.cp-virtual-pad{display:none!important;height:0!important}
    #carteira .cart-filtros,#carteira .cart-export,#carteira .cart-head,#carteira .cart-table,#carteira .cart-thead,#carteira .cp689-att-page,#carteira .cp690-att-page,#carteira .cp691-att-page,#carteira .cp693-page,#carteira .cp694-atendimentos{display:none!important}
    .cp695-atendimentos,.cp695-list{max-width:760px;margin-left:auto;margin-right:auto}.cp695-atendimentos{padding-bottom:calc(122px + env(safe-area-inset-bottom,0px))}.cp695-head{margin:0 0 14px}.cp695-head h2{margin:0;color:var(--text);font-size:30px!important;line-height:1;font-weight:950;letter-spacing:-.04em}.cp695-head p{margin:8px 0 0;color:var(--muted);font-size:14px!important;line-height:1.35}
    .cp695-list{display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.10);border-radius:17px;background:rgba(7,52,64,.58);margin-bottom:calc(128px + env(safe-area-inset-bottom,0px));overflow:visible!important}.cp695-lead-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto 10px;align-items:center;gap:9px;min-height:70px;padding:11px 9px 11px 17px;border:0;border-bottom:1px solid rgba(255,255,255,.08);background:transparent;color:var(--text);font:inherit;text-align:left;position:relative;cursor:pointer}.cp695-lead-row:last-child{border-bottom:0}.cp695-lead-row:before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 999px 999px 0;background:transparent}.cp695-lead-row.hot:before{background:var(--lime)}.cp695-lead-row.warm:before{background:var(--morno)}.cp695-copy{min-width:0;display:flex;flex-direction:column;gap:3px}.cp695-copy b{color:var(--text);font-size:18px!important;font-weight:900;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp695-copy em{color:var(--muted);font-style:normal;font-size:12px!important;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp695-copy small{color:rgba(227,245,249,.75);font-size:13px!important;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp695-status{display:inline-flex;align-items:center;justify-content:center;min-width:56px;max-width:64px;padding:6px 7px;border-radius:999px;border:1px solid rgba(255,98,88,.38);background:rgba(255,98,88,.06);color:var(--lime);font-size:10.5px!important;font-weight:900;line-height:1;white-space:nowrap}.cp695-lead-row.low .cp695-status,.cp695-lead-row.normal .cp695-status{border-color:rgba(255,255,255,.13);color:var(--muted);background:rgba(255,255,255,.03)}.cp695-chevron{color:var(--muted);font-size:18px}.cp695-empty,.cp695-loading{padding:22px;color:var(--muted);text-align:center}
    .cp-bottom-nav{z-index:1000!important}.cp-bottom-nav .nav-inner,.bottom-nav .nav-inner{height:58px!important;align-items:center!important}.cp-bottom-nav .nav.fab,.bottom-nav .nav.fab{position:relative!important;height:56px!important;min-height:56px!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;overflow:visible!important;transform:none!important}.cp-bottom-nav .nav.fab .fab-btn,.bottom-nav .nav.fab .fab-btn{position:relative!important;top:0!important;left:0!important;transform:none!important;width:34px!important;height:34px!important;margin:0!important;border-width:2px!important;font-size:23px!important;font-weight:500!important;line-height:1!important;box-shadow:0 5px 12px rgba(0,0,0,.22)!important;z-index:1!important}.cp-bottom-nav .nav.fab .lbl,.bottom-nav .nav.fab .lbl{display:none!important;visibility:hidden!important}
    #btnVoltarTopo{display:none!important}
    @media(max-width:760px){.screen#carteira.active,.screen#pipeline.active{padding:18px 24px calc(96px + env(safe-area-inset-bottom,0px))!important;overflow:visible!important;height:auto!important;max-height:none!important}#carteiraBody{padding:0 6px!important}.ui-priority-card{padding:15px!important}.ui-pipeline-grid{display:block!important}.ui-pipe-summary{margin-top:12px!important}.cp695-list{margin-bottom:calc(132px + env(safe-area-inset-bottom,0px))}.cp695-copy b{font-size:17px!important}.cp695-copy small{font-size:12.5px!important}.cp695-lead-row{min-height:68px}}
  `;
  document.head.appendChild(css);

  document.addEventListener('DOMContentLoaded', fixLayout);
  window.addEventListener('resize', fixLayout);
  setTimeout(fixLayout,60); setTimeout(fixLayout,300); setTimeout(fixLayout,1000);
  const oldShow = window.show;
  if(typeof oldShow === 'function'){
    window.show = function(){ const out = oldShow.apply(this, arguments); setTimeout(()=>{ if(state.active==='carteira') window.renderCarteiraTabela(); if(state.active==='pipeline') window.carregarPipeline(); fixLayout(); }, 40); return out; };
  }
})();


/* ============================================================
   Atualização #724-2 — Correção definitiva carregamento total Atendimentos
   - A tela Atendimentos não pode depender de state.carteiraLeads truncado.
   - Busca a base completa em /api/leads-recentes?limit=2000 e renderiza todos.
   - Mantém rolagem natural da página, sem virtualização nem janela no mobile.
   ============================================================ */
(function(){
  if(window.__cp696AtendimentosFullList) return;
  window.__cp696AtendimentosFullList = true;
  const VERSION = '__VERSION__';
  try{ window.CORRETOR_PRO_VERSION = VERSION; }catch(_){}

  function esc(v){
    try{ return escapeHtml(String(v ?? '')); }
    catch(_){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function normalEtapa(l){
    try{ return normalizarEtapa(l?.etapa); }catch(_){ return String(l?.etapa || 'Atendimento'); }
  }
  function isAtivo(l){
    const e = normalEtapa(l);
    return e !== 'Vendido' && e !== 'Perdido' && e !== 'Geladeira';
  }
  function sortLeads(list){
    const arr = Array.isArray(list) ? list.slice() : [];
    try{ return arr.map(l=>({ ...l, _s: scoreRankingHoje(l) })).sort(compararPrioridadeAtendimento); }
    catch(_){ return arr; }
  }
  function meta(l){
    const p = String(l?.product || '').trim() || 'Produto não identificado';
    const dias = Number(l?.daysSinceLastInteraction || l?.diasSemResposta || 0);
    const d = dias > 0 ? ` · ${dias}d` : '';
    return `${p}${d}`;
  }
  function acao(l){
    const raw = String(l?.nextAction || (typeof motivoCurto === 'function' ? motivoCurto(l) : '') || 'Abrir lead para conferir.').replace(/\s+/g,' ').trim();
    return raw.length > 74 ? raw.slice(0,71).trim() + '...' : raw;
  }
  function badge(l){
    let t = '';
    try{ t = String((prioridadeAtendimento(l)||{}).titulo || ''); }catch(_){}
    if(/atender/i.test(t)) return 'Atender';
    if(/retomar/i.test(t)) return 'Retomar';
    if(/aguardar/i.test(t)) return 'Aguardar';
    if(/sem/i.test(t)) return 'Sem ação';
    return t || 'Abrir';
  }
  function cls(l){
    let g = '';
    try{ g = String((prioridadeAtendimento(l)||{}).grupo || ''); }catch(_){}
    if(g === 'acao-hoje') return 'hot';
    if(g === 'retomar-cuidado') return 'warm';
    if(g === 'baixa-prioridade') return 'low';
    return 'normal';
  }
  function idJs(l){ return JSON.stringify(String(l?.id || '')); }
  function row(l){
    return `<button type="button" class="cp696-row ${cls(l)}" onclick='abrirLead(${idJs(l)})'>
      <span class="cp696-copy"><b>${esc(l?.name || 'Cliente')}</b><em>${esc(meta(l))}</em><small>${esc(acao(l))}</small></span>
      <span class="cp696-status">${esc(badge(l))}</span>
      <span class="cp696-chevron">›</span>
    </button>`;
  }
  function updateVersion(){
    document.querySelectorAll('.sb-brand small,.cp-brand small,.brand small,[data-version]').forEach(el=>{
      const txt = el.textContent || '';
      if(/Atualiza[cç][aã]o\s*#/i.test(txt)) el.textContent = txt.replace(/Atualiza[cç][aã]o\s*#\d+(?:-\d+)?/i,'Atualização #__VERSION__');
    });
  }
  function applyLayoutFixes(){
    updateVersion();
    document.querySelectorAll('#carteira,#carteiraBody,.cp696-list,.cp695-list,.ui-priority-list,.ui-pipeline-list,.cp-virtual-wrap,.cp-virtual-inner').forEach(el=>{
      el.style.setProperty('height','auto','important');
      el.style.setProperty('max-height','none','important');
      el.style.setProperty('overflow','visible','important');
      el.style.setProperty('overflow-y','visible','important');
      el.style.setProperty('contain','none','important');
    });
    document.querySelectorAll('.cp-bottom-nav .nav.fab,.bottom-nav .nav.fab').forEach(el=>{
      el.style.setProperty('position','relative','important');
      el.style.setProperty('display','flex','important');
      el.style.setProperty('align-items','center','important');
      el.style.setProperty('justify-content','center','important');
      el.style.setProperty('height','56px','important');
      el.style.setProperty('padding','0','important');
    });
    document.querySelectorAll('.cp-bottom-nav .nav.fab .fab-btn,.bottom-nav .nav.fab .fab-btn').forEach(el=>{
      el.style.setProperty('position','relative','important');
      el.style.setProperty('top','0','important');
      el.style.setProperty('left','0','important');
      el.style.setProperty('transform','none','important');
      el.style.setProperty('width','34px','important');
      el.style.setProperty('height','34px','important');
      el.style.setProperty('margin','0','important');
    });
  }
  async function fetchAllLeads(force){
    try{
      const data = await getLeadsData(!!force);
      if(data && Array.isArray(data.items) && data.items.length) return data.items;
    }catch(_){}
    try{
      const res = await fetch(`./api/leads-recentes?limit=2000${force?'&fresh=1':''}`, { cache:'no-store' });
      const data = await res.json();
      if(data && Array.isArray(data.items)) return data.items;
    }catch(_){}
    return [];
  }
  function renderAtendimentosCompleto(leads){
    const box = document.querySelector('#carteiraBody');
    if(!box) return;
    const lista = sortLeads((leads || []).filter(isAtivo));
    try{ state.carteiraLeads = lista; state.carteiraFiltro = 'todos'; }catch(_){}
    const rows = lista.length ? lista.map(row).join('') : '<div class="cp696-empty">Nenhum atendimento agora.</div>';
    box.innerHTML = `<section class="cp696-page">
      <header class="cp696-head"><h2>Atendimentos</h2><p>${lista.length} leads · prioridade de atendimento, de cima para baixo.</p></header>
      <div class="cp696-list">${rows}</div>
    </section>`;
    requestAnimationFrame(applyLayoutFixes);
  }
  window.carregarCarteira = async function(force){
    if(state.active !== 'carteira') return;
    const box = document.querySelector('#carteiraBody');
    if(!box) return;
    box.innerHTML = '<div class="cp696-loading"><i></i><b>Carregando atendimentos...</b><span>Buscando toda sua carteira de leads.</span></div>';
    const leads = await fetchAllLeads(force);
    renderAtendimentosCompleto(leads);
  };
  try{ carregarCarteira = window.carregarCarteira; }catch(_){}
  window.renderCarteiraTabela = function(){
    const sources = [state?.todosLeads, state?.itemsAtivos, state?.carteiraLeads].filter(a=>Array.isArray(a));
    const biggest = sources.sort((a,b)=>b.length-a.length)[0] || [];
    if(biggest.length >= 80) renderAtendimentosCompleto(biggest);
    else window.carregarCarteira(false);
  };
  try{ renderCarteiraTabela = window.renderCarteiraTabela; }catch(_){}
  window.setCarteiraFiltro = function(){
    try{ state.carteiraFiltro = 'todos'; }catch(_){}
    if(typeof show === 'function' && state.active !== 'carteira') show('carteira');
    else window.carregarCarteira(false);
  };
  const oldShow = window.show;
  if(typeof oldShow === 'function'){
    window.show = function(name, ...args){
      const ret = oldShow.apply(this, [name, ...args]);
      if(name === 'carteira') setTimeout(()=>window.carregarCarteira(false), 0);
      else setTimeout(applyLayoutFixes, 0);
      return ret;
    };
    try{ show = window.show; }catch(_){}
  }
  const css = document.createElement('style');
  css.id = 'cp696AtendimentosFullCSS';
  css.textContent = `
    html,body{height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;scroll-behavior:auto!important}.main-col,.desktop-layout,.app,.screen,#carteira,#carteiraBody,.cp696-page,.cp696-list{height:auto!important;max-height:none!important;overflow:visible!important;overflow-y:visible!important;contain:none!important;transform:none!important;will-change:auto!important}.cp-virtual-wrap>div[style*="height"],.cp-virtual-pad{display:none!important;height:0!important}#carteira .cart-filtros,#carteira .cart-export,#carteira .cart-head,#carteira .cart-table,#carteira .cart-thead,#carteira .cp689-att-page,#carteira .cp690-att-page,#carteira .cp691-att-page,#carteira .cp693-page,#carteira .cp694-atendimentos,#carteira .cp695-atendimentos{display:none!important}.cp696-page{max-width:760px;margin:0 auto;padding-bottom:calc(128px + env(safe-area-inset-bottom,0px))}.cp696-head{margin:0 0 14px}.cp696-head h2{margin:0;color:var(--text);font-size:30px!important;line-height:1;font-weight:950;letter-spacing:-.04em}.cp696-head p{margin:8px 0 0;color:var(--muted);font-size:14px!important;line-height:1.35}.cp696-list{display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.10);border-radius:17px;background:rgba(7,52,64,.58);margin-bottom:calc(128px + env(safe-area-inset-bottom,0px));overflow:visible!important}.cp696-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto 10px;align-items:center;gap:9px;min-height:66px;padding:10px 9px 10px 17px;border:0;border-bottom:1px solid rgba(255,255,255,.08);background:transparent;color:var(--text);font:inherit;text-align:left;position:relative;cursor:pointer}.cp696-row:last-child{border-bottom:0}.cp696-row:before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 999px 999px 0;background:transparent}.cp696-row.hot:before{background:var(--lime)}.cp696-row.warm:before{background:var(--morno)}.cp696-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.cp696-copy b{color:var(--text);font-size:17px!important;font-weight:900;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp696-copy em{color:var(--muted);font-style:normal;font-size:12px!important;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp696-copy small{color:rgba(227,245,249,.75);font-size:12.5px!important;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp696-status{display:inline-flex;align-items:center;justify-content:center;min-width:54px;max-width:62px;padding:6px 7px;border-radius:999px;border:1px solid rgba(255,98,88,.38);background:rgba(255,98,88,.06);color:var(--lime);font-size:10.5px!important;font-weight:900;line-height:1;white-space:nowrap}.cp696-row.low .cp696-status,.cp696-row.normal .cp696-status{border-color:rgba(255,255,255,.13);color:var(--muted);background:rgba(255,255,255,.03)}.cp696-chevron{color:var(--muted);font-size:18px}.cp696-empty,.cp696-loading{padding:24px;color:var(--muted);text-align:center}.cp696-loading{min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}.cp696-loading b{color:var(--text)}.cp696-loading i{width:30px;height:30px;border-radius:999px;border:3px solid rgba(255,255,255,.16);border-top-color:var(--lime);animation:cp696spin .8s linear infinite}@keyframes cp696spin{to{transform:rotate(360deg)}}.cp-bottom-nav .nav-inner,.bottom-nav .nav-inner{height:58px!important;align-items:center!important}.cp-bottom-nav .nav.fab,.bottom-nav .nav.fab{position:relative!important;height:56px!important;min-height:56px!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;overflow:visible!important;transform:none!important}.cp-bottom-nav .nav.fab .fab-btn,.bottom-nav .nav.fab .fab-btn{position:relative!important;top:0!important;left:0!important;transform:none!important;width:34px!important;height:34px!important;margin:0!important;border-width:2px!important;font-size:23px!important;font-weight:500!important;line-height:1!important;box-shadow:0 5px 12px rgba(0,0,0,.22)!important;z-index:1!important}.cp-bottom-nav .nav.fab .lbl,.bottom-nav .nav.fab .lbl{display:none!important;visibility:hidden!important}#btnVoltarTopo{display:none!important}@media(max-width:760px){.screen#carteira.active{padding:18px 24px calc(96px + env(safe-area-inset-bottom,0px))!important;overflow:visible!important;height:auto!important;max-height:none!important}#carteiraBody{padding:0 6px!important}.cp696-page{padding-bottom:calc(136px + env(safe-area-inset-bottom,0px))}.cp696-list{margin-bottom:calc(136px + env(safe-area-inset-bottom,0px))}}
  `;
  document.head.appendChild(css);
  document.addEventListener('DOMContentLoaded', applyLayoutFixes);
  window.addEventListener('resize', applyLayoutFixes);
  setTimeout(applyLayoutFixes,50); setTimeout(applyLayoutFixes,250); setTimeout(applyLayoutFixes,1000);
  if(state?.active === 'carteira') setTimeout(()=>window.carregarCarteira(false),0);
})();


/* ============================================================
   Atualização #724-2 — Preparação da Carteira
   - Separa leads sem histórico/análise de leads prontos.
   - Importação de ZIP já deixa o lead marcado como pronto quando houver histórico + análise.
   - Home mostra progresso da preparação.
   - Atendimentos ganha visão Preparação / Prontos / Todos sem quebrar a rolagem natural.
   ============================================================ */
(function(){
  if(window.__cp697PreparacaoCarteira) return;
  window.__cp697PreparacaoCarteira = true;
  const VERSION = '__VERSION__';
  try{ window.CORRETOR_PRO_VERSION = VERSION; }catch(_){ }

  function esc(v){
    try { return escapeHtml(String(v ?? '')); }
    catch(_) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function idJs(l){ return JSON.stringify(String(l?.id || '')); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function normalEtapa(l){
    try{ return normalizarEtapa(l?.etapa); }catch(_){ return String(l?.etapa || 'Atendimento'); }
  }
  function isAtivo697(l){
    const e = normalEtapa(l);
    return e !== 'Vendido' && e !== 'Perdido' && e !== 'Geladeira';
  }
  function recentCount(l){
    const candidates = [l?.recentMessages, l?.timeline, l?.messages, l?.history, l?.mensagens].filter(Array.isArray);
    const n = candidates.reduce((m,a)=>Math.max(m,a.length),0);
    const extra = Number(l?.historyCount || l?.messageCount || l?.totalMessages || l?.totalMensagens || 0) || 0;
    return Math.max(n, extra);
  }
  function hasAnalysis697(l){
    const a = l?.analysis || l?.analise || l?.diagnostico || {};
    if(!a || typeof a !== 'object') return false;
    if(a.error) return false;
    if(a.messages && typeof a.messages === 'object' && (a.messages.a || a.messages.b || a.messages.c)) return true;
    if(a.analiseComercial && typeof a.analiseComercial === 'object') return true;
    if(a.nextAction || a.proximaAcao || a.resumo) return true;
    return !!(l?.nextAction && recentCount(l) > 0);
  }
  function isReady697(l){
    return recentCount(l) > 0 && hasAnalysis697(l);
  }
  function leadStage697(l){
    return isReady697(l) ? 'pronto' : 'preparacao';
  }
  function sort697(list,meta){
    if(typeof cp786OrdenarConducao==='function') return cp786OrdenarConducao(list,meta);
    const copy=list.slice();
    if(typeof compararPrioridadeAtendimento==='function') return copy.sort(compararPrioridadeAtendimento);
    return copy.sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'pt-BR'));
  }
  function meta697(l){
    const p=String(l?.product||'').trim()||'Produto não identificado';
    const dias=Number(l?.daysSinceLastInteraction||0);
    return dias>0?`${p} · ${dias}d`:`${p}`;
  }
  function row697(l,m){
    const meta=m||cp786MetaConducao(l);
    const cls=['agora','respondeu'].includes(meta.categoria)?'ready':'pending';
    return `<button type="button" class="cp697-row ${cls}" onclick='abrirLead(${idJs(l)})'>
      <span class="cp697-copy"><b>${esc(l?.name || 'Cliente')}</b><em>${esc(meta697(l))}</em><small>${esc(meta.resumo)}</small></span>
      <span class="cp697-status">${esc(meta.badge)}</span><span class="cp697-chevron">›</span>
    </button>`;
  }
  function updateVersion697(){
    document.querySelectorAll('.sb-brand small,.cp-brand small,.brand small,[data-version]').forEach(el=>{
      const txt = el.textContent || '';
      if(/Atualiza[cç][aã]o\s*#/i.test(txt)) el.textContent = txt.replace(/Atualiza[cç][aã]o\s*#\d+(?:-\d+)?/i,'Atualização #__VERSION__');
    });
  }
  async function fetchAll697(force){
    try{
      if(typeof getLeadsData === 'function'){
        const data = await getLeadsData(!!force);
        if(Array.isArray(data?.items) && data.items.length) return data.items;
      }
    }catch(_){ }
    try{
      const res = await fetch(`./api/leads-recentes?limit=2000${force?'&fresh=1':''}`, { cache:'no-store' });
      const data = await res.json().catch(()=>null);
      if(Array.isArray(data?.items)) return data.items;
    }catch(_){ }
    return [];
  }
  function currentTab697(){ return String(window.cp697Tab || localStorage.getItem('cp697Tab') || 'preparacao'); }
  function setTab697(tab){ window.cp697Tab = tab; try{ localStorage.setItem('cp697Tab', tab); }catch(_){ } renderCarteiraTabela(); }
  window.cp697SetTab = setTab697;

  function renderCarteira697(leads){
    const box=document.querySelector('#carteiraBody');
    if(!box) return;
    const base=(leads||[]).filter(isAtivo697);
    const meta=new Map(base.map(l=>[l,cp786MetaConducao(l)]));
    const ativos=sort697(base,meta);
    const rows=ativos.length?ativos.map(l=>row697(l,meta.get(l))).join(''):'<div class="cp697-empty"><b>Nenhum atendimento ativo.</b><span>Importe uma conversa ou inclua um cliente manualmente.</span></div>';
    try{state.carteiraLeads=ativos;state.todosLeads=Array.isArray(state.todosLeads)&&state.todosLeads.length?state.todosLeads:ativos;}catch(_){}
    box.innerHTML=`<section class="cp697-page">
      <header class="cp697-head"><h2>Atendimentos</h2><p>${ativos.length} cliente${ativos.length===1?' ativo':'s ativos'} · a próxima ação aparece em cada atendimento.</p></header>
      <div class="cp697-list">${rows}</div>
    </section>`;
    requestAnimationFrame(applyFix697);
  }
  window.cp697RenderCarteira = renderCarteira697;
  window.carregarCarteira = async function(force){
    const box = document.querySelector('#carteiraBody');
    if(box){ box.innerHTML = '<div class="cp697-loading"><i></i><b>Carregando atendimentos...</b><span>Organizando a próxima ação de cada cliente.</span></div>'; }
    const leads = await fetchAll697(!!force);
    renderCarteira697(leads);
  };
  try{ carregarCarteira = window.carregarCarteira; }catch(_){ }
  window.renderCarteiraTabela = function(){
    const sources = [state?.todosLeads, state?.itemsAtivos, state?.carteiraLeads].filter(Array.isArray);
    const biggest = sources.sort((a,b)=>b.length-a.length)[0] || [];
    if(biggest.length >= 20) renderCarteira697(biggest); else window.carregarCarteira(false);
  };
  try{ renderCarteiraTabela = window.renderCarteiraTabela; }catch(_){ }

  function homeProgress697(){
    // Bloco "Preparação da carteira" removido da Home (a pedido) — carteira já está em dia.
    const antigo = document.getElementById('cp697HomeProgress');
    if(antigo && antigo.parentNode) antigo.parentNode.removeChild(antigo);
  }

  const oldShow = window.show;
  if(typeof oldShow === 'function' && !oldShow.__cp697Wrapped){
    const wrapped = function(name, ...args){
      const ret = oldShow.apply(this, [name, ...args]);
      if(name === 'carteira') setTimeout(()=>window.carregarCarteira(false), 0);
      setTimeout(()=>{ applyFix697(); homeProgress697(); }, 80);
      return ret;
    };
    wrapped.__cp697Wrapped = true;
    window.show = wrapped; try{ show = window.show; }catch(_){ }
  }

  const oldRefresh = window.refreshAllSections;
  if(typeof oldRefresh === 'function' && !oldRefresh.__cp697Wrapped){
    const wrappedRefresh = function(){
      const ret = oldRefresh.apply(this, arguments);
      setTimeout(()=>{ homeProgress697(); if(state?.active==='carteira') window.carregarCarteira(true); }, 250);
      return ret;
    };
    wrappedRefresh.__cp697Wrapped = true;
    window.refreshAllSections = wrappedRefresh; try{ refreshAllSections = window.refreshAllSections; }catch(_){ }
  }

  const oldFetch = window.fetch;
  window.fetch = async function(input, init){
    const res = await oldFetch.apply(this, arguments);
    try{
      const url = String(typeof input === 'string' ? input : (input?.url || ''));
      const body = init?.body ? String(init.body) : '';
      if(/lead-update|processar-storage|reanalisar-lead/i.test(url) && /salvar-novo|atualizar-com-evolucao|analisar|reanalisar/i.test(body + ' ' + url)){
        setTimeout(()=>{ window.carregarCarteira?.(true); homeProgress697(); }, 900);
      }
    }catch(_){ }
    return res;
  };

  function applyFix697(){
    updateVersion697();
    document.querySelectorAll('#carteira,#carteiraBody,.cp697-list,.cp696-list,.cp695-list,.cp694-lista,.cp-virtual-wrap,.cp-virtual-inner').forEach(el=>{
      el.style.setProperty('height','auto','important');
      el.style.setProperty('max-height','none','important');
      el.style.setProperty('overflow','visible','important');
      el.style.setProperty('overflow-y','visible','important');
      el.style.setProperty('contain','none','important');
    });
  }

  const css = document.createElement('style');
  css.id = 'cp697PreparacaoCSS';
  css.textContent = `
    .cp697-page{max-width:760px;margin:0 auto;padding-bottom:calc(130px + env(safe-area-inset-bottom,0px))}.cp697-head{margin:0 0 14px}.cp697-head h2{font-size:30px!important;line-height:1.02;margin:0 0 8px;color:var(--text);font-weight:950;letter-spacing:-.04em}.cp697-head p{font-size:14px!important;line-height:1.35;color:var(--muted);margin:0 0 14px}.cp697-progress{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.cp697-progress>div{padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.025)}.cp697-progress b{display:block;color:var(--text);font-size:22px;line-height:1;font-weight:950}.cp697-progress span{display:block;margin-top:4px;color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.cp697-tabs{display:flex;gap:8px;overflow-x:auto;margin:12px 0 14px;padding-bottom:2px}.cp697-tabs button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:var(--soft);border-radius:999px;padding:9px 12px;font-size:12px;font-weight:950;white-space:nowrap}.cp697-tabs button.active{background:var(--lime);border-color:var(--lime);color:#06262d}.cp697-tabs span{opacity:.75;margin-left:4px}.cp697-list{display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.10);border-radius:17px;background:rgba(7,52,64,.58);overflow:visible!important;margin-bottom:calc(130px + env(safe-area-inset-bottom,0px))}.cp697-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto 10px;gap:9px;align-items:center;min-height:66px;padding:10px 9px 10px 17px;border:0;border-bottom:1px solid rgba(255,255,255,.08);background:transparent;color:var(--text);font:inherit;text-align:left;position:relative}.cp697-row:last-child{border-bottom:0}.cp697-row:before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 999px 999px 0}.cp697-row.ready:before{background:#68ff95}.cp697-row.pending:before{background:rgba(255,155,59,.9)}.cp697-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.cp697-copy b{font-size:17px!important;line-height:1.08;font-weight:950;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp697-copy em{font-style:normal;color:var(--muted);font-size:12px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp697-copy small{color:rgba(227,245,249,.77);font-size:12.5px!important;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp697-status{display:inline-flex;align-items:center;justify-content:center;min-width:58px;padding:6px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.14);font-size:10.5px!important;font-weight:950;line-height:1;white-space:nowrap}.cp697-row.ready .cp697-status{border-color:rgba(104,255,149,.42);color:#68ff95;background:rgba(104,255,149,.07)}.cp697-row.pending .cp697-status{border-color:rgba(255,155,59,.45);color:#ffd09b;background:rgba(255,155,59,.07)}.cp697-chevron{color:var(--muted);font-size:18px}.cp697-empty,.cp697-loading{padding:24px;color:var(--muted);text-align:center;display:flex;flex-direction:column;gap:6px}.cp697-empty b,.cp697-loading b{color:var(--text)}.cp697-loading{min-height:240px;align-items:center;justify-content:center}.cp697-loading i{width:30px;height:30px;border-radius:999px;border:3px solid rgba(255,255,255,.16);border-top-color:var(--lime);animation:cp697spin .8s linear infinite}@keyframes cp697spin{to{transform:rotate(360deg)}}.cp697-home-progress{border:1px solid rgba(255,255,255,.10);border-radius:18px;background:rgba(7,52,64,.58);padding:16px;margin:14px 0}.cp697-home-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.cp697-home-title b{font-size:16px;color:var(--text)}.cp697-home-title button{border:1px solid rgba(255,98,88,.4);background:rgba(255,98,88,.07);color:var(--lime);border-radius:999px;padding:8px 12px;font-weight:950}.cp697-home-bar{height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.cp697-home-bar span{display:block;height:100%;background:linear-gradient(90deg,#FF6258,#68ff95);border-radius:999px}.cp697-home-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:9px;color:var(--muted);font-size:11px;font-weight:850}.screen#carteira.active,#carteiraBody{height:auto!important;max-height:none!important;overflow:visible!important;contain:none!important}@media(max-width:760px){.screen#carteira.active{padding:18px 24px calc(98px + env(safe-area-inset-bottom,0px))!important}.cp697-head h2{font-size:29px!important}.cp697-progress{grid-template-columns:repeat(3,minmax(0,1fr))}.cp697-progress b{font-size:20px}.cp697-list{margin-bottom:calc(140px + env(safe-area-inset-bottom,0px))}.cp697-page{padding-bottom:calc(140px + env(safe-area-inset-bottom,0px))}}
  `;
  document.head.appendChild(css);
  document.addEventListener('DOMContentLoaded', ()=>{ applyFix697(); setTimeout(homeProgress697, 300); });
  window.addEventListener('resize', applyFix697);
  setTimeout(()=>{ applyFix697(); homeProgress697(); }, 250);
  setTimeout(()=>{ applyFix697(); homeProgress697(); }, 1200);
  if(state?.active === 'carteira') setTimeout(()=>window.carregarCarteira(false),0);
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
  setInterval(fixVersionText, 2000);
})();



/* ============================================================
   Atualização #724-2 — estabilidade pós-cache
   - Apenas fixa o texto da versão, sem observer e sem interferir no carregamento.
   ============================================================ */
(function(){
  const VERSION='__VERSION__';
  try{ window.CORRETOR_PRO_VERSION = VERSION; }catch(_){ }
  function fix(){
    try{
      document.querySelectorAll('[data-version],.sb-brand small,.cp-brand small,.brand small,.mobile-brand small,.top-brand small,.app-brand small,small').forEach(el=>{
        const txt=el.textContent||'';
        if(/Atualiza[cç][aã]o\s*#/i.test(txt)) el.textContent = txt.replace(/Atualiza[cç][aã]o\s*#\d+(?:-\d+)?/i,'Atualização #__VERSION__');
      });
    }catch(_){ }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fix); else fix();
  window.addEventListener('load', fix);
  setTimeout(fix, 300);
  setTimeout(fix, 1200);
})();


/* ============================================================
   Atualização #724-2 — Preparação da Carteira estável
   - O bloco Preparação da carteira não depende mais de cache parcial.
   - Aparece sempre que a Home abre e só atualiza quando a base completa chega.
   - Evita alternância/sumiço durante redesenhos da Home.
   ============================================================ */
(function(){
  if(window.__cp703PreparacaoEstavel) return;
  window.__cp703PreparacaoEstavel = true;
  const VERSION = '__VERSION__';
  try{ window.CORRETOR_PRO_VERSION = VERSION; }catch(_){ }

  let fullLeadsCache = null;
  let fullLeadsLoading = null;
  let lastHtml = '';
  let scheduled = false;

  function qs(sel){ return document.querySelector(sel); }
  function activeHome(){ return (window.state?.active || 'home') === 'home'; }
  function textVersion(){
    try{
      document.querySelectorAll('[data-version],.sb-brand small,.cp-brand small,.brand small,.mobile-brand small,.top-brand small,.app-brand small,small').forEach(el=>{
        const txt = el.textContent || '';
        if(/Atualiza[cç][aã]o\s*#/i.test(txt)) el.textContent = txt.replace(/Atualiza[cç][aã]o\s*#\d+(?:-\d+)?/i, 'Atualização #__VERSION__');
      });
    }catch(_){ }
  }
  function normalizeStage(l){
    try{ return normalizarEtapa(l?.etapa); }catch(_){ return String(l?.etapa || 'Atendimento'); }
  }
  function isActiveLead(l){
    const e = normalizeStage(l);
    return e !== 'Vendido' && e !== 'Perdido' && e !== 'Geladeira';
  }
  function msgCount(l){
    const arrays = [l?.recentMessages, l?.timeline, l?.messages, l?.history, l?.mensagens].filter(Array.isArray);
    const maxArr = arrays.reduce((m,a)=>Math.max(m,a.length),0);
    const n = Number(l?.historyCount || l?.messageCount || l?.totalMessages || l?.totalMensagens || 0) || 0;
    return Math.max(maxArr,n);
  }
  function hasAnalysis(l){
    const a = l?.analysis || l?.analise || l?.diagnostico || {};
    if(!a || typeof a !== 'object' || a.error) return false;
    if(a.messages && typeof a.messages === 'object' && (a.messages.a || a.messages.b || a.messages.c)) return true;
    if(a.analiseComercial && typeof a.analiseComercial === 'object') return true;
    if(a.nextAction || a.proximaAcao || a.resumo) return true;
    return !!(l?.nextAction && msgCount(l) > 0);
  }
  function readyLead(l){ return msgCount(l) > 0 && hasAnalysis(l); }
  function bestLocalLeads(){
    const lists = [window.state?.todosLeads, window.state?.itemsAtivos, window.state?.carteiraLeads, window.state?.leads].filter(Array.isArray);
    return (lists.sort((a,b)=>b.length-a.length)[0] || []).slice();
  }
  async function loadFullLeads(force){
    const local = bestLocalLeads();
    if(!force && local.length >= 100){
      fullLeadsCache = local;
      return local;
    }
    if(!force && Array.isArray(fullLeadsCache) && fullLeadsCache.length) return fullLeadsCache;
    if(fullLeadsLoading) return fullLeadsLoading;
    fullLeadsLoading = (async()=>{
      try{
        if(typeof getLeadsData === 'function'){
          const data = await getLeadsData(!!force);
          if(Array.isArray(data?.items) && data.items.length){
            fullLeadsCache = data.items;
            try{ window.state.todosLeads = data.items; }catch(_){ }
            return data.items;
          }
        }
      }catch(_){ }
      try{
        const res = await fetch('./api/leads-recentes?limit=2000&fresh=1&_v=709&_t=' + Date.now(), {cache:'no-store'});
        const data = await res.json().catch(()=>null);
        const items = Array.isArray(data?.items) ? data.items : [];
        if(items.length){
          fullLeadsCache = items;
          try{ window.state.todosLeads = items; }catch(_){ }
        }
        return items;
      }catch(_){ return local; }
      finally{ fullLeadsLoading = null; }
    })();
    return fullLeadsLoading;
  }
  function cardHtml(leads, loading){
    const ativos = (leads || []).filter(isActiveLead);
    const ready = ativos.filter(readyLead).length;
    const pending = Math.max(0, ativos.length - ready);
    const pct = ativos.length ? Math.round((ready / ativos.length) * 100) : 0;
    const status = loading ? 'Calculando carteira...' : `${ready} prontos para contato`;
    const pend = loading ? 'buscando base completa' : `${pending} aguardando histórico`;
    return `<div class="cp702-home-title"><b>Preparação da carteira</b><button type="button" onclick="cp697SetTab&&cp697SetTab('preparacao');show('carteira')">Preparar leads</button></div>
      <div class="cp702-home-bar"><span style="width:${pct}%"></span></div>
      <div class="cp702-home-meta"><span>${status}</span><span>${pend}</span><span>${loading ? '...' : pct + '%'}</span></div>`;
  }
  function ensureCard(){
    const root = qs('#home') || qs('.screen.active');
    if(!root) return null;
    let card = qs('#cp702HomeProgress');
    if(!card){
      card = document.createElement('section');
      card.id = 'cp702HomeProgress';
      card.className = 'cp702-home-progress';
      const old = qs('#cp697HomeProgress');
      if(old && old.parentNode){ old.parentNode.replaceChild(card, old); return card; }
      const anchor = qs('#leadFocoArea') || qs('#home .ui683-card') || qs('#home section:nth-of-type(2)') || null;
      if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor);
      else root.appendChild(card);
    }
    return card;
  }
  async function renderHomePrep(force){
    // Bloco "Preparação da carteira" removido da Home (a pedido). Mantém só a atualização do
    // rótulo de versão; não desenha mais o card nem busca a base inteira à toa.
    textVersion();
    const antigo = qs('#cp702HomeProgress') || qs('#cp697HomeProgress');
    if(antigo && antigo.parentNode) antigo.parentNode.removeChild(antigo);
  }
  function schedule(force){
    if(scheduled) return;
    scheduled = true;
    setTimeout(()=>{ scheduled=false; renderHomePrep(!!force); }, 120);
  }

  const oldShow = window.show;
  if(typeof oldShow === 'function' && !oldShow.__cp702Wrapped){
    const wrapped = function(name, ...args){
      const ret = oldShow.apply(this, [name, ...args]);
      if(name === 'home') schedule(false);
      setTimeout(textVersion, 80);
      return ret;
    };
    wrapped.__cp702Wrapped = true;
    window.show = wrapped; try{ show = window.show; }catch(_){ }
  }
  const oldRefresh = window.refreshAllSections;
  if(typeof oldRefresh === 'function' && !oldRefresh.__cp702Wrapped){
    const wrappedRefresh = function(){
      const ret = oldRefresh.apply(this, arguments);
      schedule(true);
      return ret;
    };
    wrappedRefresh.__cp702Wrapped = true;
    window.refreshAllSections = wrappedRefresh; try{ refreshAllSections = window.refreshAllSections; }catch(_){ }
  }

  const css = document.createElement('style');
  css.id = 'cp702PreparacaoEstavelCSS';
  css.textContent = `
    body.lead-foco-aberto #cp702HomeProgress,body.lead-foco-aberto #cp697HomeProgress{display:none!important}#cp697HomeProgress{display:none!important}.cp702-home-progress{border:1px solid rgba(255,255,255,.10);border-radius:18px;background:rgba(7,52,64,.58);padding:16px;margin:14px 0;display:block!important}.cp702-home-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.cp702-home-title b{font-size:16px;color:var(--text);font-weight:950}.cp702-home-title button{border:1px solid rgba(255,98,88,.40);background:rgba(255,98,88,.07);color:var(--lime);border-radius:999px;padding:8px 12px;font-weight:950}.cp702-home-bar{height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.cp702-home-bar span{display:block;height:100%;background:linear-gradient(90deg,#FF6258,#68ff95);border-radius:999px;min-width:3px;transition:width .18s ease}.cp702-home-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:9px;color:var(--muted);font-size:11px;font-weight:850}@media(max-width:760px){.cp702-home-progress{margin:12px 0;padding:15px}.cp702-home-title b{font-size:15px}.cp702-home-title button{font-size:13px;padding:8px 11px}}`;
  document.head.appendChild(css);

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>schedule(false)); else schedule(false);
  window.addEventListener('load', ()=>schedule(true));
  setTimeout(()=>schedule(false), 300);
  setTimeout(()=>schedule(true), 1400);
  try{
    const home = qs('#home');
    if(home){
      const mo = new MutationObserver(()=>{ if(activeHome()) schedule(false); });
      mo.observe(home, {childList:true, subtree:false});
    }
  }catch(_){ }
})();



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

  function cp788TempoAtendimento(ts){
    const d=new Date(ts);
    if(!Number.isFinite(d.getTime())) return '';
    const diff=Math.max(0,Date.now()-d.getTime());
    const min=Math.floor(diff/60000);
    let dias=null;
    try{ dias=typeof diasCalendarioBR==='function'?diasCalendarioBR(d):null; }catch(_){ dias=null; }
    if(min<1) return 'Atendido agora';
    if(min<60) return `Atendido há ${min} min`;
    if(dias===0) return 'Atendido hoje';
    if(dias===1) return 'Atendido ontem';
    if(dias!=null&&dias<7) return `Atendido há ${dias} dias`;
    return `Atendido em ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'})}`;
  }

  function cp788LinhaAtendimento(item){
    const l=item.lead, id=JSON.stringify(String(l?.id||''));
    const produto=(typeof produtosLabel==='function'?produtosLabel(l):'')||'Produto não identificado';
    const tempo=cp788TempoAtendimento(item.ts);
    return `<button type="button" class="cp788-att-row" onclick='abrirLead(${id})'>
      <span class="cp788-att-copy"><strong>${esc(l?.name||'Cliente')}</strong><small>${esc(produto)}</small></span>
      <span class="cp788-att-time">${esc(tempo)}</span><span class="cp788-att-chevron">›</span>
    </button>`;
  }

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
    const limite=Math.max(80,Number(state.cp788AtendimentosVisible||80));
    const visiveis=registros.slice(0,limite);
    const faltam=Math.max(0,registros.length-visiveis.length);
    // Resumo DIA A DIA dos últimos 7 dias (Hoje, Ontem e os demais com dia da semana + data).
    const CP788_DIAS_SEM=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const hoje0=(typeof inicioDoDiaBR==='function')?inicioDoDiaBR():new Date(new Date().setHours(0,0,0,0));
    const perDay=[];
    for(let i=0;i<7;i++){
      const d=new Date(hoje0); d.setDate(d.getDate()-i);
      const dd=String(d.getDate()).padStart(2,'0'), mm=String(d.getMonth()+1).padStart(2,'0');
      const label=i===0?'Hoje':i===1?'Ontem':`${CP788_DIAS_SEM[d.getDay()]} ${dd}/${mm}`;
      perDay.push({ n:0, label });
    }
    for(const x of registros){
      let d=null; try{ d = (typeof diasCalendarioBR==='function') ? diasCalendarioBR(new Date(x.ts)) : null; }catch(_){ d=null; }
      if(d!=null && d>=0 && d<7) perDay[d].n++;
    }
    const hoje=perDay[0].n;
    const bateu=hoje>=CP788_META_DIA;
    box.innerHTML=`<section class="cp788-att-page cp788-att-layout">
      <div class="cp788-att-main">
        <header class="cp788-att-head">
          <div><h2>Atendimentos</h2><p>${registros.length} cliente${registros.length===1?'':'s'} atendido${registros.length===1?'':'s'} · mais recentes primeiro</p></div>
        </header>
        ${visiveis.length?`<div class="cp788-att-list">${visiveis.map(cp788LinhaAtendimento).join('')}</div>`:`<div class="cp788-att-empty"><b>Nenhum atendimento registrado ainda.</b><span>Quando você copiar uma mensagem enviada ou marcar um cliente como atendido, ele aparecerá aqui pela ordem dos atendimentos.</span></div>`}
        ${faltam?`<button type="button" class="cp788-att-more" onclick="cp788MostrarMaisAtendimentos()">Mostrar mais ${Math.min(80,faltam)} atendimentos</button>`:''}
      </div>
      <aside class="cp788-att-side">
        <div class="cp788-meta-card">
          <div class="cp788-meta-title">Meta do dia</div>
          ${cp788PredioSVG(hoje, CP788_META_DIA)}
          <div class="cp788-meta-count"><b>${hoje}</b> / ${CP788_META_DIA} hoje</div>
          <div class="cp788-meta-status${bateu?' done':''}">${bateu?'🏢 Meta batida!':'atendimentos de hoje'}</div>
        </div>
        <div class="cp788-meta-breakdown">
          ${perDay.map(p=>`<div class="cp788-bd-row"><span>${escapeHtml(p.label)}</span><b>${p.n}</b></div>`).join('')}
        </div>
      </aside>
    </section>`;
  }

  window.cp788MostrarMaisAtendimentos=function(){
    state.cp788AtendimentosVisible=Math.max(80,Number(state.cp788AtendimentosVisible||80))+80;
    const base=[state?.todosLeads,state?.carteiraLeads,state?.itemsAtivos].find(a=>Array.isArray(a)&&a.length)||[];
    cp788RenderAtendimentos(base);
  };

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
  try{ renderCarteiraTabela=window.renderCarteiraTabela; }catch(_){ }
  window.setCarteiraFiltro=function(){
    if(state.active!=='carteira'&&typeof show==='function') show('carteira');
    else window.renderCarteiraTabela();
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

  function cp788LinhaConducao(l){
    if(typeof ui631LeadRow!=='function') return '';
    let selo = typeof cp786Badge==='function'?cp786Badge(l):'Abrir';
    const cat = typeof cp786Categoria==='function'?cp786Categoria(l):'';
    // O selo não repete o título da aba. Prioridade: compromisso vencido ("Atrasado · era DD/MM");
    // senão, em Programados mostra a DATA; em Fazer agora mostra há quantos dias está parado.
    const atrasado = typeof cp786CompromissoAtrasado==='function'?cp786CompromissoAtrasado(l):null;
    let tone='';
    if(atrasado){
      selo = `Atrasado · era ${atrasado.dataLabel}`; tone='atrasado';
    } else if(cat==='programados' && typeof cpAppointmentData==='function'){
      const quando = cpAppointmentData(l)?.time;
      if(quando) selo = quando;
    } else if(cat==='agora'){
      const d = Number(l?.daysSinceLastInteraction);
      if(Number.isFinite(d)) selo = d<=0?'hoje':d===1?'há 1 dia':`há ${d} dias`;
    }
    return ui631LeadRow(l, selo, tone);
  }

  window.carregarPipeline=async function(){
    if(state.active!=='pipeline') return;
    const board=document.querySelector('#pipelineBoard');
    if(!board) return;
    const render=(leads)=>{
      const grupos=cp788Grupos(leads);
      const validos=['agora','programados','aguardando','todos'];
      const filtro=validos.includes(state.pipelineVisualFiltro)?state.pipelineVisualFiltro:'agora';
      state.pipelineVisualFiltro=filtro;
      const lista=grupos[filtro]||[];
      const tabs=[['agora','Fazer agora'],['programados','Agenda'],['aguardando','Aguardando cliente']];
      const titulos={agora:['Quem precisa de ação','Somente atendimentos sob sua responsabilidade agora.'],respondeu:['Clientes que responderam','Dê continuidade a quem voltou para a conversa.'],programados:['Agenda','Visitas, reuniões e retornos com data.'],aguardando:['Aguardando cliente','Não faça nova cobrança antes da hora.'],todos:['Carteira ativa','Todos os clientes ativos, sem transformar a tela em funil.']};
      const [titulo,sub]=titulos[filtro]||titulos.agora;
      board.innerHTML=`
        <div class="ui-pipeline-kpis cp786-action-kpis">
          <div class="ui-kpi ${filtro==='agora'?'active':''}" role="button" tabindex="0" onclick="setPipelineVisualFiltro('agora')"><span>Fazer agora</span><div><b>${grupos.agora.length}</b><i>${typeof ui631Icon==='function'?ui631Icon('resposta'):''}</i></div></div>
          <div class="ui-kpi ${filtro==='programados'?'active':''}" role="button" tabindex="0" onclick="setPipelineVisualFiltro('programados')"><span>Agenda</span><div><b>${grupos.programados.length}</b><i>${typeof ui631Icon==='function'?ui631Icon('compromisso'):''}</i></div></div>
          <div class="ui-kpi ${filtro==='aguardando'?'active':''}" role="button" tabindex="0" onclick="setPipelineVisualFiltro('aguardando')"><span>Aguardando cliente</span><div><b>${grupos.aguardando.length}</b><i>${typeof ui631Icon==='function'?ui631Icon('ativos'):''}</i></div></div>
        </div>
        <div class="ui-filter-tabs cp786-action-tabs">${tabs.map(([k,t])=>`<button type="button" class="${k===filtro?'active':''}" onclick="setPipelineVisualFiltro('${k}')">${t}</button>`).join('')}</div>
        <section class="ui-priority-card ui-pipeline-list"><div class="ui-section-head"><div><h3>${esc(titulo)}</h3><p>${esc(sub)}</p></div><button type="button" onclick="${filtro==='todos'?"setPipelineVisualFiltro('agora')":"cp788AbrirCarteiraAtiva()"}">${filtro==='todos'?'Voltar às prioridades':'Ver clientes ativos'}</button></div><div class="ui-priority-list cp695-list">${lista.length?lista.map(cp788LinhaConducao).join(''):'<div class="cp695-empty">Nenhum cliente nesta visão.</div>'}</div></section>`;
    };
    const memoria=[state?.todosLeads,state?.itemsAtivos,state?.carteiraLeads].find(a=>Array.isArray(a)&&a.length);
    if(memoria) render(memoria);
    else{
      board.innerHTML='<div class="cp695-loading">Lendo sua carteira...</div>';
      const leads=await cp788CarregarBase(false);
      render(leads);
    }
  };
  try{ carregarPipeline=window.carregarPipeline; }catch(_){ }

  window.setPipelineVisualFiltro=function(f){
    state.pipelineVisualFiltro=f||'agora';
    if(state.active!=='pipeline'&&typeof show==='function') show('pipeline');
    else window.carregarPipeline();
  };
  window.cp788AbrirCarteiraAtiva=function(){
    state.pipelineVisualFiltro='todos';
    if(state.active!=='pipeline'&&typeof show==='function') show('pipeline');
    else window.carregarPipeline();
  };

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

  // Atalhos que mostram "clientes ativos" não devem abrir o histórico de atendimentos.
  document.addEventListener('DOMContentLoaded',()=>{
    const metric=document.querySelector('#cpNewLeads')?.closest('button');
    if(metric) metric.setAttribute('onclick','cp788AbrirCarteiraAtiva()');
  });
  setTimeout(()=>{
    const metric=document.querySelector('#cpNewLeads')?.closest('button');
    if(metric) metric.setAttribute('onclick','cp788AbrirCarteiraAtiva()');
  },300);
})();
