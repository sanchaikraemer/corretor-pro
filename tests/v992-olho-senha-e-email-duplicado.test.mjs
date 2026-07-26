import fs from 'node:fs';
import assert from 'node:assert/strict';

// v992 — dois achados do dono testando o cadastro de verdade:
// 1) Pediu um ícone de "olho" pra mostrar/ocultar a senha nos 3 formulários.
// 2) Ao tentar cadastrar com um e-mail que já tinha conta, a tela mostrava "Conta criada!"
//    — mensagem errada, porque o Supabase (por segurança, pra não revelar quais e-mails
//    já existem) devolve uma resposta de "sucesso" fingida nesse caso, sem sessão nem erro.

for (const arquivo of ['cadastro.html', 'entrar.html', 'admin-plataforma.html']) {
  const html = fs.readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
  assert.match(html, /class="campo-senha"/, `${arquivo} precisa envolver o campo de senha em .campo-senha`);
  assert.match(html, /class="btn-olho"/, `${arquivo} precisa ter o botão de mostrar/ocultar senha`);
  assert.match(html, /function alternarSenha\(/, `${arquivo} precisa da função alternarSenha`);
}

const cadastroSrc = fs.readFileSync(new URL('../cadastro.html', import.meta.url), 'utf8');
assert.match(cadastroSrc, /identities.*length === 0/,
  'cadastro.html precisa checar identities vazia pra saber que o e-mail já existe');
assert.match(cadastroSrc, /já tem uma conta/i,
  'cadastro.html precisa avisar claramente quando o e-mail já está cadastrado, em vez de "Conta criada!"');

const css = fs.readFileSync(new URL('../contas-estilo.css', import.meta.url), 'utf8');
assert.match(css, /\.btn-olho/, 'contas-estilo.css precisa estilizar o botão de olho');

console.log('v992-olho-senha-e-email-duplicado: ok');
