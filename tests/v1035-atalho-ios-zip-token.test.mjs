import assert from 'node:assert/strict';
import { resolveOrganizationIdByAtalhoToken, montarAtalhoZipToken } from '../api/_persistence.js';
import handler from '../api/receber-zip-atalho.js';

// v1035 — quem tem iPhone não consegue "compartilhar direto pro ícone" do Corretor Pro (a Apple
// não oferece isso pra apps instalados assim, só pra apps de verdade da App Store — ver
// NOTAS-v1035.md). Solução sem custo de loja de aplicativo: um Atalho (Shortcuts, já vem no
// iPhone) que o corretor cola uma chave pessoal dentro, e que manda o ZIP direto pra esta rota
// nova. Esta chave é assinada (HMAC) — nunca fica salva em texto puro, só o "issuedAt" de quando
// foi gerada. Estes testes provam: (1) a rota bloqueia ANTES de ler o corpo quando falta chave,
// a chave é inválida, ou o servidor não está configurado; (2) a lógica de assinatura/validade
// resolve a organização certa quando a chave é boa e rejeita quando foi revogada (issuedAt não
// bate mais) ou a conta está bloqueada.

function envBackup(chaves) {
  const antes = {};
  for (const c of chaves) antes[c] = process.env[c];
  return () => { for (const [c, v] of Object.entries(antes)) { if (v === undefined) delete process.env[c]; else process.env[c] = v; } };
}

function fakeRes() {
  const res = { statusCode: 200, payload: null };
  res.status = function (c) { this.statusCode = c; return this; };
  res.setHeader = function () {};
  res.end = function (corpo) { this.payload = corpo ? JSON.parse(corpo) : null; };
  return res;
}

function fakeReqSemCorpo(headers) {
  let corpoFoiLido = false;
  const req = {
    method: 'POST',
    headers,
    async *[Symbol.asyncIterator]() { corpoFoiLido = true; yield Buffer.from('zip que nunca deveria ser lido sem autenticação'); }
  };
  return { req, foiLido: () => corpoFoiLido };
}

const restaurarEnv = envBackup(['ATALHO_ZIP_TOKEN_SECRET']);

try {
  // ---------- 1. rota: sem token -> 401, corpo nunca lido ----------
  process.env.ATALHO_ZIP_TOKEN_SECRET = 'segredo-de-teste-v1035';
  {
    const { req, foiLido } = fakeReqSemCorpo({ 'content-type': 'application/zip' });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 401, 'sem a chave do Atalho, a rota precisa responder 401');
    assert.equal(res.payload?.ok, false);
    assert.equal(foiLido(), false, 'o ZIP não pode ser lido antes de confirmar a chave do Atalho');
  }

  // ---------- 2. rota: token com assinatura errada -> 401, corpo nunca lido ----------
  {
    const { req, foiLido } = fakeReqSemCorpo({ 'content-type': 'application/zip', 'x-corretor-pro-atalho-token': 'org-qualquer.123456.assinatura-forjada' });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 401, 'token com assinatura errada precisa responder 401');
    assert.equal(foiLido(), false, 'o ZIP não pode ser lido com uma assinatura inválida');
  }

  // ---------- 3. rota: servidor sem ATALHO_ZIP_TOKEN_SECRET configurado -> 500, corpo nunca lido ----------
  {
    delete process.env.ATALHO_ZIP_TOKEN_SECRET;
    const { req, foiLido } = fakeReqSemCorpo({ 'content-type': 'application/zip', 'x-corretor-pro-atalho-token': 'org.123456.abc' });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 500, 'sem ATALHO_ZIP_TOKEN_SECRET configurado, a rota precisa recusar (nunca abrir sem chave nenhuma)');
    assert.equal(foiLido(), false);
    process.env.ATALHO_ZIP_TOKEN_SECRET = 'segredo-de-teste-v1035';
  }

  // ---------- 4. lógica de assinatura: chave boa resolve a organização certa ----------
  {
    const organizationId = 'org-abc-123';
    const issuedAt = '1700000000000';
    const token = montarAtalhoZipToken(organizationId, issuedAt);
    assert.ok(token && token.startsWith(`${organizationId}.${issuedAt}.`), 'montarAtalhoZipToken precisa devolver organizationId.issuedAt.assinatura');

    const supabaseFake = {
      from(tabela) {
        if (tabela === 'direciona_config') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { valor: { issuedAt } }, error: null }) }) }) }) };
        }
        if (tabela === 'organizations') {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: 'ativo', trial_expira_em: null } }) }) }) };
        }
        throw new Error(`tabela inesperada: ${tabela}`);
      }
    };
    const req = { headers: { 'x-corretor-pro-atalho-token': token } };
    const res = fakeRes();
    const resolvido = await resolveOrganizationIdByAtalhoToken(req, res, { supabase: supabaseFake });
    assert.equal(resolvido, organizationId, 'com a chave certa e a organização em dia, precisa devolver o organizationId dela');
  }

  // ---------- 5. lógica de assinatura: chave revogada (issuedAt não bate mais) -> 401 ----------
  {
    const organizationId = 'org-abc-123';
    const token = montarAtalhoZipToken(organizationId, '1700000000000');
    const supabaseFake = {
      from(tabela) {
        if (tabela === 'direciona_config') {
          // outro issuedAt salvo = uma chave nova foi gerada depois, a antiga não vale mais.
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { valor: { issuedAt: '1800000000000' } }, error: null }) }) }) }) };
        }
        throw new Error(`tabela inesperada: ${tabela}`);
      }
    };
    const req = { headers: { 'x-corretor-pro-atalho-token': token } };
    const res = fakeRes();
    const resolvido = await resolveOrganizationIdByAtalhoToken(req, res, { supabase: supabaseFake });
    assert.equal(resolvido, null, 'uma chave que já foi trocada por outra (revogada) não pode continuar valendo');
    assert.equal(res.statusCode, 401);
  }

  // ---------- 6. lógica de assinatura: conta bloqueada -> 403 mesmo com chave válida ----------
  {
    const organizationId = 'org-abc-123';
    const issuedAt = '1700000000000';
    const token = montarAtalhoZipToken(organizationId, issuedAt);
    const supabaseFake = {
      from(tabela) {
        if (tabela === 'direciona_config') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { valor: { issuedAt } }, error: null }) }) }) }) };
        }
        if (tabela === 'organizations') {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: 'bloqueado', trial_expira_em: null } }) }) }) };
        }
        throw new Error(`tabela inesperada: ${tabela}`);
      }
    };
    const req = { headers: { 'x-corretor-pro-atalho-token': token } };
    const res = fakeRes();
    const resolvido = await resolveOrganizationIdByAtalhoToken(req, res, { supabase: supabaseFake });
    assert.equal(resolvido, null, 'conta bloqueada não pode importar nem com a chave certa');
    assert.equal(res.statusCode, 403);
    assert.equal(res.payload?.bloqueado, true);
  }

  console.log('v1035-atalho-ios-zip-token: ok');
} finally {
  restaurarEnv();
}
