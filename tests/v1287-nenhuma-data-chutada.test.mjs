import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v1287 — "PARE DE CHUTAR DATAS PARA AGENDAMENTO, ISSO ESTA INCOMODANDO AS MINHAS PROGRAMAÇÕES"
// (dono, 17/08/2026). Dez trechos do pedido mandavam a IA cravar dia e hora ("quinta às 18h ou
// sábado de manhã"), e o corretor recebia o cliente aceitando um horário em que ele não podia.
//
// v1291 — a "REGRA DA DATA — QUEM DÁ O DIA É O CLIENTE" saiu na reescrita das instruções entregue
// pelo dono. O essencial deste teste continua valendo e continua sendo checado: NENHUM trecho do
// pedido pode voltar a mandar a IA cravar dia ou horário. A agenda do corretor não está na conversa.

const inicioPrompt = src.indexOf('const systemPromptAnalise = `');
const fimPrompt = src.indexOf('REVISÃO FINAL SILENCIOSA');
assert.ok(inicioPrompt > 0 && fimPrompt > inicioPrompt, 'não achei os limites do pedido enviado à IA');
const pedido = src.slice(inicioPrompt, fimPrompt);

const CHUTES_PROIBIDOS = [
  /quinta às 18h/,
  /prefere quinta ou sábado/,
  /DIA NOMEADO/,
  /segunda-feira fica bom pra vocês/,
  /dois dias\/horários concretos/,
  /duas opções concretas de dia ou horário/,
  /dois dias ou\s*horários concretos/,
  /com dia, para a semana seguinte/
];
for (const padrao of CHUTES_PROIBIDOS) {
  assert.doesNotMatch(pedido, padrao,
    `o pedido voltou a mandar a IA cravar dia/hora (${padrao}) — é exatamente o que o dono mandou acabar na v1287`);
}

// E o que entra no lugar continua sendo proporcional: nada de forçar encontro antes da hora.
assert.match(pedido, /NÃO INVENTE COMPROMISSO/,
  'sem data chutada, ligação, visita e reunião continuam proibidas sem base real');
assert.match(pedido, /Não crie "posso te ligar terça às 10h"/,
  'a própria regra das mensagens precisa exemplificar que agenda inventada continua proibida');
console.log('v1287-nenhuma-data-chutada: ok');
