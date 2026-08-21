import fs from "node:fs";
import assert from "node:assert/strict";

// v1325 — TESTE VERMELHO NÃO PODE CHEGAR AO AR.
//
// Auditoria de 20/08/2026: "o CI executa, mas NÃO bloqueia o merge; push em main faz a Vercel
// publicar automaticamente. Ou seja: teste vermelho ≠ produção bloqueada."
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// v1328 — A PRIMEIRA TENTATIVA DE RESOLVER ISSO QUEBROU A PUBLICAÇÃO. LEIA ANTES DE REFAZER.
//
// A v1325 pôs a suíte dentro do build da Vercel (`npm test && node build.js`). Parecia perfeito:
// suíte vermelha, build falha, versão anterior fica no ar. Só que o build da Vercel roda COM AS
// VARIÁVEIS DE AMBIENTE DE PRODUÇÃO carregadas — e vários testes conferem o valor DE FÁBRICA de
// tetos e limites. Com `CORRETOR_PRO_LIMITE_*` e companhia definidas, esses testes falham, o build
// falha junto, e a publicação PARA — foi o que aconteceu: o site ficou preso na v1324 enquanto a
// v1325, a v1326 e a v1327 já estavam no repositório, e quem viu foi o dono, não o teste.
//
// (Detalhe cruel: no GitHub Actions a mesma suíte passava, porque lá o ambiente é limpo. Verde no
// CI, vermelho na publicação, e nenhum aviso pra ninguém.)
//
// Conclusão que ficou registrada na época: rodar a suíte com o ambiente de produção carregado
// mistura duas coisas que precisam ficar separadas — "o código está certo?" e "a configuração
// desta conta está certa?". A segunda pergunta tem tela própria desde a v1325 (Saúde da
// configuração, no painel).
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// v1338 — O PORTÃO VOLTOU, ATACANDO A CAUSA E NÃO O SINTOMA.
//
// Tirar o portão resolveu a publicação e deixou o buraco original aberto: entre a v1328 e a v1337,
// nada impedia publicar com a suíte vermelha. O erro da v1325 nunca foi "conferir antes de
// publicar" — foi conferir COM AS VARIÁVEIS DE PRODUÇÃO NO AMBIENTE.
//
// Agora quem confere é scripts/testes-antes-de-publicar.mjs: ele roda a suíte num ambiente LIMPO
// (nenhuma variável de produção entra), com teto de tempo e uma válvula de emergência
// (DIRECIONA_PULAR_TESTES_NO_BUILD=1). O resultado do build passou a ser o mesmo do `npm test` da
// máquina — que é o que faltava. Está provado rodando, em v1338-portao-da-publicacao.test.mjs.
//
// O que este arquivo guarda daqui pra frente: `npm test` cru NUNCA pode voltar pro buildCommand.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const raiz = new URL("../", import.meta.url);
const vercel = JSON.parse(fs.readFileSync(new URL("vercel.json", raiz), "utf8"));

// v1338 — a publicação passa pelo portão de ambiente limpo, e nunca por `npm test` cru.
assert.equal(vercel.buildCommand, "node scripts/testes-antes-de-publicar.mjs && node build.js",
  "a publicação confere a suíte num ambiente limpo antes de gerar os arquivos");
assert.ok(!/npm test/.test(vercel.buildCommand),
  "não repita a v1325: `npm test` cru no build carrega as variáveis de produção e trava a publicação");

// A rede que continua valendo: a suíte roda sozinha em todo push e em todo PR, com o job nomeado
// `testes` — que é o nome que o dono marca como obrigatório no GitHub.
const ci = fs.readFileSync(new URL(".github/workflows/ci.yml", raiz), "utf8");
assert.match(ci, /name:\s*testes/, "o job precisa se chamar 'testes' — é esse nome que o GitHub marca como obrigatório");
assert.match(ci, /pull_request/, "a suíte precisa rodar no PR");
assert.match(ci, /npm test/, "e precisa rodar a suíte de verdade");

const doc = fs.readFileSync(new URL("ESTADO-ATUAL.md", raiz), "utf8");
assert.match(doc, /Require status checks to pass before merging/,
  "o passo que depende do dono precisa continuar escrito, com o caminho dos cliques");
assert.match(doc, /v1328/,
  "o documento de estado precisa registrar por que a suíte saiu do build da Vercel — senão alguém refaz");

console.log("v1325-publicacao-nao-sobe-com-teste-vermelho: ok");
