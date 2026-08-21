import fs from "node:fs";
import assert from "node:assert/strict";

// v1345 — OS TRÊS PEDIDOS DO DONO DE 21/08/2026, COM PRINT DE CADA UM.
//
//   1. (09h50) "descentralizado da tela a parte central do carregamento" — e "está demorando
//      demais pra carregar";
//   2. (09h52) o espaço vazio da ficha do cliente circulado em vermelho: "quero q ai apareça as 2
//      últimas mensagens trocadas q constam no histórico do lead aberto";
//   3. (09h52) o número de mensagens e o "atendido há 8d" da lista da Home circulados: "fora de
//      enquadramento e proporcionalidade".

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const persistencia = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");

// ── 1a. O aviso de carregamento ocupa a largura toda enquanto está na tela ───────────────────
// A rodinha sempre esteve centralizada — dentro da PRIMEIRA COLUNA da Home (~866px de ~1240px
// úteis). Com a segunda coluna vazia durante o carregamento, o conjunto ficava visivelmente à
// esquerda. Medido no navegador: rodinha em x=743 numa área cujo centro é x=902.
assert.match(css, /#home \.home-grid:has\(\.cp-loading-leads\)\{grid-template-columns:minmax\(0,1fr\)!important\}/,
  "a versão com #home é a que ganha do bloco de desktop, que também usa #home + !important");
assert.match(css, /^\.home-grid:has\(\.cp-loading-leads\)\{grid-template-columns:minmax\(0,1fr\)!important\}/m,
  "e a versão sem #home cobre a lista desenhada fora da tela inicial");
{
  // A regra precisa estar DEPOIS de todos os outros blocos que mandam nas colunas da Home —
  // senão perde por ordem, que foi o que aconteceu na primeira tentativa desta correção.
  const minha = css.lastIndexOf("#home .home-grid:has(.cp-loading-leads)");
  const outros = [...css.matchAll(/\.home-grid\{[^}]*grid-template-columns/g)].map(m => m.index);
  assert.ok(outros.length > 0, "sanidade: existem outros blocos definindo as colunas da Home");
  assert.ok(minha > Math.max(...outros),
    "a regra do carregamento precisa vir depois de todos os outros blocos de .home-grid");
}

// ── 1b. A primeira abertura do dia não paga mais a carteira inteira ──────────────────────────
// O cache por lead vence por DIA: à meia-noite ele vence pra carteira toda de uma vez, e a
// primeira abertura recalculava tudo. O print veio às 09h50 — primeira abertura do dia dele.
assert.match(persistencia, /const STATS_TIMELINES_POR_CARGA = [\s\S]*?: 60;/,
  "o teto de conversas lidas por carga caiu de 150 pra 60");
assert.match(persistencia, /const STATS_CACHE_WRITE_BUDGET_MS = 2500;/,
  "as gravações de cache não podem segurar a resposta por 6 segundos — a resposta já está pronta antes delas");
{
  // Os lotes de 50 conversas iam um depois do outro: três idas ao banco somadas, justamente na
  // abertura mais cara do dia. Agora vão juntos.
  const bloco = persistencia.slice(persistencia.indexOf("const timelinesBuscadas = new Map();"));
  const trecho = bloco.slice(0, bloco.indexOf("// Mesmo formato nos dois lugares"));
  assert.match(trecho, /await Promise\.all\(fatias\.map\(/,
    "os lotes de conversa precisam ir ao banco em paralelo");
  assert.ok(!/for \(let i = 0; i < precisamTimeline\.length; i \+= 50\) \{\s*const fatia[\s\S]{0,120}await supabase/.test(trecho),
    "não pode voltar a ser um lote esperando o outro");
}

// ── 2. As duas últimas mensagens trocadas, dentro da ficha ───────────────────────────────────
const fonte = [
  app.match(/function cp1345UltimasMensagens\(lead, quantas = 2\)\{[\s\S]*?\n  \}/)[0],
  app.match(/function cp1345UltimasMensagensHTML\(lead\)\{[\s\S]*?\n  \}/)[0]
].join("\n");
const { cp1345UltimasMensagens, cp1345UltimasMensagensHTML } = new Function(
  "escapeHtml", "cpMensagemEhDoCliente",
  `${fonte}\nreturn { cp1345UltimasMensagens, cp1345UltimasMensagensHTML };`
)(
  (t) => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  (l, m) => String(m.author || "").toLowerCase().includes(String(l.name || "").toLowerCase().split(" ")[0])
);

const lead = {
  name: "Alessandra Ribeiro",
  recentMessages: [
    { author: "Miguel Kirinus", text: "Bom dia! Já te mando as fotos", date: "20/08/2026", time: "18:10" },
    { author: "Miguel", text: "Fiz a visita, gostou muito", date: "21/08/2026", time: "07:00", source: "manual", type: "visita" },
    { author: "Alessandra Ribeiro", text: "É pra morar sim, fico no aguardo das fotos", date: "21/08/2026", time: "07:42" },
    { author: "Miguel Kirinus", text: "Perfeito! Te mando ainda hoje.", date: "21/08/2026", time: "09:43" }
  ]
};

const duas = cp1345UltimasMensagens(lead, 2);
assert.equal(duas.length, 2, "são as duas últimas");
assert.deepEqual(duas.map(m => m.time), ["07:42", "09:43"], "na ordem da conversa, a mais antiga em cima");

// Observação que o corretor registrou (visita, ligação, nota) NÃO é mensagem trocada — é anotação
// dele. Se entrasse, empurraria pra fora uma fala de verdade do cliente.
assert.ok(!duas.some(m => m.type === "visita"), "anotação do corretor não é mensagem trocada");

const html = cp1345UltimasMensagensHTML(lead);
assert.match(html, /Últimas mensagens da conversa/);
assert.match(html, /Alessandra · 21\/08\/2026 07:42/, "diz quem falou e quando");
assert.match(html, /Você · 21\/08\/2026 09:43/, "a fala do corretor aparece como 'Você'");
assert.match(html, /class="cp1345-msg do-cliente"/, "a fala do cliente é destacada");
assert.ok(!html.includes("Fiz a visita"), "a anotação não pode aparecer no bloco");

// Conversa curta e conversa vazia não podem quebrar nem inventar bloco.
assert.equal(cp1345UltimasMensagensHTML({ name: "X", recentMessages: [] }), "", "sem mensagem, sem bloco");
assert.match(cp1345UltimasMensagensHTML({ name: "X", recentMessages: [{ author: "X", text: "oi", date: "21/08/2026", time: "10:00" }] }),
  /Última mensagem da conversa/, "com uma só, o título fica no singular");

// E o bloco precisa estar montado na ficha, logo abaixo das linhas de data.
assert.match(app, /Última mensagem — \$\{ultimaMsgConversaEm\}`\)\}<\/div>`:''\}\s*\$\{cp1345UltimasMensagensHTML\(lead\)\}/,
  "o bloco entra logo abaixo de 'Última mensagem', que é onde o dono circulou");
assert.match(app, /\.cp1345-msg span\{[^}]*-webkit-line-clamp:2/,
  "cada mensagem mostra no máximo duas linhas — a ficha não pode virar o histórico");

// ── 3. A coluna da direita da lista cabe no que ela mostra ───────────────────────────────────
// Era 42px pra um texto de 97px. Como o texto é alinhado à direita, o excesso vazava PRA ESQUERDA,
// por cima do número da barra — que é o embolado que ele circulou.
assert.match(app, /grid-template-columns:minmax\(0,1\.05fr\) minmax\(0,\.7fr\) 240px 104px/,
  "a coluna dos dias precisa caber 'atendido há 100d' (97px medidos no navegador)");
assert.ok(!/240px 42px/.test(app), "a largura antiga não pode voltar");
assert.match(app, /@media\(min-width:561px\) and \(max-width:1199px\)\{\s*\.cp-hoje-row\{grid-template-columns:minmax\(0,1\.15fr\) minmax\(0,\.6fr\) 150px 104px/,
  "em tela média a barra encolhe primeiro — o nome do cliente é o que não pode sumir");

console.log("v1345-tela-do-dono-21-08: ok");
