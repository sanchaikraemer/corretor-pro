import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1257 — o corretor tinha mandado o material como anexo/link e as sugestões ofereciam mandar de
// novo, como se nada tivesse sido entregue. A correção da época foi o bloco "TRAVA OBRIGATÓRIA
// ANTES DE DIZER QUE ALGO NÃO FOI ENTREGUE".
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O bloco saiu na reescrita entregue pelo dono; ficou uma
// linha só, e ela cobre o essencial: envio é fato, conteúdo do anexo não é.

assert.match(src, /Se material\/arquivo foi enviado, considere o envio como fato, mas não invente o conteúdo que não está visível\./,
  'anexo e link continuam contando como entrega feita');
// O marcador que o sistema cria no lugar do anexo (é o que faz a IA saber que houve envio) continua
// existindo — sem ele, a regra acima não tem em que se apoiar.
assert.match(src, /documento\/PDF/, 'o marcador do PDF enviado continua sendo criado na leitura da conversa');
assert.match(src, /não invente ação já realizada, novidade, disponibilidade, prazo, condição, urgência ou escassez/i,
  'e continua proibido inventar que algo foi feito');
console.log('v1257-anexo-e-link-contam-como-entrega: ok');
