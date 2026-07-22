import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v917 — pedido do dono (print da toolbar do lead): os 7 botões de ação ficavam em 2 linhas
// desiguais (4 numa linha, 3 na outra, esta última mais LARGA que a de cima porque o flex-wrap
// esticava os 3 sobrando pra preencher o espaço). Escolhido o "Modelo 2": "Voltar" entra na
// mesma barra dos outros ícones, formando 8 botões — um grid fixo de 4 colunas fecha em
// exatamente 2 linhas iguais, sem sobra e sem nada esticado.

// 1. "Voltar" agora é o PRIMEIRO item DENTRO de .cp704-toolbar (não mais um irmão antes dela).
const abreToolbar = app.indexOf('<div class="cp704-toolbar">');
assert.ok(abreToolbar >= 0, 'não achei a abertura de .cp704-toolbar');
const trecho = app.slice(abreToolbar, abreToolbar + 400);
assert.match(trecho, /^<div class="cp704-toolbar"><button class="cp704-back"/,
  'o botão Voltar (.cp704-back) precisa ser o primeiro filho dentro de .cp704-toolbar');
assert.match(trecho, /<span class="lb">Voltar<\/span><\/button><button type="button" class="cp704-ico"/,
  'depois do Voltar vem direto o próximo ícone (Proposta), sem nada entre os dois');

// 2. A toolbar virou um grid fixo de 4 colunas — todo botão tem exatamente a mesma largura,
// não importa em qual das 2 linhas caiu (o bug do print era a 2ª linha mais larga que a 1ª).
assert.match(app, /\.cp704-toolbar\{display:grid;grid-template-columns:repeat\(4,1fr\);gap:8px\}/,
  'toolbar precisa ser um grid de 4 colunas iguais (não mais flex-wrap)');

// 3. O grid de 4 colunas continua valendo no mobile (é o que fecha 8 ícones em 2 linhas certas).
const mobile = app.match(/@media\(max-width:560px\)\{[\s\S]*?\}\}/)[0];
assert.doesNotMatch(mobile, /\.cp704-ico\{flex:1 1 calc\(25% - 6px\)/,
  'não pode sobrar o flex-basis antigo (esticava a 2ª linha) no mobile');
assert.doesNotMatch(mobile, /\.cp704-back\{justify-self:start\}/,
  'Voltar não é mais filho direto de .cp704-top — justify-self:start solto encolheria ele dentro do grid da toolbar');

// 4. .cp704-back mantém o mesmo visual dos outros ícones (ícone em cima, rótulo embaixo,
// mesma borda/hover) — só mudou de posição, não de estilo.
assert.match(app, /\.cp704-back\{[^}]*flex-direction:column[^}]*min-width:66px/,
  'Voltar continua com o mesmo formato de coluna ícone+rótulo dos demais botões');

console.log('v917-toolbar-modelo2: ok');
