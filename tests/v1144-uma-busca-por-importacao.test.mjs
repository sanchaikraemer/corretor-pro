import assert from "node:assert/strict";
import { _buscarProcessamentoExistenteV681, _dedupeIndexadoResetar } from "../api/_persistence.js";

// v1144 — "por que 2x em cada importação? não tem nem coerência isso, por quê?" (dono).
//
// Ele está certo. A busca "esse cliente já existe?" rodava duas vezes por importação, respondendo
// perguntas escritas em épocas diferentes, uma sem saber da outra:
//   1ª — ao abrir o ZIP: pra reaproveitar transcrições já pagas (e, desde a v1141, a análise salva);
//   2ª — ao salvar: pra decidir entre atualizar o cadastro existente ou criar um novo.
//
// A resposta é a MESMA. Agora a segunda recebe o id que a primeira encontrou e só CONFERE aquela
// linha (uma leitura pontual) em vez de varrer a carteira de novo. Conferir e não confiar direto
// porque o id passa pelo navegador: nada que vem de fora manda numa decisão de fundir cadastros.

const ORG = "00000000-0000-0000-0000-000000000001";

function criarBanco(linhas) {
  const consultas = [];
  return {
    consultas,
    from() {
      return {
        select(cols) {
          const filtros = [];
          consultas.push({ cols: String(cols), filtros });
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
}

const LEAD = {
  id: "lead-1",
  organization_id: ORG,
  nome_arquivo: "Conversa do WhatsApp com Nasser-enxuto.zip",
  arquivo_nome: "Conversa do WhatsApp com Nasser-enxuto.zip",
  telefone: "54999013331",
  etapa: "Ativo",
  atualizado_em: "2026-08-05T10:00:00.000Z",
  timeline_json: [{ type: "text", author: "Nasser", text: "oi" }],
  resultado_analise: { clientName: "Nasser", lead: { phone: "54999013331" } }
};

// ── 1. Com o id já identificado, confere UMA linha — sem varrer a carteira ─────────────────────
{
  _dedupeIndexadoResetar();
  const banco = criarBanco([LEAD]);
  const achado = await _buscarProcessamentoExistenteV681(banco, {
    result: { incrementalMeta: { existingLeadId: "lead-1" } },
    fileName: "Conversa do WhatsApp com Nasser-enxuto.zip",
    organizationId: ORG,
    idJaIdentificado: "lead-1"
  });
  assert.equal(achado?.row?.id, "lead-1", "encontra o cliente pelo id que a primeira busca já tinha achado");
  assert.match(String(achado.via), /^id-conferido-/, "e registra que veio por conferência de id");
  assert.equal(achado.row.timeline_json.length, 1, "a conversa salva vem junto (o salvamento mescla com ela)");
  assert.equal(banco.consultas.length, 1, "UMA consulta só — nada de varrer a carteira de novo");
  assert.ok(banco.consultas[0].filtros.some(([c, v]) => c === "id" && v === "lead-1"), "a consulta é pontual, pelo id");
  assert.ok(banco.consultas[0].filtros.some(([c, v]) => c === "organization_id" && v === ORG), "e sempre presa à empresa do corretor");
}

// ── 2. Id que NÃO é do mesmo cliente é ignorado — a busca completa decide ──────────────────────
// Cenário de segurança: o id viaja pelo navegador. Se vier apontando pra outro cliente da mesma
// conta, conferir evita fundir duas conversas diferentes.
{
  _dedupeIndexadoResetar();
  const outro = { ...LEAD, id: "lead-outro", nome_arquivo: "Conversa do WhatsApp com Beatriz.zip", arquivo_nome: "Conversa do WhatsApp com Beatriz.zip", telefone: "", resultado_analise: { clientName: "Beatriz" } };
  const banco = criarBanco([outro]);
  const achado = await _buscarProcessamentoExistenteV681(banco, {
    result: { incrementalMeta: { existingLeadId: "lead-outro" } },
    fileName: "Conversa do WhatsApp com Nasser-enxuto.zip",
    organizationId: ORG,
    idJaIdentificado: "lead-outro"
  });
  assert.equal(achado, null, "id de outro cliente não vira fusão de cadastro");
  assert.ok(banco.consultas.length > 1, "depois de rejeitar o id, a busca normal roda inteira");
}

// ── 3. Id inexistente não quebra nada: cai na busca normal e acha pelo nome do arquivo ─────────
{
  _dedupeIndexadoResetar();
  const banco = criarBanco([LEAD]);
  const achado = await _buscarProcessamentoExistenteV681(banco, {
    result: { incrementalMeta: { existingLeadId: "lead-que-nao-existe" } },
    fileName: "Conversa-do-WhatsApp-com-Nasser-enxuto.zip",
    organizationId: ORG,
    idJaIdentificado: "lead-que-nao-existe"
  });
  assert.equal(achado?.row?.id, "lead-1", "sem o id válido, a busca de sempre encontra o cliente");
}

// ── 4. Sem id nenhum, o comportamento é o de antes (nada muda pra quem não tem a dica) ────────
{
  _dedupeIndexadoResetar();
  const banco = criarBanco([LEAD]);
  const achado = await _buscarProcessamentoExistenteV681(banco, {
    result: {},
    fileName: "Conversa do WhatsApp com Nasser-enxuto.zip",
    organizationId: ORG
  });
  assert.equal(achado?.row?.id, "lead-1", "sem dica, encontra do jeito antigo");
  assert.ok(!banco.consultas[0].filtros.some(([c]) => c === "id"), "e não inventa consulta por id");
}

// ── 5. O salvamento passa a dica adiante ──────────────────────────────────────────────────────
{
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");
  assert.match(src, /idJaIdentificado: result\?\.incrementalMeta\?\.existingLeadId \|\| ""/,
    "persistProcessingResult repassa o id que a etapa de abrir o ZIP já identificou");
}

console.log("v1144-uma-busca-por-importacao: ok");
