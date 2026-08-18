import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain, problemasNaMensagem, fatosInventadosNaMensagem } from "../api/_pipeline.js";

// v1302 — print do dono de 18/08/2026, 20h14. A conversa tinha DUAS linhas: a saudação automática
// do anúncio do Instagram ("temos o [empreendimento] com 3 suítes e box duplo") e o cliente:
// "Olá! Posso ter mais informações sobre isso?". As três sugestões:
//
//   1. "O [empreendimento] conta com apartamentos de 3 suítes, box duplo de garagem e estrutura
//       moderna. Vou te enviar as principais informações e diferenciais do empreendimento."
//   2. "...tem um perfil bem procurado... Te passo um resumo das opções disponíveis..., pode ser?"
//   3. "Já te mando as informações completas... Se tiver alguma preferência, tipo andar, tamanho ou
//       valor, só me falar que já separo as melhores opções para você."
//
// Reclamação do dono, nas palavras dele: "quem disse q tem só 3 suítes??? ninguém!!!" (o prédio tem
// de 2 suítes também) e "não está nem respondendo o q o cara perguntou".
//
// Duas das três deviam ter sido barradas pelas redes que JÁ EXISTIAM desde a v1299 e passaram por
// buraco de vocabulário: "pode ser?" não estava na lista de pedir licença, e "só me falar" não
// estava na de devolver a bola (só "só me avisar"). A terceira falha era nova: descrever o
// empreendimento por conta própria e prometer mandar informação sem entregar nem perguntar nada.

const CONVERSA = `[18/08/2026 20:11] Empresa: Anúncio do Instagram. Olá, temos o Residencial Fictício com 3 suítes e box duplo. Quer saber mais sobre as unidades disponíveis?
[18/08/2026 20:12] Leonardo Cliente: Olá! Posso ter mais informações sobre isso?`;

const MSG1 = "Boa noite, Leonardo! O Residencial Fictício conta com apartamentos de 3 suítes, box duplo de garagem e estrutura moderna. Vou te enviar as principais informações e diferenciais do empreendimento para você conhecer melhor.";
const MSG2 = "Boa noite, Leonardo! O Residencial Fictício tem um perfil bem procurado, com 3 suítes e box duplo. Te passo um resumo das opções disponíveis para te ajudar a entender melhor, pode ser?";
const MSG3 = "Boa noite, Leonardo! Já te mando as informações completas do Residencial Fictício com 3 suítes e box duplo. Se tiver alguma preferência, tipo andar, tamanho ou valor, só me falar que já separo as melhores opções para você.";

// ── 1. As três do print caem na rede ─────────────────────────────────────────────────────────
{
  const p1 = problemasNaMensagem(MSG1, CONVERSA);
  assert.ok(p1.includes("descreve o empreendimento por conta própria"),
    "afirmar o catálogo do prédio ('conta com apartamentos de 3 suítes') precisa ser pego");
  assert.ok(p1.includes("elogia o imóvel com o que a conversa não disse"),
    "'estrutura moderna' não está em lugar nenhum da conversa");
  assert.ok(p1.includes("promete mandar informação e não pergunta nada"),
    "'vou te enviar as principais informações', sem pergunta, não responde o cliente");

  assert.ok(problemasNaMensagem(MSG2, CONVERSA).includes("pede licença em vez de entregar"),
    "o 'pode ser?' no fim é pedido de licença (buraco da rede da v1299)");
  assert.ok(problemasNaMensagem(MSG3, CONVERSA).includes("fecho que manda o cliente avisar"),
    "'só me falar' é a mesma sala de espera de 'só me avisar' (buraco da rede da v1299)");

  for (const [msg, motivo] of [
    ["Leonardo, o prédio possui unidades de 2 dormitórios e área de lazer completa.", "catálogo afirmado por conta própria"],
    ["Leonardo, é um empreendimento de alto padrão e com ótima estrutura.", "elogio sem fonte"],
    ["Leonardo, já te passo os detalhes do empreendimento.", "promessa sem entrega e sem pergunta"],
    ["Leonardo, te mando o material. Qualquer coisa é só me dizer.", "fecho que devolve a bola"]
  ]) {
    assert.ok(problemasNaMensagem(msg, CONVERSA).length > 0, `precisa cair na rede: ${motivo}`);
  }
}

// ── 2. O que NÃO pode cair na rede ────────────────────────────────────────────────────────────
// Cada um destes derrubou uma mensagem boa enquanto a rede estava sendo escrita.
{
  for (const boa of [
    // A resposta certa pro print: uma pergunta que deixa o corretor selecionar o que mandar.
    "Boa noite, Leonardo! Pra eu separar as unidades certas: você precisa de quantos dormitórios e até que valor pretende investir?",
    // "tudo bem?" é saudação de WhatsApp, não pedido de licença.
    "Boa tarde, Ana Paula, tudo bem? Já estou te enviando a apresentação completa por aqui.",
    // "tem interesse nas unidades" não descreve catálogo nenhum.
    "Olá! Passando pra saber se você ainda tem interesse nas unidades.",
    // Entrega concreta, com objeto concreto — promessa de verdade, não conversa fiada.
    "Leonardo, te mando agora a tabela do 802A com valor e condição de pagamento.",
    "Valter, te mando agora a lista dos móveis que ficam no apartamento. Quer as fotos de cada ambiente junto?",
    // Oferecer dois horários continua permitido (é a exceção de sempre, pra fechar agenda).
    "Consigo te receber no decorado quinta às 18h ou sábado de manhã. Qual fica melhor?"
  ]) {
    assert.deepEqual(problemasNaMensagem(boa, CONVERSA), [], `"${boa}" é mensagem boa e não pode ser acusada`);
  }

  // O que o CÉREBRO descreve é texto do próprio corretor: pode ser dito.
  const comCerebro = { conversa: CONVERSA, cerebro: "DIFERENCIAIS: o Residencial Fictício tem apartamentos de 2 e 3 suítes, com estrutura moderna." };
  assert.deepEqual(fatosInventadosNaMensagem(MSG1, comCerebro), [],
    "com o Cérebro descrevendo o produto, descrever o produto deixa de ser invenção");
  // Mas o ENDEREÇO continua saindo só da conversa — o Cérebro tem a carteira inteira e não sabe
  // qual unidade este cliente viu (é a decisão da v1301).
  assert.ok(fatosInventadosNaMensagem("O apartamento fica na Rua Inventada, 200.",
    { conversa: CONVERSA, cerebro: "DIFERENCIAIS: prédios na Rua Inventada." }).length > 0,
    "nome de rua continua tendo que estar NESTA conversa");

  assert.deepEqual(problemasNaMensagem(""), [], "mensagem vazia não gera acusação");
  assert.deepEqual(fatosInventadosNaMensagem(MSG1), [], "sem contexto conhecido, ninguém é acusado");
}

// ── 3. Na análise de verdade: as três voltam pra IA e chegam limpas na tela ───────────────────
{
  const timeline = [
    { date: "18/08/2026", time: "20:11", author: "Empresa", text: "Anúncio do Instagram. Olá, temos o Residencial Fictício com 3 suítes e box duplo. Quer saber mais sobre as unidades disponíveis?" },
    { date: "18/08/2026", time: "20:12", author: "Leonardo Cliente", text: "Olá! Posso ter mais informações sobre isso?" }
  ];
  const pedidos = [];
  const openaiMock = { chat: { completions: { create: async (args) => {
    pedidos.push(args.messages.map(m => m.content).join("\n\n"));
    if (pedidos.length === 1) {
      return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify({
        summary: "Cliente pediu informações sobre o anúncio.", diagnostico: {},
        mensagens: { recomendada: MSG1, maisSuave: MSG2, maisDireta: MSG3 },
        quemEhOCliente: "Leonardo Cliente", produtoInteresse: "Não identificado",
        etapaSugerida: "Atendimento", clientProfile: "Perfil", nextAction: "Descobrir o que ele precisa"
      }) } }] };
    }
    return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify({
      a: "Boa noite, Leonardo! Pra eu te mandar as unidades certas: quantos dormitórios você precisa e até que valor pretende investir?",
      b: "Boa noite, Leonardo! Antes de te passar as opções: é pra morar ou pra investir, e quantos dormitórios você precisa?",
      c: "Boa noite, Leonardo! Me diz quantos dormitórios você precisa e até quanto pretende investir que eu já separo o que serve pra você."
    }) } }] };
  } } } };

  const r = await analyzeWithBrain({
    lead: { clientName: "Leonardo Cliente", corretorNome: "Sanchai" },
    timeline,
    openai: openaiMock,
    cerebroConfig: { corretorNome: "Sanchai", metodo: "Método.", tom: "Tom.", regras: [{ texto: "Regra." }] }
  });

  assert.equal(pedidos.length, 2, "as três furadas voltam numa segunda chamada só");
  assert.ok(pedidos[1].includes("descreve o empreendimento por conta própria"), "o pedido de reescrita diz o que está errado");
  assert.ok(pedidos[1].includes("PROMETER MANDAR NÃO É MANDAR"), "e manda perguntar em vez de anunciar envio");
  for (const m of [r.messages.a, r.messages.b, r.messages.c]) {
    assert.deepEqual(problemasNaMensagem(m, CONVERSA), [], `a sugestão precisa chegar limpa na tela: "${m}"`);
  }
  assert.equal(r.reescritaAntiRobo, 3, "o registro conta as três reescritas");
}

// ── 4. As regras também estão escritas no pedido, não só na rede ─────────────────────────────
{
  const src = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  const ini = src.indexOf("REGRAS PARA AS TRÊS MENSAGENS");
  const regras = src.slice(ini, src.indexOf("LINGUAGEM DE IA — PROIBIDO", ini)).replace(/\s+/g, " ");
  assert.ok(regras.includes("VOCÊ NÃO CONHECE O IMÓVEL"), "a regra de não descrever o produto precisa estar no pedido");
  assert.ok(regras.includes("PROMETER MANDAR NÃO É MANDAR"), "e a de responder em vez de anunciar envio");
  assert.ok(!/limparFrasesProibidas|melhorLimpa/.test(src), "nada de cirurgia determinística no texto (v1247)");
}

console.log("v1302-sugestao-que-nao-responde-e-inventa: ok");
