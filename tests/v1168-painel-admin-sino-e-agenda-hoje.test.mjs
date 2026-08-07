import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1168 — três pedidos do dono, olhando o app de verdade:
//
//   1. "muito feio e grotesco" (o painel administrativo) — os 5 botões de ação de cada corretor
//      tinham todos o mesmo peso visual, e os dois de MARCAR COMO PAGANTE (ação corriqueira)
//      gritavam mais forte (cor coral, a padrão dos botões) que EXCLUIR (irreversível, cinza
//      neutro) — o oposto do que devia ser. E "Ativo"/"Pro Master" eram duas pílulas verdes
//      lado a lado, competindo por espaço à toa.
//   2. "quando extingue o prazo de teste tem que destacar, ficar melhor, piscar" — a célula
//      "Dias de teste" mostrava só o número cru, sem diferenciar quem está no primeiro dia de
//      quem já venceu.
//   3. "o aviso de agendamento pra hoje é só um pontinho, eu nem percebo... vi um agendamento por
//      acaso" — o sino só ganhava número visível quando havia ATRASO; "hoje, no prazo" caía numa
//      regra mais antiga que zera o tamanho da fonte (font-size:0) de propósito.
//
// Este arquivo prova as três correções com a lógica de verdade rodando (não só grep de texto).

const raiz = new URL('../', import.meta.url);
const ler = (arq) => fs.readFileSync(new URL(arq, raiz), 'utf8');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. PAINEL ADMINISTRATIVO — hierarquia de cor nos botões + selo de "Dias de teste"
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const admin = ler('admin-plataforma.html');
  const css = ler('contas-estilo.css');

  // Cada ação usa a classe certa — plano=verde, bloquear=âmbar, excluir=vermelho com ícone e
  // separado das demais. "+7 dias teste" continua neutro (secundario).
  assert.match(admin, /definirPlano\('\$\{e\.id\}','pro'\)/, 'botão Pago · Pro precisa continuar existindo (v1110)');
  assert.match(admin, /definirPlano\('\$\{e\.id\}','pro-master'\)/, 'botão Pago · Pro Master precisa continuar existindo (v1110)');
  assert.match(admin, /class="pequeno btn-plano" onclick="definirPlano\('\$\{e\.id\}','pro'\)"/, 'Pago · Pro precisa da cor de plano (verde), não mais a coral padrão');
  assert.match(admin, /class="pequeno btn-plano" onclick="definirPlano\('\$\{e\.id\}','pro-master'\)"/, 'Pago · Pro Master precisa da cor de plano');
  assert.match(admin, /class="pequeno btn-atencao" onclick="bloquear\('\$\{e\.id\}'\)"/, 'Bloquear precisa de cor de atenção (âmbar) — é reversível, não é a mesma gravidade de excluir');
  assert.match(admin, /class="pequeno btn-perigo" onclick="excluirConta\('\$\{e\.id\}'\)"/, 'Excluir precisa da cor de perigo — é irreversível');
  assert.match(admin, /class="separador-acao"/, 'Excluir precisa estar visualmente separado das demais ações (é a única irreversível)');
  assert.match(admin, /SVG_LIXEIRA/, 'Excluir precisa de um ícone que deixe claro que é destrutivo');

  // v1169 — o dono viu no ar e achou "ainda muito colorido e gritante": o preenchimento tingido +
  // texto na cor cheia em toda ação de toda linha pesava demais. O MECANISMO de diferenciação
  // mudou (era fundo tingido + texto colorido; virou fundo neutro + uma bolinha colorida, com
  // "Excluir" como única exceção que mantém texto/ícone vermelhos por ser irreversível) — mas as
  // três classes continuam precisando existir E continuar visualmente distinguíveis uma da outra.
  for (const classe of ['btn-plano', 'btn-atencao', 'btn-perigo']) {
    assert.match(css, new RegExp(`button\\.pequeno\\.${classe}`), `contas-estilo.css precisa estilizar .${classe}`);
  }
  assert.match(css, /button\.pequeno\.btn-plano::before\{[^}]*background:var\(--st-ativo\)/, 'Pago · Pro/Pro Master precisam de um sinal verde (mesma cor da pílula "Ativo")');
  assert.match(css, /button\.pequeno\.btn-atencao::before\{[^}]*background:var\(--st-teste\)/, 'Bloquear precisa de um sinal âmbar — reversível, não é a mesma gravidade de excluir');
  assert.match(css, /button\.pequeno\.btn-perigo\{[^}]*color:var\(--st-bloq\)/, 'Excluir precisa continuar com o texto vermelho — é a única ação irreversível, essa não pode ficar neutra');

  // Status + plano viraram UMA pílula só (não duas verdes lado a lado).
  assert.match(admin, /class="pill \$\{e\.status\}"/, 'a pílula de status continua existindo (v996)');
  assert.ok(!/<span class="pill ativo">\$\{escapeHtml\(PLANO_LABEL/.test(admin),
    'não pode mais existir uma SEGUNDA pílula verde separada só pro plano — precisa estar dentro da pílula de status');
  assert.match(admin, /function celulaStatus/, 'precisa existir a função que junta status + plano numa pílula só');

  // "Dias de teste" virou um selo colorido com 3 estados, com o "vencido" pulsando.
  assert.match(admin, /function celulaDiasTeste/, 'precisa existir a função do selo de dias de teste');
  assert.match(css, /\.chip-teste\{/, 'precisa existir o estilo base do selo');
  assert.match(css, /\.chip-teste\.urgente\{/, 'precisa existir o estado "urgente" (poucos dias)');
  assert.match(css, /\.chip-teste\.vencido\{/, 'precisa existir o estado "vencido"');
  assert.match(css, /\.chip-teste\.vencido\{[^}]*animation:/, 'o selo "vencido" precisa se mover (o pedido foi "destacar... piscar")');
  assert.match(css, /prefers-reduced-motion:\s*reduce\)\{\s*\.chip-teste\.vencido\{\s*animation:none/,
    'quem pediu menos movimento na tela não pode ser obrigado a ver o pulso');

  // ── Roda celulaStatus/celulaDiasTeste DE VERDADE, extraídas do arquivo ──────────────────────
  const extrair = (nome) => {
    const ini = admin.indexOf(`function ${nome}(`);
    assert.ok(ini >= 0, `${nome} não encontrada`);
    let i = admin.indexOf('{', ini), prof = 0;
    for (; i < admin.length; i++) { if (admin[i] === '{') prof++; else if (admin[i] === '}') { prof--; if (!prof) break; } }
    return admin.slice(ini, i + 1);
  };
  const escapeHtmlSrc = admin.slice(admin.indexOf('function escapeHtml('), admin.indexOf('function escapeHtml(') + 300).split('\n}')[0] + '\n}';

  const sandbox = new Function(`
    ${escapeHtmlSrc}
    const STATUS_LABEL = { teste: 'Teste', ativo: 'Ativo', bloqueado: 'Bloqueado' };
    const PLANO_LABEL = { 'pro': 'Pro', 'pro-master': 'Pro Master' };
    let planosPorConta = {};
    const window = { CORRETOR_PRO_EMPRESA_PRINCIPAL_ID: '00000000-0000-0000-0000-000000000001' };
    ${extrair('celulaStatus')}
    ${extrair('celulaDiasTeste')}
    return { celulaStatus, celulaDiasTeste, setPlanos: (p) => { planosPorConta = p; } };
  `)();

  // Conta em teste, sem plano: só o rótulo.
  assert.equal(sandbox.celulaStatus({ id: 'x', status: 'teste' }), 'Teste');
  // Conta ativa comum, com plano Pro Master: rótulo + plano NA MESMA pílula.
  sandbox.setPlanos({ 'org-1': 'pro-master' });
  assert.equal(sandbox.celulaStatus({ id: 'org-1', status: 'ativo' }), 'Ativo · Pro Master');
  // Conta original (principal): nunca mostra plano, mesmo se estivesse "ativo".
  assert.equal(sandbox.celulaStatus({ id: '00000000-0000-0000-0000-000000000001', status: 'ativo' }), 'Ativo');
  // Bloqueada: só o rótulo.
  assert.equal(sandbox.celulaStatus({ id: 'x', status: 'bloqueado' }), 'Bloqueado');

  // Dias de teste: os três estados.
  assert.equal(sandbox.celulaDiasTeste({ status: 'ativo', dias_restantes_teste: 5 }), '—', 'conta que não está em teste não mostra selo nenhum');
  assert.match(sandbox.celulaDiasTeste({ status: 'teste', dias_restantes_teste: 5 }), /chip-teste">5 dias<\/span>$/, 'com folga, selo neutro');
  assert.match(sandbox.celulaDiasTeste({ status: 'teste', dias_restantes_teste: 2 }), /chip-teste urgente">2 dias<\/span>$/, 'com 2 dias, precisa marcar urgente');
  assert.match(sandbox.celulaDiasTeste({ status: 'teste', dias_restantes_teste: 1 }), /chip-teste urgente">1 dia<\/span>$/, 'singular certo pra 1 dia');
  assert.match(sandbox.celulaDiasTeste({ status: 'teste', dias_restantes_teste: 0 }), /chip-teste vencido">/, 'com 0 dias, precisa marcar vencido — é exatamente o caso que o dono viu passar batido');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. O SINO — "hoje, no prazo" ganha número visível (só atraso tinha)
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const app = ler('app.js');
  const css = ler('styles.css');

  assert.match(css, /#topBell\.tem-alerta:not\(\.tem-atraso\) \.bell-badge:not\(\[hidden\]\)\{/,
    'precisa existir a regra que desfaz o pontinho cego (font-size:0) pra "hoje, no prazo" — só existia pra atraso');
  const regraNova = css.match(/#topBell\.tem-alerta:not\(\.tem-atraso\) \.bell-badge:not\(\[hidden\]\)\{([^}]*)\}/)[1];
  assert.match(regraNova, /font-size:11px/, 'o número precisa de um tamanho de fonte de verdade, não o 0 herdado');
  assert.doesNotMatch(regraNova, /color:transparent/, 'o número não pode continuar invisível');

  // A regra antiga que zera o pontinho continua existindo (ela é a base — não deve ser apagada,
  // só desfeita nos casos com alerta), e a de atraso (v1093) também.
  assert.match(css, /#topBell \.bell-badge:not\(\[hidden\]\)\{/, 'a base do pontinho de v787 precisa continuar existindo');
  assert.match(css, /#topBell\.tem-atraso \.bell-badge:not\(\[hidden\]\)\{/, 'a regra de atraso (v1093) precisa continuar existindo');

  // JS: o texto do selo passa a mostrar a contagem de hoje mesmo sem atraso.
  assert.match(app, /badge\.textContent = atr > 0 \? String\(atr\) : \(n > 0 \? String\(n\) : ''\);/,
    'sem atraso, o selo precisa mostrar a contagem de hoje — antes ficava vazio mesmo com CSS pronto pra mostrar');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. "Hoje na agenda" — faixa nova na Home, mesma régua de "hoje" que a tela Agenda usa
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const app = ler('app.js');

  assert.match(app, /cp1168FaixaHomeHTML\(items\)/, 'a Home precisa chamar a faixa nova');
  // Vem ANTES da faixa "Ficaram de te dar uma resposta" — compromisso com hora marcada é mais
  // urgente que um prazo de dias.
  const posFaixaHoje = app.indexOf('cp1168FaixaHomeHTML');
  const posFaixaPromessa = app.indexOf('cp1160FaixaHomeHTML(items)');
  assert.ok(posFaixaHoje > 0 && posFaixaHoje < posFaixaPromessa,
    '"Hoje na agenda" precisa aparecer ANTES de "Ficaram de te dar uma resposta" na Home');

  const extrairFn = (nome) => {
    const ini = app.indexOf(`function ${nome}(`);
    assert.ok(ini >= 0, `${nome} não encontrada`);
    let i = app.indexOf('{', ini), prof = 0;
    for (; i < app.length; i++) { if (app[i] === '{') prof++; else if (app[i] === '}') { prof--; if (!prof) break; } }
    return app.slice(ini, i + 1);
  };

  const sandbox = new Function(`
    const ETAPA_ARQUIVADO = "Geladeira";
    function normalizarEtapa(raw){ return raw === "Geladeira" ? "Geladeira" : (raw || "Ativo"); }
    function lembreteTs(l){ const q = l?.analysis?.lembrete?.quando; if(!q) return NaN; const t = new Date(q).getTime(); return isNaN(t) ? NaN : t; }
    function ehContatadoHoje(l){ return !!l.__contatadoHoje; }
    ${extrairFn('cp1168HoraCurta')}
    ${extrairFn('cp1168HoraDoTexto')}
    ${extrairFn('cp1168TsDeHojeComHora')}
    ${extrairFn('cp1168ItensDeHoje')}
    return { cp1168ItensDeHoje, cp1168HoraDoTexto };
  `)();

  const hoje = new Date(); hoje.setHours(15, 0, 0, 0);
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);

  // Lembrete de hoje entra.
  const leadLembreteHoje = { id: 'l1', name: 'Cliente A', etapa: 'Ativo', analysis: { lembrete: { quando: hoje.toISOString(), motivo: 'Ligar de volta' } } };
  // Lembrete de amanhã NÃO entra (é a faixa de HOJE, não de agenda geral).
  const leadLembreteAmanha = { id: 'l2', name: 'Cliente B', etapa: 'Ativo', analysis: { lembrete: { quando: amanha.toISOString() } } };
  // Compromisso confirmado com "hoje" no texto entra.
  const leadCompromissoHoje = { id: 'l3', name: 'Cliente C', etapa: 'Ativo', analysis: { confirmedAppointments: [{ quando: 'hoje às 15h', oQue: 'Visita ao apartamento' }] } };
  // Arquivado não entra, mesmo com lembrete de hoje.
  const leadArquivado = { id: 'l4', name: 'Cliente D', etapa: 'Geladeira', analysis: { lembrete: { quando: hoje.toISOString() } } };
  // Já atendido hoje: some da faixa (já foi tratado).
  const leadJaAtendido = { id: 'l5', name: 'Cliente E', etapa: 'Ativo', __contatadoHoje: true, analysis: { lembrete: { quando: hoje.toISOString() } } };

  const lista = sandbox.cp1168ItensDeHoje([leadLembreteHoje, leadLembreteAmanha, leadCompromissoHoje, leadArquivado, leadJaAtendido]);
  const ids = lista.map(x => x.lead.id).sort();
  assert.deepEqual(ids, ['l1', 'l3'], `só os itens de HOJE, de lead ativo e ainda não atendido — achei ${JSON.stringify(ids)}`);

  assert.equal(sandbox.cp1168HoraDoTexto('hoje às 15h'), '15h', 'precisa extrair a hora do texto livre do compromisso');
  assert.equal(sandbox.cp1168HoraDoTexto('hoje 15:30'), '15:30', 'formato com minutos');
  assert.equal(sandbox.cp1168HoraDoTexto('hoje'), '', 'sem hora no texto, não pode inventar uma');

  // A ordem tem que ser CRONOLÓGICA de verdade — bug pego na conferência visual: todo compromisso
  // (mesmo com hora extraída, tipo "17h") caía no INÍCIO da lista, porque a primeira versão
  // sempre usava "início do dia" como critério de ordenação pra qualquer compromisso confirmado,
  // ignorando a hora que ela mesma tinha acabado de extrair do texto.
  const leadCedo = { id: 'cedo', name: 'Lembrete 12:30', etapa: 'Ativo', analysis: { lembrete: { quando: (() => { const d = new Date(); d.setHours(12, 30, 0, 0); return d.toISOString(); })() } } };
  const leadTarde = { id: 'tarde', name: 'Compromisso 17h', etapa: 'Ativo', analysis: { confirmedAppointments: [{ quando: 'hoje às 17h', oQue: 'Visita' }] } };
  const leadSemHora = { id: 'semhora', name: 'Sem hora dita', etapa: 'Ativo', analysis: { confirmedAppointments: [{ quando: 'hoje', oQue: 'Ligar' }] } };
  const ordem = sandbox.cp1168ItensDeHoje([leadTarde, leadSemHora, leadCedo]).map(x => x.lead.id);
  assert.deepEqual(ordem, ['cedo', 'tarde', 'semhora'],
    `precisa vir em ordem cronológica (12:30 antes de 17h), e o item sem hora reconhecida vai pro fim — achei ${JSON.stringify(ordem)}`);
}

console.log('v1168-painel-admin-sino-e-agenda-hoje: ok');
