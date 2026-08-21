import assert from "node:assert/strict";
import {
  montarEstadoComercialDeterministico,
  montarFicharioDaConversa,
  promessasNaoCumpridasDoCorretor,
  topicosComerciaisConfirmadosDoCliente,
  avisosDeQualidadeDasMensagens
} from "../api/_pipeline.js";

const HOJE = new Date("2026-08-20T21:00:00-03:00");
const corretor = "Miguel Kirinus";
const lead = { clientName: "Ana" };

// 1. Respostas explícitas viram tópicos fechados, com a fala original como prova.
{
  const timeline = [
    { author: corretor, text: "Você procura 2 ou 3 dormitórios? Seria para morar ou investir?", date: "20/08/2026", time: "10:00" },
    { author: "Ana", text: "Quero 3 dormitórios para morar. Pode ser na planta, não tenho pressa. Consigo investir até R$ 800.000 e pretendo financiar o saldo.", date: "20/08/2026", time: "10:05" }
  ];
  const topicos = topicosComerciaisConfirmadosDoCliente(timeline, corretor, lead, HOJE);
  const ids = new Set(topicos.map(t => t.id));
  for (const id of ["dormitorios", "finalidade", "momento_imovel", "prazo", "faixa_valor", "financiamento"]) {
    assert.ok(ids.has(id), `o tópico ${id} deveria estar confirmado pela fala explícita do cliente`);
  }
  assert.ok(topicos.every(t => /Quero 3 dormitórios|Pode ser na planta|Consigo investir/.test(t.fala)),
    "cada tópico precisa carregar a fala real do cliente como evidência");
}

// 2. Pergunta do cliente não vira preferência inventada.
{
  const timeline = [
    { author: "Ana", text: "Vocês têm alguma opção no centro?", date: "20/08/2026", time: "10:05" }
  ];
  const ids = new Set(topicosComerciaisConfirmadosDoCliente(timeline, corretor, lead, HOJE).map(t => t.id));
  assert.ok(!ids.has("localizacao"), "perguntar se existe opção no centro não pode cravar centro como preferência fechada");
}

// 3. O estado factual é único e o fichário usa exatamente esse estado, sem recalcular outra verdade.
{
  const timeline = [
    { author: corretor, text: "Você procura 2 ou 3 dormitórios?", date: "20/08/2026", time: "10:00" },
    { author: "Ana", text: "3 dormitórios.", date: "20/08/2026", time: "10:05" }
  ];
  const estado = montarEstadoComercialDeterministico(timeline, corretor, lead, HOJE);
  assert.equal(estado.versao, 1);
  assert.ok(estado.topicosConfirmados.some(t => t.id === "dormitorios"));
  const fichario = montarFicharioDaConversa(timeline, corretor, lead, HOJE, estado);
  assert.match(fichario, /TÓPICOS COMERCIAIS QUE O CLIENTE JÁ RESPONDEU EXPLICITAMENTE/);
  assert.match(fichario, /quantidade de dormitórios/);
  assert.match(fichario, /3 dormitórios/);
}

// 4. Promessa composta só fecha quando TODOS os itens identificáveis apareceram depois.
{
  const base = [
    { author: corretor, text: "Posso te enviar o valor, as fotos e as condições de pagamento?", date: "20/08/2026", time: "10:00" },
    { author: corretor, text: "[Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]", date: "20/08/2026", time: "10:02" },
    { author: corretor, text: "Entrada de 20% e saldo em 30x direto.", date: "20/08/2026", time: "10:03" }
  ];
  const abertas = promessasNaoCumpridasDoCorretor(base, corretor, lead, HOJE);
  assert.equal(abertas.length, 1, "foto + condição não podem apagar a promessa do valor que ainda faltou");
  assert.deepEqual(abertas[0].faltando, ["valor"]);

  const completa = [...base,
    { author: corretor, text: "O valor é R$ 600.000.", date: "20/08/2026", time: "10:04" }
  ];
  assert.equal(promessasNaoCumpridasDoCorretor(completa, corretor, lead, HOJE).length, 0,
    "quando valor, fotos e condições aparecem, a promessa fica cumprida");
}


// 4-B. Oferta condicionada à escolha do cliente não vira “promessa descumprida”.
{
  const timeline = [
    { author: corretor, text: "Posso te enviar fotos, detalhes e as condições de financiamento por aqui. O que você gostaria de ver primeiro?", date: "20/08/2026", time: "10:00" },
    { author: "Ana", text: "Quantos metros quadrados?", date: "20/08/2026", time: "10:01" },
    { author: corretor, text: "132 m² privativos.", date: "20/08/2026", time: "10:02" }
  ];
  assert.equal(promessasNaoCumpridasDoCorretor(timeline, corretor, lead, HOJE).length, 0,
    "oferta em que o cliente ainda escolhe o que quer receber não pode virar pendência automática");
}

// 5. A conferência avisa quando a IA volta a fazer pergunta genérica sobre tópico já respondido,
// sem bloquear pergunta de aprofundamento legítima.
{
  const topicosRespondidos = [{ id: "dormitorios", nome: "quantidade de dormitórios" }];
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Bom dia Ana, você procura 2 ou 3 dormitórios?" },
    { qual: "b", texto: "Bom dia Ana, nos 3 dormitórios que você busca, precisa que todos sejam suítes?" }
  ], {
    conversa: "Ana: Quero 3 dormitórios.",
    cerebro: "",
    catalogo: [],
    topicosRespondidos
  });
  const a = avisos.find(x => x.qual === "a");
  assert.ok(a?.motivos.some(m => /já respondeu/i.test(m)), "a pergunta genérica repetida deve gerar aviso");
  const b = avisos.find(x => x.qual === "b");
  assert.ok(!b?.motivos.some(m => /já respondeu/i.test(m)), "aprofundar o requisito não pode ser tratado como repetição");
}

console.log("v1337-estado-comercial-deterministico: ok");
