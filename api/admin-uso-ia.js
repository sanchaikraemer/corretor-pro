// Painel de custo de IA por empresa (v1038) — exclusivo do administrador da plataforma. Ver
// NOTAS-v1038.md: a auditoria técnica/comercial apontou que, antes de definir plano/preço com
// segurança, é indispensável saber quanto cada corretor está custando de IA de verdade.
import { getSupabaseAdmin, requirePlatformAdmin } from "./_persistence.js";
import { estimarCustoUsd, cotacaoUsdBrl } from "./_iaCusto.js";

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function novoAcumulador() {
  return { chamadas: 0, tokensEntrada: 0, tokensSaida: 0, audioSegundos: 0, custoUsd: 0 };
}

function somar(acc, evento) {
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

function formatarAcumulador(acc) {
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
async function lerEventos(supabase, desdeISO) {
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

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Use GET." });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });
  if (!(await requirePlatformAdmin(req, res, supabase))) return;

  const dias = Math.min(90, Math.max(1, Number(req.query?.dias) || 30));
  const agora = new Date();
  const inicioHoje = new Date(agora); inicioHoje.setUTCHours(0, 0, 0, 0);
  const inicioPeriodo = new Date(agora.getTime() - dias * 86400000);

  const [{ data: organizacoes, error: orgErro }, eventos] = await Promise.all([
    supabase.from("organizations").select("id,nome"),
    lerEventos(supabase, inicioPeriodo.toISOString())
  ]);
  if (orgErro) return json(res, 500, { ok: false, error: orgErro.message });
  if (!eventos.ok) return json(res, 500, { ok: false, error: eventos.error });

  const nomesPorOrg = new Map((organizacoes || []).map(o => [String(o.id), o.nome]));
  const porEmpresa = new Map(); // organization_id -> { hoje, periodo }

  for (const evento of eventos.rows) {
    const orgId = String(evento.organization_id || "");
    if (!orgId) continue;
    if (!porEmpresa.has(orgId)) porEmpresa.set(orgId, { hoje: novoAcumulador(), periodo: novoAcumulador() });
    const entrada = porEmpresa.get(orgId);
    somar(entrada.periodo, evento);
    if (new Date(evento.criado_em) >= inicioHoje) somar(entrada.hoje, evento);
  }

  const empresas = [...porEmpresa.entries()]
    .map(([organizationId, acc]) => ({
      organizationId,
      nome: nomesPorOrg.get(organizationId) || "(empresa não encontrada)",
      hoje: formatarAcumulador(acc.hoje),
      periodo: formatarAcumulador(acc.periodo)
    }))
    .sort((a, b) => b.periodo.custoEstimadoBRL - a.periodo.custoEstimadoBRL);

  const totalHoje = novoAcumulador();
  const totalPeriodo = novoAcumulador();
  for (const evento of eventos.rows) {
    somar(totalPeriodo, evento);
    if (new Date(evento.criado_em) >= inicioHoje) somar(totalHoje, evento);
  }

  return json(res, 200, {
    ok: true,
    geradoEm: agora.toISOString(),
    diasNoPeriodo: dias,
    cotacaoUsdBrl: cotacaoUsdBrl(),
    aviso: "Custo estimado a partir de tabela de preço de referência (api/_iaCusto.js) — não é nota fiscal.",
    totalGeral: { hoje: formatarAcumulador(totalHoje), periodo: formatarAcumulador(totalPeriodo) },
    empresas
  });
}
