import { COMMERCIAL_SCHEMA_VERSION, commercialSchemaFrom, stampCommercialSchema } from "../js/commercial-schema.js";
// Endpoint unificado que substitui lead-etapa, lead-memoria, aprendizado e
// apagar-lead. Foi consolidado pra caber no limite de 12 Serverless Functions
// do plano Vercel Hobby.
//
// Uso: POST /api/lead-update com body { id, action, ...payload }
// Actions: "salvar-novo", "etapa", "memoria-get", "memoria-set", "aprendizado", "apagar"

import { resolveOrganizationId, EMPRESA_PRINCIPAL_ID } from "./_persistence.js";
import { getSupabaseAdmin, persistProcessingResult, listRecentProcessings, mergeStorageRefs, _nomeIdentity, _nomeRuimIdentity, _nomesMesmoLead, _assinaturaTimelineV681, _mesclarTimelinesV681 } from "./_persistence.js";
import { randomUUID } from "node:crypto";
import {
  getOpenAI, marcarAprendizadoPendente, finalizarAnaliseComercial,
  ARQUITETURA_MENSAGENS_ATUAL, aprenderRespostasDaCarteira, invalidarMemoriaComercialCache,
  upsertConfigComOrganizacao, invalidarConhecimentoCorretorCache
} from "./_pipeline.js";
import { registrarUsoIA } from "./_iaCusto.js";

// v1069 — fim das etapas de funil e de Vendido/Perdido como categorias separadas (pedido
// direto do dono): só existem dois estados possíveis pra um lead.
const ETAPAS_VALIDAS = ["Ativo", "Geladeira"];

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

// A conversa já foi analisada e validada em /api/processar-storage antes de chegar
// ao botão de atualização. Salvar o lead não pode chamar a IA uma segunda vez: além
// de cobrar novamente, uma resposta diferente podia falhar na validação e impedir a
// gravação de uma análise que já estava pronta na tela.
export function obterAnaliseValidadaDaImportacao(result) {
  const analysis = result?.analysis;
  const trio = [analysis?.messages?.a, analysis?.messages?.b, analysis?.messages?.c];
  const trioPreenchido = trio.every(v => String(v || "").trim().length >= 10);
  if (!analysis || typeof analysis !== "object" || analysis.sugestoesPendentes === true || !trioPreenchido) {
    const detalhes = Array.isArray(analysis?.validacaoSugestoes) ? analysis.validacaoSugestoes.join("; ") : "";
    throw new Error(detalhes || "A importação não contém três mensagens já validadas pelo Cérebro.");
  }
  return analysis;
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

export default async function handler(req, res) {
  const organizationId = await resolveOrganizationId(req, res);
  if (!organizationId) return;
  // GET pra ler memória sem precisar de body (usado pelo carregarMemoria do front).
  if (req.method === "GET") {
    const id = req.query?.id;
    if (!id) return json(res, 400, { ok: false, error: "Informe ?id=" });
    const action = req.query?.action || "memoria-get";
    if (action === "memoria-get") return await acaoMemoriaGet(id, res, organizationId);
    if (action === "detalhe") {
      const result = await listRecentProcessings(1, { id, includeFullTimeline: true, organizationId });
      const item = result?.items?.[0] || null;
      if (!result?.ok) return json(res, 500, result);
      if (!item) return json(res, 404, { ok: false, error: "Lead não encontrado." });
      return json(res, 200, { ok: true, item });
    }
    return json(res, 400, { ok: false, error: "GET suporta action=memoria-get ou action=detalhe." });
  }

  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Use GET ou POST." });

  const body = await readJsonBody(req).catch(() => ({}));
  const action = body?.action;
  if (!action) return json(res, 400, { ok: false, error: "Informe action." });

  // salvar-novo / criar-manual não precisam de id (o banco gera ao salvar)
  if (action === "salvar-novo") return await acaoSalvarNovo(body, res, organizationId);
  if (action === "criar-manual") return await acaoCriarManual(body, res, organizationId);
  // v1092 — "nova-oportunidade-parceiro" e "analise-comercial-set" (mais abaixo) já não são
  // chamadas por nenhuma tela: as chamadas saíram do app na v1073 (29/07/2026). Ficam de
  // propósito como CAUDA DE COMPATIBILIDADE — o app é instalável (PWA) e um celular que não
  // abriu o app desde então ainda roda a versão antiga em cache, que chamaria estas rotas.
  // Podem ser removidas com segurança numa faxina futura, depois que essa cauda expirar.
  if (action === "nova-oportunidade-parceiro") return await acaoNovaOportunidadeParceiro(body, res, organizationId);
  if (action === "atualizar-com-evolucao") return await acaoAtualizarComEvolucao(body, res, organizationId);
  if (action === "aprender-carteira") {
    const { aprenderRespostasDaCarteira } = await import("./_pipeline.js");
    const r = await aprenderRespostasDaCarteira(organizationId);
    return json(res, r.ok ? 200 : 500, r);
  }

  const id = body?.id;
  if (!id) return json(res, 400, { ok: false, error: "Informe id." });

  switch (action) {
    case "etapa":         return await acaoEtapa(id, body.etapa, res, organizationId);
    case "memoria-get":   return await acaoMemoriaGet(id, res, organizationId);
    case "memoria-set":   return await acaoMemoriaSet(id, body, res, organizationId);
    case "observacao-adicionar": return await acaoObservacaoAdicionar(id, body, res, organizationId);
    case "aprendizado":   return await acaoAprendizado(id, body, res, organizationId);
    case "apagar":        return await acaoApagar(id, res, body?.ids, organizationId);
    case "editar-dados":  return await acaoEditarDados(id, body, res, organizationId);
    case "analise-comercial-set": return await acaoAnaliseComercialSet(id, body.analysis, res, organizationId);
    default:              return json(res, 400, { ok: false, error: "Action inválida." });
  }
}


// ============ FALLBACK SEGURO DA ANÁLISE COMERCIAL ============
// Usado quando a reanálise principal foi gravada mas uma função antiga não devolveu
// o objeto completo, ou quando o front precisa consolidar fatos determinísticos.
// O servidor relê o lead, reconcilia novamente e só então persiste.
async function acaoAnaliseComercialSet(id, analysis, res, organizationId) {
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return json(res, 400, { ok: false, error: "Informe a análise comercial." });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const { data: current, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise,timeline_json,nome_arquivo,arquivo_nome")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const anterior = current.resultado_analise || {};
  const timeline = Array.isArray(current.timeline_json) ? current.timeline_json : [];
  const lead = {
    ...(anterior.lead || {}),
    name: anterior?.lead?.name || anterior?.nome || String(current.nome_arquivo || current.arquivo_nome || "").replace(/\.(txt|zip)$/i, ""),
    product: anterior?.produtoInteresse || anterior?.lead?.product || ""
  };
  let merged = {
    ...anterior,
    ...analysis,
    memoria: { ...(anterior.memoria || {}), ...(analysis.memoria || {}) },
    aprendizado: anterior.aprendizado || analysis.aprendizado,
    venda: anterior.venda || analysis.venda,
    reanalisadoEm: new Date().toISOString(),
    // v1023 — agendamento só nasce de clique explícito em Agenda, nunca de texto (mesmo
    // princípio da v988 pro lembrete). confirmedAppointments nunca sobrevive a uma gravação.
    confirmedAppointments: []
  };
  merged = stampCommercialSchema(finalizarAnaliseComercial(merged, lead, timeline));

  const { data: saved, error: putErr } = await supabase
    .from("whatsapp_processamentos")
    .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("resultado_analise");
  if (putErr) return json(res, 500, { ok: false, error: putErr.message });
  if (!saved || saved.length === 0) return json(res, 409, { ok: false, error: "A análise não foi gravada. Tente novamente." });
  const persisted = saved[0]?.resultado_analise || merged;
  const schema = commercialSchemaFrom(persisted);
  if (schema < COMMERCIAL_SCHEMA_VERSION) return json(res, 500, { ok: false, error: `A análise foi gerada, mas o banco não confirmou a gravação no schema ${COMMERCIAL_SCHEMA_VERSION}.` });
  return json(res, 200, { ok: true, analysis: persisted, schemaComercial: COMMERCIAL_SCHEMA_VERSION });
}

// v1092 — as ações "lembrete-set" e "lembrete-clear" foram removidas. Eram duas rotas de API
// que NENHUMA tela do app chamou em nenhum momento da história do projeto (conferido no
// histórico do repositório), e o próprio conceito de lembrete automático foi banido: prazo só
// existe quando o corretor marca na Agenda (ver v1023).

// ============ SALVAR NOVO LEAD (após o usuário clicar em "Salvar lead") ============
async function acaoSalvarNovo(body, res, organizationId) {
  const result = body?.result;
  if (!result || typeof result !== "object") {
    return json(res, 400, { ok: false, error: "Informe result com os dados processados." });
  }
  try {
    const agora = new Date().toISOString();
    const eventoImportacao = {
      acao: "criar-novo",
      importId: String(body?.importId || "") || null,
      status: "concluida",
      concluidaEm: agora
    };
    const resultNovo = {
      ...result,
      analysis: {
        ...(result.analysis || {}),
        _historicoImportacoes: [eventoImportacao],
        _ultimaImportacao: eventoImportacao
      }
    };
    const persistence = await persistProcessingResult({
      result: resultNovo,
      source: body?.source || "manual-save",
      bucket: body?.bucket || null,
      path: body?.path || null,
      fileName: body?.fileName || result?.txtFile || null,
      fileSize: body?.fileSize || null,
      // Mesmo nome/telefone nunca cria outro cadastro: a persistência atualiza o existente.
      forceNew: false,
      organizationId
    });
    const salvoId = persistence?.processing?.id;
    let aprendizadoAutomatico = null;
    if (salvoId && Array.isArray(result?.timeline) && result.timeline.length) {
      aprendizadoAutomatico = await marcarAprendizadoPendente({ leadId: String(salvoId), motivo: "nova-importacao", organizationId }).catch(e => ({ ok:false, error:e?.message || String(e) }));
    }
    return json(res, 200, { ok: !!salvoId, persistence, aprendizadoAutomatico });
  } catch (err) {
    return json(res, 500, { ok: false, error: err?.message || String(err) });
  }
}

// Cria lead manualmente — alguém ligou, comentou pessoalmente, indicação. Sem ZIP de WhatsApp.
// Recebe { nome, telefone, produto, observacao }. Gera registro mínimo com etapa Novo.
async function acaoCriarManual(body, res, organizationId) {
  const nome = String(body?.nome || "").trim().slice(0, 120);
  const telefone = String(body?.telefone || "").trim().slice(0, 40);
  const produto = String(body?.produto || "").trim().slice(0, 80);
  const observacao = String(body?.observacao || "").trim().slice(0, 2000);
  if (!nome) return json(res, 400, { ok: false, error: "Informe o nome do lead." });
  try {
    const now = new Date();
    // Carimbo no fuso de Brasília — o servidor roda em UTC (mesma correção já feita em
    // acaoObservacaoAdicionar e api/reanalisar-lead.js; aqui tinha ficado pra trás).
    const { dataBR, horaBR } = dataHoraSaoPaulo(now);
    // Monta um "result" mínimo no formato esperado por persistProcessingResult
    const observacoesIniciais = `[${dataBR}] Lead criado manualmente.${observacao ? " " + observacao : ""}`;
    const timelineInicial = observacao ? [{
      id: 1,
      date: dataBR,
      time: horaBR,
      iso: now.toISOString(),
      author: "Atendimento (corretor)",
      text: observacao,
      type: "atendimento",
      source: "manual",
      order: 1
    }] : [];
    // Perfil: característica curta extraída da observação (ou genérica)
    const perfilCurto = observacao
      ? observacao.slice(0, 120) + (observacao.length > 120 ? "…" : "")
      : `${nome}${produto ? ` — interesse em ${produto}` : ""}`;
    // "Por quê este lead": motivo de ele estar na fila (diferente do perfil)
    const porQue = produto
      ? `Cliente novo demonstrou interesse no ${produto} (sem conversa no WhatsApp ainda). Iniciar contato pra qualificar.`
      : `Cliente novo entrou em contato (sem conversa no WhatsApp ainda). Iniciar abordagem pra qualificar interesse.`;
    const result = {
      lead: { clientName: nome, phone: telefone, etapa: "Novo" },
      analysis: {
        clientName: nome, // garante que nameFrom() pega "Bocorni" e não o nome do arquivo
        origem: "manual", // marca lead criado à mão — não pode ser engolido pela deduplicação por nome
        lead: { clientName: nome, phone: telefone },
        clientProfile: perfilCurto,
        produtoInteresse: produto || "Não identificado",
        produtosInteresse: produto ? [produto] : [],
        etapaSugerida: "Novo",
        tipoRetomada: "primeiro-contato",
        tipoContato: "cliente-final",
        _schemaComercial: COMMERCIAL_SCHEMA_VERSION,
        modeloComercial: {
          versao: COMMERCIAL_SCHEMA_VERSION,
          contato: { tipo: "comprador-direto", papel: "Contato principal da oportunidade", compradorFinal: "" },
          oportunidade: { status: "descoberta", resultado: "em-andamento", produto: produto || "Não identificado", motivo: porQue },
          relacionamento: { status: "ativo", potencial: "não avaliado", motivo: "Contato recém-cadastrado." },
          acao: { status: "responder-agora", responsavel: "corretor", urgencia: "alta", descricao: "Entrar em contato pelo WhatsApp pra iniciar a conversa e qualificar o interesse." },
          contexto: { ultimaPessoaFalar: "desconhecido", ultimaMensagem: "", ultimoCompromisso: "Nenhum compromisso identificado.", impedimentoPrincipal: "Não identificado." }
        },
        nextAction: "Entrar em contato pelo WhatsApp pra iniciar a conversa e qualificar o interesse.",
        summary: porQue,
        risk: porQue,
        memoria: { observacoes: observacoesIniciais },
        memoriaSugerida: {},
        objections: [],
        confirmedAppointments: [],
        permuta: false,
        permutaResumo: "",
        bestTime: "hoje",
        melhorHorarioContato: "",
        arquiteturaMensagens: ARQUITETURA_MENSAGENS_ATUAL,
        sugestoesPendentes: true,
        aprovada: false,
        messages: {
          a: "", b: "", c: "",
          aLabel: "Reanalisar", bLabel: "Reanalisar", cLabel: "Reanalisar", recomendada: "a"
        }
      },
      timeline: timelineInicial,
      audiosEncontrados: 0,
      audiosTranscritos: 0,
      txtFile: nome // sem ".txt", sem prefixo — fallback usa só o nome
    };
    const persistence = await persistProcessingResult({
      result,
      source: "lead-manual",
      bucket: null,
      path: null,
      fileName: nome, // garante que nome_arquivo no banco também é só "Bocorni"
      fileSize: null,
      organizationId
    });
    return json(res, 200, { ok: !!persistence?.processing?.id, id: persistence?.processing?.id, persistence });
  } catch (err) {
    return json(res, 500, { ok: false, error: err?.message || String(err) });
  }
}


// ============ NOVA OPORTUNIDADE VINCULADA A CORRETOR PARCEIRO ============
// Cria um registro comercial independente para um novo comprador, preservando o
// contato/parceiro original. Não exige alteração de schema no Supabase: o vínculo
// fica dentro de resultado_analise.modeloComercial e oportunidadesVinculadas.
async function acaoNovaOportunidadeParceiro(body, res, organizationId) {
  const idOrigem = String(body?.id || "").trim();
  const compradorFinal = String(body?.compradorFinal || "").trim().slice(0, 120);
  const produto = String(body?.produto || "").trim().slice(0, 100);
  const observacao = String(body?.observacao || "").trim().slice(0, 2000);
  if (!idOrigem) return json(res, 400, { ok: false, error: "Informe o contato parceiro de origem." });
  if (!compradorFinal) return json(res, 400, { ok: false, error: "Informe o nome ou identificação do novo comprador." });
  if (!produto) return json(res, 400, { ok: false, error: "Informe o empreendimento ou produto da nova oportunidade." });

  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });
  const { data: origem, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("id,resultado_analise,timeline_json,nome_arquivo,arquivo_nome")
    .eq("id", idOrigem)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!origem) return json(res, 404, { ok: false, error: "Contato parceiro não encontrado." });

  const aOrigem = origem.resultado_analise || {};
  const mcOrigem = aOrigem.modeloComercial || {};
  const nomeParceiro = String(aOrigem.clientName || aOrigem?.lead?.clientName || origem.nome_arquivo || origem.arquivo_nome || "Corretor parceiro").trim();
  const telefone = String(aOrigem?.lead?.phone || "").trim();
  const pareceParceiro = /parceir|corretor|corretora|imobili[áa]ria|creci/i.test([
    aOrigem.tipoContato, mcOrigem?.contato?.tipo, mcOrigem?.contato?.papel, nomeParceiro
  ].filter(Boolean).join(" "));
  if (!pareceParceiro) return json(res, 400, { ok: false, error: "Este contato não está classificado como corretor parceiro." });

  const now = new Date();
  // Fuso de Brasília, não o do servidor (UTC) — ver dataHoraSaoPaulo.
  const { dataBR, horaBR } = dataHoraSaoPaulo(now);
  const oportunidadeId = `opp-${randomUUID()}`;
  const contatoId = String(mcOrigem?.contato?.id || mcOrigem?.oportunidade?.contatoId || idOrigem);
  const obsLinha = observacao ? ` Observação: ${observacao}` : "";
  const motivo = `Nova oportunidade indicada por ${nomeParceiro} para ${compradorFinal}, com interesse em ${produto}.`;

  const result = {
    lead: { clientName: nomeParceiro, phone: telefone, product: produto, etapa: "Novo" },
    analysis: {
      clientName: nomeParceiro,
      origem: "oportunidade-parceiro",
      contatoId,
      oportunidadeId,
      origemOportunidadeId: String(mcOrigem?.oportunidade?.id || idOrigem),
      lead: { clientName: nomeParceiro, phone: telefone, etapa: "Novo" },
      clientProfile: `${nomeParceiro} atua como corretor parceiro. O comprador desta oportunidade é ${compradorFinal}.`,
      produtoInteresse: produto,
      produtosInteresse: [produto],
      etapaSugerida: "Novo",
      tipoRetomada: "primeiro-contato",
      tipoContato: "corretor-parceiro",
      _schemaComercial: COMMERCIAL_SCHEMA_VERSION,
      modeloComercial: {
        versao: COMMERCIAL_SCHEMA_VERSION,
        contato: {
          id: contatoId,
          tipo: "corretor-parceiro",
          papel: "Corretor parceiro que intermedeia compradores",
          compradorFinal
        },
        oportunidade: {
          id: oportunidadeId,
          contatoId,
          origemOportunidadeId: String(mcOrigem?.oportunidade?.id || idOrigem),
          compradorFinal,
          status: "descoberta",
          resultado: "em-andamento",
          produto,
          motivo
        },
        relacionamento: {
          status: "ativo",
          potencial: String(mcOrigem?.relacionamento?.potencial || "médio"),
          motivo: "Parceria ativa com uma nova oportunidade registrada."
        },
        acao: {
          status: "responder-agora",
          responsavel: "corretor",
          urgencia: "alta",
          descricao: "Qualificar o novo comprador com o parceiro e definir o próximo passo comercial."
        },
        contexto: {
          ultimaPessoaFalar: "desconhecido",
          ultimaMensagem: "",
          ultimoCompromisso: "Nenhum compromisso identificado.",
          impedimentoPrincipal: "Ainda não identificado."
        }
      },
      nextAction: "Qualificar o novo comprador com o parceiro e definir o próximo passo comercial.",
      summary: motivo,
      risk: "O perfil e a capacidade de compra do novo comprador ainda precisam ser confirmados.",
      memoria: {
        observacoes: `[${dataBR} ${horaBR}] Nova oportunidade vinculada ao parceiro. Comprador: ${compradorFinal}. Produto: ${produto}.${obsLinha}`
      },
      memoriaSugerida: {},
      objections: [],
      confirmedAppointments: [],
      arquiteturaMensagens: ARQUITETURA_MENSAGENS_ATUAL,
      sugestoesPendentes: true,
      aprovada: false,
      messages: {
        a: "", b: "", c: "",
        aLabel: "Reanalisar", bLabel: "Reanalisar", cLabel: "Reanalisar", recomendada: "a"
      }
    },
    timeline: [{
      id: 1, order: 1, date: dataBR, time: horaBR, iso: now.toISOString(),
      author: "Atendimento (corretor)",
      text: `Nova oportunidade registrada. Comprador: ${compradorFinal}. Produto: ${produto}.${obsLinha}`,
      type: "nota", source: "manual"
    }],
    audiosEncontrados: 0,
    audiosTranscritos: 0,
    txtFile: `Oportunidade ${nomeParceiro} ${compradorFinal} ${oportunidadeId}`
  };

  const persistence = await persistProcessingResult({
    result,
    source: "oportunidade-parceiro",
    bucket: null,
    path: null,
    fileName: result.txtFile,
    fileSize: null,
    organizationId
  });
  const novoId = persistence?.processing?.id;
  if (!novoId) return json(res, 500, { ok: false, error: "Não foi possível criar a nova oportunidade.", details: persistence?.warnings || [] });

  // Registra o vínculo também no contato/oportunidade de origem para auditoria.
  const vinculadas = Array.isArray(aOrigem.oportunidadesVinculadas) ? aOrigem.oportunidadesVinculadas.slice(-49) : [];
  vinculadas.push({ id: oportunidadeId, leadId: novoId, compradorFinal, produto, criadoEm: now.toISOString() });
  const origemAtualizada = {
    ...aOrigem,
    oportunidadesVinculadas: vinculadas,
    // v1023 — agendamento só nasce de clique explícito em Agenda, nunca sobrevive a uma gravação.
    confirmedAppointments: [],
    modeloComercial: {
      ...(mcOrigem || {}),
      versao: Math.max(676, Number(mcOrigem?.versao || 0)),
      contato: { ...(mcOrigem?.contato || {}), id: contatoId, tipo: "corretor-parceiro" },
      relacionamento: {
        ...(mcOrigem?.relacionamento || {}),
        status: "ativo",
        motivo: `Parceria ativa. Nova oportunidade registrada para ${compradorFinal}.`
      }
    }
  };
  await supabase
    .from("whatsapp_processamentos")
    .update({ resultado_analise: origemAtualizada, atualizado_em: now.toISOString(), updated_at: now.toISOString() })
    .eq("id", idOrigem)
    .eq("organization_id", organizationId);

  return json(res, 200, {
    ok: true,
    id: novoId,
    oportunidadeId,
    contatoId,
    compradorFinal,
    produto
  });
}

// ============ ATUALIZAR LEAD EXISTENTE COM EVOLUÇÃO (reimportação) ============
// O corretor reimporta a conversa ao fim de um novo atendimento. Em vez de criar
// um lead duplicado, atualizamos o existente, comparando a análise anterior com a
// nova pra registrar o que aconteceu (Aprendizado §23).
async function acaoAtualizarComEvolucao(body, res, organizationId) {
  const id = body?.id;
  const result = body?.result;
  if (!id) return json(res, 400, { ok: false, error: "Informe id do lead a atualizar." });
  if (!result || typeof result !== "object") return json(res, 400, { ok: false, error: "Informe result com a nova análise." });

  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const { data: current, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise, etapa, timeline_json, atualizado_em, updated_at")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const anterior = current.resultado_analise || {};
  let nova = result.analysis || {};

  // JUNTA a conversa que já estava salva com a do novo arquivo — sem perder mensagem
  // e sem repetir. Antes, a timeline nova SUBSTITUÍA a antiga: se os dois exports tinham
  // trechos diferentes (ex.: WhatsApp Business x WhatsApp normal, ou números diferentes),
  // o trecho que só estava no arquivo antigo se perdia. Agora os dois se somam.
  const timelineAntiga = Array.isArray(current.timeline_json) ? current.timeline_json : [];
  const timelineNova = Array.isArray(result.timeline) ? result.timeline : [];
  // v956: usa a mesma mescla de _persistence.js (_mesclarTimelinesV681), em vez da versão local
  // mais simples que existia aqui — essa já resolve a v900 ("mensagem enviada" copiada/sugestão
  // sendo substituída pela mensagem REAL do WhatsApp quando a reimportação a traz). Esse fluxo
  // (atualizar-com-evolucao) é o caminho mais comum de reimportação de lead já existente; a
  // versão local não tinha essa proteção, então o v900 não valia pra ele.
  const { timeline: novaTimeline, preservadasDoAntigo } = _mesclarTimelinesV681(timelineAntiga, timelineNova);

  // Mensagens novas (as que NÃO estavam na conversa salva) = o que a IA usa pra avaliar o que mudou.
  const chavesAntigas = new Set(timelineAntiga.map(_assinaturaTimelineV681));
  const novasMensagens = timelineNova.filter(m => !chavesAntigas.has(_assinaturaTimelineV681(m)));
  const importId = String(body?.importId || "") || null;
  const consolidadaEm = new Date().toISOString();
  const importacaoPendente = {
    acao: "atualizar-existente",
    importId,
    mensagensNovas: novasMensagens.length,
    status: "conversa-consolidada-aguardando-reanalise",
    consolidadaEm
  };

  // Primeiro salva a linha do tempo consolidada, preservando integralmente a análise e os
  // dados operacionais existentes. Só depois a IA é chamada sobre esta conversa já persistida.
  // v1023 — exceção: confirmedAppointments não sobrevive nem neste estado intermediário
  // (agendamento só por clique explícito em Agenda, nunca herdado de uma análise antiga).
  const analiseDuranteReprocessamento = { ...anterior, confirmedAppointments: [], _importacaoPendente: importacaoPendente };
  const payloadConsolidacao = {
    resultado_analise: analiseDuranteReprocessamento,
    timeline_json: novaTimeline,
    texto_extraido: novaTimeline.map(m => `[${m.date || ""} ${m.time || ""}] ${m.author || ""}: ${m.text || ""}`).join("\n"),
    atualizado_em: consolidadaEm,
    updated_at: consolidadaEm
  };
  if (result.audiosEncontrados != null) payloadConsolidacao.audios_encontrados = result.audiosEncontrados;
  if (result.audiosTranscritos != null) payloadConsolidacao.audios_transcritos = result.audiosTranscritos;
  const consolidacao = await supabase
    .from("whatsapp_processamentos")
    .update(payloadConsolidacao)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (consolidacao.error || !consolidacao.data?.id) {
    return json(res, 500, { ok: false, recoverable: true, error: consolidacao.error?.message || "A conversa consolidada não foi confirmada no banco." });
  }

  // A análise exibida na tela já foi gerada e validada pelo pipeline com as regras do
  // Cérebro. A atualização deve salvar exatamente esse resultado, sem nova chamada à IA.
  // Era a segunda chamada abaixo que gerava o 422 depois de todas as etapas verdes.
  try {
    nova = obterAnaliseValidadaDaImportacao(result);
  } catch (error) {
    return json(res, 422, {
      ok: false,
      recoverable: true,
      conversationSaved: true,
      error: "A conversa foi preservada, mas o resultado recebido não contém as três mensagens validadas.",
      details: error?.message || String(error)
    });
  }

  // Na v669 a própria análise já recebeu o contexto anterior + somente as novidades.
  // Não faz uma segunda chamada de IA para comparar evolução: registra a mudança de forma
  // determinística e evita cobrança duplicada. Mantém o comparador antigo só para fluxos legados.
  let evolucaoEntry = null;
  const metaIncremental = result?.incrementalMeta;
  if (metaIncremental?.reimportacao && novasMensagens.length === 0) {
    evolucaoEntry = null;
  } else if (metaIncremental?.reimportacao) {
    const ordemEtapa = { novo: 0, atendimento: 1, "visita/proposta": 2, negociacao: 3, vendido: 4 };
    const etapaKey = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const etapaAnt = etapaKey(anterior?.etapaSugerida || anterior?.lead?.etapa);
    const etapaNova = etapaKey(nova?.etapaSugerida || nova?.lead?.etapa);
    const posAnt = ordemEtapa[etapaAnt];
    const posNova = ordemEtapa[etapaNova];
    let evoluiu = "estagnou";
    if (Number.isFinite(posAnt) && Number.isFinite(posNova)) {
      if (posNova > posAnt) evoluiu = "avancou";
      else if (posNova < posAnt) evoluiu = "reclassificado";
    }
    const nomeLead = String(anterior?.clientName || anterior?.lead?.clientName || "").toLowerCase().split(/\s+/)[0];
    const clienteFalou = novasMensagens.some(m => {
      const autor = String(m?.author || "").toLowerCase();
      if (!autor) return false;
      if (nomeLead && (autor.includes(nomeLead) || nomeLead.includes(autor))) return true;
      return !/(construtora|corretor|imobili|atendimento|sistema)/i.test(autor);
    });
    evolucaoEntry = {
      houveResposta: clienteFalou,
      comoReagiu: clienteFalou ? "houve nova interação do cliente" : "sem nova resposta identificada do cliente",
      abordagemFuncionou: "sem-dados",
      evoluiu,
      oQueMudou: `${novasMensagens.length} mensagem(ns) nova(s) incorporada(s) na atualização incremental`,
      licao: "Atualização incremental registrada sem reprocessar o histórico antigo.",
      comparadoEm: new Date().toISOString(),
      incremental: true
    };
  } else {
    // Registro determinístico da evolução. Salvar uma importação não faz nova chamada à IA.
    const nomeLead = String(anterior?.clientName || anterior?.lead?.clientName || "").toLowerCase().split(/\s+/)[0];
    const clienteFalou = novasMensagens.some(m => {
      const autor = String(m?.author || "").toLowerCase();
      if (!autor) return false;
      if (nomeLead && (autor.includes(nomeLead) || nomeLead.includes(autor))) return true;
      return !/(construtora|corretor|imobili|atendimento|sistema)/i.test(autor);
    });
    evolucaoEntry = novasMensagens.length ? {
      houveResposta: clienteFalou,
      comoReagiu: clienteFalou ? "houve nova interação do cliente" : "sem nova resposta identificada do cliente",
      abordagemFuncionou: "sem-dados",
      evoluiu: "atualizado",
      oQueMudou: `${novasMensagens.length} mensagem(ns) nova(s) incorporada(s)`,
      licao: "Conversa atualizada com a análise já validada na importação.",
      comparadoEm: new Date().toISOString(),
      incremental: true
    } : null;
  }

  // Preserva o que é do relacionamento (não vem da análise nova)
  // Memória: mantém o que o corretor digitou; preenche campos vazios com o que a IA extraiu da conversa.
  const memAnterior = anterior.memoria || {};
  const memIA = nova.memoriaSugerida || {};
  const mesclarCampo = (manual, ia) => {
    const m = String(manual || "").trim();
    if (m) return m;            // anotação manual manda
    return String(ia || "").trim();
  };
  const memoriaMesclada = {
    preferencias: mesclarCampo(memAnterior.preferencias, memIA.preferencias),
    pessoasDecisao: mesclarCampo(memAnterior.pessoasDecisao, memIA.pessoasDecisao),
    pontosSensiveis: mesclarCampo(memAnterior.pontosSensiveis, memIA.pontosSensiveis),
    observacoes: mesclarCampo(memAnterior.observacoes, [memIA.momentoDeVida, memIA.faixaValor, memIA.observacoes].filter(Boolean).join(" · ")),
    atualizadoEm: new Date().toISOString()
  };
  // Mantém a tag [tipo-contato:X] manual se existia
  const tagMatch = String(memAnterior.observacoes || "").match(/\[tipo-contato:[a-z-]+\]/);
  if (tagMatch && !memoriaMesclada.observacoes.includes(tagMatch[0])) {
    memoriaMesclada.observacoes = (tagMatch[0] + " " + memoriaMesclada.observacoes).trim();
  }

  const preservado = {
    memoria: memoriaMesclada,
    aprendizado: anterior.aprendizado || undefined,
    venda: anterior.venda || undefined,
    // v1069 — bug real relatado (lead "Beato Broks Imobiliária" com lembrete que o corretor
    // nunca agendou): esta função carregava QUALQUER lembrete antigo pra frente sem checar se
    // ele era "auto" (resíduo da extração automática por texto, removida na v988 — mesmo
    // princípio já aplicado em aplicarLembrete, api/reanalisar-lead.js:490-493). Reimportar uma
    // conversa de um lead já existente (o caminho mais comum de reimportação) reintroduzia esse
    // lixo antigo como se fosse um agendamento de verdade.
    // IMPORTANTE: usa null (não undefined) quando descarta — "merged" abaixo é montado com
    // {...anterior, ...nova, ...preservado (sem as chaves undefined)}; um undefined aqui seria
    // filtrado e o ...anterior anterior a ele voltaria a valer, repropagando o lembrete auto de
    // qualquer jeito. null sobrevive ao filtro e realmente limpa o campo.
    lembrete: (anterior.lembrete && anterior.lembrete.auto !== true) ? anterior.lembrete : null
  };
  const historicoEvolucao = Array.isArray(anterior.evolucao) ? anterior.evolucao.slice(-20) : [];
  if (evolucaoEntry) historicoEvolucao.push(evolucaoEntry);

  const historicoAnalises = Array.isArray(anterior._historicoAnalises) ? anterior._historicoAnalises.slice(-19) : [];
  if (anterior && Object.keys(anterior).length) {
    historicoAnalises.push({
      analisadaEm: anterior.mensagensValidadasEm || anterior._atualizadoEm || current.atualizado_em || current.updated_at || null,
      summary: anterior.summary || null,
      produtoInteresse: anterior.produtoInteresse || anterior?.diagnostico?.produtoAtual || null,
      etapaSugerida: anterior.etapaSugerida || anterior?.diagnostico?.etapaFunil || null,
      diagnostico: anterior.diagnostico || null,
      messages: anterior.messages || null
    });
  }
  const concluidaEm = new Date().toISOString();
  const eventoImportacao = {
    acao: "atualizar-existente",
    importId,
    mensagensNovas: novasMensagens.length,
    status: "concluida",
    concluidaEm
  };
  const historicoImportacoes = Array.isArray(anterior._historicoImportacoes) ? anterior._historicoImportacoes.slice(-49) : [];
  historicoImportacoes.push(eventoImportacao);

  const merged = {
    ...anterior,
    ...nova,
    ...Object.fromEntries(Object.entries(preservado).filter(([, v]) => v !== undefined)),
    evolucao: historicoEvolucao,
    _historicoAnalises: historicoAnalises,
    _historicoImportacoes: historicoImportacoes,
    _ultimaImportacao: eventoImportacao,
    _storageRefs: mergeStorageRefs(anterior?._storageRefs, nova?._storageRefs),
    _atualizadoEm: concluidaEm,
    // v1024 — "Última análise" (cp865UltimaAnaliseISO, em app.js) prioriza reanalisadoEm sobre
    // geradoEm. nova (vinda de finalizarAnaliseDaConversa) só traz geradoEm — sem isto aqui, um
    // reanalisadoEm ANTIGO (de uma reanálise manual anterior, via api/reanalisar-lead.js)
    // sobrevivia ao "...anterior" e ficava PRA SEMPRE na frente do geradoEm fresco desta
    // reimportação, mostrando uma data velha mesmo com a conversa acabada de reimportar/reanalisar
    // (bug relatado pelo dono: reimportou e "Última análise" continuou com a data de 9 dias atrás).
    reanalisadoEm: concluidaEm,
    // v1023 — agendamento só nasce de clique explícito em Agenda, nunca de texto/reanálise.
    confirmedAppointments: []
  };
  delete merged._importacaoPendente;



  // Produto: queremos sempre um NOME PRÓPRIO do empreendimento, nunca uma descrição ("apartamento de 2 dormitórios").
  const semProduto = (p) => { const s = String(p || "").toLowerCase().trim(); return !s || s.includes("não identificado") || s.includes("nao identificado"); };
  // Heurística: descrição = começa com tipo de imóvel ou tem palavras de característica, sem cara de nome próprio.
  const ehDescricao = (p) => {
    const s = String(p || "").toLowerCase().trim();
    if (!s) return false;
    if (/^(apartamento|ap\b|apê|apto|casa|cobertura|terreno|lote|sala|sobrado|kitnet|sítio|chácara|imóvel|imovel)\b/.test(s)) return true;
    if (/\b(dormit|quartos?|suíte|suite|garagem|box|metros|m²|m2|vaga)\b/.test(s)) return true;
    return false;
  };
  // Tenta achar um nome próprio do imóvel na observação do corretor (ex.: "...chamado Gabro", "Residencial X").
  const nomeDaObs = (obs) => {
    const t = String(obs || "");
    let m = t.match(/\b(?:chamad[oa]|nome de|empreendimento|residencial|edif[íi]cio|ed\.)\s+([A-ZÁÉÍÓÚÂ][\wÀ-ÿ]+(?:\s+[A-ZÁÉÍÓÚÂ][\wÀ-ÿ]+)?)/);
    if (m) return m[1].trim();
    return "";
  };

  const novoProd = nova.produtoInteresse;
  if (semProduto(novoProd) || ehDescricao(novoProd)) {
    // 1ª escolha: nome próprio na observação. 2ª: o produto anterior, se já era um nome (não descrição).
    const obsTxt = memoriaMesclada.observacoes || memAnterior.observacoes || "";
    const nomeObs = nomeDaObs(obsTxt);
    if (nomeObs) {
      merged.produtoInteresse = nomeObs;
    } else if (!semProduto(anterior.produtoInteresse) && !ehDescricao(anterior.produtoInteresse)) {
      merged.produtoInteresse = anterior.produtoInteresse;
    } else if (ehDescricao(novoProd)) {
      // sem nome em lugar nenhum: melhor "Não identificado" do que mostrar uma descrição
      merged.produtoInteresse = "Não identificado";
    }
  }
  if ((!Array.isArray(nova.produtosInteresse) || !nova.produtosInteresse.length) && Array.isArray(anterior.produtosInteresse) && anterior.produtosInteresse.length) {
    merged.produtosInteresse = anterior.produtosInteresse;
  }

  // Nome: NUNCA troca um nome BOM já salvo por um nome RUIM da nova importação. Acontece quando o
  // export novo vem só com o NÚMERO do contato (sem o nome) — antes isso apagava o nome do lead.
  const pareceTelefoneNome = (n) => { const s = String(n || "").trim(); const dig = s.replace(/\D/g, ""); const letras = s.replace(/[^a-zA-ZÀ-ÿ]/g, ""); return dig.length >= 8 && letras.length < 3; };
  const nomeRuim = (n) => { const s = String(n || "").trim(); return !s || /^cliente importado$/i.test(s) || pareceTelefoneNome(s); };
  const nomeAnterior = anterior.clientName || anterior?.lead?.clientName || "";
  // Reimportar NÃO deve trocar o nome que o corretor já curou na carteira. O nome salvo no
  // contato do WhatsApp costuma vir bagunçado ("Elisandro Altmann Altan"); o nome que já
  // estava no lead manda. Só adota o nome do arquivo quando o do lead estava vazio/ruim.
  if (!nomeRuim(nomeAnterior)) {
    merged.clientName = nomeAnterior;
    merged.lead = { ...(merged.lead || {}), clientName: nomeAnterior };
  }

  const updatePayload = {
    resultado_analise: merged,
    timeline_json: novaTimeline,
    atualizado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  // Texto cru reconstruído da conversa JÁ JUNTADA (mesmo formato do pipeline), pra não
  // perder as mensagens do arquivo antigo que não vinham no novo rawText.
  updatePayload.texto_extraido = novaTimeline.map(m => `[${m.date || ""} ${m.time || ""}] ${m.author}: ${m.text}`).join("\n");
  if (result.audiosEncontrados != null) updatePayload.audios_encontrados = result.audiosEncontrados;
  if (result.audiosTranscritos != null) updatePayload.audios_transcritos = result.audiosTranscritos;

  const { data: persistedRow, error: putErr } = await supabase
    .from("whatsapp_processamentos")
    .update(updatePayload)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id,resultado_analise,timeline_json,atualizado_em,updated_at")
    .maybeSingle();
  if (putErr) return json(res, 500, { ok: false, recoverable: true, conversationSaved: true, error: putErr.message });
  if (!persistedRow?.id) {
    return json(res, 409, { ok:false, recoverable:true, conversationSaved:true, error:"O banco não confirmou a atualização do cliente." });
  }
  const persistedAnalysis = persistedRow.resultado_analise || {};
  const persistedImportId = String(persistedAnalysis?._ultimaImportacao?.importId || "");
  const persistedTimeline = Array.isArray(persistedRow.timeline_json) ? persistedRow.timeline_json : [];
  if ((importId && persistedImportId !== importId) || persistedTimeline.length < novaTimeline.length) {
    return json(res, 409, {
      ok:false,
      recoverable:true,
      conversationSaved:persistedTimeline.length >= novaTimeline.length,
      error:"A atualização não foi confirmada integralmente no banco. Tente novamente; o arquivo temporário foi mantido.",
      esperado:{ importId, mensagens:novaTimeline.length },
      confirmado:{ importId:persistedImportId || null, mensagens:persistedTimeline.length }
    });
  }

  // A timeline já está persistida. A leitura pela IA entra numa fila separada para
  // não atrasar nem fazer a reimportação expirar. O app processa essa fila na sequência.
  const aprendizadoAutomatico = await marcarAprendizadoPendente({ leadId: String(id), motivo: "reimportacao", organizationId })
    .catch(e => ({ ok:false, error:e?.message || String(e) }));

  return json(res, 200, {
    ok: true, id, evolucao: evolucaoEntry, totalEvolucoes: historicoEvolucao.length,
    aprendizadoAutomatico,
    // Quantas mensagens vieram só da conversa antiga (que o arquivo novo não trazia).
    // Se > 0, o frontend reanalisa em segundo plano pra a análise refletir tudo que foi juntado.
    preservadasDoAntigo,
    totalMensagens: persistedTimeline.length,
    persistedAt: persistedRow.atualizado_em || persistedRow.updated_at || concluidaEm,
    importIdConfirmado: persistedImportId || null
  });
}

// ============ ETAPA ============
async function acaoEtapa(id, etapa, res, organizationId) {
  if (!ETAPAS_VALIDAS.includes(etapa)) {
    return json(res, 400, { ok: false, error: `Etapa inválida. Use uma de: ${ETAPAS_VALIDAS.join(", ")}` });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const direta = await supabase
    .from("whatsapp_processamentos")
    .update({ etapa, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (direta.error && /column .* does not exist|etapa.*does not exist/i.test(direta.error.message || "")) {
    const { data: current, error: getErr } = await supabase
      .from("whatsapp_processamentos")
      .select("resultado_analise")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (getErr) return json(res, 500, { ok: false, error: getErr.message });
    if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });
    const merged = { ...(current.resultado_analise || {}) };
    merged.confirmedAppointments = []; // v1023 — nunca sobrevive a nenhuma gravação
    merged.lead = { ...(merged.lead || {}), etapa };
    const { error: putErr } = await supabase
      .from("whatsapp_processamentos")
      .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (putErr) return json(res, 500, { ok: false, error: putErr.message });
    return json(res, 200, { ok: true, id, etapa, storage: "json" });
  }

  if (direta.error) return json(res, 500, { ok: false, error: direta.error.message });
  if (!direta.data) return json(res, 404, { ok: false, error: "Lead não encontrado." });
  return json(res, 200, { ok: true, id, etapa, storage: "column" });
}

// ============ MEMÓRIA ============
async function acaoMemoriaGet(id, res, organizationId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });
  const { data, error } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return json(res, 500, { ok: false, error: error.message });
  if (!data) return json(res, 404, { ok: false, error: "Lead não encontrado." });
  const memoria = data.resultado_analise?.memoria || { preferencias: "", pessoasDecisao: "", pontosSensiveis: "", observacoes: "" };
  return json(res, 200, { ok: true, id, memoria });
}

function dataHoraSaoPaulo(date = new Date()) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', hour12:false, hourCycle:'h23'
  }).formatToParts(date).reduce((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
  return { dataBR:`${partes.day}/${partes.month}/${partes.year}`, horaBR:`${partes.hour}:${partes.minute}` };
}

function camposManuaisMemoria(memoria, campos = []) {
  return [...new Set([...(Array.isArray(memoria?.camposManuais) ? memoria.camposManuais : []), ...campos].filter(Boolean))];
}

async function acaoMemoriaSet(id, body, res, organizationId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const MAX = 5000;
  const clip = (v) => String(v || "").slice(0, MAX);
  const { data: current, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const anterior = current.resultado_analise || {};
  const memAnterior = anterior.memoria || {};
  const agora = new Date().toISOString();
  const permitidos = ["preferencias", "pessoasDecisao", "pontosSensiveis", "observacoes"];
  const informadosPeloFront = Array.isArray(body.camposAlterados) ? body.camposAlterados.filter(k => permitidos.includes(k)) : null;
  const camposRecebidos = informadosPeloFront || permitidos.filter(k =>
    Object.prototype.hasOwnProperty.call(body, k) && clip(body[k]) !== clip(memAnterior[k])
  );
  const memoria = {
    ...memAnterior,
    preferencias: Object.prototype.hasOwnProperty.call(body, "preferencias") ? clip(body.preferencias) : clip(memAnterior.preferencias),
    pessoasDecisao: Object.prototype.hasOwnProperty.call(body, "pessoasDecisao") ? clip(body.pessoasDecisao) : clip(memAnterior.pessoasDecisao),
    pontosSensiveis: Object.prototype.hasOwnProperty.call(body, "pontosSensiveis") ? clip(body.pontosSensiveis) : clip(memAnterior.pontosSensiveis),
    observacoes: Object.prototype.hasOwnProperty.call(body, "observacoes") ? clip(body.observacoes) : clip(memAnterior.observacoes),
    camposManuais: camposManuaisMemoria(memAnterior, camposRecebidos),
    manualAtualizadoEm: camposRecebidos.length ? agora : memAnterior.manualAtualizadoEm,
    atualizadoEm: agora
  };

  // v1023 — agendamento só nasce de clique explícito em Agenda, nunca sobrevive a uma gravação
  // (isto aqui é só edição de memória/observação — nunca deveria mesmo tocar em agendamento).
  const merged = { ...anterior, memoria, confirmedAppointments: [] };
  const { error: putErr } = await supabase
    .from("whatsapp_processamentos")
    .update({ resultado_analise: merged, atualizado_em: agora })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (putErr) return json(res, 500, { ok: false, error: putErr.message });

  // A observação/manual entra na mesma fila do aprendizado contínuo. Não reanalisa
  // o lead e não troca as três sugestões que já estão na tela.
  const aprendizadoAutomatico = camposRecebidos.length
    ? await marcarAprendizadoPendente({ leadId:String(id), motivo:"memoria-manual-atualizada", organizationId }).catch(e => ({ ok:false, error:e?.message || String(e) }))
    : { ok:true, ignorado:true, motivo:"nenhum-campo-manual-alterado" };
  return json(res, 200, { ok: true, id, memoria, camposAlterados:camposRecebidos, aprendizadoAutomatico, reanalisado:false });
}

async function acaoObservacaoAdicionar(id, body, res, organizationId) {
  const texto = String(body?.texto || body?.observacao || "").replace(/\r/g, "").trim().slice(0, 5000);
  if (!texto) return json(res, 400, { ok:false, error:"Escreva a observação." });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok:false, error:"Supabase não configurado." });

  const { data: current, error:getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise,timeline_json")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok:false, error:getErr.message });
  if (!current) return json(res, 404, { ok:false, error:"Lead não encontrado." });

  const agora = new Date();
  const iso = agora.toISOString();
  const { dataBR, horaBR } = dataHoraSaoPaulo(agora);
  const timeline = Array.isArray(current.timeline_json) ? [...current.timeline_json] : [];
  const maiorOrder = timeline.reduce((m, x) => Math.max(m, Number(x?.order || x?.id || 0) || 0), 0);
  const item = {
    id:`obs-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    order:maiorOrder + 1,
    date:dataBR,
    time:horaBR,
    iso,
    author:String(body?.autor || "Observação do corretor").slice(0,80),
    text:texto,
    type:"observacao_manual",
    source:"corretor-pro-manual",
    manual:true
  };
  timeline.push(item);

  const analysis = current.resultado_analise || {};
  const memAnterior = analysis.memoria || {};
  const observacoesManuais = Array.isArray(memAnterior.observacoesManuais) ? [...memAnterior.observacoesManuais] : [];
  observacoesManuais.push({ id:item.id, texto, criadoEm:iso, dataBR, horaBR });
  const linha = `[${dataBR} ${horaBR}] ${texto}`;
  const obsAnterior = String(memAnterior.observacoes || "").trim();
  const memoria = {
    ...memAnterior,
    observacoes: obsAnterior ? `${obsAnterior}\n${linha}`.slice(-5000) : linha,
    observacoesManuais: observacoesManuais.slice(-100),
    // A observação exata já está em observacoesManuais e na timeline. Não transforma
    // automaticamente todo o texto antigo de `observacoes` (que pode conter inferências
    // históricas da IA) em informação manual confirmada.
    camposManuais: camposManuaisMemoria(memAnterior, []),
    manualAtualizadoEm:iso,
    atualizadoEm:iso
  };
  // Pedido do dono: salvar observação marca o lead como atendido, igual já acontece no botão
  // "Marcar atendimento" (detalhes.de:"botao_atendido") e ao copiar mensagem (de:"copiar_msg")
  // em api/reanalisar-lead.js. Mesmo evento contato_manual, mesma fila que ultimoAtendimentoTs
  // (app.js) já lê — sem isso, salvar uma observação não contava como ter atendido o cliente.
  const aprendizadoAnterior = analysis.aprendizado || {};
  const eventosAnteriores = Array.isArray(aprendizadoAnterior.eventos) ? [...aprendizadoAnterior.eventos] : [];
  eventosAnteriores.push({
    evento: "contato_manual",
    estilo: null,
    detalhes: { tipo: "Observação", de: "observacao_manual" },
    quando: iso
  });
  const aprendizado = { ...aprendizadoAnterior, eventos: eventosAnteriores.slice(-50) };
  // v1023 — agendamento só nasce de clique explícito em Agenda, nunca sobrevive a uma gravação.
  const merged = { ...analysis, memoria, aprendizado, _atualizadoEm:iso, confirmedAppointments:[] };
  const { error:putErr } = await supabase
    .from("whatsapp_processamentos")
    .update({ resultado_analise:merged, timeline_json:timeline, atualizado_em:iso })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (putErr) return json(res, 500, { ok:false, error:putErr.message });

  const aprendizadoAutomatico = await marcarAprendizadoPendente({ leadId:String(id), motivo:"observacao-manual-adicionada", organizationId })
    .catch(e => ({ ok:false, error:e?.message || String(e) }));
  return json(res, 200, { ok:true, id, item, memoria, aprendizadoAutomatico, reanalisado:false });
}



// ============ APRENDIZADO ============
async function acaoAprendizado(id, body, res, organizationId) {
  const evento = body?.evento;
  const estilo = body?.estilo;
  const detalhes = body?.detalhes || {};
  if (!evento) return json(res, 400, { ok: false, error: "Informe evento." });

  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const { data: current, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const merged = { ...(current.resultado_analise || {}) };
  merged.confirmedAppointments = []; // v1023 — nunca sobrevive a nenhuma gravação
  const aprendizado = merged.aprendizado || { eventos: [] };
  aprendizado.eventos = aprendizado.eventos || [];
  const eventoLimpo = String(evento).slice(0, 100);
  const estiloLimpo = estilo ? String(estilo).slice(0, 50) : null;
  const detalhesLimpos = (() => {
    try {
      const s = JSON.stringify(detalhes || {});
      return s.length > 2000 ? { _trimmed: true, preview: s.slice(0, 500) } : detalhes;
    } catch (_) { return {}; }
  })();
  aprendizado.eventos.push({
    evento: eventoLimpo,
    estilo: estiloLimpo,
    detalhes: detalhesLimpos,
    quando: new Date().toISOString()
  });
  if (aprendizado.eventos.length > 50) {
    aprendizado.eventos = aprendizado.eventos.slice(-50);
  }
  merged.aprendizado = aprendizado;

  const { error: putErr } = await supabase
    .from("whatsapp_processamentos")
    .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (putErr) return json(res, 500, { ok: false, error: putErr.message });
  return json(res, 200, { ok: true, totalEventos: aprendizado.eventos.length });
}

// ============ APAGAR ============
// Edita nome e telefone do lead. Tenta atualizar colunas diretas (se existirem);
// sempre mescla também em resultado_analise pra garantir consistência com o front.
async function acaoEditarDados(id, body, res, organizationId) {
  const nome = typeof body?.nome === "string" ? body.nome.trim().slice(0, 120) : null;
  const telefone = typeof body?.telefone === "string" ? body.telefone.trim().slice(0, 40) : null;
  // Produto/empreendimento definido na mão pelo corretor (quando a IA não identificou).
  const produto = typeof body?.produto === "string" ? body.produto.trim().slice(0, 80) : null;
  if (!nome && !telefone && !produto) return json(res, 400, { ok: false, error: "Informe nome, telefone ou produto pra editar." });

  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const { data: current, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const merged = { ...(current.resultado_analise || {}) };
  merged.confirmedAppointments = []; // v1023 — nunca sobrevive a nenhuma gravação
  if (nome != null) merged.clientName = nome;
  if (!merged.lead || typeof merged.lead !== "object") merged.lead = {};
  if (nome != null) merged.lead.clientName = nome;
  if (telefone != null) merged.lead.phone = telefone;
  // Produto definido na mão tem prioridade máxima na exibição (productFrom usa produtoInteresse primeiro).
  if (produto) {
    merged.produtoInteresse = produto;
    merged.product = produto;
    merged.lead.product = produto;
  }

  // Tenta atualizar colunas diretas (se existirem), caindo no merge se a coluna não existe
  const updates = { resultado_analise: merged, atualizado_em: new Date().toISOString() };
  if (nome != null) updates.nome_cliente = nome;
  if (telefone != null) updates.telefone = telefone;

  let attempt = await supabase.from("whatsapp_processamentos").update(updates).eq("id", id).eq("organization_id", organizationId).select("id").maybeSingle();
  if (attempt.error && /column .* does not exist|nome_cliente|telefone/i.test(attempt.error.message || "")) {
    // sem colunas diretas — salva só o merged
    attempt = await supabase
      .from("whatsapp_processamentos")
      .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
  }
  if (attempt.error) return json(res, 500, { ok: false, error: attempt.error.message });
  return json(res, 200, { ok: true, nome, telefone, produto });
}

function erroTabelaAusente(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return /relation .* does not exist|table .* does not exist|could not find the table|schema cache/.test(msg);
}

async function apagarTabelaAuxiliar(supabase, tabela, ids) {
  if (!ids.length) return { tabela, apagados: 0 };
  const { error } = await supabase.from(tabela).delete().in("id", ids);
  if (!error || erroTabelaAusente(error)) return { tabela, apagados: error ? 0 : ids.length, ausente: !!error };
  throw new Error(`${tabela}: ${error.message}`);
}

async function listarArquivosStorage(storage, prefixo, saida, visitados = new Set()) {
  const prefix = String(prefixo || "").replace(/^\/+|\/+$/g, "");
  if (visitados.has(prefix)) return;
  visitados.add(prefix);
  let offset = 0;
  for (;;) {
    const { data, error } = await storage.list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) {
      // Prefixo inexistente já está limpo.
      if (/not found|does not exist/i.test(String(error.message || ""))) return;
      throw new Error(`Storage ${prefix || "/"}: ${error.message}`);
    }
    const itens = data || [];
    for (const item of itens) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id || item.metadata) saida.add(fullPath);
      else await listarArquivosStorage(storage, fullPath, saida, visitados);
    }
    if (itens.length < 1000) break;
    offset += itens.length;
  }
}

function idsImportacaoDoRegistro(row) {
  const analysis = row?.resultado_analise || {};
  const refs = analysis?._storageRefs && typeof analysis._storageRefs === "object" ? analysis._storageRefs : {};
  const ids = new Set();
  for (const value of refs.importIds || []) if (value) ids.add(String(value));
  for (const evt of analysis?._historicoImportacoes || []) if (evt?.importId) ids.add(String(evt.importId));
  if (analysis?._ultimaImportacao?.importId) ids.add(String(analysis._ultimaImportacao.importId));
  const path = String(row?.storage_path || "");
  const match = path.match(/(?:^|\/)whatsapp\/imports\/([^/]+)\//i);
  if (match?.[1]) ids.add(match[1]);
  return [...ids].filter(v => /^[a-zA-Z0-9][a-zA-Z0-9._-]{7,120}$/.test(v));
}

async function apagarStorageDosLeads(supabase, rows, organizationId) {
  const defaultBucket = String(process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips").trim() || "whatsapp-zips";
  const porBucket = new Map();
  let precisaLimparCacheLegado = false;
  for (const row of rows) {
    const analysis = row?.resultado_analise || {};
    const refs = analysis?._storageRefs && typeof analysis._storageRefs === "object" ? analysis._storageRefs : null;
    const bucket = String(refs?.bucket || row?.storage_bucket || defaultBucket).trim() || defaultBucket;
    if (!porBucket.has(bucket)) porBucket.set(bucket, { paths: new Set(), prefixes: new Set(), caches: new Set() });
    const alvo = porBucket.get(bucket);
    if (row?.storage_path) alvo.paths.add(String(row.storage_path));
    for (const path of refs?.sourceZipPaths || []) if (path) alvo.paths.add(String(path));
    for (const path of refs?.transcriptionCachePaths || []) if (path) alvo.caches.add(String(path));
    const importIds = idsImportacaoDoRegistro(row);
    for (const importId of importIds) {
      // v1082 — desde a separação por empresa, a importação vive em
      // organizations/<empresa>/imports/<id>/ (ver api/processar-storage.js). Só os dois prefixos
      // antigos estavam listados aqui, então NENHUM arquivo de importação inacabada era apagado
      // junto com o lead — e o manifesto guarda a conversa inteira já lida. Os prefixos antigos
      // continuam na lista pra limpar o que ficou do layout anterior.
      alvo.prefixes.add(`organizations/${organizationId}/imports/${importId}`);
      alvo.prefixes.add(`whatsapp/organizations/${organizationId}/imports/${importId}`);
      alvo.prefixes.add(`imports/${importId}`);
      alvo.prefixes.add(`whatsapp/imports/${importId}`);
    }
    // v911 e anteriores não guardavam a relação hash → lead. Para garantir a exclusão
    // de dados pessoais antigos, limpa o cache compartilhado uma vez quando faltar essa referência.
    // v1082 — "transcription-cache/" é a pasta GLOBAL de antes da separação por empresa (hoje as
    // transcrições novas vão pra organizations/<empresa>/transcription-cache/). O conteúdo dela é
    // da conta original. Como esta varredura era disparada sempre que o lead não tinha
    // _storageRefs — e a reanálise reconstrói a análise sem esse campo, ou seja, todo lead já
    // reanalisado se encaixa —, apagar um lead em QUALQUER conta varria a pasta global inteira: a
    // conta original perdia as transcrições reaproveitáveis e pagava a transcrição de novo na
    // próxima importação. Só a dona daquela pasta pode limpá-la.
    if (organizationId === EMPRESA_PRINCIPAL_ID && (!refs || !Array.isArray(refs.transcriptionCachePaths))) precisaLimparCacheLegado = true;
  }

  let removidos = 0;
  const detalhes = [];
  for (const [bucket, refs] of porBucket) {
    const storage = supabase.storage.from(bucket);
    const paths = new Set([...refs.paths, ...refs.caches]);
    for (const prefix of refs.prefixes) await listarArquivosStorage(storage, prefix, paths);
    if (precisaLimparCacheLegado) await listarArquivosStorage(storage, "transcription-cache", paths);
    const lista = [...paths].filter(Boolean);
    for (let i = 0; i < lista.length; i += 100) {
      const lote = lista.slice(i, i + 100);
      const { data, error } = await storage.remove(lote);
      if (error && !/not found|does not exist/i.test(String(error.message || ""))) {
        throw new Error(`Storage ${bucket}: ${error.message}`);
      }
      removidos += Array.isArray(data) ? data.length : lote.length;
    }
    detalhes.push({ bucket, solicitados: lista.length });
  }
  return { removidos, detalhes, cacheLegadoGlobalLimpo: precisaLimparCacheLegado };
}

async function limparAprendizadoDosLeads(supabase, ids, organizationId) {
  for (const id of ids) {
    const chaves = [
      `corretor-memoria-caso-v2:${String(id).slice(0, 180)}`,
      `corretor-aprendizado-pendente-v2:${String(id).slice(0, 180)}`
    ];
    const { error } = await supabase.from("direciona_config").delete().in("chave", chaves).eq("organization_id", organizationId);
    if (error && !erroTabelaAusente(error)) throw new Error(`direciona_config: ${error.message}`);
  }

  // Bases antigas não registravam a origem de todo aprendizado. Para não manter frases ou
  // conhecimento derivados do lead apagado, remove apenas os blocos automáticos e preserva
  // método, tom, regras, diferenciais e demais campos digitados pelo corretor.
  const { data: cerebroRow, error: cerebroErr } = await supabase
    .from("direciona_config")
    .select("valor")
    .eq("chave", "direciona-cerebro")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (cerebroErr && !erroTabelaAusente(cerebroErr)) throw new Error(`direciona_config: ${cerebroErr.message}`);
  if (cerebroRow?.valor && typeof cerebroRow.valor === "object") {
    const valor = { ...cerebroRow.valor };
    delete valor.inteligenciaAprendida;
    const { error } = await upsertConfigComOrganizacao(supabase, organizationId, {
      chave: "direciona-cerebro",
      valor,
      atualizado_em: new Date().toISOString()
    }) || {};
    if (error) throw new Error(`direciona-cerebro: ${error.message}`);
  }
  const { error: conhecimentoErr } = await supabase.from("direciona_config").delete().eq("chave", "corretor-conhecimento").eq("organization_id", organizationId);
  if (conhecimentoErr && !erroTabelaAusente(conhecimentoErr)) throw new Error(`corretor-conhecimento: ${conhecimentoErr.message}`);
  invalidarMemoriaComercialCache(organizationId);
  invalidarConhecimentoCorretorCache(organizationId); // v1115 — o bloco voltou a ser lido nas análises
}

async function removerVinculosComLeadsApagados(supabase, ids, organizationId) {
  const alvo = new Set(ids.map(String));
  const { data: rows, error } = await supabase
    .from("whatsapp_processamentos")
    .select("id,resultado_analise")
    .eq("organization_id", organizationId)
    .limit(5000);
  if (error) throw new Error(`Vínculos: ${error.message}`);
  let atualizados = 0;
  for (const row of rows || []) {
    const analysis = row?.resultado_analise;
    if (!analysis || typeof analysis !== "object" || !Array.isArray(analysis.oportunidadesVinculadas)) continue;
    const filtradas = analysis.oportunidadesVinculadas.filter(item => !alvo.has(String(item?.leadId || "")) && !alvo.has(String(item?.id || "")));
    if (filtradas.length === analysis.oportunidadesVinculadas.length) continue;
    // v1023 — agendamento só nasce de clique explícito em Agenda, nunca sobrevive a uma gravação.
    const atualizado = { ...analysis, oportunidadesVinculadas: filtradas, confirmedAppointments: [] };
    const { error: updateErr } = await supabase
      .from("whatsapp_processamentos")
      .update({ resultado_analise: atualizado, atualizado_em: new Date().toISOString() })
      .eq("id", row.id)
      .eq("organization_id", organizationId);
    if (updateErr) throw new Error(`Vínculo ${row.id}: ${updateErr.message}`);
    atualizados++;
  }
  return atualizados;
}

async function acaoApagar(id, res, ids, organizationId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });
  const alvoPrincipal = String(id || "");
  const alvosBrutos = [...new Set((Array.isArray(ids) ? ids : []).concat([alvoPrincipal]).map(v => String(v || "")).filter(Boolean))];

  let alvos = [alvoPrincipal];
  const { data: rowsCandidatas, error: buscaErr } = await supabase
    .from("whatsapp_processamentos")
    .select("*")
    .in("id", alvosBrutos)
    .eq("organization_id", organizationId);
  if (buscaErr) return json(res, 500, { ok: false, error: buscaErr.message });
  const rows = Array.isArray(rowsCandidatas) ? rowsCandidatas : [];
  const principal = rows.find(r => String(r.id) === alvoPrincipal);
  if (!principal) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  if (alvosBrutos.length > 1) {
    const ra0 = principal?.resultado_analise || {};
    const nomePrincipal = _nomeIdentity(ra0?.clientName || ra0?.lead?.clientName || principal?.nome_arquivo || principal?.arquivo_nome || "");
    for (const r of rows) {
      const rid = String(r.id);
      if (rid === alvoPrincipal || !nomePrincipal || _nomeRuimIdentity(nomePrincipal)) continue;
      const ra = r.resultado_analise || {};
      const nomeR = _nomeIdentity(ra?.clientName || ra?.lead?.clientName || r.nome_arquivo || r.arquivo_nome || "");
      if (nomeR && !_nomeRuimIdentity(nomeR) && _nomesMesmoLead(nomeR, nomePrincipal)) alvos.push(rid);
    }
  }
  alvos = [...new Set(alvos)];
  const registros = rows.filter(r => alvos.includes(String(r.id)));

  try {
    const storage = await apagarStorageDosLeads(supabase, registros, organizationId);
    await limparAprendizadoDosLeads(supabase, alvos, organizationId);
    const vinculosAtualizados = await removerVinculosComLeadsApagados(supabase, alvos, organizationId);
    const auxiliares = [];
    for (const tabela of ["leads", "direciona_leads"]) auxiliares.push(await apagarTabelaAuxiliar(supabase, tabela, alvos));

    const { error } = await supabase.from("whatsapp_processamentos").delete().in("id", alvos).eq("organization_id", organizationId);
    if (error) throw new Error(error.message);

    // Recria o banco de exemplos apenas com as conversas que continuam na carteira.
    const respostas = await aprenderRespostasDaCarteira(organizationId).catch(error => ({ ok: false, error: error?.message || String(error) }));
    return json(res, 200, {
      ok: true,
      id,
      ids: alvos,
      apagados: alvos.length,
      storage,
      tabelasAuxiliares: auxiliares,
      vinculosAtualizados,
      respostasReconstruidas: respostas
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: `A exclusão total não foi concluída: ${error?.message || String(error)}`,
      ids: alvos
    });
  }
}
