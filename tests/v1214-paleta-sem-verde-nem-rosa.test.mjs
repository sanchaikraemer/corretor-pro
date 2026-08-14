import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1214 — o dono, olhando a Home: *"to achando o layout muito feio... esse verde nao combina... ja
// vi umas cor rosa na agenda tb, nada a ver... fora da paleta essas cores"*.
//
// A identidade do app (petróleo + coral, com o ciano dos dados) tinha ganhado, ao longo das
// versões, um verde-lima (#68FF95 / rgba(104,255,149,…)), um rosa (#E89BB7) e um vermelho de
// iPhone (#ff3b30) cravados no meio das telas. Esta guarda existe pra isso não voltar: cor de
// status só entra por TOKEN, e nenhum verde/rosa fora da paleta pode ser cravado no código.

const arquivos = ['app.js', 'styles.css', 'index.html', 'js/importacao.js'];
// Os comentários citam as cores antigas de propósito (é o registro do que saiu e por quê), então a
// varredura olha só o código de verdade.
const semComentarios = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const fontes = arquivos.map(a => [a, semComentarios(fs.readFileSync(new URL(`../${a}`, import.meta.url), 'utf8'))]);

// Cores que foram embora: se alguma reaparecer cravada, o teste aponta o arquivo.
const PROIBIDAS = [
  ['rgba(104,255,149', 'verde-lima de fundo/borda'],
  ['#68ff95', 'verde-lima'],
  ['#bdffd0', 'verde claro de texto'],
  ['rgba(185,255,59', 'lima-amarelado'],
  ['#EC85B0', 'rosa'],
  ['#E89BB7', 'rosa'],
  ['#B85A7D', 'rosa escuro'],
  ['#F07F8E', 'salmão'],
  ['#ff3b30', 'vermelho de iPhone'],
  ['rgba(255,59,48', 'vermelho de iPhone'],
  ['rgba(255,91,122', 'vermelho-rosado'],
  ['rgba(255,107,107', 'vermelho-rosado']
];
for (const [arquivo, src] of fontes) {
  const alvo = src.toLowerCase();
  for (const [cor, oQue] of PROIBIDAS) {
    assert.ok(!alvo.includes(cor.toLowerCase()), `${arquivo}: ${oQue} (${cor}) não pode voltar cravado — use os tokens --acao/--risco`);
  }
}

// Os tokens existem no tema do app.
// v1268 — eram DOIS temas até aqui; o tema claro foi removido do sistema por ordem do dono, então
// a varredura passou a valer só pro escuro, que é o único que existe. A checagem em si não mudou.
const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
assert.doesNotMatch(styles, /data-theme="light"/, 'o tema claro não pode voltar ao CSS (v1268)');
function bloco(seletor, fim = 'color-scheme'){
  const i = styles.indexOf(seletor);
  assert.ok(i > -1, `não achei o bloco ${seletor}`);
  return styles.slice(i, styles.indexOf(fim, i));
}
for (const [nome, seletor] of [['escuro', 'html[data-theme="dark"]{']]) {
  const b = bloco(seletor);
  for (const token of ['--acao:', '--acao-soft:', '--acao-line:', '--timing:', '--risco:', '--risco-soft:', '--risco-line:']) {
    assert.ok(b.includes(token), `tema ${nome} precisa definir ${token}`);
  }
  // Nada de verde nem rosa nos tokens de status: confirmação/agenda seguem a família do ciano.
  const acao = b.match(/--acao:\s*(#[0-9A-Fa-f]{6})/)[1];
  const timing = b.match(/--timing:\s*(#[0-9A-Fa-f]{6})/)[1];
  const dados = b.match(/--dados:\s*(#[0-9A-Fa-f]{6})/)[1];
  const canal = (hex) => ({ r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) });
  for (const [nomeToken, hex] of [['--acao', acao], ['--timing', timing]]) {
    const { r, g, b: azul } = canal(hex);
    assert.ok(azul >= g, `tema ${nome}: ${nomeToken} (${hex}) puxou pro verde — na paleta ele é da família do ciano`);
    assert.ok(azul > r, `tema ${nome}: ${nomeToken} (${hex}) não é da família do ciano`);
  }
  assert.equal(canal(acao).b >= canal(dados).b - 40, true, `tema ${nome}: --acao deveria conversar com o ciano dos dados (--dados)`);
}

// A faixa "Hoje na agenda" da Home (a tela do print) não pode ter cor cravada.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const faixa = app.match(/\.cp1168-faixa\{[^}]*\}/)[0];
assert.match(faixa, /border:1px solid var\(--acao-line\);background:var\(--acao-soft\)/, 'a faixa da Home precisa usar os tokens');
assert.match(app, /\.cp1168-tit\{color:var\(--acao\)/, 'o título da faixa precisa usar o token');
assert.match(app, /\.cp1168-hora\{[^}]*color:var\(--acao\)/, 'o horário da faixa precisa usar o token');

console.log('v1214-paleta-sem-verde-nem-rosa: ok');
