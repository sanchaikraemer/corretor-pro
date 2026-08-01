import fs from 'node:fs';
import assert from 'node:assert/strict';
import { normalizarEtapaBanco, listRecentProcessings } from '../api/_persistence.js';

// v1105 — auditoria do BACKUP REAL do dono (298 registros): 244 tinham um TEXTO de análise da IA
// gravado na coluna etapa ("Acompanhamento do andamento no cartório...", "Aguardar retorno do
// cliente..."), herdado de versões antigas e perpetuado porque a reimportação copiava a etapa
// anterior como estivesse. O risco: um texto futuro contendo "fechado"/"desistiu" no meio da
// frase ARQUIVARIA o cliente sem o corretor mandar. Regra nova: só ETIQUETA CURTA arquiva.

// ── 1. O normalizador do servidor ─────────────────────────────────────────────────────────────
{
  // Casos REAIS tirados do backup do dono.
  assert.equal(normalizarEtapaBanco('Acompanhamento do andamento no cartório de registro e eventual suporte'), 'Ativo');
  assert.equal(normalizarEtapaBanco('Aguardar retorno do cliente para possível qualificação mais detalhada'), 'Ativo');
  assert.equal(normalizarEtapaBanco('Atendimento'), 'Ativo');
  assert.equal(normalizarEtapaBanco('Novo'), 'Ativo');
  assert.equal(normalizarEtapaBanco('Perdido'), 'Geladeira', 'etiqueta curta legada continua virando Arquivado (v1069)');
  assert.equal(normalizarEtapaBanco('Vendido'), 'Geladeira');
  assert.equal(normalizarEtapaBanco('Geladeira'), 'Geladeira');
  assert.equal(normalizarEtapaBanco('Ativo'), 'Ativo');
  assert.equal(normalizarEtapaBanco(''), 'Ativo');

  // O caso de risco: texto LONGO com palavra de arquivamento no meio NÃO pode arquivar.
  assert.equal(
    normalizarEtapaBanco('Cliente desistiu do Renaissance, focar a conversa no Personalité e agendar visita'),
    'Ativo',
    'texto de análise com "desistiu" no meio JAMAIS pode arquivar um cliente'
  );
  assert.equal(
    normalizarEtapaBanco('Confirmar se o negócio pode ser fechado ainda neste mês com as condições atuais'),
    'Ativo',
    'idem para "fechado" dentro de frase'
  );
}

// ── 2. O app aplica a mesma regra na leitura ──────────────────────────────────────────────────
{
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const norm = app.match(/function normalizarEtapa\(raw\)\{[\s\S]*?\n\}/)[0];
  const { normalizarEtapa } = eval(`
    const ETAPA_ARQUIVADO = 'Geladeira'; const ETAPA_ATIVO = 'Ativo';
    ${norm}
    ({ normalizarEtapa });
  `);
  assert.equal(normalizarEtapa('Cliente desistiu do Renaissance, focar no Personalité'), 'Ativo',
    'a tela também não pode arquivar por texto');
  assert.equal(normalizarEtapa('Perdido'), 'Geladeira', 'etiqueta curta continua arquivando');
  assert.equal(normalizarEtapa('Acompanhamento para destravar decisão, propondo contato ativo'), 'Ativo',
    'o caso real do Jamil: texto no lugar da etapa = Ativo');
}

// ── 3. AUTOLIMPEZA: a carga da lista corrige a etapa suja no banco ────────────────────────────
{
  const iso = (d) => new Date(Date.now() - d * 86400000).toISOString();
  const rows = [{
    id: 'sujo-1', organization_id: 'org-1', nome_arquivo: 'Conversa do WhatsApp com Jamil Contalex.zip',
    etapa: 'Acompanhamento para destravar decisão, propondo contato ativo',
    timeline_json: [
      { author: 'Jamil Contalex', text: 'oi', iso: iso(40), date: '2026-06-22', time: '10:00' },
      { author: 'Sanchai', text: 'boa tarde Jamil', iso: iso(36), date: '2026-06-26', time: '17:26' }
    ],
    resultado_analise: { clientName: 'Jamil Contalex' },
    criado_em: iso(40), atualizado_em: iso(36)
  }];
  const updates = [];
  const supa = {
    from() {
      const chain = {
        select() { return this; }, eq() { return this; }, order() { return this; },
        limit() { return Promise.resolve({ data: rows, error: null }); },
        update(payload) { updates.push(payload); return { eq: () => ({ eq: (c, v) => ({ eq: () => Promise.resolve({ error: null }) }) }) }; }
      };
      return chain;
    }
  };

  const r = await listRecentProcessings(10, { supabase: supa, organizationId: 'org-1' });
  assert.ok(r.ok, 'a lista carrega');
  assert.equal(r.items[0].etapa, 'Acompanhamento para destravar decisão, propondo contato ativo',
    'a leitura devolve o dado como está (quem normaliza pra tela é o app)');

  // A regravação acontece DENTRO da própria carga da lista (melhor esforço, com marca d'água).
  const comEtapa = updates.find(u => u && u.etapa);
  assert.ok(comEtapa, 'a regravação do cache precisa aproveitar a viagem e corrigir a etapa suja');
  assert.equal(comEtapa.etapa, 'Ativo', 'texto de análise vira Ativo no banco — o registro se limpa sozinho');
}

console.log('v1105-etapa-nunca-arquiva-por-texto: ok');
