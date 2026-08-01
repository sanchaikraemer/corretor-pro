import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1010 — num sábado à noite, a Central de atenção anunciou "31 atendimentos pedem ação";
// o dono abriu a Condução e encontrou "Nenhum cliente nesta visão" — porque a fila do
// "Fazer agora" pausa no fim de semana (regra deliberada, v914/v937), mas o sino não sabia.
// Agora as duas telas contam a mesma história.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1091 — os dias sem fila deixaram de ser sábado/domingo cravados: cada corretor marca no
// Cérebro os dias em que atende (corretor de imóveis trabalha sábado). O texto por isso não pode
// mais dizer "fim de semana" nem "na segunda" — ele agora nomeia o PRÓXIMO DIA que o corretor
// marcou. A intenção original deste teste continua igual: o sino não pode prometer ação num dia
// em que a fila está pausada.
// 1. A Central de atenção tem o modo "hoje você não atende".
assert.match(app, /Hoje você não atende<\/b>/, 'a Central de atenção precisa avisar quando hoje não é dia de fila');
assert.match(app, /por você \$\{cpProximoDiaDeAtendimento\(\)\}/, 'a Central precisa dizer em que dia os atendimentos esperam — o dia que o corretor marcou');

// 2. O modo normal (dia útil) continua existindo.
assert.match(app, /pedem'\} ação<\/b>/, 'no dia útil, a Central continua anunciando os atendimentos que pedem ação');

// 3. O vazio da lista "Fazer agora" no fim de semana explica a pausa em vez do genérico.
// (v1075: a tela Condução foi deletada; a explicação mora no subtítulo da lista da Home.)
assert.match(app, /Hoje você não atende — a fila volta \$\{cpProximoDiaDeAtendimento\(\)\}\./, 'o vazio da lista precisa explicar a pausa, nomeando o próximo dia de atendimento');

console.log('v1010-central-atencao-respeita-fds: ok');
