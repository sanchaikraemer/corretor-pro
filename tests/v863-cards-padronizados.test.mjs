import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v863: padronizar o card de lead entre "Fazer agora" (.ui-priority-row / .ui-row-copy) e
// "Atendimentos" (.cp788-att-row / .cp788-att-copy), adotando "Fazer agora" como base — mesma
// fonte no título, sem a barra verde na lateral esquerda.
//
// v1186 — REESCRITO PORQUE METADE DO QUE ELE COMPARAVA JÁ NÃO EXISTIA.
//
// A v908 refez a tela Atendimentos: ela deixou de listar cards de lead (`.cp788-att-row`) e virou
// um painel por dia, com o prédio e os nomes do dia. O CSS dos cards antigos ficou no arquivo, sem
// ninguém desenhar — e este teste seguiu comparando o tamanho da fonte de um card que não existe
// com o de um que existe. Passava, mas media o nada.
//
// A auditoria de 09/08/2026 removeu do CSS as 167 classes que nenhuma tela citava, `.cp788-att-*`
// entre elas. O que este arquivo guarda agora é a regra que continua valendo: existe UM padrão de
// card de lead no app, e ele não usa o verde que o dono mandou tirar na v867.

// ── 1. Existe um único componente de card de lead, e é o da "Fazer agora" ─────────────────────
assert.match(app, /class="ui-priority-row"/, 'o card de lead precisa continuar existindo');
assert.match(css, /\.ui-row-copy strong\{[^}]*font-size:14px/,
  'o título do card de lead precisa continuar em 14px (a base escolhida na v863)');

// O card antigo dos Atendimentos não pode voltar — nem no CSS, nem no app.
for (const morta of ['cp788-att-row', 'cp788-att-copy', 'cp788-att-list', 'cp788-att-time']) {
  assert.doesNotMatch(css, new RegExp(morta.replace(/-/g, '\\-')),
    `${morta} saiu na v908/v1186 — se a tela Atendimentos voltar a listar cards, use .ui-priority-row`);
}

// ── 2. A tela Atendimentos continua sendo o painel por dia que a v908 trouxe ──────────────────
assert.match(app, /class="cp788-att-page"/, 'a tela Atendimentos precisa continuar existindo');
assert.match(app, /class="cp788-day-head"/, 'o painel por dia precisa continuar');
assert.match(app, /cp788PredioSVG\(/, 'o prédio (destaque coral da tela) precisa continuar');

// ── 3. v867: o verde (#68ff95) saiu do CARD e da etiqueta de status — o dono achou que não
//        combinava com a identidade. O prédio coral é o destaque da tela.
// (o verde continua, de propósito, no giro de "Carregando" e no selo do cabeçalho — nunca foi
//  disso que a v867 tratou; ela mirava o card de lead e a etiqueta "Atendido há X min".)
const regrasDoCard = (css.match(/\.ui-priority-row[^{]*\{[^}]*\}|\.ui-row-[^{]*\{[^}]*\}/g) || []).join('\n');
assert.ok(regrasDoCard.length > 0, 'sanidade: o card de lead tem CSS próprio');
assert.doesNotMatch(regrasDoCard, /#68ff95/i, 'o verde não pode voltar pro card de lead');
assert.doesNotMatch(app, /cp788-att-time/, 'a etiqueta verde "Atendido há X min" não pode voltar');

console.log('v863-cards-padronizados: ok');
