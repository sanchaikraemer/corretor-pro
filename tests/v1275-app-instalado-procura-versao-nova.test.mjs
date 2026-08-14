import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1275 — o dono mandou um print do painel "Seu mês" com o gráfico ainda mostrando sábado e
// domingo (a v1273 já tinha tirado, e já estava no ar) dizendo "vc ainda nao fez o q mandei".
// A correção estava publicada; o aparelho dele é que nunca chegava nela.
//
// A CAUSA: a checagem de versão nova (checarVersaoServidor) tinha uma trava de "1 vez por
// SESSÃO" (sessionStorage "vchk") e só era disparada no carregamento da página. No app
// INSTALADO isso vira "uma vez e nunca mais": o aplicativo fica vivo em segundo plano por dias,
// a sessão não termina, e o único carregamento tinha acontecido lá atrás. Tudo o que fosse
// publicado depois disso passava batido — o app ficava parado numa versão antiga por tempo
// indeterminado, e o dono via correção antiga na tela mesmo com a nova no ar.
//
// Este teste tranca as duas pontas: a trava passa a ser de TEMPO (continua impossível entrar em
// laço) e a checagem volta a rodar quando o app é trazido pra frente ou quando a internet volta.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// ── 1. A trava não pode mais ser "uma vez por sessão" ───────────────────────────────────────
assert.ok(!/sessionStorage\.setItem\("vchk",\s*"1"\)/.test(app),
  'a trava "1x por sessão" não pode voltar: no app instalado ela vale pra sempre e congela a versão');
assert.match(app, /sessionStorage\.setItem\("vchk",\s*String\(cpVchkAgora\(\)\)\)/,
  'a marca da última checagem precisa ser o horário dela, não um "já checei" permanente');

// A trava de tempo precisa existir, ser curta o bastante pra pegar uma publicação do dia,
// e ainda assim impedir qualquer laço de recarregamento.
const intervalo = app.match(/const CP_VCHK_INTERVALO\s*=\s*([^;]+);/);
assert.ok(intervalo, 'não achei o intervalo mínimo entre duas checagens de versão');
const ms = Function(`"use strict";return (${intervalo[1]})`)();
assert.ok(ms >= 60 * 1000, `intervalo curto demais (${ms}ms): precisa segurar recarregamento em cadeia`);
assert.ok(ms <= 30 * 60 * 1000, `intervalo longo demais (${ms}ms): a atualização do dia não chegaria`);

assert.match(app, /const ultima = parseInt\(sessionStorage\.getItem\("vchk"\)[^\n]*\n\s*if\(ultima && \(cpVchkAgora\(\) - ultima\) < CP_VCHK_INTERVALO\) return;/,
  'a checagem precisa sair fora só quando a última foi há menos de um intervalo');

// ── 2. Voltar pro app e voltar a internet disparam a procura ────────────────────────────────
assert.match(app, /addEventListener\("visibilitychange", revisar\)/,
  'trazer o app pra frente precisa procurar versão nova — é o único momento que existe num app instalado');
assert.match(app, /addEventListener\("online", revisar\)/,
  'quando a internet volta, o app precisa procurar versão nova');

const revisar = app.match(/const revisar = \(\) => \{[\s\S]*?\};/);
assert.ok(revisar, 'não achei a função que refaz a procura por versão nova');
assert.match(revisar[0], /document\.visibilityState !== "visible"/,
  'a procura só roda com o app na frente — em segundo plano seria trabalho jogado fora');
assert.match(revisar[0], /reg\.update\(\)/, 'a procura precisa pedir ao service worker que se atualize também');
assert.match(revisar[0], /checarVersaoServidor\(\)/, 'a procura precisa comparar a versão da tela com a do servidor');

// ── 3. Nada disso pode atropelar uma conversa sendo importada ───────────────────────────────
// Recarregar no meio de uma importação perde o ZIP que veio do WhatsApp (a razão da guarda
// original). Ela continua valendo, antes de qualquer checagem.
const funcao = app.match(/async function checarVersaoServidor\(\)\{[\s\S]*?\n\}/);
assert.ok(funcao, 'não achei checarVersaoServidor');
const guarda = funcao[0].indexOf('__cpShareImportActive');
const travaTempo = funcao[0].indexOf('CP_VCHK_INTERVALO');
assert.ok(guarda > -1 && guarda < travaTempo,
  'a guarda da importação em andamento precisa continuar vindo antes de tudo');
assert.match(funcao[0], /state\?\.processing \|\| state\?\.pendingSharedRecordId/,
  'análise em andamento e compartilhamento pendente continuam segurando o recarregamento');

console.log('v1275-app-instalado-procura-versao-nova: ok');
