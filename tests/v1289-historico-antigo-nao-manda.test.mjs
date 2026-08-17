import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// v1289 — o dono trouxe a leitura que outra IA fez da MESMA conversa da Geovana e perguntou se o
// sistema já cobria aquilo. Cobria quase tudo (v1279 e v1287), menos três coisas — e as três vinham
// do mesmo lugar: **o histórico antigo enganando a análise**.
//
//   1. Ela não RECUSOU o terreno, ela ANUNCIOU mudança de planos. A regra de "objeção que o produto
//      não resolve" (v1279) fala de recusa; mudança declarada não estava escrita em lugar nenhum,
//      então o produto abandonado podia voltar à condução.
//   2. O diagnóstico do print dizia "faixa de valor: recebeu e não refutou opções entre R$ 322.000
//      e R$ 498.000" — uma tabela de 2024, de um produto que ela já tinha trocado, e que ela nunca
//      comentou. Silêncio de dois anos virou orçamento.
//   3. "Se houver uma opção claramente superior, dizer isso": entregar duas ou três opções
//      empatadas devolve pro cliente justamente a escolha que ele procurou um corretor pra fazer.
const src = readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");

// ── 1. Mudança de planos declarada ─────────────────────────────────────────────────────────────
const i = src.indexOf("MUDANÇA DE PLANOS DECLARADA = O PRODUTO ANTIGO SAI DA CONDUÇÃO");
assert.ok(i > 0, "a regra da mudança de planos precisa existir no pedido enviado à IA");
const mudanca = src.slice(i, i + 1600).replace(/\s+/g, " ");

assert.match(mudanca, /Diferente da objeção acima \(onde o cliente RECUSA um imóvel\)/,
  "a regra precisa se distinguir da objeção — foi a brecha por onde o terreno voltava");
assert.match(mudanca, /"mudança de planos", "agora é apartamento", "desisti do terreno"/,
  "os sinais precisam estar escritos, com as palavras que o cliente usa");
assert.match(mudanca, /é a informação mais valiosa que a conversa tem/,
  "mudança de planos não é desinteresse — é o contrário, e isso precisa estar dito");
assert.match(mudanca, /É PROIBIDO retomá-lo, oferecê-lo "já que ele chegou a se interessar"/,
  "o produto antigo não pode voltar por nostalgia do histórico");
assert.match(mudanca, /O QUE FICA do histórico antigo é o que ainda vale com o critério NOVO/,
  "o histórico não é jogado fora inteiro — só o que a mudança tornou passado");
assert.match(mudanca, /o depois manda, sempre/,
  "na dúvida entre o antes e o depois da mudança, quem manda é o depois");
assert.match(mudanca, /quem manda é a última coisa que ele pediu, não a soma do que ele já olhou/,
  "cliente que voltou por vários produtos ao longo dos anos cai na mesma regra");

// ── 2. Silêncio diante de uma tabela antiga não é faixa de valor ───────────────────────────────
const j = src.indexOf('- "faixaDeValor": DEDUZA');
assert.ok(j > 0, "a instrução da faixa de valor precisa existir");
const faixa = src.slice(j, j + 1800).replace(/\s+/g, " ");

assert.match(faixa, /SILÊNCIO NÃO É ACEITE/, "o título da trava precisa estar lá");
assert.match(faixa, /Só conta como piso o valor diante do qual houve REAÇÃO do cliente/,
  "piso só nasce de reação do cliente, não de mensagem não respondida");
assert.match(faixa, /tabela de OUTRO produto, ou de um momento que a conversa já deixou pra trás/,
  "tabela de outro produto ou de outra época não descreve o bolso de hoje");
assert.match(faixa, /faz a única pergunta que destrava \(faixa de valor e entrada\) aparecer na mensagem/,
  "sem faixa confiável, o caminho certo é perguntar — é a ligação com o item 4 da conferência");
// A dedução legítima (v1259) não pode ter sido derrubada junto.
assert.match(faixa, /esse valor é TETO/, "o teto deduzido da reação do cliente continua valendo");
assert.match(faixa, /é PISO plausível/, "o piso deduzido de uma reação real continua valendo");

// ── 3. Quando apresentar opções, recomendar a que chega mais perto ────────────────────────────
const k = src.indexOf("Quando for apresentar opções, são DUAS OU");
assert.ok(k > 0, "a regra das duas ou três opções precisa existir");
const opcoes = src.slice(k, k + 1200).replace(/\s+/g, " ");

assert.match(opcoes, /se UMA delas chega mais perto do que ele pediu, DIGA QUAL e por quê/,
  "o corretor recomenda — não entrega as opções empatadas");
assert.match(opcoes, /quem entende do assunto recomenda/,
  "o motivo precisa estar escrito, senão a regra vira só mais uma linha");
assert.match(opcoes, /devolve pro cliente justamente a escolha que ele procurou um corretor pra fazer/,
  "e o estrago de não recomendar também");
assert.match(opcoes, /nunca de vantagem inventada/,
  "recomendar não abre porta pra inventar vantagem que não está nas fontes");

console.log("v1289-historico-antigo-nao-manda: ok (mudança de planos, silêncio ≠ orçamento, recomendar uma)");
