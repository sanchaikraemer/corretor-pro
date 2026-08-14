import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1263 — DIAGNÓSTICO DIFERENTE DAS ÚLTIMAS DEZ VERSÕES, e o problema era meu.
//
// Duas reanálises da MESMA conversa (lead Marina), na MESMA versão, com dez minutos de diferença:
//
//   21:45 — nº 1: "já posso montar uma lista das opções que aceitam a entrada do imóvel de vocês"
//           → abria pelo que o corretor faz, e oferecia a avaliação. Certo.
//   21:55 — nº 1: "Assim que você tiver o valor do seu imóvel, já consigo separar as opções...
//           Se preferir... me sinaliza caso prefira assim."
//           → abria com a construção-refém proibida na v1260, mais dois hedges proibidos na v1261.
//
// Mesma conversa, mesmas regras, resultados opostos. Isso não é regra faltando — é VARIAÇÃO.
//
// A causa: entre a v1253 e a v1262 eu fui empilhando bloco de proibição em cima de bloco de
// proibição. O prompt principal chegou a ~25 mil caracteres com 15 blocos de "É PROIBIDO",
// espalhados por milhares de palavras. A cada rodada a IA honra um subconjunto diferente. Escrever
// a 16ª proibição no meio do paredão ia dar exatamente no mesmo.
//
// O que muda aqui não é adicionar regra: é CONCENTRAR o que decide a qualidade das três mensagens
// numa lista curta, colocada DEPOIS da conversa — a última coisa lida antes de a IA escrever.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// ── 1. A conferência existe e é a última coisa do prompt ─────────────────────────────────────
const i = src.indexOf('CONFERÊNCIA FINAL — FAÇA ISTO ANTES DE DEVOLVER O JSON');
assert.ok(i > -1, 'precisa existir a conferência final');

const posTimeline = src.indexOf('${timelineText}');
assert.ok(posTimeline > -1 && i > posTimeline,
  'a conferência precisa vir DEPOIS da conversa — é isso que a faz pesar mais que as regras do meio do texto');

// Nada pode entrar depois dela dentro do mesmo prompt.
const fimPrompt = src.indexOf('`;', i);
const depois = src.slice(i, fimPrompt);
assert.ok(fimPrompt > i, 'não achei o fim do prompt depois da conferência');

const lista = depois.replace(/\s+/g, ' ');

// ── 2. Os sete itens, cada um amarrado a um erro real que apareceu nas reanálises ────────────
const itens = depois.match(/^\s*\d\. /gm) || [];
assert.equal(itens.length, 7, `a conferência precisa ter os 7 itens — achei ${itens.length}`);

// 1) Abertura: a nº 1 das 21:55 abria com "Assim que você tiver".
assert.match(lista, /COMEÇA PELO QUE O CORRETOR FAZ\?/, 'item 1: abertura pela ação do corretor');
assert.match(lista, /nunca um pedido \("só preciso de", "me manda", "me passa"\)/, 'item 1 precisa citar as aberturas erradas reais');

// 2) Espera: "Assim que você tiver o valor" e "me avisa que já busco" saíram das reanálises.
assert.match(lista, /ALGUMA DIZ QUE VAI ESPERAR\?/, 'item 2: ninguém pode dizer que vai esperar');
assert.match(lista, /"assim que você tiver\/conseguir", "me avisa quando souber", "fico no\s*aguardo"/,
  'item 2 precisa citar as formas reais que apareceram');

// 3) e 4) Perguntar o que já foi respondido / o que o cliente já prometeu trazer.
assert.match(lista, /PEDE ALGO QUE A CONVERSA JÁ RESPONDEU\?/, 'item 3');
assert.match(lista, /"jaSabemos", "faixaDeValor", "motivoDaMudanca" e "quemDecide"/,
  'item 3 precisa mandar conferir contra os campos criados na v1259');
assert.match(lista, /PEDE O QUE O CLIENTE JÁ PROMETEU TRAZER\?/, 'item 4');

// 5) Fecho: "Quer que eu faça esse levantamento?" fechava a nº 3 das 21:55.
assert.match(lista, /O FECHO É ESCOLHA, PERGUNTA ÚTIL OU PASSO\?/, 'item 5');
assert.match(lista, /"quer que eu faça\?"/, 'item 5 precisa citar o fecho real que apareceu');
assert.match(lista, /dois caminhos DIFERENTES de verdade/, 'item 5 precisa cobrir a escolha falsa');

// 6) e 7) Ordem das três e a quota da avaliação.
assert.match(lista, /A Nº 1 É A MAIS FORTE\?/, 'item 6');
assert.match(lista, /TEM IMÓVEL DO CLIENTE SEM VALOR CONHECIDO\?/, 'item 7');
assert.match(lista, /oferece a AVALIAÇÃO\s*feita pelo corretor/, 'item 7 precisa exigir a oferta da avaliação');

// ── 2b. O elo que faltava: as três executam o próximo passo que a análise definiu ────────────
// Na tela inteira que o dono mandou dá pra ver o diagnóstico CERTO — "Cliente procura apartamento
// menor, mas ainda com 3 dormitórios... Querem encaixar o imóvel próprio... ainda não sabem o
// valor exato... Última resposta: 'Vou ver o valor correto'" — e o Fazer agora CERTO: "Oferecer
// exemplos práticos de opções semelhantes enquanto o cliente verifica o valor e/ou facilitar a
// avaliação do imóvel atual pedindo detalhes fáceis". E, logo abaixo, três mensagens esperando a
// cliente. A análise sabia o que fazer e escreveu outra coisa: esse é o buraco entre o diagnóstico
// e a mensagem, e é o item mais importante da conferência.
assert.match(lista, /AS TRÊS MENSAGENS SÃO A EXECUÇÃO DO "nextAction" QUE VOCÊ ACABOU DE ESCREVER/,
  'a conferência precisa amarrar as mensagens ao próximo passo que a própria análise definiu');
assert.match(lista, /Se a mensagem não executa o passo que você definiu, ela está errada, por melhor que soe/,
  'e precisa dizer que soar bem não salva a mensagem que não cumpre o passo');
assert.match(lista, /Diagnóstico e mensagem têm que contar a MESMA história/,
  'o princípio precisa estar dito de forma curta');

// ── 3. A instrução é REESCREVER, não só conferir ─────────────────────────────────────────────
// Conferência que não manda corrigir vira enfeite: a IA marca tudo como ok e devolve igual.
assert.match(lista, /se qualquer item falhar, REESCREVA a mensagem/,
  'a conferência precisa mandar reescrever, não só verificar');
assert.match(lista, /Não devolva nada que não passe nos sete/,
  'e precisa fechar a porta: nada sai sem passar');
assert.match(lista, /Releia CADA UMA das três/,
  'a conferência vale mensagem por mensagem, não pro conjunto');

// ── 4. Sem informação comercial cravada ──────────────────────────────────────────────────────
assert.doesNotMatch(lista, /R\$|Personalité|Marina|430\.000|1\.450\.000/,
  'a conferência não pode carregar valor, empreendimento ou nome de cliente');

console.log('v1263-conferencia-final: ok (7 itens, depois da conversa)');
