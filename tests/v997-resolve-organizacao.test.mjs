import assert from 'node:assert/strict';
import { resolveOrganizationId, EMPRESA_PRINCIPAL_ID } from '../api/_persistence.js';

// v997 — primeiro passo pra cada corretor só ver os próprios clientes: um jeito de descobrir,
// numa chamada da API, de qual conta ela é. Ainda não é usado por nenhuma rota (isso vem nas
// próximas versões, tabela por tabela) — este teste só prova que a lógica do helper está certa
// antes de ligá-lo em qualquer lugar que toca dado real.

function fakeRes() {
  const res = {
    statusCode: 200,
    payload: null,
    status(codigo) { this.statusCode = codigo; return this; },
    setHeader() {},
    end(corpo) { this.payload = corpo ? JSON.parse(corpo) : null; }
  };
  return res;
}

const envAntes = {
  NODE_ENV: process.env.NODE_ENV,
  npm_lifecycle_event: process.env.npm_lifecycle_event,
  CORRETOR_PRO_API_KEY: process.env.CORRETOR_PRO_API_KEY
};
function restaurarEnv() {
  for (const [chave, valor] of Object.entries(envAntes)) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
}

async function principal() {
  // 1. Token de sessão válido + vínculo encontrado → resolve pra empresa daquele usuário.
  {
    const supabaseFake = {
      auth: { async getUser(token) {
        assert.equal(token, 'token-valido');
        return { data: { user: { id: 'user-123' } }, error: null };
      } },
      from(tabela) {
        assert.equal(tabela, 'memberships');
        return {
          select() { return this; },
          eq(coluna, valor) { assert.equal(coluna, 'user_id'); assert.equal(valor, 'user-123'); return this; },
          limit() { return this; },
          async maybeSingle() { return { data: { organization_id: 'org-da-juliana' }, error: null }; }
        };
      }
    };
    const req = { headers: { authorization: 'Bearer token-valido' } };
    const res = fakeRes();
    const orgId = await resolveOrganizationId(req, res, { supabase: supabaseFake });
    assert.equal(orgId, 'org-da-juliana', 'com token válido, precisa devolver a empresa vinculada ao usuário do token, não a principal');
    assert.equal(res.payload, null, 'não deve escrever nenhuma resposta de erro quando dá certo');
  }

  // 2. Token de sessão inválido/expirado → 401, nunca cai pra empresa principal por engano.
  {
    const supabaseFake = { auth: { async getUser() { return { data: null, error: { message: 'jwt expired' } }; } } };
    const req = { headers: { authorization: 'Bearer token-invalido' } };
    const res = fakeRes();
    const orgId = await resolveOrganizationId(req, res, { supabase: supabaseFake });
    assert.equal(orgId, null, 'token inválido não pode resolver empresa nenhuma');
    assert.equal(res.statusCode, 401);
    assert.equal(res.payload?.ok, false);
  }

  // 3. Token válido, mas o usuário não tem vínculo com nenhuma empresa → 403, não vaza pra principal.
  {
    const supabaseFake = {
      auth: { async getUser() { return { data: { user: { id: 'user-sem-vinculo' } }, error: null }; } },
      from() { return { select() { return this; }, eq() { return this; }, limit() { return this; }, async maybeSingle() { return { data: null, error: null }; } }; }
    };
    const req = { headers: { authorization: 'Bearer token-sem-vinculo' } };
    const res = fakeRes();
    const orgId = await resolveOrganizationId(req, res, { supabase: supabaseFake });
    assert.equal(orgId, null);
    assert.equal(res.statusCode, 403);
  }

  // 4. Sem token de sessão, com a chave compartilhada de sempre → cai no caminho antigo (empresa principal).
  {
    delete process.env.NODE_ENV;
    delete process.env.npm_lifecycle_event;
    process.env.CORRETOR_PRO_API_KEY = 'chave-de-teste-v997-nao-usar-em-producao';
    const req = { headers: { 'x-corretor-pro-key': 'chave-de-teste-v997-nao-usar-em-producao' } };
    const res = fakeRes();
    const orgId = await resolveOrganizationId(req, res, {});
    assert.equal(orgId, EMPRESA_PRINCIPAL_ID, 'sem login novo, a chamada continua caindo na empresa original — comportamento de hoje não muda');
  }

  // 5. Sem token de sessão e sem a chave certa → 401, igual já era antes deste helper existir.
  {
    const req = { headers: {} };
    const res = fakeRes();
    const orgId = await resolveOrganizationId(req, res, {});
    assert.equal(orgId, null);
    assert.equal(res.statusCode, 401);
  }

  console.log('v997-resolve-organizacao: ok');
}

try {
  await principal();
} finally {
  restaurarEnv();
}
