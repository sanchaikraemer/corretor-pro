// ============================================================================================
// v1217 — REGRA DE REPETIÇÃO DO ENVIO DO ZIP.
//
// Print do dono (11/08/2026): ZIP de 54 MB, celular no 4G, barra em 100% e "Falha de conexão
// durante o envio. Verifique a internet e tente novamente." A importação morria na PRIMEIRA
// queda de conexão — e o "Tentar novamente" recomeçava tudo, inclusive o preparo do ZIP no
// aparelho. Numa conversa cheia de áudio, um envio de dezenas de MB pelo celular quase nunca
// passa de primeira.
//
// Este arquivo tem SÓ a regra de quando repetir, quanto esperar e o que dizer — sem tela, sem
// rede, sem depender do resto do app. É por isso que ela pode ser executada de verdade pelo
// teste (tests/v1217-envio-zip-tenta-de-novo.test.mjs), em vez de conferida por leitura.
// ============================================================================================

// Quantas vezes o app tenta enviar sozinho antes de entregar o erro pro dono.
export const TENTATIVAS_ENVIO = 3;
// Quanto tempo o envio pode ficar sem UM byte novo antes de ser considerado morto. Numa rede
// ruim que ainda está andando devagar, 90s é folga de sobra; parado de verdade, não adianta
// esperar mais — o celular pode nunca disparar erro nenhum e a tela fica presa no mesmo número.
export const PARADA_MAXIMA_MS = 90000;
// Espera antes de recomeçar: 3s depois da 1ª queda, 6s depois da 2ª.
export const ESPERA_ENTRE_TENTATIVAS_MS = 3000;

export function passouDoTempoParado(msSemProgresso){
  return Number(msSemProgresso) >= PARADA_MAXIMA_MS;
}

// Um erro de envio vira um Error normal com duas marcas: se vale repetir e quanto já tinha ido.
export function falhaDeEnvio(mensagem, { podeTentarDeNovo = false, enviadoMb = 0 } = {}){
  const erro = new Error(mensagem);
  erro.cpPodeTentarDeNovo = !!podeTentarDeNovo;
  erro.cpEnviadoMb = Number(enviadoMb) || 0;
  return erro;
}

// Queda de conexão e envio parado são temporários: repetir costuma resolver. Erro 5xx do
// armazenamento também. Já uma recusa do arquivo (4xx) daria exatamente o mesmo resultado na
// segunda vez — repetir só faria o dono esperar à toa.
export function classificarFalhaEnvio({ tipo, status = 0, totalMb = 0, enviadoMb = 0 } = {}){
  const tamanho = Number(totalMb || 0).toFixed(1);
  if(tipo === "rede")   return falhaDeEnvio("A conexão caiu no meio do envio.", { podeTentarDeNovo:true, enviadoMb });
  if(tipo === "parado") return falhaDeEnvio("O envio ficou parado sem enviar nada.", { podeTentarDeNovo:true, enviadoMb });
  if(tipo === "abortado") return falhaDeEnvio("O envio foi interrompido.", { podeTentarDeNovo:false, enviadoMb });
  if(status >= 500)     return falhaDeEnvio(`O servidor de armazenamento não respondeu direito durante o envio (HTTP ${status}).`, { podeTentarDeNovo:true, enviadoMb });
  return falhaDeEnvio(
    `O envio da conversa não foi aceito (o arquivo pode estar grande demais — ${tamanho} MB). Tente uma conversa menor ou tente de novo em instantes.`,
    { podeTentarDeNovo:false, enviadoMb }
  );
}

// A mensagem de quando acabaram as tentativas. Curta de propósito: mensagem longa demais é
// trocada por um texto genérico lá na tela (userFriendlyError), e aí o dono perde a dica útil.
export function mensagemDesistencia({ enviadoMb = 0, totalMb = 0, tentativas = TENTATIVAS_ENVIO } = {}){
  return `A conexão caiu no meio do envio (${Number(enviadoMb).toFixed(1)} de ${Number(totalMb).toFixed(1)} MB) e não deu certo em ${tentativas} tentativas. Se estiver usando dados do celular, tente no Wi-Fi: conversa com muito áudio é pesada.`;
}

/**
 * Repete o envio enquanto fizer sentido.
 *
 * - `pedirUrl(tentativa)` — busca uma URL de envio NOVA a cada tentativa (a anterior pode ter
 *   expirado enquanto o envio arrastava).
 * - `enviar(preparo, tentativa)` — faz o envio de verdade; rejeita com os erros marcados acima.
 * - `avisar(evento)` — texto de andamento pra tela (opcional).
 * - `esperar(ms)` — a espera entre as tentativas (injetada pra o teste não dormir de verdade).
 *
 * Devolve o que `pedirUrl` retornou na tentativa que deu certo.
 */
export async function enviarComRetentativa({ pedirUrl, enviar, avisar, esperar, totalMb = 0, tentativas = TENTATIVAS_ENVIO }){
  const avisa = (evento) => { try{ avisar && avisar(evento); }catch(_){ } };
  for(let tentativa = 1; ; tentativa++){
    // v1227 — a queda de conexão também acontece AQUI. O cenário é justamente o da v1217: a rede
    // caiu no meio do envio, o laço espera 3s e volta — só que a internet ainda não voltou, e o
    // pedido da URL nova falhava com um erro cru que escapava do laço inteiro. Resultado: das 3
    // tentativas prometidas, o dono via 1 e um erro em inglês. Falha marcada como repetível
    // (cpPodeTentarDeNovo) gasta a tentativa e espera de novo, como qualquer queda no envio.
    let preparo;
    try{
      preparo = await pedirUrl(tentativa);
    }catch(err){
      if(!err?.cpPodeTentarDeNovo) throw err;
      const enviadoMb = Number.isFinite(err?.cpEnviadoMb) ? err.cpEnviadoMb : 0;
      if(tentativa >= tentativas) throw new Error(mensagemDesistencia({ enviadoMb, totalMb, tentativas }));
      avisa({ fase:"recomecando", tentativa, tentativas, enviadoMb, totalMb });
      await esperar(tentativa * ESPERA_ENTRE_TENTATIVAS_MS);
      continue;
    }
    avisa({ fase:"enviando", tentativa, tentativas });
    try{
      await enviar(preparo, tentativa);
      return preparo;
    }catch(err){
      const enviadoMb = Number.isFinite(err?.cpEnviadoMb) ? err.cpEnviadoMb : 0;
      if(!err?.cpPodeTentarDeNovo) throw err;
      if(tentativa >= tentativas) throw new Error(mensagemDesistencia({ enviadoMb, totalMb, tentativas }));
      avisa({ fase:"recomecando", tentativa, tentativas, enviadoMb, totalMb });
      await esperar(tentativa * ESPERA_ENTRE_TENTATIVAS_MS);
    }
  }
}
