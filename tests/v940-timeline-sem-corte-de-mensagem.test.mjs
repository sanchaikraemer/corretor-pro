import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v940 — bug real reportado pelo dono via print: a mensagem dele mesmo, mostrada em "Últimas
// mensagens" (o histórico completo do lead), aparecia CORTADA NO MEIO DA FRASE — "...transferir
// o financiamento para outro comprador recebendo" — sem o resto ("o que pagou nele até então,
// e isso daria como entrada em outro e financiaria saldo. Outra opção... Para entender melhor
// e sugerir outras opções, me diz mais ou menos o valor pago..."). O WhatsApp real tinha a
// mensagem inteira; o app cortava em 520 caracteres, sem aviso nenhum de que faltava texto.
// Esta view existe justamente pra mostrar a conversa REAL — cortar o texto contradiz o próprio
// propósito dela (e o "Copiar histórico", ao lado, sempre copiou o texto inteiro sem cortar).

const fnMatch = app.match(/function cp704TimelineHtml\(lead\)\{[\s\S]*?\n  \}/);
assert.ok(fnMatch, 'cp704TimelineHtml não encontrada em app.js');
const fn = fnMatch[0];

assert.doesNotMatch(fn, /\.slice\(0,\s*520\)/, 'a mensagem não pode mais ser cortada em 520 caracteres');
assert.match(fn, /<p>\$\{escapeHtml\(cp704Text\(m\.text\)\)\}<\/p>/, 'a mensagem precisa ser renderizada por completo, sem corte de tamanho');

console.log('v940-timeline-sem-corte-de-mensagem: ok');
