import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const required = [
  "index.html", "version.js", "styles.css", "app.js", "db.js", "whatsapp.js",
  "service-worker.js", "share-target.html", "manifest.webmanifest",
  "zip.min.js", "logo-mark.png", "icon-192.png", "icon-512.png",
  "apple-touch-icon.png", "server.js", "api/[...path].js", "build.js", "package.json", "vercel.json"
];

test("pacote possui todos os arquivos funcionais na raiz", () => {
  for (const file of required) assert.ok(fs.existsSync(new URL(`./${file}`, import.meta.url)), file);
});

test("Vercel configura a função serverless com 60 segundos", () => {
  const config = JSON.parse(fs.readFileSync(new URL("./vercel.json", import.meta.url), "utf8"));
  assert.equal(config.$schema, "https://openapi.vercel.sh/vercel.json");
  assert.equal(config.functions["api/[...path].js"].maxDuration, 60);
  assert.ok(config.rewrites.some(route => route.source === "/share-target"));
});

test("projeto não depende de pacotes externos", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));
  const deps = Object.keys(pkg.dependencies || {});
  assert.deepEqual(deps, [], "não deve haver dependencies para evitar npm install pesado");
});
