import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v914 — "Fazer agora": todo dia útil até 10 (rank por urgência), botão "Atender +1", fim de
// semana = "Final de semana". + Atendimentos no PC: sem rolagem horizontal, nomes finos.
// v943 — a ORDEM da fila deixou de ser um único fator (nem volume de mensagens, nem só tempo
// parado) e passou a ser uma JUNÇÃO DE FATORES — probabilidade de fechamento
// (cpProbabilidadeFechamento): engajamento (mensagens do cliente), recorrência (dias diferentes
// em que ele voltou a conversar), perguntas feitas, sinal de negociação avançada
// (valor/condição/proposta já discutidos) e um bônus se o cliente é quem está esperando a
// resposta do corretor agora. Pedido explícito do dono: "não é mais mensagem, não é mais
// antigo, é uma junção de fatores".

// 1. cpFilaFazerAgora + cpProbabilidadeFechamento reformadas + executáveis.
const fdsSrc = app.match(/function cpFimDeSemana\(\)\{[\s\S]*?\n\}/)[0];
const notaSrc = app.match(/function cpProbabilidadeFechamento\(l\)\{[\s\S]*?\n\}/)[0];
const filaSrc = app.match(/function cpFilaFazerAgora\(items\)\{[\s\S]*?\n\}/)[0];
assert.ok(notaSrc, 'cpProbabilidadeFechamento não encontrada em app.js');
const fila = eval(`
  const CP_DOSE_DIA = 10;
  const leadEhAtivo = () => true;
  const ehContatadoHoje = (l) => !!l.__hoje;
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const cp786TemCompromisso = () => false;
  const emJanelaDeEspera = () => false;
  const contextoPrioridadeIA = (l) => ({ propostaAtiva: !!l.__proposta, retornoProposta: !!l.__retorno });
  // v1057 — cpFilaFazerAgora exige atendimento marcado; stub simples (mesmo "tempo parado" pra
  // todo mundo) pra não interferir na ordenação por junção de fatores que este teste cobre.
  const ultimoAtendimentoTs = (l) => l.__atendido ? 1 : 0;
  const diasCalendarioBR = () => 5;
  // v1068 — cpFilaFazerAgora passou a checar recomendacaoContato.aguardar (via
  // analiseAtualValida752); nenhum lead deste teste usa esse campo, então o stub sempre nega.
  const analiseAtualValida752 = () => false;
  ${fdsSrc}
  ${notaSrc}
  ${filaSrc}
  cpFilaFazerAgora;
`);
const hoje = new Date();
const ehFds = hoje.getDay() === 0 || hoje.getDay() === 6;
const pool = [
  // Poucas mensagens, mas voltou a conversar em 6 dias diferentes E já discutiram valor/condição
  // (negociação avançada) — probabilidade de fechamento alta mesmo sem ser quem tem mais msgs.
  { id:'qualificado', __msgs:12, clientMessageDays:6, clientQuestionCount:4, __proposta:true, __retorno:true, __atendido:true },
  // Muitas mensagens (explosão num período curto), sem recorrência, sem sinal de negociação —
  // é o caso do "Henrique 218 msgs, contatado há 2 dias, sem retomada real" que o dono apontou.
  { id:'volume-sem-fundo', __msgs:218, clientMessageDays:1, clientQuestionCount:0, __atendido:true },
  // Pouco de tudo — fica por último entre os "de verdade".
  { id:'fraco', __msgs:6, clientMessageDays:1, clientQuestionCount:0, __atendido:true },
  { id:'d', __msgs:5, __hoje:true, __atendido:true }, // atendido hoje → fora
  // v1069 — sem mensagem do cliente NÃO exclui mais (a regra passou a ser só data de
  // atendimento); continua elegível, só cai pro fim por ter zero sinal de engajamento.
  { id:'e', __msgs:0, __atendido:true },
];
const r = fila(pool).map(l => l.id);
if(ehFds){
  assert.deepEqual(r, [], 'fim de semana → fila vazia');
} else {
  assert.deepEqual(r, ['qualificado','volume-sem-fundo','fraco','e'],
    'recorrência + perguntas + sinal de negociação avançada pesam mais que só volume de mensagens; sem msg do cliente não exclui mais, só cai pro fim');
}

// 2. Dose helper + botão Atender +1 + fim de semana no card.
// v924: a dose é a META do dia menos quem já foi atendido hoje (cpAtendidosHojeTotal) —
// ver tests/v924-fazer-agora-meta-decrescente.test.mjs pra cobertura completa do comportamento.
// v1012: a meta deixou de ser CP_DOSE_DIA fixo e virou cpMetaAtendimentosDia() (campo
// "Atendimentos por dia" do Cérebro, padrão 10) — ver tests/v1012-meta-atendimentos-por-corretor.test.mjs.
assert.match(app, /function cpFazerAgoraDose\(items\)\{ return cpFimDeSemana\(\) \? 0 : Math\.max\(0, cpMetaAtendimentosDia\(\) - cpAtendidosHojeTotal\(items\)\); \}/, 'dose = meta menos atendidos hoje, 0 no fds');
assert.match(app, /Atender \+1/, 'botão "Atender +1"');
assert.match(app, /Final de semana/, 'card mostra "Final de semana"');
assert.match(css, /\.cp-atender-mais\{/, 'CSS do botão Atender +1');

// 3. Atendimentos: nomes finos (sem negrito) e fonte menor que o resto da faixa.
// v1275 — a grade de 7 colunas do PC saiu: a tela mostra o MÊS INTEIRO (até 31 dias), e cada dia
// virou uma faixa na vertical, no celular e no computador. Sem rolagem horizontal do mesmo jeito.
assert.match(css, /\.cp788-days\{display:flex;flex-direction:column/, 'os dias ficam um embaixo do outro (sem rolagem lateral)');
assert.match(css, /\.cp788-day-name\{[^}]*font-weight:600/, 'nomes sem negrito');
assert.match(css, /\.cp788-day-name\{[^}]*font-size:12px/, 'nomes com fonte menor que o cabeçalho do dia');

console.log('v914-fazer-agora-dose-e-fds: ok');
