import fs from 'node:fs';
import assert from 'node:assert/strict';

// v991 — cadastro.html, entrar.html e admin-plataforma.html (v990) foram publicadas sem a
// meta tag de viewport. Sem ela, o navegador do celular renderiza a página como se fosse
// desktop (~980px) e depois espreme tudo pra caber na tela — texto e campos ficam minúsculos.
// O dono reportou isso testando no próprio celular.

for (const arquivo of ['cadastro.html', 'entrar.html', 'admin-plataforma.html']) {
  const html = fs.readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/,
    `${arquivo} precisa da meta tag de viewport pra renderizar em tamanho legível no celular`);
}

console.log('v991-viewport-mobile-contas: ok');
