import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v909 — (8) "Atualizado em…" foi pro lado da linha "de contato / sem resposta" (não mais numa
// linha própria abaixo, isso continua valendo, ver checks abaixo); (9) o lead tinha ganhado a
// metalinha "Última atualização" no cabeçalho do lead — a v934 removeu essa metalinha (o dono
// pediu pra deixar só "Última análise" lá).

// 9 (revertido em v934): a metalinha "Última atualização" não existe mais no cabeçalho do lead.
assert.doesNotMatch(app, /Última atualização — \$\{atualizadoEm\}/, 'metalinha "Última atualização" foi removida do lead (v934)');

// 8: "Atualizado em" continua como span na MESMA linha (à direita, margin-left:auto) na LISTA de
// leads (cardLeadHTML) — isso não foi tocado pela v934, é outro lugar do app.
assert.match(app, /margin-left:auto;color:var\(--muted\);font-weight:600;font-size:12px">Atualizado em /,
  '"Atualizado em" ao lado da linha de contato/sem resposta, na lista de leads');
assert.doesNotMatch(app, /<div style="font-size:11px;color:var\(--muted\);margin:1px 0 1px">Atualizado em/,
  'não fica mais numa linha própria abaixo');

console.log('v909-atualizado-em: ok');
