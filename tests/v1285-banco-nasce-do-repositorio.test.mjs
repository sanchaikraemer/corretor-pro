// v1285 — TODA TABELA QUE O CÓDIGO USA PRECISA NASCER DE ALGUMA MIGRAÇÃO.
//
// Achado A5 da auditoria de 16/08/2026: o repositório NÃO conseguia reconstruir o banco. Das 7
// tabelas usadas pelo código, 5 nasciam de migrações — mas as duas principais
// (`whatsapp_processamentos`, que guarda a conversa e a análise de cada cliente, e
// `direciona_config`, que guarda o Cérebro, o plano e os contadores) foram criadas à mão no começo
// do projeto e NUNCA existiram em migração nenhuma. As migrações seguintes só as ALTERAM — e
// "alter table if exists" num banco vazio não faz nada, em silêncio.
//
// Isso significava: banco perdido = não havia de onde voltar, e era impossível montar um ambiente
// de teste igual ao de produção. A `0000_baseline.sql` fechou o buraco. Este teste é a guarda pra
// ele não reabrir — se alguém criar uma tabela nova e usar no código sem colocá-la numa migração,
// aqui fica vermelho.
//
// Conferido num Postgres 16 de verdade em 17/08/2026: banco vazio + as 19 migrações na ordem →
// `conferir_migracoes()` devolve as 18 como "aplicada". E rodar a 0000 de novo num banco que já
// tem tudo é NO-OP (28 colunas antes, 28 depois).

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaApi = path.join(raiz, "api");
const pastaMigracoes = path.join(raiz, "supabase", "migrations");

const sqlDeTodasAsMigracoes = fs.readdirSync(pastaMigracoes)
  .filter(f => f.endsWith(".sql")).sort()
  .map(f => fs.readFileSync(path.join(pastaMigracoes, f), "utf8"))
  .join("\n");

// Tabelas que o código realmente consulta, descobertas sozinhas — assim uma tabela nova entra
// nesta checagem sem ninguém precisar lembrar.
const tabelasUsadas = new Set();
for (const arquivo of fs.readdirSync(pastaApi).filter(f => f.endsWith(".js"))) {
  const codigo = fs.readFileSync(path.join(pastaApi, arquivo), "utf8");
  for (const m of codigo.matchAll(/\.from\("([a-z_]+)"\)/g)) tabelasUsadas.add(m[1]);
}

assert.ok(tabelasUsadas.size >= 7,
  `esperava achar pelo menos 7 tabelas em uso e achei ${tabelasUsadas.size} — a varredura provavelmente quebrou`);

// Tabelas LEGADAS, anteriores à separação por empresa: só existem no banco original do dono e são
// lidas apenas por api/restaurar-leads.js (rota exclusiva da empresa principal). Uma instalação
// nova não precisa delas e não deve criá-las — por isso ficam fora da exigência.
const LEGADAS = new Set(["leads", "direciona_leads"]);

const semMigracao = [];
for (const tabela of [...tabelasUsadas].sort()) {
  if (LEGADAS.has(tabela)) continue;
  const criada = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${tabela}\\b`, "i")
    .test(sqlDeTodasAsMigracoes);
  if (!criada) semMigracao.push(tabela);
}

assert.deepEqual(semMigracao, [],
  `estas tabelas são usadas pelo código mas nenhuma migração as cria: ${semMigracao.join(", ")}. ` +
  `Sem isso o banco não pode ser reconstruído a partir do repositório — que foi exatamente o achado A5 da auditoria.`);

// ── O baseline tem que existir, rodar ANTES de todas e ser seguro em produção ─────────────────
const baselinePath = path.join(pastaMigracoes, "0000_baseline.sql");
assert.ok(fs.existsSync(baselinePath),
  "supabase/migrations/0000_baseline.sql precisa existir — é ele que cria as tabelas que nasceram à mão");

const baseline = fs.readFileSync(baselinePath, "utf8");
for (const tabela of ["whatsapp_processamentos", "direciona_config"]) {
  assert.match(baseline, new RegExp(`create table if not exists ${tabela}`, "i"),
    `o baseline precisa criar ${tabela} com "if not exists" — sem isso, rodá-lo em produção daria erro em vez de não fazer nada`);
}

// A promessa que torna seguro rodar o baseline em produção: nada nele pode destruir ou alterar.
for (const perigo of [/\bdrop\s+table\b/i, /\bdrop\s+column\b/i, /\btruncate\b/i, /\bdelete\s+from\b/i, /\balter\s+column\b/i]) {
  assert.ok(!perigo.test(baseline),
    `o baseline não pode conter "${perigo.source}": ele precisa ser um NO-OP completo num banco que já tem as tabelas (produção)`);
}

// O baseline recria o formato ANTERIOR à 0001, pra a corrente de migrações continuar contando a
// mesma história. Se ele já entregasse organization_id pronto, a 0001 viraria no-op e o histórico
// perderia o sentido.
assert.ok(!/organization_id/.test(baseline.replace(/--[^\n]*/g, "")),
  "o baseline não pode criar organization_id: quem acrescenta o dono das linhas é a migração 0001");

// E o nome do arquivo precisa ordenar antes de 0001 — as migrações são aplicadas em ordem
// alfabética, e um baseline que rodasse depois não adiantaria nada.
const emOrdem = fs.readdirSync(pastaMigracoes).filter(f => f.endsWith(".sql")).sort();
assert.equal(emOrdem[0], "0000_baseline.sql",
  "o baseline precisa ser o primeiro arquivo na ordem alfabética das migrações");

// ── v1286: conferir contra o formato REAL de produção ────────────────────────────────────────
//
// A primeira versão do baseline (v1285) foi DERIVADA DO CÓDIGO e errava: faltavam `lead_id`,
// `nome` e `nome_cliente` (o código só encosta nelas pelo caminho adaptativo, então ler o código
// não as revelava) e quase todos os valores padrão. O dono rodou a consulta de leitura no Supabase
// e colou o resultado — ele está em `supabase/estrutura-producao-2026-08-17.txt` e é a única fonte
// não-inferida que existe.
//
// Conferido num Postgres 16 de verdade em 17/08/2026: banco vazio + as 20 migrações na ordem
// produz EXATAMENTE essas 31 colunas — mesmos tipos, mesma ordem, mesmos padrões, mesma
// obrigatoriedade. Aqui fica a parte que dá pra checar sem banco nenhum: nenhuma coluna da
// produção pode ficar sem quem a crie.
const referencia = path.join(raiz, "supabase", "estrutura-producao-2026-08-17.txt");
assert.ok(fs.existsSync(referencia),
  "supabase/estrutura-producao-2026-08-17.txt precisa existir — é a única fonte não-inferida do formato das tabelas base");

const linhas = fs.readFileSync(referencia, "utf8").split("\n")
  .map(l => l.trim())
  .filter(l => l && !l.startsWith("#") && !l.startsWith("table_name,"));

assert.ok(linhas.length >= 31,
  `a referência de produção tem ${linhas.length} colunas — esperava pelo menos 31; o arquivo foi truncado?`);

const semQuemCrie = [];
for (const linha of linhas) {
  const [tabela, , coluna] = linha.split(",");
  if (!tabela || !coluna) continue;
  // A coluna precisa aparecer em alguma migração: ou dentro do create table do baseline, ou num
  // "add column" posterior (organization_id vem da 0001, os dedupe_* vêm da 0010).
  const aparece = new RegExp(`\\b${coluna}\\b`).test(sqlDeTodasAsMigracoes);
  if (!aparece) semQuemCrie.push(`${tabela}.${coluna}`);
}
assert.deepEqual(semQuemCrie, [],
  `estas colunas existem em produção mas nenhuma migração as cria: ${semQuemCrie.join(", ")}. ` +
  `Um banco reconstruído a partir do repositório sairia diferente do real.`);

// As três colunas que a versão derivada do código tinha perdido: ficam nomeadas aqui pra ninguém
// "limpar" o baseline achando que são sobra.
for (const coluna of ["lead_id", "nome_cliente", "nome"]) {
  assert.match(baseline, new RegExp(`^\\s+${coluna}\\s`, "m"),
    `o baseline precisa criar a coluna "${coluna}" — ela existe em produção e foi justamente uma das que a derivação por leitura de código não enxergou`);
}

console.log(`v1285-banco-nasce-do-repositorio: ok (${tabelasUsadas.size} tabelas em uso, todas com migração; ${linhas.length} colunas da produção real cobertas; baseline seguro e na frente da fila)`);
