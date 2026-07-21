import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v907 — (10) "atendidos hoje" da home conta igual à Meta do dia (inclui arquivado atendido hoje);
// (11) botões de "Ferramentas e ações" mais encorpados, com hover de elevação.

// 10: a contagem tratadosHoje NÃO filtra mais por leadEhAtivo (arquivado atendido hoje conta).
const bloco = app.match(/let tratadosHoje = 0;[\s\S]*?tratadosHoje\+\+; \}/)[0];
assert.match(bloco, /if\(ehContatadoHoje\(l\)\) tratadosHoje\+\+/, 'conta todo lead atendido hoje');
assert.doesNotMatch(bloco, /leadEhAtivo\(l\) && ehContatadoHoje/, 'não exclui mais o arquivado da contagem');

// 11: botões da barra de ferramentas ganharam corpo (min-height/padding maiores) e hover.
assert.match(app, /\.cp704-tools-row button\{[^}]*min-height:54px[^}]*\}/, 'botões mais altos/encorpados');
assert.match(app, /\.cp704-tools-row button:hover\{[^}]*box-shadow[^}]*transform:translateY\(-1px\)/, 'hover com elevação');

console.log('v907-contagem-e-botoes: ok');
