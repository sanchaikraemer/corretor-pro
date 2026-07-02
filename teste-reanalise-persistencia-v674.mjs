import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const apiDir = path.resolve('./api');
const srcPath = path.join(apiDir,'reanalisar-lead.js');
let src = fs.readFileSync(srcPath,'utf8');
src = src.replace('import { getSupabaseAdmin } from "./_persistence.js";', 'const { getSupabaseAdmin } = globalThis.__v674Mocks;');
src = src.replace('import { analyzeWithBrain, getOpenAI, resumirAtendimento, atualizarConhecimentoCorretor, finalizarAnaliseComercialV674 } from "./_pipeline.js";', 'const { analyzeWithBrain, getOpenAI, resumirAtendimento, atualizarConhecimentoCorretor, finalizarAnaliseComercialV674 } = globalThis.__v674Mocks;');
const tmp = path.join(apiDir,`.tmp-reanalisar-v674-${Date.now()}.mjs`);
fs.writeFileSync(tmp,src);

const { finalizarAnaliseComercialV674 } = await import('./api/_pipeline.js');
const timeline = [
  {author:'Sanchai',text:'Certo, agradecemos a oportunidade e ficamos às ordens. Abraço',date:'01/07/2026',time:'18:09',source:'txt',type:'text',iso:'2026-07-01T21:09:00Z'},
  {author:'Anderson Ruviaro Corretor SM Gabro',text:'Muito obrigado',date:'01/07/2026',time:'18:58',source:'txt',type:'text',iso:'2026-07-01T21:58:00Z'},
  {author:'Anderson Ruviaro Corretor SM Gabro',text:'Um abraço',date:'01/07/2026',time:'18:59',source:'txt',type:'text',iso:'2026-07-01T21:59:00Z'}
];
let stored = {
  id:'lead-1', nome_arquivo:'Anderson Ruviaro Corretor SM Gabro', etapa:'Negociação', updated_at:'2026-07-01T22:00:00Z',
  timeline_json:timeline,
  resultado_analise:{
    clientName:'Anderson Ruviaro Corretor SM Gabro',tipoContato:'corretor-parceiro',summary:'Negociação em andamento.',nextAction:'Mandar nova mensagem.',
    lead:{clientName:'Anderson Ruviaro Corretor SM Gabro'},
    messages:{a:'Anderson, obrigado pela parceria. Me chama se aparecer outro cliente.',b:'Antiga B',c:'Antiga C',recomendada:'a'},
    confirmedAppointments:[{oQue:'retorno',data:'2026-07-04',combinadoPor:'cliente',trechoLiteral:'Anderson ficou de dar retorno'}],
    diagnostico:{etapa:'negociacao',ultimoCompromissoCliente:'Anderson ficou de informar o cliente e dar retorno.',mensagemQueEuEnviariaHoje:'Mensagem antiga'},
    modeloComercial:{versao:672,contato:{tipo:'corretor-parceiro'},oportunidade:{status:'negociacao',resultado:'em-andamento',produto:'Residencial GABRO',motivo:'O cliente final não conseguiu encaixar e acabou comprando outro imóvel.'},relacionamento:{status:'ativo'},acao:{status:'aguardando-resposta',responsavel:'contato',urgencia:'baixa',descricao:'Aguardar resposta'},contexto:{ultimoCompromisso:'Anderson ficou de dar retorno.'}},
    _schemaComercial:672
  }
};

function queryBuilder(){
  return {
    mode:'select', payload:null, filters:[],
    select(){
      if(this.mode==='update'){
        const expected=this.filters.find(x=>x[0]==='updated_at');
        if(expected && expected[1]!==stored.updated_at) return Promise.resolve({data:[],error:null});
        stored={...stored,...structuredClone(this.payload)};
        return Promise.resolve({data:[{id:stored.id}],error:null});
      }
      this.mode='select'; return this;
    },
    update(payload){this.mode='update';this.payload=payload;return this;},
    eq(k,v){this.filters.push([k,v]);return this;},
    maybeSingle(){return Promise.resolve({data:structuredClone(stored),error:null});},
    single(){return Promise.resolve({data:{resultado_analise:structuredClone(stored.resultado_analise),updated_at:stored.updated_at},error:null});}
  };
}
const supabase={from(){return queryBuilder();}};

globalThis.__v674Mocks={
  getSupabaseAdmin:()=>supabase,
  getOpenAI:()=>({}),
  analyzeWithBrain:async()=>({
    summary:'Negociação em andamento.',nextAction:'Enviar outra mensagem ao Anderson.',tipoContato:'corretor-parceiro',
    messages:{a:'Mensagem indevida nova',b:'Mensagem indevida B',c:'Mensagem indevida C',recomendada:'a'},
    diagnostico:{etapa:'negociacao',mensagemQueEuEnviariaHoje:'Mensagem indevida nova'},
    modeloComercial:{versao:672,contato:{tipo:'corretor-parceiro'},oportunidade:{status:'negociacao',resultado:'em-andamento',produto:'Residencial GABRO',motivo:'O cliente final acabou comprando outro imóvel.'},relacionamento:{status:'ativo'},acao:{status:'aguardando-resposta',responsavel:'contato',urgencia:'baixa',descricao:'Aguardar resposta'}}
  }),
  resumirAtendimento:async()=>'',
  atualizarConhecimentoCorretor:async()=>{},
  finalizarAnaliseComercialV674
};

const mod=await import(pathToFileURL(tmp).href+`?v=${Date.now()}`);
let statusCode=200,body='';
const res={status(n){statusCode=n;return this;},setHeader(){return this;},end(v){body=String(v||'');}};
await mod.default({method:'POST',body:{id:'lead-1',action:'atualizar-analise-comercial'}},res);
fs.unlinkSync(tmp);
delete globalThis.__v674Mocks;

assert.equal(statusCode,200,body);
const response=JSON.parse(body);
assert.equal(response.ok,true);
assert.equal(response.schemaComercial,674);
assert.equal(stored.resultado_analise._schemaComercial,674);
assert.equal(stored.resultado_analise.modeloComercial.oportunidade.status,'perdida');
assert.equal(stored.resultado_analise.modeloComercial.relacionamento.status,'aguardando-nova-oportunidade');
assert.equal(stored.resultado_analise.modeloComercial.acao.status,'sem-acao-urgente');
assert.equal(stored.resultado_analise.messages.a,'');
assert.deepEqual(stored.resultado_analise.confirmedAppointments,[]);
assert.match(stored.resultado_analise.modeloComercial.contexto.ultimoCompromisso,/não há retorno pendente/i);
assert.ok(stored.atualizado_em,'reanálise deve carimbar atualizado_em');
console.log('teste-reanalise-persistencia-v674: OK');
