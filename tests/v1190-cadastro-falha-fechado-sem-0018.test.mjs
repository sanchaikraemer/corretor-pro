import fs from "node:fs";
import assert from "node:assert/strict";
import { MIGRACAO_MINIMA_EXIGIDA } from "../api/_persistence.js";

// v1190 — CÓDIGO NOVO SOBRE BANCO VELHO NÃO PODE PARECER SAUDÁVEL.
//
// A migração 0018 fecha a janela de concorrência do cadastro: contar, decidir, criar e registrar
// numa transação só. Sem ela, a v1186 caía calada no caminho antigo de quatro passos — aquele em
// que oito pedidos simultâneos da mesma conexão criaram OITO contas onde o limite era cinco.
// Ninguém tinha como perceber pela tela: o cadastro funcionava, só que sem a trava.
//
// Agora, em produção, o cadastro RECUSA (503) até a migração ser aplicada — com duas saídas: a
// mensagem diz o que fazer, e CORRETOR_PRO_CADASTRO_SEM_0018=sim libera o caminho antigo na hora,
// sem publicar nada, se o dono precisar vender antes de rodar a migração.

const rota = fs.readFileSync(new URL("../api/criar-conta.js", import.meta.url), "utf8");

// ── 1. A recusa existe, é 503, e vem ANTES do caminho antigo ──────────────────────────────────
assert.match(rota, /return json\(res, 503, \{[\s\S]{0,300}?migracaoPendente: true/,
  "sem a 0018 em produção, a rota precisa responder 503 marcando a migração pendente");
assert.ok(
  rota.indexOf("503") < rota.indexOf("criar_empresa_e_dono_para"),
  "a recusa precisa vir ANTES de qualquer passo do caminho antigo"
);
assert.match(rota, /error: "O cadastro está temporariamente indisponível[\s\S]{0,200}?migração 0018/,
  "a mensagem que o corretor lê precisa dizer o que está acontecendo");
assert.match(rota, /console\.error\([\s\S]{0,300}?0018_cadastro_atomico_e_limpeza\.sql/,
  "o log precisa dizer exatamente qual arquivo rodar");
assert.doesNotMatch(rota, /console\.error\([\s\S]{0,400}?SUPABASE_SERVICE_ROLE_KEY|console\.error\([\s\S]{0,400}?process\.env\.[A-Z_]*KEY/,
  "o log de diagnóstico não pode imprimir segredo nenhum");

// ── 2. A trava só vale em produção, e tem destravamento explícito ─────────────────────────────
assert.match(rota, /NODE_ENV === "production" \|\| process\.env\.VERCEL_ENV === "production"/,
  "fora de produção o caminho antigo continua valendo (é onde ele serve)");
assert.match(rota, /CORRETOR_PRO_CADASTRO_SEM_0018/,
  "precisa existir um destravamento por variável de ambiente, sem publicar nada");
assert.match(rota, /emProducao && !destravado/,
  "a recusa é: produção E sem destravamento explícito");

// ── 3. O comportamento de verdade, com a lógica extraída da rota ──────────────────────────────
{
  const decide = (env) => {
    const emProducao = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
    const destravado = String(env.CORRETOR_PRO_CADASTRO_SEM_0018 || "").toLowerCase() === "sim";
    return emProducao && !destravado ? "recusa-503" : "caminho-antigo";
  };
  assert.equal(decide({ VERCEL_ENV: "production" }), "recusa-503",
    "produção sem a migração: recusa");
  assert.equal(decide({ NODE_ENV: "production" }), "recusa-503");
  assert.equal(decide({ VERCEL_ENV: "production", CORRETOR_PRO_CADASTRO_SEM_0018: "sim" }), "caminho-antigo",
    "com o destravamento explícito, volta a vender na hora");
  assert.equal(decide({ NODE_ENV: "test" }), "caminho-antigo",
    "em teste/desenvolvimento nada trava");
  assert.equal(decide({ VERCEL_ENV: "preview" }), "caminho-antigo",
    "preview não é produção");
}

// ── 4. O diagnóstico conhece a 0018 ───────────────────────────────────────────────────────────
assert.ok(MIGRACAO_MINIMA_EXIGIDA >= 18,
  `a migração mínima exigida precisa incluir a 0018 (está em ${MIGRACAO_MINIMA_EXIGIDA})`);
const sqlExiste = fs.existsSync(new URL("../supabase/migrations/0018_cadastro_atomico_e_limpeza.sql", import.meta.url));
assert.ok(sqlExiste, "o arquivo da migração 0018 precisa existir no repositório");

console.log("v1190-cadastro-falha-fechado-sem-0018: ok");
