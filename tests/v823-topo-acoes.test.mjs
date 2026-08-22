import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v823/v894 punham todas as ações como ícones na barra. A v1365 (ordem do dono, 22/08/2026)
// reduziu a barra ao dia a dia — Voltar, Mensagens, Agendar, Atendido/Marcar — e guardou
// Proposta, Arquivar, Editar e Reanalisar no menu "⋯", com os mesmos botões e funções.
assert.match(app, /cp704-toolbar">[\s\S]*?title="Últimas mensagens"[\s\S]*?title="Agendar retorno"[\s\S]*?ui667DesmarcarAtendido[\s\S]*?ui667MarcarAtendido[\s\S]*?title="Mais ações"/,
  'barra visível: Mensagens, Agendar, Atendido/Marcar, Mais');
assert.match(app, /id="cp704MoreMenu"[\s\S]*?title="Gerar proposta"[\s\S]*?title="Editar lead"[\s\S]*?title="Reanalisar"/,
  'menu "⋯" guarda Proposta, Arquivar (cp704BotaoEtapa), Editar e Reanalisar');
assert.match(app, /window\.cp704ToggleMais=function/,
  'o menu "⋯" tem quem o abra e feche');

// A barra de ações antiga do lado direito (cp704-quickbar) foi removida — sem
// "Marcar atendimento" duplicado.
assert.doesNotMatch(app, /class="cp704-quickbar"/,
  'a barra antiga do aside (cp704-quickbar) deve ter sido removida');

// v908: "Últimas mensagens" agora abre por um ícone no topo (Mensagens) num card recolhível.
assert.match(app, /<span class="lb">Mensagens<\/span>/, 'ícone "Mensagens" no topo abre o histórico');
assert.match(app, /id="cp704HistCard" hidden/, 'histórico é um card recolhível');

// Regressão: observação segue única.
assert.equal((app.match(/id="cp7ObsTexto"/g) || []).length, 1, 'observação segue única');

console.log('v823-topo-acoes: ok');
