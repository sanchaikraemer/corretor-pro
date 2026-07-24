import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v953 — pedido do dono: quando a importação identifica o MESMO cliente por nome EXATO
// (não "parecido"), não pergunta mais "Atualizar cliente?" — atualiza direto. Ele nunca usou a
// opção de tratar como outro cliente nesse caso. O caso genuinamente ambíguo (nome só
// PARECIDO, não idêntico — v915) continua perguntando, sem mudança.

const renderStart = app.indexOf('async function renderProcessedResult(data, meta){');
const renderEnd = app.indexOf('// Divide um nome em palavras normalizadas', renderStart);
const renderFn = app.slice(renderStart, renderEnd);
assert.ok(renderStart > -1 && renderEnd > renderStart, 'achou o corpo de renderProcessedResult');

// 1. Nome exato (perguntarNome true, nomeSoParecido false): chama atualizarLeadComEvolucao()
//    direto, sem esperar clique em botão.
assert.match(renderFn, /\}else if\(perguntarNome\)\{\s*\n\s*\/\/ Nome exato:[\s\S]*?atualizarLeadComEvolucao\(\);/,
  'nome exato deve chamar atualizarLeadComEvolucao() automaticamente, sem esperar clique');

// 2. A caixa de aviso desse caso não pede ação — só informa que já está atualizando.
assert.match(renderFn, /Atualizando o cadastro automaticamente, sem criar duplicata\./,
  'mensagem do caso de nome exato deve dizer que já está atualizando, não pedir confirmação');

// 3. Os botões desse caso ficam ocultos (display:none) — só existem como retomada manual,
//    não como fluxo normal.
assert.match(renderFn,
  /Atualizando o cadastro automaticamente, sem criar duplicata\.<\/div>` \+\s*\n\s*`<div id="pendingActions" style="display:none;/,
  'botões do caso de nome exato ficam ocultos por padrão (fluxo automático)');

// 4. Nome só PARECIDO (ambíguo de verdade, v915) continua perguntando — nada mudou aqui.
assert.match(renderFn, /if\(nomeSoParecido\)\{\s*\n\s*\/\/ Nome só parecido[\s\S]*?\}else if\(perguntarNome\)\{/,
  'nome só parecido continua no fluxo de pergunta (sem chamar atualizarLeadComEvolucao automaticamente)');
assert.doesNotMatch(
  renderFn.slice(0, renderFn.indexOf('}else if(perguntarNome){')),
  /atualizarLeadComEvolucao\(\)/,
  'o bloco de nome parecido não pode chamar atualizarLeadComEvolucao() sozinho'
);

// 5. Sem match nenhum continua salvando direto como sempre (comportamento pré-existente).
assert.match(renderFn, /\}else\{\s*\n\s*salvarLeadPendente\(\);/, 'sem match continua salvando direto');

console.log('v953-atualiza-direto-nome-exato: ok');
