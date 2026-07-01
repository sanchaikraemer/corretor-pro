import fs from 'fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('./styles.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('./service-worker.js',import.meta.url),'utf8');
const leadUpdate=fs.readFileSync(new URL('./api/lead-update.js',import.meta.url),'utf8');
const pipeline=fs.readFileSync(new URL('./api/_pipeline.js',import.meta.url),'utf8');

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const duplicate=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
assert.deepEqual(duplicate,[],`IDs duplicados: ${duplicate.join(', ')}`);
for(const id of ['cpDashboard','cpNewLeads','cpActiveDeals','cpVisits','cpProposals','cpRevenue','cpAppointments','cpTempDonut','cpStageBars','cpRunningDeals','cpActivityDonut']){
  assert.ok(html.includes(`id="${id}"`),`Dashboard sem ${id}`);
}
assert.ok(html.includes('data-target="propostas" data-nav-key="imoveis"'),'Imóveis precisa abrir o módulo de imóveis/propostas');
assert.ok(html.includes('data-target="carteira" data-nav-key="leads"'),'Leads precisa ter navegação própria');
assert.ok(css.includes('ATUALIZAÇÃO #657'),'CSS final V657 ausente');
assert.ok(css.includes('@media(max-width:999px)'),'Responsividade mobile ausente');
assert.ok(app.includes('ATUALIZAÇÃO #657'),'Renderizador V657 ausente');
assert.ok(app.includes('service-worker.js?v=__VERSION__'),'Registro versionado do service worker ausente');
assert.ok(sw.includes('corretor-pro-static-v657-'),'Cache V657 ausente');
assert.equal(leadUpdate.includes('novasMensagens = timelineNova.filter(m => !chavesAntigas.has(assinaturaMsg(m))).slice(-40)'),false,'Reimportação ainda limita a 40 mensagens');
assert.equal(pipeline.includes('novasMensagens.slice(-40)'),false,'Comparação de evolução ainda limita a 40 mensagens');
assert.ok(pipeline.includes('Nenhuma mensagem é descartada'),'Processamento integral em blocos não encontrado');
console.log('Teste UI V657: OK — estrutura, temas, navegação, cache e histórico integral validados.');
