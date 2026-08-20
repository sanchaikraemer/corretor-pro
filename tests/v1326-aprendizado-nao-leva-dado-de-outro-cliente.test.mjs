import fs from "node:fs";
import assert from "node:assert/strict";
import {
  limparAprendizadoDeOutroCliente, apelidosDeTodosOsClientesAprendidos,
  jeitoAprendidoCompacto, casosSemelhantesPrompt
} from "../api/_pipeline.js";

// v1326 — O APRENDIZADO DE UM CLIENTE NÃO LEVA OS DADOS DELE PARA A CONVERSA DE OUTRO.
//
// Auditoria de 20/08/2026: "jeitoAprendidoCompacto ainda pode inserir material aprendido de outras
// conversas […] O prompt avisa 'imite a forma, não o conteúdo', mas o texto armazenado não passa
// por anonimização forte antes de voltar para outro lead. Uma mensagem real aprendida pode conter
// nome, empreendimento, cidade, valor, condição, endereço."
//
// Pedir pra IA não copiar é instrução; tirar o dado antes de mandar é garantia. O que atravessa de
// um cliente pra outro passa a ser a ESTRUTURA da condução.

// ── 1. A limpeza: o que sai e o que FICA ─────────────────────────────────────────────────────
{
  const limpo = limparAprendizadoDeOutroCliente(
    "Bom dia, Noemi! No Renaissance conseguimos R$ 200 mil de entrada, o saldo financiado em 2028. Meu contato é (54) 99999-8888.",
    { arquivo: "Conversa do WhatsApp com Noemi Barcarol.txt", produto: "Renaissance" }
  );
  for (const proibido of ["Noemi", "Renaissance", "R$ 200 mil", "99999-8888"]) {
    assert.ok(!limpo.includes(proibido), `"${proibido}" não pode atravessar para a conversa de outro cliente: ${limpo}`);
  }
  // A forma da mensagem — que é o que se quer aprender — continua inteira.
  assert.match(limpo, /Bom dia/, "o jeito de abrir continua");
  assert.match(limpo, /conseguimos \[valor\] de entrada/, "a estrutura da condução continua legível");
  assert.match(limpo, /financiado em 2028/, "prazo não é dado pessoal e continua");

  const enderecos = limparAprendizadoDeOutroCliente("mostrei a unidade da Rua Ernesto Alves o metro quadrado é R$ 9.000", {});
  assert.ok(!enderecos.includes("Ernesto Alves"), "endereço sai");
  assert.match(enderecos, /o metro quadrado é \[valor\]/, "e a limpeza não engole a frase inteira junto");

  const esquina = limparAprendizadoDeOutroCliente("ela tem 3 terrenos na esquina da ouro preto", {});
  assert.ok(!esquina.includes("ouro preto"), "endereço escrito em minúscula, como no WhatsApp, também sai");

  // O que ensina a conduzir não pode ser destruído pela limpeza.
  const estrutura = "quando o cliente sinalizou entrada abaixo da condição padrão, propus validar uma exceção condicionada ao fechamento";
  assert.equal(limparAprendizadoDeOutroCliente(estrutura, {}), estrutura, "condução sem dado pessoal passa intacta");
  const numeros = "apartamento de 43 m² com 2 banheiros, entrada de 40% e entrega em 2028";
  assert.equal(limparAprendizadoDeOutroCliente(numeros, {}), numeros, "metragem, percentual e prazo continuam — são condução, não identidade");
}

// ── 2. O nome de um cliente não escapa dentro do aprendizado de outro ────────────────────────
{
  const config = { inteligenciaAprendida: { tons: [
    { texto: "Igual fiz com a Marcia Prestes: mandei as duas plantas antes de falar de preço.",
      origem: { arquivo: "Conversa com Leonardo Souza.txt", produto: "Evolutti" } }
  ] } };
  const memoria = { casos: [{ sourceFile: "Conversa do WhatsApp com Marcia Prestes.txt", produto: "Boulevard" }] };
  const apelidos = apelidosDeTodosOsClientesAprendidos(config, memoria);
  assert.ok(apelidos.some(a => /Marcia/i.test(a)), "os apelidos precisam cobrir todos os clientes que já ensinaram algo");
  const limpo = limparAprendizadoDeOutroCliente(config.inteligenciaAprendida.tons[0].texto, config.inteligenciaAprendida.tons[0].origem, apelidos);
  assert.ok(!limpo.includes("Marcia"), "nome de um cliente citado no aprendizado de outro também sai");
  assert.match(limpo, /mandei as duas plantas antes de falar de preço/, "e a lição continua");
}

// ── 3. O bloco que vai pro pedido sai limpo ──────────────────────────────────────────────────
{
  const config = { inteligenciaAprendida: {
    tons: [{ texto: "Bom dia, Noemi! No Renaissance a entrada ficou em R$ 200 mil, você quer ver?",
             origem: { arquivo: "Conversa com Noemi Barcarol.txt", produto: "Renaissance" } }],
    objecoes: [{ objecao: "achou caro", funcionou: true,
                 respostaUsada: "mostrei que na Rua Ernesto Alves sai por 430 mil e a unidade nova por 500 mil",
                 origem: { arquivo: "Conversa com Leonardo Souza.txt", produto: "Evolutti" } }]
  } };
  const bloco = jeitoAprendidoCompacto(config, "cliente quer dois banheiros e não tem pressa");
  for (const proibido of ["Noemi", "Renaissance", "R$ 200 mil", "Ernesto Alves", "430 mil", "Evolutti"]) {
    assert.ok(!bloco.includes(proibido), `"${proibido}" chegou no pedido enviado à IA: ${bloco}`);
  }
  assert.match(bloco, /imite a forma, não o conteúdo/, "o aviso do prompt continua — a limpeza é a primeira barreira, não a única");
  assert.match(bloco, /foram RETIRADOS/, "e o pedido precisa explicar por que aparecem [valor]/[empreendimento]");
  assert.match(bloco, /nunca escreva esses marcadores/, "a IA não pode escrever [valor] na mensagem do cliente");
  assert.match(bloco, /quando "achou caro"/, "a objeção em si continua — é ela que ensina a conduzir");
}

// ── 4. Os casos da carteira, quando forem usados, saem limpos do mesmo jeito ─────────────────
{
  const memoria = { casos: [{
    situacao: "Cliente do Boulevard queria desconto",
    sinalCliente: "disse que tinha R$ 300 mil",
    conducaoCorretor: "propus entrada menor e mostrei a Avenida Pátria 250",
    resultado: "validada", regra: "entrada flexível destrava",
    sourceFile: "Conversa com Marcia Prestes.txt", produto: "Boulevard"
  }] };
  const bloco = casosSemelhantesPrompt(memoria, "desconto entrada");
  for (const proibido of ["Boulevard", "R$ 300 mil", "Avenida Pátria 250", "Marcia"]) {
    assert.ok(!bloco.includes(proibido), `"${proibido}" atravessou no bloco de casos: ${bloco}`);
  }
  assert.match(bloco, /entrada flexível destrava/, "a regra aprendida continua");
  assert.match(bloco, /propus entrada menor/, "e a condução também");
}

// ── 5. Aprendizado sem nada dentro continua devolvendo vazio ─────────────────────────────────
{
  assert.equal(jeitoAprendidoCompacto({}, "qualquer coisa"), "", "sem aprendizado, nada muda no pedido");
  assert.equal(casosSemelhantesPrompt({ casos: [] }, "x"), "");
  assert.equal(limparAprendizadoDeOutroCliente("", {}), "");
  assert.equal(limparAprendizadoDeOutroCliente(null, null), "");
}

// ── 6. A ponta ligada: a análise usa a versão que limpa ──────────────────────────────────────
{
  const fonte = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  assert.match(fonte, /jeitoAprendidoCompacto\(configCerebro, timelineText, memoriaCasos\)/,
    "a análise precisa passar a memória, senão o apelido de um cliente escapa no aprendizado de outro");
  assert.match(fonte, /export function limparAprendizadoDeOutroCliente/, "a limpeza precisa continuar existindo");
}

console.log("v1326-aprendizado-nao-leva-dado-de-outro-cliente: ok");
