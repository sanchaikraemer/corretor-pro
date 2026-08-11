// v877 — Identidade Visual v2.0: hierarquia de botões (a partir dos prints do #876)
// Doc seções 12, 24 e 30: uma ação principal por bloco, perigo nunca parece ação
// comum, cores de estado com significado.
//  - Cérebro: "Zerar Cérebro + Aprendizado" (.btn.danger) deixa de ser coral sólido
//    e vira perigo (contorno vermelho), sem competir com "Salvar".
//  - Tela do lead: "Marcar atendimento" vira ação principal (coral), verde só quando
//    já atendido; "Reanalisar" deixa de ter destaque ciano; "Agendar retorno" deixa
//    de usar âmbar inline.

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => readFileSync(join(raiz, f), "utf8");
const styles = ler("styles.css");
const app = ler("app.js");
const index = ler("index.html");

// 1. Botão perigo do Cérebro continua sendo .btn.danger no HTML.
assert.ok(/class="btn danger" id="cerebroZerar"/.test(index), "Botão Zerar deveria manter class='btn danger'");

// 2. A camada cp agora define .btn.danger como perigo (não herda o coral do .btn).
assert.ok(
  /\.btn\.danger\{background:transparent!important;color:var\(--risco\)!important/.test(styles),
  "Camada cp precisa estilizar .btn.danger como perigo (contorno vermelho), senão herda o coral do .btn"
);

// 3. "Marcar atendimento" = ação principal coral; verde só quando atendido (:disabled).
assert.ok(
  /\.cp704-attended\{border:1px solid var\(--accent\);background:var\(--accent\);color:#fff/.test(app),
  "cp704-attended deveria ser coral (ação principal)"
);
// v1214 — o "concluído" deixou de ser verde-lima cravado e passou a usar o token de confirmação
// (--acao, hoje o ciano da identidade). A regra que este item guarda é a HIERARQUIA — ação
// principal coral, concluído em outra cor, sem cor solta fora da paleta —, não o verde em si.
assert.ok(
  /\.cp704-attended:disabled\{opacity:1;background:var\(--acao-soft\);border-color:var\(--acao-line\);color:var\(--acao\)/.test(app),
  "cp704-attended:disabled deveria usar o token de confirmação (--acao), não uma cor cravada"
);

// 4. "Reanalisar" perde o destaque ciano (fica neutro).
assert.ok(!/cp704-reanalyse-destaque\{background:linear-gradient\([^}]*86,199,242/.test(app), "Reanalisar ainda tem destaque ciano");
assert.ok(/\.cp704-reanalyse-destaque\{background:var\(--surface-soft\)!important/.test(app), "Reanalisar destaque deveria ser neutro");

// 5. "Agendar retorno" não usa mais âmbar inline.
assert.ok(
  !/class="cp704-reanalyse" style="color:#ffd28a;border-color:rgba\(255,201,107,\.4\)"/.test(app),
  "Agendar retorno ainda tem âmbar inline (deveria ser neutro)"
);

console.log("v877-hierarquia-botoes: OK");
