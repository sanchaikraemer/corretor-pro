import fs from 'node:fs';
import assert from 'node:assert/strict';

// §7.5 — Busca automatizada: o código ativo NÃO pode conter preços, empreendimentos,
// catálogos ou a tabela externa cravados. As fontes válidas passam a ser Cérebro,
// observações, análises e históricos reais (§7.2).
const arquivos = ['../app.js', '../api/_pipeline.js', '../api/_persistence.js', '../api/lead-update.js', '../api/reanalisar-lead.js', '../api/cerebro-config.js', '../service-worker.js', '../build.js'];
const conteudo = arquivos.map(a => fs.readFileSync(new URL(a, import.meta.url), 'utf8')).join('\n');

const proibidos = [
  /Renaissance/i, /Boulevard/i, /Personalit[eé]/i, /Evolutti/i, /Premium Office/i,
  /Nova Vila Rica/i, /\bQuality\b/, /CAT[ÁA]LOGO SENGER/i, /tabelasenger/i,
  /Construtora Senger/i, /Carazinho/i, /Ibirub[áa]/i
];
for (const re of proibidos) {
  assert.doesNotMatch(conteudo, re, `dado comercial fixo não pode aparecer no código ativo: ${re}`);
}

// A tabela externa (GitHub Pages) não é mais consultada.
assert.doesNotMatch(conteudo, /raw\.githubusercontent\.com\/direcionacorretor/i, 'tabela externa não pode ser consultada');
// O módulo orquestrador que buscava o catálogo externo foi removido.
assert.equal(fs.existsSync(new URL('../api/_cerebro-orquestrado.js', import.meta.url)), false, 'módulo do catálogo externo deve ter sido removido');

// A rede de segurança que "completava" o produto a partir do catálogo saiu do pipeline.
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
assert.doesNotMatch(pipeline, /empreendimentoDaConversa|nomesEmpreendimentosSenger|loadCatalogoSenger/, 'sem funções de catálogo no pipeline');
// Na ausência de produto, fica indefinido (cautela, não invenção).
assert.match(pipeline, /function detectProduct[\s\S]*?return "Não identificado";\s*\}/, 'detectProduct não usa mais lista fixa');

console.log('v827-catalogo: ok');
