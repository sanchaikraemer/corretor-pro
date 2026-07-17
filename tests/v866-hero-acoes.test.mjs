import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v866: no hero "Prioridade agora" da Home ficaram só as ações que fazem sentido ali —
// "Ver histórico" e "✓ Já falei". Saíram:
//  - o botão verde grande do WhatsApp;
//  - o "Copiar mensagem" (não faz sentido copiar do hero uma mensagem que nem é exibida;
//    mexer com mensagem é dentro do lead).

const ini = app.indexOf('function renderHeroLead(l){');
const fim = app.indexOf('async function registrarMensagemEnviada(');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'não localizei renderHeroLead');
const hero = app.slice(ini, fim);

// Botão do WhatsApp fora.
assert.doesNotMatch(hero, /class="h-wa"/, 'o botão WhatsApp (.h-wa) precisa sair do hero');
assert.doesNotMatch(hero, />WhatsApp</, 'não pode sobrar botão "WhatsApp" no hero');

// "Copiar mensagem" fora do hero.
assert.doesNotMatch(hero, /Copiar mensagem/, '"Copiar mensagem" precisa sair do hero');
assert.doesNotMatch(hero, /copiarMensagemLead/, 'o hero não pode mais chamar copiarMensagemLead');

// As ações que sobram são "Ver histórico" e "Já falei".
assert.match(hero, /Ver histórico/, 'o hero mantém "Ver histórico"');
assert.match(hero, /Já falei/, 'o hero mantém "Já falei"');

console.log('v866-hero-acoes: ok');
