import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain, parseWhatsappTxt } from "../api/_pipeline.js";

// v1346 — POR QUE A REANÁLISE E A IMPORTAÇÃO DEMORAVAM TANTO.
//
// "reanálise e importação estão demorando MUITO! DEMAIS!!! porque isso acontece?" (dono,
// 21/08/2026, 11h41, com o print da barra parada em 50%).
//
// A causa é minha e tem data. Na v1332 eu liguei o modo de DUAS ETAPAS como padrão: a análise
// passou a ser duas conversas com o modelo grande, uma esperando a outra — primeiro a leitura
// completa, depois as três mensagens. Tempo de espera somado. Foi por isso que o próprio aviso da
// tela passou a dizer "costuma levar de 1 a 2 minutos".
//
// E liguei SEM MEDIR — está escrito no registro da bateria desde então que a comparação ficava
// devendo. Dobrar a espera do corretor em troca de uma melhora nunca comprovada não se sustenta.
// O padrão volta pro estado que FOI medido (156/191). O modo continua inteiro, a um comando de
// distância, e só volta a ser padrão com número na mão.
//
// A segunda metade da demora estava na importação: a leitura de imagens/PDFs (janela de 22s) e a
// de links (20s) rodavam UMA DEPOIS DA OUTRA — até 42 segundos em fila antes de a análise começar.

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const storage = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");

const CONVERSA = [
  "[10/08/2026 09:00] Cliente: Bom dia, vi o anúncio do apartamento",
  "[10/08/2026 09:05] Corretor: Bom dia! É pra morar ou investir?",
  "[10/08/2026 09:40] Cliente: Pra morar. Qual o valor?"
].join("\n");
const timeline = parseWhatsappTxt(CONVERSA);

const RESPOSTA = {
  summary: "Resumo", leituraDaConversa: "Leitura",
  diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento" },
  mensagens: { recomendada: "Pergunta A?", maisSuave: "Pergunta B?", maisDireta: "Pergunta C?" },
  produtoInteresse: "Produto", produtosInteresse: ["Produto"], etapaSugerida: "Atendimento",
  clientProfile: "Perfil", nextAction: "Ação"
};
const mock = (registro) => ({ chat: { completions: { create: async (payload) => {
  registro.push(payload);
  return { model: "mock", choices: [{ message: { content: JSON.stringify(RESPOSTA) } }] };
} } } });

// ── 1. O padrão é UMA conversa com a IA ─────────────────────────────────────────────────────
{
  const chamadas = [];
  const r = await analyzeWithBrain({
    lead: { clientName: "Cliente" }, timeline, openai: mock(chamadas),
    cerebroConfig: { corretorNome: "Corretor", metodo: "Método", tom: "Tom" }
  });
  assert.equal(chamadas.length, 1,
    "o padrão precisa ser UMA chamada — duas dobram a espera do corretor, que foi a reclamação");
  assert.equal(r.messages.a, RESPOSTA.mensagens.recomendada, "e a análise continua entregando as três mensagens");
}

// ── 2. O modo de duas etapas não foi apagado — continua a um comando de distância ────────────
{
  const chamadas = [];
  await analyzeWithBrain({
    lead: { clientName: "Cliente" }, timeline, openai: mock(chamadas),
    cerebroConfig: { corretorNome: "Corretor", metodo: "Método", tom: "Tom" }, etapas: "2"
  });
  assert.equal(chamadas.length, 2, "com etapas=2 o modo continua funcionando, pra dar pra medir");
}
assert.match(pipeline, /String\(etapas \?\? process\.env\.DIRECIONA_ANALISE_ETAPAS \?\? "1"\)\.trim\(\) === "2"/,
  "e liga sem publicar código, por variável de ambiente");

// ── 3. Na importação, as duas leituras rodam JUNTAS ─────────────────────────────────────────
assert.match(storage, /await Promise\.all\(\[lerVisuaisDaImportacao\(\), lerLinksDaImportacao\(\)\]\);/,
  "imagem/PDF e link são independentes: em fila, somavam 22s + 20s antes de a análise começar");
{
  // Cada uma continua com a SUA janela e o SEU teto do dia — juntar não pode virar afrouxar.
  const visuais = storage.slice(storage.indexOf("const lerVisuaisDaImportacao"), storage.indexOf("const lerLinksDaImportacao"));
  const links = storage.slice(storage.indexOf("const lerLinksDaImportacao"), storage.indexOf("await Promise.all(["));
  assert.match(visuais, /deadlineTs: Date\.now\(\) \+ 22000/, "a leitura de imagem/PDF mantém a janela de 22s");
  assert.match(visuais, /verificarLimiteLeituraVisual\(organizationId\)/, "e o teto do dia");
  assert.match(links, /deadlineTs: Date\.now\(\) \+ 20000/, "a leitura de link mantém a janela de 20s");
  assert.match(links, /verificarLimiteLeituraVisual\(organizationId\)/, "e o teto do dia");
  // Fail-open dos dois lados: falha de leitura nunca pode derrubar a importação.
  assert.match(visuais, /catch \(erroVisual\)/);
  assert.match(links, /catch \(erroLink\)/);
}

// ── 4. O registro da bateria conta a verdade sobre esta versão ───────────────────────────────
{
  const reg = JSON.parse(fs.readFileSync(new URL("../evals/assinatura-do-prompt.json", import.meta.url), "utf8"));
  assert.match(reg.resultado, /RETORNO ao estado medido/i,
    "o registro precisa deixar claro que a v1346 volta ao estado medido, e não inventa um novo");
  assert.match(reg.resultado, /156 de 191/, "com o número da medição que volta a valer");
}

console.log("v1346-analise-volta-a-ser-uma-chamada: ok");
