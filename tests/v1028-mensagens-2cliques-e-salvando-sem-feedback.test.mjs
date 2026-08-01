import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1028 — dois pontos relatados pelo dono ao vivo, testando a v1027:
// 1) "Mensagens" dentro do lead não abria no 1º clique, só no 2º — Parte A.
// 2) A etapa "Salvando" (na importação) ficava parada, sem nenhum movimento, parecendo travada
//    num lead com conversa longa (90 áudios) — Parte B.
// (O 3º ponto do dono nesta rodada — o ditado parar sozinho no silêncio — já foi corrigido e
// testado dentro de tests/v1026-9-pontos-refresh-voltar-reaproveita-proposta-ditado.test.mjs,
// Parte C, atualizada nesta mesma sessão.)

// ===================== Parte A — "Mensagens" abre já no 1º clique =====================
{
  // abrirLead recebe o detalhe do lead em 2 etapas (cache/memória primeiro, servidor depois) —
  // cada etapa chama aplicarLead(lead), que reconstrói renderLeadFoco (a tela inteira do lead)
  // do zero. O card #cp704HistCard vem "hidden" por padrão no HTML — sem preservar o estado
  // entre as 2 reconstruções, a 2ª etapa (o detalhe completo chegando do servidor) fechava de
  // novo o card que o corretor tinha acabado de abrir na 1ª etapa, sem ele perceber.
  const ini = app.indexOf('const aplicarLead = (lead) => {');
  assert.ok(ini > -1, 'aplicarLead não encontrada em app.js');
  const fim = app.indexOf('\n  };', ini);
  assert.ok(fim > ini, 'não achei o fim de aplicarLead');
  const src = app.slice(ini, fim);

  assert.match(src, /const histAntes\s*=\s*qs\("#cp704HistCard"\)/, 'precisa capturar o card ANTES de reconstruir a tela (senão pega sempre o card novo, já fechado)');
  assert.match(src, /const histAbertoAntes\s*=\s*!!histAntes\s*&&\s*!histAntes\.hidden/, 'precisa checar se o card estava REALMENTE aberto antes (não pode assumir aberto quando o card ainda nem existia)');
  assert.match(src, /renderLeadFoco\(state\.lead\)/, 'precisa continuar reconstruindo a tela do lead normalmente');
  const idxHistAntes = src.indexOf('histAbertoAntes');
  const idxRender = src.indexOf('renderLeadFoco(state.lead)');
  const idxReabre = src.indexOf('hist.hidden = false');
  assert.ok(idxHistAntes > -1 && idxRender > idxHistAntes && idxReabre > idxRender,
    'a ordem precisa ser: capturar o estado antes, reconstruir a tela, e SÓ DEPOIS reabrir o card se estava aberto');

  console.log('v1028 (Mensagens abre no 1º clique): o card não fecha mais sozinho quando o detalhe completo chega do servidor — ok');
}

// ===================== Parte B — "Salvando" mostra progresso real, não fica parado =====================
{
  const confirmarIni = app.indexOf('async function confirmarAtualizacaoPersistida(');
  assert.ok(confirmarIni > -1, 'confirmarAtualizacaoPersistida não encontrada');
  const confirmarFim = app.indexOf('\nasync function atualizarLeadComEvolucao', confirmarIni);
  const confirmarSrc = app.slice(confirmarIni, confirmarFim);
  assert.match(confirmarSrc, /renderEtapas\(5,/, 'a espera de confirmação (até 3 tentativas, até 20s cada) precisa atualizar a etapa visível a cada tentativa — sem isso, fica parada por até ~1 minuto sem nenhum sinal de vida');

  const atualizarFim = app.indexOf('\nasync function salvarLeadPendente', confirmarFim);
  const atualizarSrc = app.slice(confirmarFim, atualizarFim);
  assert.match(atualizarSrc, /renderEtapas\(5, "salvando a atualização no banco de dados\.\.\."\)/, 'atualizarLeadComEvolucao precisa avisar que começou a salvar de verdade, antes da espera de confirmação');

  const salvarIni = app.indexOf('async function salvarLeadPendente(){');
  assert.ok(salvarIni > -1, 'salvarLeadPendente não encontrada');
  // v1090 — o marcador do fim mudou: a abertura do lead passou por cpioFecharQuandoLeadAbrir,
  // pra a tela cheia da importação só sair DEPOIS que o lead está aberto (antes ela sumia num
  // relógio curto e a tela de importação reaparecia por um instante).
  const marcaAbrirLead = app.indexOf('cpioFecharQuandoLeadAbrir(state.lead?.id)', salvarIni);
  assert.ok(marcaAbrirLead > -1, 'não localizei a abertura do lead ao fim de salvarLeadPendente');
  const salvarFim = app.indexOf('\n}', marcaAbrirLead);
  const salvarSrc = app.slice(salvarIni, salvarFim);
  assert.match(salvarSrc, /renderEtapas\(5, "salvando no banco de dados\.\.\."\)/, 'salvarLeadPendente (lead genuinamente novo, salva sozinho sem perguntar) também precisa avisar que começou');
  assert.match(salvarSrc, /renderEtapas\(5, "liberando os arquivos temporários da importação\.\.\."\)/, 'precisa avisar a próxima etapa real (limpeza dos arquivos temporários) também, não só o início');

  console.log('v1028 ("Salvando" não parece mais travado): etapa visível progride de verdade durante o salvamento — ok');
}

console.log('v1028-mensagens-2cliques-e-salvando-sem-feedback: ok');
