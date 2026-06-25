import fs from "node:fs";
import path from "node:path";

const required = [
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "public/db.js",
  "public/whatsapp.js",
  "public/manifest.webmanifest",
  "public/service-worker.js",
  "public/share-target.html",
  "public/vendor/jszip.min.js",
  "public/assets/logo-mark.png",
  "public/icons/icon-192.png",
  "public/icons/icon-512.png",
  "public/icons/apple-touch-icon.png"
];

const missing = required.filter(file => !fs.existsSync(path.resolve(file)));
if (missing.length) {
  console.error("Arquivos obrigatórios ausentes:\n" + missing.join("\n"));
  process.exit(1);
}

const version = {
  version: "0.1.1",
  builtAt: new Date().toISOString()
};
fs.writeFileSync(path.resolve("public/version.json"), JSON.stringify(version, null, 2));
console.log(`Corretor Pro ${version.version} validado para publicação.`);
