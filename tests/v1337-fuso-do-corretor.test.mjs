import fs from "node:fs";
import assert from "node:assert/strict";
import "./_fuso-do-app.mjs";
import { fusoDoCorretor } from "../api/_pipeline.js";

// v1337 — O FUSO HORÁRIO DEIXA DE SER "BRASÍLIA PRA TODO MUNDO".
//
// Item da auditoria de arquitetura de 20/08/2026: o fuso estava cravado no código — 35 vezes só
// dentro do app.js, mais 16 nas rotas de /api. Funciona pra quem atende no horário de Brasília e
// mente pra todo o resto do país: em Manaus o app mostrava uma hora a mais; em Rio Branco, duas.
// E hora errada não é detalhe de tela — é a saudação errada dentro da mensagem que o corretor
// manda pro cliente ("Boa noite" às 17h) e o "hoje" errado na virada do dia, que muda a fila.
//
// O QUE NÃO MUDOU, E É DE PROPÓSITO: o padrão continua Brasília, e o relógio do APARELHO não
// decide nada. Este app já apanhou disso (v887, v1107, v1248): Android reinstalado volta em UTC e
// corretor viajando levava o "hoje" junto. O aparelho agora só aparece como SUGESTÃO na tela.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const cerebro = fs.readFileSync(new URL("../api/cerebro-config.js", import.meta.url), "utf8");

// ── 1. Nenhum fuso cravado sobrou espalhado pelo app ─────────────────────────────────────────
const linhasComFusoCravado = app.split("\n")
  .map((linha, i) => ({ linha, n: i + 1 }))
  .filter(({ linha }) => /timeZone\s*:\s*["']America\/Sao_Paulo["']/.test(linha));
assert.deepEqual(linhasComFusoCravado, [],
  "nenhuma formatação de data no app pode cravar o fuso — todas passam por cpFuso()");
assert.match(app, /const CP_FUSO_PADRAO = "America\/Sao_Paulo";/,
  "o padrão continua Brasília, num lugar só");

// ── 2. O padrão NÃO é o relógio do aparelho ──────────────────────────────────────────────────
const corpoCpFuso = app.match(/function cpFuso\(\)\{[\s\S]*?\n\}/)[0];
assert.ok(!/cpFusoDoAparelho\(\)/.test(corpoCpFuso),
  "o fuso do aparelho não pode ser o padrão: celular reinstalado volta em UTC e corretor viajando levaria o 'hoje' junto");
assert.match(corpoCpFuso, /salvo \|\| CP_FUSO_PADRAO/, "sem nada salvo, vale Brasília");
assert.equal(globalThis.cpFuso(), "America/Sao_Paulo", "e é isso que a função devolve de verdade");

// ── 3. A meia-noite passou a ser calculada, não chutada em 03:00 UTC ─────────────────────────
// Era este o pedaço perigoso: três lugares faziam "meia-noite em Brasília = 03:00 UTC". Com outro
// fuso escolhido, a conta ficaria errada por horas — e "ontem à noite" viraria "hoje".
assert.ok(!/Date\.UTC\([^)]*,\s*3,\s*0,\s*0,\s*0\)/.test(app),
  "a conta cravada de 03:00 UTC não pode continuar em lugar nenhum");
const meiaNoiteEm = (tz, y, m, d) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short", hour12: false })
    .format(new Date(globalThis.cpMeiaNoiteMs(y, m, d, tz)));
for (const tz of ["America/Sao_Paulo", "America/Manaus", "America/Rio_Branco", "America/Noronha"]) {
  assert.equal(meiaNoiteEm(tz, 2026, 8, 21), "21/08/2026, 00:00", `meia-noite errada em ${tz}`);
}
// Fuso com horário de verão (o app pode ser usado por brasileiro morando fora): no dia da virada,
// a meia-noite ainda precisa ser meia-noite.
assert.equal(meiaNoiteEm("Europe/Lisbon", 2026, 3, 29), "29/03/2026, 00:00",
  "no dia em que o relógio adianta, a meia-noite local continua sendo meia-noite");
assert.equal(new Date(globalThis.cpMeiaNoiteMs(2026, 8, 21, "America/Manaus")).toISOString(),
  "2026-08-21T04:00:00.000Z", "Manaus é UTC-4: a meia-noite de lá é 04:00 UTC");

// ── 4. Fuso inválido não derruba o app ───────────────────────────────────────────────────────
assert.equal(globalThis.cpFusoValido("Marte/Olympus"), "", "fuso inventado é recusado");
assert.equal(globalThis.cpFusoValido("America/Manaus"), "America/Manaus");
assert.equal(fusoDoCorretor({ fusoHorario: "Marte/Olympus" }), "America/Sao_Paulo",
  "no servidor, fuso inválido volta pro padrão em vez de quebrar toda a formatação da análise");
assert.equal(fusoDoCorretor({ fusoHorario: "America/Rio_Branco" }), "America/Rio_Branco");
assert.equal(fusoDoCorretor(null), "America/Sao_Paulo");

// ── 5. A escolha existe na tela, é salva e o servidor a usa ──────────────────────────────────
assert.match(html, /<select id="cerebroFusoHorario"/, "o Cérebro precisa ter o seletor de fuso");
assert.match(html, /America\/Manaus/, "com as opções do Brasil que não são Brasília");
assert.match(html, /id="cerebroFusoDetectado"/, "e a linha que mostra o que o aparelho diz");
assert.match(app, /const fusoAtivo = cpFusoDefinir\(config\.fusoHorario\) \|\| cpFuso\(\);/,
  "o fuso salvo precisa passar a valer no app inteiro ao carregar o Cérebro, não só no seletor");
assert.equal((app.match(/fusoHorario: cpFusoDefinir\(qs\("#cerebroFusoHorario"\)\?\.value\)/g) || []).length, 3,
  "os três caminhos que salvam o Cérebro precisam mandar o fuso — senão salvar por um deles apaga a escolha");
assert.match(cerebro, /fusoHorario: normalizarFuso\(v\.fusoHorario\)/, "a rota do Cérebro lê o fuso");
assert.match(cerebro, /fusoHorario: normalizarFuso\(body\.fusoHorario\)/, "e o grava");
assert.match(pipeline, /const fusoAnalise = fusoDoCorretor\(configCerebro\);/,
  "e é ele que a análise usa pra hora atual e pra saudação certa");

console.log("v1337-fuso-do-corretor: ok");
