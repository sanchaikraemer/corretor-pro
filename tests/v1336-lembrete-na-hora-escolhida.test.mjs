import fs from "node:fs";
import assert from "node:assert/strict";

// v1336 — O LEMBRETE CHEGA NA HORA QUE O CORRETOR ESCOLHEU.
//
// Print do dono (20/08/2026), com a notificação do app na tela do celular: *"outra coisa, recebi
// agora essa msg em anexo, isso ta programado pra essa hora?"*
//
// Não estava programado pra hora nenhuma: o aviso saía quando o celular resolvia acordar o app em
// segundo plano. O único freio era "no máximo um a cada 20 horas" — que garante a frequência, não
// o horário. Resultado: cobrança de trabalho fora de hora de trabalho.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ── 1. A tela pergunta a hora ────────────────────────────────────────────────────────────────
assert.match(html, /<select id="lembreteDiarioHora"[^>]*onchange="cpLembreteDiarioSalvarHora\(\)"/,
  "o cartão do lembrete precisa ter o seletor de horário");
assert.match(app, /const CP_LEMBRETE_HORA_KEY = "cp-lembrete-hora";/);
assert.match(app, /const CP_LEMBRETE_HORA_PADRAO = 8;/, "sem escolha, o padrão é 8h da manhã — não madrugada");
assert.match(app, /window\.cpLembreteDiarioSalvarHora = cpLembreteDiarioSalvarHora;/,
  "a função precisa estar no window, senão o onchange do HTML não acha ela");
assert.match(app, /for\(let h = 5; h <= 21; h\+\+\)/, "as opções vão das 5h às 21h");

// ── 2. A hora chega ao service worker (que não enxerga o localStorage) ───────────────────────
assert.match(app, /cpNotifGravar\("horaAviso", \{ hora: cpLembreteDiarioHora\(\), janelaHoras: CP_LEMBRETE_JANELA_HORAS \}\)/,
  "a hora escolhida precisa ir pro IndexedDB, que é o único lugar que o worker lê");
assert.match(app, /await cpLembreteDiarioGravarHoraNoWorker\(\);/,
  "e ser gravada já na ativação do lembrete, não só quando ele mexe no seletor");

// ── 3. O worker respeita a janela ────────────────────────────────────────────────────────────
assert.match(sw, /const horario = await swNotifLer\('horaAviso'\);/);
// v1344 — a conferência mudou de forma (ver v1344-lembrete-nao-morre-pela-janela): a trava passou a
// ser "um por DIA DE CALENDÁRIO" e a janela ganhou uma repescagem, porque só a janela quase matou o
// lembrete. O que este teste guarda continua sendo o mesmo: existe conferência de horário, e ela
// acontece ANTES de mostrar a notificação.
assert.match(sw, /const naJanela = \(\(agoraH - inicio \+ 24\) % 24\) < janela;/,
  "a janela escolhida continua sendo o caminho normal do aviso");
assert.match(sw, /if \(!naJanela && !repescagem\) return;/,
  "acordou fora da janela e sem repescagem: não avisa, espera a próxima");
assert.ok(sw.indexOf("if (!naJanela && !repescagem) return;") < sw.indexOf("swNotifGravar('ultimoAviso'"),
  "a conferência do horário vem ANTES de mostrar a notificação e de carimbar o último aviso");
// A trava de um aviso por dia continua existindo — é ela que garante a frequência.
assert.match(sw, /if \(diaDoUltimoAviso === hoje\) return;/,
  "a trava de um aviso por dia não pode sair: é ela que impede dois avisos no mesmo dia");

// A janela roda a virada do dia sem quebrar: escolher 22h precisa valer até 2h da manhã.
const dentroDaJanela = (inicio, agora, janela = 4) => ((agora - inicio + 24) % 24) < janela;
assert.equal(dentroDaJanela(8, 8), true);
assert.equal(dentroDaJanela(8, 11), true);
assert.equal(dentroDaJanela(8, 12), false, "quatro horas depois já passou da janela");
assert.equal(dentroDaJanela(8, 3), false, "de madrugada, nunca");
assert.equal(dentroDaJanela(22, 1), true, "janela que atravessa a meia-noite continua valendo");
assert.equal(dentroDaJanela(22, 21), false);

// ── 4. Mais chances de o celular acordar dentro da janela ────────────────────────────────────
assert.match(app, /minInterval: 4 \* 60 \* 60 \* 1000/,
  "com pedido a cada 20h o celular quase nunca acordava dentro da hora escolhida");
assert.ok(!/minInterval: 20 \* 60 \* 60 \* 1000/.test(app), "o intervalo antigo não pode continuar no código");

console.log("v1336-lembrete-na-hora-escolhida: ok");
