import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain, respostaCurtaDoCliente } from '../api/_pipeline.js';

// v1300 — conversa real do dono, 18/08/2026:
//   16h06 — corretor manda as condições de pagamento inteiras e pergunta "Você já tem algo em mente?"
//   16h08 — cliente: "Joia."
//
// As três sugestões seguintes (print das 17h56) voltaram a oferecer informação e a fazer pergunta
// aberta: "Te detalho agora as opções de salas...", "Te mando agora mais informações sobre estrutura,
// localização ou outras opções", "preciso saber se algum detalhe chamou mais atenção".
//
// Um "joia" solto não responde, não aceita e não supera nada. O sistema tratava como "o cliente
// falou" e a conversa parecia ter andado. Agora esse fato vai no pedido, do mesmo jeito que as
// tentativas sem resposta (v1277) e as perguntas já feitas (v1297).
//
// A v1300 traz também a reescrita no modelo principal: a sugestão 2 daquele print chegou emendada
// ("Posso conversar sobre algum detalhe do empreendimento ou se surgir alguma dúvida durante sua
// análise."), escrita pelo modelo rápido.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

const CONVERSA_DO_DONO = [
  { date: '18/08/2026', time: '15:47', author: 'Construtora Senger', text: 'Que bom que conseguiu analisar o material. Ficou alguma dúvida?' },
  { date: '18/08/2026', time: '15:48', author: 'Julsimar Chapada', text: 'Estamos analisando ainda, mas gostei da ideia' },
  { date: '18/08/2026', time: '16:06', author: 'Construtora Senger', text: 'Perfeito. Hoje estamos trabalhando com 20% de entrada e o saldo em até 30x direto com a construtora. Você já tem algo em mente?' },
  { date: '18/08/2026', time: '16:08', author: 'Julsimar Chapada', text: 'Joia.' }
];

// ── 1. O reconhecimento curto é identificado, com a pergunta que ficou sem resposta ─────────
{
  const r = respostaCurtaDoCliente(CONVERSA_DO_DONO, 'Sanchai', { clientName: 'Julsimar Chapada' });
  assert.ok(r, 'o "Joia." precisa ser identificado como reconhecimento curto');
  assert.equal(r.texto, 'Joia.');
  assert.ok(r.perguntaAberta.includes('Você já tem algo em mente'),
    'a pergunta do corretor que ficou de fato sem resposta precisa vir junto');

  for (const curto of ['ok', 'Blz', 'certo', 'show', 'valeu', 'perfeito', 'Entendi', 'ta bom', '👍']) {
    const t = [...CONVERSA_DO_DONO.slice(0, 3), { date: '18/08/2026', time: '16:08', author: 'Julsimar Chapada', text: curto }];
    assert.ok(respostaCurtaDoCliente(t, 'Sanchai', { clientName: 'Julsimar Chapada' }), `"${curto}" também é reconhecimento curto`);
  }
}

// ── 2. O que NÃO pode ser confundido com "joia" ─────────────────────────────────────────────
{
  const comResposta = [...CONVERSA_DO_DONO.slice(0, 3),
    { date: '18/08/2026', time: '16:08', author: 'Julsimar Chapada', text: 'Joia, me manda a simulação da sala 302 com essa entrada' }];
  assert.equal(respostaCurtaDoCliente(comResposta, 'Sanchai', { clientName: 'Julsimar Chapada' }), null,
    'resposta que diz alguma coisa não é reconhecimento curto, mesmo começando com "joia"');

  const corretorPorUltimo = [...CONVERSA_DO_DONO,
    { date: '18/08/2026', time: '16:20', author: 'Construtora Senger', text: 'Te mando a simulação hoje.' }];
  assert.equal(respostaCurtaDoCliente(corretorPorUltimo, 'Sanchai', { clientName: 'Julsimar Chapada' }), null,
    'se o corretor falou por último, este fato não existe');

  assert.equal(respostaCurtaDoCliente([], 'Sanchai', {}), null, 'conversa vazia não inventa fato');
  assert.equal(respostaCurtaDoCliente(null, '', {}), null, 'timeline inválida não pode quebrar a análise');
}

// ── 3. O fato chega no pedido, com a regra colada ───────────────────────────────────────────
{
  let pedido = '';
  const openaiMock = { chat: { completions: { create: async (args) => {
    pedido = args.messages.map(m => m.content).join('\n\n');
    return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
      summary: 'Resumo', diagnostico: {},
      mensagens: {
        recomendada: 'Julsimar, preparei a simulação da sala com 20% de entrada. Te mando agora?',
        maisSuave: 'Julsimar, montei a simulação com os reforços anuais. Te envio hoje.',
        maisDireta: 'Julsimar, separei a sala do andar alto. Consigo segurar até sexta.'
      },
      quemEhOCliente: 'Julsimar Chapada', produtoInteresse: 'Não identificado',
      etapaSugerida: 'Atendimento', clientProfile: 'Perfil', nextAction: 'Enviar simulação'
    }) } }] };
  } } } };

  await analyzeWithBrain({
    lead: { clientName: 'Julsimar Chapada', corretorNome: 'Sanchai' },
    timeline: CONVERSA_DO_DONO,
    openai: openaiMock,
    cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Método.', tom: 'Tom.', regras: [{ texto: 'Regra.' }] }
  });

  assert.ok(pedido.includes('ÚLTIMA FALA DO CLIENTE: "Joia." — reconhecimento curto, não é resposta'),
    'o pedido precisa dizer que a última fala não responde nada');
  assert.ok(pedido.includes('Você já tem algo em mente'),
    'com a pergunta do corretor que continua sem resposta');
  assert.ok(pedido.includes('Não trate isso como aceite, concordância, interesse confirmado, objeção superada nem resposta'),
    'e precisa proibir ler "joia" como avanço da conversa');
  assert.ok(pedido.includes('o corretor propor algo concreto'),
    'depois de um "joia", o caminho é proposta concreta, não outra pergunta aberta');
}

// ── 4. Conversa normal não ganha o bloco ────────────────────────────────────────────────────
{
  let pedido = '';
  const openaiMock = { chat: { completions: { create: async (args) => {
    pedido = args.messages.map(m => m.content).join('\n\n');
    return { model: 'mock-gpt', choices: [{ message: { content: JSON.stringify({
      summary: 'Resumo', diagnostico: {},
      mensagens: { recomendada: 'Te mando a simulação hoje.', maisSuave: 'Preparei a simulação, te envio.', maisDireta: 'Mando a simulação agora.' },
      quemEhOCliente: 'Julsimar Chapada', produtoInteresse: 'Não identificado', etapaSugerida: 'Atendimento', clientProfile: 'Perfil', nextAction: 'Enviar'
    }) } }] };
  } } } };
  await analyzeWithBrain({
    lead: { clientName: 'Julsimar Chapada', corretorNome: 'Sanchai' },
    timeline: [
      { date: '18/08/2026', time: '16:06', author: 'Construtora Senger', text: 'Você já tem algo em mente?' },
      { date: '18/08/2026', time: '16:08', author: 'Julsimar Chapada', text: 'Estou pensando em duas salas juntas, para alugar depois' }
    ],
    openai: openaiMock,
    cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Método.', tom: 'Tom.', regras: [{ texto: 'Regra.' }] }
  });
  assert.ok(!pedido.includes('reconhecimento curto'),
    'quando o cliente respondeu de verdade, o bloco não pode aparecer e sugerir que ele não disse nada');
}

// ── 5. A reescrita usa o modelo principal — e agora SÓ ele ──────────────────────────────────
// v1308 — a v1300 ainda deixava a reescrita cair no modelo rápido quando sobrava pouco tempo. O
// dono mandou tirar toda queda pra modelo mais fraco: agora, sem tempo pro modelo bom, a reescrita
// simplesmente não acontece e a sugestão vai pra tela com a marca de problema.
{
  assert.ok(src.includes('const modeloReescrita = modeloAnalise();'),
    'quem reescreve é o modelo principal, sempre');
  assert.ok(!src.includes('sobraReescritaMs >= 12000 ? modeloAnalise() : modeloTarefasSimples()'),
    'a queda da reescrita pro modelo rápido não pode voltar');
  assert.ok(src.includes('Devolva UMA MENSAGEM INTEIRA'),
    'a instrução precisa exigir mensagem inteira, pra reescrita não voltar emendada');
}

console.log('v1300-joia-nao-e-resposta: ok');
