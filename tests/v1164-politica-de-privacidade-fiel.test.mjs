import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1164 — a auditoria de 07/08/2026 apontou dois problemas nas páginas públicas:
//
//   1. O CPF completo do responsável estava publicado em privacidade.html e termos.html, à vista
//      de qualquer visitante da internet. Identificar o responsável é obrigação da LGPD; publicar
//      o documento dele não é.
//   2. A Política de Privacidade prometia que a OpenAI "não recebe o telefone do lead (o número é
//      retirado antes do envio)". Isso é verdade só pro CAMPO de telefone da ficha do lead — o
//      TEXTO da conversa vai inteiro, e o que estiver escrito nele (telefone, e-mail, CPF,
//      endereço, dado bancário, contato de terceiro) vai junto. A frase absoluta era uma promessa
//      que o sistema não cumpre.
//
// Estas guardas existem porque texto de página é fácil de reescrever sem perceber a consequência.

const raiz = new URL('../', import.meta.url);
const ler = (arq) => fs.readFileSync(new URL(arq, raiz), 'utf8');

// ── 1. Nenhuma página pública pode trazer CPF ──────────────────────────────────────────────────
const paginas = fs.readdirSync(raiz).filter(f => f.endsWith('.html'));
for (const arq of paginas) {
  const html = ler(arq);
  assert.ok(!/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(html),
    `${arq} publica um CPF. A identificação completa do responsável é fornecida pelo e-mail de contato — não fica exposta na página.`);
}

// ── 2. A promessa absoluta sobre o telefone não pode voltar ────────────────────────────────────
const privacidade = ler('privacidade.html');

assert.ok(!/não recebe o telefone do lead/i.test(privacidade),
  'a Política não pode prometer que a OpenAI "não recebe o telefone do lead": isso vale só pro campo da ficha, o texto da conversa vai inteiro');
assert.ok(!/o número é retirado antes do envio/i.test(privacidade),
  'mesma coisa: "o número é retirado antes do envio" é verdade só pro campo da ficha, não pro texto da conversa');

assert.match(privacidade, /conte[úu]do integral da conversa/i,
  'a Política precisa dizer que a conversa vai integralmente pra IA');
assert.match(privacidade, /texto da conversa vai como est[áa]/i,
  'a Política precisa avisar que o que estiver escrito na conversa (telefone, CPF, endereço…) vai junto');

// ── 3. O que fica guardado no aparelho precisa estar descrito por inteiro ──────────────────────
assert.match(privacidade, /IndexedDB/i,
  'a Política falava só em localStorage; o app também guarda o ZIP compartilhado e nomes de clientes em IndexedDB');
assert.match(privacidade, /localStorage/i, 'o localStorage continua precisando estar descrito');

// ── 4. O responsável continua identificado, e o canal de contato também ────────────────────────
for (const arq of ['privacidade.html', 'termos.html']) {
  assert.match(ler(arq), /Sanchai Kraemer/, `${arq} precisa identificar o responsável pelo nome`);
  assert.match(ler(arq), /sanchaikraemer3@gmail\.com/, `${arq} precisa ter o e-mail de contato`);
}

console.log('v1164-politica-de-privacidade-fiel: ok');
