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

// ── 3. v1155 — sem convite do navegador, o "Como instalar" mostra o caminho COM DESENHO ───────
// "Como que essa merda não está baixando se antes funcionava?" — não é o app: o botão de um toque
// só existe quando o navegador convida, e o Chrome para de convidar depois que a pessoa
// desinstala. O caminho pelo menu do navegador sempre funciona, então ele deixou de ser uma linha
// de texto e virou passo a passo ilustrado.
{
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(pwa, /if\(typeof window\.cpMostrarComoInstalar === "function"\)\{ window\.cpMostrarComoInstalar\(\); return; \}/,
    "sem convite, abre o passo a passo ilustrado");
  assert.match(app, /window\.cpMostrarComoInstalar = function\(\)\{/, "o passo a passo existe");
  assert.match(app, /const CP1155_PASSOS_ANDROID = \[/, "com o caminho do Android");
  assert.match(app, /const CP1155_PASSOS_IOS = \[/, "e o do iPhone");
  assert.match(app, /“Instalar app”/, "Android: o nome real da opção");
  assert.match(app, /“Adicionar à Tela de Início”/, "iPhone: o nome real da opção");
  assert.equal((app.match(/desenho: \(\) => cp1149Telinha\(/g) || []).length, 6, "todos os passos de instalação têm desenho");
  // Quando o convite chega DEPOIS, o rótulo volta a prometer o que é verdade.
  assert.match(pwa, /const bb = qs\("#bannerInstalarBtn"\); if\(bb && !ehIOS\(\)\) bb\.textContent = "Baixar app";/,
    "convite que chega depois devolve o rótulo 'Baixar app'");
}

// ── 4. v1155 — "antes baixava no botão instalar, agora não mais" ──────────────────────────────
// No Android, tirar o ícone da tela inicial NÃO desinstala o app. O navegador continua vendo o
// Corretor Pro como instalado e nunca mais oferece baixar — nenhum site consegue forçar isso. O
// app precisa DESCOBRIR essa situação e dizer a verdade (onde o ícone está / como desinstalar de
// verdade), em vez de ensinar a instalar o que já existe.
{
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));

  // A descoberta só é possível com o manifest declarando o próprio app como "app relacionado".
  assert.equal(manifest.prefer_related_applications, false,
    "o app preferido é o próprio site — se virasse true o navegador PARARIA de oferecer instalar");
  assert.deepEqual(manifest.related_applications, [{ platform: "webapp", url: "/manifest.json" }],
    "o manifest aponta pra ele mesmo, que é o que permite perguntar 'já estou instalado?'");

  assert.match(pwa, /navigator\.getInstalledRelatedApps/, "o app pergunta ao navegador se já está instalado");
  assert.match(pwa, /if\(ehStandalone \|\| typeof navigator\.getInstalledRelatedApps !== "function"\) return;/,
    "navegador que não sabe responder (iPhone) não quebra nada");
  assert.match(pwa, /bb\.textContent = "Onde está meu app"/,
    "quando já está instalado, o botão para de prometer download");
  assert.match(pwa, /window\.cpAppJaInstaladoNoAparelho = \(\) => appJaInstaladoNoAparelho;/,
    "o passo a passo consegue consultar isso");
  assert.match(app, /const jaInstalado = \(typeof window\.cpAppJaInstaladoNoAparelho === "function"\) && window\.cpAppJaInstaladoNoAparelho\(\);/,
    "e consulta");
  assert.match(app, /const passos = jaInstalado \? \[CP1155_PASSO_JA_INSTALADO, \.\.\.base\] : base;/,
    "nesse caso a explicação certa vem PRIMEIRO, antes de ensinar a instalar");
  assert.match(app, /gaveta de apps/, "diz onde o ícone foi parar");
  assert.match(app, /Configurações → Apps → Corretor Pro/, "e como desinstalar de verdade, se for o caso");

  // O convite do navegador vale UM toque só: depois de recusado, o botão não pode continuar
  // prometendo "Baixar app" — foi exatamente essa promessa quebrada que o dono viu.
  assert.match(pwa, /if\(escolha\?\.outcome !== "accepted"\)\{[\s\S]{0,140}bb\.textContent = "Como instalar"/,
    "convite recusado/fechado devolve o rótulo honesto");
}

console.log("v1154-oferta-de-instalar-sempre-aparece: ok");
