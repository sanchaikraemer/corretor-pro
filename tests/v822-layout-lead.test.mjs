import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v822: topo com card esquerdo MAIOR que o direito.
assert.match(app, /grid-template-columns:minmax\(0,1\.3fr\) minmax\(0,\.85fr\)/,
  'o card esquerdo do topo deve ser maior que o da observação');

// v908: o card "Ferramentas e ações" foi removido — as ações viraram ícones na barra do topo
// (Proposta/Arquivar/Mensagens/Excluir) e o histórico virou um card recolhível.
assert.doesNotMatch(app, /Ferramentas e ações/, 'card "Ferramentas e ações" não existe mais');
assert.match(app, /<div class="cp704-toolbar">[\s\S]*?<span class="lb">Proposta<\/span>/,
  'as ações agora são ícones no topo do lead');
assert.match(app, /class="cp704-card cp704-hist-card" id="cp704HistCard" hidden/,
  'o histórico ("Últimas mensagens") virou card recolhível');

// v908: "Últimas mensagens" abre/fecha pelo ícone "Mensagens" do topo (cp704ToggleHistorico).
assert.match(app, /window\.cp704ToggleHistorico=function\(\)/, 'toggle do histórico existe');

// Regressões: observação segue única; Detalhes comerciais segue aberto.
assert.equal((app.match(/id="cp7ObsTexto"/g) || []).length, 1, 'observação segue única');
assert.match(app, /<details class="cp704-details" open><summary>Detalhes comerciais/,
  'Detalhes comerciais segue aberto');

console.log('v822-layout-lead: ok');
