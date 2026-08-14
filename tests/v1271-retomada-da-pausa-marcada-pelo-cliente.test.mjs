import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1271 — caso real do dono (print de 14/08/2026, lead que estava de viagem).
//
// A conversa: em 30/07 a cliente respondeu "estamos em viagem. No retorno gostaríamos de conhecer
// os empreendimentos. Entro em contato". Duas semanas depois, as três sugestões que chegaram na
// tela foram:
//
//   nº 1 — "Tem interesse em começar pelo [lançamento] ou prefere ver também os prontos?"
//   nº 2 — "queria entender se o foco continua sendo moradia imediata ou os lançamentos... Posso
//           agrupar os materiais principais pra facilitar a conversa com seu marido?"
//   nº 3 — "Tenho horários na próxima semana... prefere manhã ou tarde?"
//
// Três defeitos, todos confirmados pelo dono:
//
//  1. As duas primeiras PERGUNTAM O QUE ELA JÁ RESPONDEU. No dia 16/07 ela disse, com todas as
//     letras, que queria as duas coisas: opções de curto prazo E conhecer o lançamento. A pergunta
//     voltou disfarçada de escolha ("prefere A ou B?") — e escolha é justamente o fecho que o item
//     5 pede, então a IA satisfazia um item quebrando o outro.
//  2. Nenhuma das três RETOMA A PAUSA QUE A PRÓPRIA CLIENTE MARCOU. Ela avisou da viagem e disse
//     que chamaria na volta; a retomada tinha que puxar isso ("como foi a viagem?"), trazer a
//     vantagem de decidir na fase atual e propor dia. Em vez disso, abriram genéricas.
//  3. A nº 2 OFERECE MAIS MATERIAL ("agrupar os materiais principais") pra quem já tinha recebido
//     links, vídeos e tabela de disponibilidade. O item 8 (v1267) já proibia isso — mas as três
//     exceções dele diziam "deixe as três como estavam", e "cliente que não consegue ir agora"
//     encaixava na primeira. A exceção desligava a regra inteira e sobrava o vazio: sem presencial
//     e sem proibição de material, as mensagens voltavam a perguntar preferência e oferecer PDF.
//
// O texto-modelo que o dono escreveu à mão é o alvo desta versão: cumprimento + "espero que tenham
// ido bem de viagem" + o ganho de decidir na fase de pré-lançamento (melhores unidades, melhores
// vagas, melhor condição de pagamento e preço) + "podemos agendar uma reunião na construtora
// semana que vem? segunda-feira é um dia bom? qual horário?".

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

const i = src.indexOf('CONFERÊNCIA FINAL — FAÇA ISTO ANTES DE DEVOLVER O JSON');
assert.ok(i > -1, 'precisa existir a conferência final (v1263)');
const fimPrompt = src.indexOf('`;', i);
const lista = src.slice(i, fimPrompt).replace(/\s+/g, ' ');

// ── Defeito 1: a pergunta já respondida, disfarçada de escolha ─────────────────────────────────
assert.match(lista, /PERGUNTA DISFARÇADA DE ESCOLHA entre produtos que o corretor já apresentou/,
  'o item 3 precisa fechar a brecha da escolha entre produtos já apresentados');
assert.match(lista, /"quer começar pelo A ou ver também o B\?"/,
  'e precisa citar a forma real que apareceu no print do dono');
assert.match(lista, /a mensagem tem que PARTIR dela oferecendo o roteiro que cobre tudo que ele pediu/,
  'quando o cliente já disse que quer conhecer tudo, a mensagem oferece o roteiro — não devolve a decisão');

// O item 5 não pode continuar empurrando pra escolha falsa que o item 3 acabou de proibir.
assert.match(lista, /A escolha também não pode reabrir assunto que a conversa já resolveu \(item 3\)/,
  'o item 5 precisa apontar pro item 3 — era ele que legitimava a pergunta repetida');
assert.match(lista, /a escolha que sobra é de DIA, HORÁRIO ou CANAL/,
  'e precisa dizer qual escolha sobra quando o assunto já está decidido');

// ── Defeito 2: a retomada da pausa que o cliente marcou (item 9, novo) ─────────────────────────
assert.match(lista, /9\. O CLIENTE MARCOU UMA PAUSA E ELA VENCEU\?/,
  'a conferência precisa ter o item da retomada da pausa marcada pelo cliente');
assert.match(lista, /a mensagem É a\s*retomada dessa pausa — e retomada não é check-in/,
  'a retomada precisa ser nomeada como tal, e separada do check-in');

// (a) puxar o que o cliente contou — sem o voto genérico que a lista de linguagem de IA já proíbe
assert.match(lista, /PUXE O QUE ELE MESMO CONTOU/, 'parte (a): puxar o acontecimento que o cliente citou');
assert.match(lista, /"como foi a\s*viagem\?"/, 'parte (a) precisa do exemplo concreto');
assert.match(lista, /Continua PROIBIDO o voto genérico \("espero que\s*esteja tudo bem"/,
  'parte (a) não pode virar "espero que esteja tudo bem" — isso já é proibido no prompt');
assert.match(lista, /pergunte pelo fato, não deseje bem/, 'a régua da parte (a) precisa estar dita em uma linha');

// (b) a vantagem de decidir na fase atual — o miolo do texto que o dono escreveu à mão
assert.match(lista, /TRAGA A VANTAGEM DE VOLTAR AGORA, tirada da conversa ou do Cérebro/,
  'parte (b): o motivo da retomada é o ganho de decidir na fase atual');
assert.match(lista, /escolher a unidade, o andar, a posição, a vaga,\s*personalizar a planta, a condição de pagamento e o preço da fase atual/,
  'parte (b) precisa listar os ganhos concretos da fase (unidade, vaga, planta, condição, preço)');
assert.match(lista, /nada de escassez, prazo ou reajuste inventado/,
  'parte (b) não pode virar urgência inventada — o limite da v1225 continua valendo');

// (c) o encontro com dia na mesa
assert.match(lista, /PROPONHA O ENCONTRO COM DIA NA MESA/, 'parte (c): encontro com dia concreto');
assert.match(lista, /DIA NOMEADO da semana que vem/, 'parte (c) precisa exigir dia nomeado');
assert.match(lista, /mais a pergunta do horário/, 'parte (c) precisa pedir o horário');
assert.match(lista, /É PROIBIDO deixar em "quando vocês voltarem", "me avisa quando puder"/,
  'parte (c) precisa proibir as formas vagas que apareceram no print');
assert.match(lista, /Se a pausa AINDA NÃO venceu .* o encontro é\s*proposto, com dia, para a semana seguinte à volta dele/,
  'quando a pausa ainda não venceu, o desenho é o mesmo — só muda a semana');

// ── Defeito 3: a exceção não pode mais desligar a proibição de mandar material ─────────────────
assert.match(lista, /E essa parte vale\s*SEMPRE, inclusive nas exceções abaixo/,
  'a proibição de mandar mais material precisa sobreviver às exceções do item 8');
assert.match(lista, /nenhuma das três pode oferecer mandar, reunir, agrupar,\s*organizar ou reenviar arquivo\/link\/apresentação como o passo seguinte/,
  'precisa citar "agrupar" e "reunir" — foi a forma exata que apareceu na sugestão nº 2 do print');
assert.match(lista, /Nas situações abaixo o que muda é a FORMA do encontro/,
  'as exceções mudam a forma do encontro, não a regra');
assert.match(lista, /Se o que\s*ele disse foi um MARCO DE VOLTA .* não é exceção nenhuma: vale o item 9/,
  'marco de volta deixa de ser exceção e passa a cair no item 9');

// ── "Ficar à disposição" não é continuidade ───────────────────────────────────────────────────
// Cobrança do dono, no meio desta versão: "ainda sim faltou a sugestão pra visita, visto que já
// passei bastante informações, agora é necessário dar continuidade, e não (ficar a disposição)".
assert.match(lista, /"quando\s*ficar tranquilo pra vocês", "fico à disposição"/,
  'as saídas de "à disposição" precisam estar proibidas na proposta de encontro');
assert.match(lista, /Quem já mandou muita\s*informação não precisa se colocar à disposição: precisa DAR CONTINUIDADE, e continuidade é\s*dia marcado/,
  'precisa estar dito que continuidade é dia marcado, não disponibilidade');
assert.match(lista, /A retomada tem UM objetivo só: conseguir a resposta e chegar ao encontro/,
  'a retomada precisa ter objetivo único declarado');
assert.match(lista, /Não vai preço, tabela,\s*PDF nem vídeo junto/,
  'e a retomada não pode levar material junto');

// ── O pedido que partiu do próprio cliente (item 10) ──────────────────────────────────────────
// Na conversa da Patricia, o primeiro atributo que ELA levantou sozinha foi "E cobertura? Algo com
// espaço externo?". Era o critério mais valioso da conversa inteira — e sumiu das três sugestões,
// que falaram só do que o corretor queria mostrar.
assert.match(lista, /10\. O QUE O CLIENTE PEDIU POR CONTA PRÓPRIA APARECE EM ALGUMA DAS TRÊS\?/,
  'a conferência precisa ter o item do pedido espontâneo do cliente');
assert.match(lista, /pelo menos uma das três precisa tocar naquilo com as palavras dele/,
  'o pedido espontâneo precisa aparecer nas mensagens, com as palavras do cliente');
assert.match(lista, /Se aquele\s*pedido nunca foi respondido direito, respondê-lo é o melhor motivo de retomada que existe/,
  'pedido sem resposta é motivo de retomada');

// ── Os dois campos novos: extração, gravação e tela ───────────────────────────────────────────
const src2 = src.replace(/\s+/g, ' ');
assert.match(src2, /"pedidoEspontaneo": o que o cliente pediu ou perguntou POR CONTA PRÓPRIA/,
  'o campo do pedido espontâneo precisa ser pedido à IA');
assert.match(src2, /ESTE É O DADO MAIS VALIOSO DA CONVERSA INTEIRA/,
  'e precisa estar dito por que ele pesa mais que preferência suposta pelo corretor');
assert.match(src2, /"faltaDescobrir": lista curta do que AINDA falta saber/,
  'o campo da pauta que falta levantar precisa ser pedido à IA');
assert.match(src2, /ela é a PAUTA DO ENCONTRO/,
  'e precisa dizer que a pauta é do encontro, não do WhatsApp');
assert.match(src2, /"pedidoEspontaneo":"texto", "faltaDescobrir":\["texto"\]/,
  'os dois campos precisam entrar no formato JSON exigido');
assert.match(src2, /pedidoEspontaneo: clean\(d\.pedidoEspontaneo, "Não identificado"\)/,
  'o pedido espontâneo precisa ser gravado');
assert.match(src2, /faltaDescobrir: arr\(d\.faltaDescobrir\)/,
  'a pauta que falta precisa ser gravada');

// O item 4 tinha que ganhar o freio do interrogatório: a lista do que falta não vira cinco
// perguntas na mesma mensagem.
assert.match(lista, /NÃO vira interrogatório por mensagem: no\s*máximo UMA pergunta por mensagem/,
  'o item 4 precisa limitar a uma pergunta por mensagem');

// Regra da v1145: campo que não aparece na tela não é pedido à IA.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.match(app, /\['O que o cliente pediu por conta própria',cp704Semvalor\(a\?\.diagnostico\?\.pedidoEspontaneo\)\]/,
  'o pedido espontâneo precisa aparecer nos detalhes comerciais do cliente');
assert.match(app, /\['O que ainda falta descobrir',Array\.isArray\(a\?\.diagnostico\?\.faltaDescobrir\)/,
  'a pauta que falta precisa aparecer nos detalhes comerciais do cliente');

// ── Nada comercial cravado (regra da casa) ────────────────────────────────────────────────────
const bloco = lista.slice(lista.indexOf('O CLIENTE MARCOU UMA PAUSA'));
assert.doesNotMatch(bloco, /R\$|Patr[íi]cia|Personalité|Renaissance|Evolutti|Senger|Carazinho/,
  'a regra não pode citar empreendimento, construtora, preço ou nome de cliente — isso vem do Cérebro ou da conversa');

console.log('v1271-retomada-da-pausa-marcada-pelo-cliente: ok');
