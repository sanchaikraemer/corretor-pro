import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1016 — quatro pedidos do dono na mesma mensagem, todos sobre a experiência de uso do site:
//
// 1) A saudação da Home escrevia "Bom dia, corretor!" (nome genérico, às cegas) assim que a
//    página abria, antes de saber o nome de verdade — e trocava de novo assim que os dados
//    chegavam. O dono via esse texto errado "piscando" a cada carregamento/troca de conta e
//    considerou isso "carregando coisa à toa". O placeholder cego foi removido: o título fica
//    parado no "Hoje" estático do HTML até renderSaudacao() escrever o nome de verdade.
// 2) "Total de mensagens" mostrava o histórico INTEIRO da conversa (às vezes anos), destoando
//    do resto da tela (que já fala em dias/meses recentes). Pedido explícito, feito de novo
//    porque a primeira vez só ficou anotado como pendência (ver NOTAS-v1014.md) e não foi feito.
//    Agora o servidor conta também os últimos 90 dias (messageCount90d, na mesma varredura, sem
//    custo extra) e a tela passa a mostrar esse número.
// 3) O cartão da conta na lateral (setinha "⌄", corrigido na v1015 pra virar botão) agora clica
//    e sai IMEDIATAMENTE — o dono esperava uma confirmação antes ("deseja sair?"), já que a
//    setinha sugere que "abre" algo. Existia um confirm() nativo do navegador, mas a "tela feia"
//    do navegador não deixava claro que era uma pergunta de verdade — trocado pelo modal com a
//    cara do próprio app (cp903Confirm), igual ao usado em arquivar/perder lead.
// 4) Bug de isolamento entre contas reaparecendo com DUAS abas do site abertas no mesmo
//    navegador (uma por conta): a sessão de login fica numa gaveta (localStorage) compartilhada
//    por todas as abas da mesma origem. Ao logar numa conta na aba nova, a aba ANTIGA (ainda
//    aberta com a conta de antes) pode renovar sozinha o próprio login em segundo plano segundos
//    depois e sobrescrever a gaveta com a sessão antiga de novo — a aba nova então busca os leads
//    já com o login errado (mesmo mostrando o nome certo na saudação, que já tinha carregado
//    antes disso acontecer). Toda aba agora escuta essa gaveta: se OUTRA aba muda o login
//    guardado nela, a aba recarrega sozinha na hora, então nenhuma aba velha consegue "brigar"
//    pela conta certa depois.

const appJs = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

// 1) placeholder cego removido
assert.doesNotMatch(appJs, /el\.textContent\s*=\s*\(h<12\?"Bom dia":h<18\?"Boa tarde":"Boa noite"\)\+", corretor!"/,
  'o placeholder genérico "Bom dia, corretor!" escrito às cegas antes dos dados carregarem precisa ter sido removido');

// 2) messageCount90d calculado no servidor (mesma varredura, sem passada extra) e usado na exibição
// v1017 — a varredura ganhou um cache (_statsCache); messageCount90d agora é declarado uma vez
// fora do if/cache e zerado dentro do ramo que recalcula (sem "let" de novo ali).
assert.match(persistence, /messageCount90d = 0;/, 'precisa existir o contador de mensagens dos últimos 90 dias');
assert.match(persistence, /cutoff90d/, 'precisa existir o corte de 90 dias usado no filtro');
assert.match(persistence, /messageCount90d,\s*\n\s*clientMessageCount,/,
  'messageCount90d precisa estar no objeto retornado pro cliente, junto dos outros contadores');
// messageCount (histórico completo) não pode ter sido removido — ranking/dedupe interno ainda usa ele
assert.match(persistence, /messageCount: timeline\.length,/, 'messageCount (histórico completo) precisa continuar existindo pro uso interno (ranking)');

assert.match(appJs, /function totalMensagensLead\(l\)\{/, 'totalMensagensLead precisa continuar existindo');
const iniFn = appJs.indexOf('function totalMensagensLead(l){');
const fimFn = appJs.indexOf('\n}', iniFn);
const fnBody = appJs.slice(iniFn, fimFn);
assert.match(fnBody, /messageCount90d/, 'a exibição pro corretor precisa priorizar messageCount90d (últimos 90 dias)');

// 3) confirmação temática ao sair, no lugar do confirm() nativo
assert.match(appJs, /window\.cpSairDaConta = async function\(\)\{[\s\S]{0,400}cp903Confirm\(\{[\s\S]{0,200}\}\)/,
  'cpSairDaConta precisa usar o modal cp903Confirm (com a cara do app) em vez do confirm() nativo do navegador');
assert.match(appJs, /titulo: "Sair da conta"/, 'o modal de sair precisa ter um título claro');
assert.match(appJs, /perigo: true/, 'o botão de confirmar saída precisa ficar marcado como ação de risco (perigo)');

// 4) recarrega sozinho quando outra aba troca o login guardado no navegador (evita "brigar" pela conta certa)
assert.match(appJs, /addEventListener\("storage", \(ev\) => \{ if \(ev\.key && ev\.key\.includes\("auth-token"\)\) location\.reload\(\); \}\);/,
  'precisa existir um listener de "storage" que recarrega a aba quando outra aba troca a sessão de login guardada');

console.log('v1016-saudacao-flash-90dias-confirmacao-sair-abas: ok');
