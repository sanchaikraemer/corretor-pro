import { requireApiKey, getSupabaseAdmin } from "./_persistence.js";
import { getOpenAI, transcreverBuffer, aprenderComHistoricoReal, obterStatusAprendizadoAutomatico, marcarBootstrapAprendizadoConcluido, APRENDIZADO_PENDENTE_V2_PREFIX, modeloTarefasSimples, modeloVisao } from "./_pipeline.js";

// Bloqueia URLs que apontem para endereços privados, loopback ou link-local (SSRF).
function validarUrlSegura(urlStr) {
  let parsed;
  try { parsed = new URL(urlStr); } catch (_) { return "URL inválida."; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return "Apenas URLs http/https são permitidas.";
  const h = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(h)) return "URL aponta para endereço local bloqueado.";
  if (/^10\./.test(h)) return "URL aponta para rede privada bloqueada.";
  if (/^192\.168\./.test(h)) return "URL aponta para rede privada bloqueada.";
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return "URL aponta para rede privada bloqueada.";
  if (/^169\.254\./.test(h)) return "URL aponta para endereço link-local bloqueado.";
  if (/^::1$|^fc00:|^fe80:|^fd/.test(h)) return "URL aponta para endereço IPv6 privado bloqueado.";
  return null;
}

const CONFIG_KEY = "direciona-cerebro";

const DEFAULTS = {
  corretorNome: "",
  metodo: "",
  tom: "",
  diferenciais: "",
  evitar: "",
  diasImportacao: 90,
  regras: [],
  objecoes: []
};

function sanitizeCerebroConfig(valor = {}) {
  const v = valor && typeof valor === "object" ? valor : {};
  return {
    corretorNome: typeof v.corretorNome === "string" ? v.corretorNome.slice(0, 80).trim() : "",
    metodo: typeof v.metodo === "string" ? v.metodo : "",
    tom: typeof v.tom === "string" ? v.tom : "",
    diferenciais: typeof v.diferenciais === "string" ? v.diferenciais : "",
    evitar: typeof v.evitar === "string" ? v.evitar : "",
    diasImportacao: Number(v.diasImportacao) > 0 ? Number(v.diasImportacao) : 90,
    regras: Array.isArray(v.regras) ? v.regras : [],
    objecoes: Array.isArray(v.objecoes) ? v.objecoes : [],
    inteligenciaAprendida: v.inteligenciaAprendida && typeof v.inteligenciaAprendida === "object" ? v.inteligenciaAprendida : undefined
  };
}

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  const raw = await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => resolve(data || "{}"));
    req.on("error", reject);
  });
  try { return JSON.parse(raw || "{}"); } catch (_) { return {}; }
}

async function loadConfig(supabase) {
  // Tenta ler da tabela direciona_config (chave/valor) se existir.
  const { data, error } = await supabase
    .from("direciona_config")
    .select("valor")
    .eq("chave", CONFIG_KEY)
    .maybeSingle();
  if (error) return { found: false, error: error.message };
  if (!data?.valor) return { found: false, defaults: true };
  return { found: true, valor: sanitizeCerebroConfig(data.valor) };
}

async function saveConfig(supabase, valor) {
  const { error } = await supabase
    .from("direciona_config")
    .upsert({ chave: CONFIG_KEY, valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  return { error };
}

export default async function handler(req, res) {
  if (requireApiKey(req, res) !== true) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  if (req.method === "GET") {
    const r = await loadConfig(supabase);
    if (r.error && !/relation .* does not exist|not find the table|schema cache/i.test(r.error)) {
      return json(res, 500, { ok: false, error: r.error });
    }
    const aprendizadoAutomatico = await obterStatusAprendizadoAutomatico().catch(() => ({ ativo: true, versao: 2, totalCasos: 0, historicosProcessados: 0 }));
    return json(res, 200, { ok: true, config: r.valor ? sanitizeCerebroConfig(r.valor) : DEFAULTS, usingDefaults: !r.found, aprendizadoAutomatico });
  }

  if (req.method === "POST" || req.method === "PUT") {
    const body = await readJsonBody(req).catch(() => ({}));

    // AÇÃO v808: só confirma que a varredura inicial terminou DEPOIS que o front
    // também recuperou eventuais conversas que falharam. Assim nenhuma conversa
    // fica marcada como aprendida só porque a paginação chegou ao fim.
    if (body.action === "finalizar-bootstrap-aprendizado") {
      const totalCarteira = Math.max(0, Number(body.totalCarteira) || 0);
      const ok = await marcarBootstrapAprendizadoConcluido(totalCarteira);
      const status = await obterStatusAprendizadoAutomatico().catch(() => null);
      return json(res, ok ? 200 : 500, { ok, aprendizadoAutomatico: status });
    }

    // AÇÃO v808: processa UMA alteração de histórico que foi enfileirada por uma
    // importação, reimportação ou reanálise. Uma por chamada mantém a função curta.
    if (body.action === "processar-aprendizado-pendente") {
      const openai = getOpenAI();
      if (!openai) return json(res, 200, { ok: false, error: "Análise indisponível agora." });
      const { data: filas, error: filaErr } = await supabase
        .from("direciona_config")
        .select("chave,valor,atualizado_em")
        .like("chave", `${APRENDIZADO_PENDENTE_V2_PREFIX}%`)
        .order("atualizado_em", { ascending: true })
        .range(0, 0);
      if (filaErr) return json(res, 200, { ok:false, error:filaErr.message });
      const fila = filas?.[0];
      if (!fila) {
        const status = await obterStatusAprendizadoAutomatico().catch(() => null);
        return json(res, 200, { ok:true, vazio:true, aprendizadoAutomatico:status });
      }
      const leadId = String(fila?.valor?.leadId || fila.chave.slice(APRENDIZADO_PENDENTE_V2_PREFIX.length));
      const { data: lead, error: leadErr } = await supabase
        .from("whatsapp_processamentos")
        .select("id,nome_arquivo,timeline_json,resultado_analise,etapa")
        .eq("id", leadId)
        .maybeSingle();
      if (leadErr) return json(res, 200, { ok:false, error:leadErr.message, leadId });
      if (!lead) {
        await supabase.from("direciona_config").delete().eq("chave", fila.chave);
        return json(res, 200, { ok:true, removido:true, motivo:"lead não existe mais", leadId });
      }
      const a = lead.resultado_analise || {};
      const r = await aprenderComHistoricoReal({
        timeline: Array.isArray(lead.timeline_json) ? lead.timeline_json : [],
        clientName: a.clientName || a?.lead?.clientName || a?.lead?.name || String(lead.nome_arquivo || "").replace(/\.(txt|zip)$/i, ""),
        leadId: String(lead.id),
        nomeArquivo: lead.nome_arquivo || "",
        produto: a?.modeloComercial?.oportunidade?.produto || a.produtoInteresse || a?.lead?.product || "",
        etapa: a.etapaSugerida || lead.etapa || a?.lead?.etapa || "",
        memoriaManual: a.memoria || {},
        openai
      });
      if (r?.ok) {
        await supabase.from("direciona_config").delete().eq("chave", fila.chave);
        const status = await obterStatusAprendizadoAutomatico().catch(() => null);
        return json(res, 200, { ok:true, processado:true, leadId, resultado:r, aprendizadoAutomatico:status });
      }
      const tentativas = Number(fila?.valor?.tentativas || 0) + 1;
      const valorFila = { ...(fila.valor || {}), leadId, tentativas, ultimoErro:String(r?.error || "Falha no aprendizado").slice(0,240), ultimaTentativaEm:new Date().toISOString() };
      await supabase.from("direciona_config").upsert({ chave:fila.chave, valor:valorFila, atualizado_em:new Date().toISOString() }, { onConflict:"chave" });
      return json(res, 200, { ok:false, pendente:true, leadId, tentativas, error:valorFila.ultimoErro });
    }

    // AÇÃO v808: apaga tanto as categorias legadas quanto os casos estruturados.
    // O Cérebro manual (método/tom/regras digitadas) permanece intacto.
    if (body.action === "limpar-aprendizado-completo") {
      const atual = await loadConfig(supabase);
      const base = (atual?.valor && typeof atual.valor === "object") ? atual.valor : { ...DEFAULTS };
      base.inteligenciaAprendida = {};
      const salvoLegado = await saveConfig(supabase, base);
      const apagadoMeta = await supabase.from("direciona_config").delete().eq("chave", "corretor-memoria-comercial-v2");
      const apagadosCasos = await supabase.from("direciona_config").delete().like("chave", "corretor-memoria-caso-v2:%");
      const apagadosPendentes = await supabase.from("direciona_config").delete().like("chave", `${APRENDIZADO_PENDENTE_V2_PREFIX}%`);
      const erro = salvoLegado?.error?.message || apagadoMeta?.error?.message || apagadosCasos?.error?.message || apagadosPendentes?.error?.message || "";
      return json(res, erro ? 500 : 200, { ok: !erro, error: erro || undefined });
    }

    // AÇÃO: aprender de uma imagem/print (lê a imagem com visão da IA)
    if (body.action === "aprender-imagem") {
      const openai = getOpenAI();
      if (!openai) return json(res, 200, { ok: false, error: "Análise não configurada." });
      try {
        const dataUrl = String(body.imagemBase64 || "");
        if (!/^data:image\//.test(dataUrl)) return json(res, 400, { ok: false, error: "Imagem não recebida no formato esperado." });
        const licoes = await extrairLicoesDeImagem(dataUrl, openai);
        return json(res, 200, { ok: true, fonte: "print", regras: licoes.regras || [], resumo: licoes.resumo || "" });
      } catch (e) {
        return json(res, 200, { ok: false, error: e?.message || "Falha ao ler a imagem." });
      }
    }

    // AÇÃO: aprender de um link ou vídeo do YouTube
    if (body.action === "aprender-link") {
      const openai = getOpenAI();
      if (!openai) return json(res, 200, { ok: false, error: "Análise não configurada — não dá para aprender com link agora." });
      const url = String(body.url || "").trim();
      if (!/^https?:\/\//i.test(url)) return json(res, 400, { ok: false, error: "Informe um link válido (começando com http)." });
      const urlErr = validarUrlSegura(url);
      if (urlErr) return json(res, 400, { ok: false, error: urlErr });
      try {
        const { texto, fonte } = await extrairTextoDeUrl(url);
        if (!texto || texto.trim().length < 80) {
          return json(res, 200, { ok: false, error: "Não consegui extrair texto suficiente desse " + fonte + ". Se for um vídeo sem legenda, cole a transcrição manualmente como regra." });
        }
        const licoes = await extrairLicoesComIA(texto.slice(0, 12000), openai);
        return json(res, 200, { ok: true, fonte, regras: licoes.regras || [], resumo: licoes.resumo || "" });
      } catch (e) {
        return json(res, 200, { ok: false, error: e?.message || "Falha ao acessar/ler o link." });
      }
    }

    // AÇÃO: transcrever áudio pra ensinar o Cérebro por voz (recebe base64)
    if (body.action === "transcrever-audio") {
      const openai = getOpenAI();
      if (!openai) return json(res, 200, { ok: false, error: "Transcrição não configurada — não dá para transcrever áudio agora." });
      try {
        const b64 = String(body.audioBase64 || "").replace(/^data:[^;]+;base64,/, "");
        if (!b64) return json(res, 400, { ok: false, error: "Áudio não recebido." });
        const buffer = Buffer.from(b64, "base64");
        const texto = await transcreverBuffer(buffer, body.ext || ".ogg", openai);
        return json(res, 200, { ok: true, texto });
      } catch (e) {
        return json(res, 200, { ok: false, error: e?.message || "Falha ao transcrever áudio." });
      }
    }

    // Transcreve um arquivo grande (ex.: vídeo) já enviado pro armazenamento, contornando o limite do envio direto.
    if (body.action === "transcrever-storage") {
      const openai = getOpenAI();
      if (!openai) return json(res, 200, { ok: false, error: "Transcrição não configurada — não dá para transcrever agora." });
      try {
        const bucket = String(body.bucket || "");
        const path = String(body.path || "");
        if (!bucket || !path) return json(res, 400, { ok: false, error: "Arquivo não recebido (sem bucket/path)." });
        const { data, error } = await supabase.storage.from(bucket).download(path);
        if (error || !data) return json(res, 200, { ok: false, error: "Não consegui baixar o arquivo do armazenamento." });
        const buffer = Buffer.from(await data.arrayBuffer());
        if (buffer.length > 25 * 1024 * 1024) return json(res, 200, { ok: false, error: "Arquivo maior que 25 MB — mande um trecho mais curto." });
        const ext = String(body.ext || ".mp4").toLowerCase();
        const texto = await transcreverBuffer(buffer, ext, openai);
        try { await supabase.storage.from(bucket).remove([path]); } catch (_) {}
        if (!texto || texto.trim().length < 20) return json(res, 200, { ok: false, error: "Não consegui ouvir fala no vídeo (sem áudio ou só ruído)." });
        // Condensa a fala em lições curtas (em vez de um textão que estoura o limite de regra)
        const licoes = await extrairLicoesComIA(texto.slice(0, 12000), openai);
        return json(res, 200, { ok: true, regras: licoes.regras || [], resumo: licoes.resumo || "", texto });
      } catch (e) {
        return json(res, 200, { ok: false, error: e?.message || "Falha ao transcrever o vídeo." });
      }
    }

    // AÇÃO: aprender de TODA a carteira que JÁ está no Direciona (os leads já salvos).
    // Roda em LOTES (o front chama de novo com a próxima posição até concluir), pra não estourar
    // o tempo da função. Devolve quanto aprendeu e — sem ser silencioso — quantos não salvaram.
    if (body.action === "aprender-carteira") {
      const openai = getOpenAI();
      if (!openai) return json(res, 200, { ok: false, error: "Análise indisponível agora — não dá para aprender da carteira." });
      try {
        const offset = Math.max(0, parseInt(body.offset, 10) || 0);
        // 1 conversa por requisição — cada uma é 1 chamada de IA com tempo curto; impossível estourar a função.
        const limite = 1;
        // Conta a carteira SÓ na 1ª requisição (offset 0) — nas seguintes o front já sabe o total.
        let total = null;
        if (offset === 0) {
          try {
            const c = await supabase.from("whatsapp_processamentos").select("id", { count: "exact", head: true });
            if (Number.isFinite(c.count)) total = c.count;
          } catch (_) {}
        }
        const { data: leads, error } = await supabase
          .from("whatsapp_processamentos")
          .select("id, nome_arquivo, timeline_json, resultado_analise")
          .order("id", { ascending: true })
          .range(offset, offset + limite - 1);
        if (error) return json(res, 200, { ok: false, error: "Banco: " + error.message });
        let aprendidas = 0, semConteudo = 0, falhasSalvar = 0, totalNoBanco = 0, errosIA = 0;
        let ultimoErroIA = "";
        const amostra = [];
        for (const l of (leads || [])) {
          const tl = Array.isArray(l.timeline_json) ? l.timeline_json : [];
          const a = l.resultado_analise || {};
          const memManual = a.memoria || {};
          const temMemoriaManual = (Array.isArray(memManual.camposManuais) && memManual.camposManuais.some(k => String(memManual[k] || "").trim())) ||
            (Array.isArray(memManual.observacoesManuais) && memManual.observacoesManuais.some(o => String(o?.texto || "").trim()));
          if (tl.length < 2 && !temMemoriaManual) { semConteudo++; continue; }
          const clientName = a.clientName || a?.lead?.clientName || String(l.nome_arquivo || "").replace(/\.(txt|zip)$/i, "");
          const r = await aprenderComHistoricoReal({
            timeline: tl,
            clientName,
            leadId: String(l.id || ""),
            nomeArquivo: l.nome_arquivo || "",
            produto: a.produtoInteresse || a?.lead?.product || "",
            etapa: a.etapaSugerida || a?.lead?.etapa || "",
            memoriaManual: a.memoria || {},
            openai,
            forcar: body.forcar === true
          });
          if (r?.ok) {
            try { await supabase.from("direciona_config").delete().eq("chave", `${APRENDIZADO_PENDENTE_V2_PREFIX}${String(l.id || "").slice(0,180)}`); } catch (_) {}
            if (r.ignorado && r.motivo === "sem diálogo real") semConteudo++;
            else aprendidas++;
            totalNoBanco = r.totalCasos || totalNoBanco;
            if (r.casosDoLead && amostra.length < 3) amostra.push(`${r.casosDoLead} caso(s) real(is) extraído(s)`);
          } else {
            if (r?.error) { errosIA++; ultimoErroIA = String(r.error).slice(0, 200); }
            else falhasSalvar++;
          }
        }
        const processadosAteAgora = offset + (leads?.length || 0);
        const concluido = total != null ? processadosAteAgora >= total : (leads?.length || 0) < limite;
        // A conclusão é confirmada por uma ação separada somente depois que o front
        // recuperar os offsets que eventualmente falharam.
        return json(res, 200, {
          ok: true,
          total,
          loteProcessado: leads?.length || 0,
          offset,
          proximaOffset: concluido ? null : processadosAteAgora,
          concluido,
          aprendidasNoLote: aprendidas,
          semConteudo,
          falhasSalvar,
          errosIA,
          ultimoErroIA,
          totalNoBanco,
          amostra,
          aviso: falhasSalvar > 0 ? "Algumas lições não foram salvas (a tabela do Cérebro pode não existir no banco)." : ""
        });
      } catch (e) {
        return json(res, 200, { ok: false, error: "Erro ao aprender: " + String(e?.message || e) });
      }
    }

    // Limpa e limita arrays de regras e objeções
    const sanitizarRegras = (arr) => Array.isArray(arr) ? arr
      .map(r => (typeof r === "string" ? { texto: r } : r))
      .filter(r => r && String(r.texto || "").trim())
      .slice(0, 100)
      .map(r => ({ texto: String(r.texto).slice(0, 600), origem: r.origem || "manual", criadoEm: r.criadoEm || new Date().toISOString() }))
      : [];
    const sanitizarObjecoes = (arr) => Array.isArray(arr) ? arr
      .filter(o => o && (String(o.objecao || "").trim() || String(o.resposta || "").trim()))
      .slice(0, 100)
      .map(o => ({ objecao: String(o.objecao || "").slice(0, 300), resposta: String(o.resposta || "").slice(0, 800), criadoEm: o.criadoEm || new Date().toISOString() }))
      : [];

    // Action específico: atualizar APENAS a inteligenciaAprendida (preserva o resto do Cérebro).
    if (body.action === "intel-update") {
      const atual = await loadConfig(supabase);
      const base = (atual?.valor && typeof atual.valor === "object") ? atual.valor : {};
      base.inteligenciaAprendida = (body.inteligenciaAprendida && typeof body.inteligenciaAprendida === "object") ? body.inteligenciaAprendida : {};
      const r = await saveConfig(supabase, base);
      if (r.error) return json(res, 500, { ok: false, error: r.error.message || String(r.error) });
      return json(res, 200, { ok: true });
    }

    // Save padrão: preserva inteligenciaAprendida e estiloHistorico existentes (form do Cérebro
    // não controla esses campos — eles são alimentados pela análise de ZIPs).
    const atualConfig = await loadConfig(supabase);
    const baseAprend = (atualConfig?.valor && typeof atualConfig.valor === "object") ? atualConfig.valor : {};
    const diasN = Number(body.diasImportacao);
    const valor = {
      corretorNome: typeof body.corretorNome === "string" ? body.corretorNome.slice(0, 80).trim() : DEFAULTS.corretorNome,
      metodo: typeof body.metodo === "string" ? body.metodo : DEFAULTS.metodo,
      tom: typeof body.tom === "string" ? body.tom : DEFAULTS.tom,
      diferenciais: typeof body.diferenciais === "string" ? body.diferenciais : DEFAULTS.diferenciais,
      evitar: typeof body.evitar === "string" ? body.evitar : DEFAULTS.evitar,
      diasImportacao: (Number.isFinite(diasN) && diasN > 0 && diasN <= 365) ? Math.round(diasN) : 90,
      regras: sanitizarRegras(body.regras),
      objecoes: sanitizarObjecoes(body.objecoes),
      inteligenciaAprendida: baseAprend.inteligenciaAprendida || {},
      estiloHistorico: Array.isArray(baseAprend.estiloHistorico) ? baseAprend.estiloHistorico : undefined
    };
    const r = await saveConfig(supabase, valor);
    if (r.error) {
      const missing = /relation .* does not exist|not find the table|schema cache/i.test(r.error.message || "");
      if (missing) {
        return json(res, 200, {
          ok: false,
          warning: "Tabela direciona_config não existe. Configuração não foi persistida no banco — o app vai usar localStorage do navegador como fallback.",
          config: valor,
          sqlNecessario: "create table if not exists public.direciona_config (chave text primary key, valor jsonb, atualizado_em timestamptz default now());"
        });
      }
      return json(res, 500, { ok: false, error: r.error.message });
    }
    return json(res, 200, { ok: true, config: valor });
  }

  return json(res, 405, { ok: false, error: "Use GET, POST ou PUT." });
}

// Extrai o ID do vídeo de várias formas de URL do YouTube
function youtubeId(url) {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

// Busca a legenda/transcrição de um vídeo do YouTube (best-effort, sem API key)
async function youtubeTranscript(videoId) {
  const headers = { "User-Agent": "Mozilla/5.0", "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" };
  const page = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { headers }).then(r => r.text());
  // Acha a lista de faixas de legenda dentro do playerResponse
  const m = page.match(/"captionTracks":(\[.*?\])/);
  if (!m) return "";
  let tracks;
  try { tracks = JSON.parse(m[1].replace(/\\u0026/g, "&")); } catch (_) { return ""; }
  if (!Array.isArray(tracks) || !tracks.length) return "";
  // Prefere pt, senão a primeira
  const track = tracks.find(t => /pt/i.test(t.languageCode)) || tracks.find(t => /^en/i.test(t.languageCode)) || tracks[0];
  if (!track?.baseUrl) return "";
  const xml = await fetch(track.baseUrl, { headers }).then(r => r.text());
  // Extrai o texto dos <text> do XML de legenda
  const partes = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map(x =>
    x[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]+>/g, "")
  );
  return partes.join(" ").replace(/\s+/g, " ").trim();
}

// Extrai texto de uma página web comum (remove HTML)
async function paginaTexto(url) {
  const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then(r => r.text());
  const semScript = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const semTags = semScript.replace(/<[^>]+>/g, " ");
  return semTags.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

async function extrairTextoDeUrl(url) {
  const vid = youtubeId(url);
  if (vid) {
    const t = await youtubeTranscript(vid);
    return { texto: t, fonte: "vídeo" };
  }
  const t = await paginaTexto(url);
  return { texto: t, fonte: "link" };
}

// Usa a IA pra transformar o conteúdo em regras de venda aplicáveis ao corretor
async function extrairLicoesComIA(texto, openai) {
  const prompt = `Você é o Cérebro Comercial do Corretor Pro, app pra corretores de imóveis. Abaixo está o conteúdo de um material de vendas (vídeo/artigo). Extraia de 1 a 6 LIÇÕES/REGRAS práticas e acionáveis que ajudem o corretor a conduzir melhor o atendimento e gerar melhores mensagens no WhatsApp. Cada regra deve ser uma frase curta, no formato "situação → como agir" quando possível. Ignore enrolação, motivação genérica e propaganda. Retorne APENAS JSON: { "resumo": "1 frase do que o material ensina", "regras": ["regra 1", "regra 2", ...] }.

CONTEÚDO:
${texto}`;
  const completion = await openai.chat.completions.create({
    model: modeloTarefasSimples(),
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  const parsed = JSON.parse(completion.choices[0].message.content);
  return { resumo: parsed.resumo || "", regras: Array.isArray(parsed.regras) ? parsed.regras.filter(r => typeof r === "string" && r.trim()).slice(0, 6) : [] };
}

// Lê uma imagem/print com a visão da IA e extrai lições de venda
async function extrairLicoesDeImagem(dataUrl, openai) {
  const instrucao = `Você é o Cérebro Comercial do Corretor Pro, app pra corretores de imóveis. Leia o conteúdo desta imagem (pode ser um print de post, slide, mensagem de um mentor, anúncio). Extraia de 1 a 6 LIÇÕES/REGRAS práticas e acionáveis pra conduzir melhor o atendimento e gerar melhores mensagens no WhatsApp. Cada regra: frase curta, formato "situação → como agir" quando der. Ignore enrolação e motivação genérica. Se a imagem não tiver conteúdo útil de vendas, retorne regras vazias. Retorne APENAS JSON: { "resumo": "1 frase do que a imagem ensina", "regras": ["regra 1", ...] }.`;
  const completion = await openai.chat.completions.create({
    model: modeloVisao(),
    messages: [{
      role: "user",
      content: [
        { type: "text", text: instrucao },
        { type: "image_url", image_url: { url: dataUrl } }
      ]
    }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  const parsed = JSON.parse(completion.choices[0].message.content);
  return { resumo: parsed.resumo || "", regras: Array.isArray(parsed.regras) ? parsed.regras.filter(r => typeof r === "string" && r.trim()).slice(0, 6) : [] };
}

export { DEFAULTS as CEREBRO_DEFAULTS, CONFIG_KEY, sanitizeCerebroConfig };
