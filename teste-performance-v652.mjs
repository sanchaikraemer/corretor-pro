import assert from "node:assert/strict";
import fs from "node:fs";
import { listRecentProcessings } from "./api/_persistence.js";

function fakeSupabase(rows){
  return {
    from(){
      let data = rows.slice();
      const q = {
        select(){ return q; }, order(){ return q; },
        eq(_col, value){ data = data.filter(r => String(r.id) === String(value)); return q; },
        limit(n){ data = data.slice(0, n); return q; },
        then(resolve){ return Promise.resolve({ data, error:null }).then(resolve); }
      };
      return q;
    }
  };
}

const timeline = Array.from({ length:350 }, (_, i) => ({
  date:"30/06/2026", time:"10:00", iso:new Date(2026,5,30,10,0,i%60).toISOString(),
  author:i%2?"Sanchai":"Cliente", text:`Mensagem ${i+1}`, type:"text", source:"txt"
}));
const giantPayload = "x".repeat(250_000);
const analysis = {
  clientName:"Cliente", summary:"Ativo", probabilityPercent:82,
  nextAction:"Retomar", messages:{ a:"A", b:"B", c:"C" },
  diagnostico:{ interesse:"alto" }, leituraComercial:{ temperatura:"quente" },
  campoLegadoGigante:giantPayload
};
const row = { id:"1", nome_arquivo:"Cliente.zip", status:"pronto", etapa:"Negociação", progresso:100,
  timeline_json:timeline, resultado_analise:analysis, criado_em:new Date().toISOString(), atualizado_em:new Date().toISOString() };
const supabase = fakeSupabase([row]);

const lista = await listRecentProcessings(2000, { supabase, previewLimit:8 });
assert.equal(lista.items[0].recentMessages.length, 8);
assert.equal(lista.items[0].messageCount, 350);
assert.equal(lista.items[0].analysis.campoLegadoGigante, undefined, "lista não deve transportar campos legados pesados");
assert.equal(lista.items[0].analysis.diagnostico.interesse, "alto");

const detalhe = await listRecentProcessings(1, { supabase, id:"1", includeFullTimeline:true });
assert.equal(detalhe.items[0].recentMessages.length, 350);
assert.equal(detalhe.items[0].analysis.campoLegadoGigante.length, giantPayload.length, "detalhe preserva análise integral");

const app = fs.readFileSync("app.js", "utf8");
const persistence = fs.readFileSync("api/_persistence.js", "utf8");
const startup = app.slice(app.indexOf("async function iniciarDireciona"), app.indexOf("// Auto-refresh leve"));

assert.match(app, /function show\(t, options=\{\}\)/);
assert.match(app, /if\(!options\.skipLoad\) carregarTelaAtiva/);
assert.match(app, /requestIdleCallback\(aplicarCompleto/);
assert.match(app, /CARTEIRA_PAGE_SIZE\s*=\s*80/);
assert.doesNotMatch(startup, /refreshAllSections\(/, "startup não pode renderizar telas escondidas");
assert.equal((app.match(/qsa\("\.nav\[data-target\],\.go"\)/g)||[]).length, 1, "navegação deve ter um único listener");
assert.match(persistence, /compactAnalysisForList/);
assert.doesNotMatch(persistence, /timeline\.filter\(/, "listagem não deve criar cópias completas da timeline");

console.log("Teste V652: OK — navegação única, telas sob demanda, carteira paginada e histórico completo preservado.");
