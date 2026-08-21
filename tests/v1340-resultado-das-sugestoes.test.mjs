import fs from "node:fs";
import assert from "node:assert/strict";

// v1340 — AS SUGESTÕES ESTÃO FUNCIONANDO?
//
// Item da auditoria de arquitetura de 20/08/2026, e a pergunta que nenhuma tela respondia. O app
// media "Mensagens copiadas" — quantas sugestões o corretor levou pro WhatsApp — e parava ali.
// Copiar não é resultado. Resultado é o cliente VOLTAR A FALAR depois.
//
// Dá pra medir com o que já está guardado: cada cópia de sugestão fica registrada com data (evento
// "mensagem_copiada", ou o atendimento com de:"copiar_msg"), e a fala do cliente está na conversa.
// Existe fala do CLIENTE depois da última sugestão copiada? Então aquele cliente voltou a falar.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ── A função, rodada de verdade ──────────────────────────────────────────────────────────────
const fonte = [
  app.match(/function cpMensagemEhDoCliente\(l, m\)\{[\s\S]*?\n\}/)[0],
  app.match(/function cpResultadoDasSugestoes\(todos, dentro\)\{[\s\S]*?\n\}/)[0]
].join("\n");
const cpResultadoDasSugestoes = eval(`
  const cpNomeCorretorCerebro = () => "Miguel Kirinus";
  ${fonte}
  cpResultadoDasSugestoes;
`);

const HOJE = Date.parse("2026-08-21T12:00:00-03:00");
const dias = (n) => new Date(HOJE - n * 86400000).toISOString();
const dentroDoMes = (t) => Number.isFinite(t) && t >= Date.parse("2026-08-01T00:00:00-03:00");

const copiouHa = (n, comoAtendimento = false) => ({
  analysis: { aprendizado: { eventos: [comoAtendimento
    ? { evento: "contato_manual", detalhes: { tipo: "Mensagem enviada", de: "copiar_msg" }, quando: dias(n) }
    : { evento: "mensagem_copiada", quando: dias(n) }] } }
});

// 1) Cliente que respondeu DEPOIS da sugestão conta como resposta.
{
  const lead = { name: "Vanessa", ...copiouHa(3) };
  lead.recentMessages = [
    { author: "Miguel Kirinus", text: "Segue o material", iso: dias(3) },
    { author: "Vanessa", text: "Adorei, me manda o valor?", iso: dias(2) }
  ];
  assert.deepEqual(cpResultadoDasSugestoes([lead], dentroDoMes), { enviadas: 1, responderam: 1, semResposta: 0 });
}

// 2) Mensagem do cliente ANTERIOR à sugestão não vale — é o que ele já tinha dito.
{
  const lead = { name: "Vanessa", ...copiouHa(3) };
  lead.recentMessages = [{ author: "Vanessa", text: "Oi", iso: dias(9) }];
  assert.deepEqual(cpResultadoDasSugestoes([lead], dentroDoMes), { enviadas: 1, responderam: 0, semResposta: 1 });
}

// 3) O CORRETOR falando depois não é resposta do cliente. Este é o erro que faria o número mentir
//    pra cima: ele mandou a sugestão e depois mandou mais uma cobrança.
{
  const lead = { name: "Vanessa", ...copiouHa(3) };
  lead.recentMessages = [
    { author: "Miguel Kirinus", text: "Conseguiu ver?", iso: dias(1) },
    { author: "Construtora Alfa", text: "Bom dia!", iso: dias(1) }
  ];
  assert.deepEqual(cpResultadoDasSugestoes([lead], dentroDoMes), { enviadas: 1, responderam: 0, semResposta: 1 });
}

// 4) Anotação manual do corretor no nome do cliente também não é resposta.
{
  const lead = { name: "Vanessa", ...copiouHa(3) };
  lead.recentMessages = [{ author: "Vanessa", text: "Liguei, não atendeu", iso: dias(1), source: "manual", type: "ligacao" }];
  assert.deepEqual(cpResultadoDasSugestoes([lead], dentroDoMes), { enviadas: 1, responderam: 0, semResposta: 1 });
}

// 5) Cliente sem sugestão copiada no período fica FORA da conta — não pode diluir o percentual.
{
  const semCopia = { name: "João", recentMessages: [{ author: "João", text: "oi", iso: dias(1) }], analysis: {} };
  assert.deepEqual(cpResultadoDasSugestoes([semCopia], dentroDoMes), { enviadas: 0, responderam: 0, semResposta: 0 });
}

// 6) Cópia fora do período (mês passado) também fica fora.
{
  const lead = { name: "Vanessa", ...copiouHa(60) };
  lead.recentMessages = [{ author: "Vanessa", text: "respondi", iso: dias(59) }];
  assert.deepEqual(cpResultadoDasSugestoes([lead], dentroDoMes), { enviadas: 0, responderam: 0, semResposta: 0 });
}

// 7) O atendimento gravado ao copiar (de:"copiar_msg") conta igual ao evento de uso — são os dois
//    registros que a mesma ação deixa, e ignorar um deles subcontaria metade dos casos.
{
  const lead = { name: "Vanessa", ...copiouHa(3, true) };
  lead.recentMessages = [{ author: "Vanessa", text: "pode ser", iso: dias(2) }];
  assert.deepEqual(cpResultadoDasSugestoes([lead], dentroDoMes), { enviadas: 1, responderam: 1, semResposta: 0 });
}

// 8) Duas cópias: vale a ÚLTIMA. Resposta que veio entre a primeira e a segunda não prova que a
//    última funcionou.
{
  const lead = {
    name: "Vanessa",
    analysis: { aprendizado: { eventos: [
      { evento: "mensagem_copiada", quando: dias(10) },
      { evento: "mensagem_copiada", quando: dias(2) }
    ] } },
    recentMessages: [{ author: "Vanessa", text: "respondi", iso: dias(8) }]
  };
  assert.deepEqual(cpResultadoDasSugestoes([lead], dentroDoMes), { enviadas: 1, responderam: 0, semResposta: 1 });
}

// ── A tela ───────────────────────────────────────────────────────────────────────────────────
assert.match(app, /resultadoSugestoes: cpResultadoDasSugestoes\(todos, dentro\)/,
  "a medição precisa sair junto das outras métricas do Desempenho");
assert.match(app, /As sugestões estão funcionando\?/, "e aparecer na tela com essa pergunta");
assert.match(app, /clientes voltaram a falar/, "o número é 'voltaram a falar', não 'converteram'");
assert.match(app, /Conta só o que passou pelo app/,
  "a ressalva tem que estar embaixo do número: sem ela, o número vira mentira");
assert.match(app, /Ainda não dá pra medir/,
  "sem nenhuma sugestão copiada no período, a tela diz isso — em vez de mostrar 0% e parecer fracasso");

console.log("v1340-resultado-das-sugestoes: ok");
