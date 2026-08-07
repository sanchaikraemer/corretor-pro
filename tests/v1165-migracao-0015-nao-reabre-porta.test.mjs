import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1165 — a conferência do banco de produção (07/08/2026) mostrou que a migração 0009 nunca foi
// aplicada, embora da 0010 à 0014 estejam. O reflexo óbvio seria "então roda a 0009 agora" — e
// seria um erro: no fim dela existe
//
//     grant execute on function criar_empresa_e_dono(text) to authenticated;
//
// que é exatamente o que a 0013 revogou de propósito (trava contra cadastro falso em massa).
// Aplicar a 0009 depois da 0013 desfaria a 0013 EM SILÊNCIO: nada quebra, nada aparece na tela, e
// a porta fica aberta de novo.
//
// A lição que este teste guarda: migração aplicada FORA DE ORDEM pode reabrir o que outra fechou.
// A guarda da v1163 simula as permissões na ordem dos arquivos e não enxergaria isso.

const dir = new URL('../supabase/migrations/', import.meta.url);
const arquivos = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const ler = (arq) => fs.readFileSync(new URL(arq, dir), 'utf8');

// ── 1. A 0015 precisa existir e fazer os três pedaços que faltavam da 0009 ─────────────────────
const nome0015 = arquivos.find(f => f.startsWith('0015_'));
assert.ok(nome0015, 'a migração 0015 (travas da 0009 aplicadas fora de ordem) precisa existir');
const sql0015 = ler(nome0015);

assert.match(sql0015, /memberships_um_por_usuario\s+unique\s*\(\s*user_id\s*\)/i,
  'a 0015 precisa criar a trava de uma empresa por login');
assert.match(sql0015, /alter\s+table\s+whatsapp_processamentos[\s\S]{0,120}?organization_id\s+set\s+not\s+null/i,
  'a 0015 precisa tornar a empresa obrigatória no lead');
assert.match(sql0015, /alter\s+function\s+%s\s+set\s+search_path\s*=\s*public/i,
  'a 0015 precisa fixar o search_path SEM reescrever o corpo das funções (é o que evita ressuscitar versão antiga)');

// O backfill tem que vir ANTES do "not null", senão a migração quebra em base com lead antigo.
assert.ok(sql0015.search(/update\s+whatsapp_processamentos/i) < sql0015.search(/set\s+not\s+null/i),
  'o preenchimento das linhas sem empresa precisa vir antes de tornar a coluna obrigatória');

// Login duplicado precisa parar com mensagem em português, não com erro cru de banco.
assert.match(sql0015, /raise\s+exception[\s\S]{0,200}?mais de uma empresa/i,
  'se algum login estiver em duas empresas, a 0015 precisa parar com uma mensagem clara');

// ── 2. A 0015 não pode conceder NADA ao navegador ─────────────────────────────────────────────
// Comentário citando um GRANT (esta migração explica justamente o GRANT perigoso da 0009) não é
// GRANT — a varredura olha só o SQL de verdade.
const semComentarios = (sql) => sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
for (const trecho of semComentarios(sql0015).split(/;\s*\n/)) {
  if (!/grant\s+execute/i.test(trecho)) continue;
  assert.ok(!/\b(anon|authenticated|public)\b/i.test(trecho.split(/\bto\b/i)[1] || ''),
    `a 0015 não pode liberar função nenhuma pro navegador. Trecho: ${trecho.trim().slice(0, 160)}`);
}

// ── 3. E precisa REAFIRMAR os fechamentos, pra consertar aplicação fora de ordem ───────────────
for (const fn of ['criar_empresa_e_dono', 'reservar_analise_ia', 'reservar_contador_dia']) {
  assert.match(sql0015, new RegExp(`'${fn}\\(`, 'i'),
    `a 0015 precisa reafirmar o revoke de ${fn} — é o conserto pra quem rodar uma migração antiga fora de ordem`);
}
assert.match(sql0015, /revoke\s+all\s+on\s+function\s+%s\s+from\s+public,\s*anon,\s*authenticated/i,
  'o revoke da 0015 precisa incluir public (o Postgres libera toda função nova pro grupo public por conta própria)');

// ── 4. A 0009 continua sendo perigosa de rodar sozinha: isso precisa estar dito nela ───────────
const nome0009 = arquivos.find(f => f.startsWith('0009_'));
const sql0009 = ler(nome0009);
if (/grant\s+execute\s+on\s+function\s+criar_empresa_e_dono[\s\S]{0,80}?to\s+authenticated/i.test(sql0009)) {
  assert.match(sql0009, /0015/,
    'a 0009 libera criar_empresa_e_dono pro navegador; enquanto essa linha existir, o arquivo precisa avisar que hoje se aplica a 0015 no lugar dela');
}

console.log('v1165-migracao-0015-nao-reabre-porta: ok');
