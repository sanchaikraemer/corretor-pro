import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v985 — o dono corrigiu o Claude: ele NUNCA usa o botão de copiar rápido do card da Home
// (fixado na v984). Ele só copia a mensagem sugerida de DENTRO do lead, na seção "Fazer agora"
// (botões "Copiar" das opções 1/2/3 — window.cp704CopyMsg). E lá o bug era outro, e mais grave:
// cp704CopyMsg nunca registrava o evento "mensagem_copiada" em lugar NENHUM — só chamava
// registrarMensagemEnviada, que registra ATENDIMENTO (contato_manual), um evento totalmente
// diferente do que o Desempenho conta em "Mensagens copiadas". Ou seja: o botão de copiar mais
// usado do app inteiro nunca alimentava esse contador, em nenhuma circunstância.

const ini = app.indexOf('window.cp704CopyMsg=async function(k){');
const fim = app.indexOf('\n  };', ini) + 5;
assert.ok(ini > -1, 'window.cp704CopyMsg não encontrada em app.js (botão "Copiar" de Fazer agora)');
const bloco = app.slice(ini, fim);

assert.match(bloco, /action:\s*"aprendizado"/, 'precisa registrar o evento de aprendizado');
assert.match(bloco, /evento:\s*"mensagem_copiada"/, 'precisa registrar o evento "mensagem_copiada" (o que o Desempenho conta)');
assert.match(bloco, /id:\s*leadId/, 'precisa usar o lead aberto (state.lead) — dentro do lead, é o lead certo');

// v1097 — A ORDEM FOI INVERTIDA DE PROPÓSITO, e vale registrar por quê.
//
// Antes o contador era gravado PRIMEIRO, pra já estar salvo quando registrarMensagemEnviada
// recarregasse a lista. Só que copiar é justamente quando o corretor sai do app pro WhatsApp, e o
// celular corta os pedidos de rede de app em segundo plano — então a primeira gravação consumia a
// janela segura e o ATENDIMENTO (a segunda) se perdia. O dono relatou isso com print: "só marca
// às vezes, na segunda vez que copia".
//
// Entre perder o atendimento e o contador atualizar um instante depois, perder o atendimento é
// muito pior. Então o atendimento passou a vir primeiro.
//
// O motivo original deste teste continua protegido — só de outro jeito: depois de gravar o
// contador, a lista é atualizada DE NOVO, então o Desempenho continua certo na hora.
const idxFetchAprendizado = bloco.search(/action:\s*"aprendizado"/);
const idxRegistrarEnviada = bloco.search(/registrarMensagemEnviada\(leadId, msg\)/);
assert.ok(idxFetchAprendizado > -1 && idxRegistrarEnviada > -1 && idxRegistrarEnviada < idxFetchAprendizado,
  'o ATENDIMENTO precisa ser gravado antes do contador — é o que não pode se perder');
const depoisDoContador = bloco.slice(idxFetchAprendizado);
assert.match(depoisDoContador, /invalidarLeadsCache\(\);\s*loadRecentLeads\(true\)/,
  'depois de gravar o contador, a lista precisa ser atualizada de novo pro Desempenho não ficar atrasado');

console.log('v985-copiar-fazer-agora-registra-copia: ok');
