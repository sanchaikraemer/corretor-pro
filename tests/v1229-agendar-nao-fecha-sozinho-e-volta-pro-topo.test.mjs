import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1229 — dois pedidos do dono (12/08/2026), os dois no painel "Agendar" de dentro do lead,
// no celular:
// 1) "quando clico em agenda, e no mapa da data, simplesmente fecha e volta pro lead... só na
//    segunda vez que repito o processo deixa marcar" — era a 2ª montagem do detalhe do lead
//    (a que espera o servidor) chegando com o calendário nativo aberto: a remontagem recriava
//    o painel FECHADO e zerava dia/hora. Mesma doença da v1028 (card Mensagens) e v1081 (campo
//    de observação), que tinha ficado de fora no painel de agendar.
// 2) "depois que salva volta pra parte de Detalhes comerciais — quero que após agendado volte
//    para o topo da tela do lead".

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// ---------- 1a. renderLeadFoco preserva o painel Agendar através da remontagem ----------
{
  const ini = app.indexOf('function renderLeadFoco');
  const fim = app.indexOf('window.renderLeadFoco', ini);
  assert.ok(ini > -1 && fim > ini, 'renderLeadFoco não encontrada em app.js');
  const bloco = app.slice(ini, fim);
  const captura = bloco.indexOf("querySelector('#ui670SchedulePanel')");
  const troca = bloco.indexOf('area.innerHTML');
  assert.ok(captura > -1, 'renderLeadFoco precisa capturar o estado do painel Agendar (#ui670SchedulePanel)');
  assert.ok(captura < troca, 'a captura do painel Agendar tem que acontecer ANTES de trocar o HTML da área');
  const restaura = bloco.indexOf('cpAgEstado', troca);
  assert.ok(restaura > -1, 'depois da remontagem o painel Agendar precisa ser devolvido (aberto e com dia/hora)');
  assert.match(bloco, /ui670ScheduleData/, 'o dia já escolhido precisa sobreviver à remontagem');
  assert.match(bloco, /ui670ScheduleHora/, 'a hora já escolhida precisa sobreviver à remontagem');
}

// ---------- 1b. a remontagem tardia (detalhe vindo do servidor) espera o painel fechar ----------
{
  const ini = app.indexOf('export async function abrirLead(');
  const fim = app.indexOf('window.abrirLead', ini);
  assert.ok(ini > -1 && fim > ini, 'abrirLead não encontrada em app.js');
  const bloco = app.slice(ini, fim);
  const aplicar = bloco.indexOf('const aplicarCompleto');
  assert.ok(aplicar > -1, 'aplicarCompleto não encontrada dentro de abrirLead');
  const trecho = bloco.slice(aplicar, bloco.indexOf('};', aplicar));
  assert.match(trecho, /#ui670SchedulePanel/, 'aplicarCompleto precisa conferir se o painel Agendar está aberto');
  assert.match(trecho, /setTimeout\(aplicarCompleto/, 'com o painel aberto, a remontagem tardia espera e tenta de novo (não pode fechar o calendário na cara do corretor)');
}

// ---------- 2. depois de agendar, volta pro topo da tela do lead ----------
{
  const ini = app.indexOf('async function reagendarLembrete');
  const fim = app.indexOf('window.reagendarLembrete', ini);
  assert.ok(ini > -1 && fim > ini, 'reagendarLembrete não encontrada em app.js');
  const bloco = app.slice(ini, fim);
  const ramoLead = bloco.indexOf('state.lead?.id');
  assert.ok(ramoLead > -1, 'ramo do lead aberto não encontrado em reagendarLembrete');
  const trecho = bloco.slice(ramoLead);
  const fechaPainel = trecho.indexOf('#ui670SchedulePanel');
  const sobeTopo = trecho.indexOf('scrollTo');
  const remonta = trecho.indexOf('abrirLead(');
  assert.ok(fechaPainel > -1, 'depois de agendar, o painel Agendar precisa ser fechado');
  assert.ok(sobeTopo > -1, 'depois de agendar, a página precisa subir pro topo da tela do lead');
  assert.ok(sobeTopo < remonta, 'a subida pro topo tem que vir ANTES da remontagem — senão a restauração de rolagem devolve a tela lá embaixo (Detalhes comerciais)');
}

console.log('v1229-agendar-nao-fecha-sozinho-e-volta-pro-topo: ok');
