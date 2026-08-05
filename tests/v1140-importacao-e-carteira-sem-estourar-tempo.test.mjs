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

// ── 3. Vigia da Home em dois estágios: 9s tranquiliza (e segue carregando), beco só aos 75s ───
const iniVigia = app.indexOf("const watchdog = setTimeout(");
assert.ok(iniVigia !== -1, "vigia da Home não encontrado");
const vigiaSrc = app.slice(iniVigia, iniVigia + 2600);
// Estágio 1 (9s): mantém o spinner e a classe de carregamento (homeAindaEmSkeleton depende dela).
assert.match(vigiaSrc, /\}, 9000\);/, "estágio 1 continua aos 9s");
const estagio1 = vigiaSrc.slice(0, vigiaSrc.indexOf("}, 9000);"));
assert.match(estagio1, /cp-loading-spinner/, "aos 9s o spinner CONTINUA na tela (a busca está viva)");
assert.match(estagio1, /cp-loading-leads/, "aos 9s a classe de carregamento continua (detecção de skeleton)");
assert.doesNotMatch(estagio1, /Abrir Atendimentos/, "aos 9s NÃO pode aparecer o beco sem saída");
// Estágio 2 (75s): só depois do prazo real (60s do servidor + retentativa) vem o beco — agora
// com o botão de atualizar a página, que é o que resolve na prática.
assert.match(vigiaSrc, /\}, 75000\);/, "o beco sem saída só aos 75s");
const estagio2 = vigiaSrc.slice(vigiaSrc.indexOf("}, 9000);"));
assert.match(estagio2, /location\.reload\(\)/, "o beco ganhou o botão de atualizar a página");
assert.match(estagio2, /Abrir Atendimentos/, "a saída pra Atendimentos continua existindo");
assert.match(vigiaSrc.slice(0, 400) + app.slice(iniVigia, iniVigia + 4000), /clearTimeout\(watchdog\); clearTimeout\(watchdogFinal\);/,
  "os dois vigias são desligados quando a carteira chega");

// ── 4. O tempo do cliente cobre o do servidor também na importação ────────────────────────────
// A chamada "analisar" do app espera 150s por tentativa — precisa continuar MAIOR que o
// orçamento da análise no servidor (52s, travado em v947), senão o app desiste com o servidor
// ainda trabalhando.
assert.match(app, /\}, 150000\);/, "a chamada analisar do app segue esperando mais que o orçamento do servidor");

console.log("v1140-importacao-e-carteira-sem-estourar-tempo: ok");
