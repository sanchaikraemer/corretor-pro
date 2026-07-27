import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1013 — auditoria de isolamento entre contas encontrou que o botão "Sair" do painel
// administrativo só chamava location.reload(), que recarrega a tela mas não encerra a sessão do
// Supabase — num aparelho compartilhado, a sessão de administrador continuava salva e a próxima
// pessoa que abrisse o painel entrava direto, sem pedir login de novo. Corrigido: o botão agora
// chama supabaseClient.auth.signOut() antes de recarregar (mesmo padrão do "Sair" do app
// principal, já coberto por tests/v1007-nome-da-conta-e-sair.test.mjs).

const admin = fs.readFileSync(new URL('../admin-plataforma.html', import.meta.url), 'utf8');

assert.match(admin, /onclick="sairAdmin\(\)"/, 'botão Sair do painel precisa chamar uma função que encerra a sessão, não location.reload() direto');
assert.match(admin, /async function sairAdmin\(\)\s*\{[\s\S]*?supabaseClient\.auth\.signOut\(\)[\s\S]*?location\.reload\(\)[\s\S]*?\}/,
  'sairAdmin precisa chamar supabaseClient.auth.signOut() antes de recarregar a tela');

console.log('v1013-sair-painel-admin-encerra-sessao: ok');
