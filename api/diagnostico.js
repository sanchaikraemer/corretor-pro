import { resolveOrganizationId, getSupabaseAdmin, getPlatformAdminUserId, conferirMigracoesDoBanco, MIGRACAO_MINIMA_EXIGIDA } from "./_persistence.js";
import { conferirConfiguracao } from "./_config.js";
// Endpoint de bastidor consolidado. Faz 4 trabalhos via ?mode=:
//   ?mode=status (padrão) → checa variáveis de ambiente (OpenAI + Supabase)
//   ?mode=openai          → testa a chave OpenAI de verdade (models.list + chat)
//   ?mode=bucket          → configura o bucket do Supabase Storage p/ ZIPs grandes
//   ?mode=banco           → diz quais migrações estão MESMO aplicadas no banco (v1185)
//   ?mode=config          → confere as variáveis de ambiente contra o catálogo (v1325)
//   ?mode=bateria         → roda a bateria de conversas com IA de verdade, em pedaços (v1330)
// Unifica os antigos api/status.js, api/diagnostico-openai.js e api/configurar-bucket.js
// (economiza vagas de Serverless Function no plano Hobby da Vercel).
import { createClient } from "@supabase/supabase-js";
import { getOpenAIRaw, getOpenAIConfigSummary, describeOpenAIError, verificarLimiteDiario, criarChatComLimite, limiteDeSaida } from "./_pipeline.js";
import { CASOS, rodarCaso, modeloJuiz } from "../evals/motor.mjs";
import { registrarUsoIA } from "./_iaCusto.js";

// v1013 — mode=openai faz uma chamada REAL (e paga) à OpenAI a cada clique no botão "Testar IA".
// Sem nenhum teto, cliques repetidos (ou um script) gastavam crédito sem limite algum. Este é um
// teto de segurança bem mais alto que qualquer uso manual real do botão (nunca deveria ser
// alcançado num dia normal) — não é uma trava de plano comercial.
const LIMITE_DIAGNOSTICO_OPENAI_DIA = 40;

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload, null, 2));
}

export default async function handler(req, res) {
  const organizationId = await resolveOrganizationId(req, res);
  if (!organizationId) return;
  const mode = String(req.query?.mode || "status").toLowerCase();
  // mode=bucket reconfigura o bucket de Storage inteiro — infraestrutura COMPARTILHADA por
  // todas as contas, sem nenhuma tela do app que precise disso pra um corretor comum. Exclusivo
  // do administrador da plataforma (nunca de um corretor autenticado, mesmo em dia).
  if (mode === "bucket") {
    const admin = await getPlatformAdminUserId(req, getSupabaseAdmin());
    if (!admin) return json(res, 403, { ok: false, error: "Ajustar o armazenamento é uma ação exclusiva do administrador da plataforma." });
    return modoBucket(res);
  }
  // mode=banco lista o estado das migrações — infraestrutura da plataforma inteira, e a lista
  // conta onde estão as travas de segurança. Mesma porta do mode=bucket: só o administrador.
  if (mode === "banco") {
    const admin = await getPlatformAdminUserId(req, getSupabaseAdmin());
    if (!admin) return json(res, 403, { ok: false, error: "Conferir o banco é uma ação exclusiva do administrador da plataforma." });
    return modoBanco(res);
  }
  // v1325 — mode=config confere a configuração do servidor inteiro (nome errado, valor no formato
  // errado, obrigatória faltando). É retrato da plataforma, não de uma conta: só o administrador.
  if (mode === "config") {
    const admin = await getPlatformAdminUserId(req, getSupabaseAdmin());
    if (!admin) return json(res, 403, { ok: false, error: "Conferir a configuração é uma ação exclusiva do administrador da plataforma." });
    return modoConfig(res);
  }
  // v1330 — mode=bateria roda a BATERIA DE CONVERSAS com IA de verdade, em pedaços, pelo botão do
  // painel. Gasta dinheiro a cada clique (é análise real + juiz), mexe com a plataforma inteira e
  // é a régua que decide se uma mudança na análise pode ir pro ar: exclusivo do administrador.
  if (mode === "bateria") {
    const admin = await getPlatformAdminUserId(req, getSupabaseAdmin());
    if (!admin) return json(res, 403, { ok: false, error: "Medir a qualidade da análise é uma ação exclusiva do administrador da plataforma." });
    return modoBateria(req, res, organizationId);
  }
  // mode=status/openai continuam abertos a qualquer corretor autenticado (telas reais do app
  // usam pra checar se a IA está respondendo) — mas sem revelar prefixo/final da chave OpenAI
  // nem organização/projeto pra quem não é administrador da plataforma.
  const admin = await getPlatformAdminUserId(req, getSupabaseAdmin());
  if (mode === "openai") {
    const limite = await verificarLimiteDiario(organizationId, "diagnostico-openai", LIMITE_DIAGNOSTICO_OPENAI_DIA);
    if (!limite.permitido) {
      return json(res, 429, { ok: false, error: `Limite diário de ${limite.limite} testes de IA foi atingido para esta conta. Tente novamente amanhã.` });
    }
    return modoOpenAI(res, !!admin, organizationId);
  }
  return modoStatus(res, !!admin);
}

// ---------- mode=bateria (v1330) ----------
// Roda de 1 a 3 conversas por chamada e devolve o placar do pedaço. Quem varre a bateria inteira é
// a tela, chamando de pedaço em pedaço — porque uma análise real leva perto de um minuto e a função
// tem teto de tempo. Em pedaços, o dono também vê o resultado andando em vez de olhar tela parada.
const MAX_CASOS_POR_CHAMADA = 3;

async function modoBateria(req, res, organizationId) {
  const openai = getOpenAIRaw();
  if (!openai) return json(res, 503, { ok: false, error: "A chave da OpenAI não está configurada nesta hospedagem." });
  const total = CASOS.length;
  const de = Math.max(0, Math.min(total, Number(req.query?.de) || 0));
  const quantos = Math.max(1, Math.min(MAX_CASOS_POR_CHAMADA, Number(req.query?.quantos) || 1));
  const ate = Math.min(total, de + quantos);
  const pedaco = CASOS.slice(de, ate);
  if (!pedaco.length) return json(res, 200, { ok: true, total, de, ate, resultados: [], fim: true });

  const resultados = [];
  for (const caso of pedaco) {
    resultados.push(await rodarCaso({ openai, caso, organizationId }));
  }
  return json(res, 200, {
    ok: true,
    total,
    de,
    ate,
    fim: ate >= total,
    modeloJuiz: modeloJuiz(),
    resultados
  });
}

// ---------- mode=status (antigo api/status.js) ----------
function modoStatus(res, isAdmin) {
  const openai = getOpenAIConfigSummary();
  return json(res, 200, {
    ok: true,
    buildTime: new Date().toISOString(),
    env: {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: !!(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_ZIP_BUCKET: process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips",
      OPENAI_API_KEY: openai.configured,
      OPENAI_BASE_URL: openai.baseURL,
      OPENAI_HAS_CUSTOM_BASE: openai.baseURL !== "https://api.openai.com/v1",
      OPENAI_KEY_PREFIX: isAdmin ? openai.keyPrefix : undefined,
      OPENAI_KEY_TAIL: isAdmin ? openai.keyTail : undefined,
      OPENAI_ORG: isAdmin ? openai.organization : undefined,
      OPENAI_PROJECT: isAdmin ? openai.project : undefined,
      OPENAI_TRANSCRIPTION_MODEL: openai.transcriptionModel,
      DIRECIONA_MAIN_MODEL: openai.analysisModel,
      OPENAI_ANALYSIS_MODEL: openai.analysisModel,
      OPENAI_MESSAGES_MODEL: openai.messagesModel,
      OPENAI_VISION_MODEL: openai.visionModel,
      OPENAI_SIMPLE_MODEL: openai.simpleModel,
      OPENAI_ORQUESTRADOR_MODEL: openai.orchestratorModel,
      TEXT_PROVIDER: "OpenAI only",
      OPENAI_REASONING_EFFORT: process.env.OPENAI_REASONING_EFFORT || "high",
      HISTORICO_COMPLETO_POR_PADRAO: process.env.DIRECIONA_LIMITAR_HISTORICO !== "1",
      APRENDIZADO_AUTO_ATIVO: process.env.DIRECIONA_USAR_APRENDIZADO_AUTO === "1",
      CONHECIMENTO_AUTO_ATIVO: process.env.DIRECIONA_USAR_CONHECIMENTO_AUTO === "1",
      ESTILO_AUTO_ATIVO: process.env.DIRECIONA_USAR_ESTILO_AUTO === "1",
      ARQUITETURA_MENSAGENS: "gpt55-unificado-v2"
    }
  });
}

// ---------- mode=config (v1325) ----------
// Devolve só nome, grupo, se está definida e o problema em português. NUNCA o valor de nada: o
// catálogo tem chave da OpenAI e do banco no meio.
function modoConfig(res) {
  const r = conferirConfiguracao(process.env);
  return json(res, 200, {
    ok: r.ok,
    total: r.total,
    definidas: r.definidas,
    erros: r.erros,
    avisos: r.avisos,
    problemas: r.problemas,
    conferidas: r.conferidas
  });
}

// ---------- mode=openai (antigo api/diagnostico-openai.js) ----------
async function timed(label, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    return { label, ok: true, ms: Date.now() - startedAt, result };
  } catch (error) {
    return {
      label,
      ok: false,
      ms: Date.now() - startedAt,
      error: describeOpenAIError(error),
      status: error?.status || error?.statusCode || error?.response?.status || null,
      code: error?.code || error?.error?.code || null,
      type: error?.type || error?.error?.type || null,
      headers: error?.headers || error?.response?.headers || null
    };
  }
}

async function modoOpenAI(res, isAdmin, organizationId) {
  const summary = getOpenAIConfigSummary();
  const config = isAdmin ? summary : { ...summary, keyPrefix: undefined, keyTail: undefined, organization: undefined, project: undefined };
  const testes = [];
  let testeAnalise;

  if (summary.configured) {
    const oaRaw = getOpenAIRaw();
    testes.push(await timed("OpenAI · models.list (sanity da chave)", () => oaRaw.models.list()));
    // Testa EXATAMENTE como o pipeline real chama (Chat Completions), não a
    // Responses API — gpt-4.1 não aceita reasoning.effort e o teste antigo dava
    // falso negativo, escondendo o erro de verdade (saldo/limite/rate).
    // v1311 — o teste precisa chamar do MESMO jeito que o pipeline real, inclusive no nome do
    // parâmetro de tamanho (que mudou nos modelos novos): senão o diagnóstico acusa erro onde não
    // há, ou passa onde a análise de verdade quebra.
    testeAnalise = await timed(`OpenAI · análise e mensagens (${summary.analysisModel})`, () => criarChatComLimite(oaRaw, {
      model: summary.analysisModel,
      messages: [{ role: "user", content: "Responda apenas: ok" }],
      ...limiteDeSaida(summary.analysisModel, 16)
    }));
    testes.push(testeAnalise);
    if (testeAnalise.ok) {
      await registrarUsoIA({ organizationId, kind: "chat", model: testeAnalise.result?.model || summary.analysisModel, rota: "diagnostico-testar-ia", usage: testeAnalise.result?.usage });
    }
  } else {
    testeAnalise = { label: "OpenAI", ok: false, ms: 0, error: "OPENAI_API_KEY ausente no servidor.", status: null, code: null, type: null };
    testes.push(testeAnalise);
  }

  const allOk = testes.every(t => t.ok);
  // analiseFunciona reflete o teste que chama exatamente como o pipeline real (chat.completions
  // com o analysisModel) — não "algum teste passou". models.list só prova que a chave é válida;
  // se só ele passar (ex.: modelo de análise indisponível/sem quota pra esse modelo específico),
  // a análise de verdade continua quebrada e o diagnóstico não pode dizer que está tudo ok.
  const analiseFunciona = !!testeAnalise.ok;
  const primeiroErro = testes.find(t => !t.ok);

  return json(res, analiseFunciona ? 200 : 500, {
    ok: allOk,
    analiseFunciona,
    config,
    primeiroErro: primeiroErro
      ? {
          etapa: primeiroErro.label,
          mensagem: primeiroErro.error,
          status: primeiroErro.status,
          code: primeiroErro.code,
          type: primeiroErro.type,
          dica: dicaPorErro(primeiroErro)
        }
      : null,
    testes: testes.map(t => ({
      etapa: t.label,
      ok: t.ok,
      ms: t.ms,
      status: t.status || null,
      code: t.code || null,
      type: t.type || null,
      error: t.error || null,
      hint: t.ok ? null : dicaPorErro(t)
    }))
  });
}

function dicaPorErro(teste) {
  const msg = String(teste?.error || "").toLowerCase();
  if (msg.includes("allowlist") || msg.includes("host not in") || msg.includes("ip ")) {
    return "A chave/conta OpenAI tem restrição de IP/host. Soluções: (1) configurar OPENAI_BASE_URL apontando para um proxy com IP permitido (ex.: Cloudflare AI Gateway); (2) editar a allowlist da chave em platform.openai.com → API keys → Edit; (3) abrir suporte na OpenAI pedindo remoção da restrição.";
  }
  if (msg.includes("invalid api key") || msg.includes("incorrect api key") || teste.status === 401) {
    return "Chave inválida ou revogada. Verifique OPENAI_API_KEY no painel da Vercel.";
  }
  if (msg.includes("quota") || msg.includes("billing") || teste.code === "insufficient_quota") {
    return "Sem saldo / quota esgotada na conta OpenAI. Adicione crédito em platform.openai.com → Billing.";
  }
  if (teste.status === 429) {
    return "Rate limit. Espere 1-2 minutos e tente de novo, ou suba o tier da conta.";
  }
  if (teste.status >= 500) {
    return "Erro do lado da OpenAI. Tente novamente em alguns minutos.";
  }
  if (msg.includes("country") || msg.includes("region")) {
    return "Região do servidor não suportada pela OpenAI. Use OPENAI_BASE_URL com proxy em região aceita.";
  }
  return "Verifique o erro exato acima na documentação da OpenAI.";
}

// ---------- mode=banco (v1185) ----------
// Responde a pergunta que até agora só dava pra responder abrindo o Supabase e olhando função por
// função: "o banco que está no ar tem TODAS as travas que este código supõe que existem?".
async function modoBanco(res) {
  const supabase = getSupabaseAdmin();
  const conferencia = await conferirMigracoesDoBanco(supabase);

  if (!conferencia.disponivel) {
    return json(res, 200, {
      ok: false,
      conferenciaDisponivel: false,
      minimaExigida: MIGRACAO_MINIMA_EXIGIDA,
      resumo: conferencia.motivo,
      proximoPasso: conferencia.registroAusente
        ? "Abra o Supabase → SQL Editor → New query, cole supabase/migrations/0017_registro_de_migracoes.sql inteiro e clique em Run."
        : null
    });
  }

  const faltando = conferencia.faltando || [];
  const resumo = faltando.length
    ? `O banco está atrás do código: ${faltando.length} migração(ões) sem aplicar (${faltando.map(f => f.numero).join(", ")}). Enquanto isso, as travas dessas migrações NÃO existem no banco que está no ar.`
    : "Banco em dia: todas as migrações que este código supõe estão aplicadas de verdade.";

  return json(res, 200, {
    ok: faltando.length === 0,
    conferenciaDisponivel: true,
    emDia: !!conferencia.emDia,
    minimaExigida: conferencia.minimaExigida,
    versaoSeguida: conferencia.versaoSeguida,
    aplicadas: conferencia.aplicadas,
    faltando,
    resumo,
    proximoPasso: faltando.length
      ? `Abra o Supabase → SQL Editor → New query e rode, na ordem: ${faltando.map(f => f.arquivo).join(", ")}. Depois recarregue esta página — a conferência é refeita a cada chamada.`
      : null
  });
}

// ---------- mode=bucket (antigo api/configurar-bucket.js) ----------
async function modoBucket(res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips";
  const targetLimitBytes = Number(process.env.SUPABASE_ZIP_MAX_BYTES) || 2147483648;

  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, {
      ok: false,
      error: "Supabase ainda não configurado.",
      missing: {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey
      }
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let before = null;
  try {
    const { data, error } = await supabase.storage.getBucket(bucket);
    before = error ? { error: error.message } : data;
  } catch (e) {
    before = { error: e?.message || String(e) };
  }

  let updateError = null;
  try {
    const { error } = await supabase.storage.updateBucket(bucket, {
      public: false,
      fileSizeLimit: targetLimitBytes,
      allowedMimeTypes: null
    });
    if (error) updateError = error.message;
  } catch (e) {
    updateError = e?.message || String(e);
  }

  let after = null;
  try {
    const { data, error } = await supabase.storage.getBucket(bucket);
    after = error ? { error: error.message } : data;
  } catch (e) {
    after = { error: e?.message || String(e) };
  }

  const targetLimitMb = Math.round(targetLimitBytes / 1024 / 1024);
  const acceptedMb = after?.file_size_limit ? Math.round(after.file_size_limit / 1024 / 1024) : null;

  return json(res, updateError ? 500 : 200, {
    ok: !updateError,
    bucket,
    targetLimitBytes,
    targetLimitMb,
    acceptedLimitMb: acceptedMb,
    updateError,
    before,
    after,
    hint: updateError
      ? "Se a mensagem mencionar 'limit' ou 'plan', o plano do Supabase precisa ser maior para aceitar arquivos desse tamanho. Verifique em Project Settings → Subscription."
      : `Bucket configurado para aceitar até ${targetLimitMb} MB e qualquer tipo de arquivo.`
  });
}
