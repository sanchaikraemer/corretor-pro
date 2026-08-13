import fs from 'node:fs';
import assert from 'node:assert/strict';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1225 — "Olha que ridículas sugestões de retomada de mensagem. Não está fazendo a retomada após
// vários dias sem conversa. Falou não sei o que está na cabeça, o que é isso? [...] Olha uma das
// respostas: 'sei que a vida corre'. Cara, que imbecilidade é essa?" (dono, 11/08/2026, 21h31).
//
// As três sugestões daquele print: a mesma oferta ("quer que eu te mande as plantas e valores?")
// em três tons, nenhuma reconhecendo que a conversa estava parada havia dias, uma delas dando a
// desculpa pronta pro cliente e outra dizendo o que o cliente tinha "na cabeça".

// ── 1. Retomada depois de dias sem conversa vira regra dura, não sugestão ──────────────────────
const bloco = pipeline.slice(
  pipeline.indexOf('RETOMADA DEPOIS DE DIAS SEM CONVERSA — REGRA DURA'),
  pipeline.indexOf('LINGUAGEM DE IA — PROIBIDO')
);
assert.ok(bloco.length > 400, 'a regra da retomada precisa existir no pedido enviado à IA');
assert.match(bloco, /RECONHEÇA o tempo/, 'a mensagem tem que reconhecer que passaram dias');
assert.match(bloco, /TRAGA UM MOTIVO REAL/, 'e trazer um motivo real, tirado do que ficou pendente');

// As frases exatas que ele apontou como imbecilidade ficam proibidas, com nome e sobrenome.
for(const frase of ['sei que a vida corre', 'imagino que esteja\n  corrido', 'sei que a correria é grande', 'se ainda tiver interesse', 'desculpa incomodar']){
  assert.ok(bloco.includes(frase.replace('\n  ', ' ')) || bloco.includes(frase),
    `a desculpa pronta "${frase.replace('\n  ',' ')}" precisa estar proibida`);
}
assert.match(bloco, /NUNCA dê a desculpa pronta pro cliente/, 'e a razão precisa estar escrita, não só a lista');

// "Vi que você está com o Renaissance na cabeça" — adivinhar o que o cliente pensa.
assert.match(bloco, /você\n  não sabe o que ele está pensando; você sabe o que ele ESCREVEU/,
  'a IA não pode dizer o que o cliente tem "na cabeça"');

// ── 2. As três não podem ser três pedidos de licença ───────────────────────────────────────────
const trio = pipeline.slice(
  pipeline.indexOf('AS TRÊS NÃO PODEM SER TRÊS PEDIDOS DE LICENÇA'),
  pipeline.indexOf('LINGUAGEM DE IA — PROIBIDO')
);
assert.ok(trio.length > 200, 'a regra dos três pedidos de licença precisa existir');
assert.match(trio, /a "maisDireta" tem que AVANÇAR SOZINHA/, 'a direta executa em vez de pedir licença');
assert.match(trio, /UMA escolha concreta na mesa/, 'e coloca uma escolha concreta (horário, caminho, data)');
assert.match(trio, /"Me avisa e eu mando" não é direta/, 'com o exemplo do print, pra não sobrar dúvida');

// ── 3. A IA voltou a receber CONVERSA DE VERDADE (resumo demais gera mensagem genérica) ────────
// v1247 — deixou de ser "conversa média vai inteira": TODA conversa vai inteira (limiar
// desligado). Resumo demais gerava mensagem genérica, e o dono cobrou isso de novo em 13/08.
assert.match(pipeline, /DIRECIONA_INCREMENTAL_MIN_CHARS \|\| Infinity/, 'toda conversa vai inteira');
assert.match(pipeline, /DIRECIONA_INCREMENTAL_CAUDA_CHARS \|\| 9000/, 'e a conversa longa vai com bem mais material real');

// ── 4. O corretor para de adivinhar se o Cérebro entrou ────────────────────────────────────────
assert.match(pipeline, /cerebroAplicado: !modoPrevia,/, 'a análise registra se o Cérebro entrou');
assert.match(pipeline, /conversaLidaPelaIA: entradaIncremental/, 'e quanto da conversa a IA leu');
const linha = app.slice(app.indexOf('function cp1225LinhaDeOndeVeio(a){'), app.indexOf('function cp865UltimaAnaliseISO'));
assert.match(linha, /sem o seu Cérebro/, 'a tela avisa quando a análise saiu SEM o Cérebro');
assert.match(linha, /leu a conversa inteira/, 'e diz quando leu a conversa inteira');
assert.match(linha, /resumo de \$\{Number\(lida\.mensagensResumidas\)\|\|0\} antigas/, 'ou quanto entrou como resumo');
assert.match(app, /\$\{cp1225LinhaDeOndeVeio\(a\)\}/, 'a linha aparece embaixo das sugestões, no cliente');
// Análise antiga (sem esses campos) não pode mostrar linha nenhuma.
assert.match(linha, /if\(a\.cerebroAplicado == null && !lida\) return "";/, 'análise antiga não inventa informação');

console.log('v1225-retomada-de-verdade: ok');
