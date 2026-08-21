import fs from "node:fs";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { parseWhatsappTxt, contarMaterialNaoLido, prepararConversaDoZip } from "../api/_pipeline.js";

// v1348 — TRÊS ARQUIVOS SUMIRAM DA ANÁLISE E NENHUMA TELA AVISOU.
//
// Print do dono, 21/08/2026 15h22. No card "Últimas mensagens" do cliente, as três últimas linhas
// da conversa — todas depois de ele perguntar "Ele teria alguma entrada? Ou até permuta, carro,
// moto..." — eram a MESMA frase: "[Arquivo enviado nesta mensagem: arquivo — conteúdo não analisado
// pela IA]". Ou seja: no momento decisivo do atendimento, três arquivos foram trocados e a IA não
// fazia ideia do que tinha neles. Em lugar nenhum do app isso estava escrito.
//
// A causa tem nome e endereço. Quando o WhatsApp do Android exporta SEM os arquivos (a opção leve,
// a que quase todo mundo usa), cada foto/PDF/áudio vira a linha "<Mídia oculta>" — que NÃO diz o
// tipo. O marcador que nasce dela é o genérico, "arquivo". E a conta que alimenta os avisos
// (contarMaterialNaoLido, v1323) só enxergava "imagem", "documento/PDF" e "áudio". Total: 0.
// Aviso: nenhum. Justamente no caso mais comum de todos.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const importacao = fs.readFileSync(new URL("../js/importacao.js", import.meta.url), "utf8");

// ── 1. A conversa do print, rodada de verdade ────────────────────────────────────────────────
const CONVERSA_DO_PRINT = [
  "[21/08/2026 14:51] Miguel: Ele teria alguma entrada? Ou ate permuta, carro, moto...",
  "[21/08/2026 14:52] Gordo: <Mídia oculta>",
  "[21/08/2026 14:53] Gordo: <Mídia oculta>",
  "[21/08/2026 15:01] Miguel: <Mídia oculta>"
].join("\n");
{
  const timeline = parseWhatsappTxt(CONVERSA_DO_PRINT);
  const conta = contarMaterialNaoLido(timeline);
  assert.equal(conta.arquivos, 3,
    "os três arquivos do print precisam ser contados — era este o furo, e é o caso mais comum");
  assert.equal(conta.total, 3, "e entrar no total, que é o que faz o aviso aparecer");
  assert.equal(conta.imagens + conta.documentos + conta.audios, 0,
    "sem inventar tipo: '<Mídia oculta>' não diz se era foto, PDF ou áudio");
}

// ── 2. Tipo continua sendo tipo, e vídeo continua fora ───────────────────────────────────────
{
  const timeline = parseWhatsappTxt([
    "[21/08/2026 09:00] Gordo: imagem omitida",
    "[21/08/2026 09:01] Gordo: documento omitido",
    "[21/08/2026 09:02] Gordo: audio omitted",
    "[21/08/2026 09:03] Gordo: video omitted",
    "[21/08/2026 09:04] Gordo: <Mídia oculta>"
  ].join("\n"));
  const c = contarMaterialNaoLido(timeline);
  assert.deepEqual(
    { imagens: c.imagens, documentos: c.documentos, audios: c.audios, arquivos: c.arquivos },
    { imagens: 1, documentos: 1, audios: 1, arquivos: 1 },
    "cada tipo na sua conta; o sem tipo na dele");
  assert.ok(!Object.keys(c).includes("videos"),
    "vídeo continua fora da conta — o app não lê vídeo por decisão do dono, avisar não teria conserto");
}

// ── 3. Três arquivos numa mensagem só valem três, não um ─────────────────────────────────────
// A conta antiga era por MENSAGEM (`else if` por mensagem): quem manda três fotos de uma vez
// aparecia como se tivesse mandado uma.
{
  const varias = [{ text: [
    "[Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]",
    "[Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]",
    "[Arquivo enviado nesta mensagem: documento/PDF — conteúdo não analisado pela IA]"
  ].join("\n") }];
  const c = contarMaterialNaoLido(varias);
  assert.equal(c.imagens, 2, "duas fotos na mesma mensagem contam duas");
  assert.equal(c.documentos, 1);
  assert.equal(c.total, 3);
}
assert.equal(contarMaterialNaoLido([{ text: "Bom dia, tudo certo por aí?" }]).total, 0,
  "conversa sem arquivo nenhum não pode gerar aviso");
assert.equal(contarMaterialNaoLido(null).total, 0, "e nada quebra com entrada vazia");

// ── 4. O ZIP sem mídia é reconhecido — inclusive no formato do iPhone ────────────────────────
{
  const zipar = async (txt) => {
    const zip = new JSZip();
    zip.file("conversa.txt", txt);
    return prepararConversaDoZip(await zip.generateAsync({ type: "nodebuffer" }), { organizationId: "org-teste" });
  };
  const android = await zipar(CONVERSA_DO_PRINT);
  assert.equal(android.exportadoSemMidia, true,
    "exportação sem mídia do Android precisa ser reconhecida");
  assert.equal(android.midiasOcultas, 3, "com o número certo de arquivos que ficaram de fora");

  // iPhone: escreve "imagem omitida" na linha, SEM os sinais de menor/maior. A conta só olhava o
  // formato com <>, então exportação de iPhone sem mídia não disparava aviso nenhum.
  const iphone = await zipar([
    "[21/08/2026 14:51] Miguel: Bom dia! Segue o material",
    "[21/08/2026 14:52] Gordo: imagem omitida",
    "[21/08/2026 14:53] Gordo: documento omitido"
  ].join("\n"));
  assert.equal(iphone.midiasOcultas, 2, "o formato do iPhone também conta");
  assert.equal(iphone.exportadoSemMidia, true);

  // E conversa normal, sem arquivo nenhum, continua sem aviso.
  const limpa = await zipar("[21/08/2026 14:51] Miguel: Bom dia! Tudo certo?");
  assert.equal(limpa.midiasOcultas, 0);
  assert.equal(limpa.exportadoSemMidia, false);

  // A rede tem que ser estreita: frase de verdade que POR ACASO termina nessas palavras não pode
  // virar "arquivo que ficou de fora". Por isso a regra exige que a mensagem seja SÓ isso.
  const falsoAlarme = await zipar([
    "[21/08/2026 14:51] Miguel: mandei o contrato mas ficou um documento omitido na pasta",
    "[21/08/2026 14:52] Gordo: beleza, vou conferir a imagem omitida que voce falou"
  ].join("\n"));
  assert.equal(falsoAlarme.midiasOcultas, 0,
    "frase normal do corretor não pode ser confundida com marca de arquivo escondido");
}

// ── 5. As duas telas dizem a coisa CERTA pra cada caso ───────────────────────────────────────
// São dois problemas diferentes e o conserto é diferente: o que não foi LIDO se resolve reimportando
// (o app lê alguns arquivos por importação); o que não VEIO não está na conversa — só reexportando
// com mídia. Trocar as frases seria mandar o corretor fazer trabalho que não resolve.
{
  const aviso = app.match(/function cp1323MaterialNaoLido\(a\)\{[\s\S]*?\n\}/)[0];
  assert.match(aviso, /const semVir = Number\(m\.arquivos\) \|\| 0;/,
    "a tela do lead precisa ler a contagem nova");
  assert.match(aviso, /if\(fotos \+ docs \+ audios \+ semVir <= 0\) return "";/,
    "e o aviso precisa aparecer também quando só há arquivo sem tipo");
  assert.match(aviso, /arquivos não vieram/, "com a frase do caso 'não veio no envio'");
  assert.match(aviso, /Ler fotos, PDFs e áudios/, "e a instrução que resolve ESTE caso, na própria tela (v1349)");
  assert.match(aviso, /reimporte a conversa/, "sem perder a instrução do outro caso, que é diferente");
}
{
  assert.match(importacao, /const semTipoCount = Number\(naoLido\?\.arquivos\) \|\| 0;/,
    "a tela da importação também precisa contar o arquivo sem tipo");
  assert.match(importacao, /fotosForaCount \+ docsForaCount \+ semTipoCount\) > 0/);
  assert.match(importacao, /Conversa enviada SEM os arquivos/,
    "o aviso da exportação sem mídia não pode mais falar só de áudio: foto e PDF somem junto");
  assert.match(importacao, /foto, PDF e áudio não vieram/);
}

// ── 6. Na tela, o marcador cabe numa linha ───────────────────────────────────────────────────
// Três frases de 26 palavras empilhadas era o que estava no print. O card existe pra ele bater o
// olho e lembrar onde a conversa parou.
{
  const fonte = [
    app.match(/const CP1348_MARCADOR = [\s\S]*?\n  \};/)[0],
    app.match(/function cp1348TextoNaTela\(texto\)\{[\s\S]*?\n  \}/)[0]
  ].join("\n");
  const curto = new Function(`${fonte}\nreturn cp1348TextoNaTela;`)();

  assert.equal(curto("[Arquivo enviado nesta mensagem: arquivo — conteúdo não analisado pela IA]"),
    "📎 Arquivo enviado — não veio no envio da conversa");
  assert.equal(curto("[Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]"),
    "📎 Foto enviada — a IA não leu o conteúdo");
  assert.equal(curto("[Arquivo enviado nesta mensagem: documento/PDF — conteúdo não analisado pela IA]"),
    "📎 PDF enviado — a IA não leu o conteúdo");
  assert.equal(curto("[Arquivo enviado nesta mensagem: áudio — conteúdo não analisado pela IA]"),
    "📎 Áudio enviado — não virou texto");
  assert.equal(curto("[Arquivo enviado nesta mensagem: vídeo — conteúdo não analisado pela IA]"),
    "📎 Vídeo enviado — a IA não lê vídeo");

  // Texto de verdade não pode ser tocado — nem o que só se parece com o marcador.
  const real = "Ele teria alguma entrada? Ou ate permuta, carro, moto...";
  assert.equal(curto(real), real, "fala do corretor passa intacta");
  assert.equal(curto(""), "", "e vazio continua vazio");
  // Texto + marcador na mesma mensagem: o texto fica, o marcador encurta.
  assert.equal(curto("Segue a tabela\n[Arquivo enviado nesta mensagem: documento/PDF — conteúdo não analisado pela IA]"),
    "Segue a tabela\n📎 PDF enviado — a IA não leu o conteúdo");
  // Duas vezes seguidas: o regex é global, não pode parar na primeira.
  assert.equal(
    curto("[Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]\n[Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]"),
    "📎 Foto enviada — a IA não leu o conteúdo\n📎 Foto enviada — a IA não leu o conteúdo");

  // E as duas telas que mostram mensagem precisam usar o encurtador.
  assert.match(app, /const textoNaTela = cp1348TextoNaTela\(cp704Text\(m\.text\)\);/,
    'o card "Últimas mensagens" precisa mostrar a versão curta');
  // v1350 — e a linha do arquivo que não veio virou o próprio conserto: toca e manda o arquivo.
  assert.match(app, /const arquivoFaltando = \/não veio no envio da conversa\/\.test\(textoNaTela\);/,
    'a linha do arquivo que não veio precisa ser reconhecida na hora de desenhar');
  // v1352 — o botão passou a levar o lead e o momento da mensagem: é assim que o texto lido volta
  // pra DENTRO dela, em vez de virar observação em outro ponto do histórico.
  assert.match(app, /class="cp1350-faltou" onclick='event\.stopPropagation\(\);cp1350EnviarArquivoQueFaltou\(\$\{JSON\.stringify/,
    'e virar botão que abre o seletor de arquivos, sabendo qual mensagem está esperando');
  assert.match(app, /function cp1350EnviarArquivoQueFaltou\(leadId, iso\)\{/, 'com a função que faz isso');
  assert.match(app, /const texto = cp1348TextoNaTela\(m\.text\)\.replace/,
    "o bloco das 2 últimas mensagens dentro da ficha também");
}

// ── 7. O registro não muda — só a tela ───────────────────────────────────────────────────────
// "Copiar histórico" é prova do que aconteceu: precisa continuar copiando a frase inteira.
{
  const copiar = app.match(/async function copiarHistoricoLead\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(copiar, /\$\{m\.text\|\|""\}/,
    "a cópia do histórico usa o texto guardado, sem o encurtamento de tela");
  assert.ok(!/cp1348TextoNaTela/.test(copiar),
    "encurtar é coisa de tela; o que se copia é o registro");
}

console.log("v1348-arquivo-que-nao-veio-precisa-avisar: ok");
