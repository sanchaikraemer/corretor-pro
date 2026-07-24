import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v946 — ranking explicável: o dono reclamava (v943/v944) que a ORDEM do "Fazer agora" parecia
// "errada" porque o motivo da priorização era uma caixa-preta. cpMotivoFechamento(l) explica em
// texto curto por que um lead está classificado como está — usando os MESMOS fatores de
// cpProbabilidadeFechamento (recorrência/perguntas/negociação/cliente-espera-você), sem citar a
// contagem bruta de mensagens (esse é o fator que NÃO deve "vencer" sozinho; citá-lo como motivo
// recriaria a confusão do caso "Henrique" que a v943/v944 corrigiram).
//
// cpFatoresRankingLead/cpMotivoFechamento DUPLICAM de propósito a lógica de cpProbabilidadeFechamento
// (não foi extraído um helper comum) porque o corpo de cpProbabilidadeFechamento é travado por
// regex nos testes v943/v944 — chamar uma função nova de dentro dela quebraria esses testes.

function extrai(nome) {
  const m = app.match(new RegExp(`function ${nome}\\([^)]*\\)\\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `${nome} não encontrada em app.js`);
  return m[0];
}

const fatoresSrc = extrai('cpFatoresRankingLead');
const motivoSrc = extrai('cpMotivoFechamento');
const rowSrc = extrai('cpHomeLeadRow');

// 1. As novas funções existem e usam os MESMOS campos/condições que cpProbabilidadeFechamento.
assert.match(fatoresSrc, /l\?\.clientMessageDays/, 'usa a recorrência (mesmo campo do score)');
assert.match(fatoresSrc, /l\?\.clientQuestionCount/, 'usa as perguntas (mesmo campo do score)');
assert.match(fatoresSrc, /contextoPrioridadeIA/, 'usa o sinal de negociação (mesma fonte do score)');
assert.match(fatoresSrc, /ui670UltimaMensagemReal/, 'usa a última mensagem real (mesma checagem v944)');
assert.match(fatoresSrc, /falante === "contato"/, 'só avalia despedida quando quem falou por último foi o contato (mesma regra v944)');

// 2. cpProbabilidadeFechamento continua INTOCADA (corpo travado pelos testes v943/v944) — a nova
// função não foi extraída de dentro dela.
const probSrc = extrai('cpProbabilidadeFechamento');
assert.doesNotMatch(probSrc, /cpFatoresRankingLead|cpMotivoFechamento/, 'cpProbabilidadeFechamento não pode chamar as funções novas (quebraria o corpo travado por regex nos testes v943/v944)');

// 3. Comportamento real: sandbox com os mesmos stubs dos testes oficiais v943/v944.
const sandbox = `
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const contextoPrioridadeIA = (l) => ({ propostaAtiva: !!l.__proposta, retornoProposta: !!l.__retorno });
  const ui670UltimaMensagemReal = (l) => l.__last || {m:null, falante:'desconhecido'};
  const escapeHtml = (s) => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const produtosLabel = (l) => l.product || '';
  const prioridadeAtendimento = (l) => ({ nivel: 0 });
  const cpBarraMensagensMini = (l, maxMsgs) => '<span class="chr-bar"></span>';
  const RAIO_SVG = '<svg class="raio-stub"></svg>';
  ${fatoresSrc}
  ${motivoSrc}
  ${rowSrc}
  ({ cpFatoresRankingLead, cpMotivoFechamento, cpHomeLeadRow });
`;
const { cpMotivoFechamento, cpHomeLeadRow } = eval(sandbox);

// 3a. Caso "Henrique" (v943): 218 msgs, 1 dia de recorrência, 0 perguntas, sem negociação — não
// tem NENHUM fator qualificado (recorrência exige >=2). Motivo tem que ficar vazio, nunca citar
// as 218 mensagens como se fossem o motivo da prioridade.
const henrique = { __msgs: 218, clientMessageDays: 1, clientQuestionCount: 0 };
assert.equal(cpMotivoFechamento(henrique), '', 'Henrique (só volume, sem outro sinal) não pode ter motivo inventado');

// 3b. Lead qualificado (v943): 12 msgs, 6 dias, 4 perguntas, proposta+retorno — motivo rico,
// citando negociação, recorrência real e perguntas, SEM citar a contagem de mensagens (12).
const qualificado = { __msgs: 12, clientMessageDays: 6, clientQuestionCount: 4, __proposta: true, __retorno: true };
const motivoQualificado = cpMotivoFechamento(qualificado);
assert.match(motivoQualificado, /negocia[çc][ãa]o avan[çc]ada/i, 'cita a negociação avançada quando há retornoProposta');
assert.match(motivoQualificado, /6 dias diferentes/, 'cita a recorrência real (6 dias)');
assert.match(motivoQualificado, /4 perguntas/, 'cita as 4 perguntas');
assert.doesNotMatch(motivoQualificado, /\b12\b/, 'NUNCA cita a contagem bruta de mensagens (12) como motivo');
assert.ok(motivoQualificado.split(' · ').length <= 3, 'no máximo 3 razões, pra ficar uma frase curta');

// 3c. Caso "Fábio" (v944): despedida pura não pode virar "cliente esperando"; pergunta real sim.
const base = { daysSinceClientReply: 3, daysSinceLastTouch: 5 };
const comDespedida = { ...base, __last: { falante: 'contato', m: { text: 'Obrigado pela atenção' } } };
const comPergunta = { ...base, __last: { falante: 'contato', m: { text: 'Consegue me mandar a planta do apartamento?' } } };
assert.doesNotMatch(cpMotivoFechamento(comDespedida), /esperando/, 'despedida pura não gera "cliente esperando sua resposta"');
assert.match(cpMotivoFechamento(comPergunta), /esperando sua resposta/, 'pergunta real gera "cliente esperando sua resposta"');

// 3d. Lead fraco (sem nenhum sinal real) — motivo vazio, nunca inventa razão.
assert.equal(cpMotivoFechamento({ __msgs: 6, clientMessageDays: 1, clientQuestionCount: 0 }), '', 'lead sem nenhum sinal real tem motivo vazio');

// 3e. Robustez: lead null/undefined/vazio e valores NaN/negativos não podem quebrar nem vazar lixo.
assert.doesNotThrow(() => cpMotivoFechamento(null), 'lead null não pode lançar exceção');
assert.doesNotThrow(() => cpMotivoFechamento(undefined), 'lead undefined não pode lançar exceção');
assert.equal(cpMotivoFechamento(null), '', 'lead null tem motivo vazio');
assert.equal(cpMotivoFechamento({}), '', 'lead vazio {} tem motivo vazio');
const motivoNeg = cpMotivoFechamento({ clientMessageDays: -5, clientQuestionCount: -2 });
assert.doesNotMatch(motivoNeg, /-\d/, 'número negativo não pode aparecer no texto');
const motivoNaN = cpMotivoFechamento({ clientMessageDays: 'abc', clientQuestionCount: NaN });
assert.doesNotMatch(motivoNaN, /NaN/, '"NaN" não pode aparecer no texto');

// 4. cpHomeLeadRow: o motivo só aparece (data-exp + chr-exp) quando há razão real; ordem
// chr-nm→chr-pr→chr-dd (travada pelo teste v942) continua valendo mesmo com o motivo appendado
// depois de chr-dd; a classe "cp-hoje-row" (travada pelo teste v942) não é alterada.
const htmlComMotivo = cpHomeLeadRow(qualificado, 1, 20);
assert.match(htmlComMotivo, /class="cp-hoje-row"/, 'a classe cp-hoje-row continua intacta (não quebra o teste v942)');
assert.match(htmlComMotivo, /data-exp="1"/, 'linha com motivo real tem data-exp="1"');
assert.match(htmlComMotivo, /class="chr-exp"/, 'linha com motivo real tem o span chr-exp');
assert.match(htmlComMotivo, /chr-nm[\s\S]*chr-pr[\s\S]*chr-dd/, 'ordem nm->pr->dd preservada (trava v942)');

const htmlSemMotivo = cpHomeLeadRow(henrique, 1, 218);
assert.doesNotMatch(htmlSemMotivo, /data-exp/, 'linha sem motivo não tem data-exp (altura da linha não muda)');
assert.doesNotMatch(htmlSemMotivo, /chr-exp/, 'linha sem motivo não tem o span chr-exp');

// 5. CSS novo é ADITIVO — as regras antigas travadas pelo teste v942 continuam presentes,
// literalmente, em algum lugar de app.js (o novo CSS não as substitui, só acrescenta ao lado).
assert.match(app, /\.cp-hoje-row\{width:100%;display:grid/, 'regra base do desktop continua intacta');
assert.match(app, /grid-template-areas:"dot nm dd" "dot bar pr"/, 'regra base do mobile continua intacta (trava v942)');
assert.match(app, /\.cp-hoje-row\[data-exp="1"\]\{grid-template-rows:auto auto/, 'nova regra desktop para linha com motivo existe');
assert.match(app, /\.cp-hoje-row\[data-exp="1"\]\{grid-template-areas:"dot nm dd" "dot bar pr" "dot exp exp"\}/, 'nova regra mobile para linha com motivo existe');
// v948 — cor de destaque (--accent, o coral já usado em todo o app), não o cinza discreto
// (--muted) do resto da linha. v947.1 tinha usado --cyan (azul, fora da paleta do app, segundo o
// dono) e foi corrigido pra --accent na v948.1. Cor continua travada aqui; o PESO mudou na v974
// (800→700, dono achou a frase inteira "grande, em negrito, desarmoniza" — ver
// tests/v974-motivo-icone-resumo.test.mjs para o formato atual, ícone + resumo curto).
assert.match(app, /\.cp-hoje-row \.chr-exp\{[^}]*font-weight:700;color:var\(--accent\)/, 'chr-exp usa a cor de destaque do app (--accent), não cinza nem uma cor fora da paleta (peso ajustado na v974)');

// 6. O mesmo motivo aparece no card "Fazer agora" do detalhe do lead (renderLeadFoco), com destaque
// visual próprio (v947.1 — "Última análise"/"Última mensagem" usam cp704-metaline, discreto de
// propósito; o motivo precisa se destacar, senão o corretor não percebe que existe).
assert.match(app, /motivoFazerAgora=\(typeof cpMotivoFechamento==='function'\)\?cpMotivoFechamento\(lead\):''/, 'renderLeadFoco calcula o motivo com o mesmo guard defensivo do resto do arquivo');
assert.match(app, /\$\{motivoFazerAgora\?`<div class="cp704-motivo">\$\{escapeHtml\(motivoFazerAgora\)\}<\/div>`:''\}/, 'o card "Fazer agora" do detalhe mostra o motivo via cp704-motivo (destaque próprio), escapado, só quando não-vazio');
assert.match(app, /\.cp704-motivo\{[^}]*color:var\(--accent\)/, 'cp704-motivo usa a cor de destaque do app (--accent), não o cinza discreto do metaline nem uma cor fora da paleta');

console.log('v946-ranking-explicavel: ok');
