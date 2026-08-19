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
// v1132 — o bloco do Cérebro passou a ser condicional: quem ainda não configurou recebe, no mesmo
// lugar, as instruções de MODO PRÉVIA (analisar só com base na conversa, sem afirmar nada
// comercial). O que este teste protege não muda — o conteúdo do Cérebro, quando existe, continua
// sendo a instrução de maior prioridade, entre os mesmos marcadores e na mensagem system.
assert.match(
  pipeline,
  /const systemPromptAnalise = `INSTRUÇÕES DE MAIOR PRIORIDADE:[\s\S]*=== INÍCIO DO CÉREBRO COMERCIAL ===[\s\S]*instrucoesCerebroTexto[\s\S]*=== FIM DO CÉREBRO COMERCIAL ===/,
  'O conteúdo atual do Cérebro deve compor a instrução de maior prioridade'
);
// v1308 — o mesmo lugar agora tem TRÊS estados: Cérebro enviado, Cérebro vazio (modo prévia) e
// Cérebro desligado pela chave da tela. Nenhum deles pode deixar o bloco vazio e solto.
assert.match(
  pipeline,
  /=== INÍCIO DO CÉREBRO COMERCIAL ===\s*\$\{cerebroNoPedido\s*\?\s*instrucoesCerebroTexto[\s\S]*?MODO PRÉVIA[\s\S]*?DESLIGADO NESTA ANÁLISE/,
  'sem Cérebro (vazio ou desligado na chave), o mesmo lugar precisa receber instruções — nunca ficar vazio e solto'
);
// v1263 — este trecho exigia que o prompt TERMINASSE exatamente em ${timelineText}. A conferência
// final (7 itens, criada na v1263) entrou DEPOIS da conversa de propósito: ela é a última coisa que
// a IA lê antes de escrever, e é isso que a faz valer mais que as regras espalhadas no meio do
// texto. O que este teste protege de verdade continua igual — horário e conversa ficam no conteúdo
// de entrada, separados do Cérebro, que mora no prompt de sistema.
// v1291 — o dono reescreveu o pedido: os rótulos mudaram ("Data e hora atuais no Brasil", e o
// título da conversa agora varia conforme o que a IA recebeu) e a "CONFERÊNCIA FINAL" de 7 itens
// virou "REVISÃO FINAL SILENCIOSA", de 10. O que este teste protege continua igual: horário e
// conversa ficam no conteúdo de entrada, separados do Cérebro, que mora no prompt de sistema.
assert.match(
  pipeline,
  /const prompt = `Execute a análise[\s\S]*Data e hora atuais no Brasil:[\s\S]*CONVERSA \$\{[\s\S]*\$\{timelineText\}/,
  'Horário e conversa devem permanecer no conteúdo de entrada, separados do Cérebro'
);
// E a revisão final tem que ser mesmo a ÚLTIMA coisa do prompt, depois da conversa.
const posTimeline = pipeline.indexOf('${timelineText}');
const posConferencia = pipeline.indexOf('REVISÃO FINAL SILENCIOSA');
assert.ok(posConferencia > posTimeline,
  'a conferência final precisa vir DEPOIS da conversa — é o último item lido antes de a IA escrever');

console.log('v855-cerebro-prioridade-sem-temperatura: ok');
