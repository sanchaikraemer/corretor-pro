import fs from 'node:fs';
import assert from 'node:assert/strict';
import { gerarAuditoriaDados } from '../api/leads-recentes.js';

// v962 — revisão de api/leads-recentes.js. Dois achados reais.

// 1. gerarAuditoriaDados() contava duplicidades DEPOIS de cortar a lista de exemplos em 50 —
// com mais de 50 grupos duplicados, o resumo ("possiveisDuplicadosTelefone"/"possiveisDuplicadosNome")
// e a mensagem em "problemas" subestimavam o total real (relatório de auditoria de dados
// reportando menos problema do que existe de verdade).
{
  const rows = [];
  // 60 telefones diferentes, cada um aparecendo em 2 registros (60 grupos duplicados).
  for (let i = 0; i < 60; i++) {
    const tel = `1199900${String(i).padStart(4, '0')}`;
    rows.push({ id: `a${i}`, telefone: tel, nome: `Cliente ${i}`, timeline_json: [{ x: 1 }], resultado_analise: { summary: 'ok' } });
    rows.push({ id: `b${i}`, telefone: tel, nome: `Cliente ${i} bis`, timeline_json: [{ x: 1 }], resultado_analise: { summary: 'ok' } });
  }
  const auditoria = gerarAuditoriaDados(rows);
  assert.equal(auditoria.resumo.possiveisDuplicadosTelefone, 60, `resumo deve contar os 60 grupos reais, contou ${auditoria.resumo.possiveisDuplicadosTelefone}`);
  assert.equal(auditoria.duplicados.porTelefone.length, 50, 'a lista de exemplos continua limitada a 50 (não é o bug, é o comportamento esperado)');
  assert.ok(auditoria.problemas.some(p => p.includes('60 possível')), `mensagem de problemas deve citar 60, veio: ${JSON.stringify(auditoria.problemas)}`);
}

// 2. "Cliente importado/importada" (placeholder de nome) não deve virar sinal de duplicidade —
// já era assim antes (comportamento correto, confirmado aqui pra não regredir).
{
  const rows = [
    { id: 'c1', nome: 'Cliente importado', timeline_json: [], resultado_analise: {} },
    { id: 'c2', nome: 'Cliente importada', timeline_json: [], resultado_analise: {} },
    { id: 'c3', nome: 'Cliente importado', timeline_json: [], resultado_analise: {} }
  ];
  const auditoria = gerarAuditoriaDados(rows);
  assert.equal(auditoria.resumo.possiveisDuplicadosNome, 0, 'placeholder "Cliente importado/a" não conta como duplicidade de nome');
}

// 3. exportarTudo ("full backup") precisa incluir direciona_config (o Cérebro — ver CLAUDE.md):
// sem essa tabela, um backup "completo" recupera os leads mas perde toda a configuração da IA.
// Checagem estática (exportarTudo não é exportada e depende de getSupabaseAdmin real).
{
  const src = fs.readFileSync(new URL('../api/leads-recentes.js', import.meta.url), 'utf8');
  const exportarTudoSrc = src.match(/async function exportarTudo\([\s\S]*?\n\}/)?.[0];
  assert.ok(exportarTudoSrc, 'achei a função exportarTudo');
  assert.match(exportarTudoSrc, /["']direciona_config["']/, 'exportarTudo deve incluir a tabela direciona_config na lista de tabelas exportadas');
}

console.log('v962-leads-recentes-auditoria-e-backup: ok');
