import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1280 — o cliente tinha recusado um imóvel lá atrás e as sugestões voltavam a oferecer aquilo
// ("já que você chegou a se interessar"). A correção da época foi um bloco escrito no pedido.
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O bloco saiu na reescrita entregue pelo dono; a garantia
// ficou nos campos do diagnóstico e nas regras de histórico.

// v1322 — a regra ganhou a definição de superado (produto largado POR PREÇO volta quando a faixa
// muda). A garantia deste teste continua: o que o cliente DESCARTOU por critério vigente não volta.
assert.match(src, /"produtoInteresse":"produto\/necessidade atual, sem ressuscitar produto superado\./,
  'produto que o cliente já descartou não pode voltar como interesse atual');
assert.match(src, /"oQueOClienteQuer":"necessidade e critérios atuais confirmados; não misture interesse antigo superado"/,
  'e o que ele quer hoje não se mistura com o que ele já descartou');
assert.match(src, /Informação recente substitui a antiga somente quando forem incompatíveis; não apague o restante do contexto válido\./,
  'o que é recente manda sobre o que é antigo, sem jogar fora o resto do contexto');
assert.match(src, /"objecaoPrincipal":"somente objeção confirmada; caso contrário Não identificado"/,
  'e a recusa registrada continua sendo objeção confirmada, não palpite');

assert.ok(!/limparFrasesProibidas|melhorLimpa/.test(src),
  'o corte determinístico de frase não pode voltar — quem cuida do texto é o prompt');
console.log('v1280-recusa-antiga-nao-volta-pro-cliente: ok');
