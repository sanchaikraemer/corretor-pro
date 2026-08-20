import fs from "node:fs";
import assert from "node:assert/strict";
import { CATALOGO_ENV, conferirConfiguracao, nomeParecidoNoCatalogo } from "../api/_config.js";

// v1324 — TODA CONFIGURAÇÃO DO SERVIDOR TEM NOME, DONO E CONFERÊNCIA.
//
// Auditoria de 20/08/2026: "há 55 variáveis de ambiente referenciadas no projeto. Isso já pede
// validação centralizada de configuração ao iniciar/deployar, em vez de descobrir uma variável
// errada quando um corretor usa determinada função."
//
// Neste projeto o erro típico é silencioso duas vezes: nome digitado errado na Vercel não é lido
// por ninguém, e valor no formato errado ("true" numa chave que só liga com "1") deixa a chave
// desligada. Nos dois casos, quem configurou jura que configurou.

const raiz = new URL("../", import.meta.url);
const apiDir = new URL("api/", raiz);

// ── 1. O catálogo não pode envelhecer: o que o código lê tem que estar nele ───────────────────
const fontes = [
  ...fs.readdirSync(apiDir).filter(f => f.endsWith(".js")).map(f => `api/${f}`),
  "build.js"
];
const lidasNoCodigo = new Set();
for (const arq of fontes) {
  const src = fs.readFileSync(new URL(arq, raiz), "utf8");
  // process.env.NOME
  for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]{3,})/g)) lidasNoCodigo.add(m[1]);
  // process.env["NOME"] e os nomes passados como texto para os leitores (envModel, envNum…)
  for (const m of src.matchAll(/["']([A-Z][A-Z0-9_]{5,})["']/g)) {
    const nome = m[1];
    if (/^(CORRETOR_PRO|DIRECIONA|OPENAI|SUPABASE|ATALHO|NEXT_PUBLIC|API_SECRET|CP_API_SECRET|ALLOW_UNPROTECTED_API)/.test(nome)
      && !nome.endsWith("_") && new RegExp(`process\\.env\\[[^\\]]*\\]|env\\w*\\(\\s*["']${nome}["']|\\benvDia|\\benvMes|chave\\s*=`).test(src)) {
      lidasNoCodigo.add(nome);
    }
  }
}
// Nomes que aparecem como texto em outro contexto (mensagem de erro, comentário) não contam:
// só vale o que o catálogo precisa cobrir de verdade.
const noCatalogo = new Set(CATALOGO_ENV.map(v => v.nome));
const forasDoCatalogo = [...lidasNoCodigo].filter(n => !noCatalogo.has(n) && !/^(NODE_ENV|VERCEL_|GIT_)/.test(n));
assert.deepEqual(forasDoCatalogo, [],
  `variável lida pelo código e ausente de api/_config.js: ${forasDoCatalogo.join(", ")}. ` +
  "Sem estar no catálogo, ela não aparece na conferência do painel e um nome errado nela seguiria invisível.");

// ── 2. E o contrário: catálogo não pode guardar variável que ninguém lê mais ──────────────────
const todoOCodigo = fontes.map(a => fs.readFileSync(new URL(a, raiz), "utf8")).join("\n");
const orfas = CATALOGO_ENV.filter(v => v.tipo !== "plataforma" && !todoOCodigo.includes(v.nome)).map(v => v.nome);
assert.deepEqual(orfas, [],
  `o catálogo descreve variáveis que o código não lê mais: ${orfas.join(", ")} — remova, senão a tela promete um ajuste que não existe.`);

// ── 3. Cada item explica o que faz, em português e sem jargão ────────────────────────────────
for (const item of CATALOGO_ENV) {
  assert.ok(item.oQueFaz && item.oQueFaz.length >= 25, `${item.nome} precisa explicar o que faz (o painel mostra esse texto pro dono)`);
  assert.ok(item.grupo, `${item.nome} precisa de um grupo`);
  assert.ok(["texto", "segredo", "numero", "liga1", "ligaSim", "url", "plataforma"].includes(item.tipo), `${item.nome} tem tipo inválido`);
}
assert.equal(new Set(CATALOGO_ENV.map(v => v.nome)).size, CATALOGO_ENV.length, "não pode haver nome repetido no catálogo");

// ── 4. A conferência pega os erros que hoje passam batido ────────────────────────────────────
{
  const base = {
    SUPABASE_URL: "https://projeto.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "s".repeat(40),
    OPENAI_API_KEY: "sk-" + "k".repeat(40)
  };
  const limpo = conferirConfiguracao(base);
  assert.equal(limpo.ok, true, "com o essencial configurado, a conferência precisa passar");
  assert.equal(limpo.problemas.length, 0, "e não pode inventar problema onde não há");

  // Faltando o essencial
  const semNada = conferirConfiguracao({});
  assert.equal(semNada.ok, false);
  assert.ok(semNada.problemas.some(p => p.nome === "OPENAI_API_KEY" && p.nivel === "erro"), "sem a chave da OpenAI, é erro");

  // Número escrito como palavra
  const numeroRuim = conferirConfiguracao({ ...base, CORRETOR_PRO_LIMITE_ANALISES_DIA: "muitas" });
  assert.ok(numeroRuim.problemas.some(p => p.nome === "CORRETOR_PRO_LIMITE_ANALISES_DIA" && p.nivel === "erro"));

  // Liga/desliga com "true" — o caso mais traiçoeiro: parece ligado e está desligado
  const ligaRuim = conferirConfiguracao({ ...base, DIRECIONA_USAR_APRENDIZADO_AUTO: "true" });
  const aviso = ligaRuim.problemas.find(p => p.nome === "DIRECIONA_USAR_APRENDIZADO_AUTO");
  assert.ok(aviso, "chave de liga/desliga com valor inválido precisa avisar");
  assert.match(aviso.mensagem, /continua DESLIGADA/, "e precisa dizer a consequência, não só que está errado");
  assert.equal(conferirConfiguracao({ ...base, DIRECIONA_USAR_APRENDIZADO_AUTO: "1" }).problemas.length, 0, '"1" liga e não gera aviso');

  // Nome digitado errado — a variável que ninguém lê
  const nomeErrado = conferirConfiguracao({ ...base, DIRECIONA_LIMITE_LEITURA_VISUAL: "120" });
  const desconhecida = nomeErrado.problemas.find(p => p.nome === "DIRECIONA_LIMITE_LEITURA_VISUAL");
  assert.ok(desconhecida, "variável do projeto que o código não lê precisa aparecer");
  assert.match(desconhecida.mensagem, /Você quis dizer DIRECIONA_LIMITE_LEITURA_VISUAL_DIA\?/, "e sugerir o nome certo");
  assert.equal(nomeParecidoNoCatalogo("OPENAI_API_KEYS"), "OPENAI_API_KEY");
  assert.equal(nomeParecidoNoCatalogo("COISA_QUALQUER_SEM_PARENTESCO_NENHUM"), null, "nome sem parentesco não vira sugestão errada");

  // Endereço sem https
  const urlRuim = conferirConfiguracao({ ...base, SUPABASE_URL: "projeto.supabase.co" });
  assert.ok(urlRuim.problemas.some(p => p.nome === "SUPABASE_URL" && p.nivel === "erro"));

  // Variável de fora do projeto não vira problema (a Vercel põe dezenas delas)
  const comLixo = conferirConfiguracao({ ...base, PATH: "/usr/bin", AWS_REGION: "us-east-1", VERCEL: "1" });
  assert.equal(comLixo.problemas.length, 0, "variável que não é deste projeto não pode virar aviso");
}

// ── 5. Nenhum valor pode vazar na resposta ───────────────────────────────────────────────────
{
  const r = conferirConfiguracao({
    SUPABASE_URL: "https://projeto.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "SEGREDO-DO-BANCO-QUE-NAO-PODE-VAZAR",
    OPENAI_API_KEY: "sk-SEGREDO-DA-OPENAI-QUE-NAO-PODE-VAZAR"
  });
  const texto = JSON.stringify(r);
  assert.ok(!texto.includes("SEGREDO-DO-BANCO"), "a conferência não pode devolver o valor de um segredo");
  assert.ok(!texto.includes("SEGREDO-DA-OPENAI"), "nem o da OpenAI");
  assert.ok(r.conferidas.every(c => !("valor" in c)), "a lista devolve se está definida, nunca o conteúdo");
}

// ── 6. As pontas ligadas: rota, painel e o aviso no registro do servidor ─────────────────────
{
  const diag = fs.readFileSync(new URL("api/diagnostico.js", raiz), "utf8");
  assert.match(diag, /mode === "config"/, "a rota precisa atender ?mode=config");
  const trecho = diag.slice(diag.indexOf('mode === "config"'), diag.indexOf('mode === "config"') + 400);
  assert.match(trecho, /getPlatformAdminUserId/, "conferir configuração é exclusivo do administrador da plataforma");

  const persistencia = fs.readFileSync(new URL("api/_persistence.js", raiz), "utf8");
  assert.match(persistencia, /avisarConfiguracaoNoLog\(\)/, "o servidor precisa avisar no registro quando acorda com configuração errada");
  assert.match(persistencia, /NODE_ENV !== "test"/, "e precisa ficar calado durante os testes");

  const painel = fs.readFileSync(new URL("admin-plataforma.html", raiz), "utf8");
  assert.match(painel, /Saúde da configuração/, "o painel precisa ter o cartão");
  assert.match(painel, /diagnostico\?mode=config/, "ligado na rota");
  assert.match(painel, /carregarConfig\(\)/, "e com botão de conferir agora");
}

console.log(`v1324-configuracao-catalogada: ok (${CATALOGO_ENV.length} variáveis catalogadas)`);
