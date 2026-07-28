import assert from 'node:assert/strict';
import { listRecentProcessings } from '../api/_persistence.js';

// v1063 — depois da v1062 remover o filtro que apagava palavras de dentro do nome do lead
// (pedido do dono), ele voltou pra pedir: "coloca de volta o filtro, porém só pra retirar do
// arquivo que vem 'Conversa do WhatsApp com', '-enxuto.zip' ou '.zip'". Esse filtro (cleanFileName,
// em api/_persistence.js) nunca tinha sido removido — só o outro (limparRuidoNome, que mexia no
// CONTEÚDO do nome) — mas este teste trava explicitamente o comportamento pedido, pra nunca mais
// sumir por engano numa limpeza futura: tira só a embalagem do arquivo exportado pelo WhatsApp,
// nunca uma palavra do nome real da pessoa.

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

async function nomeParaArquivo(nomeArquivo, clientName) {
  const row = {
    id: 'lead-teste',
    nome_arquivo: nomeArquivo,
    timeline_json: [],
    resultado_analise: { summary: 'teste', ...(clientName != null ? { clientName } : {}) },
    organization_id: 'org-1',
    atualizado_em: new Date().toISOString()
  };
  const r = await listRecentProcessings(10, { supabase: fakeSupabaseUmaLinha(row), organizationId: 'org-1' });
  return r.items.find(i => i.id === 'lead-teste')?.name;
}

async function run() {
  // Nome do cliente ausente/ruim: cai pro nome do arquivo — a embalagem do WhatsApp some.
  assert.equal(await nomeParaArquivo('Conversa do WhatsApp com Ana Paula-enxuto.zip', ''), 'Ana Paula',
    '"Conversa do WhatsApp com" e "-enxuto.zip" precisam sumir do nome vindo do arquivo');
  assert.equal(await nomeParaArquivo('Conversa do com Bruna.zip', ''), 'Bruna',
    'variação sem a palavra "WhatsApp" também precisa cair, e ".zip" sozinho também some');
  assert.equal(await nomeParaArquivo('Cristiano-enxuto.zip', ''), 'Cristiano',
    '"-enxuto.zip" sozinho (sem o prefixo "Conversa do...") também precisa sumir');

  // O nome REAL do cliente (analysis.clientName) nunca perde palavra nenhuma — só a v1062
  // proibiu mexer no conteúdo do nome, isso continua valendo.
  assert.equal(await nomeParaArquivo('Fulano.zip', 'Fulano Terreno Cel'), 'Fulano Terreno Cel',
    'nenhuma palavra do nome real (mesmo "terreno"/"cel") pode ser apagada — só a embalagem do arquivo');
  assert.equal(await nomeParaArquivo('Conversa do WhatsApp com Fulano.zip', 'Cristiano terreno nvr'), 'Cristiano terreno nvr',
    'quando já existe um nome real analisado, o filtro nem entra em ação — mostra exatamente como está salvo');

  console.log('v1063-filtro-so-tira-embalagem-do-arquivo: ok');
}
await run();
