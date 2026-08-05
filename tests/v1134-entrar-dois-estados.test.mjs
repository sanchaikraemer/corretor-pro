import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1134 — decisão do dono depois de comparar 4 modelos de tela de entrada: **"os dois"**.
//
// O problema: uma tela só atendia duas pessoas muito diferentes, e por isso não atendia bem
// nenhuma. Quem recebe o link do dono pela primeira vez NÃO TEM CONTA — e a primeira coisa que via
// era um formulário pedindo e-mail e senha de uma conta que não existe. Quem já é cliente, ao
// contrário, não quer ler explicação nenhuma: quer digitar a senha e entrar.
//
// Agora a mesma tela tem dois estados, e quem decide qual aparece é a memória do próprio aparelho:
//   - nunca entrou aqui  → CONVITE (o que o produto faz + um botão só: criar conta);
//   - já entrou alguma vez → LOGIN direto, sem explicação.

const html = fs.readFileSync(new URL('../entrar.html', import.meta.url), 'utf8');
const cadastro = fs.readFileSync(new URL('../cadastro.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../contas-estilo.css', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// 1) Os dois estados existem e começam escondidos — quem decide é o script, nunca o HTML.
//    Se um deles nascer visível, a pessoa vê o estado errado piscar antes da troca.
// ---------------------------------------------------------------------------
assert.match(html, /<div id="convite" style="display:none/, 'o convite precisa começar escondido');
assert.match(html, /<div id="areaLogin" style="display:none"/, 'o login precisa começar escondido');
assert.match(html, /if \(cpJaEntrouAqui\(\)\) mostrarLogin\(false\); else mostrarConvite\(\);/,
  'a decisão precisa acontecer na abertura da tela');

// ---------------------------------------------------------------------------
// 2) O convite vende: diz o que o produto faz e tem UMA ação. Nada de formulário aqui.
// ---------------------------------------------------------------------------
const convite = html.slice(html.indexOf('<div id="convite"'), html.indexOf('<div id="areaLogin"'));
assert.match(convite, /7 dias grátis/, 'o convite precisa dizer que o teste é grátis');
assert.match(convite, /sem cartão/i, 'e que não pede cartão — é o que derruba a objeção na hora');
assert.match(convite, /WhatsApp/, 'precisa dizer de onde vem o material (a conversa do WhatsApp)');
assert.match(convite, /Criar minha conta grátis/, 'a ação principal do convite é criar conta');
assert.ok(!/<input/.test(convite), 'o convite NÃO pode ter formulário — é o que afastava quem ainda não tem conta');
assert.match(convite, /Já tem conta\?[\s\S]*mostrarLogin\(true\)/,
  'quem já tem conta precisa de uma saída imediata pro login');

// ---------------------------------------------------------------------------
// 3) O login continua sendo login — e o "criar conta" deixou de ser a menor letra da tela.
// ---------------------------------------------------------------------------
const login = html.slice(html.indexOf('<div id="areaLogin"'));
assert.match(login, /id="email"/, 'o login precisa do campo de e-mail');
assert.match(login, /id="senha"/, 'e do campo de senha');
assert.match(login, /class="btn-fora"[^>]*cadastro\.html[^>]*>Criar conta grátis · 7 dias/,
  'no login, "criar conta" precisa ser BOTÃO (era um link em letra miúda no rodapé)');
assert.match(login, /class="separador-conta">ainda não tem conta\?/,
  'o botão precisa vir com a pergunta que explica pra quem ele serve');

// ---------------------------------------------------------------------------
// 4) A memória do aparelho: só entrada CONFIRMADA marca. Ver o convite, ou clicar em "Já tem
//    conta?" e desistir, não pode marcar nada — senão o próximo corretor que pegar o mesmo
//    aparelho/link nunca mais vê a tela de venda.
// ---------------------------------------------------------------------------
const marcar = (html.match(/cpMarcarQueJaEntrou\(\)/g) || []).length;
assert.equal(marcar, 2, 'cpMarcarQueJaEntrou precisa ser DEFINIDA e chamada exatamente uma vez (no login confirmado)');
const trechoSucesso = html.slice(html.indexOf('Login confirmado ✓'), html.indexOf("window.location.href = '/'"));
assert.match(trechoSucesso, /cpMarcarQueJaEntrou\(\)/,
  'o aparelho só pode ser marcado DEPOIS de o login dar certo');
const mostrarLoginFn = html.match(/function mostrarLogin\(focar\) \{[\s\S]*?\n\}/)[0];
assert.ok(!/cpMarcarQueJaEntrou/.test(mostrarLoginFn),
  'clicar em "Já tem conta?" é intenção, não prova — não pode marcar o aparelho');

// Quem acabou de criar a conta JÁ É cliente: ao voltar pra tela de entrar precisa ver o login.
assert.match(cadastro, /localStorage\.setItem\('cp-ja-entrou', '1'\)/,
  'o cadastro concluído precisa marcar o aparelho, senão o novo cliente volta a ver o convite');

// localStorage bloqueado (navegação anônima, cookies desligados) não pode quebrar a tela.
assert.match(html, /try \{ return localStorage\.getItem\(CP_JA_ENTROU\) === '1'; \} catch \(_\) \{ return false; \}/,
  'sem acesso ao armazenamento, a tela cai no convite em vez de dar erro');

// ---------------------------------------------------------------------------
// 5) No celular, abrir a tela não pode escancarar o teclado sozinho.
// ---------------------------------------------------------------------------
assert.match(mostrarLoginFn, /if \(focar\)/,
  'o foco no campo só vale quando a pessoa PEDIU o login — na abertura, não');

// ---------------------------------------------------------------------------
// 6) O estilo dos dois estados precisa existir (senão o convite sai sem forma nenhuma).
// ---------------------------------------------------------------------------
for (const regra of ['.selo-teste', 'h1.chamada', 'p.apoio', '.separador-conta', 'button.btn-fora']) {
  assert.ok(css.includes(regra), `contas-estilo.css precisa da regra ${regra}`);
}

console.log('v1134-entrar-dois-estados: ok');
