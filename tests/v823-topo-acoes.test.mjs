import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v823/v894: as ações ficam no topo do lead — agora na barra de ÍCONES (Modelo 2), na ordem
// Reanalisar, Agendar retorno, Editar lead, Atendido/Marcar (o último é o interruptor).
assert.match(app, /cp704-toolbar">[\s\S]*?title="Reanalisar"[\s\S]*?title="Agendar retorno"[\s\S]*?title="Editar lead"[\s\S]*?ui667DesmarcarAtendido[\s\S]*?ui667MarcarAtendido/,
  'ordem esperada no topo: Reanalisar, Agendar, Editar, Atendido/Marcar');

// A barra de ações antiga do lado direito (cp704-quickbar) foi removida — sem
// "Marcar atendimento" duplicado.
assert.doesNotMatch(app, /class="cp704-quickbar"/,
  'a barra antiga do aside (cp704-quickbar) deve ter sido removida');

// Últimas mensagens agora fica no rodapé, dentro da linha das ferramentas, com setinha.
assert.match(app, /cp704-tools-row">\$\{cp704ToolsFlat\(lead,mc\)\}<details class="cp704-details cp704-hist-inline"><summary>Últimas mensagens/,
  'Últimas mensagens deve ficar no rodapé junto das ferramentas, colapsável');

// Regressão: observação segue única.
assert.equal((app.match(/id="cp7ObsTexto"/g) || []).length, 1, 'observação segue única');

console.log('v823-topo-acoes: ok');
