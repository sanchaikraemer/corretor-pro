import assert from "node:assert/strict";
import {
  parseWhatsappTxt,
  guessLeadData,
  montarEstadoComercialDeterministico,
  momentoDeQualificacaoComercial,
  montarFicharioDaConversa,
  valoresNaMensagem
} from "../api/_pipeline.js";

// v1369 — caso real Julsimar, 18/08/2026.
// O ponto não é memorizar o cliente: é travar o padrão comercial que a leitura à mão acertou.
const CONVERSA = `[18/08/2026 15:38] Construtora Senger: Boa tarde, Julcimar! Tudo bem?\n\nMe chamo Miguel Kirinus e faço parte do comercial da Construtora Senger.\n\nO Nicolas me passou seu contato e comentou que vocês haviam conversado sobre algumas oportunidades de investimento aqui em Carazinho, especialmente no Premium Office.\n\nCheguei a encaminhar alguns materiais para ele te mostrar e queria saber: você conseguiu dar uma olhada no empreendimento?\n[18/08/2026 15:38] Julsimar Chapada: Olá No momento não posso responder. Em caso de urgência ligar para 54 993276608 ou 54 999217613\n[18/08/2026 15:45] Julsimar Chapada: Opa\n[18/08/2026 15:45] Julsimar Chapada: Tudo cerro\n[18/08/2026 15:45] Julsimar Chapada: Simm\n[18/08/2026 15:46] Julsimar Chapada: Dei uma olhada sim\n[18/08/2026 15:47] Construtora Senger: Que bom que conseguiu analisar o material do Premium Office. Gostaria de saber se ficou alguma dúvida ou se tem algum ponto que gostaria de conversar sobre o empreendimento.\n[18/08/2026 15:48] Julsimar Chapada: Estamos analisando ainda, mas gostei da ideia\n[18/08/2026 15:48] Julsimar Chapada: O Nicolas me falou mais ou menos as condições de pagamento\n[18/08/2026 16:06] Construtora Senger: Perfeito, Julcimar. Hoje, no Premium Office, estamos trabalhando com 20% de entrada e o saldo em até 30x direto com a construtora.\n\nSe ficar mais confortável, também conseguimos montar a condição distribuindo parte do saldo em reforços anuais. E existe ainda a possibilidade de avaliarmos veículo como parte da entrada.\n\nVocê já tem algo em mente? se quiser posso lhe encaminhar mais informações sobre o empreendimento\n[18/08/2026 16:08] Julsimar Chapada: Joia.`;

const timeline = parseWhatsappTxt(CONVERSA);
const lead = guessLeadData(timeline, "Construtora Senger", "Conversa do WhatsApp com Julsimar Chapada.txt");
const agora = new Date("2026-08-22T11:22:00-03:00");
const estado = montarEstadoComercialDeterministico(timeline, "Construtora Senger", lead, agora);
const q = momentoDeQualificacaoComercial(timeline, "Construtora Senger", lead, estado);

assert.deepEqual(valoresNaMensagem("No momento não posso responder. Em caso de urgência ligar para 54 993276608 ou 54 999217613"), [],
  "telefone de resposta automática não pode virar preço/orçamento");
assert.ok(!estado.topicosConfirmados.some(t => t.id === "faixa_valor"),
  "telefone + 'não posso responder' não pode marcar faixa de valor como respondida");

assert.ok(q.interessePositivo, "'gostei da ideia' precisa ser reconhecido como sinal positivo");
assert.equal(q.pagamentoEmPauta, true, "as condições já foram discutidas na conversa");
assert.equal(q.faixaRespondida, false, "o cliente ainda não disse quanto pretende investir");
assert.equal(q.entradaRespondida, false, "20% dito pelo corretor não é entrada disponível declarada pelo cliente");
assert.equal(q.temObjecaoConcreta, false, "não existe objeção confirmada nesse histórico");
assert.equal(q.interesseSemQualificacaoFinanceira, true, "o estágio correto é interesse sem qualificação financeira");
assert.ok(q.ctaGenerico, "a última pergunta aberta do corretor precisa ser reconhecida");
assert.match(q.ctaGenerico.resposta, /joia/i, "'Joia' precisa ser tratado como cortesia, não conteúdo comercial");

const fichario = montarFicharioDaConversa(timeline, "Construtora Senger", lead, agora, estado);
assert.match(fichario, /INTERESSE POSITIVO, MAS AINDA SEM QUALIFICAÇÃO FINANCEIRA/);
assert.match(fichario, /FAIXA DE VALOR\/ORÇAMENTO ainda NÃO foi definida/i,
  "a próxima informação de alto valor precisa ficar explícita");
assert.match(fichario, /não repita a pergunta genérica/i,
  "o sistema não pode voltar para 'você já tem algo em mente?'");
assert.match(fichario, /ficou com dúvida\?|quer mais informações\?/i,
  "o sistema precisa evitar voltar para dúvidas/material depois que isso já passou");
assert.match(fichario, /ENTRADA DISPONÍVEL/i,
  "a sequência deve guardar entrada para depois da faixa, sem interrogatório");

console.log("v1369-julsimar-qualificacao-comercial: ok (interesse reconhecido, Joia não responde qualificação, faixa vira próximo dado)");
// Proteção de generalização: interesse positivo NÃO pode atropelar uma objeção real.
// Se o cliente disser que gostou, mas que está caro, a regra específica do Julsimar não assume
// "sem objeção" nem força qualificação financeira como se o preço não tivesse sido contestado.
{
  const conversaComObjecao = parseWhatsappTxt(`[22/08/2026 10:00] Construtora Senger: A condição é 20% de entrada e saldo parcelado.
[22/08/2026 10:01] Maria Teste: Gostei, mas achei caro para mim.`);
  const leadObjecao = guessLeadData(conversaComObjecao, "Construtora Senger", "Conversa do WhatsApp com Maria Teste.txt");
  const estadoObjecao = montarEstadoComercialDeterministico(conversaComObjecao, "Construtora Senger", leadObjecao, new Date("2026-08-22T11:00:00-03:00"));
  const momentoObjecao = momentoDeQualificacaoComercial(conversaComObjecao, "Construtora Senger", leadObjecao, estadoObjecao);
  assert.equal(momentoObjecao.temObjecaoConcreta, true, "preço contestado precisa continuar sendo objeção concreta");
  assert.equal(momentoObjecao.interesseSemQualificacaoFinanceira, false, "interesse positivo não pode apagar objeção de preço");
}

