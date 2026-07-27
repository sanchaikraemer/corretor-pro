import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v946 — ranking explicável: o dono reclamava (v943/v944) que a ORDEM do "Fazer agora" parecia
// "errada" porque o motivo da priorização era uma caixa-preta. cpMotivoFechamento(l) explicava em
// texto curto por que um lead estava classificado como estava. A v975 já tinha tirado isso da
// Home (só sobrava dentro do card "Fazer agora" do detalhe do lead).
//
// v1017 — o dono voltou a ver esse texto (agora dentro do lead) e pediu pra tirar de vez: "pode
// deletar, excluir e sumir com isso que só serve pra incomodar, não me ajuda em nada, só polui
// tela". cpFatoresRankingLead/cpMotivoFechamento e o card cp704-motivo que os mostrava foram
// removidos por completo — este teste passa a só confirmar que não sobrou vestígio nenhum.

assert.doesNotMatch(app, /function cpFatoresRankingLead/, 'cpFatoresRankingLead foi removida do app');
assert.doesNotMatch(app, /function cpMotivoFechamento/, 'cpMotivoFechamento foi removida do app');
assert.doesNotMatch(app, /motivoFazerAgora/, 'renderLeadFoco não calcula mais motivoFazerAgora');
assert.doesNotMatch(app, /cp704-motivo/, 'nenhum vestígio da classe cp704-motivo sobrou em app.js');

// cpProbabilidadeFechamento (o RANKING em si, travado pelos testes v943/v944) continua existindo
// e intocada — só o texto explicativo em cima dela é que saiu.
assert.match(app, /function cpProbabilidadeFechamento\(l\)\{/, 'cpProbabilidadeFechamento (o ranking em si) continua existindo');

console.log('v946-ranking-explicavel: ok (atualizado na v1017 — motivo explicável removido de vez)');
