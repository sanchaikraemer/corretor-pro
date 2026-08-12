// v1127 — caso real (lead Gilmar, Renaissance/Premium Office, 04/08/2026).
//
// O corretor perguntou "Posso te mostrar alternativas que possam encaixar melhor no seu orçamento?"
// e o cliente respondeu "Bom dia, pode sim". Mesmo assim, DUAS das três sugestões voltaram a pedir a
// MESMA permissão ("Posso sugerir algumas alternativas...?" e "Já posso te encaminhar os detalhes
// dessas alternativas?"), e uma delas ainda devolvia a autorização em linguagem de cartório
// ("Recebi sua autorização para trazer opções"). Resultado prático: o cliente autoriza, recebe outro
// pedido de autorização e a conversa esfria.
//
// Além disso, nenhuma das três retomava a pergunta de qualificação que o próprio corretor tinha
// feito em 30/04 e o cliente NUNCA respondeu ("Esse perfil fica mais dentro do q vc busca?", sobre
// uma opção a partir de 470 mil) — ou seja, a faixa de valor dele seguia desconhecida e nenhuma
// mensagem ia atrás dela.
//
// Este teste trava as duas regras no prompt fixo da análise (a base que vai junto do Cérebro do
// corretor, sem tocar no Cérebro dele).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pipeline = readFileSync(path.join(raiz, "api", "_pipeline.js"), "utf8");

// --- Regra 1: autorização já dada não pode ser pedida de novo -------------------------------------

assert.match(pipeline, /CLIENTE JÁ DISSE SIM — NÃO PEÇA A MESMA PERMISSÃO DE NOVO/,
  "o prompt da análise precisa ter o bloco que proíbe repedir uma permissão já concedida");

// A regra tem que reconhecer as formas reais de dizer sim no WhatsApp, incluindo a do caso original.
for (const sim of ["pode sim", "pode mandar", "manda aí", "quero sim", "pode ser"]) {
  assert.ok(pipeline.includes(`"${sim}"`),
    `a regra precisa reconhecer "${sim}" como autorização já dada`);
}

// E tem que valer para as TRÊS mensagens, não só para a recomendada.
assert.match(pipeline, /NENHUMA das três\s*\n?mensagens pode voltar a pedir a mesma permissão/,
  "a proibição precisa valer para as três sugestões");

// As frases exatas que saíram erradas no caso real precisam estar citadas como exemplo do que não fazer.
// v1240 — os seis blocos que repetiam esta ideia viraram um só, e o texto foi reescrito. A regra
// é a mesma; o que muda aqui é onde ela mora.
for (const errada of ["posso te mostrar?", "posso te enviar?", "já posso encaminhar?", "posso sugerir?"]) {
  assert.ok(pipeline.replace(/\s+/g, " ").includes(errada),
    `a regra precisa citar o pedido repetido "${errada.replace(/\n/g, " ")}" como exemplo proibido`);
}

// A pergunta que falta não pode SUBSTITUIR a entrega — ela vem emendada nela.
assert.match(pipeline, /a pergunta vem junto da entrega, nunca no lugar\s*\n?dela/,
  "a regra precisa dizer que a pergunta que falta vem junto da entrega, não no lugar dela");
assert.match(pipeline, /o envio nunca fica condicionado a uma nova autorização/,
  "a regra precisa proibir condicionar o envio a uma segunda autorização");

// --- Regra 1b: nada de linguagem de protocolo ----------------------------------------------------

assert.ok(pipeline.includes('"recebi sua autorização"'),
  'a regra precisa banir devolver a autorização em linguagem de cartório ("recebi sua autorização")');
assert.match(pipeline, /no WhatsApp isso soa burocrático/,
  "a regra precisa explicar por que a linguagem de protocolo não serve no WhatsApp");

// --- Regra 2: pergunta do corretor que o cliente nunca respondeu ----------------------------------

assert.match(pipeline, /PERGUNTA DO CORRETOR SEM RESPOSTA:/,
  "o prompt precisa ter o bloco sobre pergunta de qualificação que ficou sem resposta");
assert.match(pipeline, /esse dado\s*\n?continua DESCONHECIDO/,
  "o dado não respondido precisa ser tratado como desconhecido");
assert.match(pipeline, /não presuma o valor pelo produto que foi oferecido/,
  "o prompt precisa proibir presumir a faixa de valor pelo produto que o corretor ofereceu");
assert.match(pipeline, /priorize-a entre as\s*\n?três mensagens/,
  "retomar a pergunta em aberto precisa ser priorizada entre as três mensagens");

// --- As duas regras convivem: a segunda não pode reabrir a porta que a primeira fechou ------------

assert.match(pipeline, /respeitando a regra acima: emendada na entrega, não como novo pedido de permissão/,
  "a regra da pergunta em aberto precisa apontar de volta para a regra do 'já disse sim'");

// --- As regras entram no prompt REAL da análise, não num trecho morto ------------------------------

const inicioPrompt = pipeline.indexOf("const prompt = `Execute a análise usando o Cérebro Comercial");
assert.ok(inicioPrompt > 0, "não achei o prompt da análise");
const fimPrompt = pipeline.indexOf("CONVERSA COMPLETA:", inicioPrompt);
assert.ok(fimPrompt > inicioPrompt, "não achei o fim do prompt da análise");
const corpoPrompt = pipeline.slice(inicioPrompt, fimPrompt);

assert.ok(corpoPrompt.includes("CLIENTE JÁ DISSE SIM — NÃO PEÇA A MESMA PERMISSÃO DE NOVO"),
  "a regra do 'já disse sim' precisa estar DENTRO do prompt enviado na análise");
assert.ok(corpoPrompt.includes("PERGUNTA DO CORRETOR SEM RESPOSTA:"),
  "a regra da pergunta sem resposta precisa estar DENTRO do prompt enviado na análise");

// O Cérebro do corretor continua sendo a autoridade — a base nova não pode ter virado uma regra
// que se declara acima dele.
assert.match(pipeline, /O conteúdo atual do Cérebro Comercial abaixo é a única autoridade sobre análise, estratégia e criação das mensagens\./,
  "o Cérebro do corretor precisa continuar sendo a autoridade sobre as mensagens");

console.log("v1127-cliente-ja-disse-sim-nao-repede-permissao: ok");
