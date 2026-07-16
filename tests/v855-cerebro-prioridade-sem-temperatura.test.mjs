import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const apiDir = path.join(root, 'api');

for (const name of fs.readdirSync(apiDir).filter((n) => n.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(apiDir, name), 'utf8');
  assert.doesNotMatch(source, /\btemperature\s*:/, `${name} não deve definir temperature nas chamadas da API`);
}

const pipeline = fs.readFileSync(path.join(apiDir, '_pipeline.js'), 'utf8');
assert.match(
  pipeline,
  /\{ role: "system", content: String\(systemPrompt\)\.trim\(\) \}/,
  'O Cérebro deve seguir em mensagem system, separada dos dados da conversa'
);
assert.match(
  pipeline,
  /const systemPromptAnalise = `INSTRUÇÕES DE MAIOR PRIORIDADE:[\s\S]*=== INÍCIO DO CÉREBRO COMERCIAL ===[\s\S]*\$\{instrucoesCerebroTexto\}[\s\S]*=== FIM DO CÉREBRO COMERCIAL ===/,
  'O conteúdo atual do Cérebro deve compor a instrução de maior prioridade'
);
assert.match(
  pipeline,
  /const prompt = `Execute a análise[\s\S]*Data e hora atuais da análise no Brasil:[\s\S]*CONVERSA COMPLETA:[\s\S]*\$\{timelineText\}`/,
  'Horário e conversa devem permanecer no conteúdo de entrada, separados do Cérebro'
);

console.log('v855-cerebro-prioridade-sem-temperatura: ok');
