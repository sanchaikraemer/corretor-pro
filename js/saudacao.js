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

export const FUSO_CORRETOR = "America/Sao_Paulo";

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
export function horaNoFusoDoCorretor(agora = new Date(), fuso = FUSO_CORRETOR){
  try{
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: fuso, hour: "2-digit", hour12: false }).format(agora));
  }catch(_){
    return agora.getHours();
  }
}

export function saudacaoAgora(agora = new Date(), fuso = FUSO_CORRETOR){
  return saudacaoParaHora(horaNoFusoDoCorretor(agora, fuso));
}

// Abertura = a saudação logo no começo da mensagem, aceitando um "oi/olá/opa" antes dela.
// Só isso é trocado: o resto do texto (nome do cliente, conteúdo, pontuação) fica intacto, e uma
// saudação no MEIO da mensagem não é mexida — lá ela pode estar citando outra coisa.
const ABERTURA_COM_SAUDACAO = /^(\s*(?:oi|ol[áa]|opa|e a[íi])?[\s,!—-]*)(bom\s+dia|boa\s+tarde|boa\s+noite)/i;

export function corrigirSaudacaoAbertura(texto, agora = new Date(), fuso = FUSO_CORRETOR){
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

// ============================================================================================
// v1274 — A SAUDAÇÃO QUE FALTOU.
//
// Print do dono (14/08): as três sugestões de um lead parado havia dias começavam direto no
// assunto — *"Das opções e valores que você conferiu no material…"*. Pergunta dele: "cadê a
// saudação? a retomada?". Ele tem razão: as mensagens REAIS dele nessa mesma conversa abrem
// todas com *"Bom dia Gabriel, tudo bem?"*.
//
// A regra passou a ser escrita de forma dura no pedido que vai pra IA. Aqui fica a rede de
// segurança pro caso de a IA esquecer mesmo assim: quando a conversa está parada (retomada), a
// saudação é ACRESCENTADA na frente. Nada do texto da IA é apagado, trocado ou reescrito — só
// entra o cumprimento que faltava, exatamente como um corretor abriria a mensagem.
// ============================================================================================

// Qualquer abertura que já cumprimenta — inclusive as informais, que a régua de horário não pega.
const ABERTURA_JA_CUMPRIMENTA = /^\s*(?:oi|ol[áa]|opa|e a[íi]|bom\s+dia|boa\s+tarde|boa\s+noite)\b/i;

// Só o primeiro nome, e só quando é nome mesmo: rótulo de contato do WhatsApp vem com sobrenome,
// nome de empreendimento junto ("Gabriel Quality Evolutti") ou nem nome é ("Não identificado",
// número de telefone). Na dúvida devolve "" — melhor cumprimentar sem nome do que errar o nome.
export function primeiroNomeDoCliente(nome){
  const bruto = String(nome || "").trim();
  if(!bruto) return "";
  const primeiro = bruto.split(/[\s,;/|]+/)[0].replace(/[^\p{L}\p{M}'-]/gu, "");
  if(primeiro.length < 2) return "";
  if(/^(n[aã]o|sem|cliente|contato|lead|whatsapp)$/i.test(primeiro)) return "";
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1);
}

export function garantirSaudacaoAbertura(texto, { nome = "", agora = new Date(), fuso = FUSO_CORRETOR } = {}){
  const original = String(texto || "").trim();
  if(!original) return String(texto || "");
  // Já cumprimenta: não encosta. Acertar a FAIXA do dia continua sendo trabalho da hora de
  // MOSTRAR a mensagem (v1218) — a análise pode ser feita de manhã e a mensagem copiada à noite.
  if(ABERTURA_JA_CUMPRIMENTA.test(original)) return original;
  const saud = saudacaoAgora(agora, fuso);
  if(!saud) return original;
  const primeiro = primeiroNomeDoCliente(nome);
  // A mensagem já começa chamando o cliente pelo nome ("Gabriel, consegui…"): a saudação entra
  // antes do nome e a frase continua igualzinha ("Boa tarde Gabriel, consegui…").
  if(primeiro){
    const comecaPeloNome = new RegExp(`^${primeiro.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if(comecaPeloNome.test(original)) return `${saud} ${original}`;
    return `${saud}, ${primeiro}! ${original}`;
  }
  return `${saud}! ${original}`;
}
