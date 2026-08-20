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

// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA. Este teste guardava a "conferência final" de 12 itens do
// pedido, inclusive o item 9 (pausa marcada pelo cliente que venceu: puxar o que ele contou,
// trazer a vantagem de voltar agora, propor o encontro perguntando o dia a ele). O dono entregou
// pronta, na v1291, uma reescrita das instruções em que essa conferência virou uma "REVISÃO FINAL
// SILENCIOSA" de 10 itens, sem roteiro de pausa e sem os textos proibidos ("quando vocês
// voltarem", "fico à disposição"). Quem decide como retomar uma pausa passou a ser o Cérebro do
// corretor. O que sobrou pra guardar aqui é o que continua no produto: a revisão final existe, ela
// é a última coisa que a IA lê, e os campos que nasceram nesta versão continuam aparecendo na tela
// do cliente.

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// A revisão final continua existindo e continua sendo a última coisa do pedido.
// v1330 — o texto da revisão virou constante; o que precisa vir depois da conversa é o ponto em
// que ela é colada no pedido da leitura.
const posRevisao = pipeline.indexOf('${duasEtapas ? revisaoSoDaLeitura : revisaoCompleta}');
assert.ok(posRevisao > pipeline.indexOf('${timelineText}'),
  'a revisão final precisa vir depois da conversa — é o último item lido antes de a IA escrever');
// v1330 — os itens sobre as TRÊS MENSAGENS passaram pra revisão da etapa que escreve
// (revisaoSoDasMensagens); os itens sobre a leitura ficaram na dela. Os dois continuam existindo.
const inicioRevisaoMsg = pipeline.indexOf('const revisaoSoDasMensagens = `');
const revisaoDasMensagens = pipeline.slice(inicioRevisaoMsg, pipeline.indexOf('`;', inicioRevisaoMsg));
assert.match(revisaoDasMensagens, /As três mensagens executam a leitura acima, em vez de seguir um roteiro automático\?/,
  'a revisão final precisa conferir se as três executam a leitura, não um roteiro');
assert.match(revisaoDasMensagens, /Alguma mensagem força visita\/encontro\/proposta sem maturidade\?/,
  'e precisa conferir se alguma mensagem força encontro sem maturidade — o miolo do item da pausa');

// Regra da v1145: campo que não aparece na tela não é pedido à IA (e o que aparece continua sendo).
assert.match(app, /\['O que o cliente pediu por conta própria',cp704Semvalor\(a\?\.diagnostico\?\.pedidoEspontaneo\)\]/,
  'o pedido espontâneo precisa aparecer nos detalhes comerciais do cliente');
assert.match(app, /\['O que ainda falta descobrir',Array\.isArray\(a\?\.diagnostico\?\.faltaDescobrir\)/,
  'a pauta que falta precisa aparecer nos detalhes comerciais do cliente');
assert.match(pipeline, /"pedidoEspontaneo":"pedido\/critério que partiu do cliente por iniciativa própria/,
  'e o campo precisa continuar sendo pedido à IA');
assert.match(pipeline, /"faltaDescobrir":\["somente informações ainda abertas/,
  'idem a pauta do que falta descobrir');

// ── Nada comercial cravado (regra da casa) ────────────────────────────────────────────────────
assert.doesNotMatch(revisaoDasMensagens, /R\$|Patr[íi]cia|Personalité|Renaissance|Evolutti|Senger|Carazinho/,
  'a regra não pode citar empreendimento, construtora, preço ou nome de cliente — isso vem do Cérebro ou da conversa');

console.log('v1271-retomada-da-pausa-marcada-pelo-cliente: ok');
