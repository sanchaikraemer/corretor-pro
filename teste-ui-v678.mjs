import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

// Busca continua visível, mas o botão manual saiu do topo.
assert.match(app, /ui677ToolbarHTML\("home"\)/, 'Busca da Home ausente');
assert.match(app, /ui677ToolbarHTML\("atendimentos"\)/, 'Busca de Atendimentos ausente');
assert.ok(!/Incluir manual<\/button>/.test(app.slice(app.indexOf('function ui677ToolbarHTML'), app.indexOf('window.ui677ToolbarHTML'))), 'Botão manual ainda aparece no topo da toolbar');

// Barra inferior com botão manual central.
assert.match(index, /onclick="abrirNovoLead\(\)" aria-label="Incluir manual"/, 'Botão manual central não abre o cadastro manual');
assert.match(index, /<span class="lbl">Manual<\/span>/, 'Rótulo do botão central não foi ajustado');
assert.match(css, /grid-template-columns:repeat\(5,1fr\)/, 'Barra inferior não reserva 5 colunas');
assert.match(css, /\.nav\.fab \.fab-btn\{visibility:visible\}/, 'FAB central continua invisível');

// Correção de contexto misto trabalho -> imóvel.
assert.match(app, /function ui678ContextoMudouParaImovel\(/, 'Heurística de mudança de contexto ausente');
assert.match(app, /Potencial comprador direto; o assunto antigo sobre trabalho ficou superado por um interesse imobiliário posterior\./, 'Correção de papel do contato ausente');
assert.match(app, /Aguardar a resposta do contato sobre perfil, faixa de valor e se busca imóvel pronto ou na planta/, 'Próxima ação corrigida ausente');

console.log('UI v678: OK — botão manual central e contexto misto corrigidos.');
