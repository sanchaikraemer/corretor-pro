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

export const ARQUITETURA_MENSAGENS_ATUAL = "v752-ia-direta-sem-legado";

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


// v748: sem lista de termos proibidos e sem regras comerciais fixas.
// O pedido foi remover prompts/regras e deixar a IA analisar a conversa bruta.
const TERMOS_PROIBIDOS = [];
const TERMOS_PROIBIDOS_PATTERN = "a^";
const RE_TERMOS_PROIBIDOS = /a^/i;
const RE_TERMOS_PROIBIDOS_GLOBAL = /a^/gi;

function mensagemTemTermoProibido(txt) {
  return false;
}

function mensagemGenericaSemContexto(txt) {
  const s = String(txt || "").toLowerCase();
  return /ainda\s+conversa\s+com\s+o\s+que|quer\s+que\s+eu\s+te\s+mostre\s+outras|prefere\s+comparar\s+outras|outra\s+op[cç][aã]o\s*\?|manter\s+(essa\s+)?op[cç][aã]o\s+em\s+an[aá]lise|compara[cç][aã]o\s+objetiva|ponto\s+de\s+decis[aã]o\s+em\s+aberto|organizar\s+o\s+pr[oó]ximo\s+passo/i.test(s);
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
  maxPerguntas: 1,
  minChars: 80,
  maxChars: 450
};

// v748: todo prompt comercial anterior foi removido.
// Mantém-se apenas uma instrução técnica mínima na chamada da IA para ela retornar JSON.
const PROMPT_ANALISE_PURA = "";
const REGRA_TESE_COMERCIAL = "";

// v724-2: bloco antigo de raciocínio comercial removido.



// v724-2: bloco antigo de leitura comercial removido.



// v748: sem bloco de regras injetado no prompt.
const REGRAS_MSG_PROMPT = "";

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


function limitarMensagemWhatsApp(txt) {
  let s = limparMensagemComercial(txt);
  if (s.length <= REGRAS_MSG.maxChars) return s;
  return s.slice(0, REGRAS_MSG.maxChars - 1).replace(/[\s,.;:!?-]+$/g, "").trim() + ".";
}

function sanitizarMensagemFallback(txt) {
  let s = limitarMensagemWhatsApp(txt);
  if (mensagemTemEmoji(s)) s = limparMensagemComercial(s);
  if ((s.match(/\?/g) || []).length > REGRAS_MSG.maxPerguntas) {
    let count = 0;
    s = s.replace(/\?/g, () => (++count <= REGRAS_MSG.maxPerguntas ? "?" : "."));
  }
  return limitarMensagemWhatsApp(s);
}

function textoFallbackCurto(valor, fallback) {
  const s = String(valor || "").replace(/\s+/g, " ").trim();
  if (!s || /^(nenhum|nenhuma|não identificad[ao]|nao identificad[ao]|—|-)$/i.test(s)) return fallback;
  return s;
}


function diagnosticoIndicaCompromissoCorretorNaoCumprido({ diagnostico = {}, raw = {}, lead = {} } = {}) {
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  const prometeu = /compromissocorretornaocumprido"\s*:\s*"?sim|ficou devendo|pendente da minha parte|não entregou|nao entregou|nunca foi enviada|nunca foi enviado|vou\s+(fazer|montar|preparar|providenciar|enviar|te encaminhar)|fiquei de\s+(te\s+)?(enviar|mandar|montar|preparar|fazer)|corretor\s+(deve|deveria|ficou|prometeu)/.test(blob);
  const simulacao = /simula[cç][aã]o|simular|parcelas?|parcela\s+(m[aá]xima|perto|pr[oó]xima)|r\$\s*4\.?000|4000|entrada|refor[cç]os?|saldo\s+final|condi[cç][aã]o\s+financeira|proposta/.test(blob);
  const corretorAge = /quemdeveagiragora"\s*:\s*"?corretor|proximopasso"\s*:\s*"?corretor|pr[oó]ximo passo.*corretor|corretor deve|corretor deveria|você se comprometeu|voce se comprometeu/.test(blob);
  const clienteAutorizou = /clientejaautorizouacao"\s*:\s*"?sim|pode ser|vamos simular|simular s[oó]|monte|montar|preparar|providenciar|aceitou fazer uma simula[cç][aã]o|autorizou/.test(blob);
  return (prometeu && (simulacao || corretorAge)) || (simulacao && corretorAge && clienteAutorizou);
}

function contextoSimulacaoSemBox({ diagnostico = {}, raw = {}, lead = {} } = {}) {
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  return /sem\s+(o\s+)?box|s[oó]\s+o\s+apartamento|somente\s+(o\s+)?apartamento|apenas\s+(o\s+)?apartamento|box\s+(de\s+garagem\s+)?n[aã]o\s+(incluso|inclu[ií]do)|valores.*n[aã]o abrangem.*box/.test(blob);
}

function extrairUnidadesPreferidas({ diagnostico = {}, raw = {}, lead = {} } = {}) {
  // v744: a unidade deve ser lida primeiro do histórico real da conversa.
  // Campos gerados pela própria IA, como nextAction/pendência, podem vir contaminados
  // com alternativas abertas (ex.: "1302 ou 1402") e não podem mandar na escolha.
  const fontesConversa = [
    raw?._timelineText,
    raw?.conversationText,
    raw?.textoConversa,
    raw?.transcript,
    raw?.historico,
    raw?.messages,
    raw?.mensagens
  ].filter(Boolean).join("\n");

  const textoBase = fontesConversa || [
    diagnostico?.unidadeEscolhida,
    diagnostico?.unidadePrincipal,
    diagnostico?.produtoPrincipal,
    diagnostico?.ultimoCompromissoCliente,
    diagnostico?.ultimoCompromissoCorretor,
    diagnostico?.justificativa,
    lead?.title,
    lead?.name,
    lead?.product
  ].filter(Boolean).join("\n");

  const blob = textoBase || JSON.stringify({ diagnostico, raw, lead });
  const matches = [...blob.matchAll(/\b(?:ap(?:to|artamento|unidade)?\s*)?(\d{3,4})\b/gi)]
    .filter(m => /^(10|11|12|13|14|15|16|17|18)\d{2}$/.test(m[1]));

  const mapa = new Map();
  for (const m of matches) {
    const unidade = m[1];
    const idx = m.index || 0;
    const antes = blob.slice(Math.max(0, idx - 180), idx).toLowerCase();
    const depois = blob.slice(idx + unidade.length, Math.min(blob.length, idx + unidade.length + 180)).toLowerCase();
    const trecho = `${antes} ${unidade} ${depois}`;
    const antesCurto = blob.slice(Math.max(0, idx - 90), idx).toLowerCase();
    let score = 1;

    // Quando o cliente diz algo como "gostamos bastante do projeto do 1302",
    // isso vale mais que uma unidade citada depois como possibilidade lateral
    // (ex.: "ou talvez o 1402"). A escolha precisa vir do sentido da frase,
    // não da última unidade que apareceu no texto.
    if (/(gostamos|gostei|preferimos|preferi).{0,80}(projeto|planta|unidade|apto|apartamento).{0,14}$/.test(antesCurto)) score += 260;
    if (/(talvez|ou\s+talvez|quem\s+sabe).{0,24}$/.test(antesCurto)) score -= 260;

    if (/\b(escolh(eu|emos|eram|ida|ido)|defini(u|mos|ram)|ficou\s+(como|no|na)|base\s+(da|do|para)|considerando|usar\s+como\s+base|seguir\s+(com|no|na)|vamos\s+simular|simular\s+(o|a)?|simula[cç][aã]o)\b/.test(trecho)) score += 80;
    if (/\b(gostei|gostamos|gostou|gostaram|preferi|preferimos|preferiu|preferiram|prefer[eê]ncia|favorit[ao]|melhor\s+op[cç][aã]o|mais\s+gostou|mais\s+gostamos)\b/.test(trecho)) score += 55;
    if (/\b(parcelas?|parcela\s+m[aá]xima|entrada|refor[cç]os?|saldo|condi[cç][aã]o|proposta|r\$\s*4\.?000|4000)\b/.test(trecho)) score += 25;
    if (/\b(apartamento|apto|unidade|planta|terra[cç]o)\b/.test(trecho)) score += 10;
    if (/\b(talvez|tamb[eé]m|ou\s+(o|a)?\s*\d{3,4}|outra\s+op[cç][aã]o|possibilidade|comparar|compara[cç][aã]o|se\s+a\s+condi[cç][aã]o\s+mudar)\b/.test(trecho)) score -= 35;

    const atual = mapa.get(unidade) || { unidade, score: 0, count: 0, lastIndex: -1 };
    atual.score += score;
    atual.count += 1;
    atual.lastIndex = Math.max(atual.lastIndex, idx);
    mapa.set(unidade, atual);
  }

  if (!mapa.size) {
    return { principal: "a unidade escolhida", alternativo: "", texto: "a unidade que vocês ficaram de avaliar" };
  }

  const ordenadas = [...mapa.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.lastIndex !== a.lastIndex) return b.lastIndex - a.lastIndex;
    return b.count - a.count;
  });
  const escolhida = ordenadas[0]?.unidade;
  if (!escolhida) {
    return { principal: "a unidade escolhida", alternativo: "", texto: "a unidade que vocês ficaram de avaliar" };
  }
  return { principal: escolhida, alternativo: "", texto: `o ${escolhida}` };
}


function unidadeEscolhidaNumerica(ctx = {}) {
  const u = extrairUnidadesPreferidas(ctx)?.principal;
  return /^\d{3,4}$/.test(String(u || "")) ? String(u) : "";
}

function unidadesNumericasNoTexto(txt) {
  return [...new Set([...String(txt || "").matchAll(/\b(?:ap(?:to|artamento|unidade)?\s*)?(\d{3,4})\b/gi)]
    .map(m => m[1])
    .filter(n => /^(10|11|12|13|14|15|16|17|18)\d{2}$/.test(n)))];
}

function mensagemMisturaUnidadeEscolhidaComAlternativa(txt, ctx = {}) {
  const escolhida = unidadeEscolhidaNumerica(ctx);
  if (!escolhida) return false;
  const unidades = unidadesNumericasNoTexto(txt);
  if (unidades.length <= 1 || !unidades.includes(escolhida)) return false;
  const s = String(txt || "").toLowerCase();
  // O problema comercial aqui é citar a unidade escolhida como alternativa aberta,
  // ex.: "1302 ou 1402". Se o contexto já consolidou uma unidade, a mensagem
  // deve usar somente ela, não voltar a comparar.
  return /\b\d{3,4}\s*(?:ou|\/)\s*\d{3,4}\b|\bunidade\s+\d{3,4}\s*(?:ou|\/)\s*\d{3,4}\b/.test(s);
}

function corrigirAlternativaUnidadeEscolhidaTexto(txt, ctx = {}) {
  let s = String(txt || "").replace(/\s+/g, " ").trim();
  const escolhida = unidadeEscolhidaNumerica(ctx);
  if (!s || !escolhida) return s;
  const unidades = unidadesNumericasNoTexto(s);
  if (unidades.length <= 1 || !unidades.includes(escolhida)) return s;
  if (!/\b\d{3,4}\s*(?:ou|\/)\s*\d{3,4}\b|\bunidade\s+\d{3,4}\s*(?:ou|\/)\s*\d{3,4}\b/i.test(s)) return s;
  s = s.replace(/\bunidade\s+\d{3,4}\s*(?:ou|\/)\s*\d{3,4}\b/gi, `unidade ${escolhida}`);
  s = s.replace(/\b\d{3,4}\s*(?:ou|\/)\s*\d{3,4}\b/g, escolhida);
  return s.replace(/\s+/g, " ").trim();
}

function referenciaParcela({ diagnostico = {}, raw = {}, lead = {} } = {}) {
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  if (/r\$\s*4\.?000|4\.?000|4000|4\s*mil/.test(blob)) return "parcelas próximas dos R$ 4 mil";
  if (/parcela\s+m[aá]xima/.test(blob)) return "a parcela máxima que você comentou";
  if (/parcela/.test(blob)) return "a parcela que você comentou";
  return "a condição financeira que vocês comentaram";
}

function mensagemPareceCortada(txt) {
  const s = String(txt || "").trim().replace(/[.!?…]+$/g, "").trim().toLowerCase();
  return /\b(para|pra|se|que|de|com|e|ou|ver|avaliar|ficar|chegar|montar)$/.test(s) || /ver\s+se\s+(pra|para)\s+voc[eê]s$/.test(s);
}

function mensagemPrecisaFallbackCompromissoCorretor(txt, { diagnostico = {}, raw = {}, lead = {} } = {}) {
  const s = String(txt || "").toLowerCase();
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  if (!s.trim() || mensagemFormatoRuim(txt) || mensagemComVocativoInvalido(txt) || mensagemPareceCortada(txt)) return true;
  if (/ainda tem interesse|segue interessado|faz sentido|qualquer dúvida|fico à disposição|passando para saber|passando para retomar|sem compromisso|se quiser|se acharem interessante|me avisa como preferem|tudo bem\?|tudo certo\?|pode ser\?|continua fazendo sentido|continua nos planos|ok[.!?]*$/.test(s)) return true;
  if (mensagemMisturaUnidadeEscolhidaComAlternativa(txt, { diagnostico, raw, lead })) return true;
  if (/simula[cç][aã]o|simular|parcela|entrada|refor[cç]o|saldo|condi[cç][aã]o|proposta/.test(blob)) {
    if (!/simula[cç][aã]o|simular|valores|condi[cç][aã]o|parcela|entrada|refor[cç]o|saldo|composi[cç][aã]o|atualizar/.test(s)) return true;
    if (/\b(quer que eu|posso)\b.*\?/.test(s) && !/confirmar|comparar/.test(s)) return true;
  }
  if (contextoSimulacaoSemBox({ diagnostico, raw, lead }) && /com\s+(o\s+)?box|incluir\s+(o\s+)?box|ver como ficaria com o box|com box duplo/.test(s)) return true;
  if (/visita|conhecer pessoalmente|horário para visitar|agendar/.test(s) && /simula[cç][aã]o|simular|r\$\s*4\.?000|4000|parcela/.test(blob) && !/simula[cç][aã]o/.test(s)) return true;
  return false;
}

function mensagensFallbackCompromissoCorretor({ lead = {}, diagnostico = {}, raw = {} } = {}) {
  const nome = primeiraPalavraNome(lead);
  const prefixo = nome ? `${nome}, ` : "";
  const produto = produtoCurtoParaMensagem(diagnostico.produtoAtual || diagnostico.produtoPrincipal || raw.produtoInteresse || lead?.product || "essa opção", "essa opção");
  const unidades = extrairUnidadesPreferidas({ diagnostico, raw, lead });
  const parcela = referenciaParcela({ diagnostico, raw, lead });
  const semBox = contextoSimulacaoSemBox({ diagnostico, raw, lead });
  const complementoBox = semBox ? ", sem o box" : "";
  return [
    sanitizarMensagemFallback(`${prefixo}ficou pendente da minha parte a simulação ${produtoComDe(produto)} considerando ${unidades.texto}${complementoBox}, com ${parcela}. Vou atualizar os valores e te envio uma composição com entrada, mensais, reforços e saldo para vocês avaliarem.`),
    sanitizarMensagemFallback(`${prefixo}vou montar a simulação ${produtoComDe(produto)} usando ${unidades.texto} como base${complementoBox} e mantendo ${parcela}. Assim vocês conseguem avaliar a condição completa antes de avançarmos para qualquer outro ponto.`),
    sanitizarMensagemFallback(`${prefixo}ficou pendente aquela simulação ${produtoComDe(produto)} considerando ${unidades.texto}${complementoBox}. Vou preparar a composição com entrada, parcelas mensais, reforços e saldo final para vocês avaliarem se fica confortável.`)
  ];
}

function gerarMensagemBaseFallback({ lead, diagnostico = {}, raw = {} }) {
  const nome = primeiraPalavraNome(lead);
  const produto = produtoCurtoParaMensagem(raw.produtoInteresse || diagnostico.produtoAtual || diagnostico.produtoPrincipal || lead?.product, "essa opção");
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  const compromisso = compromissoDirecionamentoTexto({ diagnostico, raw, produto });
  const prefixo = nome ? `${nome}, ` : "";
  if (/esposa|mulher/.test(blob)) {
    return sanitizarMensagemFallback(`${prefixo}retomando nosso contato: ${compromisso}. Antes de sugerir o próximo passo, vale entender como ficou essa avaliação com sua esposa. Posso organizar as opções em cima do que ficou mais importante para vocês?`);
  }
  if (/esposo|marido/.test(blob)) {
    return sanitizarMensagemFallback(`${prefixo}retomando nosso contato: ${compromisso}. Antes de sugerir o próximo passo, vale entender como ficou essa avaliação com seu esposo. Posso organizar as opções em cima do que ficou mais importante para vocês?`);
  }
  if (/foto|fotos|imagem|imagens/.test(blob)) {
    return sanitizarMensagemFallback(`${prefixo}retomando nosso contato: ${compromisso}. Posso separar as fotos principais e os pontos que ajudam a avaliar ${produto} com mais clareza?`);
  }
  if (/planta|plantas/.test(blob)) {
    return sanitizarMensagemFallback(`${prefixo}retomando nosso contato: ${compromisso}. Posso separar as plantas e opções ${produtoComDe(produto)} para vocês avaliarem com mais clareza?`);
  }
  return sanitizarMensagemFallback(`${prefixo}retomando nosso contato sobre ${produto}: ${compromisso}. Posso organizar o próximo passo em cima do que ficou pendente na conversa?`);
}

function gerarTrioFallbackContextual({ lead, diagnostico = {}, raw = {} }) {
  const nome = primeiraPalavraNome(lead);
  const produto = produtoCurtoParaMensagem(raw.produtoInteresse || diagnostico.produtoAtual || diagnostico.produtoPrincipal || lead?.product, "essa opção");
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  const prefixo = nome ? `${nome}, ` : "";
  const a = gerarMensagemBaseFallback({ lead, diagnostico, raw });

  if (/esposa|mulher/.test(blob)) {
    return [
      a,
      sanitizarMensagemFallback(`${prefixo}para facilitar essa retomada, posso organizar uma visão ${produtoComDe(produto)} em cima dos pontos que podem pesar para vocês dois. Assim fica mais simples avaliar junto com sua esposa. Quer que eu prepare isso?`),
      sanitizarMensagemFallback(`${prefixo}ficou em aberto como sua esposa avaliou ${produto}. Antes de avançar, qual ponto pesou mais para vocês: planta, condição, localização ou prazo?`)
    ];
  }
  if (/esposo|marido/.test(blob)) {
    return [
      a,
      sanitizarMensagemFallback(`${prefixo}para facilitar essa retomada, posso organizar uma visão ${produtoComDe(produto)} em cima dos pontos que podem pesar para vocês dois. Assim fica mais simples avaliar junto com seu esposo. Quer que eu prepare isso?`),
      sanitizarMensagemFallback(`${prefixo}ficou em aberto como seu esposo avaliou ${produto}. Antes de avançar, qual ponto pesou mais para vocês: planta, condição, localização ou prazo?`)
    ];
  }
  if (/planta|plantas|renaissance|lan[cç]amento|na planta/.test(blob)) {
    return [
      a,
      sanitizarMensagemFallback(`${prefixo}para facilitar a avaliação, posso organizar as plantas, posições e condições ${produtoComDe(produto)} em uma visão mais objetiva. Prefere olhar primeiro planta ou condição?`),
      sanitizarMensagemFallback(`${prefixo}ficou esse ponto ${produtoComDe(produto)} em aberto. Posso retomar pelo que pesa mais agora: planta, prazo, posição ou condição?`)
    ];
  }
  return [
    a,
    sanitizarMensagemFallback(`${prefixo}para facilitar a retomada, posso separar os pontos principais ${produtoComDe(produto)} de acordo com o que apareceu na conversa. Quer que eu organize isso para vocês?`),
    sanitizarMensagemFallback(`${prefixo}ficou esse ponto ${produtoComDe(produto)} em aberto. Posso te passar o próximo passo mais objetivo em cima do que vocês estavam avaliando?`)
  ];
}

function diagnosticoIndicaDirecionamentoCorretor({ diagnostico = {}, raw = {}, lead = {} }) {
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  const direcionamentoDeclarado = /trocaprodutofoidirecionamentocorretor"\s*:\s*"?sim|direcionamento comercial do corretor|corretor\s+(apresentou|sugeriu|indicou|ofereceu|conduziu)|foi apresentado como alternativa|op[cç][aã]o compat[ií]vel|alternativa compat[ií]vel|dentro da mesma necessidade/.test(blob);
  const clienteMudouSozinho = /voltou\s+(depois|por).*outro an[uú]ncio|por outro an[uú]ncio|novo an[uú]ncio|clicou.*an[uú]ncio|premium office.*personali|personali.*premium office|sala comercial.*apartamento|apartamento.*sala comercial/.test(blob);
  const trocaResidencialMesmoObjetivo = /renaissance/.test(blob) && /personali/.test(blob) && !/premium\s*office|sala\s+comercial|terreno|nova\s+vila\s+rica/.test(blob);
  return (direcionamentoDeclarado && !clienteMudouSozinho) || trocaResidencialMesmoObjetivo;
}


function contextoPerguntasRespondidas({ diagnostico = {}, raw = {}, lead = {} } = {}) {
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  const produtoComercial = /premium\s+office|sala\s+comercial|consult[oó]rio|cl[ií]nica/.test(blob);
  const objetivoConsultorioFilho = /(consult[oó]rio|cl[ií]nica).{0,120}(filho|urolog)|filho.{0,120}(consult[oó]rio|cl[ií]nica|urolog)|urolog/.test(blob);
  const valoresPedidosOuEnviados = /(tem\s+valores|valores\s+j[aá]|valor(es)?\s+j[aá]|link\s+com\s+(as\s+)?disponibilidades|disponibilidades\s+e\s+valores|prazo\s+para\s+pagamento|pagamento\s+at[eé]\s+2029|direto\s+com\s+construtora)/.test(blob);
  const objetivoJaRespondido = objetivoConsultorioFilho || /objetivo\s*:\s*(morar|investir)|objetivo\s+real|para\s+moradia|para\s+investimento|uso\s+pr[oó]prio/.test(blob);
  const mudancaComercialResidencialReal = /premium\s+office/.test(blob) && /personali[tée]|personalit/.test(blob) && /(outro\s+an[uú]ncio|novo\s+an[uú]ncio|qual\s+valor\s+deste\s+apto|apartamento|apto)/.test(blob);
  return {
    ativo: !mudancaComercialResidencialReal && !!((produtoComercial && (objetivoConsultorioFilho || valoresPedidosOuEnviados)) || (objetivoJaRespondido && valoresPedidosOuEnviados)),
    produtoComercial,
    objetivoConsultorioFilho,
    valoresPedidosOuEnviados,
    objetivoJaRespondido
  };
}

function mensagemPerguntaDescobertaJaRespondida(txt, ctx = {}) {
  const s = String(txt || "").toLowerCase();
  const c = contextoPerguntasRespondidas(ctx);
  if (!c.ativo) return false;
  return /assunto\s+anterior|o\s+que\s+(te\s+)?chamou\s+(tua\s+|sua\s+)?aten[cç][aã]o|padr[aã]o,?\s+localiza[cç][aã]o|possibilidade\s+diferente|buscando\s+algo\s+diferente|objetivo\s+atual|moradia,?\s+investimento|uso\s+pr[oó]prio|pensando\s+em\s+investimento|compara[cç][aã]o\s+de\s+oportunidade/.test(s);
}

function mensagensFallbackPerguntasRespondidas({ lead = {}, diagnostico = {}, raw = {} } = {}) {
  const nome = primeiraPalavraNome(lead);
  const prefixo = nome ? `${nome}, ` : "";
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  const produto = produtoCurtoParaMensagem(diagnostico.produtoAtual || diagnostico.produtoPrincipal || raw.produtoInteresse || lead?.product || (/premium\s+office/.test(blob) ? "a Premium Office" : "essa opção"), "essa opção");
  const c = contextoPerguntasRespondidas({ diagnostico, raw, lead });
  const projeto = c.objetivoConsultorioFilho ? "o consultório do teu filho" : "o projeto que vocês estavam avaliando";
  const pensandoProjeto = c.objetivoConsultorioFilho ? "no consultório do teu filho" : "no projeto que vocês estavam avaliando";
  const paraProjeto = c.objetivoConsultorioFilho ? "para o consultório do teu filho" : "para o projeto que vocês estavam avaliando";
  if (produtoEhComercial(produto, blob) || /premium\s+office/.test(blob)) {
    return [
      sanitizarMensagemFallback(`${prefixo}conseguiu dar uma olhada nas salas da Premium Office? Pensando ${pensandoProjeto}, se vocês já tiverem alguma preferência de metragem ou faixa de investimento, consigo separar as opções que mais se encaixam para vocês avaliarem.`),
      sanitizarMensagemFallback(`${prefixo}depois que te enviei o link com disponibilidades e valores da Premium Office, ficou em aberto escolher quais salas fazem mais sentido ${paraProjeto}. Alguma metragem ou faixa de valor chamou mais atenção?`),
      sanitizarMensagemFallback(`${prefixo}para facilitar a decisão, posso separar as salas da Premium Office por metragem, posição e valor, já pensando ${pensandoProjeto}. Assim vocês olham primeiro as opções com mais encaixe. Quer que eu organize essa seleção?`)
    ];
  }
  return [
    sanitizarMensagemFallback(`${prefixo}retomando o ponto que já estava claro na conversa, posso organizar as opções em cima do que vocês informaram e evitar voltar para perguntas que já foram respondidas. Quer que eu separe o caminho mais objetivo?`),
    sanitizarMensagemFallback(`${prefixo}para facilitar, posso separar as opções usando os critérios que vocês já passaram na conversa. Assim avaliamos direto o que tem mais encaixe, sem reiniciar o atendimento.`),
    sanitizarMensagemFallback(`${prefixo}ficou em aberto avançar a partir das informações que vocês já tinham passado. Posso organizar uma seleção objetiva com os próximos passos?`)
  ];
}

function diagnosticoIndicaMudancaComRetomada({ diagnostico = {}, raw = {}, lead = {} }) {
  if (diagnosticoIndicaDirecionamentoCorretor({ diagnostico, raw, lead })) return false;
  if (contextoPerguntasRespondidas({ diagnostico, raw, lead }).ativo) return false;
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  const houveMudanca = /houvemudancajornada"\s*:\s*"?sim|mudan[cç]a de jornada|mudou de produto|produto anterior|interesse anterior|outro an[uú]ncio|premium office.*personali|personali.*premium office|sala comercial.*apartamento|apartamento.*sala comercial/.test(blob);
  const temRetomada = /tempo parado|conversa parada|retomada|retomando|voltou depois|voltou por|outro an[uú]ncio|novo an[uú]ncio|conversa antiga|depois de tempo|meses depois|três meses|tres meses|meses parado|h[aá]\s+mais\s+de\s+7\s+dias|\b[89]|[1-9][0-9]\s+dias/.test(blob);
  return houveMudanca && temRetomada;
}

function produtoSeguroParaMsg(valor, fallback) {
  const s = String(valor || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!s || /^(nenhum|nenhuma|não identificad[ao]|nao identificad[ao]|—|-)$/i.test(s)) return fallback;
  return s;
}


function limparProdutoParaMensagem(valor, fallback) {
  let s = produtoSeguroParaMsg(valor, fallback);
  s = s
    .replace(/^sala comercial no premium office$/i, "a Premium Office")
    .replace(/^apartamento no edifício personalit[eé]$/i, "o Personalité")
    .replace(/^apartamento no personalit[eé]$/i, "o Personalité")
    .replace(/^edifício personalit[eé]$/i, "o Personalité")
    .replace(/^premium office$/i, "a Premium Office")
    .replace(/^personalit[eé]$/i, "o Personalité")
    .replace(/^renaissance$/i, "o Renaissance")
    .replace(/\s+/g, " ")
    .trim();
  return s || fallback;
}

function produtoCurtoParaMensagem(valor, fallback) {
  const s = limparProdutoParaMensagem(valor, fallback);
  if (/premium\s+office/i.test(s)) return "a Premium Office";
  if (/personalit[eé]/i.test(s)) return "o Personalité";
  if (/renaissance/i.test(s)) return "o Renaissance";
  if (/nova\s+vila\s+rica/i.test(s)) return "o Nova Vila Rica III";
  if (/evolutti/i.test(s)) return "o Evolutti";
  if (/quality/i.test(s)) return "o Quality";
  if (/boulevard/i.test(s)) return "o Boulevard";
  return s;
}

function produtoComDe(produto) {
  const s = String(produto || "").trim();
  if (/^a\s+/i.test(s)) return s.replace(/^a\s+/i, "da ");
  if (/^o\s+/i.test(s)) return s.replace(/^o\s+/i, "do ");
  if (/^as\s+/i.test(s)) return s.replace(/^as\s+/i, "das ");
  if (/^os\s+/i.test(s)) return s.replace(/^os\s+/i, "dos ");
  return `de ${s}`;
}

function mensagemComVocativoInvalido(txt) {
  return /^\s*(conversa|whatsapp|cliente|lead|contato|arquivo|zip)\s*,/i.test(String(txt || ""));
}

function limparVocativoInvalido(txt, lead = {}) {
  const nome = primeiraPalavraNome(lead);
  const nomeValido = nome && !/^(conversa|whatsapp|cliente|lead|contato|arquivo|zip)$/i.test(nome);
  let s = String(txt || "").trim();
  if (/^\s*(conversa|whatsapp|cliente|lead|contato|arquivo|zip)\s*,/i.test(s)) {
    s = s.replace(/^\s*(conversa|whatsapp|cliente|lead|contato|arquivo|zip)\s*,\s*/i, nomeValido ? `${nome}, ` : "");
  }
  if (nomeValido && /^retomando nosso contato/i.test(s)) {
    s = `${nome}, ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
  }
  s = s
    .replace(/\bSala comercial no Premium Office\b/gi, "a Premium Office")
    .replace(/\bApartamento no Edifício Personalit[eé]\b/gi, "o Personalité")
    .replace(/\bApartamento no Personalit[eé]\b/gi, "o Personalité")
    .replace(/\bEdifício Personalit[eé]\b/gi, "o Personalité")
    .replace(/\bde a Premium Office\b/gi, "da Premium Office")
    .replace(/\bde o Personalit[eé]\b/gi, "do Personalité")
    .replace(/\bte passar coisa solta\b/gi, "sugerir o próximo passo")
    .replace(/\bte mandar opção solta\b/gi, "sugerir o próximo passo")
    .replace(/\bopções soltas\b/gi, "sugestões desalinhadas ao teu objetivo")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

function mensagensFallbackMudancaRetomada({ lead = {}, diagnostico = {}, raw = {} }) {
  if (contextoPerguntasRespondidas({ diagnostico, raw, lead }).ativo) return mensagensFallbackPerguntasRespondidas({ lead, diagnostico, raw });
  const nome = primeiraPalavraNome(lead);
  const blob = JSON.stringify({ lead, diagnostico, raw }).toLowerCase();
  const anterior = produtoCurtoParaMensagem(diagnostico.produtoAnterior || diagnostico.interesseAnterior || (/premium\s+office|premium/.test(blob) && /personali[tée]|personalit/.test(blob) ? "a Premium Office" : ""), "");
  const atual = produtoCurtoParaMensagem(diagnostico.produtoAtual || diagnostico.produtoPrincipal || raw.produtoInteresse || (/personali[tée]|personalit/.test(blob) ? "o Personalité" : "essa nova opção"), "essa nova opção");
  if (!anterior || anterior === "o assunto anterior" || anterior === atual) return mensagensFallbackPerguntasRespondidas({ lead, diagnostico, raw });
  const prefixo = nome ? `${nome}, ` : "";
  return [
    sanitizarMensagemFallback(`${prefixo}retomando nosso contato: antes falávamos sobre ${anterior}, e agora você me chamou sobre ${atual}. Queria entender melhor o que te chamou atenção nesse imóvel: foi o padrão, a localização ou está avaliando uma possibilidade diferente agora?`),
    sanitizarMensagemFallback(`${prefixo}para eu te direcionar melhor nessa retomada, vale entender uma coisa: antes falávamos sobre ${anterior}, e agora você olhou ${atual}. Hoje você está olhando mais para moradia, investimento ou comparação de oportunidade?`),
    sanitizarMensagemFallback(`${prefixo}como teu interesse saiu ${produtoComDe(anterior)} e veio para ${atual}, prefiro entender teu objetivo atual antes de sugerir o próximo passo. Você está buscando algo para uso próprio ou pensando em investimento?`)
  ];
}


function contemCompromissoComConjuge({ diagnostico = {}, raw = {} }) {
  const blob = JSON.stringify({ diagnostico, raw }).toLowerCase();
  return /(esposo|esposa|marido|mulher|companheir[oa])/.test(blob);
}

function compromissoDirecionamentoTexto({ diagnostico = {}, raw = {}, produto = "essa opção" }) {
  const blob = JSON.stringify({ diagnostico, raw }).toLowerCase();
  const ultimo = String(diagnostico.ultimoCompromissoCliente || diagnostico.pendenciaPrincipal || raw.nextAction || "").replace(/\s+/g, " ").trim();
  if (/(esposo|marido)/i.test(ultimo) || (/(esposo|marido)/.test(blob) && /(avaliar|ver|retorno|retornar)/.test(blob))) {
    return `você tinha ficado de avaliar ${produto} com seu esposo e me retornar`;
  }
  if (/(esposa|mulher)/i.test(ultimo) || (/(esposa|mulher)/.test(blob) && /(avaliar|ver|retorno|retornar)/.test(blob))) {
    return `você tinha ficado de avaliar ${produto} com sua esposa e me retornar`;
  }
  if (materialJaFoiEnviadoDepoisDoPedido({ diagnostico, raw })) {
    const compromisso = raw?._ordemMaterial?.compromissoClienteAposMaterial || "avaliar o material enviado";
    return `você tinha ficado de ${compromisso} depois do material ${produtoComDe(produto)}`;
  }
  if (/(foto|fotos|imagem|imagens)/.test(blob)) return `ficou em aberto o envio ou a avaliação das fotos ${produtoComDe(produto)}`;
  if (/(planta|plantas)/.test(blob)) return `ficou em aberto a avaliação das plantas ${produtoComDe(produto)}`;
  if (/(valor|pre[cç]o|condi[cç][aã]o|parcel|entrada|financi)/.test(blob)) return `ficou em aberto a análise de valores e condição ${produtoComDe(produto)}`;
  if (/(visita|conhecer|olhar|ver no local)/.test(blob)) return `ficou em aberto a possibilidade de conhecer ${produto}`;
  if (/(retorno|retornar|me dar um retorno|dar retorno)/.test(blob)) return `você tinha ficado de me dar um retorno sobre ${produto}`;
  return ultimo && !/^não houve/i.test(ultimo) ? ultimo : `ficou em aberto a avaliação de vocês sobre ${produto}`;
}


function materialJaFoiEnviadoDepoisDoPedido({ diagnostico = {}, raw = {} } = {}) {
  if (raw?._ordemMaterial?.materialJaEnviadoDepois === true) return true;
  const blob = JSON.stringify({ diagnostico, raw }).toLowerCase();
  return /materialjaenviadodepois"\s*:\s*true|material.*j[aá]\s+foi\s+enviado|j[aá]\s+encaminh(ei|ado)|te\s+encaminhei\s+(o\s+)?(v[ií]deo|material|fotos?)/.test(blob);
}
function mensagemFalaComoSeMaterialAindaFosseEnviar(txt = "") {
  const s = String(txt || "").toLowerCase();
  return /\b(seguem?|estou\s+enviando|vou\s+enviar|vou\s+te\s+enviar|vou\s+te\s+mandar|posso\s+(separar|enviar|mandar|te\s+mandar)\s+(as\s+)?(fotos?|imagens?|v[ií]deo|material)|estou\s+mandando)\b/.test(s);
}
function tipoMaterialJaEnviado(raw = {}) {
  const blob = JSON.stringify(raw?._ordemMaterial || raw || {}).toLowerCase();
  if (/v[ií]deo|video|\.mp4/.test(blob)) return "vídeo";
  if (/planta|plantas/.test(blob)) return "plantas";
  if (/valor|pre[cç]o|condi[cç][aã]o/.test(blob)) return "informações";
  return "material";
}
function mensagensFallbackMaterialJaEnviado({ lead = {}, diagnostico = {}, raw = {} }) {
  const nome = primeiraPalavraNome(lead);
  const produto = produtoCurtoParaMensagem(diagnostico.produtoAtual || diagnostico.produtoPrincipal || raw.produtoInteresse || lead?.product || "essa opção", "essa opção");
  const prefixo = nome ? `${nome}, ` : "";
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  const material = tipoMaterialJaEnviado(raw);
  const conjuge = /(esposo|marido)/.test(blob) ? "seu esposo" : (/(esposa|mulher)/.test(blob) ? "sua esposa" : "vocês");
  const buscaTamanho = /100|110|132|m²|m2|metros|metragem|tamanho|amplo/.test(blob);
  const pronto = produtoEhProntoParaMorar(produto, blob);
  const naPlanta = produtoEhNaPlantaOuLancamento(produto, blob);
  if (naPlanta && !pronto) {
    return [
      sanitizarMensagemFallback(`${prefixo}te encaminhei o ${material} ${produtoComDe(produto)} para vocês avaliarem com calma. Como ficou de olhar com ${conjuge}, queria retomar esse ponto: vale eu separar plantas, posição e condição para comparar melhor?`),
      sanitizarMensagemFallback(`${prefixo}para facilitar a avaliação depois do material enviado, posso organizar as opções ${produtoComDe(produto)} por planta, posição, prazo e condição. Quer que eu te mande essa visão mais objetiva?`),
      sanitizarMensagemFallback(`${prefixo}ficou em aberto o retorno depois do material ${produtoComDe(produto)}. Posso retomar pelo que pesa mais para vocês agora: planta, prazo, posição ou condição?`)
    ];
  }
  const encaixe = buscaTamanho ? "Como vocês procuram algo com bom tamanho e pronto para morar, essa opção encaixa bem no que comentaram" : "Como ele já está pronto, a visita ajuda a avaliar melhor tamanho, posição e acabamento";
  return [
    sanitizarMensagemFallback(`${prefixo}te encaminhei o ${material} ${produtoComDe(produto)} para vocês avaliarem com calma. Como você comentou que iria ver com ${conjuge} e me retornar, queria retomar esse ponto: acham que vale conhecer pessoalmente?`),
    sanitizarMensagemFallback(`${prefixo}para facilitar a avaliação de vocês depois do material enviado, posso resumir metragem, posição, móveis planejados, valor e possibilidade de financiamento. Quer que eu te mande esse resumo?`),
    sanitizarMensagemFallback(`${prefixo}ficou em aberto aquele retorno depois de vocês avaliarem ${produto}. ${encaixe}. Posso te passar alguns horários para visita?`)
  ];
}

function ganchoDirecionamento({ blob = "", produto = "essa opção", tipo = "pronto" }) {
  const b = String(blob || "").toLowerCase();
  if (/100|110|132|m²|m2|metros|metragem|tamanho|amplo/.test(b)) return "Pelo tamanho que vocês comentaram";
  if (/foto|fotos|imagem|imagens/.test(b)) return "Pelas fotos e detalhes que ficaram de avaliar";
  if (/planta|plantas/.test(b)) return "Pelas plantas e opções que vocês ficaram de avaliar";
  if (/valor|pre[cç]o|condi[cç][aã]o|parcel|entrada|financi/.test(b)) return "Pela condição e valores que ficaram para analisar";
  if (/localiza[cç][aã]o|posição|posi[cç][aã]o|andar|vista/.test(b)) return "Pela localização e posição que pesam na decisão";
  if (tipo === "terreno") return "Pela posição, acesso e tamanho dos lotes";
  if (tipo === "comercial") return "Pela metragem, posição e fluxo da região";
  if (tipo === "planta") return "Por ser uma decisão de planta, prazo e condição";
  return "Pelo que vocês comentaram na conversa";
}


function produtoEhProntoParaMorar(produto, blob = "") {
  const p = String(produto || "").toLowerCase();
  const b = String(blob || "").toLowerCase();
  // O status explícito do produto vence qualquer texto confuso que a IA tenha escrito.
  if (/renaissance|premium\s+office|nova\s+vila\s+rica|nvr|loteamento|terreno|evolutti|boulevard/.test(p)) return false;
  if (/personalit[eé]|quality|prime/.test(p)) return true;
  return /pronto\s+para\s+morar|semimobiliad|m[oó]veis\s+planejados|financiado\s+em\s+qualquer\s+banco/.test(b)
    && !/renaissance|premium\s+office|nova\s+vila\s+rica|nvr|loteamento|terreno|evolutti|boulevard/.test(b);
}

function produtoEhNaPlantaOuLancamento(produto, blob = "") {
  const p = String(produto || "").toLowerCase();
  const b = String(blob || "").toLowerCase();
  return /renaissance|premium\s+office|evolutti|boulevard|lan[cç]amento|pr[eé][ -]?lan[cç]amento|na\s+planta|em\s+obra|entrega\s+futura|entrega\s+202/.test(`${p} ${b}`);
}

function produtoEhTerrenoOuLoteamento(produto, blob = "") {
  return /nova\s+vila\s+rica|nvr|loteamento|terreno|\blote\b/.test(`${String(produto || "")} ${String(blob || "")}`.toLowerCase());
}

function produtoEhComercial(produto, blob = "") {
  return /premium\s+office|sala\s+comercial|comercial/.test(`${String(produto || "")} ${String(blob || "")}`.toLowerCase());
}

function mensagensFallbackDirecionamentoCorretor({ lead = {}, diagnostico = {}, raw = {} }) {
  const nome = primeiraPalavraNome(lead);
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  const produto = produtoCurtoParaMensagem(diagnostico.produtoAtual || diagnostico.produtoPrincipal || raw.produtoInteresse || lead?.product || "essa opção", "essa opção");
  const prefixo = nome ? `${nome}, ` : "";
  const compromisso = compromissoDirecionamentoTexto({ diagnostico, raw, produto });

  const pronto = produtoEhProntoParaMorar(produto, blob);
  const terreno = produtoEhTerrenoOuLoteamento(produto, blob);
  const comercial = produtoEhComercial(produto, blob);
  const naPlanta = produtoEhNaPlantaOuLancamento(produto, blob);

  if (materialJaFoiEnviadoDepoisDoPedido({ diagnostico, raw })) {
    return mensagensFallbackMaterialJaEnviado({ lead, diagnostico, raw });
  }

  if (terreno) {
    return [
      sanitizarMensagemFallback(`${prefixo}retomando nosso contato: ${compromisso}. ${ganchoDirecionamento({ blob, produto, tipo: "terreno" })}, posso separar as opções disponíveis para vocês avaliarem com calma. Para vocês fica melhor ver isso durante a semana ou no sábado?`),
      sanitizarMensagemFallback(`${prefixo}para facilitar, posso destacar os lotes disponíveis conforme o que ficou mais importante para vocês: posição, acesso ou condição. Quer que eu organize essa visão antes da visita?`),
      sanitizarMensagemFallback(`${prefixo}ficou esse ponto do loteamento em aberto desde a última conversa. Posso te passar as opções disponíveis e alguns horários para vocês conhecerem o local?`)
    ];
  }

  if (comercial) {
    return [
      sanitizarMensagemFallback(`${prefixo}retomando nosso contato: ${compromisso}. ${ganchoDirecionamento({ blob, produto, tipo: "comercial" })}, posso te passar as opções disponíveis e organizar uma conversa rápida sobre isso?`),
      sanitizarMensagemFallback(`${prefixo}para facilitar a avaliação, posso separar as salas por metragem, posição e valor. Assim fica mais simples comparar sem voltar a conversa do zero. Quer que eu organize isso?`),
      sanitizarMensagemFallback(`${prefixo}ficou esse ponto comercial em aberto. Posso te enviar um resumo com as salas disponíveis e os melhores caminhos de condição para avaliar?`)
    ];
  }

  if (naPlanta && !pronto) {
    return [
      sanitizarMensagemFallback(`${prefixo}retomando nosso contato: ${compromisso}. ${ganchoDirecionamento({ blob, produto, tipo: "planta" })}, posso separar uma visão objetiva com plantas, posição, prazo e condição. Quer que eu organize isso para vocês?`),
      sanitizarMensagemFallback(`${prefixo}para facilitar a avaliação, posso montar um comparativo mais direto ${produtoComDe(produto)} com as opções que melhor encaixam no que vocês pediram. Prefere olhar primeiro plantas ou condição?`),
      sanitizarMensagemFallback(`${prefixo}ficou esse ponto ${produtoComDe(produto)} em aberto. Posso retomar pelo que pesa mais para vocês agora: planta, prazo, posição ou condição?`)
    ];
  }

  const encaixe = ganchoDirecionamento({ blob, produto, tipo: "pronto" });

  return [
    sanitizarMensagemFallback(`${prefixo}retomando nosso contato: ${compromisso}. ${encaixe}, a visita ajuda a avaliar o imóvel com mais segurança. Para vocês fica melhor durante a semana ou no sábado?`),
    sanitizarMensagemFallback(`${prefixo}para facilitar a avaliação, posso separar as fotos principais ${produtoComDe(produto)} e também alguns pontos de tamanho, posição e condição. Quer que eu organize isso para vocês antes da visita?`),
    sanitizarMensagemFallback(`${prefixo}ficou esse ponto ${produtoComDe(produto)} em aberto desde a última conversa. Posso te passar alguns horários para vocês conhecerem e avaliarem com calma?`)
  ];
}

function mensagemPareceMudancaJornadaIndevida(txt) {
  const s = String(txt || "").toLowerCase();
  return /agora\s+voc[eê]\s+(me chamou|pediu|olhou)|saiu\s+(da|do|de)|mudou\s+de\s+interesse|antes\s+fal[aá]vamos.*agora/.test(s)
    && /renaissance/.test(s) && /personali/.test(s);
}

function mensagemQueApagouRetomadaOuVirouPropaganda(txt) {
  const s = String(txt || "").toLowerCase();
  if (mensagemComVocativoInvalido(txt)) return true;
  if (/vi\s+que\s+agora\s+voc[eê]\s+est[aá]\s+olhando/.test(s)) return true;
  if (/esse\s+(apartamento|im[oó]vel).*realmente\s+diferenciado|um\s+dos\s+melhores\s+empreendimentos|excelente\s+oportunidade|empreendimento\s+único|empreendimento\s+unico/.test(s)) return true;
  if (/\b(coisa|op[cç][aã]o)\s+solta\b|mandar\s+qualquer\s+coisa/.test(s)) return true;
  if (/sala comercial no premium office|apartamento no edif[ií]cio personalit/.test(s)) return true;
  return false;
}

function mensagemPrecisaFallbackDirecionamento(txt, { diagnostico = {}, raw = {}, lead = {} } = {}) {
  const s = String(txt || "").toLowerCase();
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  if (!s.trim()) return true;
  if (mensagemComVocativoInvalido(txt) || mensagemFormatoRuim(txt)) return true;
  if (mensagemPareceMudancaJornadaIndevida(txt)) return true;
  if (/ainda tem interesse|segue interessado|faz sentido|qualquer dúvida|fico à disposição|passando para saber|passando para retomar/.test(s)) return true;
  if (materialJaFoiEnviadoDepoisDoPedido({ diagnostico, raw }) && mensagemFalaComoSeMaterialAindaFosseEnviar(txt)) return true;

  const falaPronto = /já está pronto|ja está pronto|pronto para morar|visita rápida no apartamento|ver melhor tamanho, móveis|m[oó]veis e posição|acabamento, tamanho e posição/.test(s);
  if (/renaissance/.test(blob) && falaPronto) return true;
  if (/premium\s+office|sala\s+comercial/.test(blob) && /apartamento|pronto para morar|m[oó]veis/.test(s)) return true;
  if (/nova\s+vila\s+rica|loteamento|terreno|\blote\b/.test(blob) && /apartamento|m[oó]veis|acabamento interno/.test(s)) return true;

  // Não derruba mensagens boas só por serem diferentes do fallback.
  // O fallback agora é rede de segurança, não motor principal das sugestões.
  return false;
}

function mensagemTemRetomadaOuMudancaComHistorico(txt) {
  return /retomando|nosso contato|nossa conversa|antes\s+(fal[aá]vamos|voc[eê]\s+tinha|conversamos)|saiu\s+de|mudou\s+de|voltou\s+por|agora\s+voc[eê]\s+me\s+chamou/i.test(String(txt || ""));
}

function cenarioPrioritarioComercial({ diagnostico = {}, raw = {}, lead = {} } = {}) {
  // v746: uma única hierarquia para evitar regras competindo.
  // A primeira condição aplicável define o cenário principal; as demais só servem
  // como segurança final, não como motor para reescrever tudo.
  if (diagnosticoIndicaCompromissoCorretorNaoCumprido({ diagnostico, raw, lead })) return "compromisso-corretor";
  if (materialJaFoiEnviadoDepoisDoPedido({ diagnostico, raw })) return "material-ja-enviado";
  if (contextoPerguntasRespondidas({ diagnostico, raw, lead }).ativo) return "perguntas-respondidas";
  if (diagnosticoIndicaDirecionamentoCorretor({ diagnostico, raw, lead })) return "direcionamento-corretor";
  if (diagnosticoIndicaMudancaComRetomada({ diagnostico, raw, lead })) return "mudanca-jornada";
  const blob = JSON.stringify({ diagnostico, raw, lead }).toLowerCase();
  if (/tempo parado|conversa parada|retomada|retomando|dias|semanas|meses/.test(blob)) return "retomada-contextual";
  return "avanco-natural";
}

function labelsMensagensParaContexto({ diagnostico = {}, raw = {}, lead = {} }) {
  return { aLabel: "Recomendada", bLabel: "Alternativa", cLabel: "Direta ao ponto" };
}

export function completarMensagensComFallback({ mensagensRaw = {}, diagnostico = {}, raw = {}, lead = {} }) {
  // v748: sem fallback comercial. Não inventa produto, unidade, simulação ou próximo passo.
  const pick = (...vals) => vals.map(v => String(v || "").replace(/\s+/g, " ").trim()).find(Boolean) || "";
  const limpar = (txt) => limparVocativoInvalido(String(txt || "").replace(/\s+/g, " ").trim(), lead);
  const a = limpar(pick(mensagensRaw.recomendada, mensagensRaw.a));
  const b = limpar(pick(mensagensRaw.maisSuave, mensagensRaw.suave, mensagensRaw.b));
  const c = limpar(pick(mensagensRaw.maisDireta, mensagensRaw.direta, mensagensRaw.c));
  return { a, b, c, fallbackUsado: false };
}

function primeiraPalavraNome(lead) {
  const fontes = [lead?.clientName, lead?.nomeCliente, lead?.contactName, lead?.name, lead?.title]
    .filter(Boolean)
    .map(v => String(v).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  let bruto = fontes.find(v => v && !/^conversa\s+do\s+whatsapp\b/i.test(v) && !/^(conversa|whatsapp|cliente|lead|contato|arquivo|zip)$/i.test(v)) || fontes[0] || "";
  const extraido = fontes.map(v => {
    const m = v.match(/conversa\s+do\s+whatsapp\s+com\s+(.+?)(?:\.(zip|txt)|$)/i);
    return m ? m[1].trim() : "";
  }).find(Boolean);
  if (extraido) bruto = extraido;
  const limpo = bruto
    .replace(/\.(zip|txt)$/i, "")
    .replace(/\b(renaissance|premium\s+office|personalit[eé]|nvr\s*iii|nova\s+vila\s+rica\s*iii|evolutti|quality|boulevard)\b.*$/i, "")
    .replace(/\b(corretor|corretora|imobili[áa]ria|im[oó]veis|creci|cliente|lead)\b.*$/i, "")
    .trim();
  const primeiro = (limpo.split(/\s+/)[0] || "").trim();
  if (!primeiro || /^(conversa|whatsapp|cliente|lead|contato|arquivo|zip)$/i.test(primeiro)) return "";
  return primeiro;
}

function mensagemFormatoRuim(txt) {
  const s = String(txt || "").trim();
  if (!s) return true;
  if (/^[,.;:!?\-–—]/.test(s)) return true;
  if (/^\W+$/.test(s)) return true;
  return false;
}

// v724-2: bloco antigo de análise/mensagem removido.


export function __testarValidacaoMensagensComerciais(input = {}) {
  return { ok: true, corrigido: false, issues: [], mensagens: input?.mensagens || {}, labels: input?.labels || {}, recomendada: input?.mensagens?.recomendada || "a" };
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

export function normalizarModeloComercial(parsed, lead, timeline, corretorNome) {
  // v724-2: reset total. Mantida apenas por compatibilidade com APIs antigas; não altera análise.
  return parsed;
}

export function finalizarAnaliseComercial(parsed = {}, lead = {}, timeline = [], corretorNome = "Sanchai") {
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
  const products = ["Renaissance", "Evolutti", "Boulevard", "Terrenos", "Premium Office", "Quality", "Personalité", "Personalite", "Prime"];
  const found = products.find(p => normalizeComparable(fullText).includes(normalizeComparable(p)));
  if (!found) return "Não identificado";
  return found === "Personalite" ? "Personalité" : found;
}

function pickClientName(authors = []) {
  // Profissões como "Corretor" e "Imobiliária" podem fazer parte do nome do contato parceiro.
  // Excluímos apenas autores conhecidos como lado da empresa/corretor deste app.
  const businessHints = /(senger|construtora|direciona|atendimento|sanchai|miguel\s+kirinus)/i;
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
// Cérebro com os leads que JÁ estão no Corretor Pro — sem reanalisar o lead inteiro. Prompt curto e
// focado, mesma forma que o campo inteligenciaObservada da análise. Retorna {} se não der pra extrair.
export async function extrairInteligenciaObservada(timelineText, openai) {
  if (!timelineText || timelineText.trim().length < 40) return {};
  // Lê até ~1.800 PALAVRAS — pega o essencial da conversa e mantém a chamada CURTA (3-5s), pra o
  // request voltar rápido e nunca pendurar/cair.
  const textoConversa = String(timelineText).split(/\s+/).slice(0, 1800).join(" ");
  const prompt = `Você vai LER E ENTENDER uma conversa INTEIRA de WhatsApp entre um CORRETOR da Construtora Senger (Carazinho/RS) e um cliente — TUDO que aconteceu: as PERGUNTAS, dúvidas e situações do CLIENTE e as RESPOSTAS e a condução do CORRETOR. Leia os dois lados, do começo ao fim, e entenda o que rolou.

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

// v724-2: regeneração antiga por segunda IA removida.


// v724-2: geração antiga de três mensagens removida.


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
      nextAction: "A análise ainda não foi configurada no servidor. Sem ela, o Corretor Pro não consegue analisar a conversa nem gerar mensagens.",
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
  // (manuais/sistema antigo) são SEMPRE mantidas — são fatos confirmados do que já aconteceu.
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
  // v748: análise sem prompt comercial, sem catálogo, sem Cérebro, sem regras persistentes,
  // sem nextAction/diagnóstico antigo. A conversa bruta é a única fonte comercial.
  const hoje = new Date().toISOString().slice(0, 10);
  const configCerebro = await loadCerebroConfig().catch(() => null);
  const corretorNome = String(configCerebro?.corretorNome || lead?.corretorNome || lead?.brokerName || "Sanchai").trim() || "Sanchai";
  // v752: metadados mínimos e seguros. Nunca enviar produto, unidade, nextAction ou análise salva.
  const leadIA = {
    nomeArquivo: String(lead?.fileName || lead?.filename || lead?.txtFile || "").slice(0, 180),
    nomeContato: String(lead?.clientName || lead?.name || lead?.nome || "").slice(0, 120),
    telefone: String(lead?.phone || lead?.telefone || "").slice(0, 40)
  };
  const prompt = `Retorne somente JSON válido. Analise a conversa de WhatsApp abaixo e gere um diagnóstico comercial e 3 sugestões de mensagem para o corretor enviar ao cliente. Não use informações externas nem análises antigas. Se algo não estiver claro, escreva "Não identificado".

Data atual: ${hoje}
Corretor: ${corretorNome}

Formato obrigatório:
{
  "summary":"resumo curto da conversa",
  "diagnostico":{
    "ultimaPessoaFalar":"Você|Cliente|Não identificado",
    "ultimoCompromissoCliente":"texto curto",
    "ultimaInformacaoPrometida":"texto curto",
    "compromissoCorretorNaoCumprido":"texto curto",
    "produtoPrincipal":"texto curto",
    "produtosParalelos":"texto curto",
    "objecaoPrincipal":"texto curto",
    "pendenciaFinanceira":"texto curto",
    "quemDeveAgirAgora":"texto curto",
    "etapaFunil":"texto curto",
    "probabilidadeVenda":"texto curto",
    "mensagemQueEuEnviariaHoje":"mensagem pronta"
  },
  "mensagens":{
    "recomendada":"mensagem pronta",
    "maisSuave":"mensagem pronta",
    "maisDireta":"mensagem pronta"
  },
  "produtoInteresse":"texto curto",
  "produtosInteresse":["..."],
  "etapaSugerida":"texto curto",
  "probability":"texto curto",
  "probabilityPercent":50,
  "clientProfile":"texto curto",
  "nextAction":"texto curto"
}

METADADOS DO LEAD, somente identificação:
${JSON.stringify(leadIA)}

CONVERSA COMPLETA:
${timelineText}`;
  try {
    const { parsed: parsedRaw, response: completion } = await chamarGPT4Json({
      openai,
      prompt,
      // v724-4: a v724-2 uniu diagnóstico + as 3 mensagens numa única chamada
      // ("sem segunda IA"), mas manteve o teto de tokens que só bastava pro
      // diagnóstico sozinho. Num lead com histórico real, o JSON (resumo +
      // diagnóstico inteiro + 3 mensagens completas de WhatsApp) passava de
      // 4096 tokens, cortava no meio, o JSON.parse falhava e a análise caía
      // em modo de erro — reaproveitando pra sempre a análise antiga (sem
      // mensagens), não importava quantas vezes reanalisasse.
      maxOutputTokens: 8192,
      timeout: 32000
    });

    const rawBase = (parsedRaw && typeof parsedRaw === "object") ? parsedRaw : {};
    const raw = { ...rawBase, _timelineText: timelineText };
    const d = (raw.diagnostico && typeof raw.diagnostico === "object") ? raw.diagnostico : {};
    const arr = (v) => Array.isArray(v) ? v.filter(Boolean).map(x => String(x).trim()).filter(Boolean) : [];
    const txt = (v, fb = "") => String(v ?? fb ?? "").replace(/\s+/g, " ").trim();
    const clamp = (n) => Number.isFinite(Number(n)) ? Math.max(0, Math.min(100, Math.round(Number(n)))) : null;
    const mensagensRaw = (raw.mensagens && typeof raw.mensagens === "object") ? raw.mensagens : {};
    const trioMensagens = completarMensagensComFallback({ mensagensRaw, diagnostico: d, raw, lead: leadIA });
    const msgA = trioMensagens.a;
    const msgB = trioMensagens.b;
    const msgC = trioMensagens.c;
    const msg = msgA;
    const labelsMensagens = labelsMensagensParaContexto({ diagnostico: d, raw, lead: leadIA });
    const produtoAtual = txt(raw.produtoInteresse || d.produtoPrincipal || d.produtoAtual || lead?.product, "Não identificado");
    const corrigirUnidade = (v, fb = "") => txt(v, fb);
    const probPct = clamp(raw.probabilityPercent);

    // v724-2: objeto final deliberadamente simples.
    // O código NÃO reescreve análise, NÃO regenera mensagens, NÃO injeta leitura comercial,
    // NÃO monta tese, NÃO aplica bloqueios comerciais e NÃO chama uma segunda IA.
    const parsed = {
      mode: "openai",
      summary: txt(raw.summary),
      diagnostico: {
        ultimaPessoaFalar: txt(d.ultimaPessoaFalar, "Não identificado"),
        ultimoCompromissoCliente: txt(d.ultimoCompromissoCliente, "Não houve compromisso claro do cliente."),
        ultimaInformacaoEnviada: txt(d.ultimaInformacaoEnviada || d.ultimaInformacaoPrometida, "Não houve informação prometida pelo corretor."),
        ultimaInformacaoPrometida: txt(d.ultimaInformacaoPrometida || d.ultimaInformacaoEnviada, "Não houve informação prometida pelo corretor."),
        compromissoCorretorNaoCumprido: txt(d.compromissoCorretorNaoCumprido, "não"),
        acaoPrometidaPeloCorretor: txt(d.acaoPrometidaPeloCorretor, "nenhuma"),
        clienteJaAutorizouAcao: txt(d.clienteJaAutorizouAcao, "não"),
        produtoAtual,
        produtoPrincipalInteresse: produtoAtual,
        interesseAnterior: txt(d.interesseAnterior, "Nenhum"),
        produtosParalelos: txt(d.produtosParalelos, "Não houve produtos paralelos relevantes."),
        objecaoIdentificada: txt(d.objecaoIdentificada || d.objecaoPrincipal, "Sem objeção explícita."),
        objecaoPrincipal: txt(d.objecaoPrincipal || d.objecaoIdentificada, "Sem objeção explícita."),
        pendenciaPrincipal: corrigirUnidade(d.pendenciaPrincipal || d.pendenciaFinanceira, "Não identificada"),
        pendenciaFinanceira: txt(d.pendenciaFinanceira, "Não há pendência financeira."),
        quemDeveAgirAgora: txt(d.quemDeveAgirAgora || d.proximoPasso, "Corretor"),
        proximoPasso: corrigirUnidade(d.proximoPasso || d.quemDeveAgirAgora, "Corretor"),
        proximoPassoDeQuem: corrigirUnidade(d.proximoPasso || d.quemDeveAgirAgora, "Corretor"),
        etapaFunil: txt(d.etapaFunil || raw.etapaSugerida, "Interesse / Descoberta de necessidade"),
        probabilidadeComentada: txt(d.probabilidadeVenda || d.probabilidadeComentada || d.probabilidadeFechamentoHoje || raw.probability, "Não identificada"),
        probabilidadeFechamentoHoje: txt(d.probabilidadeVenda || d.probabilidadeComentada || d.probabilidadeFechamentoHoje || raw.probability, "Não identificada"),
        tempoParado: txt(d.tempoParado, "Não identificado"),
        // v724-5: só preenche quando as 3 mensagens existem. Deixar isto com a
        // mensagem A sozinha (quando B/C vieram vazias) engana o front: ele usa
        // este campo pra decidir se "já existe mensagem real da IA" e, achando
        // que sim, desliga o fallback de B/C — só que messages.a/b/c são
        // zerados logo abaixo (garantirMensagensMotorComercialV714) quando o
        // trio não está completo. Resultado: a seção inteira fica escondida
        // ("Mensagem ainda não gerada") apesar da mensagem A existir aqui.
        mensagemQueEuEnviariaHoje: msg,
        percepcaoTodaConversa: txt(raw.summary)
      },
      oQueFaltaDescobrir: arr(raw.oQueFaltaDescobrir),
      estrategiaMensagem: corrigirUnidade(raw.estrategiaMensagem),
      prioridadeLead: txt(raw.prioridadeLead),
      produtoInteresse: produtoAtual,
      produtosInteresse: arr(raw.produtosInteresse).length ? arr(raw.produtosInteresse) : (produtoAtual && produtoAtual !== "Não identificado" ? [produtoAtual] : []),
      etapaSugerida: txt(raw.etapaSugerida || d.etapaFunil, "descoberta"),
      probability: txt(raw.probability, probPct != null ? `${probPct}%` : "média"),
      probabilityPercent: probPct,
      clientProfile: txt(raw.clientProfile),
      nextAction: corrigirUnidade(raw.nextAction || d.pendenciaPrincipal || raw.estrategiaMensagem),
      messages: {
        a: msgA,
        b: msgB,
        c: msgC,
        aLabel: labelsMensagens.aLabel,
        bLabel: labelsMensagens.bLabel,
        cLabel: labelsMensagens.cLabel,
        recomendada: "a"
      },
      tipoContato: null,
      confianca: 0,
      permuta: false,
      permutaResumo: "",
      bestTime: "",
      confirmedAppointments: [],
      objections: [],
      risk: "",
      concorrencia: null,
      tipoRetomada: "morno-confirmar",
      memoriaSugerida: null,
      inteligenciaObservada: null,
      materiais: [],
      lembreteSugerido: null,
      leituraComercial: null,
      mudancas: [],
      modeloComercial: null,
      raciocinioComercial: null,
      estrategia: corrigirUnidade(raw.estrategiaMensagem),
      arquiteturaMensagens: ARQUITETURA_MENSAGENS_ATUAL,
      modeloMensagens: modeloAnalise(),
      _modelo: completion?.model || modeloAnalise(),
      _modeloMensagens: null,
      sugestoesPendentes: false,
      validacaoSugestoes: [],
      mensagensValidadasEm: new Date().toISOString(),
      melhorHorarioContato: calcularMelhorHorario(timeline, lead?.clientName)
    };

    return parsed;
  } catch (error) {
    const detail = describeOpenAIError(error);
    const isQuota = /quota|insufficient|429|billing/i.test(detail);
    const motivo = isQuota
      ? "O provedor de análise está sem saldo/limite agora. Tente reanalisar novamente; se persistir, confira o Diagnóstico."
      : "O Corretor Pro não conseguiu analisar agora. Toque em Reanalisar daqui a alguns minutos.";
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
    probabilityPercent: a.probabilityPercent ?? null,
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
    audiosReaproveitados = 0, audiosNovosSolicitados = 0
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
  analysis = await analyzeWithBrain({ lead, timeline, openai, leadId: existingLeadId });

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

