import assert from 'node:assert/strict';
import fs from 'node:fs';
import { finalizarAnaliseComercialV674 } from './api/_pipeline.js';

const timeline = [
  {author:'Sanchai',text:'Certo, agradecemos a oportunidade e ficamos às ordens para novas negociações. Abraço',date:'01/07/2026',time:'18:09',source:'txt',type:'text'},
  {author:'Anderson Ruviaro Corretor SM Gabro',text:'Muito obrigado',date:'01/07/2026',time:'18:58',source:'txt',type:'text'},
  {author:'Anderson Ruviaro Corretor SM Gabro',text:'Um abraço',date:'01/07/2026',time:'18:59',source:'txt',type:'text'}
];

const anterior = {
  summary:'Negociação em andamento.',
  nextAction:'Mandar uma nova mensagem ao Anderson.',
  tipoContato:'corretor-parceiro',
  messages:{a:'Anderson, obrigado pela parceria. Me chama se surgir outro cliente.',b:'Mensagem antiga B',c:'Mensagem antiga C',recomendada:'a'},
  confirmedAppointments:[{oQue:'retorno',data:'2026-07-04',combinadoPor:'cliente',trechoLiteral:'Anderson ficou de dar retorno'}],
  diagnostico:{etapa:'negociacao',ultimoCompromissoCliente:'Anderson ficou de informar o cliente final e dar retorno.',mensagemQueEuEnviariaHoje:'Mensagem antiga'},
  modeloComercial:{
    versao:672,
    contato:{tipo:'corretor-parceiro'},
    oportunidade:{status:'negociacao',resultado:'em-andamento',produto:'Residencial GABRO',motivo:'O cliente final não conseguiu encaixar e acabou comprando outro imóvel.'},
    relacionamento:{status:'ativo'},
    acao:{status:'aguardando-resposta',responsavel:'contato',urgencia:'baixa',descricao:'Aguardar resposta'},
    contexto:{ultimoCompromisso:'Anderson ficou de dar retorno.'}
  }
};

const out = finalizarAnaliseComercialV674(structuredClone(anterior), {name:'Anderson Ruviaro Corretor SM Gabro',product:'Residencial GABRO'}, timeline, 'Sanchai');
assert.equal(out._schemaComercial,674);
assert.equal(out.modeloComercial.versao,674);
assert.equal(out.modeloComercial.oportunidade.status,'perdida');
assert.equal(out.modeloComercial.oportunidade.resultado,'comprou-outra-opcao');
assert.equal(out.modeloComercial.relacionamento.status,'aguardando-nova-oportunidade');
assert.equal(out.modeloComercial.acao.status,'sem-acao-urgente');
assert.equal(out.modeloComercial.contexto.ultimaPessoaFalar,'contato');
assert.match(out.modeloComercial.contexto.ultimoCompromisso,/não há retorno pendente/i);
assert.deepEqual(out.confirmedAppointments,[]);
assert.equal(out.messages.a,'');
assert.equal(out.messages.b,'');
assert.equal(out.messages.c,'');
assert.equal(out.diagnostico.mensagemQueEuEnviariaHoje,'');
assert.match(out.nextAction,/nenhuma ação urgente/i);

const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('./api/reanalisar-lead.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('./styles.css',import.meta.url),'utf8');
assert.match(app,/schema<674/);
assert.match(app,/_leadDetailCache\.set\(String\(lead\.id\)/);
assert.match(app,/const detalheAberto=!!state\.lead\?\.id/);
assert.doesNotMatch(app,/getLeadDetail\(lead\.id,true\)/);
assert.match(api,/Nunca informa sucesso sem ter gravado/);
assert.match(api,/finalizarAnaliseComercialV674\(merged/);
assert.match(api,/schemaComercial: 674/);
assert.match(css,/body\.lead-foco-aberto #home #resumoDia/);
assert.match(css,/body\.lead-foco-aberto #home #homeRight/);

const pkg=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'674.0.0');
const sw=fs.readFileSync(new URL('./service-worker.js',import.meta.url),'utf8');
assert.match(sw,/corretor-pro-static-v674-/);
console.log('teste-analise-comercial-v674: OK');
