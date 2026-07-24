import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v974 — o dono viu a v972 (frase inteira do motivo em negrito+coral) no ar e reclamou: "grande,
// em negrito, desarmoniza a tela". Foi publicada uma prévia com 4 tratamentos diferentes pra essa
// linha; o dono escolheu a Opção 4: ícone + só a razão MAIS forte (cpMotivoFechamento já devolve
// as razões em ordem de importância, separadas por " · ") + quantas outras existem ("+N"). A
// frase completa não se perde — vai pro atributo title (aparece no toque/hover).
//
// cpMotivoFechamento continua intocada (texto travado por regex nos testes v943/v944/v946) — a
// v974 só reaproveita o mesmo separador " · " que ela já usa, na hora de renderizar a linha.

function extrai(nome) {
  const m = app.match(new RegExp(`function ${nome}\\([^)]*\\)\\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `${nome} não encontrada em app.js`);
  return m[0];
}

const motivoSrc = extrai('cpMotivoFechamento');
const rowSrc = extrai('cpHomeLeadRow');

// 1. cpMotivoFechamento não foi tocada por causa disso.
assert.doesNotMatch(motivoSrc, /split|RAIO_SVG|chr-exp-tx/, 'cpMotivoFechamento não sabe nada sobre ícone/resumo — isso é só de quem renderiza a linha');

// 2. cpHomeLeadRow deriva o resumo a partir do MESMO separador " · " que cpMotivoFechamento usa
// (sem duplicar a lógica de pontuação/prioridade das razões).
assert.match(rowSrc, /motivo\.split\(' · '\)/, 'resumo é derivado dividindo o motivo pelo mesmo separador " · "');
assert.match(rowSrc, /motivoPartes\[0\]/, 'usa a 1ª razão (a mais forte, cpMotivoFechamento já ordena por importância)');
assert.match(rowSrc, /\+\$\{motivoPartes\.length - 1\}/, 'mostra "+N" com as demais razões quando há mais de uma');

// 3. A frase completa não se perde: vai pro title do span chr-exp.
assert.match(rowSrc, /class="chr-exp" title="\$\{escapeHtml\(motivo\)\}"/, 'chr-exp carrega a frase completa (sem cortar) no title');

// 4. CSS: peso mais leve que a v972 (700, não mais 800) e layout em linha (ícone + texto).
assert.match(app, /\.cp-hoje-row \.chr-exp\{[^}]*display:flex[^}]*font-weight:700;color:var\(--accent\)/, 'chr-exp: layout em linha (ícone+texto), peso 700 (mais leve que os 800 da v972), cor --accent mantida');
assert.doesNotMatch(app, /\.cp-hoje-row \.chr-exp\{[^}]*font-weight:800/, 'não sobrou nenhuma regra chr-exp com o peso 800 antigo');

// 5. Comportamento real via sandbox (mesmos stubs do teste v946/v972).
const sandbox = `
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const contextoPrioridadeIA = (l) => ({ propostaAtiva: !!l.__proposta, retornoProposta: !!l.__retorno });
  const ui670UltimaMensagemReal = (l) => l.__last || {m:null, falante:'desconhecido'};
  const escapeHtml = (s) => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const produtosLabel = (l) => l.product || '';
  const prioridadeAtendimento = (l) => ({ nivel: l.__nivel||0 });
  const cpBarraMensagensMini = (l, maxMsgs) => '<span class="chr-bar"></span>';
  const RAIO_SVG = '<svg class="raio-stub"></svg>';
  ${extrai('cpFatoresRankingLead')}
  ${motivoSrc}
  ${rowSrc}
  ({ cpHomeLeadRow, cpMotivoFechamento });
`;
const { cpHomeLeadRow, cpMotivoFechamento } = eval(sandbox);

// 5a. Lead com as 3 razões (retorno/proposta + recorrência + perguntas, sem clienteEsperaVoce —
// mesmo caso "qualificado" do v946): motivo tem 3 partes; resumo mostra só a 1ª + "+2".
const qualificado = { __msgs: 12, clientMessageDays: 6, clientQuestionCount: 4, __proposta: true, __retorno: true };
const motivoCompleto = cpMotivoFechamento(qualificado);
assert.equal(motivoCompleto.split(' · ').length, 3, 'pré-condição: este lead tem 3 razões reais (senão o teste não cobre o caso "+N")');
const htmlQualificado = cpHomeLeadRow(qualificado, 4, 218);
assert.match(htmlQualificado, /<span class="chr-exp-tx">Negocia[çc][ãa]o avan[çc]ada — proposta em aberto \+2<\/span>/, 'resumo visível é só a 1ª razão (negociação avançada) + "+2" das outras 2');
assert.ok(htmlQualificado.includes(`title="${motivoCompleto}"`), 'title tem a frase completa, igual ao que cpMotivoFechamento devolveria sozinha');

// 5b. Lead com 1 razão só: sem sufixo "+N" (não faz sentido dizer "+0").
const umaRazaoSo = { __msgs: 6, clientMessageDays: 6, clientQuestionCount: 0 };
assert.equal(cpMotivoFechamento(umaRazaoSo).split(' · ').length, 1, 'pré-condição: só 1 razão real (recorrência)');
const htmlUmaRazao = cpHomeLeadRow(umaRazaoSo, 2, 218);
assert.match(htmlUmaRazao, /chr-exp-tx">Voltou a conversar em 6 dias diferentes<\/span>/, 'com 1 razão só, mostra ela inteira (com a 1ª letra maiúscula que cpMotivoFechamento já aplica) sem sufixo "+N"');

// 5c. Lead sem nenhuma razão (Henrique, v943/v946): continua sem span chr-exp nenhum.
const henrique = { __msgs: 218, clientMessageDays: 1, clientQuestionCount: 0 };
assert.doesNotMatch(cpHomeLeadRow(henrique, 7, 218), /chr-exp/, 'lead sem motivo continua sem chr-exp (trava v946/v972)');

console.log('v974-motivo-icone-resumo: ok');
