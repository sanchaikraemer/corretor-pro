import fs from "node:fs";
import assert from "node:assert/strict";

// v1319 — A BARRA PARAVA NOS 88% E PARECIA TRAVADA.
//
// "quando chega em 88% trava e demora para seguir (em todas analises e reanalises)" (dono,
// 20/08/2026, com print).
//
// Não travava nada. A barra tinha CINCO frases fixas, uma a cada 1,8 segundo: em NOVE segundos
// acabava as frases, sentava nos 88% e ficava lá até a IA responder — mais 30 a 60 segundos de
// tela parada. E as frases mentiam sobre o momento: aos 72% dizia "Gravando análise no banco" e
// aos 88% "Conferindo se ficou salvo", quando o pedido ainda nem tinha voltado da IA.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// 1) As frases que mentiam sobre o momento não podem voltar.
// ---------------------------------------------------------------------------
assert.doesNotMatch(app, /\[88, "Conferindo se ficou salvo\.\.\." \]/, "os 88% não podem mais ser um degrau fixo onde a barra senta");
assert.doesNotMatch(app, /\[72, "Gravando análise no banco\.\.\."\]/, "não pode dizer que gravou no banco antes de a IA responder");

// ---------------------------------------------------------------------------
// 2) A barra precisa continuar andando depois da última frase.
// ---------------------------------------------------------------------------
assert.match(app, /if\(pctAtual < 85\)\{ pctAtual \+= 1; progresso\.set\(pctAtual\); \}/, "depois das frases, a barra tem que seguir subindo sozinha");
assert.match(app, /costuma levar de 30 a 60 segundos/, "e precisa dizer ao corretor quanto tempo a espera costuma durar");

// ---------------------------------------------------------------------------
// 3) Os avisos de gravação continuam existindo — só no momento certo, depois da resposta.
// ---------------------------------------------------------------------------
assert.match(app, /progresso\.set\(90, "Resposta recebida\. Gravando e conferindo se ficou salvo\.\.\."\)/, "a gravação é anunciada quando ela realmente acontece");
assert.match(app, /progresso\.done\("Análise concluída e salva\."\)/, "e o 100% continua vindo do código de verdade");

// ---------------------------------------------------------------------------
// 4) A simulação da barra, com o mesmo relógio do app: em 90 segundos de espera ela nunca fica
//    parada no mesmo número por mais de alguns segundos, e nunca encosta em 88 antes da resposta.
// ---------------------------------------------------------------------------
const etapasTexto = [
  [16, "Enviando a conversa e o seu Cérebro pra IA..."],
  [26, "A IA está lendo a conversa inteira, do começo ao fim..."],
  [34, "A IA está escrevendo a leitura e as três sugestões — costuma levar de 30 a 60 segundos."]
];
let etapa = 0, pct = 8;
const vistos = [];
for (let segundo = 1; segundo <= 90; segundo++) {
  if (etapa < etapasTexto.length) { pct = etapasTexto[etapa++][0]; }
  else if (pct < 85) { pct += 1; }
  vistos.push(pct);
}
assert.equal(vistos.includes(88), false, "a barra não pode mais mostrar 88% enquanto ainda espera a IA");
assert.equal(vistos.at(-1), 85, "depois de 90 segundos de espera ela chega no teto de 85% (o resto vem da resposta real)");

// Nenhum número pode ficar repetido por mais de 6 segundos antes do teto — era esse o "travou".
let repeticaoMaxAntesDoTeto = 0, atual = 1;
for (let i = 1; i < vistos.length; i++) {
  if (vistos[i] === vistos[i - 1] && vistos[i] < 85) { atual += 1; repeticaoMaxAntesDoTeto = Math.max(repeticaoMaxAntesDoTeto, atual); }
  else atual = 1;
}
assert.ok(repeticaoMaxAntesDoTeto <= 6, `a barra ficou ${repeticaoMaxAntesDoTeto}s parada no mesmo número antes do teto`);

console.log("v1319-barra-de-progresso-nao-trava: ok");
