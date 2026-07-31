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

// 2. Todo POST de action:"etapa" escrito com valor fixo no front usa um desses dois valores
// (nunca vocabulário de funil).
// v1082 — antes esta checagem exigia "pelo menos 2" POSTs com valor fixo, e o segundo vinha da
// geração ANTIGA do arquivarLead, que estava morta desde a v1073 (código inalcançável, removido
// nesta versão). Ou seja: o teste passava olhando pra código que ninguém executava. O caminho vivo
// do Arquivar manda a etapa por variável, então ele é conferido logo abaixo, no ponto 2b.
const posts = [...app.matchAll(/action:\s*["']etapa["']\s*,\s*etapa:\s*["']([^"']+)["']/g)].map(m => m[1]);
assert.ok(posts.length >= 1, `esperava ao menos o POST de Reativar com valor fixo (achei ${posts.length})`);
for (const valor of posts) {
  assert.ok(["Ativo", "Geladeira"].includes(valor),
    `POST de etapa com valor inválido "${valor}" — o servidor rejeitaria com 400`);
}

// 2b. O Arquivar vivo (v1073) passa a etapa por variável — o valor nasce na chamada do
// arquivarLead. Confere lá, que é onde ele realmente é decidido.
const arquivarVivo = app.match(/window\.arquivarLead = function\(id, nome\)\{[\s\S]*?\n {2}\};/);
assert.ok(arquivarVivo, 'o Arquivar vivo (window.arquivarLead da v1073) precisa existir');
assert.match(arquivarVivo[0], /ui683MoverEtapaComEvento\(id, ['"]Geladeira['"]/,
  'o Arquivar precisa mandar a etapa "Geladeira" — o servidor rejeita qualquer outro valor');

// E a função que faz o POST só chama a ação "etapa" quando está arquivando de verdade.
const moverEtapa = app.match(/async function ui683MoverEtapaComEvento\(id, etapa, label, evento\)\{[\s\S]*?\n {2}\}/);
assert.ok(moverEtapa, 'ui683MoverEtapaComEvento precisa existir');
assert.match(moverEtapa[0], /const arquivando = etapa === ['"]Geladeira['"];/,
  'só "Geladeira" pode disparar a mudança de etapa no servidor');

// 3. O Reativar especificamente manda "Ativo" na linha do body (comentário explicativo pode
// citar o valor antigo — só a requisição de verdade importa).
const reativarFn = app.match(/async function reativarLeadGeladeira\(id, btn\)\{[\s\S]*?\n\}/)[0];
const linhaBody = reativarFn.split('\n').find(l => l.includes('action: "etapa"'));
assert.ok(linhaBody, 'achei a linha do body no Reativar');
assert.match(linhaBody, /etapa:\s*"Ativo"/, 'Reativar precisa mandar etapa "Ativo" na requisição');

console.log('v1073-reativar-manda-etapa-valida: ok');
