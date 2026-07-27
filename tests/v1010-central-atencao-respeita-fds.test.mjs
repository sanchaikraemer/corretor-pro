import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1010 — num sábado à noite, a Central de atenção anunciou "31 atendimentos pedem ação";
// o dono abriu a Condução e encontrou "Nenhum cliente nesta visão" — porque a fila do
// "Fazer agora" pausa no fim de semana (regra deliberada, v914/v937), mas o sino não sabia.
// Agora as duas telas contam a mesma história.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// 1. A Central de atenção tem o modo fim de semana (fila pausada, quem espera fica pra segunda).
assert.match(app, /Fim de semana — fila pausada/, 'a Central de atenção precisa avisar que a fila pausou no fim de semana');
assert.match(app, /por você na segunda/, 'a Central precisa dizer que os atendimentos esperam segunda, não que "pedem ação" agora');

// 2. O modo normal (dia útil) continua existindo.
assert.match(app, /pedem'\} ação<\/b>/, 'no dia útil, a Central continua anunciando os atendimentos que pedem ação');

// 3. O vazio da Condução no fim de semana explica a pausa em vez do genérico.
assert.match(app, /Fim de semana — a fila do "Fazer agora" volta na segunda\.<\/div>/, 'o vazio da Condução precisa explicar a pausa de fim de semana');

console.log('v1010-central-atencao-respeita-fds: ok');
