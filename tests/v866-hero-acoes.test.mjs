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

// v890: "Ver histórico" e "Já falei" saíram do hero — pra agir você abre o lead (o card
// inteiro já é clicável e abre o lead). Sem botões redundantes no hero.
assert.doesNotMatch(hero, /Ver histórico/, '"Ver histórico" saiu do hero');
assert.doesNotMatch(hero, /Já falei/, '"Já falei" saiu do hero');
assert.doesNotMatch(hero, /h-acts/, 'a barra de ações do hero foi removida');

console.log('v866-hero-acoes: ok');
