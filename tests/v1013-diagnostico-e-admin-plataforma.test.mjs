import fs from 'node:fs';
import assert from 'node:assert/strict';
import { getPlatformAdminUserId, requirePlatformAdmin } from '../api/_persistence.js';

// v1013 — auditoria de isolamento multi-conta encontrou api/diagnostico.js liberado pra
// QUALQUER corretor autenticado (não só o administrador da plataforma): mode=openai rodava
// chamadas reais (e pagas) à OpenAI, mode=bucket reconfigurava o bucket de Storage inteiro
// (infraestrutura compartilhada por todas as contas) e mode=status/openai revelavam prefixo/
// final da chave OpenAI e organização/projeto pra qualquer conta em dia. Corrigido: mode=bucket
// agora exige administrador da plataforma; mode=status/openai continuam abertos a qualquer
// corretor autenticado (telas reais do app dependem disso pra checar se a IA está respondendo),
// mas os campos sensíveis (prefixo/final da chave, organização, projeto) só aparecem pra quem é
// administrador.

function fakeRes() {
  return {
    _status: null, _payload: null,
    status(s) { this._status = s; return this; },
    setHeader() {},
    end(body) { this._payload = JSON.parse(body); }
  };
}

function fakeSupabaseAdmin(userId) {
  return {
    auth: { async getUser() { return { data: { user: userId ? { id: userId } : null } }; } }
  };
}

function fakeSupabaseComPapel(userId, ehAdmin) {
  return {
    auth: { async getUser() { return { data: { user: { id: userId } } }; } },
    from(tabela) {
      assert.equal(tabela, 'platform_admins');
      return {
        select() { return this; },
        eq(_col, id) { this._id = id; return this; },
        async maybeSingle() { return { data: ehAdmin && this._id === userId ? { user_id: userId } : null }; }
      };
    }
  };
}

// 1. Sem cabeçalho Authorization → nunca é admin.
{
  const req = { headers: {} };
  const admin = await getPlatformAdminUserId(req, fakeSupabaseComPapel('u1', true));
  assert.equal(admin, '', 'sem token Bearer, getPlatformAdminUserId devolve vazio');
}

// 2. Token válido, mas usuário NÃO está em platform_admins → não é admin.
{
  const req = { headers: { authorization: 'Bearer token-corretor-comum' } };
  const admin = await getPlatformAdminUserId(req, fakeSupabaseComPapel('u-corretor', false));
  assert.equal(admin, '', 'usuário autenticado sem registro em platform_admins não é admin');
}

// 3. Token válido e usuário EM platform_admins → é admin (devolve o próprio user_id).
{
  const req = { headers: { authorization: 'Bearer token-admin' } };
  const admin = await getPlatformAdminUserId(req, fakeSupabaseComPapel('u-admin', true));
  assert.equal(admin, 'u-admin', 'usuário em platform_admins é reconhecido como admin');
}

// 4. requirePlatformAdmin bloqueia com 403 quem não é admin, e não bloqueia quem é.
{
  const res1 = fakeRes();
  const bloqueado = await requirePlatformAdmin({ headers: {} }, res1, fakeSupabaseComPapel('u1', true));
  assert.equal(bloqueado, null, 'sem token, requirePlatformAdmin devolve null (bloqueou)');
  assert.equal(res1._status, 403, 'resposta de bloqueio usa status 403');

  const res2 = fakeRes();
  const liberado = await requirePlatformAdmin(
    { headers: { authorization: 'Bearer token-admin' } }, res2, fakeSupabaseComPapel('u-admin', true)
  );
  assert.equal(liberado, 'u-admin', 'admin de verdade passa e recebe o próprio user_id');
  assert.equal(res2._status, null, 'nenhuma resposta de erro é escrita quando é admin');
}

// 5. Falha ao consultar (ex.: token quebrado) nunca lança — devolve vazio (fail-closed).
{
  const req = { headers: { authorization: 'Bearer qualquer' } };
  const supabaseQuebrado = { auth: { async getUser() { throw new Error('rede fora'); } } };
  const admin = await getPlatformAdminUserId(req, supabaseQuebrado);
  assert.equal(admin, '', 'erro ao consultar nunca lança e nunca libera acesso por engano');
}

// 6. api/diagnostico.js: mode=bucket precisa checar administrador ANTES de chamar modoBucket,
// e mode=status/openai precisam calcular isAdmin e propagar pra modoStatus/modoOpenAI (sem
// bloquear o acesso básico, que é usado por telas reais do app).
const diagSrc = fs.readFileSync(new URL('../api/diagnostico.js', import.meta.url), 'utf8');
assert.match(diagSrc, /getPlatformAdminUserId/, 'diagnostico.js precisa usar getPlatformAdminUserId');
const blocoBucket = diagSrc.slice(diagSrc.indexOf('if (mode === "bucket")'), diagSrc.indexOf('mode=status/openai continuam'));
assert.match(blocoBucket, /if \(!admin\) return json\(res, 403/, 'mode=bucket bloqueia com 403 quem não é admin');
assert.match(diagSrc, /modoOpenAI\(res, !!admin\)/, 'mode=openai recebe a flag de admin calculada');
assert.match(diagSrc, /modoStatus\(res, !!admin\)/, 'mode=status recebe a flag de admin calculada');
assert.match(diagSrc, /OPENAI_KEY_PREFIX: isAdmin \? openai\.keyPrefix : undefined/, 'prefixo da chave só aparece pra admin em mode=status');
assert.match(diagSrc, /keyPrefix: undefined, keyTail: undefined, organization: undefined, project: undefined/, 'mode=openai redige os mesmos campos sensíveis pra quem não é admin');

// 7. api/admin-contas.js reaproveita o mesmo helper (uma só implementação da checagem de admin).
const adminContasSrc = fs.readFileSync(new URL('../api/admin-contas.js', import.meta.url), 'utf8');
assert.match(adminContasSrc, /requirePlatformAdmin\(req, res, supabase\)/, 'admin-contas.js usa o helper compartilhado, não uma checagem duplicada');

console.log('v1013-diagnostico-e-admin-plataforma: ok');
