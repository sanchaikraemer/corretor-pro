import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1124 — pedido do dono: a Home mostrava 5 números (Fazer agora, Total de leads, Agenda,
// Aguardando cliente, Sem atender 30d+) e nenhum deles dizia quantos contatos estão ARQUIVADOS.
// Entrou um sexto card, "Arquivados", que abre a tela de arquivados ao ser tocado.
//
// A armadilha que este teste protege: a Home recebe SÓ a carteira ativa (_processarDashboard
// filtra o arquivado antes de chamar renderResumoDia). Contar o arquivado a partir de `items`
// ou de `ativos` daria SEMPRE zero. A conta precisa sair de state.todosLeads.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const src = app.match(/renderResumoDia = function\(items\)\{[\s\S]*?\n\};/)[0];

// 1) O card existe, mostra o número e leva pra tela de arquivados.
assert.match(src, /<span>Arquivados<\/span>/, 'a Home precisa ter o card "Arquivados"');
assert.match(src, /onclick="show\('arquivados'\)"[^>]*><span>Arquivados<\/span><div><b>\$\{arquivados\}<\/b>/,
  'o card "Arquivados" precisa mostrar a contagem e abrir a tela de arquivados no toque');

// 2) A contagem vem da carteira INTEIRA (state.todosLeads), nunca da lista de ativos.
const linhaConta = src.match(/const arquivados=[^\n]+/)[0];
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
    `${linhaConta}\nreturn arquivados;`);
  return fn(state, normalizarEtapa, ETAPA_ARQUIVADO);
}
assert.equal(contarArquivados([{ etapa: 'Geladeira' }, { etapa: 'Ativo' }, { etapa: 'Geladeira' }]), 2,
  'conta só os arquivados');
assert.equal(contarArquivados([{ etapa: 'Ativo' }, { etapa: 'Ativo' }]), 0, 'nenhum arquivado → 0');
assert.equal(contarArquivados(null), 0, 'sem carteira carregada o card mostra 0, não quebra a tela');

// 4) O painel da Home passou de 5 pra 6 colunas no desktop — senão o card novo cai sozinho
//    numa segunda linha, esticado na largura toda.
assert.match(css, /#home \.resumo-dia\{display:grid!important;grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/,
  'o painel de números da Home precisa de 6 colunas no desktop (são 6 cards agora)');

console.log('v1124-card-arquivados-na-home: ok');
