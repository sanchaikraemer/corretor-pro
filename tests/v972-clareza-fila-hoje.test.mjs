import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v972 — o dono revisou um print real da Home (produção) e apontou 4 problemas concretos:
//
// 1) O número mais chamativo da linha (barra de mensagens) não bate com a ordem da fila — é
//    contagem bruta de mensagens (engajamento), NUNCA foi a nota de prioridade (v943/v944 já
//    baixaram esse peso de propósito no ranking). Um lead com número maior podia aparecer ABAIXO
//    de outro com número menor, quebrando a confiança na lista. Correção NA ÉPOCA: cada linha
//    ganhava um badge de POSIÇÃO (chr-rank, "1º"/"2º"/...) que nunca contradizia a ordem.
//    v1046 — o dono pediu pra tirar esse badge de vez ("não quero número de posição, isso é
//    desnecessário"): a lista já mostra a quantidade certa (a meta configurada no Cérebro), sem
//    precisar numerar. Os testes que travavam o badge foram substituídos por testes que travam a
//    AUSÊNCIA dele.
// 2) O contador de dias ("78d") aparecia sem rótulo do lado de "cliente esperando sua resposta",
//    ambíguo (dias desde a última interação DE QUALQUER LADO, não necessariamente quanto tempo o
//    cliente espera). Correção: prefixo "há" + title explicando o que o número mede.
// 3) Quando 2+ leads do topo da fila batem os mesmos 2 fatores gerais (proposta + cliente
//    espera), o motivo parecia frase idêntica. Correção NESTA versão: o número que REALMENTE
//    varia por lead (recorrência/perguntas) ganha negrito+sublinhado — cpMotivoFechamento em si
//    não muda (texto travado pelo teste v946). SUPERADO NA v974 (ícone + resumo curto) e depois
//    RETIRADO DE VEZ NA v975: o dono achou redundante com o briefing/análise que já existe dentro
//    do lead e pediu pra tirar da Home. Ver tests/v975-motivo-so-no-lead.test.mjs. Os testes
//    abaixo que checavam o negrito por dígito foram removidos daqui.
// 4) Lista de produtos truncava no meio da palavra sem jeito de ver o texto completo. Correção:
//    title com o texto completo no span chr-pr.
//
// Cor do motivo (--accent/coral) e os limiares de cpBarraMensagensMini foram DELIBERADAMENTE
// mantidos: são decisão explícita do dono (v949, corrigindo a v948 que tinha ido pra cyan) e
// travados pelos testes v942/v943/v946 — mudar isso de novo repetiria um erro já corrigido.
//
// v1017 — cpFatoresRankingLead/cpMotivoFechamento (citadas acima) foram removidas de vez do app
// (o dono pediu pra tirar o motivo de todo lugar, nem dentro do lead sobrou — ver
// tests/v975-motivo-so-no-lead.test.mjs e tests/v946-ranking-explicavel.test.mjs). cpHomeLeadRow
// nunca dependeu delas (só citava o nome em comentário), então nada aqui precisou mudar.

function extrai(nome) {
  const m = app.match(new RegExp(`function ${nome}\\([^)]*\\)\\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `${nome} não encontrada em app.js`);
  return m[0];
}

const rowSrc = extrai('cpHomeLeadRow');
const barSrc = extrai('cpBarraMensagensMini');

// 0. O aviso anti-regressão sobre cpBarraMensagensMini existe no código-fonte (pra nenhuma sessão
// futura desfazer o achado sem perceber o histórico). O aviso equivalente sobre a cor --accent do
// chr-exp deixou de fazer sentido na v975 (o elemento inteiro foi retirado da Home).
assert.match(app, /não é, e nunca foi, a nota de prioridade/, 'aviso sobre cpBarraMensagensMini não ser prioridade está documentado');

// 1. v1046 — o badge de posição (chr-rank, "1º"/"2º"/...) foi removido de vez, a pedido do dono.
assert.doesNotMatch(rowSrc, /chr-rank/, 'badge de posição (chr-rank) não pode mais existir na linha da Home');
assert.doesNotMatch(app, /\.chr-rank\{/, 'nenhuma regra CSS de .chr-rank sobrou em app.js');

// 2. chr-dd: prefixo "há" quando há dias, e title explicando o que o número mede.
assert.match(rowSrc, /chr-dd" title=\"\$\{escapeHtml\(diasTitle\)\}/, 'chr-dd carrega title explicativo (diasTitle)');
assert.match(rowSrc, /há \$\{escapeHtml\(dias\)\}/, 'texto visível do contador de dias ganha o prefixo "há"');

// 3. chr-pr: title com o produto completo (mesmo texto que é exibido, sem truncar no title).
assert.match(rowSrc, /chr-pr" title="\$\{escapeHtml\(prod\|\|''\)\}"/, 'chr-pr expõe o texto completo via title (não trunca no hover)');

// 4. (removido na v1017 — cpMotivoFechamento não existe mais; ver tests/v946-ranking-explicavel.test.mjs)

// 5. cpBarraMensagensMini permanece bit-a-bit a mesma lógica travada pelos testes v942/v943
// (só ganhou comentário) — garante que a "correção" não tentou remendar o número errado.
assert.match(barSrc, /n >= 15 \? '#ff6258' : n >= 5 \? '#ff8f88' : '#8a99a0'/, 'limiares de cor de cpBarraMensagensMini continuam intocados');
assert.match(barSrc, /n \/ teto \* 100/, 'proporção da barra continua intocada');

// 6. Comportamento real via sandbox (mesmos stubs do teste v946).
const sandbox = `
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const mensagensDoClienteRecente = (l) => Number(l.__msgs||0);
  const contextoPrioridadeIA = (l) => ({ propostaAtiva: !!l.__proposta, retornoProposta: !!l.__retorno });
  const ui670UltimaMensagemReal = (l) => l.__last || {m:null, falante:'desconhecido'};
  const escapeHtml = (s) => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const produtosLabel = (l) => l.product || '';
  const produtosLabelCurto = (l) => l.product || '';
  const prioridadeAtendimento = (l) => ({ nivel: l.__nivel||0 });
  const RAIO_SVG = '<svg class="raio-stub"></svg>';
  ${barSrc}
  ${rowSrc}
  ({ cpHomeLeadRow });
`;
const { cpHomeLeadRow } = eval(sandbox);

// 6a. Lead qualificado (mesmo caso do teste v946) — o formato do resumo do motivo em si (ícone +
// 1ª razão) é coberto em tests/v974-motivo-icone-resumo.test.mjs; aqui só o que continua igual.
const qualificado = { __msgs: 12, clientMessageDays: 6, clientQuestionCount: 4, __proposta: true, __retorno: true, product: 'Apartamento Evolutti Prime' };
const htmlQualificado = cpHomeLeadRow(qualificado, 218);
assert.doesNotMatch(htmlQualificado, /chr-rank/, 'lead qualificado não mostra badge de posição (v1046)');

// 6c. Lead SEM motivo (Henrique, v943/v946) continua sem o span chr-exp (v946) e sem badge de
// posição (v1046) — a linha não numera nem explica ranking, só mostra os dados do lead.
const henrique = { __msgs: 218, clientMessageDays: 1, clientQuestionCount: 0 };
const htmlHenrique = cpHomeLeadRow(henrique, 218);
assert.doesNotMatch(htmlHenrique, /chr-exp|chr-rank/, 'lead sem motivo continua sem chr-exp (trava v946) e sem badge de posição (v1046)');

// 6d. Produto longo: o title carrega o texto completo, igual ao visível (não corta).
const produtoLongo = 'Apartamento Personalité, Apartamento Prime, Apartamento Quality, Apartamento Evolutti';
const htmlProdutoLongo = cpHomeLeadRow({ __msgs: 5, product: produtoLongo }, 218);
assert.ok(htmlProdutoLongo.includes(`title="${produtoLongo}"`), 'title do produto tem o texto completo, sem truncar');

// 6e. Dias com rótulo: "há Xd" no texto visível, title muda conforme nível (cliente esperando x
// só parado).
const semNivel = cpHomeLeadRow({ __msgs: 5, daysSinceLastInteraction: 78 }, 218);
assert.match(semNivel, />há 78d</, 'texto visível vem com o prefixo "há"');
assert.match(semNivel, /desde a última intera[çc][ãa]o \(sua ou do cliente\)/, 'title genérico explica que é desde a última interação de qualquer lado, quando não é "cliente espera você"');
const comNivel1 = cpHomeLeadRow({ __msgs: 5, daysSinceLastInteraction: 78, __nivel: 1 }, 218);
assert.match(comNivel1, /Cliente esperando sua resposta há 78 dias/, 'title específico quando o dot indica "cliente aguardando você" (nivel 1)');

console.log('v972-clareza-fila-hoje: ok');
