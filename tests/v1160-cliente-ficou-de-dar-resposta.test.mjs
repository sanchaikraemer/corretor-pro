import fs from "node:fs";
import assert from "node:assert/strict";

// v1160 — caso real do dono: "ontem a Cláudia pediu infos, mandei, e ela ficou de falar com o marido
// à noite. Hoje teria que dar um toque nela, o que acha?". O app não ajudava em nada nisso: como ele
// tinha ACABADO de atender, ela estava no descanso e não aparecia em lugar nenhum — ele lembrou de
// cabeça. Proposta aceita ("pode ser, boa ideia"): quando o cliente fica de dar uma resposta, o app
// propõe o retorno e ele confirma com um toque.
//
// Tudo sai das mensagens JÁ IMPORTADAS — nenhuma chamada de IA, nenhum custo, vale pra carteira
// inteira sem reanalisar ninguém.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ── Roda a detecção de verdade ─────────────────────────────────────────────────────────────────
const pedacos = [
  /const CP1160_PROMETE_RETORNO = [\s\S]*?;\n/,
  /const CP1160_VAI_CONSULTAR = [\s\S]*?;\n/,
  /const CP1160_VAI_PENSAR = [\s\S]*?;\n/,
  /const CP1160_DESISTIU = [\s\S]*?;\n/,
  /const CP1160_DIAS_SEMANA = [\s\S]*?;\n/,
  /function cp1160TemPromessa\(texto\)\{[\s\S]*?\n\}/,
  /function cp1160SomaDias\(iso, n\)\{[\s\S]*?\n\}/,
  /function cp1160DiaDaMensagem\(m\)\{[\s\S]*?\n\}/,
  /function cp1160MomentoIso\(texto, baseIso\)\{[\s\S]*?\n\}/,
  /function cp1160PromessaDoCliente\(l\)\{[\s\S]*?\n\}/,
  /function cp1160Pendentes\(items\)\{[\s\S]*?\n\}/
].map(re => {
  const m = app.match(re);
  assert.ok(m, `trecho não encontrado: ${re}`);
  return m[0];
});

const api = eval(`
  const ehMsgDoCliente = (m) => String(m?.autor||m?.author||"") === "cliente";
  const leadEhAtivo = (l) => l?.__ativo !== false;
  const ehContatadoHoje = (l) => !!l?.__hoje;
  const cp786TemCompromisso = (l) => !!l?.__agendado;
  const ui671HojeIso = () => "2026-08-06";
  const ui671DiasAte = (data) => {
    if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(data||""))) return null;
    const a = new Date("2026-08-06T12:00:00-03:00"), b = new Date(String(data)+"T12:00:00-03:00");
    return Math.round((b - a) / 86400000);
  };
  ${pedacos.join("\n")}
  ({ cp1160PromessaDoCliente, cp1160Pendentes, cp1160MomentoIso, cp1160TemPromessa });
`);

const msgCliente = (texto, iso) => ({ autor: "cliente", text: texto, iso });
const msgCorretor = (texto, iso) => ({ autor: "corretor", text: texto, iso });
const ONTEM = "2026-08-05T22:10:00-03:00";
const HOJE = "2026-08-06T09:00:00-03:00";

// 1. O CASO DA CLÁUDIA: falou ontem à noite que ia falar com o marido → propõe retomar HOJE.
{
  const lead = { id: 1, name: "Cliente Exemplo", recentMessages: [
    msgCorretor("Segue o material que combinamos.", "2026-08-05T20:00:00-03:00"),
    msgCliente("Obrigada! Vou falar com meu marido hoje à noite e te falo.", ONTEM)
  ] };
  const p = api.cp1160PromessaDoCliente(lead);
  assert.ok(p, "a promessa é reconhecida");
  assert.equal(p.diaIso, "2026-08-05", "o dia da fala dela");
  assert.equal(p.retornoIso, "2026-08-06", "o retorno proposto é o dia seguinte ao prazo que ela deu");
  assert.equal(p.sugestaoIso, "2026-08-06", "e é o que o botão agenda");
  assert.equal(p.diasAtras, 1, "ela disse isso ontem");
  assert.equal(api.cp1160Pendentes([lead]).length, 1, "entra na faixa da Home: o dia chegou");
}

// 2. Formas diferentes de prometer resposta — todas contam.
for (const texto of [
  "Vou falar com minha esposa e te aviso",
  "Preciso ver com o banco antes de decidir",
  "Te falo amanhã sem falta",
  "Fico de te retornar depois",
  "Vou pensar com calma",
  "Vou conversar com meu sócio",
  "Qualquer coisa eu te chamo"
]) assert.ok(api.cp1160TemPromessa(texto), `deveria contar como promessa: "${texto}"`);

// 3. E o que NÃO pode virar promessa (senão a faixa vira lixo na tela).
for (const texto of [
  "Vou ver o apartamento no sábado",            // visita, não resposta
  "Quanto ficou a parcela?",                    // pergunta
  "Bom dia! Tudo bem?",
  "Gostei muito do decorado"
]) assert.ok(!api.cp1160TemPromessa(texto), `NÃO deveria contar como promessa: "${texto}"`);

// 4. Desistiu na última fala: não se propõe retorno pra quem disse não.
{
  const lead = { id: 2, name: "Cliente Exemplo", recentMessages: [
    msgCliente("Vou falar com meu marido e te aviso", "2026-07-30T10:00:00-03:00"),
    msgCliente("Falei com ele, desisti por agora", ONTEM)
  ] };
  assert.equal(api.cp1160PromessaDoCliente(lead), null, "desistência clara cancela a proposta");
}

// 5. O prazo dele é respeitado: prometeu resposta pra amanhã → hoje NÃO aparece na Home.
{
  const lead = { id: 3, name: "Cliente Exemplo", recentMessages: [
    msgCliente("Vou falar com minha esposa amanhã e te respondo", HOJE)
  ] };
  const p = api.cp1160PromessaDoCliente(lead);
  assert.equal(p.retornoIso, "2026-08-08", "retorno = o dia seguinte ao prazo que ele deu");
  assert.equal(api.cp1160Pendentes([lead]).length, 0, "não cobra antes da hora");
}

// 6. Prazo vencido há dias: continua aparecendo, e o botão agenda pra HOJE (nunca uma data passada).
{
  const lead = { id: 4, name: "Cliente Exemplo", recentMessages: [
    msgCliente("Vou conversar com meu marido e te falo", "2026-07-28T15:00:00-03:00")
  ] };
  const p = api.cp1160PromessaDoCliente(lead);
  assert.equal(p.retornoIso, "2026-07-29", "o prazo era dia 29");
  assert.equal(p.sugestaoIso, "2026-08-06", "mas agendar é sempre pra hoje quando já venceu");
  assert.equal(api.cp1160Pendentes([lead])[0].promessa.diasAtras, 9, "e mostra há quanto tempo ele disse");
}

// 7. Promessa velha (mais de 45 dias) não entra: esse é caso das vagas de resgate, não desta faixa.
{
  const lead = { id: 5, name: "Cliente Exemplo", recentMessages: [
    msgCliente("Vou falar com meu marido e te aviso", "2026-05-01T10:00:00-03:00")
  ] };
  assert.equal(api.cp1160PromessaDoCliente(lead), null, "promessa de 3 meses atrás não vale mais");
}

// 8. Quem já foi atendido hoje, quem já está agendado e quem está arquivado ficam fora da faixa.
{
  const base = { name: "Cliente Exemplo", recentMessages: [ msgCliente("Vou falar com meu marido e te falo", ONTEM) ] };
  assert.equal(api.cp1160Pendentes([{ ...base, id: 6, __hoje: true }]).length, 0, "atendido hoje sai");
  assert.equal(api.cp1160Pendentes([{ ...base, id: 7, __agendado: true }]).length, 0, "já agendado sai");
  assert.equal(api.cp1160Pendentes([{ ...base, id: 8, __ativo: false }]).length, 0, "arquivado sai");
}

// 9. Só as 3 últimas falas do cliente contam (promessa enterrada em conversa nova não vale).
{
  const lead = { id: 9, name: "Cliente Exemplo", recentMessages: [
    msgCliente("Vou falar com meu marido", "2026-08-01T10:00:00-03:00"),
    msgCliente("Qual o valor do condomínio?", "2026-08-04T10:00:00-03:00"),
    msgCliente("E a vaga é coberta?", "2026-08-04T11:00:00-03:00"),
    msgCliente("Obrigada", ONTEM)
  ] };
  assert.equal(api.cp1160PromessaDoCliente(lead), null, "promessa antiga, com 3 falas depois, não conta");
}

// 10. "Segunda" / "semana que vem" viram data de verdade (contando do dia em que ele falou).
assert.equal(api.cp1160MomentoIso("te falo na segunda", "2026-08-06"), "2026-08-10", "segunda seguinte");
assert.equal(api.cp1160MomentoIso("te aviso semana que vem", "2026-08-06"), "2026-08-13", "semana que vem = +7");
assert.equal(api.cp1160MomentoIso("te falo depois de amanhã", "2026-08-06"), "2026-08-08", "depois de amanhã = +2");
assert.equal(api.cp1160MomentoIso("vou pensar", "2026-08-06"), null, "sem prazo citado, não inventa data");

// ── As duas telas usam isso ─────────────────────────────────────────────────────────────────────
assert.match(app, /\$\{typeof cp1160FaixaHomeHTML === 'function' \? cp1160FaixaHomeHTML\(items\) : ""\}/,
  "a faixa aparece na Home, acima da fila do dia");
assert.match(app, /\$\{typeof cp1160BannerLeadHTML === 'function' \? cp1160BannerLeadHTML\(lead\) : ''\}/,
  "e dentro do cliente, no topo do 'Fazer agora'");
{
  const faixa = app.match(/function cp1160FaixaHomeHTML\(items\)\{[\s\S]*?\n\}/)[0];
  assert.match(faixa, /if\(!lista\.length\) return "";/, "sem ninguém nessa situação, a faixa não existe na tela");
  assert.match(faixa, /onclick='abrirLead\(\$\{idJs\}\)'/, "tocar no nome abre o cliente");
  assert.match(faixa, /cp1160Agendar\(\$\{idJs\},\$\{JSON\.stringify\(promessa\.sugestaoIso\)\}\)/, "e o botão agenda num toque");
}
{
  const agendar = app.match(/async function cp1160Agendar\(id, iso\)\{[\s\S]*?\n\}/)[0];
  assert.match(agendar, /reagendarLembrete\(String\(id\), data\)/,
    "agenda pelo MESMO caminho do botão Agendar do cliente (que também marca o atendimento, v1148)");
}

console.log("v1160-cliente-ficou-de-dar-resposta: ok");
