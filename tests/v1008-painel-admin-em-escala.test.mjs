import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1008 — o dono apontou: "imagina quando tiver 5 mil clientes". O painel administrativo
// agora carrega a lista em lotes de 50 ("Mostrar mais"), faz busca e filtros no BANCO
// (não varrendo a tela) e, no celular, o cartão é compacto com as ações atrás de um botão.

const admin = fs.readFileSync(new URL('../admin-plataforma.html', import.meta.url), 'utf8');
assert.match(admin, /PAGINA_CONTAS = 50/, 'a lista precisa carregar em lotes de 50');
assert.match(admin, /\.range\(offsetContas, offsetContas \+ PAGINA_CONTAS - 1\)/, 'a paginação precisa sair na consulta ao banco (range)');
assert.match(admin, /\.ilike\('nome'/, 'a busca por nome precisa ser feita pelo banco (ilike), não filtrando a tela');
assert.match(admin, /q\.eq\('status', filtroStatus\)/, 'o filtro de status precisa ser feito pelo banco');
assert.match(admin, /count: 'exact', head: true/, 'os números de resumo precisam vir de contagem do banco (não do pedaço carregado)');
assert.match(admin, /id="btnMaisContas"/, 'precisa existir o botão "Mostrar mais"');
assert.match(admin, /toggleAcoes/, 'no celular as ações ficam atrás de um botão');

const css = fs.readFileSync(new URL('../contas-estilo.css', import.meta.url), 'utf8');
assert.match(css, /\.tabela-admin tr\.acoes-abertas \.acoes-linha\{ display:flex/, 'as ações só aparecem quando o cartão é expandido');
assert.match(css, /\.btn-acoes-toggle\{ display:none; \}/, 'no computador o botão de expandir não existe (ações sempre visíveis)');

console.log('v1008-painel-admin-em-escala: ok');
