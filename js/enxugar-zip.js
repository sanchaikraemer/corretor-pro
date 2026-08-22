// ============================================================================================
// v1270 — O QUE ENTRA NO ENVIO DE UMA CONVERSA GRANDE.
//
// Print do dono (14/08/2026): "Conversa do WhatsApp com Patricia Frasson Renaissance.zip
// (183.5 MB)" → "ZIP maior que o limite permitido de 150 MB." + "Tentar novamente". Um beco sem
// saída: tentar de novo dava exatamente o mesmo erro, e a conversa simplesmente não tinha como
// ser importada.
//
// O aparelho já enxugava o ZIP antes de enviar (jogava fora imagem, vídeo e documento), mas
// mandava TODO o áudio, de qualquer data. E aí está o desperdício: o servidor só transcreve o
// áudio das mensagens dentro do período (90 dias por padrão) — o áudio mais antigo era enviado,
// pago em tempo de celular e de internet, e descartado do outro lado sem virar uma linha de
// texto. Numa conversa de anos, é ele que estoura o limite sozinho.
//
// Este arquivo tem SÓ a regra de escolha — sem tela, sem rede, sem JSZip — pra o teste
// (tests/v1270-conversa-grande-cabe-no-envio.test.mjs) conseguir executá-la de verdade, e não
// conferir por leitura. A ordem de corte é sempre a mesma:
//
//   1. o texto da conversa NUNCA sai (é dele que sai a análise inteira);
//   2. áudio de mensagem fora do período sai sempre (o servidor não ia transcrever mesmo);
//   3. se ainda não couber, sai o áudio que não dá pra datar;
//   4. se ainda não couber, sai o áudio mais ANTIGO de dentro do período, um a um.
//
// Assim uma conversa grande sempre entra — no pior caso sem alguns áudios antigos, nunca com a
// importação inteira barrada.
// ============================================================================================

// Espelha DEFAULT_MAX_ZIP_BYTES de api/processar-storage.js — quem recusa o arquivo é a rota de
// envio, e é esse número que o aparelho precisa respeitar ANTES de tentar. O teste
// v1270 confere que os dois continuam iguais.
// v1355 — ERA 150 MB, E ERA MENTIRA. O print do dono mostra o envio RECUSADO com 56,5 MB: quem
// recusa não é esta conta nem esta rota, é o armazenamento, que na prática não aceita arquivo
// acima de ~50 MB. Enquanto o aparelho achava que podia mandar 150 MB, toda conversa entre 50 e
// 150 MB era montada, subida por minutos e recusada no fim — beco sem saída, igual ao da v1270,
// só que mais tarde. Com o número real aqui, a escolha de áudio corta ANTES de enviar e a conversa
// entra (sem os áudios mais antigos, com o aviso na tela), em vez de morrer no envio.
export const LIMITE_ENVIO_BYTES = 45 * 1024 * 1024;
// Sobra pro cabeçalho do ZIP e pra qualquer diferença entre o tamanho estimado aqui e o tamanho
// real do arquivo gerado no celular. Melhor mandar um pouco menos do que voltar pro beco sem saída.
export const MARGEM_ENVIO_BYTES = 5 * 1024 * 1024;
// Cada arquivo dentro do ZIP custa alguns bytes de cabeçalho, além do conteúdo.
const CUSTO_POR_ARQUIVO_BYTES = 120;
// Teto de segurança da varredura lenta (a que compara nome de arquivo com o texto de cada
// mensagem). Numa conversa enorme com centenas de áudios sem casamento, ela não pode travar o
// celular: acima disso, o áudio sem casamento fica como "sem data" e só sai se faltar espaço.
const MAX_COMPARACOES_LENTAS = 4000000;

const AUDIO_EXT_RE = /\.(opus|ogg|mp3|m4a|wav|aac)$/i;
const REF_AUDIO_NO_TEXTO_RE = /[\w.\-]+\.(?:opus|ogg|mp3|m4a|wav|aac)\b/gi;

export function nomeSimples(caminho = "") {
  return String(caminho).split("/").pop().trim();
}

// Mesma normalização do servidor (normalizeComparable em api/_pipeline.js): é o que faz
// "‎<anexado: 00000042-AUDIO-2026-08-12-WA0003.opus>" casar com o arquivo de mesmo nome.
export function textoComparavel(texto = "") {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, " ")
    .trim();
}

function isoDaLinha(data, hora) {
  const [d, m, yRaw] = String(data).split("/").map(Number);
  const [hh, mm] = String(hora).split(":").map(Number);
  if (!d || !m || !yRaw || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const y = yRaw < 100 ? 2000 + yRaw : yRaw;
  // Mesmo ajuste do servidor (parseDateTime): o export do WhatsApp vem no horário do Brasil.
  const ts = Date.UTC(y, m - 1, d, hh + 3, mm, 0);
  return Number.isFinite(ts) ? ts : null;
}

const LINHA_COM_AUTOR = [
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\s*-\s*(?:.*?):\s*([\s\S]*)$/,
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\]\s*(?:.*?):\s*([\s\S]*)$/
];
const LINHA_SEM_AUTOR = [
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\s*-\s*([\s\S]*)$/,
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\]\s*([\s\S]*)$/
];

// Só o necessário pra datar áudio: quando a mensagem foi enviada e o que estava escrito nela.
// (O parse completo, com autor e limpeza, continua sendo o do servidor.)
export function lerMensagensDoTxt(txt = "") {
  const mensagens = [];
  let atual = null;
  for (const bruta of String(txt || "").split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    let achou = null;
    for (const padrao of LINHA_COM_AUTOR) {
      const m = linha.match(padrao);
      if (m) { achou = { ts: isoDaLinha(m[1], m[2]), texto: m[3] || "" }; break; }
    }
    if (!achou) {
      for (const padrao of LINHA_SEM_AUTOR) {
        const m = linha.match(padrao);
        if (m) { achou = { ts: isoDaLinha(m[1], m[2]), texto: m[3] || "" }; break; }
      }
    }
    if (achou) {
      if (atual) mensagens.push(atual);
      atual = achou;
    } else if (atual) {
      atual.texto += "\n" + linha;
    }
  }
  if (atual) mensagens.push(atual);
  return mensagens;
}

// Liga cada arquivo de áudio ao momento em que ele foi enviado na conversa. Duas passadas: a
// rápida procura o nome do arquivo escrito na mensagem (é o formato normal do export); a lenta
// só roda pro que sobrou, comparando o texto inteiro — é o mesmo casamento do servidor
// (findReferencedAudio), que também aceita o nome sem a extensão.
export function datarAudios(mensagens, caminhosDeAudio) {
  const porChave = new Map();
  for (const caminho of caminhosDeAudio) {
    const base = nomeSimples(caminho);
    const comExt = textoComparavel(base);
    const semExt = textoComparavel(base.replace(AUDIO_EXT_RE, ""));
    if (comExt && !porChave.has(comExt)) porChave.set(comExt, caminho);
    if (semExt && !porChave.has(semExt)) porChave.set(semExt, caminho);
  }

  const datas = new Map();
  const textosNormalizados = [];
  for (const msg of mensagens) {
    const texto = String(msg?.texto || "");
    const normalizado = textoComparavel(texto);
    textosNormalizados.push({ ts: msg?.ts ?? null, normalizado });
    if (msg?.ts == null || !normalizado) continue;
    const achados = texto.match(REF_AUDIO_NO_TEXTO_RE);
    if (!achados) continue;
    for (const bruto of achados) {
      const caminho = porChave.get(textoComparavel(bruto));
      if (caminho && !datas.has(caminho)) datas.set(caminho, msg.ts);
    }
  }

  const semData = caminhosDeAudio.filter(c => !datas.has(c));
  if (semData.length && semData.length * textosNormalizados.length <= MAX_COMPARACOES_LENTAS) {
    for (const caminho of semData) {
      const base = nomeSimples(caminho);
      const comExt = textoComparavel(base);
      const semExt = textoComparavel(base.replace(AUDIO_EXT_RE, ""));
      for (const { ts, normalizado } of textosNormalizados) {
        if (ts == null || !normalizado) continue;
        if ((comExt && normalizado.includes(comExt)) || (semExt && normalizado.includes(semExt))) {
          datas.set(caminho, ts);
          break;
        }
      }
    }
  }
  return datas;
}

function normalizarDias(valor) {
  const bruto = String(valor ?? "").trim().toLowerCase();
  if (!bruto) return 90;
  if (/^(all|todo|tudo|todos|inteiro|completo|0|null)$/i.test(bruto)) return null;
  const n = Number(bruto);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return 90;
}

/**
 * Decide o que vai no ZIP enviado.
 *
 * - `txt` — o texto da conversa (usado só pra datar os áudios).
 * - `audios` — [{ caminho, bytes }] na ordem em que aparecem no ZIP.
 * - `diasJanela` — o período de áudio da importação ("90", "all", ...).
 * - `bytesTexto` — quanto o(s) .txt ocupa(m).
 *
 * Devolve os caminhos que ficam, os que saem (com o motivo) e um resumo pra tela.
 */
export function planejarConteudoDoZip({
  txt = "",
  audios = [],
  diasJanela = 90,
  bytesTexto = 0,
  limiteBytes = LIMITE_ENVIO_BYTES,
  margemBytes = MARGEM_ENVIO_BYTES
} = {}) {
  const lista = (audios || []).map(a => ({
    caminho: String(a?.caminho || ""),
    bytes: Number(a?.bytes) || 0
  })).filter(a => a.caminho);

  const dias = normalizarDias(diasJanela);
  const mensagens = lerMensagensDoTxt(txt);
  const datas = lista.length ? datarAudios(mensagens, lista.map(a => a.caminho)) : new Map();

  let maisRecente = 0;
  for (const m of mensagens) if (m.ts != null && m.ts > maisRecente) maisRecente = m.ts;
  const corte = (dias != null && maisRecente) ? maisRecente - dias * 86400000 : null;

  const dentro = [];
  const fora = [];
  const semData = [];
  for (const audio of lista) {
    const ts = datas.get(audio.caminho);
    if (ts == null) { semData.push({ ...audio, ts: null }); continue; }
    if (corte != null && ts < corte) fora.push({ ...audio, ts });
    else dentro.push({ ...audio, ts });
  }

  // Do mais recente pro mais antigo: quem sai primeiro é sempre o mais velho.
  dentro.sort((a, b) => a.ts - b.ts);

  const alvoBytes = Math.max(0, limiteBytes - margemBytes);
  const custo = (a) => a.bytes + CUSTO_POR_ARQUIVO_BYTES;
  const totalDe = (grupos) => grupos.reduce((soma, g) => soma + g.reduce((s, a) => s + custo(a), 0), bytesTexto);

  const cortadosPorTamanho = [];
  let semDataMantidos = semData.slice();
  let dentroMantidos = dentro.slice();

  // 3. o áudio que não dá pra datar sai antes do datado: sobre ele não dá nem pra dizer se o
  //    servidor ia usar. Sai o primeiro do ZIP (na prática, o mais antigo).
  while (totalDe([semDataMantidos, dentroMantidos]) > alvoBytes && semDataMantidos.length) {
    cortadosPorTamanho.push(semDataMantidos.shift());
  }
  // 4. por último, o áudio mais antigo de dentro do período.
  while (totalDe([semDataMantidos, dentroMantidos]) > alvoBytes && dentroMantidos.length) {
    cortadosPorTamanho.push(dentroMantidos.shift());
  }

  const manter = new Set([...dentroMantidos, ...semDataMantidos].map(a => a.caminho));
  const manterNaOrdemDoZip = lista.filter(a => manter.has(a.caminho)).map(a => a.caminho);

  const bytesEstimados = totalDe([semDataMantidos, dentroMantidos]);
  return {
    manter: manterNaOrdemDoZip,
    fora: fora.map(a => a.caminho),
    cortadosPorTamanho: cortadosPorTamanho.map(a => a.caminho),
    resumo: {
      totalAudios: lista.length,
      mantidos: manterNaOrdemDoZip.length,
      foraDaJanela: fora.length,
      cortadosPorTamanho: cortadosPorTamanho.length,
      semDataMantidos: semDataMantidos.length,
      cortouPorTamanho: cortadosPorTamanho.length > 0,
      janelaDias: dias,
      conseguiuDatar: datas.size,
      bytesEstimados,
      alvoBytes,
      limiteBytes,
      // Só acontece se o TEXTO sozinho já passar do limite — aí não há corte de áudio que
      // resolva, e quem chama precisa dizer isso na tela em vez de tentar enviar.
      naoCabeNemSoTexto: bytesTexto + CUSTO_POR_ARQUIVO_BYTES > alvoBytes
    }
  };
}

// v1358 — ORDEM DO DONO (22/08/2026): "somente texto e áudio deve ser aceito na importação".
// A escolha de foto/PDF que existiu na v1353 (e o teto delas, v1355) foi removida junto com o
// envio: sem arquivo visual viajando, ela não tinha mais o que escolher. Vídeo nunca viajou.

// Frase pra tela, no idioma do corretor. Vazia quando não houve corte nenhum digno de nota.
export function fraseDoCorte(resumo) {
  if (!resumo || !resumo.totalAudios) return "";
  if (resumo.cortouPorTamanho) {
    const enviados = resumo.mantidos;
    const total = resumo.totalAudios;
    return `Esta conversa é grande demais pra enviar inteira. O texto foi completo, e dos ${total} áudios foram os ${enviados} mais recentes — os mais antigos ficaram de fora.`;
  }
  if (resumo.foraDaJanela > 0) {
    return `${resumo.foraDaJanela} ${resumo.foraDaJanela === 1 ? "áudio antigo ficou" : "áudios antigos ficaram"} fora do envio por estar${resumo.foraDaJanela === 1 ? "" : "em"} fora do período de áudio — o texto da conversa foi completo.`;
  }
  return "";
}
