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

// A proteção de 5 dias (que joga o lead atendido para "aguardando") continua ligada.
assert.match(app, /if\(descansoAtendimento&&\(!lembreteVencido\(l\)\|\|atendimentoAposLembrete\)\) return 'aguardando'/,
  'a proteção de 5 dias deve continuar em cp786Categoria');

console.log('v824-fallback-prioridade: ok');
