import fs from 'node:fs';
import assert from 'node:assert/strict';
import { finalizarAnaliseDaConversa, REGRAS_MENSAGENS_VERSAO, ARQUITETURA_MENSAGENS_ATUAL } from '../api/_pipeline.js';

// v1220 — "continua sugerindo opções novas mesmo sem eu ter mencionado isso, mesmo na nova
// atualização" (dono, 11/08/2026, 18h33).
//
// A regra da v1219 estava no ar, mas as três mensagens do print eram IDÊNTICAS, palavra por
// palavra, às de 40 minutos antes — o que nenhuma geração nova produz. Não eram novas: a
// reimportação sem novidade REAPROVEITA a análise já salva (economia da v1141), e aquela análise
// tinha nascido sob as regras antigas. Duas coisas erradas de uma vez:
//
//   (a) mudar a regra não alcançava nada do que já estava guardado; e
//   (b) o cadastro ainda carimbava "Última análise — agora", escondendo que o texto era velho.

const MSGS = [
  { date: '2026-07-01', time: '09:10', author: 'Cliente', text: 'bom dia, ainda tem unidade?', iso: '2026-07-01T09:10:00.000Z', order: 1 },
  { date: '2026-07-01', time: '09:14', author: 'Corretor', text: 'bom dia! tenho sim', iso: '2026-07-01T09:14:00.000Z', order: 2 }
];
const salvaBase = {
  summary: 'Cliente perguntou por unidade disponível.',
  arquiteturaMensagens: ARQUITETURA_MENSAGENS_ATUAL,
  messages: {
    a: 'Oi! Passando pra confirmar se ainda faz sentido olharmos as opções que te mandei.',
    b: 'Oi, tudo bem? Fico à disposição se quiser retomar a conversa.',
    c: 'Consegue me dizer hoje se seguimos?',
    aLabel: 'Recomendada', bLabel: 'Mais suave', cLabel: 'Mais direta', recomendada: 'a'
  }
};
const reimportar = (previousAnalysis) => finalizarAnaliseDaConversa({
  txtFile: 'Conversa do WhatsApp com Cliente.txt',
  messages: MSGS,
  audioFilesRelevantes: [],
  transcriptionMap: {},
  existingLeadId: 'lead-1',
  existingTimeline: MSGS,
  previousAnalysis
});

// ── 1. Análise nascida sob as regras ATUAIS continua sendo reaproveitada (a economia da v1141
//      não pode ser desligada — reimportar o mesmo cliente não pode voltar a pagar IA à toa).
{
  const r = await reimportar({ ...salvaBase, regrasMensagensVersao: REGRAS_MENSAGENS_VERSAO });
  assert.equal(r.incrementalMeta.analiseReutilizada, true, 'sem novidade e com as regras atuais, a análise salva é reaproveitada');
  assert.equal(r.analysis.messages.a, salvaBase.messages.a, 'reaproveitar é devolver o mesmo texto salvo');
}

// ── 2. Análise nascida sob regras ANTIGAS não serve de atalho: devolvê-la é devolver o defeito ──
{
  // Sem a marca (é o caso de tudo que já está salvo hoje) e com uma marca de outra versão.
  for(const salva of [{ ...salvaBase }, { ...salvaBase, regrasMensagensVersao: 'v1-regra-antiga' }]){
    const r = await reimportar(salva);
    assert.equal(r.incrementalMeta.analiseReutilizada, false,
      'análise escrita sob regra antiga precisa ser refeita, não reaproveitada');
  }
}

// ── 3. Toda análise nova carimba sob quais regras nasceu (senão o item 2 nunca sai do lugar) ────
{
  const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
  assert.match(src, /regrasMensagensVersao: REGRAS_MENSAGENS_VERSAO,/, 'a análise precisa carimbar a versão das regras');
  assert.match(src, /if \(String\(a\.regrasMensagensVersao \|\| ""\) !== REGRAS_MENSAGENS_VERSAO\) return null;/,
    'o reaproveitamento precisa conferir a versão das regras');
  // A marca é separada da arquitetura de propósito: mexer na arquitetura marcaria a carteira
  // inteira como "reanalise" na tela (analiseAtualValida752), que não é o caso.
  assert.notEqual(REGRAS_MENSAGENS_VERSAO, ARQUITETURA_MENSAGENS_ATUAL, 'as duas marcas não podem ser a mesma coisa');
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(!app.includes('regrasMensagensVersao'),
    'a tela NÃO pode usar essa marca pra recusar análise — ela só governa o atalho do servidor');
}

// ── 4. "Última análise" só muda quando houve análise de verdade ─────────────────────────────────
{
  const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
  assert.match(
    leadUpdate,
    /\.\.\.\(nova\?\.analiseReutilizadaDeImportacaoAnterior === true\s*\n\s*\? \{\}\s*\n\s*: \{ reanalisadoEm: concluidaEm \}\),/,
    'reimportação que só reaproveitou a análise não pode carimbar data de análise nova'
  );
}

console.log('v1220-regra-nova-nao-reaproveita-analise-velha: ok');
