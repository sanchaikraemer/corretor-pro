import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v922 — o dono reclamou (com prints): marcava "Atendido" em quem estava nos "10 leads pra
// atender hoje" e o card/lista "Fazer agora" continuava mostrando 10 — porque a fila era
// recalculada a cada render e o atendido, ao sair do cálculo, deixava o 11º da fila entrar no
// lugar (reposição automática, decidida de propósito na v914). Agora os IDs de hoje são
// sorteados UMA VEZ (persistidos) e ficam fixos o dia inteiro: atender um faz o número CAIR
// (10→9→8...), sem reposição — só amanhã a dose é sorteada de novo. "Atender +1" continua
// existindo pra quem QUISER puxar mais um da fila de propósito, e o extra também fica fixo.

const ini = app.indexOf('function cpFimDeSemana(){');
const fim = app.indexOf('window.cpNotaPrioridade');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'bloco da dose fixa não encontrado em app.js');
const bloco = app.slice(ini, fim);

const hoje = new Date();
const ehFds = hoje.getDay() === 0 || hoje.getDay() === 6;

function novoSandbox(){
  const mem = new Map();
  const localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
  };
  const sandbox = eval(`
    const CP_DOSE_DIA = 10;
    const leadEhAtivo = () => true;
    const ehContatadoHoje = (l) => !!l.__hoje;
    const mensagensDoCliente = (l) => Number(l.__msgs||0);
    const cp786TemCompromisso = () => false;
    const diasParado = (l) => Number(l.__parado||0);
    ${bloco}
    ({ cpDoseIdsHoje, cpDoseFixaHoje, cpAdicionarNaDoseHoje, cpFazerAgoraDose, cpFilaFazerAgora, cpHojeBR });
  `);
  return { ...sandbox, localStorage, mem };
}

if(ehFds){
  const { cpDoseIdsHoje, cpFazerAgoraDose } = novoSandbox();
  assert.deepEqual(cpDoseIdsHoje([{id:'a',__msgs:9}]), [], 'fim de semana → sem dose');
  assert.equal(cpFazerAgoraDose([{id:'a',__msgs:9}]), 0, 'fim de semana → card em 0');
  console.log('v922-fazer-agora-dose-fixa: ok (fim de semana, cobertura parcial)');
} else {
  const { cpDoseIdsHoje, cpDoseFixaHoje, cpAdicionarNaDoseHoje, cpFazerAgoraDose } = novoSandbox();

  // Sem leads carregados ainda: não persiste dose vazia (senão travava em 0 o dia inteiro).
  assert.deepEqual(cpDoseIdsHoje([]), [], 'sem leads carregados → dose vazia, mas não gravada');

  const items = [
    { id:'a', __msgs:20, __parado:5 }, { id:'b', __msgs:19, __parado:5 },
    { id:'c', __msgs:18, __parado:5 }, { id:'d', __msgs:17, __parado:5 },
    { id:'e', __msgs:16, __parado:5 }, { id:'f', __msgs:15, __parado:5 },
    { id:'g', __msgs:14, __parado:5 }, { id:'h', __msgs:13, __parado:5 },
    { id:'i', __msgs:12, __parado:5 }, { id:'j', __msgs:11, __parado:5 },
    { id:'k', __msgs:10, __parado:5 }, { id:'l', __msgs:9,  __parado:5 },
    { id:'m', __msgs:8,  __parado:5 },
  ];

  // 1. Primeira leitura do dia sorteia e PERSISTE o top 10 por engajamento.
  const ids1 = cpDoseIdsHoje(items);
  assert.deepEqual(ids1, ['a','b','c','d','e','f','g','h','i','j'], 'dose inicial = top 10 por mensagens do cliente');

  // 2. Fixa: um novo lead MUITO mais engajado que chega depois não reordena nem entra na dose.
  const x = { id:'x', __msgs:100, __parado:1 };
  items.push(x);
  const ids2 = cpDoseIdsHoje(items);
  assert.deepEqual(ids2, ids1, 'dose já sorteada não muda com a chegada de um novo candidato melhor');

  // 3. Atender 3 da dose faz o PENDENTE cair — sem reposição pelo próximo da fila (k, l, m, x).
  for(const id of ['a','b','c']) items.find(l => l.id === id).__hoje = true;
  const fixa = cpDoseFixaHoje(items);
  assert.equal(fixa.todos.length, 10, 'a dose continua com 10 membros (atendidos ou não)');
  assert.equal(fixa.pendentes.length, 7, 'atendeu 3 de 10 → sobram 7 pendentes (não repõe)');
  assert.deepEqual([...fixa.idsSet].sort(), ids1.slice().sort(), 'os IDs fixos continuam sendo os mesmos 10 do início do dia');
  assert.equal(cpFazerAgoraDose(items), 7, 'o número do card cai junto com os pendentes (10→7)');

  // 4. "Atender +1": puxa o próximo da fila bruta (o mais engajado fora da dose = x) e FIXA ele.
  const puxado = cpAdicionarNaDoseHoje(items);
  assert.equal(puxado?.id, 'x', 'Atender +1 deveria puxar o candidato mais engajado fora da dose (x)');
  assert.equal(cpDoseIdsHoje(items).length, 11, 'a dose cresce pra 11 depois do Atender +1');
  const fixaComExtra = cpDoseFixaHoje(items);
  assert.equal(fixaComExtra.todos.length, 11, 'o extra do Atender +1 passa a fazer parte da dose fixa');
  assert.equal(fixaComExtra.pendentes.length, 8, '7 pendentes de antes + o novo extra (x) ainda não atendido');

  // 5. Storage com data diferente de hoje (ex.: dose salva num dia anterior) é descartado e uma
  // dose nova é sorteada a partir da fila viva — não fica preso ao valor salvo indefinidamente.
  const sandbox2 = novoSandbox();
  sandbox2.mem.set('cpDoseFazerAgoraV1', JSON.stringify({ data:'2000-01-01', ids:ids1 }));
  const idsAmanha = sandbox2.cpDoseIdsHoje(items);
  assert.notDeepEqual(idsAmanha, ids1, 'dose com data velha no storage não é reaproveitada');
  assert.ok(idsAmanha.includes('x'), 'a dose nova ranqueia de novo (x, o mais engajado, entra)');
  assert.ok(!idsAmanha.includes('a') && !idsAmanha.includes('b') && !idsAmanha.includes('c'),
    'quem está marcado como atendido hoje (__hoje) continua fora mesmo numa dose recém-sorteada');

  console.log('v922-fazer-agora-dose-fixa: ok');
}
