import fs from "node:fs";
import assert from "node:assert/strict";

// v1359 — "MESMO COM CONVERSA CURTA E SEM ÁUDIO FICA TRAVANDO AÍ E DEMORA MUITO".
//
// Print do dono (22/08/2026, 02h30): a roda parada em "Abrindo o arquivo · 68%", com o subtítulo
// "baixando e extraindo uma única vez".
//
// Não estava travado. Numa conversa PEQUENA e SEM ÁUDIO o servidor faz a ANÁLISE INTEIRA dentro
// dessa mesma chamada (analisarDireto, v1143) — uma viagem em vez de duas, que no total é mais
// rápido. Só que a tela continuava dizendo "Abrindo o arquivo", sem mexer, enquanto a IA lia a
// conversa. Quem olha vê travamento, e está certo em ver: o que a tela dizia não era o que estava
// acontecendo.
//
// Duas correções, as duas de honestidade:
//   1. a etapa passa a dizer que a análise está acontecendo ali, e conta os segundos;
//   2. o subtítulo fixo dizia "separando textos, FOTOS e áudios" — desde a v1358 foto não é mais
//      enviada, então essa palavra virou mentira também.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const importacao = fs.readFileSync(new URL("../js/importacao.js", import.meta.url), "utf8");

// ── 1. O subtítulo fixo não promete mais foto ────────────────────────────────────────────────
assert.match(app, /\{ rot:"Abrindo o arquivo",\s*sub:"separando o texto e os áudios" \}/,
  "a etapa não pode dizer que separa fotos — desde a v1358 foto nem viaja");
assert.ok(!/separando textos, fotos e áudios/.test(app), "o texto antigo não pode voltar");

// ── 2. Enquanto a análise roda, a etapa diz isso — e conta os segundos ───────────────────────
{
  const bloco = importacao.slice(importacao.indexOf("const pedeAnaliseJunto"), importacao.indexOf("if(!prep) throw"));
  assert.match(bloco, /abrindo e já analisando pelo seu Cérebro, tudo numa viagem só · \$\{seg\}s/,
    "a etapa precisa dizer o que está acontecendo de verdade");
  assert.match(bloco, /relogio = setInterval\(contar, 1000\);/, "e o contador precisa correr, pra não parecer congelado");
  assert.match(bloco, /finally\{ if\(relogio\) clearInterval\(relogio\); \}/,
    "o relógio TEM que parar quando a resposta chega — senão fica escrevendo por cima das etapas seguintes");
  assert.match(bloco, /analisarDireto: pedeAnaliseJunto/,
    "e continua sendo o mesmo pedido de sempre: só muda o que a tela conta");
}

// ── 3. A regra da segunda tentativa não pode ter mudado ──────────────────────────────────────
// Se a primeira chamada morreu no teto de tempo, a análise pode ter sido feita (e paga) sem a
// resposta chegar. A segunda tentativa nunca pede análise junto — isso é dinheiro, não estética.
{
  const bloco = importacao.slice(importacao.indexOf("for(let tentativa=1; tentativa<=2 && !prep;"), importacao.indexOf("if(!prep) throw"));
  assert.match(bloco, /const pedeAnaliseJunto = tentativa === 1;/,
    "só a primeira tentativa pede a análise junto — a segunda nunca, pra não pagar duas vezes");
  assert.ok(!/analisarDireto: true/.test(bloco), "nada de forçar análise junto em toda tentativa");
}
// E o contador só existe quando a análise vem junto: na segunda tentativa a etapa é só preparação.
{
  const bloco = importacao.slice(importacao.indexOf("const pedeAnaliseJunto"), importacao.indexOf("if(!prep) throw"));
  assert.match(bloco, /if\(pedeAnaliseJunto\)\{/, "sem análise junto, sem relógio: a etapa é curta mesmo");
}

// ── 4. O PRAZO: era isso que fazia levar 3 minutos ──────────────────────────────────────────
// Print seguinte do dono: 81s nesta etapa, 3 minutos no total. A rota tem 300s (vercel.json), mas
// o app desistia aos 90s — jogava fora um trabalho quase pronto (e já pago), refazia a preparação
// e pedia a análise numa segunda ida. Dois caminhos completos em vez de um.
{
  assert.match(importacao, /analisarDireto: pedeAnaliseJunto \}, pedeAnaliseJunto \? 240000 : 90000\)/,
    "com análise junto o prazo do app acompanha o do servidor; sem ela continua curto");
  const vercel = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const teto = Number(vercel.functions["api/processar-storage.js"].maxDuration) * 1000;
  assert.ok(240000 <= teto,
    `o prazo do app (240s) não pode passar do teto da rota (${teto / 1000}s) — senão ele espera por algo que já morreu`);
}
// E o servidor não aposta a análise junto quando a preparação já comeu o orçamento.
{
  const storage = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");
  assert.match(storage, /const ANALISE_JUNTA_PRAZO_MAX_MS = 45000;/);
  assert.match(storage, /const sobrouTempoPraAnalise = \(Date\.now\(\) - inicioDoPreparar\) < ANALISE_JUNTA_PRAZO_MAX_MS;/);
  assert.match(storage, /zipPequeno && sobrouTempoPraAnalise\) \{/,
    "sem folga, devolve só a preparação e deixa o app pedir a análise com o orçamento inteiro dela");
  assert.match(storage, /const inicioDoPreparar = Date\.now\(\);/, "e precisa medir de fato o tempo gasto");
}

console.log("v1359-barra-diz-a-verdade-na-etapa-lenta: ok");
