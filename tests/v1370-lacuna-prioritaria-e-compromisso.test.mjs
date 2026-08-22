import fs from "node:fs";
import assert from "node:assert/strict";
import {
  parseWhatsappTxt,
  guessLeadData,
  montarEstadoComercialDeterministico,
  lacunaComercialPrioritaria,
  montarFicharioDaConversa,
  avisosDeQualidadeDasMensagens
} from "../api/_pipeline.js";

// v1370 — quatro correções da auditoria do Julsimar:
// 1) AGUARDAR substitui visualmente Fazer agora;
// 2) uma única lacuna comercial prioritária;
// 3) as três mensagens obedecem à mesma lacuna sem virar cópias;
// 4) ligação/visita/dia/hora não nascem sem base no histórico.

const CONVERSA = `[18/08/2026 15:38] Construtora Senger: Boa tarde, Julcimar! Tudo bem? Você conseguiu dar uma olhada no Premium Office?
[18/08/2026 15:46] Julsimar Chapada: Dei uma olhada sim
[18/08/2026 15:48] Julsimar Chapada: Estamos analisando ainda, mas gostei da ideia
[18/08/2026 15:48] Julsimar Chapada: O Nicolas me falou mais ou menos as condições de pagamento
[18/08/2026 16:06] Construtora Senger: Hoje estamos trabalhando com 20% de entrada e saldo em até 30x. Você já tem algo em mente? Se quiser posso lhe encaminhar mais informações.
[18/08/2026 16:08] Julsimar Chapada: Joia.`;

const timeline = parseWhatsappTxt(CONVERSA);
const lead = guessLeadData(timeline, "Construtora Senger", "Conversa do WhatsApp com Julsimar Chapada.txt");
const agora = new Date("2026-08-22T11:47:00-03:00");
const estado = montarEstadoComercialDeterministico(timeline, "Construtora Senger", lead, agora);
const lacuna = lacunaComercialPrioritaria(timeline, "Construtora Senger", lead, estado);

assert.equal(lacuna?.id, "faixa_valor", "Julsimar precisa ter UMA prioridade: descobrir a faixa de investimento");
assert.match(lacuna?.rotulo || "", /faixa total de investimento/i);

const fichario = montarFicharioDaConversa(timeline, "Construtora Senger", lead, agora, estado);
assert.match(fichario, /LACUNA COMERCIAL PRIORITÁRIA/);
assert.match(fichario, /TRÊS mensagens devem tentar resolver ESTA MESMA lacuna/i,
  "o prompt factual precisa obrigar as três sugestões a obedecer ao mesmo objetivo");
assert.doesNotMatch(fichario, /DIAS ÚTEIS PARA COMPLETAR O COMPROMISSO/,
  "Julsimar não tem ligação/visita combinada; não deve receber calendário para inventar compromisso");

const contexto = {
  conversa: CONVERSA,
  cerebro: "",
  catalogo: [],
  topicosRespondidos: estado.topicosConfirmados,
  compromisso: estado.compromisso,
  lacunaPrioritaria: lacuna,
  temPromessaPendente: false,
  temOQueEntregar: false
};

// As três podem perguntar FAIXA, desde que sejam abordagens diferentes — não devem ganhar o antigo
// aviso "pede a mesma coisa" só porque convergem no dado certo.
const boas = avisosDeQualidadeDasMensagens([
  { qual: "a", texto: "Bom dia, Julsimar! Sobre o Premium Office, para eu filtrar só as opções que realmente cabem, em que faixa total pretende investir?" },
  { qual: "b", texto: "Bom dia, Julsimar! Quero organizar uma condição objetiva e evitar te mandar opção fora da conta. Qual faixa de investimento você quer considerar?" },
  { qual: "c", texto: "Bom dia, Julsimar! Indo direto ao ponto: quanto pretende investir no total para eu separar as unidades compatíveis?" }
], contexto);
assert.ok(!boas.some(a => a.motivos.some(m => /pede a mesma coisa/i.test(m))),
  "mesma lacuna prioritária não pode ser confundida com duplicidade");
assert.ok(!boas.some(a => a.motivos.some(m => /desvia da lacuna prioritária|não busca a lacuna prioritária/i.test(m))),
  "as três boas realmente resolvem faixa");

// Pular para parcelas/reforços antes da faixa precisa ser acusado.
const desviou = avisosDeQualidadeDasMensagens([
  { qual: "a", texto: "Bom dia! Em que faixa total pretende investir?" },
  { qual: "b", texto: "Bom dia! Para você pesa mais ter parcelas mensais menores ou distribuir parte em reforços anuais?" },
  { qual: "c", texto: "Bom dia! Quanto pretende investir no total?" }
], contexto);
assert.ok(desviou.some(a => a.qual === "b" && a.motivos.some(m => /lacuna prioritária/i.test(m))),
  "sugestão 2 não pode avançar para estrutura de pagamento enquanto falta faixa");

// Ligação + terça + 10h, sem histórico que sustente isso, precisa ser barrado pela conferência.
const inventou = avisosDeQualidadeDasMensagens([
  { qual: "a", texto: "Bom dia! Em que faixa total pretende investir?" },
  { qual: "b", texto: "Bom dia! Qual faixa de investimento quer considerar?" },
  { qual: "c", texto: "Bom dia! Posso te ligar na terça-feira às 10h para definirmos isso?" }
], contexto);
assert.ok(inventou.some(a => a.qual === "c" && a.motivos.some(m => /inventa ligação/i.test(m))),
  "ligação sem base precisa ser sinalizada");
assert.ok(inventou.some(a => a.qual === "c" && a.motivos.some(m => /dia\/horário/i.test(m))),
  "dia/horário sem base também precisa ser sinalizado");

// Quando já existe UMA ligação real e válida, completar aquele mesmo compromisso com dia/hora é
// permitido — a regra não pode matar compromissos que o cliente de fato abriu.
const comLigacaoReal = avisosDeQualidadeDasMensagens([
  { qual: "a", texto: "Podemos completar a ligação na terça-feira às 10h?" }
], {
  conversa: "Cliente: pode me ligar e conversamos por telefone.",
  cerebro: "",
  catalogo: [],
  topicosRespondidos: [],
  compromisso: { recente: true, continuaValido: true, tipo: "ligação", pendencia: "definir dia e hora" },
  lacunaPrioritaria: null,
  temPromessaPendente: false,
  temOQueEntregar: true
});
assert.ok(!comLigacaoReal.some(a => a.motivos.some(m => /inventa ligação|dia\/horário/i.test(m))),
  "compromisso real pode ser completado sem falso positivo");

// Referir um fato passado não é propor compromisso novo. A régua precisa separar memória da conversa
// de uma ação inventada pela IA.
const referenciaPassada = avisosDeQualidadeDasMensagens([
  { qual: "a", texto: "Bom dia! Sobre a visita de 18/08, em que faixa total pretende investir?" }
], {
  ...contexto,
  conversa: `${CONVERSA}\n[18/08/2026 14:00] Julsimar Chapada: A visita de 18/08 foi tranquila.`
});
assert.ok(!referenciaPassada.some(a => a.motivos.some(m => /inventa visita|dia\/horário/i.test(m))),
  "mencionar visita/data que já existem no histórico não pode virar falso compromisso inventado");

// Uma promessa genérica (ex.: enviar material) não autoriza a IA a inventar terça às 10h.
const promessaNaoAutorizaAgenda = avisosDeQualidadeDasMensagens([
  { qual: "a", texto: "Eu te envio o material na terça-feira às 10h." }
], {
  conversa: "Corretor: vou te enviar o material.",
  cerebro: "",
  catalogo: [],
  topicosRespondidos: [],
  compromisso: null,
  lacunaPrioritaria: null,
  temPromessaPendente: true,
  temOQueEntregar: true
});
assert.ok(promessaNaoAutorizaAgenda.some(a => a.motivos.some(m => /dia\/horário/i.test(m))),
  "promessa sem dia/hora não pode virar agenda inventada");

const compromissoGenericoInventado = avisosDeQualidadeDasMensagens([
  { qual: "a", texto: "Podemos agendar um horário para conversar melhor?" }
], {
  conversa: "Cliente: gostei da ideia.", cerebro: "", catalogo: [], topicosRespondidos: [],
  compromisso: null, lacunaPrioritaria: null, temOQueEntregar: false
});
assert.ok(compromissoGenericoInventado.some(a => a.motivos.some(m => /inventa compromisso/i.test(m))),
  "agendar um horário sem base também é compromisso inventado");

// UI: o estado aguardar muda título, estilo e legenda das mensagens.
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.match(app, /const tituloAcao=aguardarContato\?'Aguardar':'Fazer agora'/);
assert.match(app, /Mensagem preparada para a retomada/);
assert.match(app, /cp704-agora\$\{aguardarContato\?' cp704-aguardar':''\}/,
  "o card precisa mudar visualmente quando a análise manda esperar");

// Prompt: não pode sobreviver a regra antiga que mandava variar o DADO ou inventar dia/hora.
const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
assert.doesNotMatch(pipeline, /Pelo menos\s+\n?\s*duas das três precisam pedir coisas diferentes/i);
assert.doesNotMatch(pipeline, /Quando a jogada for encontro, visita, avaliação, simulação ou ligação, PROPONHA DIA E HORA/i);
assert.match(pipeline, /NÃO INVENTE COMPROMISSO/);
assert.match(pipeline, /analise-mensagens-reparo/,
  "violações bloqueantes precisam disparar reparo automático antes da resposta");
assert.match(pipeline, /AVISO BLOQUEANTE VIRA REPARO/,
  "o app não deve se limitar a mostrar tarja vermelha para erro que ele já sabe corrigir");

console.log("v1370-lacuna-prioritaria-e-compromisso: ok");
