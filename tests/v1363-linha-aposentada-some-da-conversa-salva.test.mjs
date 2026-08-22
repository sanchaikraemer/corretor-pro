import assert from "node:assert/strict";
import { mesclarTimelineIncremental } from "../api/_pipeline.js";

// v1363 — LINHA QUE O APP NÃO ESCREVE MAIS PRECISA SUMIR DA CONVERSA JÁ SALVA.
//
// Print do dono (22/08/2026, 03h20, com o app já na 1360): a linha "[Figurinha enviada — é uma
// reação, não tem texto pra ler]" continuava no histórico do Vande, e a análise continuava
// raciocinando em cima dela ("a última interação do contato foi apenas uma figurinha").
//
// A v1360 fez o app parar de ESCREVER essa linha. Mas a que já estava salva nunca saía: a
// mesclagem preserva o que está no banco, e como a importação nova não produz nada naquele lugar,
// não havia o que substituir. Linha velha imortal, mesmo reimportando — o dono reimportou às 03h15
// e ela continuou lá.

const FALA = { date: "21/08/2026", time: "11:59", author: "Sanchai", iso: "2026-08-21T14:59:00Z",
  text: "Vamos falando por whats tambem" };
const FIGURINHA = { date: "21/08/2026", time: "12:24", author: "Vande", iso: "2026-08-21T15:24:00Z",
  text: "[Figurinha enviada — é uma reação, não tem texto pra ler]" };

// ── 1. O caso do print: reimportou, a linha aposentada some ──────────────────────────────────
{
  const junto = mesclarTimelineIncremental([FALA, FIGURINHA], [FALA]);
  assert.equal(junto.length, 1, "a figurinha salva precisa sair na reimportação");
  assert.equal(junto[0].text, FALA.text, "e a fala de verdade fica");
}
// Mesmo quando a importação nova nem menciona aquele momento.
{
  const junto = mesclarTimelineIncremental([FIGURINHA], []);
  assert.deepEqual(junto, [], "sem nada pra substituir, a linha aposentada sai do mesmo jeito");
}

// ── 2. Só sai o que o PRÓPRIO APP escreveu e aposentou ──────────────────────────────────────
// A lista é fechada e literal de propósito. Fala de gente nunca pode ser varrida — nem quando
// escreve a palavra "figurinha".
{
  const humano = { ...FIGURINHA, text: "kkk boa essa figurinha" };
  const junto = mesclarTimelineIncremental([FALA, humano], [FALA]);
  assert.equal(junto.length, 2, "fala do cliente que fala de figurinha continua na conversa");
  assert.ok(junto.some(m => m.text === "kkk boa essa figurinha"));
}
// Marca ATIVA (arquivo que não veio) não é aposentada: ela ainda é escrita pelo app.
{
  const marcaViva = { ...FIGURINHA, text: "[Arquivo enviado nesta mensagem: arquivo — conteúdo não analisado pela IA]" };
  const junto = mesclarTimelineIncremental([FALA, marcaViva], [FALA]);
  assert.equal(junto.length, 2, "marca que o app ainda escreve continua valendo");
}
// Mensagem com texto E a marca aposentada junto: o texto manda, a linha fica.
{
  const misto = { ...FIGURINHA, text: "Fechado\n[Figurinha enviada — é uma reação, não tem texto pra ler]" };
  const junto = mesclarTimelineIncremental([FALA, misto], [FALA]);
  assert.equal(junto.length, 2, "não se joga fora mensagem que tem conteúdo de verdade dentro");
}

// ── 3. O que a v1349 já fazia continua igual ────────────────────────────────────────────────
// Vazio vira cheio quando a reimportação traz conteúdo no mesmo momento; nunca o contrário.
{
  const vazia = { ...FIGURINHA, text: "[Áudio: PTT-1.opus — sem_transcricao]" };
  const cheia = { ...FIGURINHA, text: "[Áudio transcrito] consegui juntar a entrada" };
  assert.equal(mesclarTimelineIncremental([vazia], [cheia]).length, 1);
  assert.match(mesclarTimelineIncremental([vazia], [cheia])[0].text, /Áudio transcrito/);
  assert.ok(mesclarTimelineIncremental([cheia], [vazia]).some(m => /Áudio transcrito/.test(m.text)),
    "reimportação pior jamais apaga transcrição que já existia");
}

// ── 4. Nada quebra com entrada vazia ────────────────────────────────────────────────────────
assert.deepEqual(mesclarTimelineIncremental([], []), []);
assert.deepEqual(mesclarTimelineIncremental(null, null), []);

console.log("v1363-linha-aposentada-some-da-conversa-salva: ok");
