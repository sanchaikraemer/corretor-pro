import fs from 'node:fs';
import assert from 'node:assert/strict';

// v964 — revisão de app.js. O dono já tinha pedido pra trocar o confirm() nativo (a "tela feia"
// com a URL do app aparecendo) pelo modal em-app cp903Confirm num botão (Reativar). Nesta
// revisão sistemática achei mais 10 lugares com o MESMO confirm() nativo — inclusive em ações
// destrutivas (apagar lead, excluir definitivo, zerar Cérebro, apagar tudo). Todos convertidos
// pro mesmo padrão já usado no resto do app: `(typeof cp903Confirm === "function") ?
// await cp903Confirm({...}) : confirm(msg)`.
//
// NÃO entraram nesta lista (de propósito): abrirVenda/marcarPerdido/arquivarLead/
// ui683MarcarEtapaRapida têm uma PRIMEIRA definição com confirm() nativo, mas
// window.<nome> é reatribuído depois (rastreado nesta revisão) pra uma versão mais nova que já
// usa cp903Confirm (ou um modal próprio, abrirModalDesfechoFinal) — a primeira definição é
// código morto (nunca roda: todo call site chama via window.<nome>, que resolve pra última
// atribuição). Ver REVISAO-COMPLETA.md pro rastreamento completo.

const src = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const FUNCOES_COM_CONFIRM_EM_APP = [
  'importarTelefonesCSV',
  'apagarLead',
  'excluirLeadDefinitivo',
  'removerLembrete',
  'apagarItemAprendizado',
  'limparAprendizadoTudo',
  'zerarCerebroTudo',
  'descartarLeadPendente'
];

for (const nome of FUNCOES_COM_CONFIRM_EM_APP) {
  const re = new RegExp(`(?:async )?function ${nome}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`);
  const corpo = src.match(re)?.[0];
  assert.ok(corpo, `achei a função ${nome} em app.js`);
  assert.match(corpo, /cp903Confirm/, `${nome} deve usar cp903Confirm em vez de confirm() nativo puro`);
}

// #btnDescartarUpload e #wipeAll são addEventListener inline — checa o trecho ao redor do id.
assert.match(
  src.slice(src.indexOf('"#btnDescartarUpload"'), src.indexOf('"#btnDescartarUpload"') + 600),
  /cp903Confirm/,
  '#btnDescartarUpload deve usar cp903Confirm'
);
const wipeAllSrc = src.slice(src.indexOf('qs("#wipeAll")'), src.indexOf('qs("#wipeAll")') + 1200);
assert.match(wipeAllSrc, /cp903Confirm/, '#wipeAll deve usar cp903Confirm nas duas confirmações');

// v964 — bug real à parte: o body enviado por #wipeAll usava a chave "confirmacao", mas
// api/limpar-tudo.js exige literalmente body.confirm === "APAGAR TUDO". Com a chave errada o
// botão SEMPRE devolvia 400 "Confirmação inválida" — nunca funcionou. Checa só a linha ATIVA
// (`body: JSON.stringify(...)`), não o arquivo/trecho inteiro — um comentário explicando o bug
// antigo também contém o texto "confirmacao: ...", o que faria esse assert disparar por engano.
const linhaBodyWipe = wipeAllSrc.split('\n').find(l => l.trim().startsWith('body: JSON.stringify({ confirm'));
assert.ok(linhaBodyWipe, 'achei a linha do body enviado por #wipeAll');
assert.doesNotMatch(linhaBodyWipe, /confirmacao/, '#wipeAll não pode mais mandar a chave errada "confirmacao"');
assert.match(linhaBodyWipe, /confirm\s*:\s*["']APAGAR TUDO["']/, '#wipeAll precisa mandar { confirm: "APAGAR TUDO" }, a chave que a API espera');

// CSS: mensagens multi-linha (ex.: zerarCerebroTudo, excluirLeadDefinitivo) usam \n\n no texto —
// sem white-space:pre-line no <p> do modal, a quebra de linha desaparecia visualmente.
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const cp903P = css.match(/\.cp903-modal p\{[^}]*\}/)?.[0] || '';
assert.match(cp903P, /white-space:\s*pre-line/, '.cp903-modal p precisa preservar quebra de linha (mensagens multi-linha)');

console.log('v964-confirmacoes-usam-modal-em-app: ok');
