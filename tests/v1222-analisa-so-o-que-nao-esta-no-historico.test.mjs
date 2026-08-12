import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain } from '../api/_pipeline.js';

// v1222 — "Tem que fazer análise somente do que já não está no histórico, preste bem atenção, são
// duas coisas distintas. Não quero que faça análise inteira, senão vou perder dinheiro com
// retrabalho e reanálise. Agora, se eu fizer uma importação, que as conversas forem diferentes,
// você tem que sim fazer a reanálise. Agora, se as conversas forem a mesma, eu também quero que
// você faça uma reanálise porque o prompt pode ter mudado." (dono, 11/08/2026)
//
// As duas coisas, separadas:
//   QUANDO analisar  → sempre que importar (v1221), inclusive sem mensagem nova.
//   O QUE reler      → só o que ainda não foi analisado. O que já foi vira RESUMO CONSOLIDADO.
//
// Este teste não confere o código por leitura: ele CHAMA a análise com um cliente falso da OpenAI
// e mede o prompt que saiu — quantos caracteres, quais mensagens foram e quais não foram.

// v1225 — o limiar subiu pra 15.000 caracteres (conversa média voltou a ir inteira, porque
// resumo demais estava produzindo mensagem genérica). A conversa deste teste cresceu junto: ela
// precisa ser LONGA DE VERDADE pra exercitar o caminho do resumo.
const CONVERSA_LONGA = Array.from({ length: 250 }, (_, i) => ({
  date: '2026-06-01', time: String(8 + (i % 12)).padStart(2, '0') + ':00',
  author: i % 2 ? 'Corretor' : 'Cliente',
  text: `mensagem antiga número ${i} sobre condições, valores e visita ao empreendimento`,
  iso: `2026-06-01T${String(8 + (i % 12)).padStart(2, '0')}:00:00.000Z`, order: i + 1
}));
const NOVA = {
  date: '2026-08-11', time: '18:00', author: 'Cliente',
  text: 'consegue me mandar o valor final atualizado?', iso: '2026-08-11T18:00:00.000Z', order: 999
};
const ANALISE_ANTERIOR = {
  arquiteturaMensagens: 'v852-cerebro-unico-obrigatorio',
  summary: 'Cliente avaliou o Nova Vila Rica III e pediu simulação; parou de responder depois do material.',
  clientProfile: 'Interessado em terreno, já visitou o empreendimento.',
  nextAction: 'Retomar com a simulação combinada.',
  diagnostico: { etapaFunil: 'Negociação', produtoAtual: 'Nova Vila Rica III', objecaoPrincipal: 'Achou o valor alto' },
  messages: { a: 'mensagem salva a com tamanho suficiente', b: 'mensagem salva b com tamanho suficiente', c: 'mensagem salva c com tamanho suficiente' }
};

const assinatura = (m) => [m.date, m.time, String(m.author).toLowerCase(), String(m.text).toLowerCase()].join('|');

// Cliente falso da OpenAI: guarda o prompt e devolve uma análise mínima válida.
function openaiFalso(guardar){
  return {
    chat: { completions: { create: async (req) => {
      guardar(req.messages.map(m => m.content).join('\n---\n'));
      return {
        model: 'falso',
        usage: { prompt_tokens: 10, completion_tokens: 10 },
        choices: [{ message: { content: JSON.stringify({
          summary: 'ok', diagnostico: {},
          mensagens: { recomendada: 'mensagem recomendada de teste', maisSuave: 'mensagem suave de teste', maisDireta: 'mensagem direta de teste' }
        }) } }]
      };
    } } }
  };
}

const analisar = async (timeline, contextoIncremental) => {
  let prompt = '';
  await analyzeWithBrain({
    lead: { clientName: 'Cliente', fileName: 'conversa.txt' },
    timeline,
    openai: openaiFalso((p) => { prompt = p; }),
    leadId: 'lead-1',
    contextoIncremental,
    cerebroConfig: { corretorNome: 'Corretor', instrucoes: 'Fale de forma direta.' },
    organizationId: 'org-teste'
  });
  return prompt;
};

const timelineComNova = [...CONVERSA_LONGA, NOVA];

// ── 1. Primeira análise deste cliente: vai a conversa inteira (não há resumo pra substituir) ────
const promptCompleto = await analisar(timelineComNova, null);
assert.match(promptCompleto, /CONVERSA COMPLETA:/, 'sem análise anterior, a conversa vai inteira');
assert.match(promptCompleto, /mensagem antiga número 3\b/, 'e as mensagens antigas estão lá');

// ── 2. Reimportação COM mensagem nova: relê só a novidade + resumo do que já foi analisado ──────
const promptIncremental = await analisar(timelineComNova, {
  analiseAnterior: ANALISE_ANTERIOR,
  assinaturasNovas: [assinatura(NOVA)]
});

assert.match(promptIncremental, /RESUMO DO QUE JÁ FOI ANALISADO \+ O QUE É NOVO/, 'o rótulo precisa dizer a verdade sobre o que está indo');
assert.match(promptIncremental, /consegue me mandar o valor final atualizado\?/, 'a mensagem NOVA vai inteira');
assert.match(promptIncremental, /MENSAGENS NOVAS DESDE A ÚLTIMA ANÁLISE \(1\)/, 'e é apontada como a novidade');
assert.ok(!promptIncremental.includes('mensagem antiga número 3'),
  'mensagem antiga que já foi analisada NÃO pode ser reenviada — é isso que o dono está pagando duas vezes');
// O que substitui as antigas é o que a análise anterior concluiu.
assert.match(promptIncremental, /Cliente avaliou o Nova Vila Rica III/, 'o resumo consolidado entra no lugar delas');
assert.match(promptIncremental, /Etapa em que a conversa parou: Negociação/, 'com a etapa');
assert.match(promptIncremental, /Objeção principal já identificada: Achou o valor alto/, 'e a objeção já identificada');
// A cauda de contexto continua indo (tom e fio da conversa), mas é só o fim.
assert.match(promptIncremental, /ÚLTIMAS MENSAGENS JÁ CONHECIDAS/, 'as últimas conhecidas vão, pra pegar o fio');
assert.match(promptIncremental, /mensagem antiga número 249/, 'e a cauda é o FIM da conversa');

// A economia é o ponto. Mede-se no PEDAÇO DA CONVERSA — o resto do pedido (as instruções, o
// Cérebro) tem tamanho fixo e não é o que estava sendo pago duas vezes.
const soAConversa = (prompt) => prompt.slice(prompt.search(/CONVERSA (COMPLETA|—)/));
const economia = 1 - (soAConversa(promptIncremental).length / soAConversa(promptCompleto).length);
console.log(`   conversa enviada à IA: ${soAConversa(promptCompleto).length} → ${soAConversa(promptIncremental).length} caracteres (-${Math.round(economia*100)}%)`);
// v1225 — a meta de encolhimento baixou junto com a decisão de dar MAIS conversa real pra IA:
// resumir demais estava produzindo mensagem genérica, que é um custo pior que o dos tokens.
assert.ok(economia > 0.3, `a conversa reenviada precisa encolher de verdade (encolheu ${Math.round(economia*100)}%)`);

// ── 3. Reimportação SEM mensagem nova: ANALISA IGUAL (o prompt pode ter mudado) — mas também
//      sem reler tudo. É a segunda metade do pedido, e a que mais confundiu até aqui.
{
  let chamou = false;
  const prompt = await (async () => {
    let p = '';
    await analyzeWithBrain({
      lead: { clientName: 'Cliente' }, timeline: CONVERSA_LONGA,
      openai: openaiFalso((x) => { chamou = true; p = x; }),
      leadId: 'lead-1',
      contextoIncremental: { analiseAnterior: ANALISE_ANTERIOR, assinaturasNovas: [] },
      cerebroConfig: { corretorNome: 'Corretor' }, organizationId: 'org-teste'
    });
    return p;
  })();
  assert.equal(chamou, true, 'conversa igual TAMBÉM é analisada de novo — as regras podem ter mudado');
  assert.match(prompt, /NENHUMA MENSAGEM NOVA DESDE A ÚLTIMA ANÁLISE/, 'e a IA é avisada de que nada mudou na conversa');
  assert.match(prompt, /Refaça a leitura mesmo assim, com as regras de hoje/, 'com a instrução de reler sob as regras atuais');
  assert.match(prompt, /Não invente movimento que não houve/, 'sem inventar movimento que não houve');
  assert.ok(!prompt.includes('mensagem antiga número 3'), 'e continua sem reenviar o que já foi analisado');
}

// ── 4. Conversa curta continua indo inteira: resumir não economizaria e a leitura completa é melhor
{
  const curta = CONVERSA_LONGA.slice(0, 3);
  const prompt = await analisar([...curta, NOVA], {
    analiseAnterior: ANALISE_ANTERIOR,
    assinaturasNovas: [assinatura(NOVA)]
  });
  assert.match(prompt, /CONVERSA COMPLETA:/, 'conversa curta vai inteira');
  assert.match(prompt, /mensagem antiga número 1\b/, 'sem cortar nada');
}

// ── 5. Sem análise anterior aproveitável não existe resumo pra pôr no lugar → conversa inteira ──
for(const anteriorRuim of [null, { messages: {} }, { arquiteturaMensagens: 'v700-antiga', summary: 'x' }]){
  const prompt = await analisar(timelineComNova, { analiseAnterior: anteriorRuim, assinaturasNovas: [assinatura(NOVA)] });
  assert.match(prompt, /CONVERSA COMPLETA:/, 'sem resumo confiável, a conversa vai inteira (nunca se analisa no escuro)');
}

// ── 6. O limiar é configurável e o padrão está documentado no código ────────────────────────────
{
  const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
  assert.match(src, /DIRECIONA_INCREMENTAL_MIN_CHARS \|\| 15000/, 'limiar de conversa curta configurável');
  assert.match(src, /DIRECIONA_INCREMENTAL_CAUDA_CHARS \|\| 9000/, 'tamanho da cauda de contexto configurável');
}

console.log('v1222-analisa-so-o-que-nao-esta-no-historico: ok');
