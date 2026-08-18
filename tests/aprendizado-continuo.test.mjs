import assert from "node:assert/strict";
import fs from "node:fs";
import { prepararTimelineParaAprendizado, extrairInteligenciaObservada, jeitoAprendidoCompacto } from "../api/_pipeline.js";

const timelineLorena = [
  { date:"09/06/2026", time:"15:51", author:"Construtora Senger", text:"No momento não estamos adquirindo novas áreas. Vou levar a informação do terreno para conhecimento da direção." },
  { date:"09/06/2026", time:"15:51", author:"Construtora Senger", text:"Você mantém o interesse no Boulevard ou depende dessa permuta do terreno?" },
  { date:"09/06/2026", time:"15:53", author:"Lorena Pedersen Boulevard", text:"Dependo sim" },
  { date:"09/06/2026", time:"15:55", author:"Construtora Senger", text:"Nesse caso vou apresentar na próxima reunião e havendo interesse voltamos a conversar." },
  { date:"13/07/2026", time:"13:29", author:"OpenAI", text:"Lorena, conseguiu algum retorno da direção sobre a permuta?" },
  { date:"13/07/2026", time:"13:30", author:"Sistema", type:"sugestao-ia", source:"assistant", text:"Lorena, conseguiu algum retorno da direção sobre a permuta?" },
  { date:"13/07/2026", time:"13:37", author:"Construtora Senger", text:"Olá Dona Lorena! Espero que esteja bem. Estou entrando em contato para ver se já vendeu seu terreno e podemos dar continuidade na negociação do Boulevard?" }
];

const material = prepararTimelineParaAprendizado(timelineLorena, "Lorena Pedersen Boulevard");
assert.match(material, /já vendeu seu terreno/i, "a condução real mais recente precisa entrar no aprendizado");
assert.doesNotMatch(material, /algum retorno da direção/i, "sugestão da própria IA nunca pode virar aprendizado");
assert.match(material, /CORRETOR \(Construtora Senger\)/, "o autor comercial precisa ser reconhecido como corretor");

// (v1194 — o teste de ranquearCasosAprendidos saiu junto com a função: ela não tinha nenhum
// chamador fora deste teste desde que o prompt passou a usar jeitoAprendidoCompacto.)

let promptRecebido = "";
const openaiMock = {
  chat:{ completions:{ create: async payload => {
    promptRecebido = payload.messages?.[0]?.content || "";
    return { choices:[{ message:{ content:JSON.stringify({
      tom:"Direto e contextual",
      tecnicas:[], objecoes:[], produtoVsPerfil:[], movimentosQueAvancaram:[], movimentosQueTravaram:[], padroesFollowup:[],
      casos:[{
        situacao:"Compra condicionada à venda de terreno próprio",
        sinalCliente:"Cliente disse que dependia da permuta",
        impedimento:"Terreno ainda não vendido",
        conducaoCorretor:"Perguntou se o terreno já foi vendido para dar continuidade ao Boulevard",
        resultado:"observada",
        evidenciaResultado:"sem resposta posterior ainda",
        regra:"Quando a compra depende da venda do bem próprio e a permuta não avançou, verificar se o bem já foi vendido antes de retomar a compra",
        produto:"Boulevard",
        etapa:"retomada"
      }]
    }) } }] };
  } } }
};
const extraido = await extrairInteligenciaObservada(material, openaiMock);
assert.equal(extraido.casos?.[0]?.resultado, "observada");
assert.match(promptRecebido, /Nunca aprenda com texto identificado como sugestão/i);
assert.match(promptRecebido, /sem resposta posterior ainda/i);

const pipelineSrc = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const leadUpdateSrc = fs.readFileSync(new URL("../api/lead-update.js", import.meta.url), "utf8");
const reanaliseSrc = fs.readFileSync(new URL("../api/reanalisar-lead.js", import.meta.url), "utf8");
const appSrc = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
// v1092 — esta verificação procurava um texto fixo dentro do código-fonte, e esse texto morava
// numa função que ninguém chamava (casosSemelhantesPrompt). Ou seja: passava verde enquanto o
// aprendizado podia perfeitamente não estar chegando na IA. Agora testa o EFEITO — o que o
// aprendizado do corretor realmente coloca no prompt.
{
  const cerebroAprendido = {
    inteligenciaAprendida: {
      tons: [{ texto: "fala curta, direta e cordial, sempre tratando por senhor/senhora" }],
      objecoes: [
        { objecao: "está caro", respostaUsada: "mostro o custo por metro e comparo com o aluguel atual", funcionou: true },
        { objecao: "vou pensar", respostaUsada: "insisto pra fechar na hora", funcionou: false }
      ],
      tecnicas: [{ texto: "convido pra um café na construtora antes de falar de preço" }],
      produtoVsPerfil: [{ perfilCliente: "casal com filho pequeno", produto: "Boulevard", reacao: "gostou da área de lazer" }],
      padroesFollowup: [{ texto: "retomo perguntando se conseguiu vender o bem que trava a compra" }]
    }
  };
  const bloco = jeitoAprendidoCompacto(cerebroAprendido, "casal com filho pequeno achou caro o Boulevard");

  assert.ok(bloco, "com aprendizado gravado, o prompt PRECISA receber o bloco do jeito do corretor");
  assert.match(bloco, /custo por metro/, "a resposta de objeção que funcionou precisa chegar na IA");
  assert.match(bloco, /café na construtora/, "a técnica aprendida precisa chegar na IA");
  assert.match(bloco, /senhor\/senhora/, "o tom de voz aprendido precisa chegar na IA");
  // v1301 — INVERTIDO POR ORDEM DO DONO ("tira as duas fontes", 18/08/2026). O cruzamento
  // produto × perfil escrevia no pedido o NOME DO EMPREENDIMENTO oferecido a OUTRO cliente, e era
  // desse material que saía o endereço inventado nas sugestões (print das 19h36: um apartamento de
  // 3 linhas de conversa voltou com empreendimento e ponto de referência que ninguém citou). Ele
  // continua sendo aprendido e continua na tela de Aprendizado; só não entra mais no pedido.
  assert.doesNotMatch(bloco, /Boulevard/,
    "nome de produto oferecido a OUTRO cliente não pode chegar na hora de escrever a mensagem");
  assert.match(bloco, /vender o bem/, "o padrão de follow-up precisa chegar na IA");

  assert.doesNotMatch(bloco, /insisto pra fechar na hora/,
    "o que NÃO funcionou jamais pode ser ensinado como se funcionasse");
  assert.match(bloco, /N[ÃA]O copie literal/i,
    "a IA precisa ser instruída a adaptar, nunca copiar a frase pronta");

  // Cérebro sem aprendizado nenhum não pode inventar bloco (senão a IA recebe regra do nada).
  assert.equal(jeitoAprendidoCompacto({}, "qualquer coisa"), "",
    "sem aprendizado gravado, nada pode ser injetado no prompt");
  assert.equal(jeitoAprendidoCompacto({ inteligenciaAprendida: {} }, "qualquer coisa"), "",
    "aprendizado vazio também não pode virar texto no prompt");
}
assert.match(leadUpdateSrc, /marcarAprendizadoPendente/);
assert.match(reanaliseSrc, /marcarAprendizadoPendente/);
assert.match(appSrc, /iniciarAprendizadoContinuoAutomatico/);
assert.match(appSrc, /finalizar-bootstrap-aprendizado/);
assert.match(appSrc, /processar-aprendizado-pendente/);

console.log("aprendizado-continuo: ok");
