// Corretor Pro — handler HTTP sem dependências externas.
// Funciona como função serverless da Vercel (export default (req, res)).

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_ANALYSIS_JSON_BYTES = 4 * 1024 * 1024;
const MAX_ANALYSIS_MESSAGES_CHARS = 180000;
const MAX_PROPOSAL_DATA_URL_LENGTH = 1_800_000;
const TABLE = "corretor_pro_atendimentos";


const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    resumo: { type: "string" },
    produtoPrincipal: { type: "string" },
    produtosParalelos: { type: "array", items: { type: "string" }, maxItems: 6 },
    etapa: { type: "string" },
    nivelInteresse: { type: "string", enum: ["baixo", "médio", "alto"] },
    sinaisInteresse: { type: "array", items: { type: "string" }, maxItems: 6 },
    objecaoPrincipal: { type: "string" },
    ultimaPessoaAFalar: { type: "string" },
    ultimaSolicitacaoCliente: { type: "string" },
    ultimoCompromissoCliente: { type: "string" },
    ultimoCompromissoCorretor: { type: "string" },
    participantesDecisao: { type: "string" },
    propostaResumo: { type: "string" },
    pendenciaFinanceira: { type: "string" },
    pendenciaReal: { type: "string" },
    quemDeveProximoPasso: { type: "string" },
    proximoPasso: { type: "string" },
    alertaInformacaoIncompleta: { type: "string" },
    mensagensSugeridas: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          mensagem: { type: "string" }
        },
        required: ["titulo", "mensagem"],
        additionalProperties: false
      }
    }
  },
  required: [
    "resumo",
    "produtoPrincipal",
    "produtosParalelos",
    "etapa",
    "nivelInteresse",
    "sinaisInteresse",
    "objecaoPrincipal",
    "ultimaPessoaAFalar",
    "ultimaSolicitacaoCliente",
    "ultimoCompromissoCliente",
    "ultimoCompromissoCorretor",
    "participantesDecisao",
    "propostaResumo",
    "pendenciaFinanceira",
    "pendenciaReal",
    "quemDeveProximoPasso",
    "proximoPasso",
    "alertaInformacaoIncompleta",
    "mensagensSugeridas"
  ],
  additionalProperties: false
};

const ANALYSIS_INSTRUCTIONS = `Você é o motor de inteligência comercial do Corretor Pro, voltado a atendimentos imobiliários reais por WhatsApp.

Analise a conversa cronologicamente e identifique com precisão: última pessoa a falar, último compromisso do cliente, última solicitação do cliente, último compromisso assumido pelo corretor, produto principal atual, opções paralelas, participantes da decisão, etapa da negociação, nível de interesse, sinais objetivos, objeção relevante, pendência financeira, pendência real, quem deve agir agora e próximo passo.

HIERARQUIA DOS FATOS:
1. As mensagens mostram a evolução da negociação.
2. Quando houver uma imagem de proposta anexada, trate esse anexo como a AÇÃO COMERCIAL MAIS RECENTE, ocorrida depois das mensagens apresentadas.
3. A proposta anexada é a última proposta efetivamente ENVIADA ao cliente. Portanto, o compromisso anterior de enviar uma condição, simulação, valores ou opções deve ser considerado CUMPRIDO.
4. O próximo passo deve partir do que já foi entregue, nunca reiniciar a negociação.

REGRAS OBRIGATÓRIAS SOBRE PROPOSTA ANEXADA:
- Nunca diga que o corretor ainda precisa enviar a proposta anexada, os mesmos números ou a mesma condição.
- Nunca use como próximo passo: “enviar as opções”, “enviar a proposta”, “mandar os números”, “organizar a condição”, “mostrar como ficam entrada e parcelas” ou equivalentes, quando isso já estiver visível no anexo.
- Não escreva sugestões como “posso te mandar uma visão”, “quer que eu te envie essa leitura?”, “vou organizar a condição” ou “posso te mostrar os números”, pois a proposta já foi enviada.
- Se não houver resposta do cliente depois da proposta, a pendência real é entender a reação dele e qual componente precisa ser ajustado: entrada, parcelas mensais, parcelas anuais/reforços, valor nas chaves, saldo, prazo ou composição geral.
- É permitido oferecer NOVAS composições, mas somente depois de reconhecer a primeira simulação já enviada. Exemplo de lógica correta: “Na primeira simulação que te enviei, qual ponto você prefere ajustar: a entrada ou as parcelas?”.
- Quando a decisão envolver filho, cônjuge, sócio ou outra pessoa, use isso para facilitar a análise conjunta, sem transferir toda a decisão para essa pessoa.
- O campo proximoPasso deve indicar uma ação posterior à proposta, como confirmar entendimento, identificar ajuste ou montar alternativas novas a partir da composição existente.

REGRAS DE PRODUTO E OBJEÇÃO:
- Diferencie o produto atual de produtos apenas mencionados no passado.
- O mesmo imóvel não pode aparecer ao mesmo tempo como produto principal e produto paralelo, mesmo quando for citado por nomes diferentes, endereço, lançamento ou número da unidade.
- Não reabra comparação com outros imóveis se o cliente já indicou uma unidade preferida e a conversa está na etapa financeira, salvo se ele tiver pedido essa comparação depois da proposta.
- Não transforme confusão de preço sobre outro imóvel em objeção de preço do produto atual.
- Classifique o interesse apenas por evidências da conversa, não por otimismo.

REGRAS GERAIS:
- Leia os valores e condições visíveis na imagem, mas não invente números ou informações ilegíveis. Quando algo não estiver claro, diga que não foi identificado.
- Dê mais peso às mensagens mais recentes, sem perder compromissos anteriores ainda pendentes.
- Diferencie claramente o que o cliente pediu, o que o corretor prometeu e o que já foi efetivamente entregue.
- Se houver áudio não transcrito, avise que a análise pode estar incompleta.
- As mensagens sugeridas devem continuar exatamente de onde a conversa parou, aproveitar a pendência real e considerar a proposta já enviada.
- Não use retomadas genéricas como “ainda tem interesse?” ou “seguiram outro caminho?”.
- Não use as expressões “faz sentido”, “fiquei pensando”, “estive pensando”, “caso não tenha agradado”, “se não gostou” ou “papo”.
- Não use emojis.
- Não pressione e não ofereça uma saída fácil para encerrar a conversa.
- Abra alternativas sem abandonar o produto principal.
- Cada sugestão deve soar como um corretor experiente, natural e objetivo, ter preferencialmente até 400 caracteres e terminar com uma única pergunta principal.
- Gere exatamente três sugestões com abordagens diferentes, porém todas coerentes com a MESMA etapa da negociação. Quando houver proposta anexada, priorize: (1) ajuste direto da composição; (2) facilitação da decisão conjunta; (3) comparação entre novas composições financeiras do mesmo produto. Não use comparação de imóveis como terceira opção sem solicitação recente do cliente.

Antes de responder, faça uma verificação silenciosa: se existe proposta anexada, confirme que nenhum campo nem sugestão trata a proposta como ainda não enviada.`;

function configuredSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function safeFilename(value) {
  let name = "audio.ogg";
  try {
    name = decodeURIComponent(String(value || name));
  } catch {
    name = String(value || name);
  }
  name = name.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]+/g, "-");
  if (/\.opus$/i.test(name)) name = name.replace(/\.opus$/i, ".ogg");
  if (!/\.(ogg|mp3|wav|m4a|mp4|webm)$/i.test(name)) name += ".ogg";
  return name;
}

function toDatabaseRow(record) {
  return {
    id: record.id,
    device_id: record.deviceId,
    conversation_key: record.conversationKey,
    nome_lead: record.nomeLead,
    arquivo_origem: record.arquivoOrigem || null,
    ultima_mensagem_at: record.ultimaMensagemAt || null,
    ultima_mensagem_resumo: record.ultimaMensagemResumo || null,
    timeline: Array.isArray(record.timeline) ? record.timeline : [],
    metadata: record.metadata && typeof record.metadata === "object" ? record.metadata : {},
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: record.updatedAt || new Date().toISOString()
  };
}

function fromDatabaseRow(row) {
  return {
    id: row.id,
    deviceId: row.device_id,
    conversationKey: row.conversation_key,
    nomeLead: row.nome_lead,
    arquivoOrigem: row.arquivo_origem,
    ultimaMensagemAt: row.ultima_mensagem_at,
    ultimaMensagemResumo: row.ultima_mensagem_resumo,
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isValidRecord(record) {
  return Boolean(
    record &&
    typeof record.deviceId === "string" && record.deviceId.length >= 8 &&
    typeof record.conversationKey === "string" && record.conversationKey.length >= 1 &&
    typeof record.nomeLead === "string" && record.nomeLead.trim() &&
    Array.isArray(record.timeline) && record.timeline.length <= 50000
  );
}

function readStream(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", chunk => {
      size += chunk.length;
      if (limit && size > limit) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve({ buffer: Buffer.concat(chunks), tooLarge, size }));
    req.on("error", reject);
  });
}

async function readRawBody(req, limit) {
  if (Buffer.isBuffer(req.body)) {
    return { buffer: req.body, tooLarge: req.body.length > limit, size: req.body.length };
  }
  if (typeof req.body === "string") {
    const buffer = Buffer.from(req.body);
    return { buffer, tooLarge: buffer.length > limit, size: buffer.length };
  }
  return readStream(req, limit);
}

async function readJsonBody(req, limit) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    const encoded = Buffer.from(JSON.stringify(req.body));
    if (limit && encoded.length > limit) {
      const error = new Error("entity.too.large");
      error.code = "TOO_LARGE";
      throw error;
    }
    return req.body;
  }
  const { buffer, tooLarge } = await readStream(req, limit);
  if (tooLarge) {
    const error = new Error("entity.too.large");
    error.code = "TOO_LARGE";
    throw error;
  }
  if (!buffer.length) return {};
  return JSON.parse(buffer.toString("utf8"));
}

function getQuery(req, url) {
  if (req.query && typeof req.query === "object") return req.query;
  return Object.fromEntries(url.searchParams.entries());
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function handleHealth(_req, res) {
  return send(res, 200, {
    ok: true,
    app: "Corretor Pro",
    version: "v024",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    supabaseConfigured: configuredSupabase(),
    timestamp: new Date().toISOString()
  });
}

async function handleTranscrever(req, res, url) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return send(res, 503, {
      code: "OPENAI_NOT_CONFIGURED",
      error: "A chave da OpenAI ainda não foi configurada na Vercel."
    });
  }

  const { buffer, tooLarge } = await readRawBody(req, MAX_AUDIO_BYTES);
  if (tooLarge || buffer.length > MAX_AUDIO_BYTES) {
    return send(res, 413, {
      code: "AUDIO_TOO_LARGE",
      error: "Este áudio ultrapassa o limite de 4 MB desta primeira versão."
    });
  }
  if (!buffer.length) return send(res, 400, { error: "O áudio recebido está vazio." });

  try {
    const query = getQuery(req, url);
    const filename = safeFilename(query.filename || getHeader(req, "x-file-name"));
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: "audio/ogg" }), filename);
    form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1");
    form.append("language", "pt");
    form.append("response_format", "json");

    const openaiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });

    const payload = await openaiResponse.json().catch(() => ({}));
    if (!openaiResponse.ok) {
      return send(res, openaiResponse.status >= 500 ? 502 : 400, {
        code: "TRANSCRIPTION_FAILED",
        error: payload?.error?.message || "A OpenAI não conseguiu transcrever o áudio."
      });
    }

    return send(res, 200, {
      text: String(payload.text || "").trim(),
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1"
    });
  } catch {
    return send(res, 500, {
      code: "TRANSCRIPTION_ERROR",
      error: "Não foi possível preparar o áudio para transcrição."
    });
  }
}


function isSafeProposalImage(value) {
  const text = String(value || "");
  return text.length <= MAX_PROPOSAL_DATA_URL_LENGTH
    && /^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(text);
}

function isValidAnalysisRequest(body) {
  if (!body || typeof body !== "object") return false;
  if (typeof body.leadName !== "string" || !body.leadName.trim() || body.leadName.length > 200) return false;
  if (typeof body.period !== "string" || body.period.length > 40) return false;
  if (typeof body.messages !== "string" || !body.messages.trim() || body.messages.length > MAX_ANALYSIS_MESSAGES_CHARS) return false;
  if (body.proposalImage != null && !isSafeProposalImage(body.proposalImage)) return false;
  return true;
}

function extractOpenAIText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        return content.text.trim();
      }
    }
  }
  return "";
}

function buildAnalysisInput(body) {
  const hasProposal = Boolean(body.proposalImage);
  const incompleteAudioCount = Math.max(0, Number(body.incompleteAudioCount || 0));
  const proposalDate = body.proposalAttachedAt
    ? new Date(body.proposalAttachedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "data não informada";
  return [
    `LEAD: ${body.leadName.trim()}`,
    `PERÍODO ANALISADO: ${body.period || "não informado"}`,
    `QUANTIDADE DE MENSAGENS: ${Number(body.messageCount || 0)}`,
    `ÁUDIOS SEM TRANSCRIÇÃO: ${incompleteAudioCount}`,
    `PROPOSTA EM IMAGEM: ${hasProposal ? "sim" : "não anexada"}`,
    `ÚLTIMA AÇÃO COMERCIAL APÓS A CONVERSA: ${hasProposal ? `proposta efetivamente enviada ao cliente em ${proposalDate}` : "nenhuma proposta anexada"}`,
    `STATUS DO COMPROMISSO DE ENVIAR CONDIÇÕES: ${hasProposal ? "CUMPRIDO — a proposta anexada comprova o envio" : "avaliar pela conversa"}`,
    "",
    "CONVERSA ANTERIOR À PROPOSTA:",
    body.messages.trim()
  ].join("\n");
}

function extractUnitIdentifiers(value) {
  return new Set((String(value || "").match(/\b\d{3,4}\b/g) || []).filter(number => !/^20\d{2}$/.test(number)));
}

function sameUnitAppearsAsParallel(analysis) {
  const mainUnits = extractUnitIdentifiers(analysis?.produtoPrincipal);
  if (!mainUnits.size) return false;
  return (analysis?.produtosParalelos || []).some(item => {
    const parallelUnits = extractUnitIdentifiers(item);
    return [...parallelUnits].some(unit => mainUnits.has(unit));
  });
}

function proposalAnalysisNeedsRepair(analysis) {
  if (!analysis || typeof analysis !== "object") return true;
  const suggestions = Array.isArray(analysis.mensagensSugeridas) ? analysis.mensagensSugeridas : [];
  const combined = [
    analysis.pendenciaReal,
    analysis.proximoPasso,
    ...suggestions.flatMap(item => [item?.titulo, item?.mensagem])
  ].filter(Boolean).join(" ").toLowerCase();

  const restartsNegotiation = [
    /enviar (?:as |uma |a )?(?:opções|proposta|simulação|condição|números|valores)/i,
    /mandar (?:as |uma |a )?(?:opções|proposta|simulação|condição|números|valores|visão)/i,
    /organizar (?:a |uma )?condição/i,
    /mostrar como ficam (?:a )?(?:entrada|parcelas|condição)/i,
    /te envie essa leitura/i,
    /te mandar uma visão/i,
    /comparar .*alternativas próximas/i,
    /comparar .*outro (?:imóvel|apartamento)/i
  ].some(pattern => pattern.test(combined));

  return restartsNegotiation || sameUnitAppearsAsParallel(analysis);
}

function buildAnalysisContent(body, additionalText = "") {
  const text = [buildAnalysisInput(body), additionalText].filter(Boolean).join("\n\n");
  const content = [{ type: "input_text", text }];
  if (body.proposalImage) {
    content.push({ type: "input_image", image_url: body.proposalImage, detail: "high" });
  }
  return content;
}

async function requestStructuredAnalysis({ apiKey, model, content, instructions }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions,
      input: [{ role: "user", content }],
      max_output_tokens: 2600,
      text: {
        format: {
          type: "json_schema",
          name: "corretor_pro_analise",
          strict: true,
          schema: ANALYSIS_SCHEMA
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "A OpenAI não conseguiu analisar o atendimento.");
    error.status = response.status;
    throw error;
  }

  const outputText = extractOpenAIText(payload);
  if (!outputText) {
    const error = new Error("A análise não retornou um resultado utilizável.");
    error.code = "ANALYSIS_EMPTY";
    throw error;
  }

  try {
    return JSON.parse(outputText);
  } catch {
    const error = new Error("A análise retornou em um formato inesperado. Tente novamente.");
    error.code = "ANALYSIS_INVALID_JSON";
    throw error;
  }
}

async function handleAnalisar(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return send(res, 503, {
      code: "OPENAI_NOT_CONFIGURED",
      error: "A chave da OpenAI ainda não foi configurada na Vercel."
    });
  }

  let body;
  try {
    body = await readJsonBody(req, MAX_ANALYSIS_JSON_BYTES);
  } catch (error) {
    if (error?.code === "TOO_LARGE") {
      return send(res, 413, {
        code: "ANALYSIS_TOO_LARGE",
        error: "A conversa ou o print da proposta ficaram grandes demais. Selecione um período menor ou recorte a imagem."
      });
    }
    return send(res, 400, { error: "Os dados enviados para análise são inválidos." });
  }

  if (!isValidAnalysisRequest(body)) {
    return send(res, 400, {
      error: "A conversa ou a imagem da proposta estão incompletas ou inválidas."
    });
  }

  const model = process.env.OPENAI_ANALYSIS_MODEL || "gpt-5.4-mini";
  try {
    let analysis = await requestStructuredAnalysis({
      apiKey,
      model,
      content: buildAnalysisContent(body),
      instructions: ANALYSIS_INSTRUCTIONS
    });

    let qualityReviewApplied = false;
    if (body.proposalImage && proposalAnalysisNeedsRepair(analysis)) {
      qualityReviewApplied = true;
      const correctionContext = [
        "REVISÃO OBRIGATÓRIA:",
        "A análise anterior abaixo contrariou a regra de que a proposta já foi enviada ou confundiu o produto principal com alternativas.",
        "Refaça todos os campos necessários, preserve apenas fatos sustentados e gere três mensagens que partam da primeira simulação já entregue.",
        "Não ofereça reenviar os mesmos números e não compare com outros imóveis sem pedido recente do cliente.",
        "",
        "ANÁLISE ANTERIOR A CORRIGIR:",
        JSON.stringify(analysis)
      ].join("\n");

      analysis = await requestStructuredAnalysis({
        apiKey,
        model,
        content: buildAnalysisContent(body, correctionContext),
        instructions: `${ANALYSIS_INSTRUCTIONS}\n\nEsta é uma etapa de correção. A resposta final deve eliminar integralmente a contradição identificada.`
      });
    }

    return send(res, 200, { analysis, model, qualityReviewApplied });
  } catch (error) {
    if (error?.code === "ANALYSIS_EMPTY") {
      return send(res, 502, { code: "ANALYSIS_EMPTY", error: error.message });
    }
    if (error?.code === "ANALYSIS_INVALID_JSON") {
      return send(res, 502, { code: "ANALYSIS_INVALID_JSON", error: error.message });
    }
    const responseStatus = Number(error?.status);
    return send(res, responseStatus ? (responseStatus >= 500 ? 502 : 400) : 502, {
      code: "ANALYSIS_FAILED",
      error: error?.message || "Não foi possível comunicar com a OpenAI para analisar o atendimento."
    });
  }
}

async function fetchExistingRow(deviceId, conversationKey) {
  const target = new URL(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}`);
  target.searchParams.set("device_id", `eq.${deviceId}`);
  target.searchParams.set("conversation_key", `eq.${conversationKey}`);
  target.searchParams.set("select", "*");
  target.searchParams.set("limit", "1");

  const response = await fetch(target, { headers: supabaseHeaders() });
  const payload = await response.json().catch(() => []);
  if (!response.ok) throw new Error("Falha ao consultar atendimento existente.");
  return Array.isArray(payload) ? payload[0] || null : null;
}

async function handleListAtendimentos(req, res, url) {
  const query = getQuery(req, url);
  const deviceId = String(query.device_id || "").trim();
  if (!deviceId) return send(res, 400, { error: "device_id é obrigatório." });
  if (!configuredSupabase()) return send(res, 200, { storage: "local", records: [] });

  try {
    const target = new URL(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}`);
    target.searchParams.set("device_id", `eq.${deviceId}`);
    target.searchParams.set("select", "*");
    target.searchParams.set("order", "ultima_mensagem_at.desc.nullslast");

    const supabaseResponse = await fetch(target, { headers: supabaseHeaders() });
    const payload = await supabaseResponse.json().catch(() => []);
    if (!supabaseResponse.ok) {
      return send(res, 502, { error: "Não foi possível consultar os atendimentos no Supabase." });
    }
    return send(res, 200, { storage: "supabase", records: payload.map(fromDatabaseRow) });
  } catch {
    return send(res, 502, { error: "Falha de comunicação com o Supabase." });
  }
}

async function handleSaveAtendimento(req, res) {
  let record;
  try {
    record = await readJsonBody(req, MAX_JSON_BYTES);
  } catch (error) {
    if (error?.code === "TOO_LARGE") {
      return send(res, 413, {
        code: "AUDIO_TOO_LARGE",
        error: "Este arquivo ultrapassa o limite desta primeira versão."
      });
    }
    return send(res, 400, { error: "Dados do atendimento incompletos ou inválidos." });
  }

  if (!isValidRecord(record)) {
    return send(res, 400, { error: "Dados do atendimento incompletos ou inválidos." });
  }
  if (!configuredSupabase()) return send(res, 200, { storage: "local", saved: false });

  try {
    const existing = await fetchExistingRow(record.deviceId, record.conversationKey);
    const existingTime = Date.parse(existing?.updated_at || 0) || 0;
    const incomingTime = Date.parse(record.updatedAt || 0) || 0;
    const deletedTime = Date.parse(existing?.metadata?.deletedAt || 0) || 0;
    const receivedTime = Date.parse(record.metadata?.lastReceivedAt || 0) || 0;
    const wouldRestoreWithoutNewImport = deletedTime && receivedTime <= deletedTime;
    if (existing && (existingTime >= incomingTime || wouldRestoreWithoutNewImport)) {
      return send(res, 200, {
        storage: "supabase",
        saved: false,
        ignoredStale: true,
        record: fromDatabaseRow(existing)
      });
    }

    const target = new URL(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}`);
    target.searchParams.set("on_conflict", "device_id,conversation_key");

    const supabaseResponse = await fetch(target, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(toDatabaseRow(record))
    });
    const payload = await supabaseResponse.json().catch(() => []);
    if (!supabaseResponse.ok) {
      return send(res, 502, { error: "Não foi possível salvar o atendimento no Supabase." });
    }
    const saved = Array.isArray(payload) ? payload[0] : payload;
    return send(res, 200, {
      storage: "supabase",
      saved: true,
      record: saved ? fromDatabaseRow(saved) : record
    });
  } catch {
    return send(res, 502, { error: "Falha de comunicação com o Supabase." });
  }
}

async function handleDeleteAtendimento(req, res, url) {
  const query = getQuery(req, url);
  const deviceId = String(query.device_id || "").trim();
  const conversationKey = String(query.conversation_key || "").trim();
  if (!deviceId || !conversationKey) {
    return send(res, 400, { error: "device_id e conversation_key são obrigatórios." });
  }
  if (!configuredSupabase()) {
    return send(res, 200, { storage: "local", deleted: true });
  }

  try {
    const existing = await fetchExistingRow(deviceId, conversationKey);
    if (!existing) return send(res, 200, { storage: "supabase", deleted: true });

    const now = new Date().toISOString();
    const metadata = {
      ...(existing.metadata || {}),
      deletedAt: now
    };
    const tombstone = {
      ...existing,
      ultima_mensagem_at: null,
      ultima_mensagem_resumo: null,
      timeline: [],
      metadata,
      updated_at: now
    };

    const target = new URL(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}`);
    target.searchParams.set("on_conflict", "device_id,conversation_key");
    const response = await fetch(target, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(tombstone)
    });
    if (!response.ok) {
      return send(res, 502, { error: "Não foi possível excluir o lead no Supabase." });
    }
    return send(res, 200, { storage: "supabase", deleted: true, deletedAt: now });
  } catch {
    return send(res, 502, { error: "Falha de comunicação com o Supabase." });
  }
}

export default async function handler(req, res) {
  const host = getHeader(req, "host") || "localhost";
  const url = new URL(req.url || "/", `http://${host}`);
  const route = url.pathname.replace(/^\/api/, "") || "/";
  const method = (req.method || "GET").toUpperCase();

  try {
    if (route === "/health" && method === "GET") return handleHealth(req, res);
    if (route === "/transcrever" && method === "POST") return handleTranscrever(req, res, url);
    if (route === "/analisar" && method === "POST") return handleAnalisar(req, res);
    if (route === "/atendimentos" && method === "GET") return handleListAtendimentos(req, res, url);
    if (route === "/atendimentos" && method === "POST") return handleSaveAtendimento(req, res);
    if (route === "/atendimentos" && method === "DELETE") return handleDeleteAtendimento(req, res, url);
    return send(res, 404, { error: "Rota não encontrada." });
  } catch {
    return send(res, 500, { error: "Erro interno do Corretor Pro." });
  }
}
