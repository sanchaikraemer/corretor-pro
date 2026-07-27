import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1035 — parte visível (tela) da solução do Atalho do iPhone: um cartão no Menu, escondido por
// padrão, que só aparece pra quem tem iPhone (mesma detecção ehIOS() já usada pelo passo a passo
// de instalar o app), com botão de gerar/mostrar a chave pessoal, botão de copiar, e o passo a
// passo de como montar o Atalho (Shortcuts) — ver NOTAS-v1035.md.

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const pwaInstall = fs.readFileSync(new URL('../js/pwa-install.js', import.meta.url), 'utf8');

// 1. O cartão existe no Menu, escondido por padrão (só ehIOS() revela).
assert.match(html, /<div class="card compact" id="cardAtalhoIphone" hidden>/, 'o cartão do Atalho do iPhone precisa existir no Menu e começar escondido');
for (const id of ['atalhoChaveStatus', 'btnAtalhoGerarChave', 'btnAtalhoCopiarChave', 'atalhoInstrucoes']) {
  assert.match(html, new RegExp(`id="${id}"`), `index.html precisa ter o elemento #${id}`);
}

// 2. pwa-install.js revela o cartão só no iPhone/iPad (reaproveita ehIOS(), não duplica a detecção).
assert.match(pwaInstall, /if\(ehIOS\(\)\)\{\s*const card = qs\("#cardAtalhoIphone"\)/, 'o cartão só pode ser revelado dentro do mesmo caminho que já detecta iOS (ehIOS)');
assert.match(pwaInstall, /atalhoCarregarChaveExistente\(\)/, 'ao revelar o cartão, precisa buscar se o corretor já tinha gerado uma chave antes');

// 3. Gerar chave chama a rota nova com action "gerar"; mostrar chave usa GET na mesma rota.
assert.match(pwaInstall, /fetch\("\.\/api\/atalho-zip-token"\)/, 'precisa buscar a chave já existente em ./api/atalho-zip-token (GET)');
assert.match(pwaInstall, /fetch\("\.\/api\/atalho-zip-token",\s*\{\s*method:"POST".*action:"gerar"/s, 'gerar uma chave nova precisa chamar ./api/atalho-zip-token com action "gerar"');

// 4. A URL do endpoint mostrada nas instruções é montada a partir do domínio real (nunca cravada),
//    pra funcionar em qualquer ambiente (produção, preview) sem editar código.
assert.match(pwaInstall, /window\.location\.origin.*receber-zip-atalho/, 'a URL mostrada no passo a passo precisa vir de window.location.origin, não cravada no código');

// 5. Copiar chave usa a Clipboard API e avisa se não conseguir.
assert.match(pwaInstall, /navigator\.clipboard\.writeText\(atalhoChaveAtual\)/, 'o botão de copiar precisa usar a Clipboard API');

console.log('v1035-atalho-ios-menu-ui: ok');
