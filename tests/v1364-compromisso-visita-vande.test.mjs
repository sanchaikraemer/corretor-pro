import assert from "node:assert/strict";
import { compromissoDaConversa, sinaisDeIntermediario, sinaisFortesDoCliente, montarFicharioDaConversa } from "../api/_pipeline.js";

// v1364 — O CASO VANDE, POR SIGNIFICADO (não por frase pronta).
//
// Análise trazida pelo dono em 22/08/2026, com a leitura comercial correta do atendimento:
//   • o CLIENTE pediu a visita espontaneamente ("Podemos agendar para amanhã à tarde?");
//   • a visita não aconteceu por AGENDA ("estou em visita ao cliente e não vou chegar a tempo"),
//     não por objeção comercial;
//   • a preferência dele é MANHÃ ("Bom dia fica melhor");
//   • quem propôs deixar pra semana que vem foi O CORRETOR — a análise publicada tinha invertido
//     a autoria ("Vande informou que seria melhor deixar para a semana seguinte");
//   • "estou em visita ao cliente" NÃO faz do contato um corretor/parceiro;
//   • o compromisso continua de pé e a única pendência é dia e horário.
// Este teste garante que o app reconstrói exatamente essa realidade, sozinho, antes da IA.

const C = "Construtora Senger";
const V = "Vande Borges Investimento";
const lead = { clientName: V };
const AGORA = new Date(2026, 7, 22, 10, 0);

const TIMELINE = [
  { author: V, date: "17/04/2025", text: "Olá! Tenho interesse e queria mais informações, por favor." },
  { author: C, date: "18/04/2025", text: "Boa tarde, tudo bem? Vou enviar um link com todas informações." },
  { author: C, date: "18/04/2025", text: "*Sugestão de pagamento* Oportunidade para investidores! Salas comerciais a partir de R$ 380.000" },
  { author: V, date: "18/04/2025", text: "Vou analisar, me interessa uma sala nesse valor e condições." },
  { author: C, date: "18/04/2025", text: "Perfeito, fico as ordens. Lhe chamo semana que vem, abraço e bom feriado." },
  { author: C, date: "24/04/2025", text: "Bom dia, tudo bem?" },
  { author: C, date: "20/08/2026", text: "Anúncio do Instagram Olá, temos um apartamento com 2 dormitórios e box de garagem por R$ 430.000. Quer agendar uma visita?" },
  { author: V, date: "20/08/2026", text: "Podemos agendar para amanhã à tarde?" },
  { author: C, date: "20/08/2026", text: "Claro" },
  { author: C, date: "20/08/2026", text: "As 14h fica bom para o Sr?" },
  { author: V, date: "21/08/2026", text: "Bom dia, tudo bem? Te confirmo até o meio-dia." },
  { author: C, date: "21/08/2026", text: "Bom dia" },
  { author: C, date: "21/08/2026", text: "Tudo bem e o Sr?" },
  { author: C, date: "21/08/2026", text: "Se quiser deixar para semana que vem com calma, posso atendel-lo qualquer dia, inclusive durante o meio dia se for mais interessante" },
  { author: V, date: "21/08/2026", text: "Bom dia fica melhor, estou em visita ao cliente e não vou chegar a tempo." },
  { author: C, date: "21/08/2026", text: "Perfeito, pra mim também fica melhor, assim vou seguir com a viagem q tinha marcado para a tarde" },
  { author: C, date: "21/08/2026", text: "Vamos falando por whats tambem q vou lhe ajudando com mais informalções, e semana q vem sentamos tomar um café entao" }
];

// ── 1. O compromisso reconstruído: visita viva, pedida pelo cliente, desmarcada por agenda ───
const c = compromissoDaConversa(TIMELINE, C, lead, AGORA);
assert.ok(c, "a conversa TEM um compromisso e o app precisa enxergá-lo");
assert.equal(c.tipo, "visita");
assert.equal(c.clientePediu, true, "o cliente pediu para marcar");
assert.equal(c.clientePropoDataEspontaneamente, true, "o cliente propôs data por iniciativa própria (amanhã à tarde)");
assert.equal(c.horarioProposto, "14h", "o horário na mesa é o 14h proposto pelo corretor");
assert.ok(c.naoAconteceu && c.naoAconteceu.quem === "cliente", "quem desmarcou foi o cliente");
assert.equal(c.motivoComercial, false, "conflito de agenda NÃO é motivo comercial");
assert.equal(c.desistiu, false, "não houve desistência");
assert.equal(c.continuaValido, true, "o compromisso continua de pé");
assert.ok(c.pendencia.includes("dia e horário"), "a pendência é definir dia e horário");

// ── 2. A autoria do adiamento: foi o CORRETOR, nunca o cliente ───────────────────────────────
assert.equal(c.quemPropsAdiamento, "corretor",
  "quem falou em semana que vem foi o corretor — foi exatamente esta autoria que a análise publicada inverteu");

// ── 3. A preferência de manhã, dita pelo cliente ("Bom dia fica melhor") ─────────────────────
assert.ok(c.preferencia, "a preferência de período precisa existir");
assert.equal(c.preferencia.quem, "cliente");
assert.equal(c.preferencia.periodo, "manhã");
// E a saudação "Bom dia, tudo bem?" NÃO pode ter virado preferência: a fala que sustenta é a do
// "fica melhor".
assert.ok(/fica melhor/i.test(c.preferencia.trecho), "a evidência é a fala com 'fica melhor', não a saudação");

// ── 4. "Estou em visita ao cliente" não faz dele corretor/parceiro ───────────────────────────
const papel = sinaisDeIntermediario(TIMELINE, C, lead);
assert.equal(papel.fortes.length, 0, "não há nenhum sinal imobiliário nas falas do Vande");
assert.ok(papel.fracos.length >= 1, "a menção fraca a 'cliente' existe e fica registrada como fraca");

// ── 5. O pedido de visita é o sinal comercial mais forte, com data ───────────────────────────
const sinais = sinaisFortesDoCliente(TIMELINE, C, lead, AGORA);
const pediuVisita = sinais.find(s => s.rotulo.includes("visita"));
assert.ok(pediuVisita, "pedir a visita entra na lista de sinais fortes do cliente");
assert.ok(/agendar para amanh/i.test(pediuVisita.trecho));
assert.equal(pediuVisita.diasAtras, 2);

// ── 6. O fichário entrega tudo isso pronto pra IA, com as ordens certas ──────────────────────
const fichario = montarFicharioDaConversa(TIMELINE, C, lead, AGORA);
assert.ok(fichario.includes("O COMPROMISSO DESTA CONVERSA"), "o bloco do compromisso entra no fichário");
assert.ok(/O PRÓPRIO CLIENTE, por iniciativa dele/.test(fichario), "diz que o pedido partiu do cliente");
assert.ok(/motivo de AGENDA, não comercial/.test(fichario), "separa agenda de objeção");
assert.ok(/O CORRETOR/.test(fichario) && /O cliente NÃO pediu esse adiamento/.test(fichario),
  "crava a autoria do adiamento e proíbe atribuí-la ao cliente");
assert.ok(/ondePerdeuForca fica VAZIO/.test(fichario),
  "manda a IA não inventar perda de força em remarcação de agenda");
assert.ok(/O próximo avanço é UM só/.test(fichario) && /mudando só a FORMA/.test(fichario),
  "manda as três mensagens convergirem no mesmo avanço, variando só a forma");
assert.ok(/manhã/.test(fichario) && /respeite o período/.test(fichario),
  "manda respeitar a preferência de manhã");
assert.ok(fichario.includes("QUEM É ESTE CONTATO"),
  "avisa que 'em visita ao cliente' não faz dele corretor");
assert.ok(/Não classifique este contato como corretor\/parceiro/.test(fichario));
assert.ok(fichario.includes("SINAIS COMERCIAIS FORTES"), "o bloco de sinais fortes entra");
assert.ok(/não trate como retomada fria/.test(fichario));
// v1367 — o "PRÓXIMOS PASSOS QUE O CORRETOR JÁ PROPÔS" sumiu desta conversa, e sumiu CERTO: o
// único item era a frase automática do anúncio ("Anúncio do Instagram ... Quer agendar uma
// visita?"), que o robô dispara e o corretor não escreveu. Robô não propõe nada.
assert.ok(!fichario.includes("PRÓXIMOS PASSOS"),
  "a frase automática do anúncio não pode contar como passo proposto pelo corretor (v1367)");
// A ordem continua valendo quando o bloco existe de verdade: a fala do cliente (compromisso) não
// pode pesar menos que o convite do corretor.
{
  const comConvite = montarFicharioDaConversa(
    [...TIMELINE, { author: C, date: "21/08/2026", text: "Posso te levar para conhecer o apartamento na quinta?" }],
    C, lead, AGORA
  );
  assert.ok(comConvite.includes("PRÓXIMOS PASSOS"), "convite escrito pelo corretor continua entrando");
  assert.ok(comConvite.indexOf("O COMPROMISSO DESTA CONVERSA") < comConvite.indexOf("PRÓXIMOS PASSOS"),
    "o compromisso (com a fala do cliente) vem antes do bloco de convites do corretor");
}

console.log("v1364-compromisso-visita-vande: ok (visita viva, autoria certa, agenda ≠ objeção, manhã preservada)");
