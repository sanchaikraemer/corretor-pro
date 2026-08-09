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
// filaPorFatos() explicitamente pulava a proteção de 5 dias quando clienteAguardandoVoce era true.
//
// v1190 — a segunda metade dessa causa deixou de existir: NÃO HÁ MAIS prioridade nenhuma baseada
// em "quem falou por último" (ver NOTAS-v1190.md). O que este teste protege continua valendo e
// importa mais do que nunca: um registro manual seu (cópia de mensagem, nota, ligação, visita)
// NUNCA pode ser lido como fala do cliente — quem faz essa leitura errada é a contagem de
// mensagens do cliente, o "Aguardando cliente" e o texto da conversa que vai pra IA.

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

// 4. Efeito em filaPorFatos: com atendimento recente (você copiou a mensagem ontem, dentro dos
// 5 dias), o lead fica protegido — não vira prioridade máxima como no bug.
const comFix = fpf({ atendidoRecente: true });
assert.equal(comFix.nivel, 0, 'com o autor correto reconhecido, a proteção de 5 dias funciona (nível 0)');
assert.equal(comFix.grupo, 'tratado-hoje', 'lead recém-retomado entra em "tratado-hoje", não em prioridade máxima');

// 5. v1190 — a rota de fuga do bug foi fechada na raiz: mesmo que alguém volte a marcar
// "o cliente falou por último", a proteção de 5 dias NÃO fura mais. Antes isto devolvia nível 1
// com o título "Cliente aguardando".
const aindaProtegido = fpf({ atendidoRecente: true, clienteAguardandoVoce: true });
assert.equal(aindaProtegido.nivel, 0, 'nem marcando o sinal antigo o descanso pós-atendimento pode ser furado');
assert.equal(aindaProtegido.grupo, 'tratado-hoje');
assert.notEqual(aindaProtegido.titulo, 'Cliente aguardando', 'o título "Cliente aguardando" não existe mais em lugar nenhum');

console.log('v921-mensagem-manual-nao-e-cliente: ok');
