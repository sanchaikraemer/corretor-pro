import assert from "node:assert/strict";
import fs from "node:fs";
import {
  _buscarProcessamentoExistenteV681,
  _dedupeIndexadoResetar,
  _nomesPodemSerOMesmoCliente,
  _chaveIdentidadeUtil,
  _mesclarAnaliseV681
} from "../api/_persistence.js";
import { guessLeadData } from "../api/_pipeline.js";

// v1176 — "estou exportando a conversa de uma cliente e está abrindo o lead de outra" (dono,
// 07/08/2026, com dois prints: o cadastro de uma cliente aparecendo recém-analisado logo depois
// de uma exportação que era de outra pessoa).
//
// Causa: o app tratava como "telefone do cliente" o PRIMEIRO número que aparecesse escrito em
// qualquer lugar da conversa — inclusive o número do próprio corretor, que ele manda pra todo
// mundo ("me chama no (54) 9...."). Esse número virava a chave de identidade do cadastro, e a
// busca por cliente já existente confere o telefone ANTES do nome. Duas pessoas diferentes que
// receberam o mesmo número escrito viravam o mesmo cadastro: a conversa da segunda era despejada
// no histórico da primeira, e o app abria o cliente errado no fim da importação.
//
// Este arquivo tranca as três frentes da correção:
//   1. número escrito no meio da conversa não é mais o telefone do cliente;
//   2. nenhuma chave (telefone ou nome do arquivo) funde duas pessoas de nomes diferentes;
//   3. a tela não aceita mais, de olhos fechados, o cliente que o servidor apontou.

const ORG = "00000000-0000-0000-0000-000000000001";
const FONE_DO_CORRETOR = "54999134477"; // o número que ele manda em TODA conversa

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

const CADASTRO_ANTIGO = {
  id: "lead-antigo",
  organization_id: ORG,
  nome_arquivo: "Conversa do WhatsApp com Tereza Campos.zip",
  arquivo_nome: "Conversa do WhatsApp com Tereza Campos.zip",
  telefone: FONE_DO_CORRETOR, // colhido do texto por uma versão antiga — é o número do corretor
  dedupe_fone8: FONE_DO_CORRETOR.slice(-8),
  dedupe_arquivo: "tereza campos",
  dedupe_nome: "tereza campos",
  etapa: "Ativo",
  atualizado_em: "2026-08-07T17:00:00.000Z",
  timeline_json: [{ type: "text", author: "Tereza Campos", text: "tenho interesse na torre norte" }],
  resultado_analise: { clientName: "Tereza Campos", lead: { phone: FONE_DO_CORRETOR } }
};

// ── 1. O número do corretor escrito na conversa não é o telefone do cliente ────────────────────
{
  const timeline = [
    { type: "text", author: "Marina Alves", text: "oi, vi o anuncio do apartamento", iso: "2026-06-14T18:51:00.000Z" },
    { type: "text", author: "Corretor", text: "boa tarde! qualquer coisa me chama no (54) 99913-4477", iso: "2026-06-14T18:55:00.000Z" }
  ];
  const lead = guessLeadData(timeline, "Corretor");
  assert.equal(lead.clientName, "Marina Alves", "o nome do cliente continua vindo do contato exportado");
  assert.equal(lead.phone, "", "número escrito no meio da conversa NUNCA vira o telefone do cliente");
  assert.equal(lead.telefoneCitadoNaConversa, FONE_DO_CORRETOR, "ele continua guardado como informação, sem valer identidade");
}

// ── 1b. Contato não salvo na agenda (o WhatsApp escreve o número): esse é o telefone real ──────
{
  const timeline = [
    { type: "text", author: "+55 54 99913-3331", text: "bom dia, tem unidade disponivel?", iso: "2026-06-14T12:00:00.000Z" }
  ];
  const lead = guessLeadData(timeline, "Corretor");
  assert.equal(lead.phone, "5554999133331", "o número do próprio contato exportado continua sendo aproveitado");
}

// ── 2. Nomes de pessoas diferentes nunca podem ser fundidos ────────────────────────────────────
{
  assert.equal(_nomesPodemSerOMesmoCliente("Marina Alves", "Tereza Campos"), false, "duas pessoas diferentes nunca");
  assert.equal(_nomesPodemSerOMesmoCliente("Marina Alves", "Marina Alves"), true, "mesmo nome, mesmo cliente");
  assert.equal(_nomesPodemSerOMesmoCliente("Marina", "Marina Alves"), true, "contato que ganhou o sobrenome depois");
  assert.equal(_nomesPodemSerOMesmoCliente("Tereza Campos", "Tereza Campos Torre Norte"), true, "contato renomeado com o empreendimento");
  assert.equal(_nomesPodemSerOMesmoCliente("Cliente importado", "Tereza Campos"), true, "sem nome utilizável, quem decide é a outra pista");
  assert.equal(_chaveIdentidadeUtil("conversa-whatsapp.zip"), "", "nome de arquivo genérico não identifica ninguém");
  assert.equal(_chaveIdentidadeUtil("Conversa do WhatsApp com Marina Alves.zip"), "marina alves", "com o nome do contato, identifica");
}

// ── 3. Mesmo telefone + nomes diferentes → NÃO é o mesmo cadastro ──────────────────────────────
{
  _dedupeIndexadoResetar();
  const achado = await _buscarProcessamentoExistenteV681(criarBanco([CADASTRO_ANTIGO]), {
    result: { lead: { clientName: "Marina Alves", phone: FONE_DO_CORRETOR } },
    fileName: "Conversa do WhatsApp com Marina Alves.zip",
    organizationId: ORG
  });
  assert.equal(achado, null, "a conversa de uma cliente NUNCA entra no cadastro de outra por causa de um telefone igual");
}

// ── 3b. Mesmo telefone e mesmo cliente → continua reconhecendo (a economia da v1141 fica de pé) ─
{
  _dedupeIndexadoResetar();
  const mesmaCliente = {
    ...CADASTRO_ANTIGO,
    id: "lead-mesma-cliente",
    nome_arquivo: "Conversa do WhatsApp com Marina.zip",
    arquivo_nome: "Conversa do WhatsApp com Marina.zip",
    telefone: "5554999133331",
    dedupe_fone8: "99133331",
    dedupe_arquivo: "marina",
    dedupe_nome: "marina",
    timeline_json: [{ type: "text", author: "Marina", text: "oi" }],
    resultado_analise: { clientName: "Marina", lead: { phone: "5554999133331" } }
  };
  const achado = await _buscarProcessamentoExistenteV681(criarBanco([mesmaCliente]), {
    result: { lead: { clientName: "Marina Alves", phone: "5554999133331" } },
    fileName: "Conversa do WhatsApp com Marina Alves.zip",
    organizationId: ORG
  });
  assert.equal(achado?.row?.id, "lead-mesma-cliente", "o mesmo cliente com o contato renomeado continua sendo reconhecido");
}

// ── 3c. Dois ZIPs sem nome ("conversa-whatsapp.zip") não viram o mesmo cliente ─────────────────
{
  _dedupeIndexadoResetar();
  const anterior = {
    ...CADASTRO_ANTIGO,
    id: "lead-sem-nome-de-arquivo",
    nome_arquivo: "conversa-whatsapp.zip",
    arquivo_nome: "conversa-whatsapp.zip",
    telefone: "",
    dedupe_fone8: null,
    dedupe_arquivo: "conversa whatsapp",
    dedupe_nome: "conversa whatsapp",
    resultado_analise: { clientName: "Tereza Campos" }
  };
  const achado = await _buscarProcessamentoExistenteV681(criarBanco([anterior]), {
    result: { lead: { clientName: "Marina Alves", phone: "" } },
    fileName: "conversa-whatsapp.zip",
    organizationId: ORG
  });
  assert.equal(achado, null, "embalagem genérica do arquivo não cola dois clientes no mesmo cadastro");
}

// ── 3d. Id vindo do navegador apontando pra outra pessoa é recusado ────────────────────────────
{
  _dedupeIndexadoResetar();
  const achado = await _buscarProcessamentoExistenteV681(criarBanco([CADASTRO_ANTIGO]), {
    result: {
      lead: { clientName: "Marina Alves", phone: FONE_DO_CORRETOR },
      incrementalMeta: { existingLeadId: "lead-antigo" }
    },
    fileName: "Conversa do WhatsApp com Marina Alves.zip",
    organizationId: ORG,
    idJaIdentificado: "lead-antigo"
  });
  assert.equal(achado, null, "nem o id já identificado autoriza jogar a conversa no cadastro de outra pessoa");
}

// ── 4. Reimportação sem telefone não apaga o número que o corretor digitou ─────────────────────
{
  const merged = _mesclarAnaliseV681(
    { clientName: "Marina Alves", lead: { clientName: "Marina Alves", phone: "54999998888" } },
    { clientName: "Marina Alves", lead: { clientName: "Marina Alves", phone: "" } }
  );
  assert.equal(merged.lead.phone, "54999998888", "telefone cadastrado à mão sobrevive à reimportação");
}

// ── 5. A tela também não aceita mais o cliente apontado pelo servidor sem conferir o nome ──────
{
  // v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8")
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
  assert.match(app, /function nomesPodemSerOMesmoCliente\(/, "a tela tem a mesma pergunta 'pode ser a mesma pessoa?'");
  assert.match(app, /porId && nomesPodemSerOMesmoCliente\(nome, porId\.name\)/, "o id do servidor só vale se o nome permitir");
  const trecho = app.slice(app.indexOf("async function acharLeadExistente"), app.indexOf("async function finalizarImportacaoStorage"));
  assert.ok(!/if\(porId\) return \{ lead:porId, via:"id-do-servidor" \}/.test(trecho), "o atalho antigo, sem conferência de nome, não existe mais");
}

console.log("v1176-conversa-nunca-entra-no-cliente-errado: ok");
