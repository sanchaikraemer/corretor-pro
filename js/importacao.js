// ============================================================================================
// v1195 — PEDAÇO DA IMPORTAÇÃO (carregado só quando o corretor importa uma conversa).
//
// Estas 29 funções faziam parte do app.js e eram baixadas e interpretadas em TODA abertura do
// app — inclusive quando o corretor só queria ver a fila do dia. Elas só entram em cena quando
// um ZIP do WhatsApp é aberto (pelo compartilhamento ou pelo seletor de arquivo), então agora o
// app as busca nesse momento, e não antes.
//
// Quem acorda este arquivo: a ponte preguiçosa `processFile` no app.js — a ÚNICA porta de
// entrada (conferida por varredura de sintaxe: nenhuma outra função daqui é citada de fora).
//
// Tudo que vem de fora está importado logo abaixo. A lista é fechada: se alguém acrescentar aqui
// uma chamada a algo do app.js sem importar, o teste v1195-pedaco-importacao-fechado.test.mjs
// quebra apontando o nome — é o que impede o erro clássico de "esqueci de levar junto".
// ============================================================================================

import { state } from './state.js?v=__VERSION__';
import { qs, escapeHtml, toast } from './dom.js?v=__VERSION__';
import {
  TENTATIVAS_ENVIO,
  classificarFalhaEnvio,
  enviarComRetentativa,
  passouDoTempoParado
} from './envio-retentativa.js?v=__VERSION__';
import {
  LIMITE_ENVIO_BYTES,
  fraseDoCorte,
  planejarConteudoDoZip,
  escolherVisuaisDoZip,
  VISUAL_KEEP_RE
} from './enxugar-zip.js?v=__VERSION__';
import {
  formatarTamanhoArquivo,
  problemaAoAbrirOZip,
  problemaDoArquivoRecebido,
  problemaDoConteudoDoZip,
  tituloCurtoDaFalha
} from './conferir-conversa.js?v=__VERSION__';
import {
  CP_IMPORT_PENDENTE_KEY,
  cpErroDaIAEmPortugues,
  CP_IMPORT_PENDENTE_VALIDADE_MS,
  KEEP_RE,
  abrirLead,
  clearAnalysis,
  cp903Confirm,
  cpImportOverlayVisivel,
  cpImportacaoFalhouNaGravacao,
  cpRegistrarAtividade,
  cpUpgradeProHTML,
  cpioPararRelogioEtapa,
  descartarSharePendente,
  ensureJSZip,
  fetchComTimeout,
  finalizarSharePendente,
  getLeadDetail,
  getLeadsData,
  invalidarLeadDetail,
  invalidarLeadsCache,
  limparLead,
  loadRecentLeads,
  normalizarEtapa,
  obterCerebroConfigParaAnalise,
  pl,
  refreshAllSections,
  renderAnalysis,
  renderEtapas,
  setBotoesImportacao,
  show,
  showCard,
  userFriendlyError
} from '../app.js?v=__VERSION__';

// Quanto uma entrada do ZIP ocupa de verdade. Áudio do WhatsApp entra sem recompressão (STORE),
// então os dois números batem; quando o JSZip não informa nenhum, devolve 0 e o plano trata
// aquele áudio como "tamanho desconhecido" (ver planejarConteudoDoZip).
function tamanhoDaEntrada(entry){
  return Number(entry?._data?.uncompressedSize || entry?._data?.compressedSize || 0);
}

// v1309 — problema que o APARELHO já consegue ver no arquivo (veio vazio, não abre, não tem o
// texto da conversa dentro). Vira um erro marcado: quem chama para na hora, em vez de gastar o
// envio inteiro para o servidor recusar no fim com uma frase genérica.
function erroDaConversa(problema){
  const err = new Error(problema.mensagem);
  err.conversaInvalida = problema.motivo;
  err.tituloCurto = problema.titulo;
  return err;
}

async function slimZipKeepingTextAndAudio(file, onProgress, opcoes = {}){
  const JSZip = await ensureJSZip();
  let zip;
  try{
    zip = await JSZip.loadAsync(file);
  }catch(err){
    // Só quando a falha é reconhecidamente de arquivo (não é ZIP, veio pela metade, tem senha) é
    // que a importação para aqui. Qualquer outro tropeço continua caindo no plano B de sempre —
    // mandar o arquivo original e deixar o servidor decidir.
    const problema = problemaAoAbrirOZip(err);
    if(problema) throw erroDaConversa(problema);
    throw err;
  }

  const entries = [];
  zip.forEach((path, entry)=>{ if(!entry.dir) entries.push([path, entry]); });

  // v1353 — vídeo continua saindo sempre (o app não lê vídeo). O texto é obrigatório, o áudio
  // passa pela escolha da v1270 e a foto/PDF pela da v1353 — ver js/enxugar-zip.js.
  const uteis = entries.filter(([path]) => KEEP_RE.test(path));
  const textos = uteis.filter(([path]) => /\.txt$/i.test(path));
  const visuais = uteis.filter(([path]) => VISUAL_KEEP_RE.test(path));
  const audios = uteis.filter(([path]) => !/\.txt$/i.test(path) && !VISUAL_KEEP_RE.test(path));

  let txt = "";
  try{ if(textos[0]) txt = await textos[0][1].async("string"); }catch(_){ }

  // v1309 — mesma exigência do servidor (ele procura o .txt dentro do ZIP e recusa sem ele),
  // conferida aqui, antes do envio: sem o texto da conversa não há análise nenhuma a fazer.
  const problemaConteudo = problemaDoConteudoDoZip({ nomes: entries.map(([caminho]) => caminho), texto: txt });
  if(problemaConteudo) throw erroDaConversa(problemaConteudo);

  const plano = planejarConteudoDoZip({
    txt,
    audios: audios.map(([path, entry]) => ({ caminho: path, bytes: tamanhoDaEntrada(entry) })),
    diasJanela: opcoes.diasJanela,
    bytesTexto: textos.reduce((soma, [, entry]) => soma + tamanhoDaEntrada(entry), 0)
  });
  const audiosQueVao = new Set(plano.manter);
  // v1353 — foto e PDF entram DEPOIS do texto e do áudio: o que já funcionava não perde espaço.
  const planoVisuais = escolherVisuaisDoZip({
    txt,
    visuais: visuais.map(([path, entry]) => ({ caminho: path, bytes: tamanhoDaEntrada(entry) })),
    bytesJaUsados: plano.resumo?.bytesEstimados || 0
  });
  const visuaisQueVao = new Set(planoVisuais.manter);
  const selecionadas = uteis.filter(([path]) => /\.txt$/i.test(path) || audiosQueVao.has(path) || visuaisQueVao.has(path));

  const newZip = new JSZip();
  let kept=0;
  const dropped = entries.length - selecionadas.length;
  for(let i=0;i<selecionadas.length;i++){
    const [path, entry] = selecionadas[i];
    const data = await entry.async("uint8array");
    // v1141 — áudio do WhatsApp (.opus/.m4a/.mp3) JÁ É COMPRIMIDO: passar DEFLATE nele de novo
    // gasta segundos de processador do celular pra economizar quase nada (às vezes o arquivo até
    // cresce). Só o texto da conversa compensa compactar. Numa conversa com dezenas de áudios,
    // isso era parte do "por que demora tanto antes de sequer começar a subir".
    newZip.file(path, data, { compression: /\.txt$/i.test(path) ? "DEFLATE" : "STORE" });
    kept++;
    if(onProgress) onProgress({processed:i+1, total:selecionadas.length, kept, dropped});
  }

  const blob = await newZip.generateAsync({type:"blob", compression:"STORE"});
  const slim = new File([blob], file.name.replace(/\.zip$/i,"")+"-enxuto.zip", {type:"application/zip"});
  return { file: slim, kept, dropped, originalSize: file.size, slimSize: blob.size, plano, planoVisuais };
}

// v1132 — convite que aparece na análise de quem ainda não configurou a Inteligência Comercial.
// NÃO é aviso de erro nem bloqueio: a análise acima dele é real e utilizável, feita a partir da
// própria conversa. Ele só mostra o que o corretor GANHA ao configurar — que é o momento certo de
// pedir isso: depois de ele ver o sistema funcionando com a conversa dele, não antes.
function cpPreviaCerebroHTML(a){
  if(!a?.modoPrevia) return "";
  // v1137 — quando o aprendizado automático JÁ leu as conversas dele, dizer "a IA não conhece o
  // seu jeito" seria mentira (conhece — aprendeu sozinha). O que falta nesse caso são as condições
  // comerciais, que só ele pode confirmar. O servidor manda a marca (previaComAprendizado).
  const corpo = a.previaComAprendizado
    ? `<div class="small" style="margin-bottom:8px"><b>A IA já aprendeu seu jeito de falar com as suas conversas.</b><br>`+
      `O que ela ainda não tem são as suas condições comerciais — valores, empreendimentos, regras — e por isso evita afirmar preço, prazo ou localização.</div>`+
      `<div class="small" style="margin-bottom:10px;color:var(--soft)">Confirme isso uma vez e as mensagens saem completas: no seu tom e com as suas condições.</div>`
    : `<div class="small" style="margin-bottom:8px"><b>Esta análise saiu só da conversa que você enviou.</b><br>`+
      `A IA ainda não conhece o seu jeito de falar, os seus empreendimentos nem as suas condições — por isso ela evita afirmar preço, prazo ou localização e prefere oferecer confirmar.</div>`+
      `<div class="small" style="margin-bottom:10px;color:var(--soft)">Ensine isso uma vez e as próximas mensagens saem no seu tom, com as suas condições e as suas respostas de objeção.</div>`;
  return `<div style="margin-top:12px;padding:12px;background:var(--accent-soft);border:1px solid var(--accent-line);border-radius:12px">`+
    corpo+
    `<button type="button" class="btn" id="btnPreviaConfigurarCerebro" style="padding:11px 18px;font-size:14px">${a.previaComAprendizado ? "Confirmar minhas condições" : "Ensinar a IA a falar como eu"}</button>`+
    `</div>`;
}

function openAIErrorBlock(data){
  const blocks = [];
  if(data?.analysis?.mode === "erro_api" && data.analysis.error){
    blocks.push(
      '<div class="notice error" style="margin-top:10px">' +
      '<b>Análise (Cérebro Comercial) falhou:</b><br>' +
      // v1314 — em português quando o erro do provedor é conhecido; o texto técnico continua
      // disponível no Diagnóstico, que é onde ele serve.
      escapeHtml(cpErroDaIAEmPortugues(data.analysis.error) || data.analysis.error) +
      '<br><br><b>O que fazer:</b> ' + escapeHtml(data.analysis.nextAction || "Abra o Diagnóstico.") +
      '</div>'
    );
  }
  if(Number(data?.audiosComErro) > 0){
    blocks.push(
      '<div class="notice error" style="margin-top:10px">' +
      '<b>'+ data.audiosComErro +' '+ pl(data.audiosComErro, 'áudio falhou', 'áudios falharam') +' ao transcrever.</b><br>' +
      '<b>Motivo:</b> ' + escapeHtml(data.primeiroErroAudio || "abra o Diagnóstico") +
      '</div>'
    );
  }
  return blocks.join("");
}

// Exposta pra poder ser dirigida de fora (teste em navegador de verdade e diagnóstico): é o
// único ponto que decide se a tela cheia aparece, some ou espera uma decisão do corretor.
// Abre o lead com a tela cheia AINDA de pé e só a fecha depois — assim a troca é direto de
// "Pronto" pro cliente, sem a tela de importação aparecer no meio do caminho.
async function cpioFecharQuandoLeadAbrir(id){
  // v1223 — o cliente abriu: a decisão do topo cumpriu o papel e some junto. Sem isto ela ficava
  // de pé, e da próxima vez que ele entrasse na tela de importação encontrava a pergunta do
  // cliente ANTERIOR esperando resposta que já tinha sido dada ("uma tela nada a ver antes de
  // começar a importação").
  try{ cpFecharPerguntaTopo(); }catch(_){}
  try{ if(id) await abrirLead(id); }
  catch(_){}
  finally{ try{ cpImportOverlayVisivel(false); }catch(_){} }
}

// v1131 — traduz o motivo REAL de uma análise que voltou sem as três mensagens. O servidor já manda
// a razão em `validacaoSugestoes` (ver api/_pipeline.js: Cérebro sem instruções, limite diário
// atingido, OpenAI não configurada), mas o app jogava tudo fora e escrevia "Não foi possível
// analisar" — o corretor não tinha como saber que bastava configurar a Inteligência Comercial.
function cpMotivoAnalisePendente(analysis){
  const motivos = Array.isArray(analysis?.validacaoSugestoes) ? analysis.validacaoSugestoes.filter(Boolean).map(String) : [];
  const texto = motivos.join(" ");
  if(/[Cc]érebro|[Cc]erebro/.test(texto)){
    return "A Inteligência Comercial ainda não foi configurada. É ela que ensina a IA a falar como você — sem isso não há o que sugerir. Configure uma vez e importe de novo (a conversa já está guardada, você não precisa exportar outra).";
  }
  if(/[Ll]imite diário/.test(texto)){
    return texto + " A conversa já está guardada aqui — amanhã o limite zera e você importa sem exportar de novo.";
  }
  if(/OpenAI/i.test(texto)){
    return "A IA não está configurada neste servidor (chave da OpenAI ausente). Isso é configuração do sistema, não da sua conta.";
  }
  return texto || "A análise voltou sem as três mensagens sugeridas.";
}

// A ação que resolve cada motivo — vira o botão do aviso na tela de importação.
function cpAcaoAnalisePendente(analysis){
  const texto = (Array.isArray(analysis?.validacaoSugestoes) ? analysis.validacaoSugestoes : []).join(" ");
  if(/[Cc]érebro|[Cc]erebro/.test(texto)) return { rotulo: "Configurar a Inteligência Comercial", alvo: "cerebro" };
  return null;
}

function normalizarJanelaAudioCliente(valor){
  const raw = String(valor ?? "").trim().toLowerCase();
  if(/^(all|todo|tudo|todos|inteiro|completo|0)$/i.test(raw)) return "all";
  const n = Number(raw);
  if([30,60,90].includes(n)) return String(n);
  return "90";
}

function rotuloJanelaAudio(valor){
  const v = normalizarJanelaAudioCliente(valor);
  return v === "all" ? "todo o período" : `últimos ${v} dias`;
}

// v827 §7.4 — Padrão persistente da janela de áudio. Vem do Cérebro ("dias de
// importação"), com uma chave ESTÁVEL (sem número de versão, que antes zerava a cada
// atualização) como reserva, e 90 como último recurso.
function janelaAudioPadrao(){
  try{
    const cfg = typeof obterCerebroConfigParaAnalise === "function" ? obterCerebroConfigParaAnalise() : null;
    if(cfg && Number(cfg.diasImportacao) > 0) return normalizarJanelaAudioCliente(String(cfg.diasImportacao));
  }catch(_){}
  try{ const s = localStorage.getItem("corretor_pro_audio_window_days"); if(s) return normalizarJanelaAudioCliente(s); }catch(_){}
  return "90";
}

// v1141 — A JANELA "Período dos áudios" FOI REMOVIDA DA IMPORTAÇÃO.
//
// Ela parava TODA importação pra pedir uma escolha que, na prática, quase nunca muda alguma
// coisa: o período limita só a TRANSCRIÇÃO DE ÁUDIO. As mensagens escritas entram completas em
// qualquer opção e a análise (a etapa que realmente demora) lê a conversa inteira do mesmo jeito.
// Numa conversa com pouco áudio — o caso comum de reimportação — "30 dias" e "todo o período"
// dão exatamente o mesmo tempo e o mesmo resultado. O dono flagrou isso ("não importa se coloco
// 30 ou todo período, sempre demora o mesmo tempo") e, junto, a incoerência visual: a tela de
// progresso já aparecia atrás da pergunta (8%, "Recebendo"), como se algo estivesse rodando
// antes da decisão — foi a v1116 tentando esconder o anel, mas o card de progresso continuava lá.
//
// O período continua existindo por dentro: vem do que está salvo no Cérebro (90 dias por
// padrão). Desde a v1198 o campo saiu também da tela do Cérebro (decisão do dono) — é uma
// proteção de custo fixa, não uma escolha; o resultado da importação segue mostrando qual
// período foi aplicado. O que acabou foi o pedágio a cada importação.
function janelaAudioDaImportacao(){
  const final = janelaAudioPadrao();
  // Guarda a janela desta importação pra uma retentativa usar exatamente a mesma (o servidor só
  // reaproveita a extração já feita quando a janela é a mesma — ver prepararExtracaoPersistente).
  state.ultimaJanelaAudio = final;
  return final;
}

function criarImportId(){
  try{ if(globalThis.crypto?.randomUUID) return "imp-" + globalThis.crypto.randomUUID(); }catch(_){}
  return "imp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,12);
}

function cpSalvarImportPendente(importId, file){
  try{
    if(!importId || !file) return;
    localStorage.setItem(CP_IMPORT_PENDENTE_KEY, JSON.stringify({
      importId, fileName: file.name, fileSize: file.size, ts: Date.now()
    }));
  }catch(_){}
}

function cpImportIdParaArquivo(file){
  try{
    if(!file) return "";
    const raw = localStorage.getItem(CP_IMPORT_PENDENTE_KEY);
    if(!raw) return "";
    const info = JSON.parse(raw);
    if(!info || !info.importId) return "";
    if(Date.now() - Number(info.ts||0) > CP_IMPORT_PENDENTE_VALIDADE_MS) return "";
    if(info.fileName !== file.name || Number(info.fileSize) !== file.size) return "";
    return String(info.importId);
  }catch(_){ return ""; }
}

function cpLimparImportPendente(){
  try{ localStorage.removeItem(CP_IMPORT_PENDENTE_KEY); }catch(_){}
}

async function uploadLargeZipToSupabase(file, options = {}){
  state.ultimoArquivo = file;
  const importId = String(options.importId || state.activeImportId || criarImportId());
  state.activeImportId = importId;
  renderEtapas(1, "preparando envio seguro");

  const totalMb = file.size / 1024 / 1024;

  async function pedirUrlDeEnvio(){
    let metaRes;
    try{
      metaRes = await fetch("./api/criar-upload-url", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          fileName:file.name,
          size:file.size,
          contentType:file.type || "application/zip",
          importId
        })
      });
    }catch(_){
      // v1227 — sem conexão na hora de pedir a URL (o caso típico: a rede caiu no meio do envio
      // e ainda não voltou quando o laço tenta de novo). É a mesma queda de rede do envio e tem
      // que ser tratada igual: marcada como repetível pro laço gastar as tentativas que prometeu,
      // em vez de estourar com um erro cru de "Failed to fetch".
      throw classificarFalhaEnvio({ tipo:"rede", totalMb });
    }

    let meta;
    try{ meta = await metaRes.json(); }
    catch(e){ throw new Error("A rota de upload grande não respondeu em JSON."); }

    if(!metaRes.ok || !meta.ok){
      const partesErro = [
        meta.error,
        meta.details,
        meta.bucket ? `Armazenamento: ${meta.bucket}` : "",
        meta.bucketWarning ? `Aviso: ${meta.bucketWarning}` : ""
      ].filter(Boolean);
      throw new Error(partesErro.join("\n") || "Não foi possível preparar o upload grande.");
    }

    // Use a signed URL retornada pelo backend e faça PUT direto (compatível com Supabase).
    // Isso evita depender do cliente supabase-js no navegador para uploads assinados.
    const signedUrl = meta.signedUrl || meta.signedurl || meta.signed_url;
    if(!signedUrl){ throw new Error("Não consegui preparar o envio agora. Tente novamente em alguns segundos."); }
    return { meta, signedUrl };
  }

  // Uma tentativa de PUT. Erros de CONEXÃO (queda da rede, envio parado) e erros temporários do
  // servidor (5xx) são marcados com cpPodeTentarDeNovo pra o laço abaixo repetir sozinho; recusa
  // do arquivo (4xx) não é repetida, porque repetir daria o mesmo resultado.
  function enviarUmaVez(signedUrl, tentativa, tentativas){
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/zip');
      xhr.setRequestHeader('x-upsert', 'true');
      // v1199 — pedido do dono: quando o envio demora, ele não tinha como saber se estava
      // progredindo devagar ou se o app tinha travado (aconteceu com um ZIP pequeno, de só 5
      // mensagens — nada a ver com tamanho de arquivo). Agora mostra quantos MB já foram enviados
      // de verdade, e avisa se passar um tempo sem nenhum byte novo.
      const sufixo = tentativa > 1 ? ` · tentativa ${tentativa} de ${tentativas}` : "";
      let ultimoLoaded = 0, ultimoProgressoEm = Date.now(), desistiuPorParada = false;
      const encerrar = () => { clearInterval(vigiaLentidao); };
      xhr.upload.onprogress = function(evt){
        if(!evt.lengthComputable) return;
        const pct = Math.round((evt.loaded/evt.total)*60) + 20; // map progress into 20-80%
        qs("#progressBar").style.width = Math.min(95, pct) + "%";
        if(evt.loaded !== ultimoLoaded){ ultimoLoaded = evt.loaded; ultimoProgressoEm = Date.now(); }
        const enviadoMb = (evt.loaded/1024/1024).toFixed(1);
        renderEtapas(1, `enviando a conversa — ${enviadoMb} de ${totalMb.toFixed(1)} MB${sufixo}`);
      };
      const vigiaLentidao = setInterval(() => {
        const parado = Date.now() - ultimoProgressoEm;
        if(parado < 12000) return;
        const enviadoMb = (ultimoLoaded/1024/1024).toFixed(1);
        // v1217 — antes o vigia só AVISAVA que estava parado e ficava avisando pra sempre: num
        // celular que perde o sinal no meio do envio, o XHR pode nunca disparar erro nenhum e a
        // importação ficava presa no mesmo número de MB. Passados 90s sem UM byte novo, corta a
        // tentativa — o laço de fora recomeça o envio, que é o que o dono faria na mão.
        if(passouDoTempoParado(parado)){
          desistiuPorParada = true;
          encerrar();
          try{ xhr.abort(); }catch(_){ }
          return;
        }
        renderEtapas(1, `enviando a conversa — ${enviadoMb} de ${totalMb.toFixed(1)} MB, está lento, aguarde — se a conexão cair o app tenta de novo sozinho${sufixo}`);
      }, 4000);
      const falha = (dados) => reject(classificarFalhaEnvio({ ...dados, totalMb, enviadoMb: ultimoLoaded/1024/1024 }));
      xhr.onload = function(){
        encerrar();
        if(xhr.status>=200 && xhr.status<300){ resolve(); return; }
        falha({ tipo:"http", status: xhr.status });
      };
      xhr.onerror = function(){ encerrar(); falha({ tipo:"rede" }); };
      xhr.onabort = function(){ encerrar(); falha({ tipo: desistiuPorParada ? "parado" : "abortado" }); };
      xhr.send(file);
    });
  }

  // v1217 — print do dono: ZIP de 54 MB no 4G morria na PRIMEIRA queda de conexão, com
  // "Falha de conexão durante o envio" e nada mais acontecendo até ele tocar em "Tentar
  // novamente" (que recomeçava tudo, inclusive o preparo do ZIP). Agora o próprio app repete o
  // envio, pedindo uma URL nova a cada tentativa (a anterior pode ter expirado) — o ZIP já
  // preparado é reaproveitado, então a repetição é só o envio. A regra em si mora em
  // js/envio-retentativa.js pra o teste conseguir executá-la de verdade.
  const vencedor = await enviarComRetentativa({
    totalMb,
    pedirUrl: () => pedirUrlDeEnvio(),
    enviar: (preparo, tentativa) => enviarUmaVez(preparo.signedUrl, tentativa, TENTATIVAS_ENVIO),
    esperar: (ms) => new Promise(r => setTimeout(r, ms)),
    avisar: (evento) => {
      if(evento.fase === "enviando"){
        renderEtapas(1, evento.tentativa === 1
          ? "enviando a conversa"
          : `reenviando a conversa (tentativa ${evento.tentativa} de ${evento.tentativas})`);
        return;
      }
      qs("#progressBar").style.width = "20%";
      renderEtapas(1, `a conexão caiu com ${evento.enviadoMb.toFixed(1)} de ${totalMb.toFixed(1)} MB enviados — recomeçando o envio em instantes (${evento.tentativa + 1} de ${evento.tentativas})`);
    }
  });
  const meta = vencedor.meta;

  qs("#progressBar").style.width="80%";
  state.ultimoUploadStorage = { bucket: meta.bucket, path: meta.path, importId };

  // Processa em ETAPAS (cada chamada cabe nos 10s do servidor):
  // 1) preparar → 2) transcrever em lotes → 3) analisar
  let analysisData;
  try{
    analysisData = await processarStorageEmEtapas(meta.bucket, meta.path, file.name, { audioWindowDays: options.audioWindowDays || state.ultimaJanelaAudio || "90", importId });
  }catch(err){
    // v1174 — A TELA CHEIA FICAVA POR CIMA DO ERRO. Esta é a causa do "chega em 92% e trava"
    // (print do dono, 06/08/2026): quando a análise falha, este ramo desenha o erro e os botões
    // na tela de baixo — mas NÃO passa por renderEtapas, que é o único lugar que fecha a tela
    // cheia da importação. Resultado: a tela de "Analisando pelo seu Cérebro" continuava de pé,
    // parada no teto do anel daquela etapa (92%), escondendo a explicação e os botões que já
    // estavam prontos atrás dela. Só o vigia de inatividade a derrubava, até 2 minutos depois —
    // e nesses 2 minutos não havia nada a fazer além de olhar. Fechar aqui é a primeira coisa.
    try{ cpImportOverlayVisivel(false); }catch(_){ }
    // Falha terminal desta etapa: libera de novo "Nova análise" e "Diagnóstico"
    // pra o corretor poder recomeçar ou diagnosticar (este ramo não passa por
    // renderEtapas, então precisa reabilitar os botões explicitamente).
    setBotoesImportacao(false);
    qs("#progressBar").style.width="100%";
    const ehTimeout = err?.name === "AbortError" || /aborted|abort/i.test(String(err?.message||""));
    // v1131 — quando o servidor DISSE por que não saíram as três mensagens (Cérebro não
    // configurado, limite do dia, IA fora do ar), a tela mostra esse motivo e o botão que resolve —
    // em vez do antigo "Não foi possível analisar", que não dava nenhuma pista do que fazer.
    const pendente = err?.analisePendente?.analysis || null;
    const acao = pendente ? cpAcaoAnalisePendente(pendente) : null;
    // v1309 — o motivo sobe pro título. A explicação de verdade é desenhada no card "Resultado",
    // que num celular nasce abaixo da dobra: o print do dono (19/08/2026) mostrava só a frase
    // genérica "Não foi possível analisar." e nada mais, com o motivo esperando um rolar de tela.
    qs("#processingText").textContent = pendente
      ? "Falta um passo pra IA conseguir sugerir."
      : tituloCurtoDaFalha(err?.message, ehTimeout);
    showCard("resultCard", true);
    qs("#resultBox").className = pendente ? "notice" : "notice error";
    qs("#resultBox").innerHTML =
      (pendente ? "<b>A conversa foi lida, mas a IA ainda não pode sugerir as mensagens.</b><br><br>"
                : `<b>${escapeHtml(tituloCurtoDaFalha(err?.message, ehTimeout))}</b><br><br>`) +
      escapeHtml(pendente ? cpMotivoAnalisePendente(pendente) : userFriendlyError(err, file)) +
      `<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">${
        acao ? `<button type="button" class="btn" id="btnIrConfigurarCerebro" style="flex:1;min-width:200px">${escapeHtml(acao.rotulo)}</button>` : ""
      }<button type="button" class="btn${acao ? " secondary" : ""}" id="btnRetomarAnalise" style="flex:1;min-width:180px">Tentar analisar novamente</button><button type="button" class="btn secondary" id="btnDescartarUpload" style="flex:1;min-width:140px">Descartar importação</button></div>`;
    // v1309 — e a tela vai até a explicação: ela mora no card de baixo e, num celular, nasce
    // fora do campo de visão (foi o que o print do dono mostrou).
    try{ requestAnimationFrame(() => { qs("#resultCard")?.scrollIntoView({ block:"start" }); }); }catch(_){ }
    if(acao){
      qs("#btnIrConfigurarCerebro")?.addEventListener("click", () => {
        // A importação NÃO é descartada: fica guardada, e o botão "Tentar analisar novamente"
        // continua valendo quando ele voltar — sem precisar exportar a conversa de novo.
        toast("Configure a Inteligência Comercial e volte aqui pra analisar.");
        try{ show(acao.alvo); }catch(_){ }
      });
    }
    qs("#btnRetomarAnalise")?.addEventListener("click", async () => {
      const stored = state.ultimoUploadStorage;
      if(stored?.bucket && stored?.path){
        qs("#processingText").textContent = "Tentando de novo (sem reenviar o ZIP)...";
        try{
          const data = await processarStorageEmEtapas(stored.bucket, stored.path, file.name, { audioWindowDays: options.audioWindowDays || state.ultimaJanelaAudio || "90", importId: stored.importId || importId });
          qs("#progressBar").style.width="100%";
          qs("#processingText").textContent="Conversa processada.";
          renderProcessedResult(data, { fileName: file.name, fileSize: file.size, source:"storage-retry", bucket: stored.bucket, path: stored.path, importId: stored.importId || importId });
          // O ZIP compartilhado permanece pendente até o lead ser salvo, atualizado ou descartado.
          // Se o app fechar nesta tela, a conversa pode ser recuperada sem nova exportação.
          toast("Conversa processada. Confira e salve o lead.");
        }catch(e2){ toast("Ainda falhou: " + userFriendlyError(e2, file)); }
        return;
      }
      if(state.ultimoArquivo){ state.processing = false; processFile(state.ultimoArquivo); }
    });
    qs("#btnDescartarUpload")?.addEventListener("click", async () => {
      const msgDescartarUp = "Descartar esta importação e apagar os arquivos temporários?";
      const okDescartarUp = (typeof cp903Confirm === "function")
        ? await cp903Confirm({ titulo: "Descartar importação", mensagem: msgDescartarUp, ok: "Descartar", perigo: true })
        : confirm(msgDescartarUp);
      if(!okDescartarUp) return;
      const stored = state.ultimoUploadStorage;
      if(stored) await finalizarImportacaoStorage(stored);
      const shareId = String(state.pendingSharedRecordId || "");
      if(shareId) await finalizarSharePendente(shareId);
      state.ultimoUploadStorage = null;
      state.activeImportId = null;
      cpLimparImportPendente();
      state.ultimoArquivo = null;
      clearAnalysis();
      toast("Importação descartada.");
    });
    toast(ehTimeout ? "Tempo esgotado numa das etapas." : "Erro na análise.");
    return false;
  }

  qs("#progressBar").style.width="100%";
  qs("#processingText").textContent="Conversa processada.";
  renderProcessedResult(analysisData, { fileName: file.name, fileSize: file.size, source: "storage", bucket: meta.bucket, path: meta.path, importId });
  toast("ZIP processado. Confira e clique em Salvar lead.");
  return true;
}

// Orquestra o processamento em 3 etapas, cada chamada curta o suficiente pro servidor.
// O ZIP é baixado e extraído uma única vez; os lotes usam os áudios persistidos da extração.
async function processarStorageEmEtapas(bucket, path, fileName, options = {}){
  const importId = String(options.importId || state.activeImportId || "");
  if(!importId) throw new Error("Identificador da importação ausente.");
  async function chamar(payload, timeoutMs){
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs || 30000);
    try{
      const res = await fetch("./api/processar-storage", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ bucket, path, importId, cerebroConfig: obterCerebroConfigParaAnalise(), ...payload }), signal: ctrl.signal
      });
      const data = await res.json().catch(() => ({ ok:false, error:"Resposta inválida do servidor." }));
      if(!res.ok || !data.ok){
        const partes = [data.error, data.details, data.hint].filter(Boolean);
        const erro = new Error(partes.length ? partes.join("\n") : ("Erro HTTP "+res.status));
        erro.recoverable = data.recoverable === true;
        // v1174 — teto de análises do dia atingido: tentar de novo NUNCA vai dar certo, e cada
        // repetição só deixa o corretor mais tempo olhando a tela parada. Este sinal faz o fluxo
        // desistir na primeira resposta e mostrar logo o motivo verdadeiro.
        erro.limiteAtingido = data.limiteAtingido === true;
        if(data.upgrade) erro.upgrade = data.upgrade;
        throw erro;
      }
      return data;
    } finally { clearTimeout(to); }
  }

  renderEtapas(2, "baixando e extraindo uma única vez");
  // v1024 — dono relatou "tempo esgotado" em várias importações hoje, resolvido só ao tentar de
  // novo manualmente (2ª/3ª vez). Achado real: os prazos daqui (90s/70s/150s) são maiores que o
  // limite de 60s configurado pro servidor (vercel.json, maxDuration:60) — um ZIP grande o
  // bastante pra passar de 60s aqui é MORTO pela Vercel antes do navegador desistir sozinho, sem
  // chance de terminar. "transcrever" já tentava de novo automaticamente (1x); preparar/analisar
  // não tinham essa rede — agora têm, igual à transcrição. Reaproveita o manifesto já preparado
  // (prepararExtracaoPersistente é idempotente pro mesmo importId) e não repete cobrança de IA
  // além do necessário ("analisar" não grava nada no banco; só "Salvar lead" grava).
  let prep = null, erroPrep = null;
  for(let tentativa=1; tentativa<=2 && !prep; tentativa++){
    // v1143 — "analisarDireto": autoriza o servidor a já devolver a análise pronta nesta MESMA
    // resposta quando a conversa é pequena e não sobrou áudio pra transcrever (o caso do dono:
    // "2 ou 3 mensagens e sem áudio"). Assim a importação faz UMA viagem em vez de duas, sem
    // partida a frio extra, sem gravar/ler o manifesto de novo e sem a conversa inteira subir de
    // volta no corpo do pedido. Se o servidor não puder (ZIP grande, áudio pendente, qualquer
    // falha), ele devolve só a preparação e o fluxo segue igual ao de sempre, logo abaixo.
    // Na SEGUNDA tentativa nunca pede a análise junto: se a primeira morreu no teto de tempo do
    // servidor, a análise pode ter sido feita (e paga) sem a resposta chegar. Repetir só a
    // preparação — que é idempotente — e depois analisar separado nunca paga duas vezes à toa.
    try{ prep = await chamar({ action:"preparar", audioWindowDays:options.audioWindowDays || "90", analisarDireto: tentativa === 1 }, 90000); }
    catch(error){ erroPrep=error; if(error?.limiteAtingido) break; if(tentativa<2) await new Promise(r=>setTimeout(r,1200)); }
  }
  if(!prep) throw erroPrep || new Error("Falha recuperável ao preparar a importação.");
  // v1174 — o servidor já tentou analisar aqui dentro e o teto do dia recusou. Não adianta seguir
  // pra etapa "analisar": para agora, com o motivo real na tela.
  if(prep.limiteAtingido){
    const erroLimite = new Error(prep.limiteAtingido.error || "Limite de análises de IA atingido para esta conta.");
    erroLimite.limiteAtingido = true;
    if(prep.limiteAtingido.upgrade) erroLimite.upgrade = prep.limiteAtingido.upgrade;
    throw erroLimite;
  }
  // v1162 — O REAPROVEITAMENTO APARECE DURANTE O PROGRESSO, NÃO SÓ NO FIM. Pedido do dono: o quadro
  // verde do resultado "aparece tão rápido e muda tão rápido para o lead que não dá nem pra
  // perceber — por que não vai informando isso no decorrer, de 0% até 100%?". Cada etapa agora diz
  // o que foi reconhecido e o que foi (ou não) reaproveitado, na hora em que acontece.
  const infoClienteConhecido = prep?.leadAnterior
    ? `cliente já conhecido — ${Number(prep.leadAnterior.mensagensSalvas) || 0} mensagens já salvas serão comparadas`
    : "cliente novo nesta carteira";
  renderEtapas(2, infoClienteConhecido);
  const transcriptionMap = { ...(prep.cachedTranscriptions || {}) };
  const audiosTodos = Array.isArray(prep.audiosParaTranscrever) ? prep.audiosParaTranscrever : [];
  // v1027 — causa real de "reaproveitados" sempre 0 (mesmo reimportando o MESMO ZIP de
  // propósito, pra testar): esta função forçava minúsculas na chave de busca, mas o servidor
  // (normalizeName, api/_pipeline.js) NUNCA lowercasa — e nome de áudio do WhatsApp quase
  // sempre vem com prefixo maiúsculo ("AUD-...", "PTT-..."). "aud-123.opus" nunca batia com a
  // chave real "AUD-123.opus" guardada no manifesto: a busca sempre falhava, o contador sempre
  // mostrava 0 E o app retranscrevia (de novo, pagando de novo) áudio que já tinha cache pronto.
  const normalizarAudio = (v) => String(v || "").split(/[\\/]/).pop().trim();
  const audios = audiosTodos.filter(nome => !transcriptionMap[normalizarAudio(nome)]?.text);
  const audiosReaproveitados = audiosTodos.length - audios.length;
  // v1178 — quantos áudios ficaram SEM virar texto nesta importação e por quê (ver o bloco de
  // transcrição logo abaixo). Sem isso o corretor só via o áudio sumir da análise, sem motivo.
  let transcricaoLimiteDoDia = false;
  let audiosSemTranscricao = 0;

  if(audios.length){
    // v1131 — era 3. A v1122 subiu a capacidade do SERVIDOR de 4 pra 10 áudios ao mesmo tempo pra
    // acabar com a lentidão da importação — mas o app nunca mandava mais que 3 de cada vez, então
    // o servidor jamais chegava perto de usar os 10: a fila continuava igual, só que agora com uma
    // correção que parecia feita. Uma conversa com 30 áudios virava 10 idas e voltas em sequência,
    // cada uma pagando de novo a leitura do manifesto e dos arquivos.
    //
    // 8 (não 10) de propósito: a função tem 60 segundos de teto na Vercel, e cada lote também lê o
    // manifesto e baixa os áudios. 8 corta as idas e voltas pela metade e ainda sobra folga —
    // subir até o teto de 10 deixaria a margem curta demais num dia de banco lento.
    const LOTE = 8;
    for(let i=0; i<audios.length; i+=LOTE){
      const lote = audios.slice(i,i+LOTE);
      renderEtapas(3, `${Math.min(i+LOTE,audios.length)}/${audios.length} novos · ${audiosReaproveitados} reaproveitados`);
      let resposta = null, ultimoErro = null;
      for(let tentativa=1; tentativa<=2 && !resposta; tentativa++){
        try{ resposta = await chamar({ action:"transcrever", audioNames:lote }, 70000); }
        catch(error){ ultimoErro=error; if(tentativa<2) await new Promise(r=>setTimeout(r,1200)); }
      }
      if(!resposta) throw ultimoErro || new Error("Falha recuperável ao transcrever os áudios.");
      Object.assign(transcriptionMap, resposta.transcriptions || {});
      // v1178 — "parou de transcrever os áudios?" (dono, 07/08/2026). O teto diário de transcrição
      // (v1119) corta os áudios que passam da conta do dia e o servidor SEMPRE avisou isso nesta
      // resposta — mas o aviso ficou marcado no código como "metadado pra um aviso futuro" e nunca
      // chegou à tela. Quem importa via os áudios simplesmente não virarem texto, sem motivo
      // nenhum. O futuro é agora: o motivo aparece durante o progresso e no resultado.
      if(resposta.transcricaoLimiteAtingido === true) transcricaoLimiteDoDia = true;
    }
    audiosSemTranscricao = audios.filter(nome => !transcriptionMap[normalizarAudio(nome)]?.text).length;
    if(audiosSemTranscricao){
      renderEtapas(3, transcricaoLimiteDoDia
        ? `${audiosSemTranscricao} ${pl(audiosSemTranscricao, "áudio ficou", "áudios ficaram")} sem transcrever — teto de áudios do dia atingido`
        : `${audiosSemTranscricao} ${pl(audiosSemTranscricao, "áudio não pôde ser transcrito", "áudios não puderam ser transcritos")}`);
    }
  }else{
    renderEtapas(3, audiosReaproveitados ? `${audiosReaproveitados} ${pl(audiosReaproveitados, "transcrição reaproveitada", "transcrições reaproveitadas")}` : "sem áudio para transcrever");
  }

  renderEtapas(4, prep?.leadAnterior ? "analisando de novo, relendo só o que ainda não foi analisado" : "validando as três mensagens pelo Cérebro");
  // v1024 — mesma rede de segurança da etapa "preparar" acima: "analisar" não grava nada no
  // banco (só devolve o resultado pro navegador — quem grava é "Salvar lead", ação separada e
  // explícita), então repetir aqui não duplica nem gasta 2x à toa em caso de sucesso.
  let result = null, erroAnalise = null;
  // v1143 — a conversa era pequena e sem áudio pendente: a análise JÁ VEIO pronta na resposta do
  // preparar (uma viagem em vez de duas). Nada a pedir de novo aqui — repetir seria pagar a
  // análise duas vezes pela mesma conversa.
  if(prep?.analiseIncluida?.ok && !audios.length) result = prep.analiseIncluida;
  for(let tentativa=1; tentativa<=2 && !result; tentativa++){
    try{
      result = await chamar({
        action:"analisar",
        // v1141 — o cliente já salvo foi identificado na etapa anterior (por telefone, nome do
        // arquivo ou nome). Mandar o id aqui é o que permite ao servidor comparar com a conversa
        // já gravada: sem uma única mensagem nova, ele reaproveita a análise salva e NÃO chama a
        // IA (nem cobra). Antes esse id ficava só do lado do servidor, na etapa de preparar, e a
        // análise inteira era refeita e paga em toda reimportação.
        existingLeadId: prep?.leadAnterior?.id || "",
        txtFile:prep.txtFile,
        messages:prep.messages,
        audioFilesRelevantes:prep.audioFilesRelevantes,
        audioFilesForaDaJanela:prep.audioFilesForaDaJanela,
        transcriptionMap,
        // v1306 — o que a IA leu das imagens e dos PDFs desta conversa (feito na etapa de preparar,
        // onde os arquivos já estavam descompactados). Vai junto pra virar texto na linha do tempo.
        leiturasVisuais:prep.leiturasVisuais,
        // v1307 — e o que foi lido dos links que VOCÊ mandou na conversa.
        leiturasLinks:prep.leiturasLinks,
        janelaConversa:prep.janelaConversa,
        ignoredFilesCount:prep.ignoredFilesCount,
        ignoredFiles:prep.ignoredFiles,
        audiosTotalNoZip:prep.audiosTotalNoZip,
        audiosDescartadosPorJanela:prep.audiosDescartadosPorJanela,
        metricsBase:prep.metricsBase,
        audiosReaproveitados,
        audiosNovosSolicitados:audios.length
      }, 150000);
    }catch(error){
      erroAnalise=error;
      // v1174 — teto do dia atingido: não repete (repetir só dobra a espera com a mesma recusa).
      if(error?.limiteAtingido) break;
      if(tentativa<2) await new Promise(r=>setTimeout(r,1200));
    }
  }
  cpioPararRelogioEtapa();
  if(!result) throw erroAnalise || new Error("Falha recuperável ao analisar a conversa.");
  // v1131 — este ponto jogava a importação inteira no lixo e mostrava "Não foi possível analisar",
  // sem dizer por quê. Era o que acontecia com TODA conta nova: quem acabou de se cadastrar ainda
  // não configurou a Inteligência Comercial, o servidor devolve "Cérebro Comercial sem instruções
  // carregadas" — e o corretor via só um erro genérico, na primeira coisa que tentou fazer no app.
  //
  // Além de ser péssimo pra quem chega, contrariava a regra registrada em CLAUDE.md desde a v827-12:
  // uma análise NUNCA pode ser descartada inteira só porque as três mensagens não saíram. Agora o
  // motivo real vem junto e a tela explica o que fazer (ver mostrarAnaliseIncompleta).
  const msgs = result?.analysis?.messages || {};
  const trioOk = [msgs.a,msgs.b,msgs.c].every(v=>String(v||"").trim().length>=10);
  if(result?.analysis?.sugestoesPendentes === true || !trioOk){
    const erro = new Error(cpMotivoAnalisePendente(result?.analysis));
    erro.analisePendente = result;
    throw erro;
  }
  result.importId = importId;
  // v1178 — vai junto pro resultado: é o que a tela usa pra dizer, em português, por que um áudio
  // desta conversa não virou texto (ver renderProcessedResult).
  result.audiosSemTranscricao = audiosSemTranscricao;
  result.transcricaoLimiteDoDia = transcricaoLimiteDoDia;
  // v1069 — bug real relatado pelo dono: "Análises feitas" (Desempenho) só contava reanálise
  // manual de um lead já existente (ui670Reanalisar); a análise que a IA faz
  // em TODA importação nova (esta etapa "analisar", que roda pra cada ZIP processado) nunca
  // registrava atividade — por isso "Importações" (90) e "Análises feitas" (19) nunca batiam,
  // mesmo cada importação passando pela IA. Conta aqui, no sucesso real da análise.
  try{ cpRegistrarAtividade("analise"); }catch(_){}
  // v1089 — esta etapa NÃO esconde mais a tela cheia. No caminho normal (a esmagadora maioria) o
  // app salva sozinho logo em seguida — não há confirmação nenhuma pra pedir. Esconder aqui fazia
  // a tela de importação, com os cartões, aparecer por um instante e a tela cheia voltar logo
  // depois: era a "tela que aparecia no meio da análise e voltava pro carregamento" que o dono
  // relatou. Quem esconde agora é só o ÚNICO caso que realmente espera uma decisão dele (nome só
  // parecido — ver renderProcessedResult).
  // v1162 — a etapa conta NA HORA o que a comparação decidiu (pedido do dono: essa informação
  // "aparece tão rápido que não dá nem pra perceber" no quadro do fim — agora ela mora aqui, no
  // decorrer do progresso, e fica na tela enquanto salva).
  const incEtapa = result?.incrementalMeta || {};
  // v1221 — importar agora SEMPRE analisa (regra do dono). "Análise mantida" deixou de significar
  // economia e passou a significar problema: a análise nova não deu certo e a anterior foi
  // preservada pra ele não ficar sem nada. O texto tem que dizer isso, não o contrário.
  const resumoEtapa = incEtapa.reimportacao
    ? (incEtapa.analiseReutilizada
        ? "não consegui analisar agora — mantive a análise anterior"
        : `${Number(incEtapa.mensagensNovas) || 0} ${pl(Number(incEtapa.mensagensNovas) || 0, "mensagem nova", "mensagens novas")} — análise refeita`)
    : "";
  renderEtapas(5, resumoEtapa ? `preparando pra salvar · ${resumoEtapa}` : "preparando pra salvar");
  return result;
}

// v1178 — resumo curto de áudio que não virou texto, pra linha final da tela de importação (a
// que FICA na tela em "Concluído"). O quadro completo, com o motivo, sai no resultado da
// importação — mas o corretor quase sempre lê só esta linha antes de o cliente abrir.
function cpResumoAudioSemTexto(result){
  const n = Number(result?.audiosSemTranscricao) || 0;
  if(!n) return "";
  return result?.transcricaoLimiteDoDia === true
    ? `${n} ${pl(n, "áudio ficou", "áudios ficaram")} sem transcrever (teto de áudios do dia)`
    : `${n} ${pl(n, "áudio não virou texto", "áudios não viraram texto")}`;
}

// ============ RENDERIZAÇÃO + SALVAR/DESCARTAR ============
// v1223 — a caixa de decisão do topo (v1220) só pode existir ENQUANTO existe decisão pendente.
// Print do dono: "tá aparecendo uma tela nada a ver antes de começar a importação (e antes não
// tinha)" — era ela, sobrando na tela depois que o assunto acabou. Quem responde a pergunta ou
// descarta a importação fecha a caixa aqui; começar uma importação nova também limpa (clearAnalysis).
function cpFecharPerguntaTopo(){
  const caixa = qs("#perguntaTopo");
  if(!caixa) return;
  caixa.innerHTML = "";
  caixa.hidden = true;
}

async function renderProcessedResult(data, meta){
 try{
  const lead = data.lead || {};
  const analysis = data.analysis || {};
  const _msgsAnalise = analysis?.messages || {};
  const _temTrioAnalise = [_msgsAnalise.a, _msgsAnalise.b, _msgsAnalise.c].every(v => String(v || "").trim().length >= 10);
  if(!analysis || analysis.mode === "erro_api" || analysis.mode === "sem_api" || analysis.sugestoesPendentes === true || !_temTrioAnalise){
    // v1131 — mesma tradução usada na tela de importação: o motivo em português, não a lista crua
    // que o servidor manda ("Cérebro Comercial sem instruções carregadas.").
    const erroRender = new Error(analysis?.error || cpMotivoAnalisePendente(analysis));
    erroRender.analisePendente = data;
    throw erroRender;
  }
  state.lead = limparLead({
    name: lead.clientName || "Cliente importado",
    product: lead.product || "Produto não identificado",
    status: "Conversa processada (não salvo)",
    bestTime: analysis.bestTime || "—",
    id: null
  });
  state.pendingSave = {
    result: data,
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    source: meta.source,
    bucket: meta.bucket || null,
    path: meta.path || null,
    importId: meta.importId || data.importId || state.activeImportId || null,
    cerebroConfig: obterCerebroConfigParaAnalise()
  };

  qs("#clientName").value = state.lead.name;
  renderAnalysis(analysis, state.lead);

  const j = data.janelaConversa;
  const janelaHtml = (j && (j.tipo === "audio" || j.aplicado || j.todoPeriodo)) ?
    `<div style="margin-top:10px;padding:10px 12px;background:rgba(86,199,242,.06);border:1px solid rgba(86,199,242,.22);border-radius:10px;font-size:13px"><b style="color:var(--dados)">Período dos áudios:</b> ${j.todoPeriodo ? "todo o período" : `últimos ${j.dias} dias (${escapeHtml(j.janelaDe||"")} → ${escapeHtml(j.janelaAte||"")})`}. As mensagens escritas foram importadas completas. Áudios dentro do período: ${Number(j.totalAudiosNoPeriodo ?? (data.audioFiles||[]).length)} · fora do período: ${Number(data.audiosDescartadosPorJanela||j.totalAudiosForaDoPeriodo||0)}.</div>` : "";

  // v1270 — quando o aparelho precisou deixar áudio de fora pra a conversa caber no envio, isso
  // fica ESCRITO na tela. Antes o corretor recebia a análise sem saber que alguns áudios antigos
  // não entraram — e a alternativa velha era pior ainda: a importação inteira barrada.
  const corte = state.ultimoCorteZip;
  const corteZipHtml = (corte && corte.cortouPorTamanho)
    ? `<div style="margin-top:10px;padding:11px 13px;background:rgba(255,180,80,.10);border:1px solid rgba(255,180,80,.42);border-radius:10px;font-size:13px;color:#ffd9a8">⚠️ ${escapeHtml(fraseDoCorte(corte))}</div>`
    : "";

  const sm = data.metrics || {};
  // v1348 — o aviso falava SÓ dos áudios. Na exportação sem mídia não é só o áudio que fica de
  // fora: foto, PDF, catálogo, tabela de preço — tudo vira "<Mídia oculta>" e some junto. Foi o
  // caso do print do dono (21/08/2026): três arquivos nas últimas mensagens, nenhum deles no envio.
  const semMidiaHtml = sm.exportadoSemMidia ? `<div style="margin-top:10px;padding:11px 13px;background:rgba(255,180,80,.10);border:1px solid rgba(255,180,80,.42);border-radius:10px;font-size:13px;color:#ffd9a8"><b>⚠️ Conversa enviada SEM os arquivos.</b> ${Number(sm.midiasOcultas)||0} ${(Number(sm.midiasOcultas)||0) === 1 ? "arquivo ficou de fora" : "arquivos ficaram de fora"} — <b>foto, PDF e áudio não vieram</b>, então a IA sabe que houve envio mas não o que tinha dentro. Se algum deles tinha preço, planta ou condição, isso ficou fora da análise. Abra o cliente e toque em <b>"Ler fotos, PDFs e áudios"</b> pra mandar esses arquivos agora — sem precisar exportar a conversa de novo.</div>` : "";
  // v1323 — FOTO E PDF QUE FICARAM DE FORA TAMBÉM PRECISAM APARECER AQUI.
  //
  // O aviso acima só existia pro caso da exportação sem mídia, e falava só dos áudios. Quando a
  // conversa vinha com os nomes dos arquivos mas eles não eram lidos (teto do dia, arquivo que não
  // veio no ZIP, conversa importada antes de o app saber ler imagem/PDF), a tela ficava muda: o
  // corretor recebia a análise sem saber que a arte com o preço nunca tinha sido vista pela IA.
  const naoLido = (analysis && typeof analysis.materialNaoLido === "object" && analysis.materialNaoLido) || null;
  const fotosForaCount = Number(naoLido?.imagens) || 0;
  const docsForaCount = Number(naoLido?.documentos) || 0;
  // v1348 — arquivo sem tipo ("<Mídia oculta>") também conta. Quando a exportação tem áudio E
  // linhas de mídia oculta, o aviso de cima não dispara e este era o único que poderia avisar —
  // e ele não enxergava esse caso.
  const semTipoCount = Number(naoLido?.arquivos) || 0;
  const materialNaoLidoHtml = (!sm.exportadoSemMidia && (fotosForaCount + docsForaCount + semTipoCount) > 0)
    ? `<div style="margin-top:10px;padding:11px 13px;background:rgba(255,180,80,.10);border:1px solid rgba(255,180,80,.42);border-radius:10px;font-size:13px;color:#ffd9a8"><b>⚠️ A IA não leu ${[
        fotosForaCount ? `${fotosForaCount} ${fotosForaCount === 1 ? "foto" : "fotos"}` : "",
        docsForaCount ? `${docsForaCount} ${docsForaCount === 1 ? "PDF" : "PDFs"}` : "",
        semTipoCount ? `${semTipoCount} ${semTipoCount === 1 ? "arquivo que não veio no envio" : "arquivos que não vieram no envio"}` : ""
      ].filter(Boolean).join(" e ")} desta conversa.</b> O que estiver escrito neles (preço, planta, condição) ficou de fora da análise. Abra o cliente e toque em <b>"Ler fotos, PDFs e áudios"</b> pra mandar esse material agora.</div>`
    : "";

  // v1178 — ÁUDIO QUE NÃO VIROU TEXTO AGORA DIZ POR QUÊ.
  //
  // "ta louco cara? parou de transcrever os áudios?" (dono, 07/08/2026). O app tinha três motivos
  // possíveis pra um áudio não virar texto — teto de áudios do dia (v1119), transcrição indisponível
  // e erro na transcrição — e NÃO MOSTRAVA NENHUM. O áudio simplesmente não aparecia na análise.
  // Quem usa não tem como adivinhar: ou o motivo está escrito na tela, ou o app "parou de funcionar".
  const semTranscricao = Number(data.audiosSemTranscricao) || 0;
  const audiosComErro = Number(data.audiosComErro) || 0;
  let motivoAudio = "";
  if(data.transcricaoLimiteDoDia === true){
    motivoAudio = `<b>Teto de áudios do dia atingido.</b> ${semTranscricao} ${pl(semTranscricao, "áudio ficou", "áudios ficaram")} sem transcrever hoje — o texto deles não entrou nesta análise. Importe esta conversa de novo amanhã que eles entram (o que já foi transcrito não é cobrado de novo).`;
  } else if(data.transcriptionEnabled === false){
    motivoAudio = `<b>Transcrição de áudio indisponível agora.</b> ${semTranscricao || "Os"} ${pl(semTranscricao || 2, "áudio ficou", "áudios ficaram")} sem virar texto e não entraram na análise.`;
  } else if(semTranscricao > 0 || audiosComErro > 0){
    const quantos = semTranscricao || audiosComErro;
    motivoAudio = `<b>${quantos} ${pl(quantos, "áudio não pôde ser transcrito", "áudios não puderam ser transcritos")}.</b> O texto deles não entrou nesta análise.${data.primeiroErroAudio ? ` Motivo do primeiro: ${escapeHtml(String(data.primeiroErroAudio))}` : ""}`;
  }
  const audioSemTextoHtml = motivoAudio
    ? `<div style="margin-top:10px;padding:11px 13px;background:rgba(255,180,80,.10);border:1px solid rgba(255,180,80,.42);border-radius:10px;font-size:13px;color:#ffd9a8">⚠️ ${motivoAudio}</div>`
    : "";
  const inc = data.incrementalMeta || {};
  const incrementalHtml = inc.reimportacao ? `<div style="margin-top:10px;padding:11px 13px;background:var(--acao-soft);border:1px solid var(--acao-line);border-radius:10px;font-size:13px;color:var(--acao)"><b>Atualização incremental:</b> ${Number(inc.mensagensNovas)||0} ${pl(Number(inc.mensagensNovas)||0, "mensagem nova", "mensagens novas")} · ${Number(inc.audiosNovosTranscritos)||0} ${pl(Number(inc.audiosNovosTranscritos)||0, "áudio novo transcrito", "áudios novos transcritos")} · ${Number(inc.audiosReaproveitados)||0} ${pl(Number(inc.audiosReaproveitados)||0, "áudio já pronto reaproveitado", "áudios já prontos reaproveitados")}.${inc.analiseReutilizada ? " <b>A análise nova não pôde ser concluída agora</b> (IA fora do ar ou teto de análises do dia) — a análise anterior foi mantida pra você não ficar sem nada. Tente de novo mais tarde pra ter a leitura atualizada." : ` A conversa foi analisada de novo — toda importação analisa.${Number(inc.mensagensPoupadasDaIA) > 0 ? ` <b>${Number(inc.mensagensPoupadasDaIA)} ${pl(Number(inc.mensagensPoupadasDaIA), "mensagem antiga não precisou", "mensagens antigas não precisaram")} ser relida${Number(inc.mensagensPoupadasDaIA) === 1 ? "" : "s"}</b> — o que já tinha sido analisado entrou como resumo, não como texto pago de novo.` : ""}`}</div>` : "";

  // Telefone é apenas dado auxiliar. A decisão de unir ou separar é acionada somente
  // quando o nome exportado coincide (ou se parece) com um nome já salvo.
  const match = await acharLeadExistente(state.lead.name, inc.existingLeadId || "");
  const existente = match?.lead || null;
  state.pendingExistente = existente;
  const perguntarNome = !!existente;
  const nomeSoParecido = perguntarNome && match.via === "nome-parecido";
  // v1223 — guarda que a atualização deste lead vai sair de uma RESPOSTA do corretor ("Sim, é o
  // mesmo"), e não de um nome idêntico reconhecido sozinho. É essa diferença que autoriza
  // renomear o cadastro (ver atualizarLeadComEvolucao e api/lead-update.js).
  state.pendingNomeSoParecido = nomeSoParecido;
  state.pendingNomeImportado = String(state.lead?.name || "");
  let acoesHtml;
  if(nomeSoParecido){
    // Nome mudou entre importações (ex.: contato editado no celular) mas não é idêntico ao
    // salvo — NUNCA funde sozinho aqui (ver nomesParecemMesmoCliente). Antes disso, esse caso
    // caía direto no "senão" abaixo e criava um cadastro novo em silêncio, sem avisar o
    // corretor, gerando duplicata (o cliente ficava com dois cadastros e o mais antigo parado
    // "esquecido" enquanto o novo tinha a conversa atualizada).
    // v1210 — QUEM É ESSE CLIENTE "QUE JÁ EXISTE"? (relato do dono, 11/08/2026, com três prints
    // seguidos: "só apareceu um Tales", "tb só tem um joel", "tudo tá parecido com outro q não
    // aparece na busca nem ativo nem arquivado".)
    //
    // A caixa mostrava só um nome. Pra conferir se aquele cadastro existia mesmo, ele tinha que
    // sair da importação e procurar na mão — e, quando o cadastro antigo tem o nome CURTO (sem o
    // empreendimento no fim), procurar pelo nome longo desta importação não acha nada, o que dá a
    // impressão de que o app inventou um cliente. Agora a caixa diz o que é aquele cadastro
    // (ativo ou arquivado, empreendimento, quanto tempo parado) e avisa o efeito do "Sim": o
    // cadastro antigo passa a se chamar como esta importação — é por isso que o nome curto some da
    // busca depois de juntar.
    const arquivadoExistente = normalizarEtapa(existente.etapa) === "Geladeira";
    const produtoExistente = String(existente.product || "").trim();
    const paradoExistente = Number.isFinite(Number(existente.daysSinceLastInteraction))
      ? `parado há ${Number(existente.daysSinceLastInteraction)} ${pl(Number(existente.daysSinceLastInteraction), "dia", "dias")}`
      : "";
    const fichaExistente = [
      arquivadoExistente ? "<b>arquivado</b>" : "<b>ativo</b>",
      produtoExistente ? escapeHtml(produtoExistente) : "",
      paradoExistente
    ].filter(Boolean).join(" · ");
    acoesHtml =
      `<div id="pendingBox" style="margin-top:14px;padding:12px;background:rgba(184,194,201,.08);border:1px solid var(--morno);border-radius:12px;color:var(--soft)"><b>Pode ser o mesmo cliente que já existe: “${escapeHtml(existente.name || "")}”.</b><br><span style="font-size:12px">Esse cadastro está ${fichaExistente}.</span><br>O nome desta importação (“${escapeHtml(state.lead.name)}”) é parecido, mas não idêntico. É o mesmo cliente?<br><span style="font-size:12px;color:var(--muted)">Se responder <b>Sim</b>, a conversa entra nesse cadastro e ele passa a se chamar “${escapeHtml(state.lead.name)}” — por isso o nome antigo deixa de aparecer na busca depois.</span></div>` +
      // v1211 — "existia, mas existia aonde?" (dono, 11/08/2026). Juntar é fácil, separar não é:
      // depois do "Sim", as duas conversas viram uma só e não há como desfazer. Então o momento de
      // conferir é ESTE, e até agora ele decidia no escuro, com um nome e nada mais. O botão abre o
      // cadastro apontado aqui mesmo — sem sair da importação (sair no meio é o caminho que já
      // travou a tela na v1192) e sem perder a análise que acabou de rodar.
      `<div style="margin-top:10px"><button type="button" id="btnVerCadastroParecido" class="btn secondary" style="width:100%;padding:10px 14px">Ver esse cadastro</button></div>` +
      `<div id="cadastroParecidoDetalhe" data-aberto="0" style="display:none;margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.03)"></div>` +
      `<div id="pendingActions" style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap"><button type="button" id="btnAtualizarLead" class="btn" style="flex:1;min-width:160px">Sim, é o mesmo — atualizar</button><button type="button" id="btnSalvarComoNovo" class="btn secondary" style="flex:1;min-width:160px">Não, é outro — salvar novo</button><button type="button" id="btnDescartarLead" class="btn secondary" style="flex:1;min-width:120px">Cancelar</button></div>`;
  }else if(perguntarNome){
    // v953 — pedido do dono: quando o nome bate EXATO (não "parecido"), não pergunta mais.
    // Ele nunca usou a opção "é outro" nesse caso. Atualiza direto; os botões ficam ocultos
    // só como caminho de retomada manual se a chamada automática falhar (ver mais abaixo).
    acoesHtml =
      `<div id="pendingBox" style="margin-top:14px;padding:12px;background:var(--acao-soft);border:1px solid var(--acao-line);border-radius:12px;color:var(--acao)"><b>Cliente existente identificado: “${escapeHtml(existente.name || state.lead.name)}”.</b><br>Atualizando o cadastro automaticamente, sem criar duplicata.</div>` +
      `<div id="pendingActions" style="display:none;gap:10px;margin-top:12px;flex-wrap:wrap"><button type="button" id="btnAtualizarLead" class="btn" style="flex:1;min-width:160px">Atualizar cliente</button><button type="button" id="btnDescartarLead" class="btn secondary" style="flex:1;min-width:120px">Cancelar</button></div>`;
  }else{
    acoesHtml =
      `<div id="pendingBox" style="margin-top:14px;padding:12px;background:var(--acao-soft);border:1px solid var(--acao-line);border-radius:12px;color:var(--acao)"><b>Salvando o lead...</b> Já abre com a análise.</div>` +
      `<div id="pendingActions" style="display:none;gap:10px;margin-top:12px;flex-wrap:wrap"><button type="button" id="btnSalvarLead" class="btn" style="flex:1;min-width:160px">Salvar lead</button><button type="button" id="btnDescartarLead" class="btn secondary" style="flex:1;min-width:160px">Cancelar</button></div>`;
  }

  // v1220 — "esse botão precisa aparecer logo na tela inicial sem ter que rolar pra baixo, senão
  // dá impressão que travou" (dono, 11/08/2026). A pergunta que SEGURA a importação sai do fim do
  // card de Resultado e vai pro topo da tela — os outros dois casos não perguntam nada (salvam
  // sozinhos), então continuam junto do resultado, onde não atrapalham.
  const caixaTopo = qs("#perguntaTopo");
  if(nomeSoParecido && caixaTopo){
    caixaTopo.innerHTML = `<div class="label">Precisa da sua resposta</div>` + acoesHtml;
    caixaTopo.hidden = false;
    acoesHtml = "";
  }

  qs("#resultBox").className = "small";
  qs("#resultBox").innerHTML =
    acoesHtml +
    `<div style="margin-top:14px">` +
    `<b>TXT:</b> ${escapeHtml(data.txtFile || meta.fileName)}<br>` +
    `<b>Áudios no histórico:</b> ${(data.audioFiles || []).length} · <b>transcritos:</b> ${data.audiosTranscritos || 0} · <b>com erro:</b> ${data.audiosComErro || 0}<br>` +
    // v1306 — imagem e PDF passaram a ser lidos: a tela agora mostra quantos viraram texto, ao lado
    // do que continua sendo ignorado (vídeo e o resto).
    `<b>Imagens/PDFs lidos:</b> ${data.visuaisLidos || 0} · <b>links lidos:</b> ${data.linksLidos || 0} · <b>arquivos ignorados:</b> ${data.ignoredFilesCount || 0}<br>` +
    `<b>Resumo:</b> ${escapeHtml(analysis.summary || "Conversa processada.")}<br>` +
    janelaHtml + corteZipHtml + semMidiaHtml + materialNaoLidoHtml + audioSemTextoHtml + incrementalHtml +
    `</div>` +
    cpPreviaCerebroHTML(analysis) +
    cpUpgradeProHTML(analysis) +
    openAIErrorBlock(data);
  qs("#btnPreviaConfigurarCerebro")?.addEventListener("click", () => { try{ show("cerebro"); }catch(_){ } });
  showCard("resultCard", true); showCard("timelineCard", true); showCard("goToTimelineCard", true);
  // v1220 — a rolagem pro topo NÃO pode acontecer aqui: enquanto a tela cheia da importação está
  // de pé, o corpo da página fica travado (body.cpio-aberto{overflow:hidden} no styles.css), então
  // qualquer scroll daqui não sai do lugar. Ela acontece no fim desta função, logo depois de a
  // tela cheia ser fechada — ver o bloco `if(nomeSoParecido)` mais abaixo.

  const timeline = (data.timeline || []).slice(-200).map(m =>
    `<div class="event"><b>${escapeHtml((m.date || "") + " " + (m.time || "") + " — " + (m.author || ""))}</b><p>${escapeHtml(m.text || "")}</p></div>`
  ).join("");
  qs("#timeline").innerHTML = timeline || (inc.reimportacao
    ? '<div class="event"><b>Nada novo nesta conversa</b><p>O arquivo não trouxe nenhuma mensagem que já não estivesse salva. A conversa completa continua no cadastro do cliente.</p></div>'
    : '<div class="event"><b>Conversa recebida</b><p>Arquivo processado.</p></div>');

  qs("#btnSalvarLead")?.addEventListener("click", salvarLeadPendente);
  qs("#btnSalvarComoNovo")?.addEventListener("click", salvarLeadPendente);
  qs("#btnDescartarLead")?.addEventListener("click", descartarLeadPendente);
  qs("#btnAtualizarLead")?.addEventListener("click", atualizarLeadComEvolucao);
  qs("#btnVerCadastroParecido")?.addEventListener("click", (ev) => verCadastroParecido(ev.currentTarget));
  if(nomeSoParecido){
    // Nome só parecido (não idêntico): espera o corretor confirmar se é o mesmo cliente ou
    // outro — a única ambiguidade real que ainda pergunta (ver v953 acima).
    // v1089 — É AQUI, e só aqui, que a tela cheia sai de cena: é o único momento em que a
    // importação para de verdade pra ouvir uma decisão. Sem isso, a pergunta ficaria coberta.
    try{ cpImportOverlayVisivel(false); }catch(_){}
    // v1219 — e a linha de andamento precisa DIZER isso. Até aqui ela continuava em "Salvando —
    // preparando pra salvar" com a rodinha girando, enquanto o app estava parado esperando a
    // resposta dele: o print do dono ("de novo dando pau") é exatamente essa tela. Agora ela para
    // de girar, muda de cor e diz o que falta — a resposta que está logo abaixo.
    renderEtapas(5, "responda a pergunta acima pra continuar", { aguardando: true });
    // v1220 — e a tela vai pro TOPO, onde a pergunta está: "esse botão precisa aparecer logo na
    // tela inicial sem ter que rolar pra baixo, senão dá impressão que travou" (dono). Só dá pra
    // rolar DEPOIS da linha acima, porque a tela cheia trava o corpo da página enquanto está de
    // pé. A segunda passada cobre a mudança de altura: o resto do resultado (análise, linha do
    // tempo) continua sendo escrito depois daqui.
    const irProTopo = () => {
      try{ window.scrollTo({ top: 0, behavior: "auto" }); }catch(_){ window.scrollTo(0, 0); }
      try{ qs("#perguntaTopo")?.scrollIntoView({ block: "start" }); }catch(_){ }
    };
    irProTopo();
    setTimeout(irProTopo, 120);
  }else if(perguntarNome){
    // Nome exato: já sabemos que é o mesmo cliente — atualiza direto, sem perguntar (v953).
    atualizarLeadComEvolucao();
  }else{
    salvarLeadPendente();
  }
 }catch(err){
  // Antes: erro aqui virava tela travada em silêncio (função chamada sem await/catch). Agora avisa.
  try{ cpImportOverlayVisivel(false); }catch(_){}
  const box = qs("#resultBox");
  if(box){
    box.className = "notice error";
    box.innerHTML = "<b>Deu erro ao mostrar o resultado.</b><br><br>" + escapeHtml(String(err?.message||err)) +
      `<div style="margin-top:14px"><button type="button" class="btn" onclick="location.reload()">Recarregar</button></div>`;
  }
  toast("Erro ao processar o resultado: " + (err?.message||err));
 }
}

// Divide um nome em palavras normalizadas (sem acento/maiúscula/pontuação) pra comparação.
function _palavrasNome(valor){
  return String(valor || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
    .split(" ").filter(Boolean);
}

// Detecta nome "quase igual" a um lead já salvo: acontece quando o corretor edita o nome
// do contato no celular entre uma importação e outra (ex.: acrescenta o empreendimento —
// "Fulano" vira "Fulano Empreendimento Tal"). Exige que as DUAS primeiras palavras (nome +
// sobrenome) sejam idênticas e que todas as palavras do nome mais curto apareçam, na mesma
// ordem, dentro do nome mais longo — só palavras A MAIS no meio/fim são toleradas. Isso NUNCA
// decide fusão sozinho (ver acharLeadExistente/renderProcessedResult): só sinaliza a dúvida
// pro corretor confirmar, porque nome parecido pode muito bem ser outra pessoa.
// v1211 — abre, DENTRO da pergunta, o cadastro que o app apontou como parecido: situação, produto,
// telefone, quando foi a última conversa e as últimas mensagens guardadas. É o que permite decidir
// "é o mesmo cliente?" olhando o cliente, e não só o nome dele. Nada aqui muda dado nenhum — é
// leitura pura, e a análise pendente continua intacta na memória enquanto o painel está aberto.
async function verCadastroParecido(btn){
  const existente = state.pendingExistente;
  const alvo = qs("#cadastroParecidoDetalhe");
  if(!alvo) return;
  if(!existente?.id){
    alvo.style.display = "block";
    alvo.innerHTML = `<div class="small" style="color:var(--muted)">Não consegui identificar esse cadastro agora.</div>`;
    return;
  }
  if(alvo.dataset.aberto === "1"){
    alvo.dataset.aberto = "0";
    alvo.style.display = "none";
    if(btn) btn.textContent = "Ver esse cadastro";
    return;
  }
  alvo.dataset.aberto = "1";
  alvo.style.display = "block";
  alvo.innerHTML = `<div class="small" style="color:var(--muted)">Abrindo o cadastro…</div>`;
  if(btn) btn.textContent = "Esconder esse cadastro";

  let completo = existente;
  try{ completo = await getLeadDetail(existente.id) || existente; }catch(_){ /* sem o histórico completo, mostra o que já temos */ }
  if(alvo.dataset.aberto !== "1") return; // fechou enquanto carregava

  const arquivado = normalizarEtapa(completo.etapa) === "Geladeira";
  const mensagens = Array.isArray(completo.recentMessages) ? completo.recentMessages.slice(-4) : [];
  const ultima = mensagens.length ? mensagens[mensagens.length - 1] : null;
  const quando = ultima ? `${ultima.date || ""} ${ultima.time || ""}`.trim() : "";
  const linhas = [
    `<b>${escapeHtml(completo.name || existente.name || "Cliente")}</b> — ${arquivado ? "arquivado" : "ativo"}`,
    completo.product ? escapeHtml(String(completo.product)) : "",
    completo.phone ? `Telefone: ${escapeHtml(String(completo.phone))}` : "",
    quando ? `Última mensagem guardada: ${escapeHtml(quando)}` : ""
  ].filter(Boolean);

  const historico = mensagens.length
    ? mensagens.map(m => `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line)"><div class="small" style="color:var(--muted)">${escapeHtml(`${m.date || ""} ${m.time || ""} — ${m.author || ""}`.trim())}</div><div style="font-size:13px;line-height:1.4">${escapeHtml(String(m.text || "").slice(0, 240))}</div></div>`).join("")
    : `<div class="small" style="margin-top:8px;color:var(--muted)">Esse cadastro não tem mensagens guardadas pra mostrar aqui.</div>`;

  alvo.innerHTML =
    `<div class="small" style="color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:950;font-size:10px;margin-bottom:6px">Cadastro que já existe</div>` +
    `<div style="font-size:13px;line-height:1.5">${linhas.join("<br>")}</div>` +
    `<div class="small" style="margin-top:10px;color:var(--muted)">Últimas mensagens desse cadastro:</div>` +
    historico +
    `<div class="small" style="margin-top:10px;color:var(--muted)">Se essas mensagens são deste mesmo cliente, responda <b>Sim</b>. Se for outra pessoa, responda <b>Não, é outro — salvar novo</b>: aí nada se mistura.</div>`;
}

function nomesParecemMesmoCliente(nomeA, nomeB){
  const a = _palavrasNome(nomeA);
  const b = _palavrasNome(nomeB);
  if(a.length < 2 || b.length < 2) return false;
  if(a[0] !== b[0] || a[1] !== b[1]) return false;
  const [menor, maior] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  for(const palavra of maior){
    if(i < menor.length && palavra === menor[i]) i++;
  }
  return i >= menor.length;
}

// v1176 — texto que não identifica cliente nenhum: vazio, rótulo genérico da importação ou um
// nome que na verdade é um número. Quando o nome é assim, ele não serve nem pra autorizar nem
// pra proibir uma fusão — quem decide é a outra pista (id do servidor, telefone, arquivo).
function nomeSemIdentidadeDeCliente(valor){
  const s = String(valor || "").trim();
  if(!s) return true;
  if(/^cliente( importad[oa])?$/i.test(s)) return true;
  if(/^cliente n[ãa]o identificad[oa]$/i.test(s)) return true;
  const digitos = s.replace(/\D/g, "");
  const letras = s.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  return digitos.length >= 8 && letras.length < 3;
}

// v1176 — "pode ser a mesma pessoa?" (mesma pergunta que a gravação faz do lado do servidor, em
// _nomesPodemSerOMesmoCliente). Vale pra nome idêntico, pra nome que só ganhou palavras
// ("Fulana" → "Fulana Sobrenome") e pra contato renomeado com o empreendimento no fim. Dois nomes
// de pessoas diferentes respondem NÃO — e aí nenhuma conversa entra no cadastro da outra.
function nomesPodemSerOMesmoCliente(nomeA, nomeB){
  if(nomeSemIdentidadeDeCliente(nomeA) || nomeSemIdentidadeDeCliente(nomeB)) return true;
  const a = _palavrasNome(nomeA), b = _palavrasNome(nomeB);
  if(!a.length || !b.length) return true;
  if(a.join(" ") === b.join(" ")) return true;
  const [menor, maior] = a.length <= b.length ? [a, b] : [b, a];
  if(menor.every((palavra, i) => maior[i] === palavra)) return true;
  return nomesParecemMesmoCliente(nomeA, nomeB);
}

// Procura na base inteira um lead com o mesmo nome técnico (maiúsculas, espaços e acentos ignorados)
// e, na ausência desse, um lead com nome só PARECIDO (ver nomesParecemMesmoCliente acima).
// Nomes apenas parecidos e telefone nunca decidem uma fusão automática — só levantam a pergunta.
async function acharLeadExistente(nome, idConhecido = ""){
  const norm = (valor) => String(valor || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
  const alvo = norm(nome);
  const idAlvo = String(idConhecido || "").trim();
  if(alvo.length < 2 && !idAlvo) return null;
  let leads = state.leads || [];
  try{
    const data = await getLeadsData(true);
    if(Array.isArray(data?.items)) leads = data.items.map(limparLead);
  }catch(_){}
  // v1141 \u2014 quando o SERVIDOR j\u00e1 identificou o cliente (por telefone, nome do arquivo ou nome, na
  // etapa de preparar), essa identifica\u00e7\u00e3o vale mais que a busca por nome daqui: \u00e9 ela que evitou
  // a rean\u00e1lise paga e o retrabalho de transcri\u00e7\u00e3o. Sem isso, um nome escrito diferente entre as
  // duas importa\u00e7\u00f5es fazia a tela seguir pelo caminho de "cliente novo" logo depois de o servidor
  // ter tratado tudo como reimporta\u00e7\u00e3o do mesmo cliente.
  // v1176 — ...mas essa identificação NÃO passa por cima do nome que está na tela. Print do dono
  // (07/08/2026): exportou a conversa de uma cliente e o app abriu o cadastro de OUTRA — o servidor
  // tinha reconhecido "o mesmo cliente" por um número de telefone escrito no meio da conversa, e
  // aqui o id era aceito de olhos fechados, atualizando o cadastro de outra pessoa sem perguntar
  // nada. Agora: nomes de gente diferente → o id não vale; nomes só parecidos → ele pergunta.
  if(idAlvo){
    const porId = leads.find(l => String(l?.id || "") === idAlvo);
    if(porId && nomesPodemSerOMesmoCliente(nome, porId.name)){
      const semDuvida = norm(porId.name) === alvo || nomeSemIdentidadeDeCliente(nome) || nomeSemIdentidadeDeCliente(porId.name);
      return { lead:porId, via: semDuvida ? "id-do-servidor" : "nome-parecido" };
    }
  }
  // v1180 — nome sem identidade ("Cliente não identificado", "Contato", só número) não procura
  // ninguém: dois cadastros com esse mesmo rótulo não são a mesma pessoa, e a busca exata logo
  // abaixo os juntaria em silêncio — o mesmo estrago que a v1176 tirou do telefone.
  if(alvo.length < 2 || nomeSemIdentidadeDeCliente(nome)) return null;
  const exato = leads.find(l => l?.id && norm(l.name) === alvo && !nomeSemIdentidadeDeCliente(l.name));
  if(exato) return { lead:exato, via:"nome-exato" };
  const parecido = leads.find(l => l?.id && nomesParecemMesmoCliente(nome, l.name));
  return parecido ? { lead:parecido, via:"nome-parecido" } : null;
}

async function finalizarImportacaoStorage(pending){
  const bucket = pending?.bucket, path = pending?.path, importId = pending?.importId;
  if(!bucket || !path || !importId) return { ok:true, skipped:true };
  try{
    const res = await fetch("./api/processar-storage", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ action:"finalizar", bucket, path, importId })
    });
    const data = await res.json().catch(()=>({ok:false,error:"Resposta inválida ao limpar a importação."}));
    if(!res.ok || !data.ok) throw new Error(data.error || "Não foi possível limpar os arquivos temporários.");
    return data;
  }catch(error){
    console.warn("Importação salva, mas limpeza temporária ficou pendente:", error?.message || error);
    return { ok:false, pending:true, error:error?.message || String(error) };
  }
}

async function confirmarAtualizacaoPersistida(id, importId, totalMensagensEsperado){
  const leadId = String(id || "").trim();
  if(!leadId) throw new Error("O servidor não devolveu o cadastro atualizado.");
  const token = String(importId || "").trim();
  let ultimoErro = null;
  for(let tentativa = 0; tentativa < 3; tentativa++){
    if(tentativa) await new Promise(r => setTimeout(r, 450 * tentativa));
    // v1028 — esta espera (até 3 tentativas, cada uma com até 20s de tempo limite) não mostrava
    // NENHUM progresso na tela — pra um lead com conversa longa (dezenas/centenas de áudios),
    // a etiqueta "Salvando" ficava parada o tempo todo, parecendo travado. Agora atualiza a
    // etapa visível a cada tentativa, mesmo sem nada de errado acontecer.
    renderEtapas(5, tentativa === 0 ? "confirmando gravação no banco de dados..." : `confirmando gravação no banco de dados (tentativa ${tentativa + 1} de 3)...`);
    try{
      invalidarLeadDetail(leadId);
      const res = await fetchComTimeout(`./api/lead-update?action=detalhe&id=${encodeURIComponent(leadId)}&_=${Date.now()}`, { cache:"no-store" }, 20000);
      const data = await res.json().catch(()=>({ok:false}));
      if(!res.ok || !data?.ok || !data?.item) throw new Error(data?.error || "O banco não confirmou a atualização.");
      const item = limparLead(data.item);
      const salvoToken = String(item?.analysis?._ultimaImportacao?.importId || "").trim();
      const totalSalvo = Number(item?.messageCount || item?.recentMessages?.length || 0);
      const tokenOk = !token || salvoToken === token;
      const timelineOk = !Number.isFinite(Number(totalMensagensEsperado)) || totalSalvo >= Number(totalMensagensEsperado || 0);
      if(tokenOk && timelineOk) return item;
      ultimoErro = new Error(`A atualização ainda não foi confirmada no banco (${totalSalvo} de ${Number(totalMensagensEsperado||0)} mensagens).`);
    }catch(error){ ultimoErro = error; }
  }
  throw ultimoErro || new Error("O banco não confirmou a atualização. O ZIP foi mantido para tentar novamente.");
}

async function atualizarLeadComEvolucao(){
  const existente = state.pendingExistente;
  if(!existente?.id || !state.pendingSave){ toast("Nada pra atualizar."); return; }
  const btn = qs("#btnAtualizarLead");
  if(btn){ btn.disabled = true; btn.textContent = "Atualizando..."; }
  // v1028 — mesma correção do salvamento novo: mostra progresso de verdade em vez de deixar a
  // etiqueta "Salvando" parada (ver confirmarAtualizacaoPersistida logo acima).
  renderEtapas(5, "salvando a atualização no banco de dados...");
  try{
    // v1080 — mesma correção do salvamento novo: este fetch não tinha limite de tempo e podia
    // travar a tela em "Salvando..." pra sempre se a rede engasgasse.
    const res = await fetchComTimeout("./api/lead-update", {
      method:"POST", headers:{"Content-Type":"application/json"},
      // v1223 — "quando clicar q é o mesmo e atualizar, já altere o nome no sistema para evitar
      // isso nas próximas análises do mesmo lead" (dono). O renomear só viaja quando a atualização
      // veio da resposta dele à pergunta do nome parecido — que é, aliás, o que a própria caixa
      // promete ("ele passa a se chamar…"). Reimportação de nome idêntico não manda nada, e a
      // proteção do nome curado na carteira continua valendo pra ela.
      body: JSON.stringify({ action: "atualizar-com-evolucao", id: existente.id, result: state.pendingSave.result, importId: state.pendingSave.importId, cerebroConfig: state.pendingSave.cerebroConfig,
        ...(state.pendingNomeSoParecido && state.pendingNomeImportado ? { renomearPara: state.pendingNomeImportado } : {}) })
    }, 45000);
    const data = await res.json().catch(()=>({ok:false,error:"Resposta inválida do servidor."}));
    if(!res.ok || !data.ok) throw new Error(data.error || "Erro ao atualizar.");
    const importacaoConcluida = state.pendingSave;
    const totalEsperado = Number(data.totalMensagens || importacaoConcluida?.result?.timeline?.length || 0);
    const confirmado = await confirmarAtualizacaoPersistida(existente.id, importacaoConcluida?.importId, totalEsperado);
    const incrementalMeta = state.pendingSave?.result?.incrementalMeta || null;
    const shareConcluidoId = String(state.pendingSharedRecordId || "");
    // v1143 — a faxina dos arquivos temporários (3 exclusões no armazenamento) era ESPERADA aqui,
    // com o corretor olhando a tela de "Salvando", só pra depois o cliente abrir. Ela não muda
    // nada do que ele vê: agora roda por trás. Se falhar, o sistema já tenta de novo sozinho
    // depois (a limpeza dos antigos), e o lead está salvo de qualquer jeito.
    const limpezaEmSegundoPlano = finalizarImportacaoStorage(importacaoConcluida).catch(() => ({ ok:false, pending:true }));
    const limpeza = { ok:true, adiada:true };
    state.pendingSave = null;
    state.activeImportId = null;
    cpLimparImportPendente();
    state.ultimoUploadStorage = null;
    state.pendingExistente = null;
    state.pendingNomeSoParecido = false;
    state.pendingNomeImportado = "";
    const ev = data.evolucao;
    const juntou = !incrementalMeta?.reimportacao && Number(data.preservadasDoAntigo||0) > 0; // no fluxo incremental, o servidor recebeu só as novidades de propósito
    const primeiroNome = (existente.name||"").split(" ")[0] || "o lead";
    const pendingBox = qs("#pendingBox");
    if(pendingBox){
      pendingBox.style.background = "var(--acao-soft)";
      pendingBox.style.borderColor = "var(--acao-line)";
      pendingBox.style.color = "var(--acao)";
      let txt = "<b>Atualizado.</b> ";
      if(incrementalMeta?.reimportacao){
        const nMsg = Number(incrementalMeta.mensagensNovas)||0;
        const nAudio = Number(incrementalMeta.audiosNovosTranscritos)||0;
        const nReuso = Number(incrementalMeta.audiosReaproveitados)||0;
        txt += nMsg === 0
          ? `Nenhuma mensagem nova encontrada; mantive a análise anterior sem nova cobrança de texto. `
          : `${nMsg} ${pl(nMsg, "mensagem nova incorporada", "mensagens novas incorporadas")} · ${nAudio} ${pl(nAudio, "áudio novo transcrito", "áudios novos transcritos")} · ${nReuso} ${pl(nReuso, "reaproveitado", "reaproveitados")}. `;
      } else if(juntou) txt += `Juntei as duas conversas (mantive ${data.preservadasDoAntigo} ${pl(data.preservadasDoAntigo, "mensagem que só estava", "mensagens que só estavam")} na conversa anterior). `;
      if(ev){
        txt += `O que mudou: ${escapeHtml(ev.oQueMudou||"—")}. `;
        if(ev.abordagemFuncionou && ev.abordagemFuncionou !== "sem-dados") txt += `Abordagem anterior: <b>${escapeHtml(ev.abordagemFuncionou)}</b>. `;
        if(ev.licao && ev.licao !== "sem lição clara ainda") txt += `Lição: ${escapeHtml(ev.licao)}`;
      }
      if(!limpeza.ok) txt += " <b>O lead foi salvo; a limpeza temporária ficou programada para nova tentativa.</b>";
      pendingBox.innerHTML = txt;
    }
    toast(incrementalMeta?.reimportacao
      ? `${primeiroNome} atualizado: ${Number(incrementalMeta.mensagensNovas)||0} ${pl(Number(incrementalMeta.mensagensNovas)||0, "mensagem nova", "mensagens novas")}.`
      : (juntou ? "Conversas juntadas e lead atualizado." : "Lead atualizado com evolução."));
    // Mesma correção do salvar: sem zerar o cache de 5 min, a Carteira seguia mostrando o
    // lead como estava ANTES da atualização (ainda em "preparação").
    invalidarLeadsCache();
    state.lead = confirmado;
    state.analysis = confirmado.analysis || null;
    // v1143 — a recarga da carteira INTEIRA era esperada aqui, antes de o cliente abrir: é a
    // busca mais pesada do app (pode levar segundos numa carteira grande) e o cliente que vai
    // abrir já veio confirmado do banco na linha de cima. Agora ela roda por trás e as seções da
    // Home se atualizam quando os dados chegarem — o corretor não espera mais por isso.
    loadRecentLeads(true).then(() => { try{ refreshAllSections(); }catch(_){} }).catch(()=>{});
    limpezaEmSegundoPlano.then((r) => { if(r && r.ok === false) console.warn("Limpeza temporária ficou pendente; será refeita na próxima faxina."); });
    // A limpeza do compartilhamento continua ESPERADA: é local (IndexedDB/cache do aparelho), não
    // usa rede, e sem ela um ZIP antigo pode ser reprocessado — importação paga de novo.
    if(shareConcluidoId) await finalizarSharePendente(shareConcluidoId);
    qs("#pendingActions")?.remove();
    // v1162 — o resultado da comparação também fica no "Concluído" (o texto persiste na tela da
    // importação; o quadro verde do fim o dono não conseguia ler porque o lead abre logo depois).
    const nMsgFim = Number(incrementalMeta?.mensagensNovas) || 0;
    const resumoFim = incrementalMeta?.reimportacao
      ? (incrementalMeta.analiseReutilizada
          ? "análise nova não concluída — mantida a anterior"
          : (nMsgFim === 0
              ? "sem mensagem nova; análise refeita mesmo assim"
              : `${nMsgFim} ${pl(nMsgFim, "mensagem nova incorporada", "mensagens novas incorporadas")}`))
      : "";
    const audioFim = cpResumoAudioSemTexto(importacaoConcluida?.result);
    const linhaFim = [resumoFim, audioFim].filter(Boolean).join(" · ");
    renderEtapas(6, linhaFim ? `lead atualizado · ${linhaFim}` : "lead atualizado e importação confirmada");
    // v1080 — só agora (importação de verdade concluída) o card de instruções volta a
    // aparecer; ver a marcação "concluidaComSucesso" em processFile.
    qs("#importCard")?.classList.remove("cp-import-rodando");
    setTimeout(() => { cpioFecharQuandoLeadAbrir(existente.id); }, 800);
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Atualizar"; }
    const pa = qs("#pendingActions"); if(pa) pa.style.display = "flex"; // mostra botões pra tentar de novo
    qs("#importCard")?.classList.remove("cp-import-rodando");
    // v1175 — mesmo defeito do salvar, aqui também: sem isto a tela ficava presa em
    // "Salvando — salvando no banco de dados... (94%)" com a rodinha girando pra sempre.
    cpImportacaoFalhouNaGravacao("Não foi possível atualizar", err);
  }
}

async function salvarLeadPendente(){
  if(!state.pendingSave){ toast("Nada pra salvar."); return; }
  const btn = qs("#btnSalvarLead");
  if(btn){ btn.disabled = true; btn.textContent = "Salvando..."; }
  // v1028 — a etiqueta "aguardando confirmação para salvar" ficava parada a tela toda enquanto
  // o lead (podendo ter uma conversa longa, com muitas mensagens/áudios) era gravado no banco —
  // sem nenhum movimento visível, parecia que tinha travado. Mostra progresso de verdade.
  renderEtapas(5, "salvando no banco de dados...");
  try{
    // v1080 — este fetch não tinha NENHUM limite de tempo: se a rede travasse (ex.: celular
    // reconectando depois de voltar de outro app), a tela ficava presa em "Salvando..." pra
    // sempre, sem erro nenhum aparecer (print do dono: parada em 94% por minutos). Agora usa
    // o mesmo limite generoso das outras gravações no banco (Desmarcar atendimento etc.).
    const res = await fetchComTimeout("./api/lead-update", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action: "salvar-novo", ...state.pendingSave })
    }, 45000);
    const data = await res.json().catch(()=>({ok:false,error:"Resposta inválida do servidor."}));
    if(!res.ok || !data.ok){
      const warnings = data.persistence?.warnings || [];
      const detail = warnings.length ? warnings.map(w=>`${w.table}: ${w.error}`).join(" | ") : (data.error||"Erro ao salvar.");
      throw new Error(detail);
    }
    state.lead.id = data.persistence.processing.id;
    state.lead.status = "Conversa processada";
    const importacaoConcluida = state.pendingSave;
    const shareConcluidoId = String(state.pendingSharedRecordId || "");
    // v1143 — mesma mudança do caminho de atualizar: a faxina dos arquivos temporários não segura
    // mais a abertura do cliente. Ela roda por trás; o lead já está salvo.
    const limpeza = { ok:true, adiada:true };
    finalizarImportacaoStorage(importacaoConcluida).catch(()=>{});
    state.pendingSave = null;
    state.activeImportId = null;
    cpLimparImportPendente();
    state.ultimoUploadStorage = null;
    const pendingBox = qs("#pendingBox");
    if(pendingBox){
      pendingBox.style.background = "var(--acao-soft)";
      pendingBox.style.borderColor = "var(--acao-line)";
      pendingBox.style.color = "var(--acao)";
      pendingBox.innerHTML = "<b>Salvo no banco.</b> Lead disponível na Condução e na Home." + (!limpeza.ok ? " <b>A limpeza temporária ficou programada para nova tentativa.</b>" : "");
    }
    qs("#pendingActions")?.remove();
    toast("Lead salvo.");
    // Sem invalidar o cache (TTL de 5 min), a Carteira/Preparação continuava mostrando o
    // estado ANTES de salvar — o lead recém-importado nunca saía da "preparação" e parecia
    // que a importação não tinha sido salva. Zera o cache pra a lista reler o banco.
    invalidarLeadsCache();
    loadRecentLeads(true).then(() => { try{ refreshAllSections(); }catch(_){} }).catch(()=>{});
    // Local e rápida (IndexedDB/cache): continua esperada, senão um ZIP antigo pode ser
    // reprocessado depois — importação paga de novo.
    if(shareConcluidoId) await finalizarSharePendente(shareConcluidoId);
    const audioFimNovo = cpResumoAudioSemTexto(importacaoConcluida?.result);
    renderEtapas(6, audioFimNovo ? `lead salvo · ${audioFimNovo}` : "lead salvo e importação confirmada");
    // v1080 — só agora (importação de verdade concluída) o card de instruções volta a
    // aparecer; ver a marcação "concluidaComSucesso" em processFile.
    qs("#importCard")?.classList.remove("cp-import-rodando");
    // Após salvar, abre o lead da home pra mostrar o card de foco completo (com badges, materiais, etc).
    setTimeout(() => { cpioFecharQuandoLeadAbrir(state.lead?.id); }, 800);
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Salvar lead"; }
    const pa = qs("#pendingActions"); if(pa) pa.style.display = "flex"; // mostra botões pra tentar de novo
    qs("#importCard")?.classList.remove("cp-import-rodando");
    // v1096 — o print do dono mostrou "Não foi possível salvar: Sem conexão com a internet ou o
    // servidor caiu" com o celular no wi-fi e sinal cheio. A mensagem estava culpando a internet
    // dele por uma gravação que demorou demais do lado do servidor — e, pior, não dizia a única
    // coisa que importa naquele momento: a análise NÃO se perdeu, é só tocar em salvar de novo
    // (o state.pendingSave continua aqui e os botões acabaram de voltar).
    // v1175 — esse aviso agora FICA na tela (antes só passava num toast, e a linha de andamento
    // continuava girando em "Salvando... 94%" como se nada tivesse acontecido).
    const bruto = String(err?.message || err || "");
    const pareceQuedaDeConexao = /Failed to fetch|NetworkError|aborted|AbortError/i.test(bruto);
    if(pareceQuedaDeConexao){
      const recado = "A gravação não terminou a tempo. Sua análise NÃO foi perdida — toque em \"Salvar lead\" pra tentar de novo.";
      try{ renderEtapas(7, "a gravação não terminou a tempo"); }catch(_){ try{ cpImportOverlayVisivel(false); }catch(_){} }
      const pendingBox = qs("#pendingBox");
      if(pendingBox){
        pendingBox.style.background = "var(--risco-soft)";
        pendingBox.style.borderColor = "var(--risco-line)";
        pendingBox.style.color = "#ffd9d9";
        pendingBox.innerHTML = `<b>A gravação não terminou a tempo.</b><br>Sua análise <b>não foi perdida</b> — toque em “Salvar lead” pra tentar de novo.`;
      }
      toast(recado);
    }else{
      cpImportacaoFalhouNaGravacao("Não foi possível salvar", err);
    }
  }
}

async function descartarLeadPendente(){
  const msgDescartarAn = "Descartar essa análise sem salvar no banco?";
  const okDescartarAn = (typeof cp903Confirm === "function")
    ? await cp903Confirm({ titulo: "Descartar análise", mensagem: msgDescartarAn, ok: "Descartar", perigo: true })
    : confirm(msgDescartarAn);
  if(!okDescartarAn) return;
  cpFecharPerguntaTopo();
  const shareDescartadoId = String(state.pendingSharedRecordId || "");
  const importacaoDescartada = state.pendingSave;
  await finalizarImportacaoStorage(importacaoDescartada);
  state.pendingSave = null;
  state.activeImportId = null;
  cpLimparImportPendente();
  state.ultimoUploadStorage = null;
  clearAnalysis();
  if(shareDescartadoId) await finalizarSharePendente(shareDescartadoId);
  toast("Análise descartada.");
}

async function processFile(file, options = {}){
  if(!file) return false;
  if(state.processing) return false;
  let concluidaComSucesso = false;
  const pendingShareId = String(options.shareId || state.pendingSharedRecordId || "").trim();
  // v1022 — se a página recarregou desde a última tentativa (state.activeImportId se perdeu),
  // busca no aparelho se ESTE MESMO arquivo (nome+tamanho) já tinha uma importação em
  // andamento — reencontrando o importId, o servidor reconhece a extração/transcrição já
  // feita antes e não cobra/repete o que já tinha sido transcrito.
  const importId = String(options.importId || state.activeImportId || cpImportIdParaArquivo(file) || criarImportId());
  state.activeImportId = importId;
  cpSalvarImportPendente(importId, file);
  if(pendingShareId){
    state.pendingSharedRecordId = pendingShareId;
    window.__cpShareImportActive = true;
  }
  state.ultimoArquivo = file;
  clearAnalysis();
  state.processing=true;
  show("zip");
  qs("#importCard")?.classList.add("cp-import-rodando");
  // v1309 — o tamanho sai em KB quando é pequeno: "0.0 MB" aparecia tanto pra uma conversa de
  // texto inteira quanto pra um arquivo vazio, e o print do dono ficava impossível de ler.
  qs("#fileName").textContent="Arquivo selecionado: "+file.name+" ("+formatarTamanhoArquivo(file.size)+")";
  qs("#fileName").classList.add("show");
  qs("#processingBox").classList.add("show");
  renderEtapas(0, "validando o arquivo recebido");

  if(!file.name.toLowerCase().endsWith(".zip")){
    qs("#processingText").textContent="Arquivo inválido.";
    showCard("resultCard", true);
    qs("#resultBox").className="notice error";
    qs("#resultBox").innerHTML="Envie o arquivo ZIP exportado pelo WhatsApp.";
    state.processing=false;
    qs("#importCard")?.classList.remove("cp-import-rodando");
    return false;
  }

  try{
    // v1309 — arquivo de zero byte (acontece quando o seletor do Android devolve a exportação
    // antes de o WhatsApp terminar de prepará-la): não há o que enviar nem o que analisar.
    const problemaArquivo = problemaDoArquivoRecebido(file);
    if(problemaArquivo) throw erroDaConversa(problemaArquivo);

    const audioWindowDays = janelaAudioDaImportacao();
    renderEtapas(0, "áudios: " + rotuloJanelaAudio(audioWindowDays) + "; textos completos");

    // Enxuga o ZIP no celular: mantém o texto inteiro e só o áudio que o servidor vai usar de
    // verdade (v1270 — ver js/enxugar-zip.js). É o que faz uma conversa de anos caber no envio.
    let slimInfo = null;
    let working = file;
    state.ultimoCorteZip = null;
    try{
      renderEtapas(0, "preparando uma única cópia útil do ZIP");
      slimInfo = await slimZipKeepingTextAndAudio(file, ({processed,total,kept,dropped})=>{
        renderEtapas(0, "preparando ZIP: "+processed+"/"+total+" · mantidos "+kept+", descartados "+dropped);
      }, { diasJanela: audioWindowDays });
      working = slimInfo.file;
      state.ultimoCorteZip = slimInfo.plano?.resumo || null;
      const oMb = (slimInfo.originalSize/1024/1024).toFixed(1);
      const sMb = (slimInfo.slimSize/1024/1024).toFixed(1);
      renderEtapas(0, "ZIP preparado: "+oMb+" MB → "+sMb+" MB");
    }catch(err){
      // v1309 — problema que o aparelho JÁ identificou no arquivo não vira "usando o ZIP
      // original": enviar de novo daria exatamente a mesma recusa, um minuto depois.
      if(err?.conversaInvalida) throw err;
      renderEtapas(0, "usando o ZIP original");
      working = file;
    }

    // Rede de segurança: se MESMO ASSIM não couber (só acontece se o texto sozinho for gigante,
    // ou se o preparo acima falhou e o ZIP original é enorme), o app diz o que fazer em vez de
    // mandar pro servidor recusar com "ZIP maior que o limite permitido" e um "Tentar novamente"
    // que dá sempre o mesmo erro — foi exatamente esse beco sem saída do print do dono.
    if(working.size > LIMITE_ENVIO_BYTES){
      const mb = (working.size/1024/1024).toFixed(1);
      throw new Error(
        `Esta conversa tem ${mb} MB e não coube no envio nem depois de tirar fotos, vídeos e áudios antigos. `+
        `No WhatsApp, exporte essa conversa de novo escolhendo "Sem mídia" — o texto entra inteiro e a análise sai igual.`
      );
    }

    const ok = await uploadLargeZipToSupabase(working, { audioWindowDays, importId });
    if(!ok) return false;
    // v929 — conta como 1 importação aqui (ZIP recebido com sucesso), independente de quantos
    // leads a conversa vai gerar/atualizar depois — é a unidade natural de "importei um ZIP".
    try{ cpRegistrarAtividade("importacao"); }catch(_){}
    // Não elimina o ZIP ainda: a importação só termina quando o lead é salvo/atualizado
    // ou quando o corretor descarta explicitamente a análise.
    // v1080 — renderProcessedResult (chamado dentro de uploadLargeZipToSupabase) dispara o
    // salvamento automático (salvarLeadPendente/atualizarLeadComEvolucao) SEM esperar
    // (sem await): esta função já retorna aqui, antes do salvamento terminar. Marca que deu
    // certo pra o "finally" abaixo não desligar o modo limpo do card agora — só quando o
    // salvamento de verdade terminar (ver as duas funções), senão as etapas "Salvando" e
    // "Concluído" reexibiam título/instruções/botões do card por cima (print do dono).
    concluidaComSucesso = true;
    return true;
  }catch(err){
    // Mantém o ZIP disponível no botão "Tentar novamente", mas remove imediatamente a
    // URL do Share Target. Assim, fechar e abrir o app não dispara a mesma tentativa antiga
    // nem abre sozinho o seletor de período dos áudios.
    if(pendingShareId){
      window.__cpShareImportActive=false;
      try{ history.replaceState(null,'',location.pathname); }catch(_){ }
    }
    // v1309 — quando o problema é do próprio arquivo, "Tentar novamente" com ELE MESMO daria
    // sempre o mesmo resultado (o beco sem saída que este projeto já corrigiu duas vezes). Nesse
    // caso o botão principal abre o seletor pra escolher OUTRO arquivo, e o título de cima já diz
    // o que houve — em vez de deixar a explicação embaixo da dobra, fora da tela do celular.
    const arquivoInvalido = !!err?.conversaInvalida;
    renderEtapas(7, arquivoInvalido ? (err.tituloCurto || "confira o arquivo escolhido") : "a importação pode ser retomada sem perder o ZIP");
    showCard("resultCard", true);
    qs("#resultBox").className="notice error";
    state.ultimoArquivo = file;
    qs("#resultBox").innerHTML =
      (arquivoInvalido ? `<b>${escapeHtml(err.tituloCurto || "Confira o arquivo escolhido.")}</b><br><br>` : "") +
      escapeHtml(arquivoInvalido ? err.message : userFriendlyError(err,file)).replace(/\n/g,"<br>") +
      `<div style="margin-top:14px;display:flex;gap:10px">${
        arquivoInvalido
          ? `<button type="button" class="btn" id="btnEscolherOutroArquivo" style="flex:1">Escolher outro arquivo</button>`
          : `<button type="button" class="btn" id="btnTentarNovamente" style="flex:1">Tentar novamente</button>`
      }<button type="button" class="btn secondary" id="btnDescartarTentativa" style="flex:1">Descartar</button></div>`;
    // A explicação mora num card abaixo do card da importação: num celular ela nasce fora da
    // tela. Trazer a tela até ela é parte de mostrar o motivo.
    try{ requestAnimationFrame(() => { qs("#resultCard")?.scrollIntoView({ block:"start" }); }); }catch(_){ }
    qs("#btnEscolherOutroArquivo")?.addEventListener("click", () => {
      try{ qs("#zipFileInput").value = ""; }catch(_){ }
      qs("#zipFileInput")?.click();
    });
    qs("#btnTentarNovamente")?.addEventListener("click", async () => {
      if(state.ultimoArquivo){ state.processing = false; await processFile(state.ultimoArquivo, { shareId: pendingShareId, importId }); }
    });
    qs("#btnDescartarTentativa")?.addEventListener("click", async () => {
      if(state.ultimoUploadStorage) await finalizarImportacaoStorage(state.ultimoUploadStorage);
      if(pendingShareId) await descartarSharePendente(pendingShareId);
      state.ultimoUploadStorage = null;
      state.activeImportId = null;
      cpLimparImportPendente();
      state.ultimoArquivo = null;
      showCard("resultCard", false);
    });
    toast(arquivoInvalido ? (err.tituloCurto || "Confira o arquivo escolhido.") : "Erro ao processar. O ZIP ficou guardado para tentar novamente.");
    return false;
  }finally{
    state.processing=false;
    if(!concluidaComSucesso) qs("#importCard")?.classList.remove("cp-import-rodando");
    // v1089-2 — AQUI NÃO SE ESCONDE MAIS NADA. Esta rede de segurança fechava a tela cheia no
    // fim de processFile — só que processFile TERMINA ANTES do salvamento: renderProcessedResult
    // dispara salvarLeadPendente()/atualizarLeadComEvolucao() sem esperar, então este "finally"
    // rodava com o salvamento ainda em curso. A tela sumia, os cartões da importação apareciam, e
    // o "salvando" trazia a tela de volta — era a tela que aparecia no meio da análise.
    // A proteção contra ficar presa passou a ser o VIGIA POR TEMPO (cpioRearmarVigia), que só
    // dispara se NADA acontecer por um bom tempo — nunca no meio de um fluxo que está andando.
  }
}

export { processFile };
