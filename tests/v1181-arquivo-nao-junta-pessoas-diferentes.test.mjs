import assert from "node:assert/strict";
import { _buscarProcessamentoExistenteV681, _dedupeIndexadoResetar } from "../api/_persistence.js";

// v1181 — "Você não resolveu merda nenhuma. Acabei de exportar a conversa de Anderson e apareceu o
// lead Estevan." (dono, depois da v1180).
//
// Ele estava certo de novo, e a causa era uma SEGUNDA porta, que nada tinha a ver com o nome do
// cartão: depois que uma importação entra no cadastro errado, a gravação sobrescreve o
// `nome_arquivo`/`dedupe_arquivo` daquele cadastro com o arquivo da OUTRA pessoa (updatePayload em
// persistProcessingResult). O cadastro do Estevan passou a carregar o nome do arquivo do Anderson —
// e a busca por NOME DE ARQUIVO era a única chave sem a trava de "pessoas diferentes" (a v1176/1177
// tinha travado só o telefone). Resultado: toda reexportação da conversa do Anderson voltava pro
// cadastro do Estevan, mesmo com o nome do cliente já correto desde a v1180.

const ORG = "00000000-0000-0000-0000-000000000001";

function criarBanco(linhas) {
  return {
    from() {
      return {
        select() {
          const filtros = [];
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

// O cadastro invadido: é do Estevan, mas carrega o arquivo do Anderson desde a importação errada.
const LEAD_INVADIDO = {
  id: "lead-estevan",
  organization_id: ORG,
  nome_arquivo: "Conversa do WhatsApp com Anderson Vetter.zip",
  arquivo_nome: "Conversa do WhatsApp com Anderson Vetter.zip",
  dedupe_arquivo: "anderson vetter",
  dedupe_nome: "estevan miller",
  telefone: "",
  etapa: "Ativo",
  atualizado_em: "2026-08-07T20:00:00.000Z",
  timeline_json: [{ type: "text", author: "Estevan Miller", text: "oi" }],
  resultado_analise: { clientName: "Estevan Miller", lead: { clientName: "Estevan Miller" } }
};

const IMPORTACAO_ANDERSON = {
  result: { lead: { clientName: "Anderson Vetter" }, analysis: { clientName: "Anderson Vetter" } },
  fileName: "Conversa do WhatsApp com Anderson Vetter.zip",
  organizationId: ORG
};

// ── 1. Nome de arquivo igual NÃO junta duas pessoas diferentes (caminho rápido, por coluna) ────
{
  _dedupeIndexadoResetar();
  const achado = await _buscarProcessamentoExistenteV681(criarBanco([LEAD_INVADIDO]), IMPORTACAO_ANDERSON);
  assert.equal(achado, null, "a conversa do Anderson não pode voltar pro cadastro do Estevan pelo nome do arquivo");
}

// ── 2. Mesma trava quando o id do cadastro errado chega pelo navegador ─────────────────────────
{
  _dedupeIndexadoResetar();
  const achado = await _buscarProcessamentoExistenteV681(criarBanco([LEAD_INVADIDO]), {
    ...IMPORTACAO_ANDERSON,
    result: { ...IMPORTACAO_ANDERSON.result, incrementalMeta: { existingLeadId: "lead-estevan" } },
    idJaIdentificado: "lead-estevan"
  });
  assert.equal(achado, null, "nem conferindo o id o cadastro de outra pessoa é aceito");
}

// ── 3. Mesma trava na varredura antiga (banco sem as colunas de deduplicação) ──────────────────
{
  _dedupeIndexadoResetar();
  const { dedupe_arquivo, dedupe_nome, ...semColunas } = LEAD_INVADIDO;
  const achado = await _buscarProcessamentoExistenteV681(criarBanco([semColunas]), IMPORTACAO_ANDERSON);
  assert.equal(achado, null, "a varredura sem índice segue a mesma regra");
}

// ── 4. O MESMO cliente continua sendo reconhecido — a trava não cria duplicata ─────────────────
{
  _dedupeIndexadoResetar();
  const leadAnderson = {
    ...LEAD_INVADIDO,
    id: "lead-anderson",
    dedupe_nome: "anderson vetter",
    resultado_analise: { clientName: "Anderson Vetter", lead: { clientName: "Anderson Vetter" } },
    timeline_json: [{ type: "text", author: "Anderson Vetter", text: "oi" }]
  };
  const achado = await _buscarProcessamentoExistenteV681(criarBanco([leadAnderson]), IMPORTACAO_ANDERSON);
  assert.equal(achado?.row?.id, "lead-anderson", "reexportar a conversa do mesmo cliente continua atualizando o cadastro dele");
}

// ── 5. Nome editado à mão pelo corretor continua reconhecendo o mesmo cliente (v1061) ─────────
{
  _dedupeIndexadoResetar();
  const leadRenomeado = {
    ...LEAD_INVADIDO,
    id: "lead-renomeado",
    dedupe_nome: "anderson vetter terreno nvr",
    resultado_analise: { clientName: "Anderson Vetter terreno NVR" },
    timeline_json: [{ type: "text", author: "Anderson Vetter", text: "oi" }]
  };
  const achado = await _buscarProcessamentoExistenteV681(criarBanco([leadRenomeado]), IMPORTACAO_ANDERSON);
  assert.equal(achado?.row?.id, "lead-renomeado", "nome com palavras a mais é o mesmo cliente, não um novo");
}

// ── 6. Cadastro ainda sem nome analisado (só o arquivo) continua sendo atualizado ─────────────
{
  _dedupeIndexadoResetar();
  const leadSemNome = {
    ...LEAD_INVADIDO,
    id: "lead-sem-nome",
    dedupe_nome: null,
    resultado_analise: {},
    timeline_json: [{ type: "text", author: "Anderson Vetter", text: "oi" }]
  };
  const achado = await _buscarProcessamentoExistenteV681(criarBanco([leadSemNome]), IMPORTACAO_ANDERSON);
  assert.equal(achado?.row?.id, "lead-sem-nome", "sem nome salvo, o nome do arquivo continua decidindo sozinho");
}

console.log("v1181-arquivo-nao-junta-pessoas-diferentes: ok");
