import assert from "node:assert/strict";
import {
  parseWhatsappTxt,
  guessLeadData,
  valoresNaMensagem,
  valoresCitadosNaConversa,
  perguntasJaFeitasPeloCorretor,
  proximosPassosJaPropostos,
  permutaOferecidaPeloCliente,
  montarFicharioDaConversa,
  analyzeWithBrain
} from "../api/_pipeline.js";
import { CONVERSA } from "./conversa-fixa-permuta.mjs";

// v1317 — O FICHÁRIO DA CONVERSA.
//
// Pedido do dono (20/08/2026): *"eu quero q o sistema funcione igual a sua analise"*, depois de
// comparar a análise do app com a leitura da MESMA conversa feita à mão.
//
// Os três prints que ele mandou mostram o defeito com clareza: as três sugestões perguntando
// "morar ou investir?" — que o corretor tinha perguntado SETE MESES antes, na primeira resposta
// da mesma conversa; e as três presas ao apartamento do anúncio, ignorando que a cliente tinha
// acabado de oferecer 3 terrenos como entrada, o que muda a faixa de compra dela por completo.
//
// A diferença nunca foi esperteza da IA: era MATERIAL. Este arquivo guarda os quatro fatos que o
// app passou a calcular e entregar prontos — e que a leitura à mão tinha na mão.

const HOJE = new Date("2026-08-20T12:00:00-03:00");
const timeline = parseWhatsappTxt(CONVERSA);
const lead = guessLeadData(timeline, "Miguel Kirinus", "Conversa do WhatsApp com Noemi Barcarol Evoluti.txt");

// ---------------------------------------------------------------------------
// 0) BUG ANTIGO, ACHADO POR ESTA CONVERSA: "800mil" era jogado fora.
//    /\bmil\b/ não casa depois de um dígito ("800mil" não tem fronteira entre o "0" e o "m"), então
//    o valor virava 800, caía no piso de mil reais e sumia. Era justamente o número da faixa de
//    compra que o corretor tinha escrito. No WhatsApp escreve-se assim o tempo todo.
// ---------------------------------------------------------------------------
assert.deepEqual(valoresNaMensagem("Porém o valor da compra teria que ser em torno de 800mil"), [800000], "'800mil' colado precisa virar R$ 800.000");
assert.deepEqual(valoresNaMensagem("são 350 mil"), [350000], "'350 mil' com espaço continua funcionando");
assert.deepEqual(valoresNaMensagem("R$ 1,2 milhão"), [1200000], "milhão continua funcionando");
assert.deepEqual(valoresNaMensagem("2 dormitórios e 43m2"), [], "número que não é dinheiro continua fora");

// ---------------------------------------------------------------------------
// 1) VALORES JÁ CITADOS, COM A IDADE DE CADA UM.
//    Sem isso, o preço de janeiro e o de ontem chegam na IA com a mesma cara — e um preço de sete
//    meses atrás volta pro cliente como se fosse o de hoje.
// ---------------------------------------------------------------------------
const valores = valoresCitadosNaConversa(timeline, "Miguel Kirinus", lead, HOJE);
const porValor = new Map(valores.map(v => [v.valor, v]));
assert.deepEqual([...porValor.keys()].sort((a, b) => a - b), [430000, 670000, 800000], "os três valores em dinheiro da conversa precisam ser encontrados");
assert.equal(porValor.get(670000).diasAtras, 211, "o preço de 21/01/2026 tem 211 dias em 20/08/2026");
assert.equal(porValor.get(670000).ultimaData, "21/01/2026");
assert.equal(porValor.get(430000).diasAtras, 1, "o preço do anúncio é de ontem");
assert.equal(porValor.get(800000).diasAtras, 1);
assert.equal(porValor.get(670000).quem, "pelo corretor", "quem disse cada valor precisa vir junto");
assert.equal(valores[0].valor !== 670000, true, "o mais recente vem primeiro, o antigo por último");

// ---------------------------------------------------------------------------
// 2) O QUE O CORRETOR JÁ PERGUNTOU.
//    A pergunta mais perigosa de repetir é a MAIS ANTIGA — a do primeiro contato, que ninguém
//    lembra mais. É por isso que esta lista tem teto próprio e maior.
// ---------------------------------------------------------------------------
const perguntas = perguntasJaFeitasPeloCorretor(timeline, "Miguel Kirinus", lead, HOJE);
const textos = perguntas.map(q => q.texto);
assert.ok(
  textos.includes("Você está procurando algo para morar ou para investir?"),
  "a pergunta do primeiro dia é a que as sugestões refaziam sete meses depois: ela NÃO pode cair fora da lista"
);
assert.equal(perguntas.find(q => /morar ou para investir/.test(q.texto)).diasAtras, 213, "e precisa chegar com a idade dela: 213 dias");
assert.ok(textos.includes("Sua ideia seria financiar o saldo?"), "a pergunta de ontem sobre financiamento também está na lista");
assert.ok(textos.includes("Gostou do Evolutti?"));

// É a FRASE que é a pergunta, não a mensagem inteira: uma mensagem de seis linhas terminada em "?"
// entrava inteira na lista e virava um paredão ilegível.
assert.ok(textos.includes("O que você gostaria de ver primeiro?"), "de uma mensagem longa sai só a pergunta");
assert.ok(!textos.some(t => t.length > 200), "nenhuma linha da lista pode ser um parágrafo inteiro");

// Cortesia não é pergunta de trabalho, nem quando vem colada na saudação com o nome do cliente.
assert.ok(!textos.some(t => /tudo bem\?$/i.test(t)), "'Boa tarde Fulana, tudo bem?' não pode entrar como pergunta comercial");

// ---------------------------------------------------------------------------
// 3) QUE PRÓXIMO PASSO JÁ FOI PROPOSTO.
//    Propor pela quinta vez o convite que já não aconteceu quatro vezes não é próximo passo.
// ---------------------------------------------------------------------------
const passos = proximosPassosJaPropostos(timeline, "Miguel Kirinus", lead, HOJE);
assert.equal(passos.length, 2, "os dois convites (visita em 21/01 e café em 27/01) precisam ser contados");
assert.deepEqual(passos.map(p => p.data), ["21/01/2026", "27/01/2026"]);
assert.equal(passos[0].diasAtras, 211);

// ---------------------------------------------------------------------------
// 4) A ENTRADA QUE NÃO É DINHEIRO — E A CONTA QUE MUDA TUDO.
//    Este é o item que virou o jogo na leitura à mão: a cliente entrou por um anúncio de
//    R$ 430 mil, mas o que ela ofereceu como entrada abre uma faixa de R$ 720 mil a R$ 900 mil.
// ---------------------------------------------------------------------------
const permuta = permutaOferecidaPeloCliente(timeline, "Miguel Kirinus", lead, HOJE);
assert.ok(permuta, "a permuta oferecida pela cliente precisa ser reconhecida");
assert.equal(permuta.falasDoCliente.length, 2, "as duas falas dela sobre os terrenos entram como prova");
assert.match(permuta.falasDoCliente[0].trecho, /3 terrenos/);
assert.deepEqual(permuta.percentuais, [40, 50], "as porcentagens são as que O CORRETOR disse nesta conversa — o app não tem regra própria");
assert.equal(permuta.valorDaEntrada, 360000, "'o valor dos terrenos fica 360' é R$ 360 mil no mercado imobiliário");
assert.match(permuta.valorComoEscrito, /fica 360/, "o texto original precisa aparecer junto, pra IA poder discordar da leitura");
assert.deepEqual(
  { de: permuta.faixaCompra.de, ate: permuta.faixaCompra.ate },
  { de: 720000, ate: 900000 },
  "R$ 360 mil cobrindo de 50% a 40% abre uma compra de R$ 720 mil a R$ 900 mil"
);

// Conversa sem permuta nenhuma não pode inventar o bloco.
const semPermuta = parseWhatsappTxt([
  "[10/08/2026 09:00] Cliente: Bom dia, quanto fica o apartamento?",
  "[10/08/2026 09:05] Corretor: Bom dia! Fica R$ 500.000."
].join("\n"));
assert.equal(permutaOferecidaPeloCliente(semPermuta, "Corretor", { clientName: "Cliente" }, HOJE), null, "sem permuta na conversa, nenhum bloco de permuta é criado");

// ---------------------------------------------------------------------------
// 5) FIM A FIM: o fichário inteiro precisa chegar ao pedido enviado à IA.
// ---------------------------------------------------------------------------
const chamadas = [];
const openaiMock = {
  chat: { completions: { create: async payload => {
    chamadas.push(payload);
    return { model: "mock-analise", choices: [{ message: { content: JSON.stringify({
      summary: "Resumo",
      diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento" },
      mensagens: { recomendada: "Pergunta?", maisSuave: "Pergunta?", maisDireta: "Pergunta?" },
      produtoInteresse: "Produto",
      produtosInteresse: ["Produto"],
      etapaSugerida: "Atendimento",
      clientProfile: "Perfil",
      nextAction: "Ação"
    }) } }] };
  } } }
};
await analyzeWithBrain({
  lead, timeline, openai: openaiMock,
  cerebroConfig: { metodo: "método do corretor", diasDescansoPosAtendimento: 7 }
});
const pedido = chamadas.at(-1).messages.find(m => m.role === "user")?.content || "";

for (const [trecho, porque] of [
  ["VALORES EM DINHEIRO JÁ CITADOS NESTA CONVERSA", "a lista de valores com idade"],
  ["PERGUNTAS QUE O CORRETOR JÁ FEZ NESTA CONVERSA", "a lista de perguntas já feitas"],
  ["QUE O CORRETOR JÁ PROPÔS NESTA CONVERSA", "a lista de próximos passos já propostos"],
  ["ENTRADA QUE NÃO É DINHEIRO, OFERECIDA PELO PRÓPRIO CLIENTE", "a permuta"],
  ["FAIXA DE COMPRA QUE ESSA ENTRADA ABRE", "a conta do poder de compra"],
  ["R$ 720.000 a R$ 900.000", "o resultado da conta"],
  ["Você está procurando algo para morar ou para investir?", "a pergunta do primeiro dia, que não pode ser refeita às cegas"],
  ["há 211 dias", "a idade do preço antigo"]
]) {
  assert.ok(pedido.includes(trecho), `${porque} precisa chegar ao pedido enviado à IA: "${trecho}"`);
}

// ---------------------------------------------------------------------------
// 6) O QUE O DONO MANDOU ENTERRAR NA v1315 CONTINUA ENTERRADO.
//    O fichário entrega FATO. Ele não reescreve, não corta e não substitui o texto da IA — foi
//    isso que deixou as sugestões robóticas e fez o dono mandar voltar tudo atrás.
// ---------------------------------------------------------------------------
const fichario = montarFicharioDaConversa(timeline, "Miguel Kirinus", lead, HOJE);
assert.ok(fichario.length > 0);
assert.ok(!/reescrev|substitu[ai]|troque a frase|corrija a mensagem/i.test(fichario), "o fichário não pode mandar reescrever nada");

// Conversa vazia não gera fichário nenhum (e não quebra a análise).
assert.equal(montarFicharioDaConversa([], "Corretor", {}, HOJE), "", "sem conversa, sem fichário");

console.log("v1317-fichario-da-conversa: ok");
