// A BATERIA DE CONVERSAS COMERCIAIS — o motor, usado por dois lugares.
//
// v1330 — até aqui a bateria só existia na linha de comando (evals/executar.mjs), o que na prática
// queria dizer: só rodava se um programador com a chave da OpenAI rodasse. O dono — que é quem
// decide se a análise melhorou ou piorou — não tinha como rodar. Um portão que o dono não abre não
// é portão, é parede.
//
// Ele mora em evals/ (e não em api/) por causa de uma regra da casa: nenhum arquivo de api/ pode
// definir "temperature" nas chamadas à OpenAI — quem manda no comportamento é o Cérebro. Aqui o
// caso é outro: o JUIZ precisa de temperatura zero pra medir sempre igual, senão a régua balança
// sozinha de uma medição pra outra. Ficando fora de api/, cada regra vale onde deve.
//
// Agora o mesmo motor roda também pelo botão "Medir a qualidade da análise" do painel
// administrativo (api/diagnostico.js?mode=bateria), com a chave que já está na hospedagem. Nada
// sai do servidor: as conversas da bateria são fictícias e ficam no repositório.
//
// Cada conversa carrega a RÉGUA escrita em português (o que a IA precisava perceber, o que as
// mensagens não podem fazer, o que precisam fazer). Um segundo modelo — o juiz — confere item a
// item e precisa justificar citando o trecho. O juiz nunca recebe a resposta "certa" pronta.
import { CASOS_DA_BATERIA } from "./casos-empacotados.mjs";
import { guessLeadData, analyzeWithBrain, modeloTarefasSimples } from "../api/_pipeline.js";
import { registrarUsoIA } from "../api/_iaCusto.js";

export const CASOS = CASOS_DA_BATERIA;

export function modeloJuiz() {
  return String(process.env.EVALS_MODELO_JUIZ || modeloTarefasSimples());
}

export function montarPedidoDoJuiz(caso, analise) {
  const tresMensagens = [analise?.messages?.a, analise?.messages?.b, analise?.messages?.c]
    .filter(Boolean).map((m, i) => `${i + 1}) ${m}`).join("\n");
  const diagnostico = JSON.stringify(analise?.diagnostico || {}, null, 1).slice(0, 4000);
  return `Você confere o trabalho de um sistema que analisa conversas de corretor de imóveis.
Julgue APENAS pelo que está escrito abaixo. Não invente contexto e não seja generoso: na dúvida, marque como não cumprido e explique.

=== A CONVERSA ANALISADA ===
${caso.conversa.map(m => `[${m.date} ${m.time || ""}] ${m.author}: ${m.text}`).join("\n")}

=== O QUE O SISTEMA ENTENDEU (diagnóstico) ===
${diagnostico}
Resumo: ${analise?.summary || "(vazio)"}
Próximo passo: ${analise?.nextAction || "(vazio)"}

=== AS TRÊS MENSAGENS QUE O SISTEMA SUGERIU ===
${tresMensagens || "(nenhuma mensagem foi gerada)"}

=== A RÉGUA ===
PRECISA TER PERCEBIDO (olhe o diagnóstico e o resumo):
${(caso.esperado.aIaPrecisaPerceber || []).map((t, i) => `P${i + 1}. ${t}`).join("\n")}

AS MENSAGENS NÃO PODEM (olhe as três mensagens):
${(caso.esperado.asMensagensNaoPodem || []).map((t, i) => `N${i + 1}. ${t}`).join("\n")}

AS MENSAGENS PRECISAM (olhe as três mensagens):
${(caso.esperado.asMensagensPrecisam || []).map((t, i) => `S${i + 1}. ${t}`).join("\n")}

Devolva SÓ este JSON, sem texto em volta:
{"itens":[{"codigo":"P1","cumpriu":true,"porque":"uma frase curta citando o trecho que prova"}]}
Um item para CADA código listado acima. "cumpriu" para N* significa que a proibição foi RESPEITADA.`;
}

export async function julgarCaso({ openai, caso, analise, organizationId = null }) {
  const modelo = modeloJuiz();
  const r = await openai.chat.completions.create({
    model: modelo,
    messages: [{ role: "user", content: montarPedidoDoJuiz(caso, analise) }],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 1200
  });
  if (organizationId) {
    await registrarUsoIA({ organizationId, kind: "chat", model: r?.model || modelo, rota: "bateria-juiz", usage: r?.usage });
  }
  try { return JSON.parse(r.choices?.[0]?.message?.content || "{}")?.itens || []; }
  catch (_) { return []; }
}

// Roda UMA conversa da bateria: análise de verdade + julgamento. Nunca lança — erro vira resultado
// com a explicação, porque a bateria inteira não pode morrer por causa de uma conversa.
export async function rodarCaso({ openai, caso, cerebroConfig = null, organizationId = null, etapas = null }) {
  const timeline = caso.conversa.map(m => ({ ...m, type: m.type || "text" }));
  const lead = guessLeadData(timeline, caso.corretorNome, caso.nomeArquivo);
  try {
    const analise = await analyzeWithBrain({ lead, timeline, openai, cerebroConfig, etapas, ...(organizationId ? { organizationId } : {}) });
    const itens = await julgarCaso({ openai, caso, analise, organizationId });
    return {
      id: caso.id,
      titulo: caso.titulo,
      ok: itens.filter(i => i.cumpriu).length,
      total: itens.length,
      itens,
      falhas: itens.filter(i => !i.cumpriu).map(i => ({ codigo: i.codigo, porque: i.porque || "" })),
      clienteIdentificado: lead.clientName,
      mensagens: [analise?.messages?.a, analise?.messages?.b, analise?.messages?.c].filter(Boolean),
      proximoPasso: analise?.nextAction || ""
    };
  } catch (e) {
    return { id: caso.id, titulo: caso.titulo, erro: e?.message || String(e), ok: 0, total: 0, itens: [], falhas: [] };
  }
}
