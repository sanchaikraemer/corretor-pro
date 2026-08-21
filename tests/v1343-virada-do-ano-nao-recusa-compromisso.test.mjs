import fs from "node:fs";
import assert from "node:assert/strict";

// v1343 — NA NOITE DE 31 DE DEZEMBRO, REMARCAR COMPROMISSO DEIXAVA DE FUNCIONAR.
//
// Achado numa revisão de 21/08/2026: a rota que remarca um compromisso conferia o ano assim —
// `new Date().getUTCFullYear()` — e recusava qualquer data de ano ANTERIOR ao atual. Parece certo,
// e é, menos por um detalhe: UTC é o relógio de Londres. Às 21h do dia 31 de dezembro em Brasília,
// em Londres já é 1º de janeiro. Naquela janela, o corretor que tentasse remarcar um compromisso
// pro próprio dia 31 recebia "Data fora do intervalo válido". No Acre (UTC-5) a janela do erro
// começa às 19h.
//
// Ninguém tinha visto porque nenhum teste rodava na virada do ano — e a suíte inteira também não
// era conferida com o relógio adiantado. Esta é a mesma família de problema que a v1337 tratou nas
// telas: hora lida no fuso errado.

const rota = fs.readFileSync(new URL("../api/reanalisar-lead.js", import.meta.url), "utf8");

// ── 1. O piso do ano não pode mais sair do relógio de Londres ────────────────────────────────
const bloco = rota.slice(rota.indexOf('if (body?.action === "reagendar-lembrete")'));
// O recorte vai do "quebra a data em ano/mês/dia" até o fim da conferência. (Não dá pra ancorar na
// frase do erro: ela também aparece no comentário que explica o conserto, logo acima.)
const inicioConferencia = bloco.indexOf("const [y, mo, d] =");
const fimConferencia = bloco.indexOf("d > 31)", inicioConferencia);
assert.ok(inicioConferencia > -1 && fimConferencia > inicioConferencia, "sanidade: achei a conferência da data na rota");
const conferencia = bloco.slice(inicioConferencia, fimConferencia + 40);
assert.match(conferencia, /anoMaisAtrasadoDoBrasil/,
  "o piso do ano precisa considerar o fuso brasileiro mais atrasado, não só o UTC");
assert.match(conferencia, /const anoMinimo = Math\.min\(anoAtual, anoMaisAtrasadoDoBrasil\);/);
assert.match(conferencia, /if \(y < anoMinimo \|\| y > anoAtual \+ 5/,
  "o teto continua sendo 5 anos à frente; o que mudou é o piso");
assert.ok(!/if \(y < anoAtual \|\|/.test(conferencia),
  "a conferência antiga (piso no ano UTC) não pode voltar — é ela que recusa compromisso na noite de 31/12");

// ── 2. A regra, rodada de verdade, em cada instante perigoso ─────────────────────────────────
// Reproduz a conta exatamente como a rota faz, e confere o que o corretor viveria em cada ponto do
// país. O ano que ele está vivendo tem que ser sempre aceito.
const anoAceito = (instanteISO, anoPedido) => {
  const agoraData = new Date(instanteISO);
  const anoAtual = agoraData.getUTCFullYear();
  const anoMaisAtrasadoDoBrasil = new Date(agoraData.getTime() - 5 * 3600000).getUTCFullYear();
  const anoMinimo = Math.min(anoAtual, anoMaisAtrasadoDoBrasil);
  return !(anoPedido < anoMinimo || anoPedido > anoAtual + 5);
};

// 31/12/2026 às 22h em Brasília (UTC-3) — em Londres já é 2027.
assert.equal(anoAceito("2026-12-31T22:00:00-03:00", 2026), true,
  "remarcar pro dia 31 de dezembro, na noite do dia 31, tem que funcionar");
// 31/12/2026 às 20h em Rio Branco (UTC-5) — em Londres já é 2027.
assert.equal(anoAceito("2026-12-31T20:00:00-05:00", 2026), true,
  "no Acre a janela do erro é maior: também tem que funcionar");
// 31/12/2026 às 23h em Fernando de Noronha (UTC-2).
assert.equal(anoAceito("2026-12-31T23:00:00-02:00", 2026), true);
// Dia comum, no meio do ano: nada muda.
assert.equal(anoAceito("2026-06-15T10:00:00-03:00", 2026), true);
assert.equal(anoAceito("2026-06-15T10:00:00-03:00", 2031), true, "cinco anos à frente continua valendo");
assert.equal(anoAceito("2026-06-15T10:00:00-03:00", 2032), false, "seis anos à frente continua recusado");
// E o motivo de a regra existir continua de pé: ano claramente passado é recusado.
assert.equal(anoAceito("2026-06-15T10:00:00-03:00", 2024), false,
  "remarcar pra um ano que já passou continua sendo recusado — a correção não virou peneira");
assert.equal(anoAceito("2027-06-15T10:00:00-03:00", 2026), false,
  "em junho de 2027, o ano de 2026 já passou de verdade: recusado");

console.log("v1343-virada-do-ano-nao-recusa-compromisso: ok");
