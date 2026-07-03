// Endpoint unificado que substitui lead-etapa, lead-memoria, aprendizado e
// apagar-lead. Foi consolidado pra caber no limite de 12 Serverless Functions
// do plano Vercel Hobby.
//
// Uso: POST /api/lead-update com body { id, action, ...payload }
// Actions: "salvar-novo", "etapa", "memoria-get", "memoria-set", "aprendizado", "apagar"

import { requireApiKey } from "./_persistence.js";
import { getSupabaseAdmin, persistProcessingResult, listRecentProcessings } from "./_persistence.js";
import { randomUUID } from "node:crypto";
import { compararEvolucao, getOpenAI, atualizarConhecimentoCorretor, modeloVisao, finalizarAnaliseComercialV674 } from "./_pipeline.js";

const ETAPAS_VALIDAS = ["Novo", "Atendimento", "Visita/Proposta", "Negociação", "Standby", "Geladeira", "Perdido", "Vendido"];

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

export default async function handler(req, res) {
  if (requireApiKey(req, res) !== true) return;
  // GET pra ler memória sem precisar de body (usado pelo carregarMemoria do front).
  if (req.method === "GET") {
    const id = req.query?.id;
    if (!id) return json(res, 400, { ok: false, error: "Informe ?id=" });
    const action = req.query?.action || "memoria-get";
    if (action === "memoria-get") return await acaoMemoriaGet(id, res);
    if (action === "detalhe") {
      const result = await listRecentProcessings(1, { id, includeFullTimeline: true });
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
  if (action === "salvar-novo") return await acaoSalvarNovo(body, res);
  if (action === "criar-manual") return await acaoCriarManual(body, res);
  if (action === "nova-oportunidade-parceiro") return await acaoNovaOportunidadeParceiro(body, res);
  if (action === "extrair-print") return await acaoExtrairPrint(body, res);
  if (action === "detectar-rosto") return await acaoDetectarRosto(body, res);
  if (action === "ler-prints-conversa") return await acaoLerPrintsConversa(body, res);
  if (action === "atualizar-com-evolucao") return await acaoAtualizarComEvolucao(body, res);
  if (action === "aprender-carteira") {
    const { aprenderRespostasDaCarteira } = await import("./_pipeline.js");
    const r = await aprenderRespostasDaCarteira();
    return json(res, r.ok ? 200 : 500, r);
  }

  const id = body?.id;
  if (!id) return json(res, 400, { ok: false, error: "Informe id." });

  switch (action) {
    case "etapa":         return await acaoEtapa(id, body.etapa, res);
    case "memoria-get":   return await acaoMemoriaGet(id, res);
    case "memoria-set":   return await acaoMemoriaSet(id, body, res);
    case "aprendizado":   return await acaoAprendizado(id, body, res);
    case "lembrete-set":  return await acaoLembreteSet(id, body, res);
    case "lembrete-clear":return await acaoLembreteClear(id, res);
    case "apagar":        return await acaoApagar(id, res);
    case "editar-dados":  return await acaoEditarDados(id, body, res);
    case "analise-comercial-set": return await acaoAnaliseComercialSet(id, body.analysis, res);
    default:              return json(res, 400, { ok: false, error: "Action inválida." });
  }
}


// ============ FALLBACK SEGURO DA ANÁLISE COMERCIAL ============
// Usado quando a reanálise principal foi gravada mas uma função antiga não devolveu
// o objeto completo, ou quando o front precisa consolidar fatos determinísticos.
// O servidor relê o lead, reconcilia novamente e só então persiste.
async function acaoAnaliseComercialSet(id, analysis, res) {
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return json(res, 400, { ok: false, error: "Informe a análise comercial." });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const { data: current, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise,timeline_json,nome_arquivo,arquivo_nome")
    .eq("id", id)
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
    reanalisadoEm: new Date().toISOString()
  };
  merged = finalizarAnaliseComercialV674(merged, lead, timeline, "Sanchai");
  merged._schemaComercial = 684;
  if (merged.modeloComercial) merged.modeloComercial.versao = 684;

  const { data: saved, error: putErr } = await supabase
    .from("whatsapp_processamentos")
    .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select("resultado_analise");
  if (putErr) return json(res, 500, { ok: false, error: putErr.message });
  if (!saved || saved.length === 0) return json(res, 409, { ok: false, error: "A análise não foi gravada. Tente novamente." });
  const persisted = saved[0]?.resultado_analise || merged;
  const schema = Number(persisted?._schemaComercial || persisted?.modeloComercial?.versao || 0);
  if (schema < 684) return json(res, 500, { ok: false, error: "A análise foi gerada, mas o banco não confirmou a gravação no schema 684." });
  return json(res, 200, { ok: true, analysis: persisted, schemaComercial: 684 });
}

// ============ LEMBRETE (snooze manual) ============
async function acaoLembreteSet(id, body, res) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const dias = Number(body?.dias) || 0;
  if (dias < 0 || dias > 365) return json(res, 400, { ok: false, error: "Informe dias entre 0 e 365." });

  const lembreteEm = new Date();
  lembreteEm.setDate(lembreteEm.getDate() + dias);
  lembreteEm.setHours(8, 0, 0, 0); // padrão 8h da manhã

  const { data: current, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const merged = { ...(current.resultado_analise || {}) };
  merged.lembrete = {
    quando: lembreteEm.toISOString(),
    motivo: String(body?.motivo || "").slice(0, 200),
    diasAdicionados: dias,
    criadoEm: new Date().toISOString()
  };
  const { error: putErr } = await supabase
    .from("whatsapp_processamentos")
    .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (putErr) return json(res, 500, { ok: false, error: putErr.message });
  return json(res, 200, { ok: true, lembrete: merged.lembrete });
}

async function acaoLembreteClear(id, res) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const { data: current, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const merged = { ...(current.resultado_analise || {}) };
  delete merged.lembrete;
  const { error: putErr } = await supabase
    .from("whatsapp_processamentos")
    .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (putErr) return json(res, 500, { ok: false, error: putErr.message });
  return json(res, 200, { ok: true });
}

// ============ SALVAR NOVO LEAD (após o usuário clicar em "Salvar lead") ============
async function acaoSalvarNovo(body, res) {
  const result = body?.result;
  if (!result || typeof result !== "object") {
    return json(res, 400, { ok: false, error: "Informe result com os dados processados." });
  }
  try {
    const persistence = await persistProcessingResult({
      result,
      source: body?.source || "manual-save",
      bucket: body?.bucket || null,
      path: body?.path || null,
      fileName: body?.fileName || result?.txtFile || null,
      fileSize: body?.fileSize || null
    });
    return json(res, 200, { ok: !!persistence?.processing?.id, persistence });
  } catch (err) {
    return json(res, 500, { ok: false, error: err?.message || String(err) });
  }
}

// Cria lead manualmente — alguém ligou, comentou pessoalmente, indicação. Sem ZIP de WhatsApp.
// Recebe { nome, telefone, produto, observacao }. Gera registro mínimo com etapa Novo.
// Lê o PRINT de uma conversa/formulário (lead do Meta etc.) com a visão da IA
// e devolve os campos do cliente pra pré-preencher o modal de lead manual.
// Não salva nada — o corretor confere e salva pelo fluxo criar-manual.
// Celular brasileiro completo via WhatsApp = +55 + DDD(2 dígitos) + 9 dígitos = 13 dígitos.
// Se o número vier com +55 (ou começando por 55) e não fechar 13 dígitos, é provável que a
// leitura do print tenha comido/colado um dígito — devolve true pra pedir conferência (sem bloquear).
function telefoneBRSuspeito(tel) {
  const d = String(tel || "").replace(/\D/g, "");
  if (!d) return false;
  if (d.startsWith("55")) return d.length !== 13;
  return false;
}

async function acaoExtrairPrint(body, res) {
  const openai = getOpenAI();
  if (!openai) return json(res, 200, { ok: false, error: "Leitura de print indisponível agora." });
  const dataUrl = String(body?.imagemBase64 || "");
  if (!/^data:image\//.test(dataUrl)) return json(res, 400, { ok: false, error: "Imagem não recebida no formato esperado." });
  const EMPS = ["Renaissance", "Quality", "Prime", "Personalité", "Boulevard", "Premium Office", "Evolutti", "Nova Vila Rica I", "Nova Vila Rica II", "Nova Vila Rica III", "Residencial GABRO", "Edifício Campos Elísios"];
  const instrucao = `Você lê o PRINT de uma conversa de WhatsApp ou formulário de um possível cliente (lead) de uma imobiliária (Construtora Senger — Carazinho e Ibirubá/RS). Extraia SÓ os dados do CLIENTE (nunca do corretor/da empresa).

REGRA CRÍTICA — separe o que o CLIENTE disse do que é ANÚNCIO/PROPAGANDA:
- Em prints aparece muito um POST/ANÚNCIO compartilhado (card com imagem, título, legenda, link do Instagram/Facebook, slogan tipo "Seu terreno em Carazinho ficou possível", "Lotes em 60x"). Esse texto é PROPAGANDA do empreendimento — NÃO é fala do cliente.
- NUNCA escreva "o cliente mencionou/disse/falou que..." baseado em texto de anúncio. Só atribua ao cliente o que ELE realmente digitou/falou (balões de mensagem dele, campos do formulário que ele preencheu).
- Se um anúncio foi compartilhado, registre assim: "Veio de um anúncio do [empreendimento]" — sem transformar o slogan em fala dele.

Campos:
- nome: o nome COMPLETO do cliente (nome + sobrenome quando houver) — se aparecer mais de uma palavra, NUNCA devolva só a primeira.
  - FONTE PRINCIPAL = o campo de FORMULÁRIO/CADASTRO ("full_name") quando ele existir: é o nome que o PRÓPRIO cliente registrou, use ELE (ex.: full_name "Adm. Evandro Zibetti Meira" → "Evandro Zibetti Meira"). Só use o nome do TOPO da conversa / do perfil ("~ Nome", aviso "está na sua lista de contatos") QUANDO NÃO HOUVER formulário com nome. O "~ Nome" do topo costuma ser apelido/abreviação invertida (ex.: "~ Meira E. Z.") — NÃO use ele se houver full_name.
  - REMOVA "~", emojis, símbolos e SIGLAS/tags que o corretor acrescentou ao contato (ex.: "Mauricio Berlando NVRIII" → "Mauricio Berlando"; "~ BRUNA🦋🕺" → "Bruna").
  - REMOVA também TÍTULOS/pronomes de tratamento no começo do nome (Adm., Dr., Dra., Sr., Sra., Eng., Arq., Prof., Cel., Pe.) — eles não fazem parte do nome (ex.: "Adm. Evandro Zibetti Meira" → "Evandro Zibetti Meira").
  - ORDEM: o formulário às vezes traz o sobrenome na frente ("Berlando Mauricio"). Quando der pra perceber que está invertido (o primeiro nome é a última palavra), reordene pra "Nome Sobrenome" (ex.: "Berlando Mauricio" → "Mauricio Berlando"). Se já está em ordem natural (primeiro nome + sobrenomes), mantenha como está (ex.: "Evandro Zibetti Meira" fica igual).
  - Aceite primeiro nome sozinho quando só houver um. Se só aparecer um número e nenhum nome em lugar algum, "".
- telefone: telefone/WhatsApp do cliente, com DDI/DDD quando aparecer (ex.: "phone: +55..."). Mantenha só dígitos e "+". COPIE EXATAMENTE os dígitos que aparecem no print — NÃO troque o DDD nem invente/remova o nono dígito.
  - LEIA DÍGITO POR DÍGITO, da esquerda pra direita, e confira DUAS VEZES. O erro mais comum é COLAPSAR dígitos repetidos (ler "555" como "55", ou "9907" como "907") — JAMAIS junte/elimine dígitos iguais seguidos; conte cada um.
  - Um celular brasileiro completo tem DDI 55 + DDD de 2 dígitos + 9 dígitos = 13 dígitos no total (ex.: "+55 54 99706-7229" = "+5554997067229", repare nos TRÊS cincos seguidos: 55 do país + 54 do DDD). Se o celular com +55 que você leu tiver MENOS de 13 dígitos, você provavelmente comeu um dígito repetido — releia o campo e corrija.
  - Se o número estiver num campo de FORMULÁRIO ("phone: +55..."), copie a sequência EXATA daquele campo, caractere por caractere.
  - Se não houver, "".
- email: e-mail do cliente, se houver. Senão "".
- nomeFonte: de ONDE você tirou o nome — "formulario" quando o nome veio de um campo de cadastro/formulário que o PRÓPRIO cliente preencheu (ex.: "full_name: Cleonir dos santos", "nome:"); "topo" quando veio do cabeçalho/perfil da conversa (nome do contato no topo da tela); "" se não houver nome. Se existir full_name no print, o nome DEVE vir dele e nomeFonte = "formulario".
- produto: o empreendimento de interesse, quando der pra identificar (pelo anúncio compartilhado ou pelo texto do cliente). Use EXATAMENTE um destes nomes quando bater: ${EMPS.join(", ")}. Se não der pra saber, "".
- observacao: um RESUMO ÚTIL e fiel do print, pra registrar como histórico/memória do lead. Inclua: de onde o lead veio (ex.: "veio de um anúncio do NVR III no Instagram", "formulário do Facebook", indicação), o que O CLIENTE de fato escreveu/pediu (pode usar as palavras dele), e dados pertinentes que ELE informou (cidade, prazo, valor, dúvidas, momento de vida etc.). DEIXE CLARO o que é fala do cliente e o que é anúncio. NÃO invente e NÃO atribua frase de propaganda ao cliente. Se ele só escreveu uma frase genérica de formulário, registre exatamente isso (sem inflar).
- avatarBox: a posição da FOTO DE PERFIL REAL do cliente DENTRO do print — uma foto REDONDA com um ROSTO.
  - NUNCA use um CARD compartilhado (post/anúncio, prévia de link, vídeo): esses são RETANGULARES e têm botão de ▶ play, miniatura de mapa/imagem, logo do Facebook/Instagram, título, legenda e link tipo "fb.me". ISSO NÃO É A FOTO DO CLIENTE — jamais recorte daí.
  - Numa conversa ABERTA (não é card de contato novo), a única foto do cliente é a FOTINHA REDONDA pequena no TOPO, ao lado do nome, no cabeçalho. Use ESSA (mesmo sendo pequena).
  - Em card de CONTATO NOVO (contato não salvo), o WhatsApp mostra uma FOTO REDONDA GRANDE no centro/topo, logo ACIMA do número — prefira ESSA por ser maior e mais nítida.
  - JUSTEZA é o mais importante: a caixa tem que cercar SÓ o CÍRCULO da foto, coladinha na borda dele. NÃO inclua a seta de voltar (←), o nome, os ícones do cabeçalho, nem o fundo ao redor. Se a foto do cabeçalho for pequena, a caixa também é pequena — prefira pequena e certa a grande e folgada. O centro da caixa tem que cair EXATAMENTE no centro do rosto/foto.
  - Devolva coordenadas NORMALIZADAS de 0 a 1 em relação à imagem inteira, no formato { "x":, "y":, "w":, "h": } (x,y = canto superior-esquerdo; w,h = largura/altura).
  - Se NÃO houver foto real (só inicial/letra, silhueta cinza, ícone padrão do WhatsApp, ou só um card/anúncio), use avatarBox: null — NÃO recorte texto, card nem avatar vazio. NÃO invente uma posição.
Responda APENAS JSON: { "nome":"", "nomeFonte":"", "telefone":"", "email":"", "produto":"", "observacao":"", "avatarBox": null }.`;
  // Tenta o modelo de visão configurado (padrão gpt-4o) e, se ele falhar, cai para gpt-4o-mini.
  const modelos = [...new Set([modeloVisao(), "gpt-4o-mini"])];
  let ultimoErro = "";
  for (let i = 0; i < modelos.length; i++) {
    try {
      const completion = await openai.chat.completions.create({
        model: modelos[i],
        messages: [{
          role: "user",
          content: [
            { type: "text", text: instrucao },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } }
          ]
        }],
        temperature: 0.1,
        max_tokens: 900,
        response_format: { type: "json_object" }
      }, { timeout: i === 0 ? 32000 : 22000, maxRetries: 0 });
      const raw = completion?.choices?.[0]?.message?.content || "{}";
      let p; try { p = JSON.parse(raw); } catch (_) { p = {}; }
      // Foto de perfil num print de CONVERSA do WhatsApp fica SEMPRE no TOPO, ao lado do nome
      // (canto superior-esquerdo). A IA erra demais aqui (pega a imagem compartilhada ou o
      // texto do nome), então cortamos pela POSIÇÃO PADRÃO, que é constante no print de conversa.
      // Recorte vazio/silhueta (contato sem foto) é descartado no front (fotoQuaseVazia).
      const avatarBox = { x: 0.145, y: 0.05, w: 0.10, h: 0.046 };
      const telefone = String(p.telefone || "").slice(0, 40);
      return json(res, 200, {
        ok: true,
        nome: String(p.nome || "").slice(0, 120),
        nomeFonte: String(p.nomeFonte || "").slice(0, 20),
        telefone,
        // Avisa o front quando o celular BR não fecha os 13 dígitos (+55 + DDD 2 + 9):
        // sinal de que a leitura comeu/inventou um dígito. Não bloqueia, só pede conferência.
        telefoneSuspeito: telefoneBRSuspeito(telefone),
        email: String(p.email || "").slice(0, 120),
        produto: String(p.produto || "").slice(0, 80),
        observacao: String(p.observacao || "").slice(0, 1800),
        avatarBox
      });
    } catch (e) {
      ultimoErro = e?.message || "falha ao ler o print";
    }
  }
  return json(res, 200, { ok: false, error: ultimoErro || "Falha ao ler o print." });
}

// Detecta o ROSTO da pessoa numa imagem qualquer (foto, print de perfil, card) pra usar como
// avatar do lead. Devolve a caixa NORMALIZADA (0–1) só do rosto, bem justa. Ignora logos/texto/fundo.
async function acaoDetectarRosto(body, res) {
  const openai = getOpenAI();
  if (!openai) return json(res, 200, { ok: false, error: "Detecção de rosto indisponível agora." });
  const dataUrl = String(body?.imagemBase64 || "");
  if (!/^data:image\//.test(dataUrl)) return json(res, 400, { ok: false, error: "Imagem inválida." });

  const instrucao = `Você recebe UMA imagem (pode ser foto de perfil, print de contato/WhatsApp, ou um card de propaganda com uma pessoa). Sua tarefa: localizar o ROSTO HUMANO PRINCIPAL pra recortar como foto de avatar.

Regras:
- Encontre o rosto da PESSOA (olhos/nariz/boca). Mesmo que esteja dentro de um card com texto, logo e fundo colorido, foque SÓ no rosto + um pouco de ombro, IGNORANDO o texto, telefone, logotipo e fundo.
- Devolva uma caixa que CERCA o rosto com um pouco de margem (cabeça + ombros), em formato quadrado-ish, JUSTA — sem pegar o texto/logo ao lado.
- Coordenadas NORMALIZADAS de 0 a 1 em relação à imagem inteira: { "x":, "y":, "w":, "h": } (x,y = canto superior-esquerdo; w,h = largura/altura).
- Se NÃO houver nenhum rosto humano claro na imagem, retorne faceBox: null.
Responda APENAS JSON: { "faceBox": null }.`;

  const modelos = [...new Set([modeloVisao(), "gpt-4o-mini"])];
  let ultimoErro = "";
  for (let i = 0; i < modelos.length; i++) {
    try {
      const completion = await openai.chat.completions.create({
        model: modelos[i],
        messages: [{
          role: "user",
          content: [
            { type: "text", text: instrucao },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } }
          ]
        }],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" }
      }, { timeout: i === 0 ? 28000 : 20000, maxRetries: 0 });
      const raw = completion?.choices?.[0]?.message?.content || "{}";
      let p; try { p = JSON.parse(raw); } catch (_) { p = {}; }
      const c01 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null; };
      let faceBox = null;
      const fb = p.faceBox;
      if (fb && typeof fb === "object") {
        const x = c01(fb.x), y = c01(fb.y), w = c01(fb.w), h = c01(fb.h);
        if (x != null && y != null && w != null && h != null && w > 0.02 && h > 0.02) faceBox = { x, y, w, h };
      }
      return json(res, 200, { ok: true, faceBox });
    } catch (e) {
      ultimoErro = e?.message || "falha ao detectar rosto";
    }
  }
  return json(res, 200, { ok: false, error: ultimoErro || "Falha ao detectar rosto." });
}

// Lê VÁRIOS prints de uma conversa (WhatsApp) com a visão da IA e devolve um registro
// fiel da conversa, pra entrar como anotação de atendimento (timeline + observação) do lead.
async function acaoLerPrintsConversa(body, res) {
  const openai = getOpenAI();
  if (!openai) return json(res, 200, { ok: false, error: "Leitura de prints indisponível agora." });
  let imgs = Array.isArray(body?.imagens) ? body.imagens : [];
  imgs = imgs.filter(u => typeof u === "string" && /^data:image\//.test(u)).slice(0, 6);
  if (!imgs.length) return json(res, 400, { ok: false, error: "Nenhuma imagem recebida." });
  // Âncoras de data pra resolver "Hoje"/"Ontem" do print (senão a IA chuta um ano errado, ex.: 2023).
  const _nowP = new Date();
  const _hojeISO = _nowP.toISOString().slice(0, 10);
  const _ontemP = new Date(_nowP); _ontemP.setDate(_ontemP.getDate() - 1);
  const _ontemISO = _ontemP.toISOString().slice(0, 10);
  const instrucao = `HOJE é ${_hojeISO}. "Hoje" no print = ${_hojeISO}; "Ontem" = ${_ontemISO}; datas sem ano = ano ${_nowP.getFullYear()} (a não ser que o print mostre OUTRO ano claramente). NUNCA use um ano anterior só porque o ano não aparece — datas relativas (Ontem/Hoje) são RECENTES.
Você recebe ${imgs.length} print(s) de uma conversa de WhatsApp entre um CORRETOR (Construtora Senger — Carazinho e Ibirubá/RS) e um CLIENTE. Leia cada imagem com MUITA ATENÇÃO e TRANSCREVA a conversa NA ÍNTEGRA, mensagem por mensagem, do jeito que está escrita. NÃO resuma, NÃO encurte, NÃO omita falas. Quero o diálogo completo dos dois lados.
COMO LER UM PRINT DE WHATSAPP:
- Os balões à DIREITA (geralmente verdes/claros) são do CORRETOR (quem enviou). Marque essas falas como "Você:".
- Os balões à ESQUERDA são do CLIENTE. Marque como "Cliente:".
- Há SEPARADORES DE DATA no meio da conversa ("Ontem", "Hoje", "12 de maio", "15 de maio de 2025") e HORÁRIOS em cada balão (ex.: 16:05). CAPTURE a data e o horário de cada mensagem.
- Se houver vários prints, junte-os na ORDEM cronológica (de cima pra baixo, do print mais antigo pro mais recente). Quando dois prints se sobrepõem (mostram a mesma mensagem), transcreva a mensagem UMA vez só.
FORMATO DA TRANSCRIÇÃO (siga à risca):
- Uma linha por mensagem, na ordem em que aparecem. Formato: "[DATA HORÁRIO] Você: texto" ou "[DATA HORÁRIO] Cliente: texto".
- Use a data do último separador de data visível acima da mensagem; se só tiver o horário, use "[HORÁRIO]". Ex.: "[15/05 08:33] Cliente: Gostaria de mais informações dos terrenos do novo loteamento da vila rica".
- Transcreva o TEXTO LITERAL de cada balão, inclusive valores, links e números (ex.: "R$ 95.000,00", "26 RUA LARANJEIRA 290,00"). Pode manter emojis se ajudarem a entender.
- Quando o separador de data muda no meio da conversa, pode colocar uma linha só com a data (ex.: "— 16 de maio de 2025 —") antes de seguir.
- NÃO invente nada. O que estiver cortado/ilegível, pule (não chute). Se um balão estiver parcialmente cortado, transcreva só a parte legível.
- Texto de ANÚNCIO/post compartilhado (card de propaganda, "LANÇAMENTO IMPERDÍVEL", "LOTEAMENTO NOVA VILA RICA III — Entrada 10%...") NÃO é fala de ninguém — é PROPAGANDA. Marque numa linha como "[HORÁRIO] Você: (anúncio compartilhado: Loteamento Nova Vila Rica III)" e NÃO transcreva o panfleto inteiro nem atribua como fala do cliente.
- Português do Brasil, exatamente como escrito (não corrija a fala do cliente).
DATA DA ÚLTIMA MENSAGEM: identifique a DATA da mensagem MAIS RECENTE que aparece no(s) print(s) (o último contato real, do cliente OU do corretor). Devolva em "dataUltimaISO" no formato AAAA-MM-DD, usando os separadores de data e horários visíveis. Se o ano não aparecer, deduza pelo contexto das outras datas. Se for IMPOSSÍVEL determinar a data com segurança, devolva "dataUltimaISO": "".
Responda APENAS JSON: { "texto": "transcrição completa aqui, uma mensagem por linha", "dataUltimaISO": "AAAA-MM-DD ou vazio" }.`;
  const content = [{ type: "text", text: instrucao }, ...imgs.map(u => ({ type: "image_url", image_url: { url: u, detail: "high" } }))];
  const modelos = [...new Set([modeloVisao(), "gpt-4o-mini"])];
  let ultimoErro = "";
  for (let i = 0; i < modelos.length; i++) {
    try {
      const completion = await openai.chat.completions.create({
        model: modelos[i],
        messages: [{ role: "user", content }],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: "json_object" }
      }, { timeout: i === 0 ? 44000 : 30000, maxRetries: 0 });
      const raw = completion?.choices?.[0]?.message?.content || "{}";
      let p; try { p = JSON.parse(raw); } catch (_) { p = {}; }
      const texto = String(p.texto || "");
      // Data da última mensagem do print: só aceita AAAA-MM-DD plausível (não-futura). Caso contrário, vazio.
      let dataUltimaISO = "";
      const mIso = String(p.dataUltimaISO || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mIso) {
        const d = new Date(`${mIso[1]}-${mIso[2]}-${mIso[3]}T12:00:00`);
        if (!isNaN(d.getTime()) && d.getTime() <= Date.now() + 24 * 60 * 60 * 1000) dataUltimaISO = d.toISOString();
      }
      // Guard contra ano errado em print com datas RELATIVAS (foi o bug do "981 dias"): se a
      // transcrição termina em "Hoje"/"Ontem", a conversa é ATUAL — ancora na data real.
      const ultimoTrecho = texto.slice(-400).toLowerCase();
      const diasAtras = dataUltimaISO ? Math.floor((Date.now() - new Date(dataUltimaISO).getTime()) / 86400000) : null;
      if (/\bhoje\b/.test(ultimoTrecho)) {
        dataUltimaISO = _nowP.toISOString();
      } else if (/\bontem\b/.test(ultimoTrecho) && (diasAtras == null || diasAtras > 2)) {
        dataUltimaISO = _ontemP.toISOString();
      } else if (diasAtras != null && diasAtras > 400) {
        // Data muito antiga sem âncora confiável → deixa vazio (o app usa a data de hoje no registro).
        dataUltimaISO = "";
      }
      // Foto do cliente: igual ao "extrair-print" (editar lead) — a IA erra demais a posição,
      // então usamos a POSIÇÃO PADRÃO da fotinha de perfil no TOPO do print de conversa (canto
      // superior-esquerdo, ao lado do nome). Recorte vazio/silhueta é descartado no front (fotoQuaseVazia).
      const avatarBox = { x: 0.16, y: 0.05, w: 0.10, h: 0.048 };
      return json(res, 200, { ok: true, texto: texto.slice(0, 12000), dataUltimaISO, avatarBox });
    } catch (e) {
      ultimoErro = e?.message || "falha ao ler os prints";
    }
  }
  return json(res, 200, { ok: false, error: ultimoErro || "Falha ao ler os prints." });
}

async function acaoCriarManual(body, res) {
  const nome = String(body?.nome || "").trim().slice(0, 120);
  const telefone = String(body?.telefone || "").trim().slice(0, 40);
  const produto = String(body?.produto || "").trim().slice(0, 80);
  const observacao = String(body?.observacao || "").trim().slice(0, 2000);
  // Foto do cliente recortada do print (dataURL pequeno). Só aceita imagem e tamanho sensato (~80KB).
  let avatarFoto = String(body?.avatarFoto || "");
  if (!/^data:image\//.test(avatarFoto) || avatarFoto.length > 110000) avatarFoto = "";
  if (!nome) return json(res, 400, { ok: false, error: "Informe o nome do lead." });
  try {
    const now = new Date();
    const p2 = (n) => String(n).padStart(2, "0");
    const dataBR = `${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()}`;
    const horaBR = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
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
    const primeiroNome = nome.split(/\s+/)[0];
    // Perfil: característica curta extraída da observação (ou genérica)
    const perfilCurto = observacao
      ? observacao.slice(0, 120) + (observacao.length > 120 ? "…" : "")
      : `${nome}${produto ? ` — interesse em ${produto}` : ""}`;
    // "Por quê este lead": motivo de ele estar na fila (diferente do perfil)
    const porQue = produto
      ? `Cliente novo demonstrou interesse no ${produto} (sem conversa no WhatsApp ainda). Iniciar contato pra qualificar.`
      : `Cliente novo entrou em contato (sem conversa no WhatsApp ainda). Iniciar abordagem pra qualificar interesse.`;
    // Mensagem direta pré-rascunhada — sempre tem (telefone pode estar vazio)
    const msgDireta = `Oi ${primeiroNome}, tudo bem? Aqui é da Senger.${produto ? ` Vi que você demonstrou interesse no ${produto}.` : " Tudo bem por aí?"} Posso te passar mais info ou tirar alguma dúvida?`;
    const msgConsultiva = `Oi ${primeiroNome}, tudo certo? Aqui é da Senger.${produto ? ` Soube do seu interesse no ${produto}.` : ""} Antes de te passar material, queria entender melhor o que você busca — é pra morar, investir, ou algo específico em mente?`;
    const msgRetomada = `Oi ${primeiroNome}, tudo bem? Aqui é da Senger${produto ? `, sobre o ${produto}` : ""}. Me conta o que você gostaria de saber primeiro — pode mandar suas dúvidas que eu te respondo.`;
    const result = {
      lead: { clientName: nome, phone: telefone, etapa: "Novo" },
      analysis: {
        clientName: nome, // garante que nameFrom() pega "Bocorni" e não o nome do arquivo
        origem: "manual", // marca lead criado à mão — não pode ser engolido pela deduplicação por nome
        lead: { clientName: nome, phone: telefone },
        clientProfile: perfilCurto,
        avatarFoto: avatarFoto || undefined,
        produtoInteresse: produto || "Não identificado",
        produtosInteresse: produto ? [produto] : [],
        etapaSugerida: "Novo",
        probability: "20%",
        probabilityPercent: 20,
        confianca: 30,
        tipoRetomada: "primeiro-contato",
        tipoContato: "cliente-final",
        _schemaComercial: 684,
        modeloComercial: {
          versao: 684,
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
        messages: {
          direta: msgDireta,
          consultiva: msgConsultiva,
          retomada: msgRetomada
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
      fileSize: null
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
async function acaoNovaOportunidadeParceiro(body, res) {
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
  const p2 = n => String(n).padStart(2, "0");
  const dataBR = `${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()}`;
  const horaBR = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
  const oportunidadeId = `opp-${randomUUID()}`;
  const contatoId = String(mcOrigem?.contato?.id || mcOrigem?.oportunidade?.contatoId || idOrigem);
  const obsLinha = observacao ? ` Observação: ${observacao}` : "";
  const motivo = `Nova oportunidade indicada por ${nomeParceiro} para ${compradorFinal}, com interesse em ${produto}.`;
  const mensagemA = `Sobre ${compradorFinal} e o ${produto}, me passa o que ele procura e a faixa de investimento para eu separar as opções mais adequadas?`;
  const mensagemB = `Para eu conduzir bem essa nova oportunidade no ${produto}, o que já está definido sobre perfil, prazo e forma de pagamento de ${compradorFinal}?`;
  const mensagemC = `Me atualiza sobre ${compradorFinal}: qual é a principal prioridade dele no ${produto} neste momento?`;

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
      probability: "25%",
      probabilityPercent: 25,
      confianca: 80,
      tipoRetomada: "primeiro-contato",
      tipoContato: "corretor-parceiro",
      _schemaComercial: 684,
      modeloComercial: {
        versao: 684,
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
      messages: {
        a: mensagemA, b: mensagemB, c: mensagemC,
        aLabel: "Qualificar perfil", bLabel: "Mapear condições", cLabel: "Definir prioridade", recomendada: "a",
        direta: mensagemA, consultiva: mensagemB, retomada: mensagemC
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
    fileSize: null
  });
  const novoId = persistence?.processing?.id;
  if (!novoId) return json(res, 500, { ok: false, error: "Não foi possível criar a nova oportunidade.", details: persistence?.warnings || [] });

  // Registra o vínculo também no contato/oportunidade de origem para auditoria.
  const vinculadas = Array.isArray(aOrigem.oportunidadesVinculadas) ? aOrigem.oportunidadesVinculadas.slice(-49) : [];
  vinculadas.push({ id: oportunidadeId, leadId: novoId, compradorFinal, produto, criadoEm: now.toISOString() });
  const origemAtualizada = {
    ...aOrigem,
    oportunidadesVinculadas: vinculadas,
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
    .eq("id", idOrigem);

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
async function acaoAtualizarComEvolucao(body, res) {
  const id = body?.id;
  const result = body?.result;
  if (!id) return json(res, 400, { ok: false, error: "Informe id do lead a atualizar." });
  if (!result || typeof result !== "object") return json(res, 400, { ok: false, error: "Informe result com a nova análise." });

  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const { data: current, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise, etapa, timeline_json")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const anterior = current.resultado_analise || {};
  const nova = result.analysis || {};

  // JUNTA a conversa que já estava salva com a do novo arquivo — sem perder mensagem
  // e sem repetir. Antes, a timeline nova SUBSTITUÍA a antiga: se os dois exports tinham
  // trechos diferentes (ex.: WhatsApp Business x WhatsApp normal, ou números diferentes),
  // o trecho que só estava no arquivo antigo se perdia. Agora os dois se somam.
  const timelineAntiga = Array.isArray(current.timeline_json) ? current.timeline_json : [];
  const timelineNova = Array.isArray(result.timeline) ? result.timeline : [];
  const { mescladas: novaTimeline, preservadasDoAntigo } = mesclarTimelines(timelineAntiga, timelineNova);

  // Mensagens novas (as que NÃO estavam na conversa salva) = o que a IA usa pra avaliar o que mudou.
  const chavesAntigas = new Set(timelineAntiga.map(assinaturaMsg));
  const novasMensagens = timelineNova.filter(m => !chavesAntigas.has(assinaturaMsg(m)));

  // Na v669 a própria análise já recebeu o contexto anterior + somente as novidades.
  // Não faz uma segunda chamada de IA para comparar evolução: registra a mudança de forma
  // determinística e evita cobrança duplicada. Mantém o comparador antigo só para fluxos legados.
  let evolucaoEntry = null;
  const metaIncremental = result?.incrementalMeta;
  if (metaIncremental?.reimportacao && novasMensagens.length === 0) {
    evolucaoEntry = null;
  } else if (metaIncremental?.reimportacao) {
    const probAnt = Number(anterior?.probabilityPercent);
    const probNova = Number(nova?.probabilityPercent);
    let evoluiu = "estagnou";
    if (Number.isFinite(probAnt) && Number.isFinite(probNova)) {
      if (probNova >= probAnt + 5) evoluiu = "avancou";
      else if (probNova <= probAnt - 5) evoluiu = "esfriou";
    }
    const nomeLead = String(anterior?.clientName || anterior?.lead?.clientName || "").toLowerCase().split(/\s+/)[0];
    const clienteFalou = novasMensagens.some(m => {
      const autor = String(m?.author || "").toLowerCase();
      if (!autor) return false;
      if (nomeLead && (autor.includes(nomeLead) || nomeLead.includes(autor))) return true;
      return !/(senger|construtora|corretor|imobili|atendimento|sistema)/i.test(autor);
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
    try {
      const openai = getOpenAI();
      evolucaoEntry = await compararEvolucao({ anterior, atual: nova, novasMensagens, openai });
    } catch (_) { /* sem evolução não bloqueia a atualização */ }
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
    lembrete: anterior.lembrete || undefined,
    // Foto (avatar): mantém a do arquivo novo se veio, senão a que o corretor já tinha colado.
    // Sem isso, reimportar "pra atualizar" apagava a foto (a análise nova não traz avatar).
    avatarFoto: nova.avatarFoto || anterior.avatarFoto || undefined
  };
  const historicoEvolucao = Array.isArray(anterior.evolucao) ? anterior.evolucao.slice(-20) : [];
  if (evolucaoEntry) historicoEvolucao.push(evolucaoEntry);

  const merged = {
    ...nova,
    ...Object.fromEntries(Object.entries(preservado).filter(([, v]) => v !== undefined)),
    evolucao: historicoEvolucao,
    _atualizadoEm: new Date().toISOString()
  };

  // Mantém o ajuste manual de score do corretor (comando "aumentar/baixar score") —
  // senão reimportar a conversa zerava o que ele tinha ajustado na mão.
  const ajusteScoreManual = Number(anterior.scoreAjuste) || 0;
  if (ajusteScoreManual) merged.scoreAjuste = ajusteScoreManual;

  // Produto: queremos sempre um NOME PRÓPRIO (Gabro, Renaissance), nunca uma descrição ("apartamento de 2 dormitórios").
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
  const nomeNovo = nova.clientName || nova?.lead?.clientName || "";
  if (nomeRuim(nomeNovo) && !nomeRuim(nomeAnterior)) {
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

  const { error: putErr } = await supabase
    .from("whatsapp_processamentos")
    .update(updatePayload)
    .eq("id", id);
  if (putErr) return json(res, 500, { ok: false, error: putErr.message });

  return json(res, 200, {
    ok: true, id, evolucao: evolucaoEntry, totalEvolucoes: historicoEvolucao.length,
    // Quantas mensagens vieram só da conversa antiga (que o arquivo novo não trazia).
    // Se > 0, o frontend reanalisa em segundo plano pra a análise refletir tudo que foi juntado.
    preservadasDoAntigo, totalMensagens: novaTimeline.length
  });
}

// Junta duas timelines (a salva + a do novo arquivo) sem repetir mensagem e em ordem
// cronológica. A mesma mensagem aparece igual nos dois exports (mesma data/hora/autor/texto),
// então dá pra identificar o que é repetido. Áudio é identificado pelo arquivo (a transcrição
// pode variar uma palavra entre exports). Devolve as mescladas e quantas só estavam na antiga.
function assinaturaMsg(m) {
  if (!m || typeof m !== "object") return "";
  if (m.mediaFile) return "audio|" + String(m.mediaFile).toLowerCase().trim();
  const txt = String(m.text || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 200);
  const sig = [String(m.date || "").trim(), String(m.time || "").trim(), String(m.author || "").trim().toLowerCase(), txt].join("|");
  return sig.replace(/\|/g, "") ? sig : ""; // assinatura vazia (mensagem degenerada) => nunca deduplica
}

function mesclarTimelines(antiga, nova) {
  const a = Array.isArray(antiga) ? antiga : [];
  const b = Array.isArray(nova) ? nova : [];
  const vistos = new Set();
  const out = [];
  for (const m of [...a, ...b]) {
    const k = assinaturaMsg(m);
    if (k && vistos.has(k)) continue;
    if (k) vistos.add(k);
    out.push(m);
  }
  // Ordem cronológica (mesmo critério do pipeline). Reindexa id/order pra ficar sequencial.
  out.sort((x, y) => String(x.iso || "").localeCompare(String(y.iso || "")) || Number(x.order || 0) - Number(y.order || 0));
  out.forEach((m, i) => { if (m && typeof m === "object") { m.id = i + 1; m.order = i + 1; } });
  const chavesNovas = new Set(b.map(assinaturaMsg));
  const preservadasDoAntigo = a.filter(m => { const k = assinaturaMsg(m); return k && !chavesNovas.has(k); }).length;
  return { mescladas: out, preservadasDoAntigo };
}

// ============ ETAPA ============
async function acaoEtapa(id, etapa, res) {
  if (!ETAPAS_VALIDAS.includes(etapa)) {
    return json(res, 400, { ok: false, error: `Etapa inválida. Use uma de: ${ETAPAS_VALIDAS.join(", ")}` });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const direta = await supabase
    .from("whatsapp_processamentos")
    .update({ etapa, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (direta.error && /column .* does not exist|etapa.*does not exist/i.test(direta.error.message || "")) {
    const { data: current, error: getErr } = await supabase
      .from("whatsapp_processamentos")
      .select("resultado_analise")
      .eq("id", id)
      .maybeSingle();
    if (getErr) return json(res, 500, { ok: false, error: getErr.message });
    if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });
    const merged = { ...(current.resultado_analise || {}) };
    merged.lead = { ...(merged.lead || {}), etapa };
    const { error: putErr } = await supabase
      .from("whatsapp_processamentos")
      .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (putErr) return json(res, 500, { ok: false, error: putErr.message });
    return json(res, 200, { ok: true, id, etapa, storage: "json" });
  }

  if (direta.error) return json(res, 500, { ok: false, error: direta.error.message });
  if (!direta.data) return json(res, 404, { ok: false, error: "Lead não encontrado." });
  return json(res, 200, { ok: true, id, etapa, storage: "column" });
}

// ============ MEMÓRIA ============
async function acaoMemoriaGet(id, res) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });
  const { data, error } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise")
    .eq("id", id)
    .maybeSingle();
  if (error) return json(res, 500, { ok: false, error: error.message });
  if (!data) return json(res, 404, { ok: false, error: "Lead não encontrado." });
  const memoria = data.resultado_analise?.memoria || { preferencias: "", pessoasDecisao: "", pontosSensiveis: "", observacoes: "" };
  return json(res, 200, { ok: true, id, memoria });
}

async function acaoMemoriaSet(id, body, res) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const MAX = 5000;
  const clip = (v) => String(v || "").slice(0, MAX);
  const memoria = {
    preferencias: clip(body.preferencias),
    pessoasDecisao: clip(body.pessoasDecisao),
    pontosSensiveis: clip(body.pontosSensiveis),
    observacoes: clip(body.observacoes),
    atualizadoEm: new Date().toISOString()
  };

  const { data: current, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const merged = { ...(current.resultado_analise || {}), memoria };
  const { error: putErr } = await supabase
    .from("whatsapp_processamentos")
    .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (putErr) return json(res, 500, { ok: false, error: putErr.message });

  // Observações do corretor alimentam o conhecimento geral — fire-and-forget.
  const obsTexto = [body.observacoes, body.pontosSensiveis, body.preferencias].filter(Boolean).join(" | ");
  if (obsTexto.trim().length > 20) {
    const openai = getOpenAI();
    if (openai) atualizarConhecimentoCorretor(obsTexto, openai).catch(() => {});
  }

  return json(res, 200, { ok: true, id, memoria });
}

// ============ APRENDIZADO ============
async function acaoAprendizado(id, body, res) {
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
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const merged = { ...(current.resultado_analise || {}) };
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
    .eq("id", id);
  if (putErr) return json(res, 500, { ok: false, error: putErr.message });
  return json(res, 200, { ok: true, totalEventos: aprendizado.eventos.length });
}

// ============ APAGAR ============
// Edita nome e telefone do lead. Tenta atualizar colunas diretas (se existirem);
// sempre mescla também em resultado_analise pra garantir consistência com o front.
async function acaoEditarDados(id, body, res) {
  const nome = typeof body?.nome === "string" ? body.nome.trim().slice(0, 120) : null;
  const telefone = typeof body?.telefone === "string" ? body.telefone.trim().slice(0, 40) : null;
  // Produto/empreendimento definido na mão pelo corretor (quando a IA não identificou).
  const produto = typeof body?.produto === "string" ? body.produto.trim().slice(0, 80) : null;
  // Foto recortada do print (dataURL pequeno). Só aceita imagem e tamanho sensato (~80KB).
  let avatarFoto = String(body?.avatarFoto || "");
  if (!/^data:image\//.test(avatarFoto) || avatarFoto.length > 110000) avatarFoto = "";
  if (!nome && !telefone && !produto && !avatarFoto) return json(res, 400, { ok: false, error: "Informe nome, telefone, produto ou foto pra editar." });

  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });

  const { data: current, error: getErr } = await supabase
    .from("whatsapp_processamentos")
    .select("resultado_analise")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return json(res, 500, { ok: false, error: getErr.message });
  if (!current) return json(res, 404, { ok: false, error: "Lead não encontrado." });

  const merged = { ...(current.resultado_analise || {}) };
  if (nome != null) merged.clientName = nome;
  if (!merged.lead || typeof merged.lead !== "object") merged.lead = {};
  if (nome != null) merged.lead.clientName = nome;
  if (telefone != null) merged.lead.phone = telefone;
  if (avatarFoto) merged.avatarFoto = avatarFoto;
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

  let attempt = await supabase.from("whatsapp_processamentos").update(updates).eq("id", id).select("id").maybeSingle();
  if (attempt.error && /column .* does not exist|nome_cliente|telefone/i.test(attempt.error.message || "")) {
    // sem colunas diretas — salva só o merged
    attempt = await supabase
      .from("whatsapp_processamentos")
      .update({ resultado_analise: merged, atualizado_em: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle();
  }
  if (attempt.error) return json(res, 500, { ok: false, error: attempt.error.message });
  return json(res, 200, { ok: true, nome, telefone, produto });
}

async function acaoApagar(id, res) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(res, 500, { ok: false, error: "Supabase não configurado." });
  const { error } = await supabase
    .from("whatsapp_processamentos")
    .delete()
    .eq("id", id);
  if (error) return json(res, 500, { ok: false, error: error.message });
  return json(res, 200, { ok: true, id });
}
