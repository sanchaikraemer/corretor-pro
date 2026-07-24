import fs from 'node:fs';
import assert from 'node:assert/strict';

// v957 — revisão de api/reanalisar-lead.js. diasAteDiaSemana(nome, queVem, baseDate), usada por
// lembreteDoTexto/lembreteDaTimeline pra calcular "quantos dias até sábado" a partir da data de
// uma MENSAGEM (não de "agora"), usava d.getUTCDay() quando recebia baseDate — diferente de
// diaSemanaBR() (usada quando não há baseDate), que já é consciente do fuso de Brasília de
// propósito (comentário original: "Evita virar o dia no UTC à noite"). Uma mensagem enviada
// entre 21h e meia-noite em Brasília cai na madrugada do dia SEGUINTE em UTC — getUTCDay()
// calculava o dia da semana errado nesse intervalo, podendo agendar o lembrete pro dia certo
// da semana errado (1 dia de diferença).

const src = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url), 'utf8');

const diaSemanaBRDeSrc = src.match(/function diaSemanaBRDe\(date\) \{[\s\S]*?\n\}/)?.[0];
const diaSemanaBRSrc = src.match(/function diaSemanaBR\(\) \{[\s\S]*?\n\}/)?.[0];
const diasAteDiaSemanaSrc = src.match(/function diasAteDiaSemana\(nome, queVem, baseDate\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(diaSemanaBRDeSrc && diaSemanaBRSrc && diasAteDiaSemanaSrc, 'achei as três funções em api/reanalisar-lead.js');

// 1. Estrutural: a linha ATIVA que calcula refDay usa diaSemanaBRDe(d), não .getUTCDay() (o
// comentário do fix cita ".getUTCDay()" de propósito pra explicar o que mudou — por isso
// verifica a linha de código em si, não o arquivo inteiro).
const linhaRefDay = diasAteDiaSemanaSrc.split('\n').find(l => l.trim().startsWith('refDay = isNaN'));
assert.ok(linhaRefDay, 'achei a linha que calcula refDay a partir de baseDate');
assert.doesNotMatch(linhaRefDay, /\.getUTCDay\(\)/, 'a linha de código não chama mais .getUTCDay()');
assert.match(linhaRefDay, /diaSemanaBRDe\(d\)/, 'usa diaSemanaBRDe(d) pra calcular o dia com baseDate');

const { diaSemanaBRDe, diasAteDiaSemana } = eval(
  `${diaSemanaBRDeSrc}\n${diaSemanaBRSrc}\n${diasAteDiaSemanaSrc}\n({ diaSemanaBRDe, diasAteDiaSemana })`
);

// 2. Acha (sem cravar uma data fixa — robusto a qualquer ano) um instante às 2h UTC (23h em
// Brasília, UTC-3, do dia anterior) onde o dia da semana em UTC cru diverge do dia da semana
// real em Brasília — prova que o cenário do bug é real, não coincidência de calendário.
let achou = null;
for (let dia = 1; dia <= 14 && !achou; dia++) {
  const cand = new Date(Date.UTC(2026, 0, dia, 2, 0, 0));
  if (cand.getUTCDay() !== diaSemanaBRDe(cand)) achou = cand;
}
assert.ok(achou, 'não encontrei um instante onde UTC e Brasília divergem (não devia acontecer em 14 dias)');

// 3. Com esse instante como baseDate, pedir o dia da semana SEGUINTE ao dia real em Brasília
// tem que dar 1 (amanhã) — se ainda usasse getUTCDay(), o "amanhã" em UTC já seria esse mesmo
// dia (porque UTC já virou a página), e a conta daria 0 ou 7, não 1.
const nomesPorIndice = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaRealBrasilia = diaSemanaBRDe(achou);
const nomeAmanha = nomesPorIndice[(diaRealBrasilia + 1) % 7];
assert.equal(diasAteDiaSemana(nomeAmanha, false, achou), 1,
  `"${nomeAmanha}" a partir de um horário de madrugada em UTC (noite anterior em Brasília) deve dar 1 dia, não 0`);

console.log('v957-dia-semana-baseDate-fuso-br: ok');
