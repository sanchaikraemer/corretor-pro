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

// E a proteção ficou mais forte na v1370/v1372: além de a chamada principal não receber ordens
// para chutar agenda, o código confere deterministicamente compromisso e tempo novo na saída;
// se reprovar, o revisor pós-medição recebe a proibição explícita.
assert.match(src, /function _tipoCompromissoDaMensagem\(/,
  'o sistema precisa detectar ligação, visita, reunião e outros compromissos na mensagem gerada');
assert.match(src, /function _temTempoNovoSemBase\(/,
  'dia ou horário novo sem base no histórico precisa ser detectado pelo código');
assert.match(src, /NÃO INVENTE COMPROMISSO/,
  'o reparo precisa proibir explicitamente compromisso inventado');
assert.match(src, /Não crie "posso te ligar terça às 10h"/,
  'o revisor precisa receber o exemplo explícito de agenda inventada');
console.log('v1287-nenhuma-data-chutada: ok');
