import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v867: a tela Atendimentos virou duas colunas (lista à esquerda; à direita a "Meta do dia":
// um prédio coral que ENCHE de baixo pra cima conforme os atendimentos do dia, completando
// aos 10). Este teste roda cp788PredioSVG e confere o preenchimento crescente + estado "cheio".

const ini = app.indexOf('function cp788PredioSVG(');
const fim = app.indexOf('function cp788RenderAtendimentos(');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'não localizei cp788PredioSVG');
const fonte = app.slice(ini, fim);

// eslint-disable-next-line no-new-func
const { cp788PredioSVG } = new Function(fonte + '\nreturn { cp788PredioSVG };')();

const alturaClip = (svg) => {
  const m = svg.match(/<clipPath[^>]*><rect[^>]*height="([\d.]+)"/);
  return m ? Number(m[1]) : null;
};

const META = 10;
const s0 = cp788PredioSVG(0, META);
const s3 = cp788PredioSVG(3, META);
const s7 = cp788PredioSVG(7, META);
const s10 = cp788PredioSVG(10, META);
const s12 = cp788PredioSVG(12, META);

// Preenchimento cresce com o número de atendimentos.
assert.ok(alturaClip(s0) < alturaClip(s3), 'passo 0 deve encher menos que 3');
assert.ok(alturaClip(s3) < alturaClip(s7), 'passo 3 deve encher menos que 7');
assert.ok(alturaClip(s7) < alturaClip(s10), 'passo 7 deve encher menos que 10');

// Ao bater a meta, o prédio fica "cheio"; acima da meta continua cheio (clampa em 100%).
assert.doesNotMatch(s7, /class="cp788-predio cheio"/, 'abaixo da meta não é "cheio"');
assert.match(s10, /class="cp788-predio cheio"/, 'na meta (10) precisa ficar "cheio"');
assert.match(s12, /class="cp788-predio cheio"/, 'acima da meta continua "cheio"');
assert.equal(alturaClip(s10), alturaClip(s12), 'acima da meta o preenchimento clampa em 100%');

// Coral do app no preenchimento (não inventa cor).
assert.match(s3, /fill="var\(--accent\)"/, 'o prédio precisa encher com o coral do app (var(--accent))');

// A tela usa o layout de duas colunas + resumo por dia.
const rend = app.slice(fim, fim + 4000);
assert.match(rend, /cp788-att-layout/, 'a tela precisa usar o layout de duas colunas');
assert.match(rend, /cp788-meta-card/, 'precisa ter o card da meta com o prédio');
assert.match(rend, /2 dias atrás/, 'precisa ter o resumo por dia (hoje/ontem/2 dias/3+)');

console.log('v867-predio-atendimentos: ok');
