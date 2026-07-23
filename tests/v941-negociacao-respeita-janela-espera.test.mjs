import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v941 — bug real reportado pelo dono via print (o HERO da Home, não o mesmo bug da v938/v939
// que era em cpFilaFazerAgora): a Mariana foi contatada ONTEM (1 dia, dentro do prazo normal de
// resposta — 3 ou 5 dias) e ainda assim aparecia como "PRIORIDADE AGORA" / "Negociação
// aguardando você" no topo da Home. Causa: prioridadeAtendimento/filaPorFatos calcula
// "negociacaoAguardando" com um regex sobre o TEXTO da análise da IA (proposta/condição/
// contraproposta) — sinal fuzzy que dispara fácil demais (praticamente toda negociação de
// imóvel usa essas palavras) — e esse sinal era checado ANTES de "emJanela" (fato concreto:
// contatei há N dias, ainda dentro do prazo de resposta), furando a proteção da janela de
// espera pra praticamente qualquer lead com uma negociação em andamento.

const src = app.match(/function filaPorFatos\(f = \{\}\)\{[\s\S]*?\n\}/);
assert.ok(src, 'não achei a função filaPorFatos em app.js');
const filaPorFatos = eval('(' + src[0] + ')');
const nivelDe = f => filaPorFatos(f).nivel;
const grupoDe = f => filaPorFatos(f).grupo;

// 1. O caso real: contatado ontem (emJanela=true) + sinal fuzzy de negociação (negociacaoAguardando=true)
// → precisa cair em "pode-aguardar" (Aguardando resposta), NÃO em "acao-hoje".
assert.equal(grupoDe({ emJanela: true, negociacaoAguardando: true }), 'pode-aguardar',
  'dentro da janela de espera, o sinal fuzzy de negociação não pode forçar "acao-hoje"');
assert.equal(nivelDe({ emJanela: true, negociacaoAguardando: true }), 7);

// 2. Passada a janela de espera (emJanela=false), o sinal de negociação volta a valer normalmente.
assert.equal(grupoDe({ emJanela: false, negociacaoAguardando: true }), 'acao-hoje',
  'depois da janela de espera, "negociação aguardando você" volta a ser válido');
assert.equal(nivelDe({ negociacaoAguardando: true }), 4);

// 3. Fatos concretos com data real continuam com prioridade sobre a janela de espera —
// só o sinal FUZZY (negociacaoAguardando) que passou a respeitar emJanela.
assert.equal(nivelDe({ retornoParaHoje: true, emJanela: true }), 3, 'retorno pra hoje é fato concreto, vence a janela de espera');
assert.equal(nivelDe({ lembreteAtrasado: true, emJanela: true }), 2, 'compromisso vencido é fato concreto, vence a janela de espera');
assert.equal(nivelDe({ compromissoProgramado: true, emJanela: true }), 5, 'atendimento programado é fato concreto, vence a janela de espera');

console.log('v941-negociacao-respeita-janela-espera: ok');
