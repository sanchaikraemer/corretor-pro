import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v975 — o dono viu a v974 (motivo virou ícone + resumo curto) e pediu pra tirar de vez: "já tem
// o breafing, analise dentro do lead, nao precisa isso... nem na tela inicial". A explicação do
// ranking (v945/946) segue existindo — só não aparece mais na Home (cpHomeLeadRow). Continua
// existindo no card "Fazer agora" de dentro do lead (renderLeadFoco/cp704-motivo), que é
// exatamente o "breafing/análise dentro do lead" que o dono citou como já cobrindo isso.

function extrai(nome) {
  const m = app.match(new RegExp(`function ${nome}\\([^)]*\\)\\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `${nome} não encontrada em app.js`);
  return m[0];
}

const rowSrc = extrai('cpHomeLeadRow');
const motivoSrc = extrai('cpMotivoFechamento');

// 1. cpHomeLeadRow não CHAMA mais cpMotivoFechamento (só pode citar o nome em comentário
// explicando o porquê) nem referencia nada do antigo destaque (chr-exp/data-exp/RAIO_SVG).
assert.doesNotMatch(rowSrc, /cpMotivoFechamento\(/, 'cpHomeLeadRow não invoca mais cpMotivoFechamento');
assert.doesNotMatch(rowSrc, /chr-exp|data-exp|RAIO_SVG/, 'cpHomeLeadRow não referencia mais chr-exp/data-exp/RAIO_SVG');

// 2. O que continua na linha da Home: rank, nome, produto, barra de mensagens, dias — nessa ordem.
assert.match(rowSrc, /chr-rank[\s\S]*chr-nm[\s\S]*chr-pr[\s\S]*chr-dd/, 'linha continua com rank+nome, produto e dias, na ordem (trava v942/v972)');
assert.match(rowSrc, /cpBarraMensagensMini\(l, ?maxMsgs\)/, 'barra de mensagens continua na linha');

// 3. CSS do motivo (chr-exp e a variação de altura data-exp) foi removido — não sobrou regra
// morta referenciando um span que não é mais gerado.
assert.doesNotMatch(app, /\.chr-exp/, 'nenhuma regra CSS de .chr-exp sobrou em app.js');
assert.doesNotMatch(app, /\[data-exp="1"\]/, 'nenhuma regra CSS de [data-exp="1"] sobrou em app.js');
assert.doesNotMatch(app, /const RAIO_SVG/, 'a constante RAIO_SVG (só usada no ícone retirado) foi removida');

// 4. cpMotivoFechamento CONTINUA existindo e com o mesmo texto/comportamento (travado pelos
// testes v943/v944/v946) — só parou de ser chamada pela Home. É ela quem alimenta o briefing
// dentro do lead.
assert.match(motivoSrc, /razoes\.push/, 'cpMotivoFechamento continua montando as razões normalmente');

// 5. O briefing "dentro do lead" que o dono citou como já cobrindo isso continua de pé:
// renderLeadFoco ainda calcula e mostra o motivo via cp704-motivo.
assert.match(app, /motivoFazerAgora=\(typeof cpMotivoFechamento==='function'\)\?cpMotivoFechamento\(lead\):''/, 'renderLeadFoco (dentro do lead) continua calculando o motivo');
assert.match(app, /\$\{motivoFazerAgora\?`<div class="cp704-motivo">\$\{escapeHtml\(motivoFazerAgora\)\}<\/div>`:''\}/, 'o card "Fazer agora" dentro do lead continua mostrando o motivo via cp704-motivo');

// 6. Comportamento real: um lead com todos os fatores de ranking presentes ainda assim não gera
// nenhum vestígio de motivo na linha da Home — só os elementos que continuam existindo.
const sandbox = `
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const escapeHtml = (s) => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const produtosLabel = (l) => l.product || '';
  const prioridadeAtendimento = (l) => ({ nivel: l.__nivel||0 });
  const cpBarraMensagensMini = (l, maxMsgs) => '<span class="chr-bar"></span>';
  ${rowSrc}
  cpHomeLeadRow;
`;
const cpHomeLeadRow = eval(sandbox);
const leadComTudo = { __msgs: 12, clientMessageDays: 6, clientQuestionCount: 4, __proposta: true, __retorno: true, product: 'Apartamento Evolutti Prime', daysSinceLastInteraction: 8 };
const html = cpHomeLeadRow(leadComTudo, 1, 218);
assert.doesNotMatch(html, /chr-exp|data-exp|Já se falou de valor/i, 'nem lead com todos os fatores de ranking mostra qualquer vestígio de motivo na Home');
assert.match(html, /class="chr-rank"[^>]*>1º</, 'a linha continua com o badge de posição (v972), independente do motivo');
assert.match(html, /há 8d/, 'a linha continua com o contador de dias (v972)');

console.log('v975-motivo-so-no-lead: ok');
