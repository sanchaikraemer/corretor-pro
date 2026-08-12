// v1235 — as três sugestões passam por uma CONFERÊNCIA antes de chegar ao corretor.
//
// Caso real (prints do dono, 12/08/2026, lead Adriano). O app entregou:
//   "Boa noite Adriano, tudo bem? Tranquilo por aqui, ..."          (pergunta e responde sozinho)
//   "... me diz se faz sentido seguir nessa linha ..."              (enfeite que devolve a decisão)
//   "Separei agora a simulação do Renaissance ..."                  (ação que nunca aconteceu)
//
// O detalhe que motivou este teste: "faz sentido" e "separou" JÁ ESTAVAM proibidos por escrito no
// prompt (blocos "LINGUAGEM DE IA — PROIBIDO" e "AÇÃO E NOVIDADE QUE NÃO EXISTEM"), e o modelo
// passou por cima assim mesmo. Ou seja, mandar a regra não basta — tem que CONFERIR a saída. É
// isso que este teste tranca: a conferência existe, pega os casos reais dos prints, e não estraga
// mensagem boa.
import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain, detectarFrasesProibidas, conferirTrioMensagens } from "../api/_pipeline.js";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");

// ── 1) Os textos exatos dos prints são pegos ────────────────────────────────────────────────
const print1A = "Boa noite Adriano, tudo bem? Tranquilo por aqui, vi que você prefere aguardar para avançar com a simulação nesse momento. Quando quiser retomar ou se quiser conversar sobre outras opções em Carazinho, é só avisar. Fico na escuta, como combinamos!";
const r1A = detectarFrasesProibidas(print1A);
assert.ok(r1A.proibidas.length > 0,
  'o cumprimento auto-respondido ("tudo bem? Tranquilo por aqui") tem que ser pego como PROIBIDO');

const print2A = "Boa noite Adriano! Trago aqui aquela simulação detalhada do Renaissance que conversamos. Dá uma olhada e me diz se faz sentido seguir nessa linha.";
const r2A = detectarFrasesProibidas(print2A);
assert.ok(r2A.proibidas.includes("faz sentido"), '"faz sentido" é PROIBIDO — o dono repetiu o pedido na v1236');
assert.ok(r2A.suspeitas.includes("trago aqui"), '"trago aqui" (material que não existe) precisa ser conferido');

const print2C = "Boa noite Adriano! Separei agora a simulação do Renaissance com as alternativas de entrada e safra. Posso te encaminhar o PDF?";
assert.ok(detectarFrasesProibidas(print2C).suspeitas.includes("separei"),
  '"Separei agora a simulação" — ação assinada pelo corretor que nunca aconteceu — precisa ser conferida');

// ── 2) Os clichês de sempre continuam proibidos em qualquer contexto ────────────────────────
for (const frase of [
  "Fico à disposição para o que precisar",
  "Espero que esteja tudo bem por aí",
  "Qualquer dúvida estou aqui",
  "Sei que a correria é grande, desculpa incomodar"
]) {
  assert.ok(detectarFrasesProibidas(frase).proibidas.length > 0, `clichê não pego: "${frase}"`);
}

// ── 3) Mensagem BOA não pode ser acusada de nada ────────────────────────────────────────────
// Esta é a retomada que o dono mandou como exemplo do que ele quer (12/08/2026): abre pela vida do
// cliente (a colheita), não pela oferta que ele não respondeu.
const boa = "Boa noite Adriano! Lembrei da nossa conversa de uns meses atrás. Na época você comentou que queria primeiro fechar a colheita para depois pensar com mais calma naquele investimento em Carazinho. Como acabou ficando isso para você?";
const rBoa = detectarFrasesProibidas(boa);
assert.equal(rBoa.proibidas.length, 0, "a retomada modelo do dono não pode cair na lista dura");
assert.equal(rBoa.suspeitas.length, 0, "a retomada modelo do dono não pode nem levantar suspeita");

// v1236 — "faz sentido" é PROIBIÇÃO DURA, sem exceção: "não quero a expressão 'faz sentido', já
// disse mil vezes". Na v1235 ela tinha sido afrouxada por leitura errada de um exemplo que o dono
// mandou (ele só queria mostrar que a sugestão do ChatGPT era melhor, não aprovar a expressão).
// Nem essa frase, que veio no exemplo elogiado, pode passar.
for (const comFazSentido of [
  "Ainda faz sentido a ideia de pegar um apartamento na planta, com duas vagas?",
  "Se fizer sentido pra você, a gente marca uma visita.",
  "Me diz se faça sentido seguir por aqui."
]) {
  assert.ok(detectarFrasesProibidas(comFazSentido).proibidas.length > 0,
    `"faz sentido" tem que ser barrado em qualquer forma: "${comFazSentido}"`);
}

// Um cumprimento normal, sem auto-resposta, continua livre.
assert.equal(detectarFrasesProibidas("Boa tarde Adriano, tudo bem? Consegui as duas opções com duas vagas.").proibidas.length, 0,
  "perguntar 'tudo bem?' sem responder por si mesmo é normal e não pode ser barrado");

// ── 4) O trio limpo passa direto (sem custo e sem espera a mais) ────────────────────────────
const trioLimpo = conferirTrioMensagens({
  a: "Boa noite Adriano! Como ficou a colheita por aí?",
  b: "Boa noite Adriano! Você tinha dito que ia decidir depois da colheita — como está isso?",
  c: "Boa noite Adriano! Quer que eu prepare a simulação com as duas vagas para você olhar?"
});
assert.equal(trioLimpo.limpo, true, "trio sem problema nenhum tem que ser entregue direto");

const trioSujo = conferirTrioMensagens({ a: print1A, b: print2A, c: print2C });
assert.equal(trioSujo.limpo, false, "o trio dos prints do dono tem que cair na conferência");
assert.equal(trioSujo.porMensagem.length, 3, "as três mensagens dos prints têm apontamento");

// ── 5) A releitura roda DENTRO do orçamento de tempo e nunca derruba a análise ──────────────
const inicio = pipeline.indexOf("export async function analyzeWithBrain");
const fim = pipeline.indexOf("export function getOpenAIRaw", inicio);
const analyzeSrc = pipeline.slice(inicio, fim);

assert.match(analyzeSrc, /const conferencia = conferirTrioMensagens\(/,
  "analyzeWithBrain precisa conferir as três mensagens antes de devolver");
assert.match(analyzeSrc, /if \(!conferencia\.limpo/,
  "a releitura só pode rodar quando a conferência encontrou algo (trio limpo não gasta chamada)");
assert.match(analyzeSrc, /sobraReescritaMs = orcamentoAnaliseMs - \(Date\.now\(\) - inicioAnaliseTs\)/,
  "a releitura tem que caber no MESMO orçamento da análise (não pode esticar o envelope de 52s)");
assert.match(analyzeSrc, /if \(sobraReescritaMs >= 10000\)/,
  "sem tempo sobrando, entrega as mensagens originais em vez de arriscar estourar o teto da Vercel");
assert.match(analyzeSrc, /catch \(_\) \{ \/\* a análise continua valendo com as mensagens originais \*\/ \}/,
  "falha na releitura NUNCA pode descartar a análise (regra do projeto desde a v827-12)");
assert.match(analyzeSrc, /if \(nota\(conferenciaNova\) <= nota\(conferencia\)\)/,
  "a reescrita só entra no lugar se ficou melhor (ou igual) na conferência");

// ── 6) As regras novas estão escritas no prompt que vai pra IA ──────────────────────────────
assert.match(pipeline, /O GANCHO DA RETOMADA É A VIDA DO CLIENTE, NÃO A SUA OFERTA/,
  "a regra da retomada pelo assunto do cliente precisa estar no prompt");
assert.match(pipeline, /CUMPRIMENTO QUE SE RESPONDE SOZINHO — PROIBIDO/,
  "o cumprimento auto-respondido precisa estar proibido por escrito no prompt");

// ── 7) O comportamento de verdade, ponta a ponta (não só o texto do código) ─────────────────
// Roda analyzeWithBrain com uma IA de mentira: a 1ª resposta traz as mensagens ruins, a 2ª (a
// releitura) traz o que for combinado em cada caso.
async function rodar(primeira, segunda) {
  let n = 0;
  const promptsRecebidos = [];
  const openai = { chat: { completions: { create: async (args) => {
    n++;
    promptsRecebidos.push(String(args?.messages?.find(m => m.role === "user")?.content || ""));
    return {
      model: "gpt-teste",
      choices: [{ message: { content: JSON.stringify(n === 1 ? { summary: "s", mensagens: primeira } : { mensagens: segunda }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 10 }
    };
  } } } };
  const r = await analyzeWithBrain({
    lead: { clientName: "Cliente" },
    timeline: [{ date: "19/02/2026", time: "17:12", author: "Cliente", text: "tenho que ver da minha colheita, daí eu te procuro" }],
    openai,
    cerebroConfig: { corretorNome: "Sanchai", metodo: "Consultivo", tom: "Direto", diferenciais: "", evitar: "", regras: [], objecoes: [] }
  });
  return { r, chamadas: n, promptsRecebidos };
}

const ruins = {
  recomendada: "Boa noite! Tudo bem? Tranquilo por aqui, fico à disposição para o que precisar.",
  maisSuave: "Boa noite! Separei agora a simulação e trago aqui as condições especiais.",
  maisDireta: "Boa noite! Me diz se faz sentido seguir nessa linha."
};
const boas = {
  recomendada: "Boa noite! Você tinha comentado que ia decidir depois da colheita. Como ficou isso por aí?",
  maisSuave: "Boa noite! Na conversa você disse que ia ver a colheita antes de seguir. Deu pra fechar?",
  maisDireta: "Boa noite! Como ficou a colheita? Se já tiver clareza, preparo a simulação com as duas vagas."
};

// 7a. Mensagens ruins são realmente TROCADAS, e a releitura recebe os apontamentos.
{
  const { r, chamadas, promptsRecebidos } = await rodar(ruins, boas);
  assert.equal(chamadas, 2, "trio com problema tem que disparar exatamente UMA releitura");
  assert.equal(r.mensagensRevisadas, true, "a troca precisa ficar registrada no resultado");
  assert.equal(r.messages.a, boas.recomendada, "a mensagem entregue tem que ser a reescrita");
  const pedido = promptsRecebidos[1] || "";
  assert.match(pedido, /PROIBIDO \(tire sempre\)/, "a releitura precisa receber o que é proibido");
  assert.match(pedido, /separei/, "a releitura precisa saber qual ação suspeita conferir");
  assert.ok(pedido.includes("colheita"), "a releitura precisa receber a conversa pra julgar os fatos");
}

// 7b. Trio limpo não gasta chamada nenhuma a mais.
{
  const { r, chamadas } = await rodar(boas, ruins);
  assert.equal(chamadas, 1, "trio limpo tem que ser entregue direto, sem releitura e sem custo extra");
  assert.equal(r.mensagensRevisadas, undefined, "sem releitura, nada a registrar");
  assert.equal(r.messages.a, boas.recomendada);
}

// 7c. Releitura PIOR é recusada — as originais ficam. Este é o coração da lição da v827-18:
// conferir não pode virar um jeito novo de entregar coisa pior que a que já estava na mão.
{
  const { r } = await rodar(ruins, {
    recomendada: "Espero que esteja bem! Não hesite em chamar.",
    maisSuave: "Fico à disposição, qualquer dúvida estou aqui.",
    maisDireta: "Sinta-se à vontade."
  });
  assert.equal(r.mensagensRevisadas, undefined, "reescrita com MAIS clichê não pode substituir a original");
  assert.equal(r.messages.a, ruins.recomendada, "recusada a reescrita, valem as mensagens originais");
}

// 7d. Releitura incompleta (mensagem vazia) também é recusada, sem derrubar a análise.
{
  const { r } = await rodar(ruins, { recomendada: "Boa noite! Como ficou a colheita?", maisSuave: "", maisDireta: "Boa noite!" });
  assert.equal(r.mensagensRevisadas, undefined, "reescrita sem as três mensagens não entra");
  assert.equal(r.mode, "openai", "e a análise continua de pé");
  assert.equal(r.sugestoesPendentes, false, "com as três originais na mão, nada fica pendente");
}

// 7e. Se a releitura EXPLODE, a análise continua com as mensagens originais.
{
  let n = 0;
  const openai = { chat: { completions: { create: async () => {
    n++;
    if (n === 2) throw new Error("falha na releitura");
    return { model: "gpt-teste", choices: [{ message: { content: JSON.stringify({ summary: "s", mensagens: ruins }) } }], usage: {} };
  } } } };
  const r = await analyzeWithBrain({
    lead: { clientName: "Cliente" },
    timeline: [{ date: "19/02/2026", time: "17:12", author: "Cliente", text: "vejo a colheita e te procuro" }],
    openai,
    cerebroConfig: { corretorNome: "Sanchai", metodo: "Consultivo", tom: "Direto", diferenciais: "", evitar: "", regras: [], objecoes: [] }
  });
  assert.equal(r.mode, "openai", "releitura que falha não pode derrubar a análise");
  assert.equal(r.messages.a, ruins.recomendada, "valem as mensagens originais");
  assert.equal(r.sugestoesPendentes, false, "a análise continua utilizável pro corretor");
}

console.log("v1235-conferencia-das-tres-mensagens: ok");
