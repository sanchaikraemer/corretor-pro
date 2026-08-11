import fs from 'node:fs';
import assert from 'node:assert/strict';
import { finalizarAnaliseDaConversa } from '../api/_pipeline.js';

// v1221 — "a regra é sempre que fizer uma importação, tem que fazer a reanálise. Não existe essa
// regra já?" (dono, 11/08/2026).
//
// Existia pela metade. A v1177 já dizia "exportou uma conversa, a análise sai, ponto final" — mas
// com uma exceção, criada na v1141 a pedido dele mesmo (dinheiro): reimportação SEM nenhuma
// mensagem nova reaproveitava a análise salva e não chamava a IA. Foi essa exceção que devolveu,
// no print das 18h33, o mesmo texto de 40 minutos antes — escrito sob regras que já tinham sido
// corrigidas. A exceção acabou: importou, analisa.
//
// Este arquivo tranca as duas metades da decisão: (1) a IA é sempre chamada; (2) se a análise nova
// não prestar, a anterior é MANTIDA em vez de o corretor ficar sem nada — e nunca se passando por
// recém-feita. Sem (2), um dia de teto de análises atingido viraria cadastro vazio.
//
// (A guarda anterior deste assunto, tests/v1220-regra-nova-nao-reaproveita-analise-velha, foi
// removida junto com o que ela protegia: aquela marca de versão de regras existia só pra decidir
// quando o atalho valia, e não há mais atalho.)

const MSGS = [
  { date: '2026-07-01', time: '09:10', author: 'Cliente', text: 'bom dia, ainda tem unidade?', iso: '2026-07-01T09:10:00.000Z', order: 1 },
  { date: '2026-07-01', time: '09:14', author: 'Corretor', text: 'bom dia! tenho sim', iso: '2026-07-01T09:14:00.000Z', order: 2 }
];
const SALVA_BOA = {
  summary: 'Cliente perguntou por unidade disponível.',
  arquiteturaMensagens: 'v852-cerebro-unico-obrigatorio',
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
  existingTimeline: MSGS.map(m => ({ ...m, type: 'text', source: 'txt' })),
  previousAnalysis
});

// ── 1. Não existe caminho que pule a IA — nem com zero mensagem nova e análise salva perfeita ──
{
  const r = await reimportar(SALVA_BOA);
  assert.equal(r.incrementalMeta.mensagensNovas, 0, 'a mesma conversa não tem mensagem nova');
  assert.equal(r.incrementalMeta.analiseNovaTentada, true, 'importou, analisa: a IA é chamada mesmo sem novidade nenhuma');
}

// ── 2. Rede de segurança: análise nova imprestável → mantém a anterior, sem mentir sobre ela ────
{
  // Neste ambiente não há chave da OpenAI: toda análise nova sai em "sem_api" (imprestável).
  const r = await reimportar(SALVA_BOA);
  assert.equal(r.incrementalMeta.analiseReutilizada, true, 'a salva boa volta pra tela em vez de deixar o corretor sem nada');
  assert.equal(r.analysis.messages.a, SALVA_BOA.messages.a, 'é a análise que já estava salva');
  assert.equal(r.analysis.analiseReutilizadaDeImportacaoAnterior, true, 'fica marcado que foi MANTIDA, não recém-feita');
  assert.ok(r.analysis.analiseReutilizadaEm, 'com a hora em que foi mantida');
}

// ── 3. Sem salva aproveitável, a falha aparece como falha (nada é inventado pra tapar buraco) ───
{
  for(const ruim of [null, { messages: { a: 'curta', b: '', c: '' } }, { mode: 'erro_api', messages: SALVA_BOA.messages },
                     { arquiteturaMensagens: 'v700-antiga', messages: SALVA_BOA.messages }]){
    const r = await reimportar(ruim);
    assert.equal(r.incrementalMeta.analiseReutilizada, false, 'análise salva imprestável nunca volta pra tela');
    assert.equal(r.analysis.mode, 'sem_api', 'a falha da análise nova aparece como é');
  }
}

// ── 4. O teto de análises do dia também aciona a rede (é o caso que mais dói: reimportar e ficar
//      sem nada porque acabou a cota do dia).
{
  const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function analiseUtilizavel('), src.indexOf('function manterAnaliseSalva('));
  assert.match(fn, /"limite_diario_excedido"/, 'análise barrada pelo teto do dia não conta como análise boa');
  assert.ok(!src.includes('analiseAnteriorReutilizavel'), 'o atalho antigo não pode sobreviver nem como função morta');
}

// ── 5. A tela não promete mais a economia que acabou ────────────────────────────────────────────
{
  const importacao = fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
  // ("Nada novo nesta conversa" segue valendo na linha do tempo: ali é sobre MENSAGEM nova no
  // arquivo, que continua sendo verdade — não é promessa de que a análise foi pulada.)
  for(const promessa of ['nada pago', 'só a novidade paga análise', 'nada a pagar por retrabalho', 'nenhuma análise nova foi gerada']){
    assert.ok(!importacao.includes(promessa), `a tela não pode mais dizer "${promessa}" — toda importação analisa`);
  }
  assert.match(importacao, /não consegui analisar agora — mantive a análise anterior/,
    'quando a rede de segurança age, a tela diz o que aconteceu de verdade');
}

// ── 6. E a data de "Última análise" continua só mudando quando houve análise (v1220) ────────────
{
  const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
  assert.match(
    leadUpdate,
    /\.\.\.\(nova\?\.analiseReutilizadaDeImportacaoAnterior === true\s*\n\s*\? \{\}\s*\n\s*: \{ reanalisadoEm: concluidaEm \}\),/,
    'análise mantida não pode carimbar data de análise nova'
  );
}

console.log('v1221-importou-analisa-sempre: ok');
