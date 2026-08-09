import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1186 — a migração 0018 conserta os dois pontos que a auditoria de 08/2026 deixou em aberto no
// cadastro:
//
//   1) A TRAVA CONTRA CADASTRO EM MASSA NÃO ERA ATÔMICA. Contar, decidir, criar e registrar eram
//      quatro passos separados. Entre o "conta" e o "registra" havia uma janela: cinco pedidos
//      simultâneos da mesma conexão liam "4", todos passavam, todos criavam.
//      Reproduzido num Postgres 16 de verdade, com limite 5 e oito pedidos ao mesmo tempo:
//        • caminho antigo → 8 contas criadas;
//        • função da 0018 → 5 criadas, 3 recusadas.
//
//   2) A IMPRESSÃO DA CONEXÃO ERA GUARDADA PARA SEMPRE. Só as últimas 24h importam, e nada
//      apagava o resto. Agora há uma limpeza (padrão 7 dias) e um índice por data pra ela não
//      varrer a tabela inteira.
//
// Este arquivo guarda o que não pode se perder numa alteração futura.

const dir = new URL('../supabase/migrations/', import.meta.url);
const arquivos = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const nome = arquivos.find(f => f.startsWith('0018_'));
assert.ok(nome, 'a migração 0018 precisa existir');
const sql = fs.readFileSync(new URL(nome, dir), 'utf8');
const semComentarios = sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');

// ── 1. A operação única existe e faz as quatro coisas DENTRO dela ─────────────────────────────
assert.match(sql, /create\s+or\s+replace\s+function\s+criar_empresa_com_limite_de_conexao/i,
  'a criação de empresa com limite precisa existir como uma função só');
const corpo = sql.slice(sql.indexOf('create or replace function criar_empresa_com_limite_de_conexao'));
const corpoFuncao = corpo.slice(0, corpo.indexOf('\n$$;') + 4);

assert.match(corpoFuncao, /pg_advisory_xact_lock/,
  'sem trava, duas chamadas simultâneas contam o mesmo número e as duas passam');
assert.match(corpoFuncao, /hashtext\('cp-cadastro:'\s*\|\|\s*p_conexao_hash\)/,
  'a trava precisa ser POR CONEXÃO — travar tudo faria um corretor esperar pelo cadastro de outro');
assert.ok(corpoFuncao.indexOf('pg_advisory_xact_lock') < corpoFuncao.indexOf('select count(*)'),
  'a trava precisa vir ANTES da contagem, senão a janela continua aberta');
assert.match(corpoFuncao, /select\s+count\(\*\)\s+into\s+usados[\s\S]{0,300}?interval\s+'24 hours'/i,
  'a contagem precisa continuar sendo das últimas 24 horas');
assert.ok(corpoFuncao.indexOf('insert into organizations') > corpoFuncao.indexOf('usados >= limite'),
  'a empresa só pode ser criada depois de a contagem passar');
assert.ok(corpoFuncao.indexOf('insert into cadastros_por_conexao') > corpoFuncao.indexOf('insert into organizations'),
  'o registro no contador precisa acontecer na MESMA transação, depois de criar');

// A recusa precisa ser reconhecível pelo backend (código próprio, não texto solto).
assert.match(corpoFuncao, /using\s+errcode\s*=\s*'CP429'/,
  'o estouro do limite precisa ter um código próprio pro backend distinguir de erro de verdade');

// Login que já tem empresa não pode gastar tentativa da conexão (é o primeiro login de quem já
// se cadastrou) — mesma regra idempotente da 0013.
assert.ok(corpoFuncao.indexOf('ja_existe is not null') < corpoFuncao.indexOf('pg_advisory_xact_lock'),
  'quem já tem empresa precisa sair ANTES da trava e da contagem');

// ── 2. A limpeza da impressão de conexão ──────────────────────────────────────────────────────
assert.match(sql, /create\s+or\s+replace\s+function\s+limpar_cadastros_por_conexao_antigos/i,
  'a limpeza da impressão de conexão precisa existir');
assert.match(sql, /create\s+index\s+if\s+not\s+exists\s+cadastros_por_conexao_idade\s+on\s+cadastros_por_conexao\s*\(criado_em\)/i,
  'sem índice por data a limpeza varre a tabela inteira');
assert.match(sql, /greatest\(coalesce\(p_dias,\s*7\),\s*1\)/,
  'a limpeza nunca pode apagar o dia corrente (o contador das 24h depende dele)');

// ── 3. Nada disso pode estar ao alcance do navegador ──────────────────────────────────────────
for (const trecho of semComentarios.split(/;\s*\n/)) {
  if (!/grant\s+execute/i.test(trecho)) continue;
  const depoisDoTo = trecho.split(/\bto\b/i)[1] || '';
  assert.ok(!/\b(anon|authenticated|public)\b/i.test(depoisDoTo),
    `a 0018 não pode liberar função nenhuma pro navegador. Trecho: ${trecho.trim().slice(0, 140)}`);
}
for (const fn of ['criar_empresa_com_limite_de_conexao', 'limpar_cadastros_por_conexao_antigos']) {
  assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+${fn}[^;]*from\\s+public,\\s*anon,\\s*authenticated`, 'i'),
    `${fn} precisa ser revogada de public (o Postgres libera toda função nova pro grupo public por conta própria)`);
  assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+${fn}[^;]*to\\s+service_role`, 'i'),
    `${fn} precisa ser concedida ao backend`);
}
assert.match(sql, /security\s+definer[\s\S]{0,80}?set\s+search_path\s*=\s*public/i,
  'função com privilégio elevado precisa de search_path fixo');

// ── 4. A conferência do banco (0017) precisa conhecer a 0018 ──────────────────────────────────
assert.match(sql, /create\s+or\s+replace\s+function\s+public\.conferir_migracoes/i,
  'a 0018 precisa reescrever a conferência pra se incluir nela (a 0017 já pode estar aplicada)');
assert.match(sql, /\(18, '0018_cadastro_atomico_e_limpeza\.sql'\)/,
  'a 0018 precisa aparecer na lista da conferência');
assert.match(sql, /when 18 then[\s\S]{0,600}?criar_empresa_com_limite_de_conexao[\s\S]{0,400}?cadastros_por_conexao_idade/,
  'a conferência da 0018 precisa checar a função nova, a limpeza e o índice');

// ── 5. A rota usa a operação única primeiro, e não fica em silêncio se ela faltar ─────────────
const rota = fs.readFileSync(new URL('../api/criar-conta.js', import.meta.url), 'utf8');
assert.match(rota, /rpc\("criar_empresa_com_limite_de_conexao"/,
  'a rota precisa tentar a operação única antes de qualquer outra coisa');
assert.ok(rota.indexOf('criar_empresa_com_limite_de_conexao') < rota.indexOf('criar_empresa_e_dono_para'),
  'a operação única precisa vir ANTES do caminho antigo');
assert.match(rota, /code\s*\|\|\s*""\)\s*===\s*"CP429"/,
  'a rota precisa reconhecer o código de recusa da função');
assert.match(rota, /console\.warn\([\s\S]{0,120}?0018/,
  'faltando a 0018, a rota precisa avisar no log — nada de downgrade silencioso');
assert.match(rota, /limpar_cadastros_por_conexao_antigos/,
  'a rota precisa disparar a limpeza da impressão de conexão');
assert.match(rota, /_ultimaLimpezaDeImpressoes/,
  'a limpeza não pode rodar a cada cadastro (uma vez por dia por instância basta)');

console.log('v1186-migracao-0018-cadastro-atomico: ok');
