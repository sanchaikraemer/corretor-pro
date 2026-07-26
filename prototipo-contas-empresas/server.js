import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "paginas");
const PORT = process.env.PORT || 4300;

// Tudo em memória, dados de mentira — reinicia zerado a cada vez que o servidor sobe.
const empresas = new Map([
  ["emp-1", { nome: "Imobiliária Sanchai (exemplo)" }],
  ["emp-2", { nome: "Imobiliária Concorrente (exemplo)" }]
]);

const usuarios = new Map([
  ["sanchai@teste.com", { senha: "123456", nome: "Sanchai", empresaId: "emp-1" }],
  ["ana@teste.com", { senha: "123456", nome: "Ana", empresaId: "emp-2" }]
]);

const leads = [
  { id: "l1", empresaId: "emp-1", nome: "João Comprador", produto: "Apto 2 quartos", etapa: "Negociando" },
  { id: "l2", empresaId: "emp-1", nome: "Maria Investidora", produto: "Sala comercial", etapa: "Visita" },
  { id: "l3", empresaId: "emp-1", nome: "Carlos Silva", produto: "Terreno", etapa: "Conhecendo" },
  { id: "l4", empresaId: "emp-2", nome: "Fernanda Souza", produto: "Cobertura", etapa: "Decidindo" },
  { id: "l5", empresaId: "emp-2", nome: "Roberto Alves", produto: "Apto 3 quartos", etapa: "Avaliando" }
];

const sessoes = new Map(); // token -> { email, empresaId, nome }

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; if (data.length > 1e6) req.destroy(); });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (_) { reject(new Error("JSON inválido")); }
    });
    req.on("error", reject);
  });
}

function sessaoDoPedido(req) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token ? sessoes.get(token) : null;
}

function carteiraDaEmpresa(empresaId) {
  return leads.filter((l) => l.empresaId === empresaId);
}

async function handleApi(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/login") {
    const { email, senha } = await lerCorpo(req);
    const usuario = usuarios.get(String(email || "").trim().toLowerCase());
    if (!usuario || usuario.senha !== senha) {
      return json(res, 401, { ok: false, error: "E-mail ou senha incorretos." });
    }
    const token = randomUUID();
    sessoes.set(token, { email, empresaId: usuario.empresaId, nome: usuario.nome });
    const empresa = empresas.get(usuario.empresaId);
    return json(res, 200, { ok: true, token, nome: usuario.nome, empresaId: usuario.empresaId, empresaNome: empresa?.nome || "" });
  }

  if (req.method === "POST" && url.pathname === "/api/cadastro") {
    const { nomeEmpresa, email, senha } = await lerCorpo(req);
    const emailNorm = String(email || "").trim().toLowerCase();
    if (!nomeEmpresa || !emailNorm || !senha) {
      return json(res, 400, { ok: false, error: "Preencha nome da empresa, e-mail e senha." });
    }
    if (usuarios.has(emailNorm)) {
      return json(res, 409, { ok: false, error: "Já existe uma conta com esse e-mail." });
    }
    const empresaId = "emp-" + randomUUID().slice(0, 8);
    empresas.set(empresaId, { nome: nomeEmpresa });
    usuarios.set(emailNorm, { senha, nome: emailNorm.split("@")[0], empresaId });
    const token = randomUUID();
    sessoes.set(token, { email: emailNorm, empresaId, nome: emailNorm.split("@")[0] });
    return json(res, 200, { ok: true, token, nome: emailNorm.split("@")[0], empresaId, empresaNome: nomeEmpresa });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const auth = req.headers["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    sessoes.delete(token);
    return json(res, 200, { ok: true });
  }

  // Tudo daqui pra baixo exige sessão válida — igual toda rota real do Corretor Pro exige a chave hoje.
  const sessao = sessaoDoPedido(req);
  if (!sessao) return json(res, 401, { ok: false, error: "Não autenticado. Faça login primeiro." });

  if (req.method === "GET" && url.pathname === "/api/minha-carteira") {
    return json(res, 200, { ok: true, empresaId: sessao.empresaId, leads: carteiraDaEmpresa(sessao.empresaId) });
  }

  // Simula uma tentativa deliberada de ler dados de outra empresa usando a mesma conta logada —
  // a cerca precisa recusar mesmo que alguém tente adivinhar/forçar o ID de outra empresa.
  if (req.method === "GET" && url.pathname === "/api/tentar-acessar") {
    const empresaAlvo = url.searchParams.get("empresaId") || "";
    if (empresaAlvo !== sessao.empresaId) {
      return json(res, 403, { ok: false, error: `Bloqueado: sua conta pertence a "${sessao.empresaId}", não a "${empresaAlvo}".` });
    }
    return json(res, 200, { ok: true, empresaId: empresaAlvo, leads: carteiraDaEmpresa(empresaAlvo) });
  }

  return json(res, 404, { ok: false, error: "Rota não encontrada." });
}

const mimeTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8" };

function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "/login.html" : pathname;
  const safeRel = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safeRel);
  if (!filePath.startsWith(publicDir)) return json(res, 400, { ok: false, error: "Caminho inválido." });
  fs.readFile(filePath, (err, data) => {
    if (err) return json(res, 404, { ok: false, error: "Arquivo não encontrado." });
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((err) => json(res, 500, { ok: false, error: err.message }));
  } else {
    serveStatic(req, res, url.pathname);
  }
});

server.listen(PORT, () => {
  console.log(`Protótipo de contas/empresas rodando em http://localhost:${PORT}`);
});
