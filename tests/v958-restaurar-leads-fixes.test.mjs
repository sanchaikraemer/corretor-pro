import assert from 'node:assert/strict';
import { normalizarLeadLegado, restaurarLeadsLegados } from '../api/restaurar-leads.js';

// v958 — revisão de api/restaurar-leads.js. Três bugs reais achados e corrigidos.

// 1. iso(): data serial do Excel (ex.: 45383 = 2024-04-01) chegava a iso() já como STRING (via
// str()), então "typeof value === 'number'" nunca era true e o valor caía direto em
// new Date("45383") — que o JS interpreta como ANO 45383, não Invalid Date, então nem cai no
// fallback: vira uma data lixo persistida silenciosamente.
{
  const row = { nome: 'Fulano de Tal', telefone: '11999998888', criado_em: 45383 };
  const { payload } = normalizarLeadLegado(row, 'leads');
  assert.match(payload.criado_em, /^20(2[0-9]|3[0-5])-/, `data serial do Excel devia virar um ano real (2020s/2030s), veio "${payload.criado_em}"`);
  assert.equal(payload.criado_em, new Date(Date.UTC(1899, 11, 30) + 45383 * 86400000).toISOString());
}

// 2. dedupeKey: duas linhas legadas DIFERENTES (ids diferentes, observações diferentes) sem nome
// e sem telefone não podem colapsar na mesma chave só por causa do nome-placeholder "Cliente
// restaurado" — restaurarLeadsLegados usa dedupeKey pra filtrar "já visto" entre linhas do
// próprio lote (seenKeys), então as duas eram restauradas como se fossem a mesma pessoa e uma
// delas sumia.
{
  const rowA = { id: 101, observacao: 'Cliente A: quer 2 quartos' };
  const rowB = { id: 202, observacao: 'Cliente B: quer 3 quartos, já visitou' };
  const a = normalizarLeadLegado(rowA, 'leads');
  const b = normalizarLeadLegado(rowB, 'leads');
  // dedupeKey vazio em ambas (não usa mais o placeholder "Cliente restaurado") — a prova de que
  // isso não as faz colidir como duplicatas está no teste 2b (fim a fim), já que
  // restaurarLeadsLegados só aplica o filtro seenKeys quando dedupeKey é truthy.
  assert.equal(a.dedupeKey, '', 'sem telefone e sem nome real, dedupeKey fica vazio (filtra só pelo id)');
  assert.equal(b.dedupeKey, '', 'sem telefone e sem nome real, dedupeKey fica vazio (filtra só pelo id)');
}

// 2b. Fim a fim: restaurarLeadsLegados com duas linhas anônimas (sem nome/telefone) na tabela
// "leads" deve restaurar as DUAS, não colapsar em 1.
{
  const upserted = [];
  const fakeSupabase = {
    from(table) {
      const rows = table === 'leads'
        ? [{ id: 101, observacao: 'Cliente A: quer 2 quartos' }, { id: 202, observacao: 'Cliente B: quer 3 quartos' }]
        : [];
      return {
        select() { return { limit() { return Promise.resolve({ data: rows, error: null }); } }; },
        upsert(rowsToUpsert) { upserted.push(...rowsToUpsert); return Promise.resolve({ error: null }); }
      };
    }
  };
  const result = await restaurarLeadsLegados(fakeSupabase, {});
  assert.equal(result.restored, 2, `duas linhas legadas distintas sem nome/telefone deviam restaurar 2, restaurou ${result.restored}`);
  assert.equal(upserted.length, 2);
}

// 3. stage(): "Geladeira" (arquivado, some da busca ativa — normalizarEtapa()/foraDaBusca() em
// app.js) é uma etapa DIFERENTE de "Standby" (pausado, continua no pipeline ativo). O stage()
// antigo jogava as duas no mesmo balde "Standby", fazendo lead arquivado na base antiga voltar
// pra fila ativa depois de restaurado.
{
  const geladeira = normalizarLeadLegado({ nome: 'X', etapa: 'Geladeira' }, 'leads');
  assert.equal(geladeira.payload.etapa, 'Geladeira');
  const arquivado = normalizarLeadLegado({ nome: 'Y', etapa: 'Arquivado' }, 'leads');
  assert.equal(arquivado.payload.etapa, 'Geladeira');
  const standby = normalizarLeadLegado({ nome: 'Z', etapa: 'Standby' }, 'leads');
  assert.equal(standby.payload.etapa, 'Standby');
  const pausado = normalizarLeadLegado({ nome: 'W', etapa: 'pausado' }, 'leads');
  assert.equal(pausado.payload.etapa, 'Standby');
}

console.log('v958-restaurar-leads-fixes: ok');
