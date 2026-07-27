import assert from 'node:assert/strict';
import { resolveOrganizationId } from '../api/_persistence.js';

// v1003 — a trava de "teste acabou/bloqueado" existia só na tela de login (entrar.html), que é
// checagem de cortesia: qualquer chamada direta à API com um token válido passava por cima.
// Agora o próprio servidor recusa a chamada de uma conta bloqueada ou com teste vencido.

function fakeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(codigo) { this.statusCode = codigo; return this; },
    setHeader() {},
    end(corpo) { this.payload = corpo ? JSON.parse(corpo) : null; }
  };
}

function fakeSupabase(org) {
  return {
    auth: { async getUser() { return { data: { user: { id: 'user-1' } }, error: null }; } },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit() { return this; },
        async maybeSingle() { return { data: { organization_id: 'org-1', organizations: org }, error: null }; }
      };
    }
  };
}

const req = { headers: { authorization: 'Bearer token-valido' } };

// 1. Conta bloqueada pelo administrador → 403, nunca resolve a organização.
{
  const res = fakeRes();
  const orgId = await resolveOrganizationId(req, res, { supabase: fakeSupabase({ status: 'bloqueado', trial_expira_em: null }) });
  assert.equal(orgId, null, 'conta bloqueada não pode resolver organização');
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload?.bloqueado, true);
}

// 2. Teste grátis vencido → 403 com a mensagem de pagamento.
{
  const res = fakeRes();
  const ontem = new Date(Date.now() - 86400000).toISOString();
  const orgId = await resolveOrganizationId(req, res, { supabase: fakeSupabase({ status: 'teste', trial_expira_em: ontem }) });
  assert.equal(orgId, null, 'teste vencido não pode resolver organização');
  assert.equal(res.statusCode, 403);
  assert.match(String(res.payload?.error || ''), /teste grátis acabou/i);
}

// 3. Teste ainda dentro do prazo → passa normalmente.
{
  const res = fakeRes();
  const amanha = new Date(Date.now() + 86400000).toISOString();
  const orgId = await resolveOrganizationId(req, res, { supabase: fakeSupabase({ status: 'teste', trial_expira_em: amanha }) });
  assert.equal(orgId, 'org-1', 'teste dentro do prazo precisa passar');
  assert.equal(res.payload, null);
}

// 4. Assinatura ativa (pagou) → passa, mesmo com trial antigo no passado.
{
  const res = fakeRes();
  const passado = new Date(Date.now() - 30 * 86400000).toISOString();
  const orgId = await resolveOrganizationId(req, res, { supabase: fakeSupabase({ status: 'ativo', trial_expira_em: passado }) });
  assert.equal(orgId, 'org-1', 'conta ativa (paga) precisa passar mesmo com data de teste antiga');
}

console.log('v1003-conta-bloqueada-trava-no-servidor: ok');
