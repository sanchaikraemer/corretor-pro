import fs from "node:fs";
import assert from "node:assert/strict";

// v1050 — o dono pediu pra tirar a "bolinha" (indicador colorido de status — coral quando o
// cliente está esperando resposta, cinza no resto) da linha da lista "Fazer agora", deixando
// claro que não bastava esconder na tela: queria o código junto ("não adianta só omitir a
// bolinha na tela... não quero isso, é desnecessário esse negócio de bolinha"). Removido o
// elemento (chr-dot), o cálculo da cor (dotCor) e as regras de CSS/grid que reservavam espaço
// pra ele — sem tocar, na época, no sinal de prioridade em si (nivel/clienteAguardandoVoce), que
// continuava decidindo a ORDEM da fila e o texto do title de "dias".
//
// v1190 — esse sinal foi removido de vez (ver NOTAS-v1190.md): a bolinha tinha saído da tela em
// 1050, mas a coisa que ela desenhava — "cliente está esperando sua resposta", deduzido de quem
// falou por último no retrato importado — continuou mandando na prioridade por 140 versões. Agora
// não existe mais nem o sinal, nem o nível 1, nem o title que ele escolhia.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.doesNotMatch(app, /chr-dot/, "nenhum vestígio do elemento/CSS da bolinha (chr-dot) pode sobrar em app.js");
assert.doesNotMatch(app, /dotCor/, "o cálculo da cor da bolinha (dotCor) não pode mais existir");

const rowSrc = app.match(/function cpHomeLeadRow\(l, ?maxMsgs\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(rowSrc, /<span class="chr-dot"/, "a linha não pode mais renderizar o span da bolinha");
assert.match(rowSrc, /chr-nm[\s\S]*chr-pr[\s\S]*chr-dd/, "a linha continua com nome, produto e dias (só a bolinha saiu)");

// O grid não reserva mais coluna/área pra bolinha (nem no desktop nem no mobile).
// v1345 — a largura da última coluna saiu de 42px pra 104px (o texto "atendido há 100d" precisa
// de 97px e estava vazando por cima do número — print do dono de 21/08/2026). O que este teste
// guarda é o que ele sempre guardou: são QUATRO áreas, "nm pr bar dd", e nenhuma delas é bolinha.
// Cravar o número exato de pixels aqui só transformava um ajuste de largura em teste vermelho.
assert.match(app, /grid-template-columns:minmax\(0,1\.05fr\) minmax\(0,\.7fr\) 240px \d+px;grid-template-areas:"nm pr bar dd"/,
  "grid desktop não reserva mais espaço pra bolinha");
assert.match(app, /grid-template-columns:minmax\(0,1fr\) auto;grid-template-areas:"nm dd" "bar pr"/,
  "grid mobile não reserva mais espaço pra bolinha");

// v1190 — a linha da Home não calcula mais nível nenhum: o único uso que restava era escolher o
// title "Cliente esperando sua resposta há N dias".
assert.doesNotMatch(rowSrc, /prioridadeAtendimento/, "a linha da Home não depende mais do motor de prioridade (v1190)");
assert.doesNotMatch(rowSrc, /nivel/, "não sobrou cálculo de nível na linha da Home");
assert.doesNotMatch(app.replace(/\/\/[^\n]*/g, ""), /nivel === 1/, "o nível 1 não existe mais em código (só em comentário histórico)");

console.log("v1050-sem-bolinha-status-fila-hoje: ok");
