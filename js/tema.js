import { qs, qsa, toast } from './dom.js?v=__VERSION__';

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
export function aplicarTemaDireciona(tema, salvar=true){
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
export function configurarEscolhaTema(){
  aplicarTemaDireciona(temaDirecionaAtual(), false);
  qsa("[data-theme-choice]").forEach(btn => {
    btn.addEventListener("click", () => {
      aplicarTemaDireciona(btn.dataset.themeChoice, true);
      toast(btn.dataset.themeChoice === "light" ? "Tema claro aplicado." : "Tema escuro aplicado.");
    });
  });
}
window.aplicarTemaDireciona = aplicarTemaDireciona;
