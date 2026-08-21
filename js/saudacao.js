// ============================================================================================
// v1218 — SAUDAÇÃO CERTA PARA O HORÁRIO.
//
// Print do dono às 17h37: a sugestão de mensagem abria com "Boa noite Luane". A hora atual já ia
// pro prompt da IA, mas a REGRA não — e a IA chutava. Aqui a regra fica escrita num lugar só,
// usada pela tela inicial, pela correção das sugestões e conferida pelo teste.
//
// A régua é a do português do Brasil, a mesma que a saudação da Home já usava:
//   bom dia    → até 11h59
//   boa tarde  → das 12h00 às 17h59
//   boa noite  → das 18h00 em diante
// ============================================================================================

// v1337 — o fuso deixou de ser Brasília cravado: quando este módulo roda dentro do app, ele usa o
// fuso da conta (escolhido no Cérebro, detectado pelo aparelho). No servidor e nos testes, onde
// não existe window, continua valendo Brasília — que é o padrão do produto.
export const FUSO_PADRAO = "America/Sao_Paulo";
export function fusoDoCorretorAqui(){
  try{
    if(typeof window !== "undefined" && typeof window.cpFuso === "function") return window.cpFuso() || FUSO_PADRAO;
  }catch(_){ }
  return FUSO_PADRAO;
}
// Nome antigo, mantido porque é o que o resto do app importa.
export const FUSO_CORRETOR = FUSO_PADRAO;

export function saudacaoParaHora(hora){
  const h = Number(hora);
  if(!Number.isFinite(h) || h < 0 || h > 23) return "";
  if(h < 12) return "Bom dia";
  if(h < 18) return "Boa tarde";
  return "Boa noite";
}

// A hora do CORRETOR, não a do servidor: o app roda no celular dele, mas a análise roda num
// servidor que costuma estar em UTC — sem fixar o fuso, "17h37 no Brasil" vira "20h37" e a
// saudação sai errada por três horas.
export function horaNoFusoDoCorretor(agora = new Date(), fuso = fusoDoCorretorAqui()){
  try{
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: fuso, hour: "2-digit", hour12: false }).format(agora));
  }catch(_){
    return agora.getHours();
  }
}

export function saudacaoAgora(agora = new Date(), fuso = fusoDoCorretorAqui()){
  return saudacaoParaHora(horaNoFusoDoCorretor(agora, fuso));
}

// Abertura = a saudação logo no começo da mensagem, aceitando um "oi/olá/opa" antes dela.
// Só isso é trocado: o resto do texto (nome do cliente, conteúdo, pontuação) fica intacto, e uma
// saudação no MEIO da mensagem não é mexida — lá ela pode estar citando outra coisa.
const ABERTURA_COM_SAUDACAO = /^(\s*(?:oi|ol[áa]|opa|e a[íi])?[\s,!—-]*)(bom\s+dia|boa\s+tarde|boa\s+noite)/i;

export function corrigirSaudacaoAbertura(texto, agora = new Date(), fuso = fusoDoCorretorAqui()){
  const original = String(texto || "");
  const casa = original.match(ABERTURA_COM_SAUDACAO);
  if(!casa) return original;
  const certa = saudacaoAgora(agora, fuso);
  if(!certa) return original;
  const escrita = casa[2];
  // Já está certa (ignorando maiúsculas/acento do jeito que a IA escreveu): não mexe em nada.
  if(escrita.replace(/\s+/g, " ").toLowerCase() === certa.toLowerCase()) return original;
  // Mantém o jeito que veio escrito: tudo em maiúsculas continua em maiúsculas, e minúscula no
  // meio da frase ("Oi, boa noite") continua minúscula — trocar isso deixaria a frase estranha.
  const ajustada = escrita === escrita.toUpperCase() ? certa.toUpperCase()
    : escrita[0] === escrita[0].toLowerCase() ? certa.toLowerCase()
    : certa;
  return original.slice(0, casa.index) + casa[1] + ajustada + original.slice(casa.index + casa[0].length);
}
