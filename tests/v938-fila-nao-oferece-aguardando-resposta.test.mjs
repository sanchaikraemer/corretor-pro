import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v938 — bug real reportado pelo dono via print: clicou em "Puxar da fila" (o botão que a v933
// criou pra puxar da fila ranqueada completa quando ninguém bate no critério automático) e o
// app ofereceu como "PRIORIDADE AGORA" um lead que o CORRETOR TINHA CONTATADO ONTEM e ainda
// estava esperando resposta ("ontem de contato" / "ontem sem resposta" na própria tela) — a
// bola estava do lado do cliente, não fazia sentido nenhum empurrar essa conversa de novo hoje.
//
// v939 — a correção da v938 usou cpAguardandoResposta, uma checagem que NUNCA expira (bloqueio
// permanente, mesmo depois de 150 dias esperando). Isso ignorava a regra que o app JÁ TEM pra
// decidir quando um lead "aguardando" volta a ser candidato: emJanelaDeEspera/limiarRetomada —
// a MESMA regra que entraEmRetomada usa (espera 3 dias se o lead é novo, 5 se não é; depois
// disso volta ao jogo). Corrigido pra usar essa regra existente em vez de inventar uma nova.

const filaSrc = app.match(/function cpFilaFazerAgora\(items\)\{[\s\S]*?\n\}/)[0];
assert.match(filaSrc, /!\(typeof emJanelaDeEspera==='function' && emJanelaDeEspera\(l\)\)/,
  'cpFilaFazerAgora precisa excluir só quem ainda está DENTRO da janela de espera (regra existente, com prazo)');
assert.doesNotMatch(filaSrc, /!cpAguardandoResposta\(l\)/,
  'não pode voltar a usar o bloqueio permanente (cpAguardandoResposta nunca expira)');

const fdsSrc = app.match(/function cpFimDeSemana\(\)\{[\s\S]*?\n\}/)[0];
const fila = eval(`
  const leadEhAtivo = () => true;
  const ehContatadoHoje = (l) => !!l.__hoje;
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const cp786TemCompromisso = () => false;
  const emJanelaDeEspera = (l) => !!l.__dentroDaJanela;
  const diasParado = (l) => Number(l.__parado||0);
  ${fdsSrc}
  ${filaSrc}
  cpFilaFazerAgora;
`);

const pool = [
  { id:'ok', __msgs:9, __parado:5 },
  // Contatado ontem, ainda DENTRO da janela de espera (3-5 dias): bola com o cliente, não entra.
  { id:'dentro-da-janela', __msgs:9, __parado:1, __dentroDaJanela:true },
  // Passou da janela de espera (regra existente: emJanelaDeEspera já voltou a ser false) —
  // volta a ser candidato normalmente, mesmo tendo sido o corretor quem falou por último.
  { id:'janela-passou', __msgs:9, __parado:150, __dentroDaJanela:false },
];
const hoje = new Date();
const ehFds = hoje.getDay() === 0 || hoje.getDay() === 6;
const r = fila(pool).map(l => l.id);
if(ehFds){
  assert.deepEqual(r, [], 'fim de semana → fila vazia');
} else {
  assert.deepEqual(r, ['janela-passou', 'ok'], 'só quem ainda está dentro da janela de espera fica de fora; depois do prazo, volta a ser candidato');
}

console.log('v938-fila-nao-oferece-aguardando-resposta: ok');
