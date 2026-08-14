import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain } from '../api/_pipeline.js';
import { garantirSaudacaoAbertura, primeiroNomeDoCliente } from '../js/saudacao.js';

// v1274 — "cadê a saudação? a retomada?" (dono, 14/08/2026, com print das três sugestões).
//
// O caso: lead do Evolutti parado desde 06/08 (o corretor mandou os valores e o link com três
// opções selecionadas, e o assunto morreu ali). As três sugestões saíram assim:
//   1. "Das opções e valores que você conferiu no material, ficou alguma dúvida…"
//   2. "Recebeu tempo de analisar as opções que te passei?…"
//   3. "Consigo agendar uma visita ao apartamento do Evolutti…"
// Nenhuma cumprimenta o cliente, nenhuma chama ele pelo nome — e as mensagens REAIS do corretor
// nessa mesma conversa abrem todas com "Bom dia Gabriel, tudo bem?".
//
// A causa estava numa contradição dentro do próprio pedido enviado à IA:
//   • a regra da retomada (v1225) mandava RECONHECER o tempo parado;
//   • a regra do tempo parado (v1255, ordem do dono) proibia falar do intervalo em qualquer forma.
// Com as duas no mesmo texto, a IA largava a retomada inteira e escrevia como se a conversa nunca
// tivesse parado — sem cumprimento nenhum, porque a regra da espinha ("abre por um fato concreto")
// virava, na prática, "não cumprimente".

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. A contradição não existe mais ─────────────────────────────────────────────────────────
{
  const ini = src.indexOf('RETOMADA DEPOIS DE DIAS SEM CONVERSA — REGRA DURA');
  assert.ok(ini > -1, 'a regra da retomada precisa continuar existindo');
  const bloco = src.slice(ini, src.indexOf('LINGUAGEM DE IA — PROIBIDO')).replace(/\s+/g, ' ');

  assert.ok(!bloco.includes('RECONHEÇA o tempo'),
    'mandar reconhecer o tempo brigava com a proibição de falar do intervalo — não pode voltar');
  assert.ok(bloco.includes('A VOLTA APARECE NO CONTEÚDO, NUNCA NO RELÓGIO'),
    'a retomada tem que aparecer pelo assunto retomado, não pela contagem de dias');
  assert.ok(bloco.includes('Não confunda as duas coisas'),
    'as duas regras precisam estar explicitamente conciliadas, pra IA não escolher uma e largar a outra');
  assert.ok(bloco.includes('ABRA COMO QUEM VOLTA A FALAR'),
    'retomada abre cumprimentando a pessoa');
}

// ── 2. Cumprimentar virou obrigação escrita, com a exceção certa ─────────────────────────────
{
  const blocoSaud = src.slice(src.indexOf('Saudação correta para este horário')).slice(0, 2000).replace(/\s+/g, ' ');
  assert.ok(blocoSaud.includes('AS TRÊS MENSAGENS ABREM COM ELA seguida do primeiro nome do cliente'),
    'as três precisam abrir com a saudação do horário + o primeiro nome');
  assert.ok(blocoSaud.includes('Mensagem que começa direto no assunto, sem cumprimentar o cliente pelo nome, está ERRADA'),
    'o erro do print precisa estar nomeado como erro');
  // A exceção continua sendo a da v1253 (Milena): cumprimento trocado NO MESMO DIA.
  assert.ok(blocoSaud.includes('SÓ VALE PARA CONVERSA QUE CONTINUA HOJE'),
    'não cumprimentar duas vezes só vale pra conversa que continua hoje');
  assert.ok(blocoSaud.includes('Cumprimento de ONTEM ou de dias/semanas atrás NÃO conta'),
    'cumprimento antigo não pode ser desculpa pra sugestão sair sem saudação');

  // E a regra do tempo parado não pode ser lida como "então não cumprimente".
  const blocoTempo = src.slice(src.indexOf('TEMPO PARADO NÃO ENTRA NA MENSAGEM')).slice(0, 2200).replace(/\s+/g, ' ');
  assert.ok(blocoTempo.includes('O QUE ESTA REGRA NÃO AUTORIZA'),
    'a regra do tempo parado precisa dizer o que ela NÃO autoriza');
  assert.ok(blocoTempo.includes('NÃO manda tirar a saudação'),
    'proibir falar dos dias nunca quis dizer proibir cumprimentar');
}

// ── 3. A rede de segurança: só acrescenta a saudação, nunca reescreve ────────────────────────
{
  const manha = new Date('2026-08-14T13:00:00Z');  // 10h no Brasil
  const tarde = new Date('2026-08-14T17:00:00Z');  // 14h no Brasil

  assert.equal(primeiroNomeDoCliente('Gabriel Quality Evolutti'), 'Gabriel',
    'o rótulo do WhatsApp vem com sobrenome e nome de empreendimento — só o primeiro nome é usado');
  assert.equal(primeiroNomeDoCliente('Não identificado'), '',
    'sem nome de verdade, melhor cumprimentar sem nome do que errar o nome');
  assert.equal(primeiroNomeDoCliente(''), '', 'nome vazio não vira saudação com nome');

  const semSaudacao = 'Das opções e valores que você conferiu no material, ficou alguma dúvida?';
  assert.equal(
    garantirSaudacaoAbertura(semSaudacao, { nome: 'Gabriel Quality', agora: tarde }),
    'Boa tarde, Gabriel! ' + semSaudacao,
    'a mensagem do print precisa sair cumprimentando o Gabriel'
  );
  assert.equal(
    garantirSaudacaoAbertura(semSaudacao, { nome: 'Gabriel Quality', agora: manha }),
    'Bom dia, Gabriel! ' + semSaudacao,
    'a faixa do dia é a do horário, como sempre'
  );

  // Já começa pelo nome: a saudação entra na frente e a frase continua igualzinha.
  assert.equal(
    garantirSaudacaoAbertura('Gabriel, consegui a simulação do apartamento.', { nome: 'Gabriel', agora: tarde }),
    'Boa tarde Gabriel, consegui a simulação do apartamento.',
    'quando a mensagem já chama pelo nome, o cumprimento entra antes do nome'
  );

  // Já cumprimenta: o código não encosta (acertar a faixa continua sendo trabalho da hora de mostrar).
  const jaCumprimenta = 'Bom dia Gabriel, tudo bem? Separei as duas opções que você viu.';
  assert.equal(garantirSaudacaoAbertura(jaCumprimenta, { nome: 'Gabriel', agora: tarde }), jaCumprimenta,
    'mensagem que já cumprimenta sai intacta daqui');
  const informal = 'Oi Gabriel, tudo certo?';
  assert.equal(garantirSaudacaoAbertura(informal, { nome: 'Gabriel', agora: tarde }), informal,
    '"oi" também é cumprimento — não pode virar "Boa tarde, Gabriel! Oi Gabriel"');

  // E nenhuma palavra do conteúdo é apagada ou trocada: o texto original continua inteiro dentro.
  const saida = garantirSaudacaoAbertura(semSaudacao, { nome: 'Gabriel', agora: tarde });
  assert.ok(saida.includes(semSaudacao), 'o texto escrito pela IA continua inteiro, letra por letra');
}

// ── 4. Ponta a ponta: conversa parada há dias sai com as três cumprimentando ─────────────────
{
  const diasAtras = (n) => {
    const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  const timeline = [
    { date: diasAtras(20), time: '07:29', author: 'Construtora Senger', text: 'Bom dia Gabriel, tudo bem? Sobre o Evolutti, o de dois dormitórios mais acessível está avaliado no valor que te passei.' },
    { date: diasAtras(20), time: '07:30', author: 'Gabriel Quality', text: 'Bom dia. Ok' },
    { date: diasAtras(20), time: '07:31', author: 'Construtora Senger', text: 'Separei as opções pra você ver as fotos e plantas.' }
  ];
  const semSaudacaoNenhuma = {
    recomendada: 'Das opções que você conferiu no material, ficou alguma dúvida ou prefere conhecer pessoalmente?',
    maisSuave: 'Sobre as opções que te passei, quer que eu detalhe planta ou condições?',
    maisDireta: 'Consigo agendar a visita: prefere sexta à tarde ou sábado de manhã?'
  };
  const openaiMock = {
    chat: { completions: { create: async () => ({
      model: 'mock-gpt',
      choices: [{ message: { content: JSON.stringify({
        summary: 'Resumo',
        diagnostico: { produtoPrincipal: 'Evolutti', etapaFunil: 'Atendimento' },
        mensagens: semSaudacaoNenhuma,
        quemEhOCliente: 'Gabriel Quality',
        produtoInteresse: 'Evolutti',
        produtosInteresse: ['Evolutti'],
        etapaSugerida: 'Atendimento',
        clientProfile: 'Perfil',
        nextAction: 'Ação'
      }) } }]
    }) } }
  };
  const resultado = await analyzeWithBrain({
    lead: { clientName: 'Gabriel Quality' },
    timeline,
    openai: openaiMock,
    cerebroConfig: { metodo: 'Método do corretor.', tom: 'Tom do corretor.', regras: [{ texto: 'Regra de teste.' }] }
  });

  const tres = [resultado.messages.a, resultado.messages.b, resultado.messages.c];
  for (const [i, msg] of tres.entries()) {
    assert.match(msg, /^(Bom dia|Boa tarde|Boa noite), Gabriel! /,
      `a sugestão ${i + 1} precisa sair cumprimentando o cliente pelo nome — foi o que faltou no print`);
  }
  // E o texto que a IA escreveu continua inteiro em cada uma: a rede acrescenta, não reescreve.
  assert.ok(tres[0].includes(semSaudacaoNenhuma.recomendada), 'a recomendada não pode ter sido reescrita');
  assert.ok(tres[1].includes(semSaudacaoNenhuma.maisSuave), 'a alternativa não pode ter sido reescrita');
  assert.ok(tres[2].includes(semSaudacaoNenhuma.maisDireta), 'a direta ao ponto não pode ter sido reescrita');
}

// ── 5. Conversa que continua HOJE: o código não encosta na saudação ──────────────────────────
{
  const hoje = new Date();
  const hojeBR = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
  const timeline = [
    { date: hojeBR, time: '09:00', author: 'Gabriel Quality', text: 'Bom dia! Recebi o material, obrigado.' },
    { date: hojeBR, time: '09:05', author: 'Construtora Senger', text: 'Bom dia Gabriel! Qualquer dúvida da planta me diz.' }
  ];
  const semSaudacao = 'Gabriel, das duas plantas que te mandei, qual chegou mais perto do que vocês querem?';
  const openaiMock = {
    chat: { completions: { create: async () => ({
      model: 'mock-gpt',
      choices: [{ message: { content: JSON.stringify({
        summary: 'Resumo',
        diagnostico: { produtoPrincipal: 'Evolutti', etapaFunil: 'Atendimento' },
        mensagens: { recomendada: semSaudacao, maisSuave: semSaudacao, maisDireta: semSaudacao },
        quemEhOCliente: 'Gabriel Quality',
        produtoInteresse: 'Evolutti',
        etapaSugerida: 'Atendimento',
        clientProfile: 'Perfil',
        nextAction: 'Ação'
      }) } }]
    }) } }
  };
  const resultado = await analyzeWithBrain({
    lead: { clientName: 'Gabriel Quality' },
    timeline,
    openai: openaiMock,
    cerebroConfig: { metodo: 'Método do corretor.', tom: 'Tom do corretor.', regras: [{ texto: 'Regra de teste.' }] }
  });
  assert.equal(resultado.messages.a, semSaudacao,
    'conversa que continua hoje: quem decide a saudação é a regra do prompt, o código não acrescenta nada');
}

console.log('v1274-saudacao-e-retomada-nas-tres: ok');
