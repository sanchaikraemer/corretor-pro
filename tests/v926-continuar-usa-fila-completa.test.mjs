import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v926 — a v925 ("Vamos atender mais um?") checava se sobrava gente só no balde CATEGORIZADO
// ("acao-hoje" + "retomar-cuidado", vindo de cp786Categoria). Na prática, com a meta de hoje
// batida, esse balde pode estar vazio (ex.: tudo que sobrou virou "Aguardando cliente") mesmo
// havendo gente disponível na fila ranqueada completa (cpFilaFazerAgora — a mesma que alimenta o
// número "Fazer agora" e o "Atender +1"). Resultado visto pelo dono: card em 0, mas a Home caía
// direto em "Tudo em dia", sem o convite pra continuar. Este teste roda o trecho REAL de
// renderBotoesHome (extraído do app.js) com um balde categorizado vazio e uma fila completa não
// vazia, e confirma que "disponiveisParaPuxar" (o gatilho do convite) enxerga a fila completa.

const ini = app.indexOf('const metaHoje = typeof cpFazerAgoraDose');
const fim = app.indexOf("const retomada = (grupos[\"retomada\"]");
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'trecho da dose/extra de renderBotoesHome não encontrado em app.js');
const trecho = app.slice(ini, fim);

function rodar({ urgentesRanqueados, items, fazerAgoraExtra, dose, filaCompleta }){
  const state = { fazerAgoraExtra };
  const cpFazerAgoraDose = () => dose;
  const cpFilaFazerAgora = () => filaCompleta;
  const CP_DOSE_DIA = 10;
  return eval(`
    (function(){
      ${trecho}
      return { doseBase, urgentes, disponiveisParaPuxar, backlogAlemDaDose };
    })();
  `);
}

// Cenário do bug: balde categorizado ("acao-hoje"/"retomar-cuidado") VAZIO — tudo que sobrou virou
// "Aguardando cliente" — mas a fila ranqueada completa ainda tem 3 candidatos disponíveis.
const filaCompleta = [{ id:'p1' }, { id:'p2' }, { id:'p3' }];
const r1 = rodar({ urgentesRanqueados: [], items: [], fazerAgoraExtra: 0, dose: 0, filaCompleta });
assert.equal(r1.urgentes.length, 0, 'sem clicar em nada ainda, a dose mostrada continua vazia');
assert.equal(r1.disponiveisParaPuxar.length, 3, 'mas "disponível pra puxar" enxerga os 3 da fila completa, não só o balde vazio');

// Ao clicar "Vamos atender mais um?" (fazerAgoraExtra=1), puxa o 1º da fila completa pra dose.
const r2 = rodar({ urgentesRanqueados: [], items: [], fazerAgoraExtra: 1, dose: 0, filaCompleta });
assert.deepEqual(r2.urgentes.map(l => l.id), ['p1'], 'o extra puxado vem da fila completa (p1), mesmo com o balde categorizado vazio');
assert.equal(r2.disponiveisParaPuxar.length, 2, 'sobram 2 disponíveis depois de puxar 1');

// Se a fila completa também estiver vazia, não há convite (sem gente pra puxar de fato).
const r3 = rodar({ urgentesRanqueados: [], items: [], fazerAgoraExtra: 0, dose: 0, filaCompleta: [] });
assert.equal(r3.disponiveisParaPuxar.length, 0, 'sem ninguém na fila completa, não há convite (corretamente vazio)');

console.log('v926-continuar-usa-fila-completa: ok');
