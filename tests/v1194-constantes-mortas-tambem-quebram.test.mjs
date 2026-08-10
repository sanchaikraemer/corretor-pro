import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parse } from 'acorn';

// v1194 — GUARDA CONTRA CONSTANTE MORTA.
//
// A guarda da v1186 (v1186-nada-de-codigo-morto.test.mjs) só vigia FUNÇÕES que ninguém chama.
// A varredura da v1194 achou o que ela não enxergava: 13 constantes de topo declaradas e nunca
// lidas — tabelas de etiquetas e frases prontas de telas que já tinham sido substituídas
// (TIPO_RETOMADA_LABEL, MATERIAL_TEMPLATE, as cinco UI670_*, etc.). Uma delas ainda era
// "protegida" por um assert que conferia o TEXTO do arquivo, três meses depois de nenhuma tela
// desenhar aquilo — o mesmo padrão de teste-guardando-fantasma descrito nas NOTAS-v1186.
//
// COMO LER UMA FALHA AQUI: se uma constante sua aparecer na lista, ou falta ligar na tela o
// recurso que a usa, ou ela deve ser apagada junto com o recurso que morreu.

const raiz = new URL('../', import.meta.url);
const ler = (arq) => fs.readFileSync(new URL(arq, raiz), 'utf8');

const acompanhantes = ['index.html','share.html','admin-plataforma.html','cadastro.html','entrar.html',
  'js/proposta.js','js/pwa-install.js','js/dados-locais.js','js/state.js','js/dom.js','js/tema.js',
  'js/commercial-schema.js','build.js','contas-config.js']
  .map(f => { try { return ler(f); } catch { return ''; } }).join('\n');

// Uso é contado no TEXTO (não só no AST): constante citada dentro de string/template com
// onclick, ou usada por outro arquivo, é uso de verdade.
const vezes = (texto, nome) => (texto.match(new RegExp('\\b' + nome.replace(/\$/g, '\\$') + '\\b', 'g')) || []).length;

function constantesDeTopo(src) {
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const nomes = [];
  for (const no of ast.body) {
    const decl = no.type === 'ExportNamedDeclaration' ? no.declaration : no;
    if (decl?.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations) {
      // Só declarações simples de valor (objeto, array, número, string). Funções são da guarda
      // v1186; destructuring e afins ficam de fora de propósito (raros e com falso positivo fácil).
      if (d.id?.type === 'Identifier' && d.init && !/Function|Arrow/.test(d.init.type)) nomes.push(d.id.name);
    }
  }
  return nomes;
}

const mortas = [];
for (const arq of ['app.js', 'service-worker.js']) {
  const src = ler(arq);
  for (const nome of constantesDeTopo(src)) {
    if (nome.startsWith('_')) continue; // convenção de "interno, pode ser semente futura"
    const dentro = vezes(src, nome);
    const fora = vezes(acompanhantes, nome) > 0;
    // 1 = só a própria declaração.
    if (!fora && dentro <= 1) mortas.push(`${arq}: ${nome}`);
  }
}

assert.deepEqual(mortas, [],
  'Estas constantes são declaradas e nunca lidas em lugar nenhum. Ou falta ligar na tela o ' +
  'recurso que as usa, ou devem ser apagadas:\n  - ' + mortas.join('\n  - '));

console.log('v1194-constantes-mortas: nenhuma constante de topo sem uso em app.js/service-worker.js');
