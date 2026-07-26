import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1007 — pedidos do dono testando no celular: (1) a saudação e a lateral precisam mostrar o
// NOME de quem se cadastrou, não "corretor" genérico; (2) precisa existir "Sair da conta" pra
// trocar de login no mesmo aparelho. De quebra, saiu um nome de pessoa cravado no código da
// lateral (proibido pelas regras do projeto — todo corretor novo veria o nome do dono ali).

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.ok(!/>Sanchai</.test(index), 'nome de pessoa não pode ficar cravado no index.html');
assert.match(index, /id="cpNomeUser"/, 'a lateral precisa do espaço dinâmico pro nome da conta');
assert.match(index, /id="btnSairConta"/, 'precisa existir o botão "Sair da conta"');
assert.match(index, /Sair da conta/, 'o botão precisa se chamar "Sair da conta"');

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.match(app, /cpSairDaConta/, 'app.js precisa da função de sair da conta');
assert.match(app, /auth\?\.signOut\(\)/, 'sair da conta precisa encerrar a sessão de verdade (signOut)');
assert.match(app, /window\.location\.href = "\/entrar\.html"/, 'depois de sair, volta pra tela de entrar');
assert.match(app, /organizations\(nome\)/, 'o nome mostrado vem da conta logada (organizations.nome do cadastro)');
assert.match(app, /corretorNome \|\| window\.__cpContaNome/, 'saudação: nome do Cérebro > nome da conta > genérico');

console.log('v1007-nome-da-conta-e-sair: ok');
