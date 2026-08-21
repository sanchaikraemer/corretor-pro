import assert from "node:assert/strict";
import {
  nomeDeProdutoNoMaterial,
  itemDeCatalogoDoMaterial,
  fundirCatalogo,
  nomesDoCatalogo,
  itensDeCatalogoDaConversa,
  avisosDeQualidadeDasMensagens
} from "../api/_pipeline.js";

// v1335 — O CATÁLOGO QUE O APP APRENDE SOZINHO.
//
// Origem, palavra do dono (20/08/2026), quando eu sugeri que ele colasse a tabela de produtos no
// Cérebro: *"não adianta botar tabela... esse sistema é pra corretores de imóveis, eles podem ter
// mais de cem produtos na carteira deles, nos sites de venda... Aí você vai dar mais trabalho pro
// corretor em vez de ajudar ele a resolver."*
//
// Ele está certo. O material do produto já passa pelo app todo dia: a arte com o preço, o PDF do
// empreendimento, o link da seleção — e desde a v1306/v1307 o app LÊ tudo isso. Só jogava fora
// depois de usar naquela conversa. Agora fica guardado como catálogo da conta.
//
// E o catálogo tem UM uso só, de propósito: a conferência das três sugestões (v1332). Ele NÃO
// entra no pedido que escreve as mensagens — foi uma fonte assim que fez a IA falar de um
// empreendimento que nunca apareceu na conversa da Vanessa ("nós nem falamos de Evolute", dono).

// ── 1. O nome do produto sai do próprio material ─────────────────────────────────────────────
assert.equal(nomeDeProdutoNoMaterial("Empreendimento Quality Residence\n2 e 3 dormitórios"), "Quality Residence");
assert.equal(nomeDeProdutoNoMaterial("Residencial Vista Verde entrega em 2027"), "Vista Verde");
assert.equal(nomeDeProdutoNoMaterial("EVOLUTTI\nApartamentos de 2 dormitórios\nR$ 430.000"), "EVOLUTTI",
  "arte de venda escreve o nome sozinho na primeira linha");
assert.equal(nomeDeProdutoNoMaterial("apenas um texto solto qualquer sem nome nenhum"), "");

// ── 1-B. v1344 — CHAMADA DE ANÚNCIO NÃO É NOME DE PRODUTO ───────────────────────────────────
//
// Na revisão de 21/08 eu rodei o catálogo contra material de venda de verdade e ele aprendeu lixo:
// de uma arte comum saía o produto "OPORTUNIDADE ÚNICA"; de um print de portal, "IMÓVEL À VENDA";
// e, depois da primeira tentativa de conserto, coisas como "Entrada facilitada, financiamento
// direto" e "R$ 750.000". Isso não é inofensivo: esse nome é justamente o que a conferência das
// sugestões usa pra dizer "é produto seu". Com lixo aí dentro, o app carimbaria bobagem como fato.
//
// A regra passou a ser conservadora de propósito: nome só sai de um sinal explícito
// ("Empreendimento X") ou de uma linha-logotipo (curta, sem número, sem pontuação, com todas as
// iniciais maiúsculas). Não achou? Fica SEM nome. Nome errado é pior do que nome nenhum.
for (const [rotulo, material] of [
  ["chamada de arte", "OPORTUNIDADE ÚNICA\nApartamento de 2 dormitórios com suíte\nEntrada facilitada, financiamento direto\nR$ 430.000"],
  ["print de portal", "IMÓVEL À VENDA\nCasa 3 dormitórios, 140m², bairro Centro\nR$ 750.000"],
  ["frase solta", "Confira as opções selecionadas\nApartamentos com entrada facilitada e parcelas que cabem no bolso"]
]) {
  const nome = nomeDeProdutoNoMaterial(material);
  assert.equal(nome, "", `"${rotulo}" não pode virar nome de produto — veio "${nome}"`);
}
// E os nomes de verdade continuam sendo reconhecidos, nas três formas que aparecem no material.
assert.equal(nomeDeProdutoNoMaterial("EVOLUTTI RESIDENCE\n2 e 3 dormitórios, 68m²"), "EVOLUTTI RESIDENCE", "linha-logotipo em caixa alta");
assert.equal(nomeDeProdutoNoMaterial("Vista Verde\nApartamentos de 2 dormitórios"), "Vista Verde", "logotipo com iniciais maiúsculas");
assert.equal(nomeDeProdutoNoMaterial("Empreendimento Quality Life\nTorre única, 14 andares."), "Quality Life",
  "sinal explícito — e sem colar a linha de baixo no nome, que era outro defeito (\"Quality Life\\nTorre\")");

// ── 2. Material vira item; conversa de cliente, não ──────────────────────────────────────────
const arte = `EVOLUTTI
Apartamentos de 2 dormitórios com box de garagem.
Entrada facilitada e financiamento direto. R$ 430.000.`;
const item = itemDeCatalogoDoMaterial(arte, { origem: "IMG-001.jpg", quando: "19/08/2026" });
assert.ok(item, "a arte de venda precisa virar item de catálogo");
assert.equal(item.nome, "EVOLUTTI");
assert.equal(item.quando, "19/08/2026", "a data anda junto — material antigo nunca é preço de hoje");
assert.match(item.texto, /2 dormit[óo]rios/);

assert.equal(
  itemDeCatalogoDoMaterial("Proposta para Vanessa Ribeiro, CPF 000.000.000-00, apartamento 2 dormitórios R$ 430.000 com entrada", { origem: "doc.pdf" }),
  null,
  "papel de UM cliente não vira catálogo da carteira"
);
assert.equal(itemDeCatalogoDoMaterial("Bom dia!", { origem: "x.jpg" }), null, "texto curto demais não vira nada");

// Dado de pessoa não pode ficar guardado junto do produto.
const comTelefone = itemDeCatalogoDoMaterial(
  "Residencial Vista Verde\nApartamentos de 2 dormitórios a partir de R$ 380.000. Fale com o corretor no 51 99999-8888.",
  { origem: "arte.png", quando: "10/08/2026" }
);
assert.ok(comTelefone);
assert.ok(!/99999-8888/.test(comTelefone.texto), "telefone sai antes de guardar");

// ── 3. Juntar sem duplicar e sem crescer pra sempre ──────────────────────────────────────────
const fundido = fundirCatalogo([item], [item, { nome: "Vista Verde", texto: "2 dormitórios R$ 380.000", quando: "10/08/2026" }]);
assert.equal(fundido.length, 2, "o mesmo material mandado duas vezes é um item só");
assert.deepEqual(nomesDoCatalogo(fundido).sort(), ["EVOLUTTI", "Vista Verde"]);
assert.deepEqual(nomesDoCatalogo([{ nome: "(material sem nome de empreendimento)", texto: "x" }]), [],
  "material sem nome não vira nome de produto");
assert.ok(fundirCatalogo([], Array.from({ length: 90 }, (_, i) => ({ nome: `P${i}`, texto: `texto ${i}` }))).length <= 40,
  "o catálogo tem teto");

// ── 4. Só o que O CORRETOR mandou entra ──────────────────────────────────────────────────────
const timeline = [
  { date: "19/08/2026", author: "Miguel Kirinus", text: "Segue o material", anexos: ["IMG-001.jpg"] },
  { date: "19/08/2026", author: "Vanessa", text: "Olha o que eu recebi de outro corretor", anexos: ["IMG-999.jpg"] },
  { date: "19/08/2026", author: "Miguel Kirinus", text: "E este link: https://exemplo.com/selecao" }
];
const lead = { clientName: "Vanessa", participants: ["Miguel Kirinus", "Vanessa"] };
const aprendidos = itensDeCatalogoDaConversa(
  timeline, "Miguel Kirinus", lead,
  {
    "IMG-001.jpg": { status: "lido", text: arte },
    "IMG-999.jpg": { status: "lido", text: "OUTRO PRODUTO\nApartamento de 3 dormitórios por R$ 900.000 com entrada" }
  },
  { "https://exemplo.com/selecao": { status: "lido", text: "Vista Verde\nApartamentos de 2 dormitórios a partir de R$ 380.000, entrega em 2027." } }
);
const nomes = nomesDoCatalogo(aprendidos);
assert.ok(nomes.includes("EVOLUTTI"), "a arte que o corretor mandou entra");
assert.ok(nomes.includes("Vista Verde"), "o link que o corretor mandou entra");
assert.ok(!nomes.includes("OUTRO PRODUTO"), "o que o CLIENTE mandou não é produto da carteira do corretor");

// ── 5. Pra que serve: o aviso da sugestão passa a dizer QUAL dos dois defeitos é ──────────────
const conversa = "Cliente: quanto fica o apartamento? Corretor: mando o material agora.";
const semCatalogo = avisosDeQualidadeDasMensagens(
  [{ qual: "a", texto: "Bom dia! O Evolutti atende bem o que você procura, quer ver?" }],
  { conversa, cerebro: "" }
);
assert.match(semCatalogo[0].motivos.join(" | "), /não aparece nesta conversa/,
  "sem catálogo, o aviso continua sendo o da v1332");

const comCatalogo = avisosDeQualidadeDasMensagens(
  [{ qual: "a", texto: "Bom dia! O Evolutti atende bem o que você procura, quer ver?" }],
  { conversa, cerebro: "", catalogo: ["Evolutti", "Vista Verde"] }
);
assert.match(comCatalogo[0].motivos.join(" | "), /é produto seu, mas não foi falado com este cliente/,
  "com catálogo, o app sabe que o nome existe de verdade — o erro é a conversa, não o nome");
assert.ok(!/não aparece nesta conversa/.test(comCatalogo[0].motivos.join(" | ")),
  "e não acusa duas vezes o mesmo nome");

// Produto citado que ESTÁ na conversa continua sem aviso nenhum, com ou sem catálogo.
assert.equal(
  avisosDeQualidadeDasMensagens(
    [{ qual: "a", texto: "Sobre o Evolutti que conversamos: qual faixa de valor te atende?" }],
    { conversa: "Corretor: mandei o Evolutti pra você ver.", catalogo: ["Evolutti"] }
  ).length,
  0
);

// ── 6. O catálogo NÃO PODE virar fonte do texto das mensagens ────────────────────────────────
// Esta é a trava que impede de repetir o erro da Vanessa. Se alguém colar o catálogo no pedido
// enviado à IA, este teste fica vermelho — de propósito.
const fonte = await import("node:fs").then(fs => fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8"));
const inicioPrompt = fonte.indexOf("const prompt = `Execute a análise");
const fimPrompt = fonte.indexOf("// ===== FIM DO MIOLO DO PROMPT", inicioPrompt);
assert.ok(inicioPrompt > 0 && fimPrompt > inicioPrompt);
assert.ok(!/catalogo|catálogo/i.test(fonte.slice(inicioPrompt, fimPrompt)),
  "o catálogo aprendido não pode entrar no pedido que a IA recebe pra escrever as mensagens");
assert.ok(!/catalogoAprendidoTexto/.test(fonte),
  "a versão do catálogo que virava bloco de prompt foi retirada e não pode voltar");

console.log("v1335-catalogo-aprendido: ok");
