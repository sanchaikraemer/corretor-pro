import assert from 'node:assert/strict';
import handler from '../api/criar-conta.js';
import { impressaoDaConexao, limiteCadastrosPorConexaoDia } from '../api/_persistence.js';

// v1128 — a confirmação de e-mail no cadastro foi descartada por decisão do dono: quem se cadastra
// entra na hora e usa os 7 dias de teste, e a venda é fechada depois por telefone. Só que a
// confirmação de e-mail era, na prática, o que segurava robô criando conta com e-mail inventado —
// e cada conta em teste gasta IA de verdade (crédito pago pelo dono). A trava que entrou no lugar
// não pede NADA de quem se cadastra: o servidor conta quantas contas nasceram da mesma conexão de
// internet nas últimas 24h e recusa a partir de um limite folgado.
//
// Estes testes provam:
//   1. sem login, a rota não cria nada (401) — ninguém abre empresa sem se cadastrar antes;
//   2. login válido e conexão limpa -> cria a empresa e registra o cadastro no contador;
//   3. conexão que já estourou o limite -> 429 e NENHUMA empresa criada;
//   4. quem JÁ tem empresa recebe a que existe, sem criar outra e SEM gastar tentativa da conexão
//      (é o primeiro login de quem se cadastrou antes — não pode ser confundido com cadastro novo);
//   5. migração 0013 ainda não aplicada -> responde 501 com migracaoPendente, que é o sinal pro
//      navegador cair no caminho antigo em vez de deixar alguém sem conseguir se cadastrar;
//   6. o endereço de internet NUNCA vai pro banco em texto puro — só uma impressão embaralhada.
//
// v1186 — a trava virou UMA OPERAÇÃO SÓ no banco (migração 0018,
// `criar_empresa_com_limite_de_conexao`). Antes eram quatro passos separados e, entre o "conta" e
// o "registra", cinco pedidos simultâneos da mesma conexão liam "4" e todos passavam. Num
// Postgres 16 de verdade, com limite 5: o caminho antigo criou OITO contas, o novo criou CINCO.
// Estes testes cobrem os dois caminhos — o novo e o antigo, que continua valendo enquanto a 0018
// não for aplicada (a trava segue no servidor, só perde a exatidão sob simultaneidade).

function fakeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(codigo) { this.statusCode = codigo; return this; },
    setHeader() {},
    end(corpo) { this.payload = corpo ? JSON.parse(corpo) : null; }
  };
}

function fakeReq({ ip = '203.0.113.9', token = 'token-valido', corpo = {} } = {}) {
  return {
    method: 'POST',
    headers: { authorization: token ? 'Bearer ' + token : undefined, 'x-forwarded-for': ip },
    body: corpo
  };
}

// Supabase de mentira: memberships (o login já tem empresa?), cadastros_por_conexao (o contador)
// e as funções de criar empresa. Anota tudo que foi chamado pra os testes conferirem.
//   temAtomica  = a migração 0018 está aplicada (função criar_empresa_com_limite_de_conexao)
//   funcaoExiste = a migração 0013 está aplicada (função criar_empresa_e_dono_para)
function fakeSupabase({ vinculoExistente = null, cadastrosNaConexao = 0, funcaoExiste = true, temAtomica = true, usuario = 'user-1' } = {}) {
  const registro = { inserts: [], rpcs: [] };
  const cliente = {
    registro,
    auth: {
      async getUser(bearer) {
        if (bearer !== 'token-valido') return { data: { user: null }, error: new Error('token ruim') };
        return { data: { user: { id: usuario, email: 'corretor@exemplo.com', user_metadata: { nome_empresa: 'Imobiliária Teste' } } }, error: null };
      }
    },
    from(tabela) {
      if (tabela === 'memberships') {
        return {
          select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
          async maybeSingle() { return { data: vinculoExistente ? { organization_id: vinculoExistente } : null, error: null }; }
        };
      }
      if (tabela === 'cadastros_por_conexao') {
        return {
          select() { return this; },
          eq() { return this; },
          async gte() { return { count: cadastrosNaConexao, error: null }; },
          async insert(linha) { registro.inserts.push(linha); return { error: null }; }
        };
      }
      throw new Error('tabela inesperada no teste: ' + tabela);
    },
    async rpc(nome, args) {
      registro.rpcs.push({ nome, args });
      if (nome === 'limpar_cadastros_por_conexao_antigos') return { data: 0, error: null };
      if (nome === 'criar_empresa_com_limite_de_conexao') {
        if (!temAtomica) return { data: null, error: { message: 'Could not find the function public.criar_empresa_com_limite_de_conexao in the schema cache' } };
        // A trava mora DENTRO da função: contar e recusar é trabalho do banco, na mesma transação.
        if (Number(cadastrosNaConexao) >= Number(args.p_limite)) {
          return { data: null, error: { code: 'CP429', message: 'Já foram abertas ' + args.p_limite + ' contas novas desta conexão de internet hoje.' } };
        }
        registro.inserts.push({ conexao_hash: args.p_conexao_hash, organization_id: 'org-nova-1' });
        return { data: 'org-nova-1', error: null };
      }
      if (!funcaoExiste) return { data: null, error: { message: 'Could not find the function public.criar_empresa_e_dono_para in the schema cache' } };
      return { data: 'org-nova-1', error: null };
    }
  };
  return cliente;
}

// ---------- 1. sem login -> 401, nada criado ----------
{
  const supabase = fakeSupabase();
  const res = fakeRes();
  await handler(fakeReq({ token: null }), res, { supabase });
  assert.equal(res.statusCode, 401, 'sem login, criar empresa precisa responder 401');
  assert.equal(res.payload?.ok, false);
  assert.deepEqual(supabase.registro.rpcs, [], 'sem login, nenhuma empresa pode ser criada');
}

// ---------- 1b. token inválido -> 401 ----------
{
  const supabase = fakeSupabase();
  const res = fakeRes();
  await handler(fakeReq({ token: 'token-forjado' }), res, { supabase });
  assert.equal(res.statusCode, 401, 'token que o Supabase não reconhece precisa responder 401');
  assert.deepEqual(supabase.registro.rpcs, [], 'token inválido não pode criar empresa');
}

// ---------- 2. caminho normal: cria a empresa e conta o cadastro ----------
{
  const supabase = fakeSupabase({ cadastrosNaConexao: 0 });
  const res = fakeRes();
  await handler(fakeReq({ corpo: { nome: 'Imobiliária Sanchai', telefone: '(51) 99999-9999', cidade: 'Porto Alegre', estado: 'RS' } }), res, { supabase });
  assert.equal(res.statusCode, 200, 'cadastro normal precisa passar');
  assert.equal(res.payload?.ok, true);
  assert.equal(res.payload?.organizationId, 'org-nova-1');
  const criacoes = supabase.registro.rpcs.filter(r => r.nome !== 'limpar_cadastros_por_conexao_antigos');
  assert.equal(criacoes.length, 1, 'precisa criar a empresa uma única vez');
  assert.equal(criacoes[0].nome, 'criar_empresa_com_limite_de_conexao', 'o caminho normal é a operação única da 0018');
  assert.equal(criacoes[0].args.p_conexao_hash?.length >= 16, true, 'a trava precisa receber a impressão da conexão');
  supabase.registro.rpcs = criacoes;
  assert.equal(supabase.registro.rpcs[0].args.p_user_id, 'user-1', 'o dono da empresa vem do token conferido, nunca do que o navegador mandou');
  assert.equal(supabase.registro.rpcs[0].args.p_nome, 'Imobiliária Sanchai');
  assert.equal(supabase.registro.rpcs[0].args.p_telefone, '(51) 99999-9999');
  assert.equal(supabase.registro.inserts.length, 1, 'o cadastro precisa ser somado ao contador da conexão');
}

// ---------- 3. conexão que já estourou o limite -> 429 e nada criado ----------
{
  const limite = limiteCadastrosPorConexaoDia();
  const supabase = fakeSupabase({ cadastrosNaConexao: limite });
  const res = fakeRes();
  await handler(fakeReq(), res, { supabase });
  assert.equal(res.statusCode, 429, 'passando do limite da conexão, a rota precisa recusar');
  assert.equal(res.payload?.limiteConexao, true);
  assert.match(String(res.payload?.error || ''), /WhatsApp/i, 'a recusa precisa dizer como falar com a gente, não só barrar');
  assert.deepEqual(supabase.registro.inserts, [], 'tentativa recusada não entra no contador');
  assert.ok(supabase.registro.rpcs.every(r => r.nome !== 'criar_empresa_e_dono_para'),
    'no limite, NENHUMA empresa pode ser criada');
}

// ---------- 3b. um cadastro abaixo do limite ainda passa ----------
{
  const supabase = fakeSupabase({ cadastrosNaConexao: limiteCadastrosPorConexaoDia() - 1 });
  const res = fakeRes();
  await handler(fakeReq(), res, { supabase });
  assert.equal(res.statusCode, 200, 'o último cadastro dentro do limite ainda precisa passar');
}

// ---------- 4. quem já tem empresa recebe a que existe, sem gastar tentativa ----------
{
  const supabase = fakeSupabase({ vinculoExistente: 'org-que-ja-existe', cadastrosNaConexao: 99 });
  const res = fakeRes();
  await handler(fakeReq(), res, { supabase });
  assert.equal(res.statusCode, 200, 'primeiro login de quem já tem empresa nunca pode ser barrado pelo limite');
  assert.equal(res.payload?.organizationId, 'org-que-ja-existe');
  assert.equal(res.payload?.jaExistia, true);
  assert.deepEqual(supabase.registro.rpcs, [], 'não pode criar uma segunda empresa pro mesmo login');
  assert.deepEqual(supabase.registro.inserts, [], 'entrar de novo não conta como cadastro novo');
}

// ---------- 5. migração 0013 ainda não aplicada -> 501 com migracaoPendente ----------
{
  const supabase = fakeSupabase({ funcaoExiste: false, temAtomica: false });
  const res = fakeRes();
  await handler(fakeReq(), res, { supabase });
  assert.equal(res.statusCode, 501, 'sem a migração, a rota precisa avisar em vez de dar erro genérico');
  assert.equal(res.payload?.migracaoPendente, true, 'é esse sinal que faz o navegador usar o caminho antigo e ninguém ficar sem se cadastrar');
}

// ---------- 5b. v1186: sem a migração 0018, cai no modo antigo — mas a trava continua valendo --
// A 0018 é o que torna a trava exata sob pedidos simultâneos. Faltando ela, o cadastro NÃO pode
// parar (recusar todo mundo por causa de uma migração seria pior que o problema): volta pros
// quatro passos da v1128, que continuam recusando quem passou do limite. O que não pode é ficar
// silencioso — por isso a rota avisa no log e a 0018 aparece como "faltando" no diagnóstico.
{
  const supabase = fakeSupabase({ temAtomica: false, cadastrosNaConexao: 0 });
  const res = fakeRes();
  await handler(fakeReq({ corpo: { nome: 'Imobiliária Sem 0018' } }), res, { supabase });
  assert.equal(res.statusCode, 200, 'sem a 0018 o cadastro precisa continuar funcionando');
  assert.equal(res.payload?.travaAtomica, false, 'a resposta precisa dizer que a trava está no modo antigo');
  const tentativas = supabase.registro.rpcs.map(r => r.nome);
  assert.ok(tentativas.includes('criar_empresa_com_limite_de_conexao'), 'a operação única precisa ser tentada primeiro');
  assert.ok(tentativas.includes('criar_empresa_e_dono_para'), 'e só então o caminho antigo entra');
}
{
  const supabase = fakeSupabase({ temAtomica: false, cadastrosNaConexao: limiteCadastrosPorConexaoDia() });
  const res = fakeRes();
  await handler(fakeReq(), res, { supabase });
  assert.equal(res.statusCode, 429, 'no modo antigo a trava continua recusando quem passou do limite');
  assert.ok(supabase.registro.rpcs.every(r => r.nome !== 'criar_empresa_e_dono_para'),
    'recusado no modo antigo também não cria empresa nenhuma');
}

// ---------- 6. privacidade: o endereço de internet nunca é gravado em texto puro ----------
{
  const ip = '198.51.100.77';
  const impressao = impressaoDaConexao({ headers: { 'x-forwarded-for': ip } });
  assert.ok(impressao && impressao.length >= 16, 'a impressão da conexão precisa existir');
  assert.ok(!impressao.includes(ip), 'o endereço de internet NUNCA pode aparecer no que vai pro banco');
  assert.ok(/^[0-9a-f]+$/.test(impressao), 'a impressão precisa ser um resumo embaralhado, não o endereço');

  const supabase = fakeSupabase();
  const res = fakeRes();
  await handler(fakeReq({ ip }), res, { supabase });
  const gravado = JSON.stringify(supabase.registro.inserts);
  assert.ok(!gravado.includes(ip), 'nada do que é gravado pode conter o endereço de internet do corretor');

  // A mesma conexão precisa dar sempre a mesma impressão (senão o contador nunca somaria) e
  // conexões diferentes precisam dar impressões diferentes (senão um bloquearia o outro).
  assert.equal(impressaoDaConexao({ headers: { 'x-forwarded-for': ip } }), impressao);
  assert.notEqual(impressaoDaConexao({ headers: { 'x-forwarded-for': '203.0.113.1' } }), impressao);
  // Vários endereços encadeados (proxy): vale o primeiro, que é quem realmente chamou.
  assert.equal(impressaoDaConexao({ headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } }), impressao);
}

// ---------- 7. método errado não cria nada ----------
{
  const supabase = fakeSupabase();
  const res = fakeRes();
  await handler({ ...fakeReq(), method: 'GET' }, res, { supabase });
  assert.equal(res.statusCode, 405, 'só POST cria empresa');
  assert.deepEqual(supabase.registro.rpcs, []);
}

console.log('v1128-cadastro-limite-por-conexao: ok');
