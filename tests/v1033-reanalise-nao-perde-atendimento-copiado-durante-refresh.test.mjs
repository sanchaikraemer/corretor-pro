import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1033 — o dono relatou: copiou a 1ª mensagem sugerida de um lead recém-reanalisado e não
// marcou atendimento (a 2ª cópia, alguns segundos depois, funcionou normal). Causa: depois de
// "Reanalisar" terminar, ui670Reanalisar agenda um refresh de fundo (setTimeout de 600ms) que
// troca state.lead e as 3 listas (itemsAtivos/todosLeads/leads) por dados frescos do servidor —
// SEM checar se, nesse meio tempo, uma cópia de mensagem (que marca atendido na hora, só na
// tela) já tinha acontecido. Se a marcação do servidor ainda não tiver alcançado esse refresh
// (é gravada por uma chamada separada, em paralelo), a marcação local se perdia inteira, sem
// nenhum aviso.

const reanIni = app.indexOf('window.ui670Reanalisar=async function(btn){');
assert.ok(reanIni > -1, 'ui670Reanalisar não encontrada em app.js');
const reanFim = app.indexOf('\n};', reanIni);
const reanFn = app.slice(reanIni, reanFim);

const stIni = reanFn.indexOf('setTimeout(async()=>{');
assert.ok(stIni > -1, 'refresh de fundo (setTimeout) não encontrado dentro de ui670Reanalisar');
const stFim = reanFn.indexOf('\n    },600);', stIni);
assert.ok(stFim > -1, 'fechamento do refresh de fundo (",600);") não encontrado');
const corpo = reanFn.slice(stIni + 'setTimeout(async()=>{'.length, stFim);

assert.match(corpo, /eventoAntes/, 'refresh de fundo precisa guardar o atendimento já conhecido antes de buscar dados frescos');

const iniciarAplicar = app.match(/function ui667AplicarAtendidoLocal\([\s\S]*?\n\}/);
assert.ok(iniciarAplicar, 'ui667AplicarAtendidoLocal não encontrada por inteiro');

function montarCallback({ state, lead, atualizado, itensFrescos }){
  const getLeadsData = async () => ({ ok: true, items: itensFrescos });
  const limparLead = (l) => l;
  const normalizarEtapa = (e) => e || "";
  const COMMERCIAL_SCHEMA_VERSION = 700;
  const fabricar = new Function('qs','escapeHtml','window', `
    ${iniciarAplicar[0]}
    return { ui667AplicarAtendidoLocal };
  `)(() => null, (v) => String(v), {});
  const rodar = new Function(
    'state','lead','atualizado','getLeadsData','limparLead','normalizarEtapa','COMMERCIAL_SCHEMA_VERSION','ui667AplicarAtendidoLocal',
    `return (async () => { ${corpo} })();`
  );
  return rodar(state, lead, atualizado, getLeadsData, limparLead, normalizarEtapa, COMMERCIAL_SCHEMA_VERSION, fabricar.ui667AplicarAtendidoLocal);
}

// ===================== Cenário 1: cópia marcou atendido, servidor ainda não pegou =====================
{
  const quando = "2026-07-27T20:43:00.000Z";
  const leadMarcado = () => ({
    id: "L1", etapa: "Negociando",
    lastAttendanceAt: quando, ultimoAtendimentoEm: quando, lastAttendanceText: "27/07/2026 17:43",
    analysis: { aprendizado: { eventos: [ { evento: "contato_manual", estilo: null, detalhes: { tipo: "Atendido", de: "mensagem_enviada" }, quando } ] } }
  });
  const state = {
    lead: leadMarcado(),
    itemsAtivos: [ leadMarcado() ], todosLeads: [ leadMarcado() ], leads: [ leadMarcado() ]
  };
  const lead = { id: "L1" }; // referência original (pré-reanálise), só o id importa aqui
  const atualizado = { id: "L1", etapa: "Negociando", analysis: { _schemaComercial: 700, aprendizado: {} } };
  // Servidor "atrasado": item fresco SEM nenhuma marcação de atendimento ainda.
  const itensFrescos = [ { id: "L1", etapa: "Negociando", analysis: { _schemaComercial: 700, aprendizado: {} } } ];

  await montarCallback({ state, lead, atualizado, itensFrescos });

  assert.equal(state.lead.lastAttendanceAt, quando,
    'state.lead não pode perder a marcação de atendido quando o servidor ainda está desatualizado');
  for(const nomeLista of ['itemsAtivos','todosLeads','leads']){
    const item = state[nomeLista].find(x => x.id === "L1");
    assert.ok(item, `lead precisa continuar em ${nomeLista} depois do refresh`);
    assert.equal(item.lastAttendanceAt, quando, `${nomeLista} não pode perder a marcação de atendido depois do refresh de fundo`);
  }
  console.log('v1033 (cenário 1): cópia marcada localmente sobrevive ao refresh de fundo da reanálise — ok');
}

// ===================== Cenário 2: servidor já tem atendimento MAIS NOVO — não pode regredir =====================
{
  const quandoLocalAntigo = "2026-07-27T20:40:00.000Z";
  const quandoServidorNovo = "2026-07-27T20:45:00.000Z";
  const state = {
    lead: {
      id: "L2",
      lastAttendanceAt: quandoLocalAntigo, ultimoAtendimentoEm: quandoLocalAntigo, lastAttendanceText: "27/07/2026 17:40",
      analysis: { aprendizado: { eventos: [ { evento: "contato_manual", estilo: null, detalhes: { tipo: "Atendido", de: "mensagem_enviada" }, quando: quandoLocalAntigo } ] } }
    },
    itemsAtivos: [], todosLeads: [], leads: []
  };
  const lead = { id: "L2" };
  const atualizado = { id: "L2", analysis: { _schemaComercial: 700, aprendizado: {} } };
  const itensFrescos = [ { id: "L2", analysis: { _schemaComercial: 700, aprendizado: {} }, lastAttendanceAt: quandoServidorNovo, ultimoAtendimentoEm: quandoServidorNovo, lastAttendanceText: "27/07/2026 17:45" } ];

  await montarCallback({ state, lead, atualizado, itensFrescos });

  assert.equal(state.lead.lastAttendanceAt, quandoServidorNovo,
    'um atendimento mais novo já confirmado pelo servidor não pode ser trocado de volta pelo mais antigo guardado localmente');
  console.log('v1033 (cenário 2): atendimento mais novo do servidor não regride — ok');
}

console.log('v1033-reanalise-nao-perde-atendimento-copiado-durante-refresh: ok');
