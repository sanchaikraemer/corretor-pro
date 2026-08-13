// v1245 — a lista de LINGUAGEM PROIBIDA passa a ser lida do Cérebro do próprio corretor.
//
// Em 13/08/2026 o dono colou o conteúdo inteiro do Cérebro dele. Conferindo item por item contra o
// código, a lista dura que o código usava tinha nascido copiando a lista dele À MÃO — e ficou pra
// trás. Estas seis frases estão escritas na LINGUAGEM PROIBIDA do Cérebro dele e NENHUM código
// pegava: "só passando para saber", "passando para saber", "ainda tem interesse?", "ficou alguma
// dúvida?", "como posso ajudar?", "é só me avisar", "só me chamar".
//
// A regra que ele repete desde o começo é "a única regra era seguir as ordens do cerebro". Copiar a
// lista dele pro código de novo repetiria o mesmo erro na próxima vez que ele editar o Cérebro.
// Agora o corte determinístico LÊ a lista dele. Ele acrescenta uma frase lá, o corte aprende na
// hora — sem versão nova.
//
// A parte delicada: a lista dele tem itens CONDICIONAIS ("o que achou?" sem contexto específico,
// gíria "salvo se o próprio cliente usar esse padrão"). Cortar esses sempre seria pior que não
// cortar — o Método DELE manda fechar com "o que acha?". Frase com ressalva vira SUSPEITA (vai pra
// releitura, que tem a conversa na mão) e nunca corte cego.
import assert from "node:assert/strict";
import { frasesProibidasDoCerebro, detectarFrasesProibidas, limparFrasesProibidas } from "../api/_pipeline.js";

// Trecho real do Cérebro dele, com as quebras de linha como ele colou (o texto vem de um campo de
// digitação, então frase partida no meio é o normal, não a exceção).
const CEREBRO = {
  metodo: `- Não use "oi" ou "olá" como substitutos da regra de saudação do Método.
- Não use formalidade excessiva como "Estimado cliente" ou "Atenciosamente".
- Não use gírias como "buenas", "blz", "tamo junto" salvo se o próprio cliente usar esse padrão e houver
proximidade real.
- FECHO CURTO. Termine com uma pergunta curta ("o que acha?", "o que você prefere?", "consigo separar?")
e não repita em outras palavras o que a mensagem já disse.
- LINGUAGEM PROIBIDA (nunca escrever, em nenhuma variação): "espero que esteja bem", "faz sentido",
"fico à disposição", "qualquer dúvida estou aqui", "só passando para saber", "passando para saber",
"ainda tem interesse?", "ficou alguma dúvida?", "como posso ajudar?", "o que achou?" sem contexto
específico, "é só me avisar", "só me chamar", "conforme conversamos" quando não houve conversa real.`,
  tom: "", diferenciais: "", evitar: "", regrasTexto: "", objecoesTexto: ""
};

const lidas = frasesProibidasDoCerebro(CEREBRO);

// ── 1. AS SEIS QUE FALTAVAM ────────────────────────────────────────────────────────────────────
for (const f of ["so passando para saber", "passando para saber", "ainda tem interesse",
  "ficou alguma duvida", "como posso ajudar", "e so me avisar", "so me chamar"]) {
  assert.ok(lidas.proibidas.includes(f),
    `"${f}" está proibida no Cérebro dele e precisa ser lida de lá`);
}
// Formalidade excessiva também é ordem dele, no mesmo formato.
assert.ok(lidas.proibidas.includes("estimado cliente"), "a formalidade que ele proíbe também entra");

// ── 2. O QUE NÃO PODE VIRAR CORTE CEGO ─────────────────────────────────────────────────────────
// "o que achou?" só é proibida SEM CONTEXTO — e o fecho que ele RECOMENDA é "o que acha?".
assert.ok(!lidas.proibidas.includes("o que achou"),
  'frase com ressalva ("sem contexto específico") não pode virar corte automático');
assert.ok(lidas.suspeitas.includes("o que achou"),
  "ela vira suspeita: quem decide é a releitura, que tem a conversa na mão");
assert.ok(!lidas.proibidas.includes("o que acha"),
  'o fecho que o próprio Método dele recomenda ("o que acha?") não pode ser proibido');
// Gíria com ressalva idem — ele fala "mano"/"buenas" com quem fala assim com ele.
assert.ok(lidas.suspeitas.includes("tamo junto") && !lidas.proibidas.includes("tamo junto"),
  'gíria "salvo se o próprio cliente usar" é contexto, não proibição dura');
// Palavra solta nunca entra: cortar "oi" ou "blz" levaria meia mensagem junto.
for (const curta of ["oi", "ola", "blz", "buenas", "atenciosamente"]) {
  assert.ok(!lidas.proibidas.includes(curta), `"${curta}" é palavra solta — não pode virar corte`);
}
// Linha sem marcador de proibição não vira lista: o FECHO CURTO é recomendação, não proibição.
assert.ok(!lidas.proibidas.includes("consigo separar"),
  "frase citada numa RECOMENDAÇÃO dele não pode ser lida como proibição");

// ── 3. O CORTE USA A LISTA DELE, DE VERDADE ────────────────────────────────────────────────────
const casos = [
  ["Bom dia Rose, tudo bem? Só passando para saber se ainda tem interesse no apartamento.",
   "Bom dia Rose, tudo bem?"],
  ["Rose, consegui a planta do 3 dormitórios. Como posso ajudar?",
   "Rose, consegui a planta do 3 dormitórios."],
  ["Rose, a simulação está pronta. É só me avisar.",
   "Rose, a simulação está pronta."]
];
for (const [entrada, esperado] of casos) {
  assert.equal(limparFrasesProibidas(entrada, lidas), esperado,
    `o corte precisa tirar a frase que o Cérebro dele proíbe: "${entrada}"`);
}
// E o fecho recomendado por ele passa inteiro.
const bom = "Rose, o que acha de eu confirmar a disponibilidade hoje?";
assert.equal(limparFrasesProibidas(bom, lidas), bom, "o fecho que ele recomenda não pode ser cortado");

// ── 4. SEM CÉREBRO, NADA MUDA ──────────────────────────────────────────────────────────────────
// Conta nova, Cérebro vazio, Cérebro sem lista nenhuma: continua valendo só a lista do código.
for (const vazio of [null, undefined, {}, { metodo: "Seja cordial e objetivo." }]) {
  const r = frasesProibidasDoCerebro(vazio);
  assert.deepEqual(r, { proibidas: [], suspeitas: [] },
    "Cérebro sem lista de proibições não pode inventar corte nenhum");
}
const semExtras = "Bom dia Rose, tudo bem? Só passando para saber se seguimos.";
assert.equal(limparFrasesProibidas(semExtras, null), semExtras,
  "sem a lista do Cérebro, o comportamento antigo continua igual");
// A lista dura do código continua valendo em qualquer caso.
assert.ok(detectarFrasesProibidas("Fico à disposição.", null).proibidas.length,
  "as proibições que já eram do código continuam de pé");

// ── 5. RESSALVA NO CÉREBRO NÃO AFROUXA O QUE JÁ ERA PROIBIDO NO CÓDIGO ─────────────────────────
// "conforme conversamos" aparece na lista dele com ressalva ("quando não houve conversa real"), mas
// já é proibição dura do código desde a v1235. A ressalva não pode rebaixá-la.
assert.ok(!lidas.suspeitas.includes("conforme conversamos"),
  "frase já proibida pelo código não é rebaixada por uma ressalva escrita no Cérebro");
assert.ok(detectarFrasesProibidas("Segue a simulação, conforme conversamos.", lidas).proibidas.length,
  "e ela continua sendo cortada");

console.log("v1245-linguagem-proibida-vem-do-cerebro: ok");
