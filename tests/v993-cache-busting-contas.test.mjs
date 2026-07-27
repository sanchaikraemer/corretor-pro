import fs from 'node:fs';
import assert from 'node:assert/strict';

// v993 — o dono publicou v991 e v992 e continuava vendo a versão antiga (ícone de olho não
// aparecia, texto pequeno persistia). Causa: contas-estilo.css/contas-config.js/vendor/supabase.js
// eram referenciados sem "?v=" nas 3 páginas novas — diferente de index.html, que sempre usa
// "?v=__VERSION__". Sem isso, o service worker (staleWhileRevalidate) serve esses arquivos do
// cache do celular pra sempre, porque a URL nunca muda entre versões. Além disso, essas 3 páginas
// HTML não tinham entrada própria no vercel.json, então também podiam ficar em cache HTTP comum.
//
// v1013 — mesmo padrão aplicado às duas páginas novas de recuperação de senha
// (recuperar-senha.html/redefinir-senha.html), criadas pela auditoria de isolamento entre contas.

const PAGINAS_CONTAS = ['cadastro.html', 'entrar.html', 'admin-plataforma.html', 'recuperar-senha.html', 'redefinir-senha.html'];

for (const arquivo of PAGINAS_CONTAS) {
  const html = fs.readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
  assert.match(html, /contas-estilo\.css\?v=__VERSION__/, `${arquivo} precisa versionar contas-estilo.css`);
  assert.match(html, /vendor\/supabase\.js\?v=__VERSION__/, `${arquivo} precisa versionar vendor/supabase.js`);
  assert.match(html, /contas-config\.js\?v=__VERSION__/, `${arquivo} precisa versionar contas-config.js`);
}

const vercelConfig = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
for (const pagina of PAGINAS_CONTAS.map(p => `/${p}`)) {
  const regra = vercelConfig.headers.find(h => h.source === pagina);
  assert.ok(regra, `vercel.json precisa ter uma regra de headers pra ${pagina}`);
  const cacheControl = regra.headers.find(h => h.key === 'Cache-Control');
  assert.ok(cacheControl && /no-store/.test(cacheControl.value), `${pagina} precisa de Cache-Control no-store`);
}

console.log('v993-cache-busting-contas: ok');
