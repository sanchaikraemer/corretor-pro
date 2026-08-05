import fs from "node:fs";
import assert from "node:assert/strict";

// v1147 — print do dono: ele mudou a meta pra 20 atendimentos/dia no Cérebro e a tela
// "Atendimentos" continuou dizendo "meta 10/dia", com o prédio JÁ CHEIO em "20/10". Palavras dele:
// "o prédio deve ficar cheio somente quando atender 20, que é pré-definido, não acha?".
//
// Causa: a meta desta tela estava CRAVADA em 10 (const CP788_META_DIA = 10), enquanto o card
// "Fazer agora" usava a meta do Cérebro (cpMetaAtendimentosDia). Duas fontes pra mesma regra.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ── 1. A meta da tela Atendimentos vem do Cérebro, não do código ──────────────────────────────
assert.doesNotMatch(app, /const CP788_META_DIA = 10;/, "a meta não pode voltar a ser cravada em 10");
assert.match(app, /const cp788MetaDia = \(\) => \(typeof cpMetaAtendimentosDia === 'function'\) \? cpMetaAtendimentosDia\(\) : 10;/,
  "a tela usa a MESMA meta do 'Fazer agora' (a do Cérebro), com 10 só como último recurso");

// ── 2. É lida na hora de desenhar (mudar a meta vale sem recarregar o app) ─────────────────────
assert.match(app, /const CP788_META_DIA = cp788MetaDia\(\);/, "a meta é lida no momento do desenho");
{
  const ini = app.indexOf("const cp788MetaDia = ");
  const usoNoDesenho = app.indexOf("const CP788_META_DIA = cp788MetaDia();");
  assert.ok(ini > -1 && usoNoDesenho > ini, "a função existe antes do desenho que a usa");
}

// ── 3. Prédio, contador e texto usam a MESMA meta ─────────────────────────────────────────────
const trecho = app.slice(app.indexOf("const CP788_META_DIA = cp788MetaDia();"), app.indexOf("cp788-att-empty"));
assert.match(trecho, /meta \$\{CP788_META_DIA\}\/dia/, "o texto do topo mostra a meta do corretor");
assert.match(trecho, /bateu=n>=CP788_META_DIA/, "o dia só é 'batido' ao alcançar a meta do corretor");
assert.match(trecho, /cp788PredioSVG\(n, CP788_META_DIA\)/, "o prédio enche na régua da meta do corretor");
assert.match(trecho, /<b>\$\{n\}<\/b>\/\$\{CP788_META_DIA\}/, "o contador mostra a meta do corretor");

// ── 4. A meta do Cérebro é a mesma usada pelo "Fazer agora" (uma fonte só) ────────────────────
assert.match(app, /function cpMetaAtendimentosDia\(\)\{[\s\S]*?Number\(cfg\?\.atendimentosPorDia\)/,
  "cpMetaAtendimentosDia continua lendo 'atendimentos por dia' do Cérebro");
assert.match(app, /function cpFazerAgoraDose\(items\)\{ return cpFimDeSemana\(\) \? 0 : Math\.max\(0, cpMetaAtendimentosDia\(\)/,
  "e o card 'Fazer agora' usa a mesma função — as duas telas nunca mais discordam");

console.log("v1147-meta-do-predio-vem-do-cerebro: ok");
