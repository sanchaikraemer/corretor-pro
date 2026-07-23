import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v924 — a v922 tentou uma "dose fixa" persistida no aparelho (localStorage) pros 10 de hoje não
// serem repostos automaticamente. Só que publicar a correção no MEIO do dia fez o app montar essa
// lista bem depois de várias atendidas já terem acontecido (sob a versão antiga), gerando um
// "reset" pra 10 que pareceu bug de novo pro dono — e a lista fixa não sincronizava entre celular
// e PC (cada aparelho guarda seu próprio localStorage).
//
// v924 simplifica pra algo à prova de bobeira: "Fazer agora" = META do dia (10) MENOS quantos já
// foram atendidos hoje — a MESMA contagem que já aparece em "Atendimentos" (ex.: 9/10 lá = falta
// 1 aqui). Sem lista travada, sem localStorage, sem depender de quando o app foi atualizado:
// qualquer atendimento de hoje, em qualquer aparelho, faz esse número cair na hora.

const fdsSrc = app.match(/function cpFimDeSemana\(\)\{[\s\S]*?\n\}/)[0];
const filaSrc = app.match(/function cpFilaFazerAgora\(items\)\{[\s\S]*?\n\}/)[0];
const totalSrc = app.match(/function cpAtendidosHojeTotal\(items\)\{[\s\S]*?\n\}/)[0];
const doseSrc = app.match(/function cpFazerAgoraDose\(items\)\{[^\n]*\}/)[0];
assert.ok(fdsSrc && filaSrc && totalSrc && doseSrc, 'funções da dose de hoje não encontradas em app.js');

const sandbox = eval(`
  const CP_DOSE_DIA = 10;
  const leadEhAtivo = () => true;
  const ehContatadoHoje = (l) => !!l.__hoje;
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const cp786TemCompromisso = () => false;
  const cpAguardandoResposta = (l) => !!l.__aguardando;
  const diasParado = (l) => Number(l.__parado||0);
  ${fdsSrc}
  ${filaSrc}
  ${totalSrc}
  ${doseSrc}
  ({ cpFimDeSemana, cpFilaFazerAgora, cpAtendidosHojeTotal, cpFazerAgoraDose });
`);
const { cpFimDeSemana, cpFilaFazerAgora, cpAtendidosHojeTotal, cpFazerAgoraDose } = sandbox;

const ehFds = cpFimDeSemana();

// Carteira com 13 candidatos elegíveis; 8 já atendidos "hoje" (simula o que já tinha sido feito
// antes de uma atualização chegar no meio do dia — não devem precisar de nenhum registro
// especial pra contar, só o evento de atendimento de hoje, que já é sincronizado pelo servidor).
const items = [
  { id:'a1', __msgs:9, __parado:5, __hoje:true }, { id:'a2', __msgs:9, __parado:5, __hoje:true },
  { id:'a3', __msgs:9, __parado:5, __hoje:true }, { id:'a4', __msgs:9, __parado:5, __hoje:true },
  { id:'a5', __msgs:9, __parado:5, __hoje:true }, { id:'a6', __msgs:9, __parado:5, __hoje:true },
  { id:'a7', __msgs:9, __parado:5, __hoje:true }, { id:'a8', __msgs:9, __parado:5, __hoje:true },
  { id:'p1', __msgs:20, __parado:5 }, { id:'p2', __msgs:19, __parado:5 },
  { id:'p3', __msgs:18, __parado:5 }, { id:'p4', __msgs:17, __parado:5 },
  { id:'p5', __msgs:16, __parado:5 },
];

if(ehFds){
  assert.equal(cpFazerAgoraDose(items), 0, 'fim de semana → card em 0, independente de quem foi atendido');
  console.log('v924-fazer-agora-meta-decrescente: ok (fim de semana, cobertura parcial)');
} else {
  // 1. cpAtendidosHojeTotal conta certo, direto pelo evento de hoje — sem precisar de lista prévia.
  assert.equal(cpAtendidosHojeTotal(items), 8, 'conta os 8 já atendidos hoje (a1..a8)');

  // 2. A dose é a META (10) menos quem já atendeu hoje — NÃO importa se a atualização chegou
  // depois desses 8 atendimentos: o número cai igual, sem precisar de nenhuma lista prévia.
  assert.equal(cpFazerAgoraDose(items), 2, '10 - 8 atendidos hoje = 2 restantes');

  // 3. Atender mais um faz o número cair na hora (sem reposição pra voltar a 10).
  items.find(l => l.id === 'p1').__hoje = true;
  assert.equal(cpAtendidosHojeTotal(items), 9, 'agora 9 atendidos hoje');
  assert.equal(cpFazerAgoraDose(items), 1, '10 - 9 = 1 restante');

  // 4. Bater (ou passar) a meta do dia não fica negativo.
  items.find(l => l.id === 'p2').__hoje = true;
  items.find(l => l.id === 'p3').__hoje = true;
  assert.equal(cpAtendidosHojeTotal(items), 11, '11 atendidos hoje (passou da meta)');
  assert.equal(cpFazerAgoraDose(items), 0, 'nunca fica negativo — trava em 0');

  // 5. A fila ranqueada (cpFilaFazerAgora) continua excluindo quem já foi atendido hoje e
  // ranqueando por prioridade — a lista mostrada é o topo dela cortado pela dose (2 antes do
  // passo 3): confirma que "quem aparece" também acompanha a régua de sempre.
  const itemsAntes = items.map(l => ({...l, __hoje: ['a1','a2','a3','a4','a5','a6','a7','a8'].includes(l.id)}));
  const filaAntes = cpFilaFazerAgora(itemsAntes).map(l => l.id);
  assert.deepEqual(filaAntes, ['p1','p2','p3','p4','p5'], 'fila ranqueada exclui os 8 atendidos e ordena por engajamento');
  assert.deepEqual(filaAntes.slice(0, cpFazerAgoraDose(itemsAntes)), ['p1','p2'], 'lista mostrada = topo da fila cortado pela dose (2)');

  console.log('v924-fazer-agora-meta-decrescente: ok');
}
