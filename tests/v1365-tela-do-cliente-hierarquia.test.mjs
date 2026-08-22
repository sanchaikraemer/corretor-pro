import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1365 — A HIERARQUIA DA TELA DO CLIENTE (ordem do dono, avaliação de 22/08/2026):
// "em 3 segundos ele precisa responder: o que aconteceu? → o que faço agora? → o que mando?"
// Este teste tranca o que a conferência visual em Chromium validou — inclusive o defeito que ela
// pegou antes de publicar (o menu "⋯" nascendo aberto porque o display:flex atropelava o hidden).

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// ── 1. A ordem dos blocos no molde da tela: hero → Fazer agora → conduzir → recolhíveis → obs ─
const ini = app.indexOf('area.innerHTML=`<div class="cp704-lead">');
assert.ok(ini > 0, 'não achei o molde da tela do cliente');
const molde = app.slice(ini, ini + 20000);
const pos = s => { const p = molde.indexOf(s); assert.ok(p >= 0, `não achei "${s}" no molde`); return p; };
assert.ok(pos('cp704-toolbar') < pos('cp704-hero'), 'barra antes do nome');
assert.ok(pos('cp704-hero') < pos('cp704-agora'), 'nome + situação antes do Fazer agora');
assert.ok(pos('cp704-agora') < pos('cp704ConducaoHtml(lead)'), 'Fazer agora antes do Como conduzir');
assert.ok(pos('cp704ConducaoHtml(lead)') < pos('<summary>Resumo do contato</summary>'), 'conduzir antes do Resumo do contato');
assert.ok(pos('<summary>Resumo do contato</summary>') < pos('cp704-obscard'), 'observação vem depois do resumo');

// ── 2. O menu "⋯": hidden precisa VALER mesmo com display:flex na regra do menu ──────────────
assert.match(app, /\.cp704-more-menu\[hidden\]\{display:none\}/,
  'sem esta regra o menu nasce aberto (pego na conferência visual da v1365)');
assert.match(app, /id="cp704MoreMenu" hidden/, 'o menu nasce fechado no molde');
assert.match(app, /window\.cp704ToggleMais=function/, 'o botão "Mais" tem quem o abra');
assert.match(app, /__cp1365FechaMenuMais/, 'clique fora fecha o menu');
assert.match(app, /cp7MenuMaisAberto/, 'o menu aberto sobrevive à remontagem da tela (padrão v1229)');

// ── 3. Datas e últimas mensagens moram no "Resumo do contato", não no topo ───────────────────
const hero = molde.slice(pos('cp704-hero'), pos('cp704-agora'));
assert.ok(!hero.includes('cp704-metaline'), 'o topo não mostra mais as linhas de data');
assert.ok(!hero.includes('cp1345UltimasMensagensHTML'), 'o topo não mostra mais a prévia de mensagens');
assert.ok(molde.includes('cp1365-resumo'), 'o Resumo do contato existe e carrega o que desceu');

// ── 4. Agenda sem o parágrafo explicativo fixo ───────────────────────────────────────────────
assert.ok(!html.includes('Só o que tem data marcada'),
  'o texto explicativo da Agenda saiu por ordem do dono (22/08/2026) e não volta');

// ── 5. O contraste do cinza auxiliar — na camada que RENDERIZA (bloco #657, o último) ────────
assert.match(css, /--cp-muted:#9FB2BB/,
  'o cinza auxiliar subiu de contraste na camada final (#8FA0A8 era apagado demais; e o primeiro ajuste em outro bloco era atropelado — lição v1078)');
assert.ok(!/--cp-muted:#8FA0A8/.test(css), 'o valor antigo não pode voltar na camada final');

console.log('v1365-tela-do-cliente-hierarquia: ok (ordem, menu ⋯ de verdade fechado, resumo recolhível, agenda limpa, contraste)');
