// v1241 — AUDITORIA DO DONO (13/08/2026).
//
// Ele mandou auditar o que eu tinha publicado (v1235–v1240) e a auditoria dele foi melhor que a
// minha: achou coisas que eu não achei e desmontou promessas que eu tinha escrito nas notas. A
// ordem de correção é dele, e é esta:
//
//   1. histórico integral
//   2. Cérebro como única autoridade comercial
//   3. Cérebro na posição final correta
//   4. prova de "quanto foi lido" 100% verdadeira
//   5. furo das frases proibidas
//   6. limites do Cérebro com aviso
//   7. documentação
//
// Este arquivo tranca os sete, na ordem, e cada bloco cita o defeito exato que ele descreveu.
import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain, detectarFrasesProibidas, limparFrasesProibidas } from "../api/_pipeline.js";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const claudeMd = fs.readFileSync(new URL("../CLAUDE.md", import.meta.url), "utf8");
const estadoAtual = fs.readFileSync(new URL("../ESTADO-ATUAL.md", import.meta.url), "utf8");

function iaFalsa(mensagens, capturar) {
  return { chat: { completions: { create: async (args) => {
    if (capturar) capturar({
      system: String(args?.messages?.find(m => m.role === "system")?.content || ""),
      user: String(args?.messages?.find(m => m.role === "user")?.content || "")
    });
    return { model: "gpt-teste", choices: [{ message: { content: JSON.stringify({ summary: "s", mensagens }) } }], usage: {} };
  } } } };
}
const TRIO_LIMPO = { recomendada: "Oi! Como ficou a colheita?", maisSuave: "Oi! Deu pra colher?", maisDireta: "Oi! Se colheu, retomo." };
const CEREBRO = { corretorNome: "Sanchai", metodo: "MEU METODO", tom: "MEU TOM", diferenciais: "", evitar: "", regras: [], objecoes: [] };
const SEM_CEREBRO = { corretorNome: "Sanchai", metodo: "", tom: "", diferenciais: "", evitar: "", regras: [], objecoes: [] };

// ══ 1. HISTÓRICO INTEGRAL ══════════════════════════════════════════════════════════════════
// "o sistema diz 'analise toda a conversa e siga o Cérebro', mas o código ainda pode esconder
// parte da conversa". Eram DOIS esconderijos: o modo incremental (resumo + só a novidade) e um
// teto técnico de 30.000 caracteres que cortava calado.
{
  const msgs = Array.from({ length: 300 }, (_, i) => ({
    date: "19/02/2026", time: "10:00", author: i % 2 ? "Cliente" : "Sanchai",
    text: `mensagem ${i} ` + "x".repeat(120)
  }));
  let capt = null;
  // (a) primeira análise de conversa longa: nada de corte
  const r1 = await analyzeWithBrain({ lead: { clientName: "C" }, timeline: msgs, openai: iaFalsa(TRIO_LIMPO, c => (capt = c)), cerebroConfig: CEREBRO });
  assert.equal((capt.user.match(/mensagem \d+/g) || []).length, 300, "as 300 mensagens precisam chegar na IA");
  assert.equal(r1.conversaLidaPelaIA.cortadaPorLimite, false, "conversa de 300 mensagens não pode mais ser cortada");

  // (b) REIMPORTAÇÃO com análise anterior: era aqui que o modo incremental escondia o passado
  const r2 = await analyzeWithBrain({
    lead: { clientName: "C" }, timeline: msgs, leadId: "x",
    contextoIncremental: { analiseAnterior: { summary: "antes", diagnostico: {}, messages: { a: "a", b: "b", c: "c" } }, assinaturasNovas: [] },
    openai: iaFalsa(TRIO_LIMPO, c => (capt = c)), cerebroConfig: CEREBRO
  });
  assert.equal((capt.user.match(/mensagem \d+/g) || []).length, 300,
    "reimportação também manda a conversa inteira — era o esconderijo principal");
  assert.equal(r2.conversaLidaPelaIA.modo, "conversa inteira");
  assert.doesNotMatch(capt.user, /RESUMO DO QUE JÁ FOI ANALISADO/, "nada de resumo no lugar da conversa");
}
assert.match(pipeline, /DIRECIONA_INCREMENTAL_MIN_CHARS \|\| Infinity/,
  "o modo incremental fica desligado por padrão (religável por variável de ambiente)");
assert.match(pipeline, /DIRECIONA_MAX_CONTEXT_CHARS \|\| 120000/,
  "o teto técnico precisa caber uma conversa de anos, não 30 mil caracteres");

// ══ 2. O CÉREBRO É A ÚNICA AUTORIDADE COMERCIAL ════════════════════════════════════════════
// "ficou bastante método comercial cravado em outro trecho do prompt... o Cérebro ganha em caso de
// conflito explícito, mas onde ele não disser nada, esse método paralelo continua decidindo."
{
  let comCerebro = null, contaNova = null;
  await analyzeWithBrain({ lead: { clientName: "C" }, timeline: [{ date: "19/02/2026", time: "17:12", author: "C", text: "x" }], openai: iaFalsa(TRIO_LIMPO, c => (comCerebro = c)), cerebroConfig: CEREBRO });
  await analyzeWithBrain({ lead: { clientName: "C" }, timeline: [{ date: "19/02/2026", time: "17:12", author: "C", text: "x" }], openai: iaFalsa(TRIO_LIMPO, c => (contaNova = c)), cerebroConfig: SEM_CEREBRO });

  const tudoComCerebro = comCerebro.system + comCerebro.user;
  for (const metodo of [
    /ÂNGULOS COMERCIAIS DIFERENTES/,        // o que cada uma das três deve fazer comercialmente
    /REGRA DURA/,                            // retomada / não repetir
    /CLIENTE JÁ DISSE SIM/,                  // como agir com permissão já dada
    /PERGUNTA DO CORRETOR SEM RESPOSTA/,     // como agir com pergunta sem resposta
    /PEDIDO SEM RESPOSTA DIRETA/,            // como tratar pedido sem resposta
    /TRÊS PEDIDOS DE LICENÇA/,
    /QUALIFICAR antes de empurrar produto/
  ]) {
    assert.doesNotMatch(tudoComCerebro, metodo,
      `quem tem Cérebro não pode receber método comercial do código: ${metodo}`);
  }
  // Nada foi destruído: continua tudo como ponto de partida de quem ainda não escreveu o dele.
  const tudoContaNova = contaNova.system + contaNova.user;
  for (const metodo of [/ÂNGULOS COMERCIAIS DIFERENTES/, /CLIENTE JÁ DISSE SIM/, /QUALIFICAR antes de empurrar produto/]) {
    assert.match(tudoContaNova, metodo, `conta nova continua recebendo o ponto de partida: ${metodo}`);
  }
  // O que FICA pra todo mundo é só o que protege o corretor e o que a tela precisa.
  assert.match(comCerebro.system, /NADA DE INVENTAR/, "não inventar vale sempre, mesmo que o Cérebro esqueça de dizer");
  assert.match(comCerebro.user, /TRÊS CAMINHOS PARA O MESMO "comoConduzir"/, "a regra de tela (três caminhos) continua");
}

// ══ 3. O CÉREBRO FECHA O PROMPT DE SISTEMA ═════════════════════════════════════════════════
// "depois do === FIM DO CÉREBRO === o sistema ainda pode inserir aprendizado, casos, mensagens
// reais e fatos... a descrição de que o Cérebro fecha o prompt é tecnicamente falsa." Era.
{
  let capt = null;
  await analyzeWithBrain({
    lead: { clientName: "C" },
    timeline: [{ date: "19/02/2026", time: "17:12", author: "Sanchai", text: "Bom dia, consegui duas opcoes" }, { date: "19/02/2026", time: "17:13", author: "C", text: "x" }],
    openai: iaFalsa(TRIO_LIMPO, c => (capt = c)), cerebroConfig: CEREBRO
  });
  const fimCerebro = capt.system.indexOf("=== FIM DO CÉREBRO COMERCIAL ===");
  assert.ok(fimCerebro > -1, "sanidade: o Cérebro está no prompt");
  for (const bloco of ["COMO ESTE CORRETOR ESCREVE", "FATOS ENSINADOS", "SEU JEITO"]) {
    const pos = capt.system.indexOf(bloco);
    if (pos > -1) assert.ok(pos < fimCerebro, `"${bloco}" precisa vir ANTES do Cérebro — ele é o último a falar`);
  }
  const depois = capt.system.slice(fimCerebro).replace("=== FIM DO CÉREBRO COMERCIAL ===", "");
  assert.doesNotMatch(depois, /=== /, "nenhum bloco novo pode ser aberto depois do Cérebro");
}

// ══ 4. A PROVA DE "QUANTO FOI LIDO" DIZ A VERDADE ══════════════════════════════════════════
// "a tela pode dizer que a IA leu a conversa inteira quando não leu... é um bug objetivo da prova
// que foi criada justamente para você conseguir conferir o que a IA leu." Estava certo.
{
  const gigante = Array.from({ length: 400 }, (_, i) => ({
    date: "19/02/2026", time: "10:00", author: "C", text: `m${i} ` + "y".repeat(400)
  }));
  const r = await analyzeWithBrain({ lead: { clientName: "C" }, timeline: gigante, openai: iaFalsa(TRIO_LIMPO), cerebroConfig: CEREBRO });
  const lida = r.conversaLidaPelaIA;
  assert.equal(lida.cortadaPorLimite, true, "conversa acima do teto técnico precisa ser marcada como cortada");
  assert.equal(lida.modo, "parte da conversa", 'cortada, o modo NÃO pode ser "conversa inteira"');
  assert.ok(lida.mensagensEnviadas < lida.totalDaConversa, "e os números precisam mostrar quantas de quantas foram");
  assert.equal(lida.mensagensEnviadas + lida.mensagensResumidas, lida.totalDaConversa, "a conta tem que fechar");
}

// ══ 5. FRASE PROIBIDA NÃO CHEGA NA TELA — SEM O FURO ═══════════════════════════════════════
// "limparFrasesProibidas() ... se tudo for eliminado, ela devolve o texto original. Portanto uma
// mensagem composta exclusivamente por algo proibido pode sobreviver justamente porque foi
// totalmente proibida." Era esse o furo, e havia até um teste MEU exigindo o furo.
assert.equal(limparFrasesProibidas("Fico à disposição.").trim(), "",
  "mensagem 100% clichê não pode voltar com o clichê intacto");
{
  // O caso completo: a releitura entrega versão limpa e curta; a original é só clichê e mais longa.
  let n = 0;
  const openai = { chat: { completions: { create: async () => {
    n++;
    const m = n === 1
      ? { recomendada: "Boa noite! Como ficou a colheita?", maisSuave: "Qualquer dúvida estou aqui, fico à disposição, espero ter ajudado.", maisDireta: "Boa noite! Retomo de onde paramos." }
      : { recomendada: "Boa noite! Como ficou a colheita?", maisSuave: "Me chama quando puder.", maisDireta: "Boa noite! Retomo de onde paramos." };
    return { model: "t", choices: [{ message: { content: JSON.stringify(n === 1 ? { summary: "s", mensagens: m } : { mensagens: m }) } }], usage: {} };
  } } } };
  const r = await analyzeWithBrain({ lead: { clientName: "C" }, timeline: [{ date: "19/02/2026", time: "17:12", author: "C", text: "x" }], openai, cerebroConfig: CEREBRO });
  for (const k of ["a", "b", "c"]) {
    assert.equal(detectarFrasesProibidas(r.messages[k]).proibidas.length, 0,
      `mensagem "${k}" chegou na tela com frase proibida — era o furo que a auditoria pegou`);
  }
  assert.equal(r.messages.b, "Me chama quando puder.",
    "havendo versão limpa, é ela que vai — nunca a mais longa só por ter mais palavras");
}
// Falso positivo que a auditoria também pegou: "a disposição DOS lotes" é vocabulário de imóvel.
assert.equal(detectarFrasesProibidas("Te mando a disposição dos lotes na quadra.").proibidas.length, 0,
  '"a disposição dos lotes" (o arranjo) não é o clichê "fico à disposição"');
assert.ok(detectarFrasesProibidas("Fico à disposição para o que precisar.").proibidas.length > 0,
  "o clichê de verdade continua sendo pego");
// Órfã: saiu do prompt na v1240 e nenhum código pegava.
assert.ok(detectarFrasesProibidas("Quis saber se você ainda pensa no apartamento.").proibidas.length > 0,
  '"quis saber se" ficou órfã na v1240 — precisa ser pega pelo código');
// Cumprimento auto-respondido: o detector acusava e o corte não fazia nada quando havia PONTO.
assert.equal(
  limparFrasesProibidas("Boa noite! Tudo bem? Tranquilo por aqui. Vi que você prefere aguardar."),
  "Boa noite! Tudo bem? Vi que você prefere aguardar.",
  "o auto-elogio some com ponto final, não só com vírgula");
// Espaço duplo/quebra de linha no meio do clichê não pode escapar do corte.
assert.equal(detectarFrasesProibidas(limparFrasesProibidas("Boa noite! Fico à  disposição para o que precisar.")).proibidas.length, 0,
  "clichê quebrado por espaço duplo precisa ser cortado, não só acusado");

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
  "e precisa registrar o histórico integral da v1241");

console.log("v1241-auditoria-do-dono: ok (7 itens da ordem do dono)");
