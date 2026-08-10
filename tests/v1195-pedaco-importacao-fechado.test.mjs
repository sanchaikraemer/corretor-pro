import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parse } from 'acorn';

// v1195 — GUARDA DA DIVISÃO DO app.js.
//
// O processamento da conversa importada saiu do app.js para js/importacao.js, que só é baixado
// quando o corretor realmente importa. Isso só é seguro enquanto DUAS coisas forem verdade:
//
//   (1) o pedaço é FECHADO — tudo que ele usa ou é declarado nele, ou está na lista de imports,
//       ou é do navegador. Se alguém acrescentar lá uma chamada a algo do app.js sem importar,
//       o app quebra SÓ NA HORA DA IMPORTAÇÃO — o pior tipo de defeito, porque a tela abre
//       normal e a falha só aparece no momento em que o corretor mais precisa. Este teste
//       encontra isso antes, apontando o nome que faltou.
//   (2) o app.js NUNCA importa o pedaço de forma estática — se importar, ele volta a ser
//       baixado em toda abertura e a divisão perde o sentido.
//
// A varredura de escopo abaixo é a mesma ideia de um empacotador: percorre a árvore de sintaxe
// e lista os nomes usados que não estão ligados a nenhuma declaração visível.

const raiz = new URL('../', import.meta.url);
const ler = (arq) => fs.readFileSync(new URL(arq, raiz), 'utf8');

const pedaco = ler('js/importacao.js');
const app = ler('app.js');

// ── (1) o pedaço é fechado ───────────────────────────────────────────────────────────────────
const GLOBAIS = new Set(('window document console localStorage sessionStorage location navigator fetch setTimeout clearTimeout ' +
  'setInterval clearInterval requestAnimationFrame cancelAnimationFrame Promise Object Array String Number Boolean Math JSON Date RegExp Map Set WeakMap WeakSet ' +
  'Error TypeError RangeError Symbol Proxy Reflect Intl parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI ' +
  'Blob File FileReader FormData Headers Request Response URL URLSearchParams AbortController TextEncoder TextDecoder Uint8Array ArrayBuffer DataView ' +
  'CustomEvent Event MouseEvent KeyboardEvent Image Audio MediaRecorder XMLHttpRequest indexedDB IDBKeyRange caches ' +
  'performance crypto alert confirm prompt matchMedia getComputedStyle history screen top parent self globalThis undefined NaN Infinity structuredClone ' +
  'queueMicrotask btoa atob Notification BroadcastChannel JSZip supabase arguments').split(/\s+/));

function nomesDoPadrao(no, out = []) {
  if (!no) return out;
  if (no.type === 'Identifier') out.push(no.name);
  else if (no.type === 'ObjectPattern') for (const p of no.properties) nomesDoPadrao(p.type === 'RestElement' ? p.argument : p.value, out);
  else if (no.type === 'ArrayPattern') for (const el of no.elements) nomesDoPadrao(el, out);
  else if (no.type === 'AssignmentPattern') nomesDoPadrao(no.left, out);
  else if (no.type === 'RestElement') nomesDoPadrao(no.argument, out);
  return out;
}

function livresDe(codigo) {
  const ast = parse(codigo, { ecmaVersion: 'latest', sourceType: 'module' });
  const livres = new Set();
  const novo = (pai, fn) => ({ pai, vars: new Set(), fn: !!fn });
  const declarar = (esc, nome, tipo) => {
    if (!nome) return;
    if (tipo === 'var' || tipo === 'fn') { let e = esc; while (e.pai && !e.fn) e = e.pai; e.vars.add(nome); }
    else esc.vars.add(nome);
  };
  const ligado = (esc, nome) => { for (let e = esc; e; e = e.pai) if (e.vars.has(nome)) return true; return false; };
  function icar(corpo, esc) {
    for (const no of corpo) {
      if (!no) continue;
      if (no.type === 'FunctionDeclaration' && no.id) declarar(esc, no.id.name, 'fn');
      else if (no.type === 'ClassDeclaration' && no.id) declarar(esc, no.id.name, 'let');
      else if (no.type === 'VariableDeclaration') for (const d of no.declarations) for (const n of nomesDoPadrao(d.id)) declarar(esc, n, no.kind === 'var' ? 'var' : 'let');
      else if (no.type === 'ImportDeclaration') for (const s of no.specifiers) declarar(esc, s.local.name, 'let');
      else if (no.type === 'ExportNamedDeclaration' && no.declaration) icar([no.declaration], esc);
    }
  }
  function visitar(no, esc, pos) {
    if (!no || typeof no.type !== 'string') return;
    switch (no.type) {
      case 'Identifier': if (pos === 'ref' && !ligado(esc, no.name)) livres.add(no.name); return;
      case 'MemberExpression': visitar(no.object, esc, 'ref'); if (no.computed) visitar(no.property, esc, 'ref'); return;
      case 'Property': if (no.computed) visitar(no.key, esc, 'ref'); visitar(no.value, esc, 'ref'); return;
      case 'MethodDefinition': case 'PropertyDefinition': if (no.computed) visitar(no.key, esc, 'ref'); visitar(no.value, esc, 'ref'); return;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': {
        const e = novo(esc, true);
        if (no.type === 'FunctionExpression' && no.id) e.vars.add(no.id.name);
        for (const p of no.params) for (const n of nomesDoPadrao(p)) e.vars.add(n);
        for (const p of no.params) if (p.type === 'AssignmentPattern') visitar(p.right, e, 'ref');
        e.vars.add('arguments');
        if (no.body.type === 'BlockStatement') { icar(no.body.body, e); for (const s of no.body.body) visitar(s, e, 'stmt'); }
        else visitar(no.body, e, 'ref');
        return;
      }
      case 'BlockStatement': { const e = novo(esc, false); icar(no.body, e); for (const s of no.body) visitar(s, e, 'stmt'); return; }
      case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': {
        const e = novo(esc, false);
        for (const campo of ['init', 'left']) if (no[campo]) {
          if (no[campo].type === 'VariableDeclaration') { icar([no[campo]], e); visitar(no[campo], e, 'stmt'); } else visitar(no[campo], e, 'ref');
        }
        for (const campo of ['right', 'test', 'update']) if (no[campo]) visitar(no[campo], e, 'ref');
        visitar(no.body, e, 'stmt');
        return;
      }
      case 'CatchClause': {
        const e = novo(esc, false);
        if (no.param) for (const n of nomesDoPadrao(no.param)) e.vars.add(n);
        icar(no.body.body, e); for (const s of no.body.body) visitar(s, e, 'stmt');
        return;
      }
      case 'VariableDeclaration': for (const d of no.declarations) if (d.init) visitar(d.init, esc, 'ref'); return;
      case 'ClassDeclaration': case 'ClassExpression':
        if (no.superClass) visitar(no.superClass, esc, 'ref');
        if (no.body) for (const m of no.body.body) visitar(m, esc, 'expr');
        return;
      case 'LabeledStatement': visitar(no.body, esc, 'stmt'); return;
      case 'BreakStatement': case 'ContinueStatement': case 'ImportDeclaration': return;
    }
    for (const k of Object.keys(no)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const v = no[k];
      if (Array.isArray(v)) { for (const f of v) if (f && typeof f.type === 'string') visitar(f, esc, 'ref'); }
      else if (v && typeof v.type === 'string') visitar(v, esc, 'ref');
    }
  }
  const r = novo(null, true);
  icar(ast.body, r);
  for (const s of ast.body) visitar(s, r, 'stmt');
  return { livres, topo: r.vars };
}

const { livres, topo } = livresDe(pedaco);
const faltando = [...livres].filter(n => !GLOBAIS.has(n) && !topo.has(n)).sort();
assert.deepEqual(faltando, [],
  'js/importacao.js usa nomes que ninguém declarou nem importou. Isso NÃO quebra a abertura do ' +
  'app — quebra na hora em que o corretor importa uma conversa, que é o pior lugar possível. ' +
  'Acrescente cada um na lista de imports do topo do arquivo:\n  - ' + faltando.join('\n  - '));

// ── (2) o app.js só pode buscar o pedaço sob demanda ────────────────────────────────────────
assert.doesNotMatch(app, /^import[^\n]*importacao\.js/m,
  'app.js não pode importar js/importacao.js de forma estática — isso o faria voltar a ser ' +
  'baixado em TODA abertura, desfazendo a divisão.');
assert.match(app, /import\('\.\/js\/importacao\.js\?v=__VERSION__'\)/,
  'a ponte preguiçosa precisa continuar buscando o pedaço com import() dinâmico');
assert.match(app, /async function processFile\(file, options = \{\}\)\{\s*\n\s*const mod = await carregarModuloImportacao\(\);/,
  'processFile no app.js precisa continuar sendo só a ponte que busca o pedaço e repassa');

// ── (3) o pedaço continua com UMA porta de entrada ──────────────────────────────────────────
// Se alguém passar a chamar outra função do pedaço direto do app.js, ela não existirá lá e o
// app quebra na importação. A porta é processFile, e só ela.
const exportados = [...pedaco.matchAll(/export\s*\{([^}]*)\}/g)].flatMap(m => m[1].split(',').map(s => s.trim())).filter(Boolean);
assert.deepEqual(exportados, ['processFile'],
  'o pedaço da importação deve exportar exatamente uma porta de entrada (processFile)');

const declaradasNoPedaco = [...pedaco.matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)].map(m => m[1]);
const appSemComentario = app.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const vazando = declaradasNoPedaco.filter(n => n !== 'processFile' && new RegExp('\\b' + n + '\\s*\\(').test(appSemComentario));
assert.deepEqual(vazando, [],
  'estas funções moram em js/importacao.js mas são chamadas do app.js — do lado de lá elas não ' +
  'existem, então a chamada falha em produção:\n  - ' + vazando.join('\n  - '));

// ── (4) o pedaço não pode entrar no pacote guardado na instalação ───────────────────────────
const sw = ler('service-worker.js');
const coreAssets = sw.slice(sw.indexOf('const CORE_ASSETS'), sw.indexOf('];', sw.indexOf('const CORE_ASSETS')));
assert.ok(!/importacao\.js/.test(coreAssets.replace(/\/\/[^\n]*/g, '')),
  'js/importacao.js não pode estar em CORE_ASSETS: guardá-lo na instalação desfaz a economia ' +
  '(ele é buscado sob demanda e fica no cache a partir da primeira importação).');

// ── (5) e precisa ser publicado ─────────────────────────────────────────────────────────────
const build = ler('build.js');
assert.match(build, /"js\/importacao\.js"/, 'build.js precisa publicar o pedaço da importação');
assert.equal((build.match(/"js\/importacao\.js"/g) || []).length, 2,
  'js/importacao.js precisa estar nas DUAS listas do build.js (arquivos publicados e arquivos de texto, ' +
  'esta última é a que troca __VERSION__ — sem ela o import dinâmico apontaria pra uma URL literal)');

console.log('v1195-pedaco-importacao-fechado: pedaço fechado, carregado sob demanda, uma porta de entrada');
