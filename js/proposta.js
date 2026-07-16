import { qs, qsa, escapeHtml, toast } from './dom.js?v=__VERSION__';
import { state } from './state.js?v=__VERSION__';

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
  window.show("propostas");
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
  if(state.propLeadId){ window.abrirLead(state.propLeadId); return; }
  window.show("home");
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
  window.show("propostas");
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
      body: JSON.stringify(window.payloadComCerebro({ id: state.propLeadId, novoAtendimento: texto, apenasSalvar:true, autorManual:"Proposta gerada", tipoManual:"proposta", proposta: coletarPropostaData() }))
    });
    const d = await res.json().catch(()=>({}));
    if(!d?.ok) throw new Error(d?.error||"falha");
    window.invalidarLeadsCache();
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
      body: JSON.stringify(window.payloadComCerebro({ id: leadId, action:"remover-item", iso }))
    });
    const d = await res.json().catch(()=>({}));
    if(!d?.ok) throw new Error(d?.error||"falha");
    window.invalidarLeadsCache();
    toast("Proposta excluída.");
    window.abrirLead(leadId);
  }catch(err){ toast("Não consegui excluir: " + (err?.message||err)); }
}
window.excluirPropostaTimeline = excluirPropostaTimeline;
window.propAddAporte = propAddAporte; window.propRemoveAporte = propRemoveAporte; window.propUpdateAporte = propUpdateAporte;
window.propRender = propRender; window.propClear = propClear; window.abrirPropostaComLead = abrirPropostaComLead;
if(qs("#pf-data")) qs("#pf-data").valueAsDate = new Date();
propRender();
