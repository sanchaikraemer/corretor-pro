import assert from "node:assert/strict";
import {
  avisosDeQualidadeDasMensagens,
  semNomeDeCampoNaTela,
  montarFicharioDaConversa
} from "../api/_pipeline.js";

// v1368 — OS PRINTS DE 22/08/2026 (clientes Flavio, Ilario e Julsimar).
//
// Nove sugestões nos três prints. NOVE PERGUNTAS ao cliente. Nenhuma entregava um número, uma
// data ou uma resposta — e o app não reclamava, porque cada mensagem, sozinha, parecia correta.
// Junto vieram duas tarjas vermelhas EM CIMA DE MENSAGENS BOAS e um nome de campo do programa
// aparecendo na tela do corretor.

const ctxComOQueEntregar = { conversa: "Julsimar Premium Office entrada reforcos anuais condicoes de pagamento", cerebro: "", temOQueEntregar: true };
const semNomes = (avisos) => avisos
  .map(a => ({ qual: a.qual, motivos: a.motivos.filter(m => !/^cita "/.test(m)) }))
  .filter(a => a.motivos.length);
const temMotivo = (avisos, re) => semNomes(avisos).some(a => a.motivos.some(m => re.test(m)));

// ── 1. TARJA ERRADA: "promete enviar e não pergunta nada" num pedido perfeito ────────────────
// Print do Flavio. "Me envie uma imagem ou o link" É um pedido — só não tem "?" porque no
// WhatsApp se pede assim. O app só reconhecia pedido com ponto de interrogação.
{
  const avisos = avisosDeQualidadeDasMensagens(
    [{ qual: "c", texto: "Bom dia, Flavio! Me envie uma imagem ou o link do anúncio que viu ontem. Eu confiro e te passo as informações certas." }],
    { conversa: "Flavio anuncio imagem link", cerebro: "" }
  );
  assert.ok(!temMotivo(avisos, /não pergunta nada/), "pedir sem '?' é pedir — não pode levar tarja");
}
// Mas a promessa vazia DE VERDADE continua sendo pega.
{
  const avisos = avisosDeQualidadeDasMensagens(
    [{ qual: "a", texto: "Bom dia! Vou te passar as informações do apartamento ainda hoje." }],
    { conversa: "apartamento", cerebro: "" }
  );
  assert.ok(temMotivo(avisos, /não pergunta nada/), "prometer e não pedir nada continua sendo defeito");
}

// ── 2. TARJA ERRADA: "pede a mesma coisa" em perguntas diferentes ────────────────────────────
// Print do Ilario. A 1 pergunta a FINALIDADE (morar ou investir), a 3 pergunta o PRAZO (morar
// logo ou sem pressa). Compartilham a palavra "morar" — e a 3 só tinha essa palavra, então a
// conta dava 1 de 1 = 100%.
{
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Bom dia, Ilario! Retomando sua pergunta sobre o apartamento: a compra é para morar ou investir?" },
    { qual: "c", texto: "Bom dia, Ilario! Me diga se a ideia é morar logo ou se não há pressa, que eu organizo as informações." }
  ], { conversa: "Ilario apartamento morar investir pressa", cerebro: "" });
  assert.ok(!temMotivo(avisos, /mesma coisa/), "finalidade e prazo são perguntas diferentes");
}
// Duas pedindo REALMENTE a mesma coisa continuam sendo pegas — inclusive com uma palavra só.
{
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Podemos marcar a visita na segunda?" },
    { qual: "b", texto: "Consegue fazer a visita essa semana?" }
  ], { conversa: "visita", cerebro: "" });
  assert.ok(temMotivo(avisos, /mesma coisa/), "duas pedindo a visita continuam sendo duas iguais");
}
{
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Qual a faixa de valor que cabe no seu orçamento?" },
    { qual: "b", texto: "Me diz até quanto você pretende investir na faixa de valor?" }
  ], { conversa: "faixa valor orcamento investir", cerebro: "" });
  assert.ok(temMotivo(avisos, /mesma coisa/), "duas pedindo a faixa continuam sendo duas iguais");
}

// ── 3. AS TRÊS SÓ PERGUNTAM — o defeito que atravessou os três prints ────────────────────────
{
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Bom dia, Julsimar! O que pesa mais hoje: reduzir a entrada ou distribuir parte do pagamento nos reforços anuais?" },
    { qual: "b", texto: "Bom dia, Julsimar! Eu posso preparar duas formas de pagamento para comparar. Qual delas você quer ver primeiro?" },
    { qual: "c", texto: "Bom dia, Julsimar! Para eu montar uma condição, me diga quanto pensa em colocar na entrada." }
  ], ctxComOQueEntregar);
  assert.equal(semNomes(avisos).length, 3, "as três precisam ser marcadas, não uma");
  assert.ok(temMotivo(avisos, /só perguntam/), "havendo o que entregar, três perguntas é interrogatório");
}
// Basta UMA entregar número pra deixar de ser interrogatório.
{
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Bom dia, Julsimar! Com entrada de R$ 38.000 fica em 48x de R$ 4.900 mais 4 aportes anuais. Fecha assim ou prefere reduzir a entrada?" },
    { qual: "b", texto: "Bom dia, Julsimar! Posso preparar duas formas para comparar. Qual você quer ver primeiro?" },
    { qual: "c", texto: "Bom dia, Julsimar! Me diga quanto pensa em colocar na entrada." }
  ], ctxComOQueEntregar);
  assert.ok(!temMotivo(avisos, /só perguntam/), "uma que entrega número já resolve");
}
// E em conversa que ainda é pura qualificação (nada pra entregar), perguntar é o certo.
{
  const avisos = avisosDeQualidadeDasMensagens([
    { qual: "a", texto: "Bom dia! Você procura para morar ou investir?" },
    { qual: "b", texto: "Bom dia! Quantos dormitórios você precisa?" },
    { qual: "c", texto: "Bom dia! Me diga em qual região você quer." }
  ], { conversa: "primeiro contato", cerebro: "" });
  assert.ok(!temMotivo(avisos, /só perguntam/), "sem nada pra entregar, perguntar não é defeito");
}

// ── 4. NOME DE CAMPO DO PROGRAMA NÃO APARECE NA TELA ─────────────────────────────────────────
{
  const traduzido = semNomeDeCampoNaTela("Aguarde a resposta; se ele não identificar o tema, use a maisDireta para pedir a imagem. A maisSuave serve depois.");
  assert.ok(!/maisDireta|maisSuave/.test(traduzido), "nome interno não pode chegar na tela do corretor");
  assert.ok(/sugestão 3/.test(traduzido) && /sugestão 2/.test(traduzido),
    "e precisa apontar o número que o corretor VÊ na tela");
}

// ── 5. FALAR DO CLIENTE COMO FICHA DE CADASTRO ───────────────────────────────────────────────
{
  const avisos = avisosDeQualidadeDasMensagens(
    [{ qual: "b", texto: "Bom dia, Ilario! Qual informação te ajuda mais: fotos dele ou entender melhor a parte do perfil de compra?" }],
    { conversa: "Ilario fotos", cerebro: "" }
  );
  assert.ok(temMotivo(avisos, /ficha de cadastro/), "'perfil de compra' é o app falando do cliente como cadastro");
}

// ── 6. O FICHÁRIO: a armadilha dos dias, o dever de entregar, e o que é do corretor ──────────
{
  const C = "Construtora Senger";
  const lead = { clientName: "Julsimar Chapada" };
  const AGORA = new Date(2026, 7, 22, 10, 30);
  const tl = [
    { author: C, date: "18/08/2026", text: "Bom dia! O Premium Office sai com entrada de R$ 38.000, 48x de R$ 4.900 e 4 aportes anuais de R$ 26.700." },
    { author: "Julsimar Chapada", date: "18/08/2026", text: "Joia." }
  ];
  const fichario = montarFicharioDaConversa(tl, C, lead, AGORA);

  // A armadilha que gerou a tarja "abre contando os dias parados" na mensagem RECOMENDADA:
  // o piso de forma manda reconhecer o intervalo, e o modelo reconhecia escrevendo "Há 4 dias".
  assert.ok(/Reconhecer o intervalo NÃO é escrever quantos dias/.test(fichario),
    "o fichário precisa explicar que reconhecer o intervalo não é contar os dias");

  // v1373 — valor antigo citado NÃO é, sozinho, uma entrega pendente. O print do Arnildo mostrou
  // a consequência da regra antiga: a conferência acusava "as três só perguntam" mesmo quando o
  // passo correto era simplesmente qualificar/aguardar. A obrigação de entregar só nasce de uma
  // pergunta do cliente, promessa do corretor ou compromisso real ainda aberto.
  assert.ok(!/PELO MENOS UMA DAS TRÊS MENSAGENS PRECISA ENTREGAR/.test(fichario),
    "valor já citado, sem obrigação aberta, não pode forçar uma entrega nova");

  // O que é do corretor não vira pergunta pro cliente (raiz do caso Flavio).
  assert.ok(/O QUE É DO CORRETOR NUNCA VIRA PERGUNTA PARA O CLIENTE/.test(fichario),
    "pedir ao cliente o link do próprio anúncio precisa estar proibido");
}

console.log("v1368-tres-so-perguntam-e-tarjas-erradas: ok (interrogatório pego, tarjas erradas removidas, nome interno traduzido)");
