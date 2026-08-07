import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1163 — a migração 0012 (v1120) criou os contadores de uso como funções com poder de
// administrador do banco (`security definer`) e liberou as duas pro papel `authenticated`. Elas
// recebem a EMPRESA como parâmetro e nunca conferem se quem chama pertence a essa empresa.
//
// Rodando as migrações 0001→0013 num Postgres 16 de verdade e chamando como usuário comum:
//
//   set role authenticated;
//   select reservar_contador_dia('00000000-0000-0000-0000-000000000001','direciona-cerebro','2026-08-07',-1);
//
// o CÉREBRO COMERCIAL da conta principal virou {"dia":"2026-08-07","contagem":1}. Também dava pra
// queimar o limite de IA de qualquer conta. E, como `grant ... to authenticated` não tira a
// liberação automática do grupo `public`, até `anon` (sem conta nenhuma) conseguia chamar.
//
// A migração 0014 fecha isso. Este arquivo é a guarda de regressão — e vai além do caso pontual:
// ele SIMULA as permissões que o Postgres teria depois de rodar as migrações na ordem, incluindo
// a liberação automática pro grupo `public` que toda função nova ganha sozinha. É essa simulação
// que teria pego tanto o furo da 0012 quanto a primeira versão da 0013 (v1128→v1129).

const dir = new URL('../supabase/migrations/', import.meta.url);
const arquivos = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

// ---------------------------------------------------------------- 1. a 0014 precisa existir
const nome0014 = arquivos.find(f => f.startsWith('0014_'));
assert.ok(nome0014, 'a migração 0014 (permissões dos contadores) precisa existir');
const sql0014 = fs.readFileSync(new URL(nome0014, dir), 'utf8');

for (const fn of ['reservar_analise_ia', 'reservar_contador_dia']) {
  const revoke = sql0014.split(/;\s*\n/).find(t => /revoke/i.test(t) && new RegExp(`${fn}\\s*\\(`, 'i').test(t)) || '';
  assert.match(revoke, /\bpublic\b/i,
    `o REVOKE de ${fn} precisa incluir "public" — sem isso não fecha nada (o Postgres libera toda função nova pro grupo public)`);
  assert.match(revoke, /\banon\b/i, `o REVOKE de ${fn} precisa incluir anon`);
  assert.match(revoke, /\bauthenticated\b/i, `o REVOKE de ${fn} precisa incluir authenticated`);
  assert.match(sql0014, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+${fn}[\\s\\S]{0,120}?to\\s+service_role`, 'i'),
    `${fn} precisa ser concedida ao service_role — é o backend (api/_pipeline.js) que chama`);
}

// 2. cinto de segurança dentro da função: contador não encosta em chave que não é contador
assert.match(sql0014, /limite-\(diario\|mensal\)/,
  'reservar_contador_dia precisa recusar chave que não seja de contador (limite-diario:* / limite-mensal:*) — é o que protege o Cérebro e o plano contratado mesmo se a permissão for reaberta um dia');

// 3. a exclusão de conta precisa do service_role (0007/0009 revogaram de todos e esqueceram de conceder)
assert.match(sql0014, /grant\s+execute\s+on\s+function\s+excluir_organizacao\s*\(\s*uuid\s*\)\s*to\s+service_role/i,
  'excluir_organizacao precisa ser concedida ao service_role — sem isso o botão de excluir conta do painel responde "permission denied"');

// -------------------------------------------- 4. simulação das permissões finais do banco
// Modelo do que o Postgres faz: ao CRIAR uma função, ela já nasce executável pelo grupo `public`
// (todo mundo, incluindo anon e authenticated) sem ninguém pedir. `create or replace` de uma
// função que já existe NÃO mexe nas permissões. GRANT soma papéis; REVOKE tira.
const estado = new Map(); // "nome/qtdParametros" -> { params, papeis:Set }

const chaveDe = (nome, qtd) => `${nome.toLowerCase()}/${qtd}`;
const contarParams = (lista) => {
  const limpa = lista.replace(/\bdefault\b[^,]*/gi, '').trim();
  return limpa ? limpa.split(',').filter(p => p.trim()).length : 0;
};

for (const arq of arquivos) {
  const sql = fs.readFileSync(new URL(arq, dir), 'utf8');

  // create [or replace] function nome(params)
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-z0-9_]+)\s*\(([^)]*)\)/gi)) {
    const k = chaveDe(m[1], contarParams(m[2]));
    if (!estado.has(k)) estado.set(k, { nome: m[1], params: m[2], papeis: new Set(['public']) });
  }

  for (const trecho of sql.split(/;\s*\n/)) {
    const g = /grant\s+execute\s+on\s+function\s+([a-z0-9_]+)\s*\(([^)]*)\)\s*to\s+([^;]+)/i.exec(trecho);
    if (g) {
      const k = chaveDe(g[1], contarParams(g[2]));
      if (!estado.has(k)) estado.set(k, { nome: g[1], params: g[2], papeis: new Set(['public']) });
      for (const papel of g[3].split(',').map(s => s.trim().toLowerCase())) estado.get(k).papeis.add(papel);
    }
    const r = /revoke\s+(?:all|execute)[^;]*?on\s+function\s+([a-z0-9_]+)\s*\(([^)]*)\)\s*from\s+([^;]+)/i.exec(trecho);
    if (r) {
      const k = chaveDe(r[1], contarParams(r[2]));
      if (!estado.has(k)) continue;
      for (const papel of r[3].split(',').map(s => s.trim().toLowerCase())) estado.get(k).papeis.delete(papel);
      // tirar de `public` derruba junto quem só enxergava a função por ser membro dele
      if (!estado.get(k).papeis.has('public')) {
        for (const papel of ['anon', 'authenticated']) {
          if (r[3].toLowerCase().includes(papel) || r[3].toLowerCase().includes('public')) estado.get(k).papeis.delete(papel);
        }
      }
    }
  }
}

// Uma função que recebe a empresa como parâmetro NÃO pode ficar ao alcance do navegador: quem
// chama escolhe de qual empresa é o parâmetro, e a chave "anon" do Supabase é pública.
const RECEBE_EMPRESA = /\bp_(org|organization_id)\s+uuid/i;
const aberta = (papeis) => ['public', 'anon', 'authenticated'].filter(p => papeis.has(p));

for (const [, fn] of estado) {
  if (!RECEBE_EMPRESA.test(fn.params)) continue;
  const expostos = aberta(fn.papeis);
  assert.equal(expostos.length, 0,
    `${fn.nome}(...) recebe a empresa como parâmetro e continua executável por ${expostos.join(', ')} depois de todas as migrações. ` +
    `Quem chama escolhe a empresa, e a chave "anon" do Supabase é pública — isso deixa qualquer pessoa mexer em dado de outra conta. ` +
    `Revogue de public, anon e authenticated e conceda só ao service_role (ver 0014).`);
}

// as duas funções de contador precisam sobrar SÓ pro backend
for (const nome of ['reservar_analise_ia', 'reservar_contador_dia']) {
  const fn = [...estado.values()].find(f => f.nome.toLowerCase() === nome);
  assert.ok(fn, `${nome} precisa existir nas migrações`);
  assert.ok(fn.papeis.has('service_role'), `${nome} precisa continuar liberada pro service_role (é o backend que chama)`);
}

console.log('v1163-migracao-0014-contadores-so-do-backend: ok');
