import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain } from '../api/_pipeline.js';

// v1132 — a decisão de produto mais importante registrada até aqui. O dono, depois de testar como
// cliente:
//
//   "Se é pra nós vender esse sistema, o corretor tem que entrar, exportar uma conversa dele no
//    WhatsApp e já ter uma prévia do que está acontecendo. Não tem que estar fazendo mil e uma
//    configuração."
//
// Até a v1131, uma conta sem Cérebro configurado tinha a análise RECUSADA. Quem acabou de se
// cadastrar não sabe o que é o Cérebro nem pra que serve — e era obrigado a configurá-lo ANTES de
// ver o sistema funcionar uma vez. Ninguém preenche formulário pra um produto que ainda não provou
// nada: o primeiro passo de todo cliente novo terminava num beco, e um produto assim não se vende.
//
// A v1131 tinha "corrigido" isso explicando melhor o erro. Explicar melhor um beco continua sendo
// um beco — a correção de verdade é não ter beco: analisar de primeira, com base na conversa que
// ele acabou de exportar, e convidar a configurar DEPOIS, mostrando o que ele ganha.
//
// ESTE TESTE EXISTE PRA ESSA DECISÃO NÃO SER DESFEITA por engano numa faxina futura.

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// 1) O caminho do cliente novo: exportou a conversa → recebe análise de verdade.
// ---------------------------------------------------------------------------
let systemPrompt = '';
const openaiFake = {
  chat: { completions: { create: async (args) => {
    systemPrompt = String(args?.messages?.find(m => m.role === 'system')?.content || '');
    return {
      model: 'gpt-teste',
      choices: [{ message: { content: JSON.stringify({
        summary: 'Cliente perguntou o valor e ninguém respondeu.',
        diagnostico: { produtoPrincipal: 'Não identificado' },
        mensagens: {
          recomendada: 'Oi Ana! Vi que você perguntou sobre valores — me confirma o que procura que eu te mando certinho.',
          maisSuave: 'Olá Ana! Passando pra saber se ainda posso te ajudar com as informações.',
          maisDireta: 'Ana, consigo te mandar as opções hoje. Me diz quantos dormitórios você precisa?'
        }
      }) } }],
      usage: { prompt_tokens: 5, completion_tokens: 5 }
    };
  } } }
};

const timeline = [
  { date: '02/08/2026', time: '09:12', author: 'Ana', text: 'Oi, vi o anúncio. Qual o valor?' },
  { date: '02/08/2026', time: '09:13', author: 'Ana', text: 'Tem de 2 dormitórios?' }
];

const previa = await analyzeWithBrain({
  lead: { clientName: 'Ana' },
  timeline,
  openai: openaiFake,
  cerebroConfig: { corretorNome: '', metodo: '', tom: '', diferenciais: '', evitar: '', regras: [], objecoes: [] }
});

assert.equal(previa.mode, 'openai', 'conta sem Cérebro precisa receber uma análise de verdade, não uma recusa');
assert.equal(previa.modoPrevia, true, 'a análise precisa se identificar como prévia');
assert.equal(previa.sugestoesPendentes, false, 'a prévia é utilizável — não pode voltar marcada como pendente');
assert.notEqual(previa.mode, 'cerebro_ausente', 'o modo de recusa por falta de Cérebro não pode voltar a existir');
for (const [nome, m] of [['A', previa.messages.a], ['B', previa.messages.b], ['C', previa.messages.c]]) {
  assert.ok(String(m || '').trim().length >= 10, `a prévia precisa entregar a mensagem ${nome} preenchida`);
}
assert.ok(String(previa.summary || '').trim().length > 0, 'a prévia precisa trazer o resumo da conversa');

// ---------------------------------------------------------------------------
// 2) A prévia vai amarrada: sem Cérebro, a ÚNICA fonte de fato é a conversa.
//    É isto que garante que "analisar sem configuração" não vire invenção comercial —
//    a regra do projeto (nada comercial cravado no código) continua intacta.
// ---------------------------------------------------------------------------
// v1291 — o dono reescreveu o texto da prévia. A lista item a item ("NUNCA afirme preço,
// condição de pagamento, desconto...") virou uma proibição curta na prévia, apoiada nas
// proteções de integridade que valem para todas as contas. O que este teste guarda é o mesmo:
// conta sem Cérebro não pode inventar condição comercial.
assert.match(systemPrompt, /MODO PRÉVIA/, 'a IA precisa ser avisada de que está sem Cérebro');
assert.match(systemPrompt, /sem inventar fatos nem\s*\n?condições/, 'a prévia precisa proibir afirmar preço que não esteja na conversa');
for (const proibido of ['preço', 'desconto', 'condições', 'disponibilidade', 'prazo']) {
  assert.ok(systemPrompt.includes(proibido), `a proibição da prévia precisa cobrir "${proibido}"`);
}
assert.match(systemPrompt, /mantenha a incerteza em vez de completar a lacuna/i,
  'quando o dado não está na conversa, a mensagem precisa oferecer confirmar — nunca chutar');
// "Não identificado" continua sendo o valor de campo sem base, só que agora ele mora na descrição
// do formato JSON (que vai no pedido, não nas instruções) — quem guarda isso é o teste v1145.
assert.match(systemPrompt, /INTELIGÊNCIA COMERCIAL BASE/,
  'o piso comercial (que já proíbe inventar) precisa continuar entrando no prompt');

// ---------------------------------------------------------------------------
// 3) Quem JÁ configurou não vê nada disso — a prévia é só pra quem ainda não ensinou nada.
// ---------------------------------------------------------------------------
const comCerebro = await analyzeWithBrain({
  lead: { clientName: 'Ana' },
  timeline,
  openai: openaiFake,
  cerebroConfig: { corretorNome: 'Sanchai', metodo: 'Atendo primeiro por áudio, depois mando o material.', tom: '', diferenciais: '', evitar: '', regras: [], objecoes: [] }
});
assert.equal(comCerebro.modoPrevia, false, 'quem configurou o Cérebro não está em prévia');
assert.doesNotMatch(systemPrompt, /MODO PRÉVIA/, 'com Cérebro, as instruções de prévia não podem sobrar no prompt');
assert.match(systemPrompt, /Atendo primeiro por áudio/, 'com Cérebro, o que ele ensinou precisa chegar na IA');

// ---------------------------------------------------------------------------
// 4) O convite aparece na tela — e é convite, não erro nem bloqueio.
// ---------------------------------------------------------------------------
assert.match(app, /function cpPreviaCerebroHTML\(a\)\{/, 'o convite da prévia precisa existir no app');
const convite = app.match(/function cpPreviaCerebroHTML\(a\)\{[\s\S]*?\n\}/)[0];
assert.match(convite, /if\(!a\?\.modoPrevia\) return "";/, 'o convite só pode aparecer em análise de prévia');
assert.doesNotMatch(convite, /notice error|erro|falhou|não foi possível/i,
  'o convite NÃO é mensagem de erro — a análise acima dele funcionou');
assert.match(convite, /btnPreviaConfigurarCerebro/, 'precisa ter o botão que leva pra configuração');
assert.match(app, /qs\("#btnPreviaConfigurarCerebro"\)\?\.addEventListener\("click", \(\) => \{ try\{ show\("cerebro"\); \}/,
  'o botão precisa realmente abrir a Inteligência Comercial');
assert.match(app, /cpPreviaCerebroHTML\(analysis\) \+/,
  'o convite precisa ser montado junto do resultado da importação');

console.log('v1132-conta-nova-ve-o-produto-funcionando: ok');
