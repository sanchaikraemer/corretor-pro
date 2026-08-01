import fs from 'node:fs';
import assert from 'node:assert/strict';
import { listRecentProcessings } from '../api/_persistence.js';

// v1102 — O DONO, com print do Jamil: "nunca atendido jamil?????". O Jamil recebeu apresentação,
// visita, material — tudo pelo WhatsApp — e a lista "Sem atender 30d+" dizia "NUNCA — nunca
// atendido", porque só contava atendimento MARCADO no app.
//
// E quando ele cobrou de novo ("o Jamil tem atendimento e eu te mostrei no print"), apareceu um
// segundo furo: a lista só carrega as últimas 8 mensagens de cada conversa. Se as 8 forem todas
// do cliente, as respostas do corretor ficam FORA da prévia e o app diria "nunca respondeu"
// mesmo pra quem respondeu. Por isso o SERVIDOR, que enxerga a conversa inteira, passou a
// informar a última mensagem do corretor (lastCorretorMsgIso).

const DIA = 86400000;
const iso = (d) => new Date(Date.now() - d * DIA).toISOString();

// ── 1. O servidor acha a resposta do corretor mesmo FORA da prévia de 8 mensagens ─────────────
{
  // Conversa do "caso Jamil piorado": o corretor respondeu há 53 dias, e DEPOIS o cliente mandou
  // 10 mensagens seguidas — a prévia de 8 não contém nenhuma mensagem do corretor.
  const timeline = [
    { author: 'Jamil Contalex', text: 'oi, tenho interesse', iso: iso(60), date: '2026-06-02', time: '10:00' },
    { author: 'Construtora Senger', text: 'te mando o material do Personalité', iso: iso(53), date: '2026-06-09', time: '16:14' },
    ...Array.from({ length: 10 }, (_, i) => ({
      author: 'Jamil Contalex', text: `mensagem ${i + 1} do cliente`, iso: iso(50 - i), date: '2026-06-12', time: '09:00'
    }))
  ];
  const rows = [{
    id: 'jamil-1', organization_id: 'org-1', nome_arquivo: 'Conversa do WhatsApp com Jamil Contalex.zip',
    etapa: 'Ativo', timeline_json: timeline,
    resultado_analise: { clientName: 'Jamil Contalex', summary: 'x' },
    criado_em: iso(60), atualizado_em: iso(50)
  }];
  const supa = {
    from() {
      return {
        select() { return this; }, eq() { return this; }, order() { return this; },
        limit() { return Promise.resolve({ data: rows, error: null }); }
      };
    }
  };

  const r = await listRecentProcessings(10, { supabase: supa, organizationId: 'org-1' });
  assert.ok(r.ok, 'a lista precisa carregar');
  const jamil = r.items[0];

  assert.equal(jamil.historyPreviewCount, 8, 'a prévia é mesmo de 8 mensagens (a limitação existe)');
  assert.ok(!jamil.recentMessages.some(m => m.author === 'Construtora Senger'),
    'e nenhuma resposta do corretor sobrou na prévia — é o caso que quebrava');

  assert.ok(jamil.lastCorretorMsgIso, 'o servidor PRECISA informar a última mensagem do corretor');
  const dias = Math.round((Date.now() - Date.parse(jamil.lastCorretorMsgIso)) / DIA);
  assert.ok(dias >= 52 && dias <= 54, `e ela é a de 53 dias atrás (veio ${dias})`);
}

// ── 2. Quem NUNCA respondeu de verdade continua sem data ──────────────────────────────────────
{
  const rows = [{
    id: 'mudo-1', organization_id: 'org-1', nome_arquivo: 'Conversa do WhatsApp com Cliente Silencio.zip',
    etapa: 'Ativo',
    timeline_json: [{ author: 'Cliente Silencio', text: 'oi, quero informações', iso: iso(40), date: '2026-06-22', time: '10:00' }],
    resultado_analise: { clientName: 'Cliente Silencio' },
    criado_em: iso(40), atualizado_em: iso(40)
  }];
  const supa = {
    from() {
      return {
        select() { return this; }, eq() { return this; }, order() { return this; },
        limit() { return Promise.resolve({ data: rows, error: null }); }
      };
    }
  };
  const r = await listRecentProcessings(10, { supabase: supa, organizationId: 'org-1' });
  assert.equal(r.items[0].lastCorretorMsgIso, null,
    'sem nenhuma mensagem do corretor, não pode inventar data — esse sim é "você nunca respondeu"');
}

// ── 3. Sugestão da IA e registro manual NÃO contam como mensagem do corretor ──────────────────
{
  const rows = [{
    id: 'x-1', organization_id: 'org-1', nome_arquivo: 'Conversa do WhatsApp com Fulano.zip',
    etapa: 'Ativo',
    timeline_json: [
      { author: 'Fulano', text: 'oi', iso: iso(30), date: '2026-07-02', time: '10:00' },
      { author: 'Sistema', type: 'sugestao-ia', source: 'assistant', text: 'sugestão da IA', iso: iso(20) },
      { author: 'Mensagem enviada (você)', type: 'mensagem_enviada', source: 'manual', text: 'registro manual', iso: iso(10) }
    ],
    resultado_analise: { clientName: 'Fulano' },
    criado_em: iso(30), atualizado_em: iso(10)
  }];
  const supa = {
    from() {
      return {
        select() { return this; }, eq() { return this; }, order() { return this; },
        limit() { return Promise.resolve({ data: rows, error: null }); }
      };
    }
  };
  const r = await listRecentProcessings(10, { supabase: supa, organizationId: 'org-1' });
  assert.equal(r.items[0].lastCorretorMsgIso, null,
    'sugestão da IA e registro manual não são mensagem enviada na conversa (o manual já conta por outra via)');
}

// ── 4. O app usa o campo do servidor ──────────────────────────────────────────────────────────
{
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const fn = app.match(/function cpUltimoContatoCorretorTs\(l\)\{[\s\S]*?\n\}/)[0];
  assert.match(fn, /lastCorretorMsgIso/,
    'cpUltimoContatoCorretorTs precisa preferir o campo do servidor (conversa inteira), não só a prévia de 8');
}

console.log('v1102-atender-pelo-whatsapp-conta: ok');
