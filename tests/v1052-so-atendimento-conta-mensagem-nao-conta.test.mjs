import fs from "node:fs";
import assert from "node:assert/strict";
// v1337 — o fuso do app saiu de 35 literais "America/Sao_Paulo" e virou cpFuso(). Este import
// entrega as funções REAIS de fuso do app.js pros trechos que este teste roda com eval.
import "./_fuso-do-app.mjs";

// v1052 — a v1051 tentou fazer a data da última mensagem também contar pro "descanso" pós-
// atendimento (só pra reforçar a proteção, nunca afrouxar), depois de um caso real ("Karine")
// onde isso pareceu necessário. O dono viu a explicação e decidiu simplificar: "esquece 2
// regras, vamos usar uma só, que é de marcar atendimento, esquece a data da última msg." —
// ou seja, o descanso configurado no Cérebro conta EXCLUSIVAMENTE a partir de quando o corretor
// registra atendimento no app (Marcar atendimento, copiar sugestão, ligação, visita, observação,
// proposta) — a data da última mensagem trocada não entra nessa conta de jeito nenhum, nem pra
// ajudar nem pra atrapalhar. Volta a ser exatamente a regra da v1018.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const janela = app.match(/function emJanelaDeEspera\(l\)\{[\s\S]*?\n\}/)[0];
const janelaSemComentarios = janela.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

assert.doesNotMatch(janelaSemComentarios, /daysSinceLastTouch|daysSinceClientReply|daysSinceLastInteraction|diasMsg/,
  "o código de emJanelaDeEspera não pode usar nenhum campo de mensagem — só ultimoAtendimentoTs");
assert.match(janela, /ultimoAtendimentoTs\(l\)/, "emJanelaDeEspera precisa continuar usando ultimoAtendimentoTs como única fonte");

// A tentativa da v1051 (o teste dedicado que comprovava "mensagem só reforça, nunca afrouxa")
// não existe mais — essa regra foi abandonada de propósito.
assert.ok(!fs.existsSync(new URL("../tests/v1051-mensagem-reforca-descanso-nunca-afrouxa.test.mjs", import.meta.url)),
  "o teste da tentativa da v1051 precisa ter sido removido — a regra foi abandonada, não é só desativada");

// --- comportamento real: mensagem recente NÃO estende a proteção além do atendimento sozinho ---
const diasCalSrc = app.match(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/)[0];
const tiposSrc = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/)[0];
const ultAtSrc = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0];
const lembTsSrc = app.match(/function lembreteTs\(l\)\{[\s\S]*?\n\}/)[0];
const lembVencSrc = app.match(/function lembreteVencido\(l\)\{[^\n]*\}/)[0];
const diasDescansoSrc = app.match(/function cpDiasDescansoPosAtendimento\(\)\{[\s\S]*?\n\}/)[0];
const limiarSrc = app.match(/function limiarRetomada\(l\)\{[\s\S]*?\n\}/)[0];

const emJanelaDeEspera = eval(`
  const obterCerebroConfigParaAnalise = () => ({ diasDescansoPosAtendimento: 7 });
  ${diasCalSrc}
  ${tiposSrc}
  ${ultAtSrc}
  ${lembTsSrc}
  ${lembVencSrc}
  ${diasDescansoSrc}
  ${limiarSrc}
  ${janela}
  emJanelaDeEspera
`);

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

// Caso "Karine" (v1051), agora com a regra única: atendimento marcado há 10 dias (> 7
// configurados) — não protege mais, MESMO com mensagem recente (5 dias). A data da mensagem é
// completamente ignorada, exatamente como o dono pediu.
const karine = {
  daysSinceLastTouch: 5,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(10) }
  ] } }
};
assert.equal(emJanelaDeEspera(karine), false,
  "com a regra única (v1052), atendimento de 10 dias (> 7 configurados) libera o lead, mesmo com mensagem de 5 dias atrás — a mensagem é ignorada de propósito");

// Se o atendimento estiver dentro do prazo, continua protegido — independente de qualquer coisa
// no campo de mensagem (mesmo ausente, ou muito mais antigo).
const dentroDoPrazo = {
  daysSinceLastTouch: 50,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(3) }
  ] } }
};
assert.equal(emJanelaDeEspera(dentroDoPrazo), true,
  "atendimento de 3 dias (dentro dos 7 configurados) protege, mesmo com mensagem de 50 dias atrás — só o atendimento importa");

console.log("v1052-so-atendimento-conta-mensagem-nao-conta: ok");
