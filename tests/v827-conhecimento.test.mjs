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

// §7.3 — Preço inventado (não presente na conversa) é bloqueado; mensagens de retomada
// que citam tempo ("faz 2 meses") continuam válidas (não bloqueamos anos/meses).
const precoInventado = validarMensagensCerebro(trio('Boa noite, Vera, consigo por R$ 450.000, quer garantir?'), null, tl, {}, noite);
assert.equal(precoInventado.ok, false);
assert.ok(precoInventado.motivos.some(m => /ausente/.test(m)), 'preço inventado deve ser bloqueado');

const retomadaComTempo = validarMensagensCerebro(trio('Boa noite, Vera, faz uns 2 meses que não conversamos, quer retomar?'), null, tl, {}, noite);
assert.ok(!retomadaComTempo.motivos.some(m => /ausente/.test(m)), 'retomada citando tempo não pode ser bloqueada como dado inventado');

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
