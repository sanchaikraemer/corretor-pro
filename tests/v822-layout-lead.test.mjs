import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v822 pedia topo com dois cards lado a lado; a v1365 (ordem do dono, 22/08/2026) desfez isso:
// o topo é SÓ o hero (nome + situação), e a observação desceu pro painel lateral.
assert.match(app, /<section class="cp704-hero">[\s\S]{0,400}cp704-situation/,
  'o topo é o hero com nome + situação');
assert.ok(!/cp704-herorow/.test(app), 'a dupla de cards do topo (herorow) não volta');

// v908: o card "Ferramentas e ações" foi removido — as ações viraram ícones na barra do topo
// (Proposta/Arquivar/Mensagens/Excluir) e o histórico virou um card recolhível.
assert.doesNotMatch(app, /Ferramentas e ações/, 'card "Ferramentas e ações" não existe mais');
assert.match(app, /<div class="cp704-toolbar">[\s\S]*?<span class="lb">Proposta<\/span>/,
  'as ações agora são ícones no topo do lead');
assert.match(app, /class="cp704-card cp704-hist-card" id="cp704HistCard" hidden/,
  'o histórico ("Últimas mensagens") virou card recolhível');

// v908: "Últimas mensagens" abre/fecha pelo ícone "Mensagens" do topo (cp704ToggleHistorico).
assert.match(app, /window\.cp704ToggleHistorico=function\(\)/, 'toggle do histórico existe');

// Regressões: observação segue única; Detalhes comerciais segue existindo — desde a v1365
// começa RECOLHIDO (ordem do dono: "quem quer investigar abre").
assert.equal((app.match(/id="cp7ObsTexto"/g) || []).length, 1, 'observação segue única');
assert.match(app, /<details class="cp704-details"><summary>Detalhes comerciais/,
  'Detalhes comerciais segue no painel lateral, recolhível');

console.log('v822-layout-lead: ok');
