import fs from "node:fs";
import assert from "node:assert/strict";
import {
  parseWhatsappTxt, guessLeadData, montarFicharioDaConversa,
  falasJaDitasPeloCliente, permutaOferecidaPeloCliente, contarMaterialNaoLido
} from "../api/_pipeline.js";
import { CONVERSA, CONVERSA_COM_RESPOSTA } from "./conversa-fixa-permuta.mjs";

// v1323 — TRÊS COISAS QUE O DONO PEGOU NA TELA, NA CONVERSA FIXA (20/08/2026).
//
// Ele comparou a análise publicada com a conversa inteira. A leitura estava certa em tudo o que
// dava pra conferir — e ainda assim três coisas estavam erradas:
//   1. a sugestão pedia "me manda a localização certinha dos terrenos" — a cliente JÁ tinha dito
//      "3 terrenos lá numa esquina da ouro preto". Pedir o que já foi dito é o que mais parece
//      que ninguém leu a conversa;
//   2. a sugestão devolvia pra cliente "faixa de R$ 720 a R$ 900 mil" quando o próprio corretor
//      tinha ancorado "em torno de 800 mil" no dia anterior — a mensagem derrubava o piso dele;
//   3. as fotos, o PDF e os áudios da conversa continuavam sem ser lidos, e nada na tela dizia
//      isso: a análise parecia completa.
// O remédio é o mesmo da v1317 e não é regra nova de escrita: FATO PRONTO no fichário, e prova
// na tela. Nada aqui reescreve o texto da IA.

const agora = new Date("2026-08-20T15:00:00-03:00");
const timeline = parseWhatsappTxt(CONVERSA_COM_RESPOSTA);
const lead = guessLeadData(timeline, "Miguel Kirinus", "Conversa do WhatsApp com Noemi Barcarol Evoluti.txt");

// ── 0. A conversa fixa continua intacta, e a versão de hoje tem as duas mensagens novas ──────
{
  assert.equal(parseWhatsappTxt(CONVERSA).length, 64, "a conversa fixa original não pode ser editada");
  assert.equal(timeline.length, 66, "a conversa de hoje tem as duas mensagens de 20/08");
  assert.equal(timeline.at(-1).author, "Noemi Barcarol Evoluti", "agora a última palavra é da cliente");
  assert.equal(timeline.at(-1).text, "Não temos pressa");
}

// ── 1. O QUE O CLIENTE JÁ DISSE ──────────────────────────────────────────────────────────────
{
  const falas = falasJaDitasPeloCliente(timeline, "Construtora Senger", lead, agora);
  const textos = falas.map(f => f.texto);

  assert.ok(textos.some(t => /3 terrenos lá numa esquina da ouro preto/i.test(t)),
    "a fala que diz ONDE ficam os terrenos precisa estar na lista — é o que a sugestão pedia de novo");
  assert.ok(textos.some(t => /Com 2 banheiros/i.test(t)), "o critério dos 2 banheiros é fala dela");
  assert.ok(textos.some(t => /avenida Pátria ou mais centro/i.test(t)),
    "a fala de JANEIRO sobre a região não pode cair fora da lista por ser antiga — é a mais fácil de esquecer");
  assert.ok(textos.some(t => /Não temos pressa/i.test(t)), "a resposta de hoje entra na lista");

  assert.ok(!textos.some(t => /arquivo anexado/i.test(t)), "linha de anexo não é fala do cliente");
  assert.ok(!textos.some(t => /^Sim$/i.test(t)), '"Sim" sozinho não informa nada e só polui a lista');
  assert.ok(!falas.some(f => f.texto.includes("Boa tarde Noemi")), "mensagem do CORRETOR não pode entrar como fala da cliente");

  const repetida = falas.find(f => /Tenho interesse e queria mais informações/i.test(f.texto));
  assert.ok(repetida && repetida.vezes === 2, "fala repetida aparece uma vez só, contando as repetições");

  // Cada fala vem com a data e a idade — é isso que separa o que ela disse ontem do que disse em janeiro.
  for (const f of falas) {
    assert.match(f.ultimaData, /^\d{2}\/\d{2}\/\d{4}$/, "toda fala precisa vir com data");
    assert.ok(Number.isInteger(f.diasAtras), "e com quantos dias tem");
  }
  assert.ok((falas[0].diasAtras ?? 99) <= (falas.at(-1).diasAtras ?? 0), "a lista vem da mais recente pra mais antiga");
}

// ── 2. A ÂNCORA: o valor que o próprio corretor já colocou na mesa ───────────────────────────
{
  const permuta = permutaOferecidaPeloCliente(timeline, "Construtora Senger", lead, agora);
  assert.ok(permuta, "a permuta dos três terrenos precisa continuar sendo lida");
  assert.deepEqual([permuta.faixaCompra.de, permuta.faixaCompra.ate], [720000, 900000],
    "a faixa que a entrada abre continua sendo a conta de 40 a 50% sobre R$ 360 mil");

  assert.ok(permuta.ancora, "o valor de compra que o corretor já disse precisa ser encontrado");
  assert.equal(permuta.ancora.valor, 800000, 'a âncora é o "em torno de 800mil" dito pelo corretor');
  assert.equal(permuta.ancora.data, "19/08/2026");
  assert.equal(permuta.ancora.diasAtras, 1, "a âncora vem com a idade dela");
  assert.match(permuta.ancora.trecho, /valor da compra teria que ser/i);

  // O apartamento do anúncio (R$ 430 mil) é valor de OUTRO produto: está fora da faixa e não pode
  // ser confundido com a âncora da permuta.
  assert.notEqual(permuta.ancora.valor, 430000, "valor de outro produto não vira âncora");
}

// ── 3. Os dois fatos chegam no fichário, com o que fazer com eles ────────────────────────────
{
  const fichario = montarFicharioDaConversa(timeline, "Construtora Senger", lead, agora);

  assert.match(fichario, /O QUE O CLIENTE JÁ DISSE NESTA CONVERSA/,
    "o fichário precisa levar a fala do cliente, não só as perguntas do corretor");
  assert.match(fichario, /Antes de PEDIR qualquer informação ao cliente, confira esta lista/,
    "e precisa dizer o que fazer com ela: não pedir de volta o que já foi dito");
  assert.match(fichario, /esquina da ouro preto/i);

  assert.match(fichario, /VALOR QUE O PRÓPRIO CORRETOR JÁ COLOCOU NA MESA, DENTRO DESSA FAIXA: R\$ 800\.000/,
    "a âncora precisa aparecer junto da faixa, senão a IA usa só a faixa");
  assert.match(fichario, /não apresente número ABAIXO dela/,
    "e precisa dizer por que a ponta de baixo da faixa não vai pra mensagem");
  assert.match(fichario, /A faixa acima é conta interna pra pensar/,
    "a faixa é raciocínio, não número pra colar na mensagem do cliente");

  // Nada disso pode virar informação comercial cravada no código (regra do projeto).
  const fonte = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  for (const proibido of ["800000", "R$ 800", "ouro preto", "Noemi", "Evolutti", "Pátria"]) {
    assert.ok(!fonte.includes(proibido), `nada desta conversa pode estar cravado no código: "${proibido}"`);
  }
}

// ── 4. (v1360) A CONTA VIROU SÓ DE ÁUDIO, POR ORDEM DO DONO ─────────────────────────────────
// "como assim a IA não leu um PDF se não importa PDF?" — desde a v1358 foto e PDF não são enviados
// na importação, então contar o que a IA "não leu" deles era avisar de algo impossível. Sobra o
// áudio, que continua sendo enviado e transcrito: se não virou texto, há motivo de verdade.
{
  const conta = contarMaterialNaoLido(timeline);
  assert.equal(conta.audios, 4, "os 4 áudios que não viraram texto continuam contados");
  assert.equal(conta.total, 4);
  assert.ok(!Object.keys(conta).includes("imagens"), "foto saiu da conta: ela nem é enviada");
  assert.ok(!Object.keys(conta).includes("documentos"), "PDF também");
  assert.ok(!Object.keys(conta).includes("videos"), "e vídeo nunca esteve");

  const lida = parseWhatsappTxt(`[19/08/2026 10:00] Construtora Senger: Bom dia, segue o material
[19/08/2026 10:01] Noemi Barcarol Evoluti: Recebi, obrigada`);
  assert.equal(contarMaterialNaoLido(lida).total, 0, "sem áudio pendente, nada é contado");
}

// ── 5. As pontas ligadas: análise, salvamento e as duas telas ────────────────────────────────
{
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  assert.match(pipeline, /materialNaoLido: contarMaterialNaoLido\(timelineArr\)/,
    "a análise precisa carregar a contagem do material não lido");

  const persistencia = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");
  assert.match(persistencia, /"materialNaoLido"/,
    "a contagem precisa viajar com a lista, senão o aviso some ao reabrir o lead");

  // v1360 — os avisos de tela saíram (ver o teste v1360). A contagem continua viajando com a
  // análise porque é ela que alimenta a decisão; o que mudou é que ninguém mais mostra foto/PDF.
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.ok(!/a IA ainda não leu/.test(app), "o aviso de material não lido não pode voltar à tela do lead");
}

console.log("v1323-o-que-o-cliente-ja-disse-e-a-ancora: ok");
