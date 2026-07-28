import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1040 — auditoria técnica/comercial, itens 5.2/5.3/5.4: nenhuma restrição no BANCO impedia
// duas empresas pro mesmo login sob concorrência (só uma checagem no código, ver migração 0006),
// organization_id em whatsapp_processamentos era opcional, e as funções SECURITY DEFINER não
// fixavam search_path. Migração 0009 corrige os três. Como não há banco real disponível nesta
// sessão (ver CLAUDE.md), este teste confirma ESTATICAMENTE que o SQL certo está presente —
// aplicar de verdade no Supabase é passo manual do dono (ver instruções no topo do arquivo).

const mig = fs.readFileSync(new URL('../supabase/migrations/0009_travas_concorrencia_e_search_path.sql', import.meta.url), 'utf8');

// 1. Restrição única de verdade contra empresa duplicada por login — não só a checagem antiga.
assert.match(mig, /alter table memberships\s*\n\s*add constraint memberships_um_por_usuario unique \(user_id\)/,
  'precisa existir uma restrição única real em memberships(user_id)');

// 2. criar_empresa_e_dono trata o unique_violation (a restrição acima vai disparar sob
// concorrência) desfazendo a organização órfã, em vez de deixar o erro estourar sem limpeza.
const funcCriarEmpresa = mig.match(/create or replace function criar_empresa_e_dono[\s\S]*?\n\$\$;/)?.[0] || '';
assert.ok(funcCriarEmpresa, 'achei a função criar_empresa_e_dono na migração');
assert.match(funcCriarEmpresa, /exception when unique_violation then/, 'precisa tratar a condição de corrida real (unique_violation), não só a checagem otimista');
assert.match(funcCriarEmpresa, /delete from organizations where id = novo_id/, 'precisa desfazer a organização órfã quando o vínculo falha por concorrência');

// 3. organization_id de whatsapp_processamentos vira obrigatório (com backfill defensivo antes,
// pro comando nunca falhar por causa de uma linha antiga esquecida).
assert.match(mig, /update whatsapp_processamentos\s*\nset organization_id = '00000000-0000-0000-0000-000000000001'\s*\nwhere organization_id is null/,
  'precisa preencher qualquer linha órfã antes de travar a coluna como obrigatória');
assert.match(mig, /alter table whatsapp_processamentos\s*\n\s*alter column organization_id set not null/,
  'organization_id de whatsapp_processamentos precisa virar NOT NULL');

// 4. As 4 funções SECURITY DEFINER do projeto fixam search_path — nenhuma delas continua sem.
for (const nomeFuncao of ['minhas_organizacoes', 'is_platform_admin', 'criar_empresa_e_dono', 'excluir_organizacao']) {
  const bloco = mig.match(new RegExp(`create or replace function ${nomeFuncao}\\([\\s\\S]*?\\n\\$\\$;`))?.[0] || '';
  assert.ok(bloco, `achei a função ${nomeFuncao} redefinida na migração 0009`);
  assert.match(bloco, /security definer/, `${nomeFuncao} precisa continuar security definer`);
  assert.match(bloco, /set search_path = public/, `${nomeFuncao} precisa fixar search_path = public`);
}

// 5. excluir_organizacao continua revogada de authenticated/anon (só o backend com service_role
// pode chamar) — a correção de search_path não pode afrouxar essa permissão.
assert.match(mig, /revoke all on function excluir_organizacao\(uuid\) from public, authenticated, anon/,
  'excluir_organizacao precisa continuar revogada de quem não é o backend');

console.log('v1040-travas-concorrencia-e-search-path: ok');
