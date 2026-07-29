import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1073 — o build passou a remover comentários/espaços dos .js/.css publicados (app.js caiu de
// ~800KB pra ~590KB no celular do corretor). Regras de segurança desta compressão:
//   1. SÓ minifyWhitespace — NUNCA renomear identificadores (mangling quebraria os
//      onclick="funcao()" do HTML, que resolvem por nome em window).
//   2. Se o esbuild faltar ou falhar, publica o arquivo como está — compressão nunca derruba
//      nem trava uma publicação.

const build = fs.readFileSync(new URL('../build.js', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.ok(pkg.dependencies?.esbuild, 'esbuild precisa estar em dependencies (não devDependencies — a Vercel pode pular devDeps)');
assert.match(build, /minifyWhitespace:\s*true/, 'compressão liga minifyWhitespace');
assert.doesNotMatch(build, /minifyIdentifiers|mangle/, 'NUNCA renomear identificadores (quebraria onclick="..." do HTML)');
assert.doesNotMatch(build, /minifySyntax/, 'sem reescrita de sintaxe — só espaços/comentários (menor risco possível)');
assert.match(build, /catch[\s\S]{0,200}publicando sem comprimir/, 'falha de compressão publica sem comprimir, nunca derruba o build');
assert.match(build, /esbuild indisponível/, 'esbuild ausente não derruba o build (fallback sem compressão)');

console.log('v1073-build-comprime-sem-renomear: ok');
