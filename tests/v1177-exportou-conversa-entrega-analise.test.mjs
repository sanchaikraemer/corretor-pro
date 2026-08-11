import assert from "node:assert/strict";
import fs from "node:fs";
import { finalizarAnaliseDaConversa } from "../api/_pipeline.js";
import { _buscarProcessamentoExistenteV681, _dedupeIndexadoResetar } from "../api/_persistence.js";

// v1177 — "quando eu exporto uma conversa tem que fazer análise e ponto final. Eu não tenho que
// exportar um cliente e daí o sistema vai me mandar fazer análise" (dono, 07/08/2026).
//
// Ele estava certo em duas frentes:
//
// 1. A economia da v1141 (reimportação sem novidade não paga análise nova) reaproveitava a análise
//    salva SEM conferir se a tela ainda a aceita. Num cadastro cuja análise era de versão antiga,
//    o card mostra "Análise comercial pendente nesta versão. Reanalise…" — e reexportar aquele
//    cliente reaproveitava exatamente esse texto recusado: a exportação não mudava nada e o
//    sistema continuava mandando ele reanalisar na mão.
//
// 2. A trava da v1176 (contra misturar clientes) tinha ficado larga demais: ela também exigia
//    nomes compatíveis quando a pista era o NOME DO ARQUIVO. Como o corretor pode editar o nome do
//    cadastro à mão (v1061), o mesmo cliente deixaria de ser reconhecido e a exportação criaria um
//    cadastro repetido em vez de atualizar. A trava agora vale só onde o problema existia: no
//    telefone.
//    (v1181 — este segundo ponto foi REVERTIDO: a trava voltou a valer pro nome do arquivo também.
//     Ela nunca exigiu nomes IGUAIS — nome editado à mão e cadastro sem nome continuam passando,
//     como os casos 3 e 5/6 do teste da v1181 provam —, só proíbe juntar pessoas diferentes.)

const MSGS = [
  { date: "2026-07-01", time: "09:10", author: "Cliente", text: "bom dia, ainda tem unidade?", iso: "2026-07-01T09:10:00.000Z", order: 1 },
  { date: "2026-07-01", time: "09:14", author: "Corretor", text: "bom dia! tenho sim, te mando as opcoes", iso: "2026-07-01T09:14:00.000Z", order: 2 }
];
const TRIO = {
  a: "Oi! Passando pra confirmar se ainda faz sentido olharmos as opções que te mandei.",
  b: "Oi, tudo bem? Fico à disposição se quiser retomar a conversa das unidades.",
  c: "Consegue me dizer hoje se seguimos com a unidade que você viu?",
  aLabel: "Recomendada", bLabel: "Mais suave", cLabel: "Mais direta", recomendada: "a"
};

const reimportar = (previousAnalysis) => finalizarAnaliseDaConversa({
  txtFile: "Conversa do WhatsApp com Cliente.txt",
  messages: MSGS,
  audioFilesRelevantes: [],
  transcriptionMap: {},
  existingLeadId: "lead-1",
  existingTimeline: MSGS.map(m => ({ ...m, type: "text", source: "txt" })),
  previousAnalysis
});

// ── 1. Análise salva que a TELA recusa nunca é reaproveitada: a exportação analisa de novo ─────
// (sem OPENAI_API_KEY no ambiente de teste, uma análise nova sai em modo "sem_api" — é a prova
// de que a IA foi chamada em vez de devolver o texto velho.)
const RECUSADAS_PELA_TELA = [
  { rotulo: "arquitetura antiga", analise: { summary: "x", messages: TRIO, arquiteturaMensagens: "v700-antiga" } },
  { rotulo: "sem carimbo de arquitetura", analise: { summary: "x", messages: TRIO } },
  { rotulo: "reconciliação local", analise: { summary: "x", messages: TRIO, arquiteturaMensagens: "v852-cerebro-unico-obrigatorio", mode: "reconciliacao_local" } },
  { rotulo: "reanálise pendente", analise: { summary: "x", messages: TRIO, arquiteturaMensagens: "v852-cerebro-unico-obrigatorio", mode: "reanalise_pendente" } }
];
for (const caso of RECUSADAS_PELA_TELA) {
  const r = await reimportar(caso.analise);
  assert.equal(r.incrementalMeta.analiseReutilizada, false, `análise salva (${caso.rotulo}) não pode ser reaproveitada — a tela a recusa`);
  assert.equal(r.analysis.mode, "sem_api", `com análise salva (${caso.rotulo}), a exportação roda a análise de novo`);
}

// ── 2. Análise salva boa continua sendo reaproveitada (a economia da v1141 fica de pé) ─────────
{
  // v1221 — não existe mais atalho: a IA é chamada sempre. O que este caso guarda agora é a REDE
  // DE SEGURANÇA — sem chave neste ambiente a análise nova sai imprestável, e a salva boa volta
  // pra tela em vez de o corretor ficar sem nada.
  const r = await reimportar({ summary: "x", clientName: "Cliente", messages: TRIO, arquiteturaMensagens: "v852-cerebro-unico-obrigatorio" });
  assert.equal(r.incrementalMeta.analiseReutilizada, true, "análise nova imprestável + salva boa → a salva é mantida");
  assert.equal(r.incrementalMeta.analiseNovaTentada, true, "e a IA foi chamada mesmo assim — importou, analisa (v1221)");
}

// ── 3. Mesmo cliente com o nome do cadastro editado à mão continua sendo ATUALIZADO ────────────
// O nome do arquivo é o nome do contato na hora de exportar; o nome do cadastro pode ter sido
// editado depois pelo corretor (v1061). Isso não pode virar cadastro repetido.
{
  _dedupeIndexadoResetar();
  const ORG = "00000000-0000-0000-0000-000000000001";
  const banco = {
    from() {
      return {
        select() {
          const filtros = [];
          const linhas = [{
            id: "lead-1",
            organization_id: ORG,
            nome_arquivo: "Conversa do WhatsApp com Marina Alves.zip",
            arquivo_nome: "Conversa do WhatsApp com Marina Alves.zip",
            dedupe_arquivo: "marina alves",
            dedupe_nome: "marina alves apto 302",
            telefone: "",
            etapa: "Ativo",
            atualizado_em: "2026-08-07T17:00:00.000Z",
            timeline_json: [{ type: "text", author: "Marina Alves", text: "oi" }],
            // nome do cadastro editado à mão pelo corretor — diferente do nome do arquivo
            resultado_analise: { clientName: "Marina Alves Apto 302 Pai da Ana" }
          }];
          const aplicar = () => linhas.filter(l => filtros.every(([c, v]) => String(l[c] ?? "") === String(v)));
          const construtor = {
            eq(c, v) { filtros.push([c, v]); return construtor; },
            order() { return construtor; },
            limit() { return Promise.resolve({ data: aplicar(), error: null }); },
            maybeSingle() { return Promise.resolve({ data: aplicar()[0] || null, error: null }); },
            then(res, rej) { return Promise.resolve({ data: aplicar(), error: null }).then(res, rej); }
          };
          return construtor;
        }
      };
    }
  };
  const achado = await _buscarProcessamentoExistenteV681(banco, {
    result: { lead: { clientName: "Marina Alves", phone: "" } },
    fileName: "Conversa do WhatsApp com Marina Alves.zip",
    organizationId: ORG
  });
  assert.equal(achado?.row?.id, "lead-1", "o mesmo arquivo do mesmo contato continua atualizando o cadastro que já existe");
}

// ── 4. A trava contra misturar clientes continua valendo — e desde a v1181 vale pra TODAS as
//      chaves, não só pro telefone (o caso 3 acima prova que o mesmo cliente continua reconhecido).
//
//      Por que a decisão da v1177 (soltar o nome do arquivo) foi revertida: quando uma importação
//      entra no cadastro errado, a gravação carimba o nome do arquivo da outra pessoa naquele
//      cadastro — e aí a conversa voltava pra ele em toda reexportação, mesmo com o nome do cliente
//      já correto. Foi o que o dono viu depois da v1180.
{
  const persistence = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");
  assert.match(persistence, /rowPhone\.slice\(-8\) === phoneKey && podeFundirCom\(row\)/, "a varredura por telefone continua travada");
  assert.match(persistence, /rowFile === arquivoKey && podeFundirCom\(row\)/, "a varredura por nome de arquivo também");
  assert.match(persistence, /if \(achado && podeFundirCom\(achado\)\)/, "e o caminho rápido trava todas as chaves");
}

console.log("v1177-exportou-conversa-entrega-analise: ok");
