import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain, problemasNaMensagem } from "../api/_pipeline.js";

// v1303 — print do dono de 18/08/2026, 20h40, já na v1302: "que bela BOSTA!!! não sei pra que serve
// todas aquelas regras do cérebro se não são usadas."
//
// A mesma conversa de duas linhas (saudação do anúncio + "Posso ter mais informações sobre isso?").
// As duas sugestões visíveis no print:
//
//   1. "Posso te passar as opções disponíveis... Você tem preferência por andar ou gostaria de ver
//       todas as possibilidades?"
//   2. "...temos unidades de 3 suítes com box duplo. Prefere que eu te envie primeiro os valores ou
//       gostaria de saber mais detalhes sobre o apartamento?"
//
// Três coisas, todas já proibidas por escrito e nenhuma barrada:
// (1) "Posso te passar" é pedir licença — a rede só pegava quando o "?" vinha logo em seguida;
// (2) "temos unidades de 3 suítes" descreve o catálogo — a rede conhecia "tem", não "temos";
// (3) as duas mandam o CLIENTE escolher o caminho, contra a regra "UM CAMINHO SÓ" que está no
//     pedido desde a v1296 e nunca teve rede nenhuma.
//
// E o buraco maior, que a frase do dono aponta em cheio: a segunda chamada — a que reescreve e
// portanto ESCREVE O TEXTO QUE ELE LÊ — não recebia o Cérebro nem a conversa. Quanto mais a rede
// pegava, mais texto sem as regras dele chegava na tela.

const CONVERSA = `[18/08/2026 20:11] Empresa: Anúncio do Instagram. Olá, temos o Residencial Fictício com 3 suítes e box duplo. Quer saber mais sobre as unidades disponíveis?
[18/08/2026 20:12] Leonardo Cliente: Olá! Posso ter mais informações sobre isso?`;

const MSG1 = "Boa noite, Leonardo! Posso te passar as opções disponíveis no Residencial Fictício com 3 suítes e box duplo, incluindo valores e condições. Você tem preferência por andar ou gostaria de ver todas as possibilidades?";
const MSG2 = "Boa noite, Leonardo! Sobre o Residencial Fictício, temos unidades de 3 suítes com box duplo. Prefere que eu te envie primeiro os valores ou gostaria de saber mais detalhes sobre o apartamento?";

// ── 1. As duas do print caem na rede ─────────────────────────────────────────────────────────
{
  const p1 = problemasNaMensagem(MSG1, CONVERSA);
  assert.ok(p1.includes("pede licença em vez de entregar"), "'Posso te passar' é licença mesmo sem '?' logo depois");
  assert.ok(p1.includes("manda o cliente escolher o caminho"), "'preferência por andar ou ver todas as possibilidades' é escolha de caminho");

  const p2 = problemasNaMensagem(MSG2, CONVERSA);
  assert.ok(p2.includes("descreve o empreendimento por conta própria"), "'temos unidades de 3 suítes' afirma o catálogo");
  assert.ok(p2.includes("manda o cliente escolher o caminho"), "'prefere que eu te envie os valores ou saber mais detalhes' é escolha de caminho");
}

// ── 2. O que NÃO pode cair: pergunta de qualificação e oferta de horário ──────────────────────
// A diferença que importa: "ou" sobre o que o CLIENTE precisa é qualificação (é o que tem que
// acontecer); "ou" sobre o que o CORRETOR vai fazer é empurrar a decisão pro cliente.
{
  for (const boa of [
    "Boa noite, Leonardo! Você precisa de 2 ou 3 dormitórios?",
    "Leonardo, é para morar ou para investir?",
    "Você procura tudo mobiliado ou apenas alguns itens?",
    "Consigo te receber no decorado quinta às 18h ou sábado de manhã. Qual fica melhor?",
    "Te mando agora a tabela do 802A. Prefere quinta ou sexta para conhecer pessoalmente?",
    "Boa noite, Leonardo! Pra eu separar as unidades certas: quantos dormitórios você precisa e até que valor pretende investir?"
  ]) {
    assert.deepEqual(problemasNaMensagem(boa, CONVERSA), [], `"${boa}" é mensagem boa e não pode ser acusada`);
  }
}

// ── 3. A reescrita recebe o Cérebro e a conversa — era o buraco apontado pelo dono ────────────
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
        mensagens: { recomendada: MSG1, maisSuave: MSG2, maisDireta: "Leonardo, te mando agora o que tenho disponível. Quantos dormitórios você precisa?" },
        quemEhOCliente: "Leonardo Cliente", produtoInteresse: "Não identificado",
        etapaSugerida: "Atendimento", clientProfile: "Perfil", nextAction: "Descobrir o critério dele"
      }) } }] };
    }
    return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify({
      a: "Boa noite, Leonardo! Pra eu te mandar as unidades certas: quantos dormitórios você precisa e até que valor pretende investir?",
      b: "Boa noite, Leonardo! Antes de separar as opções: é para morar ou para investir?"
    }) } }] };
  } } } };

  const r = await analyzeWithBrain({
    lead: { clientName: "Leonardo Cliente", corretorNome: "Sanchai" },
    timeline,
    openai: openaiMock,
    cerebroConfig: {
      corretorNome: "Sanchai",
      metodo: "Método do corretor: qualificar antes de mandar tabela.",
      tom: "Tom do corretor: direto, sem enrolação.",
      regras: [{ texto: "REGRA DO CORRETOR: nunca mandar valor antes de saber o que a pessoa procura." }]
    }
  });

  assert.equal(pedidos.length, 2, "as furadas voltam numa segunda chamada");
  const reescrita = pedidos[1];
  assert.ok(reescrita.includes("REGRA DO CORRETOR: nunca mandar valor antes de saber o que a pessoa procura"),
    "o CÉREBRO precisa ir junto na reescrita — é ela que escreve o texto que aparece na tela");
  assert.ok(reescrita.includes("Tom do corretor: direto, sem enrolação"), "o tom dele também");
  assert.ok(reescrita.includes("Posso ter mais informações sobre isso?"),
    "e a conversa, senão a reescrita muda o assunto sem saber o que o cliente perguntou");
  assert.ok(reescrita.includes("UM CAMINHO SÓ"), "a instrução de escolher o caminho precisa estar no pedido de reescrita");

  for (const m of [r.messages.a, r.messages.b, r.messages.c]) {
    assert.deepEqual(problemasNaMensagem(m, CONVERSA), [], `precisa chegar limpa na tela: "${m}"`);
  }
}

// ── 4. A regra continua escrita no pedido da análise, não só na rede ──────────────────────────
{
  const src = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  const ini = src.indexOf("REGRAS PARA AS TRÊS MENSAGENS");
  const regras = src.slice(ini, src.indexOf("LINGUAGEM DE IA — PROIBIDO", ini)).replace(/\s+/g, " ");
  assert.ok(regras.includes("UM CAMINHO SÓ"), "a regra de um caminho só continua no pedido (existe desde a v1296)");
  assert.ok(!/limparFrasesProibidas|melhorLimpa/.test(src), "nada de cirurgia determinística no texto (v1247)");
}

console.log("v1303-cerebro-na-reescrita-e-um-caminho-so: ok");
