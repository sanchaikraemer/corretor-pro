import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1263 — a "CONFERÊNCIA FINAL" nasceu aqui: uma lista de itens colocada DEPOIS da conversa, como
// última coisa que a IA lê antes de escrever. A posição é o que faz ela valer mais que as regras
// espalhadas no meio do texto.
//
// v1291 — o dono reescreveu as instruções: a conferência de 12 itens virou "REVISÃO FINAL
// SILENCIOSA", com 10 perguntas. A ideia (revisar por último, dentro da própria execução) continua
// exatamente igual, e é isso que este teste guarda.

const pos = src.indexOf('REVISÃO FINAL SILENCIOSA');
assert.ok(pos > -1, 'precisa existir a revisão final');
assert.ok(pos > src.indexOf('${timelineText}'),
  'a revisão final precisa vir DEPOIS da conversa — é o último item lido antes de a IA escrever');

const lista = src.slice(pos, pos + 1400);
const itens = (lista.match(/\n\d+\. /g) || []).length;
assert.ok(itens >= 10, `a revisão final precisa ter os dez itens (achei ${itens})`);
assert.match(lista, /O que você chamou de fato está realmente sustentado\?/, 'item de fato sustentado');
assert.match(lista, /Alguma mensagem inventa novidade, urgência ou ação do corretor\?/, 'item de novidade inventada');
assert.match(lista, /A resposta está fiel ao Cérebro Comercial atual\?/, 'item do Cérebro, que é a autoridade');

// Nada comercial cravado (regra da casa).
assert.doesNotMatch(lista, /R\$|Renaissance|Evolutti|Senger|Personalité/,
  'a revisão final não pode citar preço, empreendimento ou construtora');
console.log('v1263-conferencia-final: ok');
