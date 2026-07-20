import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v890 — card "Prioridade agora" (hero da Home): (1) "POR QUE ATENDER" mostra o resumo
// INTEIRO, sem corte "..."; (2) botões "Ver histórico" / "Já falei" removidos (pra agir,
// abre-se o lead — o card já é clicável).

// 1. motivoPrioridade empurra o resumo inteiro, sem _cortarFrase.
const fn = app.match(/function motivoPrioridade\(l\)\{[\s\S]*?\n\}/)[0];
assert.match(fn, /partes\.push\(resumoReal\);/, 'o resumo deve entrar inteiro no "por que atender"');
assert.doesNotMatch(fn, /_cortarFrase\(frase, 85\)/, 'não pode mais cortar o resumo em 85 caracteres');

// 2. O hero não tem mais os botões nem a barra de ações.
const ini = app.indexOf('function renderHeroLead(l){');
const fim = app.indexOf('async function registrarMensagemEnviada(');
const hero = app.slice(ini, fim);
assert.doesNotMatch(hero, /h-acts/, 'a barra de ações do hero foi removida');
assert.doesNotMatch(hero, /Ver histórico|Já falei/, 'os botões saíram do hero');
// O card inteiro continua clicável (abre o lead).
assert.match(hero, /class="hero-real" onclick='abrirLead/, 'o card do hero continua abrindo o lead ao clicar');

console.log('v890-hero-texto-completo: ok');
