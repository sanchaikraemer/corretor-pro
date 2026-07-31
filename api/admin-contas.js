// Rota do painel administrativo da PLATAFORMA (só o dono do produto usa): excluir uma conta
// de corretor inteira — dados, vínculos, organização, arquivos e login. Criada porque o painel
// só sabia marcar pago/bloquear/estender; excluir conta de teste exigia SQL na mão.
//
// v1039 — também acumula o relatório de uso de IA por empresa (antes em api/admin-uso-ia.js,
// separado — ver NOTAS-v1039.md: o plano Hobby da Vercel só permite 12 Serverless Functions).
// GET ?relatorio=uso-ia devolve o relatório; POST {action:"excluir-conta"} continua igual.
import { resolveOrganizationId, getSupabaseAdmin, EMPRESA_PRINCIPAL_ID, requirePlatformAdmin, emptyBucket } from "./_persistence.js";
import { invalidarMemoriaComercialCache } from "./_pipeline.js";
import { estimarCustoUsd, cotacaoUsdBrl } from "./_iaCusto.js";

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

// ---------- relatório de uso de IA por empresa (antigo api/admin-uso-ia.js) ----------
function novoAcumuladorUsoIA() {
  return { chamadas: 0, tokensEntrada: 0, tokensSaida: 0, audioSegundos: 0, custoUsd: 0 };
}

function somarUsoIA(acc, evento) {
  acc.chamadas += 1;
  acc.tokensEntrada += Number(evento.prompt_tokens || 0);
  acc.tokensSaida += Number(evento.completion_tokens || 0);
  acc.audioSegundos += Number(evento.audio_seconds || 0);
  // Acumula em USD; converte pra BRL só na formatação final (uma cotação só por resposta, não
  // uma por evento — evita que uma cotação mudando no meio do cálculo desalinhe a soma).
  acc.custoUsd += estimarCustoUsd({
    kind: evento.kind,
    model: evento.model,
    promptTokens: evento.prompt_tokens,
    completionTokens: evento.completion_tokens,
    audioSeconds: evento.audio_seconds
  });
}

function formatarAcumuladorUsoIA(acc) {
  return {
    chamadas: acc.chamadas,
    tokensEntrada: acc.tokensEntrada,
    tokensSaida: acc.tokensSaida,
    audioMinutos: Math.round((acc.audioSegundos / 60) * 10) / 10,
    custoEstimadoBRL: Math.round(acc.custoUsd * cotacaoUsdBrl() * 100) / 100
  };
}

// Lê a tabela em páginas de 1000 (mesmo padrão de api/leads-recentes.js) — os últimos N dias de
// telemetria de uma plataforma nova não devem passar disso tão cedo, mas não é seguro assumir.
async function lerEventosUsoIA(supabase, desdeISO) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; from < 200000; from += pageSize) {
    const { data, error } = await supabase
      .from("ai_usage_events")
      .select("organization_id,kind,model,rota,prompt_tokens,completion_tokens,audio_seconds,criado_em")
      .gte("criado_em", desdeISO)
      .order("criado_em", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return { ok: false, error: error.message, rows };
    if (!Array.isArray(data) || !data.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return { ok: true, rows };
}

async function relatorioUsoIA(req, res, supabase) {
  const dias = Math.min(90, Math.max(1, Number(req.query?.dias) || 30));
  const agora = new Date();
  const inicioHoje = new Date(agora); inicioHoje.setUTCHours(0, 0, 0, 0);
  const inicioPeriodo = new Date(agora.getTime() - dias * 86400000);

  const [{ data: organizacoes, error: orgErro }, eventos] = await Promise.all([
    supabase.from("organizations").select("id,nome"),
    lerEventosUsoIA(supabase, inicioPeriodo.toISOString())
  ]);
  if (orgErro) return json(res, 500, { ok: false, error: orgErro.message });
  if (!eventos.ok) return json(res, 500, { ok: false, error: eventos.error });

  const nomesPorOrg = new Map((organizacoes || []).map(o => [String(o.id), o.nome]));
  const porEmpresa = new Map(); // organization_id -> { hoje, periodo }

  for (const evento of eventos.rows) {
    const orgId = String(evento.organization_id || "");
    if (!orgId) continue;
    if (!porEmpresa.has(orgId)) porEmpresa.set(orgId, { hoje: novoAcumuladorUsoIA(), periodo: novoAcumuladorUsoIA() });
    const entrada = porEmpresa.get(orgId);
    somarUsoIA(entrada.periodo, evento);
    if (new Date(evento.criado_em) >= inicioHoje) somarUsoIA(entrada.hoje, evento);
  }

  const empresas = [...porEmpresa.entries()]
    .map(([organizationId, acc]) => ({
      organizationId,
      nome: nomesPorOrg.get(organizationId) || "(empresa não encontrada)",
      hoje: formatarAcumuladorUsoIA(acc.hoje),
      periodo: formatarAcumuladorUsoIA(acc.periodo)
    }))
    .sort((a, b) => b.periodo.custoEstimadoBRL - a.periodo.custoEstimadoBRL);

  const totalHoje = novoAcumuladorUsoIA();
  const totalPeriodo = novoAcumuladorUsoIA();
  for (const evento of eventos.rows) {
    somarUsoIA(totalPeriodo, evento);
    if (new Date(evento.criado_em) >= inicioHoje) somarUsoIA(totalHoje, evento);
  }

  return json(res, 200, {
    ok: true,
    geradoEm: agora.toISOString(),
    diasNoPeriodo: dias,
    cotacaoUsdBrl: cotacaoUsdBrl(),
    aviso: "Custo estimado a partir de tabela de preço de referência (api/_iaCusto.js) — não é nota fiscal.",
    totalGeral: { hoje: formatarAcumuladorUsoIA(totalHoje), periodo: formatarAcumuladorUsoIA(totalPeriodo) },
    empresas
  });
}

export default async function handler(req, res) {
  // GET com relatorio=uso-ia é exclusivo do administrador da plataforma — nenhum organizationId
  // de chamador comum entra em jogo aqui (requirePlatformAdmin usa só o login do próprio token).
  if (req.method === "GET" && String(req.query?.relatorio || "") === "uso-ia") {
    const supabaseUsoIA = getSupabaseAdmin();
    if (!supabaseUsoIA) return json(res, 500, { ok: false, error: "Supabase não configurado." });
    if (!(await requirePlatformAdmin(req, res, supabaseUsoIA))) return;
    return relatorioUsoIA(req, res, supabaseUsoIA);
  }

  // Valida o login de quem chama (e a conta dele estar em dia). O id resolvido aqui NÃO é o
  // alvo da exclusão — o alvo vem do corpo, e só depois da checagem de administrador abaixo.
  const organizationId = await resolveOrganizationId(req, res);
  if (!organizationId) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Use POST." });

  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  // Só o administrador da plataforma (tabela platform_admins) pode excluir contas — um dono
  // comum, mesmo logado, não pode. Exige o login novo (token), nunca só a chave compartilhada.
  if (!(await requirePlatformAdmin(req, res, supabase))) return;

  const body = await readJsonBody(req).catch(() => ({}));
  if (body?.action !== "excluir-conta") return json(res, 400, { ok: false, error: "Informe action excluir-conta." });
  const alvo = String(body?.organizationId || "").trim();
  if (!alvo) return json(res, 400, { ok: false, error: "Informe qual conta excluir." });
  if (alvo === EMPRESA_PRINCIPAL_ID) {
    return json(res, 400, { ok: false, error: "A conta original (com os seus dados) não pode ser excluída por aqui." });
  }

  const { data: org, error: orgErr } = await supabase.from("organizations").select("id,nome").eq("id", alvo).maybeSingle();
  if (orgErr) return json(res, 500, { ok: false, error: orgErr.message });
  if (!org) return json(res, 404, { ok: false, error: "Conta não encontrada (talvez já excluída)." });

  // v1013 — as 4 tabelas (whatsapp_processamentos, direciona_config, memberships, organizations)
  // agora são apagadas dentro de UMA function do banco (migração 0007_excluir_organizacao_
  // transacional.sql), numa única transação: se qualquer uma falhar, TODAS são desfeitas — nunca
  // mais fica pra trás uma conta "meio excluída" (leads apagados mas Cérebro ainda existente,
  // organização órfã, painel informando erro depois de parte do dado já ter sido apagado).
  const { data: resultado, error: rpcErr } = await supabase.rpc("excluir_organizacao", { p_organization_id: alvo }).maybeSingle();
  if (rpcErr) {
    return json(res, 500, {
      ok: false,
      error: `A exclusão não foi concluída — nada foi apagado (transação revertida): ${rpcErr.message}`,
      dica: /function .* does not exist|schema cache/i.test(rpcErr.message || "")
        ? "Rode a migração supabase/migrations/0007_excluir_organizacao_transacional.sql no SQL Editor do Supabase antes de excluir contas."
        : undefined
    });
  }
  const userIds = [...new Set((resultado?.ids_usuarios || []).map(String).filter(Boolean))];
  invalidarMemoriaComercialCache(alvo);

  // Apaga os ARQUIVOS da conta no Storage (ZIPs, áudios extraídos, manifestos, cache de
  // transcrição) — antes disso a exclusão só apagava linhas do banco e os arquivos ficavam pra
  // sempre ocupando espaço. Só é possível fazer isso de forma segura (sem risco de apagar
  // arquivo de outra conta) porque os caminhos do Storage agora são isolados por organizationId.
  // Best-effort: se falhar, a conta já está excluída no banco (não reverte) — o erro fica visível
  // na resposta em vez de silenciosamente sumir.
  const bucket = process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips";
  const [zipStorage, dadosStorage] = await Promise.all([
    emptyBucket(supabase, bucket, `whatsapp/organizations/${alvo}`).catch(e => ({ ok: false, error: e?.message || String(e), deleted: 0 })),
    emptyBucket(supabase, bucket, `organizations/${alvo}`).catch(e => ({ ok: false, error: e?.message || String(e), deleted: 0 }))
  ]);
  const storageResultado = {
    ok: zipStorage.ok !== false && dadosStorage.ok !== false,
    arquivosApagados: (zipStorage.deleted || 0) + (dadosStorage.deleted || 0),
    erro: [zipStorage.error, dadosStorage.error].filter(Boolean).join(" | ") || undefined
  };

  // Apaga também o LOGIN de cada pessoa da conta — a menos que ele sirva outra conta (vínculo
  // restante) ou seja administrador da plataforma (nunca se auto-apaga por engano). Erros aqui
  // NÃO podem ser ignorados: antes disso, um erro do Supabase em auth.admin.deleteUser passava
  // batido (só não incrementava o contador) e a resposta ainda dizia ok:true, deixando o login
  // órfão existir enquanto o painel informava sucesso.
  let loginsApagados = 0;
  const loginsComErro = [];
  for (const uid of userIds) {
    try {
      const { data: outros } = await supabase.from("memberships").select("id").eq("user_id", uid).limit(1);
      if (Array.isArray(outros) && outros.length) continue;
      const { data: ehAdm } = await supabase.from("platform_admins").select("user_id").eq("user_id", uid).maybeSingle();
      if (ehAdm?.user_id) continue;
      const r = await supabase.auth.admin.deleteUser(uid);
      if (r?.error) { loginsComErro.push({ uid, erro: r.error.message }); continue; }
      loginsApagados++;
    } catch (e) {
      loginsComErro.push({ uid, erro: e?.message || String(e) });
    }
  }

  return json(res, 200, {
    ok: true,
    conta: resultado?.nome || org.nome,
    storage: storageResultado,
    loginsApagados,
    loginsComErro: loginsComErro.length ? loginsComErro : undefined,
    aviso: loginsComErro.length
      ? `${loginsComErro.length} login(s) não puderam ser removidos e continuam existindo — veja loginsComErro.`
      : (storageResultado.ok ? undefined : "Os dados da conta foram excluídos, mas alguns arquivos no Storage não puderam ser removidos — veja storage.erro.")
  });
}
