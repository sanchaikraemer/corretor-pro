import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1267 — quando o material já tinha sido enviado e a conversa parava ali, as sugestões ofereciam
// mandar MAIS material. A correção da época era um item da conferência final mandando trocar
// "mando mais um arquivo" por um encontro.
//
// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. O item saiu na reescrita entregue pelo dono, e a escolha do
// próximo passo (mandar material, ligar, visitar, esperar) passou a ser decisão do Cérebro somada
// à maturidade real da conversa. Continua proibido despejar catálogo e forçar visita sem maturidade.

assert.match(src, /Não despeje catálogo quando os critérios já permitem curadoria\./,
  'mandar mais material por mandar continua proibido');
assert.match(src, /NÃO INVENTE COMPROMISSO/,
  'e o encontro não pode nascer sem base no histórico');
assert.match(src, /Alguma mensagem força visita\/encontro\/proposta sem maturidade\?/,
  'a revisão final continua protegendo contra avanço antes da hora');
assert.match(src, /Se material\/arquivo foi enviado, considere o envio como fato, mas não invente o conteúdo que não está visível\./,
  'o material já enviado continua contando como enviado');
assert.match(src, /Escolha o menor próximo passo útil para ESTE lead/,
  'e o próximo passo continua sendo o menor passo útil, seja ele qual for');
console.log('v1267-material-parou-chama-pra-ver: ok');
