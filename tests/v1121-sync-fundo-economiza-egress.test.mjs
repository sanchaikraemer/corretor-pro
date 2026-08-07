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
//
// v1166 — a verificação passou a olhar o CONTEÚDO do tique em vez de exigir duas linhas coladas
// uma na outra: agora existe, antes da busca pesada, a pergunta barata "mudou alguma coisa?"
// (cpCarteiraMudouDesdeAUltimaCarga), que é mais economia de tráfego, não menos. Exigir o formato
// exato do código travava justamente a evolução que este teste existe pra defender.
const fimDoTique = app.indexOf("}, CP_SYNC_FUNDO_MS);");
assert.ok(fimDoTique > 0, "o sincronizador de fundo precisa usar CP_SYNC_FUNDO_MS");
const corpoDoTique = app.slice(Math.max(0, fimDoTique - 1500), fimDoTique);
assert.match(corpoDoTique, /invalidarLeadsCache\(\)/, "o tique de fundo precisa invalidar o cache antes de recarregar");
assert.match(corpoDoTique, /loadRecentLeads\(true\)/, "o tique de fundo precisa recarregar a carteira");
assert.doesNotMatch(app, /loadRecentLeads\(true\);\s*\n\s*carregarDashboard\(true\);\s*\n\s*carregarAgendaTopo\(\);\s*\n\s*\}\s*\n\s*\}, 30 \* 1000\);/,
  "o sync de fundo não pode mais rodar a cada 30s");

console.log("v1121-sync-fundo-economiza-egress: ok");
