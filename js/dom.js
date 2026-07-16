export function qs(s){return document.querySelector(s)}
export function qsa(s){return Array.from(document.querySelectorAll(s))}
export function isDesktop(){return matchMedia("(min-width:900px)").matches}
export function escapeHtml(t=""){return String(t).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
// JSON seguro para valores dentro de atributos HTML com aspas simples: escapa ' → &#39;
export function safeJson(v){return JSON.stringify(v).replace(/'/g,"&#39;");}
export function toast(t){const e=qs("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2600)}
