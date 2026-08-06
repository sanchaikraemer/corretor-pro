import fs from "node:fs";
import assert from "node:assert/strict";

// v1156 — "tô sem app instalado e ainda não me oferece pra baixar app" (com a v1155 na tela).
//
// Desta vez não era o navegador: era o app. O aviso de instalar tem um "✕" (e um "Continuar na
// web"), e quem tocasse UMA vez gravava um "fechado" ETERNO naquele celular. A oferta nunca mais
// voltava — nem depois de desinstalar o app, nem em versão nova. Ou seja, a promessa da v1154 ("a
// oferta aparece sempre") não valia justamente pra quem já usava o produto, incluindo o dono.
//
// Agora fechar só descansa a oferta por 7 dias, e o "eterno" gravado pelas versões antigas é
// apagado no primeiro carregamento — a oferta volta na hora pra quem estava travado.

const pwa = fs.readFileSync(new URL("../js/pwa-install.js", import.meta.url), "utf8");
const CHAVE = "direciona_banner_instalar_fechado";
const DIA = 24 * 60 * 60 * 1000;

// ── A regra roda de verdade (não é só texto no arquivo) ───────────────────────────────────────
const ini = pwa.indexOf("const BANNER_INSTALAR_DIAS =");
const fim = pwa.indexOf("\nfunction mostrarOpcoesInstalar(");
assert.ok(ini > -1 && fim > ini, "a regra de dispensa existe e fica antes de quem a usa");
const criar = new Function("localStorage", "BANNER_INSTALAR_KEY",
  pwa.slice(ini, fim) + "\nreturn bannerInstalarDispensado;");

function memoria(valorInicial){
  const dados = new Map();
  if(valorInicial !== undefined) dados.set(CHAVE, String(valorInicial));
  return {
    getItem: k => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: k => dados.delete(k),
    _tem: k => dados.has(k)
  };
}

// 1. Corretor novo, nada gravado: a oferta aparece.
{
  const ls = memoria();
  assert.equal(criar(ls, CHAVE)(), false, "sem nada gravado, a oferta aparece");
}

// 2. O CASO DO DONO: "fechado pra sempre" gravado pelas versões antigas. Volta a aparecer AGORA,
//    e o registro velho é apagado pra não assombrar de novo.
{
  const ls = memoria("1");
  assert.equal(criar(ls, CHAVE)(), false, "o 'fechado pra sempre' antigo não vale mais");
  assert.equal(ls._tem(CHAVE), false, "e é apagado do celular");
}

// 3. Fechou agora: descansa (não fica insistindo na mesma visita).
{
  const ls = memoria(Date.now());
  assert.equal(criar(ls, CHAVE)(), true, "fechou agora, não insiste");
}
{
  const ls = memoria(Date.now() - 3 * DIA);
  assert.equal(criar(ls, CHAVE)(), true, "3 dias depois ainda está descansando");
}

// 4. Passados os 7 dias, a oferta volta sozinha.
{
  const ls = memoria(Date.now() - 8 * DIA);
  assert.equal(criar(ls, CHAVE)(), false, "depois de 7 dias a oferta volta");
}

// ── O "✕" grava QUANDO foi fechado, não um "pra sempre" ───────────────────────────────────────
assert.match(pwa, /localStorage\.setItem\(BANNER_INSTALAR_KEY, String\(Date\.now\(\)\)\)/,
  "fechar grava a data, que é o que permite voltar depois");
assert.doesNotMatch(pwa, /setItem\(BANNER_INSTALAR_KEY, "1"\)/, "nada de 'fechado pra sempre'");

// ── O caminho pelo Menu nunca depende disso ───────────────────────────────────────────────────
// Mesmo com o banner descansando, "Instalar app" continua no Menu — nunca fica sem saída.
{
  const corpo = pwa.slice(pwa.indexOf("function mostrarOpcoesInstalar(){"), pwa.indexOf("function esconderOpcoesInstalar("));
  const posBotao = corpo.indexOf('qs("#btnInstalarApp")');
  const posBanner = corpo.indexOf("bannerInstalarDispensado()");
  assert.ok(posBotao > -1 && posBanner > posBotao,
    "o botão do Menu aparece ANTES e FORA da checagem de dispensa — ele nunca some");
}

console.log("v1156-oferta-de-instalar-volta-depois-de-fechada: ok");
