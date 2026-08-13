import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1248 — duas coisas achadas abrindo o app publicado num navegador de verdade, em 320/360/390 px.
//
// 1. O NÚMERO DA VERSÃO APARECIA CORTADO NO CELULAR: "#124" no lugar de "#1247". Ele dividia a
//    linha com o nome "Corretor Pro" e o excedente passava POR BAIXO do bloco de contadores do
//    topo, que tem fundo próprio. Pior: a palavra "Atualização" é um <span> e vinha herdando o
//    tamanho de 14px do NOME da marca (regra .cp-mobile-brand span), quase o dobro do que devia —
//    era ela que empurrava o número pra fora. Esse número é a referência que o dono usa pra saber
//    se está vendo a versão certa; não pode aparecer pela metade.
// 2. IMPORTAR CONVERSA NÃO TINHA CAMINHO CURTO. É a ação de onde sai toda análise do produto e o
//    único caminho era Configurações → Importar conversa (no celular, "Mais" → Importar). O
//    atalho que existia na tela Hoje (.pickZipShortcut) só é desenhado pra conta SEM nenhum
//    cliente — ou seja, sumia exatamente pra quem usa o app todo dia.

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// ── 1. Versão do celular ────────────────────────────────────────────────────────────────────
assert.match(css, /\.cp-mobile-brand-copy\{[^}]*flex-direction:column!important/,
  'nome e versão precisam ficar em LINHAS separadas no celular — na mesma linha não cabem');
assert.match(css, /\.cp-mobile-version,\.cp-mobile-version span\{[^}]*font-size:9px!important/,
  'a palavra "Atualização" (um <span>) precisa ser forçada ao tamanho pequeno, senão herda os 14px do nome da marca');

// A regra que aperta a palavra só pode valer em tela MUITO estreita — em 360/390 ela cabe inteira.
const escondePalavra = css.match(/@media\(max-width:(\d+)px\)\{\s*\.cp-versao-palavra\{display:none!important\}/);
assert.ok(escondePalavra, 'não achei a regra que esconde a palavra "Atualização"');
assert.ok(Number(escondePalavra[1]) <= 360,
  `a palavra "Atualização" não pode sumir já em ${escondePalavra[1]}px: com a linha própria ela cabe`);

// ── 2. Caminho curto pra importar ───────────────────────────────────────────────────────────
assert.match(html, /class="sb-item go" data-target="zip" data-nav-key="importar"/,
  'no computador, "Importar conversa" precisa ser item do menu da esquerda');
assert.match(html, /id="btnImportarHome" class="cp1248-importar go" data-target="zip"/,
  'no celular, o atalho precisa estar na tela Hoje (lá não existe menu da esquerda)');

// O botão do celular fica escondido no computador — lá o item do menu já resolve, não pode duplicar.
assert.match(css, /\.cp1248-importar\{display:none\}/, 'o botão da Hoje nasce escondido (computador)');
assert.match(css, /@media\(max-width:999px\)\{[\s\S]*?\.cp1248-importar\{[\s\S]*?display:flex!important/,
  'o botão da Hoje só aparece no celular');
assert.match(css, /body\.lead-foco-aberto \.cp1248-importar\{display:none!important\}/,
  'com um cliente aberto, o cabeçalho da Hoje some inteiro — o botão vai junto');

// Os dois usam a navegação padrão do app (classe "go" + data-target), sem onclick próprio.
const itemMenu = html.match(/<button type="button" class="sb-item go" data-target="zip"[^>]*>/);
assert.ok(itemMenu && !/onclick/.test(itemMenu[0]), 'o item do menu navega pela regra geral, sem onclick próprio');

console.log('v1248-caminho-curto-e-versao-visivel: ok');
