import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1007 — pedidos do dono testando no celular: (1) a saudação e a lateral precisam mostrar o
// NOME de quem se cadastrou, não "corretor" genérico; (2) precisa existir "Sair da conta" pra
// trocar de login no mesmo aparelho. De quebra, saiu um nome de pessoa cravado no código da
// lateral (proibido pelas regras do projeto — todo corretor novo veria o nome do dono ali).
//
// v1024 — o cartão da conta na lateral (que tinha o espaço cpNomeUser) foi removido de vez
// (duplicava "Sair da conta", pedido repetido do dono — ver tests/v1015-...). O nome dinâmico
// da conta continua existindo, só que agora só dentro da tela Menu (cpNomeUserMenu).

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.ok(!/>Sanchai</.test(index), 'nome de pessoa não pode ficar cravado no index.html');
assert.match(index, /id="cpNomeUserMenu"/, 'a tela Menu precisa do espaço dinâmico pro nome da conta');
assert.match(index, /id="btnSairConta"/, 'precisa existir o botão "Sair da conta"');
assert.match(index, /Sair da conta/, 'o botão precisa se chamar "Sair da conta"');

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.match(app, /cpSairDaConta/, 'app.js precisa da função de sair da conta');
assert.match(app, /auth\?\.signOut\(\)/, 'sair da conta precisa encerrar a sessão de verdade (signOut)');
assert.match(app, /window\.location\.href = "\/entrar\.html"/, 'depois de sair, volta pra tela de entrar');
assert.match(app, /organizations\(nome\)/, 'o nome mostrado vem da conta logada (organizations.nome do cadastro)');
// v1183 — a ordem continua a mesma (Cérebro > conta > genérico), mas o nome do Cérebro deixou de
// ser lido de state.cerebroCfg, um campo que nunca era preenchido: a primeira opção NUNCA valia e
// todo mundo era cumprimentado pelo nome da empresa. Agora vem de cpNomeCorretorCerebro().
assert.match(app, /cpNomeCorretorCerebro\(\) \|\| window\.__cpContaNome/, 'saudação: nome do Cérebro > nome da conta > genérico');

console.log('v1007-nome-da-conta-e-sair: ok');
