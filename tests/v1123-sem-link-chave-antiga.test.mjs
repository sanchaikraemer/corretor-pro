// v1123 — o link "Acesso por chave de segurança" saiu da tela de entrar. O caminho antigo (chave
// compartilhada, anterior às contas por login) foi DESLIGADO em produção
// (CORRETOR_PRO_LEGADO_DESLIGADO=sim na Vercel), então o servidor recusa esse acesso: quem
// clicasse no link informaria a chave e tomaria erro. Entrada única: e-mail e senha.
// Este teste impede o link de voltar sem querer numa faxina futura.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const entrar = readFileSync(path.join(raiz, "entrar.html"), "utf8");

// Fora dos comentários, não pode sobrar nem o link, nem o gatilho, nem a gravação da chave.
const semComentarios = entrar
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/^\s*\/\/.*$/gm, "");

assert.doesNotMatch(semComentarios, /linkChaveAntiga/, "o link da chave antiga não pode voltar à tela de entrar");
assert.doesNotMatch(semComentarios, /Acesso por chave de segurança/, "o texto do link não pode aparecer na tela");
assert.doesNotMatch(semComentarios, /corretor_pro_api_key_v679/, "a tela de entrar não pode mais gravar a chave antiga neste aparelho");
assert.doesNotMatch(semComentarios, /prompt\(/, "a tela de entrar não pode abrir caixinha do navegador pedindo chave");

// E o que importa continua lá: a entrada por e-mail e senha.
assert.match(entrar, /signInWithPassword/, "o login por e-mail e senha precisa continuar existindo");
assert.match(entrar, /recuperar-senha\.html/, "o link de esqueci a senha continua");
assert.match(entrar, /cadastro\.html/, "o link de criar conta continua");

console.log("v1123-sem-link-chave-antiga: ok");
