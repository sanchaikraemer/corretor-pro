import fs from "node:fs";
import assert from "node:assert/strict";
import {
  TENTATIVAS_ENVIO,
  classificarFalhaEnvio,
  enviarComRetentativa,
  falhaDeEnvio
} from "../js/envio-retentativa.js";

// v1227 — três correções da revisão completa de 12/08/2026 (pedido do dono: "revise o sistema
// inteiro em busca de outros erros"). Cada bloco abaixo prende uma delas.

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. A queda de conexão na hora de PEDIR A URL NOVA também gasta tentativa — não estoura o laço.
//
// Cenário real da v1217 que ficou de fora: a rede cai no meio do envio, o laço espera 3s e pede
// uma URL nova — mas a internet ainda não voltou. Esse pedido falhava com um erro cru que escapava
// do laço: das 3 tentativas prometidas, o dono via 1.
// ══════════════════════════════════════════════════════════════════════════════════════════════

// URL falha (rede) nas 2 primeiras, funciona na 3ª → o envio completa sem erro.
{
  let pedidas = 0, envios = 0, esperas = [];
  const resultado = await enviarComRetentativa({
    totalMb: 54,
    pedirUrl: () => {
      pedidas++;
      if (pedidas <= 2) throw classificarFalhaEnvio({ tipo: "rede", totalMb: 54 });
      return { signedUrl: "https://exemplo/ok" };
    },
    enviar: () => { envios++; },
    esperar: (ms) => { esperas.push(ms); }
  });
  assert.equal(resultado.signedUrl, "https://exemplo/ok", "a 3ª tentativa tem que completar o envio");
  assert.equal(pedidas, 3, "a URL precisa ser pedida de novo a cada tentativa");
  assert.equal(envios, 1, "o envio de verdade só acontece quando a URL veio");
  assert.deepEqual(esperas, [3000, 6000], "espera progressiva entre as tentativas (3s, 6s)");
}

// URL falha (rede) em TODAS → desiste com a mensagem que explica (não com erro cru em inglês).
{
  await assert.rejects(
    enviarComRetentativa({
      totalMb: 54,
      pedirUrl: () => { throw classificarFalhaEnvio({ tipo: "rede", totalMb: 54 }); },
      enviar: () => {},
      esperar: () => {}
    }),
    (err) => /não deu certo em 3 tentativas/.test(err.message),
    "acabaram as tentativas: a mensagem tem que ser a de desistência, com a dica do Wi-Fi"
  );
}

// Falha que NÃO é de conexão no pedido da URL (ex.: servidor recusou o arquivo) não é repetida —
// repetir daria o mesmo resultado e só faria o dono esperar à toa.
{
  let pedidas = 0;
  await assert.rejects(
    enviarComRetentativa({
      totalMb: 54,
      pedirUrl: () => { pedidas++; throw falhaDeEnvio("Arquivo recusado.", { podeTentarDeNovo: false }); },
      enviar: () => {},
      esperar: () => {}
    }),
    /Arquivo recusado/
  );
  assert.equal(pedidas, 1, "recusa definitiva não gasta as outras tentativas");
}

assert.equal(TENTATIVAS_ENVIO, 3);
console.log("v1227 (reenvio: queda de rede ao pedir a URL nova): ok");

// A tela realmente marca essa queda como repetível (é o que liga o caso real ao laço acima).
const importacao = fs.readFileSync(new URL("../js/importacao.js", import.meta.url), "utf8");
assert.match(importacao, /catch\(_\)\{\s*(\/\/[^\n]*\n\s*)*throw classificarFalhaEnvio\(\{ tipo:"rede", totalMb \}\);/,
  "o fetch de criar-upload-url precisa converter queda de rede em falha repetível (classificarFalhaEnvio tipo rede)");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. Texto livre dentro de onclick='...' passa por safeJson (apóstrofo não estoura o atributo).
//
// JSON.stringify não escapa aspas simples: um cliente chamado "D'Angelo" (ou um compromisso com
// "caixa d'água" na descrição) fechava o atributo no meio — o botão quebrava e o resto do texto
// virava atributos soltos na página (injeção via conteúdo importado do WhatsApp).
// ══════════════════════════════════════════════════════════════════════════════════════════════
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(app, /onclick='arquivarLead\(\$\{idJs\},\$\{safeJson\(String\(l\?\.name \|\| ""\)\)\}\)'/,
  "o botão 'Arquivar este lead' (aviso de cadência) precisa passar o NOME por safeJson");
assert.doesNotMatch(app, /onclick='arquivarLead\(\$\{idJs\},\$\{JSON\.stringify/,
  "nenhum arquivarLead pode voltar a interpolar nome com JSON.stringify dentro de onclick simples");
for (const trecho of app.match(/const keyJs = [^\n]+/g) || []) {
  assert.ok(trecho.includes("safeJson("),
    `toda chave de compromisso usada em onclick precisa de safeJson (achado: ${trecho.trim()})`);
}

// safeJson de verdade neutraliza o apóstrofo (garantia de comportamento, não só de escrita).
const { safeJson } = await import("../js/dom.js");
assert.ok(!safeJson("D'Angelo").includes("'"), "safeJson não pode deixar apóstrofo cru");

console.log("v1227 (apóstrofo em onclick: safeJson): ok");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. O número na aba do navegador usa a MESMA conta do sino (fonte única cpAgendaDoDia).
//
// renderResumoDia fazia a própria soma — lembrete de hoje SEM descontar quem já foi atendido —
// e a aba ficava "(1) Corretor Pro" com o sino zerado (a doença de dois relógios da v1215,
// que sobrou neste canto).
// ══════════════════════════════════════════════════════════════════════════════════════════════
assert.match(app, /document\.title = state\.agendaCount > 0 \? `\(\$\{state\.agendaCount\}\) Corretor Pro` : "Corretor Pro";/,
  "o título da aba tem que sair de state.agendaCount (a conta do sino), dentro de atualizarSinoAgenda");
assert.equal((app.match(/document\.title = /g) || []).length, 1,
  "só pode existir UM lugar em app.js escrevendo o contador no título — dois lugares foi o que causou a divergência");
assert.doesNotMatch(app, /compHoje \+ lembretesVenceram/,
  "a soma própria do renderResumoDia (compHoje + lembretesVenceram) não pode voltar");

console.log("v1227 (título da aba = conta do sino): ok");
