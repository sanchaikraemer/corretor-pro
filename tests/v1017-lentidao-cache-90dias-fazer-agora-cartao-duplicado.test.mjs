import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveOrganizationId, listRecentProcessings } from '../api/_persistence.js';

// v1017 — retorno de teste do dono sobre o v1016, quatro pontos na mesma mensagem:
//
// 1) O cartão da conta na lateral (virou botão clicável na v1015) e o botão dedicado "Sair da
//    conta" logo abaixo faziam exatamente a mesma coisa — "ambos servem pra mesma coisa, retire
//    esse card de cima". Coberto pelo teste atualizado de v1015 (cartão volta a ser só
//    informativo, sem onclick/seta).
//
// 2) A barra de mensagens do "Fazer agora" (cpBarraMensagensMini) continuava mostrando a
//    contagem HISTÓRICA INTEIRA de mensagens do cliente, e não os últimos 90 dias — mesmo depois
//    de "Total de mensagens" já ter sido corrigido pra 90 dias na v1016. Servidor ganhou
//    clientMessageCount90d (mesma varredura de sempre); app.js ganhou mensagensDoClienteRecente,
//    usada SÓ nessa barra — o ranking/elegibilidade (cpProbabilidadeFechamento, leadsEsquecidos)
//    continua com mensagensDoCliente (histórico inteiro, de propósito: leadsEsquecidos existe
//    pra resgatar lead antigo que esfriou, e uma janela de 90 dias zeraria esses leads).
//
// 3) O dono testou numa conta ("teste1") SEM NENHUM LEAD e o mesmo travamento/lentidão apareceu —
//    prova de que a teoria de "reprocessar timeline de cada lead" não é (ou não é só) a causa,
//    já que uma conta vazia não tem timeline nenhuma pra reprocessar. Investigação achou que
//    resolveOrganizationId roda como primeiro passo em quase toda rota de /api e pagava DUAS idas
//    e voltas ao Supabase (auth.getUser + memberships) TODA VEZ, sem cache — custo fixo, igual
//    numa conta vazia ou cheia. Ganhou cache em memória (30s, por token) — mesmo assim continua
//    revalidando bloqueio/teste vencido dentro desse intervalo.
//
// 4) O reprocessamento de timeline por lead (item pendente já conhecido antes desta mensagem)
//    ganhou cache (_statsCache, guardado dentro do próprio resultado_analise — sem coluna nova):
//    só recalcula quando o histórico muda de tamanho ou quando vira o dia.
//
// 5) "o sistema continua puxando leads antes mesmo dos 5 dias de descanso, já falamos umas mil
//    vezes sobre isso e nunca resolve" — causa raiz: emJanelaDeEspera/entraEmRetomada decidiam
//    "a bola é minha ou do cliente?" olhando só QUEM falou por último, nunca O QUÊ — um "Ok"/
//    "Obrigada" do cliente (sem pedir nada) encerrava a espera na hora, igual a uma pergunta de
//    verdade. Esse exato bug já tinha sido corrigido na v944 — só que unicamente dentro de
//    cpProbabilidadeFechamento (a função que ORDENA a fila), nunca nas funções que decidem QUEM
//    ENTRA nela. Extraída a checagem compartilhada (ultimaMsgClientePedeResposta) e aplicada
//    também em emJanelaDeEspera/entraEmRetomada.
//    v1018 — o dono testou este v1017 e trouxe casos reais (Rafael, Adão) mostrando que mensagem
//    NÃO PODE fazer parte dessa conta de jeito nenhum, nem pra encerrar nem pra manter a espera:
//    "deve contar do último atendimento esse prazo, e não da última mensagem do cliente".
//    emJanelaDeEspera foi reescrita de novo (ver tests/v1018-atendimento-e-nao-mensagem-define-espera.test.mjs
//    e tests/v981-janela-espera-considera-atendimento.test.mjs, ambos atualizados) — conta só
//    ultimoAtendimentoTs, sem nenhum sinal de mensagem.
//
// 6) Print à parte: o card "Fazer agora" de dentro do lead mostrava um texto motivo (cor coral)
//    que o dono já tinha pedido pra tirar da Home (v975) e agora pediu pra tirar de vez, também
//    dali: "só serve pra incomodar, não me ajuda em nada, só polui tela". cpFatoresRankingLead/
//    cpMotivoFechamento removidas por completo — ver tests/v946-ranking-explicavel.test.mjs,
//    tests/v972-clareza-fila-hoje.test.mjs e tests/v975-motivo-so-no-lead.test.mjs (atualizados).

const HOJE_BR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const isoDiasAtras = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();

function fakeSupabaseParaLista(rows, { onUpdate } = {}) {
  return {
    from(tabela) {
      assert.equal(tabela, 'whatsapp_processamentos');
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit() { return Promise.resolve({ data: rows, error: null }); },
        update(payload) {
          return { eq() { return { eq() { if (onUpdate) onUpdate(payload); return Promise.resolve({ error: null }); } }; } };
        }
      };
    }
  };
}

// Timeline com mensagens antigas (fora dos 90 dias) e recentes (dentro), do cliente e do corretor.
function montarTimeline() {
  return [
    { author: 'Maria', text: 'mensagem bem antiga', iso: isoDiasAtras(150) },
    { author: 'Maria', text: 'outra mensagem antiga', iso: isoDiasAtras(100) },
    { author: 'Corretor Pro', text: 'oi Maria, como vai?', iso: isoDiasAtras(40) }, // dentro de 90d, não é do cliente
    { author: 'Maria', text: 'mensagem recente 1', iso: isoDiasAtras(30) },
    { author: 'Maria', text: 'mensagem recente 2, tem disponibilidade?', iso: isoDiasAtras(10) },
    { author: 'Maria', text: 'mensagem recente 3', iso: isoDiasAtras(5) }
  ];
}

async function parteServidor() {
  const timeline = montarTimeline();
  const rowBase = {
    id: 'lead-1',
    nome_arquivo: 'Conversa do WhatsApp com Maria.zip',
    timeline_json: timeline,
    resultado_analise: null,
    organization_id: 'org-1',
    atualizado_em: isoDiasAtras(5)
  };

  // 1. Sem cache ainda: calcula na hora (varredura completa) e GRAVA o _statsCache de volta.
  const writeBacks1 = [];
  const supa1 = fakeSupabaseParaLista([{ ...rowBase }], { onUpdate: (p) => writeBacks1.push(p) });
  const r1 = await listRecentProcessings(10, { supabase: supa1, organizationId: 'org-1' });
  assert.equal(r1.ok, true, JSON.stringify(r1));
  const item1 = r1.items.find(i => i.id === 'lead-1');
  assert.ok(item1, 'lead precisa aparecer na listagem');
  assert.equal(item1.messageCount, 6, 'messageCount é o histórico inteiro');
  assert.equal(item1.clientMessageCount, 5, 'clientMessageCount é histórico inteiro, só do cliente (Maria)');
  assert.equal(item1.clientMessageCount90d, 3, 'clientMessageCount90d só conta as 3 mensagens de Maria dentro dos últimos 90 dias');
  assert.equal(item1.messageCount90d, 4, 'messageCount90d conta TODO mundo (inclui a do corretor) dentro dos últimos 90 dias');
  assert.equal(item1.clientQuestionCount, 1, 'só uma mensagem do cliente tem "?"');
  assert.equal(item1.clientMessageDays, 5, 'as 5 mensagens de Maria caem em 5 dias distintos');
  assert.equal(writeBacks1.length, 1, 'sem cache, precisa gravar o _statsCache calculado de volta');
  const cache1 = writeBacks1[0]?.resultado_analise?._statsCache;
  assert.ok(cache1, 'a gravação precisa incluir _statsCache dentro de resultado_analise');
  assert.equal(cache1.len, timeline.length);
  assert.equal(cache1.dia, HOJE_BR);
  assert.equal(cache1.clientMessageCount90d, 3);
  // v1136 — o cache gravado agora é v3: carrega a marca d'água da linha (atualizado_em), o último
  // toque e a PRÉVIA de mensagens — é o que permite a listagem nem buscar a conversa quando nada
  // mudou (ver LIST_COLUMNS_SEM_TIMELINE em _persistence.js e o teste v1136).
  assert.equal(cache1.v, 5, 'o cache gravado precisa ser v5 (v1281: entraram as mensagens do mês ANTERIOR)');
  assert.equal(cache1.marca, rowBase.atualizado_em, 'a marca d\'água precisa ser o atualizado_em da linha lida');
  assert.ok(Array.isArray(cache1.preview) && cache1.preview.length === timeline.length, 'a prévia (até 8 msgs) precisa ir junto no cache');
  assert.equal(cache1.lastTouchIso, timeline[timeline.length - 1].iso, 'o último toque precisa ir junto no cache');

  // 2. Cache válido (mesmo tamanho de histórico, mesmo dia) — usa o valor GRAVADO, mesmo que ele
  // não bata com o que uma varredura de verdade calcularia. Isso prova que a varredura foi
  // realmente PULADA (não é coincidência de dar o mesmo número).
  const rowComCachePlantado = {
    ...rowBase,
    resultado_analise: { _statsCache: { v: 5, marca: rowBase.atualizado_em, len: timeline.length, dia: HOJE_BR, lastIso: null, lastClientIso: null, lastCorretorIso: null, lastTouchIso: null, lastTouchTime: null, preview: [], clientMessageCount: 999, clientQuestionCount: 999, clientMessageDays: 999, messageCount90d: 999, clientMessageCount90d: 999, hasProposal: true } }
  };
  const writeBacks2 = [];
  const supa2 = fakeSupabaseParaLista([rowComCachePlantado], { onUpdate: (p) => writeBacks2.push(p) });
  const r2 = await listRecentProcessings(10, { supabase: supa2, organizationId: 'org-1' });
  const item2 = r2.items.find(i => i.id === 'lead-1');
  assert.equal(item2.clientMessageCount90d, 999, 'com cache válido, usa o número gravado (mesmo "errado") em vez de recalcular');
  assert.equal(item2.hasProposal, true, 'hasProposal também vem do cache quando ele é válido');
  assert.equal(writeBacks2.length, 0, 'cache válido não precisa gravar nada de novo');

  // 3. Histórico mudou de tamanho (chegou mensagem nova) → cache invalidado, recalcula de verdade.
  const timelineMaior = [...timeline, { author: 'Maria', text: 'mensagem novíssima', iso: isoDiasAtras(1) }];
  const rowComMensagemNova = {
    ...rowBase,
    timeline_json: timelineMaior,
    resultado_analise: { _statsCache: { v: 5, marca: rowBase.atualizado_em, len: timeline.length /* tamanho ANTIGO */, dia: HOJE_BR, clientMessageCount90d: 999 } }
  };
  const supa3 = fakeSupabaseParaLista([rowComMensagemNova]);
  const r3 = await listRecentProcessings(10, { supabase: supa3, organizationId: 'org-1' });
  const item3 = r3.items.find(i => i.id === 'lead-1');
  assert.equal(item3.clientMessageCount90d, 4, 'com histórico maior (cache com "len" desatualizado), recalcula: 3 de antes + 1 nova');

  // 4. Mesmo tamanho de histórico, mas o cache é de OUTRO DIA → invalidado (messageCount90d
  // envelhece com o tempo mesmo sem mensagem nova) e recalcula de verdade.
  const rowComCacheDeOntem = {
    ...rowBase,
    resultado_analise: { _statsCache: { v: 5, marca: rowBase.atualizado_em, len: timeline.length, dia: '2020-01-01', clientMessageCount90d: 999 } }
  };
  const supa4 = fakeSupabaseParaLista([rowComCacheDeOntem]);
  const r4 = await listRecentProcessings(10, { supabase: supa4, organizationId: 'org-1' });
  const item4 = r4.items.find(i => i.id === 'lead-1');
  assert.equal(item4.clientMessageCount90d, 3, 'cache de outro dia é ignorado, mesmo com o histórico do mesmo tamanho');

  // 5. v1136 — a linha foi TOCADA depois do cache (marca d'água diferente) → invalidado, mesmo
  // com o histórico do mesmo tamanho e no mesmo dia. É a dimensão que permite confiar no cache
  // sem ter a conversa em mãos: qualquer mutação real troca o atualizado_em.
  const rowTocadaDepois = {
    ...rowBase,
    atualizado_em: isoDiasAtras(1),
    resultado_analise: { _statsCache: { v: 5, marca: rowBase.atualizado_em /* marca ANTIGA */, len: timeline.length, dia: HOJE_BR, clientMessageCount90d: 999 } }
  };
  const supa5 = fakeSupabaseParaLista([rowTocadaDepois]);
  const r5 = await listRecentProcessings(10, { supabase: supa5, organizationId: 'org-1' });
  const item5 = r5.items.find(i => i.id === 'lead-1');
  assert.equal(item5.clientMessageCount90d, 3, 'linha tocada depois do cache (marca diferente) recalcula de verdade');

  console.log('v1017 (servidor): _statsCache calcula, grava, usa cache válido, invalida por tamanho, por dia e por marca — ok');
}

async function parteAutenticacao() {
  // resolveOrganizationId desliga o cache durante os testes (ver v1003/v997 — cada chamada
  // precisa de resolução fresca). Pra testar o cache de verdade, este bloco finge por um instante
  // que NÃO está em modo de teste, e restaura tudo depois, aconteça o que acontecer.
  const envAntes = { NODE_ENV: process.env.NODE_ENV, npm_lifecycle_event: process.env.npm_lifecycle_event };
  delete process.env.NODE_ENV;
  delete process.env.npm_lifecycle_event;
  try {
    function fakeRes() {
      return { statusCode: 200, payload: null, status(c) { this.statusCode = c; return this; }, setHeader() {}, end(corpo) { this.payload = corpo ? JSON.parse(corpo) : null; } };
    }
    function fakeSupabaseAuth(orgId, org) {
      let getUserCalls = 0, membershipCalls = 0;
      return {
        stats: () => ({ getUserCalls, membershipCalls }),
        auth: { async getUser() { getUserCalls++; return { data: { user: { id: `user-${orgId}` } }, error: null }; } },
        from() {
          return {
            select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
            async maybeSingle() { membershipCalls++; return { data: { organization_id: orgId, organizations: org }, error: null }; }
          };
        }
      };
    }

    // 1ª chamada com um token: resolve de verdade (bate no "banco").
    const supaX = fakeSupabaseAuth('org-x', { status: 'ativo' });
    const reqX = { headers: { authorization: 'Bearer token-abc' } };
    const org1 = await resolveOrganizationId(reqX, fakeRes(), { supabase: supaX });
    assert.equal(org1, 'org-x');
    assert.deepEqual(supaX.stats(), { getUserCalls: 1, membershipCalls: 1 });

    // 2ª chamada com o MESMO token: usa o cache — não bate no "banco" de novo.
    const org2 = await resolveOrganizationId(reqX, fakeRes(), { supabase: supaX });
    assert.equal(org2, 'org-x', 'segunda chamada com o mesmo token continua resolvendo pra mesma organização');
    assert.deepEqual(supaX.stats(), { getUserCalls: 1, membershipCalls: 1 }, 'segunda chamada não pode bater no Supabase de novo (cache)');

    // 3ª chamada com um token DIFERENTE: resolve fresco de novo (cache é por token, não geral).
    const supaY = fakeSupabaseAuth('org-y', { status: 'ativo' });
    const reqY = { headers: { authorization: 'Bearer token-outro' } };
    const org3 = await resolveOrganizationId(reqY, fakeRes(), { supabase: supaY });
    assert.equal(org3, 'org-y');
    assert.deepEqual(supaY.stats(), { getUserCalls: 1, membershipCalls: 1 }, 'token diferente precisa bater no Supabase (cache não pode misturar contas)');

    // Conta bloqueada: cacheia o bloqueio também — 2ª chamada continua bloqueando sem bater rede.
    const supaBloq = fakeSupabaseAuth('org-bloqueada', { status: 'bloqueado' });
    const reqBloq = { headers: { authorization: 'Bearer token-bloqueado' } };
    const res1 = fakeRes();
    const orgBloq1 = await resolveOrganizationId(reqBloq, res1, { supabase: supaBloq });
    assert.equal(orgBloq1, null);
    assert.equal(res1.statusCode, 403);
    assert.equal(res1.payload?.bloqueado, true);
    const res2 = fakeRes();
    const orgBloq2 = await resolveOrganizationId(reqBloq, res2, { supabase: supaBloq });
    assert.equal(orgBloq2, null, 'conta bloqueada continua bloqueada no cache');
    assert.equal(res2.statusCode, 403);
    assert.equal(res2.payload?.bloqueado, true);
    assert.deepEqual(supaBloq.stats(), { getUserCalls: 1, membershipCalls: 1 }, 'bloqueio cacheado não pode bater no Supabase de novo');

    console.log('v1017 (autenticação): cache de organização por token, sem misturar contas — ok');
  } finally {
    for (const [chave, valor] of Object.entries(envAntes)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  }
}

function parteJanelaDeEspera() {
  function extrai(padrao, nome) {
    const m = app.match(padrao);
    assert.ok(m, `${nome} não encontrada em app.js`);
    return m[0];
  }
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

  // v1018 substituiu de vez a checagem "despedida vs. pergunta real" aqui por uma regra mais
  // simples e mais taxativa do dono: emJanelaDeEspera conta SÓ o último atendimento marcado,
  // ponto — mensagem (do cliente ou minha) não entra mais nessa conta de jeito nenhum. Cobertura
  // completa do comportamento atual está em tests/v981-janela-espera-considera-atendimento.test.mjs
  // (reescrito) e tests/v1018-atendimento-e-nao-mensagem-define-espera.test.mjs (novo).
  //
  // v1190 tirou este ramo junto com o nível 1 de filaPorFatos; v1192 DEVOLVEU por ordem do dono.
  // Os dois casos não são a mesma coisa: o nível 1 AFIRMAVA pendência e furava o descanso de um
  // lead já atendido (continua removido); aqui não há descanso pra furar — a linha de cima
  // (emJanelaDeEspera) só devolve false quando NÃO existe atendimento marcado nenhum. Segurar por
  // 5 dias um lead novo que fez uma pergunta é perder venda.
  const retomadaSrc = extrai(/function entraEmRetomada\(l\)\{[\s\S]*?\n\}/, 'entraEmRetomada');
  assert.match(retomadaSrc, /ehMsgDoCliente\(m, primeiroNome\) && ultimaMsgClientePedeResposta\(l\)/,
    'entraEmRetomada exige que a última mensagem do cliente peça resposta, não só que seja dele');
  console.log('v1017 (entraEmRetomada): liberação antecipada só com pergunta de verdade — ok');
}

function parteCartaoLateral() {
  // 1) cartão duplicado — coberto em detalhe em tests/v1015-seta-conta-lateral-clicavel.test.mjs.
  // Na v1017 o cartão tinha virado um <div> sem ação (ainda visível, só sem clique); na v1024 o
  // dono repetiu o pedido e o cartão saiu inteiro da tela — confirma aqui só que os dois arquivos
  // concordam entre si (o cartão não existe mais).
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(index, /id="cpSidebarUserBtn"/, 'o cartão da conta na lateral foi removido de vez na v1024');
  console.log('v1017 (cartão lateral): sem duplicidade com "Sair da conta" — ok (removido de vez na v1024)');
}

function parteBarraFazerAgora() {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /function mensagensDoClienteRecente\(l\)\{/, 'precisa existir a versão em 90 dias de mensagensDoCliente');
  const iniFn = app.indexOf('function mensagensDoClienteRecente(l){');
  const fimFn = app.indexOf('\n}', iniFn);
  assert.match(app.slice(iniFn, fimFn), /clientMessageCount90d/, 'mensagensDoClienteRecente precisa usar o campo de 90 dias do servidor');

  // A barra do Fazer Agora usa a versão de 90 dias...
  const iniBar = app.indexOf('function cpBarraMensagensMini(l, maxMsgs){');
  const fimBar = app.indexOf('\n}', iniBar);
  const barraFn = app.slice(iniBar, fimBar);
  assert.match(barraFn, /mensagensDoClienteRecente\(l\)/, 'a barra do Fazer Agora precisa usar a contagem de 90 dias');

  // ...mas o ranking/elegibilidade continua no histórico inteiro (mensagensDoCliente), de propósito.
  const iniFila = app.indexOf('function cpFilaFazerAgora(items){');
  const fimFila = app.indexOf('\n}', iniFila);
  assert.match(app.slice(iniFila, fimFila), /mensagensDoCliente\(l\)/, 'a elegibilidade da fila continua no histórico inteiro (não 90 dias)');

  // v1159 — o ranking não conta MAIS volume de mensagem, nem em 90 dias nem no histórico. Pergunta
  // do dono: "+1 por mensagem e +6 por pergunta, isso é a mesma coisa ou não?" — se sobrepunha
  // (toda pergunta contava duas vezes) e volume não diz se o cliente compra. Volume segue vivo
  // onde faz sentido: a barrinha (90 dias, acima) e o desempate da fila (histórico, acima).
  const iniProb = app.indexOf('function cpProbabilidadeFechamento(l){');
  const fimProb = app.indexOf('\n}', iniProb);
  assert.doesNotMatch(app.slice(iniProb, fimProb), /mensagensDoCliente(Recente)?\(l\)/,
    'o ranking não pode voltar a contar volume de mensagens');

  console.log('v1017 (barra Fazer Agora): 90 dias na exibição; o ranking não conta mais volume (v1159) — ok');
}

await parteServidor();
await parteAutenticacao();
parteJanelaDeEspera();
parteCartaoLateral();
parteBarraFazerAgora();
console.log('v1017-lentidao-cache-90dias-fazer-agora-cartao-duplicado: ok');
