// v880 — Identidade Visual v2.0: foco de teclado visível (Auditoria, seção 35)
// O doc proíbe remover outline sem substituição e exige foco visível para teclado.
// Havia 8 `outline:none` e quase nenhum :focus-visible. Este teste garante o anel
// coral global no :focus-visible dos elementos interativos.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const styles = readFileSync(join(raiz, "styles.css"), "utf8");
assert.ok(/button:focus-visible,a:focus-visible,input:focus-visible/.test(styles), "Falta a regra global de :focus-visible para teclado");
assert.ok(/:focus-visible\{[\s\S]*?outline:2px solid var\(--accent\)!important/.test(styles), "O foco de teclado deveria ser um anel coral (--accent)");
console.log("v880-foco-teclado: OK");
