import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain, tentativasSemRespostaDoCorretor } from '../api/_pipeline.js';

// v1277 — "cadê a retomada? DE NOVO!!!!" (dono, 14/08/2026, com print das três sugestões).
//
// A conversa do print (lead Ana Paula, Renaissance):
//   18/06 — cliente: "Preenchi seu formulário e gostaria de saber mais sobre sua empresa."
//   18/06 — corretor: apresenta o Renaissance e pergunta "posso seguir com a apresentação?"
//   16/07 — corretor: "posso ajudar com mais informações sobre o Renaissance e enviar apresentação
//           ou esclarecer alguma dúvida?"
// O cliente NUNCA respondeu nenhuma das duas. E as três sugestões do app ofereceram, pela TERCEIRA
// vez, exatamente a mesma apresentação ("posso te encaminhar uma apresentação completa?", "fico à
// disposição para explicar melhor", "já posso te encaminhar agora a apresentação completa").
//
// A causa: a IA não recebia em lugar nenhum o fato de que aquilo JÁ tinha sido tentado e falhado.
// A v1277 conta as tentativas sem resposta, manda o texto delas no pedido e proíbe repeti-las.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. A conta das tentativas: só a fala do CLIENTE zera o contador ──────────────────────────
{
  const conversaDoPrint = [
    { date: '18/06/2026', time: '12:28', author: 'Ana Paula Milani Renaissance', text: 'Olá! Preenchi seu formulário e gostaria de saber mais sobre sua empresa.' },
    { date: '18/06/2026', time: '12:38', author: 'Construtora Senger', text: 'Olá Ana Paula! Obrigado pelo interesse. Você tem alguma dúvida principal ou posso seguir com a apresentação?' },
    { date: '16/07/2026', time: '11:59', author: 'Construtora Senger', text: 'Olá, Ana Paula! Tudo bem? Passando para saber se posso ajudar com mais informações sobre o Renaissance e enviar apresentação ou esclarecer alguma dúvida?' }
  ];
  const r = tentativasSemRespostaDoCorretor(conversaDoPrint, 'Sanchai', { clientName: 'Ana Paula Milani Renaissance' });
  assert.equal(r.tentativas, 2, 'foram dois contatos do corretor, em dias diferentes, sem nenhuma resposta');
  assert.equal(r.textos.length, 2, 'o texto das duas tentativas precisa chegar na IA');
  assert.ok(r.textos[0].includes('posso seguir com a apresentação'), 'a primeira tentativa é a do dia 18/06');
  assert.ok(r.textos[1].includes('enviar apresentação'), 'a segunda tentativa é a do dia 16/07');

  // Cliente respondeu por último: não há tentativa pendente nenhuma.
  const comResposta = [...conversaDoPrint, { date: '17/07/2026', time: '09:00', author: 'Ana Paula Milani Renaissance', text: 'Pode mandar sim!' }];
  assert.equal(tentativasSemRespostaDoCorretor(comResposta, 'Sanchai', { clientName: 'Ana Paula Milani Renaissance' }).tentativas, 0,
    'quando a última palavra é do cliente, não existe tentativa sem resposta');

  // Três mensagens seguidas do MESMO dia são UMA tentativa — senão a conta infla e a regra da
  // escalada (duas ou mais) dispararia num contato só, quebrado em vários balões.
  const rajada = [
    { date: '18/06/2026', time: '12:28', author: 'Ana Paula Milani Renaissance', text: 'Olá! Preenchi seu formulário.' },
    { date: '18/06/2026', time: '12:38', author: 'Construtora Senger', text: 'Olá Ana Paula!' },
    { date: '18/06/2026', time: '12:39', author: 'Construtora Senger', text: 'O Renaissance é o maior projeto da nossa história.' },
    { date: '18/06/2026', time: '12:40', author: 'Construtora Senger', text: 'Posso seguir com a apresentação?' }
  ];
  assert.equal(tentativasSemRespostaDoCorretor(rajada, 'Sanchai', { clientName: 'Ana Paula Milani Renaissance' }).tentativas, 1,
    'contato quebrado em vários balões no mesmo dia é uma tentativa só');

  // Conversa vazia ou sem o lado do corretor não pode quebrar nem inventar tentativa.
  assert.equal(tentativasSemRespostaDoCorretor([], 'Sanchai', {}).tentativas, 0, 'conversa vazia = nenhuma tentativa');
  assert.equal(tentativasSemRespostaDoCorretor(null, '', {}).tentativas, 0, 'timeline inválida não pode quebrar a análise');
}

// ── 2. O fato chega à IA dentro do pedido, com o texto do que já falhou ──────────────────────
{
  const timeline = [
    { date: '18/06/2026', time: '12:28', author: 'Ana Paula Milani Renaissance', text: 'Olá! Preenchi seu formulário e gostaria de saber mais sobre sua empresa.' },
    { date: '18/06/2026', time: '12:38', author: 'Construtora Senger', text: 'Olá Ana Paula! Você tem alguma dúvida principal ou posso seguir com a apresentação?' },
    { date: '16/07/2026', time: '11:59', author: 'Construtora Senger', text: 'Olá, Ana Paula! Passando para saber se posso ajudar com mais informações sobre o Renaissance e enviar apresentação?' }
  ];
  let pedidoEnviado = '';
  const openaiMock = {
    chat: { completions: { create: async (args) => {
      pedidoEnviado = args.messages.map(m => m.content).join('\n\n');
      return {
        model: 'mock-gpt',
        choices: [{ message: { content: JSON.stringify({
          summary: 'Resumo',
          diagnostico: { produtoPrincipal: 'Renaissance', etapaFunil: 'Atendimento' },
          mensagens: {
            recomendada: 'Boa tarde Ana Paula, tudo bem? Já estou te enviando a apresentação completa do Renaissance por aqui.',
            maisSuave: 'Boa tarde Ana Paula, tudo bem? Mando a apresentação e te explico o conceito Wellness.',
            maisDireta: 'Boa tarde Ana Paula, tudo bem? Consigo te receber no decorado: quinta às 18h ou sábado de manhã?'
          },
          quemEhOCliente: 'Ana Paula Milani Renaissance',
          produtoInteresse: 'Renaissance',
          etapaSugerida: 'Atendimento',
          clientProfile: 'Perfil',
          nextAction: 'Ação'
        }) } }]
      };
    } } }
  };
  await analyzeWithBrain({
    lead: { clientName: 'Ana Paula Milani Renaissance', corretorNome: 'Sanchai' },
    timeline,
    openai: openaiMock,
    cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Método do corretor.', tom: 'Tom do corretor.', regras: [{ texto: 'Regra de teste.' }] }
  });

  assert.ok(pedidoEnviado.includes('TENTATIVAS DO CORRETOR AINDA SEM RESPOSTA: 2'),
    'o pedido precisa dizer quantas tentativas do corretor ficaram sem resposta');
  assert.ok(pedidoEnviado.includes('posso seguir com a apresentação'),
    'o texto da tentativa que já falhou tem que ir junto, senão a IA repete ela');
  // v1291 — o dono reescreveu essa linha: o pedido continua entregando o texto do que já falhou,
  // mas em vez de proibir a repetição na marra, manda o Cérebro decidir o que muda (pergunta,
  // abordagem, canal ou próximo passo) e proíbe presumir o motivo do silêncio.
  assert.ok(pedidoEnviado.includes('não presuma o motivo do silêncio'),
    'o pedido precisa dizer, ali mesmo, que aquilo não pode voltar');
  assert.ok(pedidoEnviado.includes('Use o Cérebro para decidir se deve mudar pergunta, abordagem, canal ou próximo passo'),
    'e precisa mandar o Cérebro decidir o que muda na próxima tentativa');
}

// ── 3. Conversa em que o cliente respondeu por último: o pedido diz isso ─────────────────────
{
  const timeline = [
    { date: '10/08/2026', time: '09:00', author: 'Construtora Senger', text: 'Bom dia Ana Paula! Te mandei as plantas.' },
    { date: '10/08/2026', time: '09:20', author: 'Ana Paula Milani Renaissance', text: 'Recebi, vou olhar com calma.' }
  ];
  let pedidoEnviado = '';
  const openaiMock = {
    chat: { completions: { create: async (args) => {
      pedidoEnviado = args.messages.map(m => m.content).join('\n\n');
      return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
        summary: 'Resumo',
        diagnostico: {},
        mensagens: { recomendada: 'Boa tarde Ana Paula, tudo bem? Separei a planta do andar alto.', maisSuave: 'Boa tarde Ana Paula, tudo bem? Qual planta chegou mais perto?', maisDireta: 'Boa tarde Ana Paula, tudo bem? Quinta às 18h ou sábado de manhã no decorado?' },
        quemEhOCliente: 'Ana Paula Milani Renaissance',
        produtoInteresse: 'Renaissance',
        etapaSugerida: 'Atendimento',
        clientProfile: 'Perfil',
        nextAction: 'Ação'
      }) } }] };
    } } }
  };
  await analyzeWithBrain({
    lead: { clientName: 'Ana Paula Milani Renaissance', corretorNome: 'Sanchai' },
    timeline,
    openai: openaiMock,
    cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Método do corretor.', tom: 'Tom do corretor.', regras: [{ texto: 'Regra de teste.' }] }
  });
  assert.ok(pedidoEnviado.includes('TENTATIVAS DO CORRETOR AINDA SEM RESPOSTA: nenhuma'),
    'quando o cliente falou por último, o pedido precisa dizer que não há tentativa pendente');
}

// ── 4. ATENÇÃO, ISTO MUDOU DE FORMA NA v1291 ────────────────────────────────────────────────
// O bloco "A MENSAGEM QUE JÁ FOI IGNORADA NÃO VOLTA COM OUTRAS PALAVRAS" (com "PEDIR LICENÇA JÁ
// FOI TENTADO E NÃO COLOU", "DUAS OU MAIS TENTATIVAS = MUDAR DE CAMINHO" e a proibição de cobrar
// o cliente) saiu na reescrita das instruções entregue pelo dono, junto com a conferência final de
// 12 itens. O que sobrou escrito no pedido é uma linha só — e é ela que este teste guarda agora.
{
  assert.ok(/Não repita automaticamente uma tentativa ignorada; use o Cérebro e o contexto para decidir outro caminho quando isso for útil\./.test(src),
    'a regra da tentativa repetida precisa existir no pedido enviado à IA');
  // A revisão final continua existindo (10 itens) e continua sendo a última coisa lida.
  assert.ok(src.indexOf('REVISÃO FINAL SILENCIOSA') > src.indexOf('${timelineText}'),
    'a revisão final precisa vir depois da conversa');
}

// ── 5. O código continua sem reescrever mensagem nenhuma ────────────────────────────────────
{
  // A v1247 tirou de vez o corte determinístico de frase (limparFrasesProibidas/melhorLimpa) por
  // ordem do dono: quem cuida do texto é o prompt. A v1277 só ACRESCENTA um fato ao pedido.
  assert.ok(!/limparFrasesProibidas|melhorLimpa/.test(src),
    'o corte determinístico de frase não pode voltar — quem cuida do texto é o prompt');
  const fn = src.slice(src.indexOf('export function tentativasSemRespostaDoCorretor'));
  const corpo = fn.slice(0, fn.indexOf('\n}\n'));
  assert.ok(!/replace\(\s*\/(?!\\s\+)/.test(corpo.replace(/\.replace\(\/\\s\+\/g, " "\)/g, '')),
    'a contagem de tentativas não pode reescrever o texto de ninguém — ela só lê e conta');
}

console.log('v1277-tentativa-repetida-nao-volta: ok');
