import assert from "node:assert/strict";
import { persistStatsCacheWriteBacks } from "../api/_persistence.js";

// v1087 — o dono mandou print às 00:06 com "Carregamento demorou mais que o normal", e logo
// depois o app abriu e funcionou normal.
//
// A causa: o cache de estatísticas de cada lead vale POR DIA (cacheStats.dia === hoje). Isso
// significa que, à meia-noite, ele vence pra CARTEIRA INTEIRA de uma vez. Na primeira abertura do
// dia a listagem recalculava tudo E AINDA ESPERAVA até 500 gravações no banco antes de responder
// — cada uma regravando o resultado_analise inteiro de um lead. Por isso só a PRIMEIRA abertura
// do dia estourava o tempo.
//
// A resposta não depende dessas gravações (os números já estão calculados em memória), então elas
// passaram a ter um orçamento de tempo curto. Este teste prova que o orçamento é respeitado.
//
// v1146 — o orçamento subiu de 1500ms pra 6000ms de propósito, e isso NÃO reabre o problema: na
// mesma versão entrou um teto de leituras por carga (STATS_TIMELINES_POR_CARGA), então o volume
// pendente por carga passou a ser pequeno e conhecido. Antes, 1500ms era tão curto que quase nada
// grudava — e a carga seguinte recalculava tudo de novo, para sempre. O que este teste continua
// garantindo é o essencial: existe um teto de tempo, ele é respeitado, e o que não couber fica
// pra próxima carga sem erro nenhum.

// v1146 — 400ms por gravação (era 120ms): com o orçamento novo de 6000ms, 120ms cabia tudo e o
// teste não provava mais o corte. Banco lento de verdade é assim mesmo — é o cenário que o teto
// precisa cobrir.
const ATRASO_POR_GRAVACAO_MS = 400;

function supabaseLento(contador) {
  const lento = () => new Promise(r => setTimeout(() => { contador.n++; r({ error: null }); }, ATRASO_POR_GRAVACAO_MS));
  return {
    from() {
      return {
        update() {
          return { eq() { return { eq() { return { eq: lento, then: (res, rej) => lento().then(res, rej) }; } }; } };
        }
      };
    }
  };
}

// 500 leads com o cache vencido — exatamente o cenário da virada do dia numa carteira grande.
const pendentes = Array.from({ length: 500 }, (_, i) => ({
  id: `lead-${i}`,
  atualizado_em: "2026-07-31T03:00:00.000Z",
  resultado_analise: { clientName: `Cliente ${i}`, _statsCache: { v: 1, dia: "2026-08-01" } }
}));

const contador = { n: 0 };
const t0 = Date.now();
await persistStatsCacheWriteBacks(supabaseLento(contador), pendentes, "org-1");
const levou = Date.now() - t0;

// Sem o teto, seriam 25 rodadas sequenciais de 400ms = ~10s só de espera de banco, somadas ao
// recálculo — em cima do tempo que o navegador já esperou pra listagem inteira.
assert.ok(levou < 7000,
  `a gravação do cache não pode segurar a resposta sem limite: levou ${levou}ms (orçamento é 6000ms + uma rodada em curso)`);

// E o que não coube tem que simplesmente ficar pra próxima carga, sem erro nenhum.
assert.ok(contador.n > 0, "as gravações que couberam no orçamento precisam acontecer");
assert.ok(contador.n < 500,
  `com 500 leads e gravação lenta, o orçamento precisa cortar o lote (gravou ${contador.n} de 500)`);

// Nunca pode lançar: é melhor esforço, a listagem já foi montada com os números certos.
await assert.doesNotReject(() => persistStatsCacheWriteBacks(supabaseLento({ n: 0 }), [], "org-1"),
  "sem nada pendente, não pode dar erro");

console.log(`v1087-primeira-abertura-do-dia-nao-trava: ok (${contador.n} gravações em ${levou}ms)`);
