import fs from "node:fs";
import assert from "node:assert/strict";
import { parseWhatsappTxt, tratamentoDoCliente, montarFicharioDaConversa, ehSemConteudoComercial } from "../api/_pipeline.js";

// v1357 — DOIS DEFEITOS NO MESMO PRINT DO DONO (22/08/2026, 02h10).
//
// A) "porque vocês, no plural, se ele nunca falou (nós)?" — as três sugestões falavam com o cliente
//    no plural: "Esse horário funciona para vocês?", "vocês preferem mais cedo", "que funcione para
//    vocês". O cliente é UMA pessoa: em toda a conversa ele fala de si no singular ("estou em
//    visita", "não vou chegar", "te confirmo"), e o corretor o trata por "o Sr". O plural foi
//    inventado — e cliente percebe: parece mensagem de modelo, mandada pra qualquer um.
//
// B) Na conversa colada por ele aparece a linha "[Imagem lida pela IA] SEM CONTEÚDO COMERCIAL". A
//    leitura tinha funcionado e respondido certo — que ali não havia nada comercial. Só que a
//    conferência procurava "SEM CONTEUDO COMERCIAL" SEM ACENTO, e a resposta veio com "Ú". Não
//    bateu: a senha virou "conteúdo da imagem" e entrou na análise como fato da conversa.

const CONVERSA_DO_DONO = [
  "[20/08/2026 20:58] Construtora Senger: Olá, temos um apartamento com 2 dormitórios e box de garagem por R$ 430.000. Quer agendar uma visita?",
  "[20/08/2026 20:58] Vande Borges Investimento: Podemos agendar para amanhã à tarde?",
  "[20/08/2026 21:07] Construtora Senger: As 14h fica bom para o Sr?",
  "[21/08/2026 06:53] Vande Borges Investimento: Bom dia, tudo bem? Te confirmo até o meio-dia.",
  "[21/08/2026 11:58] Vande Borges Investimento: Bom dia fica melhor, estou em visita ao cliente e não vou chegar a tempo.",
  "[21/08/2026 11:59] Construtora Senger: Perfeito, pra mim também fica melhor"
].join("\n");
const LEAD = { clientName: "Vande Borges Investimento" };

// ── A1. O app conta, em vez de pedir pra IA adivinhar ────────────────────────────────────────
{
  const t = tratamentoDoCliente(parseWhatsappTxt(CONVERSA_DO_DONO), "Sanchai", LEAD);
  assert.equal(t.ehUmaPessoaSo, true, "o cliente do print é uma pessoa só — nunca falou de si no plural");
  assert.equal(t.comoOCorretorChama, "o Sr", "e o corretor o trata assim, na própria conversa");
}
// Cliente que fala no plural (casal, sócios) NÃO pode ser forçado ao singular.
{
  const casal = parseWhatsappTxt([
    "[20/08/2026 21:07] Construtora Senger: As 14h fica bom?",
    "[21/08/2026 06:53] Vande: Nós vamos ver com calma, nosso interesse é a sala 803"
  ].join("\n"));
  assert.equal(tratamentoDoCliente(casal, "Sanchai", { clientName: "Vande" }).ehUmaPessoaSo, false,
    "quem diz 'nós/nosso' é mais de um — aí plural é o certo");
}
// Corretor que já trata por "vocês" também não é corrigido: a régua é a conversa, não a minha opinião.
{
  const jaPlural = parseWhatsappTxt([
    "[20/08/2026 21:07] Construtora Senger: Bom dia! Vocês têm preferência de andar?",
    "[21/08/2026 06:53] Vande: Tenho sim, andar alto"
  ].join("\n"));
  assert.equal(tratamentoDoCliente(jaPlural, "Sanchai", { clientName: "Vande" }).ehUmaPessoaSo, false);
}
// Conversa sem fala do cliente não afirma nada (não inventa fato).
assert.equal(tratamentoDoCliente([], "Sanchai", LEAD).ehUmaPessoaSo, false);
assert.equal(tratamentoDoCliente(null).ehUmaPessoaSo, false);

// ── A2. O fato entra no fichário, com a instrução concreta ───────────────────────────────────
{
  const fichario = montarFicharioDaConversa(parseWhatsappTxt(CONVERSA_DO_DONO), "Sanchai", LEAD, new Date("2026-08-22T12:00:00Z"));
  assert.match(fichario, /COM QUEM VOCÊ ESTÁ FALANDO/, "o fichário precisa dizer com quem se está falando");
  assert.match(fichario, /É UMA pessoa só/);
  assert.match(fichario, /O tratamento desta conversa é "o Sr"/, "com o tratamento lido da própria conversa");
  // v1360 — e limitado: "mantenha esse tratamento" fez a IA enfiar "o Sr" em cada frase.
  assert.match(fichario, /NO MÁXIMO UMA VEZ por mensagem/);
  assert.match(fichario, /Não use "vocês"/, "e a instrução concreta, não meta-instrução");
}
{
  // Casal: o bloco NÃO aparece — nada de empurrar singular pra quem é dois.
  const fichario = montarFicharioDaConversa(parseWhatsappTxt([
    "[20/08/2026 21:07] Construtora Senger: As 14h fica bom?",
    "[21/08/2026 06:53] Vande: Nós vamos ver com calma, moramos perto"
  ].join("\n")), "Sanchai", { clientName: "Vande" }, new Date("2026-08-22T12:00:00Z"));
  assert.ok(!/COM QUEM VOCÊ ESTÁ FALANDO/.test(fichario), "sem certeza, o app não afirma nada");
}

// ── B. A senha da leitura de imagem passa a ser reconhecida com acento ───────────────────────
for (const t of ["SEM CONTEUDO COMERCIAL", "SEM CONTEÚDO COMERCIAL", "sem conteúdo comercial",
                 "SEM CONTEÚDO COMERCIAL.", "  SEM CONTEUDO COMERCIAL  "]) {
  assert.equal(ehSemConteudoComercial(t), true, `"${t}" é a senha e precisa ser reconhecida`);
}
for (const t of ["Tabela com valores de entrada e parcelas",
                 "SEM CONTEUDO COMERCIAL mas tem um preço de R$ 430.000", "", null]) {
  assert.equal(ehSemConteudoComercial(t), false, `"${t}" NÃO é a senha — não pode ser descartado como se fosse`);
}
{
  const fonte = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  assert.ok(!/\/\^SEM CONTEUDO COMERCIAL\$\/i\.test/.test(fonte),
    "a comparação literal (que perdia o acento) não pode voltar em lugar nenhum");
  assert.equal((fonte.match(/ehSemConteudoComercial\(/g) || []).length >= 3, true,
    "os dois pontos de leitura (imagem/PDF e link) precisam usar a mesma conferência");
}

console.log("v1357: ok");
