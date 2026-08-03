import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1013 — auditoria de isolamento entre contas encontrou dois bugs no fluxo de conta nova:
//
// 1) cadastro.html só criava a empresa (criar_empresa_e_dono) quando signUpData.session já
//    vinha pronta. Com a confirmação de e-mail ativada no projeto Supabase, o cadastro nunca
//    tem sessão nesse momento — o login ficava pronto, mas SEM empresa nenhuma pra sempre (o
//    corretor confirmava o e-mail, entrava, e caía em "não encontrei nenhuma conta vinculada").
//    Corrigido: o nome digitado vai também em user_metadata.nome_empresa no cadastro, e
//    entrar.html cria a empresa que faltou no primeiro login de verdade (quando já existe sessão).
//
// 2) Login/backend buscavam a empresa do usuário com .limit(1) sem order() — se o mesmo login
//    tivesse mais de um vínculo, pegava "o primeiro que o banco decidisse devolver" (não
//    determinístico). Corrigido pra sempre usar order(criado_em desc) antes do limit(1)/single().
//    Também: criar_empresa_e_dono() (migração 0006) agora bloqueia um SEGUNDO vínculo pro mesmo
//    login — sem isso, era possível repetir a chamada e ganhar vários testes grátis.

const cadastro = fs.readFileSync(new URL('../cadastro.html', import.meta.url), 'utf8');
const entrar = fs.readFileSync(new URL('../entrar.html', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');
const appJs = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const migracao0006 = fs.readFileSync(new URL('../supabase/migrations/0006_uma_empresa_por_login.sql', import.meta.url), 'utf8');
const buildJs = fs.readFileSync(new URL('../build.js', import.meta.url), 'utf8');

// 1. cadastro.html salva o nome nos metadados do signUp (recuperável depois, sem sessão).
// v1117 — agora os metadados carregam também telefone/cidade/estado (ver
// tests/v1117-cadastro-contato-corretor), mas o nome continua sendo o campo essencial pro
// caminho sem sessão imediata (confirmação de e-mail ligada).
assert.match(cadastro, /data:\s*\{\s*nome_empresa:\s*nomeEmpresa/,
  'signUp precisa salvar nome_empresa em user_metadata pro caso sem sessão imediata');

// 2. entrar.html cria a empresa que faltou (lazy) quando não acha vínculo nenhum, usando o
// nome salvo — e SÓ nesse caso (não mexe em quem já tem empresa).
assert.match(entrar, /if \(!vinculo \|\| !vinculo\.organizations\)/, 'entrar.html detecta ausência de vínculo antes de tentar criar a empresa');
assert.match(entrar, /criar_empresa_e_dono/, 'entrar.html chama o mesmo RPC de criação de empresa como fallback');
assert.match(entrar, /user_metadata \|\| \{\}[\s\S]*meta\.nome_empresa/, 'entrar.html usa o nome salvo no cadastro pra criar a empresa que faltou');

// 3. Seleção de empresa é determinística (order por criado_em desc) em entrar.html, no backend
// (resolveOrganizationId) e na exibição do nome da conta em app.js — nenhum .limit(1) "cego".
assert.match(entrar, /order\('criado_em', \{ ascending: false \}\)/, 'entrar.html ordena os vínculos antes do limit(1)');
assert.match(persistence, /\.order\("criado_em", \{ ascending: false \}\)/, 'resolveOrganizationId ordena os vínculos antes do limit(1)');
assert.match(appJs, /memberships"\)\.select\("organizations\(nome\)"\)\.eq\("user_id", data\.session\.user\.id\)\.order\("criado_em", \{ ascending: false \}\)/,
  'app.js também filtra pelo próprio usuário e ordena antes de exibir o nome da conta na lateral (ver fix v1014)');

// 4. Migração 0006 impede um segundo vínculo pro mesmo login (trava a raiz do abuso de teste
// grátis múltiplo), sem apagar/alterar nada existente.
assert.match(migracao0006, /create or replace function criar_empresa_e_dono/, 'migração 0006 substitui a função existente (idempotente)');
assert.match(migracao0006, /if exists \(select 1 from memberships where user_id = auth\.uid\(\)\) then/,
  'criar_empresa_e_dono passa a checar se o login já tem vínculo antes de criar outra empresa');
assert.match(migracao0006, /raise exception 'Este login já está vinculado a uma empresa/,
  'mensagem clara de bloqueio ao tentar criar uma segunda empresa pelo mesmo login');

// 5. As duas páginas novas de recuperação de senha existem, estão ligadas a partir de entrar.html
// e entram no build.
assert.ok(fs.existsSync(new URL('../recuperar-senha.html', import.meta.url)), 'recuperar-senha.html precisa existir');
assert.ok(fs.existsSync(new URL('../redefinir-senha.html', import.meta.url)), 'redefinir-senha.html precisa existir');
assert.match(entrar, /href="recuperar-senha\.html"/, 'entrar.html precisa linkar pra recuperação de senha');
const recuperar = fs.readFileSync(new URL('../recuperar-senha.html', import.meta.url), 'utf8');
const redefinir = fs.readFileSync(new URL('../redefinir-senha.html', import.meta.url), 'utf8');
assert.match(recuperar, /resetPasswordForEmail/, 'recuperar-senha.html precisa chamar resetPasswordForEmail');
assert.match(redefinir, /updateUser\(\{\s*password:\s*senha\s*\}\)/, 'redefinir-senha.html precisa chamar updateUser com a nova senha');
assert.match(buildJs, /"recuperar-senha\.html", "redefinir-senha\.html"/, 'build.js precisa publicar as duas páginas novas');

console.log('v1013-cadastro-login-uma-empresa: ok');
