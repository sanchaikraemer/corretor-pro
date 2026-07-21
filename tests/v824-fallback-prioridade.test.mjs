import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v824: o modo de segurança da Home (renderHomeFallbackSeguro) NÃO pode mais mostrar os
// primeiros leads crus. Ele passa a filtrar pela categoria real e só mostra quem é 'agora'.
// Assim, um lead atendido recentemente (proteção de 5 dias -> 'aguardando') nunca aparece.
assert.match(app, /function renderHomeFallbackSeguro\(items\)\{[\s\S]*?cp786Categoria\(l\) === "agora"/,
  'o fallback da Home deve filtrar por cp786Categoria === "agora"');
assert.doesNotMatch(app, /function renderHomeFallbackSeguro\(items\)\{[\s\S]*?\.filter\(l => l && typeof l === "object" && \(l\.id != null \|\| l\.name\)\)\s*\.slice\(0, 4\)/,
  'o fallback não pode mais usar os 4 primeiros leads sem filtro de prioridade');

// v906: o lead que você atendeu e que o cliente ainda NÃO respondeu fica em "aguardando"
// (não volta pra fila "Fazer agora" enquanto a bola está com o cliente). A proteção agora é
// "esperar a resposta do cliente", não um prazo cego de 5 dias.
assert.match(app, /if\(cpAguardandoResposta\(l\)\) return 'aguardando'/,
  'lead atendido sem resposta do cliente fica em aguardando (não em Fazer agora)');

console.log('v824-fallback-prioridade: ok');
