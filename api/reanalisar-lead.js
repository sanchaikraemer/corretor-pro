import { requireApiKey } from "./_persistence.js";
import { getSupabaseAdmin } from "./_persistence.js";
import { analyzeWithBrain, getOpenAI, resumirAtendimento, atualizarConhecimentoCorretor, finalizarAnaliseComercialV674 } from "./_pipeline.js";

function textoLimpo(v) { return String(v || "").trim(); }
function primeiroNomeLeadLocal(lead) { return textoLimpo(lead?.name).split(/\s+/)[0] || ""; }
function produtoLeadLocal(lead, analysis) {
  return textoLimpo(analysis?.modeloComercial?.oportunidade?.produto || lead?.product || analysis?.product || "o imóvel") || "o imóvel";
}
function garantirMensagensV682(analysis, lead) {
  const out = (analysis && typeof analysis === "object") ? analysis : {};
  const mc = out.modeloComercial || {};
  const semAcao = mc?.acao?.status === "sem-acao-urgente";
  if (semAcao) return out;
  const m = (out.messages && typeof out.messages === "object") ? out.messages : {};
  const tem = textoLimpo(m.a || m.direta || m.melhor || m.mensagem || out?.diagnostico?.mensagemQueEuEnviariaHoje || out?.mensagemIdealHoje);
  if (tem && textoLimpo(m.a) && textoLimpo(m.b) && textoLimpo(m.c)) {
    out.arquiteturaMensagens = out.arquiteturaMensagens || "gpt55-unificado-v2";
    out.sugestoesPendentes = false;
    out.aprovada = true;
    return out;
  }
  const nome = primeiroNomeLeadLocal(lead);
  const produto = produtoLeadLocal(lead, out);
  const acao = textoLimpo(mc?.acao?.descricao || out.nextAction || out?.diagnostico?.proximaAcao);
  const prefixo = nome ? `${nome}, ` : "";
  const diag = out?.diagnostico || {};
  const memoria = out?.memoriaSugerida || {};
  const perfil = textoLimpo(memoria?.perfil || diag?.percepcaoTodaConversa || (Array.isArray(diag?.sabemos) ? diag.sabemos.join(", ") : ""));
  const compromisso = textoLimpo(diag?.ultimoCompromissoCliente);
  const entregue = textoLimpo(diag?.ultimaInformacaoPrometida);
  const temVideoFotos = /v[ií]deo|foto|imagem|material|proposta|simula[cç][aã]o/i.test(`${entregue} ${acao}`);
  const temDecisor = /espos|marid|fam[ií]lia|filh|s[oó]ci|dire[cç][aã]o/i.test(`${compromisso} ${perfil}`);
  const perfilCurto = /100|110|ampl|pronto|su[ií]te|financi|parcel|entrada|moradia|invest/i.test(perfil) ? perfil : "o perfil que você comentou";
  const gancho = temVideoFotos ? `Conseguiu ver o material que te enviei${temDecisor ? " e conversar com quem decide junto com você" : ""}?` : `Conseguiu avaliar essa opção com calma?`;
  const encaixe = produto && produto !== "o imóvel" ? `Como o ${produto} entra bem nesse perfil, queria entender se ele ficou dentro do que vocês procuram` : `Queria entender se essa opção ficou dentro do que vocês procuram`;
  const fallbackA = textoLimpo(m.a || m.direta || out?.diagnostico?.mensagemQueEuEnviariaHoje || out?.mensagemIdealHoje) || `${prefixo}tudo bem? ${gancho} ${encaixe} ou se vale eu separar outras opções compatíveis para compararmos melhor.`;
  out.messages = {
    ...m,
    a: fallbackA,
    b: textoLimpo(m.b || m.consultiva) || `${prefixo}tudo bem? Olhei novamente para ${perfilCurto} e o ${produto} continua sendo uma opção forte para comparar. Vocês conseguiram avaliar o material que enviei?`,
    c: textoLimpo(m.c || m.retomada) || `${prefixo}tudo bem? Antes de eu separar novas opções, queria só confirmar a reação de vocês ao ${produto}. Se ele não encaixou, eu já busco alternativas no mesmo padrão.`,
    aLabel: textoLimpo(m.aLabel) || "Retomar pelo combinado",
    bLabel: textoLimpo(m.bLabel) || "Confirmar reação",
    cLabel: textoLimpo(m.cLabel) || "Comparar sem perder",
    recomendada: ["a", "b", "c"].includes(textoLimpo(m.recomendada)) ? m.recomendada : "a"
  };
  out.arquiteturaMensagens = "gpt55-unificado-v2";
  out.sugestoesPendentes = false;
  out.aprovada = true;
  out.validacaoSugestoes = Array.isArray(out.validacaoSugestoes) ? out.validacaoSugestoes : [];
  return out;
}
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

function limparParaJson702(value, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === "bigint") return String(value);
  if (typeof value === "function") return undefined;
  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[referencia-circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map(v => limparParaJson702(v, seen));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const safe = limparParaJson702(v, seen);
    if (safe !== undefined) out[k] = safe;
  }
  seen.delete(value);
  return out;
}

function json(res, status, payload) {
  const body = limparParaJson702(payload || {});
  const code = Number(status) || (body?.ok === false ? 500 : 200);
  try {
    if (typeof res.status === "function") res.status(code);
    else res.statusCode = code;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify(body));
  } catch (e) {
    try {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.end(JSON.stringify({ ok:false, error:"Falha ao serializar resposta da API.", detail:String(e?.message || e) }));
    } catch (_) {
      return;
    }
  }
}



// Atualização #686-3 — IA incremental/custo: assinatura estável da timeline,
// reuso de análise quando nada mudou e compactação segura de histórico gigante para o provedor.
function hashTexto6863(str) {
  let h = 2166136261;
  const txt = String(str || "");
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
function assinaturaTimeline6863(timeline) {
  const arr = Array.isArray(timeline) ? timeline : [];
  const base = arr.map((m) => [m?.iso || m?.date || "", m?.time || "", m?.author || "", m?.text || m?.body || ""].join("|")).join("\n");
  return { hash: hashTexto6863(base), total: arr.length };
}
function analiseEstaUtil6863(a) {
  return !!(a && typeof a === "object" && a.messages && (a.messages.a || a.messages.b || a.messages.c) && a.iaComercialV2);
}
function compactarTimelineParaIA6863(timeline, previous, novoAtendimento) {
  const arr = Array.isArray(timeline) ? timeline : [];
  const limite = 140;
  if (arr.length <= limite) return arr;
  const resumo = String(previous?.summary || previous?.diagnostico?.resumo || previous?.memoria?.observacoes || "").trim();
  const eventos = Array.isArray(previous?.aprendizado?.eventos) ? previous.aprendizado.eventos.slice(-12) : [];
  const venda = previous?.venda ? `Venda registrada: ${JSON.stringify(previous.venda).slice(0, 700)}` : "";
  const perda = previous?.perda ? `Perda registrada: ${JSON.stringify(previous.perda).slice(0, 700)}` : "";
  const sintese = [
    resumo ? `Resumo comercial anterior: ${resumo.slice(0, 1800)}` : "Resumo comercial anterior indisponível.",
    previous?.clientProfile ? `Perfil já identificado: ${String(previous.clientProfile).slice(0, 700)}` : "",
    previous?.nextAction ? `Próxima ação anterior: ${String(previous.nextAction).slice(0, 500)}` : "",
    venda,
    perda,
    eventos.length ? `Últimos eventos internos: ${eventos.map(e => `${e.evento || "evento"} em ${e.quando || ""}`).join("; ").slice(0, 900)}` : ""
  ].filter(Boolean).join("\n");
  const head = [{ id: "resumo-incremental-6863", author: "Resumo anterior do sistema", text: sintese, type: "resumo", source: "incremental", iso: new Date().toISOString() }];
  const tail = arr.slice(-(novoAtendimento ? 100 : 120));
  return head.concat(tail);
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


function normalizarTextoV684(v) {
  return String(v || "").trim();
}
function textoTimelineV684(timeline) {
  return (Array.isArray(timeline) ? timeline : [])
    .map(m => `${m?.author || ""}: ${m?.text || m?.body || ""}`)
    .join("\n")
    .toLowerCase();
}
function enriquecerIAComercialV684(analysis, lead, timeline) {
  const out = (analysis && typeof analysis === "object") ? analysis : {};
  const txt = textoTimelineV684(timeline);
  const diag = (out.diagnostico && typeof out.diagnostico === "object") ? out.diagnostico : {};
  const lc = (out.leituraComercial && typeof out.leituraComercial === "object") ? out.leituraComercial : {};
  const ac = (out.analiseComercial && typeof out.analiseComercial === "object") ? out.analiseComercial : {};
  const mem = (out.memoria && typeof out.memoria === "object") ? out.memoria : {};
  const sinais = [];
  const alertas = [];
  const tem = (re) => re.test(txt);
  if (tem(/financi|caixa|fgts|entrada|parcela|simula|aprova|cr[eé]dito/)) sinais.push("Existe sinal financeiro na conversa: financiamento, entrada, parcela, FGTS ou simulação.");
  if (tem(/visita|decorado|conhecer|ver o im[oó]vel|café|construtora|plant[aã]o/)) sinais.push("Existe sinal de avanço prático: visita, café, decorado ou ida à construtora.");
  if (tem(/proposta|valor final|desconto|reserva|unidade|box|vaga|contraproposta/)) sinais.push("Existe sinal de negociação: proposta, unidade, vaga, reserva, desconto ou contraproposta.");
  if (tem(/gostei|interesse|me interessa|quero|combina|perfeito|vamos/)) sinais.push("Existe sinal verbal de interesse real no produto ou na continuidade.");
  if (tem(/vou pensar|vou analisar|te aviso|te retorno|qualquer coisa|mais pra frente|semana que vem|m[eê]s que vem/)) alertas.push("A probabilidade de venda cai quando o cliente pede tempo, deixa retorno em aberto ou empurra a decisão.");
  if (tem(/caro|alto|n[aã]o cabe|fora do orçamento|parcel(a|as).*pesad|entrada.*alta/)) alertas.push("Objeção de preço ou capacidade de pagamento aparece como trava provável.");
  if (tem(/concorr|outro empreendimento|outra construtora|tamb[eé]m estou vendo|comparando/)) alertas.push("Cliente está comparando alternativas; abordagem precisa defender diferencial, não só preço.");

  const objetivo = normalizarTextoV684(diag.objetivo || ac.produtoPrincipalInteresse || lead?.product || out.product || "produto ainda pouco definido");
  const etapa = normalizarTextoV684(diag.etapa || ac.etapaFunil || lc.etapa || out.stage || "etapa não definida");
  const perfil = (() => {
    if (tem(/morar|moradia|fam[ií]lia|esposa|marido|filho|casa pr[oó]pria|apartamento para morar|quero morar/)) return "moradia: tende a decidir por segurança, conforto, localização, planta e encaixe financeiro";
    if (tem(/corretor|cliente meu|meu cliente|parceir/)) return "intermediador/parceiro: precisa de informação objetiva para levar ao cliente final";
    if (tem(/invest|alugar|renda|valoriza|liquidez|rentabilidade/)) return "investidor: tende a responder melhor a rentabilidade, liquidez, prazo e valorização";
    if (tem(/quanto|valor|tabela|preço|preco|condi[cç][aã]o/) && !tem(/visita|proposta|simula/)) return "pesquisador inicial: ainda está coletando preço e precisa ser qualificado";
    return normalizarTextoV684(out.clientProfile) || "perfil ainda em leitura; continuar qualificando sem pressionar";
  })();

  const riscoPerda = (() => {
    let score = 25;
    const fatores = [];
    const protecao = [];
    if (alertas.length) { score += 20; fatores.push(...alertas.slice(0, 3)); }
    if (tem(/concorr|comparando|outra construtora/)) { score += 15; fatores.push("cliente indica comparação com outras opções; precisa reforçar diferencial real"); }
    if (tem(/proposta|visita|simula|reserva|contraproposta/)) { score -= 12; protecao.push("há avanço prático na conversa: proposta, visita, simulação, reserva ou contraproposta"); }
    if (tem(/gostei|quero|vamos|me interessa|perfeito|pode ser/)) { score -= 8; protecao.push("há sinal verbal positivo de interesse ou continuidade"); }
    if (tem(/aguardo|me manda|envia|simula|montar|confirmar/)) protecao.push("existe pendência clara que permite uma retomada objetiva");
    score = Math.max(5, Math.min(95, score));
    const nivel = score >= 70 ? "alto" : score >= 45 ? "médio" : "baixo";
    const explicacao = fatores.length
      ? `Probabilidade afetada porque ${fatores[0].replace(/\.$/, "")}.`
      : protecao.length
        ? `Probabilidade protegida por sinais de avanço e uma pendência objetiva para retomar.`
        : `Probabilidade calculada pela etapa atual, engajamento e ausência de sinais negativos fortes.`;
    return { percentual: score, nivel, motivo: explicacao, explicacao, fatores: fatores.slice(0, 4), protecao: protecao.slice(0, 4) };
  })();

  const proximaAcao = normalizarTextoV684(
    lc.oQueDestravar || diag.proximaAcaoCorreta || ac.proximaAcaoCorreta || out.nextAction || out.melhorPergunta ||
    "fazer uma pergunta objetiva para destravar o próximo passo comercial"
  );
  const produto = normalizarTextoV684(ac.produtoPrincipalInteresse || out.produtoInteresse || lead?.product || out.product || "produto mais aderente ao perfil demonstrado");
  const estrategia = (() => {
    if (/financeir|entrada|parcela|fgts|simula/i.test(proximaAcao + " " + txt)) return "conduzir por viabilidade financeira: confirmar entrada, parcela confortável e prazo antes de empurrar produto";
    if (/visita|conhecer|café|decorado/i.test(proximaAcao + " " + txt)) return "conduzir para compromisso prático: visita, café ou apresentação objetiva do produto";
    if (/compar|concorr/i.test(txt)) return "comparar com segurança: destacar diferencial real do produto sem desvalorizar concorrente";
    return "retomar com contexto específico da conversa e uma pergunta principal, sem mensagem genérica";
  })();

  const interesse = Math.max(20, Math.min(100, 45 + sinais.length * 12 - alertas.length * 5));
  const engajamento = Math.max(15, Math.min(100, 40 + (tem(/respondeu|entendi|ok|sim|gostei|quero|vamos/) ? 20 : 0) + sinais.length * 8));
  const financeiro = Math.max(15, Math.min(100, tem(/financi|fgts|entrada|parcela|simula|cr[eé]dito/) ? 78 : 42));
  const urgencia = Math.max(10, Math.min(100, tem(/hoje|amanh|essa semana|urgente|preciso|quando/) ? 72 : 38));
  const indiceTotal = Math.round((interesse * 0.32) + (engajamento * 0.25) + (financeiro * 0.23) + (urgencia * 0.10) + ((100-riscoPerda.percentual) * 0.10));
  const confianca = Math.max(35, Math.min(98, 45 + Math.min(30, (Array.isArray(timeline)?timeline.length:0) / 4) + sinais.length * 5 + (produto && produto !== "produto mais aderente ao perfil demonstrado" ? 8 : 0)));
  const motivoProximaAcao = /financeir|entrada|parcela|fgts|simula|par[aâ]metro/i.test(proximaAcao + " " + txt)
    ? "a conversa está travada em viabilidade financeira; confirmar parâmetros evita enviar opção fora do perfil"
    : /visita|café|conhecer|decorado/i.test(proximaAcao + " " + txt)
      ? "há sinais suficientes para transformar interesse em compromisso prático"
      : alertas.length
        ? "a probabilidade de venda cai se a retomada não usar o último ponto concreto da conversa"
        : "é o próximo passo mais direto com base no estágio e nas pendências identificadas";
  out.iaComercialV2 = {
    versao: "684-final",
    perfilCliente: perfil,
    etapaComercial: etapa,
    mudancaComportamento: alertas.length ? "Atenção: a conversa mostra sinais de esfriamento, comparação ou trava financeira. A retomada precisa ser precisa e com próximo passo claro." : "Sem mudança negativa clara; manter avanço pelo último ponto concreto da conversa.",
    riscoPerda,
    probabilidadeVenda: { percentual: Math.max(0, Math.min(100, 100 - riscoPerda.percentual)), nivel: (100 - riscoPerda.percentual) >= 80 ? "muito alta" : (100 - riscoPerda.percentual) >= 65 ? "alta" : (100 - riscoPerda.percentual) >= 45 ? "média" : "baixa", explicacao: riscoPerda.explicacao },
    proximaAcaoIdeal: proximaAcao,
    motivoProximaAcao,
    produtoMaisAdequado: produto,
    estrategiaAbordagem: estrategia,
    sinaisPositivos: sinais.slice(0, 4),
    alertas: alertas.slice(0, 4),
    indiceComercial: { total: indiceTotal, interesse, engajamento, financeiro, urgencia, risco: riscoPerda.percentual },
    confiancaAnalise: { percentual: Math.round(confianca), motivo: `${Array.isArray(timeline)?timeline.length:0} registros analisados, ${sinais.length} sinais positivos e ${alertas.length} alertas.` },
    raciocinioComercial: `Perfil: ${perfil}. Etapa: ${etapa}. Probabilidade de venda: ${100-riscoPerda.percentual}% (${(100-riscoPerda.percentual) >= 80 ? "muito alta" : (100-riscoPerda.percentual) >= 65 ? "alta" : (100-riscoPerda.percentual) >= 45 ? "média" : "baixa"}). Melhor caminho agora: ${estrategia}. Próxima ação: ${proximaAcao}. Motivo: ${motivoProximaAcao}.`,
    geradoEm: new Date().toISOString()
  };
  return out;
}

async function reanalisarLeadHandler702(req, res) {
  if (requireApiKey(req, res) !== true) return;
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

  const previous = row.resultado_analise || {};
  const sigAtual6863 = assinaturaTimeline6863(timelineFinal || timeline);
  const sigAnterior6863 = previous?._iaIncremental?.timelineHash;
  const podeReusar6863 = !body?.force && !body?.forcarVariacao && !novoAtendimento && !["corrigir-observacao"].includes(String(body?.action || ""));
  if (podeReusar6863 && sigAnterior6863 === sigAtual6863.hash && analiseEstaUtil6863(previous)) {
    const mergedReuse = {
      ...previous,
      _iaIncremental: {
        ...(previous._iaIncremental || {}),
        timelineHash: sigAtual6863.hash,
        timelineTotal: sigAtual6863.total,
        modo: "cache-reuso-sem-mudanca",
        ultimaVerificacao: new Date().toISOString()
      },
      reanalisadoEm: previous.reanalisadoEm || new Date().toISOString()
    };
    return json(res, 200, { ok: true, reused: true, incremental: true, analysis: mergedReuse });
  }
  const leadModelo = {
    ...(previous.lead || {}),
    name: previous.clientName || previous?.lead?.clientName || previous?.lead?.name || row.nome_arquivo || "Contato",
    clientName: previous.clientName || previous?.lead?.clientName || previous?.lead?.name || row.nome_arquivo || "Contato",
    product: previous.produtoInteresse || previous?.modeloComercial?.oportunidade?.produto || previous?.lead?.product || ""
  };
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
    // Só vale pra atendimento ditado; mensagem copiada/proposta/sistema antigo/print ficam como vieram.
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

  // 3º REANALISA. A IA aprofunda a leitura; a camada determinística 676
  // sempre reconcilia oportunidade, relacionamento, responsável e mensagem antes de salvar.
  let novoAnalysis;
  let avisoReanalise = "";
  if (openai) {
    try {
      const timelineParaIA6863 = compactarTimelineParaIA6863(timelineFinal, previous, novoAtendimento);
      novoAnalysis = await analyzeWithBrain({ lead: leadModelo, timeline: timelineParaIA6863, openai, leadId: id, forcarVariacao: true });
      novoAnalysis._iaEntrada6863 = { totalOriginal: timelineFinal.length, totalEnviado: timelineParaIA6863.length, compactado: timelineParaIA6863.length < timelineFinal.length };
    } catch (e) {
      avisoReanalise = String(e?.message || e || "");
    }
  } else {
    avisoReanalise = "Análise por IA não configurada no servidor.";
  }

  // Uma falha do provedor não pode fazer o botão fingir sucesso nem restaurar mensagem antiga.
  // Reconciliamos os fatos já salvos + a timeline sem custo de API e avisamos o front.
  if (!novoAnalysis || typeof novoAnalysis !== "object" || novoAnalysis.mode === "erro_api") {
    avisoReanalise = avisoReanalise || novoAnalysis?.error || "O provedor de análise não respondeu.";
    novoAnalysis = { ...previous, mode: "reconciliacao_local", avisoReanalise };
  }
  novoAnalysis = finalizarAnaliseComercialV674(novoAnalysis, leadModelo, timelineFinal, "Sanchai");
  novoAnalysis = garantirMensagensV682(novoAnalysis, leadModelo);
  novoAnalysis = enriquecerIAComercialV684(novoAnalysis, leadModelo, timelineFinal);
  novoAnalysis._schemaComercial = 684;
  novoAnalysis._schemaComercialMinor = "684-final";
  if (novoAnalysis.modeloComercial) novoAnalysis.modeloComercial.versao = 684;
  // Atualiza o conhecimento geral do corretor com o que foi ensinado nessa conversa.
  const tlTextPraAprendizado = timelineFinal.map(m => `[${m.author || ""}]: ${m.text || ""}`).join("\n");
  if (openai && novoAnalysis.mode !== "reconciliacao_local") atualizarConhecimentoCorretor(tlTextPraAprendizado, openai).catch(() => {});

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
  let merged = {
    ...freshPrevious,
    ...novoAnalysis,
    venda: freshPrevious.venda || undefined,
    memoria: { ...(freshPrevious.memoria || {}), observacoes: observacoesFinais },
    aprendizado: freshPrevious.aprendizado || undefined,
    scoreAjuste: ajusteScoreNovo,
    reanalisadoEm: new Date().toISOString()
  };
  merged = finalizarAnaliseComercialV674(merged, leadModelo, timelineFinal, "Sanchai");
  merged = garantirMensagensV682(merged, leadModelo);
  merged = enriquecerIAComercialV684(merged, leadModelo, timelineFinal);
  merged._schemaComercial = 684;
  merged._schemaComercialMinor = "684-final";
  if (merged.modeloComercial) merged.modeloComercial.versao = 684;
  const sigFinal6863 = assinaturaTimeline6863(timelineFinal);
  merged._iaIncremental = {
    ...(freshPrevious._iaIncremental || {}),
    timelineHash: sigFinal6863.hash,
    timelineTotal: sigFinal6863.total,
    ultimaAnalise: new Date().toISOString(),
    modo: novoAnalysis?._iaEntrada6863?.compactado ? "compactado-completo-preservado" : "completo",
    totalOriginal: novoAnalysis?._iaEntrada6863?.totalOriginal || sigFinal6863.total,
    totalEnviadoIA: novoAnalysis?._iaEntrada6863?.totalEnviado || sigFinal6863.total
  };
  const semAcaoUrgente = merged?.modeloComercial?.acao?.status === "sem-acao-urgente";
  // Só preserva mensagens antigas quando ainda existe uma ação comercial real.
  if (!semAcaoUrgente && novoAnalysis.sugestoesPendentes === true && msgAntigasValidas) {
    merged.messages = freshPrevious.messages;
    merged.sugestoesPendentes = false;
    merged.aprovada = freshPrevious.aprovada;
    merged.arquiteturaMensagens = freshPrevious.arquiteturaMensagens;
  }
  const m = merged.messages || {};
  if (semAcaoUrgente || (!merged.sugestoesPendentes && m.a && m.b && m.c)) merged.aprovada = true;
  aplicarLembrete(merged);
  // Oportunidade encerrada não mantém lembrete/compromisso legado nem mensagem anterior.
  if (semAcaoUrgente && ["perdida","ganha","encerrada-sem-decisao"].includes(String(merged?.modeloComercial?.oportunidade?.status || ""))) {
    merged.lembrete = null;
    merged.confirmedAppointments = [];
  }

  const agoraSalvar = new Date().toISOString();
  const update = { resultado_analise: merged, atualizado_em: agoraSalvar };
  if (novoAtendimento) update.timeline_json = timelineFinal;
  const etapaAtual = String(row.etapa || "Novo").toLowerCase();
  const ehFinalCorretor = /vendido|perdido/.test(etapaAtual);
  if (!ehFinalCorretor && merged?.etapaSugerida) update.etapa = merged.etapaSugerida;
  const freshUpdatedAt = freshRow?.updated_at;
  let updateQuery = supabase.from("whatsapp_processamentos").update(update).eq("id", id);
  let finalQuery = freshUpdatedAt ? updateQuery.eq("updated_at", freshUpdatedAt) : updateQuery;
  let { data: updatedRows, error: putErr } = await finalQuery.select("id");
  if (putErr) return json(res, 500, { ok: false, error: putErr.message });

  // Nunca informa sucesso sem ter gravado. Em conflito, relê e tenta uma segunda vez.
  if (!updatedRows || updatedRows.length === 0) {
    const { data: retryRow, error: retryReadErr } = await supabase
      .from("whatsapp_processamentos")
      .select("resultado_analise, updated_at")
      .eq("id", id)
      .single();
    if (retryReadErr) return json(res, 409, { ok:false, error:"O lead mudou durante a atualização. Tente novamente." });
    let retryMerged = { ...(retryRow?.resultado_analise || {}), ...merged, reanalisadoEm: agoraSalvar };
    retryMerged = finalizarAnaliseComercialV674(retryMerged, leadModelo, timelineFinal, "Sanchai");
    retryMerged = garantirMensagensV682(retryMerged, leadModelo);
    retryMerged = enriquecerIAComercialV684(retryMerged, leadModelo, timelineFinal);
    retryMerged._schemaComercial = 684;
    retryMerged._schemaComercialMinor = "684-final";
    if (retryMerged.modeloComercial) retryMerged.modeloComercial.versao = 684;
    const retryUpdate = { ...update, resultado_analise: retryMerged, atualizado_em: new Date().toISOString() };
    let retryQ = supabase.from("whatsapp_processamentos").update(retryUpdate).eq("id", id);
    if (retryRow?.updated_at) retryQ = retryQ.eq("updated_at", retryRow.updated_at);
    const retryResult = await retryQ.select("id");
    if (retryResult.error) return json(res, 500, { ok:false, error:retryResult.error.message });
    if (!retryResult.data || retryResult.data.length === 0) return json(res, 409, { ok:false, error:"Outra atualização ocorreu ao mesmo tempo. Toque novamente." });
    merged = retryMerged;
  }

  // Verificação final: não devolve sucesso baseado só no objeto em memória.
  // Relê o banco e, se a gravação ainda não estiver no schema atual, faz uma última gravação direta.
  const { data: verifyRow, error: verifyErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise")
    .eq("id", id)
    .single();
  if (verifyErr) return json(res, 500, { ok:false, error: verifyErr.message });
  let persisted = verifyRow?.resultado_analise || null;
  let persistedSchema = Number(persisted?._schemaComercial || persisted?.modeloComercial?.versao || 0);
  if (!persisted || persistedSchema < 684) {
    const forced = enriquecerIAComercialV684(garantirMensagensV682({ ...merged, _schemaComercial: 684, reanalisadoEm: new Date().toISOString() }, leadModelo), leadModelo, timelineFinal);
    if (forced.modeloComercial) forced.modeloComercial.versao = 684;
    const { data: forcedRows, error: forcedErr } = await supabase
      .from("whatsapp_processamentos")
      .update({ resultado_analise: forced, atualizado_em: new Date().toISOString() })
      .eq("id", id)
      .select("resultado_analise");
    if (forcedErr) return json(res, 500, { ok:false, error: forcedErr.message });
    persisted = forcedRows?.[0]?.resultado_analise || forced;
    persistedSchema = Number(persisted?._schemaComercial || persisted?.modeloComercial?.versao || 0);
    if (persistedSchema < 684) return json(res, 500, { ok:false, error:"A análise foi gerada, mas o banco não confirmou a gravação no schema 684." });
  }

  return json(res, 200, { ok: true, analysis: persisted, warning: avisoReanalise || null, schemaComercial: 684, apiVersion: "684-final" });
}

export default async function handler(req, res) {
  try {
    return await reanalisarLeadHandler702(req, res);
  } catch (e) {
    console.error("[reanalisar-lead][702] erro não tratado", e);
    return json(res, 500, {
      ok: false,
      error: "Não foi possível atualizar a análise comercial.",
      detail: String(e?.message || e || "Erro interno"),
      apiVersion: "702"
    });
  }
}
