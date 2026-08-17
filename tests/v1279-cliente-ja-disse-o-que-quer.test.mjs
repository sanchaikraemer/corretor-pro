import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1279 — o cliente já tinha dito o que queria e as sugestões continuavam perguntando, devolvendo
// o trabalho pra ele. A correção da época foram três blocos escritos no pedido (ângulo da maisSuave,
// objeção estrutural, uso de dado pessoal) mais dois itens da conferência final.
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. Os blocos saíram na reescrita entregue pelo dono. O que
// ficou escrito, e o que este teste passa a guardar, é a régua curta: procurar antes de perguntar,
// não devolver escolha em forma de catálogo e não transformar interpretação em fato.

assert.match(src, /ANTES DE PERGUNTAR, PROCURE A RESPOSTA NA CONVERSA, inclusive quando ela apareceu de forma indireta/,
  'procurar na conversa antes de perguntar continua sendo ordem escrita');
assert.match(src, /Não despeje catálogo quando os critérios já permitem curadoria\./,
  'quando o cliente já deu os critérios, a mensagem faz curadoria em vez de devolver a lista');
assert.match(src, /"clientProfile":"perfil comercial factual e útil, sem diagnóstico psicológico"/,
  'e dado pessoal continua não podendo virar diagnóstico sobre o cliente');
assert.match(src, /"objecaoPrincipal":"somente objeção confirmada; caso contrário Não identificado"/,
  'objeção só entra quando confirmada — nada de deduzir recusa do silêncio');

// Nada de cirurgia no texto da IA (regra da v1247, que continua valendo).
assert.ok(!/limparFrasesProibidas|melhorLimpa|construirMensagensDeterministicasCerebro/.test(src),
  'o corte determinístico de frase não pode voltar — quem cuida do texto é o prompt');
console.log('v1279-cliente-ja-disse-o-que-quer: ok');
