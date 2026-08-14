import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1280 — "overview???" (dono, 14/08/2026, com print das três sugestões do lead Claudia/Renaissance).
//
// A sugestão 2 saía assim: "...Assim posso te dar um overview mais prático do que faz sentido para
// você." Corretor nenhum escreve "overview" pra um cliente no WhatsApp — a palavra em inglês
// entrega na primeira linha que quem escreveu foi um robô, exatamente como as frases da lista
// "LINGUAGEM DE IA — PROIBIDO". Só que aquela lista cobria clichê em português; jargão de escritório
// e palavra em inglês não estavam proibidos em lugar nenhum do pedido enviado à IA.
//
// A rede é o prompt (a v1247 tirou o corte determinístico de frase proibida de propósito, e ele não
// pode voltar). Então o teste guarda o texto da regra.

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

const ini = src.indexOf('PALAVRA EM INGLÊS E JARGÃO DE ESCRITÓRIO — PROIBIDO');
assert.ok(ini > -1, 'a regra contra palavra em inglês precisa existir no pedido enviado à IA');
const bloco = src.slice(ini, ini + 2600).replace(/\s+/g, ' ');

// ── 1. A palavra do print está nomeada, junto com o resto do jargão ──────────────────────────
for (const palavra of ['overview', 'insight', 'feedback', 'budget', 'call', 'follow-up', 'timing', 'update']) {
  assert.ok(bloco.includes(`"${palavra}"`), `"${palavra}" precisa estar na lista de palavras proibidas`);
}

// ── 2. A regra não é só proibição: manda o que escrever no lugar ─────────────────────────────
assert.ok(bloco.includes('overview = uma ideia geral'),
  'a tradução de "overview" precisa estar escrita, senão a IA só troca por outro anglicismo');
assert.ok(bloco.includes('feedback = retorno') && bloco.includes('call = ligação'),
  'as trocas em português precisam estar explícitas');

// ── 3. Jargão corporativo em português cai junto ─────────────────────────────────────────────
assert.ok(bloco.includes('alinhar expectativas') && bloco.includes('agregar valor'),
  '"alinhar expectativas"/"agregar valor" são o mesmo problema em português e precisam estar citados');

// ── 4. A exceção do vocabulário real do mercado está escrita ─────────────────────────────────
// Sem isto, a regra proibiria a IA de escrever "studio" ou "duplex" — palavras que o próprio
// Cérebro e as conversas usam, e que são o nome da coisa no mercado brasileiro.
for (const permitida of ['studio', 'duplex', 'garden', 'closet', 'playground', 'home office']) {
  assert.ok(bloco.includes(permitida), `"${permitida}" precisa continuar liberada pela exceção`);
}
assert.ok(bloco.includes('nome próprio'),
  'nome de empreendimento/construtora/bairro não pode ser traduzido');
assert.ok(bloco.includes('Isso não abre a porta pro resto do inglês'),
  'a exceção precisa deixar claro que é exceção, não licença geral');

// ── 5. A regra vale pra TODO corretor, não só pra quem está em modo prévia ───────────────────
// (v1240 tirou o piso comercial de quem TEM Cérebro e o dono ficou sem ele — não repetir.)
const fimCerebro = src.indexOf('=== FIM DO CÉREBRO COMERCIAL ===');
assert.ok(fimCerebro > -1 && ini > fimCerebro,
  'a regra precisa estar no trecho comum do pedido, fora do bloco de modo prévia');

// ── 6. Nada de cirurgia no texto da IA (v1247) ───────────────────────────────────────────────
assert.ok(!/limparFrasesProibidas|melhorLimpa/.test(src),
  'o corte determinístico de frase proibida foi removido na v1247 e não pode voltar');

console.log('v1280-nada-de-palavra-em-ingles: ok');
