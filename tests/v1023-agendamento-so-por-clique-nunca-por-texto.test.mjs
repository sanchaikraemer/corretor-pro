import fs from 'node:fs';
import assert from 'node:assert/strict';
import { listRecentProcessings } from '../api/_persistence.js';

// v1023 — o dono foi taxativo (repetindo uma ordem já dada em dias anteriores): "mesmo que haja
// alguma coisa na conversa sobre vamos agendar, vamos visitar, vamos conversar de novo, você não
// pode agendar... agendamento só pode ser feito se clicar em agenda, sem exceção." Mesmo
// princípio já aplicado ao lembrete na v988 (nunca inferir de texto, só por clique explícito),
// agora também pra "compromisso confirmado" (confirmedAppointments).
//
// Causa raiz encontrada: a extração da IA que POPULAVA confirmedAppointments com base na
// conversa já tinha sido zerada (api/_pipeline.js: analyzeWithBrain devolve sempre
// confirmedAppointments:[]) — mas QUALQUER ação que salvasse um lead (copiar mensagem, marcar
// atendimento, adicionar observação, mudar etapa, editar dados, reanalisar) espalhava o valor
// ANTIGO já salvo no banco de volta ("...anterior" / "...(current.resultado_analise||{})"),
// perpetuando pra sempre um compromisso que a IA tinha inferido há muito tempo, antes da
// extração ser zerada. E a leitura (listRecentProcessings) só "validava" o compromisso antigo
// (filtrarCompromissosReais) em vez de simplesmente não confiar mais nele.
//
// Fix: confirmedAppointments agora é zerado (a) em TODA leitura de lead (listRecentProcessings,
// o único portão por onde a tela recebe dados) e (b) em TODA gravação de resultado_analise nas
// duas rotas que escrevem leads (reanalisar-lead.js, lead-update.js) — sem depender de reanalisar
// cada lead antigo pra "limpar" o banco.

const persistenceSrc = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');
const pipelineSrc = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const reanalisarSrc = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url), 'utf8');
const leadUpdateSrc = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');

function extrairFn(src, nome, nomeArquivo) {
  const marcadores = [`async function ${nome}(`, `function ${nome}(`];
  let ini = -1;
  for (const m of marcadores) { ini = src.indexOf(m); if (ini > -1) break; }
  assert.ok(ini > -1, `${nome} não encontrada em ${nomeArquivo}`);
  const fim = src.indexOf('\n}\n', ini);
  assert.ok(fim > ini, `não achei o fim de ${nome} em ${nomeArquivo}`);
  return src.slice(ini, fim);
}

// ===================== Parte A — listRecentProcessings zera pra qualquer leitura =====================

function fakeSupabaseUmaLinha(row) {
  return {
    from(tabela) {
      assert.equal(tabela, 'whatsapp_processamentos');
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit() { return Promise.resolve({ data: [row], error: null }); },
        update() { return { eq() { return { eq() { return Promise.resolve({ error: null }); } }; } }; }
      };
    }
  };
}

async function parteLeitura() {
  const rowComCompromissoAntigo = {
    id: 'lead-henrique',
    nome_arquivo: 'Conversa do WhatsApp com Henrique.zip',
    timeline_json: [{ author: 'Henrique', text: 'vamos agendar uma visita', iso: new Date().toISOString() }],
    resultado_analise: {
      summary: 'teste',
      confirmedAppointments: [
        { oQue: 'visita', quando: 'sábado', data: '2020-01-01', trechoLiteral: 'vamos agendar uma visita', combinadoPor: 'cliente' }
      ]
    },
    organization_id: 'org-1',
    atualizado_em: new Date().toISOString()
  };

  // 1. Lista compacta (Home/Carteira) — confirmedAppointments zerado.
  const r1 = await listRecentProcessings(10, { supabase: fakeSupabaseUmaLinha(rowComCompromissoAntigo), organizationId: 'org-1' });
  assert.equal(r1.ok, true, JSON.stringify(r1));
  const item1 = r1.items.find(i => i.id === 'lead-henrique');
  assert.ok(item1, 'lead precisa aparecer na listagem');
  assert.deepEqual(item1.analysis.confirmedAppointments, [], 'confirmedAppointments sempre vazio na lista, mesmo com dado antigo salvo');

  // 2. Detalhe completo do lead (includeFullTimeline) — MESMA garantia, mesmo tendo prova
  // literal na conversa (o que filtrarCompromissosReais validaria como "real" antes da v1023).
  const r2 = await listRecentProcessings(10, { supabase: fakeSupabaseUmaLinha(rowComCompromissoAntigo), organizationId: 'org-1', includeFullTimeline: true });
  const item2 = r2.items.find(i => i.id === 'lead-henrique');
  assert.deepEqual(item2.analysis.confirmedAppointments, [], 'confirmedAppointments sempre vazio no detalhe também, mesmo com prova literal na conversa');

  console.log('v1023 (leitura): listRecentProcessings zera confirmedAppointments sempre — ok');
}
await parteLeitura();

// ===================== Parte B — _pipeline.js: extração/validação por texto removida =====================

assert.doesNotMatch(pipelineSrc, /function mcCompromissoAberto/, 'mcCompromissoAberto (inferia compromisso da conversa) foi removida');
assert.doesNotMatch(pipelineSrc, /function filtrarCompromissosReais|export function filtrarCompromissosReais/, 'filtrarCompromissosReais (validava compromisso por texto) foi removida');
assert.doesNotMatch(pipelineSrc, /function termoObrigatorioDoTipo/, 'termoObrigatorioDoTipo (helper só de filtrarCompromissosReais) foi removida');
assert.doesNotMatch(persistenceSrc, /import \{ filtrarCompromissosReais \}/, '_persistence.js não importa mais uma validação que não existe mais');

// A extração principal (analyzeWithBrain) continua devolvendo sempre vazio — não regrediu.
assert.match(pipelineSrc, /confirmedAppointments:\s*\[\]/, 'analyzeWithBrain continua devolvendo confirmedAppointments:[] (nunca extrai de novo da conversa)');

console.log('v1023 (_pipeline.js): extração/validação por texto de compromisso removida — ok');

// ===================== Parte C — reanalisar-lead.js: nenhuma gravação preserva compromisso antigo =====================

const handlerSrc = extrairFn(reanalisarSrc, 'reanalisarLeadHandler702', 'reanalisar-lead.js');
assert.match(handlerSrc, /function aplicarCompromisso\(obj\)\s*\{\s*obj\.confirmedAppointments\s*=\s*\[\];?\s*\}/,
  'aplicarCompromisso (zera confirmedAppointments) precisa existir em reanalisar-lead.js');
// 3 lugares que gravam resultado_analise dentro do handler: corrigir-observacao (mergedC),
// apenasSalvar, e a reanálise completa — todos precisam neutralizar confirmedAppointments.
const ocorrenciasNeutralizacao = (handlerSrc.match(/confirmedAppointments:\s*\[\]|aplicarCompromisso\(/g) || []).length;
assert.ok(ocorrenciasNeutralizacao >= 4,
  `esperava pelo menos 4 neutralizações de confirmedAppointments (1 na função + mergedC + apenasSalvar + reanálise), achei ${ocorrenciasNeutralizacao}`);

console.log('v1023 (reanalisar-lead.js): todo caminho de gravação zera confirmedAppointments — ok');

// ===================== Parte D — lead-update.js: cada ação que grava lead neutraliza também =====================

// v1069 — acaoDesfecho (Marcar venda/Marcar perda) foi removida: era código morto sem nenhum
// caminho no front que ainda chamasse a ação "desfecho" (as telas que a usavam já tinham saído
// do app antes disso).
// v1092 — acaoLembreteSet/acaoLembreteClear saíram da lista porque as duas ações foram
// removidas do lead-update.js: nenhuma tela do app as chamou em nenhum momento da história do
// projeto, e lembrete automático é justamente o que esta regra proíbe.
const acoesQueGravamLead = [
  'acaoAnaliseComercialSet', 'acaoNovaOportunidadeParceiro',
  'acaoAtualizarComEvolucao', 'acaoEtapa', 'acaoMemoriaSet', 'acaoObservacaoAdicionar',
  'acaoAprendizado', 'acaoEditarDados', 'removerVinculosComLeadsApagados'
];
// E o que foi removido não pode voltar sem passar pela regra acima.
for (const sumiu of ['acaoLembreteSet', 'acaoLembreteClear']) {
  assert.doesNotMatch(leadUpdateSrc, new RegExp(`function\\s+${sumiu}\\b`),
    `${sumiu} foi removida na v1092; se voltar, precisa entrar na lista que zera confirmedAppointments`);
}
for (const nome of acoesQueGravamLead) {
  const corpo = extrairFn(leadUpdateSrc, nome, 'lead-update.js');
  assert.match(corpo, /confirmedAppointments\s*[:=]\s*\[\]/,
    `${nome} precisa zerar confirmedAppointments antes de gravar resultado_analise`);
}

// acaoCriarManual (lead 100% manual, sem ZIP) já nasce com confirmedAppointments:[] direto no
// objeto — não depende de nenhuma outra função.
assert.match(extrairFn(leadUpdateSrc, 'acaoCriarManual', 'lead-update.js'), /confirmedAppointments:\s*\[\]/, 'acaoCriarManual continua com confirmedAppointments vazio');

console.log(`v1023 (lead-update.js): as ${acoesQueGravamLead.length} ações que gravam lead zeram confirmedAppointments — ok`);

// ===================== Parte E — persistProcessingResult: 1º salvamento nunca herda do cliente =====================

// acaoSalvarNovo (o "Salvar lead" depois de importar um ZIP) manda pro servidor um "result"
// que o PRÓPRIO NAVEGADOR está reenviando de volta — em vez de confiar nesse campo vindo de
// fora, persistProcessingResult (usada pelas 3 rotas que criam/salvam lead) zera
// confirmedAppointments sempre, incondicionalmente, no ÚNICO lugar por onde todo "salvar"
// passa — cobre acaoSalvarNovo mesmo sem precisar de uma checagem própria nela.
const persistFnSrc = extrairFn(persistenceSrc, 'persistProcessingResult', '_persistence.js');
assert.match(persistFnSrc, /analysis\.confirmedAppointments\s*!==\s*undefined/, 'persistProcessingResult precisa checar confirmedAppointments antes de gravar');
assert.match(persistFnSrc, /confirmedAppointments:\s*\[\]/, 'persistProcessingResult precisa zerar confirmedAppointments incondicionalmente');

console.log('v1023 (persistProcessingResult): 1º salvamento de um lead nunca herda confirmedAppointments do cliente — ok');

console.log('v1023-agendamento-so-por-clique-nunca-por-texto: ok');
