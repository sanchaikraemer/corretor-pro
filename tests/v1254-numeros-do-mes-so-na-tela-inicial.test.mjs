import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1254 — PEDIDO DO DONO, com print e a linha circulada de vermelho:
//
//   "170 atendidos · 1.356 mensagens / Agosto, do dia 1 até hoje · toque pra ver tudo"
//
// aparecia DENTRO da tela de um cliente, espremida entre o topo do app e os botões do atendimento
// (Voltar / Proposta / Reativar / Mensagens). Número do mês é informação da TELA INICIAL — dentro
// do cliente ele não tem nada a ver com o que está sendo feito ali, e ainda empurra os botões.
//
// A causa: a linha (#cpMesResumo, criada na v1251) nasceu dentro da mesma coluna da Home que já
// tinha uma lista de "some quando o cliente está aberto" — a do bloco #674 — e ninguém a somou a
// essa lista. Todos os vizinhos dela (#resumoDia, o cabeçalho, os contêineres do antigo Top 3) já
// estavam lá; só ela ficou de fora e continuou visível por cima do cliente.
//
// v1347: #top3Area e #filaPrioridade saíram desta conferência porque saíram do app — eram os dois
// contêineres do "Top 3 do dia", que nunca mais foi preenchido e virou código morto. O que segura
// a regra de verdade é a parte 3 daqui de baixo, que lê os blocos da Home direto do index.html.
//
// Este teste tranca a linha na lista, e serve de rede pra qualquer bloco novo que apareça na Home:
// se ele mora na coluna da Home, precisa sumir com o cliente aberto.

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// ── 1. A linha do mês some quando um cliente está aberto ─────────────────────────────────────
const bloco = css.match(/body\.lead-foco-aberto #home \.home-page-heading,[\s\S]*?\{\s*display:\s*none\s*!important;?\s*\}/);
assert.ok(bloco, 'não achei a lista de blocos da Home que somem com o cliente aberto');
assert.match(bloco[0], /body\.lead-foco-aberto #home #cpMesResumo/,
  'a linha "X atendidos · Y mensagens" precisa sumir quando um cliente está aberto — ela é da tela inicial');

// ── 2. Os vizinhos dela continuam na mesma lista (ninguém pode cair fora sem querer) ─────────
for (const id of ['#resumoDia', '#homeRight']) {
  assert.ok(bloco[0].includes(`body.lead-foco-aberto #home ${id}`),
    `${id} precisa continuar sumindo com o cliente aberto`);
}
assert.ok(bloco[0].includes('body.lead-foco-aberto #home .home-page-heading'),
  'o cabeçalho da Home precisa continuar sumindo com o cliente aberto');

// ── 3. Rede geral: todo bloco da coluna da Home tem que estar na lista ───────────────────────
// Pega os ids desenhados dentro de <div class="home-center"> no index.html e cobra que cada um
// apareça na lista acima. Foi exatamente esse passo que faltou na v1251.
const centro = html.match(/<div class="home-grid"><div class="home-center">([\s\S]*?)<div id="leadFocoArea"/);
assert.ok(centro, 'não achei a coluna central da Home (home-center) no index.html');
const idsDoCentro = [...centro[1].matchAll(/<div id="([A-Za-z0-9_-]+)"/g)].map(m => m[1]);
assert.ok(idsDoCentro.length >= 3, `esperava vários blocos na coluna da Home, achei ${idsDoCentro.length}`);

const foraDaLista = idsDoCentro.filter(id => !bloco[0].includes(`#home #${id}`));
assert.deepEqual(foraDaLista, [],
  `estes blocos da tela inicial vão aparecer por cima do cliente aberto (foi o bug da v1251): ${foraDaLista.join(', ')}`);

console.log(`v1254-numeros-do-mes-so-na-tela-inicial: ok (${idsDoCentro.length} blocos da Home conferidos)`);
