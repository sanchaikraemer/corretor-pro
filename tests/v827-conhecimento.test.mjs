import fs from 'node:fs';
import assert from 'node:assert/strict';
import { validarMensagensCerebro } from '../api/_pipeline.js';

const noite = new Date('2026-07-15T00:16:00Z');
const tl = [
  { author: 'Construtora', date: '14/07/2026', time: '10:00', text: 'O empreendimento fica no centro, ótima localização.' },
  { author: 'Vera', date: '14/07/2026', time: '10:05', text: 'Gostei. Qual o próximo passo?' }
];
const trio = extra => ({
  a: extra,
  b: 'Boa noite, Vera, prefere ver a planta primeiro?',
  c: 'Boa noite, Vera, posso te enviar mais detalhes?'
});

// §7.3 — Prazo/ano NÃO confirmado na conversa não pode ser afirmado como certeza.
const anoInventado = validarMensagensCerebro(trio('Boa noite, Vera, quer garantir sua unidade com entrega em 2028?'), null, tl, {}, noite);
assert.equal(anoInventado.ok, false);
assert.ok(anoInventado.motivos.some(m => /ausente/.test(m)), 'ano de entrega inventado deve ser bloqueado');

const prazoInventado = validarMensagensCerebro(trio('Boa noite, Vera, a entrega é em 3 anos, quer aproveitar?'), null, tl, {}, noite);
assert.equal(prazoInventado.ok, false, 'prazo em anos inventado deve ser bloqueado');

// Quando o prazo ESTÁ na conversa, pode ser usado.
const tlComAno = [...tl, { author: 'Vera', text: 'Soube que a entrega é em 2028, confere?' }];
const anoOk = validarMensagensCerebro(trio('Boa noite, Vera, isso mesmo, quer garantir agora?'), null, tlComAno, {}, noite);
assert.ok(!anoOk.motivos.some(m => /ausente/.test(m)), 'ano presente na conversa é permitido');

// §7.3 — Regra manual do Cérebro vence conhecimento aprendido: uma expressão proibida
// (mesmo que o histórico "ensine" a usá-la) é barrada na validação final.
const cerebro = { regras: [{ texto: 'Não use "faz sentido" nas mensagens.' }] };
const proibidaDoHistorico = validarMensagensCerebro(trio('Boa noite, Vera, faz sentido conversarmos hoje?'), null, tl, cerebro, noite);
assert.equal(proibidaDoHistorico.ok, false);
assert.ok(proibidaDoHistorico.motivos.some(m => /proibida/.test(m)), 'regra do Cérebro vence o histórico');

// §7.3 — A origem do aprendizado é guardada (procedência auditável).
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
assert.match(pipeline, /intel\.origem = \{ leadId:[\s\S]*?arquivo:[\s\S]*?produto:/, 'aprenderComHistoricoReal registra a origem');
assert.match(pipeline, /const origem = \(intel\.origem[\s\S]*?\? intel\.origem : null/, 'registrarInteligenciaAprendida lê a origem');
assert.match(pipeline, /\{ quando: agora, origem,/, 'itens aprendidos guardam a origem');

console.log('v827-conhecimento: ok');
