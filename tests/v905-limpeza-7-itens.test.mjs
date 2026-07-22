import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// v905 — leva de limpeza pedida pelo dono (7 itens), removendo de verdade do código.

// 1. Importação de LEADS por CSV removida; parseCsvDireciona (compartilhada) e o EXPORT ⬇ Excel ficam.
assert.doesNotMatch(app, /CSV_ETAPA_MAP/, 'sem o mapa de etapas do import de leads CSV');
assert.doesNotMatch(app, /addEventListener\("click", \(\) => qs\("#crmCsvInput"\)/, 'sem o handler do import de leads CSV');
assert.match(app, /function parseCsvDireciona\(/, 'parseCsvDireciona permanece (telefones usa)');
assert.match(app, /async function importarTelefonesCSV\(/, '"Importar telefones (CSV)" permanece');
assert.match(app, /exportarLeadsCSV/, 'export ⬇ Excel permanece');

// 2 e 3. Home perde "Ver todos" e "Reanalisar todos"; "Reanalisar todos" vira card no Menu.
const acoes = app.match(/home-saud-acoes">[\s\S]*?<\/div><\/div>/)[0];
assert.doesNotMatch(acoes, />Ver todos</, 'sem "Ver todos" na home');
assert.doesNotMatch(acoes, /Reanalisar todos/, 'sem "Reanalisar todos" na home');
// v911: "Últimos atendimentos" também saiu da home (redundante com o "Atendimentos" da barra de baixo).
assert.doesNotMatch(acoes, /Últimos atendimentos/, 'sem "Últimos atendimentos" na home (v911)');
assert.match(html, /menu-card-titulo">Reanalisar todos/, '"Reanalisar todos" agora está no Menu');
assert.match(app, /window\.abrirTodosLeads/, 'abrirTodosLeads segue existindo (usado em outros lugares)');

// 4. Botão Voltar no padrão dos botões da direita (coberto também em v866-botao-voltar).
assert.match(app, /\.cp704-back\{[^}]*flex-direction:column[^}]*\}/, 'Voltar no formato .cp704-ico');

// 5. Filler "Contato principal da oportunidade" removido.
assert.doesNotMatch(app, /Contato principal da oportunidade/, 'sem o texto-filler do papel do contato');

// 6. Modal Editar lead: só Nome/Telefone/Produto (fora print, foto, colar, observação).
assert.doesNotMatch(app, /Atualizar por print da conversa/, 'sem "Atualizar por print"');
assert.doesNotMatch(app, /Anexar foto/, 'sem "Anexar foto"');
assert.doesNotMatch(app, /📋 Colar imagem/, 'sem "Colar imagem"');
assert.doesNotMatch(app, /editLeadObsAnexar/, 'sem o campo de observação interna');
assert.doesNotMatch(app, /function lerPrintEditarLead/, 'função órfã do print removida');
const salvar = app.match(/async function salvarEditarLead\(id\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(salvar, /editLeadAvatarFoto|obsMudou|memoria-set/, 'salvar só cuida de nome/telefone/produto');
assert.match(app, /id="editLeadNome"/, 'Nome fica');
assert.match(app, /id="editLeadTelefone"/, 'Telefone fica');
assert.match(app, /id="editLeadProduto"/, 'Produto fica');
assert.match(app, /function recortarAvatar/, 'recortarAvatar (compartilhado com lead manual) fica');

// 7. Card "Registrar observação": caixa de texto maior.
assert.match(app, /id="cp7ObsTexto"[^>]*min-height:120px/, 'textarea da observação ficou maior');

console.log('v905-limpeza-7-itens: ok');
