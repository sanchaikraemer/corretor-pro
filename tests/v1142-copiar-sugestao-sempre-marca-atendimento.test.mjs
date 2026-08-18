import fs from "node:fs";
import assert from "node:assert/strict";

// v1142 — "clico em copiar sugestão de msg e não é sempre que marca atendimento" (print do dono,
// 05/08/2026 17:33: copiou a sugestão e o botão do cliente continuava "Marcar"). Duas causas
// diferentes, as duas com cara de intermitência:
//
//   1. TELA: a marcação otimista só existia na memória. Quem redesenhava o cliente era o
//      recarregamento pela REDE no fim de registrarMensagemEnviada — se ele demorasse, falhasse
//      ou fosse cortado (celular indo pro WhatsApp), ninguém redesenhava e o botão ficava em
//      "Marcar" mesmo com o atendimento gravado. O botão "Marcar atendimento" nunca teve isso
//      porque redesenha na hora.
//   2. UM SEGUNDO BOTÃO "COPIAR": o do card "Resposta pronta pra enviar" (tela de importação,
//      #copyMessage) registrava só o contador de mensagens copiadas — nunca marcava atendimento.
//      Mesma ação do corretor, dois comportamentos diferentes.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const ini = app.indexOf("async function registrarMensagemEnviada(id, msg){");
assert.ok(ini > -1, "registrarMensagemEnviada precisa existir");
// v1293 — o marcador de fim era `window.copiarMensagemLead` (copiar do card da Home), removido
// na faxina por estar sem botão nenhum. O bloco medido aqui continua o mesmo.
const fim = app.indexOf('\n// v1095 — "Oportunidades esquecidas" REMOVIDA', ini);
assert.ok(fim > ini, "sanidade: fim do bloco de registrarMensagemEnviada");
const bloco = app.slice(ini, fim);

// ── 1. Repinta a tela ANTES de qualquer ida à rede ─────────────────────────────────────────────
{
  const idxRepintarDef = bloco.indexOf("const repintarLead = ");
  const idxPrimeiraChamada = bloco.indexOf("repintarLead();");
  const idxRede = bloco.indexOf("await registrarAtendimentoDaCopia()");
  assert.ok(idxRepintarDef > -1 && idxPrimeiraChamada > idxRepintarDef, "precisa existir a repintura local");
  assert.ok(idxRede > -1 && idxPrimeiraChamada < idxRede,
    "a tela precisa mostrar o atendimento ANTES da rede — é o que sobrevive ao celular indo pro WhatsApp");
  assert.match(bloco, /renderLeadFoco\(state\.lead\)/, "a repintura usa a mesma função do botão Marcar");
}

// ── 2. Três tentativas com prazo de 30s, igual ao botão "Marcar atendimento" ───────────────────
{
  assert.match(bloco, /\}, 30000\);/, "a gravação do atendimento espera 30s (era 15s)");
  assert.match(bloco, /for\(let tentativa=1; tentativa<=3 && !atendimentoConfirmado; tentativa\+\+\)/,
    "3 tentativas — mesma teimosia do botão Marcar");
  assert.match(bloco, /keepalive:true/, "keepalive continua (v1097): o pedido termina mesmo com o app no fundo");
  // A confirmação é o CORPO da resposta (ok:true), não só o status HTTP.
  assert.match(bloco, /if\(resp\.ok && dados\?\.ok\) atendimentoConfirmado = dados;/,
    "só conta como gravado quando o servidor confirma no corpo da resposta");
}

// ── 3. Falha definitiva DESFAZ a marca local (a tela não mente nos dois sentidos) ──────────────
{
  const idxElse = bloco.indexOf("}else{");
  assert.ok(idxElse > -1, "precisa existir o caminho de falha");
  const falha = bloco.slice(idxElse);
  assert.match(falha, /evs\.filter\(e => !\(e\?\.quando === quando && e\?\.detalhes\?\.de === "copiar_msg"\)\)/,
    "desfaz SÓ o evento desta cópia — atendimento de outro momento do dia continua valendo");
  assert.match(falha, /repintarLead\(\);/, "repinta depois de desfazer");
  assert.match(falha, /NÃO consegui registrar o atendimento/, "avisa o corretor com o que fazer");
}

// ── 4. A reaplicação depois do recarregamento só acontece se FOI gravado ───────────────────────
assert.match(bloco, /if\(quando && atendimentoConfirmado\)\{/,
  "sem confirmação, nada de ressuscitar a marca local (era o que deixava 'Atendido' na tela sem estar no banco)");
assert.match(bloco, /ui667AplicarAtendidoLocal\(item, quandoFinal, dataLocal, horaLocal, DETALHES_COPIA\)/,
  "a reaplicação usa o horário confirmado pelo servidor e o mesmo detalhe da cópia");

// ── 5. A marca local usa o MESMO detalhe que o servidor grava ──────────────────────────────────
assert.match(bloco, /const DETALHES_COPIA = \{ tipo:"Mensagem enviada", de:"copiar_msg" \}/,
  "detalhe igual ao do servidor (api/reanalisar-lead.js), pra não virarem dois eventos diferentes");
const servidor = fs.readFileSync(new URL("../api/reanalisar-lead.js", import.meta.url), "utf8");
assert.match(servidor, /detalhes: \{ tipo: "Mensagem enviada", de: "copiar_msg" \}/,
  "o servidor continua gravando o atendimento da cópia com esse detalhe");

// ── 6. TODO botão de copiar sugestão marca atendimento ────────────────────────────────────────
{
  // (a) "Fazer agora", dentro do cliente
  const cp704 = app.slice(app.indexOf("window.cp704CopyMsg=async function(k){"));
  assert.match(cp704.slice(0, cp704.indexOf("\n  };")), /registrarMensagemEnviada\(leadId, msg\)/,
    "copiar dentro do cliente marca atendimento");
  // (b) v1293 — o copiar do CARD DA HOME saiu: a função existia, mas nenhum botão a chamava
  // (conferido na revisão de 18/08/2026). Os dois caminhos que o corretor usa de verdade estão
  // aqui em (a) e (c), e é neles que a regra "atendimento antes do contador" tem que valer.
  assert.ok(!app.includes("window.copiarMensagemLead"),
    "o copiar do card da Home foi removido na v1293; se voltar, precisa voltar com botão e com esta checagem");
  // (c) card "Resposta pronta pra enviar" da tela de importação — o furo desta versão
  const legado = app.slice(app.indexOf('qs("#copyMessage").addEventListener'));
  const blocoLegado = legado.slice(0, legado.indexOf("\n});") + 4);
  assert.match(blocoLegado, /registrarMensagemEnviada\(state\.lead\?\.id, textoCopiado\)/,
    "copiar na tela de importação também marca atendimento");
  const idxAtend = blocoLegado.indexOf("registrarMensagemEnviada");
  const idxContador = blocoLegado.indexOf('registrarAprendizado("mensagem_copiada")');
  assert.ok(idxAtend > -1 && idxContador > idxAtend,
    "atendimento antes do contador (lição da v1097: se só uma gravação sobreviver, que seja a que importa)");
}

console.log("v1142-copiar-sugestao-sempre-marca-atendimento: ok");
