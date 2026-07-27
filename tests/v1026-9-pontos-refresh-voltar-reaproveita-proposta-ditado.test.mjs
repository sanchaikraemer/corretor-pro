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
  // encerrar um ditado em andamento, não só a gravação antiga.
  const pararIni = app.indexOf('function cp7ObsPararGravacaoSeAtiva(){');
  const pararFim = app.indexOf('\n}', pararIni);
  const parar = app.slice(pararIni, pararFim);
  assert.match(parar, /_cp7ObsReco/, 'parar a gravação ao sair do lead precisa também encerrar o ditado ao vivo, se estiver ativo');

  // Teste funcional: extrai cp7ObsToggleDitado de verdade e simula um SpeechRecognition falso
  // pra confirmar que o texto vai aparecendo (parcial) e se consolida (final) na caixa.
  const fnMatch = app.match(/function cp7ObsToggleDitado\(btn\)\{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'cp7ObsToggleDitado não encontrada por inteiro');
  const fnSrc = fnMatch[0];
  assert.match(fnSrc, /reco\.interimResults\s*=\s*true/, 'precisa pedir resultados parciais (aparecer enquanto fala, não só no fim)');
  assert.match(fnSrc, /reco\.continuous\s*=\s*true/, 'precisa continuar ouvindo além da primeira pausa');

  class FakeRecognition {
    constructor(){ FakeRecognition.instancia = this; }
    start(){ this.iniciado = true; }
    stop(){ if(typeof this.onend === 'function') this.onend(); }
  }
  const elementos = {};
  const sandbox = {
    qs: (sel) => elementos[sel] || (elementos[sel] = { value: '', innerHTML: '', textContent: '' }),
    escapeHtml: (v) => String(v),
    window: { SpeechRecognition: FakeRecognition }
  };
  const fnCorpo = new Function('qs', 'escapeHtml', 'window', `
    let _cp7ObsReco = null, _cp7ObsRecoTextoBase = "";
    ${fnSrc}
    return { iniciar: (btn) => cp7ObsToggleDitado(btn), obterReco: () => _cp7ObsReco };
  `)(sandbox.qs, sandbox.escapeHtml, sandbox.window);

  const btnFake = { textContent: '' };
  fnCorpo.iniciar(btnFake);
  const reco = FakeRecognition.instancia;
  assert.ok(reco.iniciado, 'precisa chamar start() no reconhecimento ao ligar o ditado');
  assert.equal(btnFake.textContent, '⏹ Parar ditado', 'botão precisa indicar que o ditado está ativo');

  // Simula fala parcial (ainda ditando) — some no textarea mesmo sem ser definitivo ainda.
  reco.onresult({ resultIndex: 0, results: [ Object.assign([{ transcript: 'oi tudo' }], { isFinal: false }) ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'oi tudo', 'texto parcial precisa aparecer na caixa enquanto ainda fala');

  // Fala final consolidada — vira parte do texto "base" (não some se vier um parcial novo depois).
  reco.onresult({ resultIndex: 0, results: [ Object.assign([{ transcript: 'oi tudo bem?' }], { isFinal: true }) ] });
  assert.equal(elementos['#cp7ObsTexto'].value, 'oi tudo bem?', 'texto final consolidado precisa ficar guardado, não pode sumir');

  console.log('v1026 (ditado em tempo real): liga o reconhecimento do navegador e escreve o texto conforme fala — ok');
}

// ===================== Parte D — botão "Voltar" do lead sempre cai na Home =====================
{
  const fnMatch = app.match(/function voltarDoLead\(\)\{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'voltarDoLead não encontrada por inteiro');
  const fn = fnMatch[0];
  assert.doesNotMatch(fn, /history\.back\(\)/, 'Voltar não pode mais depender do histórico do navegador (levava pra "última ação", não pra Home)');
  assert.match(fn, /cpClearLeadState\(\)/, 'precisa limpar o lead aberto');
  assert.match(fn, /cpReplaceRoute\(cpRouteForScreen\("home"\)\)/, 'precisa sincronizar a rota salva como Home (senão um refresh logo depois voltaria pro lead)');

  console.log('v1026 (botão Voltar): sempre cai na Home, sem depender de history.back() — ok');
}

// ===================== Parte E — registrar proposta no lead não perde o vínculo silenciosamente =====================
{
  assert.match(app,
    /if\(b\.dataset\.target === "propostas" && state\.active !== "propostas"\)\{ state\.propLeadId = null; state\.propLeadNome = ""; atualizarVoltarProposta\(\); \}/,
    'clicar de novo no item de navegação "Propostas" JÁ ESTANDO na tela de propostas não pode apagar o vínculo com o lead em andamento (só uma navegação NOVA pra lá deve zerar)');

  console.log('v1026 (registrar proposta): reclicar em "Propostas" já na tela não apaga mais o lead vinculado — ok');
}

console.log('v1026-9-pontos-refresh-voltar-reaproveita-proposta-ditado: ok');
