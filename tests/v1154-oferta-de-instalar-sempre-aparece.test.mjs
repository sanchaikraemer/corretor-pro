import fs from "node:fs";
import assert from "node:assert/strict";

// v1154 — o dono apagou o app, abriu o link de novo e: "não ofereceu pra baixar o app". Depois:
// "se mando esse link pro corretor testar e ele acessa todos meus 200 clientes? imagina a merda".
//
// Duas coisas diferentes, e as duas precisam estar travadas:
//
//  1. A OFERTA DE INSTALAR não pode depender do humor do navegador. O Chrome só dispara o convite
//     (beforeinstallprompt) quando quer — depois de desinstalar, pode demorar dias, e em alguns
//     aparelhos nunca dispara. Sem convite, o banner e o botão nem existiam: o corretor novo ficava
//     sem caminho pra instalar — e sem instalar, o app não aparece na lista de compartilhar do
//     WhatsApp, que é o caminho principal do produto.
//
//  2. O LINK NÃO DÁ ACESSO A CONTA NENHUMA. Quem abre sem login não vê dado de ninguém: a API só
//     trata uma chamada como sendo da empresa original quando ela vem com a CHAVE de segurança —
//     e essa chave nunca é publicada no site, só existe no aparelho de quem a digitou uma vez.

const pwa = fs.readFileSync(new URL("../js/pwa-install.js", import.meta.url), "utf8");
const persistencia = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");

// ── 1. A oferta aparece mesmo sem o convite do navegador ──────────────────────────────────────
assert.match(pwa, /if\(!ehStandalone\)\{[\s\S]*?mostrarOpcoesInstalar\(\);/,
  "quem não está com o app instalado sempre vê a oferta");
assert.match(pwa, /if\(!\(deferredInstallPrompt \|\| window\.__deferredInstallPrompt\)\)\{[\s\S]*?bb\.textContent = "Como instalar"/,
  "sem convite do navegador, o botão não promete download automático");
assert.match(pwa, /document\.addEventListener\("DOMContentLoaded", mostrarDeQualquerJeito, \{ once:true \}\)/,
  "funciona mesmo se o script rodar antes da tela existir");
// Quem JÁ está com o app instalado continua sem ser incomodado.
assert.match(pwa, /function mostrarOpcoesInstalar\(\)\{\s*\n\s*if\(ehStandalone\) return;/,
  "rodando como app instalado, nada de oferta");

// ── 2. Sem login, a API não entrega dado de ninguém ───────────────────────────────────────────
{
  const ini = persistencia.indexOf("export async function resolveOrganizationId(");
  const fn = persistencia.slice(ini, persistencia.indexOf("\n}", persistencia.indexOf("return EMPRESA_PRINCIPAL_ID;", ini)));
  // Com login: a empresa vem SEMPRE do vínculo daquele usuário.
  assert.match(fn, /\.from\("memberships"\)[\s\S]*?\.eq\("user_id", userData\.user\.id\)/,
    "com login, a empresa é a do vínculo daquele usuário — nunca outra");
  assert.match(fn, /if \(userError \|\| !userData\?\.user\?\.id\)[\s\S]*?401/,
    "sessão inválida é recusada");
  // Sem login: só passa com a chave de segurança; senão, nem chega na empresa original.
  const posChave = fn.indexOf("if (!requireApiKey(req, res)) return null;");
  const posEmpresa = fn.indexOf("return EMPRESA_PRINCIPAL_ID;");
  assert.ok(posChave > -1 && posEmpresa > posChave,
    "sem login, a empresa original só é usada DEPOIS de a chave de segurança ser conferida");
}
// A chave nunca é publicada no site: o app só a lê do aparelho de quem a digitou uma vez.
{
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /const STORAGE_KEY="?corretor_pro_api_key_v679"?|const STORAGE_KEY = "corretor_pro_api_key_v679"/,
    "a chave vive no aparelho (localStorage), não no código");
  assert.match(app, /function getKey\(\)\{[\s\S]*?localStorage\.getItem\(STORAGE_KEY\)/,
    "e é lida de lá");
  // Nenhum valor de chave cravado no código publicado.
  for (const arquivo of ["../app.js", "../index.html", "../contas-config.js"]) {
    const src = fs.readFileSync(new URL(arquivo, import.meta.url), "utf8");
    assert.doesNotMatch(src, /CORRETOR_PRO_API_KEY\s*=\s*["'][^"']{8,}["']/,
      `nenhuma chave de segurança pode estar escrita em ${arquivo}`);
  }
}

console.log("v1154-oferta-de-instalar-sempre-aparece: ok");
