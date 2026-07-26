// Servidor estático simples só pra rodar essas páginas localmente durante o
// desenvolvimento/teste. As páginas falam DIRETO com o Supabase (signup, login, RPC) —
// este servidor só entrega os arquivos HTML/CSS/JS, não tem nenhuma lógica própria.
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const paginasDir = path.join(__dirname, "paginas");
const PORT = process.env.PORT || 4301;

const mimeTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".png": "image/png" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rel = url.pathname === "/" ? "/login.html" : url.pathname;
  const safeRel = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(paginasDir, safeRel);
  if (!filePath.startsWith(paginasDir)) { res.writeHead(400); return res.end("Caminho inválido."); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Não encontrado."); }
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`contas-reais rodando em http://localhost:${PORT}`));
