import assert from "node:assert/strict";
import {
  parseWhatsappTxt, guessLeadData, montarFicharioDaConversa,
  perguntasSemRespostaDoCliente, recusasDoCliente, promessasNaoCumpridasDoCorretor
} from "../api/_pipeline.js";
import { CONVERSA } from "./conversa-fixa-permuta.mjs";

// v1329 — OS QUATRO FATOS QUE FALTAVAM, TODOS PEGOS NA CONVERSA FIXA.
//
// O dono comparou, em 20/08/2026, a análise do app com a leitura à mão da MESMA conversa. Os
// quatro buracos que apareceram — e que este teste tranca:
//   1. "Sua ideia seria financiar o saldo?" ficou sem resposta e nenhuma das três sugestões tocou
//      nela. É a pergunta que decide se a compra de R$ 800 mil existe.
//   2. A sugestão voltou no apartamento de 43 m², recusado por TAMANHO, porque a faixa de PREÇO
//      tinha mudado. Motivo diferente: não devolve o produto.
//   3. A sugestão inventou uma pendência ("ficou pendente eu te confirmar os 2 banheiros"),
//      enquanto a pendência real (o preço prometido em 29/06 e nunca enviado) passou batida.
//   4. Uma leitura à mão propôs reabrir um imóvel de R$ 670 mil com permuta de R$ 360 mil — 53,7%,
//      acima do teto de 50% dito pelo próprio corretor. Aritmética, não opinião.

const HOJE = new Date("2026-08-20T15:00:00-03:00");
const CONVERSA_COM_20_08 = CONVERSA + `
[20/08/2026 10:02] Construtora Senger: Bom dia Noemi, tudo bem?
Me responde só uma coisa pra eu separar as certas: você precisa de algo pronto pra morar agora, ou consegue esperar entrega na planta?
[20/08/2026 11:04] Noemi Barcarol Evoluti: Não temos pressa`;

const timeline = parseWhatsappTxt(CONVERSA);
const lead = guessLeadData(timeline, "Miguel Kirinus", "Conversa do WhatsApp com Noemi Barcarol Evoluti.txt");

// ── 1. Pergunta feita e nunca respondida ─────────────────────────────────────────────────────
{
  const abertas = perguntasSemRespostaDoCliente(timeline, "Miguel Kirinus", lead, HOJE);
  const textos = abertas.map(q => q.texto).join(" | ");
  assert.match(textos, /financiar o saldo/i, "a pergunta que decide o dinheiro precisa aparecer como sem resposta");
  assert.match(textos, /morar ou para investir/i, "pergunta de sete meses atrás, nunca respondida, também conta");
  assert.match(textos, /faixa de investimento/i, "a faixa também ficou sem resposta");

  // Cortesia, convite de visita e pergunta sem peso de decisão NÃO entram — senão a lista vira ruído.
  assert.doesNotMatch(textos, /tudo bem/i, "saudação não é pergunta de trabalho");
  assert.doesNotMatch(textos, /gostaria de ver primeiro/i, "pergunta genérica não decide nada e não entra");
  assert.doesNotMatch(textos, /levá-la visitar|caf[ée]/i, "convite tem bloco próprio (próximos passos), não entra aqui");
  assert.ok(abertas.length <= 5, "a lista precisa ser curta pra ter valor");

  // Pergunta RESPONDIDA some da lista: em 20/08 ela respondeu "Não temos pressa" ao prazo.
  const t2 = parseWhatsappTxt(CONVERSA_COM_20_08);
  const abertas2 = perguntasSemRespostaDoCliente(t2, "Miguel Kirinus", lead, HOJE);
  assert.ok(!abertas2.some(q => /pronto pra morar agora|esperar entrega/i.test(q.texto)),
    "pergunta que o cliente respondeu (mesmo com outras palavras: 'Não temos pressa') não pode ser listada como em aberto");
}

// ── 2. Recusa com o motivo ───────────────────────────────────────────────────────────────────
{
  const recusas = recusasDoCliente(timeline, "Miguel Kirinus", lead, HOJE);
  const porMotivo = Object.fromEntries(recusas.map(r => [r.motivo, r]));
  assert.ok(porMotivo.TAMANHO, "o 43 m² foi recusado por TAMANHO — o motivo precisa ficar registrado");
  assert.match(porMotivo.TAMANHO.fala, /muito pequeno/i);
  assert.equal(porMotivo.TAMANHO.valorEmJogo, 430000, "e ligado ao valor que estava na mesa naquele momento");
  assert.ok(porMotivo["POSIÇÃO"], "'São de fundos' é recusa por POSIÇÃO, não por preço");
  assert.equal(porMotivo["POSIÇÃO"].valorEmJogo, 670000);
}

// ── 3. Promessa que o corretor não cumpriu ───────────────────────────────────────────────────
{
  const abertas = promessasNaoCumpridasDoCorretor(timeline, "Miguel Kirinus", lead, HOJE);
  assert.equal(abertas.length, 1, "só existe uma promessa em aberto nesta conversa");
  assert.match(abertas[0].trecho, /Posso te enviar o valor|132 m²/i,
    "a de 29/06 (o valor prometido e nunca enviado) é a pendência real");
  assert.equal(abertas[0].data, "29/06/2026");
  // A de 21/01 ("Claro, to mandando, um segundo") foi cumprida logo depois — imagem, áudio e o
  // valor de R$ 670.000 — e não pode aparecer como pendência.
  assert.ok(!abertas.some(q => q.data === "21/01/2026"), "promessa cumprida não é pendência");
}

// ── 4. Cada valor testado contra a regra de permuta do próprio corretor ──────────────────────
{
  const fichario = montarFicharioDaConversa(timeline, "Miguel Kirinus", lead, HOJE);
  assert.match(fichario, /R\$ 670\.000 → FORA da regra/, "670 mil com permuta de 360 mil dá 54% — acima do teto de 50%");
  assert.match(fichario, /R\$ 430\.000 → FORA da regra/, "e o do anúncio, 84%, mais fora ainda");
  assert.match(fichario, /R\$ 800\.000 → cabe na regra/, "o valor que o corretor colocou na mesa fecha a conta (45%)");
}

// ── 5. Os quatro blocos chegam ao pedido enviado à IA ────────────────────────────────────────
{
  const fichario = montarFicharioDaConversa(timeline, "Miguel Kirinus", lead, HOJE);
  assert.match(fichario, /PERGUNTAS DO CORRETOR QUE O CLIENTE NUNCA RESPONDEU/);
  assert.match(fichario, /O QUE O CLIENTE RECUSOU, E POR QUE MOTIVO/);
  assert.match(fichario, /NÃO APARECE ENVIADO NESTA CONVERSA/);
  assert.match(fichario, /TESTADO CONTRA A REGRA DE PERMUTA/);
  assert.match(fichario, /NÃO invente pendência que não está nesta lista/,
    "a instrução contra pendência inventada precisa acompanhar a lista");
}

console.log("v1329-fatos-que-faltavam-na-analise: ok");
