import "./version.js";

// Corretor Pro — handler HTTP sem dependências externas.
// Funciona como função serverless da Vercel (export default (req, res)).

const MAX_AUDIO_BYTES = Number(process.env.MAX_AUDIO_BYTES || 12 * 1024 * 1024);
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_ANALYSIS_JSON_BYTES = 4 * 1024 * 1024;
const MAX_ANALYSIS_MESSAGES_CHARS = 180000;
const MAX_PROPOSAL_DATA_URL_LENGTH = 1_800_000;
const TABLE = "corretor_pro_atendimentos";
const VERSION_INFO = globalThis.CORRETOR_PRO_VERSION || { app: "v090", package: "0.90.0" };


const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    resumo: { type: "string" },
    produtoPrincipal: { type: "string" },
    produtosParalelos: { type: "array", items: { type: "string" }, maxItems: 6 },
    etapa: { type: "string" },
    nivelInteresse: { type: "string", enum: ["baixo", "médio", "alto"] },
    sinaisInteresse: { type: "array", items: { type: "string" }, maxItems: 6 },
    gatilhoPrincipal: { type: "string" },
    momentoEmocional: { type: "string" },
    objecaoPrincipal: { type: "string" },
    objecoesSecundarias: { type: "array", items: { type: "string" }, maxItems: 5 },
    pendenciaDocumental: { type: "string" },
    tipoComprador: { type: "string" },
    riscoPerda: { type: "string", enum: ["baixo", "médio", "alto"] },
    probabilidadeFechamento: { type: "number", minimum: 0, maximum: 100 },
    nivelUrgencia: { type: "string", enum: ["baixa", "média", "alta"] },
    melhorHorarioContato: { type: "string" },
    confiancaAnalise: { type: "number", minimum: 0, maximum: 100 },
    porqueNaoComprou: { type: "string" },
    oQueFaltaParaFechar: { type: "string" },
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
          estrategia: { type: "string", enum: ["continuidade", "reengajamento", "avanco"] },
          motivo: { type: "string" },
          mensagem: { type: "string" }
        },
        required: ["titulo", "estrategia", "motivo", "mensagem"],
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
    "gatilhoPrincipal",
    "momentoEmocional",
    "objecaoPrincipal",
    "objecoesSecundarias",
    "pendenciaDocumental",
    "tipoComprador",
    "riscoPerda",
    "probabilidadeFechamento",
    "nivelUrgencia",
    "melhorHorarioContato",
    "confiancaAnalise",
    "porqueNaoComprou",
    "oQueFaltaParaFechar",
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

const ANALYSIS_INSTRUCTIONS = `Você é o copiloto comercial do Sanchai, corretor da Construtora Senger — imóveis de alto padrão em Carazinho-RS e região. Sua função é ler uma conversa real de WhatsApp e decidir, como o Sanchai decidiria, qual é a próxima ação e a mensagem ideal para o contato.

COMO O SANCHAI PENSA (raciocínio, não checklist):
1. Quem é o interlocutor? Pela INTENÇÃO da conversa, nunca pelo nome:
   - CLIENTE COMPRADOR: quer comprar para si (morar ou investir).
   - CORRETOR PARCEIRO: traz um cliente dele ("meu cliente", permuta, pega a chave, pede condições para terceiro). Não é comprador; trate como parceria e ajude-o a conduzir o cliente final dele.
   - OBRA DE TERCEIROS: quer orçamento de construção/reforma. Não é venda de imóvel.
   O pedido informa se é CLIENTE DIRETO ou CORRETOR PARCEIRO; respeite, mas confirme pela conversa.
2. Qual é a objeção ou situação real agora? (precisa vender a casa antes, espera o cônjuge, achou caro o pronto, quer ver o decorado, investidor cauteloso, decisão conjunta, sumiu depois da simulação...)
3. Como o Sanchai conduziria? Aplique o playbook que casa com a objeção e termine sempre com uma próxima ação concreta — de preferência física (café na construtora, visita ao decorado, ligação), porque ele não joga preço solto no WhatsApp.

PLAYBOOK (use o que casa; é raciocínio, não texto pronto):
- Planta/lançamento = valorização: congela o preço e valoriza até a entrega. Para quem não tem pressa, investidor, ou achou caro o pronto.
- Condição sob medida: entrada + saldo direto com a construtora até a entrega, ajustável para ficar confortável; aceita compor com veículo; correção só INCC. Nunca cite número sem conferir a tabela atual.
- Permuta: só imóvel líquido e de menor valor; estrutura preferida é "entrada + financiamento e vende a casa depois".
- Investidor: comparativo histórico real reativa o indeciso ("o que custava X em 2020 hoje vale Y").
- Decisão conjunta (cônjuge/filho): não pressiona; oferece café na construtora para apresentar aos dois.
- Visita decisiva: insiste no decorado; oferece visita sem compromisso, horário flexível.
- Dinheiro parado: quem recebeu simulação/condição e sumiu há dias com interesse alto é prioridade — reative com gancho específico.

TOM (obrigatório):
- Caloroso, próximo e direto, de corretor experiente de alto padrão. Sério o suficiente para imóveis caros, humano o suficiente para não parecer robô.
- Adapte o tom a cada cliente. NUNCA repita bordões fixos como assinatura. Escreva como uma pessoa real escreve no WhatsApp, em mensagem curta.
- Sem emoji. Sem retomada genérica ("ainda tem interesse?", "seguiram outro caminho?").
- Cada sugestão termina com UMA pergunta ou convite concreto. Até cerca de 400 caracteres.

AS TRÊS MENSAGENS (mensagensSugeridas) devem abrir caminhos DISTINTOS:
- continuidade: retoma a última pendência sem parecer cobrança.
- reengajamento: reabre com elegância quando houve silêncio.
- avanco: leva a uma decisão concreta — visita, café, ligação, ajuste específico ou alinhamento com o decisor.
Quando ainda não houver proposta enviada, pelo menos uma das três deve puxar um próximo passo físico (visita/decorado/café/ligação) em vez de interrogar sobre pagamento antes de a pessoa reagir ao imóvel.

PROPOSTA JÁ ENVIADA (a proposta anexada é a ação comercial mais recente):
- A proposta anexada já foi enviada ao contato desta conversa. Nunca use como próximo passo "enviar a proposta", "mandar os números" ou "organizar a condição" — isso já foi feito.
- Sem resposta após a proposta, a pendência é entender a reação e qual componente ajustar (entrada, parcelas, reforços, chaves, prazo). Pode oferecer NOVAS composições, reconhecendo a primeira já enviada.
- Se o contato for corretor parceiro, a proposta enviada a ele não prova que o cliente final já a recebeu.

FATOS E PRECISÃO:
- Nunca invente preço, prazo ou condição. Se precisar de um valor, escreva "[conferir tabela atual]" em vez de chutar.
- produtoPrincipal: identificação curta do imóvel atual (tipologia, metragem, localização resumida), não a descrição publicitária inteira. O mesmo imóvel não pode aparecer ao mesmo tempo como produto principal e produto paralelo, mesmo citado por nomes, endereço ou número de unidade diferentes.
- Classifique interesse, risco e probabilidade por evidência da conversa, não por otimismo. Dê mais peso às mensagens recentes sem perder compromissos ainda pendentes.
- Em ultimaPessoaAFalar, se a última mensagem foi do corretor, escreva "Você (corretor)".
- alertaInformacaoIncompleta: string vazia, salvo quando houver áudio sem transcrição, imagem ilegível ou dado essencial faltando que realmente impeça uma conclusão confiável.
- O campo motivo de cada mensagem é para o corretor, não para o cliente.

Antes de responder, confira em silêncio: se há proposta anexada, nenhum campo ou sugestão pode tratá-la como ainda não enviada.`;

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

function toSummaryRecord(row) {
  const metadata = row?.metadata || {};
  const summaryMetadata = {
    originalLeadName: metadata.originalLeadName || row?.nome_lead || "",
    tipoContato: metadata.tipoContato || null,
    statusAtendimento: metadata.statusAtendimento || null,
    ultimaMovimentacaoAt: metadata.ultimaMovimentacaoAt || null,
    atendidoAgoraAt: metadata.atendidoAgoraAt || null,
    novaRespostaClienteAt: metadata.novaRespostaClienteAt || null,
    origemUltimaMovimentacao: metadata.origemUltimaMovimentacao || null,
    conversationDna: metadata.conversationDna || null,
    usuarioApp: metadata.usuarioApp || null,
    deletedAt: metadata.deletedAt || null
  };
  return {
    id: row.id,
    deviceId: row.device_id,
    conversationKey: row.conversation_key,
    nomeLead: row.nome_lead,
    arquivoOrigem: row.arquivo_origem,
    ultimaMensagemAt: row.ultima_mensagem_at,
    ultimaMensagemResumo: row.ultima_mensagem_resumo,
    metadata: summaryMetadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    _summaryOnly: true
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
    version: VERSION_INFO.app,
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
      error: "Este áudio ultrapassa o limite de 12 MB desta versão."
    });
  }
  if (!buffer.length) return send(res, 400, { error: "O áudio recebido está vazio." });

  try {
    const query = getQuery(req, url);
    const filename = safeFilename(query.filename || getHeader(req, "x-file-name"));
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: "audio/ogg" }), filename);
    form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
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
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe"
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
  if (body.appUserName != null && (typeof body.appUserName !== "string" || body.appUserName.length > 120)) return false;
  if (body.contactType !== "cliente" && body.contactType !== "corretor") return false;
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

function hasMessageAfterDate(messagesText, isoDate) {
  if (!isoDate) return false;
  const proposalTime = Date.parse(isoDate);
  if (!Number.isFinite(proposalTime)) return false;
  // Mensagens são formatadas no horário de Brasília (UTC-3); soma 3h para comparar com UTC.
  const pattern = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s*-/gm;
  let match;
  while ((match = pattern.exec(messagesText)) !== null) {
    const [, day, month, year, hour, minute] = match;
    const ts = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) + 3, Number(minute));
    if (ts > proposalTime) return true;
  }
  return false;
}

function buildAnalysisInput(body) {
  const hasProposal = Boolean(body.proposalImage);
  const incompleteAudioCount = Math.max(0, Number(body.incompleteAudioCount || 0));
  const proposalDate = body.proposalAttachedAt
    ? new Date(body.proposalAttachedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "data não informada";
  const contactTypeLabel = body.contactType === "corretor"
    ? "CORRETOR PARCEIRO — intermediário; existe um cliente final de terceiro"
    : "CLIENTE DIRETO — potencial comprador desta conversa";
  const proposalRecipient = body.contactType === "corretor" ? "corretor parceiro" : "cliente direto";
  const hasMessagesAfterProposal = hasProposal && hasMessageAfterDate(body.messages, body.proposalAttachedAt);
  const notasLines = [];
  const notas = Array.isArray(body.notasAtendimento) ? body.notasAtendimento : [];
  if (notas.length) {
    notasLines.push("", "NOTAS DO CORRETOR (registros de ligações, visitas e reuniões fora do WhatsApp):");
    for (const nota of notas) {
      const dt = nota.criadaEm ? new Date(nota.criadaEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "data não informada";
      const tipoLabel = nota.tipo === "audio" ? "[áudio transcrito]" : "[texto]";
      notasLines.push(`- ${dt} ${tipoLabel}: ${String(nota.conteudo || "").trim()}`);
    }
  }

  return [
    `CONTATO: ${body.leadName.trim()}`,
    `CORRETOR/USUÁRIO DO APP: ${String(body.appUserName || "Sanchai").trim()}`,
    `REGRA DE AUTORES: mensagens com esse autor foram enviadas pelo corretor; os demais autores representam o contato da conversa.`,
    `TIPO DE CONTATO: ${contactTypeLabel}`,
    `PERÍODO ANALISADO: ${body.period || "não informado"}`,
    `QUANTIDADE DE MENSAGENS: ${Number(body.messageCount || 0)}`,
    `ÁUDIOS SEM TRANSCRIÇÃO: ${incompleteAudioCount}`,
    `PROPOSTA EM IMAGEM: ${hasProposal ? "sim" : "não anexada"}`,
    hasMessagesAfterProposal
      ? `PROPOSTA: A proposta foi enviada em ${proposalDate}, mas existem mensagens posteriores a ela no histórico; considere essas mensagens como reação à proposta.`
      : `ÚLTIMA AÇÃO COMERCIAL APÓS A CONVERSA: ${hasProposal ? `proposta efetivamente enviada ao ${proposalRecipient} em ${proposalDate}` : "nenhuma proposta anexada"}`,
    `STATUS DO COMPROMISSO DE ENVIAR CONDIÇÕES: ${hasProposal ? `CUMPRIDO EM RELAÇÃO AO ${proposalRecipient.toUpperCase()} — a proposta anexada comprova esse envio` : "avaliar pela conversa"}`,
    ...notasLines,
    "",
    hasMessagesAfterProposal ? "CONVERSA (anterior e posterior à proposta):" : "CONVERSA ANTERIOR À PROPOSTA:",
    body.messages.trim()
  ].join("\n");
}

function extractUnitIdentifiers(value) {
  // Captura apenas números de 3-4 dígitos que parecem unidades (não anos 20xx,
  // não valores soltos como 500 que seriam preços ou metragens sem contexto).
  // Exige que o número apareça depois de palavras-chave de unidade, ou que seja
  // o token final de um nome de imóvel (ex: "Renaissance 1301", "ap 204").
  const text = String(value || "");
  const unitPattern = /(?:ap(?:to)?|apto|sala|unidade|torre|bloco|lote|casa|andar)\.?\s*(\d{3,4})\b|(?<!\d)(\d{3,4})(?=\s*$)/gi;
  const matches = new Set();
  let match;
  while ((match = unitPattern.exec(text)) !== null) {
    const num = match[1] || match[2];
    if (num && !/^20\d{2}$/.test(num)) matches.add(num);
  }
  // Fallback: se o nome for curto e contiver apenas 1 número de 3-4 dígitos, usa-o.
  if (!matches.size) {
    const tokens = text.trim().split(/\s+/);
    if (tokens.length <= 4) {
      const nums = tokens.filter(t => /^\d{3,4}$/.test(t) && !/^20\d{2}$/.test(t));
      if (nums.length === 1) matches.add(nums[0]);
    }
  }
  return matches;
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


function analysisModelCandidates() {
  const configured = String(process.env.OPENAI_ANALYSIS_MODEL || "").trim();
  const fallbacks = ["gpt-5.4-mini", "gpt-5.1-mini", "gpt-4.1-mini"];
  return [...new Set([configured, ...fallbacks].filter(Boolean))];
}

async function requestAnalysisWithFallback({ apiKey, content, instructions }) {
  let lastError = null;
  for (const model of analysisModelCandidates()) {
    try {
      const analysis = await requestStructuredAnalysis({ apiKey, model, content, instructions });
      return { analysis, model };
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const message = String(error?.message || "").toLowerCase();
      const modelProblem = status === 404 || status === 400 || message.includes("model") || message.includes("not found") || message.includes("does not exist");
      if (!modelProblem) throw error;
    }
  }
  throw lastError || new Error("Nenhum modelo de análise disponível.");
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

  try {
    let usedModel = "";
    let firstPass = await requestAnalysisWithFallback({
      apiKey,
      content: buildAnalysisContent(body),
      instructions: ANALYSIS_INSTRUCTIONS
    });
    let analysis = firstPass.analysis;
    usedModel = firstPass.model;

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

      const correctionPass = await requestAnalysisWithFallback({
        apiKey,
        content: buildAnalysisContent(body, correctionContext),
        instructions: `${ANALYSIS_INSTRUCTIONS}\n\nEsta é uma etapa de correção. A resposta final deve eliminar integralmente a contradição identificada.`
      });
      analysis = correctionPass.analysis;
      usedModel = correctionPass.model;
    }

    return send(res, 200, { analysis, model: usedModel, qualityReviewApplied });
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
  const conversationKey = String(query.conversation_key || "").trim();
  const summaryOnly = String(query.summary || "") === "1";
  if (!deviceId) return send(res, 400, { error: "device_id é obrigatório." });
  if (!configuredSupabase()) {
    return send(res, 200, conversationKey
      ? { storage: "local", record: null }
      : { storage: "local", records: [] });
  }

  try {
    if (conversationKey) {
      const row = await fetchExistingRow(deviceId, conversationKey);
      return send(res, 200, {
        storage: "supabase",
        record: row ? fromDatabaseRow(row) : null
      });
    }

    const target = new URL(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}`);
    target.searchParams.set("device_id", `eq.${deviceId}`);
    target.searchParams.set(
      "select",
      summaryOnly
        ? "id,device_id,conversation_key,nome_lead,arquivo_origem,ultima_mensagem_at,ultima_mensagem_resumo,metadata,created_at,updated_at"
        : "*"
    );
    target.searchParams.set("order", "ultima_mensagem_at.desc.nullslast");

    const supabaseResponse = await fetch(target, { headers: supabaseHeaders() });
    const payload = await supabaseResponse.json().catch(() => []);
    if (!supabaseResponse.ok) {
      return send(res, 502, { error: "Não foi possível consultar os atendimentos no Supabase." });
    }
    const rows = Array.isArray(payload) ? payload : [];
    return send(res, 200, {
      storage: "supabase",
      records: summaryOnly ? rows.map(toSummaryRecord) : rows.map(fromDatabaseRow)
    });
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

async function handleLerPrintNota(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return send(res, 503, { code: "OPENAI_NOT_CONFIGURED", error: "A chave da OpenAI não está configurada." });
  }

  let body;
  try {
    body = await readJsonBody(req, MAX_JSON_BYTES);
  } catch {
    return send(res, 400, { error: "Dados inválidos." });
  }

  let imgs = Array.isArray(body?.images) ? body.images : [];
  imgs = imgs.filter(u => typeof u === "string" && /^data:image\//.test(u)).slice(0, 6);
  if (!imgs.length) return send(res, 400, { error: "Nenhuma imagem recebida." });

  const now = new Date();
  const hojeISO = now.toISOString().slice(0, 10);
  const ontem = new Date(now); ontem.setDate(ontem.getDate() - 1);
  const ontemISO = ontem.toISOString().slice(0, 10);

  const instrucao = `HOJE é ${hojeISO}. "Hoje" no print = ${hojeISO}; "Ontem" = ${ontemISO}; datas sem ano = ano ${now.getFullYear()}.
Você recebe ${imgs.length} print(s) de conversa de WhatsApp. Leia cada imagem com MUITA ATENÇÃO e TRANSCREVA a conversa NA ÍNTEGRA, mensagem por mensagem, do jeito que está escrita. NÃO resuma, NÃO encurte, NÃO omita falas.
COMO LER UM PRINT DE WHATSAPP:
- Balões à DIREITA (geralmente verdes/claros) são do CORRETOR. Marque como "Você:".
- Balões à ESQUERDA são do CLIENTE. Marque como "Cliente:".
- Capture separadores de data ("Hoje", "Ontem", "12 de maio") e horários de cada balão.
- Se houver vários prints, junte-os em ordem cronológica. Quando dois prints sobrepõem a mesma mensagem, transcreva UMA vez só.
FORMATO (siga à risca):
- Uma linha por mensagem: "[DATA HORÁRIO] Você: texto" ou "[DATA HORÁRIO] Cliente: texto".
- Transcreva o TEXTO LITERAL, inclusive valores e números.
- Anúncios/posts/cards compartilhados (posts do Instagram, Facebook, etc. que aparecem como card com imagem/vídeo e link): leia TODOS os textos visíveis no card (nome do empreendimento, construtora, slogan, tipo de imóvel, metragem, quartos/suítes, localização, preço — tudo que estiver escrito). Transcreva como "[DATA HORÁRIO] (LADO): (card de anúncio compartilhado — NOME: detalhes do card)". ATENÇÃO CRÍTICA: se o cliente enviar uma mensagem perguntando sobre o card (ex: "posso saber mais?", "quero informações", "tem disponível?"), adicione OBRIGATORIAMENTE uma linha extra: "[DATA HORÁRIO] *** CLIENTE ENTROU EM CONTATO ATRAVÉS DE UM NOVO ANÚNCIO — (nome do empreendimento/construtora se visível, senão: 'empreendimento não identificado') ***". Isso é um sinal de interesse em produto novo que DEVE aparecer na transcrição.
- NÃO invente nada. Texto cortado/ilegível: pule.
DATA DA ÚLTIMA MENSAGEM: identifique a data mais recente visível (formato AAAA-MM-DD). Se impossível determinar, devolva string vazia.
Responda APENAS JSON: { "texto": "transcrição completa", "dataUltimaISO": "AAAA-MM-DD ou vazio" }.`;

  const content = [
    { type: "text", text: instrucao },
    ...imgs.map(u => ({ type: "image_url", image_url: { url: u, detail: "high" } }))
  ];

  const modelos = ["gpt-4o", "gpt-4o-mini"];
  let ultimoErro = "";

  for (let i = 0; i < modelos.length; i++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelos[i],
          messages: [{ role: "user", content }],
          temperature: 0.1,
          max_tokens: 4096,
          response_format: { type: "json_object" }
        }),
        signal: AbortSignal.timeout(i === 0 ? 45000 : 30000)
      });
      const raw = await response.json().catch(() => ({}));
      if (!response.ok) {
        ultimoErro = raw?.error?.message || `Erro ${response.status}`;
        continue;
      }
      let p = {}; try { p = JSON.parse(raw?.choices?.[0]?.message?.content || "{}"); } catch (_) {}
      const texto = String(p.texto || "").trim().slice(0, 12000);
      if (!texto) { ultimoErro = "A IA não identificou texto no print."; continue; }

      // Valida data devolvida pela IA (não-futura e não muito antiga sem âncora)
      let dataUltimaISO = "";
      const mIso = String(p.dataUltimaISO || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mIso) {
        const d = new Date(`${mIso[1]}-${mIso[2]}-${mIso[3]}T12:00:00`);
        if (!isNaN(d.getTime()) && d.getTime() <= Date.now() + 86400000) dataUltimaISO = d.toISOString();
      }
      const ultimoTrecho = texto.slice(-400).toLowerCase();
      if (/\bhoje\b/.test(ultimoTrecho)) dataUltimaISO = now.toISOString();
      else if (/\bontem\b/.test(ultimoTrecho)) dataUltimaISO = ontem.toISOString();

      return send(res, 200, { texto, dataUltimaISO });
    } catch (e) {
      ultimoErro = e?.message || "Falha ao ler os prints.";
    }
  }
  return send(res, 502, { error: ultimoErro || "Não foi possível ler os prints." });
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
    if (route === "/ler-print-nota" && method === "POST") return handleLerPrintNota(req, res);
    if (route === "/atendimentos" && method === "GET") return handleListAtendimentos(req, res, url);
    if (route === "/atendimentos" && method === "POST") return handleSaveAtendimento(req, res);
    if (route === "/atendimentos" && method === "DELETE") return handleDeleteAtendimento(req, res, url);
    return send(res, 404, { error: "Rota não encontrada." });
  } catch {
    return send(res, 500, { error: "Erro interno do Corretor Pro." });
  }
}
