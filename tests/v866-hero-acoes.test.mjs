import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v866: no hero "Prioridade agora" da Home:
//  - removido o botão verde grande do WhatsApp;
//  - "Copiar mensagem" só aparece quando existe mensagem pronta (antes copiava vazio e
//    ainda dizia "Mensagem copiada").

const ini = app.indexOf('function renderHeroLead(l){');
const fim = app.indexOf('async function registrarMensagemEnviada(');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'não localizei renderHeroLead');
const hero = app.slice(ini, fim);

// Botão do WhatsApp fora.
assert.doesNotMatch(hero, /class="h-wa"/, 'o botão WhatsApp (.h-wa) precisa sair do hero');
assert.doesNotMatch(hero, />WhatsApp</, 'não pode sobrar botão "WhatsApp" no hero');

// "Copiar mensagem" condicionado a ter mensagem.
assert.match(hero, /const msgHero\s*=/, 'o hero precisa calcular se há mensagem pronta');
assert.match(hero, /\$\{msgHero\s*\?[\s\S]*?Copiar mensagem/, '"Copiar mensagem" precisa ser condicionado a msgHero');

// Guarda defensiva: copiar sem mensagem não mente "copiada".
const idxCopiar = app.indexOf('window.copiarMensagemLead');
const copiar = app.slice(idxCopiar, idxCopiar + 700);
assert.match(copiar, /if\(!msg\)\{\s*toast\(/, 'copiarMensagemLead precisa avisar quando não há mensagem, em vez de copiar vazio');

console.log('v866-hero-acoes: ok');
