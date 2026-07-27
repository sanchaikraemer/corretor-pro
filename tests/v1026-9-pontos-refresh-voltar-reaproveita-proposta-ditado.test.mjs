import fs from 'node:fs';
import assert from 'node:assert/strict';
import { transcricoesDoLeadAnterior } from '../api/processar-storage.js';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1026 — lista de 9 pontos que o dono mandou de uma vez, testando o site de verdade DEPOIS da
// v1024/v1025, pedindo pra resolver tudo "agora e com atenção":
// 1) Atualizar a página abria um lead antigo em vez da Home + demora no boot — Parte A (o teste
//    de restauração de rota, tests/boot-route-restore.test.mjs, já cobre o comportamento novo).
// 2) "Sair da conta" não aparece no mobile — investigado; a exibição (JS) e o alcance (aba
//    "Mais" -> card "Conta") já existem e parecem corretos; nenhum bug concreto foi encontrado
//    nesta rodada (ver NOTAS-v1026.md pra detalhes e pedido de mais informação ao dono).
// 3) Mouse/clique ainda lento no PC — sem achado NOVO além do que já foi corrigido na v1024.
// 4) Reimportação de lead recorrente sempre mostrava "0 aproveitados" — Parte B abaixo.
// 5) Análise de 30 dias demorando ~1 minuto — investigado (audioWindowDays só limita ÁUDIO, não
//    o volume de texto enviado à IA; não é um bug novo, é como o recorte sempre funcionou).
// 6) Transcrição em tempo real na observação por áudio — Parte C abaixo.
// 7) Sistema ainda lento (melhorou pouco) — sem achado novo além da v1024.
// 8) Botão "Voltar" do lead levava pra última ação (history.back), não pra Home — Parte D abaixo.
// 9) Registrar proposta no lead não salvava depois de preencher tudo — Parte E abaixo.

// ===================== Parte B — reimportação recorrente reaproveita de verdade =====================
{
  // Timeline de uma reimportação ANTERIOR que já reaproveitou um áudio (fica "transcrito_reaproveitado").
  const timelineDaSegundaImportacao = [
    { type: 'audio', mediaFile: 'AUD-recorrente.opus', audioStatus: 'transcrito_reaproveitado', text: '[Áudio transcrito] Oi, tudo bem? Vamos marcar a visita.' },
    { type: 'audio', mediaFile: 'AUD-novo-desta-vez.opus', audioStatus: 'transcrito', text: '[Áudio transcrito] Combinado então, te vejo sábado.' },
    { type: 'text', author: 'Cliente', text: 'combinado' }
  ];
  const mapa = transcricoesDoLeadAnterior(timelineDaSegundaImportacao);
  assert.deepEqual(mapa, {
    'AUD-recorrente.opus': 'Oi, tudo bem? Vamos marcar a visita.',
    'AUD-novo-desta-vez.opus': 'Combinado então, te vejo sábado.'
  }, 'uma 3ª reimportação precisa reaproveitar TANTO o que já era "transcrito" QUANTO o que já tinha sido "transcrito_reaproveitado" numa reimportação anterior — sem isso, um lead recorrente para de reaproveitar depois da 1ª reimportação bem-sucedida');

  // Falhas continuam sem reaproveitar (comportamento do v954 preservado).
  const timelineComFalha = [
    { type: 'audio', mediaFile: 'AUD-erro.opus', audioStatus: 'erro_transcricao', text: '[Áudio: AUD-erro.opus — erro_transcricao]' }
  ];
  assert.deepEqual(transcricoesDoLeadAnterior(timelineComFalha), {}, 'áudio sem transcrição de sucesso continua nunca sendo reaproveitado');

  console.log('v1026 (reimportação recorrente): "transcrito" e "transcrito_reaproveitado" contam igual pra reaproveitar — ok');
}

// ===================== Parte C — ditado em tempo real na observação por áudio =====================
// v1028 — o dono confirmou que o ditado (v1026) funciona, mas pediu que só pare quando ELE tocar
// em "Parar" — o reconhecimento do navegador estava parando sozinho depois de 1-2s de silêncio
// (limitação conhecida do Chrome/Android: "continuous" não é de verdade contínuo). Agora, quando
// o reconhecimento acaba SOZINHO (silêncio), reinicia automaticamente; só um clique explícito
// no botão encerra de vez.
{
  assert.match(app, /function cp7ObsSpeechRecognitionDisponivel\(\)\{/, 'precisa existir a checagem de suporte a reconhecimento de fala do navegador');
  assert.match(app, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/, 'checagem precisa cobrir os dois nomes usados pelos navegadores');

  const dispatcherIni = app.indexOf('window.cp7ObsToggleGravacao = async function(btn){');
  assert.ok(dispatcherIni > -1, 'window.cp7ObsToggleGravacao não encontrada');
  const dispatcherFim = app.indexOf('\n};', dispatcherIni);
  const dispatcher = app.slice(dispatcherIni, dispatcherFim);
  assert.match(dispatcher, /cp7ObsSpeechRecognitionDisponivel\(\)\)\s*return\s*cp7ObsToggleDitado\(btn\)/,
    'quando o navegador suporta, precisa ir pro ditado ao vivo');
  assert.match(dispatcher, /return cp7ObsToggleGravacaoServidor\(btn\)/,
    'sem suporte, precisa continuar caindo no caminho antigo (grava e transcreve no fim)');

  // cp7ObsPararGravacaoSeAtiva (chamada ao sair do lead / trocar de tela) também precisa
  // encerrar um ditado em andamento (e impedir reinício sozinho) — não só a gravação antiga.
  const pararIni = app.indexOf('function cp7ObsPararGravacaoSeAtiva(){');
  const pararFim = app.indexOf('\n}', pararIni);
  const parar = app.slice(pararIni, pararFim);
  assert.match(parar, /_cp7ObsReco/, 'parar a gravação ao sair do lead precisa também encerrar o ditado ao vivo, se estiver ativo');
  assert.match(parar, /_cp7ObsDitadoQuerido\s*=\s*false/, 'sair do lead precisa marcar que o ditado não é mais desejado, senão o próprio encerramento tentaria reiniciar sozinho');

  // Teste funcional: extrai cp7ObsToggleDitado + cp7ObsIniciarDitado de verdade e simula um
  // SpeechRecognition falso pra confirmar: (1) texto aparece parcial/final, (2) parar SOZINHO
  // (silêncio) reinicia automaticamente sem apagar o texto nem soltar o botão, (3) só um clique
  // explícito em "Parar" encerra de vez, sem reiniciar.
  const toggleMatch = app.match(/function cp7ObsToggleDitado\(btn\)\{[\s\S]*?\n\}/);
  assert.ok(toggleMatch, 'cp7ObsToggleDitado não encontrada por inteiro');
  const iniciarMatch = app.match(/function cp7ObsIniciarDitado\(btn\)\{[\s\S]*?\n\}/);
  assert.ok(iniciarMatch, 'cp7ObsIniciarDitado não encontrada por inteiro');
  const toggleSrc = toggleMatch[0], iniciarSrc = iniciarMatch[0];
  assert.match(iniciarSrc, /reco\.interimResults\s*=\s*true/, 'precisa pedir resultados parciais (aparecer enquanto fala, não só no fim)');
  assert.match(iniciarSrc, /reco\.continuous\s*=\s*true/, 'precisa continuar ouvindo além da primeira pausa');
  assert.match(iniciarSrc, /if\(_cp7ObsDitadoQuerido\)\{[\s\S]*?cp7ObsIniciarDitado\(btn\)/, 'precisa reiniciar sozinho quando o reconhecimento acaba sem o corretor ter pedido pra parar');

  class FakeRecognition {
    constructor(){ FakeRecognition.instancias.push(this); }
    start(){ this.iniciado = true; }
    stop(){ if(typeof this.onend === 'function') this.onend(); }
  }
  FakeRecognition.instancias = [];
  const elementos = {};
  const sandbox = {
    qs: (sel) => elementos[sel] || (elementos[sel] = { value: '', innerHTML: '', textContent: '' }),
    escapeHtml: (v) => String(v),
    window: { SpeechRecognition: FakeRecognition }
  };
  const fnCorpo = new Function('qs', 'escapeHtml', 'window', `
    let _cp7ObsReco = null, _cp7ObsRecoTextoBase = "", _cp7ObsDitadoQuerido = false;
    ${iniciarSrc}
    ${toggleSrc}
    return { iniciar: (btn) => cp7ObsToggleDitado(btn), querido: () => _cp7ObsDitadoQuerido };
  `)(sandbox.qs, sandbox.escapeHtml, sandbox.window);

  // No app de verdade, o "btn" passado é o PRÓPRIO elemento #cp7ObsGravarBtn (onclick="...(this)")
  // — cp7ObsIniciarDitado usa os dois jeitos de referenciar o mesmo botão (o parâmetro `btn` e
  // qs("#cp7ObsGravarBtn") dentro do onend). Pro teste simular isso de verdade, os dois PRECISAM
  // ser o mesmo objeto — senão o reset do botão (via qs) não apareceria no `btnFake` do teste.
  const btnFake = elementos['#cp7ObsGravarBtn'] = { textContent: '' };
  fnCorpo.iniciar(btnFake); // 1º clique: liga o ditado
  const reco1 = FakeRecognition.instancias[0];
  assert.ok(reco1.iniciado, 'precisa chamar start() no reconhecimento ao ligar o ditado');
  assert.equal(btnFake.textContent, '⏹ Parar ditado', 'botão precisa indicar que o ditado está ativo');
  assert.equal(fnCorpo.querido(), true, 'depois de ligar, o ditado precisa ficar marcado como "desejado" pelo corretor');

  // Simula fala parcial (ainda ditando) — aparece no textarea mesmo sem ser definitivo ainda.
  reco1.onresult({ resultIndex: 0, results: [ Object.assign([{ transcript: 'oi tudo' }], { isFinal: false }) ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'oi tudo', 'texto parcial precisa aparecer na caixa enquanto ainda fala');

  // Fala final consolidada — vira parte do texto "base" (não some se vier um parcial novo depois).
  reco1.onresult({ resultIndex: 0, results: [ Object.assign([{ transcript: 'oi tudo bem?' }], { isFinal: true }) ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'oi tudo bem?', 'texto final consolidado precisa ficar guardado, não pode sumir');

  // O reconhecimento para SOZINHO (silêncio de 1-2s, sem o corretor ter clicado em nada) —
  // simulado chamando onend() diretamente (não via toggle, que representaria um clique).
  reco1.onend();
  assert.equal(FakeRecognition.instancias.length, 2, 'parar sozinho por silêncio precisa reiniciar um reconhecimento novo automaticamente');
  assert.ok(FakeRecognition.instancias[1].iniciado, 'o reconhecimento reiniciado precisa ser ligado de verdade (start())');
  assert.equal(btnFake.textContent, '⏹ Parar ditado', 'botão não pode voltar a "Gravar áudio" quando foi só silêncio, não um clique em Parar');
  assert.equal(elementos['#cp7ObsTexto'].value, 'oi tudo bem?', 'o texto já ditado não pode ser apagado pelo reinício automático');

  // Fala mais um pouco depois do reinício automático — confirma que o novo reconhecimento
  // continua escrevendo no MESMO texto acumulado (não começa do zero).
  const reco2 = FakeRecognition.instancias[1];
  reco2.onresult({ resultIndex: 0, results: [ Object.assign([{ transcript: 'vamos marcar a visita' }], { isFinal: true }) ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'oi tudo bem? vamos marcar a visita', 'depois do reinício automático, a fala nova precisa somar ao texto já ditado, não substituir');

  // Só agora o corretor clica em "Parar" de propósito — aí sim precisa encerrar de vez.
  fnCorpo.iniciar(btnFake); // 2º clique no MESMO botão = pedido explícito de parar
  assert.equal(FakeRecognition.instancias.length, 2, 'um clique explícito em Parar não pode criar/reiniciar outro reconhecimento');
  assert.equal(btnFake.textContent, '🎙️ Gravar áudio', 'só um clique explícito em "Parar" pode voltar o botão pro estado inicial');
  assert.equal(fnCorpo.querido(), false, 'depois do clique explícito, o ditado não pode mais estar marcado como "desejado" (senão reiniciaria sozinho de novo)');

  console.log('v1026 (ditado em tempo real): liga o reconhecimento do navegador e escreve o texto conforme fala — ok');
}

// ===================== Parte D — botão "Voltar" do lead sempre cai na Home =====================
{
  const fnMatch = app.match(/function voltarDoLead\(\)\{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'voltarDoLead não encontrada por inteiro');
  const fn = fnMatch[0];
  // Ignora comentários (linhas "// ...") pra checar só CÓDIGO de verdade — o comentário do v1030
  // explica por que history.back() saiu, e citar o nome dele ali não pode contar como "voltou".
  const fnSemComentarios = fn.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  assert.doesNotMatch(fnSemComentarios, /history\.back\(\)/, 'Voltar não pode mais depender do histórico do navegador (levava pra "última ação", não pra Home)');
  assert.match(fn, /cpClearLeadState\(\)/, 'precisa limpar o lead aberto');
  assert.match(fn, /cpReplaceRoute\(cpRouteForScreen\("home"\)\)/, 'precisa sincronizar a rota salva como Home (senão um refresh logo depois voltaria pro lead)');
  // v1030 — regressão real desta mesma correção: sem passar por show("home"), o painel (cartões
  // "Total de leads"/Agenda/etc. e as listas) nunca era recarregado — depois de "Voltar", a Home
  // ficava com o painel vazio/parado (relatado: só a busca de lead aparecia, mais nada).
  assert.match(fn, /show\("home",\s*\{\s*skipHistory:\s*true\s*\}\)/, 'precisa chamar show("home") pra recarregar o painel — é isso que dispara carregarDashboard() (cartões e listas), não só renderBotoesHome/abrirGrupoHome');
  const idxShow = fn.indexOf('show("home"');
  const idxBotoes = fn.search(/renderBotoesHome\(\)|abrirGrupoHome\(/);
  const idxReplace = fn.indexOf('cpReplaceRoute(');
  assert.ok(idxShow > -1 && idxShow < idxBotoes && idxBotoes < idxReplace,
    'ordem precisa ser: show("home") primeiro (recarrega o painel), depois renderBotoesHome/abrirGrupoHome (mostra a fila certa), só então sincronizar a rota — mesma ordem já usada com sucesso em cpRestoreRoute pro botão físico de voltar');

  console.log('v1026/v1030 (botão Voltar): sempre cai na Home E recarrega o painel, sem depender de history.back() — ok');
}

// ===================== Parte E — registrar proposta no lead não perde o vínculo silenciosamente =====================
{
  assert.match(app,
    /if\(b\.dataset\.target === "propostas" && state\.active !== "propostas"\)\{ state\.propLeadId = null; state\.propLeadNome = ""; atualizarVoltarProposta\(\); \}/,
    'clicar de novo no item de navegação "Propostas" JÁ ESTANDO na tela de propostas não pode apagar o vínculo com o lead em andamento (só uma navegação NOVA pra lá deve zerar)');

  console.log('v1026 (registrar proposta): reclicar em "Propostas" já na tela não apaga mais o lead vinculado — ok');
}

console.log('v1026-9-pontos-refresh-voltar-reaproveita-proposta-ditado: ok');
