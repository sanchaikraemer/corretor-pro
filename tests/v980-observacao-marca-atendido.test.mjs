import fs from 'node:fs';
import assert from 'node:assert/strict';

// v980 — pedido do dono: salvar uma observação no lead precisa marcar ele como atendido,
// igual já acontece ao clicar "Marcar atendimento" ou copiar uma mensagem sugerida
// (api/reanalisar-lead.js, evento contato_manual). Antes desta versão, observação só entrava
// na timeline/memória — não gerava o evento que app.js usa pra saber "atendi esse hoje".

// ---------- backend: acaoObservacaoAdicionar grava o evento contato_manual ----------
const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
const inicioObs = leadUpdate.indexOf('async function acaoObservacaoAdicionar');
const fimObs = leadUpdate.indexOf('\nasync function ', inicioObs + 10);
const blocoObs = leadUpdate.slice(inicioObs, fimObs);
assert.match(blocoObs, /evento:\s*"contato_manual"/, 'salvar observação precisa gravar um evento contato_manual');
assert.match(blocoObs, /detalhes:\s*\{\s*tipo:\s*"Observação",\s*de:\s*"observacao_manual"\s*\}/,
  'o evento da observação precisa se identificar como tal (tipo/de), igual os outros gatilhos já fazem');
assert.match(blocoObs, /aprendizado,?\s*_atualizadoEm/, 'o objeto salvo no banco precisa incluir o aprendizado atualizado (com o evento novo)');
console.log('v980-backend-evento: ok');

// ---------- front-end: ui667AplicarAtendidoLocal aceita "detalhes" e cp7ObsSalvar usa ----------
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.match(app, /function ui667AplicarAtendidoLocal\(lead, quando, dataBR, horaBR, detalhes = \{tipo:"Atendido",de:"botao_atendido"\}\)/,
  'ui667AplicarAtendidoLocal precisa aceitar um "detalhes" customizável (com valor padrão pros usos antigos)');
assert.match(app, /tipo:"Observação",de:"observacao_manual"/, 'cp7ObsSalvar precisa marcar o evento local como vindo de observação');
assert.match(app, /ui667ReconciliarAtendimentoLocal\(lead\.id, \(item\) => ui667AplicarAtendidoLocal\(item, data\.item\.iso, data\.item\.date, data\.item\.time, detalhesObs\)\)/,
  'cp7ObsSalvar precisa propagar o atendimento local pras listas da Home (mesmo padrão do botão Atendido, ver v918)');

// ---------- funcional: uma observação de HOJE realmente conta como "atendido hoje" ----------
const inicioDia = app.match(/function inicioDoDiaBR\(\)\{[\s\S]*?\n\}/);
const ehHoje = app.match(/function ehAtendidoHoje\(l\)\{[\s\S]*?\n\}/);
const aplicar = app.match(/function ui667AplicarAtendidoLocal\(lead, quando, dataBR, horaBR, detalhes[^)]*\)\{[\s\S]*?\n\}/);
assert.ok(inicioDia && ehHoje && aplicar, 'não consegui extrair inicioDoDiaBR/ehAtendidoHoje/ui667AplicarAtendidoLocal de app.js');

const { ehAtendidoHojeSandbox, aplicarSandbox } = eval(`
  ${inicioDia[0]}
  ${ehHoje[0]}
  ${aplicar[0]}
  ({ ehAtendidoHojeSandbox: ehAtendidoHoje, aplicarSandbox: ui667AplicarAtendidoLocal })
`);

const lead = { id: 'simoni', name: 'Simoni Cardoso Corretora', analysis: {} };
assert.equal(ehAtendidoHojeSandbox(lead), false, 'lead recém-criado, sem nenhum evento, não pode aparecer como atendido hoje');

const agora = new Date();
const detalhesObs = { tipo: 'Observação', de: 'observacao_manual' };
aplicarSandbox(lead, agora.toISOString(), '24/07/2026', '13:54', detalhesObs);
assert.equal(ehAtendidoHojeSandbox(lead), true,
  'depois de salvar uma observação agora, o lead precisa contar como atendido hoje (era o bug relatado)');

console.log('v980-observacao-marca-atendido: ok');
