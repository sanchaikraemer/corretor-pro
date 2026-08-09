import assert from "node:assert/strict";
import { resolveOrganizationId, requireApiKey, EMPRESA_PRINCIPAL_ID } from "../api/_persistence.js";

// v1092 — auditoria do acesso legado por chave compartilhada (CORRETOR_PRO_API_KEY / API_SECRET /
// CP_API_SECRET) e de ALLOW_UNPROTECTED_API.
//
// O caminho antigo existe desde antes das contas por login. Ele não foi removido porque o Atalho
// do iPhone e aparelhos antigos da conta original ainda podem depender dele — mas ele precisa ter
// limites duros, e é isso que este teste tranca.

const ambienteOriginal = { ...process.env };
function restaurar() {
  for (const k of Object.keys(process.env)) if (!(k in ambienteOriginal)) delete process.env[k];
  Object.assign(process.env, ambienteOriginal);
}
// requireApiKey libera de cara em modo de teste; pra exercitar as regras de verdade, o ambiente
// precisa deixar de se declarar "teste" dentro de cada cenário.
function comoProducao(extra = {}) {
  delete process.env.NODE_ENV;
  delete process.env.npm_lifecycle_event;
  process.env.VERCEL_ENV = "production";
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}
function respostaFalsa() {
  const r = { statusCode: 0, corpo: null, headers: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; return r; };
  r.end = (b) => { try { r.corpo = JSON.parse(b); } catch (_) { r.corpo = b; } return r; };
  return r;
}

try {
  // ── 1. Chave compartilhada SEMPRE resolve pra empresa principal, nunca pra outra ─────────────
  // Esta é a garantia central: mesmo que alguém mande um organization_id no corpo, na query ou
  // num cabeçalho, a chave compartilhada nunca alcança outra conta.
  {
    process.env.NODE_ENV = "test"; // requireApiKey libera; o que interessa aqui é a RESOLUÇÃO
    const tentativas = [
      { headers: {}, body: { organization_id: "empresa-de-outro-corretor" } },
      { headers: { "x-organization-id": "empresa-de-outro-corretor" }, body: {} },
      { headers: {}, query: { organization_id: "empresa-de-outro-corretor" }, body: {} },
      { headers: {}, body: { organizationId: "empresa-de-outro-corretor" } }
    ];
    for (const req of tentativas) {
      const res = respostaFalsa();
      const org = await resolveOrganizationId({ method: "POST", ...req }, res);
      assert.equal(org, EMPRESA_PRINCIPAL_ID,
        `sem login, a empresa é SEMPRE a principal — veio "${org}" com ${JSON.stringify(req.body || req.headers)}`);
      assert.notEqual(org, "empresa-de-outro-corretor",
        "um organization_id mandado pelo navegador NUNCA pode ser aceito");
    }
  }

  // ── 2. v1190 — EM PRODUÇÃO O CAMINHO ANTIGO NASCE DESLIGADO ─────────────────────────────────
  // Até a v1189 a segurança dependia de alguém LEMBRAR de marcar CORRETOR_PRO_LEGADO_DESLIGADO=sim
  // na Vercel. Quem esquecesse ficava com a porta antiga aberta — e toda chamada por ela é tratada
  // como sendo da conta original (os dados do próprio dono). O padrão se inverteu: em produção só
  // entra com login, a menos que CORRETOR_PRO_LEGADO_ATIVO=sim seja definido de propósito.
  {
    comoProducao({ CORRETOR_PRO_API_KEY: "chave-secreta-de-verdade", CORRETOR_PRO_LEGADO_ATIVO: undefined, CORRETOR_PRO_LEGADO_DESLIGADO: undefined });
    const res = respostaFalsa();
    assert.equal(requireApiKey({ headers: { "x-corretor-pro-key": "chave-secreta-de-verdade" } }, res), false,
      "em produção, sem opt-in explícito, nem a chave certa entra");
    assert.equal(res.statusCode, 401);
    assert.match(res.corpo.error, /Entre com sua conta/i, "o aviso precisa dizer o que fazer");
  }

  // ── 3. Sem nenhuma variável ligada, requisição sem credencial nenhuma também é recusada ──────
  {
    comoProducao({ CORRETOR_PRO_API_KEY: undefined, API_SECRET: undefined, CP_API_SECRET: undefined, ALLOW_UNPROTECTED_API: "true", CORRETOR_PRO_LEGADO_ATIVO: undefined });
    const res = respostaFalsa();
    assert.equal(requireApiKey({ headers: {} }, res), false,
      "em produção, sem login, a API recusa — nem ALLOW_UNPROTECTED_API abre");
    assert.equal(res.statusCode, 401);
  }

  // ── 4. Com o opt-in explícito, o caminho antigo volta a funcionar (pra não travar ninguém) ────
  {
    comoProducao({ CORRETOR_PRO_API_KEY: "chave-secreta-de-verdade", CORRETOR_PRO_LEGADO_ATIVO: "sim", CORRETOR_PRO_LEGADO_DESLIGADO: undefined });
    const errada = respostaFalsa();
    assert.equal(requireApiKey({ headers: { "x-corretor-pro-key": "chave-chutada" } }, errada), false, "chave errada continua recusada");
    assert.equal(errada.statusCode, 401);
    const certa = respostaFalsa();
    assert.equal(requireApiKey({ headers: { "x-corretor-pro-key": "chave-secreta-de-verdade" } }, certa), true,
      "com CORRETOR_PRO_LEGADO_ATIVO=sim, a chave certa passa");
  }

  // ── 5. Com o opt-in ligado mas SEM chave configurada, a API não abre sozinha ──────────────────
  {
    comoProducao({ CORRETOR_PRO_API_KEY: undefined, API_SECRET: undefined, CP_API_SECRET: undefined, ALLOW_UNPROTECTED_API: undefined, CORRETOR_PRO_LEGADO_ATIVO: "sim" });
    const res = respostaFalsa();
    assert.equal(requireApiKey({ headers: {} }, res), false, "sem chave em produção, a API precisa recusar");
    assert.equal(res.statusCode, 500);
    assert.match(res.corpo.error, /configure CORRETOR_PRO_API_KEY/i);
  }

  // ── 6. ALLOW_UNPROTECTED_API continua sem valer em produção, mesmo com o opt-in ───────────────
  // Era o buraco original: sem chave e com essa variável ligada, qualquer pessoa na internet agia
  // como a conta original — porque toda chamada sem login é tratada como sendo dela.
  {
    comoProducao({ CORRETOR_PRO_API_KEY: undefined, ALLOW_UNPROTECTED_API: "true", CORRETOR_PRO_LEGADO_ATIVO: "sim" });
    const res = respostaFalsa();
    assert.equal(requireApiKey({ headers: {} }, res), false,
      "ALLOW_UNPROTECTED_API não pode abrir a API em produção");
    assert.match(res.corpo.error, /não vale em produção/i);
    assert.match(res.corpo.error, /sem login/i, "o erro precisa explicar o risco");
  }

  // ── 7. Fora de produção o caminho antigo continua valendo sem opt-in (é onde ele serve) ──────
  {
    comoProducao({ CORRETOR_PRO_API_KEY: undefined, ALLOW_UNPROTECTED_API: "true", CORRETOR_PRO_LEGADO_ATIVO: undefined });
    delete process.env.VERCEL_ENV;
    const res = respostaFalsa();
    assert.equal(requireApiKey({ headers: {} }, res), true,
      "em desenvolvimento a API pode rodar sem chave");
  }

  // ── 8. O interruptor da v1092 continua valendo, e vence até o opt-in novo ────────────────────
  {
    comoProducao({ CORRETOR_PRO_API_KEY: "chave-secreta-de-verdade", CORRETOR_PRO_LEGADO_ATIVO: "sim", CORRETOR_PRO_LEGADO_DESLIGADO: "sim" });
    const res = respostaFalsa();
    assert.equal(requireApiKey({ headers: { "x-corretor-pro-key": "chave-secreta-de-verdade" } }, res), false,
      "com o interruptor ligado, nem a chave certa entra");
    assert.equal(res.statusCode, 401);
    assert.match(res.corpo.error, /Entre com sua conta/i, "o aviso precisa dizer o que fazer");
  }
} finally {
  restaurar();
}

console.log("v1092-chave-compartilhada-so-empresa-principal: ok");
