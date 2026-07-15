import assert from 'node:assert/strict';
import { temEvidenciaNegociacao, ajustarEtapaNegociacao } from '../api/_pipeline.js';

// §6.4 — Caso Maria Clarisse: pediu informações, recebeu detalhes e não respondeu.
// A IA pode sugerir "Negociação", mas sem evidência concreta a etapa não pode subir.
const clarisse = [
  { author: 'Maria Clarisse', text: 'Oi, tenho interesse no Renaissance. Pode me mandar informações?' },
  { author: 'Construtora Senger', text: 'Claro! Segue a apresentação do empreendimento com as plantas.' }
];
assert.equal(temEvidenciaNegociacao(clarisse), false, 'pedir informação e receber apresentação não é negociação');
assert.equal(ajustarEtapaNegociacao('Negociação', clarisse), 'Visita/Proposta', 'houve apresentação/planta → no máximo Visita/Proposta');

// Só pediu informação, sem nem apresentação/visita → cai para Atendimento.
const soPergunta = [
  { author: 'João', text: 'Bom dia, vocês têm apartamento de 2 dormitórios?' },
  { author: 'Construtora Senger', text: 'Temos sim, posso te explicar as opções?' }
];
assert.equal(ajustarEtapaNegociacao('Negociando', soPergunta), 'Atendimento');

// Uma visita, por si só, não é negociação (plano §6.3).
const soVisita = [
  { author: 'Construtora Senger', text: 'Combinamos a visita ao decorado para sábado.' },
  { author: 'Ana', text: 'Perfeito, estarei lá!' }
];
assert.equal(temEvidenciaNegociacao(soVisita), false, 'visita sozinha não é negociação');
assert.equal(ajustarEtapaNegociacao('Negociação', soVisita), 'Visita/Proposta');

// Evidência REAL de negociação → a etapa "Negociação" é mantida.
const casosComEvidencia = [
  [{ author: 'Construtora Senger', text: 'Enviei a proposta com o valor final.' }, { author: 'Cliente', text: 'Recebi.' }],
  [{ author: 'Cliente', text: 'Consegue um desconto no valor?' }],
  [{ author: 'Cliente', text: 'Qual seria a entrada e em quantas parcelas?' }],
  [{ author: 'Cliente', text: 'Quero fazer a reserva da unidade 302.' }],
  [{ author: 'Construtora Senger', text: 'Podemos ajustar a condição de pagamento para caber no seu orçamento.' }],
  [{ author: 'Cliente', text: 'Fiz a simulação do financiamento pela Caixa.' }]
];
for (const tl of casosComEvidencia) {
  assert.equal(temEvidenciaNegociacao(tl), true, 'deveria detectar evidência: ' + JSON.stringify(tl));
  assert.equal(ajustarEtapaNegociacao('Negociação', tl), 'Negociação', 'com evidência real a etapa se mantém');
}

// A guarda só age sobre "Negociação"; não rebaixa outras etapas.
assert.equal(ajustarEtapaNegociacao('Visita/Proposta', clarisse), 'Visita/Proposta');
assert.equal(ajustarEtapaNegociacao('Atendimento', clarisse), 'Atendimento');
assert.equal(ajustarEtapaNegociacao('Não identificado', clarisse), 'Não identificado');

console.log('v826-negociando-guard: ok');
