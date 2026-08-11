import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1211 — "existia, mas existia aonde?" (dono, 11/08/2026).
//
// Quando a importação pergunta se o cliente é o mesmo de um cadastro parecido, responder "Sim"
// junta as duas conversas num cadastro só — e NÃO existe desfazer. Até aqui essa decisão era
// tomada no escuro: a caixa mostrava um nome e nada mais, e conferir exigia sair da importação
// (caminho que já travou a tela na v1192). Agora o cadastro apontado abre dentro da própria
// pergunta, com as últimas mensagens dele.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const importacao = fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');

// O botão e o painel só existem no caminho do nome SÓ PARECIDO — nome exato não pergunta (v953).
const ramoInicio = importacao.indexOf('if(nomeSoParecido){');
const ramoFim = importacao.indexOf('}else if(perguntarNome){', ramoInicio);
assert.ok(ramoInicio > -1 && ramoFim > ramoInicio, 'não achei o ramo do nome só parecido');
const ramo = importacao.slice(ramoInicio, ramoFim);
assert.match(ramo, /id="btnVerCadastroParecido"/, 'a pergunta precisa oferecer "Ver esse cadastro"');
assert.match(ramo, /id="cadastroParecidoDetalhe"/, 'precisa existir o lugar onde o cadastro abre');
assert.ok(
  ramo.indexOf('id="btnVerCadastroParecido"') < ramo.indexOf('id="pendingActions"'),
  'o botão de conferir precisa vir ANTES dos botões de decidir'
);

// A leitura acontece na própria tela: nada de navegar pro lead no meio da importação.
const verInicio = importacao.indexOf('async function verCadastroParecido(btn){');
const verFim = importacao.indexOf('function nomesParecemMesmoCliente(', verInicio);
assert.ok(verInicio > -1 && verFim > verInicio, 'não achei verCadastroParecido');
const ver = importacao.slice(verInicio, verFim);
assert.ok(!/abrirLead\(/.test(ver), 'conferir o cadastro não pode sair da importação');
assert.ok(!/lead-update|action:|fetch\(/.test(ver), 'conferir o cadastro não pode gravar nada — é leitura');
assert.match(ver, /await getLeadDetail\(existente\.id\)/, 'precisa buscar o histórico do cadastro apontado');
assert.match(ver, /recentMessages/, 'precisa mostrar as últimas mensagens do cadastro');
assert.match(ver, /normalizarEtapa\(completo\.etapa\) === "Geladeira"/, 'precisa dizer se o cadastro está arquivado');
assert.match(ver, /if\(alvo\.dataset\.aberto !== "1"\) return;/, 'se o painel foi fechado durante a busca, não pode desenhar por cima');
assert.match(ver, /alvo\.dataset\.aberto === "1"/, 'o botão precisa abrir e fechar o painel');
// Falha ao carregar o histórico não pode deixar o corretor sem nada na tela.
assert.match(ver, /catch\(_\)\{ \/\* sem o histórico completo, mostra o que já temos \*\/ \}/, 'sem histórico, mostra o que já se sabe do cadastro');

// A ponte com o app.js continua declarada (lista fechada de imports do pedaço da importação).
assert.match(importacao, /^\s+getLeadDetail,$/m, 'getLeadDetail precisa estar na lista de imports');
assert.match(app, /export async function getLeadDetail\(id, force\)\{/, 'getLeadDetail precisa ser exportada');

console.log('v1211-ver-cadastro-parecido: ok');
