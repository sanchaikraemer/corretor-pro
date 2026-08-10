import assert from "node:assert/strict";
import {
  tryInsert, adaptiveUpdateById,
  _colunasInexistentesEstado, _colunasInexistentesResetar,
  _buscarProcessamentoExistenteV681, _dedupeIndexadoResetar
} from "../api/_persistence.js";

// v1096 — REGRESSÃO GRAVE DA v1092, flagrada pelo dono com print: a importação morria em
// "salvando no banco de dados... (94%)" com "Sem conexão com a internet ou o servidor caiu".
//
// Causa: a v1092 passou a mandar três colunas novas de deduplicação (migração 0010) que a maioria
// dos bancos ainda não tem. A gravação adaptativa descobre coluna faltante do jeito mais caro
// possível — manda o registro INTEIRO, o banco recusa citando UMA coluna, descarta e manda tudo de
// novo. Três colunas faltando = quatro idas ao banco, cada uma carregando a conversa completa. E o
// salvamento tem retry, então oito. Com conversa grande isso estoura o tempo da função, ela é
// morta, e o navegador vê a conexão cair (por isso a mensagem de "sem conexão").
//
// Este teste CONTA as idas ao banco. É o número que precisa ficar pequeno.

const COLUNAS_NOVAS = ["dedupe_fone8", "dedupe_arquivo", "dedupe_nome"];

// Banco de mentira que só tem as colunas antigas e conta cada ida.
function bancoAntigo() {
  const reg = { escritas: 0, payloads: [] };
  const responder = (payload) => {
    reg.escritas++;
    reg.payloads.push(Object.keys(payload));
    for (const col of COLUNAS_NOVAS) {
      if (col in payload) {
        return { data: null, error: { message: `Could not find the '${col}' column of 'whatsapp_processamentos' in the schema cache` } };
      }
    }
    return { data: { ...payload }, error: null };
  };
  const fim = (p) => ({ select: () => ({ maybeSingle: async () => responder(p) }) });
  return {
    reg,
    cliente: { from: () => ({ insert: fim, upsert: fim, update: (p) => ({ eq: () => fim(p) }) }) }
  };
}

const registro = () => ({
  id: "lead-1",
  organization_id: "11111111-1111-1111-1111-111111111111",
  nome_arquivo: "Conversa do WhatsApp com Marcos.zip",
  etapa: "Ativo",
  timeline_json: [{ text: "oi" }],
  resultado_analise: { clientName: "Marcos" },
  dedupe_fone8: "99013331",
  dedupe_arquivo: "conversa do whatsapp com marcos",
  dedupe_nome: "marcos"
});

// ── 1. A PRIMEIRA gravação ainda aprende (uma ida por coluna) — mas grava certo ────────────────
{
  _colunasInexistentesResetar();
  const b = bancoAntigo();
  const gravado = await tryInsert(b.cliente, "whatsapp_processamentos", registro());

  assert.ok(gravado, "sem a migração, a gravação precisa concluir mesmo assim");
  assert.equal(gravado.organization_id, "11111111-1111-1111-1111-111111111111", "o dono continua intacto");
  assert.equal(gravado.etapa, "Ativo", "a etapa continua intacta");
  assert.deepEqual(
    _colunasInexistentesEstado("whatsapp_processamentos").sort(),
    [...COLUNAS_NOVAS].sort(),
    "as três colunas ausentes precisam ficar lembradas"
  );
}

// ── 2. A SEGUNDA gravação vai DIRETO — é isso que mata a lentidão ─────────────────────────────
{
  const b = bancoAntigo();
  const gravado = await tryInsert(b.cliente, "whatsapp_processamentos", registro());

  assert.equal(b.reg.escritas, 1,
    `sabendo que as colunas não existem, a gravação tem que ir de primeira (foram ${b.reg.escritas} idas ao banco)`);
  assert.ok(gravado, "e precisa gravar");
  for (const col of COLUNAS_NOVAS) {
    assert.ok(!b.reg.payloads[0].includes(col), `"${col}" não pode nem ser mandada de novo`);
  }
}

// ── 3. Vale também pro UPDATE (é o caminho de quem reimporta um cliente que já existe) ─────────
{
  const b = bancoAntigo();
  const r = await adaptiveUpdateById(b.cliente, "whatsapp_processamentos", "lead-1", registro());
  assert.equal(b.reg.escritas, 1,
    `reimportar também tem que ir de primeira (foram ${b.reg.escritas} idas ao banco)`);
  assert.ok(r, "e precisa gravar");
}

// ── 4. Prova do defeito: SEM a memória, seriam 4 idas em vez de 1 ─────────────────────────────
{
  _colunasInexistentesResetar();
  const b = bancoAntigo();
  await tryInsert(b.cliente, "whatsapp_processamentos", registro());
  assert.equal(b.reg.escritas, 4,
    'sem a memória são 4 idas ao banco (1 por coluna faltante + a que dá certo) — era esse o custo repetido a CADA gravação');
}

// ── 5. A BUSCA avisa a gravação: o primeiro salvamento do servidor já sai barato ───────────────
// A busca de duplicado roda segundos antes da gravação, no mesmo pedido, e já descobre que as
// colunas não existem. Essa descoberta tem que ser aproveitada.
{
  _colunasInexistentesResetar();
  _dedupeIndexadoResetar();

  const bancoBusca = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => {
            const falha = () => Promise.resolve({ data: null, error: { message: "column whatsapp_processamentos.dedupe_fone8 does not exist (schema cache)" } });
            return { order: () => ({ limit: falha }), limit: falha };
          },
          order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          limit: () => Promise.resolve({ data: [], error: null })
        })
      })
    })
  };

  await _buscarProcessamentoExistenteV681(bancoBusca, {
    result: { analysis: { clientName: "Marcos" }, lead: { clientName: "Marcos", phone: "54999013331" } },
    fileName: "Conversa com Marcos.zip",
    organizationId: "org-1"
  });

  assert.deepEqual(
    _colunasInexistentesEstado("whatsapp_processamentos").sort(),
    [...COLUNAS_NOVAS].sort(),
    "a busca precisa avisar a gravação sobre as colunas que não existem"
  );

  // E aí a gravação seguinte — a do mesmo pedido — já vai direto.
  const b = bancoAntigo();
  await tryInsert(b.cliente, "whatsapp_processamentos", registro());
  assert.equal(b.reg.escritas, 1,
    `depois da busca, o primeiro salvamento já vai de primeira (foram ${b.reg.escritas} idas ao banco)`);
}

// ── 6. Nada disso pode afrouxar a trava de campo crítico ──────────────────────────────────────
{
  _colunasInexistentesResetar();
  const semDono = {
    from: () => ({
      insert: (p) => ({ select: () => ({ maybeSingle: async () => ({
        data: null, error: { message: "Could not find the 'organization_id' column of 'whatsapp_processamentos' in the schema cache" }
      }) }) })
    })
  };
  await assert.rejects(
    () => tryInsert(semDono, "whatsapp_processamentos", registro()),
    (e) => e.code === "COLUNA_CRITICA",
    "campo crítico continua interrompendo a gravação — a memória não pode virar desculpa pra descartar"
  );
  assert.ok(!_colunasInexistentesEstado("whatsapp_processamentos").includes("organization_id"),
    "coluna crítica NUNCA pode entrar na lista de descartáveis lembradas");
}

// ── 7. A mensagem de erro do salvamento não pode culpar a internet do corretor ────────────────
// No print do dono o celular estava no wi-fi, com sinal cheio, e o app dizia "Sem conexão com a
// internet". O que faltava era a informação que importa: a análise não se perdeu.
{
  const fs = await import("node:fs");
  // v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8")
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
  const bloco = app.match(/const pareceQuedaDeConexao =[\s\S]{0,900}?\n  \}/);
  assert.ok(bloco, "não localizei o tratamento de falha do salvamento");
  const src = bloco[0];

  assert.match(src, /N[ÃA]O foi perdida/i,
    "a mensagem precisa dizer que a análise não se perdeu");
  assert.match(src, /Salvar lead/,
    "e precisa dizer o que fazer: tocar em Salvar lead de novo");
  assert.match(src, /Failed to fetch\|NetworkError\|aborted\|AbortError/,
    "a queda de conexão precisa ser reconhecida pra receber essa mensagem");

  // E o estado da análise precisa continuar de pé pra a segunda tentativa fazer sentido.
  assert.doesNotMatch(src, /state\.pendingSave\s*=\s*null/,
    "a análise pendente NÃO pode ser descartada quando o salvamento falha");
  const catchInteiro = app.match(/\}catch\(err\)\{[\s\S]{0,1600}?pareceQuedaDeConexao/);
  assert.ok(catchInteiro, "não localizei o catch do salvamento");
  assert.match(catchInteiro[0], /pendingActions.*display\s*=\s*["']flex["']/,
    "os botões de tentar de novo precisam voltar");
  assert.doesNotMatch(catchInteiro[0], /state\.pendingSave\s*=\s*null/,
    "e a análise pendente precisa continuar de pé pra a segunda tentativa");
}

_colunasInexistentesResetar();
_dedupeIndexadoResetar();
console.log("v1096-gravacao-nao-repete-ida-ao-banco: ok");
