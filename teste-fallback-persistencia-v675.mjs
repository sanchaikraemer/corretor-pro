import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const apiDir=path.resolve('./api');
const srcPath=path.join(apiDir,'lead-update.js');
let src=fs.readFileSync(srcPath,'utf8');
src=src.replace('import { getSupabaseAdmin, persistProcessingResult, listRecentProcessings } from "./_persistence.js";', 'const { getSupabaseAdmin, persistProcessingResult, listRecentProcessings } = globalThis.__v676Mocks;');
src=src.replace('import { randomUUID } from "node:crypto";', 'const randomUUID = ()=>"uuid-test";');
src=src.replace('import { compararEvolucao, getOpenAI, atualizarConhecimentoCorretor, modeloVisao, finalizarAnaliseComercialV674 } from "./_pipeline.js";', 'const { compararEvolucao, getOpenAI, atualizarConhecimentoCorretor, modeloVisao, finalizarAnaliseComercialV674 } = globalThis.__v676Mocks;');
const tmp=path.join(apiDir,`.tmp-lead-update-v676-${Date.now()}.mjs`);
fs.writeFileSync(tmp,src);

const { finalizarAnaliseComercialV674 } = await import('./api/_pipeline.js');
const timeline=[
  {author:'Sanchai',text:'Certo, agradecemos a oportunidade e ficamos às ordens. Abraço',iso:'2026-07-01T21:09:00Z',source:'txt',type:'text'},
  {author:'Anderson Ruviaro Corretor SM Gabro',text:'Muito obrigado',iso:'2026-07-01T21:58:00Z',source:'txt',type:'text'},
  {author:'Anderson Ruviaro Corretor SM Gabro',text:'Um abraço',iso:'2026-07-01T21:59:00Z',source:'txt',type:'text'}
];
let stored={
  id:'lead-1',nome_arquivo:'Anderson Ruviaro Corretor SM Gabro',arquivo_nome:'Anderson.txt',timeline_json:timeline,
  resultado_analise:{
    clientName:'Anderson Ruviaro Corretor SM Gabro',tipoContato:'corretor-parceiro',
    summary:'O cliente final acabou comprando outro imóvel.',nextAction:'Mandar nova mensagem.',
    lead:{clientName:'Anderson Ruviaro Corretor SM Gabro'},
    messages:{a:'Mensagem antiga indevida',b:'B',c:'C',recomendada:'a'},
    modeloComercial:{versao:672,contato:{tipo:'corretor-parceiro'},oportunidade:{status:'negociacao',resultado:'em-andamento',produto:'Residencial GABRO',motivo:'O cliente final acabou comprando outro imóvel.'},relacionamento:{status:'ativo'},acao:{status:'aguardando-resposta',responsavel:'contato',urgencia:'baixa',descricao:'Aguardar resposta'}},
    _schemaComercial:672
  }
};
function queryBuilder(){
  return {
    mode:'select',payload:null,
    select(){if(this.mode==='update'){stored={...stored,...structuredClone(this.payload)};return Promise.resolve({data:[{id:stored.id}],error:null});}return this;},
    update(payload){this.mode='update';this.payload=payload;return this;},
    eq(){return this;},
    maybeSingle(){return Promise.resolve({data:structuredClone(stored),error:null});}
  };
}
const supabase={from(){return queryBuilder();}};
globalThis.__v676Mocks={
  getSupabaseAdmin:()=>supabase,
  persistProcessingResult:async()=>({}),
  listRecentProcessings:async()=>({ok:true,items:[]}),
  compararEvolucao:async()=>({}),getOpenAI:()=>null,atualizarConhecimentoCorretor:async()=>{},modeloVisao:'',
  finalizarAnaliseComercialV674
};
const mod=await import(pathToFileURL(tmp).href+`?v=${Date.now()}`);
let statusCode=200,body='';
const res={status(n){statusCode=n;return this;},setHeader(){return this;},end(v){body=String(v||'');}};
await mod.default({method:'POST',body:{id:'lead-1',action:'analise-comercial-set',analysis:stored.resultado_analise}},res);
fs.unlinkSync(tmp);delete globalThis.__v676Mocks;

assert.equal(statusCode,200,body);
const response=JSON.parse(body);
assert.equal(response.ok,true);
assert.equal(response.schemaComercial,676);
assert.equal(stored.resultado_analise._schemaComercial,676);
assert.equal(stored.resultado_analise.modeloComercial.oportunidade.status,'perdida');
assert.equal(stored.resultado_analise.modeloComercial.oportunidade.resultado,'comprou-outra-opcao');
assert.equal(stored.resultado_analise.modeloComercial.relacionamento.status,'aguardando-nova-oportunidade');
assert.equal(stored.resultado_analise.modeloComercial.acao.status,'sem-acao-urgente');
assert.equal(stored.resultado_analise.messages.a,'');
assert.equal(stored.resultado_analise.lembrete,null);
console.log('teste-fallback-persistencia-v676: OK');
