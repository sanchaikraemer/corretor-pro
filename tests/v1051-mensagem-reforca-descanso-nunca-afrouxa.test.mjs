import fs from "node:fs";
import assert from "node:assert/strict";

// v1051 — caso real "Karine": marcada como atendida no app, mas depois trocou mensagens com o
// dono pelo WhatsApp direto (sem passar pelo botão "Copiar" do app) — o app não reconhecia isso
// como toque nenhum, então mesmo com "Descanso após atender" configurado pra 7 dias (v1048), ela
// reapareceu na fila "Fazer agora" com só 5 dias contados (a partir só do clique antigo de
// "Marcar atendimento", ignorando a troca de mensagem mais recente). O dono foi taxativo: "7
// dias é 7 e ponto final, não pode aparecer com menos que isso".
//
// A correção faz emJanelaDeEspera considerar TAMBÉM a interação mais recente (mensagem, de
// qualquer lado — inclusive uma mensagem digitada pelo próprio corretor direto no WhatsApp,
// fora do botão "Copiar"), mas SÓ pra reforçar a proteção — usa sempre o toque MAIS recente
// entre atendimento e mensagem, nunca o mais antigo. Isso garante matematicamente que o número
// configurado no Cérebro é sempre o MÍNIMO de dias de proteção, nunca menos — sem reabrir o bug
// que a v1018 corrigiu (mensagem AFROUXANDO uma proteção que já devia valer).

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const diasCalSrc = app.match(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/)[0];
const tiposSrc = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/)[0];
const ultAtSrc = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0];
const lembTsSrc = app.match(/function lembreteTs\(l\)\{[\s\S]*?\n\}/)[0];
const lembVencSrc = app.match(/function lembreteVencido\(l\)\{[^\n]*\}/)[0];
const diasDescansoSrc = app.match(/function cpDiasDescansoPosAtendimento\(\)\{[\s\S]*?\n\}/)[0];
const limiarSrc = app.match(/function limiarRetomada\(l\)\{[\s\S]*?\n\}/)[0];
const janelaSrc = app.match(/function emJanelaDeEspera\(l\)\{[\s\S]*?\n\}/)[0];

function montarEmJanelaDeEspera(diasConfigurados) {
  return eval(`
    const obterCerebroConfigParaAnalise = () => (${diasConfigurados == null ? "null" : `{ diasDescansoPosAtendimento: ${diasConfigurados} }`});
    ${diasCalSrc}
    ${tiposSrc}
    ${ultAtSrc}
    ${lembTsSrc}
    ${lembVencSrc}
    ${diasDescansoSrc}
    ${limiarSrc}
    ${janelaSrc}
    emJanelaDeEspera
  `);
}

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

// Karine: descanso configurado em 7 dias no Cérebro. Atendimento marcado (botão) há 10 dias —
// sozinho já não protegeria mais (10 > 7). Mas trocou mensagem com o dono há 5 dias (menos que
// os 7 configurados) — essa mensagem PRECISA manter ela protegida até completar os 7 dias reais.
const karine = () => ({
  daysSinceLastTouch: 5,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(10) }
  ] } }
});
assert.equal(montarEmJanelaDeEspera(7)(karine()), true,
  "Karine: atendimento de 10 dias sozinho não protegeria, mas a mensagem de 5 dias atrás PRECISA manter a proteção (7 configurados, ainda dentro do prazo)");

// Se a mensagem também já passou dos 7 dias configurados, aí sim libera — a regra dos 7 dias
// continua sendo respeitada em cima do toque mais recente, não é uma proteção eterna.
const karineMsgVelha = () => ({
  daysSinceLastTouch: 8,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(10) }
  ] } }
});
assert.equal(montarEmJanelaDeEspera(7)(karineMsgVelha()), false,
  "se a mensagem também já passou dos 7 dias configurados, o lead volta a ficar elegível normalmente");

// Propriedade matemática de segurança: pra qualquer combinação de dias de atendimento/mensagem e
// qualquer descanso configurado, considerar a mensagem NUNCA pode LIBERAR um lead que o
// atendimento sozinho já protegeria (só pode proteger IGUAL ou MAIS, nunca menos) — evita reabrir
// o bug que a v1018 corrigiu (Rafael/Adão reaparecendo cedo demais).
for (const config of [3, 5, 7, 10]) {
  for (const diasAtendimento of [1, 3, 5, 7, 10, 15]) {
    for (const diasMsg of [0, 1, 3, 5, 7, 10, 20]) {
      const semMensagem = montarEmJanelaDeEspera(config)({
        analysis: { aprendizado: { eventos: [
          { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(diasAtendimento) }
        ] } }
      });
      const comMensagem = montarEmJanelaDeEspera(config)({
        daysSinceLastTouch: diasMsg,
        analysis: { aprendizado: { eventos: [
          { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(diasAtendimento) }
        ] } }
      });
      if (semMensagem === true) {
        assert.equal(comMensagem, true,
          `config=${config} atendimento=${diasAtendimento}d msg=${diasMsg}d: se já estava protegido sem a mensagem, considerar a mensagem não pode desproteger`);
      }
    }
  }
}

console.log("v1051-mensagem-reforca-descanso-nunca-afrouxa: ok");
