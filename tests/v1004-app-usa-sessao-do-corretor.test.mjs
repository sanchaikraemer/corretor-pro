import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1004 — a ligação final: quem loga por entrar.html cai no sistema completo, e o app passa a
// mandar a sessão daquele corretor (Authorization: Bearer) em toda chamada à API — o servidor
// então mostra só os dados dele (v997–v1003). Sem sessão, tudo segue como sempre foi (chave
// compartilhada), pra nada mudar nos aparelhos que já usam o sistema hoje.

// 1. index.html carrega o supabase vendorizado + config antes do app.js (com cache-busting).
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /vendor\/supabase\.js\?v=__VERSION__/, 'index.html precisa carregar o supabase-js vendorizado com ?v=');
assert.match(index, /contas-config\.js\?v=__VERSION__/, 'index.html precisa carregar contas-config.js com ?v=');
const posSupabase = index.indexOf('vendor/supabase.js');
const posConfig = index.indexOf('contas-config.js');
const posApp = index.indexOf('/app.js');
assert.ok(posSupabase < posApp && posConfig < posApp, 'supabase.js e contas-config.js precisam vir ANTES do app.js');

// 2. app.js: o interceptador de chamadas anexa o Bearer da sessão quando ela existe,
// mantém a chave compartilhada como caminho antigo, e trata sessão vencida/conta bloqueada
// voltando pra tela de entrar (nunca pro pedido de chave compartilhada).
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.match(app, /getSessionToken/, 'app.js precisa ler a sessão do corretor logado');
assert.match(app, /headers\.set\("Authorization", `Bearer \$\{token\}`\)/, 'app.js precisa anexar Authorization: Bearer nas chamadas à API quando há sessão');
assert.match(app, /X-Corretor-Pro-Key/, 'o caminho antigo da chave compartilhada precisa continuar existindo');
assert.match(app, /window\.location\.href = "\/entrar\.html"/, 'sessão vencida/conta bloqueada precisa voltar pra tela de entrar');
assert.match(app, /bloqueado === true/, 'o 403 de conta bloqueada (v1003) precisa ser reconhecido');
// A sessão nunca pode ser criada com outra chave que não a anon (a service_role jamais no navegador).
assert.match(app, /CORRETOR_PRO_SUPABASE_ANON_KEY/, 'o cliente do navegador só pode usar a anon key');

// 3. A migração 0005 (um Cérebro por corretor, em definitivo) precisa existir e trocar a
// identidade da tabela de configuração pra "por corretor + chave".
const mig = fs.readFileSync(new URL('../supabase/migrations/0005_abrir_cerebro_multiconta.sql', import.meta.url), 'utf8');
assert.match(mig, /drop constraint if exists direciona_config_pkey/, 'a migração 0005 precisa remover a chave única global antiga');
assert.match(mig, /add primary key \(organization_id, chave\)/, 'a migração 0005 precisa criar a identidade nova por corretor + chave');
assert.match(mig, /set not null/, 'organization_id precisa virar obrigatório');

console.log('v1004-app-usa-sessao-do-corretor: ok');
