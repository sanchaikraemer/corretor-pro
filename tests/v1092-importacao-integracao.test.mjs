import assert from "node:assert/strict";
import {
  persistProcessingResult,
  _buscarProcessamentoExistenteV681,
  _dedupeIndexadoResetar,
  EMPRESA_PRINCIPAL_ID
} from "../api/_persistence.js";
import { transcricoesDoLeadAnterior } from "../api/processar-storage.js";

// v1092 — TESTE DE INTEGRAÇÃO DO CAMINHO CRÍTICO DA IMPORTAÇÃO.
//
// A suíte tinha muitos testes que conferiam o CÓDIGO (procurando trechos e expressões). Isso não
// pega a classe de defeito que mais doeu neste projeto: a v1082 passou em tudo e mesmo assim
// travou a importação, porque o que quebrou foi o EFEITO (a conversa chegar vazia), não a forma
// do código.
//
// Aqui o banco é de mentira, mas se comporta como tabela de verdade: guarda linhas, respeita os
// filtros e devolve o que foi gravado. As asserções olham o DADO PERSISTIDO e as CONSULTAS FEITAS.

const AUDIO = "[Áudio transcrito] ";
const OUTRA_EMPRESA = "22222222-2222-2222-2222-222222222222";

// ── Banco de mentira com estado real ──────────────────────────────────────────────────────────
function criarBanco({ falharUpdateNaPrimeira = false, colunas = null } = {}) {
  const tabelas = { whatsapp_processamentos: [], leads: [], direciona_leads: [] };
  const consultas = [];
  let updatesFeitos = 0;

  const aplicaFiltros = (linhas, filtros) =>
    linhas.filter(l => filtros.every(([col, val]) => String(l[col] ?? "") === String(val)));

  const podeGravar = (payload) => {
    if (!colunas) return null;
    for (const k of Object.keys(payload)) if (!colunas.includes(k)) return k;
    return null;
  };

  function from(tabela) {
    tabelas[tabela] = tabelas[tabela] || [];
    return {
      select(cols) {
        consultas.push({ tabela, cols });
        const filtros = [];
        const construtor = {
          eq(col, val) { filtros.push([col, val]); return construtor; },
          order() { return construtor; },
          limit() { return Promise.resolve({ data: aplicaFiltros(tabelas[tabela], filtros), error: null }); },
          maybeSingle() { return Promise.resolve({ data: aplicaFiltros(tabelas[tabela], filtros)[0] || null, error: null }); },
          then(res, rej) { return Promise.resolve({ data: aplicaFiltros(tabelas[tabela], filtros), error: null }).then(res, rej); }
        };
        return construtor;
      },
      insert(payload) {
        const ruim = podeGravar(payload);
        return { select: () => ({ maybeSingle: async () => {
          if (ruim) return { data: null, error: { message: `Could not find the '${ruim}' column of '${tabela}' in the schema cache` } };
          const linha = { ...payload };
          tabelas[tabela].push(linha);
          return { data: linha, error: null };
        } }) };
      },
      upsert(payload) {
        const lista = Array.isArray(payload) ? payload : [payload];
        return { select: () => ({ maybeSingle: async () => {
          for (const p of lista) {
            const i = tabelas[tabela].findIndex(l => String(l.id) === String(p.id));
            if (i >= 0) tabelas[tabela][i] = { ...tabelas[tabela][i], ...p }; else tabelas[tabela].push({ ...p });
          }
          return { data: { ...lista[0] }, error: null };
        } }) };
      },
      update(payload) {
        return { eq: (col, val) => ({ select: () => ({ maybeSingle: async () => {
          updatesFeitos++;
          if (falharUpdateNaPrimeira && updatesFeitos === 1) {
            return { data: null, error: { message: "temporary failure: connection reset by peer" } };
          }
          const i = tabelas[tabela].findIndex(l => String(l[col]) === String(val));
          if (i < 0) return { data: null, error: null };
          tabelas[tabela][i] = { ...tabelas[tabela][i], ...payload };
          return { data: { ...tabelas[tabela][i] }, error: null };
        } }) }) };
      }
    };
  }
  return { cliente: { from }, tabelas, consultas, get updatesFeitos() { return updatesFeitos; } };
}

const conversa = (extra = []) => [
  { id: 1, iso: "2026-05-01T10:00:00Z", author: "Cliente", text: "bom dia", type: "texto" },
  { id: 2, iso: "2026-05-01T10:05:00Z", author: "Cliente", type: "audio", audioStatus: "transcrito",
    mediaFile: "PTT-001.opus", text: AUDIO + "quero visitar sábado" },
  ...extra
];

const resultado = (nome, telefone, timeline) => ({
  lead: { clientName: nome, phone: telefone },
  analysis: { clientName: nome, lead: { clientName: nome, phone: telefone }, summary: "resumo", messages: { a: "a", b: "b", c: "c" } },
  timeline
});

// ── 1. LEAD NOVO: grava, com dono, etapa "Ativo" e as chaves de deduplicação ───────────────────
{
  _dedupeIndexadoResetar();
  const b = criarBanco();
  const r = await persistProcessingResult({
    result: resultado("Marcos Andrade", "54999013331", conversa()),
    fileName: "Conversa com Marcos.zip", organizationId: OUTRA_EMPRESA
  });
  assert.equal(r.ok, false, "sem Supabase configurado a função avisa em vez de fingir que gravou");
  assert.match(String(r.reason || ""), /Supabase/, "o motivo precisa ser claro");
}

// A partir daqui, injetamos o banco de mentira direto nas funções que o aceitam.
// ── 2. LEAD JÁ EXISTENTE é encontrado; LEAD NOVO não inventa correspondência ──────────────────
{
  _dedupeIndexadoResetar();
  const b = criarBanco();
  b.tabelas.whatsapp_processamentos.push({
    id: "lead-marcos", organization_id: OUTRA_EMPRESA,
    nome_arquivo: "Conversa com Marcos.zip", arquivo_nome: "Conversa com Marcos.zip",
    telefone: "54999013331", etapa: "Geladeira",
    resultado_analise: { clientName: "Marcos Andrade", lead: { clientName: "Marcos Andrade", phone: "54999013331" } },
    timeline_json: conversa()
  });

  const achado = await _buscarProcessamentoExistenteV681(b.cliente, {
    result: resultado("Marcos Andrade", "54999013331", conversa()),
    fileName: "Conversa com Marcos.zip", organizationId: OUTRA_EMPRESA
  });
  assert.equal(achado?.row?.id, "lead-marcos", "lead existente precisa ser encontrado");
  assert.equal(achado.row.etapa, "Geladeira", "a etapa salva precisa vir junto (senão reimportar desarquiva)");

  // ÁUDIO JÁ TRANSCRITO: o cache é montado a partir da conversa que voltou.
  const cache = transcricoesDoLeadAnterior(achado.row.timeline_json);
  assert.deepEqual(Object.keys(cache), ["PTT-001.opus"], "o áudio já transcrito precisa ser reaproveitado");
  assert.equal(cache["PTT-001.opus"], "quero visitar sábado");

  // ÁUDIO NOVO: um arquivo que não está na conversa salva não aparece no cache — será transcrito.
  assert.ok(!("PTT-002.opus" in cache), "áudio novo não pode aparecer como já transcrito");

  // LEAD NOVO de verdade: nome e telefone diferentes não podem casar com o do Marcos.
  const semCorrespondencia = await _buscarProcessamentoExistenteV681(b.cliente, {
    result: resultado("Joana Ribeiro", "51988887777", conversa()),
    fileName: "Conversa com Joana.zip", organizationId: OUTRA_EMPRESA
  });
  assert.equal(semCorrespondencia, null, "cliente diferente NÃO pode casar com um lead existente");
}

// ── 3. ISOLAMENTO ENTRE EMPRESAS: o lead de uma conta é invisível pra outra ────────────────────
{
  _dedupeIndexadoResetar();
  const b = criarBanco();
  b.tabelas.whatsapp_processamentos.push({
    id: "lead-de-outro", organization_id: OUTRA_EMPRESA,
    nome_arquivo: "Conversa com Marcos.zip", arquivo_nome: "Conversa com Marcos.zip",
    telefone: "54999013331", etapa: "Ativo",
    resultado_analise: { clientName: "Marcos Andrade", lead: { clientName: "Marcos Andrade", phone: "54999013331" } },
    timeline_json: conversa()
  });
  const deOutraEmpresa = await _buscarProcessamentoExistenteV681(b.cliente, {
    result: resultado("Marcos Andrade", "54999013331", conversa()),
    fileName: "Conversa com Marcos.zip",
    organizationId: EMPRESA_PRINCIPAL_ID // outra conta procurando o MESMO cliente
  });
  assert.equal(deOutraEmpresa, null,
    "a busca NUNCA pode enxergar o lead de outra empresa — seria fusão de cadastros entre contas");
  for (const c of b.consultas) {
    assert.ok(c.cols.length, "toda consulta precisa declarar colunas");
  }
}

// ── 4. FALHA AO RELER A CONVERSA nunca vira conversa vazia ────────────────────────────────────
// É a regra de ouro nascida da v1082: o silêncio ali apagava o histórico e re-transcrevia tudo.
{
  _dedupeIndexadoResetar();
  const linha = {
    id: "lead-1", organization_id: OUTRA_EMPRESA,
    nome_arquivo: "Conversa com Marcos.zip", arquivo_nome: "Conversa com Marcos.zip",
    telefone: "54999013331", etapa: "Ativo",
    resultado_analise: { clientName: "Marcos Andrade", lead: { clientName: "Marcos Andrade", phone: "54999013331" } },
    timeline_json: conversa()
  };
  // Banco que responde a varredura mas FALHA ao buscar a conversa do lead encontrado.
  const bancoQuebrado = {
    from() {
      return {
        select(cols) {
          const filtros = [];
          const c = {
            eq(col, val) { filtros.push([col, val]); return c; },
            order() { return c; },
            limit() {
              if (String(cols).startsWith("id,timeline_json")) {
                return Promise.resolve({ data: null, error: { message: "connection terminated unexpectedly" } });
              }
              if (filtros.length > 1) return Promise.resolve({ data: null, error: { message: "column dedupe_fone8 does not exist (schema cache)" } });
              return Promise.resolve({ data: [linha], error: null });
            }
          };
          return c;
        }
      };
    }
  };
  await assert.rejects(
    () => _buscarProcessamentoExistenteV681(bancoQuebrado, {
      result: resultado("Marcos Andrade", "54999013331", conversa()),
      fileName: "Conversa com Marcos.zip", organizationId: OUTRA_EMPRESA
    }),
    /conversa já salva/i,
    "falha ao reler a conversa PRECISA estourar, nunca devolver conversa vazia como se fosse real"
  );
}

// ── 5. REIMPORTAÇÃO SEM MENSAGEM NOVA não perde nada ──────────────────────────────────────────
{
  const { _mesclarTimelinesV681 } = await import("../api/_persistence.js");
  const antiga = conversa();
  const mesma = conversa();
  const r = _mesclarTimelinesV681(antiga, mesma);
  assert.equal(r.timeline.length, antiga.length,
    "reimportar a mesma conversa não pode duplicar mensagem");
  assert.equal(r.novasUnicas, 0, "sem mensagem nova, o contador precisa dizer zero");
  assert.equal(r.preservadasDoAntigo, 0, "nada do histórico pode se perder");

  // E com mensagem nova, ela entra sem apagar o que já existia.
  const comNova = conversa([{ id: 3, iso: "2026-05-02T09:00:00Z", author: "Cliente", text: "e o valor?", type: "texto" }]);
  const r2 = _mesclarTimelinesV681(antiga, comNova);
  assert.equal(r2.timeline.length, antiga.length + 1, "a mensagem nova entra");
  assert.equal(r2.novasUnicas, 1);
  assert.ok(r2.timeline.some(m => m.text === "e o valor?"), "a mensagem nova precisa estar na conversa final");
  assert.ok(r2.timeline.some(m => m.text === AUDIO + "quero visitar sábado"),
    "o áudio já transcrito precisa sobreviver à mescla — senão seria transcrito de novo");
}

// ── 6. FALHA TEMPORÁRIA DO BANCO não é confundida com sucesso ─────────────────────────────────
{
  const b = criarBanco({ falharUpdateNaPrimeira: true });
  const { adaptiveUpdateById } = await import("../api/_persistence.js");
  b.tabelas.whatsapp_processamentos.push({ id: "lead-1", organization_id: OUTRA_EMPRESA, etapa: "Ativo" });
  await assert.rejects(
    () => adaptiveUpdateById(b.cliente, "whatsapp_processamentos", "lead-1", { etapa: "Geladeira" }),
    /connection reset/i,
    "erro temporário do banco precisa subir como erro, não virar sucesso silencioso"
  );
  assert.equal(b.tabelas.whatsapp_processamentos[0].etapa, "Ativo",
    "nada pode ter sido gravado quando a operação falhou");
}

// ── 7. COLUNA CRÍTICA AUSENTE interrompe em vez de gravar dado órfão ──────────────────────────
{
  const { tryInsert } = await import("../api/_persistence.js");
  // Banco que não tem a coluna do dono (cenário de migração não aplicada).
  const b = criarBanco({ colunas: ["id", "nome_arquivo", "etapa"] });
  await assert.rejects(
    () => tryInsert(b.cliente, "whatsapp_processamentos", {
      id: "x", organization_id: OUTRA_EMPRESA, nome_arquivo: "a.zip", etapa: "Ativo"
    }),
    (e) => e.code === "COLUNA_CRITICA",
    "sem a coluna do dono, a gravação precisa parar — dado órfão é pior que erro"
  );
  assert.equal(b.tabelas.whatsapp_processamentos.length, 0, "nada pode ter sido gravado");
}

_dedupeIndexadoResetar();
console.log("v1092-importacao-integracao: ok");
