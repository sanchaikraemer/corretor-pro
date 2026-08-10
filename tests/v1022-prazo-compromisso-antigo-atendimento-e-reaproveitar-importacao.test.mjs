import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1195 — a parte de reaproveitar a importação (cpSalvarImportPendente e companhia) mudou de
// endereço: foi pro pedaço js/importacao.js, baixado só quando o corretor importa uma conversa.
// A parte do prazo de compromisso continua no app.js. Este teste cobre os dois assuntos, então lê
// os dois arquivos — os asserts abaixo são exatamente os mesmos de antes.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');

// v1022 — dois relatos do dono no mesmo print/mensagem:
//
// 1) "Henrique continua aparecendo nas prioridades sem respeitar o prazo": temAgenda (dentro de
//    prioridadeAtendimento) contava QUALQUER compromisso já confirmado alguma vez na conversa,
//    mesmo um vencido há meses — a extração da IA não apaga um compromisso antigo de
//    confirmedAppointments, então compromissoProgramado ficava PERMANENTEMENTE verdadeiro pra
//    esse lead, furando a janela de espera (emJanela) pra sempre. Corrigido pra só contar
//    compromisso de hoje pra frente (mesma régua que ui671CompromissoAberto/ui671DiasAte já
//    usa no card do lead). Em paralelo, protegidoPosAtendimento (usado por
//    clienteAguardandoVoce/ponto vermelho e pelo grupo "Atendidos recentemente") só olhava
//    aprendizado.eventos/contato_manual — uma fonte mais estreita que ultimoAtendimentoTs (que
//    emJanelaDeEspera já usa desde a v1018, e que também olha lastAttendanceAt/
//    ultimoAtendimentoEm e mensagens manuais da timeline). As duas checagens de "atendido
//    recentemente" podiam divergir sobre o MESMO lead — unificadas pra usar a mesma fonte.
//
// 2) "Por que nunca reaproveita nada?" (import de conversa grande que deu timeout e, ao tentar
//    de novo, transcreveu tudo do zero, "0 reaproveitados"): o servidor já sabe reaproveitar a
//    transcrição de uma importação que travou, mas só se o corretor tentar de novo com o MESMO
//    importId — e esse id vivia só na memória da aba (state.activeImportId). Se a página
//    recarregar no meio de uma conversa grande (comum com ZIP grande demorando), essa memória
//    some e a próxima tentativa gera um importId novo, perdendo a ligação com o que já foi
//    transcrito. Agora o importId fica guardado no aparelho (localStorage), ligado ao arquivo
//    (nome+tamanho), pra uma nova tentativa com o MESMO arquivo reencontrar o importId anterior
//    mesmo depois de a página recarregar.

function extrai(regex, nome) {
  const m = app.match(regex);
  assert.ok(m, `${nome} não encontrado(a) em app.js`);
  return m[0];
}

// ===================== Parte A — temAgenda não conta compromisso vencido =====================

const ui671HojeIsoSrc = extrai(/function ui671HojeIso\(\)\{[\s\S]*?\n\}/, 'ui671HojeIso');
const ui671DiasAteSrc = extrai(/function ui671DiasAte\(data\)\{[\s\S]*?\n\}/, 'ui671DiasAte');
const temAgendaSrc = extrai(/const temAgenda = Array\.isArray\(a\.confirmedAppointments\)[\s\S]*?\n  \}\);/, 'const temAgenda = ...');

// Precisa continuar existindo o fallback textual (sem data parseável, mas cita hoje/amanhã) —
// só deixou de ser um "ou" separado em compromissoProgramado (virou parte do próprio temAgenda).
assert.match(app, /const compromissoProgramado = temAgenda;/,
  'compromissoProgramado precisa ser só temAgenda (o teste redundante de hoje/amanhã saiu daqui)');

const temAgendaDe = eval(`
  ${ui671HojeIsoSrc}
  ${ui671DiasAteSrc}
  (function(a){
    ${temAgendaSrc}
    return temAgenda;
  })
`);

const diasIso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// 1. Sem compromisso nenhum: false.
assert.equal(temAgendaDe({}), false, 'sem confirmedAppointments, temAgenda é false');
assert.equal(temAgendaDe({ confirmedAppointments: [] }), false, 'lista vazia, temAgenda é false');

// 2. Compromisso com data no FUTURO: continua contando (é o caso legítimo de "programado").
assert.equal(temAgendaDe({ confirmedAppointments: [{ data: diasIso(3), oQue: 'visita' }] }), true,
  'compromisso daqui a 3 dias ainda está de pé — deve contar como programado');

// 3. Compromisso HOJE: conta.
assert.equal(temAgendaDe({ confirmedAppointments: [{ data: diasIso(0), oQue: 'visita' }] }), true,
  'compromisso de hoje conta como programado');

// 4. O BUG relatado: compromisso com data já bem passada (60 dias atrás) NÃO pode mais furar a
// janela de espera pra sempre.
assert.equal(temAgendaDe({ confirmedAppointments: [{ data: diasIso(-60), oQue: 'visita', quando: 'sábado' }] }), false,
  'compromisso vencido há 60 dias não pode mais forçar "programado" pra sempre (bug do Henrique)');

// 5. Sem "data" parseável, mas o texto original cita "hoje": fallback textual continua
// funcionando (mesma regra de sempre, só quando não há como calcular a data de verdade).
assert.equal(temAgendaDe({ confirmedAppointments: [{ quando: 'confirmado para hoje de manhã' }] }), true,
  'sem data parseável, o fallback por texto (hoje/amanhã) continua valendo');

// 6. Sem "data" parseável e sem menção a hoje/amanhã: não conta (evita o mesmo problema por
// outro caminho — texto antigo tipo "combinamos pra semana que vem" não deve grudar pra sempre).
assert.equal(temAgendaDe({ confirmedAppointments: [{ quando: 'semana que vem' }] }), false,
  'sem data parseável e sem "hoje"/"amanhã" no texto, não conta como programado');

// ============== Parte B — protegidoPosAtendimento usa a mesma fonte que emJanelaDeEspera ==============

const diasCalSrc = extrai(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/, 'diasCalendarioBR');
const tiposSrc = extrai(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/, 'TIPOS_ATENDIMENTO_TIMELINE');
const ultAtSrc = extrai(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/, 'ultimoAtendimentoTs');
// v1049 — o prazo fixo virou cpDiasDescansoPosAtendimento (configurável no Cérebro, padrão 5
// quando não há config — o caso deste teste, que não simula o formulário/localStorage).
const diasDescansoSrc = extrai(/function cpDiasDescansoPosAtendimento\(\)\{[\s\S]*?\n\}/, 'cpDiasDescansoPosAtendimento');
const protegidoSrc = extrai(/function protegidoPosAtendimento\(l\)\{[\s\S]*?\n\}/, 'protegidoPosAtendimento');

assert.doesNotMatch(app, /function diasDesdeAtendimentoManual/,
  'diasDesdeAtendimentoManual foi removida — protegidoPosAtendimento não usa mais essa fonte mais estreita');

const protegidoPosAtendimento = eval(`
  ${diasCalSrc}
  ${tiposSrc}
  ${ultAtSrc}
  ${diasDescansoSrc}
  ${protegidoSrc}
  protegidoPosAtendimento
`);

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

// 1. Atendimento só via aprendizado.eventos (o caminho que já funcionava antes): continua ok.
assert.equal(protegidoPosAtendimento({ analysis: { aprendizado: { eventos: [
  { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(2) }
] } } }), true, 'atendimento via aprendizado.eventos continua protegendo (2 dias, dentro do prazo)');

// 2. O BUG: atendimento registrado SÓ no campo lastAttendanceAt (sem evento correspondente) —
// antes da v1022, diasDesdeAtendimentoManual não olhava esse campo e devolvia "não protegido".
assert.equal(protegidoPosAtendimento({ lastAttendanceAt: diasAtras(2), analysis: {} }), true,
  'atendimento registrado só via lastAttendanceAt precisa proteger o lead também (antes não protegia)');

// 3. Mesmo bug, via mensagem manual da timeline (ex.: "copiar sugestão" registra tipo
// mensagem_enviada) sem evento contato_manual correspondente.
assert.equal(protegidoPosAtendimento({
  analysis: {},
  recentMessages: [{ source: 'manual', type: 'mensagem_enviada', iso: diasAtras(1), text: 'oi' }]
}), true, 'atendimento só na timeline (mensagem manual) também precisa proteger o lead');

// 4. Sem nenhum atendimento: não protegido.
assert.equal(protegidoPosAtendimento({ analysis: {} }), false, 'sem atendimento nenhum, não protegido');

// 5. Atendimento antigo (6 dias, > descanso padrão de 5): não protege mais.
assert.equal(protegidoPosAtendimento({ lastAttendanceAt: diasAtras(6), analysis: {} }), false,
  'atendimento de 6 dias atrás já passou do prazo de proteção (5 dias)');

// ===================== Parte C — importação lembra o importId no aparelho =====================

const chaveSrc = extrai(/const CP_IMPORT_PENDENTE_KEY = "cpImportPendente";/, 'CP_IMPORT_PENDENTE_KEY');
const validadeSrc = extrai(/const CP_IMPORT_PENDENTE_VALIDADE_MS = [^\n]*\n/, 'CP_IMPORT_PENDENTE_VALIDADE_MS');
const salvarSrc = extrai(/function cpSalvarImportPendente\(importId, file\)\{[\s\S]*?\n\}/, 'cpSalvarImportPendente');
const lerSrc = extrai(/function cpImportIdParaArquivo\(file\)\{[\s\S]*?\n\}/, 'cpImportIdParaArquivo');
const limparSrc = extrai(/function cpLimparImportPendente\(\)\{[\s\S]*?\n\}/, 'cpLimparImportPendente');

// processFile precisa: (a) tentar o importId salvo no aparelho quando não há um na memória, e
// (b) salvar o importId decidido assim que ele existe — pra uma futura tentativa se beneficiar.
// v1195 — processFile agora é a última função de js/importacao.js; o fim do bloco é a linha de
// exportação. (Antes o marcador de fim era readShareDebug, que ficou no app.js.)
const processFileSrc = app.slice(app.indexOf('async function processFile(file, options = {}){'), app.indexOf('export { processFile }'));
assert.match(processFileSrc, /state\.activeImportId \|\| cpImportIdParaArquivo\(file\) \|\| criarImportId\(\)/,
  'processFile precisa tentar o importId salvo no aparelho antes de gerar um novo');
assert.match(processFileSrc, /cpSalvarImportPendente\(importId, file\)/,
  'processFile precisa guardar o importId decidido, ligado ao arquivo');
// Limpeza: as 5 saídas conhecidas de uma importação (salvar novo, atualizar existente, descartar
// análise, descartar upload, descartar tentativa) precisam limpar o registro pendente também —
// 5 chamadas reais + 1 (a própria declaração da função, que também bate no texto "nome()").
const vezesNoAppTodo = (app.match(/cpLimparImportPendente\(\)/g) || []).length;
assert.ok(vezesNoAppTodo >= 6,
  `esperava cpLimparImportPendente() nos 5 fluxos de salvar/descartar + a declaração (achei ${vezesNoAppTodo})`);

globalThis.localStorage = {
  _dados: {},
  getItem(k){ return Object.prototype.hasOwnProperty.call(this._dados, k) ? this._dados[k] : null; },
  setItem(k, v){ this._dados[k] = String(v); },
  removeItem(k){ delete this._dados[k]; }
};

const { cpSalvarImportPendente, cpImportIdParaArquivo, cpLimparImportPendente } = eval(`
  ${chaveSrc}
  ${validadeSrc}
  ${salvarSrc}
  ${lerSrc}
  ${limparSrc}
  ({ cpSalvarImportPendente, cpImportIdParaArquivo, cpLimparImportPendente })
`);

const arquivo = { name: 'Conversa do WhatsApp com Cesinha corretor.zip', size: 65136640 };

// 1. Salva e recupera o MESMO arquivo (nome + tamanho iguais) → mesmo importId.
globalThis.localStorage.removeItem('cpImportPendente');
cpSalvarImportPendente('imp-abc123', arquivo);
assert.equal(cpImportIdParaArquivo(arquivo), 'imp-abc123', 'mesmo arquivo (nome+tamanho) recupera o importId salvo');

// 2. Arquivo com nome diferente → não reaproveita (evita ligar transcrição de UM cliente a outro).
assert.equal(cpImportIdParaArquivo({ name: 'Conversa do WhatsApp com Outro cliente.zip', size: 65136640 }), '',
  'arquivo com nome diferente não reaproveita o importId de outro');

// 3. Mesmo nome, tamanho diferente (arquivo diferente por dentro) → não reaproveita.
assert.equal(cpImportIdParaArquivo({ name: arquivo.name, size: 999 }), '',
  'mesmo nome mas tamanho diferente não reaproveita o importId');

// 4. cpLimparImportPendente() apaga o registro (usado quando a importação termina/é descartada).
cpLimparImportPendente();
assert.equal(cpImportIdParaArquivo(arquivo), '', 'depois de limpar, não sobra importId pra reaproveitar');

// 5. Registro expirado (mais de 24h) não é reaproveitado.
globalThis.localStorage.setItem('cpImportPendente', JSON.stringify({
  importId: 'imp-velho', fileName: arquivo.name, fileSize: arquivo.size, ts: Date.now() - 25 * 60 * 60 * 1000
}));
assert.equal(cpImportIdParaArquivo(arquivo), '', 'registro com mais de 24h não é mais reaproveitado');

console.log('v1022-prazo-compromisso-antigo-atendimento-e-reaproveitar-importacao: ok');
