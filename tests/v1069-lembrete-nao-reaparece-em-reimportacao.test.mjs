import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1069 — bug real relatado pelo dono: o lead "Beato Broks Imobiliária" apareceu na Agenda com
// um lembrete ("Lembrar em 31/07/2026 — Retomar contato") que ele nunca agendou. A v988 já tinha
// resolvido esse tipo de "lembrete fantasma" em api/reanalisar-lead.js (aplicarLembrete: só
// preserva um lembrete anterior se ele NÃO for "auto" — resíduo da extração automática por texto
// que existia antes da v988). Mas essa mesma regra nunca tinha sido aplicada em dois outros
// lugares que também carregam o lembrete anterior pra frente — e os dois disparam no caminho
// mais comum do dia a dia: reimportar/atualizar a conversa de um lead que já existe:
//   1. api/lead-update.js (acaoAtualizarComEvolucao) — "lembrete: anterior.lembrete || undefined"
//   2. api/_persistence.js (_mesclarAnaliseV681) — tratava "lembrete" igual a aprendizado/venda/
//      avatarFoto no mesmo loop genérico, sem checar auto:true
// Mais uma rede de segurança na LEITURA (api/_persistence.js, listRecentProcessings): qualquer
// lembrete auto:true que tenha sobrevivido no banco de antes desta correção nunca mais aparece.

const leadUpdateSrc = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
const persistenceSrc = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

// 1. api/lead-update.js: a linha que preserva o lembrete precisa checar auto !== true — e
// descartar com null (não undefined), senão o spread {...anterior,...nova} anterior a
// "preservado" (que é espalhado por cima filtrando só as chaves undefined) deixa o lembrete
// antigo sobreviver mesmo assim.
assert.match(leadUpdateSrc, /lembrete:\s*\(anterior\.lembrete && anterior\.lembrete\.auto !== true\) \? anterior\.lembrete : null/,
  'acaoAtualizarComEvolucao precisa descartar lembrete legado (auto:true) com null, não undefined');
assert.match(leadUpdateSrc, /\.\.\.Object\.fromEntries\(Object\.entries\(preservado\)\.filter\(\(\[, v\]\) => v !== undefined\)\)/,
  'confirma que "merged" filtra só undefined de preservado (por isso null é obrigatório pra limpar o lembrete de verdade)');

// 2. api/_persistence.js: "lembrete" precisa ter saído do loop genérico de aprendizado/venda/
// avatarFoto (que não checa auto) e ter sua própria checagem.
const iniMerge = persistenceSrc.indexOf('function _mesclarAnaliseV681(');
const marcaFim = 'return _semScoreComercial(merged);\n}';
const fimMerge = persistenceSrc.indexOf(marcaFim, iniMerge) + marcaFim.length;
assert.ok(iniMerge > -1 && fimMerge > marcaFim.length, '_mesclarAnaliseV681 não encontrada por inteiro');
const mergeSrc = persistenceSrc.slice(iniMerge, fimMerge);
assert.doesNotMatch(mergeSrc, /for \(const key of \[[^\]]*"lembrete"[^\]]*\]\)/,
  '"lembrete" não pode mais estar na lista genérica (aprendizado/venda/avatarFoto) sem checagem de auto:true');
assert.match(mergeSrc, /merged\.lembrete && merged\.lembrete\.auto === true/,
  '_mesclarAnaliseV681 precisa checar auto:true depois do spread (não antes — o spread já herdou anterior.lembrete)');

// Teste funcional de _mesclarAnaliseV681 isolada (stubs pros helpers que não são o foco aqui).
function rodarMerge(anterior, nova) {
  const sandbox = new Function('_semScoreComercial', 'mergeStorageRefs', '_nomeRuimIdentity', `
    ${mergeSrc}
    return _mesclarAnaliseV681(${JSON.stringify(anterior)}, ${JSON.stringify(nova)});
  `);
  return sandbox(v => v, () => null, () => false);
}

const manual = { quando: '2026-08-01T12:00:00.000Z', motivo: 'Retomar contato', auto: false };
const legado = { quando: '2026-07-31T12:00:00.000Z', motivo: 'Retomar contato', auto: true };

assert.deepEqual(rodarMerge({ lembrete: manual }, {}).lembrete, manual,
  'reimportação/mesclagem precisa preservar um lembrete posto manualmente (auto:false)');
assert.equal(rodarMerge({ lembrete: legado }, {}).lembrete, undefined,
  'reimportação/mesclagem NUNCA pode repropagar um lembrete legado auto:true — é exatamente o bug do "Beato"');
assert.equal(rodarMerge({}, {}).lembrete, undefined, 'sem lembrete anterior, nada é criado do nada');

// 3. Rede de segurança na leitura (listRecentProcessings): lembrete auto:true nunca chega no navegador.
assert.match(persistenceSrc, /analysis\.lembrete && analysis\.lembrete\.auto === true/,
  'listRecentProcessings precisa zerar qualquer lembrete auto:true que tenha sobrevivido no banco');

console.log('v1069 (lembrete): reimportação de lead existente não repropaga lembrete fantasma — ok');
console.log('v1069-lembrete-nao-reaparece-em-reimportacao: ok');
