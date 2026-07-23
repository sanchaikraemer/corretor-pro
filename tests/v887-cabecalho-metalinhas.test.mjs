import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v887 — cabeçalho do lead: "Última mensagem"/"Último atendimento" existiram como metalinhas
// próprias. v934 removeu as duas (e "Última atualização", da v909) a pedido do dono, deixando
// só "Última análise". v937 — o dono percebeu falta e pediu "Última mensagem" de volta (ela é
// informação que o corretor precisa: saber se o cliente respondeu depois da análise). Voltou.
// "Último atendimento" e "Última atualização" continuam fora (não foram pedidas de volta).

assert.match(app, /Última mensagem — \$\{ultimaMsgEm\}/, '"Última mensagem" está de volta no cabeçalho do lead (v937)');
assert.doesNotMatch(app, /Último atendimento — \$\{atendimento\}/, '"Último atendimento" continua fora do cabeçalho do lead');

console.log('v887-cabecalho-metalinhas: ok');
