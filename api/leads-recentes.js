import { requireApiKey, getSupabaseAdmin, listRecentProcessings } from "./_persistence.js";

const CACHE_TTL_MS = 5000; // no máximo 5 s; sincronização entre celular e PC tem prioridade
const responseCache = new Map();


async function readTable(supabase, table, orderColumn = "criado_em") {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; from < 20000; from += pageSize) {
    let query = supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (orderColumn) query = query.order(orderColumn, { ascending: false });
    let { data, error } = await query;
    if (error && orderColumn !== "created_at") {
      ({ data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false }).range(from, from + pageSize - 1));
    }
    if (error) return { ok: false, table, error: error.message, rows };
    if (!Array.isArray(data) || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return { ok: true, table, rows };
}

function normalizarNomeAuditoria(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function telefoneAuditoria(row = {}) {
  const ra = row.resultado_analise || {};
  const phone = ra?.lead?.phone || row.telefone || row.phone || "";
  return String(phone || "").replace(/\D/g, "");
}

function nomeAuditoria(row = {}) {
  const ra = row.resultado_analise || {};
  return String(ra?.clientName || ra?.lead?.clientName || row.nome_cliente || row.nome || row.nome_arquivo || row.arquivo_nome || "").trim();
}

export function gerarAuditoriaDados(rows = []) {
  const total = rows.length;
  const ids = new Map();
  const telefones = new Map();
  const nomes = new Map();
  const status = {};
  const problemas = [];
  let semAnalise = 0;
  let semHistorico = 0;
  let semNome = 0;
  let semData = 0;
  let audiosPendentes = 0;
  let mensagensTotais = 0;

  for (const row of rows) {
    const id = String(row.id || "");
    if (id) ids.set(id, (ids.get(id) || 0) + 1);
    const ra = row.resultado_analise || {};
    const timeline = Array.isArray(row.timeline_json) ? row.timeline_json : [];
    mensagensTotais += timeline.length;
    const st = String(row.status || "sem_status");
    status[st] = (status[st] || 0) + 1;

    const nome = nomeAuditoria(row);
    const nomeKey = normalizarNomeAuditoria(nome);
    const tel = telefoneAuditoria(row);
    if (tel.length >= 8) {
      const k = tel.slice(-10);
      if (!telefones.has(k)) telefones.set(k, []);
      telefones.get(k).push({ id, nome, arquivo: row.nome_arquivo || row.arquivo_nome || "" });
    }
    if (nomeKey && !/^cliente importad[oa]?$/.test(nomeKey) && nomeKey.length >= 3) {
      if (!nomes.has(nomeKey)) nomes.set(nomeKey, []);
      nomes.get(nomeKey).push({ id, nome, arquivo: row.nome_arquivo || row.arquivo_nome || "" });
    }

    const analisado = ra && typeof ra === "object" && (ra.summary || ra.nextAction || ra.messages || ra.diagnostico || ra.leituraComercial);
    if (!analisado) semAnalise++;
    if (!timeline.length) semHistorico++;
    if (!nome || /^cliente importad[oa]?$/i.test(nome)) semNome++;
    if (!(row.criado_em || row.created_at || row.atualizado_em || row.updated_at)) semData++;
    const audiosEncontrados = Number(row.audios_encontrados || 0);
    const audiosTranscritos = Number(row.audios_transcritos || 0);
    if (audiosEncontrados > audiosTranscritos) audiosPendentes++;
  }

  const duplicadosPorId = [...ids.entries()].filter(([, qtd]) => qtd > 1).map(([id, qtd]) => ({ id, qtd }));
  // Conta ANTES de cortar a lista de exemplos em 50 — senão, com mais de 50 grupos duplicados,
  // o resumo (e a mensagem em "problemas") subestima o problema real (ex.: 120 grupos vira "50
  // possíveis duplicidades", escondendo os outros 70).
  const gruposDuplicadosTelefone = [...telefones.entries()].filter(([, arr]) => arr.length > 1);
  const gruposDuplicadosNome = [...nomes.entries()].filter(([, arr]) => arr.length > 1);
  const duplicadosTelefone = gruposDuplicadosTelefone.slice(0, 50).map(([telefoneFinal, registros]) => ({ telefoneFinal, qtd: registros.length, registros }));
  const duplicadosNome = gruposDuplicadosNome.slice(0, 50).map(([nomeNormalizado, registros]) => ({ nomeNormalizado, qtd: registros.length, registros }));

  if (semHistorico) problemas.push(`${semHistorico} lead(s) sem histórico/timeline.`);
  if (semAnalise) problemas.push(`${semAnalise} lead(s) sem análise comercial salva.`);
  if (semNome) problemas.push(`${semNome} lead(s) sem nome claro.`);
  if (semData) problemas.push(`${semData} registro(s) sem data.`);
  if (audiosPendentes) problemas.push(`${audiosPendentes} lead(s) com áudio encontrado maior que áudio transcrito.`);
  if (gruposDuplicadosTelefone.length) problemas.push(`${gruposDuplicadosTelefone.length} possível(is) duplicidade(s) por telefone.`);
  if (gruposDuplicadosNome.length) problemas.push(`${gruposDuplicadosNome.length} possível(is) duplicidade(s) por nome.`);

  return {
    ok: true,
    version: "682",
    checkedAt: new Date().toISOString(),
    resumo: {
      totalLeads: total,
      mensagensTotais,
      semHistorico,
      semAnalise,
      semNome,
      semData,
      audiosPendentes,
      possiveisDuplicadosTelefone: gruposDuplicadosTelefone.length,
      possiveisDuplicadosNome: gruposDuplicadosNome.length,
      idsDuplicados: duplicadosPorId.length
    },
    status,
    problemas,
    duplicados: {
      porId: duplicadosPorId,
      porTelefone: duplicadosTelefone,
      porNome: duplicadosNome
    }
  };
}

async function auditarDados(req, res) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });
  const main = await readTable(supabase, "whatsapp_processamentos", "criado_em");
  if (!main.ok) return json(res, 500, { ok: false, error: main.error, table: main.table });
  return json(res, 200, gerarAuditoriaDados(main.rows));
}

async function exportarTudo(req, res) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });
  const generatedAt = new Date().toISOString();
  const main = await readTable(supabase, "whatsapp_processamentos", "criado_em");
  if (!main.ok) return json(res, 500, { ok: false, error: main.error, table: main.table });
  const extras = {};
  // direciona_config guarda o Cérebro (persona/regras/conhecimento configurado pelo corretor —
  // ver CLAUDE.md). Sem essa tabela, um "backup completo" recupera os leads mas perde toda a
  // configuração que a IA depende pra responder certo — o nome "full backup" não cumpria a
  // promessa.
  for (const table of ["direciona_leads", "leads", "corretor_pro_backups", "direciona_config"]) {
    const result = await readTable(supabase, table, "criado_em");
    if (result.ok && result.rows.length) extras[table] = result.rows;
  }
  const payload = {
    ok: true,
    version: "682",
    type: "corretor-pro-full-backup",
    generatedAt,
    source: "api/leads-recentes?export=full",
    totals: {
      whatsapp_processamentos: main.rows.length,
      ...Object.fromEntries(Object.entries(extras).map(([k, v]) => [k, v.length]))
    },
    integrity: gerarAuditoriaDados(main.rows),
    data: { whatsapp_processamentos: main.rows, ...extras }
  };
  res.status(200);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `attachment; filename="corretor-pro-backup-completo-${generatedAt.slice(0,10)}.json"`);
  res.end(JSON.stringify(payload, null, 2));
}

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (requireApiKey(req, res) !== true) return;
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Use GET." });
  if (String(req.query?.audit || "") === "1") return auditarDados(req, res);
  if (String(req.query?.export || "") === "full") return exportarTudo(req, res);
  const limit = Math.min(2000, Math.max(1, Number(req.query?.limit || 8)));
  const fresh = String(req.query?.fresh || "") === "1";
  const cached = responseCache.get(limit);
  if (!fresh && cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    return json(res, 200, cached.result);
  }
  const result = await listRecentProcessings(limit, { previewLimit: 8 });
  if (result.ok) responseCache.set(limit, { ts: Date.now(), result });
  return json(res, result.ok ? 200 : 500, result);
}
