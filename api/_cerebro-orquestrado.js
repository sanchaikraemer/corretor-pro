import { modeloOrquestrador } from "./_pipeline.js";

// =============================================================================
// Cérebro Orquestrado — Responses API + orquestração de ferramentas
// =============================================================================
// EXPERIMENTAL e DESLIGADO por padrão. Só roda quando CEREBRO_ORQUESTRADO === "1".
//
// Ideia (vinda do cookbook da OpenAI "responses_api_tool_orchestration"):
// em vez de despejar o catálogo INTEIRO + memória + tudo no prompt da análise,
// a IA ESCOLHE sozinha quais ferramentas chamar pra reunir SÓ o contexto relevante
// desta conversa:
//   1. buscar_imovel               -> empreendimentos da Senger que entram em jogo
//   2. consultar_memoria_lead      -> memória/aprendizado deste (ou outro) lead
//   3. buscar_atendimentos_parecidos -> casos passados parecidos que ensinam algo
//
// FAIL-SAFE ABSOLUTO: qualquer erro/ausência de dado -> retorna null e o pipeline
// segue exatamente como antes (caminho atual intocado). Esta v1 é ADITIVA: ela só
// ACRESCENTA um bloco de destaque ao prompt, nunca remove o catálogo atual — então
// a qualidade só pode melhorar, nunca piorar. Trocar o catálogo cheio pelo enxuto
// (pra economizar) fica pra uma versão futura, depois de validado no app real.
// =============================================================================

const DATA_URL = "https://raw.githubusercontent.com/direcionacorretor/tabelasenger/main/data.js";
let _empCache = { ts: 0, emps: null };

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Extrai EMPREENDIMENTOS e META do source data.js sem executar código remoto.
function parseSengerDataJs(code) {
  function extractValue(src, fromIdx, openCh, closeCh) {
    const start = src.indexOf(openCh, fromIdx);
    if (start < 0) return null;
    let depth = 0, inStr = false, strCh = '';
    for (let i = start; i < src.length; i++) {
      const c = src[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }
        if (c === strCh) inStr = false;
      } else if (c === '"' || c === "'") { inStr = true; strCh = c; }
      else if (c === openCh) { depth++; }
      else if (c === closeCh) { if (--depth === 0) return src.slice(start, i + 1); }
    }
    return null;
  }
  let emps = [], meta = {};
  const empM = /\bEMPREENDIMENTOS\s*=\s*\[/.exec(code);
  if (empM) { const raw = extractValue(code, empM.index, '[', ']'); if (raw) try { emps = JSON.parse(raw); } catch (_) {} }
  const metaM = /\bMETA\s*=\s*\{/.exec(code);
  if (metaM) { const raw = extractValue(code, metaM.index, '{', '}'); if (raw) try { meta = JSON.parse(raw); } catch (_) {} }
  return { EMPREENDIMENTOS: emps, META: meta };
}

// Carrega a lista ESTRUTURADA de empreendimentos (não o texto). Mesmo data.js que o
// catálogo do pipeline usa; cache 24h. Em caso de falha, devolve [] (orquestração
// simplesmente não destaca imóvel — o catálogo cheio do pipeline continua valendo).
async function loadEmpreendimentosRaw() {
  const TTL = 24 * 60 * 60 * 1000;
  if (_empCache.emps && (Date.now() - _empCache.ts) < TTL) return _empCache.emps;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 6000);
  try {
    const resp = await fetch(DATA_URL, { signal: ctrl.signal });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const code = await resp.text();
    const SENGER = parseSengerDataJs(code);
    const emps = (SENGER && SENGER.EMPREENDIMENTOS) || [];
    if (emps.length) _empCache = { ts: Date.now(), emps };
    return emps;
  } catch (e) {
    console.warn("[direciona] orquestrador: catálogo estruturado falhou:", e?.message || e);
    return _empCache.emps || [];
  } finally {
    clearTimeout(to);
  }
}

// Faixa de valor de referência de um empreendimento (mesma heurística do pipeline).
function faixaDe(emp) {
  const vals = [];
  const scan = (o, prof) => {
    if (!o || typeof o !== "object" || prof > 5) return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (Array.isArray(v)) v.forEach(x => scan(x, prof + 1));
      else if (v && typeof v === "object") scan(v, prof + 1);
      else if (/valor|pre[cç]o|price/i.test(k)) {
        let t = String(v).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
        const n = parseFloat(t);
        if (isFinite(n) && n >= 50000 && n <= 50000000) vals.push(n);
      }
    }
  };
  scan(emp, 0);
  if (!vals.length) return "";
  const fmt = (n) => n >= 1000000 ? "R$" + (n / 1000000).toFixed(2).replace(".", ",") + "mi" : "R$" + Math.round(n / 1000) + "k";
  const min = Math.min(...vals), max = Math.max(...vals);
  return min === max ? `ref. ${fmt(min)}` : `ref. ${fmt(min)}–${fmt(max)}`;
}

function ehPronto(e) {
  return /pronto/i.test(String(e.status || "") + " " + String(e.statusLabel || ""));
}

function resumoEmp(e) {
  return {
    nome: e.nome || "",
    cidade: e.cidade || "",
    status: e.statusLabel || e.status || "",
    pronto: ehPronto(e),
    entrega: e.entrega && !/pronto/i.test(e.entrega) ? e.entrega : "",
    faixa: faixaDe(e),
    pagamento: ehPronto(e) ? "financiamento bancário" : "parcelamento direto com a construtora"
  };
}

// ---- Executores das ferramentas -------------------------------------------

function buscarImovelExec(args, emps) {
  const termo = norm(args?.termo);
  const cidade = norm(args?.cidade);
  const status = norm(args?.status);
  const palavras = termo.split(/\s+/).filter(Boolean);
  const score = (e) => {
    let s = 0;
    const nome = norm(e.nome);
    const cid = norm(e.cidade);
    const stat = norm(e.status) + " " + norm(e.statusLabel);
    if (termo && nome.includes(termo)) s += 5;
    for (const p of palavras) if (p && nome.includes(p)) s += 1;
    if (cidade && cid.includes(cidade)) s += 2;
    if (status && stat.includes(status)) s += 2;
    return s;
  };
  const temFiltro = !!(termo || cidade || status);
  let lista = emps.map(e => ({ e, s: score(e) }));
  if (temFiltro) lista = lista.filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  const max = Math.max(1, Math.min(8, Number(args?.max) || 5));
  return lista.slice(0, max).map(x => resumoEmp(x.e));
}

async function consultarMemoriaExec(args, fallbackLeadId) {
  try {
    const { getSupabaseAdmin } = await import("./_persistence.js");
    const supabase = getSupabaseAdmin();
    const id = args?.leadId || fallbackLeadId;
    if (!supabase || !id) return null;
    const { data } = await supabase
      .from("whatsapp_processamentos")
      .select("resultado_analise")
      .eq("id", id)
      .maybeSingle();
    const r = data?.resultado_analise || {};
    if (!r.memoria && !r.aprendizado) return null;
    return { memoria: r.memoria || null, aprendizado: r.aprendizado || null };
  } catch (_) {
    return null;
  }
}

async function buscarParecidosExec(args, excludeId) {
  try {
    const { getSupabaseAdmin } = await import("./_persistence.js");
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];
    const { data } = await supabase
      .from("whatsapp_processamentos")
      .select("id, nome_arquivo, etapa, resultado_analise, atualizado_em")
      .order("atualizado_em", { ascending: false })
      .limit(150);
    const rows = Array.isArray(data) ? data : [];
    const produto = norm(args?.produto);
    const etapa = norm(args?.etapa);
    const termo = norm(args?.termo);
    const score = (row) => {
      if (excludeId && row.id === excludeId) return -1;
      const r = row.resultado_analise || {};
      const prod = norm(r.produtoInteresse) + " " + (Array.isArray(r.produtosInteresse) ? r.produtosInteresse.map(norm).join(" ") : "");
      const et = norm(row.etapa) + " " + norm(r.etapaSugerida);
      const objs = Array.isArray(r.objections) ? norm(r.objections.join(" ")) : "";
      let s = 0;
      if (produto && prod.includes(produto)) s += 4;
      if (etapa && et.includes(etapa)) s += 2;
      for (const p of termo.split(/\s+/).filter(Boolean)) if (p && (prod.includes(p) || objs.includes(p))) s += 1;
      // Só vale como "parecido" se tiver alguma lição/aprendizado pra ensinar.
      const temLicao = (r.aprendizado && (r.aprendizado.licao || r.aprendizado.oQueMudou)) || r.nextAction;
      if (!temLicao) s -= 1;
      return s;
    };
    const max = Math.max(1, Math.min(5, Number(args?.max) || 3));
    return rows
      .map(row => ({ row, s: score(row) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, max)
      .map(({ row }) => {
        const r = row.resultado_analise || {};
        return {
          produto: r.produtoInteresse || "",
          etapa: row.etapa || r.etapaSugerida || "",
          objecoes: Array.isArray(r.objections) ? r.objections.slice(0, 2) : [],
          licao: (r.aprendizado && r.aprendizado.licao) || "",
          resultado: (r.aprendizado && r.aprendizado.oQueMudou) || (r.aprendizado && r.aprendizado.evoluiu) || ""
        };
      });
  } catch (_) {
    return [];
  }
}

// ---- Definição das ferramentas (formato Responses API) ---------------------

const TOOLS = [
  {
    type: "function",
    name: "buscar_imovel",
    description: "Pesquisa no catálogo da Construtora Senger os empreendimentos que combinam com o que o cliente quer. Use quando o cliente mencionar um imóvel, uma cidade, faixa de preço, tipo (apartamento/terreno) ou pedir 'outras opções'.",
    parameters: {
      type: "object",
      properties: {
        termo: { type: "string", description: "nome ou característica citada (ex.: 'Renaissance', 'terreno', '2 dormitórios', 'pronto pra morar')" },
        cidade: { type: "string", description: "cidade citada, se houver (ex.: 'Carazinho', 'Ibirubá')" },
        status: { type: "string", description: "'pronto' ou 'planta', se relevante pro caso" },
        max: { type: "integer", description: "quantos empreendimentos trazer (1 a 8). Padrão 5." }
      },
      required: []
    }
  },
  {
    type: "function",
    name: "consultar_memoria_lead",
    description: "Busca a memória comercial e o aprendizado já guardados de um lead. Use pra resgatar preferências, quem decide e pontos sensíveis registrados em atendimentos anteriores deste cliente.",
    parameters: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "id do lead. Se omitir, usa o lead da conversa atual." }
      },
      required: []
    }
  },
  {
    type: "function",
    name: "buscar_atendimentos_parecidos",
    description: "Procura atendimentos PASSADOS parecidos com este (mesmo empreendimento, mesma etapa ou mesma objeção) que tenham uma lição útil. Use pra se inspirar no que já deu certo ou errado em casos semelhantes.",
    parameters: {
      type: "object",
      properties: {
        produto: { type: "string", description: "empreendimento em jogo (ex.: 'Renaissance')" },
        etapa: { type: "string", description: "etapa do funil (ex.: 'Negociação', 'Visita/Proposta')" },
        termo: { type: "string", description: "objeção ou tema central (ex.: 'preço', 'financiamento', 'cônjuge decide')" },
        max: { type: "integer", description: "quantos casos trazer (1 a 5). Padrão 3." }
      },
      required: []
    }
  }
];

// ---- Montagem do bloco final pra injetar no prompt da análise --------------

function formatarBloco(coletado) {
  const partes = [];

  // 1) Empreendimentos em destaque (foco): o que a IA julgou relevante AGORA.
  const vistos = new Set();
  const imoveis = [];
  for (const im of coletado.imoveis) {
    const chave = norm(im.nome);
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    imoveis.push(im);
  }
  if (imoveis.length) {
    const linhas = imoveis.slice(0, 6).map(im => {
      const cid = im.cidade ? ` (${im.cidade})` : "";
      const ent = im.entrega ? ` · ${im.entrega}` : "";
      const fx = im.faixa ? ` · ${im.faixa}` : "";
      return `  • ${im.nome}${cid} — ${im.status}${ent}${fx} · pagamento: ${im.pagamento}`;
    });
    partes.push("EMPREENDIMENTOS EM DESTAQUE NESTA CONVERSA (a IA selecionou os mais relevantes — priorize estes ao orientar; o catálogo completo acima continua valendo pra 'outras opções'):\n" + linhas.join("\n"));
  }

  // 2) Memória resgatada do lead (se a ferramenta trouxe algo a mais).
  if (coletado.memoria && (coletado.memoria.memoria || coletado.memoria.aprendizado)) {
    const m = coletado.memoria.memoria || {};
    const campos = [];
    if (m.preferencias) campos.push(`preferências: ${m.preferencias}`);
    if (m.pessoasDecisao) campos.push(`quem decide: ${m.pessoasDecisao}`);
    if (m.pontosSensiveis) campos.push(`pontos sensíveis: ${m.pontosSensiveis}`);
    if (m.faixaValor) campos.push(`faixa de valor: ${m.faixaValor}`);
    if (campos.length) partes.push("MEMÓRIA RESGATADA DO LEAD:\n  " + campos.join(" · "));
  }

  // 3) Atendimentos parecidos (capacidade nova — aprendizado por similaridade).
  if (coletado.parecidos && coletado.parecidos.length) {
    const linhas = coletado.parecidos.slice(0, 3).map(p => {
      const ctx = [p.produto, p.etapa].filter(Boolean).join(" · ");
      const licao = p.licao ? ` Lição: ${p.licao}` : "";
      const res = p.resultado ? ` (${p.resultado})` : "";
      return `  • ${ctx || "caso anterior"}${res}.${licao}`;
    });
    partes.push("ATENDIMENTOS PASSADOS PARECIDOS (aprenda com eles, mas baseie a orientação SÓ nesta conversa — não misture fatos de outro cliente):\n" + linhas.join("\n"));
  }

  if (!partes.length) return "";
  return "CONTEXTO REUNIDO PELO CÉREBRO ORQUESTRADO (a IA escolheu sozinha o que buscar):\n\n" + partes.join("\n\n");
}

// ---- Orquestrador principal ------------------------------------------------

export async function montarContextoOrquestrado({ openai, leadId, timelineText, lead }) {
  if (!openai) return null;
  try {
    const emps = await loadEmpreendimentosRaw();
    const model = modeloOrquestrador();
    const nome = (lead && (lead.clientName || lead.nome)) || "cliente";
    const instrucoes = `Você PREPARA o contexto pro Cérebro Comercial analisar uma conversa de WhatsApp de um corretor da Construtora Senger (Carazinho e Ibirubá/RS). Sua ÚNICA tarefa é usar as ferramentas pra reunir SÓ o que é relevante PARA ESTA conversa: quais empreendimentos da Senger entram em jogo, a memória deste lead e atendimentos passados parecidos que ensinem algo. Chame as ferramentas que fizerem sentido (pode chamar mais de uma). NÃO escreva análise, diagnóstico nem mensagens — quando terminar de reunir, responda apenas "ok".`;
    const input = [
      { role: "system", content: instrucoes },
      { role: "user", content: `Lead: ${nome}\n\nConversa (mais recente importa mais):\n${String(timelineText || "").slice(0, 12000)}` }
    ];

    const coletado = { imoveis: [], memoria: null, parecidos: [], chamadas: [] };

    let resp = await openai.responses.create({ model, input, tools: TOOLS, parallel_tool_calls: true });

    let guard = 0;
    while (guard++ < 4) {
      const calls = (resp.output || []).filter(o => o && o.type === "function_call");
      if (!calls.length) break;
      for (const call of calls) {
        let args = {};
        try { args = JSON.parse(call.arguments || "{}"); } catch (_) { args = {}; }
        let out;
        if (call.name === "buscar_imovel") {
          out = emps.length ? buscarImovelExec(args, emps) : [];
          coletado.imoveis.push(...(Array.isArray(out) ? out : []));
        } else if (call.name === "consultar_memoria_lead") {
          out = await consultarMemoriaExec(args, leadId);
          if (out) coletado.memoria = out;
        } else if (call.name === "buscar_atendimentos_parecidos") {
          out = await buscarParecidosExec(args, leadId);
          coletado.parecidos.push(...(Array.isArray(out) ? out : []));
        } else {
          out = null;
        }
        coletado.chamadas.push(call.name);
        input.push(call);
        input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(out ?? null).slice(0, 4000) });
      }
      resp = await openai.responses.create({ model, input, tools: TOOLS, parallel_tool_calls: true });
    }

    const bloco = formatarBloco(coletado);
    if (!bloco) return null;
    return { bloco, chamadas: coletado.chamadas };
  } catch (e) {
    console.warn("[direciona] contexto orquestrado falhou, usando caminho padrão:", e?.message || e);
    return null;
  }
}

// Exportados pra teste estático (não dependem de rede nem da OpenAI).
export const __test = { buscarImovelExec, formatarBloco, faixaDe, resumoEmp, TOOLS };
