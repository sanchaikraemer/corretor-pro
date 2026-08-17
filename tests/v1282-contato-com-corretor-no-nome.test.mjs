// v1282 — CONTATO SALVO COM "CORRETOR"/"IMOBILIÁRIA" NO NOME NÃO PODE VIRAR O LADO DA EMPRESA.
//
// Achado da auditoria de 16/08/2026, reproduzido rodando as funções de verdade: com o MESMO texto
// de conversa, mudando só como o contato está salvo no celular, o app entregava:
//   "Anderson Ruviaro"   → cliente "Anderson Ruviaro", 2 tentativas sem resposta   (certo)
//   "Anderson Corretor"  → cliente "Cliente não identificado", 3 tentativas         (errado)
//   "Imobiliária Central"→ cliente "Cliente não identificado", 3 tentativas         (errado)
//
// A terceira "tentativa" era a fala DO PRÓPRIO CLIENTE, que ia pro pedido enviado à IA rotulada
// como "isto o cliente já recebeu e não respondeu — nenhuma das três pode ser isto de novo".
// Ou seja: a IA ficava proibida de tratar exatamente o que o cliente pediu. E as mensagens dele
// ainda entravam no bloco "COMO ESTE CORRETOR ESCREVE" como régua de voz do corretor.
//
// Este teste falha de propósito se a prova do nome do arquivo exportado voltar a perder pra lista
// de palavras de função. O corretor PARCEIRO é um tipo de contato que o sistema atende de
// propósito, com regra própria no prompt — ele não pode ser confundido com o dono da conta.

import assert from "node:assert/strict";
import { guessLeadData, tentativasSemRespostaDoCorretor } from "../api/_pipeline.js";

const conversa = (autorContato) => ([
  { date: "01/08/2026", time: "09:00", author: "Sanchai", text: "Bom dia! Tenho uma unidade que encaixa no perfil do seu cliente.", type: "text" },
  { date: "01/08/2026", time: "09:12", author: autorContato, text: "Bom dia! Meu cliente quer 3 dormitórios, até 700 mil.", type: "text" },
  { date: "02/08/2026", time: "10:00", author: "Sanchai", text: "Posso seguir com a apresentação do empreendimento?", type: "text" },
  { date: "03/08/2026", time: "11:00", author: "Sanchai", text: "Consigo te mandar a apresentação hoje ainda?", type: "text" }
]);

const CASOS = ["Anderson Ruviaro", "Anderson Corretor", "Imobiliária Central", "Construtora Boa Vista", "Plantão Centro"];

for (const autor of CASOS) {
  const timeline = conversa(autor);
  const arquivo = `Conversa do WhatsApp com ${autor}.txt`;
  const lead = guessLeadData(timeline, "Sanchai", arquivo);

  assert.equal(lead.clientName, autor,
    `o contato "${autor}" tem que virar o nome do cliente (o nome do arquivo exportado é prova de quem é o contato), e veio "${lead.clientName}"`);

  const semResposta = tentativasSemRespostaDoCorretor(timeline, "Sanchai", lead);
  assert.equal(semResposta.tentativas, 2,
    `com o contato "${autor}", só as DUAS mensagens finais do corretor ficaram sem resposta — vieram ${semResposta.tentativas}`);
  assert.ok(!semResposta.textos.some(t => /Meu cliente quer 3 dormit/i.test(t)),
    `a fala do próprio cliente ("Meu cliente quer 3 dormitórios") não pode entrar na lista do que o CORRETOR tentou sem resposta — contato "${autor}"`);
}

// A guarda que a correção não pode derrubar: o rótulo do PRÓPRIO corretor continua sendo o lado da
// empresa, mesmo que o nome do arquivo aponte pra ele (conversa exportada de um jeito estranho, ou
// nome do Cérebro igual ao do arquivo). Aqui o único outro autor é o cliente de verdade.
const timelineDona = [
  { date: "01/08/2026", time: "09:00", author: "Construtora Senger", text: "Bom dia! Segue o material.", type: "text" },
  { date: "01/08/2026", time: "09:10", author: "Marcos Pereira", text: "Recebi, obrigado! Vou olhar hoje.", type: "text" }
];
const leadDona = guessLeadData(timelineDona, "Construtora Senger", "Conversa do WhatsApp com Construtora Senger.txt");
assert.equal(leadDona.clientName, "Marcos Pereira",
  "o rótulo do próprio corretor (nome configurado no Cérebro) nunca pode virar o cliente, nem quando o nome do arquivo aponta pra ele");

// Sem prova nenhuma no nome do arquivo e com dois candidatos, o app continua NÃO escolhendo (v1180).
const leadSemProva = guessLeadData([
  { date: "01/08/2026", time: "09:00", author: "Sanchai", text: "Bom dia!", type: "text" },
  { date: "01/08/2026", time: "09:05", author: "Marcos", text: "Oi!", type: "text" },
  { date: "01/08/2026", time: "09:06", author: "Juliana", text: "Bom dia!", type: "text" }
], "Sanchai", "leads.txt");
assert.equal(leadSemProva.clientName, "Cliente não identificado",
  "sem prova de quem é o contato exportado e com 2+ candidatos, o app não pode escolher (regra da v1180)");

console.log("v1282-contato-com-corretor-no-nome: ok (5 nomes de contato + guarda do corretor + regra da v1180)");
