import fs from "node:fs";
import assert from "node:assert/strict";

// v1151 — print do dono criando a SEGUNDA conta de teste: a tela mostrou
// "Erro ao criar conta: User already registered" — em inglês, cru do Supabase, sem dizer o que
// fazer. Ele está começando a vender pra corretores; um corretor que topa nisso no cadastro
// simplesmente desiste.

const cadastro = fs.readFileSync(new URL("../cadastro.html", import.meta.url), "utf8");

// ── 1. A mensagem crua não vai mais direto pra tela ────────────────────────────────────────────
assert.doesNotMatch(cadastro, /textContent = 'Erro ao criar conta: ' \+ \(e\.message \|\| e\)/,
  "o erro cru do provedor não pode mais ser jogado na tela");
assert.match(cadastro, /msg\.innerHTML = cpErroCadastroEmPortugues\(e\);/, "passa pela tradução");

// ── 2. Cada falha comum tem texto em português E o que fazer ───────────────────────────────────
const ini = cadastro.indexOf("function cpErroCadastroEmPortugues(e){");
assert.ok(ini > -1, "a tradução existe");
const fn = cadastro.slice(ini, cadastro.indexOf("\n</script>", ini));

// e-mail já cadastrado: o caso do print — precisa oferecer entrar e recuperar senha
assert.match(fn, /already registered/, "reconhece o e-mail já cadastrado");
assert.match(fn, /Esse e-mail já tem conta\./, "diz isso em português");
assert.match(fn, /entrar\.html/, "oferece entrar com esse e-mail");
assert.match(fn, /recuperar-senha\.html/, "e recuperar a senha");

for (const [padrao, oQue] of [
  [/invalid email/, "e-mail inválido"],
  [/at least|short|6 characters/, "senha curta"],
  [/rate limit|too many requests/, "muitas tentativas"],
  [/failed to fetch|networkerror/, "sem conexão"]
]) {
  assert.match(fn, padrao, `precisa reconhecer: ${oQue}`);
}
assert.match(fn, /Sem conexão\./, "fala de internet em português");
assert.match(fn, /Senha curta\./, "fala de senha em português");

// ── 3. O que não estiver na lista continua visível (nunca engolir o motivo) ────────────────────
assert.match(fn, /return 'Não consegui criar a conta agora: ' \+ cru;/,
  "falha desconhecida continua aparecendo — texto estranho é melhor que nenhuma informação");

// ── 4. A trava contra cadastro falso (que já responde em português) não é reescrita ────────────
assert.match(fn, /Trava contra cadastro falso em massa/, "a mensagem da trava do servidor é mantida como veio");

console.log("v1151-erro-de-cadastro-em-portugues: ok");
