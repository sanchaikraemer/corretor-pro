import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1021 — print do dono no celular: o número da barra de mensagens ("29", "232"...) aparecia por
// CIMA do texto do produto ao lado ("Ren29aissance", "Ev23lutti"). Causa confirmada com uma
// reprodução visual isolada (mesmo CSS, fora do app): no celular a coluna "bar" divide espaço com
// "pr" (produto) na mesma linha do grid — quando o produto tinha nome mais longo, sobrava menos
// de 190px pra barra. Mas chr-track tinha largura FIXA (190px, flex:0 0 auto — nunca encolhe), e
// chr-bar não tinha limite de largura (justify-self:start = tamanho pelo conteúdo, não pela
// coluna) — o conjunto vazava por cima do texto do produto em vez de encolher.

// v1160 — o bloco é achado a partir da regra de DESKTOP do cp-hoje-row, não pelo primeiro
// "@media(max-width:560px)" do arquivo: outras faixas da Home podem ganhar media query antes desta
// (foi o que aconteceu na v1160) e o teste passava a medir o CSS errado.
const iniDesktopRow = app.indexOf('.cp-hoje-row{width:100%');
assert.ok(iniDesktopRow > -1, 'regra desktop do cp-hoje-row não encontrada');
const iniMobile = app.indexOf('@media(max-width:560px){', iniDesktopRow);
assert.ok(iniMobile > -1, 'bloco @media mobile do cp-hoje-row não encontrado');
const fimMobile = app.indexOf('\n      }', iniMobile);
const blocoMobile = app.slice(iniMobile, fimMobile);

// 1. chr-bar não pode mais ultrapassar a largura da própria coluna do grid.
assert.match(blocoMobile, /\.chr-bar\{justify-self:start;gap:9px;max-width:100%;min-width:0\}/,
  'chr-bar precisa ter max-width:100% (nunca passa da coluna) e min-width:0 (pode encolher)');

// 2. chr-track não pode mais ser largura fixa — precisa encolher (flex) quando o espaço aperta.
assert.doesNotMatch(blocoMobile, /\.chr-track\{width:190px\}/,
  'chr-track não pode mais ter largura fixa de 190px no celular (não encolhia, causava a sobreposição)');
assert.match(blocoMobile, /\.chr-track\{width:auto;flex:1 1 40px;min-width:30px\}/,
  'chr-track precisa ser flexível (encolhe até 30px) em vez de um valor fixo');

console.log('v1021-barra-mobile-nao-sobrepoe-produto: ok');
