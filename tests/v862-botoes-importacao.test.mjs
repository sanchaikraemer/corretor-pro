import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v862: na tela de importar conversa, os botões "Nova análise" (#clearAnalysis) e
// "Diagnóstico" (#diagnoseOpenAI) ficam DESABILITADOS durante todo o processamento
// (Recebendo, Enviando, Extraindo, Transcrevendo, Analisando, Salvando) e só voltam
// a ficar clicáveis quando a etapa chega em "Concluído" (ou numa falha recuperável,
// pra permitir recomeçar/diagnosticar).

// --- 1) O código precisa ter o funil que trava/libera os dois botões. ---
assert.match(app, /function setBotoesImportacao\(/, 'helper setBotoesImportacao precisa existir');
assert.match(app, /#clearAnalysis/, 'o helper precisa mirar o botão "Nova análise"');
assert.match(app, /#diagnoseOpenAI/, 'o helper precisa mirar o botão "Diagnóstico"');
assert.match(
  app,
  /function renderEtapas\([^)]*\)\{[\s\S]{0,200}setBotoesImportacao\(/,
  'renderEtapas precisa chamar setBotoesImportacao logo no início'
);

// --- 2) Teste comportamental: extrai setBotoesImportacao + renderEtapas e roda
//        contra um DOM falso, conferindo o estado dos botões em cada etapa. ---
const ini = app.indexOf('function setBotoesImportacao(');
const fim = app.indexOf('function startProgresso(');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'não localizei o trecho das funções de etapa');
const fonteFuncoes = app.slice(ini, fim);

function criarBotao(){
  return {
    disabled: false,
    _classes: new Set(),
    classList: {
      toggle(cls, on){ if(on){ this._set.add(cls); } else { this._set.delete(cls); } }
    },
    _init(){ this.classList._set = this._classes; return this; }
  };
}

const btnClear = criarBotao()._init();
const btnDiag = criarBotao()._init();
const elGenerico = () => ({ style:{}, textContent:'', innerHTML:'', classList:{ add(){}, remove(){} } });
const nodes = {
  '#clearAnalysis': btnClear,
  '#diagnoseOpenAI': btnDiag,
  '#processingSteps': { innerHTML:'' },
  '#progressBar': elGenerico(),
  '#processingText': elGenerico(),
};

const sandbox = {
  qs: (sel) => nodes[sel] || null,
  escapeHtml: (s) => String(s ?? ''),
  ETAPAS_PROCESSAMENTO: [
    'Recebendo','Enviando','Extraindo','Transcrevendo','Analisando','Salvando','Concluído','Falha recuperável'
  ],
};

// eslint-disable-next-line no-new-func
const carregar = new Function(
  'qs', 'escapeHtml', 'ETAPAS_PROCESSAMENTO',
  fonteFuncoes + '\nreturn { renderEtapas, setBotoesImportacao };'
);
const { renderEtapas } = carregar(sandbox.qs, sandbox.escapeHtml, sandbox.ETAPAS_PROCESSAMENTO);

const nomesEtapas = ['Recebendo','Enviando','Extraindo','Transcrevendo','Analisando','Salvando'];
// Cada etapa intermediária (0..5) deixa os DOIS botões desabilitados.
nomesEtapas.forEach((nome, idx) => {
  btnClear.disabled = false; btnDiag.disabled = false;
  renderEtapas(idx);
  assert.equal(btnClear.disabled, true, `"Nova análise" deveria estar travado na etapa "${nome}"`);
  assert.equal(btnDiag.disabled, true, `"Diagnóstico" deveria estar travado na etapa "${nome}"`);
});

// Concluído (índice 6): os dois botões voltam a ficar clicáveis.
btnClear.disabled = true; btnDiag.disabled = true;
renderEtapas(6);
assert.equal(btnClear.disabled, false, '"Nova análise" deveria reabilitar em "Concluído"');
assert.equal(btnDiag.disabled, false, '"Diagnóstico" deveria reabilitar em "Concluído"');

// Falha recuperável (índice 7): também libera, pra poder recomeçar/diagnosticar.
btnClear.disabled = true; btnDiag.disabled = true;
renderEtapas(7);
assert.equal(btnClear.disabled, false, '"Nova análise" deveria reabilitar numa falha recuperável');
assert.equal(btnDiag.disabled, false, '"Diagnóstico" deveria reabilitar numa falha recuperável');

// --- 3) A aparência "apagada" precisa existir no CSS (botão desabilitado). ---
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
assert.match(css, /\.btn:disabled|\.btn\[disabled\]/, 'CSS precisa apagar o botão desabilitado');

console.log('v862-botoes-importacao: ok');
