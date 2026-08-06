import fs from "node:fs";
import assert from "node:assert/strict";

// v1157 — pedido do dono, palavra dele: "quero que fechar feche pra sempre, a não ser que o app
// seja desinstalado e quando entrar no link apareça novamente. Você não consegue organizar essa
// diferença entre já instalado ou não?"
//
// A v1156 tinha resolvido o beco sem saída com prazo (7 dias). O prazo saiu: quem manda agora é o
// ESTADO REAL do aparelho. Três sinais do próprio navegador:
//   • rodando em tela cheia (pelo ícone)                    → instalado
//   • navigator.getInstalledRelatedApps() responde que sim  → instalado
//   • o navegador oferece instalar (beforeinstallprompt)     → NÃO instalado (só oferece quando o
//     app não está no aparelho)
// O app anota "está instalado" e, quando depois tem certeza de que não está, conclui: foi
// desinstalado — apaga o "fechado" e a oferta volta na próxima abertura.
//
// (Este arquivo substitui o teste da v1156, que travava a regra de 7 dias — ela não existe mais.)

const pwa = fs.readFileSync(new URL("../js/pwa-install.js", import.meta.url), "utf8");
const CHAVE_FECHADO = "direciona_banner_instalar_fechado";
const CHAVE_INSTALADO = "direciona_app_estava_instalado";

// ── A regra roda de verdade, não é só texto no arquivo ─────────────────────────────────────────
const ini = pwa.indexOf("const APP_ESTAVA_INSTALADO_KEY");
const fim = pwa.indexOf("\nfunction mostrarOpcoesInstalar(");
assert.ok(ini > -1 && fim > ini, "a regra existe e fica antes de quem a usa");
const criar = new Function("localStorage", "BANNER_INSTALAR_KEY",
  pwa.slice(ini, fim) + "\nreturn { bannerInstalarDispensado, anotarQueEstaInstalado, anotarQueNaoEstaInstalado, lerGuardado };");

function celular(inicial = {}){
  const dados = new Map(Object.entries(inicial).map(([k, v]) => [k, String(v)]));
  return {
    getItem: k => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: k => dados.delete(k),
    _tem: k => dados.has(k)
  };
}

// 1. Corretor novo: nada fechado, a oferta aparece.
{
  const ls = celular();
  assert.equal(criar(ls, CHAVE_FECHADO).bannerInstalarDispensado(), false, "sem nada fechado, oferece");
}

// 2. Fechou: fica fechado — e continua fechado depois, sem prazo nenhum.
{
  const ls = celular({ [CHAVE_FECHADO]: Date.now() });
  assert.equal(criar(ls, CHAVE_FECHADO).bannerInstalarDispensado(), true, "fechou agora: não insiste");
}
{
  // Um ano depois, com o app ainda instalado, continua fechado. (Era aqui que a v1156 reabria.)
  const ls = celular({ [CHAVE_FECHADO]: Date.now() - 365 * 24 * 60 * 60 * 1000, [CHAVE_INSTALADO]: "1" });
  assert.equal(criar(ls, CHAVE_FECHADO).bannerInstalarDispensado(), true,
    "fechar é pra sempre enquanto o app estiver no celular");
}

// 3. O CASO DO PEDIDO: estava instalado, o corretor tinha fechado o aviso, e o app foi
//    desinstalado. Na volta ao link, a oferta reaparece.
{
  const ls = celular({ [CHAVE_FECHADO]: Date.now() - 60_000, [CHAVE_INSTALADO]: "1" });
  const api = criar(ls, CHAVE_FECHADO);
  assert.equal(api.anotarQueNaoEstaInstalado(), true, "desinstalação reconhecida");
  assert.equal(ls._tem(CHAVE_FECHADO), false, "o 'fechado' é apagado");
  assert.equal(ls._tem(CHAVE_INSTALADO), false, "e o app deixa de constar como instalado");
  assert.equal(api.bannerInstalarDispensado(), false, "a oferta volta a aparecer");
}

// 4. Quem NUNCA teve o app instalado e fechou o aviso continua sem ser incomodado — "não está
//    instalado" sozinho não reabre nada, senão fechar não serviria pra nada.
{
  const ls = celular({ [CHAVE_FECHADO]: Date.now() - 60_000 });
  const api = criar(ls, CHAVE_FECHADO);
  assert.equal(api.anotarQueNaoEstaInstalado(), false, "sem instalação anterior, não é desinstalação");
  assert.equal(api.bannerInstalarDispensado(), true, "e o aviso segue fechado");
}

// 5. Instalar anota o estado (é o que permite detectar a desinstalação depois).
{
  const ls = celular();
  const api = criar(ls, CHAVE_FECHADO);
  api.anotarQueEstaInstalado();
  assert.equal(ls.getItem(CHAVE_INSTALADO), "1", "o app fica sabendo que está instalado");
}

// ── Os três sinais estão ligados nos lugares certos ───────────────────────────────────────────
assert.match(pwa, /window\.addEventListener\("appinstalled", \(\) => \{[\s\S]{0,200}anotarQueEstaInstalado\(\)/,
  "acabou de instalar → anota instalado");
assert.match(pwa, /if\(ehStandalone\) anotarQueEstaInstalado\(\);/,
  "abriu pelo ícone (tela cheia) → anota instalado");
assert.match(pwa, /const lista = await navigator\.getInstalledRelatedApps\(\);[\s\S]{0,600}anotarQueEstaInstalado\(\);/,
  "navegador confirmou que está instalado → anota instalado");
assert.match(pwa, /if\(!Array\.isArray\(lista\) \|\| !lista\.length\)\{[\s\S]{0,300}if\(anotarQueNaoEstaInstalado\(\)\) mostrarOpcoesInstalar\(\);/,
  "navegador confirmou que NÃO está instalado → se estava, a oferta volta na hora");
assert.match(pwa, /function conviteDeInstalacaoChegou\(\)\{[\s\S]{0,200}anotarQueNaoEstaInstalado\(\);/,
  "convite do navegador é prova de não instalado — e reabre a oferta depois de uma desinstalação");
{
  // Os três caminhos de convite passam pela mesma porta (senão um deles esquece de detectar).
  const usos = pwa.match(/conviteDeInstalacaoChegou\(\)/g) || [];
  assert.ok(usos.length >= 4, "definição + os três caminhos de convite usam a mesma função");
}

// ── Com o app instalado, o aviso de instalar NÃO fica na Hoje ─────────────────────────────────
// "Organizar a diferença": instalado não é hora de oferecer instalação — o cartão do Menu vira
// "Onde está meu app" e o aviso sai da tela.
{
  const ini2 = pwa.indexOf("async function conferirSeJaEstaInstalado(){");
  const fn = pwa.slice(ini2, pwa.indexOf("async function dispararInstalacao(", ini2));
  assert.match(fn, /const banner = qs\("#bannerInstalar"\); if\(banner\) banner\.style\.display = "none";/,
    "instalado: o aviso sai da Hoje");
  assert.match(fn, /bb\.textContent = "Onde está meu app"/, "e o botão passa a servir pra achar o ícone");
}

// ── Fechar grava a marca; só a desinstalação apaga ────────────────────────────────────────────
assert.match(pwa, /guardar\(BANNER_INSTALAR_KEY, String\(Date\.now\(\)\)\)/, "fechar grava a marca");
{
  const apagam = pwa.match(/apagarGuardado\(BANNER_INSTALAR_KEY\)/g) || [];
  assert.equal(apagam.length, 1, "existe um único lugar que reabre a oferta: a desinstalação");
}

console.log("v1157-fechar-e-pra-sempre-ate-desinstalar: ok");
