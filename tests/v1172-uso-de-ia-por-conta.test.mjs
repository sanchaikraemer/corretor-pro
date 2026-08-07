import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1172 — o dono pediu (de novo) "falta os custos usados de cada usuário". Já existia a seção
// "Uso de IA por empresa" (v1038) com uma tabela própria mais abaixo na tela — só que ele não
// achou: a lista de corretores, logo acima, competia pela atenção, e ele nunca rolou até lá.
// Agora o custo de HOJE de cada conta aparece direto no card dela, na lista principal.

const admin = fs.readFileSync(new URL('../admin-plataforma.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../contas-estilo.css', import.meta.url), 'utf8');

// 1. celulaUsoIA existe e cobre os 3 estados: ainda não carregou / sem uso hoje / com uso.
// v1173 — o título passou a listar a categoria (análise pedida x aprendizado automático x
// outros), via resumoCategorias/NOME_CATEGORIA_USO_IA — extrai as três junto, na ordem certa
// (resumoCategorias depende de NOME_CATEGORIA_USO_IA já existir no escopo).
const fnMatch = admin.match(/function celulaUsoIA\(e\) \{[\s\S]*?\n\}/);
const nomeCatMatch = admin.match(/const NOME_CATEGORIA_USO_IA[^\n]*\n/);
const resumoFnMatch = admin.match(/function resumoCategorias\(categorias\) \{[\s\S]*?\n\}/);
assert.ok(fnMatch, 'celulaUsoIA não encontrada em admin-plataforma.html');
assert.ok(nomeCatMatch && resumoFnMatch, 'resumoCategorias/NOME_CATEGORIA_USO_IA não encontrados (usados pelo título de celulaUsoIA)');

const sandbox = new Function('escapeHtml', 'formatarReais', 'usoIaPorConta', `
  ${nomeCatMatch[0]}
  ${resumoFnMatch[0]}
  ${fnMatch[0]}
  return celulaUsoIA;
`);
const escapeHtml = (v) => String(v ?? '');
const formatarReais = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

{
  const celulaUsoIA = sandbox(escapeHtml, formatarReais, {});
  const html = celulaUsoIA({ id: 'x' });
  assert.match(html, /carregando/, 'antes de carregarUsoIA() responder, não pode fingir que sabe o custo (nem "R$ 0,00", que pareceria "sem uso")');
}
{
  const celulaUsoIA = sandbox(escapeHtml, formatarReais, { x: { hoje: { chamadas: 0, custoEstimadoBRL: 0 } } });
  const html = celulaUsoIA({ id: 'x' });
  assert.match(html, /Sem uso hoje/, 'zero chamadas precisa dizer isso claramente, não mostrar "R$ 0,00" (que parece bug)');
}
{
  const categoriasHoje = {
    analise: { chamadas: 2, custoEstimadoBRL: 0.4 },
    aprendizado: { chamadas: 6, custoEstimadoBRL: 1.5 },
    transcricao: { chamadas: 0, custoEstimadoBRL: 0 },
    outros: { chamadas: 0, custoEstimadoBRL: 0 }
  };
  const celulaUsoIA = sandbox(escapeHtml, formatarReais, { x: { hoje: { chamadas: 8, custoEstimadoBRL: 1.9 }, categoriasHoje } });
  const html = celulaUsoIA({ id: 'x' });
  assert.match(html, /R\$ 1,90/, 'com uso, o custo estimado TOTAL de hoje precisa aparecer no texto visível');
  assert.match(html, /2 análise pedida/, 'o título precisa separar quanto foi análise pedida de propósito');
  assert.match(html, /6 aprendizado automático/, 'o título precisa separar quanto foi aprendizado automático (rodou sozinho)');
}

// 2. A célula entra na lista principal (renderizarPainel), não só na tabela separada.
const rbStart = admin.indexOf('function renderizarPainel()');
const rbEnd = admin.indexOf('\n}', rbStart);
const painelBlock = admin.slice(rbStart, rbEnd);
assert.match(painelBlock, /celulaUsoIA\(e\)/, 'o card de cada conta na lista principal precisa mostrar o custo de IA — não só a tabela separada mais abaixo');
assert.match(admin, /<th>Uso de IA hoje<\/th>/, 'cabeçalho da tabela precisa citar a coluna nova (desktop)');

// 3. usoIaPorConta é alimentado por carregarUsoIA() (mesmo dado da tabela "Uso de IA por
//    empresa", sem pedir de novo ao servidor) e re-renderiza a lista principal.
const cuiStart = admin.indexOf('async function carregarUsoIA()');
const cuiEnd = admin.indexOf('\n}', admin.indexOf("msg.textContent = 'Erro ao carregar uso de IA", cuiStart));
const carregarUsoIABlock = admin.slice(cuiStart, cuiEnd);
assert.match(carregarUsoIABlock, /usoIaPorConta\[emp\.organizationId\] = emp/, 'carregarUsoIA precisa indexar o resultado por organizationId pra celulaUsoIA achar a conta certa');
assert.match(carregarUsoIABlock, /renderizarPainel\(\)/, 'depois de ter o dado, precisa redesenhar a lista principal pro selo de custo aparecer sem precisar de F5');

// 4. CSS: mesmo padrão neutro do chip-teste, e não pode virar "selo dentro de selo" no celular
//    (mesma armadilha corrigida em v1168 pra "Dias de teste").
assert.match(css, /\.chip-uso-ia\{/, 'precisa existir o estilo do selinho de custo');
assert.match(css, /td\[data-rotulo="Uso de IA hoje"\]\{\s*background:none;\s*padding:0;\s*\}/,
  'no celular, a célula "Uso de IA hoje" não pode desenhar a caixa cinza genérica por baixo do chip-uso-ia (senão vira selo dentro de selo, mesmo bug que "Dias de teste" teve em v1168)');

console.log('v1172-uso-de-ia-por-conta: ok');
