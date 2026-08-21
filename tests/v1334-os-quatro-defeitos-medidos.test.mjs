import assert from "node:assert/strict";
import {
  montarFicharioDaConversa, tiposDePedidoJaIgnorados, diasUteisParaPropor,
  clienteDisseCaroSemDizerFaixa, clienteSemCapitalHojeComPrazo, parseWhatsappTxt, guessLeadData
} from "../api/_pipeline.js";

// v1334 — OS QUATRO DEFEITOS QUE A MEDIÇÃO APONTOU, VIRADOS EM FATO.
//
// A primeira medição da bateria com IA de verdade (dono, no painel, 20/08/2026: 156 de 191 pontos)
// mostrou que as falhas se repetiam nas mesmas quatro formas — e todas na hora de escrever. Mais
// regra no prompt não estava resolvendo; o que resolve neste projeto, desde a v1317, é entregar o
// FATO calculado. O quinto veio do print do Jamil no mesmo dia.

const HOJE = new Date("2026-08-21T10:00:00-03:00");

// ── 1. Repetir o mesmo tipo de pedido que já foi ignorado ────────────────────────────────────
{
  const tipos = tiposDePedidoJaIgnorados([
    "Gostaria de levá-la visitar na semana que vem, pode ser?",
    "Te mando as fotos e a planta por aqui"
  ]);
  assert.ok(tipos.some(t => /encontro/i.test(t)), "convite de visita é um tipo de pedido");
  assert.ok(tipos.some(t => /material/i.test(t)), "mandar material é outro");
  assert.deepEqual(tiposDePedidoJaIgnorados([]), [], "sem tentativa sem resposta, não há tipo nenhum");
}

// ── 2. Dia e hora de verdade pra propor ("quando você puder" não marca nada) ─────────────────
{
  const dias = diasUteisParaPropor(HOJE, 3);
  assert.equal(dias.length, 3);
  assert.match(dias[0], /segunda-feira 24\/08/, "21/08/2026 é sexta: o próximo dia útil é segunda 24");
  assert.ok(!dias.some(d => /sábado|domingo/.test(d)), "fim de semana não entra na proposta");
}

// ── 3. Disse que está caro e nunca disse quanto pode pagar ───────────────────────────────────
{
  const timeline = [
    { author: "Gustavo", text: "achei caro demais esse valor", date: "19/08/2026", time: "10:00", iso: "2026-08-19T13:00:00Z" }
  ];
  const achado = clienteDisseCaroSemDizerFaixa(timeline, "Corretor", { clientName: "Gustavo" }, HOJE);
  assert.ok(achado, "a objeção de preço sem faixa precisa virar fato");
  assert.equal(achado.data, "19/08/2026");

  // Se ele DISSE a faixa, o fato não existe mais — e o app não pode ficar pedindo o que já tem.
  const comFaixa = [
    ...timeline,
    { author: "Gustavo", text: "posso pagar até 400 mil", date: "19/08/2026", time: "10:05", iso: "2026-08-19T13:05:00Z" }
  ];
  assert.equal(clienteDisseCaroSemDizerFaixa(comFaixa, "Corretor", { clientName: "Gustavo" }, HOJE), null,
    "cliente que já deu a faixa não pode ser perguntado de novo");
}

// ── 4. Sem capital hoje, com prazo pra ter — e obra citada na conversa (o caso do print) ─────
{
  const timeline = [
    { author: "Corretor", text: "Evolutti, entrega em 2028, 30% entrada + 48 vezes direto com construtora", date: "12/08/2024", time: "11:45", iso: "2024-08-12T14:45:00Z" },
    { author: "Jamil", text: "eu não tenho o capital para comprar o apartamento agora. O negócio é alugar por um período até conseguir. Eu acho que em dois anos já é tranquilo.", date: "20/08/2026", time: "17:17", iso: "2026-08-20T20:17:00Z" }
  ];
  const achado = clienteSemCapitalHojeComPrazo(timeline, "Corretor", { clientName: "Jamil" }, HOJE);
  assert.ok(achado, "o fato mais importante daquela conversa precisa ser calculado");
  assert.equal(achado.prazo, "em dois anos", "o prazo que o próprio cliente deu entra junto");
  assert.match(achado.obraNaConversa, /entrega em 2028/, "e o produto em obra que já apareceu na conversa também");
}

// ── 5. Tudo isso chega ao pedido enviado à IA, com a instrução colada no fato ────────────────
{
  const conversa = [
    "[12/08/2024 11:45] Corretor: Evolutti, entrega em 2028, 30% entrada + 48 vezes direto com construtora",
    "[19/08/2026 10:00] Jamil: achei caro demais",
    "[20/08/2026 17:17] Jamil: eu não tenho o capital para comprar agora, em dois anos já é tranquilo",
    "[20/08/2026 18:00] Corretor: Posso te enviar as condições?",
    "[20/08/2026 18:05] Corretor: Gostaria de te levar pra visitar, pode ser?"
  ].join("\n");
  const timeline = parseWhatsappTxt(conversa);
  const lead = guessLeadData(timeline, "Corretor", "Conversa do WhatsApp com Jamil.txt");
  const fichario = montarFicharioDaConversa(timeline, "Corretor", lead, HOJE);

  assert.match(fichario, /DIAS ÚTEIS PARA PROPOR/, "a IA recebe dias de verdade pra marcar");
  assert.match(fichario, /segunda-feira 24\/08/);
  assert.match(fichario, /não "quando você puder"/, "com a instrução colada no fato");
  assert.match(fichario, /O CLIENTE DISSE QUE ESTÁ CARO E NUNCA DISSE QUANTO PODE PAGAR/);
  assert.match(fichario, /NÃO TEM O CAPITAL AGORA/);
  assert.match(fichario, /restrição de\s*\nCALENDÁRIO|restrição de CALENDÁRIO/, "e a leitura fácil ('não vai comprar') é desmontada ali mesmo");
  assert.match(fichario, /O TIPO DE PEDIDO QUE JÁ FOI FEITO E IGNORADO/, "o que já foi tentado e ignorado vira tipo, não só texto");
}

// ── 6. Conversa sem nenhum desses sinais não ganha bloco nenhum ──────────────────────────────
{
  const conversa = [
    "[20/08/2026 10:00] Cliente: bom dia, tudo bem?",
    "[20/08/2026 10:05] Corretor: bom dia! tudo sim"
  ].join("\n");
  const timeline = parseWhatsappTxt(conversa);
  const lead = guessLeadData(timeline, "Corretor", "Conversa do WhatsApp com Cliente.txt");
  const fichario = montarFicharioDaConversa(timeline, "Corretor", lead, HOJE);
  assert.ok(!/ESTÁ CARO/.test(fichario), "fato que não existe não entra");
  assert.ok(!/NÃO TEM O CAPITAL/.test(fichario), "idem");
  assert.ok(!/JÁ FOI FEITO E IGNORADO/.test(fichario), "idem");
}

console.log("v1334-os-quatro-defeitos-medidos: ok");
