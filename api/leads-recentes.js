import { requireApiKey, getSupabaseAdmin, listRecentProcessings } from "./_persistence.js";

const CACHE_TTL_MS = 30000;
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

async function exportarTudo(req, res) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });
  const generatedAt = new Date().toISOString();
  const main = await readTable(supabase, "whatsapp_processamentos", "criado_em");
  if (!main.ok) return json(res, 500, { ok: false, error: main.error, table: main.table });
  const extras = {};
  for (const table of ["direciona_leads", "leads", "corretor_pro_backups"]) {
    const result = await readTable(supabase, table, "criado_em");
    if (result.ok && result.rows.length) extras[table] = result.rows;
  }
  const payload = {
    ok: true,
    version: "679",
    type: "corretor-pro-full-backup",
    generatedAt,
    source: "api/leads-recentes?export=full",
    totals: {
      whatsapp_processamentos: main.rows.length,
      ...Object.fromEntries(Object.entries(extras).map(([k, v]) => [k, v.length]))
    },
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
