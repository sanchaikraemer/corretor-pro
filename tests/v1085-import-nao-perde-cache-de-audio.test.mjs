import assert from "node:assert/strict";
import { _buscarProcessamentoExistenteV681 } from "../api/_persistence.js";
import { transcricoesDoLeadAnterior } from "../api/processar-storage.js";

// v1085 — REGRESSÃO GRAVE introduzida na v1082 e relatada pelo dono ("não tá importando a
// conversa, fica lendo, atualizando e não conclui").
//
// A v1082 tirou o timeline_json desta consulta por desempenho (ela varre até 5 mil leads) e
// passou a buscar a conversa do lead encontrado numa SEGUNDA consulta. O problema não é o
// desempenho — é o modo de falhar: se a segunda consulta não devolvesse a conversa, nada
// estourava. O efeito era silencioso e devastador no caminho mais caro do app:
//
//   conversa vazia → transcricoesDoLeadAnterior devolve {} → NENHUM áudio é reaproveitado →
//   toda reimportação transcreve TODOS os áudios de novo → estoura o limite de tempo da função
//   → a importação fica "lendo" pra sempre e nunca conclui (e ainda paga a transcrição de novo).
//
// Este teste tranca as duas pontas: a conversa vem na MESMA consulta, e o cache de áudio que
// depende dela é montado de verdade.

const AUDIO = "[Áudio transcrito] ";

function supabaseFake(rows, registro, { falharSegunda = false } = {}) {
  return {
    from(tabela) {
      registro.tabelas.push(tabela);
      return {
        select(colunas) {
          registro.selects.push(colunas);
          const ehSegunda = String(colunas).includes("timeline_json") && String(colunas).startsWith("id,timeline_json");
          if (ehSegunda && falharSegunda) {
            const falha = () => Promise.resolve({ data: null, error: { message: "falha simulada na releitura" } });
            return { eq: () => ({ order: () => ({ limit: falha }), limit: falha }), order: () => ({ limit: falha }), limit: falha };
          }
          return {
            eq() {
              return {
                order() {
                  return { limit: () => Promise.resolve({ data: rows, error: null }) };
                },
                limit: () => Promise.resolve({ data: rows, error: null })
              };
            },
            order() { return { limit: () => Promise.resolve({ data: rows, error: null }) }; },
            limit: () => Promise.resolve({ data: rows, error: null })
          };
        }
      };
    }
  };
}

const timelineComAudios = [
  { type: "audio", audioStatus: "transcrito", mediaFile: "PTT-001.opus", text: AUDIO + "quero visitar no sábado" },
  { type: "audio", audioStatus: "transcrito", mediaFile: "PTT-002.opus", text: AUDIO + "qual o valor da entrada?" },
  { type: "texto", author: "Cliente", text: "obrigado" }
];

const linha = {
  id: "lead-1",
  nome_arquivo: "Conversa do WhatsApp com Marcos.zip",
  arquivo_nome: "Conversa do WhatsApp com Marcos.zip",
  telefone: "54999013331",
  etapa: "Geladeira",
  resultado_analise: { clientName: "Marcos", lead: { clientName: "Marcos", phone: "54999013331" } },
  timeline_json: timelineComAudios
};

const registro = { tabelas: [], selects: [] };
const achado = await _buscarProcessamentoExistenteV681(supabaseFake([linha], registro), {
  result: { analysis: { clientName: "Marcos" }, lead: { clientName: "Marcos", phone: "54999013331" } },
  fileName: "Conversa do WhatsApp com Marcos.zip",
  organizationId: "org-1"
});

// 1. Achou o lead.
assert.ok(achado?.row, "precisa encontrar o lead existente pra reimportação atualizar o mesmo cadastro");
assert.equal(achado.row.id, "lead-1");

// 2. A varredura da carteira é LEVE — ela não pode baixar a conversa inteira de até 5 mil leads
// (roda duas vezes por importação; era o que fazia a importação levar minutos).
assert.ok(!registro.selects[0].includes("timeline_json"),
  "a varredura da carteira não pode trazer timeline_json de todos os leads");

// 3. Mas a conversa do lead ENCONTRADO vem, sim — numa busca dirigida só a ele.
assert.ok(Array.isArray(achado.row.timeline_json) && achado.row.timeline_json.length === 3,
  "a conversa anterior do lead encontrado precisa vir junto");

// 4. E a etapa também — sem ela, a proteção da v1082 contra desarquivar na reimportação não
// funciona (anterior.etapa ficava undefined e caía sempre em "Ativo").
assert.ok(registro.selects[0].includes("etapa"),
  "etapa precisa vir na consulta pra reimportação não desarquivar o lead");
assert.equal(achado.row.etapa, "Geladeira", "a etapa salva precisa chegar em quem decide o que gravar");

// 5. O efeito prático: o cache de áudio é montado de verdade. Se isto vier vazio, toda
// reimportação re-transcreve tudo e a importação trava.
const cache = transcricoesDoLeadAnterior(achado.row.timeline_json);
assert.equal(Object.keys(cache).length, 2, "os dois áudios já transcritos precisam ser reaproveitados");
assert.equal(cache["PTT-001.opus"], "quero visitar no sábado");
assert.equal(cache["PTT-002.opus"], "qual o valor da entrada?");

// 6. A REGRA DE OURO desta correção: se a leitura da conversa falhar, tem que ESTOURAR.
// Devolver conversa vazia em silêncio foi exatamente o que quebrou a importação na v1082 —
// o cache de áudio sumia, tudo era re-transcrito e a importação nunca terminava.
{
  const reg2 = { tabelas: [], selects: [] };
  await assert.rejects(
    () => _buscarProcessamentoExistenteV681(supabaseFake([linha], reg2, { falharSegunda: true }), {
      result: { analysis: { clientName: "Marcos" }, lead: { clientName: "Marcos", phone: "54999013331" } },
      fileName: "Conversa do WhatsApp com Marcos.zip",
      organizationId: "org-1"
    }),
    /conversa já salva/i,
    "falha ao reler a conversa PRECISA estourar — nunca devolver conversa vazia como se fosse real"
  );
}

console.log("v1085-import-nao-perde-cache-de-audio: ok");
