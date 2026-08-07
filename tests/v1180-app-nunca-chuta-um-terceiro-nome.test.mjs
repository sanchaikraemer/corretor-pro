import assert from 'node:assert/strict';
import { guessLeadData } from '../api/_pipeline.js';
import { _nomeRuimIdentity } from '../api/_persistence.js';

// v1180 — a v1179 consertou o nome do cartão quando ele era o do OUTRO participante da conversa.
// O dono respondeu que a regra é mais simples e mais dura que isso:
//
//   "não tem nada a ver quem responde primeiro ou não. Se o meu nome é [o que está no Cérebro],
//    ponto final. O nome do cliente é [o contato exportado], ponto final. Não tem que estar
//    inventando um outro nome que não é nem primeiro nem segundo nem nada."
//
// E ele estava certo pelo pior dos motivos: o nome chutado ("Estevan Muller") era de um contato que
// JÁ EXISTIA na carteira dele — então a conversa do Anderson foi salva dentro do cadastro do
// Estevan. Este teste tranca as duas pontas: o app não chuta nome de terceiro, e um nome sem
// identidade nunca junta dois cadastros.

const CORRETOR = 'Rafael Prado Vieira';

// 1) O nome do Cérebro identifica o corretor mesmo escrito com menos palavras no WhatsApp.
const conversaNormal = [
  { id: 1, author: 'Rafael Prado', text: 'Bom dia! É pra morar ou investir?', type: 'text' },
  { id: 2, author: 'Anderson Fetter', text: 'Quero saber do Evolutti', type: 'text' }
];
assert.equal(guessLeadData(conversaNormal, CORRETOR, 'arquivo-renomeado.zip').clientName, 'Anderson Fetter',
  'configurou o nome completo e aparece com o nome curto: continua sendo o corretor, nunca o cliente');
assert.equal(guessLeadData(conversaNormal, 'Rafael Prado', 'arquivo-renomeado.zip').clientName, 'Anderson Fetter');

// 2) Três pessoas na conversa (o corretor da construtora entra junto): sem prova de quem é o
//    contato exportado, o app NÃO elege ninguém — não chuta o terceiro.
const conversaComTerceiro = [
  { id: 1, author: 'Estevan Muller', text: 'Pessoal, temos oportunidades novas na Senger', type: 'text' },
  { id: 2, author: 'Anderson Fetter', text: 'Queria informações do Evolutti', type: 'text' },
  { id: 3, author: 'Rafael Prado', text: 'Já te mando, Anderson', type: 'text' }
];
assert.equal(guessLeadData(conversaComTerceiro, CORRETOR, 'conversa-whatsapp.zip').clientName, 'Cliente não identificado',
  'sem saber de quem é a conversa, o cartão fica sem nome — nunca com o nome de um terceiro');
// Com o arquivo exportado, ele sabe: é o Anderson, ponto final.
assert.equal(guessLeadData(conversaComTerceiro, CORRETOR, 'Conversa do WhatsApp com Anderson Fetter.zip').clientName, 'Anderson Fetter');
// E o nome do arquivo nunca elege o corretor, nem que o arquivo diga isso.
assert.equal(guessLeadData(conversaComTerceiro, CORRETOR, 'Conversa do WhatsApp com Rafael Prado.zip').clientName, 'Cliente não identificado',
  'o corretor configurado no Cérebro não vira cliente nem pelo nome do arquivo');

// 3) A ponta que causou o estrago: "Cliente não identificado" não pode grudar dois cadastros.
assert.equal(_nomeRuimIdentity('Cliente não identificado'), true);
assert.equal(_nomeRuimIdentity('Cliente nao identificada'), true);
assert.equal(_nomeRuimIdentity('Cliente importado'), true);
assert.equal(_nomeRuimIdentity('Contato'), true);
assert.equal(_nomeRuimIdentity('Anderson Fetter'), false, 'nome de gente continua identificando o cliente');
assert.equal(_nomeRuimIdentity('Cliente Silencio'), false, 'nome real que começa com "Cliente" não pode ser descartado');

console.log('v1180-app-nunca-chuta-um-terceiro-nome: ok');
