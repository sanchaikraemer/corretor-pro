import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v864: o chip de etapa do lead ("Negociando · passo 5 de 6") virou uma barra de progresso em
// gradiente, com pontinho pulsando e preenchimento proporcional.
//
// v1186 — ESTE TESTE VIROU UM FANTASMA E FOI REESCRITO.
//
// Poucas versões depois da v864, a **v889** registrou uma decisão do dono: tirar o funil de 6
// etapas do cabeçalho do lead — "muitos leads 'avançados' estão longe de fechar; o funil não mede
// qualificação" — e trocá-lo pela **barra de interesse do cliente** (mensagens que o CLIENTE
// mandou), que é a que aparece hoje. A chamada do chip saiu do cabeçalho naquela versão.
//
// Só que o resto ficou: a função que montava o chip, a tabela das 6 etapas e ~20 linhas de CSS
// continuaram no projeto, sem ninguém desenhar nada disso. E este teste continuou VERDE por três
// meses — ele lia o texto do arquivo e executava a função direto, então media com precisão o
// comportamento de um pedaço de tela que não existe mais. Era um teste que dava a impressão de
// cobrir uma feature enquanto cobria um fantasma.
//
// A auditoria de 09/08/2026 removeu o código e o CSS. O que este arquivo guarda agora é a decisão
// do dono: o funil não volta, e o cabeçalho do lead continua com a barra de interesse.

// ── 1. O funil não pode voltar — nem o desenho, nem o CSS, nem os rótulos das 6 etapas ────────
assert.doesNotMatch(app, /cp704JornadaBadge|cp704Jornada\b/,
  'o chip do funil foi retirado a pedido do dono na v889 — não pode voltar');
assert.doesNotMatch(app, /passo \$\{j\.passo\} de 6|· passo \$\{/,
  'nada de rótulo "passo X de 6" na tela do lead');
assert.doesNotMatch(css, /cp704-etapa-prog|cp704-etapa-fill|cp704-etapa-edge|cp704EtapaPulse/,
  'o CSS da barra de etapa sai junto — nenhuma tela o usa');

// ── 2. O que ficou no lugar: a barra de INTERESSE do cliente, viva no cabeçalho do lead ───────
assert.match(app, /function cp704BarraInteresse\(/, 'a barra de interesse precisa existir');
assert.match(app, /cp704-situation">\$\{cp704BarraInteresse\(lead\)\}/,
  'o cabeçalho do lead precisa desenhar a barra de interesse (é o que substituiu o funil)');
assert.match(app, /cp704-interesse/, 'a marcação da barra de interesse precisa continuar');

// ── 3. E ela mede o que a v889 decidiu: mensagem DO CLIENTE, não a do corretor ────────────────
assert.match(app, /function mensagensDoCliente\(/,
  'a barra precisa continuar contando as mensagens do cliente');
assert.match(app, /CP_TETO_BARRA_INTERESSE/, 'o teto da barra precisa continuar sendo uma constante');

console.log('v864-barra-progresso-etapa: ok (funil retirado na v889; guarda agora é a barra de interesse)');
