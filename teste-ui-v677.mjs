import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const api = fs.readFileSync('api/lead-update.js', 'utf8');

// Busca realmente visível nas duas telas novas.
assert.match(app, /ui677ToolbarHTML\("home"\)/, 'Busca/atalho ausente na tela Hoje');
assert.match(app, /ui677ToolbarHTML\("atendimentos"\)/, 'Busca/atalho ausente em Atendimentos');
assert.match(app, /Buscar por nome ou interesse/, 'Placeholder da busca ausente');
assert.match(app, /String\(l\.phone\|\|""\).*includes\(numeros\)/s, 'Busca por telefone ausente');
assert.match(app, /await loadTodosLeadsBusca\(\)/, 'Busca não garante carregamento da base completa');

// Cadastro manual simples e validado.
for (const id of ['novoLeadNome', 'novoLeadInteresse', 'novoLeadTel']) {
  assert.ok(app.includes(`id="${id}"`), `Campo manual ausente: ${id}`);
}
assert.ok(!/id="novoLeadObs"/.test(app.slice(app.indexOf('function abrirNovoLead'), app.indexOf('function fecharNovoLead'))), 'Modal manual ainda exibe observação');
assert.match(app, /action:"criar-manual"/, 'Cadastro manual não chama o backend');
assert.match(api, /action === "criar-manual"/, 'Backend não aceita criar-manual');

// Oportunidade encerrada não deve pedir novo clique em Atendido.
assert.match(app, /oportunidadeEncerrada=\["perdida","ganha"\]/, 'Regra de oportunidade encerrada ausente');
assert.match(app, /ui677-closed-badge/, 'Badge Encerrada/Vendida ausente');

// Exclusão definitiva aparece só na área administrativa nova; o legado fica escondido.
assert.match(app, /class="legacy-delete-definitivo"/, 'Exclusão legada não foi marcada');
assert.match(css, /lead-foco-aberto \.legacy-delete-definitivo\{display:none!important\}/, 'Exclusão legada não foi ocultada');

console.log('UI v677: OK — busca, cadastro manual, estado encerrado e exclusão única validados.');
