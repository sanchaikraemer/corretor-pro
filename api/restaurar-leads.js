import { requireApiKey, getSupabaseAdmin } from "./_persistence.js";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function str(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stage(value) {
  const s = norm(value);
  if (!s) return "Novo";
  if (s.includes("perdid") || s.includes("descart")) return "Perdido";
  if (s.includes("vendid") || s.includes("fechad")) return "Vendido";
  if (s.includes("negoci")) return "Negociação";
  if (s.includes("visita") || s.includes("proposta")) return "Visita/Proposta";
  // Mesma ordem/critério de normalizarEtapa() em app.js: "geladeira"/"arquivad" é uma etapa
  // própria (arquivado, some da busca ativa — ver foraDaBusca), diferente de "Standby" (pausado,
  // continua contando no pipeline ativo). Checar isso ANTES de "stand" evita que um lead que já
  // estava arquivado na base antiga volte pra fila ativa depois de restaurado.
  if (s.includes("geladeira") || s.includes("arquiv")) return "Geladeira";
  if (s.includes("stand") || s.includes("paus") || s.includes("congelad")) return "Standby";
  if (s.includes("atendimento") || s.includes("qualific")) return "Atendimento";
  if (s.includes("novo") || s.includes("inicial")) return "Novo";
  return String(value || "Novo").trim();
}

function iso(value, fallback = null) {
  if (!value && value !== 0) return fallback;
  // str() (usada em todo call site deste arquivo) sempre entrega string, então "typeof value ===
  // 'number'" nunca era true na prática — a data serial do Excel (ex.: 45383) chegava aqui como
  // a STRING "45383", pulava o bloco de baixo e ia direto pro new Date(value) genérico. new
  // Date("45383") não dá Invalid Date: o parser lê "45383" como ANO 45383 (data lixo, silenciosa,
  // sem cair no fallback). Por isso o número também precisa ser detectado quando vem como string.
  const num = typeof value === "number"
    ? value
    : (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
  if (num !== null && num > 20000 && num < 100000) {
    // Datas seriadas do Excel.
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + num * 86400000).toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function pickObservation(row) {
  return str(
    row.observacao,
    row.observacoes,
    row.historico_atendimento,
    row.historico_de_atendimento,
    row["Historico de Atendimento"],
    row["Histórico de Atendimento"],
    row.notas,
    row.nota,
    row.resumo
  );
}

export function normalizarLeadLegado(row = {}, table = "leads") {
  const id = str(row.id, row.lead_id);
  const realName = str(row.nome, row.name, row.nome_cliente, row.cliente);
  const name = realName || "Cliente restaurado";
  const phone = str(row.telefone, row.phone, row.celular, row.whatsapp);
  const product = str(row.empreendimento, row.empreendimento_interesse, row.produto, row.product, "Outros");
  const etapa = stage(str(row.etapa, row.status));
  const observation = pickObservation(row);
  const createdAt = iso(str(row.criado_em, row.created_at, row.data_inicio), new Date().toISOString());
  const updatedAt = iso(str(row.atualizado_em, row.updated_at), createdAt);
  const nextContact = iso(str(row.proximo_contato, row.proxima_acao_em), null);
  const origin = str(row.origem, "Base anterior");
  const reasonLost = str(row.motivo_perda, row.motivoPerda);
  const responsible = str(row.responsavel);

  const timeline = [];
  if (observation) {
    timeline.push({
      id: 1,
      iso: createdAt,
      date: new Date(createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      time: "",
      author: "Histórico restaurado",
      text: observation,
      type: "nota",
      source: "legacy",
      order: 1
    });
  }
  if (nextContact) {
    timeline.push({
      id: timeline.length + 1,
      iso: nextContact,
      date: new Date(nextContact).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      time: new Date(nextContact).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
      author: "Próximo contato",
      text: "Próximo contato restaurado da base anterior.",
      type: "atendimento",
      source: "legacy",
      order: timeline.length + 1
    });
  }



  const analysis = {
    clientName: name,
    lead: { clientName: name, name, phone: phone || null, product },
    produtoInteresse: product,
    produtosInteresse: product ? [product] : [],
    etapaSugerida: etapa,
    summary: observation || "Lead restaurado da base anterior.",
    nextAction: etapa === "Perdido" ? "Reavaliar oportunidade" : (nextContact ? "Realizar o próximo contato agendado" : "Revisar o atendimento e definir o próximo passo"),
    memoria: { observacoes: observation || "" },
    origemCrm: origin,
    responsavel: responsible || null,
    motivoPerda: reasonLost || null,
    lembrete: nextContact ? { quando: nextContact, texto: "Próximo contato restaurado" } : null,
    restauradoDaBaseAnterior: true,
    tabelaOrigem: table
  };

  const shortId = id ? id.slice(0, 8) : norm(`${name}-${phone}`).replace(/\s+/g, "").slice(0, 8);
  // dedupeKey usa realName (não o placeholder "Cliente restaurado"): duas linhas legadas
  // diferentes sem nome e sem telefone não podem cair na mesma chave só por causa do fallback de
  // exibição, senão restaurarLeadsLegados descarta uma delas como se fosse duplicata da outra
  // (ver seenKeys em restaurarLeadsLegados). Sem telefone e sem nome real, dedupeKey fica "" —
  // a linha só é agrupada/filtrada pelo seu próprio id (quando existe).
  const phoneDigits = digits(phone);
  return {
    id,
    dedupeKey: phoneDigits.length >= 8 ? `fone:${phoneDigits.slice(-8)}` : (realName ? `nome:${norm(realName)}` : ""),
    payload: {
      ...(id ? { id } : {}),
      nome_arquivo: `${name} [LEGADO ${shortId || "restaurado"}]`,
      arquivo_nome: `${name} [LEGADO ${shortId || "restaurado"}]`,
      status: "pronto",
      etapa,
      progresso: 100,
      erro: null,
      texto_extraido: observation || null,
      timeline_json: timeline,
      audios_encontrados: 0,
      audios_transcritos: 0,
      resultado_analise: analysis,
      criado_em: createdAt,
      atualizado_em: updatedAt,
      updated_at: updatedAt
    }
  };
}

async function lerTabela(supabase, table) {
  let query = supabase.from(table).select("*").limit(5000);
  const { data, error } = await query;
  if (error) return { table, rows: [], error: error.message };
  return { table, rows: Array.isArray(data) ? data : [], error: null };
}

async function currentKeys(supabase) {
  let query = supabase
    .from("whatsapp_processamentos")
    .select("id,nome_arquivo,arquivo_nome,resultado_analise")
    .limit(5000);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const ids = new Set();
  const keys = new Set();
  for (const row of data || []) {
    if (row.id) ids.add(String(row.id));
    const a = row.resultado_analise || {};
    const phone = digits(a?.lead?.phone || row.telefone);
    const name = str(a.clientName, a?.lead?.clientName, row.nome);
    if (phone.length >= 8) keys.add(`fone:${phone.slice(-8)}`);
    else if (name) keys.add(`nome:${norm(name)}`);
  }
  return { ids, keys, count: (data || []).length };
}

async function adaptiveBatchUpsert(supabase, rows) {
  let current = rows.map(row => ({ ...row }));
  const removed = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    const { error } = await supabase
      .from("whatsapp_processamentos")
      .upsert(current, { onConflict: "id" });
    if (!error) return { ok: true, removed };
    const message = error.message || "";
    const noCol = message.match(/Could not find the '([^']+)' column/i);
    if (noCol) {
      const col = noCol[1];
      removed.push(col);
      current = current.map(({ [col]: _drop, ...rest }) => rest);
      continue;
    }
    throw new Error(message);
  }
  throw new Error("Não foi possível adaptar o lote à estrutura da tabela.");
}

export async function restaurarLeadsLegados(supabase, { force = false } = {}) {
  const current = await currentKeys(supabase);
  const tables = await Promise.all([lerTabela(supabase, "leads"), lerTabela(supabase, "direciona_leads")]);
  const sourceRows = [];
  for (const result of tables) {
    for (const row of result.rows) sourceRows.push({ row, table: result.table });
  }

  const best = new Map();
  for (const entry of sourceRows) {
    const normalized = normalizarLeadLegado(entry.row, entry.table);
    if (!normalized.id && !normalized.dedupeKey) continue;
    const key = normalized.id ? `id:${normalized.id}` : normalized.dedupeKey;
    const old = best.get(key);
    const oldObs = String(old?.payload?.texto_extraido || "").length;
    const newObs = String(normalized.payload.texto_extraido || "").length;
    if (!old || newObs > oldObs) best.set(key, normalized);
  }

  const selected = [];
  const seenKeys = new Set(current.keys);
  for (const normalized of best.values()) {
    if (!force && normalized.id && current.ids.has(String(normalized.id))) continue;
    if (!force && normalized.dedupeKey && seenKeys.has(normalized.dedupeKey)) continue;
    if (normalized.dedupeKey) seenKeys.add(normalized.dedupeKey);
    selected.push(normalized.payload);
  }

  let restored = 0;
  const removedColumns = new Set();
  for (let i = 0; i < selected.length; i += 100) {
    const batch = selected.slice(i, i + 100);
    const result = await adaptiveBatchUpsert(supabase, batch);
    restored += batch.length;
    for (const col of result.removed) removedColumns.add(col);
  }

  return {
    ok: true,
    currentBefore: current.count,
    legacyFound: sourceRows.length,
    uniqueLegacy: best.size,
    restored,
    alreadyPresent: Math.max(0, best.size - selected.length),
    currentAfterEstimate: current.count + restored,
    tables: tables.map(t => ({ table: t.table, rows: t.rows.length, error: t.error })),
    removedColumns: [...removedColumns]
  };
}

export default async function handler(req, res) {
  if (requireApiKey(req, res) !== true) return;
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { ok: false, error: "Use GET ou POST." });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });
  try {
    const force = req.method === "POST" && (req.body?.force === true || String(req.query?.force || "") === "1");
    const result = await restaurarLeadsLegados(supabase, { force });
    return json(res, 200, result);
  } catch (error) {
    return json(res, 500, { ok: false, error: error?.message || String(error) });
  }
}
