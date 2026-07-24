import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v907 — (10) "atendidos hoje" da home conta igual à Meta do dia (inclui arquivado atendido hoje);
// (11) botões de "Ferramentas e ações" mais encorpados, com hover de elevação.
//
// v980 — a intenção do item 10 (contar arquivado atendido hoje) só existia no comentário e na
// contagem LOCAL de renderSaudacao; cpAtendidosHojeTotal (usada pela dose do "Fazer agora" e por
// outras telas) continuava filtrando por leadEhAtivo e nunca foi corrigida junto — duas contas
// do "mesmo" número, uma certa e uma errada, foi exatamente o que gerou o relato do dono (Home
// dizia 11, Atendimentos dizia 12). Ver tests/v980-atendidos-hoje-inclui-arquivados.test.mjs
// para o teste funcional completo; aqui fica só a garantia de que as duas contas não voltaram a
// divergir (renderSaudacao delega pra cpAtendidosHojeTotal em vez de ter sua própria conta).
assert.match(app, /const tratadosHoje = cpAtendidosHojeTotal\(items\);/,
  'a saudação da Home precisa usar a mesma contagem que a dose usa, não uma conta local separada');
const blocoTotal = app.match(/function cpAtendidosHojeTotal\(items\)\{[\s\S]*?\n\}/)[0];
assert.match(blocoTotal, /if\(ehContatadoHoje\(l\)\) n\+\+/, 'conta todo lead atendido hoje');
assert.doesNotMatch(blocoTotal, /\.filter\(leadEhAtivo\)/, 'não exclui mais o arquivado da contagem');

// 11: botões da barra de ferramentas ganharam corpo (min-height/padding maiores) e hover.
assert.match(app, /\.cp704-tools-row button\{[^}]*min-height:54px[^}]*\}/, 'botões mais altos/encorpados');
assert.match(app, /\.cp704-tools-row button:hover\{[^}]*box-shadow[^}]*transform:translateY\(-1px\)/, 'hover com elevação');

console.log('v907-contagem-e-botoes: ok');
