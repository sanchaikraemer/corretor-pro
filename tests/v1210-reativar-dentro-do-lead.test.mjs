import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1210 — pedido do dono (11/08/2026): "coloca o botão Reativar dentro do lead também".
//
// O "Reativar" só existia nos cartões da tela Arquivados. Quem achava o cliente pela busca da Home
// (que mostra arquivados com a tarja desde a v1093) e abria o lead ficava sem saída: a barra de
// cima oferecia "Arquivar" — o que o lead já era — e mais nada. Agora o mesmo lugar da barra troca
// de papel conforme o estado do lead.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// --- O botão da barra de cima, executado de verdade nos dois estados ---------------------------
const inicio = app.indexOf('function cp704BotaoEtapa(lead){');
assert.ok(inicio > -1, 'cp704BotaoEtapa precisa existir no app.js');
const fim = app.indexOf('function cp704BarraInteresse(lead)', inicio);
assert.ok(fim > inicio, 'não achei o fim do bloco de cp704BotaoEtapa');
const fonte = app.slice(inicio, app.lastIndexOf('}', fim) + 1);

const criar = new Function('normalizarEtapa', 'ETAPA_ARQUIVADO', 'safeJson', `${fonte}\nreturn cp704BotaoEtapa;`);
const cp704BotaoEtapa = criar(e => String(e || 'Ativo'), 'Geladeira', v => JSON.stringify(String(v)));

const htmlAtivo = cp704BotaoEtapa({ id: 42, name: 'Tales', etapa: 'Ativo' });
assert.match(htmlAtivo, /arquivarLead\("42"/, 'lead ativo continua oferecendo Arquivar');
assert.match(htmlAtivo, /<span class="lb">Arquivar<\/span>/, 'o rótulo do lead ativo é "Arquivar"');
assert.ok(!htmlAtivo.includes('reativarLeadArquivado'), 'lead ativo não pode oferecer Reativar');

const htmlArquivado = cp704BotaoEtapa({ id: 42, name: 'Tales', etapa: 'Geladeira' });
assert.match(htmlArquivado, /reativarLeadArquivado\("42",this\)/, 'lead arquivado precisa oferecer Reativar');
assert.match(htmlArquivado, /<span class="lb">Reativar<\/span>/, 'o rótulo do lead arquivado é "Reativar"');
assert.ok(!htmlArquivado.includes('arquivarLead('), 'arquivar um lead já arquivado não pode ser oferecido');
// O botão é ícone + rótulo como os vizinhos da barra: sem o <svg> ele nasce torto no meio deles.
assert.match(htmlArquivado, /<svg /, 'o botão precisa manter o ícone da barra');

// --- A barra do lead usa o botão que troca de papel, sem "Arquivar" cravado -------------------
const barraInicio = app.indexOf('<div class="cp704-top">');
const barraFim = app.indexOf('<div class="cp704-herorow">', barraInicio);
const barra = app.slice(barraInicio, barraFim);
assert.match(barra, /\$\{cp704BotaoEtapa\(lead\)\}/, 'a barra do lead precisa montar o botão pelo estado do lead');
assert.ok(!barra.includes('onclick=\'arquivarLead('), 'a barra não pode mais cravar o Arquivar');

// --- Reativar chamado de dentro do lead --------------------------------------------------------
const reativarInicio = app.indexOf('async function reativarLeadArquivado(id, btn){');
const reativarFim = app.indexOf('window.reativarLeadArquivado', reativarInicio);
assert.ok(reativarInicio > -1 && reativarFim > reativarInicio, 'não achei reativarLeadArquivado');
const reativar = app.slice(reativarInicio, reativarFim);

// Trocar o textContent do botão inteiro apagaria o <svg> do ícone (botão torto depois de um erro).
assert.ok(!/btn\.textContent\s*=/.test(reativar), 'o botão com ícone não pode ter o conteúdo inteiro trocado');
assert.match(reativar, /cpTrocarRotuloBotao\(btn, "Reativando\.\.\."\)/, 'o rótulo precisa avisar que está reativando');
assert.match(reativar, /cpTrocarRotuloBotao\(btn, "Reativar"\)/, 'o rótulo precisa voltar ao normal quando dá erro');
assert.match(app, /function cpTrocarRotuloBotao\(btn, texto\)\{[\s\S]*querySelector\?\.\(["']\.lb["']\)/, 'cpTrocarRotuloBotao precisa preferir o rótulo .lb');

// Reativando de dentro do lead, o detalhe precisa ser redesenhado (o botão vira "Arquivar" de
// novo); na lista de Arquivados não há detalhe aberto e redesenhar levaria pra outra tela.
assert.match(reativar, /const detalheAberto = String\(state\?\.lead\?\.id \|\| ""\) === String\(id\)/, 'precisa saber se o detalhe do lead está aberto');
assert.match(reativar, /if\(detalheAberto\)\{ try\{ await abrirLead\(id\); \}/, 'o detalhe aberto precisa ser redesenhado depois de reativar');
assert.ok(reativar.indexOf('const detalheAberto') < reativar.indexOf('cpMarcarEtapaLocal'), 'a checagem precisa acontecer antes de a etapa mudar em memória');

// --- A busca da Home não pode mais mentir por lista incompleta ---------------------------------
// Relato do dono no mesmo dia: procurou um cliente logo depois de abrir o app, veio um resultado
// só, e ele concluiu que o cliente não existia — a carteira completa ainda estava carregando e a
// busca varreu só os leads da Home.
const buscaInicio = app.indexOf('function renderBuscaGlobal(termo){');
const buscaFim = app.indexOf('window.renderBuscaGlobal', buscaInicio);
assert.ok(buscaInicio > -1 && buscaFim > buscaInicio, 'não achei renderBuscaGlobal');
const busca = app.slice(buscaInicio, buscaFim);
assert.match(busca, /loadTodosLeadsBusca\(\)\.then\(/, 'a busca precisa esperar a carteira completa chegar');
assert.match(busca, /if\(digitado === termo && state\.todosLeads && state\.todosLeads\.length\) renderBuscaGlobal\(termo\)/, 'a busca na tela precisa ser refeita quando a carteira completa chega');
assert.match(busca, /Ainda carregando o restante da sua carteira/, 'enquanto a lista está incompleta, o resultado precisa dizer isso');
assert.match(busca, /box\.innerHTML = avisoParcial \+ matches\.map/, 'o aviso precisa aparecer junto com os resultados encontrados');
assert.ok(busca.indexOf('avisoParcial') < busca.indexOf('if(!matches.length)'), 'o aviso também vale quando não achou ninguém');

// --- A caixa de "pode ser o mesmo cliente" precisa dizer QUEM é esse cadastro -------------------
const importacao = fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
assert.match(importacao, /const arquivadoExistente = normalizarEtapa\(existente\.etapa\) === "Geladeira"/, 'a caixa precisa saber se o cadastro parecido está arquivado');
assert.match(importacao, /Esse cadastro está \$\{fichaExistente\}/, 'a situação do cadastro precisa aparecer na caixa');
assert.match(importacao, /ele passa a se chamar/, 'a caixa precisa avisar que o cadastro antigo é renomeado ao juntar');
assert.match(importacao, /^\s+normalizarEtapa,$/m, 'normalizarEtapa precisa estar na lista fechada de imports do pedaço da importação');
assert.match(app, /export function normalizarEtapa\(raw\)\{/, 'normalizarEtapa precisa ser exportada para o pedaço da importação');

console.log('v1210-reativar-dentro-do-lead: ok');
