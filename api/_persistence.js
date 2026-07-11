import { createClient } from "@supabase/supabase-js";
import { randomUUID, timingSafeEqual } from "crypto";
import { filtrarCompromissosReais } from "./_pipeline.js";


function authJson(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function safeEqualSecret(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export function requireApiKey(req, res) {
  if (process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test") return true;
  const expected = process.env.CORRETOR_PRO_API_KEY || process.env.API_SECRET || process.env.CP_API_SECRET || "";
  const allowUnprotected = String(process.env.ALLOW_UNPROTECTED_API || "").toLowerCase() === "true";
  if (!expected) {
    const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    // v725: em produção, rota pública sem chave é risco real. Só libera sem chave se for escolha explícita.
    // Para ambiente local/teste continua flexível; para Vercel produção configure CORRETOR_PRO_API_KEY
    // ou defina ALLOW_UNPROTECTED_API=true conscientemente.
    if (!isProduction || allowUnprotected) {
      try { res.setHeader("X-Corretor-Pro-Security", "api-key-not-configured"); } catch(_) {}
      return true;
    }
    authJson(res, 500, { ok: false, error: "API bloqueada por segurança: configure CORRETOR_PRO_API_KEY nas variáveis de ambiente da Vercel ou defina ALLOW_UNPROTECTED_API=true conscientemente." });
    return false;
  }
  const received = req.headers?.["x-corretor-pro-key"] || req.headers?.["x-api-key"] || req.query?.apiKey || "";
  if (!received || !safeEqualSecret(received, expected)) {
    authJson(res, 401, { ok: false, error: "Acesso bloqueado. Informe a chave de segurança do Corretor Pro." });
    return false;
  }
  return true;
}

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// Dias de CALENDÁRIO entre uma data e agora, no fuso de Brasília (NÃO "períodos de 24h" — senão
// uma mensagem de ontem à noite conta como "hoje" de manhã, porque passaram <24h). 0 = hoje, 1 = ontem.
function diasCalendarioBR(iso) {
  if (!iso) return null;
  const t = new Date(iso);
  if (isNaN(t.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const civil = (d) => { const [y, m, dd] = fmt.format(d).split("-").map(Number); return Date.UTC(y, m - 1, dd); };
  const diff = Math.round((civil(new Date()) - civil(t)) / 86400000);
  return diff < 0 ? 0 : diff;
}

function compact(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}

function defaultFor(col) {
  if (/^id$|_id$/i.test(col)) return randomUUID();
  if (/_em$|_at$|timestamp|date/i.test(col)) return new Date().toISOString();
  if (/etapa|status/i.test(col)) return "Novo";
  if (/progresso|progress|count|total/i.test(col)) return 0;
  return "";
}

async function adaptiveWrite(supabase, table, payload, mode, onConflict = "id") {
  let current = compact(payload);
  const removed = [];
  const filled = [];
  for (let i = 0; i < 24; i++) {
    const builder = supabase.from(table);
    const op = mode === "upsert" ? builder.upsert(current, { onConflict }) : builder.insert(current);
    const { data, error } = await op.select("*").maybeSingle();
    if (!error) return data;
    const msg = error.message || "";
    const noCol = msg.match(/Could not find the '([^']+)' column/i);
    if (noCol && noCol[1] in current) {
      removed.push(noCol[1]);
      const { [noCol[1]]: _drop, ...rest } = current;
      current = rest;
      continue;
    }
    const notNull = msg.match(/null value in column "([^"]+)"/i);
    if (notNull && !filled.includes(notNull[1])) {
      const col = notNull[1];
      current = { ...current, [col]: defaultFor(col) };
      filled.push(col);
      continue;
    }
    if (removed.length || filled.length) {
      error.message += ` (descartadas: ${removed.join(", ") || "-"} | preenchidas: ${filled.join(", ") || "-"})`;
    }
    throw error;
  }
  throw new Error(`${mode} ${table}: muitos retries (descartadas: ${removed.join(", ")} | preenchidas: ${filled.join(", ")})`);
}

async function tryInsert(supabase, table, payload) {
  return adaptiveWrite(supabase, table, payload, "insert");
}

async function tryUpsert(supabase, table, payload, onConflict = "id") {
  return adaptiveWrite(supabase, table, payload, "upsert", onConflict);
}

async function adaptiveUpdateById(supabase, table, id, payload) {
  let current = compact(payload);
  const removed = [];
  for (let i = 0; i < 24; i++) {
    const { data, error } = await supabase
      .from(table)
      .update(current)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (!error) return data;
    const msg = error.message || "";
    const noCol = msg.match(/Could not find the '([^']+)' column/i);
    if (noCol && noCol[1] in current) {
      removed.push(noCol[1]);
      const { [noCol[1]]: _drop, ...rest } = current;
      current = rest;
      continue;
    }
    if (removed.length) error.message += ` (descartadas no update: ${removed.join(", ")})`;
    throw error;
  }
  throw new Error(`${table}: muitos retries no update (descartadas: ${removed.join(", ")})`);
}

function _normNome(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Re-importação ("exportar de novo pra atualizar"): a foto (avatar) que o corretor já colou
// fica salva no resultado_analise do lead anterior. Como cada importação cria um registro novo,
// sem isso a foto sumia. Aqui buscamos o lead equivalente (mesmo telefone OU mesmo nome) que já
// tenha avatarFoto e devolvemos pra carregar no registro novo.


function _digitsIdentity(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function _cleanArquivoIdentity(value = "") {
  return String(value || "")
    .replace(/\.zip$/i, "")
    .replace(/\.txt$/i, "")
    .replace(/-enxuto$/i, "")
    .replace(/\s*\(\d+\)\s*$/g, "")
    .replace(/^Conversa do WhatsApp com\s+/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _nomeIdentity(value = "") {
  return _normNome(_cleanArquivoIdentity(value))
    .replace(/\b(renaissance|evolutti|boulevard|terrenos?|premium office|quality|personalite|personalité|prime|nova vila rica|vila rica|nvr|nvriii|nvrii|nvri|celular|cell|whatsapp|fone|telefone|terreno|lote|apartamento|apto)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _nomeRuimIdentity(value = "") {
  const s = String(value || "").trim();
  const d = _digitsIdentity(s);
  const letras = s.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  return !s || /^cliente importad[oa]?$/i.test(s) || (d.length >= 8 && letras.length < 3);
}

function _assinaturaTimelineV681(m) {
  if (!m || typeof m !== "object") return "";
  if (m.mediaFile) return "audio|" + String(m.mediaFile).split(/[\\/]/).pop().toLowerCase().trim();
  const txt = String(m.text || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 220);
  const sig = [String(m.date || "").trim(), String(m.time || "").trim(), String(m.author || "").trim().toLowerCase(), txt].join("|");
  return sig.replace(/\|/g, "") ? sig : "";
}

function _mesclarTimelinesV681(antiga, nova) {
  const a = Array.isArray(antiga) ? antiga : [];
  const b = Array.isArray(nova) ? nova : [];
  const vistos = new Set();
  const out = [];
  for (const m of [...a, ...b]) {
    if (!m || typeof m !== "object") continue;
    const k = _assinaturaTimelineV681(m);
    if (k && vistos.has(k)) continue;
    if (k) vistos.add(k);
    out.push({ ...m });
  }
  out.sort((x, y) => String(x.iso || "9999").localeCompare(String(y.iso || "9999")) || Number(x.order || 0) - Number(y.order || 0));
  out.forEach((m, i) => { m.id = i + 1; m.order = i + 1; });
  const chavesAntigas = new Set(a.map(_assinaturaTimelineV681).filter(Boolean));
  const novasUnicas = b.filter(m => { const k = _assinaturaTimelineV681(m); return k && !chavesAntigas.has(k); }).length;
  const preservadasDoAntigo = a.filter(m => { const k = _assinaturaTimelineV681(m); return k && !new Set(b.map(_assinaturaTimelineV681).filter(Boolean)).has(k); }).length;
  return { timeline: out, novasUnicas, preservadasDoAntigo, duplicadasIgnoradas: Math.max(0, a.length + b.length - out.length) };
}

async function _buscarProcessamentoExistenteV681(supabase, { result, fileName, path }) {
  const analysis = result?.analysis || {};
  const lead = result?.lead || analysis?.lead || {};
  const nomeArquivoNovo = _cleanArquivoIdentity(fileName || result?.txtFile || path?.split("/").pop() || "");
  const arquivoKey = _nomeIdentity(nomeArquivoNovo);
  const nomeNovo = _nomeIdentity(lead?.clientName || analysis?.clientName || analysis?.lead?.clientName || nomeArquivoNovo);
  const phone = _digitsIdentity(lead?.phone || analysis?.lead?.phone || result?.phone || "");
  const phoneKey = phone.length >= 8 ? phone.slice(-8) : "";
  if (!phoneKey && arquivoKey.length < 3 && nomeNovo.length < 3) return null;

  const { data, error } = await supabase
    .from("whatsapp_processamentos")
    .select("id,nome_arquivo,arquivo_nome,telefone,resultado_analise,timeline_json,criado_em,created_at,atualizado_em,updated_at")
    .order("atualizado_em", { ascending: false })
    .limit(5000);
  if (error || !Array.isArray(data)) return null;
  for (const row of data) {
    const ra = row.resultado_analise || {};
    const rowPhone = _digitsIdentity(ra?.lead?.phone || row.telefone || "");
    if (phoneKey && rowPhone.length >= 8 && rowPhone.slice(-8) === phoneKey) return { row, via: "telefone" };
  }
  for (const row of data) {
    const rowFile = _nomeIdentity(row.nome_arquivo || row.arquivo_nome || "");
    if (arquivoKey.length >= 3 && rowFile && rowFile === arquivoKey) return { row, via: "arquivo" };
  }
  if (nomeNovo.length >= 3 && !_nomeRuimIdentity(nomeNovo)) {
    for (const row of data) {
      const ra = row.resultado_analise || {};
      const rowName = _nomeIdentity(ra?.clientName || ra?.lead?.clientName || row.nome_arquivo || row.arquivo_nome || "");
      if (rowName && rowName === nomeNovo) return { row, via: "nome" };
    }
  }
  return null;
}

function _mesclarAnaliseV681(anterior = {}, nova = {}) {
  const merged = { ...(anterior || {}), ...(nova || {}) };
  merged.memoria = { ...((anterior || {}).memoria || {}), ...((nova || {}).memoria || {}) };
  for (const key of ["aprendizado", "venda", "motivoPerda", "motivo_perda", "lembrete", "avatarFoto", "scoreAjuste"]) {
    if (merged[key] === undefined || merged[key] === null || merged[key] === "") merged[key] = anterior?.[key];
  }
  const nomeAnt = anterior?.clientName || anterior?.lead?.clientName || "";
  const nomeNovo = nova?.clientName || nova?.lead?.clientName || "";
  if (_nomeRuimIdentity(nomeNovo) && !_nomeRuimIdentity(nomeAnt)) {
    merged.clientName = nomeAnt;
    merged.lead = { ...(merged.lead || {}), clientName: nomeAnt, phone: merged?.lead?.phone || anterior?.lead?.phone || "" };
  }
  const prodAnt = anterior?.produtoInteresse || anterior?.lead?.product || "";
  const prodNovo = nova?.produtoInteresse || nova?.lead?.product || "";
  if ((!prodNovo || /não identificado|nao identificado/i.test(prodNovo)) && prodAnt) {
    merged.produtoInteresse = prodAnt;
    merged.lead = { ...(merged.lead || {}), product: prodAnt };
  }
  return merged;
}

async function buscarAvatarAnterior(supabase, lead, analysis) {
  try {
    const phone = String(lead?.phone || analysis?.lead?.phone || "").replace(/\D/g, "");
    const nomeNovo = _normNome(lead?.clientName || analysis?.clientName || analysis?.lead?.clientName || "");
    if (!phone && !nomeNovo) return "";
    const { data } = await supabase
      .from("whatsapp_processamentos")
      .select("resultado_analise, telefone, criado_em")
      .order("criado_em", { ascending: false })
      .limit(500);
    if (!Array.isArray(data)) return "";
    for (const r of data) {
      const ra = r.resultado_analise || {};
      if (!ra.avatarFoto) continue;
      const rPhone = String(ra?.lead?.phone || r.telefone || "").replace(/\D/g, "");
      const rNome = _normNome(ra?.clientName || ra?.lead?.clientName || "");
      const matchPhone = phone && rPhone && phone.slice(-8) === rPhone.slice(-8);
      const matchNome = nomeNovo && rNome && nomeNovo === rNome;
      if (matchPhone || matchNome) return ra.avatarFoto;
    }
  } catch (_) { /* sem foto anterior, segue sem */ }
  return "";
}

export async function persistProcessingResult({ result, source = "api", bucket = null, path = null, fileName = null, fileSize = null }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, skipped: true, reason: "Supabase não configurado no ambiente." };
  }

  const nomeArquivo = fileName || result?.txtFile || path?.split("/").pop() || "conversa-whatsapp.zip";
  const audiosEncontrados = result?.audiosEncontrados ?? result?.audioFiles?.length ?? 0;
  const audiosTranscritos = result?.audiosTranscritos ?? Object.values(result?.audioTranscriptions || {}).filter(v => String(v?.status || "").includes("transcrito") && v?.text).length;
  const timeline = result?.timeline || [];
  let analysis = result?.analysis || null;
  const lead = result?.lead || null;

  // Re-importação: se o lead já tinha foto (avatar) e a análise nova não traz nenhuma, mantém a foto antiga.
  if (analysis && !analysis.avatarFoto) {
    const fotoAnterior = await buscarAvatarAnterior(supabase, lead, analysis);
    if (fotoAnterior) analysis = { ...analysis, avatarFoto: fotoAnterior };
  }

  const attempts = [];
  let processingRow = null;

  const existenteV681 = await _buscarProcessamentoExistenteV681(supabase, { result, fileName: nomeArquivo, path });

  const canonicalPayload = {
    nome_arquivo: nomeArquivo,
    arquivo_nome: nomeArquivo,
    status: "pronto",
    etapa: analysis?.etapaSugerida || "Novo",
    progresso: 100,
    erro: null,
    texto_extraido: result?.rawText || null,
    timeline_json: timeline,
    audios_encontrados: audiosEncontrados,
    audios_transcritos: audiosTranscritos,
    resultado_analise: analysis,
    storage_bucket: bucket || "",
    storage_path: path || "",
    file_size: fileSize,
    criado_em: result?.criadoEm || new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (existenteV681?.row?.id) {
    const anterior = existenteV681.row;
    const mergeTimeline = _mesclarTimelinesV681(anterior.timeline_json, timeline);
    const mergedAnalysis = _mesclarAnaliseV681(anterior.resultado_analise || {}, analysis || {});
    const updatePayload = {
      ...canonicalPayload,
      resultado_analise: mergedAnalysis,
      timeline_json: mergeTimeline.timeline,
      texto_extraido: mergeTimeline.timeline.map(m => `[${m.date || ""} ${m.time || ""}] ${m.author || ""}: ${m.text || ""}`).join("\n"),
      criado_em: anterior.criado_em || anterior.created_at || canonicalPayload.criado_em,
      atualizado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    try {
      const data = await adaptiveUpdateById(supabase, "whatsapp_processamentos", anterior.id, updatePayload);
      processingRow = data || { id: anterior.id };
      attempts.push({ table: "whatsapp_processamentos", model: "v681-safe-update", info: `Atualizado sem duplicar (via ${existenteV681.via}; ${mergeTimeline.novasUnicas} nova(s), ${mergeTimeline.duplicadasIgnoradas} duplicada(s) ignorada(s)).` });
    } catch (error) {
      attempts.push({ table: "whatsapp_processamentos", model: "v681-safe-update", error: error.message });
    }
  }

  if (!processingRow) {
    try {
      processingRow = await tryInsert(supabase, "whatsapp_processamentos", canonicalPayload);
    } catch (error) {
      attempts.push({ table: "whatsapp_processamentos", model: "canonical", error: error.message });
      const legacyPayload = {
        arquivo_nome: nomeArquivo,
        status: "pronto",
        etapa: "Conversa processada pelo Motor Real do Corretor Pro.",
        progresso: 100,
        erro: null,
        texto_extraido: result?.rawText || null,
        timeline_json: timeline,
        resultado_analise: analysis,
        storage_bucket: bucket,
        storage_path: path,
        file_size: fileSize,
        audios_encontrados: audiosEncontrados,
        audios_transcritos: audiosTranscritos,
        updated_at: new Date().toISOString()
      };
      try {
        processingRow = await tryInsert(supabase, "whatsapp_processamentos", legacyPayload);
      } catch (legacyError) {
        attempts.push({ table: "whatsapp_processamentos", model: "legacy", error: legacyError.message });
      }
    }
  }

  let leadRow = null;
  const leadId = processingRow?.lead_id || processingRow?.id || undefined;

  // Só tenta salvar o lead se o processamento foi criado com sucesso.
  // leadId indefinido causaria um upsert com id=undefined, gerando lead órfão sem vínculo.
  if (leadId) {
    const leadBase = {
      id: leadId,
      nome: lead?.clientName || "Cliente importado",
      telefone: lead?.phone || null,
      empreendimento_interesse: lead?.product || "Não identificado",
      produto: lead?.product || "Não identificado",
      etapa: "NOVO / INICIAL",
      status: "Conversa processada",
      prioridade: analysis?.probabilityPercent || null,
      probabilidade_resposta: analysis?.probabilityPercent || null,
      melhor_horario: analysis?.bestTime || null,
      proxima_acao: analysis?.nextAction || null,
      resumo: analysis?.summary || null,
      observacoes: null,
      resultado_analise: analysis,
      timeline_json: timeline,
      atualizado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // O projeto já teve tabelas "leads" e "direciona_leads" em momentos diferentes.
    // Tentamos salvar sem travar o processamento se uma delas tiver colunas diferentes.
    for (const table of ["leads", "direciona_leads"]) {
      try {
        leadRow = await tryUpsert(supabase, table, leadBase);
        break;
      } catch (error) {
        attempts.push({ table, model: "lead", error: error.message });
      }
    }
  }

  return {
    ok: !!processingRow,
    source,
    processing: processingRow ? { id: processingRow.id, table: "whatsapp_processamentos" } : null,
    lead: leadRow ? { id: leadRow.id, table: leadRow.id ? "leads/direciona_leads" : null } : null,
    warnings: attempts
  };
}

export async function listRecentProcessings(limit = 12, options = {}) {
  const supabase = options?.supabase || getSupabaseAdmin();
  if (!supabase) return { ok: false, items: [], error: "Supabase não configurado." };

  const resolvedLimit = limit == null ? 12 : Number(limit);
  const fetchLimit = Math.min(2000, Math.max(20, resolvedLimit * 3));
  const includeFullTimeline = options?.includeFullTimeline === true;
  const requestedId = options?.id ? String(options.id) : "";
  const previewLimit = Math.min(20, Math.max(3, Number(options?.previewLimit || 8)));

  // Evita trazer texto_extraido, storage e outros campos grandes que não entram na tela.
  // timeline_json ainda é lida no servidor para calcular dias, último falante e contagens,
  // mas só a prévia é enviada ao celular. Em esquemas antigos, cai para select("*").
  const LIST_COLUMNS = "id,nome_arquivo,arquivo_nome,status,etapa,progresso,timeline_json,audios_encontrados,audios_transcritos,resultado_analise,criado_em,created_at,atualizado_em,updated_at";
  const montarQuery = (colunaData, colunas = LIST_COLUMNS) => {
    let q = supabase
      .from("whatsapp_processamentos")
      .select(colunas)
      .order(colunaData, { ascending: false });
    if (requestedId) q = q.eq("id", requestedId).limit(1);
    else q = q.limit(fetchLimit);
    return q;
  };

  let { data, error } = await montarQuery("criado_em");
  if (error) ({ data, error } = await montarQuery("created_at"));
  if (error) ({ data, error } = await montarQuery("criado_em", "*"));
  if (error) ({ data, error } = await montarQuery("created_at", "*"));

  if (error) return { ok: false, items: [], error: error.message };

  const products = ["Renaissance", "Evolutti", "Boulevard", "Terrenos", "Premium Office", "Quality", "Personalité", "Personalite", "Prime"];

  function cleanFileName(value = "") {
    return String(value || "")
      .replace(/\.zip$/i, "")
      .replace(/-enxuto$/i, "")
      .replace(/\s*\(\d+\)\s*$/g, "")
      // WhatsApp exporta "Conversa do WhatsApp com Fulano", mas às vezes vem "Conversa do com Fulano"
      // (sem a palavra WhatsApp). Sem cobrir os dois, o lead ficava com o NOME DO ARQUIVO inteiro.
      .replace(/^Conversa (?:do )?(?:whatsapp )?com\s+/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value = "") {
    return cleanFileName(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function productFrom(fileName = "", analysis = {}, row = {}) {
    // PRIORIDADE 1: produtoInteresse da IA (baseado nas mensagens mais recentes da janela)
    if (analysis?.produtoInteresse && analysis.produtoInteresse !== "Não identificado") {
      const ai = String(analysis.produtoInteresse).trim();
      const normalized = products.find(p => ai.toLowerCase() === p.toLowerCase() || ai.toLowerCase().includes(p.toLowerCase()));
      if (normalized) return normalized === "Personalite" ? "Personalité" : normalized;
      return ai;
    }
    // PRIORIDADE 2: substring match no fileName + outras fontes (modo legado)
    const raw = `${fileName} ${analysis?.product || ""} ${analysis?.lead?.product || ""} ${row.produto || ""}`.toLowerCase();
    const found = products.find(p => raw.includes(p.toLowerCase()));
    if (!found) return analysis?.product || analysis?.lead?.product || row.produto || "Produto não identificado";
    return found === "Personalite" ? "Personalité" : found;
  }

  // Tira do nome o RUÍDO de como o contato costuma ser salvo no WhatsApp:
  // empreendimento (Renaissance, Nova Vila Rica…), abreviações (NVR, NVRIII, VRIII) e palavras
  // como "cell/celular/terreno/lote/apto/whatsapp/fone". Não mexe no nome real.
  function limparRuidoNome(s) {
    let out = String(s || "");
    for (const product of products) out = out.replace(new RegExp(product, "ig"), " ");
    out = out
      .replace(/\bnova\s+vila\s+rica\b/ig, " ")
      .replace(/\bvila\s+rica\b/ig, " ")
      .replace(/\bN?VR\s*I{1,3}\b/ig, " ")
      .replace(/\bNVR\b/ig, " ")
      .replace(/\bNVRI{0,3}\b/ig, " ")
      .replace(/\b(cel(?:ular)?|cell|whats?app?|whats|terrenos?|lotes?|aptos?|apartamentos?|fone|tel|eII|i{2,3}|iv)\b/ig, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s\-–·.]+|[\s\-–·.]+$/g, "")
      .trim();
    return out;
  }
  function nameFrom(fileName = "", analysis = {}, row = {}) {
    // "Nome" que na verdade é um telefone (muitos dígitos, quase sem letras) NÃO serve como nome —
    // acontece quando o export do WhatsApp traz só o número no lugar do contato. Aí cai pro nome do arquivo.
    const pareceTelefone = (n) => { const s = String(n || "").trim(); const dig = s.replace(/\D/g, ""); const letras = s.replace(/[^a-zA-ZÀ-ÿ]/g, ""); return dig.length >= 8 && letras.length < 3; };
    let analyzedName = analysis?.clientName || analysis?.lead?.clientName || row.nome_cliente || row.nome;
    // Às vezes a análise gravou o NOME DO ARQUIVO como nome do cliente
    // ("Conversa do com Fulano-enxuto.zip"). Limpa antes de usar, senão o card fica com o arquivo.
    if (analyzedName && (/\.zip$/i.test(analyzedName) || /^conversa\s+d/i.test(analyzedName))) {
      analyzedName = cleanFileName(analyzedName);
    }
    if (analyzedName && !/^cliente importado$/i.test(String(analyzedName)) && !pareceTelefone(analyzedName)) {
      const limpo = limparRuidoNome(analyzedName);
      return limpo || analyzedName;
    }
    // Nome analisado ruim (vazio / "cliente importado" / telefone): tenta o nome do arquivo.
    const cleaned = cleanFileName(fileName);
    if (cleaned && !pareceTelefone(cleaned)) {
      const withoutProduct = limparRuidoNome(cleaned);
      return withoutProduct || cleaned;
    }
    // Sem nome em lugar nenhum: usa o telefone que veio (mais útil que "Cliente importado"), senão genérico.
    return (analyzedName && String(analyzedName).trim()) || cleaned || "Cliente importado";
  }

  function hasAnalysis(analysis) {
    if (!analysis || typeof analysis !== "object") return false;
    return Boolean(analysis.summary || analysis.nextAction || analysis.probability || analysis.probabilityPercent || analysis.messages);
  }

  function compactAnalysisForList(analysis = {}) {
    if (!analysis || typeof analysis !== "object") return {};
    // A análise salva pode crescer bastante com diagnóstico, memória e campos de versões
    // anteriores. A carteira precisa só dos sinais abaixo. O objeto integral é devolvido
    // exclusivamente no detalhe do lead.
    const keys = [
      "summary", "nextAction", "messages", "probability", "probabilityPercent", "bestTime",
      "clientName", "clientProfile", "lead", "confirmedAppointments", "lembrete",
      "tipoRetomada", "tipoContato", "avatarFoto", "venda", "motivoPerda", "motivo_perda",
      "permuta", "risk", "scoreAjuste", "produtoInteresse", "produtosInteresse", "mode",
      "diagnostico", "leituraComercial", "modeloComercial", "_schemaComercial", "evolucao", "memoria", "aprendizado", "objections",
      "oportunidadeId", "contatoId", "origemOportunidadeId", "oportunidadesVinculadas",
      "sugestoesPendentes", "arquiteturaMensagens", "error"
    ];
    const out = {};
    for (const key of keys) {
      if (analysis[key] !== undefined) out[key] = analysis[key];
    }
    return out;
  }

  const mapped = (data || []).map(row => {
    let analysis = row.resultado_analise || row.analysis || {};
    const timeline = Array.isArray(row.timeline_json) ? row.timeline_json : [];
    const last = timeline.length ? timeline[timeline.length - 1] : null;

    // Na lista leve, não reconstrói/varre o histórico inteiro para validar compromissos.
    // Esse trabalho já é feito quando a análise é salva. A validação completa continua
    // existindo ao abrir o detalhe do lead, quando o histórico integral é realmente necessário.
    if (includeFullTimeline && analysis && Array.isArray(analysis.confirmedAppointments) && analysis.confirmedAppointments.length) {
      const convText = timeline.map(m => m && m.text || "").join("\n") + "\n" + (row.texto_extraido || "");
      analysis = { ...analysis, confirmedAppointments: filtrarCompromissosReais(analysis.confirmedAppointments, convText) };
    }

    const fileName = row.nome_arquivo || row.arquivo_nome || "Conversa importada";
    const analyzed = hasAnalysis(analysis);
    const probabilityPercent = analysis?.probabilityPercent ?? null;

    const ehItemManual = (m) => {
      const source = String(m?.source || "");
      const type = String(m?.type || "");
      return source === "manual" || source === "crm" || type === "print-whatsapp"
        || ["atendimento", "nota", "ligacao", "visita", "presencial"].includes(type);
    };

    // Procura de trás pra frente. Antes eram criados arrays completos com filter(),
    // aumentando muito memória e CPU quando havia centenas de mensagens por lead.
    let lastReal = null;
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (!ehItemManual(timeline[i])) { lastReal = timeline[i]; break; }
    }
    const lastIso = lastReal?.iso || last?.iso || row.atualizado_em || row.updated_at || row.criado_em || row.created_at || null;
    const daysSince = diasCalendarioBR(lastIso);
    const lastTouchIso = last?.iso || lastIso;
    const daysSinceTouch = diasCalendarioBR(lastTouchIso);

    const nomeResolvido = nameFrom(fileName, analysis, row);
    const ehBusinessMsg = /(senger|construtora|corretor|imobili|direciona|atendimento|sistema)/i;
    const primeiroNome = String(nomeResolvido || "").trim().toLowerCase().split(/\s+/)[0] || "";
    const ehClienteMsg = (m) => {
      if (ehItemManual(m)) return false;
      const autor = String(m?.author || "").trim();
      if (!autor) return false;
      const al = autor.toLowerCase();
      return primeiroNome ? (al.includes(primeiroNome) || primeiroNome.includes(al)) : !ehBusinessMsg.test(autor);
    };
    let lastClient = null;
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (ehClienteMsg(timeline[i])) { lastClient = timeline[i]; break; }
    }
    const lastClientIso = lastClient?.iso || null;
    const daysSinceClientReply = diasCalendarioBR(lastClientIso);

    const nomeKey = normalizeKey(nomeResolvido);
    const nomeGenerico = !nomeKey || /^cliente importad[oa]$/i.test(String(nomeResolvido || "").trim());
    // O mesmo corretor parceiro pode ter várias oportunidades independentes. Registros com
    // oportunidadeId explícito nunca são fundidos apenas porque o nome/telefone do parceiro é igual.
    // Reimportações do mesmo negócio continuam atualizando o mesmo row, então o ID comercial é estável.
    const oportunidadeId = String(analysis?.modeloComercial?.oportunidade?.id || analysis?.oportunidadeId || "").trim();
    const dedupeKey = oportunidadeId ? `oportunidade:${oportunidadeId}` : (nomeGenerico ? String(row.id || "") : nomeKey);

    // Só materializa as mensagens que realmente serão enviadas ao navegador.
    // O histórico completo continua intacto no banco e é retornado em action=detalhe.
    const timelineForResponse = includeFullTimeline ? timeline : timeline.slice(-previewLimit);
    const recentMessages = timelineForResponse.map(m => ({
      date: m?.date,
      time: m?.time,
      author: m?.author,
      text: m?.text,
      type: m?.type,
      source: m?.source,
      proposta: m?.proposta || null,
      iso: m?.iso || null,
      mediaFile: m?.mediaFile || null,
      audioStatus: m?.audioStatus || null,
      audioFingerprint: m?.audioFingerprint || null,
      order: m?.order ?? null
    }));

    let hasProposal = false;
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i]?.proposta) { hasProposal = true; break; }
    }

    return {
      id: row.id,
      dedupeKey,
      fileName,
      status: row.status || "processado",
      progress: row.progresso ?? 100,
      etapa: row.etapa || analysis?.lead?.etapa || "Novo",
      name: nomeResolvido,
      product: productFrom(fileName, analysis, row),
      produtos: Array.isArray(analysis?.produtosInteresse) ? analysis.produtosInteresse.filter(Boolean) : null,
      probability: probabilityPercent ? `${probabilityPercent}%` : (analysis?.probability || (analyzed ? "Analisado" : "Importado")),
      probabilityPercent,
      bestTime: analysis?.bestTime || last?.time || (analyzed ? "Ver análise" : "Aguardando nova análise"),
      summary: analysis?.summary || (analyzed ? "Análise disponível." : "Conversa importada do histórico. Reimporte ou gere nova análise para atualizar."),
      nextAction: analysis?.nextAction || null,
      messages: analysis?.messages || null,
      phone: analysis?.lead?.phone || row.telefone || null,
      createdAt: row.criado_em || row.created_at || row.atualizado_em || row.updated_at || null,
      updatedAt: row.atualizado_em || row.updated_at || row.criado_em || row.created_at || null,
      lastInteractionAt: lastIso,
      daysSinceLastInteraction: daysSince,
      daysSinceLastTouch: daysSinceTouch,
      daysSinceClientReply,
      audiosEncontrados: row.audios_encontrados ?? null,
      audiosTranscritos: row.audios_transcritos ?? null,
      messageCount: timeline.length,
      hasProposal,
      recentMessages,
      historyLoaded: includeFullTimeline,
      analyzed,
      analysis: includeFullTimeline ? analysis : compactAnalysisForList(analysis)
    };
  });

  // Dedupe mantendo a ORDEM (mais recente primeiro) mas guardando, por chave, o registro mais
  // completo: o que tem mais mensagens/histórico e já foi analisado. Assim, se o mesmo cliente
  // foi cadastrado duas vezes, fica o card já trabalhado — não o cadastro novo vazio.
  const riqueza = (it) => (Number(it.messageCount) || 0) + (it.analyzed ? 1 : 0);
  const bestByKey = new Map();
  const fotoByKey = new Map(); // foto (avatar) de QUALQUER registro do cliente, pra não depender de qual ficou líder
  const idsByKey = new Map();  // TODOS os ids juntados sob o mesmo cliente (pra apagar duplicados de uma vez)
  const ordem = [];
  for (const item of mapped) {
    const k = item.dedupeKey;
    if (!fotoByKey.has(k)) {
      const f = item.analysis?.avatarFoto || item.avatarFoto;
      if (f) fotoByKey.set(k, f);
    }
    if (item.id != null) {
      if (!idsByKey.has(k)) idsByKey.set(k, []);
      idsByKey.get(k).push(String(item.id));
    }
    const prev = bestByKey.get(k);
    if (!prev) { bestByKey.set(k, item); ordem.push(k); }
    else if (riqueza(item) > riqueza(prev)) bestByKey.set(k, item);
  }
  const unique = [];
  for (const k of ordem) {
    const { dedupeKey, ...clean } = bestByKey.get(k);
    // Todos os registros duplicados desse mesmo cliente — o front usa pra apagar tudo de uma vez.
    const dupeIds = idsByKey.get(k) || [];
    if (dupeIds.length > 1) clean.dupeIds = dupeIds;
    // A foto pode ter sido salva num registro diferente do que virou líder da dedupe
    // (mesmo cliente, várias importações). Se o líder não tem foto mas outro registro
    // dele tem, herda — assim o avatar nunca "some" ao reabrir/recarregar a lista.
    const foto = fotoByKey.get(k);
    if (foto && !(clean.analysis && clean.analysis.avatarFoto)) {
      clean.analysis = { ...(clean.analysis || {}), avatarFoto: foto };
    }
    // A listagem envia apenas uma PRÉVIA leve para navegação e ranking.
    // O histórico não é cortado no banco: ao abrir o lead, o front solicita este mesmo
    // registro com includeFullTimeline=true e recebe TODAS as mensagens.
    if (!includeFullTimeline && Array.isArray(clean.recentMessages) && clean.recentMessages.length > previewLimit) {
      clean.recentMessages = clean.recentMessages.slice(-previewLimit);
    }
    clean.historyPreviewCount = Array.isArray(clean.recentMessages) ? clean.recentMessages.length : 0;
    unique.push(clean);
    if (unique.length >= resolvedLimit) break;
  }

  return {
    ok: true,
    items: unique,
    meta: {
      totalFetched: (data || []).length,
      totalReturned: unique.length,
      deduplicated: Math.max(0, mapped.length - unique.length)
    }
  };
}
