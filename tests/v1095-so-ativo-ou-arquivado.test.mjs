import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1095 — ORDEM DIRETA E REPETIDA DO DONO, sem margem pra interpretação:
//
//   "eu quero cliente ativo ou arquivado. Ponto final. Não quero geladeira, não quero
//    oportunidade esquecida, não quero vendido, não quero merda nenhuma de nome de nada.
//    Só tem que ter duas opções, ativo ou arquivado, e ponto final."
//
// Este teste existe pra que nenhuma versão futura reintroduza um terceiro nome pra cliente.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// Tira comentários do app.js: o histórico PODE citar os nomes antigos (é memória do projeto);
// o que não pode é o app MOSTRAR ou USAR qualquer um deles.
const semComentarios = app
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const cssSemComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. "Oportunidades esquecidas" não existe mais em lugar nenhum ─────────────────────────────
{
  assert.doesNotMatch(semComentarios, /Oportunidades esquecidas/i,
    'a seção "Oportunidades esquecidas" foi removida — era mais um nome pro cliente');
  assert.doesNotMatch(html, /Oportunidades esquecidas/i, 'nem no HTML');
  assert.doesNotMatch(cssSemComentarios, /Oportunidades esquecidas/i, "nem no CSS");

  for (const morta of ['leadsEsquecidos', 'radarRowHTML', 'radarSeveridade']) {
    assert.doesNotMatch(semComentarios, new RegExp('function\\s+' + morta + '\\b'),
      `${morta} só servia à seção removida e não pode voltar`);
    assert.doesNotMatch(semComentarios, new RegExp('\\b' + morta + '\\s*\\('),
      `nada pode chamar ${morta}`);
  }
  // O estilo da seção também saiu (senão volta escondido, sem ninguém notar).
  assert.doesNotMatch(css, /\.radar-/, 'o estilo da seção removida não pode continuar no app');
}

// ── 2. Só existem DOIS estados possíveis pra um cliente ───────────────────────────────────────
{
  const etapas = app.match(/const ETAPAS = \[([^\]]*)\]/);
  assert.ok(etapas, 'a lista de estados possíveis precisa existir em app.js');
  const valores = etapas[1].split(',').map(s => s.trim()).filter(Boolean);
  assert.equal(valores.length, 2, `só pode haver 2 estados, achei ${valores.length}: ${valores.join(', ')}`);
  assert.deepEqual(valores, ['ETAPA_ATIVO', 'ETAPA_ARQUIVADO'],
    'os dois estados são Ativo e Arquivado — nada além disso');

  // normalizarEtapa é o portão: tudo que entra sai como um desses dois.
  const norm = app.match(/function normalizarEtapa\(raw\)\{[\s\S]*?\n\}/)[0];
  const retornos = [...norm.matchAll(/return\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
  assert.ok(retornos.length > 0, 'normalizarEtapa precisa devolver algo');
  for (const r of retornos) {
    assert.ok(['ETAPA_ATIVO', 'ETAPA_ARQUIVADO'].includes(r),
      `normalizarEtapa devolveu "${r}" — só pode devolver Ativo ou Arquivado`);
  }

  // O comportamento, de verdade: qualquer valor legado cai num dos dois.
  const ETAPA_ARQUIVADO = 'Geladeira', ETAPA_ATIVO = 'Ativo';
  const { normalizarEtapa } = eval(`
    const ETAPA_ARQUIVADO = ${JSON.stringify(ETAPA_ARQUIVADO)};
    const ETAPA_ATIVO = ${JSON.stringify(ETAPA_ATIVO)};
    ${norm}
    ({ normalizarEtapa });
  `);
  const legados = ['Novo', 'Atendimento', 'Visita/Proposta', 'Negociação', 'Standby',
                   'Vendido', 'Perdido', 'Geladeira', 'Arquivado', 'desistiu', 'recusou', '', null, undefined];
  for (const v of legados) {
    const r = normalizarEtapa(v);
    assert.ok(r === ETAPA_ATIVO || r === ETAPA_ARQUIVADO,
      `"${v}" virou "${r}" — todo valor precisa cair em Ativo ou Arquivado`);
  }
  assert.equal(normalizarEtapa('Vendido'), ETAPA_ARQUIVADO, 'Vendido é arquivado, não um estado próprio');
  assert.equal(normalizarEtapa('Perdido'), ETAPA_ARQUIVADO, 'Perdido é arquivado, não um estado próprio');
  assert.equal(normalizarEtapa('Negociação'), ETAPA_ATIVO, 'etapa de funil antiga vira simplesmente Ativo');
}

// ── 3. Nenhum nome de estado banido aparece NA TELA ───────────────────────────────────────────
{
  // Só o que o corretor lê: texto entre tags no HTML e nas telas montadas pelo app.
  const textosHtml = [...html.matchAll(/>([^<]{2,120})</g)].map(m => m[1]);
  const textosApp = [...semComentarios.matchAll(/>([^<>{}`$]{3,120})</g)].map(m => m[1]);
  const banidos = /\b(geladeira|vendido|perdidos?|standby|esquecid\w*)\b/i;
  for (const [onde, lista] of [['index.html', textosHtml], ['app.js', textosApp]]) {
    for (const t of lista) {
      assert.doesNotMatch(t, banidos,
        `texto visível em ${onde} usa um nome banido: "${t.trim().slice(0, 80)}"`);
    }
  }
}

console.log('v1095-so-ativo-ou-arquivado: ok');
