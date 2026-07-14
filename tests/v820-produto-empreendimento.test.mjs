import assert from 'node:assert/strict';
import { empreendimentoDaConversa } from '../api/_pipeline.js';

// v820: quando a IA deixa o produto em branco, o empreendimento citado na conversa
// deve ser extraído do catálogo (nomes reais). Teste COMPORTAMENTAL: roda a função de
// verdade com o caso da Lorena.
const nomes = ['Boulevard Residence', 'Renaissance', 'Personalité', 'Premium Office'];

// Caso Lorena: a conversa cita claramente "Boulevard Residence".
const conversaLorena = 'Lorena: tenho interesse em dois apartamentos no Boulevard Residence, um pra morar e outro pra investir.';
assert.equal(empreendimentoDaConversa(conversaLorena, nomes), 'Boulevard Residence',
  'deveria detectar Boulevard Residence na conversa da Lorena');

// Caso Andre: cita Renaissance.
assert.equal(empreendimentoDaConversa('Andre: quero saber do Renaissance pra morar.', nomes), 'Renaissance',
  'deveria detectar Renaissance');

// Nome mais longo vence: "Boulevard Residence" antes de "Boulevard" isolado.
assert.equal(empreendimentoDaConversa('gostei do boulevard residence', ['Boulevard', 'Boulevard Residence']), 'Boulevard Residence',
  'deveria preferir o nome mais específico');

// Sem empreendimento citado: não inventa.
assert.equal(empreendimentoDaConversa('cliente quer um apartamento de 2 dormitorios', nomes), '',
  'não pode inventar produto quando nenhum empreendimento é citado');

// Entradas inválidas não quebram.
assert.equal(empreendimentoDaConversa('', nomes), '');
assert.equal(empreendimentoDaConversa('qualquer texto', null), '');

console.log('v820-produto-empreendimento: ok');
