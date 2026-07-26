import fs from 'node:fs';
import assert from 'node:assert/strict';

// v995 — o dono deixou claro: o Corretor Pro é pra corretores individuais, não pra imobiliárias
// ou empresas com equipe. As páginas de cadastro/login/admin ainda falavam em "empresa" e
// "imobiliária" (herança de quando o sistema de contas foi desenhado pensando em várias pessoas
// por conta). Este teste garante que essa linguagem não volta por engano numa próxima edição.

const cadastro = fs.readFileSync(new URL('../cadastro.html', import.meta.url), 'utf8');
assert.ok(!/imobili[aá]ria/i.test(cadastro), 'cadastro.html não pode falar em "imobiliária" — o produto é pra corretor individual');
assert.match(cadastro, /Seu nome</, 'cadastro.html precisa pedir o nome do corretor, não "nome da empresa"');

const entrar = fs.readFileSync(new URL('../entrar.html', import.meta.url), 'utf8');
assert.ok(!/imobili[aá]ria/i.test(entrar), 'entrar.html não pode falar em "imobiliária"');

const admin = fs.readFileSync(new URL('../admin-plataforma.html', import.meta.url), 'utf8');
assert.match(admin, /<th>Corretor<\/th>/, 'admin-plataforma.html precisa listar "Corretor", não "Empresa"');

console.log('v995-produto-e-pra-corretor-individual: ok');
