import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1131 — o dono: "está demorando demais pra analisar e enviar para o app".
//
// A v1122 já tinha atacado essa lentidão: subiu a capacidade do SERVIDOR de 4 pra 10 áudios
// transcritos ao mesmo tempo. Só que o app nunca mandava mais de 3 áudios por chamada — então o
// servidor jamais chegava perto de usar os 10 lugares. A correção estava publicada, documentada em
// NOTAS-v1122.md, e não produzia efeito nenhum: a fila continuava do mesmo tamanho, só que agora
// com a aparência de resolvida. Uma conversa com 30 áudios = 10 idas e voltas em sequência, cada
// uma relendo o manifesto e baixando arquivos.
//
// Guarda de regressão: o tamanho do lote que o app manda não pode voltar a ser menor que a
// capacidade do servidor — senão o teto do servidor vira enfeite de novo.

// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const rota = fs.readFileSync(new URL('../api/processar-storage.js', import.meta.url), 'utf8');

// 1. Quanto o app manda por vez, e quanto o servidor aguenta ao mesmo tempo.
const lote = Number(/const LOTE = (\d+);/.exec(app)?.[1]);
const capacidade = Number(/const TRANSCRICAO_CONCORRENCIA_PADRAO = (\d+);/.exec(pipeline)?.[1]);
assert.ok(Number.isFinite(lote), 'não achei o tamanho do lote de transcrição em app.js');
assert.ok(Number.isFinite(capacidade), 'não achei a capacidade de transcrição em _pipeline.js');

assert.ok(lote > 3,
  `o lote voltou a ${lote}: com menos de 4 áudios por chamada a importação enfileira igual antes da v1122`);
assert.ok(lote >= capacidade * 0.75,
  `o app manda ${lote} áudios por vez mas o servidor aguenta ${capacidade} ao mesmo tempo — sobra capacidade parada, que foi exatamente o que fez a correção da v1122 não valer nada`);

// 2. E não pode passar da capacidade: mandar mais do que cabe só empilha espera dentro dos 60
//    segundos que a função tem na Vercel.
assert.ok(lote <= capacidade,
  `o app manda ${lote} por chamada, acima dos ${capacidade} que o servidor processa ao mesmo tempo — o excedente espera dentro da função, que tem 60s de teto`);

// 3. Antes de transcrever, o servidor lê o cache e baixa cada áudio. Isso não pode voltar a ser
//    uma fila: num lote de 8 são 16 idas e voltas ao Storage, e num dia de banco lento é aí que a
//    espera aparece na tela.
const trecho = rota.slice(rota.indexOf('const preparados'), rota.indexOf('const arquivos = preparados'));
assert.ok(trecho.length > 0, 'não achei a preparação dos áudios em processar-storage.js');
assert.match(trecho, /mapComLimiteParalelo\(/,
  'a leitura do cache e o download dos áudios precisam acontecer em paralelo, não um atrás do outro');
assert.match(rota, /async function mapComLimiteParalelo\(itens, limite, fn\)/,
  'o pool com teto de simultaneidade precisa existir na rota');

// 4. A ordem dos áudios precisa ser preservada — o paralelo não pode embaralhar o lote.
assert.match(trecho, /preparados\[i\]\s*=/,
  'cada áudio precisa ser gravado na SUA posição (índice), senão o paralelo embaralha a ordem do lote');
assert.match(rota, /const arquivos = preparados\.filter\(Boolean\)/,
  'as posições vazias (cache aproveitado / áudio ausente) precisam ser removidas no fim');

console.log('v1131-transcricao-em-lotes-maiores: ok');
