import fs from "node:fs";
import assert from "node:assert/strict";

// v1140 — dia de fogo do dono (05/08/2026, prints na conversa): importação/reanálise morrendo
// SEMPRE aos 92% ("Analisando — validando as três mensagens pelo Cérebro" → "Demorou demais —
// servidor não respondeu" → "Não foi possível analisar") e a Home desistindo da carteira
// ("Carregamento demorou mais que o normal", beco sem saída). Três causas reais no código:
//
//   1) A análise fazia 2 tentativas IGUAIS de 26s no modelo principal. Quando a análise real
//      precisa de mais de 26s (conversa + Cérebro grandes), as duas estouram em sequência —
//      retry conserta erro passageiro, não lentidão. Agora: 1ª tentativa com janela grande no
//      modelo principal; se falhar, 2ª no modelo rápido com o tempo restante (ver v947, refeito).
//
//   2) api/leads-recentes.js (a rota que carrega a carteira INTEIRA) era a única rota pesada
//      FORA do mapa de funções do vercel.json — rodava com o teto padrão, bem menor que 60s,
//      e morria em dia de cache frio/banco lento.
//
//   3) O app esperava a carteira por só 15s (menos que o teto do próprio servidor!), sem nenhuma
//      retentativa, e o vigia da Home aos 9s trocava a tela por um beco sem saída com a busca
//      ainda viva.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const vercelConfig = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

// ── 1. A rota da carteira tem o mesmo teto de 60s das outras rotas pesadas ────────────────────
assert.equal(Number(vercelConfig.functions?.["api/leads-recentes.js"]?.maxDuration), 60,
  "api/leads-recentes.js precisa de maxDuration 60 no vercel.json (era a única pesada de fora)");

// ── 2. O app espera a carteira até 65s (mais que o teto do servidor) e tenta 2x ───────────────
const iniLeads = app.indexOf("async function getLeadsData(");
const fimLeads = app.indexOf("\nasync function restaurarLeadsAntigos", iniLeads);
assert.ok(iniLeads !== -1 && fimLeads > iniLeads, "getLeadsData não encontrada");
const leadsSrc = app.slice(iniLeads, fimLeads);
assert.match(leadsSrc, /fetchComTimeout\(urlLeads, \{ cache:"no-store" \}, 65000\)/,
  "a busca da carteira precisa esperar até 65s (o servidor tem 60)");
const chamadas65 = (leadsSrc.match(/fetchComTimeout\(urlLeads, \{ cache:"no-store" \}, 65000\)/g) || []).length;
assert.equal(chamadas65, 2, "uma queda de rede não pode derrubar a carteira: tem que existir a 2ª tentativa");
assert.match(leadsSrc, /setTimeout\(r, 1500\)/, "respiro curto entre a 1ª e a 2ª tentativa");
// v1146 — a 2ª tentativa virou CONDICIONAL: só quando a 1ª falhou RÁPIDO (tropeço de rede). Se a
// 1ª queimou os 65s inteiros, repetir dobrava a espera e o dono ficava mais de DOIS MINUTOS num
// spinner mudo (prints de 05/08/2026, 19:04→19:06). Esperar 65s pelo servidor continua certo;
// esperar 130s em silêncio, não.
assert.match(leadsSrc, /if\(gastou > 20000\) throw _e1;/,
  "a 2ª tentativa só vale quando a 1ª falhou rápido — senão quem chamou decide o que mostrar");

// ── 3. Espera da Home: relógio na tela desde os 6s, saída aos 12s, beco só no fim ─────────────
// v1146 — o vigia de 9s + beco de 75s virou um relógio de 1s: aos 6s mostra os segundos ("está
// vivo"), aos 12s oferece as saídas SEM cancelar a busca, e o beco final só aos 70s. E nada disso
// depende mais da tela ativa: o texto na área de carregamento é o que manda (antes, se a tela ativa
// não fosse a Home no instante do vigia, a mensagem congelava pra sempre — era o caso do print).
const iniVigia = app.indexOf("const areaCarregando = () => {");
assert.ok(iniVigia !== -1, "vigia da Home não encontrado");
const vigiaSrc = app.slice(iniVigia, iniVigia + 3200);
assert.doesNotMatch(vigiaSrc, /state\?\.active === 'home'/, "a espera não pode mais depender da tela ativa");
assert.match(vigiaSrc, /}, 1000\);/, "o relógio bate de 1 em 1 segundo");
assert.match(vigiaSrc, /if\(seg < 6\) return;/, "abaixo de 6s não muda nada (carregamento normal)");
assert.match(vigiaSrc, /cp-loading-spinner/, "a rodinha continua na tela enquanto a busca está viva");
assert.match(vigiaSrc, /cp-loading-leads/, "a classe de carregamento continua (detecção de skeleton)");
const antesDe12 = vigiaSrc.slice(0, vigiaSrc.indexOf("seg >= 12"));
assert.doesNotMatch(antesDe12, /Abrir Atendimentos/, "as saídas só aparecem a partir dos 12s");
assert.match(vigiaSrc, /seg >= 12[\s\S]*?location\.reload\(\)[\s\S]*?Abrir Atendimentos/,
  "aos 12s aparecem 'tentar de novo' e 'abrir Atendimentos' — sem cancelar a busca");
assert.match(vigiaSrc, /}, 70000\);/, "o beco final fica pro fim do prazo real do servidor");
assert.match(vigiaSrc, /clearInterval\(relogio\); clearTimeout\(watchdogFinal\);/,
  "relógio e beco são desligados quando a carteira chega");

// ── 4. O tempo do cliente cobre o do servidor também na importação ────────────────────────────
// A chamada "analisar" do app espera 150s por tentativa — precisa continuar MAIOR que o
// orçamento da análise no servidor (52s, travado em v947), senão o app desiste com o servidor
// ainda trabalhando.
assert.match(app, /\}, 150000\);/, "a chamada analisar do app segue esperando mais que o orçamento do servidor");

console.log("v1140-importacao-e-carteira-sem-estourar-tempo: ok");
