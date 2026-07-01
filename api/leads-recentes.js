import { listRecentProcessings } from "./_persistence.js";

const CACHE_TTL_MS = 30000;
const responseCache = new Map();

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Use GET." });
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
