import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// --- Item 1: atendimento recente descansa o lead (não volta pra fila de ação) ---
// v906: "Aguardando cliente" tem um significado só — VOCÊ atendeu (copiou msg / marcou) e o
// cliente ainda não respondeu (a bola está com ele). Deixou de ser balde de lead cru/parado.
assert.match(app, /function cpAguardandoResposta\(l\)\{/, 'existe o teste de "atendi e cliente não respondeu"');
assert.match(app, /if\(cpAguardandoResposta\(l\)\) return 'aguardando'/,
  'aguardando = atendi e o cliente não respondeu depois');

// --- Item 2: resumo do lead sem corte (sem cp705Short no hero) ---
assert.doesNotMatch(app, /cp705Short\(cp705SanitizeFactText\(imped,lead\),\s*180\)/,
  'o resumo do lead não pode mais ser cortado em 180 caracteres');
assert.match(app, /<p>\$\{escapeHtml\(cp705SanitizeFactText\(imped,lead\)\)\}<\/p>/,
  'o resumo do lead deve aparecer inteiro');

// --- Item 3: etapas com nome fácil, passo e cor esquentando pro verde ---
for(const rotulo of ['Conhecendo','Interessado','Comparando opções','Vendo se cabe no bolso','Negociando','Decidindo']){
  assert.ok(app.includes(rotulo), `etapa "${rotulo}" deve existir na jornada`);
}
assert.match(app, /function cp704JornadaBadge\(lead, mc\)/, 'badge de jornada deve existir');
assert.match(app, /passo \$\{j\.passo\} de 6/, 'badge deve mostrar "passo X de 6"');
// v889: o hero do lead NÃO usa mais o funil "passo X de 6" — usa a barra de interesse do cliente.
assert.match(app, /cp704BarraInteresse\(lead\)\}<p>/, 'o hero do lead deve usar a barra de interesse do cliente');
assert.doesNotMatch(app, /cp704-situation">\$\{cp704JornadaBadge\(lead,mc\)\}/, 'o funil "passo X de 6" saiu do hero');
// Verde no fim da jornada (Decidindo/Vendido) e neutro no começo (Conhecendo).
assert.ok(app.includes("label:'Decidindo',              passo:6, cor:'#2fe27a'"), 'Decidindo deve ser verde vivo');
assert.ok(app.includes("label:'Conhecendo',             passo:1, cor:'#9fb1bd'"), 'Conhecendo deve ser cinza frio');

// --- Item 4: lead não volta sozinho pra Home (auto-refresh travado com lead aberto) ---
assert.match(app, /state\.active === "home" && document\.visibilityState === "visible" && !state\.focoLeadId && !state\.lead\?\.id/,
  'o interval de 3 min não pode rodar com um lead aberto');
assert.match(app, /document\.visibilityState === "visible" && state\.active === "home" && !state\.focoLeadId && !state\.lead\?\.id/,
  'o refresh ao voltar a aba não pode rodar com um lead aberto');
assert.match(app, /function renderHomeFallbackSeguro\(items\)\{[\s\S]*?if\(state\.focoLeadId \|\| state\.lead\?\.id\) return;/,
  'o fallback da Home não pode sobrescrever um lead aberto');

console.log('v818-fixes: ok');
