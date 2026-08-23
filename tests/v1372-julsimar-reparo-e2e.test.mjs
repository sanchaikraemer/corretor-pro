import assert from "node:assert/strict";
import { parseWhatsappTxt, guessLeadData, analyzeWithBrain } from "../api/_pipeline.js";

// v1372 — integração do caso real que motivou a revisão final.
// A primeira resposta da IA reproduz os dois defeitos vistos na tela: B pula para entrada e C
// inventa ligação/data. A conferência precisa disparar UMA única correção só das mensagens,
// preservar o diagnóstico/timing e devolver três redações da mesma jogada comercial.
const CONVERSA = `[18/08/2026 15:38] Construtora Senger: Boa tarde, Julcimar! Tudo bem? Você conseguiu dar uma olhada no Premium Office?
[18/08/2026 15:38] Julsimar Chapada: Olá No momento não posso responder. Em caso de urgência ligar para 54 993276608 ou 54 999217613
[18/08/2026 15:46] Julsimar Chapada: Dei uma olhada sim
[18/08/2026 15:48] Julsimar Chapada: Estamos analisando ainda, mas gostei da ideia
[18/08/2026 15:48] Julsimar Chapada: O Nicolas me falou mais ou menos as condições de pagamento
[18/08/2026 16:06] Construtora Senger: Hoje estamos trabalhando com 20% de entrada e saldo em até 30x. Se ficar melhor, dá para distribuir parte em reforços anuais. Você já tem algo em mente? Se quiser posso lhe encaminhar mais informações.
[18/08/2026 16:08] Julsimar Chapada: Joia.`;

const timeline = parseWhatsappTxt(CONVERSA);
const lead = guessLeadData(timeline, "Construtora Senger", "Conversa do WhatsApp com Julsimar Chapada.txt");
let chamadas = 0;

const primeira = {
  summary: "Julsimar gostou da ideia, condições já foram apresentadas e ainda não informou faixa de investimento.",
  leituraDaConversa: { comoConduzir: "Aguardar o prazo e depois descobrir a faixa total de investimento." },
  diagnostico: { ultimaPessoaFalar: "contato", objecaoPrincipal: "Nenhuma", pendenciaFinanceira: "Faixa de investimento não definida" },
  mensagens: {
    aLabel: "Define a faixa", bLabel: "Puxa a entrada", cLabel: "Propõe ligação", ordemDeEnvio: "Use a primeira na retomada.",
    recomendada: "Bom dia, Julcimar! Retomando o Premium Office, em que faixa total vocês pretendem investir? A partir disso consigo separar as unidades e montar uma condição objetiva.",
    maisSuave: "Bom dia, Julcimar! Retomando o Premium Office, quanto vocês pensam em colocar de entrada? Com isso consigo montar a condição.",
    maisDireta: "Bom dia, Julcimar! Posso te ligar na terça-feira às 10h para definirmos isso?"
  },
  quemEhOCliente: "Julsimar Chapada",
  produtoInteresse: "Premium Office",
  produtosInteresse: ["Premium Office"],
  etapaSugerida: "Atendimento",
  clientProfile: "Interessado",
  nextAction: "Aguardar prazo e perguntar faixa",
  recomendacaoContato: { aguardar: true, motivo: "Ainda não completou o prazo de retomada." }
};

const reparada = { mensagens: {
  aLabel: "Define a faixa", bLabel: "Filtra as opções", cLabel: "Vai ao ponto",
  ordemDeEnvio: "Escolha uma das três quando chegar a data de retomada.",
  recomendada: "Bom dia, Julcimar! Retomando nossa conversa sobre o Premium Office: como vocês estão analisando a possibilidade de investimento, queria entender uma coisa para eu conseguir montar algo mais objetivo para vocês. Qual faixa de valor vocês pensam em investir hoje? A partir disso consigo separar as unidades e montar a condição que mais faz sentido.",
  maisSuave: "Bom dia, Julcimar! Retomando o Premium Office, quero filtrar isso direito para não te mandar opção fora do que vocês estão pensando. Em que faixa de valor vocês pretendem investir? Com essa faixa eu separo poucas unidades e monto a condição em cima do que realmente cabe.",
  maisDireta: "Bom dia, Julcimar! Indo direto ao ponto no Premium Office: qual faixa de valor vocês querem considerar? Com esse número eu consigo selecionar as unidades compatíveis e te passar uma condição objetiva."
} };

const openai = { chat: { completions: { create: async () => ({
  model: "mock-gpt", usage: {},
  choices: [{ message: { content: JSON.stringify(++chamadas === 1 ? primeira : reparada) } }]
}) } } };

const resultado = await analyzeWithBrain({
  lead: { ...lead, corretorNome: "Construtora Senger" },
  timeline,
  openai,
  cerebroConfig: {
    corretorNome: "Construtora Senger",
    metodo: "Conduzir sem repetir perguntas; uma lacuna por vez.",
    tom: "Natural e objetivo.",
    regras: [{ texto: "Retomada após 7 dias." }]
  }
});

assert.equal(chamadas, 2, "uma análise + uma única tentativa de reparo das mensagens");
assert.equal(resultado.recomendacaoContato.aguardar, true, "reparo não pode mudar o timing da análise");
assert.match(resultado.messages.a, /faixa de valor|faixa total/i);
assert.match(resultado.messages.b, /faixa de valor|faixa total/i);
assert.match(resultado.messages.c, /faixa de valor|faixa total/i);
assert.doesNotMatch(`${resultado.messages.a}\n${resultado.messages.b}\n${resultado.messages.c}`, /quanto[^.!?]{0,35}entrada|parcelas|reforços|posso te ligar|terça-feira|10h/i);
assert.deepEqual(resultado.avisosMensagens, [], "três mensagens reparadas precisam sair sem aviso bloqueante");

console.log("v1372-julsimar-reparo-e2e: ok");
