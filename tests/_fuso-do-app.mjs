// v1337 — AS FUNÇÕES DE FUSO DO APP, DISPONÍVEIS PROS TESTES QUE RODAM PEDAÇOS DO app.js.
//
// Vários testes desta pasta extraem uma função do app.js por expressão regular e a executam com
// eval — é assim que eles conseguem testar lógica de um arquivo que não é um módulo. Quando o fuso
// deixou de estar cravado ("America/Sao_Paulo" escrito 35 vezes) e passou a sair de cpFuso(), esses
// pedaços perderam a função de vista e quebravam com "cpFuso is not defined".
//
// Este arquivo resolve isso do jeito honesto: pega as funções REAIS do app.js (não uma cópia
// escrita à mão, que poderia divergir em silêncio) e as deixa visíveis para o eval. Basta o teste
// escrever `import "./_fuso-do-app.mjs";` no topo.
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function pegar(regex, nome) {
  const achado = app.match(regex);
  if (!achado) throw new Error(`_fuso-do-app: não encontrei ${nome} no app.js`);
  return achado[0];
}

const fonte = [
  pegar(/const CP_FUSO_PADRAO = "[^"]+";/, "CP_FUSO_PADRAO"),
  pegar(/let _cpFusoCache = null;/, "_cpFusoCache"),
  pegar(/function cpFusoValido\(tz\)\{[\s\S]*?\n\}/, "cpFusoValido"),
  pegar(/function cpFusoDoAparelho\(\)\{[\s\S]*?\n\}/, "cpFusoDoAparelho"),
  pegar(/function cpFuso\(\)\{[\s\S]*?\n\}/, "cpFuso"),
  pegar(/function cpDeslocamentoDoFusoMs\(quando, tz\)\{[\s\S]*?\n\}/, "cpDeslocamentoDoFusoMs"),
  pegar(/function cpMeiaNoiteMs\(y, m, d, tz = cpFuso\(\)\)\{[\s\S]*?\n\}/, "cpMeiaNoiteMs")
].join("\n");

// eval indireto: as declarações caem no escopo global, que é onde o eval dos testes vai procurar.
(0, eval)(fonte + "\nglobalThis.CP_FUSO_PADRAO = CP_FUSO_PADRAO;\nglobalThis.cpFusoValido = cpFusoValido;\nglobalThis.cpFusoDoAparelho = cpFusoDoAparelho;\nglobalThis.cpFuso = cpFuso;\nglobalThis.cpDeslocamentoDoFusoMs = cpDeslocamentoDoFusoMs;\nglobalThis.cpMeiaNoiteMs = cpMeiaNoiteMs;");

export const FUSO_DO_APP = globalThis.cpFuso();
