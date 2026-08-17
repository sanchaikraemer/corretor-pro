// Telemetria de uso de IA por empresa (v1038) — ver NOTAS-v1038.md e migração
// supabase/migrations/0008_telemetria_uso_ia.sql. Existe pra responder "quanto cada corretor
// está custando de IA?" antes de precificar/vender em escala (achado da auditoria técnica e
// comercial de 27/07/2026, item 6.2/12.2). Separado de api/_pipeline.js de propósito — a mesma
// auditoria (item 03) apontou os arquivos de API como grandes demais; isto não precisa morar
// junto da lógica de análise/transcrição.
import { getSupabaseAdmin } from "./_persistence.js";

// Preço de referência em dólar por 1 milhão de tokens (entrada/saída) e por minuto de áudio
// (Whisper). É só uma ESTIMATIVA pra decisão comercial (plano/preço) — não é nota fiscal; a
// OpenAI pode mudar preço a qualquer momento e este mapa precisa ser atualizado à mão quando
// isso acontecer. Fonte: tabela pública de preços da OpenAI (openai.com/pricing), conferida em
// 28/07/2026. Um modelo fora do mapa cai no "_padrao", propositalmente superestimado — fica
// visível que faltou mapear, em vez de mostrar um custo baixo enganoso.
const PRECO_USD_POR_1M_TOKENS = {
  "gpt-4.1": { entrada: 2.00, saida: 8.00 },
  "gpt-4.1-mini": { entrada: 0.40, saida: 1.60 },
  "gpt-4.1-nano": { entrada: 0.10, saida: 0.40 },
  "gpt-4o": { entrada: 2.50, saida: 10.00 },
  "gpt-4o-mini": { entrada: 0.15, saida: 0.60 },
  "_padrao": { entrada: 5.00, saida: 15.00 }
};
const PRECO_USD_POR_MINUTO_WHISPER = 0.006;

// v1288 — O NOME GRAVADO NÃO É O NOME DO MAPA, E ISSO INFLAVA O CUSTO DO PAINEL.
//
// A telemetria grava de propósito o modelo que a OpenAI DE FATO usou (`completion.model`, ver o
// teste v1038 "precisa gravar o modelo que a OpenAI de fato usou") — e a OpenAI devolve o nome
// COM a data da versão: pede-se "gpt-4o-mini" e vem "gpt-4o-mini-2024-07-18". O mapa acima só
// tem os nomes curtos, e a busca era por chave exata: logo, praticamente TODA chamada caía no
// "_padrao" ($5/$15), que existe pra ser um exagero deliberado. Efeito no painel: gpt-4.1 cobrado
// ~2,3x mais caro do que é, e gpt-4o-mini (o aprendizado automático) até ~30x mais caro.
// Correção: antes de desistir, tira o sufixo de data e tenta de novo.
//
// De propósito NÃO se tenta "adivinhar" além disso (ex.: cair de "gpt-9-turbo" pra "gpt-9"): um
// palpite errado pode SUBESTIMAR o custo, que é o único erro que engana de verdade quem está
// definindo preço. Modelo que continuar sem preço mapeado segue no "_padrao" — e agora aparece
// nomeado como aviso no painel administrativo, em vez de sumir dentro do número.
const SUFIXO_DE_VERSAO = /-(\d{4})-(\d{2})-(\d{2})$/;

export function chavePrecoDoModelo(model) {
  const nome = String(model || "").trim();
  if (PRECO_USD_POR_1M_TOKENS[nome] && nome !== "_padrao") return nome;
  const semData = nome.replace(SUFIXO_DE_VERSAO, "");
  if (semData !== nome && PRECO_USD_POR_1M_TOKENS[semData] && semData !== "_padrao") return semData;
  return null;
}

// Um evento de chat cujo modelo não está no mapa está sendo cobrado pelo preço exagerado do
// "_padrao" — o painel precisa poder DIZER isso, com o nome do modelo, em vez de mostrar um total
// inflado sem explicação (foi exatamente a desconfiança do dono em 17/08/2026: "esses valores
// estão certos? tem certeza?").
export function modeloTemPrecoConhecido({ kind, model }) {
  if (kind === "whisper") return true;
  return chavePrecoDoModelo(model) !== null;
}

function precoDoModelo(model) {
  return PRECO_USD_POR_1M_TOKENS[chavePrecoDoModelo(model) || "_padrao"];
}

// Configurável pelo dono via variável de ambiente (a cotação muda; não faz sentido cravar no
// código nem exigir migração/deploy só pra atualizar um número).
export function cotacaoUsdBrl() {
  const configurada = Number(process.env.CORRETOR_PRO_COTACAO_USD_BRL);
  return Number.isFinite(configurada) && configurada > 0 ? configurada : 5.50;
}

export function estimarCustoUsd({ kind, model, promptTokens = 0, completionTokens = 0, audioSeconds = 0 }) {
  if (kind === "whisper") return (Math.max(0, Number(audioSeconds) || 0) / 60) * PRECO_USD_POR_MINUTO_WHISPER;
  const preco = precoDoModelo(model);
  return (Math.max(0, Number(promptTokens) || 0) / 1_000_000) * preco.entrada
       + (Math.max(0, Number(completionTokens) || 0) / 1_000_000) * preco.saida;
}

// Grava UM evento real de uso de IA — nunca agrega nem sobrescreve (diferente do contador de
// limite diário em direciona_config, que é upsert e aceita perder 1-2 contagens sob concorrência,
// ver api/_pipeline.js). Cada chamada vira uma linha própria (INSERT simples): sem disputa de
// concorrência pra perder dado, e dá pra auditar depois por rota/modelo/dia.
// Nunca pode derrubar o fluxo principal (análise, transcrição, etc.): qualquer erro é engolido —
// esta é telemetria auxiliar, não parte do caminho que atende o corretor.
export async function registrarUsoIA({ organizationId, kind, model, rota, usage, audioSeconds }) {
  if (!organizationId || !kind) return;
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    await supabase.from("ai_usage_events").insert({
      organization_id: organizationId,
      kind,
      model: String(model || "desconhecido"),
      rota: String(rota || "desconhecida"),
      prompt_tokens: Math.max(0, Number(usage?.prompt_tokens || 0)),
      completion_tokens: Math.max(0, Number(usage?.completion_tokens || 0)),
      audio_seconds: Math.max(0, Number(audioSeconds || 0))
    });
  } catch (_) { /* telemetria nunca pode derrubar o fluxo principal */ }
}
