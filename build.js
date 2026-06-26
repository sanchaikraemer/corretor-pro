import fs from "node:fs";
import path from "node:path";

const staticFiles = [
  "index.html",
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
  JSON.stringify({ version: "0.1.4", builtAt: new Date().toISOString() }, null, 2)
);

console.log("Corretor Pro 0.1.4: pasta public criada com todos os arquivos do app.");
