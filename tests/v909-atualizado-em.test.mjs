import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v909 — (8) "Atualizado em…" foi pro lado da linha "de contato / sem resposta" (não mais numa
// linha própria abaixo); (9) o lead ganhou a metalinha "Última atualização".

// 9: metalinha "Última atualização" no lead, a partir do updatedAt.
assert.match(app, /const atualizadoEm=\(typeof fmtUltimaAtualizacao==='function' && lead\?\.updatedAt\)\?fmtUltimaAtualizacao\(lead\.updatedAt\):''/,
  'existe a data de última atualização');
assert.match(app, /Última atualização — \$\{atualizadoEm\}/, 'metalinha "Última atualização" no lead');
assert.match(app, /!analiseEm&&!last&&!atendimento&&!atualizadoEm/, 'o "Sem data" considera a atualização');

// 8: "Atualizado em" agora é um span na MESMA linha (à direita, margin-left:auto), não um div solto.
assert.match(app, /margin-left:auto;color:var\(--muted\);font-weight:600;font-size:12px">Atualizado em /,
  '"Atualizado em" ao lado da linha de contato/sem resposta');
assert.doesNotMatch(app, /<div style="font-size:11px;color:var\(--muted\);margin:1px 0 1px">Atualizado em/,
  'não fica mais numa linha própria abaixo');

console.log('v909-atualizado-em: ok');
