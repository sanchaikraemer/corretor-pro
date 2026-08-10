import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1010 — num sábado à noite, a Central de atenção anunciou "31 atendimentos pedem ação";
// o dono abriu a Condução e encontrou "Nenhum cliente nesta visão" — porque a fila do
// "Fazer agora" pausa no fim de semana (regra deliberada, v914/v937), mas o sino não sabia.
// Agora as duas telas contam a mesma história.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1091 — os dias sem fila deixaram de ser sábado/domingo cravados: cada corretor marca no
// Cérebro os dias em que atende (corretor de imóveis trabalha sábado).
// v1205 — a Central de atenção foi REMOVIDA a pedido do dono (painel que repetia números da
// Home). A intenção deste teste sobrevive na única tela que ainda faz essa promessa: a lista
// "Fazer agora" da Home não pode prometer ação num dia em que a fila está pausada.

// O vazio da lista "Fazer agora" no dia sem atendimento explica a pausa em vez do genérico.
// (v1075: a tela Condução foi deletada; a explicação mora no subtítulo da lista da Home.)
assert.match(app, /Hoje você não atende — a fila volta \$\{cpProximoDiaDeAtendimento\(\)\}\./, 'o vazio da lista precisa explicar a pausa, nomeando o próximo dia de atendimento');

console.log('v1010-central-atencao-respeita-fds: ok');
