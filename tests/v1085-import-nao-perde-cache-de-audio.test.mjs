import assert from "node:assert/strict";
import { _buscarProcessamentoExistenteV681, _dedupeIndexadoResetar } from "../api/_persistence.js";
import { transcricoesDoLeadAnterior } from "../api/processar-storage.js";

// v1085 — REGRESSÃO GRAVE da v1082 ("não tá importando a conversa, fica lendo, atualizando e não
// conclui"). A busca do lead existente deixou de trazer a conversa junto, e a conversa é de onde
// sai o cache de transcrição de áudio: sem ela, TODA reimportação re-transcrevia todos os áudios,
// estourava o tempo da função e a importação nunca terminava.
//
// v1092 — a busca ganhou um CAMINHO RÁPIDO indexado (migração 0010). Este teste passou a cobrir
// os DOIS estados possíveis do banco, porque os dois vão existir em produção:
//   A) migração ainda não aplicada  → cai na varredura (é o estado de hoje);
//   B) migração aplicada            → acha direto pelo índice.
// Em ambos, a conversa e a etapa precisam chegar em quem grava.

const AUDIO = "[Áudio transcrito] ";

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

const pedido = {
  result: { analysis: { clientName: "Marcos" }, lead: { clientName: "Marcos", phone: "54999013331" } },
  fileName: "Conversa do WhatsApp com Marcos.zip",
  organizationId: "org-1"
};

// Banco de mentira que distingue as duas consultas:
//  • caminho rápido: .eq(organization_id).eq(dedupe_*)  → dois eq encadeados
//  • varredura:      .eq(organization_id)               → um eq só
function bancoFalso({ migracaoAplicada, registro }) {
  const resolver = (rows) => () => Promise.resolve({ data: rows, error: null });
  return {
    from() {
      return {
        select(colunas) {
          registro.selects.push(colunas);
          return {
            eq(coluna) {
              // 1º eq = organization_id. O 2º (se houver) é a coluna indexada.
              return {
                eq(colIndexada, valor) {
                  registro.indexadas.push(colIndexada);
                  if (!migracaoAplicada) {
                    const erro = { message: `column whatsapp_processamentos.${colIndexada} does not exist (schema cache)` };
                    const falha = () => Promise.resolve({ data: null, error: erro });
                    return { order: () => ({ limit: falha }), limit: falha };
                  }
                  const casa = String(linha.telefone).slice(-8) === valor
                    || String(valor).includes("marcos");
                  return { order: () => ({ limit: resolver(casa ? [linha] : []) }), limit: resolver(casa ? [linha] : []) };
                },
                order: () => ({ limit: resolver([linha]) }),
                limit: resolver([linha])
              };
            },
            order: () => ({ limit: resolver([linha]) }),
            limit: resolver([linha])
          };
        }
      };
    }
  };
}

// ── ESTADO A: migração 0010 ainda não aplicada (produção de hoje) ─────────────────────────────
{
  _dedupeIndexadoResetar();
  const registro = { selects: [], indexadas: [] };
  const achado = await _buscarProcessamentoExistenteV681(bancoFalso({ migracaoAplicada: false, registro }), pedido);

  assert.ok(achado?.row, "sem a migração, a busca precisa continuar encontrando o lead pela varredura");
  assert.equal(achado.row.id, "lead-1");
  assert.ok(registro.indexadas.length >= 1, "precisa ter TENTADO o caminho rápido antes de varrer");

  // A varredura da carteira é a consulta que traz os campos de identificação (nome do arquivo).
  // Ela NÃO pode carregar a conversa de todos os leads — era o que fazia a importação levar
  // minutos (v1086). A conversa do lead encontrado vem numa consulta dirigida só a ele.
  // A varredura é a consulta de identificação SEM a conversa; o caminho rápido, por ser dirigido
  // a um lead só, pode trazer a conversa junto sem custo.
  const varredura = registro.selects.find(c => c.includes("nome_arquivo") && !c.includes("timeline_json"));
  assert.ok(varredura,
    "precisa existir uma varredura leve (com os campos de identificação e SEM a conversa de todos os leads)");
  assert.ok(varredura.includes("etapa"),
    "a varredura precisa trazer a etapa, senão reimportar desarquiva o lead");
  const buscaDirigida = registro.selects.find(c => c.startsWith("id,timeline_json"));
  assert.ok(buscaDirigida, "a conversa do lead encontrado precisa ser buscada numa consulta própria");

  // O efeito prático, que é o que realmente importa.
  const cache = transcricoesDoLeadAnterior(achado.row.timeline_json);
  assert.equal(Object.keys(cache).length, 2, "os dois áudios já transcritos precisam ser reaproveitados");
  assert.equal(cache["PTT-001.opus"], "quero visitar no sábado");
  assert.equal(achado.row.etapa, "Geladeira", "a etapa salva precisa chegar em quem decide o que gravar");
}

// ── ESTADO B: migração aplicada — acha direto, sem varrer a carteira ──────────────────────────
{
  _dedupeIndexadoResetar();
  const registro = { selects: [], indexadas: [] };
  const achado = await _buscarProcessamentoExistenteV681(bancoFalso({ migracaoAplicada: true, registro }), pedido);

  assert.ok(achado?.row, "com a migração, a busca precisa encontrar o lead pelo índice");
  assert.equal(achado.row.id, "lead-1");
  assert.equal(achado.via, "telefone", "a prioridade continua sendo telefone primeiro");
  assert.ok(!registro.selects.some(c => c.includes("nome_arquivo") && !c.includes("dedupe") && c.length > 60 && !c.startsWith("id,nome_arquivo,arquivo_nome,telefone,etapa,resultado_analise,timeline_json")),
    "achando pelo índice, não pode haver varredura da carteira");
  assert.equal(registro.selects.length, 1,
    `o caminho rápido resolve em UMA consulta (houve ${registro.selects.length})`);
  assert.equal(registro.indexadas[0], "dedupe_fone8", "a primeira tentativa indexada é pelo telefone");

  // Mesmo pelo caminho rápido, a conversa e a etapa vêm juntas — é o que impede a regressão da v1082.
  const cache = transcricoesDoLeadAnterior(achado.row.timeline_json);
  assert.equal(Object.keys(cache).length, 2,
    "o caminho rápido também precisa trazer a conversa, senão o cache de áudio some de novo");
  assert.equal(achado.row.etapa, "Geladeira");
}

// ── A ordem de prioridade da deduplicação não pode mudar ──────────────────────────────────────
{
  _dedupeIndexadoResetar();
  const registro = { selects: [], indexadas: [] };
  await _buscarProcessamentoExistenteV681(bancoFalso({ migracaoAplicada: true, registro }), {
    result: { analysis: { clientName: "Ninguem Com Esse Nome" }, lead: { clientName: "Ninguem Com Esse Nome" } },
    fileName: "arquivo-que-nao-existe.zip",
    organizationId: "org-1"
  });
  assert.deepEqual(registro.indexadas, ["dedupe_arquivo", "dedupe_nome"],
    "sem telefone, a ordem precisa ser arquivo e depois nome — a mesma da varredura");
}

_dedupeIndexadoResetar();
console.log("v1085-import-nao-perde-cache-de-audio: ok");
