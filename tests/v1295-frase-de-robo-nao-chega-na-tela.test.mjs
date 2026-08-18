import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain, frasesDeRoboEmMensagem } from '../api/_pipeline.js';

// v1295 — print do dono de 18/08/2026, 16h08 (lead Julsimar / Premium Office). A sugestão
// RECOMENDADA na tela dele:
//
//   "Que bom que gostou do Premium Office, Julsimar. Fico à disposição se quiser saber mais sobre
//    alguma condição ou ponto do imóvel. Caso precise de algum detalhamento, me avise."
//
// "Fico à disposição" é a PRIMEIRA frase da lista "LINGUAGEM DE IA — PROIBIDO" — a mesma lista que
// ele mandou recolocar no pedido no dia anterior (v1292). O pedido continua sendo a rede principal;
// o que a v1295 acrescenta é o que acontece quando a frase escapa mesmo assim: a mensagem volta
// PRA IA reescrever inteira. O código não corta nem costura texto (v1247) e nunca joga a análise
// fora.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const MSG_DO_PRINT = 'Que bom que gostou do Premium Office, Julsimar. Fico à disposição se quiser saber mais sobre alguma condição ou ponto do imóvel. Caso precise de algum detalhamento, me avise.';

// ── 1. A frase do print é reconhecida, e mensagem boa não é acusada à toa ────────────────────
{
  assert.deepEqual(frasesDeRoboEmMensagem(MSG_DO_PRINT), ['fico à disposição'],
    'a frase exata do print precisa ser reconhecida');
  for (const frase of [
    'Estou à disposição para o que precisar.',
    'Me coloco à disposição, Julsimar.',
    'Se fizer sentido pra você, te mando os valores.',
    'Espero que esteja bem!',
    'Qualquer dúvida estou aqui.',
    'Não hesite em me chamar.',
    'Sinta-se à vontade para perguntar.',
    'Te mando um overview do empreendimento.',
    'Marcamos uma call amanhã?'
  ]) {
    assert.ok(frasesDeRoboEmMensagem(frase).length > 0, `"${frase}" precisa ser reconhecida como frase de robô`);
  }
  for (const frase of [
    'Julsimar, o Nicolas te passou as condições por alto. Te mando o quadro completo agora?',
    'Bom dia! O studio duplex do Premium Office tem home office e fica no hall de entrada.',
    'Consigo te mostrar o decorado quinta às 18h.',
    ''
  ]) {
    assert.deepEqual(frasesDeRoboEmMensagem(frase), [], `"${frase}" é mensagem limpa e não pode ser acusada`);
  }
}

// ── 2. Na análise de verdade: a frase escapou, a IA reescreve, e a tela recebe o texto limpo ──
{
  const timeline = [
    { date: '18/08/2026', time: '15:38', author: 'Construtora Senger', text: 'Boa tarde, Julcimar! O Nicolas me passou seu contato sobre o Premium Office. Conseguiu dar uma olhada?' },
    { date: '18/08/2026', time: '15:46', author: 'Julsimar Chapada', text: 'Dei uma olhada sim' },
    { date: '18/08/2026', time: '15:48', author: 'Julsimar Chapada', text: 'Estamos analisando ainda, mas gostei da ideia' },
    { date: '18/08/2026', time: '15:48', author: 'Julsimar Chapada', text: 'O Nicolas me falou mais ou menos as condições de pagamento' }
  ];
  const pedidos = [];
  const openaiMock = {
    chat: { completions: { create: async (args) => {
      const texto = args.messages.map(m => m.content).join('\n\n');
      pedidos.push(texto);
      if (pedidos.length === 1) {
        return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
          summary: 'Cliente analisando o Premium Office.',
          diagnostico: { etapaFunil: 'Atendimento' },
          mensagens: {
            recomendada: MSG_DO_PRINT,
            maisSuave: 'Ótimo saber que está analisando, Julsimar. Se surgir alguma dúvida sobre as condições que o Nicolas mencionou, pode contar comigo.',
            maisDireta: 'Julsimar, quer que eu te mande o quadro de condições do Premium Office por escrito?'
          },
          quemEhOCliente: 'Julsimar Chapada',
          produtoInteresse: 'Premium Office',
          etapaSugerida: 'Atendimento',
          clientProfile: 'Perfil',
          nextAction: 'Ação'
        }) } }] };
      }
      return { model: 'mock-mini', choices: [{ message: { content: JSON.stringify({
        a: 'Que bom que gostou do Premium Office, Julsimar. Me diz qual ponto você quer detalhar que eu te mando.'
      }) } }] };
    } } }
  };
  const r = await analyzeWithBrain({
    lead: { clientName: 'Julsimar Chapada', corretorNome: 'Sanchai' },
    timeline,
    openai: openaiMock,
    cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Método do corretor.', tom: 'Tom do corretor.', regras: [{ texto: 'Regra de teste.' }] }
  });

  assert.equal(pedidos.length, 2, 'a mensagem furada precisa voltar pra IA numa segunda chamada');
  assert.ok(pedidos[1].includes('Fico à disposição'),
    'o pedido de reescrita precisa levar o texto original da mensagem');
  assert.ok(pedidos[1].includes('mesmo conteúdo'),
    'a reescrita não pode virar mensagem nova: o pedido manda manter conteúdo e próximo passo');
  assert.deepEqual(frasesDeRoboEmMensagem(r.messages.a), [],
    'a sugestão que chega na tela não pode mais ter a frase proibida');
  assert.ok(r.messages.a.includes('Premium Office'), 'a reescrita continua falando do mesmo assunto');
  assert.equal(r.messages.b, 'Ótimo saber que está analisando, Julsimar. Se surgir alguma dúvida sobre as condições que o Nicolas mencionou, pode contar comigo.',
    'mensagem limpa não é tocada');
  assert.equal(r.reescritaAntiRobo, 1, 'o registro precisa dizer quantas sugestões foram reescritas');
  assert.equal(r.sugestoesPendentes, false, 'a análise continua completa depois da reescrita');
}

// ── 3. Reescrita pior, vazia ou com erro: fica valendo o texto ORIGINAL da IA ────────────────
// Nunca se descarta análise nem se entrega mensagem em branco por causa desta rede (regra do dono).
{
  const timeline = [
    { date: '18/08/2026', time: '15:48', author: 'Julsimar Chapada', text: 'Estamos analisando ainda, mas gostei da ideia' }
  ];
  for (const segundaResposta of [
    () => { throw new Error('a OpenAI caiu na reescrita'); },
    () => ({ model: 'mock-mini', choices: [{ message: { content: JSON.stringify({ a: '' }) } }] }),
    () => ({ model: 'mock-mini', choices: [{ message: { content: JSON.stringify({ a: 'Fico à disposição, Julsimar.' }) } }] })
  ]) {
    let n = 0;
    const openaiMock = { chat: { completions: { create: async () => {
      n++;
      if (n === 1) {
        return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
          summary: 'Resumo', diagnostico: {},
          mensagens: { recomendada: MSG_DO_PRINT, maisSuave: 'Te mando o quadro de condições?', maisDireta: 'Quer o quadro de condições agora?' },
          quemEhOCliente: 'Julsimar Chapada', produtoInteresse: 'Premium Office', etapaSugerida: 'Atendimento', clientProfile: 'Perfil', nextAction: 'Ação'
        }) } }] };
      }
      return segundaResposta();
    } } } };
    const r = await analyzeWithBrain({
      lead: { clientName: 'Julsimar Chapada', corretorNome: 'Sanchai' },
      timeline,
      openai: openaiMock,
      cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Método.', tom: 'Tom.', regras: [{ texto: 'Regra.' }] }
    });
    assert.equal(r.messages.a, MSG_DO_PRINT, 'sem reescrita melhor, vale o texto original da IA — nunca vazio, nunca genérico');
    assert.equal(r.sugestoesPendentes, false, 'a análise nunca é descartada por causa da reescrita');
  }
}

// ── 4. Nada de cirurgia determinística no texto (regra do dono, v1247) ──────────────────────
assert.ok(!/limparFrasesProibidas|melhorLimpa/.test(src),
  'o corte determinístico de frase proibida não pode voltar: quem reescreve é a IA');
assert.ok(src.includes('LINGUAGEM DE IA — PROIBIDO'),
  'a lista continua no pedido enviado à IA — a reescrita é rede extra, não substituta');

console.log('v1295-frase-de-robo-nao-chega-na-tela: ok');
