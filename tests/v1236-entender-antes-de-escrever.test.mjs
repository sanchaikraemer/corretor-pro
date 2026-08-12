// v1236 — "me parece q ele nao lê historico e tenta entender pra sugerir acao apos as regras do
// cerebro. me parece q inventa 3 coisas aleatórias sem pensar" (dono, 12/08/2026).
//
// Ele estava lendo o sintoma certo. A conversa CHEGA inteira na IA (o corte por tamanho só vale
// acima de 30.000 caracteres, e a conversa dele tem uns 7.000) — o problema era a ORDEM em que a
// IA era obrigada a responder: o campo "mensagens" vinha ANTES de "etapaSugerida" e "nextAction".
// Ou seja, o sistema mandava escrever as três sugestões e SÓ DEPOIS dizer qual era o próximo passo.
// Escrever a conclusão antes de pensar é exatamente o que produz "3 coisas aleatórias".
//
// Agora a ordem é: ler → diagnosticar → decidir o próximo passo → e só então escrever as três, que
// precisam ser TRÊS CAMINHOS para esse mesmo passo. Sem nenhum campo novo: o conserto é de ORDEM,
// usando os campos que a tela já mostra — a regra da v1145 continua de pé.
import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain, detectarFrasesProibidas } from "../api/_pipeline.js";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");

// ── 1) "faz sentido" é proibição dura de novo, sem exceção ──────────────────────────────────
// v1235 tinha afrouxado por leitura errada de um exemplo. O dono desfez: "não quero a expressão
// 'faz sentido', já disse mil vezes."
for (const frase of [
  "Me diz se faz sentido seguir nessa linha",
  "Ainda faz sentido a ideia de pegar um apartamento na planta?",
  "Se fizer sentido, a gente marca",
  "Achei que fazia sentido te mostrar"
]) {
  assert.ok(detectarFrasesProibidas(frase).proibidas.some(p => /sentido/.test(p)),
    `"faz sentido" tem que ser barrado: "${frase}"`);
}
assert.ok(!/"faz sentido"/.test(pipeline.slice(
  pipeline.indexOf("const EXPRESSOES_SUSPEITAS_MENSAGEM"),
  pipeline.indexOf("];", pipeline.indexOf("const EXPRESSOES_SUSPEITAS_MENSAGEM")))),
  '"faz sentido" não pode continuar na lista branda');

// ── 2) A ordem do JSON pedido: entender primeiro, escrever por último ───────────────────────
// Nenhum campo NOVO foi criado pra isso — a regra da v1145 ("se não aparece na tela, não precisa
// existir") continua valendo à risca. O conserto é de ORDEM: os campos que a tela já mostra
// (último compromisso do cliente, pedido sem resposta, impedimento, próximo passo) passaram a ser
// escritos ANTES das mensagens, em vez de depois.
const formato = pipeline.slice(
  pipeline.indexOf("Formato JSON obrigatório:"),
  pipeline.indexOf("CONVERSA COMPLETA:", pipeline.indexOf("Formato JSON obrigatório:")));
assert.ok(formato.length > 100, "bloco do formato JSON não encontrado");

const posDiagnostico = formato.indexOf('"diagnostico"');
const posProximo = formato.indexOf('"nextAction"');
const posMensagens = formato.indexOf('"mensagens"');
assert.ok(posDiagnostico > -1 && posProximo > -1 && posMensagens > -1, "sanidade: os três campos existem no pedido");
assert.ok(posDiagnostico < posProximo, "o diagnóstico da conversa vem ANTES de decidir o próximo passo");
assert.ok(posProximo < posMensagens,
  "decidir o próximo passo vem ANTES de escrever as mensagens — era exatamente o contrário, e é isso que produzia 3 sugestões aleatórias");
assert.equal(posMensagens, Math.max(posDiagnostico, posProximo, posMensagens),
  "as três mensagens têm que ser o ÚLTIMO campo — são a conclusão da leitura, não o começo");

// A regra da v1145 é "se não aparece na tela, não precisa existir". Na v1236 eu cumpri isso
// APAGANDO o raciocínio da IA — e o dono depois cravou que a análise da conversa é o que mais
// importa e o que menos estava sendo feito. A saída certa não era apagar o raciocínio: era
// MOSTRÁ-LO. Na v1239 a leitura da conversa voltou ao pedido e aparece na tela, no bloco "Como
// conduzir este atendimento". Então o que este teste tranca agora é a regra de verdade: campo
// pedido à IA tem que ter destino na tela.
const appSrc = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
if (formato.includes('"leituraDaConversa"')) {
  assert.match(appSrc, /function cp704ConducaoHtml\(lead\)\{/,
    "se a leitura da conversa é pedida à IA, ela PRECISA aparecer na tela (regra da v1145)");
  assert.match(appSrc, /\$\{cp704ConducaoHtml\(lead\)\}/,
    "o bloco da condução precisa estar montado na tela do lead, não só definido");
}

// A instrução que explica POR QUE a ordem importa precisa estar escrita.
// v1239 — o texto foi reescrito quando a leitura da conversa virou o primeiro trabalho; o que
// este teste protege (pensar antes de escrever) continua igual, só mudou a redação.
assert.match(pipeline, /O TRABALHO É ESTE: LER A CONVERSA INTEIRA E DECIDIR COMO CONDUZIR ESTE ATENDIMENTO/,
  "a tarefa principal precisa ser ler a conversa e decidir a condução");
assert.match(pipeline, /Primeiro leia e decida; só depois escreva/,
  "a ordem 'pensar antes de escrever' precisa continuar escrita no pedido");
assert.match(pipeline, /AS TRÊS MENSAGENS EXECUTAM "comoConduzir"/,
  "as três mensagens precisam executar a condução, não virar três assuntos diferentes");
assert.match(pipeline, /conduzir é PERGUNTAR COMO AQUILO FICOU/,
  "quando o cliente condicionou a decisão a algo da vida dele, conduzir é perguntar como ficou");

// ── 3) A releitura continua no MESMO passo que a análise decidiu ────────────────────────────
// Sem isso, a reescrita conserta o clichê mas troca o assunto — e o corretor recebe outra coisa.
{
  let n = 0;
  const prompts = [];
  const openai = { chat: { completions: { create: async (args) => {
    n++;
    prompts.push(String(args?.messages?.find(m => m.role === "user")?.content || ""));
    return {
      model: "gpt-teste",
      choices: [{ message: { content: JSON.stringify(n === 1 ? {
        summary: "s",
        diagnostico: { ultimoCompromissoCliente: "Ver o resultado da colheita antes de decidir" },
        nextAction: "Perguntar como ficou a colheita antes de retomar a simulação",
        mensagens: {
          recomendada: "Boa noite! Me diz se faz sentido seguir nessa linha.",
          maisSuave: "Boa noite! Fico à disposição.",
          maisDireta: "Boa noite! Separei agora a simulação."
        }
      } : {
        mensagens: {
          recomendada: "Boa noite! Como ficou a colheita por aí?",
          maisSuave: "Boa noite! Você ia ver a colheita antes de decidir — deu pra fechar?",
          maisDireta: "Boa noite! Se a colheita já fechou, preparo a simulação com as duas vagas."
        }
      }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 10 }
    };
  } } } };

  const r = await analyzeWithBrain({
    lead: { clientName: "Cliente" },
    timeline: [{ date: "19/02/2026", time: "17:12", author: "Cliente", text: "tenho que ver da minha colheita, daí eu te procuro" }],
    openai,
    cerebroConfig: { corretorNome: "Sanchai", metodo: "Consultivo", tom: "Direto", diferenciais: "", evitar: "", regras: [], objecoes: [] }
  });

  assert.equal(n, 2, "trio com clichê tem que disparar a releitura");
  const pedidoDaReleitura = prompts[1] || "";
  // v1239 — o que manda na releitura passou a ser a CONDUÇÃO decidida na leitura da conversa
  // (antes era o "próximo passo" solto). Mesma garantia: a reescrita não escolhe outro assunto.
  assert.match(pedidoDaReleitura, /A CONDUÇÃO desta conversa, decidida nesta mesma análise, é: Perguntar como ficou a colheita/,
    "a releitura precisa receber a condução que a análise já decidiu");
  assert.match(pedidoDaReleitura, /A condição que o PRÓPRIO CLIENTE colocou foi: Ver o resultado da colheita/,
    "a releitura precisa receber a condição que o cliente colocou");
  assert.match(pedidoDaReleitura, /EXECUTAR essa condução/,
    "a releitura não pode trocar o assunto das três");
  assert.equal(r.mensagensRevisadas, true, "as mensagens com clichê têm que ser trocadas");
  assert.ok(/colheita/.test(r.messages.a), "a mensagem entregue tem que falar do que o cliente condicionou");
}

// ── 4) Sem condição do cliente, a releitura não inventa uma ─────────────────────────────────
{
  let n = 0;
  const prompts = [];
  const openai = { chat: { completions: { create: async (args) => {
    n++;
    prompts.push(String(args?.messages?.find(m => m.role === "user")?.content || ""));
    return {
      model: "gpt-teste",
      choices: [{ message: { content: JSON.stringify(n === 1 ? {
        summary: "s",
        diagnostico: { ultimoCompromissoCliente: "Não identificado" },
        nextAction: "Responder a dúvida de metragem que ficou aberta",
        mensagens: { recomendada: "Fico à disposição.", maisSuave: "Oi!", maisDireta: "Olá!" }
      } : { mensagens: { recomendada: "Boa noite! Sobre a metragem que você perguntou:", maisSuave: "Boa noite! Te devo a metragem.", maisDireta: "Boa noite! Já te mando a metragem exata." } }) } }],
      usage: {}
    };
  } } } };
  await analyzeWithBrain({
    lead: { clientName: "Cliente" },
    timeline: [{ date: "19/02/2026", time: "17:12", author: "Cliente", text: "qual a metragem?" }],
    openai,
    cerebroConfig: { corretorNome: "S", metodo: "M", tom: "T", diferenciais: "", evitar: "", regras: [], objecoes: [] }
  });
  const pedido = prompts[1] || "";
  assert.ok(!/A condição que o PRÓPRIO CLIENTE colocou/.test(pedido),
    'sem condição do cliente ("Não identificado"), a releitura não pode receber uma inventada');
  assert.match(pedido, /A CONDUÇÃO desta conversa/, "a condução continua indo");
}

console.log("v1236-entender-antes-de-escrever: ok");
