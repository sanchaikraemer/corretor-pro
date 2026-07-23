import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

// v943 — dois pedidos do dono via print + mensagem de voz/texto explícita:
//
// 1) A ORDEM do "Fazer agora" estava errada de novo: "Henrique Leite" liderava a lista com 218
// mensagens mas contatado há só 2 dias, na frente de leads parados há 40+ dias — o dono cortou
// isso na hora: "não é mais mensagem, não é mais antigo, é uma JUNÇÃO DE FATORES que você como
// analista tem que prever". Os fatores pedidos: maior interação, quantidade de perguntas, quem
// voltou a conversar em datas diferentes, probabilidade de fechamento, quem já se falou de
// valores/condições de pagamento. cpProbabilidadeFechamento combina isso com pesos calibrados
// pra nenhum fator sozinho (principalmente volume bruto de mensagens) dominar os outros.
//
// 2) A barra de mensagens (v942) ficava toda cheia e igual numa carteira com contagens altas
// (56-218 msgs, teto fixo de 30) — sem diferenciar nada visualmente. Corrigido pra ser relativa
// ao maior da lista mostrada.

// 1a. cpProbabilidadeFechamento existe e usa os fatores pedidos.
const fnSrc = app.match(/function cpProbabilidadeFechamento\(l\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpProbabilidadeFechamento não encontrada em app.js');
const fn = fnSrc[0];
assert.match(fn, /mensagensDoCliente\(l\)/, 'usa o engajamento (mensagens do cliente)');
assert.match(fn, /l\?\.clientMessageDays/, 'usa a recorrência (dias diferentes que o cliente voltou a conversar)');
assert.match(fn, /l\?\.clientQuestionCount/, 'usa a quantidade de perguntas feitas pelo cliente');
assert.match(fn, /contextoPrioridadeIA/, 'usa o sinal de negociação avançada (valor/condição/proposta já discutidos)');

// 1b. Comportamento real: volume bruto de mensagens sem recorrência/pergunta/negociação NÃO pode
// vencer um lead com poucas mensagens mas qualificado nos outros fatores (o caso do Henrique).
const cpProbabilidadeFechamento = eval(`
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const contextoPrioridadeIA = (l) => ({ propostaAtiva: !!l.__proposta, retornoProposta: !!l.__retorno });
  ${fn}
  cpProbabilidadeFechamento;
`);
const henrique = { __msgs: 218, clientMessageDays: 1, clientQuestionCount: 0 };
const qualificado = { __msgs: 12, clientMessageDays: 6, clientQuestionCount: 4, __proposta: true, __retorno: true };
assert.ok(cpProbabilidadeFechamento(qualificado) > cpProbabilidadeFechamento(henrique),
  'recorrência + perguntas + negociação avançada precisam pesar mais que só volume de mensagens');

// 1c. O servidor calcula clientMessageDays/clientQuestionCount sobre o histórico INTEIRO (mesma
// varredura que já calcula clientMessageCount, v942) — não a prévia que chega no navegador.
assert.match(persistence, /let clientQuestionCount = 0;/, 'servidor conta perguntas do cliente');
assert.match(persistence, /const _diasComMsg = new Set\(\);/, 'servidor rastreia dias distintos com mensagem do cliente');
assert.match(persistence, /clientQuestionCount,\n\s*clientMessageDays,/, 'os dois campos são enviados no item do lead');

// 1d. cpFilaFazerAgora ordena por cpProbabilidadeFechamento (a fila usada pelo "Fazer agora" e
// "Puxar da fila").
const filaSrc = app.match(/function cpFilaFazerAgora\(items\)\{[\s\S]*?\n\}/)[0];
assert.match(filaSrc, /cpProbabilidadeFechamento\(b\) - cpProbabilidadeFechamento\(a\)/, 'a fila ordena pela probabilidade de fechamento');

// 2. Barra de mensagens relativa ao maior da lista mostrada (não um teto fixo).
const barFn = app.match(/function cpBarraMensagensMini\(l, ?maxMsgs\)\{[\s\S]*?\n\}/);
assert.ok(barFn, 'cpBarraMensagensMini não encontrada');
assert.match(barFn[0], /n \/ teto \* 100/, 'a barra é proporcional ao maior da lista (maxMsgs), não a um teto fixo');
const cpBarraMensagensMini = eval(`
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  ${barFn[0]}
  cpBarraMensagensMini;
`);
const cheia = cpBarraMensagensMini({ __msgs: 218 }, 218);
const meia = cpBarraMensagensMini({ __msgs: 56 }, 218);
const largura = (html) => Number(html.match(/width:(\d+)%/)[1]);
assert.equal(largura(cheia), 100, 'o maior da lista enche 100% da barra');
assert.ok(largura(meia) < largura(cheia), 'um lead com menos mensagens que o maior da lista tem barra menor (diferencia visualmente)');

console.log('v943-probabilidade-fechamento-junta-fatores: ok');
