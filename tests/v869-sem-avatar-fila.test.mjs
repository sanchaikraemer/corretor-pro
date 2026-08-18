import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v869: o dono não quer os "cards" com iniciais (avatares) nas linhas de "Próximos
// atendimentos".
//
// v1186 — este teste estava guardando um FANTASMA. Ele exigia que a marcação
// `class="fila-row … fila-rank … fila-info"` continuasse existindo; ela existia, mas dentro de
// `renderFilaPrioridade`, uma geração de tela que ninguém chamava havia muito tempo (a lista de
// hoje é desenhada por `cpHomeLeadRow`, com `cp-hoje-list`). Ou seja: o teste passava enquanto
// guardava código que não roda. A auditoria de 09/08/2026 removeu a função morta e trouxe a
// guarda pro renderizador de verdade — a intenção do dono continua a mesma.

// v1293 — o pedido do dono ("tira o avatar da fila") virou definitivo: as duas funções de avatar
// de lead foram removidas do app, porque nenhuma tela as chamava mais.
assert.ok(!/avatarLead\(|avatarInicial\(/.test(app),
  'nenhuma função de avatar de lead pode voltar sem uma tela que peça por ela');

// A lista de hoje continua existindo, e é a VIVA (a que a Home realmente chama).
assert.match(app, /function cpHomeLeadRow\(/, 'a linha da lista de hoje precisa continuar existindo');
assert.match(app, /cp-hoje-list["'`][^`]*\$\{dose\.map\(l => cpHomeLeadRow/,
  'a Home precisa continuar desenhando a lista de hoje com cpHomeLeadRow');
const linhaHome = app.slice(app.indexOf('function cpHomeLeadRow('));
assert.ok(!/avatarLead\(|avatarInicial\(/.test(linhaHome.slice(0, linhaHome.indexOf('\n}\n'))),
  'a linha da lista de hoje não pode desenhar avatar');

console.log('v869-sem-avatar-fila: ok');
