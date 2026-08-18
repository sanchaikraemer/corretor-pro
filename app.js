import { state } from './js/state.js?v=__VERSION__';
import { COMMERCIAL_SCHEMA_VERSION, COMMERCIAL_SCHEMA_MINOR } from './js/commercial-schema.js?v=__VERSION__';
import { qs, qsa, isDesktop, escapeHtml, safeJson, toast } from './js/dom.js?v=__VERSION__';
window.toast = toast; // precisa estar em window: atributos inline (onclick/onchange) rodam fora do escopo do módulo
import { corrigirSaudacaoAbertura, saudacaoAgora } from './js/saudacao.js?v=__VERSION__';
import { garantirDonoDosDadosLocais, aoSairDaConta } from './js/dados-locais.js?v=__VERSION__';
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
      const nome = String(cpNomeCorretorCerebro() || window.__cpContaNome || "").trim();
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
    // v1165 — sair da conta apaga também o que ficou GUARDADO NESTE APARELHO: o Cérebro em cópia
    // local, a importação pendente, o ZIP compartilhado que ainda não foi processado e o retrato
    // do lembrete diário (que guarda nome de cliente). Antes disso, tudo continuava aqui e podia
    // aparecer pra próxima pessoa que entrasse neste celular. Nunca pode impedir a saída: se algo
    // falhar, o redirecionamento acontece do mesmo jeito.
    try { await aoSairDaConta(); } catch(_) {}
    window.location.href = "/entrar.html";
  };
  (async function cpCarregarContaLogada(){
    try {
      const cliente = cpClienteSupabase();
      if (!cliente) return;
      const { data } = await cliente.auth.getSession();
      if (!data?.session) return;
      // v1165 — rede de segurança: se este aparelho estava carimbado com OUTRA conta (uma sessão
      // que trocou sem passar por entrar.html/cadastro.html), o que era da conta anterior é
      // apagado aqui, antes de o app usar qualquer cópia local. O caminho normal já limpa na
      // própria tela de entrada; isto cobre o resto.
      try { await garantirDonoDosDadosLocais(data.session.user?.id); } catch(_) {}
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
      // v1150 — guarda QUEM está logado. Usado pra marcar "já vi o tutorial" por CONTA, não por
      // aparelho: no mesmo celular, uma conta nova precisa ver o passo a passo mesmo que outra
      // conta já tenha visto (é exatamente o caso do teste com corretores).
      try{ window.__cpContaId = String(data.session.user.id || ""); }catch(_){}
      window.cpAtualizarIdentidadeVisivel();
      // v1183 — o "Seu nome" do Cérebro só chegava neste aparelho quando a TELA do Cérebro era
      // aberta (é lá que carregarCerebro grava a cópia local). Quem entrava e ia direto pra Home
      // continuava sendo cumprimentado pelo nome da empresa, com o nome salvo lá no servidor o
      // tempo todo. Aqui a configuração é buscada uma vez, logo depois do login, e guardada no
      // mesmo lugar que o resto do app já lê — sem tela nenhuma precisar ser aberta. É o melhor
      // esforço: falhou (sem rede, servidor fora), a Home segue com o que já tinha.
      try{
        const resp = await fetch("./api/cerebro-config", { cache:"no-store" });
        const cfgSrv = await resp.json();
        if(cfgSrv?.ok && cfgSrv.config){
          localStorage.setItem(CEREBRO_LS_KEY, JSON.stringify(sanitizeCerebroConfigV762(cfgSrv.config)));
          window.cpAtualizarIdentidadeVisivel();
          if(typeof renderSaudacao === "function" && Array.isArray(state?.itemsAtivos)) renderSaudacao(state.itemsAtivos);
        }
      }catch(_){}
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

export const KEEP_RE = /\.(txt|opus|ogg|mp3|m4a|wav|aac)$/i;

// ===== v929 — atividade de uso (Desempenho): análises, importações e tempo no app =====
// Fica só no localStorage DESTE aparelho (não sincroniza celular↔PC) — é contagem de USO, não
// dado comercial do cliente, então não precisa da sincronização via Supabase do resto do app.
const CP_ATIVIDADE_DIAS = 90; // guarda até 90 dias, poda o resto a cada gravação
export function cpRegistrarAtividade(chave, quandoIso){
  try{
    const key = "cpAtividade_"+chave;
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(quandoIso || new Date().toISOString());
    const cutoff = Date.now() - CP_ATIVIDADE_DIAS*24*60*60*1000;
    const podado = arr.filter(iso => { const t = Date.parse(iso); return Number.isFinite(t) && t >= cutoff; });
    localStorage.setItem(key, JSON.stringify(podado));
  }catch(_){}
}
function cpContarAtividade(chave, desdeMs, ateMs){
  try{
    const arr = JSON.parse(localStorage.getItem("cpAtividade_"+chave) || "[]");
    if(!desdeMs && !ateMs) return arr.length;
    // v1106 — ateMs (exclusivo) fecha uma janela: é o que permite "mês passado" no Desempenho.
    return arr.filter(iso => {
      const t = Date.parse(iso);
      return Number.isFinite(t) && (!desdeMs || t >= desdeMs) && (!ateMs || t < ateMs);
    }).length;
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
// v1100 — o dono viu "vencido há 43 dia(s)" na tela e perguntou o que estava errado. O "(s)" é
// atalho de programador pra não decidir entre singular e plural — na tela de um corretor é lixo.
// Este ajudante decide. Usar SEMPRE que um número acompanha uma palavra.
export function pl(n, um, muitos){ return Number(n) === 1 ? um : muitos; }

export async function fetchComTimeout(url, opts = {}, timeoutMs = 15000){
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
export async function getLeadsData(force){
  const agora = Date.now();
  if(!force && _leadsCache.data && (agora - _leadsCache.ts) < LEADS_CACHE_TTL){ state.performance.cacheHits = Number(state.performance.cacheHits||0)+1; return _leadsCache.data; }
  state.performance.cacheMisses = Number(state.performance.cacheMisses||0)+1;
  const _perfStart = cpPerfNow();
  if(_leadsCache.inflight) return _leadsCache.inflight; // junta chamadas simultâneas numa só
  const usarFresh = force || _leadsForceFresh;
  _leadsForceFresh = false;
  _leadsCache.inflight = (async () => {
    try{
      // v1140 — dois consertos do "dando pau no carregamento dos leads" (prints do dono em
      // 05/08/2026): (1) o tempo de espera era o padrão de 15s, MENOR que o teto novo de 60s da
      // própria rota (vercel.json) — o app desistia com o servidor ainda trabalhando; agora espera
      // até 65s. (2) uma única queda de rede/timeout derrubava a carteira inteira na hora — agora
      // respira 1,5s e tenta mais uma vez antes de desistir (mesma rede das gravações v1019/v1034).
      // v1146 — a segunda tentativa passou a ser CONDICIONAL. A v1140 acertou em esperar 65s (a
      // rota tem 60s de teto no servidor, então desistir aos 15s era desistir com o servidor ainda
      // trabalhando), mas errou em repetir SEMPRE: quando a primeira tentativa queimava os 65s
      // inteiros, a segunda dobrava a espera e o corretor ficava mais de DOIS MINUTOS olhando
      // "Carregando os leads…" (print do dono, 05/08/2026, 19:04→19:06 — "travou de novo").
      //
      // Repetir só conserta tropeço de rede, que falha RÁPIDO (conexão caindo ao voltar de outro
      // app). Se a primeira já esperou muito, o problema não é tropeço: é melhor devolver o
      // controle pra tela avisar e oferecer "tentar de novo" do que continuar preso em silêncio.
      const urlLeads = `./api/leads-recentes?limit=2000${usarFresh ? "&fresh=1" : ""}`;
      const inicioBusca = Date.now();
      let res = null;
      try{
        res = await fetchComTimeout(urlLeads, { cache:"no-store" }, 65000);
      }catch(_e1){
        const gastou = Date.now() - inicioBusca;
        if(gastou > 20000) throw _e1; // já esperou demais: quem chamou decide o que mostrar
        await new Promise(r => setTimeout(r, 1500));
        res = await fetchComTimeout(urlLeads, { cache:"no-store" }, 65000);
      }
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
// v1241 — AUDITORIA DO DONO: um pedido de detalhe JÁ EM VOO ressuscitava a observação recém-apagada.
// invalidarLeadDetail() apagava a entrada do cache, mas o pedido que tinha saído ANTES continuava
// correndo com dado velho na mão e, ao terminar, gravava esse dado velho de volta — a observação
// apagada voltava e ficava lá pelo tempo de vida do cache. Cada lead tem agora uma GERAÇÃO: quem
// invalida avança o número, e a resposta em voo só é aceita se a geração não mudou no meio.
const _leadDetailGeracao = new Map();
const _geracaoLeadDetail = (key) => Number(_leadDetailGeracao.get(key) || 0);
// v1211 — exportada: a tela da importação passou a abrir o cadastro parecido ali mesmo (com as
// últimas mensagens dele) pra o corretor decidir "é o mesmo cliente?" vendo o cliente.
export async function getLeadDetail(id, force){
  const key = String(id || "");
  if(!key) throw new Error("Lead inválido.");
  const cached = _leadDetailCache.get(key);
  if(!force && cached?.data && (Date.now() - cached.ts) < LEAD_DETAIL_CACHE_TTL) return cached.data;
  if(cached?.inflight) return cached.inflight;
  const _perfStart = cpPerfNow();
  const geracaoNoInicio = _geracaoLeadDetail(key);
  const inflight = (async () => {
    const res = await fetchComTimeout(`./api/lead-update?action=detalhe&id=${encodeURIComponent(key)}`, { cache:"no-store" });
    const data = await res.json().catch(()=>({ok:false}));
    if(!res.ok || !data?.ok || !data?.item) throw new Error(data?.error || "Não foi possível carregar o histórico completo.");
    const item = limparLead(data.item);
    cpPerfMark("leadDetail", _perfStart, { mensagens: totalMensagensLead(item) });
    // Se alguém invalidou este lead enquanto a resposta vinha (apagou uma observação, por
    // exemplo), este dado já nasceu velho: devolve pra quem pediu, mas NÃO grava no cache.
    if (_geracaoLeadDetail(key) !== geracaoNoInicio) {
      _leadDetailCache.delete(key);
      return item;
    }
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
export function invalidarLeadDetail(id){
  if(id == null){
    _leadDetailCache.clear();
    // avança a geração de TODOS os que estavam em voo, senão eles regravam depois do clear
    for(const k of _leadDetailGeracao.keys()) _leadDetailGeracao.set(k, _geracaoLeadDetail(k) + 1);
    return;
  }
  const key = String(id);
  _leadDetailCache.delete(key);
  _leadDetailGeracao.set(key, _geracaoLeadDetail(key) + 1);
}
// v1135 — carimba que a carteira em memória acabou de ser preenchida com o que o servidor
// devolveu. Chamado SÓ onde state.todosLeads recebe resultado de getLeadsData — nunca onde ele
// recebe uma cópia da própria memória, senão o carimbo mentiria.
//
// Se alguém esquecer de chamar isto num lugar novo, o pior que acontece é a tela revalidar à toa
// (fica um pouco mais lenta). O contrário — carimbar sem ter buscado — mostraria dado velho como
// se fosse novo, que é o defeito que esta peça existe pra impedir. A direção da falha importa.
function cpCarteiraSincronizada(){
  state.carteiraRevisao = Number(state.dataRevision) || 0;
}
function cpCarteiraEstaEmDia(){
  return Array.isArray(state.todosLeads) && state.todosLeads.length > 0
    && Number(state.carteiraRevisao) === (Number(state.dataRevision) || 0);
}

// ===== v1166 — "mudou alguma coisa?" antes de baixar a carteira inteira =====
//
// O painel do Supabase acusou a cota de tráfego estourada (7,11 GB de 5 GB). A v1121 (atualização
// de 30s pra 2min) e a v1136 (conversa fora da lista) cortaram o grosso; o que sobrou é que, a cada
// 2 minutos com a tela aberta, o app baixa até 2000 leads COM a análise de cada um — e na esmagadora
// maioria dos tiques NADA mudou. Agora a atualização DE FUNDO pergunta primeiro, em poucos bytes,
// quantos leads existem e qual foi a última alteração. Iguais aos da carga anterior = não faz nada.
//
// Vale SÓ pra atualização automática de fundo. Toda ação do corretor (importar, salvar, mudar etapa,
// puxar pra atualizar) continua forçando a busca completa na hora — a assinatura nunca entra no
// caminho de quem está esperando ver o resultado do que acabou de fazer.
let _assinaturaCarteira = null;
async function cpCarteiraMudouDesdeAUltimaCarga(){
  try{
    const res = await fetchComTimeout("./api/leads-recentes?assinatura=1", { cache:"no-store" }, 12000);
    if(!res.ok) return true;                       // sem resposta boa: age como antes (busca tudo)
    const a = await res.json().catch(() => null);
    if(!a || a.ok === false || a.indefinida) return true;  // servidor não soube dizer: busca tudo
    const atual = `${a.total}|${a.ultimaAlteracao}`;
    const anterior = _assinaturaCarteira;
    _assinaturaCarteira = atual;
    if(anterior === null) return true;             // primeira vez: não há com o que comparar
    return anterior !== atual;
  }catch(_){
    return true;                                   // qualquer tropeço: busca tudo, como sempre fez
  }
}
// Depois de uma mutação a assinatura guardada não vale mais: a próxima verificação precisa
// obrigatoriamente baixar de novo, senão o app compararia com um retrato já vencido.
function cpEsquecerAssinaturaCarteira(){ _assinaturaCarteira = null; }

export function invalidarLeadsCache(){
  cpEsquecerAssinaturaCarteira();
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
// servidor na mesma varredura). Nasceu só pra barra do "Fazer agora" (cpBarraMensagensMini).
// v1139 — o RANKING do "Fazer agora" (cpProbabilidadeFechamento) passou a usar esta régua TAMBÉM
// (decisão do dono: barrinha e ordem contando a mesma história). Quem esfriou não some da fila —
// volta pelas vagas de resgate diário (cpAplicarResgatesNaFila). Elegibilidade e radar de lead
// antigo continuam com mensagensDoCliente (histórico inteiro), de propósito: reconhecer um lead
// antigo que esfriou precisa do total (ver comentário da v942 acima).
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
  // v1125 — state.itemsAtivos ficava de fora, e é JUSTAMENTE a lista que a Home usa como cache
  // (carregarDashboard só vai na rede quando ela está vazia). Sem limpar aqui, o lead recém
  // apagado continuava aparecendo nas listas e nos contadores da Home até um F5.
  if(Array.isArray(state.itemsAtivos)) state.itemsAtivos = state.itemsAtivos.filter(l => String(l.id) !== sid);
  if(typeof loadTodosLeadsBusca === "function") loadTodosLeadsBusca();
}
window.invalidarLeadsCache = invalidarLeadsCache;
window.removerLeadDosCaches = removerLeadDosCaches;

// v1125 — ARQUIVAR NÃO É APAGAR, e essa diferença passou a importar quando a Home ganhou o card
// "Arquivados" (v1124). Arquivar usava removerLeadDosCaches, que tira o lead de TODAS as listas —
// inclusive de state.todosLeads, a carteira inteira, que é de onde sai o número do card. Relato do
// dono: "arquivei, foi pra home certinho, porém não aumentou o número de arquivados, tive que
// atualizar a página."
//
// Aqui o lead NÃO some da carteira: ele muda de etapa, exatamente como o servidor vai devolver no
// próximo carregamento. As listas de ativos são re-derivadas da carteira (uma fonte só de verdade,
// em vez de mexer em cada lista na mão e deixar uma discordar da outra). Serve pros dois sentidos:
// arquivar e reativar.
function cpMarcarEtapaLocal(id, etapa){
  const sid = String(id || "");
  if(!sid || !etapa) return;
  invalidarLeadsCache();
  const trocar = l => (String(l.id) === sid ? { ...l, etapa } : l);
  if(Array.isArray(state.todosLeads)) state.todosLeads = state.todosLeads.map(trocar);
  if(Array.isArray(state.leads)) state.leads = state.leads.map(trocar);
  if(Array.isArray(state.itemsAtivos)){
    const base = Array.isArray(state.todosLeads) ? state.todosLeads : state.itemsAtivos.map(trocar);
    state.itemsAtivos = base.filter(l => normalizarEtapa(l.etapa) !== ETAPA_ARQUIVADO);
  }
  if(typeof loadTodosLeadsBusca === "function") loadTodosLeadsBusca();
}
window.cpMarcarEtapaLocal = cpMarcarEtapaLocal;

// v1133 — relato do dono, com print da Agenda: "deletei e não saiu daí". Ele excluiu o lembrete
// vencido de um atrasado e o cartão continuou na lista, no mesmo lugar.
//
// A exclusão FUNCIONAVA — o servidor apagava o lembrete. O que não acontecia era a tela mudar:
// carregarAgenda() começa com `if(state.todosLeads?.length){ renderAgenda(...); return; }`, ou seja,
// redesenha a partir da carteira que já está na memória e NEM CHEGA a buscar o dado novo.
// invalidarLeadsCache() limpa o cache de rede, mas não mexe em state.todosLeads — então a Agenda
// se redesenhava idêntica, com o lembrete que acabara de ser apagado. Só saindo e voltando (ou
// dando F5) a lista ficava certa.
//
// É o MESMO tipo de erro que a v1125 corrigiu no arquivar (a Home também renderiza de uma lista em
// memória), e a solução é a mesma daquela vez: atualizar a carteira em memória para o estado que o
// servidor acabou de gravar, em vez de esperar que alguém vá buscar. Uma fonte só de verdade.
//
// lembrete = null apaga; um objeto {quando, motivo} remarca. Serve pros dois sentidos.
function cpAtualizarLembreteLocal(id, lembrete){
  const sid = String(id || "");
  if(!sid) return;
  invalidarLeadsCache();
  const trocar = l => {
    if(String(l.id) !== sid) return l;
    const analysis = { ...(l.analysis || {}) };
    if(lembrete) analysis.lembrete = lembrete;
    else delete analysis.lembrete;
    return { ...l, analysis };
  };
  if(Array.isArray(state.todosLeads)) state.todosLeads = state.todosLeads.map(trocar);
  if(Array.isArray(state.leads)) state.leads = state.leads.map(trocar);
  if(Array.isArray(state.itemsAtivos)) state.itemsAtivos = state.itemsAtivos.map(trocar);
}
window.cpAtualizarLembreteLocal = cpAtualizarLembreteLocal;

// Confirmação em-app (no lugar do confirm() nativo do navegador — a "tela feia" com a URL
// "corretor-pro-zeta.vercel.app diz"). Retorna Promise<boolean>. Enter confirma, Esc/clique
// fora cancela. Usado no arquivar/perder pra ficar dentro da identidade do app.
export function cp903Confirm(opts){
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

// v1186 — A BIBLIOTECA DE ZIP SÓ É BAIXADA QUANDO O CORRETOR VAI MEXER COM ZIP.
//
// Esta função já existia e já fazia o certo: baixar o jszip na hora em que ele é preciso. Só que
// ela nunca chegava a baixar nada — o `index.html` carregava o arquivo com um <script> fixo em
// TODA abertura do app, então `window.JSZip` já estava lá e esta função saía na primeira linha.
//
// Eram 96 KB baixados em toda abertura, por todo corretor, só pra ficar parado: o jszip serve
// pra (a) enxugar o ZIP do WhatsApp antes de mandar pro servidor e (b) montar a planilha de
// exportação do aprendizado. Quem abre o app pra ver a fila do dia — o uso normal — não toca em
// nenhuma das duas. Achado da auditoria de 09/08/2026.
//
// Agora a tag saiu do index.html e do pacote offline, e quem precisa chama esta função. O
// carregamento é guardado numa promessa só: dois pedidos ao mesmo tempo não baixam duas vezes.
let _jsZipCarregando = null;
export async function ensureJSZip(){
  if(window.JSZip) return window.JSZip;
  if(!_jsZipCarregando){
    _jsZipCarregando = new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src="/vendor/jszip.min.js?v=__VERSION__";
      s.onload=resolve;
      s.onerror=()=>{ _jsZipCarregando=null; reject(new Error("Não foi possível baixar a biblioteca pra ler o arquivo. Verifique sua internet e tente de novo.")); };
      document.head.appendChild(s);
    });
  }
  await _jsZipCarregando;
  return window.JSZip;
}

// v1195 — slimZipKeepingTextAndAudio foi junto pro pedaço da importação (js/importacao.js).

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
        else if(t === "planos") await carregarPlanos();
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
  state.lead=null; state.focoLeadId=null; state.analysis=null;
}
// v1077 — as listas "montadas na hora" pelos cards da Home (Fazer agora, Aguardando cliente,
// Carteira ativa, Propostas) não vivem em state.gruposHome — quem VOLTA pra
// elas (botão voltar do Android/navegador) precisa reconstruí-las pela função dona. Sem isso,
// o voltar mostrava o nome cru ("__fazeragora") com 0 leads (print do dono).
function cpReabrirGrupoEspecial(grupo){
  const donos = {
    "__fazeragora": () => abrirFazerAgora(),
    "__aguardando": () => abrirAguardandoCliente(),
    "__carteiraAtiva": () => abrirCarteiraAtiva(),
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

export function show(t, options={}){
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
    const escondidas = ["menu","cerebro","agenda","zip","linhaTempo","arquivados","aprendizado","propostas","relatorio","carteira","planos"];
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
export function clearAnalysis(){
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
  // v1220 — a caixa de decisão do topo ("é o mesmo cliente?") só existe enquanto há uma pergunta
  // pendente: numa análise nova ela precisa sumir, senão a pergunta da importação anterior fica
  // de pé em cima da tela, apontando pra um cadastro que não tem mais nada a ver.
  const cpPerguntaTopo = qs("#perguntaTopo");
  if(cpPerguntaTopo){ cpPerguntaTopo.innerHTML=""; cpPerguntaTopo.hidden=true; }
  qs("#analysisBox").className="empty";
  qs("#analysisBox").innerHTML="Aguardando análise.";
  qs("#timeline").innerHTML='<div class="event"><b>Aguardando a conversa</b><p>A conversa organizada aparecerá aqui.</p></div>';
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
export function limparLead(l){
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

export async function loadRecentLeads(force = false){
  try{
    if(force) invalidarLeadDetail();
    const data = await getLeadsData(!!force);
    if(data?.ok && Array.isArray(data.items)){
      state.todosLeads = data.items.map(limparLead);
      state.leads = state.todosLeads.slice(0, 8);
      cpCarteiraSincronizada(); // v1135 — veio do servidor: a memória está em dia
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
      cpCarteiraSincronizada(); // v1135 — veio do servidor: a memória está em dia
    }
  }catch(_){ /* silencioso */ }
}

export function showCard(id, has){
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
    h += `<div class="diag-perg" style="border-color:rgba(86,199,242,.24);background:rgba(86,199,242,.05)"><div class="diag-perg-lab">🧭 Raio-X comercial</div>`;
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


export function renderAnalysis(analysis, lead){
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
      const html = '<div style="margin-top:12px;padding:10px;background:rgba(155,140,255,.06);border:1px solid rgba(155,140,255,.18);border-radius:12px"><div class="small" style="color:var(--cerebro);text-transform:uppercase;letter-spacing:.1em;font-size:10px;font-weight:950;margin-bottom:6px">Leads parecidos</div>' +
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
  // v1108 — limite do teste grátis atingido: o aviso vira convite de contratação com botão
  // direto pro WhatsApp comercial (o número vem do servidor, em analysis.upgrade).
  if(analysis.mode === "limite_diario_excedido"){
    box.className = "notice";
    box.innerHTML = `<b>${escapeHtml(analysis.summary || analysis.error || "Limite diário de análises atingido.")}</b>` + cpUpgradeProHTML(analysis);
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
    const texto = typeof v === "object"
      ? String(v.msg || v.mensagem || v.texto || "").trim()
      : String(v).trim();
    // v1218 — a saudação é corrigida NA HORA DE MOSTRAR, não na hora de gerar. Duas razões: a
    // análise pode ter sido feita de manhã e ser copiada à noite (a sugestão abriria com "Bom
    // dia" às 21h), e as análises JÁ SALVAS passam a sair certas sem precisar reanalisar nada.
    // Só a saudação de abertura muda — nenhuma palavra comercial é reescrita pelo código.
    return corrigirSaudacaoAbertura(texto);
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
      // v1107 — m.date primeiro (dia civil como veio do WhatsApp); o slice do iso é dia UTC,
      // que empurrava mensagem de 21h+ pro "dia seguinte" e inflava a contagem (mesmo fallback
      // que as contagens irmãs já usam).
      const dia = m ? (m.date || (m.iso ? String(m.iso).slice(0,10) : "")) : "";
      if(dia) set.add(dia);
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

// v1268 — scoreLead (apelido de scorePrioridadeAtendimento) removido na faxina: ninguém
// chamava, e um apelido sem uso só cria dúvida sobre qual das duas é a de verdade.
// v826 §6.6 — PRECEDÊNCIA DETERMINÍSTICA DA FILA (função pura, sem estado).
// Recebe só FATOS (booleanos) e devolve o nível (2..7), o grupo e o título. Não há
// pesos nem notas subjetivas: a posição é decidida pela ordem dos fatos. Isolada
// assim para poder ser testada diretamente (tests/v826-fila-fatos.test.mjs).
// Níveis: 2 compromisso vencido · 3 retorno para hoje · 4 negociação real aguardando você ·
// 5 atendimento programado · 6 retomada por tempo sem contato · 7 aguardando resposta do cliente.
//
// v1190 — O NÍVEL 1 NÃO EXISTE MAIS, e não pode voltar a existir com nenhum nome.
// Era "cliente respondeu e ainda não recebeu sua resposta" (clienteAguardandoVoce): disparava só
// porque a última fala IMPORTADA era do cliente, entrava com prioridade MÁXIMA e ainda furava as
// duas proteções logo abaixo — atendimento recente e lembrete futuro. O app não é integrado ao
// WhatsApp: ele lê o retrato que o corretor exporta, e o corretor SEMPRE responde o cliente na
// hora, no WhatsApp. "A última fala é do cliente" aqui dentro só significa "essa conversa ainda
// não foi reimportada" — nunca "cliente sem resposta". A v1158 tirou esse mesmo raciocínio da
// ordem da fila e a v1189 tirou a categoria da Home, mas ele sobreviveu AQUI, no motor que
// desenha os cards (cardLeadHTML/motivoCurto/classificarGrupoHome) e o title da linha da Home.
// O número 1 fica vago de propósito: os níveis são simbólicos e renumerar mexeria no score de
// todo mundo sem necessidade nenhuma.
function filaPorFatos(f = {}){
  if(f.atendidoRecente && !f.lembreteAtrasado && !f.retornoParaHoje && !f.negociacaoAguardando)
    return { nivel:0, grupo:"tratado-hoje", titulo: f.contatadoHoje ? "Tratado hoje" : "Atendido recentemente" };
  if(f.lembreteFuturo && !f.retornoParaHoje && !f.negociacaoAguardando)
    return { nivel:0, grupo:"pode-aguardar", titulo:"Tem lembrete futuro" };
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
  // v1190 — aqui morava "clienteAguardandoVoce" (o cliente falou por último → prioridade máxima,
  // furando atendimento recente e lembrete futuro). Removido de vez: ver o comentário grande em
  // filaPorFatos. A v1019 tinha tentado consertar o sinal (exigindo que a fala pedisse resposta);
  // o problema nunca foi a afinação do detector, e sim a premissa — o app não tem como saber se
  // o corretor já respondeu no WhatsApp depois da exportação.
  const fmtDias = n => n === 0 ? "hoje" : n === 1 ? "há 1 dia" : `há ${n} dias`;

  const { nivel, grupo, titulo } = filaPorFatos({
    atendidoRecente: protegidoPosAtendimento(l),
    contatadoHoje: !!ehContatadoHoje(l),
    lembreteFuturo: lembreteFuturo(l),
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
  // v1190 — o motivo do nível 1 ("cliente respondeu e ainda não recebeu sua resposta") saiu junto
  // com o nível. Era o texto que aparecia no card em Hoje/Todos/Pipeline afirmando uma pendência
  // que o app não tem como provar.
  if(nivel === 2) motivo = `compromisso combinado está vencido${diasLembrete != null ? ` (${fmtDias(Math.abs(diasLembrete))})` : ""}`;
  else if(nivel === 3) motivo = "retorno combinado para hoje";
  else if(nivel === 4) motivo = ctxIA.contatoParceiro ? "contraproposta aguardando retorno do cliente final" : "proposta/condição em aberto aguardando você";
  else if(nivel === 5) motivo = "há atendimento ou visita programado";
  else if(nivel === 6) motivo = `sem contato ${fmtDias(diasContato)} — hora de retomar`;
  else if(nivel === 7) motivo = "você chamou por último — aguardando a resposta do cliente";
  else if(grupo === "tratado-hoje") motivo = ehContatadoHoje(l) ? "você já atendeu este lead hoje" : "você atendeu este lead nos últimos dias";
  else if(titulo === "Tem lembrete futuro") motivo = diasLembrete != null ? `retorno agendado para daqui a ${diasLembrete} ${diasLembrete === 1 ? "dia" : "dias"}` : "tem lembrete futuro — não antecipar";
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



// Dias desde a última mensagem da timeline. somenteCliente=true conta só mensagens da
// PRÓPRIA cliente (ignora corretor/empresa e anotação manual). Calcula client-side a partir
// do recentMessages que o lead já carrega — funciona mesmo com lead em cache.
function _diasDesdeMsg(l, somenteCliente){
  const msgs = Array.isArray(l.recentMessages) ? l.recentMessages : [];
  if(!msgs.length) return null;
  const nome = String(l.name||"").trim().toLowerCase().split(/\s+/)[0] || "";
  // v1183 — este nome vinha de state.cerebroCfg, que nunca é preenchido: a comparação com o nome
  // do corretor NUNCA rodou aqui, só sobrava o filtro de palavras genéricas abaixo. Agora vale o
  // "Seu nome" do Cérebro de verdade, no mesmo formato do resto do app (primeiro nome, e só o
  // sentido seguro da comparação — autor CONTÉM o nome; o inverso transformava qualquer autor de
  // nome curto em "corretor").
  const corretorNome = cpNomeCorretorCerebro().toLowerCase().split(/\s+/)[0] || "";
  const business = /(construtora|corretor|imobili|direciona|atendimento|sistema)/i;
  let maxTs = 0;
  for(const m of msgs){
    if(somenteCliente){
      const autor = String(m.author||"").trim();
      if(!autor) continue;
      const autorLower = autor.toLowerCase();
      const ehCorretor = (corretorNome && autorLower.includes(corretorNome)) || business.test(autor);
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


function ehEsfriando(l){
  if(!isNaN(lembreteTs(l))) return false;
  const dias = Number(l.daysSinceLastInteraction) || 0;
  const tipo = String(l?.analysis?.tipoRetomada || "").toLowerCase();
  const interesse = String(l?.analysis?.diagnostico?.interesse || "").toLowerCase();
  return dias >= 3 && dias <= 7 && (tipo === "quente-fechar" || interesse === "alto" || interesse === "quente");
}

// Badges agora são só ÍCONES (pedido do dono): 💸 sumiço após preço, ❄️ esfriando, 🏠 permuta.
// O título (tooltip) explica o que cada um significa ao passar o mouse.
function tagEsfriandoHTML(){
  return `<span title="Parando — sem resposta há alguns dias" style="font-size:14px;line-height:1;vertical-align:1px;cursor:help">⏳</span>`;
}
function tagPermutaHTML(){
  return `<span title="Envolve permuta/troca de imóvel" style="font-size:14px;line-height:1;vertical-align:1px;cursor:help">🏠</span>`;
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
  // v1248 — faltavam conectivos no meio da lista, e o resultado era LIXO NA TELA: "Casa em
  // condomínio" perdia "Casa" e "condomínio" (as duas palavras genéricas, certo) e sobrava só a
  // palavra "em" — que ia parar no lugar do nome do empreendimento, na tela Hoje. Com o "em" (e os
  // outros conectivos) também saindo, não sobra nada e o texto é tratado como 100% genérico, que é
  // o que ele é: quem chama (produtosLabelCurto) então mostra o texto original inteiro, que é
  // informação de verdade.
  t = t.replace(/\b(no|na|nos|nas|de|do|da|dos|das|para|em|com|sem|por|pra|e|ou|a|o|as|os|um|uma|uns|umas|ao|aos|entre|at[ée])\b/gi, " ");
  t = t.replace(/[,;]+/g, " ").replace(/\s{2,}/g, " ").trim();
  // Sobra de uma ou duas letras (resto de sigla partida, conectivo com acento que escapou) não é
  // nome de empreendimento nenhum — é sujeira. Sem nada com pelo menos 3 letras/números, o texto
  // conta como genérico.
  if(!t.split(/\s+/).some(p => p.length >= 3)) return "";
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
// v1183 — "semana" e "mês" passaram a ser SEMANA E MÊS DE CALENDÁRIO (pedido do dono, olhando a
// Home: "quero o mês vigente e não últimos 7 ou 30"). Antes eram janelas corridas de 7 e 30 dias,
// então no dia 8 de agosto o quadradinho dizia "183 no mês" contando desde 9 de julho — e a tela
// Desempenho, que sempre usou mês de calendário, mostrava outro número com a mesma palavra. Agora
// as duas telas falam a mesma língua. A semana começa na SEGUNDA (é a semana de trabalho: a fila
// do app também "volta segunda").
function cpInicioSemanaMs(){
  // inicioDoDiaBR() devolve a meia-noite de HOJE em Brasília como 03:00 UTC do mesmo dia do
  // calendário — então getUTCDay() já é o dia da semana certo, sem depender do fuso do aparelho.
  const hoje = inicioDoDiaBR();
  const desdeSegunda = (hoje.getUTCDay() + 6) % 7; // 0=segunda … 6=domingo (domingo fecha a semana)
  return hoje.getTime() - desdeSegunda*24*60*60*1000;
}
window.cpInicioSemanaMs = cpInicioSemanaMs;
function ehAtendidoNaSemana(l){
  const eventos = l.analysis?.aprendizado?.eventos || [];
  const cutoff = cpInicioSemanaMs();
  return eventos.some(e => e?.evento === "contato_manual" && e?.quando && new Date(e.quando).getTime() >= cutoff);
}
function ehAtendidoNoMes(l){
  const eventos = l.analysis?.aprendizado?.eventos || [];
  const cutoff = cpInicioMesMs();
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
// v1266 — ÚLTIMO CONTATO É O ÚLTIMO ATENDIMENTO (palavras do dono, 13/08/2026).
//
// Antes esta função devolvia o MENOR entre "dias desde a última mensagem" e "dias desde o último
// atendimento". Parece inofensivo, mas fazia o contrário do que ele pediu: cliente que ele atendeu
// há 10 dias e que mandou uma mensagem ontem aparecia como "parado há 1 dia" — a conversa mandando
// no número, não o trabalho dele. Agora existe UMA fonte: se há atendimento registrado, o número é
// dele, ponto. Só quando NÃO existe atendimento nenhum é que a conversa entra — porque aí é a única
// data que existe. É a mesma régua que a linha do cliente já usa desde a v1053 ("há Xd"), e a mesma
// do descanso desde a v1052.
function diasParado(l){
  const atTs = ultimoAtendimentoTs(l);
  if(atTs){
    const dAt = diasCalendarioBR(atTs);
    if(dAt != null && Number.isFinite(dAt)) return dAt;
  }
  const dias = Number(l?.daysSinceClientReply != null ? l.daysSinceClientReply : l?.daysSinceLastInteraction);
  return Number.isFinite(dias) ? dias : Infinity;
}

// ─── v1113 — CADÊNCIA DO CLIENTE QUE NUNCA RESPONDEU (10 retomadas em 6 meses) ────────────────
// Ideia do dono (02/08/2026), casada com a pesquisa da v1107 (8–12 contatos convertem; 74% dos
// que fecham, fecham 6+ meses depois): quem NUNCA respondeu não disputa a fila pelos sinais
// normais (não tem sinal nenhum) — segue um calendário fixo a partir do 1º contato registrado:
//   mês 1: 7, 14 e 21 dias · mês 2: 35 e 50 · mês 3: 65 e 80 · mês 4: 105 · mês 5: 135 ·
//   mês 6: 165 (mensagem de ENCERRAMENTO) — 10 retomadas ao todo.
// Regras fechadas com o dono: (1) toque só conta quando ele AGIU (atendimento registrado —
// marcar atendido, copiar mensagem, nota manual; dias civis distintos, 3 cópias no mesmo dia
// contam 1) — sugestão ignorada espera, não "queima"; (2) só entra quem nunca respondeu desde
// o 1º contato — qualquer resposta do cliente numa reimportação tira do filtro na hora;
// (3) ao completar as 10, o app SUGERE arquivar — nunca arquiva sozinho (regra da casa).
// Intervalo mínimo de 7 dias entre toques: corretor atrasado não recebe sugestões em rajada.
const CP_CADENCIA_OFFSETS_DIAS = [7, 14, 21, 35, 50, 65, 80, 105, 135, 165];
const CP_CADENCIA_TOTAL = CP_CADENCIA_OFFSETS_DIAS.length;
const CP_CADENCIA_MSG_ARQUIVAR = "Arquive este lead: esgotaram as 10 tentativas em 6 meses sem retorno.";

function cpCadenciaSemResposta(l){
  try{
    if(!l || (typeof leadEhAtivo === 'function' && !leadEhAtivo(l))) return null;
    if(((typeof mensagensDoCliente === 'function') ? mensagensDoCliente(l) : 0) > 0) return null;
    const ts = [];
    for(const e of (l?.analysis?.aprendizado?.eventos || [])){
      if(e?.evento === 'contato_manual' && e?.quando){ const t = Date.parse(e.quando); if(!isNaN(t)) ts.push(t); }
    }
    for(const m of (Array.isArray(l?.recentMessages) ? l.recentMessages : [])){
      const src = String(m?.source || "");
      if((src === 'manual' || src === 'corretor-pro-manual') && TIPOS_ATENDIMENTO_TIMELINE.has(String(m?.type || ''))){
        const t = Date.parse(m?.iso || ''); if(!isNaN(t)) ts.push(t);
      }
    }
    for(const campo of [l?.lastAttendanceAt, l?.ultimoAtendimentoEm]){
      const t = Date.parse(campo || ''); if(!isNaN(t)) ts.push(t);
    }
    if(!ts.length) return null; // sem 1º contato registrado → segue a regra normal de "nunca atendido"
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
    const diasCivis = new Set(ts.map(t => fmt.format(t)));
    const primeiro = Math.min(...ts), ultimo = Math.max(...ts);
    const feitas = Math.min(Math.max(0, diasCivis.size - 1), CP_CADENCIA_TOTAL); // 1º contato não é retomada
    if(feitas >= CP_CADENCIA_TOTAL){
      return { ativo: true, encerrar: true, feitas, total: CP_CADENCIA_TOTAL, proximaTs: null, devida: false, encerramento: false };
    }
    const proximaTs = Math.max(primeiro + CP_CADENCIA_OFFSETS_DIAS[feitas] * 86400000, ultimo + 7 * 86400000);
    return {
      ativo: true, encerrar: false, feitas, total: CP_CADENCIA_TOTAL, proximaTs,
      devida: Date.now() >= proximaTs,
      encerramento: feitas === CP_CADENCIA_TOTAL - 1 // a 10ª é a mensagem de encerramento
    };
  }catch(_){ return null; }
}

// Aviso no detalhe do lead: situação da cadência, ou a sugestão de arquivar depois das 10.
function cpCadenciaNoticeHTML(l){
  const cad = cpCadenciaSemResposta(l);
  if(!cad?.ativo) return "";
  if(cad.encerrar){
    const idJs = JSON.stringify(String(l?.id || ""));
    return `<div class="notice" style="margin:0 0 12px;border-color:var(--risco)"><b>${escapeHtml(CP_CADENCIA_MSG_ARQUIVAR)}</b><div class="small" style="margin:6px 0 10px;color:var(--muted)">Cliente sem nenhuma resposta desde o primeiro contato. Se preferir, continue tentando — nada é arquivado sem você mandar.</div><button type="button" class="btn" style="width:auto;padding:10px 16px" onclick='arquivarLead(${idJs},${safeJson(String(l?.name || ""))})'>Arquivar este lead</button></div>`;
  }
  const dataProx = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(cad.proximaTs));
  const rotulo = cad.encerramento ? `mensagem de encerramento (${cad.total} de ${cad.total})` : `retomada ${cad.feitas + 1} de ${cad.total}`;
  const quando = cad.devida ? "sugerida pra hoje" : `programada pra ${dataProx}`;
  return `<div class="notice" style="margin:0 0 12px"><b>Cliente ainda não respondeu.</b> <span class="small">Este lead segue o plano de ${cad.total} retomadas em 6 meses: a próxima é a ${escapeHtml(rotulo)}, ${escapeHtml(quando)} — ${cad.feitas} já ${cad.feitas === 1 ? "feita" : "feitas"}. Se ele respondeu no WhatsApp, reimporte a conversa que ele volta pro fluxo normal.</span></div>`;
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
// v1102 — O DONO, sobre o Jamil: "nunca atendido jamil?????". O Jamil recebeu apresentação,
// visita, material — tudo pelo WhatsApp, tudo dentro da conversa importada. Mas esta lista só
// contava atendimento MARCADO no app (botão "Marcar", mensagem copiada). Mensagem que o corretor
// mandou na própria conversa não contava — e o app dizia na cara dele que ele nunca atendeu um
// cliente que ele claramente atendeu.
//
// "Atender" pra corretor é falar com o cliente. Então o "sem atender" passa a contar o ÚLTIMO
// CONTATO REAL DO CORRETOR, o que for mais recente entre:
//   • atendimento marcado no app (o que já contava), e
//   • a última mensagem QUE ELE MANDOU na conversa do WhatsApp.
//
// IMPORTANTE: isso vale SÓ pra esta lista/contador. A fila "Fazer agora" e o descanso continuam
// contando exclusivamente do atendimento MARCADO — regra única que o dono fixou na v1052
// ("esquece a data da última msg") e que não muda aqui.
function cpUltimoContatoCorretorTs(l){
  let max = (typeof ultimoAtendimentoTs === "function") ? ultimoAtendimentoTs(l) : 0;
  // v1102 — o servidor manda a última mensagem do corretor calculada sobre a conversa INTEIRA
  // (lastCorretorMsgIso). É a fonte principal: a prévia local tem só as últimas 8 mensagens, e
  // se todas forem do cliente, a varredura abaixo não acharia nada e o app mentiria "nunca
  // respondeu" pra um cliente respondido mais atrás na conversa.
  const doServidor = Date.parse(l?.lastCorretorMsgIso || "");
  if(!isNaN(doServidor) && doServidor > max) max = doServidor;
  const msgs = Array.isArray(l?.recentMessages) ? l.recentMessages : [];
  const pn = String(l?.name||"").toLowerCase().trim().split(/\s+/)[0] || "";
  for(const m of msgs){
    if(!String(m?.text||"").trim()) continue;
    // Registro manual já entra em ultimoAtendimentoTs; sugestão da IA nunca é um envio real.
    if(typeof ehMsgManualTimeline === "function" && ehMsgManualTimeline(m)) continue;
    if(String(m?.type||"") === "sugestao-ia" || String(m?.source||"") === "assistant") continue;
    const autor = String(m?.author||"").trim();
    if(!autor || autor === "Sistema") continue;
    if(ehMsgDoCliente(m, pn)) continue; // fala do cliente não é contato SEU
    const t = Date.parse(m?.iso || "");
    if(!isNaN(t) && t > max) max = t;
  }
  return max;
}
window.cpUltimoContatoCorretorTs = cpUltimoContatoCorretorTs;
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
// v1017 criou ultimaMsgClientePedeResposta: uma peneira pra decidir se a última fala do cliente
// "pedia resposta" (pergunta, "me manda", "quanto custa") ou era só um "Ok/Obrigada". Ela servia
// a dois usos: a prioridade máxima do nível 1 (REMOVIDA na v1190, não volta) e a liberação
// antecipada de entraEmRetomada (removida por engano na v1190, DEVOLVIDA na v1192 — ver o
// comentário lá). Continua existindo só pro segundo uso.
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
// v1264 — quando a análise deste lead foi gerada (mesmos carimbos que o cabeçalho "Última
// análise" mostra, via cp865UltimaAnaliseISO). Serve pra saber se um compromisso escrito EM
// TEXTO na análise ("hoje", "amanhã") já foi tratado por um atendimento posterior.
function cpTsUltimaAnalise(l){
  try{
    const iso = (typeof cp865UltimaAnaliseISO === 'function') ? cp865UltimaAnaliseISO(l, l?.analysis) : '';
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(t) ? t : 0;
  }catch(_){ return 0; }
}
function emJanelaDeEspera(l){
  // v1264 — COMPROMISSO JÁ CUMPRIDO NÃO FURA MAIS O DESCANSO (caso real do dono: "Bocorni").
  //
  // Estas duas linhas existem pra um motivo legítimo: compromisso marcado vence o descanso (não
  // faz sentido segurar um cliente que combinou algo pra hoje só porque foi atendido anteontem).
  // O problema é que elas nunca perguntavam se aquele compromisso JÁ TINHA SIDO ATENDIDO — e um
  // lembrete com data passada fica "vencido" pra sempre. Resultado no Bocorni: lembrete de 10/08,
  // atendido em 10/08 (cópia da sugestão), descanso configurado em 7 dias — e mesmo assim ele
  // voltava pro "Fazer agora" no dia seguinte, e todo dia depois disso, porque o lembrete velho
  // furava o descanso antes de a regra dos 7 dias sequer ser consultada.
  //
  // É exatamente o mesmo defeito que a v1213 corrigiu na Agenda ("atendi no dia marcado; por que
  // ainda está atrasado?") — só que lá o remendo entrou apenas em cp786CompromissoAtrasado, e o
  // descanso ficou com a régua antiga. Agora as duas telas usam a MESMA peça (cpCompromissoJaAtendido:
  // atendimento registrado no dia do compromisso ou depois = compromisso cumprido).
  const lemTs = lembreteTs(l);
  const jaAtendido = (ts) => (typeof cpCompromissoJaAtendido === 'function') ? cpCompromissoJaAtendido(l, ts) : false;
  if(lembreteVencido(l) && !jaAtendido(lemTs)) return false;
  const aps = l.analysis?.confirmedAppointments;
  // v1264 — mesma correção pro "hoje/amanhã". Esse texto vem da ANÁLISE e não envelhece sozinho:
  // "amanhã" escrito numa análise de 10/08 continuava dizendo "amanhã" uma semana depois, furando
  // o descanso pra sempre. Se existe atendimento registrado no dia daquela análise ou depois, o
  // compromisso dela já foi tratado.
  if(Array.isArray(aps) && aps.some(ap => /\b(hoje|amanh[ãa])\b/.test(String(ap.quando||"").toLowerCase()))
     && !jaAtendido(cpTsUltimaAnalise(l))) return false;
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
//  - o cliente perguntou algo e não há atendimento nenhum registrado neste lead.
//
// v1190 tirou a terceira exceção junto com o nível 1 de filaPorFatos. v1192 DEVOLVEU, por ordem
// do dono ("não cria problemas") — e ele está certo, os dois casos não são a mesma coisa:
//
//   • O nível 1 AFIRMAVA uma pendência ("cliente esperando sua resposta") e furava o descanso de
//     um lead JÁ ATENDIDO. Isso continua removido, e não volta.
//   • Aqui não há descanso pra furar: a linha logo acima (emJanelaDeEspera) já devolveu false, o
//     que só acontece quando NÃO existe nenhum atendimento marcado neste lead. Ou seja, ninguém
//     colocou esse cliente em espera — e segurar por 5 dias um lead novo que fez uma pergunta é
//     perder venda, não evitar ruído.
//
// A diferença prática pro dono: o cartão "Fazer agora" volta a contar esses leads no mesmo dia.
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
    // Contato recente (< limiar dias) e nenhum atendimento marcado: entra se o cliente fez uma
    // pergunta de verdade. v1017 — sem checar O QUE ele disse, um "Ok"/"Obrigada" já liberava o
    // lead antes da hora. v1190 tirou isto por engano junto com o nível 1; v1192 devolveu (ver o
    // comentário acima da função). Esta é a ÚNICA sobrevivente da leitura de "quem falou por
    // último", e ela não afirma pendência nenhuma na tela: só decide se vale um toque hoje.
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
  return `<span class="chr-bar" title="${n} ${n===1?'mensagem':'mensagens'} do cliente nos últimos 90 dias"><span class="chr-track"><i style="width:${pct}%;background:linear-gradient(90deg,${BRANCO_GRADIENTE},${cor})"></i></span><b style="color:${cor}">${n}</b></span>`;
}
// Linha compacta de lead da Home (opção 1 + lista densa, escolha do dono): nome, produto, barra
// de mensagens e dias parado. Desktop: 1 linha. Mobile: 2 linhas (nome ganha a largura toda;
// barra + produto vão embaixo) — via grid-template-areas, sem quebra lateral.
function cpHomeLeadRow(l, maxMsgs){
  const idJs = JSON.stringify(String(l.id||""));
  // v1050 — pedido do dono: tirou a "bolinha" (indicador colorido de status) da linha; o nível
  // sobreviveu só pra decidir o texto do title de "dias" logo abaixo.
  // v1190 — e agora o nível saiu daqui também: o único texto que ele escolhia era "Cliente
  // esperando sua resposta há N dias" (nível 1), a mesma afirmação sem lastro que a v1189 baniu.
  // Sem ele, a linha ainda ganha de brinde uma conta a menos por lead no desenho da Home.
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
  // o texto é sempre sobre o atendimento — só cai pro texto de "última interação" quando não
  // existe atendimento nenhum pra mostrar.
  const diasTitle = diasNum == null ? '' : (diasEhAtendimento
    ? `${diasNum} dia${diasNum===1?'':'s'} desde o último atendimento marcado`
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
  // v1113 — lead na cadência de "nunca respondeu": a barra de mensagens seria sempre vazia (o
  // cliente nunca falou); no lugar dela, a linha mostra QUAL retomada é (ou a sugestão de
  // arquivar, depois das 10) — é o aviso do plano de 10 toques em 6 meses.
  let barHtml = cpBarraMensagensMini(l, maxMsgs);
  try{
    const cad = (typeof cpCadenciaSemResposta === 'function') ? cpCadenciaSemResposta(l) : null;
    if(cad?.ativo){
      const rot = cad.encerrar ? `Arquivar sugerido · ${cad.total}/${cad.total}`
        : (cad.encerramento ? `↻ Encerramento (${cad.total} de ${cad.total})` : `↻ Retomada ${cad.feitas+1} de ${cad.total}`);
      barHtml = `<span class="chr-bar" title="Cliente nunca respondeu — plano de ${cad.total} retomadas em 6 meses"><b style="min-width:0;white-space:nowrap;color:${cad.encerrar?'var(--risco)':'var(--morno)'}">${escapeHtml(rot)}</b></span>`;
    }
  }catch(_){}
  return `<button type="button" class="cp-hoje-row" onclick='abrirLead(${idJs})'>
    <span class="chr-nm">${escapeHtml(l.name||'Cliente')}</span>
    <span class="chr-pr" title="${escapeHtml(prod||'')}">${escapeHtml(prod||'')}</span>
    ${barHtml}
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
  // v1142 — o mesmo detalhe que o servidor grava pra esta ação (`de:"copiar_msg"`). Antes a marca
  // local entrava como "botao_atendido", o que fazia a marcação local e a do banco virarem dois
  // eventos diferentes na mesma conversa depois de recarregar.
  const DETALHES_COPIA = { tipo:"Mensagem enviada", de:"copiar_msg" };
  try{
    quando = new Date().toISOString();
    const p = new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,hourCycle:"h23"}).formatToParts(new Date(quando)).reduce((o,x)=>(x.type!=="literal"&&(o[x.type]=x.value),o),{});
    dataLocal = `${p.day}/${p.month}/${p.year}`;
    horaLocal = `${p.hour}:${p.minute}`;
    if(state.lead && String(state.lead.id) === String(id)) ui667AplicarAtendidoLocal(state.lead, quando, dataLocal, horaLocal, DETALHES_COPIA);
    for(const lista of [state.itemsAtivos, state.todosLeads, state.leads]){
      const item = Array.isArray(lista) ? lista.find(x => String(x.id) === String(id)) : null;
      if(item) ui667AplicarAtendidoLocal(item, quando, dataLocal, horaLocal, DETALHES_COPIA);
    }
  }catch(_){}
  // v1142 — A TELA PRECISA MOSTRAR O ATENDIMENTO NA HORA, SEM DEPENDER DE REDE.
  //
  // Print do dono (05/08/2026, 17:33): copiou a sugestão e o botão do cliente continuava
  // "Marcar", como se nada tivesse sido registrado — "de novo o mesmo problema recorrente que
  // você nunca arruma". Motivo: a marcação acima só existia na MEMÓRIA. Quem redesenhava o
  // cliente era o recarregamento pela rede, no fim desta função (recarregarLeadFoco) — se ele
  // demorasse, falhasse ou fosse cortado (celular indo pro WhatsApp), NINGUÉM redesenhava e o
  // botão ficava em "Marcar" mesmo com o atendimento gravado no banco. Daí o "às vezes marca,
  // às vezes não". O botão "Marcar atendimento" nunca teve esse problema porque ele redesenha
  // na hora — agora copiar faz igual.
  const repintarLead = () => {
    try{
      if(state.lead && String(state.lead.id) === String(id) && typeof renderLeadFoco === "function") renderLeadFoco(state.lead);
    }catch(_){}
  };
  repintarLead();
  // v1019 — "copiar mensagem" marca atendimento nesta MESMA chamada (registrarAtendimento:true).
  // Antes, uma falha aqui (timeout, instabilidade) era engolida em silêncio — a tela já tinha
  // mostrado "Mensagem copiada" e marcado atendido NA HORA (otimista, acima), então o corretor
  // nunca ficava sabendo que o atendimento não foi gravado de verdade: o lead voltava a aparecer
  // depois como se nunca tivesse sido atendido ("assim como Adão, vários outros atendi e não
  // marca corretamente as datas"). Agora tenta de novo uma vez antes de desistir, e avisa se
  // mesmo assim não conseguir — em vez de deixar o corretor sem saber.
  // v1097 — keepalive: copiar a mensagem é EXATAMENTE quando o corretor sai do app pro WhatsApp.
  // Sem isso, o celular corta este pedido ao mandar o app pro fundo e o atendimento não é gravado,
  // apesar da tela já ter dito "Mensagem copiada" e já ter marcado como atendido na hora. Com
  // keepalive, o navegador termina o envio mesmo com o app fora da frente.
  // v1142 — 3 tentativas com 30s, igual ao botão "Marcar atendimento" (ui667MarcarAtendido). Eram
  // 2 tentativas de 15s: numa rede engasgada (o normal ao voltar do WhatsApp) as duas morriam
  // antes de o servidor responder, e o atendimento realmente não era gravado.
  const registrarAtendimentoDaCopia = () => fetchComTimeout("./api/reanalisar-lead", { method:"POST", headers:{"Content-Type":"application/json"}, keepalive:true,
    body: JSON.stringify({ id, novoAtendimento: texto.slice(0,4000), apenasSalvar:true, autorManual:"Mensagem enviada (você)", tipoManual:"mensagem_enviada", registrarAtendimento:true }) }, 30000);
  let atendimentoConfirmado = null;
  for(let tentativa=1; tentativa<=3 && !atendimentoConfirmado; tentativa++){
    try{
      const resp = await registrarAtendimentoDaCopia();
      const dados = await resp.json().catch(()=>({}));
      if(resp.ok && dados?.ok) atendimentoConfirmado = dados;
    }catch(_){}
    if(!atendimentoConfirmado && tentativa < 3) await new Promise(r=>setTimeout(r,1200));
  }
  if(atendimentoConfirmado){
    // Alinha a marca local com o horário gravado no banco: sem isso, o mesmo atendimento voltava
    // do servidor com outro horário e virava um segundo evento na conversa do cliente.
    const quandoSalvo = String(atendimentoConfirmado.quando || "");
    if(quandoSalvo && quando){
      try{
        for(const alvo of [state.lead, ...[state.itemsAtivos, state.todosLeads, state.leads].map(lista => Array.isArray(lista) ? lista.find(x => String(x.id) === String(id)) : null)]){
          if(!alvo || String(alvo.id) !== String(id)) continue;
          const evs = alvo.analysis?.aprendizado?.eventos;
          if(Array.isArray(evs)) for(const e of evs){ if(e?.quando === quando && e?.detalhes?.de === "copiar_msg") e.quando = quandoSalvo; }
          if(alvo.lastAttendanceAt === quando){ alvo.lastAttendanceAt = quandoSalvo; alvo.ultimoAtendimentoEm = quandoSalvo; }
        }
      }catch(_){}
    }
  }else{
    // v1142 — a tela não pode mentir nos DOIS sentidos: se o atendimento não foi gravado mesmo
    // depois das 3 tentativas, desfaz a marca local (só o evento DESTA cópia — atendimento de
    // outro momento do dia continua valendo) e repinta, pra o cliente não ficar como "Atendido"
    // sem estar. O aviso abaixo continua explicando o que fazer.
    try{
      for(const alvo of [state.lead, ...[state.itemsAtivos, state.todosLeads, state.leads].map(lista => Array.isArray(lista) ? lista.find(x => String(x.id) === String(id)) : null)]){
        if(!alvo || String(alvo.id) !== String(id)) continue;
        const evs = alvo.analysis?.aprendizado?.eventos;
        if(Array.isArray(evs)){
          alvo.analysis.aprendizado.eventos = evs.filter(e => !(e?.quando === quando && e?.detalhes?.de === "copiar_msg"));
        }
        const ts = (typeof ultimoAtendimentoTs === "function") ? ultimoAtendimentoTs({ ...alvo, lastAttendanceAt:null, ultimoAtendimentoEm:null }) : 0;
        alvo.lastAttendanceAt = ts ? new Date(ts).toISOString() : null;
        alvo.ultimoAtendimentoEm = alvo.lastAttendanceAt;
      }
    }catch(_){}
    repintarLead();
    toast("Mensagem copiada, mas NÃO consegui registrar o atendimento (rede). Toque em \"Marcar\" no cliente pra registrar.");
  }
  invalidarLeadsCache();
  // v1031 — mesma rede de segurança do ui667MarcarAtendido: o recarregamento pode responder com
  // uma versão de alguns instantes atrás (antes da marcação terminar de persistir no banco) — sem
  // reaplicar a marcação local depois, ela se perdia de novo, silenciosamente, exatamente como
  // reaplicá-la aqui evita.
  // v1142 — a reaplicação só acontece quando o atendimento FOI gravado (antes ela rodava sempre e
  // ressuscitava a marca local de uma gravação que falhou, deixando o cliente "Atendido" na tela
  // sem estar no banco). Usa o horário confirmado pelo servidor e o mesmo detalhe da cópia.
  if(quando && atendimentoConfirmado){
    const quandoFinal = String(atendimentoConfirmado.quando || quando);
    loadRecentLeads(false).then(() => ui667ReconciliarAtendimentoLocal(id, item => ui667AplicarAtendidoLocal(item, quandoFinal, dataLocal, horaLocal, DETALHES_COPIA))).catch(()=>{});
  } else {
    try{ loadRecentLeads(false); }catch(_){}
  }
  if(state.lead && String(state.lead.id) === String(id)) try{ recarregarLeadFoco(id); }catch(_){}
}


// v1095 — "Oportunidades esquecidas" REMOVIDA. Ordem do dono, repetida e sem margem: um cliente
// só pode ser ATIVO ou ARQUIVADO, e nada mais pode dar outro nome a ele. Aquela seção da tela
// inicial rotulava cliente ativo como "esquecido" — mais um nome, exatamente o que ele baniu.
// Saíram junto leadsEsquecidos(), radarRowHTML() e radarSeveridade(), que só serviam a ela.

// (v911) Raio-X da carteira removido de vez (o dono pediu): usava etapa/proposta/visita —
// dados que o app não sabe de verdade — pra montar diagnóstico. insightFocoHTML/temVisitaLead/
// leadsRaioX/abrirRaioX apagados junto.

// v1278 — quantos clientes da fila a Home mostra por vez embaixo da lista do dia (e quantos
// entram a cada clique em "Mostrar mais").
const CP1278_FILA_PASSO = 20;

function renderBotoesHome(){
  const foco = qs("#leadFocoArea");
  if(!foco) return;
  document.body.classList.remove("lead-foco-aberto");
  state.focoLeadId = null; // mostrando os botões iniciais = nenhum lead em foco
  state.grupoAtivo = null;
  const saud = qs("#saudacao");
  if(saud && saud.innerHTML.trim()) saud.style.display = "";
  const grupos = state.gruposHome || { "acao-hoje": [], "pode-aguardar": [], "tratado-hoje": [] };
  const items = state.itemsAtivos || [];
  // v1170 — dispara a busca do bloco de notas em segundo plano (não trava a Home esperando).
  // Idempotente: se já carregou ou já está carregando, cp1170Carregar não repete a chamada.
  if(typeof cp1170Carregar === 'function') cp1170Carregar();

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


  // v942 — a Home mostra SEMPRE os leads do dia, um embaixo do outro (lista compacta), SEM aquele
  // card amarelo que o dono mandou tirar. Se o balde estrito de urgentes está vazio, a gente puxa
  // direto da FILA RANQUEADA completa (cpFilaFazerAgora — os elegíveis, já fora de quem foi
  // atendido hoje e de quem está na janela de espera). Nunca mais um card dizendo que "não tem
  // trabalho" com 160+ leads na carteira.
  // v1139 — a fila chega aqui com as vagas de resgate do dia já aplicadas
  // (cpFilaFazerAgoraComResgates). O "Pular próximo" foi REMOVIDO nesta versão (pedido do dono:
  // nunca usou, "empurrar atendimento pra frente é coisa de preguiçoso") — junto saíram
  // state.pulados e a reordenação por sessão que só existiam por causa dele.
  let filaRanqueada = typeof cpFilaFazerAgoraComResgates === 'function' ? cpFilaFazerAgoraComResgates(items)
    : (typeof cpFilaFazerAgora === 'function' ? cpFilaFazerAgora(items) : []);
  const metaHoje = typeof cpFazerAgoraDose === 'function' ? cpFazerAgoraDose(items) : (typeof cpMetaAtendimentosDia==='function'?cpMetaAtendimentosDia():10);
  // "Atender +1" da lista do card "Fazer agora" (state.fazerAgoraExtra) puxa além da meta, sem
  // esperar o dia seguinte — a Home respeita esse contador pra as duas telas mostrarem o mesmo.
  const extraHoje = Math.max(0, Number(state.fazerAgoraExtra||0));
  const quantosMostrar = Math.max(0, metaHoje) + extraHoje;
  const dose = filaRanqueada.slice(0, quantosMostrar);
  const disponiveisParaPuxar = filaRanqueada.slice(dose.length);
  // v1278 — pedido do dono, olhando a Home com a meta do dia já batida: no lugar do botão
  // "Atender mais um" (que revelava UM cliente por clique e deixava o resto da tela vazio), o
  // RESTO DA FILA aparece listado logo abaixo, no mesmo formato da lista do dia — é só clicar em
  // quem ele quiser atender. O botão que sobrou não puxa mais "um": ele mostra o próximo BLOCO da
  // fila (CP1278_FILA_PASSO por vez), pra Home não nascer com 100 linhas no celular.
  const limiteFila = Math.max(CP1278_FILA_PASSO, Number(state.cp1278FilaLimite||CP1278_FILA_PASSO));
  const filaAbaixoHtml = (lista) => {
    if(!lista.length) return "";
    const visiveis = lista.slice(0, limiteFila);
    const maxMsgsFila = visiveis.reduce((m,l)=>Math.max(m, (typeof mensagensDoClienteRecente==='function'?mensagensDoClienteRecente(l):0)), 1);
    const restam = lista.length - visiveis.length;
    return `<div class="cp-fila-titulo">Na fila · ${lista.length} ${lista.length===1?"cliente":"clientes"} · por prioridade</div>`
      + `<div class="cp-hoje-list">${visiveis.map(l => cpHomeLeadRow(l, maxMsgsFila)).join("")}</div>`
      + (restam
          ? `<div class="cp-hoje-mais-wrap"><button type="button" class="cp-atender-mais" onclick="cpMostrarMaisFilaHoje()">Mostrar mais ${Math.min(restam, CP1278_FILA_PASSO)} · faltam ${restam}</button></div>`
          : "");
  };
  let top3Html;
  if(dose.length){
    // Lista compacta: um lead embaixo do outro, 1 coluna, sem quebra lateral (opção 1 + lista
    // densa que o dono escolheu). Cada linha traz a barra de status das mensagens do cliente,
    // relativa ao maior da lista (maxMsgsDose) pra as diferenças aparecerem.
    // v1017 — mesma métrica que a barra agora usa (mensagensDoClienteRecente, 90 dias), pro
    // "maior da lista" ser calculado com a MESMA régua exibida (senão a barra nunca chegaria a
    // 100%, ou o menor lead pareceria proporcionalmente maior/menor do que realmente é).
    const maxMsgsDose = dose.reduce((m,l)=>Math.max(m, (typeof mensagensDoClienteRecente==='function'?mensagensDoClienteRecente(l):0)), 1);
    // v1203 — o dono viu a barra e o "há Xd" na lista e não lembrava mais o que significavam
    // ("nem eu sei mais"): a explicação só existia como title (dica ao passar o mouse), que
    // ninguém acha sozinho — principalmente no celular, onde não existe hover. Uma legenda fixa,
    // sempre visível, tira a dúvida sem precisar abrir nada.
    // v1204 — a frase original (3 linhas inteiras no celular, empurrando a lista pra baixo) foi
    // reclamação direta do dono ("q bosta no mobile"). Encurtada pro essencial; quem quiser o
    // detalhe fino (ex.: que "há Xd" vem do atendimento marcado, quando existir) continua achando
    // no title de cada linha, que não sumiu.
    // v1252 — no CELULAR a legenda sai de cena (regra de estilo mais abaixo): mesmo curta ela
    // virava duas linhas soltas entre a busca e a lista, e o dono não entendia o que ela dizia
    // ("legenda fora de contexto"). No computador ela continua, colada na lista, onde tem largura
    // pra caber em uma linha só e o texto fica junto do que explica.
    top3Html = `<div class="cp-hoje-legenda">Barra/número: mensagens do cliente (90 dias). "há Xd": dias sem contato.</div>`
      + `<div class="cp-hoje-list">${dose.map(l => cpHomeLeadRow(l, maxMsgsDose)).join("")}</div>`
      + filaAbaixoHtml(disponiveisParaPuxar);
  } else if(metaHoje === 0 && filaRanqueada.length){
    // Já atendeu a dose de hoje, mas ainda tem gente elegível. Sem card grande — convite discreto.
    // v981 — mostrava sempre CP_DOSE_DIA (fixo em "10"), então quem passava da meta (atendia 11,
    // 12...) continuava vendo "você já atendeu os 10 de hoje" parado, como se tivesse travado.
    // Mostra o total real de hoje (mesma contagem do banner da Home, cpAtendidosHojeTotal).
    const atendidosHojeReal = typeof cpAtendidosHojeTotal === 'function' ? cpAtendidosHojeTotal(items) : CP_DOSE_DIA;
    // v1278 — a frase de parabéns continua, mas embaixo dela vem a FILA listada (era só um botão
    // "Atender mais um" e um tampão de tela vazia): com a meta batida, quem quiser seguir escolhe
    // o próximo cliente na lista, sem clicar pra revelar de um em um.
    top3Html = `<div class="cp-hoje-done">Você já atendeu ${atendidosHojeReal} hoje. 👏 Quer seguir? É só escolher na lista abaixo.</div>`
      + filaAbaixoHtml(disponiveisParaPuxar);
  } else {
    // Fila realmente vazia (fim de semana, ou ninguém elegível agora). Uma linha neutra, sem box.
    // v1091 — em dia sem fila esta caixa NÃO repete o aviso: a saudação, poucos centímetros acima
    // na mesma tela, já explicou. Fica em branco pra tela não ficar dizendo a mesma coisa duas vezes.
    top3Html = cpFimDeSemana() ? "" : `<div class="cp-hoje-vazio">Nenhum lead pra atender agora. Bom momento pra enviar conversas novas.</div>`;
  }

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
      .home-m1-semana{margin-top:10px;padding:12px 16px;background:linear-gradient(135deg,rgba(86,199,242,.04),rgba(155,140,255,.04));border:1px solid var(--line);border-radius:14px}
      .home-m1-semana-titulo{color:var(--dados);text-transform:uppercase;letter-spacing:.14em;font-weight:950;font-size:10px;margin-bottom:8px}
      .home-m1-semana-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .home-m1-semana-kpis .kpi{text-align:center}
      .home-m1-semana-kpis .kpi b{display:block;font-size:18px;font-weight:950;margin-bottom:2px}
      .home-m1-semana-kpis .kpi span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:950}
      @media(max-width:760px){.home-m1-grid{grid-template-columns:1fr}}
      /* v1203 — legenda fixa acima da lista, explicando a barra de mensagens e o "há Xd" (antes só
         existia como title, invisível sem passar o mouse — e nem existe hover no celular). */
      .cp-hoje-legenda{font-size:11px;color:var(--muted);margin:0 0 8px;line-height:1.4}
      /* v1252 — some no celular (ordem do dono). Lá ela ficava solta acima da lista, ocupando
         espaço da tela que é justamente onde os clientes do dia aparecem. */
      @media(max-width:999px){.cp-hoje-legenda{display:none}}
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
      /* v1278 — título da fila que agora vem listada embaixo da lista do dia. */
      .cp-fila-titulo{font-size:10.5px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:16px 0 8px}
      .cp-hoje-mais-wrap{text-align:center;margin:2px 0 6px}
      .cp-atender-mais{border:1px solid rgba(255,98,88,.4);background:rgba(255,98,88,.07);color:var(--accent);border-radius:999px;padding:9px 16px;font-size:12px;font-weight:900;cursor:pointer}
      .cp-atender-mais:hover{background:rgba(255,98,88,.13)}
      .cp-hoje-done{padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.02);color:var(--soft);font-size:13px;font-weight:700;text-align:center;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}
      .cp-hoje-vazio{padding:18px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);font-size:13px;text-align:center;margin-bottom:8px}
      /* v1168 — "Compromissos de hoje": faixa própria, cor diferente da "Ficaram de te dar uma
         resposta" (que é coral/accent) pra não parecer a mesma coisa — aqui é hora marcada, ali é
         prazo do cliente. Usa --acao (o mesmo verde da seção "Compromissos hoje" da tela Agenda). */
      .cp1168-faixa{border:1px solid var(--acao-line);background:var(--acao-soft);border-radius:14px;padding:12px 14px;margin-bottom:12px}
      .cp1168-tit{color:var(--acao);text-transform:uppercase;letter-spacing:.1em;font-weight:950;font-size:11px;margin-bottom:8px}
      .cp1168-row{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;border-bottom:1px solid rgba(255,255,255,.06);padding:8px 0;font:inherit;color:var(--text);text-align:left;cursor:pointer}
      .cp1168-row:last-of-type{border-bottom:0}
      .cp1168-hora{flex:0 0 auto;min-width:40px;font-size:12.5px;font-weight:950;color:var(--acao);font-variant-numeric:tabular-nums}
      .cp1168-hora.cp1168-sem-hora{min-width:auto;font-size:16px;line-height:1}
      .cp1168-nome{flex:0 1 auto;font-size:13.5px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cp1168-motivo{flex:1 1 auto;min-width:0;font-size:12px;color:var(--soft);font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
      /* v1171 — Bloco de notas administrativas. Pedido do dono: tarefa que NÃO é atendimento de
         cliente ("verificar pagamento de entrada", "matrícula no registro de imóveis") precisa
         de um lugar próprio, fácil de achar, sem se misturar com a fila de clientes. Depois de
         testar 4 modelos de posição, o dono escolheu virar um card dentro da fileira de números
         da Home (junto de "Fazer agora", "Total de leads" etc.) que abre um painel flutuante —
         reaproveita o mesmo estilo do painel do sino (.cp687-notify-panel) pra não duplicar CSS. */
      .cp1170-panel{width:min(420px,calc(100vw - 36px))}
      .cp1170-add{display:flex;gap:8px;margin-bottom:10px}
      .cp1170-add input{flex:1;min-width:0;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:10px;padding:9px 12px;color:var(--text);font-size:13px}
      .cp1170-add button{flex:0 0 auto;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--text);border-radius:10px;padding:9px 14px;font-size:12.5px;font-weight:900;cursor:pointer}
      .cp1170-item{display:flex;align-items:flex-start;gap:9px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)}
      .cp1170-item:last-child{border-bottom:0}
      .cp1170-item input[type=checkbox]{margin-top:3px;flex:0 0 auto;width:16px;height:16px;cursor:pointer;accent-color:var(--acao)}
      .cp1170-item span{flex:1;min-width:0;font-size:13px;line-height:1.4;word-break:break-word}
      .cp1170-item.feita span{color:var(--muted);text-decoration:line-through}
      .cp1170-item button{flex:0 0 auto;border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:17px;line-height:1;padding:2px 5px}
      .cp1170-item button:hover{color:var(--risco)}
      .cp1170-vazio{color:var(--muted);font-size:12.5px;padding:6px 0}
      /* v1251 — o CSS do quadradinho "Atendidos" (v1171/v1183) saiu junto com o quadradinho:
         as três contagens mudaram de casa pro painel "Seu mês" (ver cp1251PainelHTML). */
    </style>
    <div class="home-saud">
      <div class="home-saud-sub"><span class="home-saud-titulo"></span></div>
    </div>
    ${barraBuscaLeadHTML("home")}
    ${typeof cp1168FaixaHomeHTML === 'function' ? cp1168FaixaHomeHTML(items) : ""}
    <div class="home-m1-list">${top3Html}</div>
  `;
  qsa(".pickZipShortcut").forEach(b => {
    if(!b.dataset.bound){ b.dataset.bound = "1"; b.addEventListener("click", () => show("zip")); }
  });
}

// v1139 — "Pular próximo" (e o state.pulados que só existia pra ele) foi REMOVIDO de vez.
// Pedido do dono: nunca pulou ninguém, achou o botão obsoleto e contra o jeito certo de
// trabalhar ("empurrar atendimento pra frente é coisa de preguiçoso").

// v925 — "Atender mais um": puxa mais um lead da fila além da meta batida de hoje (mesma
// variável de sessão do botão "Atender +1" de abrirFazerAgora — clicar em qualquer um dos dois
// lugares soma no mesmo contador, então ficam sempre em sincronia).
// v1278 — cpAtenderMaisUmHoje (o "Atender mais um" da Home, que revelava UM cliente por clique)
// foi REMOVIDA: a Home agora lista o resto da fila embaixo, e o botão que sobrou só abre o
// próximo BLOCO dessa lista. O botão "Atender +1" da lista do card "Fazer agora"
// (abrirFazerAgora) segue existindo com o contador dele (state.fazerAgoraExtra), intocado.
function cpMostrarMaisFilaHoje(){
  state.cp1278FilaLimite = Math.max(CP1278_FILA_PASSO, Number(state.cp1278FilaLimite||CP1278_FILA_PASSO)) + CP1278_FILA_PASSO;
  renderBotoesHome();
}
window.cpMostrarMaisFilaHoje = cpMostrarMaisFilaHoje;


// v1268 (2ª passada) — buildDesempenhoInsightsHTML saiu junto com o modal de insights que ela
// montava (abrirDesempenhoInsights, acima). Era o último pedaço daquela tela.
function renderHomeRight(items){
  // Atualização #810: a coluna lateral repetia indicadores já exibidos nos cards
  // principais e podia ficar presa no skeleton quando o dashboard caía no fallback.
  // Por isso ela ficou VAZIA desde então — espaço bom desperdiçado no computador.
  //
  // v1251 — ela volta a ter dono, e desta vez com conteúdo que NÃO existe em nenhum outro lugar
  // da Home: os números do mês (atendidos e mensagens trocadas) e o gráfico de atendimentos dia a
  // dia. Escolha do dono, depois de ver o desenho nas duas telas: aberto no computador (aqui não
  // custa nada — a coluna já estava vazia e a lista de clientes não perde uma linha) e fechado no
  // celular (lá custaria 4 dos 5 clientes visíveis sem rolar). Quem cuida do celular é
  // cp1251RenderResumo, logo abaixo. Continua sem bloquear nada: se der erro, a Home segue.
  const el = qs("#homeRight");
  if(!el) return;
  try{
    el.innerHTML = cp1251PainelHTML(cp1251Dados(), { compacto:true });
    el.hidden = false;
    el.style.removeProperty("display");
  }catch(_){
    el.innerHTML = "";
    el.hidden = true;
    el.style.setProperty("display", "none", "important");
  }
}
window.renderHomeRight = renderHomeRight;

// ── v1251 — SEUS NÚMEROS DO MÊS ───────────────────────────────────────────────────────────────
// Pedido do dono: além de "Atendidos", ver quantas mensagens foram trocadas no mês — o total, as
// que ele mandou e as que recebeu — e tirar isso de dentro do quadradinho apertado da Home.
//
// TUDO AQUI É DO PRIMEIRO AO ÚLTIMO DIA DO MÊS (calendário de Brasília), como ele pediu — não é
// "últimos 30 dias".
//
// De onde vem cada número:
//  • Atendidos (hoje/semana/mês): dos eventos "contato_manual" de cada cliente, a MESMA régua que
//    o quadradinho antigo usava — inclusive quem foi arquivado depois ("arquivado também é
//    atendimento", palavras do dono na v1183).
//  • Mensagens do mês: dos campos msgMes* que o SERVIDOR manda prontos (v1251). Antes esse número
//    era montado aqui em cima da prévia de 8 mensagens por cliente — ou seja, saía muito menor que
//    a realidade em qualquer conversa de verdade.
//  • Gráfico: quantos clientes você atendeu em cada dia do mês (o mesmo evento dos atendidos).
function cp1251Dados(){
  const base = (Array.isArray(state.todosLeads) && state.todosLeads.length) ? state.todosLeads : (state.itemsAtivos || []);
  const iniMes = cpInicioMesMs();
  const hojeBR = inicioDoDiaBR().getTime();
  const diaDeHoje = Math.max(0, Math.floor((hojeBR - iniMes) / 86400000));
  const porDia = new Array(diaDeHoje + 1).fill(null).map(() => new Set());
  let total = 0, enviadas = 0, recebidas = 0;
  for(const l of base){
    total += Number(l?.msgMesTotal) || 0;
    enviadas += Number(l?.msgMesCorretor) || 0;
    recebidas += Number(l?.msgMesCliente) || 0;
    const eventos = l?.analysis?.aprendizado?.eventos || [];
    for(const e of eventos){
      if(e?.evento !== "contato_manual" || !e?.quando) continue;
      const t = Date.parse(e.quando);
      if(!Number.isFinite(t) || t < iniMes) continue;
      const idx = Math.floor((t - iniMes) / 86400000);
      if(idx >= 0 && idx < porDia.length) porDia[idx].add(String(l.id));
    }
  }
  // v1273 — o gráfico deixa de mostrar sábado e domingo (print do dono, com as barras do fim de
  // semana circuladas em vermelho): "senão parece q não trabalhei, e realmente, pq é final de
  // semana, mas então não considere final de semana". Um vale de zeros toda semana lia como queda
  // de produção — quando é só o fim de semana existindo. Cada dia passa a carregar a data pra que
  // o desenho saiba o que é fim de semana; a filtragem acontece só na hora de desenhar, então os
  // números do painel (atendidos no mês, mensagens) continuam contando tudo, inclusive sábado e
  // domingo — quem trabalhou no fim de semana não perde o atendimento da conta.
  const diaSemanaBR = new Intl.DateTimeFormat("en-US", { timeZone:"America/Sao_Paulo", weekday:"short" });
  return {
    atendidosHoje: base.filter(ehAtendidoHoje).length,
    atendidosSemana: base.filter(ehAtendidoNaSemana).length,
    atendidosMes: base.filter(ehAtendidoNoMes).length,
    total, enviadas, recebidas,
    porDia: porDia.map((s, i) => {
      const sigla = diaSemanaBR.format(new Date(iniMes + i * 86400000));
      return { qtd: s.size, dia: i + 1, fds: sigla === "Sat" || sigla === "Sun", hoje: i === porDia.length - 1 };
    }),
    mesNome: new Intl.DateTimeFormat("pt-BR", { timeZone:"America/Sao_Paulo", month:"long" }).format(new Date()),
    diasNoMes: new Date(new Date(iniMes).getUTCFullYear(), new Date(iniMes).getUTCMonth() + 1, 0).getDate()
  };
}

function cp1251Num(n){ return Number(n || 0).toLocaleString("pt-BR"); }

// v1273 — só dia útil entra no desenho. Sábado e domingo sem atendimento saem: eles não medem
// produção, medem fim de semana, e o vale de zeros semanal fazia o mês parecer parado. Fim de
// semana em que o corretor ATENDEU alguém continua aparecendo — apagar isso seria apagar trabalho
// que existiu, exatamente o contrário do que o dono pediu.
function cp1251GraficoHTML(porDia){
  const dias = porDia.filter(d => !d.fds || d.qtd > 0);
  if(!dias.length) return "";
  const maior = Math.max(1, ...dias.map(d => d.qtd));
  const barras = dias.map((d) => {
    const alt = Math.max(4, Math.round((d.qtd / maior) * 100));
    // O dia de hoje só acende em coral quando REALMENTE teve atendimento — senão a barrinha
    // mínima (que existe só pra marcar o dia no gráfico) daria a entender que houve movimento.
    const ultima = d.hoje && d.qtd > 0;
    return `<i class="${ultima ? "cp1251-hoje" : ""}" style="height:${alt}%" title="dia ${d.dia}: ${d.qtd} atendido${d.qtd === 1 ? "" : "s"}"></i>`;
  }).join("");
  // A ponta direita só pode dizer "hoje" se hoje estiver DESENHADO. Quando hoje é sábado ou
  // domingo sem atendimento, ele sai do gráfico — e a legenda passa a nomear o último dia útil.
  const fim = dias[dias.length - 1];
  return `<div class="cp1251-gr" aria-hidden="true">${barras}</div>
    <div class="cp1251-gr-leg"><span>dia ${dias[0].dia}</span><span>${fim.hoje ? "hoje" : "dia " + fim.dia}</span></div>
    <p class="cp1251-gr-tit">Clientes atendidos por dia útil</p>`;
}

function cp1251LinhaHTML(cor, icone, titulo, sub, valor){
  return `<div class="cp1251-num">
    <span class="cp1251-bolha" style="background:${cor.fundo};color:${cor.cor}">${icone}</span>
    <span class="cp1251-txt"><b>${escapeHtml(titulo)}</b><small>${escapeHtml(sub)}</small></span>
    <b class="cp1251-val">${cp1251Num(valor)}</b>
  </div>`;
}

function cp1251PainelHTML(d, opts = {}){
  const compacto = opts.compacto === true;
  const pct = (n) => d.total > 0 ? Math.round((Number(n) || 0) / d.total * 100) + "%" : "—";
  const coral = { fundo:"rgba(255,98,88,.14)", cor:"var(--cp-coral, var(--accent))" };
  const azul  = { fundo:"rgba(85,184,232,.14)", cor:"var(--cp-blue, var(--dados))" };
  const ciano = { fundo:"rgba(97,199,232,.14)", cor:"var(--cp-green, var(--dados))" };
  const mes = d.mesNome.charAt(0).toUpperCase() + d.mesNome.slice(1);
  // Dentro da folha do celular o título já está na barra de cima — repetir "Seu mês" duas vezes,
  // uma embaixo da outra, é ruído.
  const titulo = opts.semTitulo === true ? "" : `<h3 class="cp1251-tit">Seu mês</h3>`;
  return `<section class="cp1251-painel${compacto ? " cp1251-compacto" : ""}">
    ${titulo}
    <p class="cp1251-per">${escapeHtml(mes)} · do dia 1 ao dia ${d.diasNoMes}</p>
    <div class="cp1251-lista">
      ${cp1251LinhaHTML(coral, "✓", "Clientes atendidos", `${cp1251Num(d.atendidosHoje)} hoje · ${cp1251Num(d.atendidosSemana)} nesta semana`, d.atendidosMes)}
      ${cp1251LinhaHTML(azul, "↔", "Mensagens trocadas", "no mês inteiro", d.total)}
      ${cp1251LinhaHTML(coral, "↑", "Enviadas por você", `${pct(d.enviadas)} do total`, d.enviadas)}
      ${cp1251LinhaHTML(ciano, "↓", "Recebidas dos clientes", `${pct(d.recebidas)} do total`, d.recebidas)}
    </div>
    ${cp1251GraficoHTML(d.porDia)}
  </section>`;
}

// Celular: só a linha de resumo. Toque abre o painel inteiro por cima.
function cp1251RenderResumo(){
  const el = qs("#cpMesResumo");
  if(!el) return;
  try{
    const d = cp1251Dados();
    el.innerHTML = `<button type="button" class="cp1251-resumo" onclick="cp1251AbrirPainel()">
      <span class="cp1251-resumo-txt">
        <b>${cp1251Num(d.atendidosMes)} atendidos · ${cp1251Num(d.total)} mensagens</b>
        <small>${escapeHtml(d.mesNome.charAt(0).toUpperCase() + d.mesNome.slice(1))}, do dia 1 até hoje · toque pra ver tudo</small>
      </span>
      <span class="cp1251-resumo-seta" aria-hidden="true">›</span>
    </button>`;
  }catch(_){ el.innerHTML = ""; }
}

function cp1251AbrirPainel(){
  qs("#cp1251Modal")?.remove();
  const ov = document.createElement("div");
  ov.id = "cp1251Modal";
  ov.className = "cp1251-modal";
  ov.innerHTML = `<div class="cp1251-folha">
    <div class="cp1251-folha-topo">
      <button type="button" class="cp1251-voltar" id="cp1251Fechar">‹ Voltar</button>
      <b>Seu mês</b><span style="width:56px"></span>
    </div>
    ${cp1251PainelHTML(cp1251Dados(), { semTitulo:true })}
  </div>`;
  document.body.appendChild(ov);
  qs("#cp1251Fechar")?.addEventListener("click", () => ov.remove(), { once:true });
  ov.addEventListener("click", (e) => { if(e.target === ov) ov.remove(); });
}
window.cp1251AbrirPainel = cp1251AbrirPainel;

// Botão WhatsApp padrão (mesmo em todas as telas).

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
  // v1098 — DOIS relatos do dono no mesmo dia, e a causa é a MESMA:
  //
  //   1) "por que Aguardando cliente aparece com mais dos 14 dias pré-definidos?" (viu 16 e 18)
  //   2) "sem atender 30+ ... veja os dias ao lado, isso é incoerente, não tá funcionando meus
  //      filtros" (a lista de 30d+ mostrando 1 dia, 12 dias, e fora de ordem)
  //
  // Os FILTROS estavam certos nos dois casos. Quem mentia era a COLUNA: ela mostrava sempre
  // "dias desde a última MENSAGEM" (daysSinceLastInteraction), enquanto cada uma dessas listas é
  // definida por outra régua — o último ATENDIMENTO marcado. São números diferentes, e postos
  // lado a lado do título da lista faziam ela parecer quebrada:
  //
  //   • "Aguardando cliente": o descanso conta do seu último atendimento (regra única, v1052).
  //     Cliente calado há 18 dias que você atendeu há 3 está corretamente em espera.
  //   • A lista "sem atender 30d+" (apagada na v1246) tinha o mesmo defeito: um lead nunca
  //     atendido que mandou mensagem ontem aparecia como "1 dia", e a ordem, feita pela data de
  //     atendimento, parecia bagunçada porque o número exibido era outro.
  //
  // Agora cada lista mostra O NÚMERO QUE A DEFINE, com o título certo em cima.
  // v1265 — "Parado há" passou a contar o ÚLTIMO TOQUE REAL, não só a última mensagem do WhatsApp.
  //
  // Caso do dono (Carteira ativa): "Dani De Sm — PARADO HÁ 100 dias", quando o próprio histórico
  // do cliente mostra uma mensagem que ELE mandou em 28/07 (17 dias antes). A coluna usava
  // daysSinceLastInteraction, que só enxerga mensagem importada do WhatsApp e ignora o que o app
  // registra quando o corretor copia a sugestão e manda ("Mensagem enviada (você)"). Ou seja: o
  // app sabia do toque, mostrava esse toque no histórico logo abaixo, e mesmo assim dizia 100 dias.
  //
  // diasParado já é a régua certa e já existia — é a que o ranking usa desde sempre ("desde o
  // último toque REAL: mensagem OU atendimento marcado"). A coluna só não a usava. O caso
  // "atendido hoje" continua com o texto de sempre.
  const COLUNA_PADRAO = {
    titulo: "Parado há",
    valor: (l) => {
      if(ehContatadoHoje(l)) return '<i>atendido hoje</i>';
      const dp = (typeof diasParado === "function") ? diasParado(l) : Infinity;
      const d = Number.isFinite(dp) ? dp : (l.daysSinceLastInteraction != null ? l.daysSinceLastInteraction : null);
      return d != null ? `<small class="lgt-rot">parado há</small><b>${d}</b> ${d === 1 ? "dia" : "dias"}` : "—";
    }
  };
  const diasDesdeAtendimento = (l) => {
    const ts = (typeof ultimoAtendimentoTs === "function") ? ultimoAtendimentoTs(l) : 0;
    return ts ? diasCalendarioBR(ts) : null;
  };
  // v1101 — CONTAGEM DE DIAS SAIU. VIRAM DATAS.
  //
  // O dono olhou a Silvana — atendida ONTEM — e leu "14 dias" ao lado do nome dela como se a
  // conversa tivesse 14 dias parados. A conta estava certa (14 dias de descanso, volta no dia
  // seguinte ao 14º), mas isso não importa: um número solto de dias, na mesma linha de um nome de
  // cliente, vai ser lido como "faz tanto tempo que não falo com ele". Sempre.
  //
  // No celular era pior ainda, porque o cabeçalho da tabela é escondido — o número aparecia sem
  // legenda nenhuma.
  //
  // Corretor trabalha com DATA, não com contagem regressiva. "Volta 15/08" ninguém lê errado.
  const dataBRcurta = (ts) => {
    try{
      return new Intl.DateTimeFormat("pt-BR", { timeZone:"America/Sao_Paulo", day:"2-digit", month:"2-digit" }).format(new Date(ts));
    }catch(_){ return ""; }
  };
  const COLUNAS_POR_GRUPO = {
    // QUANDO ele volta pra fila — a resposta de "por que ele ainda está aqui?".
    __aguardando: {
      titulo: "Volta dia",
      valor: (l) => {
        const ts = (typeof ultimoAtendimentoTs === "function") ? ultimoAtendimentoTs(l) : 0;
        const desde = diasDesdeAtendimento(l);
        const prazo = (typeof limiarRetomada === "function") ? limiarRetomada(l) : null;
        if(!ts || desde == null || prazo == null) return COLUNA_PADRAO.valor(l);
        // Volta no dia seguinte ao último dia de descanso (mesma regra de emJanelaDeEspera).
        const volta = dataBRcurta(ts + (prazo + 1) * 86400000);
        const quando = desde === 0 ? "atendido hoje" : desde === 1 ? "atendido ontem" : `atendido há ${desde} dias`;
        return `<small class="lgt-rot">volta dia</small><b>${volta}</b><small class="lgt-sub">${quando}</small>`;
      }
    }
  };
  const coluna = COLUNAS_POR_GRUPO[grupo] || COLUNA_PADRAO;

  const linhaGrupo = (l, pos) => {
    const idJs = JSON.stringify(String(l.id||""));
    const interesse = produtosLabel(l) || "Não identificado";
    let passo = "";
    try{ passo = cp786ResumoAcao(l) || ""; }catch(_){ passo = ""; }
    let dias = "—";
    try{ dias = coluna.valor(l) || "—"; }catch(_){ dias = "—"; }
    return `<button type="button" class="lgt-row" onclick='abrirLead(${idJs})'>
      <span class="lgt-pos">${pos}</span>
      <span class="lgt-cli"><span class="lgt-nm">${escapeHtml(l.name||"Cliente")}</span><small>${escapeHtml(interesse)}</small></span>
      <span class="lgt-passo">${escapeHtml(passo)}</span>
      <span class="lgt-dias">${dias}</span>
      <span class="lgt-chev">›</span>
    </button>`;
  };
  const tabelaGrupo = (leads, posInicial) => `<div class="lgt">
    <div class="lgt-th"><span>#</span><span>Cliente</span><span class="lgt-passo">Próximo passo</span><span class="lgt-dias">${escapeHtml(coluna.titulo)}</span><span></span></div>
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
    const badgeContato = contatado ? `<span title="Contato registrado hoje" style="display:inline-block;padding:1px 7px;border-radius:999px;font-size:9px;font-weight:950;color:var(--acao);background:var(--acao-soft);border:1px solid var(--acao);letter-spacing:.04em">✓ CONTATADO HOJE</span>` : "";
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
  // v1218 — a régua ("bom dia até 11h59, boa tarde até 17h59, boa noite a partir das 18h") saiu
  // daqui pra js/saudacao.js, pra ser a MESMA usada na correção das sugestões de mensagem.
  const saud = saudacaoAgora() || "Olá";
  // v1007 — prioridade do nome: o que o corretor escreveu no Cérebro > o nome da conta
  // logada (preenchido no cadastro) > "corretor" genérico.
  const corretorNome = (cpNomeCorretorCerebro() || window.__cpContaNome || "").trim().split(/\s+/)[0] || "";
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
      // v1097 — o dono viu "Fazer agora: 0" num sábado e perguntou "por que isso? porque é
      // sábado?". Ou seja: a mensagem dizia que hoje ele não atende, mas não deixava claro que
      // isso é uma CONFIGURAÇÃO DELE, nem onde mudar. Essa dica só existia na outra versão da
      // frase (a de quando ainda não tinha atendido ninguém) — justamente a que ele não viu.
      // Agora as duas explicam de onde vem a regra e como mudá-la.
      ? `<span class="destaque">Hoje você não atende.</span> ${tratadosHoje} atendido${tratadosHoje>1?"s":""} hoje mesmo assim — a fila volta ${cpProximoDiaDeAtendimento()}. Dá pra mudar seus dias no Cérebro.`
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
    html = `<span class="destaque">Mandou bem!</span> ${tratadosHoje} lead${tratadosHoje>1?"s":""} atendido${tratadosHoje>1?"s":""} hoje.`;
  } else {
    html = `Sem urgências agora. Bom momento pra prospectar.`;
  }
  setAll("block", html);
}

// v1268 — AQUI EXISTIA UMA PRIMEIRA VERSÃO DE renderResumoDia, MORTA HÁ MUITO TEMPO (47 linhas).
//
// Ela era declarada aqui e SUBSTITUÍDA mais abaixo no próprio arquivo (`renderResumoDia = function`
// …), que é a versão que a Home usa de verdade. O corpo antigo nunca chegava a rodar — e ainda
// assim varria TODOS os leads a cada carregamento somando seis contadores (quentes, mornos,
// frios, esfriando, aguardando ação, lembretes do dia) que ninguém lia: os elementos que os
// mostravam saíram da tela em versões anteriores. Trabalho puro à toa numa carteira de 200 leads.
//
// A declaração `let renderResumoDia` abaixo mantém o nome existindo antes da atribuição real.
let renderResumoDia = () => {};

// v1215 — FONTE ÚNICA da agenda do dia. O número do sino e as listas da tela Agenda saíam de dois
// pedidos de código diferentes e por isso divergiam: a Agenda deixou de mostrar quem já foi
// atendido hoje (v1199) e o sino continuou contando essa pessoa. Resultado que o dono viu na tela:
// sino avisando 2 com um único lembrete listado no dia. Agora as duas telas leem daqui.
// Recebe SÓ leads ativos (sem geladeira) — quem chama já filtra.
function cpAgendaDoDia(items){
  const iniHojeA = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const fimHojeA = (() => { const d = new Date(); d.setHours(23,59,59,999); return d.getTime(); })();
  // Lembrete com data de HOJE (lead ativo) → seção "de hoje" (é o que o número do topo conta).
  // v1199 — faltava a mesma proteção que "Atrasados" (cp786CompromissoAtrasado) já tinha: quem
  // foi atendido hoje sai da lista do dia. Sem isso, marcar atendimento não tirava o lembrete
  // de hoje da Agenda (relato do dono: atendeu dois clientes marcados pra hoje e eles continuaram
  // aparecendo) — o lembrete só some se for excluído ou reagendado à mão, mesmo já resolvido.
  const lembretesHoje = items.filter(l => {
    if(typeof ehContatadoHoje === 'function' && ehContatadoHoje(l)) return false;
    const t = lembreteTs(l); return !isNaN(t) && t >= iniHojeA && t <= fimHojeA;
  });
  lembretesHoje.sort((a,b) => lembreteTs(a) - lembreteTs(b));
  // Compromissos confirmados — todos, agrupados por urgência
  const compHoje = [], compAmanha = [], compFuturo = [];
  for(const l of items){
    const aps = l.analysis?.confirmedAppointments;
    if(!Array.isArray(aps)) continue;
    // v1199 — mesma correção do lembrete de hoje, logo acima: um compromisso de HOJE some da
    // lista assim que o cliente é atendido hoje (compromisso de outro dia não é afetado).
    const atendidoHoje = typeof ehContatadoHoje === 'function' && ehContatadoHoje(l);
    for(const ap of aps){
      const q = String(ap.quando||"").toLowerCase();
      if(/\bhoje\b/.test(q)){ if(!atendidoHoje) compHoje.push({ ...l, _ap: ap }); }
      else if(/amanh[ãa]/.test(q)) compAmanha.push({ ...l, _ap: ap });
      else compFuturo.push({ ...l, _ap: ap });
    }
  }
  // v1011 — "Atrasados": lembrete ou compromisso com data vencida em até 60 dias, de lead ativo
  // ainda não atendido hoje (a régua mora em cp786CompromissoAtrasado).
  const atrasados = items
    .map(l => ({ l, at: (typeof cp786CompromissoAtrasado === 'function') ? cp786CompromissoAtrasado(l) : null }))
    .filter(x => x.at);
  atrasados.sort((a,b) => a.at.dias - b.at.dias);
  return { lembretesHoje, compHoje, compAmanha, compFuturo, atrasados };
}
window.cpAgendaDoDia = cpAgendaDoDia;

// Chave de um cliente pra contagem: o sino conta PESSOAS, não linhas. Quem tem lembrete de hoje
// E compromisso de hoje é um cliente só esperando por você — contar 2 seria o mesmo susto que o
// dono relatou na v1215.
function cpChaveLead(l){ return String(l?.id || l?.phone || l?.name || ''); }

// Atualiza o SINO do topo + o nº da Agenda (compromissos/lembretes de HOJE). Extraído pra rodar
// em QUALQUER tela: sem isso, excluir/reagendar um lembrete fora da Home não mexia no sino até dar F5.
// Recebe a lista já carregada (opcional) pra não rebuscar; senão pega do cache (fresco quando quem
// chama invalidou antes).
async function atualizarSinoAgenda(leadsAll){
  let all = leadsAll;
  if(!Array.isArray(all)){
    try{ const data = await getLeadsData(); all = (data?.items || []).map(limparLead); }catch(_){ return; }
  }
  const ativos = all.filter(l => normalizarEtapa(l.etapa) !== ETAPA_ARQUIVADO);
  const { lembretesHoje, compHoje, atrasados } = cpAgendaDoDia(ativos);
  // v1093 — compromisso ATRASADO passa a acender o sino. Antes o pontinho só olhava a agenda de
  // HOJE: quem tinha um compromisso vencido (e nada marcado pra hoje) não via aviso nenhum no
  // topo — o item mais urgente do app era justamente o único invisível.
  const atrasadosIds = new Set(atrasados.map(x => cpChaveLead(x.l)));
  const hojeIds = new Set();
  for(const l of [...lembretesHoje, ...compHoje]){
    const k = cpChaveLead(l);
    if(!atrasadosIds.has(k)) hojeIds.add(k); // já está sendo cobrado como atrasado: não conta duas vezes
  }
  const atrasadosN = atrasadosIds.size;
  const agendaN = hojeIds.size;
  state.agendaAtrasados = atrasadosN;
  state.agendaCount = agendaN + atrasadosN;
  // v1227 — o título da aba conta o MESMO número do sino (antes cada um fazia a própria conta e
  // divergiam; ver o comentário em renderResumoDia, de onde este contador saiu).
  document.title = state.agendaCount > 0 ? `(${state.agendaCount}) Corretor Pro` : "Corretor Pro";
  const badgeAgT = qs("#btnAgendaTopoCount"); if(badgeAgT) badgeAgT.textContent = agendaN;
  // v1232 — o TOTAL da agenda (mesma régua do antigo card da Home: cpAgendaContagem, que bate com
  // a tela Agenda desde a v931) vai pro calendário do bloco do topo. Atualiza junto com o sino
  // pra nunca existirem dois relógios (lição das v1215/v1227).
  const totalTopoEl = qs("#cpAgTotalN");
  if(totalTopoEl){ try{ totalTopoEl.textContent = String(cpAgendaContagem(ativos)); }catch(_){} }
  // v787/v1205: o sino mostra só o aviso da agenda de hoje (e o número de atrasados).
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

    // v1166 — `force` aqui sempre quis dizer DUAS coisas ao mesmo tempo: "não use o retrato que
    // já está na memória" e "vá na rede de novo". Nas duas sincronizações (tique de fundo e volta
    // pra aba) isso fazia a carteira ser baixada DUAS VEZES seguidas — uma pra lista, outra pro
    // painel, com segundos de diferença e o mesmo conteúdo. Era metade do tráfego que sobrou.
    // Agora essas duas passam `"reaproveitar"`: refazem as contas com o dado recém-baixado, sem
    // uma segunda ida ao banco. `true` continua significando as duas coisas, pra todo o resto.
    const data = await getLeadsData(force === true);
    if(data && data.ok === false){
      const foco = qs("#leadFocoArea");
      if(foco && !state.itemsAtivos?.length && !state.grupoAtivo){
        foco.innerHTML = `<div class="card compact"><div class="empty" style="padding:24px 16px;text-align:center;color:var(--muted)">Reconectando… puxando seus leads. <button type="button" onclick="invalidarLeadsCache();carregarDashboard()" style="margin-left:6px;background:transparent;border:1px solid var(--line);border-radius:999px;padding:4px 12px;color:var(--lime);font-weight:950;cursor:pointer">Tentar agora</button></div></div>`;
      }
      setTimeout(() => { if(state.active === "home") carregarDashboard(); }, 3000);
      return;
    }
    _processarDashboard(data);
    // v1135 — só aqui, no caminho que REALMENTE foi ao servidor. _processarDashboard também é
    // chamado com uma cópia da própria memória (o atalho logo acima), e carimbar lá dentro faria
    // a memória velha se declarar em dia.
    cpCarteiraSincronizada();
  }catch(err){
    console.warn("carregarDashboard:", err);
    // v1161 — "fica 'carregando os leads...' faz 5 min e nada" (dono, 06/08/2026, logo depois de
    // uma importação que não terminou). CAUSA REAL: quando a busca da carteira FALHA DE VEZ
    // (getLeadsData esgota as tentativas e estoura o erro), este catch só anotava no console — a
    // tela ficava com o "Carregando os leads…" congelado pra sempre, sem botão e sem nova
    // tentativa. O caminho irmão (resposta ok:false, logo acima) sempre teve as duas coisas; o
    // caminho do ERRO não tinha nenhuma. Mesma recuperação agora: aviso com botão + tenta de novo
    // sozinho em 6s (um pouco mais de espaço que os 3s do ok:false, porque aqui a falha foi de
    // rede/tempo, não uma resposta rápida do servidor).
    const foco = qs("#leadFocoArea");
    const aindaCarregando = foco && /Carregando os leads|Sua carteira está demorando|Ainda buscando/i.test(foco.textContent || "");
    if(aindaCarregando && !state.itemsAtivos?.length && !state.grupoAtivo){
      foco.innerHTML = `<div class="card compact"><div class="empty" style="padding:24px 16px;text-align:center;color:var(--muted)">A busca da sua carteira falhou (rede ou servidor ocupado). Vou tentar de novo sozinho. <button type="button" onclick="invalidarLeadsCache();carregarDashboard()" style="margin-left:6px;background:transparent;border:1px solid var(--line);border-radius:999px;padding:4px 12px;color:var(--lime);font-weight:950;cursor:pointer">Tentar agora</button></div></div>`;
      // A retentativa só se arma quando a tela está mesmo presa no carregamento — carteira já
      // desenhada não precisa de laço próprio (a sincronização de fundo de 30s já cobre). O
      // unref é pros testes de Node, que rodam esta função de verdade: sem ele, o timer segura
      // o processo aberto pra sempre (foi exatamente o que travou a suíte na primeira rodada).
      const t = setTimeout(() => { if(state.active === "home" && !state.itemsAtivos?.length) carregarDashboard(); }, 6000);
      if(t && typeof t.unref === "function") t.unref();
    }
  }
}
async function _processarDashboard(data){
  if(!data?.items) return;
  try{
    const all = (data?.items || []).map(limparLead);
    const items = all.filter(l => { const e = normalizarEtapa(l.etapa); return e !== ETAPA_ARQUIVADO; });
    state.itemsAtivos = items;
    state.todosLeads = all;
    try{ window.cpAtualizarSinoAtencao?.(); }catch(_){}
    // v1138 — atualiza o retrato que o lembrete diário lê. v1190: são ações com data registrada
    // (compromisso atrasado + dose de "Fazer agora"), nunca "clientes esperando resposta".
    try{ cpAtualizarRetratoAcoes(all); }catch(_){}
    // Contagem da Agenda permanece separada do aviso do sino.
    // agora no helper atualizarSinoAgenda (reusado ao excluir/reagendar lembrete, pra refletir sem F5).
    atualizarSinoAgenda(all);
    // Radar da Geladeira: badge do Menu desativado (dono não quer aviso).
    const badgeGel = qs("#arquivadosRevisitarBadge");
    if(badgeGel) badgeGel.style.display = "none";
    // Total de leads ativos no pill do topo (mobile).
    const pillTotalD = qs("#pillTotalLeadsDesktop");
    if(pillTotalD) pillTotalD.textContent = `${items.length} lead${items.length===1?"":"s"}`;
    // v1149 — corretor NOVO (nenhum cliente ainda): o passo a passo de como mandar a conversa do
    // WhatsApp abre sozinho, uma única vez. É o momento em que ele não sabe o que fazer — e é
    // exatamente o que o dono pediu pra vender pra corretores de Android ("ele vai ter que ter uma
    // explicação, alguma forma dele entender"). Depois de visto, só volta pelo botão da tela de
    // importação.
    if(!items.length){ try{ window.cp1149AbrirSePrimeiraVez?.(); }catch(_){} }
    renderSaudacao(items);
    renderResumoDia(items);
    // v928 — removido cálculo morto de "vendas do mês"/"vendas da semana" (o dono não marca
    // Vendido no app — só Arquivar, decisão da v904 — então isso nunca refletia a realidade).
    // Alimentava só #kpiVendas/#kpiVendasValor/state.resumoSemana, nenhum dos três lido em
    // lugar nenhum da tela: dado morto calculado à toa em todo carregamento do dashboard.
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
          <div class="card compact" style="background:linear-gradient(135deg,rgba(255,98,88,.04),rgba(86,199,242,.04));border:1px solid var(--line)">
            <div style="padding:28px 20px">
              <h2 class="title" style="font-size:22px;margin:0 0 8px;text-align:center">Comece pelo WhatsApp</h2>
              <div class="small" style="color:var(--soft);margin:0 auto 22px;line-height:1.6;text-align:center;max-width:520px">
                O Corretor Pro não entra nas suas conversas — quem envia é você, e leva 20 segundos.<br>
                <b>O WhatsApp não guarda conversa exportada</b>: você exporta e manda pro Corretor Pro no mesmo gesto.
              </div>
              <ol style="margin:0 auto;padding:0;max-width:560px;list-style:none">
                ${cpPassosImportar().map((p, i) => `
                  <li style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)">
                    <span style="flex:0 0 26px;height:26px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-weight:950;font-size:12px;display:flex;align-items:center;justify-content:center">${i + 1}</span>
                    <span class="small" style="line-height:1.6;color:var(--soft);flex:1;min-width:0">${p}</span>
                  </li>`).join("")}
              </ol>
              <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line);text-align:center">
                <div class="small" style="color:var(--muted);margin-bottom:10px">Já exportou e salvou o arquivo no aparelho?</div>
                <button type="button" class="btn secondary pickZipShortcut" style="padding:12px 24px;font-size:14px">Escolher o arquivo da conversa</button>
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

// v1210 — exportada porque a tela da importação passou a dizer se o cadastro parecido está ativo
// ou arquivado (js/importacao.js). A regra de o que conta como arquivado continua morando só aqui.
export function normalizarEtapa(raw){
  const bruto = String(raw || "").trim();
  const s = bruto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  // v1105 — auditoria do backup real (298 registros): 244 tinham um TEXTO de análise da IA
  // gravado no lugar da etapa ("Acompanhamento do andamento no cartório..."). Só ETIQUETA CURTA
  // pode arquivar (dado legado: "Vendido", "Perdido", "Geladeira") — um texto longo que por
  // acaso contenha "fechado"/"desistiu" no meio da frase JAMAIS pode arquivar um cliente que o
  // corretor não mandou arquivar.
  if(bruto.length <= 40 && /vendido|venda concluida|venda fechada|perdido|desistiu|recusou|geladeira|arquivad|fechado/.test(s)) return ETAPA_ARQUIVADO;
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
      return true;
    } else if(cpLeadJaNaoExiste(res, data)){
      cpSumirComLeadFantasma(id);
      return true;
    } else {
      toast("Erro: " + (data?.error || ""));
    }
  }catch(err){ toast("Erro: "+(err?.message||err)); }
  // v1125 — devolve se o lead saiu mesmo. Quem chama usa isso pra decidir se leva o corretor de
  // volta pra Home: cancelar a confirmação ou tomar erro não pode tirá-lo da tela do cliente.
  return false;
}
window.apagarLead = apagarLead;

// v1099 — o dono mandou print: apertava apagar e voltava "Erro: Lead não encontrado", de novo e de
// novo, sem o cliente nunca sair da tela.
//
// "Não encontrado" quer dizer que o cadastro JÁ NÃO ESTÁ no banco (foi apagado antes, ou virou um
// só com outro na reimportação) — mas a lista carregada no aparelho ainda tinha a cópia dele. Ou
// seja: o app pedia pra apagar algo que já não existe, e o servidor, com razão, recusava.
//
// Ficar repetindo o erro é o pior dos dois mundos: o que o corretor quer (o cliente fora da lista)
// JÁ É VERDADE no banco. Então o app tira o fantasma da tela e diz o que aconteceu.
function cpLeadJaNaoExiste(res, data){
  if(res && res.status === 404) return true;
  return /n[ãa]o encontrad/i.test(String(data?.error || ""));
}
function cpSumirComLeadFantasma(id){
  try{ removerLeadDosCaches(id); }catch(_){}
  try{ invalidarLeadsCache(); }catch(_){}
  if(String(state.focoLeadId||"") === String(id) || String(state.lead?.id||"") === String(id)){
    // v1125 — era show("home") puro, que deixava o MODO DETALHE ligado: a Home voltava escondida
    // e com o fantasma ainda desenhado na tela (ver cpVoltarProHomeSemLead).
    try{ cpVoltarProHomeSemLead(); }catch(_){ state.lead = null; state.focoLeadId = null; state.analysis = null; }
  }
  try{ loadRecentLeads(true); }catch(_){}
  try{ refreshAllSections(); }catch(_){}
  toast("Esse cliente já não existia mais no banco. Tirei ele da lista.");
}

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
    dica = `<div style="margin-bottom:12px;padding:9px 11px;background:rgba(86,199,242,.06);border:1px solid var(--timing);border-radius:8px;font-size:11px;color:var(--soft);line-height:1.4"><b style="color:var(--timing)">Atenção:</b> o sistema não identificou o nome. Coloque o nome real.</div>`;
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
        <div style="border-top:1px solid var(--line);padding-top:12px;margin-bottom:12px">
          <button type="button" id="editLeadJuntar" style="width:100%;padding:10px;background:transparent;color:var(--text);border:1px solid var(--line);border-radius:10px;font-size:13px;font-weight:950;cursor:pointer">Juntar com outro cadastro</button>
          <div class="small" style="color:var(--muted);font-size:10px;margin-top:5px">Só para o caso raro em que a mesma pessoa ficou com dois cadastros de nomes bem diferentes — ao receber a conversa o app já reconhece e pergunta sozinho.</div>
        </div>
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
  // v1187 — a fusão manual da v1148 ficou sem porta de entrada desde que foi feita (o painel onde
  // o botão morava não era desenhado). Ela NÃO ganha um botão na tela do cliente: lá o corretor
  // não tem como saber que existe repetido — quem sabe é o app, e ele já avisa na importação
  // ("Pode ser o mesmo cliente que já existe: 'Fulano'. É o mesmo cliente?"). Isto aqui é só a
  // saída manual pro caso que aquela pergunta não pega: dois cadastros da mesma pessoa com nomes
  // bem diferentes. Fica em Editar, junto do resto que administra o cadastro.
  qs("#editLeadJuntar")?.addEventListener("click", () => { fecharEditarLead(); cp1148JuntarCliente(String(id), nome || ""); });
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
        <div><small>Novo atendimento</small><h3 id="ui677ManualTitle">Incluir lead manualmente</h3><p>Cadastre sem enviar uma conversa do WhatsApp.</p></div>
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
  const apagou = await apagarLead(id, nome);
  // Volta pra Home depois de excluir — de verdade, com cabeçalho, cartões e listas de volta.
  // v1125 — só sai da tela do lead se ele foi mesmo apagado: antes ia pra Home até quando o
  // corretor clicava "Cancelar" na confirmação (ou quando dava erro), perdendo a tela à toa.
  if(apagou) cpVoltarProHomeSemLead();
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
      removerLeadDosCaches(id);
      // v1125 — era state.lead=null + show("home"), que deixava o MODO DETALHE ligado e a Home
      // aparecia vazia/travada com o lead apagado ainda desenhado (ver cpVoltarProHomeSemLead).
      cpVoltarProHomeSemLead();
      if(typeof carregarDashboard === "function") carregarDashboard();
    } else if(cpLeadJaNaoExiste(res, data)){
      // v1099 — mesma regra do apagarLead: se já não existe no banco, some da tela em vez de
      // ficar repetindo erro num cliente que o corretor não consegue tirar da frente.
      cpSumirComLeadFantasma(id);
    } else {
      toast("Erro ao excluir: " + (data?.error || ""));
    }
  }catch(err){ toast("Erro ao excluir: "+(err?.message||err)); }
}
window.excluirLeadDefinitivo = excluirLeadDefinitivo;

// v1148 — JUNTAR DOIS CADASTROS DO MESMO CLIENTE.
//
// Caso do dono (05/08/2026): ele atendeu um cliente e a lista de quem estava sem atender (apagada
// na v1246) seguia mostrando a MESMA pessoa num segundo cadastro, com outro nome. Isso nasce quando o arquivo exportado do
// WhatsApp vem com nome diferente em cada importação. Até aqui o app só sabia APAGAR duplicata —
// e apagar perde a conversa de um dos dois. Agora dá pra juntar: a conversa dos dois vira uma só
// (sem repetir mensagem), o cadastro escolhido fica, o outro sai.
window.cp1148JuntarCliente = async function(idFica, nomeFica){
  const id = String(idFica||"");
  if(!id){ toast("Não consegui identificar este cliente."); return; }
  let base = [];
  try{
    const dados = await getLeadsData(false);
    base = (Array.isArray(dados?.items) ? dados.items : []).map(limparLead).filter(l => l?.id && String(l.id) !== id);
  }catch(_){ base = []; }
  if(!base.length){ toast("Não achei outros clientes pra juntar."); return; }
  document.querySelector("#cp1148Modal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "cp1148Modal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:flex-end;justify-content:center;padding:0";
  const linha = (l) => `<button type="button" class="cp1148-item" data-id="${escapeHtml(String(l.id))}" data-nome="${escapeHtml(String(l.name||"Cliente"))}" style="width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--text);padding:13px 14px;font-size:14px;font-weight:800;cursor:pointer">${escapeHtml(String(l.name||"Cliente"))}<span style="display:block;color:var(--muted);font-size:12px;font-weight:500;margin-top:2px">${escapeHtml(String(l.product||"Produto não identificado"))} · ${Number(l.messageCount||0)} mensagens</span></button>`;
  overlay.innerHTML = `
    <div style="background:var(--panel);border-top-left-radius:18px;border-top-right-radius:18px;width:100%;max-width:520px;max-height:82vh;display:flex;flex-direction:column">
      <div style="padding:16px 16px 10px">
        <div style="font-size:17px;font-weight:950">Juntar cliente duplicado</div>
        <div class="small" style="color:var(--muted);margin-top:4px">Escolha o cadastro que é a MESMA pessoa que <b>${escapeHtml(String(nomeFica||"este cliente"))}</b>. As duas conversas viram uma só; este cadastro fica e o outro é apagado.</div>
        <input id="cp1148Busca" placeholder="Buscar por nome..." style="margin-top:10px;width:100%">
      </div>
      <div id="cp1148Lista" style="overflow:auto;flex:1;border-top:1px solid var(--line)">${base.slice(0,60).map(linha).join("")}</div>
      <div style="padding:12px 16px"><button type="button" id="cp1148Cancelar" class="btn secondary" style="width:100%">Cancelar</button></div>
    </div>`;
  document.body.appendChild(overlay);
  const fechar = () => overlay.remove();
  overlay.querySelector("#cp1148Cancelar")?.addEventListener("click", fechar);
  overlay.addEventListener("click", (ev) => { if(ev.target === overlay) fechar(); });
  const busca = overlay.querySelector("#cp1148Busca");
  const lista = overlay.querySelector("#cp1148Lista");
  const norm = (v) => String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  busca?.addEventListener("input", () => {
    const q = norm(busca.value).trim();
    const filtrados = q ? base.filter(l => norm(l.name).includes(q)) : base;
    lista.innerHTML = filtrados.slice(0,60).map(linha).join("") || `<div class="small" style="padding:16px;color:var(--muted)">Nenhum cliente com esse nome.</div>`;
  });
  lista?.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".cp1148-item");
    if(!btn) return;
    const idSai = String(btn.dataset.id||"");
    const nomeSai = String(btn.dataset.nome||"cliente");
    const msg = `Juntar "${nomeSai}" dentro de "${nomeFica||"este cliente"}"?\n\nAs duas conversas ficam num cadastro só. O cadastro "${nomeSai}" é apagado depois de juntar. Não tem como desfazer.`;
    const ok = (typeof cp903Confirm === "function")
      ? await cp903Confirm({ titulo:"Juntar clientes", mensagem: msg, ok:"Juntar", perigo:true })
      : confirm(msg);
    if(!ok) return;
    btn.disabled = true;
    try{
      const res = await fetchComTimeout("./api/lead-update", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"juntar-clientes", id, idDuplicado: idSai })
      }, 45000);
      const d = await res.json().catch(()=>({}));
      if(!res.ok || !d?.ok) throw new Error(d?.error || "Não foi possível juntar agora.");
      fechar();
      removerLeadDosCaches(idSai);
      invalidarLeadsCache();
      toast(`Juntado: ${Number(d.mensagensTrazidas)||0} mensagens trazidas, ${Number(d.mensagensFinais)||0} no total.`);
      if(d.avisoDuplicado) toast(d.avisoDuplicado);
      await loadRecentLeads(true);
      try{ await abrirLead(id); }catch(_){ refreshAllSections(); }
    }catch(err){
      btn.disabled = false;
      toast("Não consegui juntar: " + userFriendlyError(err));
    }
  });
};

export async function abrirLead(id, options={}){
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
      if(String(state.focoLeadId) !== sid) return;
      // v1229 — se o corretor está com o painel "Agendar" aberto (muito provavelmente com o
      // calendário/relógio nativo do celular na tela), remontar agora fecharia o calendário na
      // cara dele — era o "toco na data e fecha sozinho" relatado no celular. Espera o painel
      // fechar (confirmar/fechar já remontam por conta própria) e tenta de novo.
      const cpAgPainelAberto = document.querySelector('#ui670SchedulePanel');
      if(cpAgPainelAberto && !cpAgPainelAberto.hidden){ setTimeout(aplicarCompleto, 1500); return; }
      aplicarLead(completo);
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
  "cliente-final": { txt:"Cliente final", cor:"var(--dados)", bg:"rgba(86,199,242,.12)" },
  "corretora-parceira": { txt:"Corretora parceira (B2B)", cor:"var(--cerebro)", bg:"rgba(155,140,255,.14)" },
  "indicacao": { txt:"Indicação", cor:"var(--lime)", bg:"rgba(255,98,88,.12)" },
  "outro": { txt:"Tipo indefinido", cor:"var(--muted)", bg:"rgba(255,255,255,.06)" }
};

function badgeTipoContato(t){
  const cfg = TIPO_CONTATO_LABEL[t];
  if(!cfg){
    // Sem tipo definido ainda — mostra placeholder pra usuário poder marcar manualmente
    return `<span title="Tipo não definido — clique pra marcar" id="badgeTipoContato" style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;color:var(--muted);background:transparent;border:1px dashed var(--line);letter-spacing:.02em;cursor:pointer">Definir tipo</span>`;
  }
  return `<span title="Tipo de contato — clique pra mudar" id="badgeTipoContato" style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:950;color:${cfg.cor};background:${cfg.bg};border:1px solid ${cfg.cor};letter-spacing:.02em;cursor:pointer">${cfg.txt}</span>`;
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

// Volta da tela do lead: se veio de um grupo, retorna pro grupo; senão, pra home dos botões.
// v1026 — o botão "Voltar" usava history.back(), que pode levar pra QUALQUER coisa que
// estivesse antes na pilha do navegador (outro lead, outra tela) — o dono pediu, mais de uma
// vez, que "Voltar" sempre volte pra Home (ou pro grupo aberto dentro dela), nunca "pra última
// ação". Agora sempre limpa o lead e renderiza a Home direto, sem depender do histórico do
// navegador, e substitui a rota salva por uma de Home (pra um refresh logo em seguida também
// não achar um lead salvo).
// v1125 — relato do dono: "depois que excluir um lead, ele deve voltar a tela da home, e não
// ficar travado ali sem fazer nada."
//
// Causa: abrir um lead liga o MODO DETALHE (ui667ModoDetalheLead) — isso põe a classe
// lead-foco-aberto no body E um display:none!important direto no cabeçalho da Home, nos cartões
// de números, no top3 e na coluna lateral. Excluir apenas zerava state.lead/focoLeadId e chamava
// show("home"), e NADA disso desliga o modo detalhe: a Home voltava a ser a tela ativa, mas com
// tudo escondido, e a área do lead ainda com o cliente que acabou de ser apagado. Da parte do
// corretor, é uma tela morta.
//
// Este é o mesmo caminho do botão "Voltar" (voltarDoLead), com uma diferença de propósito: NÃO
// volta pra lista de onde o lead veio (ele não existe mais lá) — volta pra Home, que é o que o
// dono pediu.
function cpVoltarProHomeSemLead(){
  try{ if(typeof cp7ObsPararGravacaoSeAtiva === "function") cp7ObsPararGravacaoSeAtiva(); }catch(_){}
  cpClearLeadState();      // zera o lead E desliga o modo detalhe (devolve cabeçalho e cartões)
  state.grupoAtivo = null; // Home de verdade, não a lista de onde o lead tinha sido aberto
  show("home", { skipHistory:true });
  renderBotoesHome();
  cpReplaceRoute(cpRouteForScreen("home"));
}
window.cpVoltarProHomeSemLead = cpVoltarProHomeSemLead;

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

// v1268 (2ª passada) — DUAS FUNCIONALIDADES QUE FICARAM SEM BOTÃO (e continuam aqui, de propósito).
//
// "Aprender da carteira" e "Importar telefones (CSV)" só eram alcançáveis pelo menu do "+" da barra
// de baixo (abrirMaisAcoes), que saiu nesta faxina por estar órfão — o "+" abre o cadastro manual
// direto há versões. Ou seja: as duas estão sem porta de entrada na tela.
//
// NÃO foram apagadas porque isso é decisão do dono, não minha: são recursos de verdade (um lê a
// carteira pra alimentar o aprendizado, o outro traz telefones de uma planilha), e a v905 registrou
// que a importação de telefones deveria continuar existindo. Estão aqui esperando a resposta dele:
// religar num botão, ou apagar de vez.
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
      const msgTel = `Vou preencher o telefone de ${aplicar.length} ${pl(aplicar.length, "lead", "leads")} que ${pl(aplicar.length, "estava", "estavam")} sem número. Confirmar?`;
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
      toast(`✓ ${ok} ${pl(ok, "telefone preenchido", "telefones preenchidos")}${erro?` · ${erro} ${pl(erro, "falhou", "falharam")}`:""}.`);
      if(typeof loadRecentLeads === "function") loadRecentLeads();
    }catch(err){ toast("Erro ao importar: " + (err?.message||err)); }
  };
  inp.click();
}
window.importarTelefonesCSV = importarTelefonesCSV;

// v1268 (2ª passada) — SEIS FUNÇÕES ÓRFÃS DE TELA TAMBÉM SAÍRAM:
//   · mostrarTratadosHoje — abria a lista de quem foi "tratado hoje" a partir de um quadradinho da Home que não existe mais.
//   · abrirMaisAcoes — era o menu do "+" da barra de baixo; hoje o "+" abre direto o cadastro manual (abrirNovoLead).
//   · abrirDesempenhoInsights — modal de "Desempenho + Insights" chamado por um item de menu que saiu.
//   · verListaHoje — botão do modal de insights (que saiu junto); apontava pro grupo "acao-hoje", que também não existe mais.
//   · toggleAgendar — abria/fechava a caixa #agendarbox_<id>, que nenhuma tela desenha desde que o painel de agendar foi refeito.
//   · abrirAtendimentosFiltro — filtro da Carteira acionado por botões que saíram da tela.
// Todas tinham "ponte" pro HTML (window.x = x) e nenhuma era chamada por botão, menu ou código —
// a ponte sozinha não é uso: é só o que permitiria um onclick existir.
//
// v1268 (2ª passada) — "ATENDER EM SEQUÊNCIA (ESTEIRA)" REMOVIDO (5 funções, ~35 linhas).
// Abria a fila do dia um cliente por vez, com "Próximo" entre um e outro. Os botões que
// chamavam isso saíram da tela em versões passadas (a Home foi refeita) e sobraram só as funções
// e as pontes pro HTML — nada no app publicado as chama. O modo de trabalho hoje é a lista do
// "Fazer agora" com o "Atender +1".


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
      .cp704-lead{display:flex;flex-direction:column;gap:14px;padding-bottom:20px;width:100%;max-width:1180px;margin:0 auto;color:var(--text)}.cp704-workspace{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.82fr);gap:14px;align-items:start}.cp704-primary,.cp704-secondary{display:flex;flex-direction:column;gap:14px;min-width:0}.cp704-secondary .cp704-accordions{width:100%}.cp704-herorow{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,.85fr);gap:14px;align-items:stretch}.cp704-obscard{gap:6px}.cp704-obscard textarea{width:100%;box-sizing:border-box}.cp704-tools-open .cp704-card-title{margin-bottom:12px}.cp704-tools-row{display:flex;flex-wrap:wrap;gap:10px}.cp704-tools-row button{flex:1 1 160px;min-width:140px;min-height:54px;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));color:var(--text);font-weight:900;font-size:13px;letter-spacing:.01em;cursor:pointer;transition:transform .06s ease,border-color .15s,box-shadow .15s,background .15s}.cp704-tools-row button:hover{border-color:rgba(255,255,255,.3);box-shadow:0 8px 22px rgba(0,0,0,.24);transform:translateY(-1px)}.cp704-tools-row button:active{transform:translateY(0);box-shadow:0 3px 10px rgba(0,0,0,.2)}.cp704-tools-row button.good{border-color:var(--acao-line);background:linear-gradient(180deg,var(--acao-soft),var(--acao-soft));color:var(--acao)}.cp704-tools-row button.good:hover{border-color:var(--acao);box-shadow:0 8px 22px var(--acao-soft)}.cp704-tools-row button.cp704-danger{border-color:rgba(255,98,88,.42);background:linear-gradient(180deg,rgba(255,98,88,.12),rgba(255,98,88,.04));color:var(--risco)}.cp704-tools-row button.cp704-danger:hover{border-color:rgba(255,98,88,.7);box-shadow:0 8px 22px rgba(255,98,88,.16)}.cp704-hist-inline{flex:1 1 160px;min-width:140px;align-self:flex-start;padding:0;border:0;background:transparent}.cp704-hist-inline[open]{flex-basis:100%}.cp704-hist-inline>summary{list-style:none;display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));color:var(--text);font-weight:900;font-size:13px;cursor:pointer;white-space:nowrap;transition:transform .06s ease,border-color .15s,box-shadow .15s}.cp704-hist-inline>summary:hover{border-color:rgba(255,255,255,.3);box-shadow:0 8px 22px rgba(0,0,0,.24);transform:translateY(-1px)}.cp704-hist-inline>summary::-webkit-details-marker{display:none}.cp704-hist-inline[open]>summary .cp704-hist-arrow{transform:rotate(180deg)}.cp704-hist-inline .cp704-body{margin-top:10px;max-height:340px;overflow:auto;width:100%}
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
      /* v1216 — o fundo e a borda continuavam com o verde cravado (a v1214 só trocou a cor do
         texto), então o botão seguia esverdeado no print do dono. Agora os três vêm do token. */
      .cp704-ico.done{background:var(--acao-soft);border-color:var(--acao-line);color:var(--acao)}
.cp704-ico-danger{color:var(--risco);border-color:rgba(255,98,88,.4)}.cp704-ico-danger:hover{color:var(--risco);border-color:rgba(255,98,88,.75);background:rgba(255,98,88,.08)}
.cp704-hist-card .cp704-hist-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.cp704-hist-card .cp704-copy-history{border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--soft);border-radius:10px;padding:7px 12px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}
      .cp704-ico-loading{opacity:.6;pointer-events:none}
      .cp704-ico-loading svg{animation:cp704-spin 1s linear infinite}
      @keyframes cp704-spin{to{transform:rotate(360deg)}}
      @media (prefers-reduced-motion:reduce){.cp704-ico-loading svg{animation:none}}
      .cp704-attended:not(:disabled){cursor:pointer}.cp704-attended:disabled{opacity:1;background:var(--acao-soft);border-color:var(--acao-line);color:var(--acao)}
      .cp704-hero{border:1px solid rgba(255,255,255,.10);background:linear-gradient(135deg,rgba(7,52,64,.92),rgba(5,31,40,.96));border-radius:18px;padding:15px;box-shadow:0 14px 45px rgba(0,0,0,.20)}
      .cp704-hero h1{font-size:28px;line-height:1.04;margin:0 0 8px;font-weight:950;letter-spacing:-.03em;color:var(--text)}
      .cp704-tags{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.cp704-tag{font-size:11px;color:var(--muted);background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.075);padding:5px 8px;border-radius:999px;font-weight:850}
      .cp704-mainrow{display:grid;grid-template-columns:1fr;gap:12px;align-items:center}.cp704-situation{display:flex;flex-direction:column;gap:8px}.cp704-pill{display:inline-flex;align-items:center;gap:6px;width:max-content;max-width:100%;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:950;border:1px solid rgba(184,194,201,.45);background:rgba(184,194,201,.10);color:var(--soft)}.cp704-pill.green{border-color:var(--acao-line);background:var(--acao-soft);color:var(--acao)}.cp704-pill.red{border-color:rgba(255,98,88,.45);background:rgba(255,98,88,.10);color:var(--risco)}.cp704-situation p{margin:0;color:rgba(237,246,248,.92);font-size:14px;line-height:1.45}.cp704-etapa{gap:7px}.cp704-etapa .cp704-etapa-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;display:inline-block;box-shadow:0 0 0 3px rgba(255,255,255,.05)}
      .cp704-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px;padding-top:13px;border-top:1px solid rgba(255,255,255,.08)}.cp704-metric{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;color:rgba(237,246,248,.92)}.cp704-metric small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:1px}
      .cp704-card{border:1px solid rgba(255,255,255,.10);background:rgba(7,52,64,.72);border-radius:16px;padding:14px}.cp704-card-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.cp704-card-title h2{font-size:17px;margin:0;font-weight:950}.cp704-card-title small{font-size:11px;color:var(--muted);font-weight:850}
      .cp704-last{display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:center;color:rgba(237,246,248,.95);font-size:13px}.cp704-last b{font-weight:950}.cp704-last span{display:block;color:var(--muted);font-size:12px;margin-top:2px}
      .cp704-ai ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}.cp704-ai li{display:grid;grid-template-columns:20px 1fr;gap:8px;line-height:1.35;color:rgba(237,246,248,.92);font-size:14px}.cp704-ai i{font-style:normal;color:var(--acao);font-weight:950}
      .cp704-step{margin:0}.cp704-step p{margin:0;font-size:14px;line-height:1.45;color:rgba(237,246,248,.94)}.cp704-metaline{margin-top:12px;padding-top:11px;border-top:1px solid rgba(255,255,255,.08);color:var(--soft);font-size:12px;line-height:1.4;font-weight:700}.cp704-metaline+.cp704-metaline{margin-top:2px;padding-top:0;border-top:0}.cp704-msg-sub{margin:15px 0 9px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.14em;font-weight:950}
      .cp704-msg-list{display:flex;flex-direction:column;gap:10px}.cp704-msg-item{display:grid;grid-template-columns:1fr auto;gap:9px 12px;align-items:start;padding:12px;border:1px solid rgba(255,255,255,.085);border-radius:14px;background:rgba(255,255,255,.025)}.cp704-msg-head{grid-column:1/-1;display:flex;align-items:center;gap:8px}.cp704-msg-head b{font-size:12px;font-weight:950;color:rgba(237,246,248,.96)}.cp704-num{width:22px;height:22px;border-radius:999px;background:var(--lime);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:950;flex:0 0 auto}.cp704-msg-item:nth-child(2) .cp704-num{background:#ff8f88}.cp704-msg-item:nth-child(3) .cp704-num{background:#ff5e52}.cp704-msg-item p{margin:0;font-size:13px;line-height:1.45;color:rgba(237,246,248,.93)}.cp704-copy{align-self:center;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.035);color:var(--text);border-radius:10px;padding:8px 12px;font-size:11px;font-weight:900;cursor:pointer;min-width:72px}.cp704-copy:hover{border-color:rgba(255,98,88,.55);background:rgba(255,98,88,.08)}.cp704-msg-item.cp704-msg-copiada{border-color:rgba(255,98,88,.75);background:rgba(255,98,88,.12)}.cp704-msg-item.cp704-msg-copiada .cp704-copy{border-color:transparent;background:var(--lime);color:#fff}.cp704-empty-analysis{border:1px solid rgba(184,194,201,.35);background:rgba(184,194,201,.07);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px}.cp704-empty-analysis b{color:var(--soft)}.cp704-empty-analysis span{color:var(--muted);font-size:13px}.cp704-empty-analysis button{border:1px solid rgba(184,194,201,.45);background:rgba(255,255,255,.04);color:var(--soft);border-radius:12px;padding:11px;font-weight:950;margin-top:4px}
      .cp704-accordions{display:flex;flex-direction:column;gap:9px}.cp704-details{border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(7,52,64,.58);overflow:hidden}.cp704-details summary{list-style:none;cursor:pointer;padding:13px 14px;font-size:14px;font-weight:950;display:flex;align-items:center;justify-content:space-between;gap:10px}.cp704-details summary::-webkit-details-marker{display:none}.cp704-details summary:after{content:"⌄";color:var(--muted);flex:0 0 auto}.cp704-details[open] summary:after{content:"⌃"}.cp704-summary-left{display:inline-flex;align-items:center;gap:8px;min-width:0}.cp704-summary-actions{display:inline-flex;align-items:center;gap:10px;margin-left:auto}.cp704-copy-history{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.045);color:var(--text);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:950;cursor:pointer;white-space:nowrap}.cp704-copy-history:hover{border-color:rgba(255,98,88,.55);background:rgba(255,98,88,.10)}.cp704-body{padding:0 14px 14px;color:rgba(237,246,248,.92);font-size:13px;line-height:1.45}.cp704-timeline{display:flex;flex-direction:column;gap:0}.cp704-tmsg{display:grid;grid-template-columns:14px 1fr;gap:9px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.075)}.cp704-tmsg-comundo{grid-template-columns:14px 1fr auto;align-items:start}.cp704-tmsg-undo{flex:0 0 auto;align-self:start;margin-top:2px;width:26px;height:26px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:var(--muted);font-size:13px;font-weight:900;line-height:1;cursor:pointer;padding:0}.cp704-tmsg-undo:hover{border-color:rgba(255,98,88,.6);background:rgba(255,98,88,.14);color:var(--lime)}.cp704-dot{width:8px;height:8px;border-radius:50%;background:#8aa1ad;margin-top:6px}.cp704-dot.you{background:var(--lime)}.cp704-dot.obs{background:var(--cyan)}.cp704-dot.sys{background:#8aa1ad;opacity:.45}.cp704-dot.prop{background:var(--accent)}.cp704-tmsg-obs b{color:var(--cyan)!important;text-transform:uppercase;letter-spacing:.06em;font-size:10px!important}.cp704-tmsg-obs p{color:rgba(210,239,255,.92)}.cp704-tmsg-sys b{color:var(--muted)!important}.cp704-tmsg-prop{cursor:pointer}.cp704-tmsg-prop b{color:var(--accent)!important;text-transform:uppercase;letter-spacing:.06em;font-size:10px!important}.cp704-prop-hint{display:block;color:var(--accent)!important;font-weight:800!important;margin-top:2px}.cp704-tmsg b{font-size:12px}.cp704-tmsg p{margin:2px 0 3px}.cp704-tmsg small{color:var(--muted);font-size:11px}.cp704-full-btn{width:100%;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.03);color:var(--text);border-radius:10px;padding:10px;margin-top:10px;font-weight:900;cursor:pointer}.cp704-conducao{margin-top:12px}.cp704-conducao-txt{margin:0 0 10px;font-size:14px;line-height:1.5;color:var(--text);font-weight:700}.cp704-rows{display:flex;flex-direction:column}.cp704-row{padding:9px 0;border-bottom:1px solid rgba(255,255,255,.075)}.cp704-row small{display:block;text-transform:uppercase;letter-spacing:.13em;color:var(--muted);font-size:9px;font-weight:950;margin-bottom:3px}.cp704-row div{font-size:13px;color:rgba(237,246,248,.94)}
      .cp704-actions-group{margin-top:10px}.cp704-actions-group h3{font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted);margin:0 0 7px}.cp704-actions-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cp704-actions-grid button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);color:var(--text);border-radius:11px;padding:10px 8px;font-size:12px;font-weight:900;cursor:pointer}.cp704-actions-grid button.good{border-color:var(--acao-line);color:var(--acao)}.cp704-actions-grid button.warn{border-color:rgba(184,194,201,.35);color:var(--soft)}.cp704-actions-grid button.bad{border-color:rgba(255,98,88,.42);color:var(--risco)}.cp704-danger{width:100%;border:1px solid rgba(255,98,88,.55)!important;color:var(--risco)!important;background:rgba(255,98,88,.06)!important}.cp704-quickbar{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cp704-quickbar button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);color:var(--text);border-radius:11px;padding:10px 8px;font-size:12px;font-weight:900;cursor:pointer}.cp704-quickbar button.good{color:var(--acao);border-color:var(--acao-line)}
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
  // v1259 — "Não identificado"/"Nenhum" não vira linha na tela: linha vazia é pior que linha
  // ausente, porque ocupa espaço dizendo que não sabe.
  function cp704Semvalor(v){ const t=cp704Text(v); return /^(nenhum|não identificado|nao identificado)$/i.test(t) ? '' : t; }

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


  function cp705MessagesReady(msgs){
    const vals=[msgs?.a,msgs?.b,msgs?.c].map(cp705PlainText);
    if(vals.some(v=>!v)) return false;
    return !vals.some(v=>/atualize a an[aá]lise comercial|gerar a resposta|resposta recomendada|resposta mais suave|resposta mais direta/i.test(v));
  }

  function cp704Modelo(lead){ try{return ui670ModeloComercial(lead)||{};}catch(_){return lead?.analysis?.modeloComercial||{};} }
  function cp704Produto(lead, mc){ return cp704Text(mc?.oportunidade?.produto || (typeof produtosLabel==='function'?produtosLabel(lead):lead?.product) || lead?.product || 'Produto não identificado'); }
  // v1210 — O BOTÃO QUE FALTAVA DENTRO DO LEAD ARQUIVADO (pedido do dono, 11/08/2026).
  //
  // "Reativar" só existia na lista da tela Arquivados. Quem achasse o cliente pela busca da Home
  // (que mostra os arquivados com a etiqueta ARQUIVADO) e abrisse o lead ficava sem saída: a barra
  // de cima oferecia "Arquivar" — o que ele já era — e nada mais. Agora o mesmo lugar da barra
  // mostra "Arquivar" quando o lead está ativo e "Reativar" quando está arquivado.
  function cp704BotaoEtapa(lead){
    const idJs = JSON.stringify(String(lead?.id || ''));
    const arquivado = (typeof normalizarEtapa === 'function') && normalizarEtapa(lead?.etapa) === ETAPA_ARQUIVADO;
    if(arquivado){
      // Caixa de arquivo com a seta PRA CIMA: tirar de dentro da caixa, o contrário do arquivar.
      return `<button type="button" class="cp704-ico" onclick='reativarLeadArquivado(${idJs},this)' title="Reativar — volta pros atendimentos ativos"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M12 18v-6M9 15l3-3 3 3"/></svg><span class="lb">Reativar</span></button>`;
    }
    return `<button type="button" class="cp704-ico" onclick='arquivarLead(${idJs},${safeJson(lead?.name||'')})' title="Arquivar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/></svg><span class="lb">Arquivar</span></button>`;
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
      // v1197 — "copiei sem querer, não mandei": mensagem que o APP registrou quando você copiou
      // ganha um X pra desfazer. Só aparece nessas (type "mensagem_enviada"): fala que veio da
      // conversa exportada do WhatsApp é registro do que aconteceu de verdade e não se apaga aqui.
      // v1237 — o mesmo ✕ passou a valer pra OBSERVAÇÃO que você escreveu ("quero opção de apagar
      // a última mensagem, assim posso reanalisar de novo"). Observação entra na análise como fato
      // confirmado e pesa muito no diagnóstico — uma escrita/ditada errada empurrava a análise
      // inteira e não tinha como tirar. Continua valendo só pro que o APP registrou: fala vinda da
      // conversa exportada do WhatsApp é registro do que aconteceu e não se apaga por aqui.
      const ehObsApagavel = tipo==='observacao_manual';
      const podeDesfazer = (ehEnviada || ehObsApagavel) && String(m?.iso || '');
      const btnDesfazer = podeDesfazer
        ? (ehObsApagavel
          ? `<button type="button" class="cp704-tmsg-undo" title="Apagar esta observação" aria-label="Apagar esta observação" onclick='event.stopPropagation();cp704ApagarObservacao(${JSON.stringify(String(lead?.id||''))},${JSON.stringify(String(m.iso||''))})'>✕</button>`
          : `<button type="button" class="cp704-tmsg-undo" title="Não enviei essa mensagem — desfazer" aria-label="Desfazer esta mensagem" onclick='event.stopPropagation();cp704DesfazerMensagemEnviada(${JSON.stringify(String(lead?.id||''))},${JSON.stringify(String(m.iso||''))})'>✕</button>`)
        : '';
      return `<div class="cp704-tmsg${wrapCls}${podeDesfazer?' cp704-tmsg-comundo':''}"${propAttr}><span class="cp704-dot ${dotCls}"></span><div><b>${escapeHtml(who)}</b><p>${escapeHtml(cp704Text(m.text))}</p><small>${escapeHtml(cp704DataHora(m))}</small>${propHint}</div>${btnDesfazer}</div>`;
    }).join('') + btn;
  }
  // v1238 — TIRA A LINHA APAGADA DA CÓPIA QUE ESTÁ NA TELA, na hora.
  //
  // Bug real (prints do dono, 12/08/2026): ele apagou uma observação, o aviso disse "Observação
  // apagada", o contador do card caiu de 3 pra 2 — e a observação CONTINUOU na lista. Tocando o ✕
  // dela de novo vinha "Essa observação não está mais no histórico". Ou seja: sumiu do servidor,
  // ficou na tela.
  //
  // A causa está em recarregarLeadFoco: a LISTA de leads traz só um recorte das mensagens, então
  // existe lá uma proteção que diz "se a cópia local tem MAIS mensagens que a que veio agora,
  // fica com a local" (senão a barra de interesse despencava de 108 pra 4 ao marcar atendimento).
  // Depois de APAGAR, essa proteção é exatamente o contrário do certo: a cópia local tem mais
  // mensagens justamente porque ainda tem a que acabou de ser apagada — e ela voltava.
  //
  // Consertado na origem: quem apaga tira a linha da cópia local ANTES de recarregar. Aí a
  // proteção continua fazendo o que sempre fez (preservar o histórico completo) sem nunca
  // ressuscitar o que o corretor acabou de apagar.
  function cp7TiraDaTimelineLocal(leadId, iso){
    if(!state.lead || String(state.lead.id) !== String(leadId)) return;
    const antes = Array.isArray(state.lead.recentMessages) ? state.lead.recentMessages : [];
    const depois = antes.filter(m => String(m?.iso || '') !== String(iso));
    if(depois.length === antes.length) return;
    state.lead.recentMessages = depois;
    // O total mostrado no card vem daqui quando o histórico completo ainda não foi carregado.
    if(Number.isFinite(Number(state.lead.messageCount))){
      state.lead.messageCount = Math.max(0, Number(state.lead.messageCount) - 1);
    }
  }
  // v1197 — DESFAZER UMA MENSAGEM COPIADA MAS NÃO ENVIADA.
  //
  // Relato do dono (10/08/2026, com print): "quero ver como podemos fazer pra deletar essa
  // resposta que acabei copiando mas não mandei, foi sem querer". Copiar registra três coisas de
  // uma vez — a mensagem no histórico, o atendimento do dia e a marca de uso do Desempenho —, e a
  // mais cara delas é o atendimento: ele tira o cliente da fila por dias. Por isso o desfazer é
  // um só, e cuida das três (a decisão de quando desfazer o atendimento fica no servidor, em
  // api/reanalisar-lead.js, ação "desfazer-mensagem-enviada").
  window.cp704DesfazerMensagemEnviada = async function(leadId, iso){
    if(!leadId || !iso){ toast('Não consigo identificar essa mensagem.'); return; }
    const aviso = 'Ela sai do histórico deste cliente. Se foi a única que você copiou hoje, o atendimento de hoje também é desfeito e o cliente volta pra fila.';
    const ok = (typeof cp903Confirm === 'function')
      ? await cp903Confirm({ titulo: 'Não enviei essa mensagem', mensagem: aviso, ok: 'Desfazer', cancelar: 'Cancelar', perigo: true })
      : confirm(aviso);
    if(!ok) return;
    try{
      const res = await fetch('./api/reanalisar-lead', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payloadComCerebro({ id: leadId, action:'desfazer-mensagem-enviada', iso }))
      });
      const d = await res.json().catch(()=>({}));
      if(!d?.ok) throw new Error(d?.error || 'não consegui desfazer');
      cp7TiraDaTimelineLocal(leadId, iso);
      try{ invalidarLeadsCache(); }catch(_){}
      try{ invalidarLeadDetail(leadId); }catch(_){}
      toast(d.atendimentoDesfeito
        ? 'Mensagem removida. O atendimento de hoje foi desfeito.'
        : 'Mensagem removida do histórico.');
      try{ await loadRecentLeads(false); }catch(_){}
      try{ await recarregarLeadFoco(leadId); }catch(_){}
    }catch(err){ toast('Não consegui desfazer: ' + (err?.message || err)); }
  };
  // v1237 — APAGAR UMA OBSERVAÇÃO (pedido do dono: "quero opção de apagar a última mensagem,
  // assim posso reanalisar de novo"). Depois de apagar, a tela oferece reanalisar na hora — que é
  // o motivo de ele querer apagar: rodar a análise de novo sem aquela observação no meio.
  window.cp704ApagarObservacao = async function(leadId, iso){
    if(!leadId || !iso){ toast('Não consigo identificar essa observação.'); return; }
    const aviso = 'Ela sai do histórico deste cliente e deixa de contar na próxima análise. Se for a única observação de hoje, o atendimento de hoje também é desfeito e o cliente volta pra fila.';
    const ok = (typeof cp903Confirm === 'function')
      ? await cp903Confirm({ titulo: 'Apagar esta observação', mensagem: aviso, ok: 'Apagar', cancelar: 'Cancelar', perigo: true })
      : confirm(aviso);
    if(!ok) return;
    try{
      const res = await fetch('./api/reanalisar-lead', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payloadComCerebro({ id: leadId, action:'apagar-observacao', iso }))
      });
      const d = await res.json().catch(()=>({}));
      if(!d?.ok) throw new Error(d?.error || 'não consegui apagar');
      cp7TiraDaTimelineLocal(leadId, iso);
      try{ invalidarLeadsCache(); }catch(_){}
      try{ invalidarLeadDetail(leadId); }catch(_){}
      toast(d.atendimentoDesfeito
        ? 'Observação apagada. O atendimento de hoje foi desfeito.'
        : 'Observação apagada do histórico.');
      try{ await loadRecentLeads(false); }catch(_){}
      try{ await recarregarLeadFoco(leadId); }catch(_){}
    }catch(err){ toast('Não consegui apagar: ' + (err?.message || err)); }
  };
  // v1025 — abre a proposta salva na timeline (busca o snapshot em state.lead.recentMessages
  // pelo mesmo `iso` da mensagem clicada e delega pro abridor real em js/proposta.js).
  window.cp704AbrirPropostaSalva = function(leadId, iso){
    const lead = (state.lead && String(state.lead.id) === String(leadId)) ? state.lead : null;
    const m = (Array.isArray(lead?.recentMessages) ? lead.recentMessages : []).find(x => x?.iso === iso && x?.proposta);
    if(!m){ toast('Não encontrei os dados dessa proposta pra reabrir.'); return; }
    if(typeof window.abrirPropostaSalva === 'function') window.abrirPropostaSalva(leadId, cp704Text(lead?.name), m.proposta);
    else toast('Gerador de proposta indisponível nesta versão.');
  };
  // v1146 — a opção copiada continua marcada depois do redesenho (ver cp704CopyMsg). Só vale pro
  // MESMO cliente e enquanto o texto daquela opção for o mesmo que foi copiado: análise nova
  // troca as mensagens, e mensagem diferente não pode herdar a marca da anterior.
  function cp704FoiCopiada(lead,k,texto){
    const c = window.cp704Copiada;
    if(!c || !texto) return false;
    if(String(c.leadId||'') !== String(lead?.id||'')) return false;
    if(String(c.key||'') !== String(k)) return false;
    const norm = (v) => String(v||'').replace(/\s+/g,' ').trim();
    return norm(c.texto) === norm(texto);
  }
  function cp704MarcaCopiada(lead,k,texto){ return cp704FoiCopiada(lead,k,texto) ? ' cp704-msg-copiada' : ''; }
  function cp704RotuloCopiar(lead,k,texto){ return cp704FoiCopiada(lead,k,texto) ? 'Copiado' : 'Copiar'; }
  // v1239 — "analise toda conversa, e sugira conduções de atendimento... TUDO é sobre isso, e é o
  // q menos esta sendo aplicado" (dono, 12/08/2026). A leitura que a IA faz da conversa antes de
  // escrever qualquer mensagem passou a APARECER aqui: o que o cliente quer, onde a conversa
  // parou, o que o tempo mudou, a condição que ele colocou, e como conduzir agora.
  //
  // Mostrar isso não é enfeite: é o que deixa ele conferir se o sistema ENTENDEU a conversa, em
  // vez de julgar só pelas três mensagens. E é o que faz a leitura respeitar a regra da v1145
  // ("se não aparece na tela, não precisa existir") — ela aparece.
  function cp704ConducaoHtml(lead){
    const L = lead?.analysis?.leituraDaConversa;
    if(!L || typeof L !== 'object') return '';
    const conduzir = cp704Text(L.comoConduzir);
    const linhas = [
      ['O que o cliente quer', L.oQueOClienteQuer],
      ['Onde a conversa parou', L.ondeParou],
      ['O que mudou no tempo', L.oQueMudouNoTempo],
      ['Condição que o cliente colocou', /^nenhuma$/i.test(cp704Text(L.condicaoDoCliente)) ? '' : L.condicaoDoCliente]
    ].filter(r => cp704Text(r[1]));
    if(!conduzir && !linhas.length) return '';
    return `<section class="cp704-card cp704-conducao">
      <div class="cp704-card-title"><h2>Como conduzir este atendimento</h2></div>
      ${conduzir?`<p class="cp704-conducao-txt">${escapeHtml(conduzir)}</p>`:''}
      ${linhas.length?`<div class="cp704-rows">${linhas.map(([k,v])=>`<div class="cp704-row"><small>${escapeHtml(k)}</small><div>${escapeHtml(cp704Text(v))}</div></div>`).join('')}</div>`:''}
    </section>`;
  }
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
      // v1259 — o que a CONVERSA já respondeu. Antes isso ficava só dentro da cabeça da IA e ela
      // mesma esquecia: o dono flagrou as três sugestões pedindo a faixa de valor que a própria
      // conversa já delimitava. Mostrando na tela ele confere o que foi entendido e cobra o que
      // faltou. Cada linha só aparece quando tem conteúdo (o filtro logo abaixo).
      ['Faixa de valor que a conversa já indica',cp704Semvalor(a?.diagnostico?.faixaDeValor)],
      ['Imóvel do cliente na negociação',cp704Semvalor(a?.diagnostico?.imovelDoCliente)],
      ['Por que ele quer mudar',cp704Semvalor(a?.diagnostico?.motivoDaMudanca)],
      ['Quem decide junto',cp704Semvalor(a?.diagnostico?.quemDecide)],
      ['O cliente já contou',Array.isArray(a?.diagnostico?.jaSabemos)?a.diagnostico.jaSabemos.filter(Boolean).join(' · '):''],
      // v1271 — o pedido que partiu do próprio cliente (o critério que ele levantou sozinho, o mais
      // valioso da conversa) e a pauta que ainda falta levantar — que é assunto do encontro, não
      // interrogatório por mensagem.
      ['O que o cliente pediu por conta própria',cp704Semvalor(a?.diagnostico?.pedidoEspontaneo)],
      ['O que ainda falta descobrir',Array.isArray(a?.diagnostico?.faltaDescobrir)?a.diagnostico.faltaDescobrir.filter(Boolean).join(' · '):''],
      ['Preferências',mem.preferencias]
    ].filter(r=>cp704Text(r[1]));
    return rows.map(([k,v])=>`<div class="cp704-row"><small>${escapeHtml(k)}</small><div>${escapeHtml(cp704Text(v))}</div></div>`).join('') || '<div class="empty">Sem detalhes comerciais consolidados.</div>';
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
  function cp704GetMessage(k){ const el=document.querySelector(`.cp704-msg-item[data-key="${k||window.cp704SelectedMsg}"] p`); return cp704Text(el?.innerText || el?.textContent); }
  window.cp704CopyMsg=async function(k){
    const msg=cp704GetMessage(k); if(!msg){toast('Mensagem não encontrada.');return;}
    // v1146 — MARCA DA OPÇÃO COPIADA.
    //
    // Antes, o que ficava coral depois do toque era só o efeito do próprio botão pressionado — e
    // a v1142, ao redesenhar o cliente na hora (pra mostrar "Atendido"), trocava o botão por um
    // novo e apagava esse coral. O dono notou na primeira vez que usou ("por que não ficou
    // vermelho o 'copiar' quando clico, como era antes?").
    //
    // Agora a marca é de verdade, não efeito de toque: fica guardada e é reaplicada em cada
    // redesenho — a opção copiada aparece destacada e o botão dela diz "Copiado". Guardando o
    // TEXTO copiado, a marca não sobrevive a uma análise nova (mensagem diferente no mesmo lugar
    // não pode continuar marcada como copiada).
    window.cp704Copiada = { leadId: String(state.lead?.id || ''), key: k || window.cp704SelectedMsg || 'a', texto: msg };
    try{
      const item = document.querySelector(`.cp704-msg-item[data-key="${window.cp704Copiada.key}"]`);
      if(item){
        item.classList.add('cp704-msg-copiada');
        const b = item.querySelector('.cp704-copy');
        if(b) b.textContent = 'Copiado';
      }
    }catch(_){}
    try{ await navigator.clipboard.writeText(msg); toast('Mensagem copiada.'); }
    catch(_){ const ta=document.createElement('textarea');ta.value=msg;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Mensagem copiada.'); }
    const leadId=state.lead?.id;
    // v1097 — o dono relatou (com print): copiou a sugestão, a opção ficou marcada em coral, mas
    // o ATENDIMENTO não foi marcado — e "só marca às vezes, na segunda vez que copia".
    //
    // Causa: copiar disparava DUAS gravações em sequência, e a do atendimento era a SEGUNDA. Só
    // que copiar é justamente o momento em que o corretor sai do app pra colar no WhatsApp — e um
    // app em segundo plano no celular tem os pedidos de rede cortados pelo sistema. A primeira
    // gravação (a contagem do Desempenho, que é o detalhe menos importante) consumia a janela
    // segura, e a que realmente importa saía tarde demais, morrendo no caminho. Copiar de novo,
    // já olhando pra tela, funcionava — daí a intermitência.
    //
    // Duas correções:
    //  1. O ATENDIMENTO vai PRIMEIRO. Se só uma sobreviver, que seja a que importa.
    //  2. As duas usam keepalive, que manda o navegador terminar o pedido mesmo com o app no
    //     fundo ou fechado. É pra isso que ele existe.
    //
    // Continuam em sequência (nunca em paralelo) de propósito: as duas gravam no MESMO campo do
    // cliente, lendo antes de escrever — em paralelo, uma apagaria a outra.
    try{ await registrarMensagemEnviada(leadId, msg); }catch(_){}
    if(leadId){
      try{
        const r = await fetch("./api/lead-update", {
          method:"POST", headers:{"Content-Type":"application/json"}, keepalive:true,
          body: JSON.stringify({ id:leadId, action:"aprendizado", evento:"mensagem_copiada", detalhes:{ de:"fazer_agora", opcao:k||window.cp704SelectedMsg||'a' } })
        }).catch(()=>null);
        // v1097 — o contador "Mensagens copiadas" do Desempenho era gravado ANTES do atendimento
        // justamente pra já estar salvo quando a lista recarregasse. Agora que o atendimento vem
        // primeiro (ele é o que não pode se perder), a lista recarrega antes deste número existir.
        // Em vez de voltar à ordem antiga, atualiza a lista DE NOVO aqui: o atendimento fica
        // protegido e o Desempenho continua certo na hora.
        if(r && r.ok){ invalidarLeadsCache(); loadRecentLeads(true); }
      }catch(_){}
    }
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
  // v1186/v1187 — aqui existia `cp704QuickActions`, um painel com três grupos (Comerciais /
  // Gestão / Perigo) que a v908 parou de desenhar quando as ações principais subiram pra barra de
  // ícones do topo. Ele ficou no arquivo sem tela, e a v1148 acrescentou "Juntar cliente
  // duplicado" dentro dele — por isso esse botão nunca apareceu.
  //
  // A v1186 tentou consertar devolvendo o painel. O dono derrubou na hora, com razão:
  //
  //   "Como é que eu vou saber, dentro do lead, se ele é duplicado ou não? Isso só funcionaria se
  //    ele me mostrasse: nome tal e tal, é a mesma pessoa? Daí eu clico sim ou não e unifica.
  //    (...) Pra que mais um botão excluir definitivamente se ele já tem lá em cima em editar?"
  //
  // Os dois estavam certos, e o segundo motivo é ainda mais forte que o primeiro: O APP JÁ FAZ
  // ISSO, em três camadas, e nenhuma delas passa por um botão na tela do cliente —
  //
  //   1. o SERVIDOR junta na importação (api/_persistence.js, _buscarProcessamentoExistenteV681):
  //      reconhece o mesmo cliente por telefone, nome do arquivo e nome, e reaproveita o cadastro;
  //   2. quando o nome é só PARECIDO, a importação PERGUNTA na tela, com os dois nomes: "Pode ser
  //      o mesmo cliente que já existe: 'Fulano'. É o mesmo cliente?" (ver acharLeadExistente e o
  //      #pendingBox mais abaixo neste arquivo) — exatamente o fluxo de sim/não que faz sentido,
  //      no único momento em que o corretor tem os dois cadastros na frente;
  //   3. a LISTA agrupa cópias num card só (dupeIds, montado em listRecentProcessings).
  //
  // E "Excluir definitivamente" já existe em Editar lead → Zona perigosa → "Excluir este lead".
  //
  // Ou seja: o painel não tinha o que devolver. Foi removido de vez. Lição registrada: código
  // órfão não é automaticamente uma feature perdida — antes de religar, conferir se o produto já
  // resolve aquilo por outro caminho.
  // v908: as ações (Proposta/Arquivar/Mensagens) subiram pra barra de ícones do topo.
  // O histórico ("Últimas mensagens") abre num card recolhível, alternado pelo ícone "Mensagens".
  window.cp704ToggleHistorico=function(){
    const s=document.querySelector('#cp704HistCard'); if(!s) return;
    s.hidden=!s.hidden;
    if(!s.hidden) s.scrollIntoView({behavior:'smooth',block:'start'});
  };

// Atualização #724-2: card "O que mudou" — antes → agora + por que importa.
// Só aparece quando a análise traz mudanças reais; lead sem mudança não mostra o card.

// v1108 — decisão comercial do dono: bater no limite do teste grátis vira momento de venda.
// O servidor manda `upgrade: { whatsapp }` junto do aviso; aqui vira o botão verde que abre a
// conversa no WhatsApp comercial já com a mensagem pronta. Conta paga não recebe `upgrade`.
export function cpUpgradeProHTML(a){
  const fone = String(a?.upgrade?.whatsapp || "").replace(/\D/g, "");
  if(a?.mode !== "limite_diario_excedido" || !fone) return "";
  // v1110 — o servidor manda o rótulo e a mensagem certos pra cada degrau (teste → Pro →
  // Pro Master → plano maior); os textos fixos abaixo são só reserva de compatibilidade.
  const rotulo = String(a?.upgrade?.botao || "Falar no WhatsApp e liberar o Pro");
  const msg = encodeURIComponent(String(a?.upgrade?.mensagemWhats || "Olá! Atingi o limite de análises do teste grátis do Corretor Pro e quero contratar o pacote Pro."));
  return `<div style="margin-top:12px;padding:12px;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.45);border-radius:12px">`+
    `<div class="small" style="margin-bottom:10px"><b>Quer continuar analisando?</b> Fale direto com a gente e libere na hora:</div>`+
    `<a href="https://wa.me/${fone}?text=${msg}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:#25d366;color:#062b16;font-weight:950;text-decoration:none;padding:13px 18px;border-radius:12px;font-size:14px">`+
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.2-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4 0-.5.1-.7l.5-.6c.1-.2.1-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.9.9-1.1 2.2-.2 3.9a10.2 10.2 0 0 0 4.3 4.1c1.6.8 2.6.9 3.5.6.5-.2 1.5-.7 1.7-1.3.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3Z"/></svg>`+
    `${escapeHtml(rotulo)}</a></div>`;
}

// v1195 — cpPreviaCerebroHTML foi junto pro pedaço da importação (js/importacao.js).


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
// v1225 — DE ONDE SAIU ESTA ANÁLISE (uma linha, embaixo das sugestões).
//
// "só pode que não está olhando, só pode que o sistema não está analisando o do cérebro ou o do
// cérebro está muito errado" (dono, 11/08/2026). Enquanto isso for adivinhação, toda sugestão ruim
// vira uma dúvida sobre o sistema inteiro. A análise agora carrega a resposta e a tela mostra:
// o Cérebro entrou ou não, e quanto da conversa a IA leu de verdade.
function cp1225LinhaDeOndeVeio(a){
  if(!a || typeof a !== "object") return "";
  const lida = a.conversaLidaPelaIA;
  if(a.cerebroAplicado == null && !lida) return ""; // análise antiga, de antes deste registro
  const semCerebro = a.cerebroAplicado === false;
  // v1241 — quando o teto técnico corta conversa gigante, a tela DIZ quantas de quantas foram.
  const quanto = lida?.modo === "parte da conversa"
    ? `leu ${Number(lida.mensagensEnviadas) || 0} de ${Number(lida.totalDaConversa) || 0} mensagens (conversa longa demais)`
    : lida?.modo === "resumo+novidade"
    ? `leu ${Number(lida.mensagensEnviadas)||0} ${pl(Number(lida.mensagensEnviadas)||0, "mensagem", "mensagens")} + resumo de ${Number(lida.mensagensResumidas)||0} antigas`
    : (Number(lida?.mensagensEnviadas) > 0
        ? `leu a conversa inteira (${Number(lida.mensagensEnviadas)} ${pl(Number(lida.mensagensEnviadas), "mensagem", "mensagens")})`
        : "");
  const cerebro = semCerebro
    ? '<b style="color:var(--risco)">sem o seu Cérebro</b>'
    : "com o seu Cérebro";
  // v1239 — quanto de cada campo do Cérebro foi junto. O dono cravou "leia as regras do cerebro!
  // ou ele nao esta sendo usado" e não tinha como conferir sozinho. Agora tem: se um campo
  // aparecer aqui, o texto dele foi enviado; se não aparecer, está vazio no cadastro.
  const env = a.cerebroEnviado;
  let detalhe = "";
  if(env && Number(env.total) > 0){
    const rot = { metodo:"método", tom:"tom", diferenciais:"diferenciais", evitar:"o que evitar", regras:"regras", objecoes:"objeções" };
    const partes = Object.keys(rot).filter(k => Number(env[k]) > 0)
      .map(k => `${rot[k]} ${Number(env[k]).toLocaleString("pt-BR")}`);
    if(partes.length) detalhe = ` · seu Cérebro enviado: ${partes.join(", ")} (${Number(env.total).toLocaleString("pt-BR")} caracteres)`;
  }
  // v1296 — "cade as regras, o cerebro, o aprendizado????" (dono, 18/08/2026). O Cérebro já tinha
  // essa prova; o APRENDIZADO não tinha nenhuma. Agora a mesma linha diz, em número, o que cada
  // fonte do aprendizado pôs nesta análise — e diz com todas as letras quando não pôs nada, que é
  // a resposta que faltava pra saber onde olhar quando a sugestão vem fraca.
  const ap = a.aprendizadoEnviado;
  let linhaAprendizado = "";
  if(ap && typeof ap === "object"){
    const itens = [];
    if(Number(ap.jeito) > 0) itens.push("seu jeito de escrever");
    if(Number(ap.casos) > 0) itens.push(`${Number(ap.casos)} ${pl(Number(ap.casos), "caso seu", "casos seus")}`);
    if(Number(ap.fatos) > 0) itens.push("fatos que você ensinou");
    if(Number(ap.voz) > 0) itens.push(`${Number(ap.voz)} ${pl(Number(ap.voz), "mensagem sua desta conversa", "mensagens suas desta conversa")}`);
    linhaAprendizado = itens.length
      ? ` · aprendizado aplicado: ${itens.join(", ")}`
      : " · aprendizado: nada entrou nesta análise";
  }
  return `<div class="small" style="color:var(--muted);margin:-4px 0 10px">Análise feita ${cerebro}${quanto ? " · " + escapeHtml(quanto) : ""}${escapeHtml(detalhe)}${escapeHtml(linhaAprendizado)}</div>`;
}

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
    // v1266 — ÚLTIMO CONTATO É O ÚLTIMO ATENDIMENTO (ordem do dono). Esta linha era "Última
    // mensagem" e vinha da conversa: na cliente "Dani De Sm" ela dizia 05/05 enquanto o histórico
    // logo abaixo abria com a mensagem de 28/07 que ele mesmo mandou pelo app. Agora a linha mostra
    // o ÚLTIMO ATENDIMENTO registrado — a data que manda em todo o resto do app (descanso, fila,
    // "parado há"). Cliente que nunca foi atendido não tem essa data: aí, e só aí, a linha mostra a
    // última mensagem da conversa, que é a única que existe.
    const ultimoAtTs=(typeof ultimoAtendimentoTs==='function')?ultimoAtendimentoTs(lead):0;
    const ultimaMsgReal=(typeof cp786UltimaMensagemReal==='function')?cp786UltimaMensagemReal(lead):null;
    const ultimaMsgEm=ultimoAtTs
      ? cp705FormatDateTime(new Date(ultimoAtTs).toISOString())
      : ((ultimaMsgReal&&ultimaMsgReal.m)?cp704DataHora(ultimaMsgReal.m):cp705FormatDateTime(lead.lastInteractionAt || lead.lastActivityAt || lead.lastInteraction || ''));
    const ultimaMsgRotulo=ultimoAtTs?'Último atendimento':'Última mensagem';
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
    // v1229 — mesma doença da v1028 (card "Mensagens") e da v1081 (campo de observação), agora
    // no painel "Agendar próximo contato": cada remontagem recriava o painel FECHADO (`hidden`
    // cravado no HTML) e zerava dia/hora já escolhidos. No celular, a 2ª montagem (a que espera
    // o servidor) chegava bem quando o corretor estava com o calendário nativo aberto — o painel
    // sumia e parecia que a tela "fechou sozinha e voltou pro lead"; só na 2ª tentativa (lead já
    // em cache, sem remontagem tardia) dava pra marcar. Guarda aberto/fechado + dia/hora antes
    // de remontar e devolve logo depois.
    const cpAgPainelAntes = area.querySelector('#ui670SchedulePanel');
    const cpAgEstado = (cpAgPainelAntes && !cpAgPainelAntes.hidden) ? {
      data: area.querySelector('#ui670ScheduleData')?.value || "",
      hora: area.querySelector('#ui670ScheduleHora')?.value || ""
    } : null;
    // v1238 — mesma doença da v1028/v1081/v1229, agora no card "Últimas mensagens" DURANTE uma
    // remontagem disparada de dentro dele. A v1028 já preservava aberto/fechado, mas só no
    // caminho de ABRIR o lead — quem remonta depois (apagar uma mensagem do histórico, marcar
    // atendimento, reanalisar) recriava o card FECHADO (`hidden` cravado no HTML).
    //
    // O efeito era o relato do dono (print de 12/08/2026): apagou uma observação e "veio pra
    // outra tela". Não foi a rolagem que falhou — foi o card fechar. A página inteira encolheu de
    // altura, e a rolagem restaurada logo abaixo (que devolve o MESMO número de pixels) passou a
    // cair lá embaixo, no "Histórico de contatos". Preservando o card aberto, a altura não muda
    // e a restauração da rolagem volta a pousar exatamente onde ele estava.
    const cp7HistAntes = area.querySelector('#cp704HistCard');
    const cp7HistAberto = !!cp7HistAntes && !cp7HistAntes.hidden;
    // Só vale restaurar a rolagem quando JÁ havia um detalhe montado aqui (remontagem).
    // Na primeira montagem (vindo do esqueleto) a página deve continuar se comportando como antes.
    const cp7JaTinhaDetalhe = !!area.querySelector('.cp704-lead');
    const cp7RolagemPagina = window.scrollY;
    area.innerHTML=`<div class="cp704-lead">
      <div class="cp704-top"><div class="cp704-toolbar"><button class="cp704-back" onclick="voltarDoLead()" title="Voltar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg><span class="lb">Voltar</span></button><button type="button" class="cp704-ico" onclick='abrirPropostaComLead(${safeJson(lead?.name||'')},${safeJson(cp704Produto(lead,mc))},${JSON.stringify(String(lead?.id||''))})' title="Gerar proposta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg><span class="lb">Proposta</span></button>${cp704BotaoEtapa(lead)}<button type="button" class="cp704-ico" onclick="cp704ToggleHistorico()" title="Últimas mensagens"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></svg><span class="lb">Mensagens</span></button><button type="button" id="btnReanalisarLeadTop" class="cp704-ico" onclick="ui670Reanalisar(this)" title="Reanalisar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v6h6M20 20v-6h-6"/><path d="M20 10a8 8 0 0 0-14-4M4 14a8 8 0 0 0 14 4"/></svg><span class="lb">Reanalisar</span></button><button type="button" class="cp704-ico" onclick="ui670Toggle&&ui670Toggle('ui670SchedulePanel')" title="Agendar retorno"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><span class="lb">Agendar</span></button><button type="button" class="cp704-ico" onclick='cp715EditarLead(${JSON.stringify(String(lead.id||''))})' title="Editar lead"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span class="lb">Editar</span></button>${attended?`<button type="button" class="cp704-ico done" onclick="ui667DesmarcarAtendido(this)" title="Atendido hoje — tocar de novo desmarca"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg><span class="lb">Atendido</span></button>`:`<button type="button" class="cp704-ico" onclick="ui667MarcarAtendido(this)" title="Marcar atendimento"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg><span class="lb">Marcar</span></button>`}</div></div>
      <div class="cp704-herorow">
        <section class="cp704-hero">
          <h1>${escapeHtml(lead.name||'Contato')}</h1>
          <div class="cp704-mainrow"><div class="cp704-situation">${cp704BarraInteresse(lead)}<p>${escapeHtml(cp705SanitizeFactText(imped,lead))}</p></div></div>
          ${analiseEm?`<div class="cp704-metaline">${escapeHtml(`Última análise — ${analiseEm}`)}</div>`:`<div class="cp704-metaline">Sem data registrada</div>`}
          ${ultimaMsgEm?`<div class="cp704-metaline">${escapeHtml(`${ultimaMsgRotulo} — ${ultimaMsgEm}`)}</div>`:''}
        </section>
        <section class="cp704-card cp704-obscard">
          <div class="cp704-card-title"><h2>Registrar observação</h2></div>
          <p style="margin:0 0 10px;color:var(--muted);font-size:13px">Registre algo que aconteceu fora do WhatsApp (visita, ligação etc.) — aparece na linha do tempo, ensina o sistema em segundo plano e entra na próxima análise.</p>
          <p style="margin:-4px 0 10px;color:var(--muted);font-size:12.5px">Cliente respondeu pouca coisa? <b style="color:var(--text)">Tire um print da resposta</b> e toque em "Ler print" — o texto entra aqui pra você conferir, sem precisar mandar a conversa inteira de novo.</p>
          <textarea id="cp7ObsTexto" placeholder="Ex.: Fiz visita com o cliente, ele gostou muito e ficou de marcar visita de novo semana que vem." style="min-height:120px;margin-bottom:16px"></textarea>
          <!-- v1250 — LER O PRINT DA RESPOSTA. Pedido do dono: quando o cliente responde pouca
               coisa, mandar a conversa inteira de novo e esperar a reanálise é trabalho demais pra
               duas linhas. Ele tira um print da resposta, o texto cai aqui em cima, ele confere e
               salva. No celular o seletor já abre na galeria/câmera; no computador dá pra colar a
               imagem direto no campo de texto (Ctrl+V). -->
          <input type="file" id="cp1250PrintInput" accept="image/png,image/jpeg,image/webp" hidden onchange="cp1250LerPrint(this)">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
            <button type="button" id="cp1250PrintBtn" onclick="document.getElementById('cp1250PrintInput')?.click()" style="flex:1;min-width:140px;background:transparent;border:1px solid var(--line);border-radius:12px;padding:11px;color:var(--text);font-weight:900;cursor:pointer">Ler print da resposta</button>
            <button type="button" id="cp7ObsGravarBtn" onclick="cp7ObsToggleGravacao(this)" style="flex:1;min-width:140px;background:transparent;border:1px solid var(--line);border-radius:12px;padding:11px;color:var(--text);font-weight:900;cursor:pointer">Gravar áudio</button>
            <button type="button" onclick="cp7ObsSalvar(this)" style="flex:1;min-width:140px;background:var(--accent);border:0;border-radius:12px;padding:11px;color:var(--on-accent);font-weight:950;cursor:pointer">Salvar observação</button>
          </div>
          <div id="cp7ObsStatus" class="small" style="margin-top:8px;color:var(--muted)"></div>
        </section>
      </div>
      ${typeof cpCadenciaNoticeHTML==='function'?cpCadenciaNoticeHTML(lead):''}
      <div class="cp704-workspace">
        <main class="cp704-primary">
          ${needsAnalysis?`<section class="cp704-card cp704-stale"><div class="cp704-card-title"><h2>${stale?'Análise comercial antiga':'Análise comercial pendente'}</h2></div><p>${stale?'Atualize para recalcular oportunidade, próxima ação e mensagem.':'Ainda não há 3 mensagens comerciais válidas para este lead.'}</p><button type="button" onclick="ui670Reanalisar(this)">Atualizar análise comercial</button></section>`:''}
          <section class="cp704-card">
            <div class="cp704-card-title"><h2>Fazer agora</h2></div>
            <div class="cp704-step"><p>${escapeHtml(next)}</p></div>
            <div class="cp704-msg-sub">Sugestões de mensagem · copie a melhor opção</div>
            ${cp1225LinhaDeOndeVeio(a)}
            ${aguardarContato&&messagesReady?`<div class="cp704-empty-analysis" style="margin-bottom:10px"><b>Recomendação agora: aguardar, sem mandar mensagem.</b><span>${escapeHtml(motivoAguardar)}</span></div>`:''}
            ${!messagesReady?(semAcaoUrgente?`<div class="cp704-empty-analysis"><b>Sem mensagem necessária agora.</b><span>Não há ação comercial pendente identificada para este lead no momento.</span></div>`:`<div class="cp704-empty-analysis"><b>Mensagem ainda não gerada.</b><span>${needsAnalysis?'Atualize a análise comercial acima para criar a sugestão correta.':'Toque em "Reanalisar" no topo para criar a sugestão correta.'}</span>${cp724DiagRecusaHtml(a,msgs)}${needsAnalysis?'':'<button type="button" onclick="ui670Reanalisar(this)">Atualizar análise comercial</button>'}</div>`):`
            <div class="cp704-msg-list"><div class="cp704-msg-item${cp704MarcaCopiada(lead,'a',msgs.a)}" data-key="a"><div class="cp704-msg-head"><span class="cp704-num">1</span><b>${escapeHtml(msgs.aLabel||'Recomendada')}</b></div><p>${escapeHtml(msgs.a)}</p><button class="cp704-copy" onclick="cp704CopyMsg('a')">${cp704RotuloCopiar(lead,'a',msgs.a)}</button></div>${msgs.b?`<div class="cp704-msg-item${cp704MarcaCopiada(lead,'b',msgs.b)}" data-key="b"><div class="cp704-msg-head"><span class="cp704-num">2</span><b>${escapeHtml(msgs.bLabel||'Facilitar decisão')}</b></div><p>${escapeHtml(msgs.b)}</p><button class="cp704-copy" onclick="cp704CopyMsg('b')">${cp704RotuloCopiar(lead,'b',msgs.b)}</button></div>`:''}${msgs.c?`<div class="cp704-msg-item${cp704MarcaCopiada(lead,'c',msgs.c)}" data-key="c"><div class="cp704-msg-head"><span class="cp704-num">3</span><b>${escapeHtml(msgs.cLabel||'Direta ao ponto')}</b></div><p>${escapeHtml(msgs.c)}</p><button class="cp704-copy" onclick="cp704CopyMsg('c')">${cp704RotuloCopiar(lead,'c',msgs.c)}</button></div>`:''}</div>`}
          </section>
          ${cp717MudancasHtml(a)}
        </main>
        <aside class="cp704-secondary">
          ${cp704ConducaoHtml(lead)}
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
  // v1229 — devolve o painel "Agendar" aberto e com o dia/hora que o corretor já tinha
  // escolhido (ver comentário na captura, acima).
  if(cpAgEstado){
    const cpAgPainelDepois = area.querySelector('#ui670SchedulePanel');
    if(cpAgPainelDepois){
      cpAgPainelDepois.hidden = false;
      const cpAgData = area.querySelector('#ui670ScheduleData');
      const cpAgHora = area.querySelector('#ui670ScheduleHora');
      if(cpAgData && cpAgEstado.data) cpAgData.value = cpAgEstado.data;
      if(cpAgHora) cpAgHora.value = cpAgEstado.hora;
      try{ cpAgendarResumo("ui670Schedule"); }catch(_){}
    }
  }
  // v1238 — devolve o card "Últimas mensagens" aberto ANTES de mexer na rolagem: se ele voltasse
  // fechado, a página ficaria mais curta e o número de pixels restaurado abaixo pousaria noutro
  // lugar (era exatamente isso que jogava o dono pro "Histórico de contatos" ao apagar).
  if(cp7HistAberto){ const cp7HistDepois = area.querySelector('#cp704HistCard'); if(cp7HistDepois) cp7HistDepois.hidden = false; }
  // A remontagem troca a altura da área e o navegador reposiciona a página sozinho — é o
  // "a tela pulou pra baixo" relatado pelo dono. Volta pra onde ele estava.
  if(cp7JaTinhaDetalhe && Math.abs(window.scrollY - cp7RolagemPagina) > 2){
    try{ window.scrollTo({ top: cp7RolagemPagina, behavior: "auto" }); }catch(_){ window.scrollTo(0, cp7RolagemPagina); }
  }
  return null;
}

window.renderLeadFoco = renderLeadFoco;



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
  // v1248 — "hoje" pelo calendário de BRASÍLIA, como o resto do app (inicioDoDiaBR). Antes usava a
  // meia-noite do RELÓGIO DO APARELHO: com o celular em outro fuso (corretor viajando, ou o relógio
  // do Android em UTC — acontece em app reinstalado), das 21h à meia-noite o "hoje" do aparelho já
  // era o dia seguinte, e a barra do topo anunciava como "hoje" um compromisso que é de amanhã.
  const dt = new Date(Date.UTC(+dataAbs[1], +dataAbs[2]-1, +dataAbs[3], 3, 0, 0, 0)); // meia-noite em Brasília
  const hj = inicioDoDiaBR();
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
      const bg = it.ordem === 1 ? "var(--acao-soft)" : "var(--accent-soft)";
      const nome = (it.lead.name||"Cliente").split(" ").slice(0,2).join(" ");
      const idJs = JSON.stringify(String(it.lead.id||""));
      // v1227 — safeJson, não JSON.stringify: a chave carrega texto livre extraído da conversa
      // (o "oQue" do compromisso) e um apóstrofo nele estouraria o atributo onclick='...' —
      // mesma classe de furo corrigida no botão "Arquivar este lead".
      const keyJs = safeJson(String(it.key||""));
      // Formato natural: "Visita hoje à tarde · Nome do cliente" + um × pra remover se a IA errou.
      const frase = `${it.tipo} ${it.quando}${it.periodo}`;
      return `<span style="display:inline-flex;align-items:center;background:${bg};border:1px solid ${cor};border-radius:999px"><button type="button" onclick='abrirLead(${idJs})' style="background:none;border:none;color:var(--white);padding:7px 4px 7px 14px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px"><span style="color:${cor};font-weight:950">${escapeHtml(frase)}</span><span style="opacity:.5">·</span><span style="font-weight:700">${escapeHtml(nome)}</span></button><button type="button" title="Não é compromisso — remover" onclick='dispensarCompromisso(${keyJs})' style="margin:0 5px 0 2px;width:20px;height:20px;border-radius:999px;background:rgba(227,84,84,.22);border:1px solid rgba(227,84,84,.7);color:var(--risco);cursor:pointer;font-size:13px;font-weight:900;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto">×</button></span>`;
    }).join("");
  }catch(_){ /* falha silenciosa */ }
}

function agendaCardHTML(l, extra, horaHtml){
  // v1233 — horaHtml (opcional): coluna da hora à esquerda do cartão, usada pela lista do dia
  // da Agenda (desenho da simulação aprovada). Quem não passa nada fica igual a antes.
  const idJs = JSON.stringify(String(l.id||""));
  return `
    <div class="agenda-item">
      ${horaHtml || ""}
      <div style="flex:1;min-width:0">
        <strong onclick='abrirLead(${idJs})' style="cursor:pointer;text-decoration:underline;text-decoration-color:rgba(255,255,255,.18)">${escapeHtml(l.name||"Cliente")}</strong>
        <div class="small" style="margin-top:3px">${escapeHtml(l.product||"--")}</div>
        ${l.nextAction ? `<div class="small" style="margin-top:6px;color:var(--soft)"><b>Próxima ação:</b> ${escapeHtml(l.nextAction)}</div>` : ""}
        ${extra || ""}
      </div>
      <div class="agenda-acoes">
        <button type="button" onclick='abrirLead(${idJs})' style="padding:7px 13px;font-size:11px;background:var(--lime);color:var(--on-accent);border:1px solid var(--lime);border-radius:8px;cursor:pointer;font-weight:950">Ver análise</button>
        ${l.analysis?.lembrete?.quando ? reagendarControlHTML(l.id, l.analysis.lembrete) : ""}
        ${l.analysis?.lembrete?.quando ? `<button type="button" onclick='removerLembrete(${idJs})' style="padding:6px 10px;font-size:11px;background:rgba(227,84,84,.10);color:var(--risco);border:1px solid rgba(227,84,84,.26);border-radius:8px;cursor:pointer;font-weight:950">🗑 Excluir</button>` : ""}
      </div>
    </div>`;
}
// ===== v1208 — PAINEL DE AGENDAMENTO (um só, usado pelo lead e pela Agenda) =====
// Print do dono, irritado: "não estou conseguindo agendar a hora... boto ali o dia, e daí quando
// eu vou tentar selecionar a hora fecha. Sem falar que está feio, nem parece um app desse nível".
// Eram DOIS defeitos somados, e os dois eram nossos:
//
// 1. FECHAVA NO MEIO. Escolher a data SALVAVA na hora (onchange), e salvar redesenha a tela
//    (abrirLead/carregarAgenda) — o painel morria junto, antes de ele chegar na hora. Ou seja: o
//    jeito "esperto" de salvar sozinho tornava impossível marcar dia E hora na mesma ida.
//    Agora nada é salvo até ele tocar em "Confirmar agendamento". Os atalhos (Hoje/Amanhã/+7...)
//    também só PREENCHEM o dia — não salvam mais sozinhos.
// 2. FICAVA FEIO/INVISÍVEL. Os campos nativos de data e hora do Android herdam o esquema de cor
//    CLARO: o texto guia ("dd/mm/aaaa", "--:--") e os ícones saíam escuros sobre o fundo escuro
//    do app — no print são duas caixas vazias com uma setinha. `color-scheme:dark` nos campos
//    resolve, e agora eles têm rótulo, altura de dedo e fonte de 16px (abaixo disso o celular dá
//    zoom sozinho ao tocar).
//
// Além disso: atalhos de HORA (09:00, 10:00, 14:00...) pra não precisar abrir o relógio do
// celular no caso comum, e uma frase de conferência ("Vai agendar: quinta, 13/08 às 09:00")
// embaixo do botão, pra ele ver o que vai salvar ANTES de salvar.
const CP1208_HORAS_RAPIDAS = ["08:00","09:00","10:00","14:00","16:00","18:00"];
// Rótulos curtos ("+7d") de propósito: com "+7 dias" os cinco atalhos viravam duas linhas no
// celular, e o dono já reclamou disso em outra tela (v1204).
const CP1208_DIAS_RAPIDOS = [["Hoje",0],["Amanhã",1],["+7d",7],["+15d",15],["+30d",30]];

// Monta o painel. `pref` prefixa os ids (a Agenda desenha um painel por cartão, então não pode
// haver id repetido); `atual` = {data:"aaaa-mm-dd", hora:"hh:mm"} pré-preenche o que já está
// marcado, pra ele enxergar o compromisso atual em vez de dois campos vazios.
function cpAgendarPainelHTML(idRaw, pref, atual){
  const idJs = JSON.stringify(String(idRaw||""));
  const p = JSON.stringify(String(pref||"ag"));
  const dataAtual = /^\d{4}-\d{2}-\d{2}$/.test(String(atual?.data||"")) ? atual.data : "";
  const horaAtual = /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(atual?.hora||"")) ? atual.hora : "";
  const chipsDia = CP1208_DIAS_RAPIDOS
    .map(([rot,n]) => `<button type="button" class="cp1208-chip" onclick='cpAgendarEscolherDia(${p},${n},this)'>${rot}</button>`).join("");
  const chipsHora = CP1208_HORAS_RAPIDAS
    .map(h => `<button type="button" class="cp1208-chip${h===horaAtual?" ativo":""}" onclick='cpAgendarEscolherHora(${p},"${h}",this)'>${h}</button>`).join("")
    + `<button type="button" class="cp1208-chip" onclick='cpAgendarEscolherHora(${p},"",this)'>Sem hora</button>`;
  return `<div class="cp1208-agendar">`
    + `<div class="cp1208-bloco"><span class="cp1208-rot">Dia</span><div class="cp1208-chips">${chipsDia}</div>`
    + `<input type="date" class="cp1208-campo" id="${pref}Data" value="${dataAtual}" aria-label="Dia do compromisso" onchange='cpAgendarResumo(${p})'></div>`
    + `<div class="cp1208-bloco"><span class="cp1208-rot">Hora <i>(opcional)</i></span><div class="cp1208-chips">${chipsHora}</div>`
    + `<input type="time" class="cp1208-campo" id="${pref}Hora" value="${horaAtual}" aria-label="Hora do compromisso" onchange='cpAgendarResumo(${p})'></div>`
    + `<button type="button" class="cp1208-ok" onclick='cpAgendarConfirmar(${p},${idJs})'>Confirmar agendamento</button>`
    + `<div class="cp1208-resumo" id="${pref}Resumo">${cpAgendarResumoTexto(dataAtual, horaAtual)}</div>`
    + `</div>`;
}
window.cpAgendarPainelHTML = cpAgendarPainelHTML;

// As funções abaixo são chamadas de dentro de onclick/onchange, então PRECISAM estar em window e
// só podem usar globais de verdade (lição da v1202: `qs` é binding de módulo e não existe lá).
function cpAgendarCampos(pref){
  return {
    data: document.getElementById(pref+"Data"),
    hora: document.getElementById(pref+"Hora"),
    resumo: document.getElementById(pref+"Resumo")
  };
}
function cpAgendarMarcarChip(btn){
  if(!btn || !btn.parentElement) return;
  const irmaos = btn.parentElement.querySelectorAll(".cp1208-chip");
  for(const b of irmaos) b.classList.toggle("ativo", b === btn);
}
function cpAgendarEscolherDia(pref, dias, btn){
  const d = new Date(); d.setDate(d.getDate() + Number(dias||0));
  const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const c = cpAgendarCampos(pref);
  if(c.data) c.data.value = s;
  cpAgendarMarcarChip(btn);
  cpAgendarResumo(pref);
}
function cpAgendarEscolherHora(pref, hora, btn){
  const c = cpAgendarCampos(pref);
  if(c.hora) c.hora.value = String(hora||"");
  cpAgendarMarcarChip(btn);
  cpAgendarResumo(pref);
}
// Frase de conferência: o que ele vai salvar, em português, antes de salvar.
function cpAgendarResumoTexto(data, hora){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(data||""))) return "Escolha o dia acima — a hora é opcional.";
  let quando = data;
  try{
    quando = new Date(data+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit"});
  }catch(_){ }
  return hora ? `Vai agendar: ${quando}, às ${hora}.` : `Vai agendar: ${quando} (sem hora marcada).`;
}
function cpAgendarResumo(pref){
  const c = cpAgendarCampos(pref);
  if(c.resumo) c.resumo.textContent = cpAgendarResumoTexto(c.data?.value||"", c.hora?.value||"");
}
// ÚNICO ponto que salva. Antes da v1208 os campos salvavam sozinhos e o painel fechava no meio.
function cpAgendarConfirmar(pref, id){
  const c = cpAgendarCampos(pref);
  const data = c.data?.value || "";
  if(!data){ toast("Escolha o dia primeiro — depois, se quiser, a hora."); return; }
  reagendarLembrete(id, data, c.hora?.value || "");
}
window.cpAgendarEscolherDia = cpAgendarEscolherDia;
window.cpAgendarEscolherHora = cpAgendarEscolherHora;
window.cpAgendarResumo = cpAgendarResumo;
window.cpAgendarResumoTexto = cpAgendarResumoTexto;
window.cpAgendarConfirmar = cpAgendarConfirmar;
window.cpAgendarCampos = cpAgendarCampos;
window.cpAgendarMarcarChip = cpAgendarMarcarChip;

// Data (aaaa-mm-dd) do lembrete já marcado, no fuso de Brasília — pra pré-preencher o painel.
function cpAgendarDataDoLembrete(quando){
  try{
    const p = new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric"})
      .formatToParts(new Date(quando)).reduce((o,x)=>(x.type!=="literal"&&(o[x.type]=x.value),o),{});
    return (p.year && p.month && p.day) ? `${p.year}-${p.month}-${p.day}` : "";
  }catch(_){ return ""; }
}

// Controle de "Reagendar" do cartão da Agenda: o botão que abre o painel + o painel (o mesmo do
// lead, desde a v1208 — antes eram dois painéis diferentes com o mesmo defeito).
function reagendarControlHTML(idRaw, lembrete){
  const id = String(idRaw||"");
  const idJs = JSON.stringify(id);
  const atual = { data: cpAgendarDataDoLembrete(lembrete?.quando), hora: lembrete?.hora || "" };
  return `<button type="button" onclick='toggleReagendar(${idJs})' style="padding:6px 10px;font-size:11px;background:rgba(255,255,255,.05);color:var(--soft);border:1px solid var(--line);border-radius:8px;cursor:pointer;font-weight:950">🗓 Reagendar</button>`
    + `<div id="reagbox_${id}" class="cp1208-caixa" style="display:none">`
    + cpAgendarPainelHTML(id, "reag_"+id, atual)
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
// Remarca o lembrete pra nova data (rápido, sem reanalisar). Valida o ano pra não sumir o lembrete.
// horaStr é OPCIONAL (v1199, "hh:mm") — sem ela, comportamento idêntico a antes.
async function reagendarLembrete(id, dateStr, horaStr){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr||""));
  if(!m){ toast("Data inválida."); return; }
  const ano = +m[1], anoAtual = new Date().getFullYear();
  if(ano < anoAtual || ano > anoAtual + 5){ toast("Ano inválido — escolha uma data real."); return; }
  const horaValida = /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(horaStr||""));
  try{
    const res = await fetch("./api/reanalisar-lead", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payloadComCerebro({ id, action:"reagendar-lembrete", data: dateStr, hora: horaValida ? horaStr : undefined }))
    });
    const d = await res.json().catch(()=>({}));
    if(!d?.ok) throw new Error(d?.error||"falha");
    // v1133 — põe a data nova na carteira em memória (é dela que a Agenda redesenha). Sem isto o
    // cartão continuava mostrando a data antiga até sair e voltar da tela.
    const quandoLocal = horaValida ? new Date(`${dateStr}T${horaStr}:00-03:00`) : new Date(dateStr+"T12:00:00");
    cpAtualizarLembreteLocal(id, d?.lembrete || { quando: quandoLocal.toISOString(), motivo: "Retomar contato", hora: horaValida ? horaStr : null });
    // v1148 — agendar TAMBÉM marca atendimento (pedido do dono: "como se copiasse sugestão de
    // mensagem"). O servidor já gravou o atendimento nesta mesma chamada; aqui a tela reflete na
    // hora, sem esperar a carteira recarregar — mesma marcação local que a cópia de mensagem usa.
    if(d?.atendimentoRegistrado){
      try{
        const quando = String(d.atendimentoQuando || new Date().toISOString());
        const p = new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,hourCycle:"h23"}).formatToParts(new Date(quando)).reduce((o,x)=>(x.type!=="literal"&&(o[x.type]=x.value),o),{});
        const detalhes = { tipo:"Agendamento", de:"agendamento" };
        if(state.lead && String(state.lead.id) === String(id)) ui667AplicarAtendidoLocal(state.lead, quando, `${p.day}/${p.month}/${p.year}`, `${p.hour}:${p.minute}`, detalhes);
        for(const lista of [state.itemsAtivos, state.todosLeads, state.leads]){
          const item = Array.isArray(lista) ? lista.find(x => String(x.id) === String(id)) : null;
          if(item) ui667AplicarAtendidoLocal(item, quando, `${p.day}/${p.month}/${p.year}`, `${p.hour}:${p.minute}`, detalhes);
        }
        invalidarLeadsCache();
      }catch(_){}
    }
    toast("Agendado para " + new Date(dateStr+"T12:00:00").toLocaleDateString("pt-BR") + (horaValida ? `, ${horaStr}` : "") + " — e marcado como atendido hoje.");
    await atualizarSinoAgenda(); // sino do topo na hora, em qualquer tela (sem F5)
    if(state.active === "agenda") carregarAgenda();
    else if(state.lead?.id) {
      // v1229 — pedido do dono: depois de agendar, voltar pro TOPO da tela do cliente (a página
      // parava lá embaixo, na altura de "Detalhes comerciais", onde o painel fica). Fecha o
      // painel antes de remontar (senão a preservação da v1229 em renderLeadFoco o devolveria
      // aberto e a remontagem tardia ficaria esperando à toa) e sobe a página ANTES da
      // remontagem — assim a restauração de rolagem de renderLeadFoco já captura o topo.
      try{ const cpAgP = document.querySelector('#ui670SchedulePanel'); if(cpAgP) cpAgP.hidden = true; }catch(_){}
      try{ window.scrollTo({ top: 0, behavior: "auto" }); }catch(_){ try{ window.scrollTo(0,0); }catch(_){} }
      try{ abrirLead(id); }catch(_){}
    }
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
    // v1133 — tira o lembrete da carteira em memória, que é de onde a Agenda redesenha. Era isto
    // que faltava: sem esta linha o cartão excluído continuava na lista ("deletei e não saiu daí").
    cpAtualizarLembreteLocal(id, null);
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

    const fimHojeA = (() => { const d = new Date(); d.setHours(23,59,59,999); return d.getTime(); })();
    // v1215 — as listas do DIA (atrasados, lembretes de hoje, compromissos) vêm da mesma função que
    // alimenta o número do sino (cpAgendaDoDia). Antes eram dois cálculos parecidos em lugares
    // diferentes, e bastou um deles ganhar uma regra nova pra tela e sino discordarem.
    const { lembretesHoje, compHoje, compAmanha, compFuturo, atrasados } = cpAgendaDoDia(items);
    // Futuros = data DEPOIS de hoje (ativos + geladeira).
    // Lembrete VENCIDO de lead na GELADEIRA → reaparece AQUI pra revisar (está parkeado, não vai pro Hoje).
    const lembretesFuturos = itemsAll.filter(l => { const t = lembreteTs(l); return !isNaN(t) && t > fimHojeA; });
    lembretesFuturos.sort((a,b) => lembreteTs(a) - lembreteTs(b));
    const lembretesArquivadosVencidos = itemsAll.filter(l => lembreteVencido(l) && normalizarEtapa(l.etapa) === ETAPA_ARQUIVADO);
    lembretesArquivadosVencidos.sort((a,b) => lembreteTs(a) - lembreteTs(b));

    const compromissos = [...compHoje, ...compAmanha, ...compFuturo];

    if(!compromissos.length && !lembretesHoje.length && !lembretesFuturos.length && !lembretesArquivadosVencidos.length && !atrasados.length){
      box.innerHTML = '<div class="empty">Nada agendado. Quando você ou o cliente marcarem um retorno (ex.: "retomar em 60 dias"), aparece aqui.</div>';
      state.agendaFiltroDia = null; // sem itens não há o que filtrar (v1232)
      return;
    }

    // ===== v1233 — SEMANA NO TOPO, agora IGUAL à simulação escolhida (modelo 4) =====
    // O dono conferiu com print: a v1232 tinha feito quadradinhos com a CONTAGEM grande e mantido
    // as listas antigas embaixo — a simulação aprovada era outra coisa. Aqui é o desenho dela:
    // quadradinho com o DIA DA SEMANA em cima e o NÚMERO DO DIA grande, bolinha com a contagem,
    // o dia de HOJE já escolhido ao abrir (aceso em coral, a cor da marca), e embaixo SÓ a lista
    // do dia escolhido, cada cartão com a HORA grande à esquerda, em ordem cronológica.
    // "Atraso" (vermelho) ganha quadradinho quando existir; "+" no fim mostra o que vem depois
    // desta semana (inclusive compromisso sem data concreta). Fuso de São Paulo, como o app todo.
    const diaSP = (ts) => {
      try{ return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(ts)); }
      catch(_){ const d=new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    };
    const hojeKey = diaSP(Date.now());
    const dias = [];
    for(let i=0;i<7;i++){ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+i); dias.push({ key: diaSP(d.getTime()), d }); }
    const amanhaKey = dias[1].key;
    const chaves = new Set(dias.map(x => x.key));
    // Compromisso só entra na conta de um dia quando tem data concreta (AAAA-MM-DD); texto solto
    // tipo "semana que vem" cai no "+" (depois desta semana).
    const apDia = (x) => { const raw=String(x?._ap?.data||'').slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''; };
    const lemDia = (l) => { const t = lembreteTs(l); return isNaN(t) ? '' : diaSP(t); };

    // Hora de cada item — pra coluna da esquerda e pra ordem cronológica do dia.
    const horaDoAp = (ap) => {
      const s = String(ap?.hora || ap?.quando || ap?.dataHora || '');
      let m = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      if(m) return `${m[1].padStart(2,'0')}:${m[2]}`;
      m = s.match(/\b([01]?\d|2[0-3])h\b/i);
      return m ? `${m[1].padStart(2,'0')}:00` : '';
    };
    const minDe = (hora) => hora ? Number(hora.slice(0,2))*60 + Number(hora.slice(3,5)) : null;
    const periodoDe = (hora) => !hora ? 'sem hora' : (Number(hora.slice(0,2)) < 12 ? 'manhã' : Number(hora.slice(0,2)) < 18 ? 'tarde' : 'noite');
    const hcolHora = (hora) => `<div class="cp-ag-hcol"><b>${hora ? escapeHtml(hora) : '—'}</b><small>${periodoDe(hora)}</small></div>`;

    const itemLem = (l) => {
      const lem = l.analysis?.lembrete || {};
      let hora = String(lem.hora||'').trim();
      if(!/^([01]?\d|2[0-3]):[0-5]\d$/.test(hora)) hora = '';
      if(!hora){
        const t = lembreteTs(l);
        if(Number.isFinite(t)){ const d = new Date(t); if(d.getHours() || d.getMinutes()) hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
      }
      const extra = lem.motivo ? `<div class="small" style="margin-top:6px;color:var(--dados)">📅 ${escapeHtml(_cortarFrase(String(lem.motivo), 90))}</div>` : '';
      return { l, hora, min: minDe(hora), extra, dataKey: lemDia(l) };
    };
    const itemAp = (x) => {
      const ap = x._ap || {};
      const hora = horaDoAp(ap);
      const trecho = ap.trechoLiteral ? ` · <i style="color:var(--muted)">"${escapeHtml(String(ap.trechoLiteral).slice(0,60))}"</i>` : '';
      const extra = `<div class="small" style="margin-top:6px;color:var(--acao)">🤝 ${escapeHtml(ap.oQue || 'compromisso')}${trecho}</div>`;
      return { l: x, hora, min: minDe(hora), extra, dataKey: apDia(x) };
    };

    const itensDoDia = (key) => {
      const out = [];
      const lems = key === hojeKey ? lembretesHoje : lembretesFuturos.filter(l => lemDia(l) === key);
      for(const l of lems) out.push(itemLem(l));
      let aps;
      if(key === hojeKey) aps = compHoje;
      else if(key === amanhaKey) aps = [...compAmanha, ...compFuturo.filter(x => apDia(x) === key)];
      else aps = compFuturo.filter(x => apDia(x) === key);
      for(const x of aps) out.push(itemAp(x));
      out.sort((a,b) => (a.min ?? 100000) - (b.min ?? 100000)); // sem hora vai pro fim
      return out;
    };
    const porDia = dias.map(x => itensDoDia(x.key));
    const ultimaChave = dias[6].key;
    const depois = [];
    for(const l of lembretesFuturos){ const k = lemDia(l); if(k && k > ultimaChave) depois.push(itemLem(l)); }
    for(const x of compFuturo){ const k = apDia(x); if(!k || k > ultimaChave) depois.push(itemAp(x)); }
    depois.sort((a,b) => String(a.dataKey || '9999') < String(b.dataKey || '9999') ? -1 : 1);
    const atrasN = atrasados.length + lembretesArquivadosVencidos.length;

    // Escolha atual: HOJE já vem escolhido ao abrir (como na simulação). Escolha que ficou velha
    // (virou o dia, atraso resolvido, "+" esvaziou) volta pra Hoje em vez de abrir uma tela vazia.
    let f = state.agendaFiltroDia;
    if(f !== 'atrasados' && f !== 'depois' && !chaves.has(f)) f = hojeKey;
    if(f === 'atrasados' && !atrasN) f = hojeKey;
    if(f === 'depois' && !depois.length) f = hojeKey;
    state.agendaFiltroDia = f;

    const SEM3 = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
    let html = `<div class="cp-ag-semana">`;
    if(atrasN) html += `<button type="button" class="cp-ag-dia atras${f==='atrasados'?' ativo':''}" onclick="cpAgendaFiltrarDia('atrasados')" title="Atrasados — retome ou descarte"><span>Atraso</span><b>!</b><em>${atrasN}</em></button>`;
    for(let i=0;i<dias.length;i++){
      const n = porDia[i].length;
      html += `<button type="button" class="cp-ag-dia${f===dias[i].key?' ativo':''}" onclick="cpAgendaFiltrarDia('${dias[i].key}')"><span>${SEM3[dias[i].d.getDay()]}</span><b>${dias[i].d.getDate()}</b><em${n?'':' class="zero"'}>${n}</em></button>`;
    }
    if(depois.length) html += `<button type="button" class="cp-ag-dia${f==='depois'?' ativo':''}" onclick="cpAgendaFiltrarDia('depois')" title="Depois desta semana"><span>+</span><b>›</b><em>${depois.length}</em></button>`;
    html += `</div>`;

    const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const DIAS_LONGOS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    if(f === 'atrasados'){
      html += `<div class="cp-ag-titulo"><b style="color:var(--risco)">Atrasados — retome ou descarte</b><span>· ${atrasN} no total</span></div>`;
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
          const keyJs = safeJson(String(v.key)); // v1227 — texto livre na chave: ver comentário no outro keyJs
          linhas.push(`<div class="small" style="margin-top:4px;display:flex;align-items:center;gap:8px"><span style="min-width:0">${escapeHtml(v.oQue)} — era ${escapeHtml(v.dataBR)}${v.trecho ? ` · <i style="color:var(--muted)">"${escapeHtml(v.trecho.slice(0,60))}"</i>` : ''}</span><button type="button" title="Não é compromisso — descartar" onclick='dispensarCompromisso(${keyJs});carregarAgenda()' style="flex:0 0 auto;width:20px;height:20px;border-radius:999px;background:rgba(227,84,84,.22);border:1px solid rgba(227,84,84,.7);color:var(--risco);cursor:pointer;font-size:13px;font-weight:900;line-height:1">×</button></div>`);
        }
        const extra = `<div style="margin-top:6px;padding:6px 8px;background:rgba(227,84,84,.06);border-left:3px solid var(--risco);border-radius:6px;font-size:12px"><b style="color:var(--risco)">Atrasado há ${at.dias} dia${at.dias===1?'':'s'} (era ${escapeHtml(at.dataLabel)})</b>${linhas.join('')}</div>`;
        return agendaCardHTML(l, extra);
      }).join("");
      html += lembretesArquivadosVencidos.map(l => {
        const lem = l.analysis?.lembrete || {};
        const dataBR = new Date(lem.quando).toLocaleDateString("pt-BR");
        const extra = `<div style="margin-top:6px;padding:6px 8px;background:rgba(86,199,242,.05);border-left:3px solid var(--timing);border-radius:6px;font-size:12px"><b style="color:var(--timing)">⏰ Lembrete venceu (${escapeHtml(dataBR)}${lem.hora ? ` às ${escapeHtml(lem.hora)}` : ""}) · está arquivado</b>${lem.motivo ? `<div class="small" style="margin-top:2px;color:var(--soft)">${escapeHtml(lem.motivo)}</div>` : ""}</div>`;
        return agendaCardHTML(l, extra);
      }).join("");
    } else if(f === 'depois'){
      html += `<div class="cp-ag-titulo"><b>Depois desta semana</b><span>· ${depois.length} marcado${depois.length===1?'':'s'}</span></div>`;
      html += depois.map(it => {
        const dk = it.dataKey;
        const hcol = `<div class="cp-ag-hcol"><b>${dk ? `${dk.slice(8,10)}/${dk.slice(5,7)}` : '—'}</b><small>${dk ? (it.hora || '') : 'sem data'}</small></div>`;
        return agendaCardHTML(it.l, it.extra, hcol);
      }).join('');
    } else {
      const idx = Math.max(0, dias.findIndex(x => x.key === f));
      const d = dias[idx].d, itens = porDia[idx];
      const rot = `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
      html += `<div class="cp-ag-titulo"><b>${idx===0?'Hoje — ':''}${rot}</b><span>· ${itens.length ? `${itens.length} na agenda` : 'nada marcado'}</span></div>`;
      html += itens.length
        ? itens.map(it => agendaCardHTML(it.l, it.extra, hcolHora(it.hora))).join('')
        : `<div class="empty">Nada marcado para este dia. Toque em outro dia da faixa acima pra ver o resto da semana.</div>`;
    }

    box.innerHTML = html;
  }catch(err){
    box.innerHTML = '<div class="notice error">Falha: '+escapeHtml(String(err?.message||err))+'</div>';
  }
  };
  // v1135 — ANTES: `if(state.todosLeads?.length){ renderAgenda(...); return; }`, sem nenhuma
  // pergunta sobre a memória estar em dia. Era o buraco por onde passavam os bugs de "mexi e a
  // tela não mudou" (v1125 arquivar, v1133 excluir lembrete): uma camada acima já sabia que os
  // dados tinham mudado e mandava recarregar, e aqui dentro a Agenda se redesenhava do mesmo
  // pedaço de memória velho, anulando tudo.
  //
  // Agora são duas coisas separadas: PINTAR RÁPIDO (a memória serve pra isso, mesmo velha — é
  // melhor que "Carregando...") e ESTAR CERTO (se a memória não está em dia, vai ao servidor e
  // repinta). Quem esquecer de sincronizar a memória numa ação nova não quebra mais a tela: ela
  // só revalida.
  if(Array.isArray(state.todosLeads) && state.todosLeads.length){
    renderAgenda({ items: state.todosLeads });
    if(cpCarteiraEstaEmDia()) return;
    try{
      const data = await getLeadsData();
      if(state.active !== "agenda") return; // saiu da tela enquanto buscava
      if(data?.ok !== false) renderAgenda(data);
    }catch(_){ /* já tem a lista pintada; falha de rede não pode apagá-la */ }
    return;
  }
  box.innerHTML = '<div class="small" style="color:var(--muted);padding:18px 0;text-align:center">Carregando...</div>';
  try{ const data = await getLeadsData(); renderAgenda(data); }catch(err){ box.innerHTML = '<div class="notice error">Falha ao carregar.</div>'; }
}
// v1107 — o "×" de descartar compromisso atrasado (na própria Agenda) chama carregarAgenda()
// no onclick; sem esta ponte o descarte gravava mas a lista não atualizava até sair e voltar.
window.carregarAgenda = carregarAgenda;

// v1232 — toque num dia da faixa da semana: guarda a escolha e redesenha a Agenda (a memória já
// está carregada, então o redesenho é imediato). null = "Tudo".
function cpAgendaFiltrarDia(v){
  state.agendaFiltroDia = v || null;
  carregarAgenda();
}
window.cpAgendaFiltrarDia = cpAgendaFiltrarDia;

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
    // v1139 — vagas da dose reservadas pro resgate diário (0 desliga). Fora de 0–20 vira 2.
    // Diferente dos vizinhos, 0 é VÁLIDO aqui — por isso o teste é Number.isFinite, não ">= 1".
    resgatesPorDia: (Number.isFinite(Number(c.resgatesPorDia)) && Number(c.resgatesPorDia) >= 0 && Number(c.resgatesPorDia) <= 20) ? Math.round(Number(c.resgatesPorDia)) : 2,
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
// v1183 — o dono mostrou o Cérebro com o campo "Seu nome" preenchido e a Home ainda dizendo
// "Bom dia, Empresa!". A causa: quatro lugares liam `state.cerebroCfg`, um campo que NUNCA é
// preenchido em lugar nenhum do app — o comentário de cpMetaAtendimentosDia já registrava isso
// desde a v1012, mas só aquela função tinha sido consertada. Com o nome sempre vazio, a saudação
// caía no nome da ORGANIZAÇÃO (o que a pessoa digitou no cadastro) e tratava o corretor pelo nome
// da firma. Esta é a fonte válida, a mesma que a análise já usa: lê o formulário do Cérebro quando
// ele está montado e, quando não está, o que ficou salvo no aparelho.
function cpNomeCorretorCerebro(){
  try{
    const cfg = (typeof obterCerebroConfigParaAnalise === "function") ? obterCerebroConfigParaAnalise() : null;
    return String(cfg?.corretorNome || "").trim();
  }catch(_){ return ""; }
}
export function obterCerebroConfigParaAnalise() {
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(CEREBRO_LS_KEY) || "null"); } catch(_) { cfg = null; }
  // Os campos existem no HTML mesmo antes de a tela do Cérebro ser carregada.
  // Ler esses campos vazios nesse momento apagava o Método salvo no localStorage
  // e enviava um Cérebro parcial/sem instruções para a análise.
  if (cerebroFormularioCarregado) {
    cfg = {
      ...(cfg || {}),
      corretorNome: qs("#cerebroCorretorNome")?.value || cfg?.corretorNome || "",
      metodo: qs("#cerebroMetodo")?.value ?? cfg?.metodo ?? "",
      tom: qs("#cerebroTom")?.value ?? cfg?.tom ?? "",
      diferenciais: qs("#cerebroDiferenciais")?.value ?? cfg?.diferenciais ?? "",
      evitar: qs("#cerebroEvitar")?.value ?? cfg?.evitar ?? "",
      // v1198 — o campo do período dos áudios saiu da tela: vale o que está salvo (90 por padrão).
      diasImportacao: cfg?.diasImportacao || 90,
      atendimentosPorDia: Number(qs("#cerebroAtendimentosDia")?.value) || cfg?.atendimentosPorDia || 10,
      // v1139 — não dá pra usar "||" aqui: 0 (resgate desligado) é escolha válida e "||" jogaria
      // fora. Campo vazio = vale o que está salvo.
      resgatesPorDia: cpLerResgatesDiaDoFormulario(cfg),
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
// v1139 — lê "Resgates por dia" do formulário do Cérebro. 0 é valor válido (desliga o resgate),
// então campo vazio/não montado NUNCA pode virar 0 à força — vazio = vale o que está salvo
// (ou o padrão 2, aplicado pelo sanitizador).
function cpLerResgatesDiaDoFormulario(cfg){
  const raw = String(qs("#cerebroResgatesDia")?.value ?? "").trim();
  if(raw === "") return cfg?.resgatesPorDia ?? 2;
  const n = Number(raw);
  return Number.isFinite(n) ? n : (cfg?.resgatesPorDia ?? 2);
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


// v1268 (2ª passada) — garantirIntelCarregado REMOVIDA. Ela buscava a inteligência aprendida do
// Cérebro (uma chamada de rede) TODA VEZ que um cliente era aberto, guardava num cache… e o único
// consumidor era renderLeadsParecidos, a seção que já estava desligada e saiu nesta mesma faxina.
// Ou seja: pedido de rede no caminho crítico de abrir cliente, pra alimentar um cache que ninguém
// lia. O aprendizado em si continua intacto — quem o usa de verdade é a tela do Cérebro
// (cerebroIntel, mais abaixo) e a análise, no servidor.

// v1268 — renderLeadsParecidos REMOVIDA na faxina (eram ~75 linhas).
// A seção "Você já trabalhou clientes parecidos" foi ocultada a pedido do corretor ("confundia
// mais que ajudava"), e o jeito de ocultar foi pôr um `return ""` na primeira linha — o resto do
// desenho ficou ali, inalcançável, e nem a função era mais chamada por alguém. O aprendizado por
// trás (inteligenciaAprendida) não muda: quem o usa de verdade é a tela do Cérebro e a análise,
// no servidor.

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
        <div style="padding:10px 12px;background:var(--acao-soft);border:1px solid var(--line);border-radius:10px">
          <div style="font-size:9px;color:var(--acao);text-transform:uppercase;letter-spacing:.18em;font-weight:950">WhatsApp abertos</div>
          <div style="font-size:24px;font-weight:950;margin-top:2px">${stats.whatsappAbertos}</div>
        </div>
        <div style="padding:10px 12px;background:rgba(86,199,242,.05);border:1px solid var(--line);border-radius:10px">
          <div style="font-size:9px;color:var(--dados);text-transform:uppercase;letter-spacing:.18em;font-weight:950">Mensagens copiadas</div>
          <div style="font-size:24px;font-weight:950;margin-top:2px">${stats.mensagensCopiadas}</div>
        </div>
        ${estiloMaisUsado ? `<div style="padding:10px 12px;background:rgba(155,140,255,.05);border:1px solid var(--line);border-radius:10px">
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
  // v1186 — a biblioteca de ZIP deixou de vir carregada em toda abertura do app (ver ensureJSZip):
  // aqui era só uma checagem que mandava "atualize a página"; agora pede a biblioteca de fato.
  const JSZipLib = await ensureJSZip();
  if(!JSZipLib) throw new Error("Gerador de arquivos indisponível. Verifique sua internet e tente de novo.");
  const zip = new JSZipLib();
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
      const tag = e.funcionou === true ? `<span style="display:inline-block;padding:1px 7px;margin-left:6px;background:var(--acao-soft);color:var(--acao);border:1px solid var(--acao);border-radius:999px;font-size:10px;font-weight:950">FUNCIONOU</span>`
                : e.funcionou === false ? `<span style="display:inline-block;padding:1px 7px;margin-left:6px;background:var(--risco-soft);color:var(--risco);border:1px solid var(--risco);border-radius:999px;font-size:10px;font-weight:950">NÃO funcionou</span>`
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
      ? (pendenciasAuto ? `${pendenciasAuto} ${pl(pendenciasAuto, "atualização aguardando", "atualizações aguardando")} leitura automática.` : "Carteira inicial processada. Novas mensagens entram automaticamente.")
      : "Processando os históricos existentes em segundo plano.";
    const header = `<div style="margin-bottom:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;padding:14px 16px;background:linear-gradient(135deg,rgba(255,98,88,.08),rgba(86,199,242,.04));border:1px solid var(--lime);border-radius:12px">
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
      <div style="grid-column:1/-1;padding:14px 16px;background:linear-gradient(135deg,rgba(86,199,242,.06),rgba(255,98,87,.05));border:1px solid var(--dados);border-radius:12px">
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
      cpAprendAgendarRetomada(60000);
      return { ok:false, processados, error:e?.message || String(e), status:ultimoStatus };
    }
    if(data?.vazio){ ultimoStatus = data.aprendizadoAutomatico || ultimoStatus; break; }
    if(!data?.ok){
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
      cpAprendSalvarNumero(CP_APREND_AUTO_OFFSET_KEY, status?.bootstrapConcluidoEm ? 0 : cpAprendLerNumero(CP_APREND_AUTO_OFFSET_KEY, 0));
      return fila.ok;
    }

    let offset = forcar ? 0 : cpAprendLerNumero(CP_APREND_AUTO_OFFSET_KEY, 0);
    if(forcar){ pendentes = []; cpAprendSalvarPendentes([]); cpAprendSalvarNumero(CP_APREND_AUTO_OFFSET_KEY, 0); }
    totalCarteira = Number(status?.totalCarteiraNoBootstrap || 0);

    for(let loops=0; loops<10000; loops++){
      cpAprendRenovarLock();
      const atualOffset = offset;
      let data;
      try{ data = await cpAprendChamarLote(atualOffset, forcar); }
      catch(e){
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
      await new Promise(r=>setTimeout(r, 450));
    }

    // Uma falha transitória não é abandonada. Cada offset problemático volta à fila
    // e só depois de todos terem sido recuperados o bootstrap é marcado como concluído.
    const aindaPendentes = [];
    for(let i=0; i<pendentes.length; i++){
      const off = pendentes[i];
      cpAprendRenovarLock();
      try{
        const d = await cpAprendChamarLote(off, true);
        if(Number(d.errosIA||0)>0 || Number(d.falhasSalvar||0)>0) aindaPendentes.push(off);
      }catch(_){ aindaPendentes.push(off); }
      cpAprendSalvarPendentes(aindaPendentes.concat(pendentes.slice(i+1)));
      await new Promise(r=>setTimeout(r, 700));
    }
    cpAprendSalvarPendentes(aindaPendentes);
    if(aindaPendentes.length){
      cpAprendAgendarRetomada(90000);
      return false;
    }

    // Absorve também alterações que chegaram enquanto a varredura inicial estava rodando.
    await cpAprendProcessarFilaPendente(30);
    const totalConfirmado = totalCarteira || offset || processadosNestaRodada;
    const fim = await cpAprendFinalizar(totalConfirmado);
    cpAprendSalvarNumero(CP_APREND_AUTO_OFFSET_KEY, 0);
    cpAprendSalvarPendentes([]);
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
      ? (pendenciasAuto ? `${pendenciasAuto} ${pl(pendenciasAuto, "conversa nova está", "conversas novas estão")} na fila de aprendizado automático.` : "A carteira existente já foi lida. Novas mensagens importadas, reimportações, reanálises e observações manuais atualizam esta memória automaticamente.")
      : "A leitura inicial da carteira está acontecendo em segundo plano. Você pode continuar usando o sistema normalmente.";
    const grade = cats.map(c => `<div style="padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.025)">
      <div style="color:${c.cor};text-transform:uppercase;letter-spacing:.1em;font-weight:950;font-size:9px;margin-bottom:3px">${c.label}</div>
      <div style="font-size:20px;font-weight:950">${(ia[c.key]||[]).length}</div>
    </div>`).join("");
    box.innerHTML = `
      <div style="padding:13px 14px;border:1px solid var(--acao);border-radius:12px;background:linear-gradient(135deg,var(--acao-soft),rgba(86,199,242,.03));margin-bottom:12px">
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

// v1199 — tela "Planos": mostra o plano da conta e explica os dois planos comerciais (limite de
// uso e preço). Usa a MESMA leitura que a tela do Cérebro já faz (api/cerebro-config, GET) — o
// servidor devolve planoAtual + catalogoPlanos junto do resto, sem rota nova (o projeto está
// perto do teto de 12 funções da Vercel — ver ESTADO-ATUAL.md).
async function carregarPlanos(){
  const box = qs("#planosConteudo");
  if(!box) return;
  box.textContent = "Carregando...";
  try{
    const res = await fetch("./api/cerebro-config", { cache:"no-store" });
    const d = await res.json().catch(() => ({}));
    if(!d?.ok) throw new Error(d?.error || "falha ao carregar");
    const { planoAtual, catalogoPlanos } = d;
    const zap = '5554999013331';
    // v1284 — o bônus de carga inicial (as análises de boas-vindas dos primeiros dias) só aparece
    // no cartão do plano que a conta realmente tem, e some sozinho quando a janela acaba.
    const bonus = Number(catalogoPlanos?.bonusEntrada) || 0;
    const cardHTML = (tipo, dados) => {
      const ehAtual = !planoAtual?.principal && !planoAtual?.emTeste && planoAtual?.plano?.tipo === tipo;
      const precoBR = "R$ " + Number(dados.preco).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
      return `<div class="plano-card${ehAtual ? " atual" : ""}">
        ${ehAtual ? '<div class="plano-selo-atual">Seu plano atual</div>' : ""}
        <h3>${escapeHtml(dados.nome)}</h3>
        <div class="plano-preco">${precoBR}<small> /mês</small></div>
        <ul>
          <li><span><b>${dados.mes}</b> análises de conversa por mês, <b>sem limite por dia</b></span></li>
          ${ehAtual && bonus > 0 ? `<li class="plano-bonus"><span>Mais <b>${bonus}</b> análises de boas-vindas, pra trazer a carteira inteira agora</span></li>` : ""}
          <li><span>Fila "Fazer agora", Agenda, Cérebro Comercial e Desempenho sem limite</span></li>
        </ul>
      </div>`;
    };
    const seloTopo = planoAtual?.principal
      ? '<div class="plano-selo-atual" style="background:rgba(255,255,255,.06);border-color:var(--line);color:var(--soft)">Conta principal — fora dos planos comerciais</div>'
      : planoAtual?.emTeste
        ? '<div class="plano-selo-atual" style="background:rgba(255,196,90,.12);border-color:rgba(255,196,90,.4);color:#ffc45a">Você está no teste grátis de 7 dias</div>'
        : "";
    box.innerHTML = `
      ${seloTopo}
      <div class="small" style="color:var(--soft);line-height:1.6;margin-top:${seloTopo ? "10px" : "0"}">
        Cada análise é uma conversa importada (ou reimportada) lida pelo Cérebro Comercial.
        Você usa como quiser dentro do mês — pode colocar a carteira inteira em dia num sábado, se preferir.
        Se acabar antes do fim do mês, dá pra comprar mais ${Number(catalogoPlanos?.pacoteExtra?.analises) || 30} análises por ${escapeHtml(catalogoPlanos?.pacoteExtra?.precoBR || "R$ 39,00")} sem trocar de plano.
      </div>
      <div class="plano-cards">
        ${cardHTML("pro", catalogoPlanos.pro)}
        ${cardHTML("pro-master", catalogoPlanos["pro-master"])}
      </div>
      <div class="small" style="color:var(--muted);margin-top:14px">Precisa de mais que isso, ou quer trocar de plano? <a href="https://wa.me/${zap}?text=${encodeURIComponent("Olá! Quero falar sobre o meu plano no Corretor Pro.")}" target="_blank" rel="noopener" style="color:var(--lime);font-weight:800">Fale pelo WhatsApp</a>.</div>
    `;
  }catch(err){
    box.innerHTML = `<div class="small" style="color:var(--risco)">Não consegui carregar os planos agora: ${escapeHtml(err?.message || String(err))}</div>`;
  }
}
window.carregarPlanos = carregarPlanos;

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
  const inpAtend = qs("#cerebroAtendimentosDia");
  if(inpAtend) inpAtend.value = (Number(config.atendimentosPorDia) >= 1) ? config.atendimentosPorDia : 10;
  const inpResg = qs("#cerebroResgatesDia");
  if(inpResg) inpResg.value = Number.isFinite(Number(config.resgatesPorDia)) ? config.resgatesPorDia : 2;
  const inpDescanso = qs("#cerebroDiasDescanso");
  if(inpDescanso) inpDescanso.value = (Number(config.diasDescansoPosAtendimento) >= 1) ? config.diasDescansoPosAtendimento : 5;
  // v1091 — marca os dias em que ele atende.
  const diasSalvos = cpNormalizarDiasAtendimento(config.diasAtendimento);
  qsa('#cerebroDiasSemana input[type="checkbox"]').forEach(c => { c.checked = diasSalvos.includes(Number(c.dataset.dia)); });
  // Regras e objeções em blocos únicos de texto.
  if(qs("#cerebroRegrasTexto")) qs("#cerebroRegrasTexto").value = config.regrasTexto || "";
  if(qs("#cerebroObjecoesTexto")) qs("#cerebroObjecoesTexto").value = config.objecoesTexto || "";
  cerebroFormularioCarregado = true;
  // v1137 — o guia de primeiro uso aparece enquanto o Cérebro está VAZIO (mesma régua do servidor,
  // hasCerebroInstructions: só os campos de instrução contam — nome sozinho não tira o guia).
  const cerebroTemConteudo = [config.metodo, config.tom, config.diferenciais, config.evitar, config.regrasTexto, config.objecoesTexto]
    .some(v => String(v || "").trim());
  const guiaInicio = qs("#cerebroGuiaInicio");
  if(guiaInicio) guiaInicio.style.display = cerebroTemConteudo ? "none" : "block";
  // Carregou certo: a caixa fica VAZIA. A prova de que carregou são os campos preenchidos logo
  // acima — deixar um "Configuração carregada." fixo só repetiria na tela o que já está à vista.
  if(aviso) status.innerHTML = '<span style="color:var(--soft)">' + escapeHtml(aviso) + '</span>';
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
      || Number(anterior.atendimentosPorDia) !== Number(fresco.atendimentosPorDia)
      || Number(anterior.resgatesPorDia) !== Number(fresco.resgatesPorDia); // v1139 — muda a ordem da dose
    if(mudouRegraDeFila && typeof refreshAllSections === "function") refreshAllSections();
  }catch(_){ /* sem rede/sessão ainda — a Home continua com o que já tinha */ }
}
cp7SincronizarCerebroConfigInicial();

// v1185 — aqui existia um botão "Copiar SQL" que copiava um comando de criar tabela vindo do
// servidor. O comando era do desenho antigo (um Cérebro só pro sistema inteiro, sem separação por
// corretor); rodá-lo hoje juntaria a configuração de contas diferentes na mesma linha. As três
// auditorias de 08/2026 pediram a retirada. O aviso agora só diz o que houve.

// v1198 — o campo "Período padrão dos áudios" saiu da tela do Cérebro. O período continua
// existindo por dentro (limita só a transcrição de áudio na importação — proteção de custo),
// mas agora vale o que já está salvo, sem formulário: quem tinha um valor próprio mantém,
// todo o resto fica no padrão 90. Salvar o Cérebro NÃO pode rebaixar um valor salvo pra 90.
function cpDiasImportacaoSalvo(){
  try{
    const d = Number(JSON.parse(localStorage.getItem(CEREBRO_LS_KEY) || "null")?.diasImportacao);
    if(Number.isFinite(d) && d > 0 && d <= 365) return Math.round(d);
  }catch(_){}
  return 90;
}

async function salvarCerebro(){
  const atendRaw = qs("#cerebroAtendimentosDia")?.value;
  const atendN = Number(atendRaw);
  // v1139 — 0 é válido (desliga o resgate); só campo realmente vazio cai no padrão (via NaN).
  const resgRaw = qs("#cerebroResgatesDia")?.value;
  const resgN = String(resgRaw ?? "").trim() === "" ? NaN : Number(resgRaw);
  const descansoRaw = qs("#cerebroDiasDescanso")?.value;
  const descansoN = Number(descansoRaw);
  const config = {
    corretorNome: qs("#cerebroCorretorNome")?.value || "",
    metodo: qs("#cerebroMetodo").value,
    tom: qs("#cerebroTom").value,
    diferenciais: qs("#cerebroDiferenciais").value,
    evitar: qs("#cerebroEvitar").value,
    diasImportacao: cpDiasImportacaoSalvo(),
    atendimentosPorDia: (Number.isFinite(atendN) && atendN >= 1 && atendN <= 50) ? Math.round(atendN) : 10,
    resgatesPorDia: (Number.isFinite(resgN) && resgN >= 0 && resgN <= 20) ? Math.round(resgN) : 2,
    diasDescansoPosAtendimento: (Number.isFinite(descansoN) && descansoN >= 1 && descansoN <= 60) ? Math.round(descansoN) : 5,
    diasAtendimento: cpLerDiasAtendimentoDoFormulario() ?? [...CP_DIAS_ATENDIMENTO_PADRAO],
    regrasTexto: qs("#cerebroRegrasTexto")?.value || "",
    objecoesTexto: qs("#cerebroObjecoesTexto")?.value || "",
    regras: [],
    objecoes: []
  };
  // v1241 — AUDITORIA DO DONO (13/08/2026): "os campos do Cérebro são truncados no servidor em
  // 20.000 caracteres por campo e 60.000 nas regras... alguém pode colar 25.000, ver isso na tela,
  // e o banco ficar só com os primeiros 20.000, sem aviso claro". Verdade: o corte era silencioso,
  // e o Cérebro é a peça mais importante do produto — perder texto dele sem avisar é inaceitável.
  // Agora avisa ANTES de salvar, dizendo o campo, quanto tem e quanto vai caber.
  const LIMITES_CEREBRO = { metodo:20000, tom:20000, diferenciais:20000, evitar:20000, regrasTexto:60000, objecoesTexto:60000 };
  const NOMES_CEREBRO = { metodo:"Método", tom:"Tom de voz", diferenciais:"Diferenciais", evitar:"O que evitar", regrasTexto:"Regras", objecoesTexto:"Objeções" };
  const estourados = Object.keys(LIMITES_CEREBRO)
    .map(k => ({ k, tam: String(config[k] || "").length, lim: LIMITES_CEREBRO[k] }))
    .filter(x => x.tam > x.lim);
  if (estourados.length) {
    const lista = estourados
      .map(x => `• ${NOMES_CEREBRO[x.k]}: ${x.tam.toLocaleString("pt-BR")} caracteres — cabem ${x.lim.toLocaleString("pt-BR")} (perde ${(x.tam - x.lim).toLocaleString("pt-BR")})`)
      .join("\n");
    const aviso = `Este texto não cabe inteiro e o final vai ser cortado ao salvar:\n\n${lista}\n\nSalvar mesmo assim vai perder o final desse texto. Prefere voltar e encurtar?`;
    const seguir = (typeof cp903Confirm === "function")
      ? await cp903Confirm({ titulo: "O Cérebro não cabe inteiro", mensagem: aviso, ok: "Salvar assim mesmo", cancelar: "Voltar e encurtar", perigo: true })
      : confirm(aviso);
    if (!seguir) return;
  }
  const configSanitizado = sanitizeCerebroConfigV762(config);
  try{ localStorage.setItem(CEREBRO_LS_KEY, JSON.stringify(configSanitizado)); }catch(_){}
  const status = qs("#cerebroStatus");
  status.textContent = "Salvando...";
  try{
    const res = await fetch("./api/cerebro-config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(configSanitizado) });
    const data = await res.json();
    if(data?.warning){
      status.innerHTML = '<span style="color:var(--morno)">Salvo neste aparelho, mas ainda não no servidor — então não sincroniza entre celular e computador. '
        + escapeHtml(String(data.proximoPasso || "Fale com o suporte para acertar o banco."))
        + '</span>';
    } else if(data?.ok){
      status.textContent = "Salvo no banco.";
      toast("Cérebro salvo.");
    } else {
      status.innerHTML = '<span style="color:#ff5b7a">Erro: '+escapeHtml(data?.error||"")+'</span>';
    }
  }catch(err){
    status.innerHTML = '<span style="color:var(--soft)">Salvo no navegador (sem banco): '+escapeHtml(String(err?.message||err))+'</span>';
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
      diasImportacao: cpDiasImportacaoSalvo(),
      // Meta diária, resgates e dias de descanso são preferência de trabalho (como o período
      // dos áudios), não aprendizado — ficam.
      atendimentosPorDia: Number(qs("#cerebroAtendimentosDia")?.value) || 10,
      resgatesPorDia: cpLerResgatesDiaDoFormulario(null),
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

// v1195 — openAIErrorBlock foi junto pro pedaço da importação (js/importacao.js).

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

export function cpImportOverlayVisivel(mostrar){
  const el = qs("#cpImportOverlay");
  if(!el) return;
  // v1224 — a partir daqui quem manda na tela cheia é o app. A marca de "entrando pelo
  // compartilhar" (posta no <head>, antes da primeira pintura, pra não haver frame de outra tela)
  // cumpriu o papel e sai: se ficasse, o CSS dela continuaria mostrando a tela cheia mesmo depois
  // de o app mandar escondê-la.
  try{ document.documentElement.classList.remove("cp-entrando-pelo-share"); }catch(_){ }
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
    cpioPararRelogioEtapa();
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
// v1290 — O TEMPO COM O APP EM SEGUNDO PLANO NÃO CONTA PRO VIGIA.
//
// Print do dono (17/08/2026, 12h43): ele mandou a conversa, saiu do app pra fazer outra coisa e,
// ao voltar, viu a TELA VELHA da importação — a lista "Recebendo / Enviando / Extraindo…" parada
// em "Extraindo (48%)" —, e só uns segundos depois a tela cheia certa voltou, em 87% "Analisando".
// Nada tinha travado: enquanto o celular fica com o app atrás, o navegador CONGELA os relógios da
// página; o relógio de 1 segundo que dá prova de vida para de rodar, e o vigia de 2 minutos (que
// existe pra ninguém ficar preso numa tela morta) dispara sozinho na volta, fechando a tela cheia
// e deixando à mostra a tela de baixo, congelada no último passo que ela chegou a desenhar.
//
// Agora o vigia mede tempo PARADO COM O APP NA FRENTE. O que se passa em segundo plano é
// descontado, e voltar pro app reinicia a contagem — a tela cheia só cai se, com o corretor
// olhando, a importação passar 2 minutos sem dar nenhum sinal.
let _cpioSinal = 0;      // quando a importação deu o último sinal de vida
let _cpioForaDesde = 0;  // desde quando o app está em segundo plano (0 = está na frente)
function cpioParadoHaMs(){
  const fora = _cpioForaDesde ? Date.now() - _cpioForaDesde : 0;
  return Math.max(0, Date.now() - _cpioSinal - fora);
}
function cpioAgendarVigia(ms){
  clearTimeout(_cpioVigia);
  _cpioVigia = setTimeout(cpioVigiaBateu, Math.max(1000, ms));
}
function cpioVigiaBateu(){
  const falta = CPIO_VIGIA_MS - cpioParadoHaMs();
  // Dormiu em segundo plano (ou o relógio disparou atrasado): ainda não é hora de desistir.
  if(falta > 0){ cpioAgendarVigia(falta); return; }
  _cpioUltimoEstado = null; // desistiu de vez: voltar pro app não ressuscita esta tela
  try{ cpImportOverlayVisivel(false); }catch(_){}
}
function cpioRearmarVigia(){
  clearTimeout(_cpioVigia);
  _cpioSinal = Date.now();
  cpioAgendarVigia(CPIO_VIGIA_MS);
}

function cpioPararAnimacao(){
  if(_cpioTimer){ clearInterval(_cpioTimer); _cpioTimer = null; }
}

// v1174 — RELÓGIO DA ETAPA LONGA ("chega em 92% e trava", print do dono em 06/08/2026).
//
// O anel nunca passa do percentual da etapa SEGUINTE menos 2 — e a etapa "Analisando pelo seu
// Cérebro" começa em 86% e a seguinte em 94%, ou seja, o número sobe até 92% e para ali. Enquanto
// a IA escreve (dezenas de segundos numa conversa grande), a tela fica idêntica de um minuto pro
// outro: 92%, mesmo texto, nada se mexendo. Quem olha conclui que travou — e não travou, está
// esperando. Faltava o app dizer isso.
//
// Agora, nas duas etapas que realmente demoram (ouvir os áudios e analisar), o detalhe embaixo do
// título conta os segundos ("… · 38s"). É a prova de vida que o percentual sozinho não dá.
// Enquanto o relógio corre, o vigia que fecha a tela por inatividade é rearmado — antes ele podia
// fechar tudo aos 2 minutos com o servidor ainda trabalhando, e aí o corretor via a tela sumir sem
// resposta nenhuma. Passados 4 minutos o rearme para, e o vigia volta a poder encerrar (ninguém
// pode ficar preso pra sempre numa tela).
// v1290 — "Abrindo o arquivo" (2) entrou na lista. Numa conversa grande (a do print tinha quase
// 1 GB), o servidor fica minutos abrindo o ZIP sem nada pra dizer: a tela ficava congelada em
// "Abrindo o arquivo · 48%" e era justamente aí que o vigia derrubava a tela cheia. Com o
// contador de segundos, a etapa mostra que está viva e segura o vigia como as outras duas.
const CPIO_RELOGIO_ETAPAS = [2, 3, 4];
const CPIO_RELOGIO_LIMITE_S = 240;
let _cpioRelogio = null, _cpioRelogioBase = "", _cpioRelogioInicio = 0;

export function cpioPararRelogioEtapa(){
  if(_cpioRelogio){ clearInterval(_cpioRelogio); _cpioRelogio = null; }
}

function cpioIniciarRelogioEtapa(textoBase){
  cpioPararRelogioEtapa();
  _cpioRelogioBase = String(textoBase || "");
  _cpioRelogioInicio = Date.now();
  _cpioRelogio = setInterval(() => {
    const seg = Math.round((Date.now() - _cpioRelogioInicio) / 1000);
    const det = qs("#cpioSub");
    // Só a partir de 5s: numa conversa pequena a etapa passa voando e um contador piscando
    // "1s… 2s…" seria ruído, não informação.
    if(det) det.textContent = seg >= 5 ? `${_cpioRelogioBase} · ${seg}s` : _cpioRelogioBase;
    if(seg <= CPIO_RELOGIO_LIMITE_S) cpioRearmarVigia();
  }, 1000);
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
  // Etapa nova: o relógio da anterior para aqui, senão ele continuaria reescrevendo o detalhe.
  cpioPararRelogioEtapa();
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
  const textoDetalhe = String(sub || passo.sub || "");
  const det = qs("#cpioSub"); if(det) det.textContent = textoDetalhe;
  if(CPIO_RELOGIO_ETAPAS.includes(idx)) cpioIniciarRelogioEtapa(textoDetalhe);
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
let _cpioUltimoEstado = null; // v1290 — o que a tela cheia mostra agora (null = não há importação de pé)
function cpImportOverlaySincronizar(idx, sub, opts){
  // v1290 — memória do passo atual, pra tela cheia poder voltar exatamente como estava quando o
  // corretor volta pro app. Só vale enquanto a importação está trabalhando sozinha (0..5): num
  // ponto de espera pela resposta dele, ao concluir ou ao falhar, não há nada pra ressuscitar.
  _cpioUltimoEstado = (idx >= 0 && idx <= 5 && !(opts && (opts.pausar || opts.aguardando)))
    ? { idx, sub }
    : null;
  // v1223 — `aguardando` (a espera pela resposta do corretor, criada na v1219) precisa fazer a
  // MESMA coisa que `pausar`: tirar a tela cheia da frente. Faltava esta linha, e o efeito foi o
  // print do dono às 19h32 — "travou aqui": a tela cheia dizia "Salvando na carteira · 98% ·
  // responda a pergunta acima pra continuar" e ficava assim pra sempre. A pergunta ESTAVA pronta
  // atrás dela, no topo da tela, mas coberta — e a tela cheia ainda trava a rolagem do corpo da
  // página (body.cpio-aberto), então nem rolar até ela dava. O caminho era: a importação fechava a
  // tela cheia e, na linha seguinte, renderEtapas(5, …, {aguardando:true}) caía no ramo "idx 0..5"
  // abaixo e a reabria na hora.
  if(opts && (opts.pausar || opts.aguardando)){ cpImportOverlayVisivel(false); return; }
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

window.cpImportOverlaySincronizar = cpImportOverlaySincronizar;

// v1290 — VOLTAR PRO APP NUNCA MAIS MOSTRA A TELA VELHA DA IMPORTAÇÃO.
// Sair do app não interrompe a importação (o envio e a análise continuam), então, ao voltar, o
// corretor tem que reencontrar a MESMA tela cheia que deixou, no passo em que a conversa está —
// e não a lista antiga de etapas, congelada no último passo que ela chegou a desenhar.
function cpioAppFoiProSegundoPlano(){
  if(!_cpioForaDesde) _cpioForaDesde = Date.now();
}
function cpioAppVoltouDoSegundoPlano(){
  _cpioForaDesde = 0;
  if(!_cpioUltimoEstado) return;   // nenhuma importação de pé: não há nada pra trazer de volta
  _cpioSinal = Date.now();         // o tempo fora não conta: a contagem do vigia recomeça agora
  const relogioComecouEm = _cpioRelogioInicio;
  try{
    cpImportOverlayAtualizar(_cpioUltimoEstado.idx, _cpioUltimoEstado.sub);
    // O contador de segundos da etapa não volta pro zero: ele conta desde que a etapa começou de
    // verdade, senão a tela mentiria dizendo que a análise acabou de começar.
    if(relogioComecouEm && _cpioRelogio) _cpioRelogioInicio = relogioComecouEm;
    cpImportOverlayVisivel(true);
  }catch(_){}
}
if(typeof document !== "undefined"){
  document.addEventListener("visibilitychange", () => {
    if(document.hidden) cpioAppFoiProSegundoPlano(); else cpioAppVoltouDoSegundoPlano();
  });
}

// Bloqueia/reabilita os botões "Nova análise" e "Diagnóstico" da tela de
// importação. Durante o processamento (Recebendo…Salvando) eles não podem ser
// clicados; voltam a ficar ativos só quando a etapa chega em "Concluído" (ou
// numa falha recuperável, pra permitir recomeçar/diagnosticar).
export function setBotoesImportacao(desabilitados){
  ["#clearAnalysis", "#diagnoseOpenAI"].forEach(sel => {
    const btn = qs(sel);
    if(!btn) return;
    btn.disabled = !!desabilitados;
    btn.classList.toggle("is-processando", !!desabilitados);
  });
}

// v1219 — ESPERANDO VOCÊ ≠ TRABALHANDO.
//
// Print do dono ("de novo dando pau"): a tela mostrava "Salvando — preparando pra salvar" com a
// rodinha girando e a barra quase cheia... enquanto o app, na verdade, estava PARADO esperando
// ele responder "é o mesmo cliente?" logo abaixo. Quem olha vê trabalho em andamento que não
// termina nunca — a leitura óbvia é que travou. Com opts.aguardando a linha para de girar, muda
// de cor e diz o que falta: uma resposta dele.
export function renderEtapas(idxAtual, sub, opts){
  const aguardando = !!(opts && opts.aguardando);
  // Etapas 0..5 (Recebendo…Salvando) = em andamento → botões travados.
  // Etapa 6 (Concluído) e 7 (Falha recuperável) → botões liberados.
  setBotoesImportacao(!aguardando && idxAtual >= 0 && idxAtual <= 5);
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
    else if(i === idxAtual){
      icone = idxAtual === 7 ? "!" : aguardando ? "?" : "";
      cor = (idxAtual === 7 || aguardando) ? "var(--morno)" : "var(--lime)";
      peso = "950";
    }
    const rotulo = (i === idxAtual && aguardando) ? "Esperando sua resposta" : label;
    const extra = (i === idxAtual && sub) ? ` <span style="color:var(--muted);font-weight:400">— ${escapeHtml(sub)}</span>` : "";
    return `<li style="padding:4px 0;color:${cor};font-weight:${peso}"><span style="display:inline-block;width:18px">${icone}</span>${escapeHtml(rotulo)}${extra}</li>`;
  }).join("");
  const pctPorEtapa = [8, 32, 48, 70, 86, 94, 100, 100];
  const pct = pctPorEtapa[idxAtual] ?? 0;
  const bar = qs("#progressBar"); if(bar) bar.style.width = pct + "%";
  const txt = qs("#processingText");
  if(txt){
    const semRodinha = idxAtual === 7 || aguardando;
    const titulo = aguardando ? "Esperando sua resposta" : ETAPAS_PROCESSAMENTO[idxAtual];
    txt.innerHTML = (semRodinha ? "" : '<span class="spinner"></span>') + escapeHtml(titulo) + (sub ? ` — ${escapeHtml(sub)}` : "") + ` <span style="opacity:.7">(${pct}%)</span>`;
  }
}




export function userFriendlyError(err,file){
  const raw=String(err?.message||err||"");
  // v1174 — o servidor já explicou em português que o teto de análises do dia foi atingido (e,
  // quando é conta de plano, já veio o convite pra falar no WhatsApp). Esse texto passa inteiro,
  // sem virar "não foi possível analisar" genérico: é a única mensagem que diz o que fazer.
  if(err?.limiteAtingido) return raw;
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
export const CP_IMPORT_PENDENTE_KEY = "cpImportPendente";
export const CP_IMPORT_PENDENTE_VALIDADE_MS = 24 * 60 * 60 * 1000; // 24h — depois disso não faz sentido reaproveitar











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



// v1175 — FIM DE LINHA HONESTO QUANDO A GRAVAÇÃO NÃO TERMINA.
//
// Print do dono (07/08/2026, versão 1174): depois da importação inteira, a tela ficou em
// "Salvando — salvando no banco de dados... (94%)" com a rodinha girando, sem nada acontecer. Não
// tinha travado: a gravação FALHOU, o aviso saiu num toast — que some sozinho em segundos — e
// ninguém mais mexeu naquela linha de andamento. Ela ficava congelada no último estado bom que
// tinha visto, com a rodinha girando e os botões "Nova análise"/"Diagnóstico" ainda travados
// (quem os libera é o mesmo desenho de etapas que não foi chamado). Do lado de cá parecia
// exatamente um travamento; do lado de lá já tinha acabado, mal.
//
// É a mesma lição do 92% da v1174: todo caminho de erro precisa MEXER na tela que ficou pra trás.
export function cpImportacaoFalhouNaGravacao(titulo, err){
  const motivo = userFriendlyError(err);
  // Etapa 7 = "Falha recuperável": para a rodinha, destrava os botões e deixa o motivo escrito na
  // própria linha de andamento (não só num toast que some).
  try{ renderEtapas(7, motivo); }catch(_){ try{ cpImportOverlayVisivel(false); }catch(_){} }
  const pendingBox = qs("#pendingBox");
  if(pendingBox){
    pendingBox.style.background = "var(--risco-soft)";
    pendingBox.style.borderColor = "var(--risco-line)";
    pendingBox.style.color = "#ffd9d9";
    pendingBox.innerHTML = `<b>${escapeHtml(titulo)}.</b><br>${escapeHtml(motivo)}<br><br>A análise <b>não foi perdida</b> — os botões abaixo continuam valendo.`;
  }
  toast(titulo + ": " + motivo);
}
// Expostas pelo mesmo motivo de cpImportOverlaySincronizar: poder dirigir a tela da importação de
// fora, num navegador de verdade, pra conferir o RESULTADO na tela (e pra diagnóstico). É assim
// que a v1175 foi conferida: pôr a tela no estado do print (etapa 5, rodinha girando) e mandar a
// gravação falhar, vendo a rodinha parar e o motivo aparecer escrito.
window.renderEtapas = renderEtapas;
window.cpImportacaoFalhouNaGravacao = cpImportacaoFalhouNaGravacao;



// v1195 — processFile e as outras 28 funções da importação moram agora em js/importacao.js,
// baixado só na hora em que uma conversa é importada. A ponte preguiçosa está mais abaixo.

// ── v1195 — PONTE PREGUIÇOSA DA IMPORTAÇÃO ──────────────────────────────────────────────────
// O pedaço js/importacao.js (43 KB publicados) só é buscado quando o corretor realmente importa
// uma conversa. A promessa é guardada pra que duas chamadas seguidas não baixem duas vezes.
let _moduloImportacao = null;
function carregarModuloImportacao(){
  // v1248 — a promessa guardada não pode ser a promessa QUEBRADA. Antes, uma única falha de rede
  // (elevador, 4G oscilando, ou o recebedor instalado no celular ainda servindo o endereço da
  // versão anterior logo depois de uma publicação) ficava guardada aqui pra sempre: toda tentativa
  // seguinte de importar falhava na hora, sem nem tentar a rede de novo, até fechar e reabrir o
  // app. O jeito certo já existia no próprio arquivo, em ensureJSZip: zerar em caso de falha.
  if(!_moduloImportacao){
    _moduloImportacao = import('./js/importacao.js?v=__VERSION__').catch(err => {
      _moduloImportacao = null;
      throw err;
    });
  }
  return _moduloImportacao;
}
// Assinatura idêntica à de antes, e continua devolvendo promessa: os dois chamadores existentes
// são `await processFile(...)` (retomada de compartilhamento) e `processFile(file)` solto (o
// seletor de arquivo) — ambos seguem funcionando sem mudança.
async function processFile(file, options = {}){
  const mod = await carregarModuloImportacao();
  return mod.processFile(file, options);
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
// v1209 — "este compartilhamento já foi resolvido nesta aba, não entre no modo importação de novo".
// CP_VEIO_DE_SHARE é lido uma vez só, no arranque, e continua verdadeiro mesmo depois de o endereço
// ser limpo — então a segunda passada de checkShared() (a que roda ~1s depois, junto com o service
// worker) reentrava na tela de importação e ficava 15 segundos procurando um ZIP que sabidamente
// nunca chegou, apagando o aviso que o dono estava lendo.
let __cpShareEncerrado = false;

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

export async function finalizarSharePendente(id){
  await Promise.allSettled([shareIdbDel(id), apagarShareDoCache(id)]);
  if(String(state.pendingSharedRecordId||'')===String(id||'')) state.pendingSharedRecordId='';
  window.__cpShareImportActive=false;
  try{ history.replaceState(null,'',location.pathname); }catch(_){ }
}
window.finalizarSharePendente=finalizarSharePendente;

export async function descartarSharePendente(id){
  await finalizarSharePendente(id);
  toast('Envio descartado.');
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

// v1209 — religa o recebedor de conversas compartilhadas (o service worker) na hora, sem esperar
// o 'load' da página. Quando o app é aberto justamente porque um compartilhamento se perdeu por
// falta dele, esperar o fim do carregamento pra reinstalá-lo é tempo perdido.
function religarRecebedorDeConversa(){
  try{
    if(!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register("/service-worker.js?v=__VERSION__", { scope: "/" }).catch(()=>{});
  }catch(_){ }
}

function mostrarRecebimentoShare(){
  show('zip');
  qs('#processingBox')?.classList.add('show');
  if(qs('#processingText')) qs('#processingText').textContent='Conversa recebida. Preparando…';
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
  const cameFromShare=!__cpShareEncerrado && (CP_VEIO_DE_SHARE || params.has('shared') || params.get('source')==='share-target' || params.has('share-target'));

  // Uma abertura normal do aplicativo nunca deve procurar ZIPs antigos no IndexedDB/cache.
  // Antes, checkShared() era chamado no boot mesmo sem Share Target e acabava escolhendo o
  // primeiro registro pendente antigo, começando sozinho uma importação já feita.
  if(!cameFromShare){
    window.__cpShareImportActive=false;
    // v1224 — abertura normal: se sobrou a marca de "entrando pelo compartilhar" (endereço antigo
    // guardado, atalho reaberto), ela sai agora — senão a tela cheia em 0% ficaria de pé sem
    // importação nenhuma acontecendo, que é pior do que o frame que ela veio evitar.
    try{ document.documentElement.classList.remove("cp-entrando-pelo-share"); }catch(_){ }
    return {handled:false};
  }

  const shareId=String(params.get('shareId')||CP_SHARE_ID_INICIAL||'').trim();
  const erroUrl=params.get('erro');

  // v1209 — A TELA DE ERRO DO SERVIDOR ("404: NOT_FOUND") NO LUGAR DO APP (print do dono, 11/08).
  //
  // Quando o WhatsApp compartilha a conversa com o Corretor Pro, quem recebe o arquivo é o
  // "recebedor" que fica instalado dentro do celular junto com o app (o service worker). Se ele
  // não estiver ligado naquele momento — o Android desliga/limpa isso sozinho quando o aparelho
  // fica sem espaço, quando o app passa muito tempo sem ser aberto, ou quando o navegador limpa
  // os dados do site — o celular manda a conversa direto pro servidor, que não tem essa porta:
  // resultado, o dono via uma página branca de erro em inglês, sem nenhum botão, e a conversa
  // sumia. Ele nem sabia que era isso: pra ele "a exportação do zip deu pau".
  //
  // Agora o servidor devolve o dono PRA DENTRO do app com este aviso (ver vercel.json), e aqui a
  // gente religa o recebedor na hora — a próxima conversa compartilhada volta a entrar sozinha.
  if(erroUrl==='sem-worker'){
    try{ history.replaceState(null,'',location.pathname); }catch(_){ }
    // v1224 — o aviso tem que ficar VISÍVEL: sem tirar a marca, a tela cheia da abertura por
    // compartilhamento continuaria por cima dele.
    try{ document.documentElement.classList.remove("cp-entrando-pelo-share"); }catch(_){ }
    __cpShareEncerrado=true;
    window.__cpShareImportActive=false;
    state.pendingSharedRecordId='';
    religarRecebedorDeConversa();
    show('zip');
    // Sem esta linha, a barra "Conversa recebida. Preparando a importação…" ficava girando em cima
    // do aviso — dando a entender que ainda há algo em andamento quando não há.
    qs('#processingBox')?.classList.remove('show');
    showCard('resultCard',true);
    const box=qs('#resultBox');
    if(box){
      box.className='notice error';
      box.innerHTML=
        '<b>Essa conversa não chegou ao app.</b><br><br>'+
        'O recebimento automático do Corretor Pro estava desligado neste celular, então o WhatsApp '+
        'não teve pra quem entregar a conversa (foi por isso que apareceu aquela tela de erro em inglês). '+
        '<b>Nenhum lead seu foi alterado.</b><br><br>'+
        'Acabei de religar o recebimento agora. Da próxima vez que você compartilhar do WhatsApp, a conversa '+
        'entra direto de novo.<br><br>'+
        '<b>Pra não perder esta conversa:</b> exporte de novo no WhatsApp escolhendo <b>salvar o arquivo</b> no '+
        'celular e toque no botão abaixo pra selecionar o ZIP.'+
        '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">'+
          '<button type="button" class="btn" id="btnEscolherZipDoShare">Escolher o arquivo da conversa</button>'+
          '<button type="button" class="btn secondary" id="btnVoltarDoShareSemWorker">Voltar ao app</button>'+
        '</div>';
    }
    qs('#btnEscolherZipDoShare')?.addEventListener('click', ()=>{ qs('#btnEscolherZip')?.click(); });
    qs('#btnVoltarDoShareSemWorker')?.addEventListener('click', ()=>{
      showCard('resultCard',false);
      qs('#processingBox')?.classList.remove('show');
      show('home');
    });
    // O aviso mora abaixo do cartão "Importar conversa": no celular ele nasce fora da tela. Sem
    // trazer o aviso pra vista, o dono chega numa tela que parece normal e não fica sabendo de nada.
    try{ requestAnimationFrame(()=>{ qs('#resultCard')?.scrollIntoView({block:'start'}); }); }catch(_){ }
    return {handled:true,waiting:true,falhou:true,semWorker:true};
  }

  // v1193 — MARCA VELHA NO ENDEREÇO NÃO É COMPARTILHAMENTO NOVO.
  //
  // Relato do dono, depois de a v1192 já ter limpado o endereço na falha: "eu não to importando
  // nada, somente atualizei passando o dedo na tela, e muda pra essa tela de merda". A causa é
  // que o "?shared=1&shareId=..." de um compartilhamento antigo continua no endereço do app
  // instalado (o Android reabre o PWA na última URL). Enquanto ele estiver ali, todo puxão de
  // tela pra atualizar reentra no modo importação — e, na v1192, ainda esperava 15 segundos antes
  // de dizer que não achou nada.
  //
  // Agora, ANTES de mostrar qualquer coisa: se o último compartilhamento registrado neste
  // aparelho tem mais de 10 minutos e não há ZIP com conteúdo esperando, isto é marca velha.
  // Limpa o endereço e devolve o app normal na hora — sem tela de importação, sem espera, sem
  // aviso de erro. O caminho de um compartilhamento DE VERDADE (que acabou de acontecer, com
  // registro fresco) continua exatamente como era.
  try{
    const debugAntigo = await readShareDebug().catch(()=>null);
    const tsDebug = Date.parse(debugAntigo?.ts || '');
    const velho = Number.isFinite(tsDebug) && (Date.now()-tsDebug) > 10*60*1000;
    if(velho){
      const pendente = shareId ? await shareIdbGet(shareId) : null;
      if(!pendente?.blob?.size){
        try{ history.replaceState(null,'',location.pathname); }catch(_){ }
        window.__cpShareImportActive=false;
        state.pendingSharedRecordId='';
        return {handled:false,staleShare:true};
      }
    }
  }catch(_){ /* na dúvida, segue o caminho normal abaixo */ }

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
      try{ history.replaceState(null,'',location.pathname); }catch(_){ }
      return {handled:false,staleShare:true};
    }
    const id=String(record.id||shareId||'latest');
    state.pendingSharedRecordId=id;
    window.__cpShareImportActive=true;
    mostrarRecebimentoShare();
    try{ history.replaceState(null,'',`${location.pathname}?shared=1&shareId=${encodeURIComponent(id)}`); }catch(_){ }
    const file=new File([record.blob],record.name||'conversa-whatsapp.zip',{type:record.type||record.blob.type||'application/zip'});
    // v1248 — SEM ESTE try/catch O APP MORRIA DE VEZ. Se o pedaço da importação não conseguisse ser
    // baixado (rede caindo, ou logo depois de uma publicação, com o recebedor do celular ainda
    // procurando o endereço da versão anterior), a falha subia sem ninguém tratar: a marca
    // __cpShareImportActive continuava ligada e travava a abertura normal do app, o endereço já
    // tinha sido reescrito pra ?shared=1 (então atualizar a página caía na mesma armadilha) e a
    // barra "Conversa recebida. Preparando a importação… 4%" ficava girando pra sempre, sem erro e
    // sem botão. Só se curava sozinho 15 minutos depois — e a conversa se perdia.
    let ok=false;
    try{
      ok=await processFile(file,{shareId:id});
    }catch(err){
      window.__cpShareImportActive=false;
      state.pendingSharedRecordId='';
      try{ history.replaceState(null,'',location.pathname); }catch(_){ }
      try{ document.documentElement.classList.remove("cp-entrando-pelo-share"); }catch(_){ }
      show('zip');
      qs('#processingBox')?.classList.remove('show');
      showCard('resultCard',true);
      const box=qs('#resultBox');
      if(box){
        box.className='notice error';
        box.innerHTML=
          '<b>Não consegui abrir esta conversa agora.</b><br><br>'+
          'A parte do app que lê a conversa não terminou de carregar — normalmente é internet oscilando, '+
          'ou o app tendo acabado de ser atualizado. <b>Nenhum lead seu foi alterado.</b><br><br>'+
          'Confira a internet e toque no botão <b>“Escolher o arquivo da conversa (.zip)”</b> aqui de cima '+
          'pra tentar de novo com o mesmo arquivo — ou compartilhe de novo pelo WhatsApp.';
      }
      return {handled:true,processingFinished:false,shareId:id,falhouAoImportar:true};
    }
    return {handled:true,processingFinished:ok,shareId:id};
  }

  if(cameFromShare){
    const debug=await readShareDebug().catch(()=>null);

    // v1192 — LIMPA O ENDEREÇO NA HORA (a correção mais importante desta tela).
    //
    // Relato do dono, com print: "eu só atualizo a página e vai pra essa merda de tela". Era
    // verdade e era grave. Quando o compartilhamento falhava, o "?shared=1&shareId=..." continuava
    // grudado no endereço da página — e como é ele que faz o app entrar no modo importação, TODA
    // atualização, e toda reabertura do app instalado, caía de novo nesta tela travada em
    // "Conversa recebida. Preparando a importação…". Não havia saída pela tela: o app ficava
    // inutilizável até alguém saber limpar o endereço na mão. Agora o endereço é limpo antes
    // mesmo de desenhar o aviso — atualizar a página volta pro app normal.
    try{ history.replaceState(null,'',location.pathname); }catch(_){ }
    window.__cpShareImportActive=false;
    state.pendingSharedRecordId='';

    // O ZIP chegou e foi gravado, mas veio VAZIO (0 byte). Acontece de verdade no Android: o
    // WhatsApp entrega o arquivo antes de terminar de montá-lo. Antes isso caía no texto genérico
    // de "ainda não apareceu... toque em Tentar recuperar" — e recuperar um arquivo vazio nunca
    // ia dar certo, então o dono ficava preso num botão que não tinha como funcionar.
    let registroVazio = false;
    try{
      const bruto = shareId ? await shareIdbGet(shareId) : null;
      registroVazio = !!(bruto && (!bruto.blob || !bruto.blob.size));
    }catch(_){ }
    if(!registroVazio && debug?.chosenFile && Number(debug.chosenFile.size) === 0) registroVazio = true;

    show('zip');
    // v1248 — a barra "Conversa recebida. Preparando a importação… 4%" continuava girando POR CIMA
    // deste aviso de erro, dando a entender que ainda havia algo em andamento. O ramo vizinho
    // (erro=sem-worker) já desligava a barra desde a v1209; aqui, que é o caminho mais comum,
    // a linha nunca foi acrescentada.
    qs('#processingBox')?.classList.remove('show');
    showCard('resultCard',true);
    qs('#resultBox').className='notice error';
    const nomeArquivo = debug?.chosenFile?.name ? ' de <b>'+escapeHtml(debug.chosenFile.name)+'</b>' : ' do arquivo';
    const corpo = registroVazio
      ? '<b>O WhatsApp mandou o arquivo vazio (0 KB).</b><br><br>'+
        'Não veio nada dentro'+nomeArquivo+' — não é o Corretor Pro que perdeu a conversa, ela não chegou. '+
        'Costuma acontecer quando a exportação ainda estava sendo gerada no celular.<br><br>'+
        'Nenhum lead seu foi alterado. Toque em <b>Voltar ao app</b> pra seguir usando normalmente; '+
        'quando quiser tentar de novo, use o botão <b>“Escolher o arquivo da conversa (.zip)”</b> aqui de cima.'
      : '<b>O arquivo não chegou ao armazenamento do aplicativo.</b><br><br>'+
        'Nenhum lead seu foi alterado. Toque em <b>Voltar ao app</b> pra seguir usando normalmente, ou em '+
        '<b>Tentar recuperar</b> pra procurar de novo.';
    qs('#resultBox').innerHTML=
      corpo+
      (erroUrl?'<br><br><b>Motivo:</b> '+escapeHtml(erroUrl):'')+
      (debug?'<br><br><details><summary>Diagnóstico técnico</summary>'+formatShareDebug(debug)+'</details>':'')+
      '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">'+
        '<button type="button" class="btn" id="btnVoltarDoShare">Voltar ao app</button>'+
        (registroVazio?'':'<button type="button" class="btn secondary" id="btnRecuperarShare">Tentar recuperar</button>')+
      '</div>';
    // v1192 — a saída que faltava. Sem ela, a única forma de sair desta tela era fechar o app —
    // e reabrir caía aqui de novo, por causa do endereço grudado (já corrigido acima).
    qs('#btnVoltarDoShare')?.addEventListener('click', () => {
      try{ history.replaceState(null,'',location.pathname); }catch(_){ }
      showCard('resultCard',false);
      qs('#processingBox')?.classList.remove('show');
      show('home');
    });
    // v983 — o clique só disparava uma nova espera de até 8s por trás, sem NENHUM sinal na tela;
    // pro dono parecia botão morto ("cliquei e nada aconteceu"). Agora desativa e troca o texto
    // na hora, antes mesmo da nova tentativa começar.
    qs('#btnRecuperarShare')?.addEventListener('click', (ev) => {
      const btn = ev.currentTarget;
      if(btn){ btn.disabled = true; btn.textContent = 'Procurando…'; }
      __cpCheckSharedPromise=null; checkShared();
    });
    // v1192 — "falhou" avisa o arranque (iniciarDireciona) que ele deve seguir carregando o app
    // normalmente por trás deste aviso. Antes, um compartilhamento falho devolvia handled:true e o
    // arranque PARAVA ali: a carteira nunca era carregada. Quem saísse desta tela encontrava uma
    // Home vazia — parte do "cadê meus leads?" que o dono relatou.
    return {handled:true,waiting:true,falhou:true,vazio:registroVazio};
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

// v1126 — A PORTA DE ENTRADA QUE FALTAVA (relato do dono, com prints, no iPhone).
//
// Até aqui existia UM jeito só de o ZIP entrar no app: o WhatsApp "compartilhar com o Corretor
// Pro" (Share Target do manifest) — que o iPhone NÃO suporta. Não é escolha nossa: o motor do
// Safari não implementa Web Share Target (pedido aberto no WebKit desde 2019, bug 194593), então
// nenhum app instalado pela tela inicial aparece na lista de compartilhar do iPhone.
//
// Consequência real, que o dono levou na mão: no iPhone ele exportava a conversa, não achava o
// Corretor Pro pra enviar, abria a tela "Importar conversa"... e ela não tinha NENHUM lugar pra
// escolher o arquivo. Beco sem saída — o app dependia 100% de um caminho que o aparelho dele não
// tem. No Android ninguém tinha esbarrado nisso porque lá o compartilhar funciona.
//
// Um seletor de arquivo comum resolve nos dois sistemas e reusa o mesmo processFile do
// compartilhamento — o resto do fluxo (extração, transcrição, análise) não muda em nada.
// Declaração de função (não `const`) de propósito: a Home é montada por _processarDashboard, que
// vive lá em cima no arquivo e chama cpPassosImportar — com `const` isso quebraria por ordem.
function cpEhIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent||"") ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
// v1130 — os passos da Home vazia, reescritos a pedido do dono. A tela abria com um botão grande
// "Importar conversa do WhatsApp", e isso passa a ideia errada em dois pontos: (1) o Corretor Pro
// não entra na conversa de ninguém — quem exporta e envia é o corretor, de dentro do WhatsApp; e
// (2) o WhatsApp NÃO guarda conversa exportada em lugar nenhum, então não existe "arquivo lá
// esperando" pra buscar: a exportação e o envio acontecem no mesmo gesto, na hora. Quem chega novo
// clicava no botão esperando ver as conversas e não via nada.
//
// Agora a tela abre com o caminho dentro do WhatsApp, passo a passo, e o botão vira o que ele
// realmente é: o caso de quem JÁ tem o arquivo salvo no aparelho.
function cpPassosImportar(){
  const noCelular = isDesktop() ? " (no celular)" : "";
  const abrirMenu = cpEhIOS()
    ? 'Toque no <b>nome do contato</b>, lá em cima da conversa'
    : (isDesktop()
      ? 'Toque no <b>nome do contato</b> (iPhone) ou no <b>“⋮”</b> do canto de cima (Android)'
      : 'Toque no <b>“⋮”</b> no canto de cima da conversa');
  const entregar = cpEhIOS()
    // v1272 — dizer ONDE o arquivo fica é o que faltava: sem isso o corretor entende que precisa
    // mandar a conversa pra alguém e abrir num computador (foi exatamente a leitura do dono).
    ? 'Role a lista <b>para baixo</b>, passando dos ícones dos apps, e toque em <b>“Salvar em Arquivos”</b> → <b>Salvar</b>. O arquivo fica no <b>próprio iPhone</b> — não vai pra ninguém e não precisa de computador. Depois volte aqui e use o botão abaixo: a conversa que você salvou é a primeira da lista.<br><span style="color:var(--muted)">Quem quiser pular esse vai e volta pode montar uma vez o Atalho em <b>Menu → “Compartilhar direto do WhatsApp (iPhone)”</b> — é opcional, o caminho acima já resolve.</span>'
    : (isDesktop()
      ? 'Na lista que abrir, toque no <b>ícone do Corretor Pro</b>. Se preferir fazer pelo computador, salve o arquivo e use o botão abaixo.'
      : 'Na lista que abrir, toque no <b>ícone do Corretor Pro</b> — é aqui que a conversa chega.');
  return [
    `Abra o WhatsApp${noCelular} e entre na conversa do cliente`,
    abrirMenu,
    'Role até <b>“Exportar conversa”</b> e toque. Escolha <b>“Incluir mídia”</b> — é o que traz os áudios junto',
    entregar,
    'Em 30-60 segundos o Corretor Pro mostra quem atender, por que, quando e o que falar'
  ];
}
// v1130 — cpPassosComoFunciona() (os 3 passos antigos em linha corrida) saiu daqui: virou
// cpPassosImportar(), acima, em lista numerada e com o caminho do WhatsApp por extenso. Era a
// única chamadora, então a versão antiga ficou sem uso — removida junto pra não sobrar texto
// morto dizendo uma coisa enquanto a tela diz outra.
function cpTextoAjudaImportar(){
  const passoWhats = 'No WhatsApp: abra a conversa → toque no nome do contato (iPhone) ou em "⋮" (Android) → <b>Exportar conversa</b> → <b>Incluir mídia</b>.';
  if(cpEhIOS()){
    // v1272 — texto reescrito porque a versão anterior abria com a trava da Apple e só depois
    // dizia o que fazer: quem lia parava na primeira linha ("não deixa") e concluía que o iPhone
    // não servia. Agora abre pelo caminho, que é curto e todo dentro do celular. O Atalho continua
    // existindo, mas como opção avançada — montar um Atalho na mão não é pra todo mundo, e
    // oferecer isso como o jeito normal era o que fazia o caminho parecer grande.
    return `${passoWhats}<br><br><b>No iPhone</b>, mais dois toques e acabou — tudo no próprio celular:<br>
      1. Na tela de compartilhar que abrir, <b>role para baixo</b> (passando dos ícones dos apps) e toque em <b>“Salvar em Arquivos”</b> → <b>Salvar</b>.<br>
      2. Volte aqui, toque em <b>“Escolher o arquivo da conversa”</b> acima e pegue o <b>primeiro da lista</b>.<br><br>
      O arquivo fica guardado dentro do seu iPhone: não vai pra ninguém, não passa por e-mail e não precisa de computador. Toque em <b>“Como enviar sua conversa”</b> pra ver isso com desenho, passo por passo.`;
  }
  return `${passoWhats}<br><br>Depois é só <b>compartilhar o ZIP com o Corretor Pro</b> — ou, se você já salvou o arquivo no aparelho, tocar em <b>“Escolher o arquivo da conversa”</b> acima. Em 30-60 segundos ele mostra quem atender, por que, quando e o que falar.`;
}
// ============================================================================
// v1149 — COMO ENVIAR SUA CONVERSA (passo a passo ilustrado, Android e iPhone)
//
// Pedido do dono: começar a vender pra corretores de Android. "Quando o cliente entrar no link do
// Corretor Pro, ele vai ter que ter uma explicação, alguma forma dele entender, que ele abre a
// conversa, clica nos três pontinhos, vai em mais, daí exportar conversa e seleciona o app."
//
// O caminho já estava escrito em texto na tela de importação — só que texto corrido é justamente o
// que ninguém lê no primeiro uso. Aqui ele vira 5 passos, um por vez, com um desenho do celular
// mostrando ONDE tocar (o mesmo caminho dos prints que ele mandou: ⋮ → Exportar conversa →
// Incluir mídia → Corretor Pro). Abre sozinho na primeira vez e fica sempre à mão no botão
// "Como enviar sua conversa".
// ============================================================================
// v1150 — a marca de "já vi" é POR CONTA (não por aparelho): o dono vai criar contas novas de
// teste no mesmo celular, e cada corretor novo precisa ver o passo a passo na primeira vez dele.
// Sem sessão identificada (caminho antigo por chave compartilhada), cai numa chave geral.
function cp1149VistoKey(){
  const conta = String(window.__cpContaId || "").trim();
  return conta ? `corretor_pro_tutorial_envio_visto:${conta}` : "corretor_pro_tutorial_envio_visto";
}

// v1153 — o que dizer sobre instalar depende do aparelho de quem está lendo:
//  • já está com o app instalado → o problema é outro, vai direto pro jeito que sempre funciona;
//  • o navegador oferece instalar agora → botão que instala NA HORA, sem procurar nada;
//  • não oferece (iPhone, ou Chrome que não convidou) → o caminho manual daquele aparelho.
function cp1149TextoInstalar(){
  const jaInstalado = (typeof window.cpAppJaInstalado === "function") ? window.cpAppJaInstalado() : false;
  const podeInstalar = (typeof window.cpTemConviteInstalar === "function") ? window.cpTemConviteInstalar() : false;
  const dica = (typeof window.cpDicaInstalarTexto === "function")
    ? window.cpDicaInstalarTexto()
    : 'No celular: toque no menu do navegador (⋮) e em <b>“Adicionar à tela inicial”</b> / <b>“Instalar app”</b>.';
  const jeito2 = '<b>Jeito que funciona sempre:</b> na lista de compartilhar do WhatsApp, escolha <b>salvar o arquivo</b> no celular. Depois, aqui no Corretor Pro, toque em <b>“Escolher o arquivo da conversa”</b> e selecione o ZIP salvo.';
  if(jaInstalado){
    return 'Você já está com o app <b>instalado</b> — então o ícone deve aparecer na lista. Se mesmo assim não aparecer (acontece em alguns celulares), use o caminho abaixo, que nunca falha.<br><br>' + jeito2;
  }
  if(podeInstalar){
    return 'O Android só oferece na lista de compartilhar os apps <b>instalados</b> — e o Corretor Pro ainda não está no seu celular.<br><br><button type="button" id="cp1149Instalar" class="btn" style="width:100%;margin:2px 0 12px">Instalar o Corretor Pro agora</button>' + jeito2;
  }
  return 'O Android só oferece na lista de compartilhar os apps <b>instalados</b> — e o Corretor Pro ainda não está no seu celular.<br><br><b>Pra instalar:</b> ' + dica + '<br><br>' + jeito2;
}

function cp1149Telinha(conteudo){
  return `<svg viewBox="0 0 200 300" width="150" height="225" aria-hidden="true" style="max-width:100%">
    <rect x="6" y="4" width="188" height="292" rx="20" fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.22)" stroke-width="2"/>
    <rect x="14" y="26" width="172" height="246" rx="8" fill="rgba(255,255,255,.05)"/>
    ${conteudo}
  </svg>`;
}
const CP1149_PASSOS_ANDROID = [
  {
    titulo: "1. Abra a conversa do cliente",
    texto: "No WhatsApp, entre na conversa que você quer analisar. Pode ser qualquer conversa — nova ou antiga.",
    desenho: cp1149Telinha(`
      <circle cx="34" cy="16" r="7" fill="rgba(255,255,255,.5)"/>
      <rect x="46" y="11" width="60" height="5" rx="2.5" fill="rgba(255,255,255,.55)"/>
      <rect x="46" y="20" width="34" height="4" rx="2" fill="rgba(255,255,255,.3)"/>
      <rect x="24" y="40" width="110" height="26" rx="8" fill="rgba(255,255,255,.10)"/>
      <rect x="66" y="76" width="110" height="20" rx="8" fill="rgba(255,98,88,.28)"/>
      <rect x="24" y="106" width="90" height="26" rx="8" fill="rgba(255,255,255,.10)"/>
      <rect x="86" y="142" width="90" height="20" rx="8" fill="rgba(255,98,88,.28)"/>
      <rect x="24" y="248" width="152" height="18" rx="9" fill="rgba(255,255,255,.08)"/>`)
  },
  {
    titulo: "2. Toque nos três pontinhos",
    texto: "No canto de cima, à direita. Em alguns celulares é preciso tocar em <b>“Mais”</b> depois disso.",
    desenho: cp1149Telinha(`
      <rect x="46" y="11" width="60" height="5" rx="2.5" fill="rgba(255,255,255,.45)"/>
      <circle cx="170" cy="9" r="3" fill="#FF6258"/><circle cx="170" cy="17" r="3" fill="#FF6258"/><circle cx="170" cy="25" r="3" fill="#FF6258"/>
      <circle cx="170" cy="17" r="17" fill="none" stroke="#FF6258" stroke-width="2.5"/>
      <rect x="24" y="60" width="110" height="24" rx="8" fill="rgba(255,255,255,.08)"/>
      <rect x="66" y="94" width="110" height="24" rx="8" fill="rgba(255,255,255,.08)"/>`)
  },
  {
    titulo: "3. Escolha “Exportar conversa”",
    texto: "É uma das opções do menu que abriu. Se não aparecer, entre em <b>“Mais”</b> — ela está lá dentro.",
    desenho: cp1149Telinha(`
      <rect x="86" y="30" width="98" height="120" rx="10" fill="rgba(20,20,20,.95)" stroke="rgba(255,255,255,.18)"/>
      <rect x="96" y="42" width="66" height="5" rx="2.5" fill="rgba(255,255,255,.35)"/>
      <rect x="96" y="60" width="52" height="5" rx="2.5" fill="rgba(255,255,255,.35)"/>
      <rect x="96" y="78" width="60" height="5" rx="2.5" fill="rgba(255,255,255,.35)"/>
      <rect x="90" y="92" width="90" height="22" rx="6" fill="rgba(255,98,88,.20)" stroke="#FF6258" stroke-width="2"/>
      <rect x="96" y="100" width="74" height="6" rx="3" fill="#FF6258"/>
      <rect x="96" y="126" width="56" height="5" rx="2.5" fill="rgba(255,255,255,.35)"/>`)
  },
  {
    titulo: "4. Toque em “Incluir mídia”",
    texto: "O WhatsApp pergunta se quer incluir as mídias. Escolha <b>Incluir mídia</b> — é o que traz <b>os áudios</b>, e áudio é onde o cliente diz o que ele realmente quer.",
    desenho: cp1149Telinha(`
      <rect x="22" y="96" width="156" height="76" rx="12" fill="rgba(20,20,20,.95)" stroke="rgba(255,255,255,.18)"/>
      <rect x="34" y="110" width="120" height="5" rx="2.5" fill="rgba(255,255,255,.40)"/>
      <rect x="34" y="122" width="96" height="5" rx="2.5" fill="rgba(255,255,255,.40)"/>
      <rect x="34" y="142" width="58" height="20" rx="6" fill="rgba(255,255,255,.06)"/>
      <rect x="102" y="142" width="66" height="20" rx="6" fill="rgba(255,98,88,.22)" stroke="#FF6258" stroke-width="2"/>
      <rect x="110" y="149" width="50" height="6" rx="3" fill="#FF6258"/>`)
  },
  {
    titulo: "5. Escolha o Corretor Pro na lista",
    texto: "Abre a lista de compartilhar do celular. Toque no ícone do <b>Corretor Pro</b> — ele aparece ali porque o app está instalado no seu celular. Pronto: em 30 a 60 segundos ele mostra quem atender, por quê, quando e o que falar.",
    desenho: cp1149Telinha(`
      <rect x="18" y="120" width="164" height="150" rx="14" fill="rgba(20,20,20,.95)" stroke="rgba(255,255,255,.18)"/>
      <rect x="30" y="134" width="140" height="22" rx="6" fill="rgba(255,255,255,.07)"/>
      <rect x="38" y="142" width="104" height="6" rx="3" fill="rgba(255,255,255,.35)"/>
      <circle cx="46" cy="188" r="15" fill="rgba(255,255,255,.10)"/>
      <g><rect x="72" y="173" width="30" height="30" rx="9" fill="rgba(255,98,88,.18)" stroke="#FF6258" stroke-width="2.5"/>
      <path d="M79 192 L87 183 L95 192" fill="none" stroke="#FF6258" stroke-width="2.5" stroke-linecap="round"/></g>
      <circle cx="128" cy="188" r="15" fill="rgba(255,255,255,.10)"/>
      <circle cx="164" cy="188" r="15" fill="rgba(255,255,255,.10)"/>
      <rect x="66" y="212" width="42" height="5" rx="2.5" fill="#FF6258"/>
      <rect x="30" y="238" width="140" height="18" rx="9" fill="rgba(255,255,255,.06)"/>`)
  },
  {
    // v1152 — pergunta do dono no primeiro teste com conta nova: "e se não aparecer o ícone do
    // Corretor Pro pra enviar?". Acontece de verdade, e tem UM motivo: o celular só oferece o app
    // na lista de compartilhar depois que ele está INSTALADO na tela inicial. Este passo é a saída,
    // e a segunda opção funciona mesmo sem instalar nada.
    titulo: "Não apareceu o Corretor Pro na lista?",
    // v1153 — o texto é montado na hora porque depende DESTE aparelho: dá pra instalar agora? já
    // está instalado? é iPhone? O dono testou com conta nova e disse "mas não apareceu onde baixar
    // pra mim" — mandar procurar um botão que pode não existir é beco sem saída.
    texto: cp1149TextoInstalar,
    desenho: cp1149Telinha(`
      <rect x="22" y="40" width="156" height="54" rx="12" fill="rgba(255,98,88,.14)" stroke="#FF6258" stroke-width="2"/>
      <circle cx="46" cy="67" r="12" fill="rgba(255,98,88,.35)"/>
      <path d="M46 61 v11 M41 67 l5 5 l5 -5" fill="none" stroke="#FF6258" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="66" y="58" width="92" height="6" rx="3" fill="#FF6258"/>
      <rect x="66" y="70" width="70" height="5" rx="2.5" fill="rgba(255,255,255,.45)"/>
      <rect x="22" y="112" width="156" height="1.5" fill="rgba(255,255,255,.14)"/>
      <rect x="22" y="130" width="156" height="44" rx="10" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>
      <rect x="34" y="144" width="76" height="6" rx="3" fill="rgba(255,255,255,.55)"/>
      <rect x="34" y="156" width="112" height="5" rx="2.5" fill="rgba(255,255,255,.32)"/>
      <rect x="22" y="192" width="156" height="30" rx="10" fill="rgba(255,255,255,.05)"/>
      <rect x="34" y="203" width="60" height="7" rx="3.5" fill="rgba(255,255,255,.45)"/>`)
  }
];

// v1272 — O PASSO A PASSO DO IPHONE (antes só existia o do Android).
//
// Relato do dono: "ninguém vai fazer todo esse processo", e logo depois "ele vai ter que enviar
// pra alguém pra conseguir salvar no PC e não no cel, pra depois abrir e importar". Essa segunda
// frase é a prova do estrago: o caminho do iPhone termina DENTRO do próprio iPhone — "Salvar em
// Arquivos" guarda o ZIP no aparelho, não manda pra ninguém e não precisa de computador. Quem
// entendeu o contrário entendeu porque o app estava ensinando o caminho ERRADO pra ele.
//
// Até aqui este passo a passo era um só, escrito em cima dos prints do Android: mandava tocar nos
// "três pontinhos" (não existem no iPhone) e depois "escolher o Corretor Pro na lista de
// compartilhar" (a Apple não deixa aparecer — ver v1126). Ou seja, o iPhone abria a ajuda, seguia
// à risca e batia numa parede duas vezes. Daí a conclusão de que só dava por fora, com PC.
//
// Agora o aparelho decide qual passo a passo ver. O do iPhone tem os toques que existem no iPhone,
// diz com todas as letras que o arquivo fica no próprio celular, e termina abrindo o seletor de
// arquivo direto do último passo — sem mandar procurar botão nenhum depois de fechar.
const CP1149_PASSOS_IOS = [
  {
    titulo: "1. Abra a conversa do cliente",
    texto: "No WhatsApp, entre na conversa que você quer analisar. Pode ser qualquer conversa — nova ou antiga.",
    desenho: cp1149Telinha(`
      <circle cx="34" cy="16" r="7" fill="rgba(255,255,255,.5)"/>
      <rect x="46" y="11" width="60" height="5" rx="2.5" fill="rgba(255,255,255,.55)"/>
      <rect x="46" y="20" width="34" height="4" rx="2" fill="rgba(255,255,255,.3)"/>
      <rect x="24" y="40" width="110" height="26" rx="8" fill="rgba(255,255,255,.10)"/>
      <rect x="66" y="76" width="110" height="20" rx="8" fill="rgba(255,98,88,.28)"/>
      <rect x="24" y="106" width="90" height="26" rx="8" fill="rgba(255,255,255,.10)"/>
      <rect x="86" y="142" width="90" height="20" rx="8" fill="rgba(255,98,88,.28)"/>
      <rect x="24" y="248" width="152" height="18" rx="9" fill="rgba(255,255,255,.08)"/>`)
  },
  {
    titulo: "2. Toque no nome do cliente",
    texto: "Lá em cima, no topo da conversa. No iPhone é por aí que se abre a ficha do contato — <b>não existe “⋮”</b> como no Android.",
    desenho: cp1149Telinha(`
      <rect x="46" y="11" width="60" height="5" rx="2.5" fill="#FF6258"/>
      <rect x="46" y="20" width="34" height="4" rx="2" fill="rgba(255,98,88,.55)"/>
      <circle cx="34" cy="16" r="7" fill="rgba(255,98,88,.45)"/>
      <rect x="20" y="2" width="100" height="28" rx="9" fill="none" stroke="#FF6258" stroke-width="2.5"/>
      <rect x="24" y="50" width="110" height="26" rx="8" fill="rgba(255,255,255,.08)"/>
      <rect x="66" y="86" width="110" height="20" rx="8" fill="rgba(255,255,255,.08)"/>`)
  },
  {
    titulo: "3. Role até “Exportar conversa”",
    texto: "A ficha do contato abre. <b>Role até o fim</b> — “Exportar conversa” fica bem lá embaixo, depois das fotos e dos ajustes.",
    desenho: cp1149Telinha(`
      <circle cx="100" cy="60" r="22" fill="rgba(255,255,255,.12)"/>
      <rect x="70" y="92" width="60" height="6" rx="3" fill="rgba(255,255,255,.40)"/>
      <rect x="26" y="120" width="148" height="5" rx="2.5" fill="rgba(255,255,255,.22)"/>
      <rect x="26" y="140" width="120" height="5" rx="2.5" fill="rgba(255,255,255,.22)"/>
      <rect x="26" y="160" width="134" height="5" rx="2.5" fill="rgba(255,255,255,.22)"/>
      <rect x="22" y="182" width="156" height="26" rx="7" fill="rgba(255,98,88,.20)" stroke="#FF6258" stroke-width="2"/>
      <rect x="32" y="192" width="102" height="6" rx="3" fill="#FF6258"/>
      <path d="M100 226 v18 M92 236 l8 8 l8 -8" fill="none" stroke="#FF6258" stroke-width="2.5" stroke-linecap="round"/>`)
  },
  {
    titulo: "4. Toque em “Anexar mídia”",
    texto: "O iPhone pergunta se quer anexar as mídias. Escolha <b>Anexar mídia</b> — é o que traz <b>os áudios</b>, e áudio é onde o cliente diz o que ele realmente quer.",
    desenho: cp1149Telinha(`
      <rect x="22" y="96" width="156" height="76" rx="12" fill="rgba(20,20,20,.95)" stroke="rgba(255,255,255,.18)"/>
      <rect x="34" y="110" width="120" height="5" rx="2.5" fill="rgba(255,255,255,.40)"/>
      <rect x="34" y="122" width="96" height="5" rx="2.5" fill="rgba(255,255,255,.40)"/>
      <rect x="34" y="142" width="58" height="20" rx="6" fill="rgba(255,255,255,.06)"/>
      <rect x="102" y="142" width="66" height="20" rx="6" fill="rgba(255,98,88,.22)" stroke="#FF6258" stroke-width="2"/>
      <rect x="110" y="149" width="50" height="6" rx="3" fill="#FF6258"/>`)
  },
  {
    titulo: "5. Toque em “Salvar em Arquivos”",
    texto: "Abre a tela de compartilhar. <b>Passe direto dos ícones dos apps</b> e role a lista de baixo até <b>“Salvar em Arquivos”</b>. Toque, depois em <b>Salvar</b>.<br><br>O arquivo fica guardado <b>dentro do seu próprio iPhone</b> — não vai pra ninguém, não passa por e-mail e não precisa de computador.",
    desenho: cp1149Telinha(`
      <rect x="18" y="110" width="164" height="160" rx="14" fill="rgba(20,20,20,.95)" stroke="rgba(255,255,255,.18)"/>
      <circle cx="46" cy="146" r="14" fill="rgba(255,255,255,.10)"/>
      <circle cx="84" cy="146" r="14" fill="rgba(255,255,255,.10)"/>
      <circle cx="122" cy="146" r="14" fill="rgba(255,255,255,.10)"/>
      <circle cx="160" cy="146" r="14" fill="rgba(255,255,255,.10)"/>
      <rect x="28" y="176" width="144" height="1.5" fill="rgba(255,255,255,.14)"/>
      <rect x="30" y="188" width="86" height="5" rx="2.5" fill="rgba(255,255,255,.22)"/>
      <rect x="30" y="206" width="70" height="5" rx="2.5" fill="rgba(255,255,255,.22)"/>
      <rect x="24" y="222" width="152" height="26" rx="7" fill="rgba(255,98,88,.20)" stroke="#FF6258" stroke-width="2"/>
      <rect x="34" y="232" width="96" height="6" rx="3" fill="#FF6258"/>
      <rect x="148" y="228" width="16" height="13" rx="3" fill="none" stroke="#FF6258" stroke-width="2"/>
      <path d="M100 62 v22 M92 76 l8 8 l8 -8" fill="none" stroke="#FF6258" stroke-width="2.5" stroke-linecap="round"/>`)
  },
  {
    titulo: "6. Volte aqui e escolha o arquivo",
    texto: "Último passo: toque no botão abaixo. O iPhone abre a lista de arquivos e <b>a conversa que você acabou de salvar é a primeira da lista</b>. Toque nela.<br><br>Em 30 a 60 segundos o Corretor Pro mostra quem atender, por quê, quando e o que falar.<br><br><button type=\"button\" id=\"cp1149EscolherArquivo\" class=\"btn\" style=\"width:100%;margin:10px 0 2px\">Escolher o arquivo da conversa</button>",
    desenho: cp1149Telinha(`
      <rect x="22" y="40" width="156" height="40" rx="10" fill="rgba(255,255,255,.06)"/>
      <rect x="34" y="54" width="90" height="6" rx="3" fill="rgba(255,255,255,.40)"/>
      <rect x="34" y="66" width="60" height="5" rx="2.5" fill="rgba(255,255,255,.22)"/>
      <rect x="22" y="96" width="156" height="30" rx="10" fill="rgba(255,98,88,.22)" stroke="#FF6258" stroke-width="2.5"/>
      <rect x="42" y="108" width="116" height="7" rx="3.5" fill="#FF6258"/>
      <rect x="22" y="146" width="156" height="26" rx="8" fill="rgba(255,255,255,.05)"/>
      <rect x="32" y="156" width="24" height="7" rx="3.5" fill="rgba(255,98,88,.65)"/>
      <rect x="66" y="156" width="86" height="6" rx="3" fill="rgba(255,255,255,.35)"/>
      <rect x="22" y="180" width="156" height="26" rx="8" fill="rgba(255,255,255,.04)"/>
      <rect x="32" y="190" width="24" height="7" rx="3.5" fill="rgba(255,255,255,.18)"/>
      <rect x="66" y="190" width="70" height="6" rx="3" fill="rgba(255,255,255,.20)"/>`)
  }
];
// O aparelho decide: no iPhone os toques são outros, e mandar seguir o caminho do Android é o que
// fazia o corretor concluir que "não dá" (ver bloco acima).
function cp1149Passos(){
  return cpEhIOS() ? CP1149_PASSOS_IOS : CP1149_PASSOS_ANDROID;
}

// v1155 — "COMO INSTALAR" COM DESENHO.
//
// O dono, com a conta de teste no celular dele: "como que essa merda não está baixando se antes
// funcionava?". Não é o app: o botão que instala com UM toque só existe quando o NAVEGADOR
// convida (beforeinstallprompt), e o Chrome para de convidar depois que a pessoa desinstala —
// é regra dele, nenhum site consegue forçar. O caminho pelo menu do navegador SEMPRE funciona,
// então ele deixou de ser uma linha de texto e virou passo a passo com desenho, igual ao de
// enviar a conversa.
const CP1155_PASSOS_ANDROID = [
  {
    titulo: "1. Toque no menu do navegador",
    texto: "É o <b>“⋮”</b> no canto de cima do Chrome (do lado da barra de endereço). No Samsung Internet é o <b>“☰”</b> embaixo, à direita.",
    desenho: () => cp1149Telinha(`
      <rect x="14" y="26" width="172" height="22" rx="6" fill="rgba(255,255,255,.10)"/>
      <rect x="26" y="34" width="104" height="6" rx="3" fill="rgba(255,255,255,.35)"/>
      <circle cx="170" cy="31" r="3" fill="#FF6258"/><circle cx="170" cy="38" r="3" fill="#FF6258"/><circle cx="170" cy="45" r="3" fill="#FF6258"/>
      <circle cx="170" cy="38" r="16" fill="none" stroke="#FF6258" stroke-width="2.5"/>
      <rect x="26" y="70" width="148" height="60" rx="10" fill="rgba(255,255,255,.06)"/>
      <rect x="26" y="142" width="120" height="8" rx="4" fill="rgba(255,255,255,.18)"/>`)
  },
  {
    titulo: "2. Toque em “Instalar app”",
    texto: "Na lista que abre, procure <b>“Instalar app”</b> ou <b>“Adicionar à tela inicial”</b> — depende do celular, mas é sempre uma dessas duas.",
    desenho: () => cp1149Telinha(`
      <rect x="70" y="30" width="114" height="150" rx="10" fill="rgba(20,20,20,.95)" stroke="rgba(255,255,255,.18)"/>
      <rect x="80" y="44" width="62" height="5" rx="2.5" fill="rgba(255,255,255,.32)"/>
      <rect x="80" y="62" width="76" height="5" rx="2.5" fill="rgba(255,255,255,.32)"/>
      <rect x="74" y="78" width="106" height="24" rx="6" fill="rgba(255,98,88,.20)" stroke="#FF6258" stroke-width="2"/>
      <rect x="82" y="87" width="82" height="6" rx="3" fill="#FF6258"/>
      <rect x="80" y="114" width="58" height="5" rx="2.5" fill="rgba(255,255,255,.32)"/>
      <rect x="80" y="132" width="70" height="5" rx="2.5" fill="rgba(255,255,255,.32)"/>`)
  },
  {
    titulo: "3. Confirme e pronto",
    texto: "O celular pergunta se quer adicionar — confirme. O <b>ícone do Corretor Pro</b> aparece na tela inicial, e a partir daí ele também aparece na lista de compartilhar do WhatsApp.",
    desenho: () => cp1149Telinha(`
      <rect x="34" y="80" width="132" height="90" rx="12" fill="rgba(20,20,20,.95)" stroke="rgba(255,255,255,.18)"/>
      <rect x="46" y="96" width="30" height="30" rx="9" fill="rgba(255,98,88,.18)" stroke="#FF6258" stroke-width="2.5"/>
      <path d="M53 115 L61 106 L69 115" fill="none" stroke="#FF6258" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="86" y="102" width="66" height="6" rx="3" fill="rgba(255,255,255,.55)"/>
      <rect x="86" y="114" width="44" height="5" rx="2.5" fill="rgba(255,255,255,.30)"/>
      <rect x="96" y="140" width="58" height="20" rx="6" fill="rgba(255,98,88,.22)" stroke="#FF6258" stroke-width="2"/>
      <rect x="106" y="147" width="38" height="6" rx="3" fill="#FF6258"/>`)
  }
];
const CP1155_PASSOS_IOS = [
  {
    titulo: "1. Toque em Compartilhar",
    texto: "No iPhone tem que ser pelo <b>Safari</b>. Toque no ícone de <b>quadrado com a seta para cima</b>, na barra de baixo.",
    desenho: () => cp1149Telinha(`
      <rect x="14" y="240" width="172" height="30" rx="8" fill="rgba(255,255,255,.10)"/>
      <rect x="60" y="250" width="26" height="12" rx="3" fill="none" stroke="#FF6258" stroke-width="2.5"/>
      <path d="M73 258 v-12 M68 250 l5 -5 l5 5" fill="none" stroke="#FF6258" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="73" cy="255" r="18" fill="none" stroke="#FF6258" stroke-width="2"/>
      <rect x="26" y="60" width="148" height="120" rx="10" fill="rgba(255,255,255,.05)"/>`)
  },
  {
    titulo: "2. “Adicionar à Tela de Início”",
    texto: "Role a lista para baixo até achar <b>“Adicionar à Tela de Início”</b> e confirme. O ícone aparece junto dos seus apps.",
    desenho: () => cp1149Telinha(`
      <rect x="22" y="60" width="156" height="150" rx="12" fill="rgba(20,20,20,.95)" stroke="rgba(255,255,255,.18)"/>
      <rect x="34" y="76" width="80" height="5" rx="2.5" fill="rgba(255,255,255,.30)"/>
      <rect x="34" y="96" width="96" height="5" rx="2.5" fill="rgba(255,255,255,.30)"/>
      <rect x="28" y="112" width="144" height="26" rx="7" fill="rgba(255,98,88,.20)" stroke="#FF6258" stroke-width="2"/>
      <rect x="38" y="122" width="112" height="6" rx="3" fill="#FF6258"/>
      <rect x="34" y="152" width="70" height="5" rx="2.5" fill="rgba(255,255,255,.30)"/>`)
  }
];
// v1155 — quando o aparelho AINDA TEM o app instalado, ensinar a instalar é enganar: o navegador
// nunca vai oferecer, porque na conta dele o app já existe. Esta é a primeira tela nesse caso.
const CP1155_PASSO_JA_INSTALADO = {
  titulo: "O app já está neste celular",
  texto: "O navegador não oferece baixar porque o <b>Corretor Pro já está instalado</b> aqui. Se o ícone sumiu da tela inicial, ele continua na <b>gaveta de apps</b> (a lista com todos os apps do celular) — é só arrastar de volta pra tela inicial. Se quiser instalar do zero, desinstale de verdade primeiro em <b>Configurações → Apps → Corretor Pro</b>.",
  desenho: () => cp1149Telinha(`
    <rect x="24" y="40" width="152" height="140" rx="12" fill="rgba(255,255,255,.05)"/>
    <rect x="38" y="56" width="28" height="28" rx="8" fill="rgba(255,255,255,.14)"/>
    <rect x="86" y="56" width="28" height="28" rx="8" fill="rgba(255,255,255,.14)"/>
    <rect x="134" y="56" width="28" height="28" rx="8" fill="rgba(255,255,255,.14)"/>
    <rect x="38" y="104" width="28" height="28" rx="8" fill="rgba(255,98,88,.22)" stroke="#FF6258" stroke-width="2.5"/>
    <circle cx="52" cy="118" r="17" fill="none" stroke="#FF6258" stroke-width="2"/>
    <rect x="86" y="104" width="28" height="28" rx="8" fill="rgba(255,255,255,.14)"/>
    <rect x="134" y="104" width="28" height="28" rx="8" fill="rgba(255,255,255,.14)"/>
    <rect x="38" y="148" width="28" height="28" rx="8" fill="rgba(255,255,255,.14)"/>
    <rect x="86" y="148" width="28" height="28" rx="8" fill="rgba(255,255,255,.14)"/>`)
};
window.cpMostrarComoInstalar = function(){
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const base = ios ? CP1155_PASSOS_IOS : CP1155_PASSOS_ANDROID;
  const jaInstalado = (typeof window.cpAppJaInstaladoNoAparelho === "function") && window.cpAppJaInstaladoNoAparelho();
  const passos = jaInstalado ? [CP1155_PASSO_JA_INSTALADO, ...base] : base;
  let i = 0;
  document.querySelector("#cp1155Modal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "cp1155Modal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px";
  overlay.innerHTML = `<div id="cp1155Card" style="background:var(--panel);border:1px solid var(--line);border-radius:18px;max-width:420px;width:100%;max-height:92vh;overflow:auto;padding:18px"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector("#cp1155Card");
  const fechar = () => overlay.remove();
  const desenhar = () => {
    const p = passos[i];
    const ultimo = i === passos.length - 1;
    card.innerHTML = `
      <div class="small" style="color:var(--muted);font-weight:900;letter-spacing:.04em;text-transform:uppercase">${p === CP1155_PASSO_JA_INSTALADO ? "O app no seu celular" : "Instalar o Corretor Pro"}</div>
      <div style="font-size:19px;font-weight:950;margin:6px 0 6px">${p.titulo}</div>
      <div class="small" style="color:var(--soft);line-height:1.55;margin-bottom:12px">${p.texto}</div>
      <div style="display:flex;justify-content:center;margin-bottom:12px">${p.desenho()}</div>
      <div style="display:flex;gap:5px;justify-content:center;margin-bottom:12px">
        ${passos.map((_,k)=>`<span style="width:${k===i?18:7}px;height:7px;border-radius:9px;background:${k===i?'var(--lime)':'rgba(255,255,255,.22)'};display:inline-block"></span>`).join("")}
      </div>
      <div style="display:flex;gap:8px">
        ${i>0?`<button type="button" class="btn secondary" id="cp1155Voltar" style="flex:1">Voltar</button>`:`<button type="button" class="btn secondary" id="cp1155Fechar" style="flex:1">Fechar</button>`}
        <button type="button" class="btn" id="cp1155Proximo" style="flex:1.4">${ultimo?'Entendi':'Próximo'}</button>
      </div>`;
    card.querySelector("#cp1155Voltar")?.addEventListener("click", () => { i--; desenhar(); });
    card.querySelector("#cp1155Fechar")?.addEventListener("click", fechar);
    card.querySelector("#cp1155Proximo")?.addEventListener("click", () => { if(ultimo){ fechar(); return; } i++; desenhar(); });
  };
  desenhar();
  overlay.addEventListener("click", (ev) => { if(ev.target === overlay) fechar(); });
};

window.cp1149ComoEnviar = function(passoInicial){
  const passos = cp1149Passos();
  let i = Math.min(Math.max(Number(passoInicial)||0, 0), passos.length-1);
  document.querySelector("#cp1149Modal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "cp1149Modal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px";
  overlay.innerHTML = `<div id="cp1149Card" style="background:var(--panel);border:1px solid var(--line);border-radius:18px;max-width:420px;width:100%;max-height:92vh;overflow:auto;padding:18px 18px 16px"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector("#cp1149Card");
  const fechar = () => {
    try{ localStorage.setItem(cp1149VistoKey(), "1"); }catch(_){}
    overlay.remove();
  };
  const desenhar = () => {
    const p = passos[i];
    const ultimo = i === passos.length - 1;
    const textoPasso = (typeof p.texto === "function") ? p.texto() : p.texto;
    const desenhoPasso = (typeof p.desenho === "function") ? p.desenho() : p.desenho;
    card.innerHTML = `
      <div class="small" style="color:var(--muted);font-weight:900;letter-spacing:.04em;text-transform:uppercase">Como enviar sua conversa</div>
      <div style="font-size:19px;font-weight:950;margin:6px 0 6px">${p.titulo}</div>
      <div class="small" style="color:var(--soft);line-height:1.55;margin-bottom:12px">${textoPasso}</div>
      <div style="display:flex;justify-content:center;margin-bottom:12px">${desenhoPasso}</div>
      <div style="display:flex;gap:5px;justify-content:center;margin-bottom:12px">
        ${passos.map((_,k)=>`<span style="width:${k===i?18:7}px;height:7px;border-radius:9px;background:${k===i?'var(--lime)':'rgba(255,255,255,.22)'};display:inline-block"></span>`).join("")}
      </div>
      <div style="display:flex;gap:8px">
        ${i>0?`<button type="button" class="btn secondary" id="cp1149Voltar" style="flex:1">Voltar</button>`:`<button type="button" class="btn secondary" id="cp1149Fechar" style="flex:1">Fechar</button>`}
        <button type="button" class="btn" id="cp1149Proximo" style="flex:1.4">${ultimo?'Entendi, vamos lá':'Próximo'}</button>
      </div>`;
    // v1272 — o último passo do iPhone abre o seletor de arquivo AQUI. Antes o passo a passo
    // terminava mandando "volte e toque no botão" — e o botão estava atrás do modal, numa tela que
    // a pessoa ainda ia ter que achar. O clique é síncrono de propósito: o Safari só abre o
    // seletor dentro do toque do dedo, então fechar o modal primeiro mataria a abertura.
    card.querySelector("#cp1149EscolherArquivo")?.addEventListener("click", () => {
      try{ qs("#zipFileInput")?.click(); }catch(_){}
      fechar();
    });
    card.querySelector("#cp1149Instalar")?.addEventListener("click", async () => {
      try{ await window.cpInstalarApp?.(); }catch(_){}
      desenhar(); // depois de instalar (ou recusar), o texto se ajusta ao novo estado do aparelho
    });
    card.querySelector("#cp1149Voltar")?.addEventListener("click", () => { i--; desenhar(); });
    card.querySelector("#cp1149Fechar")?.addEventListener("click", fechar);
    card.querySelector("#cp1149Proximo")?.addEventListener("click", () => {
      if(ultimo){ fechar(); return; }
      i++; desenhar();
    });
  };
  desenhar();
  overlay.addEventListener("click", (ev) => { if(ev.target === overlay) fechar(); });
};
// Abre sozinho na PRIMEIRA vez de quem ainda não importou nada — o momento em que o corretor novo
// não sabe o que fazer. Uma vez visto, só volta pelo botão.
window.cp1149AbrirSePrimeiraVez = function(){
  try{
    if(localStorage.getItem(cp1149VistoKey())) return false;
    const temLead = Array.isArray(state?.itemsAtivos) ? state.itemsAtivos.length > 0
      : (Array.isArray(state?.leads) ? state.leads.length > 0 : false);
    if(temLead){ localStorage.setItem(cp1149VistoKey(), "1"); return false; } // já usa o app: não atrapalha
    window.cp1149ComoEnviar(0);
    return true;
  }catch(_){ return false; }
};

(function cpLigarSeletorDeZip(){
  const ajuda = qs("#importAjuda");
  if(ajuda) ajuda.innerHTML = cpTextoAjudaImportar();
  const input = qs("#zipFileInput");
  qs("#btnEscolherZip")?.addEventListener("click", () => input?.click());
  // v1149 — passo a passo ilustrado do WhatsApp (Android e iPhone), sempre à mão.
  qs("#btnComoEnviar")?.addEventListener("click", () => { try{ window.cp1149ComoEnviar(0); }catch(_){} });
  input?.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    // Zera o campo: sem isso, escolher DE NOVO o mesmo arquivo (ex.: depois de um erro) não
    // dispara nada, porque o navegador entende que o valor não mudou.
    ev.target.value = "";
    // v1248 — o botão ficava MORTO quando o pedaço da importação não conseguia ser baixado: o
    // corretor escolhia o ZIP e a tela simplesmente não fazia nada — sem aviso, sem barra, sem
    // erro. O miolo da importação já se protege sozinho; a janela descoberta era justamente o
    // download desse pedaço, que acontece ANTES de qualquer coisa aparecer na tela.
    if(file) Promise.resolve(processFile(file)).catch(() => {
      toast("Não consegui carregar a leitura da conversa. Confira a internet e toque de novo.");
    });
  });
})();
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
  // v1210 — E AVISA QUANDO ESTÁ BUSCANDO NA LISTA CURTA (relato do dono, 11/08/2026).
  //
  // Ele procurou um cliente logo depois de abrir o app, veio um resultado só, e a conclusão
  // natural foi "esse cliente não existe" — quando na verdade a carteira completa ainda estava
  // chegando e a busca tinha varrido só os leads da Home. Duas correções: a lista completa, ao
  // chegar, REFAZ a busca que está na tela (antes era preciso apagar e digitar de novo), e
  // enquanto ela não chega o resultado diz, em letra pequena, que ainda está incompleto.
  const carteiraCompleta = !!(state.todosLeads && state.todosLeads.length);
  const fonte = carteiraCompleta ? state.todosLeads : (state.leads || []);
  if(!carteiraCompleta){
    loadTodosLeadsBusca().then(() => {
      const digitado = String(qs("#buscaGlobal")?.value || "").toLowerCase().trim();
      if(digitado === termo && state.todosLeads && state.todosLeads.length) renderBuscaGlobal(termo);
    }).catch(()=>{});
  }
  const tt = semAcento(termo);
  const numeros = String(termo||"").replace(/\D/g,"");
  const matches = fonte.filter(l => {
    return semAcento(l.name).includes(tt) || semAcento(l.product).includes(tt) || (numeros.length >= 3 && String(l.phone||"").replace(/\D/g,"").includes(numeros));
  }).sort((a, b) => (leadArquivado(a) ? 1 : 0) - (leadArquivado(b) ? 1 : 0)) // ativos primeiro
    .slice(0, 12);
  const avisoParcial = carteiraCompleta
    ? ""
    : `<div class="small" style="padding:8px 10px;color:var(--muted);text-align:center">Ainda carregando o restante da sua carteira — a lista pode crescer em instantes.</div>`;
  if(!matches.length){
    box.style.display = "block";
    box.innerHTML = `<div class="small" style="padding:10px;color:var(--muted);text-align:center">Nenhum lead com "${escapeHtml(termo)}"</div>` + avisoParcial;
    return;
  }
  box.style.display = "block";
  box.innerHTML = avisoParcial + matches.map(l => {
    const idJs = JSON.stringify(String(l.id||""));
    const arq = leadArquivado(l);
    // O arquivado vem apagado (mais transparente) e com tarja — dá pra saber o que é sem abrir.
    const tarja = arq ? `<span class="cp-busca-arquivado">Arquivado</span>` : "";
    return `<div onclick='abrirLead(${idJs});document.querySelector("#buscaGlobal").value="";document.querySelector("#buscaGlobalResults").style.display="none"' style="padding:8px 10px;border-radius:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px${arq ? ";opacity:.62" : ""}" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background=''">
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
    } else if(data?.upgrade){
      // v1108 — limite do teste grátis: mostra o convite com o botão do WhatsApp comercial.
      qs("#memoriaStatus").innerHTML = escapeHtml(data?.detail || data?.error || "Limite do teste atingido.") +
        cpUpgradeProHTML({ mode: "limite_diario_excedido", upgrade: data.upgrade });
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
    a.download = `leads-corretor-pro-${new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try{ document.body.removeChild(a); }catch(_){}; URL.revokeObjectURL(url); }, 1000);
    toast(`Planilha de ${all.length} lead${all.length===1?"":"s"} baixada.`);
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
    a.download = `corretor-pro-backup-completo-${new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date())}.json`;
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
      html = `<b style="color:var(--risco)">❌ A chave da OpenAI não chegou ao app.</b><br>No Vercel, confira <b>OPENAI_API_KEY</b> e depois faça um novo deploy.`;
    } else if(tModelo && tModelo.ok){
      html = `<b style="color:var(--acao)">✅ OpenAI conectada e modelo principal funcionando.</b><br>Chave ${escapeHtml(cc.keyPrefix||"")}…${escapeHtml(cc.keyTail||"")} · análise ${escapeHtml(cc.analysisModel||"")} · mensagens ${escapeHtml(cc.messagesModel||"")}.`;
    } else {
      const msg = (tModelo && tModelo.error) || (d.primeiroErro && d.primeiroErro.mensagem) || "erro desconhecido";
      const dica = (tModelo && tModelo.hint) || (d.primeiroErro && d.primeiroErro.dica) || "";
      html = `<b style="color:#ffd27a">⚠️ A chave foi encontrada, mas o modelo principal não respondeu.</b><br>Modelo ${escapeHtml(cc.analysisModel||"")}.<br>Motivo: ${escapeHtml(String(msg))}${dica?`<br><span style="color:var(--muted)">${escapeHtml(String(dica))}</span>`:""}`;
    }
    if(out) out.innerHTML = html;
  }catch(e){
    if(out) out.innerHTML = `<span style="color:var(--risco)">Não consegui testar agora: ${escapeHtml(String(e?.message||e))}</span>`;
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


// v952: a renderização real de Arquivados (com paginação e busca) vive só dentro da IIFE
// #724-2, exposta em window.carregarArquivados. Existia uma segunda função de mesmo nome aqui
// (mais antiga, sem paginação nem suporte a busca) que nenhuma chamada `window.`-qualificada
// nunca usava — mas a navegação chamava o nome solto "carregarArquivados()", que por escopo
// léxico do módulo resolvia pra ESTA função velha, não pra atual. Removida (ver fix em
// carregarTelaAtiva). valeRevisitarArquivado também saiu: só era usada por este bloco morto,
// e já nem era chamada com motivos reais (sempre null) havia tempo.

// v1210 — o botão Reativar passou a existir também na barra de cima do lead (onde fica o
// "Arquivar"), e lá ele é ícone + rótulo. Trocar o textContent do botão inteiro, como era feito
// antes, apagaria o desenho do ícone e deixaria um botão torto depois de um erro. Quando existe o
// rótulo <span class="lb">, só ele muda.
function cpTrocarRotuloBotao(btn, texto){
  if(!btn) return;
  const lb = btn.querySelector?.(".lb");
  if(lb) lb.textContent = texto; else btn.textContent = texto;
}

async function reativarLeadArquivado(id, btn){
  if(!id) return;
  const msg = "Reativar este cliente? Ele volta para os atendimentos ativos.";
  const ok = (typeof cp903Confirm === "function")
    ? await cp903Confirm({ titulo: "Reativar lead", mensagem: msg, ok: "Reativar" })
    : confirm(msg);
  if(!ok) return;
  // O detalhe do lead aberto precisa ser redesenhado depois (o botão vira "Arquivar" de novo).
  // Na lista de Arquivados não há detalhe aberto, e redesenhar ali levaria pra outra tela.
  const detalheAberto = String(state?.lead?.id || "") === String(id);
  if(btn){ btn.disabled = true; cpTrocarRotuloBotao(btn, "Reativando..."); }
  try{
    const res = await fetch("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      // v1073 — "Ativo" é o único estado de volta possível desde a v1069 (o servidor rejeita
      // qualquer valor antigo de funil, ex.: "Atendimento" — mandar isso quebrava o Reativar).
      body: JSON.stringify({ id, action: "etapa", etapa: "Ativo" })
    });
    if(!res.ok) throw new Error("falha");
    toast("Lead reativado.");
    // v1125 — o outro lado da mesma moeda: sem atualizar a carteira em memória, o card
    // "Arquivados" da Home continuava contando este cliente (e o "Total de leads" não subia)
    // até um F5. Ele volta pra etapa Ativo nas listas que a Home já tem na mão.
    try{ cpMarcarEtapaLocal(id, "Ativo"); }catch(_){}
    const card = document.querySelector(`[data-arquivado-id="${id}"]`);
    if(card){ card.style.transition = "opacity .25s, transform .25s"; card.style.opacity = "0"; card.style.transform = "translateX(18px)"; setTimeout(() => card.remove(), 240); }
    loadRecentLeads();
    // Reativado de dentro do próprio lead: redesenha o detalhe pra barra de cima voltar a mostrar
    // "Arquivar" e o lead aparecer como ativo, sem precisar sair e entrar de novo.
    if(detalheAberto){ try{ await abrirLead(id); }catch(_){ } }
  }catch(err){
    if(btn){ btn.disabled = false; cpTrocarRotuloBotao(btn, "Reativar"); }
    toast("Erro ao reativar.");
  }
}
window.reativarLeadArquivado = reativarLeadArquivado;

qs("#copyMessage").addEventListener("click",async()=>{
  const textoCopiado = qs("#messageText").value;
  try{await navigator.clipboard.writeText(textoCopiado);toast("Mensagem copiada.")}
  catch(e){qs("#messageText").select();document.execCommand("copy");toast("Mensagem copiada.")}
  // v1142 — SEGUNDA CAUSA do "copio a sugestão e não marca atendimento".
  //
  // Este é o "Copiar" do card "Resposta pronta pra enviar", que aparece na tela de importação
  // logo depois de a análise sair — um dos momentos em que o corretor mais copia. Ele registrava
  // SÓ o contador de mensagens copiadas: nunca marcava atendimento, nunca entrava na conversa do
  // cliente como "Mensagem enviada". Copiar a MESMA sugestão de dentro do cliente marcava.
  // Mesma ação, dois comportamentos — era literalmente o "às vezes marca, às vezes não".
  //
  // O atendimento vai PRIMEIRO (lição da v1097: copiar é quando o app vai pro fundo e a segunda
  // gravação morre no caminho — se só uma sobreviver, que seja a que importa).
  try{ await registrarMensagemEnviada(state.lead?.id, textoCopiado); }catch(_){}
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
// os caches e recarrega. Cobre o caso em que o service worker não detecta a troca sozinho.
//
// v1275 — a trava era "1x por sessão" (sessionStorage "vchk"), e a checagem só acontecia no
// carregamento da página. No app INSTALADO isso significava nunca mais: o aplicativo fica vivo
// em segundo plano por dias, a sessão nunca termina, então a única checagem tinha acontecido na
// primeira vez que ele abriu — e todas as atualizações publicadas depois disso passavam batido.
// Era por isso que o dono continuava vendo uma correção antiga na tela mesmo com a nova no ar.
// Agora a trava é de TEMPO (nunca mais de uma checagem por CP_VCHK_INTERVALO), o que continua
// impedindo qualquer laço, e a checagem volta a rodar quando ele traz o app pra frente ou quando
// a internet volta.
const CP_VCHK_INTERVALO = 5 * 60 * 1000;
function cpVchkAgora(){ return Date.now(); }
async function checarVersaoServidor(){
  try{
    // Nunca recarrega enquanto um ZIP recebido do WhatsApp estiver pendente/processando.
    // No cold start, um reload aqui era suficiente para perder a primeira tentativa.
    if(window.__cpShareImportActive || state?.processing || state?.pendingSharedRecordId) return;
    const ultima = parseInt(sessionStorage.getItem("vchk") || "0", 10) || 0;
    if(ultima && (cpVchkAgora() - ultima) < CP_VCHK_INTERVALO) return;
    const elv = document.querySelector(".mob-ver, .sb-ver-top");
    const attr = document.documentElement.dataset.appVersion || document.body?.dataset?.appVersion || "";
    const atual = parseInt(attr,10) || (elv ? (parseInt((String(elv.textContent).match(/#(\d+)/)||[])[1], 10) || 0) : 0);
    if(!atual) return;
    const r = await fetch("./index.html?vc=" + Date.now(), { cache: "no-store" });
    if(!r.ok) return;
    const html = await r.text();
    const m = html.match(/Atualiza[çc][ãa]o #(\d+)/);
    const servidor = m ? (parseInt(m[1], 10) || 0) : 0;
    sessionStorage.setItem("vchk", String(cpVchkAgora())); // no máximo 1 checagem a cada 5 min
    if(servidor > atual){
      // v1107 — só apaga as caches ESTÁTICAS versionadas. A cache do compartilhamento
      // (direciona-sharetarget-stable) pode guardar um ZIP compartilhado ainda não processado
      // (fallback quando o IndexedDB falha) — apagar ela aqui perdia a importação.
      try{ if(window.caches){ const ks = await caches.keys(); await Promise.all(ks.filter(k => k.startsWith("corretor-pro-static")).map(k => caches.delete(k))); } }catch(_){}
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
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => checarVersaoServidor(), { timeout: 8000 });
      } else {
        setTimeout(checarVersaoServidor, 4000);
      }
      // v1275 — o app volta a procurar versão nova quando é trazido pra frente e quando a
      // internet volta. O medo antigo (anotado aqui até a v1274) era de recarregar a tela toda
      // vez que ele trocasse de aba: não é o que acontece. Quem checa é a função acima, que só
      // recarrega quando o servidor REALMENTE tem um número maior — e no máximo uma vez a cada
      // cinco minutos. Sem isso, o app instalado ficava preso na versão do dia em que foi aberto.
      const revisar = () => {
        if(document.visibilityState !== "visible") return;
        reg.update().catch(() => {});
        checarVersaoServidor();
      };
      addEventListener("visibilitychange", revisar);
      addEventListener("online", revisar);
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
      stamp.textContent = problemas.join(" · ");
      stamp.hidden = false;
    } else {
      stamp.textContent = ""; stamp.hidden = true; // tudo certo: o aviso não ocupa espaço
    }
  }catch(_){
    stamp.textContent = ""; stamp.hidden = true; // se a própria checagem falhar, melhor calar que assustar
  }
})();

export function refreshAllSections(){
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
    resposta:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    nota:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5M9 12h7M9 16h5"/></svg>'
  };
  return icons[nome] || icons.ativos;
}

// Classificação única usada pela Home, Atendimentos e Pipeline.
// Antes cada tela tinha uma regra diferente, por isso a Home mostrava 5 quentes
// e Atendimentos mostrava zero.
function leadEhAtivo(l){
  return normalizarEtapa(l?.etapa) !== ETAPA_ARQUIVADO;
}

// ============ v1138 — LEMBRETE DIÁRIO ============
// Item 4 do plano aprovado pelo dono. A pesquisa da auditoria: a maioria das vendas sai depois do
// 5º contato e quase metade dos corretores para no 1º — e os concorrentes ganham exatamente aqui,
// no lembrete automático. Uma notificação por dia, com o app fechado (Android com o app instalado
// — Periodic Background Sync), lida de um retrato local que o próprio app grava. Nenhum servidor
// novo, nenhuma rota nova, nada sai do aparelho.
//
// v1190 — A FONTE DO LEMBRETE MUDOU. Ele nascia de cpLeadsAguardandoResposta: "clientes esperando
// resposta há mais de 24h", contado por lastInteractionAt/daysSinceClientReply/lastCorretorMsgIso
// — ou seja, por quem falou por último no retrato importado. É a MESMA inferência que a v1158 e a
// v1189 baniram da fila: o app não é integrado ao WhatsApp, o corretor já respondeu lá, e o que
// chegava era uma cobrança por conversa resolvida. Agora o lembrete conta só o que o próprio
// sistema registrou com data: compromisso atrasado + a dose de "Fazer agora" do dia — exatamente
// os mesmos números que o app mostra na Home (card "Fazer agora") e no aviso do sino.
const CP_LEMBRETE_DIARIO_KEY = "cp-lembrete-diario";

// Ações com lastro pra cobrar hoje. Só fato registrado no sistema entra:
//   - compromisso/lembrete ATRASADO (data marcada que já passou — cp786CompromissoAtrasado);
//   - a dose de "Fazer agora" do dia, pela fila OFICIAL (cpFilaFazerAgora limitada pela meta que
//     ainda falta — a mesma conta do sino, que já desconta quem foi atendido hoje e devolve zero
//     no fim de semana).
// Nada aqui olha "quem falou por último".
function cpAcoesFactuaisDeHoje(items){
  const ativos = (Array.isArray(items) ? items : []).filter(leadEhAtivo);
  let atrasados = 0;
  for(const l of ativos){
    try{ if(typeof cp786CompromissoAtrasado === 'function' && cp786CompromissoAtrasado(l)) atrasados++; }catch(_){}
  }
  let fazerAgora = 0;
  try{
    const fila = (typeof cpFilaFazerAgora === 'function') ? cpFilaFazerAgora(ativos) : [];
    const dose = (typeof cpFazerAgoraDose === 'function') ? cpFazerAgoraDose(ativos) : 0;
    fazerAgora = Math.max(0, Math.min(fila.length, dose));
  }catch(_){}
  return { atrasados, fazerAgora, total: atrasados + fazerAgora };
}

function cpNotifDB(){
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open("corretor-pro-notif", 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore("kv"); };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
async function cpNotifGravar(chave, valor){
  try{
    const db = await cpNotifDB();
    await new Promise((resolve) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(valor, chave);
      tx.oncomplete = resolve; tx.onerror = resolve;
    });
    db.close();
  }catch(_){ /* sem IndexedDB, sem retrato — o lembrete simplesmente não dispara */ }
}

// Grava o retrato compacto que o service worker lê de madrugada. Roda em segundo plano a cada
// carga de leads — barato (só conta o que já está em memória) e sempre atualizado enquanto o app
// for usado.
//
// v1190 — PRIVACIDADE: o retrato guardava até 3 NOMES DE CLIENTES, e o service worker os
// imprimia na tela bloqueada do celular ("3 clientes estão esperando — João, Maria, Carlos").
// Quem pega o telefone na mesa lê nome de cliente sem desbloquear nada. Agora só vão números e a
// hora do cálculo — nome de cliente não é mais gravado nesse retrato. A chave antiga é
// sobrescrita na primeira carga de leads depois desta atualização, então os nomes que já estavam
// no aparelho somem sozinhos.
function cpAtualizarRetratoAcoes(items){
  try{
    const acoes = cpAcoesFactuaisDeHoje(items);
    cpNotifGravar("retrato", {
      total: acoes.total,
      atrasados: acoes.atrasados,
      fazerAgora: acoes.fazerAgora,
      calculadoEm: Date.now()
    });
  }catch(_){ }
}

function cpLembreteDiarioLigado(){
  try{ return localStorage.getItem(CP_LEMBRETE_DIARIO_KEY) === "on"; }catch(_){ return false; }
}
async function cpLembreteDiarioRegistrarSync(){
  try{
    const reg = await navigator.serviceWorker?.ready;
    if(!reg || !("periodicSync" in reg)) return false;
    await reg.periodicSync.register("cp-cobranca-diaria", { minInterval: 20 * 60 * 60 * 1000 });
    return true;
  }catch(_){ return false; }
}
async function cpLembreteDiarioDesregistrar(){
  try{
    const reg = await navigator.serviceWorker?.ready;
    if(reg && ("periodicSync" in reg)) await reg.periodicSync.unregister("cp-cobranca-diaria");
  }catch(_){ }
}

function cpLembreteDiarioStatus(texto, cor){
  const el = qs("#lembreteDiarioStatus");
  if(el){ el.textContent = texto; el.style.color = cor || "var(--muted)"; }
}
function cpLembreteDiarioRender(){
  const btn = qs("#btnLembreteDiario");
  if(!btn) return;
  if(!("Notification" in window)){
    btn.style.display = "none";
    cpLembreteDiarioStatus("Este navegador não mostra notificações. No celular Android, instale o app pra ter o lembrete.");
    return;
  }
  if(cpLembreteDiarioLigado() && Notification.permission === "granted"){
    btn.textContent = "Desativar lembrete diário";
    btn.classList.add("secondary");
  } else {
    btn.textContent = "Ativar lembrete diário";
    btn.classList.remove("secondary");
    if(Notification.permission === "denied"){
      cpLembreteDiarioStatus("O navegador está bloqueando notificações deste site — libere nas configurações do navegador e tente de novo.");
    }
  }
}
async function cpLembreteDiario(){
  if(!("Notification" in window)) return;
  if(cpLembreteDiarioLigado()){
    try{ localStorage.setItem(CP_LEMBRETE_DIARIO_KEY, "off"); }catch(_){ }
    await cpLembreteDiarioDesregistrar();
    cpLembreteDiarioStatus("Lembrete desativado.");
    cpLembreteDiarioRender();
    return;
  }
  const perm = await Notification.requestPermission();
  if(perm !== "granted"){
    cpLembreteDiarioStatus("Sem a permissão de notificação o lembrete não tem como chegar. Se mudar de ideia, toque de novo.");
    cpLembreteDiarioRender();
    return;
  }
  try{ localStorage.setItem(CP_LEMBRETE_DIARIO_KEY, "on"); }catch(_){ }
  // Atualiza o retrato agora, com o que estiver em memória — pra primeira notificação não sair velha.
  cpAtualizarRetratoAcoes(state.todosLeads || state.itemsAtivos || []);
  const fundo = await cpLembreteDiarioRegistrarSync();
  cpLembreteDiarioStatus(fundo
    ? "Ativado. O aviso chega uma vez por dia, mesmo com o app fechado."
    : "Ativado. Neste navegador o aviso em segundo plano não é suportado — no Android, com o app instalado, ele chega mesmo fechado. Aqui, o sino do topo segue mostrando o que pede ação hoje.",
    "var(--acao)");
  cpLembreteDiarioRender();
}
window.cpLembreteDiario = cpLembreteDiario;
try{ cpLembreteDiarioRender(); }catch(_){ }
// v1268 (2ª passada) — leadEhQuente saiu junto com abrirAtendimentosFiltro, a única que a usava.

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
// v1266 — cp1265UltimaMensagemExibida (que juntava a mensagem enviada pelo app à última mensagem da
// conversa, pra o cabeçalho do cliente) foi REMOVIDA no dia seguinte, por ordem do dono: "último
// contato é último atendimento". O cabeçalho não procura mais a última MENSAGEM quando existe
// atendimento registrado — mostra o atendimento, e pronto. Sem atendimento nenhum, cai em
// cp786UltimaMensagemReal (logo acima), que é a régua de sempre.
// v1189 — AQUI MORAVA O DETECTOR "CLIENTE RESPONDEU" (e três ajudantes que só serviam a ele).
// Saiu DE VEZ, por ordem do dono — e a v1188 é a prova de por que não bastava deixá-lo dormindo.
//
// A regra do produto (a mesma que tirou o bônus da fila na v1158, palavras do dono: "retire isso
// e do código também, já te falei ontem que você não tem como saber, pois não é integrado com o
// WhatsApp"): o app lê um RETRATO da conversa — o arquivo que o corretor exporta — não o
// WhatsApp ao vivo. O corretor SEMPRE responde o cliente no WhatsApp, na hora. Uma mensagem do
// cliente só entra no app quando ele mesmo a importa, e nesse momento o app já analisa e gera a
// resposta — esse é o fluxo. Depois disso, "a última fala é do cliente" no retrato NÃO significa
// cliente sem resposta: significa só que o corretor ainda não reimportou. Uma categoria fixa
// "Cliente respondeu" construída em cima disso cobra o corretor por conversas que ele já
// respondeu — o ruído exato que as v938/v1019/v1052 mataram (só o atendimento MARCADO decide).
//
// A v1188 achou esse detector órfão e o religou achando que era "feature perdida" — mesmo erro
// da v1186 com o painel de duplicados (ver NOTAS-v1187: órfão não é feature perdida). Se você
// está lendo isto com vontade de recriar um aviso de "cliente respondeu e você não viu": não dá
// pra saber isso sem integração com o WhatsApp. Não invente.
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
  // A nota que ordena o "Fazer agora". Depois das limpezas da v1158/v1159 sobraram três fatores, e
  // todos são verificáveis na conversa importada (nada de palpite sobre o que o app não vê):
  //   recorrência (em quantos dias o cliente voltou a escrever) · perguntas que ele fez ·
  //   sinal de negociação (já falaram de valor/condição; proposta em aberto).
  // Um lead "explosão de mensagens" (ex.: 218 msgs em 2 dias, sem retomada, sem pergunta, sem
  // negociação) continua NÃO vencendo um lead com poucas mensagens mas recorrente + qualificado —
  // agora porque volume simplesmente não entra mais na conta.
  // v1139 — RÉGUA ÚNICA DE 90 DIAS (aprovada pelo dono): a barrinha da Home já contava só os
  // últimos 90 dias (v1017), mas a ORDEM seguia contando a conversa inteira desde sempre — papo
  // de proposta de meses atrás pesava como negociação ativa, e um lead com barra "2" aparecia
  // acima de um com barra "36" (foi exatamente a dúvida que o dono trouxe). Agora os fatores de
  // conversa (recorrência, perguntas, sinal de negociação) valem dentro da MESMA janela de 90 dias
  // da barrinha — tela e ordem contam a mesma história. Quem esfriou não some: o resgate diário
  // (cpAplicarResgatesNaFila) é o caminho de volta dele. Os campos *90d vêm do servidor (mesma
  // varredura do _statsCache); dado antigo em cache, ainda sem os campos novos, cai nos totais
  // históricos (o comportamento anterior) até a carga seguinte — por isso os fallbacks
  // "?? l?.clientMessageDays" / "?? l?.clientQuestionCount" abaixo.
  // v1159 — SAIU O VOLUME DE MENSAGENS (+1 cada, teto 30). Pergunta do dono: "+1 por mensagem dele
  // e +6 por pergunta que ele fez — cara, isso é a mesma coisa, ou não?". Não é a mesma coisa, mas
  // se sobrepõe: toda pergunta já contava duas vezes (+1 de mensagem e +6 de pergunta). E volume
  // não diz se o cliente compra — quem escreve muito pode estar só curioso. Ficaram os dois
  // fatores que medem interesse de verdade: em quantos DIAS ele voltou a escrever e quantas
  // PERGUNTAS fez. (O volume segue vivo na barrinha da Home e como desempate em cpFilaFazerAgora.)
  const recorrencia = Math.min(Number(l?.clientMessageDays90d ?? l?.clientMessageDays) || 0, 20);
  const perguntas = Math.min(Number(l?.clientQuestionCount90d ?? l?.clientQuestionCount) || 0, 20);
  const resp = Number(l?.daysSinceClientReply);
  let sinalNegociacao = 0;
  // v1139 — o sinal de negociação vem do TEXTO da análise (não tem data própria), então usa a
  // última fala do cliente como relógio: cliente calado há mais de 90 dias = negociação fria,
  // não soma mais os +35/+70 pra sempre.
  if(Number.isFinite(resp) && resp <= 90){
    try{
      const ctx = (typeof contextoPrioridadeIA === 'function') ? contextoPrioridadeIA(l) : null;
      if(ctx?.propostaAtiva) sinalNegociacao += 1;   // já se falou de valor/condição/entrada/financiamento
      if(ctx?.retornoProposta) sinalNegociacao += 1; // negociação num ponto avançado (proposta/contraproposta)
    }catch(_){}
  }
  // v1158 — SAIU O BÔNUS DE "CLIENTE ESPERANDO SUA RESPOSTA" (+30). Ordem do dono, com o motivo:
  // "retire isso e do código também, já te falei ontem que você não tem como saber, pois não é
  // integrado com o WhatsApp". Está certo: o app vê um retrato da conversa (o arquivo exportado),
  // não o WhatsApp ao vivo. Se ele respondeu o cliente depois da exportação, o app continuava
  // achando que a bola estava com ele — e empurrava esse lead pro topo por um palpite. Fatores que
  // sobraram são todos verificáveis no que foi importado: dias em que o cliente escreveu,
  // perguntas, sinal de negociação, volume, e o tempo desde o último atendimento MARCADO por ele.
  // v1159 — SAIU A PENALIDADE POR TEMPO PARADO (−2 por dia desde o último atendimento marcado,
  // teto 90 → até −180). Ela nasceu de um pedido do dono na v1056 ("fazer o tempo parado pesar
  // contra a posição na fila") e ele mesmo a revogou agora: "isso é ridículo... se o cliente não me
  // responde vai baixando por quê? Tem que respeitar o prazo, o cara tem outras coisas pra fazer
  // também; pensa como humano, negociador, e não como um robô chato". Dois motivos concretos além
  // do argumento dele:
  //   1) desde a régua de 90 dias (v1139), cliente frio JÁ pontua perto de zero sozinho — a
  //      penalidade cobrava a mesma coisa duas vezes;
  //   2) pior: cliente NOVO, que nunca foi atendido, caía no teto (−180), como se estivesse 90 dias
  //      parado — quem escreveu hoje começava no fim da fila.
  // Quem esfriou não fica esquecido: as vagas de resgate do dia (cpAplicarResgatesNaFila) são o
  // caminho de volta, e elas usam justamente "há mais tempo sem atendimento".
  return recorrencia*8 + perguntas*6 + sinalNegociacao*35;
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
    // v1113 — cliente que NUNCA respondeu segue o calendário de retomadas (cpCadenciaSemResposta),
    // não os sinais normais: só aparece na fila quando a retomada vence (ou pra sugerir arquivar
    // depois das 10). Entre uma retomada e outra, some da fila — sem cobrança fora de hora.
    const cad = (typeof cpCadenciaSemResposta === 'function') ? cpCadenciaSemResposta(l) : null;
    if(cad?.ativo){
      if(ehContatadoHoje(l) || cp786TemCompromisso(l)) return false;
      return cad.encerrar || cad.devida;
    }
    const nuncaAtendido = !(typeof ultimoAtendimentoTs==='function' && ultimoAtendimentoTs(l));
    const passouPrazo = !(typeof emJanelaDeEspera==='function' && emJanelaDeEspera(l));
    // v1189 — a v1188 tinha posto aqui um furo no descanso pra "cliente que respondeu depois do
    // atendimento". REVOGADO pelo dono, pela mesma razão da v1158: o app vê o retrato exportado,
    // não o WhatsApp ao vivo — ele SEMPRE responde o cliente no WhatsApp, e a mensagem do cliente
    // só chega aqui quando ele importa (momento em que o app já analisa e gera resposta). "Última
    // fala é do cliente" dias depois só quer dizer "ainda não reimportou", nunca "cliente sem
    // resposta". O furo trazia de volta pra fila lead já respondido — a regra v1069/v1052 fica
    // como sempre foi: só NUNCA atendido ou prazo de descanso vencido, contado do atendimento
    // MARCADO.
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
// v1139 — RESGATE DIÁRIO (aprovado pelo dono junto com a régua de 90 dias): a ordem por
// probabilidade deixa quem tem conversa rica sempre em cima — numa carteira grande, lead de
// conversa curta afundava e ficava meses sem aparecer (o card de quem estava sem atender, que
// existiu até a v1246, só crescia).
// Agora, dentro da própria dose do dia, as ÚLTIMAS N vagas são de quem está há mais tempo sem
// atendimento (mesma régua daquele card: nunca contatado primeiro, depois o
// contato mais antigo — cpUltimoContatoCorretorTs). N é configurável no Cérebro ("Resgates por
// dia", 0 desliga; "como tem atendimento por dia, crie resgates por dia" — palavras do dono),
// padrão 2. Ninguém entra por fora: o resgate só REORDENA a fila elegível (cpFilaFazerAgora),
// então as regras de entrada (descanso, dias de atendimento, cadência de quem nunca respondeu)
// continuam decidindo quem pode aparecer.
const CP_RESGATES_DIA_PADRAO = 2;
function cpResgatesPorDia(){
  try{
    const cfg = (typeof obterCerebroConfigParaAnalise === "function") ? obterCerebroConfigParaAnalise() : null;
    const n = Number(cfg?.resgatesPorDia);
    if(Number.isFinite(n) && n >= 0 && n <= 20) return Math.round(n);
  }catch(_){}
  return CP_RESGATES_DIA_PADRAO;
}
// Função pura (testável isolada): recebe a fila JÁ ordenada por probabilidade, o total de vagas
// do dia e quantas delas são de resgate. Devolve a fila reordenada — topo por probabilidade, o
// fim da dose com os resgatados, e o resto atrás na ordem de sempre. Se a fila inteira já cabe
// nas vagas, não há o que resgatar (todo mundo aparece de qualquer jeito).
function cpAplicarResgatesNaFila(fila, vagas, resgates){
  const lista = Array.isArray(fila) ? fila.slice() : [];
  const v = Math.max(0, Number(vagas) || 0);
  const r = Math.max(0, Math.min(Number(resgates) || 0, v));
  if(!r || lista.length <= v) return lista;
  const quentes = lista.slice(0, v - r);
  const resto = lista.slice(v - r);
  const ts = (l) => { try{ return (typeof cpUltimoContatoCorretorTs === 'function') ? (cpUltimoContatoCorretorTs(l) || 0) : 0; }catch(_){ return 0; } };
  const resgatados = resto.map((l, i) => ({ l, t: ts(l), i }))
    .sort((a, b) => (a.t - b.t) || (a.i - b.i)) // 0 (nunca contatado) primeiro, depois o mais antigo
    .slice(0, r).map(x => x.l);
  return [...quentes, ...resgatados, ...resto.filter(l => !resgatados.includes(l))];
}
// A fila que as TELAS usam (Home e a lista do card "Fazer agora"): a ranqueada com o resgate
// aplicado nas vagas de hoje (meta restante + "Atender mais um"). As CONTAGENS continuam usando
// cpFilaFazerAgora direto — reordenar não muda quantos são.
function cpFilaFazerAgoraComResgates(items){
  const fila = (typeof cpFilaFazerAgora === 'function') ? cpFilaFazerAgora(items) : [];
  const extra = (typeof state !== 'undefined' && state) ? Math.max(0, Number(state.fazerAgoraExtra || 0)) : 0;
  const vagas = ((typeof cpFazerAgoraDose === 'function') ? cpFazerAgoraDose(items) : 0) + extra;
  return cpAplicarResgatesNaFila(fila, vagas, cpResgatesPorDia());
}
window.cpNotaPrioridade = cpNotaPrioridade;
window.cpFilaFazerAgora = cpFilaFazerAgora;
window.cpFimDeSemana = cpFimDeSemana;
window.cpAtendidosHojeTotal = cpAtendidosHojeTotal;
window.cpFazerAgoraDose = cpFazerAgoraDose;
window.cpMetaAtendimentosDia = cpMetaAtendimentosDia;
window.cpResgatesPorDia = cpResgatesPorDia;
window.cpAplicarResgatesNaFila = cpAplicarResgatesNaFila;
window.cpFilaFazerAgoraComResgates = cpFilaFazerAgoraComResgates;

// v1199 — a faixa "Ficaram de te dar uma resposta" (v1160/v1161/v1167) foi removida. Ela assumia
// que o cliente "ainda não respondeu" só porque a última coisa que o Corretor Pro leu foi aquela
// promessa — mas o app não é integrado ao WhatsApp em tempo real, então isso podia estar resolvido
// há muito tempo sem o app saber (exatamente o mesmo problema, já identificado pelo dono, que
// tirou o sinal "cliente aguardando você" da fila na v1190: "o app não tem como saber se o corretor
// já respondeu no WhatsApp depois da exportação"). cpTruncarTexto sobrevive porque cp1168 (a faixa
// "Hoje na agenda", que é sobre COMPROMISSO COM DATA MARCADA — informação de verdade, não palpite
// sobre resposta pendente) também usa esse recorte de texto.
function cpTruncarTexto(texto, max = 90){
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// ===== v1168 — "Hoje na agenda" na Home: visível, não só o pontinho do sino =====
//
// Print do dono: "o aviso de agendamento para o dia esta muito singelo, apenas um pontinho
// laranja ao lado do sino, eu nem percebo isso... e tem um agendamento pra hoje que vi por acaso
// pq o sistema nao me alertou". Com razão: sem atraso, o sino só liga uma classe CSS que pinta um
// pontinho — sem número, sem texto, do tamanho de uma migalha (ver updateBell). E o card "Agenda"
// da Home mostra o total de TODOS os compromissos (hoje + futuros), sem separar o que é hoje.
//
// Esta faixa mostra, bem no topo da Home, exatamente quem tem lembrete ou compromisso pra HOJE —
// mesma régua de "hoje" que a tela Agenda já usa (lembreteTs no dia corrente / confirmedAppointments
// com "hoje" no texto), pra nunca dizer uma coisa aqui e outra lá.
function cp1168ItensDeHoje(items){
  if(!Array.isArray(items)) return [];
  // v1248 — mesma correção de fuso da barra do topo: o dia é o de BRASÍLIA, não o do relógio do
  // aparelho. Com o celular noutro fuso, a faixa de hoje deixava de listar o compromisso de hoje.
  const iniHoje = inicioDoDiaBR().getTime();
  const fimHoje = iniHoje + 86400000 - 1;
  const lista = [];
  for(const l of items){
    if(normalizarEtapa(l.etapa) === ETAPA_ARQUIVADO) continue;
    // Já tratou este cliente hoje: o compromisso/lembrete de hoje já foi honrado, não precisa
    // continuar cobrando na faixa.
    if(typeof ehContatadoHoje === 'function' && ehContatadoHoje(l)) continue;
    const lemTs = (typeof lembreteTs === 'function') ? lembreteTs(l) : NaN;
    if(!isNaN(lemTs) && lemTs >= iniHoje && lemTs <= fimHoje){
      const motivo = l.analysis?.lembrete?.motivo || "";
      lista.push({ lead:l, horario: cp1168HoraCurta(lemTs), texto: motivo || "Lembrete marcado pra hoje", ts: lemTs });
    }
    const aps = l.analysis?.confirmedAppointments;
    if(Array.isArray(aps)){
      for(const ap of aps){
        const texto = String(ap?.quando || "");
        if(!/\bhoje\b/i.test(texto)) continue;
        const horario = cp1168HoraDoTexto(texto);
        // Com hora reconhecida, ordena por ela de verdade (senão "17h" aparecia ANTES de um
        // lembrete das 12:30 — tudo compromisso caía no início, sempre, por sortear por
        // "início do dia"). Sem hora no texto, vai pro fim da lista de hoje: mais vale mostrar
        // primeiro quem tem hora marcada do que um item vago tipo "hoje, sem hora dita".
        const ts = cp1168TsDeHojeComHora(horario);
        lista.push({ lead:l, horario, texto: ap?.oQue || "Compromisso hoje", ts: ts == null ? fimHoje : ts });
      }
    }
  }
  lista.sort((a, b) => a.ts - b.ts);
  return lista;
}
function cp1168HoraCurta(ts){
  try{ return new Intl.DateTimeFormat("pt-BR", { timeZone:"America/Sao_Paulo", hour:"2-digit", minute:"2-digit" }).format(new Date(ts)); }
  catch(_){ return ""; }
}
// "hoje às 15h" → "15h"; "hoje 15:30" → "15:30". Sem hora no texto, devolve vazio (o card mostra
// só um marcador, sem inventar horário nenhum).
function cp1168HoraDoTexto(texto){
  const m = /\b(\d{1,2})(?:[:h](\d{2}))?\s*h?\b/i.exec(String(texto || "").replace(/\bhoje\b/i, ""));
  if(!m) return "";
  const hh = String(m[1]).padStart(2, "0");
  return m[2] ? `${hh}:${m[2]}` : `${hh}h`;
}
// "17h" / "12:30" (o formato que cp1168HoraDoTexto devolve) → timestamp de HOJE naquele horário.
function cp1168TsDeHojeComHora(horaStr){
  const m = /^(\d{1,2})(?::(\d{2}))?h?$/.exec(String(horaStr || ""));
  if(!m) return null;
  // v1260 — a hora escrita no compromisso ("17h") é hora de BRASÍLIA, igual ao resto desta faixa
  // (que usa inicioDoDiaBR desde a v1248). Aqui tinha ficado o relógio do APARELHO: com o celular
  // em outro fuso, o compromisso das 17h caía fora da janela de hoje e ia parar no fim da lista —
  // depois até dos itens que não têm hora nenhuma, que é justamente o contrário do que a v1168
  // quis fazer. Achado pela suíte, que quebrava toda noite depois das 21h por causa disso.
  return inicioDoDiaBR().getTime() + Number(m[1]) * 3600000 + Number(m[2] || 0) * 60000;
}
function cp1168FaixaHomeHTML(items){
  const lista = cp1168ItensDeHoje(items).slice(0, 8);
  if(!lista.length) return "";
  const linhas = lista.map(({ lead, horario, texto }) => {
    const idJs = JSON.stringify(String(lead.id || ""));
    const horaHtml = horario
      ? `<b class="cp1168-hora">${escapeHtml(horario)}</b>`
      : `<b class="cp1168-hora cp1168-sem-hora">•</b>`;
    return `<button type="button" class="cp1168-row" onclick='abrirLead(${idJs})'>
      ${horaHtml}
      <span class="cp1168-nome">${escapeHtml(lead.name || "Cliente")}</span>
      <i class="cp1168-motivo">${escapeHtml(cpTruncarTexto(texto, 60))}</i>
    </button>`;
  }).join("");
  return `<div class="cp1168-faixa">
    <div class="cp1168-tit">📅 Hoje na agenda · ${lista.length}</div>
    ${linhas}
  </div>`;
}
window.cp1168ItensDeHoje = cp1168ItensDeHoje;
window.cp1168FaixaHomeHTML = cp1168FaixaHomeHTML;

// ===== v1170/v1171 — Bloco de notas administrativas =====
//
// Pedido do dono: um lugar fácil de achar pra anotar tarefa que NÃO é atendimento de cliente —
// "verificar pagamento de entrada de tal cliente", "matrículas atualizadas no registro de
// imóveis". Guardado numa chave PRÓPRIA do banco (ver api/cerebro-config.js, NOTAS_KEY),
// separada do Cérebro Comercial de propósito: o Cérebro vira contexto pra IA nas sugestões de
// mensagem, e uma nota administrativa não pode vazar pra dentro de uma sugestão pro cliente.
//
// v1171 — o dono escolheu, entre 4 modelos de posição (ícone no cabeçalho / dentro dos números /
// faixa fina / barra fixa embaixo), o modelo "dentro dos números": virou mais uma pílula na
// mesma fileira de "Fazer agora / Total de leads / Agenda...", do mesmo tamanho que as outras —
// não é mais uma faixa própria acima da busca. Tocar nela abre um painel flutuante (estilo
// .cp687-notify-panel), não mais um bloco que empurra o resto da tela pra baixo.
//
// Sincroniza pelo servidor (mesmo padrão do Cérebro e da carteira): abre no celular, edita no
// computador, continua igual dos dois lados. O carregamento dispara sozinho assim que a Home
// aparece (renderBotoesHome chama cp1170Carregar), pra a pílula já nascer com o número certo.
let _cp1170Notas = null;       // cache em memória da sessão (null = ainda não carregou nenhuma vez)
let _cp1170Carregando = null;
let _cp1170PainelAberto = false;

async function cp1170Carregar(force){
  if(!force && Array.isArray(_cp1170Notas)) return _cp1170Notas;
  if(_cp1170Carregando) return _cp1170Carregando;
  _cp1170Carregando = (async () => {
    try{
      const res = await fetchComTimeout("./api/cerebro-config", { cache:"no-store" }, 15000);
      const data = await res.json().catch(() => null);
      if(Array.isArray(data?.notas)) _cp1170Notas = data.notas;
      else if(!Array.isArray(_cp1170Notas)) _cp1170Notas = [];
    }catch(_){
      if(!Array.isArray(_cp1170Notas)) _cp1170Notas = [];
    }
    _cp1170Carregando = null;
    cp1170Rerender();
    return _cp1170Notas;
  })();
  return _cp1170Carregando;
}

function cp1170PendCount(){
  return Array.isArray(_cp1170Notas) ? _cp1170Notas.filter(n => !n?.feita).length : 0;
}
window.cp1170PendCount = cp1170PendCount;

// Atualiza a pílula da fileira de números (só o número, sem redesenhar a fileira inteira) e,
// se o painel estiver aberto, redesenha o corpo dele também.
function cp1170Rerender(){
  // v1246 — o número das notas mora no bloco do topo agora; o quadradinho da fileira da Home foi
  // removido. Uma conta só, num lugar só (lição das v1215/v1227).
  cp1246AtualizarBlocoTopo();
  const painel = qs("#cp1170Panel");
  if(painel && _cp1170PainelAberto) painel.innerHTML = cp1170PainelConteudoHTML();
}

function cp1170ItemHTML(n){
  const idJs = JSON.stringify(String(n?.id || ""));
  return `<div class="cp1170-item${n?.feita ? ' feita' : ''}">
    <input type="checkbox" ${n?.feita ? 'checked' : ''} onchange='cp1170Concluir(${idJs}, this.checked)'>
    <span>${escapeHtml(n?.texto || "")}</span>
    <button type="button" title="Apagar" onclick='cp1170Remover(${idJs})'>×</button>
  </div>`;
}

// Conteúdo de dentro do painel flutuante (cabeçalho + caixa de adicionar + lista).
function cp1170PainelConteudoHTML(){
  const carregado = Array.isArray(_cp1170Notas);
  const notas = carregado ? _cp1170Notas : [];
  const pendentes = notas.filter(n => !n?.feita);
  const feitas = notas.filter(n => n?.feita);
  return `
    <div class="cp687-notify-head">
      <div><h3>📝 Bloco de notas</h3><small>Tarefa que não é atendimento de cliente.</small></div>
      <button type="button" class="cp687-notify-close" onclick="cp1170FecharPainel()" aria-label="Fechar">×</button>
    </div>
    <div class="cp1170-add">
      <input type="text" id="cp1170Input" placeholder="Ex.: Verificar pagamento de entrada da Maria" maxlength="500" onkeydown='if(event.key==="Enter"){event.preventDefault();cp1170Adicionar();}'>
      <button type="button" onclick="cp1170Adicionar()">Adicionar</button>
    </div>
    ${!carregado ? '<div class="cp1170-vazio">Carregando…</div>' : (!notas.length ? '<div class="cp1170-vazio">Nada anotado ainda.</div>' : '')}
    ${pendentes.map(cp1170ItemHTML).join("")}
    ${feitas.map(cp1170ItemHTML).join("")}
  `;
}

// Cria o painel uma vez e reaproveita depois; fecha sozinho ao tocar fora ou no ×.
function cp1170AbrirPainel(){
  let painel = qs("#cp1170Panel");
  if(!painel){
    painel = document.createElement("div");
    painel.className = "cp687-notify-panel cp1170-panel";
    painel.id = "cp1170Panel";
    document.body.appendChild(painel);
  }
  _cp1170PainelAberto = true;
  painel.innerHTML = cp1170PainelConteudoHTML();
  painel.classList.add("open");
  cp1170Carregar();
  setTimeout(() => qs("#cp1170Input")?.focus(), 80);
  // v1248 — SÓ UM vigia de clique por vez. Abrir o Bloco de notas com ele já aberto (gesto natural
  // pra fechar) somava mais um vigia em cima do anterior, e nada nunca os removia: ao longo de um
  // dia de uso eles iam se acumulando e cada toque na tela acordava todos. Agora o anterior é
  // retirado antes de pôr o novo, e fechar o painel retira o que estiver de pé.
  cp1170LigarVigiaDeCliqueFora();
}
window.cp1170AbrirPainel = cp1170AbrirPainel;

function cp1170LigarVigiaDeCliqueFora(){
  document.removeEventListener("click", cp1170CliqueFora);
  setTimeout(() => {
    if(!_cp1170PainelAberto) return;
    document.removeEventListener("click", cp1170CliqueFora);
    document.addEventListener("click", cp1170CliqueFora, { once: true });
  }, 0);
}

function cp1170FecharPainel(){
  _cp1170PainelAberto = false;
  document.removeEventListener("click", cp1170CliqueFora);
  qs("#cp1170Panel")?.classList.remove("open");
}
window.cp1170FecharPainel = cp1170FecharPainel;

function cp1170CliqueFora(ev){
  const painel = qs("#cp1170Panel");
  if(!painel) return;
  if(!painel.contains(ev.target) && !ev.target.closest("#btnNotasTopo")) cp1170FecharPainel();
  else if(_cp1170PainelAberto) cp1170LigarVigiaDeCliqueFora();
}

async function cp1170Adicionar(){
  const input = qs("#cp1170Input");
  const texto = (input?.value || "").trim();
  if(!texto){ toast("Escreva o que precisa fazer."); return; }
  if(input) input.disabled = true;
  try{
    const res = await fetchComTimeout("./api/cerebro-config", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"nota-adicionar", texto })
    }, 15000);
    const data = await res.json().catch(() => ({ ok:false }));
    if(!res.ok || !data?.ok) throw new Error(data?.error || "Não foi possível salvar a nota.");
    _cp1170Notas = Array.isArray(data.notas) ? data.notas : _cp1170Notas;
    cp1170Rerender();
    setTimeout(() => qs("#cp1170Input")?.focus(), 60);
  }catch(err){
    toast("Não foi possível salvar: " + (err?.message || err));
    if(input) input.disabled = false;
  }
}
window.cp1170Adicionar = cp1170Adicionar;

// Patch otimista: marca/desmarca na hora, sem esperar o servidor — é uma lista de tarefas, não
// dado comercial. Se o servidor discordar (rede caiu, etc.), a próxima sincronização corrige.
async function cp1170Concluir(id, feita){
  if(Array.isArray(_cp1170Notas)){
    const n = _cp1170Notas.find(x => String(x?.id) === String(id));
    if(n) n.feita = !!feita;
  }
  cp1170Rerender();
  try{
    const res = await fetchComTimeout("./api/cerebro-config", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"nota-concluir", id, feita:!!feita })
    }, 15000);
    const data = await res.json().catch(() => ({ ok:false }));
    if(res.ok && data?.ok && Array.isArray(data.notas)){ _cp1170Notas = data.notas; cp1170Rerender(); }
  }catch(_){ /* fica como está na tela; a próxima abertura do bloco sincroniza de novo */ }
}
window.cp1170Concluir = cp1170Concluir;

async function cp1170Remover(id){
  const anterior = _cp1170Notas;
  if(Array.isArray(_cp1170Notas)) _cp1170Notas = _cp1170Notas.filter(n => String(n?.id) !== String(id));
  cp1170Rerender();
  try{
    const res = await fetchComTimeout("./api/cerebro-config", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"nota-remover", id })
    }, 15000);
    const data = await res.json().catch(() => ({ ok:false }));
    if(!res.ok || !data?.ok) throw new Error(data?.error || "Falha ao apagar.");
    if(Array.isArray(data.notas)) _cp1170Notas = data.notas;
    cp1170Rerender();
  }catch(err){
    _cp1170Notas = anterior; // desfaz o otimista se o servidor não confirmou
    cp1170Rerender();
    toast("Não foi possível apagar: " + (err?.message || err));
  }
}
window.cp1170Remover = cp1170Remover;

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
//
// v1266 — SAIU A PARTE DO "CLIENTE AINDA NÃO RESPONDEU". Ordem do dono, 13/08/2026: "não interessa
// quem está esperando quem, já te disse q não tem como saber sem estar integrado com whats".
//
// `cpAguardandoResposta` e `ultimaMsgClienteTs` foram REMOVIDAS e não podem voltar: as duas
// comparavam a data da última fala do cliente com a do atendimento pra afirmar de quem era a bola —
// exatamente o palpite que a v1158 tirou da ordem da fila, que a v1189 tirou da categoria e que a
// v1199 tirou da faixa "ficaram de te dar uma resposta". O app lê o retrato exportado da conversa,
// não o WhatsApp ao vivo: "o cliente não falou depois" só quer dizer "ainda não reimportei".
//
// "Aguardando cliente" passa a ter o único significado que o app tem como sustentar: VOCÊ atendeu e
// ainda está dentro do descanso configurado no Cérebro (emJanelaDeEspera — que já exige atendimento
// registrado, então cliente nunca atendido continua fora daqui). Passado o descanso, ele sai
// daqui e volta pro fluxo normal, como antes.
function cp786Categoria(l,modelo=null,ultimaReal=null){
  if(!leadEhAtivo(l)) return '';
  if(cp786TemCompromisso(l)) return 'programados';
  // v1189 — NÃO EXISTE (e não pode voltar a existir) uma categoria "cliente respondeu". A v1188
  // produziu uma aqui por um dia e o dono revogou: o app não é integrado ao WhatsApp — ele lê o
  // retrato que o corretor exporta, e o corretor SEMPRE responde o cliente no WhatsApp. Quando a
  // resposta do cliente entra no app (na importação), o app já analisa e gera a resposta na hora;
  // fora desse momento, "o cliente falou por último" no retrato só significa "ainda não
  // reimportou". Uma categoria fixa disso cobra o corretor por conversa já respondida (mesma
  // razão da v1158, que tirou o bônus equivalente da ordem da fila).
  // v1071 — "aguardando" só vale ENQUANTO ainda está dentro do prazo de descanso configurado
  // (emJanelaDeEspera): sem esse limite, o mesmo cliente ficava "aguardando" pra sempre mesmo
  // depois de já ter passado do prazo (quando ele já reaparece em "Fazer agora") — os dois
  // números diziam coisas opostas sobre o mesmo cliente. Passado o prazo, ele "vence" aqui e
  // cai no fluxo normal (agora/sem-acao) — deixa de contar como espera legítima.
  if(emJanelaDeEspera(l)) return 'aguardando'; // v1266: atendi e ainda estou dentro do descanso
  if(mensagensDoCliente(l) < CP_MIN_MSGS_PRIORIDADE) return 'sem-acao'; // lead raso: prospecção, fora dos cards de destaque
  return entraEmRetomada(l) ? 'agora' : 'sem-acao';                    // vale um toque? Fazer agora; senão, só em "Total de leads"
}
function cp786CategoriaLabel(c){
  return ({agora:'Fazer agora',programados:'Agenda',aguardando:'Aguardando cliente','sem-acao':'Sem ação agora'})[c]||'Sem ação agora';
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
  // v1213 — COMPROMISSO ATENDIDO NO DIA MARCADO NÃO É ATRASADO (relato do dono, 11/08/2026).
  //
  // O lead "Bocorni" aparecia em "Atrasados — retome ou descarte" com o lembrete de 10/08, mas o
  // próprio cadastro dizia que ele tinha sido atendido em 10/08 — ou seja, o compromisso foi
  // CUMPRIDO no dia. A régua antiga só perdoava quem tivesse sido atendido HOJE, então todo
  // compromisso cumprido na data virava cobrança no dia seguinte: o corretor fez o que tinha que
  // fazer e o app cobrava assim mesmo. Agora o atendimento registrado NA DATA do compromisso (ou
  // depois dela) cumpre aquele compromisso, e ele não entra mais na lista.
  const considerar=(diff,ts)=>{ if(diff==null||diff>=0||diff< -JANELA||!ts) return; if(cpCompromissoJaAtendido(l,ts)) return; if(!melhor||diff>melhor.diff) melhor={diff,ts}; };
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
// v1213 — "atendi no dia marcado; por que ainda está atrasado?".
//
// Compara por DIA (fuso de São Paulo, que é o do app inteiro), não pela hora: um compromisso das
// 14h atendido às 9h do mesmo dia está cumprido do mesmo jeito — quem trabalha não registra
// atendimento com cronômetro. O que conta como atendimento é o MESMO de sempre
// (ultimoAtendimentoTs: botão "Marcar atendimento", cópia de mensagem, visita/ligação/observação
// registradas na timeline e os campos de último atendimento gravados na base) — esta peça só
// compara datas, não inventa uma definição nova de atendimento.
function cpCompromissoJaAtendido(l, ts){
  if(!ts) return false;
  const atendidoEm = (typeof ultimoAtendimentoTs === 'function') ? ultimoAtendimentoTs(l) : 0;
  if(!atendidoEm) return false;
  try{
    const dia = (t) => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(t));
    return dia(atendidoEm) >= dia(ts); // 'AAAA-MM-DD' compara certo como texto
  }catch(_){ return atendidoEm >= ts; }
}
window.cpCompromissoJaAtendido=cpCompromissoJaAtendido;
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
    // v1213 — mesma régua da contagem: compromisso atendido na data marcada (ou depois) está
    // cumprido e não pode continuar listado como pendência dentro do lead.
    if(cpCompromissoJaAtendido(l, cp786DataTs(data,'12:00'))) continue;
    out.push({ key, oQue:String(ap?.oQue||'compromisso'), trecho:String(ap?.trechoLiteral||'').trim(), dias:Math.abs(diff), dataBR:new Date(cp786DataTs(data,'12:00')).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'}) });
  }
  out.sort((a,b)=>a.dias-b.dias);
  return out;
}
window.cpCompromissosVencidosDoLead=cpCompromissosVencidosDoLead;
// v1268 (2ª passada) — cp786CompararConducao REMOVIDA. Era uma SEGUNDA ordenação de lista de
// clientes, sobrevivente da tela "Condução" (apagada na v1075), que ninguém chamava — e pior:
// ordenava por uma régua diferente da que vale (cp786OrdenarConducao, logo abaixo, tem o
// comparador dela própria embutido). Dois relógios contando diferente é a doença que este projeto
// já pagou caro várias vezes; o que não roda, mas contradiz o que roda, é o pior tipo de resto.
function cp786OrdenarConducao(lista,metaPronto=null){
  const arr=Array.isArray(lista)?lista.slice():[];
  const ordem={agora:0,programados:1,aguardando:2,'sem-acao':3};
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
  return ({agora:'Fazer agora',programados:'Agenda',aguardando:'Aguardar','sem-acao':'Sem ação'})[c]||'Abrir';
}
function cp786Classe(l,categoria=null){
  const c=categoria||cp786Categoria(l);
  if(c==='agora') return 'hot';
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
window.cp786TemCompromisso=cp786TemCompromisso;
window.cp786AguardandoCliente=cp786AguardandoCliente;
window.cp786Categoria=cp786Categoria;
window.cp786CategoriaLabel=cp786CategoriaLabel;
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
  // v1139 — mesma fila da Home (com as vagas de resgate aplicadas), pra lista do card e a lista
  // da Home nunca divergirem.
  const fila=(typeof cpFilaFazerAgoraComResgates==='function')?cpFilaFazerAgoraComResgates(ativos):cpFilaFazerAgora(ativos);
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
  // v1232 — o card "Agenda" SAIU desta fileira (pedido do dono): o número do total mora agora no
  // bloco do topo (calendário + sino, ver atualizarSinoAgenda), sempre visível em qualquer tela.
  const aguardando=ativos.filter(l=>cp786Categoria(l)==='aguardando').length;
  const totalLeads=ativos.length;
  // v1246 — "Sem atender 30d+" foi APAGADO da Home a pedido do dono ("pode deletar tb, nao sera
  // mais necessario"). "Arquivados" e "Bloco de notas" saíram daqui e subiram pro bloco do topo
  // (modelo B escolhido por ele) — quem preenche os dois números é cp1246AtualizarBlocoTopo.
  cp1246AtualizarBlocoTopo();
  // v1171 — pedido do dono: um quadradinho só pra "quantos atendi" — hoje, nesta semana e neste
  // mês, 3 contagens simples (não é meta/dose batida, é só o total concluído em cada período) —,
  // pra fileira ficar parelha no celular junto do Bloco de notas (7 quadradinhos sobrava um
  // sozinho numa linha — 8 fecha 2 fileiras de 4 certinhas).
  // v1183 — as três contagens saem da carteira INTEIRA, não só da ativa ("arquivado também é
  // atendimento", palavras do dono). Atender um cliente e arquivar em seguida derrubava o número
  // aqui, enquanto a frase da saudação logo acima continuava contando (ela usa
  // cpAtendidosHojeTotal, que nunca filtrou arquivado — é o mesmo defeito que a v980 já tinha
  // corrigido lá e que nasceu de novo neste quadradinho). Mesma base das duas, sem divergir.
  // v1251 — O QUADRADINHO "ATENDIDOS" SAIU DAQUI. Ele apertava três contagens (hoje/semana/mês)
  // num quadrado do tamanho dos outros, e o dono pediu pra tirar de lá ("acho q ta na hora de
  // tirarmos ele de dentro desse card"). As três contagens continuam existindo, com a mesma régua
  // de sempre — mudaram de casa: agora moram no painel "Seu mês", junto das mensagens trocadas e
  // do gráfico de atendimentos dia a dia (ver cp1251Dados). No computador o painel fica aberto na
  // coluna da direita; no celular, atrás da linha de resumo logo abaixo desta fileira.
  box.style.display="grid";
  box.innerHTML = `
    <div class="ui-kpi${fazerAgora>0?' active':''}" onclick="abrirFazerAgora()"><span>Fazer agora</span><div>${faB}<i>${ui631Icon('resposta')}</i></div></div>
    <div class="ui-kpi" onclick="abrirCarteiraAtiva()"><span>Total de leads</span><div><b>${totalLeads}</b><i>${ui631Icon('ativos')}</i></div></div>
    <div class="ui-kpi" onclick="abrirAguardandoCliente()"><span>Aguardando cliente</span><div><b>${aguardando}</b><i>${ui631Icon('ativos')}</i></div></div>`;
  try{ cp1251RenderResumo(); }catch(_){ }
};

// v1246 — os dois números que subiram pro bloco do topo (Bloco de notas e Arquivados).
//
// A conta é a MESMA que os quadradinhos faziam, pra não nascer divergência entre a tela velha e a
// nova (lição das v1215/v1227, quando dois lugares contavam a agenda cada um do seu jeito):
//   • notas     — cp1170PendCount(), o mesmo contador do painel do Bloco de notas;
//   • arquivados— state.todosLeads (a carteira INTEIRA), porque a Home só recebe a ativa.
// Sem a carteira carregada ainda, mostra 0 em vez de quebrar a barra.
function cp1246AtualizarBlocoTopo(){
  const notasEl = document.getElementById('cpNotasTopoN');
  if(notasEl){
    let n = 0;
    try{ n = (typeof cp1170PendCount === 'function') ? cp1170PendCount() : 0; }catch(_){}
    notasEl.textContent = String(n || 0);
  }
  const arqEl = document.getElementById('cpArquivadosTopoN');
  if(arqEl){
    let n = 0;
    try{ n = (state.todosLeads||[]).filter(l=>normalizarEtapa(l.etapa)===ETAPA_ARQUIVADO).length; }catch(_){}
    arqEl.textContent = String(n || 0);
  }
}
window.cp1246AtualizarBlocoTopo = cp1246AtualizarBlocoTopo;

function ui631LeadMotivo(l){
  const mc=cp786Modelo(l), acao=cp786TextoSemJargao(mc?.acao?.descricao||l?.nextAction||'');
  const d=Number(l?.daysSinceLastInteraction||0);
  if(acao) return [acao.length>72?acao.slice(0,69).trim()+'...':acao,''];
  if(cp786Categoria(l)==='programados') return ['Compromisso na agenda','Acompanhar na data certa'];
  if(cp786Categoria(l)==='aguardando') return ['Aguardando o cliente','Não cobrar novamente agora'];
  if(d>=7) return [`Último contato há ${d} dias`,'Bom momento para retomar'];
  return ['Próxima ação pendente','Abrir diagnóstico antes de responder'];
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
  const agora=cp786OrdenarConducao(ativos.filter(l=>categoriaDe(l)==='agora'));
  const programados=cp786OrdenarConducao(ativos.filter(l=>categoriaDe(l)==='programados'));
  const aguardando=cp786OrdenarConducao(ativos.filter(l=>categoriaDe(l)==='aguardando'));
  const prioritarios=agora.slice(0,4);
  // Hotfix #807: este renderer intermediário também pode ser chamado durante a carga inicial.
  // Sem esta variável, a interpolação do botão "Ver todos" lançava ReferenceError e deixava
  // a Home presa no skeleton, embora os contadores já tivessem sido carregados.
  const filtroPrincipal=agora.length?'agora':programados.length?'programados':'aguardando';
  // As novas visões orientadas à ação são a fonte principal. Mantemos aliases internos
  // usados por rotinas antigas (voltar, histórico e atalhos) para não quebrar navegação.
  const acaoHoje=agora;
  state.gruposHome={
    agora,programados,aguardando,todos:ativos,
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

// v1215 — marcar/desmarcar atendimento redesenhava a barra de compromissos do topo mas NÃO o
// número do sino: o cliente saía da Agenda e continuava sendo contado lá em cima até um F5. Aqui
// os dois avisos são refeitos juntos, e o sino usa a carteira que já está em memória (com a
// marcação recém-aplicada) em vez de esperar o banco responder.
function cpAtualizarAvisosAgenda(){
  try{ carregarAgendaTopo?.(); }catch(_){}
  const memoria = [state.itemsAtivos, state.todosLeads, state.leads].find(x => Array.isArray(x) && x.length);
  try{ atualizarSinoAgenda(memoria); }catch(_){}
}
window.cpAtualizarAvisosAgenda = cpAtualizarAvisosAgenda;

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
  // v1215 — ponto de passagem de TODAS as marcações de atendimento (botão, cópia de mensagem,
  // observação, agendamento): é aqui que o número do sino também se acerta, senão ele continuava
  // cobrando um cliente que já saiu da Agenda.
  try{ cpAtualizarAvisosAgenda?.(); }catch(_){}
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
    cpAtualizarAvisosAgenda(); // v1215 — barra do topo E número do sino, juntos
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
    cpAtualizarAvisosAgenda(); // v1215 — desmarcar também devolve o cliente ao número do sino
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

// v1016 — este placeholder escrevia "Bom dia, corretor!" (nome genérico) no instante em que a
// página abre, antes de saber o nome de verdade — o corretor via um nome errado piscando na tela
// por um instante a cada troca de conta/carregamento. Removido: o título fica no "Hoje" estático
// do HTML até renderSaudacao() trocar pelo nome de verdade (já roda assim que os dados chegam,
// inclusive em contas com zero leads, desde a v1014).
async function iniciarDireciona(){
  // Share Target vem antes da Home. Enquanto existe um ZIP pendente, nenhuma rotina
  // inicial pode trocar a tela nem disparar recarga automática.
  const compartilhado = await checkShared().catch(() => ({ handled:false }));
  // v1192 — "falhou" (compartilhamento que não deu certo) NÃO interrompe mais o arranque: o aviso
  // fica na tela e o app carrega a carteira por trás, pra quem tocar em "Voltar ao app" encontrar
  // tudo no lugar. Só uma importação DE VERDADE em andamento segura o arranque, como sempre.
  if((compartilhado?.handled && !compartilhado?.falhou) || window.__cpShareImportActive || state?.pendingSharedRecordId) return;
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
      cpCarteiraSincronizada(); // v1135 — veio do servidor: a memória está em dia
    }
  }catch(err){ console.warn("iniciarDireciona", err); }
}
requestAnimationFrame(iniciarDireciona);

// Sincronização entre aparelhos: consulta o banco periodicamente quando a Home está visível.
// A chamada força leitura nova; o cache local continua servindo só para navegação imediata.
// v1121 — subiu de 30s para 2min. A cada tique isto baixa a base INTEIRA de clientes (com a
// conversa de cada um) fresca do banco; a 30s, com a Home aberta o dia todo, eram ~120 downloads
// da base por hora — o maior gasto de tráfego (egress) do Supabase, que estava estourando o plano
// grátis. 2min mantém a sincronização celular↔PC (mudança aparece em até 2min, ótimo pra um CRM) e
// corta ~75% desse tráfego. Qualquer ação real (importar, salvar, mudar etapa, trocar de aba) já
// força uma leitura nova na hora, então nada fica "velho" durante o uso ativo.
const CP_SYNC_FUNDO_MS = 120 * 1000;
setInterval(async () => {
  // v818: não atualizar a Home enquanto um lead está aberto. O detalhe do lead é
  // renderizado DENTRO da Home (#leadFocoArea), então state.active continua "home".
  // Sem esta trava, o refresh reescrevia a área e jogava o corretor de volta pra lista.
  if(state.active === "home" && document.visibilityState === "visible" && !state.focoLeadId && !state.lead?.id){
    // v1166 — pergunta primeiro, em poucos bytes, se mudou alguma coisa. Sem mudança, não baixa
    // nada: é o que tira do ar a maior parte do tráfego do plano grátis do Supabase. Qualquer
    // dúvida (erro, tempo esgotado, servidor sem resposta clara) responde "mudou" e o tique segue
    // igual a antes — nunca esconde novidade pra economizar.
    if(!(await cpCarteiraMudouDesdeAUltimaCarga())) return;
    invalidarLeadsCache();
    await loadRecentLeads(true);
    carregarDashboard("reaproveitar"); // refaz as contas com o que acabou de chegar, sem baixar de novo
    carregarAgendaTopo();
    // Recarimba DEPOIS da busca: se algo mudou em outro aparelho enquanto ela acontecia, o
    // próximo tique enxerga — em vez de comparar com um retrato anterior à carga.
    cpEsquecerAssinaturaCarteira();
    await cpCarteiraMudouDesdeAUltimaCarga();
  }
}, CP_SYNC_FUNDO_MS);
// Refresh quando a aba volta a ficar visível (depois de mudar pra outra aba)
let __lastVisibleRefresh = 0;
document.addEventListener("visibilitychange", () => {
  // v818: mesma trava do interval — não refazer a Home com um lead aberto.
  if(document.visibilityState === "visible" && state.active === "home" && !state.focoLeadId && !state.lead?.id){
    const agora = Date.now();
    if(agora - __lastVisibleRefresh < 5000) return;
    __lastVisibleRefresh = agora;
    setTimeout(async () => {
      // v1166 — mesma pergunta barata do tique de fundo: voltar pra aba não precisa rebaixar a
      // carteira inteira quando nada mudou. Qualquer dúvida faz a busca completa, como antes.
      if(!(await cpCarteiraMudouDesdeAUltimaCarga())) return;
      invalidarLeadsCache();
      await loadRecentLeads(true);
      carregarDashboard("reaproveitar"); // idem: sem segunda ida ao banco pelo mesmo dado
      carregarAgendaTopo();
      cpEsquecerAssinaturaCarteira();
      await cpCarteiraMudouDesdeAUltimaCarga();
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
  if(categoria==='agora') return {label:'Fazer agora',cls:'hot',cor:'var(--cp-coral)'};
  if(categoria==='programados') return {label:'Agenda',cls:'warm',cor:'var(--cp-blue)'};
  if(categoria==='aguardando') return {label:'Aguardar',cls:'cold',cor:'var(--cp-slate)'};
  return {label:'Sem ação',cls:'cold',cor:'var(--cp-slate)'};
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
  // v1188 — COMPROMISSO VENCIDO NÃO PODE SE APRESENTAR COMO "Hoje". Auditoria comercial de
  // 09/08/2026: um retorno combinado que venceu ANTEONTEM aparecia no box "Próximos compromissos"
  // com o rótulo "Hoje" (era só o valor padrão da variável, não uma data de verdade) e o chip
  // azul "Agenda" — ou seja, o esquecimento se vestia de coisa em dia. A regra do produto sempre
  // foi a oposta: compromisso vencido fica em Programados COM DESTAQUE DE ATRASADO até o corretor
  // marcar atendimento (comentário da própria cp786TemCompromisso). O destaque agora existe:
  // rótulo "Venceu há N dias" e a flag `atrasado`, que o card usa pra pintar o chip de vermelho.
  // Vencido também ordena PRIMEIRO (o timestamp fica no passado, antes de qualquer futuro).
  let atrasado=false;
  if(!escolhido && !usarLembrete){
    const venc=(typeof cp786CompromissoAtrasado==='function')?cp786CompromissoAtrasado(lead):null;
    if(venc){
      atrasado=true;
      time=venc.dias===0?'Venceu hoje':venc.dias===1?'Venceu ontem':`Venceu há ${venc.dias} dias`;
      text=[lead?.analysis?.lembrete?.motivo||'Compromisso combinado',produtosLabel(lead)||''].filter(Boolean).join(' · ');
      return {time,text:text||'Compromisso',sortTs:Date.now()-venc.dias*86400000,atrasado};
    }
  }
  return {time,text:text||'Compromisso',sortTs:escolhido?.ts||lembreteTs||Number.MAX_SAFE_INTEGER,atrasado};
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
// v1106 — o dono, dia 1º de agosto: "pra ver resultados do mês passado como faço?". Não fazia:
// virou o mês, os números zeravam na tela (os DADOS continuam — tudo tem data). Este é o começo
// do mês anterior; o fim dele é cpInicioMesMs().
function cpInicioMesAnteriorMs(){
  // Deriva de cpInicioMesMs() no calendário de America/Sao_Paulo — getFullYear()/getMonth()
  // usariam o fuso do APARELHO: em Cuiabá/Manaus (UTC-4/-5) a virada do mês acontecia em outra
  // hora e o "mês anterior" pulava um mês a mais pra trás (chip mostrava "Junho" em 1º de agosto).
  const iniIso = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date(cpInicioMesMs()));
  let y = Number(iniIso.slice(0,4)), m = Number(iniIso.slice(5,7)) - 1;
  if(m === 0){ m = 12; y -= 1; }
  return new Date(`${y}-${String(m).padStart(2,"0")}-01T00:00:00-03:00`).getTime();
}
window.cpInicioMesAnteriorMs = cpInicioMesAnteriorMs;
function cpTempoAppSegundosPeriodo(iniMs, fimMs){
  const mapa = cpTempoAppLerMapa();
  let total = 0;
  for(const [chave, seg] of Object.entries(mapa)){
    const t = new Date(`${chave}T12:00:00-03:00`).getTime();
    if(Number.isFinite(t) && t >= iniMs && t < fimMs) total += Number(seg)||0;
  }
  return Math.round(total);
}
function cpDesempenhoMetricas(items, all, periodo){
  const ativos = Array.isArray(items) ? items : [];
  const todos = Array.isArray(all) ? all : ativos;
  const cutoffPeriodo = periodo?.ini ?? (typeof cpInicioMesMs === "function" ? cpInicioMesMs() : (Date.now() - 30*24*60*60*1000));
  const fimPeriodo = periodo?.fim ?? null; // null = até agora (mês corrente)
  const dentro = (t) => Number.isFinite(t) && t >= cutoffPeriodo && (!fimPeriodo || t < fimPeriodo);

  // v1281 — "Mensagens trocadas" desta tela era contada em cima da PRÉVIA de mensagens que a
  // listagem manda (as últimas ~8 de cada cliente). Numa carteira de conversas de verdade isso
  // sai MUITO abaixo da realidade — e, desde a v1251, o painel "Seu mês" da tela inicial mostra o
  // número certo (contado no servidor, sobre a conversa inteira). Resultado: as duas telas
  // respondiam a MESMA pergunta com números bem diferentes no mesmo mês, e foi o que o dono
  // estranhou no print de 15/08/2026. Agora as duas leem a mesma fonte: os campos que o servidor
  // manda prontos por cliente — msgMes* (mês corrente) e msgMesAnt* (mês fechado anterior).
  // Se a carteira ainda vier sem esses campos (cache antigo, resposta velha em cache), cai na
  // contagem antiga em vez de mostrar zero.
  const vendoMesAnterior = !!fimPeriodo;
  let msgServidor = 0, temMsgServidor = false, msgPrevia = 0;
  let mensagensCopiadas = 0;
  const leadsAtendidosIds = new Set();
  const propostas = [];
  // v1182 — "Análises feitas" e "Importações" vinham SÓ do registro de uso deste aparelho
  // (localStorage, ver cpRegistrarAtividade), que não sincroniza entre celular e PC e ainda é
  // podado em 90 dias. Trocar de aparelho, reinstalar o app ou limpar os dados do navegador
  // zerava as duas linhas mesmo com a carteira cheia — foi exatamente o que o dono viu em julho
  // (159 leads atendidos, 696 mensagens trocadas e "Análises feitas 0 / Importações 0", com
  // "Tempo no app: menos de 1min" denunciando que aquele aparelho não tinha histórico local).
  // Agora as duas também são deduzidas da CARTEIRA, que é sincronizada na conta: cada lead criado
  // dentro do período é uma importação, e cada carimbo de análise/reanálise dentro do período é
  // uma análise. Vale o MAIOR entre o registro do aparelho e o deduzido — quem sempre usou o mesmo
  // aparelho não perde nada (o registro local também conta reanálise de lead já existente e
  // reimportação que não cria cadastro novo), e quem trocou de aparelho para de ver zero.
  const CP_MESMA_ANALISE_MS = 10 * 60 * 1000; // carimbos a menos de 10min = a MESMA análise
  let importacoesCarteira = 0, analisesCarteira = 0;
  for(const l of todos){
    const campoServidor = vendoMesAnterior ? l?.msgMesAntTotal : l?.msgMesTotal;
    if(campoServidor !== undefined && campoServidor !== null){
      temMsgServidor = true;
      msgServidor += Number(campoServidor) || 0;
    }
    const msgs = Array.isArray(l?.recentMessages) ? l.recentMessages : [];
    for(const m of msgs){
      const t = Date.parse(m?.iso || "");
      if(dentro(t)) msgPrevia++;
      if(m?.type === "proposta" && (!fimPeriodo ? true : dentro(t))) propostas.push({ lead:l, ts: Number.isFinite(t)?t:0 });
    }
    const eventos = l?.analysis?.aprendizado?.eventos || [];
    let atendeuNaJanela = false;
    for(const e of eventos){
      const t = Date.parse(e?.quando || "");
      if(!dentro(t)) continue;
      if(e.evento === "contato_manual") atendeuNaJanela = true;
      if(e.evento === "mensagem_copiada") mensagensCopiadas++;
    }
    if(atendeuNaJanela) leadsAtendidosIds.add(String(l.id));

    if(dentro(Date.parse(l?.createdAt || ""))) importacoesCarteira++;
    const an = l?.analysis || {};
    // Uma análise nova carimba geradoEm E reanalisadoEm quase no mesmo instante (ver
    // api/lead-update.js) — sem agrupar, cada importação contaria como duas análises.
    const carimbos = [an.geradoEm, an.analisadoEm, an.reanalisadoEm, an.iaComercialV2?.geradoEm, l?.analysisReadyAt]
      .map(c => Date.parse(c || "")).filter(t => dentro(t)).sort((x,y) => x - y);
    let ultimoContado = -Infinity;
    for(const t of carimbos){
      if(t - ultimoContado < CP_MESMA_ANALISE_MS) continue;
      analisesCarteira++; ultimoContado = t;
    }
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
    mensagensTrocadas: temMsgServidor ? msgServidor : msgPrevia,
    empreendimentos,
    leadsAtendidos: leadsAtendidosIds.size,
    mensagensCopiadas,
    analisesFeitas: Math.max(typeof cpContarAtividade === "function" ? cpContarAtividade("analise", cutoffPeriodo, fimPeriodo) : 0, analisesCarteira),
    importacoes: Math.max(typeof cpContarAtividade === "function" ? cpContarAtividade("importacao", cutoffPeriodo, fimPeriodo) : 0, importacoesCarteira),
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
  // v1106 — "pra ver resultados do mês passado como faço?" (dono, dia 1º de agosto, vendo tudo
  // zerado). Agora dá: o seletor abaixo alterna entre o mês corrente e o mês fechado anterior.
  const vendoMesPassado = state.cpDesempenhoMes === "anterior";
  const iniAnt = (typeof cpInicioMesAnteriorMs === "function") ? cpInicioMesAnteriorMs() : 0;
  const iniAtual = (typeof cpInicioMesMs === "function") ? cpInicioMesMs() : 0;
  const periodo = vendoMesPassado ? { ini: iniAnt, fim: iniAtual } : null;
  const nomeMes = (ms) => { try{ return new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",month:"long"}).format(new Date(ms + 12*3600*1000)); }catch(_){ return "mês passado"; } };
  const rotuloMes = vendoMesPassado ? `em ${nomeMes(iniAnt)}` : "este mês";
  const m = cpDesempenhoMetricas(items, all, periodo);
  const linha = (icone, cor, titulo, sub, valor) => `
    <div class="cp-met-row">
      <div class="cp-met-ic" style="background:color-mix(in srgb, ${cor} 18%, transparent);color:${cor}">${icone}</div>
      <div class="cp-met-copy"><b>${escapeHtml(titulo)}</b><small>${escapeHtml(sub)}</small></div>
      <div class="cp-met-num">${escapeHtml(String(valor))}</div>
    </div>`;
  const linhaTempo = vendoMesPassado
    ? linha(CP_MET_ICONS.tempo, "var(--timing)", "Tempo no app", `Total ${rotuloMes} (só deste aparelho)`, cpFormatarDuracao((typeof cpTempoAppSegundosPeriodo === "function") ? cpTempoAppSegundosPeriodo(iniAnt, iniAtual) : 0))
    : linha(CP_MET_ICONS.tempo, "var(--timing)", "Tempo no app", `Hoje · média de ${cpFormatarDuracao(m.tempoMedia7dSeg)} nos últimos 7 dias`, cpFormatarDuracao(m.tempoHojeSeg));
  const rows = [
    linhaTempo,
    // v1281 — com a contagem certa (conversa inteira, não a prévia) este número passa dos mil:
    // separador de milhar, igual ao painel "Seu mês" da tela inicial.
    linha(CP_MET_ICONS.msg, "var(--dados)", "Mensagens trocadas", `Com clientes, ${rotuloMes}`, Number(m.mensagensTrocadas || 0).toLocaleString("pt-BR")),
    linha(CP_MET_ICONS.leads, "var(--acao)", "Leads atendidos", vendoMesPassado ? `Em ${nomeMes(iniAnt)}` : "Este mês", m.leadsAtendidos),
    linha(CP_MET_ICONS.copiar, "var(--morno)", "Mensagens copiadas", `Sugestões da IA que você usou, ${rotuloMes}`, m.mensagensCopiadas),
    linha(CP_MET_ICONS.analise, "var(--cerebro)", "Análises feitas", `Conversas processadas pela IA, ${rotuloMes}`, m.analisesFeitas),
    linha(CP_MET_ICONS.importar, "var(--dados)", "Conversas enviadas", `Conversas do WhatsApp processadas, ${rotuloMes}`, m.importacoes),
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
  const seletorMes = `
    <div class="cp-met-mes-chips">
      <button type="button" class="cp-met-mes-chip${vendoMesPassado ? "" : " ativo"}" onclick="cpDesempenhoTrocarMes('atual')">Este mês</button>
      <button type="button" class="cp-met-mes-chip${vendoMesPassado ? " ativo" : ""}" onclick="cpDesempenhoTrocarMes('anterior')">${escapeHtml(nomeMes(iniAnt))[0].toUpperCase()+escapeHtml(nomeMes(iniAnt)).slice(1)}</button>
    </div>`;
  box.innerHTML = seletorMes + rows + propostasRow + `
    <div class="cp-met-tags-row">
      <small>Empreendimentos negociados</small>
      <div class="cp-met-taglist">${tagsHtml}</div>
    </div>`;
}
window.cpRenderDesempenhoMetricas = cpRenderDesempenhoMetricas;
function cpDesempenhoTrocarMes(qual){
  state.cpDesempenhoMes = qual === "anterior" ? "anterior" : "atual";
  cpRenderDesempenhoMetricas(state.itemsAtivos || [], state.todosLeads || state.itemsAtivos || []);
}
window.cpDesempenhoTrocarMes = cpDesempenhoTrocarMes;

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
      // v1188 — compromisso vencido: horário em vermelho e chip "Vencido" (hot), em vez do azul
      // "Agenda" que fazia atraso parecer coisa em dia (auditoria comercial de 09/08/2026).
      return `<button type="button" class="cp-appointment" onclick='cpOpenLead(${JSON.stringify(id)})'>
        <span class="cp-time"${ap.atrasado?' style="color:var(--cp-coral);font-weight:950"':''}>${cpEscape(ap.time)}</span>
        <span class="cp-lead-avatar" style="${cpAvatarStyle(l.name)}">${cpInitials(l.name)}</span>
        <span class="cp-appointment-copy"><strong>${cpEscape(l.name||"Cliente")}</strong><small>${cpEscape(ap.text)}</small></span>
        <span class="cp-status ${ap.atrasado?'hot':meta.cls}">${ap.atrasado?'Vencido':meta.label}</span>
      </button>`;
    }).join(""):`<div class="cp-empty cp-empty-compact"><strong>Nenhum compromisso registrado</strong><span>Visitas, reuniões e lembretes aparecerão aqui.</span></div>`;
  }

  // v927 — o donut só somava agora+agenda+aguardando (ex.: 98) enquanto "Clientes ativos" mostra
  // a carteira inteira (ex.: 241) logo acima — números que não batem confundem mais do que
  // ajudam. Agora entra também "Prospecção" (sem-acao: conversa ainda rasa, <5 msgs do cliente),
  // e o total do gráfico passa a fechar com items.length (a carteira toda).
  const counts={agora:0,programados:0,aguardando:0,semAcao:0};
  for(const l of items){
    const c=categoriaDe(l);
    if(c==='sem-acao') counts.semAcao++;
    else if(counts[c]!==undefined) counts[c]++;
  }
  const total=Math.max(1, items.length);
  const hp=cpPct(counts.agora,total), pp=cpPct(counts.programados,total), ap=cpPct(counts.aguardando,total);
  const donut=qs("#cpTempDonut");
  if(donut) donut.style.background=`conic-gradient(var(--cp-coral) 0 ${hp}%,var(--cp-blue) ${hp}% ${Math.min(100,hp+pp)}%,var(--cp-slate) ${Math.min(100,hp+pp)}% ${Math.min(100,hp+pp+ap)}%,var(--cp-muted) ${Math.min(100,hp+pp+ap)}% 100%)`;
  cpSetText("cpTotalAtendimentos", items.length);
  const legend=qs("#cpTempLegend");
  // v1189 — a linha "Cliente respondeu" saiu junto com a categoria (ver cp786Categoria): o app
  // não tem como saber isso sem integração com o WhatsApp, e uma fatia fixa em 0% (ou pior, com
  // número errado) só confunde. O gráfico fecha com as quatro fatias que têm lastro.
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
    if(diff!=null&&diff<0&&diff>=-30)return {status:"retomar",responsavel:"corretor",urgencia:Math.abs(diff)>=3?"alta":"media",descricao:`O compromisso combinado venceu há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "dia" : "dias"}. Retome usando essa pendência como gancho.`,texto:prova};
  }
  const msgs=Array.isArray(lead?.recentMessages)?lead.recentMessages:[],pn=String(lead?.name||"").toLowerCase().split(/\s+/)[0]||"";
  const re=/\b(vou|iremos|vamos|fico de|dou|darei|te|lhe)\b.{0,55}\b(retorno|retornar|respondo|responder|aviso|avisar|chamo|chamar|analiso|analisar|avalio|avaliar|converso|conversar|vejo|verificar)\b/i;
  const cancel=/\b(desisti|n[aã]o vou|n[aã]o precisa|j[aá] resolvi|comprei|fechei com outro|comprou outro|sem interesse)\b/i;
  for(let i=msgs.length-1;i>=Math.max(0,msgs.length-24);i--){const m=msgs[i];if(!ehMsgDoCliente(m,pn))continue;const t=String(m?.text||"").trim();if(!re.test(t))continue;const canc=msgs.slice(i+1).some(x=>ehMsgDoCliente(x,pn)&&cancel.test(String(x?.text||"")));if(canc)continue;let idade=null;try{const d=m?.iso?new Date(m.iso):null;if(d&&!isNaN(d))idade=Math.floor((Date.now()-d.getTime())/86400000);}catch(_){}if(idade!=null&&idade>180)continue;if(idade!=null&&idade>30)return {status:"retomar",responsavel:"corretor",urgencia:"alta",descricao:`O retorno combinado está vencido há ${idade} ${idade === 1 ? "dia" : "dias"}. Retome pela pendência.`,texto:t};return {status:"aguardando-resposta",responsavel:"contato",urgencia:"baixa",descricao:"Aguardar o retorno que o contato se comprometeu a dar.",texto:t};}
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
    fail(txt){ set(100, txt||"Falha ao concluir."); box.style.borderColor = "var(--risco-line)"; box.style.background = "var(--risco-soft)"; }
  };
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
    // v1248 — DESLIGA O MICROFONE ao falhar. Se o microfone já tinha sido aberto e o que quebrou
    // foi o gravador logo depois, o aparelho continuava com o microfone LIGADO (a bolinha de
    // "gravando" acesa no celular) até fechar o app, mesmo com o aviso de erro na tela. O
    // desligamento só existia no fim de uma gravação que deu certo.
    try{ _cp7ObsStream?.getTracks()?.forEach(t => t.stop()); }catch(_){ }
    _cp7ObsStream = null;
    _cp7ObsRecorder = null;
    if(btn) btn.textContent = "🎙️ Gravar áudio";
    if(status) status.innerHTML = '<span style="color:var(--risco)">Não consegui acessar o microfone: '+escapeHtml(String(err?.message||err))+'</span>';
  }
}
// ── v1250 — LER O PRINT DA RESPOSTA DO CLIENTE ────────────────────────────────────────────────
// Mesmo caminho do ditado por voz: a IA devolve o TEXTO, o texto entra no campo de observação, e
// nada é gravado até o corretor conferir e tocar em "Salvar observação".
//
// A imagem é REDUZIDA no próprio aparelho antes de subir (lado maior em 1600px, JPEG). Print de
// celular moderno passa de 3 MB; subir isso cru numa rede de rua é o caminho certo pro pedido
// morrer no meio. Reduzido fica em algumas centenas de KB e o texto continua legível.
const CP1250_LADO_MAX = 1600;
async function cp1250ReduzirImagem(file){
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Não consegui abrir a imagem."));
    r.readAsDataURL(file);
  });
  try{
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Imagem inválida."));
      im.src = dataUrl;
    });
    const maior = Math.max(img.naturalWidth || 0, img.naturalHeight || 0);
    if(!maior) throw new Error("Imagem inválida.");
    const escala = maior > CP1250_LADO_MAX ? CP1250_LADO_MAX / maior : 1;
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round((img.naturalWidth || 1) * escala));
    cv.height = Math.max(1, Math.round((img.naturalHeight || 1) * escala));
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const reduzida = cv.toDataURL("image/jpeg", 0.85);
    return { base64: reduzida.split(",")[1] || "", mime: "image/jpeg" };
  }catch(_){
    // Se o navegador não conseguir redesenhar (formato exótico), manda a original mesmo — o
    // servidor tem o próprio teto de tamanho e recusa com aviso claro se for grande demais.
    return { base64: dataUrl.split(",")[1] || "", mime: (file?.type || "image/jpeg").split(";")[0] };
  }
}

async function cp1250EnviarPrint(file){
  const status = qs("#cp7ObsStatus");
  const ta = qs("#cp7ObsTexto");
  const btn = qs("#cp1250PrintBtn");
  if(!file){ return; }
  if(!/^image\//.test(file.type || "")){
    if(status) status.innerHTML = '<span style="color:var(--risco)">Isso não é uma imagem. Mande o print da conversa.</span>';
    return;
  }
  const rotuloBtn = btn ? btn.textContent : "";
  if(btn){ btn.disabled = true; btn.textContent = "Lendo o print…"; }
  if(status) status.innerHTML = '<span style="color:var(--morno)">Lendo o print…</span>';
  try{
    const { base64, mime } = await cp1250ReduzirImagem(file);
    if(!base64) throw new Error("Não consegui preparar a imagem.");
    const res = await fetchComTimeout("./api/cerebro-config", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"ler-print", imagemBase64: base64, mime })
    }, 60000);
    const data = await res.json().catch(()=>({ ok:false }));
    if(data?.ok && data.texto){
      if(ta){
        ta.value = (ta.value.trim() ? ta.value.trim()+"\n" : "") + data.texto;
        ta.focus();
      }
      if(status) status.innerHTML = '<span style="color:var(--acao)">Li o print. <b>Confira o texto acima</b> e toque em Salvar observação.</span>';
    } else {
      if(status) status.innerHTML = '<span style="color:var(--risco)">'+escapeHtml(data?.error || "Não consegui ler esse print.")+'</span>';
    }
  }catch(err){
    if(status) status.innerHTML = '<span style="color:var(--risco)">Não consegui ler o print: '+escapeHtml(String(err?.message||err))+'</span>';
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = rotuloBtn || "Ler print da resposta"; }
  }
}

function cp1250LerPrint(input){
  const file = input?.files?.[0];
  // Zera o campo: sem isso, escolher DE NOVO o mesmo print (depois de um erro) não dispara nada,
  // porque o navegador entende que o valor não mudou.
  if(input) input.value = "";
  cp1250EnviarPrint(file);
}
window.cp1250LerPrint = cp1250LerPrint;

// Colar a imagem direto no campo (Ctrl+V no computador — é como o corretor recorta a tela e cola).
// Um listener só, no documento, ligado uma vez: o campo de observação é redesenhado a cada
// abertura de cliente, então prender o listener nele criaria um novo a cada vez.
(function cp1250LigarColarPrint(){
  document.addEventListener("paste", (ev) => {
    const ta = qs("#cp7ObsTexto");
    if(!ta || document.activeElement !== ta) return;
    const itens = ev.clipboardData?.items ? [...ev.clipboardData.items] : [];
    const img = itens.find(i => String(i.type || "").startsWith("image/"));
    if(!img) return; // colou texto: deixa o navegador colar normalmente
    const file = img.getAsFile();
    if(!file) return;
    ev.preventDefault();
    cp1250EnviarPrint(file);
  });
})();

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
    // v1231 — pedido do dono: depois de salvar a observação, voltar pro TOPO da tela do cliente
    // (mesma regra do confirmar agendamento, v1229). A subida vem ANTES da remontagem, pra
    // restauração de rolagem de renderLeadFoco já capturar o topo — depois dela, a tela voltaria
    // pra onde estava (na altura do painel de observação).
    try{ window.scrollTo({ top: 0, behavior: "auto" }); }catch(_){ try{ window.scrollTo(0,0); }catch(_){} }
    renderLeadFoco(lead);
    toast("Observação salva. Ela entra na próxima análise (toque em Reanalisar quando quiser atualizar).");
    invalidarLeadsCache();
    setTimeout(()=>window.iniciarAprendizadoContinuoAutomatico?.({somentePendentes:true}),500);
    // v1228 — pedido do dono (revertendo a v1171): salvar observação NÃO dispara mais a
    // reanálise sozinho. A observação fica registrada na linha do tempo e entra na próxima
    // análise; a reanálise só roda quando o corretor tocar no botão "Reanalisar".
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
      // v1186 — aqui ia `action:"atualizar-analise-comercial"`, um nome que NENHUMA rota atende.
      // Funcionava por acaso: `api/reanalisar-lead` só reconhece algumas ações pontuais (remover
      // item, marcar/desmarcar atendido, mexer em lembrete) e manda todo o resto pro caminho
      // padrão, que é justamente a reanálise completa — o que este botão quer. Nome fantasma
      // engana quem lê o código depois; sem ele, a intenção fica explícita (auditoria de
      // 09/08/2026).
      body:JSON.stringify(payloadComCerebro({id:lead.id,versaoCliente:(window.CORRETOR_PRO_VERSION||709)})),signal:ctrl.signal,cache:"no-store"
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

// v1207 — este painel (o "Agendar" de dentro do lead, que é por onde o dono agenda no dia a dia)
// só tinha DATA. A hora existia apenas no "Reagendar" da tela Agenda (v1199).
// v1208 — passou a usar o painel único (cpAgendarPainelHTML): nada salva antes do "Confirmar
// agendamento", campos com cor visível no celular e atalhos de dia E de hora. Ver o comentário
// grande em cpAgendarPainelHTML pro histórico dos dois defeitos que levaram a isso.
function ui670ScheduleHtml(lead){
  if(!lead?.id)return "";
  const lem = lead?.analysis?.lembrete;
  const atual = { data: cpAgendarDataDoLembrete(lem?.quando), hora: lem?.hora || "" };
  return `<div id="ui670SchedulePanel" class="ui670-inline-panel" hidden><b>Agendar próximo contato</b>`
    + cpAgendarPainelHTML(String(lead.id), "ui670Schedule", atual)
    + `</div>`;
}
window.ui670ScheduleHtml = ui670ScheduleHtml;

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
        // Sai dos atendimentos ativos na hora (sem esperar refresh) e volta pra home. "Acabou."
        // v1125 — era removerLeadDosCaches, que sumia com o lead até da carteira inteira e por
        // isso o card "Arquivados" da Home não subia sem F5. Agora ele só troca de etapa.
        try{ cpMarcarEtapaLocal(id, etapa); }catch(_){ try{ removerLeadDosCaches(id); }catch(_){} }
        toast('Lead arquivado.');
        // v1125 — mesma volta pra Home usada pela exclusão: desliga o modo detalhe (senão o
        // cabeçalho da Home continua escondido por estilo direto) e redesenha as listas.
        try{
          if(typeof window.cpVoltarProHomeSemLead === 'function') window.cpVoltarProHomeSemLead();
          else { state.lead = null; state.focoLeadId = null; state.grupoAtivo = null; document.body.classList.remove('lead-foco-aberto'); show('home'); }
        }catch(_){}
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


/* v1268 — O BLOCO "V684-FINAL — IA COMERCIAL 2.0" FOI REMOVIDO (faxina pedida pelo dono).
   Eram ~100 linhas que montavam um cartão de "raciocínio comercial" dentro do cliente: estilo
   próprio injetado na página, o cartão em si e um "Por que:" grudado no card de ação. NADA disso
   rodava desde que o wrapper antigo de renderLeadFoco saiu (a #724-2) — as três funções não eram
   chamadas por ninguém, nem pelo HTML, nem por outro módulo. Código que não roda não é feature
   guardada: é peso morto que ainda aparece em toda busca e confunde a próxima leitura.
   A única linha viva do bloco era a versão do esquema comercial, que continua logo abaixo. */
window.CORRETOR_PRO_VERSAO_IA_COMERCIAL = COMMERCIAL_SCHEMA_MINOR;






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
      <div data-arquivado-id="${escapeHtml(String(l.id||''))}" style="border:1px solid var(--line);background:rgba(86,199,242,.04);border-radius:14px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <strong style="font-size:15px;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(86,199,242,.3)" onclick='abrirLead(${idJs})'>${escapeHtml(l.name||'Cliente')}</strong>
            <div class="small" style="margin-top:4px;color:var(--muted)">${escapeHtml(produtosLabel(l))}${dias?' · '+dias:''}</div>
          </div>
          <span class="tag" style="background:rgba(86,199,242,.12);color:#bff0ff;border-color:rgba(86,199,242,.32);font-size:10px">ARQUIVADO</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button type="button" onclick='abrirLead(${idJs})' style="padding:6px 12px;background:transparent;color:var(--soft);border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Ver lead</button>
          <button type="button" onclick='reativarLeadArquivado(${idJs},this)' style="padding:6px 12px;background:var(--acao-soft);color:var(--acao);border:1px solid var(--acao);border-radius:999px;font-size:11px;font-weight:950;cursor:pointer">Reativar</button>
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

  // v1205 — a Central de atenção (painel que abria ao tocar no sino, listando N atendimentos
  // pedem ação / N na agenda / N clientes ativos) foi REMOVIDA a pedido do dono: era uma camada a mais
  // repetindo números que a Home já mostra em cima e que a Agenda mostra por dentro, e ainda
  // tapava a tela inteira ao abrir o app. O sino continua existindo só como AVISO da agenda de
  // hoje (o número no cantinho, regras v787/v1093/v1168) e agora leva direto para a Agenda.
  function updateBell(){
    // v1232 — modelo C do topo: o sino vive dentro do bloco da agenda com o NÚMERO de hoje ao
    // lado (não mais o pontinho/badge de v787/v1093/v1168 — o #bellBadge segue no HTML, sempre
    // escondido, só como âncora histórica). A metade de hoje acende em ciano quando há agenda no
    // dia e em vermelho quando há atraso — cores da paleta oficial (--acao / --risco).
    const bell = $('#topBell');
    const num = $('#cpAgHojeN');
    if(!bell || !num) return;
    const n = Number(state.agendaCount) || 0;      // hoje (inclui atrasados)
    const atr = Number(state.agendaAtrasados) || 0;
    num.textContent = String(n);
    // Classes próprias (cp-hoje-*) em vez de tem-alerta/tem-atraso: os blocos antigos de CSS do
    // #topBell continuam no styles.css (inertes) e usariam essas classes com !important por cima
    // do desenho novo.
    bell.classList.toggle('cp-hoje-alerta', n > 0 && atr === 0);
    bell.classList.toggle('cp-hoje-atraso', atr > 0);
    const label = atr > 0
      ? `Agenda — ${atr} compromisso${atr===1?'':'s'} ATRASADO${atr===1?'':'S'}`
      : n > 0
      ? `Agenda — ${n} compromisso${n===1?'':'s'} hoje`
      : 'Abrir a Agenda';
    bell.setAttribute('title', label);
    bell.setAttribute('aria-label', label);
  }
  window.cpAtualizarSinoAtencao = updateBell;

  function polishEmptyStates(root=document){
    const patterns = ['Nenhum lead perdido no momento.','Nada agendado.','Nenhum compromisso registrado','Nenhum lead marcado como atendido hoje ainda.','Nenhuma condição de pagamento definida.'];
    const casa = (texto) => { const t=(texto||'').trim(); return !!t && t.length<=170 && patterns.some(p=>t.includes(p)); };
    $$('div,td,p,span', root).forEach(el=>{
      // Hotfix 687-1: evita reprocessar o próprio estado vazio e seus filhos.
      // Sem essa proteção, o MutationObserver podia embrulhar o mesmo texto
      // repetidas vezes e gerar vários cards aninhados na tela.
      if(el.dataset.cp687Empty || el.closest('.cp-empty-premium')) return;
      const txt = (el.textContent||'').trim();
      if(!casa(txt)) return;
      // v1248 — SÓ O BLOCO MAIS INTERNO. A varredura anda de fora pra dentro, e um bloco de fora
      // (o cartão inteiro, com título e botão) também "contém" o texto do aviso: reescrever ele
      // apagaria o título e o botão junto. Se algum bloco de dentro também casa, é dele a vez.
      if([...el.querySelectorAll('div,td,p,span')].some(f => casa(f.textContent))) return;
      // v1248 — o TÍTULO vinha de texto.split('.')[0], calculado em cima do textContent — que
      // COLA as duas linhas do aviso sem espaço nenhum. Onde o aviso tinha título e explicação
      // (o caso de "Nenhum compromisso registrado"), o corretor lia na tela o embolado
      // "Nenhum compromisso registradoVisitas, reuniões e lembretes aparecerão aqui." como se
      // fosse o título. Agora o título sai do próprio <strong>/<b> do aviso, e a explicação de
      // verdade que já estava escrita ali é preservada em vez de ser trocada por uma frase
      // genérica de sistema.
      const tituloEl = el.querySelector('strong,b');
      const subEl = el.querySelector('span,small,p');
      const titulo = (tituloEl?.textContent || '').trim() || (txt.split('.')[0] + '.');
      const subOriginal = (subEl && subEl !== tituloEl ? (subEl.textContent||'').trim() : '');
      const sub = subOriginal
        || (txt.includes('Nada agendado') ? 'Quando houver retorno marcado, ele aparece aqui.'
        : txt.includes('perdido') ? 'Quando um lead for marcado como perdido, ele aparece aqui para reabertura.'
        : 'O sistema vai atualizar este bloco automaticamente quando houver dados.');
      el.dataset.cp687Empty='1';
      el.classList.add('cp-empty-premium');
      el.innerHTML = `<span class="cp-empty-icon">✓</span><span><b>${escapeHtml(titulo)}</b><small>${escapeHtml(sub)}</small></span>`;
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
  // v1205 — o sino não abre mais painel nenhum: um toque leva direto pra Agenda, que é onde o
  // compromisso de verdade está. (O onclick do index.html já faz isso; aqui só garantimos que
  // nenhum handler antigo de painel sobreviva.)
  const bell = $('#topBell');
  if(bell){
    bell.setAttribute('aria-label','Abrir a Agenda');
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
      // v1140 — o vigia de 9s dizia "demorou demais" e virava beco sem saída com a busca AINDA
      // viva (o servidor tem até 60s e o app agora espera 65s — ver getLeadsData). Print do dono
      // em 05/08/2026: a tela desistia e ele ficava sem carteira. Agora são dois estágios:
      // aos 9s só avisa que está demorando (e SEGUE carregando, com o spinner na tela); o beco
      // com botões só aparece aos 75s, quando o prazo real de servidor + retentativa já passou —
      // e ganhou o botão de atualizar a página, que é o que resolve na prática.
      // v1146 — ESPERA COM RELÓGIO NA TELA E SAÍDA DESDE O COMEÇO.
      //
      // Print do dono (05/08/2026, 19:04 e 19:06): dois minutos olhando "Carregando os leads…" sem
      // nada mudando — "travou". O app não estava travado, estava esperando (a v1140 deu 65s pra
      // busca e repetia mais uma vez). Só que spinner mudo por minutos É travado, do ponto de vista
      // de quem usa. Três correções aqui:
      //
      //  1. O aviso não depende mais de `state.active === 'home'`: se a mensagem de carregamento
      //     está na tela, ela é atualizada. Antes, se a tela ativa fosse outra no momento do vigia,
      //     o texto ficava congelado pra sempre (era o caso do print).
      //  2. Aparece o TEMPO decorrido, de 1 em 1 segundo, a partir dos 6s — dá pra ver que está
      //     vivo, e o dono consegue me dizer em quanto tempo parou.
      //  3. Aos 12s já aparecem os botões de saída (tentar de novo / abrir Atendimentos) SEM
      //     cancelar a busca em andamento: se ela chegar, a Home desenha normal por cima.
      const areaCarregando = () => {
        const area = document.querySelector('#leadFocoArea');
        return (area && /Carregando os leads|Ainda buscando sua carteira|Sua carteira está demorando/i.test(area.textContent || '')) ? area : null;
      };
      const inicioEspera = Date.now();
      const relogio = setInterval(()=>{
        const area = areaCarregando();
        if(!area) return;
        const seg = Math.round((Date.now() - inicioEspera)/1000);
        if(seg < 6) return;
        const marcador = area.querySelector('.cp694-espera');
        const texto = `Buscando sua carteira… ${seg}s`;
        if(marcador){ marcador.textContent = texto; return; }
        const saida = seg >= 12
          ? '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px"><button type="button" onclick="location.reload()">Tentar de novo</button><button type="button" onclick="show(\'carteira\')">Abrir Atendimentos</button></div>'
          : '';
        area.innerHTML = `<div class="cp694-loading cp-loading-leads"><div class="cp-loading-spinner"></div><b>Sua carteira está demorando pra chegar.</b><span class="cp694-espera">${texto}</span><span>Pode esperar — ou usar os atalhos abaixo. Nada se perde.</span>${saida}</div>`;
      }, 1000);
      const watchdogFinal = setTimeout(()=>{
        const area = areaCarregando();
        if(area){
          area.innerHTML = '<div class="cp694-loading"><b>Não consegui carregar sua carteira agora.</b><span>Sua base está salva — isto é só a leitura desta tela. Tente de novo ou abra Atendimentos.</span><button type="button" onclick="location.reload()">Tentar de novo</button><button type="button" onclick="show(\'carteira\')">Abrir Atendimentos</button></div>';
        }
      }, 70000);
      try{ return await oldDash.apply(this, arguments); }
      finally{ clearInterval(relogio); clearTimeout(watchdogFinal); }
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
        if(!/Atualiza[cç][aã]o\s*#/i.test(txt)) return;
        const novo = txt.replace(/Atualiza[cç][aã]o\s*#\d+(?:-\d+)?/i, 'Atualização #__VERSION__');
        // v1232 — só mexe quando o número está realmente errado: gravar textContent sempre
        // apagava o <span class="cp-versao-palavra"> de dentro do rótulo (que deixa a palavra
        // "Atualização" sair em tela estreita), mesmo com o número já certo.
        if(novo !== txt) el.textContent = novo;
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
  // os atendimentos do dia, completando a imagem ao bater a META do corretor. Coral = identidade.
  //
  // v1147 — a meta estava CRAVADA em 10 aqui. O dono mudou a dele pra 20 no Cérebro e esta tela
  // continuou dizendo "meta 10/dia", com o prédio cheio em 20/10 — ele flagrou com print ("o
  // prédio deve ficar cheio somente quando atender 20, que é pré-definido, não acha?"). Agora usa
  // a MESMA meta do card "Fazer agora" (cpMetaAtendimentosDia → Cérebro), que é a única fonte
  // dessa regra no app. O 10 continua só como último recurso, se a função não existir.
  // Função (não constante): a meta é lida NO MOMENTO de desenhar. Como constante, ela congelava o
  // valor de quando o app abriu — mudar a meta no Cérebro só valeria depois de recarregar.
  const cp788MetaDia = () => (typeof cpMetaAtendimentosDia === 'function') ? cpMetaAtendimentosDia() : 10;
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
    // v908 — tela reorganizada POR DIA: cada dia tem o prediozinho da meta e, junto, os clientes
    // atendidos naquele dia (só o nome — sem "atendido há X" nem produto, porque o dia já é a linha).
    //
    // v1276 — O MÊS INTEIRO, NÃO A SEMANA. Pedido do dono: "quero ver o histórico do mês todo e não
    // da semana nessa parte... todos q atendi a cada dia desde dia 1". A tela mostrava só os últimos
    // 7 dias — o resto do mês existia no banco e não tinha onde ser visto.
    // Fim de semana segue a MESMA régua do gráfico do mês (v1273): sábado/domingo SEM atendimento
    // não aparece (senão o mês vira um serrote e parece queda de produção); fim de semana em que ele
    // TRABALHOU continua na lista, porque apagá-lo seria justamente esconder trabalho feito.
    const CP788_DIAS_SEM=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const hoje0=(typeof inicioDoDiaBR==='function')?inicioDoDiaBR():new Date(new Date().setHours(0,0,0,0));
    const diasDoMesAteHoje=Math.max(1, hoje0.getDate());
    const perDay=[];
    for(let i=0;i<diasDoMesAteHoje;i++){
      const d=new Date(hoje0); d.setDate(d.getDate()-i);
      const dd=String(d.getDate()).padStart(2,'0'), mm=String(d.getMonth()+1).padStart(2,'0');
      const label=i===0?'Hoje':i===1?'Ontem':CP788_DIAS_SEM[d.getDay()];
      perDay.push({ label, data:`${dd}/${mm}`, fds:(d.getDay()===0||d.getDay()===6), itens:[] });
    }
    for(const x of registros){
      let d=null; try{ d = (typeof diasCalendarioBR==='function') ? diasCalendarioBR(new Date(x.ts)) : null; }catch(_){ d=null; }
      if(d!=null && d>=0 && d<diasDoMesAteHoje) perDay[d].itens.push(x);
    }
    const totalMes=perDay.reduce((s,p)=>s+p.itens.length,0);
    const diasVisiveis=perDay.filter(p=>p.itens.length>0||!p.fds);
    let nomeDoMes='';
    try{ nomeDoMes=hoje0.toLocaleDateString('pt-BR',{ month:'long', timeZone:'America/Sao_Paulo' }); }catch(_){ nomeDoMes=''; }
    const tituloPeriodo=nomeDoMes?`${nomeDoMes.charAt(0).toUpperCase()}${nomeDoMes.slice(1)}, do dia 1 até hoje`:'Do dia 1 do mês até hoje';
    const CP788_META_DIA = cp788MetaDia();
    box.innerHTML=`<section class="cp788-att-page">
      <header class="cp788-att-head">
        <div><h2>Atendimentos</h2><p>${esc(tituloPeriodo)} · ${totalMes} atendimento${totalMes===1?'':'s'} · meta ${CP788_META_DIA}/dia</p></div>
      </header>
      ${totalMes?`<div class="cp788-days">
        ${diasVisiveis.map((p)=>{
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

  function cp788Grupos(leads){
    const grupos={agora:[],programados:[],aguardando:[],todos:[]};
    for(const l of (Array.isArray(leads)?leads:[])){
      if(typeof leadEhAtivo==='function'&&!leadEhAtivo(l)) continue;
      grupos.todos.push(l);
      const c=typeof cp786Categoria==='function'?cp786Categoria(l):'aguardando';
      if(grupos[c]) grupos[c].push(l);
    }
    for(const k of ['agora','programados','aguardando']) grupos[k]=typeof cp786OrdenarConducao==='function'?cp786OrdenarConducao(grupos[k]):grupos[k];
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
      agora:grupos.agora,programados:grupos.programados,aguardando:grupos.aguardando,todos:ativos,
      hoje:grupos.agora,retomada:grupos.agora,'acao-hoje':grupos.agora,
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
