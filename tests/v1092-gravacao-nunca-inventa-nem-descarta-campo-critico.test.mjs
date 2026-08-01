import assert from "node:assert/strict";
import { tryInsert, tryUpsert, adaptiveUpdateById, COLUNAS_ADAPTAVEIS } from "../api/_persistence.js";

// v1092 — a gravação "adaptativa" existe pra o app funcionar em bases antigas, que arrastam nomes
// de coluna de fases diferentes do projeto. O jeito como ela fazia isso era perigoso:
//
//   • qualquer coluna que o banco recusasse era DESCARTADA em silêncio — inclusive
//     organization_id, o dono do registro (é a mesma família do vazamento entre contas da v1082);
//   • qualquer coluna obrigatória que faltasse era PREENCHIDA com valor inventado, e a regra
//     `/^id$|_id$/` devolvia randomUUID() — ou seja, organization_id virava um UUID ALEATÓRIO e o
//     lead passava a pertencer a uma empresa que não existe. Sem erro nenhum.
//
// Este teste dirige a gravação de verdade contra um banco de mentira que recusa colunas.

// Banco falso: recusa as colunas listadas, como o PostgREST recusaria.
function bancoQueRecusa({ inexistentes = [], obrigatoriasVazias = [] } = {}) {
  const recebidos = [];
  const responder = (payload) => {
    recebidos.push({ ...payload });
    for (const col of inexistentes) {
      if (col in payload) return { data: null, error: { message: `Could not find the '${col}' column of 'whatsapp_processamentos' in the schema cache` } };
    }
    for (const col of obrigatoriasVazias) {
      if (payload[col] === undefined || payload[col] === null) {
        return { data: null, error: { message: `null value in column "${col}" violates not-null constraint` } };
      }
    }
    return { data: { ...payload }, error: null };
  };
  const fim = (payload) => ({ select: () => ({ maybeSingle: async () => responder(payload) }) });
  return {
    recebidos,
    cliente: {
      from() {
        return {
          insert: (p) => fim(p),
          upsert: (p) => fim(p),
          update: (p) => ({ eq: () => fim(p) })
        };
      }
    }
  };
}

const payload = {
  id: "lead-1",
  organization_id: "11111111-1111-1111-1111-111111111111",
  timeline_json: [{ text: "oi" }],
  resultado_analise: { clientName: "Cliente" },
  etapa: "Geladeira",
  nome_arquivo: "conversa.zip",
  audios_encontrados: 3
};

// ── 1. Coluna crítica que não existe: PARA, não descarta ──────────────────────────────────────
for (const critica of ["organization_id", "id", "timeline_json", "resultado_analise", "etapa"]) {
  const banco = bancoQueRecusa({ inexistentes: [critica] });
  await assert.rejects(
    () => tryInsert(banco.cliente, "whatsapp_processamentos", payload),
    (err) => {
      assert.equal(err.code, "COLUNA_CRITICA", `"${critica}" precisa parar a gravação, não ser descartada`);
      assert.match(err.message, new RegExp(critica), "o erro precisa dizer QUAL coluna");
      assert.match(err.message, /NENHUM dado foi gravado/, "o erro precisa deixar claro que nada foi gravado");
      assert.match(err.message, /migra/i, "o erro precisa apontar o caminho: conferir as migrações");
      return true;
    },
    `descartar "${critica}" em silêncio corrompe o dado`
  );
  // E nunca pode ter chegado a gravar uma versão sem a coluna crítica.
  for (const tentativa of banco.recebidos) {
    assert.ok(critica in tentativa, `nenhuma tentativa pode remover "${critica}" do que vai pro banco`);
  }
}

// ── 2. organization_id obrigatório e vazio: PARA, não inventa UUID ────────────────────────────
{
  const semDono = { ...payload };
  delete semDono.organization_id;
  const banco = bancoQueRecusa({ obrigatoriasVazias: ["organization_id"] });
  await assert.rejects(
    () => tryInsert(banco.cliente, "whatsapp_processamentos", semDono),
    (err) => {
      assert.equal(err.code, "COLUNA_CRITICA");
      assert.match(err.message, /dono do registro/, "o erro precisa explicar por que organization_id é crítico");
      return true;
    },
    "organization_id vazio precisa parar a gravação"
  );
  // A prova do defeito antigo: nenhuma tentativa pode conter um UUID inventado.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const tentativa of banco.recebidos) {
    assert.ok(!UUID.test(String(tentativa.organization_id || "")),
      "organization_id NUNCA pode ser preenchido com UUID aleatório — o lead ficaria de uma empresa inexistente");
  }
}

// ── 3. Coluna realmente opcional continua sendo adaptada (senão bases antigas quebram) ────────
{
  const banco = bancoQueRecusa({ inexistentes: ["audios_encontrados"] });
  const gravado = await tryInsert(banco.cliente, "whatsapp_processamentos", payload);
  assert.ok(gravado, "coluna opcional ausente precisa ser descartada e a gravação seguir");
  assert.ok(!("audios_encontrados" in gravado), "a coluna opcional some do que é gravado");
  assert.equal(gravado.organization_id, payload.organization_id, "o dono continua intacto");
  assert.ok(COLUNAS_ADAPTAVEIS.has("audios_encontrados"), "essa coluna precisa estar na lista de adaptáveis");
}

// ── 4. As mesmas regras valem no upsert e no update ───────────────────────────────────────────
{
  const b1 = bancoQueRecusa({ inexistentes: ["organization_id"] });
  await assert.rejects(() => tryUpsert(b1.cliente, "whatsapp_processamentos", payload),
    (e) => e.code === "COLUNA_CRITICA", "o upsert precisa da mesma trava");
  const b2 = bancoQueRecusa({ inexistentes: ["organization_id"] });
  await assert.rejects(() => adaptiveUpdateById(b2.cliente, "whatsapp_processamentos", "lead-1", payload),
    (e) => e.code === "COLUNA_CRITICA", "o update precisa da mesma trava");
}

// ── 5. A lista de adaptáveis não pode conter nada crítico ─────────────────────────────────────
for (const critica of ["organization_id", "id", "lead_id", "user_id", "timeline_json", "resultado_analise", "etapa"]) {
  assert.ok(!COLUNAS_ADAPTAVEIS.has(critica),
    `"${critica}" jamais pode entrar na lista de colunas adaptáveis`);
}

// ── 6. Banco SEM a migração 0010 precisa continuar gravando ───────────────────────────────────
// Este é o estado do banco de produção HOJE: as colunas de deduplicação (dedupe_fone8,
// dedupe_arquivo, dedupe_nome) ainda não existem, mas o app já as manda no payload. Se alguma
// delas não estiver na lista de adaptáveis, a trava de coluna crítica entende que é um campo
// essencial e INTERROMPE — ou seja, nenhuma importação grava mais nada.
//
// Foi exatamente isso que aconteceu enquanto a lista dizia "dedupe_telefone" e o código gravava
// "dedupe_fone8": nome trocado, e toda importação abortaria em produção.
{
  const semMigracao = ["dedupe_fone8", "dedupe_arquivo", "dedupe_nome"];
  const banco = bancoQueRecusa({ inexistentes: semMigracao });
  const gravado = await tryInsert(banco.cliente, "whatsapp_processamentos", {
    ...payload,
    dedupe_fone8: "99013331",
    dedupe_arquivo: "conversa",
    dedupe_nome: "cliente"
  });
  assert.ok(gravado, "sem a migração 0010, a importação PRECISA gravar assim mesmo (só perde velocidade)");
  assert.equal(gravado.organization_id, payload.organization_id, "o dono continua intacto");
  assert.equal(gravado.etapa, "Geladeira", "a etapa continua intacta");
  for (const col of semMigracao) {
    assert.ok(COLUNAS_ADAPTAVEIS.has(col),
      `"${col}" é gravada pelo app e é opcional de propósito — sem ela na lista, toda importação para`);
  }
}

// ── 7. Erro do banco chega como erro de verdade, com o que o banco disse ──────────────────────
// O Supabase devolve o erro como objeto simples. Jogado direto, ele não é reconhecido como erro
// por quem tenta tratá-lo e não carrega rastro nenhum de onde veio.
{
  const banco = {
    from: () => ({
      insert: () => ({ select: () => ({ maybeSingle: async () => ({
        data: null, error: { message: "connection reset by peer", code: "57P01", hint: "tente de novo" }
      }) }) })
    })
  };
  await assert.rejects(
    () => tryInsert(banco, "whatsapp_processamentos", payload),
    (err) => {
      assert.ok(err instanceof Error, "a falha precisa ser um Error de verdade");
      assert.match(err.message, /connection reset/i, "a mensagem do banco não pode se perder");
      assert.equal(err.code, "57P01", "o código do banco precisa sobreviver");
      assert.equal(err.hint, "tente de novo", "a dica do banco precisa sobreviver");
      return true;
    }
  );
}

console.log("v1092-gravacao-nunca-inventa-nem-descarta-campo-critico: ok");
