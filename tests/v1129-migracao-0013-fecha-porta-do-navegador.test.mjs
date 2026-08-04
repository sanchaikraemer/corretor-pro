import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1129 — a migração 0013 (v1128) revogava a criação de empresa só de `anon` e `authenticated`, e
// isso NÃO fechava nada: o Postgres, ao criar qualquer função, já libera a execução dela pro grupo
// `public` (todo mundo), e os dois papéis continuam podendo chamar por serem membros de `public`.
//
// Isso foi pego rodando a migração num Postgres 16 de verdade antes de o dono aplicar no banco
// dele: depois de rodar a 0013 inteira, `has_function_privilege('authenticated', 'criar_empresa_e_
// dono(...)', 'execute')` ainda respondia "sim". Ou seja, a trava contra cadastro falso em massa
// existia no servidor do app mas dava pra pular por fora, chamando o banco direto com a chave
// "anon" (que é pública, está em contas-config.js) — exatamente o furo que a migração dizia fechar.
//
// Guarda de regressão estática: qualquer REVOKE de execução nas funções de criar empresa precisa
// incluir `public`. Sem esta guarda, uma reescrita futura do bloco (ou uma migração nova no mesmo
// espírito) reabre o buraco em silêncio — nenhum teste de JavaScript enxergaria isso, e o sintoma
// no mundo real seria zero: tudo continua funcionando, só que desprotegido.

const dir = new URL('../supabase/migrations/', import.meta.url);
const arquivos = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

// 1. A migração 0013 precisa existir e precisa revogar com `public`.
const nome0013 = arquivos.find(f => f.startsWith('0013_'));
assert.ok(nome0013, 'a migração 0013 (trava de cadastro por conexão) precisa existir');
const sql0013 = fs.readFileSync(new URL(nome0013, dir), 'utf8');

const revokesDeCriarEmpresa = sql0013
  .split(/;\s*\n/)
  .filter(t => /revoke/i.test(t) && /criar_empresa_e_dono\s*\(/i.test(t));
assert.ok(revokesDeCriarEmpresa.length >= 2,
  `a 0013 precisa revogar as DUAS assinaturas de criar_empresa_e_dono (a de 1 e a de 5 parâmetros) — achei ${revokesDeCriarEmpresa.length}`);

for (const trecho of revokesDeCriarEmpresa) {
  const alvos = /from\s+([^;]+)/i.exec(trecho)?.[1] || '';
  assert.match(alvos, /\bpublic\b/i,
    `REVOKE sem "public" não fecha nada (o Postgres libera toda função nova pro grupo public). Trecho: ${trecho.trim().slice(0, 160)}`);
}

// 2. A função nova (a que só o backend usa) não pode nascer aberta pra ninguém do navegador.
const revokeDaNova = sql0013.split(/;\s*\n/).find(t => /revoke/i.test(t) && /criar_empresa_e_dono_para/i.test(t)) || '';
assert.match(revokeDaNova, /\bpublic\b/i, 'criar_empresa_e_dono_para precisa ser revogada de public antes de ser concedida ao backend');
assert.match(sql0013, /grant\s+execute\s+on\s+function\s+criar_empresa_e_dono_para[\s\S]*?to\s+service_role/i,
  'criar_empresa_e_dono_para precisa ser concedida ao service_role (é o backend que a chama)');

// 3. A tabela do contador precisa ficar com RLS ligada e SEM policy — ninguém do navegador lê nem
//    escreve nela; é contador interno, não dado de corretor.
assert.match(sql0013, /alter\s+table\s+cadastros_por_conexao\s+enable\s+row\s+level\s+security/i,
  'a tabela do contador precisa ter RLS ligada');
assert.ok(!/create\s+policy[^;]*on\s+cadastros_por_conexao/i.test(sql0013),
  'a tabela do contador não pode ganhar policy nenhuma — com RLS ligada e sem policy, o navegador não enxerga nada');

// 4. Nenhuma migração pode reconceder criar_empresa_e_dono a anon/authenticated DEPOIS da 0013
//    (seria desfazer a trava sem ninguém perceber).
for (const arq of arquivos.filter(f => f > nome0013)) {
  const sql = fs.readFileSync(new URL(arq, dir), 'utf8');
  const reconcessao = sql.split(/;\s*\n/).find(t =>
    /grant\s+execute/i.test(t) && /criar_empresa_e_dono\s*\(/i.test(t) && /(anon|authenticated|public)/i.test(t));
  assert.equal(reconcessao, undefined,
    `${arq} devolve pro navegador o direito de criar empresa, desfazendo a trava da 0013`);
}

console.log('v1129-migracao-0013-fecha-porta-do-navegador: ok');
