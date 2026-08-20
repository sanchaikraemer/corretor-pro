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

const fonte = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. Primeira análise deste cliente: vai a conversa inteira (não há resumo pra substituir) ────
const promptCompleto = await analisar(timelineComNova, null);
assert.match(promptCompleto, /CONVERSA COMPLETA:/, 'sem análise anterior, a conversa vai inteira');
assert.match(promptCompleto, /mensagem antiga número 3\b/, 'e as mensagens antigas estão lá');

// ── 2. v1247 — HISTÓRICO INTEGRAL: reimportação relê a CONVERSA INTEIRA ─────────────────────
//
// "de ontem pra hoje está cada vez pior" (dono, 13/08/2026). Mandar RESUMO no lugar das mensagens
// antigas foi uma das causas: a IA ficava com pouco material real na mão e devolvia mensagem
// genérica. O modo incremental ficou DESLIGADO por padrão (limiar Infinity) — não foi apagado,
// volta por variável de ambiente se o custo um dia apertar.
const promptIncremental = await analisar(timelineComNova, {
  analiseAnterior: ANALISE_ANTERIOR,
  assinaturasNovas: [assinatura(NOVA)]
});

assert.doesNotMatch(promptIncremental, /RESUMO DO QUE JÁ FOI ANALISADO \+ O QUE É NOVO/,
  'nada de resumo no lugar da conversa: a IA lê tudo');
assert.match(promptIncremental, /consegue me mandar o valor final atualizado\?/, 'a mensagem NOVA vai inteira');
assert.ok(promptIncremental.includes('mensagem antiga número 3'),
  'mensagem antiga TAMBÉM vai — esconder parte da conversa é o que deixava a sugestão genérica');
assert.ok(promptIncremental.includes('mensagem antiga número 249'),
  'inclusive as do meio e do fim: nenhuma mensagem fica de fora');

// O que se mede agora é o contrário da economia: a reimportação NÃO encolhe a conversa.
const soAConversa = (prompt) => prompt.slice(prompt.search(/CONVERSA (COMPLETA|—)/));
console.log(`   conversa enviada à IA: ${soAConversa(promptCompleto).length} → ${soAConversa(promptIncremental).length} caracteres (sem esconder nada)`);
assert.ok(soAConversa(promptIncremental).length >= soAConversa(promptCompleto).length,
  'a reimportação não pode mandar MENOS conversa que a primeira análise');

// O limiar desligado é o que garante isso, e o mecanismo continua no código pra poder voltar.
assert.match(fonte, /DIRECIONA_INCREMENTAL_MIN_CHARS \|\| Infinity/,
  'o limiar desligado é o que garante a conversa inteira');
assert.match(fonte, /function montarEntradaIncremental/,
  'o mecanismo não foi apagado — só desligado, pra voltar por variável de ambiente se precisar');

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
  // v1247 — sem resumo, não há o que avisar: a IA recebe a conversa inteira e relê com as regras
  // de hoje. O texto dos avisos continua no código, pronto pra voltar junto com o modo incremental.
  assert.match(fonte, /NENHUMA MENSAGEM NOVA DESDE A ÚLTIMA ANÁLISE/, 'o aviso continua existindo no código');
  assert.ok(prompt.includes('mensagem antiga número 3'),
    'reimportação sem novidade relê a conversa INTEIRA — nada de esconder mensagem já analisada');
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

// ── 6. O único teto que existe é o técnico, e ele cobre conversa de anos ────────────────────────
{
  const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
  assert.match(src, /DIRECIONA_INCREMENTAL_CAUDA_CHARS \|\| 9000/, 'tamanho da cauda de contexto configurável');
  // v1247 — o teto técnico que cortava conversa longa em silêncio subiu: 30 mil cortava carteira
  // real (300 mensagens perdiam mais de cem, sem avisar ninguém).
  assert.match(src, /DIRECIONA_MAX_CONTEXT_CHARS \|\| 120000/, 'o teto técnico cobre conversa de anos');
}

console.log('v1222-analisa-so-o-que-nao-esta-no-historico: ok');
