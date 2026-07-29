import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1073 — revisão noturna completa: remoção das últimas gerações mortas de código que ainda
// EXECUTAVAM em todo boot do app (IIFEs de hotfix cp694/695/696/697/703 substituídas pela
// geração final cp788, telas antigas do fluxo #683, fluxo de editar avatar sem botão, botão
// "voltar ao topo" permanentemente escondido, etc.). Este teste trava a regressão: nada disso
// pode voltar, e o que ficou de propósito precisa continuar existindo.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// 1. Gerações mortas removidas de vez (guardas e nomes exclusivos delas).
for (const nome of [
  '__cp696AtendimentosFullList', '__cp697PreparacaoCarteira', '__cp703PreparacaoEstavel',
  'cp694FixLayout', 'cp694-lead-row', 'renderCarteira697', 'cp697SetTab',
  'ui683EnhanceLead', 'ui683MarcarEtapaRapida', 'abrirModalAgendar', 'ui631CopyResponse',
  'imagemQuadradaParaAvatar', 'editarAvatarLead', 'colarAvatarLead',
  'contateiAgora', 'marcarContatoManualPorId',
  'carteiraLinhaLead', 'baixarRelatorioCarteira', 'setCarteiraFiltro',
  'ui675PersistirFallback', 'ui670NovaOportunidade', 'btnVoltarTopo',
]) {
  assert.ok(!app.includes(nome) || app.split(nome).length === 1,
    `"${nome}" (código morto removido na v1073) não pode voltar pro app.js`);
}
assert.doesNotMatch(html, /btnVoltarTopo/, 'botão "voltar ao topo" (sempre escondido) saiu do HTML');

// 2. O que ficou DE PROPÓSITO continua vivo:
// - o embrulho do spinner da Home (homeAindaEmSkeleton depende da classe .cp694-loading);
assert.match(app, /cp694-loading/, 'spinner .cp694-loading da Home continua (homeAindaEmSkeleton depende dele)');
assert.match(app, /__cp694HotfixMobile/, 'o embrulho vivo de carregarDashboard continua');
// - o CSS vivo da lista da Condução/Atendimentos (classes emitidas pela geração final cp788);
assert.match(app, /cp695-list/, 'CSS/markup .cp695-list continua (a lista viva usa essa classe)');
// - a geração FINAL (cp788) é a única dona de renderCarteiraTabela/carregarPipeline/carregarCarteira;
assert.match(app, /__cp788ConducaoHistorico/, 'a geração final cp788 continua');
assert.equal((app.match(/window\.renderCarteiraTabela\s*=/g) || []).length, 1,
  'só a geração final pode definir window.renderCarteiraTabela');
// (v1075: a tela Condução foi deletada — ninguém mais pode definir esse render.)
assert.equal((app.match(/window\.carregarPipeline\s*=/g) || []).length, 0,
  'a tela Condução saiu na v1075 — window.carregarPipeline não pode voltar');
assert.equal((app.match(/window\.carregarCarteira\s*=/g) || []).length, 1,
  'só a geração final pode definir window.carregarCarteira');
// - o Arquivar continua vivo;
assert.match(app, /window\.arquivarLead = function\(id, nome\)\{/, 'Arquivar continua vivo');
// - a ressincronização do show() (sem ela, show("home") interno pularia o polimento/sininho —
//   era feita por acaso pelos blocos mortos removidos).
assert.match(app, /try\{ show = window\.show; \}catch\(_\)\{ \}/,
  'o resync do show() precisa existir depois do embrulho de polimento');

console.log('v1073-faxina-geracoes-mortas: ok');
