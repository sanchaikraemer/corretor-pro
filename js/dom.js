export function qs(s){return document.querySelector(s)}
export function qsa(s){return Array.from(document.querySelectorAll(s))}
export function isDesktop(){return matchMedia("(min-width:900px)").matches}
// t=="" só cobre undefined (parâmetro default) — um campo nulo vindo do banco (comum: coluna
// sem valor no Postgres vira JSON null, não some) caía em String(null)="null" e mostrava o
// texto literal "null" na tela. ?? cobre null e undefined.
export function escapeHtml(t){return String(t??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
// JSON seguro para valores dentro de atributos HTML com aspas simples: escapa ' → &#39;
export function safeJson(v){return JSON.stringify(v).replace(/'/g,"&#39;");}
let toastTimer=null;
export function toast(t){
  const e=qs("#toast");
  e.textContent=t;
  e.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>e.classList.remove("show"),2600);
}
