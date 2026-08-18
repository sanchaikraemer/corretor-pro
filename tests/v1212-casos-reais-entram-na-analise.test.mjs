// v1212 — o banco de casos reais da carteira e o formato do bloco que ele monta.
//
// ATENÇÃO, ISTO MUDOU DE LADO NA v1301. Até a v1300 este arquivo garantia que os casos de outros
// clientes CHEGASSEM no pedido da análise. Por ordem direta do dono ("tira as duas fontes",
// 18/08/2026, depois do print das 19h36), eles NÃO chegam mais: numa conversa de três linhas sobre
// um apartamento anunciado só com dormitórios, box e preço, as três sugestões voltaram afirmando em
// que empreendimento ele estava e perto de que rua ficava. Esse material vinha dos casos de outros
// clientes e do bloco de fatos da carteira — não da conversa. O cliente recebia endereço de outro
// imóvel por escrito.
//
// O que continua valendo deste arquivo: a função que monta o bloco segue existindo e sendo testada
// (o banco de casos continua sendo aprendido, exportado e mostrado na tela de Aprendizado). O que
// mudou é a ligação com a análise, e a seção final guarda justamente a DESLIGAÇÃO — porque já
// aconteceu de sessão futura religar bloco desligado achando que era esquecimento (foi assim que os
// casos voltaram na v1212, depois de a v1092 tê-los apagado por "sem chamador").
import fs from "node:fs";
import assert from "node:assert/strict";
import { casosSemelhantesPrompt } from "../api/_pipeline.js";

const casos = [
  {
    situacao: "cliente recebeu tabela de apartamento pronto e sumiu",
    sinalCliente: "cliente pediu valores do apartamento e não respondeu depois",
    impedimento: "sem retorno depois do envio",
    conducaoCorretor: "Retomei perguntando se conseguiu ver a tabela e ofereci separar outras unidades do mesmo perfil",
    resultado: "validada",
    evidenciaResultado: "cliente respondeu no mesmo dia",
    regra: "quando o cliente some depois da tabela, retomar por um ponto específico",
    produto: "apartamento pronto",
    etapa: "follow-up"
  },
  {
    situacao: "cliente falou em vender a casa antes de comprar",
    sinalCliente: "cliente disse que depende da venda do imóvel atual",
    impedimento: "depende de vender outro imóvel",
    conducaoCorretor: "Perguntei em que pé estava a venda da casa antes de oferecer qualquer coisa",
    resultado: "observada",
    evidenciaResultado: "cliente explicou o prazo",
    regra: "quando depende de venda, entender o estágio antes de ofertar",
    produto: "casa",
    etapa: "qualificação"
  },
  {
    situacao: "cliente pediu desconto logo no primeiro contato",
    sinalCliente: "cliente perguntou se tem desconto à vista",
    impedimento: "sem confirmação da construtora",
    conducaoCorretor: "Prometi um desconto que não estava confirmado",
    resultado: "nao-funcionou",
    evidenciaResultado: "cliente cobrou a condição depois e esfriou",
    regra: "nunca prometer condição sem confirmação",
    produto: "apartamento",
    etapa: "negociação"
  }
];

// 1) Com contexto parecido, o caso relacionado precisa aparecer — e o bloco precisa levar a
// condução REAL do corretor, não só a situação.
const bloco = casosSemelhantesPrompt({ casos }, "cliente pediu a tabela do apartamento pronto e sumiu depois do envio", 4);
assert.match(bloco, /CASOS REAIS DESTE CORRETOR/);
assert.match(bloco, /Retomei perguntando se conseguiu ver a tabela/, "a condução real do corretor precisa entrar no bloco");
assert.match(bloco, /Regra que ficou:/);
assert.match(bloco, /NUNCA copie fato, valor, produto ou condição de um caso antigo/i,
  "o bloco precisa proibir trazer fato de conversa antiga pra atual");

// 2) Caso que não funcionou entra MARCADO — serve de contraexemplo, não de modelo.
const blocoNegativo = casosSemelhantesPrompt({ casos }, "cliente perguntou se tem desconto à vista na negociação do apartamento", 4);
assert.match(blocoNegativo, /NÃO FUNCIONOU/, "caso que não funcionou precisa entrar marcado");
assert.match(blocoNegativo, /não repita este caminho aqui/i);

// 3) Sem casos, nada é inventado: bloco vazio (e a análise segue como antes).
assert.equal(casosSemelhantesPrompt({ casos: [] }, "qualquer conversa", 4), "");
assert.equal(casosSemelhantesPrompt(null, "qualquer conversa", 4), "");
assert.equal(casosSemelhantesPrompt({ casos: [{ situacao: "", conducaoCorretor: "" }] }, "conversa", 4), "");

// 4) O limite pedido é respeitado (o prompt não pode crescer sem controle).
const muitos = Array.from({ length: 40 }, (_, i) => ({
  situacao: `situação número ${i} com apartamento e tabela`,
  sinalCliente: "cliente pediu a tabela",
  conducaoCorretor: `condução real número ${i} do corretor com o cliente`,
  resultado: "validada",
  regra: `regra prática número ${i} pra esse tipo de situação`
}));
const blocoLimitado = casosSemelhantesPrompt({ casos: muitos }, "apartamento tabela cliente", 4);
assert.equal((blocoLimitado.match(/^- /gm) || []).length, 4, "só os N casos pedidos podem entrar");
assert.ok(blocoLimitado.length < 3200, "o bloco de casos não pode estourar o teto de tamanho");

// ── v1301 — a DESLIGAÇÃO da análise, guardada aqui pra não ser refeita sem querer ────────────
{
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  assert.doesNotMatch(pipeline, /const casosSemelhantes = casosSemelhantesPrompt\(/,
    "caso de OUTRO cliente não pode voltar pro pedido que escreve as três mensagens (v1301)");
  assert.doesNotMatch(pipeline, /Os casos semelhantes são referência auxiliar/,
    "e o bloco de casos não pode reaparecer no prompt de sistema");
  assert.match(pipeline, /NÃO RELIGUE ISSO/,
    "o motivo precisa estar escrito no código, no lugar onde a religação aconteceria");
}

console.log("v1212-casos-reais-entram-na-analise: ok");
