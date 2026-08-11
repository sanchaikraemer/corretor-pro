import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1216 — print do dono no detalhe do cliente: *"ainda tem um tom verde, olha ali no atendido"*.
//
// A v1214 tirou o verde-lima e o rosa das telas, mas fez a troca cor por cor de uma LISTA — e o
// botão "Atendido" tinha o verde escrito de outro jeito (rgba(112,212,157,…) no fundo e na borda),
// então passou batido: só o texto virou token e o botão continuou esverdeado.
//
// Esta guarda não depende mais de lista: varre o código de verdade e reprova QUALQUER cor cravada
// em que o canal verde domina os outros dois — que é a definição de "está verde na tela". Cor de
// status entra por token (--acao / --risco); a única exceção é o verde da marca do WhatsApp, que é
// logo de terceiro e não faz parte da paleta do app.

const arquivos = ['app.js', 'styles.css', 'index.html', 'js/importacao.js'];
// Comentários citam de propósito as cores que saíram (é o registro do que mudou e por quê).
const semComentarios = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Verde da marca do WhatsApp (ícone/CTA do app de mensagem) — permitido.
const WHATSAPP = new Set(['25d366', '1fb65b', '20ba5a', 'a6e800', '37,211,102', '31,182,91', '166,224,0']);

const puxaProVerde = (r, g, b) => g > r + 25 && g > b + 25 && g > 110;
const achados = [];

for (const arquivo of arquivos) {
  const src = semComentarios(fs.readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8'));

  for (const m of src.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const hex = m[1].toLowerCase();
    if (WHATSAPP.has(hex)) continue;
    const [r, g, b] = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((c) => parseInt(c, 16));
    if (puxaProVerde(r, g, b)) achados.push(`${arquivo}: #${hex}`);
  }

  for (const m of src.matchAll(/rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})/g)) {
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    if (WHATSAPP.has(`${r},${g},${b}`)) continue;
    if (puxaProVerde(r, g, b)) achados.push(`${arquivo}: ${m[0]})`);
  }
}

assert.equal(
  achados.length,
  0,
  `verde cravado no código (use var(--acao)/var(--risco) da paleta):\n  ${achados.join('\n  ')}`
);

// O botão "Atendido" do topo do cliente — o do print — precisa das três pontas em token: se só uma
// delas virar token, o botão continua esverdeado como estava.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const done = app.match(/\.cp704-ico\.done\{([^}]*)\}/);
assert.ok(done, 'não achei a regra do botão "Atendido" (.cp704-ico.done)');
for (const parte of ['background:var(--acao-soft)', 'border-color:var(--acao-line)', 'color:var(--acao)']) {
  assert.ok(done[1].includes(parte), `o botão "Atendido" precisa de ${parte}`);
}

console.log('v1216-sem-verde-cravado: ok');
