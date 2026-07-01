import assert from 'node:assert/strict';
import fs from 'node:fs';
import { guessLeadData, __testarModeloComercialV672 } from './api/_pipeline.js';

const timeline = [
  {author:'Sanchai',text:'Certo, agradecemos a oportunidade e ficamos às ordens para novas negociações. Abraço',date:'01/07/2026',time:'18:09',source:'txt',type:'text'},
  {author:'Anderson Ruviaro Corretor SM Gabro',text:'Muito obrigado',date:'01/07/2026',time:'18:58',source:'txt',type:'text'},
  {author:'Anderson Ruviaro Corretor SM Gabro',text:'Um abraço',date:'01/07/2026',time:'18:59',source:'txt',type:'text'}
];

const lead = guessLeadData(timeline);
assert.equal(lead.clientName,'Anderson Ruviaro Corretor SM Gabro');
assert.equal(lead.lastInteraction.author,'Anderson Ruviaro Corretor SM Gabro');

const normalized = __testarModeloComercialV672({
  parsed:{
    summary:'O cliente final não aceitou as condições e acabou comprando outro imóvel.',
    nextAction:'Aguardar resposta',
    tipoContato:'corretor-parceiro',
    diagnostico:{etapa:'negociacao'},
    modeloComercial:{
      contato:{tipo:'corretor-parceiro'},
      oportunidade:{status:'negociacao',resultado:'em-andamento',produto:'Residencial Gabro'},
      relacionamento:{status:'ativo'},
      acao:{status:'aguardando-resposta',responsavel:'contato',urgencia:'baixa',descricao:'Aguardar resposta'}
    }
  },
  lead:{name:'Anderson Ruviaro Corretor SM Gabro'},
  timeline,
  corretorNome:'Sanchai'
});
assert.equal(normalized.modeloComercial.contexto.ultimaPessoaFalar,'contato');
assert.equal(normalized.modeloComercial.oportunidade.status,'perdida');
assert.equal(normalized.modeloComercial.relacionamento.status,'aguardando-nova-oportunidade');
assert.equal(normalized.modeloComercial.acao.status,'sem-acao-urgente');
assert.equal(normalized._schemaComercial,672);

const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
assert.match(app,/const BUSINESS_RE = \/\(senger\|construtora\|direciona\|atendimento\|sanchai\|miguel\\s\+kirinus\)\/i/);
assert.doesNotMatch(app,/const BUSINESS_RE = .*corretor/);
assert.match(app,/Mensagem temporariamente oculta/);
assert.match(app,/As informações antigas não serão usadas como orientação ativa/);
assert.doesNotMatch(app,/<button onclick="ui670Reanalisar\(\)">Reanalisar<\/button>/);

console.log('teste-autores-interface-v672: OK');
