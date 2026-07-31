import assert from 'node:assert/strict';
import { restaurarLeadsLegados } from '../api/restaurar-leads.js';
import { EMPRESA_PRINCIPAL_ID } from '../api/_persistence.js';

// v1082 — vazamento entre contas, achado na auditoria desta versão.
//
// As tabelas antigas "leads"/"direciona_leads" existem desde antes das contas por login e NUNCA
// ganharam a coluna organization_id (as migrações 0001/0002 só acrescentaram essa coluna em
// whatsapp_processamentos e direciona_config). Mesmo assim, todo salvamento de lead — de QUALQUER
// corretor — também gravava uma cópia nelas. Como as três rotas que leem essas tabelas tratam
// tudo que está lá como sendo da conta original, o cliente de um corretor podia ser puxado pra
// conta original numa "Restauração de leads" (upsert por id, que reescreve o registro do outro).
//
// Este teste tranca as duas pontas: a gravação (não copia mais lead de outra conta pro balde sem
// dono) e a restauração (nunca reescreve um id que hoje pertence a outra empresa).

const EMPRESA_DE_OUTRO_CORRETOR = '11111111-1111-1111-1111-111111111111';

// ── Ponta 1: a restauração ignora um id que pertence a outra empresa ───────────────────────────
{
  const upserted = [];
  const idDoOutroCorretor = 'lead-do-outro-corretor';

  const fakeSupabase = {
    from(table) {
      if (table === 'leads') {
        // O balde sem dono já contaminado: uma linha da conta original e uma que, na prática,
        // é de outro corretor (gravada lá pelo comportamento antigo).
        const rows = [
          { id: 'lead-da-conta-original', nome: 'Cliente da conta original', telefone: '54999000001' },
          { id: idDoOutroCorretor, nome: 'Cliente de outro corretor', telefone: '54999000002' }
        ];
        return { select: () => ({ limit: () => Promise.resolve({ data: rows, error: null }) }) };
      }
      if (table === 'direciona_leads') {
        return { select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) };
      }
      // whatsapp_processamentos
      return {
        select: () => ({
          // currentKeys(): o que a conta original já tem (nada).
          eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          // idsDeOutrasEmpresas(): os ids que hoje são de OUTRA empresa.
          neq: () => ({
            range: (inicio) => Promise.resolve({
              data: inicio === 0
                ? [{ id: idDoOutroCorretor, organization_id: EMPRESA_DE_OUTRO_CORRETOR }]
                : [],
              error: null
            })
          })
        }),
        upsert(rows) { upserted.push(...rows); return Promise.resolve({ error: null }); }
      };
    }
  };

  // force:true é o pior caso — ele pula a checagem de "já existe", então era por aqui que o
  // registro de outra conta seria reescrito mesmo estando lá.
  const resultado = await restaurarLeadsLegados(fakeSupabase, { force: true });

  const idsRestaurados = upserted.map(r => String(r.id));
  assert.ok(!idsRestaurados.includes(idDoOutroCorretor),
    `a restauração NUNCA pode tocar num lead de outra empresa — restaurou ${JSON.stringify(idsRestaurados)}`);
  assert.deepEqual(idsRestaurados, ['lead-da-conta-original'],
    'o lead legítimo da conta original continua sendo restaurado normalmente');
  assert.equal(resultado.ignoradosDeOutraEmpresa, 1,
    'o relatório precisa dizer quantos leads foram deixados de fora por serem de outra empresa');
  for (const row of upserted) {
    assert.equal(row.organization_id, EMPRESA_PRINCIPAL_ID,
      'o que é restaurado continua indo pra conta original');
  }
}

// ── Ponta 2: o salvamento não alimenta mais o balde sem dono ───────────────────────────────────
{
  const fonte = await import('node:fs').then(fs => fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8'));

  // A escrita nas tabelas legadas precisa estar dentro de uma guarda de empresa principal.
  const trecho = fonte.match(/if \(organizationId === EMPRESA_PRINCIPAL_ID\) \{[\s\S]*?for \(const table of \["leads", "direciona_leads"\]\)/);
  assert.ok(trecho,
    'a gravação nas tabelas legadas leads/direciona_leads só pode acontecer pra empresa principal');

  // E a etapa gravada na importação não pode mais vir da IA (texto livre) — ver o outro teste
  // desta versão pro porquê; aqui a checagem é só de que a coluna não recebe mais o palpite.
  assert.doesNotMatch(fonte, /etapa: analysis\?\.etapaSugerida/,
    'a coluna etapa não pode mais receber o palpite de funil da IA');
}

console.log('v1082-lead-de-um-corretor-nao-vaza-pra-conta-original: ok');
