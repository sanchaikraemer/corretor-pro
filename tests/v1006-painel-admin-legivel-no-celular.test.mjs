import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1006 — o dono usou o painel administrativo no celular e a tabela ficou cortada, com os
// botões empilhados. Em tela estreita a tabela agora vira cartões (um por corretor), cada
// dado com rótulo ao lado. Este teste trava o mecanismo: os rótulos precisam existir nas
// células e o CSS precisa ter a regra de celular que os exibe.

const admin = fs.readFileSync(new URL('../admin-plataforma.html', import.meta.url), 'utf8');
for (const rotulo of ['Status', 'Dias de teste', 'Usuários', 'Criado em']) {
  assert.ok(admin.includes(`data-rotulo="${rotulo}"`), `admin-plataforma.html precisa rotular a célula "${rotulo}" pro modo celular`);
}

const css = fs.readFileSync(new URL('../contas-estilo.css', import.meta.url), 'utf8');
assert.match(css, /@media \(max-width:760px\)/, 'contas-estilo.css precisa da regra de tela estreita do painel');
assert.match(css, /attr\(data-rotulo\)/, 'no celular, cada dado precisa mostrar o rótulo vindo de data-rotulo');
assert.match(css, /\.tabela-admin thead\{ display:none; \}/, 'no celular o cabeçalho da tabela some (os rótulos vão pra cada cartão)');

console.log('v1006-painel-admin-legivel-no-celular: ok');
