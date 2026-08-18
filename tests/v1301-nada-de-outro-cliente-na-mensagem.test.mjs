import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain, jeitoAprendidoCompacto } from "../api/_pipeline.js";

// v1301 — ORDEM DIRETA DO DONO: "tira as duas fontes" (18/08/2026).
//
// Print das 19h36, numa conversa de TRÊS linhas — o anúncio dizia só "apartamento com 2
// dormitórios e box de garagem" com o preço, o cliente pediu para saber mais e mandou uma palavra
// ("móveis"). As três sugestões voltaram com ENDEREÇO: em que empreendimento o apartamento estava,
// um ponto de referência da cidade, "região bem localizada". Nada disso existia na conversa.
//
// A regra "nunca invente" já estava escrita em três lugares do pedido e não segurou. Ela não
// segurou porque o próprio sistema entregava à IA, em TODA análise, material que não é deste lead:
// casos de outros clientes, o bloco de fatos da carteira inteira e o cruzamento "produto × perfil"
// (que escrevia o nome do empreendimento oferecido a outro cliente). Com a conversa quase vazia, é
// dali que o modelo preenchia o buraco.
//
// Este teste prova o EFEITO, não a intenção: o que sai daqui é o pedido que a IA realmente recebeu.

const CONVERSA = [
  { date: "18/08/2026", time: "18:42", author: "Construtora Senger", text: "Anúncio do Facebook. Olá, temos um apartamento com 2 dormitórios e box de garagem por R$ 430.000. Quer agendar uma visita?" },
  { date: "18/08/2026", time: "18:42", author: "Valter Quality", text: "Olá! Quero saber mais sobre o apartamento de R$ 430 mil." },
  { date: "18/08/2026", time: "18:42", author: "Valter Quality", text: "móveis" }
];

// Aprendizado com cara de conta real: o cruzamento produto × perfil guarda o nome de um
// empreendimento que o corretor ofereceu a OUTRO cliente.
const CEREBRO = {
  corretorNome: "Sanchai",
  metodo: "Atenda pelo WhatsApp com clareza.",
  tom: "Direto e cordial.",
  regras: [{ texto: "Nunca invente informação que o cliente não te deu." }],
  inteligenciaAprendida: {
    tons: [{ texto: "fala curta, direta e cordial" }],
    tecnicas: [{ texto: "retomo pelo ponto que o cliente pediu" }],
    produtoVsPerfil: [{ perfilCliente: "casal com filho pequeno", produto: "Residencial Fictício III", reacao: "gostou da área de lazer" }],
    padroesFollowup: [{ texto: "retomo perguntando se conseguiu ver o material" }]
  }
};

// ── 1. O pedido que chega na IA não carrega nada de outro cliente ─────────────────────────────
{
  const pedidos = [];
  const openaiMock = { chat: { completions: { create: async (args) => {
    pedidos.push(args.messages.map(m => m.content).join("\n\n"));
    return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify({
      summary: "Cliente pediu detalhes do apartamento e citou móveis.",
      diagnostico: {},
      mensagens: {
        recomendada: "Boa noite, Valter! O apartamento de R$ 430 mil tem 2 dormitórios e box de garagem. Sobre os móveis, te passo agora a lista do que fica no imóvel. Tem algum item que pesa mais pra você?",
        maisSuave: "Boa noite, Valter! Te mando agora o que acompanha o apartamento de móveis.",
        maisDireta: "Valter, te envio agora a lista dos móveis que ficam no apartamento. Quer as fotos junto?"
      },
      quemEhOCliente: "Valter Quality", produtoInteresse: "Apartamento de R$ 430 mil",
      etapaSugerida: "Atendimento", clientProfile: "Perfil", nextAction: "Enviar a lista de móveis"
    }) } }] };
  } } } };

  const r = await analyzeWithBrain({
    lead: { clientName: "Valter Quality", corretorNome: "Sanchai" },
    timeline: CONVERSA,
    openai: openaiMock,
    cerebroConfig: CEREBRO
  });

  const pedido = pedidos.join("\n");
  assert.ok(pedido.length > 0, "a análise precisa ter chamado a IA");
  assert.doesNotMatch(pedido, /Residencial Fictício III/,
    "nome de empreendimento oferecido a OUTRO cliente não pode entrar no pedido");
  assert.doesNotMatch(pedido, /CASOS REAIS DESTE CORRETOR/,
    "o bloco de casos de outros clientes não pode entrar no pedido");
  assert.doesNotMatch(pedido, /FATOS ENSINADOS PELO CORRETOR/,
    "o bloco de fatos da carteira não pode entrar no pedido");
  assert.doesNotMatch(pedido, /Produto certo pro perfil/,
    "o cruzamento produto × perfil não pode entrar no pedido");

  // O que CONTINUA chegando: o Cérebro inteiro e o jeito de escrever do corretor.
  assert.match(pedido, /Nunca invente informação que o cliente não te deu/, "o Cérebro continua indo inteiro");
  assert.match(pedido, /fala curta, direta e cordial/, "o jeito de escrever do corretor continua indo");

  // E a tela não pode dizer que aplicou o que não foi enviado.
  assert.equal(r.aprendizadoEnviado.casos, 0, "a linha da tela não pode alegar casos que não foram enviados");
  assert.equal(r.aprendizadoEnviado.fatos, 0, "nem fatos ensinados que não foram enviados");
  assert.ok(r.aprendizadoEnviado.jeito > 0, "o que realmente foi enviado continua contado");
}

// ── 2. O bloco "SEU JEITO" perdeu o nome de produto e manteve o resto ─────────────────────────
{
  const bloco = jeitoAprendidoCompacto(CEREBRO, "casal com filho pequeno procurando apartamento");
  assert.doesNotMatch(bloco, /Residencial Fictício III/, "nome de produto de outro lead sai do bloco do jeito");
  assert.match(bloco, /fala curta/, "o tom continua");
  assert.match(bloco, /retomo pelo ponto/, "a condução que funcionou continua");
}

// ── 3. A decisão está escrita no código, no lugar onde a religação aconteceria ────────────────
{
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  assert.match(pipeline, /DUAS FONTES SAÍRAM DAQUI, POR ORDEM DIRETA DO DONO/,
    "quem mexer aqui depois precisa ler o porquê antes de religar");
  assert.doesNotMatch(pipeline, /const conhecimentoCorretor = await conhecimentoCorretorTexto\(/,
    "os fatos da carteira não podem voltar pro pedido");
  assert.doesNotMatch(pipeline, /const casosSemelhantes = casosSemelhantesPrompt\(/,
    "os casos de outros clientes não podem voltar pro pedido");
}

console.log("v1301-nada-de-outro-cliente-na-mensagem: ok");
