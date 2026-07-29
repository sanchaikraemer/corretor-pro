import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v1069 — pedido do dono: nunca mais "puxar" um ZIP de dentro do app (o botão "Anexar" / seletor
// de arquivo manual). Os dois únicos jeitos de importar continuam sendo: compartilhar direto do
// WhatsApp (Web Share Target, Android) e o Atalho do iPhone — nenhum dos dois passa por um
// <input type="file"> dentro do app, então o elemento e toda a UI em volta dele saem do código.

// 1. O <input type="file"> manual e o botão "Anexar" não existem mais.
assert.doesNotMatch(html, /id="zipInput"/, 'sem input de arquivo manual (zipInput) no HTML');
assert.doesNotMatch(html, /Selecionar ZIP do WhatsApp/, 'sem o texto do card de seleção manual');
assert.doesNotMatch(html, />Anexar</, 'sem o botão "Anexar"');
assert.doesNotMatch(app, /qs\("#zipInput"\)/, 'app.js não referencia mais #zipInput');
assert.doesNotMatch(app, /qs\("#pickZip"\)|qs\("#uploadBox"\)/, 'app.js não referencia mais #pickZip/#uploadBox');

// 2. O CSS exclusivo do card de upload manual saiu.
assert.doesNotMatch(css, /\.upload-card\{|\.upload-main\{|\.upload-title\{|\.upload-action\{|\.file-native\{/,
  'CSS do upload manual removido');

// 3. processFile (compartilhado pelo Share Target e por qualquer reprocessamento) continua vivo
// e ainda escreve no #fileName, que PRECISA continuar existindo no HTML (status visível durante
// o processamento, usado também pelo caminho de compartilhamento).
assert.match(app, /async function processFile\(file, options = \{\}\)\{/, 'processFile continua existindo');
assert.match(html, /id="fileName"/, '#fileName continua no HTML (status do processamento)');
assert.match(app, /qs\("#fileName"\)\.textContent="Arquivo selecionado: "/, 'processFile ainda atualiza o #fileName');

// 4. _checkSharedImpl (Web Share Target) chama processFile diretamente, sem depender do input
// manual — confirma que remover o input não quebra o compartilhamento direto do WhatsApp.
const checkShared = app.match(/async function _checkSharedImpl\(\)\{[\s\S]*?\n\}/)[0];
assert.match(checkShared, /processFile\(file,\{shareId:id\}\)/, 'Web Share Target continua chamando processFile direto, sem input manual');

// 5. clearAnalysis não tenta mais limpar um input que não existe.
const clear = app.match(/function clearAnalysis\(\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(clear, /qs\("#zipInput"\)/, 'clearAnalysis não referencia mais #zipInput');

// 6. Os botões que abriam o seletor manual (".pickZipShortcut", "Mais ações" → Importar) agora
// só navegam pra tela de instruções (show("zip")), nunca abrem um <input type="file">.
assert.doesNotMatch(app, /pickZipShortcut.*click.*qs\("#zipInput"\)/, 'pickZipShortcut não abre mais o seletor de arquivo');
assert.match(app, /qs\("#maAcImportar"\)\.onclick = \(\) => \{ close\(\); show\("zip"\); \};/,
  '"Mais ações" → Importar navega pra tela de instruções, não abre seletor de arquivo');

console.log('v1069-remove-anexar-zip-manual: ok');
