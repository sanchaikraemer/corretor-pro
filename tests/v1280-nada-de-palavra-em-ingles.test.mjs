import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1280 — "overview???" (dono, 14/08/2026). A sugestão saiu com palavra em inglês, e a correção da
// época foi o bloco "PALAVRA EM INGLÊS E JARGÃO DE ESCRITÓRIO — PROIBIDO", com a lista de palavras
// (overview, insight, feedback, budget, call, follow-up, timing, update), as traduções e a exceção
// do vocabulário real do mercado (studio, duplex, garden, closet).
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA, E É UMA DAS PERDAS DESTA VERSÃO. Na reescrita das
// instruções entregue pelo dono esse bloco saiu inteiro, junto com a lista "LINGUAGEM DE IA —
// PROIBIDO". Hoje não existe nenhuma lista de palavra proibida no pedido: quem segura o tom é o
// Cérebro do corretor e os exemplos de mensagem real dele que vão junto na análise.
// Se "overview" voltar a aparecer nas sugestões, é este bloco que precisa ser recolocado.

assert.ok(!/PALAVRA EM INGLÊS E JARGÃO DE ESCRITÓRIO — PROIBIDO/.test(src),
  'se a lista voltar, este teste precisa voltar a cobrar as palavras uma a uma (ver NOTAS-v1291.md)');
assert.ok(!/LINGUAGEM DE IA — PROIBIDO/.test(src),
  'idem para a lista de clichê em português');

// O que resta segurando o tom: os exemplos de escrita real do corretor e o tom do Cérebro.
assert.match(src, /COMO ESTE CORRETOR ESCREVE — EXEMPLOS REAIS DESTA CONVERSA/,
  'os exemplos de voz real do corretor não podem sumir também — são a última rede contra o texto de robô');
assert.match(src, /O conteúdo atual do Cérebro Comercial abaixo é a autoridade máxima sobre método, análise, estratégia,\s*\n?tom/,
  'e o tom continua sendo assunto do Cérebro');

// Nada de cirurgia no texto da IA (regra da v1247, que continua valendo).
assert.ok(!/limparFrasesProibidas|melhorLimpa/.test(src),
  'o corte determinístico de frase proibida foi removido na v1247 e não pode voltar');
console.log('v1280-nada-de-palavra-em-ingles: ok');
