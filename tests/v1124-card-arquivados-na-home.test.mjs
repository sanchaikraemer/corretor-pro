import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1124 — pedido do dono: nenhum número da Home dizia quantos contatos estão ARQUIVADOS. Entrou um
// card "Arquivados" que abre a tela de arquivados ao ser tocado.
//
// v1246 — o CARD saiu da fileira e virou botão no bloco do topo (modelo B, escolhido por ele). O
// que este teste protege NÃO mudou de lugar junto: a Home recebe SÓ a carteira ativa
// (_processarDashboard filtra o arquivado antes de renderizar). Contar arquivado a partir de
// `items` ou de `ativos` daria SEMPRE zero. A conta precisa sair de state.todosLeads — e essa
// armadilha continua existindo agora que a conta mora em cp1246AtualizarBlocoTopo.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const src = app.match(/function cp1246AtualizarBlocoTopo\(\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(src, 'a função que preenche os números do topo precisa existir');

// 1) Dá pra ver o número e dá pra entrar na tela — o pedido original dele, na casa nova.
assert.match(html, /id="btnArquivadosTopo"[^>]*onclick="show\('arquivados'\)"/,
  'o botão dos arquivados precisa abrir a tela de arquivados no toque');
assert.match(html, /id="cpArquivadosTopoN"/, 'e mostrar a contagem ao lado do ícone');
assert.match(src, /cpArquivadosTopoN/, 'a função precisa escrever nesse número');

// 2) A contagem vem da carteira INTEIRA (state.todosLeads), nunca da lista de ativos.
const linhaConta = src.match(/n = \(state\.todosLeads.*?\.length;/)?.[0];
assert.ok(linhaConta, 'a linha que conta os arquivados precisa existir');
assert.match(linhaConta, /state\.todosLeads/,
  'a contagem de arquivados precisa sair de state.todosLeads (a Home só recebe os ativos)');
assert.doesNotMatch(linhaConta, /\bativos\b|\bitems\b/,
  'contar arquivados dentro de ativos/items daria sempre zero');
assert.match(linhaConta, /ETAPA_ARQUIVADO/,
  'o arquivado é identificado pela etapa ETAPA_ARQUIVADO, normalizada');

// 3) Comportamento da conta, isolado: só entra quem está arquivado; sem carteira carregada, 0.
function contarArquivados(todosLeads) {
  const normalizarEtapa = e => String(e || '').trim();
  const ETAPA_ARQUIVADO = 'Geladeira';
  const state = { todosLeads };
  const fn = new Function('state', 'normalizarEtapa', 'ETAPA_ARQUIVADO',
    `let ${linhaConta}\nreturn n;`);
  return fn(state, normalizarEtapa, ETAPA_ARQUIVADO);
}
assert.equal(contarArquivados([{ etapa: 'Geladeira' }, { etapa: 'Ativo' }, { etapa: 'Geladeira' }]), 2,
  'conta só os arquivados');
assert.equal(contarArquivados([{ etapa: 'Ativo' }, { etapa: 'Ativo' }]), 0, 'nenhum arquivado → 0');
assert.equal(contarArquivados(null), 0, 'sem carteira carregada mostra 0, não quebra a barra');

// 4) E a barra não pode quebrar quando a tela ainda nem carregou: os dois números do topo são
//    escritos dentro de try, com 0 de reserva.
assert.match(src, /try\{[\s\S]*?\}catch\(_\)\{\}/,
  'um erro na conta não pode derrubar a barra de cima');

console.log('v1124-card-arquivados-na-home: ok');
