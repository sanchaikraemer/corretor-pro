import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1014 — depois de publicar a v1013, um corretor relatou (num aparelho compartilhado entre
// contas de teste) ver o NOME certo da conta na saudação, mas a LISTA DE LEADS de outra conta.
// Investigação: o servidor resolve a organização sempre pelo token de sessão (bearer) validado a
// cada chamada — não há como o backend "misturar" contas de logins diferentes nesse caminho. A
// causa mais provável é o navegador restaurar a página "congelada" da memória (voltar/avançar
// entre abas, ou o Chrome do Android reabrindo uma aba antiga) sem re-executar os scripts: o
// pequeno IIFE que atualiza o NOME da conta roda de novo (por isso aparece certo), mas caches em
// memória de outras telas (lista de leads, dashboard) continuavam com o snapshot da conta
// anterior até a próxima navegação de verdade.
//
// Fix: um listener de "pageshow" força um reload completo sempre que a página volta de bfcache
// (event.persisted === true) — garante que a tela nunca fica com dado de duas contas diferentes
// misturado no mesmo aparelho.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.match(app, /addEventListener\("pageshow", \(ev\) => \{ if \(ev\.persisted\) location\.reload\(\); \}\)/,
  'precisa existir um listener de pageshow que força reload quando a página volta de bfcache (ev.persisted)');

// O listener precisa estar dentro do mesmo IIFE que já cuida de identidade de conta
// (protegerChamadasApiV682) — não pode ser um bloco solto e desconectado dessa lógica.
const idxIife = app.indexOf('function protegerChamadasApiV682');
const idxFimIife = app.indexOf('})();', app.indexOf('cpCarregarContaLogada'));
const idxListener = app.indexOf('addEventListener("pageshow"');
assert.ok(idxIife > -1 && idxFimIife > -1 && idxListener > -1, 'não encontrei os três marcos esperados em app.js');
assert.ok(idxListener > idxIife && idxListener < (idxFimIife + 2000),
  'o listener de pageshow precisa estar próximo da lógica de identidade de conta (mesma área de código)');

console.log('v1014-bfcache-forca-recarga-troca-conta: ok');
