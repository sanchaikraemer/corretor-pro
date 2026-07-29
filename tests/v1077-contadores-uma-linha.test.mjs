import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1077 — modelo 1 escolhido pelo dono pros contadores da Home na versão web: os 5 cards
// ("Fazer agora", "Total de leads", "Agenda", "Aguardando cliente", "Sem atender 30d+")
// numa LINHA SÓ no computador, mais compactos e SEM os iconezinhos. No celular nada muda
// (as regras de telas menores continuam as mesmas).

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// Os 5 cards continuam existindo com os destinos certos.
for (const destino of ['abrirFazerAgora()', 'abrirCarteiraAtiva()', "show('agenda')",
  'abrirAguardandoCliente()', 'cpAbrirSemAtender30Dias()']) {
  assert.ok(app.includes(`onclick="${destino}"`), `o card com ${destino} continua na Home`);
}

// Iconezinhos fora dos contadores (em qualquer tamanho de tela).
assert.match(css, /#resumoDia \.ui-kpi i\{display:none\}/, 'os iconezinhos saem dos contadores');

// No computador: 5 colunas numa linha só, cards compactos.
assert.match(css, /@media\(min-width:1000px\)\{\s*#resumoDia\.resumo-dia\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)\}/,
  'no computador os 5 contadores ficam numa linha só');
assert.match(css, /#resumoDia \.ui-kpi\{padding:12px 14px;min-height:0\}/, 'cards mais compactos no computador');

// As regras do celular seguem intactas (4 de rolagem no tablet, 2 colunas no celular).
assert.match(css, /@media\(max-width:999px\)\{[\s\S]{0,200}?\.resumo-dia\{grid-template-columns:repeat\(4,minmax\(92px,1fr\)\)/,
  'tablet continua como era');
assert.match(css, /#home #resumoDia\{\s*display:grid!important;\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/,
  'celular continua em 2 colunas');

console.log('v1077-contadores-uma-linha: ok');
