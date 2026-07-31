import fs from "node:fs";
import assert from "node:assert/strict";
import { sanitizeCerebroConfig, CEREBRO_DEFAULTS } from "../api/cerebro-config.js";

// v1012 — duas dores relatadas pelo dono num sábado:
//   1) o sino avisou "34 atendimentos esperam por você na segunda" — 34 era o backlog
//      inteiro, mas na segunda a tela só entrega a dose do dia (10). O aviso precisa ser
//      min(meta, fila), a mesma conta do card "Fazer agora".
//   2) a meta de 10 por dia era cravada no código (CP_DOSE_DIA) — mas cada corretor do
//      SaaS pode querer 5, 15... Virou o campo "Atendimentos por dia" do Cérebro Comercial.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// --- servidor: o campo existe, tem default 10 e é clampado em 1–50 ------------------
assert.equal(CEREBRO_DEFAULTS.atendimentosPorDia, 10, "default do servidor precisa ser 10");
assert.equal(sanitizeCerebroConfig({}).atendimentosPorDia, 10, "sem valor → 10");
assert.equal(sanitizeCerebroConfig({ atendimentosPorDia: 5 }).atendimentosPorDia, 5, "5 por dia vale");
assert.equal(sanitizeCerebroConfig({ atendimentosPorDia: "15" }).atendimentosPorDia, 15, "string numérica vale");
assert.equal(sanitizeCerebroConfig({ atendimentosPorDia: 0 }).atendimentosPorDia, 10, "0 → volta pro padrão");
assert.equal(sanitizeCerebroConfig({ atendimentosPorDia: 200 }).atendimentosPorDia, 10, "fora do teto (50) → padrão");
assert.equal(sanitizeCerebroConfig({ atendimentosPorDia: "abc" }).atendimentosPorDia, 10, "lixo → padrão");
// o save padrão da rota também precisa gravar o campo (senão o GET devolve sempre 10)
const cerebroApi = fs.readFileSync(new URL("../api/cerebro-config.js", import.meta.url), "utf8");
assert.match(cerebroApi, /atendimentosPorDia: clampAtendimentosDia\(body\.atendimentosPorDia\)/,
  "o save padrão da rota precisa persistir atendimentosPorDia");

// --- formulário do Cérebro: campo novo, carregado e salvo ---------------------------
assert.match(html, /id="cerebroAtendimentosDia"[^>]*min="1"[^>]*max="50"/,
  "index.html precisa do campo Atendimentos por dia (1 a 50) no Cérebro");
assert.match(app, /atendimentosPorDia: \(Number\(c\.atendimentosPorDia\) >= 1 && Number\(c\.atendimentosPorDia\) <= 50\)/,
  "sanitizeCerebroConfigV762 precisa aceitar/clampar atendimentosPorDia");
assert.match(app, /qs\("#cerebroAtendimentosDia"\)/, "o formulário precisa ler/preencher o campo novo");
assert.match(app, /atendimentosPorDia: \(Number\.isFinite\(atendN\) && atendN >= 1 && atendN <= 50\)/,
  "salvarCerebro precisa enviar o campo pro banco");

// --- a meta deixa de ser cravada: helper + usos -------------------------------------
assert.match(app, /function cpMetaAtendimentosDia\(\)/, "precisa existir o helper da meta configurável");
assert.match(app, /window\.cpMetaAtendimentosDia = cpMetaAtendimentosDia/, "helper exposto pro restante do app");
assert.match(app, /cpFimDeSemana\(\) \? 0 : Math\.max\(0, cpMetaAtendimentosDia\(\) - cpAtendidosHojeTotal\(items\)\)/,
  "cpFazerAgoraDose precisa usar a meta do corretor, não CP_DOSE_DIA fixo");
// v1073/v1075 — as gerações antigas saíram e a própria tela Condução foi deletada; a visão
// viva é a lista "Fazer agora" da Home (abrirFazerAgora), que fatia a fila pela dose do dia
// (cpFazerAgoraDose = meta configurável menos atendidos hoje — checada acima).
assert.match(app, /const restante=cpFazerAgoraDose\(ativos\);/,
  "a lista Fazer agora calcula a dose pela meta do corretor (cpFazerAgoraDose)");
assert.match(app, /const dose=fila\.slice\(0, mostrar\);/,
  "a lista Fazer agora fatia a fila pela dose do dia");

// o helper NÃO pode ler de state.cerebroCfg (nunca é preenchido em runtime) — tem que
// vir da mesma fonte da análise (obterCerebroConfigParaAnalise → localStorage/form).
const helperSrc = app.slice(app.indexOf("function cpMetaAtendimentosDia()"), app.indexOf("function cpFazerAgoraDose"));
assert.ok(helperSrc.includes("obterCerebroConfigParaAnalise"), "meta precisa vir da config real (localStorage/form)");
assert.ok(!helperSrc.includes("state.cerebroCfg"), "meta não pode depender de state.cerebroCfg (nunca é atribuído)");

// --- o sino nunca promete mais que a dose do dia ------------------------------------
const iniPanel = app.indexOf("function openNotifyPanel()");
const panelSrc = app.slice(iniPanel, iniPanel + 3000);
// v1084 — o aviso do sino era min(META CRUA, backlog inteiro). A meta crua não desconta quem já
// foi atendido hoje, e o backlog não é a fila. Depois de bater a meta o sino dizia "10
// atendimentos pedem ação" e o toque abria "Você já bateu a meta de hoje". Agora ele usa
// exatamente as mesmas duas funções da lista que ele abre: min(cpFilaFazerAgora, cpFazerAgoraDose).
assert.ok(panelSrc.includes("cpFilaFazerAgora(ativosSino)"), "o sino precisa medir a fila real do Fazer agora");
assert.ok(panelSrc.includes("cpFazerAgoraDose(ativosSino)"), "o sino precisa usar a dose que já desconta os atendidos de hoje");
assert.ok(panelSrc.includes("Math.min(filaSino.length, doseSino)"), "o aviso do sino precisa ser min(fila, dose)");
assert.match(panelSrc, /por você na segunda/, "o texto de fim de semana continua existindo");
assert.ok(!/\$\{d\.agora\}\s*atendimento/.test(panelSrc), "o sino não pode mais mostrar o backlog inteiro (d.agora cru)");

console.log("v1012-meta-atendimentos-por-corretor: ok");
