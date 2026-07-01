import { getSupabaseAdmin } from "./_persistence.js";
import { analyzeWithBrain, getOpenAI, resumirAtendimento, atualizarConhecimentoCorretor } from "./_pipeline.js";

// Dia da semana de HOJE no fuso de Brasília (0=domingo). Evita virar o dia no UTC à noite.
function diaSemanaBR() {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(new Date());
  const m = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return m[wd] != null ? m[wd] : new Date().getDay();
}
// Dias até o próximo dia da semana (ex.: "sexta"), relativo a uma data base. queVem força a semana seguinte.
// Sem baseDate, usa hoje no fuso de Brasília. Com base (ex.: data da mensagem do cliente), conta a partir dela.
function diasAteDiaSemana(nome, queVem, baseDate) {
  const mapa = { domingo: 0, segunda: 1, "terça": 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, "sábado": 6, sabado: 6 };
  const alvo = mapa[String(nome || "").toLowerCase()];
  if (alvo == null) return null;
  let refDay;
  if (baseDate) {
    const d = new Date(baseDate);
    refDay = isNaN(d.getTime()) ? diaSemanaBR() : d.getUTCDay();
  } else {
    refDay = diaSemanaBR();
  }
  let delta = (alvo - refDay + 7) % 7;
  if (delta === 0) delta = 7;
  if (queVem && delta < 7) delta += 7;
  return delta;
}

// Data e hora no fuso de Brasília (servidor roda em UTC). Devolve { dataBR, horaBR }.
function agoraBR(now = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    const p = Object.fromEntries(fmt.formatToParts(now).map(x => [x.type, x.value]));
    return { dataBR: `${p.day}/${p.month}/${p.year}`, horaBR: `${p.hour}:${p.minute}` };
  } catch (_) {
    const p2 = (n) => String(n).padStart(2, "0");
    return { dataBR: `${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()}`, horaBR: `${p2(now.getHours())}:${p2(now.getMinutes())}` };
  }
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

// Lê um texto (anotação do corretor OU mensagem do cliente) e, se trouxer COMANDO EXPLÍCITO
// de agendar/marcar/lembrar/remarcar/reagendar + data, devolve { dias, motivo } pra virar
// LEMBRETE. Sem palavra-chave de comando OU sem data → null. Nunca infere; nunca inventa.
// baseDate (opcional) é a data da mensagem — pra calcular "sábado" relativo a ela, não a hoje.
function lembreteDoTexto(txt, baseDate) {
  const t = String(txt || "").toLowerCase();
  if (!t) return null;
  const temComando = /\b(agend\w*|reagend\w*|marc\w*|remarc\w*|lembr\w*|relembr\w*)\b/.test(t);
  if (!temComando) return null;
  let dias = null, m;
  // Prazo EXPLÍCITO primeiro: "em/daqui/depois de N dias|semanas|meses" (evita pegar um "1 mês" solto no texto).
  if ((m = t.match(/(?:em|daqui\s*a?|depois\s+de)\s*(\d{1,3})\s*(dias?|semanas?|m[eê]s(?:es)?)\b/))) {
    const n = parseInt(m[1], 10);
    dias = /semana/.test(m[2]) ? n * 7 : /m[eê]s/.test(m[2]) ? n * 30 : n;
  }
  else if ((m = t.match(/(\d{1,3})\s*dias?\b/)) && !/\bh[áa]\s*\d|atr[áa]s/.test(t)) dias = parseInt(m[1], 10);
  else if ((m = t.match(/(\d{1,3})\s*semanas?\b/))) dias = parseInt(m[1], 10) * 7;
  else if ((m = t.match(/(\d{1,3})\s*m[eê]s(?:es)?\b/))) dias = parseInt(m[1], 10) * 30;
  else if (/\bhoje\b|ainda hoje|hoje mesmo|pra hoje|para hoje/.test(t)) dias = 0;
  else if (/\bamanh[ãa]/.test(t)) dias = 1;
  else if (/semana que vem|pr[óo]xima semana/.test(t)) dias = 7;
  else if (/m[eê]s que vem|pr[óo]ximo m[eê]s/.test(t)) dias = 30;
  else if ((m = t.match(/\b(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(?:[\s-]*feira)?\b/))) {
    dias = diasAteDiaSemana(m[1], /que vem|pr[óo]xim/.test(t), baseDate);
  }
  if (dias == null || dias < 0 || dias > 1095) return null;
  return { dias, motivo: String(txt).trim().slice(0, 160) };
}

// Comando manual de score na observação do corretor: "aumentar score" => +10, "baixar score" => -10.
// Devolve o delta (somado se aparecer mais de uma vez). O corretor manda no número quando quiser.
function ajusteScoreDoTexto(txt) {
  const t = String(txt || "").toLowerCase();
  let delta = 0;
  const subir = t.match(/\b(aument\w*|sub\w*|sob\w*|elev\w*)\s+(o\s+|a\s+)?score\b/g);
  const descer = t.match(/\b(baix\w*|diminu\w*|reduz\w*|abaix\w*|derrub\w*|cai\w*|cair)\s+(o\s+|a\s+)?score\b/g);
  if (subir) delta += 10 * subir.length;
  if (descer) delta -= 10 * descer.length;
  return delta;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Use POST." });
  const body = await readJsonBody(req).catch(() => ({}));
  const id = body?.id;
  if (!id) return json(res, 400, { ok: false, error: "Informe id do lead." });

  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const { data: row, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("timeline_json, resultado_analise, nome_arquivo, etapa")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!row) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const timeline = Array.isArray(row.timeline_json) ? row.timeline_json : [];

  // Excluir UM item da timeline (ex.: proposta duplicada). Identifica pelo iso. Não reanalisa.
  if (body?.action === "remover-item") {
    const isoAlvo = String(body?.iso || "");
    if (!isoAlvo) return json(res, 400, { ok: false, error: "Informe o item a remover." });
    const nova = timeline.filter(m => String(m?.iso || "") !== isoAlvo);
    const { error: rmErr } = await supabase
      .from("whatsapp_processamentos")
      .update({ timeline_json: nova, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (rmErr) return json(res, 500, { ok: false, error: rmErr.message });
    return json(res, 200, { ok: true, removido: true });
  }

  // Marcação rápida de atendimento: um clique, sem texto obrigatório, sem IA e sem timer.
  // Guarda somente data/hora nas observações e um evento interno para o lead aparecer
  // como atendido hoje. Não inventa mensagem na timeline e não cria lembrete automático.
  if (body?.action === "marcar-atendido") {
    const agora = new Date();
    const br = agoraBR(agora);
    const prev = row.resultado_analise || {};
    const aprendizado = { ...(prev.aprendizado || {}) };
    const eventos = Array.isArray(aprendizado.eventos) ? [...aprendizado.eventos] : [];

    // Idempotência específica do botão: outros contatos manuais do mesmo dia não impedem
    // o registro explícito de "Atendido" solicitado pelo corretor.
    const marcadoHoje = eventos.find((e) => {
      if (e?.evento !== "contato_manual" || e?.detalhes?.de !== "botao_atendido" || !e?.quando) return false;
      const d = new Date(e.quando);
      return !isNaN(d.getTime()) && agoraBR(d).dataBR === br.dataBR;
    });
    if (marcadoHoje) {
      const marcadoBR = agoraBR(new Date(marcadoHoje.quando));
      return json(res, 200, { ok: true, jaMarcado: true, dataBR: marcadoBR.dataBR, horaBR: marcadoBR.horaBR });
    }

    eventos.push({
      evento: "contato_manual",
      estilo: null,
      detalhes: { tipo: "Atendido", de: "botao_atendido" },
      quando: agora.toISOString()
    });
    aprendizado.eventos = eventos.slice(-50);

    const memoriaPrev = prev.memoria || {};
    const obsPrev = String(memoriaPrev.observacoes || "").trim();
    const registro = `[${br.dataBR} ${br.horaBR}] Atendido.`;
    const memoria = {
      ...memoriaPrev,
      observacoes: obsPrev ? `${obsPrev}\n${registro}` : registro
    };
    const merged = { ...prev, aprendizado, memoria };

    const { error: marcarErr } = await supabase
      .from("whatsapp_processamentos")
      .update({ resultado_analise: merged, atualizado_em: agora.toISOString() })
      .eq("id", id);
    if (marcarErr) return json(res, 500, { ok: false, error: marcarErr.message });
    return json(res, 200, { ok: true, marcado: true, dataBR: br.dataBR, horaBR: br.horaBR, quando: agora.toISOString() });
  }

  // Reagendar (mudar a data) do lembrete manualmente — rápido, sem reanalisar.
  if (body?.action === "reagendar-lembrete") {
    const dataStr = String(body?.data || ""); // formato yyyy-mm-dd do seletor de data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return json(res, 400, { ok: false, error: "Data inválida." });
    const [y, mo, d] = dataStr.split("-").map(Number);
    const anoAtual = new Date().getUTCFullYear();
    if (y < anoAtual || y > anoAtual + 5 || mo < 1 || mo > 12 || d < 1 || d > 31) {
      return json(res, 400, { ok: false, error: "Data fora do intervalo válido." });
    }
    const q = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)); // meio-dia UTC = mesma data no Brasil
    const prev = row.resultado_analise || {};
    const lembrete = { ...(prev.lembrete || {}), quando: q.toISOString(), auto: false };
    if (!lembrete.motivo) lembrete.motivo = "Retomar contato";
    const merged = { ...prev, lembrete };
    const { error: rgErr } = await supabase
      .from("whatsapp_processamentos")
      .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (rgErr) return json(res, 500, { ok: false, error: rgErr.message });
    return json(res, 200, { ok: true, reagendado: true, quando: q.toISOString() });
  }

  // Excluir o lembrete da agenda (rápido, sem reanalisar). Marca lembreteRemovido pra NÃO
  // recriar sozinho numa releitura futura — só volta se o corretor digitar uma nova nota com prazo.
  if (body?.action === "remover-lembrete") {
    const prev = row.resultado_analise || {};
    const merged = { ...prev, lembrete: null, lembreteRemovido: true };
    const { error: rmErr } = await supabase
      .from("whatsapp_processamentos")
      .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (rmErr) return json(res, 500, { ok: false, error: rmErr.message });
    return json(res, 200, { ok: true, removido: true });
  }

  // Corrige a observação/nota do corretor e CONSERTA A FONTE: troca as notas manuais
  // (source:"manual") por uma única nota consolidada com o texto editado, PRESERVA as
  // mensagens reais do cliente, e reanalisa. Usado quando o corretor edita a observação
  // (ex.: tirar info errada de um lead criado por print/manual). Assim a análise
  // ("Por quê este lead") deixa de repetir o texto antigo.
  if (body?.action === "corrigir-observacao") {
    const texto = String(body?.texto || "").trim().slice(0, 4000);
    const openaiC = getOpenAI();
    if (!openaiC) return json(res, 500, { ok: false, error: "Análise não configurada no servidor." });
    const prev = row.resultado_analise || {};
    const br = agoraBR();
    const semNotas = timeline.filter(m => m && m.source !== "manual"); // mantém mensagens do cliente
    const novaTl = semNotas.slice();
    if (texto) {
      novaTl.push({
        id: novaTl.length + 1, date: br.dataBR, time: br.horaBR, iso: new Date().toISOString(),
        author: "Atendimento (corretor)", text: texto, type: "atendimento", source: "manual", order: novaTl.length + 1
      });
    }
    if (!novaTl.length) return json(res, 400, { ok: false, error: "Sem conteúdo pra analisar (deixe ao menos uma observação)." });
    const leadC = prev.lead || {};
    const novoC = await analyzeWithBrain({ lead: leadC, timeline: novaTl, openai: openaiC, leadId: id, forcarVariacao: true });
    const mergedC = {
      ...prev, ...novoC,
      venda: prev.venda || undefined,
      memoria: { ...(prev.memoria || {}), observacoes: texto },
      aprendizado: prev.aprendizado || undefined,
      scoreAjuste: Number(prev.scoreAjuste) || 0
    };
    if (prev.lembrete && prev.lembrete.auto !== true) mergedC.lembrete = prev.lembrete; // preserva lembrete manual
    const updC = { resultado_analise: mergedC, timeline_json: novaTl, atualizado_em: new Date().toISOString() };
    const etapaC = String(row.etapa || "Novo").toLowerCase();
    if (!/vendido|perdido/.test(etapaC) && novoC?.etapaSugerida) updC.etapa = novoC.etapaSugerida;
    const { error: errC } = await supabase.from("whatsapp_processamentos").update(updC).eq("id", id);
    if (errC) return json(res, 500, { ok: false, error: errC.message });
    return json(res, 200, { ok: true, analysis: mergedC });
  }

  const novoAtendimento = String(body?.novoAtendimento || "").trim();
  const apenasSalvar = body?.apenasSalvar === true;
  // Rótulo do registro na timeline (default: atendimento do corretor, sem "tipo" presencial/ligação).
  // Permite marcar outros tipos, ex: "Mensagem enviada (WhatsApp)" quando o corretor copia a mensagem.
  const autorManual = String(body?.autorManual || "Atendimento (corretor)").slice(0, 60);
  const tipoManual = String(body?.tipoManual || "atendimento").slice(0, 30);
  if (!timeline.length && !novoAtendimento) return json(res, 400, { ok: false, error: "Lead sem timeline pra reanalisar." });

  const openai = getOpenAI();
  if (!openai && !apenasSalvar) return json(res, 500, { ok: false, error: "Análise não configurada no servidor." });

  const previous = row.resultado_analise || {};
  // Ajuste manual de score (comando "aumentar/baixar score" na observação). Soma sobre o
  // campo scoreAjuste que o app já usa no número exibido — o corretor manda no score quando quiser.
  const ajusteScorePrev = Number(previous.scoreAjuste) || 0;
  const deltaScore = novoAtendimento ? ajusteScoreDoTexto(novoAtendimento) : 0;
  const ajusteScoreNovo = Math.max(-50, Math.min(50, ajusteScorePrev + deltaScore));
  let timelineFinal = timeline;
  const observacoesBase = previous.memoria?.observacoes || "";
  let observacoesFinais = observacoesBase;
  let stampAtend = ""; // "[data hora] " do atendimento novo (pra trocar a nota crua pelo resumo da IA depois)

  // Atendimento feito fora do WhatsApp (presencial/ligação): entra na conversa e no resumo da situação.
  if (novoAtendimento) {
    const now = new Date();
    // Por padrão o registro é "agora". MAS quando vem de print de WhatsApp (histórico), a data
    // do registro é a do ÚLTIMO CONTATO lido no print — senão um histórico antigo zerava o
    // "dias parado" como se o cliente tivesse falado hoje.
    const isoEventoRaw = body?.isoEvento ? new Date(body.isoEvento) : null;
    const isoEvento = isoEventoRaw && !isNaN(isoEventoRaw.getTime()) ? isoEventoRaw : null;
    let carimbo = now;
    if (isoEvento) carimbo = isoEvento;
    else if (tipoManual === "print-whatsapp") {
      // Print sem data confiável: não zera o "parado" — herda a data do último item real da timeline.
      const prevLast = timeline[timeline.length - 1];
      const prevIso = prevLast?.iso ? new Date(prevLast.iso) : null;
      if (prevIso && !isNaN(prevIso.getTime())) carimbo = prevIso;
    }
    // Data/hora no fuso de Brasília (o servidor roda em UTC; sem isso a hora saía 3h adiantada).
    const br = agoraBR(carimbo);
    const dataBR = br.dataBR;
    const horaBR = br.horaBR;
    const ordem = timeline.length + 1;
    const itemManual = {
      id: ordem,
      date: dataBR,
      time: horaBR,
      iso: carimbo.toISOString(),
      author: autorManual,
      text: novoAtendimento.slice(0, 12000),
      type: tipoManual,
      source: "manual",
      order: ordem
    };
    // Proposta gerada: guarda o snapshot completo dos campos pra reabrir/editar depois.
    if (body?.proposta && typeof body.proposta === "object") itemManual.proposta = body.proposta;
    timelineFinal = [...timeline, itemManual];
    // Observação CRUA primeiro (SEM IA) — assim dá pra SALVAR a anotação antes de qualquer reanálise.
    stampAtend = `[${dataBR} ${horaBR}] `;
    observacoesFinais = (observacoesBase ? observacoesBase + "\n" : "") + stampAtend + novoAtendimento.slice(0, 280);
  }

  // Lembrete: NUNCA inventado. Só existe quando alguém (corretor OU cliente) escreveu
  // literalmente "agende/marque/lembre/remarque/reagende + data" — em anotação do corretor
  // OU em mensagem do cliente na timeline. A IA não infere "cliente quis agendar".
  function fazerLembrete(dias, motivo, base) {
    const q = base ? new Date(base) : new Date();
    if (isNaN(q.getTime())) return null;
    if (dias === 0) {
      const agora = new Date();
      q.setFullYear(agora.getFullYear(), agora.getMonth(), agora.getDate());
      q.setHours(Math.min(agora.getHours() + 1, 22), 0, 0, 0);
    } else {
      q.setDate(q.getDate() + dias);
      q.setHours(8, 0, 0, 0);
    }
    // Se cair no passado (ex.: mensagem antiga falando "sábado" que já passou), descarta.
    if (q.getTime() < Date.now() - 60 * 60 * 1000) return null;
    return { quando: q.toISOString(), motivo: String(motivo || "Retomar contato").slice(0, 160), auto: false };
  }
  function lembreteDaTimeline(tl) {
    if (!Array.isArray(tl)) return null;
    for (let i = tl.length - 1; i >= 0; i--) {
      const m = tl[i];
      const p = lembreteDoTexto(m?.text || "", m?.iso || null);
      if (p) {
        const lem = fazerLembrete(p.dias, p.motivo, m?.iso || null);
        if (lem) return lem;
      }
    }
    return null;
  }
  const lembreteNovo = novoAtendimento ? lembreteDoTexto(novoAtendimento, null) : null;
  function aplicarLembrete(obj) {
    if (lembreteNovo) {
      obj.lembrete = fazerLembrete(lembreteNovo.dias, lembreteNovo.motivo, null);
      obj.lembreteRemovido = false;
      return;
    }
    if (previous.lembreteRemovido) { obj.lembrete = null; return; }
    // Preserva SÓ se for lembrete posto manualmente pelo corretor (botões Hoje/Amanhã/+7...).
    // Lembretes legados marcados como auto:true (inventados pela IA antes do fix) são descartados.
    if (previous.lembrete && previous.lembrete.auto !== true) {
      obj.lembrete = previous.lembrete;
      return;
    }
    obj.lembrete = lembreteDaTimeline(timelineFinal) || null;
  }

  // Se for apenas salvar (sem reanalisar): atualiza timeline e observações, mantém análise atual.
  if (apenasSalvar) {
    // RESUMO AUTOMÁTICO da anotação ditada (free-form). O texto cru fica preservado na timeline;
    // nas Observações entra só um resumo limpo — pra o campo não virar um depósito de texto cru.
    // Só vale pra atendimento ditado; mensagem copiada/proposta/CRM/print ficam como vieram.
    if (openai && novoAtendimento && tipoManual === "atendimento") {
      try {
        const resumo = await resumirAtendimento(novoAtendimento, openai);
        if (resumo) observacoesFinais = (observacoesBase ? observacoesBase + "\n" : "") + stampAtend + resumo;
      } catch (_) { /* mantém a nota crua já montada */ }
    }
    const merged = {
      ...previous,
      memoria: { ...(previous.memoria || {}), observacoes: observacoesFinais },
      scoreAjuste: ajusteScoreNovo
    };
    aplicarLembrete(merged);
    const update = { resultado_analise: merged, atualizado_em: new Date().toISOString() };
    if (novoAtendimento) update.timeline_json = timelineFinal;
    const { error: upErr } = await supabase.from("whatsapp_processamentos").update(update).eq("id", id);
    if (upErr) return json(res, 500, { ok: false, error: upErr.message });
    return json(res, 200, { ok: true, apenasSalvar: true });
  }

  // ORDEM CORRETA: 1º SALVA a observação nova (timeline + nota crua). Só DEPOIS reanalisa.
  // Se a reanálise falhar/demorar, a anotação que o corretor digitou já está salva — não se perde.
  if (novoAtendimento) {
    const preMerged = { ...previous, memoria: { ...(previous.memoria || {}), observacoes: observacoesFinais } };
    aplicarLembrete(preMerged);
    const { error: preErr } = await supabase
      .from("whatsapp_processamentos")
      .update({ resultado_analise: preMerged, timeline_json: timelineFinal, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (preErr) return json(res, 500, { ok: false, error: preErr.message });
  }

  // 2º melhora a observação com um resumo da IA (se der) — não bloqueia: se falhar, fica a nota crua já salva.
  if (openai && novoAtendimento) {
    try {
      const resumo = await resumirAtendimento(novoAtendimento, openai);
      if (resumo) observacoesFinais = (observacoesBase ? observacoesBase + "\n" : "") + stampAtend + resumo;
    } catch (_) { /* mantém a nota crua */ }
  }

  // 3º REANALISA. Trata erro da OpenAI (limite/timeout/sobrecarga) sem derrubar a função,
  // devolvendo um motivo claro pro app — assim o lead pode ser repetido depois.
  const lead = previous.lead || {};
  let novoAnalysis;
  try {
    novoAnalysis = await analyzeWithBrain({ lead, timeline: timelineFinal, openai, leadId: id, forcarVariacao: true });
  } catch (e) {
    const msg = String(e?.message || e || "");
    const motivo = /rate|429|limit/i.test(msg) ? "Limite do provedor de análise (tente de novo)"
      : /timeout|timed out|aborted|ETIMEDOUT/i.test(msg) ? "O provedor de análise demorou demais (timeout)"
      : /quota|insufficient/i.test(msg) ? "Cota/crédito do provedor de análise esgotado"
      : ("Erro na análise: " + msg.slice(0, 120));
    return json(res, 502, { ok: false, error: motivo });
  }
  if (!novoAnalysis || typeof novoAnalysis !== "object") {
    return json(res, 502, { ok: false, error: "A análise não retornou resultado (tente de novo)." });
  }
  // analyzeWithBrain captura erros internamente e retorna mode:'erro_api' em vez de lançar.
  // Se a análise falhou E não há mensagens anteriores pra preservar, retorna erro pro app.
  if (novoAnalysis.mode === 'erro_api') {
    const msgAntigasExistem = previous.messages && (previous.messages.a || previous.messages.b || previous.messages.c);
    if (!msgAntigasExistem) {
      return json(res, 502, { ok: false, error: novoAnalysis.error || "O provedor de análise não conseguiu gerar a análise agora. Tente de novo." });
    }
  }

  // Atualiza o conhecimento geral do corretor com o que foi ensinado nessa conversa.
  const tlTextPraAprendizado = timelineFinal.map(m => `[${m.author || ""}]: ${m.text || ""}`).join("\n");
  atualizarConhecimentoCorretor(tlTextPraAprendizado, openai).catch(() => {});

  // Re-lê o estado ATUAL do banco antes de salvar. Armazena updated_at para
  // o optimistic lock no UPDATE: se outra reanálise gravou antes, essa não sobrescreve.
  const { data: freshRow } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise, updated_at")
    .eq("id", id)
    .single();
  const freshPrevious = freshRow?.resultado_analise || previous;

  // Preserva venda/aprendizado; memória recebe o novo atendimento no resumo de observações.
  const msgAntigasValidas = !freshPrevious.sugestoesPendentes &&
    freshPrevious.messages && (freshPrevious.messages.a || freshPrevious.messages.b || freshPrevious.messages.c);
  const merged = {
    ...freshPrevious,
    ...novoAnalysis,
    venda: freshPrevious.venda || undefined,
    memoria: { ...(freshPrevious.memoria || {}), observacoes: observacoesFinais },
    aprendizado: freshPrevious.aprendizado || undefined,
    scoreAjuste: ajusteScoreNovo,
    reanalisadoEm: new Date().toISOString() // quando a IA reanalisou pela última vez (≠ "última atualização", que é edição)
  };
  // Se a nova análise falhou em gerar mensagens mas havia mensagens anteriores válidas,
  // preserva as mensagens antigas para não apagar o que já funcionou.
  if (novoAnalysis.sugestoesPendentes === true && msgAntigasValidas) {
    merged.messages = freshPrevious.messages;
    merged.sugestoesPendentes = false;
    merged.aprovada = freshPrevious.aprovada;
    merged.arquiteturaMensagens = freshPrevious.arquiteturaMensagens;
  }
  // Marca aprovada=true quando a análise gerou as 3 mensagens com conteúdo.
  const m = merged.messages || {};
  if (!merged.sugestoesPendentes && m.a && m.b && m.c) {
    merged.aprovada = true;
  }
  aplicarLembrete(merged);

  // Reanálise PURA (sem atendimento novo) NÃO mexe na "última atualização": é só recálculo da
  // IA — o corretor não incluiu/editou nada. Só carimba atualizado_em quando há atendimento real.
  const update = { resultado_analise: merged };
  if (novoAtendimento) { update.timeline_json = timelineFinal; update.atualizado_em = new Date().toISOString(); }
  // Quem decide etapa é a IA (a partir da conversa real). A etapa antiga importada do CRM é
  // ignorada — mas estados finais marcados pelo corretor são preservados: "Vendido" (marcou venda)
  // e "Perdido" (descartou explicitamente). Esses só saem por ação manual (Reabrir / Marcar venda).
  const etapaAtual = String(row.etapa || "Novo").toLowerCase();
  const ehFinalCorretor = /vendido|perdido/.test(etapaAtual);
  if (!ehFinalCorretor && novoAnalysis?.etapaSugerida) update.etapa = novoAnalysis.etapaSugerida;
  const freshUpdatedAt = freshRow?.updated_at;
  const updateQuery = supabase.from("whatsapp_processamentos").update(update).eq("id", id);
  // Optimistic lock: só grava se ninguém atualizou a linha desde a releitura.
  const finalQuery = freshUpdatedAt ? updateQuery.eq("updated_at", freshUpdatedAt) : updateQuery;
  const { data: updatedRows, error: putErr } = await finalQuery.select("id");
  if (putErr) return json(res, 500, { ok: false, error: putErr.message });
  // Se 0 linhas atualizadas, outra reanálise ganhou — retorna sucesso com os dados calculados.
  if (!updatedRows || updatedRows.length === 0) {
    return json(res, 200, { ok: true, analysis: merged });
  }

  return json(res, 200, { ok: true, analysis: merged });
}
