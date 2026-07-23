import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v934 — dois pedidos do dono via print da tela do lead (versão web/desktop):
// 1) A barra de ícones do topo (Voltar, Proposta, Arquivar, Mensagens, Reanalisar, Agendar,
//    Editar, Marcar/Atendido) quebrava em 2 linhas de 4 mesmo em tela grande de computador —
//    ele quer todos os 8 numa linha só, lado a lado, no desktop.
// 2) O cabeçalho do lead mostrava 4 linhas de data (Última análise / Última mensagem / Último
//    atendimento / Última atualização) — ele quer só "Última análise", sem as outras 3.

// 1. Em telas largas (desktop web), a toolbar vira 8 colunas — os 8 botões numa linha só.
//    Em telas estreitas continua em 4 colunas (2 linhas), como já era.
assert.match(app, /\.cp704-toolbar\{display:grid;grid-template-columns:repeat\(4,1fr\);gap:8px\}/,
  'a base (mobile) continua em 4 colunas');
assert.match(app, /@media\(min-width:1000px\)\{\.cp704-toolbar\{grid-template-columns:repeat\(8,minmax\(0,1fr\)\)\}\}/,
  'no desktop (min-width:1000px) a toolbar precisa virar 8 colunas — os 8 botões numa linha só');

// 2. Cabeçalho do lead: "Última análise" continua sendo renderizada (v937 trouxe "Última
// mensagem" de volta, ver tests/v887-cabecalho-metalinhas.test.mjs — o dono sentiu falta dela.
// "Último atendimento" e "Última atualização" continuam removidas, essas não foram pedidas de volta).
const iniFoco = app.indexOf('function renderLeadFoco(lead){');
const fimFoco = app.indexOf('\nfunction ', app.indexOf('cp7ObsStatus', iniFoco));
const foco = app.slice(iniFoco, fimFoco);
assert.match(foco, /Última análise — \$\{analiseEm\}/, '"Última análise" continua aparecendo');
assert.doesNotMatch(foco, /Último atendimento —|Última atualização —/,
  '"Último atendimento" e "Última atualização" continuam fora do cabeçalho do lead');
assert.doesNotMatch(foco, /\bconst atendimento=|\bconst atualizadoEm=/,
  'as variáveis que só alimentavam as metalinhas removidas não devem sobrar soltas no código');

// As funções que só existiam pra calcular "Último atendimento" (agora sem nenhum uso) foram
// removidas — código morto não fica no arquivo.
assert.doesNotMatch(app, /function ultimoAtendimentoDataHora\(/, 'função órfã removida');
assert.doesNotMatch(app, /function ultimoAtendimentoManual\(/, 'função órfã removida');

console.log('v934-toolbar-desktop-e-metaline-unica: ok');
