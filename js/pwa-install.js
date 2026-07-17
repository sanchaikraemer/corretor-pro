import { qs, toast } from './dom.js?v=__VERSION__';
import { state } from './state.js?v=__VERSION__';

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
  // iPhone/iPad não instala por 1 clique — já mostra o passo a passo no banner e ajusta o
  // rótulo do botão pra não parecer que "baixa" sozinho.
  if(ehIOS()){
    const bb = qs("#bannerInstalarBtn"); if(bb) bb.textContent = "Como instalar";
    const dica = qs("#bannerInstalarDica"); if(dica){ dica.innerHTML = textoDicaInstalar(); dica.style.display = "block"; }
  }
}
function esconderOpcoesInstalar(){
  const btn = qs("#btnInstalarApp"); if(btn) btn.style.display = "none";
  const banner = qs("#bannerInstalar"); if(banner) banner.style.display = "none";
}
// iOS (iPhone/iPad) não tem instalação por 1 clique — só o caminho manual pelo Safari.
function ehIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function ehSafariIOS(){
  return ehIOS() && !/crios|fxios|edgios|opios|opt\//i.test(navigator.userAgent);
}
function textoDicaInstalar(){
  if(ehIOS()){
    if(ehSafariIOS()){
      return 'No iPhone/iPad: toque em <b>Compartilhar</b> (o ícone de quadrado com a seta ↑, na barra do Safari) e depois em <b>“Adicionar à Tela de Início”</b>.';
    }
    return 'No iPhone/iPad a instalação só funciona pelo <b>Safari</b>. Abra este site no Safari, toque em <b>Compartilhar</b> e em <b>“Adicionar à Tela de Início”</b>.';
  }
  return 'No celular: toque no menu do navegador (⋮) e em <b>“Adicionar à tela inicial”</b> / <b>“Instalar app”</b>.';
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
  // Sem instalação automática (iPhone, ou já registrado) — mostra o passo a passo certo pro aparelho.
  const dicaHtml = textoDicaInstalar();
  const d1 = qs("#instalarDica"); if(d1){ d1.innerHTML = dicaHtml; d1.style.display = "block"; }
  const d2 = qs("#bannerInstalarDica"); if(d2){ d2.innerHTML = dicaHtml; d2.style.display = "block"; }
  if(ehIOS() && typeof toast === "function") toast("No iPhone é pelo Safari: Compartilhar → Adicionar à Tela de Início.");
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
function fecharBannerInstalar(){
  localStorage.setItem(BANNER_INSTALAR_KEY, "1");
  const banner = qs("#bannerInstalar"); if(banner) banner.style.display = "none";
}
// "✕" e "Continuar na web" dispensam o convite (útil no iPhone, onde não há instalação por
// 1 clique — o usuário segue usando pelo navegador sem ficar preso no banner).
qs("#bannerInstalarFechar")?.addEventListener("click", fecharBannerInstalar);
qs("#bannerInstalarWeb")?.addEventListener("click", fecharBannerInstalar);

// Onboarding: dispensar (lembra via localStorage) e abrir de novo pelo Menu.
// Fica neste módulo porque estava fisicamente dentro do mesmo bloco no app.js original
// (não é PWA install, mas o comentário de seção original cobria os dois).
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
  window.show("home");
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
