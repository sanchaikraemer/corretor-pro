import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain, problemasNaMensagem, frasesDeRoboEmMensagem } from '../api/_pipeline.js';

// v1299 — print do dono de 18/08/2026, 17h40, já na v1298. As três sugestões finalmente ENTREGAM
// ("Vou te passar agora as condições de pagamento, nos detalhes"), mas duas terminam devolvendo a
// bola e a terceira pede licença:
//
//   1. "...Se quiser comentar algum ponto específico ou ajustar algo, me avise, certo?"
//   2. "...se quiser posso te detalhar as principais condições de pagamento..."
//   3. "...Me avise se precisar de algum ajuste ou simulação diferente."
//
// A regra escrita contra isso existe desde a v1296 e mesmo assim as frases voltaram: regra sozinha
// não segurou. Agora vale a mesma rede que já funciona para frase de robô desde a v1295 — o código
// PERCEBE e a IA REESCREVE. Nenhuma cirurgia no texto (proibição do dono, v1247).

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

const MSG1_DO_PRINT = 'Boa tarde, Julsimar! Fico feliz que tenha gostado da ideia do Premium Office. Vou colocar aqui de forma bem clara as condições de pagamento do empreendimento para você analisar com mais detalhe. Se quiser comentar algum ponto específico ou ajustar algo, me avise, certo?';
const MSG2_DO_PRINT = 'Boa tarde, Julsimar! Como você ouviu pelo Nicolas só por alto, se quiser posso te detalhar as principais condições de pagamento do Premium Office, para facilitar sua análise. Tem algum ponto específico das condições que gostaria que eu explicasse melhor?';
const MSG3_DO_PRINT = 'Boa tarde, Julsimar! Vou te passar agora as condições de pagamento do Premium Office, nos detalhes. Assim você pode analisar com todas as informações. Me avise se precisar de algum ajuste ou simulação diferente.';

// ── 1. As três formas do print são reconhecidas ─────────────────────────────────────────────
{
  assert.deepEqual(problemasNaMensagem(MSG1_DO_PRINT), ['fecho que manda o cliente avisar'],
    'o fecho "me avise, certo?" precisa ser pego');
  assert.deepEqual(problemasNaMensagem(MSG2_DO_PRINT), ['pede licença em vez de entregar'],
    '"se quiser posso te detalhar" precisa ser pego');
  assert.deepEqual(problemasNaMensagem(MSG3_DO_PRINT), ['fecho que manda o cliente avisar'],
    '"Me avise se precisar de algum ajuste" precisa ser pego');

  for (const espera of [
    'Julsimar, te mando o quadro hoje. Fico no aguardo.',
    'Te mando as condições. Qualquer coisa me chama.',
    'Segue o material. Estou por aqui.',
    'Te explico tudo. Pode contar comigo.'
  ]) {
    assert.ok(problemasNaMensagem(espera).length > 0, `"${espera}" termina em sala de espera e precisa cair na rede`);
  }
}

// ── 2. O que NÃO pode cair na rede: pergunta concreta e oferta de horário ────────────────────
// Sem isto, a rede começaria a reescrever mensagem boa — o oposto do pedido do dono.
{
  for (const boa of [
    'Julsimar, te mando o quadro completo agora. Me avise qual formato prefere para a simulação: à vista ou parcelado?',
    'Consigo te receber no decorado quinta às 18h ou sábado de manhã. Qual fica melhor?',
    'Te passo as condições hoje ainda. Amanhã te ligo para conversar.',
    'Julsimar, mando agora as condições completas para sua análise.'
  ]) {
    assert.deepEqual(problemasNaMensagem(boa), [], `"${boa}" é mensagem boa e não pode ser acusada`);
  }
  // A checagem do fecho olha só o FIM da mensagem: "me avise" no meio, com pergunta concreta
  // depois, não é sala de espera.
  assert.deepEqual(problemasNaMensagem('Me avise se preferir por áudio. Te mando o quadro agora e amanhã te ligo às 9h?'), [],
    'quando a mensagem termina numa pergunta concreta, o meio dela não pode derrubá-la');
  assert.deepEqual(problemasNaMensagem(''), [], 'mensagem vazia não gera acusação');
  assert.deepEqual(frasesDeRoboEmMensagem(MSG3_DO_PRINT), [],
    'a lista antiga (frase de robô) continua existindo e não muda de comportamento');
}

// ── 3. Na análise de verdade: as duas voltam pra IA e chegam limpas na tela ──────────────────
{
  const timeline = [
    { date: '18/08/2026', time: '15:48', author: 'Julsimar Chapada', text: 'O Nicolas me falou mais ou menos as condições de pagamento' }
  ];
  const pedidos = [];
  const openaiMock = { chat: { completions: { create: async (args) => {
    pedidos.push(args.messages.map(m => m.content).join('\n\n'));
    if (pedidos.length === 1) {
      return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
        summary: 'Resumo', diagnostico: {},
        mensagens: { recomendada: MSG1_DO_PRINT, maisSuave: MSG2_DO_PRINT, maisDireta: 'Julsimar, te passo agora as condições completas para sua análise.' },
        quemEhOCliente: 'Julsimar Chapada', produtoInteresse: 'Não identificado',
        etapaSugerida: 'Atendimento', clientProfile: 'Perfil', nextAction: 'Enviar as condições'
      }) } }] };
    }
    return { model: 'mock-mini', choices: [{ message: { content: JSON.stringify({
      a: 'Boa tarde, Julsimar! Vou colocar aqui as condições de pagamento bem claras para você analisar com detalhe.',
      b: 'Boa tarde, Julsimar! Como você ouviu pelo Nicolas só por alto, te detalho agora as principais condições de pagamento. Tem algum ponto que quer ver primeiro?'
    }) } }] };
  } } } };

  const r = await analyzeWithBrain({
    lead: { clientName: 'Julsimar Chapada', corretorNome: 'Sanchai' },
    timeline,
    openai: openaiMock,
    cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Método.', tom: 'Tom.', regras: [{ texto: 'Regra.' }] }
  });

  assert.equal(pedidos.length, 2, 'as mensagens furadas voltam numa segunda chamada só');
  assert.ok(pedidos[1].includes('fecho que manda o cliente avisar'), 'o pedido de reescrita precisa dizer o que sai da mensagem 1');
  assert.ok(pedidos[1].includes('pede licença em vez de entregar'), 'e o que sai da mensagem 2');
  assert.ok(pedidos[1].includes('termine a mensagem na\n  entrega ou na pergunta concreta') || pedidos[1].includes('termine a mensagem na'),
    'a instrução precisa dizer onde a mensagem termina, senão a IA troca um fecho por outro');
  assert.deepEqual(problemasNaMensagem(r.messages.a), [], 'a recomendada chega limpa na tela');
  assert.deepEqual(problemasNaMensagem(r.messages.b), [], 'a alternativa chega limpa na tela');
  assert.equal(r.messages.c, 'Julsimar, te passo agora as condições completas para sua análise.', 'a que já estava boa não é tocada');
  assert.equal(r.reescritaAntiRobo, 2, 'o registro precisa contar as duas reescritas');
}

// ── 4. Reescrita que volta ainda suja não entra: fica o texto original ───────────────────────
{
  const timeline = [{ date: '18/08/2026', time: '15:48', author: 'Julsimar Chapada', text: 'Gostei da ideia' }];
  let n = 0;
  const openaiMock = { chat: { completions: { create: async () => {
    n++;
    if (n === 1) {
      return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
        summary: 'Resumo', diagnostico: {},
        mensagens: { recomendada: MSG3_DO_PRINT, maisSuave: 'Te mando agora o quadro.', maisDireta: 'Mando agora o quadro?' },
        quemEhOCliente: 'Julsimar Chapada', produtoInteresse: 'Não identificado', etapaSugerida: 'Atendimento', clientProfile: 'Perfil', nextAction: 'Enviar'
      }) } }] };
    }
    // A IA só trocou um fecho de espera por outro: não vale.
    return { model: 'mock-mini', choices: [{ message: { content: JSON.stringify({
      a: 'Boa tarde, Julsimar! Vou te passar agora as condições. Fico no aguardo.'
    }) } }] };
  } } } };
  const r = await analyzeWithBrain({
    lead: { clientName: 'Julsimar Chapada', corretorNome: 'Sanchai' },
    timeline,
    openai: openaiMock,
    cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Método.', tom: 'Tom.', regras: [{ texto: 'Regra.' }] }
  });
  assert.equal(r.messages.a, MSG3_DO_PRINT, 'reescrita que continua suja não substitui nada — fica o texto original da IA');
  assert.equal(r.sugestoesPendentes, false, 'e a análise segue inteira');
}

// ── 5. A regra também está escrita no pedido, não só na rede ────────────────────────────────
{
  const iniRegras = src.indexOf('REGRAS PARA AS TRÊS MENSAGENS');
  const regras = src.slice(iniRegras, src.indexOf('LINGUAGEM DE IA — PROIBIDO', iniRegras)).replace(/\s+/g, ' ');
  assert.ok(regras.includes('NÃO PEÇA LICENÇA PARA ENTREGAR'), 'a regra precisa estar escrita no pedido');
  assert.ok(regras.includes('te detalho as condições agora'), 'com a troca pronta, senão a IA só reescreve o pedido de licença');
  assert.ok(!/limparFrasesProibidas|melhorLimpa/.test(src), 'nada de cirurgia determinística no texto (v1247)');
}

console.log('v1299-fecho-e-licenca-caem-na-rede: ok');
