import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v863: padronizar o card de lead entre "Fazer agora" (.ui-priority-row / .ui-row-copy) e
// "Atendimentos" (.cp788-att-row / .cp788-att-copy), adotando "Fazer agora" como base:
//   - remover a barra colorida verde da lateral esquerda dos cards de Atendimentos;
//   - igualar o tamanho da fonte do título nas duas telas.
// A cor verde continua existindo SÓ na etiqueta "Atendido há X min" (.cp788-att-time).

// 1) A barra lateral verde de Atendimentos não pode mais existir.
assert.doesNotMatch(
  css,
  /\.cp788-att-row:before/,
  'a barra lateral (.cp788-att-row:before) precisa ser removida'
);

// 2) O título das duas telas precisa ter o MESMO tamanho de fonte.
function fontDoTitulo(seletor){
  // pega a última definição de font-size do seletor (a que vale na cascata)
  const re = new RegExp(seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*?font-size:(\\d+(?:\\.\\d+)?)px', 'g');
  let m, ultimo = null;
  while((m = re.exec(css))) ultimo = Number(m[1]);
  return ultimo;
}
const tituloFazerAgora = fontDoTitulo('.ui-row-copy strong');
const tituloAtendimentos = fontDoTitulo('.cp788-att-copy strong');
assert.equal(tituloFazerAgora, 14, '"Fazer agora" deveria manter o título em 14px (base)');
assert.equal(
  tituloAtendimentos,
  tituloFazerAgora,
  `título de Atendimentos (${tituloAtendimentos}px) precisa igualar o de "Fazer agora" (${tituloFazerAgora}px)`
);

// 3) v867: o verde (#68ff95) foi REMOVIDO desta tela — o dono achou que não combinava com a
// identidade. A etiqueta ficou neutra e o prédio coral virou o destaque da tela.
const regraTag = css.match(/\.cp788-att-time\{[^}]*\}/);
assert.ok(regraTag, 'a etiqueta .cp788-att-time precisa existir');
assert.doesNotMatch(regraTag[0], /#68ff95/i, 'o verde não pode mais estar na etiqueta de status');
const regraRow = css.match(/\.cp788-att-row\{[^}]*\}/);
assert.ok(regraRow, 'a linha .cp788-att-row precisa existir');
assert.doesNotMatch(regraRow[0], /#68ff95/i, 'o card em si não pode ter verde');

console.log('v863-cards-padronizados: ok');
