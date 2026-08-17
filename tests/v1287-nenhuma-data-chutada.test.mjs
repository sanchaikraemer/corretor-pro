import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// v1287 — "PARE DE CHUTAR DATAS PARA AGENDAMENTO, ISSO ESTA INCOMODANDO AS MINHAS PROGRAMAÇÕES"
// (dono, 17/08/2026, depois de receber três sugestões oferecendo "quarta à tarde ou sábado de
// manhã" para uma cliente cuja conversa não tinha dia nenhum combinado).
//
// O chute não era deslize de redação: DEZ trechos do pedido mandavam a IA cravar dia e hora
// ("ofereça DUAS opções concretas: quinta às 18h ou sábado de manhã", "DIA NOMEADO da semana que
// vem", "segunda-feira fica bom pra vocês?"). Este teste existe pra que nenhuma versão futura
// reintroduza isso sem perceber — e pra garantir que o remédio não virou o veneno antigo ("fico à
// disposição", que também não vende).
const pipeline = readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");

// ── 1. A regra precisa existir, com o motivo escrito ───────────────────────────────────────────
const i = pipeline.indexOf("REGRA DA DATA — QUEM DÁ O DIA É O CLIENTE");
assert.ok(i > 0, "a REGRA DA DATA precisa estar no pedido enviado à IA");
const regra = pipeline.slice(i, i + 2200);

assert.match(regra, /A agenda do corretor não está nesta conversa/,
  "a regra precisa dizer POR QUE não dá pra chutar: o sistema não conhece a agenda dele");
assert.match(regra, /o corretor recebe a resposta do cliente aceitando um horário em que ele não\s*pode/,
  "e precisa dizer qual é o estrago real — foi isso que atrapalhou as programações do dono");
assert.match(regra, /nomear dia da semana \(segunda, terça, quarta, quinta,\s*sexta, sábado, domingo\)/,
  "a proibição precisa nomear os dias, senão a IA acha que só o exemplo estava proibido");
assert.match(regra, /data do calendário/, "data do calendário também é chute");
assert.match(regra, /hora \("às 18h"/, "hora também é chute");

// ── 2. As duas únicas exceções: o que JÁ está combinado na conversa ou cadastrado no Cérebro ───
assert.match(regra, /JÁ ESTIVER ESCRITO na conversa/,
  "dia que o cliente já pediu na conversa continua valendo — não é chute");
assert.match(regra, /ou no Cérebro \(horário de plantão, dia fixo de visita que o corretor cadastrou\)/,
  "e o que o corretor cadastrou no Cérebro também continua valendo");

// ── 3. O remédio não pode virar o veneno antigo: o vago continua proibido ──────────────────────
assert.match(regra, /PERGUNTAR o dia/, "o que entra no lugar é perguntar o dia ao cliente");
assert.match(regra, /Qual dia da semana costuma ser melhor pra\s*você\?/, "com exemplo pronto");
assert.match(regra, /"quando quiser", "me avisa", "fico à disposição" e "é só me chamar" continuam PROIBIDOS/,
  "perguntar o dia NÃO é se colocar à disposição — o vago continua reprovado");
assert.match(regra, /Perguntar o dia é conduzir; chutar o dia é atrapalhar/,
  "a régua em uma frase, pro caso de o resto do texto se perder");

// ── 4. E nenhum outro trecho do pedido pode continuar mandando cravar dia/hora ─────────────────
// Só vale o texto do prompt (o que a IA lê). Comentário de código explicando a história fica fora.
const inicioPrompt = pipeline.indexOf("AÇÃO E NOVIDADE QUE NÃO EXISTEM");
const fimPrompt = pipeline.indexOf("aparece o benefício concreto ou a palavra que ele mesmo usou, nunca a etiqueta.");
assert.ok(inicioPrompt > 0 && fimPrompt > inicioPrompt, "não achei os limites do pedido enviado à IA");
// A própria REGRA DA DATA cita os exemplos proibidos pra deixar claro o que não pode — ela sai da
// varredura, senão o teste reprovaria justamente o texto que faz a proibição.
const pedidoBruto = pipeline.slice(inicioPrompt, fimPrompt);
const pedido = pedidoBruto.slice(0, pedidoBruto.indexOf("REGRA DA DATA — QUEM DÁ O DIA É O CLIENTE"))
  + pedidoBruto.slice(pedidoBruto.indexOf("Perguntar o dia é conduzir; chutar o dia é atrapalhar."));

const CHUTES_PROIBIDOS = [
  /quinta às 18h/,
  /prefere quinta ou sábado/,
  /DIA NOMEADO/,
  /segunda-feira fica bom pra vocês/,
  /dois dias\/horários concretos/,
  /duas opções concretas de dia ou horário/,
  /dois dias ou\s*horários concretos/,
  /com dia, para a semana seguinte/
];
for (const padrao of CHUTES_PROIBIDOS) {
  assert.doesNotMatch(pedido, padrao,
    `o pedido voltou a mandar a IA cravar dia/hora (${padrao}) — é exatamente o que o dono mandou acabar na v1287`);
}

// ── 5. Onde havia chute, agora tem que haver a pergunta do dia ─────────────────────────────────
const perguntasDoDia = (pedido.match(/qual dia fica melhor|QUAL DIA FICA MELHOR|qual dia da semana|que dia fica bom|QUAL DIA fica melhor/g) || []).length;
assert.ok(perguntasDoDia >= 6,
  `os trechos que pediam dia cravado precisam ter virado a pergunta do dia — achei ${perguntasDoDia}`);

console.log(`v1287-nenhuma-data-chutada: ok (0 chutes de data, ${perguntasDoDia} lugares perguntando o dia ao cliente)`);
