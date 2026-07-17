import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v823: as ações Agendar retorno e Editar lead subiram pro topo (cp704-top-actions),
// junto de Reanalisar e Marcar atendimento.
// v866: o Reanalisar ganhou destaque e passou a ser o PRIMEIRO botão (acesso rápido),
// então a ordem agora é: Reanalisar, Agendar retorno, Editar lead, Marcar atendimento.
assert.match(app, /cp704-top-actions">[\s\S]*?Reanalisar[\s\S]*?Agendar retorno[\s\S]*?Editar lead[\s\S]*?Atendido hoje':'Marcar atendimento/,
  'ordem esperada no topo: Reanalisar, Agendar retorno, Editar lead, Marcar atendimento');

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
