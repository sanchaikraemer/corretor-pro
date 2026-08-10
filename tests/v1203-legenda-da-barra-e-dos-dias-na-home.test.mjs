import fs from "node:fs";
import assert from "node:assert/strict";

// v1203 — pedido do dono, olhando o app publicado (print com uma linha vermelha riscando a
// lista): a barra de mensagens e o "há Xd" na Home não tinham nenhum título visível — só uma
// dica ao passar o mouse (title=""), que ele (e qualquer corretor no celular, onde não existe
// hover) nunca ia descobrir sozinho. Ele mesmo disse: "eu sei q o grafico é de mensagens... acho
// q é, nem tenho mais certeza" — e sobre os dias, "nem eu sei mais". Este teste garante que existe
// uma legenda sempre visível (não só um title) acima da lista, com as duas explicações.

const appSrc = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// 0. A legenda existe no código-fonte, com as duas explicações (barra = mensagens 90 dias; há Xd).
assert.match(appSrc, /class="cp-hoje-legenda"/, 'precisa existir a legenda "cp-hoje-legenda" acima da lista da Home');
assert.match(appSrc, /cp-hoje-legenda\{[^}]*\}/, "a legenda precisa ter estilo próprio (não pode ficar sem CSS)");

const iniLeg = appSrc.indexOf('class="cp-hoje-legenda"');
const textoLegenda = appSrc.slice(iniLeg, iniLeg + 300);
assert.match(textoLegenda, /mensagens do cliente nos últimos 90 dias/, "a legenda precisa explicar a barra/número (mensagens do cliente, 90 dias)");
assert.match(textoLegenda, /há Xd.*dias desde o último contato/, 'a legenda precisa explicar o "há Xd"');

// 1. A legenda de verdade aparece ANTES da lista no HTML gerado (não só existe solta em algum
// lugar do arquivo) — extrai o trecho real que monta top3Html e roda com dados falsos.
{
  const iniTrecho = appSrc.indexOf("let top3Html;");
  assert.ok(iniTrecho > -1, "não achei o trecho que monta top3Html");
  const fimTrecho = appSrc.indexOf("foco.innerHTML = `", iniTrecho);
  const trecho = appSrc.slice(iniTrecho, fimTrecho);

  const cpHomeLeadRow = (l) => `<button class="cp-hoje-row" data-id="${l.id}"></button>`;
  const fn = new Function(
    "dose", "disponiveisParaPuxar", "metaHoje", "filaRanqueada", "items",
    "cpHomeLeadRow", "mensagensDoClienteRecente", "cpAtendidosHojeTotal", "cpFimDeSemana", "CP_DOSE_DIA",
    `${trecho}\nreturn top3Html;`
  );
  const html = fn(
    [{ id: "1" }, { id: "2" }], [], 2, [{ id: "1" }, { id: "2" }], [],
    cpHomeLeadRow, () => 3, () => 0, () => false, 10
  );
  const posLegenda = html.indexOf("cp-hoje-legenda");
  const posLista = html.indexOf("cp-hoje-list");
  assert.ok(posLegenda > -1 && posLista > -1, "legenda e lista precisam estar as duas presentes quando há leads pra atender");
  assert.ok(posLegenda < posLista, "a legenda precisa vir ANTES da lista, não depois nem misturada");
}

// 2. Bônus achado ao mexer aqui: o title da barra tinha um erro de português — "mensagem" + "s"
// vira "mensagems" (plural errado) sempre que n > 1. Corrigido pra "mensagens" de verdade.
{
  const ini = appSrc.indexOf("function cpBarraMensagensMini(l, maxMsgs){");
  const fim = appSrc.indexOf("\n}", ini) + 2;
  const fnSrc = appSrc.slice(ini, fim);
  const cpBarraMensagensMini = new Function(`${fnSrc}; return cpBarraMensagensMini;`)();
  globalThis.mensagensDoClienteRecente = (l) => l.__n;
  const um = cpBarraMensagensMini({ __n: 1 }, 10);
  const varios = cpBarraMensagensMini({ __n: 34 }, 34);
  assert.match(um, /1 mensagem do cliente/, "singular precisa continuar certo");
  assert.match(varios, /34 mensagens do cliente/, '"mensagems" era o bug — plural certo é "mensagens"');
  assert.doesNotMatch(varios, /mensagems/, "não pode mais existir o erro de português \"mensagems\"");
  delete globalThis.mensagensDoClienteRecente;
}

console.log("v1203-legenda-da-barra-e-dos-dias-na-home: ok");
