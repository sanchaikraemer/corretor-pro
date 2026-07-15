import fs from "fs";
import path from "path";
import os from "os";
import JSZip from "jszip";
import OpenAI from "openai";

const ATTACHED_SUFFIX_RE = /\s*\((arquivo anexado|file attached)\)\s*$/i;
const AUDIO_INLINE_RE = /\.(opus|ogg|mp3|m4a|wav|aac)\b/i;
const IMAGE_INLINE_RE = /\.(jpg|jpeg|png|gif|webp|heic|bmp|tiff)\b/i;
const VIDEO_INLINE_RE = /\.(mp4|mov|avi|webm|mkv|3gp|m4v)\b/i;
const DOC_INLINE_RE = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|vcf|txt)\b/i;
const HIDDEN_MEDIA_TAG_RE = /<[^>]*(omitida|oculta|omitido|ocultado|omitted|hidden)[^>]*>/i;
const HIDDEN_MEDIA_CLEAN_RE = /<[^>]*(omitida|oculta|omitido|ocultado|omitted|hidden)[^>]*>/gi;
const HIDDEN_MEDIA_ONLY_RE = /^\s*<[^>]*(omitida|oculta|omitido|ocultado|omitted|hidden)[^>]*>\s*$/i;

// Modelos IA do Direciona — configuração central por etapa.
// A chave API só autoriza a conta/projeto; quem define a qualidade/custo é o modelo abaixo.
const MODELOS_PADRAO = {
  transcricao: "whisper-1",
  analise: "gpt-4.1",
  mensagens: "gpt-4.1",
  visao: "gpt-4o",
  tarefasSimples: "gpt-4o-mini",
  orquestrador: "gpt-4.1"
};

export const ARQUITETURA_MENSAGENS_ATUAL = "v808-aprendizado-continuo-real";

function envModel(name, fallback) {
  const v = String(process.env[name] || "").trim();
  return v || fallback;
}

export function modeloTranscricao() {
  return envModel("OPENAI_TRANSCRIPTION_MODEL", MODELOS_PADRAO.transcricao);
}

export function modeloAnalise() {
  // Modelo principal configurável.
  return envModel("DIRECIONA_MAIN_MODEL", MODELOS_PADRAO.analise);
}

export function modeloAnaliseRapida() {
  // v756: importação precisa concluir dentro do servidor. Usa modelo rápido por padrão,
  // sem regras comerciais extras, apenas leitura da conversa bruta. Pode ser sobrescrito no Vercel.
  return envModel("DIRECIONA_IMPORT_MODEL", envModel("DIRECIONA_FAST_MODEL", "gpt-4o-mini"));
}

export function modeloMensagens() {
  // Diagnóstico e mensagens usam o mesmo modelo e a mesma leitura de contexto.
  return modeloAnalise();
}

export function modeloVisao() {
  return envModel("OPENAI_VISION_MODEL", MODELOS_PADRAO.visao);
}

export function modeloTarefasSimples() {
  return envModel("OPENAI_SIMPLE_MODEL", envModel("OPENAI_MODEL", MODELOS_PADRAO.tarefasSimples));
}

export function modeloOrquestrador() {
  return envModel("OPENAI_ORQUESTRADOR_MODEL", modeloAnalise() || MODELOS_PADRAO.orquestrador);
}


export function getModelosIASummary() {
  return {
    openai: {
      transcricao: modeloTranscricao(),
      analise: modeloAnalise(),
      mensagens: modeloMensagens(),
      visao: modeloVisao(),
      tarefasSimples: modeloTarefasSimples(),
      orquestrador: modeloOrquestrador()
    }
  };
}


function leadSeguroParaAnalise(lead = {}) {
  // v747: a conversa é a fonte da verdade. O objeto do lead pode trazer análises,
  // sugestões, nextAction, produto e unidade salvos por versões antigas. Enviar isso
  // inteiro para a IA contaminava uma conversa com pendências de outra.
  const src = lead && typeof lead === "object" ? lead : {};
  const chavesSeguras = [
    "id", "name", "title", "clientName", "nomeCliente", "contactName", "phone", "telefone",
    "source", "origin", "createdAt", "updatedAt", "lastInteractionAt"
  ];
  const out = {};
  for (const k of chavesSeguras) {
    const v = src[k];
    if (v == null) continue;
    if (["string", "number", "boolean"].includes(typeof v)) {
      out[k] = String(v).slice(0, 240);
    }
  }
  return out;
}

function contatoPareceParceiro(lead, timelineText) {
  const nome = String(lead?.clientName || lead?.name || "");
  const texto = String(timelineText || "").slice(0, 12000);
  const base = `${nome}
${texto}`.toLowerCase();
  return /\b(corretor|corretora|imobili[áa]ria|im[oó]veis|creci)\b/.test(nome.toLowerCase())
    || /\b(meu cliente|minha cliente|meu comprador|minha compradora|cliente comprador|cliente final|minha corretora|sou o gerente da empresa|comiss[aã]o|honor[aá]rios|pegou com a lisiane|chaves|imobili[áa]ria|corretor parceiro|corretora parceira)\b/.test(base);
}



function normalizarTextoComparacao(txt) {
  return String(txt || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/^[a-z][a-z .'-]{0,40},\s*/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(oi|ola|bom|boa|dia|tarde|noite|tudo|bem)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mensagemSoSaudacao(txt) {
  return /^(?:[a-záàâãéèêíïóôõöúçñ .'-]+,?\s*)?(?:oi|ol[aá]|bom dia|boa tarde|boa noite),?\s*(?:tudo bem|td bem|tudo certo|como vai)\??$/i.test(String(txt || "").trim());
}

function autorPareceNegocioPipeline(author = "") {
  return /\b(construtora|senger|corretor|corretora|imobili[áa]ria|atendimento|sanchai|miguel kirinus)\b/i.test(String(author || ""));
}
function autorPareceClientePipeline(author = "", lead = {}) {
  const a = String(author || "").trim().toLowerCase();
  if (!a || autorPareceNegocioPipeline(a)) return false;
  const nome = String(lead?.clientName || lead?.nomeCliente || lead?.contactName || lead?.name || lead?.title || "").toLowerCase();
  const primeiro = nome.replace(/^conversa\s+do\s+whatsapp\s+com\s+/i, "").split(/\s+/)[0] || "";
  if (primeiro && a.includes(primeiro)) return true;
  return !/\b(construtora|senger|atendimento)\b/i.test(a);
}
function textoPedeMaterialOuInfo(texto = "") {
  const t = String(texto || "").toLowerCase();
  return /(foto|fotos|imagem|imagens|vídeo|video|material|apresenta[cç][aã]o|folder|pdf|planta|plantas|mapa|localiza[cç][aã]o|valor|pre[cç]o|condi[cç][aã]o|pode(r)?\s+nos\s+enviar|me\s+manda|me\s+envia|podes?\s+enviar)/i.test(t);
}
function textoEntregaMaterialOuInfo(texto = "") {
  const t = String(texto || "").toLowerCase();
  return /(mídia|midia|arquivo anexado|segue|seguem|enviei|encaminhei|te encaminhei|vou te apresentar|apresentar esse|claro,?\s+fico|http|\.pdf|\.mp4|\.jpg|\.jpeg|\.png|vídeo|video|folder|mapa|plantas?|valores?|localiza[cç][aã]o|fotos?)/i.test(t);
}
function extrairCompromissoMaterial(texto = "") {
  const l = String(texto || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (/(esposo|marido)/.test(l) && /(noite|retorno|retornar|ver|avaliar)/.test(l)) return "ver com seu esposo e me retornar";
  if (/(esposa|mulher)/.test(l) && /(noite|retorno|retornar|ver|avaliar)/.test(l)) return "ver com sua esposa e me retornar";
  if (/(retorno|retornar|me dar um retorno|dou retorno)/.test(l)) return "me dar um retorno depois de avaliar";
  return "avaliar o material enviado";
}
function detectarOrdemMaterialTimeline(timeline = [], lead = {}) {
  let ultimoPedido = null, entregaDepois = null;
  for (let i = 0; i < (Array.isArray(timeline) ? timeline.length : 0); i++) {
    const m = timeline[i] || {};
    const texto = String(m.text || "").replace(/\s+/g, " ").trim();
    const author = String(m.author || "");
    if (!texto) continue;
    if (autorPareceClientePipeline(author, lead) && textoPedeMaterialOuInfo(texto)) {
      ultimoPedido = { index: i, texto, author, compromisso: extrairCompromissoMaterial(texto), data: m.date || "", hora: m.time || "" };
      entregaDepois = null;
      continue;
    }
    if (ultimoPedido && i > ultimoPedido.index && autorPareceNegocioPipeline(author) && textoEntregaMaterialOuInfo(texto)) {
      entregaDepois = { index: i, texto, author, data: m.date || "", hora: m.time || "" };
    }
  }
  return {
    materialPedidoPeloCliente: !!ultimoPedido,
    materialJaEnviadoDepois: !!(ultimoPedido && entregaDepois),
    pedidoCliente: ultimoPedido?.texto || "",
    entregaCorretor: entregaDepois?.texto || "",
    compromissoClienteAposMaterial: ultimoPedido?.compromisso || "",
    regra: ultimoPedido && entregaDepois ? "Cliente pediu material/informação e o corretor já enviou depois; retome a avaliação do material já encaminhado." : "Não foi detectado pedido de material com envio posterior pelo corretor."
  };
}


function textoCurto(valor, fallback = "") {
  const s = String(valor || "").replace(/\s+/g, " ").trim();
  return s || fallback;
}

// v724-2: bloco antigo de análise/mensagem removido.


function normalizarParceiroB2B(parsed, lead, timelineText) {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (!contatoPareceParceiro(lead, timelineText)) return parsed;
  parsed.tipoContato = "corretor-parceiro";
  parsed.diagnostico = (parsed.diagnostico && typeof parsed.diagnostico === "object") ? parsed.diagnostico : {};
  parsed.diagnostico.papelContato = "corretor-parceiro";
  parsed.diagnostico.papelClienteFinal = "comprador representado pelo corretor parceiro";
  const obj = String(parsed.diagnostico.objetivo || "").toLowerCase();
  if (obj === "moradia" || obj === "moradia-futura" || obj === "investimento") {
    parsed.diagnostico.objetivo = "objetivo-do-cliente-final";
  }
  return parsed;
}


// Atualização #670 — modelo comercial único.
// Separa a pessoa com quem o corretor conversa, a oportunidade específica e o
// relacionamento futuro. A IA interpreta; esta camada aplica regras duras para
// impedir estados incompatíveis na tela e nas mensagens.
const MC_CONTATOS = new Set(["comprador-direto", "corretor-parceiro", "intermediario", "familiar", "investidor", "empresa", "outro"]);
const MC_OPORTUNIDADES = new Set(["descoberta", "interesse", "comparacao", "analise-financeira", "negociacao", "decisao", "ganha", "perdida", "encerrada-sem-decisao"]);
const MC_RESULTADOS = new Set(["em-andamento", "venda-conosco", "comprou-outra-opcao", "condicoes-incompativeis", "desistiu", "sem-resposta", "oportunidade-futura", "outro"]);
const MC_RELACIONAMENTOS = new Set(["ativo", "aguardando-nova-oportunidade", "contato-periodico", "pausado", "encerrado"]);
const MC_ACOES = new Set(["responder-agora", "aguardando-resposta", "compromisso-agendado", "retomar", "sem-acao-urgente"]);
const MC_RESPONSAVEIS = new Set(["corretor", "contato", "ambos", "ninguem"]);
const MC_URGENCIAS = new Set(["alta", "media", "baixa", "nenhuma"]);

function mcEnum(valor, permitidos, fallback) {
  const v = String(valor || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, "-");
  return permitidos.has(v) ? v : fallback;
}

function mcTexto(valor, fallback = "") {
  const v = String(valor || "").replace(/\s+/g, " ").trim();
  return v || fallback;
}

function mcAutorEhContato(author, lead, corretorNome) {
  const autor = String(author || "").trim().toLowerCase();
  if (!autor) return null;
  const contato = String(lead?.clientName || lead?.name || "").trim().toLowerCase();
  const primeiroContato = contato.split(/\s+/)[0] || "";
  const corretor = String(corretorNome || "").trim().toLowerCase();
  if (corretor && (autor.includes(corretor) || corretor.includes(autor))) return false;
  if (/\b(senger|construtora|atendimento|sanchai|miguel kirinus)\b/i.test(autor)) return false;
  // O nome completo/primeiro nome do contato vence palavras de profissão presentes no nome.
  if (contato && (autor.includes(contato) || contato.includes(autor))) return true;
  if (primeiroContato && autor.includes(primeiroContato)) return true;
  // Em uma exportação individual do WhatsApp, o outro participante real é o contato,
  // inclusive quando o nome contém "Corretor", "Imobiliária" ou "Imóveis".
  return true;
}

function mcUltimaMensagemReal(timeline, lead, corretorNome) {
  const lista = Array.isArray(timeline) ? timeline : [];
  for (let i = lista.length - 1; i >= 0; i--) {
    const m = lista[i];
    if (!m || !String(m.text || "").trim()) continue;
    const source = String(m.source || "");
    const type = String(m.type || "");
    if (source === "manual" || source === "crm" || type === "print-whatsapp" || ["atendimento", "nota", "ligacao", "visita", "presencial"].includes(type)) continue;
    if (/^(sistema|áudio sem referência exata)$/i.test(String(m.author || "").trim())) continue;
    const ehContato = mcAutorEhContato(m.author, lead, corretorNome);
    return { mensagem: m, falante: ehContato === true ? "contato" : ehContato === false ? "corretor" : "desconhecido" };
  }
  return { mensagem: null, falante: "desconhecido" };
}


function mcHojeIsoBR() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function mcDiasEntreIso(dataIso, hojeIso = mcHojeIsoBR()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataIso || ""))) return null;
  const a = new Date(`${hojeIso}T12:00:00-03:00`);
  const b = new Date(`${dataIso}T12:00:00-03:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function mcDiasDesdeMensagem(m) {
  try {
    const iso = String(m?.iso || "");
    let d = iso && !iso.startsWith("9999") ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) d = new Date(parseDateTime(m?.date, m?.time || "12:00"));
    if (Number.isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  } catch (_) { return null; }
}

function mcUltimaMensagemPedeResposta(ultimo) {
  if (ultimo?.falante !== "contato") return false;
  const t = String(ultimo?.mensagem?.text || "").trim();
  if (!t) return false;
  return /\?/.test(t) || /^\s*(pode|consegue|tem como|tem disponibilidade|voc[eê] sabe|me manda|me envia|qual|quanto|quando|onde|como|por que|porque)\b/i.test(t);
}

// Localiza compromisso REAL ainda aberto antes de considerar uma despedida cordial.
// Isso evita o erro "vou analisar e te retorno sexta" + "muito obrigado" virar
// "sem ação urgente". Compromissos com data futura aguardam; vencidos recentemente
// viram retomada. Sem prova na timeline, a camada não inventa compromisso.
function mcCompromissoAberto(parsed, timeline, lead, corretorNome) {
  const hojeIso = mcHojeIsoBR();
  const apps = Array.isArray(parsed?.confirmedAppointments) ? parsed.confirmedAppointments : [];
  const concretos = /visita|caf[eé]|reuni[aã]o|liga[cç][aã]o|videochamada|assinatura|contrato|banco/i;
  const retorno = /retorno|retornar|respondo|responder|aviso|avisar|chamo|chamar|analiso|analisar|avalio|avaliar|converso|conversar|vejo|verificar|esperar|espero|aguardar|aguardo|aguardando|quando (sair|resolver|finalizar|terminar|acabar)|invent[aá]rio/i;

  for (let i = apps.length - 1; i >= 0; i--) {
    const ap = apps[i] || {};
    const prova = mcTexto(ap.trechoLiteral || ap.quando || ap.oQue);
    if (!prova) continue;
    const diff = mcDiasEntreIso(String(ap.data || "").slice(0, 10), hojeIso);
    const combinadoPorContato = /cliente|contato/i.test(String(ap.combinadoPor || ""));
    const compromissoConcreto = concretos.test(`${ap.oQue || ""} ${prova}`);
    if (diff != null && diff >= 0) {
      const quando = diff === 0 ? "hoje" : diff === 1 ? "amanhã" : `em ${diff} dias`;
      return {
        status: compromissoConcreto ? "compromisso-agendado" : (combinadoPorContato ? "aguardando-resposta" : "compromisso-agendado"),
        responsavel: combinadoPorContato ? "contato" : "ambos",
        urgencia: diff <= 1 ? "media" : "baixa",
        descricao: compromissoConcreto
          ? `Compromisso confirmado para ${quando}. Acompanhe sem criar uma nova abordagem antes da hora.`
          : `Aguardar o retorno combinado do contato para ${quando}.`,
        texto: prova,
        data: String(ap.data || "").slice(0, 10)
      };
    }
    if (diff != null && diff < 0 && diff >= -30) {
      return {
        status: "retomar",
        responsavel: "corretor",
        urgencia: Math.abs(diff) >= 3 ? "alta" : "media",
        descricao: `O compromisso combinado venceu há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "dia" : "dias"}. Retome usando exatamente essa pendência como gancho.`,
        texto: prova,
        data: String(ap.data || "").slice(0, 10)
      };
    }
  }

  // Fallback determinístico para compromissos explícitos ainda não estruturados pela IA.
  // Examina apenas falas do contato nas últimas mensagens, nunca um resumo inventado.
  const reais = (Array.isArray(timeline) ? timeline : []).filter(m => m && String(m.text || "").trim());
  const cancelar = /\b(desisti|n[aã]o vou|n[aã]o precisa|j[aá] resolvi|comprei|fechei com outro|comprou outro|sem interesse)\b/i;
  for (let i = reais.length - 1; i >= Math.max(0, reais.length - 24); i--) {
    const m = reais[i];
    if (mcAutorEhContato(m.author, lead, corretorNome) !== true) continue;
    const t = String(m.text || "").trim();
    if (!retorno.test(t) || !/(\b(vou|iremos|vamos|fico de|dou|darei|te|lhe)\b)/i.test(t)) continue;
    const houveCancelamentoDepois = reais.slice(i + 1).some(x => mcAutorEhContato(x.author, lead, corretorNome) === true && cancelar.test(String(x.text || "")));
    if (houveCancelamentoDepois) continue;
    const idadeDias = mcDiasDesdeMensagem(m);
    if (idadeDias != null && idadeDias > 180) continue;
    if (idadeDias != null && idadeDias > 30) {
      return {
        status: "retomar", responsavel: "corretor", urgencia: "alta",
        descricao: `O retorno combinado está vencido há ${idadeDias} ${idadeDias === 1 ? "dia" : "dias"}. Retome pela pendência, sem tratar como conversa encerrada.`,
        texto: t, data: ""
      };
    }
    const prazo = prazoEmDias(t);
    if (prazo) {
      return {
        status: prazo.dias === 0 ? "aguardando-resposta" : "aguardando-resposta",
        responsavel: "contato",
        urgencia: prazo.dias <= 1 ? "media" : "baixa",
        descricao: prazo.dias === 0 ? "Aguardar o retorno combinado para hoje." : `Aguardar o retorno combinado do contato em ${prazo.dias} ${prazo.dias === 1 ? "dia" : "dias"}.`,
        texto: t,
        data: ""
      };
    }
    return {
      status: "aguardando-resposta",
      responsavel: "contato",
      urgencia: "baixa",
      descricao: "Aguardar o retorno que o contato se comprometeu a dar.",
      texto: t,
      data: ""
    };
  }
  return null;
}

export function normalizarModeloComercial(parsed, lead, timeline, corretorNome) {
  // v724-2: reset total. Mantida apenas por compatibilidade com APIs antigas; não altera análise.
  return parsed;
}

export function finalizarAnaliseComercial(parsed = {}, lead = {}, timeline = [], corretorNome = "") {
  // v724-2: reset total. Não aplica modelo comercial, fallback, teto de probabilidade ou reescrita.
  return parsed;
}

// Lê um texto (próxima ação / fala do cliente) e devolve {dias, motivo} se houver
// prazo claro pra retomar: "em N dias/semanas/meses", "dia 20" (próximo dia do mês),
// Data de HOJE no fuso de Brasília como Date local (getDay/getDate corretos). Evita virar o dia no UTC à noite.
function hojeBR() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, mo, d] = p.split("-").map(Number);
  return new Date(y, mo - 1, d);
}
// "semana/mês que vem", "amanhã". Senão null.
function prazoEmDias(txt) {
  const t = String(txt || "").toLowerCase();
  if (!t) return null;
  let m, dias = null;
  if ((m = t.match(/(?:em|daqui\s*a?|depois\s+de)\s*(\d{1,3})\s*(dias?|semanas?|m[eê]s(?:es)?)\b/))) {
    const n = parseInt(m[1], 10);
    dias = /semana/.test(m[2]) ? n * 7 : /m[eê]s/.test(m[2]) ? n * 30 : n;
  } else if (/\bhoje\b|ainda hoje|hoje mesmo|pra hoje|para hoje/.test(t)) {
    dias = 0;
  } else if (/\bamanh[ãa]\b/.test(t)) {
    dias = 1;
  } else if (/semana que vem|pr[óo]xima semana/.test(t)) {
    dias = 7;
  } else if (/m[eê]s que vem|pr[óo]ximo m[eê]s/.test(t)) {
    dias = 30;
  } else if ((m = t.match(/\b(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(?:[\s-]*feira)?\b/))) {
    // dia da semana ("sexta", "segunda"...): próxima ocorrência.
    const mapa = { domingo: 0, segunda: 1, "terça": 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, "sábado": 6, sabado: 6 };
    const alvo = mapa[m[1]];
    if (alvo != null) {
      let delta = (alvo - hojeBR().getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      if (/que vem|pr[óo]xim/.test(t) && delta < 7) delta += 7;
      dias = delta;
    }
  } else if ((m = t.match(/\bdia\s+(\d{1,2})\b/))) {
    // "dia 20": próxima ocorrência desse dia do mês (a partir de amanhã).
    const alvo = parseInt(m[1], 10);
    if (alvo >= 1 && alvo <= 31) {
      const hoje = hojeBR();
      const cand = new Date(hoje.getFullYear(), hoje.getMonth(), alvo);
      if (cand.getTime() <= hoje.getTime()) cand.setMonth(cand.getMonth() + 1);
      dias = Math.round((cand.getTime() - hoje.getTime()) / 86400000);
    }
  }
  if (dias == null || dias < 0 || dias > 1095) return null;
  return { dias, motivo: String(txt).trim().slice(0, 160) || "Retomar contato" };
}
// Monta a data de um lembrete a partir de "dias a partir de hoje" (0 = hoje, daqui a pouco).
function dataLembrete(dias) {
  const q = new Date();
  if (dias === 0) { q.setHours(Math.min(q.getHours() + 1, 22), 0, 0, 0); }
  else { q.setDate(q.getDate() + dias); q.setHours(8, 0, 0, 0); }
  return q;
}

export const AUDIO_EXT = /\.(opus|ogg|mp3|m4a|wav|aac)$/i;
export const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|heic|bmp|tiff)$/i;
export const VIDEO_EXT = /\.(mp4|mov|avi|webm|mkv|3gp|m4v)$/i;
export const DOC_EXT = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|vcf)$/i;

function toIsoSafe(date, time, order = 0) {
  try {
    return parseDateTime(date, time);
  } catch (_) {
    return `9999-12-31T23:59:${String(order % 60).padStart(2, "0")}.000Z`;
  }
}

export function stripEmojis(text = "") {
  return String(text)
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u200e\u200f\u202a-\u202e\u200d]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function normalizeName(name = "") {
  return String(name).split("/").pop().trim();
}

function normalizeComparable(text = "") {
  return stripEmojis(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, " ")
    .trim();
}

// Mant\u00e9m s\u00f3 os compromissos que t\u00eam PROVA na conversa real:
// 1) o trechoLiteral citado pela IA bate com uma sequ\u00eancia de palavras que de fato
//    aparece no texto da conversa; e
// 2) se o tipo \u00e9 uma refei\u00e7\u00e3o concreta (caf\u00e9/almo\u00e7o/jantar), essa palavra TEM que
//    aparecer na conversa \u2014 sen\u00e3o \u00e9 a IA chamando de "caf\u00e9" algo que ningu\u00e9m marcou
//    (ex.: trecho real "te chamo amanh\u00e3" rotulado como caf\u00e9).
// Sem prova = compromisso inventado/deduzido pela IA \u2192 descartado.
function termoObrigatorioDoTipo(oQue) {
  const s = normalizeComparable(oQue || "");
  if (/cafe/.test(s)) return /(^| )cafe( |$)/;
  if (/almoco/.test(s)) return /(^| )almoco( |$)/;
  if (/jantar/.test(s)) return /(^| )jantar( |$)/;
  return null; // visita/liga\u00e7\u00e3o/reuni\u00e3o/gen\u00e9rico podem ser impl\u00edcitos \u2014 n\u00e3o exige a palavra
}
// Tipos de material que o app sabe renderizar/mandar (espelha MATERIAL_LABEL no front).
const MATERIAIS_VALIDOS = new Set([
  "planta", "tabela", "video", "folder", "localizacao", "memorial",
  "simulacao", "comparativo", "convite-visita", "material-valorizacao", "material-wellness"
]);
// Mantém só materiais com tipo válido, no máximo 3, sem repetir o mesmo tipo.
export function sanitizarMateriais(materiais) {
  if (!Array.isArray(materiais)) return [];
  const vistos = new Set();
  const out = [];
  for (const m of materiais) {
    const tipo = String(m?.tipo || "").trim().toLowerCase();
    if (!MATERIAIS_VALIDOS.has(tipo) || vistos.has(tipo)) continue;
    vistos.add(tipo);
    out.push({
      tipo,
      motivo: String(m?.motivo || "").slice(0, 160),
      quando: String(m?.quando || "").slice(0, 60)
    });
    if (out.length >= 3) break;
  }
  return out;
}

// v724-2: bloco antigo de análise/mensagem removido.


export function filtrarCompromissosReais(appointments, conversaText) {
  if (!Array.isArray(appointments) || !appointments.length) return [];
  const tl = normalizeComparable(conversaText || "").split(/\s+/).filter(Boolean);
  if (!tl.length) return [];
  const tlJoin = " " + tl.join(" ") + " ";
  return appointments.filter(ap => {
    // (2) refei\u00e7\u00e3o concreta: a palavra do tipo precisa existir na conversa real.
    const termo = termoObrigatorioDoTipo(ap && ap.oQue);
    if (termo && !termo.test(tlJoin)) return false;
    // (1) prova literal: trechoLiteral tem que bater uma sequ\u00eancia real do texto.
    const trecho = normalizeComparable(ap && ap.trechoLiteral || "").split(/\s+/).filter(t => t.length >= 2);
    if (trecho.length < 2) return false; // sem cita\u00e7\u00e3o literal \u00fatil = sem prova
    const win = Math.min(3, trecho.length); // exige uma sequ\u00eancia de palavras real
    for (let i = 0; i + win <= trecho.length; i++) {
      const seq = " " + trecho.slice(i, i + win).join(" ") + " ";
      if (tlJoin.includes(seq)) return true;
    }
    return false;
  });
}

export function parseDateTime(date, time) {
  const [d, m, yRaw] = String(date).split("/").map(Number);
  const [hh, mm] = String(time).split(":").map(Number);
  if (!d || !m || !yRaw || Number.isNaN(hh) || Number.isNaN(mm)) throw new Error("Data/hora inválida no TXT do WhatsApp.");
  const y = yRaw < 100 ? 2000 + yRaw : yRaw;
  return new Date(y, m - 1, d, hh, mm, 0).toISOString();
}

function parseWhatsAppLine(line) {
  const patterns = [
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\s*-\s*(.*?):\s*([\s\S]*)$/,
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\]\s*(.*?):\s*([\s\S]*)$/
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) return { date: match[1], time: match[2].slice(0, 5), author: match[3], text: match[4] || "" };
  }
  const systemPatterns = [
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\s*-\s*([\s\S]*)$/,
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\]\s*([\s\S]*)$/
  ];
  for (const pattern of systemPatterns) {
    const match = line.match(pattern);
    if (match) return { date: match[1], time: match[2].slice(0, 5), author: "Sistema", text: match[3] || "", system: true };
  }
  return null;
}

export function parseWhatsappTxt(txt) {
  const lines = String(txt || "").split(/\r?\n/);
  const messages = [];
  let current = null;

  function flush() {
    if (!current) return;
    current.text = stripEmojis(current.text);
    messages.push(current);
    current = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const parsed = parseWhatsAppLine(line);
    if (parsed) {
      flush();
      current = {
        id: messages.length + 1,
        date: parsed.date,
        time: parsed.time,
        iso: toIsoSafe(parsed.date, parsed.time, messages.length),
        author: stripEmojis(parsed.author || "Sistema"),
        text: stripEmojis(parsed.text || ""),
        type: parsed.system ? "system" : "text",
        source: "txt",
        order: messages.length + 1
      };
    } else if (current) {
      current.text = stripEmojis(`${current.text}\n${line}`);
    }
  }
  flush();

  return messages
    .map(m => {
      const text = String(m.text || "");
      if (!text.trim()) return m;
      const lines = text.split(/\r?\n/);
      const kept = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (HIDDEN_MEDIA_ONLY_RE.test(trimmed)) continue;
        if (ATTACHED_SUFFIX_RE.test(trimmed)) {
          if (AUDIO_INLINE_RE.test(trimmed)) { kept.push(trimmed); continue; }
          if (IMAGE_INLINE_RE.test(trimmed) || VIDEO_INLINE_RE.test(trimmed) || DOC_INLINE_RE.test(trimmed)) continue;
          continue;
        }
        if (HIDDEN_MEDIA_TAG_RE.test(trimmed)) {
          const cleaned = trimmed.replace(HIDDEN_MEDIA_CLEAN_RE, "").trim();
          if (cleaned) kept.push(cleaned);
          continue;
        }
        kept.push(trimmed);
      }
      return { ...m, text: kept.join("\n") };
    })
    .filter(m => {
      const text = String(m.text || "").trim();
      if (!text) return false;
      if (m.type === "system") return false;
      return true;
    })
    .map((m, index) => ({ ...m, id: index + 1, order: index + 1 }));
}

export function findReferencedAudio(messageText, audioNames) {
  const normalizedText = normalizeComparable(messageText);
  if (!normalizedText) return null;
  for (const original of audioNames) {
    const base = normalizeName(original);
    const normalizedBase = normalizeComparable(base);
    const withoutExt = normalizeComparable(base.replace(AUDIO_EXT, ""));
    if (normalizedText.includes(normalizedBase) || normalizedText.includes(withoutExt)) return base;
  }
  return null;
}

function dateFromAudioName(name) {
  const match = normalizeName(name).match(/(20\d{2})(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function describeOpenAIError(error) {
  if (!error) return "Erro desconhecido no provedor de análise.";
  const status = error.status || error.statusCode || error?.response?.status;
  const code = error.code || error?.error?.code;
  const type = error.type || error?.error?.type;
  const apiMessage = error?.error?.message || error?.response?.data?.error?.message || error?.message || String(error);
  const parts = [];
  if (status) parts.push(`HTTP ${status}`);
  if (code) parts.push(`code=${code}`);
  if (type && type !== code) parts.push(`type=${type}`);
  const header = parts.length ? `[${parts.join(" · ")}] ` : "";
  return header + apiMessage;
}

function isRetryableOpenAIError(error) {
  const status = error?.status || error?.statusCode || error?.response?.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  const code = String(error?.code || error?.cause?.code || "");
  if (["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED"].includes(code)) return true;
  return false;
}

async function withRetries(fn, { tries = 3, baseDelayMs = 600 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= tries) break;
      if (!isRetryableOpenAIError(error)) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

const WHISPER_EXT_MAP = { ".opus": ".ogg", ".aac": ".m4a" };

async function transcribeAudio({ zip, audioName, openai }) {
  const audioFile = zip.files[audioName];
  if (!audioFile) return "";
  const buffer = await audioFile.async("nodebuffer");
  if (buffer.length > 24 * 1024 * 1024) return ""; // Whisper aceita até 25 MB.
  const rawExt = (path.extname(audioName) || ".ogg").toLowerCase();
  // Whisper aceita ogg/m4a/mp3/wav/etc. mas rejeita .opus e .aac no nome do arquivo,
  // mesmo sendo containers equivalentes. Renomeia antes de enviar.
  const ext = WHISPER_EXT_MAP[rawExt] || rawExt;
  const tempPath = path.join(os.tmpdir(), `direciona-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  fs.writeFileSync(tempPath, buffer);
  try {
    const result = await withRetries(() => openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: modeloTranscricao(),
      language: "pt"
    }));
    return stripEmojis(result.text || "");
  } finally {
    try { fs.unlinkSync(tempPath); } catch {}
  }
}

async function transcribeAudioOnce({ zip, audioName, openai, cache }) {
  const base = normalizeName(audioName);
  if (cache[base]) return cache[base];
  let status = "api_nao_configurada";
  let text = "";
  if (openai) {
    try {
      text = await transcribeAudio({ zip, audioName, openai });
      status = text ? "transcrito" : "audio_grande_ou_vazio";
    } catch (error) {
      status = "erro_transcricao";
      cache[base] = { status, text: "", error: describeOpenAIError(error) };
      return cache[base];
    }
  }
  cache[base] = { status, text };
  return cache[base];
}

export async function buildTimeline({ zip, messages, audioFiles, audioFilesParaTranscrever = null, audioFilesForaDaJanela = [], openai }) {
  const maxAudioTranscriptions = Number(process.env.MAX_AUDIO_TRANSCRIPTIONS || 40);
  const audioNames = audioFiles.map(normalizeName);
  const permitidosTranscrever = Array.isArray(audioFilesParaTranscrever) ? new Set(audioFilesParaTranscrever.map(normalizeName)) : null;
  const foraDaJanela = new Set((audioFilesForaDaJanela || []).map(normalizeName));
  const audioTranscriptions = {};
  const timeline = [];

  // 1) PARALELIZA TODAS AS TRANSCRIÇÕES EM LOTES.
  // O modelo antigo era sequencial (uma por vez) e estourava o limite de 10s.
  // Agora roda em batches de 5 simultâneas, ganhando 60-80% do tempo.
  const audiosReferenciados = [];
  for (const msg of messages) {
    const audioRef = findReferencedAudio(msg.text, audioNames);
    if (audioRef) {
      if (permitidosTranscrever && !permitidosTranscrever.has(audioRef)) continue;
      const fullAudioName = audioFiles.find(a => normalizeName(a) === audioRef);
      if (fullAudioName) audiosReferenciados.push({ msg, audioRef, fullAudioName });
    }
  }

  // Limita ao max de transcrições
  const limitados = audiosReferenciados.slice(0, maxAudioTranscriptions);
  const naoLimitados = audiosReferenciados.slice(maxAudioTranscriptions);

  // Processa em batches de 5 paralelos
  const BATCH = 5;
  if (openai) {
    for (let i = 0; i < limitados.length; i += BATCH) {
      const batch = limitados.slice(i, i + BATCH);
      await Promise.all(batch.map(async (item) => {
        try {
          const result = await transcribeAudioOnce({ zip, audioName: item.fullAudioName, openai, cache: audioTranscriptions });
          audioTranscriptions[item.audioRef] = result;
        } catch (error) {
          audioTranscriptions[item.audioRef] = { status: "erro_transcricao", text: "", error: describeOpenAIError(error) };
        }
      }));
    }
  }
  // Os que passaram do limite ficam como "limite_transcricao"
  for (const item of naoLimitados) {
    audioTranscriptions[item.audioRef] = { status: "limite_transcricao", text: "" };
  }

  // 2) Monta a timeline com base nos resultados (preservando a ordem das mensagens originais)
  const usedAudio = new Set();
  for (const msg of messages) {
    const audioRef = findReferencedAudio(msg.text, audioNames);
    if (audioRef) {
      usedAudio.add(audioRef);
      const transcription = audioTranscriptions[audioRef] || {
        status: foraDaJanela.has(audioRef) ? "nao_transcrito_fora_do_periodo" : (openai ? "limite_transcricao" : "api_nao_configurada"),
        text: ""
      };
      const textoAudio = transcription.text
        ? `[Áudio transcrito] ${transcription.text}`
        : (transcription.status === "nao_transcrito_fora_do_periodo"
          ? `[Áudio: ${audioRef} — não transcrito por estar fora do período escolhido]`
          : `[Áudio: ${audioRef} — ${transcription.status}]`);
      timeline.push({
        ...msg,
        type: "audio",
        mediaFile: audioRef,
        audioStatus: transcription.status,
        text: textoAudio,
        source: "audio"
      });
      continue;
    }
    timeline.push({ ...msg, type: msg.type || "text", text: stripEmojis(msg.text), source: "txt" });
  }

  // 3) Áudios soltos no ZIP que não estavam referenciados no TXT, transcreve também em paralelo
  const audiosSoltos = audioFiles.filter(a => !usedAudio.has(normalizeName(a)));
  const restanteOrcamento = Math.max(0, maxAudioTranscriptions - limitados.length);
  const soltosElegiveis = permitidosTranscrever ? audiosSoltos.filter(a => permitidosTranscrever.has(normalizeName(a))) : audiosSoltos;
  const soltosParaTranscrever = soltosElegiveis.slice(0, restanteOrcamento);
  if (openai && soltosParaTranscrever.length) {
    for (let i = 0; i < soltosParaTranscrever.length; i += BATCH) {
      const batch = soltosParaTranscrever.slice(i, i + BATCH);
      await Promise.all(batch.map(async (audio) => {
        try {
          const result = await transcribeAudioOnce({ zip, audioName: audio, openai, cache: audioTranscriptions });
          const base = normalizeName(audio);
          audioTranscriptions[base] = result.status === "transcrito" ? { ...result, status: "transcrito_sem_posicao_exata" } : result;
        } catch (_) {}
      }));
    }
  }
  for (const audio of audiosSoltos) {
    const base = normalizeName(audio);
    const transcription = audioTranscriptions[base] || { status: openai ? "nao_referenciado_no_txt" : "api_nao_configurada", text: "" };
    const approxDate = dateFromAudioName(base);
    timeline.push({
      id: timeline.length + 1,
      date: approxDate || "",
      time: "",
      iso: approxDate ? toIsoSafe(approxDate, "23:59", timeline.length) : "9999-12-31T23:59:59.000Z",
      author: "Áudio sem referência exata",
      text: transcription.text
        ? `[Áudio transcrito sem posição exata no TXT: ${base}] ${transcription.text}`
        : `[Áudio encontrado sem posição exata no TXT: ${base} — ${transcription.status}]`,
      type: "audio_unlinked",
      mediaFile: base,
      audioStatus: transcription.status,
      source: "audio"
    });
  }

  timeline.sort((a, b) => String(a.iso).localeCompare(String(b.iso)) || Number(a.order || 0) - Number(b.order || 0));
  return { timeline, audioTranscriptions, transcriptionEnabled: !!openai };
}

function detectPhone(text = "") {
  const matches = String(text).match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/g) || [];
  return matches.map(v => v.replace(/\D/g, "")).find(v => v.length >= 10) || "";
}

function detectProduct(fullText = "") {
  // v827 §7.1: sem catálogo fixo de empreendimentos. O produto passa a vir só da análise
  // da IA sobre a conversa; na importação inicial fica indefinido (cautela, não invenção).
  return "Não identificado";
}

function pickClientName(authors = []) {
  // O nome importado é dado de origem: deve permanecer exatamente como aparece no TXT.
  // Só excluímos autores inequivocamente pertencentes ao lado da empresa; não corrigimos,
  // abreviamos nem retiramos palavras que possam fazer parte do nome salvo no WhatsApp.
  const businessHints = /^(?:sistema|construtora\s+senger|sanchai|atendimento\s*\(corretor\)|miguel\s+kirinus)$/i;
  const raw = authors.find(a => String(a || "").trim() && !businessHints.test(String(a).trim()))
    || authors.find(Boolean)
    || "Cliente não identificado";
  return String(raw).trim() || "Cliente não identificado";
}

export function guessLeadData(timeline) {
  const authors = [...new Set(timeline.map(m => m.author).filter(Boolean).filter(a => a !== "Sistema" && a !== "Áudio sem referência exata"))];
  const fullText = timeline.map(m => m.text).join(" ");
  const lastInteraction = [...timeline].reverse().find(m => m.type !== "audio_unlinked") || timeline[timeline.length - 1] || null;
  return {
    clientName: pickClientName(authors),
    phone: detectPhone(fullText),
    participants: authors,
    product: detectProduct(fullText),
    totalTimelineItems: timeline.length,
    textItems: timeline.filter(m => m.type === "text").length,
    audioItems: timeline.filter(m => String(m.type).startsWith("audio")).length,
    lastInteraction
  };
}


// Junta as mensagens REAIS que o corretor já mandou nesta conversa pra usar como exemplo de VOZ —
// o gerador copia o tom/jeito dele em vez de escrever robótico. "" se não houver exemplo bom.
function exemplosDoCorretor(timeline) {
  if (!Array.isArray(timeline)) return "";
  const business = /(senger|construtora|corretor|imobili[áa]ria|direciona|atendimento)/i;
  const out = [];
  for (const m of timeline) {
    if (!m || m.system) continue;
    const autor = String(m.author || "").trim();
    const texto = String(m.text || "").replace(/\s+/g, " ").trim();
    if (!autor || autor === "Sistema" || !business.test(autor)) continue;
    if (texto.length < 18 || texto.length > 300) continue;
    if (/<m[íi]dia|arquivo anexado|[áa]udio|https?:\/\//i.test(texto)) continue;
    out.push(texto);
  }
  return [...new Set(out)].slice(-8).map(t => `- ${t}`).join("\n");
}



const CEREBRO_PROMPT_MINIMO = "Leia toda a conversa de WhatsApp.\n\nIdentifique:\n1. qual foi a última pergunta ou pendência real;\n2. o que o cliente já respondeu;\n3. o que o corretor não deve perguntar de novo;\n4. qual é o próximo passo comercial mais natural.\n\nGere 3 mensagens curtas de WhatsApp que continuem exatamente de onde a conversa parou.\n\nNão seja genérico.\nNão reinicie a venda.\nNão pergunte o que já foi respondido.";
function isLegacyCerebroText(v) {
  const t = String(v || "").toLowerCase();
  return /m[eé]todo corretor pro/.test(t)
    || /identifique a fase do cliente/.test(t)
    || /cite o produto espec[ií]fico/.test(t)
    || /sem ['’]faz sentido['’].*sem ['’]t[oô] retomando contato/.test(t);
}
function sanitizeCerebroConfig(valor = {}) {
  const v = valor && typeof valor === "object" ? valor : {};
  return {
    corretorNome: typeof v.corretorNome === "string" ? v.corretorNome.slice(0,80).trim() : "",
    metodo: typeof v.metodo === "string" ? (isLegacyCerebroText(v.metodo) ? CEREBRO_PROMPT_MINIMO : v.metodo) : CEREBRO_PROMPT_MINIMO,
    tom: typeof v.tom === "string" ? (isLegacyCerebroText(v.tom) ? "" : v.tom) : "",
    diferenciais: typeof v.diferenciais === "string" ? (isLegacyCerebroText(v.diferenciais) ? "" : v.diferenciais) : "",
    evitar: typeof v.evitar === "string" ? (isLegacyCerebroText(v.evitar) ? "" : v.evitar) : "",
    diasImportacao: Number(v.diasImportacao) > 0 ? Number(v.diasImportacao) : 90,
    regras: Array.isArray(v.regras) ? v.regras : [],
    objecoes: Array.isArray(v.objecoes) ? v.objecoes : []
  };
}
function hasCerebroContent(cfg) {
  if (!cfg || typeof cfg !== "object") return false;
  return [cfg.corretorNome, cfg.metodo, cfg.tom, cfg.diferenciais, cfg.evitar].some(v => String(v || "").trim())
    || (Array.isArray(cfg.regras) && cfg.regras.length)
    || (Array.isArray(cfg.objecoes) && cfg.objecoes.length);
}
function formatCerebroPrompt(cfg) {
  const c = sanitizeCerebroConfig(cfg || {});
  const regras = (Array.isArray(c.regras) ? c.regras : [])
    .map(r => typeof r === "string" ? r : r?.texto)
    .filter(Boolean)
    .map(r => `- ${String(r)}`)
    .join("\n");
  const objecoes = (Array.isArray(c.objecoes) ? c.objecoes : [])
    .map(o => typeof o === "string" ? o : `${o?.objecao || ""} => ${o?.resposta || ""}`)
    .filter(Boolean)
    .map(r => `- ${String(r)}`)
    .join("\n");
  return [
    c.metodo ? `MÉTODO DO CÉREBRO:\n${c.metodo}` : "",
    c.tom ? `TOM DE VOZ:\n${c.tom}` : "",
    c.diferenciais ? `DIFERENCIAIS/FATOS DO CORRETOR:\n${c.diferenciais}` : "",
    c.evitar ? `O QUE EVITAR:\n${c.evitar}` : "",
    regras ? `REGRAS COMERCIAIS SALVAS:\n${regras}` : "",
    objecoes ? `RESPOSTAS A OBJEÇÕES SALVAS:\n${objecoes}` : ""
  ].filter(Boolean).join("\n\n");
}


function textoIntegralCerebro(cfg) {
  const c = sanitizeCerebroConfig(cfg || {});
  return [
    c.metodo,
    c.tom,
    c.diferenciais,
    c.evitar,
    ...(Array.isArray(c.regras) ? c.regras.map(r => typeof r === "string" ? r : r?.texto) : []),
    ...(Array.isArray(c.objecoes) ? c.objecoes.map(o => typeof o === "string" ? o : `${o?.objecao || ""} ${o?.resposta || ""}`) : [])
  ].filter(Boolean).join("\n");
}

function extrairLimiarRetomada(cfg) {
  const texto = textoIntegralCerebro(cfg);
  const padroes = [
    /retom\w*[^.\n]{0,100}?(?:ap[oó]s|depois\s+de|a\s+partir\s+de)\s*(\d{1,3})\s*dias?/i,
    /(?:ap[oó]s|depois\s+de|a\s+partir\s+de)\s*(\d{1,3})\s*dias?[^.\n]{0,100}?retom\w*/i
  ];
  for (const re of padroes) {
    const m = texto.match(re);
    const n = Number(m?.[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 90) return n;
  }
  return 7;
}

function numeroDiaCivil(y, m, d) {
  if (![y, m, d].every(Number.isFinite)) return null;
  const dt = Date.UTC(y, m - 1, d);
  const check = new Date(dt);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return Math.floor(dt / 86400000);
}

function partesDataBR(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date).map(x => [x.type, x.value]));
    return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
  } catch (_) {
    return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
  }
}

function ehMensagemRealParaTempo(m) {
  if (!m || typeof m !== "object") return false;
  const source = String(m.source || "").toLowerCase();
  const type = String(m.type || "").toLowerCase();
  const author = String(m.author || "").toLowerCase();
  if (/^(sistema|system)$/.test(author.trim())) return false;
  if (/atendimento\s*\(corretor\)|anota[cç][aã]o|proposta gerada/.test(author)) return false;
  if (source === "manual" && !/(print-whatsapp|whatsapp|mensagem)/.test(type)) return false;
  if (/(nota|lembrete|proposta|atendimento)/.test(type) && source === "manual") return false;
  return true;
}

function dataCivilDeMensagem(m) {
  const iso = String(m?.iso || "").trim();
  if (iso) {
    const dt = new Date(iso);
    const p = partesDataBR(dt);
    if (p) return { ...p, dia: numeroDiaCivil(p.y, p.m, p.d), texto: `${String(p.d).padStart(2,"0")}/${String(p.m).padStart(2,"0")}/${p.y}` };
  }
  const raw = String(m?.date || m?.data || "").trim();
  let mm = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (mm) {
    const p = { y: Number(mm[3]), m: Number(mm[2]), d: Number(mm[1]) };
    return { ...p, dia: numeroDiaCivil(p.y, p.m, p.d), texto: `${String(p.d).padStart(2,"0")}/${String(p.m).padStart(2,"0")}/${p.y}` };
  }
  mm = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mm) {
    const p = { y: Number(mm[1]), m: Number(mm[2]), d: Number(mm[3]) };
    return { ...p, dia: numeroDiaCivil(p.y, p.m, p.d), texto: `${String(p.d).padStart(2,"0")}/${String(p.m).padStart(2,"0")}/${p.y}` };
  }
  return null;
}

export function calcularContextoTemporalMensagens(timeline, cfg = {}, agora = new Date()) {
  const hojePartes = partesDataBR(agora);
  const hojeDia = hojePartes ? numeroDiaCivil(hojePartes.y, hojePartes.m, hojePartes.d) : null;
  let ultima = null;
  const todos = Array.isArray(timeline) ? timeline : [];
  const reais = todos.filter(ehMensagemRealParaTempo);
  const base = reais.length ? reais : todos;
  for (const item of base) {
    const p = dataCivilDeMensagem(item);
    if (p?.dia != null && (!ultima || p.dia >= ultima.dia)) ultima = p;
  }
  const limiar = extrairLimiarRetomada(cfg);
  const dias = hojeDia != null && ultima?.dia != null ? Math.max(0, hojeDia - ultima.dia) : null;
  const modo = dias == null ? "sem-data" : (dias >= limiar ? "retomada" : "continuidade");
  return { dias, limiar, modo, ultimaData: ultima?.texto || "Não identificada" };
}

const PADROES_GENERICOS_RETOMADA = [
  /\bpassando\s+(?:pra|para)\s+(?:saber|ver|perguntar)\b/i,
  /\bfico\s+(?:à|a)\s+disposi[cç][aã]o\b/i,
  /\bs[oó]\s+me\s+chamar\b/i,
  /\bme\s+avise\s+quando\b/i,
  /\bquando\s+for\s+um\s+bom\s+momento\b/i,
  /\bespero\s+que\s+(?:voc[eê]\s+)?esteja\s+bem\b/i,
  /\bpensar\s+com\s+carinho\b/i,
  /\bretomar\s+(?:a|nossa)\s+conversa\b/i,
  /\bse\s+quiser\b/i
];

const STOPWORDS_ANCORA = new Set(`a ao aos aquela aquele aquilo as ate com como da das de dela dele do dos e ela ele em entre era essa esse esta este eu foi foram ha isso ja mais mas me meu minha na nas nem no nos nos o os ou para pela pelo por pra que quem se sem ser seu sua so tambem te tem ter tudo um uma voce voces queria poderia gostaria ainda agora depois antes cliente corretor contato conversa mensagem imovel imoveis apartamento apartamentos opcao opcoes valor valores condicao condicoes forma formas pagamento interesse analisar analise retorno oi ola tudo bem bom boa dia tarde noite`.split(/\s+/));

function normalizarBusca(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function ancorasDaConversa(timeline) {
  const base = (Array.isArray(timeline) ? timeline.filter(ehMensagemRealParaTempo).slice(-100) : []);
  const texto = base
    .map(m => `${m?.text || ""}`)
    .join(" ");
  const tokens = normalizarBusca(texto).match(/[a-z0-9]{3,}/g) || [];
  const freq = new Map();
  for (const t of tokens) {
    if (STOPWORDS_ANCORA.has(t)) continue;
    if (/^\d{1,2}$/.test(t)) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a,b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 120)
    .map(([t]) => t);
}


function horaBrasil(agora = new Date()) {
  try {
    const partes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false })
      .formatToParts(agora);
    const h = Number(partes.find(p => p.type === "hour")?.value);
    return Number.isFinite(h) ? h : agora.getHours();
  } catch (_) { return agora.getHours(); }
}

export function saudacaoBrasil(agora = new Date()) {
  const h = horaBrasil(agora);
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function escaparRegExp(texto) {
  return String(texto || "").replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

function linhasCerebro(cfg = {}) {
  const c = sanitizeCerebroConfig(cfg || {});
  return [
    c.metodo, c.tom, c.diferenciais, c.evitar,
    ...(Array.isArray(c.regras) ? c.regras.map(r => typeof r === "string" ? r : r?.texto) : [])
  ].map(v => String(v || "").trim()).filter(Boolean);
}

// v826 — Guarda determinística do "Negociando".
// A etapa comercial só pode ser "Negociação" quando há evidência concreta de
// negociação na conversa. Pedir informação, receber apresentação, fazer uma visita
// ou ficar sem responder NÃO bastam (plano §6.3 e caso Maria Clarisse §6.4).
export function temEvidenciaNegociacao(timeline = []) {
  const txt = normalizarBusca((Array.isArray(timeline) ? timeline : []).map(m => m?.text || "").join(" "));
  return [
    /proposta|contraproposta/,
    /desconto|abatimento|abater|baixar (?:o )?(?:valor|preco)|reduzir (?:o )?(?:valor|preco)/,
    /\bentrada\b|parcel|financi|forma de pagamento|fluxo de pagamento|\bsinal\b|simula(?:c|ç)/,
    /reserv(?:a|ar|ei|amos|ou)/,
    /condi(?:c|ç)(?:a|ã)o(?:es)? (?:comercial|especial|de pagamento)|ultima condi|melhor condi|ajust(?:e|ar|amos) (?:o )?(?:valor|preco|condi)/,
    /escolh\w+ (?:a )?unidade[^.]*(?:valor|preco|condi|parcel|entrada|negocia)/
  ].some(re => re.test(txt));
}

export function ajustarEtapaNegociacao(etapaSugerida, timeline = []) {
  const bruta = String(etapaSugerida || "");
  if (!/negocia/.test(normalizarBusca(bruta))) return bruta; // só age sobre Negociação/Negociando
  if (temEvidenciaNegociacao(timeline)) return bruta;         // evidência real → mantém
  // Sem evidência concreta: rebaixa para a etapa que os fatos realmente justificam.
  const txt = normalizarBusca((Array.isArray(timeline) ? timeline : []).map(m => m?.text || "").join(" "));
  const teveVisitaOuApresentacao = /visit(?:a|ou|amos|aram|ando)|decorado|apresenta|mostrei|mostramos|conheceu|plant(?:a|as)|passou no|foi (?:no|ao|conhecer)/.test(txt);
  return teveVisitaOuApresentacao ? "Visita/Proposta" : "Atendimento";
}

export function compilarRegrasObjetivasCerebro(cfg = {}, agora = new Date()) {
  const linhas = linhasCerebro(cfg);
  const integral = linhas.join("\n");
  const norm = normalizarBusca(integral);
  const proibidas = new Set();
  const adicionar = valor => {
    const v = String(valor || "").replace(/["'“”]/g, "").replace(/^[\s:;,.\-–—]+|[\s:;,.\-–—]+$/g, "").trim();
    if (!v || v.length > 40) return;
    // Nunca proibir as próprias saudações sancionadas. Regras como
    // 'Não use "oi" — use: bom dia, boa tarde ou boa noite' (tudo numa frase só)
    // faziam o parser capturar "boa tarde"/"boa noite" como proibidas e o sistema
    // passava a rejeitar a saudação que ele mesmo acabara de aplicar.
    if (/^(?:bom\s+dia|boa\s+tarde|boa\s+noite)$/.test(normalizarBusca(v))) return;
    proibidas.add(v);
  };

  for (const linha of linhas) {
    const n = normalizarBusca(linha);
    if (!/(nao\s+(?:use|usar)|evite|proibid|sem\s+["'“”]?)/.test(n)) continue;
    for (const m of linha.matchAll(/["“”']([^"“”']{1,80})["“”']/g)) adicionar(m[1]);
    let clausula = linha.match(/(?:não|nao)\s+(?:use|usar)\s+([^.;\n]{1,100})/i)?.[1];
    if (clausula) {
      // Corta antes de uma instrução positiva ("... use: bom dia") para não tratar
      // as alternativas PERMITIDAS que vêm depois como se fossem proibidas.
      clausula = clausula.split(/\b(?:use|usar|utilize|utilizar|prefira|troque|substitu\w*|diga|comece|inicie|iniciar)\b\s*:?/i)[0];
      clausula.split(/\s+(?:ou|e)\s+|,|\//i)
        .map(v => v.replace(/\b(?:nas|nos|na|no|das|dos|da|do|de\s+resposta|mensagens?|sugest[oõ]es?)\b/gi, "").trim())
        .forEach(adicionar);
    }
  }

  // Detecção da regra de saudação por horário. Antes exigia a forma proibitiva
  // ("não use oi/olá. use bom dia/boa tarde/boa noite"). Isso deixava passar as
  // formas positivas que o corretor realmente escreve ("sempre comece com bom
  // dia, boa tarde ou boa noite", "iniciar com a saudação do horário"), fazendo
  // as três mensagens saírem sem saudação. Agora aceitamos as duas formas.
  const mencionaSaudacaoHorario = /\bbom\s+dia\b|\bboa\s+tarde\b|\bboa\s+noite\b/.test(norm);
  const proibeOiOla = /(nao\s+(?:use|usar)|evite|proibid)[^\n.]{0,80}\b(?:oi|ola)\b/.test(norm);
  // Forma positiva: uma linha que cita a saudação por horário junto de um verbo
  // que manda usá-la. Exigir os dois no mesmo item evita falso positivo quando
  // "boa noite" aparece só como exemplo solto.
  let saudacaoDiretiva = false;
  for (const linha of linhas) {
    const n = normalizarBusca(linha);
    if (!/\bbom\s+dia\b|\bboa\s+tarde\b|\bboa\s+noite\b/.test(n)) continue;
    if (/(\buse\b|\busar\b|comec|inici|\bsempre\b|abertura|\babra\b|\babrir\b|cumpriment|saudac|saude|come[cç])/.test(n)) { saudacaoDiretiva = true; break; }
  }
  const regraSaudacao = saudacaoDiretiva || (proibeOiOla && mencionaSaudacaoHorario);
  if (regraSaudacao) { proibidas.add("oi"); proibidas.add("olá"); proibidas.add("ola"); }

  let maxCaracteres = null;
  let maxPalavras = null;
  for (const linha of linhas) {
    let m = linha.match(/(?:m[aá]ximo|at[eé])\s+(\d{2,4})\s+caracteres?/i);
    if (m) maxCaracteres = Number(m[1]);
    m = linha.match(/(?:m[aá]ximo|at[eé])\s+(\d{1,3})\s+palavras?/i);
    if (m) maxPalavras = Number(m[1]);
  }
  return {
    proibidas: [...proibidas].filter(v => v.length >= 2),
    saudacaoObrigatoria: regraSaudacao,
    saudacaoEsperada: regraSaudacao ? saudacaoBrasil(agora) : "",
    maxCaracteres: Number.isFinite(maxCaracteres) ? maxCaracteres : null,
    maxPalavras: Number.isFinite(maxPalavras) ? maxPalavras : null
  };
}

export function aplicarCorrecoesDeterministicasCerebro(mensagens, cfg = {}, agora = new Date()) {
  const regras = compilarRegrasObjetivasCerebro(cfg, agora);
  const out = {};
  for (const chave of ["a", "b", "c"]) {
    let msg = String(mensagens?.[chave] || "").replace(/\s+/g, " ").trim();
    if (regras.saudacaoObrigatoria && msg) {
      const esperada = regras.saudacaoEsperada;
      if (/^(?:oi|ol[aá])(?=[\s,!.-]|$)[\s,!.-]*/i.test(msg)) msg = msg.replace(/^(?:oi|ol[aá])(?=[\s,!.-]|$)[\s,!.-]*/i, `${esperada} `);
      else if (!/^(?:bom\s+dia|boa\s+tarde|boa\s+noite)\b/i.test(msg)) msg = `${esperada}, ${msg}`;
      msg = msg.replace(/^(bom\s+dia|boa\s+tarde|boa\s+noite)\s+/i, "$1, ");
    }
    out[chave] = msg.trim();
  }
  return out;
}

function palavrasRelevantesPergunta(texto) {
  return (normalizarBusca(texto).match(/[a-z0-9]{3,}/g) || [])
    .filter(t => !STOPWORDS_ANCORA.has(t) && !/^(qual|quais|quanto|quantos|como|onde|quando|porque|por)$/.test(t));
}

function perguntasRespondidasNaTimeline(timeline) {
  const arr = Array.isArray(timeline) ? timeline : [];
  const respondidas = [];
  for (let i = 0; i < arr.length; i++) {
    const m = arr[i] || {};
    if (!autorPareceNegocioPipeline(m.author) || !/\?/.test(String(m.text || ""))) continue;
    let houveResposta = false;
    for (let j = i + 1; j < arr.length; j++) {
      const prox = arr[j] || {};
      if (autorPareceClientePipeline(prox.author) && String(prox.text || "").trim()) { houveResposta = true; break; }
      if (autorPareceNegocioPipeline(prox.author) && /\?/.test(String(prox.text || ""))) break;
    }
    if (houveResposta) {
      const tokens = palavrasRelevantesPergunta(m.text);
      if (tokens.length) respondidas.push(new Set(tokens));
    }
  }
  return respondidas;
}

function perguntaRepeteRespostaExistente(msg, respondidas) {
  const trecho = String(msg || "").split(/[.!]/).filter(v => /\?/.test(v)).pop() || msg;
  const atual = new Set(palavrasRelevantesPergunta(trecho));
  if (atual.size < 2) return false;
  return respondidas.some(antiga => {
    const comuns = [...atual].filter(t => antiga.has(t)).length;
    const base = Math.min(atual.size, antiga.size);
    return base >= 2 && comuns / base >= 0.67;
  });
}

function fatosNumericos(texto) {
  const s = String(texto || "");
  const matches = [
    ...s.matchAll(/R\$\s*[\d.]+(?:,\d{1,2})?/gi),
    ...s.matchAll(/\b\d+(?:[.,]\d+)?\s*%/gi),
    ...s.matchAll(/\b\d+(?:[.,]\d+)?\s*m(?:²|2)\b/gi),
    ...s.matchAll(/\b\d+\s*x\b/gi),
    ...s.matchAll(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g)
  ];
  return matches.map(m => normalizarBusca(m[0]).replace(/\s+/g, "")).filter(Boolean);
}

export function validarMensagensCerebro(mensagens, contextoTemporal, timeline, cerebroConfig = null, agora = new Date()) {
  const trio = [mensagens?.a, mensagens?.b, mensagens?.c].map(v => String(v || "").replace(/\s+/g, " ").trim());
  const motivos = [];
  const porMensagem = [];
  const ancoras = ancorasDaConversa(timeline);
  const regras = compilarRegrasObjetivasCerebro(cerebroConfig || {}, agora);
  const respondidas = perguntasRespondidasNaTimeline(timeline);
  const conversaNorm = normalizarBusca((Array.isArray(timeline) ? timeline : []).map(m => m?.text || "").join(" ")).replace(/\s+/g, "");
  if (trio.length !== 3 || trio.some(v => !v)) motivos.push("A análise deve conter exatamente três sugestões preenchidas.");
  if (new Set(trio.map(normalizarBusca)).size !== trio.filter(Boolean).length) motivos.push("As três sugestões não podem ser duplicadas.");

  trio.forEach((msg, i) => {
    const erros = [];
    const norm = normalizarBusca(msg);
    if (msg.length < 10) erros.push("mensagem vazia ou curta");
    const qtdPerguntas = (msg.match(/\?/g) || []).length;
    if (msg && (qtdPerguntas !== 1 || !/\?\s*$/.test(msg))) erros.push("não termina com pergunta ou contém quantidade diferente de uma pergunta");
    if (regras.maxCaracteres && msg.length > regras.maxCaracteres) erros.push(`ultrapassa ${regras.maxCaracteres} caracteres`);
    if (regras.maxPalavras && msg.split(/\s+/).filter(Boolean).length > regras.maxPalavras) erros.push(`ultrapassa ${regras.maxPalavras} palavras`);
    if (regras.saudacaoObrigatoria) {
      if (/^(?:oi|ol[aá])(?=[\s,!.-]|$)/i.test(msg)) erros.push("usa saudação proibida");
      if (!new RegExp(`^${escaparRegExp(regras.saudacaoEsperada)}\\b`, "i").test(msg)) erros.push(`não usa ${regras.saudacaoEsperada} conforme o horário brasileiro`);
    }
    for (const proibida of regras.proibidas) {
      const p = normalizarBusca(proibida);
      if (p && new RegExp(`(?:^|\\b)${escaparRegExp(p).replace(/\\ /g, "\\s+")}(?:\\b|$)`, "i").test(norm)) {
        erros.push(`usa expressão proibida: ${proibida}`);
      }
    }
    if (perguntaRepeteRespostaExistente(msg, respondidas)) erros.push("repete pergunta já respondida na conversa");
    const novosFatos = fatosNumericos(msg).filter(f => !conversaNorm.includes(f));
    if (novosFatos.length) erros.push(`introduz dado numérico ausente da conversa: ${novosFatos.join(", ")}`);
    if (contextoTemporal?.modo === "retomada" && msg) {
      const generico = PADROES_GENERICOS_RETOMADA.find(re => re.test(msg));
      if (generico) erros.push("usa abertura/passividade genérica de retomada");
      if (ancoras.length && !ancoras.some(a => norm.includes(a))) erros.push("não retoma nenhum fato concreto da conversa");
    }
    if (erros.length) {
      porMensagem.push({ indice: i + 1, erros });
      motivos.push(`Mensagem ${i + 1}: ${erros.join(", ")}.`);
    }
  });
  return { ok: motivos.length === 0, motivos, porMensagem, regrasObjetivas: regras };
}

async function loadCerebroConfig(frontendConfig = null) {
  if (hasCerebroContent(frontendConfig)) return { ...sanitizeCerebroConfig(frontendConfig), _fonte: "frontend-localStorage" };
  try {
    const { getSupabaseAdmin } = await import("./_persistence.js");
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("direciona_config")
      .select("valor")
      .eq("chave", "direciona-cerebro")
      .maybeSingle();
    if (error || !data?.valor) return null;
    return { ...sanitizeCerebroConfig(data.valor), _fonte: "banco" };
  } catch (_) { return null; }
}

// Carrega SÓ o banco de inteligência aprendida (as observações extraídas de "Aprender de
// toda a carteira"). loadCerebroConfig/sanitizeCerebroConfig descartam esse campo de propósito;
// aqui a gente lê o valor cru pra alimentar as SUGESTÕES DE MENSAGEM com o jeito real do corretor.
async function loadInteligenciaAprendida() {
  try {
    const { getSupabaseAdmin } = await import("./_persistence.js");
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data } = await supabase
      .from("direciona_config")
      .select("valor")
      .eq("chave", "direciona-cerebro")
      .maybeSingle();
    const ia = data?.valor?.inteligenciaAprendida;
    return ia && typeof ia === "object" ? ia : null;
  } catch (_) { return null; }
}

// ─── APRENDIZADO CONTÍNUO REAL v808 ──────────────────────────────────────────
// Memória separada do formulário do Cérebro. Assim salvar método/tom não apaga os
// casos aprendidos e o aprendizado automático não sobrescreve campos manuais.
const MEMORIA_COMERCIAL_V2_KEY = "corretor-memoria-comercial-v2";

function hashTextoAprendizado(valor) {
  // FNV-1a de 32 bits: suficiente para detectar se a timeline mudou, sem guardar
  // o texto inteiro como índice. Não é usado como mecanismo de segurança.
  let h = 0x811c9dc5;
  const txt = String(valor || "");
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function mensagemPodeEnsinar(m) {
  if (!m || m.system) return false;
  const tipo = String(m.type || "").toLowerCase();
  const fonte = String(m.source || "").toLowerCase();
  const autor = String(m.author || "").toLowerCase();
  // Nunca aprende com uma sugestão produzida pela própria IA, mesmo que alguma
  // versão antiga a tenha gravado por engano na timeline. Algumas versões antigas
  // não preenchiam type/source, por isso o autor também faz parte da barreira.
  if (/sugest|recomenda[cç][aã]o|gerad[ao]-?ia|assistant|openai|chatgpt|ia do sistema/.test(`${tipo} ${fonte} ${autor}`)) return false;
  // v826: uma sugestão copiada pelo corretor entra na timeline como "mensagem enviada"
  // (registro do histórico), mas continua sendo texto gerado pela IA — não pode virar
  // fonte de aprendizado de estilo.
  if (tipo === "mensagem_enviada") return false;
  const texto = String(m.text || "").replace(/\s+/g, " ").trim();
  // Eventos operacionais do app não são condução comercial e não podem ensinar estilo.
  if (/^\[?(?:atendimento registrado|marcado como atendido|lembrete criado|status atualizado)\]?/i.test(texto)) return false;
  return texto.length >= 2;
}

function papelMensagemAprendizado(m, clientName = "") {
  const autor = String(m?.author || "").trim();
  const fonte = String(m?.source || "").toLowerCase();
  const tipo = String(m?.type || "").toLowerCase();
  // Observações, visitas, ligações e propostas registradas pelo corretor são contexto
  // comercial real, mesmo quando não vieram como mensagem do WhatsApp.
  if (["manual", "crm", "corretor-pro-manual"].includes(fonte) ||
      ["atendimento", "nota", "ligacao", "visita", "presencial", "observacao_manual", "proposta"].includes(tipo)) return "CORRETOR";
  if (autorPareceNegocioPipeline(autor) || /voc[êe]|mensagem enviada|atendimento \(corretor\)|observa[cç][aã]o do corretor|anota[cç][aã]o importada/i.test(autor)) return "CORRETOR";
  if (autorPareceClientePipeline(autor, { clientName })) return "CLIENTE";
  return "OUTRO";
}

// Constrói um material focado nas CONDUÇÕES REAIS: inclui cada mensagem do corretor
// e o contexto ao redor. Assim uma conversa enorme não perde as ações do meio nem a
// última mensagem, e não precisamos mandar anexos/ruídos inteiros para a IA.
export function prepararTimelineParaAprendizado(timeline, clientName = "", memoriaManual = null) {
  const arr = (Array.isArray(timeline) ? timeline : []).filter(mensagemPodeEnsinar);
  // Mesmo sem conversa suficiente, uma observação explicitamente digitada pelo corretor
  // ainda é material válido para o aprendizado contínuo.
  const escolhidos = new Set();
  arr.forEach((m, i) => {
    if (papelMensagemAprendizado(m, clientName) !== "CORRETOR") return;
    for (let j = Math.max(0, i - 5); j <= Math.min(arr.length - 1, i + 3); j++) escolhidos.add(j);
  });
  // Se não foi possível reconhecer o corretor, mantém começo e fim para não jogar
  // fora a conversa; a IA recebe a atribuição por autor e decide com cautela.
  if (!escolhidos.size) {
    for (let i = 0; i < Math.min(20, arr.length); i++) escolhidos.add(i);
    for (let i = Math.max(0, arr.length - 40); i < arr.length; i++) escolhidos.add(i);
  }
  const indices = [...escolhidos].sort((a, b) => a - b);
  const linhas = [];
  let anterior = -2;
  for (const i of indices) {
    if (i > anterior + 1) linhas.push("[... outro trecho da mesma conversa ...]");
    const m = arr[i];
    const papel = papelMensagemAprendizado(m, clientName);
    const texto = String(m.text || "").replace(/\s+/g, " ").trim().slice(0, 900);
    linhas.push(`[${m.date || ""} ${m.time || ""}] ${papel} (${String(m.author || "").slice(0, 80)}): ${texto}`);
    anterior = i;
  }
  // Informações explicitamente digitadas pelo corretor também ensinam. Só entram campos
  // marcados como manuais; inferências antigas da própria IA não podem se autoalimentar.
  const mem = memoriaManual && typeof memoriaManual === "object" ? memoriaManual : {};
  const camposManuais = new Set(Array.isArray(mem.camposManuais) ? mem.camposManuais : []);
  const rotulos = {
    preferencias:"Preferências confirmadas pelo corretor",
    pessoasDecisao:"Pessoas envolvidas na decisão",
    pontosSensiveis:"Pontos sensíveis informados pelo corretor",
    observacoes:"Observação atual do corretor"
  };
  const notas = [];
  for (const [campo, rotulo] of Object.entries(rotulos)) {
    if (!camposManuais.has(campo)) continue;
    const valor = String(mem[campo] || "").replace(/\s+/g, " ").trim().slice(0, 5000);
    if (valor) notas.push(`${rotulo}: ${valor}`);
  }
  const textosDaTimeline = new Set(arr.map(m => String(m?.text || "").replace(/\s+/g, " ").trim()).filter(Boolean));
  const observacoesManuais = Array.isArray(mem.observacoesManuais) ? mem.observacoesManuais.slice(-30) : [];
  for (const o of observacoesManuais) {
    const valor = String(o?.texto || "").replace(/\s+/g, " ").trim().slice(0, 1200);
    // Se a observação já está na timeline, não manda duas vezes para não dar peso
    // artificial ao mesmo ensinamento.
    if (valor && !textosDaTimeline.has(valor) && !notas.some(n => n.includes(valor))) notas.push(`Observação manual (${o?.dataBR || ""} ${o?.horaBR || ""}): ${valor}`);
  }
  if (notas.length) {
    linhas.push("[INFORMAÇÕES MANUAIS ATUAIS — prevalecem sobre inferências antigas da conversa]");
    linhas.push(...notas.map(n => `CORRETOR (observação manual): ${n}`));
  }

  let texto = linhas.join("\n");
  // Teto técnico. Mantém início, amostras centrais e principalmente o final, onde
  // ficam as conduções novas que precisam virar aprendizado imediatamente.
  const MAX = 48000;
  if (texto.length > MAX) {
    const partes = texto.split("\n");
    const manter = new Set();
    const addFaixa = (ini, fim) => { for (let i = Math.max(0, ini); i < Math.min(partes.length, fim); i++) manter.add(i); };
    addFaixa(0, 45);
    for (const c of [0.25, 0.5, 0.75]) {
      const meio = Math.floor(partes.length * c);
      addFaixa(meio - 18, meio + 18);
    }
    addFaixa(partes.length - 95, partes.length);
    texto = [...manter].sort((a, b) => a - b).map(i => partes[i]).join("\n").slice(-MAX);
  }
  return texto;
}

const MEMORIA_CASO_V2_PREFIX = "corretor-memoria-caso-v2:";
export const APRENDIZADO_PENDENTE_V2_PREFIX = "corretor-aprendizado-pendente-v2:";
let _memoriaComercialCacheV2 = { ts: 0, valor: null };

function memoriaComercialVazia() {
  return { versao: 2, casos: [], fontes: {}, atualizadoEm: null, bootstrapConcluidoEm: null, totalCarteiraNoBootstrap: null };
}

function sanitizarMetaMemoriaComercial(valor) {
  const v = valor && typeof valor === "object" ? valor : {};
  return {
    versao: 2,
    atualizadoEm: v.atualizadoEm || null,
    bootstrapConcluidoEm: v.bootstrapConcluidoEm || null,
    totalCarteiraNoBootstrap: Number.isFinite(Number(v.totalCarteiraNoBootstrap)) ? Number(v.totalCarteiraNoBootstrap) : null
  };
}

async function supabaseMemoriaV2() {
  const { getSupabaseAdmin } = await import("./_persistence.js");
  return getSupabaseAdmin();
}

function chaveFonteMemoriaV2(leadId, sourceHash = "") {
  const id = String(leadId || "").trim() || `sem-id-${String(sourceHash || "desconhecido")}`;
  return `${MEMORIA_CASO_V2_PREFIX}${id.slice(0, 180)}`;
}

// As mutações do lead apenas registram esta fila, operação rápida e confiável. A
// leitura pela IA acontece em uma requisição separada, para não atrasar nem fazer
// a importação/reanálise estourar o tempo da função.
export async function marcarAprendizadoPendente({ leadId, motivo = "timeline-atualizada" } = {}) {
  const id = String(leadId || "").trim();
  if (!id) return { ok: false, error: "Lead sem id para aprendizado." };
  try {
    const supabase = await supabaseMemoriaV2();
    if (!supabase) return { ok: false, error: "Supabase não configurado." };
    const agora = new Date().toISOString();
    const valor = { leadId: id, motivo: String(motivo || "timeline-atualizada").slice(0, 120), solicitadoEm: agora, tentativas: 0 };
    const { error } = await supabase.from("direciona_config").upsert({
      chave: `${APRENDIZADO_PENDENTE_V2_PREFIX}${id.slice(0, 180)}`, valor, atualizado_em: agora
    }, { onConflict: "chave" });
    return error ? { ok: false, error: error.message } : { ok: true, pendente: true };
  } catch (e) { return { ok: false, error: e?.message || String(e) }; }
}

async function loadMetaMemoriaComercialV2() {
  try {
    const supabase = await supabaseMemoriaV2();
    if (!supabase) return sanitizarMetaMemoriaComercial({});
    const { data } = await supabase.from("direciona_config").select("valor").eq("chave", MEMORIA_COMERCIAL_V2_KEY).maybeSingle();
    return sanitizarMetaMemoriaComercial(data?.valor);
  } catch (_) { return sanitizarMetaMemoriaComercial({}); }
}

async function loadFonteMemoriaV2(leadId, sourceHash = "") {
  try {
    const supabase = await supabaseMemoriaV2();
    if (!supabase) return null;
    const { data } = await supabase.from("direciona_config").select("valor").eq("chave", chaveFonteMemoriaV2(leadId, sourceHash)).maybeSingle();
    return data?.valor && typeof data.valor === "object" ? data.valor : null;
  } catch (_) { return null; }
}

// Cada lead vive em uma linha própria. Isso evita que duas importações simultâneas
// façam load-modify-save do mesmo JSON e apaguem o aprendizado uma da outra.
async function loadMemoriaComercialV2(force = false) {
  const agora = Date.now();
  if (!force && _memoriaComercialCacheV2.valor && agora - _memoriaComercialCacheV2.ts < 60000) return _memoriaComercialCacheV2.valor;
  try {
    const supabase = await supabaseMemoriaV2();
    if (!supabase) return memoriaComercialVazia();
    const meta = await loadMetaMemoriaComercialV2();
    const rows = [];
    const PAGE = 1000;
    for (let ini = 0; ini < 10000; ini += PAGE) {
      const { data, error } = await supabase
        .from("direciona_config")
        .select("chave,valor")
        .like("chave", `${MEMORIA_CASO_V2_PREFIX}%`)
        .order("chave", { ascending: true })
        .range(ini, ini + PAGE - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    const fontes = {};
    const casos = [];
    let atualizadoEm = meta.atualizadoEm;
    for (const row of rows) {
      const v = row?.valor && typeof row.valor === "object" ? row.valor : {};
      const leadId = String(v.sourceLeadId || row.chave?.slice(MEMORIA_CASO_V2_PREFIX.length) || "");
      fontes[leadId] = {
        hash: String(v.sourceHash || ""),
        nomeArquivo: String(v.sourceFile || "").slice(0, 180),
        totalMensagens: Number(v.totalMensagens) || 0,
        casos: Array.isArray(v.casos) ? v.casos.length : 0,
        processadoEm: v.processadoEm || null
      };
      if (Array.isArray(v.casos)) casos.push(...v.casos.filter(c => c && typeof c === "object"));
      if (v.processadoEm && (!atualizadoEm || String(v.processadoEm) > String(atualizadoEm))) atualizadoEm = v.processadoEm;
    }
    const valor = { ...meta, casos, fontes, atualizadoEm };
    _memoriaComercialCacheV2 = { ts: agora, valor };
    return valor;
  } catch (_) { return memoriaComercialVazia(); }
}

function textoCaso(v, max) { return String(v || "").replace(/\s+/g, " ").trim().slice(0, max); }
function removerNomeDoExemplo(texto, clientName) {
  let out = textoCaso(texto, 700);
  const nomes = String(clientName || "").split(/\s+/).map(n => n.trim()).filter(n => n.length >= 3);
  for (const n of nomes) {
    const seguro = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${seguro}\\b`, "gi"), "[cliente]");
  }
  return out.replace(/\[cliente\](?:\s+\[cliente\])+/g, "[cliente]");
}

function sanitizarCasoAprendido(caso, meta = {}) {
  if (!caso || typeof caso !== "object") return null;
  const situacao = textoCaso(caso.situacao, 420);
  const conducao = removerNomeDoExemplo(caso.conducaoCorretor || caso.conducao || caso.mensagem, meta.clientName);
  const regra = textoCaso(caso.regra, 420);
  if (situacao.length < 12 || conducao.length < 8 || regra.length < 12) return null;
  const permitidos = new Set(["observada", "validada", "parcial", "nao-funcionou", "inconclusiva"]);
  let resultado = String(caso.resultado || "observada").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  resultado = resultado.replace(/\s+/g, "-").replace(/^nao-funcionou.*$/, "nao-funcionou");
  if (!permitidos.has(resultado)) resultado = "observada";
  const idBase = [meta.leadId, situacao, conducao, regra].join("|");
  return {
    id: `${meta.leadId || "sem-id"}-${hashTextoAprendizado(idBase)}`,
    sourceLeadId: String(meta.leadId || ""),
    sourceFile: textoCaso(meta.nomeArquivo, 180),
    sourceHash: String(meta.sourceHash || ""),
    aprendidoEm: new Date().toISOString(),
    situacao,
    sinalCliente: textoCaso(caso.sinalCliente, 320),
    impedimento: textoCaso(caso.impedimento, 260),
    conducaoCorretor: conducao,
    resultado,
    evidenciaResultado: textoCaso(caso.evidenciaResultado, 320),
    regra,
    produto: textoCaso(caso.produto || meta.produto, 100),
    etapa: textoCaso(caso.etapa || meta.etapa, 80)
  };
}

async function salvarCasosAprendidos(casos, meta = {}) {
  try {
    const supabase = await supabaseMemoriaV2();
    if (!supabase) return { ok: false, error: "Supabase não configurado." };
    const novos = (Array.isArray(casos) ? casos : []).map(c => sanitizarCasoAprendido(c, meta)).filter(Boolean).slice(0, 8);
    const processadoEm = new Date().toISOString();
    const valor = {
      versao: 2,
      sourceLeadId: String(meta.leadId || ""),
      sourceFile: textoCaso(meta.nomeArquivo, 180),
      sourceHash: String(meta.sourceHash || ""),
      totalMensagens: Number(meta.totalMensagens) || 0,
      processadoEm,
      casos: novos
    };
    const { error } = await supabase.from("direciona_config").upsert({
      chave: chaveFonteMemoriaV2(meta.leadId, meta.sourceHash), valor, atualizado_em: processadoEm
    }, { onConflict: "chave" });
    if (error) return { ok: false, error: error.message };
    _memoriaComercialCacheV2 = { ts: 0, valor: null };
    return { ok: true, casosDoLead: novos.length };
  } catch (e) { return { ok: false, error: e?.message || String(e) }; }
}

export async function obterStatusAprendizadoAutomatico() {
  const mem = await loadMemoriaComercialV2(true);
  let pendentes = 0;
  try {
    const supabase = await supabaseMemoriaV2();
    if (supabase) {
      const r = await supabase.from("direciona_config").select("chave", { count: "exact", head: true }).like("chave", `${APRENDIZADO_PENDENTE_V2_PREFIX}%`);
      if (Number.isFinite(Number(r.count))) pendentes = Number(r.count);
    }
  } catch (_) {}
  return {
    versao: 2,
    ativo: true,
    totalCasos: mem.casos.length,
    historicosProcessados: Object.keys(mem.fontes || {}).length,
    aprendizadosPendentes: pendentes,
    atualizadoEm: mem.atualizadoEm,
    bootstrapConcluidoEm: mem.bootstrapConcluidoEm,
    totalCarteiraNoBootstrap: mem.totalCarteiraNoBootstrap
  };
}

export async function marcarBootstrapAprendizadoConcluido(totalCarteira) {
  try {
    const supabase = await supabaseMemoriaV2();
    if (!supabase) return false;
    const meta = await loadMetaMemoriaComercialV2();
    meta.bootstrapConcluidoEm = new Date().toISOString();
    meta.totalCarteiraNoBootstrap = Number(totalCarteira) || (await obterStatusAprendizadoAutomatico()).historicosProcessados;
    meta.atualizadoEm = new Date().toISOString();
    const { error } = await supabase.from("direciona_config").upsert({ chave: MEMORIA_COMERCIAL_V2_KEY, valor: meta, atualizado_em: meta.atualizadoEm }, { onConflict: "chave" });
    _memoriaComercialCacheV2 = { ts: 0, valor: null };
    return !error;
  } catch (_) { return false; }
}

export async function aprenderComHistoricoReal({ timeline, clientName = "", leadId = "", nomeArquivo = "", produto = "", etapa = "", memoriaManual = null, openai = null, forcar = false } = {}) {
  const material = prepararTimelineParaAprendizado(timeline, clientName, memoriaManual);
  if (material.trim().length < 40) return { ok: true, ignorado: true, motivo: "sem diálogo real", casosDoLead: 0 };
  const sourceHash = hashTextoAprendizado(material);
  const anterior = await loadFonteMemoriaV2(leadId, sourceHash);
  if (!forcar && anterior?.sourceHash === sourceHash) {
    return { ok: true, ignorado: true, motivo: "histórico já aprendido", casosDoLead: Array.isArray(anterior.casos) ? anterior.casos.length : 0 };
  }
  const oa = openai || getOpenAI();
  if (!oa) return { ok: false, error: "Análise não configurada." };
  const intel = await extrairInteligenciaObservada(material, oa);
  if (intel?._erroIA) return { ok: false, error: intel._erroIA };
  if (!intel || typeof intel !== "object") return { ok: false, error: "A IA não devolveu aprendizado válido." };
  // Mantém compatibilidade com a tela antiga de categorias e, em paralelo, grava
  // os casos estruturados que passam a guiar obrigatoriamente as sugestões.
  const legado = await registrarInteligenciaAprendida(intel);
  const salvo = await salvarCasosAprendidos(intel.casos, {
    leadId, clientName, nomeArquivo, sourceHash, produto, etapa,
    totalMensagens: Array.isArray(timeline) ? timeline.length : 0
  });
  return {
    ok: salvo.ok !== false,
    casosDoLead: salvo.casosDoLead || 0,
    totalCasos: null,
    observacoesLegadas: legado?.total || 0,
    sourceHash,
    error: salvo.error || null
  };
}

export function ranquearCasosAprendidos(casos, contexto, limite = 5) {
  const query = new Set(_tokensRank(contexto || ""));
  return (Array.isArray(casos) ? casos : []).map((c, i) => {
    const base = [c.situacao, c.sinalCliente, c.impedimento, c.regra, c.produto, c.etapa].filter(Boolean).join(" ");
    let score = _simRank(query, base);
    if (c.resultado === "validada") score += 0.10;
    else if (c.resultado === "parcial") score += 0.05;
    else if (c.resultado === "nao-funcionou") score += 0.02;
    return { ...c, _score: score, _ordem: i };
  }).filter(c => c._score > 0 || !query.size)
    .sort((a, b) => b._score - a._score || b._ordem - a._ordem)
    .slice(0, Math.max(1, limite));
}

async function casosSemelhantesPrompt(contexto) {
  const memoria = await loadMemoriaComercialV2();
  const top = ranquearCasosAprendidos(memoria.casos, contexto, 5);
  if (!top.length) return "";
  const linhas = top.map((c, i) => {
    const resultado = c.resultado === "validada" ? "resultado confirmado" : c.resultado === "nao-funcionou" ? "não funcionou — evite repetir" : c.resultado === "parcial" ? "resultado parcial" : "condução observada, ainda sem validação";
    return `${i + 1}. Situação parecida: ${c.situacao}\n   O que você realmente fez: ${c.conducaoCorretor}\n   Regra extraída: ${c.regra}\n   Evidência: ${resultado}${c.evidenciaResultado ? ` — ${c.evidenciaResultado}` : ""}`;
  });
  return `CASOS REAIS RECUPERADOS DO SEU HISTÓRICO (use a LÓGICA, nunca copie nome, produto, preço ou frase sem confirmar na conversa atual):\n${linhas.join("\n")}\n\nREGRAS DE USO DOS CASOS:\n- Sua mensagem realmente enviada vale como condução observada, mesmo sem resposta posterior.\n- Só trate como estratégia comprovada quando estiver marcada como resultado confirmado.\n- Casos marcados como não funcionou servem para evitar o mesmo erro.\n- A conversa atual continua sendo a fonte dos fatos; os casos servem apenas para decidir COMO conduzir.`;
}

// ─── CONHECIMENTO DO CORRETOR ─────────────────────────────────────────────────
// Bloco curto acumulado de tudo que o corretor ensinou nas conversas reais
// (regras de produto, FGTS, condições, respostas a objeções). Toda análise e
// geração de mensagens lê esse bloco — é a "memória geral" do sistema.
async function loadConhecimentoCorretor() {
  try {
    const { getSupabaseAdmin } = await import("./_persistence.js");
    const supabase = getSupabaseAdmin();
    if (!supabase) return "";
    const { data } = await supabase
      .from("direciona_config")
      .select("valor")
      .eq("chave", "corretor-conhecimento")
      .maybeSingle();
    return String(data?.valor?.texto || "").trim();
  } catch { return ""; }
}

// Fire-and-forget. Após cada análise, extrai o que há de novo nas mensagens do
// corretor e funde no bloco "corretor-conhecimento". Nunca bloqueia a resposta.
export async function atualizarConhecimentoCorretor(timelineText, openai) {
  try {
    if (!openai || !timelineText) return;
    const { getSupabaseAdmin } = await import("./_persistence.js");
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    const { data } = await supabase
      .from("direciona_config")
      .select("valor")
      .eq("chave", "corretor-conhecimento")
      .maybeSingle();
    const atual = String(data?.valor?.texto || "").trim();
    const promptAtualizar = `Você mantém a base de conhecimento de um corretor de imóveis.

CONHECIMENTO ATUAL:
${atual || "(vazio)"}

CONVERSA DO CORRETOR COM CLIENTE:
${timelineText.slice(0, 5000)}

Identifique APENAS fatos NOVOS e concretos que o corretor ensinou nessa conversa: regras de produto, condições de pagamento, FGTS, financiamento, empreendimentos, respostas a objeções reais. Se um fato já está no conhecimento atual, não repita. Funda tudo em texto corrido simples, máximo 400 palavras, sem títulos formais. Se não houver nada novo de concreto, devolva o CONHECIMENTO ATUAL sem alterar. Retorne SOMENTE o texto final.`;
    const completion = await openai.chat.completions.create({
      model: modeloTarefasSimples(),
      messages: [{ role: "user", content: promptAtualizar }],
      max_tokens: 700
    });
    const novo = String(completion.choices?.[0]?.message?.content || "").trim();
    if (!novo || novo.length < 20) return;
    await supabase
      .from("direciona_config")
      .upsert({ chave: "corretor-conhecimento", valor: { texto: novo }, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  } catch (e) {
    console.warn("[direciona] atualizarConhecimentoCorretor:", e?.message || e);
  }
}

const _semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Extrai (sem banco, sem IA) as mensagens que o CORRETOR escreveu numa timeline — nunca as do cliente.
export function extrairRespostasCorretor(timeline, clientName) {
  if (!Array.isArray(timeline) || !timeline.length) return [];
  const cliFirst = _semAcento(clientName).split(/\s+/)[0] || "";
  const ehMidiaLink = (t) => /<m[íi]dia|arquivo anexado|[áa]udio|figurinha|sticker|https?:\/\//i.test(t);
  const out = [];
  for (const m of timeline) {
    if (!m || m.system) continue;
    const tipo = String(m.type || "").toLowerCase();
    const src = String(m.source || "").toLowerCase();
    const autorRaw = String(m.author || "");
    const texto = String(m.text || "").replace(/\s+/g, " ").trim();
    if (texto.length < 15 || texto.length > 400) continue;
    if (ehMidiaLink(texto)) continue;
    // Notas/atendimentos manuais DESCRITIVOS ("liguei, ele disse...") não são mensagem — fora.
    // Mas "Mensagem enviada (WhatsApp)" (type "mensagem") É resposta real dele — entra.
    if (src === "manual" && tipo !== "mensagem") continue;
    const marcadorCorretor = /voc[êe]|corretor|atendimento|mensagem enviada|senger/i.test(autorRaw) || tipo === "mensagem";
    const autorFirst = _semAcento(autorRaw).split(/\s+/)[0] || "";
    if (cliFirst && autorFirst && autorFirst === cliFirst) continue; // é o cliente — nunca entra
    if (!marcadorCorretor && !autorFirst) continue; // sem como atribuir → pula
    out.push(texto);
  }
  return out;
}

// Banco do ESTILO REAL do corretor: junta as mensagens que ELE mesmo escreveu (não o cliente),
// de TODAS as conversas processadas. É isso que faz a sugestão soar como ELE — reaproveitando o
// jeito real que ele abre e pergunta — em vez de texto genérico de IA. Rolante (últimas ~80).
export async function atualizarRespostasCorretor(timeline, clientName) {
  try {
    const novas = extrairRespostasCorretor(timeline, clientName);
    if (!novas.length) return;
    const { getSupabaseAdmin } = await import("./_persistence.js");
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    const { data } = await supabase.from("direciona_config").select("valor").eq("chave", "corretor-respostas").maybeSingle();
    const atuais = Array.isArray(data?.valor?.exemplos) ? data.valor.exemplos : [];
    const vistos = new Set(atuais.map(t => _semAcento(t)));
    for (const t of novas) { const k = _semAcento(t); if (!vistos.has(k)) { vistos.add(k); atuais.push(t); } }
    const lista = atuais.slice(-80);
    await supabase.from("direciona_config").upsert({ chave: "corretor-respostas", valor: { exemplos: lista }, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  } catch (e) {
    console.warn("[direciona] atualizarRespostasCorretor:", e?.message || e);
  }
}

// Varre TODA a carteira (timelines já salvas) e enche o banco de estilo de uma vez — SEM IA,
// só leitura. Usado pelo botão "Aprender da carteira" pra bootstrap dos leads já existentes.
export async function aprenderRespostasDaCarteira() {
  try {
    const { getSupabaseAdmin } = await import("./_persistence.js");
    const supabase = getSupabaseAdmin();
    if (!supabase) return { ok: false, error: "Supabase não configurado." };
    const { data: rows, error } = await supabase
      .from("whatsapp_processamentos")
      .select("timeline_json, resultado_analise")
      .order("atualizado_em", { ascending: true })
      .limit(3000);
    if (error) return { ok: false, error: error.message };
    const bag = [];
    const vistos = new Set();
    for (const r of (rows || [])) {
      const tl = Array.isArray(r.timeline_json) ? r.timeline_json : [];
      const cli = r.resultado_analise?.clientName || r.resultado_analise?.lead?.clientName || "";
      for (const t of extrairRespostasCorretor(tl, cli)) {
        const k = _semAcento(t);
        if (!vistos.has(k)) { vistos.add(k); bag.push(t); }
      }
    }
    const lista = bag.slice(-120); // guarda bastante exemplo, priorizando os mais recentes
    await supabase.from("direciona_config").upsert({ chave: "corretor-respostas", valor: { exemplos: lista }, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
    return { ok: true, total: lista.length, lidos: rows?.length || 0 };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function loadRespostasCorretor() {
  try {
    const { getSupabaseAdmin } = await import("./_persistence.js");
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];
    const { data } = await supabase.from("direciona_config").select("valor").eq("chave", "corretor-respostas").maybeSingle();
    return Array.isArray(data?.valor?.exemplos) ? data.valor.exemplos : [];
  } catch { return []; }
}

// Acumula a INTELIGÊNCIA COMERCIAL observada em cada análise (tons, técnicas, respostas
// a objeções, matches produto×perfil, padrões de follow-up). Cada categoria limita a 30
// entradas mais recentes. Fire-and-forget — falha aqui não derruba a análise.
export async function registrarInteligenciaAprendida(intel) {
  if (!intel || typeof intel !== "object") return { ok: false, motivo: "intel vazio" };
  const push = (arr, item, max = 30) => {
    if (item == null) return arr;
    arr.push(item);
    return arr.slice(-max);
  };
  try {
    const { getSupabaseAdmin } = await import("./_persistence.js");
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    const { data } = await supabase
      .from("direciona_config")
      .select("valor")
      .eq("chave", "direciona-cerebro")
      .maybeSingle();
    const valor = data?.valor || {};
    const agora = new Date().toISOString();
    const ia = valor.inteligenciaAprendida && typeof valor.inteligenciaAprendida === "object" ? valor.inteligenciaAprendida : {};
    ia.tons = Array.isArray(ia.tons) ? ia.tons : [];
    ia.tecnicas = Array.isArray(ia.tecnicas) ? ia.tecnicas : [];
    ia.objecoes = Array.isArray(ia.objecoes) ? ia.objecoes : [];
    ia.produtoVsPerfil = Array.isArray(ia.produtoVsPerfil) ? ia.produtoVsPerfil : [];
    ia.movimentosOk = Array.isArray(ia.movimentosOk) ? ia.movimentosOk : [];
    ia.movimentosTravaram = Array.isArray(ia.movimentosTravaram) ? ia.movimentosTravaram : [];
    ia.padroesFollowup = Array.isArray(ia.padroesFollowup) ? ia.padroesFollowup : [];

    // Stopwords + nomes próprios comuns (pra normalizar antes de comparar tom)
    const STOPWORDS = new Set([
      "que","com","para","por","sem","mais","menos","muito","pouco","esta","esse","essa","este","seu","sua","você","voce","tudo","sobre","como","quando","onde","aqui","ali","jamil","isabela","amiel","victor","paty","taiany","laura","jean","thuane","jessica","rafael","gilmar","alison","emerson","gabriele","joel","daniele","julia","henrique","karoliny","ricardo","alberto","marcia","monique","sanchai","cristian","fabio","douglas","zuleica","cliente","corretor","corretora","sanger","senger","construtora"
    ]);
    // Helper: similaridade entre textos (Jaccard) — ignora stopwords e nomes próprios
    const simTexto = (a, b) => {
      const norm = s => String(s||"").toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length >= 3 && !STOPWORDS.has(w));
      const wa = new Set(norm(a));
      const wb = new Set(norm(b));
      if (!wa.size || !wb.size) return 0;
      let inter = 0;
      for (const w of wa) if (wb.has(w)) inter++;
      return inter / Math.max(wa.size, wb.size);
    };
    // Helper: rejeita texto com poucas palavras significativas (lixo de transcrição)
    const ehTextoValido = (s, minPalavras) => {
      const palavras = String(s||"").trim().split(/\s+/).filter(w => w.replace(/[^\w]/g, "").length >= 2);
      return palavras.length >= minPalavras;
    };
    // Helper: detecta técnica genérica (chavão sem ação concreta)
    const ehTecnicaGenerica = (txt) => {
      const t = String(txt||"").toLowerCase();
      // Rejeita se for só chavão sem indicação de movimento concreto
      const chavoes = [
        /^ofereceu ajuda\b/, /^explicou (vantage|benefíci|diferencia)/,
        /^fez perguntas? abertas?\b/, /^mostrou (interesse|disposi|amigá|atenç)/,
        /^demonstrou interesse\b/, /^foca[r]? (nas?|no) preferênc/,
        /^apresent[oa]u? opç[õo]es variad/, /^mostr[oa]u? tom\b/,
        /^verifica[r]? (a )?situação/, /^destac[oa]u? (a )?(flex|qualidad)/
      ];
      if (chavoes.some(re => re.test(t))) return true;
      // Se não tem nenhum verbo de ação específica nem objeto claro, é genérico
      return false;
    };

    const tom = String(intel.tom || "").trim();
    if (tom.length >= 20) {
      // Dedupe: se já existe tom com similaridade >= 0.7, atualiza timestamp em vez de adicionar
      const idx = ia.tons.findIndex(e => simTexto(e.texto, tom) >= 0.4);
      if (idx >= 0) {
        ia.tons[idx] = { quando: agora, texto: tom.slice(0, 280) };
      } else {
        ia.tons = push(ia.tons, { quando: agora, texto: tom.slice(0, 280) }, 20);
      }
    }

    for (const t of (Array.isArray(intel.tecnicas) ? intel.tecnicas : [])) {
      const txt = String(t || "").trim();
      if (txt.length < 10) continue;
      if (ehTecnicaGenerica(txt)) continue; // pula chavões
      if (!ehTextoValido(txt, 4)) continue;
      // Dedupe leve: se já existe técnica muito parecida, atualiza
      const idx = ia.tecnicas.findIndex(e => simTexto(e.texto, txt) >= 0.5);
      if (idx >= 0) {
        ia.tecnicas[idx] = { quando: agora, texto: txt.slice(0, 240) };
      } else {
        ia.tecnicas = push(ia.tecnicas, { quando: agora, texto: txt.slice(0, 240) }, 50);
      }
    }
    for (const o of (Array.isArray(intel.objecoes) ? intel.objecoes : [])) {
      if (!o || typeof o !== "object") continue;
      const objecao = String(o.objecao || "").trim();
      const resposta = String(o.respostaUsada || "").trim();
      // Validação: mínimo de palavras significativas em ambos
      if (!ehTextoValido(objecao, 2)) continue;
      if (!ehTextoValido(resposta, 4)) continue;
      // Rejeita "objeções" que são na verdade comentários operacionais do corretor
      const objNorm = objecao.toLowerCase();
      const padraoCorretor = /\bcliente\s+n[ãa]o\s+(atend|respond|retorn)|n[ãa]o\s+conseguiu?\s+contato|dificuldade\s+(de\s+)?contato|\b(julia|amiel|isabela|sanchai|monique)\s+mencionou\b/;
      if (padraoCorretor.test(objNorm)) continue;
      // Rejeita status passageiros que não são objeção real
      const padraoStatus = /^(n[ãa]o\s+consegui|estou\s+com\s+(bastante\s+)?coisa|tempo\s+para\s+decidir|preciso\s+pensar|vou\s+pensar|aguardando\s+(aumento|retorno|resposta)|valor\s+da\s+folha)/;
      if (padraoStatus.test(objNorm)) continue;
      // Dedupe: se já tem objeção muito parecida, atualiza
      const idx = ia.objecoes.findIndex(e => simTexto(e.objecao, objecao) >= 0.55);
      const novaEntrada = { quando: agora, objecao: objecao.slice(0, 140), respostaUsada: resposta.slice(0, 240), funcionou: o.funcionou === true ? true : (o.funcionou === false ? false : null) };
      if (idx >= 0) {
        ia.objecoes[idx] = novaEntrada;
      } else {
        ia.objecoes = push(ia.objecoes, novaEntrada, 60);
      }
    }
    for (const p of (Array.isArray(intel.produtoVsPerfil) ? intel.produtoVsPerfil : [])) {
      if (!p || typeof p !== "object") continue;
      const prod = String(p.produto || "").trim();
      const perfil = String(p.perfilCliente || "").trim();
      const reacao = String(p.reacao || "").trim();
      if (!prod || !perfil) continue;
      // Dedupe: se já existe entrada com mesma combinação produto+perfil (case-insensitive),
      // atualiza a reação e marca o quando, sem duplicar.
      const chave = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const idxExistente = ia.produtoVsPerfil.findIndex(e => chave(e.produto||"") === chave(prod) && chave(e.perfilCliente||"") === chave(perfil));
      if (idxExistente >= 0) {
        ia.produtoVsPerfil[idxExistente] = { quando: agora, produto: prod.slice(0,60), perfilCliente: perfil.slice(0,180), reacao: reacao.slice(0,140) };
      } else {
        ia.produtoVsPerfil = push(ia.produtoVsPerfil, { quando: agora, produto: prod.slice(0,60), perfilCliente: perfil.slice(0,180), reacao: reacao.slice(0,140) }, 40);
      }
    }
    for (const m of (Array.isArray(intel.movimentosQueAvancaram) ? intel.movimentosQueAvancaram : [])) {
      const txt = String(m || "").trim();
      if (txt.length < 10 || !ehTextoValido(txt, 4)) continue;
      // Evita sobreposição com Técnicas (mesmo registro em 2 categorias)
      const dupTec = ia.tecnicas.findIndex(e => simTexto(e.texto, txt) >= 0.45);
      if (dupTec >= 0) continue;
      const idx = ia.movimentosOk.findIndex(e => simTexto(e.texto, txt) >= 0.55);
      if (idx >= 0) ia.movimentosOk[idx] = { quando: agora, texto: txt.slice(0, 240) };
      else ia.movimentosOk = push(ia.movimentosOk, { quando: agora, texto: txt.slice(0, 240) });
    }
    for (const m of (Array.isArray(intel.movimentosQueTravaram) ? intel.movimentosQueTravaram : [])) {
      const txt = String(m || "").trim();
      if (txt.length < 10 || !ehTextoValido(txt, 4)) continue;
      const idx = ia.movimentosTravaram.findIndex(e => simTexto(e.texto, txt) >= 0.55);
      if (idx >= 0) ia.movimentosTravaram[idx] = { quando: agora, texto: txt.slice(0, 240) };
      else ia.movimentosTravaram = push(ia.movimentosTravaram, { quando: agora, texto: txt.slice(0, 240) });
    }
    for (const f of (Array.isArray(intel.padroesFollowup) ? intel.padroesFollowup : [])) {
      const txt = String(f || "").trim();
      if (txt.length < 10 || !ehTextoValido(txt, 4)) continue;
      const idx = ia.padroesFollowup.findIndex(e => simTexto(e.texto, txt) >= 0.55);
      if (idx >= 0) ia.padroesFollowup[idx] = { quando: agora, texto: txt.slice(0, 240) };
      else ia.padroesFollowup = push(ia.padroesFollowup, { quando: agora, texto: txt.slice(0, 240) });
    }
    valor.inteligenciaAprendida = ia;
    const up = await supabase
      .from("direciona_config")
      .upsert({ chave: "direciona-cerebro", valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
    if (up?.error) {
      console.warn("[direciona] upsert direciona_config falhou:", up.error.message);
      return { ok: false, motivo: up.error.message };
    }
    const totalGravado = (ia.tons?.length||0)+(ia.tecnicas?.length||0)+(ia.objecoes?.length||0)+(ia.produtoVsPerfil?.length||0)+(ia.movimentosOk?.length||0)+(ia.movimentosTravaram?.length||0)+(ia.padroesFollowup?.length||0);
    console.log("[direciona] inteligencia aprendida atualizada — total no banco:", totalGravado);
    return { ok: true, total: totalGravado };
  } catch (e) {
    console.warn("[direciona] registrarInteligenciaAprendida erro:", e?.message || e);
    return { ok: false, motivo: e?.message || String(e) };
  }
}

// ── Relevância: prioriza as lições aprendidas mais PARECIDAS com o cliente atual ──
// (em vez de só "as mais recentes"). Guardamos MAIS no banco, mas mandamos pro
// raciocínio só as que casam com a situação deste cliente — mantém a IA focada
// sem perder memória.
const _STOPWORDS_RANK = new Set([
  "que","com","para","por","sem","mais","menos","muito","pouco","esta","esse","essa","este","seu","sua","você","voce","tudo","sobre","como","quando","onde","aqui","ali","cliente","corretor","corretora","sanger","senger","construtora","uma","uns","dos","das","nos","nas","ele","ela","isso","aquilo","tem","ter","foi","ser","esta","estou","entao","então","tambem","também","porque","pois","cada","entre","depois","antes","ainda","sim","nao","não","vou","vai","fica","ficar","pode","poder","tipo","coisa","gente"
]);
function _tokensRank(s) {
  return String(s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && !_STOPWORDS_RANK.has(w));
}
function _simRank(querySet, texto) {
  const wb = new Set(_tokensRank(texto));
  if (!querySet.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wb) if (querySet.has(w)) inter++;
  return inter / Math.max(querySet.size, wb.size);
}
// Devolve as N entradas mais relevantes pro cliente atual. Sem contexto (ou se nada
// casou), cai no comportamento antigo: as N mais recentes.
function _topRelevantes(arr, textOf, querySet, n) {
  if (!Array.isArray(arr) || arr.length <= n) return arr || [];
  if (!querySet || !querySet.size) return arr.slice(-n);
  const scored = arr.map((e, i) => ({ e, i, s: _simRank(querySet, textOf(e)) }));
  if (!scored.some(x => x.s > 0)) return arr.slice(-n);
  scored.sort((a, b) => (b.s - a.s) || (b.i - a.i));
  return scored.slice(0, n).map(x => x.e);
}

// INTELIGÊNCIA COMERCIAL BASE — destilada da leitura das conversas reais da carteira do corretor.
// É o "piso" do Cérebro: vale SEMPRE, mesmo sem config salva e antes de qualquer aprendizado.
// O que o sistema aprende sozinho (tom/técnicas/objeções) SOMA a isto, nunca substitui.
const INTELIGENCIA_CARTEIRA = `INTELIGÊNCIA COMERCIAL BASE (sempre vale; aprendizado das conversas SOMA a isto):

1) QUEM É O INTERLOCUTOR (decida pela INTENÇÃO da conversa, NUNCA pelo nome do contato — nome engana, ex.: "Fulano Vendas" pode ser corretor):
- CLIENTE COMPRADOR: quer comprar pra si (morar ou investir). Fluxo de venda normal.
- CORRETOR/PARCEIRO: fala em "meu cliente", traz cliente dele, pede chave/senha/condições "pra cliente", parceria, permuta entre imóveis. NÃO cobre venda dele nem trate como comprador; conduza como parceria (material, condições pro cliente dele, reunião conjunta). O lead de verdade é o cliente DELE.
- OBRA DE TERCEIROS: pede orçamento de construção/ampliação. Não é venda de imóvel; encaminhar para a engenharia e acompanhar o orçamento.

2) QUALIFICAR antes de empurrar produto: morar ou investir? tipologia/dormitórios? faixa de valor? prazo (pronto x planta)? permuta (imóvel/carro) ou dinheiro/financiamento? Se o orçamento for menor que a faixa do produto pedido, redirecione para uma opção que caiba — SEMPRE com base no que existir no Cérebro e na conversa, nunca em produtos ou valores fixos.

3) ARGUMENTOS POR SITUAÇÃO (use o que casa com o sinal do cliente):
- Acha caro o pronto / não tem pressa / investidor → planta de lançamento: "compra na planta, congela o preço e valoriza até a entrega; quanto mais cedo no lançamento, mais barato e maior o prazo".
- Travado em pagamento → explore as formas de pagamento que a construtora realmente oferecer (entrada + saldo, parcelamento direto, condições de correção), sempre "ajustável pra ficar confortável" — sem prometer condição que não conste no Cérebro ou na conversa.
- Quer dar imóvel na troca (permuta) → só vale imóvel LÍQUIDO e de MENOR valor que o comprado ("tem que virar dinheiro rápido"); não pegar bem que vale mais que o imóvel. Reenquadre: "entrada + financiamento, bota o imóvel à venda e quita quando vender — pega desconto e ainda vende o seu por mais depois".
- Investidor → foque em opção comercial/de renda quando houver; para quem quer decidir depois (morar/alugar/revender), a opção mais flexível. Reative indeciso com comparativo histórico real de valorização. Cite apenas empreendimentos que apareçam no Cérebro ou na conversa.
- Decisão conjunta (cônjuge/filho/mãe) → não pressione; ofereça café na construtora pra apresentar junto e mantenha contato leve até a novidade/material.
- Não viu o decorado → insista com leveza: "sem ver o decorado não dá pra entender a planta"; ofereça visita/chave sem compromisso, horário flexível.

4) Conduza sempre pra UMA próxima ação concreta (visita, café na construtora, simulação, escolher unidade). Reserva só com negociação avançada (isso gera urgência saudável).`;

function montarOrientacoes(config, contextoCliente = "") {
  config = config || {};
  const partes = [INTELIGENCIA_CARTEIRA];
  // Palavras-chave do cliente atual — pra priorizar as lições aprendidas que mais batem.
  const querySet = new Set(_tokensRank(contextoCliente));
  if (config.metodo) partes.push("MÉTODO:\n" + config.metodo);
  if (config.tom) partes.push("TOM DE VOZ:\n" + config.tom);
  if (config.diferenciais) partes.push("DIFERENCIAIS:\n" + config.diferenciais);
  if (config.evitar) partes.push("EVITAR:\n" + config.evitar);
  // Base de regras comerciais (situação → como agir)
  if (Array.isArray(config.regras) && config.regras.length) {
    const linhas = config.regras
      .map(r => (typeof r === "string" ? r : r?.texto) || "")
      .filter(t => t.trim())
      .map(t => "- " + t.trim());
    if (linhas.length) partes.push("REGRAS COMERCIAIS (siga estas regras de condução ao decidir abordagem e mensagens):\n" + linhas.join("\n"));
  }
  // Biblioteca de sinais de objeção → como conduzir
  if (Array.isArray(config.objecoes) && config.objecoes.length) {
    const linhas = config.objecoes
      .filter(o => o && (o.objecao || o.resposta))
      .map(o => `- Sinal: "${(o.objecao || "").trim()}" → conduzir assim: ${(o.resposta || "").trim()}`);
    if (linhas.length) partes.push("SINAIS DE OBJEÇÃO E COMO CONDUZIR (objeção quase nunca é dita na frase literal — reconheça o sinal pelo SENTIDO/comportamento na conversa, não por palavra exata; quando identificar o sinal, conduza conforme indicado):\n" + linhas.join("\n"));
  }
  // INTELIGÊNCIA COMERCIAL APRENDIDA — observada conversa a conversa
  // Aprendizado automático gerado por análises anteriores fica DESLIGADO por padrão.
  // Ele pode carregar conclusões ruins de uma análise antiga para um caso novo. Só entra
  // quando o responsável habilitar conscientemente DIRECIONA_USAR_APRENDIZADO_AUTO=1.
  const usarAprendizadoAuto = process.env.DIRECIONA_USAR_APRENDIZADO_AUTO === "1";
  const ia = usarAprendizadoAuto && config.inteligenciaAprendida && typeof config.inteligenciaAprendida === "object"
    ? config.inteligenciaAprendida
    : null;
  if (ia) {
    if (Array.isArray(ia.tons) && ia.tons.length) {
      const linhas = ia.tons.slice(-5).map(e => "- " + (e.texto || "").trim()).filter(l => l.length > 4);
      if (linhas.length) partes.push("TOM APRENDIDO DAS SUAS ÚLTIMAS RESPOSTAS REAIS NO WHATSAPP (combine com TOM DE VOZ acima):\n" + linhas.join("\n"));
    }
    if (Array.isArray(ia.tecnicas) && ia.tecnicas.length) {
      const linhas = _topRelevantes(ia.tecnicas, e => e.texto, querySet, 8).map(e => "- " + (e.texto || "").trim()).filter(l => l.length > 4);
      if (linhas.length) partes.push("TÉCNICAS COMERCIAIS APRENDIDAS (o que VOCÊ já fez em outras conversas pra avançar a venda — use de novo quando a situação for parecida):\n" + linhas.join("\n"));
    }
    if (Array.isArray(ia.objecoes) && ia.objecoes.length) {
      const linhas = _topRelevantes(ia.objecoes, o => `${o.objecao||""} ${o.respostaUsada||""}`, querySet, 10).map(o => {
        const tag = o.funcionou === true ? "[FUNCIONOU]" : (o.funcionou === false ? "[NÃO funcionou]" : "[resultado incerto]");
        return `- Objeção: "${(o.objecao||"").trim()}" → você respondeu: ${(o.respostaUsada||"").trim()} ${tag}`;
      }).filter(l => l.length > 8);
      if (linhas.length) partes.push("RESPOSTAS A OBJEÇÕES APRENDIDAS (banco real de como você lida com objeções — prefira as marcadas [FUNCIONOU]; evite repetir as [NÃO funcionou]):\n" + linhas.join("\n"));
    }
    if (Array.isArray(ia.produtoVsPerfil) && ia.produtoVsPerfil.length) {
      const linhas = _topRelevantes(ia.produtoVsPerfil, m => `${m.perfilCliente||""} ${m.produto||""} ${m.reacao||""}`, querySet, 8).map(m => `- Perfil "${(m.perfilCliente||"").trim()}" → produto "${(m.produto||"").trim()}" → reação: ${(m.reacao||"").trim()}`).filter(l => l.length > 12);
      if (linhas.length) partes.push("MATCH PRODUTO × PERFIL APRENDIDO (quando o perfil do cliente atual bater com um destes, priorize o mesmo produto/argumento):\n" + linhas.join("\n"));
    }
    if (Array.isArray(ia.movimentosOk) && ia.movimentosOk.length) {
      const linhas = _topRelevantes(ia.movimentosOk, e => e.texto, querySet, 6).map(e => "- " + (e.texto || "").trim()).filter(l => l.length > 4);
      if (linhas.length) partes.push("MOVIMENTOS QUE DESTRANCARAM A VENDA (replique padrões em situações parecidas):\n" + linhas.join("\n"));
    }
    if (Array.isArray(ia.movimentosTravaram) && ia.movimentosTravaram.length) {
      const linhas = _topRelevantes(ia.movimentosTravaram, e => e.texto, querySet, 6).map(e => "- " + (e.texto || "").trim()).filter(l => l.length > 4);
      if (linhas.length) partes.push("MOVIMENTOS QUE TRAVARAM (evite repetir estes erros):\n" + linhas.join("\n"));
    }
    if (Array.isArray(ia.padroesFollowup) && ia.padroesFollowup.length) {
      const linhas = ia.padroesFollowup.slice(-6).map(e => "- " + (e.texto || "").trim()).filter(l => l.length > 4);
      if (linhas.length) partes.push("PADRÕES DE FOLLOW-UP APRENDIDOS (quando for follow-up, use o ritmo/abordagem que você já usa):\n" + linhas.join("\n"));
    }
  }
  // Compat: versão antiga que guardava só estiloHistorico (mantida pra não perder dados gravados antes).
  if (Array.isArray(config.estiloHistorico) && config.estiloHistorico.length && !(ia && Array.isArray(ia.tons) && ia.tons.length)) {
    const linhas = config.estiloHistorico.slice(-8).map(e => "- " + (e.estilo || "").trim()).filter(l => l.length > 4);
    if (linhas.length) partes.push("TOM APRENDIDO DAS SUAS ÚLTIMAS RESPOSTAS REAIS NO WHATSAPP:\n" + linhas.join("\n"));
  }
  return partes.length ? "\n\nOrientações do corretor para o Cérebro Comercial:\n" + partes.join("\n\n") + "\n" : "";
}

// Versão ENXUTA do aprendizado pro GERADOR DE MENSAGENS: só a voz do corretor + o que já funcionou
// (técnicas/objeções) que bate com o lead atual. Pouca coisa de propósito — pra conduzir como ELE
// sem despejar as 249 observações e distorcer (igual jogar no ChatGPT com 2 exemplos do seu jeito).
function jeitoAprendidoCompacto(config, contexto) {
  const ia = config?.inteligenciaAprendida;
  if (!ia || typeof ia !== "object") return "";
  const query = new Set(_tokensRank(contexto || ""));
  const partes = [];
  if (Array.isArray(ia.tons) && ia.tons.length) {
    const tons = ia.tons.slice(-3).map(e => String(e.texto || "").trim()).filter(t => t.length > 8);
    if (tons.length) partes.push("Seu tom: " + tons.join(" / "));
  }
  if (Array.isArray(ia.objecoes) && ia.objecoes.length) {
    const objs = _topRelevantes(ia.objecoes.filter(o => o && o.funcionou === true), o => `${o.objecao || ""} ${o.respostaUsada || ""}`, query, 4)
      .map(o => `quando "${String(o.objecao || "").trim()}", você responde: ${String(o.respostaUsada || "").trim()}`)
      .filter(l => l.length > 18);
    if (objs.length) partes.push("Objeções (do seu jeito, já funcionou): " + objs.join(" | "));
  }
  const tecs = [];
  if (Array.isArray(ia.movimentosOk)) tecs.push(...ia.movimentosOk);
  if (Array.isArray(ia.tecnicas)) tecs.push(...ia.tecnicas);
  if (tecs.length) {
    const top = _topRelevantes(tecs, e => e.texto, query, 3).map(e => String(e.texto || "").trim()).filter(t => t.length > 8);
    if (top.length) partes.push("Já funcionou com você: " + top.join(" / "));
  }
  if (Array.isArray(ia.produtoVsPerfil) && ia.produtoVsPerfil.length) {
    const mp = _topRelevantes(ia.produtoVsPerfil, m => `${m.perfilCliente || ""} ${m.produto || ""} ${m.reacao || ""}`, query, 2)
      .map(m => `perfil "${String(m.perfilCliente || "").trim()}" → você ofereceu "${String(m.produto || "").trim()}" (${String(m.reacao || "").trim()})`)
      .filter(l => l.length > 16);
    if (mp.length) partes.push("Produto certo pro perfil: " + mp.join(" | "));
  }
  if (Array.isArray(ia.padroesFollowup) && ia.padroesFollowup.length) {
    const fu = _topRelevantes(ia.padroesFollowup, e => e.texto, query, 2).map(e => String(e.texto || "").trim()).filter(t => t.length > 8);
    if (fu.length) partes.push("Seu follow-up que dá resposta: " + fu.join(" / "));
  }
  return partes.length ? "SEU JEITO (aprendido das suas conversas reais — siga seu estilo e o que já funcionou; adapte ao contexto desta conversa, NÃO copie literal):\n- " + partes.join("\n- ") : "";
}

// Extrai a INTELIGÊNCIA OBSERVADA de UMA conversa já salva (timeline em texto), pra ensinar o
// Cérebro com os leads que JÁ estão no Corretor Pro — sem reanalisar o lead inteiro. Prompt curto e
// focado, mesma forma que o campo inteligenciaObservada da análise. Retorna {} se não der pra extrair.
export async function extrairInteligenciaObservada(timelineText, openai) {
  if (!timelineText || timelineText.trim().length < 40) return {};
  // O material já vem filtrado para conter as mensagens reais do corretor e o
  // contexto ao redor. Mantemos até 48 mil caracteres, priorizando também o final,
  // para que a condução mais recente nunca desapareça do aprendizado.
  const bruto = String(timelineText || "").trim();
  const textoConversa = bruto.length <= 48000
    ? bruto
    : `${bruto.slice(0, 12000)}
[... trechos intermediários preservados pelo preparador ...]
${bruto.slice(-35000)}`;
  const prompt = `Você vai LER E ENTENDER uma conversa INTEIRA de WhatsApp entre um CORRETOR de imóveis e um cliente — TUDO que aconteceu: as PERGUNTAS, dúvidas e situações do CLIENTE e as RESPOSTAS e a condução do CORRETOR. Leia os dois lados, do começo ao fim, e entenda o que rolou.

Seu objetivo: aprender COMO O CORRETOR AGE em cada situação — qual era a situação/pergunta do cliente, o que o corretor respondeu/fez, e qual foi o resultado — pra o Corretor Pro saber repetir isso em situações SEMELHANTES no futuro. Pense sempre em PARES: "quando o cliente faz/pergunta/objeta X → o corretor responde/conduz Y → deu resultado Z".

Use SÓ o que está LITERALMENTE na conversa (perguntas e respostas reais dos dois lados) — NÃO invente. Se houver QUALQUER troca real (cliente perguntou/disse algo e o corretor respondeu), capture pelo menos o "tom" e o que dá pra observar. Só retorne {} (vazio) se a conversa for SÓ um formulário automático / saudação solta, sem nenhum diálogo real.

Retorne SOMENTE este JSON:
{
  "tom": "1-2 frases do estilo de escrita do corretor (saudação, tamanho, formalidade, fechamento)",
  "tecnicas": ["até 4 condutas ESPECÍFICAS do corretor diante de uma situação do cliente, no padrão 'cliente fez/perguntou X → corretor respondeu/fez Y → cliente reagiu Z'. Inclua o que disparou a ação (a fala do cliente), não só a ação. PROIBIDO chavão ('ofereceu ajuda','explicou vantagens','fez perguntas'). Vazio se não houver nada concreto."],
  "objecoes": [{"objecao":"a dúvida/resistência REAL que o cliente levantou (preço, prazo, esposa, vender a casa antes, etc — com a fala dele)","respostaUsada":"como o corretor respondeu/conduziu","funcionou":true}],
  "produtoVsPerfil": [{"produto":"empreendimento oferecido","perfilCliente":"perfil curto do cliente (o que ele buscava/disse)","reacao":"como o cliente reagiu a esse produto"}],
  "movimentosQueAvancaram": ["situação + ação do corretor que destravou avanço, 'diante de X o corretor fez Y → cliente avançou'"],
  "movimentosQueTravaram": ["situação + ação do corretor que esfriou o lead"],
  "padroesFollowup": ["só se OBSERVÁVEL: depois de N dias de silêncio do cliente o corretor reaqueceu com Y E o cliente respondeu"],
  "casos": [{
    "situacao":"contexto comercial factual e reutilizável, sem nome do cliente",
    "sinalCliente":"fala, condição ou comportamento real que disparou a ação",
    "impedimento":"o que bloqueava o avanço naquele momento",
    "conducaoCorretor":"a mensagem ou ação que o corretor REALMENTE usou, nunca sugestão da IA",
    "resultado":"observada|validada|parcial|nao-funcionou|inconclusiva",
    "evidenciaResultado":"o que o cliente respondeu depois; se ainda não respondeu, diga 'sem resposta posterior ainda'",
    "regra":"regra prática no formato quando X, fazer Y; evitar Z",
    "produto":"empreendimento ou categoria, se houver",
    "etapa":"momento da negociação"
  }]
}
Regras adicionais dos casos:
- Extraia no máximo 8 casos realmente úteis por conversa.
- "observada" = foi a condução escolhida pelo corretor, mas ainda não há resposta posterior.
- "validada" = a resposta do cliente confirmou avanço concreto.
- "parcial" = houve resposta, mas sem avanço claro.
- "nao-funcionou" = houve rejeição, correção de premissa, incômodo ou esfriamento depois da ação.
- Nunca classifique como validada só porque o cliente respondeu.
- Nunca aprenda com texto identificado como sugestão, recomendação, assistant ou OpenAI.
- Pedido normal do cliente ('quero valores') NÃO é objeção, é interesse; 'vou pensar' vago sem resistência NÃO é objeção; objeção é resistência explícita a fechar. funcionou=true só se o cliente avançou de fato depois da resposta; false se sumiu/repetiu/esfriou. Frases curtas e acionáveis. Não copie os exemplos.

CONVERSA (lê os dois lados, do início ao fim):
${textoConversa}`;
  // Roda no modelo simples configurado para extrações auxiliares; a análise comercial principal usa gpt-4.1 (Chat Completions).
  // (total <40s, cabe nos 60s): se uma demorar demais, a 2ª pega — acaba com o "Request timed out".
  const oaRaw = openai || getOpenAIRaw();
  let lastErr = "";
  let parseFalhou = false;
  if (oaRaw) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const completion = await oaRaw.chat.completions.create({
          model: modeloTarefasSimples(),
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          response_format: { type: "json_object" }
        }, { timeout: 18000, maxRetries: 0 });
        const raw = completion?.choices?.[0]?.message?.content || "{}";
        let p = null; try { p = JSON.parse(_extrairJson(raw)); } catch (_) { parseFalhou = true; }
        if (p && typeof p === "object") return p;
        break; // respondeu mas veio vazio/sem JSON — repetir não ajuda
      } catch (e) {
        lastErr = `${modeloTarefasSimples()}: ` + (e?.message || String(e)); // timeout/erro → tenta a 2ª vez
      }
    }
  } else {
    lastErr = "Provedor de análise não configurado no servidor";
  }
  if (parseFalhou && !lastErr) lastErr = "Análise respondeu, mas não veio JSON válido";
  // Sinaliza o motivo REAL pra cima (em vez de sumir como {} silencioso).
  return lastErr ? { _erroIA: lastErr } : {};
}

// Transcreve um áudio avulso (buffer) — usado pra ensinar o Cérebro por voz.
export async function transcreverBuffer(buffer, ext, openai) {
  if (!openai) throw new Error("Transcrição não configurada.");
  if (!buffer || !buffer.length) throw new Error("Áudio vazio.");
  if (buffer.length > 24 * 1024 * 1024) throw new Error("Áudio grande demais (máx 24 MB).");
  let e = (ext || ".ogg").toLowerCase();
  if (!e.startsWith(".")) e = "." + e;
  e = WHISPER_EXT_MAP[e] || e;
  const tempPath = path.join(os.tmpdir(), `direciona-cerebro-${Date.now()}-${Math.random().toString(16).slice(2)}${e}`);
  fs.writeFileSync(tempPath, buffer);
  try {
    const result = await withRetries(() => openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: modeloTranscricao(),
      language: "pt"
    }));
    return stripEmojis(result.text || "");
  } finally {
    try { fs.unlinkSync(tempPath); } catch {}
  }
}

function montarMemoriaEAprendizado(memoria, aprendizado, evolucao) {
  const partes = [];
  if (memoria) {
    const m = [];
    if (memoria.preferencias) m.push("Preferências: " + memoria.preferencias);
    if (memoria.pessoasDecisao) m.push("Pessoas na decisão: " + memoria.pessoasDecisao);
    if (memoria.pontosSensiveis) m.push("Pontos sensíveis: " + memoria.pontosSensiveis);
    if (memoria.observacoes) m.push("Observações do corretor: " + memoria.observacoes);
    if (m.length) partes.push("MEMÓRIA DESTE CLIENTE (do histórico, considere antes de propor abordagem):\n" + m.join("\n"));
  }
  if (aprendizado && Array.isArray(aprendizado.eventos) && aprendizado.eventos.length) {
    const last10 = aprendizado.eventos.slice(-10);
    const linhas = last10.map(e => `- ${e.quando?.slice(0, 16) || "?"} ${e.evento}${e.estilo ? " ("+e.estilo+")" : ""}`).join("\n");
    partes.push("HISTÓRICO DE AÇÕES JÁ TOMADAS COM ESTE CLIENTE (não repita exatamente as mesmas abordagens):\n" + linhas);
  }
  if (evolucao && Array.isArray(evolucao) && evolucao.length) {
    const last5 = evolucao.slice(-5);
    const linhas = last5.map(e => {
      const partes2 = [];
      if (e.comoReagiu) partes2.push("reação: " + e.comoReagiu);
      if (e.abordagemFuncionou) partes2.push("abordagem anterior funcionou: " + e.abordagemFuncionou);
      if (e.evoluiu) partes2.push("rumo: " + e.evoluiu);
      if (e.licao && e.licao !== "sem lição clara ainda") partes2.push("lição: " + e.licao);
      return "- " + partes2.join(" · ");
    }).filter(l => l.length > 2).join("\n");
    if (linhas) partes.push("APRENDIZADO REAL DESTE LEAD (de atendimentos anteriores reimportados — use pra calibrar a abordagem):\n" + linhas);
  }
  return partes.length ? "\n\n" + partes.join("\n\n") + "\n" : "";
}

async function loadLeadMemoriaAprendizado(leadId) {
  const vazio = { memoria: null, aprendizado: null, evolucao: null };
  if (!leadId) return vazio;
  try {
    const { getSupabaseAdmin } = await import("./_persistence.js");
    const supabase = getSupabaseAdmin();
    if (!supabase) return vazio;
    const { data } = await supabase
      .from("whatsapp_processamentos")
      .select("resultado_analise, atualizado_em")
      .eq("id", leadId)
      .maybeSingle();
    const r = data?.resultado_analise || {};
    return {
      memoria: r.memoria || null,
      aprendizado: r.aprendizado || null,
      evolucao: r.evolucao || null
    };
  } catch (_) { return vazio; }
}

// Calcula a faixa de horário em que o CLIENTE costuma responder/interagir,
// a partir dos horários reais das mensagens dele na timeline. Retorna "" se
// não houver dados suficientes.
function calcularMelhorHorario(timeline, clientName) {
  if (!Array.isArray(timeline) || !timeline.length) return "";
  const business = /(senger|construtora|corretor|imobiliaria|imobiliária|direciona|atendimento)/i;
  const cliente = String(clientName || "").trim().toLowerCase();
  const horas = [];
  for (const m of timeline) {
    const autor = String(m.author || "").trim();
    if (!autor || autor === "Sistema" || autor === "Áudio sem referência exata") continue;
    const autorLower = autor.toLowerCase();
    // Considera mensagem do cliente: bate com o nome dele, OU não é claramente o negócio
    const ehCliente = cliente ? (autorLower.includes(cliente) || cliente.includes(autorLower)) : !business.test(autor);
    if (!ehCliente) continue;
    const t = String(m.time || "").match(/^(\d{1,2}):/);
    if (!t) continue;
    const h = Number(t[1]);
    if (h >= 0 && h <= 23) horas.push(h);
  }
  if (horas.length < 4) return ""; // poucos dados, não arrisca
  const cont = new Array(24).fill(0);
  for (const h of horas) cont[h]++;
  // Acha o pico e expande pra uma janela de ~3h em volta dele
  let pico = 0;
  for (let h = 0; h < 24; h++) if (cont[h] > cont[pico]) pico = h;
  let ini = pico, fim = pico;
  // expande pra incluir horas vizinhas com pelo menos 40% do pico
  const limite = Math.max(1, cont[pico] * 0.4);
  while (ini - 1 >= 0 && cont[ini - 1] >= limite) ini--;
  while (fim + 1 <= 23 && cont[fim + 1] >= limite) fim++;
  if (fim === ini) fim = Math.min(23, ini + 1); // garante uma faixa de ao menos 1h
  const fmt = (h) => String(h).padStart(2, "0") + "h";
  return `${fmt(ini)}-${fmt(fim)}`;
}

// Resume um atendimento (texto longo ditado pelo corretor) em 1-2 frases pra guardar nas observações.
export async function resumirAtendimento(texto, openai) {
  const limpo = String(texto || "").trim();
  if (!limpo) return "";
  if (!openai) return limpo.slice(0, 280); // sem IA, guarda um trecho
  try {
    const completion = await withRetries(() => openai.chat.completions.create({
      model: modeloTarefasSimples(),
      messages: [{
        role: "user",
        content: `Resuma em 1 ou 2 frases curtas, em português, o atendimento abaixo que um corretor registrou. Foque na SITUAÇÃO e no que importa pra venda (o que o cliente quer, objeções, próximos passos combinados). Não escreva na íntegra, não invente. Responda só o resumo, sem rótulos.\n\nAtendimento:\n${limpo.slice(0, 4000)}`
      }],
      temperature: 0.3
    }));
    return stripEmojis(completion.choices[0].message.content || "").trim() || limpo.slice(0, 280);
  } catch (_) {
    return limpo.slice(0, 280);
  }
}

// As mensagens são geradas numa segunda chamada dedicada (gpt-4.1), com base no diagnóstico.

function textoDaRespostaResponses(resp) {
  if (resp && typeof resp.output_text === "string" && resp.output_text.trim()) return resp.output_text.trim();
  const partes = [];
  for (const item of (resp?.output || [])) {
    for (const bloco of (item?.content || [])) {
      if (bloco?.type === "output_text" && bloco?.text) partes.push(bloco.text);
    }
  }
  return partes.join("\n").trim();
}

async function chamarGPT4Json({ openai, prompt, systemPrompt = "", maxOutputTokens = 4096, timeout = 25000, model: modeloOverride = null }) {
  const model = modeloOverride || modeloAnalise();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${model} não respondeu em ${timeout}ms`)), timeout);
  });
  try {
    const apiPromise = openai.chat.completions.create({
      model,
      messages: [
        ...(String(systemPrompt || "").trim() ? [{ role: "system", content: String(systemPrompt).trim() }] : []),
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: maxOutputTokens,
      response_format: { type: "json_object" }
    }, { signal: controller.signal, timeout });
    const completion = await Promise.race([apiPromise, timeoutPromise]);
    const texto = completion.choices[0]?.message?.content || "";
    if (!texto) throw new Error(`${model} não retornou texto.`);
    return { parsed: JSON.parse(_extrairJson(texto)), response: completion, rawText: texto };
  } finally {
    clearTimeout(timer);
    clearTimeout(timeoutId);
  }
}

async function corrigirMensagensPelasRegras({ openai, mensagens, contextoTemporal, timelineText, cerebroTexto, diagnostico, leadIA, motivosValidacao = [] }) {
  const modo = contextoTemporal?.modo || "sem-data";
  const diasTxt = contextoTemporal?.dias == null ? "não calculados" : String(contextoTemporal.dias);
  const sistema = `Você é o revisor final das mensagens comerciais do Corretor Pro. Sua única função é reescrever as três mensagens para que TODAS obedeçam às regras abaixo. Não altere fatos, não invente e não explique.

REGRAS OBRIGATÓRIAS:
- Obedeça integralmente às instruções do Cérebro.
- Cada mensagem deve continuar exatamente do ponto real da conversa.
- Cada mensagem deve terminar com UMA pergunta específica e útil.
- Não use linguagem passiva ou genérica como: "passando para saber", "fico à disposição", "só me chamar", "me avise quando", "se quiser", "pensar com carinho".
- Modo temporal: ${modo.toUpperCase()}. Dias desde a última mensagem: ${diasTxt}. Limiar de retomada: ${contextoTemporal?.limiar || 7} dias.
- Em RETOMADA, cada mensagem precisa tocar logo em um fato, condição, pendência, produto ou decisão concreta da conversa; não pode parecer mensagem enviada no mesmo dia e não pode reiniciar a venda.
- As três opções devem ter abordagens realmente diferentes.
- Responda somente JSON válido no formato {"mensagens":{"recomendada":"...","maisSuave":"...","maisDireta":"..."}}.`;
  const usuario = `INSTRUÇÕES DO CÉREBRO:
${cerebroTexto || "(vazio)"}

LEAD:
${JSON.stringify(leadIA || {})}

DIAGNÓSTICO JÁ EXTRAÍDO:
${JSON.stringify(diagnostico || {})}

MOTIVOS DETERMINÍSTICOS DA REPROVAÇÃO:
${(Array.isArray(motivosValidacao) ? motivosValidacao : []).join("\n") || "Não informado"}

MENSAGENS QUE FALHARAM NA VALIDAÇÃO:
${JSON.stringify(mensagens || {})}

TRECHO MAIS RECENTE DA CONVERSA:
${String(timelineText || "").slice(-16000)}`;
  const r = await chamarGPT4Json({
    openai,
    systemPrompt: sistema,
    prompt: usuario,
    model: modeloMensagens(),
    maxOutputTokens: 1100,
    timeout: Number(process.env.DIRECIONA_MESSAGE_REWRITE_TIMEOUT_MS || 18000)
  });
  const m = r?.parsed?.mensagens || r?.parsed || {};
  return {
    a: String(m.recomendada || m.a || "").trim(),
    b: String(m.maisSuave || m.b || "").trim(),
    c: String(m.maisDireta || m.c || "").trim(),
    completion: r.response
  };
}

// v724-2: regeneração antiga por segunda IA removida.


// v724-2: geração antiga de três mensagens removida.


export async function analyzeWithBrain({ lead, timeline, openai, leadId, forcarVariacao = false, contextoIncremental = null, cerebroConfig = null }) {
  const emptyMessages = { a: "", b: "", c: "", aLabel: "Reanalisar", bLabel: "Reanalisar", cLabel: "Reanalisar", recomendada: "a" };
  const nowIso = new Date().toISOString();
  const clean = (v, fallback = "") => String(v ?? fallback ?? "").replace(/\s+/g, " ").trim();
  const arr = (v) => Array.isArray(v) ? v.filter(Boolean).map(x => clean(x)).filter(Boolean) : [];
  const pickMsg = (obj, keys) => {
    for (const k of keys) {
      const v = clean(obj?.[k]);
      if (v) return v;
    }
    return "";
  };

  if (!openai) {
    return {
      mode: "sem_api",
      summary: "Conversa importada, mas a análise comercial está indisponível porque a API não está configurada.",
      clientProfile: "—",
      bestTime: "—",
      objections: [],
      risk: "—",
      produtoInteresse: null,
      produtosInteresse: [],
      etapaSugerida: null,
      nextAction: null,
      arquiteturaMensagens: ARQUITETURA_MENSAGENS_ATUAL,
      sugestoesPendentes: true,
      validacaoSugestoes: ["OpenAI não configurada"],
      messages: emptyMessages
    };
  }

  const linhaDe = (m) => `[${m?.date || ""} ${m?.time || ""}] ${m?.author || ""}: ${m?.text || ""}`;
  const timelineArr = Array.isArray(timeline) ? timeline : [];
  const timelineTextFull = timelineArr.map(linhaDe).join("\n");

  // Limite técnico para evitar travar a etapa de análise em conversas enormes.
  // Não injeta resumo antigo, produto antigo, unidade antiga ou nextAction antigo.
  const MAX_CHARS = Number(process.env.DIRECIONA_MAX_CONTEXT_CHARS || 30000);
  let timelineText = timelineTextFull;
  if (timelineText.length > MAX_CHARS) {
    const linhas = timelineArr.map(linhaDe);
    const recentes = [];
    let total = 0;
    for (let i = linhas.length - 1; i >= 0; i--) {
      total += linhas[i].length + 1;
      if (total > MAX_CHARS) break;
      recentes.unshift(linhas[i]);
    }
    timelineText = "[Conversa longa: parte antiga omitida apenas por limite técnico da importação. Use as mensagens abaixo como histórico recente, sem análise antiga.]\n" + recentes.join("\n");
  }

  const _agoraDt = new Date();
  // Data no fuso do corretor (Brasil) + dia da semana, pra IA julgar corretamente se um
  // intervalo é só um fim de semana ou uma demora real antes de reconhecer atraso.
  let hoje, hojeSemana = "";
  try {
    hoje = _agoraDt.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    hojeSemana = _agoraDt.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
  } catch (_) {
    hoje = _agoraDt.toISOString().slice(0, 10);
  }
  const configCerebro = await loadCerebroConfig(cerebroConfig).catch(() => null);
  // v827 §7.4: o nome do corretor vem SEMPRE da configuração do Cérebro ("Seu nome
  // como aparece no WhatsApp"). Sem nome fixo no código; na ausência, um rótulo genérico.
  const corretorNome = clean(configCerebro?.corretorNome || lead?.corretorNome || lead?.brokerName) || "o corretor";
  const leadIA = {
    nomeArquivo: clean(lead?.fileName || lead?.filename || lead?.txtFile).slice(0, 180),
    nomeContato: clean(lead?.clientName || lead?.name || lead?.nome).slice(0, 120),
    telefone: clean(lead?.phone || lead?.telefone).slice(0, 40)
  };

  const contextoTemporal = calcularContextoTemporalMensagens(timelineArr, configCerebro || {}, _agoraDt);
  const instrucoesCerebroTexto = formatCerebroPrompt(configCerebro) || "(vazio — analisar só a conversa)";
  const systemPromptAnalise = `Você é o motor comercial do Corretor Pro. As regras abaixo são obrigatórias e têm prioridade na geração das três mensagens.

- Obedeça integralmente ao Cérebro Comercial enviado pelo corretor.
- Gere três mensagens contextuais, diferentes e prontas para WhatsApp.
- TODAS devem terminar com uma pergunta específica.
- Não use frases genéricas/passivas: "passando para saber", "fico à disposição", "só me chamar", "me avise quando", "se quiser", "pensar com carinho".
- Data da última mensagem: ${contextoTemporal.ultimaData}. Dias corridos desde ela: ${contextoTemporal.dias == null ? "não identificados" : contextoTemporal.dias}.
- Limiar configurado para retomada: ${contextoTemporal.limiar} dias. Modo obrigatório: ${contextoTemporal.modo.toUpperCase()}.
- Em RETOMADA, toque imediatamente em um fato, condição, pendência, produto ou decisão concreta da conversa. Não reinicie a venda e não escreva como se o último contato tivesse ocorrido hoje.
- Não invente fatos.

CÉREBRO COMERCIAL:
${instrucoesCerebroTexto}`;

  // JEITO APRENDIDO — alimenta SOMENTE as 3 sugestões de mensagem com a voz real do corretor
  // e o que já funcionou (técnicas/objeções/produto×perfil que combinam com esta conversa).
  // Versão enxuta de propósito e escopada às mensagens: não altera o diagnóstico, que continua
  // saindo só da conversa. Falha aqui nunca derruba a análise.
  let jeitoAprendido = "";
  try {
    const iaAprend = await loadInteligenciaAprendida();
    if (iaAprend) jeitoAprendido = jeitoAprendidoCompacto({ inteligenciaAprendida: iaAprend }, timelineText);
  } catch (_) { jeitoAprendido = ""; }

  // Recuperação obrigatória de casos semelhantes já conduzidos pelo próprio corretor.
  // Diferente do tom genérico, estes casos carregam situação → ação real → resultado.
  let casosAprendidos = "";
  try { casosAprendidos = await casosSemelhantesPrompt(timelineText); } catch (_) { casosAprendidos = ""; }


  const prompt = `Você é um corretor de imóveis experiente lendo a própria conversa de WhatsApp antes de responder. Leia com atenção quem falou por último e o que já foi perguntado, oferecido e respondido, para não repetir nada nem "recomeçar" a conversa. A conversa pode ter meses de intervalo e mudar de produto no meio — leia do início ao fim, não só o trecho mais recente: um fato importante dito há tempo (ex.: cliente ofereceu um terreno/imóvel próprio como parte do pagamento, uma condição financeira, uma restrição) continua valendo até o cliente dizer o contrário, mesmo que a conversa tenha mudado de assunto depois. Gere um diagnóstico comercial e três sugestões de mensagem para o corretor enviar ao cliente, usando apenas a conversa e os metadados de identificação — sem análise antiga, produto salvo, unidade salva ou qualquer contexto externo. NÃO invente, presuma ou generalize nada que o cliente não tenha dito de fato: cada campo do diagnóstico só pode ser preenchido se houver uma frase real do cliente (ou do corretor) na conversa que sustente aquela afirmação — se não houver, escreva "Não identificado". Quando algo não estiver claro, escreva "Não identificado". Antes de escrever as três mensagens, calcule quantos dias corridos se passaram entre a data da ÚLTIMA mensagem da conversa e a Data atual informada abaixo, considerando também o dia da semana. Regra do tempo (siga à risca): (a) MENOS de ${contextoTemporal.limiar} dias corridos — e QUALQUER intervalo que seja apenas um fim de semana — é normal: NÃO peça desculpa, NÃO diga "desculpa a demora" nem "faz tempo que não nos falamos"; escreva como continuação natural do assunto, dando sequência normal. (b) A partir de ${contextoTemporal.limiar} dias parado, trate como RETOMADA: reabra a conversa de forma natural e específica — retome o último assunto/pendência e proponha o próximo passo — sem soar genérico. ATENÇÃO: retomar NÃO é pedir desculpa. Reconheça o tempo apenas de leve, e só peça desculpa se o corretor tinha prometido um retorno e realmente não cumpriu. (c) Se o corretor combinou retornar num dia específico e esse dia ainda NÃO chegou, ele está no prazo ou adiantado — jamais peça desculpa por demora nesse caso. Nunca invente um atraso que não existe. As mensagens também não podem soar como se tivessem sido escritas no mesmo dia da última quando já se passaram vários dias. Regra de adiamento pedido pelo cliente: se o cliente disse de forma explícita que quer ESPERAR ou adiar (ex.: "vou esperar uns meses", "me chama daqui a um tempo", "quando sair o inventário / a herança / a venda do meu imóvel", "agora não é o momento"), você NÃO deve pressionar por informações (faixa de valor, número de dormitórios, planta ou pronto) nem empurrar imóvel. Nesse caso, as três mensagens têm que RESPEITAR o tempo dele: reconhecer o que ele falou, se colocar à disposição e, no máximo, combinar um retorno leve mais pra frente (retomar quando ele estiver pronto) — trate a urgência como baixa. Retorne somente JSON válido, sem markdown.

Data atual: ${hoje}${hojeSemana ? ` (${hojeSemana})` : ""}
Corretor: ${corretorNome}
Lead: ${JSON.stringify(leadIA)}
Fonte do Cérebro: ${configCerebro?._fonte || "backend-default"}

INSTRUÇÕES DO CÉREBRO ATUAL:
${instrucoesCerebroTexto}
${jeitoAprendido ? `
${jeitoAprendido}

IMPORTANTE: use o bloco "SEU JEITO" acima APENAS para definir o tom, o vocabulário e a abordagem das TRÊS mensagens (campos "mensagens" e "mensagemQueEuEnviariaHoje"). NÃO use esse bloco para preencher os campos do diagnóstico — o diagnóstico continua saindo exclusivamente da conversa. Adapte ao contexto real desta conversa; nunca copie frases literais do bloco.
` : ""}
${casosAprendidos ? `
${casosAprendidos}

IMPORTANTE: quando um caso recuperado for semanticamente semelhante ao bloqueio atual, use obrigatoriamente a REGRA e a LÓGICA daquele caso para decidir a próxima ação e as três mensagens. Não transporte nenhum fato do caso antigo para este cliente. Se o caso estiver marcado como não funcionou, evite aquela condução. Os casos não podem alterar o diagnóstico factual da conversa atual.
` : ""}
JSON obrigatório:
{
  "summary":"resumo curto",
  "diagnostico":{
    "ultimaPessoaFalar":"Você|Cliente|Não identificado",
    "ultimoCompromissoCliente":"texto curto",
    "ultimaInformacaoPrometida":"texto curto",
    "compromissoCorretorNaoCumprido":"texto curto",
    "produtoPrincipal":"texto curto",
    "produtosParalelos":"texto curto",
    "objecaoPrincipal":"texto curto",
    "pendenciaFinanceira":"texto curto sobre PERMUTA — preencha apenas se o cliente tiver oferecido explicitamente, com as próprias palavras, um terreno/casa/apto próprio como parte do pagamento. Cite entre aspas o trecho literal do cliente que embasa isso, junto com os detalhes que ele deu (tamanho, bairro, valor). Não é sobre renda, crédito ou qualquer outra pendência financeira genérica. Se o cliente não disse isso literalmente em nenhum momento da conversa, escreva \"Não identificado\" — não infira a partir de contexto indireto",
    "quemDeveAgirAgora":"texto curto",
    "etapaFunil":"texto curto",
    "mensagemQueEuEnviariaHoje":"mensagem pronta"
  },
  "mensagens":{
    "recomendada":"mensagem pronta",
    "maisSuave":"mensagem pronta",
    "maisDireta":"mensagem pronta"
  },
  "produtoInteresse":"texto curto",
  "produtosInteresse":["texto curto"],
  "etapaSugerida":"texto curto",
  "clientProfile":"texto curto",
  "nextAction":"texto curto"
}

CONVERSA COMPLETA:
${timelineText}`;

  try {
    let parsedRaw, completion;
    try {
      const r = await chamarGPT4Json({
        openai,
        systemPrompt: systemPromptAnalise,
        prompt,
        model: modeloAnalise(),
        maxOutputTokens: Number(process.env.DIRECIONA_ANALYSIS_MAX_TOKENS || 2300),
        timeout: Number(process.env.DIRECIONA_ANALYSIS_TIMEOUT_MS || 26000)
      });
      parsedRaw = r.parsed; completion = r.response;
    } catch (primeiroErro) {
      // Segunda tentativa: contexto mais curto e modelo mais rápido, só como rede de
      // segurança após falha técnica (timeout/erro) da primeira tentativa com o modelo completo.
      const linhasRetry = timelineArr.map(linhaDe);
      const ultimas = linhasRetry.slice(-120).join("\n");
      const promptRetry = prompt.replace(timelineText, "[Tentativa curta após falha técnica. Últimas mensagens da conversa:]\n" + ultimas);
      try {
        const r2 = await chamarGPT4Json({
          openai,
          systemPrompt: systemPromptAnalise,
          prompt: promptRetry,
          model: modeloAnaliseRapida(),
          maxOutputTokens: 1800,
          timeout: Number(process.env.DIRECIONA_ANALYSIS_RETRY_TIMEOUT_MS || 22000)
        });
        parsedRaw = r2.parsed; completion = r2.response;
      } catch (segundoErro) {
        const e = new Error("Falha na análise IA. Primeira tentativa: " + describeOpenAIError(primeiroErro) + " | Segunda tentativa: " + describeOpenAIError(segundoErro));
        throw e;
      }
    }

    const raw = (parsedRaw && typeof parsedRaw === "object") ? parsedRaw : {};
    const d = (raw.diagnostico && typeof raw.diagnostico === "object") ? raw.diagnostico : {};
    const mensagensRaw = (raw.mensagens && typeof raw.mensagens === "object") ? raw.mensagens : {};
    let msgA = pickMsg(mensagensRaw, ["recomendada", "a", "opcao1", "opção1", "sugestao1", "sugestão1"]);
    let msgB = pickMsg(mensagensRaw, ["maisSuave", "suave", "b", "opcao2", "opção2", "sugestao2", "sugestão2"]);
    let msgC = pickMsg(mensagensRaw, ["maisDireta", "direta", "c", "opcao3", "opção3", "sugestao3", "sugestão3"]);
    let corrigidasDet = aplicarCorrecoesDeterministicasCerebro({ a: msgA, b: msgB, c: msgC }, configCerebro, new Date());
    msgA = corrigidasDet.a; msgB = corrigidasDet.b; msgC = corrigidasDet.c;
    let validacaoMensagens = validarMensagensCerebro({ a: msgA, b: msgB, c: msgC }, contextoTemporal, timelineArr, configCerebro, new Date());
    let mensagensCorrigidasPelaValidacao = false;
    let tentativasCorrecao = 0;
    while (!validacaoMensagens.ok && tentativasCorrecao < 2) {
      tentativasCorrecao++;
      try {
        const corrigidas = await corrigirMensagensPelasRegras({
          openai,
          mensagens: { a: msgA, b: msgB, c: msgC },
          contextoTemporal,
          timelineText,
          cerebroTexto: instrucoesCerebroTexto,
          diagnostico: d,
          leadIA,
          motivosValidacao: validacaoMensagens.motivos
        });
        corrigidasDet = aplicarCorrecoesDeterministicasCerebro(corrigidas, configCerebro, new Date());
        msgA = corrigidasDet.a; msgB = corrigidasDet.b; msgC = corrigidasDet.c;
        completion = corrigidas.completion || completion;
        validacaoMensagens = validarMensagensCerebro({ a: msgA, b: msgB, c: msgC }, contextoTemporal, timelineArr, configCerebro, new Date());
        mensagensCorrigidasPelaValidacao = true;
      } catch (e) {
        validacaoMensagens = {
          ok: false,
          motivos: [...(validacaoMensagens.motivos || []), `A correção automática das mensagens falhou: ${describeOpenAIError(e)}`]
        };
        break;
      }
    }
    const trioOk = [msgA, msgB, msgC].every(v => clean(v).length >= 10) && validacaoMensagens.ok;
    // v827 §7.1: o produto vem só do que a IA leu na conversa. Sem catálogo fixo para
    // "completar" — na ausência, fica "Não identificado" (cautela, não invenção).
    const produtoAtual = clean(raw.produtoInteresse || d.produtoPrincipal, "Não identificado");

    return {
      mode: "openai",
      summary: clean(raw.summary),
      diagnostico: {
        ultimaPessoaFalar: clean(d.ultimaPessoaFalar, "Não identificado"),
        ultimoCompromissoCliente: clean(d.ultimoCompromissoCliente, "Não identificado"),
        ultimaInformacaoEnviada: clean(d.ultimaInformacaoEnviada || d.ultimaInformacaoPrometida, "Não identificado"),
        ultimaInformacaoPrometida: clean(d.ultimaInformacaoPrometida || d.ultimaInformacaoEnviada, "Não identificado"),
        compromissoCorretorNaoCumprido: clean(d.compromissoCorretorNaoCumprido, "Não identificado"),
        produtoAtual,
        produtoPrincipalInteresse: produtoAtual,
        produtosParalelos: clean(d.produtosParalelos, "Não identificado"),
        objecaoIdentificada: clean(d.objecaoIdentificada || d.objecaoPrincipal, "Não identificado"),
        objecaoPrincipal: clean(d.objecaoPrincipal || d.objecaoIdentificada, "Não identificado"),
        pendenciaPrincipal: clean(d.pendenciaPrincipal || d.pendenciaFinanceira, "Não identificado"),
        pendenciaFinanceira: clean(d.pendenciaFinanceira, "Não identificado"),
        quemDeveAgirAgora: clean(d.quemDeveAgirAgora, "Não identificado"),
        proximoPasso: clean(d.proximoPasso || d.quemDeveAgirAgora || raw.nextAction, "Não identificado"),
        proximoPassoDeQuem: clean(d.proximoPasso || d.quemDeveAgirAgora || raw.nextAction, "Não identificado"),
        etapaFunil: ajustarEtapaNegociacao(clean(d.etapaFunil || raw.etapaSugerida, "Não identificado"), timelineArr),
        mensagemQueEuEnviariaHoje: clean(msgA || d.mensagemQueEuEnviariaHoje),
        percepcaoTodaConversa: clean(raw.summary)
      },
      oQueFaltaDescobrir: arr(raw.oQueFaltaDescobrir),
      estrategiaMensagem: clean(raw.estrategiaMensagem),
      prioridadeLead: clean(raw.prioridadeLead),
      produtoInteresse: produtoAtual,
      produtosInteresse: arr(raw.produtosInteresse).length ? arr(raw.produtosInteresse) : (produtoAtual && produtoAtual !== "Não identificado" ? [produtoAtual] : []),
      etapaSugerida: ajustarEtapaNegociacao(clean(raw.etapaSugerida || d.etapaFunil, "Não identificado"), timelineArr),
      clientProfile: clean(raw.clientProfile),
      nextAction: clean(raw.nextAction || d.quemDeveAgirAgora || d.ultimoCompromissoCliente),
      messages: {
        a: msgA,
        b: msgB,
        c: msgC,
        aLabel: clean(mensagensRaw.aLabel, "Recomendada"),
        bLabel: clean(mensagensRaw.bLabel, "Alternativa"),
        cLabel: clean(mensagensRaw.cLabel, "Direta ao ponto"),
        recomendada: "a"
      },
      tipoContato: null,
      permuta: false,
      permutaResumo: "",
      bestTime: "",
      confirmedAppointments: [],
      objections: [],
      risk: "",
      concorrencia: null,
      tipoRetomada: null,
      memoriaSugerida: null,
      inteligenciaObservada: null,
      materiais: [],
      lembreteSugerido: null,
      leituraComercial: null,
      mudancas: [],
      modeloComercial: null,
      raciocinioComercial: null,
      estrategia: clean(raw.estrategiaMensagem),
      arquiteturaMensagens: ARQUITETURA_MENSAGENS_ATUAL,
      modeloMensagens: modeloAnalise(),
      _modelo: completion?.model || modeloAnalise(),
      _modeloMensagens: null,
      sugestoesPendentes: !trioOk,
      validacaoSugestoes: trioOk ? [] : (validacaoMensagens.motivos?.length ? validacaoMensagens.motivos : ["A IA não retornou 3 mensagens novas completas e válidas."]),
      mensagensValidadasEm: nowIso,
      mensagensCorrigidasPelaValidacao,
      tentativasCorrecaoMensagens: tentativasCorrecao,
      regrasObjetivasCerebro: validacaoMensagens.regrasObjetivas || null,
      contextoTemporalMensagens: contextoTemporal,
      _cerebroFonte: configCerebro?._fonte || "backend-default",
      _cerebroMetodoTeste: /TESTE-CEREBRO/i.test(String(configCerebro?.metodo || "")),
      melhorHorarioContato: calcularMelhorHorario(timelineArr, lead?.clientName)
    };
  } catch (error) {
    const detail = describeOpenAIError(error);
    return {
      mode: "erro_api",
      error: detail,
      summary: "Conversa importada, mas a análise comercial não pôde ser gerada agora.",
      clientProfile: "—",
      bestTime: "—",
      objections: [],
      risk: "—",
      produtoInteresse: null,
      produtosInteresse: [],
      etapaSugerida: null,
      nextAction: null,
      arquiteturaMensagens: ARQUITETURA_MENSAGENS_ATUAL,
      sugestoesPendentes: true,
      validacaoSugestoes: [detail],
      messages: emptyMessages
    };
  }
}

// Compara a análise ANTERIOR (do último atendimento) com a ATUAL (conversa
// reimportada) e diz o que aconteceu: o cliente respondeu? a abordagem
// sugerida funcionou? o que mudou? É o coração do Aprendizado por reimportação.
export async function compararEvolucao({ anterior, atual, novasMensagens, openai }) {
  if (!openai || !anterior) return null;
  const resumoAnterior = {
    data: anterior._registradaEm || anterior.registradaEm || null,
    tipoRetomada: anterior.tipoRetomada || null,
    nextAction: anterior.nextAction || null,
    mensagemSugerida: anterior.messages?.a || anterior.messages?.direta || anterior.messages?.b || anterior.messages?.consultiva || null,
    risco: anterior.risk || null
  };
  const resumoAtual = {
    tipoRetomada: atual.tipoRetomada || null,
    nextAction: atual.nextAction || null,
    risco: atual.risk || null
  };
  let trechoNovas = "(não foi possível isolar as mensagens novas — compare pelo estado geral)";
  if (Array.isArray(novasMensagens) && novasMensagens.length) {
    const linhas = novasMensagens.map(m => `[${m.date||""} ${m.time||""}] ${m.author}: ${m.text}`);
    const textoCompleto = linhas.join("\n");
    // Nenhuma mensagem é descartada. Quando o novo atendimento é grande demais para
    // uma única chamada, todos os trechos são lidos em blocos e resumidos antes da
    // comparação final. O limite é por tamanho técnico do bloco, nunca por quantidade.
    if (textoCompleto.length <= 60000) {
      trechoNovas = textoCompleto;
    } else {
      const blocos = [];
      let atual = [], tamanho = 0;
      for (const linha of linhas) {
        const n = linha.length + 1;
        if (atual.length && tamanho + n > 28000) {
          blocos.push(atual.join("\n")); atual = []; tamanho = 0;
        }
        atual.push(linha); tamanho += n;
      }
      if (atual.length) blocos.push(atual.join("\n"));
      const resumos = [];
      for (let i = 0; i < blocos.length; i++) {
        try {
          const r = await withRetries(() => openai.chat.completions.create({
            model: modeloTarefasSimples(),
            messages: [{ role: "user", content: `Resuma factual e cronologicamente este bloco de mensagens novas de um atendimento imobiliário. Preserve compromissos, objeções, valores, perguntas, respostas e quem disse cada ponto. Não invente e não omita mudanças comerciais relevantes. Bloco ${i+1} de ${blocos.length}:\n\n${blocos[i]}` }],
            temperature: 0.1
          }));
          resumos.push(`BLOCO ${i+1}/${blocos.length}: ${r.choices?.[0]?.message?.content || blocos[i]}`);
        } catch (_) {
          // Falha no resumo não elimina o bloco: ele segue integralmente.
          resumos.push(`BLOCO ${i+1}/${blocos.length} (integral):\n${blocos[i]}`);
        }
      }
      trechoNovas = resumos.join("\n\n");
    }
  }
  const prompt = `Você é o Agente Aprendizado do Corretor Pro. O corretor reimportou a conversa deste lead ao fim de um novo atendimento. Compare a análise ANTERIOR com a situação ATUAL e diga, de forma honesta e baseada SÓ no que está escrito, o que aconteceu desde a última vez.

ANÁLISE ANTERIOR:
${JSON.stringify(resumoAnterior)}

ANÁLISE ATUAL:
${JSON.stringify(resumoAtual)}

MENSAGENS NOVAS DESDE A ÚLTIMA ANÁLISE (se houver):
${trechoNovas}

Retorne APENAS JSON válido com:
{
  "houveResposta": true/false (o cliente respondeu/interagiu desde a última análise?),
  "comoReagiu": "frase curta sobre como o cliente reagiu, ou 'sem resposta'",
  "abordagemFuncionou": "sim" | "parcial" | "nao" | "sem-dados" (a abordagem/ação sugerida antes deu resultado?),
  "evoluiu": "avancou" | "estagnou" | "esfriou" | "fechou" | "perdeu" (pra onde o negócio foi),
  "oQueMudou": "frase curta do que mudou no estado do lead",
  "licao": "lição prática pro corretor pra próximos casos parecidos (1 frase). Se não há dado suficiente, escreva 'sem lição clara ainda'."
}
Não invente. Se não há mensagens novas reais do cliente, houveResposta=false e abordagemFuncionou="sem-dados".`;
  try {
    const completion = await withRetries(() => openai.chat.completions.create({
      model: modeloTarefasSimples(),
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    }));
    const parsed = JSON.parse(completion.choices[0].message.content);
    parsed.comparadoEm = new Date().toISOString();
    return parsed;
  } catch (_) {
    return null;
  }
}

// Cliente OpenAI REAL (usado pra transcrição de áudio/Whisper e leitura de imagens/visão).
export function getOpenAIRaw() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === "colocar-depois") return null;
  const config = { apiKey: key };
  const baseURL = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE;
  if (baseURL) config.baseURL = baseURL.replace(/\/+$/, "");
  const organization = process.env.OPENAI_ORG_ID || process.env.OPENAI_ORGANIZATION;
  if (organization) config.organization = organization;
  const project = process.env.OPENAI_PROJECT_ID || process.env.OPENAI_PROJECT;
  if (project) config.project = project;
  return new OpenAI(config);
}

// Extrai o JSON puro de uma resposta (tira cercas ```json e texto em volta).
function _extrairJson(texto) {
  let t = String(texto || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const i1 = t.indexOf("{"), i2 = t.indexOf("[");
  let start = (i1 === -1) ? i2 : (i2 === -1 ? i1 : Math.min(i1, i2));
  if (start > 0) t = t.slice(start);
  const e1 = t.lastIndexOf("}"), e2 = t.lastIndexOf("]");
  const end = Math.max(e1, e2);
  if (end >= 0 && end < t.length - 1) t = t.slice(0, end + 1);
  return t;
}

export function getOpenAI() {
  // Um único provedor para texto, análise e mensagens: OpenAI.
  return getOpenAIRaw();
}

export function getOpenAIConfigSummary() {
  const key = process.env.OPENAI_API_KEY || "";
  const configured = !!(key && key !== "colocar-depois");
  return {
    configured,
    keyPrefix: configured ? key.slice(0, 7) : null,
    keyTail: configured ? key.slice(-4) : null,
    baseURL: process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || "https://api.openai.com/v1",
    organization: process.env.OPENAI_ORG_ID || process.env.OPENAI_ORGANIZATION || null,
    project: process.env.OPENAI_PROJECT_ID || process.env.OPENAI_PROJECT || null,
    transcriptionModel: modeloTranscricao(),
    analysisModel: modeloAnalise(),
    importAnalysisModel: modeloAnaliseRapida(),
    messagesModel: modeloMensagens(),
    visionModel: modeloVisao(),
    simpleModel: modeloTarefasSimples(),
    orchestratorModel: modeloOrquestrador()
  };
}


async function getDiasJanelaConfig() {
  // Lê config do Cérebro pra saber quantos dias da conversa considerar (default 45)
  try {
    const cfg = await loadCerebroConfig();
    const d = Number(cfg?.diasImportacao);
    if (Number.isFinite(d) && d > 0 && d <= 3650) return Math.round(d);
  } catch (_) {}
  return 90;
}

function filtrarMensagensRecentes(messages, dias) {
  if (!Array.isArray(messages) || !messages.length) return { filtered: messages, info: null };
  // Pega a data da mensagem mais recente. Se for inválida, fica com a maior ISO.
  let maxIso = "";
  for (const m of messages) {
    if (m.iso && m.iso > maxIso) maxIso = m.iso;
  }
  if (!maxIso || maxIso.startsWith("9999")) return { filtered: messages, info: { aplicado: false, motivo: "sem datas válidas" } };
  const maxTs = new Date(maxIso).getTime();
  if (!Number.isFinite(maxTs)) return { filtered: messages, info: { aplicado: false } };
  const cutoffTs = maxTs - (Number(dias) * 86400000);
  const filtered = messages.filter(m => {
    const t = m.iso ? new Date(m.iso).getTime() : 0;
    return t >= cutoffTs;
  });
  return {
    filtered,
    info: {
      aplicado: filtered.length !== messages.length,
      dias,
      totalOriginal: messages.length,
      totalFiltrado: filtered.length,
      janelaDe: new Date(cutoffTs).toISOString().slice(0, 10),
      janelaAte: new Date(maxTs).toISOString().slice(0, 10)
    }
  };
}


function normalizarDiasJanelaAudio(valor) {
  const raw = String(valor ?? "").trim().toLowerCase();
  if (!raw) return 90;
  if (/^(all|todo|tudo|todos|inteiro|completo|0|null)$/i.test(raw)) return null;
  const n = Number(raw);
  if ([30, 60, 90].includes(n)) return n;
  if (Number.isFinite(n) && n > 0 && n <= 3650) return Math.round(n);
  return 90;
}

function coletarAudiosReferenciados(messages, audioFiles) {
  const audioNamesNorm = audioFiles.map(normalizeName);
  const encontrados = new Set();
  for (const m of (messages || [])) {
    const ref = findReferencedAudio(m.text, audioNamesNorm);
    if (ref) encontrados.add(ref);
  }
  return encontrados;
}

function montarPlanoJanelaAudios(messagesAll, audioFiles, audioWindowDays) {
  const diasAudio = normalizarDiasJanelaAudio(audioWindowDays);
  const recorteAudio = diasAudio == null
    ? { filtered: messagesAll, info: { aplicado: false, tipo: "audio", todoPeriodo: true, historicoTextoCompleto: true, totalOriginal: messagesAll.length, totalFiltrado: messagesAll.length } }
    : filtrarMensagensRecentes(messagesAll, diasAudio);
  const mensagensAudio = Array.isArray(recorteAudio.filtered) ? recorteAudio.filtered : messagesAll;
  const refsTodas = coletarAudiosReferenciados(messagesAll, audioFiles);
  const refsJanela = coletarAudiosReferenciados(mensagensAudio, audioFiles);
  const foraDaJanela = [...refsTodas].filter(ref => !refsJanela.has(ref));
  const audioFilesTimeline = audioFiles.filter(audio => refsTodas.has(normalizeName(audio)));
  const audiosParaTranscrever = audioFiles.filter(audio => refsJanela.has(normalizeName(audio)));
  const info = recorteAudio.info || { aplicado: false };
  return {
    messages: messagesAll,
    audioFilesTimeline,
    audiosParaTranscrever,
    audioFilesForaDaJanela: foraDaJanela,
    janelaInfo: {
      ...info,
      tipo: "audio",
      dias: diasAudio,
      todoPeriodo: diasAudio == null,
      historicoTextoCompleto: true,
      totalMensagensAnalise: messagesAll.length,
      totalAudiosReferenciados: refsTodas.size,
      totalAudiosNoPeriodo: refsJanela.size,
      totalAudiosForaDoPeriodo: foraDaJanela.length
    }
  };
}

export async function processZipBuffer(buffer, options = {}) {
  const zip = await JSZip.loadAsync(buffer);
  const allNames = Object.keys(zip.files).filter(name => !zip.files[name].dir);
  const txtName = allNames.find(name => name.toLowerCase().endsWith(".txt"));
  const audioFiles = allNames.filter(name => AUDIO_EXT.test(name));
  const ignoredFiles = allNames.filter(name => IMAGE_EXT.test(name) || VIDEO_EXT.test(name) || DOC_EXT.test(name) || (!AUDIO_EXT.test(name) && !name.toLowerCase().endsWith(".txt")));

  if (!txtName) {
    const err = new Error("Não encontrei o arquivo .txt da conversa dentro do ZIP.");
    err.filesFound = allNames.slice(0, 80);
    throw err;
  }

  const txt = await zip.files[txtName].async("string");
  const messagesAll = parseWhatsappTxt(txt);

  // v725: o texto SEMPRE entra completo na análise. A janela limita somente quais áudios serão transcritos.
  const planoAudio = montarPlanoJanelaAudios(messagesAll, audioFiles, options.audioWindowDays ?? await getDiasJanelaConfig());
  const messages = planoAudio.messages;
  const audioFilesRelevantes = planoAudio.audioFilesTimeline;
  const audiosParaTranscrever = planoAudio.audiosParaTranscrever;
  const audioFilesForaDaJanela = planoAudio.audioFilesForaDaJanela;
  const filtroInfo = planoAudio.janelaInfo;

  const openai = getOpenAI();
  const { timeline, audioTranscriptions, transcriptionEnabled } = await buildTimeline({
    zip,
    messages,
    audioFiles: audioFilesRelevantes,
    audioFilesParaTranscrever: audiosParaTranscrever,
    audioFilesForaDaJanela,
    openai
  });
  const lead = guessLeadData(timeline);
  const analysis = await analyzeWithBrain({ lead, timeline, openai, cerebroConfig: options.cerebroConfig || null });
  const audioValues = Object.values(audioTranscriptions || {});
  const audiosTranscritos = audioValues.filter(item => String(item?.status || "").includes("transcrito") && item?.text).length;
  const audiosComErro = audioValues.filter(item => item?.status === "erro_transcricao").length;
  const primeiroErroAudio = audioValues.find(item => item?.status === "erro_transcricao")?.error || null;

  return {
    txtFile: txtName,
    rawText: txt,
    ignoredFilesCount: ignoredFiles.length,
    ignoredFiles: ignoredFiles.slice(0, 120).map(normalizeName),
    ignoredRule: "Imagens, vídeos, documentos, emojis e figurinhas não alimentam a análise. O Corretor Pro usa texto e áudios transcritos.",
    audioFiles: audioFilesRelevantes.map(normalizeName),
    audiosEncontrados: audioFilesRelevantes.length,
    audiosTotalNoZip: audioFiles.length,
    audiosDescartadosPorJanela: audioFilesForaDaJanela.length,
    audiosTranscritos,
    audiosComErro,
    primeiroErroAudio,
    transcriptionEnabled,
    audioTranscriptions,
    janelaConversa: filtroInfo,
    lead,
    timeline,
    analysis,
    metrics: {
      totalFiles: allNames.length,
      totalMessagesParsed: messages.length,
      totalMensagensOriginais: messagesAll.length,
      timelineItems: timeline.length,
      audioFiles: audioFilesRelevantes.length,
      audiosParaTranscrever: audiosParaTranscrever.length,
      audiosForaDoPeriodo: audioFilesForaDaJanela.length,
      audiosTranscritos,
      audiosComErro,
      ignoredFiles: ignoredFiles.length
    }
  };
}

// ========================================================================
// PROCESSAMENTO EM ETAPAS (pra conversas grandes não estourarem o limite de
// 10s do servidor). O front orquestra: prepara → transcreve em lotes → analisa.
// ========================================================================

// ETAPA 1 — Prepara: lê o ZIP, separa o TXT, preserva o histórico completo e lista
// os áudios que precisam de transcrição. Um recorte por dias só existe se ativado por env. Rápido,
// não chama OpenAI.
export async function prepararConversaDoZip(buffer, options = {}) {
  const zip = await JSZip.loadAsync(buffer);
  const allNames = Object.keys(zip.files).filter(name => !zip.files[name].dir);
  const txtName = allNames.find(name => name.toLowerCase().endsWith(".txt"));
  const audioFiles = allNames.filter(name => AUDIO_EXT.test(name));
  const ignoredFiles = allNames.filter(name => IMAGE_EXT.test(name) || VIDEO_EXT.test(name) || DOC_EXT.test(name) || (!AUDIO_EXT.test(name) && !name.toLowerCase().endsWith(".txt")));

  if (!txtName) {
    const err = new Error("Não encontrei o arquivo .txt da conversa dentro do ZIP.");
    err.filesFound = allNames.slice(0, 80);
    throw err;
  }

  const txt = await zip.files[txtName].async("string");
  const messagesAll = parseWhatsappTxt(txt);
  // v725: todas as mensagens escritas ficam na análise. A janela escolhida limita só transcrição de áudio.
  const planoAudio = montarPlanoJanelaAudios(messagesAll, audioFiles, options.audioWindowDays ?? await getDiasJanelaConfig());
  const messages = planoAudio.messages;
  const filtroInfo = planoAudio.janelaInfo;

  // "Sem mídia": quando o WhatsApp exporta SEM mídia, os áudios/imagens viram "<Mídia oculta>"
  // e NÃO vêm no zip. Contamos pra AVISAR o corretor — senão os áudios somem calados e a análise
  // fica incoerente. Se há mídia oculta E nenhum arquivo de áudio, foi exportado sem mídia.
  const midiasOcultas = (txt.match(/<[^>]*(oculta|omitida|omitido|ocultado|omitted|hidden)[^>]*>/gi) || []).length;
  const exportadoSemMidia = midiasOcultas > 0 && audioFiles.length === 0;

  const audioFilesRelevantes = planoAudio.audioFilesTimeline;
  const audiosParaTranscrever = planoAudio.audiosParaTranscrever;
  const audioFilesForaDaJanela = planoAudio.audioFilesForaDaJanela;
  const extractedFiles = {};
  if (options.includeExtractedFiles === true) {
    for (const fullName of audioFiles) {
      const entry = zip.files[fullName];
      if (!entry || entry.dir) continue;
      extractedFiles[normalizeName(fullName)] = await entry.async("nodebuffer");
    }
  }

  return {
    txtFile: txtName,
    messages,
    leadPreliminar: guessLeadData(messages),
    audioFilesRelevantes: audioFilesRelevantes.map(normalizeName),
    audiosParaTranscrever: audiosParaTranscrever.map(normalizeName),
    audioFilesForaDaJanela: audioFilesForaDaJanela.map(normalizeName),
    janelaConversa: filtroInfo,
    ignoredFilesCount: ignoredFiles.length,
    ignoredFiles: ignoredFiles.slice(0, 120).map(normalizeName),
    audiosTotalNoZip: audioFiles.length,
    audiosDescartadosPorJanela: audioFilesForaDaJanela.length,
    midiasOcultas,
    exportadoSemMidia,
    _extractedFiles: extractedFiles,
    metricsBase: {
      totalFiles: allNames.length,
      totalMensagensOriginais: messagesAll.length,
      totalMessagesParsed: messages.length,
      audiosParaTranscrever: audiosParaTranscrever.length,
      audiosForaDoPeriodo: audioFilesForaDaJanela.length,
      midiasOcultas,
      exportadoSemMidia
    }
  };
}

// ETAPA 2 — Transcreve um lote de áudios (chamada curta). Recebe o buffer do
// ZIP e a lista de nomes desse lote. Roda em paralelo, devolve as transcrições.
export async function transcreverLoteDoZip(buffer, audioNames) {
  const zip = await JSZip.loadAsync(buffer);
  const openai = getOpenAI();
  const cache = {};
  const resultado = {};
  if (!openai) {
    for (const nome of audioNames) resultado[normalizeName(nome)] = { status: "api_nao_configurada", text: "" };
    return { transcriptions: resultado, transcriptionEnabled: false };
  }
  // Acha o caminho completo dentro do ZIP a partir do nome base
  const allNames = Object.keys(zip.files).filter(name => !zip.files[name].dir);
  await Promise.all(audioNames.map(async (nomeBase) => {
    const base = normalizeName(nomeBase);
    const fullName = allNames.find(n => normalizeName(n) === base) || base;
    try {
      const r = await transcribeAudioOnce({ zip, audioName: fullName, openai, cache });
      resultado[base] = { status: r.status, text: r.text || "", error: r.error || null };
    } catch (error) {
      resultado[base] = { status: "erro_transcricao", text: "", error: describeOpenAIError(error) };
    }
  }));
  return { transcriptions: resultado, transcriptionEnabled: true };
}


export async function transcreverArquivosExtraidos(arquivos = []) {
  const openai = getOpenAI();
  const resultado = {};
  const entradas = Array.isArray(arquivos) ? arquivos : [];
  if (!openai) {
    for (const item of entradas) resultado[normalizeName(item?.name)] = { status: "api_nao_configurada", text: "" };
    return { transcriptions: resultado, transcriptionEnabled: false };
  }
  await Promise.all(entradas.map(async item => {
    const base = normalizeName(item?.name);
    const buffer = Buffer.isBuffer(item?.buffer) ? item.buffer : Buffer.from(item?.buffer || []);
    if (!base || !buffer.length) return;
    try {
      const text = await transcreverBuffer(buffer, path.extname(base) || ".ogg", openai);
      resultado[base] = { status: text ? "transcrito" : "audio_grande_ou_vazio", text: text || "" };
    } catch (error) {
      resultado[base] = { status: "erro_transcricao", text: "", error: describeOpenAIError(error) };
    }
  }));
  return { transcriptions: resultado, transcriptionEnabled: true };
}

// Monta a timeline a partir de mensagens já filtradas + transcrições já prontas
// (não chama OpenAI). transcriptionMap: { nomeBaseDoAudio: {status, text} }
function montarTimelineComTranscricoes(messages, audioFilesRelevantes, transcriptionMap, audioFilesForaDaJanela = []) {
  const audioNames = (audioFilesRelevantes || []).map(normalizeName);
  const foraDaJanela = new Set((audioFilesForaDaJanela || []).map(normalizeName));
  const timeline = [];
  const usedAudio = new Set();
  for (const msg of messages) {
    const audioRef = findReferencedAudio(msg.text, audioNames);
    if (audioRef) {
      usedAudio.add(audioRef);
      const t = transcriptionMap[audioRef] || {
        status: foraDaJanela.has(audioRef) ? "nao_transcrito_fora_do_periodo" : "sem_transcricao",
        text: ""
      };
      const textoAudio = t.text
        ? `[Áudio transcrito] ${t.text}`
        : (t.status === "nao_transcrito_fora_do_periodo"
          ? `[Áudio: ${audioRef} — não transcrito por estar fora do período escolhido]`
          : `[Áudio: ${audioRef} — ${t.status}]`);
      timeline.push({
        ...msg,
        type: "audio",
        mediaFile: audioRef,
        audioStatus: t.status,
        text: textoAudio,
        source: "audio"
      });
      continue;
    }
    timeline.push({ ...msg, type: msg.type || "text", text: stripEmojis(msg.text), source: "txt" });
  }
  timeline.sort((a, b) => String(a.iso).localeCompare(String(b.iso)) || Number(a.order || 0) - Number(b.order || 0));
  return timeline;
}

// Assinatura estável para descobrir o que realmente é novo numa reimportação.
// Áudios usam o nome do arquivo; textos usam data, hora, autor e conteúdo normalizado.
function assinaturaTimelineIncremental(m) {
  if (!m || typeof m !== "object") return "";
  if (m.mediaFile) return "audio|" + normalizeName(m.mediaFile);
  const txt = String(m.text || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 500);
  const sig = [String(m.date || "").trim(), String(m.time || "").trim(), String(m.author || "").trim().toLowerCase(), txt].join("|");
  return sig.replace(/\|/g, "") ? sig : "";
}

function mesclarTimelineIncremental(antiga, nova) {
  const out = [];
  const vistos = new Set();
  for (const m of [...(Array.isArray(antiga) ? antiga : []), ...(Array.isArray(nova) ? nova : [])]) {
    const k = assinaturaTimelineIncremental(m);
    if (k && vistos.has(k)) continue;
    if (k) vistos.add(k);
    out.push({ ...m });
  }
  out.sort((a, b) => String(a.iso || "").localeCompare(String(b.iso || "")) || Number(a.order || 0) - Number(b.order || 0));
  out.forEach((m, i) => { m.id = i + 1; m.order = i + 1; });
  return out;
}

function contextoAnteriorEnxuto(analysis) {
  const a = analysis && typeof analysis === "object" ? analysis : {};
  return {
    summary: a.summary || null,
    clientProfile: a.clientProfile || null,
    tipoContato: a.tipoContato || null,
    produtoInteresse: a.produtoInteresse || a?.lead?.product || null,
    produtosInteresse: Array.isArray(a.produtosInteresse) ? a.produtosInteresse : [],
    etapaSugerida: a.etapaSugerida || a?.lead?.etapa || null,
    diagnostico: a.diagnostico || null,
    memoria: a.memoria || a.memoriaSugerida || null,
    objections: Array.isArray(a.objections) ? a.objections : [],
    risk: a.risk || null,
    confirmedAppointments: Array.isArray(a.confirmedAppointments) ? a.confirmedAppointments : [],
    nextAction: a.nextAction || null,
    permuta: !!a.permuta,
    permutaResumo: a.permutaResumo || null,
    concorrencia: a.concorrencia || null
  };
}

function ehAnotacaoManualIncremental(m) {
  const source = String(m?.source || "");
  const type = String(m?.type || "");
  return source === "manual" || source === "crm" || type === "print-whatsapp" || ["atendimento", "nota", "ligacao", "visita", "presencial"].includes(type);
}

// ETAPA 3 — Analisa: recebe mensagens + transcrições prontas, monta a timeline e,
// quando é reimportação, usa só as novidades + contexto consolidado anterior.
export async function finalizarAnaliseDaConversa(payload) {
  const {
    txtFile, messages, audioFilesRelevantes, audioFilesForaDaJanela, transcriptionMap, janelaConversa,
    ignoredFilesCount, ignoredFiles, audiosTotalNoZip, audiosDescartadosPorJanela,
    metricsBase, existingTimeline, previousAnalysis, existingLeadId,
    audiosReaproveitados = 0, audiosNovosSolicitados = 0, cerebroConfig = null
  } = payload;

  const timelineDoArquivo = montarTimelineComTranscricoes(messages || [], audioFilesRelevantes || [], transcriptionMap || {}, audioFilesForaDaJanela || []);
  const timelineAntiga = Array.isArray(existingTimeline) ? existingTimeline : [];
  const reimportacao = !!(existingLeadId && timelineAntiga.length);
  const chavesAntigas = new Set(timelineAntiga.map(assinaturaTimelineIncremental).filter(Boolean));
  const mensagensNovas = reimportacao
    ? timelineDoArquivo.filter(m => { const k = assinaturaTimelineIncremental(m); return !k || !chavesAntigas.has(k); })
    : timelineDoArquivo;
  const timeline = reimportacao ? mesclarTimelineIncremental(timelineAntiga, timelineDoArquivo) : timelineDoArquivo;

  // rawText reconstruído da timeline final; o TXT completo não precisa trafegar de volta.
  const rawText = payload.rawText || timeline.map(m => `[${m.date || ""} ${m.time || ""}] ${m.author}: ${m.text}`).join("\n");
  const openai = getOpenAI();
  const lead = guessLeadData(timeline);

  let analysis;
  let analiseReutilizada = false;
  let itensContextoAnterior = 0;
  // v754: reimportação também é analisada a partir da conversa mesclada completa.
  // Não reutiliza análise antiga e não injeta resumo/nextAction/produto antigo.
  // A conversa é a única fonte de verdade para evitar contaminação entre contextos.
  if (reimportacao) itensContextoAnterior = Math.max(0, timeline.length - mensagensNovas.length);
  analysis = await analyzeWithBrain({ lead, timeline, openai, leadId: existingLeadId, cerebroConfig });

  const audioValues = Object.values(transcriptionMap || {});
  const audiosTranscritosNoArquivo = audioValues.filter(item => String(item?.status || "").includes("transcrito") && item?.text).length;
  const audiosComErro = audioValues.filter(item => item?.status === "erro_transcricao").length;
  const primeiroErroAudio = audioValues.find(item => item?.status === "erro_transcricao")?.error || null;
  const audiosTranscritosTotal = timeline.filter(m => m?.mediaFile && /^\[Áudio transcrito\]/i.test(String(m?.text || ""))).length;
  // Em reimportações, o navegador não precisa receber outra vez o histórico antigo inteiro.
  // O endpoint de atualização já o possui no banco e mescla apenas estas novidades.
  const timelineParaCliente = reimportacao ? mensagensNovas : timeline;
  const rawTextParaCliente = reimportacao
    ? mensagensNovas.map(m => `[${m.date || ""} ${m.time || ""}] ${m.author}: ${m.text}`).join("\n")
    : rawText;
  const transcricoesParaCliente = reimportacao
    ? Object.fromEntries(Object.entries(transcriptionMap || {}).filter(([, item]) => !item?.reused))
    : (transcriptionMap || {});

  return {
    txtFile,
    rawText: rawTextParaCliente,
    ignoredFilesCount: ignoredFilesCount || 0,
    ignoredFiles: ignoredFiles || [],
    ignoredRule: "Imagens, vídeos, documentos, emojis e figurinhas não alimentam a análise. O Corretor Pro usa texto e áudios transcritos.",
    audioFiles: (audioFilesRelevantes || []),
    audiosEncontrados: timeline.filter(m => m?.mediaFile).length,
    audiosTotalNoZip: audiosTotalNoZip || 0,
    audiosDescartadosPorJanela: audiosDescartadosPorJanela || (Array.isArray(audioFilesForaDaJanela) ? audioFilesForaDaJanela.length : 0),
    audiosTranscritos: audiosTranscritosTotal || audiosTranscritosNoArquivo,
    audiosComErro,
    primeiroErroAudio,
    transcriptionEnabled: !!openai,
    audioTranscriptions: transcricoesParaCliente,
    janelaConversa: janelaConversa || null,
    lead,
    timeline: timelineParaCliente,
    analysis,
    incrementalMeta: {
      reimportacao,
      existingLeadId: existingLeadId || null,
      mensagensNovas: mensagensNovas.length,
      audiosReaproveitados: Number(audiosReaproveitados) || 0,
      audiosNovosTranscritos: Number(audiosNovosSolicitados) || 0,
      analiseReutilizada,
      itensContextoAnterior,
      cobrancaOtimizada: reimportacao
    },
    metrics: {
      ...(metricsBase || {}),
      timelineItems: timeline.length,
      mensagensNovas: mensagensNovas.length,
      audioFiles: (audioFilesRelevantes || []).length,
      audiosTranscritos: audiosTranscritosTotal || audiosTranscritosNoArquivo,
      audiosReaproveitados: Number(audiosReaproveitados) || 0,
      audiosNovosTranscritos: Number(audiosNovosSolicitados) || 0,
      audiosComErro
    }
  };
}

