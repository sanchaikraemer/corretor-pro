import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain } from "../api/_pipeline.js";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const leadUpdate = fs.readFileSync(new URL("../api/lead-update.js", import.meta.url), "utf8");
const reanalisar = fs.readFileSync(new URL("../api/reanalisar-lead.js", import.meta.url), "utf8");

// Regressão do erro encontrado na v851: os campos vazios do formulário oculto não
// podem apagar o Método salvo antes de a tela do Cérebro ser carregada.
assert.match(app, /let cerebroFormularioCarregado = false;/);
assert.match(app, /if \(cerebroFormularioCarregado\) \{/);
assert.match(app, /localStorage\.setItem\(CEREBRO_LS_KEY, JSON\.stringify\(config\)\)/);

// O Cérebro persistido no banco precisa ser consultado antes de aceitar um payload
// parcial do navegador.
const loadStart = pipeline.indexOf("async function loadCerebroConfig");
const loadEnd = pipeline.indexOf("// Carrega SÓ o banco", loadStart);
const loadBlock = pipeline.slice(loadStart, loadEnd);
assert.ok(loadBlock.indexOf('eq("chave", "direciona-cerebro")') < loadBlock.indexOf("hasCerebroInstructions(frontendConfig)"));

// v1132 — ESTA PARTE MUDOU DE PROPÓSITO. NÃO "restaure" o comportamento antigo.
//
// Até a v1131, sem Cérebro configurado a análise era RECUSADA: nenhuma chamada à IA, nenhuma
// mensagem, e uma tela de erro. A intenção (não inventar conversa fiada comercial) continua valendo
// e continua protegida abaixo — mas a RECUSA era errada pro produto, e o dono flagrou isso testando
// como cliente: quem acabou de criar a conta não sabe o que é o Cérebro nem pra que serve, e era
// obrigado a configurá-lo ANTES de ver o sistema funcionar uma vez. Ninguém preenche formulário pra
// um produto que ainda não provou nada — o primeiro passo de todo cliente novo terminava num beco.
//
// Agora, sem Cérebro, a análise ACONTECE em modo prévia, apoiada só na conversa que ele exportou.
// O que este teste passa a garantir é que a prévia não abre a porta pra invenção.
let chamadas = 0;
let systemPromptCapturado = "";
const openaiPrevia = {
  chat: { completions: { create: async (args) => {
    chamadas++;
    systemPromptCapturado = String(args?.messages?.find(m => m.role === "system")?.content || "");
    return {
      model: "gpt-teste",
      choices: [{ message: { content: JSON.stringify({
        summary: "Cliente pediu informações; ninguém respondeu ainda.",
        mensagens: {
          recomendada: "Oi! Vi sua mensagem por aqui, me conta o que você procura que eu já te ajudo.",
          maisSuave: "Olá! Passando pra saber se você ainda tem interesse — fico à disposição.",
          maisDireta: "Oi! Consegue me dizer hoje o que procura pra eu te mandar as opções certas?"
        }
      }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 10 }
    };
  } } }
};
const timeline = [{ date: "16/07/2026", time: "10:00", author: "Cliente", text: "Quero informações." }];
const semCerebro = await analyzeWithBrain({
  lead: { clientName: "Cliente" },
  timeline,
  openai: openaiPrevia,
  cerebroConfig: { corretorNome: "Sanchai", metodo: "", tom: "", diferenciais: "", evitar: "", regras: [], objecoes: [] }
});

// 1. A prévia acontece de verdade — é o que o cliente novo precisa ver no primeiro uso.
// v1235 — antes este assert exigia exatamente 1 chamada. O que ele protege é que a análise
// ACONTEÇA (a recusa da v1131 é que era o beco); o número exato deixou de ser o jeito de medir
// isso: a resposta de exemplo deste mock traz "fico à disposição" e "se você ainda tem interesse",
// dois clichês da lista dura, então a conferência das três mensagens manda reescrever — que é
// exatamente o comportamento novo e desejado, inclusive na prévia.
assert.ok(chamadas >= 1, "sem Cérebro, a análise precisa ACONTECER (modo prévia) — era aqui que o cliente novo travava");
assert.equal(semCerebro.mode, "openai");
assert.equal(semCerebro.modoPrevia, true, "o resultado precisa se identificar como prévia, pra a tela convidar a configurar");
assert.equal(semCerebro.sugestoesPendentes, false, "a prévia é utilizável: não pode voltar marcada como pendente");
assert.ok([semCerebro.messages.a, semCerebro.messages.b, semCerebro.messages.c].every(m => String(m || "").trim().length >= 10),
  "a prévia precisa entregar as três mensagens preenchidas");

// 2. E a prévia precisa ir pra IA AMARRADA: sem Cérebro, a única fonte de fato é a conversa.
//    Estas instruções são o que impede a prévia de virar invenção comercial.
assert.match(systemPromptCapturado, /MODO PRÉVIA/, "o prompt precisa avisar a IA de que está sem Cérebro");
assert.match(systemPromptCapturado, /NUNCA afirme preço, condição de pagamento, desconto, prazo, nome de empreendimento, endereço/,
  "a prévia precisa proibir explicitamente afirmar qualquer dado comercial que não esteja na conversa");
assert.match(systemPromptCapturado, /Não identificado/,
  "campo sem base na conversa precisa continuar caindo em Não identificado");
// v1240 — o antigo "INTELIGÊNCIA COMERCIAL BASE" foi partido em dois, a pedido do dono ("a única
// regra era seguir as ordens do cerebro"): a parte que PROÍBE INVENTAR continua entrando sempre,
// e o método comercial virou só um ponto de partida pra quem ainda não escreveu o Cérebro. O que
// este assert protege — a prévia não pode abrir a porta pra invenção — continua igual.
assert.match(systemPromptCapturado, /NADA DE INVENTAR/,
  "o piso comercial (que já proíbe inventar) precisa continuar entrando no prompt");

// 3. Com Cérebro configurado, nada muda: não é prévia.
const comCerebro = await analyzeWithBrain({
  lead: { clientName: "Cliente" },
  timeline,
  openai: openaiPrevia,
  cerebroConfig: { corretorNome: "Sanchai", metodo: "Método próprio de atendimento", tom: "", diferenciais: "", evitar: "", regras: [], objecoes: [] }
});
assert.equal(comCerebro.modoPrevia, false, "quem já configurou o Cérebro não pode receber o convite de prévia");
assert.doesNotMatch(systemPromptCapturado, /MODO PRÉVIA/, "com Cérebro, as instruções de prévia não podem aparecer no prompt");
assert.match(systemPromptCapturado, /Método próprio de atendimento/, "com Cérebro, o conteúdo dele precisa chegar no prompt");

// Nenhum texto comercial pronto pode permanecer nos fallbacks de criação manual.
assert.doesNotMatch(leadUpdate, /Oi \$\{primeiroNome\}/);
assert.doesNotMatch(leadUpdate, /me passa o que ele procura e a faixa de investimento/i);
assert.match(leadUpdate, /arquiteturaMensagens: ARQUITETURA_MENSAGENS_ATUAL/);
assert.match(leadUpdate, /sugestoesPendentes: true/);

// Uma reanálise incompleta não pode ser salva como sucesso.
assert.match(reanalisar, /novoAnalysis\.mode !== "openai"/);
assert.match(reanalisar, /nenhuma sugestão foi salva/i);

console.log("v852-cerebro-integridade: ok");
