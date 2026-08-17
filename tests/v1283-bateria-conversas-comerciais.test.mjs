// v1283 — BATERIA DE CONVERSAS COMERCIAIS, CAMADA 1 (sem IA, custo zero).
//
// Por que existe: a auditoria de 16/08/2026 mediu que, dos 437 arquivos de teste do projeto, 356
// apenas LEEM o código-fonte procurando se um trecho está lá. Nenhum respondia se a análise está
// certa — e foi por isso que o achado A1 (contato salvo como "Anderson Corretor" virando o lado da
// empresa, com a fala do cliente indo pra IA como se fosse do corretor) passou batido por todos.
//
// Esta camada confere, em cada conversa de `evals/conversas/`, tudo que o sistema decide ANTES de
// falar com a IA — que é exatamente onde aquele erro morava:
//   · quem é o cliente (o nome que vai pro cartão e decide o cadastro);
//   · quem falou por último (decide "aguardando cliente" x "responder agora");
//   · quantas tentativas do corretor ficaram sem resposta E quais são os textos delas
//     (bloco "TENTATIVAS DO CORRETOR AINDA SEM RESPOSTA" do prompt, v1277);
//   · quais mensagens entram como exemplo de voz do corretor
//     (bloco "COMO ESTE CORRETOR ESCREVE" do prompt, v1212).
//
// A conferência do que a IA RESPONDE é a camada 2 (`evals/executar.mjs`), que gasta dinheiro e só
// roda quando o dono manda. Esta aqui roda em toda alteração e não gasta nada.
//
// Ao acrescentar uma conversa nova em evals/conversas/, ela entra aqui sozinha.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  guessLeadData,
  tentativasSemRespostaDoCorretor,
  expandirObservacoesColadas,
  exemplosDoCorretor
} from "../api/_pipeline.js";

const raiz = path.dirname(fileURLToPath(import.meta.url));
const pastaConversas = path.join(raiz, "..", "evals", "conversas");

const arquivos = fs.readdirSync(pastaConversas).filter(f => f.endsWith(".json")).sort();
assert.ok(arquivos.length >= 8,
  `a bateria precisa de pelo menos 8 conversas pra valer alguma coisa — achei ${arquivos.length}`);

const CAMPOS_OBRIGATORIOS = ["id", "titulo", "veioDe", "corretorNome", "nomeArquivo", "conversa", "esperado"];
const idsVistos = new Set();
let conferidas = 0;

for (const arquivo of arquivos) {
  const caso = JSON.parse(fs.readFileSync(path.join(pastaConversas, arquivo), "utf8"));
  const onde = `${arquivo} (${caso.id || "sem id"})`;

  // ── A conversa está bem escrita? ────────────────────────────────────────────
  for (const campo of CAMPOS_OBRIGATORIOS) {
    assert.ok(caso[campo], `${onde}: falta o campo "${campo}"`);
  }
  assert.ok(!idsVistos.has(caso.id), `${onde}: o id "${caso.id}" está repetido em outra conversa`);
  idsVistos.add(caso.id);
  assert.ok(Array.isArray(caso.conversa) && caso.conversa.length >= 2,
    `${onde}: a conversa precisa de pelo menos duas falas`);
  for (const m of caso.conversa) {
    assert.ok(m.author && m.text && m.date, `${onde}: toda fala precisa de autor, texto e data`);
  }
  // A régua escrita em português é o que a camada 2 confere. Sem ela, a conversa não serve.
  for (const campo of ["aIaPrecisaPerceber", "asMensagensNaoPodem"]) {
    assert.ok(Array.isArray(caso.esperado[campo]) && caso.esperado[campo].length > 0,
      `${onde}: "esperado.${campo}" precisa ter pelo menos um item — é o que a camada 2 confere`);
  }

  // v1287 — a observação que É conversa colada vira mensagem de verdade antes de qualquer conta,
  // exatamente como acontece na análise. Sem isso, a fala mais recente do cliente conta como
  // recado do corretor e tudo o que é medido abaixo sai errado.
  const timeline = expandirObservacoesColadas(caso.conversa.map(m => ({ ...m, type: m.type || "text" })));
  const lead = guessLeadData(timeline, caso.corretorNome, caso.nomeArquivo);
  const esperado = caso.esperado;

  // ── 1. Quem é o cliente ─────────────────────────────────────────────────────
  // É o nome do cartão, e é o que decide em qual cadastro a conversa entra.
  assert.equal(lead.clientName, esperado.clienteChamaSe,
    `${onde}: o cliente devia ser "${esperado.clienteChamaSe}" e veio "${lead.clientName}"`);

  // ── 2. Quem falou por último ────────────────────────────────────────────────
  // Decide "aguardando o cliente" x "responder agora" na fila do dia.
  const mensagensReais = timeline.filter(m => m.type !== "observacao_manual" && m.source !== "corretor-pro-manual");
  const ultima = mensagensReais[mensagensReais.length - 1];
  const ultimaEhDoCorretor = String(ultima.author).trim() === String(caso.corretorNome).trim();
  const falouPorUltimo = ultimaEhDoCorretor ? "corretor" : "cliente";
  assert.equal(falouPorUltimo, esperado.quemFalouPorUltimo,
    `${onde}: quem falou por último devia ser "${esperado.quemFalouPorUltimo}"`);

  // ── 3. Tentativas do corretor sem resposta (bloco do prompt, v1277) ─────────
  // Número inflado dispara a regra dura de "duas tentativas" e faz a IA propor encontro
  // presencial sem necessidade. Texto errado aqui vira "oferta que o cliente já ignorou".
  const semResposta = tentativasSemRespostaDoCorretor(timeline, caso.corretorNome, lead);
  assert.equal(semResposta.tentativas, esperado.tentativasSemResposta,
    `${onde}: tentativas sem resposta deviam ser ${esperado.tentativasSemResposta} e vieram ${semResposta.tentativas}`);

  const falasDoCliente = timeline
    .filter(m => String(m.author).trim() !== String(caso.corretorNome).trim())
    .map(m => String(m.text));
  for (const falaDoCliente of falasDoCliente) {
    assert.ok(!(semResposta.textos || []).some(t => String(t) === falaDoCliente),
      `${onde}: a fala do CLIENTE ("${falaDoCliente.slice(0, 45)}...") entrou na lista do que o CORRETOR tentou sem resposta — é assim que a IA fica proibida de tratar justo o que o cliente pediu`);
  }

  // ── 4. Exemplos de voz do corretor (bloco do prompt, v1212) ────────────────
  // Se a fala do cliente entra aqui, a IA passa a copiar o jeito de escrever da pessoa errada.
  const voz = exemplosDoCorretor(timeline, caso.corretorNome, lead);
  for (const trecho of (esperado.vozDoCorretorNaoPodeConter || [])) {
    assert.ok(!voz.includes(trecho),
      `${onde}: "${trecho}" é fala do cliente e não pode entrar em "COMO ESTE CORRETOR ESCREVE"`);
  }

  conferidas++;
}

console.log(`v1283-bateria-conversas-comerciais: ok (${conferidas} conversas, 4 conferências cada, sem gastar IA)`);
