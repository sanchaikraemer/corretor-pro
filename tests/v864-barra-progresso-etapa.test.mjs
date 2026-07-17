import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v864: o chip fixo de etapa do lead (pill com bolinha cinza + "Nome da etapa · passo X de 6")
// virou uma barra de progresso em gradiente no mesmo pill. Preenchimento proporcional (X/6),
// gradiente único frio→coral→verde de comprimento fixo revelado por fatia (clip-path),
// pontinho branco pulsando nos passos 1..5 e parado no passo 6.

// --- 1) Os 6 nomes de etapa precisam continuar batendo com o que já existia. ---
const nomesEsperados = [
  [1, 'Conhecendo'],
  [2, 'Interessado'],
  [3, 'Comparando opções'],
  [4, 'Vendo se cabe no bolso'],
  [5, 'Negociando'],
  [6, 'Decidindo'],
];
for(const [passo, label] of nomesEsperados){
  const re = new RegExp(`label:'${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}',\\s*passo:${passo}`);
  assert.match(app, re, `etapa passo ${passo} precisa continuar sendo "${label}"`);
}

// --- 2) Teste comportamental: roda cp704Jornada + cp704JornadaBadge contra stubs e
//        confere o preenchimento (--cp-etapa-pct) no passo 1, num passo do meio e no 6. ---
const ini = app.indexOf('function cp704Jornada(lead, mc){');
const fim = app.indexOf('function cp704Impedimento(');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'não localizei as funções da jornada');
const fonte = app.slice(ini, fim);

// eslint-disable-next-line no-new-func
const carregar = new Function(
  'normalizarEtapa', 'escapeHtml',
  fonte + '\nreturn { cp704Jornada, cp704JornadaBadge };'
);
const { cp704JornadaBadge } = carregar(
  () => '',            // normalizarEtapa: string vazia → não cai em Vendido/Perdido/Arquivado
  (s) => String(s ?? '') // escapeHtml: identidade
);

const badge = (status) => cp704JornadaBadge({ etapa: status }, { oportunidade: { status } });

function pctDe(html){
  const m = html.match(/--cp-etapa-pct:([\d.]+)%/);
  return m ? Number(m[1]) : null;
}

// Passo 1 (Conhecendo) → 1/6 ≈ 16.67%, pulsando (sem is-completo).
const p1 = badge('descoberta');
assert.equal(pctDe(p1), 16.67, 'passo 1 deveria preencher 16.67%');
assert.match(p1, /cp704-etapa-prog/, 'passo 1 deveria usar a barra de progresso');
assert.doesNotMatch(p1, /is-completo/, 'passo 1 não pode estar marcado como completo (deve pulsar)');
assert.match(p1, /Conhecendo · passo 1 de 6/, 'passo 1 deveria rotular "Conhecendo · passo 1 de 6"');
assert.match(p1, /cp704-etapa-fill/, 'a barra precisa ter a camada de gradiente');
assert.match(p1, /cp704-etapa-edge/, 'a barra precisa ter o pontinho branco de avanço');

// Passo do meio (Comparando opções) → 3/6 = 50%.
const p3 = badge('comparando');
assert.equal(pctDe(p3), 50, 'passo 3 deveria preencher 50%');
assert.doesNotMatch(p3, /is-completo/, 'passo 3 ainda não é completo');
assert.match(p3, /Comparando opções · passo 3 de 6/, 'passo 3 deveria rotular corretamente');

// Passo 6 (Decidindo) → 100%, completo (pontinho parado, sem pulsar).
const p6 = badge('decisao');
assert.equal(pctDe(p6), 100, 'passo 6 deveria preencher 100%');
assert.match(p6, /is-completo/, 'passo 6 precisa estar marcado como completo (sem pulsar)');
assert.match(p6, /Decidindo · passo 6 de 6/, 'passo 6 deveria rotular "Decidindo · passo 6 de 6"');

// --- 3) O CSS precisa: gradiente frio→coral→verde reaproveitando cores existentes,
//        revelar por clip-path, pontinho pulsando e parado no passo 6. ---
const regraFill = css.match(/\.cp704-etapa-prog \.cp704-etapa-fill\{[^}]*\}/);
assert.ok(regraFill, 'a camada de gradiente precisa existir no CSS');
assert.match(regraFill[0], /linear-gradient/, 'o preenchimento precisa ser um gradiente');
assert.match(regraFill[0], /var\(--cyan\)/, 'a ponta fria precisa reusar var(--cyan)');
assert.match(regraFill[0], /var\(--accent\)/, 'o coral precisa reusar var(--accent) (botão Anexar)');
assert.match(regraFill[0], /#68ff95/i, 'o verde precisa reusar #68ff95 (etiqueta Atendido)');
assert.match(regraFill[0], /clip-path:inset\(/, 'a fatia precisa ser revelada por clip-path');

assert.match(css, /@keyframes cp704EtapaPulse/, 'o pulso do pontinho precisa existir');
assert.match(
  css,
  /\.cp704-etapa-prog\.is-completo \.cp704-etapa-edge\{animation:none\}/,
  'no passo 6 (is-completo) o pontinho não pode pulsar'
);

console.log('v864-barra-progresso-etapa: ok');
