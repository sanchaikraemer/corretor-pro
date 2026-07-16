import fs from 'node:fs';
import assert from 'node:assert/strict';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/cerebro-config.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// O navegador salva os dois blocos.
assert.match(app, /regrasTexto:\s*qs\("#cerebroRegrasTexto"\)/);
assert.match(app, /objecoesTexto:\s*qs\("#cerebroObjecoesTexto"\)/);

// A API persiste os dois blocos no banco.
assert.match(api, /regrasTexto:\s*sanitizarBloco\(regrasTextoEntrada\)/);
assert.match(api, /objecoesTexto:\s*sanitizarBloco\(objecoesTextoEntrada\)/);

// A camada que carrega o Cérebro para a IA não pode descartá-los.
assert.match(pipeline, /regrasTexto:\s*temRegrasTexto/);
assert.match(pipeline, /objecoesTexto:\s*temObjecoesTexto/);
assert.match(pipeline, /cfg\.regrasTexto,\s*cfg\.objecoesTexto/);

// O prompt de maior prioridade deve receber o texto integral dos dois campos.
assert.match(pipeline, /REGRAS COMERCIAIS SALVAS:\\n\$\{regrasTexto\}/);
assert.match(pipeline, /RESPOSTAS A OBJEÇÕES SALVAS:\\n\$\{objecoesTexto\}/);
assert.match(pipeline, /const instrucoesCerebroTexto = formatCerebroPrompt\(configCerebro\)/);
assert.match(pipeline, /=== INÍCIO DO CÉREBRO COMERCIAL ===\n\$\{instrucoesCerebroTexto\}/);

console.log('v859-cerebro-blocos-chegam-ia: ok');
