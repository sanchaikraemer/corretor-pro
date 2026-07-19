// v876 — Identidade Visual v2.0 (Etapa 3: refino de telas a partir dos prints)
// Correções estruturais que os prints do corretor revelaram, sem tocar em lógica:
//  - Home: KPI "Fazer agora"/"Agora" só fica coral (active) quando o valor é > 0
//    (doc seção 23: "não deixar 'Fazer agora' em coral forte quando o valor for zero").
//  - Tela do lead: alerta "Análise comercial antiga" compacto (título menor, barra
//    âmbar lateral) para não competir com o nome do cliente (seções 17 e 24).

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(raiz, "app.js"), "utf8");

// 1. KPI "Fazer agora" (home) não é mais sempre coral: usa active condicional ao valor.
assert.ok(
  app.includes(`class="ui-kpi${"${fazerAgora>0?' active':''}"}" onclick="cp786AbrirConducao('agora')"`),
  "KPI 'Fazer agora' deveria ficar coral (active) só quando fazerAgora>0"
);
assert.ok(
  !/class="ui-kpi active" onclick="cp786AbrirConducao\('agora'\)"/.test(app),
  "KPI 'Fazer agora' ainda está fixo como active (coral mesmo com 0)"
);

// 2. Os KPIs "Agora" também só ficam coral quando há quentes.
assert.ok(
  !/class="ui-kpi active"><span>Agora<\/span>/.test(app),
  "KPI 'Agora' ainda está fixo como active (coral mesmo com 0)"
);
assert.ok(
  app.includes(`class="ui-kpi${"${filtros.quentes.length>0?' active':''}"}"><span>Agora</span>`),
  "KPI 'Agora' deveria usar active condicional a filtros.quentes.length>0"
);

// 3. Alerta "análise antiga" compacto: barra âmbar lateral + título menor.
assert.ok(app.includes(".cp704-stale{border-color:rgba(255,201,107,.28)"), "cp704-stale não foi suavizado");
assert.ok(app.includes("border-left:3px solid var(--morno)"), "cp704-stale não ganhou a barra âmbar lateral");
assert.ok(app.includes(".cp704-stale .cp704-card-title h2{font-size:14px}"), "título do alerta antigo não foi reduzido");

console.log("v876-telas-refino: OK");
