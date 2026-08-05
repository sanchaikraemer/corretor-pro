import fs from "node:fs";
import assert from "node:assert/strict";
import { sanitizeCerebroConfig, CEREBRO_DEFAULTS } from "../api/cerebro-config.js";

// v1139 — três decisões do dono numa rodada só (a conversa começou com ele perguntando "por que
// cada um desses está na lista de prioridades?"):
//   1) RESGATES POR DIA: "pode deixar um número por dia para resgate configurável no cérebro —
//      como tem atendimento por dia, crie resgates por dia". Dentro da dose diária do "Fazer
//      agora", as últimas N vagas são de quem está há mais tempo sem atendimento (nunca
//      contatado primeiro, depois o contato mais antigo — mesma régua do card "Sem atender
//      30d+"), pra ninguém cair no esquecimento numa carteira grande.
//   2) RÉGUA ÚNICA DE 90 DIAS no ranking: a barrinha da Home já contava só os últimos 90 dias
//      (v1017), mas a ORDEM contava a conversa inteira desde sempre — papo de proposta de meses
//      atrás pesava como negociação ativa e um lead com barra "2" aparecia acima de um com "36".
//      Agora tela e ordem contam a mesma história; quem esfriou volta pelo resgate diário.
//   3) "Pular próximo" REMOVIDO: "nunca pulei ninguém... tô até achando isso obsoleto e
//      desnecessário... empurrar atendimento pra frente é coisa de preguiçoso".

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const persistence = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");
const cerebroApi = fs.readFileSync(new URL("../api/cerebro-config.js", import.meta.url), "utf8");

// ── 1. "Resgates por dia" configurável (0 é escolha VÁLIDA = desliga; vazio = padrão 2) ───────
assert.equal(CEREBRO_DEFAULTS.resgatesPorDia, 2, "default do servidor precisa ser 2");
assert.equal(sanitizeCerebroConfig({}).resgatesPorDia, 2, "sem valor → 2");
assert.equal(sanitizeCerebroConfig({ resgatesPorDia: 0 }).resgatesPorDia, 0, "0 é escolha válida (desliga o resgate)");
assert.equal(sanitizeCerebroConfig({ resgatesPorDia: "4" }).resgatesPorDia, 4, "string numérica vale");
assert.equal(sanitizeCerebroConfig({ resgatesPorDia: 99 }).resgatesPorDia, 2, "fora do teto (20) → padrão");
assert.equal(sanitizeCerebroConfig({ resgatesPorDia: "" }).resgatesPorDia, 2, "vazio → padrão (nunca vira 0 sozinho)");
assert.equal(sanitizeCerebroConfig({ resgatesPorDia: "abc" }).resgatesPorDia, 2, "lixo → padrão");
assert.match(cerebroApi, /resgatesPorDia: clampResgatesDia\(body\.resgatesPorDia\)/,
  "o save padrão da rota precisa persistir resgatesPorDia");
assert.match(html, /id="cerebroResgatesDia"[^>]*min="0"[^>]*max="20"/,
  "index.html precisa do campo Resgates por dia (0 a 20) no Cérebro");
assert.match(app, /resgatesPorDia: \(Number\.isFinite\(resgN\) && resgN >= 0 && resgN <= 20\)/,
  "salvarCerebro precisa enviar o campo pro banco");
assert.match(app, /resgatesPorDia: cpLerResgatesDiaDoFormulario\(cfg\)/,
  "obterCerebroConfigParaAnalise precisa ler o campo sem esmagar o 0");
assert.match(app, /Number\(anterior\.resgatesPorDia\) !== Number\(fresco\.resgatesPorDia\)/,
  "mudar os resgates em outro aparelho precisa re-renderizar a Home (sync inicial)");

// Campo vazio não pode virar 0 (0 desliga de propósito; vazio = vale o que está salvo).
const lerResgSrc = app.match(/function cpLerResgatesDiaDoFormulario\(cfg\)\{[\s\S]*?\n\}/)[0];
const lerResg = eval(`(function(){ const qs = () => ({ value: "" }); ${lerResgSrc}; return cpLerResgatesDiaDoFormulario; })()`);
assert.equal(lerResg({ resgatesPorDia: 0 }), 0, "campo vazio + 0 salvo = continua 0");
assert.equal(lerResg(null), 2, "campo vazio sem nada salvo = padrão 2");

// ── 2. O resgate REORDENA a fila: fim da dose com os mais esquecidos ──────────────────────────
const aplicarSrc = app.match(/function cpAplicarResgatesNaFila\(fila, vagas, resgates\)\{[\s\S]*?\n\}/)[0];
const cpAplicarResgatesNaFila = eval(`
  const cpUltimoContatoCorretorTs = (l) => Number(l.__ts || 0);
  ${aplicarSrc}
  cpAplicarResgatesNaFila;
`);
// Fila já ordenada por probabilidade (a→f). Vagas 4, sendo 2 de resgate:
// topo = 2 mais quentes; resgates = nunca contatado primeiro (d), depois contato mais antigo (e).
const fila = [
  { id: "a", __ts: 500 }, { id: "b", __ts: 400 }, { id: "c", __ts: 300 },
  { id: "d", __ts: 0 }, { id: "e", __ts: 100 }, { id: "f", __ts: 200 }
];
const reordenada = cpAplicarResgatesNaFila(fila, 4, 2);
assert.deepEqual(reordenada.map(l => l.id), ["a", "b", "d", "e", "c", "f"],
  "dose = quentes (a,b) + resgatados (d nunca contatado, e mais antigo); o resto mantém a ordem");
assert.equal(reordenada.length, fila.length, "reordenar não tira nem põe ninguém");
assert.deepEqual(cpAplicarResgatesNaFila(fila, 4, 0).map(l => l.id), ["a", "b", "c", "d", "e", "f"],
  "resgates 0 = fila intocada (desligado)");
assert.deepEqual(cpAplicarResgatesNaFila(fila, 10, 2).map(l => l.id), ["a", "b", "c", "d", "e", "f"],
  "fila inteira já cabe nas vagas do dia = não há o que resgatar");
assert.equal(cpAplicarResgatesNaFila(fila, 2, 5).length, 6, "resgates além das vagas não quebra (limita nas vagas)");

// As TELAS usam a fila com resgate (Home e a lista do card), sempre a MESMA.
assert.match(app, /let filaRanqueada = typeof cpFilaFazerAgoraComResgates === 'function' \? cpFilaFazerAgoraComResgates\(items\)/,
  "a Home precisa usar a fila com resgates");
assert.match(app, /const fila=\(typeof cpFilaFazerAgoraComResgates==='function'\)\?cpFilaFazerAgoraComResgates\(ativos\):cpFilaFazerAgora\(ativos\);/,
  "a lista do card Fazer agora precisa usar a MESMA fila com resgates da Home");
assert.match(app, /window\.cpFilaFazerAgoraComResgates = cpFilaFazerAgoraComResgates/,
  "wrapper exposto pro restante do app");

// ── 3. Régua única de 90 dias no ranking ──────────────────────────────────────────────────────
const fnProb = app.match(/function cpProbabilidadeFechamento\(l\)\{[\s\S]*?\n\}/)[0];
const montarProb = (ctx) => eval(`
  const mensagensDoCliente = (l) => Number(l.__msgs || 0);
  const mensagensDoClienteRecente = (l) => Number(l.__msgs90 ?? l.__msgs ?? 0);
  const contextoPrioridadeIA = (l) => (${ctx});
  const ultimaMsgClientePedeResposta = () => false;
  ${fnProb}
  cpProbabilidadeFechamento;
`);
const probComNegociacao = montarProb("({ propostaAtiva: true, retornoProposta: true })");
const probSemNegociacao = montarProb("({})");
const base = { __msgs: 10, __msgs90: 0, clientMessageDays90d: 0, clientMessageDays: 12, clientQuestionCount90d: 0, clientQuestionCount: 8 };

// Mesmo lead: ativo nos últimos 90 dias pontua acima da própria versão esfriada.
const esfriado = probComNegociacao({ ...base, daysSinceClientReply: 120 });
const ativo = probComNegociacao({ ...base, __msgs90: 10, clientMessageDays90d: 12, clientQuestionCount90d: 8, daysSinceClientReply: 10 });
assert.ok(ativo > esfriado, "cliente ativo nos 90 dias precisa pontuar acima do mesmo lead esfriado");

// Negociação vem de TEXTO (sem data): com o cliente calado há mais de 90 dias, não soma nada.
assert.equal(probComNegociacao({ ...base, daysSinceClientReply: 120 }), probSemNegociacao({ ...base, daysSinceClientReply: 120 }),
  "proposta/retorno no texto NÃO somam com o cliente calado há mais de 90 dias");
assert.ok(probComNegociacao({ ...base, daysSinceClientReply: 10 }) > probSemNegociacao({ ...base, daysSinceClientReply: 10 }),
  "com o cliente ativo, o sinal de negociação continua somando (+35/+70)");

// Dado antigo em cache (sem os campos 90d) cai nos TOTAIS históricos — nunca em zero.
const semCampos90 = probSemNegociacao({ __msgs: 10, clientMessageDays: 12, clientQuestionCount: 8 });
const comCampos90Zerados = probSemNegociacao({ ...base });
assert.ok(semCampos90 > comCampos90Zerados,
  "sem os campos novos, valem os totais históricos (fallback) — não zero");

// Servidor: os campos 90d saem da MESMA varredura e vão pro cache e pra resposta.
assert.match(persistence, /clientQuestionCount90d = 0;/, "servidor conta perguntas dos últimos 90 dias");
assert.match(persistence, /const _diasComMsg90d = new Set\(\);/, "servidor rastreia dias distintos dos últimos 90 dias");
assert.match(persistence, /clientMessageDays90d = _diasComMsg90d\.size;/, "recorrência 90d calculada na varredura");
assert.match(persistence, /clientQuestionCount90d, clientMessageDays90d, hasProposal,/, "campos novos gravados no _statsCache");
assert.match(persistence, /clientQuestionCount90d: Number\.isFinite/, "resposta manda perguntas 90d (null quando o cache é antigo)");
assert.match(persistence, /clientMessageDays90d: Number\.isFinite/, "resposta manda recorrência 90d (null quando o cache é antigo)");

// ── 4. "Pular próximo" removido de vez ────────────────────────────────────────────────────────
assert.ok(!app.includes("pularProximo()"), "não pode sobrar chamada do pularProximo");
assert.ok(!app.includes("Pular próximo</button>"), "não pode sobrar o botão na tela");
assert.ok(!app.includes("state.pulados instanceof Set"), "state.pulados morreu junto com o botão");
assert.ok(!css.includes(".seq-link{"), "o CSS do botão foi removido junto");

console.log("v1139-resgates-por-dia-e-regua-90-dias: ok");
