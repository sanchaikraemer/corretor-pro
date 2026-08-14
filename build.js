import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

// Proteção estrutural: estes arquivos pertencem exclusivamente à pasta /api.
// Se forem enviados para a raiz, o front pode ser atualizado enquanto a função
// serverless real continua antiga, causando erros difíceis de diagnosticar.
// Lista lida do próprio diretório /api (não hardcoded) pra nunca ficar desatualizada
// conforme rotas novas são adicionadas — uma lista fixa já ficou pra trás do /api real
// mais de uma vez nesta revisão.
const apiDir = path.join(__dirname, "api");
const apiFiles = fs.existsSync(apiDir)
  ? fs.readdirSync(apiDir).filter((file) => file.endsWith(".js"))
  : [];
const apiDuplicadosNaRaiz = apiFiles.filter((file) => fs.existsSync(path.join(__dirname, file)));
if (apiDuplicadosNaRaiz.length) {
  throw new Error(
    "Arquivos de API duplicados na raiz. Exclua: " +
    apiDuplicadosNaRaiz.join(", ") +
    ". As versões válidas devem existir somente dentro de /api."
  );
}

// Build sempre limpo: impede que protótipos e arquivos de versões antigas continuem publicados.
fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });

const sha = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "").slice(0, 7);
const buildId = sha
  ? `${new Date().toISOString().slice(0, 10)} · ${sha}`
  : new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);

let version = "679";
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
  if (pkg.displayVersion) {
    version = String(pkg.displayVersion);
  } else {
    const parts = String(pkg.version || "679.0.0").split(".");
    const major = parts[0];
    const step = Number(parts[1] || 0);
    if (/^\d+$/.test(major)) version = step > 0 ? `${major.padStart(3, "0")}-${step}` : major.padStart(3, "0");
  }
} catch (_) {}

const files = [
  "index.html", "share.html", "styles.css", "app.js", "manifest.json",
  "service-worker.js", "favicon.png", "icon-192.png", "icon-512.png", "logo-cp.png",
  "js/state.js", "js/commercial-schema.js", "js/dom.js", "js/proposta.js", "js/pwa-install.js",
  "js/dados-locais.js", "js/importacao.js", "js/envio-retentativa.js", "js/enxugar-zip.js", "js/saudacao.js",
  "cadastro.html", "entrar.html", "admin-plataforma.html", "contas-estilo.css", "contas-config.js",
  "recuperar-senha.html", "redefinir-senha.html", "privacidade.html", "termos.html"
];
const textFiles = new Set([
  "index.html", "share.html", "styles.css", "app.js", "manifest.json", "service-worker.js",
  "js/state.js", "js/commercial-schema.js", "js/dom.js", "js/proposta.js", "js/pwa-install.js",
  "js/dados-locais.js", "js/importacao.js", "js/envio-retentativa.js", "js/enxugar-zip.js", "js/saudacao.js",
  "cadastro.html", "entrar.html", "admin-plataforma.html", "contas-estilo.css", "contas-config.js",
  "recuperar-senha.html", "redefinir-senha.html", "privacidade.html", "termos.html"
]);

// v1073 — o app publicado ia pro celular com TODOS os comentários e espaços do código-fonte
// (app.js sozinho ~800KB). O esbuild remove só comentários/espaços na publicação — SEM renomear
// nada e SEM reescrever lógica (minifyWhitespace apenas; nada de mangling, que quebraria os
// onclick="funcao()" do HTML). Se o esbuild não estiver disponível por qualquer motivo, o build
// publica o arquivo como está (nunca falha por causa da compressão).
let esbuildTransform = null;
try {
  const esbuild = await import("esbuild");
  esbuildTransform = esbuild.transformSync;
} catch (_) {
  console.warn("esbuild indisponível — publicando sem compressão de espaços/comentários.");
}
function comprimir(content, file) {
  if (!esbuildTransform) return content;
  const ehJs = file.endsWith(".js");
  const ehCss = file.endsWith(".css");
  if (!ehJs && !ehCss) return content; // HTML/JSON ficam como estão
  try {
    return esbuildTransform(content, {
      loader: ehCss ? "css" : "js",
      minifyWhitespace: true,
      legalComments: "none"
    }).code;
  } catch (e) {
    // Compressão nunca pode derrubar a publicação: em caso de erro, publica sem comprimir.
    console.warn(`Compressão falhou em ${file} (publicando sem comprimir): ${e?.message || e}`);
    return content;
  }
}

for (const file of files) {
  const src = path.join(__dirname, file);
  if (!fs.existsSync(src)) throw new Error(`Arquivo obrigatório ausente no build: ${file}`);
  const dest = path.join(publicDir, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (textFiles.has(file)) {
    const content = fs.readFileSync(src, "utf8")
      .replace(/__BUILD_ID__/g, buildId)
      .replace(/__VERSION__/g, version);
    fs.writeFileSync(dest, comprimir(content, file));
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

// v1196 — A BIBLIOTECA DO SUPABASE VAI ENXUTA PRO NAVEGADOR.
//
// Antes, o build copiava o pacote pronto (UMD, 200 KB) e ele era baixado em TODA abertura do app.
// Só que boa parte dele o navegador nunca usa: o módulo de "tempo real" (websocket, tela que se
// atualiza sozinha), o de Storage (envio de arquivo — quem faz isso aqui é o servidor, em /api) e o
// de Edge Functions (as rotas deste projeto são as da Vercel).
//
// A montagem abaixo NÃO reescreve a biblioteca: usa a original e apenas troca esses três módulos
// não usados por substitutos vazios (pasta `vendor-enxuto/`). Isso é importante — o `createClient`,
// o login e as consultas continuam sendo o código oficial, byte por byte, inclusive a regra que
// decide ONDE a sessão fica guardada no navegador. Se a biblioteca fosse remontada à mão, essa
// chave poderia mudar e TODO MUNDO seria deslogado na atualização.
//
// Conferido na v1196 comparando as duas versões contra um servidor de mentira: as 10 chamadas de
// rede saem idênticas (mesmo método, endereço, cabeçalhos e corpo), os resultados são iguais e a
// sessão é guardada na mesma chave. Ver NOTAS-v1196.md.
const supabaseJsSrc = path.join(__dirname, "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js");
if (!fs.existsSync(supabaseJsSrc)) throw new Error("supabase-js não instalado. Execute npm install antes do build.");
const supabaseDest = path.join(vendorDir, "supabase.js");
let supabaseEnxuto = false;
try {
  const esbuild = await import("esbuild");
  const enxuto = path.join(__dirname, "vendor-enxuto");
  const resultado = await esbuild.build({
    entryPoints: [path.join(enxuto, "supabase-entrada.js")],
    bundle: true, minify: true, format: "iife", globalName: "supabase",
    target: ["es2019"], write: false, logLevel: "silent",
    absWorkingDir: __dirname,
    alias: {
      "@supabase/realtime-js": path.join(enxuto, "sem-tempo-real.js"),
      "@supabase/storage-js": path.join(enxuto, "sem-storage.js"),
      "@supabase/functions-js": path.join(enxuto, "sem-functions.js")
    }
  });
  const codigo = resultado.outputFiles[0].text;
  // Rede de segurança: se por qualquer motivo a montagem sair pequena demais ou sem o
  // createClient, ela não é publicada — cai no pacote original. Login não é lugar de arriscar.
  if (!/createClient/.test(codigo) || codigo.length < 60000) {
    throw new Error(`montagem enxuta suspeita (${codigo.length} bytes) — publicando o pacote original`);
  }
  fs.writeFileSync(supabaseDest, codigo);
  supabaseEnxuto = true;
} catch (e) {
  console.warn(`Supabase enxuto indisponível (${e?.message || e}). Publicando o pacote completo.`);
  fs.copyFileSync(supabaseJsSrc, supabaseDest);
}
console.log(`Supabase publicado: ${supabaseEnxuto ? "enxuto" : "completo"} (${Math.round(fs.statSync(supabaseDest).size / 1024)} KB).`);

const expected = [...files, "vendor/jszip.min.js", "vendor/supabase.js"].sort();
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
