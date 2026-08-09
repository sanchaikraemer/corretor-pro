import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// --- Item 1: atendimento recente descansa o lead (não volta pra fila de ação) ---
// v906: "Aguardando cliente" tem um significado só — VOCÊ atendeu (copiou msg / marcou) e o
// cliente ainda não respondeu (a bola está com ele). Deixou de ser balde de lead cru/parado.
assert.match(app, /function cpAguardandoResposta\(l\)\{/, 'existe o teste de "atendi e cliente não respondeu"');
// v1071 — "aguardando" agora também exige estar dentro do prazo de descanso (emJanelaDeEspera);
// passado o prazo, o lead "vence" e sai desse balde (ver v906-aguardando-cliente-real.test.mjs).
assert.match(app, /if\(cpAguardandoResposta\(l\) && emJanelaDeEspera\(l\)\) return 'aguardando'/,
  'aguardando = atendi, o cliente não respondeu depois, e ainda está dentro do prazo');

// --- Item 2: resumo do lead sem corte (sem cp705Short no hero) ---
assert.doesNotMatch(app, /cp705Short\(cp705SanitizeFactText\(imped,lead\),\s*180\)/,
  'o resumo do lead não pode mais ser cortado em 180 caracteres');
assert.match(app, /<p>\$\{escapeHtml\(cp705SanitizeFactText\(imped,lead\)\)\}<\/p>/,
  'o resumo do lead deve aparecer inteiro');

// --- Item 3: o funil "passo X de 6" ---
// v889: o dono mandou tirar o funil do cabeçalho do lead ("muitos leads 'avançados' estão longe
// de fechar — o funil não mede qualificação"). No lugar entrou a barra de INTERESSE do cliente.
// v1186: a auditoria achou o resto do funil ainda no arquivo — a função que desenhava o chip e
// ~20 linhas de CSS que nenhuma tela usava, parados desde a v889. Foram removidos. Este item
// deixa de exigir que o código morto exista e passa a exigir que ele NÃO volte.
assert.match(app, /cp704BarraInteresse\(lead\)\}<p>/, 'o hero do lead deve usar a barra de interesse do cliente');
assert.doesNotMatch(app, /cp704JornadaBadge/, 'o chip do funil não pode voltar — o dono mandou tirar na v889');
assert.doesNotMatch(app, /passo \$\{j\.passo\} de 6/, 'nada de "passo X de 6" em lugar nenhum');
assert.doesNotMatch(css, /cp704-etapa-prog/, 'o CSS do funil também sai (ninguém desenha esse chip)');

// --- Item 4: lead não volta sozinho pra Home (auto-refresh travado com lead aberto) ---
assert.match(app, /state\.active === "home" && document\.visibilityState === "visible" && !state\.focoLeadId && !state\.lead\?\.id/,
  'o interval de 3 min não pode rodar com um lead aberto');
assert.match(app, /document\.visibilityState === "visible" && state\.active === "home" && !state\.focoLeadId && !state\.lead\?\.id/,
  'o refresh ao voltar a aba não pode rodar com um lead aberto');
assert.match(app, /function renderHomeFallbackSeguro\(items\)\{[\s\S]*?if\(state\.focoLeadId \|\| state\.lead\?\.id\) return;/,
  'o fallback da Home não pode sobrescrever um lead aberto');

console.log('v818-fixes: ok');
