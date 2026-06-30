import { listRecentProcessings } from "./_persistence.js";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Use GET." });
  const limit = Math.min(2000, Math.max(1, Number(req.query?.limit || 8)));
  const result = await listRecentProcessings(limit);
  return json(res, result.ok ? 200 : 500, result);
}
