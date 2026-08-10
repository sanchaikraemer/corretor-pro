import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1199 — relato do dono: tinha 2 clientes marcados pra hoje na Agenda, atendeu os dois (marcou
// atendimento), e eles continuaram aparecendo na lista como se nada tivesse acontecido.
//
// Causa: a seção "Atrasados" (v1011, cp786CompromissoAtrasado) já excluía quem foi atendido hoje
// (ehContatadoHoje), mas "Lembretes de hoje" e os compromissos confirmados de HOJE (compHoje)
// nunca tiveram essa mesma proteção — só saíam da lista se o lembrete fosse excluído ou
// reagendado à mão. Esta versão aplica a mesma régua nos dois lugares que faltavam.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// 1. "Lembretes de hoje" agora checa ehContatadoHoje antes de entrar na lista.
assert.match(
  app,
  /const lembretesHoje = items\.filter\(l => \{\s*\n\s*if\(typeof ehContatadoHoje === 'function' && ehContatadoHoje\(l\)\) return false;/,
  '"Lembretes de hoje" precisa excluir quem já foi atendido hoje'
);

// 2. Compromissos confirmados de HOJE também respeitam a mesma régua — sem afetar amanhã/futuro.
assert.match(
  app,
  /const atendidoHoje = typeof ehContatadoHoje === 'function' && ehContatadoHoje\(l\);/,
  'o agrupamento de compromissos precisa calcular se o lead já foi atendido hoje'
);
assert.match(
  app,
  /if\(\/\\bhoje\\b\/\.test\(q\)\)\{ if\(!atendidoHoje\) compHoje\.push\(\{ \.\.\.l, _ap: ap \}\); \}/,
  'compromisso de hoje só entra na lista se o lead ainda não foi atendido hoje'
);

// 3. Compromissos de amanhã/futuro continuam entrando sem essa checagem — não é pra sumir
// um compromisso de outro dia só porque o cliente foi atendido hoje por outro motivo.
assert.match(
  app,
  /else if\(\/amanh\[ãa\]\/\.test\(q\)\) compAmanha\.push\(\{ \.\.\.l, _ap: ap \}\);\s*\n\s*else compFuturo\.push\(\{ \.\.\.l, _ap: ap \}\);/,
  'compromissos de amanhã/futuro não podem ganhar a checagem de "atendido hoje"'
);

console.log('v1199-atendido-hoje-sai-da-agenda: ok');
