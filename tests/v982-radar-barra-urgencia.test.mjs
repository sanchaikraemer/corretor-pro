import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v982 — pedido do dono: nas "Oportunidades esquecidas" da Home, destacar visualmente o quanto
// cada lead está atrasado (não só em texto). Cada linha ganha uma barrinha colorida embaixo,
// escalada pelos dias parado, usando as MESMAS cores semânticas que o app já tem
// (--risco = muito atrasado, --morno = atrasado, --soft = ainda recente) — nenhuma cor nova.

const sevSrc = app.match(/function radarSeveridade\(parado\)\{[\s\S]*?\n\}/);
assert.ok(sevSrc, 'não encontrei radarSeveridade em app.js');
const radarSeveridade = eval(`${sevSrc[0]}\nradarSeveridade`);

// 1. Muito parado (6+ meses) → cor de risco, barra praticamente cheia.
const alta = radarSeveridade(612);
assert.equal(alta.cor, 'var(--risco)', '612 dias parado precisa usar a cor de risco (muito atrasado)');
assert.equal(alta.pct, 100, 'acima de 365 dias, a barra fica no máximo (100%)');

// 2. Atrasado, mas não tanto (60-179 dias) → cor morna, barra intermediária.
const media = radarSeveridade(168);
assert.equal(media.cor, 'var(--morno)', '168 dias parado precisa usar a cor morna (atrasado, não crítico)');
assert.ok(media.pct > 40 && media.pct < 50, `168/365 dias deve dar uma barra por volta de 46%, veio ${media.pct}`);

// 3. Recém "esquecido" (7-59 dias) → cor neutra (--soft), barra fina mas visível.
const baixa = radarSeveridade(7);
assert.equal(baixa.cor, 'var(--soft)', '7 dias parado ainda é recente, cor neutra');
assert.ok(baixa.pct >= 4, 'mesmo pouco parado, a barra precisa ter um mínimo visível (nunca some)');

// 4. Nunca estoura 100%, mesmo com anos parado.
const anos = radarSeveridade(2000);
assert.equal(anos.pct, 100, 'a barra tem teto em 100%, não estica pra sempre');

// 5. radarRowHTML precisa usar radarSeveridade tanto na barra quanto na cor do número de dias
// (antes disso, o número era sempre neutro — var(--soft) fixo — sem distinguir urgência real).
const rrhSrc = app.match(/function radarRowHTML\(l\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(rrhSrc, /style="color:var\(--soft\)"/, 'a cor do número de dias não pode mais ser fixa — precisa refletir a severidade');
assert.match(rrhSrc, /const sev = radarSeveridade\(parado\)/, 'radarRowHTML precisa calcular a severidade do lead');
assert.match(rrhSrc, /class="radar-bar"><i style="width:\$\{sev\.pct\}%;background:\$\{sev\.cor\}"/, 'a linha precisa renderizar a barra de urgência, com largura e cor vindas de radarSeveridade');
assert.match(rrhSrc, /class="radar-rec" style="color:\$\{sev\.cor\}"/, 'o número de dias parado precisa usar a cor da severidade, não mais uma cor fixa');

// 6. CSS da barra existe (trilho + preenchimento).
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
assert.match(css, /\.radar-bar\{[^}]*height:3px[^}]*\}/, 'estilo do trilho da barra de urgência precisa existir em styles.css');
assert.match(css, /\.radar-bar i\{[^}]*height:100%[^}]*\}/, 'estilo do preenchimento da barra de urgência precisa existir em styles.css');

console.log('v982-radar-barra-urgencia: ok');
