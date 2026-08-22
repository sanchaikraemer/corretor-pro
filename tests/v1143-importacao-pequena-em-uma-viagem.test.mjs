import fs from "node:fs";
import assert from "node:assert/strict";
import { _buscarProcessamentoExistenteV681, _dedupeIndexadoResetar } from "../api/_persistence.js";

// v1143 — "quando exporto a análise mesmo com 2 ou 3 mensagens e sem áudio, demora demais, está
// impraticável; qualquer corretor desiste com essa demora" (dono, 05/08/2026).
//
// Numa conversa dessas não há NADA pra transcrever: o tempo era quase todo de estrutura, não de
// trabalho. Este arquivo tranca as três economias desta versão:
//
//   1. Sem áudio pendente e conversa pequena → preparar e analisar acontecem na MESMA ida ao
//      servidor (era uma viagem a mais, com partida a frio, manifesto regravado e a conversa
//      inteira subindo de volta no corpo do pedido).
//   2. A busca do "esse cliente já existe?" — que roda DUAS vezes por importação — parou de
//      baixar a análise inteira de até 5 mil clientes só pra ler telefone e nome.
//   3. Depois de salvar, nem a faxina dos arquivos temporários nem a recarga da carteira
//      seguram a abertura do cliente.

// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8")
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
const storage = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");

// ── 1. Uma viagem só quando não há áudio pendente ──────────────────────────────────────────────
{
  assert.match(app, /const pedeAnaliseJunto = tentativa === 1;/,
    "o app autoriza o servidor a já devolver a análise pronta — só na primeira tentativa, pra uma retentativa nunca pagar a análise duas vezes");
  assert.match(app, /action:"preparar", audioWindowDays:options\.audioWindowDays \|\| "90", analisarDireto: pedeAnaliseJunto/);
  // v1359 — e o prazo do app acompanha o do servidor quando a análise vem junto. Com 90s ele
  // desistia de um trabalho quase pronto (e já pago) e refazia tudo numa segunda ida: foi isso que
  // fez a importação do dono levar 3 minutos.
  assert.match(app, /analisarDireto: pedeAnaliseJunto \}, pedeAnaliseJunto \? 240000 : 90000\)/,
    "com análise junto o prazo é maior; sem ela, a preparação é curta e continua com 90s");
  assert.match(app, /if\(prep\?\.analiseIncluida\?\.ok && !audios\.length\) result = prep\.analiseIncluida;/,
    "quando a análise vem pronta, o app NÃO pede de novo (pedir de novo seria pagar duas vezes)");
  // A chamada separada continua existindo como caminho normal (ZIP grande, áudio novo, falha).
  assert.match(app, /action:"analisar"/, "o caminho separado continua existindo");

  const preparar = storage.slice(storage.indexOf('if (action === "preparar")'), storage.indexOf('if (action === "transcrever")'));
  assert.match(preparar, /body\?\.analisarDireto === true && !audiosPendentes\.length && zipPequeno/,
    "o servidor só junta as etapas sem áudio pendente e com conversa pequena (a função morre em 60s)");
  assert.match(preparar, /audiosPendentes = \(manifest\.prep\?\.audiosParaTranscrever \|\| \[\]\)[\s\S]*?filter\(nome => !manifest\.transcriptions\?\.\[nome\]\?\.text\)/,
    "pendente é o áudio que ainda não tem texto — reaproveitado não conta");
  assert.match(preparar, /catch \(_\) \{[\s\S]*?analiseIncluida = null;/,
    "qualquer problema na análise junta cai no caminho de sempre, sem quebrar a importação");
  // Não faz leitura extra no banco: usa o que a busca do cache de áudio já trouxe.
  assert.match(preparar, /matchAnterior\?\.row\?\.timeline_json/, "aproveita a conversa salva que já veio da busca");
  assert.match(preparar, /matchAnterior\.row\.resultado_analise/, "e a análise salva que já veio da busca");
  // E o resultado junto passa pela MESMA validação das três mensagens do caminho separado.
  assert.match(preparar, /trioOk = \[msgs\.a, msgs\.b, msgs\.c\]\.every/, "as três mensagens são validadas igual");
}

// ── 2. A varredura da carteira ficou leve — e o cliente achado traz o que falta ────────────────
{
  const persistencia = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");
  assert.match(persistencia, /COLUNAS_LEVES = "id,nome_arquivo,arquivo_nome,telefone,etapa,criado_em,created_at,atualizado_em,updated_at,fone_analise:resultado_analise->lead->>phone,nome_analise:resultado_analise->>clientName,nome_analise_lead:resultado_analise->lead->>clientName"/,
    "a varredura pede só telefone e nome, extraídos do JSON — nunca a análise inteira");
  assert.match(persistencia, /select\("id,timeline_json,resultado_analise"\)/,
    "a releitura do cliente encontrado traz a conversa E a análise salva (o reaproveitamento da v1141 depende dela)");
  assert.match(persistencia, /varrer\(COLUNAS_COMPLETAS\)/,
    "se o banco não aceitar a forma leve, cai na consulta antiga — nunca deixa de achar o cliente");
}

// ── 2b. Comportamento: com o banco devolvendo só os campos leves, o cliente é encontrado ───────
{
  const linhas = [{
    id: "lead-1",
    organization_id: "00000000-0000-0000-0000-000000000001",
    nome_arquivo: "Conversa do WhatsApp com Nasser-enxuto.zip",
    arquivo_nome: "Conversa do WhatsApp com Nasser-enxuto.zip",
    telefone: "",
    etapa: "Ativo",
    atualizado_em: "2026-08-05T10:00:00.000Z",
    timeline_json: [{ type: "text", author: "Nasser", text: "oi" }],
    resultado_analise: { clientName: "Nasser", messages: { a: "a".repeat(20), b: "b".repeat(20), c: "c".repeat(20) } }
  }];
  const consultas = [];
  const banco = {
    from() {
      return {
        select(cols) {
          consultas.push(String(cols));
          const filtros = [];
          const leve = !String(cols).includes(",resultado_analise,");
          const projetar = (l) => {
            if (String(cols).includes("timeline_json")) return { id: l.id, timeline_json: l.timeline_json, resultado_analise: l.resultado_analise };
            const out = {
              id: l.id, nome_arquivo: l.nome_arquivo, arquivo_nome: l.arquivo_nome, telefone: l.telefone,
              etapa: l.etapa, atualizado_em: l.atualizado_em
            };
            if (leve) {
              out.fone_analise = l.resultado_analise?.lead?.phone || null;
              out.nome_analise = l.resultado_analise?.clientName || null;
              out.nome_analise_lead = l.resultado_analise?.lead?.clientName || null;
            } else {
              out.resultado_analise = l.resultado_analise;
            }
            return out;
          };
          const aplicar = () => linhas.filter(l => filtros.every(([c, v]) => String(l[c] ?? "") === String(v))).map(projetar);
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
  _dedupeIndexadoResetar?.();
  const achado = await _buscarProcessamentoExistenteV681(banco, {
    result: {},
    fileName: "Conversa-do-WhatsApp-com-Nasser-enxuto.zip", // nome sanitizado, como chega do armazenamento
    path: "whatsapp/organizations/x/imports/imp-1/Conversa-do-WhatsApp-com-Nasser-enxuto.zip",
    organizationId: "00000000-0000-0000-0000-000000000001"
  });
  assert.ok(achado?.row?.id === "lead-1", "encontra o cliente já salvo mesmo com a varredura leve");
  assert.equal(achado.row.timeline_json.length, 1, "a conversa salva vem na releitura");
  assert.equal(achado.row.resultado_analise.clientName, "Nasser", "a análise salva vem na releitura");
  assert.ok(consultas.some(c => c.includes("fone_analise:resultado_analise->lead->>phone")), "a varredura usou a forma leve");
  // A forma pesada da VARREDURA (a análise inteira de toda a carteira) não foi usada em nenhum
  // momento. As consultas pontuais por chave indexada — de um cliente só — continuam trazendo o
  // registro completo, e é isso que se quer: uma linha, não cinco mil.
  assert.ok(!consultas.includes("id,nome_arquivo,arquivo_nome,telefone,etapa,resultado_analise,criado_em,created_at,atualizado_em,updated_at"),
    "e nunca precisou da forma pesada da varredura");
}

// ── 3. Depois de salvar, nada pesado segura a abertura do cliente ──────────────────────────────
{
  const atualizar = app.slice(app.indexOf("async function atualizarLeadComEvolucao(){"), app.indexOf("async function salvarLeadPendente(){"));
  assert.doesNotMatch(atualizar, /await finalizarImportacaoStorage/, "a faxina dos temporários não espera mais");
  assert.doesNotMatch(atualizar, /await loadRecentLeads\(true\)/, "a recarga da carteira inteira não espera mais");
  assert.match(atualizar, /loadRecentLeads\(true\)\.then\(\(\) => \{ try\{ refreshAllSections\(\); \}catch\(_\)\{\} \}\)/,
    "ela continua acontecendo, e as seções se atualizam quando os dados chegam");
  // O que é local e rápido (limpar o ZIP compartilhado do aparelho) CONTINUA esperado: sem isso um
  // ZIP antigo pode ser reprocessado depois — importação paga de novo.
  assert.match(atualizar, /await finalizarSharePendente\(shareConcluidoId\)/, "a limpeza local do compartilhamento continua garantida");

  const salvar = app.slice(app.indexOf("async function salvarLeadPendente(){"), app.indexOf("async function descartarLeadPendente()"));
  assert.doesNotMatch(salvar, /await finalizarImportacaoStorage/, "mesma coisa no caminho de lead novo");
  assert.match(salvar, /await finalizarSharePendente\(shareConcluidoId\)/, "e a limpeza local continua garantida aqui também");
}

console.log("v1143-importacao-pequena-em-uma-viagem: ok");
