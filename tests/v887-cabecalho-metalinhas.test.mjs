import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v887 — cabeçalho do lead: as metalinhas do lead ("Última mensagem"/"Último atendimento")
// existiram como divs próprias. v934 — o dono pediu pra remover TUDO isso e deixar só
// "Última análise" (retirando também "Última atualização", da v909). Este teste agora
// confirma a ausência das metalinhas removidas, pra não voltarem por acidente numa reversão.

assert.doesNotMatch(app, /Última mensagem — \$\{last\}/, '"Última mensagem" foi removida do cabeçalho do lead (v934)');
assert.doesNotMatch(app, /Último atendimento — \$\{atendimento\}/, '"Último atendimento" foi removida do cabeçalho do lead (v934)');

console.log('v887-cabecalho-metalinhas: ok');
