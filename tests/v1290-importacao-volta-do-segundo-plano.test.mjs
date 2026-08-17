import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1290 — SAIR DO APP DURANTE A IMPORTAÇÃO E VOLTAR NÃO PODE MOSTRAR A TELA VELHA.
//
// Print do dono (17/08/2026, 12h43): ele mandou uma conversa, saiu do app pra fazer outra coisa e,
// ao voltar, deu de cara com a lista antiga de etapas parada em "Extraindo — baixando e extraindo
// uma única vez (48%)". Uns segundos depois a tela cheia certa voltou sozinha, já em 87%
// "Analisando pelo seu Cérebro" — ou seja, nada tinha travado: a importação seguiu o tempo todo,
// só a TELA é que tinha caído.
//
// Causa: com o app em segundo plano o navegador congela os relógios da página. O contador de 1
// segundo que dá prova de vida para de rodar e o vigia de 2 minutos (a rede que fecha a tela cheia
// pra ninguém ficar preso numa tela morta) dispara na volta, deixando à mostra a tela de baixo,
// congelada no último passo que ela chegou a desenhar.
//
// Conserto: o vigia só conta tempo parado COM O APP NA FRENTE, e voltar pro app traz a tela cheia
// de volta no passo em que a conversa realmente está.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// ── 1. Teste comportamental: a tela cheia rodando contra um DOM e um relógio falsos ───────────
const ini = app.indexOf('const ETAPAS_PROCESSAMENTO = [');
const fim = app.indexOf('export function setBotoesImportacao(');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'não localizei o trecho da tela cheia da importação');
const fonte = app.slice(ini, fim).replace(/^export\s+/gm, '');

function montarCenario(){
  let agora = 1_700_000_000_000;      // relógio falso (nunca 0: Date.now() de verdade também não é)
  let seq = 1;
  const timers = new Map();
  const setTimeoutF = (fn, ms) => { const id = seq++; timers.set(id, { fn, quando: agora + ms }); return id; };
  const clearTimeoutF = (id) => { timers.delete(id); };
  const setIntervalF = (fn, ms) => { const id = seq++; timers.set(id, { fn, quando: agora + ms, cada: ms }); return id; };
  const clearIntervalF = clearTimeoutF;
  function avancar(ms){
    const destino = agora + ms;
    for(let volta = 0; volta < 500000; volta++){
      let proximo = null;
      for(const [id, t] of timers){ if(t.quando <= destino && (!proximo || t.quando < proximo[1].quando)) proximo = [id, t]; }
      if(!proximo) break;
      const [id, t] = proximo;
      agora = t.quando;
      if(t.cada) t.quando = agora + t.cada; else timers.delete(id);
      t.fn();
    }
    agora = destino;
  }

  const overlay = { hidden: true };
  const nos = {
    '#cpImportOverlay': overlay,
    '#cpioPct': { textContent: '' },
    '#cpioProgresso': { style: {} },
    '#cpioTitulo': { textContent: '' },
    '#cpioSub': { textContent: '' },
    '#cpioPassos': { innerHTML: '' },
  };
  const ouvintes = [];
  const doc = {
    hidden: false,
    documentElement: { classList: { remove(){}, add(){} } },
    body: { classList: { add(){}, remove(){} } },
    addEventListener(tipo, fn){ ouvintes.push([tipo, fn]); },
  };
  function trocarVisibilidade(escondido){
    doc.hidden = escondido;
    for(const [tipo, fn] of ouvintes){ if(tipo === 'visibilitychange') fn(); }
  }

  // eslint-disable-next-line no-new-func
  const carregar = new Function(
    'qs', 'escapeHtml', 'document', 'window', 'Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    fonte + '\nreturn { cpImportOverlaySincronizar, cpImportOverlayVisivel };'
  );
  const api = carregar(
    (sel) => nos[sel] || null,
    (s) => String(s ?? ''),
    doc,
    {},
    { now: () => agora },
    setTimeoutF, clearTimeoutF, setIntervalF, clearIntervalF
  );
  return { ...api, overlay, nos, avancar, trocarVisibilidade };
}

// 1a. O caso do print: importação andando, app em segundo plano por 10 minutos, e a tela cheia
//     continua de pé na volta — nunca aparece a lista velha embaixo dela.
{
  const c = montarCenario();
  c.cpImportOverlaySincronizar(2, 'baixando e extraindo uma única vez');
  assert.equal(c.overlay.hidden, false, 'a tela cheia precisa estar de pé durante a importação');

  c.trocarVisibilidade(true);   // o dono saiu do app
  c.avancar(10 * 60 * 1000);    // dez minutos fazendo outra coisa
  assert.equal(c.overlay.hidden, false,
    'com o app em segundo plano o vigia não pode derrubar a tela cheia — foi isso que mostrou a tela velha na volta');

  c.trocarVisibilidade(false);  // voltou pro app
  assert.equal(c.overlay.hidden, false, 'ao voltar, a tela cheia da importação continua na frente');
  assert.equal(c.nos['#cpioTitulo'].textContent, 'Abrindo o arquivo',
    'e volta no passo em que a conversa realmente está');
}

// 1b. Mesmo assim ninguém fica preso: parado de verdade, com o app na frente, o vigia derruba.
{
  const c = montarCenario();
  c.cpImportOverlaySincronizar(2, 'baixando e extraindo uma única vez');
  c.trocarVisibilidade(true);
  c.avancar(10 * 60 * 1000);
  c.trocarVisibilidade(false);
  c.avancar(119000);
  assert.equal(c.overlay.hidden, false, 'a contagem recomeça na volta: 2 minutos ainda não passaram');
  c.avancar(3000);
  assert.equal(c.overlay.hidden, true,
    'passados 2 minutos sem nenhum sinal COM O APP NA FRENTE, a tela cheia sai — ninguém fica preso');
}

// 1c. Depois que o vigia desistiu, voltar pro app não ressuscita a tela cheia (senão o corretor
//     nunca chegaria no que ficou embaixo dela).
{
  const c = montarCenario();
  c.cpImportOverlaySincronizar(2, 'baixando e extraindo uma única vez');
  // Com o app na frente, a etapa ainda dá prova de vida por até 4 minutos (o contador de
  // segundos da v1174) e só depois disso o vigia conta os 2 minutos dele.
  c.avancar(7 * 60 * 1000);
  assert.equal(c.overlay.hidden, true, 'o vigia derrubou a tela cheia');
  c.trocarVisibilidade(true);
  c.trocarVisibilidade(false);
  assert.equal(c.overlay.hidden, true, 'voltar pro app não pode trazer de volta uma tela que já foi declarada morta');
}

// 1d. Importação concluída ou esperando resposta do corretor: voltar pro app não cobre a tela dele.
for(const cenario of [
  { rotulo: 'falha recuperável', chamar: (c) => c.cpImportOverlaySincronizar(7, 'falha recuperável') },
  { rotulo: 'esperando resposta', chamar: (c) => c.cpImportOverlaySincronizar(5, 'responda a pergunta acima', { aguardando: true }) },
]){
  const c = montarCenario();
  c.cpImportOverlaySincronizar(2, 'baixando e extraindo uma única vez');
  cenario.chamar(c);
  assert.equal(c.overlay.hidden, true, `${cenario.rotulo}: a tela cheia sai de cena`);
  c.trocarVisibilidade(true);
  c.trocarVisibilidade(false);
  assert.equal(c.overlay.hidden, true,
    `${cenario.rotulo}: voltar pro app não pode reabrir a tela cheia por cima do que o corretor precisa ver`);
}

// ── 2. As peças do conserto continuam no lugar ────────────────────────────────────────────────
assert.match(app, /function cpioParadoHaMs\(\)\{[\s\S]*?_cpioForaDesde \? Date\.now\(\) - _cpioForaDesde : 0/,
  'o vigia precisa descontar o tempo em que o app ficou em segundo plano');
assert.match(app, /function cpioVigiaBateu\(\)\{[\s\S]*?if\(falta > 0\)\{ cpioAgendarVigia\(falta\); return; \}/,
  'relógio que dispara adiantado (congelado em segundo plano) precisa se reagendar, não fechar a tela');
assert.match(app, /document\.addEventListener\("visibilitychange", \(\) => \{\s*\n\s*if\(document\.hidden\) cpioAppFoiProSegundoPlano\(\); else cpioAppVoltouDoSegundoPlano\(\);/,
  'o app precisa saber quando saiu e quando voltou do segundo plano');
assert.match(app, /function cpioAppVoltouDoSegundoPlano\(\)\{[\s\S]*?cpImportOverlayAtualizar\(_cpioUltimoEstado\.idx, _cpioUltimoEstado\.sub\);/,
  'voltar pro app precisa redesenhar a tela cheia no passo em que a importação está');
assert.match(app, /if\(relogioComecouEm && _cpioRelogio\) _cpioRelogioInicio = relogioComecouEm;/,
  'o contador de segundos da etapa não pode recomeçar do zero só porque o corretor voltou pro app');
