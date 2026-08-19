import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain, problemasNaMensagem, fatosInventadosNaMensagem } from "../api/_pipeline.js";

// v1305 — print do dono de 19/08/2026, 07h38, já na v1304. A cliente respondeu ao anúncio do
// Facebook (apartamento com 2 dormitórios e box por R$ 430.000) escrevendo:
//
//   "Olá! Quero saber mais sobre o apartamento de R$ 430 mil. Onde fica? Endereço"
//
// E as TRÊS sugestões responderam com um endereço que não existe em lugar nenhum da conversa:
// "Rua das Flores, número 123", "próximo ao hospital HCC", "região central".
//
// É o pior caso possível: endereço errado por escrito manda o cliente para o lugar errado.
//
// Por que a checagem da v1301 não pegou: ela procurava NOME PRÓPRIO logo depois do gatilho, e
// "Rua das Flores" tem conectivo minúsculo no meio — o gatilho comia "Rua" e a captura parava no
// "das". "próximo ao hospital HCC" caía pelo mesmo buraco (a palavra "hospital" no meio).

const CONVERSA = `[19/08/2026 07:20] Empresa: Anúncio do Facebook. Olá, temos um apartamento com 2 dormitórios e box de garagem por R$ 430.000. Quer agendar uma visita?
[19/08/2026 07:23] Salete Cliente: Olá! Quero saber mais sobre o apartamento de R$ 430 mil. Onde fica? Endereço`;

const MSG1 = "Bom dia, Salete! O apartamento de R$ 430.000 fica na região central, próximo ao hospital HCC, na Rua das Flores, número 123. Precisa de mais alguma informação sobre a localização ou quer detalhes do prédio?";
const MSG2 = "Bom dia, Salete! Esse apartamento de R$ 430.000 está na Rua das Flores, próximo ao centro e ao HCC. Se quiser, posso te passar mais detalhes sobre a vizinhança ou sobre o prédio, me avise o que gostaria de saber primeiro.";
const MSG3 = "Bom dia, Salete! O apartamento está na Rua das Flores, 123, perto do HCC. Te mando agora mais detalhes do prédio ou tem outra preferência sobre a localização?";

// ── 1. As três do print caem, e caem pelo endereço ───────────────────────────────────────────
{
  for (const [n, m] of [[1, MSG1], [2, MSG2], [3, MSG3]]) {
    assert.ok(fatosInventadosNaMensagem(m, CONVERSA).includes("dá endereço que a conversa não tem"),
      `a sugestão ${n} dá endereço que ninguém deu e precisa cair na rede`);
  }
  assert.ok(fatosInventadosNaMensagem(MSG1, CONVERSA).includes("cita lugar que não está na conversa"),
    "'próximo ao hospital HCC' também é ponto de referência inventado");

  for (const inventado of [
    "Salete, o apartamento fica na Rua das Acácias, 45.",
    "O prédio é na Avenida Brasil, bem no centro.",
    "Fica no bairro São Cristóvão.",
    "O endereço é Rua Coronel Fulano, número 300.",
    "É pertinho do shopping Villagio."
  ]) {
    assert.ok(problemasNaMensagem(inventado, CONVERSA).length > 0, `precisa cair: "${inventado}"`);
  }
}

// ── 2. O que NÃO pode cair ───────────────────────────────────────────────────────────────────
{
  for (const boa of [
    // A resposta honesta quando o app não tem o endereço: entrega concreta + pergunta concreta.
    "Bom dia, Salete! Te mando agora o endereço exato do apartamento de R$ 430 mil. Prefere conhecer amanhã de manhã ou à tarde?",
    "Bom dia, Salete! O apartamento de R$ 430 mil tem 2 dormitórios e box de garagem. Já te passo o endereço completo. Você procura nessa região por causa do trabalho?",
    "Salete, te mando agora a localização no mapa e as fotos. Quantos dormitórios você precisa?",
    "Bom dia! Você precisa de 2 ou 3 dormitórios?"
  ]) {
    assert.deepEqual(problemasNaMensagem(boa, CONVERSA), [], `"${boa}" é mensagem boa e não pode ser acusada`);
  }

  // Endereço QUE ESTÁ na conversa é fato deste atendimento: repetir pode.
  const comEndereco = CONVERSA + "\n[19/08/2026 07:25] Empresa: fica na Rua Coronel Flores, 123, no bairro Centro.";
  assert.deepEqual(problemasNaMensagem("Salete, o apartamento fica na Rua Coronel Flores, 123, no bairro Centro. Quer conhecer amanhã?", comEndereco), [],
    "endereço escrito na conversa pode ser repetido");

  assert.deepEqual(fatosInventadosNaMensagem(MSG1), [], "sem contexto conhecido, ninguém é acusado");
}

// ── 3. A tela avisa quando a sugestão sai com problema conhecido ──────────────────────────────
// O print mostrou duas sugestões furadas e nada na tela dizendo isso. Agora a análise carrega o
// número e a linha de prova mostra em vermelho.
{
  const timeline = [
    { date: "19/08/2026", time: "07:20", author: "Empresa", text: "Anúncio do Facebook. Olá, temos um apartamento com 2 dormitórios e box de garagem por R$ 430.000. Quer agendar uma visita?" },
    { date: "19/08/2026", time: "07:23", author: "Salete Cliente", text: "Olá! Quero saber mais sobre o apartamento de R$ 430 mil. Onde fica? Endereço" }
  ];
  let n = 0;
  const openaiMock = { chat: { completions: { create: async () => {
    n++;
    if (n === 1) {
      return { model: "mock", choices: [{ message: { content: JSON.stringify({
        summary: "Cliente pediu o endereço.", diagnostico: {},
        mensagens: { recomendada: MSG1, maisSuave: "Bom dia, Salete! Te mando agora o endereço exato. Quer conhecer amanhã?", maisDireta: "Bom dia! Você precisa de 2 ou 3 dormitórios?" },
        quemEhOCliente: "Salete Cliente", produtoInteresse: "Não identificado", etapaSugerida: "Atendimento", clientProfile: "P", nextAction: "Passar o endereço"
      }) } }] };
    }
    // A reescrita volta com OUTRO endereço inventado: não vale, e a de cima continua furada.
    return { model: "mock", choices: [{ message: { content: JSON.stringify({
      a: "Bom dia, Salete! O apartamento fica na Rua das Palmeiras, 90, no centro."
    }) } }] };
  } } } };

  const r = await analyzeWithBrain({
    lead: { clientName: "Salete Cliente", corretorNome: "Sanchai" },
    timeline,
    openai: openaiMock,
    cerebroConfig: { corretorNome: "Sanchai", metodo: "Método.", tom: "Tom.", regras: [{ texto: "Regra." }] }
  });

  assert.equal(r.messages.a, MSG1, "reescrita que volta com outro endereço inventado não entra");
  assert.equal(r.sugestoesComProblema, 1, "a análise precisa dizer quantas saíram com problema conhecido");

  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.ok(app.includes("sugestão saiu com problema"), "a tela precisa avisar, em vermelho, que uma sugestão saiu furada");
  assert.ok(app.includes('Number(a.sugestoesComProblema)'), "e ler esse número da análise");
  const persist = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");
  assert.ok(persist.includes('"sugestoesComProblema"'), "o aviso precisa viajar junto com a análise, senão some ao reabrir o lead");
}

console.log("v1305-endereco-inventado-e-aviso-na-tela: ok");

// ── 4. v1305 — PREÇO VELHO NÃO VOLTA COMO PREÇO DE HOJE ───────────────────────────────────────
// Segundo print do dono no mesmo dia: "está pegando informações antigas, preços antigos que não
// existem mais... está puxando dados velhos e deixando de lado o contexto."
//
// Caso real: em 30/10/2025 o corretor anunciou nessa conversa "De R$ 390.000 por R$ 350.000". A
// cliente sumiu e voltou DEZ MESES depois (18/08/2026) com "posso ter mais informações sobre
// isso?". As três sugestões responderam repetindo os R$ 350.000 como preço de hoje.
{
  const { valoresAntigosDaConversa, valoresNaMensagem } = await import("../api/_pipeline.js");
  const timeline = [
    { date: "22/07/2025", time: "08:49", author: "Construtora", text: "temos no Quality, novinho, a partir de R$ 390.000" },
    { date: "30/10/2025", time: "15:01", author: "Construtora", text: "De R$ 390.000 por R$ 350.000. Apto novo e pronto para morar! 2 dormitórios, semimobiliado, 1 box de garagem." },
    { date: "18/08/2026", time: "22:59", author: "Ingriede Cliente", text: "Olá! Posso ter mais informações sobre isso?" }
  ];
  const agora = new Date("2026-08-19T10:00:00Z");
  const antigos = valoresAntigosDaConversa(timeline, agora);
  assert.equal(antigos.length, 2, "os dois valores da conversa são antigos");
  assert.ok(antigos.some(v => v.valor === 350000 && v.dias > 280), "o preço da promoção tem quase 300 dias");

  assert.deepEqual(valoresNaMensagem("O apartamento do Quality está disponível por R$ 350.000, com 2 dormitórios"), [350000],
    "o valor afirmado na mensagem é reconhecido");
  assert.deepEqual(valoresNaMensagem("a partir de 350 mil"), [350000], "'350 mil' é o mesmo número");
  assert.deepEqual(valoresNaMensagem("são 2 dormitórios e 1 box"), [], "quantidade não é preço");

  const contexto = { conversa: timeline.map(m => `[${m.date}] ${m.author}: ${m.text}`).join("\n"), valoresAntigos: antigos };
  assert.ok(problemasNaMensagem("Bom dia, Ingriede! O apartamento do Quality está disponível por R$ 350.000, com 2 dormitórios e pronto pra morar.", contexto)
    .includes("repete preço antigo como se fosse o de hoje"),
    "repetir a promoção de dez meses atrás como preço de hoje precisa cair na rede");

  // A mensagem certa: sem o número velho, confirmando o valor atual.
  assert.deepEqual(problemasNaMensagem("Bom dia, Ingriede! Que bom te ver de volta. O Quality segue com apartamento de 2 dormitórios, semimobiliado e pronto pra morar. Vou confirmar o valor atualizado e já te passo. Você pretende financiar a maior parte ou tem uma entrada em mente?", contexto), [],
    "confirmar o valor atualizado, sem repetir o número velho, é a mensagem certa e não pode ser acusada");

  // Preço citado HOJE não é preço velho.
  const hoje = [{ date: "19/08/2026", time: "07:20", author: "Empresa", text: "apartamento com 2 dormitórios e box por R$ 430.000" }];
  assert.deepEqual(valoresAntigosDaConversa(hoje, agora), [], "valor dito hoje não entra na lista de velhos");

  // E a IA recebe a idade como FATO no pedido, não como mais uma regra genérica.
  const src = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  assert.ok(src.includes("VALORES CITADOS HÁ MUITO TEMPO NESTA CONVERSA"),
    "o pedido precisa dizer quantos dias tem cada valor citado");
  assert.ok(src.includes("PREÇO, DESCONTO E CONDIÇÃO TÊM VALIDADE"),
    "e a regra precisa estar escrita junto das outras regras das três mensagens");
}

console.log("v1305 — preço velho: ok");
