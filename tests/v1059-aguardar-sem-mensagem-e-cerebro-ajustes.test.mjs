import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain } from "../api/_pipeline.js";

// v1059 — depois de revisar o Método, Tom de voz, Diferenciais, O que evitar, Regras comerciais e
// Sinais de objeção reais do dono (usando a conversa da Karine como caso de teste), duas das
// categorias de objeção ("VAI PENSAR OU AINDA NÃO É O MOMENTO" e "NEGATIVA CLARA") deixam claro que
// às vezes a leitura certa é NÃO mandar nenhuma mensagem agora — mas a análise sempre entregava 3
// sugestões prontas, sem essa opção. Também: o ponto do "decorado" usava a palavra "insista", que
// podia colidir com a regra de nunca insistir depois de uma negativa clara; e o argumento de
// "valoriza até a entrega" não deixava claro que é um mecanismo geral do mercado, não uma garantia
// sobre um imóvel específico.

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// 1) Texto fixo: "insista" saiu do ponto do decorado; "valoriza até a entrega" ganhou o aviso de
//    que é um mecanismo geral, sem prometer número/percentual pro imóvel específico.
// ---------------------------------------------------------------------------
assert.doesNotMatch(pipeline, /insista com leveza/, "'insista' não pode mais aparecer no texto fixo (colide com 'não insistir após negativa clara')");
assert.match(pipeline, /retome com leveza/, "o ponto do decorado precisa continuar existindo, só sem a palavra 'insista'");
// v1084 — o argumento de valorização saiu de vez do texto fixo. A v1059 tinha resolvido metade
// do problema (proibir cravar número/percentual), mas a afirmação em si ("congela o preço",
// "quanto mais cedo, mais barato") continuava sendo dita como fato — e isso é uma CONDIÇÃO
// comercial, que depende da construtora de cada corretor. Agora nenhuma condição pode ser
// afirmada sem estar no Cérebro ou na conversa; o que sobrou é só o roteiro de para onde olhar.
assert.doesNotMatch(pipeline, /congela o preço/, "o texto fixo não pode afirmar congelamento de preço");
assert.doesNotMatch(pipeline, /mais barato e maior o prazo/, "o texto fixo não pode afirmar condição de lançamento");
assert.match(pipeline, /Toda condição \(congelamento de preço, desconto, prazo, forma de pagamento, valorização, aceitação de permuta\) só pode ser mencionada se estiver escrita no Cérebro Comercial ou tiver sido dita na própria conversa/,
  "o piso comercial precisa proibir explicitamente afirmar condição que não veio do Cérebro nem da conversa");

// ---------------------------------------------------------------------------
// 2) Schema: recomendacaoContato precisa estar no formato pedido à IA, com instrução própria.
// ---------------------------------------------------------------------------
assert.match(pipeline, /"recomendacaoContato":\{\s*"aguardar":false,\s*"motivo":"texto"\s*\}/, "o formato JSON precisa incluir recomendacaoContato");
assert.match(pipeline, /RECOMENDAÇÃO DE CONTATO/, "precisa haver instrução explicando quando marcar aguardar=true");

// ---------------------------------------------------------------------------
// 3) Comportamento fim a fim: aguardar=true chega no resultado com o motivo; sem o campo (ou
//    aguardar=false) o resultado cai no padrão seguro {aguardar:false, motivo:""} — nunca aparece
//    um motivo "pendurado" sem aguardar=true.
// ---------------------------------------------------------------------------
const chamadas = [];
function mockCom(extra) {
  return {
    chat: { completions: { create: async payload => {
      chamadas.push(payload);
      return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify({
        summary: "Resumo",
        diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento" },
        mensagens: { recomendada: "Boa tarde?", maisSuave: "Boa tarde?", maisDireta: "Boa tarde?" },
        produtoInteresse: "Produto", produtosInteresse: ["Produto"], etapaSugerida: "Atendimento",
        clientProfile: "Perfil", nextAction: "Ação",
        ...extra
      }) } }] };
    } } }
  };
}
const timeline = [{ date: "23/07/2026", time: "16:16", author: "Karine", text: "ainda estamos olhando com olhar de curiosos, se formos investir vai ser mais pra frente" }];

const comAguardar = await analyzeWithBrain({
  lead: { clientName: "Karine" }, timeline,
  openai: mockCom({ recomendacaoContato: { aguardar: true, motivo: "Cliente disse que vai ser mais pra frente, sem gatilho novo pra contato agora." } }),
  cerebroConfig: { metodo: "método do corretor" }
});
assert.equal(comAguardar.recomendacaoContato.aguardar, true);
assert.equal(comAguardar.recomendacaoContato.motivo, "Cliente disse que vai ser mais pra frente, sem gatilho novo pra contato agora.");

const semAguardar = await analyzeWithBrain({
  lead: { clientName: "Karine2" }, timeline,
  openai: mockCom({ recomendacaoContato: { aguardar: false, motivo: "" } }),
  cerebroConfig: { metodo: "método do corretor" }
});
assert.equal(semAguardar.recomendacaoContato.aguardar, false);
assert.equal(semAguardar.recomendacaoContato.motivo, "");

const semCampoNenhum = await analyzeWithBrain({
  lead: { clientName: "Karine3" }, timeline,
  openai: mockCom({}),
  cerebroConfig: { metodo: "método do corretor" }
});
assert.equal(semCampoNenhum.recomendacaoContato.aguardar, false, "sem o campo vindo da IA, o padrão precisa ser aguardar=false");
assert.equal(semCampoNenhum.recomendacaoContato.motivo, "", "sem aguardar=true, motivo nunca deve aparecer pendurado");

// Uma IA que manda só o motivo, sem aguardar:true explícito, não pode acionar o aviso — sem isso
// um motivo mal formado poderia vazar como se fosse uma recomendação real.
const motivoSemAguardar = await analyzeWithBrain({
  lead: { clientName: "Karine4" }, timeline,
  openai: mockCom({ recomendacaoContato: { motivo: "texto solto sem aguardar" } }),
  cerebroConfig: { metodo: "método do corretor" }
});
assert.equal(motivoSemAguardar.recomendacaoContato.aguardar, false);
assert.equal(motivoSemAguardar.recomendacaoContato.motivo, "", "motivo só conta quando aguardar veio true explicitamente");

// ---------------------------------------------------------------------------
// UI: a tela do lead precisa mostrar o aviso quando aguardar=true E as mensagens estiverem prontas.
// ---------------------------------------------------------------------------
assert.match(app, /aguardarContato=analiseAtualValida752\(a\) && a\?\.recomendacaoContato\?\.aguardar===true/, "renderLeadFoco precisa calcular aguardarContato a partir da análise");
assert.match(app, /Recomendação agora: aguardar, sem mandar mensagem\./, "a tela do lead precisa ter o aviso");
assert.match(app, /\$\{aguardarContato&&messagesReady\?/, "o aviso só pode aparecer quando há mensagens prontas (senão já existem os outros avisos de 'sem mensagem')");

console.log("v1059-aguardar-sem-mensagem-e-cerebro-ajustes: ok");
