import { resolveOrganizationId, _buscarProcessamentoExistenteV681 } from "./_persistence.js";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  prepararConversaDoZip,
  transcreverArquivosExtraidos,
  finalizarAnaliseDaConversa,
  normalizeName,
  verificarLimiteTranscricaoImport,
  registrarConsumoTranscricaoImport,
  lerArquivosVisuais,
  lerLinksDaConversa,
  verificarLimiteLeituraVisual,
  registrarConsumoLeituraVisual
} from "./_pipeline.js";

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

function importIdSeguro(value = "") {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,120}$/.test(id)) return "";
  return id;
}

// ---------- criar URL de upload grande (antigo api/criar-upload-url.js) ----------
// v1039 — o plano Hobby da Vercel só permite 12 Serverless Functions; esta rota passou a
// acumular também a criação da URL assinada de upload (ver NOTAS-v1039.md). O app continua
// chamando exatamente a mesma URL (/api/criar-upload-url) — vercel.json redireciona pra este
// arquivo. Distingue pela AUSÊNCIA do campo "action" (as ações desta rota sempre mandam
// "action"; a criação de URL de upload nunca mandou esse campo) — ver dispatch no handler().
const DEFAULT_MAX_ZIP_BYTES = 150 * 1024 * 1024;
const CONFIGURED_MAX_ZIP_BYTES = Number(process.env.SUPABASE_ZIP_MAX_BYTES);
const BUCKET_MAX_BYTES = Number.isFinite(CONFIGURED_MAX_ZIP_BYTES) && CONFIGURED_MAX_ZIP_BYTES > 0
  ? Math.min(CONFIGURED_MAX_ZIP_BYTES, 300 * 1024 * 1024)
  : DEFAULT_MAX_ZIP_BYTES;
const ALLOWED_ZIP_MIME_TYPES = [
  "application/zip", "application/x-zip-compressed", "application/octet-stream"
];

let bucketConfigured = false;

function errorMessage(value) {
  return value?.message || value?.error_description || value?.error || String(value || "Erro desconhecido");
}

function isMissingBucket(error) {
  const msg = errorMessage(error).toLowerCase();
  return error?.statusCode === "404" || error?.status === 404 || error?.code === "404" ||
    msg.includes("bucket not found") || msg.includes("not found") || msg.includes("does not exist");
}

async function createBucketWithFallback(supabase, bucket) {
  const attempts = [
    { public: false, fileSizeLimit: BUCKET_MAX_BYTES, allowedMimeTypes: ALLOWED_ZIP_MIME_TYPES },
    { public: false, allowedMimeTypes: ALLOWED_ZIP_MIME_TYPES },
    { public: false }
  ];

  const failures = [];
  for (const options of attempts) {
    try {
      const { error } = await supabase.storage.createBucket(bucket, options);
      if (!error) return { created: true, warning: failures[0] || null };

      const msg = errorMessage(error);
      // Outro processo/deploy pode ter criado o bucket entre o GET e o CREATE.
      if (/already exists|duplicate/i.test(msg)) return { created: false, warning: null };
      failures.push(msg);
    } catch (error) {
      failures.push(errorMessage(error));
    }
  }

  return { created: false, error: failures.filter(Boolean).join(" | ") || "Não foi possível criar o bucket." };
}

async function ensureBucketReady(supabase, bucket) {
  if (bucketConfigured) return { ok: true, existed: true, configured: true };

  let existed = false;
  try {
    const { data, error } = await supabase.storage.getBucket(bucket);
    if (!error && data) {
      existed = true;
    } else if (error && !isMissingBucket(error)) {
      return { ok: false, step: "consultar bucket", error: errorMessage(error) };
    }
  } catch (error) {
    return { ok: false, step: "consultar bucket", error: errorMessage(error) };
  }

  if (!existed) {
    const created = await createBucketWithFallback(supabase, bucket);
    if (created.error) {
      return { ok: false, step: "criar bucket", error: created.error };
    }
  }

  // A configuração do limite pode variar por plano do Supabase. Uma falha aqui vira aviso;
  // a autorização do upload continua protegida pelo limite validado acima.
  let warning = null;
  try {
    const { error } = await supabase.storage.updateBucket(bucket, {
      public: false,
      fileSizeLimit: BUCKET_MAX_BYTES,
      allowedMimeTypes: ALLOWED_ZIP_MIME_TYPES
    });
    if (error) warning = errorMessage(error);
  } catch (error) {
    warning = errorMessage(error);
  }

  bucketConfigured = true;
  return { ok: true, existed, configured: !warning, warning };
}

function sanitizeFileNameUpload(name = "conversa-whatsapp.zip") {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "conversa-whatsapp.zip";
}

async function criarUploadUrl(req, res, organizationId, body) {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = String(process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips").trim() || "whatsapp-zips";

  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, {
      ok: false,
      error: "Supabase ainda não configurado. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.",
      missing: { SUPABASE_URL: !!supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey }
    });
  }

  const fileName = sanitizeFileNameUpload(body?.fileName);
  const importId = importIdSeguro(body?.importId);
  if (!body?.probe && !importId) {
    return json(res, 400, { ok: false, error: "Identificador da importação não informado." });
  }
  if (!body?.probe && !/\.zip$/i.test(fileName)) {
    return json(res, 400, { ok: false, error: "Tipo de arquivo não suportado. Envie somente o ZIP exportado pelo WhatsApp." });
  }
  const declaredSize = Number(body?.size || 0);
  if (!body?.probe && (!Number.isFinite(declaredSize) || declaredSize <= 0)) {
    return json(res, 400, { ok: false, error: "Tamanho do ZIP não informado." });
  }
  if (!body?.probe && declaredSize > BUCKET_MAX_BYTES) {
    return json(res, 413, {
      ok: false,
      // v1270 — a recusa precisa dizer O QUE FAZER. A frase antiga ("ZIP maior que o limite
      // permitido de 150 MB.") deixava o corretor com um "Tentar novamente" que dava sempre o
      // mesmo erro. Desde a v1270 o próprio aparelho corta áudio antigo pra caber, então chegar
      // aqui virou exceção — quando chega, a saída é reexportar sem mídia.
      error: `Esta conversa passou do limite de ${Math.round(BUCKET_MAX_BYTES / 1024 / 1024)} MB por envio. No WhatsApp, exporte a conversa de novo escolhendo "Sem mídia" — o texto entra inteiro e a análise sai igual.`,
      maxBytes: BUCKET_MAX_BYTES
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const bucketState = await ensureBucketReady(supabase, bucket);
    if (!bucketState.ok) {
      return json(res, 500, {
        ok: false,
        error: `Não foi possível preparar o armazenamento “${bucket}”.`,
        details: `${bucketState.step}: ${bucketState.error}`,
        bucket
      });
    }

    if (body && body.probe) {
      return json(res, 200, { ok: true, bucket, bucketState });
    }

    // Caminho idempotente: retries da mesma importação usam o mesmo objeto, sem criar cópias.
    // organizationId no caminho isola o arquivo de cada conta dentro do mesmo bucket
    // compartilhado — sem isso, qualquer corretor com um importId adivinhado conseguiria
    // baixar/sobrescrever o ZIP de outra conta.
    const storagePathUpload = `whatsapp/organizations/${organizationId}/imports/${importId}/${fileName}`;

    const { data: signed, error: signedError } = await supabase
      .storage
      .from(bucket)
      .createSignedUploadUrl(storagePathUpload, { upsert: true });

    if (signedError || !signed?.signedUrl) {
      return json(res, 500, {
        ok: false,
        error: "Não foi possível gerar a URL de upload no Supabase Storage.",
        details: errorMessage(signedError || "createSignedUploadUrl não retornou signedUrl."),
        bucket,
        bucketWarning: bucketState.warning || null
      });
    }

    return json(res, 200, {
      ok: true,
      bucket,
      path: storagePathUpload,
      token: signed.token,
      signedUrl: signed.signedUrl,
      importId,
      bucketWarning: bucketState.warning || undefined
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: "Não foi possível preparar o upload grande.",
      details: errorMessage(error),
      bucket
    });
  }
}

function nomeStorageSeguro(value = "audio") {
  return String(value || "audio")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "audio";
}

function contentTypeAudio(name = "") {
  const ext = String(name).toLowerCase().split(".").pop();
  return ({ opus:"audio/opus", ogg:"audio/ogg", mp3:"audio/mpeg", m4a:"audio/mp4", wav:"audio/wav", aac:"audio/aac" })[ext] || "application/octet-stream";
}

// v1131 — roda `fn` sobre a lista com no máximo `limite` execuções ao mesmo tempo, preservando o
// índice de cada item (quem escreve o resultado é a própria `fn`, usando o índice que recebe).
// Mesmo desenho do pool que a transcrição já usa em _pipeline.js — repetido aqui, e não importado,
// porque aquele não é exportado e este arquivo é a única outra parte que precisa disso.
async function mapComLimiteParalelo(itens, limite, fn) {
  const lista = Array.isArray(itens) ? itens : [];
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < lista.length) {
      const indice = proximo++;
      await fn(lista[indice], indice);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limite, lista.length)) }, trabalhador));
}

async function baixarBuffer(storage, storagePath) {
  const { data: blob, error } = await storage.download(storagePath);
  if (error || !blob) {
    const e = new Error(error?.message || "Download retornou vazio.");
    e._download = true;
    throw e;
  }
  return Buffer.from(await blob.arrayBuffer());
}

async function carregarManifesto(storage, manifestPath) {
  try {
    const buffer = await baixarBuffer(storage, manifestPath);
    const parsed = JSON.parse(buffer.toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) { return null; }
}

function hashAudio(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

// organizationId no caminho garante que o cache de transcrição de uma conta nunca seja lido
// (nem apagado) por outra — antes disso era uma pasta única global no bucket.
function caminhoCacheTranscricao(hash, organizationId) {
  return `organizations/${organizationId}/transcription-cache/${String(hash || "").slice(0, 2)}/${hash}.json`;
}

async function carregarTranscricaoCache(storage, hash, organizationId) {
  if (!hash || !organizationId) return null;
  const item = await carregarManifesto(storage, caminhoCacheTranscricao(hash, organizationId));
  return item?.text ? { status: "transcrito_reaproveitado", text: String(item.text), reused: true, hash } : null;
}

async function salvarTranscricaoCache(storage, hash, item, organizationId) {
  if (!hash || !item?.text || !organizationId) return;
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    hash,
    text: String(item.text),
    createdAt: new Date().toISOString()
  }), "utf8");
  const { error } = await storage.upload(caminhoCacheTranscricao(hash, organizationId), payload, {
    contentType: "application/octet-stream",
    upsert: true,
    cacheControl: "31536000"
  });
  if (error) throw new Error(`Não consegui guardar a transcrição reaproveitável: ${error.message}`);
}

// Reaproveitamento de transcrição — por que NÃO comparar o áudio pelo hash de conteúdo entre
// importações diferentes: o WhatsApp não garante bytes idênticos entre duas exportações da
// MESMA conversa (mesmo áudio, arquivo ligeiramente diferente por dentro) — na prática o hash
// quase nunca bate entre importações separadas, então "audiosReaproveitados" ficava sempre 0 e
// todo áudio já transcrito antes era pago e transcrito de novo a cada reimportação. O nome do
// arquivo de áudio (ex.: AUD-20240115-WA0007.opus), por outro lado, é estável entre exportações
// — mas só é seguro comparar DENTRO do histórico do MESMO cliente já identificado, nunca contra
// outros clientes (nome de arquivo sozinho pode repetir entre conversas diferentes).
// v1143 — teto de mensagens pra a análise sair na MESMA chamada do preparar (ver ação "preparar").
// A extração de uma conversa desse tamanho leva menos de 1s, então ela cabe junto da análise
// dentro dos 60s da função. Acima disso, as duas etapas continuam separadas como sempre foram.
const ANALISE_JUNTA_MAX_MENSAGENS = Number(process.env.CORRETOR_PRO_ANALISE_JUNTA_MAX_MENSAGENS) > 0
  ? Number(process.env.CORRETOR_PRO_ANALISE_JUNTA_MAX_MENSAGENS)
  : 400;

const AUDIO_TRANSCRITO_PREFIXO = "[Áudio transcrito] ";

// v1026 — "0 aproveitados" voltava a acontecer num lead recorrente MESMO com este reaproveitamento
// por nome de arquivo já existente (v954): na 1ª reimportação que reaproveitava com sucesso, o
// áudio reaproveitado virava status "transcrito_reaproveitado" na timeline (não mais "transcrito")
// — e esta função só aceitava o status "transcrito" exato. Resultado: a partir da 2ª reimportação
// de um mesmo lead recorrente, todo áudio já tinha virado "transcrito_reaproveitado" e nenhum era
// mais reconhecido como reaproveitável, mesmo com o texto certinho disponível na conversa. O que
// importa é ter o TEXTO transcrito de verdade (o prefixo abaixo já garante isso) — não por qual
// dos dois status ele chegou até aqui.
const AUDIO_STATUS_COM_TEXTO_REAL = new Set(["transcrito", "transcrito_reaproveitado"]);
export function transcricoesDoLeadAnterior(timelineJson) {
  const mapa = {};
  for (const m of (Array.isArray(timelineJson) ? timelineJson : [])) {
    if (!m || m.type !== "audio" || !AUDIO_STATUS_COM_TEXTO_REAL.has(m.audioStatus)) continue;
    const nome = normalizeName(m.mediaFile || "");
    const texto = String(m.text || "");
    if (!nome || !texto.startsWith(AUDIO_TRANSCRITO_PREFIXO)) continue;
    const semPrefixo = texto.slice(AUDIO_TRANSCRITO_PREFIXO.length).trim();
    if (semPrefixo) mapa[nome] = semPrefixo;
  }
  return mapa;
}

// v1312 — O QUE JÁ FOI LIDO UMA VEZ NÃO É LIDO DE NOVO.
//
// "demorando demais pra analisar, sendo que já tem histórico de monte e acho que nada de novo"
// (dono, 19/08/2026). Ele está certo, e a conta é grande: o áudio já transcrito deste cliente é
// reaproveitado desde a v1141, mas a IMAGEM, o PDF (v1306) e o LINK (v1307) eram lidos de novo,
// do zero, em TODA importação — até 22 segundos de leitura de imagem mais 20 de leitura de link,
// repetidos numa reimportação que não trouxe uma única mensagem nova. Fora o custo: cada leitura
// dessas é uma chamada paga à IA, gasta pra produzir exatamente o texto que já estava salvo.
//
// A leitura antiga vem da conversa salva deste cliente, do mesmo jeito que a transcrição de áudio:
// o texto está guardado na própria linha do tempo, com o rótulo que o app escreveu nele.
const VISUAL_PREFIXOS = ["[Imagem lida pela IA] ", "[Documento lido pela IA] "];
const LINK_PREFIXO = "[Link lido pela IA] ";

export function leiturasVisuaisDoLeadAnterior(timelineJson) {
  const mapa = {};
  for (const m of (Array.isArray(timelineJson) ? timelineJson : [])) {
    if (!m || m.source !== "visual" || !m.mediaFile) continue;
    const texto = String(m.text || "");
    const prefixo = VISUAL_PREFIXOS.find(p => texto.startsWith(p));
    if (!prefixo) continue;
    const conteudo = texto.slice(prefixo.length).trim();
    if (!conteudo) continue;
    const registro = { status: "lido", text: conteudo };
    mapa[String(m.mediaFile)] = registro;
    mapa[normalizeName(m.mediaFile)] = registro;
  }
  return mapa;
}

export function leiturasDeLinksDoLeadAnterior(timelineJson) {
  const mapa = {};
  for (const m of (Array.isArray(timelineJson) ? timelineJson : [])) {
    if (!m || !m.linkLido) continue;
    const texto = String(m.text || "");
    const corte = texto.indexOf(LINK_PREFIXO);
    if (corte < 0) continue;
    const conteudo = texto.slice(corte + LINK_PREFIXO.length).trim();
    if (conteudo) mapa[String(m.linkLido)] = { status: "lido", text: conteudo };
  }
  return mapa;
}

async function salvarManifesto(storage, manifestPath, manifest) {
  const buffer = Buffer.from(JSON.stringify(manifest), "utf8");
  const { error } = await storage.upload(manifestPath, buffer, {
    contentType: "application/octet-stream",
    upsert: true,
    cacheControl: "0"
  });
  if (error) throw new Error(`Não consegui salvar o manifesto da importação: ${error.message}`);
}

export async function prepararExtracaoPersistente({ storage, storagePath, importId, audioWindowDays, cacheDoLead = {}, cacheVisualDoLead = {}, cacheLinksDoLead = {}, organizationId }) {
  if (!organizationId) throw new Error("organizationId é obrigatório para preparar a extração.");
  // organizationId no prefixo isola manifesto e áudios extraídos de cada conta no bucket
  // compartilhado — sem isso, uma conta conseguiria ler/sobrescrever dados de outra só
  // adivinhando (ou reaproveitando) um importId.
  const prefix = `organizations/${organizationId}/imports/${importId}`;
  const manifestPath = `${prefix}/manifest.json`;
  const existente = await carregarManifesto(storage, manifestPath);
  const janelaSolicitada = String(audioWindowDays || "90");
  // v827-4: só reaproveita a extração anterior se a JANELA de áudio for a mesma. Antes,
  // trocar a janela reusava a extração antiga (áudios errados) sem refazer.
  if (existente?.sourceZipPath === storagePath && existente?.prep && existente?.audioStorage
      && String(existente?.audioWindowDays || "90") === janelaSolicitada) {
    return { manifest: existente, reusedPreparation: true };
  }

  const buffer = await baixarBuffer(storage, storagePath); // único download integral do ZIP
  // v1141 — os áudios que já têm transcrição guardada deste cliente (cacheDoLead, casados pelo
  // nome do arquivo) nem são descomprimidos: o texto deles já está pronto e entra direto em
  // `transcriptions` logo abaixo. Antes eles eram extraídos e subiam pro Storage só pra calcular
  // um hash que ninguém usaria — numa reimportação sem novidade era quase toda a espera da etapa.
  // v1333 — o que este cliente JÁ teve lido vai junto: o plano pula esses arquivos e desce a fila
  // dos que ainda faltam, em vez de repetir os mesmos mais recentes a cada importação.
  const prep = await prepararConversaDoZip(buffer, { audioWindowDays, includeExtractedFiles: true, organizationId, audiosJaTranscritos: cacheDoLead, visuaisJaLidos: cacheVisualDoLead, linksJaLidos: cacheLinksDoLead }); // única extração
  const extracted = prep._extractedFiles || {};
  delete prep._extractedFiles;
  // v1306 — IMAGEM E PDF DA CONVERSA VIRAM TEXTO AQUI.
  //
  // A leitura acontece nesta etapa (e não numa ida e volta separada, como a transcrição de áudio)
  // porque os arquivos já estão descompactados na memória: subir imagem pro Storage só pra baixar
  // de novo seria fila pura. Em troca, ela é a primeira coisa a ser cortada quando o tempo aperta:
  // `deadlineTs` interrompe o que não couber, o teto do dia corta o excedente antes de gastar, e
  // qualquer falha deixa a conversa exatamente como era antes desta versão.
  const visuaisExtraidos = prep._extractedVisuals || {};
  delete prep._extractedVisuals;
  const leiturasVisuais = {};
  let leituraVisualLimiteAtingido = false;
  let visuaisReaproveitados = 0;
  try {
    // v1312 — o que este cliente já teve lido numa importação anterior entra pronto e nem vira
    // candidato: não desce pra IA, não custa nada e não gasta segundo nenhum da janela.
    let candidatos = Object.entries(visuaisExtraidos).map(([name, buf]) => ({ name, buffer: buf }));
    candidatos = candidatos.filter(({ name }) => {
      const jaLido = cacheVisualDoLead[name] || cacheVisualDoLead[normalizeName(name)];
      if (!jaLido?.text) return true;
      leiturasVisuais[name] = { status: "lido", text: jaLido.text, reaproveitado: true };
      visuaisReaproveitados++;
      return false;
    });
    if (candidatos.length) {
      const limite = await verificarLimiteLeituraVisual(organizationId);
      if (Number.isFinite(limite.restante) && candidatos.length > limite.restante) {
        candidatos = candidatos.slice(0, Math.max(0, limite.restante));
        leituraVisualLimiteAtingido = true;
      }
      if (candidatos.length) {
        const { leituras } = await lerArquivosVisuais(candidatos, organizationId, { deadlineTs: Date.now() + 22000 });
        Object.assign(leiturasVisuais, leituras || {});
        const lidosAgora = Object.values(leituras || {}).filter(l => l?.status === "lido").length;
        if (lidosAgora) await registrarConsumoLeituraVisual(organizationId, lidosAgora);
      }
    }
  } catch (erroVisual) {
    console.warn("[direciona] leitura de imagem/PDF da importação falhou:", erroVisual?.message || erroVisual);
  }
  // v1307 — os links que o corretor mandou na conversa são abertos aqui, na mesma etapa e com as
  // mesmas travas (tempo, teto do dia, fail-open). Link de cliente nunca é aberto — a seleção é
  // feita em linksDoCorretorNaConversa, no _pipeline.
  const leiturasLinks = {};
  let linksReaproveitados = 0;
  try {
    const todosOsLinks = Array.isArray(prep.linksParaLer) ? prep.linksParaLer : [];
    // v1312 — link já lido deste cliente também volta pronto (a página não foi buscada de novo,
    // e a IA não foi chamada pra resumir de novo o mesmo endereço).
    const links = todosOsLinks.filter((url) => {
      const jaLido = cacheLinksDoLead[String(url)];
      if (!jaLido?.text) return true;
      leiturasLinks[url] = { status: "lido", text: jaLido.text, reaproveitado: true };
      linksReaproveitados++;
      return false;
    });
    if (links.length) {
      const limiteLink = await verificarLimiteLeituraVisual(organizationId);
      const cabem = Number.isFinite(limiteLink.restante) ? links.slice(0, Math.max(0, limiteLink.restante)) : links;
      if (cabem.length) {
        const { leituras } = await lerLinksDaConversa(cabem, organizationId, { deadlineTs: Date.now() + 20000 });
        Object.assign(leiturasLinks, leituras || {});
        const lidos = Object.values(leituras || {}).filter(l => l?.status === "lido").length;
        if (lidos) await registrarConsumoLeituraVisual(organizationId, lidos);
      }
    }
  } catch (erroLink) {
    console.warn("[direciona] leitura de link da importação falhou:", erroLink?.message || erroLink);
  }
  prep.leiturasLinks = leiturasLinks;
  prep.linksLidos = Object.values(leiturasLinks).filter(l => l?.status === "lido").length;
  prep.leiturasVisuais = leiturasVisuais;
  prep.visuaisLidos = Object.values(leiturasVisuais).filter(l => l?.status === "lido").length;
  prep.leituraVisualLimiteAtingido = leituraVisualLimiteAtingido;
  prep.visuaisReaproveitados = visuaisReaproveitados;
  prep.linksReaproveitados = linksReaproveitados;

  const audioStorage = {};
  const audioHashes = {};
  const transcriptions = {};
  const arquivosTemporarios = [];
  // O reaproveitamento por cliente é registrado aqui (e não dentro do upload) justamente porque
  // esses áudios não passam mais pelo upload. `audiosParaTranscrever` é a lista da janela: só
  // conta como reaproveitado o áudio que ESTA importação realmente precisaria transcrever.
  for (const nome of (prep.audiosParaTranscrever || []).map(normalizeName)) {
    const doLead = cacheDoLead[nome];
    if (doLead) transcriptions[nome] = { status: "transcrito_reaproveitado", text: doLead, reused: true, viaLeadAnterior: true };
  }
  // v827-4 (ZIP grande): sobe os áudios em LOTES paralelos, senão um upload de cada vez
  // estourava o tempo da função serverless em ZIPs com muitos áudios.
  const CONCORRENCIA_UPLOAD = 4;
  const entradas = Object.entries(extracted).map(([base, audioBuffer], i) => {
    const nome = normalizeName(base);
    return { nome, audioBuffer, audioPath: `${prefix}/audio/${String(i + 1).padStart(4, "0")}-${nomeStorageSeguro(nome)}` };
  });
  const subirUm = async ({ nome, audioBuffer, audioPath }) => {
    const { error } = await storage.upload(audioPath, audioBuffer, {
      contentType: contentTypeAudio(nome),
      upsert: true,
      cacheControl: "0"
    });
    if (error) throw new Error(`Não consegui guardar o áudio extraído ${nome}: ${error.message}`);
    const hash = hashAudio(audioBuffer);
    audioStorage[nome] = audioPath;
    audioHashes[nome] = hash;
    // O histórico do MESMO cliente (nome do arquivo — mais confiável, ver nota acima de
    // transcricoesDoLeadAnterior) já foi resolvido antes desta etapa: quem chega aqui não tinha
    // texto pronto. Sobra o cache por hash de conteúdo, que raramente bate entre importações
    // separadas, mas não custa manter como reforço.
    const cached = await carregarTranscricaoCache(storage, hash, organizationId);
    if (cached) transcriptions[nome] = cached;
    arquivosTemporarios.push(audioPath);
  };
  for (let i = 0; i < entradas.length; i += CONCORRENCIA_UPLOAD) {
    await Promise.all(Array.from(entradas.slice(i, i + CONCORRENCIA_UPLOAD), subirUm));
  }

  const manifest = {
    version: 1,
    importId,
    status: "prepared",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceZipPath: storagePath,
    audioWindowDays: String(audioWindowDays || "90"),
    audioStorage,
    audioHashes,
    transcriptions,
    temporaryFiles: arquivosTemporarios,
    prep
  };
  await salvarManifesto(storage, manifestPath, manifest);
  return { manifest, reusedPreparation: false };
}

async function removerImportacao(storage, manifest, manifestPath, storagePath) {
  const paths = new Set([...(manifest?.temporaryFiles || []), manifestPath, storagePath].filter(Boolean));
  if (!paths.size) return { removed: 0 };
  const { data, error } = await storage.remove([...paths]);
  if (error) throw new Error(error.message);
  return { removed: Array.isArray(data) ? data.length : paths.size };
}

export default async function handler(req, res) {
  const organizationId = await resolveOrganizationId(req, res);
  if (!organizationId) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Use POST para processar um ZIP do Storage." });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const defaultBucket = process.env.SUPABASE_ZIP_BUCKET || "whatsapp-zips";
  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, { ok: false, error: "Supabase ainda não configurado.", missing: { SUPABASE_URL: !!supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey } });
  }

  let body;
  try { body = await readJsonBody(req); }
  catch (_) { return json(res, 400, { ok: false, error: "Não foi possível ler o corpo da requisição." }); }

  // v1039 — /api/criar-upload-url foi absorvida por esta rota (ver comentário perto de
  // criarUploadUrl acima). O corpo dela NUNCA tem "action" — é o único jeito seguro de
  // reconhecer essa chamada aqui, já que ela chega com o mesmo método (POST) e o mesmo body
  // JSON de sempre, sem nenhuma mudança no app.
  if (body && typeof body === "object" && !body.action) {
    return criarUploadUrl(req, res, organizationId, body);
  }

  const bucket = defaultBucket;
  const storagePath = String(body?.path || "").trim();
  const action = String(body?.action || "").trim();
  const importId = importIdSeguro(body?.importId);
  const actions = new Set(["preparar", "transcrever", "analisar", "finalizar", "limpar-antigos"]);
  if (!actions.has(action)) return json(res, 400, { ok: false, error: "Ação de processamento inválida." });
  if (action !== "limpar-antigos" && !importId) {
    return json(res, 400, { ok: false, error: "Identificador de importação ausente ou inválido." });
  }
  if (action !== "limpar-antigos") {
    const prefixoEsperado = `whatsapp/organizations/${organizationId}/imports/${importId}/`;
    if (!storagePath.startsWith(prefixoEsperado) || !/\.zip$/i.test(storagePath)) {
      return json(res, 400, { ok: false, error: "Caminho do ZIP não pertence à importação informada." });
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const storage = supabase.storage.from(bucket);

  try {
    if (action === "preparar") {
      if (!importId) return json(res, 400, { ok: false, error: "Identificador de importação ausente ou inválido." });
      // Identifica um possível cliente já existente só pelo NOME DO ARQUIVO do zip (ainda não
      // temos a análise nesta etapa, só o arquivo) — mesma lógica já usada e confiável na hora
      // de salvar (_buscarProcessamentoExistenteV681). Serve só pra reaproveitar transcrição de
      // áudios já feitos nesse MESMO cliente; não decide fusão de cadastro (isso continua
      // acontecendo depois, na análise/persistência, do jeito que já era).
      const nomeArquivoZip = storagePath.split("/").pop() || "";
      // v1086 — se a leitura da conversa já salva falhar, o cache de áudio vem vazio e TODOS os
      // áudios são transcritos de novo (importação lenta e cara). Isso não pode passar batido:
      // a falha vai registrada na resposta, pra aparecer no diagnóstico em vez de virar só
      // "essa importação demorou muito hoje".
      let avisoCacheAudio = null;
      const matchAnterior = await _buscarProcessamentoExistenteV681(supabase, { result: {}, fileName: nomeArquivoZip, path: storagePath, organizationId })
        .catch((e) => { avisoCacheAudio = e?.message || String(e); return null; });
      const cacheDoLead = matchAnterior?.row ? transcricoesDoLeadAnterior(matchAnterior.row.timeline_json) : {};
      // v1312 — imagem, PDF e link já lidos deste cliente entram prontos, como já acontecia com o
      // áudio transcrito. É o que fazia uma reimportação sem novidade gastar quase um minuto (e
      // uma pilha de chamadas pagas) refazendo leitura idêntica.
      const cacheVisualDoLead = matchAnterior?.row ? leiturasVisuaisDoLeadAnterior(matchAnterior.row.timeline_json) : {};
      const cacheLinksDoLead = matchAnterior?.row ? leiturasDeLinksDoLeadAnterior(matchAnterior.row.timeline_json) : {};
      const { manifest, reusedPreparation } = await prepararExtracaoPersistente({ storage, storagePath, importId, audioWindowDays: body?.audioWindowDays, cacheDoLead, cacheVisualDoLead, cacheLinksDoLead, organizationId });
      // v1141 — o cliente já salvo é descoberto AQUI (por telefone/arquivo/nome) e essa descoberta
      // era jogada no lixo: só servia pra pegar o cache de áudio. A etapa de análise não recebia o
      // id, então o servidor tratava TODA importação como conversa nova — reanalisava (e cobrava) a
      // conversa inteira mesmo quando não havia uma única mensagem nova. Devolvendo o id, a análise
      // consegue comparar com o que já está salvo e cobrar só o que é realmente novo.
      const leadAnterior = matchAnterior?.row?.id ? {
        id: String(matchAnterior.row.id),
        via: String(matchAnterior.via || ""),
        mensagensSalvas: Array.isArray(matchAnterior.row.timeline_json) ? matchAnterior.row.timeline_json.length : 0,
        transcricoesDisponiveis: Object.keys(cacheDoLead).length
      } : null;
      // v1143 — ANÁLISE NA MESMA IDA, quando não há áudio novo pra transcrever.
      //
      // Reclamação do dono: "quando exporto a análise mesmo com 2 ou 3 mensagens e sem áudio,
      // demora demais, está impraticável". Uma conversa dessas não tem NADA pra transcrever, e o
      // app ainda fazia duas viagens separadas ao servidor (preparar e analisar) — cada uma com
      // partida a frio da função, leitura/gravação do manifesto e a conversa inteira subindo de
      // volta no corpo do pedido. Sem áudio pendente, isso é ida e volta pura.
      //
      // Aqui a análise sai junto, reaproveitando o que ESTA chamada já tem em mãos: a conversa
      // preparada, o cliente já identificado, a conversa salva e a análise salva (a busca do
      // cache de áudio já trouxe tudo isso do banco) — ou seja, sem nenhuma leitura extra.
      //
      // Segurança: só quando não sobrou áudio pendente E o ZIP é pequeno (a análise tem orçamento
      // de ~52s e a função morre em 60s — num ZIP grande a extração já consome tempo demais pra
      // caber junto). Se der qualquer problema, a resposta volta como sempre e o app faz a
      // chamada "analisar" separada, com todas as redes de proteção que já existiam.
      const manifestPath = `organizations/${organizationId}/imports/${importId}/manifest.json`;
      const audiosPendentes = (manifest.prep?.audiosParaTranscrever || [])
        .map(normalizeName)
        .filter(nome => !manifest.transcriptions?.[nome]?.text);
      const zipPequeno = Number(manifest.prep?.metricsBase?.totalMensagensOriginais || 0) <= ANALISE_JUNTA_MAX_MENSAGENS;
      let analiseIncluida = null;
      // v1174 — quando a análise já roda aqui e é RECUSADA pelo teto do dia, o app precisa saber
      // agora: sem isso ele seguia pra etapa "analisar", esperava a recusa de novo e só então
      // mostrava o aviso — tempo de tela parada à toa, pelo mesmo motivo já conhecido.
      let limiteAtingido = null;
      if (body?.analisarDireto === true && !audiosPendentes.length && zipPequeno) {
        try {
          const timelineAnterior = Array.isArray(matchAnterior?.row?.timeline_json) ? matchAnterior.row.timeline_json : [];
          const analiseAnterior = matchAnterior?.row?.resultado_analise && typeof matchAnterior.row.resultado_analise === "object"
            ? matchAnterior.row.resultado_analise : null;
          const resultado = await finalizarAnaliseDaConversa({
            ...manifest.prep,
            transcriptionMap: manifest.transcriptions || {},
            existingTimeline: timelineAnterior,
            previousAnalysis: analiseAnterior,
            existingLeadId: leadAnterior?.id || "",
            audiosReaproveitados: Object.keys(manifest.transcriptions || {}).length,
            audiosNovosSolicitados: 0,
            cerebroConfig: body?.cerebroConfig || null,
            organizationId
          });
          const msgs = resultado?.analysis?.messages || {};
          const trioOk = [msgs.a, msgs.b, msgs.c].every(v => String(v || "").trim().length >= 10);
          const analiseOk = resultado?.analysis && resultado.analysis.mode !== "erro_api" && resultado.analysis.mode !== "sem_api"
            && resultado.analysis.sugestoesPendentes !== true && trioOk;
          if (analiseOk) {
            resultado.analysis._storageRefs = {
              version: 1,
              bucket,
              importIds: [importId],
              sourceZipPaths: [storagePath],
              transcriptionCachePaths: [...new Set(Object.values(manifest.audioHashes || {}).filter(Boolean).map(hash => caminhoCacheTranscricao(hash, organizationId)))]
            };
            manifest.status = "analysis-ready";
            manifest.analysisReadyAt = new Date().toISOString();
            manifest.updatedAt = manifest.analysisReadyAt;
            await salvarManifesto(storage, manifestPath, manifest);
            analiseIncluida = { ok: true, bucket, path: storagePath, importId, autoSaved: false, ...resultado };
          } else if (resultado?.analysis?.mode === "limite_diario_excedido") {
            limiteAtingido = {
              error: resultado.analysis.error || "Limite de análises de IA atingido para esta conta.",
              upgrade: resultado.analysis.upgrade || null
            };
          }
        } catch (_) {
          // Cai no caminho de sempre: o app chama "analisar" e trata erro/retentativa como já fazia.
          analiseIncluida = null;
        }
      }
      return json(res, 200, {
        ok: true, bucket, path: storagePath, importId, manifestPath: `organizations/${organizationId}/imports/${importId}/manifest.json`,
        reusedPreparation, extractionCompleted: true, ...manifest.prep,
        ...(avisoCacheAudio ? { avisoCacheAudio } : {}),
        leadAnterior,
        audioStorage: manifest.audioStorage,
        cachedTranscriptions: manifest.transcriptions || {},
        analiseIncluida,
        ...(limiteAtingido ? { limiteAtingido } : {})
      });
    }

    if (action === "transcrever") {
      const audioNames = Array.isArray(body?.audioNames) ? body.audioNames.map(normalizeName) : [];
      if (!audioNames.length) return json(res, 200, { ok: true, transcriptions: {} });
      if (!importId) return json(res, 400, { ok: false, error: "Identificador de importação ausente ou inválido." });
      const manifestPath = `organizations/${organizationId}/imports/${importId}/manifest.json`;
      const manifest = await carregarManifesto(storage, manifestPath);
      if (!manifest?.audioStorage) return json(res, 409, { ok: false, error: "A extração desta importação não foi encontrada. Tente preparar novamente sem reenviar o ZIP." });
      const existentes = manifest.transcriptions && typeof manifest.transcriptions === "object" ? { ...manifest.transcriptions } : {};
      // v1131 — esta preparação era SEQUENCIAL: pra cada áudio, esperava a consulta ao cache e
      // depois o download, um atrás do outro. Num lote de 8 áudios são 16 idas e voltas ao Storage
      // em fila, antes de a transcrição começar — e é justamente aí que o dia de banco lento (cota
      // do Supabase estourada) vira minuto de espera na tela. Agora as leituras acontecem em
      // paralelo, com o mesmo teto de simultaneidade que a transcrição já usa.
      //
      // A ORDEM do resultado é preservada de propósito (índice fixo + filtro no fim): o lote
      // precisa sair na mesma sequência em que os áudios foram pedidos.
      const preparados = new Array(audioNames.length).fill(null);
      await mapComLimiteParalelo(audioNames, 8, async (nome, i) => {
        if (existentes[nome]?.text) return;
        const hash = manifest?.audioHashes?.[nome];
        const cached = await carregarTranscricaoCache(storage, hash, organizationId);
        if (cached) { existentes[nome] = cached; return; }
        const audioPath = manifest.audioStorage[nome];
        if (!audioPath) return;
        preparados[i] = { name: nome, buffer: await baixarBuffer(storage, audioPath) };
      });
      const arquivos = preparados.filter(Boolean);
      // v1119 — teto diário de transcrição de importação (a parte mais cara do custo, antes sem
      // trava nenhuma). Corta o excedente do dia ANTES de gastar Whisper; o que não couber hoje
      // fica como "não transcrito" e pode ser pedido de novo depois (o app já lida com áudio sem
      // transcrição). Fail-open: qualquer erro na checagem não bloqueia (restante = Infinity).
      let limiteTranscricao = { permitido: true, restante: Infinity, emTeste: false, limite: Infinity };
      if (arquivos.length) {
        limiteTranscricao = await verificarLimiteTranscricaoImport(organizationId);
        if (Number.isFinite(limiteTranscricao.restante) && arquivos.length > limiteTranscricao.restante) {
          arquivos.length = Math.max(0, limiteTranscricao.restante);
        }
      }
      const lote = arquivos.length
        ? await transcreverArquivosExtraidos(arquivos, organizationId)
        : { transcriptions: {}, transcriptionEnabled: true };
      // Conta só o que virou texto de verdade (não cobra cache nem erro).
      const transcritosAgora = Object.values(lote.transcriptions || {}).filter(t => t?.status === "transcrito").length;
      if (transcritosAgora) await registrarConsumoTranscricaoImport(organizationId, transcritosAgora);
      Object.assign(existentes, lote.transcriptions || {});
      for (const [nome, item] of Object.entries(lote.transcriptions || {})) {
        if (item?.text) await salvarTranscricaoCache(storage, manifest?.audioHashes?.[nome], item, organizationId);
      }
      manifest.transcriptions = existentes;
      manifest.status = "prepared";
      manifest.updatedAt = new Date().toISOString();
      delete manifest.lastError;
      await salvarManifesto(storage, manifestPath, manifest);
      const solicitadas = Object.fromEntries(audioNames.filter(nome => existentes[nome]).map(nome => [nome, existentes[nome]]));
      return json(res, 200, {
        ok: true,
        transcriptions: solicitadas,
        transcriptionEnabled: lote.transcriptionEnabled,
        importId,
        reused: audioNames.filter(nome => solicitadas[nome]?.reused).length,
        zipDownloadedAgain: false,
        // v1119 — sinaliza quando o teto diário de transcrição foi atingido (áudios que sobraram
        // ficam sem transcrever hoje). O app segue funcionando; é só metadado pra um aviso futuro.
        transcricaoLimiteAtingido: limiteTranscricao.permitido === false
      });
    }

    if (action === "analisar") {
      let existingTimeline = Array.isArray(body?.existingTimeline) ? body.existingTimeline : [];
      const existingLeadId = body?.existingLeadId ? String(body.existingLeadId) : "";
      // v1141 — junto com a conversa salva vem a ANÁLISE salva. Sem novidade nenhuma na conversa,
      // ela é reaproveitada como está e nenhuma chamada de IA acontece (ver
      // finalizarAnaliseDaConversa). Antes, reimportar o mesmo arquivo pagava a análise inteira
      // de novo pra devolver praticamente o mesmo texto.
      let previousAnalysis = null;
      if (existingLeadId) {
        const { data: anterior, error: anteriorError } = await supabase.from("whatsapp_processamentos").select("timeline_json,resultado_analise").eq("id", existingLeadId).eq("organization_id", organizationId).maybeSingle();
        if (anteriorError) throw new Error(`Não consegui recuperar o histórico anterior: ${anteriorError.message}`);
        if (anterior) {
          if (!existingTimeline.length) existingTimeline = Array.isArray(anterior.timeline_json) ? anterior.timeline_json : existingTimeline;
          previousAnalysis = anterior.resultado_analise && typeof anterior.resultado_analise === "object" ? anterior.resultado_analise : null;
        }
      }
      const result = await finalizarAnaliseDaConversa({
        txtFile: body?.txtFile, rawText: body?.rawText, messages: body?.messages,
        audioFilesRelevantes: body?.audioFilesRelevantes, audioFilesForaDaJanela: body?.audioFilesForaDaJanela,
        transcriptionMap: body?.transcriptionMap, janelaConversa: body?.janelaConversa,
        // v1306 — o texto lido das imagens/PDFs volta do navegador junto com as transcrições e
        // entra na linha do tempo dentro de finalizarAnaliseDaConversa.
        leiturasVisuais: body?.leiturasVisuais,
        leiturasLinks: body?.leiturasLinks,
        ignoredFilesCount: body?.ignoredFilesCount, ignoredFiles: body?.ignoredFiles,
        audiosTotalNoZip: body?.audiosTotalNoZip, audiosDescartadosPorJanela: body?.audiosDescartadosPorJanela,
        metricsBase: body?.metricsBase, existingTimeline, previousAnalysis, existingLeadId,
        audiosReaproveitados: body?.audiosReaproveitados, audiosNovosSolicitados: body?.audiosNovosSolicitados,
        cerebroConfig: body?.cerebroConfig || null,
        organizationId
      });
      const analysis = result?.analysis || null;
      const manifestPath = importId ? `organizations/${organizationId}/imports/${importId}/manifest.json` : "";
      const manifest = importId ? await carregarManifesto(storage, manifestPath) : null;
      if (analysis && typeof analysis === "object") {
        const cachePaths = [...new Set(Object.values(manifest?.audioHashes || {}).filter(Boolean).map(hash => caminhoCacheTranscricao(hash, organizationId)))];
        analysis._storageRefs = {
          version: 1,
          bucket,
          importIds: importId ? [importId] : [],
          sourceZipPaths: storagePath ? [storagePath] : [],
          transcriptionCachePaths: cachePaths
        };
      }
      const mensagens = analysis?.messages || {};
      const temTrio = [mensagens.a, mensagens.b, mensagens.c].every(v => String(v || "").trim().length >= 10);
      const falhou = !analysis || analysis.mode === "erro_api" || analysis.mode === "sem_api" || analysis.sugestoesPendentes === true || !temTrio;
      // v1174 — bater no teto de análises do dia NÃO é falha passageira: repetir não vai dar
      // certo daqui a 1,2 segundo e ainda faz o corretor esperar o dobro olhando a tela parada em
      // 92%. Vem marcado como NÃO recuperável, com o motivo verdadeiro, pra o app parar na hora e
      // mostrar o aviso (e o convite de plano, quando houver) em vez de tentar de novo.
      if (analysis?.mode === "limite_diario_excedido") {
        return json(res, 429, {
          ok: false,
          error: analysis.error || "Limite de análises de IA atingido para esta conta.",
          recoverable: false,
          limiteAtingido: true,
          upgrade: analysis.upgrade || null,
          bucket, path: storagePath, importId
        });
      }
      if (falhou) return json(res, 502, { ok: false, error: "A conversa foi lida, mas a análise comercial não foi concluída.", details: analysis?.error || (analysis?.validacaoSugestoes || []).join("; ") || "A IA não devolveu as 3 mensagens.", recoverable: true, bucket, path: storagePath, importId });
      if (importId && manifest) {
        if (manifest) {
          manifest.status = "analysis-ready";
          manifest.analysisReadyAt = new Date().toISOString();
          manifest.updatedAt = manifest.analysisReadyAt;
          delete manifest.lastError;
          await salvarManifesto(storage, manifestPath, manifest);
        }
      }
      return json(res, 200, { ok: true, bucket, path: storagePath, importId, autoSaved: false, ...result });
    }

    if (action === "finalizar") {
      if (!importId) return json(res, 400, { ok: false, error: "Identificador de importação ausente ou inválido." });
      const manifestPath = `organizations/${organizationId}/imports/${importId}/manifest.json`;
      const manifest = await carregarManifesto(storage, manifestPath);
      if (manifest) {
        manifest.status = "completed";
        manifest.completedAt = new Date().toISOString();
        manifest.updatedAt = manifest.completedAt;
        await salvarManifesto(storage, manifestPath, manifest);
      }
      const cleanup = await removerImportacao(storage, manifest, manifestPath, storagePath || manifest?.sourceZipPath);
      return json(res, 200, { ok: true, importId, cleanup, completed: true });
    }

    if (action === "limpar-antigos") {
      // Limpeza conservadora: apenas manifestos com mais de 7 dias. Falhas não bloqueiam importações.
      // Escopada por organizationId — antes disso a varredura listava "imports/" (pasta global do
      // bucket) e uma conta podia disparar a limpeza de arquivos temporários de OUTRA conta.
      const limiteMs = 7 * 24 * 60 * 60 * 1000;
      const activeImportId = importIdSeguro(body?.activeImportId);
      const { data: dirs, error } = await storage.list(`organizations/${organizationId}/imports`, { limit: 100, sortBy: { column: "created_at", order: "asc" } });
      if (error) throw new Error(error.message);
      let removidas = 0;
      for (const dir of dirs || []) {
        const id = importIdSeguro(dir?.name);
        if (!id || id === activeImportId) continue;
        const manifestPath = `organizations/${organizationId}/imports/${id}/manifest.json`;
        const manifest = await carregarManifesto(storage, manifestPath);
        const referencia = Date.parse(manifest?.updatedAt || manifest?.createdAt || dir?.created_at || "");
        if (!referencia || Date.now() - referencia < limiteMs) continue;
        const r = await removerImportacao(storage, manifest, manifestPath, manifest?.sourceZipPath).catch(() => ({ removed: 0 }));
        removidas += Number(r.removed || 0);
      }
      return json(res, 200, { ok: true, removidas });
    }

    return json(res, 400, { ok: false, error: "Ação de processamento inválida." });
  } catch (error) {
    if (importId && ["preparar", "transcrever", "analisar"].includes(action)) {
      try {
        const manifestPath = `organizations/${organizationId}/imports/${importId}/manifest.json`;
        const manifest = await carregarManifesto(storage, manifestPath);
        if (manifest) {
          manifest.status = "recoverable-failure";
          manifest.updatedAt = new Date().toISOString();
          manifest.lastError = { action, message: error?.message || String(error), at: manifest.updatedAt };
          await salvarManifesto(storage, manifestPath, manifest);
        }
      } catch (_) { /* o erro original continua sendo a resposta */ }
    }
    if (error?._download) return json(res, 404, { ok: false, error: "Não foi possível baixar o arquivo temporário da importação.", details: error.message, bucket, path: storagePath, importId, recoverable: true });
    if (error?.filesFound) return json(res, 400, { ok: false, error: error.message || "ZIP inválido.", filesFound: error.filesFound, bucket, path: storagePath, importId });
    return json(res, 500, { ok: false, error: "Falha ao processar a importação.", details: error?.message || String(error), bucket, path: storagePath, importId, recoverable: true });
  }
}
