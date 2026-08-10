import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1205 — o dono mandou tirar a "Central de atenção": o painel que cobria a tela ao tocar no
// sino, repetindo em forma de lista os MESMOS números que a Home já mostra em cards logo abaixo
// ("N atendimentos pedem ação", "N na agenda", "N clientes ativos"). Era uma parada a mais entre
// ele e a tela que ele queria. O sino continua vivo como AVISO (o número no cantinho, das v787 /
// v1093 / v1168), só que agora um toque leva DIRETO pra Agenda.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// 1. O painel e a função que o montava não existem mais.
assert.ok(!app.includes('openNotifyPanel'), 'a função que abria a Central de atenção precisa sumir do código');
assert.ok(!app.includes('function notifyData'), 'a conta que alimentava só a Central de atenção precisa sumir junto');
assert.ok(!app.includes('<h3>Central de atenção</h3>'), 'o título do painel removido não pode sobrar');
assert.ok(!app.includes('O que merece sua ação agora'), 'o subtítulo do painel removido não pode sobrar');
assert.ok(!/Central de aten/.test(html), 'o topo não pode mais anunciar a Central de atenção');
// nenhum rótulo visível (título/aria do sino) pode continuar prometendo o painel
const rotulos = app.match(/['"`][^'"`\n]*Central de aten[^'"`\n]*['"`]/g) || [];
assert.deepEqual(rotulos, [], 'nenhum texto de tela pode citar a Central de atenção');

// 2. O sino continua existindo e leva direto pra Agenda.
assert.match(html, /id="topBell"[^>]*onclick="show\('agenda'\)"/, 'o sino precisa abrir a Agenda num toque');
assert.match(html, /id="bellBadge"/, 'o aviso no cantinho do sino continua existindo');
assert.ok(!/bell\.addEventListener\('click'/.test(app), 'nenhum atalho pode roubar o toque do sino de volta pra um painel');

// 3. O número do aviso (agenda de hoje / atrasados) segue funcionando.
assert.match(app, /function updateBell\(\)/, 'o aviso do sino continua sendo atualizado');
assert.match(app, /bell\.classList\.toggle\('tem-atraso', atr > 0\)/, 'compromisso atrasado continua deixando o sino vermelho (v1093)');
assert.match(css, /#topBell\.tem-atraso \.bell-badge:not\(\[hidden\]\)\{/, 'o número de atrasados continua visível no sino');

// 4. O estilo do painel continua no CSS porque o Bloco de notas (v1171) o reaproveita.
assert.ok(app.includes('cp687-notify-panel cp1170-panel'), 'o Bloco de notas continua usando esse estilo de painel');
assert.match(css, /\.cp687-notify-panel\{/, 'o estilo do painel precisa continuar existindo pro Bloco de notas');

console.log('v1205-central-atencao-removida: ok');
