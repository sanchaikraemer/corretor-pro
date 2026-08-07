import fs from "node:fs";
import assert from "node:assert/strict";

// v1160 — caso real do dono: "ontem a cliente pediu infos, mandei, e ela ficou de falar com o marido
// à noite. Hoje teria que dar um toque nela, o que acha?". O app não ajudava nisso: como ele tinha
// ACABADO de atender, ela estava no descanso e não aparecia em lugar nenhum — ele lembrou de cabeça.
// Proposta aceita: quando o cliente fica de dar uma resposta, o app propõe o retorno e ele confirma
// com um toque. Tudo das mensagens JÁ IMPORTADAS — nenhuma chamada de IA, nenhum custo.
//
// v1161 — RESPIRO, e é o ponto mais importante deste arquivo. A v1160 propunha retomar no dia
// seguinte ao prazo do cliente. O dono cortou na hora: "retomar hoje NUNCA acontecerá... temos que
// dar tempo pro cliente respirar... se é pra ser chato assim instalo um robô no WhatsApp pra mandar
// msg o tempo todo. Temos que ter ESTRATÉGIA COMERCIAL, e não insistência."
//
// A primeira tentativa criou um campo NOVO no Cérebro pra isso, e ele cortou de novo: "mas já não
// temos isso no Cérebro em 'descanso após atender'? não é a mesma coisa?". É — então é o MESMO
// número, sem segunda configuração pra ele manter. A conta parte do que aconteceu por último: o
// prazo que o cliente deu ou o último atendimento marcado.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ── Roda a detecção de verdade ─────────────────────────────────────────────────────────────────
const pedacos = [
  /const CP1160_PROMETE_RETORNO = [\s\S]*?;\n/,
  /const CP1160_VAI_CONSULTAR = [\s\S]*?;\n/,
  /const CP1160_VAI_PENSAR = [\s\S]*?;\n/,
  /const CP1160_DESISTIU = [\s\S]*?;\n/,
  /const CP1160_DIAS_SEMANA = [\s\S]*?;\n/,
  /function cp1160TemPromessa\(texto\)\{[\s\S]*?\n\}/,
  /function cp1160RespiroDias\(\)\{[\s\S]*?\n\}/,
  /function cp1160BaseDoRespiro\(l, momentoOuDiaIso\)\{[\s\S]*?\n\}/,
  /function cp1160SomaDias\(iso, n\)\{[\s\S]*?\n\}/,
  /function cp1160DiaDaMensagem\(m\)\{[\s\S]*?\n\}/,
  /function cp1160MomentoIso\(texto, baseIso\)\{[\s\S]*?\n\}/,
  // v1167 — cp1160PromessaDoCliente passou a empurrar a data pra fora do fim de semana.
  /function cpDiaDaSemanaDoIso\(iso\)\{[\s\S]*?\n\}/,
  /function cpEhFimDeSemana\(iso\)\{[\s\S]*?\n\}/,
  /function cpEmpurraPraDiaUtil\(iso\)\{[\s\S]*?\n\}/,
  /function cp1160PromessaDoCliente\(l\)\{[\s\S]*?\n\}/,
  /function cp1160Pendentes\(items\)\{[\s\S]*?\n\}/
].map(re => {
  const m = app.match(re);
  assert.ok(m, `trecho não encontrado: ${re}`);
  return m[0];
});

const api = eval(`
  let DESCANSO = 3; // o "Descanso após atender" do Cérebro — é ele que dá o respiro (v1161)
  const cpDiasDescansoPosAtendimento = () => DESCANSO;
  const ultimoAtendimentoTs = (l) => Number(l?.__atendidoTs || 0);
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
  ({ cp1160PromessaDoCliente, cp1160Pendentes, cp1160MomentoIso, cp1160TemPromessa, cp1160RespiroDias,
     setRespiro: (n) => { DESCANSO = n; } });
`);

const msgCliente = (texto, iso) => ({ autor: "cliente", text: texto, iso });
const msgCorretor = (texto, iso) => ({ autor: "corretor", text: texto, iso });
const ONTEM = "2026-08-05T22:10:00-03:00";
const HOJE = "2026-08-06T09:00:00-03:00";

// ── 1. O RESPIRO É A REGRA: nunca no dia seguinte ─────────────────────────────────────────────
// v1167 — a soma bruta (prazo do cliente OU último atendimento, + RESPIRO) continua sendo a
// conta-base; o que mudou é o NOME da variável (retornoBruto, não mais retornoIso) porque agora
// ela ainda passa por cpEmpurraPraDiaUtil antes de virar a data proposta de verdade — a conta em
// si (não cravar +1, respeitar o respiro) é exatamente a mesma.
assert.match(app,
  /const retornoBruto = cp1160SomaDias\(cp1160BaseDoRespiro\(l, momento \|\| diaIso\), cp1160RespiroDias\(\)\);/,
  "a data proposta = (o que aconteceu por último: prazo do cliente OU seu último atendimento) + RESPIRO — nunca um '+1' cravado (v1161)");
// UM número só: o respiro É o "Descanso após atender" do Cérebro (ele recusou um campo separado).
{
  const fn = app.match(/function cp1160RespiroDias\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(fn, /cpDiasDescansoPosAtendimento\(\)/,
    "o respiro sai do descanso já configurado — sem segunda configuração pra manter");
  assert.doesNotMatch(app, /respiroPromessaDias/, "o campo separado da primeira tentativa não pode sobrar");
  assert.doesNotMatch(index, /cerebroRespiroPromessa/, "nem o campo na tela do Cérebro");
  assert.match(index, /Este mesmo número é o respiro/, "o texto do descanso explica os dois usos");
}
assert.equal(api.cp1160RespiroDias(), 3, "no teste, o descanso configurado é 3");

// ── 2. O CASO DA CLÁUDIA, com a regra nova ────────────────────────────────────────────────────
// Ela falou ontem à noite que ia conversar com o marido. Com respiro de 3 dias, o retorno proposto
// é 08/08 — e HOJE ela não aparece na faixa da Home (é justamente o "deixa o cliente respirar").
{
  const lead = { id: 1, name: "Cliente Exemplo", recentMessages: [
    msgCorretor("Segue o material que combinamos.", "2026-08-05T20:00:00-03:00"),
    msgCliente("Obrigada! Vou falar com meu marido hoje à noite e te falo.", ONTEM)
  ] };
  const p = api.cp1160PromessaDoCliente(lead);
  assert.ok(p, "a promessa é reconhecida");
  assert.equal(p.diaIso, "2026-08-05", "o dia da fala dela");
  // v1167 — 08/08/2026 é sábado; a conta bruta cai nele, mas a proposta de verdade empurra pra
  // segunda (10/08) — é a regra "nunca sugere fim de semana".
  assert.equal(p.retornoIso, "2026-08-10", "prazo dela (05/08, à noite) + 3 dias de respiro = sábado, empurrado pra segunda");
  assert.equal(p.adiadoDoFimDeSemana, true, "precisa vir marcado que a data foi adiada do fim de semana");
  assert.equal(api.cp1160Pendentes([lead]).length, 0, "hoje ela NÃO é cobrada — o respiro está correndo");

  // Com descanso de 1 dia (escolha dele), aí sim seria hoje — mas é escolha DELE, não padrão nosso.
  api.setRespiro(1);
  assert.equal(api.cp1160PromessaDoCliente(lead).retornoIso, "2026-08-06", "respiro 1 = dia seguinte ao prazo");
  assert.equal(api.cp1160Pendentes([lead]).length, 1, "e aí ela entra na faixa");
  api.setRespiro(3);
}

// ── 3. Quando o respiro JÁ passou: aparece, e agendar é pra hoje ──────────────────────────────
{
  const lead = { id: 4, name: "Cliente Exemplo", recentMessages: [
    msgCliente("Vou conversar com meu marido e te falo", "2026-07-28T15:00:00-03:00")
  ] };
  const p = api.cp1160PromessaDoCliente(lead);
  assert.equal(p.retornoIso, "2026-07-31", "prazo 28/07 + respiro de 3 dias");
  assert.equal(p.sugestaoIso, "2026-08-06", "vencido: agendar é sempre pra hoje, nunca data no passado");
  const pend = api.cp1160Pendentes([lead]);
  assert.equal(pend.length, 1, "entra na faixa da Home");
  assert.equal(pend[0].promessa.diasAtras, 9, "e mostra há quanto tempo ele falou");
}

// ── 4. O prazo que ELE deu é respeitado ───────────────────────────────────────────────────────
{
  const lead = { id: 3, name: "Cliente Exemplo", recentMessages: [
    msgCliente("Vou falar com minha esposa amanhã e te respondo", HOJE)
  ] };
  const p = api.cp1160PromessaDoCliente(lead);
  assert.equal(p.retornoIso, "2026-08-10", "amanhã (07/08) + 3 dias de respiro");
  assert.equal(api.cp1160Pendentes([lead]).length, 0, "não cobra antes da hora");
}

// ── 5. Formas de prometer resposta ────────────────────────────────────────────────────────────
for (const texto of [
  "Vou falar com minha esposa e te aviso",
  "Preciso ver com o banco antes de decidir",
  "Te falo amanhã sem falta",
  "Fico de te retornar depois",
  "Vou pensar com calma",
  "Vou conversar com meu sócio",
  "Qualquer coisa eu te chamo"
]) assert.ok(api.cp1160TemPromessa(texto), `deveria contar como promessa: "${texto}"`);

// E o que NÃO pode virar promessa (senão a faixa vira lixo na tela).
for (const texto of [
  "Vou ver o apartamento no sábado",            // visita, não resposta
  "Quanto ficou a parcela?",
  "Bom dia! Tudo bem?",
  "Gostei muito do decorado"
]) assert.ok(!api.cp1160TemPromessa(texto), `NÃO deveria contar como promessa: "${texto}"`);

// ── 6. Desistiu: não se propõe retorno pra quem disse não ─────────────────────────────────────
{
  const lead = { id: 2, name: "Cliente Exemplo", recentMessages: [
    msgCliente("Vou falar com meu marido e te aviso", "2026-07-20T10:00:00-03:00"),
    msgCliente("Falei com ele, desisti por agora", ONTEM)
  ] };
  assert.equal(api.cp1160PromessaDoCliente(lead), null, "desistência clara cancela a proposta");
}

// ── 7. Promessa velha (mais de 45 dias) é caso de resgate, não desta faixa ────────────────────
{
  const lead = { id: 5, name: "Cliente Exemplo", recentMessages: [
    msgCliente("Vou falar com meu marido e te aviso", "2026-05-01T10:00:00-03:00")
  ] };
  assert.equal(api.cp1160PromessaDoCliente(lead), null, "promessa de 3 meses atrás não vale mais");
}

// ── 8. Fora da faixa: atendido hoje, já agendado, arquivado ───────────────────────────────────
{
  const base = { name: "Cliente Exemplo", recentMessages: [ msgCliente("Vou falar com meu marido e te falo", "2026-07-28T15:00:00-03:00") ] };
  assert.equal(api.cp1160Pendentes([{ ...base, id: 6, __hoje: true }]).length, 0, "atendido hoje sai");
  assert.equal(api.cp1160Pendentes([{ ...base, id: 7, __agendado: true }]).length, 0, "já agendado sai");
  assert.equal(api.cp1160Pendentes([{ ...base, id: 8, __ativo: false }]).length, 0, "arquivado sai");
}

// ── 9. Só as 3 últimas falas do cliente contam ────────────────────────────────────────────────
{
  const lead = { id: 9, name: "Cliente Exemplo", recentMessages: [
    msgCliente("Vou falar com meu marido", "2026-08-01T10:00:00-03:00"),
    msgCliente("Qual o valor do condomínio?", "2026-08-04T10:00:00-03:00"),
    msgCliente("E a vaga é coberta?", "2026-08-04T11:00:00-03:00"),
    msgCliente("Obrigada", ONTEM)
  ] };
  assert.equal(api.cp1160PromessaDoCliente(lead), null, "promessa antiga, com 3 falas depois, não conta");
}

// ── 10. Prazos em palavras viram data de verdade ──────────────────────────────────────────────
assert.equal(api.cp1160MomentoIso("te falo na segunda", "2026-08-06"), "2026-08-10", "segunda seguinte");
assert.equal(api.cp1160MomentoIso("te aviso semana que vem", "2026-08-06"), "2026-08-13", "semana que vem = +7");
assert.equal(api.cp1160MomentoIso("te falo depois de amanhã", "2026-08-06"), "2026-08-08", "depois de amanhã = +2");
assert.equal(api.cp1160MomentoIso("vou pensar", "2026-08-06"), null, "sem prazo citado, não inventa data");

// ── 11. Atendimento mais recente que a promessa: o respiro conta DELE ────────────────────────
// Cliente prometeu resposta há 9 dias, mas ele atendeu ontem: não pode aparecer hoje. Sem essa
// regra, a faixa cobraria alguém que ele acabou de tratar — exatamente o "robô chato".
{
  const promessaVelha = [ msgCliente("Vou conversar com meu marido e te falo", "2026-07-28T15:00:00-03:00") ];
  const atendidoOntem = Date.parse("2026-08-05T16:00:00-03:00");
  const lead = { id: 10, name: "Cliente Exemplo", recentMessages: promessaVelha, __atendidoTs: atendidoOntem };
  const p = api.cp1160PromessaDoCliente(lead);
  // v1167 — mesma conta do caso acima: 08/08/2026 é sábado, empurra pra segunda (10/08).
  assert.equal(p.retornoIso, "2026-08-10", "conta do atendimento de ontem (05/08) + 3 dias = sábado, empurrado pra segunda; não da promessa antiga");
  assert.equal(api.cp1160Pendentes([lead]).length, 0, "quem ele acabou de atender não é cobrado");
  // Sem atendimento nenhum, o mesmo cliente já estaria vencido.
  assert.equal(api.cp1160Pendentes([{ ...lead, __atendidoTs: 0 }]).length, 1, "sem atendimento, vale o prazo da promessa");
}

// ── 12. As duas telas usam isso ───────────────────────────────────────────────────────────────
assert.match(app, /\$\{typeof cp1160FaixaHomeHTML === 'function' \? cp1160FaixaHomeHTML\(items\) : ""\}/,
  "a faixa aparece na Home, acima da fila do dia");
assert.match(app, /\$\{typeof cp1160BannerLeadHTML === 'function' \? cp1160BannerLeadHTML\(lead\) : ''\}/,
  "e dentro do cliente, no topo do 'Fazer agora'");
{
  const faixa = app.match(/function cp1160FaixaHomeHTML\(items\)\{[\s\S]*?\n\}/)[0];
  assert.match(faixa, /if\(!lista\.length\) return "";/, "sem ninguém nessa situação, a faixa não existe na tela");
  assert.match(faixa, /onclick='abrirLead\(\$\{idJs\}\)'/, "tocar no nome abre o cliente");
  assert.match(faixa, /cp1160Agendar\(\$\{idJs\},\$\{JSON\.stringify\(promessa\.sugestaoIso\)\}\)/, "e o botão agenda num toque");
  assert.match(faixa, /respiro de \$\{cp1160RespiroDias\(\)\}/, "o pé da faixa explica o respiro configurado");
  assert.match(faixa, /Descanso após atender/, "e diz de onde vem esse número");
}
{
  const banner = app.match(/function cp1160BannerLeadHTML\(lead\)\{[\s\S]*?\n\}/)[0];
  assert.match(banner, /Sugiro retomar <b>\$\{escapeHtml\(cp1160DataCurta\(p\.retornoIso\)\)\}<\/b>/,
    "no cliente, a proposta é uma DATA por extenso (plano), não 'hoje'");
  assert.match(banner, /O respiro de \$\{respiro\}/, "e quando o respiro já passou, diz isso");
  assert.doesNotMatch(banner, /Retomar \$\{escapeHtml\(quandoTxt\)\}/, "sem o 'Retomar hoje?' da v1160");
}
{
  const agendar = app.match(/async function cp1160Agendar\(id, iso\)\{[\s\S]*?\n\}/)[0];
  assert.match(agendar, /reagendarLembrete\(String\(id\), data\)/,
    "agenda pelo MESMO caminho do botão Agendar do cliente (que também marca o atendimento, v1148)");
}

console.log("v1160-cliente-ficou-de-dar-resposta: ok (atualizado pela v1161 — respiro configurável)");
