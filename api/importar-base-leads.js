import { gunzipSync } from "zlib";
import { getSupabaseAdmin } from "./_persistence.js";
import {
  BASE_V661_GZIP_BASE64,
  BASE_V661_TOTAL,
  BASE_V661_EXCLUIDOS_PERDIDOS,
  BASE_V661_MESCLADOS_DUPLICADOS
} from "./_base-leads-v661.js";

let decodedBase = null;

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function text(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function norm(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanName(value) {
  return norm(value)
    .replace(/\b(renaissance|evolutti|evoluti|boulevard|quality|personalite|prime|premium office|nova vila rica|nvr\s*i{0,3}|terrenos?|lotes?|aptos?|apartamentos?|celular|cell|whatsapp|fone|tel)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phone(value) {
  let d = text(value).replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d;
}

function lostStage(value) {
  const s = norm(value);
  return s.includes("perdid") || s.includes("descart");
}

function meaningful(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function loadBase() {
  if (decodedBase) return decodedBase;
  const raw = gunzipSync(Buffer.from(BASE_V661_GZIP_BASE64, "base64")).toString("utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== BASE_V661_TOTAL) {
    throw new Error("A base consolidada está incompleta.");
  }
  decodedBase = parsed;
  return decodedBase;
}

function rowName(row = {}) {
  const a = row.resultado_analise || {};
  return text(a.clientName, a?.lead?.clientName, a?.lead?.name, row.nome, row.nome_arquivo, row.arquivo_nome);
}

function firstText(...values) {
  for (const value of values) if (meaningful(value)) return value;
  return "";
}

function mergeUniqueText(a, b) {
  const aa = text(a);
  const bb = text(b);
  if (!aa) return bb;
  if (!bb) return aa;
  const na = norm(aa);
  const nb = norm(bb);
  if (na === nb || na.includes(nb)) return aa;
  if (nb.includes(na)) return bb;
  return `${aa}\n\n${bb}`;
}

function messageKey(item = {}) {
  const body = norm(item.text || "");
  return `${text(item.iso)}|${norm(item.author)}|${body}`;
}

function mergeTimeline(existing = [], incoming = []) {
  const all = [];
  const seen = new Set();
  for (const item of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    if (!item || !text(item.text)) continue;
    const key = messageKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    all.push({ ...item, _sourceOrder: all.length });
  }
  all.sort((a, b) => {
    const ai = text(a.iso);
    const bi = text(b.iso);
    if (ai && bi && ai !== bi) return ai.localeCompare(bi);
    if (ai && !bi) return -1;
    if (!ai && bi) return 1;
    return a._sourceOrder - b._sourceOrder;
  });
  return all.map((item, index) => {
    const { _sourceOrder, ...clean } = item;
    return { ...clean, id: index + 1, order: index + 1 };
  });
}

function union(valuesA, valuesB) {
  const out = [];
  const seen = new Set();
  for (const value of [...(Array.isArray(valuesA) ? valuesA : []), ...(Array.isArray(valuesB) ? valuesB : [])]) {
    const key = norm(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function longer(a, b) {
  return text(a).length >= text(b).length ? a : b;
}

function mergeAnalysis(existing = {}, incoming = {}) {
  const merged = { ...incoming };
  for (const [key, value] of Object.entries(existing || {})) {
    if (meaningful(value)) merged[key] = value;
  }

  const existingLead = existing?.lead || {};
  const incomingLead = incoming?.lead || {};
  merged.lead = {
    ...incomingLead,
    ...Object.fromEntries(Object.entries(existingLead).filter(([, v]) => meaningful(v)))
  };
  merged.clientName = firstText(existing.clientName, incoming.clientName, merged?.lead?.clientName);
  merged.lead.clientName = firstText(existingLead.clientName, incomingLead.clientName, merged.clientName);
  merged.lead.name = firstText(existingLead.name, incomingLead.name, merged.clientName);
  merged.lead.phone = firstText(existingLead.phone, incomingLead.phone) || null;
  merged.lead.product = firstText(existingLead.product, incomingLead.product) || null;

  merged.produtosInteresse = union(incoming.produtosInteresse, existing.produtosInteresse);
  merged.clientProfile = longer(existing.clientProfile, incoming.clientProfile);
  merged.summary = longer(existing.summary, incoming.summary);
  merged.risk = longer(existing.risk, incoming.risk);
  merged.nextAction = firstText(existing.nextAction, incoming.nextAction);

  const em = existing.memoria || {};
  const im = incoming.memoria || {};
  merged.memoria = {
    ...im,
    ...em,
    preferencias: mergeUniqueText(im.preferencias, em.preferencias),
    observacoes: mergeUniqueText(im.observacoes, em.observacoes),
    pontosSensiveis: mergeUniqueText(im.pontosSensiveis, em.pontosSensiveis),
    pessoasDecisao: mergeUniqueText(im.pessoasDecisao, em.pessoasDecisao)
  };

  // Informações consolidadas enviadas pelo usuário sempre ficam preservadas.
  merged.dadosImportados = incoming.dadosImportados || existing.dadosImportados || {};
  merged.importadoDaBaseV661 = true;

  // Campos operacionais atuais nunca são apagados pela importação.
  for (const key of ["venda", "lembrete", "aprendizado", "avatarFoto", "messages", "evolucao", "scoreAjuste"]) {
    if (meaningful(existing[key])) merged[key] = existing[key];
  }
  return merged;
}

function stageRank(value) {
  const s = norm(value);
  if (s.includes("vendid")) return 8;
  if (s.includes("perdid")) return 7;
  if (s.includes("negoci")) return 6;
  if (s.includes("visita") || s.includes("proposta")) return 5;
  if (s.includes("geladeira")) return 4;
  if (s.includes("stand")) return 3;
  if (s.includes("atendimento")) return 2;
  return 1;
}

function chooseStage(existing, incoming) {
  if (!text(existing)) return incoming || "Novo";
  if (lostStage(existing) || norm(existing).includes("vendid")) return existing;
  return stageRank(incoming) > stageRank(existing) ? incoming : existing;
}

function mergeRow(existing, sourcePayload) {
  const currentAnalysis = existing.resultado_analise || {};
  const sourceAnalysis = sourcePayload.resultado_analise || {};
  const mergedAnalysis = mergeAnalysis(currentAnalysis, sourceAnalysis);
  const mergedTimeline = mergeTimeline(existing.timeline_json, sourcePayload.timeline_json);
  const etapa = chooseStage(existing.etapa, sourcePayload.etapa);
  mergedAnalysis.etapaSugerida = etapa;
  mergedAnalysis.lead = { ...(mergedAnalysis.lead || {}), etapa };

  const created = [existing.criado_em, existing.created_at, sourcePayload.criado_em].filter(Boolean).sort()[0] || sourcePayload.criado_em;
  const updated = [existing.atualizado_em, existing.updated_at, sourcePayload.atualizado_em].filter(Boolean).sort().at(-1) || new Date().toISOString();

  return {
    ...sourcePayload,
    id: existing.id,
    nome_arquivo: firstText(existing.nome_arquivo, existing.arquivo_nome, sourcePayload.nome_arquivo),
    arquivo_nome: firstText(existing.arquivo_nome, existing.nome_arquivo, sourcePayload.arquivo_nome),
    status: firstText(existing.status, sourcePayload.status, "pronto"),
    etapa,
    progresso: existing.progresso ?? sourcePayload.progresso ?? 100,
    texto_extraido: mergeUniqueText(sourcePayload.texto_extraido, existing.texto_extraido) || null,
    timeline_json: mergedTimeline,
    audios_encontrados: Math.max(Number(existing.audios_encontrados) || 0, Number(sourcePayload.audios_encontrados) || 0),
    audios_transcritos: Math.max(Number(existing.audios_transcritos) || 0, Number(sourcePayload.audios_transcritos) || 0),
    resultado_analise: mergedAnalysis,
    criado_em: created,
    atualizado_em: updated,
    updated_at: updated
  };
}

async function readCurrent(supabase) {
  const columns = "id,nome_arquivo,arquivo_nome,status,etapa,progresso,texto_extraido,timeline_json,audios_encontrados,audios_transcritos,resultado_analise,criado_em,created_at,atualizado_em,updated_at";
  let result = await supabase.from("whatsapp_processamentos").select(columns).limit(5000);
  if (result.error) result = await supabase.from("whatsapp_processamentos").select("*").limit(5000);
  if (result.error) throw new Error(result.error.message);
  return Array.isArray(result.data) ? result.data : [];
}

async function adaptiveUpsert(supabase, rows) {
  let current = rows.map(row => ({ ...row }));
  const removedColumns = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    const { error } = await supabase.from("whatsapp_processamentos").upsert(current, { onConflict: "id" });
    if (!error) return { removedColumns };
    const message = error.message || "";
    const missing = message.match(/Could not find the '([^']+)' column/i);
    if (!missing) throw new Error(message);
    const col = missing[1];
    removedColumns.push(col);
    current = current.map(({ [col]: _removed, ...rest }) => rest);
  }
  throw new Error("Não foi possível adaptar a importação à tabela atual.");
}

export async function importarBaseConsolidada(supabase, { force = false } = {}) {
  const source = loadBase();
  const current = await readCurrent(supabase);
  const byId = new Map();
  const byPhone = new Map();
  const byName = new Map();

  for (const row of current) {
    if (row.id) byId.set(String(row.id), row);
    const analysis = row.resultado_analise || {};
    const p = phone(analysis?.lead?.phone || row.telefone);
    const n = cleanName(firstText(analysis.clientName, analysis?.lead?.clientName, row.nome_arquivo, row.arquivo_nome));
    if (p) byPhone.set(p, row);
    if (n) byName.set(n, row);
  }

  const toUpsert = [];
  let inserted = 0;
  let updated = 0;
  let alreadyPresent = 0;
  let skippedExistingLost = 0;
  const scheduledIds = new Set();

  for (const record of source) {
    const payload = record?.payload || {};
    if (!payload.id || lostStage(payload.etapa) || lostStage(payload?.resultado_analise?.etapaSugerida)) continue;

    const sourcePhone = phone(record.phone || payload?.resultado_analise?.lead?.phone);
    const sourceName = cleanName(record.name || payload?.resultado_analise?.clientName);
    let existing = byId.get(String(payload.id));
    if (!existing && sourcePhone) existing = byPhone.get(sourcePhone);
    if (!existing && sourceName) existing = byName.get(sourceName);

    if (existing && lostStage(existing.etapa || existing?.resultado_analise?.etapaSugerida)) {
      skippedExistingLost++;
      continue;
    }

    if (existing) {
      if (!force && existing?.resultado_analise?.importadoDaBaseV661 === true) {
        alreadyPresent++;
        continue;
      }
      if (scheduledIds.has(String(existing.id))) {
        alreadyPresent++;
        continue;
      }
      toUpsert.push(mergeRow(existing, payload));
      scheduledIds.add(String(existing.id));
      updated++;
    } else {
      if (scheduledIds.has(String(payload.id))) {
        alreadyPresent++;
        continue;
      }
      toUpsert.push(payload);
      scheduledIds.add(String(payload.id));
      inserted++;
    }
  }

  const removedColumns = new Set();
  for (let i = 0; i < toUpsert.length; i += 15) {
    const batch = toUpsert.slice(i, i + 15);
    const result = await adaptiveUpsert(supabase, batch);
    for (const col of result.removedColumns) removedColumns.add(col);
  }

  return {
    ok: true,
    sourceTotal: BASE_V661_TOTAL,
    lostExcluded: BASE_V661_EXCLUIDOS_PERDIDOS,
    duplicatesMergedBeforeImport: BASE_V661_MESCLADOS_DUPLICADOS,
    currentBefore: current.length,
    inserted,
    updated,
    alreadyPresent,
    skippedExistingLost,
    processed: inserted + updated,
    currentAfterEstimate: current.length + inserted,
    removedColumns: [...removedColumns]
  };
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { ok: false, error: "Use GET ou POST." });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  try {
    const force = String(req.query?.force || "") === "1" || req.body?.force === true;
    const result = await importarBaseConsolidada(supabase, { force });
    return json(res, 200, result);
  } catch (error) {
    return json(res, 500, { ok: false, error: error?.message || String(error) });
  }
}
