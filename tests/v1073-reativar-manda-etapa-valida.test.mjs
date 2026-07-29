import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1073 — achado da revisão noturna: o botão "Reativar" (tela Arquivados) ainda mandava
// etapa "Atendimento" pro servidor — um valor de funil que deixou de existir na v1069
// (api/lead-update.js só aceita "Ativo"/"Geladeira" e responde 400 pra qualquer outro).
// Na prática o Reativar SEMPRE falharia com "Erro ao reativar." desde a v1069. Corrigido pra
// mandar "Ativo". Este teste trava os DOIS lados: o front só manda valores válidos, e a lista
// de valores válidos do servidor continua sendo exatamente essa.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');

// 1. O servidor aceita só Ativo/Geladeira.
assert.match(leadUpdate, /const ETAPAS_VALIDAS = \["Ativo", "Geladeira"\];/,
  'servidor precisa continuar aceitando só Ativo/Geladeira');

// 2. Todo POST de action:"etapa" no front usa um desses dois valores (nunca vocabulário de funil).
const posts = [...app.matchAll(/action:\s*["']etapa["']\s*,\s*etapa:\s*["']([^"']+)["']/g)].map(m => m[1]);
assert.ok(posts.length >= 2, `esperava pelo menos os POSTs de Reativar e Arquivar (achei ${posts.length})`);
for (const valor of posts) {
  assert.ok(["Ativo", "Geladeira"].includes(valor),
    `POST de etapa com valor inválido "${valor}" — o servidor rejeitaria com 400`);
}

// 3. O Reativar especificamente manda "Ativo" na linha do body (comentário explicativo pode
// citar o valor antigo — só a requisição de verdade importa).
const reativarFn = app.match(/async function reativarLeadGeladeira\(id, btn\)\{[\s\S]*?\n\}/)[0];
const linhaBody = reativarFn.split('\n').find(l => l.includes('action: "etapa"'));
assert.ok(linhaBody, 'achei a linha do body no Reativar');
assert.match(linhaBody, /etapa:\s*"Ativo"/, 'Reativar precisa mandar etapa "Ativo" na requisição');

console.log('v1073-reativar-manda-etapa-valida: ok');
