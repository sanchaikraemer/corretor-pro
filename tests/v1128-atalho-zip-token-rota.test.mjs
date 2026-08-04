import assert from 'node:assert/strict';
import handler from '../api/atalho-zip-token.js';
import { montarAtalhoZipToken, ATALHO_ZIP_TOKEN_CHAVE } from '../api/_persistence.js';

// v1128 — a auditoria completa encontrou api/atalho-zip-token.js SEM teste próprio. É a rota que
// gera (e mostra de novo) a chave pessoal que o corretor cola dentro do Atalho do iPhone pra mandar
// o ZIP do WhatsApp direto pro Corretor Pro. Duas coisas aqui são delicadas e não tinham guarda
// nenhuma: (a) a chave é a credencial de envio daquela conta — se a rota devolvesse a chave de
// outra empresa, um corretor mandaria conversa pra dentro da conta alheia; (b) "mostrar" não pode
// criar chave sozinha, senão qualquer visita à tela geraria credencial nova sem o dono pedir.
//
// O que fica provado aqui:
//   1. sem login válido, a rota não devolve chave nenhuma;
//   2. "mostrar" numa conta que nunca gerou chave devolve token nulo — sem criar nada;
//   3. "mostrar" numa conta que já gerou devolve a MESMA chave (não troca a cada visita);
//   4. "gerar" grava o novo horário e a chave nova é diferente da anterior (a antiga morre);
//   5. a chave é sempre a da empresa de quem chamou — nunca a de outra;
//   6. sem o segredo configurado no servidor, a rota avisa em vez de devolver chave quebrada.

function fakeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(codigo) { this.statusCode = codigo; return this; },
    setHeader() {},
    end(corpo) { this.payload = corpo ? JSON.parse(corpo) : null; }
  };
}

const antesSegredo = process.env.ATALHO_ZIP_TOKEN_SECRET;
const antesUrl = process.env.SUPABASE_URL;
const antesChave = process.env.SUPABASE_SERVICE_ROLE_KEY;

// O handler resolve a empresa e o Supabase por dentro (não aceita injeção), então este teste
// substitui o que ele importa pelo caminho que o próprio projeto já usa: variáveis de ambiente
// apontando pra um Supabase de mentira servido em memória, via um "fetch" trocado.
function ligarSupabaseDeMentira({ organizationId = 'org-1', issuedAtSalvo = null } = {}) {
  const estado = { issuedAt: issuedAtSalvo, upserts: [] };
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, opcoes = {}) => {
    const endereco = String(url);
    const corpo = (texto) => new Response(texto, { status: 200, headers: { 'Content-Type': 'application/json' } });

    // Confere o token de login e devolve o usuário.
    if (endereco.includes('/auth/v1/user')) {
      const autorizacao = String(opcoes.headers?.Authorization || opcoes.headers?.authorization || '');
      if (!autorizacao.includes('token-valido')) return new Response(JSON.stringify({ msg: 'invalid' }), { status: 401 });
      return corpo(JSON.stringify({ id: 'user-1', aud: 'authenticated', email: 'c@exemplo.com' }));
    }
    // Vínculo do usuário com a empresa (resolveOrganizationId).
    if (endereco.includes('/rest/v1/memberships')) {
      return corpo(JSON.stringify({ organization_id: organizationId, organizations: { status: 'ativo', trial_expira_em: null } }));
    }
    // Leitura/gravação do horário em que a chave foi gerada.
    if (endereco.includes('/rest/v1/direciona_config')) {
      if ((opcoes.method || 'GET').toUpperCase() === 'GET') {
        return corpo(estado.issuedAt ? JSON.stringify({ valor: { issuedAt: estado.issuedAt } }) : 'null');
      }
      const enviado = JSON.parse(opcoes.body || '{}');
      const linha = Array.isArray(enviado) ? enviado[0] : enviado;
      estado.upserts.push(linha);
      estado.issuedAt = linha?.valor?.issuedAt || estado.issuedAt;
      return corpo(JSON.stringify([linha]));
    }
    return corpo('null');
  };
  return { estado, desligar: () => { globalThis.fetch = fetchOriginal; } };
}

process.env.SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-servico-de-mentira';
process.env.ATALHO_ZIP_TOKEN_SECRET = 'segredo-de-teste-v1128';

const reqLogado = (extra = {}) => ({ method: 'GET', headers: { authorization: 'Bearer token-valido' }, query: {}, ...extra });

try {
  // ---------- 1. sem login válido -> não devolve chave ----------
  {
    const { desligar } = ligarSupabaseDeMentira();
    const res = fakeRes();
    await handler({ method: 'GET', headers: { authorization: 'Bearer token-forjado' }, query: {} }, res);
    assert.equal(res.statusCode, 401, 'token que o Supabase recusa não pode receber chave do Atalho');
    assert.ok(!res.payload?.token, 'nenhuma chave pode ser devolvida sem login válido');
    desligar();
  }

  // ---------- 2. "mostrar" sem chave gerada antes -> token nulo, sem criar nada ----------
  {
    const { estado, desligar } = ligarSupabaseDeMentira({ issuedAtSalvo: null });
    const res = fakeRes();
    await handler(reqLogado(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload?.ok, true);
    assert.equal(res.payload?.token, null, 'quem nunca gerou chave precisa receber "nenhuma chave ainda"');
    assert.deepEqual(estado.upserts, [], 'só abrir a tela NUNCA pode gerar uma chave sozinha');
    desligar();
  }

  // ---------- 3. "mostrar" com chave já gerada -> sempre a mesma ----------
  {
    const { estado, desligar } = ligarSupabaseDeMentira({ issuedAtSalvo: '1700000000000' });
    const primeira = fakeRes();
    await handler(reqLogado(), primeira);
    const segunda = fakeRes();
    await handler(reqLogado(), segunda);
    assert.ok(primeira.payload?.token, 'quem já gerou precisa conseguir ver a chave de novo');
    assert.equal(primeira.payload.token, segunda.payload.token, 'ver a chave duas vezes precisa dar a MESMA chave');
    assert.equal(primeira.payload.token, montarAtalhoZipToken('org-1', '1700000000000'), 'a chave precisa ser a da empresa de quem chamou');
    assert.deepEqual(estado.upserts, [], 'mostrar não grava nada');
    desligar();
  }

  // ---------- 4. "gerar" cria chave nova e mata a anterior ----------
  {
    const { estado, desligar } = ligarSupabaseDeMentira({ issuedAtSalvo: '1700000000000' });
    const anterior = montarAtalhoZipToken('org-1', '1700000000000');
    const res = fakeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer token-valido' }, query: {}, body: { action: 'gerar' } }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.payload?.token, 'gerar precisa devolver a chave nova');
    assert.notEqual(res.payload.token, anterior, 'gerar de novo precisa invalidar a chave antiga');
    assert.equal(estado.upserts.length, 1, 'gerar grava o novo horário uma vez');
    assert.equal(estado.upserts[0].chave, ATALHO_ZIP_TOKEN_CHAVE);
    assert.ok(estado.upserts[0].valor?.issuedAt, 'o horário da geração precisa ser gravado');
    desligar();
  }

  // ---------- 5. cada empresa recebe a SUA chave ----------
  {
    const a = ligarSupabaseDeMentira({ organizationId: 'org-A', issuedAtSalvo: '1700000000000' });
    const resA = fakeRes();
    await handler(reqLogado(), resA);
    a.desligar();

    const b = ligarSupabaseDeMentira({ organizationId: 'org-B', issuedAtSalvo: '1700000000000' });
    const resB = fakeRes();
    await handler(reqLogado(), resB);
    b.desligar();

    assert.ok(resA.payload?.token && resB.payload?.token);
    assert.notEqual(resA.payload.token, resB.payload.token, 'duas empresas NUNCA podem receber a mesma chave de envio');
    assert.ok(resA.payload.token.startsWith('org-A.'), 'a chave precisa ser a da empresa de quem chamou');
    assert.ok(resB.payload.token.startsWith('org-B.'));
  }

  // ---------- 6. sem o segredo do servidor -> avisa em vez de devolver chave quebrada ----------
  {
    delete process.env.ATALHO_ZIP_TOKEN_SECRET;
    const { desligar } = ligarSupabaseDeMentira({ issuedAtSalvo: '1700000000000' });
    const res = fakeRes();
    await handler(reqLogado(), res);
    assert.equal(res.statusCode, 500, 'sem o segredo configurado, a rota precisa avisar');
    assert.match(String(res.payload?.error || ''), /ATALHO_ZIP_TOKEN_SECRET/, 'o aviso precisa dizer o que falta configurar');
    desligar();
    process.env.ATALHO_ZIP_TOKEN_SECRET = 'segredo-de-teste-v1128';
  }

  console.log('v1128-atalho-zip-token-rota: ok');
} finally {
  if (antesSegredo === undefined) delete process.env.ATALHO_ZIP_TOKEN_SECRET; else process.env.ATALHO_ZIP_TOKEN_SECRET = antesSegredo;
  if (antesUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = antesUrl;
  if (antesChave === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = antesChave;
}
