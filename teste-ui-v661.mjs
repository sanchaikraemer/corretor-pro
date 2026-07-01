import fs from 'fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('./styles.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('./service-worker.js',import.meta.url),'utf8');
const leadUpdate=fs.readFileSync(new URL('./api/lead-update.js',import.meta.url),'utf8');
const pipeline=fs.readFileSync(new URL('./api/_pipeline.js',import.meta.url),'utf8');
const restore=fs.readFileSync(new URL('./api/restaurar-leads.js',import.meta.url),'utf8');
const importer=fs.readFileSync(new URL('./api/importar-base-leads.js',import.meta.url),'utf8');

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const duplicate=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
assert.deepEqual(duplicate,[],`IDs duplicados: ${duplicate.join(', ')}`);
for(const id of ['cpDashboard','cpNewLeads','cpActiveDeals','cpVisits','cpProposals','cpRevenue','cpAppointments','cpTempDonut','cpStageBars','cpRunningDeals','cpActivityDonut']){
  assert.ok(html.includes(`id="${id}"`),`Dashboard sem ${id}`);
}
assert.ok(html.includes('data-target="propostas" data-nav-key="imoveis"'),'Imóveis precisa abrir o módulo de imóveis/propostas');
assert.ok(html.includes('data-target="carteira" data-nav-key="leads"'),'Leads precisa ter navegação própria');
assert.ok(css.includes('@media(max-width:999px)'),'Responsividade mobile ausente');
assert.ok(app.includes('ATUALIZAÇÃO #661'),'Renderizador V661 ausente');
assert.ok(app.includes('service-worker.js?v=__VERSION__'),'Registro versionado do service worker ausente');
assert.ok(sw.includes('corretor-pro-static-v661-'),'Cache V661 ausente');

for(const asset of ['logo-cp.png']){
  assert.ok(fs.existsSync(new URL('./'+asset,import.meta.url)),`Asset ausente: ${asset}`);
}
assert.equal(/Importar leads do CRM|exportado do seu CRM|Anotação do CRM/.test(html+app),false,'Termo CRM ainda aparece na interface');
assert.ok(html.includes('<span class="sb-ver-top">Atualização #__VERSION__</span>'),'Versão do desktop não está visível no topo');
assert.ok(html.includes('class="cp-mobile-version">Atualização #__VERSION__</small>'),'Versão mobile não está visível no topo');

assert.equal(leadUpdate.includes('slice(-40)'),false,'Reimportação ainda limita a 40 mensagens');
assert.equal(pipeline.includes('novasMensagens.slice(-40)'),false,'Comparação de evolução ainda limita a 40 mensagens');
assert.ok(pipeline.includes('Nenhuma mensagem é descartada'),'Processamento integral em blocos não encontrado');

assert.ok(html.includes('id="baseImportBtn"'),'Botão da base consolidada ausente');
assert.ok(html.includes('id="baseImportStatus"'),'Status da base consolidada ausente');
assert.ok(app.includes('garantirImportacaoBaseV661'),'Importação automática da base não está ligada à inicialização');
assert.ok(app.includes('await garantirImportacaoBaseV661();'),'Inicialização não aguarda a importação consolidada');
assert.equal(app.includes('await garantirRestauracaoLeadsAntigos();'),false,'Restauração genérica antiga ainda roda automaticamente');
assert.ok(importer.includes('lostExcluded'),'Importador não informa perdidos excluídos');
assert.ok(importer.includes('duplicatesMergedBeforeImport'),'Importador não informa duplicados mesclados');
assert.ok(restore.includes('normalized?.payload?.etapa === "Perdido"'),'Restauração de segurança ainda aceita perdidos');

console.log('Teste UI V661: OK — interface, versão, cache e importação consolidada sem perdidos/duplicados validados.');
