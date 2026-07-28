import fs from 'node:fs';
import assert from 'node:assert/strict';
import { listRecentProcessings } from '../api/_persistence.js';

// v1061 — dono relatou (com print): editou o nome do lead "Cristiano nvr" pra "Cristiano terreno
// nvr" na tela Editar lead, salvou, e a tela voltou a mostrar "Cristiano nvr" — como se a edição
// não tivesse pego. O banco gravava certo (api/lead-update.js: acaoEditarDados grava
// resultado_analise.clientName = "Cristiano terreno nvr" exatamente como digitado), mas TODA
// leitura do lead passa por nameFrom() (api/_persistence.js), que tem um filtro de "ruído de
// nome de contato do WhatsApp" (limparRuidoNome) que apaga palavras como "terreno", "lote",
// "cel", "whatsapp" do nome — pensado pra limpar contato salvo tipo "Fulano Cel" na importação
// automática, mas aplicado em TODA renderização, inclusive depois de uma edição manual explícita.
// Fix: acaoEditarDados marca resultado_analise.nomeEditadoManualmente = true; nameFrom() para de
// filtrar o nome quando essa marca existe, e api/reanalisar-lead.js preserva a marca ao gravar
// de novo (senão o próximo "Reanalisar" perdia a marca e o bug voltava).

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
  const rowSemMarca = {
    id: 'lead-cristiano',
    nome_arquivo: 'Conversa do WhatsApp com Cristiano.zip',
    timeline_json: [],
    resultado_analise: { summary: 'teste', clientName: 'Cristiano terreno nvr' },
    organization_id: 'org-1',
    atualizado_em: new Date().toISOString()
  };
  const r0 = await listRecentProcessings(10, { supabase: fakeSupabaseUmaLinha(rowSemMarca), organizationId: 'org-1' });
  const item0 = r0.items.find(i => i.id === 'lead-cristiano');
  assert.ok(item0, 'lead precisa aparecer na listagem');
  assert.equal(item0.name, 'Cristiano nvr',
    'documenta o bug antigo: sem a marca de edição manual, "terreno" ainda é filtrado como ruído (comportamento pré-existente e intencional pra nome bruto de importação)');

  const rowComMarca = {
    ...rowSemMarca,
    resultado_analise: { summary: 'teste', clientName: 'Cristiano terreno nvr', nomeEditadoManualmente: true }
  };
  const r1 = await listRecentProcessings(10, { supabase: fakeSupabaseUmaLinha(rowComMarca), organizationId: 'org-1' });
  const item1 = r1.items.find(i => i.id === 'lead-cristiano');
  assert.equal(item1.name, 'Cristiano terreno nvr',
    'nome editado à mão pelo corretor (marca nomeEditadoManualmente) tem que aparecer EXATAMENTE como foi digitado, sem filtrar "terreno"');

  // Mesma garantia no detalhe completo do lead (a tela do lead usa includeFullTimeline).
  const r2 = await listRecentProcessings(10, { supabase: fakeSupabaseUmaLinha(rowComMarca), organizationId: 'org-1', includeFullTimeline: true });
  const item2 = r2.items.find(i => i.id === 'lead-cristiano');
  assert.equal(item2.name, 'Cristiano terreno nvr', 'mesma garantia no detalhe completo do lead');

  console.log('v1061 (leitura): nome editado à mão sobrevive ao filtro de ruído de nome — ok');
}
await parteLeitura();

// ===================== Parte B — lead-update.js marca a edição manual =====================

const leadUpdateSrc = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
const iniEditarDados = leadUpdateSrc.indexOf('async function acaoEditarDados(');
assert.ok(iniEditarDados > -1, 'acaoEditarDados não encontrada em lead-update.js');
const fimEditarDados = leadUpdateSrc.indexOf('\n}\n', iniEditarDados);
const corpoEditarDados = leadUpdateSrc.slice(iniEditarDados, fimEditarDados);
assert.match(corpoEditarDados, /merged\.nomeEditadoManualmente\s*=\s*true/,
  'acaoEditarDados precisa marcar nomeEditadoManualmente ao salvar um nome digitado pelo corretor');

console.log('v1061 (lead-update.js): editar-dados marca a edição manual do nome — ok');

// ===================== Parte C — reanalisar-lead.js preserva a marca =====================

const reanalisarSrc = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url), 'utf8');
assert.match(reanalisarSrc, /nomeEditadoManualmente:\s*freshPrevious\.nomeEditadoManualmente/,
  'reanalisar-lead.js precisa preservar a marca de nome editado manualmente ao gravar a reanálise, senão o próximo "Reanalisar" perde a marca e o bug volta');

console.log('v1061 (reanalisar-lead.js): reanálise preserva a marca de nome editado manualmente — ok');

console.log('v1061-nome-editado-manualmente-nao-e-limpo: ok');
