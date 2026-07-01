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

export const ARQUITETURA_MENSAGENS_ATUAL = "gpt55-unificado-v3-modelo-comercial";

function envModel(name, fallback) {
  const v = String(process.env[name] || "").trim();
  return v || fallback;
}

export function modeloTranscricao() {
  return envModel("OPENAI_TRANSCRIPTION_MODEL", MODELOS_PADRAO.transcricao);
}

export function modeloAnalise() {
  // Variável nova para evitar que um OPENAI_ANALYSIS_MODEL antigo (ex.: gpt-4o)
  // mantenha o deploy preso no modelo anterior sem o usuário perceber.
  return envModel("DIRECIONA_MAIN_MODEL", MODELOS_PADRAO.analise);
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

// Fonte ÚNICA dos termos proibidos nas mensagens. O validador (regex) E o aviso
// do prompt são montados a partir desta MESMA lista — se divergirem, o modelo
// usa uma palavra que o prompt nunca avisou, cai em "termo proibido" e a revisão
// repete o erro (a mensagem nunca gera). Mantemos só crutch de vendedor; palavras
// neutras e comuns ("papo", "trava"/"travando") saíram pra não reprovar msg boa.
const TERMOS_PROIBIDOS = [
  "faz sentido", "fez sentido", "travanco",
  "pressionar", "pressionando", "forçar", "forçando", "apertar", "apertando",
  "diagnosticar", "ponto final", "passando para saber",
  "fiquei pensando", "estive pensando",
  "caso não tenha agradado", "se não gostou"
];
const RE_TERMOS_PROIBIDOS = new RegExp(
  "\\b(" + TERMOS_PROIBIDOS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b",
  "i"
);

function mensagemTemTermoProibido(txt) {
  return RE_TERMOS_PROIBIDOS.test(String(txt || ""));
}

function mensagemTemEmoji(txt) {
  return /\p{Extended_Pictographic}/u.test(String(txt || ""));
}

function mensagemPerguntaEntradaRepetida(txt) {
  return /qual\s+valor.*entrada|faixa\s+de\s+entrada|investir\s+de\s+entrada|valor\s+.*investir\s+.*entrada|simula[cç][aã]o\s+mais\s+pr[oó]xima.*entrada/i.test(String(txt || ""));
}

// ---------------------------------------------------------------------------
// REGRAS ÚNICAS das mensagens comerciais — fonte única usada pelos prompts E
// pela validação, pra nunca divergirem. (Antes a regra de nº de perguntas estava
// escrita em 3 lugares com valores diferentes: prompt dizia 1, validador aceitava 2.)
const REGRAS_MSG = {
  maxPerguntas: 2,
  minChars: 35,
  maxChars: 520
};

// Bloco de regras injetado nos prompts de geração e de revisão (um texto só).
const REGRAS_MSG_PROMPT = [
  "- Use exclusivamente a conversa e o diagnóstico abaixo.",
  "- Não invente fato, proposta, valor, visita, produto ou objeção que não esteja na conversa.",
  "- Continue do ponto onde a conversa parou (pendência aberta e próxima ação do diagnóstico).",
  '- Se o contato for corretor parceiro, fale com ele como intermediador ("teu cliente", "cliente final"), nunca como comprador.',
  "- Não repita pergunta já respondida na conversa.",
  `- No máximo ${REGRAS_MSG.maxPerguntas} interrogações por mensagem (de preferência uma pergunta só).`,
  "- Não escreva só uma saudação.",
  `- PROIBIDO usar qualquer um destes termos batidos de vendedor (a presença de um já invalida a mensagem): ${TERMOS_PROIBIDOS.map(t => `"${t}"`).join(", ")}.`,
  "- PROIBIDO emoji ou símbolo especial (texto puro).",
  `- Cada mensagem: mínimo ${REGRAS_MSG.minChars} e máximo ${REGRAS_MSG.maxChars} caracteres.`,
  "- Mensagens distintas entre si (sem copiar trecho de uma pra outra)."
].join("\n");

// Limpeza determinística e SEGURA aplicada antes da validação: NÃO reescreve
// palavra nem muda o sentido — só remove emoji, espaços/quebras repetidos e
// símbolos invisíveis. Isso evita reprovar uma mensagem boa por um detalhe
// cosmético (ex.: um emoji), que antes resultava em tela vazia + "Reanalisar".
function limparMensagemComercial(txt) {
  return stripEmojis(String(txt || ""))
    .replace(/\s*\n\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}


function primeiraPalavraNome(lead) {
  const bruto = String(lead?.clientName || lead?.name || "").replace(/<[^>]+>/g, " ").trim();
  const limpo = bruto
    .replace(/\b(corretor|corretora|imobili[áa]ria|im[oó]veis|creci|cliente|lead)\b.*$/i, "")
    .trim();
  return (limpo.split(/\s+/)[0] || "Contato").trim();
}

function mensagemFormatoRuim(txt) {
  const s = String(txt || "").trim();
  if (!s) return true;
  if (/^[,.;:!?\-–—]/.test(s)) return true;
  if (/^\W+$/.test(s)) return true;
  return false;
}

function validarMensagensComerciais({ mensagens, labels, lead, timelineText, parsed }) {
  const diag = parsed?.diagnostico && typeof parsed.diagnostico === "object" ? parsed.diagnostico : {};
  const leitura = parsed?.leituraComercial && typeof parsed.leituraComercial === "object" ? parsed.leituraComercial : {};
  const naoPerguntar = [
    ...(Array.isArray(diag.oQueNaoPerguntarNovamente) ? diag.oQueNaoPerguntarNovamente : []),
    ...(Array.isArray(leitura.oQueNaoPerguntarNovamente) ? leitura.oQueNaoPerguntarNovamente : [])
  ].join(" ").toLowerCase();
  const historico = String(timelineText || "").toLowerCase();
  const contatoParceiro = contatoPareceParceiro(lead, timelineText) || /parceir|corretor/.test(String(parsed?.tipoContato || "").toLowerCase());
  const jaTratouEntrada = /entrada/.test(historico) && (/(parcela|saldo|60x|96x|financi|valor|proposta|condi[cç][aã]o)/.test(historico) || /entrada/.test(naoPerguntar));
  const issues = [];
  const outMsgs = {};
  const outLabels = {};
  const vistos = new Map();
  for (const k of ["a", "b", "c"]) {
    const msg = limparMensagemComercial(mensagens?.[k]);
    const label = String(labels?.[k] || "").replace(/\s+/g, " ").trim();
    const norm = normalizarTextoComparacao(msg);
    if (!msg || msg.length < REGRAS_MSG.minChars) issues.push(`${k}: mensagem vazia/curta demais`);
    if (mensagemFormatoRuim(msg)) issues.push(`${k}: formato inválido`);
    if (mensagemSoSaudacao(msg)) issues.push(`${k}: saudação solta`);
    if (!label || label.length < 3 || label.length > 48) issues.push(`${k}: rótulo inválido`);
    if (/^(a|b|c|direta|consultiva|retomada|resposta|alternativa|próximo passo)$/i.test(label)) issues.push(`${k}: rótulo genérico`);
    if (mensagemTemTermoProibido(msg) || mensagemTemTermoProibido(label)) issues.push(`${k}: termo proibido`);
    if (mensagemTemEmoji(msg)) issues.push(`${k}: emoji não permitido`);
    if (msg.length > REGRAS_MSG.maxChars) issues.push(`${k}: longa demais para WhatsApp`);
    if ((jaTratouEntrada || /entrada/.test(naoPerguntar)) && mensagemPerguntaEntradaRepetida(msg)) issues.push(`${k}: pergunta entrada novamente`);
    if ((msg.match(/\?/g) || []).length > REGRAS_MSG.maxPerguntas) issues.push(`${k}: perguntas demais na mesma mensagem`);
    if (contatoParceiro && /\b(voc[eê]s|voc[eê]\s+pretende|voc[eê]\s+quer)\b/i.test(msg) && !/teu cliente|cliente final|seu cliente/i.test(msg)) issues.push(`${k}: trata corretor parceiro como comprador`);
    if (norm && vistos.has(norm)) issues.push(`${k}: duplicada de ${vistos.get(norm)}`);
    if (norm) vistos.set(norm, k);
    outMsgs[k] = msg;
    outLabels[k] = label;
  }
  return {
    ok: issues.length === 0,
    corrigido: false,
    issues,
    mensagens: outMsgs,
    labels: outLabels,
    recomendada: ["a", "b", "c"].includes(String(mensagens?.recomendada || "")) ? mensagens.recomendada : "a"
  };
}

export function __testarValidacaoMensagensComerciais(input = {}) {
  return validarMensagensComerciais(input);
}



function textoCurto(valor, fallback = "") {
  const s = String(valor || "").replace(/\s+/g, " ").trim();
  return s || fallback;
}

function normalizarDiagnosticoJessica(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const d = (parsed.diagnostico && typeof parsed.diagnostico === "object") ? parsed.diagnostico : {};
  const lc = (parsed.leituraComercial && typeof parsed.leituraComercial === "object") ? parsed.leituraComercial : {};
  const memoria = (parsed.memoriaSugerida && typeof parsed.memoriaSugerida === "object") ? parsed.memoriaSugerida : {};
  const interest = String(d.interesse || "").toLowerCase();
  const etapa = String(d.etapa || parsed.etapaSugerida || "").toLowerCase();
  const mapaEtapa = {
    descoberta: "Descoberta",
    interesse: "Interesse",
    comparacao: "Comparação",
    "analise-financeira": "Análise financeira / viabilidade",
    negociacao: "Negociação",
    decisao: "Decisão"
  };
  const quem = String(d.quemDeveProximoPasso || lc.quemDeveProximoPasso || "").toLowerCase();
  const quemTxt = quem === "cliente" ? "Do cliente" : quem === "corretor" ? "Do corretor" : quem === "ambos" ? "Dos dois" : "Não identificado";
  const objecoes = Array.isArray(parsed.objections) ? parsed.objections.map(x => typeof x === "string" ? x : (x?.text || x?.descricao || "")).filter(Boolean) : [];
  const prob = Number(parsed.probabilityPercent);
  const probTxt = Number.isFinite(prob) ? `${Math.max(0, Math.min(100, Math.round(prob)))}%` : textoCurto(parsed.probability || "Não identificado");
  parsed.diagnostico = {
    ...d,
    ultimaPessoaFalar: textoCurto(d.ultimaPessoaFalar || lc.ultimaPessoaFalar || "Não identificado"),
    ultimoCompromissoCliente: textoCurto(d.ultimoCompromissoCliente || d.ultimoCompromissoAssumidoCliente || "Nenhum compromisso assumido ou não identificado na conversa."),
    ultimaInformacaoPrometida: textoCurto(d.ultimaInformacaoPrometida || d.ultimaInfoPrometida || lc.ultimaInformacaoPrometida || "Nenhuma informação prometida ou não identificada."),
    produtoPrincipalInteresse: textoCurto(d.produtoPrincipalInteresse || parsed.produtoInteresse || "Não identificado"),
    produtosParalelosApresentados: Array.isArray(d.produtosParalelosApresentados) ? d.produtosParalelosApresentados : (Array.isArray(parsed.produtosInteresse) ? parsed.produtosInteresse.filter(x => String(x||"").trim() && String(x||"").trim() !== String(parsed.produtoInteresse||"").trim()) : []),
    objecaoPrincipal: textoCurto(d.objecaoPrincipal || d.bloqueio || objecoes[0] || parsed.risk || "Não identificada."),
    pendenciaFinanceira: textoCurto(d.pendenciaFinanceira || memoria.faixaValor || memoria.pontosSensiveis || "Não identificada."),
    proximoPassoDeQuem: textoCurto(d.proximoPassoDeQuem || quemTxt),
    etapaFunil: textoCurto(d.etapaFunil || mapaEtapa[etapa] || parsed.etapaSugerida || "Não identificada"),
    nivelInteresse: textoCurto(d.nivelInteresse || (interest === "alto" ? "ALTO" : interest === "medio" ? "MÉDIO" : interest === "baixo" ? "BAIXO" : "Não identificado")),
    percepcaoTodaConversa: textoCurto(d.percepcaoTodaConversa || parsed.estrategia || parsed.summary || ""),
    mensagemQueEuEnviariaHoje: textoCurto(d.mensagemQueEuEnviariaHoje || ""),
    probabilidadeFechamentoHoje: textoCurto(d.probabilidadeFechamentoHoje || probTxt)
  };
  return parsed;
}

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
  if (contato && (autor.includes(contato) || contato.includes(autor))) return true;
  if (primeiroContato && autor.includes(primeiroContato)) return true;
  return null;
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
  const retorno = /retorno|retornar|respondo|responder|aviso|avisar|chamo|chamar|analiso|analisar|avalio|avaliar|converso|conversar|vejo|verificar/i;

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
        descricao: `O compromisso combinado venceu há ${Math.abs(diff)} dia(s). Retome usando exatamente essa pendência como gancho.`,
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
        descricao: `O retorno combinado está vencido há ${idadeDias} dia(s). Retome pela pendência, sem tratar como conversa encerrada.`,
        texto: t, data: ""
      };
    }
    const prazo = prazoEmDias(t);
    if (prazo) {
      return {
        status: prazo.dias === 0 ? "aguardando-resposta" : "aguardando-resposta",
        responsavel: "contato",
        urgencia: prazo.dias <= 1 ? "media" : "baixa",
        descricao: prazo.dias === 0 ? "Aguardar o retorno combinado para hoje." : `Aguardar o retorno combinado do contato em ${prazo.dias} dia(s).`,
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

function normalizarModeloComercial(parsed, lead, timeline, corretorNome) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const timelineText = (Array.isArray(timeline) ? timeline : []).map(m => `${m?.author || ""}: ${m?.text || ""}`).join("\n");
  const bruto = (parsed.modeloComercial && typeof parsed.modeloComercial === "object") ? parsed.modeloComercial : {};
  const parceiro = contatoPareceParceiro(lead, timelineText) || /parceir|corretor/.test(String(parsed.tipoContato || bruto?.contato?.tipo || "").toLowerCase());
  const ultimo = mcUltimaMensagemReal(timeline, lead, corretorNome);
  const linhasReais = (Array.isArray(timeline) ? timeline : []).filter(m => m && String(m.text || "").trim());
  const rePerdeuOutra = /\b(comprou|adquiriu|optou por|foi para)\b.{0,55}\b(outro|outra)\b|\bcomprou outro im[oó]vel\b|\bj[aá] comprou\b.{0,35}\b(apartamento|im[oó]vel|casa)\b/i;
  const reNovaOportunidade = /\b(novo cliente|nova cliente|outro cliente|outra cliente|nova oportunidade|novo comprador|agora tenho um cliente|estou com um cliente|apareceu um cliente)\b/i;
  let idxPerda = -1, idxNova = -1;
  linhasReais.forEach((m, i) => { const t = String(m.text || ""); if (rePerdeuOutra.test(t)) idxPerda = i; if (reNovaOportunidade.test(t)) idxNova = i; });
  const textoRecente = `${linhasReais.slice(-24).map(m => `${m.author || ""}: ${m.text || ""}`).join("\n")}\n${parsed.summary || ""}\n${parsed.nextAction || ""}`.toLowerCase();
  const aiMarcouPerda = String(bruto?.oportunidade?.resultado || "") === "comprou-outra-opcao" || String(bruto?.oportunidade?.status || "") === "perdida";
  const resumoMarcouPerda = rePerdeuOutra.test(String(parsed.summary || ""));
  const existeNovaDepois = idxNova >= 0 && idxNova > idxPerda;
  const comprouOutra = !existeNovaDepois && (aiMarcouPerda || idxPerda >= 0 || resumoMarcouPerda);
  const vendaConosco = /contrato assinado|assinou o contrato|comprovante de pagamento|venda confirmada/.test(textoRecente) && !comprouOutra;
  const condicoesIncompativeis = /condi[cç][oõ]es.{0,45}(n[aã]o encaix|inviabil|n[aã]o aceitou)|entrada.{0,35}(baixa|n[aã]o aceitou)|recus.{0,25}financi/.test(textoRecente);
  const encerramentoCordial = ultimo.falante === "contato" && /^(muito obrigado|obrigado|obrigada|um abra[cç]o|abra[cç]o|valeu|perfeito|certo)[.! ]*$/i.test(String(ultimo.mensagem?.text || "").trim());
  const ultimaPedeResposta = mcUltimaMensagemPedeResposta(ultimo);
  const compromissoAberto = mcCompromissoAberto(parsed, timeline, lead, corretorNome);

  let tipoContato = mcEnum(bruto?.contato?.tipo, MC_CONTATOS, parceiro ? "corretor-parceiro" : "comprador-direto");
  if (parceiro) tipoContato = "corretor-parceiro";

  let statusOpp = mcEnum(bruto?.oportunidade?.status, MC_OPORTUNIDADES, mcEnum(parsed?.diagnostico?.etapa || parsed.etapaSugerida, MC_OPORTUNIDADES, "descoberta"));
  let resultado = mcEnum(bruto?.oportunidade?.resultado, MC_RESULTADOS, "em-andamento");
  if (vendaConosco) { statusOpp = "ganha"; resultado = "venda-conosco"; }
  else if (comprouOutra) { statusOpp = "perdida"; resultado = "comprou-outra-opcao"; }
  else if (condicoesIncompativeis && ["ganha", "perdida"].includes(statusOpp) === false && /encerr|n[aã]o deu|n[aã]o avan[cç]|desist/.test(textoRecente)) {
    statusOpp = "perdida"; resultado = "condicoes-incompativeis";
  }

  let statusRel = mcEnum(bruto?.relacionamento?.status, MC_RELACIONAMENTOS, "ativo");
  if (parceiro && statusOpp === "perdida") statusRel = "aguardando-nova-oportunidade";
  if (!parceiro && statusOpp === "perdida" && statusRel === "ativo") statusRel = "pausado";
  if (statusOpp === "ganha" && parceiro) statusRel = "ativo";

  let statusAcao = mcEnum(bruto?.acao?.status, MC_ACOES, "responder-agora");
  let responsavel = mcEnum(bruto?.acao?.responsavel, MC_RESPONSAVEIS, "corretor");
  let urgencia = mcEnum(bruto?.acao?.urgencia, MC_URGENCIAS, statusAcao === "responder-agora" ? "alta" : "baixa");
  if (statusOpp === "ganha" || statusOpp === "perdida") {
    statusAcao = "sem-acao-urgente";
    responsavel = "ninguem";
    urgencia = "nenhuma";
  } else if (ultimaPedeResposta) {
    statusAcao = "responder-agora";
    responsavel = "corretor";
    urgencia = "alta";
  } else if (compromissoAberto) {
    statusAcao = compromissoAberto.status;
    responsavel = compromissoAberto.responsavel;
    urgencia = compromissoAberto.urgencia;
  } else if (encerramentoCordial) {
    statusAcao = "sem-acao-urgente";
    responsavel = "ninguem";
    urgencia = "nenhuma";
  } else if (ultimo.falante === "corretor" && statusAcao === "responder-agora") {
    statusAcao = "aguardando-resposta";
    responsavel = "contato";
    urgencia = "baixa";
  }

  let descricaoAcao = compromissoAberto && !["ganha", "perdida"].includes(statusOpp)
    ? compromissoAberto.descricao
    : mcTexto(bruto?.acao?.descricao || parsed.nextAction);
  if (statusAcao === "sem-acao-urgente") {
    if (parceiro && statusOpp === "perdida") descricaoAcao = "Nenhuma ação urgente. Mantenha a parceria ativa e registre uma nova oportunidade quando surgir outro cliente.";
    else if (statusOpp === "ganha") descricaoAcao = "Venda concluída. Siga apenas com o pós-venda e os compromissos já combinados.";
    else descricaoAcao = "Nenhuma ação urgente neste momento.";
  }

  const motivoOpp = mcTexto(bruto?.oportunidade?.motivo,
    resultado === "comprou-outra-opcao" ? "O comprador final adquiriu outro imóvel." :
    resultado === "condicoes-incompativeis" ? "As condições comerciais não se encaixaram para esta oportunidade." :
    resultado === "venda-conosco" ? "Venda confirmada conosco." : mcTexto(parsed.summary));
  const motivoRel = mcTexto(bruto?.relacionamento?.motivo,
    parceiro && statusOpp === "perdida" ? "O contato segue como parceiro e pode apresentar novos compradores." : mcTexto(parsed.clientProfile));

  parsed.modeloComercial = {
    versao: 671,
    contato: {
      id: mcTexto(bruto?.contato?.id || parsed?.contatoId),
      tipo: tipoContato,
      papel: mcTexto(bruto?.contato?.papel, parceiro ? "Corretor parceiro que intermedeia compradores" : "Contato principal da oportunidade"),
      compradorFinal: mcTexto(bruto?.contato?.compradorFinal || bruto?.oportunidade?.compradorFinal)
    },
    oportunidade: {
      id: mcTexto(bruto?.oportunidade?.id || parsed?.oportunidadeId),
      contatoId: mcTexto(bruto?.oportunidade?.contatoId || bruto?.contato?.id || parsed?.contatoId),
      origemOportunidadeId: mcTexto(bruto?.oportunidade?.origemOportunidadeId || parsed?.origemOportunidadeId),
      compradorFinal: mcTexto(bruto?.oportunidade?.compradorFinal || bruto?.contato?.compradorFinal),
      status: statusOpp,
      resultado,
      produto: mcTexto(bruto?.oportunidade?.produto || parsed.produtoInteresse || lead?.product, "Não identificado"),
      motivo: motivoOpp
    },
    relacionamento: {
      status: statusRel,
      potencial: mcTexto(bruto?.relacionamento?.potencial, parceiro ? "médio" : "não avaliado").toLowerCase(),
      motivo: motivoRel
    },
    acao: {
      status: statusAcao,
      responsavel,
      urgencia,
      descricao: descricaoAcao
    },
    contexto: {
      ultimaPessoaFalar: ultimo.falante,
      ultimaMensagem: mcTexto(ultimo.mensagem?.text),
      ultimoCompromisso: mcTexto(compromissoAberto?.texto || bruto?.contexto?.ultimoCompromisso || parsed?.diagnostico?.ultimoCompromissoCliente, "Nenhum compromisso identificado."),
      impedimentoPrincipal: mcTexto(bruto?.contexto?.impedimentoPrincipal || parsed?.diagnostico?.objecaoPrincipal || parsed.risk, "Não identificado.")
    }
  };

  parsed.tipoContato = parceiro ? "corretor-parceiro" : (parsed.tipoContato || tipoContato);
  parsed.nextAction = descricaoAcao;
  if (parsed.diagnostico && typeof parsed.diagnostico === "object") {
    parsed.diagnostico.ultimaPessoaFalar = ultimo.falante === "contato" ? "Contato/cliente" : ultimo.falante === "corretor" ? "Corretor/construtora" : "Não identificado";
    parsed.diagnostico.proximoPassoDeQuem = responsavel === "contato" ? "Do contato" : responsavel === "corretor" ? "Do corretor" : responsavel === "ambos" ? "Dos dois" : "De ninguém agora";
  }
  if (statusOpp === "perdida" || statusOpp === "ganha") {
    parsed.probabilityPercent = statusOpp === "ganha" ? 100 : 0;
    parsed.probability = statusOpp === "ganha" ? "100%" : "0%";
    parsed.tipoRetomada = statusAcao === "sem-acao-urgente" ? "stand-by" : parsed.tipoRetomada;
    if (parceiro) parsed.etapaSugerida = "Standby";
  }
  parsed._schemaComercial = 671;
  return parsed;
}

export function __testarModeloComercialV671({ parsed = {}, lead = {}, timeline = [], corretorNome = "Sanchai" } = {}) {
  return normalizarModeloComercial(JSON.parse(JSON.stringify(parsed || {})), lead, timeline, corretorNome);
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

export async function buildTimeline({ zip, messages, audioFiles, openai }) {
  const maxAudioTranscriptions = Number(process.env.MAX_AUDIO_TRANSCRIPTIONS || 40);
  const audioNames = audioFiles.map(normalizeName);
  const audioTranscriptions = {};
  const timeline = [];

  // 1) PARALELIZA TODAS AS TRANSCRIÇÕES EM LOTES.
  // O modelo antigo era sequencial (uma por vez) e estourava o limite de 10s.
  // Agora roda em batches de 5 simultâneas, ganhando 60-80% do tempo.
  const audiosReferenciados = [];
  for (const msg of messages) {
    const audioRef = findReferencedAudio(msg.text, audioNames);
    if (audioRef) {
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
      const transcription = audioTranscriptions[audioRef] || { status: openai ? "limite_transcricao" : "api_nao_configurada", text: "" };
      timeline.push({
        ...msg,
        type: "audio",
        mediaFile: audioRef,
        audioStatus: transcription.status,
        text: transcription.text ? `[Áudio transcrito] ${transcription.text}` : `[Áudio: ${audioRef} — ${transcription.status}]`,
        source: "audio"
      });
      continue;
    }
    timeline.push({ ...msg, type: msg.type || "text", text: stripEmojis(msg.text), source: "txt" });
  }

  // 3) Áudios soltos no ZIP que não estavam referenciados no TXT, transcreve também em paralelo
  const audiosSoltos = audioFiles.filter(a => !usedAudio.has(normalizeName(a)));
  const restanteOrcamento = Math.max(0, maxAudioTranscriptions - limitados.length);
  const soltosParaTranscrever = audiosSoltos.slice(0, restanteOrcamento);
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
  const products = ["Renaissance", "Evolutti", "Boulevard", "Terrenos", "Premium Office", "Quality", "Personalité", "Personalite", "Prime"];
  const found = products.find(p => normalizeComparable(fullText).includes(normalizeComparable(p)));
  if (!found) return "Não identificado";
  return found === "Personalite" ? "Personalité" : found;
}

function pickClientName(authors = []) {
  const businessHints = /(senger|construtora|corretor|imobiliaria|imobiliária|direciona|atendimento)/i;
  const productHints = /\b(renaissance|evolutti|boulevard|premium\s*office|quality|personalit[eé]|prime|terrenos?|nvri|nvr|eii|ii)\b/gi;
  const raw = authors.find(a => a && !businessHints.test(a)) || authors.find(Boolean) || "Cliente não identificado";
  // Tira sufixos de produto colados no nome (ex: "João Paulo Rodrigues Evolutti Quality")
  return String(raw).replace(productHints, "").replace(/\s+/g, " ").trim() || raw;
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

// Catálogo de fallback (usado se a leitura ao vivo da tabela falhar).
const CATALOGO_SENGER_FALLBACK = `CATÁLOGO SENGER — STATUS, PAGAMENTO E FAIXAS (use pra decidir VISITA, FORMA DE PAGAMENTO e "outras opções"):
- PRONTOS (pode sugerir visita ao decorado · FINANCIAMENTO BANCÁRIO): Quality (2-3 dorm, ~57-87m², ref. R$420k-580k), Prime (3 dorm/2 suítes 124m², ref. R$1,12mi), Personalité (3 suítes 172m², ref. R$1,26-1,45mi), Nova Vila Rica I e II (terrenos, ref. R$95k-305k).
- NA PLANTA / EM OBRA / LANÇAMENTO (NÃO sugerir visita ao decorado · PARCELAMENTO DIRETO · gatilho: quem compra agora escolhe melhores unidades/vagas): Renaissance (pré-lançamento — Carazinho; 2 suítes ~86m² ref. R$730k-800k, 3 suítes 158-258m² ref. R$1,45mi-1,59mi; parcelamento direto), Evolutti (entrega 2028, ref. R$680k-1,13mi), Boulevard (entrega 2028 — Ibirubá, ref. R$800k-1,44mi), Premium Office (comercial, entrega 2029, ref. R$470k-1,12mi), Nova Vila Rica III (terrenos, entrega 2027, 20% entrada + direto, ref. R$75k-120k).
As faixas são de REFERÊNCIA (preço exato muda — NÃO cite valor fechado sem ter certeza pela conversa). Ao oferecer "outras opções", escolha empreendimentos de FAIXAS e PRAZOS diferentes do que o cliente está vendo.`;

// Bloco fixo do Renaissance (pré-lançamento — não está na tabela data.js).
const RENAISSANCE_LINHA = "  • Renaissance (Carazinho — PRÉ-LANÇAMENTO/na planta): 2 suítes ~86m² (ref. R$730k–800k) e 3 suítes 158–258m² (ref. R$1,45mi–1,59mi); sala comercial térreo ~114m² (ref. R$1,14mi); 18 pavimentos; parcelamento direto.";

// DIFERENCIAIS PRA ENCANTAR — pontos REAIS de cada empreendimento (fornecidos pelo corretor),
// usados pra vender o SONHO nas mensagens. Cite só os do empreendimento que o cliente está vendo.
const DIFERENCIAIS_ENCANTAR = `DIFERENCIAIS PRA ENCANTAR (pontos REAIS de cada empreendimento — use pra vender o SONHO/estilo de vida nas mensagens; cite SOMENTE os diferenciais do empreendimento que o cliente está vendo e NUNCA atribua diferencial de um a outro; não invente o que não estiver aqui):
• RENAISSANCE (Carazinho/RS — pré-lançamento, alto padrão): conceito "Um novo ícone de alto padrão" — "morar no Renaissance é habitar uma obra de arte que respira contemporaneidade". 18 pavimentos, 11.810 m² de área construída, entrega prevista 2031, parcelamento direto com a construtora. ARQUITETURA QUE INSPIRA: marco arquitetônico em Carazinho, fachadas contemporâneas de linhas puras, brises em madeira, implantação que privilegia luz natural e VISTAS AMPLAS em cada unidade ("vista que transforma o cotidiano"). INTERIORES QUE ENCANTAM: pé-direito generoso (suítes superiores com PÉ-DIREITO DE 3 METROS), acabamentos em materiais nobres, plantas inteligentes que aproveitam cada m², generosas VARANDAS GOURMET, hall de entrada assinatura. LAZER COMPLETO de 568 m² ("seu refúgio particular de bem-estar, pra toda a família"): 2 PISCINAS (interna e externa), BEACH TENNIS, espaço gourmet & WINE BAR, salão de festas/salão gourmet, LOUNGE FIRE (lareira externa), PILATES studio, SAUNA, PLAYGROUND & área kids, paisagismo. Vantagem de comprar no pré-lançamento: personalizar a planta e escolher as melhores unidades, andares, vistas e vagas.
• BOULEVARD RESIDENCE (IBIRUBÁ/RS — Construtora Senger; NÃO é em Carazinho): conceito "onde morar é sinônimo de bem-estar". EXCLUSIVIDADE: apenas 40 unidades; condomínio exclusivo com lindo hall de entrada e 2 ELEVADORES; arquitetura no estilo NEOCLÁSSICO CONTEMPORÂNEO; padrão Senger de qualidade. LOCALIZAÇÃO (a melhor da cidade): Rua Getúlio Vargas, EM FRENTE À PRAÇA GENERAL OSÓRIO, no centro de Ibirubá — perto de tudo. LAZER (a melhor estrutura de lazer da cidade, concentrada no 3º pavimento): PISCINA, ESTAR DO FOGO, ESPAÇO FITNESS, PLAYGROUND, ESPAÇO PUB integrado à piscina (área gourmet, churrasqueira e jogos) e SALÃO DE FESTAS com ESPAÇO KIDS integrado. PLANTAS: 2 dormitórios com 1 ou 2 suítes (área privativa 91 a 93 m² — Tipo 1: 1 suíte 91 m²; Tipo 2: 2 suítes 93 m²) e 3 dormitórios com 3 SUÍTES (150 m² privativos — Tipos 3 e 4); living integrado sala+cozinha, ampla SACADA/ESPAÇO GOURMET com CHURRASQUEIRA e POSIÇÃO SOLAR PRIVILEGIADA; as unidades de 3 suítes têm VISTA para a praça General Osório. ACABAMENTO padrão Senger: piso PORCELANATO de qualidade superior, FORRO EM GESSO em todo o apartamento, MEDIÇÃO INDIVIDUAL de gás, água e luz.`;

// Devolve SÓ os diferenciais dos empreendimentos REALMENTE mencionados na conversa.
// Evita a IA inventar/empurrar um empreendimento que ninguém citou (ex.: Boulevard).
// Se nada foi citado, devolve "" (nenhuma munição de produto → o Cérebro qualifica).
function diferenciaisRelevantes(texto) {
  const t = String(texto || "").toLowerCase();
  const partes = DIFERENCIAIS_ENCANTAR.split(/\n(?=•\s)/);
  const cabecalho = partes[0];
  const manter = partes.slice(1).filter(b => {
    const m = b.match(/•\s*([A-Za-zÀ-ÿ]+)/);
    const nome = m ? m[1].toLowerCase() : "";
    return nome && t.includes(nome);
  });
  return manter.length ? (cabecalho + "\n" + manter.join("\n")) : "";
}

// Classifica o TIPO do produto (terreno/apartamento/comercial) a partir do catálogo, pra o
// gerador de mensagens NUNCA inventar (ex.: chamar loteamento de "apartamento", como já aconteceu).
function tipoDoProduto(catalogo, produto) {
  const fatos = fatosDoProduto(catalogo, produto).toLowerCase();
  if (!fatos) return "";
  if (/(terreno|loteamento|\blote\b)/.test(fatos)) return "LOTEAMENTO/terrenos (é TERRENO — nunca chame de apartamento)";
  if (/(comercial|\bsala|office)/.test(fatos)) return "salas comerciais";
  if (/(su[íi]te|dormit|\bdorm\b|apartament|\bapto)/.test(fatos)) return "apartamentos";
  return "";
}

// Puxa os FATOS REAIS do produto (o que é, cidade, entrega, condições, faixa) do catálogo, pra o
// gerador responder quem pede informação como um corretor que conhece o produto (não com elogio vazio).
function fatosDoProduto(catalogo, produto) {
  const nome = String(produto || "").trim();
  if (!nome || /identificad/i.test(nome)) return "";
  const texto = String(catalogo || "");
  const i = texto.toLowerCase().indexOf(nome.toLowerCase());
  if (i < 0) return "";
  let trecho = texto.slice(i).split("\n")[0];
  const mParen = trecho.match(/^[^(]*\([^)]*\)/);
  if (mParen && mParen[0].length < trecho.length && /terreno|su[íi]te|dorm|comercial|entrega|entrada/i.test(mParen[0])) {
    trecho = mParen[0];
  }
  return trecho.replace(/^[•\s]+/, "").replace(/\s{2,}/g, " ").trim().slice(0, 220);
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

// Extrai EMPREENDIMENTOS e META do source data.js sem executar código remoto.
// Percorre o texto char-a-char rastreando strings para não contar colchetes dentro de valores.
function parseSengerDataJs(code) {
  function extractValue(src, fromIdx, openCh, closeCh) {
    const start = src.indexOf(openCh, fromIdx);
    if (start < 0) return null;
    let depth = 0, inStr = false, strCh = '';
    for (let i = start; i < src.length; i++) {
      const c = src[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }
        if (c === strCh) inStr = false;
      } else if (c === '"' || c === "'") { inStr = true; strCh = c; }
      else if (c === openCh) { depth++; }
      else if (c === closeCh) { if (--depth === 0) return src.slice(start, i + 1); }
    }
    return null;
  }
  let emps = [], meta = {};
  const empM = /\bEMPREENDIMENTOS\s*=\s*\[/.exec(code);
  if (empM) { const raw = extractValue(code, empM.index, '[', ']'); if (raw) try { emps = JSON.parse(raw); } catch (_) {} }
  const metaM = /\bMETA\s*=\s*\{/.exec(code);
  if (metaM) { const raw = extractValue(code, metaM.index, '{', '}'); if (raw) try { meta = JSON.parse(raw); } catch (_) {} }
  return { EMPREENDIMENTOS: emps, META: meta };
}

let _catalogoSengerCache = { ts: 0, texto: null };
// Lê a tabela oficial da Senger AO VIVO (GitHub Pages) e monta um catálogo compacto
// pro Cérebro: status (pronto×planta), pagamento e faixas de valor. Cache 24h + fallback.
async function loadCatalogoSenger() {
  const TTL = 24 * 60 * 60 * 1000;
  if (_catalogoSengerCache.texto && (Date.now() - _catalogoSengerCache.ts) < TTL) return _catalogoSengerCache.texto;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch("https://raw.githubusercontent.com/direcionacorretor/tabelasenger/main/data.js", { signal: ctrl.signal });
    clearTimeout(to);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const code = await resp.text();
    const SENGER = parseSengerDataJs(code);
    const emps = (SENGER && SENGER.EMPREENDIMENTOS) || [];
    if (!emps.length) throw new Error("sem empreendimentos");
    const faixaDe = (emp) => {
      const vals = [];
      const scan = (o, prof) => {
        if (!o || typeof o !== "object" || prof > 5) return;
        for (const k of Object.keys(o)) {
          const v = o[k];
          if (Array.isArray(v)) v.forEach(x => scan(x, prof + 1));
          else if (v && typeof v === "object") scan(v, prof + 1);
          else if (/valor|pre[cç]o|price/i.test(k)) {
            // Formato BR "R$ 1.450.000,00": tira pontos (milhar), vírgula = decimal.
            let t = String(v).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
            const n = parseFloat(t);
            if (isFinite(n) && n >= 50000 && n <= 50000000) vals.push(n);
          }
        }
      };
      scan(emp, 0);
      if (!vals.length) return "";
      const fmt = (n) => n >= 1000000 ? "R$" + (n / 1000000).toFixed(2).replace(".", ",") + "mi" : "R$" + Math.round(n / 1000) + "k";
      const min = Math.min(...vals), max = Math.max(...vals);
      return min === max ? `ref. ${fmt(min)}` : `ref. ${fmt(min)}–${fmt(max)}`;
    };
    const ehPronto = (e) => /pronto/i.test(String(e.status || "") + " " + String(e.statusLabel || ""));
    const linha = (e) => {
      const faixa = faixaDe(e);
      const entrega = e.entrega && !/pronto/i.test(e.entrega) ? ` · ${e.entrega}` : "";
      return `  • ${e.nome}${e.cidade ? ` (${e.cidade})` : ""} — ${e.statusLabel || e.status || ""}${entrega}${faixa ? ` · ${faixa}` : ""}`;
    };
    const prontos = emps.filter(ehPronto).map(linha);
    const planta = emps.filter(e => !ehPronto(e)).map(linha);
    const data = (SENGER.META && SENGER.META.dataTabela) || "";
    const texto = `CATÁLOGO SENGER AO VIVO (tabela ${data} — use pra decidir VISITA, FORMA DE PAGAMENTO e "outras opções"):
- PRONTOS (pode sugerir visita ao decorado · FINANCIAMENTO BANCÁRIO):
${prontos.join("\n")}
- NA PLANTA / EM OBRA / LANÇAMENTO (NÃO sugerir visita ao decorado · PARCELAMENTO DIRETO com a construtora · gatilho: quem compra agora escolhe as melhores unidades/andares/vistas e vagas de garagem):
${planta.join("\n")}
${RENAISSANCE_LINHA}
As faixas são de REFERÊNCIA (preço exato muda — NÃO cite valor fechado sem ter certeza pela conversa). Ao oferecer "outras opções", escolha empreendimentos de FAIXAS e PRAZOS diferentes do que o cliente está vendo.`;
    _catalogoSengerCache = { ts: Date.now(), texto };
    return texto;
  } catch (e) {
    console.warn("[direciona] catálogo Senger ao vivo falhou, usando fallback:", e?.message || e);
    return _catalogoSengerCache.texto || CATALOGO_SENGER_FALLBACK;
  }
}

async function loadCerebroConfig() {
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
    return data.valor;
  } catch (_) { return null; }
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
    const promptAtualizar = `Você mantém a base de conhecimento de um corretor de imóveis da Construtora Senger (Carazinho/RS).

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
- OBRA DE TERCEIROS: pede orçamento de construção/ampliação. Não é venda de imóvel; encaminhar engenharia/Cristian e acompanhar o orçamento.

2) QUALIFICAR antes de empurrar produto: morar ou investir? tipologia/dormitórios? faixa de valor? prazo (pronto x planta)? permuta (imóvel/carro) ou dinheiro/financiamento? Se o orçamento for menor que a faixa do produto pedido, redirecione pro que cabe (ex.: pede Renaissance mas orçamento menor → ofereça Quality/Evolutti).

3) ARGUMENTOS POR SITUAÇÃO (use o que casa com o sinal do cliente):
- Acha caro o pronto / não tem pressa / investidor → planta de lançamento: "compra na planta, congela o preço e valoriza até a entrega; quanto mais cedo no lançamento, mais barato e maior o prazo".
- Travado em pagamento → entrada + saldo direto com a construtora (safra pro produtor rural, aporte anual reduz parcela, aceita veículo na análise, correção só INCC sem juros), "ajustável pra ficar confortável".
- Quer dar imóvel na troca (permuta) → só vale imóvel LÍQUIDO e de MENOR valor que o comprado ("tem que virar dinheiro rápido"); não pegar bem que vale mais que o imóvel. Reenquadre: "entrada + financiamento, bota o imóvel à venda e quita quando vender — pega desconto e ainda vende o seu por mais depois".
- Investidor → comercial/renda: Premium Office (saúde não tem crise, aluguel alto); quer decidir depois (mora/aluga/revende): Renaissance. Reative indeciso com comparativo histórico real de valorização.
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
// Cérebro com os leads que JÁ estão no Direciona — sem reanalisar o lead inteiro. Prompt curto e
// focado, mesma forma que o campo inteligenciaObservada da análise. Retorna {} se não der pra extrair.
export async function extrairInteligenciaObservada(timelineText, openai) {
  if (!timelineText || timelineText.trim().length < 40) return {};
  // Lê até ~1.800 PALAVRAS — pega o essencial da conversa e mantém a chamada CURTA (3-5s), pra o
  // request voltar rápido e nunca pendurar/cair.
  const textoConversa = String(timelineText).split(/\s+/).slice(0, 1800).join(" ");
  const prompt = `Você vai LER E ENTENDER uma conversa INTEIRA de WhatsApp entre um CORRETOR da Construtora Senger (Carazinho/RS) e um cliente — TUDO que aconteceu: as PERGUNTAS, dúvidas e situações do CLIENTE e as RESPOSTAS e a condução do CORRETOR. Leia os dois lados, do começo ao fim, e entenda o que rolou.

Seu objetivo: aprender COMO O CORRETOR AGE em cada situação — qual era a situação/pergunta do cliente, o que o corretor respondeu/fez, e qual foi o resultado — pra o Direciona saber repetir isso em situações SEMELHANTES no futuro. Pense sempre em PARES: "quando o cliente faz/pergunta/objeta X → o corretor responde/conduz Y → deu resultado Z".

Use SÓ o que está LITERALMENTE na conversa (perguntas e respostas reais dos dois lados) — NÃO invente. Se houver QUALQUER troca real (cliente perguntou/disse algo e o corretor respondeu), capture pelo menos o "tom" e o que dá pra observar. Só retorne {} (vazio) se a conversa for SÓ um formulário automático / saudação solta, sem nenhum diálogo real.

Retorne SOMENTE este JSON:
{
  "tom": "1-2 frases do estilo de escrita do corretor (saudação, tamanho, formalidade, fechamento)",
  "tecnicas": ["até 4 condutas ESPECÍFICAS do corretor diante de uma situação do cliente, no padrão 'cliente fez/perguntou X → corretor respondeu/fez Y → cliente reagiu Z'. Inclua o que disparou a ação (a fala do cliente), não só a ação. PROIBIDO chavão ('ofereceu ajuda','explicou vantagens','fez perguntas'). Vazio se não houver nada concreto."],
  "objecoes": [{"objecao":"a dúvida/resistência REAL que o cliente levantou (preço, prazo, esposa, vender a casa antes, etc — com a fala dele)","respostaUsada":"como o corretor respondeu/conduziu","funcionou":true}],
  "produtoVsPerfil": [{"produto":"empreendimento oferecido","perfilCliente":"perfil curto do cliente (o que ele buscava/disse)","reacao":"como o cliente reagiu a esse produto"}],
  "movimentosQueAvancaram": ["situação + ação do corretor que destravou avanço, 'diante de X o corretor fez Y → cliente avançou'"],
  "movimentosQueTravaram": ["situação + ação do corretor que esfriou o lead"],
  "padroesFollowup": ["só se OBSERVÁVEL: depois de N dias de silêncio do cliente o corretor reaqueceu com Y E o cliente respondeu"]
}
Regras: pedido normal do cliente ('quero valores') NÃO é objeção, é interesse; 'vou pensar' vago sem resistência NÃO é objeção; objeção é resistência explícita a fechar. funcionou=true só se o cliente avançou de fato depois da resposta; false se sumiu/repetiu/esfriou. Frases curtas e acionáveis. Não copie os exemplos.

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

async function chamarGPT4Json({ openai, prompt, maxOutputTokens = 4096, timeout = 25000 }) {
  const model = modeloAnalise();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${model} não respondeu em ${timeout}ms`)), timeout);
  });
  try {
    const apiPromise = openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: maxOutputTokens
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

async function regenerarMensagensComModelo({ openai, lead, timelineText, parsed, issues }) {
  const nome = primeiraPalavraNome(lead) || "Contato";
  const contexto = {
    tipoContato: parsed?.tipoContato || null,
    diagnostico: parsed?.diagnostico || null,
    leituraComercial: parsed?.leituraComercial || null,
    modeloComercial: parsed?.modeloComercial || null,
    nextAction: parsed?.nextAction || null,
    produtoInteresse: parsed?.produtoInteresse || null,
    issues: issues || []
  };
  const prompt = `Você está revisando as 3 mensagens finais de WhatsApp de uma análise comercial já concluída. Corrija o que está apontado em PROBLEMAS, mantendo a estratégia.\n\nREGRAS OBRIGATÓRIAS:\n${REGRAS_MSG_PROMPT}\n- A opção A é a melhor mensagem para mandar agora.\n- Comece naturalmente pelo nome ${nome} quando isso melhorar a mensagem.\n\nPROBLEMAS ENCONTRADOS NAS MENSAGENS ANTERIORES:\n${(issues || []).join("; ")}\n\nDIAGNÓSTICO:\n${JSON.stringify(contexto)}\n\nCONVERSA COMPLETA:\n${timelineText}\n\nResponda SOMENTE JSON válido:\n{"messages":{"a":"...","b":"...","c":"...","aLabel":"...","bLabel":"...","cLabel":"...","recomendada":"a"}}`;
  const { parsed: corrigido, response } = await chamarGPT4Json({ openai, prompt, maxOutputTokens: 1500, timeout: 10000 });
  return { ...corrigido, _modelo: response?.model || modeloAnalise() };
}

async function gerarMensagensParaLead({ openai, lead, timelineText, parsed, corretorNome }) {
  const nome = primeiraPalavraNome(lead) || "Contato";
  const ctx = {
    tipoContato: parsed?.tipoContato || null,
    diagnostico: parsed?.diagnostico || null,
    leituraComercial: parsed?.leituraComercial || null,
    modeloComercial: parsed?.modeloComercial || null,
    nextAction: parsed?.nextAction || null,
    produtoInteresse: parsed?.produtoInteresse || null,
    tipoRetomada: parsed?.tipoRetomada || null,
    estrategia: parsed?.estrategia || null,
    etapaSugerida: parsed?.etapaSugerida || null,
    confirmedAppointments: parsed?.confirmedAppointments || [],
    objections: parsed?.objections || [],
    memoriaSugerida: parsed?.memoriaSugerida || null,
    lembreteSugerido: parsed?.lembreteSugerido || null,
    inteligenciaObservada: parsed?.inteligenciaObservada || null
  };
  const prompt = `Você é o Cérebro Comercial do Direciona. Com base no diagnóstico da conversa abaixo, gere 3 mensagens de WhatsApp DISTINTAS para o corretor ${corretorNome || "Sanchai"} enviar ao contato ${nome}.\n\nREGRAS OBRIGATÓRIAS (violação invalida a mensagem):\n${REGRAS_MSG_PROMPT}\n- Comece pelo primeiro nome ${nome} quando isso melhorar a mensagem.\n\nAS 3 MENSAGENS (cada uma com um propósito diferente):\n- a (direta): vai direto ao ponto e propõe o próximo passo concreto. É a melhor pra mandar agora.\n- b (consultiva): tira uma dúvida do cliente ou traz informação de valor; se perguntar, uma pergunta só.\n- c (retomada): reabre a conversa parada sem soar genérico.\n\nRÓTULOS (aLabel, bLabel, cLabel):\n- 3 a 5 palavras criativas e específicas pra esta conversa (ex.: "Reativação com prazo", "Resposta sobre financiamento").\n- PROIBIDO usar exatamente: "direta", "consultiva", "retomada", "a", "b", "c", "resposta", "alternativa" ou "próximo passo".\n\nDIAGNÓSTICO:\n${JSON.stringify(ctx)}\n\nCONVERSA:\n${timelineText}\n\nResponda SOMENTE JSON válido:\n{"messages":{"a":"...","b":"...","c":"...","aLabel":"...","bLabel":"...","cLabel":"...","recomendada":"a"}}`;
  const { parsed: resultado, response } = await chamarGPT4Json({ openai, prompt, maxOutputTokens: 1500, timeout: 20000 });
  // Aceita tanto {"messages":{...}} quanto estrutura plana {"a":"...","b":"...",...}
  const msgs = resultado?.messages || (resultado?.a ? resultado : {});
  return { messages: msgs, _modeloMensagens: response?.model || modeloAnalise() };
}

export async function analyzeWithBrain({ lead, timeline, openai, leadId, forcarVariacao = false, modeloMensagens, contextoIncremental = null }) {
  if (!openai) {
    return {
      mode: "sem_api",
      summary: "Conversa importada com sucesso, mas a análise comercial está indisponível.",
      clientProfile: "—",
      probability: "—",
      probabilityPercent: null,
      confianca: 0,
      bestTime: "—",
      objections: [],
      risk: "—",
      tipoContato: null,
      produtoInteresse: null,
      produtosInteresse: [],
      etapaSugerida: null,
      tipoRetomada: null,
      memoriaSugerida: null,
      permuta: false,
      permutaResumo: "",
      melhorHorarioContato: "",
      materiais: [],
      nextAction: "A análise ainda não foi configurada no servidor. Sem ela, o Direciona não consegue analisar a conversa nem gerar mensagens.",
      arquiteturaMensagens: ARQUITETURA_MENSAGENS_ATUAL,
      sugestoesPendentes: true,
      validacaoSugestoes: ["OpenAI não configurada"],
      messages: {
        a: "", b: "", c: "",
        aLabel: "Reanalisar", bLabel: "Reanalisar", cLabel: "Reanalisar", recomendada: "a"
      }
    };
  }
  // Texto completo da conversa — usado nas verificações que precisam do histórico inteiro.
  const linhaDe = (m) => `[${m.date || ""} ${m.time || ""}] ${m.author}: ${m.text}`;
  const ehAnotacaoManual = (m) => m && (m.source === "manual" || m.source === "crm");
  const timelineTextFull = timeline.map(linhaDe).join("\n");
  // Manda o HISTÓRICO INTEIRO pra IA reanalisar tudo. Limite alto só por segurança
  // (conversas absurdas). Mesmo quando corta a conversa antiga, as ANOTAÇÕES DO CORRETOR
  // (manuais/CRM) são SEMPRE mantidas — são fatos confirmados do que já aconteceu.
  const PROMPT_TL_MAX = 300000;
  let timelineText = timelineTextFull;
  if (timelineTextFull.length > PROMPT_TL_MAX) {
    const linhasManuais = timeline.filter(ehAnotacaoManual).map(linhaDe);
    const linhasConversa = timeline.filter(m => !ehAnotacaoManual(m)).map(linhaDe);
    const orcamento = Math.max(8000, PROMPT_TL_MAX - linhasManuais.join("\n").length - 200);
    const recentes = [];
    let total = 0;
    for (let i = linhasConversa.length - 1; i >= 0; i--) {
      total += linhasConversa[i].length + 1;
      if (total > orcamento) break;
      recentes.unshift(linhasConversa[i]);
    }
    const prefixo = recentes.length < linhasConversa.length ? "[...mensagens mais antigas omitidas por tamanho...]\n" : "";
    timelineText = prefixo + recentes.join("\n")
      + (linhasManuais.length ? "\n\nANOTAÇÕES DO CORRETOR (fatos confirmados — sempre considere TODAS):\n" + linhasManuais.join("\n") : "");
  }
  // Carrega tudo em paralelo — economiza 5-8s vs. sequencial antes da chamada ao modelo.
  const [cerebroConfig, catalogoSenger, conhecimentoCorretor, { memoria, aprendizado, evolucao }] = await Promise.all([
    loadCerebroConfig(),
    loadCatalogoSenger(),
    process.env.DIRECIONA_USAR_CONHECIMENTO_AUTO === "1" ? loadConhecimentoCorretor() : Promise.resolve(""),
    loadLeadMemoriaAprendizado(leadId)
  ]);
  const contextoClienteRanking = `${lead?.nome || ""}\n${timelineTextFull}`;
  const orientacoes = montarOrientacoes(cerebroConfig, contextoClienteRanking);
  const contextoLead = montarMemoriaEAprendizado(memoria, aprendizado, evolucao);
  // CÉREBRO ORQUESTRADO (Responses API + ferramentas) — DESLIGADO por padrão.
  // Só roda com CEREBRO_ORQUESTRADO="1". Aditivo e fail-safe: em qualquer erro fica
  // string vazia e o prompt segue idêntico ao de hoje (caminho atual intocado).
  let contextoOrquestrado = "";
  if (process.env.CEREBRO_ORQUESTRADO === "1") {
    try {
      const { montarContextoOrquestrado } = await import("./_cerebro-orquestrado.js");
      const ctxO = await montarContextoOrquestrado({ openai, leadId, timelineText: timelineTextFull, lead });
      if (ctxO && ctxO.bloco) contextoOrquestrado = "\n\n" + ctxO.bloco + "\n";
    } catch (e) {
      console.warn("[direciona] contexto orquestrado indisponível:", e?.message || e);
    }
  }
  // Sugestões antigas da própria IA não entram no novo prompt. Elas podem estar erradas
  // e contaminar a reanálise. Só fatos da conversa, memória confirmada e ações reais entram.
  const blocoComparacao = "";
  const hoje = new Date().toISOString().slice(0, 10);
  const corretorNome = String(cerebroConfig?.corretorNome || "").trim() || "Sanchai";
  const perspectiva = `\n\nQUEM É VOCÊ (perspectiva — REGRA CRÍTICA): O corretor da Senger, dono deste app, ${corretorNome ? `se chama "${corretorNome}"` : "é UM dos dois participantes da conversa (o que representa a Senger/construtora)"}. As mensagens enviadas por ${corretorNome ? `"${corretorNome}"` : "esse corretor"} na timeline são SUAS (do corretor) — NÃO são do lead. O LEAD/contato é a OUTRA pessoa da conversa. TODAS as mensagens sugeridas (a, b, c) devem ser escritas COMO VOCÊ (o corretor) FALANDO COM O LEAD: comece pelo PRIMEIRO NOME do lead/contato e NUNCA enderece a mensagem a ${corretorNome ? `"${corretorNome}"` : "você mesmo"}. O clientProfile e a memória descrevem o LEAD, nunca o corretor.\n`;
  const blocoIncremental = contextoIncremental ? `\n\nMODO DE REIMPORTAÇÃO INCREMENTAL — REGRA CRÍTICA:\n- O bloco CONTEXTO ANTERIOR CONSOLIDADO resume o histórico que já havia sido processado e salvo. Ele NÃO é uma nova mensagem e NÃO deve ser tratado como fala do cliente.\n- A TIMELINE enviada abaixo contém o trecho recente anterior necessário para continuidade e TODAS as mensagens inéditas identificadas nesta reimportação.\n- Preserve os fatos consolidados anteriores, exceto quando as mensagens novas os corrigirem ou superarem.\n- Dê prioridade máxima ao que mudou agora; não reinicie a descoberta nem repita perguntas já respondidas.\n\nCONTEXTO ANTERIOR CONSOLIDADO:\n${JSON.stringify(contextoIncremental)}\n` : "";
  const instrucaoHistorico = contextoIncremental
    ? "LEIA TODO O TRECHO INCREMENTAL em ordem cronológica e use também o CONTEXTO ANTERIOR CONSOLIDADO."
    : "LEIA O HISTÓRICO INTEIRO em ordem cronológica — considere TODAS as mensagens (antigas e recentes), nunca só a última: o cliente pode ter dito o perfil, a finalidade (morar/investir) ou quem decide em mensagens anteriores.";
  const prompt = `Você é o Cérebro Comercial do Direciona, um app pra corretores que trabalham na CONSTRUTORA (vendem apartamentos novos da Senger em Carazinho/RS). A timeline abaixo combina textos e áudios transcritos do WhatsApp. Imagens, emojis, vídeos e documentos foram ignorados. ${instrucaoHistorico} PESO DA ATENÇÃO: ~40% em RESPONDER a ÚLTIMA mensagem do contato, ~30% no estado de HOJE (etapa atual, o que está pendente/combinado), ~30% no HISTÓRICO inteiro (perfil, finalidade, o que já foi dito e feito). A última mensagem manda na resposta, mas sempre ancorada no histórico e no momento atual. REGRA DE PAPÉIS: quando o outro lado for corretor parceiro/intermediador (ex.: nome contém Corretor/Imóveis/Imobiliária, fala em comissão, "meu cliente", "cliente comprador", visita com corretora, etc.), ele NÃO é o comprador. Não classifique a intenção dele como moradia/investimento pessoal; avalie o CLIENTE FINAL dele. Mensagens devem ser B2B para o parceiro: "teu cliente", "cliente final", "como ele recebeu a proposta". Hoje é ${hoje}.${perspectiva}${blocoIncremental} Não use "estava retomando as conversas" nem retomada genérica. Não copie nem preserve sugestões antigas geradas pelo próprio sistema: reavalie do zero usando apenas os fatos do histórico e as regras confirmadas. Retorne apenas JSON válido com as chaves: summary, estrategia (string — ver regra), melhorPergunta (string — ver regra), clientProfile (string), tipoContato (string — ver regra), produtoInteresse (string — ver regra), produtosInteresse (array — ver regra), etapaSugerida (string — ver regra), probability, probabilityPercent (numero 0-100), confianca (numero 0-100), permuta (boolean — ver regra), permutaResumo (string — ver regra), bestTime, confirmedAppointments (array — ver regra), objections (array de strings curtas), risk, concorrencia (string — ver regra), diagnostico (objeto — ver regra), tipoRetomada (string — ver regra), memoriaSugerida (objeto — ver regra), nextAction (frase acionavel), inteligenciaObservada (objeto — ver regra), materiais (array — ver regra), lembreteSugerido (objeto ou null — ver regra), leituraComercial (objeto — ver regra), modeloComercial (objeto — ver regra), messages {a, b, c, aLabel, bLabel, cLabel, recomendada}.

REGRA pros campos aLabel/bLabel/cLabel/recomendada dentro de messages: crie um rótulo curto (3-5 palavras) que descreva a ABORDAGEM de cada mensagem no contexto desta conversa específica. Exemplos: "Reativação leve", "Com urgência real", "Âncora emocional", "Facilitar a conta", "Retomada após silêncio". O campo recomendada deve ser "a", "b" ou "c" indicando a opção mais estratégica para este momento da negociação.

REGRA pro leituraComercial: preencha um objeto curto para o corretor entender a conversa em 10 segundos: { "ondeParou": "último ponto comercial real, sem ruído", "quemDeveProximoPasso": "cliente|corretor|ambos", "temperatura": "quente|morno|frio", "oQueDestravar": "a trava ou lacuna comercial de agora", "mensagemCurtaChance": "qual movimento de mensagem tem mais chance de resposta" }. Seja direto, sem texto longo.

REGRA pro modeloComercial — ESTE É O ESTADO ÚNICO QUE COMANDA A TELA. Separe obrigatoriamente CONTATO, OPORTUNIDADE, RELACIONAMENTO e AÇÃO. Retorne:
{
  "contato": { "tipo": "comprador-direto|corretor-parceiro|intermediario|familiar|investidor|empresa|outro", "papel": "frase curta", "compradorFinal": "nome/descrição ou string vazia" },
  "oportunidade": { "status": "descoberta|interesse|comparacao|analise-financeira|negociacao|decisao|ganha|perdida|encerrada-sem-decisao", "resultado": "em-andamento|venda-conosco|comprou-outra-opcao|condicoes-incompativeis|desistiu|sem-resposta|oportunidade-futura|outro", "produto": "produto atual", "motivo": "fato curto que justifica" },
  "relacionamento": { "status": "ativo|aguardando-nova-oportunidade|contato-periodico|pausado|encerrado", "potencial": "alto|medio|baixo|nao-avaliado", "motivo": "frase curta" },
  "acao": { "status": "responder-agora|aguardando-resposta|compromisso-agendado|retomar|sem-acao-urgente", "responsavel": "corretor|contato|ambos|ninguem", "urgencia": "alta|media|baixa|nenhuma", "descricao": "ação objetiva" },
  "contexto": { "ultimaPessoaFalar": "corretor|contato|desconhecido", "ultimaMensagem": "resumo literal curto", "ultimoCompromisso": "compromisso real ou nenhum", "impedimentoPrincipal": "principal trava real" }
}
REGRAS DE COERÊNCIA INEGOCIÁVEIS:
- Contato e oportunidade NÃO são a mesma coisa. Um corretor parceiro pode continuar ativo mesmo quando a oportunidade do cliente final foi perdida.
- Se o comprador final comprou outro imóvel: oportunidade.status="perdida", resultado="comprou-outra-opcao". Se o contato é parceiro: relacionamento.status="aguardando-nova-oportunidade" e acao.status="sem-acao-urgente".
- Só use oportunidade.status="ganha" e resultado="venda-conosco" quando houver venda confirmada conosco.
- Oportunidade ganha/perdida não pode continuar como negociação.
- Se a última fala foi uma despedida cordial do contato e não há pergunta/pendência aberta, acao.status="sem-acao-urgente".
- Se o corretor falou por último e aguarda retorno, acao.status="aguardando-resposta", não "responder-agora".
- Se acao.status="sem-acao-urgente", não recomende nova mensagem de venda; a descrição deve orientar manter relação, pós-venda ou aguardar nova oportunidade.
- A última pessoa a falar deve ser conferida na ÚLTIMA mensagem real da timeline, nunca inferida pelo resumo.

REGRA CRÍTICA — PENDÊNCIA ABERTA ANTES DA OBJEÇÃO: antes de decidir nextAction, leituraComercial e messages, identifique a ÚLTIMA PENDÊNCIA COMERCIAL ABERTA. A próxima mensagem deve continuar exatamente desse ponto, não reiniciar descoberta.
Sequência obrigatória de raciocínio:
1. Onde a conversa parou comercialmente?
2. Quem ficou responsável pelo próximo passo?
3. O que já sabemos com segurança?
4. O que ainda falta saber AGORA?
5. O que NÃO deve ser perguntado novamente porque já foi respondido ou negociado?
Se a última mensagem do OUTRO LADO contiver sentido de "vou informar", "vou validar", "vou falar com ele/ela/o cliente", "vou consultar", "te aviso", "assim que eu tiver retorno", "vou apresentar", "vou tentar a evolução", classifique como AGUARDANDO RETORNO DE TERCEIRO/CLIENTE FINAL. Neste caso, a próxima ação correta é pedir retorno sobre a proposta/condição/material apresentado. É ERRO reiniciar descoberta financeira ou perguntar entrada/parcela de novo se isso já foi tratado no histórico.
Não use uma frase pronta de outro atendimento. A mensagem deve citar apenas o objeto real desta conversa e nunca voltar a perguntar uma condição já esclarecida.


MÉTODO FIXO PARA AS MENSAGENS — HIERARQUIA OBRIGATÓRIA:
1. Continue do último ponto comercial real; não recomece a descoberta.
2. Identifique quem deve o próximo passo e a pendência aberta antes de falar de objeção.
3. Não repita perguntas já respondidas nem crie objeções que o cliente não levantou.
4. Se o contato é corretor parceiro, escreva B2B e trate o comprador como cliente final dele.
5. Linguagem natural, direta e profissional; uma pergunta principal no máximo.
6. Sem emojis. Sem "faz sentido", "fiquei pensando", "estive pensando", "papo", "caso não tenha agradado" ou "se não gostou".
7. As três opções precisam ser diferentes e a opção A deve ser a melhor para enviar agora.
8. Antes de devolver o JSON, revise silenciosamente cada mensagem contra o histórico completo.

REGRA 0 — NÃO DEDUZA, CONFIRA NA CONVERSA (revise DUAS VEZES antes de orientar): é PROIBIDO afirmar característica do imóvel (tipologia/nº de suítes, metragem, valor), condição de pagamento, quem decide, ou o que já foi combinado, com base em palpite. Só afirme o que está REALMENTE escrito na conversa/anotações. NÃO invente, NÃO chute, NÃO deduza o que não foi dito. Atenção a um erro clássico: um número ou condição dito sobre UMA opção (ex.: a unidade de entrada mais barata) NÃO vale automaticamente pra OUTRA unidade que o cliente escolheu — confira a qual unidade/assunto cada dado se refere. Antes de fechar o JSON, releia mentalmente os trechos que embasam cada afirmação do summary, clientProfile e das 3 mensagens; se algum dado não tiver respaldo claro na conversa, NÃO o afirme como certo (omita ou trate como dúvida a confirmar). Errar uma orientação atrapalha a venda.

REGRA pro lembreteSugerido (REAGENDAMENTO PELA FALA DO CLIENTE): se o CLIENTE indicar QUANDO quer ser contatado de novo, devolva { "dias": <numero de dias a partir de hoje>, "motivo": <frase curta do porquê> }. Senão, null. Converta:
- "me chama amanhã" / "amanhã" → dias: 1
- "semana que vem" / "me chama daqui uns dias" → dias: 7 (uma semana = 7 dias)
- "daqui 15 dias", "em 2 semanas", "mês que vem", "em 60 dias" → converta pro número de dias certo (2 semanas=14, 1 mês=30, 2 meses=60).
- CONHECIMENTO REGIONAL (Carazinho/RS é região de plantio de grãos): se o cliente disser que está "COLHENDO", "na SAFRA", "na colheita", "plantando", "no plantio", "na lavoura agora" e pedir pra retomar depois → dias: 30 (a janela típica).
- "estou viajando, me chama quando voltar" sem prazo claro → dias: 7.
- DIA DO MÊS: se o cliente citar um DIA pra resolver/retomar (ex.: "recebo dia 20 e aí te falo", "dia 10 eu decido", "quando eu pegar o cheque, dia 20, converso com vocês"), calcule quantos dias de HOJE (${hoje}) até esse dia (se o dia já passou neste mês, vá pro próximo mês) e devolva em "dias". motivo = o que ele vai resolver (ex.: "receber o cheque dia 20").
- ESPERANDO ALGO/TERCEIRO: se o cliente está ESPERANDO receber dinheiro/cheque/pagamento, ou depende de um terceiro/decisão, pra ENTÃO falar com você, isso É um reagendamento — use a data que ele deu (ou ~15 dias se não houver data). motivo = "aguardando o cheque/pagamento pra avançar".
Quando houver lembreteSugerido, as MENSAGENS (principalmente a opção recomendada e a retomada contextual) devem ACEITAR o combinado com naturalidade, sem insistir: ex. amanhã → "perfeito, amanhã eu te chamo!"; viagem → "boa viagem! semana que vem eu retomo com você"; safra/colheita → "boa colheita! assim que terminar eu te procuro pra seguirmos"; esperando cheque → "perfeito, Cristiano! fico no aguardo do cheque; assim que entrar a gente acerta tudo". É PROIBIDO, nesses casos, mandar mensagem que EMPURRA ("vamos agilizar a compra?", "vamos confirmar o pagamento agora?") — o cliente PEDIU pra esperar. NUNCA force contato antes do prazo que o cliente pediu.

REGRA pra memoriaSugerida: extraia da conversa INTEIRA os fatos importantes sobre o cliente, pra montar a memória comercial dele. Retorne um objeto: { preferencias: "o que o cliente quer/gosta (andar, sol, metragem, lazer, etc) ou ''", pessoasDecisao: "quem participa da decisão (cônjuge, sócio, pais) ou ''", pontosSensiveis: "o que pesa contra/preocupa (preço, entrada, prazo, financiamento) ou ''", momentoDeVida: "casamento, mudança, investimento, primeiro imóvel, etc ou ''", faixaValor: "faixa de valor citada ou ''", observacoes: "outros fatos úteis pra próximas abordagens ou ''" }. Use SÓ o que está na conversa, não invente. Campo sem informação = string vazia.

REGRA pro concorrencia (string): se o cliente sinalizou que está vendo/avaliando OUTRO imóvel ou opção EM PARALELO (de outra construtora, outro corretor, ou outro empreendimento fora do que você oferece), descreva curto o que ele está olhando (ex.: "está vendo outro apartamento com outro corretor", "comparando com um usado no centro"). Só preencha se o cliente DISSE isso ("estamos vendo outro", "tô olhando uns aqui também", "tenho outra opção", "vou comparar"). Sem sinal de concorrência, retorne "".

REGRA pro diagnostico (objeto) — OBRIGATÓRIO seguir o mesmo modelo do diagnóstico manual aprovado pelo Sanchai. Além dos campos técnicos abaixo, inclua SEMPRE estes campos textuais, preenchidos com base no histórico inteiro e nas observações do corretor, sem inventar:
- "ultimaPessoaFalar": última pessoa que falou na conversa, identificando se foi cliente/contato, corretor/construtora ou corretor parceiro.
- "ultimoCompromissoCliente": último compromisso assumido pelo cliente. Se não houve, diga "Nenhum compromisso assumido.".
- "ultimaInformacaoPrometida": última informação que o corretor/construtora prometeu enviar, explicar ou verificar. Se não houve, diga "Nenhuma informação prometida.".
- "produtoPrincipalInteresse": produto/empreendimento principal em jogo agora.
- "produtosParalelosApresentados": array com produtos/opções paralelas apresentados ou discutidos.
- "objecaoPrincipal": objeção real que segura o avanço. Se não for preço, diga claramente qual é o verdadeiro gargalo, como viabilidade, prazo, decisão, documentação ou falta de orçamento.
- "pendenciaFinanceira": o que falta saber ou resolver sobre entrada, parcelas, renda, financiamento, parcelamento, FGTS ou orçamento. Se não houver, diga "Não identificada.".
- "proximoPassoDeQuem": "Do cliente", "Do corretor" ou "Dos dois", explicando em poucas palavras.
- "etapaFunil": uma destas etapas com linguagem humana: "Descoberta", "Interesse", "Comparação", "Análise financeira / viabilidade", "Negociação" ou "Decisão".
- "nivelInteresse": "ALTO", "MÉDIO" ou "BAIXO", com base em sinais reais.
- "percepcaoTodaConversa": bloco curto estilo "O que eu percebo analisando TODA a conversa". Deve dizer o erro que o corretor deve evitar e qual é o verdadeiro ponto para destravar.
- "mensagemQueEuEnviariaHoje": a melhor mensagem única para enviar hoje, pronta para WhatsApp, seguindo as regras de mensagem curta, continuidade e sem retomada genérica.
- "probabilidadeFechamentoHoje": nota ou percentual com justificativa curta. Não infle: explique o que ajuda e o que trava.

Depois desses campos, retorne também os campos técnicos de compatibilidade:
{ "objetivo": um destes EXATOS — "moradia" | "investimento" | "moradia-futura" | "construcao" | "troca" | "renda" | "especulacao" | "indefinido" (a INTENÇÃO principal da compra; só classifique diferente de "indefinido" se a conversa deixar claro — na dúvida "indefinido". NÃO assuma "moradia" só porque o imóvel é apartamento/casa: SEM o comprador dizer que é pra MORAR (ex.: "morar", "pra mim", "minha família", "minha esposa/marido/filhos", "sair do aluguel", "nossa casa"), fica "indefinido". Sinais de INVESTIDOR — "transferência de risco", parcelamento direto sem financiamento, aporte/safra/colheita, comprar pra revender/alugar, ou comprador trazido por OUTRO corretor/imobiliária (negócio B2B) sem intenção de moradia declarada — apontam "investimento" se explícitos, ou "indefinido" se não der pra cravar; NUNCA "moradia" por padrão), "motivo": "o MOTIVO REAL por trás da compra, se apareceu (casamento, filho chegando, sair do aluguel, mudança de cidade, segurança, aposentadoria, renda de aluguel) — é o que gera urgência; se não apareceu, ''", "interesse": "alto" | "medio" | "baixo" (o quanto o cliente demonstra QUERER fechar, pelos sinais reais: escolheu unidade específica, pediu condições/preço, elogiou/se empolgou, marcou ou REMARCOU visita, voltou em vários dias = ALTO; só perguntou genérico e sumiu = BAIXO), "quemDeveProximoPasso": "cliente" | "corretor" | "ambos" (de quem é a bola AGORA: se o CLIENTE disse que ia calcular/definir/avisar/decidir/falar com alguém e ainda não voltou = "cliente"; se o CORRETOR prometeu enviar/montar algo e ainda não enviou = "corretor"; se os dois = "ambos". REGRA: se o corretor JÁ cobrou/retomou depois do cliente sumir, a bola continua com o "cliente"), "bloqueio": "em poucas palavras, o que está REALMENTE segurando o avanço agora (ex.: agenda do casal, decisão de terceiro, percepção de preço, indecisão, esperando dinheiro) — ou '' se não há objeção, só o tempo passando", "etapa": "descoberta" | "interesse" | "comparacao" | "analise-financeira" | "negociacao" | "decisao" (em que ponto da negociação o cliente está), "sabemos": [lista curta do que JÁ está claro], "lacunas": [lista curta do que AINDA FALTA descobrir], "ultimaPendenciaAberta": "última pendência comercial real em uma frase curta; se alguém ficou de falar com cliente/direção/banco/família, diga exatamente isso", "statusPendencia": "sem-pendencia" | "aguardando-corretor" | "aguardando-cliente" | "aguardando-terceiro" | "aguardando-retorno-proposta", "oQueNaoPerguntarNovamente": [lista curta do que já foi respondido/negociado e NÃO deve virar pergunta repetida], "proximaAcaoCorreta": "movimento comercial objetivo para a próxima mensagem", "conversaSuperficial": true SOMENTE quando a conversa já é longa (≈8+ trocas reais de mensagem) E o OBJETIVO da compra (morar/investir) AINDA está DESCONHECIDO. Se o objetivo já está claro, OU houve visita/atendimento presencial registrado pelo corretor, é false (NÃO é superficial). Faltar só orçamento/forma de pagamento, com o objetivo já conhecido, NÃO é conversa superficial. }.
Pra montar "sabemos" e "lacunas", use SEMPRE esta lista fixa de 6 critérios críticos e jogue cada um num lado só (nunca nos dois), com rótulo de 1-3 palavras: "objetivo" (morar/investir), "motivo/urgência", "orçamento" (faixa de valor), "forma de pagamento" (FGTS/financiamento/recurso próprio/entrada), "prazo de compra", "quem decide". Um critério vai pra "sabemos" só se a conversa REALMENTE traz aquilo; senão vai pra "lacunas". Use SÓ o que está escrito, não invente. (A melhorPergunta deve atacar a PRINCIPAL lacuna desta lista.)

REGRA pro produtoInteresse: retorne só o NOME PRÓPRIO do imóvel/empreendimento em jogo AGORA. Lista oficial atualizada de empreendimentos da Senger (use EXATAMENTE estes nomes quando reconhecer):
- "Renaissance" (lançamento — Carazinho)
- "Quality" (pronto — Carazinho)
- "Prime" (pronto — Carazinho)
- "Personalité" (pronto — Carazinho)
- "Boulevard" (entrega 2028 — Ibirubá)
- "Premium Office" (entrega 2029 — Carazinho)
- "Nova Vila Rica I" (terrenos pronto — também aceita "NVR I", "NVRI", "Vila Rica I")
- "Nova Vila Rica II" (terrenos pronto — também "NVR II", "NVRII")
- "Nova Vila Rica III" (terrenos entrega 2027 — também "NVR III", "NVRIII")
- "Residencial GABRO" (Santa Maria — pode aparecer só como "Gabro")
- "Edifício Campos Elísios" (Carazinho — pode aparecer só como "Campos Elísios")
- "Evolutti" (entrega 2028 / na planta — Carazinho)
OU qualquer outro imóvel com nome próprio. Olhe MENSAGENS MAIS RECENTES e as OBSERVAÇÕES/atendimentos do corretor. NUNCA retorne uma DESCRIÇÃO de características no lugar do nome — "apartamento de 2 dormitórios", "casa com 2 box de garagem", "ap usado", "cobertura" etc. NÃO são nomes; se o imóvel só foi descrito por características e não tem nome próprio, retorne "Não identificado". Se vários nomes em paralelo, o de maior menção recente. SÓ "Não identificado" se nenhum NOME PRÓPRIO aparecer. EXCEÇÃO QUE PREVALECE: se o CORRETOR DECLARAR explicitamente o produto numa anotação/observação (ex.: "o produto é obra de terceiros", "obra de terceiros", "imóvel de terceiros", "imóvel usado", ou um empreendimento de outra construtora), USE EXATAMENTE o que ele declarou — a declaração do corretor é AUTORITATIVA e prevalece, mesmo não sendo da Senger nem nome próprio clássico. "Obra de terceiros" é um produto VÁLIDO, NUNCA "Não identificado" nesse caso. REGRA DURA: é PROIBIDO ESCOLHER/SUGERIR um empreendimento que o cliente ou o corretor NÃO mencionou na conversa/anotações. NUNCA infira um empreendimento a partir do perfil/objetivo do cliente (ex.: cliente diz que quer "investir" → NÃO escolha um empreendimento por conta própria). Isso vale também pro estrategia, summary, nextAction e as mensagens: não cite nome de empreendimento que não apareceu na conversa.

${catalogoSenger}${contextoOrquestrado}${conhecimentoCorretor ? "\n\nCONHECIMENTO DO CORRETOR (fatos reais aprendidos nas conversas — use sempre que relevante para responder com segurança, sem inventar):\n" + conhecimentoCorretor + "\n" : ""}

${diferenciaisRelevantes(timelineTextFull)}

REGRA — FORMA DE PAGAMENTO PELO STATUS (NÃO ERRE O TERMO): empreendimento PRONTO → o pagamento/simulação é por FINANCIAMENTO BANCÁRIO. Empreendimento NA PLANTA / EM OBRA / LANÇAMENTO / PRÉ-LANÇAMENTO (ex.: Renaissance, Evolutti, Boulevard, Nova Vila Rica III) → o pagamento é PARCELAMENTO DIRETO COM A CONSTRUTORA; é PROIBIDO usar a palavra "financiamento" pra esses. Ao propor simulação num empreendimento na planta, diga "simular o PARCELAMENTO / a condição de pagamento" (NUNCA "simulação de financiamento"). Use sempre o termo correto pelo status do empreendimento em jogo.

REGRA pro produtosInteresse: array com TODOS os imóveis/empreendimentos que ainda estão sendo considerados nesta negociação (da Senger ou não — ex.: ["Prime","Gabro"]). Inclua só os que seguem em jogo, do mais provável pro menos provável. Se só há um, retorne array com esse um. Se nenhum identificado, retorne [].

REGRA pra etapaSugerida: classifique em qual etapa do funil o cliente está, com base na conversa. Use EXATAMENTE um destes valores: "Novo" (primeiro contato, ainda sem real interação), "Atendimento" (já conversando, trocando informações, perguntou preço/condições — está avançando), "Visita/Proposta" (visita marcada/feita ou proposta em jogo), "Negociação" (negociando valores/condições pra fechar), "Standby" (parado/esfriou sem resposta há muito tempo). Olhe o VOLUME e o TEOR da conversa: se há bastante troca e o cliente já pediu preço/condições, NÃO é "Novo" — é no mínimo "Atendimento".

REGRA CRÍTICA pro tipoContato: identifique QUEM é o outro lado da conversa (a pessoa do contato, NÃO o corretor da construtora). Use EXATAMENTE uma destas strings em minúsculas:
- "cliente-final" → comprador direto, vai morar ou investir no imóvel.
- "corretora-parceira" → QUALQUER pessoa que INTERMEDIA / INDICA / TRAZ clientes pra construtora e ganharia COMISSÃO: corretor(a) de outra imobiliária, autônomo, OU um parceiro/profissional (arquiteto, engenheiro, projetista, designer, marketing, indicador) que MOSTRA/APRESENTA o empreendimento pra clientes/contatos DELE e coordena com a equipe da construtora. **PISTA DE NOME: contém "Corretor", "Corretora", "Corretagem", "Imóveis", "Imobiliária", "Vendas", "CRECI", ou nome de imobiliária.** **PISTA DE COMPORTAMENTO (vale MESMO quando o nome não indica nada):** diz "estou mostrando/apresentei o projeto pra [fulano]", cita NOMES de prospects/clientes dele, fala "meu cliente"/"meu comprador", pede tabela/material/plantas pra repassar, pergunta sobre comissão/parceria, OU PRODUZ/ENVIA o material do empreendimento pra construtora (plantas, projeto, PDFs, renders, folder) — quem FABRICA a planta/projeto e manda pro corretor da construtora NUNCA é o comprador. Se a pessoa traz clientes e/ou fornece o projeto, é PARCEIRA, não cliente-final.
- "indicacao" → pessoa que indicou alguém mas não é o comprador nem corretor parceiro.
- "outro" → não dá pra classificar.
ANTI-ERRO (CRÍTICO): NUNCA classifique como "cliente-final" quem APRESENTA o empreendimento a clientes/contatos dele, traz NOMES de prospects, ou PRODUZ/ENVIA o material do projeto (plantas, renders, PDFs, folder) pra construtora — isso é PARCEIRO (quer comissão). Pra parceiro, as mensagens e a próxima ação são B2B sobre os CLIENTES DELE (ex.: "teve retorno do seu cliente sobre o Renaissance?", "quer que eu monte a condição pra você fechar com ele?"); é PROIBIDO tratá-lo como comprador ou sugerir "enviar material/simulação" PRA ELE como se ele fosse comprar.
OVERRIDE: se a Memória do cliente tiver uma observação com formato "[tipo-contato:X]" (ex: "[tipo-contato:corretora-parceira]"), use OBRIGATORIAMENTE esse valor X — é uma marcação manual do corretor da construtora, mais autoritativa que sua inferência.

REGRA DAS 3 MENSAGENS: As mensagens DEVEM se adequar ao tipoContato:
- Se "cliente-final": tom consultivo, foco no imóvel/sonho/momento de vida, evita jargão técnico.
- Se "corretora-parceira": tom B2B, foco em disponibilidade de unidades, condições comerciais, material pra ela repassar, comissão/parceria, agilidade. Trate como colega de profissão, NÃO como cliente final. Evita frases como "esse imóvel combina com você" — a corretora não vai morar lá. ATENÇÃO CRÍTICA: cônjuge, família, filhos, "o marido", "a esposa", o casal e a decisão que aparecem na conversa são do CLIENTE FINAL DELA — NUNCA da parceira. É TERMINANTEMENTE PROIBIDO dizer "seu marido", "sua esposa", "sua família", "conversa com seu marido" pra parceira, como se ELA fosse a compradora. As mensagens perguntam sobre o CLIENTE DELA: "teve retorno do seu cliente?", "o que o casal achou?", "quando eles vêm fechar?", "consigo te ajudar a fechar com ele?". E NUNCA encerre com "estou à disposição".
- Se "indicacao" / "outro": tom neutro, identifique o real interessado antes de propor próximo passo.

REGRA CRÍTICA — A ANOTAÇÃO MAIS RECENTE DO CORRETOR MANDA (estado atual): se houver anotação manual / atendimento registrado pelo corretor (linhas marcadas como "Atendimento presencial (corretor)", "anotação manual", ou no resumo de observações), a MAIS RECENTE é o estado ATUAL e MAIS CONFIÁVEL do lead — vale MAIS que qualquer mensagem antiga de WhatsApp. As sugestões TÊM que refletir exatamente o que essa anotação diz. Ex.: anotação "ele ficou de visitar o prime decorado, ver se conseguiu e o que achou" → a mensagem indicada é "conseguiu visitar o decorado do Prime? O que achou?"; anotação "vai pensar e me retorna semana que vem" → retomada leve aguardando; anotação "pediu pra ligar sexta" → próxima ação é ligar sexta. NUNCA ignore a última anotação nem sugira algo que a contradiga.

REGRA CRÍTICA — CONTINUIDADE COM A ÚLTIMA MENSAGEM (a mais importante pra soar natural): TODAS as mensagens (principalmente RETOMADA e DIRETA) devem DAR SEGUIMENTO ao ponto EXATO onde a conversa parou. Antes de escrever, identifique a ÚLTIMA coisa relevante que aconteceu — primeiro a última ANOTAÇÃO do corretor (acima), e na falta dela a última coisa que o CORRETOR enviou/ofereceu e que ficou SEM resposta do cliente (último produto, material/folder, planta, valor/orçamento, link, lançamento, decorado a visitar). A retomada deve perguntar se o cliente CONSEGUIU VER/ANALISAR aquilo, O QUE ACHOU, se bateu com o ORÇAMENTO e se ficou alguma DÚVIDA — citando o produto/assunto PELO NOME. É TERMINANTEMENTE PROIBIDO fazer retomada genérica que ignora o que foi tratado por último, do tipo "como está a busca pelo apartamento?", "alguma novidade sobre o que estão pensando?", "como vai a procura?". A nextAction deve refletir essa continuidade: retomar especificamente o material, produto, proposta ou dúvida que ficou pendente, nunca propor algo do começo da conversa que já foi superado. Não copie exemplos de outros leads.

As 3 mensagens devem ser distintas entre si.


REGRA pro estrategia (campo NOVO — é o raciocínio de ESTRATEGISTA comercial pro CORRETOR ler, NÃO é mensagem pro cliente): em 1-2 linhas curtas e diretas, diga (a) EM QUE PÉ a venda está (temperatura/etapa real e o que segura o avanço), (b) o MOVIMENTO deliberado pra avançar AGORA e (c) a TÉCNICA comercial em jogo (ex.: ancoragem de valor, escassez/oportunidade de lançamento, prova social, fechamento por alternativa, reforço de valor/diferenciais, reciprocidade, redução de atrito). Linguagem de bastidor (gerente de vendas orientando o corretor), objetiva, sem ser mensagem pro cliente. Descreva a situação e o movimento usando somente os dados reais deste lead.


REGRA pro objections: objeção quase NUNCA aparece na frase literal (ninguém escreve "tá caro"). Detecte objeções IMPLÍCITAS pelo comportamento: cliente some depois de receber o valor (= preço/percepção de valor), responde "vou pensar"/"depois te falo"/"qualquer coisa te chamo" (= falta de urgência ou objeção não dita), "preciso ver com minha esposa/marido" (= decisão compartilhada/adiamento), faz muitas perguntas sobre financiamento/entrada e não avança (= barreira financeira), demora dias pra responder mensagens que antes respondia rápido (= esfriando/perdendo interesse), pede pra "segurar"/"esperar um pouco" (= momento ruim). Liste as objeções REAIS interpretadas, não frases que não foram ditas. NÃO INVENTE objeção: cliente dizer que vai "analisar no fim de semana", "ver com calma", "dar uma olhada", "depois eu vejo" é PRAZO NATURAL de decisão — NÃO é objeção de "tempo apertado/correria" nem urgência. Só liste objeção de tempo/pressa se o cliente DISSER EXPRESSAMENTE que está sem tempo/correndo. E a mensagem de "objecao" NUNCA pode AFIRMAR um sentimento que o cliente não expressou (ex.: "entendo que o tempo tá apertado") — só aborde objeções realmente ditas ou claramente sinalizadas; se não há objeção clara, a "objecao" deve só remover uma dúvida provável de forma leve, sem inventar pressão.


REGRA pro melhorPergunta (string): a ÚNICA melhor pergunta de descoberta pra fazer a ESTE cliente AGORA — a que mais revela a objeção/motivação real e avança a venda, dado o estágio e o que ainda falta entender. Curta, natural, pronta pra mandar no WhatsApp. Se o cliente já está PRONTO/fechando, pode ser a pergunta de avanço/fechamento ("posso reservar a sua unidade?"). Ex.: "O que motivou você a procurar agora?"; "Além do preço, o que é mais importante pra você nessa escolha?"; "O que faria você dizer: é esse?".


REGRA — CONTEÚDO FORA DO ASSUNTO (cliente que também é amigo/parceiro): a conversa pode misturar PAPO PESSOAL e assuntos NÃO comerciais (família, saúde, futebol, política, religião, outros negócios não-imobiliários, combinados sociais, piadas). TRATE esse conteúdo como RUÍDO para a venda: NÃO o use no summary, clientProfile, objections, risk, nextAction nem nas mensagens — foque SOMENTE no que diz respeito à compra/venda do imóvel. Exceções de uso permitido: (a) calibrar o TOM das mensagens (com amigo/parceiro pode ser mais informal e próximo); (b) se ficar claro que o contato é amigo ou parceiro, registrar isso curto em memoriaSugerida.observacoes (ex.: "cliente é amigo/parceiro — tom próximo"). Se a conversa NÃO tiver nada comercial sobre imóvel, seja honesto: summary e nextAction devem dizer que não houve assunto comercial relevante, em vez de inventar negociação ou inflar probabilidade.

REGRA CRÍTICA pro probabilityPercent (0-100): é a PROBABILIDADE DE FECHAR A VENDA com esse lead (não é probabilidade de responder). Seja CONSERVADOR e realista — corretor experiente sabe que conversa boa está longe de venda fechada. Pondere os sinais da conversa:
- Intensidade da interação (responde, puxa assunto, interesse ativo).
- Perguntas do cliente, volume de mensagens/áudios, e QUANTOS DIAS DIFERENTES conversando (voltar em vários dias = intenção real).
- SINAIS FORTES DE COMPRA: pergunta forma de pagamento/financiamento, entrada, prazo de entrega, box/garagem, documentação, escritura, "quando posso visitar/assinar".
- Nível de relacionamento.
CALIBRAGEM OBRIGATÓRIA (siga estas faixas):
- 10-25%: "fogo de palha" — poucas mensagens (≤ 4 trocas REAIS no total), conversa toda concentrada em 1 ÚNICO DIA, cliente sumiu sem voltar. Pediu info genérica e nunca mais respondeu. Esses leads passaram, NÃO vão fechar.
- 20-40%: lead inicial real, demonstrou interesse mas falta MUITA coisa (valor, condições, visita, decisão). Cliente apareceu em 1-2 dias só.
- 45-60%: engajado de verdade — cliente respondeu em 3+ DIAS DIFERENTES, fez perguntas concretas, com alguns sinais de compra, MAS ainda faltam etapas importantes (proposta, definição de pagamento, visita decisiva).
- 65-75%: proposta em cima da mesa, condições quase acertadas, cliente sinalizou decisão clara, compromisso marcado.
- 80%+ : SÓ quando está praticamente fechado (proposta aceita, faltando assinatura/documentação). Raro.
TETO DURO PRA LEADS RASOS: se o lead tem ≤ 6 mensagens TOTAIS na conversa (cliente + corretor somados) E cliente parou de responder há 7+ dias, probabilityPercent NÃO PODE passar de 35. Isso é "fogo de palha", não cliente em negociação. EXCEÇÃO: se houver uma anotação/atendimento PRESENCIAL registrado pelo corretor (linhas com autor "Atendimento presencial (corretor)" ou observações dele), esse teto NÃO se aplica — o corretor esteve com o cliente e a observação dele é evidência de primeira mão; pondere o que ele relatou (visitou, gostou, pediu proposta, vai decidir) e ajuste a probabilidade de acordo.
Penalize forte: sumiço após valores, evasivas, esfriamento, objeção não resolvida, decisão dependente de terceiros, conversa concentrada em 1 único dia.
ATENÇÃO PERMUTA: se o negócio envolve permuta/troca (cliente precisa VENDER um imóvel/carro dele antes de comprar, ou oferece um bem como parte do pagamento), a probabilidade cai bastante (geralmente 30-45% no máximo), porque depende de vender o bem dele primeiro — fora do controle do corretor.
CALIBRAGEM QUANDO É PARCEIRO (tipoContato corretora-parceira / indicador / arquiteto que traz clientes): aqui a probabilidade mede o quão perto os CLIENTES DELE estão de FECHAR — NUNCA o volume ou a duração da conversa com o parceiro. NÃO conte como calor comercial: produção/troca de material (plantas, PDFs, renders, folder, ajustes de projeto), coordenação operacional, nem o parceiro apenas "mostrando/apresentando" o empreendimento — isso é TRABALHO OPERACIONAL, não venda. Pondere SÓ o avanço real dos clientes dele: tem REUNIÃO marcada na construtora? PROPOSTA na mesa? CONDIÇÃO DE PAGAMENTO conversada? unidade/box escolhidos? RESERVA/sinal? Se os prospects dele estão só "olhando o material", "vendo com calma", sem reunião/proposta/pagamento, a probabilidade é BAIXA (15-30%), POR MAIS longa e ativa que seja a conversa. Prospect que JÁ FECHOU COM OUTRA imobiliária/corretor está PERDIDO — não conta a favor. Só suba a faixa conforme os clientes DELE avançam de verdade (reunião marcada ~40-55%; proposta/condições acertadas ~65-75%).

REGRA pro permuta: retorne permuta=true quando a conversa indicar que o cliente quer dar um imóvel/carro/terreno como parte do pagamento, OU precisa vender um bem dele antes de fechar ("tenho que vender minha casa primeiro", "aceita meu apartamento na troca?", "dou meu carro de entrada", "quando vender o meu eu fecho"). Se sim, preencha permutaResumo com o que ele quer dar/vender (1 frase). Se não houver permuta, permuta=false e permutaResumo="".

REGRA pro bestTime: indica MELHOR MOMENTO FUTURO pro corretor mandar mensagem, NUNCA data passada. Linguagem relativa: "hoje à noite", "amanhã pela manhã", "terça à tarde". Sem pista clara, escreva "hoje".

REGRA pro confirmedAppointments: APENAS compromissos REALMENTE COMBINADOS na conversa. NUNCA invente, NUNCA deduza, NUNCA use bestTime aqui. Só inclua se o cliente OU o corretor escreveu algo explícito ("marcamos café amanhã", "passo aí terça", "te ligo segunda"). Cada item: { quando, data, oQue, combinadoPor: "cliente"|"corretor", trechoLiteral }.
REGRA CRÍTICA pro campo "oQue" — escolha o tipo pelo que FOI LITERALMENTE DITO, NÃO chute:
- "café" / "almoço" / "jantar" → SÓ se essa palavra exata aparece no trecho ("vamos tomar um café", "te chamo pra um almoço"). Se ninguém falou em café/almoço/jantar, é PROIBIDO usar esses tipos.
- "visita" → marcou de ver/conhecer/visitar o imóvel.
- "ligação" → marcou de ligar/telefonar em horário ("te ligo às 15h").
- "reunião" → encontro/reunião formal combinado.
- "retorno" → compromisso MOLE, sem tipo concreto: "te chamo amanhã", "te falo depois", "dou um retorno", "volto a falar", "te aviso". Na dúvida entre os tipos, use "retorno" — NUNCA force pra café/visita.
O campo "trechoLiteral" tem que ser a frase EXATA copiada da conversa que prova o compromisso (não parafraseie). O campo "data" é OBRIGATÓRIO e deve ser a data ABSOLUTA do compromisso no formato "AAAA-MM-DD", resolvendo expressões relativas ("amanhã", "terça", "dia 12") em relação à DATA DA MENSAGEM em que foi combinado e a hoje (${hoje}). Se não der pra determinar a data, use "". Se nada combinado, retorne [].
REGRA pro nextAction: reflita a realidade de hoje (${hoje}). Se um compromisso combinado JÁ PASSOU (data anterior a hoje), NÃO mande "confirmar" nem "lembrar" desse compromisso — em vez disso, a próxima ação deve ser um follow-up (ex.: perguntar como foi, retomar a negociação, propor o próximo passo).

REGRA DURA — nextAction TEM QUE SER AÇÃO DO CORRETOR, NUNCA AÇÃO PASSIVA: PROIBIDO sugerir "aguardar retorno", "esperar resposta", "ficar à disposição", "aguardar contato", "esperar decisão", ou qualquer variação passiva. O corretor é quem conduz a venda — toda nextAction tem que descrever uma AÇÃO concreta que ELE precisa fazer (mandar mensagem, ligar, propor visita, sondar perfil, oferecer alternativa, ajustar proposta, etc). Lead parado há mais de 3 dias = corretor precisa REAQUECER ativamente, NÃO esperar.

REGRA pro materiais (array, até 3 itens, pode ser vazio): sugira material de apoio que AJUDA A AVANÇAR ESTE lead AGORA, com base no que o cliente quer, na etapa e nas objeções. Cada item é um objeto { "tipo": <um dos tipos abaixo>, "motivo": <frase curta de por que esse material faz sentido agora pra ESTE cliente>, "quando": <opcional, momento ideal ex: "antes da visita"> }. Tipos PERMITIDOS (use exatamente estes códigos): "planta", "tabela", "video", "folder", "localizacao", "memorial", "simulacao", "comparativo", "convite-visita", "material-valorizacao", "material-wellness". REGRAS: (a) NÃO sugira material que o corretor JÁ enviou na conversa; (b) o motivo tem que ser específico do contexto (ex: "cliente perguntou da metragem dos quartos" → "planta"), não genérico; (c) se nada de material fizer sentido agora, retorne array vazio []. NÃO invente tipos fora da lista.

REGRA — ANOTAÇÕES DO CORRETOR SÃO FATOS (autoridade máxima): entradas da timeline marcadas como atendimento manual/presencial/ligação ou "ANOTAÇÕES DO CORRETOR" são FATOS CONFIRMADOS do que JÁ aconteceu (ex.: "já esteve na construtora pra visita", "já mandei a tabela", "vai analisar no fim de semana"). Considere TODAS as anotações (não só a última) ao decidir nextAction e as 3 mensagens. É PROIBIDO sugerir algo que as anotações dizem que já foi feito: não ofereça "enviar mais informações" se já enviou; não proponha "agendar/fazer visita" se ele já visitou; não repita combinado já feito. O próximo passo tem que ser o passo SEGUINTE ao que já aconteceu (ex.: já visitou e vai analisar → cobrar/apoiar a análise, simular pagamento, ajudar a decidir — não convidar pra visitar de novo).

REGRA — ANOTAÇÃO COMO INSTRUÇÃO INTERNA (NÃO MANDE ISSO PRA CLIENTE): a anotação do corretor pode ser uma INSTRUÇÃO/LEMBRETE pra ELE MESMO, NÃO um texto pra enviar. Ex.: "retomar em 60 dias", "ligar semana que vem", "verificar se a documentação está em dia", "lembrar de X", "cobrar o contrato depois". É PROIBIDO transformar essa instrução em mensagem pro cliente (NUNCA escreva "vamos retomar em 60 dias" ou repita o lembrete na mensagem). O certo: use a instrução pra definir o nextAction e o MOMENTO de retomar (bestTime); e a mensagem ao cliente deve tratar do ASSUNTO REAL da instrução. Ex.: anotação "retomar em 60 dias e ver se a documentação está em dia" → nextAction = "Retomar em ~60 dias pra confirmar a documentação"; e a mensagem (pra quando retomar) = "perguntar se a documentação já está regularizada", e NÃO "vamos nos falar em 60 dias".

REGRA CRÍTICA — QUALIFICAR ANTES DE OFERECER (não chute o produto): quando o OBJETIVO do cliente ainda NÃO está claro/confirmado na conversa, é PROIBIDO empurrar um empreendimento ou pitch específico. O lead está NÃO QUALIFICADO quando falta saber, por exemplo: PRA QUEM é (o próprio cliente, os pais, um filho, terceiro), a FINALIDADE (morar agora, morar no futuro, investir/renda, revenda), a TIPOLOGIA/tamanho necessário, ORÇAMENTO/forma de pagamento, PRAZO e a REGIÃO. Sinais de que precisa qualificar: pergunta de tudo um pouco há muito tempo e não evolui; já pediu vários produtos diferentes; veio de formulário/anúncio sem dizer o que quer; informações contraditórias (ex.: ora apartamento pros pais, ora terreno). Nesses casos: clientProfile e estrategia DEVEM dizer claramente que falta qualificar e O QUE falta descobrir; nextAction = QUALIFICAR (fazer as perguntas certas pra entender o que ela busca e precisa, ANTES de oferecer); e as mensagens devem ACOLHER + fazer 1 ou 2 perguntas de descoberta (pra quem é, morar ou investir, o que procura, prazo). É PROIBIDO afirmar interesse num produto que o cliente não confirmou, empurrar visita/proposta ou "vamos explorar o [empreendimento]" sem qualificação. NÃO finja saber. Só ofereça produto DEPOIS de qualificado.

REGRA CRÍTICA — RESPONDER O QUE FOI PEDIDO (não fique só perguntando): qualificar é pra quando está AMBÍGUO. Quando o cliente FAZ UM PEDIDO CLARO ou diz "SIM/pode mandar/quero ver" a uma oferta sua (ex.: você perguntou "quer que eu envie os valores e as opções?" e ele respondeu "sim"; ou ele pediu "me manda o valor", "tem de 2 quartos?", "quero as opções de terreno"), a próxima ação e as mensagens DEVEM ATENDER/ENTREGAR exatamente o que ele pediu — é PROIBIDO trocar a entrega por mais perguntas de qualificação. Frustra o cliente pedir algo e receber outra pergunta. Se ainda faltar 1 dado pra acertar a entrega, ENTREGUE o que dá agora E faça no MÁXIMO 1 pergunta junto (nunca só a pergunta). Já respondeu/entregou? então o próximo passo avança (não repita o pedido nem re-pergunte o que ele já respondeu).

REGRA — PERGUNTA FÁCIL DE RESPONDER (não jogue trabalho no cliente): quando precisar perguntar, prefira pergunta FECHADA/objetiva — múltipla escolha ou faixa. Ex. BOM: "é mais pra: 1) renda de aluguel, 2) revender no futuro, ou 3) preservar patrimônio?"; "você costuma analisar até R$ 300 mil, até R$ 500 mil, ou acima?". Ex. RUIM (PROIBIDO): pergunta aberta e vaga tipo "o que tornaria o investimento ideal pra você?" — o cliente não sabe responder e esfria. Pergunta de múltipla escolha/faixa avança mais.

REGRA — LEIA O ESTADO/INTENÇÃO REAL (não siga a última frase ao pé da letra): identifique o MODO do cliente. Se ele está em OBSERVAÇÃO/pesquisa, fala como INVESTIDOR ("investir", "algo que valha a pena", "oportunidade"), SEM urgência e/ou os decisores ainda não decidiram → o objetivo NÃO é vender agora: é (a) acolher SEM incomodar, (b) descobrir a FAIXA DE VALOR / perfil de investimento (o "tamanho do cheque") com uma pergunta fechada, e (c) ganhar PERMISSÃO pra voltar quando surgir uma oportunidade alinhada ("posso te avisar quando aparecer algo que faça sentido?"). NUNCA empurre visita/produto nesse caso. Trate como lead de INVESTIDOR, não comprador imediato.

REGRA CRÍTICA — CONTINUIDADE DA NEGOCIAÇÃO (NÃO REPITA O QUE JÁ FOI FEITO): a próxima ação e as 3 mensagens DEVEM ser o PRÓXIMO PASSO LÓGICO da venda, NUNCA repetição do que o corretor já fez. EXEMPLOS NEGATIVOS (PROIBIDOS) — se o corretor JÁ disse na conversa, NÃO sugira repetir:
- Já explicou condições de pagamento, entrada, parcelas → NÃO sugerir "podemos discutir condições de pagamento" / "te mando as condições".
- Já mandou material/link do empreendimento → NÃO sugerir "te mando mais info sobre o empreendimento".
- Já explicou diferenciais (sauna, espaço, etc) → NÃO sugerir "te conto sobre os diferenciais".
- Já passou tabela/valor → NÃO sugerir "te mando os valores".
- Já marcou visita → NÃO sugerir "vamos marcar uma visita" (sugira CONFIRMAR ou REAGENDAR).
Antes de definir nextAction e messages, MAPEIE no estado mais recente da conversa:
(a) O QUE O CLIENTE PEDIU/PERGUNTOU por último (preço, planta, box, prazo, financiamento, visita, etc).
(b) O QUE O CORRETOR JÁ RESPONDEU/ENVIOU a esse pedido (informação dada, material enviado, valor passado, etc).
(c) O QUE AINDA FALTA pra avançar até o próximo marco.
PROIBIDO sugerir como nextAction algo que o corretor JÁ FEZ na conversa. Ex: se cliente perguntou sobre box e corretor já respondeu, NUNCA sugira "enviar informações sobre box" — isso é repetir. Avance pro próximo marco.
MARCOS DA VENDA (em ordem) — a próxima ação deve sempre EMPURRAR pro próximo marco ainda não alcançado:
1. PEDIDO INICIAL respondido → próximo: descobrir se a info chegou ao cliente final, qual foi a reação dele, se o produto cabe no perfil (orçamento/prazo/momento).
2. INTERESSE CONFIRMADO → próximo: propor visita / mandar tabela de condições completas / iniciar conversa de proposta.
3. VISITA/PROPOSTA EM CIMA DA MESA → próximo: confirmar data, alinhar valor, tratar objeção concreta.
4. PROPOSTA ACEITA → próximo: contrato, assinatura, sinal.
5. ASSINATURA → próximo: pagamento, escritura, comissão.
Quando a corretora-parceira intermedia, lembre que SEMPRE há 2 etapas implícitas: (i) a info que ela pediu chega a ela e (ii) ela tem que repassar e voltar com a resposta do cliente final. Sua próxima ação após responder algo a ela deve perguntar a REAÇÃO DO CLIENTE FINAL, NÃO oferecer mais info que você já mandou.

REGRA CRÍTICA — COMPROMISSO ASSUMIDO E NÃO ENTREGUE (próximo passo = ENTREGAR, NUNCA re-pedir permissão): se o CORRETOR PROMETEU/SE COMPROMETEU a entregar algo concreto e o cliente JÁ ACEITOU, mas isso AINDA NÃO foi entregue na conversa — ex.: "vou fazer uma simulação pra você" (cliente: "pode ser"), "te mando a tabela", "preparo a proposta", "te envio as plantas" — o nextAction é ENTREGAR EXATAMENTE ISSO (ex.: "Montar e enviar a simulação que você combinou"), e é PROIBIDO voltar a PEDIR autorização ("vamos simular?", "posso simular?", "quer que eu simule?") como se o combinado não existisse. O cliente está ESPERANDO a entrega. A opção A ENTREGA/anuncia a entrega ("preparei sua simulação, segue..."), não pede permissão de novo. ISSO VALE PARA AS TRÊS mensagens (A, B e C) — NENHUMA pode perguntar "conseguiu pensar?", "tudo certo?", "conseguiu analisar?", "posso ajudar com mais alguma informação?", nem tratar o cliente como se ELE devesse a próxima resposta: quem deve a entrega prometida é o CORRETOR. MESMO se o lead estiver parado/frio há dias, a opção de retomada NÃO é genérica neste caso — ela reconhece a demora com leveza e ENTREGA (ou oferece enviar AGORA) o que foi combinado, usando os parâmetros que o cliente já deu (unidade, teto de parcela, entrada). Quando houver entrega prometida, a mensagem deve reconhecer o combinado e entregar ou anunciar a entrega com os parâmetros reais já informados, sem voltar a pedir autorização nem usar check-in genérico.

REGRA CRÍTICA — USE OS PARÂMETROS QUE O CLIENTE JÁ DEFINIU (não fale genérico quando há dado concreto): quando o cliente já especificou condições concretas, o nextAction e as mensagens DEVEM usá-las explicitamente, nunca de forma genérica. Capte e use, quando existirem: UNIDADE/apartamento escolhido, TETO DE PARCELA, VALOR e FORMA de ENTRADA (inclusive se o cliente ofereceu CARRO ou IMÓVEL como entrada/permuta), nº e valor das parcelas, balão/reforço final. Evite frases genéricas quando o histórico já contém números e condições específicos. Registre esses parâmetros também em memoriaSugerida (preferencias / faixaValor / pontosSensiveis).

REGRA — TIPOLOGIA SEGUE A UNIDADE ESCOLHIDA (não confunda com outra opção): a tipologia (nº de suítes/dormitórios) e as características são as da UNIDADE que o cliente escolheu / está negociando, NUNCA as de uma opção DIFERENTE citada antes. Se a construtora/corretor mencionou um nº de suítes se referindo a OUTRA opção — tipicamente a unidade de ENTRADA, mais barata — NÃO aplique esse número à unidade que o cliente de fato escolheu. Mantenha a tipologia que o CLIENTE declarou querer a menos que a construtora diga EXPRESSAMENTE que A UNIDADE ESCOLHIDA tem outra tipologia.


REGRA CRÍTICA — UMA CONVERSA PODE TER VÁRIOS CASOS / NEGOCIAÇÕES distintas (acontece muito com corretora-parceira, indicação ou cliente que já comprou e voltou): mesmo empreendimento mas cliente diferente, OU mesmo cliente em empreendimentos diferentes, OU caso antigo encerrado + caso novo começando. Antes de decidir produtoInteresse, etapaSugerida, nextAction e as 3 mensagens, FAÇA:
(1) Liste mentalmente os assuntos/negociações que aparecem na conversa toda, na ordem cronológica;
(2) Identifique a NEGOCIAÇÃO MAIS RECENTE (último empreendimento mencionado, último cliente final discutido, ou novo pedido aberto);
(3) Verifique se as negociações anteriores estão ENCERRADAS — sinais fortes de encerramento: comprovante de pagamento (palavras como "Comprovante", "Santander", "Itaú", "Caixa", "pagou", "TED", "PIX feito"), contrato assinado por todas as partes ("ASSINADO", "_assinado.pdf"), troca de "obrigada"/"vamos pra próxima" depois de um marco, comissão sendo combinada;
(4) Se a negociação anterior está claramente FECHADA e há sinais de uma NOVA começando (cliente novo perguntando preço/disponibilidade, novo empreendimento mencionado, "tu tem o tal apartamento?"), foque produtoInteresse, etapaSugerida, nextAction e messages no CASO NOVO — NÃO continue propondo ações do caso já fechado;
(5) No summary, mencione brevemente o caso encerrado apenas para contexto e descreva o caso atual em mais detalhe, sem misturar pessoas ou produtos;
(6) Se a negociação anterior NÃO está fechada e a nova está só começando, mencione as duas no summary mas priorize a que tem mais ação pendente urgente.
NUNCA carimbe nextAction pra um cliente/imóvel que já saiu da pauta há vários dias se a conversa mais recente é sobre outro caso.

REGRA CRÍTICA — REDIRECIONAMENTO POR ORÇAMENTO/PERFIL (NÃO desfaça o que o corretor já fez): dispare esta regra se QUALQUER um for verdadeiro: (a) o CORRETOR já redirecionou o cliente na conversa para OUTRAS opções (ex.: "consigo te direcionar para outras oportunidades que fazem mais sentido para o seu perfil", "opções mais alinhadas", "sem distorcer expectativa"); OU (b) a FAIXA DE INVESTIMENTO sinalizada pelo cliente fica ABAIXO — ou colada no limite apertado — da faixa do empreendimento que ele pediu (compare com o CATÁLOGO acima; ex.: cliente "até R$ 800 mil" pedindo um empreendimento cuja referência começa em ~R$ 730k–800k+ é fit ruim). Quando disparar: (1) NÃO escreva NENHUMA das mensagens insistindo nesse empreendimento, e NUNCA prometa "enviar a apresentação/material" dele — isso CONTRARIA o redirecionamento; (2) as 3 mensagens devem ACOMPANHAR o redirecionamento: reconhecer o orçamento/perfil e conduzir para as opções que CABEM (escolha no catálogo empreendimentos de faixa compatível) e/ou dar seguimento à pergunta de qualificação que o corretor fez (ex.: morar logo x esperar na planta); (3) produtoInteresse e nextAction devem refletir o redirecionamento (a busca por opção que encaixa), não o empreendimento que não cabe.

REGRA pra confianca: 0-100 indicando o quanto a análise é confiável baseado em quanto texto útil há (poucos áudios falhados, conversa longa, contexto claro = alta; poucos turnos, áudios não transcritos = baixa). Reflita HONESTAMENTE.

REGRA pro tipoRetomada: classifique a abordagem mais adequada AGORA. Antes de rotular, FAÇA ISSO NESTA ORDEM:
(1) leia a timeline inteira em ordem cronológica; (2) identifique a ÚLTIMA interação real do cliente (o que ele disse e em que ponto da negociação parou); (3) confira os critérios objetivos abaixo e SÓ rotule se os sinais EXIGIDOS estiverem presentes na conversa; (4) na dúvida, escolha a categoria mais conservadora (primeiro-contato > morno-confirmar > quente-fechar — NUNCA inverta).
Use EXATAMENTE uma destas strings em minúsculas:
- "primeiro-contato" → DEFAULT pra leads que mal começaram. SINAIS: cliente está perguntando coisas básicas (preço, localização, planta, disponibilidade, "vocês ainda têm?"), poucas trocas (menos de ~5-8 turnos do cliente), nenhuma visita ou proposta ainda, sem decisão tomada. Se a etapaSugerida for "Novo" ou "Atendimento" inicial, é AQUI.
- "informacao-enviar" → cliente pediu material/tabela/condições e ESTÁ AGUARDANDO sua resposta. Sinal: última msg dele tem "me manda", "me passa", "tem como mandar", "envia pra mim".
- "morno-confirmar" → interesse confirmado MAS faltam etapas. Sinais EXIGIDOS: cliente já demonstrou interesse claro num imóvel específico E falta agendar próximo passo (visita, retorno, reunião). NÃO é cliente pronto pra fechar.
- "objecao-tratar" → cliente tem dúvida ou objeção clara (preço, prazo, financiamento, esposa/sócio, permuta pendente) e isso travou o avanço. Identifique a objeção REAL.
- "frio-reaquecer" → 7+ dias sem resposta do cliente, ou cliente respondeu evasivo ("depois te falo") e sumiu.
- "stand-by" → cliente EXPLICITAMENTE avisou que retorna depois ("agora não dá", "te chamo daqui uns dias", "estou viajando").
- "quente-fechar" → SÓ use quando TODOS estes sinais estiverem presentes na conversa: (a) proposta/valor já discutidos e aceitos OU faltando só detalhe final; (b) cliente já visitou ou demonstrou compromisso forte (assinatura, pagamento de sinal, conversa com banco); (c) última msg do cliente sinaliza decisão tomada ("vamos fechar", "pode reservar", "me manda o contrato", "estou pronto"). Se QUALQUER um dos 3 não estiver presente, NÃO é quente-fechar.
CROSS-CHECK OBRIGATÓRIO (incoerência reprovada):
- Se etapaSugerida = "Novo" ou "Atendimento" → tipoRetomada NUNCA pode ser "quente-fechar".
- Se probabilityPercent < 65 → tipoRetomada NUNCA pode ser "quente-fechar".
- Se nenhum compromisso confirmado existe E nenhuma proposta foi feita → tipoRetomada NUNCA pode ser "quente-fechar".
- Se há permuta pendente do lado do cliente (precisa vender bem dele) → tipoRetomada NUNCA pode ser "quente-fechar".
Antes de fechar o JSON, releia seu tipoRetomada e confira se ele bate com etapa + probability + sinais. Se não bater, corrija para o rótulo mais conservador.

REGRA pra IMITAR O TOM DO CORRETOR: nas 3 mensagens sugeridas (A/B/C), copie o ESTILO que o corretor (perspectiva descrita acima) usa nas mensagens DELE na timeline desta conversa específica. Observe: saudação preferida ("Oi", "Olá", "Bom dia"), comprimento médio das frases, formalidade (você/tu/sr.), uso de emoji ou não, jeito de fechar ("fico no aguardo", "abraço", "fica à vontade"). Se o corretor escreve curto e direto, sugira curto e direto. Se ele detalha, detalhe. Quando o Cérebro tiver "TOM DE VOZ" ou "ESTILO APRENDIDO" definido, combine os dois (Cérebro = preferência geral, estilo desta conversa = adaptação ao cliente). NUNCA invente um tom que o corretor não usou.

REGRA — ESTILO DE TRATAMENTO DO CORRETOR (aprendido de conversas reais — SIGA SEMPRE):
1. PESSOA ANTES DA VENDA: se o cliente trouxe algo PESSOAL ou está mal/indeciso ("não passei bem", "vou decidir com calma", "preciso ver com a família", "ainda não definimos"), a resposta vem com EMPATIA e cuidado humano PRIMEIRO ("melhoras!", "se cuida", "fico torcendo aí"), curta, SEM empurrar venda nem simulação.
2. SEM PRESSÃO, respeita o tempo do cliente: aceite "não reservar agora", "decido e te aviso" — responda no estilo "fico à disposição, qualquer dúvida me chama", sem insistir, sem cobrar, sem urgência forçada.
3. TOM CALOROSO, INFORMAL e REGIONAL (Carazinho/RS): leve e próximo; pode usar carinho/abreviação ("bei/beijo", "abss/abraços", "bom findi") quando combinar com o cliente; espelhe o jeito dele. Curto quando o momento pede.
4. RECONHEÇA o contexto pessoal que o cliente deu (a mãe que vem, o feriado, a viagem, a safra) na resposta.
5. IMPORTANTE: nesses momentos de empatia/dar espaço, a regra de "sempre fechar com próximo passo/simulação" NÃO se aplica — aqui o próximo passo é MANTER O RELACIONAMENTO e reaproximar gentilmente DEPOIS. Forçar pergunta de venda na hora errada soa frio e insistente, e contraria o estilo do corretor.
6. PESO NO TRECHO MAIS RECENTE: o ESTADO ATUAL do lead é definido pelas ÚLTIMAS mensagens da conversa, não pelo começo. Se no fim o cliente (ou o decisor final, ex.: os pais) RECUSOU ou disse que "não quer/não pensa em sair/agora não", OU se o próprio corretor escreveu que "não vai insistir / não quer importunar", então a próxima ação e as mensagens NÃO podem empurrar o produto, simular condições nem criar urgência. Devem ser LEVES, de relacionamento, deixando a porta aberta ("fica o convite", "qualquer coisa me chama"). Tratar como "lead quente" um caso que terminou em recusa é erro grave. Nesses casos, a nextAction deve SUGERIR respeitar o tempo do cliente e colocar o lead na GELADEIRA (parkeado), reaproximando mais pra frente.

REGRA pra USAR A INTELIGÊNCIA COMERCIAL APRENDIDA (importante): nas seções "TÉCNICAS COMERCIAIS APRENDIDAS", "RESPOSTAS A OBJEÇÕES APRENDIDAS", "MATCH PRODUTO × PERFIL APRENDIDO" e "PADRÕES DE FOLLOW-UP APRENDIDOS" (acima, dentro das Orientações do corretor) está o que o corretor já fez em outras conversas reais. Antes de definir nextAction e as 3 mensagens, FAÇA:
1. Se houver TÉCNICA aprendida pra uma situação parecida com a atual (mesmo tipo de etapa, mesmo perfil, mesma objeção) → use essa técnica adaptada ao caso, NÃO invente nova.
2. Se o cliente trouxer (explícita ou implicitamente) uma OBJEÇÃO que já está no banco aprendido → prefira a resposta que JÁ FUNCIONOU (funcionou=true) pra esse corretor. Se a anterior NÃO funcionou (funcionou=false), tente um caminho diferente.
3. Se o perfil do cliente atual bater com um MATCH produtoVsPerfil aprendido → priorize esse produto/argumento que já gerou interesse antes.
4. Se for follow-up, use o PADRÃO que o corretor costuma usar (timing, abertura, fechamento).
5. Adapte ao caso atual — não cole frase pronta. Pequenas variações, mantendo a essência do que funciona pra esse corretor.

REGRA pra inteligenciaObservada: este é o campo MAIS IMPORTANTE pro Direciona aprender com o corretor. Leia APENAS as mensagens enviadas pelo corretor (a sua perspectiva) nesta conversa, observe o que ele FEZ que funcionou (ou não funcionou), e retorne um objeto com estes campos:
{
  "tom": "1-2 frases descrevendo o estilo de escrita do corretor (saudação, comprimento, formalidade, fechamento). Ex: 'Oi [Nome], tudo bem?, msgs curtas, informal (você), sem emoji, fecha com qualquer coisa me chama'.",
  "tecnicas": [/* até 4 strings curtas: técnicas comerciais ESPECÍFICAS que o corretor usou aqui, com OBJETO concreto da ação + reação do cliente quando visível. Padrão obrigatório: "fez X específico → cliente reagiu Y" ou "fez X específico (motivo)". PROIBIDO usar como técnica os chavões: "ofereceu ajuda", "explicou vantagens", "fez perguntas abertas", "mostrou interesse/disposição", "demonstrou atenção", "focou nas preferências", "destacou flexibilidade", "apresentou opções variadas", "verificou situação". Esses são CHAVÕES sem ação concreta — serão DESCARTADOS. EXEMPLOS VÁLIDOS: "Mandou vídeo de drone da vista do 12º andar → cliente disse uau e marcou visita", "Comparou parcela com aluguel que o cliente paga (R$ 11.660 × R$ 8.000)", "Quebrou entrada em 100k + 70k pro final pra reduzir parcela", "Citou sauna e espaço Care que não estão no material pra criar urgência da visita", "Confirmou disponibilidade do ap 1203 antes de mandar tabela". Se não conseguir identificar técnica específica observável, retorne array vazio em vez de inventar chavão. */],
  "objecoes": [/* SÓ objeções REAIS — RESISTÊNCIA explícita do cliente a avançar com a compra. Cada item: { "objecao": "frase curta da resistência (preço, prazo, financiamento, esposa, momento, dúvida sobre produto, etc)", "respostaUsada": "como o corretor respondeu de fato", "funcionou": true/false/null }.
  PROIBIDO marcar como OBJEÇÃO (rejeita ESTRITAMENTE):
  - Pedido normal do cliente ("quero saber valores", "me manda mais info", "preciso saber valores") — é INTERESSE, não objeção
  - Comentário/relato do PRÓPRIO corretor sobre dificuldade operacional: "cliente não atende", "dificuldade de contato", "não conseguiu contato com o cliente", "Julia mencionou que..." — isso é o CORRETOR falando, não o cliente. NUNCA registre como objeção.
  - Frases vagas como "vou pensar" SEM contexto de resistência clara
  - Status passageiro tipo "preciso pensar na contraproposta", "não consegui analisar ainda", "estou com bastante coisa pra fazer", "tempo para decidir", "aguardando aumento da folha" — são processos/timing, NÃO objeções. Cliente ocupado ou esperando algo NÃO É objeção.
  - "Valor da folha de pagamento", "valor da renda" sem contexto de resistência — é só dado, não objeção.
  Só conta como objeção: RESISTÊNCIA explícita do cliente a fechar (ex: "tá caro", "não posso essa entrada", "tenho dívida", "preciso falar com esposa", "quero ver outras opções primeiro", "tá fora do meu orçamento").
  Critério pra funcionou=true (RIGOROSO): após sua resposta, o cliente EFETIVAMENTE avançou — fez nova pergunta concreta, marcou compromisso, aceitou simulação, engajou ativamente. Resposta tipo "ficamos no aguardo", "fico à disposição", "ok" do corretor SEM avanço do cliente depois = funcionou=false (não destrancou).
  Critério pra funcionou=false: cliente sumiu 7+ dias OU repetiu a objeção OU continuou hesitante OU sua resposta foi passiva ("certo, fico no aguardo").
  null SÓ se literalmente não há mensagem do cliente após sua resposta. */],
  "produtoVsPerfil": [/* até 2 itens: { "produto": "nome do empreendimento oferecido", "perfilCliente": "1 frase descrevendo o perfil curto do cliente — idade, estado civil, momento de vida, faixa de valor, uso (moradia/investimento)", "reacao": "como o cliente reagiu a esse produto: 'demonstrou interesse', 'achou caro', 'preferiu outro', 'pediu mais info', etc" } */],
  "movimentosQueAvancaram": [/* até 3 strings curtas: ações específicas do corretor que destrancaram avanço (ex: "Mandou áudio explicando localização → cliente marcou visita", "Confirmou disponibilidade da unidade do 8º andar → cliente engajou", "Mandou planta + simulação juntos → cliente pediu mais info"). Só inclua se for visível na conversa. */],
  "movimentosQueTravaram": [/* até 3 strings curtas: tentativas do corretor que esfriaram o lead (ex: "Mandou link genérico → cliente sumiu", "Cobrou retorno duas vezes em 24h → cliente reduziu respostas"). Só se visível. */],
  "padroesFollowup": [/* até 3 strings curtas: padrão de como o corretor puxa retorno. SÓ REGISTRE se for OBSERVÁVEL NA TIMELINE — ou seja, o corretor mandou mensagem após N dias de silêncio do cliente E essa mensagem efetivamente reaqueceu (cliente respondeu). NUNCA registre intenções declaradas ("fico à disposição", "te aviso") como padrão; só registra o que ACONTECEU. Ex: "Após 5 dias de silêncio, mandou áudio com vídeo do andar → cliente respondeu na hora". */]
}
REGRAS DURAS:
- Use SÓ o que está LITERALMENTE na conversa. Não invente técnicas que o corretor não usou.
- Se o corretor tem menos de 3 mensagens, retorne {} (objeto vazio).
- Frases CURTAS, acionáveis, no padrão "fez X → cliente reagiu Y".
- Não copie a chave NEM o exemplo entre /* */ — esses são só guias.
- Avalie funcionou pela mudança REAL do cliente: engajou mais/avançou etapa/marcou compromisso = true; SUMIU 7+ DIAS após a resposta / repetiu objeção / esfriou = false. NÃO use null por cautela — só use null se literalmente não há nenhuma mensagem do cliente após a resposta do corretor.
- "fico à disposição", "te aviso", "qualquer coisa me chama" NÃO são padrões de follow-up — são frases de fechamento educadas. Padrão de follow-up = o corretor REAQUECEU concretamente após silêncio e o cliente RESPONDEU.
- PROIBIDO usar a palavra "fechou", "fechei" ou "fechado" em qualquer campo (clientProfile, summary, risk, reacao do produtoVsPerfil, etc) — exceto quando há VENDA confirmada (contrato assinado + comprovante de pagamento na timeline). Em vendas imobiliárias "fechou" significa "vendeu" e não pode ser usado pra descrever interesse, engajamento ou conversa avançada. Use no lugar: "demonstrou interesse", "engajou", "avançou pra negociação", "está em proposta", etc.

IMPORTANTE: Esta chamada gera APENAS o diagnóstico e todos os campos de análise — NÃO gere o campo "messages". Retorne "messages": null no JSON. As mensagens serão geradas em etapa separada com base neste diagnóstico. clientProfile DEVE ser texto, nunca objeto.${orientacoes}${contextoLead}${blocoComparacao}\n\nLead:\n${JSON.stringify(lead)}\n\nTimeline:\n${timelineText}`;
  try {
    const { parsed: parsedRaw, response: completion } = await chamarGPT4Json({
      openai,
      prompt,
      maxOutputTokens: 4096,
      timeout: 32000
    });
    const parsed = normalizarModeloComercial(
      normalizarDiagnosticoJessica(normalizarParceiroB2B(parsedRaw, lead, timelineTextFull)),
      lead,
      timeline,
      corretorNome
    );
    // Registra o modelo real usado no único raciocínio principal.
    parsed._modelo = completion?.model || modeloAnalise();
    // Calcula o horário de hábito do cliente a partir dos horários reais das mensagens dele
    parsed.melhorHorarioContato = calcularMelhorHorario(timeline, lead?.clientName);
    // Sanitiza materiais sugeridos: só tipos válidos, no máx 3, com motivo curto.
    parsed.materiais = sanitizarMateriais(parsed.materiais);
    // Descarta compromissos inventados: só fica o que tem prova literal na conversa.
    parsed.confirmedAppointments = filtrarCompromissosReais(parsed.confirmedAppointments, timelineTextFull);
    // Teto duro pra leads rasos ("fogo de palha"): conversa curta (≤6 msgs) QUE JÁ ESFRIOU
    // (cliente sumiu 7+ dias). MAS se o corretor registrou um atendimento presencial/observação,
    // o teto NÃO se aplica — a leitura de quem esteve com o cliente vale mais que a contagem de
    // mensagens. (Antes travava em 35% por contagem só, ignorando esfriamento e a observação —
    // por isso uma anotação tipo "visitou e vai fechar" mal mexia no número.)
    if (Array.isArray(timeline) && timeline.length <= 6) {
      const temAtendimentoManual = timeline.some(m => m && (m.source === "manual" || m.source === "crm"));
      let ultIso = null;
      for (let i = timeline.length - 1; i >= 0; i--) { const it = timeline[i]; if (it && it.iso && String(it.iso) < "9999") { ultIso = it.iso; break; } }
      const diasParado = ultIso ? Math.floor((Date.now() - new Date(ultIso).getTime()) / 86400000) : 999;
      if (!temAtendimentoManual && diasParado >= 7) {
        const prob = Number(parsed.probabilityPercent) || 0;
        if (prob > 35) parsed.probabilityPercent = 35;
      }
    }
    // Cross-check duro pro tipoRetomada (a IA às vezes erra na coerência mesmo com a regra).
    if (parsed.tipoRetomada === "quente-fechar") {
      const prob = Number(parsed.probabilityPercent) || 0;
      const etapa = String(parsed.etapaSugerida || "").toLowerCase();
      const semProposta = !Array.isArray(parsed.confirmedAppointments) || parsed.confirmedAppointments.length === 0;
      const etapaInicial = etapa === "novo" || etapa === "atendimento" || etapa === "standby";
      if (prob < 65 || etapaInicial || semProposta || parsed.permuta === true) {
        parsed.tipoRetomada = etapaInicial ? "primeiro-contato" : (prob < 50 ? "morno-confirmar" : "morno-confirmar");
      }
    }
    // Decaimento de stand-by: cliente que disse "te aviso" mas sumiu 6+ dias deixou de
    // estar em stand-by e passou pra frio-reaquecer (precisa de retomada ativa).
    if (parsed.tipoRetomada === "stand-by") {
      const dias = Number(lead?.daysSinceLastInteraction) || 0;
      if (dias >= 6) parsed.tipoRetomada = "frio-reaquecer";
    }
    // COERÊNCIA NÚMERO × ESTÁGIO: o probabilityPercent tem que bater com onde o lead REALMENTE
    // está. Um lead em stand-by / primeiro contato / ainda em Atendimento (sem proposta na mesa
    // nem visita/compromisso marcado) NÃO pode aparecer quase-fechado. Sem isso a IA às vezes
    // dava 90-100% pra lead morno e o número estourava pro teto (ex.: cliente "sem pressa,
    // depende da colheita" aparecendo 95%). Caso a IA infle, o código segura no teto da faixa.
    {
      const prob = Number(parsed.probabilityPercent) || 0;
      const etapa = String(parsed.etapaSugerida || "").toLowerCase();
      const tr = String(parsed.tipoRetomada || "").toLowerCase();
      const temCompromisso = Array.isArray(parsed.confirmedAppointments) && parsed.confirmedAppointments.length > 0;
      const etapaInicial = etapa === "novo" || etapa === "atendimento" || etapa === "standby" || etapa === "stand-by";
      let teto = 100;
      if (tr === "primeiro-contato") teto = 40;
      else if (tr === "stand-by" || tr === "frio-reaquecer") teto = 50;
      else if (tr === "informacao-enviar" || tr === "objecao-tratar") teto = 60;
      // Fase inicial sem proposta/compromisso: no máximo "engajado de verdade" (60), nunca quase-fechado.
      if (etapaInicial && !temCompromisso) teto = Math.min(teto, 60);
      if (parsed.permuta === true) teto = Math.min(teto, 45);
      if (prob > teto) parsed.probabilityPercent = teto;
    }
    // O nextAction permanece exatamente como o modelo concluiu. O código não
    // substitui raciocínio comercial por frase genérica; problemas são tratados no prompt/validação.
    // Acumula a inteligência comercial observada no Cérebro. NÃO usa fire-and-forget
    // porque em serverless o processo pode ser destruído antes do upsert terminar.
    if (process.env.DIRECIONA_USAR_APRENDIZADO_AUTO === "1" && parsed.inteligenciaObservada && typeof parsed.inteligenciaObservada === "object") {
      try {
        await registrarInteligenciaAprendida(parsed.inteligenciaObservada);
      } catch (e) {
        console.warn("[direciona] falha ao gravar inteligência aprendida:", e?.message || e);
      }
    }
    // Produto definido NA MÃO pelo corretor (lead.product — ex.: via "Editar lead", quando o lead
    // veio de print/anúncio que não escreve o nome no texto) é AUTORITATIVO. Se a leitura da conversa
    // não achou empreendimento, adota o que o corretor declarou — assim as 3 mensagens CITAM ele e
    // param de perguntar "que tipo de imóvel você quer?" com o produto já identificado no card.
    {
      const prodManual = String(lead?.product || "").trim();
      const prodAtual = String(parsed.produtoInteresse || "").trim();
      const semProd = !prodAtual || /n[ãa]o identificad/i.test(prodAtual);
      const manualValido = prodManual && !/n[ãa]o identificad|produto n[ãa]o|importad/i.test(prodManual);
      if (semProd && manualValido) {
        parsed.produtoInteresse = prodManual;
        if (!Array.isArray(parsed.produtosInteresse) || !parsed.produtosInteresse.length) parsed.produtosInteresse = [prodManual];
      }
    }
    normalizarDiagnosticoJessica(parsed);
    normalizarModeloComercial(parsed, lead, timeline, corretorNome);
    // Quando não há ação urgente, não existe motivo comercial para gerar três novas mensagens.
    // Isso evita pressão indevida, elimina contradição na tela e economiza uma chamada de IA.
    const semAcaoUrgente = parsed?.modeloComercial?.acao?.status === "sem-acao-urgente";
    const msgResult = semAcaoUrgente
      ? { messages: { a:"", b:"", c:"", aLabel:"Sem mensagem agora", bLabel:"", cLabel:"", recomendada:"a" }, _modeloMensagens:null }
      : await gerarMensagensParaLead({ openai, lead, timelineText: timelineTextFull, parsed, corretorNome });
    parsed.messages = (msgResult.messages && typeof msgResult.messages === "object") ? { ...msgResult.messages } : {};
    if (msgResult._modeloMensagens) parsed._modeloMensagens = msgResult._modeloMensagens;
    const m = parsed.messages;
    // Compatibilidade: aceita chaves nomeadas, caso o modelo devolva assim.
    if (!m.a && m.direta) m.a = m.direta;
    if (!m.b && m.consultiva) m.b = m.consultiva;
    if (!m.c && m.retomada) m.c = m.retomada;
    // Limpeza determinística (emoji/espaços) — não altera as palavras.
    m.a = limparMensagemComercial(m.a);
    m.b = limparMensagemComercial(m.b);
    m.c = limparMensagemComercial(m.c);
    if (parsed.diagnostico && typeof parsed.diagnostico === "object" && !String(parsed.diagnostico.mensagemQueEuEnviariaHoje || "").trim() && m.a) {
      parsed.diagnostico.mensagemQueEuEnviariaHoje = m.a;
    }
    if (!m.aLabel) m.aLabel = "Melhor resposta";
    if (!m.bLabel) m.bLabel = "Alternativa leve";
    if (!m.cLabel) m.cLabel = "Alternativa firme";
    if (!["a", "b", "c"].includes(String(m.recomendada || ""))) m.recomendada = "a";

    // O validador só APROVA ou REPROVA. Sem ação urgente, mensagens vazias são intencionais.
    let validacaoFinal = semAcaoUrgente
      ? { ok:true, corrigido:false, issues:[], mensagens:{ a:"", b:"", c:"" }, labels:{ a:"Sem mensagem agora", b:"", c:"" }, recomendada:"a" }
      : validarMensagensComerciais({
          mensagens: { a: m.a, b: m.b, c: m.c, recomendada: m.recomendada },
          labels: { a: m.aLabel, b: m.bLabel, c: m.cLabel },
          lead,
          timelineText: timelineTextFull,
          parsed
        });
    if (!semAcaoUrgente && !validacaoFinal.ok) {
      console.warn("[direciona] validação mensagens falhou:", JSON.stringify(validacaoFinal.issues));
      try {
        const reparo = await regenerarMensagensComModelo({
          openai,
          lead,
          timelineText: timelineTextFull,
          parsed,
          issues: validacaoFinal.issues
        });
        const rm = reparo?.messages || {};
        const ra = limparMensagemComercial(rm.a);
        const rb = limparMensagemComercial(rm.b);
        const rc = limparMensagemComercial(rm.c);
        const novaValidacao = validarMensagensComerciais({
          mensagens: { a: ra, b: rb, c: rc, recomendada: rm.recomendada },
          labels: { a: rm.aLabel, b: rm.bLabel, c: rm.cLabel },
          lead,
          timelineText: timelineTextFull,
          parsed
        });
        if (novaValidacao.ok) {
          parsed.messages = {
            a: ra, b: rb, c: rc,
            aLabel: rm.aLabel || m.aLabel, bLabel: rm.bLabel || m.bLabel, cLabel: rm.cLabel || m.cLabel,
            recomendada: ["a", "b", "c"].includes(String(rm.recomendada || "")) ? rm.recomendada : "a"
          };
          parsed._modeloMensagens = reparo._modelo || modeloAnalise();
          validacaoFinal = novaValidacao;
        }
      } catch (e) {
        console.warn("[direciona] revisão das mensagens falhou:", e?.message || e);
      }
    }
    parsed.arquiteturaMensagens = ARQUITETURA_MENSAGENS_ATUAL;
    parsed.modeloMensagens = modeloAnalise();
    parsed.validacaoSugestoes = validacaoFinal.issues || [];
    parsed.mensagensValidadasEm = validacaoFinal.ok ? new Date().toISOString() : null;
    // Se validação falhou mas as mensagens têm CONTEÚDO, mostra mesmo assim —
    // uma mensagem com detalhe mínimo ruim é sempre melhor que tela vazia.
    // Só bloqueia (sugestoesPendentes) quando não há texto algum.
    const temConteudo = semAcaoUrgente || !!(m.a && m.b && m.c);
    parsed.sugestoesPendentes = semAcaoUrgente ? false : !temConteudo;
    if (!validacaoFinal.ok) {
      console.warn("[direciona] validação mensagens ressalva:", JSON.stringify(validacaoFinal.issues));
      if (!temConteudo) {
        parsed.messages = {
          ...parsed.messages,
          a: "",
          b: "",
          c: "",
          aLabel: "Reanalisar",
          bLabel: "Reanalisar",
          cLabel: "Reanalisar",
          recomendada: "a"
        };
      }
    }

    if (process.env.DIRECIONA_USAR_CONHECIMENTO_AUTO === "1") {
      atualizarConhecimentoCorretor(timelineTextFull, openai).catch(() => {});
    }
    if (process.env.DIRECIONA_USAR_ESTILO_AUTO === "1") {
      atualizarRespostasCorretor(timeline, (lead && lead.clientName) || (parsed.lead && parsed.lead.clientName) || "").catch(() => {});
    }
    return parsed;
  } catch (error) {
    const detail = describeOpenAIError(error);
    const isQuota = /quota|insufficient|429|billing/i.test(detail);
    const motivo = isQuota
      ? "O provedor de análise está sem saldo/limite agora. Tente reanalisar novamente; se persistir, confira o Diagnóstico."
      : "O Direciona não conseguiu analisar agora. Toque em Reanalisar daqui a alguns minutos.";
    return {
      mode: "erro_api",
      error: detail,
      summary: "Conversa importada com sucesso, mas a análise comercial não pôde ser gerada agora.",
      clientProfile: "—",
      probability: "—",
      probabilityPercent: null,
      confianca: 0,
      bestTime: "—",
      objections: [],
      risk: "—",
      tipoContato: null,
      produtoInteresse: null,
      produtosInteresse: [],
      etapaSugerida: null,
      tipoRetomada: null,
      memoriaSugerida: null,
      permuta: false,
      permutaResumo: "",
      melhorHorarioContato: "",
      materiais: [],
      nextAction: null,
      arquiteturaMensagens: ARQUITETURA_MENSAGENS_ATUAL,
      sugestoesPendentes: true,
      validacaoSugestoes: [detail],
      messages: {
        a: "", b: "", c: "",
        aLabel: "Reanalisar", bLabel: "Reanalisar", cLabel: "Reanalisar", recomendada: "a"
      }
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
    probabilidade: anterior.probabilityPercent ?? anterior.probability ?? null,
    tipoRetomada: anterior.tipoRetomada || null,
    nextAction: anterior.nextAction || null,
    mensagemSugerida: anterior.messages?.a || anterior.messages?.direta || anterior.messages?.b || anterior.messages?.consultiva || null,
    risco: anterior.risk || null
  };
  const resumoAtual = {
    probabilidade: atual.probabilityPercent ?? atual.probability ?? null,
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
  const prompt = `Você é o Agente Aprendizado do Direciona. O corretor reimportou a conversa deste lead ao fim de um novo atendimento. Compare a análise ANTERIOR com a situação ATUAL e diga, de forma honesta e baseada SÓ no que está escrito, o que aconteceu desde a última vez.

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

export async function processZipBuffer(buffer) {
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

  // Por padrão, a análise recebe TODO o histórico do ZIP. O recorte antigo de N dias
  // fazia o Direciona perder conversas antigas importantes (ex.: retomadas após 1 ano),
  // mesmo quando o usuário enviava o mesmo arquivo completo ao ChatGPT.
  // O limite só volta se DIRECIONA_LIMITAR_HISTORICO=1 for configurado explicitamente.
  const limitarHistorico = process.env.DIRECIONA_LIMITAR_HISTORICO === "1";
  const diasJanela = limitarHistorico ? await getDiasJanelaConfig() : null;
  const recorte = limitarHistorico
    ? filtrarMensagensRecentes(messagesAll, diasJanela)
    : { filtered: messagesAll, info: { aplicado: false, historicoCompleto: true, totalOriginal: messagesAll.length, totalFiltrado: messagesAll.length } };
  const { filtered: messages, info: filtroInfo } = recorte;

  // Só transcreve áudios que ainda estão referenciados nas mensagens filtradas
  const audioNamesNorm = audioFiles.map(normalizeName);
  const audioFilesRelevantes = audioFiles.filter(audio => {
    const baseNorm = normalizeName(audio);
    return messages.some(m => {
      const ref = findReferencedAudio(m.text, audioNamesNorm);
      return ref && ref === baseNorm;
    });
  });

  const openai = getOpenAI();
  const { timeline, audioTranscriptions, transcriptionEnabled } = await buildTimeline({ zip, messages, audioFiles: audioFilesRelevantes, openai });
  const lead = guessLeadData(timeline);
  const analysis = await analyzeWithBrain({ lead, timeline, openai });
  const audioValues = Object.values(audioTranscriptions || {});
  const audiosTranscritos = audioValues.filter(item => String(item?.status || "").includes("transcrito") && item?.text).length;
  const audiosComErro = audioValues.filter(item => item?.status === "erro_transcricao").length;
  const primeiroErroAudio = audioValues.find(item => item?.status === "erro_transcricao")?.error || null;

  return {
    txtFile: txtName,
    rawText: txt,
    ignoredFilesCount: ignoredFiles.length,
    ignoredFiles: ignoredFiles.slice(0, 120).map(normalizeName),
    ignoredRule: "Imagens, vídeos, documentos, emojis e figurinhas não alimentam a análise. O Direciona usa texto e áudios transcritos.",
    audioFiles: audioFilesRelevantes.map(normalizeName),
    audiosEncontrados: audioFilesRelevantes.length,
    audiosTotalNoZip: audioFiles.length,
    audiosDescartadosPorJanela: audioFiles.length - audioFilesRelevantes.length,
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
export async function prepararConversaDoZip(buffer) {
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
  const limitarHistorico = process.env.DIRECIONA_LIMITAR_HISTORICO === "1";
  const diasJanela = limitarHistorico ? await getDiasJanelaConfig() : null;
  const recorte = limitarHistorico
    ? filtrarMensagensRecentes(messagesAll, diasJanela)
    : { filtered: messagesAll, info: { aplicado: false, historicoCompleto: true, totalOriginal: messagesAll.length, totalFiltrado: messagesAll.length } };
  const { filtered: messages, info: filtroInfo } = recorte;

  // "Sem mídia": quando o WhatsApp exporta SEM mídia, os áudios/imagens viram "<Mídia oculta>"
  // e NÃO vêm no zip. Contamos pra AVISAR o corretor — senão os áudios somem calados e a análise
  // fica incoerente. Se há mídia oculta E nenhum arquivo de áudio, foi exportado sem mídia.
  const midiasOcultas = (txt.match(/<[^>]*(oculta|omitida|omitido|ocultado|omitted|hidden)[^>]*>/gi) || []).length;
  const exportadoSemMidia = midiasOcultas > 0 && audioFiles.length === 0;

  // Áudios referenciados nas mensagens preservadas
  const audioNamesNorm = audioFiles.map(normalizeName);
  const audioFilesRelevantes = audioFiles.filter(audio => {
    const baseNorm = normalizeName(audio);
    return messages.some(m => {
      const ref = findReferencedAudio(m.text, audioNamesNorm);
      return ref && ref === baseNorm;
    });
  });

  return {
    txtFile: txtName,
    messages,
    leadPreliminar: guessLeadData(messages),
    audioFilesRelevantes: audioFilesRelevantes.map(normalizeName),
    audiosParaTranscrever: audioFilesRelevantes.map(normalizeName),
    janelaConversa: filtroInfo,
    ignoredFilesCount: ignoredFiles.length,
    ignoredFiles: ignoredFiles.slice(0, 120).map(normalizeName),
    audiosTotalNoZip: audioFiles.length,
    audiosDescartadosPorJanela: audioFiles.length - audioFilesRelevantes.length,
    midiasOcultas,
    exportadoSemMidia,
    metricsBase: {
      totalFiles: allNames.length,
      totalMensagensOriginais: messagesAll.length,
      totalMessagesParsed: messages.length,
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

// Monta a timeline a partir de mensagens já filtradas + transcrições já prontas
// (não chama OpenAI). transcriptionMap: { nomeBaseDoAudio: {status, text} }
function montarTimelineComTranscricoes(messages, audioFilesRelevantes, transcriptionMap) {
  const audioNames = (audioFilesRelevantes || []).map(normalizeName);
  const timeline = [];
  const usedAudio = new Set();
  for (const msg of messages) {
    const audioRef = findReferencedAudio(msg.text, audioNames);
    if (audioRef) {
      usedAudio.add(audioRef);
      const t = transcriptionMap[audioRef] || { status: "sem_transcricao", text: "" };
      timeline.push({
        ...msg,
        type: "audio",
        mediaFile: audioRef,
        audioStatus: t.status,
        text: t.text ? `[Áudio transcrito] ${t.text}` : `[Áudio: ${audioRef} — ${t.status}]`,
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
    probabilityPercent: a.probabilityPercent ?? null,
    diagnostico: a.diagnostico || null,
    leituraComercial: a.leituraComercial || null,
    modeloComercial: a.modeloComercial || null,
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
    txtFile, messages, audioFilesRelevantes, transcriptionMap, janelaConversa,
    ignoredFilesCount, ignoredFiles, audiosTotalNoZip, audiosDescartadosPorJanela,
    metricsBase, existingTimeline, previousAnalysis, existingLeadId,
    audiosReaproveitados = 0, audiosNovosSolicitados = 0
  } = payload;

  const timelineDoArquivo = montarTimelineComTranscricoes(messages || [], audioFilesRelevantes || [], transcriptionMap || {});
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
  if (reimportacao && mensagensNovas.length === 0 && previousAnalysis && typeof previousAnalysis === "object") {
    // Reexportou o mesmo arquivo sem nenhuma novidade: não chama IA de texto.
    analysis = previousAnalysis;
    analiseReutilizada = true;
  } else if (reimportacao) {
    // Não manda outra vez anos de conversa. Leva todas as novidades, as anotações manuais
    // relevantes e apenas o trecho recente anterior; o estado consolidado vai em bloco próprio.
    const manuais = timelineAntiga.filter(ehAnotacaoManualIncremental).slice(-20);
    const recentes = timelineAntiga.filter(m => !ehAnotacaoManualIncremental(m)).slice(-24);
    const timelineAnalise = mesclarTimelineIncremental([...manuais, ...recentes], mensagensNovas);
    itensContextoAnterior = timelineAnalise.length - mensagensNovas.length;
    analysis = await analyzeWithBrain({
      lead,
      timeline: timelineAnalise,
      openai,
      leadId: existingLeadId,
      contextoIncremental: contextoAnteriorEnxuto(previousAnalysis)
    });
  } else {
    analysis = await analyzeWithBrain({ lead, timeline, openai });
  }

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
    audiosDescartadosPorJanela: audiosDescartadosPorJanela || 0,
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

