const KEEP_RE = /\.(txt|opus|ogg|mp3|m4a|wav|aac)$/i;
const state={
  lead:null, leads:[], active:"home", processing:false, analysis:null, msgStyle:"direta",
  dataRevision:0, viewRendered:{}, carteiraVisibleCount:80
};

// ===== Cache da base de leads (limit=2000) =====
// O app busca a base inteira em vários pontos (dashboard, agenda, pipeline, busca...).
// Sem cache, abrir a Hoje dispara 3-4 buscas pesadas ao mesmo tempo. Aqui guardamos o
// resultado por um tempo curto e DEDUPLICAMOS chamadas simultâneas (uma rajada = 1 busca).
// Mutações (salvar, mudar etapa, etc.) invalidam o cache pra não mostrar dado velho.
const LEADS_CACHE_TTL = 300000; // 5 min
let _leadsCache = { ts: 0, data: null, inflight: null };
async function getLeadsData(force){
  const agora = Date.now();
  if(!force && _leadsCache.data && (agora - _leadsCache.ts) < LEADS_CACHE_TTL) return _leadsCache.data;
  if(_leadsCache.inflight) return _leadsCache.inflight; // junta chamadas simultâneas numa só
  _leadsCache.inflight = (async () => {
    try{
      const res = await fetch(`./api/leads-recentes?limit=2000${force ? "&fresh=1" : ""}`, { cache:"no-store" });
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
      return data;
    }catch(e){
      _leadsCache = { ts: 0, data: _leadsCache.data, inflight: null };
      return { ok:false, items:[] };
    }
  })();
  return _leadsCache.inflight;
}
const LEAD_DETAIL_CACHE_TTL = 10 * 60 * 1000;
const _leadDetailCache = new Map();
async function getLeadDetail(id, force){
  const key = String(id || "");
  if(!key) throw new Error("Lead inválido.");
  const cached = _leadDetailCache.get(key);
  if(!force && cached?.data && (Date.now() - cached.ts) < LEAD_DETAIL_CACHE_TTL) return cached.data;
  if(cached?.inflight) return cached.inflight;
  const inflight = (async () => {
    const res = await fetch(`./api/lead-update?action=detalhe&id=${encodeURIComponent(key)}`, { cache:"no-store" });
    const data = await res.json().catch(()=>({ok:false}));
    if(!res.ok || !data?.ok || !data?.item) throw new Error(data?.error || "Não foi possível carregar o histórico completo.");
    const item = limparLead(data.item);
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

function qs(s){return document.querySelector(s)}
function qsa(s){return Array.from(document.querySelectorAll(s))}
function isDesktop(){return matchMedia("(min-width:900px)").matches}
function escapeHtml(t=""){return String(t).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
// JSON seguro para valores dentro de atributos HTML com aspas simples: escapa ' → &#39;
function safeJson(v){return JSON.stringify(v).replace(/'/g,"&#39;");}
function toast(t){const e=qs("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2600)}

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
  if(meta) meta.setAttribute("content", proximo === "light" ? "#F3F7F8" : "#0C1D24");
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
function carregarTelaAtiva(t, force=false){
  const seq = ++_viewLoadSeq;
  requestAnimationFrame(async () => {
    if(seq !== _viewLoadSeq || state.active !== t) return;
    const rev = Number(state.dataRevision) || 0;
    if(!force && VIEW_CACHEABLE.has(t) && state.viewRendered?.[t] === rev) return;
    try{
      if(t === "home") await carregarDashboard();
      else if(t === "pipeline") await carregarPipeline();
      else if(t === "agenda") await carregarAgenda();
      else if(t === "cerebro"){ await carregarCerebro(); await carregarAprendizado(); icTab("cerebro"); }
      else if(t === "vendas") await carregarVendas();
      else if(t === "perdidos"){ await carregarPerdidos(); await carregarGeladeira(); arqTab("perdidos"); }
      else if(t === "geladeira") await carregarGeladeira();
      else if(t === "aprendizado") await carregarAprendizado();
      else if(t === "relatorio") await carregarRelatorio(force);
      else if(t === "carteira") await carregarCarteira(force);
      if(state.active === t && VIEW_CACHEABLE.has(t)) state.viewRendered[t] = Number(state.dataRevision) || rev;
    }catch(err){ console.warn("carregarTelaAtiva", t, err); }
  });
}
window.carregarTelaAtiva = carregarTelaAtiva;

function show(t, options={}){
  const prev = state.active;
  const navKey = options.navKey || (t === "agenda" ? "agenda" : t);
  state.navKey = navKey;
  state.active=t;
  if(!isDesktop()){
    qsa(".screen").forEach(e=>e.classList.remove("active"));
    qs("#"+t)?.classList.add("active");
  }else{
    const escondidas = ["menu","cerebro","vendas","pipeline","agenda","zip","linhaTempo","perdidos","geladeira","aprendizado","propostas","relatorio","carteira"];
    escondidas.forEach(id => qs("#"+id)?.classList.remove("active"));
    const home = qs("#home");
    if(t === "home") home?.classList.add("active");
    else { qs("#"+t)?.classList.add("active"); home?.classList.remove("active"); }
  }
  // A troca visual acontece primeiro; o cálculo da tela entra no próximo frame.
  // Isso elimina a sensação de botão travado.
  if(prev !== t) window.scrollTo(0,0);
  qsa(".nav").forEach(b=>b.classList.toggle("active",b.dataset.target===t));
  qsa(".sb-item").forEach(b=>{
    const key = b.dataset.navKey || b.dataset.target;
    b.classList.toggle("active", key === navKey);
  });
  destacarMenuPipeline();
  if(!options.skipLoad) carregarTelaAtiva(t, false);
}
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
function icTab(which){
  const cer = which !== "aprendizado";
  const gc = qs("#icCerebro"), ga = qs("#icAprendizado");
  if(gc) gc.style.display = cer ? "" : "none";
  if(ga) ga.style.display = cer ? "none" : "";
  const bc = qs("#icTabCerebro"), ba = qs("#icTabAprend");
  [[bc,cer],[ba,!cer]].forEach(([b,on])=>{ if(!b) return; b.style.borderColor = on?"var(--lime)":"var(--line)"; b.style.background = on?"rgba(255,107,92,.15)":"transparent"; b.style.color = on?"var(--lime)":"var(--muted)"; });
  if(!cer) carregarAprendizado();
}
window.icTab = icTab;
// Abas internas do menu "Arquivo": Perdidos x Geladeira (congelados).
function arqTab(which){
  const perd = which !== "geladeira";
  const gp = qs("#arqPerdidos"), gg = qs("#arqGeladeira");
  if(gp) gp.style.display = perd ? "" : "none";
  if(gg) gg.style.display = perd ? "none" : "";
  const bp = qs("#arqTabPerdidos"), bg = qs("#arqTabGeladeira");
  [[bp,perd],[bg,!perd]].forEach(([b,on])=>{ if(!b) return; b.style.borderColor = on?"var(--lime)":"var(--line)"; b.style.background = on?"rgba(255,107,92,.15)":"transparent"; b.style.color = on?"var(--lime)":"var(--muted)"; });
}
window.arqTab = arqTab;
// Celular: gaveta do menu = a mesma lista lateral do PC (mesma linguagem/conteúdo).
function abrirMenuGaveta(){ document.body.classList.add("menu-aberto"); }
function fecharMenuGaveta(){ document.body.classList.remove("menu-aberto"); }
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
      return `<div class="lead" ${idStr ? `onclick='abrirLead(${idJs})' style="cursor:pointer${ehSel?";border-color:var(--lime);background:rgba(255,107,92,.06)":""}"`:""}>
        <div style="flex:1;min-width:0">
          <strong>${escapeHtml(item.name||"Cliente importado")}${novo}${contato}${esfri}</strong>
          <div class="small">${escapeHtml(produtosLabel(item))}${item.daysSinceLastInteraction!=null?" · "+item.daysSinceLastInteraction+"d":""}</div>
        </div>
        <span class="tag hot" title="Probabilidade de fechar a venda">${escapeHtml(item.probability||"--")}</span>
      </div>`;
    }).join("");
  }
  const el1 = qs("#leadList"); if(el1) el1.innerHTML=html;
  const el2 = qs("#mobileLeadList"); if(el2) el2.innerHTML=html;
  const elProb = qs("#probability"); if(elProb) elProb.textContent=baseLead?baseLead.probability:"--";
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
const PRODUTOS_RX = /\b(renaissance|evolutti|boulevard|premium\s*office|quality|personalit[eé]|prime|terrenos?|nvri|nvr|eii|ii)\b/gi;
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
  return String(v).replace(PRODUTOS_RX, "").replace(/\s+/g," ").trim() || String(v);
}
function limparLead(l){
  if(!l || typeof l !== "object") return l;
  if(l.__direcionaClean === true) return l;
  const out = {
    ...l,
    name: limpoNome(l.name),
    probability: limpoTexto(l.probability, "—"),
    bestTime: limpoBestTime(l.bestTime),
    summary: limpoTexto(l.summary, ""),
    nextAction: limpoTexto(l.nextAction, ""),
  };
  try{ Object.defineProperty(out, "__direcionaClean", { value:true, enumerable:false }); }catch(_){ out.__direcionaClean = true; }
  return out;
}

async function loadRecentLeads(force = false){
  try{
    if(force) invalidarLeadDetail();
    const data = await getLeadsData(!!force);
    if(data?.ok && Array.isArray(data.items)){
      state.leads = data.items.slice(0, 8).map(limparLead);
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
      // Probabilidade similar
      const probAtual = Number(leadAtual?.probabilityPercent) || 0;
      const probOutro = Number(l.probabilityPercent) || 0;
      if(probAtual && probOutro && Math.abs(probAtual - probOutro) <= 15) score += 5;
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
    ac.mensagemIdealHoje,
    ac.probabilidadeFechamentoHoje
  ].filter(v => String(v || "").trim()) : [];

  if(!ac || !camposObrigatorios.length){
    return `<section style="border:1px solid rgba(255,155,59,.45);border-radius:14px;padding:13px;background:rgba(255,155,59,.07)">
      <div style="font-size:15px;font-weight:950;color:#fff">Diagnóstico comercial completo</div>
      <div style="margin-top:6px;color:var(--soft);font-size:12px;line-height:1.45">Este lead ainda está com a análise antiga. Toque em <b style="color:var(--morno)">Reanalisar</b> para gerar os 10 pontos, a leitura da conversa inteira, a mensagem ideal e a probabilidade de fechamento.</div>
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
    ["7. Pendência financeira", ac.pendenciaFinanceira],
    ["8. Próximo passo é de quem", ac.proximoPassoDeQuem],
    ["9. Etapa do funil", ac.etapaFunil],
    ["10. Nível de interesse", ac.nivelInteresse]
  ];
  const linhas = itens.map(([lab,val]) => `<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06)">
    <div style="font-size:10px;line-height:1.25;letter-spacing:.08em;text-transform:uppercase;font-weight:950;color:var(--muted)">${escapeHtml(lab)}</div>
    <div style="margin-top:4px;font-size:13px;line-height:1.45;color:var(--text)">${escapeHtml(String(val || "Não identificado"))}</div>
  </div>`).join("");
  const bloco = (titulo, valor, destaque) => valor ? `<div style="margin-top:10px;padding:11px 12px;border:1px solid ${destaque ? 'rgba(255,107,92,.35)' : 'var(--line)'};border-radius:11px;background:${destaque ? 'rgba(255,107,92,.06)' : 'rgba(255,255,255,.025)'}">
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
    ${bloco("Probabilidade de fechamento", ac.probabilidadeFechamentoHoje, false)}
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
  const INT = { alto:["Interesse ALTO","var(--acao)"], medio:["Interesse MÉDIO","var(--morno)"], baixo:["Interesse BAIXO","var(--score-frio)"] };
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
    ["Temperatura", lc.temperatura],
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
// Ele criava uma segunda camada paralela de sugestões estilo CRM. Agora a tela trabalha
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
    buscarSimilares(lead.product, lead.etapa, { id: state.lead?.id, analysis, probabilityPercent: analysis?.probabilityPercent }).then(similares => {
      // Se o user trocou de lead enquanto buscava, descarta o resultado.
      if(state.lead?.id !== leadIdAtMoment) return;
      if(!similares.length) return;
      const box = qs("#analysisBox");
      if(!box || !box.innerHTML.includes("class=\"analysis-grid\"")) return;
      const html = '<div style="margin-top:12px;padding:10px;background:rgba(196,92,255,.06);border:1px solid rgba(196,92,255,.18);border-radius:12px"><div class="small" style="color:var(--cerebro);text-transform:uppercase;letter-spacing:.1em;font-size:10px;font-weight:950;margin-bottom:6px">Leads parecidos</div>' +
        similares.map(s => `<div class="small" style="padding:4px 0">• <span onclick='abrirLead(${JSON.stringify(String(s.id||""))})' style="cursor:pointer;text-decoration:underline">${escapeHtml(s.name||"?")}</span> — ${escapeHtml(s.etapa||"")} (${escapeHtml(s.probability||"--")})</div>`).join("") +
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
  const probabPct = analysis.probabilityPercent ? analysis.probabilityPercent + "%" : (analysis.probability || "—");
  const objArr = Array.isArray(analysis.objections) ? analysis.objections : (analysis.objections ? [analysis.objections] : []);
  let html = diagnosticoClienteHTML(analysis) + '<div class="analysis-grid">';
  html += row("Resumo", analysis.summary);
  html += row("Perfil do cliente", analysis.clientProfile);
  html += row("Probabilidade de venda", probabPct);
  if(lead?.product) html += row("Produto", lead.product);
  html += '</div>';
  if(objArr.length){
    html += '<div style="margin-top:10px"><b style="color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-size:11px">Objeções identificadas</b><ul class="bullet-list">';
    for(const o of objArr) html += '<li>'+escapeHtml(typeof o === "string" ? o : (o?.text || JSON.stringify(o)))+'</li>';
    html += '</ul></div>';
  }
  if(analysis.nextAction){
    html += '<div class="action-card"><b>Próxima ação recomendada:</b><br>'+escapeHtml(analysis.nextAction)+'</div>';
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
const ARQUITETURA_MENSAGENS_ATUAL = "gpt55-unificado-v2";

function mensagemAprovadaSemAlteracao(texto){
  return String(texto || "").trim();
}

function mensagensDaAnalise(a){
  a = a || {};
  const arquiteturaOk = String(a.arquiteturaMensagens || "") === ARQUITETURA_MENSAGENS_ATUAL;
  const pendente = a.sugestoesPendentes === true;
  const m = (a.messages && typeof a.messages === "object") ? a.messages : {};
  if(!arquiteturaOk || pendente){
    return {
      direta:"", consultiva:"", retomada:"",
      a:"", b:"", c:"", aLabel:"Reanalisar", bLabel:"Reanalisar", cLabel:"Reanalisar", recomendada:"a",
      aprovada:false
    };
  }
  const pick = (key) => {
    const v = m[key];
    if(v == null) return "";
    return typeof v === "object"
      ? String(v.msg || v.mensagem || v.texto || "").trim()
      : String(v).trim();
  };
  const aMsg = pick("a") || pick("direta");
  const bMsg = pick("b") || pick("consultiva");
  const cMsg = pick("c") || pick("retomada");
  const aprovada = !!(aMsg && bMsg && cMsg);
  return {
    direta:aMsg, consultiva:bMsg, retomada:cMsg,
    a:aMsg, b:bMsg, c:cMsg,
    aLabel:String(m.aLabel || "").trim(),
    bLabel:String(m.bLabel || "").trim(),
    cLabel:String(m.cLabel || "").trim(),
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

function scoreLead(l){
  return scorePrioridadeAtendimento(l);
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
  const prob = Number(probabilidadeRefinada(l) ?? l.probabilityPercent ?? 0) || 0;
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

  let score = 0;
  const motivos = [];

  if(lembreteVencido(l)){ score += 120; motivos.push("lembrete vencido ou marcado para hoje"); }
  if(negociacaoAguardandoRetorno){
    score += 92;
    motivos.push(ctxIA.contatoParceiro ? "contraproposta com corretor parceiro aguardando retorno do cliente final" : "proposta/condição apresentada aguardando retorno");
  } else if(parceiroComClienteFinal){
    score += 72;
    motivos.push("corretor parceiro ficou de validar com o cliente final");
  }
  if(temAgenda){ score += 50; motivos.push("tem compromisso ou agenda identificada"); }
  if(ultimoCliente){ score += 45; motivos.push("cliente falou por último — falta resposta sua"); }
  if(pendenciaCorretor){ score += 55; motivos.push("cliente está esperando um retorno seu"); }
  if(sinalCompra){ score += 24; motivos.push("há sinal concreto de compra"); }
  if(esforcoCliente){ score += 22; motivos.push("cliente já se movimentou no processo"); }
  if(etapaAvancada){ score += 18; motivos.push("negociação já saiu da curiosidade"); }

  if(Number.isFinite(diasResposta)){
    if(diasResposta >= 3 && diasResposta <= 14){ score += 16; motivos.push("tempo bom para retomar"); }
    else if(diasResposta > 30){ score -= 12; motivos.push("conversa fria"); }
  } else if(Number.isFinite(dias) && dias >= 3 && dias <= 14){
    score += 8;
  }

  // Chance de venda entra como tempero, não como dono da fila.
  score += Math.min(35, Math.max(0, prob) * 0.35);

  if(tipo === "quente-fechar") score += 25;
  else if(tipo === "morno-confirmar") score += 12;
  else if(tipo === "objecao-tratar") score += 10;
  else if(tipo === "frio-reaquecer") score -= 5;
  else if(tipo === "stand-by") score -= 14;
  else if(tipo === "primeiro-contato") score -= 12;

  // Corretor parceiro só derruba prioridade quando é conversa solta.
  // Se existe proposta/contraproposta com cliente final, ele vira canal de fechamento e sobe prioridade.
  if(/parceir|corretor/i.test(String(a.tipoContato||"")) && !pendenciaCorretor && !ultimoCliente && !negociacaoAguardandoRetorno && !parceiroComClienteFinal){
    score -= 12;
    motivos.push("contato parece parceiro/corretor — tratar pelo cliente final");
  }

  if(travaExterna && !negociacaoAguardandoRetorno){ score -= 38; motivos.push("boa oportunidade, mas depende de evento externo"); }
  if(clientePediuPraAguardar && !negociacaoAguardandoRetorno && !parceiroComClienteFinal){ score -= 22; motivos.push("cliente pediu tempo ou ficou de avaliar"); }
  if(emJanelaDeEspera(l)){
    if(negociacaoAguardandoRetorno && ultimoCliente) score -= 10;
    else if(negociacaoAguardandoRetorno) score -= 25;
    else { score -= 90; motivos.unshift("você chamou recentemente — aguarde resposta"); }
  }
  if(lembreteFuturo(l)){ score -= 140; motivos.unshift("tem lembrete futuro — não antecipar"); }
  if(ehContatadoHoje(l)){
    if(negociacaoAguardandoRetorno && ultimoCliente) score -= 10;
    else if(negociacaoAguardandoRetorno) score -= 35;
    else { score -= 300; motivos.unshift("você já falou com esse lead hoje"); }
  }

  if(!msgsCli.length && !sinalCompra && !pendenciaCorretor && !temAgenda){
    score -= 28;
    motivos.push("ainda não houve conversa comercial real");
  }

  // SINAL URGENTE: ao menos um desses é necessário para entrar em "acao-hoje".
  // Sem sinal urgente, o maior grupo possível é "retomar-cuidado".
  const temSinalUrgente = lembreteVencido(l) || temAgenda || ultimoCliente ||
    pendenciaCorretor || negociacaoAguardandoRetorno || parceiroComClienteFinal;

  let grupo, titulo;
  if(ehContatadoHoje(l)){
    grupo = "tratado-hoje"; titulo = "Tratado hoje";
  } else if(lembreteFuturo(l)){
    grupo = "pode-aguardar"; titulo = "Tem lembrete futuro";
  } else if(emJanelaDeEspera(l) && !negociacaoAguardandoRetorno && !ultimoCliente){
    grupo = "pode-aguardar"; titulo = "Aguardar resposta";
  } else if(clientePediuPraAguardar && !negociacaoAguardandoRetorno && !lembreteVencido(l)){
    grupo = "pode-aguardar"; titulo = "Cliente pediu para aguardar";
  } else if(travaExterna && !pendenciaCorretor && !ultimoCliente && !lembreteVencido(l)){
    grupo = "boa-sem-urgencia"; titulo = "Boa oportunidade, sem urgência";
  } else if(temSinalUrgente && score >= 70){
    grupo = "acao-hoje"; titulo = "Atender agora";
  } else if(temSinalUrgente && score >= 40){
    grupo = "acao-hoje"; titulo = "Atender hoje";
  } else if(score >= 40){
    grupo = "retomar-cuidado"; titulo = "Retomar com cuidado";
  } else {
    grupo = "baixa-prioridade"; titulo = "Baixa prioridade";
  }

  return {
    score,
    grupo,
    titulo,
    motivo: motivos.filter(Boolean).slice(0, 2).join(" · ") || "prioridade calculada pela conversa"
  };
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
  const va = probabilidadeRefinada(a) ?? (Number(a.probabilityPercent)||0);
  const vb = probabilidadeRefinada(b) ?? (Number(b.probabilityPercent)||0);
  return vb - va;
}

// SCORE DE CONVERSÃO HOJE — separado da prioridade de atendimento.
// Prioridade responde: "quem merece ação agora?"
// Conversão responde: "quem está mais perto de virar venda se eu agir hoje?"
// Isso evita caso como Jessica aparecer como maior probabilidade só por ter lembrete/retomada.
// Lead em viabilidade financeira continua importante, mas fica abaixo de quem já visitou,
// recebeu proposta/simulação ou está comparando decisão.
function scoreConversaoHoje(l){
  const a = l?.analysis || {};
  const e = normalizarEtapa(l?.etapa);
  const txt = textoSinais(l);
  const prob = Number(probabilidadeRefinada(l) ?? l?.probabilityPercent ?? 0) || 0;
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

  let score = prob;

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

// Ranking do "Quem atender agora" agora é PRIORIDADE DE ATENDIMENTO primeiro.
// Conversão/chance de venda entra só como desempate/tempero, para não esconder uma
// pendência aberta real atrás de um lead com score comercial alto porém sem ação imediata.
function scoreRankingHoje(l){
  const atendimento = scorePrioridadeAtendimento(l);
  const conversao = scoreConversaoHoje(l);
  const temperoConversao = Math.max(-18, Math.min(24, conversao * 0.12));
  return Math.round(atendimento + temperoConversao);
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
      partes.push("cliente ficou de te retornar — dá um toque pra não esfriar");
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
    else if(dias <= 30) partes.push(`${dias} dias parado — janela esfriando`);
    else partes.push(`${dias} dias parado — frio`);
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
// Assim o corretor abre a conversa pronta pra enviar, sem perder a sugestão do Direciona.
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
      body: JSON.stringify({ id }) // sem novoAtendimento = reanalisa a timeline atual (já com a obs), sem duplicar
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
// qualquer edição/inclusão — pra refletir na hora score, respostas e a "última atualização".
// Preserva eventos registrados localmente que o banco ainda não devolveu (lag de leitura).
async function recarregarLeadFoco(id){
  if(!id || String(state.lead?.id) !== String(id)) return;
  try{
    invalidarLeadsCache();
    const fresh = await getLeadsData(true);
    const atualizado = (fresh?.items||[]).map(limparLead).find(l => String(l.id) === String(id));
    if(!atualizado || String(state.lead?.id) !== String(id)) return;
    const localEv = state.analysis?.aprendizado?.eventos;
    if(Array.isArray(localEv)){
      const evFresh = atualizado.analysis?.aprendizado?.eventos || [];
      if(localEv.length > evFresh.length){
        atualizado.analysis = atualizado.analysis || {};
        atualizado.analysis.aprendizado = { ...(atualizado.analysis.aprendizado||{}), eventos: localEv };
      }
    }
    state.lead = atualizado; state.analysis = atualizado.analysis || null;
    renderLeadFoco(atualizado);
  }catch(_){}
}
window.recarregarLeadFoco = recarregarLeadFoco;

const TIPO_RETOMADA_CURTO = {
  "quente-fechar": "Pronto pra fechar",
  "morno-confirmar": "Confirmar próximo passo",
  "frio-reaquecer": "Precisa reaquecer",
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
  const prob = Number(l.probabilityPercent) || 0;
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
  if(prob >= 70 && dias <= 3) return "Probabilidade alta · interesse ativo";
  if(prob >= 70) return "Probabilidade alta · janela esfriando";
  if(dias >= 7) return `${dias}d parado · precisa retomada`;
  return "Aguardando próximo passo";
}

function classePct(prob){
  const p = Number(prob) || 0;
  if(p >= 70) return "";       // verde-limão
  if(p >= 50) return "warn";   // amarelo
  return "cold";                // vermelho
}

function ehEsfriando(l){
  if(!isNaN(lembreteTs(l))) return false; // tem lembrete (futuro=parkeado / vencido=prioridade do dia) — não é "esfriando"
  const prob = Number(l.probabilityPercent) || 0;
  const dias = Number(l.daysSinceLastInteraction) || 0;
  return prob >= 60 && dias >= 3 && dias <= 7;
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
  return `<span title="Esfriando — sem resposta há alguns dias" style="font-size:14px;line-height:1;vertical-align:1px;cursor:help">❄️</span>`;
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
  return eventos.some(e => ["whatsapp_aberto","mensagem_copiada","contato_manual"].includes(e.evento) && e.quando && new Date(e.quando) >= hoje);
}
function ehAtendidoNaSemana(l){
  const eventos = l.analysis?.aprendizado?.eventos || [];
  const cutoff = Date.now() - 7*24*60*60*1000;
  return eventos.some(e => ["whatsapp_aberto","mensagem_copiada","contato_manual"].includes(e.evento) && e.quando && new Date(e.quando).getTime() >= cutoff);
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

// Probabilidade REFINADA mostrada na UI: combina a prob "raw" da IA com o
// Score Comercial (engajamento, keywords, dias distintos, sinais macro) e adiciona
// ruído determinístico por ID. Aplica curva CONSERVADORA — IA tende a inflar valores.
// Em venda imobiliária real: 80%+ é "praticamente fechado", 60-75% é proposta na mesa,
// 35-55% é engajado mas longe, 15-30% é fogo de palha.
// Determinístico: mesmo lead = mesmo valor a cada render.
// Venda condicionada: cliente depende de vender um bem antes de comprar (permuta ou
// obstáculo escrito pelo corretor nas observações). Regra do produto: probabilidade baixa,
// porque depende de algo fora do controle do corretor. Aplicado de forma determinística
// porque a IA nem sempre obedece o teto sozinha.
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
function probabilidadeRefinada(l){
  const probIa = Number(l?.probabilityPercent);
  if(!Number.isFinite(probIa) || probIa <= 0) return null;
  const score = scoreSinais(l);
  // Curva conservadora: comprime IA pra escala mais real (× 0.70)
  const base = probIa * 0.70;
  // Ajuste baseado em sinais reais
  const ajuste = Math.round((score - probIa) * 0.18);
  // Ruído determinístico ±3 baseado no id (impede valores redondos)
  const id = String(l?.id || "");
  let hash = 0;
  for(let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const ruido = ((Math.abs(hash) % 7) - 3);
  const final = base + ajuste + ruido;
  let resultado = Math.max(5, Math.min(95, Math.round(final)));
  // Teto duro pra venda condicionada/permuta (regra do produto: 30-45% no máx).
  if(temVendaCondicionada(l)) resultado = Math.min(resultado, 45);
  // Teto duro pra lead SEM diálogo real: cliente nunca engajou de verdade (mandou só "oi/beleza",
  // sumiu, nunca houve troca nem negociação). Não pode marcar % alto de fechamento — é frio.
  if(semDialogoReal(l)) resultado = Math.min(resultado, 15);
  // Teto MAIS duro: cliente NUNCA respondeu (nenhuma mensagem dela) embora o corretor já tenha
  // mandado mensagem. Lead frio de verdade — quem nunca leu/respondeu a 1ª msg não vale % alto.
  // Quanto mais tempo no silêncio, mais baixo. (pedido do dono)
  // EXCEÇÃO: atendimento presencial/visita registrado pelo corretor é engajamento real — não trava.
  if(l.daysSinceClientReply == null && !temAtendimentoManual(l) && (l.daysSinceLastTouch != null || l.daysSinceLastInteraction != null)){
    const diasMudo = Number(l.daysSinceLastTouch != null ? l.daysSinceLastTouch : l.daysSinceLastInteraction) || 0;
    const teto = diasMudo >= 14 ? 6 : diasMudo >= 4 ? 9 : 12;
    resultado = Math.min(resultado, teto);
  }
  // Ajuste manual do corretor pela obs ("sobe/baixa o score" = ±10), em cima do score da IA.
  const aj = Number(l?.analysis?.scoreAjuste) || 0;
  if(aj) resultado = Math.max(5, Math.min(95, resultado + aj));
  return resultado;
}
function probabilidadeRefinadaTxt(l){
  const v = probabilidadeRefinada(l);
  return v == null ? (l?.probability || "--") : v + "%";
}
const BUSINESS_RE = /(senger|construtora|corretor|imobiliaria|imobiliária|direciona|atendimento)/i;
function ehMsgDoCliente(m, primeiroNomeCliente){
  const autor = String(m?.author || "").trim();
  if(!autor || autor === "Sistema") return false;
  if(BUSINESS_RE.test(autor)) return false;
  // Se o autor bate com o nome do cliente, com certeza é dele.
  if(primeiroNomeCliente && autor.toLowerCase().includes(primeiroNomeCliente)) return true;
  // Caso contrário, assume cliente (não é business).
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
  const prob = Number(l.probabilityPercent) || 0;
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

  // Ajuste manual do corretor ("aumentar/baixar score" na obs) também mexe na PRIORIDADE,
  // não só no número exibido — pra o lead subir/descer no funil como ele mandou.
  const sAjuste = Number(a.scoreAjuste) || 0;
  // PARCEIRO/corretor: o volume de conversa é OPERACIONAL (planta, projeto, coordenação),
  // não calor de compra — não deixa engajamento/keywords inflarem o score dele.
  if(/parceir|corretor/i.test(String(a.tipoContato||""))){ sEng = 0; sKw = 0; }
  return prob + sMacro + sEng + sKw + sTemp + sAjuste;
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
  return `<div class="empty" style="text-align:center;padding:22px 14px">Não consegui carregar agora.<br><span class="small" style="color:var(--muted)">Confira sua internet e tente de novo.</span><br><button type="button" onclick='invalidarLeadsCache();${retryJs}' style="margin-top:12px;padding:8px 18px;border:1px solid var(--lime);background:rgba(255,107,92,.1);color:var(--lime);border-radius:999px;font-weight:950;cursor:pointer">Tentar de novo</button></div>`;
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
// - Prioritários: precisa de ação agora (quente/morno/objeção), não contatado hoje. Ordenado por score.
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
  "tratado-hoje":       { titulo: "Tratados hoje", sub: "Leads que você já contatou hoje — voltam pra fila amanhã." },
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
  // Ordena por prioridade de atendimento primeiro; conversão/chance de venda fica só como tempero.
  const porPrioridade = compararPrioridadeAtendimento;
  grupos["acao-hoje"].sort(porPrioridade);
  grupos["retomar-cuidado"].sort(porPrioridade);
  grupos["boa-sem-urgencia"].sort(porPrioridade);
  grupos["pode-aguardar"].sort(porPrioridade);
  grupos["baixa-prioridade"].sort(porPrioridade);
  grupos["tratado-hoje"].sort(porPrioridade);
  // "todos" = lista completa dos ativos, por prioridade de atendimento.
  grupos["todos"] = (ordenados || []).slice().sort(porPrioridade);
  // "retomada" = aparece quando não há urgentes. Leads que valem um toque proativo:
  // parados 3-14 dias, probabilidade mínima, não contatados hoje, não parkeados.
  grupos["retomada"] = (grupos["acao-hoje"].length + grupos["retomar-cuidado"].length) === 0
    ? grupos["todos"].filter(l =>
        !ehContatadoHoje(l) &&
        !lembreteFuturo(l) &&
        !emJanelaDeEspera(l) &&
        Number(l.daysSinceLastInteraction) >= 3 &&
        Number(l.daysSinceLastInteraction) <= 30 &&
        (Number(l.probabilityPercent) || 0) >= 25
      ).slice(0, 20)
    : [];
  state.gruposHome = grupos;

  // A Home aprovada usa o dashboard Corretor Pro. Mantemos apenas os grupos em memória
  // para abrir o próximo lead, sem montar dezenas de cards escondidos no navegador.
  if(qs("#cpDashboard") && !state.grupoAtivo && !state.lead?.id){
    document.body.classList.remove("lead-foco-aberto");
    state.focoLeadId = null;
    return;
  }

  // Se o usuário está dentro de um grupo (ou viu um lead aberto), NÃO redesenha a tela —
  // senão o auto-refresh do dashboard derruba ele de qualquer subtela. Os contadores
  // serão atualizados quando ele clicar "Voltar". focoLeadId é um marcador durável do lead
  // em foco — protege mesmo se state.lead ficar momentaneamente inconsistente (reanálise/import).
  if(state.grupoAtivo || state.focoLeadId || state.lead?.id) return;

  // Tela inicial = 4 botões de ação (Prioritários, Stand by, Sem evolução, Importar conversa).
  renderBotoesHome();
}

// Home M1: chips de triagem + top 3 com motivo/WhatsApp + compromissos confirmados + KPI strip.
// Temperatura do lead pela probabilidade (rótulo + classe de cor) — usada no hero e na fila.
function tempLeadDe(p){
  return p>=70 ? {c:"qq",t:"Muito quente",col:"var(--lime)"}
       : p>=55 ? {c:"q", t:"Quente",      col:"var(--lime)"}
       : p>=40 ? {c:"m", t:"Morno",       col:"var(--morno)"}
       :         {c:"f", t:"Frio",        col:"var(--muted)"};
}
// Rótulo curto da faixa de probabilidade (mostrado embaixo do % na fila, igual ao desenho).
function faixaProbLabel(p){ p = Number(p)||0; return p>=70 ? "Alta" : p>=55 ? "Média alta" : p>=40 ? "Média" : "Média baixa"; }
// Ícone do WhatsApp (igual ao desenho — círculo verde com o glifo).
const WA_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.1-.3.2-.5.1-.7-.3-1.5-.6-2.1-1.5-.5-.6-.8-1.3-.9-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.1.1-.3.2-.4 0-.1 0-.3 0-.4 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.9 2.3 1 2.5c.1.2 1.7 2.7 4.2 3.7.6.3 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1 .1-1.2z"/></svg>`;
const CHECK_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>`;
// Uma linha da Fila inteligente (porte do layout-alvo). Reaproveita dados/cliques reais.
function filaRowHTML(l, pos){
  const idJs = JSON.stringify(String(l.id||""));
  const ehSel = state.lead?.id && String(l.id) === String(state.lead.id);
  const probRef = probabilidadeRefinada(l);
  const prob = probRef != null ? probRef : (Number(l.probabilityPercent) || 0);
  const prioridade = prioridadeAtendimento(l) || {};
  const dias = l.daysSinceLastInteraction != null ? `<span class="fd-n">${l.daysSinceLastInteraction}d</span><span class="fd-l">sem resposta</span>` : "";
  const etapa = normalizarEtapa(l.etapa);
  const waLink = l.phone ? whatsappLink(l.phone, "") : "";
  return `<div class="fila-row ${ehSel?"sel":""}" onclick='abrirLead(${idJs})'>
    <div class="fila-rank">${pos}</div>
    ${avatarLead(l, classePct(prob))}
    <div class="fila-info">
      <div class="fila-nm">${escapeHtml(l.name||"Cliente")}</div>
      <div class="fila-un">${escapeHtml(produtosLabel(l))}</div>
    </div>
    <div class="fila-days">${dias}</div>
    <div class="fila-pcwrap">
      <div class="fila-pc" title="Prioridade de atendimento">${escapeHtml(prioridade.titulo || "Prioridade")}</div>
      <div class="fila-faixa" title="Chance de venda" style="color:var(--muted)">${escapeHtml(probabilidadeRefinadaTxt(l))}</div>
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
  const probRef = probabilidadeRefinada(l);
  const prob = probRef != null ? probRef : (Number(l.probabilityPercent) || 0);
  const tp = tempLeadDe(prob);
  const dias = l.daysSinceLastInteraction;
  // "Por que é prioridade": sinais reais (motivo + objeções), sem repetir, no máx 4.
  // Pula a parte de "probabilidade (NN%)" — já está no número grande (evita 68% vs 65%).
  const porque = [];
  if(lembreteVencido(l)) porque.push("Lembrete marcado pra hoje");
  String(motivoPrioridade(l)||"").split(" · ").forEach(p => { p=p.trim(); if(p && !/^probabilidade/i.test(p)) porque.push(p.charAt(0).toUpperCase()+p.slice(1)); });
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
  const waLink = linkWhatsAppDireta(l);
  return `<section class="hero-real" onclick='abrirLead(${idJs})'>
    <div class="h-top">
      <span class="h-badge max">Prioridade agora</span>
    </div>
    <div class="h-grid">
      <div style="min-width:0">
        <div class="h-nm">${escapeHtml(l.name||"Cliente")}</div>
        <div class="h-un">${escapeHtml(interesse)}</div>
        <div class="h-pct"><span class="h-pct-num">${escapeHtml(probabilidadeRefinadaTxt(l))}</span></div>
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
        ${waLink
          ? `<a class="h-wa" href="${escapeHtml(waLink)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">WhatsApp</a>
             <button type="button" class="h-copy" onclick='event.stopPropagation();copiarMensagemLead(${idJs})'>Copiar mensagem</button>`
          : `<button type="button" class="h-copy" onclick='event.stopPropagation();copiarMensagemLead(${idJs})'>Copiar mensagem</button>`}
        <button type="button" class="h-out" onclick='event.stopPropagation();abrirLead(${idJs})'>Ver histórico</button>
        <button type="button" class="h-out" onclick='event.stopPropagation();jaFaleiLead(${idJs})' title="Marca que você já falou — sai da fila de hoje">✓ Já falei</button>
      </div>
    </div>
  </section>`;
}
// Copia a mensagem sugerida (direta, com saudação) de um lead — usada no botão do hero.
window.copiarMensagemLead = function(id){
  const l = (state.itemsAtivos||[]).find(x => String(x.id) === String(id));
  if(!l) return;
  const a = l.analysis || {};
  const msg = mensagemAprovadaSemAlteracao(mensagensDaAnalise(a).direta);
  const done = () => { toast("Mensagem copiada"); try{ registrarAprendizado && registrarAprendizado("mensagem_copiada", String(l.id||"")||null, { de:"hero" }); }catch(_){} };
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
    const score = probabilidadeRefinada(l) || Number(l.probabilityPercent) || 0;
    out.push({ l, parado, score });
  }
  out.sort((a,b) => b.score - a.score || b.parado - a.parado);
  return out.slice(0, 6).map(x => x.l);
}
function radarRowHTML(l){
  const idJs = JSON.stringify(String(l.id || ""));
  const parado = Number(l.daysSinceClientReply != null ? l.daysSinceClientReply : l.daysSinceLastInteraction) || 0;
  const score = probabilidadeRefinada(l) || Number(l.probabilityPercent) || 0;
  const rec = score >= 45 ? ["Alta","var(--acao)"] : score >= 25 ? ["Média","var(--lime)"] : ["Baixa","var(--morno)"];
  const etapa = normalizarEtapa(l.etapa);
  const teveProposta = leadTemProposta(l);
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
// frase, no topo da Home. Usa a etapa só pra CALCULAR (não exibe board). Sem CRM.
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
      "Visita/Proposta": `<b>${nG} clientes</b> já visitaram ou receberam proposta e sumiram — é seu dinheiro mais quente parado. Reaqueça antes de buscar lead novo.`,
      "Negociação": `<b>${nG} clientes</b> em negociação esfriando — corra pra fechar antes que esfriem de vez.`
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
    const bg = destaque ? "rgba(255,107,92,.14)" : "rgba(255,255,255,.05)";
    return `<button type="button" onclick='abrirGrupoHome(${JSON.stringify(grupo)})' style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:${bg};border:1px solid var(--line);font-size:12px;font-weight:950;cursor:pointer;color:var(--text)">
      <span>${meta.titulo}</span>
      <b style="background:${destaque?"var(--lime)":"rgba(255,255,255,.1)"};color:${destaque?"#FFFFFF":"var(--text)"};padding:1px 9px;border-radius:999px;font-size:11px">${n}</b>
    </button>`;
  };

  // Card de lead do top 3 (motivo destacado + WhatsApp).
  const cardTop = (l) => {
    const idStr = String(l.id||"");
    const idJs = JSON.stringify(idStr);
    const probRef = probabilidadeRefinada(l);
    const prob = probRef != null ? probRef : (Number(l.probabilityPercent) || 0);
    const probTxt = probabilidadeRefinadaTxt(l);
    const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction + "d parado" : "";
    const etapa = normalizarEtapa(l.etapa);
    const motivo = motivoCurto(l);
    const tags = [];
    if(lembreteVencido(l)) tags.push(`<span style="display:inline-block;padding:1px 7px;border-radius:999px;font-size:9px;font-weight:950;color:var(--on-accent);background:var(--lime);border:1px solid var(--lime);letter-spacing:.04em">⏰ LEMBRETE DE HOJE</span>`);
    else if(ehReaquecerUrgente(l)) tags.push(`<span style="display:inline-block;padding:1px 6px;border-radius:999px;font-size:9px;font-weight:950;color:var(--timing);background:rgba(255,45,155,.12);border:1px solid var(--timing);letter-spacing:.04em;white-space:nowrap">⚠ REAQUECER</span>`);
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
    top3Html = `<div style="padding:14px 16px;border:1px dashed var(--lime);border-radius:12px;background:rgba(255,107,92,.05);margin-bottom:12px">
      <div style="font-size:14px;font-weight:950;color:var(--lime);margin-bottom:4px">✅ Nenhum lead urgente agora</div>
      <div class="small" style="color:var(--soft)">Ótimo momento pra fazer retomadas proativas — leads que esfriaram mas ainda têm potencial.</div>
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
      <div class="radar-tit">⏳ Oportunidades esquecidas <span class="radar-sub">valiosas e esfriando — resgate antes de perder</span></div>
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
  items = items || state.itemsAtivos || [];
  const _esqRaiox = leadsEsquecidos(items); // mesmo radar usado no centro — pro Raio-X aqui da direita (desktop)
  const ativos = items.length;
  // Medidor = TOTAL de leads em aberto (escolha do usuário). Anel = proporção de leads
  // QUENTES (alta chance de venda) — ligado ao que importa: probabilidade de venda.
  const quentes = items.filter(l => { const p = probabilidadeRefinada(l) ?? (Number(l.probabilityPercent)||0); return p >= 55; }).length;
  const ringPct = ativos ? Math.max(6, Math.min(100, Math.round((quentes/ativos)*100))) : 0;
  const atendidosHoje = items.filter(ehAtendidoHoje).length;
  const atendidosSemana = items.filter(ehAtendidoNaSemana).length;
  const quaseFechando = items.filter(l => { const p = probabilidadeRefinada(l) ?? (Number(l.probabilityPercent)||0); return p >= 70; }).length;
  const _acaoHoje = state.gruposHome?.["acao-hoje"]?.length ?? 0;
  const _retomada = state.gruposHome?.["retomada"]?.length ?? 0;
  const prioritariosHoje = _acaoHoje > 0 ? _acaoHoje : _retomada;
  return `
    <div class="dash-card">
      <div class="dh"><h4>📊 Seu desempenho</h4><span class="dash-sub">Esta semana ▾</span></div>
      <div class="dash-desemp">
        <div class="gauge" style="--p:${ringPct}"><div class="gv"><b>${ativos}</b><span>Leads em aberto</span></div></div>
        <div class="dash-stats">
          <div class="st" style="cursor:pointer" onclick="show('home')" title="Ver atendidos hoje"><b>${atendidosHoje}</b><span>Atendidos hoje</span></div>
          <div class="st"><b>${atendidosSemana}</b><span>Atendidos na semana</span></div>
          <div class="st" style="cursor:pointer" onclick="abrirTodosLeads()" title="Ver quem está quase fechando"><b>${quaseFechando}</b><span>Quase fechando</span></div>
        </div>
      </div>
      <button type="button" class="dash-btn" onclick="show('relatorio')">Ver relatório completo</button>
    </div>
    <div class="dash-card">
      <div class="dh"><h4>Insights do Corretor Pro</h4></div>
      <div class="ins-item">
        <div class="ins-ic">↗</div>
        <div style="min-width:0">
          <div class="it">${_acaoHoje>0 ? `Você tem <b style="color:var(--lime)">${_acaoHoje}</b> lead${_acaoHoje>1?"s":""} urgente${_acaoHoje>1?"s":""} esperando ação agora.` : _retomada>0 ? `Nenhum urgente — <b style="color:var(--lime)">${_retomada}</b> retomada${_retomada>1?"s":""} proativa${_retomada>1?"s":""} sugerida${_retomada>1?"s":""}.` : "Tudo em dia! Nenhum lead pendente agora."}</div>
          ${prioritariosHoje>0 ? `<a onclick="verListaHoje()">Ver lista de hoje →</a>` : ""}
        </div>
      </div>
    </div>
    ${insightFocoHTML(items, _esqRaiox)}`;
}
function renderHomeRight(items){
  const el = qs("#homeRight");
  if(!el) return;
  el.innerHTML = (items && items.length) ? buildDesempenhoInsightsHTML(items) : "";
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
    <button type="button" id="maAcImportar" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,107,92,.06);color:var(--text);font-weight:900;font-size:14px;cursor:pointer;margin-bottom:10px">⇪ Importar conversa</button>
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

// Varre toda a carteira e ensina o Direciona a falar como você (junta suas respostas reais).
// Sem IA, sem custo — só leitura das conversas já salvas.
async function aprenderDaCarteira(){
  toast("Aprendendo das suas conversas…");
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action: "aprender-carteira" })
    });
    const d = await res.json().catch(()=>({ok:false}));
    if(d?.ok){
      toast(`✓ Aprendi com ${d.lidos} conversas — ${d.total} respostas suas no estilo. As sugestões já saem com a sua cara.`);
    } else {
      toast("Não consegui aprender agora: " + (d?.error || "erro"));
    }
  }catch(err){ toast("Erro: " + (err?.message||err)); }
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

// Avatar com a(s) inicial(is) do lead, colorido pela faixa de probabilidade.
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
// Barra de progresso da probabilidade.
function barraProgresso(prob, pctClass){
  const p = Math.max(0, Math.min(100, Math.round(Number(prob)||0)));
  return `<div class="pbar ${pctClass||""}" title="Probabilidade de fechar a venda"><i style="width:${p}%"></i></div>`;
}
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
  const probRef = probabilidadeRefinada(l);
  const prob = probRef != null ? probRef : (Number(l.probabilityPercent) || 0);
  const probTxt = probabilidadeRefinadaTxt(l);
  const pctClass = classePct(prob);
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
        <span style="font-size:11px;font-weight:800;color:var(--muted);white-space:nowrap" title="Chance de venda">${escapeHtml(probTxt)}</span>
      </div>
    </div>
    ${diasHtml}
  </div>`;
}

// Abre a lista de um grupo (clicou num dos botões).
// Cards mostram: nome, etapa/produto/dias, tags (ESFRIANDO/PERMUTA), motivo curto e
// ações rápidas (WhatsApp). Pro grupo com mais de 10 leads, divide em
// "ataca agora — top 10" e o restante colapsado.
function abrirGrupoHome(grupo){
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
    const probRef = probabilidadeRefinada(l);
    const prob = probRef != null ? probRef : (Number(l.probabilityPercent) || 0);
    const probTxt = probabilidadeRefinadaTxt(l);
    const contatadoHoje = ehContatadoHoje(l);
    const dias = (!contatadoHoje && l.daysSinceLastInteraction != null) ? l.daysSinceLastInteraction + "d parado" : "";
    const etapa = normalizarEtapa(l.etapa);
    const pctClass = classePct(prob);
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
       <button type="button" onclick="renderBotoesHome()" style="background:transparent;border:1px solid var(--line);border-radius:999px;padding:5px 12px;color:var(--soft);font-size:12px;font-weight:950;cursor:pointer">‹ Voltar</button>
       <b style="color:var(--lime);text-transform:uppercase;letter-spacing:.12em;font-weight:950;font-size:13px">${meta.titulo}</b>
       <span style="background:var(--lime);color:var(--on-accent);border-radius:999px;padding:0 9px;font-size:12px;font-weight:950">${arr.length}</span>
     </div>
     <div class="small" style="color:var(--muted);margin-bottom:12px;font-size:12px">${meta.sub}</div>
     ${barraBuscaLeadHTML("todos")}
     ${listaHtml}`;
  foco.scrollIntoView({ behavior:"smooth", block:"start" });
}
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
        body: JSON.stringify({ id: l.id })
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
  // Temperatura do lead pela probabilidade (cor + rótulo) — espelha o layout-alvo.
  const tempDe = (p) => p>=70 ? {c:"qq",t:"Muito quente",col:"var(--lime)"}
                      : p>=55 ? {c:"q", t:"Quente",      col:"var(--lime)"}
                      : p>=40 ? {c:"m", t:"Morno",       col:"var(--morno)"}
                      :         {c:"f", t:"Frio",        col:"var(--muted)"};
  box.style.display = "block";
  box.innerHTML =
    `<div class="fila-head"><h3>Fila inteligente</h3><span>Ordenada por prioridade</span></div>` +
    resto.map((l, i) => {
      const pos = i + 4;
      const idJs = JSON.stringify(String(l.id||""));
      const ehSel = selId && String(l.id) === selId;
      const probRef = probabilidadeRefinada(l);
      const prob = probRef != null ? probRef : (Number(l.probabilityPercent) || 0);
      const prioridade = prioridadeAtendimento(l) || {};
      const dias = l.daysSinceLastInteraction != null ? `${l.daysSinceLastInteraction} dias<br>sem resposta` : "";
      const etapa = normalizarEtapa(l.etapa);
      return `<div class="fila-row ${ehSel?"sel":""}" onclick='abrirLead(${idJs})'>
        <div class="fila-rank">${pos}</div>
        ${avatarInicial(l.name, classePct(prob))}
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
    const probRef = probabilidadeRefinada(l);
    const prob = probRef != null ? probRef : (Number(l.probabilityPercent) || 0);
    const probTxt = probabilidadeRefinadaTxt(l);
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
          <span class="pct-mini ${classePct(prob)}" title="Prioridade de atendimento">${escapeHtml(prioridadeTituloCurto(l))}</span>
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
  let esfriando = 0; // probabilidade alta + 3-7 dias sem retorno
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
    const prob = Number(l.probabilityPercent) || 0;
    const dias = Number(l.daysSinceLastInteraction) || 0;
    if(prob >= 60 && dias >= 3 && dias <= 7) esfriando++;
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
  const _bell = qs("#topBell"), _bb = qs("#bellBadge");
  if(_bell && _bb){
    if(agendaN > 0){
      _bb.hidden = false; _bb.textContent = agendaN > 9 ? "9+" : String(agendaN);
      _bell.classList.add("tem-alerta");
      _bell.setAttribute("title", `${agendaN} compromisso${agendaN>1?"s":""} de hoje — toque pra ver`);
    } else {
      _bb.hidden = true; _bell.classList.remove("tem-alerta"); _bell.setAttribute("title", "Agenda do dia");
    }
  }
  return agendaN;
}
window.atualizarSinoAgenda = atualizarSinoAgenda;

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
    // Sino do topo + nº da Agenda (compromissos/lembretes de HOJE). Mesma lógica de sempre,
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
      renderCorretorProDashboard(all, items, { vendasDoMes, totalVendasMes, ordenados });
      const _hr = qs("#homeRight"); if(_hr) _hr.innerHTML = "";
    } else {
      renderCorretorProDashboard(all, [], { vendasDoMes, totalVendasMes, ordenados:[] });
      const _hr = qs("#homeRight"); if(_hr) _hr.innerHTML = "";
      const area = qs("#top3Area"); if(area){ area.style.display = "none"; area.innerHTML = ""; }
      const fila = qs("#filaPrioridade"); if(fila){ fila.style.display = "none"; fila.innerHTML = ""; }
      // Empty state: nenhum lead ainda
      const foco = qs("#leadFocoArea");
      if(foco){
        foco.innerHTML = `
          <div class="card compact" style="background:linear-gradient(135deg,rgba(255,107,92,.04),rgba(55,232,255,.04));border:1px solid var(--line)">
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
  }
}


// ============ CORRETOR PRO — DASHBOARD APROVADO V653 ============
function cpIniciais(nome){
  const p = String(nome || "Cliente").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "C") + (p.length > 1 ? p[p.length-1][0] : "")).toUpperCase();
}
function cpAvatarHTML(l){
  const foto = l?.analysis?.avatarFoto || l?.avatarFoto;
  if(foto && /^data:image\//.test(String(foto))){
    return `<span class="cp-avatar"><img src="${escapeHtml(foto)}" alt="" loading="lazy"></span>`;
  }
  return `<span class="cp-avatar">${escapeHtml(cpIniciais(l?.name))}</span>`;
}
function cpTemperatura(l){
  const refinada = probabilidadeRefinada(l);
  const p = refinada == null || refinada === "" ? NaN : Number(refinada);
  const base = Number(l?.probabilityPercent) || 0;
  const prob = Number.isFinite(p) && p > 0 ? Math.max(p, base) : base;
  if(prob >= 70) return { nome:"Quente", cls:"hot", cor:"var(--cp-coral)" };
  if(prob >= 45) return { nome:"Morno", cls:"warm", cor:"var(--cp-orange)" };
  return { nome:"Frio", cls:"cold", cor:"var(--cp-blue)" };
}
function cpDiasInteracao(l){
  const d = Number(l?.daysSinceLastInteraction);
  if(!Number.isFinite(d)) return "—";
  if(d <= 0) return "Hoje";
  if(d === 1) return "Há 1 dia";
  return `Há ${d} dias`;
}
function cpHoraCompromisso(txt){
  const s = String(txt || "");
  const m = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if(m) return `${m[1].padStart(2,"0")}:${m[2]}`;
  if(/amanh[ãa]/i.test(s)) return "Amanhã";
  if(/hoje/i.test(s)) return "Hoje";
  return "Agora";
}
function cpValorTexto(raw){
  const n = parseValorVenda(raw);
  return Number.isFinite(n) ? n : 0;
}
function cpValorPotencial(l){
  const a = l?.analysis || {};
  const candidatos = [
    a?.proposta?.valor, a?.valorProposta, a?.valorImovel, a?.valorNegocio,
    a?.venda?.valor, l?.valor, l?.price
  ];
  for(const v of candidatos){
    const n = cpValorTexto(v);
    if(n > 0) return n;
  }
  return 0;
}
function cpDataHoje(){
  try{
    const d = new Intl.DateTimeFormat("pt-BR", { weekday:"long", day:"2-digit", month:"long" }).format(new Date());
    return d.charAt(0).toLowerCase() + d.slice(1);
  }catch(_){ return "Hoje"; }
}
function cpLembreteHoje(l){
  const q = l?.analysis?.lembrete?.quando;
  if(!q) return false;
  const t = new Date(q);
  if(Number.isNaN(t.getTime())) return false;
  const h = new Date();
  return t.getFullYear()===h.getFullYear() && t.getMonth()===h.getMonth() && t.getDate()===h.getDate();
}
function cpCompromissosDoLead(l){
  const aps = Array.isArray(l?.analysis?.confirmedAppointments) ? l.analysis.confirmedAppointments : [];
  return aps.map(ap => ({ lead:l, ap }));
}
function cpPrioridadeClasse(l){
  const p = prioridadeAtendimento(l) || {};
  const score = Number(p.score ?? l?._score ?? 0);
  if(score >= 70 || cpTemperatura(l).cls === "hot") return {nome:"Alta",cls:"high"};
  if(score >= 40 || cpTemperatura(l).cls === "warm") return {nome:"Média",cls:"medium"};
  return {nome:"Baixa",cls:"low"};
}
function cpSetText(id, valor){ const el=qs("#"+id); if(el) el.textContent=valor; }

function renderCorretorProDashboard(all, items, contexto){
  const dash = qs("#cpDashboard");
  if(!dash) return;
  all = Array.isArray(all) ? all : [];
  items = Array.isArray(items) ? items : [];
  contexto = contexto || {};
  const ordenados = Array.isArray(contexto.ordenados) ? contexto.ordenados : items.slice().sort(compararPrioridadeAtendimento);

  const dataEl = qs("#cpDashboardDate"); if(dataEl) dataEl.textContent = cpDataHoje();

  const agora = Date.now();
  const limite30 = agora - 30*86400000;
  const novos = items.filter(l => {
    const raw = l?.createdAt || l?.criadoEm || l?.created_at;
    const t = raw ? new Date(raw).getTime() : NaN;
    return normalizarEtapa(l.etapa)==="Novo" || (Number.isFinite(t) && t >= limite30);
  }).length;
  const visitas = items.filter(l => cpCompromissosDoLead(l).length || normalizarEtapa(l.etapa)==="Visita/Proposta").length;
  const propostas = items.filter(l => leadTemProposta(l) || ["Visita/Proposta","Negociação"].includes(normalizarEtapa(l.etapa))).length;
  const potencial = items.reduce((acc,l)=>acc+cpValorPotencial(l),0);
  const receita = potencial > 0 ? potencial : (Number(contexto.totalVendasMes)||0);

  cpSetText("cpKpiNovos", String(novos));
  cpSetText("cpKpiAtivos", String(items.length));
  cpSetText("cpKpiVisitas", String(visitas));
  cpSetText("cpKpiPropostas", String(propostas));
  cpSetText("cpKpiReceita", formatBRL(receita));
  cpSetText("cpKpiNovosSub", novos===1 ? "1 lead no período" : `${novos} leads no período`);
  cpSetText("cpKpiAtivosSub", "em acompanhamento");
  cpSetText("cpKpiVisitasSub", visitas ? "confirmadas ou em etapa" : "nenhuma confirmada");
  cpSetText("cpKpiPropostasSub", propostas ? "em proposta ou negociação" : "nenhuma em andamento");
  cpSetText("cpKpiReceitaSub", potencial > 0 ? "oportunidades com valor" : "vendas do mês");

  // Próximos atendimentos: compromisso real primeiro; completa com a fila prioritária.
  const compromissos = [];
  for(const l of items){
    for(const x of cpCompromissosDoLead(l)) compromissos.push(x);
  }
  const usados = new Set();
  const proximos = [];
  for(const x of compromissos){
    const id = String(x.lead?.id||"");
    if(!id || usados.has(id)) continue;
    usados.add(id); proximos.push({ lead:x.lead, quando:cpHoraCompromisso(x.ap?.quando), detalhe:x.ap?.tipo || x.ap?.descricao || "Compromisso confirmado" });
    if(proximos.length >= 4) break;
  }
  if(proximos.length < 4){
    for(const l of ordenados){
      const id=String(l?.id||""); if(!id || usados.has(id)) continue;
      usados.add(id); proximos.push({ lead:l, quando:Number(l.daysSinceLastInteraction)>0?cpDiasInteracao(l):"Agora", detalhe:motivoCurto(l) || produtosLabel(l) });
      if(proximos.length >= 4) break;
    }
  }
  const apBox=qs("#cpAppointments");
  if(apBox){
    apBox.innerHTML = proximos.length ? proximos.map(x=>{
      const l=x.lead, t=cpTemperatura(l), id=JSON.stringify(String(l.id||""));
      return `<div class="cp-appointment-row" onclick='abrirLead(${id})'>
        <span class="cp-appointment-time">${escapeHtml(x.quando)}</span>${cpAvatarHTML(l)}
        <span class="cp-appointment-copy"><strong>${escapeHtml(l.name||"Cliente")}</strong><small>${escapeHtml(x.detalhe||produtosLabel(l)||"Atendimento")}</small></span>
        <span class="cp-status ${t.cls}">${t.nome}</span>
      </div>`;
    }).join("") : `<div class="cp-empty-row">Nenhum atendimento pendente agora.</div>`;
  }

  // Donut de temperatura.
  const dist = { hot:0,warm:0,cold:0,lost:0 };
  for(const l of all){
    const etapa=normalizarEtapa(l.etapa);
    if(etapa==="Perdido"){ dist.lost++; continue; }
    if(etapa==="Vendido" || etapa==="Geladeira") continue;
    const c=cpTemperatura(l).cls; if(c==="hot") dist.hot++; else if(c==="warm") dist.warm++; else dist.cold++;
  }
  const totalDist=Math.max(1,dist.hot+dist.warm+dist.cold+dist.lost);
  const a=(dist.hot/totalDist)*100;
  const b=a+(dist.warm/totalDist)*100;
  const c=b+(dist.cold/totalDist)*100;
  const donut=qs("#cpPerformanceDonut"); if(donut){ donut.style.setProperty("--a",`${a}%`);donut.style.setProperty("--b",`${b}%`);donut.style.setProperty("--c",`${c}%`); }
  cpSetText("cpPerformanceTotal", String(items.length));
  const legend=qs("#cpPerformanceLegend");
  if(legend){
    const linhas=[
      ["Quentes",dist.hot,"var(--cp-coral)"],["Mornos",dist.warm,"var(--cp-orange)"],["Frios",dist.cold,"var(--cp-blue)"],["Descartados",dist.lost,"#294D5B"]
    ];
    legend.innerHTML=linhas.map(([n,v,cor])=>`<div class="cp-legend-row"><i style="background:${cor}"></i><span>${n}</span><b>${Math.round((v/totalDist)*100)}%</b></div>`).join("");
  }

  // Funil por etapa.
  const etapas=[
    ["Novos",all.filter(l=>normalizarEtapa(l.etapa)==="Novo").length],
    ["Qualificados",all.filter(l=>normalizarEtapa(l.etapa)==="Atendimento").length],
    ["Proposta",all.filter(l=>normalizarEtapa(l.etapa)==="Visita/Proposta").length],
    ["Negociação",all.filter(l=>normalizarEtapa(l.etapa)==="Negociação").length],
    ["Fechados",all.filter(l=>normalizarEtapa(l.etapa)==="Vendido").length]
  ];
  const maxEtapa=Math.max(1,...etapas.map(x=>x[1]));
  const stage=qs("#cpStageBars"); if(stage) stage.innerHTML=etapas.map(([nome,v])=>`<div class="cp-stage-row"><span>${nome}</span><div class="cp-stage-track"><div class="cp-stage-fill" style="width:${Math.max(v?12:0,(v/maxEtapa)*100)}%"></div></div><b>${v}</b></div>`).join("");

  // Atendimentos em andamento.
  const table=qs("#cpOngoingTable");
  if(table){
    const lista=ordenados.slice(0,4);
    table.innerHTML=lista.length ? lista.map(l=>{
      const t=cpTemperatura(l), pr=cpPrioridadeClasse(l), id=JSON.stringify(String(l.id||""));
      return `<tr onclick='abrirLead(${id})'>
        <td><span class="cp-lead-cell">${cpAvatarHTML(l)}<span><strong>${escapeHtml(l.name||"Cliente")}</strong><small>${escapeHtml(produtosLabel(l)||"Sem empreendimento informado")}</small></span></span></td>
        <td><span class="cp-status ${t.cls}">${t.nome}</span></td>
        <td>${escapeHtml(cpDiasInteracao(l))}</td>
        <td>${escapeHtml(motivoCurto(l)||l.nextAction||"Revisar atendimento")}</td>
        <td><span class="cp-priority ${pr.cls}">${pr.nome}</span></td><td><button class="cp-more" type="button">⋮</button></td>
      </tr>`;
    }).join("") : `<tr><td colspan="6"><div class="cp-empty-row">Sua carteira ainda está vazia.</div></td></tr>`;
  }

  // Atividades do dia, sem inventar números.
  const contatos=items.filter(ehContatadoHoje).length;
  let visitasHoje=0;
  for(const l of items){
    const aps=Array.isArray(l?.analysis?.confirmedAppointments)?l.analysis.confirmedAppointments:[];
    if(aps.some(ap=>/\bhoje\b/i.test(String(ap?.quando||"")))) visitasHoje++;
  }
  const lembretes=items.filter(cpLembreteHoje).length;
  const propAtivas=items.filter(l=>leadTemProposta(l)&&ehContatadoHoje(l)).length;
  const feitas=contatos+visitasHoje+lembretes+propAtivas;
  const meta=Math.max(10,feitas);
  const pct=Math.min(100,(feitas/meta)*100);
  const actDonut=qs("#cpActivityDonut"); if(actDonut) actDonut.style.setProperty("--done",`${pct}%`);
  cpSetText("cpActivityDone",String(feitas)); cpSetText("cpActivityGoal",`de ${meta} concluídas`);
  const act=qs("#cpActivityLegend"); if(act){
    const linhas=[["Contatos",contatos,"var(--cp-green)"],["Propostas",propAtivas,"var(--cp-coral)"],["Visitas",visitasHoje,"var(--cp-blue)"],["Tarefas",lembretes,"var(--cp-orange)"]];
    act.innerHTML=linhas.map(([n,v,cor])=>`<div class="cp-activity-row"><i style="background:${cor}"></i><span>${n}</span><b>${v}</b></div>`).join("");
  }

  const btn=qs("#cpContinueBtn");
  if(btn){ btn.disabled=!ordenados.length; btn.style.opacity=ordenados.length?"1":".45"; }
}
window.renderCorretorProDashboard=renderCorretorProDashboard;
function abrirPrimeiroDashboard(){
  const fila=(state.gruposHome?.["acao-hoje"]||[]).concat(state.gruposHome?.["retomar-cuidado"]||[]);
  const lead=fila[0] || (state.itemsAtivos||[]).slice().sort(compararPrioridadeAtendimento)[0];
  if(!lead){ toast("Nenhum atendimento pendente agora."); return; }
  abrirLead(String(lead.id||""));
}
window.abrirPrimeiroDashboard=abrirPrimeiroDashboard;

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
  const prob = (l) => probabilidadeRefinada(l) ?? (Number(l.probabilityPercent) || 0);
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
    case "prob-maior":  return arr.sort(desc(prob));
    case "prob-menor":  return arr.sort(asc(prob));
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
  carregarPipeline();
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
    const cardHtml = (l) => {
      const idJs = JSON.stringify(String(l.id||""));
      const nameJs = JSON.stringify(l.name||"");
      const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction+"d parado" : "";
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
      ord = items.slice().sort((a,b) => {
        const ta = a.lastInteractionAt || a.createdAt || "";
        const tb = b.lastInteractionAt || b.createdAt || "";
        return tb.localeCompare(ta);
      });
    } else if(pipelineTabAtiva === "todos"){
      ord = items.slice().sort((a,b) => (a.name||"").localeCompare(b.name||"", "pt-BR"));
    } else {
      // Oportunidades = prioridade real de atendimento, não probabilidade de venda.
      // Corrige o ponto que ainda fazia a tela Leads divergir da Home: lead com
      // contraproposta/pendência aberta deve subir mesmo que o percentual de venda não seja o maior.
      ord = items.slice().sort(compararPrioridadeAtendimento);
    }
    board.innerHTML = `<div class="leads-list">${ord.map(cardHtml).join("")}</div>`;
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

async function apagarLead(id, nome){
  if(!id) return;
  if(!confirm(`Apagar lead "${nome||"sem nome"}"? Não tem como desfazer.`)) return;
  try{
    const res = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id, action: "apagar" }) });
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
            <button type="button" id="editLeadAvatarBtn" style="flex:1;padding:10px;background:rgba(255,107,92,.08);color:var(--lime);border:1px dashed var(--lime);border-radius:10px;font-size:13px;font-weight:950;cursor:pointer">🖼️ Anexar foto</button>
            <button type="button" id="editLeadAvatarColar" style="flex:1;padding:10px;background:rgba(255,107,92,.08);color:var(--lime);border:1px dashed var(--lime);border-radius:10px;font-size:13px;font-weight:950;cursor:pointer">📋 Colar imagem</button>
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
          <input type="text" id="editLeadProduto" list="editLeadProdutoLista" data-orig="${escapeHtml(produtoIni)}" value="${escapeHtml(produtoIni)}" placeholder="Ex.: Nova Vila Rica III" autocomplete="off" style="width:100%;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box">
          <datalist id="editLeadProdutoLista">${EMPREENDIMENTOS_SENGER.map(p => `<option value="${escapeHtml(p)}"></option>`).join("")}</datalist>
          <div class="small" style="color:var(--muted);font-size:10px;margin-top:5px">Escolha da lista ou digite. Deixe em branco se ainda não souber.</div>
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
const EMPREENDIMENTOS_SENGER = ["Renaissance","Quality","Prime","Personalité","Boulevard","Premium Office","Evolutti","Nova Vila Rica I","Nova Vila Rica II","Nova Vila Rica III","Residencial GABRO","Edifício Campos Elísios"];
function abrirNovoLead(){
  novoLeadAvatarFoto = null;
  qs("#novoLeadModal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "novoLeadModal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  const opcoes = EMPREENDIMENTOS_SENGER.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  overlay.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:24px;max-width:460px;width:100%;max-height:90vh;overflow:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:16px;font-weight:950">+ Novo lead</div>
        <button type="button" id="novoLeadFechar" style="background:transparent;border:0;color:var(--muted);font-size:20px;cursor:pointer;padding:0 4px">✕</button>
      </div>
      <div class="small" style="color:var(--muted);font-size:11px;margin-bottom:14px">Pra quando alguém liga, comenta pessoalmente ou indica e ainda não houve troca no WhatsApp. Salva o lead pra você não esquecer.</div>
      <div style="margin-bottom:16px">
        <button type="button" id="novoLeadPrint" style="width:100%;padding:11px;background:rgba(255,255,255,.04);color:var(--soft);border:1px dashed var(--line);border-radius:10px;font-size:13px;font-weight:950;cursor:pointer">📷 Preencher por print da conversa</button>
        <input type="file" id="novoLeadPrintInput" accept="image/*" style="display:none">
        <div id="novoLeadPrintStatus" style="display:none;margin-top:7px;font-size:12px;font-weight:700;padding:8px 10px;border-radius:8px;line-height:1.35"></div>
        <div id="novoLeadFotoWrap" style="display:none;align-items:center;gap:10px;margin-top:8px"><div id="novoLeadFotoPrev"></div><button type="button" id="novoLeadFotoRemover" style="background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 10px;color:var(--muted);font-size:11px;font-weight:900;cursor:pointer">Remover foto</button></div>
        <div class="small" style="color:var(--muted);font-size:10px;margin-top:5px">Manda o print do WhatsApp/formulário (ex.: lead do Instagram/Facebook) e o Corretor Pro preenche os campos abaixo — e tenta recortar a foto do cliente. Você confere e salva.</div>
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Nome *</label>
        <input type="text" id="novoLeadNome" placeholder="Nome do cliente" autocomplete="off" style="width:100%;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Telefone (WhatsApp)</label>
        <input type="tel" id="novoLeadTel" placeholder="+55 54 99999-9999" autocomplete="off" style="width:100%;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Empreendimento de interesse</label>
        <select id="novoLeadProduto" style="width:100%;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box">
          <option value="">— Sem definir ainda —</option>
          ${opcoes}
        </select>
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;margin-bottom:5px">Observação inicial</label>
        <textarea id="novoLeadObs" rows="3" placeholder="Como o lead chegou, o que conversou, o que pediu..." style="width:100%;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:13px;resize:vertical;box-sizing:border-box;font-family:inherit"></textarea>
      </div>
      <button type="button" id="novoLeadSalvar" style="width:100%;padding:12px;background:linear-gradient(135deg,var(--lime),var(--acao));color:var(--on-accent);border:0;border-radius:10px;font-size:14px;font-weight:950;cursor:pointer">Salvar lead</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if(e.target === overlay) fecharNovoLead(); });
  qs("#novoLeadFechar")?.addEventListener("click", fecharNovoLead);
  qs("#novoLeadSalvar")?.addEventListener("click", salvarNovoLead);
  qs("#novoLeadPrint")?.addEventListener("click", () => qs("#novoLeadPrintInput")?.click());
  qs("#novoLeadPrintInput")?.addEventListener("change", lerPrintLead);
  qs("#novoLeadFotoRemover")?.addEventListener("click", () => { novoLeadAvatarFoto = null; mostrarPreviaFoto(); });
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
  const telefone = (qs("#novoLeadTel")?.value || "").trim();
  const produto = (qs("#novoLeadProduto")?.value || "").trim();
  const observacao = (qs("#novoLeadObs")?.value || "").trim();
  if(!nome){ toast("Coloque o nome do lead."); qs("#novoLeadNome")?.focus(); return; }
  const btn = qs("#novoLeadSalvar");
  if(btn){ btn.disabled = true; btn.textContent = "Salvando..."; }
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"criar-manual", nome, telefone, produto, observacao, avatarFoto: novoLeadAvatarFoto || "" })
    });
    const data = await res.json().catch(() => ({ ok:false }));
    if(data?.ok){
      toast("✓ Lead criado.");
      fecharNovoLead();
      await loadRecentLeads();
      await carregarDashboard();
      if(data.id) abrirLead(data.id);
    } else {
      toast("Erro: " + (data?.error || "falhou"));
      if(btn){ btn.disabled = false; btn.textContent = "Salvar lead"; }
    }
  }catch(err){
    toast("Erro: " + (err?.message || err));
    if(btn){ btn.disabled = false; btn.textContent = "Salvar lead"; }
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
        body: JSON.stringify({ id, action:"corrigir-observacao", texto: obsNova })
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
        body: JSON.stringify({ id })
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
    const res = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id, action: "apagar" }) });
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

async function abrirLead(id){
  if(!id) return;
  const sid = String(id);
  state.focoLeadId = sid;
  state.timelineVisibleCount = TIMELINE_PAGE_SIZE;
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
        `<b>Última interação:</b> ${lead.daysSinceLastInteraction != null ? lead.daysSinceLastInteraction+" dia(s) atrás" : "--"}<br>` +
        `<b>Mensagens:</b> ${totalMensagensLead(lead)}<br>` +
        `<b>Áudios:</b> ${lead.audiosEncontrados||0} encontrados, ${lead.audiosTranscritos||0} transcritos`;
    }
    showCard("resultCard", true);
    renderAnalysis(state.analysis, state.lead);
    renderLeadFoco(state.lead);
    if(state.top3) renderTop3(state.top3);
    renderLeads();
    show("home", { skipLoad:true });
    const t = qs("#toast"); if(t) t.classList.remove("show");
  };

  // Começa o detalhe completo em paralelo, mas não prende o clique esperando a rede.
  const detalhePromise = getLeadDetail(sid);
  let lead = emMemoria();
  const area = qs("#leadFocoArea");
  if(area) area.innerHTML = `<div class="skel-loading" style="padding:16px 0"><div style="height:26px;width:55%;border-radius:8px;background:var(--panel);border:1px solid var(--line);animation:skel-pulse 1.4s ease-in-out infinite;margin-bottom:10px"></div><div class="skel-row"></div><div class="skel-row skel-row--sm"></div><div class="skel-row skel-row--sm"></div></div>`;
  show("home", { skipLoad:true });

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
  "indicacao": { txt:"Indicação", cor:"var(--lime)", bg:"rgba(255,107,92,.12)" },
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
  "frio-reaquecer": { txt:"Reaquecer", cor:"var(--dados)", bg:"rgba(55,232,255,.12)" },
  "objecao-tratar": { txt:"Tratar objeção", cor:"var(--morno)", bg:"rgba(255,155,59,.14)" },
  "informacao-enviar": { txt:"Enviar material", cor:"var(--cerebro)", bg:"rgba(196,92,255,.14)" },
  "primeiro-contato": { txt:"Primeiro contato", cor:"var(--lime)", bg:"rgba(255,107,92,.12)" },
  "stand-by": { txt:"Stand-by", cor:"var(--muted)", bg:"rgba(255,255,255,.06)" }
};

const MATERIAL_LABEL = {
  "planta":"Planta","tabela":"Tabela","video":"Vídeo","folder":"Folder",
  "localizacao":"Localização","memorial":"Memorial descritivo","simulacao":"Simulação",
  "comparativo":"Comparativo","convite-visita":"Convite pra visita",
  "material-valorizacao":"Valorização","material-wellness":"Lazer/wellness"
};

function badgeConfianca(c){
  const n = Number(c) || 0;
  if(n <= 0) return "";
  let cor, bg, label;
  if(n >= 75){ cor = "var(--acao)"; bg = "rgba(104,255,149,.14)"; label = "Alta confiança"; }
  else if(n >= 45){ cor = "var(--timing)"; bg = "rgba(255,45,155,.14)"; label = "Confiança média"; }
  else { cor = "var(--morno)"; bg = "rgba(255,155,59,.14)"; label = "Confiança baixa"; }
  return `<span title="Confiança da análise (quanto contexto teve pra avaliar)" style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:950;color:${cor};background:${bg};border:1px solid ${cor};letter-spacing:.04em">${label} · ${n}%</span>`;
}

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
  "esfriou": { txt:"Esfriou", cor:"var(--risco)" },
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
  state.lead = null;
  state.focoLeadId = null;
  state.analysis = null;
  if(state.grupoAtivo){ abrirGrupoHome(state.grupoAtivo); }
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

function renderLeadFoco(lead){
  const area = qs("#leadFocoArea");
  if(!area || !lead) return;
  document.body.classList.add("lead-foco-aberto"); // esconde "Reanalisar todos" do topo enquanto vê um lead
  state.focoLeadId = lead?.id || null; // marca o lead em foco — o auto-refresh não pode derrubá-lo
  const saud = qs("#saudacao");
  if(saud) saud.style.display = "none";
  const a = lead.analysis || {};
  const memManual = a.memoria || {};
  const memIA = a.memoriaSugerida || {};
  // Memória mostrada: manual tem prioridade; quando vazio, usa o que a IA extraiu da conversa
  const memoria = {
    pessoasDecisao: memManual.pessoasDecisao || memIA.pessoasDecisao || "",
    pontosSensiveis: memManual.pontosSensiveis || memIA.pontosSensiveis || "",
    preferencias: memManual.preferencias || memIA.preferencias || "",
    observacoes: memManual.observacoes || [memIA.momentoDeVida, memIA.faixaValor, memIA.observacoes].filter(Boolean).join(" · ") || ""
  };
  const cerebroResumo = (a.cerebro_aplicado || a.cerebro || "").toString().slice(0,160);
  const objecoes = Array.isArray(a.objections) ? a.objections.slice(0,3).join(" · ") : "";
  // "O que pesa contra": junta objeções (o que trava agora) + pontos sensíveis (histórico), sem repetir.
  const pesaContraSet = [];
  const pushUnico = (txt) => {
    const t = String(txt||"").trim();
    if(!t) return;
    const norm = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
    if(!pesaContraSet.some(x => x.norm === norm)) pesaContraSet.push({ txt: t, norm });
  };
  (Array.isArray(a.objections) ? a.objections.slice(0,3) : []).forEach(pushUnico);
  String(memoria.pontosSensiveis||"").split(/[·\n;]+/).forEach(pushUnico);
  const pesaContra = pesaContraSet.map(x => x.txt).join(" · ");
  const phone = lead.phone || "";
  const nome0 = String(lead.name||"").trim().split(/\s+/)[0]||"";
  const _msgsSalvas = mensagensDaAnalise(a);
  const _msgA = _msgsSalvas.a;
  const _msgB = _msgsSalvas.b;
  const _msgC = _msgsSalvas.c;
  const _labelA = _msgsSalvas.aLabel;
  const _labelB = _msgsSalvas.bLabel;
  const _labelC = _msgsSalvas.cLabel;
  const _rec = _msgsSalvas.recomendada;
  // Desativado: as "Outras sugestões por objetivo" vinham do motor antigo de CRM e podiam
  // exibir rótulos/mensagens genéricas mesmo quando as 3 respostas principais estavam boas.
  // O foco agora é: 3 respostas geradas pela IA, sem camada paralela.
  const _objetivos = [];
  const _objetivosHtml = "";
  let msgInicial = mensagemAprovadaSemAlteracao(_msgA);
  let linkWA = whatsappLink(phone, msgInicial);
  const badgeConf = badgeConfianca(a.confianca);
  const badgeRet = badgeTipoRetomada(a.tipoRetomada);
  const probRefLead = probabilidadeRefinada(lead);
  const probLeadN = probRefLead != null ? probRefLead : (Number(lead.probabilityPercent) || 0);
  const tipoContatoEfetivo = tipoContatoEfetivoLead(lead, a);
  const contatoEhParceiro = /parceir|corretor/i.test(tipoContatoEfetivo);
  const metaTipoContato = lead.id ? tipoContatoTextoMeta(tipoContatoEfetivo) : ""; // só pra leads salvos (precisa de id pra clicar)
  const blocoHistorico = renderHistoricoContatos(lead);
  const blocoEvolucao = renderEvolucao(lead);
  const blocoParecidos = renderLeadsParecidos(lead);
  // FICHA COMPLETA DO CLIENTE — toda a informação de referência (perfil, por quê, preferências,
  // pessoas, o que pesa contra, observações, materiais, histórico) recolhida atrás de um toque,
  // pra tela não virar muro de texto. Mesmos cards de antes; abre só quando se quer aprofundar.
  const _fichaCss = "padding:11px 13px;background:var(--card);border:1px solid var(--line);border-radius:10px;font-size:13px;line-height:1.5";
  const _fichaLbl = "display:block;font-size:9px;letter-spacing:.18em;text-transform:uppercase;font-weight:950;margin-bottom:4px;color:var(--muted)";
  const _fichaCard = (lbl, val) => val ? `<div style="${_fichaCss}"><b style="${_fichaLbl}">${lbl}</b>${val}</div>` : "";
  const _fichaCards = [
    (a.clientProfile && typeof a.clientProfile === "string" && a.clientProfile !== "—") ? _fichaCard("Perfil do cliente", escapeHtml(a.clientProfile).slice(0,180)) : "",
    a.summary ? _fichaCard("Por quê este lead", escapeHtml(a.summary).slice(0,200)) : "",
    memoria.preferencias ? _fichaCard("Preferências", escapeHtml(memoria.preferencias)) : "",
    memoria.pessoasDecisao ? _fichaCard("Pessoas decisão", escapeHtml(memoria.pessoasDecisao)) : "",
    a.permuta ? `<div style="${_fichaCss};background:rgba(196,92,255,.06);border-color:var(--cerebro)"><b style="${_fichaLbl};color:var(--cerebro)">Permuta</b>${escapeHtml(a.permutaResumo || "Cliente quer dar/vender um bem como parte do negócio — depende de vender antes de fechar.")}</div>` : "",
    pesaContra ? _fichaCard("O que pesa contra", escapeHtml(pesaContra)) : "",
    memoria.observacoes ? _fichaCard("Observações", escapeHtml(memoria.observacoes)) : "",
    blocoHistorico
  ].filter(Boolean).join("");
  const conteudoFichaCliente = _fichaCards.trim()
    ? `<div style="display:flex;flex-direction:column;gap:8px">${_fichaCards}</div>`
    : "";
  const blocoFichaCliente = conteudoFichaCliente
    ? `<details class="ficha-cliente"><summary>Ficha completa do cliente</summary><div style="margin-top:10px">${conteudoFichaCliente}</div></details>`
    : "";
  const barraTopo = state.sequencia
    ? `<div style="display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:10px 12px;border:1px solid var(--lime);border-radius:12px;background:linear-gradient(135deg,rgba(255,107,92,.08),rgba(0,212,255,.05));flex-wrap:wrap">
         <span style="font-weight:950;font-size:13px;color:var(--lime)">▶ Atendendo ${state.sequencia.idx+1} de ${state.sequencia.ids.length}</span>
         <div style="flex:1;min-width:8px"></div>
         <button type="button" onclick="proximoDaSequencia()" style="border:0;border-radius:999px;padding:7px 18px;color:var(--on-accent);background:linear-gradient(135deg,var(--lime),var(--cyan));font-size:13px;font-weight:950;cursor:pointer">${state.sequencia.idx >= state.sequencia.ids.length-1 ? "Finalizar ✓" : "Próximo →"}</button>
         <button type="button" onclick="sairDaSequencia()" title="Sair do modo sequência" style="background:transparent;border:1px solid var(--line);border-radius:999px;padding:6px 12px;color:var(--muted);font-size:12px;font-weight:950;cursor:pointer">Sair</button>
       </div>`
    : "";
  const diagObj = (a.diagnostico && typeof a.diagnostico === "object") ? a.diagnostico : {};
  const leituraComercial = (a.leituraComercial && typeof a.leituraComercial === "object") ? a.leituraComercial : {};
  const OBJ_TOP = { moradia:"Moradia", investimento:"Investimento", "moradia-futura":"Moradia futura", construcao:"Construção", troca:"Troca", renda:"Renda", especulacao:"Valorização" };
  const ETP_TOP = { descoberta:"Descoberta", interesse:"Interesse", comparacao:"Comparação", "analise-financeira":"Análise financeira", negociacao:"Negociação", decisao:"Decisão" };
  const objetivoTopo = contatoEhParceiro ? "Intermediação" : (OBJ_TOP[String(diagObj.objetivo||"").toLowerCase()] || "");
  const etapaTopo = ETP_TOP[String(diagObj.etapa||"").toLowerCase()] || normalizarEtapa(lead.etapa||"");
  const interesseTopo = String(diagObj.interesse||"").toLowerCase();
  const interesseTxt = interesseTopo ? `Interesse ${interesseTopo}` : "";
  const interesseCor = interesseTopo === "alto" ? "var(--acao)" : (interesseTopo === "medio" ? "var(--morno)" : "var(--soft)");
  const temperaturaTopo = leituraComercial.temperatura || (interesseTopo === "alto" ? "quente" : (interesseTopo === "medio" ? "morno" : "frio"));
  // O card do lead também deve mostrar PRIORIDADE DE ATENDIMENTO, não probabilidade de venda.
  // Antes isso podia contradizer a fila: um lead com contraproposta aguardando retorno podia
  // aparecer como "Prioridade baixa" só porque a probabilidade refinada estava baixa.
  const prioridadeAtendTopo = prioridadeAtendimento(lead) || {};
  const prioridadeTopo = prioridadeAtendTopo.titulo || (probLeadN >= 70 ? "Alta" : (probLeadN >= 45 ? "Média" : "Baixa"));
  const _grupoPrioridadeTopo = String(prioridadeAtendTopo.grupo || "");
  const prioridadeCor = _grupoPrioridadeTopo === "acao-hoje" ? "var(--acao)" : (_grupoPrioridadeTopo === "retomar-cuidado" ? "var(--lime)" : (_grupoPrioridadeTopo === "pode-aguardar" || _grupoPrioridadeTopo === "tratado-hoje" ? "var(--morno)" : "var(--soft)"));
  let respostaTopo = lead.daysSinceClientReply; if(respostaTopo==null) respostaTopo = _diasDesdeMsg(lead, true);
  const fmtDiasTopo = n => n==null ? "—" : n<=0 ? "hoje" : n===1 ? "há 1 dia" : `há ${n} dias`;
  const _nextActionSafe = (a.mode === 'erro_api') ? null : a.nextAction;
  const proximaAcaoTxt = String(_nextActionSafe || leituraComercial.oQueDestravar || a.melhorPergunta || "Reanalise este lead para gerar a próxima ação.").trim();
  const subtituloLead = [String(produtosLabel(lead)||"").trim(), metaTipoContato ? metaTipoContato.replace(/^\s*•\s*/,"") : ""].filter(Boolean).join(" • ") || "Lead";
  const _erroApi = a.mode === 'erro_api';
  const _msgNaoGerada = "Toque em Reanalisar para gerar uma resposta com o histórico completo.";
  const _mensagensAprovadas = _msgsSalvas.aprovada === true;
  let cardsMensagens = _mensagensAprovadas
    ? [
        { key:"a", label:_labelA, icon:"✧", color:"var(--lime)", msg:_msgA },
        { key:"b", label:_labelB, icon:"◇", color:"var(--lime)", msg:_msgB },
        { key:"c", label:_labelC, icon:"▣", color:"var(--lime)", msg:_msgC }
      ]
    : [];
  const cardsMensagensHtml = cardsMensagens.map((item, idx)=>`<button type="button" class="msg-card-foco${idx===0?' active':''}" data-style="${item.key}" title="Usar esta sugestão" style="text-align:left;padding:9px 10px;background:${idx===0?'rgba(255,107,92,.08)':'rgba(255,255,255,.03)'};border:1px solid ${idx===0?'var(--lime)':'var(--line)'};border-radius:12px;color:var(--text);cursor:pointer;display:flex;align-items:flex-start;gap:9px;min-height:72px">
      <span style="flex:none;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:8px;color:var(--lime);background:rgba(255,107,92,.08);font-size:14px">${item.icon}</span>
      <span style="display:block;min-width:0;flex:1">
        <b style="display:flex;align-items:center;gap:6px;color:#fff;font-size:12px;font-weight:950;margin-bottom:3px;line-height:1.15">${escapeHtml(item.label)}${_rec===item.key && _mensagensAprovadas ? '<em style="font-style:normal;color:var(--lime);font-size:9px;border:1px solid rgba(255,107,92,.35);border-radius:999px;padding:1px 5px">recomendada</em>' : ''}</b>
        <span style="display:block;color:var(--soft);font-size:11px;line-height:1.25">${escapeHtml(_cortarFrase(item.msg, 95))}</span>
      </span>
      <span style="flex:none;color:var(--muted);font-size:16px;line-height:1">›</span>
    </button>`).join('');
  msgInicial = _mensagensAprovadas ? cardsMensagens[0].msg : _msgNaoGerada;
  const _mensagemValidaParaEnvio = _mensagensAprovadas;
  linkWA = _mensagemValidaParaEnvio ? whatsappLink(phone, msgInicial) : "#";
  const analiseComercialVisivelHtml = analiseComercialPrincipalHTML(a);
  const diagnosticoDetalheHtml = diagnosticoClienteHTML(a) || `<div class="small" style="color:var(--muted);padding:12px 4px 0">Ainda não há uma leitura complementar salva para este lead.</div>`;
  const sugestoesObjetivoDetalheHtml = "";
  const _histTodas = Array.isArray(lead.recentMessages) ? lead.recentMessages : [];
  const _histTotal = totalMensagensLead(lead);
  const _histLimite = Math.max(TIMELINE_PAGE_SIZE, Number(state.timelineVisibleCount || TIMELINE_PAGE_SIZE));
  const _histVisiveis = _histTodas.slice(-_histLimite);
  const _histRestantes = Math.max(0, _histTodas.length - _histVisiveis.length);
  const historicoConversaHtml = _histTodas.length ? `
        <details style="margin-top:12px">
          <summary style="cursor:pointer;list-style:none;color:var(--soft);font-size:13px;font-weight:950;display:flex;align-items:center;gap:8px">
            <span style="display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:6px;font-size:12px">»</span>
            Ver histórico de conversa <span style="color:var(--muted);font-weight:600;font-size:11px">(${_histTotal} mensagens)</span>
          </summary>
          <div style="margin-top:10px;display:flex;justify-content:flex-end">
            <button type="button" onclick='copiarHistoricoLead()' style="padding:5px 12px;background:rgba(255,255,255,.05);color:var(--soft);border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Copiar todas as mensagens</button>
          </div>
          <div class="small" style="margin:8px 0 2px;color:var(--muted);font-size:10px;display:flex;gap:14px;flex-wrap:wrap">
            <span>● <span style="color:var(--muted)">WhatsApp (importado)</span></span>
            <span style="color:var(--lime)">▍ ✍ anotação manual</span>
          </div>
          <div style="margin-top:6px;max-height:280px;overflow-y:auto;padding-right:4px">
            ${(()=>{ window._tlProp = []; return ""; })()}
            ${[..._histVisiveis].reverse().map(m => {
              const _pnome = String(lead.name||"").toLowerCase().trim().split(/\s+/)[0]||"";
              const manual = m.source === "manual" || m.source === "crm" || ["atendimento","nota","ligacao","visita","presencial"].includes(String(m.type||""));
              let btnProp = "";
              if(m.proposta){
                const idx = window._tlProp.push(m.proposta)-1;
                const lidJs = JSON.stringify(String(lead.id||"")), nmJs = JSON.stringify(lead.name||"");
                const btnExcluir = m.iso ? `<button type="button" onclick='excluirPropostaTimeline(${lidJs}, ${JSON.stringify(m.iso)})' style="padding:5px 12px;background:rgba(255,90,90,.08);color:#ff8a8a;border:1px solid rgba(255,90,90,.5);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">🗑 Excluir</button>` : "";
                btnProp = `<div style="margin-top:7px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" onclick='abrirPropostaSalva(${lidJs}, ${nmJs}, window._tlProp[${idx}])' style="padding:5px 12px;background:rgba(255,255,255,.05);color:var(--soft);border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">📄 Abrir e editar proposta</button>${btnExcluir}</div>`;
              }
              const hdr = escapeHtml((m.date||"")+" "+(m.time||"")+" — "+limparAutorAtend(m.author||""));
              if(manual){
                return `<div style="padding:9px 11px;margin-bottom:8px;border-left:3px solid var(--lime);background:rgba(255,107,92,.06);border-radius:8px;font-size:11px;line-height:1.35"><b style="color:var(--lime);font-size:10px;letter-spacing:.05em">${hdr} · ✍ anotação manual</b><div style="color:var(--white);margin-top:3px">${escapeHtml(m.text||"")}</div>${btnProp}</div>`;
              }
              const doCliente = ehMsgDoCliente(m, _pnome);
              const lado = doCliente ? "flex-start" : "flex-end";
              const bolha = doCliente ? "background:rgba(255,255,255,.05);border:1px solid var(--line)" : "background:rgba(255,107,92,.08);border:1px solid rgba(255,107,92,.22)";
              const corHdr = doCliente ? "var(--muted)" : "var(--lime)";
              return `<div style="display:flex;justify-content:${lado};margin-bottom:8px"><div style="max-width:82%;${bolha};border-radius:14px;padding:9px 13px;font-size:13px;line-height:1.45"><b style="color:${corHdr};font-size:10px;letter-spacing:.04em;display:block;margin-bottom:3px">${hdr}</b><div style="color:var(--white)">${escapeHtml(m.text||"")}</div>${btnProp}</div></div>`;
            }).join("")}
            ${_histRestantes > 0 ? `<button type="button" onclick="carregarMaisHistoricoLead()" style="width:100%;margin:8px 0 2px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.04);color:var(--soft);font-weight:900;cursor:pointer">Carregar mais ${Math.min(TIMELINE_PAGE_SIZE, _histRestantes)} mensagens anteriores</button>` : ""}
            ${!lead.historyLoaded ? `<div class="small" style="padding:10px;color:var(--muted);text-align:center">Carregando o histórico completo…</div>` : ""}
          </div>
        </details>` : "";
  area.innerHTML = `
    ${barraTopo}
    <div class="lead-foco">
      <div class="card hero-foco lead590" style="background:var(--panel);border:1px solid var(--line);border-top:2px solid var(--lime);border-radius:16px;padding:12px;box-shadow:none;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          ${lead.id ? `<div id="focoAvatarWrap" style="position:relative;flex:none;cursor:pointer" onclick="document.getElementById('editAvatarInput')?.click()" title="Editar foto do avatar">${avatarLead(lead, "lg")}</div><input type="file" id="editAvatarInput" accept="image/*" style="display:none" onchange="editarAvatarLead(event, '${String(lead.id)}')">` : avatarLead(lead, "lg")}
          <div style="flex:1;min-width:220px">
            <div style="font-size:20px;font-weight:950;color:#fff;line-height:1.12;word-break:break-word">${escapeHtml(lead.name||"Cliente")}</div>
            <div class="small" style="color:var(--muted);margin-top:2px;font-size:12px">${escapeHtml(subtituloLead)}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
            ${interesseTxt ? `<span style="display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;border:1px solid ${interesseCor};color:${interesseCor};font-size:11px;font-weight:900">✦ ${escapeHtml(interesseTxt)}</span>` : ``}
            ${objetivoTopo ? `<span style="display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;border:1px solid var(--line);color:var(--soft);font-size:11px;font-weight:900">⌂ ${escapeHtml(objetivoTopo)}</span>` : ``}
            ${etapaTopo ? `<span style="display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;border:1px solid var(--line);color:var(--soft);font-size:11px;font-weight:900">🤝 ${escapeHtml(etapaTopo)}</span>` : ``}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:7px">
          <div style="padding:7px 10px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.03)"><div class="small" style="color:var(--muted);font-size:10px">Temperatura</div><div style="margin-top:4px;font-size:15px;font-weight:900;color:#fff">${escapeHtml(String(temperaturaTopo).charAt(0).toUpperCase()+String(temperaturaTopo).slice(1))}</div></div>
          <div style="padding:7px 10px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.03)"><div class="small" style="color:var(--muted);font-size:10px">Prioridade</div><div style="margin-top:4px;font-size:15px;font-weight:900;color:${prioridadeCor}">${escapeHtml(prioridadeTopo)}</div></div>
          <div style="padding:7px 10px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.03)"><div class="small" style="color:var(--muted);font-size:10px">Última resposta</div><div style="margin-top:4px;font-size:15px;font-weight:900;color:#fff">${escapeHtml(fmtDiasTopo(respostaTopo))}</div></div>
        </div>
        ${analiseComercialVisivelHtml}
        <div style="border:1px solid rgba(255,107,92,.22);border-radius:14px;padding:11px;background:linear-gradient(180deg,rgba(255,107,92,.05),rgba(255,255,255,.02))">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div>
              <div style="font-size:16px;font-weight:950;color:#fff;line-height:1.15">Próxima ação recomendada</div>
              <div style="margin-top:3px;color:var(--soft);font-size:11px;line-height:1.25">${escapeHtml(proximaAcaoTxt)}</div>
            </div>
            ${lead.id ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" onclick='abrirEditarLead(${JSON.stringify(String(lead.id))}, ${safeJson(lead.name||"")}, ${safeJson(lead.phone||"")})' title="Editar nome e telefone" style="background:transparent;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:10px;font-weight:900;cursor:pointer">✎ Editar</button></div>` : ``}
          </div>
          <div id="msgFocoText" contenteditable="true" style="margin-top:8px;background:var(--input);border:1px solid rgba(255,107,92,.45);border-radius:11px;padding:10px 12px;font-size:13px;line-height:1.38;color:#fff;min-height:42px;max-height:76px;overflow:auto;white-space:pre-wrap;outline:none" spellcheck="true">${escapeHtml(msgInicial)}</div>
          <div class="small" style="margin-top:3px;color:var(--muted);font-size:10px">Pode editar antes de enviar.</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:7px;margin-top:8px">
            <a class="btn" href="${escapeHtml(linkWA)}" target="_blank" id="btnFocoWA" ${_mensagemValidaParaEnvio ? "" : 'aria-disabled="true" onclick="return false"'} style="text-align:center;padding:9px;text-decoration:none;${_mensagemValidaParaEnvio ? "" : "opacity:.45;pointer-events:none"}">Abrir WhatsApp</a>
            <button class="btn secondary" type="button" id="btnFocoCopiar" style="padding:9px">Copiar mensagem</button>
            ${lead.id ? `<button type="button" id="btnReanalisarSemTexto" title="Roda a análise de novo, sem registrar atendimento" style="padding:9px;background:rgba(255,255,255,.04);color:var(--text);border:1px solid var(--line);border-radius:11px;font-size:12px;font-weight:900;cursor:pointer">↻ Reanalisar</button>` : ``}
          </div>
        </div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:0;flex-wrap:wrap">
          <div style="font-size:12px;font-weight:950;color:#fff">3 sugestões de resposta</div>
          ${_mensagensAprovadas ? `<div class="small" style="color:var(--muted);font-size:10px">Clique em uma opção para trocar a mensagem acima.</div>` : ''}
        </div>
        ${_mensagensAprovadas
          ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px">${cardsMensagensHtml}</div>`
          : `<div style="padding:12px 14px;color:var(--muted);font-size:12px;border:1px dashed var(--line);border-radius:12px;line-height:1.5">${escapeHtml(_msgNaoGerada)}${_erroApi ? '<br><span style="color:var(--muted);font-size:11px;opacity:.7">Análise anterior encontrou erro. Toque em Reanalisar para tentar com o saldo atual.</span>' : ''}</div>`
        }
        <details class="bloco-recolhe">
          <summary>Ver leitura complementar</summary>
          <div style="margin-top:12px">${diagnosticoDetalheHtml}</div>
        </details>
        ${lead.id ? `<details class="bloco-recolhe">
          <summary>Registrar atendimento</summary>
          <div id="novoAtendimentoPanel" style="margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.03)">
            <textarea id="novoAtendimentoTexto" rows="4" placeholder="Toque em Gravar áudio e fale — o texto vai aparecendo aqui na hora. Ou digite direto." style="width:100%;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:10px;font-size:13px;resize:vertical;box-sizing:border-box"></textarea>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">
              <button type="button" id="btnGravarAtendimento" style="background:transparent;border:1px solid var(--line);color:var(--text);padding:8px 16px;border-radius:999px;font-size:13px;font-weight:950;cursor:pointer">Gravar áudio</button>
              <button type="button" id="btnAnexarPrints" style="background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--soft);padding:8px 16px;border-radius:999px;font-size:13px;font-weight:950;cursor:pointer">📎 Anexar prints</button>
              <input type="file" id="anexarPrintsInput" accept="image/*" multiple style="display:none">
              <span class="small" id="atendimentoStatus" style="color:var(--muted);flex:1;min-width:140px"></span>
            </div>
            <button type="button" id="btnSalvarAtendimento" class="btn" style="margin-top:10px;width:100%" disabled>Salvar atendimento</button>
          </div>
        </details>` : ``}
        <details class="bloco-recolhe">
          <summary>Histórico e ficha</summary>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:12px">
            ${conteudoFichaCliente || `<div class="small" style="color:var(--muted)">Sem ficha complementar registrada neste lead.</div>`}
            ${blocoParecidos || ``}
            ${blocoEvolucao || ``}
            ${historicoConversaHtml || ``}
          </div>
        </details>
        <details class="bloco-recolhe">
          <summary>Ações do lead</summary>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:12px">
            ${ehContatadoHoje(lead) ? `<div><span style="display:inline-flex;align-items:center;white-space:nowrap;padding:7px 14px;border-radius:999px;font-size:11px;font-weight:950;color:var(--acao);background:rgba(104,255,149,.12);border:1px solid var(--acao)">✓ Contato hoje</span></div>` : ``}
            <div class="lead-acts">
              <button type="button" onclick='abrirPropostaComLead(${safeJson(lead.name||"")}, ${safeJson(lead.product||"")}, ${JSON.stringify(String(lead.id||""))})' style="white-space:nowrap;padding:8px 14px;background:rgba(255,255,255,.04);color:var(--text);border:1px solid var(--line);border-radius:999px;font-size:12px;font-weight:950;cursor:pointer;letter-spacing:.04em">📄 Gerar proposta</button>
              ${lead.id ? `<button type="button" onclick='toggleAgendar(${JSON.stringify(String(lead.id))})' style="white-space:nowrap;padding:8px 14px;background:rgba(255,255,255,.04);color:var(--text);border:1px solid var(--line);border-radius:999px;font-size:12px;font-weight:950;cursor:pointer;letter-spacing:.04em">📅 Agendar</button>` : ``}
              ${lead.id && normalizarEtapa(lead.etapa) !== "Vendido" && normalizarEtapa(lead.etapa) !== "Perdido" && normalizarEtapa(lead.etapa) !== "Geladeira" ? `<button type="button" onclick='arquivarLead(${JSON.stringify(String(lead.id))}, ${safeJson(lead.name||"")})' style="white-space:nowrap;padding:8px 14px;background:rgba(255,255,255,.04);color:var(--text);border:1px solid var(--line);border-radius:999px;font-size:12px;font-weight:950;cursor:pointer;letter-spacing:.04em">❄ Pra geladeira</button>` : ``}
              ${lead.id && normalizarEtapa(lead.etapa) !== "Vendido" && normalizarEtapa(lead.etapa) !== "Perdido" ? `<button type="button" onclick='marcarPerdido(${JSON.stringify(String(lead.id))}, ${safeJson(lead.name||"")})' style="white-space:nowrap;padding:8px 14px;background:rgba(255,255,255,.04);color:var(--text);border:1px solid var(--line);border-radius:999px;font-size:12px;font-weight:950;cursor:pointer;letter-spacing:.04em">🗑 Arquivar</button>` : ``}
            </div>
            ${lead.id ? `<div id="agendarbox_${lead.id}" style="display:none;background:var(--input);border:1px solid var(--line);border-radius:10px;padding:11px;flex-direction:column;gap:8px">
              <div class="small" style="color:var(--timing);text-transform:uppercase;letter-spacing:.1em;font-weight:950;font-size:10px">📅 Agendar lembrete</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" onclick='reagendarDias(${JSON.stringify(String(lead.id))},0)' style="padding:5px 11px;font-size:11px;background:rgba(255,45,155,.18);color:var(--timing);border:1px solid var(--timing);border-radius:999px;cursor:pointer;font-weight:950">Hoje</button>
                <button type="button" onclick='reagendarDias(${JSON.stringify(String(lead.id))},1)' style="padding:5px 11px;font-size:11px;background:rgba(255,45,155,.10);color:var(--timing);border:1px solid var(--timing);border-radius:999px;cursor:pointer;font-weight:950">Amanhã</button>
                <button type="button" onclick='reagendarDias(${JSON.stringify(String(lead.id))},7)' style="padding:5px 11px;font-size:11px;background:rgba(255,45,155,.10);color:var(--timing);border:1px solid var(--timing);border-radius:999px;cursor:pointer;font-weight:950">+7 dias</button>
                <button type="button" onclick='reagendarDias(${JSON.stringify(String(lead.id))},15)' style="padding:5px 11px;font-size:11px;background:rgba(255,45,155,.10);color:var(--timing);border:1px solid var(--timing);border-radius:999px;cursor:pointer;font-weight:950">+15 dias</button>
                <button type="button" onclick='reagendarDias(${JSON.stringify(String(lead.id))},30)' style="padding:5px 11px;font-size:11px;background:rgba(255,45,155,.10);color:var(--timing);border:1px solid var(--timing);border-radius:999px;cursor:pointer;font-weight:950">+30 dias</button>
              </div>
              <label style="font-size:10px;color:var(--muted)">ou escolha a data:</label>
              <input type="date" onchange='reagendarLembrete(${JSON.stringify(String(lead.id))}, this.value)' style="background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font-size:13px;max-width:180px">
            </div>` : ``}
            ${a.lembrete && a.lembrete.quando ? `<div><span style="display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;font-size:12px;color:var(--timing);background:rgba(255,45,155,.10);border:1px solid var(--timing);font-weight:700">🔔 Lembrar em ${escapeHtml(new Date(a.lembrete.quando).toLocaleDateString("pt-BR"))} <a href="#" id="btnLimparLembrete" style="margin-left:8px;color:var(--muted);text-decoration:underline;font-size:10px">limpar</a></span>${reagendarControlHTML(lead.id)}</div>` : ``}
          </div>
        </details>
      </div>
    </div>
    ${lead.id ? `<div style="margin-top:18px;padding-top:10px;border-top:1px solid rgba(255,255,255,.05);text-align:center"><button type="button" onclick='excluirLeadDefinitivo(${JSON.stringify(String(lead.id))}, ${safeJson(lead.name||"")})' style="background:transparent;border:none;color:var(--muted);font-size:11px;text-decoration:underline;cursor:pointer;opacity:.5;letter-spacing:.03em">Excluir lead definitivo</button></div>` : ""}`;

  // Liga troca de mensagem principal (cards de abordagem)
  const msgs = { a: cardsMensagens[0]?.msg || msgInicial, b: cardsMensagens[1]?.msg || msgInicial, c: cardsMensagens[2]?.msg || msgInicial };
  const aplicarMsgFoco = (k) => {
    qsa(".msg-card-foco").forEach(card => {
      const on = (card.dataset.style || "a") === k;
      card.classList.toggle("active", on);
      card.style.borderColor = on ? "var(--lime)" : "var(--line)";
      card.style.background = on ? "rgba(255,107,92,.09)" : "rgba(255,255,255,.03)";
    });
    qsa(".msg-tab-foco").forEach(b => {
      const on = (b.dataset.style || "a") === k;
      b.classList.toggle("active", on);
      b.style.fontWeight = on ? "950" : "600";
      b.style.borderColor = on ? "var(--lime)" : "var(--line)";
      b.style.background = on ? "rgba(255,107,92,.10)" : "transparent";
      b.style.color = on ? "var(--lime)" : "var(--text)";
    });
    const novoMsg = msgs[k] || msgs.a || msgInicial;
    const el = qs("#msgFocoText");
    if(el) el.textContent = novoMsg;
    const wa = qs("#btnFocoWA");
    if(wa) wa.href = whatsappLink(phone, novoMsg);
  };
  qsa(".msg-card-foco").forEach(btn => btn.addEventListener("click", () => aplicarMsgFoco(btn.dataset.style || "a")));
  qsa(".msg-tab-foco").forEach(btn => btn.addEventListener("click", () => aplicarMsgFoco(btn.dataset.style || "a")));
  qsa(".msg-objetivo-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const novoMsg = (window._objetivoMsgsFoco || [])[idx] || "";
      if(!novoMsg) return;
      qsa(".msg-tab-foco").forEach(b => { b.classList.remove("active"); b.style.fontWeight="600"; b.style.borderColor="var(--line)"; b.style.background="transparent"; b.style.color="var(--text)"; });
      qsa(".msg-card-foco").forEach(card => { card.classList.remove("active"); card.style.borderColor="var(--line)"; card.style.background="rgba(255,255,255,.03)"; });
      const el = qs("#msgFocoText");
      if(el) el.textContent = novoMsg;
      const wa = qs("#btnFocoWA");
      if(wa) wa.href = whatsappLink(phone, novoMsg);
      toast("Mensagem por objetivo carregada.");
    });
  });
  // Atualiza o link do WhatsApp em tempo real conforme o usuário edita a mensagem
  const msgEl = qs("#msgFocoText");
  if(msgEl){
    msgEl.addEventListener("input", () => {
      const wa = qs("#btnFocoWA");
      if(wa) wa.href = whatsappLink(phone, msgEl.textContent || "");
    });
  }
  // Trocar tipo de contato manualmente (cliente final / corretora parceira / indicação / outro)
  const badgeTC = qs("#badgeTipoContato");
  if(badgeTC) badgeTC.addEventListener("click", async () => {
    const atual = tipoContatoEfetivoLead(lead, lead.analysis || {}) || "outro";
    const escolha = prompt(`Tipo de contato com ${lead.name||"este lead"}:\n\n1 = Cliente final (vai morar/investir)\n2 = Corretora parceira (B2B — vende pra cliente dela)\n3 = Indicação\n4 = Não sei / Outro\n\nAtual: ${TIPO_CONTATO_LABEL[atual]?.txt||atual}`, "1");
    if(!escolha) return;
    const map = { "1":"cliente-final", "2":"corretora-parceira", "3":"indicacao", "4":"outro" };
    const novo = map[escolha.trim()];
    if(!novo) return;
    if(novo === atual){ toast("Tipo não mudou."); return; }
    // Salva como observação na memória (porque é override do usuário, mais autoritativo que IA)
    const obsAtual = qs("#memoriaObservacoes")?.value || "";
    const tag = "[tipo-contato:"+novo+"]";
    const obsNovo = obsAtual.replace(/\[tipo-contato:[a-z-]+\]/g, "").trim();
    const obsFinal = (tag + " " + obsNovo).trim();
    try{
      await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: lead.id, action: "memoria-set", preferencias: qs("#memoriaPreferencias")?.value||"", pessoasDecisao: qs("#memoriaPessoasDecisao")?.value||"", pontosSensiveis: qs("#memoriaPontosSensiveis")?.value||"", observacoes: obsFinal }) });
      if(lead.analysis) lead.analysis.tipoContato = novo;
      // Mudou o tipo (cliente ↔ parceiro) → as 3 mensagens precisam se adequar (B2B x cliente).
      // Reanalisa pra regerar, senão ficavam as mensagens do tipo antigo.
      toast("Tipo salvo. Atualizando as mensagens…");
      const r = await fetch("./api/reanalisar-lead", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: lead.id }) });
      const dr = await r.json().catch(() => ({ ok:false }));
      if(dr?.ok){ if(typeof invalidarLeadsCache === "function") invalidarLeadsCache(); await abrirLead(lead.id); toast("Mensagens atualizadas pro tipo de contato."); }
      else { renderLeadFoco(lead); toast("Tipo salvo, mas a reanálise falhou: " + (dr?.error||"erro")); }
    }catch(err){ toast("Erro ao salvar: "+(err?.message||err)); }
  });

  // Registrar atendimento (presencial/ligação): painel já aberto. Digita ou grava áudio -> transcreve -> guarda no resumo e reanalisa
  // Ditado em tempo real (reconhecimento de voz do navegador): vai escrevendo enquanto você fala.
  const btnGravar = qs("#btnGravarAtendimento");
  let recog = null, ditando = false, ditadoBase = "", sessaoFinais = "";
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function pararDitado(){
    ditando = false;
    try{ recog && recog.stop(); }catch(_){}
    if(btnGravar){ btnGravar.textContent = "Gravar áudio"; btnGravar.style.background = "transparent"; }
    const st = qs("#atendimentoStatus"); if(st) st.innerHTML = '<span style="color:var(--acao)">Pronto. Revise e toque em Salvar.</span>';
  }
  function iniciarDitado(){
    const ta = qs("#novoAtendimentoTexto"); const st = qs("#atendimentoStatus");
    // Texto que já estava no campo antes do ditado começar. Nunca é alterado.
    const textoOriginal = ta.value ? ta.value.trim() + " " : "";
    // ditadoBase = TODOS os finais já confirmados nesta sessão de ditado.
    // Persiste através dos reinícios (Chrome encerra sozinho após silêncio).
    // Padrão MDN: começa do e.resultIndex e soma cada final UMA vez só — sem isso,
    // o Android Chrome repete os parciais e sai um "gago" ("a / a Grazi / a Grazi tá...").
    ditadoBase = ""; sessaoFinais = "";
    // Segunda trava (à prova de Android): se o texto ficou no padrão "prefixo crescente"
    // ("a", "a b", "a b c"...) — repetições do mesmo começo que vão crescendo — devolve só
    // a maior frase. Só age quando os segmentos REALMENTE são prefixos um do outro (assinatura
    // do bug); em fala normal não mexe.
    function colapsarRepeticaoCrescente(txt){
      const t = String(txt || "").trim().split(/\s+/).filter(Boolean);
      if(t.length < 4) return String(txt || "").trim();
      const low = t.map(w => w.toLowerCase());
      const first = low[0];
      const starts = [];
      for(let i = 0; i < t.length; i++) if(low[i] === first) starts.push(i);
      if(starts.length < 2) return t.join(" ");
      starts.push(t.length);
      const segs = [];
      for(let s = 0; s < starts.length - 1; s++) segs.push(t.slice(starts[s], starts[s+1]).join(" "));
      for(let s = 0; s < segs.length - 1; s++){
        if(!segs[s+1].toLowerCase().startsWith(segs[s].toLowerCase())) return t.join(" "); // fala normal → preserva
      }
      return segs[segs.length - 1]; // é o bug → só a maior frase
    }
    function montarRecog(){
      const r = new SR();
      r.lang = "pt-BR";
      r.continuous = true;
      r.interimResults = true;
      // Reconstrói o texto desta sessão DO ZERO a cada evento (sem += incremental, que no
      // Android duplica). ditadoBase = finais das sessões anteriores; sessaoFinais = finais
      // desta sessão (recalculado). Consolida no onend.
      r.onresult = (e) => {
        const partes = []; let interim = "";
        for(let i = 0; i < e.results.length; i++){
          const txt = String(e.results[i][0].transcript || "").trim();
          if(!txt) continue;
          if(e.results[i].isFinal){
            // Android repete os finais como prefixos que crescem ("a", "a b", "a b c").
            // Se o atual contém o anterior (ou vice-versa) como início, SUBSTITUI em vez de somar.
            const ult = partes.length ? partes[partes.length-1] : "";
            if(ult && (txt.startsWith(ult) || ult.startsWith(txt))) partes[partes.length-1] = txt.length >= ult.length ? txt : ult;
            else partes.push(txt);
          } else {
            interim = txt; // só o último parcial (não acumula)
          }
        }
        const finais = partes.join(" ");
        sessaoFinais = finais ? finais + " " : "";
        const ditado = colapsarRepeticaoCrescente((ditadoBase + sessaoFinais + interim).replace(/\s+/g, " ").trim());
        ta.value = (textoOriginal + ditado).replace(/\s+/g, " ").trim();
        refreshSalvarEnabled();
      };
      r.onerror = (ev) => {
        if(ev.error === "not-allowed" || ev.error === "service-not-allowed"){
          if(st) st.innerHTML = '<span style="color:var(--risco)">Microfone bloqueado. Permita o microfone no navegador.</span>';
          pararDitado();
        }
      };
      // Chrome encerra sozinho após silêncio — reinicia preservando ditadoBase.
      r.onend = () => {
        if(!ditando) return;
        // Consolida os finais desta sessão antes de reiniciar (e zera o acumulador da sessão).
        ditadoBase += sessaoFinais; sessaoFinais = "";
        try{ r.onresult = null; r.onend = null; r.onerror = null; }catch(_){}
        recog = montarRecog();
        try{ recog.start(); }catch(_){}
      };
      return r;
    }
    recog = montarRecog();
    try{ recog.start(); }
    catch(_){ if(st) st.innerHTML = '<span style="color:var(--risco)">Não consegui ligar o microfone.</span>'; return; }
    ditando = true;
    btnGravar.textContent = "Parar áudio";
    btnGravar.style.background = "rgba(255,91,122,.18)";
    if(st) st.textContent = "Ouvindo... pode falar que eu vou escrevendo. Toque em Parar quando terminar.";
  }
  if(btnGravar) btnGravar.addEventListener("click", () => {
    const st = qs("#atendimentoStatus");
    if(!SR){ if(st) st.innerHTML = '<span style="color:var(--risco)">Esse navegador não tem ditado por voz. Use o Chrome, ou digite o atendimento.</span>'; return; }
    if(ditando) pararDitado(); else iniciarDitado();
  });
  const btnSalvarAt = qs("#btnSalvarAtendimento");
  const taAtend = qs("#novoAtendimentoTexto");
  // Quando o texto veio de "Anexar prints", guarda que é histórico de WhatsApp (não atendimento
  // presencial de hoje) + a data do último contato lido no print — pra não zerar o "dias parado".
  let printMetaPendente = null;
  // Habilita "Salvar e reanalisar" só quando há texto. "Reanalisar" sem texto fica sempre ativo.
  const refreshSalvarEnabled = () => {
    if(btnSalvarAt) btnSalvarAt.disabled = !(taAtend?.value||"").trim();
    // Se o corretor apagou/reescreveu o texto do print, deixa de tratar como print.
    if(printMetaPendente && !(taAtend?.value||"").includes(printMetaPendente.textoBase)) printMetaPendente = null;
  };
  if(taAtend){ taAtend.addEventListener("input", refreshSalvarEnabled); refreshSalvarEnabled(); }
  // Anexar prints: lê várias imagens da conversa com a IA e joga o registro no campo de atendimento.
  const btnAnexarPrints = qs("#btnAnexarPrints");
  const anexarPrintsInput = qs("#anexarPrintsInput");
  if(btnAnexarPrints && anexarPrintsInput){
    btnAnexarPrints.addEventListener("click", () => anexarPrintsInput.click());
    anexarPrintsInput.addEventListener("change", async (ev) => {
      const files = [...(ev.target.files||[])].slice(0, 5);
      if(!files.length) return;
      const st = qs("#atendimentoStatus");
      const origTxt = btnAnexarPrints.textContent;
      btnAnexarPrints.disabled = true; btnAnexarPrints.textContent = "⏳ Lendo...";
      if(st) st.textContent = `Lendo ${files.length} print(s)...`;
      try{
        const imagens = await Promise.all(files.map(f => fileParaDataUrlRedim(f, 1900, 0.88)));
        const res = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"ler-prints-conversa", imagens }) });
        const d = await res.json().catch(() => ({ ok:false }));
        if(d?.ok && d.texto){
          const ta = qs("#novoAtendimentoTexto");
          if(ta) ta.value = ta.value.trim() ? (ta.value.trim() + "\n\n" + d.texto) : d.texto;
          // Marca como histórico de WhatsApp lido por print, com a data do último contato (se a IA achou).
          printMetaPendente = { textoBase: d.texto, isoEvento: d.dataUltimaISO || null };
          refreshSalvarEnabled();
          if(st) st.innerHTML = '<span style="color:var(--acao)">Prints lidos. Revise e toque em Salvar atendimento.</span>';
          toast("✓ Prints lidos.");
          // Lead SEM foto + a IA achou a foto do cliente no print → recorta e salva no avatar (num processo só).
          const semFoto = state.lead && !(state.lead.analysis?.avatarFoto || state.lead.avatarFoto);
          if(semFoto && d.avatarBox && files.length){
            try{
              // A fotinha de perfil só aparece no print que mostra o CABEÇALHO da conversa (topo).
              // Com vários prints anexados, esse pode não ser o files[0] — então tenta cada um pela
              // posição padrão e, se não achar, pede pra IA localizar o rosto naquele print.
              let foto = null;
              const idxAvatar = Number.isInteger(Number(d.avatarImagem)) && Number(d.avatarImagem) >= 0 && Number(d.avatarImagem) < files.length ? Number(d.avatarImagem) : 0;
              foto = await recortarAvatar(files[idxAvatar], d.avatarBox);
              // Fallback: tenta detectar rosto nos demais prints somente se o recorte indicado não serviu.
              for(let i = 0; i < files.length && !foto; i++){
                if(!imagens[i]) continue;
                try{
                  const rr = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"detectar-rosto", imagemBase64: imagens[i] }) });
                  const rd = await rr.json().catch(() => ({}));
                  if(rd?.faceBox) foto = await recortarAvatar(files[i], rd.faceBox);
                }catch(_){ /* fallback é bônus */ }
              }
              if(foto && state.lead?.id){
                const sv = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"editar-dados", id: state.lead.id, avatarFoto: foto }) });
                const svd = await sv.json().catch(()=>({ok:false}));
                if(svd?.ok){
                  state.lead.avatarFoto = foto;
                  if(state.lead.analysis) state.lead.analysis.avatarFoto = foto;
                  // Atualiza só o avatar na tela, sem re-render (preserva o texto do print no campo).
                  const wrap = qs("#focoAvatarWrap");
                  if(wrap) wrap.innerHTML = avatarLead(state.lead, "lg");
                  invalidarLeadsCache?.();
                  toast("✓ Foto do cliente salva no avatar.");
                }
              }
            }catch(_){ /* foto é bônus: se falhar, o print já foi lido */ }
          }
        } else {
          if(st) st.textContent = "";
          toast("Não consegui ler os prints: " + (d?.error || "tenta de novo"));
        }
      }catch(err){
        if(st) st.textContent = "";
        toast("Erro ao ler prints: " + (err?.message || err));
      }finally{
        btnAnexarPrints.disabled = false; btnAnexarPrints.textContent = origTxt;
        if(ev.target) ev.target.value = "";
      }
    });
  }
  if(btnSalvarAt) btnSalvarAt.addEventListener("click", async () => {
    if(ditando) pararDitado();
    const ta = qs("#novoAtendimentoTexto");
    const texto = (ta?.value||"").trim();
    if(!texto){ toast("Escreva ou grave o atendimento antes de salvar."); return; }
    btnSalvarAt.disabled = true;
    btnSalvarAt.textContent = "Salvando...";
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 30000);
    // Texto vindo de print = histórico de WhatsApp (não atendimento presencial de hoje).
    // Rotula certo e usa a data do último contato lido no print, pra não zerar o "dias parado".
    const ehPrint = printMetaPendente && texto.includes(printMetaPendente.textoBase);
    const corpo = { id: lead.id, novoAtendimento: texto, apenasSalvar: true };
    if(ehPrint){
      corpo.autorManual = "Lido de print (WhatsApp)";
      corpo.tipoManual = "print-whatsapp";
      if(printMetaPendente.isoEvento) corpo.isoEvento = printMetaPendente.isoEvento;
    }
    try{
      const res = await fetch("./api/reanalisar-lead", {
        method:"POST", headers:{"Content-Type":"application/json"},
        // Só SALVA (rápido). A reanálise é separada (botão "Reanalisar") pra não demorar.
        // O lembrete da anotação ("agendar hoje" etc.) continua sendo aplicado no salvar.
        body: JSON.stringify(corpo),
        signal: ctrl.signal
      });
      clearTimeout(to);
      const data = await res.json().catch(()=>({ ok:false, error:"Resposta inválida do servidor." }));
      if(data?.ok){
        // Print = histórico antigo do WhatsApp, NÃO é um contato feito hoje — não marca "contatado hoje"
        // (senão o lead saía da fila como se você já tivesse falado com ele hoje).
        if(!ehPrint){ try{ await registrarAprendizado("contato_manual", null, { tipo: "atendimento registrado", de: "novoAtendimento" }); }catch(_){} }
        // ATENDEU hoje → o lead SAI dos compromissos de hoje e reagenda SOZINHO pro 5º dia, pra você
        // só voltar nele quando for hora de ver o retorno (pedido do dono). Só em atendimento REAL
        // (não em print de histórico antigo). Roda antes do reload pra já aparecer remarcado.
        if(!ehPrint){
          try{
            const d5 = new Date(); d5.setDate(d5.getDate() + 5);
            const dataReag = `${d5.getFullYear()}-${String(d5.getMonth()+1).padStart(2,"0")}-${String(d5.getDate()).padStart(2,"0")}`;
            await fetch("./api/reanalisar-lead", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: lead.id, action:"reagendar-lembrete", data: dataReag }) });
          }catch(_){}
        }
        toast(ehPrint ? "✓ Histórico do print salvo." : "✓ Atendido — volto a te lembrar dele em 5 dias.");
        if(ta) ta.value = "";
        printMetaPendente = null;
        invalidarLeadsCache();
        // FICA no lead (não volta pra Home). Recarrega os dados e re-renderiza o mesmo lead
        // pra já mostrar a anotação salva. Se quiser sair, o usuário clica em "Voltar pra Hoje".
        try{
          const fresh = await getLeadsData(true);
          const itens = (fresh?.items || []).map(limparLead);
          state.leads = itens;
          if(typeof loadTodosLeadsBusca === "function") loadTodosLeadsBusca();
          // Reconstrói a lista de "Atender hoje" — o lead atendido (contato hoje) sai dela na hora,
          // sem precisar dar refresh. Como estamos no lead, renderListasHome só atualiza os grupos.
          const ativos = itens.filter(l => { const e = normalizarEtapa(l.etapa); return e !== "Vendido" && e !== "Perdido" && e !== "Geladeira"; });
          state.itemsAtivos = ativos;
          if(ativos.length){ const ordenados = ativos.map(l => ({ ...l, _score: scoreLead(l) })).sort((a,b) => b._score - a._score); renderListasHome(ordenados); }
          const atualizado = itens.find(l => String(l.id) === String(lead.id)) || lead;
          state.lead = atualizado; state.analysis = atualizado.analysis || null;
          renderLeadFoco(atualizado);
          // Depois de salvar, volta o scroll pro topo do lead automaticamente.
          setTimeout(() => { (qs("#leadFocoArea") || qs("#topo"))?.scrollIntoView({ behavior:"smooth", block:"start" }); }, 60);
          // Reanálise em SEGUNDO PLANO: salva rápido e, em seguida, atualiza as sugestões
          // considerando a nova observação (sem travar você esperando os ~30s).
          reanalisarEmSegundoPlano(lead.id);
        }catch(_){
          btnSalvarAt.disabled = false; btnSalvarAt.textContent = "Salvar atendimento";
        }
      } else {
        toast("Não deu pra salvar: " + (data?.error||"erro"));
        btnSalvarAt.disabled = false; btnSalvarAt.textContent = "Salvar atendimento";
      }
    }catch(err){
      clearTimeout(to);
      const ehTimeout = err?.name === "AbortError";
      toast(ehTimeout ? "Demorou demais — tente de novo." : "Erro ao salvar atendimento.");
      btnSalvarAt.disabled = false; btnSalvarAt.textContent = "Salvar atendimento";
    }
  });
  // Ctrl+V cola imagem direto no avatar deste lead.
  if(lead.id) ligarColarAvatarGlobal(String(lead.id));
  // Botão "Reanalisar (sem registrar atendimento)" — roda a análise de novo, sem alterar nada.
  const btnReanalisar = qs("#btnReanalisarSemTexto");
  if(btnReanalisar) btnReanalisar.addEventListener("click", async () => {
    btnReanalisar.disabled = true;
    const txtOriginal = btnReanalisar.textContent;
    btnReanalisar.textContent = "Reanalisando...";
    const pararBarra = iniciarBarraProgresso(btnReanalisar, "Reanalisando... pode levar até 30s");
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 90000);
    try{
      const res = await fetch("./api/reanalisar-lead", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: lead.id }), signal: ctrl.signal });
      clearTimeout(to);
      const data = await res.json().catch(()=>({ ok:false, error:"Resposta inválida do servidor." }));
      pararBarra();
      if(data?.ok){
        toast("✓ Análise atualizada com regras novas.");
        btnReanalisar.textContent = "✓ Reanalisado!";
        btnReanalisar.style.color = "var(--acao)";
        btnReanalisar.style.borderColor = "var(--acao)";
        await loadRecentLeads();
        await carregarDashboard();
        if(state.lead?.id === lead.id){
          await abrirLead(lead.id);
          // Scroll suave pro topo do lead pra ver o resultado novo
          setTimeout(() => {
            qs("#leadFocoArea")?.scrollIntoView({ behavior:"smooth", block:"start" });
            // Flash visual no hero do lead
            const hero = qs(".hero-foco");
            if(hero){
              hero.style.transition = "box-shadow .4s";
              hero.style.boxShadow = "0 0 0 3px var(--acao), 0 0 40px rgba(104,255,149,.35)";
              setTimeout(() => { hero.style.boxShadow = ""; }, 1400);
            }
          }, 100);
        }
      } else {
        toast("Não deu pra reanalisar: " + (data?.error||"erro"));
        btnReanalisar.disabled = false; btnReanalisar.textContent = txtOriginal;
      }
    }catch(err){
      clearTimeout(to);
      pararBarra();
      const ehTimeout = err?.name === "AbortError";
      toast(ehTimeout ? "Demorou demais — tente de novo." : "Erro ao reanalisar.");
      btnReanalisar.disabled = false; btnReanalisar.textContent = txtOriginal;
    }
  });
  // Quem define etapa é a análise da IA — corretor não toca.
  // Copiar
  const btnCopiar = qs("#btnFocoCopiar");
  if(btnCopiar) btnCopiar.addEventListener("click", () => {
    const txt = qs("#msgFocoText")?.textContent || "";
    navigator.clipboard.writeText(txt)
      .then(() => {
        toast("Mensagem copiada — registrei o contato de hoje.");
        registrarAprendizado && registrarAprendizado("mensagem_copiada", null, { de: "leadFoco" });
        // Copiar = vai enviar: marca contato de hoje + grava nas observações (data/hora + msg).
        registrarMensagemEnviada(lead, txt);
      })
      .catch(() => toast("Não consegui copiar a mensagem — copie manualmente."));
  });
  // WhatsApp click: registra aprendizado
  const btnWA = qs("#btnFocoWA");
  if(btnWA) btnWA.addEventListener("click", () => {
    registrarAprendizado && registrarAprendizado("whatsapp_aberto", null, { de: "leadFoco" });
  });
  const btnLimparLembrete = qs("#btnLimparLembrete");
  if(btnLimparLembrete) btnLimparLembrete.addEventListener("click", async (e) => {
    e.preventDefault();
    if(!confirm("Limpar o lembrete deste lead?")) return;
    try{
      const res = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: lead.id, action: "lembrete-clear" }) });
      const data = await res.json();
      if(data?.ok){
        if(lead.analysis) delete lead.analysis.lembrete;
        renderLeadFoco(lead);
        toast("Lembrete removido.");
        invalidarLeadsCache();
        atualizarSinoAgenda(); // sino do topo na hora (sem F5)
      }
    }catch(_){}
  });

  // Sugestões ainda "cruas" (a importação não gera mais as 3 respostas, pra ser rápida). Ao ABRIR
  // o lead, gera agora em segundo plano com qualidade Sonnet, mostrando "carregando" no lugar da
  // mensagem. Quando termina, reanalisarEmSegundoPlano re-renderiza com as sugestões prontas.
  if(lead.id && lead.analysis && lead.analysis.sugestoesPendentes && !_reanaliseBgEmAndamento){
    // Mantém a mensagem-base (Direta) já visível e refina calado por trás — sem "Gerando…" travando.
    reanalisarEmSegundoPlano(lead.id);
  }
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
        <div class="small" style="margin-top:3px">${escapeHtml(l.product||"--")} · ${escapeHtml(l.probability||"--")}</div>
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
      body: JSON.stringify({ id, action:"reagendar-lembrete", data: dateStr })
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
      body: JSON.stringify({ id, action:"remover-lembrete" })
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
      html += `<div style="margin-bottom:14px"><div class="small" style="color:var(--timing);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:11px;margin-bottom:8px">Lembretes vencidos — revisar (geladeira) (${lembretesGeladeiraVencidos.length})</div>`;
      html += lembretesGeladeiraVencidos.map(l => {
        const lem = l.analysis?.lembrete || {};
        const dataBR = new Date(lem.quando).toLocaleDateString("pt-BR");
        const extra = `<div style="margin-top:6px;padding:6px 8px;background:rgba(255,45,155,.05);border-left:3px solid var(--timing);border-radius:6px;font-size:12px"><b style="color:var(--timing)">⏰ Lembrete venceu (${escapeHtml(dataBR)}) · está na geladeira</b>${lem.motivo ? `<div class="small" style="margin-top:2px;color:var(--soft)">${escapeHtml(lem.motivo)}</div>` : ""}</div>`;
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
    cerebroIntel = JSON.parse(JSON.stringify(ia));
    const total = APRENDIZADO_CATS.reduce((s, c) => s + ((ia[c.key]||[]).length), 0);
    // Card destaque com total grande + minicards por categoria
    const miniCards = APRENDIZADO_CATS.map(cat => {
      const n = (ia[cat.key]||[]).length;
      return `<div style="padding:8px 10px;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:8px;text-align:center;min-width:90px">
        <div style="font-size:18px;font-weight:950;color:${cat.cor}">${n}</div>
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:950;line-height:1.2;margin-top:2px">${cat.label.split(" ").slice(0,2).join(" ")}</div>
      </div>`;
    }).join("");
    const header = `<div style="margin-bottom:18px">
      <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;padding:14px 16px;background:linear-gradient(135deg,rgba(255,107,92,.08),rgba(55,232,255,.04));border:1px solid var(--lime);border-radius:12px;margin-bottom:10px">
        <div style="font-size:42px;font-weight:950;line-height:1;color:var(--lime)">${total}</div>
        <div>
          <div style="font-size:13px;font-weight:950">observa${total===1?"ção":"ções"} no Cérebro</div>
          <div class="small" style="color:var(--muted);font-size:11px;margin-top:2px">o Corretor Pro usa isso para calibrar próximas sugestões</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${miniCards}</div>
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
    box.innerHTML = header + blocos + (total > 0 ? `<button type="button" onclick="limparAprendizadoTudo()" style="width:100%;margin-top:6px;padding:10px;background:transparent;color:var(--risco);border:1px dashed var(--risco);border-radius:10px;font-size:12px;font-weight:950;cursor:pointer">Apagar TUDO que o Corretor Pro aprendeu</button>` : "");
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
  if(!confirm("Apagar TUDO que o Corretor Pro aprendeu? Ela vai voltar do zero. (Cérebro Comercial manual não é afetado.)")) return;
  cerebroIntel = {};
  await salvarAprendizado();
  carregarAprendizado();
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

qs("#aprendizadoRefresh")?.addEventListener("click", carregarAprendizado);

function kpiMini(label, value, cor){
  return `<div style="padding:10px 12px;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:10px">
    <div style="font-size:9px;color:${cor};text-transform:uppercase;letter-spacing:.18em;font-weight:950">${label}</div>
    <div style="font-size:20px;font-weight:950;margin-top:2px">${value}</div>
  </div>`;
}

// Mostra na tela do Cérebro o estado do aprendizado do Direciona — quantas observações
// foram acumuladas em cada categoria pelo uso real (importação de ZIPs).
async function carregarEstadoIA(){
  const box = qs("#estadoIABox");
  if(!box) return;
  try{
    const res = await fetch("./api/cerebro-config", { cache:"no-store" });
    const data = await res.json();
    const ia = data?.config?.inteligenciaAprendida || {};
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
    const META = 60; // ~30 ZIPs costumam gerar ~60 observações
    const pct = Math.min(100, Math.round((total / META) * 100));
    const corBar = pct >= 100 ? "var(--acao)" : pct >= 50 ? "var(--lime)" : "var(--dados)";
    const statusTxt = pct >= 100
      ? "Massa crítica atingida — o Corretor Pro pode operar guiado principalmente pelo que aprendeu de você."
      : pct >= 50
      ? "Banco crescendo bem. Continue importando ZIPs."
      : "Início do aprendizado. Importe mais ZIPs pra acelerar.";
    const grade = cats.map(c => `<div style="padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.025)">
      <div style="color:${c.cor};text-transform:uppercase;letter-spacing:.1em;font-weight:950;font-size:9px;margin-bottom:3px">${c.label}</div>
      <div style="font-size:20px;font-weight:950">${(ia[c.key]||[]).length}</div>
    </div>`).join("");
    box.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;font-size:12px">
          <span style="color:var(--muted)">Progresso até massa crítica</span>
          <span style="color:${corBar};font-weight:950">${total} / ${META}</span>
        </div>
        <div style="height:8px;background:rgba(255,255,255,.05);border-radius:999px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${corBar};transition:width .3s"></div>
        </div>
        <div class="small" style="color:var(--soft);margin-top:6px;font-size:11px">${statusTxt}</div>
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
    config = {
      metodo: "Método Corretor Pro:\\n1. Identifique a fase do cliente.\\n2. Mostre que entendeu o contexto.\\n3. Cite o produto que combina.\\n4. Termine com pergunta curta ou próximo passo.",
      tom: "Direto, próximo, profissional.",
      diferenciais: "Construtora Senger. Carazinho/RS.",
      evitar: "Não usar 'faz sentido', 'retomando contato'.",
      diasImportacao: 90
    };
  }
  if(qs("#cerebroCorretorNome")) qs("#cerebroCorretorNome").value = config.corretorNome || "";
  qs("#cerebroMetodo").value = config.metodo || "";
  qs("#cerebroTom").value = config.tom || "";
  qs("#cerebroDiferenciais").value = config.diferenciais || "";
  qs("#cerebroEvitar").value = config.evitar || "";
  const inpDias = qs("#cerebroDiasImportacao");
  if(inpDias) inpDias.value = (config.diasImportacao && Number(config.diasImportacao) > 0) ? config.diasImportacao : 90;
  // Regras e objeções
  cerebroRegras = Array.isArray(config.regras) ? config.regras.map(r => typeof r === "string" ? { texto: r } : r) : [];
  cerebroObjecoes = Array.isArray(config.objecoes) ? config.objecoes : [];
  renderCerebroRegras();
  renderCerebroObjecoes();
  if(!status.innerHTML) status.textContent = "Configuração carregada.";
}

let cerebroRegras = [];
let cerebroObjecoes = [];

function renderCerebroRegras(){
  const box = qs("#cerebroRegrasList");
  if(!box) return;
  if(!cerebroRegras.length){ box.innerHTML = '<div class="small" style="color:var(--muted)">Nenhuma regra ainda.</div>'; return; }
  box.innerHTML = cerebroRegras.map((r, i) => {
    const origem = r.origem === "audio" ? "" : r.origem === "video" ? "" : r.origem === "link" ? "" : r.origem === "pdf" ? "" : "";
    return `<div style="display:flex;gap:8px;align-items:flex-start;padding:8px 10px;background:rgba(196,92,255,.05);border:1px solid rgba(196,92,255,.18);border-radius:10px;margin-bottom:6px">
      <div style="flex:1;font-size:13px;line-height:1.4">${origem ? origem+" " : ""}${escapeHtml(r.texto||"")}</div>
      <button type="button" onclick="removerRegraCerebro(${i})" style="background:transparent;border:0;color:var(--risco);cursor:pointer;font-size:16px;line-height:1">×</button>
    </div>`;
  }).join("");
}
function removerRegraCerebro(i){ cerebroRegras.splice(i,1); renderCerebroRegras(); salvarCerebro(); toast("Regra removida."); }
window.removerRegraCerebro = removerRegraCerebro;

function renderCerebroObjecoes(){
  const box = qs("#cerebroObjecoesList");
  if(!box) return;
  if(!cerebroObjecoes.length){ box.innerHTML = '<div class="small" style="color:var(--muted)">Nenhuma objeção cadastrada ainda.</div>'; return; }
  box.innerHTML = cerebroObjecoes.map((o, i) => `
    <div style="padding:8px 10px;background:rgba(255,155,59,.05);border:1px solid rgba(255,155,59,.2);border-radius:10px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <div style="flex:1"><b style="color:var(--morno);font-size:13px">"${escapeHtml(o.objecao||"")}"</b><div style="font-size:13px;line-height:1.4;margin-top:3px">${escapeHtml(o.resposta||"")}</div></div>
        <button type="button" onclick="removerObjecaoCerebro(${i})" style="background:transparent;border:0;color:var(--risco);cursor:pointer;font-size:16px;line-height:1">×</button>
      </div>
    </div>`).join("");
}
function removerObjecaoCerebro(i){ cerebroObjecoes.splice(i,1); renderCerebroObjecoes(); salvarCerebro(); toast("Objeção removida."); }
window.removerObjecaoCerebro = removerObjecaoCerebro;

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
    regras: cerebroRegras,
    objecoes: cerebroObjecoes
  };
  try{ localStorage.setItem(CEREBRO_LS_KEY, JSON.stringify(config)); }catch(_){}
  const status = qs("#cerebroStatus");
  status.textContent = "Salvando...";
  try{
    const res = await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(config) });
    const data = await res.json();
    if(data?.warning){
      status.innerHTML = '<span style="color:#ffc4f4">Salvo localmente. '+escapeHtml(data.warning)+'</span>';
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
  localStorage.removeItem(CEREBRO_LS_KEY);
  carregarCerebro();
  toast("Restaurando padrão.");
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
      diferenciais: qs("#cerebroDiferenciais")?.value || "",
      diasImportacao: Number(qs("#cerebroDiasImportacao")?.value) || 90,
      regras: [], objecoes: []
    };
    await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(cfg) });
    await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"intel-update", inteligenciaAprendida:{} }) });
    try{ localStorage.removeItem(CEREBRO_LS_KEY); }catch(_){}
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
  "Recebendo arquivo",
  "Validando ZIP",
  "Lendo conversa",
  "Separando áudios",
  "Transcrevendo áudios",
  "Montando linha do tempo",
  "Analisando atendimento",
  "Gerando mensagens",
  "Finalizado"
];

function renderEtapas(idxAtual, sub){
  const ol = qs("#processingSteps");
  if(!ol) return;
  ol.innerHTML = ETAPAS_PROCESSAMENTO.map((label, i) => {
    let icone = "", cor = "var(--muted)", peso = "400";
    if(i < idxAtual){ icone = "✓"; cor = "var(--acao)"; peso = "600"; }
    else if(i === idxAtual){ icone = ""; cor = "var(--lime)"; peso = "950"; }
    const extra = (i === idxAtual && sub) ? ` <span style="color:var(--muted);font-weight:400">— ${escapeHtml(sub)}</span>` : "";
    return `<li style="padding:4px 0;color:${cor};font-weight:${peso}"><span style="display:inline-block;width:18px">${icone}</span>${escapeHtml(label)}${extra}</li>`;
  }).join("");
  const pct = Math.round(((idxAtual + 1) / ETAPAS_PROCESSAMENTO.length) * 100);
  const bar = qs("#progressBar"); if(bar) bar.style.width = pct + "%";
  const txt = qs("#processingText"); if(txt) txt.innerHTML = '<span class="spinner"></span>' + escapeHtml(ETAPAS_PROCESSAMENTO[idxAtual]) + ` <span style="opacity:.7">(${pct}%)</span>`;
}

// Avança as etapas automaticamente em intervalos quando não temos sinal real do backend.
function startProgresso(){
  const bar = qs("#progressBar");
  bar?.classList.add("busy");
  let etapa = 0;
  renderEtapas(etapa);
  // Velocidade variável. PARA na etapa 7 (Gerando mensagens) — a 8 (Finalizado) só por chamada explícita.
  const intervalos = [800, 800, 1500, 1500, 6000, 1500, 6000];
  let timer = null;
  function avancar(){
    if(etapa < ETAPAS_PROCESSAMENTO.length - 2){ // limite: até "Gerando mensagens" (índice 7)
      etapa++;
      renderEtapas(etapa);
      if(etapa < intervalos.length){
        timer = setTimeout(avancar, intervalos[etapa] || 2000);
      }
    }
  }
  timer = setTimeout(avancar, intervalos[0]);
  return {
    avancarPara: (idx, sub) => { etapa = idx; renderEtapas(etapa, sub); if(timer) clearTimeout(timer); },
    atualizarSub: (sub) => renderEtapas(etapa, sub),
    finalizar: () => { etapa = ETAPAS_PROCESSAMENTO.length - 1; renderEtapas(etapa); if(timer) clearTimeout(timer); bar?.classList.remove("busy"); },
    parar: () => { if(timer) clearTimeout(timer); bar?.classList.remove("busy"); }
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
  if(/HTTP 5\d\d/i.test(raw)){
    return "O servidor teve um problema interno. Aguarde um minuto e tente novamente.";
  }
  // Sem casamento conhecido: mostra mensagem genérica + sugestão.
  if(raw.length > 200 || /[<>{}]/.test(raw)){
    return "Não foi possível processar este ZIP agora. Tente em alguns minutos ou reimporte uma conversa menor.";
  }
  return raw || "Não foi possível processar este ZIP agora.";
}

async function uploadLargeZipToSupabase(file){
  state.ultimoArquivo = file;
  qs("#processingText").textContent="Preparando upload seguro para ZIP grande...";
  qs("#progressBar").style.width="18%";

  const metaRes = await fetch("./api/criar-upload-url", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      fileName:file.name,
      size:file.size,
      contentType:file.type || "application/zip"
    })
  });

  let meta;
  try{ meta = await metaRes.json(); }
  catch(e){ throw new Error("A rota de upload grande não respondeu em JSON."); }

  if(!metaRes.ok || !meta.ok){
    throw new Error(meta.error || meta.details || "Não foi possível preparar o upload grande.");
  }

  qs("#processingText").textContent="Enviando a conversa (arquivo grande)…";
  qs("#progressBar").style.width="35%";

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
  state.ultimoUploadStorage = { bucket: meta.bucket, path: meta.path };

  // Processa em ETAPAS (cada chamada cabe nos 10s do servidor):
  // 1) preparar → 2) transcrever em lotes → 3) analisar
  let analysisData;
  try{
    analysisData = await processarStorageEmEtapas(meta.bucket, meta.path);
  }catch(err){
    qs("#progressBar").style.width="100%";
    const ehTimeout = err?.name === "AbortError" || /aborted|abort/i.test(String(err?.message||""));
    qs("#processingText").textContent = ehTimeout ? "Demorou demais — servidor não respondeu." : "Não foi possível analisar.";
    qs("#resultBox").className="notice error";
    qs("#resultBox").innerHTML =
      "<b>Não foi possível analisar a conversa agora.</b><br><br>" +
      escapeHtml(userFriendlyError(err, file)) +
      `<div style="margin-top:14px;display:flex;gap:10px"><button type="button" class="btn" id="btnRetomarAnalise" style="flex:1">Tentar analisar novamente</button></div>`;
    qs("#btnRetomarAnalise")?.addEventListener("click", async () => {
      const stored = state.ultimoUploadStorage;
      if(stored?.bucket && stored?.path){
        qs("#processingText").textContent = "Tentando de novo (sem reenviar o ZIP)...";
        try{
          const data = await processarStorageEmEtapas(stored.bucket, stored.path);
          qs("#progressBar").style.width="100%";
          qs("#processingText").textContent="Conversa processada.";
          renderProcessedResult(data, { fileName: file.name, fileSize: file.size, source:"storage-retry", bucket: stored.bucket, path: stored.path });
          toast("Funcionou na segunda tentativa.");
        }catch(e2){ toast("Ainda falhou: " + userFriendlyError(e2, file)); }
        return;
      }
      if(state.ultimoArquivo){ state.processing = false; processFile(state.ultimoArquivo); }
    });
    toast(ehTimeout ? "Tempo esgotado numa das etapas." : "Erro na análise.");
    return;
  }

  qs("#progressBar").style.width="100%";
  qs("#processingText").textContent="Conversa processada.";
  renderProcessedResult(analysisData, { fileName: file.name, fileSize: file.size, source: "storage", bucket: meta.bucket, path: meta.path });
  toast("ZIP grande processado. Confira e clique em Salvar lead.");
}

// Orquestra o processamento em 3 etapas, cada chamada curta o suficiente pro servidor.
async function processarStorageEmEtapas(bucket, path){
  async function chamar(payload, timeoutMs){
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs || 30000);
    try{
      const res = await fetch("./api/processar-storage", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ bucket, path, ...payload }), signal: ctrl.signal
      });
      const data = await res.json().catch(() => ({ ok:false, error:"Resposta inválida do servidor." }));
      if(!res.ok || !data.ok) throw new Error(data.error || data.details || ("Erro HTTP "+res.status));
      return data;
    } finally { clearTimeout(to); }
  }

  // ETAPA 1 — preparar
  renderEtapas(2, "lendo conversa e aplicando janela");
  qs("#progressBar").style.width="35%";
  // Conversa grande (muito áudio) pode levar quase os 60s do servidor pra baixar+abrir o ZIP.
  // Espera até 58s antes de desistir (antes era 45s e desistia com o servidor ainda lendo).
  const prep = await chamar({ action: "preparar" }, 58000);
  const audios = prep.audiosParaTranscrever || [];
  const janela = prep.janelaConversa;

  // ETAPA 2 — transcrever em lotes de 3 (com retry automático antes de desistir)
  const transcriptionMap = {};
  if(audios.length){
    renderEtapas(4, `transcrevendo ${audios.length} áudio(s)`);
    const LOTE = 3;
    const TIMEOUT_LOTE = 55000;
    for(let i=0; i<audios.length; i+=LOTE){
      const lote = audios.slice(i, i+LOTE);
      let r = null;
      let ultimoErr = null;
      for(let tentativa = 1; tentativa <= 2 && !r; tentativa++){
        try{
          r = await chamar({ action: "transcrever", audioNames: lote }, TIMEOUT_LOTE);
        }catch(e){
          ultimoErr = e;
          if(tentativa < 2) await new Promise(res => setTimeout(res, 1500));
        }
      }
      if(!r){ throw ultimoErr || new Error("Falha ao transcrever lote"); }
      Object.assign(transcriptionMap, r.transcriptions || {});
      const feito = Math.min(audios.length, i+LOTE);
      const pct = 35 + Math.round((feito/audios.length) * 40); // 35% → 75%
      qs("#progressBar").style.width = pct + "%";
      renderEtapas(4, `transcrevendo áudios (${feito}/${audios.length})`);
    }
  } else {
    renderEtapas(5, "sem áudios na janela");
  }

  // ETAPA 3 — analisar (manda mensagens + transcrições, sem ZIP)
  renderEtapas(6, "analisando atendimento com o Cérebro");
  qs("#progressBar").style.width="85%";
  const result = await chamar({
    action: "analisar",
    txtFile: prep.txtFile,
    messages: prep.messages,
    audioFilesRelevantes: prep.audioFilesRelevantes,
    transcriptionMap,
    janelaConversa: janela,
    ignoredFilesCount: prep.ignoredFilesCount,
    ignoredFiles: prep.ignoredFiles,
    audiosTotalNoZip: prep.audiosTotalNoZip,
    audiosDescartadosPorJanela: prep.audiosDescartadosPorJanela,
    metricsBase: prep.metricsBase
  }, 60000);
  renderEtapas(8);
  return result;
}

// ============ RENDERIZAÇÃO + SALVAR/DESCARTAR ============
async function renderProcessedResult(data, meta){
  const lead = data.lead || {};
  const analysis = data.analysis || {};
  state.lead = limparLead({
    name: lead.clientName || "Cliente importado",
    product: lead.product || "Produto não identificado",
    status: "Conversa processada (não salvo)",
    probability: analysis.probabilityPercent ? analysis.probabilityPercent + "%" : (analysis.probability || "—"),
    bestTime: analysis.bestTime || "—",
    id: null
  });
  state.pendingSave = {
    result: data,
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    source: meta.source,
    bucket: meta.bucket || null,
    path: meta.path || null
  };

  qs("#clientName").value = state.lead.name;
  renderAnalysis(analysis, state.lead);

  const j = data.janelaConversa;
  const janelaHtml = (j && j.aplicado) ?
    `<div style="margin-top:10px;padding:10px 12px;background:rgba(55,232,255,.06);border:1px solid rgba(55,232,255,.22);border-radius:10px;font-size:13px"><b style="color:var(--dados)">Janela aplicada:</b> últimos ${j.dias} dias da conversa (${escapeHtml(j.janelaDe)} → ${escapeHtml(j.janelaAte)}). Considerei ${j.totalFiltrado} de ${j.totalOriginal} mensagens · ignorei ${Number(data.audiosDescartadosPorJanela||0)} áudio(s) fora da janela. <a href="#" onclick="show('cerebro');return false" style="color:var(--lime);text-decoration:underline">mudar janela</a></div>` : "";

  const sm = data.metrics || {};
  const semMidiaHtml = sm.exportadoSemMidia ? `<div style="margin-top:10px;padding:11px 13px;background:rgba(255,155,59,.1);border:1px solid var(--morno);border-radius:10px;font-size:13px;color:#ffd9ad"><b>⚠️ Conversa exportada SEM mídia.</b> ${Number(sm.midiasOcultas)||0} mídia(s) ficaram ocultas — os <b>áudios não vieram no arquivo</b> e não dá pra transcrever. Pra incluir os áudios (importantes pra análise), reexporte a conversa no WhatsApp escolhendo <b>"Incluir mídia"</b> e importe de novo.</div>` : "";

  // Já existe lead com mesmo TELEFONE (certeza = mesmo cliente) ou mesmo NOME (pode ser outra pessoa)?
  const match = await acharLeadExistente(state.lead.name, lead.phone, meta.fileName || state.pendingSave?.fileName);
  const existente = match ? match.lead : null;
  state.pendingExistente = existente;
  state.pendingViaTelefone = !!(match && match.via === "telefone"); // bateu pelo número = atualização automática
  // RECONHECIMENTO POR NOME quando NÃO há telefone (pedido do dono): muito lead não traz número na
  // exportação. Se o nome bate EXATAMENTE e não dá pra distinguir por telefone (o import novo OU o
  // lead salvo está sem número), é o MESMO cliente → atualiza sozinho, sem perguntar. Só PERGUNTA
  // quando pode ser OUTRA pessoa: produtos/empreendimentos claramente diferentes, ou os dois têm
  // telefone e os números DIVERGEM (aí o nome igual vira coincidência).
  let autoPorNome = false;
  if(existente && match && match.via === "nome"){
    const soDig = (s) => String(s||"").replace(/\D/g,"");
    const foneNovo = soDig(lead.phone), foneExist = soDig(existente.phone);
    const semTelefonePraDistinguir = foneNovo.length < 8 || foneExist.length < 8;
    const ehNaoIdent = (p) => { const s = String(p||"").toLowerCase().trim(); return !s || /n[ãa]o identificad/.test(s); };
    const prodExist = String(existente.product||"").toLowerCase().trim();
    const prodNovo = String(state.lead.product||"").toLowerCase().trim();
    const produtosDiferentes = !ehNaoIdent(prodExist) && !ehNaoIdent(prodNovo) && prodExist !== prodNovo;
    autoPorNome = semTelefonePraDistinguir && !produtosDiferentes;
  }
  const perguntarNome = !!(match && match.via === "nome") && !autoPorNome; // nome ambíguo → PERGUNTA
  let acoesHtml;
  if(existente && !perguntarNome){
    // Mesmo cliente (telefone igual, OU nome igual sem telefone pra distinguir) → atualiza sozinho.
    acoesHtml =
      `<div id="pendingBox" style="margin-top:14px;padding:12px;background:rgba(104,255,149,.08);border:1px solid rgba(104,255,149,.32);border-radius:12px;color:#bdffd0"><b>Atualizando ${escapeHtml((existente.name||"este lead").split(" ")[0])}...</b> ${state.pendingViaTelefone ? "Mesmo telefone" : "Mesmo nome"} — atualizo o atual, sem duplicar.</div>` +
      `<div id="pendingActions" style="display:none;gap:10px;margin-top:12px;flex-wrap:wrap"><button type="button" id="btnAtualizarLead" class="btn" style="flex:1;min-width:160px">Atualizar ${escapeHtml((existente.name||"").split(" ")[0])}</button><button type="button" id="btnDescartarLead" class="btn secondary" style="flex:1;min-width:120px">Descartar</button></div>`;
  } else if(perguntarNome){
    // Nome igual, telefone não confirma → PERGUNTA: é o mesmo cliente ou outro?
    const prodExist = String(existente.product||"").trim();
    const prodNovo = String(state.lead.product||"").trim();
    const temProds = prodExist && prodNovo && !/não identificad/i.test(prodExist) && !/não identificad/i.test(prodNovo);
    // Produtos diferentes = quase sempre outro cliente → sugere "criar novo" por padrão.
    const produtosDiferentes = temProds && prodExist.toLowerCase() !== prodNovo.toLowerCase();
    const btnAtualizar = `<button type="button" id="btnAtualizarLead" class="btn${produtosDiferentes ? " secondary" : ""}" style="flex:1;min-width:150px">É o mesmo — atualizar</button>`;
    const btnNovo = `<button type="button" id="btnSalvarLead" class="btn${produtosDiferentes ? "" : " secondary"}" style="flex:1;min-width:150px">É outro — criar novo</button>`;
    const ordemBtns = produtosDiferentes ? (btnNovo + btnAtualizar) : (btnAtualizar + btnNovo);
    const dica = produtosDiferentes ? `<div class="small" style="margin-top:8px;color:var(--morno);font-size:11px">Produtos diferentes — provavelmente é outro cliente.</div>` : "";
    acoesHtml =
      `<div id="pendingBox" style="margin-top:14px;padding:12px;background:rgba(255,155,59,.08);border:1px solid var(--morno);border-radius:12px;color:#ffd9ad"><b>Já existe "${escapeHtml(existente.name||"")}"${prodExist && !/não identificad/i.test(prodExist) ? " — "+escapeHtml(prodExist) : ""}.</b><br>Você está importando "${escapeHtml(state.lead.name||"")}"${prodNovo && !/não identificad/i.test(prodNovo) ? " — "+escapeHtml(prodNovo) : ""}.<br>É o mesmo cliente ou outra pessoa com o mesmo nome?</div>${dica}` +
      `<div id="pendingActions" style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">${ordemBtns}</div>` +
      `<div style="margin-top:8px;text-align:center"><button type="button" id="btnDescartarLead" style="background:transparent;border:none;color:var(--muted);font-size:11px;text-decoration:underline;cursor:pointer">Descartar análise</button></div>`;
  } else {
    // Lead novo: importou = salvo. Sem passo manual — salva e abre sozinho (ver fim da função).
    acoesHtml =
      `<div id="pendingBox" style="margin-top:14px;padding:12px;background:rgba(104,255,149,.08);border:1px solid rgba(104,255,149,.32);border-radius:12px;color:#bdffd0"><b>Salvando o lead...</b> Já abre com a análise.</div>` +
      `<div id="pendingActions" style="display:none;gap:10px;margin-top:12px;flex-wrap:wrap"><button type="button" id="btnSalvarLead" class="btn" style="flex:1;min-width:160px">Salvar lead</button><button type="button" id="btnDescartarLead" class="btn secondary" style="flex:1;min-width:160px">Descartar análise</button></div>`;
  }

  qs("#resultBox").className = "small";
  qs("#resultBox").innerHTML =
    acoesHtml +
    `<div style="margin-top:14px">` +
    `<b>TXT:</b> ${escapeHtml(data.txtFile || meta.fileName)}<br>` +
    `<b>Áudios encontrados na janela:</b> ${(data.audioFiles || []).length} · <b>transcritos:</b> ${data.audiosTranscritos || 0} · <b>com erro:</b> ${data.audiosComErro || 0}<br>` +
    `<b>Arquivos ignorados:</b> ${data.ignoredFilesCount || 0}<br>` +
    `<b>Resumo:</b> ${escapeHtml(analysis.summary || "Conversa processada.")}<br>` +
    janelaHtml + semMidiaHtml +
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

  if(existente && !perguntarNome){
    // Telefone confirma o mesmo cliente: atualiza automaticamente (compara e aprende a evolução).
    atualizarLeadComEvolucao();
  } else if(perguntarNome){
    // Nome igual: NÃO faz nada automático — espera o usuário escolher (atualizar ou criar novo).
  } else {
    // Lead novo: importou = salvo. Salva e abre o lead automaticamente, sem clique.
    salvarLeadPendente();
  }
}

// Acha um lead já salvo parecido (por TELEFONE ou NOME) pra reimportação virar atualização — nunca duplicar.
// Procura na base INTEIRA (não só nos recentes), senão um lead antigo escaparia e duplicaria.
async function acharLeadExistente(nome, telefone, arquivo){
  const norm = (s) => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  // O corretor cola o nome do empreendimento no contato (ex.: "Katia ... Prime"). O nome do
  // lead é salvo SEM o produto, então sem tirar isso a reimportação não casa e vira duplicado.
  const PRODUTOS = ["renaissance","evolutti","boulevard","terrenos","premium office","quality","personalite","prime"];
  const semProduto = (s) => { let o = norm(s); for(const p of PRODUTOS) o = o.replace(new RegExp("\\b"+p+"\\b","g")," "); return o.replace(/\s+/g," ").trim(); };
  // Nome do arquivo da conversa = identidade estável do contato (mesmo export = mesmo cliente).
  const normArquivo = (s) => norm(String(s||"").replace(/\.zip$/i,"").replace(/-enxuto$/i,"").replace(/\s*\(\d+\)\s*$/,"").replace(/^conversa do whatsapp com\s+/i,""));
  const soDigitos = (s) => String(s||"").replace(/\D/g,"");
  const alvoNome = norm(nome);
  const alvoNomeSP = semProduto(nome);
  const alvoArq = normArquivo(arquivo);
  const digFone = soDigitos(telefone);
  const foneAlvo = digFone.length >= 8 ? digFone.slice(-8) : ""; // últimos 8 dígitos (ignora DDI/DDD divergente)
  if(alvoNome.length < 3 && !foneAlvo && alvoArq.length < 3) return null;
  let leads = state.leads || [];
  try{
    // SEMPRE fresco do servidor (força, sem cache de 60s) — assim um lead recém-apagado
    // não aparece como "já existe" na hora de importar.
    const data = await getLeadsData(true);
    if(Array.isArray(data?.items)) leads = data.items.map(limparLead);
  }catch(_){ /* se a rede falhar, usa o que já tem em memória */ }
  for(const l of leads){
    if(!l.id) continue;
    // 1) Telefone bate = mesmo lead (sinal mais forte → atualiza sozinho)
    if(foneAlvo){
      const lf = soDigitos(l.phone);
      if(lf.length >= 8 && lf.slice(-8) === foneAlvo) return { lead: l, via: "telefone" };
    }
    // 2) Nome bate APENAS se for EXATAMENTE igual (depois de tirar o nome do empreendimento
    // colado no contato). Nada de "um contém o outro": isso fundia clientes diferentes pelo
    // primeiro nome (ex.: "Luciano" caía em "Luciano Bertani"). Como nome igual pode ser OUTRA
    // pessoa, devolve via:"nome" pra PERGUNTAR antes.
    if(alvoNomeSP.length >= 3){
      const ln = semProduto(l.name);
      if(ln && ln === alvoNomeSP) return { lead: l, via: "nome" };
    }
    // 3) Mesmo ARQUIVO de conversa = mesmo contato reexportado → é reimportação, atualiza (não
    // duplica). Pega o caso em que a análise nova não extraiu o nome (vinha "Cliente importado").
    if(alvoArq.length >= 3 && l.fileName){
      if(normArquivo(l.fileName) === alvoArq) return { lead: l, via: "nome" };
    }
  }
  return null;
}

async function atualizarLeadComEvolucao(){
  const existente = state.pendingExistente;
  const viaTelefone = !!state.pendingViaTelefone; // atualização automática por número (sem o usuário escolher)
  if(!existente?.id || !state.pendingSave){ toast("Nada pra atualizar."); return; }
  const btn = qs("#btnAtualizarLead");
  if(btn){ btn.disabled = true; btn.textContent = "Atualizando e comparando..."; }
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action: "atualizar-com-evolucao", id: existente.id, result: state.pendingSave.result })
    });
    const data = await res.json().catch(()=>({ok:false,error:"Resposta inválida do servidor."}));
    if(!res.ok || !data.ok) throw new Error(data.error || "Erro ao atualizar.");
    state.pendingSave = null;
    state.pendingExistente = null;
    state.pendingViaTelefone = false;
    const ev = data.evolucao;
    const juntou = Number(data.preservadasDoAntigo||0) > 0; // o arquivo novo NÃO trazia parte da conversa salva → juntei as duas
    const primeiroNome = (existente.name||"").split(" ")[0] || "o lead";
    const pendingBox = qs("#pendingBox");
    if(pendingBox){
      pendingBox.style.background = "rgba(104,255,149,.08)";
      pendingBox.style.borderColor = "rgba(104,255,149,.32)";
      pendingBox.style.color = "#bdffd0";
      // Quando bateu pelo número, deixa CLARO que reconheceu e atualizou o lead que já existia
      // (não criou outro) — senão a importação parecia não ter feito nada.
      let txt = viaTelefone
        ? `<b>✓ Reconheci pelo número — atualizei ${escapeHtml(primeiroNome)} (não criei outro lead).</b> `
        : "<b>Atualizado.</b> ";
      if(juntou) txt += `Juntei as duas conversas (mantive ${data.preservadasDoAntigo} mensagem(ns) que só estavam na conversa anterior). `;
      if(ev){
        txt += `O que mudou: ${escapeHtml(ev.oQueMudou||"—")}. `;
        if(ev.abordagemFuncionou && ev.abordagemFuncionou !== "sem-dados") txt += `Abordagem anterior: <b>${escapeHtml(ev.abordagemFuncionou)}</b>. `;
        if(ev.licao && ev.licao !== "sem lição clara ainda") txt += `Lição: ${escapeHtml(ev.licao)}`;
      }
      pendingBox.innerHTML = txt;
    }
    toast(viaTelefone ? `✓ Atualizei ${primeiroNome} (mesmo número) — não dupliquei.` : (juntou ? "Conversas juntadas e lead atualizado." : "Lead atualizado com evolução."));
    loadRecentLeads();
    // REIMPORTOU = tem conversa NOVA → reanalisa a conversa INTEIRA na hora (em segundo plano), pra
    // as 3 respostas saírem ATUALIZADAS conforme o que mudou — SEM depender de abrir o lead nem de
    // "juntar" arquivo antigo. (Antes só rodava quando juntava trechos; por isso reimportar às vezes
    // mantinha resposta antiga. Pedido do dono: conversa nova tem que gerar resposta nova na hora.)
    // Não trava a tela; quando termina, re-renderiza o lead sozinho com as sugestões já refinadas.
    if(existente.id) reanalisarEmSegundoPlano(existente.id);
    qs("#pendingActions")?.remove();
    // Abre o lead atualizado NA HORA pra o corretor ver (pedido do dono) — tanto na atualização
    // automática por número quanto na confirmada. Antes, no caso do número, ficava só um botão e
    // parecia que tinha voltado pra home sem nada.
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
    state.pendingSave = null;
    const pendingBox = qs("#pendingBox");
    if(pendingBox){
      pendingBox.style.background = "rgba(104,255,149,.08)";
      pendingBox.style.borderColor = "rgba(104,255,149,.32)";
      pendingBox.style.color = "#bdffd0";
      pendingBox.innerHTML = "<b>Salvo no banco.</b> Lead disponível no Pipeline e na Home.";
    }
    qs("#pendingActions")?.remove();
    toast("Lead salvo.");
    loadRecentLeads(); refreshAllSections();
    // Após salvar, abre o lead da home pra mostrar o card de foco completo (com badges, materiais, etc).
    setTimeout(() => { if(state.lead?.id) abrirLead(state.lead.id); }, 800);
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Salvar lead"; }
    const pa = qs("#pendingActions"); if(pa) pa.style.display = "flex"; // mostra botões pra tentar de novo
    toast("Não foi possível salvar: " + (err.message||err));
  }
}

function descartarLeadPendente(){
  if(!confirm("Descartar essa análise sem salvar no banco?")) return;
  state.pendingSave = null;
  clearAnalysis();
  toast("Análise descartada.");
}

async function processFile(file){
  if(!file||state.processing)return;
  state.ultimoArquivo = file;
  clearAnalysis();
  state.processing=true;
  show("zip");
  qs("#fileName").textContent="Arquivo selecionado: "+file.name+" ("+(file.size/1024/1024).toFixed(1)+" MB)";
  qs("#fileName").classList.add("show");
  qs("#processingBox").classList.add("show");
  qs("#processingText").textContent="Validando arquivo...";
  qs("#progressBar").style.width="6%";

  if(!file.name.toLowerCase().endsWith(".zip")){
    qs("#processingText").textContent="Arquivo inválido.";
    showCard("resultCard", true);
    qs("#resultBox").className="notice error";
    qs("#resultBox").innerHTML="Envie o arquivo ZIP exportado pelo WhatsApp.";
    state.processing=false;return;
  }

  // Enxuga o ZIP no celular: mantém só .txt e áudio, joga fora imagem/vídeo/doc.
  let slimInfo = null;
  let working = file;
  try{
    qs("#processingText").textContent="Removendo imagens, vídeos e documentos do ZIP no celular...";
    slimInfo = await slimZipKeepingTextAndAudio(file, ({processed,total,kept,dropped})=>{
      const pct = Math.round((processed/total)*15) + 3;
      qs("#progressBar").style.width = Math.min(18, pct) + "%";
      qs("#processingText").textContent = "Enxugando ZIP: "+processed+"/"+total+" arquivos · mantidos "+kept+", descartados "+dropped;
    });
    working = slimInfo.file;
    const oMb = (slimInfo.originalSize/1024/1024).toFixed(1);
    const sMb = (slimInfo.slimSize/1024/1024).toFixed(1);
    qs("#processingText").textContent = "ZIP enxugado: "+oMb+" MB → "+sMb+" MB ("+slimInfo.kept+" arquivos úteis, "+slimInfo.dropped+" descartados).";
  }catch(err){
    // Se enxugar falhar, segue com o original — pelo menos tenta.
    qs("#processingText").textContent="Não enxuguei o ZIP ("+escapeHtml(String(err?.message||err))+"). Tentando subir o original.";
    working = file;
  }

  // Tudo passa pelo Storage — o processar-storage dá conta de qualquer tamanho.
  try{
    await uploadLargeZipToSupabase(working);
  }catch(err){
    qs("#progressBar").style.width="100%";
    qs("#processingText").textContent="Falha no processamento.";
    showCard("resultCard", true);
    qs("#resultBox").className="notice error";
    state.ultimoArquivo = file;
    qs("#resultBox").innerHTML =
      escapeHtml(userFriendlyError(err,working)).replace(/\n/g,"<br>") +
      `<div style="margin-top:14px;display:flex;gap:10px"><button type="button" class="btn" id="btnTentarNovamente" style="flex:1">Tentar novamente</button><button type="button" class="btn secondary" id="btnDescartarTentativa" style="flex:1">Descartar</button></div>`;
    qs("#btnTentarNovamente")?.addEventListener("click", () => {
      if(state.ultimoArquivo){ state.processing = false; processFile(state.ultimoArquivo); }
    });
    qs("#btnDescartarTentativa")?.addEventListener("click", () => {
      state.ultimoArquivo = null;
      showCard("resultCard", false);
    });
    toast("Erro ao processar.");
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

// IndexedDB helpers (mesmas constantes do service worker).
const SHARE_IDB_NAME = 'direciona-share';
const SHARE_IDB_VERSION = 1;
const SHARE_IDB_STORE = 'zips';

function shareIdbOpen(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(SHARE_IDB_NAME, SHARE_IDB_VERSION);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(SHARE_IDB_STORE)){
        db.createObjectStore(SHARE_IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

async function shareIdbGet(id){
  if(!("indexedDB" in window)) return null;
  let db;
  try{ db = await shareIdbOpen(); }catch(_){ return null; }
  try{
    return await new Promise((resolve)=>{
      const tx = db.transaction(SHARE_IDB_STORE, 'readonly');
      const store = tx.objectStore(SHARE_IDB_STORE);
      const req = store.get(id);
      let result = null;
      req.onsuccess = ()=>{ result = req.result || null; };
      req.onerror = ()=>{ result = null; };
      tx.oncomplete = ()=>resolve(result);
      tx.onerror = ()=>resolve(null);
      tx.onabort = ()=>resolve(null);
    });
  }finally{ db.close(); }
}

async function shareIdbDel(id){
  if(!("indexedDB" in window)) return;
  let db;
  try{ db = await shareIdbOpen(); }catch(_){ return; }
  try{
    await new Promise((resolve)=>{
      const tx = db.transaction(SHARE_IDB_STORE, 'readwrite');
      tx.objectStore(SHARE_IDB_STORE).delete(id);
      tx.oncomplete = ()=>resolve();
      tx.onerror = ()=>resolve();
    });
  }finally{ db.close(); }
}

async function checkShared(){
  const params = new URLSearchParams(location.search);
  const cameFromShare = params.has("shared") || params.get("source")==="share-target" || params.has("share-target");
  const erroUrl = params.get("erro");

  // Tenta IndexedDB primeiro (mais confiavel no Android).
  try{
    const record = await shareIdbGet('latest');
    if(record && record.blob && record.blob.size > 0){
      const file = new File([record.blob], record.name || "conversa-whatsapp.zip", {
        type: record.type || record.blob.type || "application/zip"
      });
      shareIdbDel('latest').catch(()=>{});
      show("zip");
      try{ history.replaceState(null, "", location.pathname); }catch(_){}
      qs("#processingBox")?.classList.add("show");
      if(qs("#processingText")) qs("#processingText").textContent = "Conversa recebida pelo compartilhamento. Preparando arquivo...";
      processFile(file);
      return;
    }
  }catch(_){}

  if(!("caches" in window)){
    if(cameFromShare){
      show("zip");
      showCard("resultCard", true);
      qs("#resultBox").className="notice error";
      qs("#resultBox").innerHTML="Este navegador não permite ao app guardar o arquivo compartilhado. Use Chrome no Android.";
    }
    return;
  }

  const zipKeys = ["/__direciona_shared_zip__","./__direciona_shared_zip__","__direciona_shared_zip__"];

  try{
    const allNames = await caches.keys();
    // Prioriza o cache estável; o resto vem em seguida
    const shareCaches = [
      "direciona-sharetarget-stable",
      ...allNames.filter(n => n !== "direciona-sharetarget-stable" && (n.startsWith("direciona-sharetarget-") || n.startsWith("direciona-static-")))
    ];

    for(const cacheName of shareCaches){
      let cache;
      try{ cache = await caches.open(cacheName); }catch(_){ continue; }
      for(const key of zipKeys){
        const cached = await cache.match(key);
        if(!cached) continue;

        const blob = await cached.blob();
        const name = decodeURIComponent(cached.headers.get("X-File-Name") || "conversa-whatsapp.zip");

        for(const k of zipKeys){ try{ await cache.delete(k); }catch(e){} }

        show("zip");
        qs("#processingBox").classList.add("show");
        qs("#processingText").textContent="Conversa recebida pelo compartilhamento. Preparando arquivo...";
        qs("#progressBar").style.width="8%";
        showCard("resultCard", true);

        processFile(new File([blob], name, { type: blob.type || "application/zip" }));
        return;
      }
    }

    if(cameFromShare){
      const debug = await readShareDebug();
      show("zip");
      showCard("resultCard", true);
      qs("#resultBox").className="notice error";
      qs("#resultBox").innerHTML =
        "<b>O Corretor Pro abriu pelo compartilhamento mas o arquivo não foi guardado.</b><br>" +
        (erroUrl ? "<b>Motivo (URL):</b> "+escapeHtml(erroUrl)+"<br>" : "") +
        "<b>Caches encontrados:</b> "+shareCaches.filter((v,i,a)=>a.indexOf(v)===i).length+"<br><br>" +
        "<b>Diagnóstico do que chegou:</b><br>" +
        formatShareDebug(debug) +
        (debug ? "" : "<br><i>Sem diagnóstico significa que o service worker antigo ainda estava ativo quando você compartilhou. Tente compartilhar mais uma vez agora — o service worker novo já assumiu.</i>");
      try{ history.replaceState(null, "", location.pathname); }catch(_){}
    }
  }catch(e){
    if(cameFromShare){
      show("zip");
      showCard("resultCard", true);
      qs("#resultBox").className="notice error";
      qs("#resultBox").innerHTML="Falha ao ler o arquivo compartilhado: "+escapeHtml(String(e?.message||e));
      try{ history.replaceState(null, "", location.pathname); }catch(_){}
    }
  }
}
qsa(".nav[data-target],.go").forEach(b=>b.addEventListener("click",()=>{
  // Ir manualmente pra home limpa lead aberto e grupo aberto, pra mostrar os botões iniciais.
  // (A guarda em renderListasHome impede que o auto-refresh derrube quem está num lead/grupo.)
  if(b.dataset.target === "home"){ state.lead = null; state.focoLeadId = null; state.grupoAtivo = null; }
  // Proposta aberta pelo Menu (não a partir de um lead) não fica vinculada a lead nenhum.
  if(b.dataset.target === "propostas"){ state.propLeadId = null; state.propLeadNome = ""; atualizarVoltarProposta(); }
  // "Carteira" sempre abre na aba Oportunidades (priorizada), não na última aba usada (ex.: Últimos).
  if(b.dataset.target === "pipeline"){ setPipelineTab("oportunidades"); }
  show(b.dataset.target, { navKey: b.dataset.navKey || b.dataset.target });
  fecharMenuGaveta(); // se veio da gaveta do celular, fecha ao navegar
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
// Adicionar regra
function addRegraCerebro(){
  const inp = qs("#cerebroNovaRegra");
  const t = (inp?.value || "").trim();
  if(!t) return;
  cerebroRegras.push({ texto: t, origem: "manual", criadoEm: new Date().toISOString() });
  inp.value = "";
  renderCerebroRegras();
  toast("Regra adicionada. Não esqueça de Salvar.");
}
qs("#cerebroAddRegra")?.addEventListener("click", addRegraCerebro);
qs("#cerebroNovaRegra")?.addEventListener("keydown", e => { if(e.key==="Enter"){ e.preventDefault(); addRegraCerebro(); } });
// Adicionar objeção
qs("#cerebroAddObjecao")?.addEventListener("click", () => {
  const obj = (qs("#cerebroNovaObjecao")?.value || "").trim();
  const resp = (qs("#cerebroNovaResposta")?.value || "").trim();
  if(!obj && !resp) return;
  cerebroObjecoes.push({ objecao: obj, resposta: resp, criadoEm: new Date().toISOString() });
  qs("#cerebroNovaObjecao").value = "";
  qs("#cerebroNovaResposta").value = "";
  renderCerebroObjecoes();
  toast("Objeção adicionada. Não esqueça de Salvar.");
});
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
        cerebroRegras.push({ texto: b.dataset.texto, origem: b.dataset.origem, criadoEm: new Date().toISOString() });
        renderCerebroRegras();
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
// Aprender de TODA a carteira (leads já no Direciona) — roda em lotes até concluir, com progresso.
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
    cerebroRegras.push({ texto: b.dataset.texto, origem: b.dataset.origem, criadoEm: new Date().toISOString() });
    renderCerebroRegras();
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
      cerebroRegras.push({ texto: data.texto, origem: "audio", criadoEm: new Date().toISOString() });
      renderCerebroRegras();
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
// ============ IMPORTAR LEADS DO CRM (CSV) ============
function parseCsvDireciona(t){
  const rows=[]; let row=[], cur="", q=false;
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){ if(c==='"'){ if(t[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else { if(c==='"')q=true; else if(c===','){row.push(cur);cur="";} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur="";} else if(c==='\r'){} else cur+=c; }
  }
  if(cur.length||row.length){row.push(cur);rows.push(row);}
  return rows;
}
const CRM_ETAPA_MAP = { "PERDIDO":"Perdido","ATENDIMENTO":"Atendimento","NOVO / INICIAL":"Novo","NOVO/INICIAL":"Novo","STAND BY":"Standby","STANDBY":"Standby","VISITA / PROPOSTA":"Visita/Proposta","NEGOCIAÇÃO":"Negociação","NEGOCIACAO":"Negociação" };
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
    const head = rows[0].map(h=>h.trim());
    const ix = {}; head.forEach((h,i)=>ix[h]=i);
    if(ix["id"] === undefined || ix["nome"] === undefined){ st.textContent = "Esse CSV não tem as colunas esperadas (id, nome…). Confira a exportação do CRM."; e.target.value=""; return; }
    const data = rows.slice(1).filter(r => (r[ix["id"]]||"").trim());
    const leads = data.map(r => {
      const get = (k) => (ix[k] !== undefined ? (r[ix[k]] ?? "") : "").trim();
      const etapaMap = CRM_ETAPA_MAP[get("etapa").toUpperCase()] || "Novo";
      return {
        nome: get("nome") || "Cliente",
        telefone: get("telefone"),
        empreendimento: get("empreendimento"),
        etapaMap,
        ativo: etapaMap !== "Perdido",
        origem: get("origem"),
        observacao: get("observacao"),
        criado: get("criado_em") || new Date().toISOString(),
        idShort: get("id").slice(0,8)
      };
    });

    // Quem já foi importado antes? Evita duplicar e deixa rodar de novo pra completar o que faltou.
    // Também monta o mapa de TELEFONES já existentes (de qualquer origem: WhatsApp, CRM antigo, etc)
    // pra juntar no lead existente em vez de duplicar.
    st.textContent = "Conferindo o que já está importado…";
    const jaImportados = new Set();
    const porTelefone = new Map(); // ultimos 8 dígitos -> { id, obs }
    try{
      const dl = await getLeadsData(true);
      (dl.items||[]).forEach(it => {
        const m = String(it.fileName||"").match(/\[CRM\s+([A-Za-z0-9]{1,8})\]/);
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
    if(!confirm(`Importar ${aImportar.length} leads do CRM?${jaTinha?`\n\n(${jaTinha} já estavam importados — vou pular esses, sem duplicar.)`:""}\n\n• Todos entram agora, na hora.\n• ${ativosCount} ativos serão analisados pelo Corretor Pro em seguida (isso demora, mas os leads JÁ ficam salvos — se a aba fechar, é só rodar de novo pra continuar de onde parou).`)){ e.target.value=""; return; }

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
          body: JSON.stringify({ id: alvo.id, novoAtendimento: obs.slice(0,4000), apenasSalvar:true, autorManual:"Anotação do CRM", tipoManual:"nota" })
        });
        const d = await res.json().catch(()=>({}));
        if(d?.ok){ alvo.obs = (alvo.obs ? alvo.obs+"\n" : "") + obs; return "mesclado"; }
        return "falha";
      }catch(_){ return "falha"; }
    }

    // 1) CRIAR todos os registros — rápido, sem IA. 1 tentativa extra se a primeira falhar.
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
      const timeline = L.observacao ? [{ id:1, date:dataBR, time:"", iso:L.criado, author:"Anotação do corretor (CRM)", text:L.observacao, type:"nota", source:"crm", order:1 }] : [];
      const result = { rawText: L.observacao || "", timeline, analysis, lead: { clientName:L.nome, phone:L.telefone, product:L.empreendimento }, audiosEncontrados:0, audiosTranscritos:0 };
      const fileName = `${L.nome} [CRM ${L.idShort}]`;
      const res = await fetch("./api/lead-update", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"salvar-novo", result, fileName, source:"crm-import" }) });
      const d = await res.json().catch(()=>({}));
      return d?.persistence?.processing?.id || null;
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
    st.innerHTML = `<span style="color:var(--acao)">Pronto! ${criados} leads novos${mesclados?`, ${mesclados} juntados em leads que já existiam (mesmo telefone)`:""}${jaTinha?`, ${jaTinha} já importados antes`:""}${falhas?`, ${falhas} a refazer (rode de novo)`:""}. Já aparecem em Hoje e no Pipeline.</span>`;

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
            await fetch("./api/reanalisar-lead", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: myId }), signal: ctrl.signal });
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
  const matches = fonte.filter(l => {
    if(foraDaBusca(l)) return false; // arquivado/geladeira não aparece na busca
    return semAcento(l.name).includes(tt) || semAcento(l.product).includes(tt);
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
      <span class="tag" style="font-size:10px">${escapeHtml(probabilidadeRefinadaTxt(l))}</span>
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

let _buscaLeadTimer = null;
function buscaLeadInline(termo, boxId){
  clearTimeout(_buscaLeadTimer);
  _buscaLeadTimer = setTimeout(() => {
    const box = qs("#" + boxId);
    if(!box) return;
    const t = semAcento(termo);
    if(t.length < 2){ box.style.display = "none"; box.innerHTML = ""; return; }
    const fonte = (state.todosLeads && state.todosLeads.length) ? state.todosLeads : (state.leads || []);
    if((!state.todosLeads || !state.todosLeads.length) && typeof loadTodosLeadsBusca === "function") loadTodosLeadsBusca();
    const matches = fonte.filter(l => !foraDaBusca(l) && (semAcento(l.name).includes(t) || semAcento(l.product).includes(t))).slice(0, 12);
    box.style.display = "block";
    if(!matches.length){ box.innerHTML = `<div class="small" style="padding:10px;color:var(--muted);text-align:center">Nenhum lead com "${escapeHtml(t)}"</div>`; return; }
    box.innerHTML = matches.map(l => {
      const idJs = JSON.stringify(String(l.id||""));
      return `<div onclick='abrirLead(${idJs})' style="padding:9px 11px;border-radius:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="min-width:0"><div style="font-weight:950;font-size:13px">${escapeHtml(l.name||"Cliente")}</div><div class="small" style="font-size:11px;color:var(--muted)">${escapeHtml(l.product||"--")} · ${escapeHtml(l.etapa||"Novo")}</div></div>
        <span class="tag" style="font-size:10px;flex-shrink:0">${escapeHtml(probabilidadeRefinadaTxt(l))}</span>
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
    const res = await fetch("./api/reanalisar-lead", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id }) });
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
    state.obsCarregada = m.observacoes || ""; // guarda a OBS original pra saber se mudou ao salvar
    showCard("memoriaCard", true);
    qs("#memoriaStatus").textContent = m.atualizadoEm ? "Atualizada em "+new Date(m.atualizadoEm).toLocaleString("pt-BR") : "";
  }catch(_){ showCard("memoriaCard", false); }
}

// Reanálise automática: roda só quando a OBSERVAÇÃO do lead muda (ou ao registrar atendimento).
// Editar nome/telefone/preferências/etc. salva normal mas NÃO reanalisa. Sem botão; evita reentrância com flag.
let reanalisandoAuto = false;
async function reanalisarLeadAuto(id, { motivo } = {}){
  if(!id || reanalisandoAuto) return false;
  reanalisandoAuto = true;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 90000);
  try{
    toast(motivo ? "Atualizando análise ("+motivo+")…" : "Atualizando análise…");
    const res = await fetch("./api/reanalisar-lead", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id }), signal: ctrl.signal });
    clearTimeout(to);
    const data = await res.json().catch(()=>({ ok:false, error:"Resposta inválida do servidor." }));
    if(data?.ok){
      await loadRecentLeads();
      await carregarDashboard();
      if(state.lead?.id === id) abrirLead(id);
      toast("Análise atualizada.");
      return true;
    }
    toast("Não deu pra atualizar a análise: " + (data?.error||"erro"));
    return false;
  }catch(err){
    clearTimeout(to);
    const ehTimeout = err?.name === "AbortError" || /abort/i.test(String(err?.message||""));
    toast(ehTimeout ? "Demorou demais — conversa muito grande." : "Erro ao atualizar análise: " + (err?.message||err));
    return false;
  }finally{
    reanalisandoAuto = false;
  }
}
window.reanalisarLeadAuto = reanalisarLeadAuto;

async function salvarMemoria(){
  const id = state.lead?.id;
  if(!id){ toast("Sem lead carregado."); return; }
  const body = {
    id,
    action: "memoria-set",
    preferencias: qs("#memoriaPreferencias").value,
    pessoasDecisao: qs("#memoriaPessoasDecisao").value,
    pontosSensiveis: qs("#memoriaPontosSensiveis").value,
    observacoes: qs("#memoriaObservacoes").value
  };
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
      // Só reanalisa se a OBSERVAÇÃO mudou. Outros campos salvam sem reanalisar.
      const obsMudou = (body.observacoes || "") !== (state.obsCarregada || "");
      state.obsCarregada = body.observacoes || "";
      if(obsMudou){
        await reanalisarLeadAuto(id, { motivo: "observação atualizada" });
      } else {
        toast("Memória salva.");
        loadRecentLeads();
      }
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
  const ativo = l => { const e = normalizarEtapa(l.etapa); return e !== "Vendido" && e !== "Perdido" && e !== "Geladeira"; };
  const cont = e => all.filter(l => normalizarEtapa(l.etapa) === e).length;
  const leadsAtivos = all.filter(ativo).length;
  const vendidos = cont("Vendido");
  const total = all.length;
  const conversao = total ? Math.round(vendidos / total * 100) : 0;
  const propostasAbertas = all.filter(l => { const e = normalizarEtapa(l.etapa); return e === "Visita/Proposta" || e === "Negociação"; }).length;

  // ---- Atendimentos por dia (últimos 7 dias) — eventos "contato_manual" reais ----
  const hoje0 = (typeof inicioDoDiaBR === "function") ? inicioDoDiaBR() : new Date(new Date().setHours(0,0,0,0));
  const DOW = ["D","S","T","Q","Q","S","S"];
  const dias = [];
  for(let i = 6; i >= 0; i--){ const d = new Date(hoje0); d.setDate(d.getDate() - i); dias.push({ ini: d, n: 0, lbl: DOW[d.getDay()], hoje: i === 0 }); }
  for(const l of all){
    const evs = l.analysis?.aprendizado?.eventos || [];
    for(const ev of evs){
      if(ev.evento !== "contato_manual" || !ev.quando) continue;
      const q = new Date(ev.quando);
      if(isNaN(q.getTime())) continue;
      for(const dd of dias){ const fim = new Date(dd.ini); fim.setDate(fim.getDate() + 1); if(q >= dd.ini && q < fim){ dd.n++; break; } }
    }
  }
  const atendimentosHoje = dias[6].n;
  const maxN = Math.max(1, ...dias.map(d => d.n));
  const barras = dias.map(d => `<div class="dz-bar${d.hoje?" hoje":""}"><span class="num">${d.n}</span><span class="col" style="height:${Math.round(d.n/maxN*100)}%"></span><span class="d">${d.lbl}</span></div>`).join("");

  // ---- Funil de conversão (acumulado) ----
  const emContato = all.filter(l => { const e = normalizarEtapa(l.etapa); return e === "Atendimento" || e === "Visita/Proposta" || e === "Negociação" || e === "Vendido"; }).length;
  const propostaEnv = all.filter(l => { const e = normalizarEtapa(l.etapa); return e === "Visita/Proposta" || e === "Negociação" || e === "Vendido"; }).length;
  const fechado = vendidos;
  const funilDef = [["Leads recebidos", total],["Em contato", emContato],["Proposta enviada", propostaEnv],["Fechado", fechado]];
  const funilHtml = funilDef.map(([lbl, n]) => {
    const pct = total ? Math.round(n / total * 100) : 0;
    return `<div class="row"><div class="top"><b>${lbl}</b><span>${n} · ${pct}%</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }).join("");

  // ---- Vendas do mês (dado real, mantido do relatório antigo) ----
  const agora = new Date();
  let vMesQtd = 0, vMesValor = 0;
  for(const l of all){
    if(normalizarEtapa(l.etapa) !== "Vendido") continue;
    const dt = l.analysis?.venda?.registradaEm ? new Date(l.analysis.venda.registradaEm) : null;
    if(!dt || isNaN(dt.getTime())) continue;
    if(dt.getMonth() === agora.getMonth() && dt.getFullYear() === agora.getFullYear()){ vMesQtd++; vMesValor += parseValorVenda(l.analysis?.venda?.valor); }
  }
  const nomeMes = agora.toLocaleDateString("pt-BR", { month: "long" });
  const ticket = vMesQtd ? vMesValor / vMesQtd : 0;

  const kpi = (k, v) => `<div class="dz-kpi"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  return `
    <div class="dz-head"><h2>Desempenho</h2><div class="sub">Visão geral · últimos 7 dias</div></div>
    <div class="dz-kpis">
      ${kpi("Leads ativos", leadsAtivos)}
      ${kpi("Atendimentos hoje", atendimentosHoje)}
      ${kpi("Taxa de conversão", conversao + "%")}
      ${kpi("Propostas abertas", propostasAbertas)}
    </div>
    <div class="dz-grid">
      <div class="dz-card"><h4>Atendimentos por dia</h4><div class="dz-bars">${barras}</div></div>
      <div class="dz-card dz-funil"><h4>Funil de conversão</h4>${funilHtml}</div>
    </div>
    <div class="dz-card dz-vendas"><h4 style="text-transform:capitalize">Fechamento de ${nomeMes}</h4>
      <div class="dz-vrow">
        <div><div class="v" style="color:var(--lime)">${vMesQtd}</div><div class="k">${vMesQtd===1?"venda":"vendas"}</div></div>
        <div><div class="v" style="color:var(--acao)">${vMesValor>0?formatBRL(vMesValor):"R$ 0"}</div><div class="k">valor total</div></div>
        <div><div class="v">${ticket>0?formatBRL(ticket):"—"}</div><div class="k">ticket médio</div></div>
      </div>
    </div>
    ${ (all.length ? `<div style="margin-top:14px">${buildDesempenhoInsightsHTML(all)}</div>` : "") }`;
}

// ===== Carteira completa: todos os leads num lugar (panorama + contatar hoje + ranking) =====
// Reusa o mesmo dado (leads-recentes limit=2000) e os mesmos critérios da Hoje (scoreLead,
// entraEmRetomada, etapas). Não cria função nova no servidor — tudo no cliente, em cima do cache.
function carteiraEhFinal(e){ return e === "Vendido" || e === "Perdido" || e === "Geladeira"; }
function carteiraLinhaLead(l, pos){
  const idJs = JSON.stringify(String(l.id||""));
  const prob = probabilidadeRefinada(l) ?? (Number(l.probabilityPercent)||0);
  const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction+"d" : "—";
  const etapa = normalizarEtapa(l.etapa);
  return `<div onclick='abrirLead(${idJs})' style="display:flex;align-items:center;gap:10px;padding:10px 6px;border-bottom:1px solid var(--line);cursor:pointer">
    ${pos!=null?`<div style="width:22px;text-align:center;font-weight:950;color:var(--muted);font-size:12px;flex-shrink:0">${pos}</div>`:""}
    <div style="flex:1;min-width:0">
      <div style="font-weight:950;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(l.name||"Cliente")}</div>
      <div class="small" style="color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(etapa)} · ${escapeHtml(motivoCurto(l))}</div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div class="${classePct(prob)}" style="font-weight:950;font-size:13px">${escapeHtml(probabilidadeRefinadaTxt(l))}</div>
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
const CART_FILTROS = [["todos","Todos"],["quentes","Quentes"],["mornos","Mornos"],["frios","Frios"],["geladeira","Geladeira"]];
const ETAPA_DOT = {"Novo":"var(--soft)","Atendimento":"var(--dados)","Visita/Proposta":"var(--lime)","Negociação":"var(--acao)","Standby":"var(--muted)","Geladeira":"var(--muted)","Vendido":"var(--acao)","Perdido":"var(--risco)"};
const CART_AV_CORES = ["#7DD3FC","#86EFAC","#F0ABFC","#FCA5A5","#FDE047","#A5B4FC","#5EEAD4","#FDBA74"];
function carteiraAvatarCor(s){ let h = 0; const t = String(s||""); for(let i=0;i<t.length;i++) h = (h*31 + t.charCodeAt(i))|0; return CART_AV_CORES[Math.abs(h) % CART_AV_CORES.length]; }
function carteiraPassaFiltro(l, f){
  const e = normalizarEtapa(l.etapa);
  if(f === "geladeira") return e === "Geladeira";
  if(e === "Geladeira") return f === "todos";
  const prob = probabilidadeRefinada(l) ?? (Number(l.probabilityPercent)||0);
  if(f === "quentes") return prob >= 55;
  if(f === "mornos") return prob >= 40 && prob < 55;
  if(f === "frios") return prob < 40;
  return true;
}
const CARTEIRA_PAGE_SIZE = 80;
function setCarteiraFiltro(f){
  state.carteiraFiltro = f;
  state.carteiraVisibleCount = CARTEIRA_PAGE_SIZE;
  renderCarteiraTabela();
}
function carregarMaisCarteira(){
  state.carteiraVisibleCount = Math.max(CARTEIRA_PAGE_SIZE, Number(state.carteiraVisibleCount || CARTEIRA_PAGE_SIZE)) + CARTEIRA_PAGE_SIZE;
  renderCarteiraTabela();
}
window.setCarteiraFiltro = setCarteiraFiltro;
window.carregarMaisCarteira = carregarMaisCarteira;
function renderCarteiraTabela(){
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
    <div class="cart-head">
      <div><h2>Carteira</h2><div class="sub">${lista.length} lead${lista.length!==1?"s":""} · ordenados por prioridade de contato</div></div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <div class="cart-filtros">${chips}</div>
        <button type="button" class="cart-export" onclick="exportarLeadsCSV(this)" title="Baixar Excel (CSV) de TODOS os leads com o histórico inteiro">⬇ Excel</button>
      </div>
    </div>
    <div class="cart-table">
      <div class="cart-thead"><span>Cliente</span><span>Empreendimento</span><span>Prioridade</span><span>Resposta</span><span>Próxima ação</span><span></span></div>
      ${linhas}
      ${carregarMais}
    </div>`;
}
function carteiraRowHTML(l){
  const idJs = JSON.stringify(String(l.id||""));
  const prob = probabilidadeRefinada(l) ?? (Number(l.probabilityPercent)||0);
  const pcl = classePct(prob);
  const prioridade = prioridadeAtendimento(l) || {};
  const pScore = Math.max(0, Math.min(100, Math.round(Number(prioridade.score)||0)));
  const barCor = prioridade.grupo === "acao-hoje" ? "var(--lime)" : prioridade.grupo === "retomar-cuidado" ? "var(--morno)" : prioridade.grupo === "baixa-prioridade" ? "var(--risco)" : "var(--soft)";
  const etapa = normalizarEtapa(l.etapa);
  const dot = ETAPA_DOT[etapa] || "var(--muted)";
  const resp = l.lastInteractionAt ? formatarTempoRelativo(l.lastInteractionAt).replace(/ atrás$/,"") : (l.daysSinceLastInteraction!=null ? l.daysSinceLastInteraction+"d" : "—");
  const acao = l.nextAction ? String(l.nextAction) : motivoCurto(l);
  const pct = Math.max(4, pScore);
  return `<div class="cart-row" onclick='abrirLead(${idJs})'>
    <div class="cart-cli">
      <div style="min-width:0">
        <div class="cart-nm">${escapeHtml(l.name||"Cliente")}</div>
        <div class="cart-etapa"><span class="cart-dot" style="background:${dot}"></span>${escapeHtml(etapa)}</div>
      </div>
    </div>
    <div class="cart-emp">${escapeHtml(l.product||"—")}</div>
    <div class="cart-score"><span class="bar"><i style="width:${pct}%;background:${barCor}"></i></span><b style="color:${barCor}" title="Prioridade de atendimento">${escapeHtml(prioridade.titulo || "Prioridade")}</b></div>
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
      "PRIORIDADE","TEMPERATURA",
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
      const intNorm = String(diag.interesse||"").toLowerCase();
      const temperatura = lc.temperatura || (intNorm === "alto" ? "Quente" : intNorm === "medio" ? "Morno" : "");
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
        esc(prioridade), esc(temperatura),
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
    a.download = `leads-direciona-${new Date().toISOString().slice(0,10)}.csv`;
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
  linhas.push("RELATÓRIO DA CARTEIRA — CORRETOR PRO");
  linhas.push("Gerado em " + new Date().toLocaleString("pt-BR"));
  linhas.push("Total de leads: " + all.length);
  linhas.push("=".repeat(60));
  linhas.push("");
  for(const l of ordem){
    const etapa = normalizarEtapa(l.etapa);
    const prob = probabilidadeRefinadaTxt(l);
    const dias = l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction + " dias parado" : "—";
    linhas.push(`### ${l.name || "Cliente"} — ${etapa}`);
    linhas.push(`Produto: ${l.product || "—"} | Prioridade: ${prioridadeTituloCurto(l)} | Probabilidade: ${prob} | ${dias} | Telefone: ${l.phone || "—"}`);
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
  a.download = `carteira-direciona-${new Date().toISOString().slice(0,10)}.txt`;
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

// Ao copiar a mensagem pra enviar: registra como contato de hoje (lead sai do "atender
// hoje"), guarda nas observações com data/hora + o texto enviado, e entra na timeline.
// Só registra uma vez por dia — copiar de novo não duplica.
async function registrarMensagemEnviada(lead, txt){
  if(!lead?.id) return;
  const msg = String(txt || "").trim();
  if(!msg) return;
  if(ehContatadoHoje(lead)) return; // já marcado hoje — não duplica
  try{
    await fetch("./api/reanalisar-lead", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        id: lead.id,
        novoAtendimento: "Mensagem copiada e enviada: " + msg.slice(0, 500),
        apenasSalvar: true,
        autorManual: "Mensagem enviada (WhatsApp)",
        tipoManual: "mensagem"
      })
    });
  }catch(_){}
  try{ await registrarAprendizado("contato_manual", null, { de: "copiar_msg", tipo: "mensagem enviada" }); }catch(_){}
  // Reflete localmente pra UI já considerar como contatado hoje.
  try{
    lead.analysis = lead.analysis || {};
    lead.analysis.aprendizado = lead.analysis.aprendizado || {};
    lead.analysis.aprendizado.eventos = lead.analysis.aprendizado.eventos || [];
    lead.analysis.aprendizado.eventos.push({ evento: "contato_manual", quando: new Date().toISOString() });
  }catch(_){}
  loadRecentLeads();
}
window.registrarMensagemEnviada = registrarMensagemEnviada;

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
  // Atualiza o lead inteiro na hora (score, "última atualização", etc.) — sem precisar de F5.
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
  if(!confirm("Reabrir esse lead? Ele volta pro pipeline em Atendimento.")) return;
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
// Radar da Geladeira (SEM IA): usa o dado JÁ salvo pra apontar quem vale revisitar.
// Só marca com SINAL FORTE (prob alta ao congelar, etapa avançada, permuta ou safra) — não só tempo.
function valeRevisitarGeladeira(l){
  if(normalizarEtapa(l.etapa) !== "Geladeira") return null;
  const a = l.analysis || {};
  const prob = Number(l.probabilityPercent) || 0;
  const dias = Number(l.daysSinceLastInteraction) || 0;
  const etapaIA = normalizarEtapa(a.etapaSugerida);
  const objTxt = ((Array.isArray(a.objections) ? a.objections.join(" ") : String(a.objections||"")) + " " + String(a.memoria?.observacoes||"") + " " + String(a.summary||"")).toLowerCase();
  const temSafra = /safra|colhe|colheita|plantio|lavoura/.test(objTxt);
  const sinalForte = prob >= 55 || etapaIA === "Negociação" || etapaIA === "Visita/Proposta" || a.permuta || temSafra;
  if(!sinalForte) return null;
  const motivos = [];
  if(prob >= 55) motivos.push(`tinha ${prob}% de chance`);
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
    const items = (data?.items || []).map(limparLead).filter(l => normalizarEtapa(l.etapa) === "Geladeira");
    if(!items.length){
      box.innerHTML = '<div class="empty">Nenhum lead na geladeira no momento.</div>';
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
            <span class="tag" style="background:rgba(0,212,255,.12);color:#bff0ff;border-color:rgba(0,212,255,.32);font-size:10px">❄ GELADEIRA</span>
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
  if(!confirm("Reativar esse lead? Ele volta pro pipeline em Atendimento.")) return;
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
  if(!confirm(`Mandar ${nome || "este lead"} pra Geladeira? Ele sai das listas ativas mas continua guardado pra revisitar depois.`)) return;
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, action: "etapa", etapa: "Geladeira" })
    });
    const data = await res.json().catch(()=>({ok:false}));
    if(data?.ok){
      toast("Lead movido pra Geladeira.");
      voltarDoLead();
      carregarDashboard();
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
    if(sessionStorage.getItem("vchk")) return;
    const elv = document.querySelector(".mob-ver, .sb-ver-top");
    const atual = elv ? (parseInt((String(elv.textContent).match(/#(\d+)/)||[])[1], 10) || 0) : 0;
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
    if(recarregandoSW || !tinhaController) return;
    recarregandoSW = true;
    location.reload();
  });
  addEventListener("load", async ()=>{
    try{
      const reg = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
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
      checarVersaoServidor();
      // Checa de novo por atualização ao voltar pro app (reabrir do segundo plano).
      document.addEventListener("visibilitychange", () => {
        if(document.visibilityState === "visible"){ reg.update().catch(()=>{}); checarVersaoServidor(); }
      });
      setTimeout(checkShared,900);
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

// ===== Instalar app (PWA) =====
// O convite (beforeinstallprompt) pode ter sido capturado cedo pelo script inline do
// index.html (window.__deferredInstallPrompt), já que este arquivo carrega no fim.
let deferredInstallPrompt = window.__deferredInstallPrompt || null;
const ehStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const BANNER_INSTALAR_KEY = "direciona_banner_instalar_fechado";

function mostrarOpcoesInstalar(){
  if(ehStandalone) return; // já está rodando como app
  // Botão no Menu
  const btn = qs("#btnInstalarApp"); if(btn) btn.style.display = "flex";
  // Banner no topo da Hoje — só se o usuário não fechou antes
  if(localStorage.getItem(BANNER_INSTALAR_KEY) !== "1"){
    const banner = qs("#bannerInstalar"); if(banner) banner.style.display = "block";
  }
}
function esconderOpcoesInstalar(){
  const btn = qs("#btnInstalarApp"); if(btn) btn.style.display = "none";
  const banner = qs("#bannerInstalar"); if(banner) banner.style.display = "none";
}
async function dispararInstalacao(){
  const convite = deferredInstallPrompt || window.__deferredInstallPrompt;
  if(convite){
    convite.prompt();
    try{ await convite.userChoice; }catch(_){}
    deferredInstallPrompt = null;
    window.__deferredInstallPrompt = null;
    return;
  }
  // Navegador não ofereceu instalação automática (iPhone, ou já registrado) — mostra o passo a passo.
  const d1 = qs("#instalarDica"); if(d1) d1.style.display = "block";
  const d2 = qs("#bannerInstalarDica"); if(d2) d2.style.display = "block";
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  window.__deferredInstallPrompt = e;
  mostrarOpcoesInstalar();
  const dica = qs("#instalarDica"); if(dica) dica.style.display = "none";
});
// Convite capturado cedo pelo index.html: usa assim que o app.js sobe.
window.addEventListener("direciona-install-ready", () => {
  deferredInstallPrompt = window.__deferredInstallPrompt;
  mostrarOpcoesInstalar();
  const dica = qs("#instalarDica"); if(dica) dica.style.display = "none";
});
if(deferredInstallPrompt){
  mostrarOpcoesInstalar();
  const dicaJa = qs("#instalarDica"); if(dicaJa) dicaJa.style.display = "none";
}
qs("#btnInstalarApp")?.addEventListener("click", dispararInstalacao);
qs("#bannerInstalarBtn")?.addEventListener("click", dispararInstalacao);
qs("#bannerInstalarFechar")?.addEventListener("click", () => {
  localStorage.setItem(BANNER_INSTALAR_KEY, "1");
  const banner = qs("#bannerInstalar"); if(banner) banner.style.display = "none";
});

// Onboarding: dispensar (lembra via localStorage) e abrir de novo pelo Menu.
function fecharOnboarding(){
  localStorage.setItem("direciona_onboarding_visto", "1");
  state.forceOnboarding = false;
  const onb = qs("#bannerOnboarding"); if(onb) onb.style.display = "none";
}
qs("#bannerOnboardingFechar")?.addEventListener("click", fecharOnboarding);
qs("#bannerOnboardingOk")?.addEventListener("click", fecharOnboarding);
function abrirOnboarding(){
  state.forceOnboarding = true;
  state.lead = null; state.focoLeadId = null; state.grupoAtivo = null;
  show("home");
}
window.abrirOnboarding = abrirOnboarding;
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  esconderOpcoesInstalar();
  toast("App instalado! Procure o ícone do Corretor Pro na tela inicial.");
});
// Sempre que NÃO estiver rodando como app instalado, oferece a instalação.
// (Mesmo sem o evento do navegador — no iPhone ou quando já houve registro — o
// caminho manual aparece, então o usuário nunca fica sem opção.)
if(!ehStandalone) mostrarOpcoesInstalar();

// ===== Gerador de proposta =====
// Campos de valor são <input type="number">. O navegador, por padrão, ALTERA o
// número quando a roda do mouse rola em cima do campo focado — passo de 0,01 vira
// 1 centavo a menos. Era isso que "comia" 1 centavo da proposta ao rolar a página.
// Solução: ao rolar a roda, tira o foco do campo numérico (a página rola normal e
// o valor não muda). Vale pra todos os campos numéricos do app.
document.addEventListener("wheel", function(){
  const el = document.activeElement;
  if(el && el.tagName === "INPUT" && el.type === "number") el.blur();
}, { passive: true });
const propAportes = [];
// Imagem opcional da proposta (data URL). Aparece no canto superior direito do papel.
// Se vazia, o espaço some por completo.
let propFoto = "";
function propFotoSelecionada(e){
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    // Reduz a imagem pra não pesar no salvamento (foto de celular vira ~5MB em texto).
    const img = new Image();
    img.onload = () => {
      const max = 800;
      let w = img.width, h = img.height;
      if(w > max || h > max){ const k = Math.min(max/w, max/h); w = Math.round(w*k); h = Math.round(h*k); }
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      propFoto = c.toDataURL("image/jpeg", 0.85);
      atualizarFotoUI(); propRender();
    };
    img.onerror = () => { propFoto = r.result; atualizarFotoUI(); propRender(); };
    img.src = r.result;
  };
  r.readAsDataURL(f);
}
function propFotoRemover(){ propFoto = ""; const inp = qs("#pf-foto-input"); if(inp) inp.value = ""; atualizarFotoUI(); propRender(); }
function atualizarFotoUI(){
  const prev = qs("#pf-foto-preview"), thumb = qs("#pf-foto-thumb");
  if(propFoto){ if(thumb) thumb.src = propFoto; if(prev) prev.style.display = "flex"; }
  else { if(prev) prev.style.display = "none"; if(thumb) thumb.removeAttribute("src"); }
}
window.propFotoSelecionada = propFotoSelecionada;
window.propFotoRemover = propFotoRemover;
function propMoney(v){ return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0); }
function propNum(id){ const el=qs("#"+id); return el ? (parseFloat(el.value)||0) : 0; }
function propTxt(id){ const el=qs("#"+id); return el ? (el.value||"").trim() : ""; }
function propAddAporte(){ propAportes.push({valor:0,data:""}); propDrawAportes(); propRender(); }
function propRemoveAporte(i){ propAportes.splice(i,1); propDrawAportes(); propRender(); }
function propUpdateAporte(i,campo,val){ if(!propAportes[i]) return; propAportes[i][campo] = campo==="valor" ? (parseFloat(val)||0) : val; propRender(); }
function propDrawAportes(){
  const box = qs("#pf-aportes-list"); if(!box) return;
  box.innerHTML = "";
  propAportes.forEach((a,i)=>{
    const div = document.createElement("div");
    div.className = "prop-aporte";
    div.innerHTML = `<div class="prop-prefix"><span class="pfx">R$</span><input class="prop-input" type="number" step="0.01" value="${a.valor||""}" placeholder="Valor" oninput="propUpdateAporte(${i},'valor',this.value)"></div>
      <input class="prop-input" type="text" value="${escapeHtml(a.data||"")}" placeholder="Quando (ex: 12/2026)" oninput="propUpdateAporte(${i},'data',this.value)">
      <button type="button" class="prop-del" onclick="propRemoveAporte(${i})" title="Remover">×</button>`;
    box.appendChild(div);
  });
}
function propRender(){
  if(!qs("#pf-cliente")) return;
  const cliente = propTxt("pf-cliente") || "Nome do cliente";
  const empreend = propTxt("pf-empreendimento") || "--";
  const apto = propTxt("pf-apto") || "--";
  const box = propTxt("pf-box") || "--";
  const valorApto = propNum("pf-valor-apto");
  const valorBox = propNum("pf-valor-box");
  const entrada = propNum("pf-entrada");
  const permuta = propNum("pf-permuta");
  const permutaDesc = propTxt("pf-permuta-desc");
  const chaves = propNum("pf-chaves");
  const pMensais = propNum("pf-parc-mensais"), vMensal = propNum("pf-valor-mensal");
  const pSemestrais = propNum("pf-parc-semestrais"), vSemestral = propNum("pf-valor-semestral");
  const pAnuais = propNum("pf-parc-anuais"), vAnual = propNum("pf-valor-anual");
  const correcao = qs("#pf-correcao") ? qs("#pf-correcao").value : "";
  const dataEmissao = propTxt("pf-data");
  const validade = propTxt("pf-validade");
  const obs = propTxt("pf-obs");

  const totalVenda = valorApto + valorBox;
  const totalMensal = pMensais * vMensal;
  const totalSemestral = pSemestrais * vSemestral;
  const totalAnual = pAnuais * vAnual;
  const totalFinanciado = totalMensal + totalSemestral + totalAnual;
  const totalAportes = propAportes.reduce((s,a)=>s+(a.valor||0),0);
  const totalComposto = entrada + permuta + chaves + totalFinanciado + totalAportes;
  const saldo = totalVenda - totalComposto;

  qs("#pp-cliente").textContent = cliente;
  qs("#pp-empreendimento").textContent = empreend;
  qs("#pp-apto").textContent = apto;
  qs("#pp-box").textContent = box;
  if(dataEmissao){ const d = new Date(dataEmissao+"T00:00:00"); qs("#pp-data").textContent = "Data: " + (isNaN(d.getTime()) ? "--/--/----" : d.toLocaleDateString("pt-BR")); }
  else qs("#pp-data").textContent = "Data: --/--/----";
  qs("#pp-validade").textContent = validade ? ("Validade: " + validade) : "";

  const ppFoto = qs("#pp-foto");
  if(ppFoto){ if(propFoto){ ppFoto.src = propFoto; ppFoto.style.display = "block"; } else { ppFoto.removeAttribute("src"); ppFoto.style.display = "none"; } }

  qs("#pp-valor-apto").textContent = propMoney(valorApto);
  qs("#pp-valor-box").textContent = propMoney(valorBox);
  qs("#pp-total-venda").textContent = propMoney(totalVenda);
  qs("#pp-saldo").textContent = propMoney(saldo);
  qs("#pp-saldo-card").style.display = Math.abs(saldo) < 0.01 ? "none" : "block";

  const tbody = qs("#pp-neg-body"); tbody.innerHTML = "";
  const addRow = (tit,desc,val,descHtml=false)=>{
    if(val <= 0 && !desc) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><div class="pp-itit">${escapeHtml(tit)}</div><div class="pp-idesc">${descHtml ? desc : escapeHtml(desc)}</div></td><td class="pp-ival">${propMoney(val)}</td>`;
    tbody.appendChild(tr);
  };
  if(entrada > 0) addRow("Entrada / Ato","Pagamento inicial para fechamento do negócio.",entrada);
  if(permuta > 0 || permutaDesc) addRow("Permuta",permutaDesc || "Bem recebido como parte do pagamento.",permuta);
  propAportes.forEach((a,i)=>{ if(a.valor>0 || a.data) addRow(`Aporte / Reforço ${i+1}`, a.data ? `Pagamento programado para ${a.data}.` : "Pagamento programado.", a.valor); });
  if(chaves > 0) addRow("Chaves","Pagamento na entrega da unidade.",chaves);
  const sufixo = correcao==="INCC" ? " corrigidas pelo INCC." : correcao==="0.95" ? " com correção de 0,95% a.m." : correcao==="IGPM" ? " corrigidas por IGP-M + 1% a.m." : ".";
  // O valor da parcela sai destacado em preto (resto da linha continua cinza).
  const descParc = (n,unidade,val)=>`${n} parcelas ${unidade} de <span class="pp-money">${propMoney(val)}</span>${escapeHtml(sufixo)}`;
  if(pMensais > 0) addRow("Parcelamento mensal", descParc(pMensais,"mensais",vMensal), totalMensal, true);
  if(pSemestrais > 0) addRow("Parcelamento semestral", descParc(pSemestrais,"semestrais",vSemestral), totalSemestral, true);
  if(pAnuais > 0) addRow("Parcelamento anual", descParc(pAnuais,"anuais",vAnual), totalAnual, true);
  if(!tbody.innerHTML) tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#9aa3b0;padding:20px;font-size:12px">Nenhuma condição de pagamento definida.</td></tr>';

  qs("#pp-composto").textContent = propMoney(totalComposto);
  qs("#pp-total").textContent = propMoney(totalVenda);

  const obsBox = qs("#pp-obs-box");
  if(obs){ obsBox.style.display = "block"; qs("#pp-obs").textContent = obs; }
  else obsBox.style.display = "none";
}
function propClear(){
  if(!confirm("Limpar todos os campos da proposta?")) return;
  const msgS = qs("#pf-salvo-msg"); if(msgS) msgS.style.display = "none";
  qsa("#propostas input, #propostas textarea").forEach(el=>{ el.value = ""; });
  if(qs("#pf-correcao")) qs("#pf-correcao").value = "";
  if(qs("#pf-validade")) qs("#pf-validade").value = "7 dias"; // validade padrão
  propAportes.length = 0;
  propDrawAportes();
  propFoto = "";
  atualizarFotoUI();
  if(qs("#pf-data")) qs("#pf-data").valueAsDate = new Date();
  propRender();
}
// Snapshot de TODOS os campos da proposta (pra salvar no lead e reabrir/editar depois).
const PROP_CAMPOS = ["pf-cliente","pf-empreendimento","pf-apto","pf-box","pf-valor-apto","pf-valor-box","pf-entrada","pf-permuta","pf-permuta-desc","pf-chaves","pf-parc-mensais","pf-valor-mensal","pf-parc-semestrais","pf-valor-semestral","pf-parc-anuais","pf-valor-anual","pf-correcao","pf-data","pf-validade","pf-obs"];
function coletarPropostaData(){
  const d = {};
  PROP_CAMPOS.forEach(id => { const el = qs("#"+id); if(el) d[id] = el.value || ""; });
  d.aportes = propAportes.map(a => ({ valor: a.valor||0, data: a.data||"" }));
  d.foto = propFoto || "";
  return d;
}
function aplicarPropostaData(d){
  if(!d || typeof d !== "object") return;
  PROP_CAMPOS.forEach(id => { const el = qs("#"+id); if(el) el.value = (d[id] != null ? d[id] : ""); });
  propAportes.length = 0;
  (Array.isArray(d.aportes) ? d.aportes : []).forEach(a => propAportes.push({ valor: parseFloat(a.valor)||0, data: a.data||"" }));
  propDrawAportes();
  propFoto = d.foto || "";
  atualizarFotoUI();
  propRender();
}
// Reabre uma proposta salva (da timeline) já preenchida, vinculada ao lead, pronta pra editar.
function abrirPropostaSalva(leadId, nome, dados){
  state.propLeadId = leadId || null;
  state.propLeadNome = nome || "";
  show("propostas");
  setTimeout(()=>{
    aplicarPropostaData(dados);
    const btn = qs("#pf-registrar");
    if(btn){ btn.style.display = state.propLeadId ? "" : "none"; btn.disabled = false; btn.textContent = "📌 Registrar no lead"; }
    const msgS = qs("#pf-salvo-msg"); if(msgS) msgS.style.display = "none";
    atualizarVoltarProposta();
    if(typeof toast === "function") toast("Proposta carregada. Edite o que precisar e salve de novo.");
  }, 80);
}
window.abrirPropostaSalva = abrirPropostaSalva;
// Nome do arquivo da proposta = "Cliente - Empreendimento - Apto" (usa o que estiver preenchido).
function nomeArquivoProposta(){
  const lim = s => String(s||"").trim().replace(/[\\/:*?"<>|\n\r\t]+/g," ").replace(/\s+/g," ").trim();
  const cliente = lim(qs("#pf-cliente")?.value) || "Proposta";
  const emp = lim(qs("#pf-empreendimento")?.value);
  const unidade = lim(qs("#pf-apto")?.value);
  return [cliente, emp, unidade].filter(Boolean).join(" - ");
}
// Salva o PDF colorido e já com o nome certo (o navegador usa o título da aba como nome do arquivo).
function imprimirProposta(){
  const tituloAntigo = document.title;
  document.title = nomeArquivoProposta();
  const restaura = () => { document.title = tituloAntigo; window.removeEventListener("afterprint", restaura); };
  window.addEventListener("afterprint", restaura);
  setTimeout(restaura, 5000); // segurança, caso o evento afterprint não dispare
  window.print();
}
window.imprimirProposta = imprimirProposta;
// Voltar da tela de proposta: se foi aberta a partir de um lead, volta pra ele; senão, pra Hoje.
function voltarDaProposta(){
  if(state.propLeadId){ abrirLead(state.propLeadId); return; }
  show("home");
}
window.voltarDaProposta = voltarDaProposta;
function atualizarVoltarProposta(){
  const txt = state.propLeadId
    ? "‹ Voltar pro lead" + (state.propLeadNome ? " (" + state.propLeadNome + ")" : "")
    : "‹ Voltar pra Hoje";
  ["propVoltarTopo","propVoltarRodape"].forEach(id => { const b = qs("#"+id); if(b) b.textContent = txt; });
}
window.atualizarVoltarProposta = atualizarVoltarProposta;
// Abre a proposta já com nome e empreendimento do lead atual.
function abrirPropostaComLead(nome, empreendimento, leadId){
  state.propLeadId = leadId || null;
  state.propLeadNome = nome || "";
  show("propostas");
  setTimeout(()=>{
    if(nome && qs("#pf-cliente")) qs("#pf-cliente").value = nome;
    if(empreendimento && qs("#pf-empreendimento")) qs("#pf-empreendimento").value = empreendimento;
    const btn = qs("#pf-registrar");
    if(btn) btn.style.display = state.propLeadId ? "" : "none";
    atualizarVoltarProposta();
    propRender();
  }, 60);
}

// Item 7: registra a proposta gerada na timeline + observações do lead (quando veio de um lead).
async function registrarPropostaNoLead(){
  if(!state.propLeadId){ toast("Abra a proposta a partir de um lead pra registrar nele."); return; }
  const v = (id) => (qs("#"+id)?.value || "").trim();
  const emp = v("pf-empreendimento"), apto = v("pf-apto");
  const total = qs("#pp-total")?.textContent || "";
  const entradaNum = propNum("pf-entrada"), parc = v("pf-parc-mensais"), mensalNum = propNum("pf-valor-mensal");
  const partes = [`Proposta gerada${emp?` — ${emp}`:""}${apto?` apto ${apto}`:""}`];
  if(total) partes.push(`total ${total}`);
  if(entradaNum > 0) partes.push(`entrada ${propMoney(entradaNum)}`);
  if(parc && mensalNum > 0) partes.push(`${parc}x de ${propMoney(mensalNum)}`);
  const texto = partes.join(", ") + ".";
  const btn = qs("#pf-registrar");
  const msgSalvoPrev = qs("#pf-salvo-msg"); if(msgSalvoPrev) msgSalvoPrev.style.display = "none";
  if(btn){ btn.disabled = true; btn.textContent = "Registrando..."; }
  try{
    const res = await fetch("./api/reanalisar-lead", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id: state.propLeadId, novoAtendimento: texto, apenasSalvar:true, autorManual:"Proposta gerada", tipoManual:"proposta", proposta: coletarPropostaData() })
    });
    const d = await res.json().catch(()=>({}));
    if(!d?.ok) throw new Error(d?.error||"falha");
    invalidarLeadsCache();
    toast("Proposta registrada no lead.");
    // Aviso CLARO de salvo (fica fixo até registrar de novo) — evita registrar duplicado sem perceber.
    const msgSalvo = qs("#pf-salvo-msg");
    if(msgSalvo){ msgSalvo.style.display = "block"; msgSalvo.textContent = `✓ Proposta salva no histórico${state.propLeadNome ? " de " + state.propLeadNome : " do lead"} (${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}).`; }
    // Destrava o botão: cada registro vira uma proposta SEPARADA no histórico do lead.
    if(btn){ btn.textContent = "✓ Registrada"; setTimeout(()=>{ if(btn){ btn.disabled = false; btn.textContent = "📌 Registrar outra"; } }, 2500); }
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "📌 Registrar no lead"; }
    toast("Não consegui registrar: " + (err?.message||err));
  }
}
window.registrarPropostaNoLead = registrarPropostaNoLead;
// Exclui uma proposta (item da timeline) — pra tirar duplicadas/erradas.
async function excluirPropostaTimeline(leadId, iso){
  if(!iso){ toast("Não consigo identificar essa proposta."); return; }
  if(!confirm("Excluir esta proposta do histórico do lead?")) return;
  try{
    const res = await fetch("./api/reanalisar-lead", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id: leadId, action:"remover-item", iso })
    });
    const d = await res.json().catch(()=>({}));
    if(!d?.ok) throw new Error(d?.error||"falha");
    invalidarLeadsCache();
    toast("Proposta excluída.");
    abrirLead(leadId);
  }catch(err){ toast("Não consegui excluir: " + (err?.message||err)); }
}
window.excluirPropostaTimeline = excluirPropostaTimeline;
window.propAddAporte = propAddAporte; window.propRemoveAporte = propRemoveAporte; window.propUpdateAporte = propUpdateAporte;
window.propRender = propRender; window.propClear = propClear; window.abrirPropostaComLead = abrirPropostaComLead;
if(qs("#pf-data")) qs("#pf-data").valueAsDate = new Date();
propRender();

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

renderResumoDia = function(items){
  const box = qs("#resumoDia");
  if(!box) return;
  if(!items?.length){ box.style.display="none"; box.innerHTML=""; return; }
  const prioridade = items.filter(l => !ehContatadoHoje(l) && !lembreteFuturo(l) && (classificarGrupoHome(l)==="acao-hoje" || classificarGrupoHome(l)==="retomar-cuidado" || Number(l.daysSinceLastInteraction)>=3)).length;
  const muitoQuentes = items.filter(l => {
    const p = probabilidadeRefinada(l) ?? (Number(l.probabilityPercent)||0);
    const tipo = String(l.analysis?.tipoRetomada||"").toLowerCase();
    const temp = String(l.analysis?.leituraComercial?.temperatura||"").toLowerCase();
    const interesse = String(l.analysis?.diagnostico?.interesse||"").toLowerCase();
    const etapa = normalizarEtapa(l.etapa);
    return p >= 55 || tipo === "quente-fechar" || temp === "quente" || interesse === "alto" || etapa === "Negociação";
  }).length;
  const retornos = items.filter(l => !ehContatadoHoje(l) && !lembreteFuturo(l) && Number(l.daysSinceLastInteraction||0)>=14).length;
  const visitas = items.filter(l => {
    const aps=l.analysis?.confirmedAppointments;
    return (Array.isArray(aps)&&aps.length) || !!l.analysis?.lembrete?.quando;
  }).length;
  box.style.display="grid";
  box.innerHTML = `
    <div class="ui-kpi" onclick="show('carteira')"><span>Ativos</span><div><b>${items.length}</b><i>${ui631Icon('ativos')}</i></div></div>
    <div class="ui-kpi active" onclick="show('pipeline');setPipelineVisualFiltro('quentes')"><span>Quentes</span><div><b>${muitoQuentes}</b><i>${ui631Icon('quente')}</i></div></div>
    <div class="ui-kpi" onclick="show('agenda')"><span>Agenda</span><div><b>${visitas}</b><i>${ui631Icon('compromisso')}</i></div></div>
    <div class="ui-kpi" onclick="show('pipeline');setPipelineVisualFiltro('reaquecer')"><span>Reaquecer</span><div><b>${retornos}</b><i>${ui631Icon('reaquecer')}</i></div></div>`;
};

function ui631LeadMotivo(l){
  const a = l.analysis || {};
  const d = Number(l.daysSinceLastInteraction||0);
  const diag = a.diagnostico || {};
  const pend = String(diag.pendenciaFinanceira || diag.pendencia || a.pendencia || "").trim();
  const etapa = String(diag.etapa || l.etapa || "").toLowerCase();
  const hist = [a.resumo, a.summary, a.ultimoCompromisso, diag.ultimoCompromisso, diag.ultimaInfoPrometida, diag.objecaoRelevante].map(x=>String(x||"")).join(" ").toLowerCase();
  if(hist.includes("proposta")) return ["Proposta enviada" + (d?` há ${d} dia${d===1?'':'s'}`:""), d?"Não respondeu desde então":"Acompanhar retorno"];
  if(hist.includes("simula")) return ["Pediu simulação", "Não recebeu retorno"];
  if(hist.includes("visita") || hist.includes("conhecer")) return ["Prometeu visitar", "Acompanhar interesse"];
  if(pend) return ["Pendência financeira", pend.slice(0,58)];
  if(etapa.includes("negoci")) return ["Em negociação", "Próximo passo precisa ser conduzido"];
  if(d>=7) return [`Último contato há ${d} dias`, "Bom momento para retomar"];
  if(d>=3) return [`Parado há ${d} dias`, "Retomar antes de esfriar"];
  return ["Próxima ação pendente", "Abrir diagnóstico antes de responder"];
}
function ui631LeadStatus(l){
  const p = probabilidadeRefinada(l) ?? (Number(l.probabilityPercent)||0);
  const interesse = String(l.analysis?.diagnostico?.interesse||"").toLowerCase();
  const etapa = normalizarEtapa(l.etapa);
  const d = Number(l.daysSinceLastInteraction||0);
  if(p>=55 || interesse==="alto") return ["Muito quente", "hot"];
  if(etapa==="Negociação" || etapa==="Visita/Proposta") return ["Em negociação", "warm"];
  if(d>=7) return [`Parado há ${d} dias`, "cold"];
  return ["Prioridade", "neutral"];
}

function ui631LeadRow(l, actionLabel, pos){
  const id=JSON.stringify(String(l.id||""));
  const dias=l.daysSinceLastInteraction!=null?`${l.daysSinceLastInteraction}d`:(l.lastInteractionAt?formatarTempoRelativo(l.lastInteractionAt).replace(/ atrás$/,""):'');
  const etapaLabel=normalizarEtapa(l.etapa);
  const sub=produtosLabel(l)||etapaLabel||"";
  const label=actionLabel||(etapaLabel==="Negociação"?"Negociação":etapaLabel==="Visita/Proposta"?"Visita":"Retomar");
  const subLine=[sub,dias].filter(Boolean).join(' · ');
  const [motivo]=ui631LeadMotivo(l);
  return `<button type="button" class="ui-priority-row" onclick='abrirLead(${id})'>
    <span class="ui-row-copy"><strong>${escapeHtml(l.name||"Cliente")}</strong><small>${escapeHtml(subLine)}</small>${motivo?`<em class="ui-row-motivo">${escapeHtml(motivo)}</em>`:''}</span>
    <span class="ui-row-action">${escapeHtml(label)}</span><span class="ui-row-chevron">›</span>
  </button>`;
}

renderListasHome = function(ordenados){
  const foco=qs("#leadFocoArea"); if(!foco) return;
  const area=qs("#top3Area"); if(area){area.style.display="none";area.innerHTML="";}
  const fila=qs("#filaPrioridade"); if(fila){fila.style.display="none";fila.innerHTML="";}
  const grupos={"acao-hoje":[],"retomar-cuidado":[],"boa-sem-urgencia":[],"pode-aguardar":[],"baixa-prioridade":[],"tratado-hoje":[]};
  for(const l of (ordenados||[])){ const g=classificarGrupoHome(l); (grupos[g]||grupos["baixa-prioridade"]).push(l); }
  Object.values(grupos).forEach(a=>a.sort(compararPrioridadeAtendimento));
  grupos.todos=(ordenados||[]).slice().sort(compararPrioridadeAtendimento);
  grupos.retomada=grupos.todos.filter(l=>!ehContatadoHoje(l)&&Number(l.daysSinceLastInteraction)>=3).slice(0,20);
  state.gruposHome=grupos;
  if(state.grupoAtivo || state.focoLeadId || state.lead?.id) return;
  const prioritarios=[...grupos["acao-hoje"],...grupos["retomar-cuidado"],...grupos["boa-sem-urgencia"]].filter((x,i,a)=>a.findIndex(y=>String(y.id)===String(x.id))===i).slice(0,4);
  const esfriando=(ordenados||[]).filter(l=>Number(l.daysSinceLastInteraction||0)>=14 && !ehContatadoHoje(l)).length;
  const propostas=(ordenados||[]).filter(l=>{
    const e=normalizarEtapa(l.etapa);
    const temProposta = e==="Visita/Proposta" || e==="Negociação" || (Array.isArray(l.recentMessages) && l.recentMessages.some(m=>m&&m.proposta));
    return temProposta && !ehContatadoHoje(l);
  }).length;
  const visitas=(ordenados||[]).filter(l=>{const aps=l.analysis?.confirmedAppointments;return (Array.isArray(aps)&&aps.length)||!!l.analysis?.lembrete?.quando;}).length;
  const oportunidades=prioritarios.length;
  foco.innerHTML=`
    <div class="ui-home-content">
      <section class="ui-insight-card">
        <div class="ui-insight-title"><i>✦</i><strong>O sistema percebeu</strong></div>
        <p>${esfriando} leads esfriando, ${propostas} proposta${propostas===1?'':'s'} sem retorno e ${visitas} visita${visitas===1?'':'s'} para confirmar. ${oportunidades?`${oportunidades} prioridade${oportunidades===1?'':'s'} para avançar hoje.`:'Base sem urgência agora.'}</p>
        <button type="button" onclick="show('pipeline')">Ver análise</button>
      </section>
      <section class="ui-priority-card">
        <div class="ui-section-head"><div><h3>Leads prioritários para hoje</h3><p>Toque num lead para ver o diagnóstico e a mensagem pronta pra enviar no WhatsApp.</p></div><button type="button" onclick="show('pipeline')">Ver todos</button></div>
        <div class="ui-priority-list">${prioritarios.length?prioritarios.map((l,i)=>ui631LeadRow(l, l.analysis?.confirmedAppointments?.length?'Ver visita':'O que falar', i)).join(''):'<div class="empty">Nenhum lead prioritário agora.</div>'}</div>
      </section>
    </div>`;
};

window.setPipelineVisualFiltro = function(f){ state.pipelineVisualFiltro=f||"todos"; carregarPipeline(); };
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
    const all=(data?.items||[]).map(limparLead).filter(l=>{const e=normalizarEtapa(l.etapa);return !["Vendido","Perdido","Geladeira"].includes(e)});
    const hot=l=>{
      const p=probabilidadeRefinada(l)??(Number(l.probabilityPercent)||0);
      if(p>=40) return true;
      if((Number(l.probabilityPercent)||0)>=60) return true;
      const tipo=String(l.analysis?.tipoRetomada||"").toLowerCase();
      const temp=String(l.analysis?.leituraComercial?.temperatura||"").toLowerCase();
      const interesse=String(l.analysis?.diagnostico?.interesse||"").toLowerCase();
      if(tipo==="quente-fechar"||temp==="quente"||interesse==="alto") return true;
      const e=normalizarEtapa(l.etapa);
      return e==="Negociação"||e==="Visita/Proposta";
    };
    const compromisso=l=>{const a=l.analysis?.confirmedAppointments;return (Array.isArray(a)&&a.length)||!!l.analysis?.lembrete?.quando};
    const reaquecer=l=>(Number(l.daysSinceLastInteraction)||0)>=14&&!ehContatadoHoje(l)&&!lembreteFuturo(l);
    const filtros={todos:all,quentes:all.filter(hot),esfriando:all.filter(l=>(Number(l.daysSinceLastInteraction)||0)>=7&&hot(l)),compromisso:all.filter(compromisso),reaquecer:all.filter(reaquecer)};
    const filtro=state.pipelineVisualFiltro||"todos";
    const lista=(filtros[filtro]||all).slice().sort(compararPrioridadeAtendimento);
    const etapas=["Novo","Atendimento","Visita/Proposta","Negociação","Standby"];
    const cnt=Object.fromEntries(etapas.map(e=>[e,0]));
    all.forEach(l=>{const e=normalizarEtapa(l.etapa);if(cnt[e]!==undefined)cnt[e]++;});
    const tabs=[["todos","Todos"],["quentes","Quentes"],["esfriando","Esfriando"],["compromisso","Agenda"],["reaquecer","Reaquecer"]];
    const acaoRow=l=>compromisso(l)?'Agenda':hot(l)?'Quente':'Retomar';
    board.innerHTML=`
      <div class="ui-pipeline-kpis">
        <div class="ui-kpi"><span>Ativos</span><div><b>${all.length}</b><i>${ui631Icon('ativos')}</i></div></div>
        <div class="ui-kpi active"><span>Quentes</span><div><b>${filtros.quentes.length}</b><i>${ui631Icon('quente')}</i></div></div>
        <div class="ui-kpi"><span>Agenda</span><div><b>${filtros.compromisso.length}</b><i>${ui631Icon('compromisso')}</i></div></div>
        <div class="ui-kpi"><span>Reaquecer</span><div><b>${filtros.reaquecer.length}</b><i>${ui631Icon('reaquecer')}</i></div></div>
      </div>
      <div class="ui-filter-tabs">${tabs.map(([k,t])=>`<button type="button" class="${k===filtro?'active':''}" onclick="setPipelineVisualFiltro('${k}')">${t}</button>`).join('')}</div>
      <div class="ui-pipeline-grid">
        <section class="ui-funnel-card"><h3>Funil por etapa</h3>${etapas.map(e=>{const n=cnt[e]||0,p=all.length?Math.round(n/all.length*100):0;return `<div class="ui-funnel-row"><div><span>${e}</span><b>${n}</b><em>${p}%</em></div><i><u style="width:${Math.max(3,p)}%"></u></i></div>`}).join('')}</section>
        <aside class="ui-pipe-summary"><div><span>Base filtrada</span><b>${lista.length}</b><small>lead${lista.length===1?'':'s'}</small></div><button type="button" onclick="reanalisarTudo()">↻ Reanalisar todos</button><button type="button" onclick="show('carteira')">Ver carteira completa</button></aside>
      </div>
      <section class="ui-priority-card ui-pipeline-list"><div class="ui-section-head"><div><h3>Leads prioritários</h3><p>Ordenados por prioridade de atendimento.</p></div></div><div class="ui-priority-list">${lista.length?lista.slice(0,12).map(l=>ui631LeadRow(l,acaoRow(l))).join(''):'<div class="empty">Nenhum lead nesse filtro.</div>'}</div></section>`;
  };

  if(emMemoria){
    renderPipeline({ items: emMemoria });
  } else {
    board.innerHTML='<div class="small ui-loading">Carregando...</div>';
    getLeadsData().then(renderPipeline).catch(()=>{ board.innerHTML=boxErro("carregarPipeline()"); });
  }
};

const __renderLeadFoco631Base = renderLeadFoco;
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
renderLeadFoco = function(lead){
  __renderLeadFoco631Base(lead);
  const wrap=qs("#leadFocoArea .lead-foco"); const legacy=wrap?.querySelector(".lead590"); if(!wrap||!legacy)return;
  const a=lead.analysis||{},diag=(a.diagnostico&&typeof a.diagnostico==="object")?a.diagnostico:{};
  const msgs=mensagensDaAnalise(a);
  const map={direta:mensagemAprovadaSemAlteracao(msgs.a)||"",consultiva:mensagemAprovadaSemAlteracao(msgs.b)||mensagemAprovadaSemAlteracao(msgs.a)||"",retomada:mensagemAprovadaSemAlteracao(msgs.c)||mensagemAprovadaSemAlteracao(msgs.a)||""};
  state._ui631Responses=map; state._ui631ResponseKey=msgs.recomendada==="c"?"retomada":msgs.recomendada==="b"?"consultiva":"direta"; state._ui631LeadPhone=lead.phone||"";
  const chosen=map[state._ui631ResponseKey]||Object.values(map).find(Boolean)||"Toque em Reanalisar para gerar uma resposta.";
  const prioridade=prioridadeAtendimento(lead)||{};
  const interesse=String(diag.interesse||a.leituraComercial?.temperatura||"—");
  const etapa=String(diag.etapa||normalizarEtapa(lead.etapa)||"—").replace(/-/g," ");
  const pendencia=String(diag.pendenciaFinanceira||diag.pendencia||a.leituraComercial?.oQueTrava||"Não identificada");
  const proximo=String(a.nextAction||a.leituraComercial?.oQueDestravar||"Reanalisar para definir o próximo passo.");
  const recentes=(Array.isArray(lead.recentMessages)?lead.recentMessages:[]).slice(-3).reverse();
  const timeline=recentes.length?recentes.map((m,i)=>`<div class="ui-timeline-item"><i class="${i===0?'active':''}"></i><span><b>${escapeHtml(m.author|| (ehMsgDoCliente(m,String(lead.name||'').split(/\s+/)[0])?lead.name:'Você'))}:</b> ${escapeHtml(String(m.text||'').slice(0,180))}</span><em>${escapeHtml([m.date,m.time].filter(Boolean).join(' ')||'')}</em></div>`).join(''):'<div class="empty">Sem mensagens recentes.</div>';
  const shell=document.createElement("div"); shell.className="lead-ui631";
  const hasPhone=!!(lead.phone);
  const voltarLabel = state.grupoAtivo ? "Voltar pra "+escapeHtml((GRUPOS_HOME[state.grupoAtivo]||{}).titulo||"lista") : "Voltar pra Hoje";
  shell.innerHTML=`
    <div class="ui-lead-head">
      <h2 class="ui-lead-name">${escapeHtml(lead.name||"Cliente")}</h2>
      <div class="ui-lead-sub">
        <p>${escapeHtml(produtosLabel(lead)||"Produto não identificado")}</p>
        ${!state.sequencia ? `<button type="button" class="ui-lead-back" onclick="voltarDoLead()">‹ ${voltarLabel}</button>` : ''}
      </div>
    </div>
    <div class="ui-lead-main">
      <section class="ui-diagnostic-card"><h3>Diagnóstico</h3>
        <div><b>Última pessoa a falar:</b><span>${escapeHtml(ui631UltimoFalante(lead))}</span></div>
        <div><b>Etapa:</b><span>${escapeHtml(etapa)}</span></div>
        <div><b>Interesse:</b><span class="accent">${escapeHtml(interesse)}</span></div>
        <div><b>Pendência:</b><span>${escapeHtml(pendencia)}</span></div>
        <div><b>Próximo passo:</b><span>${escapeHtml(proximo)}</span></div>
      </section>
      <section class="ui-response-card"><h3>Resposta pronta pra enviar</h3><div class="ui-response-tabs"><button class="ui-response-tab ${state._ui631ResponseKey==='direta'?'active':''}" data-response="direta" onclick="ui631SelectResponse('direta')">Direta</button><button class="ui-response-tab ${state._ui631ResponseKey==='consultiva'?'active':''}" data-response="consultiva" onclick="ui631SelectResponse('consultiva')">Consultiva</button><button class="ui-response-tab ${state._ui631ResponseKey==='retomada'?'active':''}" data-response="retomada" onclick="ui631SelectResponse('retomada')">Retomada</button></div><div id="ui631ResponseText" class="ui-response-text">${escapeHtml(chosen)}</div><div class="ui-response-actions"><button type="button" class="ui-copy-main" onclick="ui631CopyResponse()">Copiar mensagem</button>${hasPhone?`<button type="button" class="ui-whats-main" onclick="ui631OpenWhats()">Abrir WhatsApp</button>`:''}</div></section>
    </div>
    <section class="ui-timeline-card"><h3>Linha do tempo da conversa</h3>${timeline}</section>`;
  wrap.insertBefore(shell,legacy);
  // Extrai "Registrar atendimento" do legacy para ficar acessível no novo UI (não enterrado em 2 níveis de collapse)
  const atendDetalhes = Array.from(legacy.querySelectorAll('details.bloco-recolhe')).find(
    d => (d.querySelector('summary')?.textContent||'').trim() === 'Registrar atendimento'
  );
  if(atendDetalhes) shell.appendChild(atendDetalhes);
  const advanced=document.createElement("details"); advanced.className="ui631-advanced"; advanced.innerHTML='<summary>Mais detalhes e ferramentas</summary>';
  wrap.insertBefore(advanced,legacy); advanced.appendChild(legacy);
};
window.renderLeadFoco=renderLeadFoco;

configurarEscolhaTema();
// Saudação correta desde o primeiro frame (antes dos dados carregarem)
(function(){ const h=new Date().getHours(); const el=document.getElementById("homePageTitle"); if(el) el.textContent=(h<12?"Bom dia":h<18?"Boa tarde":"Boa noite")+", corretor!"; })();
async function iniciarDireciona(){
  renderLeads();
  checkShared();
  try{
    const data = await getLeadsData(false);
    if(data?.ok && Array.isArray(data.items)){
      state.todosLeads = data.items;
      state.leads = data.items.slice(0,8);
      renderLeads();
    }
  }catch(err){ console.warn("iniciarDireciona", err); }
  if(state.active === "home"){
    carregarDashboard();
    carregarAgendaTopo();
  }
}
requestAnimationFrame(iniciarDireciona);

// Auto-refresh leve do dashboard a cada 3 min se o usuário está na home e a aba está visível
setInterval(() => {
  if(state.active === "home" && document.visibilityState === "visible"){
    loadRecentLeads(false);
    carregarDashboard();
    carregarAgendaTopo();
  }
}, 3 * 60 * 1000);
// Refresh quando a aba volta a ficar visível (depois de mudar pra outra aba)
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && state.active === "home"){
    loadRecentLeads(false);
    carregarDashboard();
    carregarAgendaTopo();
  }
});
