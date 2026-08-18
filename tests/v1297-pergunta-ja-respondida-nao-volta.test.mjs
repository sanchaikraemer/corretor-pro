import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain, perguntasJaFeitasPeloCorretor } from '../api/_pipeline.js';

// v1297 — print do dono de 18/08/2026, 17h18. Desta vez a prova da v1296 estava na tela e dizia que
// o Cérebro TINHA ido inteiro (26.459 caracteres, todos os campos) com o aprendizado aplicado. E a
// sugestão RECOMENDADA foi:
//
//   "Tem algum ponto das condições de pagamento que você gostaria de ver com mais detalhes, ou
//    alguma dúvida sobre o empreendimento que posso esclarecer?"
//
// Ou seja: a MESMA pergunta que o corretor já tinha mandado 1h31 antes na própria conversa — e que
// o cliente já tinha respondido ("Estamos analisando ainda, mas gostei da ideia").
//
// O pedido já mandava "não repita pergunta já respondida", mas sem material: a IA não recebia em
// lugar nenhum a lista do que já tinha sido perguntado. Mesma lição da v1277 (a oferta repetida só
// parou de voltar quando o TEXTO das tentativas passou a ir junto).

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

const CONVERSA_DO_PRINT = [
  { date: '18/08/2026', time: '15:38', author: 'Construtora Senger', text: 'Boa tarde, Julsimar! Tudo bem? O Nicolas me passou seu contato. Você conseguiu dar uma olhada no empreendimento?' },
  { date: '18/08/2026', time: '15:45', author: 'Julsimar Chapada', text: 'Opa' },
  { date: '18/08/2026', time: '15:46', author: 'Julsimar Chapada', text: 'Dei uma olhada sim' },
  { date: '18/08/2026', time: '15:47', author: 'Construtora Senger', text: 'Que bom que conseguiu analisar o material. Ficou alguma dúvida ou algum ponto que gostaria de conversar sobre o empreendimento?' },
  { date: '18/08/2026', time: '15:48', author: 'Julsimar Chapada', text: 'Estamos analisando ainda, mas gostei da ideia' },
  { date: '18/08/2026', time: '15:48', author: 'Julsimar Chapada', text: 'O Nicolas me falou mais ou menos as condições de pagamento' }
];

// ── 1. As perguntas do CORRETOR são extraídas, e a fala do cliente não vira pergunta dele ────
{
  const p = perguntasJaFeitasPeloCorretor(CONVERSA_DO_PRINT, 'Sanchai', { clientName: 'Julsimar Chapada' });
  const textos = p.map(x => x.texto);
  assert.equal(p.length, 2, 'as duas perguntas do corretor precisam ser encontradas');
  assert.ok(textos.some(t => t.includes('Ficou alguma dúvida')),
    'a pergunta que a IA repetiu no print precisa estar na lista');
  assert.ok(textos.some(t => t.includes('conseguiu dar uma olhada')),
    'a pergunta da abertura também conta');
  assert.ok(p.every(x => x.respondida === true),
    'o cliente falou depois das duas: as duas precisam ir marcadas como já respondidas');
  assert.ok(!textos.some(t => /gostei da ideia|Nicolas me falou/.test(t)),
    'fala do cliente não pode virar pergunta do corretor');

  // Pergunta ainda sem resposta é marcada como tal.
  const semResposta = perguntasJaFeitasPeloCorretor([
    ...CONVERSA_DO_PRINT,
    { date: '18/08/2026', time: '16:30', author: 'Construtora Senger', text: 'Posso te mandar o quadro de condições por escrito?' }
  ], 'Sanchai', { clientName: 'Julsimar Chapada' });
  const ultima = semResposta[semResposta.length - 1];
  assert.ok(ultima.texto.includes('quadro de condições'), 'a última pergunta do corretor precisa entrar');
  assert.equal(ultima.respondida, false, 'sem fala do cliente depois, a pergunta fica marcada como sem resposta');

  // A mesma pergunta repetida não vira duas linhas, e conversa sem pergunta nenhuma devolve lista vazia.
  const repetida = perguntasJaFeitasPeloCorretor([
    { date: '01/08/2026', time: '09:00', author: 'Construtora Senger', text: 'Posso te mandar a apresentação?' },
    { date: '05/08/2026', time: '09:00', author: 'Construtora Senger', text: 'Posso te mandar a apresentação?' }
  ], 'Sanchai', { clientName: 'Julsimar Chapada' });
  assert.equal(repetida.length, 1, 'pergunta repetida conta uma vez só');
  assert.deepEqual(perguntasJaFeitasPeloCorretor([
    { date: '01/08/2026', time: '09:00', author: 'Construtora Senger', text: 'Segue o material em anexo.' }
  ], 'Sanchai', { clientName: 'Julsimar Chapada' }), [], 'conversa sem pergunta devolve lista vazia');
  assert.deepEqual(perguntasJaFeitasPeloCorretor(null, '', {}), [], 'timeline inválida não pode quebrar a análise');
}

// ── 2. O fato chega no pedido enviado à IA, com a marca de já respondida ─────────────────────
{
  let pedido = '';
  const openaiMock = { chat: { completions: { create: async (args) => {
    pedido = args.messages.map(m => m.content).join('\n\n');
    return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
      summary: 'Resumo', diagnostico: {},
      mensagens: {
        recomendada: 'Julsimar, te mando agora o quadro de condições por escrito pra vocês analisarem juntos?',
        maisSuave: 'Julsimar, organizei as condições num resumo. Te envio por aqui?',
        maisDireta: 'Julsimar, mando o quadro de condições agora e a gente fala amanhã?'
      },
      quemEhOCliente: 'Julsimar Chapada', produtoInteresse: 'Não identificado',
      etapaSugerida: 'Atendimento', clientProfile: 'Perfil', nextAction: 'Enviar as condições por escrito'
    }) } }] };
  } } } };

  await analyzeWithBrain({
    lead: { clientName: 'Julsimar Chapada', corretorNome: 'Sanchai' },
    timeline: CONVERSA_DO_PRINT,
    openai: openaiMock,
    cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Método do corretor.', tom: 'Tom.', regras: [{ texto: 'Regra.' }] }
  });

  assert.ok(pedido.includes('PERGUNTAS QUE O CORRETOR JÁ FEZ NESTA CONVERSA'),
    'o pedido precisa levar a lista do que já foi perguntado');
  assert.ok(pedido.includes('Ficou alguma dúvida ou algum ponto que gostaria de conversar sobre o empreendimento?'),
    'com o texto da pergunta que a IA estava repetindo');
  assert.ok(pedido.includes('o cliente JÁ FALOU depois desta pergunta'),
    'e dizendo que o cliente já respondeu — é isso que torna a repetição indefensável');
  assert.ok(pedido.includes('Nenhuma pergunta já respondida pode voltar nas três mensagens, nem reescrita com outras palavras'),
    'a regra precisa estar colada no fato, não perdida no meio do pedido');
  assert.ok(pedido.includes('Se\no que você faria com a resposta já dá para entregar, entregue em vez de perguntar de novo')
    || pedido.includes('já dá para entregar, entregue em vez de perguntar de novo'),
    'e precisa mandar entregar no lugar de perguntar quando isso já é possível');
}

// ── 3. Conversa sem pergunta nenhuma: o pedido diz isso, em vez de omitir ────────────────────
{
  let pedido = '';
  const openaiMock = { chat: { completions: { create: async (args) => {
    pedido = args.messages.map(m => m.content).join('\n\n');
    return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
      summary: 'Resumo', diagnostico: {},
      mensagens: { recomendada: 'Oi! Te mando as opções hoje.', maisSuave: 'Oi! Separei duas opções, te mando?', maisDireta: 'Oi! Mando as duas opções agora?' },
      quemEhOCliente: 'Julsimar Chapada', produtoInteresse: 'Não identificado', etapaSugerida: 'Atendimento', clientProfile: 'Perfil', nextAction: 'Enviar opções'
    }) } }] };
  } } } };
  await analyzeWithBrain({
    lead: { clientName: 'Julsimar Chapada', corretorNome: 'Sanchai' },
    timeline: [{ date: '18/08/2026', time: '15:48', author: 'Julsimar Chapada', text: 'Quero saber das salas' }],
    openai: openaiMock,
    cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Método.', tom: 'Tom.', regras: [{ texto: 'Regra.' }] }
  });
  assert.ok(pedido.includes('PERGUNTAS QUE O CORRETOR JÁ FEZ NESTA CONVERSA: nenhuma'),
    'sem pergunta anterior, o pedido precisa dizer que não há — silêncio vira dúvida pra IA');
}

// ── 4. A régua entrou no próprio formato do JSON, que é onde a IA escreve a mensagem ─────────
{
  assert.ok(src.includes('não pode repetir pergunta que o cliente já respondeu'),
    'a descrição do campo da mensagem recomendada precisa cobrar isso na hora de escrever');
  assert.ok(src.includes('com um passo concreto dentro dela'),
    'a mensagem suave não pode virar sinônimo de mensagem que não faz nada');
  assert.ok(src.includes('quando a informação que falta já dá para entregar, o passo é entregar, não perguntar de novo'),
    'o próximo passo precisa preferir entregar a perguntar de novo');
}

console.log('v1297-pergunta-ja-respondida-nao-volta: ok');
