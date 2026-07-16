import assert from 'node:assert/strict';
import fs from 'node:fs';
import { anonimizarTextoAprendizadoExportacao } from '../api/_pipeline.js';

const limpo = anonimizarTextoAprendizadoExportacao(
  'Rodrigo, telefone +55 54 99999-1234, e-mail rodrigo@teste.com e link https://exemplo.com/apresentacao',
  ['Rodrigo']
);
assert.doesNotMatch(limpo, /Rodrigo/i, 'nome informado como alias deve ser removido');
assert.doesNotMatch(limpo, /99999-1234/, 'telefone deve ser removido');
assert.doesNotMatch(limpo, /rodrigo@teste\.com/i, 'e-mail deve ser removido');
assert.doesNotMatch(limpo, /https?:\/\//i, 'link deve ser removido');
assert.match(limpo, /\[cliente\]/, 'nome deve virar marcador anônimo');

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/cerebro-config.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

assert.match(app, /id="exportarAprendizado"/, 'aba Aprendizado deve ter botão de exportação');
assert.match(app, /exportarAprendizadoExcel/, 'frontend deve preparar o Excel');
assert.match(app, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/, 'arquivo deve ser XLSX');
assert.match(app, /Não altera nenhuma configuração e não chama a IA/, 'interface deve explicar que a exportação é passiva');
assert.match(api, /body\.action === "exportar-aprendizado"/, 'API deve expor a ação de exportação');
assert.match(api, /obterExportacaoAprendizado/, 'API deve usar a exportação estruturada');
assert.match(pipeline, /Não chama IA, não altera o/, 'exportação não deve chamar IA nem alterar o Cérebro');
assert.doesNotMatch(api.match(/if \(body\.action === "exportar-aprendizado"\)[\s\S]*?\n    }/m)?.[0] || '', /getOpenAI\(/, 'ação de exportação não pode iniciar IA');

console.log('v857-exportar-aprendizado: ok');
