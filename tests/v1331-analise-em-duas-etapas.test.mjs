import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain } from "../api/_pipeline.js";

// v1331 — ENTENDER PRIMEIRO, ESCREVER DEPOIS (ligável, ainda não ligado).
//
// A primeira medição da bateria, feita pelo dono no painel em 20/08/2026, deu 156 de 191 pontos.
// O padrão das falhas estava quase todo na hora de ESCREVER: as três mensagens não mudavam de
// abordagem depois do silêncio, não propunham passo concreto com dia e hora, não reconheciam o
// atraso do próprio corretor. O fato estava na mão da IA (o fichário da v1329 entrega tudo isso) e
// mesmo assim não virava mensagem — sinal de pedido grande demais, com o modelo pulando de
// "entender" para "redigir" dentro da mesma resposta.
//
// Este teste guarda o modo novo: duas chamadas, cada uma com uma tarefa. Ele entra DESLIGADO —
// quem liga é etapas=2 (o botão "Medir o modo novo" do painel) ou DIRECIONA_ANALISE_ETAPAS=2 na
// hospedagem, depois que a medição provar que é melhor.

const RESPOSTA = {
  quemEhOCliente: "Cliente",
  summary: "Resumo",
  leituraDaConversa: { comoConduzir: "conduzir assim", aVirada: "Nenhuma" },
  diagnostico: { ultimaPessoaFalar: "contato" },
  mensagens: { recomendada: "Bom dia, Cliente, mensagem um?", maisSuave: "Bom dia, Cliente, mensagem dois?", maisDireta: "Bom dia, Cliente, mensagem três?" },
  produtoInteresse: "Produto", produtosInteresse: ["Produto"], etapaSugerida: "Atendimento",
  clientProfile: "Perfil", nextAction: "Ação"
};

const timeline = [
  { date: "09/05/2026", time: "18:30", author: "Cliente", text: "Gostei do apartamento e quero entender as condições." },
  { date: "10/05/2026", time: "09:00", author: "Corretor Sanchai", text: "Bom dia! Te envio as condições ainda hoje." }
];

function mock(chamadas) {
  return { chat: { completions: { create: async payload => {
    chamadas.push(payload);
    return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify(RESPOSTA) } }] };
  } } } };
}

const cerebro = { corretorNome: "Corretor Sanchai", metodo: "Método do corretor.", tom: "Tom do corretor." };

// ── 1. Desligado é o padrão: uma chamada só ─────────────────────────────────────────────────
{
  const chamadas = [];
  const r = await analyzeWithBrain({ lead: { clientName: "Cliente" }, timeline, openai: mock(chamadas), cerebroConfig: cerebro });
  assert.equal(chamadas.length, 1, "sem pedir nada, a análise continua exatamente como sempre foi");
  assert.equal(r.messages.a, RESPOSTA.mensagens.recomendada);
}

// ── 2. Ligado: uma chamada para entender, outra para escrever ───────────────────────────────
{
  const chamadas = [];
  const r = await analyzeWithBrain({ lead: { clientName: "Cliente" }, timeline, openai: mock(chamadas), cerebroConfig: cerebro, etapas: "2" });
  assert.equal(chamadas.length, 2, "modo novo: leitura primeiro, redação depois");

  const leitura = chamadas[0].messages.find(m => m.role === "user")?.content || "";
  const redacao = chamadas[1].messages.find(m => m.role === "user")?.content || "";

  // A leitura recebe a conversa inteira e NÃO pede mensagem nenhuma.
  assert.match(leitura, /LEITURA OBRIGATÓRIA/, "a etapa 1 é a leitura da conversa");
  assert.match(leitura, /Gostei do apartamento/, "com a conversa dentro");
  assert.ok(!leitura.includes('"mensagens":{'), "a etapa que entende não escreve mensagem");
  assert.ok(!leitura.includes("REGRAS PARA AS TRÊS MENSAGENS"), "e não carrega as regras de escrita");

  // A redação recebe o diagnóstico pronto, as regras e o piso de forma.
  assert.match(redacao, /ESCREVER AS TRÊS MENSAGENS/, "a etapa 2 escreve");
  assert.match(redacao, /A LEITURA QUE VOCÊ JÁ FEZ DESTA CONVERSA/, "em cima do diagnóstico já pronto");
  assert.match(redacao, /conduzir assim/, "o diagnóstico da etapa 1 chega inteiro na etapa 2");
  assert.match(redacao, /REGRAS PARA AS TRÊS MENSAGENS/, "com as regras das três, palavra por palavra");
  assert.match(redacao, /PISO DE FORMA/, "e com o piso de forma (cumprimento, intervalo, fim que dá resposta)");
  assert.match(redacao, /"mensagens":\{/, "pedindo o formato das três");
  assert.ok(!redacao.includes("LEITURA OBRIGATÓRIA"), "a etapa que escreve não refaz a leitura");

  // O Cérebro manda igual nas duas.
  const sysLeitura = chamadas[0].messages.find(m => m.role === "system")?.content || "";
  const sysRedacao = chamadas[1].messages.find(m => m.role === "system")?.content || "";
  assert.equal(sysRedacao, sysLeitura, "o Cérebro é o mesmo nas duas etapas");
  assert.match(sysRedacao, /Método do corretor\./);

  // E o resultado final é o de sempre — a tela não muda.
  assert.equal(r.messages.a, RESPOSTA.mensagens.recomendada);
  assert.equal(r.sugestoesPendentes, false);
}

// ── 3. Nenhuma etapa reescreve o texto da outra ─────────────────────────────────────────────
{
  const chamadas = [];
  await analyzeWithBrain({ lead: { clientName: "Cliente" }, timeline, openai: mock(chamadas), cerebroConfig: cerebro, etapas: "2" });
  const redacao = chamadas[1].messages.find(m => m.role === "user")?.content || "";
  for (const jaEscrita of Object.values(RESPOSTA.mensagens)) {
    assert.ok(!redacao.includes(jaEscrita),
      "a etapa que escreve nunca recebe mensagem pronta pra consertar — a rede de reescrita saiu na v1315 e não volta");
  }
}

// ── 4. Falhando a redação, a análise não é jogada fora ──────────────────────────────────────
{
  let chamada = 0;
  const openai = { chat: { completions: { create: async () => {
    chamada += 1;
    if (chamada === 1) return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify({ ...RESPOSTA, mensagens: undefined }) } }] };
    throw new Error("a etapa de escrita caiu");
  } } } };
  const r = await analyzeWithBrain({ lead: { clientName: "Cliente" }, timeline, openai, cerebroConfig: cerebro, etapas: "2" });
  assert.equal(r.mode, "openai", "a leitura sobrevive à queda da redação");
  assert.equal(r.summary, "Resumo", "e o que foi entendido continua lá");
  assert.equal(r.sugestoesPendentes, true, "as três ficam pendentes, como já acontecia quando a IA não devolvia mensagem");
}

// ── 5. O modo novo é ligável sem publicar código, e o painel sabe pedir ─────────────────────
{
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  assert.match(pipeline, /String\(etapas \?\? process\.env\.DIRECIONA_ANALISE_ETAPAS \?\? "1"\)\.trim\(\) === "2"/,
    "desligado por padrão; liga por parâmetro ou por variável de ambiente");
  assert.match(pipeline, /rota: "analise-mensagens"/, "a etapa que escreve registra o próprio custo");

  const rota = fs.readFileSync(new URL("../api/diagnostico.js", import.meta.url), "utf8");
  assert.match(rota, /etapas=2 só naquela medição|const etapas = String\(req\.query\?\.etapas/,
    "a rota da bateria aceita medir o modo novo sem ligá-lo pra ninguém");

  const painel = fs.readFileSync(new URL("../admin-plataforma.html", import.meta.url), "utf8");
  assert.match(painel, /id="btnBateriaNova"/, "o painel tem o botão de medir o modo novo");
  assert.match(painel, /&etapas=2/, "e ele pede o modo novo na medição");
  assert.match(painel, /MODO NOVO \(duas etapas\)/, "o placar diz qual dos dois foi medido");
}

console.log("v1331-analise-em-duas-etapas: ok");
