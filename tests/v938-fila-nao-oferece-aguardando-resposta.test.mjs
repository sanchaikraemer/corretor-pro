import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v938 — bug real reportado pelo dono via print: clicou em "Puxar da fila" (o botão que a v933
// criou pra puxar da fila ranqueada completa quando ninguém bate no critério automático) e o
// app ofereceu como "PRIORIDADE AGORA" um lead que o CORRETOR TINHA CONTATADO ONTEM e ainda
// estava esperando resposta ("ontem de contato" / "ontem sem resposta" na própria tela) — a
// bola estava do lado do cliente, não fazia sentido nenhum empurrar essa conversa de novo hoje.
//
// Causa: cpFilaFazerAgora (a fila ranqueada usada tanto pelo número "Fazer agora" quanto pelo
// "Puxar da fila"/"Atender +1") só excluía quem foi CONTATADO HOJE (ehContatadoHoje) — não
// excluía quem está "aguardando cliente" (cpAguardandoResposta: atendido em qualquer dia
// anterior e o cliente ainda não respondeu depois). Um lead atendido ontem, sem resposta ainda,
// não é "contatado hoje" — passava direto pelo filtro e virava candidato a "prioridade agora".

const filaSrc = app.match(/function cpFilaFazerAgora\(items\)\{[\s\S]*?\n\}/)[0];
assert.match(filaSrc, /!cpAguardandoResposta\(l\)/,
  'cpFilaFazerAgora precisa excluir quem está aguardando resposta do cliente');

const fdsSrc = app.match(/function cpFimDeSemana\(\)\{[\s\S]*?\n\}/)[0];
const fila = eval(`
  const leadEhAtivo = () => true;
  const ehContatadoHoje = (l) => !!l.__hoje;
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const cp786TemCompromisso = () => false;
  const cpAguardandoResposta = (l) => !!l.__aguardando;
  const diasParado = (l) => Number(l.__parado||0);
  ${fdsSrc}
  ${filaSrc}
  cpFilaFazerAgora;
`);

const pool = [
  { id:'ok', __msgs:9, __parado:5 },
  // Contatado ontem, cliente ainda não respondeu: bola com o cliente — não pode ser oferecido.
  { id:'aguardando-ontem', __msgs:9, __parado:1, __aguardando:true },
  // Contatado há muito tempo e ainda sem resposta: mesma regra, não muda com o tempo parado.
  { id:'aguardando-velho', __msgs:9, __parado:150, __aguardando:true },
];
const hoje = new Date();
const ehFds = hoje.getDay() === 0 || hoje.getDay() === 6;
const r = fila(pool).map(l => l.id);
if(ehFds){
  assert.deepEqual(r, [], 'fim de semana → fila vazia');
} else {
  assert.deepEqual(r, ['ok'], 'leads aguardando resposta do cliente não entram na fila, mesmo há muitos dias parados');
}

console.log('v938-fila-nao-oferece-aguardando-resposta: ok');
