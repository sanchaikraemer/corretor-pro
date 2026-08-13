// v1241 — AUDITORIA DO DONO (13/08/2026), o que sobrou dela depois da v1247.
//
// A auditoria original tinha sete itens. Cinco deles (histórico integral, Cérebro como única
// autoridade, posição do Cérebro no prompt, prova de "quanto foi lido", corte determinístico de
// frase proibida) mexiam nas REGRAS DE PROMPT — e foi justamente esse pacote que o dono mandou
// desfazer na v1247 ("de ontem pra hoje está cada vez pior"). O histórico integral foi o único
// desses que ficou, e quem o guarda agora é o teste da v1222.
//
// Sobraram aqui os dois itens que não são regra de prompt e continuam valendo:
//   6. limites do Cérebro com aviso na tela antes de cortar
//   7. documentação não pode mandar o contrário do código
import fs from "node:fs";
import assert from "node:assert/strict";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const claudeMd = fs.readFileSync(new URL("../CLAUDE.md", import.meta.url), "utf8");
const estadoAtual = fs.readFileSync(new URL("../ESTADO-ATUAL.md", import.meta.url), "utf8");

// ══ 6. LIMITE DO CÉREBRO AVISA ANTES DE CORTAR ═════════════════════════════════════════════
// "alguém pode colar 25.000 caracteres, visualizar isso localmente e o banco ficar apenas com os
// primeiros 20.000, sem um aviso claro de que houve corte."
{
  const ini = app.indexOf("async function salvarCerebro()");
  const bloco = app.slice(ini, app.indexOf("sanitizeCerebroConfigV762(config)", ini));
  assert.match(bloco, /LIMITES_CEREBRO = \{ metodo:20000/, "os limites do servidor precisam ser conferidos na tela");
  assert.match(bloco, /regrasTexto:60000/, "regras e objeções têm limite próprio");
  assert.match(bloco, /cp903Confirm|confirm\(/, "tem que PERGUNTAR antes de salvar cortado");
  assert.match(bloco, /if \(!seguir\) return;/, "e não salvar se ele preferir encurtar");
  assert.match(bloco, /perde /, "o aviso precisa dizer quanto texto se perde");
}

// ══ 7. DOCUMENTAÇÃO QUE MANDAVA O CONTRÁRIO DO CÓDIGO ══════════════════════════════════════
// "documentação e código estão mandando fazer coisas opostas" — perigoso pra próxima sessão.
assert.match(claudeMd, /`construirMensagensDeterministicasCerebro` NÃO EXISTE MAIS e não pode voltar/,
  "o CLAUDE.md mandava usar um fallback que os testes proíbem");
assert.doesNotMatch(pipeline, /function construirMensagensDeterministicasCerebro/,
  "sanidade: o fallback realmente não existe");
assert.match(estadoAtual, /desde a \*\*v1221\*\*,\s*\nreimportar SEMPRE reanalisa/,
  "o ESTADO-ATUAL dizia que reimportação sem novidade reaproveita a análise — foi revogado na v1221");
assert.match(estadoAtual, /a conversa vai \*\*inteira\*\* para a IA/,
  "e precisa registrar o histórico integral");

console.log("v1241-auditoria-do-dono: ok (limites do Cérebro + documentação)");
