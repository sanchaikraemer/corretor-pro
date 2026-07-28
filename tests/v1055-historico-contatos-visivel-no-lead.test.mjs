import fs from "node:fs";
import assert from "node:assert/strict";

// v1055 — o dono foi taxativo: "ninguém aparece como atendido no histórico... mesmo que clique
// em atender, isso não é marcado na linha do tempo". Investigando: `renderHistoricoContatos(lead)`
// (a função que monta o bloco "Histórico de contatos" — a única tela que mostra os cliques de
// "Marcar atendimento", "Copiar sugestão", ligação, visita, observação etc.) existia no código,
// mas NUNCA era chamada de lugar nenhum — órfã, provavelmente esquecida numa reforma anterior da
// tela do lead (cp704). Por isso o clique era salvo de verdade (os testes de
// v918/v1022/attendance-refresh já confirmavam isso do lado dos dados), mas o dono nunca via
// NENHUM sinal disso na tela — o mesmo tipo de bug de "duas contas discordando", só que aqui era
// "dado existe, mas não aparece em lugar nenhum".

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// 1. renderHistoricoContatos precisa estar sendo chamada de dentro de renderLeadFoco agora.
const foco = app.match(/function renderLeadFoco\(lead[\s\S]*?\n  return null;\n\}/)[0];
assert.match(foco, /renderHistoricoContatos\(lead\)/, "renderLeadFoco precisa chamar renderHistoricoContatos — senão o histórico de atendimentos nunca aparece na tela do lead");

// 2. Comportamento real: um lead com um "Marcar atendimento" registrado precisa gerar um bloco
// visível com a palavra "Atendido" e o rótulo "Histórico de contatos".
const historicoSrc = app.match(/function renderHistoricoContatos\(lead\)\{[\s\S]*?\n\}/)[0];
const eventoLabelSrc = app.match(/const EVENTO_LABEL = \{[\s\S]*?\n\};/)[0];

const renderHistoricoContatos = eval(`
  const escapeHtml = (s) => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatarTempoRelativo = (iso) => 'há 2 dias';
  ${eventoLabelSrc}
  ${historicoSrc}
  renderHistoricoContatos;
`);

const lead = {
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: new Date().toISOString() }
  ] } }
};
const html = renderHistoricoContatos(lead);
assert.match(html, /Histórico de contatos/, "o bloco precisa ter o título 'Histórico de contatos'");
assert.match(html, /Atendido/, "o clique de 'Marcar atendimento' precisa aparecer visivelmente como 'Atendido'");

// 3. Lead sem nenhum evento: não gera bloco nenhum (comportamento já existente, preservado).
assert.equal(renderHistoricoContatos({ analysis: {} }), "", "sem nenhum evento registrado, não mostra bloco vazio");

console.log("v1055-historico-contatos-visivel-no-lead: ok");
