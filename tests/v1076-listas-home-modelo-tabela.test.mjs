import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1076 — o dono escolheu o modelo (print anexado): TABELA "com próximo passo" pra TODAS as
// listas abertas pelos cards da Home (Fazer agora, Aguardando cliente, Total de leads,
// Sem atender 30d+ etc.), no lugar da grade antiga de cartões. Regras do modelo:
// - colunas: nº · cliente (interesse embaixo) · próximo passo recomendado · dias parado · seta;
// - SEM botão de WhatsApp na linha (ele vive dentro do atendimento) e sem etiquetas coloridas;
// - no celular a coluna "próximo passo" se recolhe;
// - a linha inteira abre o atendimento do cliente.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// Recorta a função abrirGrupoHome (o render único de todas as listas da Home).
const ini = app.indexOf('function abrirGrupoHome(');
const fim = app.indexOf('function voltarDaListaHome(', ini);
assert.ok(ini > -1 && fim > ini, 'abrirGrupoHome não encontrada por inteiro');
const grupo = app.slice(ini, fim);

// 1. O render é a tabela do modelo aprovado.
assert.match(grupo, /class="lgt-row"/, 'as linhas usam o modelo de tabela (lgt-row)');
assert.match(grupo, /class="lgt-th"/, 'a tabela tem cabeçalho de colunas');
assert.match(grupo, /Próximo passo/, 'a coluna "Próximo passo" existe');
assert.match(grupo, /Parado há/, 'a coluna "Parado há" existe');
assert.match(grupo, /cp786ResumoAcao\(l\)/, 'o próximo passo vem da recomendação real da IA');
assert.match(grupo, /onclick='abrirLead\(\$\{idJs\}\)'/, 'a linha inteira abre o atendimento');

// 2. O que o dono vetou não pode voltar nas linhas: WhatsApp e etiquetas coloridas.
assert.ok(!grupo.includes('btnWhatsApp'), 'sem botão de WhatsApp nas linhas da lista');
assert.ok(!grupo.includes('tagEsfriandoHTML') && !grupo.includes('tagPermutaHTML'),
  'sem etiquetas coloridas nas linhas da lista');
assert.ok(!grupo.includes('cardLeadHTML'), 'a grade antiga de cartões saiu das listas da Home');
assert.ok(!grupo.includes('lista-leads-grid'), 'a classe da grade antiga saiu junto');

// 3. CSS do modelo: tabela com colunas, zebra discreta e recolhimento no celular.
assert.match(css, /\.lgt-th,\.lgt-row\{display:grid;grid-template-columns:30px minmax/,
  'as colunas da tabela existem no CSS');
assert.match(css, /@media\(max-width:720px\)\{\s*\.lgt-th\{display:none\}/,
  'no celular o cabeçalho de colunas se recolhe');
assert.match(css, /\.lgt-row \.lgt-passo\{display:none\}/,
  'no celular a coluna "próximo passo" se recolhe');
assert.ok(!css.includes('.lista-leads-grid'), 'o CSS da grade antiga não pode voltar');

console.log('v1076-listas-home-modelo-tabela: ok');
