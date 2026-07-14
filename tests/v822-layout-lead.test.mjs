import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v822: topo com card esquerdo MAIOR que o direito.
assert.match(app, /grid-template-columns:minmax\(0,1\.3fr\) minmax\(0,\.85fr\)/,
  'o card esquerdo do topo deve ser maior que o da observação');

// Ferramentas e ações: abertas no rodapé (não mais accordion), com os botões.
assert.doesNotMatch(app, /<summary>Ferramentas e ações<\/summary>/,
  'Ferramentas e ações não pode mais ser accordion');
assert.match(app, /cp704-tools-open[\s\S]*?Ferramentas e ações[\s\S]*?cp704ToolsFlat\(lead,mc\)/,
  'Ferramentas e ações deve aparecer aberta no rodapé com os botões');

// Últimas mensagens continua colapsável com a setinha (agora no rodapé — ver v823).
assert.match(app, /cp704-hist-inline"><summary>Últimas mensagens/,
  'Últimas mensagens deve continuar colapsável (setinha)');

// Regressões: observação segue única; Detalhes comerciais segue aberto.
assert.equal((app.match(/id="cp7ObsTexto"/g) || []).length, 1, 'observação segue única');
assert.match(app, /<details class="cp704-details" open><summary>Detalhes comerciais/,
  'Detalhes comerciais segue aberto');

console.log('v822-layout-lead: ok');
