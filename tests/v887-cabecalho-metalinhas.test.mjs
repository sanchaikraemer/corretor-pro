import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v887 — cabeçalho do lead: "Última mensagem"/"Último atendimento" existiram como metalinhas
// próprias. v934 removeu as duas (e "Última atualização", da v909) a pedido do dono, deixando
// só "Última análise". v937 — o dono percebeu falta e pediu "Última mensagem" de volta (ela é
// informação que o corretor precisa: saber se o cliente respondeu depois da análise). Voltou.
//
// v1266 — as duas viraram UMA linha só, por ordem do dono: "último contato é último atendimento".
// Havendo atendimento registrado, a linha é "Último atendimento"; sem nenhum, ela cai pra "Última
// mensagem" (a única data que existe nesse caso). O que segue proibido é o que a v934 tirou: DUAS
// metalinhas de data brigando por espaço no cabeçalho, além da "Última análise".

assert.match(app, /const ultimaMsgRotulo=ultimoAtTs\?'Último atendimento':'Última mensagem';/,
  'a metalinha de data é uma só, e o rótulo segue o que existe (atendimento > mensagem)');
assert.match(app, /\$\{ultimaMsgRotulo\} — \$\{ultimaMsgEm\}/, 'a linha é montada com esse rótulo');
assert.doesNotMatch(app, /Último atendimento — \$\{atendimento\}/, 'a metalinha separada de atendimento continua fora');
assert.doesNotMatch(app, /Última atualização — /, '"Última atualização" continua fora (v934)');

// A "Última análise" continua sendo a outra linha do cabeçalho — ela nunca saiu.
assert.match(app, /Última análise — \$\{analiseEm\}/, '"Última análise" continua no cabeçalho');

console.log('v887-cabecalho-metalinhas: ok');
