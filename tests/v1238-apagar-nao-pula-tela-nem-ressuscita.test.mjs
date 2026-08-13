// v1238 — apagar uma mensagem do histórico não pode pular a tela nem trazer a linha de volta.
//
// Dois relatos do dono no mesmo minuto (prints de 12/08/2026, logo depois da v1237):
//
//   1. "depois q apaguei veio pra essa tela, mas quero q fique na mesma quando apagar mensagem
//      do histórico" — apagou uma observação e a página foi parar no "Histórico de contatos".
//   2. O print seguinte mostra o pior: o aviso "Observação apagada. O atendimento de hoje foi
//      desfeito", o contador do card caindo de 3 pra 2 — e a observação AINDA na lista. Tocando
//      o ✕ dela de novo: "Essa observação não está mais no histórico".
//
// São duas causas diferentes, as duas neste arquivo.
import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ══ 1. A TELA NÃO PULA ═════════════════════════════════════════════════════════════════════
//
// Não foi a rolagem que falhou — foi o card "Últimas mensagens" fechar. A v1028 já preservava
// aberto/fechado, mas SÓ no caminho de abrir o lead; quem remonta depois (apagar, marcar
// atendimento, reanalisar) recriava o card com o `hidden` cravado no HTML. Fechado o card, a
// página encolhe, e a restauração de rolagem (que devolve o MESMO número de pixels) pousa lá
// embaixo. Preservar o card resolve a rolagem por consequência.
const ini = app.indexOf("function renderLeadFoco(lead){");
const fim = app.indexOf("window.renderLeadFoco = renderLeadFoco;", ini);
assert.ok(ini > -1 && fim > ini, "renderLeadFoco não encontrada");
const render = app.slice(ini, fim);

assert.match(render, /const cp7HistAntes = area\.querySelector\('#cp704HistCard'\)/,
  "renderLeadFoco precisa guardar se o card de mensagens estava aberto ANTES de remontar");
assert.match(render, /const cp7HistAberto = !!cp7HistAntes && !cp7HistAntes\.hidden/,
  "o que importa é aberto/fechado, não a existência do card");
assert.match(render, /if\(cp7HistAberto\)\{[^}]*cp704HistCard[^}]*hidden = false/,
  "o card precisa voltar aberto depois da remontagem");

// A ORDEM importa: devolver o card aberto tem que vir ANTES de mexer na rolagem, senão a página
// ainda está curta na hora de restaurar e o número de pixels pousa no lugar errado.
const posCard = render.indexOf("if(cp7HistAberto)");
const posRolagem = render.indexOf("if(cp7JaTinhaDetalhe && Math.abs(window.scrollY");
assert.ok(posCard > -1 && posRolagem > -1, "os dois trechos precisam existir");
assert.ok(posCard < posRolagem,
  "o card volta a abrir ANTES de restaurar a rolagem — senão a altura da página ainda está errada");

// A captura tem que acontecer antes da remontagem (área é trocada por innerHTML).
const posCaptura = render.indexOf("const cp7HistAntes");
const posInnerHtml = render.indexOf("area.innerHTML=");
assert.ok(posCaptura < posInnerHtml, "guardar o estado do card antes de trocar a tela");

// ══ 2. A LINHA APAGADA NÃO VOLTA ═══════════════════════════════════════════════════════════
//
// recarregarLeadFoco tem uma proteção antiga: a LISTA de leads traz só um recorte das mensagens,
// então "se a cópia local tem mais mensagens que a que chegou agora, fica com a local" (senão a
// barra de interesse despencava de 108 pra 4 ao marcar atendimento). Depois de APAGAR, essa
// proteção fazia o contrário do certo — a cópia local tinha mais mensagens justamente porque
// ainda tinha a que acabou de ser apagada. Conserto na origem: quem apaga tira a linha da cópia
// local antes de recarregar.
assert.match(app, /function cp7TiraDaTimelineLocal\(leadId, iso\)\{/,
  "precisa existir a função que tira a linha apagada da cópia que está na tela");

const iniFn = app.indexOf("function cp7TiraDaTimelineLocal");
const fnSrc = app.slice(iniFn, app.indexOf("window.cp704DesfazerMensagemEnviada", iniFn));
assert.match(fnSrc, /String\(state\.lead\.id\) !== String\(leadId\)/,
  "só mexe no lead que está aberto na tela");
assert.match(fnSrc, /filter\(m => String\(m\?\.iso \|\| ''\) !== String\(iso\)\)/,
  "tira exatamente a linha apagada, pelo identificador dela");
assert.match(fnSrc, /messageCount = Math\.max\(0, Number\(state\.lead\.messageCount\) - 1\)/,
  "o contador do card precisa acompanhar, senão a tela mostra um número e lista outro");

// A proteção antiga continua de pé — ela não pode ser removida junto (era um bug real de v754+).
const iniReload = app.indexOf("async function recarregarLeadFoco(id){");
const reload = app.slice(iniReload, app.indexOf("window.recarregarLeadFoco", iniReload));
assert.match(reload, /if\(msgsLocal\.length>msgsFresh\.length\)/,
  "a proteção que preserva o histórico completo continua existindo (ela conserta outro bug)");

// As DUAS ações de apagar precisam chamar a limpeza, e ANTES de recarregar a tela.
for (const [fn, ate] of [
  ["window.cp704DesfazerMensagemEnviada", "window.cp704ApagarObservacao"],
  ["window.cp704ApagarObservacao", "window.cp704AbrirPropostaSalva"]
]) {
  const bloco = app.slice(app.indexOf(fn), app.indexOf(ate));
  assert.match(bloco, /cp7TiraDaTimelineLocal\(leadId, iso\)/,
    `${fn} precisa tirar a linha apagada da tela`);
  assert.ok(bloco.indexOf("cp7TiraDaTimelineLocal") < bloco.indexOf("recarregarLeadFoco"),
    `${fn}: tirar a linha vem ANTES de recarregar — senão a cópia velha volta a vencer`);
}

console.log("v1238-apagar-nao-pula-tela-nem-ressuscita: ok");
