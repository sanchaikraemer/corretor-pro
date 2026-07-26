import assert from 'node:assert/strict';
import handler from '../api/analisar.js';

// v989 — a v963 já tinha corrigido api/analisar.js pra chamar requireApiKey(), mas o teste de
// guarda daquela versão (v963-todas-rotas-exigem-api-key) só confere se a PALAVRA "requireApiKey"
// aparece no texto do arquivo — não prova que um pedido sem a chave é recusado de verdade, nem que
// isso acontece ANTES de qualquer leitura do arquivo enviado. Este teste chama o handler de
// verdade, sem a chave, e comprova as duas coisas na prática.
//
// requireApiKey() tem um atalho que libera tudo quando NODE_ENV/npm_lifecycle_event é "test" —
// necessário pros outros testes do projeto não precisarem simular a chave toda hora. Aqui a gente
// desliga esse atalho de propósito, senão o teste "passaria de graça" sem checar nada.
const envAntes = {
  NODE_ENV: process.env.NODE_ENV,
  npm_lifecycle_event: process.env.npm_lifecycle_event,
  CORRETOR_PRO_API_KEY: process.env.CORRETOR_PRO_API_KEY,
  API_SECRET: process.env.API_SECRET,
  CP_API_SECRET: process.env.CP_API_SECRET,
  ALLOW_UNPROTECTED_API: process.env.ALLOW_UNPROTECTED_API,
};

function restaurarEnv() {
  for (const [chave, valor] of Object.entries(envAntes)) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
}

delete process.env.NODE_ENV;
delete process.env.npm_lifecycle_event;
delete process.env.API_SECRET;
delete process.env.CP_API_SECRET;
delete process.env.ALLOW_UNPROTECTED_API;
process.env.CORRETOR_PRO_API_KEY = 'chave-de-teste-v989-nao-usar-em-producao';

try {
  let corpoFoiLido = false;
  const reqSemChave = {
    method: 'POST',
    headers: { 'content-type': 'application/zip' },
    async *[Symbol.asyncIterator]() {
      corpoFoiLido = true;
      yield Buffer.from('arquivo que nunca deveria ser lido sem a chave');
    }
  };

  let payload = null;
  const res = {
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    setHeader() {},
    end(corpo) { payload = corpo ? JSON.parse(corpo) : null; }
  };

  await handler(reqSemChave, res);

  assert.equal(res.statusCode, 401, 'POST em /api/analisar sem a chave de acesso precisa responder 401');
  assert.equal(payload?.ok, false, 'resposta de bloqueio precisa indicar ok:false');
  assert.equal(corpoFoiLido, false, 'o arquivo enviado não pode ser lido antes de confirmar a chave de acesso');

  // Com a chave certa (no header), a rota passa da checagem e só falha depois por não ter ZIP —
  // prova que a trava é específica da ausência/erro da chave, não um bloqueio geral quebrado.
  let corpoFoiLidoComChave = false;
  const reqComChave = {
    method: 'POST',
    headers: {
      'content-type': 'application/zip',
      'x-corretor-pro-key': 'chave-de-teste-v989-nao-usar-em-producao'
    },
    async *[Symbol.asyncIterator]() {
      corpoFoiLidoComChave = true;
    }
  };
  let payloadComChave = null;
  const resComChave = {
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    setHeader() {},
    end(corpo) { payloadComChave = corpo ? JSON.parse(corpo) : null; }
  };
  await handler(reqComChave, resComChave);
  assert.equal(resComChave.statusCode, 400, 'com a chave certa a rota deve passar da autenticação (erro vira "sem ZIP", não 401)');
  assert.equal(corpoFoiLidoComChave, true, 'com a chave certa o corpo deve ser lido normalmente');
  assert.notEqual(payloadComChave?.error, undefined);

  console.log('v989-analisar-trava-sem-chave: ok (401 sem ler o corpo sem chave; passa da checagem com a chave certa)');
} finally {
  restaurarEnv();
}
