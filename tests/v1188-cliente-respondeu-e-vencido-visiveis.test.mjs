import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1188 — AUDITORIA COMERCIAL DE 09/08/2026: dois defeitos que custavam venda, achados rodando o
// app DE VERDADE num navegador com uma carteira de teste (não lendo arquivo).
//
// DEFEITO A — "Cliente respondeu" nunca acontecia. O detector (cp786ClienteRespondeu) existia, a
// ordenação já colocava 'respondeu' em primeiro, o badge "Responder" existia — mas NADA produzia
// a categoria. Consequência medida no navegador: cliente que respondeu HÁ 3 HORAS pedindo
// condição de entrada, logo depois de um atendimento, ficou invisível em TODAS as superfícies da
// Home (fora do "Fazer agora" pelo descanso, fora de "Aguardando" porque essa exige que EU tenha
// falado por último, fatia do gráfico eternamente 0%). É a regra nº 1 do produto — "cliente
// respondeu e não recebeu resposta vem antes de tudo" (v826, decisão do dono) — perdida na troca
// de geração da Home.
//
// DEFEITO B — compromisso VENCIDO se apresentava como "Hoje". Um retorno combinado que venceu
// anteontem aparecia no box "Próximos compromissos" com rótulo "Hoje" (valor padrão da variável,
// não data real) e chip azul "Agenda". O esquecimento se vestia de coisa em dia — o contrário do
// que a regra do produto pede ("vencido fica em Programados COM DESTAQUE DE ATRASADO").
//
// Este teste roda a árvore de decisão REAL (extraída do fonte, com espiões nas dependências) e
// também confere que produtor e consumidores continuam LIGADOS — lição da v1186/v1187: teste que
// só procura texto passa reto por código que não roda.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// ── A1. A árvore de decisão real: quem produz cada categoria, na ordem certa ─────────────────
const catSrc = app.match(/function cp786Categoria\(l,modelo=null,ultimaReal=null\)\{[\s\S]*?\n\}/)[0];

function rodar({ compromisso=false, clienteRespondeu=false, pedeResposta=true,
                 aguardandoResposta=false, dentroDaJanela=false, msgsCliente=10, retomada=true }){
  const fn = new Function(
    'cp786TemCompromisso','cp786ClienteRespondeu','ultimaMsgClientePedeResposta',
    'cpAguardandoResposta','emJanelaDeEspera','mensagensDoCliente','CP_MIN_MSGS_PRIORIDADE',
    'entraEmRetomada','leadEhAtivo',
    `${catSrc}\nreturn cp786Categoria;`
  );
  return fn(()=>compromisso, ()=>clienteRespondeu, ()=>pedeResposta,
    ()=>aguardandoResposta, ()=>dentroDaJanela, ()=>msgsCliente, 5, ()=>retomada, ()=>true)({});
}

// O caso do Bruno: atendido ontem (dentro da janela), cliente respondeu pedindo algo → respondeu.
assert.equal(rodar({ clienteRespondeu:true, pedeResposta:true, dentroDaJanela:true }), 'respondeu',
  'cliente que respondeu pedindo algo é prioridade — o descanso não pode escondê-lo');

// "Obrigada!" de despedida não vira prioridade (guarda da v1017).
assert.equal(rodar({ clienteRespondeu:true, pedeResposta:false, aguardandoResposta:false, dentroDaJanela:false }), 'agora',
  'fala do cliente que não pede resposta não pode virar "respondeu" — cai no fluxo normal');

// Visita marcada continua vencendo: compromisso vem antes de respondeu.
assert.equal(rodar({ compromisso:true, clienteRespondeu:true }), 'programados',
  'compromisso confirmado tem precedência — "Confirmado, amanhã às 10h!" não é pedido de resposta');

// O aguardando legítimo continua intacto.
assert.equal(rodar({ aguardandoResposta:true, dentroDaJanela:true }), 'aguardando',
  'atendi e o cliente está em silêncio dentro do prazo: aguarda, como sempre');

// ── A2. O produtor usa o detector REAL, e o detector não é mais órfão ────────────────────────
assert.match(catSrc, /cp786ClienteRespondeu\(l,modelo,ultimaReal\)/,
  'a categoria respondeu precisa vir do detector cp786ClienteRespondeu (que ficou órfão da v786 até a v1187)');
assert.match(catSrc, /ultimaMsgClientePedeResposta/,
  'a guarda de "pede resposta" é obrigatória — sem ela, todo "Obrigada!" viraria prioridade');

// ── A3. O "Fazer agora" deixa o cliente-que-respondeu furar o descanso ───────────────────────
const filaSrc = app.match(/function cpFilaFazerAgora\(items\)\{[\s\S]*?\n\}/)[0];
assert.match(filaSrc, /clienteRespondeu \|\| nuncaAtendido \|\| passouPrazo/,
  'a fila do dia precisa incluir quem respondeu depois do atendimento — o descanso é pra "eu falei e ele não respondeu", nunca o contrário');

// ── A4. Consumidores ligados: ordenação, badge e legenda ─────────────────────────────────────
assert.match(app, /const ordem=\{respondeu:0,agora:1/, "a ordenação precisa manter 'respondeu' em primeiro");
assert.match(app, /\["Cliente respondeu",counts\.respondeu/, 'a legenda do gráfico precisa mostrar a linha "Cliente respondeu"');

// ── B. Compromisso vencido: rótulo verdadeiro e chip de alerta ───────────────────────────────
const apSrc = app.match(/function cpAppointmentData\(lead\)\{[\s\S]*?\n\}/)[0];
assert.match(apSrc, /Venceu há \$\{venc\.dias\} dias/, 'vencido precisa dizer "Venceu há N dias" — nunca "Hoje"');
assert.match(apSrc, /atrasado/, 'cpAppointmentData precisa devolver a marca de atrasado');
assert.match(app, /ap\.atrasado\?'hot':meta\.cls/, 'o chip do compromisso vencido precisa ficar vermelho (hot), não azul "Agenda"');
assert.match(app, /ap\.atrasado\?'Vencido':meta\.label/, 'o texto do chip precisa dizer "Vencido"');

// E o comportamento: sem compromisso futuro e com lembrete vencido, o rótulo é de vencimento.
{
  const fn = new Function('cp786CompromissoAtrasado','ui671HojeIso','ui671DiasAte','cp786DataTs','produtosLabel','Date',
    `${apSrc}\nreturn cpAppointmentData;`);
  const agora = Date;
  const r = fn(()=>({ dias:2, dataLabel:'08/08' }), ()=> '2026-08-10', ()=>null, ()=>0, ()=> 'Green Park', agora)({ analysis:{ lembrete:{ quando:'2026-08-08', motivo:'retornar sobre proposta' } } });
  assert.equal(r.atrasado, true, 'lembrete vencido precisa sair marcado como atrasado');
  assert.match(r.time, /^Venceu há 2 dias$/, `o rótulo precisa ser o vencimento real (veio: ${r.time})`);
  assert.ok(r.sortTs < Date.now(), 'vencido ordena antes de qualquer compromisso futuro');
}

console.log('v1188-cliente-respondeu-e-vencido-visiveis: ok');
