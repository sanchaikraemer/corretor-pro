import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.match(src, /const filtroPrincipal=agora\.length\?'agora':programados\.length\?'programados':'aguardando';/,
  'renderer intermediário precisa declarar filtroPrincipal');
assert.match(src, /function renderHomeFallbackSeguro\(items\)/,
  'Home precisa ter fallback seguro');
assert.match(src, /function homeAindaEmSkeleton\(\)/,
  'Home precisa detectar skeleton preso');
console.log('home-loading-regression: ok');
