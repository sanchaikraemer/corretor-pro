import { requireApiKey, getSupabaseAdmin } from "./_persistence.js";
import { getOpenAI, transcreverBuffer, aprenderComHistoricoReal, obterStatusAprendizadoAutomatico, obterExportacaoAprendizado, marcarBootstrapAprendizadoConcluido, APRENDIZADO_PENDENTE_V2_PREFIX } from "./_pipeline.js";

const CONFIG_KEY = "direciona-cerebro";

const DEFAULTS = {
  corretorNome: "",
  metodo: "",
  tom: "",
  diferenciais: "",
  evitar: "",
  diasImportacao: 90,
  regrasTexto: "",
  objecoesTexto: "",
  regras: [],
  objecoes: []
};

function regrasLegadasParaTexto(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map(r => String(typeof r === "string" ? r : (r?.texto || "")).trim()).filter(Boolean).join("\n\n");
}
function objecoesLegadasParaTexto(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map(o => {
    const sinal = String(o?.objecao || o?.titulo || "").trim();
    const conducao = String(o?.resposta || o?.texto || "").trim();
    if (!sinal && !conducao) return "";
    if (sinal && conducao) return `SINAL: ${sinal}\nCOMO CONDUZIR: ${conducao}`;
    return sinal || conducao;
  }).filter(Boolean).join("\n\n");
}

function sanitizeCerebroConfig(valor = {}) {
  const v = valor && typeof valor === "object" ? valor : {};
  return {
    corretorNome: typeof v.corretorNome === "string" ? v.corretorNome.slice(0, 80).trim() : "",
    metodo: typeof v.metodo === "string" ? v.metodo : "",
    tom: typeof v.tom === "string" ? v.tom : "",
    diferenciais: typeof v.diferenciais === "string" ? v.diferenciais : "",
    evitar: typeof v.evitar === "string" ? v.evitar : "",
    diasImportacao: Number(v.diasImportacao) > 0 ? Number(v.diasImportacao) : 90,
    regrasTexto: Object.prototype.hasOwnProperty.call(v, "regrasTexto") && typeof v.regrasTexto === "string" ? v.regrasTexto : regrasLegadasParaTexto(v.regras),
    objecoesTexto: Object.prototype.hasOwnProperty.call(v, "objecoesTexto") && typeof v.objecoesTexto === "string" ? v.objecoesTexto : objecoesLegadasParaTexto(v.objecoes),
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

    // Exporta os casos e observações aprendidos para um Excel gerado no navegador.
    // Não chama a IA, não altera o Cérebro e não ativa o uso automático do aprendizado.
    if (body.action === "exportar-aprendizado") {
      try {
        const atual = await loadConfig(supabase);
        const config = atual?.valor && typeof atual.valor === "object" ? atual.valor : { ...DEFAULTS };
        const exportacao = await obterExportacaoAprendizado(config.inteligenciaAprendida || {}, config);
        return json(res, 200, { ok: true, exportacao });
      } catch (e) {
        return json(res, 500, { ok: false, error: e?.message || "Não foi possível preparar o aprendizado para exportação." });
      }
    }

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

    // Regras e objeções são salvas como blocos únicos de texto. O fallback converte
    // o formato antigo em lista para não perder conteúdo ao atualizar.
    const sanitizarBloco = (texto, limite = 60000) => String(texto || "").replace(/\u0000/g, "").slice(0, limite);
    const regrasTextoEntrada = Object.prototype.hasOwnProperty.call(body, "regrasTexto")
      ? body.regrasTexto
      : regrasLegadasParaTexto(body.regras);
    const objecoesTextoEntrada = Object.prototype.hasOwnProperty.call(body, "objecoesTexto")
      ? body.objecoesTexto
      : objecoesLegadasParaTexto(body.objecoes);

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
      regrasTexto: sanitizarBloco(regrasTextoEntrada),
      objecoesTexto: sanitizarBloco(objecoesTextoEntrada),
      regras: [],
      objecoes: [],
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

export { DEFAULTS as CEREBRO_DEFAULTS, CONFIG_KEY, sanitizeCerebroConfig };
