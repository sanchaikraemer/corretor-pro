import assert from "node:assert/strict";
import { compromissoDaConversa, sinaisDeIntermediario, montarFicharioDaConversa } from "../api/_pipeline.js";

// v1364 — A CORREÇÃO NÃO PODE SER REMENDO DO CASO VANDE.
//
// Casos sintéticos da mesma análise de 22/08/2026 (A a F), garantindo que o motor de compromisso
// generaliza: reunião que surge não mata a visita; "achei caro" SIM é recuo comercial; "Ok" do
// cliente não transfere a autoria do adiamento; "atendendo um cliente" não vira corretor;
// "sou corretor" + "meu cliente" vira; e um único próximo passo autoriza as três a convergir.

const C = "Ana Corretora";
const lead = { clientName: "Bruno" };
const AGORA = new Date(2026, 7, 22, 10, 0);
const m = (author, date, text) => ({ author, date, text });

// ── Caso A: desmarcou por reunião de trabalho → compromisso continua vivo ────────────────────
{
  const tl = [
    m("Bruno", "18/08/2026", "Quero conhecer."),
    m("Bruno", "18/08/2026", "Pode ser amanhã às 15h."),
    m(C, "18/08/2026", "Perfeito, te espero!"),
    m("Bruno", "19/08/2026", "Hoje não vou conseguir, surgiu uma reunião.")
  ];
  const c = compromissoDaConversa(tl, C, lead, AGORA);
  assert.ok(c, "caso A: o compromisso existe");
  assert.equal(c.tipo, "visita");
  assert.equal(c.clientePropoDataEspontaneamente, true, "caso A: o cliente propôs amanhã às 15h");
  assert.equal(c.horarioProposto, "15h");
  assert.equal(c.motivoComercial, false, "caso A: reunião que surgiu é agenda, não objeção");
  assert.equal(c.continuaValido, true, "caso A: não é perda de interesse");
  assert.ok(c.pendencia, "caso A: sobra a pendência de nova data");
}

// ── Caso B: "achei caro, vou deixar para outro momento" → recuo comercial de verdade ─────────
{
  const tl = [
    m(C, "18/08/2026", "Vamos marcar uma visita ao apartamento?"),
    m("Bruno", "18/08/2026", "Pode ser."),
    m("Bruno", "19/08/2026", "Achei caro, vou deixar para outro momento.")
  ];
  const c = compromissoDaConversa(tl, C, lead, AGORA);
  assert.ok(c, "caso B: o compromisso existe");
  assert.equal(c.motivoComercial, true, "caso B: 'achei caro' É objeção comercial");
  assert.equal(c.continuaValido, false, "caso B: o compromisso não segue de pé como se nada tivesse acontecido");
  const fichario = montarFicharioDaConversa(tl, C, lead, AGORA);
  assert.ok(!/ondePerdeuForca fica VAZIO/.test(fichario),
    "caso B: com objeção real, o fichário NÃO manda esvaziar a perda de força");
  assert.ok(!/O próximo avanço é UM só/.test(fichario),
    "caso B: com objeção real, o fichário NÃO manda convergir na remarcação");
}

// ── Caso C: o corretor propôs adiar e o cliente disse "Ok" → a autoria continua do corretor ──
{
  const tl = [
    m(C, "18/08/2026", "Vamos marcar uma visita?"),
    m("Bruno", "18/08/2026", "Vamos sim!"),
    m(C, "19/08/2026", "Podemos deixar para semana que vem."),
    m("Bruno", "19/08/2026", "Ok.")
  ];
  const c = compromissoDaConversa(tl, C, lead, AGORA);
  assert.ok(c && c.adiamento, "caso C: o adiamento existe");
  assert.equal(c.quemPropsAdiamento, "corretor", "caso C: aceitar não é propor — a ideia foi do corretor");
  const fichario = montarFicharioDaConversa(tl, C, lead, AGORA);
  assert.ok(/O cliente NÃO pediu esse adiamento/.test(fichario),
    "caso C: o fichário proíbe atribuir o adiamento ao cliente");
}

// ── Caso D: "estou atendendo um cliente agora" → não é corretor imobiliário ──────────────────
{
  const tl = [
    m(C, "18/08/2026", "Oi Bruno, conseguiu ver as fotos?"),
    m("Bruno", "18/08/2026", "Estou atendendo um cliente agora, te falo depois.")
  ];
  const papel = sinaisDeIntermediario(tl, C, lead);
  assert.equal(papel.fortes.length, 0, "caso D: nenhum sinal imobiliário");
  assert.equal(papel.fracos.length, 1, "caso D: a menção é fraca");
  const fichario = montarFicharioDaConversa(tl, C, lead, AGORA);
  assert.ok(fichario.includes("QUEM É ESTE CONTATO"), "caso D: o aviso entra no fichário");
}

// ── Caso E: "meu cliente gostou do apartamento... sou corretor" → parceiro de verdade ────────
{
  const tl = [
    m(C, "18/08/2026", "Olá! Em que posso ajudar?"),
    m("Bruno", "18/08/2026", "Meu cliente gostou do apartamento. Posso levar ele amanhã? Sou corretor.")
  ];
  const papel = sinaisDeIntermediario(tl, C, lead);
  assert.ok(papel.fortes.length >= 1, "caso E: 'sou corretor' + 'meu cliente' com imóvel é sinal forte");
  const fichario = montarFicharioDaConversa(tl, C, lead, AGORA);
  assert.ok(!fichario.includes("QUEM É ESTE CONTATO"),
    "caso E: com sinal forte o aviso NÃO aparece — a classificação de parceiro continua como hoje");
}

// ── Caso F: um único próximo passo claro → o fichário autoriza e manda convergir ─────────────
{
  const tl = [
    m("Bruno", "20/08/2026", "Podemos marcar uma visita?"),
    m(C, "20/08/2026", "Claro! Quinta às 10h fica bom?"),
    m("Bruno", "21/08/2026", "Quinta não vou conseguir, surgiu um compromisso.")
  ];
  const c = compromissoDaConversa(tl, C, lead, AGORA);
  assert.ok(c && c.continuaValido && c.pendencia, "caso F: um único próximo passo (remarcar)");
  const fichario = montarFicharioDaConversa(tl, C, lead, AGORA);
  assert.ok(/O próximo avanço é UM só/.test(fichario) && /mudando só a FORMA/.test(fichario),
    "caso F: as três mensagens podem convergir sem inventar três objetivos");
}

// ── Compromisso PARADO há meses não volta como "de pé" mandando convergir ────────────────────
{
  const tl = [
    m("Bruno", "10/03/2026", "Podemos marcar uma visita?"),
    m(C, "10/03/2026", "Claro! Quinta às 10h?"),
    m("Bruno", "11/03/2026", "Quinta não vou conseguir, surgiu um imprevisto.")
  ];
  const c = compromissoDaConversa(tl, C, lead, AGORA);
  assert.ok(c, "compromisso antigo: os fatos continuam existindo");
  assert.equal(c.recente, false, "compromisso antigo: mais de 45 dias parado não é quente");
  assert.equal(c.quemPropsAdiamento, "", "sem adiamento aqui");
  const fichario = montarFicharioDaConversa(tl, C, lead, AGORA);
  assert.ok(/ficou no ar e nunca virou data/.test(fichario),
    "compromisso antigo: o fichário conta o fato sem fingir que está quente");
  assert.ok(!/O próximo avanço é UM só/.test(fichario),
    "compromisso antigo: NÃO manda as três convergirem numa visita fria");
}

// ── Sem vocabulário de compromisso, nada é inventado ─────────────────────────────────────────
{
  const tl = [
    m("Bruno", "18/08/2026", "Qual o valor do apartamento?"),
    m(C, "18/08/2026", "R$ 500.000, com entrada facilitada.")
  ];
  assert.equal(compromissoDaConversa(tl, C, lead, AGORA), null,
    "conversa sem compromisso devolve null — o bloco não aparece do nada");
}

console.log("v1364-compromisso-casos-gerais: ok (A–F: agenda ≠ objeção, autoria, corretor de verdade, convergência)");
