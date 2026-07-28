import fs from "node:fs";
import assert from "node:assert/strict";

// v1046 (2ª parte da mesma versão) — o dono viu leads sem conversa de verdade (0 mensagens
// recentes, até 141 dias parados) disputando posição numerada (1º/2º/3º...) na lista "Fazer
// agora" contra leads realmente quentes, e reclamou que já tinha pedido pra resolver isso antes.
// Pediu explicitamente: "não quero número de posição como 1°, 2° ou 3°, isso é desnecessário,
// retire tudo sobre isso de posição. estando ali os 10, ou 15, ou quantos definidos lá no
// cérebro, já está ok" — ou seja, a lista em si (com a quantidade certa) já basta, sem precisar
// numerar cada linha.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.doesNotMatch(app, /chr-rank/, "nenhum vestígio do badge de posição (chr-rank) pode sobrar em app.js");
assert.match(app, /function cpHomeLeadRow\(l, ?maxMsgs\)\{/, "cpHomeLeadRow não recebe mais o parâmetro de posição");
assert.match(app, /dose\.map\(l ?=> ?cpHomeLeadRow\(l, ?maxMsgsDose\)\)/, "a lista de hoje chama cpHomeLeadRow sem passar posição");

const sandbox = `
  const mensagensDoClienteRecente = (l) => 0;
  const escapeHtml = (s) => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const produtosLabel = (l) => l.product || '';
  const produtosLabelCurto = (l) => l.product || '';
  const prioridadeAtendimento = (l) => ({ nivel: 0 });
  ${app.match(/function cpBarraMensagensMini\(l, ?maxMsgs\)\{[\s\S]*?\n\}/)[0]}
  ${app.match(/function cpHomeLeadRow\(l, ?maxMsgs\)\{[\s\S]*?\n\}/)[0]}
  cpHomeLeadRow;
`;
const cpHomeLeadRow = eval(sandbox);

const html = cpHomeLeadRow({ name: "Dra. Diene", daysSinceLastInteraction: 141, product: "Quality Residence" }, 200);
assert.doesNotMatch(html, /\d+º/, "a linha não mostra nenhum número de posição (Xº)");
assert.doesNotMatch(html, /class="chr-rank"/, "a linha não tem o elemento de badge de posição");
assert.match(html, /Dra\. Diene/, "a linha continua mostrando o nome do lead normalmente");
assert.match(html, />há 141d</, "a linha continua mostrando os dias parado normalmente, só sem numeração");

console.log("v1046-2-sem-numero-posicao-fila-hoje: ok");
