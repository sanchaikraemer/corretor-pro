// v1117 — o cadastro passa a exigir nome, WhatsApp, cidade, estado, e-mail e senha; esses dados
// de contato têm que chegar ao banco (via criar_empresa_e_dono) e aparecer no painel administrativo,
// pra o dono conseguir FALAR com quem se cadastrou. Este teste é estático (lê o texto-fonte das
// telas e da migração) — protege contra alguém remover um campo ou desligar a gravação sem querer.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ler = (f) => readFileSync(path.join(raiz, f), "utf8");

const cadastro = ler("cadastro.html");
const entrar = ler("entrar.html");
const admin = ler("admin-plataforma.html");
const migracao = ler("supabase/migrations/0011_cadastro_contato_corretor.sql");

// --- cadastro.html: os campos existem e são obrigatórios ---------------------------
for (const id of ["telefone", "cidade", "estado"]) {
  assert.match(cadastro, new RegExp(`id=["']${id}["']`), `cadastro.html precisa do campo ${id}`);
  assert.match(cadastro, new RegExp(`getElementById\\(['"]${id}['"]\\)`), `cadastro.html precisa LER o campo ${id}`);
}
// estado é uma lista de UFs (pelo menos SP, RS e RJ presentes)
for (const uf of ["SP", "RS", "RJ"]) {
  assert.match(cadastro, new RegExp(`<option>${uf}</option>`), `cadastro.html precisa da UF ${uf} na lista`);
}
// validação: sem qualquer campo, não deixa criar
assert.match(cadastro, /!nomeEmpresa \|\| !telefone \|\| !cidade \|\| !estado \|\| !email \|\| !senha/,
  "cadastro.html precisa exigir TODOS os campos de contato");
// telefone precisa ter pelo menos 10 dígitos (DDD + número)
assert.match(cadastro, /replace\(\/\\D\/g, ''\)\)\.length < 10/, "cadastro.html precisa validar o WhatsApp (10+ dígitos)");
// os dados vão nos metadados do login (sobrevivem à confirmação de e-mail)
assert.match(cadastro, /data:\s*\{\s*nome_empresa:[^}]*telefone[^}]*cidade[^}]*estado/s,
  "cadastro.html precisa guardar telefone/cidade/estado nos metadados (options.data)");
// e vão pro banco pelo SERVIDOR. v1185 — as chamadas diretas ao banco (`rpc('criar_empresa_e_dono')`,
// com e sem contato) foram retiradas das duas telas: elas eram a reserva que anulava a trava contra
// cadastro falso em massa. Os campos de contato continuam viajando, agora no corpo da requisição.
assert.match(cadastro, /criarEmpresaComContato/, "cadastro.html precisa chamar criarEmpresaComContato");
assert.match(cadastro, /criarEmpresaComContato\(\{\s*nome:[^}]*telefone[^}]*cidade[^}]*estado[^}]*email/s,
  "cadastro.html precisa mandar nome/telefone/cidade/estado/e-mail pro servidor");
assert.match(cadastro, /\/api\/criar-conta/, "cadastro.html cria a empresa pelo servidor");

// --- entrar.html: o primeiro login (com confirmação de e-mail) também grava o contato ---
assert.match(entrar, /telefone:\s*String\(meta\.telefone/, "entrar.html precisa passar telefone no primeiro login");
assert.match(entrar, /cidade:\s*String\(meta\.cidade/, "entrar.html precisa passar cidade no primeiro login");
assert.match(entrar, /estado:\s*String\(meta\.estado/, "entrar.html precisa passar estado no primeiro login");
assert.match(entrar, /\/api\/criar-conta/, "entrar.html cria a empresa pelo servidor");

// --- admin-plataforma.html: contato aparece na lista, com link de WhatsApp ---
assert.match(admin, /<th>Contato<\/th>/, "painel precisa da coluna Contato");
assert.match(admin, /<th>Cidade\/UF<\/th>/, "painel precisa da coluna Cidade/UF");
assert.match(admin, /function linkWhatsApp/, "painel precisa montar o link de WhatsApp");
assert.match(admin, /https:\/\/wa\.me\//, "painel precisa gerar link wa.me");
assert.match(admin, /startsWith\('55'\)\s*\?\s*digitos\s*:\s*'55'\s*\+\s*digitos/,
  "painel precisa acrescentar o código do Brasil (55) quando faltar");
assert.match(admin, /celulaContato\(e\)/, "painel precisa renderizar a célula de contato");
assert.match(admin, /mailto:/, "painel precisa do link de e-mail");
// tolerância a contas antigas (sem os campos): cai num "—", não quebra
assert.match(admin, /return linhas\.length \? linhas\.join\('<br>'\) : '—'/, "contato vazio precisa virar —");

// --- migração 0011: colunas, função e visão ---
for (const col of ["telefone", "cidade", "estado", "email_contato"]) {
  assert.match(migracao, new RegExp(`add column if not exists ${col}`), `migração precisa da coluna ${col}`);
}
assert.match(migracao, /drop function if exists criar_empresa_e_dono\(text\)/, "migração precisa derrubar a função antiga");
assert.match(migracao, /p_telefone text default null/, "função precisa aceitar p_telefone opcional");
assert.match(migracao, /p_email text default null/, "função precisa aceitar p_email opcional");
assert.match(migracao, /insert into organizations \(nome, telefone, cidade, estado, email_contato/,
  "função precisa gravar os campos de contato");
assert.match(migracao, /set search_path = public/, "função SECURITY DEFINER precisa de search_path fixo");
assert.match(migracao, /create or replace view admin_visao_empresas[\s\S]*o\.telefone[\s\S]*o\.email_contato/,
  "a visão do painel precisa devolver os campos de contato");

console.log("v1117-cadastro-contato-corretor: ok");
