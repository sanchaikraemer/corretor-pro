import assert from "node:assert/strict";
import fs from "node:fs";
import { listRecentProcessings } from "./api/_persistence.js";

function fakeSupabase(rows){
  return {
    from(){
      let data = rows.slice();
      const q = {
        select(){ return q; },
        order(){ return q; },
        eq(_col, value){ data = data.filter(r => String(r.id) === String(value)); return q; },
        limit(n){ data = data.slice(0, n); return q; },
        then(resolve){ return Promise.resolve({ data, error:null }).then(resolve); }
      };
      return q;
    }
  };
}

const timeline = Array.from({ length:125 }, (_, i) => ({
  date:"30/06/2026", time:`10:${String(i % 60).padStart(2,"0")}`,
  iso:new Date(2026, 5, 30, 10, i % 60).toISOString(),
  author:i % 2 ? "Sanchai" : "Cliente Teste", text:`Mensagem ${i+1}`,
  type:"text", source:"txt", proposta:i === 50 ? { valor:"100" } : null
}));
const row = {
  id:"lead-1", nome_arquivo:"Conversa do WhatsApp com Cliente Teste.zip",
  status:"pronto", etapa:"Atendimento", progresso:100,
  timeline_json:timeline, resultado_analise:{ clientName:"Cliente Teste", probabilityPercent:70, summary:"Lead ativo" },
  criado_em:new Date().toISOString(), atualizado_em:new Date().toISOString(),
  audios_encontrados:0, audios_transcritos:0
};
const supabase = fakeSupabase([row]);

const lista = await listRecentProcessings(20, { supabase, previewLimit:8 });
assert.equal(lista.ok, true);
assert.equal(lista.items.length, 1);
assert.equal(lista.items[0].messageCount, 125);
assert.equal(lista.items[0].recentMessages.length, 8);
assert.equal(lista.items[0].historyLoaded, false);
assert.equal(lista.items[0].hasProposal, true);
assert.equal(lista.items[0].recentMessages[0].text, "Mensagem 118");

const detalhe = await listRecentProcessings(1, { supabase, id:"lead-1", includeFullTimeline:true });
assert.equal(detalhe.ok, true);
assert.equal(detalhe.items[0].recentMessages.length, 125);
assert.equal(detalhe.items[0].historyLoaded, true);
assert.equal(detalhe.items[0].recentMessages[0].text, "Mensagem 1");

const persistence = fs.readFileSync("api/_persistence.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");
assert.equal(persistence.includes("slice(-40)"), false, "não pode existir corte de 40 mensagens");
assert.match(app, /action=detalhe/);
assert.match(app, /TIMELINE_PAGE_SIZE = 100/);
assert.match(app, /getLeadDetail\(sid\)/);
assert.doesNotMatch(app, /state\.active===\"pipeline\"[^\n]*getLeadsData\(true\)/);

console.log("Teste de histórico/performance: OK — prévia leve + detalhe completo de 125 mensagens.");
