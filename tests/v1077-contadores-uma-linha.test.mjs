import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1077 — modelo 1 escolhido pelo dono pros contadores da Home na versão web: os 5 cards
// ("Fazer agora", "Total de leads", "Agenda", "Aguardando cliente", "Sem atender 30d+")
// numa LINHA SÓ no computador, mais compactos e SEM os iconezinhos. No celular nada muda
// (as regras de telas menores continuam as mesmas).

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// Os cards que SOBRARAM continuam com os destinos certos. A fileira foi encolhendo de propósito:
// v1232 tirou "Agenda" (foi pro bloco do topo) e v1246 tirou "Arquivados" e "Bloco de notas" pelo
// mesmo caminho, e apagou "Sem atender 30d+" a pedido do dono. Ver
// tests/v1246-notas-e-arquivados-no-topo.test.mjs.
for (const destino of ['abrirFazerAgora()', 'abrirCarteiraAtiva()', 'abrirAguardandoCliente()']) {
  assert.ok(app.includes(`onclick="${destino}"`), `o card com ${destino} continua na Home`);
}

// Iconezinhos fora dos contadores (em qualquer tamanho de tela).
assert.match(css, /#resumoDia \.ui-kpi i\{display:none\}/, 'os iconezinhos saem dos contadores');

// No computador: uma linha só, cards compactos (5 colunas na v1077, 6 na v1124, 4 desde a v1246). IMPORTANTE (v1078): quem manda no desktop é o bloco de tema #664, todo com
// !important — a regra das colunas PRECISA morar nele, senão perde a briga (foi exatamente o erro
// da v1077, flagrado pelo dono com print; verificado depois em navegador real: uma linha só
// ≥1000px, 4 de rolagem no tablet, 2 no celular).
// v1251 — passou de 4 pra 3 colunas: o quadradinho "Atendidos" saiu da fileira e virou o painel
// "Seu mês" (coluna da direita no computador, linha de resumo no celular). Com 4 colunas sobrava
// um buraco no fim da linha.
assert.match(css, /#home \.resumo-dia\{display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/,
  'no computador os contadores ficam numa linha só (na regra !important que manda)');
assert.match(css, /#home \.ui-kpi\{[^}]*min-height:0!important;padding:12px 14px!important\}/,
  'cards mais compactos no computador');
assert.match(css, /#home \.ui-kpi b\{[^}]*font-size:24px!important\}/, 'número em 24px no computador');
assert.ok(!css.includes('@media(min-width:1000px){\n  #resumoDia.resumo-dia'),
  'o bloco fraco da v1077 (que perdia pro !important) não volta');

// As regras do celular seguem intactas (4 de rolagem no tablet, 2 colunas no celular).
assert.match(css, /#home \.resumo-dia\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/,
  'tablet: três colunas, sem rolagem lateral (v1251 — eram 4 de 118px com rolagem)');
// v1251 — no celular eram 2 colunas porque havia 4 quadradinhos (2 linhas de 2). Com 3, duas
// colunas deixariam um sozinho na segunda linha. ESTA é a regra que manda no celular (dois ids).
assert.match(css, /#home #resumoDia\{\s*display:grid!important;[\s\S]{0,600}?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/,
  'celular em 3 colunas, numa linha só');

console.log('v1077-contadores-uma-linha: ok');
