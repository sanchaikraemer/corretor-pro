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

// v1348 — o texto passou a atravessar cp1348TextoNaTela antes de ir pra tela. Isso NÃO é corte:
// a função só troca o marcador que o PRÓPRIO app escreve quando um arquivo não pôde ser lido
// ("[Arquivo enviado nesta mensagem: … — conteúdo não analisado pela IA]") por uma linha curta.
// Fala de gente não é tocada. A regra desta versão continua valendo e está conferida logo abaixo.
assert.match(fn, /const textoNaTela = cp1348TextoNaTela\(cp704Text\(m\.text\)\);/,
  'o texto da mensagem sai inteiro do registro, sem corte');
assert.match(fn, /const corpo = `<p>\$\{escapeHtml\(textoNaTela\)\}<\/p>`;/,
  'a mensagem precisa ser renderizada por completo, sem corte de tamanho');
{
  const curtaMatch = app.match(/function cp1348TextoNaTela\(texto\)\{[\s\S]*?\n  \}/);
  assert.ok(curtaMatch, 'cp1348TextoNaTela não encontrada em app.js');
  assert.doesNotMatch(curtaMatch[0], /\.slice\(|\.substr|\.substring\(|…|\.\.\./,
    'o que entra no caminho da mensagem não pode cortar texto — é isso que a v940 protege');
  // Rodando de verdade: fala longa do corretor sai igualzinha, sem perder um caractere.
  const fonte = [app.match(/const CP1348_MARCADOR = [\s\S]*?\n  \};/)[0], curtaMatch[0]].join('\n');
  const curto = new Function(`${fonte}\nreturn cp1348TextoNaTela;`)();
  const longa = 'transferir o financiamento para outro comprador recebendo o que pagou nele até então, '
    + 'e isso daria como entrada em outro e financiaria saldo. Outra opção... Para entender melhor '
    + 'e sugerir outras opções, me diz mais ou menos o valor pago. '.repeat(6);
  assert.equal(curto(longa), longa, 'mensagem de 600+ caracteres precisa sair inteira');
  assert.ok(longa.length > 520, 'sanidade: a mensagem do teste passa do tamanho que era cortado');
}

console.log('v940-timeline-sem-corte-de-mensagem: ok');
