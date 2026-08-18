import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain, frasesDeRoboEmMensagem } from '../api/_pipeline.js';

// v1298 — pedido direto do dono, 18/08/2026, olhando as sugestões da v1297: "faz as duas, manda
// direto e tira o sem compromisso".
//
// As duas coisas que ele apontou nas sugestões daquele print:
//   1. "Prefere que eu explique por aqui ou envio um material resumido?" — devolver a escolha do
//      formato pro cliente dá a ele mais uma chance de adiar. Quem escolhe o caminho é o corretor.
//   2. "posso esclarecer melhor as condições de pagamento, SEM COMPROMISSO" — pedir licença pra
//      fazer o próprio trabalho, e ainda avisar o cliente de que ele pode ignorar.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. "sem compromisso" virou frase proibida, com rede de reescrita ────────────────────────
{
  for (const frase of [
    'Oi, Julsimar! Posso te explicar as condições, sem compromisso.',
    'Te mando o material sem nenhum compromisso.',
    'Sem qualquer compromisso, posso te passar os valores.'
  ]) {
    assert.deepEqual(frasesDeRoboEmMensagem(frase), ['sem compromisso'],
      `"${frase}" precisa ser reconhecida como pedido de licença`);
  }
  assert.deepEqual(frasesDeRoboEmMensagem('Julsimar, te envio agora o quadro completo de condições pra sua análise.'), [],
    'mensagem que entrega direto continua limpa');

  const cliche = src.slice(src.indexOf('LINGUAGEM DE IA — PROIBIDO'), src.indexOf('PALAVRA EM INGLÊS')).replace(/\s+/g, ' ');
  assert.ok(cliche.includes('"sem compromisso"'), 'a frase precisa estar escrita na lista mandada pra IA');
  assert.ok(cliche.includes('não pede\nlicença'.replace(/\s+/g, ' ')) || cliche.includes('não pede licença'),
    'a lista precisa dizer POR QUE a frase cai, senão a IA troca por outra parecida');
}

// ── 2. Um caminho só: a escolha do formato é do corretor ────────────────────────────────────
{
  const iniRegras = src.indexOf('REGRAS PARA AS TRÊS MENSAGENS');
  const regras = src.slice(iniRegras, src.indexOf('LINGUAGEM DE IA — PROIBIDO', iniRegras)).replace(/\s+/g, ' ');
  assert.ok(regras.includes('UM CAMINHO SÓ'), 'a regra do caminho único precisa existir no pedido');
  assert.ok(regras.includes('prefere que eu explique por aqui ou envio um material?'),
    'o exemplo real do print precisa estar nomeado');
  assert.ok(regras.includes('escolher é trabalho do corretor'),
    'a regra precisa dizer de quem é a escolha');
  assert.ok(regras.includes('marcar dia/hora'),
    'oferecer dois horários continua valendo: sem a exceção, a regra atrapalharia o agendamento');
}

// ── 3. Na análise de verdade: "sem compromisso" volta pra IA reescrever ─────────────────────
{
  const timeline = [
    { date: '18/08/2026', time: '15:48', author: 'Julsimar Chapada', text: 'Estamos analisando ainda, mas gostei da ideia' }
  ];
  const pedidos = [];
  const openaiMock = { chat: { completions: { create: async (args) => {
    pedidos.push(args.messages.map(m => m.content).join('\n\n'));
    if (pedidos.length === 1) {
      return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
        summary: 'Resumo', diagnostico: {},
        mensagens: {
          recomendada: 'Oi, Julsimar! Posso esclarecer melhor as condições de pagamento, sem compromisso.',
          maisSuave: 'Julsimar, te mando o quadro de condições organizado hoje ainda?',
          maisDireta: 'Julsimar, envio agora as condições completas pra sua análise?'
        },
        quemEhOCliente: 'Julsimar Chapada', produtoInteresse: 'Não identificado',
        etapaSugerida: 'Atendimento', clientProfile: 'Perfil', nextAction: 'Enviar as condições'
      }) } }] };
    }
    return { model: 'mock-mini', choices: [{ message: { content: JSON.stringify({
      a: 'Oi, Julsimar! Te explico as condições de pagamento certinho por aqui.'
    }) } }] };
  } } } };

  const r = await analyzeWithBrain({
    lead: { clientName: 'Julsimar Chapada', corretorNome: 'Sanchai' },
    timeline,
    openai: openaiMock,
    cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Método.', tom: 'Tom.', regras: [{ texto: 'Regra.' }] }
  });

  assert.equal(pedidos.length, 2, 'a mensagem com "sem compromisso" precisa voltar pra IA reescrever');
  assert.deepEqual(frasesDeRoboEmMensagem(r.messages.a), [],
    'a sugestão que chega na tela não pode mais pedir licença');
  assert.equal(r.reescritaAntiRobo, 1, 'o registro precisa contar a reescrita');
  assert.equal(r.messages.c, 'Julsimar, envio agora as condições completas pra sua análise?',
    'mensagem que já entrega direto não é tocada');
}

console.log('v1298-um-caminho-so-e-sem-compromisso: ok');
