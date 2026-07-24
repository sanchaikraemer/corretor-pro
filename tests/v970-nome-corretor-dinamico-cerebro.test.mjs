import fs from 'node:fs';
import assert from 'node:assert/strict';

// v970 — print real do dono: card "Fazer agora" mostrava a frase "cliente esperando sua
// resposta" (em laranja) pra um lead onde, segundo ele, a última mensagem era DELE (corretor),
// não do cliente.
//
// Causa: ehMsgDoCliente(m, primeiroNomeCliente) só reconhecia o autor como "o próprio corretor"
// quando o rótulo batia EXATAMENTE com "sanchai" ou "miguel kirinus" — dois nomes CRAVADOS no
// código (violação da regra do CLAUDE.md: nome de pessoa não pode estar fixo no código, só vem
// do Cérebro ou da conversa). Se o rótulo do autor no export do WhatsApp para o próprio
// corretor for QUALQUER outra coisa (nome completo, apelido, "Você", etc.), a mensagem dele
// caía no "qualquer outro autor é o cliente" — e uma mensagem SUA virava "resposta do cliente"
// pro sistema, inclusive fazendo ele aparecer como "esperando resposta" quando na verdade quem
// falou por último foi o próprio corretor.
//
// Fix: ehMsgDoCliente passa a também reconhecer o autor como corretor quando bate com
// corretorNome (campo "Seu nome" do Cérebro, configurado pelo usuário) — não só os dois nomes
// hardcoded, que continuam valendo como fallback pra quem ainda não configurou o campo.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const businessRe = app.match(/const BUSINESS_RE = [^\n]*/)[0];
const ehManual = app.match(/function ehMsgManualTimeline\(m\)\{[\s\S]*?\n\}/);
const ehCliente = app.match(/function ehMsgDoCliente\(m, primeiroNomeCliente\)\{[\s\S]*?\n\}/);
assert.ok(ehManual && ehCliente, 'não achei ehMsgManualTimeline/ehMsgDoCliente em app.js');
assert.match(ehCliente[0], /obterCerebroConfigParaAnalise/, 'ehMsgDoCliente precisa consultar o nome do corretor configurado no Cérebro');

// Stub simples de obterCerebroConfigParaAnalise (evita depender de localStorage/DOM reais —
// testa só a integração de ehMsgDoCliente com o que a função de config devolve).
let corretorNomeConfigurado = '';
function obterCerebroConfigParaAnalise(){ return { corretorNome: corretorNomeConfigurado }; }

const { ehMsgDoCliente } = eval(`
  ${businessRe}
  ${ehManual[0]}
  ${ehCliente[0]}
  ; ({ ehMsgDoCliente })
`);

// 1. Cenário real do print: corretor configurou "Sanchai Kraemer" no Cérebro (nome completo),
// mas o WhatsApp exportou a mensagem dele com autor "Sanchai Kraemer" — não bate com o hardcoded
// EXATO "sanchai" sozinho. Sem o fix, isso virava "mensagem do cliente".
corretorNomeConfigurado = 'Sanchai Kraemer';
const msgDoCorretor = { author: 'Sanchai Kraemer', type: 'texto', text: 'Olá Jamil, tudo bem? Consegui as opções que você pediu.' };
assert.equal(ehMsgDoCliente(msgDoCorretor, 'jamil'), false, 'mensagem do corretor (nome configurado no Cérebro) não pode virar "fala do cliente"');

// 2. Mensagem real do cliente continua reconhecida normalmente.
const msgDoCliente = { author: 'Jamil Contalex', type: 'texto', text: 'Legal, me manda sim.' };
assert.equal(ehMsgDoCliente(msgDoCliente, 'jamil'), true, 'mensagem real do cliente continua batendo pelo nome dele');

// 3. Sem corretorNome configurado (campo vazio no Cérebro), o fallback hardcoded ainda funciona
// — não regride o comportamento de quem nunca preencheu o campo "Seu nome".
corretorNomeConfigurado = '';
const msgSanchaiExato = { author: 'sanchai', type: 'texto', text: 'Oi, tudo certo?' };
assert.equal(ehMsgDoCliente(msgSanchaiExato, 'jamil'), false, 'fallback hardcoded "sanchai" continua funcionando sem Cérebro configurado');

// 4. Nome do corretor tem prioridade mesmo se, por coincidência, também "contém" o nome do
// cliente como substring — não pode classificar errado nesse cruzamento raro.
corretorNomeConfigurado = 'Ana';
const msgAmbiguidade = { author: 'Ana Paula (Corretora)', type: 'texto', text: 'Vou verificar e te retorno.' };
assert.equal(ehMsgDoCliente(msgAmbiguidade, 'ana'), false, 'autor reconhecido como o próprio corretor vence, mesmo com nome parecido com o do cliente');

console.log('v970-nome-corretor-dinamico-cerebro: ok');
