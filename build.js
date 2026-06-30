import "./version.js";
import fs from "node:fs";
import path from "node:path";

const VERSION_INFO = globalThis.CORRETOR_PRO_VERSION || { app: "v078", package: "0.78.0" };

const staticFiles = [
  "index.html",
  "version.js",
  "styles.css",
  "app.js",
  "db.js",
  "whatsapp.js",
  "service-worker.js",
  "share-target.html",
  "manifest.webmanifest",
  "zip.min.js",
  "logo-mark.png",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png"
];

const missing = staticFiles.filter(file => !fs.existsSync(path.resolve(file)));
if (missing.length) {
  console.error("Arquivos obrigatórios ausentes:\n" + missing.join("\n"));
  process.exit(1);
}

const output = path.resolve("public");
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of staticFiles) {
  fs.copyFileSync(path.resolve(file), path.join(output, file));
}

fs.writeFileSync(
  path.join(output, "version.json"),
  JSON.stringify({ version: VERSION_INFO.app, packageVersion: VERSION_INFO.package, builtAt: new Date().toISOString() }, null, 2)
);

console.log(`Corretor Pro ${VERSION_INFO.app}: pasta public criada com todos os arquivos do app.`);
