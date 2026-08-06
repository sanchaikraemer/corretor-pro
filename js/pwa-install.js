import { qs, toast, escapeHtml } from './dom.js?v=__VERSION__';
import { state } from './state.js?v=__VERSION__';

// ===== Instalar app (PWA) =====
// O convite (beforeinstallprompt) pode ter sido capturado cedo pelo script inline do
// index.html (window.__deferredInstallPrompt), já que este arquivo carrega no fim.
let deferredInstallPrompt = window.__deferredInstallPrompt || null;
const ehStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const BANNER_INSTALAR_KEY = "direciona_banner_instalar_fechado";
// v1157 — FECHAR FECHA PRA SEMPRE; DESINSTALAR TRAZ DE VOLTA.
//
// Pedido do dono, palavra dele: "quero que fechar feche pra sempre, a não ser que o app seja
// desinstalado e quando entrar no link apareça novamente". Faz sentido: enquanto o app está no
// celular, insistir é incômodo; quando ele sai do celular, a oferta é justamente o que falta.
//
// (A v1156 tinha resolvido o mesmo problema com prazo de 7 dias. O prazo saiu: quem manda agora é
// o estado real do aparelho, não o calendário.)
//
// Pra isso o app precisa saber a diferença entre INSTALADO e NÃO INSTALADO. Três sinais, todos do
// próprio navegador:
//   • está rodando como app (tela cheia, sem barra de endereço)  → instalado;
//   • navigator.getInstalledRelatedApps() responde que sim       → instalado (Android);
//   • o navegador oferece instalar (beforeinstallprompt)         → NÃO instalado (ele só oferece
//     quando o app não está no aparelho).
// O app anota "estava instalado" quando vê o primeiro caso; quando depois vê o último, a conclusão
// é uma só: foi desinstalado. Aí o "fechado" é apagado e a oferta volta na próxima abertura.
const APP_ESTAVA_INSTALADO_KEY = "direciona_app_estava_instalado";
function lerGuardado(chave){ try{ return localStorage.getItem(chave) || ""; }catch(_){ return ""; } }
function guardar(chave, valor){ try{ localStorage.setItem(chave, valor); }catch(_){} }
function apagarGuardado(chave){ try{ localStorage.removeItem(chave); }catch(_){} }

function bannerInstalarDispensado(){ return !!lerGuardado(BANNER_INSTALAR_KEY); }
function anotarQueEstaInstalado(){ guardar(APP_ESTAVA_INSTALADO_KEY, "1"); }
// Chamado só quando há CERTEZA de que o app não está no aparelho. Se ele já estivera instalado,
// isto é uma desinstalação: a oferta volta a valer, mesmo que o corretor tenha fechado antes.
function anotarQueNaoEstaInstalado(){
  if(lerGuardado(APP_ESTAVA_INSTALADO_KEY) !== "1") return false;
  apagarGuardado(APP_ESTAVA_INSTALADO_KEY);
  apagarGuardado(BANNER_INSTALAR_KEY);
  return true;
}

function mostrarOpcoesInstalar(){
  if(ehStandalone) return; // já está rodando como app
  // Botão no Menu — este NUNCA some enquanto o app não estiver instalado.
  const btn = qs("#btnInstalarApp"); if(btn) btn.style.display = "flex";
  // Banner no topo da Hoje — respeita o "fechar" até o app ser desinstalado.
  if(!bannerInstalarDispensado()){
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
// v1155 — "antes baixava o app no botão instalar, agora não mais". No Android, tirar o ícone da
// tela inicial NÃO desinstala o app: o Chrome continua enxergando o Corretor Pro como instalado e,
// por regra dele, deixa de oferecer a instalação (nenhum site consegue forçar). Esta checagem é o
// único jeito de o app saber disso — aí a tela para de prometer download e diz onde o app está e
// como desinstalar de verdade, em vez de deixar o corretor achando que quebrou.
let appJaInstaladoNoAparelho = false;
async function conferirSeJaEstaInstalado(){
  try{
    if(ehStandalone || typeof navigator.getInstalledRelatedApps !== "function") return;
    const lista = await navigator.getInstalledRelatedApps();
    if(!Array.isArray(lista) || !lista.length){
      // Certeza de que NÃO está instalado. Se estava antes, foi desinstalado: a oferta volta,
      // mesmo que o corretor tenha fechado o aviso alguma vez (v1157).
      if(anotarQueNaoEstaInstalado()) mostrarOpcoesInstalar();
      return;
    }
    appJaInstaladoNoAparelho = true;
    anotarQueEstaInstalado();
    // Está instalado: não é hora de oferecer instalação nenhuma. O aviso sai da Hoje e o cartão do
    // Menu passa a servir pra outra coisa — achar o ícone que sumiu da tela inicial.
    const banner = qs("#bannerInstalar"); if(banner) banner.style.display = "none";
    const bb = qs("#bannerInstalarBtn"); if(bb) bb.textContent = "Onde está meu app";
    const titulo = qs("#bannerInstalar b"); if(titulo) titulo.textContent = "O Corretor Pro já está instalado";
    const sub = qs("#bannerInstalar .cp-install-txt span");
    if(sub) sub.textContent = "O ícone pode ter saído da tela inicial — ele continua na gaveta de apps.";
    const cardTitulo = qs("#btnInstalarApp .menu-card-titulo"); if(cardTitulo) cardTitulo.textContent = "Onde está meu app";
    const cardDesc = qs("#btnInstalarApp .menu-card-desc");
    if(cardDesc) cardDesc.textContent = "O Corretor Pro já está instalado neste aparelho.";
  }catch(_){}
}
async function dispararInstalacao(){
  const convite = deferredInstallPrompt || window.__deferredInstallPrompt;
  if(convite){
    convite.prompt();
    let escolha = null;
    try{ escolha = await convite.userChoice; }catch(_){}
    deferredInstallPrompt = null;
    window.__deferredInstallPrompt = null;
    // O convite só vale UM toque. Se o corretor fechou a caixa do navegador, o botão não baixa
    // mais nada nesta visita — o rótulo passa a dizer a verdade, e o próximo toque abre o passo a
    // passo pelo menu do navegador, que sempre funciona.
    if(escolha?.outcome !== "accepted"){
      const bb = qs("#bannerInstalarBtn"); if(bb && !ehIOS()) bb.textContent = "Como instalar";
    }
    return;
  }
  // Sem instalação automática (iPhone, ou o Chrome não convidou) — abre o passo a passo COM DESENHO
  // (v1155). O caminho pelo menu do navegador sempre funciona; o botão de um toque só existe
  // quando o navegador convida, e isso não é o site que decide.
  if(typeof window.cpMostrarComoInstalar === "function"){ window.cpMostrarComoInstalar(); return; }
  const dicaHtml = textoDicaInstalar();
  const d1 = qs("#instalarDica"); if(d1){ d1.innerHTML = dicaHtml; d1.style.display = "block"; }
  const d2 = qs("#bannerInstalarDica"); if(d2){ d2.innerHTML = dicaHtml; d2.style.display = "block"; }
  if(ehIOS() && typeof toast === "function") toast("No iPhone é pelo Safari: Compartilhar → Adicionar à Tela de Início.");
}

// v1157 — o navegador só oferece instalar quando o app NÃO está no aparelho. Então convite que
// chega é prova de "não instalado": se o app estava instalado antes, ele foi desinstalado, e a
// oferta volta a aparecer mesmo que o corretor tenha fechado o aviso um dia.
function conviteDeInstalacaoChegou(){
  appJaInstaladoNoAparelho = false;
  anotarQueNaoEstaInstalado();
  mostrarOpcoesInstalar();
  // v1155 — o convite costuma chegar DEPOIS da tela montar. Se o rótulo já tinha virado
  // "Como instalar" (v1154, quando não havia convite), ele volta a prometer o que agora é
  // verdade: um toque instala.
  const bb = qs("#bannerInstalarBtn"); if(bb && !ehIOS()) bb.textContent = "Baixar app";
  const dica = qs("#instalarDica"); if(dica) dica.style.display = "none";
  const dicaBanner = qs("#bannerInstalarDica"); if(dicaBanner && !ehIOS()) dicaBanner.style.display = "none";
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  window.__deferredInstallPrompt = e;
  conviteDeInstalacaoChegou();
});
// Convite capturado cedo pelo index.html: usa assim que o app.js sobe.
window.addEventListener("direciona-install-ready", () => {
  deferredInstallPrompt = window.__deferredInstallPrompt;
  conviteDeInstalacaoChegou();
});
if(deferredInstallPrompt) conviteDeInstalacaoChegou();

// v1154 — O CONVITE DO NAVEGADOR NÃO É GARANTIDO, E A OFERTA DE INSTALAR PRECISA SER.
//
// Caso real do dono: apagou o app, abriu o link de novo e "não ofereceu pra baixar o app". O
// Chrome só dispara o convite (beforeinstallprompt) quando QUER — depois de apagar, ele pode
// levar dias pra oferecer de novo, e em alguns aparelhos/navegadores nunca oferece. Até aqui, sem
// esse convite, o banner e o botão simplesmente não existiam: o corretor novo não tinha por onde
// instalar, e sem instalar o app não aparece na lista de compartilhar do WhatsApp — que é o
// caminho principal do produto.
//
// Agora a oferta aparece SEMPRE (menos pra quem já está com o app instalado). Se o convite
// existir, o toque instala de uma vez; se não existir, o mesmo toque mostra o caminho manual
// daquele aparelho (é o que dispararInstalacao() já faz).
if(!ehStandalone){
  const mostrarDeQualquerJeito = () => {
    mostrarOpcoesInstalar();
    // Sem convite do navegador, o rótulo não pode prometer download automático.
    if(!(deferredInstallPrompt || window.__deferredInstallPrompt)){
      const bb = qs("#bannerInstalarBtn"); if(bb && !ehIOS()) bb.textContent = "Como instalar";
    }
  };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", mostrarDeQualquerJeito, { once:true });
  else mostrarDeQualquerJeito();
  conferirSeJaEstaInstalado();
}
// v1153 — o passo a passo "Como enviar sua conversa" precisa oferecer a instalação NA HORA. O dono
// testou com conta nova e disse: "mas não apareceu onde baixar pra mim". O banner "Baixar app" só
// existe quando o navegador dispara o convite de instalação — se ele não disparar (ou se o app já
// estiver instalado), o conselho "toque em Baixar app" vira um beco sem saída. Estas três coisas
// ficam disponíveis pro tutorial: instalar, o texto certo do aparelho, e saber se já está instalado.
window.cpInstalarApp = dispararInstalacao;
window.cpDicaInstalarTexto = textoDicaInstalar;
window.cpTemConviteInstalar = () => !!(deferredInstallPrompt || window.__deferredInstallPrompt);
window.cpAppJaInstalado = () => ehStandalone;
// v1155 — "instalado no aparelho" é diferente de "estou rodando dentro do app": o corretor pode
// estar no navegador com o app instalado (ícone escondido). O passo a passo usa isso pra abrir
// direto na explicação certa em vez de ensinar a instalar o que já existe.
window.cpAppJaInstaladoNoAparelho = () => appJaInstaladoNoAparelho;

qs("#btnInstalarApp")?.addEventListener("click", dispararInstalacao);
qs("#bannerInstalarBtn")?.addEventListener("click", dispararInstalacao);
function fecharBannerInstalar(){
  // Fechou, fechou: fica fechado (a data serve só pra saber quando foi). Só volta se o app for
  // desinstalado do aparelho — quem apaga essa marca é anotarQueNaoEstaInstalado() (v1157).
  guardar(BANNER_INSTALAR_KEY, String(Date.now()));
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
  anotarQueEstaInstalado(); // v1157 — é daqui que o app passa a saber que ESTÁ instalado
  esconderOpcoesInstalar();
  toast("App instalado! Procure o ícone do Corretor Pro na tela inicial.");
});
// Abrir pelo ícone (tela cheia) é a prova mais direta de que está instalado.
if(ehStandalone) anotarQueEstaInstalado();
// Sempre que NÃO estiver rodando como app instalado, oferece a instalação.
// (Mesmo sem o evento do navegador — no iPhone ou quando já houve registro — o
// caminho manual aparece, então o usuário nunca fica sem opção.)
if(!ehStandalone) mostrarOpcoesInstalar();

// ===== Atalho do iPhone: mandar o ZIP do WhatsApp direto pro Corretor Pro (v1035) =====
// A Apple não deixa um site "instalado" aparecer no botão Compartilhar de outro app (isso só
// existe pra apps de verdade da App Store) — então quem tem iPhone não consegue o mesmo
// "compartilhar direto pro ícone" que o Android já tem. Um Atalho (Shortcuts, de fábrica no
// iPhone) chega bem perto disso sem custo de loja de aplicativo: o corretor cola uma chave
// pessoal dentro dele, e o Atalho manda o ZIP direto pra api/receber-zip-atalho.
let atalhoChaveAtual = "";
function atalhoEndpointUrl(){ return `${window.location.origin}/api/receber-zip-atalho`; }
function atalhoMontarInstrucoes(){
  const url = atalhoEndpointUrl();
  return `<ol style="padding-left:18px;margin:0">
    <li>Abra o app <b>Atalhos</b> (já vem no iPhone) e toque em <b>+</b> pra criar um atalho novo.</li>
    <li>Toque em <b>Adicionar Ação</b>, procure <b>"Obter Conteúdo de URL"</b> e adicione.</li>
    <li>Toque na ação e configure: <b>URL</b> = <code style="word-break:break-all">${escapeHtml(url)}</code>, <b>Método</b> = POST.</li>
    <li>Em <b>Cabeçalhos</b>, adicione um com nome <code>X-Corretor-Pro-Atalho-Token</code> e valor a chave acima (copiada).</li>
    <li>No <b>Corpo da Requisição</b>, escolha <b>Arquivo</b> e selecione o <b>Conteúdo Compartilhado</b> (a entrada do Atalho).</li>
    <li>Toque no nome do atalho (ou no ícone <b>ⓘ</b>), dê o nome <b>"Corretor Pro"</b>, ative <b>"Mostrar no Menu Compartilhar"</b> e marque <b>"Arquivos"</b> nos tipos aceitos.</li>
    <li>Pronto: no WhatsApp, abra a conversa → <b>⋮</b> → <b>Mais</b> → <b>Exportar conversa</b> → Compartilhar → escolha <b>"Corretor Pro"</b>.</li>
  </ol>`;
}
function atalhoAtualizarTela(token){
  atalhoChaveAtual = token || "";
  const status = qs("#atalhoChaveStatus");
  const btnCopiar = qs("#btnAtalhoCopiarChave");
  const instrucoes = qs("#atalhoInstrucoes");
  if(token){
    if(status) status.innerHTML = 'Sua chave: <code style="word-break:break-all">'+escapeHtml(token)+'</code>';
    if(btnCopiar) btnCopiar.hidden = false;
    if(instrucoes){ instrucoes.innerHTML = atalhoMontarInstrucoes(); instrucoes.hidden = false; }
  }else{
    if(status) status.textContent = "Você ainda não gerou uma chave.";
    if(btnCopiar) btnCopiar.hidden = true;
    if(instrucoes) instrucoes.hidden = true;
  }
}
async function atalhoCarregarChaveExistente(){
  try{
    const res = await fetch("./api/atalho-zip-token");
    const data = await res.json().catch(()=>({ok:false}));
    if(data?.ok) atalhoAtualizarTela(data.token);
  }catch(_){}
}
qs("#btnAtalhoGerarChave")?.addEventListener("click", async () => {
  const btn = qs("#btnAtalhoGerarChave");
  if(btn){ btn.disabled = true; btn.textContent = "Gerando..."; }
  try{
    const res = await fetch("./api/atalho-zip-token", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({action:"gerar"}) });
    const data = await res.json().catch(()=>({ok:false}));
    if(!res.ok || !data?.ok) throw new Error(data?.error || "Não foi possível gerar a chave.");
    atalhoAtualizarTela(data.token);
    toast(atalhoChaveAtual && btn?.dataset.jaTinhaChave === "1"
      ? "Nova chave gerada. Se você já tinha um Atalho configurado, cole a chave nova nele — a antiga parou de funcionar."
      : "Chave gerada. Copie e siga o passo a passo abaixo pra criar o Atalho.");
    if(btn) btn.dataset.jaTinhaChave = "1";
  }catch(err){
    toast(String(err?.message||"Não foi possível gerar a chave. Tente de novo em instantes."));
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = "Gerar minha chave"; }
  }
});
qs("#btnAtalhoCopiarChave")?.addEventListener("click", async () => {
  if(!atalhoChaveAtual) return;
  try{ await navigator.clipboard.writeText(atalhoChaveAtual); toast("Chave copiada."); }
  catch(_){ toast("Não consegui copiar automaticamente. Selecione o texto da chave e copie manualmente."); }
});
if(ehIOS()){
  const card = qs("#cardAtalhoIphone");
  if(card){ card.hidden = false; atalhoCarregarChaveExistente(); }
}
