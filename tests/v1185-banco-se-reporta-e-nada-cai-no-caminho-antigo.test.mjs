import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1185 — as três auditorias de 08/2026 chegaram, cada uma por um caminho, na MESMA conclusão:
// o maior risco que sobrou no Corretor Pro não é código quebrado, é o código e o banco poderem
// estar em versões diferentes sem ninguém saber. E não é hipótese: a conferência de 07/08/2026
// achou a migração 0009 nunca aplicada enquanto da 0010 à 0014 já estavam.
//
// O agravante era o padrão que aparecia em vários lugares do código: quando a peça de segurança
// do banco não era encontrada, o app NÃO avisava — voltava a trabalhar do jeito antigo, de antes
// das contas separadas. Ou seja, faltar a trava fazia o sistema desligar a trava.
//
// Este teste guarda as duas metades da correção:
//   A) a migração 0017, que faz o banco se reportar (olhando o catálogo do Postgres, não uma
//      anotação em documento), e o backend que lê esse relatório;
//   B) a retirada dos três caminhos antigos, cada um substituído por um aviso claro.

const ler = (arq) => fs.readFileSync(new URL('../' + arq, import.meta.url), 'utf8');
const semComentariosSql = (sql) => sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
const semComentariosJs = (js) => js.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

// ══ A) O banco passa a se reportar ═══════════════════════════════════════════════════════════

// ── A1. A migração existe e confere pelo ESTADO REAL, não por anotação ───────────────────────
{
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const arquivos = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const nome = arquivos.find(f => f.startsWith('0017_'));
  assert.ok(nome, 'a migração 0017 (registro de migrações) precisa existir');
  const sql = fs.readFileSync(new URL(nome, dir), 'utf8');

  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.cp_migracoes_aplicadas/i,
    'a 0017 precisa criar a tabela onde o estado fica guardado');
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.conferir_migracoes\(\)/i,
    'a 0017 precisa criar a função que refaz a conferência sob demanda');

  // O ponto da migração: ela OLHA o catálogo. Se um dia alguém trocar isso por uma tabela de
  // "marque aqui o que você rodou", volta o problema que ela veio resolver.
  for (const marca of [/to_regclass\s*\(/i, /to_regprocedure\s*\(/i, /pg_constraint/i, /has_function_privilege\s*\(/i]) {
    assert.match(sql, marca,
      'a conferência precisa ler o catálogo do Postgres (tabela, função, trava e permissão) — não confiar em anotação');
  }

  // Toda migração da lista precisa estar coberta, senão uma some do relatório sem ninguém notar.
  const numerosNoDisco = arquivos.map(f => Number(f.slice(0, 4))).filter(Number.isFinite);
  for (const n of numerosNoDisco) {
    assert.match(sql, new RegExp(`'${String(n).padStart(4, '0')}_`),
      `a conferência da 0017 precisa citar a migração ${n} — senão ela some do relatório`);
  }

  // A 0015 refaz as travas que faltaram da 0009: as duas têm que ser conferidas pelo mesmo efeito.
  assert.match(sql, /when\s+9\s*,\s*15\s+then/i,
    'a 0009 e a 0015 deixam o mesmo efeito — a conferência precisa tratá-las juntas');

  // Detectar a 0013 só pela existência da função seria mentira: a trava contra cadastro falso em
  // massa só vale com o revoke que tira a criação de empresa do alcance do navegador.
  assert.match(sql, /cp_navegador_pode_executar\s*\(\s*'public\.criar_empresa_e_dono/i,
    'a conferência da 0013 precisa checar que o navegador NÃO consegue criar empresa direto');
  assert.match(sql, /has_function_privilege\s*\(\s*'anon'[\s\S]{0,160}?has_function_privilege\s*\(\s*'authenticated'/i,
    'a checagem de alcance do navegador precisa olhar anon E authenticated');

  // Mesma regra de sempre do projeto: nada novo pode nascer ao alcance do navegador.
  for (const trecho of semComentariosSql(sql).split(/;\s*\n/)) {
    if (!/grant\s+(execute|select|insert|update|delete)/i.test(trecho)) continue;
    const depoisDoTo = trecho.split(/\bto\b/i)[1] || '';
    assert.ok(!/\b(anon|authenticated|public)\b/i.test(depoisDoTo),
      `a 0017 não pode liberar nada pro navegador. Trecho: ${trecho.trim().slice(0, 160)}`);
  }
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.cp_migracoes_aplicadas\s+from\s+public,\s*anon,\s*authenticated/i,
    'a tabela do registro precisa ser fechada pro navegador (o revoke tem que incluir public)');
  assert.match(sql, /enable\s+row\s+level\s+security/i, 'RLS ligada na tabela nova');

  // Funções security definer sem search_path fixo foram problema real na 0009/0015.
  const definers = semComentariosSql(sql).match(/security\s+definer/gi) || [];
  const comSearchPath = semComentariosSql(sql).match(/set\s+search_path\s*=\s*public/gi) || [];
  assert.ok(comSearchPath.length >= definers.length,
    'toda função security definer criada aqui precisa de search_path fixo');
}

// ── A2. O backend lê o relatório e sabe de que versão ele precisa ────────────────────────────
{
  const persistence = ler('api/_persistence.js');
  assert.match(persistence, /export\s+const\s+MIGRACAO_MINIMA_EXIGIDA\s*=\s*\d+/,
    'o código precisa declarar de que versão de banco ele depende');
  assert.match(persistence, /export\s+async\s+function\s+conferirMigracoesDoBanco/,
    'o backend precisa conseguir perguntar ao banco o que está aplicado');
  assert.match(persistence, /rpc\(\s*["']conferir_migracoes["']\s*\)/,
    'a leitura precisa chamar a função que a 0017 criou');

  // A 0017 ainda não aplicada é a resposta esperada até o dono rodar o arquivo — não pode virar
  // um erro cru de banco na tela.
  assert.match(persistence, /registroAusente/, 'falta da própria 0017 precisa ser reconhecida e explicada');
  assert.match(persistence, /0017_registro_de_migracoes\.sql/,
    'a mensagem precisa dizer QUAL arquivo rodar — é o dono, não um programador, que vai rodar');

  const diagnostico = ler('api/diagnostico.js');
  assert.match(diagnostico, /mode\s*===\s*["']banco["']/, 'o diagnóstico precisa do modo banco');
  assert.match(diagnostico, /getPlatformAdminUserId[\s\S]{0,400}?mode\s*===\s*["']banco["']|mode\s*===\s*["']banco["'][\s\S]{0,400}?getPlatformAdminUserId/,
    'o modo banco é infraestrutura da plataforma: só o administrador pode ver');
}

// ══ B) Nenhum caminho antigo sobrevive à falta de uma trava ═══════════════════════════════════

// ── B1. Cérebro: gravar não pode mais cair na regra global de antes das contas ───────────────
{
  const pipeline = semComentariosJs(ler('api/_pipeline.js'));
  const trecho = pipeline.slice(pipeline.indexOf('export async function upsertConfigComOrganizacao'));
  const corpo = trecho.slice(0, trecho.indexOf('\n}\n') + 3);

  assert.match(corpo, /onConflict:\s*["']organization_id,chave["']/,
    'gravar o Cérebro continua sendo por (empresa, chave)');
  assert.ok(!/onConflict:\s*["']chave["']/.test(corpo),
    'não pode existir reserva gravando pela chave global: é uma conta escrevendo por cima da configuração de outra');
  assert.match(corpo, /Banco desatualizado/i,
    'faltando a regra por corretor, o gravar precisa FALHAR com aviso claro em vez de escrever no lugar errado');
}

// ── B2. Cadastro: o navegador não cria empresa por fora da trava ─────────────────────────────
{
  for (const arq of ['cadastro.html', 'entrar.html']) {
    const html = semComentariosJs(ler(arq));
    assert.ok(!/rpc\(\s*['"]criar_empresa_e_dono['"]/.test(html),
      `${arq} não pode mais criar empresa chamando o banco direto — é justamente o que a migração 0013 tira do navegador`);
    assert.match(html, /\/api\/criar-conta/,
      `${arq} precisa continuar criando a empresa pelo servidor, onde fica a trava contra cadastro falso em massa`);
  }

  // E o servidor, quando recusa, precisa dizer por quê — o silêncio é o que deixava a recusa
  // virar "cria por fora" antes.
  const entrar = ler('entrar.html');
  assert.match(entrar, /erroFinal[\s\S]{0,400}?corpo\.error/,
    'entrar.html precisa mostrar o motivo da recusa do servidor, não engoli-la');
}

// ── B3. Cérebro: a resposta de "tabela não existe" não sugere mais o esquema pré-multiempresa ─
{
  const cerebro = ler('api/cerebro-config.js');
  assert.ok(!/chave\s+text\s+primary\s+key/i.test(semComentariosJs(cerebro)),
    'a rota não pode sugerir criar direciona_config com a chave global (esquema de antes das contas separadas, sem organization_id)');
  assert.ok(!/sqlNecessario\s*:/.test(semComentariosJs(cerebro)),
    'nada de mandar SQL pronto pra tela: banco incompleto se resolve com as migrações oficiais');
  assert.match(cerebro, /migra(ç|c)(õ|o)es oficiais/i,
    'a resposta precisa apontar para as migrações oficiais');

  const app = semComentariosJs(ler('app.js'));
  assert.ok(!/copiarSqlCerebro/.test(app),
    'o botão "Copiar SQL" copiava justamente aquele comando antigo — não pode sobrar no app');
}

console.log('v1185-banco-se-reporta-e-nada-cai-no-caminho-antigo: ok');
