// v1121 — economia de tráfego (egress) do Supabase: o sincronizador de fundo da Home baixava a
// base INTEIRA de clientes (com a conversa de cada um) a cada 30s. Com a Home aberta o dia todo,
// eram ~120 downloads da base por hora — o maior gasto de egress, que estourava o plano grátis do
// Supabase. Subiu para 2min (corta ~75%), mantendo a sincronização celular↔PC. Este teste trava o
// intervalo pra ninguém baixar de volta pra 30s sem querer.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(path.join(raiz, "app.js"), "utf8");

// O intervalo do sync de fundo é uma constante nomeada, de pelo menos 120s.
const m = app.match(/const CP_SYNC_FUNDO_MS = (\d+) \* 1000;/);
assert.ok(m, "o intervalo do sync de fundo precisa ser uma constante nomeada (CP_SYNC_FUNDO_MS)");
assert.ok(Number(m[1]) >= 120, `o sync de fundo precisa ser de pelo menos 120s pra economizar egress (está em ${m[1]}s)`);

// O setInterval do sync de fundo usa a constante, não um número solto de 30s.
assert.match(app, /invalidarLeadsCache\(\);\s*\n\s*loadRecentLeads\(true\);[\s\S]*?\}\s*\n\s*\}, CP_SYNC_FUNDO_MS\);/,
  "o sincronizador de fundo precisa usar CP_SYNC_FUNDO_MS");
assert.doesNotMatch(app, /loadRecentLeads\(true\);\s*\n\s*carregarDashboard\(true\);\s*\n\s*carregarAgendaTopo\(\);\s*\n\s*\}\s*\n\s*\}, 30 \* 1000\);/,
  "o sync de fundo não pode mais rodar a cada 30s");

console.log("v1121-sync-fundo-economiza-egress: ok");
