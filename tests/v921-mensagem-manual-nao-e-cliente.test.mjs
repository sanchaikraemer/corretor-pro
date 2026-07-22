import fs from 'node:fs';
import assert from 'node:assert/strict';

// v921 — bug do print (Mauricio Berlando): "43 dias sem resposta" (correto), mas o card
// aparecia com o badge "Cliente aguardando" (prioridade MÁXIMA) em "Fazer agora", e furava a
// proteção de 5 dias pós-atendimento — mesmo o corretor tendo retomado o contato ONTEM (copiou
// a mensagem sugerida pelo botão do hero).
//
// Causa: ao copiar uma mensagem sugerida, o app grava na timeline um item com
// author:"Mensagem enviada (você)" (ver registrarMensagemEnviada, action "mensagem_enviada").
// ehMsgDoCliente(m, nomeDoCliente) não reconhecia esse autor nem como "a empresa" (BUSINESS_RE)
// nem como o cliente pelo nome — e o código caía no padrão "em conversa individual, qualquer
// outro autor é o contato", tratando SUA PRÓPRIA mensagem copiada como se fosse resposta do
// cliente. Isso alimentava clienteAguardandoVoce=true (prioridadeAtendimento) e
// filaPorFatos() explicitamente pula a proteção de 5 dias quando clienteAguardandoVoce é true
// (linha "if(f.atendidoRecente && !f.clienteAguardandoVoce && ...)").

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const businessRe = app.match(/const BUSINESS_RE = [^\n]*/)[0];
const ehManual = app.match(/function ehMsgManualTimeline\(m\)\{[\s\S]*?\n\}/);
const ehCliente = app.match(/function ehMsgDoCliente\(m, primeiroNomeCliente\)\{[\s\S]*?\n\}/);
const filaPorFatos = app.match(/function filaPorFatos\(f = \{\}\)\{[\s\S]*?\n\}/);
assert.ok(ehManual && ehCliente && filaPorFatos, 'não achei ehMsgManualTimeline/ehMsgDoCliente/filaPorFatos em app.js');

const { ehMsgDoCliente, filaPorFatos: fpf } = eval(`
  ${businessRe}
  ${ehManual[0]}
  ${ehCliente[0]}
  ${filaPorFatos[0]}
  ; ({ ehMsgDoCliente, filaPorFatos })
`);

// 1. O item manual (cópia de mensagem sugerida) NUNCA é lido como fala do cliente, mesmo com um
// autor que não bate com a empresa nem com o nome do cliente — exatamente o caso do Mauricio.
const msgEnviada = { author: 'Mensagem enviada (você)', type: 'mensagem_enviada', source: 'manual', text: 'Boa tarde Mauricio, tudo bem?...' };
assert.equal(ehMsgDoCliente(msgEnviada, 'mauricio'), false, 'cópia de mensagem sugerida não pode virar "fala do cliente"');

// 2. Outros tipos de registro manual (nota, ligação, visita, atendimento, observação) também não contam.
for(const type of ['nota', 'ligacao', 'visita', 'atendimento', 'observacao_manual', 'proposta']){
  const m = { author: 'Qualquer Coisa', type, source: 'manual', text: 'texto qualquer' };
  assert.equal(ehMsgDoCliente(m, 'mauricio'), false, `registro manual tipo "${type}" não pode virar "fala do cliente"`);
}

// 3. Uma mensagem real do cliente (sem marcação manual) continua sendo reconhecida normalmente.
const msgReal = { author: 'Mauricio Berlando', type: 'texto', text: 'Hoje e amanha estou fora da cidade' };
assert.equal(ehMsgDoCliente(msgReal, 'mauricio'), true, 'mensagem real do cliente continua batendo pelo nome');

// 4. Efeito em filaPorFatos: com clienteAguardandoVoce correto (false) e atendimento recente
// (você copiou a mensagem ontem, dentro dos 5 dias), o lead fica protegido — não vira
// prioridade máxima "Cliente aguardando" como no bug.
const comFix = fpf({ atendidoRecente: true, clienteAguardandoVoce: false });
assert.equal(comFix.nivel, 0, 'com o autor correto reconhecido, a proteção de 5 dias funciona (nível 0)');
assert.equal(comFix.grupo, 'tratado-hoje', 'lead recém-retomado entra em "tratado-hoje", não em prioridade máxima');
assert.notEqual(comFix.titulo, 'Cliente aguardando', 'não pode aparecer como "Cliente aguardando" quando foi você quem falou por último');

// 5. Prova do bug (documentação): se clienteAguardandoVoce fosse (erradamente) true, a mesma
// proteção de 5 dias furava — é exatamente o que o autor não reconhecido causava antes do fix.
const semFix = fpf({ atendidoRecente: true, clienteAguardandoVoce: true });
assert.equal(semFix.nivel, 1, 'demonstração do bug: clienteAguardandoVoce=true fura a proteção de 5 dias');
assert.equal(semFix.titulo, 'Cliente aguardando');

console.log('v921-mensagem-manual-nao-e-cliente: ok');
