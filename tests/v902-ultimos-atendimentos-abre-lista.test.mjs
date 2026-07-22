import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v902 fez o link "Últimos atendimentos" da home abrir a lista de atendidos.
// v911 — o dono removeu esse link da home (redundante com "Atendimentos" na barra de baixo).
// Este teste agora garante que ele saiu de vez (botão e função órfã).

assert.doesNotMatch(app, />Últimos atendimentos<\/button>/, 'sem botão "Últimos atendimentos" na home');
assert.doesNotMatch(app, /function abrirUltimosAtendimentos\(\)/, 'função órfã abrirUltimosAtendimentos removida');
// A barra de baixo continua com "Atendimentos" (via nav) — a capacidade não se perdeu.
assert.match(app, /carregarCarteira|cp788RenderAtendimentos|cp788CarregarBase/, 'a tela Atendimentos continua existindo');

console.log('v902-ultimos-atendimentos-abre-lista: ok');
