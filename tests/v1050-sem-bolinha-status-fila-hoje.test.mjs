import fs from "node:fs";
import assert from "node:assert/strict";

// v1050 — o dono pediu pra tirar a "bolinha" (indicador colorido de status — coral quando o
// cliente está esperando resposta, cinza no resto) da linha da lista "Fazer agora", deixando
// claro que não bastava esconder na tela: queria o código junto ("não adianta só omitir a
// bolinha na tela... não quero isso, é desnecessário esse negócio de bolinha"). Removido o
// elemento (chr-dot), o cálculo da cor (dotCor) e as regras de CSS/grid que reservavam espaço
// pra ele — sem tocar no sinal de prioridade em si (nivel/clienteAguardandoVoce), que continua
// decidindo a ORDEM da fila e o texto do title de "dias" (isso é um pedido diferente, não foi o
// que o dono pediu aqui).

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.doesNotMatch(app, /chr-dot/, "nenhum vestígio do elemento/CSS da bolinha (chr-dot) pode sobrar em app.js");
assert.doesNotMatch(app, /dotCor/, "o cálculo da cor da bolinha (dotCor) não pode mais existir");

const rowSrc = app.match(/function cpHomeLeadRow\(l, ?maxMsgs\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(rowSrc, /<span class="chr-dot"/, "a linha não pode mais renderizar o span da bolinha");
assert.match(rowSrc, /chr-nm[\s\S]*chr-pr[\s\S]*chr-dd/, "a linha continua com nome, produto e dias (só a bolinha saiu)");

// O grid não reserva mais coluna/área pra bolinha (nem no desktop nem no mobile).
assert.match(app, /grid-template-columns:minmax\(0,1\.05fr\) minmax\(0,\.7fr\) 240px 42px;grid-template-areas:"nm pr bar dd"/,
  "grid desktop não reserva mais espaço pra bolinha");
assert.match(app, /grid-template-columns:minmax\(0,1fr\) auto;grid-template-areas:"nm dd" "bar pr"/,
  "grid mobile não reserva mais espaço pra bolinha");

// O sinal de prioridade em si (usado pra ORDENAR a fila e pro title de "dias") continua intacto —
// só o indicador visual saiu. Não é escopo desta mudança mexer nisso.
assert.match(app, /clienteAguardandoVoce/, "o sinal de prioridade clienteAguardandoVoce continua existindo (não foi pedido remover)");
assert.match(app, /nivel === 1/, "a lógica de nivel (usada no title de dias) continua existindo");

console.log("v1050-sem-bolinha-status-fila-hoje: ok");
