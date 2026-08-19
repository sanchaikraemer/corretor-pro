import fs from 'node:fs';
import assert from 'node:assert/strict';
import { perguntasJaFeitasPeloCorretor } from '../api/_pipeline.js';

// v1313 — "a análise está uma bosta" (dono, 19/08/2026, 17h22, conversa da Noemi, Cérebro em 100%).
//
// As TRÊS sugestões perguntavam a mesma coisa: "é para morar ou investir?". E essa pergunta ele já
// tinha feito na PRIMEIRA mensagem dele, em 19/01 — sete meses e umas trinta mensagens antes, com a
// cliente falando várias vezes depois disso.
//
// A regra "não repita pergunta já respondida" já existia no pedido. O que faltava era o FATO: a
// lista de perguntas que o corretor já fez guardava só as 6 MAIS RECENTES. Numa conversa longa (ele
// fez umas dez perguntas nessa), a pergunta de ABERTURA é a primeira a cair da lista — e é
// justamente a que a IA mais tende a refazer, porque está longe do fim que ela está lendo.

const raiz = new URL('../', import.meta.url);
const pipeline = fs.readFileSync(new URL('api/_pipeline.js', raiz), 'utf8');

// ── 1. A conversa real da Noemi, resumida no que importa aqui ────────────────────────────────
{
  const CORRETOR = 'Construtora Senger';
  const CLIENTE = 'Noemi Barcarol Evoluti';
  const timeline = [
    { author: CLIENTE, text: 'Olá! Tenho interesse e queria mais informações, por favor.' },
    { author: CORRETOR, text: 'Vi que você demonstrou interesse em um dos nossos imóveis. Você está procurando algo para morar ou para investir?' },
    { author: CORRETOR, text: 'Gostou do Evolutti?' },
    { author: CORRETOR, text: 'Ele atende os requisitos que vc procura?' },
    { author: CLIENTE, text: 'Localização fica na floresta?' },
    { author: CORRETOR, text: 'Te enviei o mapa, conseguiu se localizar?' },
    { author: CLIENTE, text: 'Sim' },
    { author: CORRETOR, text: 'Gostaria de levá-la visitar na semana q vem, pode ser?' },
    { author: CORRETOR, text: 'Gostaria de convidá-la para um café na construtora e apresentar melhor os empreendimentos. O q acha?' },
    { author: CLIENTE, text: 'Estou viajando na volta eu vejo' },
    { author: CORRETOR, text: 'Já voltou de viagem?' },
    { author: CORRETOR, text: 'Você gostaria de dar continuidade no atendimento?' },
    { author: CORRETOR, text: 'Posso te enviar o valor, as fotos e as condições de pagamento?' },
    { author: CORRETOR, text: 'Posso te enviar fotos, detalhes do imóvel e as condições de financiamento por aqui. O que você gostaria de ver primeiro?' },
    { author: CLIENTE, text: 'Olá! Quero saber mais sobre o apartamento de R$ 430 mil.' }
  ];

  // O nome do cliente vem do lead (é assim na análise real): sem ele o app não sabe quem é quem.
  const perguntas = perguntasJaFeitasPeloCorretor(timeline, CORRETOR, { clientName: CLIENTE });
  const textos = perguntas.map(p => p.texto).join(' | ');

  assert.match(textos, /morar ou para investir/i,
    'a pergunta de abertura PRECISA chegar na IA — foi ela que voltou nas três sugestões do print');
  assert.match(textos, /O que você gostaria de ver primeiro/i, 'e a mais recente continua na lista');
  assert.ok(perguntas.length <= 14, 'a lista tem teto — não pode virar a conversa inteira dentro do pedido');

  const abertura = perguntas.find(p => /morar ou para investir/i.test(p.texto));
  assert.equal(abertura.respondida, true,
    'a cliente falou depois dela: é isso que faz a regra "não repita pergunta já respondida" pegar');
}

// ── 2. Conversa curta continua exatamente como era ───────────────────────────────────────────
{
  const curta = [
    { author: 'Corretor', text: 'Bom dia! Você já conhece o empreendimento?' },
    { author: 'Cliente', text: 'ainda não' }
  ];
  const r = perguntasJaFeitasPeloCorretor(curta, 'Corretor', { clientName: 'Cliente' });
  assert.equal(r.length, 1);
  assert.equal(r[0].respondida, true);
}

// ── 3. Conversa gigante: abertura E fim entram, e nada estoura ───────────────────────────────
{
  const timeline = [];
  for (let i = 1; i <= 30; i++) {
    timeline.push({ author: 'Corretor', text: `Pergunta número ${i} sobre o atendimento, tudo certo?` });
    timeline.push({ author: 'Cliente', text: 'ok' });
  }
  const r = perguntasJaFeitasPeloCorretor(timeline, 'Corretor', { clientName: 'Cliente' });
  assert.equal(r.length, 14, 'o teto vale');
  assert.match(r[0].texto, /número 1 /, 'as primeiras perguntas do atendimento não podem sumir');
  assert.match(r[r.length - 1].texto, /número 30 /, 'e as últimas também não');
}

// ── 4. E as três sugestões não podem ser a mesma pergunta em três roupas ─────────────────────
{
  assert.match(pipeline, /as três não podem ser A MESMA PERGUNTA em três roupas/,
    'a regra do trio precisa dizer isso — no print, as três só perguntavam "morar ou investir?"');
  assert.match(pipeline, /Se as três só perguntam a mesma coisa, o corretor recebeu uma opção, não três/,
    'com o motivo escrito, que é o que o dono reclamou');
  // A regra irmã (as três não podem ser a mesma espera) continua de pé.
  assert.match(pipeline, /As três não podem ser a mesma espera escrita com outras palavras/);
}

// ── 5. O que o dono mostrou que a IA deveria ter feito ──────────────────────────────────────
// Ele colou o que um ChatGPT comum respondeu para a MESMA conversa: entregou o que ela pediu
// (2 dormitórios, box, R$ 430 mil, financiável), ligou com o que ela já procurava em janeiro
// (2 dormitórios, região central) e propôs ver o imóvel. O app fez o contrário: travou a entrega
// porque "não há detalhes confirmados" e devolveu três vezes a pergunta de qualificação.
//
// Estas duas regras fecham esse buraco SEM afrouxar a proteção contra inventar (que é o que o dono
// mandou apertar nas v1301/v1305, depois do print do endereço inventado).
{
  assert.match(pipeline, /O QUE JÁ ESTÁ ESCRITO NA CONVERSA É FATO — ENTREGUE\./,
    'o que o cliente já leu na conversa não pode ficar esperando confirmação pra ser repetido');
  assert.match(pipeline, /o cliente pediu informação, recebeu formulário/,
    'com o motivo escrito: foi exatamente isso que apareceu na tela do dono');
  assert.match(pipeline, /Cada fato continua valendo só para o imóvel em que ele foi dito/,
    'e a proteção contra misturar imóvel continua de pé — foi ela que matou o endereço inventado');

  assert.match(pipeline, /CLIENTE QUE VOLTA NÃO SE QUALIFICA DE NOVO DO ZERO\./,
    'cliente que reaparece por um imóvel específico não volta pro começo do funil');
  assert.match(pipeline, /Recomeçar pela pergunta de abertura — para morar ou investir/,
    'com o exemplo real do print, pra não sobrar dúvida do que é proibido');
  assert.match(pipeline, /aí propor conhecer o imóvel é o passo natural, não pressão/,
    'e propor a visita nesse caso deixa de ser "forçar antes da maturidade"');
}

console.log('v1313-pergunta-antiga-nao-volta: ok');
