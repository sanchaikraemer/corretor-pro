import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1072 — pedido do dono: o card "Sem atender 30d+" precisa abrir a lista de quem está nessa
// situação, ordenada do mais antigo (mais atrasado) pro mais recente.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// 1. O tile na Home chama a função nova, não é mais só um contador estático.
assert.match(app, /onclick="cpAbrirSemAtender30Dias\(\)"[^>]*><span>Sem atender 30d\+<\/span>/,
  'o tile "Sem atender 30d+" precisa abrir a lista ao clicar');

// 2. cpAbrirSemAtender30Dias existe, filtra por 30 dias e usa abrirGrupoHome (mesmo padrão de
// "Propostas feitas").
const fnSrc = app.match(/function cpAbrirSemAtender30Dias\(\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(fnSrc, 'cpAbrirSemAtender30Dias não encontrada em app.js');
assert.match(fnSrc, /cpSemAtenderHaDias\(l, 30\)/, 'filtra usando o mesmo prazo fixo de 30 dias do contador');
assert.match(fnSrc, /abrirGrupoHome\("__semAtender30", \{ meta:\{ titulo:"Sem atender 30d\+"/,
  'abre a lista via abrirGrupoHome, com título "Sem atender 30d+"');

// 3. Comportamento real: nunca atendido vem ANTES de quem tem data de atendimento (por mais
// velha que seja) — "nunca" é sempre mais atrasado — e entre os com data, mais antigo primeiro.
function rodar(leadsAtivos) {
  const chamadasAbrirGrupo = [];
  const state = { itemsAtivos: leadsAtivos };
  const leadEhAtivo = () => true;
  const cpSemAtenderHaDias = (l) => !!l.__semAtender;
  // v1102 — a lista passou a ordenar pelo último CONTATO REAL (marcado ou mensagem na conversa).
  const cpUltimoContatoCorretorTs = (l) => Number(l.__at || 0);
  const toast = () => {};
  const abrirGrupoHome = (chave, opts) => { chamadasAbrirGrupo.push({ chave, opts }); };
  const fn = new Function(
    'state', 'leadEhAtivo', 'cpSemAtenderHaDias', 'cpUltimoContatoCorretorTs', 'toast', 'abrirGrupoHome',
    `${fnSrc}\nreturn cpAbrirSemAtender30Dias;`
  )(state, leadEhAtivo, cpSemAtenderHaDias, cpUltimoContatoCorretorTs, toast, abrirGrupoHome);
  fn();
  return chamadasAbrirGrupo[0];
}

const nuncaAtendido = { id: 'nunca', __semAtender: true, __at: 0 };
const atendidoHaMuito = { id: 'muito-antigo', __semAtender: true, __at: 1000 }; // ts menor = mais antigo
const atendidoHaPouco = { id: 'menos-antigo', __semAtender: true, __at: 5000 };
const dentroDoPrazo = { id: 'fora', __semAtender: false, __at: 9000 };

const chamada = rodar([atendidoHaPouco, dentroDoPrazo, nuncaAtendido, atendidoHaMuito]);
assert.ok(chamada, 'cpAbrirSemAtender30Dias precisa chamar abrirGrupoHome quando há leads elegíveis');
const idsNaOrdem = chamada.opts.leads.map(l => l.id);
assert.deepEqual(idsNaOrdem, ['nunca', 'muito-antigo', 'menos-antigo'],
  'ordem esperada: nunca atendido primeiro, depois do mais antigo pro mais recente — "fora" (dentro do prazo) nem entra');

console.log('v1072-sem-atender-30d-abre-lista-ordenada: ok');
