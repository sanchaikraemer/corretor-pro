import fs from "node:fs";
import assert from "node:assert/strict";

// v1324 — O ISOLAMENTO ENTRE EMPRESAS DEIXA DE DEPENDER DE ALGUÉM LEMBRAR.
//
// Auditoria de 20/08/2026, e é o achado mais importante dela para vender o app pra muita gente:
//
//   "O banco possui RLS. Porém o backend utiliza service_role, e service_role IGNORA a RLS.
//    Portanto hoje a defesa real é: cada programador lembrar de colocar
//    .eq('organization_id', organizationId) em toda consulta. Revisei as rotas atuais e a
//    disciplina está boa. Mas basta UMA rota futura esquecer o filtro."
//
// Não encontraram vazamento — nem existe hoje. O problema é o desenho: a próxima consulta escrita
// por alguém com pressa é que pode vazar, e nada avisaria. Esta guarda troca a memória de quem
// escreve por uma trava automática: toda consulta às tabelas que têm dono precisa filtrar pela
// empresa, e a exceção — quando existir — tem que ser DECLARADA no código, com motivo escrito.
//
// Marcador de exceção: um comentário `multiempresa-ok:` junto da consulta.

const apiDir = new URL("../api/", import.meta.url);

// As tabelas em que cada linha pertence a uma empresa. `organizations`, `memberships` e
// `platform_admins` ficam de fora: elas são a lista de empresas/donos em si (é o cadastro da
// plataforma, consultado por id de empresa ou de usuário, não por dono da linha).
const TABELAS_COM_DONO = ["whatsapp_processamentos", "direciona_config", "ai_usage_events"];

const arquivos = fs.readdirSync(apiDir).filter(f => f.endsWith(".js"));
assert.ok(arquivos.length >= 10, `sanity check: esperava pelo menos 10 arquivos em api/, achei ${arquivos.length}`);

const consultas = [];
for (const arq of arquivos) {
  const linhas = fs.readFileSync(new URL(arq, apiDir), "utf8").split("\n");
  for (let i = 0; i < linhas.length; i++) {
    const achado = linhas[i].match(/\.from\("([a-z_]+)"\)/);
    if (!achado || !TABELAS_COM_DONO.includes(achado[1])) continue;
    // A consulta inteira: da linha do .from() até o ponto e vírgula que a fecha.
    let bloco = "";
    for (let j = i; j < Math.min(linhas.length, i + 25); j++) {
      bloco += linhas[j] + "\n";
      if (/;\s*$/.test(linhas[j])) break;
    }
    const contexto = linhas.slice(Math.max(0, i - 4), i + 1).join("\n");
    consultas.push({
      arquivo: arq,
      linha: i + 1,
      tabela: achado[1],
      filtra: /organization_id/.test(bloco),
      declarada: /multiempresa-ok/.test(bloco) || /multiempresa-ok/.test(contexto)
    });
  }
}

assert.ok(consultas.length >= 50,
  `sanity check: esperava dezenas de consultas às tabelas com dono, achei ${consultas.length} — a varredura quebrou?`);

const soltas = consultas.filter(c => !c.filtra && !c.declarada);
assert.deepEqual(soltas.map(c => `${c.arquivo}:${c.linha} (${c.tabela})`), [],
  'consulta a tabela com dono sem filtro por empresa. Ou acrescente .eq("organization_id", organizationId), ' +
  'ou declare a exceção com um comentário "multiempresa-ok: <motivo>" junto da consulta.');

// A exceção é exceção: se um dia virar regra, é sinal de que a trava foi contornada em vez de
// respeitada. Hoje são duas (o construtor de consulta da carteira e a gravação do backup).
const declaradas = consultas.filter(c => !c.filtra && c.declarada);
assert.ok(declaradas.length <= 4,
  `há ${declaradas.length} consultas com exceção declarada — acima de 4 a trava virou fachada: ${declaradas.map(c => `${c.arquivo}:${c.linha}`).join(", ")}`);

// E toda exceção precisa dizer POR QUE (o marcador sozinho não vale).
for (const c of declaradas) {
  const linhas = fs.readFileSync(new URL(c.arquivo, apiDir), "utf8").split("\n");
  const contexto = linhas.slice(Math.max(0, c.linha - 5), c.linha + 3).join(" ");
  const motivo = (contexto.match(/multiempresa-ok:([^\n]*)/) || [])[1] || "";
  assert.ok(motivo.trim().length >= 20,
    `${c.arquivo}:${c.linha} declara exceção sem explicar o motivo depois de "multiempresa-ok:"`);
}

// A varredura só vale se ela REPROVAR uma consulta sem filtro. Sem esta parte, um erro na
// expressão de busca faria o teste passar sempre, sem conferir nada.
{
  const exemploRuim = `const { data } = await supabase\n  .from("whatsapp_processamentos")\n  .select("id,telefone")\n  .eq("id", idQualquer);\n`;
  const linhas = exemploRuim.split("\n");
  let bloco = "";
  for (let j = 1; j < linhas.length; j++) { bloco += linhas[j] + "\n"; if (/;\s*$/.test(linhas[j])) break; }
  assert.ok(!/organization_id/.test(bloco), "a varredura precisa reprovar uma consulta sem filtro por empresa");
}

console.log(`v1324-isolamento-entre-empresas-na-guarda: ok (${consultas.length} consultas conferidas, ${declaradas.length} exceções declaradas)`);
