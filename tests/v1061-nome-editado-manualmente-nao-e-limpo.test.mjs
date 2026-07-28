import fs from 'node:fs';
import assert from 'node:assert/strict';
import { listRecentProcessings } from '../api/_persistence.js';

// v1061 — dono relatou (com print): editou o nome do lead "Cristiano nvr" pra "Cristiano terreno
// nvr" na tela Editar lead, salvou, e a tela voltou a mostrar "Cristiano nvr" — como se a edição
// não tivesse pego. O banco gravava certo (api/lead-update.js: acaoEditarDados grava
// resultado_analise.clientName = "Cristiano terreno nvr" exatamente como digitado), mas TODA
// leitura do lead passava o nome por nameFrom() (api/_persistence.js), que tinha um filtro
// (limparRuidoNome) que apagava palavras como "terreno", "lote", "cel", "whatsapp" do nome —
// pensado pra limpar contato salvo torto no WhatsApp na importação automática, mas aplicado em
// TODA renderização, inclusive depois de uma edição manual explícita.
//
// Pedido do dono depois de uma 1ª correção (que só preservava o nome quando marcado como editado
// manualmente): "retire esse filtro, não pode ter isso, tem que salvar como quiser e como está
// salvo no celular na hora de importar, simples assim." Fix final: o filtro (limparRuidoNome) foi
// REMOVIDO por completo — o nome nunca é alterado, nem na edição manual nem na importação.

function fakeSupabaseUmaLinha(row) {
  return {
    from(tabela) {
      assert.equal(tabela, 'whatsapp_processamentos');
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit() { return Promise.resolve({ data: [row], error: null }); }
      };
    }
  };
}

async function parteLeitura() {
  // Nome editado à mão (tela Editar lead) — precisa aparecer exatamente como digitado.
  const rowEditado = {
    id: 'lead-cristiano',
    nome_arquivo: 'Conversa do WhatsApp com Cristiano.zip',
    timeline_json: [],
    resultado_analise: { summary: 'teste', clientName: 'Cristiano terreno nvr' },
    organization_id: 'org-1',
    atualizado_em: new Date().toISOString()
  };
  const r1 = await listRecentProcessings(10, { supabase: fakeSupabaseUmaLinha(rowEditado), organizationId: 'org-1' });
  const item1 = r1.items.find(i => i.id === 'lead-cristiano');
  assert.ok(item1, 'lead precisa aparecer na listagem');
  assert.equal(item1.name, 'Cristiano terreno nvr',
    'nome editado à mão pelo corretor tem que aparecer EXATAMENTE como foi digitado, sem filtrar "terreno"');

  // Mesma garantia no detalhe completo do lead (a tela do lead usa includeFullTimeline).
  const r2 = await listRecentProcessings(10, { supabase: fakeSupabaseUmaLinha(rowEditado), organizationId: 'org-1', includeFullTimeline: true });
  const item2 = r2.items.find(i => i.id === 'lead-cristiano');
  assert.equal(item2.name, 'Cristiano terreno nvr', 'mesma garantia no detalhe completo do lead');

  // Nome como veio da IMPORTAÇÃO (não editado depois) — o pedido do dono foi "como está salvo no
  // celular na hora de importar": também não pode filtrar nenhuma palavra.
  const rowImportado = {
    id: 'lead-bruna',
    nome_arquivo: 'Conversa do WhatsApp com Bruna Cel Terreno.zip',
    timeline_json: [],
    resultado_analise: { summary: 'teste', clientName: 'Bruna Cel Terreno' },
    organization_id: 'org-1',
    atualizado_em: new Date().toISOString()
  };
  const r3 = await listRecentProcessings(10, { supabase: fakeSupabaseUmaLinha(rowImportado), organizationId: 'org-1' });
  const item3 = r3.items.find(i => i.id === 'lead-bruna');
  assert.equal(item3.name, 'Bruna Cel Terreno',
    'nome como veio da importação (salvo no celular) também não pode ser filtrado — sem exceção');

  console.log('v1061 (leitura): nome nunca é filtrado, nem editado à mão nem vindo da importação — ok');
}
await parteLeitura();

// ===================== Parte B — o filtro de "ruído de nome" foi removido de vez =====================

const persistenceSrc = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');
assert.doesNotMatch(persistenceSrc, /function limparRuidoNome/,
  'limparRuidoNome precisa ter sido removida — o dono pediu explicitamente pra não ter mais esse filtro');
assert.doesNotMatch(persistenceSrc, /limparRuidoNome\(/,
  'nenhuma chamada a limparRuidoNome pode sobrar em _persistence.js');

console.log('v1061 (_persistence.js): filtro de ruído de nome removido por completo — ok');

console.log('v1061-nome-editado-manualmente-nao-e-limpo: ok');
