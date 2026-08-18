import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain, contarCerebroEnviado, contarAprendizadoEnviado } from '../api/_pipeline.js';

// v1296 — "q lixo de sugestões, não esta sendo feito o q deve! cade as regras, o cerebro, o
// aprendizado????" (dono, 18/08/2026, com dois prints).
//
// As três sugestões do print terminavam assim: "pode me chamar por aqui", "me avise caso surja
// alguma dúvida", "posso te explicar por aqui". Nenhuma fazia nada — e o cliente tinha acabado de
// dizer que gostou e que só sabia das condições de pagamento "mais ou menos", por um terceiro.
//
// Duas coisas entram aqui:
//   1. A PROVA. A linha embaixo das sugestões sabe mostrar o que foi enviado desde a v1239, mas o
//      servidor parou de mandar os números na v1247. Sem eles, "cadê o Cérebro?" não tem resposta.
//      O aprendizado nunca teve prova nenhuma.
//   2. A REGRA. Mensagem que devolve a iniciativa pro cliente não é próximo passo — isso passou a
//      estar escrito no pedido feito à IA e na conferência final dela.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const appSrc = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const persistSrc = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

// ── 1. A conta do Cérebro: campo por campo, e zero quando está vazio ────────────────────────
{
  const c = contarCerebroEnviado({
    corretorNome: 'Sanchai',
    metodo: 'M'.repeat(120),
    tom: 'T'.repeat(40),
    diferenciais: '',
    evitar: '',
    regrasTexto: 'R'.repeat(300),
    objecoesTexto: ''
  });
  assert.equal(c.metodo, 120, 'o método precisa ser contado');
  assert.equal(c.tom, 40);
  assert.equal(c.regras, 300, 'as regras salvas precisam ser contadas');
  assert.equal(c.diferenciais, 0, 'campo vazio precisa aparecer como zero, não sumir');
  assert.equal(c.objecoes, 0);
  assert.equal(c.total, 460, 'o total é a soma do que foi enviado');

  // Cérebro antigo, guardado como lista de regras: também conta.
  const legado = contarCerebroEnviado({ regras: [{ texto: 'Sempre confirmar a forma de pagamento.' }] });
  assert.ok(legado.regras > 10, 'Cérebro salvo no formato antigo (lista de regras) não pode contar zero');

  // Conta zerada não inventa número nenhum.
  assert.equal(contarCerebroEnviado({}).total, 0);
  assert.equal(contarCerebroEnviado(null).total, 0);
}

// ── 2. A conta do aprendizado: cada fonte separada ──────────────────────────────────────────
{
  const a = contarAprendizadoEnviado({
    jeitoAprendido: 'SEU JEITO (aprendido das suas conversas reais):\n- Mensagem real sua: Bom dia! Consigo te mandar hoje.\n- Já funcionou com você: mandar o quadro por escrito',
    casosSemelhantes: 'CASOS REAIS DESTE CORRETOR:\n- Situação: cliente sumiu | Você conduziu assim: mandou o quadro\n- Situação: cliente pediu valor | Você conduziu assim: mandou a tabela',
    conhecimentoCorretor: 'O corretor ensinou: o estande abre sábado de manhã.',
    exemplosVozCorretor: 'Bom dia! Tudo certo?\nConsigo te mandar hoje ainda.'
  });
  assert.equal(a.jeito, 2, 'as linhas do "seu jeito" precisam ser contadas');
  assert.equal(a.casos, 2, 'os casos reais da carteira precisam ser contados');
  assert.ok(a.fatos > 0, 'os fatos ensinados pelo corretor precisam aparecer');
  assert.equal(a.voz, 2, 'as mensagens reais dele nesta conversa precisam ser contadas');

  const vazio = contarAprendizadoEnviado({});
  assert.deepEqual(vazio, { jeito: 0, casos: 0, fatos: 0, voz: 0 },
    'sem aprendizado nenhum, a conta precisa ser zero em tudo — é isso que a tela precisa poder dizer');
}

// ── 3. A análise de verdade devolve as duas provas ──────────────────────────────────────────
{
  const timeline = [
    { date: '18/08/2026', time: '15:38', author: 'Sanchai', text: 'Boa tarde! Conseguiu dar uma olhada no material?' },
    { date: '18/08/2026', time: '15:48', author: 'Alceu Barreto', text: 'Estamos analisando ainda, mas gostei da ideia' },
    { date: '18/08/2026', time: '15:48', author: 'Alceu Barreto', text: 'O Rodrigo me falou mais ou menos as condições de pagamento' }
  ];
  const openaiMock = { chat: { completions: { create: async () => ({
    model: 'mock-gpt',
    choices: [{ message: { content: JSON.stringify({
      summary: 'Cliente analisando.',
      diagnostico: {},
      mensagens: {
        recomendada: 'Alceu, te mando o quadro de condições certinho por escrito agora?',
        maisSuave: 'Alceu, quer que eu organize as condições num resumo pra vocês analisarem juntos?',
        maisDireta: 'Alceu, me diz o que ainda falta pra decisão que eu já preparo.'
      },
      quemEhOCliente: 'Alceu Barreto',
      produtoInteresse: 'Não identificado',
      etapaSugerida: 'Atendimento',
      clientProfile: 'Perfil',
      nextAction: 'Enviar as condições por escrito'
    }) } }]
  }) } } };

  const r = await analyzeWithBrain({
    lead: { clientName: 'Alceu Barreto', corretorNome: 'Sanchai' },
    timeline,
    openai: openaiMock,
    cerebroConfig: {
      corretorNome: 'Sanchai',
      metodo: 'Método do corretor escrito por ele.',
      tom: 'Tom direto.',
      regras: [{ texto: 'Sempre mandar as condições por escrito quando o cliente ouviu por terceiro.' }],
      inteligenciaAprendida: {
        tons: [{ texto: 'Bom dia! Consigo te mandar hoje ainda, tudo bem?' }],
        movimentosOk: [{ texto: 'mandar o quadro de condições por escrito destrava a análise' }]
      }
    }
  });

  assert.ok(r.cerebroEnviado && r.cerebroEnviado.total > 0,
    'a análise precisa voltar dizendo quanto do Cérebro foi enviado');
  assert.ok(r.cerebroEnviado.metodo > 0 && r.cerebroEnviado.regras > 0,
    'método e regras precisam aparecer separados — é assim que dá pra ver qual campo está vazio');
  assert.ok(r.aprendizadoEnviado && typeof r.aprendizadoEnviado === 'object',
    'a análise precisa voltar dizendo o que o aprendizado pôs no pedido');
  assert.ok(r.aprendizadoEnviado.jeito > 0, 'o "seu jeito" aprendido entrou nesta análise e precisa ser contado');
  assert.ok(r.aprendizadoEnviado.voz > 0, 'a mensagem real do corretor nesta conversa também é aprendizado');
  assert.equal(r.cerebroAplicado, true);
}

// ── 4. Sem Cérebro e sem aprendizado: a prova precisa dizer ZERO, não sumir ─────────────────
{
  const timeline = [{ date: '18/08/2026', time: '15:48', author: 'Alceu Barreto', text: 'Quero informações' }];
  const openaiMock = { chat: { completions: { create: async () => ({
    model: 'mock-gpt',
    choices: [{ message: { content: JSON.stringify({
      summary: 'Resumo', diagnostico: {},
      mensagens: { recomendada: 'Oi Alceu! Me conta o que você procura que eu já te mando as opções.', maisSuave: 'Oi Alceu! O que você procura?', maisDireta: 'Oi Alceu! Me diz o que procura hoje.' },
      quemEhOCliente: 'Alceu Barreto', produtoInteresse: 'Não identificado', etapaSugerida: 'Atendimento', clientProfile: 'Perfil', nextAction: 'Descobrir o que procura'
    }) } }]
  }) } } };
  const r = await analyzeWithBrain({
    lead: { clientName: 'Alceu Barreto' },
    timeline,
    openai: openaiMock,
    cerebroConfig: { corretorNome: 'Sanchai', metodo: '', tom: '', regras: [], objecoes: [] }
  });
  assert.equal(r.cerebroEnviado.total, 0, 'conta sem Cérebro precisa mostrar zero, e não esconder a linha');
  assert.equal(r.aprendizadoEnviado.jeito, 0, 'sem aprendizado, a tela precisa poder dizer que nada entrou');
}

// ── 5. A tela mostra as duas provas ─────────────────────────────────────────────────────────
assert.ok(appSrc.includes('a.aprendizadoEnviado'), 'a tela precisa ler o que o aprendizado enviou');
assert.ok(appSrc.includes('aprendizado aplicado:'), 'quando entrou aprendizado, a linha precisa dizer o que entrou');
assert.ok(appSrc.includes('aprendizado: nada entrou nesta análise'),
  'quando NÃO entrou nada, a linha precisa dizer isso com todas as letras — é a resposta do "cadê o aprendizado?"');
assert.ok(appSrc.includes('seu Cérebro enviado:'), 'a prova do Cérebro continua na tela');
assert.ok(/"cerebroAplicado", "cerebroEnviado", "aprendizadoEnviado", "conversaLidaPelaIA"/.test(persistSrc),
  'as duas provas precisam viajar junto com a análise, senão a linha pisca ao abrir o lead pela lista');

// ── 6. A regra nova: mensagem que só espera não é próximo passo ─────────────────────────────
{
  const iniRegras = src.indexOf('REGRAS PARA AS TRÊS MENSAGENS');
  assert.ok(iniRegras > -1, 'o bloco de regras das três mensagens precisa existir no pedido');
  const regras = src.slice(iniRegras, src.indexOf('LINGUAGEM DE IA — PROIBIDO', iniRegras)).replace(/\s+/g, ' ');
  assert.ok(regras.includes('CADA UMA DAS TRÊS PRECISA FAZER ALGUMA COISA'),
    'o pedido precisa exigir que cada mensagem entregue, traga ou peça algo');
  for (const fim of ['me avise', 'pode me chamar por aqui', 'fico no aguardo']) {
    assert.ok(regras.includes(fim), `o fecho "${fim}" (o do print) precisa estar nomeado como o que NÃO é próximo passo`);
  }
  assert.ok(regras.includes('Menor próximo passo útil não quer dizer passo nenhum'),
    'sem esta linha, "menor próximo passo" continua virando desculpa pra não fazer nada');
  assert.ok(regras.includes('as três terminam pedindo que'),
    'as três iguais esperando é o defeito do print e precisa estar proibido por escrito');
  assert.ok(regras.includes('por alto') && regras.includes('mais ou menos'),
    'o cliente dizer que soube "por alto" é abertura pra entregar a informação, e isso precisa estar escrito');

  const revisao = src.slice(src.indexOf('REVISÃO FINAL SILENCIOSA')).replace(/\s+/g, ' ');
  assert.ok(revisao.includes('jogando para o cliente a decisão de continuar'),
    'a conferência final da IA precisa pegar a mensagem que só espera');
}

// ── 7. As contas não podem mexer no que vai pra IA ──────────────────────────────────────────
// Elas só leem o que já foi montado. Se um dia alguém fizer o prompt depender delas, o pedido
// passa a mudar por causa de um contador de tela — e isso já foi motivo de estrago aqui.
{
  const trecho = src.slice(src.indexOf('const cerebroEnviado = contarCerebroEnviado'), src.indexOf('const systemPromptAnalise'));
  assert.ok(!/prompt|systemPrompt/.test(trecho), 'o contador não pode entrar na montagem do pedido');
}

console.log('v1296-cade-o-cerebro-e-o-aprendizado: ok');
