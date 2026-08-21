import { randomUUID } from "node:crypto";
import { resolveOrganizationId, getSupabaseAdmin } from "./_persistence.js";
import { getOpenAI, transcreverBuffer, aprenderComHistoricoReal, obterStatusAprendizadoAutomatico, obterExportacaoAprendizado, marcarBootstrapAprendizadoConcluido, upsertConfigComOrganizacao, APRENDIZADO_PENDENTE_V2_PREFIX, verificarLimiteDiario, limiteTranscricaoVozDoDia, limiteTranscricaoVozDoDiaTeste, lerPrintDaConversa, limitePrintDoDia, limitePrintDoDiaTeste, lerArquivosVisuais, verificarLimiteLeituraVisual, registrarConsumoLeituraVisual, obterPlanoAtual, planoComercial, precoPlano, pacoteExtraBR } from "./_pipeline.js";

const CONFIG_KEY = "direciona-cerebro";

// v1170 — bloco de notas administrativas ("verificar pagamento de entrada, matrícula no
// registro..." — pedido do dono: tarefa que não é atendimento de cliente, então não pode morar
// dentro de um lead nem dentro do Cérebro Comercial). Chave PRÓPRIA, separada de CONFIG_KEY de
// propósito: o Cérebro é o que vira contexto pra IA nas sugestões de mensagem — uma nota
// administrativa ("checar pagamento do fulano") jamais pode ser lida pela IA e vazar pra dentro
// de uma sugestão de mensagem pro cliente. É por isso que isto não vive dentro de "direciona-cerebro".
const NOTAS_KEY = "notas-rapidas";
const MAX_NOTAS = 200;
const MAX_NOTA_TEXTO = 500;

const DEFAULTS = {
  corretorNome: "",
  metodo: "",
  tom: "",
  diferenciais: "",
  evitar: "",
  diasImportacao: 90,
  atendimentosPorDia: 10,
  // v1139 — vagas da dose diária reservadas pro resgate de quem está há mais tempo sem
  // atendimento (0 desliga o resgate).
  resgatesPorDia: 2,
  diasDescansoPosAtendimento: 5,
  // v1337 — fuso horário do corretor. Estava cravado em America/Sao_Paulo no código inteiro, o que
  // dava a hora e o "hoje" errados pra quem atende em Manaus, Cuiabá, Rio Branco ou Fernando de
  // Noronha — e a hora errada vira saudação errada na mensagem sugerida. O padrão continua
  // Brasília: quem nunca mexeu não sente diferença nenhuma.
  fusoHorario: "America/Sao_Paulo",
  // v1091 — dias da semana em que o corretor atende (0=domingo … 6=sábado). Padrão segunda a
  // sexta, que era o comportamento cravado no código antes desta versão.
  diasAtendimento: [1, 2, 3, 4, 5],
  // v1308 — as três chaves de experiência do dono (Cérebro, aprendizado, regras de escrita).
  // Padrão LIGADO nas três: quem nunca mexeu continua exatamente como estava.
  usarCerebro: true,
  usarAprendizado: true,
  usarRegrasEscrita: true,
  // v1310 — quarta chave: o piso comercial do app (a "Inteligência Comercial Base"). Desligada,
  // vai só a conversa — é o teste "igual ao ChatGPT" que o dono pediu. Padrão LIGADO.
  usarPisoComercial: true,
  regrasTexto: "",
  objecoesTexto: "",
  regras: [],
  objecoes: []
};

// Teto defensivo pra nenhum campo livre do Cérebro estourar sozinho o contexto do
// modelo — metodo/tom/diferenciais/evitar nunca tiveram teto (só regrasTexto/objecoesTexto
// tinham, via sanitizarBloco). regrasTexto/objecoesTexto continuam com teto maior porque
// são blocos que naturalmente acumulam mais conteúdo (várias regras/objeções por bloco).
const MAX_CAMPO_LIVRE = 20000;
const MAX_BLOCO_REGRAS = 60000;

function capTexto(v, limite = MAX_CAMPO_LIVRE) {
  return String(v || "").replace(/\u0000/g, "").slice(0, limite);
}

function clampDiasImportacao(v) {
  const n = Number(v);
  return (Number.isFinite(n) && n > 0 && n <= 365) ? Math.round(n) : 90;
}

// v1012 — meta diária do "Fazer agora" é escolha de cada corretor (5, 10, 15...), salva no
// Cérebro dele. Fora da faixa 1–50 (ou vazio) cai no padrão histórico de 10.
function clampAtendimentosDia(v) {
  const n = Number(v);
  return (Number.isFinite(n) && n >= 1 && n <= 50) ? Math.round(n) : 10;
}

// v1139 — vagas de resgate dentro da dose do "Fazer agora" ("como tem atendimento por dia, crie
// resgates por dia" — pedido do dono). 0 é escolha VÁLIDA (desliga o resgate), então só
// vazio/inválido cai no padrão 2 — diferente dos clamps vizinhos, onde 0 é inválido.
function clampResgatesDia(v) {
  if (v == null || String(v).trim() === "") return 2;
  const n = Number(v);
  return (Number.isFinite(n) && n >= 0 && n <= 20) ? Math.round(n) : 2;
}

// v1048 — pedido do dono: quantos dias de "descanso" um lead ganha depois de atendido, antes de
// voltar a disputar a fila "Fazer agora" — era um valor fixo (3 dias pra lead novo, 5 pra
// estabelecido, sem opção de mudar). Agora é UM número, escolhido por cada corretor no Cérebro.
// Fora da faixa 1–60 (ou vazio) cai no padrão histórico de 5.
function clampDiasDescanso(v) {
  const n = Number(v);
  return (Number.isFinite(n) && n >= 1 && n <= 60) ? Math.round(n) : 5;
}

// v1337 — só entram fusos que o próprio navegador/servidor reconhece. Texto inventado (ou vindo de
// um payload adulterado) volta pro padrão de Brasília em vez de quebrar toda formatação de data.
function normalizarFuso(v) {
  const texto = String(v || "").trim();
  if (!texto) return "America/Sao_Paulo";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: texto }).format(new Date());
    return texto.slice(0, 60);
  } catch (_) {
    return "America/Sao_Paulo";
  }
}

// v1091 — lista vazia ou inválida vira o padrão: "não atendo nunca" deixaria o corretor sem fila
// pra sempre, sem entender o motivo.
function normalizarDiasAtendimento(v) {
  if (!Array.isArray(v)) return [1, 2, 3, 4, 5];
  const limpos = [...new Set(v.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  return limpos.length ? limpos : [1, 2, 3, 4, 5];
}

function regrasLegadasParaTexto(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map(r => String(typeof r === "string" ? r : (r?.texto || "")).trim()).filter(Boolean).join("\n\n");
}
function objecoesLegadasParaTexto(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map(o => {
    const sinal = String(o?.objecao || o?.titulo || "").trim();
    const conducao = String(o?.resposta || o?.texto || "").trim();
    if (!sinal && !conducao) return "";
    if (sinal && conducao) return `SINAL: ${sinal}\nCOMO CONDUZIR: ${conducao}`;
    return sinal || conducao;
  }).filter(Boolean).join("\n\n");
}

// v1308 — chave só está desligada quando ela está EXPLICITAMENTE desligada. Campo ausente (todo
// Cérebro salvo antes desta versão) vale como ligado.
function chaveLigada(v) {
  return v === false || v === "false" || v === 0 || v === "0" ? false : true;
}

function sanitizeCerebroConfig(valor = {}) {
  const v = valor && typeof valor === "object" ? valor : {};
  return {
    corretorNome: typeof v.corretorNome === "string" ? v.corretorNome.slice(0, 80).trim() : "",
    metodo: typeof v.metodo === "string" ? capTexto(v.metodo) : "",
    tom: typeof v.tom === "string" ? capTexto(v.tom) : "",
    diferenciais: typeof v.diferenciais === "string" ? capTexto(v.diferenciais) : "",
    evitar: typeof v.evitar === "string" ? capTexto(v.evitar) : "",
    diasImportacao: clampDiasImportacao(v.diasImportacao),
    atendimentosPorDia: clampAtendimentosDia(v.atendimentosPorDia),
    resgatesPorDia: clampResgatesDia(v.resgatesPorDia),
    diasDescansoPosAtendimento: clampDiasDescanso(v.diasDescansoPosAtendimento),
    fusoHorario: normalizarFuso(v.fusoHorario),
    diasAtendimento: normalizarDiasAtendimento(v.diasAtendimento),
    usarCerebro: chaveLigada(v.usarCerebro),
    usarAprendizado: chaveLigada(v.usarAprendizado),
    usarRegrasEscrita: chaveLigada(v.usarRegrasEscrita),
    usarPisoComercial: chaveLigada(v.usarPisoComercial),
    regrasTexto: Object.prototype.hasOwnProperty.call(v, "regrasTexto") && typeof v.regrasTexto === "string" ? capTexto(v.regrasTexto, MAX_BLOCO_REGRAS) : capTexto(regrasLegadasParaTexto(v.regras), MAX_BLOCO_REGRAS),
    objecoesTexto: Object.prototype.hasOwnProperty.call(v, "objecoesTexto") && typeof v.objecoesTexto === "string" ? capTexto(v.objecoesTexto, MAX_BLOCO_REGRAS) : capTexto(objecoesLegadasParaTexto(v.objecoes), MAX_BLOCO_REGRAS),
    regras: Array.isArray(v.regras) ? v.regras : [],
    objecoes: Array.isArray(v.objecoes) ? v.objecoes : [],
    inteligenciaAprendida: v.inteligenciaAprendida && typeof v.inteligenciaAprendida === "object" ? v.inteligenciaAprendida : undefined
  };
}

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

// Retorna `null` (em vez de `{}`) quando o corpo chega mas não é JSON válido —
// distinguir "veio vazio" de "veio quebrado" evita que um body corrompido vire,
// silenciosamente, um save que zera método/tom/diferenciais/evitar pros defaults
// vazios (cada campo do save cai pro default quando body.campo não é string).
async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    if (!req.body.trim()) return {};
    try { return JSON.parse(req.body); } catch (_) { return null; }
  }
  let raw;
  try {
    raw = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
  } catch (_) {
    return null;
  }
  if (!raw || !raw.trim()) return {};
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function sanitizeNota(n) {
  return {
    id: String(n?.id || "").slice(0, 60),
    texto: String(n?.texto || "").trim().slice(0, MAX_NOTA_TEXTO),
    feita: n?.feita === true,
    criadoEm: String(n?.criadoEm || new Date().toISOString()),
    concluidaEm: n?.concluidaEm ? String(n.concluidaEm) : null
  };
}

async function loadNotas(supabase, organizationId) {
  const { data, error } = await supabase
    .from("direciona_config")
    .select("valor")
    .eq("chave", NOTAS_KEY)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { itens: [], error: error.message };
  const itens = Array.isArray(data?.valor?.itens) ? data.valor.itens.map(sanitizeNota) : [];
  return { itens };
}

async function saveNotas(supabase, organizationId, itens) {
  const { error } = await upsertConfigComOrganizacao(supabase, organizationId, {
    chave: NOTAS_KEY,
    valor: { itens },
    atualizado_em: new Date().toISOString()
  }) || {};
  return { error };
}

async function loadConfig(supabase, organizationId) {
  // Tenta ler da tabela direciona_config (chave/valor) se existir.
  const { data, error } = await supabase
    .from("direciona_config")
    .select("valor")
    .eq("chave", CONFIG_KEY)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { found: false, error: error.message };
  if (!data?.valor) return { found: false, defaults: true };
  return { found: true, valor: sanitizeCerebroConfig(data.valor) };
}

async function saveConfig(supabase, valor, organizationId) {
  const { error } = await upsertConfigComOrganizacao(supabase, organizationId, { chave: CONFIG_KEY, valor, atualizado_em: new Date().toISOString() }) || {};
  return { error };
}

export default async function handler(req, res) {
  const organizationId = await resolveOrganizationId(req, res);
  if (!organizationId) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  if (req.method === "GET") {
    const r = await loadConfig(supabase, organizationId);
    if (r.error && !/relation .* does not exist|not find the table|schema cache/i.test(r.error)) {
      return json(res, 500, { ok: false, error: r.error });
    }
    const aprendizadoAutomatico = await obterStatusAprendizadoAutomatico(organizationId).catch(() => ({ ativo: true, versao: 2, totalCasos: 0, historicosProcessados: 0 }));
    // v1170 — o bloco de notas vai junto da MESMA leitura que a tela já faz ao abrir (evita uma
    // ida a mais ao servidor só pra isso). Falha ao ler notas nunca derruba a tela inteira do
    // Cérebro — devolve lista vazia e segue.
    const notasR = await loadNotas(supabase, organizationId).catch(() => ({ itens: [] }));
    // v1199 — tela "Planos": plano atual da conta (só leitura, nunca gasta análise) + o catálogo
    // dos dois planos comerciais (limites e preço), pra nunca precisar cravar esses números de
    // novo numa quarta cópia — server, entrar.html e agora esta tela leem da mesma fonte.
    const planoAtual = await obterPlanoAtual(organizationId).catch(() => ({ principal: false, emTeste: false, plano: null }));
    // v1284 — o catálogo passa a levar também o pacote extra (o que fazer ao estourar o mês, em
    // vez de bater numa parede) e o bônus de carga inicial, pela mesma razão de sempre: um número
    // desses só pode existir num lugar. A tela lê daqui.
    const catalogoPlanos = {
      pro: { ...planoComercial("pro"), preco: precoPlano("pro") },
      "pro-master": { ...planoComercial("pro-master"), preco: precoPlano("pro-master") },
      pacoteExtra: pacoteExtraBR(),
      bonusEntrada: planoAtual?.bonusEntrada ?? null
    };
    return json(res, 200, { ok: true, config: r.valor ? sanitizeCerebroConfig(r.valor) : DEFAULTS, usingDefaults: !r.found, aprendizadoAutomatico, notas: notasR.itens, planoAtual, catalogoPlanos });
  }

  if (req.method === "POST" || req.method === "PUT") {
    const body = await readJsonBody(req).catch(() => null);
    if (body === null) {
      return json(res, 400, { ok: false, error: "Corpo da requisição inválido — não foi possível interpretar o JSON. Nada foi alterado no Cérebro." });
    }

    // v1170 — bloco de notas administrativas. Três ações simples, sem IA, sem custo — é uma
    // lista de tarefas, não análise de conversa. Cada ação relê a lista antes de gravar (a mesma
    // exposição a duas gravações quase simultâneas que o resto do Cérebro já tem — celular e PC
    // salvando ao mesmo tempo — é aceitável aqui: pior caso, a nota mais recente perde uma
    // atualização isolada, nunca perde a lista inteira).
    if (body.action === "nota-adicionar") {
      const texto = String(body.texto || "").trim().slice(0, MAX_NOTA_TEXTO);
      if (!texto) return json(res, 400, { ok: false, error: "Escreva o que precisa fazer antes de salvar." });
      const atual = await loadNotas(supabase, organizationId);
      if (atual.itens.length >= MAX_NOTAS) {
        return json(res, 400, { ok: false, error: `Limite de ${MAX_NOTAS} notas atingido — apague alguma concluída antes de acrescentar outra.` });
      }
      const nova = sanitizeNota({ id: randomUUID(), texto, feita: false, criadoEm: new Date().toISOString() });
      const itens = [nova, ...atual.itens];
      const { error } = await saveNotas(supabase, organizationId, itens);
      if (error) return json(res, 500, { ok: false, error: error.message });
      return json(res, 200, { ok: true, notas: itens });
    }
    if (body.action === "nota-concluir") {
      const id = String(body.id || "");
      if (!id) return json(res, 400, { ok: false, error: "Nota não identificada." });
      const atual = await loadNotas(supabase, organizationId);
      const feita = body.feita !== false;
      const itens = atual.itens.map(n => n.id === id ? sanitizeNota({ ...n, feita, concluidaEm: feita ? new Date().toISOString() : null }) : n);
      const { error } = await saveNotas(supabase, organizationId, itens);
      if (error) return json(res, 500, { ok: false, error: error.message });
      return json(res, 200, { ok: true, notas: itens });
    }
    if (body.action === "nota-remover") {
      const id = String(body.id || "");
      if (!id) return json(res, 400, { ok: false, error: "Nota não identificada." });
      const atual = await loadNotas(supabase, organizationId);
      const itens = atual.itens.filter(n => n.id !== id);
      const { error } = await saveNotas(supabase, organizationId, itens);
      if (error) return json(res, 500, { ok: false, error: error.message });
      return json(res, 200, { ok: true, notas: itens });
    }

    // Exporta os casos e observações aprendidos para um Excel gerado no navegador.
    // Não chama a IA, não altera o Cérebro e não ativa o uso automático do aprendizado.
    if (body.action === "exportar-aprendizado") {
      try {
        const atual = await loadConfig(supabase, organizationId);
        const config = atual?.valor && typeof atual.valor === "object" ? atual.valor : { ...DEFAULTS };
        const exportacao = await obterExportacaoAprendizado(config.inteligenciaAprendida || {}, config, organizationId);
        return json(res, 200, { ok: true, exportacao });
      } catch (e) {
        return json(res, 500, { ok: false, error: e?.message || "Não foi possível preparar o aprendizado para exportação." });
      }
    }

    // AÇÃO v808: só confirma que a varredura inicial terminou DEPOIS que o front
    // também recuperou eventuais conversas que falharam. Assim nenhuma conversa
    // fica marcada como aprendida só porque a paginação chegou ao fim.
    if (body.action === "finalizar-bootstrap-aprendizado") {
      const totalCarteira = Math.max(0, Number(body.totalCarteira) || 0);
      const ok = await marcarBootstrapAprendizadoConcluido(totalCarteira, organizationId);
      const status = await obterStatusAprendizadoAutomatico(organizationId).catch(() => null);
      return json(res, ok ? 200 : 500, { ok, aprendizadoAutomatico: status });
    }

    // AÇÃO v808: processa UMA alteração de histórico que foi enfileirada por uma
    // importação, reimportação ou reanálise. Uma por chamada mantém a função curta.
    if (body.action === "processar-aprendizado-pendente") {
      const openai = getOpenAI();
      if (!openai) return json(res, 200, { ok: false, error: "Análise indisponível agora." });
      const { data: filas, error: filaErr } = await supabase
        .from("direciona_config")
        .select("chave,valor,atualizado_em")
        .like("chave", `${APRENDIZADO_PENDENTE_V2_PREFIX}%`)
        .eq("organization_id", organizationId)
        .order("atualizado_em", { ascending: true })
        .range(0, 0);
      if (filaErr) return json(res, 200, { ok:false, error:filaErr.message });
      const fila = filas?.[0];
      if (!fila) {
        const status = await obterStatusAprendizadoAutomatico(organizationId).catch(() => null);
        return json(res, 200, { ok:true, vazio:true, aprendizadoAutomatico:status });
      }
      const leadId = String(fila?.valor?.leadId || fila.chave.slice(APRENDIZADO_PENDENTE_V2_PREFIX.length));
      const { data: lead, error: leadErr } = await supabase
        .from("whatsapp_processamentos")
        .select("id,nome_arquivo,timeline_json,resultado_analise,etapa")
        .eq("id", leadId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (leadErr) return json(res, 200, { ok:false, error:leadErr.message, leadId });
      if (!lead) {
        await supabase.from("direciona_config").delete().eq("chave", fila.chave).eq("organization_id", organizationId);
        return json(res, 200, { ok:true, removido:true, motivo:"lead não existe mais", leadId });
      }
      const a = lead.resultado_analise || {};
      const cerebroAtual = await loadConfig(supabase, organizationId);
      const corretorNome = cerebroAtual?.valor?.corretorNome || "";
      const r = await aprenderComHistoricoReal({
        timeline: Array.isArray(lead.timeline_json) ? lead.timeline_json : [],
        clientName: a.clientName || a?.lead?.clientName || a?.lead?.name || String(lead.nome_arquivo || "").replace(/\.(txt|zip)$/i, ""),
        leadId: String(lead.id),
        nomeArquivo: lead.nome_arquivo || "",
        produto: a?.modeloComercial?.oportunidade?.produto || a.produtoInteresse || a?.lead?.product || "",
        etapa: a.etapaSugerida || lead.etapa || a?.lead?.etapa || "",
        memoriaManual: a.memoria || {},
        openai,
        organizationId,
        corretorNome
      });
      if (r?.ok) {
        await supabase.from("direciona_config").delete().eq("chave", fila.chave).eq("organization_id", organizationId);
        const status = await obterStatusAprendizadoAutomatico(organizationId).catch(() => null);
        return json(res, 200, { ok:true, processado:true, leadId, resultado:r, aprendizadoAutomatico:status });
      }
      const tentativas = Number(fila?.valor?.tentativas || 0) + 1;
      const valorFila = { ...(fila.valor || {}), leadId, tentativas, ultimoErro:String(r?.error || "Falha no aprendizado").slice(0,240), ultimaTentativaEm:new Date().toISOString() };
      await upsertConfigComOrganizacao(supabase, organizationId, { chave:fila.chave, valor:valorFila, atualizado_em:new Date().toISOString() });
      return json(res, 200, { ok:false, pendente:true, leadId, tentativas, error:valorFila.ultimoErro });
    }

    // AÇÃO v808: apaga tanto as categorias legadas quanto os casos estruturados.
    // O Cérebro manual (método/tom/regras digitadas) permanece intacto.
    if (body.action === "limpar-aprendizado-completo") {
      const atual = await loadConfig(supabase, organizationId);
      const base = (atual?.valor && typeof atual.valor === "object") ? atual.valor : { ...DEFAULTS };
      base.inteligenciaAprendida = {};
      const salvoLegado = await saveConfig(supabase, base, organizationId);
      const apagadoMeta = await supabase.from("direciona_config").delete().eq("chave", "corretor-memoria-comercial-v2").eq("organization_id", organizationId);
      const apagadosCasos = await supabase.from("direciona_config").delete().like("chave", "corretor-memoria-caso-v2:%").eq("organization_id", organizationId);
      const apagadosPendentes = await supabase.from("direciona_config").delete().like("chave", `${APRENDIZADO_PENDENTE_V2_PREFIX}%`).eq("organization_id", organizationId);
      const erro = salvoLegado?.error?.message || apagadoMeta?.error?.message || apagadosCasos?.error?.message || apagadosPendentes?.error?.message || "";
      return json(res, erro ? 500 : 200, { ok: !erro, error: erro || undefined });
    }

    // AÇÃO: transcrever áudio pra ensinar o Cérebro por voz (recebe base64)
    if (body.action === "transcrever-audio") {
      const openai = getOpenAI();
      if (!openai) return json(res, 200, { ok: false, error: "Transcrição não configurada — não dá para transcrever áudio agora." });
      // v1068 — auditoria de segurança achou que esta ação nunca teve nenhum teto diário
      // (diferente da transcrição de áudio de uma importação normal, que já cai no teto de
      // "analises-ia" desde a v1013) — sem isso, um script podia gerar custo real de Whisper
      // sem nenhuma rede de segurança, inclusive numa conta em teste grátis.
      const limite = await verificarLimiteDiario(organizationId, "cerebro-transcricao-voz", limiteTranscricaoVozDoDia(), limiteTranscricaoVozDoDiaTeste());
      if (!limite.permitido) return json(res, 429, { ok: false, error: `Limite diário de ${limite.limite} transcrições de voz foi atingido para esta conta. Tente novamente amanhã.` });
      try {
        const b64 = String(body.audioBase64 || "").replace(/^data:[^;]+;base64,/, "");
        if (!b64) return json(res, 400, { ok: false, error: "Áudio não recebido." });
        const buffer = Buffer.from(b64, "base64");
        const texto = await transcreverBuffer(buffer, body.ext || ".ogg", openai, organizationId);
        return json(res, 200, { ok: true, texto });
      } catch (e) {
        return json(res, 200, { ok: false, error: e?.message || "Falha ao transcrever áudio." });
      }
    }

    // AÇÃO (v1250): LER O PRINT DA RESPOSTA DO CLIENTE.
    // O cliente respondeu duas linhas? Em vez de exportar a conversa inteira de novo e esperar a
    // reanálise, o corretor tira um print, esta ação devolve o texto e ele confere antes de salvar
    // como observação. A IA aqui só passa imagem pra texto — não cria lead, não muda etapa, não
    // grava nada sozinha (ver o comentário longo em lerPrintDaConversa, no _pipeline).
    if (body.action === "ler-print") {
      const openai = getOpenAI();
      if (!openai) return json(res, 200, { ok: false, error: "Leitura de print não configurada — não dá para ler a imagem agora." });
      // Mesmo cuidado da transcrição de voz: teto diário por conta, menor em conta de teste, pra
      // que nenhum uso automatizado gere custo de IA sem rede de segurança.
      const limite = await verificarLimiteDiario(organizationId, "cerebro-leitura-print", limitePrintDoDia(), limitePrintDoDiaTeste());
      if (!limite.permitido) return json(res, 429, { ok: false, error: `Limite diário de ${limite.limite} leituras de print foi atingido para esta conta. Tente novamente amanhã.` });
      try {
        const texto = await lerPrintDaConversa(body.imagemBase64, body.mime, openai, organizationId);
        if (!texto) return json(res, 200, { ok: false, error: "Não achei texto de mensagem nesse print. Tente um print mais próximo, só das mensagens." });
        return json(res, 200, { ok: true, texto });
      } catch (e) {
        return json(res, 200, { ok: false, error: e?.message || "Não consegui ler esse print." });
      }
    }

    // AÇÃO (v1349): LER OS ARQUIVOS QUE NÃO VIERAM NA CONVERSA.
    //
    // Quando a conversa é exportada sem os arquivos, cada foto/PDF vira "<Mídia oculta>" e o
    // conteúdo simplesmente não existe dentro do que chegou aqui — não tem o que ler. Até agora a
    // única saída era mandar o corretor reexportar a conversa inteira no WhatsApp e importar de
    // novo, por causa de dois ou três arquivos. É trabalho demais pra pouca coisa.
    //
    // Esta ação usa o MESMO leitor da importação (lerArquivosVisuais, v1306): ele escolhe as fotos
    // e os PDFs no aparelho e o app lê o que está escrito neles. O texto volta pra tela, ele
    // confere e salva como observação — o mesmo caminho já usado pela leitura de print (v1250).
    // Nada é gravado sozinho.
    if (body.action === "ler-arquivos") {
      const openai = getOpenAI();
      if (!openai) return json(res, 200, { ok: false, error: "Leitura de arquivo não configurada — não dá para ler agora." });
      const arquivos = Array.isArray(body.arquivos) ? body.arquivos.slice(0, 10) : [];
      if (!arquivos.length) return json(res, 200, { ok: false, error: "Nenhum arquivo recebido." });
      // Mesmo teto do dia da leitura da importação: o custo é o mesmo, a rede de segurança também.
      const limite = await verificarLimiteLeituraVisual(organizationId);
      if (Number.isFinite(limite.restante) && limite.restante <= 0) {
        return json(res, 429, { ok: false, error: "O limite de leitura de arquivos de hoje já foi atingido nesta conta. Tente de novo amanhã." });
      }
      const cabem = Number.isFinite(limite.restante) ? arquivos.slice(0, limite.restante) : arquivos;
      const entradas = [];
      // v1349 — áudio entra pela mesma porta. "cadê a transcrição de áudio????" (dono): quando a
      // conversa vem sem os arquivos, o áudio também não vem, e a única saída era reexportar tudo.
      // Aqui ele manda o áudio direto e o Whisper transcreve, igual à importação faz.
      const audios = [];
      for (let i = 0; i < cabem.length; i++) {
        const a = cabem[i] || {};
        const base64 = String(a.base64 || "").replace(/^data:[^;]+;base64,/, "");
        if (!base64) continue;
        let buffer;
        try { buffer = Buffer.from(base64, "base64"); } catch (_) { continue; }
        // 12 MB por arquivo: acima disso é vídeo ou digitalização gigante, que não é o caso de uso.
        if (!buffer.length || buffer.length > 12 * 1024 * 1024) continue;
        const nomeCru = String(a.nome || "").trim();
        const ehAudio = /^audio\//i.test(String(a.mime || "")) || /\.(opus|ogg|mp3|m4a|wav|aac)$/i.test(nomeCru);
        if (ehAudio) {
          const ext = (nomeCru.match(/\.(opus|ogg|mp3|m4a|wav|aac)$/i) || [, "ogg"])[1];
          audios.push({ name: nomeCru || `audio-${i + 1}.${ext}`, buffer, ext: "." + ext.toLowerCase() });
          continue;
        }
        // O nome define como o leitor trata o arquivo (imagem x PDF), então ele precisa ter extensão.
        const temExt = /\.(jpe?g|png|webp|gif|heic|bmp|tiff|pdf)$/i.test(nomeCru);
        const ext = /pdf/i.test(String(a.mime || "")) ? "pdf" : "jpg";
        entradas.push({ name: temExt ? nomeCru : `arquivo-${i + 1}.${ext}`, buffer });
      }
      if (!entradas.length && !audios.length) return json(res, 200, { ok: false, error: "Não consegui abrir esses arquivos. Mande foto (JPG/PNG), PDF ou áudio." });
      try {
        const partes = [];
        let lidos = 0;
        if (entradas.length) {
          const { leituras } = await lerArquivosVisuais(entradas, organizationId, { deadlineTs: Date.now() + 40000 });
          const ok = Object.entries(leituras || {}).filter(([, l]) => l?.status === "lido" && String(l.text || "").trim());
          if (ok.length) await registrarConsumoLeituraVisual(organizationId, ok.length);
          lidos += ok.length;
          for (const [nome, l] of ok) partes.push(`${nome}: ${String(l.text).trim()}`);
        }
        if (audios.length) {
          // Mesmo teto diário da transcrição de voz do Cérebro — o custo é o mesmo (Whisper).
          const limiteVoz = await verificarLimiteDiario(organizationId, "cerebro-transcricao-voz", limiteTranscricaoVozDoDia(), limiteTranscricaoVozDoDiaTeste());
          if (!limiteVoz.permitido) {
            partes.push(`(o limite de transcrições de áudio de hoje já foi atingido — ${audios.length} ${audios.length === 1 ? "áudio ficou" : "áudios ficaram"} sem transcrever)`);
          } else {
            for (const a of audios) {
              try {
                const t = await transcreverBuffer(a.buffer, a.ext, openai, organizationId);
                if (String(t || "").trim()) { partes.push(`${a.name}: ${String(t).trim()}`); lidos += 1; }
              } catch (_) { /* um áudio ruim não derruba os outros */ }
            }
          }
        }
        if (!lidos) return json(res, 200, { ok: false, error: "Não achei nada escrito nem falado nesses arquivos." });
        return json(res, 200, { ok: true, texto: partes.join("\n"), lidos, enviados: arquivos.length });
      } catch (e) {
        return json(res, 200, { ok: false, error: e?.message || "Não consegui ler esses arquivos." });
      }
    }

    // AÇÃO: aprender de TODA a carteira que JÁ está no Direciona (os leads já salvos).
    // Roda em LOTES (o front chama de novo com a próxima posição até concluir), pra não estourar
    // o tempo da função. Devolve quanto aprendeu e — sem ser silencioso — quantos não salvaram.
    if (body.action === "aprender-carteira") {
      const openai = getOpenAI();
      if (!openai) return json(res, 200, { ok: false, error: "Análise indisponível agora — não dá para aprender da carteira." });
      try {
        const offset = Math.max(0, parseInt(body.offset, 10) || 0);
        // 1 conversa por requisição — cada uma é 1 chamada de IA com tempo curto; impossível estourar a função.
        const limite = 1;
        // Conta a carteira SÓ na 1ª requisição (offset 0) — nas seguintes o front já sabe o total.
        let total = null;
        if (offset === 0) {
          try {
            const c = await supabase.from("whatsapp_processamentos").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
            if (Number.isFinite(c.count)) total = c.count;
          } catch (_) {}
        }
        const { data: leads, error } = await supabase
          .from("whatsapp_processamentos")
          .select("id, nome_arquivo, timeline_json, resultado_analise")
          .eq("organization_id", organizationId)
          .order("id", { ascending: true })
          .range(offset, offset + limite - 1);
        if (error) return json(res, 200, { ok: false, error: "Banco: " + error.message });
        const cerebroAtual = await loadConfig(supabase, organizationId);
        const corretorNome = cerebroAtual?.valor?.corretorNome || "";
        let aprendidas = 0, semConteudo = 0, falhasSalvar = 0, totalNoBanco = 0, errosIA = 0;
        let ultimoErroIA = "";
        const amostra = [];
        for (const l of (leads || [])) {
          const tl = Array.isArray(l.timeline_json) ? l.timeline_json : [];
          const a = l.resultado_analise || {};
          const memManual = a.memoria || {};
          const temMemoriaManual = (Array.isArray(memManual.camposManuais) && memManual.camposManuais.some(k => String(memManual[k] || "").trim())) ||
            (Array.isArray(memManual.observacoesManuais) && memManual.observacoesManuais.some(o => String(o?.texto || "").trim()));
          if (tl.length < 2 && !temMemoriaManual) { semConteudo++; continue; }
          const clientName = a.clientName || a?.lead?.clientName || String(l.nome_arquivo || "").replace(/\.(txt|zip)$/i, "");
          const r = await aprenderComHistoricoReal({
            timeline: tl,
            clientName,
            leadId: String(l.id || ""),
            nomeArquivo: l.nome_arquivo || "",
            produto: a.produtoInteresse || a?.lead?.product || "",
            etapa: a.etapaSugerida || a?.lead?.etapa || "",
            memoriaManual: a.memoria || {},
            openai,
            corretorNome,
            forcar: body.forcar === true,
            organizationId
          });
          if (r?.ok) {
            try { await supabase.from("direciona_config").delete().eq("chave", `${APRENDIZADO_PENDENTE_V2_PREFIX}${String(l.id || "").slice(0,180)}`).eq("organization_id", organizationId); } catch (_) {}
            if (r.ignorado && r.motivo === "sem diálogo real") semConteudo++;
            else aprendidas++;
            totalNoBanco = r.totalCasos || totalNoBanco;
            if (r.casosDoLead && amostra.length < 3) amostra.push(`${r.casosDoLead} caso(s) real(is) extraído(s)`);
          } else {
            if (r?.error) { errosIA++; ultimoErroIA = String(r.error).slice(0, 200); }
            else falhasSalvar++;
          }
        }
        const processadosAteAgora = offset + (leads?.length || 0);
        const concluido = total != null ? processadosAteAgora >= total : (leads?.length || 0) < limite;
        // A conclusão é confirmada por uma ação separada somente depois que o front
        // recuperar os offsets que eventualmente falharam.
        return json(res, 200, {
          ok: true,
          total,
          loteProcessado: leads?.length || 0,
          offset,
          proximaOffset: concluido ? null : processadosAteAgora,
          concluido,
          aprendidasNoLote: aprendidas,
          semConteudo,
          falhasSalvar,
          errosIA,
          ultimoErroIA,
          totalNoBanco,
          amostra,
          aviso: falhasSalvar > 0 ? "Algumas lições não foram salvas (a tabela do Cérebro pode não existir no banco)." : ""
        });
      } catch (e) {
        return json(res, 200, { ok: false, error: "Erro ao aprender: " + String(e?.message || e) });
      }
    }

    // Regras e objeções são salvas como blocos únicos de texto. O fallback converte
    // o formato antigo em lista para não perder conteúdo ao atualizar.
    const sanitizarBloco = (texto, limite = MAX_BLOCO_REGRAS) => capTexto(texto, limite);
    const regrasTextoEntrada = Object.prototype.hasOwnProperty.call(body, "regrasTexto")
      ? body.regrasTexto
      : regrasLegadasParaTexto(body.regras);
    const objecoesTextoEntrada = Object.prototype.hasOwnProperty.call(body, "objecoesTexto")
      ? body.objecoesTexto
      : objecoesLegadasParaTexto(body.objecoes);

    // Action específico: atualizar APENAS a inteligenciaAprendida (preserva o resto do Cérebro).
    if (body.action === "intel-update") {
      const atual = await loadConfig(supabase, organizationId);
      const base = (atual?.valor && typeof atual.valor === "object") ? atual.valor : {};
      base.inteligenciaAprendida = (body.inteligenciaAprendida && typeof body.inteligenciaAprendida === "object") ? body.inteligenciaAprendida : {};
      const r = await saveConfig(supabase, base, organizationId);
      if (r.error) return json(res, 500, { ok: false, error: r.error.message || String(r.error) });
      return json(res, 200, { ok: true });
    }

    // Save padrão: preserva inteligenciaAprendida e estiloHistorico existentes (form do Cérebro
    // não controla esses campos — eles são alimentados pela análise de ZIPs).
    const atualConfig = await loadConfig(supabase, organizationId);
    const baseAprend = (atualConfig?.valor && typeof atualConfig.valor === "object") ? atualConfig.valor : {};
    const valor = {
      corretorNome: typeof body.corretorNome === "string" ? body.corretorNome.slice(0, 80).trim() : DEFAULTS.corretorNome,
      metodo: typeof body.metodo === "string" ? capTexto(body.metodo) : DEFAULTS.metodo,
      tom: typeof body.tom === "string" ? capTexto(body.tom) : DEFAULTS.tom,
      diferenciais: typeof body.diferenciais === "string" ? capTexto(body.diferenciais) : DEFAULTS.diferenciais,
      evitar: typeof body.evitar === "string" ? capTexto(body.evitar) : DEFAULTS.evitar,
      diasImportacao: clampDiasImportacao(body.diasImportacao),
      atendimentosPorDia: clampAtendimentosDia(body.atendimentosPorDia),
      resgatesPorDia: clampResgatesDia(body.resgatesPorDia),
      diasDescansoPosAtendimento: clampDiasDescanso(body.diasDescansoPosAtendimento),
      fusoHorario: normalizarFuso(body.fusoHorario),
      diasAtendimento: normalizarDiasAtendimento(body.diasAtendimento),
      usarCerebro: chaveLigada(body.usarCerebro),
      usarAprendizado: chaveLigada(body.usarAprendizado),
      usarRegrasEscrita: chaveLigada(body.usarRegrasEscrita),
      usarPisoComercial: chaveLigada(body.usarPisoComercial),
      regrasTexto: sanitizarBloco(regrasTextoEntrada),
      objecoesTexto: sanitizarBloco(objecoesTextoEntrada),
      regras: [],
      objecoes: [],
      inteligenciaAprendida: baseAprend.inteligenciaAprendida || {},
      estiloHistorico: Array.isArray(baseAprend.estiloHistorico) ? baseAprend.estiloHistorico : undefined
    };
    const r = await saveConfig(supabase, valor, organizationId);
    if (r.error) {
      const missing = /relation .* does not exist|not find the table|schema cache/i.test(r.error.message || "");
      if (missing) {
        // v1185 — aqui a resposta vinha com um `sqlNecessario` mandando criar a tabela com
        // `chave text primary key`: o desenho de ANTES das contas separadas, sem organization_id.
        // Seguir aquela sugestão criaria uma tabela em que o Cérebro é um só pro sistema inteiro —
        // ou seja, a configuração de um corretor por cima da do outro. Apontado pelas auditorias
        // de 08/2026. A resposta agora manda pro lugar certo: as migrações oficiais.
        return json(res, 200, {
          ok: false,
          warning: "Banco incompleto: a tabela direciona_config não existe. Nada foi salvo no servidor — o app segue com a cópia deste aparelho até o banco ser acertado.",
          config: valor,
          proximoPasso: "Aplique as migrações oficiais de supabase/migrations/ no SQL Editor do Supabase (comece pela 0001). Para ver o que falta: /api/diagnostico?mode=banco."
        });
      }
      return json(res, 500, { ok: false, error: r.error.message });
    }
    return json(res, 200, { ok: true, config: valor });
  }

  return json(res, 405, { ok: false, error: "Use GET, POST ou PUT." });
}

export { DEFAULTS as CEREBRO_DEFAULTS, CONFIG_KEY, sanitizeCerebroConfig, readJsonBody };
