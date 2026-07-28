import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v975 — o dono viu a v974 (motivo virou ícone + resumo curto) e pediu pra tirar de vez: "já tem
// o breafing, analise dentro do lead, nao precisa isso... nem na tela inicial". A explicação do
// ranking (v945/946) seguiu existindo só no card "Fazer agora" de dentro do lead (renderLeadFoco/
// cp704-motivo) — não mais na Home (cpHomeLeadRow).
//
// v1017 — o dono voltou a reclamar do MESMO texto, agora vendo-o dentro do lead: "pode deletar,
// excluir e sumir com isso que só serve pra incomodar, não me ajuda em nada, só polui tela".
// cpFatoresRankingLead/cpMotivoFechamento (e o card cp704-motivo que os mostrava) foram removidos
// de vez — não sobrevivem em lugar nenhum do app, nem na Home nem dentro do lead.

function extrai(nome) {
  const m = app.match(new RegExp(`function ${nome}\\([^)]*\\)\\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `${nome} não encontrada em app.js`);
  return m[0];
}

const rowSrc = extrai('cpHomeLeadRow');

// 1. cpHomeLeadRow não chama (e nunca chamou desde a v975) cpMotivoFechamento, nem referencia
// nada do antigo destaque (chr-exp/data-exp/RAIO_SVG) — isso continua valendo.
assert.doesNotMatch(rowSrc, /cpMotivoFechamento\(/, 'cpHomeLeadRow não invoca cpMotivoFechamento');
assert.doesNotMatch(rowSrc, /chr-exp|data-exp|RAIO_SVG/, 'cpHomeLeadRow não referencia chr-exp/data-exp/RAIO_SVG');

// 2. O que continua na linha da Home: nome, produto, barra de mensagens, dias — nessa ordem.
// (v1046: o badge de posição, "1º"/"2º"/..., foi removido de vez — pedido do dono.)
assert.match(rowSrc, /chr-nm[\s\S]*chr-pr[\s\S]*chr-dd/, 'linha continua com nome, produto e dias, na ordem (trava v942/v972)');
assert.doesNotMatch(rowSrc, /chr-rank/, 'badge de posição (chr-rank) não existe mais na linha (v1046)');
assert.match(rowSrc, /cpBarraMensagensMini\(l, ?maxMsgs\)/, 'barra de mensagens continua na linha');

// 3. CSS do motivo (chr-exp e a variação de altura data-exp) segue removido — nenhuma regra
// morta referenciando um span que não é mais gerado.
assert.doesNotMatch(app, /\.chr-exp/, 'nenhuma regra CSS de .chr-exp sobrou em app.js');
assert.doesNotMatch(app, /\[data-exp="1"\]/, 'nenhuma regra CSS de [data-exp="1"] sobrou em app.js');
assert.doesNotMatch(app, /const RAIO_SVG/, 'a constante RAIO_SVG (só usada no ícone retirado) foi removida');

// 4. v1017 — cpFatoresRankingLead/cpMotivoFechamento foram removidas de vez (não sobrevivem em
// lugar nenhum, nem como helper morto).
assert.doesNotMatch(app, /function cpFatoresRankingLead/, 'cpFatoresRankingLead foi removida do app');
assert.doesNotMatch(app, /function cpMotivoFechamento/, 'cpMotivoFechamento foi removida do app');

// 5. v1017 — o card "Fazer agora" dentro do lead (renderLeadFoco) não calcula nem mostra mais
// esse motivo — nenhum vestígio de motivoFazerAgora/cp704-motivo sobrou no arquivo.
assert.doesNotMatch(app, /motivoFazerAgora/, 'renderLeadFoco não calcula mais motivoFazerAgora');
assert.doesNotMatch(app, /cp704-motivo/, 'nenhum vestígio da classe cp704-motivo sobrou em app.js');

// 6. Comportamento real: um lead com todos os fatores de ranking presentes ainda assim não gera
// nenhum vestígio de motivo na linha da Home — só os elementos que continuam existindo.
const sandbox = `
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const escapeHtml = (s) => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const produtosLabel = (l) => l.product || '';
  const produtosLabelCurto = (l) => l.product || '';
  const prioridadeAtendimento = (l) => ({ nivel: l.__nivel||0 });
  const cpBarraMensagensMini = (l, maxMsgs) => '<span class="chr-bar"></span>';
  ${rowSrc}
  cpHomeLeadRow;
`;
const cpHomeLeadRow = eval(sandbox);
const leadComTudo = { __msgs: 12, clientMessageDays: 6, clientQuestionCount: 4, __proposta: true, __retorno: true, product: 'Apartamento Evolutti Prime', daysSinceLastInteraction: 8 };
const html = cpHomeLeadRow(leadComTudo, 218);
assert.doesNotMatch(html, /chr-exp|data-exp|Já se falou de valor/i, 'nem lead com todos os fatores de ranking mostra qualquer vestígio de motivo na Home');
assert.match(html, /há 8d/, 'a linha continua com o contador de dias (v972)');

console.log('v975-motivo-so-no-lead: ok (atualizado na v1017 — motivo removido de vez, nem dentro do lead sobrevive)');
