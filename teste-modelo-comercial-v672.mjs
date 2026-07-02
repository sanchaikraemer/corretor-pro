import assert from "node:assert/strict";
import fs from "node:fs";
import { __testarModeloComercialV672 } from "./api/_pipeline.js";

const isoDate = (delta=0) => {
  const d = new Date(); d.setDate(d.getDate()+delta);
  return new Intl.DateTimeFormat("en-CA", { timeZone:"America/Sao_Paulo", year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
};
const msg = (author,text,date="01/07/2026",time="10:00") => ({date,time,author,text,source:"txt",type:"text"});
const parsedBase = (over={}) => ({
  tipoContato:"comprador-direto", etapaSugerida:"Negociação", probabilityPercent:60,
  summary:"Negociação em andamento.", nextAction:"Responder agora",
  diagnostico:{etapa:"negociacao",ultimaPessoaFalar:"contato",proximoPassoDeQuem:"Do corretor",ultimoCompromissoCliente:"Nenhum compromisso assumido."},
  modeloComercial:{
    contato:{tipo:"comprador-direto"},
    oportunidade:{status:"negociacao",resultado:"em-andamento",produto:"Renaissance"},
    relacionamento:{status:"ativo"},
    acao:{status:"responder-agora",responsavel:"corretor",urgencia:"alta",descricao:"Responder agora"}
  },
  ...over
});

// 1. Parceiro perde uma oportunidade sem perder o relacionamento.
const anderson = __testarModeloComercialV672({
  parsed: parsedBase({
    tipoContato:"corretor-parceiro",
    summary:"O cliente final comprou outro imóvel e Anderson segue prospectando.",
    modeloComercial:{contato:{tipo:"corretor-parceiro"},oportunidade:{status:"negociacao",resultado:"em-andamento",produto:"Gabro"},relacionamento:{status:"ativo"},acao:{status:"responder-agora",responsavel:"corretor",urgencia:"alta",descricao:"Atender agora"}}
  }),
  lead:{name:"Anderson Ruviaro Corretor",product:"Gabro"},
  timeline:[msg("Sanchai","Ficamos às ordens para novas negociações."),msg("Anderson Ruviaro Corretor","O cliente comprou outro imóvel."),msg("Anderson Ruviaro Corretor","Muito obrigado","01/07/2026","10:02")]
});
assert.equal(anderson.modeloComercial.oportunidade.status,"perdida");
assert.equal(anderson.modeloComercial.relacionamento.status,"aguardando-nova-oportunidade");
assert.equal(anderson.modeloComercial.acao.status,"sem-acao-urgente");
assert.equal(anderson.modeloComercial.contexto.ultimaPessoaFalar,"contato");
assert.equal(anderson._schemaComercial,675);

// 2. “Muito obrigado” NÃO apaga retorno futuro confirmado.
const retornoFuturo = __testarModeloComercialV672({
  parsed: parsedBase({confirmedAppointments:[{oQue:"retorno",data:isoDate(2),combinadoPor:"cliente",trechoLiteral:"Vou analisar e te retorno na sexta"}]}),
  lead:{name:"Carlos",product:"Renaissance"},
  timeline:[msg("Carlos","Vou analisar e te retorno na sexta"),msg("Carlos","Muito obrigado","01/07/2026","10:01")]
});
assert.equal(retornoFuturo.modeloComercial.acao.status,"aguardando-resposta");
assert.equal(retornoFuturo.modeloComercial.acao.responsavel,"contato");
assert.match(retornoFuturo.modeloComercial.acao.descricao,/aguardar o retorno/i);

// 3. Mesmo sem appointment estruturado, compromisso literal recente é preservado.
const retornoLiteral = __testarModeloComercialV672({
  parsed: parsedBase(), lead:{name:"Maria",product:"Quality"},
  timeline:[msg("Maria","Vou analisar com meu marido e te retorno"),msg("Maria","Obrigada","01/07/2026","10:01")]
});
assert.equal(retornoLiteral.modeloComercial.acao.status,"aguardando-resposta");

// 4. Pergunta direta do contato prevalece sobre qualquer espera anterior.
const pergunta = __testarModeloComercialV672({
  parsed: parsedBase({confirmedAppointments:[{oQue:"retorno",data:isoDate(3),combinadoPor:"cliente",trechoLiteral:"te retorno sexta"}]}),
  lead:{name:"João",product:"Prime"},timeline:[msg("João","Te retorno sexta"),msg("João","Qual é o valor da entrada?","01/07/2026","10:02")]
});
assert.equal(pergunta.modeloComercial.acao.status,"responder-agora");
assert.equal(pergunta.modeloComercial.acao.responsavel,"corretor");

// 5. Despedida cordial sem pendência realmente encerra a ação.
const cordial = __testarModeloComercialV672({parsed:parsedBase(),lead:{name:"Ana"},timeline:[msg("Sanchai","Fico à disposição."),msg("Ana","Um abraço")]});
assert.equal(cordial.modeloComercial.acao.status,"sem-acao-urgente");

// 6. Corretor falou por último: aguarda o contato, não responde de novo.
const falouPorUltimo = __testarModeloComercialV672({parsed:parsedBase(),lead:{name:"Paulo"},timeline:[msg("Paulo","Pode mandar a proposta"),msg("Sanchai","Enviei a proposta para sua análise.","01/07/2026","10:01")]});
assert.equal(falouPorUltimo.modeloComercial.acao.status,"aguardando-resposta");

// 7. Visita futura é compromisso agendado.
const visita = __testarModeloComercialV672({
  parsed:parsedBase({confirmedAppointments:[{oQue:"visita",data:isoDate(1),combinadoPor:"cliente",trechoLiteral:"Amanhã às 10h vou visitar"}]}),
  lead:{name:"Noemi"},timeline:[msg("Noemi","Amanhã às 10h vou visitar")]
});
assert.equal(visita.modeloComercial.acao.status,"compromisso-agendado");

// 8. Compromisso vencido recentemente exige retomada.
const vencido = __testarModeloComercialV672({
  parsed:parsedBase({confirmedAppointments:[{oQue:"retorno",data:isoDate(-2),combinadoPor:"cliente",trechoLiteral:"te retorno terça"}]}),
  lead:{name:"Lucas"},timeline:[msg("Lucas","Te retorno terça")]
});
assert.equal(vencido.modeloComercial.acao.status,"retomar");
assert.equal(vencido.modeloComercial.acao.responsavel,"corretor");

// 9. Venda confirmada não permanece em negociação.
const venda = __testarModeloComercialV672({parsed:parsedBase(),lead:{name:"Isabela"},timeline:[msg("Isabela","Assinei o contrato e mandei o comprovante de pagamento")]});
assert.equal(venda.modeloComercial.oportunidade.status,"ganha");
assert.equal(venda.modeloComercial.oportunidade.resultado,"venda-conosco");

// 10. Nova oportunidade depois de perda mantém o novo negócio em andamento.
const nova = __testarModeloComercialV672({
  parsed:parsedBase({tipoContato:"corretor-parceiro",summary:"Novo comprador interessado no Renaissance.",modeloComercial:{contato:{tipo:"corretor-parceiro"},oportunidade:{id:"opp-teste",status:"interesse",resultado:"em-andamento",produto:"Renaissance",compradorFinal:"Cliente novo"},relacionamento:{status:"ativo"},acao:{status:"responder-agora",responsavel:"corretor",urgencia:"alta",descricao:"Responder disponibilidade."}}}),
  lead:{name:"Parceiro Corretor",product:"Renaissance"},timeline:[msg("Parceiro Corretor","O cliente anterior comprou outro imóvel."),msg("Parceiro Corretor","Agora estou com um cliente novo interessado no Renaissance. Tem disponibilidade?","01/07/2026","10:02")]
});
assert.equal(nova.modeloComercial.oportunidade.status,"interesse");
assert.equal(nova.modeloComercial.oportunidade.id,"opp-teste");
assert.equal(nova.modeloComercial.oportunidade.compradorFinal,"Cliente novo");
assert.equal(nova.modeloComercial.acao.status,"responder-agora");

// 11. Estrutura da oportunidade vinculada e listagem independente estão no pacote.
const app = fs.readFileSync(new URL("./app.js", import.meta.url),"utf8");
const api = fs.readFileSync(new URL("./api/lead-update.js", import.meta.url),"utf8");
const persistence = fs.readFileSync(new URL("./api/_persistence.js", import.meta.url),"utf8");
assert.match(app,/nova-oportunidade-parceiro/);
assert.match(app,/Comprador final/);
assert.match(app,/A negociação anterior continuará preservada/);
assert.match(api,/async function acaoNovaOportunidadeParceiro/);
assert.match(api,/oportunidadesVinculadas/);
assert.match(api,/_schemaComercial: 675/);
assert.match(persistence,/oportunidade:\$\{oportunidadeId\}/);

// Regressão #672: contato parceiro com "Corretor" no nome não pode virar "Você".
const parceiroNome = __testarModeloComercialV672({
  parsed: parsedBase(),
  lead:{name:"Anderson Ruviaro Corretor SM Gabro",clientName:"Anderson Ruviaro Corretor SM Gabro"},
  timeline:[
    msg("Sanchai","Certo, agradecemos e ficamos às ordens para novas negociações. Abraço"),
    msg("Anderson Ruviaro Corretor SM Gabro","Muito obrigado","01/07/2026","18:58"),
    msg("Anderson Ruviaro Corretor SM Gabro","Um abraço","01/07/2026","18:59")
  ]
});
assert.equal(parceiroNome.modeloComercial.contexto.ultimaPessoaFalar,"contato");
assert.equal(parceiroNome.modeloComercial.acao.status,"sem-acao-urgente");

// Regressão #672: "acabou comprando outro imóvel" encerra a oportunidade, mas mantém a parceria.
const comprandoOutro = __testarModeloComercialV672({
  parsed:{...parsedBase(),summary:"O cliente final não aceitou as condições e acabou comprando outro imóvel.",tipoContato:"corretor-parceiro"},
  lead:{name:"Anderson Ruviaro Corretor SM Gabro"},
  timeline:[msg("Sanchai","Ficamos às ordens para novas negociações."),msg("Anderson Ruviaro Corretor SM Gabro","Um abraço","01/07/2026","18:58")]
});
assert.equal(comprandoOutro.modeloComercial.oportunidade.status,"perdida");
assert.equal(comprandoOutro.modeloComercial.oportunidade.resultado,"comprou-outra-opcao");
assert.equal(comprandoOutro.modeloComercial.relacionamento.status,"aguardando-nova-oportunidade");
assert.equal(comprandoOutro.modeloComercial.acao.status,"sem-acao-urgente");

console.log("teste-modelo-comercial-v672: OK");
