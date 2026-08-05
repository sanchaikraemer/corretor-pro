import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1031 — caso real relatado pelo dono: marcou "Wilson" como atendido (confirmado pela tela de
// Atendimentos), mas ele continuou aparecendo em "Oportunidades esquecidas" pouco depois.
//
// Causa raiz: registrarMensagemEnviada (chamada tanto pelo botão "Copiar" de dentro do lead
// aberto — cp704CopyMsg — quanto pelo card do Hoje) marcava o atendimento numa ÚNICA cópia em
// memória do lead: OU state.lead (quando o lead estava aberto) OU a entrada em itemsAtivos —
// nunca as duas. Só que abrirLead monta state.lead como um objeto SEPARADO (spread), nunca a
// MESMA referência guardada em itemsAtivos/todosLeads/leads — marcar só state.lead (o caso comum,
// copiar mensagem de DENTRO do lead) não mudava nada na entrada real que a Home lê depois pra
// montar "Oportunidades esquecidas". Fechar o lead descartava state.lead e a marcação se perdia
// de vez. Corrigido pra marcar TODAS as cópias em memória, igual ui667MarcarAtendido já fazia.

const ini = app.indexOf('async function registrarMensagemEnviada(id, msg){');
assert.ok(ini > -1, 'registrarMensagemEnviada não encontrada em app.js');
const fim = app.indexOf('\n}', ini);
const bloco = app.slice(ini, fim);

// 1. Marca o detalhe aberto (quando é o mesmo lead) E TAMBÉM cada array em memória — não mais
// um "ou outro" que deixava a entrada real da Home sem a marcação.
// v1142 — a marca local passou a levar o MESMO detalhe que o servidor grava (DETALHES_COPIA,
// de:"copiar_msg"), pra a marca da tela e a do banco não virarem dois eventos diferentes.
assert.match(bloco, /if\(state\.lead && String\(state\.lead\.id\) === String\(id\)\) ui667AplicarAtendidoLocal\(state\.lead, quando, dataLocal, horaLocal, DETALHES_COPIA\)/,
  'precisa marcar o detalhe aberto (state.lead) quando for o mesmo lead');
assert.match(bloco, /for\(const lista of \[state\.itemsAtivos, state\.todosLeads, state\.leads\]\)\{/,
  'precisa também percorrer TODOS os arrays em memória (itemsAtivos/todosLeads/leads), não só um');
assert.match(bloco, /if\(item\) ui667AplicarAtendidoLocal\(item, quando, dataLocal, horaLocal, DETALHES_COPIA\)/,
  'cada entrada encontrada nos arrays precisa ser marcada');

// 2. Depois do recarregamento, reaplica a marcação local (mesma rede de segurança do
// ui667MarcarAtendido) — sem isso, um recarregamento com dado do banco de alguns instantes
// atrás (antes da marcação persistir) apagava a marcação local de novo, silenciosamente.
// v1142 — a reaplicação continua, com duas diferenças: usa o horário CONFIRMADO pelo servidor e
// só roda quando o atendimento foi realmente gravado (antes ela ressuscitava a marca local mesmo
// depois de a gravação falhar, deixando "Atendido" na tela sem estar no banco).
assert.match(bloco, /loadRecentLeads\(false\)\.then\(\(\) => ui667ReconciliarAtendimentoLocal\(id, item => ui667AplicarAtendidoLocal\(item, quandoFinal, dataLocal, horaLocal, DETALHES_COPIA\)\)\)/,
  'precisa reaplicar a marcação local depois do recarregamento, encadeado (não solto/fire-and-forget)');
assert.match(bloco, /if\(quando && atendimentoConfirmado\)\{/,
  'a reaplicação só vale quando o servidor confirmou a gravação');

console.log('v1031 (copiar mensagem marca atendido em toda cópia): a marcação não se perde mais ao fechar o lead — ok');
