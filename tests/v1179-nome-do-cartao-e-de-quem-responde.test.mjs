import assert from 'node:assert/strict';
import {
  guessLeadData,
  contatoDoArquivoExportado,
  nomeClienteConfirmadoPelaConversa,
  corrigirNomeDoCliente
} from '../api/_pipeline.js';

// v1179 — print do dono (07/08/2026, versão 1178): o cartão abriu com "Estevan Muller" no topo e a
// análise inteira — resumo, próximo passo e as três mensagens sugeridas — falando do Anderson, que
// é o cliente de verdade. Causa: o nome do cartão era o PRIMEIRO autor que aparecia na conversa,
// e numa prospecção ativa quem fala primeiro é o lado da empresa. Este teste trava as duas fontes
// novas de identidade e, principalmente, a regra que protege o nome digitado pelo corretor.

const timelinePrint = [
  { id: 1, author: 'Estevan Muller', text: 'Bom dia! Aqui é da Construtora Senger, temos oportunidades novas. É pra morar ou investir?', type: 'text' },
  { id: 2, author: 'Anderson Fetter', text: 'Bom dia, queria mais informações sobre o Evolutti', type: 'text' },
  { id: 3, author: 'Anderson Fetter', text: 'Pode me mandar os valores?', type: 'text' }
];
const autoresPrint = ['Estevan Muller', 'Anderson Fetter'];

// 1) Nome do arquivo exportado: o WhatsApp SEMPRE nomeia com o contato do outro lado.
assert.equal(contatoDoArquivoExportado('Conversa do WhatsApp com Anderson Fetter.zip'), 'Anderson Fetter');
assert.equal(contatoDoArquivoExportado('Conversa-do-WhatsApp-com-Anderson-Fetter-enxuto.zip'), 'Anderson Fetter');
assert.equal(contatoDoArquivoExportado('WhatsApp Chat with Anderson Fetter.txt'), 'Anderson Fetter');
assert.equal(contatoDoArquivoExportado('leads-do-mes.txt'), '',
  'arquivo sem a embalagem do WhatsApp não diz quem é o contato e não pode virar nome de cliente');

// 2) Com o nome do arquivo, a importação já nasce com o cliente certo — mesmo com o corretor
//    falando primeiro e mesmo sem o nome dele configurado no Cérebro.
assert.equal(guessLeadData(timelinePrint, '', 'Conversa do WhatsApp com Anderson Fetter.zip').clientName, 'Anderson Fetter');
// Sem nome de arquivo utilizável, continua valendo a regra antiga (primeiro autor) — é o bug do print.
assert.equal(guessLeadData(timelinePrint, '', 'export.txt').clientName, 'Estevan Muller');
// O nome do arquivo nunca inventa: se o contato dele não fala na conversa, ninguém é trocado.
assert.equal(guessLeadData(timelinePrint, '', 'Conversa do WhatsApp com Familia Praia.zip').clientName, 'Estevan Muller',
  'grupo/contato que não aparece como autor não pode virar o nome do cartão');

// 3) O nome apontado pela análise só vale se for o rótulo EXATO de quem fala na conversa.
assert.equal(nomeClienteConfirmadoPelaConversa('Anderson Fetter', autoresPrint, ''), 'Anderson Fetter');
assert.equal(nomeClienteConfirmadoPelaConversa('Anderson', autoresPrint, ''), 'Anderson Fetter',
  'nome cortado pelo WhatsApp ainda casa com o autor completo');
assert.equal(nomeClienteConfirmadoPelaConversa('João da Silva', autoresPrint, ''), '',
  'nome que não é autor da conversa (citado dentro de uma mensagem ou inventado) é descartado');
assert.equal(nomeClienteConfirmadoPelaConversa('Não identificado', autoresPrint, ''), '');
assert.equal(nomeClienteConfirmadoPelaConversa('Estevan Muller', autoresPrint, 'Estevan Muller'), '',
  'o próprio corretor configurado no Cérebro nunca vira cliente');

// 4) A correção do cartão já salvo: troca só quando o nome que está lá é o rótulo de OUTRO
//    participante da mesma conversa. Esse é o caso do print.
assert.equal(corrigirNomeDoCliente('Estevan Muller', 'Anderson Fetter', autoresPrint, ''), 'Anderson Fetter');
assert.equal(corrigirNomeDoCliente('Cliente não identificado', 'Anderson Fetter', autoresPrint, ''), 'Anderson Fetter');
// Nome digitado pelo corretor na tela "Editar" não bate com autor nenhum — é intocável.
assert.equal(corrigirNomeDoCliente('Anderson terreno NVR', 'Anderson Fetter', autoresPrint, ''), '',
  'nome curado à mão pelo corretor nunca pode ser trocado por uma reanálise');
// Sem discordância, nada muda (e nenhuma gravação é provocada à toa).
assert.equal(corrigirNomeDoCliente('Anderson Fetter', 'Anderson Fetter', autoresPrint, ''), '');
assert.equal(corrigirNomeDoCliente('Estevan Muller', '', autoresPrint, ''), '',
  'sem nome confirmado pela análise, o cartão fica exatamente como está');

// 5) Contato sem nome na agenda (só número): o rótulo e o nome do arquivo podem estar escritos
//    de jeitos diferentes e ainda assim são a mesma pessoa.
const timelineNumero = [
  { id: 1, author: 'Estevan Muller', text: 'Bom dia, é pra morar ou investir?', type: 'text' },
  { id: 2, author: '+55 54 99913-3331', text: 'quero saber do Evolutti', type: 'text' }
];
const leadNumero = guessLeadData(timelineNumero, '', 'Conversa do WhatsApp com +5554999133331.zip');
assert.equal(leadNumero.clientName, '+55 54 99913-3331');
assert.equal(leadNumero.phone, '5554999133331', 'contato não salvo na agenda ainda entrega o telefone dele');

console.log('v1179-nome-do-cartao-e-de-quem-responde: ok');
