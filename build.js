import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

// Build sempre limpo: impede que protótipos e arquivos de versões antigas continuem publicados.
fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });

const sha = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "").slice(0, 7);
const buildId = sha
  ? `${new Date().toISOString().slice(0, 10)} · ${sha}`
  : new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);

let version = "000";
try {
  const rp = fs.readFileSync(path.join(__dirname, "RESTORE_POINTS.md"), "utf8");
  const nums = [...rp.matchAll(/^##\s*Ponto\s*#(\d{3})/gm)].map(m => parseInt(m[1], 10));
  if (nums.length) version = String(Math.max(...nums)).padStart(3, "0");
} catch (_) {}

const files = [
  "index.html", "share.html", "styles.css", "app.js", "manifest.json",
  "service-worker.js", "favicon.png", "icon-192.png", "icon-512.png", "logo-direciona-light.svg", "logo-direciona-dark.svg"
];
const textFiles = new Set(["index.html", "share.html", "styles.css", "manifest.json", "service-worker.js"]);

for (const file of files) {
  const src = path.join(__dirname, file);
  if (!fs.existsSync(src)) throw new Error(`Arquivo obrigatório ausente no build: ${file}`);
  const dest = path.join(publicDir, file);
  if (textFiles.has(file)) {
    const content = fs.readFileSync(src, "utf8")
      .replace(/__BUILD_ID__/g, buildId)
      .replace(/__VERSION__/g, version);
    fs.writeFileSync(dest, content);
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Dependência do navegador empacotada localmente: sem CDN e sem execução remota.
const vendorDir = path.join(publicDir, "vendor");
fs.mkdirSync(vendorDir, { recursive: true });
const jsZipSrc = path.join(__dirname, "node_modules", "jszip", "dist", "jszip.min.js");
if (!fs.existsSync(jsZipSrc)) throw new Error("JSZip não instalado. Execute npm install antes do build.");
fs.copyFileSync(jsZipSrc, path.join(vendorDir, "jszip.min.js"));

const expected = [...files, "vendor/jszip.min.js"].sort();
const actual = [];
function walk(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
    else actual.push(rel);
  }
}
walk(publicDir);
actual.sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Build contém arquivos inesperados. Esperado=${expected.join(",")} Atual=${actual.join(",")}`);
}
console.log(`Build limpo concluído (versão=${version}, id=${buildId}): ${actual.length} arquivos publicados.`);
