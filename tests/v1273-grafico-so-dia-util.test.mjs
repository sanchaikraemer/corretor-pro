import fs from "node:fs";
import assert from "node:assert/strict";
// v1337 — o fuso do app saiu de 35 literais "America/Sao_Paulo" e virou cpFuso(). Este import
// entrega as funções REAIS de fuso do app.js pros trechos que este teste roda com eval.
import "./_fuso-do-app.mjs";

// v1273 — SÁBADO E DOMINGO SAEM DO GRÁFICO "CLIENTES ATENDIDOS POR DIA".
//
// Print do dono com as barras do fim de semana circuladas em vermelho: "quero q tire desse gráfico
// sábado e domingo, senão parece q não trabalhei, e realmente, pq é final de semana, mas então não
// considere final de semana."
//
// O gráfico desenhava TODO dia do mês. Como ele não atende no fim de semana, o mês virava um
// serrote: dois zeros a cada cinco barras. Quem bate o olho lê queda de produção — quando é só o
// calendário existindo.
//
// Duas travas moram aqui: (1) fim de semana sem atendimento não é desenhado; (2) fim de semana em
// que ele ATENDEU alguém continua no gráfico — apagar isso seria apagar trabalho que existiu, o
// contrário do que ele pediu.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ── 1. Cada dia sabe a data dele (sem isso não dá pra saber o que é fim de semana) ─────────────
const dados = app.slice(app.indexOf("function cp1251Dados(){"));
const blocoDados = dados.slice(0, dados.indexOf("\n}"));
// v1337 — o fuso virou cpFuso() (fuso salvo da conta, padrão Brasília). A regra guardada aqui é a
// mesma de sempre: o dia da semana NÃO pode sair do relógio do aparelho.
assert.match(blocoDados, /timeZone:cpFuso\(\), weekday:"short"/,
  "o dia da semana vem do fuso do corretor, não do relógio do aparelho");
assert.match(blocoDados, /fds: sigla === "Sat" \|\| sigla === "Sun"/,
  "cada dia marca se é sábado ou domingo");
assert.match(blocoDados, /qtd: s\.size, dia: i \+ 1/,
  "cada dia leva junto quantos clientes teve e que dia do mês é");

// ── 2. O desenho tira o fim de semana — mas não o fim de semana trabalhado ─────────────────────
const grafico = app.slice(app.indexOf("function cp1251GraficoHTML(porDia){"));
const blocoGrafico = grafico.slice(0, grafico.indexOf("\n}"));
assert.match(blocoGrafico, /const dias = porDia\.filter\(d => !d\.fds \|\| d\.qtd > 0\);/,
  "sai o fim de semana vazio; fim de semana com atendimento fica");
assert.match(blocoGrafico, /if\(!dias\.length\) return "";/,
  "mês sem nenhum dia útil desenhado não pode quebrar a tela");
assert.match(blocoGrafico, /const maior = Math\.max\(1, \.\.\.dias\.map\(d => d\.qtd\)\);/,
  "a altura das barras é medida só entre os dias que aparecem");

// ── 3. A legenda não pode mentir ──────────────────────────────────────────────────────────────
// Quando hoje é sábado ou domingo sem atendimento, hoje sai do gráfico — e escrever "hoje" na
// ponta direita apontaria pra sexta-feira.
assert.match(blocoGrafico, /\$\{fim\.hoje \? "hoje" : "dia " \+ fim\.dia\}/,
  "a ponta direita só diz 'hoje' se hoje estiver desenhado");
assert.match(blocoGrafico, /<span>dia \$\{dias\[0\]\.dia\}<\/span>/,
  "a ponta esquerda nomeia o primeiro dia desenhado, que pode não ser o dia 1");
assert.match(blocoGrafico, /Clientes atendidos por dia útil/,
  "o título diz que o gráfico é de dia útil — senão o número some sem explicação");

// ── 4. Os NÚMEROS do painel continuam contando tudo ───────────────────────────────────────────
// Só o desenho muda. Atendimento feito num sábado continua valendo no "Clientes atendidos" do mês,
// e as mensagens trocadas também — a v1273 é sobre leitura do gráfico, não sobre descartar dado.
assert.match(blocoDados, /atendidosMes: base\.filter\(ehAtendidoNoMes\)\.length/,
  "o total do mês continua vindo de todos os dias");
assert.doesNotMatch(blocoDados, /fds.*continue|if\(.*fds.*\) *continue/,
  "nada é descartado na hora de CONTAR — a filtragem é só no desenho");

console.log("v1273-grafico-so-dia-util: ok");
