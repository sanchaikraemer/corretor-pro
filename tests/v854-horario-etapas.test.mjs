import assert from 'node:assert/strict';
import fs from 'node:fs';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.match(
  pipeline,
  /const fusoAnalise = ["']America\/Sao_Paulo["']/,
  'a análise deve usar explicitamente o fuso America/Sao_Paulo'
);
assert.match(
  pipeline,
  /dataHoraAtualAnalise = _agoraDt\.toLocaleString\(["']pt-BR["'],\s*\{[\s\S]*?timeZone: fusoAnalise[\s\S]*?hour: ["']2-digit["'][\s\S]*?minute: ["']2-digit["']/,
  'a hora atual deve ser calculada no momento da análise'
);
assert.match(
  pipeline,
  /Data e hora atuais da análise no Brasil: \$\{dataHoraAtualAnalise\}/,
  'o prompt deve receber data e hora atuais, não apenas a data'
);
assert.match(
  pipeline,
  /Fuso horário da análise: \$\{fusoAnalise\}/,
  'o prompt deve informar o fuso da hora atual'
);
assert.doesNotMatch(
  pipeline,
  /Data atual no Brasil: \$\{hoje\}/,
  'a antiga linha que enviava somente a data não pode permanecer'
);

assert.match(
  app,
  /const etapasVisiveis = idxAtual === 7\s*\? ETAPAS_PROCESSAMENTO\s*:\s*ETAPAS_PROCESSAMENTO\.slice\(0, 7\)/,
  'Falha recuperável só deve entrar na lista quando o estado real for de falha'
);
assert.match(
  app,
  /renderEtapas\(7, ["']a importação pode ser retomada sem perder o ZIP["']\)/,
  'o estado de falha recuperável deve continuar disponível quando houver erro real'
);

console.log('v854-horario-etapas: ok');
