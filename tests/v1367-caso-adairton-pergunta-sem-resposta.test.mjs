import assert from "node:assert/strict";
import {
  perguntasDoClienteSemResposta,
  promessasNaoCumpridasDoCorretor,
  proximosPassosJaPropostos,
  compromissoDaConversa,
  montarFicharioDaConversa
} from "../api/_pipeline.js";

// v1367 — OS TRÊS DEFEITOS DO PRINT DO ADAIRTON (dono, 22/08/2026).
//
// A conversa: o cliente chegou por um anúncio do Facebook, perguntou do apartamento, disse que é
// pra MORAR, recebeu dois vídeos e perguntou: "Em qual cidade." — e ficou esperando.
//
// As três sugestões que o app entregou:
//   1. "Demorei para te responder sobre a cidade... Vou te confirmar isso ainda hoje e, se ficar
//       bom para ti, podemos deixar uma visita para segunda-feira, 24/08, de manhã?"
//   2. "A informação da cidade ficou pendente comigo. Ainda hoje eu te confirmo certinho..."
//   3. "Vou confirmar a cidade do apartamento ainda hoje. Para a visita, consigo te atender..."
//
// Nenhuma respondia a cidade, e as três faziam o corretor parecer que não sabe onde fica o próprio
// apartamento. Três causas, apuradas rodando esta conversa pelo app:
//   (1) o app não tinha lista de perguntas do CLIENTE sem resposta — só a contrária;
//   (2) a frase automática do anúncio virava compromisso de visita, e o fichário mandava as três
//       convergirem em marcar dia e hora;
//   (3) o app inventava uma dívida ("prometeu o valor e não entregou") porque só procurava a
//       entrega nas mensagens SEGUINTES — o preço estava na própria mensagem.

const C = "Construtora Senger";
const A = "Adairton Quality";
const lead = { clientName: A };
const AGORA = new Date(2026, 7, 22, 9, 43);
const m = (author, date, text) => ({ author, date, text });

const TIMELINE = [
  m(C, "21/08/2026", "Anúncio do Facebook Mostrar detalhes Olá, temos um apartamento com 2 dormitórios e box de garagem por R$ 430.000. Quer agendar uma visita?"),
  m(A, "21/08/2026", "Olá! Quero saber mais sobre o apartamento de R$ 430 mil."),
  m(C, "21/08/2026", "Olá Adairton, boa tarde! Claro.\nEsse apartamento é novo, tem 2 dormitórios, box de garagem, móveis planejados e o condomínio conta com piscina, academia e salões de festas. O valor é R$ 430 mil e pode ser financiado.\nVou te mandar videos dele. Me diz só uma coisa para eu te orientar melhor: você está procurando um apartamento para morar ou seria para investimento?"),
  m(A, "21/08/2026", "Morar."),
  m(C, "21/08/2026", "Perfeito, vou te enviar video do empreendimento e do apto"),
  m(C, "21/08/2026", "[Arquivo enviado nesta mensagem: vídeo — conteúdo não analisado pela IA]\n802A"),
  m(C, "21/08/2026", "[Arquivo enviado nesta mensagem: vídeo — conteúdo não analisado pela IA]\nÁrea lazer"),
  m(A, "21/08/2026", "Em qual cidade.")
];

// ── DEFEITO 1: a pergunta do cliente vira fato, e vem com a instrução de responder primeiro ──
{
  const abertas = perguntasDoClienteSemResposta(TIMELINE, C, lead, AGORA);
  assert.equal(abertas.length, 1, "o app precisa enxergar exatamente uma pergunta sem resposta");
  assert.match(abertas[0].texto, /qual cidade/i, "é a pergunta da cidade");
  assert.equal(abertas[0].corretorNaoFalouMais, true,
    "o corretor não escreveu mais nada depois — é o caso sem margem de dúvida");

  const fichario = montarFicharioDaConversa(TIMELINE, C, lead, AGORA);
  assert.ok(fichario.includes("O CLIENTE PERGUNTOU E NINGUÉM RESPONDEU"), "o bloco entra no fichário");
  assert.ok(/RESPONDER ISTO VEM ANTES DE QUALQUER JOGADA/.test(fichario),
    "responder precisa vir antes de convite, visita ou pergunta nova");
  assert.ok(/NÃO transforme a resposta numa promessa/.test(fichario),
    "prometer conferir a cidade do próprio apartamento foi o erro do print — o fichário precisa barrar");
  // Vem cedo: antes das listas genéricas, senão afunda igual afundava.
  assert.ok(fichario.indexOf("O CLIENTE PERGUNTOU E NINGUÉM RESPONDEU") < fichario.indexOf("O QUE O CLIENTE JÁ DISSE"),
    "a pergunta sem resposta vem antes da lista genérica de falas do cliente");
}

// ── DEFEITO 2: anúncio automático não é compromisso nem passo proposto pelo corretor ─────────
{
  assert.equal(compromissoDaConversa(TIMELINE, C, lead, AGORA), null,
    "a frase do robô do anúncio não pode abrir compromisso de visita");
  assert.equal(proximosPassosJaPropostos(TIMELINE, C, lead, AGORA).length, 0,
    "e não pode contar como convite que o corretor fez");

  const fichario = montarFicharioDaConversa(TIMELINE, C, lead, AGORA);
  assert.ok(!/O próximo avanço é UM só/.test(fichario),
    "sem compromisso real, o fichário não pode mandar as três convergirem em marcar dia e hora");

  // Mas quando é UMA PESSOA que fala em marcar, o compromisso continua nascendo igual.
  const comPessoa = [...TIMELINE, m(A, "22/08/2026", "Podemos agendar uma visita?")];
  assert.ok(compromissoDaConversa(comPessoa, C, lead, AGORA),
    "pedido escrito por gente continua abrindo compromisso normalmente");
}

// ── DEFEITO 3: o que a própria mensagem entrega não pode virar dívida ────────────────────────
{
  assert.deepEqual(promessasNaoCumpridasDoCorretor(TIMELINE, C, lead, AGORA), [],
    "o preço foi dito na mesma mensagem da promessa — não existe dívida de valor aqui");

  const fichario = montarFicharioDaConversa(TIMELINE, C, lead, AGORA);
  assert.ok(!fichario.includes("O QUE O CORRETOR DISSE QUE IA ENVIAR"),
    "sem dívida real, o bloco de pendência não aparece — era ele que mandava abrir pedindo desculpa");

  // E a dívida de verdade continua sendo apontada: prometeu as fotos e nunca mandou.
  const devendo = [
    m(C, "21/08/2026", "O valor é R$ 430 mil. Te mando as fotos depois."),
    m("Cliente Teste", "21/08/2026", "Combinado.")
  ];
  const abertas = promessasNaoCumpridasDoCorretor(devendo, C, { clientName: "Cliente Teste" }, AGORA);
  assert.equal(abertas.length, 1, "a promessa das fotos continua em aberto");
  assert.deepEqual(abertas[0].faltando, ["fotos"],
    "e o que falta são as FOTOS — o valor, dito ali mesmo, não é dívida");
}

// ── Pedido de marcar não vira "pergunta sem resposta": isso é compromisso, tem bloco próprio ──
{
  const tl = [
    m("Bruno", "20/08/2026", "Podemos marcar uma visita?"),
    m(C, "20/08/2026", "Claro! Quinta às 10h fica bom?")
  ];
  assert.equal(perguntasDoClienteSemResposta(tl, C, { clientName: "Bruno" }, AGORA).length, 0,
    "pedido de visita é compromisso, não pergunta de informação");
}

// ── Pergunta respondida pelo corretor não entra na lista ─────────────────────────────────────
{
  const tl = [
    m("Bruno", "20/08/2026", "Em qual cidade."),
    m(C, "20/08/2026", "Fica em Carazinho, na cidade toda tem só esse com essa metragem.")
  ];
  assert.equal(perguntasDoClienteSemResposta(tl, C, { clientName: "Bruno" }, AGORA).length, 0,
    "respondida é respondida — não pode virar cobrança");
}

console.log("v1367-caso-adairton-pergunta-sem-resposta: ok (pergunta do cliente primeiro, anúncio ≠ compromisso, dívida não inventada)");
