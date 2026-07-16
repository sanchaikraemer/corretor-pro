import fs from "node:fs";
import assert from "node:assert/strict";

// v848: extração piloto do bloco "Gerador de proposta" de app.js pra js/proposta.js
// (primeira fatia de feature real da modularização, depois da infra em v847 — ver
// NOTAS-v847.md / NOTAS-v848.md). Confirma que o bloco saiu de app.js, que o módulo novo
// existe com as funções-chave e os imports certos, e que as chamadas pra fora do módulo
// (que dependiam de globais implícitos de script clássico) usam a ponte window.X — sem
// isso a extração quebraria silenciosamente exatamente como o bug do window.show em v847.

const appJs = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const proposta = fs.readFileSync(new URL("../js/proposta.js", import.meta.url), "utf8");

assert.doesNotMatch(appJs, /function propRender\(/, "propRender não pode mais existir em app.js — só em js/proposta.js");
assert.match(appJs, /import '\.\/js\/proposta\.js\?v=__VERSION__';/, "app.js precisa importar o módulo de proposta");
assert.match(appJs, /window\.payloadComCerebro = payloadComCerebro;/, "payloadComCerebro precisa de export explícito — js/proposta.js chama via window.payloadComCerebro");

for (const fn of ["propRender", "propClear", "propAddAporte", "propRemoveAporte", "propUpdateAporte", "abrirPropostaComLead", "imprimirProposta", "voltarDaProposta", "atualizarVoltarProposta", "registrarPropostaNoLead", "excluirPropostaTimeline", "propFotoSelecionada", "propFotoRemover"]) {
  assert.match(proposta, new RegExp("function " + fn + "\\("), `js/proposta.js precisa definir ${fn}`);
  assert.match(proposta, new RegExp("window\\." + fn + " = " + fn), `${fn} precisa ficar acessível via window (onclick inline do HTML depende disso)`);
}

assert.match(proposta, /import \{ qs, qsa, escapeHtml, toast \} from '\.\/dom\.js\?v=__VERSION__';/, "js/proposta.js precisa importar os helpers de dom.js");
assert.match(proposta, /import \{ state \} from '\.\/state\.js\?v=__VERSION__';/, "js/proposta.js precisa importar o state compartilhado");

// As chamadas pra funções que continuam em app.js precisam passar por window.X — chamada
// lexical nua (ex. "show(" sem "window.") não resolveria depois que o código saiu do
// módulo de app.js, exatamente o bug que o smoke test em navegador achou na v847.
assert.match(proposta, /window\.show\("propostas"\)/, "abrirPropostaSalva/abrirPropostaComLead precisam chamar window.show, não show direto");
assert.match(proposta, /window\.abrirLead\(/, "voltarDaProposta/excluirPropostaTimeline precisam chamar window.abrirLead, não abrirLead direto");
assert.match(proposta, /window\.invalidarLeadsCache\(\)/, "registrarPropostaNoLead/excluirPropostaTimeline precisam chamar window.invalidarLeadsCache, não invalidarLeadsCache direto");
assert.match(proposta, /window\.payloadComCerebro\(/, "registrarPropostaNoLead/excluirPropostaTimeline precisam chamar window.payloadComCerebro, não payloadComCerebro direto");

console.log("js-proposta-module: ok");
