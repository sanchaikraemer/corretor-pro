import fs from "fs";
import assert from "assert";

const duplicados = ["_persistence.js", "_pipeline.js", "lead-update.js", "processar-storage.js", "reanalisar-lead.js"];
for (const file of duplicados) assert.equal(fs.existsSync(file), false, `${file} não pode existir na raiz`);
for (const file of ["api/_pipeline.js", "api/lead-update.js", "api/reanalisar-lead.js"]) assert.equal(fs.existsSync(file), true, `${file} ausente`);
const leadUpdate = fs.readFileSync("api/lead-update.js", "utf8");
assert.match(leadUpdate, /analise-comercial-set/);
const reanalisar = fs.readFileSync("api/reanalisar-lead.js", "utf8");
assert.match(reanalisar, /apiVersion:\s*676/);
const app = fs.readFileSync("app.js", "utf8");
assert.match(app, /Backend desatualizado/);
console.log("estrutura v676: OK");
