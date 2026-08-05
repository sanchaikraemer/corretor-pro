import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeWithBrain } from '../api/_pipeline.js';

// v1137 — item 2 do plano do dono: tirar a "segunda parede" do cliente novo. A primeira parede
// (análise recusada sem Cérebro) caiu na v1132; esta é a que vinha logo depois: o convite
// "Ensinar a IA a falar como eu" levava pra uma tela que dizia "estas instruções entram no prompt
// da OpenAI" (jargão) e mostrava 15 campos vazios sem nenhuma ordem de importância. E, pior, a
// auditoria achou duas incoerências reais:
//
//   1. A tela do Aprendizado mandava tocar num botão ("Aprender de toda a carteira agora") que
//      NÃO EXISTE MAIS — o aprendizado virou automático (contínuo, em segundo plano).
//   2. loadCerebroConfig devolvia null quando não havia instruções manuais — jogando fora o que o
//      aprendizado automático já tinha guardado (inteligenciaAprendida) exatamente pra conta que
//      mais precisa dele: a nova, em modo prévia. E o convite da prévia dizia "a IA não conhece o
//      seu jeito" mesmo depois de ela ter aprendido sozinha.

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// 1) A tela: sem jargão, com guia de primeiro uso, sem instrução de botão morto.
// ---------------------------------------------------------------------------
assert.ok(!html.includes('prompt da OpenAI'),
  'a tela do Cérebro não pode falar em "prompt da OpenAI" — quem lê é corretor, não programador');
assert.ok(!html.includes('Aprender de toda a carteira agora'),
  'a tela não pode mandar tocar num botão que não existe mais (o aprendizado é automático)');
assert.match(html, /id="cerebroGuiaInicio"/, 'o guia de primeiro uso precisa existir');
const guia = html.slice(html.indexOf('id="cerebroGuiaInicio"'), html.indexOf('Começar pelo meu nome') + 40);
assert.match(guia, /já aprende sozinha/i, 'o guia precisa dizer que a IA aprende sozinha das conversas');
assert.match(guia, /Regras comerciais/, 'o guia aponta o que só o corretor pode ensinar (condições)');
assert.match(guia, /evitar/i, 'e o que a IA nunca deve dizer por ele');
assert.match(html, /id="cerebroGuiaInicio" style="display:none/, 'o guia nasce escondido — quem decide é carregarCerebro');

// 2) O guia aparece com o Cérebro vazio e some quando há conteúdo — mesma régua do servidor.
assert.match(app, /const cerebroTemConteudo = \[config\.metodo, config\.tom, config\.diferenciais, config\.evitar, config\.regrasTexto, config\.objecoesTexto\]/,
  'a régua do guia precisa ser a MESMA de hasCerebroInstructions (campos de instrução; nome sozinho não conta)');
assert.match(app, /guiaInicio\.style\.display = cerebroTemConteudo \? "none" : "block"/,
  'carregarCerebro liga/desliga o guia conforme o conteúdo');

// ---------------------------------------------------------------------------
// 3) O aprendizado automático chega na prévia (era jogado fora).
// ---------------------------------------------------------------------------
assert.match(pipeline, /banco-sem-instrucoes/,
  'loadCerebroConfig precisa devolver o Cérebro salvo mesmo sem instruções manuais — é onde mora o aprendizado automático');

let systemPrompt = '';
const openaiFake = { chat: { completions: { create: async (args) => {
  systemPrompt = String(args?.messages?.find(m => m.role === 'system')?.content || '');
  return { model: 'gpt-teste', choices: [{ message: { content: JSON.stringify({
    summary: 'ok',
    mensagens: { recomendada: 'Oi! Me conta o que você procura que eu te ajudo.', maisSuave: 'Olá! Posso te ajudar com as opções.', maisDireta: 'Consigo te mandar as opções hoje — quantos dormitórios?' }
  }) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
} } } };
const timeline = [{ date: '02/08/2026', time: '09:00', author: 'Ana', text: 'Oi, qual o valor?', iso: new Date().toISOString() }];

// Sem instruções e SEM aprendizado → prévia "pura".
const semNada = await analyzeWithBrain({
  lead: { clientName: 'Ana' }, timeline, openai: openaiFake,
  cerebroConfig: { corretorNome: 'Sanchai', metodo: '', tom: '', diferenciais: '', evitar: '', regras: [], objecoes: [] }
});
assert.equal(semNada.modoPrevia, true);
assert.equal(semNada.previaComAprendizado, false, 'sem aprendizado, a marca não pode vir ligada');

// Sem instruções mas COM aprendizado automático → continua prévia, mas a voz aprendida entra no
// prompt e a marca avisa a tela.
const comAprendizado = await analyzeWithBrain({
  lead: { clientName: 'Ana' }, timeline, openai: openaiFake,
  cerebroConfig: {
    corretorNome: 'Sanchai', metodo: '', tom: '', diferenciais: '', evitar: '', regras: [], objecoes: [],
    inteligenciaAprendida: { tons: [{ texto: 'fala direta e calorosa, responde por áudio e chama pelo nome' }] }
  }
});
assert.equal(comAprendizado.modoPrevia, true, 'aprendizado sozinho não vira instrução — continua prévia');
assert.equal(comAprendizado.previaComAprendizado, true, 'a marca precisa avisar a tela de que a IA já aprendeu');
assert.match(systemPrompt, /fala direta e calorosa/,
  'a voz aprendida das conversas dele precisa CHEGAR no prompt da prévia — era exatamente o que se perdia');
assert.match(systemPrompt, /MODO PRÉVIA/, 'as amarras da prévia continuam (sem condições comerciais, não afirmar)');

// ---------------------------------------------------------------------------
// 4) O convite na tela fala a verdade em cada caso.
// ---------------------------------------------------------------------------
const fnSrc = app.match(/function cpPreviaCerebroHTML\(a\)\{[\s\S]*?\n\}/)[0];
const render = new Function(`${fnSrc}; return cpPreviaCerebroHTML;`)();
const htmlSem = render({ modoPrevia: true, previaComAprendizado: false });
assert.match(htmlSem, /ainda não conhece o seu jeito/, 'sem aprendizado, o texto de sempre');
assert.match(htmlSem, /Ensinar a IA a falar como eu/);
const htmlCom = render({ modoPrevia: true, previaComAprendizado: true });
assert.match(htmlCom, /já aprendeu seu jeito/, 'com aprendizado, não pode dizer que a IA não conhece o jeito dele');
assert.match(htmlCom, /condições comerciais/, 'o que falta são as condições — é isso que o convite pede');
assert.match(htmlCom, /Confirmar minhas condições/, 'o botão muda junto com o texto');
assert.match(htmlCom, /btnPreviaConfigurarCerebro/, 'o botão continua levando pra mesma tela');
assert.equal(render({ modoPrevia: false }), '', 'fora da prévia, nada aparece');

console.log('v1137-cerebro-sem-parede: ok');
