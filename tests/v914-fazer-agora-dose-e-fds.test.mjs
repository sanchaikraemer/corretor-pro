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
  { id:'qualificado', __msgs:12, clientMessageDays:6, clientQuestionCount:4, __proposta:true, __retorno:true },
  // Muitas mensagens (explosão num período curto), sem recorrência, sem sinal de negociação —
  // é o caso do "Henrique 218 msgs, contatado há 2 dias, sem retomada real" que o dono apontou.
  { id:'volume-sem-fundo', __msgs:218, clientMessageDays:1, clientQuestionCount:0 },
  // Pouco de tudo — fica por último.
  { id:'fraco', __msgs:6, clientMessageDays:1, clientQuestionCount:0 },
  { id:'d', __msgs:5, __hoje:true }, // atendido hoje → fora
  { id:'e', __msgs:0 },              // sem msg do cliente → fora
];
const r = fila(pool).map(l => l.id);
if(ehFds){
  assert.deepEqual(r, [], 'fim de semana → fila vazia');
} else {
  assert.deepEqual(r, ['qualificado','volume-sem-fundo','fraco'],
    'recorrência + perguntas + sinal de negociação avançada pesam mais que só volume de mensagens');
}

// 2. Dose helper + botão Atender +1 + fim de semana no card.
// v924: a dose é a META do dia (10) menos quem já foi atendido hoje (cpAtendidosHojeTotal) —
// ver tests/v924-fazer-agora-meta-decrescente.test.mjs pra cobertura completa do comportamento.
assert.match(app, /function cpFazerAgoraDose\(items\)\{ return cpFimDeSemana\(\) \? 0 : Math\.max\(0, CP_DOSE_DIA - cpAtendidosHojeTotal\(items\)\); \}/, 'dose = meta menos atendidos hoje, 0 no fds');
assert.match(app, /Atender \+1/, 'botão "Atender +1"');
assert.match(app, /Final de semana/, 'card mostra "Final de semana"');
assert.match(css, /\.cp-atender-mais\{/, 'CSS do botão Atender +1');

// 3. Atendimentos no PC: grid de 7 colunas (sem rolagem horizontal) e nomes finos (sem negrito).
assert.match(css, /\.cp788-days\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/, 'PC: 7 colunas preenchem a largura (sem rolagem)');
assert.match(css, /\.cp788-day-name\{[^}]*font-weight:600/, 'nomes sem negrito');
assert.match(css, /\.cp788-day-name\{[^}]*font-size:11px/, 'nomes com fonte menor');

console.log('v914-fazer-agora-dose-e-fds: ok');
